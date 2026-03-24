import fs from 'fs';
import { read, utils } from 'xlsx';
import path from 'path';

function splitPipingClass(filePath, outDir) {
    console.log(`Splitting ${filePath}...`);
    try {
        const fileData = fs.readFileSync(filePath);
        const workbook = read(fileData, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const rawData = utils.sheet_to_json(worksheet, { header: 1 });

        let maxLen = rawData[0].length;
        const headers = [];
        for (let i = 0; i < maxLen; i++) {
            const h = rawData[0][i];
            headers.push(h ? h.toString().trim() : `ColumnX${i + 1}`);
        }

        // Find Size index
        const sizeIndex = headers.findIndex(h => h.toLowerCase() === 'size');
        if (sizeIndex === -1) {
            console.error('Could not find Size column');
            return;
        }

        const sizeMap = {};

        const dataRows = rawData.slice(1);
        dataRows.forEach(row => {
            const obj = {};
            let hasData = false;
            headers.forEach((h, i) => {
                const val = row[i];
                if (val !== undefined && val !== null && val !== '') hasData = true;
                obj[h] = val;
            });

            if (hasData) {
                let sizeStr = String(row[sizeIndex]).trim();
                // Handle sizes like 1/2", 3/4", etc. Need safe filenames.
                // Replace slashes with underscores or dashes.
                const safeSizeStr = sizeStr.replace(/[^a-zA-Z0-9]/g, '_');
                if (!sizeMap[safeSizeStr]) {
                    sizeMap[safeSizeStr] = [];
                }
                sizeMap[safeSizeStr].push(obj);
            }
        });

        Object.keys(sizeMap).forEach(sizeKey => {
            const data = sizeMap[sizeKey];
            const outPath = path.join(outDir, `${sizeKey}.json`);
            fs.writeFileSync(outPath, JSON.stringify(data, null, 0));
        });

        console.log(`Split into ${Object.keys(sizeMap).length} files.`);
    } catch(e) {
        console.error(`Failed to split ${filePath}: ${e.message}`);
    }
}

splitPipingClass('public/Docs/Masters/Piping class master.xlsx', 'public/Docs/Masters/piping_class/size_wise/');
