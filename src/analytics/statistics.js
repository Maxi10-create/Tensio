'use strict';
/**
 * Reine Statistikfunktionen (keine Abhängigkeit von Apps Script).
 *
 * Alle Funktionen ignorieren Werte, die keine endlichen Zahlen sind
 * (null, undefined, NaN, Strings). Fehlende Werte werden NIE durch
 * künstliche Werte ersetzt. Ist keine Berechnung möglich, wird null geliefert.
 */

/** Filtert auf endliche Zahlen. */
function clean(values) {
  const out = [];
  for (let i = 0; i < (values || []).length; i++) {
    const v = values[i];
    if (typeof v === 'number' && isFinite(v)) out.push(v);
  }
  return out;
}

function sortedCopy(values) {
  return clean(values).sort((a, b) => a - b);
}

function count(values) {
  return clean(values).length;
}

function sum(values) {
  return clean(values).reduce((s, v) => s + v, 0);
}

function mean(values) {
  const v = clean(values);
  if (!v.length) return null;
  return sum(v) / v.length;
}

/**
 * Perzentil mit linearer Interpolation zwischen den nächsten Rängen
 * (Methode "R-7" / Excel PERCENTILE.INC). p in [0, 100].
 */
function percentile(values, p) {
  const v = sortedCopy(values);
  if (!v.length) return null;
  if (typeof p !== 'number' || p < 0 || p > 100) throw new RangeError('Perzentil muss zwischen 0 und 100 liegen');
  if (v.length === 1) return v[0];
  const h = (v.length - 1) * (p / 100);
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return v[lo] + (h - lo) * (v[hi] - v[lo]);
}

function median(values) {
  return percentile(values, 50);
}

function min(values) {
  const v = clean(values);
  return v.length ? Math.min.apply(null, v) : null;
}

function max(values) {
  const v = clean(values);
  return v.length ? Math.max.apply(null, v) : null;
}

/**
 * Stichproben-Standardabweichung (n − 1 im Nenner).
 * Für weniger als 2 Werte nicht definiert → null.
 */
function standardDeviation(values) {
  const v = clean(values);
  if (v.length < 2) return null;
  const m = mean(v);
  const ss = v.reduce((s, x) => s + (x - m) * (x - m), 0);
  return Math.sqrt(ss / (v.length - 1));
}

/** Variationskoeffizient in Prozent: SD / Mittelwert × 100. */
function coefficientOfVariation(values) {
  const sd = standardDeviation(values);
  const m = mean(values);
  if (sd === null || m === null || m === 0) return null;
  return (sd / m) * 100;
}

/** Rundet auf n Nachkommastellen; null bleibt null. */
function round(value, digits) {
  if (value === null || value === undefined || !isFinite(value)) return null;
  const f = Math.pow(10, digits || 0);
  return Math.round(value * f) / f;
}

/**
 * Zusammenfassung einer Werteserie. Gerundet auf eine Nachkommastelle,
 * damit Ergebnisse stabil und anzeigefertig sind.
 */
function summarize(values) {
  const v = clean(values);
  return {
    n: v.length,
    mean: round(mean(v), 1),
    median: round(median(v), 1),
    min: min(v),
    max: max(v),
    sd: round(standardDeviation(v), 1),
    cv: round(coefficientOfVariation(v), 1),
    p10: round(percentile(v, 10), 1),
    p90: round(percentile(v, 90), 1)
  };
}

module.exports = {
  clean,
  count,
  sum,
  mean,
  median,
  percentile,
  min,
  max,
  standardDeviation,
  coefficientOfVariation,
  round,
  summarize
};
