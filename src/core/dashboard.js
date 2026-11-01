'use strict';
/**
 * Stellt die Daten für Übersicht und Analyse zusammen.
 * Reine Funktionen: Eingabe = Messungen (Anzeigeform) + Kontext.
 */
const S = require('../analytics/statistics');
const A = require('../analytics/aggregation');
const T = require('../analytics/trends');
const Refs = require('../analytics/medicalReferences');
const Schema = require('./schema');
const Dates = require('./dates');

function roundSummary(s) {
  return Object.assign({}, s, {
    systolic: S.round(s.systolic, 0),
    diastolic: S.round(s.diastolic, 0),
    pulse: S.round(s.pulse, 0)
  });
}

/** Beginn eines Zeitraums ('30d', '1y', 'all', …) relativ zu `today`. */
function periodStart(period, today, firstDate) {
  const days = Schema.CHART_PERIODS[period];
  if (days === undefined) throw new Error('Unbekannter Zeitraum: ' + period);
  if (days === null) return firstDate || today;
  return Dates.addDays(today, -(days - 1));
}

/**
 * @param {Array} measurements  Messungen in Anzeigeform (ohne gelöschte)
 * @param {object} ctx { today, period, guideline }
 */
function buildDashboard(measurements, ctx) {
  const today = ctx.today;
  const period = ctx.period || '30d';
  const valid = A.analyzable(measurements);
  const days = A.dailyMeans(valid);
  const from = periodStart(period, today, days.length ? days[0].date : null);

  const sorted = valid.slice().sort((a, b) => {
    if (a.measurement_date !== b.measurement_date) return a.measurement_date < b.measurement_date ? 1 : -1;
    return (a.measurement_time || '') < (b.measurement_time || '') ? 1 : -1;
  });
  const last = sorted[0] || null;

  const ma7 = A.movingAverage(days, 7, 3).filter(p => p.date >= from);
  const points = valid
    .filter(m => m.measurement_date >= from && m.measurement_date <= today)
    .map(m => ({
      id: m.id,
      date: m.measurement_date,
      time: m.measurement_time || '',
      systolic: m.systolic,
      diastolic: m.diastolic,
      pulse: m.pulse
    }))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));

  const comparison = T.comparePeriods(days, today, 30);

  return {
    today: today,
    period: period,
    totals: { measurements: valid.length, days: days.length, firstDate: days.length ? days[0].date : null },
    latest: last ? {
      id: last.id,
      date: last.measurement_date,
      time: last.measurement_time || '',
      systolic: last.systolic,
      diastolic: last.diastolic,
      pulse: last.pulse,
      flags: last.flags || []
    } : null,
    avg7: roundSummary(A.windowSummary(days, today, 7)),
    avg30: roundSummary(A.windowSummary(days, today, 30)),
    comparison30: comparison,
    chart: {
      from: from,
      to: today,
      points: points,
      daily: A.filterDays(days, from, today).map(d => ({
        date: d.date, systolic: S.round(d.systolic, 1), diastolic: S.round(d.diastolic, 1), n: d.n
      })),
      ma7: ma7.map(p => ({ date: p.date, systolic: S.round(p.systolic, 1), diastolic: S.round(p.diastolic, 1), daysInWindow: p.daysInWindow }))
    },
    reference: Refs.referenceLines(ctx.guideline, 'home')
  };
}

/**
 * Statistische Kennzahlen für einen Zeitraum.
 * Basis sind Tagesmittel (siehe docs/medical-logic.md).
 */
function buildAnalytics(measurements, ctx) {
  const today = ctx.today;
  const period = ctx.period || '90d';
  const days = A.dailyMeans(measurements);
  const from = periodStart(period, today, days.length ? days[0].date : null);
  const inPeriod = A.filterDays(days, from, today);
  const window = A.summarizeDays(inPeriod, from, today);
  return {
    period: period,
    from: from,
    to: today,
    basis: 'daily_means',
    daysWithData: window.daysWithData,
    windowDays: window.windowDays,
    coverage: window.coverage,
    nMeasurements: window.nMeasurements,
    systolic: S.summarize(inPeriod.map(d => d.systolic)),
    diastolic: S.summarize(inPeriod.map(d => d.diastolic)),
    pulse: S.summarize(inPeriod.map(d => d.pulse)),
    trend: T.dailyTrend(inPeriod),
    monthly: A.monthly(inPeriod).map(m => ({
      key: m.key, daysWithData: m.daysWithData, nMeasurements: m.nMeasurements,
      systolic: S.round(m.systolic, 0), diastolic: S.round(m.diastolic, 0), pulse: S.round(m.pulse, 0)
    })),
    meanCategory: window.daysWithData
      ? Refs.categorize(ctx.guideline, 'home', S.round(window.systolic, 0), S.round(window.diastolic, 0))
      : null
  };
}

module.exports = { periodStart, buildDashboard, buildAnalytics };
