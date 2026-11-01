'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../src/core/validation');

const ctx = { today: '2026-11-01' };
const base = { systolic: '128', diastolic: '82', measurement_date: '2026-11-01', measurement_time: '07:30' };
const run = patch => V.validateMeasurement(Object.assign({}, base, patch), ctx);

test('Gültige Eingabe wird normalisiert', () => {
  const r = run({ pulse: '64', context_tags: ['stress'], notes: '  linker Arm ' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.value.systolic, 128);
  assert.equal(r.value.pulse, 64);
  assert.equal(r.value.notes, 'linker Arm');
  assert.equal(r.value.measurement_type, 'daily');
});

test('Pflichtfelder und Zahlenformat', () => {
  assert.equal(run({ systolic: '' }).errors[0].field, 'systolic');
  assert.equal(run({ diastolic: 'abc' }).errors[0].field, 'diastolic');
  assert.match(run({ systolic: '128.5' }).errors[0].message, /ganze Zahl/);
});

test('Technisch unplausible Werte werden abgelehnt', () => {
  assert.equal(run({ systolic: '400' }).errors[0].field, 'systolic');
  assert.equal(run({ diastolic: '10' }).errors[0].field, 'diastolic');
  assert.equal(run({ pulse: '300' }).errors[0].field, 'pulse');
  assert.match(run({ systolic: '80', diastolic: '120' }).errors[0].message, /vertauscht/);
});

test('Ungewöhnliche Werte erzeugen Warnungen statt Korrekturen', () => {
  const r = run({ systolic: '185', diastolic: '112' });
  assert.deepEqual(r.errors, []);
  assert.deepEqual(r.warnings.map(w => w.code).sort(), ['diastolic_high', 'systolic_high']);
  assert.equal(r.value.systolic, 185); // unverändert
  assert.ok(run({ systolic: '170', diastolic: '60' }).warnings.some(w => w.code === 'pulse_pressure_high'));
  assert.ok(run({ pulse: '35' }).warnings.some(w => w.code === 'pulse_low'));
});

test('Datum und Uhrzeit', () => {
  assert.match(run({ measurement_date: '2026-11-02' }).errors[0].message, /Zukunft/);
  assert.equal(run({ measurement_date: '2026-02-30' }).errors[0].field, 'measurement_date');
  assert.equal(run({ measurement_time: '25:00' }).errors[0].field, 'measurement_time');
  assert.deepEqual(run({ measurement_time: '' }).errors, []); // Uhrzeit unbekannt ist erlaubt
});

test('Nur bekannte Kontext- und Symptomschlüssel', () => {
  assert.equal(run({ context_tags: ['erfunden'] }).errors[0].field, 'context_tags');
  assert.equal(run({ symptoms: '["headache"]' }).errors.length, 0);
});
