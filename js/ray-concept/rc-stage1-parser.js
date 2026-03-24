/**
 * rc-stage1-parser.js — Stage 1: Raw CSV (point-per-row) → 2D CSV (one row per component)
 * Input:  raw CSV text (export sys-1.csv format)
 * Output: { rows: [...], csvText: string }
 * 100% independent — only imports from rc-config.js
 */

import {
  getRayConfig, parseUnit, fmtNum, computeLenAxis, vecMag, vecSub,
  lookupTeeBreln, lookupOletBrlen
} from './rc-config.js';

// ── CSV parser (zero external libs) ─────────────────────────────────────────

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const headers = splitCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cells = splitCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => { row[h.trim()] = (cells[idx] ?? '').trim(); });
    rows.push(row);
  }
  return { headers, rows };
}

function splitCSVLine(line) {
  const result = [];
  let cur = '', inQ = false;
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result;
}

// ── Column name resolver ─────────────────────────────────────────────────────

const COL = {
  sequence:  ['Sequence', 'Seq', 'SEQ'],
  nodeNo:    ['NodeNo', 'Node No', 'NODENO'],
  nodeName:  ['NodeName', 'Node Name', 'NODENAME'],
  compName:  ['componentName', 'Component Name', 'CompName'],
  type:      ['Type'],
  refNo:     ['RefNo', 'Ref No', 'REFNO'],
  point:     ['Point'],
  ppoint:    ['PPoint'],
  bore:      ['Bore', 'BORE'],
  od:        ['O/D', 'OD'],
  radius:    ['Radius', 'RADIUS'],
  material:  ['Material', 'MATERIAL'],
  rigid:     ['Rigid', 'RIGID'],
  east:      ['East', 'EAST'],
  north:     ['North', 'NORTH'],
  up:        ['Up', 'UP']
};

function resolveCol(row, aliases) {
  for (const a of aliases) if (a in row) return row[a];
  return '';
}

// ── Coordinate parser ────────────────────────────────────────────────────────

function parseCoord(row, cfg) {
  return {
    x: parseUnit(resolveCol(row, COL.east),  cfg),
    y: parseUnit(resolveCol(row, COL.north), cfg),
    z: parseUnit(resolveCol(row, COL.up),    cfg)
  };
}

// ── Strip = prefix from RefNo ────────────────────────────────────────────────

function cleanRefNo(raw) {
  return raw ? raw.replace(/^=/, '').trim() : '';
}

// ── Derive PIPELINE-REFERENCE from RefNo ─────────────────────────────────────

function derivePipelineRef(refNo, cfg) {
  if (!refNo) return '';
  // Strip component suffix (last _xxx segment)
  const base = refNo.replace(/_[^_]+$/, '');
  return `${cfg.pipelineRefPrefix} ${base}`;
}

// ── Compute BRLEN from BP and CP ─────────────────────────────────────────────

function computeBrlen(bp, cp) {
  if (!bp || !cp) return 0;
  const d = vecSub(bp, cp);
  return vecMag(d);
}

// ── Map canonical type → SKEY ────────────────────────────────────────────────

function resolveSkey(type, cfg) {
  return cfg.skeyMap[type] ?? '';
}

// ── 2D CSV header ─────────────────────────────────────────────────────────────

const CSV2D_HEADERS = [
  'CSV SEQ NO', 'Type', 'REF NO.', 'BORE', 'BRANCH BORE',
  'EP1 X', 'EP1 Y', 'EP1 Z',
  'EP2 X', 'EP2 Y', 'EP2 Z',
  'CP X', 'CP Y', 'CP Z',
  'BP X', 'BP Y', 'BP Z',
  'SUPPORT COOR X', 'SUPPORT COOR Y', 'SUPPORT COOR Z',
  'SUPPORT NAME', 'SUPPORT GUID',
  'SKEY',
  'LEN 1', 'AXIS 1', 'LEN 2', 'AXIS 2', 'LEN 3', 'AXIS 3',
  'BRLEN', 'PIPELINE-REFERENCE', 'CA97', 'CA98'
];

// ── Main Stage 1 function ────────────────────────────────────────────────────

/**
 * Parse raw CSV text → 2D component array + 2D CSV text.
 * @param {string} rawCsvText
 * @param {function} logFn  — debug log callback (stageId, event, refNo, data)
 * @returns {{ components: object[], csvText: string }}
 */
