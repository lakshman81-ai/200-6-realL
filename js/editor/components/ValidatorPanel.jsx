import React, { useState, useEffect } from 'react';
import { useEditorStore } from '../store.js';
import { SmartValidator } from '../smart/SmartValidator.js';
import { SmartFixer } from '../smart/SmartFixer.js';
import { setState, getState } from '../../state.js';

export const ValidatorPanel = () => {
    const components = useEditorStore(state => state.components);
    const select = useEditorStore(state => state.select);

    const [issues, setIssues] = useState([]);
    const [isMinimized, setIsMinimized] = useState(false);
    const [tolerance, setTolerance] = useState(6.0);

    const handleRun = () => {
        const validator = new SmartValidator(tolerance);
        const results = validator.validate(components);

        console.log('[ValidatorPanel] Validation results:', results.length, 'issues found');

        // Build a map of component IDs to fixingAction descriptions
        const fixingActionMap = new Map();

        results.forEach(issue => {
            // Generate action description based on issue type
            let actionDesc = '';
            if (issue.type === 'GAP') {
                actionDesc = `SNAP: Connect broken connection (${issue.dist?.toFixed(1)}mm gap)\n  Move endpoints to midpoint`;
            } else if (issue.type === 'MODEL_ERROR') {
                actionDesc = `INSERT PIPE: Fill ${issue.dist?.toFixed(1)}mm gap\n  Review and verify insertion`;
            } else if (issue.type === 'OVERLAP') {
                actionDesc = `TRIM: Remove overlap\n  Adjust endpoint positions`;
            }

            // Map affected component IDs to actions
            if (issue.c1) {
                const id = issue.c1.id || issue.c1.uuid;
                if (id) fixingActionMap.set(String(id), actionDesc);
            }
            if (issue.c2) {
                const id = issue.c2.id || issue.c2.uuid;
                if (id && id !== (issue.c1?.id || issue.c1?.uuid)) {
                    fixingActionMap.set(String(id), actionDesc);
                }
            }
        });

        console.log('[ValidatorPanel] Fixing actions map:', fixingActionMap.size, 'components affected');

        // Update viewer3dComponents state so the Data Table shows fixingAction
        const viewer3dComps = getState('viewer3dComponents') || [];
        console.log('[ValidatorPanel] viewer3dComponents count:', viewer3dComps.length);

        // ── DEBUG: compare IDs on both sides ──────────────────────────────────
        const sampleV3dIds = viewer3dComps.slice(0, 5).map(c => String(c.id || c.uuid || '?'));
        const sampleMapKeys = [...fixingActionMap.keys()].slice(0, 5);
        console.log('[ValidatorPanel] viewer3dComp IDs (first 5):', sampleV3dIds);
        console.log('[ValidatorPanel] fixingActionMap keys (first 5):', sampleMapKeys);

        const updatedComps = viewer3dComps.map(comp => {
            const compId = String(comp.id || comp.uuid);
            const action = fixingActionMap.get(compId);

            if (action) {
                console.log('[ValidatorPanel] Assigning action to component:', compId, action.substring(0, 30) + '...');
                return { ...comp, fixingAction: action };
            }
            return { ...comp, fixingAction: '' };
        });

        setState('viewer3dComponents', updatedComps);
        console.log('[ValidatorPanel] Updated viewer3dComponents state');

        setIssues(results);
    };

    const handleApprove = () => {
        // NOTE: We're NOT applying actual fixes anymore - just keeping fixingAction descriptions
        // The user will manually review and apply fixes via the "🔄 Refresh PCF" button in the Data Table

        // Simply clear the issues list - fixingAction remains populated
        setIssues([]);

        // Force table refresh by dispatching a custom event
        console.log('[ValidatorPanel] Fixing actions populated. Triggering table refresh...');
        window.dispatchEvent(new CustomEvent('pcf-validator-updated'));
    };

    const toggleApproval = (id) => {
        setIssues(issues.map(iss =>
            iss.id === id ? { ...iss, approved: !iss.approved } : iss
        ));
    };

    const handleRowClick = (issue) => {
        select(issue.c1.id, 'STICK');
    };

    if (isMinimized) {
        return (
            <div style={minimizedStyle} onClick={() => setIsMinimized(false)}>
                🛡️ Smart Validator ({issues.length})
            </div>
        );
    }

    return (
        <div style={panelStyle}>
            <div style={headerStyle}>
                <span style={{ fontWeight: 'bold', color: '#ffcc00' }}>
                    🛡️ Smart Validator & Fixer ({issues.length})
                </span>
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                    <label style={{ color: '#aaa', fontSize: 10 }}>Tol (mm):</label>
                    <input
                        type="number"
                        value={tolerance}
                        onChange={(e) => setTolerance(Number(e.target.value))}
                        style={inputStyle}
                    />
                    <button onClick={handleRun} style={btnStyle('#28a745')}>RUN CHECK</button>
                    <button onClick={() => setIsMinimized(true)} style={btnStyle('#444')}>_</button>
                </div>
            </div>

            <div style={{ flex: 1, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, background: '#222' }}>
                        <tr>
                            <th style={thStyle}>Fix</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Components</th>
                            <th style={thStyle}>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {issues.map(issue => (
                            <tr
                                key={issue.id}
                                style={trStyle}
                                onClick={() => handleRowClick(issue)}
                            >
                                <td style={tdStyle} onClick={(e) => e.stopPropagation()}>
                                    <input
                                        type="checkbox"
                                        checked={issue.approved}
                                        onChange={() => toggleApproval(issue.id)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                </td>
                                <td style={{ ...tdStyle, color: getColorForType(issue.type) }}>
                                    {issue.type}
                                    <div style={{ fontSize: 9, color: '#888' }}>{issue.description}</div>
                                </td>
                                <td style={tdStyle}>
                                    <div>{issue.c1.userData?.refNo || issue.c1.id}</div>
                                    <div style={{ color: '#888' }}>{issue.c2.userData?.refNo || issue.c2.id}</div>
                                </td>
                                <td style={{ ...tdStyle, color: '#00e5ff', fontWeight: 'bold' }}>
                                    {issue.action}
                                </td>
                            </tr>
                        ))}
                        {issues.length === 0 && (
                            <tr>
                                <td colSpan="4" style={{ padding: 20, textAlign: 'center', color: '#666' }}>
                                    No issues found or validation not run. Click RUN CHECK.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {issues.length > 0 && (
                <div style={footerStyle}>
                    <button onClick={handleApprove} style={{ ...btnStyle('#007bff'), width: '100%', padding: '8px' }}>
                        ✓ POPULATE FIXING ACTIONS
                    </button>
                </div>
            )}
        </div>
    );
};

const minimizedStyle = {
    position: 'absolute', bottom: 10, left: 10,
    background: '#222', color: '#ffcc00', padding: '8px 12px',
    border: '1px solid #444', borderRadius: 4, cursor: 'pointer',
    fontFamily: 'monospace', fontSize: 12, boxShadow: '0 0 10px rgba(0,0,0,0.5)', zIndex: 1000
};

const panelStyle = {
    position: 'absolute', bottom: 10, left: 10, width: 450, height: 350,
    background: 'rgba(30, 30, 40, 0.95)', border: '1px solid #444', borderRadius: 4,
    color: '#eee', display: 'flex', flexDirection: 'column',
    fontFamily: 'monospace', fontSize: 11, boxShadow: '0 0 15px rgba(0,0,0,0.8)', zIndex: 1000
};

const headerStyle = {
    padding: '8px', background: '#222', borderBottom: '1px solid #444',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    borderTopLeftRadius: 4, borderTopRightRadius: 4
};

const footerStyle = {
    padding: '8px', background: '#222', borderTop: '1px solid #444',
    borderBottomLeftRadius: 4, borderBottomRightRadius: 4
};

const inputStyle = {
    width: 40, background: '#111', color: '#fff', border: '1px solid #555',
    padding: '2px 4px', fontSize: 10, borderRadius: 2
};

const btnStyle = (bg) => ({
    background: bg, border: 'none', color: '#fff', fontWeight: 'bold',
    fontSize: 10, cursor: 'pointer', padding: '4px 8px', borderRadius: 2
});

const thStyle = { padding: '6px 8px', fontSize: 10, color: '#aaa', fontWeight: 'normal' };
const tdStyle = { padding: '6px 8px', verticalAlign: 'top', borderBottom: '1px solid #333' };

const trStyle = {
    cursor: 'pointer',
    transition: 'background 0.2s',
    ':hover': { background: '#333' }
};

const getColorForType = (type) => {
    switch (type) {
        case 'GAP': return '#ffbb33';
        case 'OVERLAP': return '#ff4444';
        case 'MODEL_ERROR': return '#00e5ff';
        default: return '#aaa';
    }
};
