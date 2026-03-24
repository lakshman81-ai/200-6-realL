import fs from 'fs';
import path from 'path';
import { parsePCFText } from '../js/smart_fixer/core/pcf-parser.js';
import { generatePCFText } from '../js/smart_fixer/core/3d_smart_fixer_pcf_exporter.js';
import { PcfTopologyGraph } from '../js/smart_fixer/core/PcfTopologyGraph.js';

// Load the PCF
const fixturePath = path.join(process.cwd(), 'public', 'Station G_SYS-001.pcf');
if (!fs.existsSync(fixturePath)) {
    console.error(`Benchmark file not found at ${fixturePath}`);
    process.exit(1);
}

const rawData = fs.readFileSync(fixturePath, 'utf8');

// 1. Parse
const components = parsePCFText(rawData);

// 2. Instantiate and run Pass 1
const graph = new PcfTopologyGraph(components);
const pass1 = graph.runSequentialPass();

console.log(`Initial Gaps Found in Pass 1: ${pass1.visualGaps.length}`);

// 3. Approve and mutate Pass 1
const pass1Mutated = graph.applyApprovedMutations();
console.log(`Remaining Gaps after Pass 1 Mutations: ${pass1Mutated.visualGaps.length}`);

// 4. Run Pass 2 on the mutated graph
const pass2 = graph.runFuzzyTopologicalPass();
console.log(`Gaps Found in Pass 2: ${pass2.visualGaps.length}`);

// 5. Approve and mutate Pass 2
const pass2Mutated = graph.applyApprovedMutations();
console.log(`Remaining Gaps after Pass 2 Mutations: ${pass2Mutated.visualGaps.length}`);

// 6. Generate
const newText = generatePCFText(pass2Mutated.revisedComponents);

// 7. Re-Parse
const reparsedComponents = parsePCFText(newText);
const reGraph = new PcfTopologyGraph(reparsedComponents);
const rePass1 = reGraph.runSequentialPass();
const rePass2 = reGraph.runFuzzyTopologicalPass();

const finalGaps = rePass1.visualGaps.length + rePass2.visualGaps.length;

console.log(`Remaining Gaps after re-parsing (Round trip): ${finalGaps}`);

if (finalGaps === 0) {
    console.log("✅ Station G Benchmark Completed Successfully.");
} else {
    console.log(`❌ Station G Benchmark Failed. ${finalGaps} gaps remain.`);
    process.exit(1);
}
