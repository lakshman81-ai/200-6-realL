import fs from 'fs';
import { read, utils } from 'xlsx';
import path from 'path';

function convertExcelToJson(filePath, outPath) {
    console.log(`Converting ${filePath}...`);
    try {
        const fileData = fs.readFileSync(filePath);
        const workbook = read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Use raw arrays first to do our smart header mapping we use in excel-parser.js
        const rawData = utils.sheet_to_json(worksheet, { header: 1 });

        // We just assume row 0 is header for these specific known master files to keep things simple
        let maxLen = rawData[0].length;
        const headers = [];
        for (let i = 0; i < maxLen; i++) {
            const h = rawData[0][i];
            headers.push(h ? h.toString().trim() : `ColumnX${i + 1}`);
        }

        const dataRows = rawData.slice(1);
        const jsonData = dataRows.map(row => {
            const obj = {};
            headers.forEach((h, i) => {
                obj[h] = row[i];
            });
            return obj;
        }).filter(obj => Object.values(obj).some(v => v !== undefined && v !== null && v !== '')); // Filter empty rows

        fs.writeFileSync(outPath, JSON.stringify(jsonData, null, 0));
        console.log(`Saved ${jsonData.length} rows to ${outPath}`);
    } catch(e) {
        console.error(`Failed to convert ${filePath}: ${e.message}`);
    }
}

function convertTxtToJson(filePath, outPath) {
    console.log(`Converting ${filePath}...`);
    try {
        const text = fs.readFileSync(filePath, 'utf8');
        const lines = text.split('\n');
        const map = [];
        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            // Replicate MaterialService parseMaterialMap logic exactly
            const parts = cleanLine.split(/\s+/);
            if (parts.length >= 2) {
                const code = parts[0];
                const desc = parts.slice(1).join(" ");
                if (code && desc) {
                    map.push({ code, desc });
                }
            }
        }
        fs.writeFileSync(outPath, JSON.stringify(map, null, 0));
        console.log(`Saved ${map.length} entries to ${outPath}`);
    } catch(e) {
        console.error(`Failed to convert ${filePath}: ${e.message}`);
    }
}

convertExcelToJson('public/Docs/Masters/wtValveweights.xlsx', 'public/Docs/Masters/wtValveweights.json');
convertExcelToJson('public/Docs/Masters/Piping class master.xlsx', 'public/Docs/Masters/Piping class master.json');
convertTxtToJson('public/Docs/Masters/PCF_MAT_MAP.TXT', 'public/Docs/Masters/PCF_MAT_MAP.json');
