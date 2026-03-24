import React from 'react';
import { createRoot } from 'react-dom/client';
import { getMockPCFText } from './core/mock-data.js';
import { parsePCFText } from './core/pcf-parser.js';
import { generatePCFText } from './core/3d_smart_fixer_pcf_exporter.js';
import { PcfTopologyGraph_2 } from './core/PcfTopologyGraph_2.js';
import { SmartFixerConfig } from './core/smartFixerConfig.js';
import { applyApprovedFixes } from './core/pcf-modifier.js';
import { useSmartFixerStore } from './store.js';
import { mountViewer2App } from './App2.jsx';
import { Datatable3D_Smart_Fixer } from './ui/3d_smart_fixer_datatable.jsx';
import { buildBasicPcf, buildFullPcf } from './core/3d_smart_fixer_pcf_builder.js';

/**
 * js/smart_fixer/index.js
 * Main entry point for the 3D_2 Viewer module.
 * Wires the DOM elements to the React/Zustand logic.
 */

export function initSmartFixer() {
    // Expose Pass 2 trigger globally


    const btnLoadMock = document.getElementById('btn-v2-load-mock');
    const btnGenerate = document.getElementById('btn-v2-generate');
    const btnApplyFixes = document.getElementById('btn-v2-apply-fixes');
    const btnDownloadBasic = document.getElementById('btn-v2-download-basic');
    const btnDownloadFull = document.getElementById('btn-v2-download-full');
    const txtInput = document.getElementById('smart_fixer-pcf-input');
    const tableContainer = document.getElementById('smart_fixer-datatable-container');

    // Mount Datatable React Root
    if (tableContainer) {
        const tableRoot = createRoot(tableContainer);
        tableRoot.render(<Datatable3D_Smart_Fixer />);
    }

    // 1. Load Mock Data
    if (btnLoadMock && txtInput) {
        btnLoadMock.addEventListener('click', () => {
            txtInput.value = getMockPCFText();
        });
    }

    // 1.5. Import PCF File
    const btnImportPcf = document.getElementById('btn-v2-import-pcf');
    if (btnImportPcf && txtInput) {
        btnImportPcf.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (evt) => {
                txtInput.value = evt.target.result;
                if (btnGenerate) btnGenerate.click();
            };
            reader.readAsText(file);
            // Reset input so the same file can be loaded again if needed
            e.target.value = '';
        });
    }

    // PTE Conversion Mode listeners
    const cbSequential = document.getElementById('pte-sequential-cb');
    const cbLineKey = document.getElementById('pte-linekey-cb');
    const selLineKeyCol = document.getElementById('pte-linekey-col-select');

    const updatePTEConfig = () => {
        if (cbSequential) window.__pteSequential = cbSequential.checked;
        if (cbLineKey) window.__pteLineKeyEnabled = cbLineKey.checked;
        if (selLineKeyCol) window.__pteLineKeyColumn = selLineKeyCol.value;
    };
    if (cbSequential) cbSequential.addEventListener('change', () => { updatePTEConfig(); });
    if (cbLineKey) cbLineKey.addEventListener('change', () => { updatePTEConfig(); });
    if (selLineKeyCol) selLineKeyCol.addEventListener('change', () => { updatePTEConfig(); });

    // Initialize
    updatePTEConfig();

    // Bind the new Line Key Filter dropdown to trigger Pass 1 when changed manually
    const selLineKeyFilter = document.getElementById('sel-line-key-filter');
    if (selLineKeyFilter) {
        selLineKeyFilter.addEventListener('change', () => {
            const btn = document.getElementById('btn-v2-run-pass-1');
            if (btn) btn.click();
        });
    }

    // 2. Generate 3D (Initial Load without Pass 1)
    if (btnGenerate && txtInput) {
        btnGenerate.addEventListener('click', () => {
            const rawText = txtInput.value;
            if (!rawText.trim()) return;

            // Step A: Parse raw text
            let parsedComponents = parsePCFText(rawText);

            // Do NOT run pass 1 yet. Just load the raw data.
            // parsedComponents = detectAndMergeIssues(parsedComponents);

            // Step C: Update Source of Truth (Datatable)
            useSmartFixerStore.getState().setComponents(parsedComponents);

            // Populate Line Key Dropdown
            const selLineKey = document.getElementById('sel-line-key-filter');
            if (selLineKey) {
                const uniqueKeys = new Set();
                parsedComponents.forEach(c => {
                    const lk = c.Line_Key || c['Line No'] || c['Line_No'] || c.pipelineReference || (c.attributes ? c.attributes['Line_Key'] || c.attributes['Line No'] : '');
                    if (lk && lk.trim() !== '') uniqueKeys.add(lk.trim());
                });

                selLineKey.innerHTML = '<option value="">All Lines</option>';
                Array.from(uniqueKeys).sort().forEach(k => {
                    const opt = document.createElement('option');
                    opt.value = k;
                    opt.textContent = k;
                    selLineKey.appendChild(opt);
                });
            }

            // Step D: Ensure 3D Canvas is mounted (lazy load)
            mountViewer2App('react-root-2');

            // Step E: Auto-switch to Datatable view
            if (window.__smart_fixer_switchTab) window.__smart_fixer_switchTab('data');

            // Fix for blank canvas bug: trigger a resize event to ensure WebGL context renders
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 100);
            setTimeout(() => {
                window.dispatchEvent(new Event('resize'));
            }, 500);

            // Reset UI states
            const btnPass2 = document.getElementById('btn-v2-run-pass-2');
            if (btnPass2) btnPass2.style.display = 'none';
        });
    }

    // 2.5 Run First Pass
    const btnRunPass1 = document.getElementById('btn-v2-run-pass-1');
    if (btnRunPass1 && txtInput) {
        btnRunPass1.addEventListener('click', () => {
            console.log("btn-v2-run-pass-1 clicked! Resetting from raw PCF text...");
            const rawText = txtInput.value;
            if (!rawText.trim()) return;

            const parsedComponents = parsePCFText(rawText);
            const selLineKey = document.getElementById('sel-line-key-filter');
            const targetLineKey = selLineKey ? selLineKey.value : "";

            const appConfig = window.appConfig || {};
            const graph = new PcfTopologyGraph_2(parsedComponents, appConfig);
            const pass1Result = graph.runSequentialPass(targetLineKey);

            // Set both the revised components (with UI hints) AND the explicit visualGaps geometry
            useSmartFixerStore.getState().setComponents(pass1Result.revisedComponents, pass1Result.visualGaps);

            // Show Pass 2 button
            const btnPass2 = document.getElementById('btn-v2-run-pass-2');
            if (btnPass2) btnPass2.style.display = 'inline-block';
        });
    }

    window.__runPass2 = () => {
        console.log("Triggering Pass 2 manually...");
        const store = useSmartFixerStore.getState();
        const currentComponents = store.components;
        if (!currentComponents || currentComponents.length === 0) return;

        // Note: we want Pass 2 to run ON the current active components (which might already have been fixed by Pass 1 + Apply)
        const selLineKey = document.getElementById('sel-line-key-filter');
        const targetLineKey = selLineKey ? selLineKey.value : "";

        const appConfig = window.appConfig || {};
        const graph = new PcfTopologyGraph_2(currentComponents, appConfig);
        // Call BOTH fuzzy passes!
        const p2 = graph.runFuzzyTopologicalPass2(targetLineKey);
        graph.applyApprovedMutations(targetLineKey);
        const p3 = graph.runFuzzyTopologicalPass3(targetLineKey);

        const allGaps = [...(p2.visualGaps || []), ...(p3.visualGaps || [])];
        store.setComponents(p3.revisedComponents, allGaps);
    };

    const btnRunPass2 = document.getElementById('btn-v2-run-pass-2');
    if (btnRunPass2) {
        btnRunPass2.addEventListener('click', () => {
            if (window.__runPass2) window.__runPass2();
        });
    }

    // --- Local Tab Logic for 3D_2 Viewer Left Column ---
    const btnTabPcf = document.getElementById('btn-tab-pcf');
    const btnTabData = document.getElementById('btn-tab-data');
    const panelTabPcf = document.getElementById('panel-tab-pcf');
    const panelTabData = document.getElementById('panel-tab-data');

    if (btnTabPcf && btnTabData && panelTabPcf && panelTabData) {
        const switchTab = (activeTab) => {
            if (activeTab === 'pcf') {
                btnTabPcf.style.borderBottomColor = 'var(--emerald)';
                btnTabPcf.style.color = 'var(--text-primary)';
                btnTabPcf.style.background = 'var(--bg-1)';

                btnTabData.style.borderBottomColor = 'transparent';
                btnTabData.style.color = 'var(--text-muted)';
                btnTabData.style.background = 'transparent';

                panelTabPcf.style.display = 'flex';
                panelTabData.style.display = 'none';
            } else {
                btnTabData.style.borderBottomColor = 'var(--emerald)';
                btnTabData.style.color = 'var(--text-primary)';
                btnTabData.style.background = 'var(--bg-1)';

                btnTabPcf.style.borderBottomColor = 'transparent';
                btnTabPcf.style.color = 'var(--text-muted)';
                btnTabPcf.style.background = 'transparent';

                panelTabPcf.style.display = 'none';
                panelTabData.style.display = 'flex';
            }
        };

        btnTabPcf.addEventListener('click', () => switchTab('pcf'));
        btnTabData.addEventListener('click', () => switchTab('data'));

        // Expose function globally to auto-switch during Generate 3D
        window.__smart_fixer_switchTab = switchTab;
    }

    // 3. Apply Fixes & Regenerate PCF text
    if (btnApplyFixes && txtInput) {
        btnApplyFixes.addEventListener('click', () => {
            console.log("[SmartFixer UI] 'Apply Fixes' clicked.");
            const currentComponents = useSmartFixerStore.getState().components;
            console.log(`[SmartFixer UI] Current components count: ${currentComponents.length}`);

            try {
                // Step A: Apply fixing actions using the new Topology Graph engine
                const result = applyApprovedFixes(currentComponents);
                const updatedComponents = result.revisedComponents || [];
                const remainingGaps = result.visualGaps || [];
                console.log(`[SmartFixer UI] Updated components count: ${updatedComponents.length}`);

                // Step B: Generate text back
                const newPCFText = generatePCFText(updatedComponents);
                if (newPCFText && newPCFText.length > 0) {
                    txtInput.value = newPCFText;
                    console.log("[SmartFixer UI] Successfully regenerated PCF text. Updating viewer...");
                } else {
                    console.warn("[SmartFixer UI] Regenerated PCF text was empty!");
                }

                // Step C: Re-run generation logic automatically to reflect changes
                // The newly parsed components will have 0 visual gaps if everything was applied correctly.
                let parsedComponents = parsePCFText(newPCFText);
                useSmartFixerStore.getState().setComponents(parsedComponents, remainingGaps);
                console.log("[SmartFixer UI] Components successfully synced back to store.");

                const btnPass2 = document.getElementById('btn-v2-run-pass-2');
                if (btnPass2) {
                    btnPass2.style.display = 'inline-block';
                }
            } catch (err) {
                console.error("[SmartFixer UI] Error during apply fixes:", err);
            }
        });
    } else {
        console.warn("[SmartFixer UI] Missing btnApplyFixes or txtInput during initialization.");
    }

    const updateConsoleUI = (logs) => {
        const consoleEl = document.getElementById('smart_fixer-builder-console');
        if (consoleEl) {
            consoleEl.innerHTML = ''; // Clear previous
            if (!logs || logs.length === 0) {
                const div = document.createElement('div');
                div.style.color = '#10b981';
                div.textContent = '[SUCCESS] Validation Passed. No errors or warnings found.';
                consoleEl.appendChild(div);
            } else {
                logs.forEach(msg => {
                    const color = msg.includes('[ERROR]') ? '#ef4444' : (msg.includes('[WARNING]') ? '#f59e0b' : '#d4d4d4');
                    const div = document.createElement('div');
                    div.style.color = color;
                    div.style.marginBottom = '4px';
                    div.textContent = msg; // textContent securely escapes HTML entities like <SKEY>
                    consoleEl.appendChild(div);
                });
            }
        }
    };

    if (btnDownloadBasic) {
        btnDownloadBasic.addEventListener('click', () => {
            const state = useSmartFixerStore.getState();
            const currentComponents = state.components;
            const precisionEl = document.getElementById('pcf-precision-select');
            const precision = precisionEl ? parseInt(precisionEl.value, 10) : 4;

            if (!currentComponents || currentComponents.length === 0) return alert('No components data available.');

            const { pcfText, logs } = buildBasicPcf(currentComponents, { precision });
            state.setPcfBuildLogs(logs);
            updateConsoleUI(logs);

            const blob = new Blob([pcfText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'smart_fixed_basic.pcf';
            a.click();
            URL.revokeObjectURL(url);
        });
    }

    if (btnDownloadFull) {
        btnDownloadFull.addEventListener('click', () => {
            const state = useSmartFixerStore.getState();
            const currentComponents = state.components;
            const precisionEl = document.getElementById('pcf-precision-select');
            const precision = precisionEl ? parseInt(precisionEl.value, 10) : 4;

            if (!currentComponents || currentComponents.length === 0) return alert('No components data available.');

            const { pcfText, logs } = buildFullPcf(currentComponents, { precision });
            state.setPcfBuildLogs(logs);
            updateConsoleUI(logs);

            const blob = new Blob([pcfText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'smart_fixed_full.pcf';
            a.click();
            URL.revokeObjectURL(url);
        });
    }
}
