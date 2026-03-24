import fs from 'fs';
import path from 'path';
import { parsePCFText } from '../js/smart_fixer/core/pcf-parser.js';
import { PcfTopologyGraph } from '../js/smart_fixer/core/PcfTopologyGraph.js';
import { PcfTopologyGraph_2 } from '../js/smart_fixer/core/PcfTopologyGraph_2.js';

// Load the PCF
const fixturePath = path.join(process.cwd(), 'public', 'Station G_SYS-001.pcf');
if (!fs.existsSync(fixturePath)) {
    console.error(`Benchmark file not found at ${fixturePath}`);
    process.exit(1);
}

const rawData = fs.readFileSync(fixturePath, 'utf8');
const components = parsePCFText(rawData);

console.log("=== RUNNING ORIGINAL GRAPH ===");
const graph1 = new PcfTopologyGraph(components);
const g1_p1 = graph1.runSequentialPass();
const g1_p1_logs = graph1.executionLog.filter(l => l.includes('Pass 1: Found'));
const g1_p1_fixes = graph1.visualGaps.map(g => `${g.type} (${g.dist.toFixed(2)}mm)`);

graph1.applyApprovedMutations();
const g1_p2 = graph1.runFuzzyTopologicalPass();
const g1_p2_logs = graph1.executionLog.filter(l => l.includes('Pass 2: Found global fuzzy gap'));
const g1_p2_fixes = g1_p2.visualGaps.map(g => `${g.type} (${g.dist.toFixed(2)}mm)`);

console.log("\n=== RUNNING V2 GRAPH ===");
const graph2 = new PcfTopologyGraph_2(components);
const g2_p1 = graph2.runSequentialPass();
const g2_p1_logs = graph2.executionLog.filter(l => l.includes('Pass 1: Found sequential gap'));
const g2_p1_fixes = graph2.visualGaps.map(g => `${g.type} (${g.dist.toFixed(2)}mm)`);

graph2.applyApprovedMutations();
const g2_p2 = graph2.runFuzzyTopologicalPass2();
const g2_p2_logs = graph2.executionLog.filter(l => l.includes('Pass 2: Found Major Axis gap'));
const g2_p2_fixes = g2_p2.visualGaps.map(g => `${g.type} (${g.dist.toFixed(2)}mm)`);

graph2.applyApprovedMutations();
const g2_p3 = graph2.runFuzzyTopologicalPass3();
const g2_p3_logs = graph2.executionLog.filter(l => l.includes('Pass 3: Found Any Axis gap'));
const g2_p3_fixes = g2_p3.visualGaps.map(g => `${g.type} (${g.dist.toFixed(2)}mm)`);


console.log("\n\n=== TABULATED ANALYSIS ===");
console.log("| | PcfTopologyGraph | PcfTopologyGraph_2 |");
console.log("|---|---|---|");

console.log("| **(a) Phase 1 Findings** | " +
    (g1_p1_logs.length ? g1_p1_logs.join('<br>') : 'None') + " | " +
    (g2_p1_logs.length ? g2_p1_logs.join('<br>') : 'None') + " |");

console.log("| **(a.fix) Fixing Recommendations** | " +
    (g1_p1_fixes.length ? g1_p1_fixes.join('<br>') : 'None') + " | " +
    (g2_p1_fixes.length ? g2_p1_fixes.join('<br>') : 'None') + " |");

console.log("| **(b) Phase 2 Findings** | " +
    (g1_p2_logs.length ? g1_p2_logs.join('<br>') : 'None') + " | " +
    (g2_p2_logs.length ? g2_p2_logs.join('<br>') : 'None') + " |");

console.log("| **(b.fix) Phase 2 Fixes** | " +
    (g1_p2_fixes.length ? g1_p2_fixes.join('<br>') : 'None') + " | " +
    (g2_p2_fixes.length ? g2_p2_fixes.join('<br>') : 'None') + " |");

console.log("| **(c) Phase 3 Findings** | N/A | " +
    (g2_p3_logs.length ? g2_p3_logs.join('<br>') : 'None') + " |");

console.log("| **(c.fix) Phase 3 Fixes** | N/A | " +
    (g2_p3_fixes.length ? g2_p3_fixes.join('<br>') : 'None') + " |");
