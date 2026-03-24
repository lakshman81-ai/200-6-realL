/**
 * row-validator.js
 * Runs immediately after unit normalization, explicitly outputting ValidatedCSVdata.
 * Performs linear row-by-row distance calculation (Len_Calc) and flat-row modifications
 * (e.g. injecting missing pipes after supports) before data is grouped into components.
 */

export function validateRows(rows, config) {
    if (!rows || rows.length === 0) return { validated: [], anomalies: [] };

    const anomalies = [];
    const validated = [];

    // 1. Sort rows purely by Sequence before math (just in case)
    // Assumes Sequence is a numeric value now. Let's rely on original order if Sequence is missing.

    for (let i = 0; i < rows.length; i++) {
        const rCurrent = { ...rows[i] };
        const rNext = i < rows.length - 1 ? rows[i + 1] : null;

        let lenCalc = 0;

        // We assume East, North, Up are already numbers (stripped by input-tab using unit-transformer)
        const e1 = parseFloat(rCurrent.East) || 0;
        const n1 = parseFloat(rCurrent.North) || 0;
        const u1 = parseFloat(rCurrent.Up) || 0;

        let e2 = e1, n2 = n1, u2 = u1;

        const rawType = String(rCurrent.Type || "").trim().toUpperCase();
        const isSupport = rawType === "ANCI" || rawType === "SUPPORT"; // expand as needed

        if (isSupport && rNext) {
            // Supports MUST calculate physical Euclidean limits to the next literal row sequence 
            // regardless of what RefNo pipeline it belongs to computationally!
            e2 = parseFloat(rNext.East) || 0;
            n2 = parseFloat(rNext.North) || 0;
            u2 = parseFloat(rNext.Up) || 0;
        } else if (rNext && rNext.RefNo === rCurrent.RefNo) {
            // Try getting sequential distance to the next row natively (if it belongs to the same pipeline)
            e2 = parseFloat(rNext.East) || 0;
            n2 = parseFloat(rNext.North) || 0;
            u2 = parseFloat(rNext.Up) || 0;
        } else if (rCurrent.StartX !== undefined || rCurrent.EndX !== undefined) {
            // Self-Contained Cartesian coordinates (Single-Row Pipes like 1664 that dropped)
            const sx = parseFloat(rCurrent.StartX) || parseFloat(rCurrent.EndX) || 0;
            const sy = parseFloat(rCurrent.StartY) || parseFloat(rCurrent.EndY) || 0;
            const sz = parseFloat(rCurrent.StartZ) || parseFloat(rCurrent.EndZ) || 0;
            if (sx !== 0 || sy !== 0 || sz !== 0) {
                e2 = sx;
                n2 = sy;
                u2 = sz;
            }
        }

        // Len_Calc = sum (abs( East(Seqx)-East(Seqx+1) ... ))
        lenCalc = Math.abs(e1 - e2) + Math.abs(n1 - n2) + Math.abs(u1 - u2);

        // Attach to row for debug printing and downstream single-row endpoint mapping (Option B Topology Bridge)
        rCurrent.Len_Calc = lenCalc;
        rCurrent.EndX = e2;
        rCurrent.EndY = n2;
        rCurrent.EndZ = u2;

        // Push the current row
        validated.push(rCurrent);

        // --- PSI CORRECTION PASS ---
        // Executes strictly after spatial Euclidean calc, before Gap Fill logic.
        if (window.__PSI_CORRECTION_MODE) {
            const typeStr = String(rCurrent.Type || "").trim().toUpperCase();
            const rigidStr = String(rCurrent.Rigid || "").trim().toUpperCase();

            // 1. END Flanges -> PIPE
            if (rigidStr === 'END' && typeStr === 'FLANGE') {
                rCurrent.RefNo = (rCurrent.RefNo || rCurrent.Sequence) + '_pipe';
                rCurrent.Type = 'PIPE';
                console.log(`[PSI Correction] Mutated END Flange ${rCurrent.Sequence} to PIPE`);
            }
            // 2. Extensional OLETs -> PIPE
            else if (typeStr === 'OLET' && lenCalc > 0) {
                rCurrent.RefNo = (rCurrent.RefNo || rCurrent.Sequence) + '_pipe';
                rCurrent.Type = 'PIPE';
                console.log(`[PSI Correction] Mutated Dimensional OLET ${rCurrent.Sequence} to PIPE (Len: ${lenCalc}mm)`);
            }
        }

        // 2. Point-Component Pipe Injection
        // The user specifically named supports. Supports typically have type SUPPORT or ANCI.
        // Let's check if the PCF keyword translates to a point item (SUPPORT, ANCI, etc).
        // The user said: "check if any component (like support) has len_Calc>0, then add row just below that with Type=PIPE."

        if (isSupport && lenCalc >= Math.max(0.1, config.coordinateSettings?.continuityTolerance || 0.5)) {
            // Inject a synthetic pipe group containing a single row (Start Point only)
            const currentSeq = parseFloat(rCurrent.Sequence) || 0;
            const refNoInjected = (rCurrent.RefNo || rCurrent.Sequence) + "_Injected";

            const syntheticPipe1 = {
                ...rCurrent,
                Sequence: String(currentSeq + 0.1),
                Type: "PIPE",
                "Component Name": rCurrent["Component Name"] || rCurrent.componentName || "PIPE",
                RefNo: refNoInjected,
                Point: "1",
                East: e1,
                North: n1,
                Up: u1,
                EndX: e2,
                EndY: n2,
                EndZ: u2
            };

            validated.push(syntheticPipe1);
            anomalies.push({
                refNo: syntheticPipe1.RefNo,
                severity: "INFO",
                ruleId: "ROW-VAL-01",
                description: `Injected missing PIPE after component ${rCurrent.Sequence} (Type: ${rawType}) due to Len_Calc=${lenCalc.toFixed(2)}mm`
            });
        }
    }

    // 3. Flat-Row Segmentation (Replaces segmentizer.js)
    // If a PIPE row has Len_Calc > maxPipeRun, physically slice it into smaller rows.
    const maxSegmentLength = config.coordinateSettings?.common3DLogic?.maxPipeRun || 13100; // Typical fabrication limit
    const segmented = [];

    for (let i = 0; i < validated.length; i++) {
        const r = validated[i];

        // Only segment PIPEs
        if (r.Type !== "PIPE" || !r.Len_Calc || r.Len_Calc <= maxSegmentLength) {
            segmented.push(r);
            continue;
        }

        // This PIPE exceeds max length. We need its coordinate and the next coordinate.
        const e1 = parseFloat(r.East) || 0;
        const n1 = parseFloat(r.North) || 0;
        const u1 = parseFloat(r.Up) || 0;

        // The vector to the next row
        const rNext = validated[i + 1];
        if (!rNext) {
            segmented.push(r); // Cannot safely interpolate without a target
            continue;
        }

        const e2 = parseFloat(rNext.East) || 0;
        const n2 = parseFloat(rNext.North) || 0;
        const u2 = parseFloat(rNext.Up) || 0;

        const vecE = e2 - e1;
        const vecN = n2 - n1;
        const vecU = u2 - u1;
        const totalLen = Math.sqrt(vecE * vecE + vecN * vecN + vecU * vecU);

        if (totalLen <= maxSegmentLength) {
            segmented.push(r);
            continue;
        }

        const numSegments = Math.ceil(totalLen / maxSegmentLength);
        const segLen = totalLen / numSegments;
        const dirE = vecE / totalLen;
        const dirN = vecN / totalLen;
        const dirU = vecU / totalLen;

        anomalies.push({
            refNo: r.RefNo || r.Sequence,
            severity: "INFO",
            ruleId: "ROW-SEG-01",
            description: `Segmented long PIPE (${totalLen.toFixed(0)}mm) into ${numSegments} rows of ~${segLen.toFixed(0)}mm`
        });

        let prevE = e1, prevN = n1, prevU = u1;
        for (let s = 0; s < numSegments; s++) {
            const isLast = s === numSegments - 1;
            const nextE = isLast ? e2 : prevE + (dirE * segLen);
            const nextN = isLast ? n2 : prevN + (dirN * segLen);
            const nextU = isLast ? u2 : prevU + (dirU * segLen);

            const segmentRow = { ...r };
            segmentRow.Sequence = `${r.Sequence}_Seg${s + 1}`;
            if (segmentRow.RefNo) segmentRow.RefNo = `${r.RefNo}_Seg${s + 1}`;

            segmentRow.East = prevE;
            segmentRow.North = prevN;
            segmentRow.Up = prevU;

            // The Len_Calc of this new segment is the distance to its respective next point
            segmentRow.Len_Calc = Math.max(0, Math.abs(prevE - nextE) + Math.abs(prevN - nextN) + Math.abs(prevU - nextU));

            segmented.push(segmentRow);

            prevE = nextE;
            prevN = nextN;
            prevU = nextU;
        }
    }

    // 4. Flat-Row Overlap & Duplicate Removal (Replaces pipeline overlap resolver)
    const finalValidated = [];

    for (let s = 0; s < segmented.length; s++) {
        const curr = segmented[s];
        const prev = finalValidated.length > 0 ? finalValidated[finalValidated.length - 1] : null;
        const next = s < segmented.length - 1 ? segmented[s + 1] : null;

        if (curr.Type === "PIPE") {
            // Check 4a: Exact identical duplicate PIPE (same coords, same length)
            if (prev && prev.Type === "PIPE") {
                const dx = Math.abs((curr.East || 0) - (prev.East || 0));
                const dy = Math.abs((curr.North || 0) - (prev.North || 0));
                const dz = Math.abs((curr.Up || 0) - (prev.Up || 0));
                if (dx < 0.1 && dy < 0.1 && dz < 0.1) {
                    anomalies.push({
                        refNo: curr.RefNo || curr.Sequence,
                        severity: "WARNING",
                        ruleId: "ROW-OVR-01",
                        description: `Dropped duplicate PIPE co-located with previous component at ${curr.East}, ${curr.North}, ${curr.Up}`
                    });
                    continue; // Drop it
                }
            }

            // Check 4b: Foldback PIPE (A -> B, then B -> A)
            if (prev && next) {
                // Vector of previous (A -> B)
                const vPrev = {
                    E: (curr.East || 0) - (prev.East || 0),
                    N: (curr.North || 0) - (prev.North || 0),
                    U: (curr.Up || 0) - (prev.Up || 0)
                };
                // Vector of current (B -> C)
                const vCurr = {
                    E: (next.East || 0) - (curr.East || 0),
                    N: (next.North || 0) - (curr.North || 0),
                    U: (next.Up || 0) - (curr.Up || 0)
                };

                const lenPrev = Math.sqrt(vPrev.E * vPrev.E + vPrev.N * vPrev.N + vPrev.U * vPrev.U);
                const lenCurr = Math.sqrt(vCurr.E * vCurr.E + vCurr.N * vCurr.N + vCurr.U * vCurr.U);

                if (lenPrev > 0.1 && lenCurr > 0.1) {
                    // Dot product over lengths (cosine of angle)
                    const dot = (vPrev.E * vCurr.E + vPrev.N * vCurr.N + vPrev.U * vCurr.U) / (lenPrev * lenCurr);
                    if (dot < -0.99) { // 180 degree foldback
                        anomalies.push({
                            refNo: curr.RefNo || curr.Sequence,
                            severity: "WARNING",
                            ruleId: "ROW-OVR-02",
                            description: `Dropped foldback PIPE. Reverses direction into previous component.`
                        });
                        continue; // Drop it
                    }
                }
            }
        }

        finalValidated.push(curr);
    }

    // 5. Final Pass: Recalculate Len_Calc exactly based on the finalized array order
    for (let i = 0; i < finalValidated.length; i++) {
        const rCurrent = finalValidated[i];
        const rNext = i < finalValidated.length - 1 ? finalValidated[i + 1] : null;

        let lenCalc = 0;
        const e1 = parseFloat(rCurrent.East) || 0;
        const n1 = parseFloat(rCurrent.North) || 0;
        const u1 = parseFloat(rCurrent.Up) || 0;

        let e2 = e1, n2 = n1, u2 = u1;

        const rawType = String(rCurrent.Type || "").trim().toUpperCase();
        const isSupport = rawType === "ANCI" || rawType === "SUPPORT";

        if (isSupport && rNext) {
            e2 = parseFloat(rNext.East) || 0;
            n2 = parseFloat(rNext.North) || 0;
            u2 = parseFloat(rNext.Up) || 0;
        } else if (rNext && rNext.RefNo === rCurrent.RefNo) {
            e2 = parseFloat(rNext.East) || 0;
            n2 = parseFloat(rNext.North) || 0;
            u2 = parseFloat(rNext.Up) || 0;
        } else if (rCurrent.StartX !== undefined || rCurrent.EndX !== undefined) {
            const sx = parseFloat(rCurrent.StartX) || parseFloat(rCurrent.EndX) || 0;
            const sy = parseFloat(rCurrent.StartY) || parseFloat(rCurrent.EndY) || 0;
            const sz = parseFloat(rCurrent.StartZ) || parseFloat(rCurrent.EndZ) || 0;
            if (sx !== 0 || sy !== 0 || sz !== 0) {
                e2 = sx;
                n2 = sy;
                u2 = sz;
            }
        }

        lenCalc = Math.abs(e1 - e2) + Math.abs(n1 - n2) + Math.abs(u1 - u2);

        // Stamp the explicitly resolved next-coordinate onto the row as EndX/Y/Z.
        // This perfectly guarantees that single-row groups (injected pipes, trims)
        // will mathematically resolve `GroupLenCalc = abs(End - Start)` correctly in pipeline geometry!
        rCurrent.EndX = e2;
        rCurrent.EndY = n2;
        rCurrent.EndZ = u2;
        rCurrent.Len_Calc = lenCalc;
    }

    return { validated: finalValidated, anomalies };
}
