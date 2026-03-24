/**
 * components/support.js — Write SUPPORT PCF block
 * CO-ORDS only (4 tokens). NO CA attributes.
 * <SUPPORT_NAME> from Restraint Type column.
 * <SUPPORT_GUID> from NodeName column with UCI: prefix.
 */
import { fmtPointToken } from '../../geometry/coord-engine.js';
import { buildMsgSquare } from '../message-square.js';
import { warn } from '../../logger.js';

const INDENT = '    ';

export const writeSupport = (group, config) => {
  const { pts, refno } = group;
  const rule = config.pcfRules['SUPPORT'];
  const coords = pts['0'];
  const primary = pts['0'] ?? Object.values(pts)[0] ?? {};
  const dp = config.outputSettings?.decimalPlaces ?? 3;

  if (!coords) {
    warn('support', 'writeSupport', 'Missing COORDS point (Point=0) for SUPPORT', {
      refno, hint: 'ANCI component needs Point=0 row in CSV',
    });
    return [];
  }

  const supportName = primary.restraintType || '';
  const nodeName = primary.nodeName || '';

  if (!supportName) {
    warn('support', 'writeSupport', 'SUPPORT has no restraint type', {
      refno, hint: 'Fill "Restraint Type" column in CSV for ANCI components',
    });
  }
  if (!nodeName) {
    warn('support', 'writeSupport', 'SUPPORT has no NodeName for GUID', {
      refno, hint: 'Fill "NodeName" column in CSV for ANCI components',
    });
  }

  const lines = [
    ...buildMsgSquare(pts, 'SUPPORT', { ...config, refno: group.refno }),
    'SUPPORT',
    `${INDENT}CO-ORDS  ${fmtPointToken(coords, coords.bore, dp, 4)}`,
  ];

  // Support rules mapping logic
  const supportRules = config.coordinateSettings?.supportSettings?.nameRules || {};
  let derivedSupportName = supportRules.fallback || 'CA150';

  const friction = String(primary['Restraint Friction'] || '').trim();
  const gap = String(primary['Restraint Gap'] || '').trim();
  const restTypeUpper = String(supportName).toUpperCase();

  // Block 1 Logic
  const isBlock1 = friction === '' || friction === 'NULL' || friction === '0.3';
  const isGapEmpty = gap === '' || gap === 'NULL';

  if (isBlock1 && isGapEmpty) {
    if (restTypeUpper.includes('LIM') && restTypeUpper.includes('GUI')) derivedSupportName = 'TBA';
    else if (restTypeUpper.includes('LIM')) derivedSupportName = 'TBA';
    else if (restTypeUpper.includes('GUI')) derivedSupportName = 'VG100';
    else if (restTypeUpper.includes('REST')) derivedSupportName = 'CA150';
  } else if (friction === '0.15') {
    // Block 2 Logic
    if (restTypeUpper.includes('LIM') && restTypeUpper.includes('GUI')) derivedSupportName = 'TBA';
    else if (restTypeUpper.includes('LIM')) derivedSupportName = 'TBA';
    else if (restTypeUpper.includes('GUI')) derivedSupportName = 'TBA';
    else if (restTypeUpper.includes('REST')) derivedSupportName = 'CA150';
    else if (restTypeUpper.includes('DATUM')) derivedSupportName = 'CA150';
  }

  // Extract SeqNo for traceability (same pattern as pipe.js)
  const seqNo = String(group.rows?.[0]?.['Seq No.'] || group.rows?.[0]?.Sequence || group.rows?.[0]?.Seq || group.rows?.[0]?.SeqNo || '-').trim();

  // Ensure bore fallback if 0
  const bore = (coords.bore && coords.bore > 0) ? coords.bore : (group.rows?.[0]?.Bore ?? 0);

  const cleanRef = String(group.refno || '').replace(/^=+/, '');

  // Re-write lines. Add MESSAGE-SQUARE so data table can extract RefNo + SeqNo.
  const finalLines = [
    'MESSAGE-SQUARE',
    `    SUPPORT, ${derivedSupportName}, RefNo:=${cleanRef}${seqNo && seqNo !== '-' ? `, SeqNo:${seqNo}` : ''}`,
    'SUPPORT',
    `${INDENT}CO-ORDS  ${fmtPointToken(coords, bore, dp, 4)}`,
    `${INDENT}COMPONENT-ATTRIBUTE97  ${group.refno}`,
    `${INDENT}<SUPPORT_NAME> ${derivedSupportName}`
  ];

  if (nodeName) finalLines.push(`${INDENT}<SUPPORT_GUID> UCI:${nodeName}`);

  // NO CA attributes on SUPPORT — confirmed from validated PCF

  return finalLines;
};
