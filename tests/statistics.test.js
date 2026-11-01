'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../src/analytics/statistics');

test('Mittelwert ignoriert fehlende Werte', () => {
  assert.equal(S.mean([120, 130, null, undefined, NaN, 140]), 130);
  assert.equal(S.mean([]), null);
});

test('Median bei gerader und ungerader Anzahl', () => {
  assert.equal(S.median([3, 1, 2]), 2);
  assert.equal(S.median([4, 1, 3, 2]), 2.5);
  assert.equal(S.median([]), null);
});

test('Stichproben-Standardabweichung (n − 1)', () => {
  // Werte 2,4,4,4,5,5,7,9: Populations-SD = 2, Stichproben-SD = sqrt(32/7)
  assert.ok(Math.abs(S.standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]) - Math.sqrt(32 / 7)) < 1e-12);
  assert.equal(S.standardDeviation([120]), null);
});

test('Variationskoeffizient in Prozent', () => {
  const v = [110, 120, 130];
  assert.ok(Math.abs(S.coefficientOfVariation(v) - (10 / 120) * 100) < 1e-12);
  assert.equal(S.coefficientOfVariation([0, 0]), null);
});

test('Perzentile mit linearer Interpolation (R-7)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.ok(Math.abs(S.percentile(v, 10) - 1.9) < 1e-12);
  assert.ok(Math.abs(S.percentile(v, 90) - 9.1) < 1e-12);
  assert.equal(S.percentile(v, 0), 1);
  assert.equal(S.percentile(v, 100), 10);
  assert.equal(S.percentile([42], 90), 42);
  assert.throws(() => S.percentile(v, 101), RangeError);
});

test('Zusammenfassung enthält alle Kennzahlen', () => {
  const s = S.summarize([118, 122, 125, 131, 140]);
  assert.deepEqual(Object.keys(s).sort(), ['cv', 'max', 'mean', 'median', 'min', 'n', 'p10', 'p90', 'sd'].sort());
  assert.equal(s.n, 5);
  assert.equal(s.mean, 127.2);
  assert.equal(s.min, 118);
  assert.equal(s.max, 140);
});
