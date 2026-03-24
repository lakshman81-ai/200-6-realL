/**
 * rc-tab.js — New Ray Concept Tab: Full UI orchestrator
 * Coordinates all 4 stages, RayConfig panel, pass log, stage output previews,
 * download buttons, and Debug sub-tab.
 * 100% independent — only imports from rc-* siblings and reads from DOM.
 */

import { getRayConfig, setRayConfig, resetRayConfig } from './rc-config.js';
import { runStage1 } from './rc-stage1-parser.js';
import { runStage2 } from './rc-stage2-extractor.js';
import { runStage3 } from './rc-stage3-ray-engine.js';
import { runStage4 } from './rc-stage4-emitter.js';
import { debugLog, clearLog, getLog, renderDebugTab } from './rc-debug.js';

// ── Internal state (isolated to this tab) ────────────────────────────────────
const rcState = {
  rawCsvText:      null,
  rawFileName:     '',
  components:      [],   // Stage 1 output
  csv2DText:       '',   // Stage 1 CSV text
  fittingsPcfText: '',   // Stage 2 output
  connectionMatrix:[],   // Stage 3 output
  injectedPipes:   [],   // Stage 3 bridges
  pipelineRef:     '',   // derived from Stage 1
  isoMetricPcfText:'',   // Stage 4 output
  stageStatus: { s1: 'idle', s2: 'idle', s3: 'idle', s4: 'idle' }
};

// ── Bootstrap (called from app.js) ───────────────────────────────────────────
export function initRayConceptTab() {
  const root = document.getElementById('panel-ray-concept');
  if (!root) return;
  root.innerHTML = buildPanelHTML();
  wireEvents(root);
}

