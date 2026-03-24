import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line, Grid, Bounds } from '@react-three/drei';
import * as THREE from 'three';

const SimpAnalysisCanvas = ({ geometryData, logs }) => {
    // 2D Projection Mode: Visualize the "Simplified L"
    const { points, nodes } = useMemo(() => {
        const pts = [];
        const nds = [];
        let currentPos = new THREE.Vector3(0, 0, 0);
        pts.push(currentPos.clone());
        nds.push({ pos: currentPos.clone(), index: 0, type: 'START' });

        if (geometryData && geometryData.length > 0) {
            geometryData.forEach((leg, i) => {
                // If the smart converter already reduced it to an L, geometryData contains the active/passive legs.
                // We render the 3D path.
                const nextPos = currentPos.clone().add(
                    new THREE.Vector3(leg.vector.x, leg.vector.y, leg.vector.z).multiplyScalar(leg.length)
                );
                pts.push(nextPos.clone());
                nds.push({ pos: nextPos.clone(), index: i + 1, type: leg.isAnchor ? 'ANCHOR' : 'NODE', passive: leg.passive });
                currentPos = nextPos;
            });
        }
        return { points: pts, nodes: nds };
    }, [geometryData]);

    return (
        <div style={{ width: '100%', height: '100%', position: 'relative', background: '#111' }}>
            <div style={{ position: 'absolute', top: 10, left: 10, zIndex: 10, color: '#00ff00', fontFamily: 'monospace', fontSize: 12, background: 'rgba(0,0,0,0.7)', padding: '10px', borderRadius: '4px', maxWidth: '300px', maxHeight: '80%', overflowY: 'auto' }}>
                <h4 style={{ margin: '0 0 10px 0', borderBottom: '1px solid #333', paddingBottom: '5px' }}>Smart Engine Log:</h4>
                {logs && logs.length > 0 ? logs.map((l, i) => (
                    <div key={i} style={{ marginBottom: '4px' }}>{l}</div>
                )) : <div>No operations performed.</div>}
            </div>

            <Canvas orthographic camera={{ position: [0, 5000, 5000], zoom: 50, up: [0, 1, 0] }}>
                <color attach="background" args={['#1a1a2e']} />
                <Grid infiniteGrid fadeDistance={50000} sectionColor="#444" cellColor="#222" />

                <Bounds fit clip observe margin={1.2}>
                    <group>
                        {points.length > 1 && (
                            <Line 
                                points={points} 
                                color="#00ffcc" 
                                lineWidth={4} 
                            />
                        )}

                        {nodes.map((n, i) => (
                            <group key={i} position={n.pos}>
                                <mesh>
                                    <sphereGeometry args={[50]} />
                                    <meshBasicMaterial color={n.type === 'START' || n.type === 'ANCHOR' ? '#ff3366' : '#cccccc'} />
                                </mesh>
                                <Text position={[0, 150, 0]} fontSize={100} color="white" outlineWidth={10} outlineColor="#000">
                                    {n.type === 'START' ? 'START' : n.type === 'ANCHOR' ? 'ANCHOR' : `N${i}`}
                                </Text>
                            </group>
                        ))}
                    </group>
                </Bounds>

                <OrbitControls makeDefault enableRotate={false} />
            </Canvas>
        </div>
    );
};

export default SimpAnalysisCanvas;
