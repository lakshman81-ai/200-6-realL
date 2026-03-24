/**
 * rc-stage4-emitter.js — Stage 4: Connection map + Component list → Isometric PCF
 * Takes Stage 1 component order + Stage 3 injected pipes → full PCF
 * 100% independent — only imports from rc-config.js
 */

import { getRayConfig, fmtNum, computeLenAxis, vecSub, vecMag } from './rc-config.js';

// ── PCF line helpers ──────────────────────────────────────────────────────────

function pad(n) { return ' '.repeat(n); }

function fmtCoord(pt, bore, cfg) {
  const p = cfg.decimalPrecision;
  return [
    Number(pt.x).toFixed(p), Number(pt.y).toFixed(p),
    Number(pt.z).toFixed(p), Number(bore).toFixed(p)
  ].join(' ');
}

function emitMsgSq(parts) {
  return ['MESSAGE-SQUARE', `${pad(4)}${parts.join(', ')}`];
}

// ── Component PCF emitters ────────────────────────────────────────────────────

function emitPipe(ep1, ep2, bore, pipelineRef, seqNo, cfg, refNo) {
  const la  = computeLenAxis(ep1, ep2, cfg);
  const lines = [];
  // MESSAGE-SQUARE
  const lenStr = [
    la.len1 ? `${la.len1}MM ${la.axis1}` : null,
    la.len2 ? `${la.len2}MM ${la.axis2}` : null,
    la.len3 ? `${la.len3}MM ${la.axis3}` : null
  ].filter(Boolean).join(' + ');
  lines.push(...emitMsgSq([
    'PIPE',
    ...(refNo ? [`RefNo:=${refNo}`] : []),
    ...(lenStr ? [`LENGTH=${lenStr}`] : []),
    `SeqNo:${seqNo}`
  ]));
  lines.push('PIPE');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(ep1, bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(ep2, bore, cfg)}`);
  if (pipelineRef) lines.push(`${pad(4)}PIPELINE-REFERENCE ${pipelineRef}`);
  if (refNo)       lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${refNo}`);
  lines.push('');
  return lines;
}

function emitFlange(comp, seqNo, cfg) {
  const lines = [];
  const la = comp.lenAxis || {};
  const lenStr = [la.len1, la.axis1, la.len2, la.axis2, la.len3, la.axis3]
    .filter(Boolean).join(' ');
  lines.push(...emitMsgSq([
    'FLANGE',
    ...(lenStr ? [`LENGTH=${la.len3 || la.len1 || la.len2}MM ${la.axis3 || la.axis1 || la.axis2}`] : []),
    `RefNo:=${comp.refNo}`,
    `SeqNo:${seqNo}`
  ]));
  lines.push('FLANGE');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep1, comp.bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep2, comp.bore, cfg)}`);
  lines.push(`${pad(4)}<SKEY> ${comp.skey}`);
  if (comp.ca97) lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

function emitBend(comp, seqNo, cfg) {
  const lines = [];
  const la = comp.lenAxis || {};
  lines.push(...emitMsgSq([
    'BEND',
    `RefNo:=${comp.refNo}`,
    `SeqNo:${seqNo}`
  ]));
  lines.push('BEND');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep1, comp.bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep2, comp.bore, cfg)}`);
  lines.push(`${pad(4)}CENTRE-POINT  ${fmtCoord(comp.cp,  comp.bore, cfg)}`);
  lines.push(`${pad(4)}<SKEY> ${comp.skey}`);
  if (comp.radius) lines.push(`${pad(4)}ANGLE 90.0000`);
  if (comp.ca97)   lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

