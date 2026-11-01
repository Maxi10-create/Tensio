'use strict';
/**
 * Aggregationen von Blutdruckmessungen.
 *
 * Methodik (siehe docs/medical-logic.md):
 *  1. Nur gültige, nicht gelöschte Messungen werden berücksichtigt.
 *  2. Pro Kalendertag (measurement_date, lokales Datum) wird zuerst ein
 *     Tagesmittel gebildet. Tage mit vielen Messungen werden dadurch nicht
 *     stärker gewichtet als Tage mit einer Messung.
 *  3. Wochen-, Monats-, Quartals-, Jahres- und Fenstermittel sind Mittelwerte
 *     der Tagesmittel.
 *  4. Tage ohne Messung erzeugen keine Werte (keine Interpolation).
 */
const S = require('./statistics');
const D = require('../core/dates');

/** true, wenn eine Messung in Analysen einfließen darf. */
function isAnalyzable(m) {
  if (!m) return false;
  if (m.deleted_at) return false;
  if (m.is_valid === false) return false;
  return typeof m.systolic === 'number' && typeof m.diastolic === 'number' && D.isValidDateString(m.measurement_date);
}

function analyzable(measurements) {
  return (measurements || []).filter(isAnalyzable);
}

/**
 * Tagesmittel. Ergebnis aufsteigend nach Datum:
 * [{ date, systolic, diastolic, pulse|null, n, nPulse, ids }]
 */
function dailyMeans(measurements) {
  const byDate = {};
  analyzable(measurements).forEach(m => {
    const g = byDate[m.measurement_date] || (byDate[m.measurement_date] = { sys: [], dia: [], pulse: [], ids: [] });
    g.sys.push(m.systolic);
    g.dia.push(m.diastolic);
    if (typeof m.pulse === 'number') g.pulse.push(m.pulse);
    g.ids.push(m.id);
  });
  return Object.keys(byDate).sort().map(date => {
    const g = byDate[date];
    return {
      date: date,
      systolic: S.mean(g.sys),
      diastolic: S.mean(g.dia),
      pulse: S.mean(g.pulse),
      n: g.sys.length,
      nPulse: g.pulse.length,
      ids: g.ids
    };
  });
}

/** Filtert Tageswerte auf [from, to] (inklusive). Leere Grenze = offen. */
function filterDays(days, from, to) {
  return days.filter(d => (!from || d.date >= from) && (!to || d.date <= to));
}

function summarizeDays(days, from, to) {
  const span = from && to ? D.daysBetween(from, to) + 1 : null;
  const n = days.reduce((s, d) => s + d.n, 0);
  return {
    from: from || (days[0] && days[0].date) || null,
    to: to || (days.length && days[days.length - 1].date) || null,
    daysWithData: days.length,
    windowDays: span,
    coverage: span ? S.round(days.length / span, 3) : null,
    nMeasurements: n,
    systolic: S.mean(days.map(d => d.systolic)),
    diastolic: S.mean(days.map(d => d.diastolic)),
    pulse: S.mean(days.map(d => d.pulse))
  };
}

/**
 * Zusammenfassung eines Zeitfensters von `windowDays` Kalendertagen,
 * das am Tag `endDate` (inklusive) endet.
 */
function windowSummary(days, endDate, windowDays) {
  const from = D.addDays(endDate, -(windowDays - 1));
  return summarizeDays(filterDays(days, from, endDate), from, endDate);
}

/** Gruppiert Tageswerte nach Schlüssel (Woche/Monat/Quartal/Jahr). */
function aggregateBy(days, keyFn) {
  const groups = {};
  const order = [];
  days.forEach(d => {
    const k = keyFn(d.date);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(d);
  });
  return order.sort().map(k => {
    const g = groups[k];
    const s = summarizeDays(g, g[0].date, g[g.length - 1].date);
    return {
      key: k,
      from: g[0].date,
      to: g[g.length - 1].date,
      daysWithData: g.length,
      nMeasurements: s.nMeasurements,
      systolic: s.systolic,
      diastolic: s.diastolic,
      pulse: s.pulse
    };
  });
}

const weekly = days => aggregateBy(days, D.isoWeekKey);
const monthly = days => aggregateBy(days, D.monthKey);
const quarterly = days => aggregateBy(days, D.quarterKey);
const yearly = days => aggregateBy(days, D.yearKey);

/**
 * Gleitendes Mittel über `windowDays` Kalendertage (nachlaufend, inkl. Tag selbst).
 * Ein Wert wird nur für Tage mit eigener Messung berechnet und nur, wenn im
 * Fenster mindestens `minDays` Tage mit Messungen liegen. Lücken bleiben Lücken.
 */
function movingAverage(days, windowDays, minDays) {
  const need = minDays || Math.ceil(windowDays / 2);
  const nums = days.map(d => D.toDayNumber(d.date));
  const out = [];
  let start = 0;
  for (let i = 0; i < days.length; i++) {
    while (nums[i] - nums[start] >= windowDays) start++;
    const slice = days.slice(start, i + 1);
    if (slice.length >= need) {
      out.push({
        date: days[i].date,
        systolic: S.mean(slice.map(d => d.systolic)),
        diastolic: S.mean(slice.map(d => d.diastolic)),
        daysInWindow: slice.length
      });
    }
  }
  return out;
}

module.exports = {
  isAnalyzable,
  analyzable,
  dailyMeans,
  filterDays,
  summarizeDays,
  windowSummary,
  aggregateBy,
  weekly,
  monthly,
  quarterly,
  yearly,
  movingAverage
};