// ── Panel HTML ────────────────────────────────────────────────────────────────
function buildPanelHTML() {
  return `
<div style="display:flex;flex-direction:column;height:100%;gap:0.5rem;padding:0.5rem;overflow:hidden">

  <!-- Header row -->
  <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap">
    <h2 style="font-family:var(--font-code);font-size:0.9rem;color:var(--amber);margin:0">
      ⚡ NEW RAY CONCEPT
    </h2>
    <input type="file" id="rc-file-input" accept=".csv,.txt" style="display:none">
    <button id="rc-btn-upload" style="${btnStyle('primary')}">▲ Upload Raw CSV</button>
    <span id="rc-filename" style="font-size:0.72rem;color:var(--text-muted);font-family:var(--font-code)">No file loaded</span>
    <button id="rc-btn-config-toggle" style="${btnStyle()};margin-left:auto">⚙ RayConfig ▼</button>
  </div>

  <!-- RayConfig panel (collapsible) -->
  <div id="rc-config-panel" style="display:none;border:1px solid var(--steel);border-radius:4px;padding:0.5rem;background:var(--bg-panel)">
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:0.4rem" id="rc-config-grid"></div>
    <div style="margin-top:0.4rem;display:flex;gap:0.5rem">
      <button id="rc-btn-config-apply" style="${btnStyle('primary')}">✓ Apply</button>
      <button id="rc-btn-config-reset"  style="${btnStyle()}">↺ Defaults</button>
    </div>
  </div>

  <!-- Pipeline buttons -->
  <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;padding:0.25rem 0;border-top:1px solid var(--steel);border-bottom:1px solid var(--steel)">
    <button id="rc-btn-s1" style="${btnStyle()}" disabled>▶ S1: Parse→2D CSV</button>
    <button id="rc-btn-s2" style="${btnStyle()}" disabled>▶ S2: 2D CSV→Fittings PCF</button>
    <span style="color:var(--steel)">|</span>
    <button id="rc-btn-s3p0" style="${btnStyle()}" disabled>▶ P0 Gap Fill</button>
    <button id="rc-btn-s3p1" style="${btnStyle()}" disabled>▶ P1 Bridge</button>
    <button id="rc-btn-s3p2" style="${btnStyle()}" disabled>▶ P2 Branch</button>
    <span style="color:var(--steel)">|</span>
    <button id="rc-btn-s4" style="${btnStyle()}" disabled>▶ S4: Emit Isometric</button>
    <button id="rc-btn-run-all" style="${btnStyle('primary')}" disabled>▶▶ Run All</button>
    <div style="margin-left:auto;display:flex;gap:0.4rem">
      <button id="rc-btn-save-fittings" style="${btnStyle()}" disabled>↓ Save Fittings PCF</button>
      <button id="rc-btn-save-iso"      style="${btnStyle('success')}" disabled>↓ Save Isometric PCF</button>
      <button id="rc-btn-save-2dcsv"    style="${btnStyle()}" disabled>↓ Save 2D CSV</button>
    </div>
  </div>

  <!-- Main content: log + preview + debug -->
  <div style="display:flex;gap:0.5rem;flex:1;min-height:0">

    <!-- Left: pass log -->
    <div style="width:240px;flex-shrink:0;display:flex;flex-direction:column;border:1px solid var(--steel);border-radius:4px;overflow:hidden">
      <div style="padding:3px 6px;font-size:0.7rem;font-weight:600;color:var(--amber);background:var(--bg-panel);border-bottom:1px solid var(--steel)">
        PASS LOG
      </div>
      <div id="rc-pass-log" style="flex:1;overflow-y:auto;font-family:var(--font-code);font-size:0.68rem;padding:0.4rem;background:#0a0a0f;color:#0f0;white-space:pre-wrap">
        <span style="color:var(--text-muted)">Awaiting input…</span>
      </div>
    </div>

    <!-- Right: tabs (Pipeline / Debug) -->
    <div style="flex:1;display:flex;flex-direction:column;min-width:0">

      <!-- Sub-tab bar -->
      <div style="display:flex;gap:0;margin-bottom:0.4rem">
        <button class="rc-subtab-btn active" data-subtab="pipeline"
          style="${subtabStyle(true)}">📊 Pipeline</button>
        <button class="rc-subtab-btn" data-subtab="debug"
          style="${subtabStyle(false)}">🐞 Debug</button>
      </div>

      <!-- Pipeline sub-tab -->
      <div id="rc-subtab-pipeline" style="flex:1;display:flex;flex-direction:column;min-height:0">
        <!-- Stage selector -->
        <div style="display:flex;gap:0.25rem;margin-bottom:0.25rem;flex-wrap:wrap;align-items:center">
          <button class="rc-preview-btn active" data-preview="2dcsv"
            style="${previewBtnStyle(true)}">2D CSV</button>
          <button class="rc-preview-btn"        data-preview="fittings"
            style="${previewBtnStyle(false)}">Fittings PCF</button>
          <button class="rc-preview-btn"        data-preview="connmap"
            style="${previewBtnStyle(false)}">Connection Map</button>
          <button class="rc-preview-btn"        data-preview="isofinal"
            style="${previewBtnStyle(false)}">Isometric PCF</button>
          <span id="rc-diff-badge"
            style="margin-left:auto;font-size:0.7rem;font-family:var(--font-code);padding:2px 6px;border-radius:3px;display:none"></span>
          <button id="rc-btn-copy-preview" style="${btnStyle()};margin-left:auto" title="Copy current preview content to clipboard">📋 Copy</button>
        </div>
        <!-- Output preview -->
        <div id="rc-preview-area" style="flex:1;border:1px solid var(--steel);border-radius:4px;overflow:auto;background:var(--bg-0);font-family:var(--font-code);font-size:0.72rem;padding:0.5rem;white-space:pre;color:var(--text-primary)">
          <span style="color:var(--text-muted)">Load a Raw CSV file and run the pipeline stages.</span>
        </div>
      </div>

      <!-- Debug sub-tab -->
      <div id="rc-subtab-debug" style="flex:1;display:none;min-height:0;overflow:hidden">
        <div id="rc-debug-container" style="height:100%;overflow:auto"></div>
      </div>
    </div>
  </div>
</div>`;
}

