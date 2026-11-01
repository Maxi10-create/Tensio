'use strict';
/** Benutzer- und Anzeigeeinstellungen (Configuration Layer). */
const Schema = require('./schema');
const Refs = require('../analytics/medicalReferences');
const Dates = require('./dates');
const { AppError, CODES } = require('./errors');

const APP_VERSION = '0.1.0';

const DEFAULTS = {
  timezone: 'Europe/Berlin',
  preferred_measurement_time: '',
  preferred_chart_period: '30d',
  reference_guideline: Refs.DEFAULT_GUIDELINE,
  theme: 'light'
};

function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * @param {object} deps { repo, now, patientId, audit, isValidTimeZone? }
 */
function createSettingsService(deps) {
  const tzCheck = deps.isValidTimeZone || isValidTimeZone;

  function find() {
    return deps.repo.getAll('Settings').filter(s => s.patient_id === deps.patientId)[0] || null;
  }

  function get() {
    const s = find() || {};
    const out = { patient_id: deps.patientId, application_version: APP_VERSION };
    Object.keys(DEFAULTS).forEach(k => { out[k] = s[k] || DEFAULTS[k]; });
    return out;
  }

  function save(patch) {
    const p = patch || {};
    const cur = get();
    const next = Object.assign({}, cur);
    const errors = [];
    if (p.timezone !== undefined) {
      if (!tzCheck(p.timezone)) errors.push({ field: 'timezone', message: 'Unbekannte Zeitzone.' });
      else next.timezone = p.timezone;
    }
    if (p.theme !== undefined) {
      if (Schema.THEMES.indexOf(p.theme) < 0) errors.push({ field: 'theme', message: 'Unbekanntes Design.' });
      else next.theme = p.theme;
    }
    if (p.preferred_chart_period !== undefined) {
      if (!Object.prototype.hasOwnProperty.call(Schema.CHART_PERIODS, p.preferred_chart_period)) errors.push({ field: 'preferred_chart_period', message: 'Unbekannter Zeitraum.' });
      else next.preferred_chart_period = p.preferred_chart_period;
    }
    if (p.reference_guideline !== undefined) {
      if (!Refs.GUIDELINES[p.reference_guideline]) errors.push({ field: 'reference_guideline', message: 'Unbekannte Leitlinie.' });
      else next.reference_guideline = p.reference_guideline;
    }
    if (p.preferred_measurement_time !== undefined) {
      if (p.preferred_measurement_time && !Dates.isValidTimeString(p.preferred_measurement_time)) errors.push({ field: 'preferred_measurement_time', message: 'Bitte Uhrzeit als HH:MM angeben.' });
      else next.preferred_measurement_time = p.preferred_measurement_time || '';
    }
    if (errors.length) throw new AppError(CODES.VALIDATION, errors[0].message, { errors });
    next.application_version = APP_VERSION;
    next.updated_at = new Date(deps.now()).toISOString();
    if (find()) deps.repo.update('Settings', next);
    else deps.repo.insert('Settings', next);
    deps.audit.log('settings', deps.patientId, 'update', 'Einstellungen geändert');
    return get();
  }

  return { get, save };
}

module.exports = { APP_VERSION, DEFAULTS, isValidTimeZone, createSettingsService };
