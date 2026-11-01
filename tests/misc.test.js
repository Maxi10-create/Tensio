'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');
const Refs = require('../src/analytics/medicalReferences');
const Exporter = require('../src/core/exporter');

test('Referenzwerte: Kategorien für Mittelwerte je Leitlinie und Methode', () => {
  assert.equal(Refs.categorize('esc-2024', 'home', 118, 68).key, 'non_elevated');
  assert.equal(Refs.categorize('esc-2024', 'home', 128, 72).key, 'elevated');
  assert.equal(Refs.categorize('esc-2024', 'home', 128, 86).key, 'hypertension'); // höhere Kategorie zählt
  assert.equal(Refs.categorize('esh-2023', 'home', 134, 84).key, 'below');
  assert.equal(Refs.categorize('esh-2023', 'home', 135, 70).key, 'at_or_above');
  assert.equal(Refs.categorize('esh-2023', 'office', 145, 85).key, 'grade1');
  assert.equal(Refs.categorize('esh-2023', 'office', 185, 85).key, 'grade3');
  assert.equal(Refs.categorize('esc-2024', 'home', null, 80), null);
  assert.deepEqual(Refs.referenceLines('esh-2023', 'office'), { guideline: 'ESH 2023', method: 'Praxismessung', systolic: 140, diastolic: 90 });
});

test('CSV-Export: Zeitraum, Escaping, Formel-Schutz, keine gelöschten', () => {
  const rows = [
    { id: 'a', measurement_date: '2026-10-01', measurement_time: '07:00', systolic: 120, diastolic: 80, pulse: 60, measurement_type: 'daily', context_tags: ['stress'], symptoms: [], notes: '=HYPERLINK("x")', is_valid: true, source: 'app', created_at: '', updated_at: '', deleted_at: '' },
    { id: 'b', measurement_date: '2026-10-05', measurement_time: '', systolic: 130, diastolic: 85, pulse: null, measurement_type: 'daily', context_tags: [], symptoms: ['headache'], notes: 'a;b\nc', is_valid: true, source: 'historical_import', created_at: '', updated_at: '', deleted_at: '' },
    { id: 'c', measurement_date: '2026-10-06', measurement_time: '', systolic: 140, diastolic: 90, pulse: null, context_tags: [], symptoms: [], notes: '', deleted_at: '2026-10-07' }
  ];
  const csv = Exporter.measurementsToCsv(rows, { bom: false });
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'id;datum;uhrzeit;systolisch;diastolisch;puls;messart;kontext;symptome;notiz;gueltig;quelle;erstellt;geaendert');
  assert.equal(lines.length, 3);
  assert.ok(lines[1].includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(lines[1].includes(';Stress;'));
  assert.ok(csv.includes('"a;b\nc"'));
  assert.ok(lines[2].includes('Kopfschmerzen'));
  assert.ok(!csv.includes('140'));
  const ranged = Exporter.measurementsToCsv(rows, { from: '2026-10-02', bom: false });
  assert.equal(ranged.trim().split('\r\n').length, 2);
  assert.ok(Exporter.measurementsToCsv([], {}).startsWith('﻿'));
});

test('CSV-Export über die API enthält keine Profildaten', () => {
  const t = setup();
  t.call('saveProfile', { birth_year: 1960, relevant_conditions: 'Diabetes' });
  t.call('createMeasurement', { input: { systolic: 120, diastolic: 80, measurement_date: '2026-10-31', measurement_time: '07:00' } });
  const r = t.call('exportMeasurementsCsv', {});
  assert.match(r.filename, /^tensio-messungen_2026-11-01\.csv$/);
  assert.ok(!r.csv.includes('1960') && !r.csv.includes('Diabetes'));
  assert.equal(t.raw('exportMeasurementsCsv', { from: 'gestern' }).error.code, 'VALIDATION');
});

test('Profil: alles optional, Validierung', () => {
  const t = setup();
  assert.equal(t.call('bootstrap').profile.birth_year, null);
  const p = t.call('saveProfile', { birth_year: '1958', sex: 'male', height_cm: '' });
  assert.equal(p.birth_year, 1958);
  assert.equal(p.height_cm, null);
  assert.equal(t.raw('saveProfile', { birth_year: '3000' }).error.code, 'VALIDATION');
  assert.equal(t.raw('saveProfile', { sex: 'x' }).error.code, 'VALIDATION');
});

test('Einstellungen: Zeitzone wirkt auf „heute“ und Offsets', () => {
  const t = setup({ now: '2026-11-01T23:30:00Z' });
  assert.equal(t.call('bootstrap').today, '2026-11-02'); // Berlin
  t.call('saveSettings', { timezone: 'America/New_York' });
  assert.equal(t.call('bootstrap').today, '2026-11-01');
  const r = t.call('createMeasurement', { input: { systolic: 120, diastolic: 80, measurement_date: '2026-11-01', measurement_time: '18:00' } });
  assert.equal(r.measured_at, '2026-11-01T18:00:00-05:00');
  assert.equal(t.raw('saveSettings', { timezone: 'Mars/Olympus' }).error.code, 'VALIDATION');
  assert.equal(t.raw('saveSettings', { theme: 'neon' }).error.code, 'VALIDATION');
});
