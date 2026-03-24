import React from 'react';
import { createRoot } from 'react-dom/client';
import SimpAnalysisTab from './SimpAnalysisTab';

// Mount point
const container = document.getElementById('simp-analysis_3D-tab');

if (container) {
    const root = createRoot(container);
    root.render(<SimpAnalysisTab />);
} else {
    console.error('Simp. Analysis Mount Point Not Found: <div id="simp-analysis_3D-tab"></div> is missing.');
}
