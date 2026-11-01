'use strict';
/**
 * Messwertvalidierung.
 *
 * Zwei Stufen, bewusst getrennt von der medizinischen Bewertung:
 *  - errors:   technisch unplausible Eingaben → werden abgelehnt.
 *  - warnings: ungewöhnliche, aber mögliche Werte → müssen bestätigt werden.
 * Werte werden niemals automatisch korrigiert oder verworfen.
 */
const Schema = require('./schema');
const Dates = require('./dates');

const LIMITS = {
  systolic: { min: 50, max: 300, warnLow: 90, warnHigh: 180 },
  diastolic: { min: 20, max: 200, warnLow: 50, warnHigh: 110 },
  pulse: { min: 20, max: 250, warnLow: 40, warnHigh: 150 },
  pulsePressure: { warnLow: 20, warnHigh: 100 },
  notesMaxLength: 1000,
  earliestDate: '1900-01-01'
};

const LABELS = { systolic: 'Systolischer Wert', diastolic: 'Diastolischer Wert', pulse: 'Puls' };

function toNumber(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
  return Number(s);
}

function toList(v) {
  if (v === null || v === undefined || v === '') return [];
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string') {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch (e) { /* kommasepariert */ }
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function checkNumber(field, raw, required, errors) {
  const v = toNumber(raw);
  const lim = LIMITS[field];
  if (v === null) {
    if (required) errors.push({ field, message: LABELS[field] + ' fehlt.' });
    return null;
  }
  if (isNaN(v)) {
    errors.push({ field, message: LABELS[field] + ' muss eine Zahl sein.' });
    return null;
  }
  if (Math.round(v) !== v) {
    errors.push({ field, message: LABELS[field] + ' bitte als ganze Zahl eingeben.' });
    return null;
  }
  if (v < lim.min || v > lim.max) {
    errors.push({ field, message: LABELS[field] + ' muss zwischen ' + lim.min + ' und ' + lim.max + ' liegen.' });
    return null;
  }
  return v;
}

/**
 * Plausibilitätshinweise für bereits gültige Werte (auch für die Markierung
 * auffälliger Messungen in Listen verwendet).
 */
function plausibilityWarnings(m) {
  const w = [];
  const s = m.systolic, d = m.diastolic, p = m.pulse;
  if (typeof s === 'number') {
    if (s >= LIMITS.systolic.warnHigh) w.push({ field: 'systolic', code: 'systolic_high', message: 'Systolischer Wert ist sehr hoch (≥ ' + LIMITS.systolic.warnHigh + ' mmHg).' });
    if (s < LIMITS.systolic.warnLow) w.push({ field: 'systolic', code: 'systolic_low', message: 'Systolischer Wert ist ungewöhnlich niedrig (< ' + LIMITS.systolic.warnLow + ' mmHg).' });
  }
  if (typeof d === 'number') {
    if (d >= LIMITS.diastolic.warnHigh) w.push({ field: 'diastolic', code: 'diastolic_high', message: 'Diastolischer Wert ist sehr hoch (≥ ' + LIMITS.diastolic.warnHigh + ' mmHg).' });
    if (d < LIMITS.diastolic.warnLow) w.push({ field: 'diastolic', code: 'diastolic_low', message: 'Diastolischer Wert ist ungewöhnlich niedrig (< ' + LIMITS.diastolic.warnLow + ' mmHg).' });
  }
  if (typeof s === 'number' && typeof d === 'number' && s > d) {
    const pp = s - d;
    if (pp < LIMITS.pulsePressure.warnLow) w.push({ field: 'diastolic', code: 'pulse_pressure_low', message: 'Abstand zwischen systolischem und diastolischem Wert ist ungewöhnlich klein (' + pp + ' mmHg).' });
    if (pp > LIMITS.pulsePressure.warnHigh) w.push({ field: 'systolic', code: 'pulse_pressure_high', message: 'Abstand zwischen systolischem und diastolischem Wert ist ungewöhnlich groß (' + pp + ' mmHg).' });
  }
  if (typeof p === 'number') {
    if (p > LIMITS.pulse.warnHigh) w.push({ field: 'pulse', code: 'pulse_high', message: 'Puls ist ungewöhnlich hoch (> ' + LIMITS.pulse.warnHigh + ' /min).' });
    if (p < LIMITS.pulse.warnLow) w.push({ field: 'pulse', code: 'pulse_low', message: 'Puls ist ungewöhnlich niedrig (< ' + LIMITS.pulse.warnLow + ' /min).' });
  }
  return w;
}

/**
 * Validiert eine Eingabe aus dem Formular.
 * @param {object} input  { systolic, diastolic, pulse, measurement_date, measurement_time,
 *                          measurement_type, context_tags, symptoms, notes, is_valid }
 * @param {object} ctx    { today: 'YYYY-MM-DD' }
 * @returns {{ errors: Array, warnings: Array, value: object }}
 */
function validateMeasurement(input, ctx) {
  const errors = [];
  const inp = input || {};
  const today = ctx && ctx.today;

  const systolic = checkNumber('systolic', inp.systolic, true, errors);
  const diastolic = checkNumber('diastolic', inp.diastolic, true, errors);
  const pulse = checkNumber('pulse', inp.pulse, false, errors);

  if (systolic !== null && diastolic !== null && diastolic >= systolic) {
    errors.push({ field: 'diastolic', message: 'Der diastolische Wert muss kleiner als der systolische sein. Wurden die Felder vertauscht?' });
  }

  const date = typeof inp.measurement_date === 'string' ? inp.measurement_date.trim() : '';
  if (!Dates.isValidDateString(date)) {
    errors.push({ field: 'measurement_date', message: 'Bitte ein gültiges Datum angeben.' });
  } else {
    if (today && date > today) errors.push({ field: 'measurement_date', message: 'Das Datum liegt in der Zukunft.' });
    if (date < LIMITS.earliestDate) errors.push({ field: 'measurement_date', message: 'Das Datum ist unplausibel früh.' });
  }

  const time = typeof inp.measurement_time === 'string' ? inp.measurement_time.trim() : '';
  if (time && !Dates.isValidTimeString(time)) {
    errors.push({ field: 'measurement_time', message: 'Bitte eine gültige Uhrzeit (HH:MM) angeben oder leer lassen.' });
  }

  const type = inp.measurement_type || 'daily';
  if (Schema.MEASUREMENT_TYPES.indexOf(type) < 0) errors.push({ field: 'measurement_type', message: 'Unbekannte Messart.' });

  const allowedTags = Schema.CONTEXT_TAGS.map(t => t.key);
  const tags = toList(inp.context_tags);
  if (tags.some(t => allowedTags.indexOf(t) < 0)) errors.push({ field: 'context_tags', message: 'Unbekannter Einflussfaktor.' });

  const allowedSymptoms = Schema.SYMPTOMS.map(t => t.key);
  const symptoms = toList(inp.symptoms);
  if (symptoms.some(t => allowedSymptoms.indexOf(t) < 0)) errors.push({ field: 'symptoms', message: 'Unbekanntes Symptom.' });

  const notes = inp.notes === null || inp.notes === undefined ? '' : String(inp.notes).trim();
  if (notes.length > LIMITS.notesMaxLength) errors.push({ field: 'notes', message: 'Die Notiz ist zu lang (max. ' + LIMITS.notesMaxLength + ' Zeichen).' });

  const value = {
    systolic, diastolic, pulse,
    measurement_date: date,
    measurement_time: time,
    measurement_type: type,
    context_tags: tags,
    symptoms: symptoms,
    notes: notes,
    is_valid: inp.is_valid === false || inp.is_valid === 'false' ? false : true
  };

  const warnings = errors.length ? [] : plausibilityWarnings(value);
  return { errors, warnings, value };
}

module.exports = { LIMITS, toNumber, toList, plausibilityWarnings, validateMeasurement };
