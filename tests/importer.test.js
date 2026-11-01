'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Importer = require('../src/core/importer');

test('Datum im deutschen und ISO-Format wird erkannt', () => {
  assert.equal(Importer.parseDate('14.03.2025'), '2025-03-14');
  assert.equal(Importer.parseDate('2025-03-14'), '2025-03-14');
  assert.equal(Importer.parseDate('5.3.2025'), '2025-03-05');
});

test('Ungültige Daten werden abgelehnt', () => {
  assert.equal(Importer.parseDate('31.02.2025'), null);
  assert.equal(Importer.parseDate('2025/03/14'), null);
  assert.equal(Importer.parseDate(''), null);
});

test('Zeile wird vollständig übernommen', () => {
  const r = Importer.parseImportRow({ date: '14.03.2025', time: '7:30', systolic: '128', diastolic: '82', pulse: '64', notes: ' morgens ' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.input, { measurement_date: '2025-03-14', measurement_time: '07:30', systolic: 128, diastolic: 82, pulse: 64, notes: 'morgens', source: 'import' });
});

test('Puls und Uhrzeit dürfen leer sein', () => {
  const r = Importer.parseImportRow({ date: '2025-03-14', time: '', systolic: 130, diastolic: 85, pulse: '' });
  assert.equal(r.ok, true);
  assert.equal(r.input.pulse, null);
  assert.equal(r.input.measurement_time, '');
});

test('Fehlerhafte Zeilen liefern eine Meldung', () => {
  assert.match(Importer.parseImportRow({ date: '14.03.2025', systolic: '', diastolic: 80 }).error, /Systolisch/);
  assert.match(Importer.parseImportRow({ date: '14.03.2025', systolic: '12,5', diastolic: 80 }).error, /Systolisch/);
  assert.match(Importer.parseImportRow({ date: '14.03.2025', time: '25:00', systolic: 120, diastolic: 80 }).error, /Uhrzeit/);
});