export function runStage1(rawCsvText, logFn = () => {}) {
  const cfg = getRayConfig();
  const { rows: rawRows } = parseCSV(rawCsvText);

  // ── Group raw rows by RefNo ─────────────────────────────────────────────
  const groups = new Map();
  const groupOrder = [];

  for (const row of rawRows) {
    const rawRef = resolveCol(row, COL.refNo);
    const key    = rawRef || `__NOREF_${resolveCol(row, COL.sequence)}`;

    if (!groups.has(key)) {
      groups.set(key, { rawRef, rows: [] });
      groupOrder.push(key);
    }
    groups.get(key).rows.push(row);
  }

  const components = [];

  for (const key of groupOrder) {
    const { rawRef, rows } = groups.get(key);
    const refNo       = cleanRefNo(rawRef);
    const firstRow    = rows[0];
    const rawType     = resolveCol(firstRow, COL.type).toUpperCase();
    const canonType   = cfg.typeMap[rawType] ?? rawType;
    const skey        = resolveSkey(canonType, cfg);
    const pipelineRef = derivePipelineRef(refNo, cfg);

    logFn('S1', 'row-grouped', refNo, { rawType, rowCount: rows.length });

    // ── Resolve points by Point column value ────────────────────────────
    const byPoint = {};
    for (const r of rows) {
      const pt = resolveCol(r, COL.point);
      byPoint[pt] = r;
    }

    // ── Parse bore from P=1 row (or first available) ──────────────────
    const boreRow    = byPoint['1'] ?? byPoint['0'] ?? firstRow;
    const bore       = parseUnit(resolveCol(boreRow, COL.bore), cfg);
    const od         = parseFloat(resolveCol(boreRow, COL.od)) || null;
    const radVal     = parseFloat(resolveCol(boreRow, COL.radius)) || 0;

    // ── Parse geometry by role ────────────────────────────────────────
    const ep1  = byPoint['1'] ? parseCoord(byPoint['1'], cfg) : null;
    const ep2  = byPoint['2'] ? parseCoord(byPoint['2'], cfg) : null;
    const cp   = byPoint['0'] ? parseCoord(byPoint['0'], cfg) : null;
    const bp   = byPoint['3'] ? parseCoord(byPoint['3'], cfg) : null;

    // Branch bore from P=3 row
    const branchBore = byPoint['3']
      ? parseUnit(resolveCol(byPoint['3'], COL.bore), cfg)
      : null;

    // ── NodeName → SUPPORT GUID ──────────────────────────────────────
    const nodeNameRow = byPoint['0'] ?? firstRow;
    const nodeName    = resolveCol(nodeNameRow, COL.nodeName) || '';
    const supportGuid = nodeName || '';

    // ── Rigid → START/END ────────────────────────────────────────────
    const rigidP1 = resolveCol(byPoint['1'] ?? firstRow, COL.rigid);
    const rigidP2 = resolveCol(byPoint['2'] ?? firstRow, COL.rigid);

    // ── LEN / AXIS from EP1→EP2 ──────────────────────────────────────
    const lenAxis = (ep1 && ep2) ? computeLenAxis(ep1, ep2, cfg) : {};

    // ── BRLEN ─────────────────────────────────────────────────────────
    let brlen = '';
    if (canonType === 'TEE' && cp && bp) {
      const brl = lookupTeeBreln(bore, branchBore ?? bore, cfg);
      brlen = brl != null ? fmtNum(brl, cfg) : fmtNum(computeBrlen(bp, cp), cfg);
    } else if (canonType === 'OLET' && cp && bp) {
      const brl = lookupOletBrlen(bore, branchBore ?? 50, cfg);
      brlen = brl != null ? fmtNum(brl, cfg) : fmtNum(computeBrlen(bp, cp), cfg);
    }

    // ── CA97, CA98 ───────────────────────────────────────────────────
    const ca97 = (canonType !== 'PIPE' && canonType !== 'SUPPORT' && refNo)
      ? `=${refNo}` : '';

    // ── Build component object ────────────────────────────────────────
    const comp = {
      seqNo:        components.length + 1,
      type:         canonType,
      refNo:        canonType !== 'PIPE' ? refNo : '',
      bore,
      branchBore:   branchBore ?? '',
      ep1, ep2, cp, bp,
      supportCoor:  canonType === 'SUPPORT' ? cp : null,
      supportName:  canonType === 'SUPPORT' ? cfg.supportName : '',
      supportGuid,
      skey,
      lenAxis,
      brlen,
      pipelineRef,
      ca97,
      // raw metadata
      od, radius: radVal, rigidP1, rigidP2, rawType, rawRef
    };

    components.push(comp);
    logFn('S1', 'component-built', refNo, { canonType, bore, ep1, ep2, cp, bp });
  }

  // ── Re-number seqNo ─────────────────────────────────────────────────────
  components.forEach((c, i) => { c.seqNo = i + 1; });

  // ── Emit 2D CSV text ─────────────────────────────────────────────────────
  const csvText = emit2DCSV(components, cfg);

  return { components, csvText };
}

// ── CSV emitter ──────────────────────────────────────────────────────────────

function fmtCell(v, cfg) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return fmtNum(v, cfg);
  return String(v);
}

function coordCell(pt, axis, cfg) {
  if (!pt) return '';
  const val = pt[axis];
  return isNaN(val) ? '' : fmtNum(val, cfg);
}

function emit2DCSV(components, cfg) {
  const lines = [CSV2D_HEADERS.join(',')];

  for (const c of components) {
    const la = c.lenAxis || {};
    const cells = [
      c.seqNo,
      c.type,
      c.refNo,
      isNaN(c.bore) ? '' : fmtNum(c.bore, cfg),
      (c.branchBore !== '' && !isNaN(c.branchBore)) ? fmtNum(Number(c.branchBore), cfg) : '',
      coordCell(c.ep1, 'x', cfg),
      coordCell(c.ep1, 'y', cfg),
      coordCell(c.ep1, 'z', cfg),
      coordCell(c.ep2, 'x', cfg),
      coordCell(c.ep2, 'y', cfg),
      coordCell(c.ep2, 'z', cfg),
      coordCell(c.cp,  'x', cfg),
      coordCell(c.cp,  'y', cfg),
      coordCell(c.cp,  'z', cfg),
      coordCell(c.bp,  'x', cfg),
      coordCell(c.bp,  'y', cfg),
      coordCell(c.bp,  'z', cfg),
      coordCell(c.supportCoor, 'x', cfg),
      coordCell(c.supportCoor, 'y', cfg),
      coordCell(c.supportCoor, 'z', cfg),
      c.supportName,
      c.supportGuid,
      c.skey,
      la.len1  ?? '', la.axis1 ?? '',
      la.len2  ?? '', la.axis2 ?? '',
      la.len3  ?? '', la.axis3 ?? '',
      c.brlen ?? '',
      c.pipelineRef,
      c.ca97,
      c.seqNo
    ];
    lines.push(cells.join(','));
  }

  return lines.join('\n');
}