function emitTee(comp, seqNo, cfg) {
  const lines = [];
  lines.push(...emitMsgSq([
    'TEE',
    `LENGTH=${comp.brlen}MM`,
    `RefNo:=${comp.refNo}`,
    `SeqNo:${seqNo}`,
    `BrLen=${comp.brlen}MM`
  ]));
  lines.push('TEE');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep1, comp.bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep2, comp.bore, cfg)}`);
  lines.push(`${pad(4)}CENTRE-POINT  ${fmtCoord(comp.cp, comp.bore, cfg)}`);
  lines.push(`${pad(4)}BRANCH1-POINT ${fmtCoord(comp.bp, Number(comp.branchBore || comp.bore), cfg)}`);
  lines.push(`${pad(4)}<SKEY> ${comp.skey}`);
  if (comp.ca97) lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

function emitOlet(comp, seqNo, cfg) {
  const lines = [];
  lines.push(...emitMsgSq([
    'OLET',
    `BrLen=${comp.brlen}MM`,
    `RefNo:=${comp.refNo}`,
    `SeqNo:${seqNo}`
  ]));
  lines.push('OLET');
  lines.push(`${pad(4)}CENTRE-POINT  ${fmtCoord(comp.cp, comp.bore, cfg)}`);
  lines.push(`${pad(4)}BRANCH1-POINT ${fmtCoord(comp.bp, Number(comp.branchBore || 50), cfg)}`);
  lines.push(`${pad(4)}<SKEY> ${comp.skey}`);
  if (comp.ca97) lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

function emitValve(comp, seqNo, cfg) {
  const lines = [];
  const la = comp.lenAxis || {};
  const lenV = la.len1 || la.len2 || la.len3 || '';
  const axV  = la.axis1 || la.axis2 || la.axis3 || '';
  lines.push(...emitMsgSq([
    'VALVE',
    ...(lenV ? [`LENGTH=${lenV}MM ${axV}`] : []),
    `RefNo:=${comp.refNo}`,
    `SeqNo:${seqNo}`
  ]));
  lines.push('VALVE');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep1, comp.bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep2, comp.bore, cfg)}`);
  lines.push(`${pad(4)}<SKEY> ${comp.skey}`);
  if (comp.ca97) lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

function emitSupport(comp, seqNo, cfg) {
  const lines = [];
  lines.push(...emitMsgSq([
    'SUPPORT',
    `RefNo:=${comp.refNo}_${(comp.supportGuid || '').split(':').pop()}`,
    `SeqNo:${seqNo}`,
    comp.supportName,
    comp.supportGuid
  ]));
  lines.push('SUPPORT');
  lines.push(`${pad(4)}CO-ORDS    ${fmtCoord(comp.supportCoor, 0, cfg)}`);
  lines.push(`${pad(4)}<SUPPORT_NAME>    ${comp.supportName}`);
  lines.push(`${pad(4)}<SUPPORT_GUID>    ${comp.supportGuid}`);
  lines.push('');
  return lines;
}

// B3: Reducer emitter — maps REDU → REDUCER-CONCENTRIC PCF block
function emitReducer(comp, seqNo, cfg) {
  const lines = [];
  const la = comp.lenAxis || {};
  const lenV = la.len1 || la.len2 || la.len3 || '';
  const axV  = la.axis1 || la.axis2 || la.axis3 || '';
  lines.push(...emitMsgSq([
    'REDUCER-CONCENTRIC',
    ...(lenV ? [`LENGTH=${lenV}MM ${axV}`] : []),
    `RefNo:=${comp.refNo}`,
    `SeqNo:${seqNo}`
  ]));
  lines.push('REDUCER-CONCENTRIC');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep1, comp.bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep2, comp.bore, cfg)}`);
  lines.push(`${pad(4)}<SKEY> RCBW`);
  if (comp.ca97) lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

// B3: Blind Flange emitter — maps FBLI → FLANGE PCF block with blind SKEY
function emitBlindFlange(comp, seqNo, cfg) {
  const lines = [];
  const la = comp.lenAxis || {};
  const lenV = la.len1 || la.len2 || la.len3 || '';
  const axV  = la.axis1 || la.axis2 || la.axis3 || '';
  lines.push(...emitMsgSq([
    'FLANGE',
    ...(lenV ? [`LENGTH=${lenV}MM ${axV}`] : []),
    `RefNo:=${comp.refNo}`,
    `SeqNo:${seqNo}`
  ]));
  lines.push('FLANGE');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep1, comp.bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep2, comp.bore, cfg)}`);
  lines.push(`${pad(4)}<SKEY> BLFL`);
  if (comp.ca97) lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

