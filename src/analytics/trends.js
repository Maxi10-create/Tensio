'use strict';
/**
 * Trendfunktionen. Aussagen werden immer mit Datenmenge geliefert,
 * damit die Oberfläche sie transparent anzeigen kann.
 */
const S = require('./statistics');
const A = require('./aggregation');
const D = require('../core/dates');

/**
 * Vergleicht das Fenster [endDate − windowDays + 1, endDate] mit dem
 * unmittelbar davor liegenden, gleich langen Fenster.
 * Ein Delta wird nur berechnet, wenn beide Fenster mindestens `minDays`
 * Tage mit Messungen enthalten.
 */
function comparePeriods(days, endDate, windowDays, minDays) {
  const need = minDays || Math.max(3, Math.ceil(windowDays / 4));
  const current = A.windowSummary(days, endDate, windowDays);
  const previous = A.windowSummary(days, D.addDays(endDate, -windowDays), windowDays);
  const sufficient = current.daysWithData >= need && previous.daysWithData >= need;
  return {
    windowDays: windowDays,
    minDays: need,
    current: current,
    previous: previous,
    sufficient: sufficient,
    delta: sufficient ? {
      systolic: S.round(current.systolic - previous.systolic, 1),
      diastolic: S.round(current.diastolic - previous.diastolic, 1)
    } : null
  };
}

/**
 * Einfache lineare Regression (kleinste Quadrate) über Punkte {x, y}.
 * Liefert Steigung pro x-Einheit, Achsenabschnitt und n.
 */
function linearRegression(points) {
  const p = (points || []).filter(q => isFinite(q.x) && isFinite(q.y));
  if (p.length < 2) return null;
  const mx = S.mean(p.map(q => q.x));
  const my = S.mean(p.map(q => q.y));
  let num = 0, den = 0;
  p.forEach(q => { num += (q.x - mx) * (q.y - my); den += (q.x - mx) * (q.x - mx); });
  if (den === 0) return null;
  const slope = num / den;
  return { slope: slope, intercept: my - slope * mx, n: p.length };
}

/** Linearer Trend der Tagesmittel in mmHg pro 30 Tage. */
function dailyTrend(days) {
  const sys = linearRegression(days.map(d => ({ x: D.toDayNumber(d.date), y: d.systolic })));
  const dia = linearRegression(days.map(d => ({ x: D.toDayNumber(d.date), y: d.diastolic })));
  return {
    n: days.length,
    systolicPer30Days: sys ? S.round(sys.slope * 30, 1) : null,
    diastolicPer30Days: dia ? S.round(dia.slope * 30, 1) : null
  };
}

module.exports = { comparePeriods, linearRegression, dailyTrend };
