import React from 'react';

const CalculationsPanel = ({ data, onChangeConstant }) => {
    // data shape: { Lgen, Labs, OD, delta, C, Lreq, isSafe, lBendDetected: boolean }
    
    return (
        <div style={{ padding: '20px', background: '#222', color: '#eee', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ borderBottom: '2px solid #555', paddingBottom: '10px' }}>Simplified L-Bend Analysis</h2>
            
            <div style={{ margin: '20px 0' }}>
                <label style={{ display: 'block', marginBottom: '5px' }}>Constant (C):</label>
                <input 
                    type="number" 
                    value={data.C} 
                    onChange={(e) => onChangeConstant(Number(e.target.value))}
                    style={{ padding: '8px', background: '#333', color: '#fff', border: '1px solid #555', width: '100%' }}
                />
            </div>

            {data.lBendDetected ? (
                <div style={{ marginTop: '20px' }}>
                    <div style={{ background: '#333', padding: '15px', borderRadius: '5px', marginBottom: '15px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                            <span>Generator Leg (L_gen):</span>
                            <strong>{data.Lgen.toFixed(2)} mm</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                            <span>Absorber Leg (L_abs):</span>
                            <strong>{data.Labs.toFixed(2)} mm</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                            <span>Pipe OD:</span>
                            <strong>{data.OD.toFixed(2)} mm</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0' }}>
                            <span>Expansion (Δ):</span>
                            <strong>{data.delta.toFixed(2)} mm</strong>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', margin: '5px 0', borderTop: '1px dashed #555', paddingTop: '10px' }}>
                            <span>Required Absorber (L_req):</span>
                            <strong>{data.Lreq.toFixed(2)} mm</strong>
                        </div>
                    </div>

                    <div style={{ 
                        padding: '15px', 
                        textAlign: 'center', 
                        borderRadius: '5px',
                        background: data.isSafe ? '#2e7d32' : '#c62828',
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '18px'
                    }}>
                        {data.isSafe ? "SAFE (L_abs >= L_req)" : "FAIL (L_abs < L_req)"}
                    </div>
                </div>
            ) : (
                <div style={{ background: '#444', padding: '20px', borderRadius: '5px', textAlign: 'center' }}>
                    System does not reduce to a standard L-Bend. Cannot apply simplified analysis.
                </div>
            )}
        </div>
    );
};

export default CalculationsPanel;