// B3: Generic passthrough emitter for GASK/PCOM — these share coordinates
// with adjacent flanges so they contribute to continuity but emit as COMPONENT
function emitGenericComponent(comp, seqNo, cfg) {
  if (!comp.ep1 || !comp.ep2) return [];
  const lines = [];
  lines.push(...emitMsgSq([comp.type, `RefNo:=${comp.refNo}`, `SeqNo:${seqNo}`]));
  lines.push('COMPONENT');
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep1, comp.bore, cfg)}`);
  lines.push(`${pad(4)}END-POINT    ${fmtCoord(comp.ep2, comp.bore, cfg)}`);
  if (comp.skey) lines.push(`${pad(4)}<SKEY> ${comp.skey}`);
  if (comp.ca97) lines.push(`${pad(4)}COMPONENT-ATTRIBUTE97    ${comp.ca97}`);
  lines.push(`${pad(4)}COMPONENT-ATTRIBUTE98    ${seqNo}`);
  lines.push('');
  return lines;
}

// B4: Fixed bridge matching — match only when BOTH ep1 AND ep2 are close
// to the original pipe's ep1 and ep2 (bidirectional pair check).
// The old code matched on comp.ep2 ≈ bridge.ep1 which caused wrong assignments.
function findBridgeForPipe(comp, injected, usedIdx, cfg) {
  const tol = cfg.minBoreTol;
  if (!comp.ep1 || !comp.ep2) return null;

  let bestScore = Infinity;
  let bestIdx   = -1;

  for (let i = 0; i < injected.length; i++) {
    if (usedIdx.has(i)) continue;
    const b = injected[i];

    // Forward match: bridge ep1→ep2 aligns with pipe ep1→ep2
    const d1fwd = vecMag(vecSub(b.ep1, comp.ep1));
    const d2fwd = vecMag(vecSub(b.ep2, comp.ep2));
    const fwdScore = d1fwd + d2fwd;

    // Reverse match: bridge ep2→ep1 aligns with pipe ep1→ep2
    const d1rev = vecMag(vecSub(b.ep2, comp.ep1));
    const d2rev = vecMag(vecSub(b.ep1, comp.ep2));
    const revScore = d1rev + d2rev;

    const score = Math.min(fwdScore, revScore);
    // Both endpoints must be within tolerance (not just one)
    const minD = Math.min(
      Math.max(d1fwd, d2fwd),
      Math.max(d1rev, d2rev)
    );

    if (minD < tol && score < bestScore) {
      bestScore = score;
      bestIdx   = i;
    }
  }

  if (bestIdx >= 0) {
    usedIdx.add(bestIdx);
    return injected[bestIdx];
  }
  return null;
}

// ── PCF header ────────────────────────────────────────────────────────────────

function buildHeader(pipelineRef, cfg) {
  return [
    'ISOGEN-FILES ISOGEN.FLS',
    'UNITS-BORE MM',
    'UNITS-CO-ORDS MM',
    'UNITS-WEIGHT KGS',
    'UNITS-BOLT-DIA MM',
    'UNITS-BOLT-LENGTH MM',
    `PIPELINE-REFERENCE ${pipelineRef}`,
    '    PROJECT-IDENTIFIER P1',
    '    AREA A1',
    ''
  ];
}

// ── Support-on-bridge projection helper ────────────────────────────────
// Projects each SUPPORT cp onto ep1→ep2 segment.
// Returns sorted array of { comp, t, snapPt } for supports that lie ON the segment.
function supportsOnBridge(br, supportComps, cfg) {
  const seg    = vecSub(br.ep2, br.ep1);
  const segLen = vecMag(seg);
  if (segLen < 1e-6) return [];
  const sd = { x: seg.x / segLen, y: seg.y / segLen, z: seg.z / segLen };
  // Use a generous tolerance for support projection — supports should lie exactly
  // on the pipe centerline (perpDist ≈ 0) so any reasonable tolerance works.
  // Using max(bore*0.5, 1000mm) to handle any minor coordinate drift.
  const tol = Math.max(
    (br.bore || 0) * (cfg.boreTolMultiplier || 0.5),
    (cfg.minBoreTol || 25),
    1000   // generous floor — supports are always on centerline
  );

  const hits = [];
  for (const sp of supportComps) {
    if (!sp.cp) continue;
    const tv = vecSub(sp.cp, br.ep1);
    const t  = tv.x * sd.x + tv.y * sd.y + tv.z * sd.z;
    if (t <= 0 || t >= segLen) continue;
    const snap = { x: br.ep1.x + sd.x * t, y: br.ep1.y + sd.y * t, z: br.ep1.z + sd.z * t };
    const perpDist = vecMag(vecSub(sp.cp, snap));
    // Debug trace — remove after verified
    console.log('[supportsOnBridge]', sp.refNo, 't=', t.toFixed(1), 'perp=', perpDist.toFixed(3), 'tol=', tol);
    if (perpDist <= tol) {
      hits.push({ comp: sp, t, snap });
    }
  }
  hits.sort((a, b) => a.t - b.t);
  return hits;
}

// ── Main Stage 4 function ─────────────────────────────────────────────────────

/**
 * @param {object[]} components   — Stage 1 ordered list (includes PIPEs)
 * @param {object[]} injectedPipes — Stage 3 bridges
 * @param {string}   pipelineRef
 * @param {function} logFn
 * @returns {{ pcfText: string }}
 */
export function runStage4(components, injectedPipes, pipelineRef, logFn = () => {}) {
  const cfg = getRayConfig();
  const eol = cfg.windowsLineEndings ? '\r\n' : '\n';

  const outputLines = buildHeader(pipelineRef, cfg);
  let seqCtr = 0;

  // Collect SUPPORT components for inline split detection
  const supportComps = components.filter(c => c.type === 'SUPPORT');
  // Track supports emitted inline inside a bridge split (skip in main loop)
  const inlineEmittedSupports = new Set();

  // ── Emit a bridge with support splitting ─────────────────────────────────
  function emitBridgeSplit(br, fromRefNo) {
    const hits = supportsOnBridge(br, supportComps, cfg);
    const bridgeRefNo = fromRefNo ? `${fromRefNo}_bridged` : null;

    if (hits.length === 0) {
      seqCtr++;
      logFn('S4', 'bridge-pipe-emitted', fromRefNo,
        { ep1: br.ep1, ep2: br.ep2, bore: br.bore, to: br.toRefNo });
      outputLines.push(...emitPipe(br.ep1, br.ep2, br.bore, pipelineRef, seqCtr, cfg, bridgeRefNo));
      return;
    }

    // Split: cursor → S1.snap → S2.snap → ... → ep2
    let cursor = br.ep1;
    for (const hit of hits) {
      // Pipe segment up to this support
      seqCtr++;
      logFn('S4', 'bridge-split-pipe', fromRefNo,
        { ep1: cursor, ep2: hit.snap, bore: br.bore, toSupport: hit.comp.refNo });
      outputLines.push(...emitPipe(cursor, hit.snap, br.bore, pipelineRef, seqCtr, cfg, bridgeRefNo));
      // Inline support block
      seqCtr++;
      logFn('S4', 'support-inline-emitted', hit.comp.refNo, {});
      outputLines.push(...emitSupport(hit.comp, seqCtr, cfg));
      inlineEmittedSupports.add(hit.comp.refNo);
      cursor = hit.snap;
    }
    // Tail segment from last support snap to bridge ep2
    seqCtr++;
    logFn('S4', 'bridge-split-tail', fromRefNo,
      { ep1: cursor, ep2: br.ep2, bore: br.bore });
    outputLines.push(...emitPipe(cursor, br.ep2, br.bore, pipelineRef, seqCtr, cfg, bridgeRefNo));
  }

  // ── Build bridge lookup by source component (fromRefNo) ──────────────────
  // Each bridge is emitted AFTER the fitting it originates from.
  // This replaces the broken findBridgeForPipe approach which tried to match
  // bridge coords to original PIPE ep1/ep2 (which span full pipe sections,
  // not just fitting-to-fitting gaps).
  const bridgesByFrom = new Map();
  for (const br of injectedPipes) {
    const key = br.fromRefNo || '__unkeyed';
    if (!bridgesByFrom.has(key)) bridgesByFrom.set(key, []);
    bridgesByFrom.get(key).push(br);
  }
  const emittedBridgeSet = new Set();

  function emitBridgesFrom(refNo) {
    const list = bridgesByFrom.get(refNo) || [];
    for (const br of list) {
      const bKey = `${br.ep1.x}_${br.ep1.y}_${br.ep1.z}__${br.ep2.x}_${br.ep2.y}_${br.ep2.z}`;
      if (emittedBridgeSet.has(bKey)) continue;
      emittedBridgeSet.add(bKey);
      emitBridgeSplit(br, refNo);
    }
  }

  // ── Walk S1 component list ────────────────────────────────────────────────
  for (const comp of components) {

    // Skip original PIPE/BRAN segments — their geometry is replaced by bridges.
    // Emit bridges after the fitting they originate from instead.
    if (comp.type === 'PIPE') {
      logFn('S4', 'pipe-skipped', comp.refNo, {});
      continue;
    }

    if (comp.type === 'SUPPORT') {
      // Skip if already emitted inline within a bridge split
      if (inlineEmittedSupports.has(comp.refNo)) {
        logFn('S4', 'support-inline-skip', comp.refNo, {});
        continue;
      }
      seqCtr++;
      logFn('S4', 'support-emitted', comp.refNo, {});
      outputLines.push(...emitSupport(comp, seqCtr, cfg));
      continue;
    }

    // Emit the fitting component
    seqCtr++;
    const seq = seqCtr;

    switch (comp.type) {
      case 'FLANGE': outputLines.push(...emitFlange(comp, seq, cfg));      break;
      case 'FBLI':   outputLines.push(...emitBlindFlange(comp, seq, cfg)); break;
      case 'BEND':   outputLines.push(...emitBend(comp, seq, cfg));        break;
      case 'TEE':    outputLines.push(...emitTee(comp, seq, cfg));         break;
      case 'OLET':   outputLines.push(...emitOlet(comp, seq, cfg));        break;
      case 'VALVE':  outputLines.push(...emitValve(comp, seq, cfg));       break;
      case 'REDU':   outputLines.push(...emitReducer(comp, seq, cfg));     break;
      case 'GASK':
      case 'PCOM':   outputLines.push(...emitGenericComponent(comp, seq, cfg)); break;
      default:
        logFn('S4', 'unknown-type', comp.refNo, { type: comp.type });
    }

    logFn('S4', 'component-emitted', comp.refNo, { type: comp.type, seq });

    // Emit any bridge pipes that originate from this component
    emitBridgesFrom(comp.refNo);
  }

  // Safety net: emit any bridges whose fromRefNo wasn't found in S1 component list
  // (e.g., bridges from OLET.bp or TEE.bp which have no separate S1 PIPE slot)
  for (const [key, list] of bridgesByFrom) {
    if (key === '__unkeyed') {
      for (const br of list) {
        const bKey = `${br.ep1.x}_${br.ep1.y}_${br.ep1.z}__${br.ep2.x}_${br.ep2.y}_${br.ep2.z}`;
        if (emittedBridgeSet.has(bKey)) continue;
        emittedBridgeSet.add(bKey);
        emitBridgeSplit(br, '');
      }
    }
  }

  const pcfText = outputLines.join(eol);
  return { pcfText };
}
