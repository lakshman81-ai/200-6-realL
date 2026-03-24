import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parsePCFText } from '../js/smart_fixer/core/pcf-parser.js';
import { PcfTopologyGraph_2 } from '../js/smart_fixer/core/PcfTopologyGraph_2.js';
import { applyApprovedFixes } from '../js/smart_fixer/core/pcf-modifier.js';
import { generatePCFText } from '../js/smart_fixer/core/3d_smart_fixer_pcf_exporter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runBenchmark(filename) {
    console.log(`\n\n=== RUNNING BENCHMARK: ${filename} ===`);
    const inputPath = path.join(__dirname, 'BM2/input', filename);
    const expectedPath = path.join(__dirname, 'BM2/expected', filename.replace('.pcf', '_Fixed.pcf'));

    if (!fs.existsSync(inputPath)) {
        console.error(`Input file not found: ${inputPath}`);
        return;
    }

    const inputText = fs.readFileSync(inputPath, 'utf8');

    console.log("1. Parsing input...");
    let components = parsePCFText(inputText);
    console.log(`Parsed ${components.length} components.`);

    console.log("2. Running Graph Engine Analysis (Pass 1)...");
    const graph = new PcfTopologyGraph_2(components);
    const gaps = graph.visualGaps;
    console.log(`Detected ${gaps.length} topological issues.`);
    gaps.forEach((g, i) => console.log(`  Issue ${i+1}: Gap ${g.distance.toFixed(2)}mm between ${g.fromComp.type} and ${g.toComp.type}`));

    console.log("3. Applying fixes...");
    const result = applyApprovedFixes(components);
    components = result.revisedComponents;
    console.log(`Revised component count: ${components.length}`);

    console.log("4. Validating output graph...");
    const checkGraph = new PcfTopologyGraph_2(components);
    console.log(`Remaining issues: ${checkGraph.visualGaps.length}`);

    const outputText = generatePCFText(components);

    // Save output
    const outDir = path.join(__dirname, 'BM2/output');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
    fs.writeFileSync(path.join(outDir, filename), outputText);
    console.log(`Generated PCF saved to ${path.join('BM2/output', filename)}`);
}

const files = [
    'BM1_Gaps_Overlaps.pcf',
    'BM2_MultiAxis_NonPipeGaps.pcf',
    'BM3_TeeAnomalies_MissingReducer.pcf',
    'BM4_ElbowCP_MissingRefNo.pcf',
    'BM5_OletSyntax_MsgSquare.pcf',
    'BM6_MissingRVAssembly.pcf'
];

files.forEach(runBenchmark);
