'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, T } = require('./helpers');

function seeded() {
  const t = setup();
  const zone = T.Dates.createZone('Europe/Berlin');
  T.DemoData.generateDemoMeasurements({ today: '2026-11-01', zone, seed: 7 }).forEach(r => t.repo.insert('Measurements', r));
  return t;
}

test('Dashboard: letzte Messung, 7-/30-Tage-Mittel, Chartdaten', () => {
  const t = seeded();
  const d = t.call('getDashboard', { period: '30d' });
  assert.ok(d.latest);
  assert.ok(d.latest.date <= '2026-11-01');
  assert.equal(d.avg7.windowDays, 7);
  assert.equal(d.avg30.windowDays, 30);
  assert.ok(d.avg30.daysWithData > 15);
  assert.equal(d.chart.from, '2026-10-03');
  assert.ok(d.chart.points.every(p => p.date >= '2026-10-03'));
  assert.ok(d.chart.ma7.length > 0);
  assert.deepEqual([d.reference.systolic, d.reference.diastolic], [135, 85]);
});

test('Dashboard ohne Daten', () => {
  const t = setup();
  const d = t.call('getDashboard', { period: '7d' });
  assert.equal(d.latest, null);
  assert.equal(d.avg7.systolic, null);
  assert.equal(d.chart.points.length, 0);
});

test('Analyse: Kennzahlen auf Tagesmittel-Basis, Monatsmittel, Einordnung', () => {
  const t = seeded();
  const a = t.call('getAnalytics', { period: '1y' });
  assert.equal(a.basis, 'daily_means');
  assert.equal(a.systolic.n, a.daysWithData);
  assert.ok(a.systolic.p10 <= a.systolic.median && a.systolic.median <= a.systolic.p90);
  assert.ok(a.monthly.length >= 12);
  assert.ok(a.meanCategory && a.meanCategory.guideline === 'ESC 2024');
  assert.ok(t.call('getAnalytics', { period: 'all' }).daysWithData > a.daysWithData);
});

test('Performance: 5.000 Messungen in vertretbarer Zeit', () => {
  const t = setup();
  const zone = T.Dates.createZone('Europe/Berlin');
  const recs = T.DemoData.generateDemoMeasurements({ today: '2026-11-01', zone, days: 3650, historicalDays: 0, seed: 3 });
  // auf ≥ 5000 auffüllen (zweite Messung am Tag)
  let i = 0;
  while (recs.length < 5000) {
    const r = Object.assign({}, recs[i++], { id: 'extra-' + i, measured_at: '' });
    recs.push(r);
  }
  recs.forEach(r => t.repo.insert('Measurements', r));
  const start = Date.now();
  t.call('getDashboard', { period: 'all' });
  t.call('getAnalytics', { period: 'all' });
  t.call('listMeasurements');
  assert.ok(Date.now() - start < 3000, 'zu langsam: ' + (Date.now() - start) + ' ms');
});
