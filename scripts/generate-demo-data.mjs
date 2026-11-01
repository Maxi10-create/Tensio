/**
 * Erzeugt samples/demo-measurements.csv – FIKTIVE Messungen im Spaltenformat
 * des Tabellenblatts „Measurements“ (direkt importierbar, Komma-getrennt).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const Schema = require('../src/core/schema.js');
const Dates = require('../src/core/dates.js');
const { generateDemoMeasurements } = require('../src/core/demoData.js');

const today = process.argv[2] || '2026-10-31';
const zone = Dates.createZone('Europe/Berlin');
const rows = generateDemoMeasurements({ today, zone });
const cols = Schema.columnNames('Measurements');
const cell = (v, type) => {
  if (v === null || v === undefined) return '';
  const s = type === 'json' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const lines = [cols.join(',')].concat(rows.map(r => cols.map(c => cell(r[c], Schema.SHEETS.Measurements.columns[c])).join(',')));
const out = path.join(root, 'samples/demo-measurements.csv');
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`${rows.length} fiktive Messungen → ${path.relative(root, out)}`);
