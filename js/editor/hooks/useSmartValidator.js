import { useMemo } from 'react';
import * as THREE from 'three';
import { useEditorStore } from '../store.js';

export function useSmartValidator() {
    const components = useEditorStore(state => state.components);
    const setIssues = useEditorStore(state => state.setIssues);

    const validate = (tolerance = 1.0) => {
        const issues = [];
        console.log(`[SmartValidator] Running validation on ${components.length} components. Tolerance: ${tolerance}`);

        // 1. Connectivity Check (Broken Connections)
        // We assume components are somewhat ordered or we check nearest neighbors.
        // For simplicity in this iteration, we check strict sequence if available, or nearest neighbor.

        // Build spatial index for faster lookups (optimisation)
        // Or just brute force O(N^2) for < 1000 items is fine in JS.

        for (let i = 0; i < components.length; i++) {
            const c1 = components[i];
            const p2 = getEndPoint(c1, 2); // EP2

            if (!p2) continue;

            let hasConnection = false;
            let nearestDist = Infinity;
            let nearestIdx = -1;

            // Check against all other components start points
            for (let j = 0; j < components.length; j++) {
                if (i === j) continue;
                const c2 = components[j];
                const p1 = getEndPoint(c2, 1); // EP1

                if (p1) {
                    const dist = p2.distanceTo(p1);
                    if (dist < tolerance) {
                        hasConnection = true;
                        break;
                    }
                    if (dist < nearestDist) {
                        nearestDist = dist;
                        nearestIdx = j;
                    }
                }
            }

            // Report Broken Connection (Gap <= 2 * Bore)
            // Bore logic: approximate from userData or default
            const bore = parseFloat(c1.userData?.Bore || 0) || 100; // Default 100mm if missing
            const brokenLimit = bore * 2;

            if (!hasConnection) {
                if (nearestDist <= brokenLimit) {
                    issues.push({
                        id: `broken-${c1.id}`,
                        type: 'ERROR',
                        message: `Broken Connection: Gap ${nearestDist.toFixed(1)}mm (Expected < ${tolerance}mm)`,
                        sourceId: c1.id,
                        targetId: components[nearestIdx]?.id,
                        position: p2.clone(),
                        fixType: 'SNAP'
                    });
                } else if (nearestDist < 15000) {
                     // Model Error (Open End)
                     issues.push({
                        id: `open-${c1.id}`,
                        type: 'WARNING',
                        message: `Open End: Nearest component is ${nearestDist.toFixed(1)}mm away.`,
                        sourceId: c1.id,
                        targetId: components[nearestIdx]?.id,
                        position: p2.clone(),
                        fixType: 'CONNECT' // Suggest connection pipe
                    });
                }
            }
        }

        // 2. Overlap Detection (Simple Bounding Box / Distance)
        // Check if PIPE centers are too close to other components
        for (let i = 0; i < components.length; i++) {
             const c1 = components[i];
             // Skip non-physical items if any
             if (c1.userData?.type === 'MESSAGE') continue;

             const box1 = getBoundingBox(c1);

             for (let j = i + 1; j < components.length; j++) {
                 const c2 = components[j];
                 if (c2.userData?.type === 'MESSAGE') continue;

                 const box2 = getBoundingBox(c2);
                 if (box1.intersectsBox(box2)) {
                      // Refine check: are they connected? If connected, overlap is expected at joint.
                      // If not connected, it's a clash.
                      // Simple check: distance between centers < sum of radii?
                      issues.push({
                          id: `clash-${c1.id}-${c2.id}`,
                          type: 'ERROR',
                          message: `Clash Detected: ${c1.userData?.componentName} intersects ${c2.userData?.componentName}`,
                          sourceId: c1.id,
                          targetId: c2.id,
                          position: getCenter(c1),
                          fixType: 'DELETE'
                      });
                 }
             }
        }

        setIssues(issues);
        return issues;
    };

    return { validate };
}

// Helpers
function getEndPoint(c, pointIdx) {
    // Coordinate data is stored in userData.attributes usually, or specific fields.
    // Based on 'defaults.js', EP1/EP2 are usually mapped.
    // The geometry in the viewer uses transformed coordinates.
    // We should rely on 'c.points' if the viewer has populated it, or parse userData.
    // The 'EditorStore' components usually have a standardized structure:
    // c.points = { EP1: Vector3, EP2: Vector3, ... }

    if (c.points) {
        if (pointIdx === 1) return c.points.EP1 || c.points.Start;
        if (pointIdx === 2) return c.points.EP2 || c.points.End;
    }

    // Fallback to userData coordinates if available (raw)
    // Note: These are strings usually.
    return null;
}

function getBoundingBox(c) {
    // Create a Box3 based on points
    const box = new THREE.Box3();
    if (c.points) {
        Object.values(c.points).forEach(p => {
             if (p instanceof THREE.Vector3) box.expandByPoint(p);
        });
        // Add some padding for pipe thickness (approx)
        box.expandByScalar(50); // 50mm padding
    }
    return box;
}

function getCenter(c) {
     const box = getBoundingBox(c);
     const center = new THREE.Vector3();
     box.getCenter(center);
     return center;
}
