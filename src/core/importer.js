'use strict';
/**
 * Übernahme handschriftlich erfasster Messungen aus einem Import-Blatt.
 * Reine Logik ohne Apps-Script-Aufrufe: wandelt eine Tabellenzeile in eine
 * Messung um oder liefert eine verständliche Fehlermeldung für die Zeile.
 */

const IMPORT_HEADERS = ['Datum', 'Uhrzeit', 'Systolisch', 'Diastolisch', 'Puls', 'Notiz', 'Status'];

/** Akzeptiert „TT.MM.JJJJ“ oder „JJJJ-MM-TT“ und gibt „JJJJ-MM-TT“ zurück. */
function parseDate(text) {
  const s = String(text || '').trim();
  let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  let y, mo, d;
  if (m) { d = +m[1]; mo = +m[2]; y = +m[3]; }
  else {
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
    if (!m) return null;
    y = +m[1]; mo = +m[2]; d = +m[3];
  }
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return [y, String(mo).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
}

/** Akzeptiert „HH:MM“ oder leer (null). */
function parseTime(text) {
  const s = String(text || '').trim();
  if (s === '') return { ok: true, value: '' };
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m || +m[1] > 23 || +m[2] > 59) return { ok: false };
  return { ok: true, value: String(+m[1]).padStart(2, '0') + ':' + m[2] };
}

function parseNumber(text) {
  const s = String(text === undefined || text === null ? '' : text).trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return NaN;
  return Number(s);
}

/**
 * Wandelt eine Zeile {date, time, systolic, diastolic, pulse, notes} in eine
 * Eingabe für createMeasurement. Gibt { ok: true, input } oder { ok: false, error }.
 */
function parseImportRow(row) {
  const date = parseDate(row.date);
  if (!date) return { ok: false, error: 'Datum fehlt oder ist ungültig (Format TT.MM.JJJJ oder JJJJ-MM-TT).' };
  const time = parseTime(row.time);
  if (!time.ok) return { ok: false, error: 'Uhrzeit ungültig (Format HH:MM oder leer).' };
  const sys = parseNumber(row.systolic);
  const dia = parseNumber(row.diastolic);
  const pulse = parseNumber(row.pulse);
  if (sys === null || isNaN(sys)) return { ok: false, error: 'Systolisch fehlt oder ist keine ganze Zahl.' };
  if (dia === null || isNaN(dia)) return { ok: false, error: 'Diastolisch fehlt oder ist keine ganze Zahl.' };
  if (isNaN(pulse)) return { ok: false, error: 'Puls ist keine ganze Zahl (leer lassen, wenn unbekannt).' };
  return {
    ok: true,
    input: {
      measurement_date: date,
      measurement_time: time.value,
      systolic: sys,
      diastolic: dia,
      pulse: pulse,
      notes: String(row.notes || '').trim(),
      source: 'import'
    }
  };
}

module.exports = { IMPORT_HEADERS, parseDate, parseTime, parseImportRow };
