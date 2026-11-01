'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../src/core/dates');

test('Datumsvalidierung', () => {
  assert.ok(D.isValidDateString('2024-02-29'));
  assert.ok(!D.isValidDateString('2023-02-29'));
  assert.ok(!D.isValidDateString('2026-13-01'));
  assert.ok(!D.isValidDateString('1.11.2026'));
  assert.ok(D.isValidTimeString('07:05'));
  assert.ok(!D.isValidTimeString('24:00'));
});

test('Tagesarithmetik ist sommerzeitfest', () => {
  assert.equal(D.addDays('2026-03-28', 1), '2026-03-29');
  assert.equal(D.addDays('2026-03-29', 1), '2026-03-30');
  assert.equal(D.addDays('2026-10-25', 1), '2026-10-26');
  assert.equal(D.daysBetween('2026-01-01', '2026-12-31'), 364);
});

test('ISO-Wochen an Jahresgrenzen', () => {
  assert.equal(D.isoWeekKey('2026-01-01'), '2026-W01'); // Donnerstag
  assert.equal(D.isoWeekKey('2027-01-01'), '2026-W53'); // Freitag
  assert.equal(D.isoWeekKey('2024-12-30'), '2025-W01'); // Montag
  assert.equal(D.quarterKey('2026-11-01'), '2026-Q4');
});

test('Zeitzonenwechsel: korrekter Offset bei Sommer-/Winterzeit', () => {
  const z = D.createZone('Europe/Berlin');
  assert.equal(z.toIso('2026-03-29', '01:30'), '2026-03-29T01:30:00+01:00');
  assert.equal(z.toIso('2026-03-29', '03:30'), '2026-03-29T03:30:00+02:00');
  assert.equal(z.toIso('2026-10-25', '04:00'), '2026-10-25T04:00:00+01:00');
  assert.equal(z.toIso('2026-07-01', '12:00'), '2026-07-01T12:00:00+02:00');
  assert.equal(z.toIso('2026-07-01', ''), '');
});

test('Lokales Datum hängt von der Zeitzone ab (Datumsgrenze)', () => {
  const ms = Date.parse('2026-11-01T23:30:00Z');
  assert.equal(D.createZone('Europe/Berlin').today(ms), '2026-11-02');
  assert.equal(D.createZone('America/New_York').today(ms), '2026-11-01');
  assert.equal(D.createZone('UTC').local(ms).time, '23:30');
});
