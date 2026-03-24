export const analyzePipingSystem = (rawLegs, OD = 273, alpha = 0.012, C = 20) => {
    let logs = [];
    let legs = [...rawLegs]; // clone
    
    // Helper to log
    const log = (msg) => logs.push(msg);
    
    // Step 1: Remove Negligible Legs (< 3 * OD)
    const threshold = 3 * OD;
    log(`Step 1: Removing negligible legs (length < ${threshold.toFixed(2)})`);
    let activeLegs = [];
    for (let i = 0; i < legs.length; i++) {
        let leg = legs[i];
        if (leg.length < threshold) {
            log(`- Removing leg ${i} (L=${leg.length.toFixed(1)}, Axis=${leg.axis}) -> length < ${threshold}`);
            // In a full implementation, expansion is transferred to the nearest significant leg
            // For now, we simply remove it from the active list
        } else {
            activeLegs.push({ ...leg });
        }
    }
    legs = activeLegs;

    // Step 2: Merge Same Direction Legs
    log("Step 2: Merging legs on same axis going same direction");
    let mergedLegs = [];
    if (legs.length > 0) {
        let currentMerged = { ...legs[0] };
        for (let i = 1; i < legs.length; i++) {
            let nextLeg = legs[i];
            if (currentMerged.axis === nextLeg.axis && currentMerged.sign === nextLeg.sign) {
                log(`- Merging leg ${i} into previous (${currentMerged.axis})`);
                currentMerged.length += nextLeg.length;
            } else {
                mergedLegs.push(currentMerged);
                currentMerged = { ...nextLeg };
            }
        }
        mergedLegs.push(currentMerged);
    }
    legs = mergedLegs;

    // Step 3: Split at Anchors
    log("Step 3: Checking for anchors");
    // Simplified assumption: if a leg is marked with isAnchor = true at its end, we split.
    // For this demonstration, we assume a single sub-system is passed in, bounded by anchors.

    // Step 4: Virtual Anchors (Guide + Line Stop)
    log("Step 4: Evaluating virtual anchors from guides");
    // Simplified logic: If a leg has a guide, we check the next leg. If the next leg runs parallel to the arrested axis, we split.
    let finalLegs = [];
    let splitOccurred = false;
    for (let i = 0; i < legs.length; i++) {
        let leg = legs[i];
        if (leg.hasGuide) {
            let nextLeg = legs[i+1];
            if (nextLeg && nextLeg.axis === leg.guideArrestedAxis) {
                log(`- Virtual anchor triggered at leg ${i} due to guide arresting ${leg.guideArrestedAxis}. Splitting system.`);
                splitOccurred = true;
                // In a full implementation, we recurse on the split sub-systems.
                // For now, we terminate the analysis here for simplicity and focus on the downstream sub-system.
                finalLegs = legs.slice(i+1);
                break;
            } else {
                log(`- Guide at leg ${i} noted but inactive for this flexibility plane.`);
            }
        }
    }
    if (!splitOccurred) {
        finalLegs = legs;
    }

    // Step 5: Cancel Opposing Legs
    log("Step 5: Cancelling opposing legs (net expansion < 1mm)");
    let netLength = { X: 0, Y: 0, Z: 0 };
    finalLegs.forEach(leg => {
        netLength[leg.axis] += (leg.sign === '+' ? leg.length : -leg.length);
    });

    let activeAxes = [];
    ['X', 'Y', 'Z'].forEach(axis => {
        let netExp = alpha * Math.abs(netLength[axis]);
        if (netExp < 1.0) {
            log(`- Cancelling axis ${axis} (Net expansion = ${netExp.toFixed(2)}mm < 1mm)`);
        } else {
            activeAxes.push(axis);
        }
    });

    // Determine L-Bend
    let isLBend = false;
    let Lgen = 0;
    let Labs = 0;
    let delta = 0;
    let Lreq = 0;
    let isSafe = false;

    // A system is an L-Bend if exactly two legs remain on different active axes
    // (Or if the entire system reduces to two dominant active axes)
    if (activeAxes.length === 2 && finalLegs.length >= 2) {
        isLBend = true;
        log(`L-Bend confirmed in plane ${activeAxes[0]}${activeAxes[1]}`);
        
        // Find the longest leg (Generator) and the other leg (Absorber)
        // This is a simplification; realistically, you evaluate both ways
        // Let's assume finalLegs has exactly two legs for this simple L-bend mock
        if (finalLegs.length === 2) {
            let leg1 = finalLegs[0];
            let leg2 = finalLegs[1];

            if (leg1.length > leg2.length) {
                Lgen = leg1.length;
                Labs = leg2.length;
            } else {
                Lgen = leg2.length;
                Labs = leg1.length;
            }
        } else {
            // If more than 2 legs, take the net absolute lengths on the active axes
            Lgen = Math.max(Math.abs(netLength[activeAxes[0]]), Math.abs(netLength[activeAxes[1]]));
            Labs = Math.min(Math.abs(netLength[activeAxes[0]]), Math.abs(netLength[activeAxes[1]]));
        }

        delta = alpha * Lgen;
        Lreq = C * Math.sqrt(OD * delta);
        isSafe = Labs >= Lreq;
    } else {
        log(`System does not resolve to an L-Bend (Active axes: ${activeAxes.length}, Legs: ${finalLegs.length})`);
    }

    return {
        logs,
        processedGeometry: finalLegs,
        calculations: {
            lBendDetected: isLBend,
            Lgen,
            Labs,
            OD,
            delta,
            C,
            Lreq,
            isSafe
        }
    };
};
