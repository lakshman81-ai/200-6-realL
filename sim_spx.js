import { validateRows } from './js/input/row-validator.js';
import { groupByRefNo } from './js/converter/grouper.js';

global.window = {};

const mockRows = [
    { Sequence: "1", RefNo: "=67130482/1664", pcfType: "PIPE", Type: "PIPE", Point: "1", East: 0, North: 0, Up: 0, "Line Number": "L-123" },
    { Sequence: "2", RefNo: "TEE1", pcfType: "TEE", Type: "TEE", Point: "1", East: 15000, North: 0, Up: 0, "Line Number": "L-123" },
    { Sequence: "17", RefNo: "=67130482/1664", pcfType: "PIPE", Type: "PIPE", Point: "1", East: 15000, North: 0, Up: 0, "Line Number": "L-123" },
    { Sequence: "18", RefNo: "FLAN1", pcfType: "FLANGE", Type: "FLANGE", Point: "1", East: 28000, North: 0, Up: 0, "Line Number": "L-123" }
];

console.log("=== STEP 1: BEFORE VALIDATION ===");
mockRows.forEach(r => console.log(`Seq: ${r.Sequence}, RefNo: ${r.RefNo}, Type: ${r.Type}, Pos: (${r.East}, ${r.North}, ${r.Up})`));

const config = { coordinateSettings: { common3DLogic: { maxPipeRun: 13000 } } };
const result = validateRows(mockRows, config);

console.log("\n=== STEP 2: AFTER validateRows ===");
result.validated.forEach(r => console.log(`Seq: ${r.Sequence}, RefNo: ${r.RefNo}, Type: ${r.Type}, Len: ${r.Len_Calc}`));

const groupConfig = {
    enableSplit: true,
    componentTypeMap: { 'PIPE': 'PIPE', 'TEE': 'TEE', 'FLANGE': 'FLANGE' },
    coordinateSettings: { maxSegmentLength: 13000, common3DLogic: { maxPipeRun: 13000, enableMaxPipeRun: true } }
};

const groupsMap = groupByRefNo(result.validated, groupConfig);
const groups = Array.from(groupsMap.values());

console.log("\n=== STEP 3: AFTER groupByRefNo (Stage 1 Table) ===");
groups.forEach(g => {
    console.log(`Group RefNo=${g.meta?.refNo || g.RefNo || '?'}`);
    (g.rows || g.items || []).forEach(r => console.log(`  -> Row Seq: ${r.Sequence}, RefNo: ${r.RefNo}, Type: ${r.Type}`));
});
