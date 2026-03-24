import { dataManager } from './data-manager.js';

/**
 * Material Service
 * Encapsulates logic for Piping Class Extraction, Material Mapping (Smart Match),
 * and Attribute Resolution (CA3, CA4, CA7).
 */
export class MaterialService {

    /**
     * Extracts Piping Class from the "PIPE" string.
     * Rule: 4th token (index 3) when split by '-'.
     * Example: FCSEE-16"-P0511260-11440A1-01 -> 11440A1
     * @param {string} pipeStr
     * @returns {string|null}
     */
    extractPipingClass(pipeStr) {
        if (!pipeStr) return null;
        const parts = pipeStr.split('-');
        if (parts.length > 3) {
            // Index 0: FCSEE
            // Index 1: 16"
            // Index 2: P0511260 (Line No)
            // Index 3: 11440A1 (Class)
            return parts[3];
        }
        return null;
    }

    /**
     * Parses the PCF Material Map text file.
     * Format: Code Description (space/tab separated)
     * e.g. "106 106"
     * @param {string} text 
     * @returns {Array} [{code: "106", desc: "106"}]
     */
    parseMaterialMap(text) {
        const lines = text.split('\n');
        return lines.map(line => {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 2) return null;
            return {
                code: parts[0],
                desc: parts.slice(1).join(' ')
            };
        }).filter(x => x);
    }

    /**
     * Smart Match: Piping Class -> Material Name -> Material Code
     * @param {string} pipingClass Extracted class e.g. "11440A1"
     * @returns {Object} { materialCode, wallThickness, corrosion }
     */
    resolveAttributes(pipingClass) {
        const result = {
            materialCode: null, // CA3
            wallThickness: null, // CA4
            corrosion: null     // CA7
        };

        if (!pipingClass) return result;

        const master = dataManager.getPipingClassMaster();
        const matMap = dataManager.getMaterialMap();

        if (!master || master.length === 0) return result;

        // 1. Find Entry in Piping Class Master
        const classCol = dataManager.headerMap.pipingclass.class || 'Piping Class';

        let match = master.find(row => row[classCol] === pipingClass);

        if (!match) {
            // Try fuzzy / startsWith
            match = master.find(row => pipingClass.startsWith(row[classCol]) || row[classCol]?.startsWith(pipingClass));
        }

        if (match) {
            // 2. Extract Details
            const wallCol = dataManager.headerMap.pipingclass.wall || 'Wall thickness';
            const corrCol = dataManager.headerMap.pipingclass.corrosion || 'Corrosion';
            const matNameCol = dataManager.headerMap.pipingclass.material || 'Material_Name';

            result.wallThickness = match[wallCol];
            result.corrosion = match[corrCol];

            const materialName = match[matNameCol]; // e.g. "ASTM A-106 B"

            // 3. Smart Match with Material Map
            if (materialName && matMap.length > 0) {
                // Normalize: remove spaces, dashes, case-insensitive
                const normMatName = materialName.replace(/[\s-]/g, '').toUpperCase();

                const bestMat = matMap.find(m => {
                    const normDesc = m.desc.replace(/[\s-]/g, '').toUpperCase();
                    return normMatName.includes(normDesc) || normDesc.includes(normMatName);
                });

                if (bestMat) {
                    result.materialCode = bestMat.code;
                }
            }
        }

        return result;
    }
}

export const materialService = new MaterialService();
