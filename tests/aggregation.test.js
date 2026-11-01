'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/analytics/aggregation');
const T = require('../src/analytics/trends');
const { m } = require('./helpers');

test('Mehrere Messungen am selben Tag → Tagesmittel', () => {
  const days = A.dailyMeans([m('2026-10-01', 130, 80), m('2026-10-01', 120, 70, { id: 'b' }), m('2026-10-02', 140, 90)]);
  assert.equal(days.length, 2);
  assert.equal(days[0].systolic, 125);
  assert.equal(days[0].diastolic, 75);
  assert.equal(days[0].n, 2);
});

test('Tagesmittel gewichten Tage gleich, unabhängig von der Messanzahl', () => {
  const data = [m('2026-10-01', 160, 100), m('2026-10-02', 120, 80, { id: 'a' }), m('2026-10-02', 120, 80, { id: 'b' }), m('2026-10-02', 120, 80, { id: 'c' })];
  const s = A.windowSummary(A.dailyMeans(data), '2026-10-02', 2);
  assert.equal(s.systolic, 140); // nicht (160+3×120)/4 = 130
  assert.equal(s.nMeasurements, 4);
});

test('Gelöschte und ungültige Messungen werden ausgeschlossen', () => {
  const days = A.dailyMeans([
    m('2026-10-01', 130, 80),
    m('2026-10-01', 200, 120, { id: 'x', deleted_at: '2026-10-02T00:00:00Z' }),
    m('2026-10-01', 90, 50, { id: 'y', is_valid: false })
  ]);
  assert.equal(days[0].systolic, 130);
  assert.equal(days[0].n, 1);
});

test('Historische Messungen ohne Uhrzeit fließen ein', () => {
  const days = A.dailyMeans([m('2023-05-01', 140, 90, { measurement_time: '', measured_at: '' })]);
  assert.equal(days.length, 1);
  assert.equal(days[0].date, '2023-05-01');
});

test('Fehlende Tage erzeugen keine künstlichen Werte', () => {
  const days = A.dailyMeans([m('2026-10-01', 130, 80), m('2026-10-10', 120, 70)]);
  assert.equal(days.length, 2);
  const s = A.windowSummary(days, '2026-10-10', 10);
  assert.equal(s.daysWithData, 2);
  assert.equal(s.windowDays, 10);
  assert.equal(s.coverage, 0.2);
});

test('Monats- und Jahresaggregation auf Basis der Tagesmittel', () => {
  const data = [m('2025-12-30', 140, 90), m('2026-01-02', 130, 80), m('2026-01-03', 120, 70), m('2026-02-01', 110, 60)];
  const days = A.dailyMeans(data);
  const months = A.monthly(days);
  assert.deepEqual(months.map(x => x.key), ['2025-12', '2026-01', '2026-02']);
  assert.equal(months[1].systolic, 125);
  assert.equal(months[1].daysWithData, 2);
  const years = A.yearly(days);
  assert.deepEqual(years.map(y => [y.key, y.systolic]), [['2025', 140], ['2026', 120]]);
  assert.equal(A.weekly(days)[0].key, '2026-W01');
  assert.equal(A.quarterly(days).length, 2);
});

test('Gleitendes Mittel: Kalenderfenster, Mindestanzahl Tage, keine Werte über Lücken', () => {
  const data = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-20'].map((d, i) => m(d, 120 + i * 2, 80));
  const ma = A.movingAverage(A.dailyMeans(data), 7, 3);
  assert.deepEqual(ma.map(p => p.date), ['2026-10-03', '2026-10-04']);
  assert.equal(ma[0].systolic, 122); // (120+122+124)/3
  assert.equal(ma[1].daysInWindow, 4);
  const ma30 = A.movingAverage(A.dailyMeans(data), 30, 5);
  assert.deepEqual(ma30.map(p => p.date), ['2026-10-20']);
  assert.equal(A.movingAverage(A.dailyMeans(data), 90).length, 0); // Standard: Hälfte des Fensters
});

test('Periodenvergleich nur bei ausreichender Datenmenge', () => {
  const data = [];
  for (let i = 0; i < 60; i++) {
    const d = require('../src/core/dates').addDays('2026-09-02', i);
    data.push(m(d, i < 30 ? 130 : 126, i < 30 ? 85 : 82));
  }
  const c = T.comparePeriods(A.dailyMeans(data), '2026-10-31', 30);
  assert.equal(c.sufficient, true);
  assert.deepEqual(c.delta, { systolic: -4, diastolic: -3 });
  const sparse = T.comparePeriods(A.dailyMeans(data.slice(55)), '2026-10-31', 30);
  assert.equal(sparse.sufficient, false);
  assert.equal(sparse.delta, null);
});

test('Lineare Regression', () => {
  const r = T.linearRegression([{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }]);
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 1);
  assert.equal(T.linearRegression([{ x: 1, y: 1 }]), null);
});