// ── Event wiring ──────────────────────────────────────────────────────────────
function wireEvents(root) {
  // File upload
  root.querySelector('#rc-btn-upload').addEventListener('click', () =>
    root.querySelector('#rc-file-input').click());
  root.querySelector('#rc-file-input').addEventListener('change', e => onFileLoad(e, root));

  // RayConfig toggle
  root.querySelector('#rc-btn-config-toggle').addEventListener('click', () =>
    toggleConfig(root));
  root.querySelector('#rc-btn-config-apply').addEventListener('click', () =>
    applyConfig(root));
  root.querySelector('#rc-btn-config-reset').addEventListener('click', () =>
    resetConfig(root));

  // Pipeline buttons
  root.querySelector('#rc-btn-s1').addEventListener('click', () => runS1(root));
  root.querySelector('#rc-btn-s2').addEventListener('click', () => runS2(root));
  root.querySelector('#rc-btn-s3p0').addEventListener('click', () => runS3(root, { p0:true,  p1:false, p2:false }));
  root.querySelector('#rc-btn-s3p1').addEventListener('click', () => runS3(root, { p0:false, p1:true,  p2:false }));
  root.querySelector('#rc-btn-s3p2').addEventListener('click', () => runS3(root, { p0:false, p1:false, p2:true  }));
  root.querySelector('#rc-btn-s4').addEventListener('click', () => runS4(root));
  root.querySelector('#rc-btn-run-all').addEventListener('click', () => runAll(root));

  // Download buttons
  root.querySelector('#rc-btn-save-fittings').addEventListener('click', () =>
    saveFile(rcState.fittingsPcfText, rcState.rawFileName.replace(/\.[^.]+$/, '') + '_fittings.pcf'));
  root.querySelector('#rc-btn-save-iso').addEventListener('click', () =>
    saveFile(rcState.isoMetricPcfText, rcState.rawFileName.replace(/\.[^.]+$/, '') + '_isometric.pcf'));
  root.querySelector('#rc-btn-save-2dcsv').addEventListener('click', () =>
    saveFile(rcState.csv2DText, rcState.rawFileName.replace(/\.[^.]+$/, '') + '_2d.csv'));

  // Preview selector
  root.querySelectorAll('.rc-preview-btn').forEach(btn =>
    btn.addEventListener('click', () => switchPreview(root, btn.dataset.preview)));

  // Copy preview content
  root.querySelector('#rc-btn-copy-preview').addEventListener('click', () => {
    const el = root.querySelector('#rc-preview-area');
    if (!el) return;
    const text = el.textContent || '';
    navigator.clipboard.writeText(text).then(() => {
      const btn = root.querySelector('#rc-btn-copy-preview');
      const orig = btn.textContent;
      btn.textContent = '✅ Copied!';
      setTimeout(() => { btn.textContent = orig; }, 1500);
    }).catch(() => {
      // fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  });

  // Sub-tab switches
  root.querySelectorAll('.rc-subtab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchSubTab(root, btn.dataset.subtab)));

  // Build RayConfig grid
  buildConfigGrid(root);
}

// ── File load ─────────────────────────────────────────────────────────────────
function onFileLoad(e, root) {
  const file = e.target.files[0];
  if (!file) return;
  rcState.rawFileName = file.name;
  root.querySelector('#rc-filename').textContent = file.name;
  const reader = new FileReader();
  reader.onload = ev => {
    rcState.rawCsvText = ev.target.result;
    setBtn(root, '#rc-btn-s1', true);
    setBtn(root, '#rc-btn-run-all', true);
    passLog(root, `[INPUT] Loaded: ${file.name} (${ev.target.result.split('\n').length} lines)`);
  };
  reader.readAsText(file);
}

// ── Stage runners ─────────────────────────────────────────────────────────────
async function runS1(root) {
  if (!rcState.rawCsvText) return;
  clearLog();
  passLog(root, '[S1] Starting parse…');
  try {
    const { components, csvText } = runStage1(rcState.rawCsvText, debugLog);
    rcState.components = components;
    rcState.csv2DText  = csvText;
    rcState.pipelineRef = components.find(c => c.pipelineRef)?.pipelineRef || '';
    rcState.stageStatus.s1 = 'done';
    passLog(root, `[S1] ✅ Parsed ${components.length} components`);
    setBtn(root, '#rc-btn-s2', true);
    setBtn(root, '#rc-btn-save-2dcsv', true);
    showPreview(root, 'rc-preview-area', csvText);
    activatePreviewBtn(root, '2dcsv');
    setBadge(root, '2dcsv', 'done');
  } catch (err) {
    passLog(root, `[S1] ❌ Error: ${err.message}`);
    rcState.stageStatus.s1 = 'error';
  }
}

async function runS2(root) {
  if (!rcState.components.length) return;
  passLog(root, '[S2] Extracting fittings…');
  try {
    const { pcfText } = runStage2(rcState.components, debugLog);
    rcState.fittingsPcfText = pcfText;
    rcState.stageStatus.s2 = 'done';
    const fitCount = (pcfText.match(/^(FLANGE|BEND|TEE|OLET|VALVE|SUPPORT)/gm) || []).length;
    passLog(root, `[S2] ✅ ${fitCount} fitting blocks emitted`);
    setBtn(root, '#rc-btn-s3p0', true);
    setBtn(root, '#rc-btn-s3p1', true);
    setBtn(root, '#rc-btn-s3p2', true);
    setBtn(root, '#rc-btn-save-fittings', true);
    showPreview(root, 'rc-preview-area', pcfText);
    activatePreviewBtn(root, 'fittings');
    setBadge(root, 'fittings', 'done');
  } catch (err) {
    passLog(root, `[S2] ❌ Error: ${err.message}`);
    rcState.stageStatus.s2 = 'error';
  }
}

async function runS3(root, passOverride = null) {
  if (!rcState.components.length) return;
  passLog(root, '[S3] Ray shooting…');
  const cfg = getRayConfig();
  if (passOverride) setRayConfig({ passEnabled: passOverride });
  try {
    const result = runStage3(rcState.components, rcState.pipelineRef, debugLog);
    rcState.injectedPipes    = result.injectedPipes;
    rcState.connectionMatrix = result.connectionMatrix;
    rcState.stageStatus.s3   = 'done';
    const { p0, p1, p2 }    = result.passStats;
    passLog(root, `[S3-P0] Gap-filled: ${p0}`);
    passLog(root, `[S3-P1] Bridges:    ${p1}`);
    passLog(root, `[S3-P2] Branches:   ${p2}`);
    const orphans = result.orphanList.length;
    passLog(root, `[S3] ✅ Done — ${orphans} orphan${orphans !== 1 ? 's' : ''} remaining`);
    setBtn(root, '#rc-btn-s4', true);
    showConnMapPreview(root, result.connectionMatrix);
    activatePreviewBtn(root, 'connmap');
    // Re-render debug tab if open
    const dbgContainer = root.querySelector('#rc-debug-container');
    renderDebugTab(dbgContainer, rcState.connectionMatrix);
  } catch (err) {
    passLog(root, `[S3] ❌ Error: ${err.message}`);
    rcState.stageStatus.s3 = 'error';
  }
}

async function runS4(root) {
  if (!rcState.components.length) return;
  passLog(root, '[S4] Emitting isometric PCF…');
  try {
    const { pcfText } = runStage4(
      rcState.components, rcState.injectedPipes, rcState.pipelineRef, debugLog
    );
    rcState.isoMetricPcfText = pcfText;
    rcState.stageStatus.s4   = 'done';
    const lines = pcfText.split('\n').length;
    passLog(root, `[S4] ✅ ${lines} PCF lines emitted`);
    setBtn(root, '#rc-btn-save-iso', true);
    showPreview(root, 'rc-preview-area', pcfText);
    activatePreviewBtn(root, 'isofinal');
    setBadge(root, 'isofinal', 'done');
  } catch (err) {
    passLog(root, `[S4] ❌ Error: ${err.message}`);
    rcState.stageStatus.s4 = 'error';
  }
}

async function runAll(root) {
  clearLog();
  passLog(root, '[ALL] Starting full pipeline…');
  await runS1(root);
  if (rcState.stageStatus.s1 !== 'done') return;
  await runS2(root);
  if (rcState.stageStatus.s2 !== 'done') return;
  await runS3(root);
  if (rcState.stageStatus.s3 !== 'done') return;
  await runS4(root);
  passLog(root, '[ALL] ✅ Pipeline complete');
}

// ── RayConfig UI ──────────────────────────────────────────────────────────────
const CONFIG_FIELDS = [
  { key: 'gapFillTolerance',  label: 'Gap Fill Tolerance (mm)', type: 'number', step: '0.1' },
  { key: 'rayMaxDistance',    label: 'Ray Max Distance (mm)',   type: 'number' },
  { key: 'boreTolMultiplier', label: 'Bore Tol. Multiplier',   type: 'number', step: '0.05' },
  { key: 'minBoreTol',        label: 'Min Bore Tol (mm)',      type: 'number' },
  { key: 'deadZoneMin',       label: 'Dead Zone Min (mm)',     type: 'number', step: '0.1' },
  { key: 'stubPipeLength',    label: 'Stub Pipe Length (mm)',  type: 'number', step: '0.1' },
  { key: 'decimalPrecision',  label: 'Decimal Precision',      type: 'number', min: '1', max: '8' },
  { key: 'supportName',       label: 'Support Name',           type: 'text' },
  { key: 'pipelineRefPrefix', label: 'Pipeline Ref Prefix',    type: 'text' },
  { key: 'axisSnapAngle',     label: 'Axis Snap Angle (°)',    type: 'number', step: '0.5' },
  { key: 'sixAxP1Diameter',   label: '6Ax P1 Diameter (mm)',  type: 'number', step: '1' },
  { key: 'sixAxP1MaxDist',    label: '6Ax P1 Max Dist (mm)',  type: 'number' },
  { key: 'sixAxP2Diameter',   label: '6Ax P2 Diameter (mm)',  type: 'number', step: '1' },
  { key: 'sixAxP2DiamREDU',   label: '6Ax P2 Diam REDU (mm)',type: 'number', step: '1' },
  { key: 'sixAxP2MaxDist',    label: '6Ax P2 Max Dist (mm)',  type: 'number' }
];

function buildConfigGrid(root) {
  const cfg = getRayConfig();
  const grid = root.querySelector('#rc-config-grid');
  if (!grid) return;
  grid.innerHTML = CONFIG_FIELDS.map(f => `
    <label style="display:flex;flex-direction:column;gap:2px;font-size:0.7rem;color:var(--text-muted)">
      ${f.label}
      <input data-cfg="${f.key}" type="${f.type}"
        ${f.step ? `step="${f.step}"` : ''}
        ${f.min !== undefined ? `min="${f.min}"` : ''}
        ${f.max !== undefined ? `max="${f.max}"` : ''}
        value="${cfg[f.key] ?? ''}"
        style="font-size:0.72rem;background:var(--bg-0);color:var(--text-primary);border:1px solid var(--steel);border-radius:3px;padding:2px 5px">
    </label>`).join('');
}

function toggleConfig(root) {
  const panel = root.querySelector('#rc-config-panel');
  const btn   = root.querySelector('#rc-btn-config-toggle');
  const open  = panel.style.display === 'none';
  panel.style.display = open ? 'block' : 'none';
  btn.textContent = open ? '⚙ RayConfig ▲' : '⚙ RayConfig ▼';
  if (open) buildConfigGrid(root);
}

function applyConfig(root) {
  const patch = {};
  root.querySelectorAll('[data-cfg]').forEach(el => {
    const k = el.dataset.cfg;
    const v = el.type === 'number' ? parseFloat(el.value) : el.value;
    if (!isNaN(v) || typeof v === 'string') patch[k] = v;
  });
  setRayConfig(patch);
  passLog(root, `[CONFIG] Applied ${Object.keys(patch).length} settings`);
}

function resetConfig(root) {
  resetRayConfig();
  buildConfigGrid(root);
  passLog(root, '[CONFIG] Reset to defaults');
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function passLog(root, msg) {
  const el = root.querySelector('#rc-pass-log');
  if (!el) return;
  const line = document.createElement('div');
  line.textContent = msg;
  line.style.color = msg.includes('❌') ? '#ef4444' :
                     msg.includes('✅') ? '#22c55e' :
                     msg.startsWith('[S3') ? '#a78bfa' :
                     msg.startsWith('[ALL') ? '#f59e0b' : '#0f0';
  if (el.querySelector('span')) el.innerHTML = '';
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}

function setBtn(root, sel, enabled) {
  const btn = root.querySelector(sel);
  if (btn) btn.disabled = !enabled;
}

function showPreview(root, containerId, text) {
  const el = root.querySelector(`#${containerId}`);
  if (!el) return;
  el.textContent = text;
}

function showConnMapPreview(root, matrix) {
  const el = root.querySelector('#rc-preview-area');
  if (!el) return;
  const STATUS_ICON = { FULL: '🟢', PARTIAL: '🟡', OPEN: '🔴' };
  el.textContent = matrix.map(r =>
    `${STATUS_ICON[r.status] || '⚪'} ${r.refNo.padEnd(24)} ${r.type.padEnd(8)} ` +
    `EP1:${(r.ep1 || '—').padEnd(26)} EP2:${(r.ep2 || '—').padEnd(26)} BP:${r.bp || '—'}`
  ).join('\n');
}

function switchPreview(root, activeKey) {
  root.querySelectorAll('.rc-preview-btn').forEach(b => {
    b.style.background = b.dataset.preview === activeKey ? 'var(--amber)' : 'var(--bg-panel)';
    b.style.color      = b.dataset.preview === activeKey ? '#000' : 'var(--text-primary)';
  });
  const textMap = {
    '2dcsv':   rcState.csv2DText,
    'fittings':rcState.fittingsPcfText,
    'isofinal':rcState.isoMetricPcfText
  };
  if (activeKey === 'connmap') {
    showConnMapPreview(root, rcState.connectionMatrix);
  } else if (textMap[activeKey] !== undefined) {
    showPreview(root, 'rc-preview-area', textMap[activeKey] || '(not yet generated)');
  }
}

function activatePreviewBtn(root, key) {
  root.querySelectorAll('.rc-preview-btn').forEach(b => {
    const on = b.dataset.preview === key;
    b.style.background = on ? 'var(--amber)' : 'var(--bg-panel)';
    b.style.color      = on ? '#000' : 'var(--text-primary)';
  });
}

function switchSubTab(root, tab) {
  root.querySelectorAll('.rc-subtab-btn').forEach(b => {
    const on = b.dataset.subtab === tab;
    b.style.background    = on ? 'var(--amber)' : 'var(--bg-panel)';
    b.style.color         = on ? '#000' : 'var(--text-primary)';
    b.style.borderBottom  = on ? '2px solid var(--amber)' : '2px solid var(--steel)';
  });
  const pipelineEl = root.querySelector('#rc-subtab-pipeline');
  const debugEl    = root.querySelector('#rc-subtab-debug');
  if (pipelineEl) pipelineEl.style.display = tab === 'pipeline' ? 'flex' : 'none';
  if (debugEl)    debugEl.style.display    = tab === 'debug'    ? 'flex' : 'none';
  if (tab === 'debug') {
    renderDebugTab(root.querySelector('#rc-debug-container'), rcState.connectionMatrix);
  }
}

function setBadge(root, key, status) {
  const badge = root.querySelector('#rc-diff-badge');
  if (!badge) return;
  badge.style.display = 'block';
  badge.style.background = status === 'done' ? '#16a34a' : '#dc2626';
  badge.style.color = '#fff';
  badge.textContent = `${key}: ${status}`;
}

function saveFile(text, filename) {
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── Button/tab styles ─────────────────────────────────────────────────────────
function btnStyle(variant = '') {
  const bg = variant === 'primary' ? 'var(--amber)' :
             variant === 'success' ? '#16a34a' : 'var(--bg-panel)';
  const color = (variant === 'primary' || variant === 'success') ? '#000' : 'var(--text-primary)';
  return `font-size:0.72rem;padding:3px 8px;border-radius:3px;cursor:pointer;` +
         `border:1px solid var(--steel);background:${bg};color:${color}`;
}
function subtabStyle(active) {
  return `font-size:0.74rem;padding:4px 12px;cursor:pointer;border:none;border-bottom:2px solid ` +
    `${active ? 'var(--amber)' : 'var(--steel)'};background:${active ? 'var(--amber)' : 'var(--bg-panel)'};` +
    `color:${active ? '#000' : 'var(--text-primary)'};font-weight:${active ? '600' : '400'}`;
}
function previewBtnStyle(active) {
  return `font-size:0.7rem;padding:2px 8px;border-radius:3px;cursor:pointer;border:1px solid var(--steel);` +
    `background:${active ? 'var(--amber)' : 'var(--bg-panel)'};color:${active ? '#000' : 'var(--text-primary)'}`;
}
