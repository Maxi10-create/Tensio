'use strict';
/**
 * Erzeugt FIKTIVE Demo-Messungen (deterministisch, seed-basiert).
 * Ausschließlich für Tests, Vorschau und Beispiel-Datensatz.
 * Enthält bewusst: Lücken, Tage mit zwei Messungen, fehlende Pulswerte,
 * historische Importe ohne Uhrzeit und einen langsamen Trend.
 */
const Dates = require('./dates');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rnd) {
  const u = 1 - rnd(), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * @param {object} o { today, days=540, historicalDays=180, seed=42, patientId, zone }
 * @returns {Array} Datensätze im Speicherformat des Measurements-Blatts
 */
function generateDemoMeasurements(o) {
  const rnd = mulberry32(o.seed || 42);
  const total = o.days || 540;
  const histDays = o.historicalDays === undefined ? 180 : o.historicalDays;
  const zone = o.zone || Dates.createZone('Europe/Berlin');
  const out = [];
  let n = 0;
  const id = () => 'demo-' + String(++n).padStart(5, '0');
  const ts = Dates.addDays(o.today, -total) + 'T20:00:00.000Z';

  for (let i = total - 1; i >= 1; i--) { // heute bleibt frei für eigene Eingaben
    const date = Dates.addDays(o.today, -i);
    const historical = i >= total - histDays;
    const progress = (total - i) / total;
    const baseSys = 139 - 10 * progress + 3 * Math.sin((Dates.toDayNumber(date) / 365) * 2 * Math.PI);
    const baseDia = 88 - 6 * progress + 2 * Math.sin((Dates.toDayNumber(date) / 365) * 2 * Math.PI);
    if (rnd() > (historical ? 0.7 : 0.88)) continue; // Lücke
    const count = !historical && rnd() < 0.12 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const sys = Math.round(baseSys + gauss(rnd) * 6 + (k ? -4 : 0));
      const dia = Math.round(baseDia + gauss(rnd) * 4 + (k ? -2 : 0));
      const pulse = rnd() < 0.15 ? null : Math.round(66 + gauss(rnd) * 6);
      const hour = k ? 19 + Math.floor(rnd() * 3) : 6 + Math.floor(rnd() * 3);
      const time = Dates.pad(hour) + ':' + Dates.pad(Math.floor(rnd() * 12) * 5);
      const tags = [];
      if (!historical && rnd() < 0.08) tags.push('stress');
      if (!historical && rnd() < 0.06) tags.push('poor_sleep');
      if (!historical && rnd() < 0.05) tags.push('caffeine');
      out.push({
        id: id(),
        patient_id: o.patientId || 'patient-1',
        measured_at: historical ? '' : zone.toIso(date, time),
        measurement_date: date,
        systolic: sys,
        diastolic: dia,
        pulse: pulse,
        measurement_type: 'daily',
        protocol_id: '',
        context_tags: tags,
        symptoms: [],
        notes: historical ? '' : (tags.length && rnd() < 0.5 ? 'Demo-Notiz (fiktiv)' : ''),
        is_valid: true,
        source: historical ? 'historical_import' : 'app',
        created_at: ts,
        updated_at: ts,
        deleted_at: ''
      });
    }
  }
  return out;
}

module.exports = { mulberry32, generateDemoMeasurements };
