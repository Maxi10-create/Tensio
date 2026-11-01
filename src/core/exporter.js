'use strict';
/**
 * CSV-Export. Enthält keine Patienten-Stammdaten (Datenminimierung).
 * Trennzeichen ';' und UTF-8-BOM für reibungsloses Öffnen in Excel/Numbers (DE).
 * Zellen, die mit = + - @ beginnen, werden gegen Formel-Injection mit ' maskiert.
 */
const Schema = require('./schema');

const COLUMNS = [
  ['id', 'id'],
  ['datum', 'measurement_date'],
  ['uhrzeit', 'measurement_time'],
  ['systolisch', 'systolic'],
  ['diastolisch', 'diastolic'],
  ['puls', 'pulse'],
  ['messart', 'measurement_type'],
  ['kontext', 'context_tags'],
  ['symptome', 'symptoms'],
  ['notiz', 'notes'],
  ['gueltig', 'is_valid'],
  ['quelle', 'source'],
  ['erstellt', 'created_at'],
  ['geaendert', 'updated_at']
];

function labelFor(list, key) {
  const f = list.filter(x => x.key === key)[0];
  return f ? f.label : key;
}

function cell(v) {
  if (v === null || v === undefined) return '';
  let s = typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v);
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * @param {Array} measurements Anzeigeform (gelöschte werden nie exportiert)
 * @param {object} opts { from?, to?, bom? }
 */
function measurementsToCsv(measurements, opts) {
  const o = opts || {};
  const rows = measurements
    .filter(m => !m.deleted_at)
    .filter(m => (!o.from || m.measurement_date >= o.from) && (!o.to || m.measurement_date <= o.to))
    .slice()
    .sort((a, b) => ((a.measurement_date + (a.measurement_time || '')) < (b.measurement_date + (b.measurement_time || '')) ? -1 : 1));
  const lines = [COLUMNS.map(c => c[0]).join(';')];
  rows.forEach(m => {
    lines.push(COLUMNS.map(c => {
      let v = m[c[1]];
      if (c[1] === 'context_tags') v = (v || []).map(k => labelFor(Schema.CONTEXT_TAGS, k)).join(', ');
      if (c[1] === 'symptoms') v = (v || []).map(k => labelFor(Schema.SYMPTOMS, k)).join(', ');
      return cell(v);
    }).join(';'));
  });
  return (o.bom === false ? '' : '﻿') + lines.join('\r\n') + '\r\n';
}

module.exports = { COLUMNS, cell, measurementsToCsv };
