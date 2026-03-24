import { useEditorStore } from '../store.js';
import * as THREE from 'three';

export function useSmartFixer() {
    const updateComponent = useEditorStore(state => state.updateComponent);
    const components = useEditorStore(state => state.components);

    const fixIssue = (issue) => {
        console.log(`[SmartFixer] Fixing issue: ${issue.id} (${issue.fixType})`);

        if (issue.fixType === 'SNAP') {
            _fixSnap(issue.sourceId, issue.targetId);
        } else if (issue.fixType === 'CONNECT') {
            // TODO: Implement insert pipe logic
            console.warn("Connect logic not implemented yet");
        } else if (issue.fixType === 'DELETE') {
             // delete logic handled by store directly usually
        }
    };

    const _fixSnap = (sourceId, targetId) => {
        const source = components.find(c => c.id === sourceId);
        const target = components.find(c => c.id === targetId);

        if (!source || !target) return;

        // Logic: Move Source EP2 to Target EP1 (or nearest point)
        // We need to update the Source component's coordinates.
        // This is complex because we need to update the geometry AND the underlying data.

        // For visual snap:
        const targetPoint = target.points?.EP1 || target.points?.Start;

        if (targetPoint) {
            // Update Source EP2
            // Note: In a real implementation, we need to recalculate the whole geometry
            // and update the specific attributes (EndX, EndY, EndZ).

            // 1. Update Internal Points
            const newPoints = { ...source.points, EP2: targetPoint.clone() };

            // 2. Update UserData (for persistence)
            const newUserData = { ...source.userData };
            newUserData['End X'] = targetPoint.x.toFixed(4);
            newUserData['End Y'] = targetPoint.y.toFixed(4);
            newUserData['End Z'] = targetPoint.z.toFixed(4);
            // Also standard attributes
            newUserData['COMPONENT-ATTRIBUTE10'] = targetPoint.x.toFixed(4); // Example mapping

            updateComponent(sourceId, {
                points: newPoints,
                userData: newUserData
            });

            console.log(`[SmartFixer] Snapped ${source.userData.componentName} to ${target.userData.componentName}`);
        }
    };

    return { fixIssue };
}
