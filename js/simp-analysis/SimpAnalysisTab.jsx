import React, { useState, useEffect } from 'react';
import SimpAnalysisCanvas from './SimpAnalysisCanvas.jsx';
import CalculationsPanel from './CalculationsPanel.jsx';
import { analyzePipingSystem } from './smart2Dconverter.js';

// Mock Data representing a PCF pipe run (Guide: VG100, Rest: CA100, Anchor: PIPE-FIXED)
const mockGeometry = [
    { vector: { x: 0, y: 1, z: 0 }, length: 200, axis: 'Y', sign: '+', isAnchor: false }, // Short drop
    { vector: { x: 0, y: 0, z: 1 }, length: 6000, axis: 'Z', sign: '+', isAnchor: false }, // Long run
    { vector: { x: 1, y: 0, z: 0 }, length: 4000, axis: 'X', sign: '+', isAnchor: true },  // Turn to anchor
];

const mockGuideData = [
    { vector: { x: 1, y: 0, z: 0 }, length: 3000, axis: 'X', sign: '+', hasGuide: true, guideArrestedAxis: 'Y' },
    { vector: { x: 1, y: 0, z: 0 }, length: 2000, axis: 'X', sign: '+', isAnchor: false },
    { vector: { x: 0, y: 1, z: 0 }, length: 6000, axis: 'Y', sign: '+', isAnchor: false }, // Virtual anchor triggers before this
    { vector: { x: 1, y: 0, z: 0 }, length: 3000, axis: 'X', sign: '+', isAnchor: true },
];

const mockCancellationData = [
    { vector: { x: 0, y: 1, z: 0 }, length: 3000, axis: 'Y', sign: '+' },
    { vector: { x: 1, y: 0, z: 0 }, length: 6000, axis: 'X', sign: '+' },
    { vector: { x: 0, y: -1, z: 0 }, length: 3000, axis: 'Y', sign: '-' },
    { vector: { x: 0, y: 0, z: 1 }, length: 4000, axis: 'Z', sign: '+' }
];


const SimpAnalysisTab = () => {
    const [constantC, setConstantC] = useState(20);
    const [scenario, setScenario] = useState('simple'); // 'simple', 'guide', 'cancel'
    const [analysisResult, setAnalysisResult] = useState(null);

    useEffect(() => {
        let dataToAnalyze = mockGeometry;
        if (scenario === 'guide') dataToAnalyze = mockGuideData;
        if (scenario === 'cancel') dataToAnalyze = mockCancellationData;

        // OD = 273mm (10"), alpha = 0.012 (steel)
        const result = analyzePipingSystem(dataToAnalyze, 273, 0.012, constantC);
        setAnalysisResult(result);
    }, [constantC, scenario]);

    if (!analysisResult) return <div style={{ color: 'white' }}>Loading Engine...</div>;

    return (
        <div style={{ display: 'flex', width: '100%', height: '100vh', flexDirection: 'column' }}>
            <div style={{ padding: '10px', background: '#333', color: '#fff', display: 'flex', gap: '20px', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>Smart 2D Converter Sandbox</h3>
                <div>
                    <label style={{ marginRight: '10px' }}>Scenario:</label>
                    <select value={scenario} onChange={(e) => setScenario(e.target.value)} style={{ padding: '5px' }}>
                        <option value="simple">Simple L-Bend (Step 1 & 2)</option>
                        <option value="guide">Virtual Anchor (Guide - Step 4)</option>
                        <option value="cancel">Axis Cancellation (Step 5)</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                <div style={{ flex: 3, position: 'relative' }}>
                    <SimpAnalysisCanvas
                        geometryData={analysisResult.processedGeometry}
                        logs={analysisResult.logs}
                    />
                </div>
                <div style={{ flex: 1, minWidth: '350px', borderLeft: '1px solid #444' }}>
                    <CalculationsPanel
                        data={analysisResult.calculations}
                        onChangeConstant={setConstantC}
                    />
                </div>
            </div>
        </div>
    );
};

export default SimpAnalysisTab;
