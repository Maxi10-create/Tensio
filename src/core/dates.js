'use strict';
/**
 * Datums- und Zeitzonenlogik.
 *
 * Konventionen:
 *  - Kalenderdaten werden als 'YYYY-MM-DD' (lokales Datum des Patienten) geführt.
 *    Sie sind für alle Tagesaggregationen maßgeblich.
 *  - Uhrzeiten als 'HH:MM' (lokale Wanduhrzeit).
 *  - measured_at als ISO 8601 mit Offset, z. B. '2026-03-29T07:30:00+02:00'.
 *    Ist die Uhrzeit unbekannt (historische Daten), bleibt measured_at leer –
 *    es wird niemals eine Uhrzeit erfunden.
 *
 * Datumsarithmetik erfolgt ausschließlich über UTC-Mitternacht, damit
 * Sommerzeitwechsel keine Tage verschieben.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DAY_MS = 86400000;

function pad(n, w) {
  let s = String(Math.abs(n));
  while (s.length < (w || 2)) s = '0' + s;
  return s;
}

function isValidDateString(s) {
  if (typeof s !== 'string') return false;
  const m = DATE_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
}

function isValidTimeString(s) {
  return typeof s === 'string' && TIME_RE.test(s);
}

/** 'YYYY-MM-DD' → Tagesnummer seit 1970-01-01 (UTC), ganzzahlig. */
function toDayNumber(dateStr) {
  const m = DATE_RE.exec(dateStr);
  if (!m) throw new Error('Ungültiges Datum: ' + dateStr);
  return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
}

function fromDayNumber(n) {
  const d = new Date(n * DAY_MS);
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
}

function addDays(dateStr, days) {
  return fromDayNumber(toDayNumber(dateStr) + days);
}

/** Anzahl Tage von a bis b (b − a). */
function daysBetween(a, b) {
  return toDayNumber(b) - toDayNumber(a);
}

/** ISO-Woche, z. B. '2026-W05'. */
function isoWeekKey(dateStr) {
  const n = toDayNumber(dateStr);
  const d = new Date(n * DAY_MS);
  const dow = (d.getUTCDay() + 6) % 7; // Mo=0 … So=6
  const thursday = new Date((n - dow + 3) * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan4 = Date.UTC(year, 0, 4) / DAY_MS;
  const jan4dow = (new Date(jan4 * DAY_MS).getUTCDay() + 6) % 7;
  const week1Monday = jan4 - jan4dow;
  const week = Math.floor((n - dow - week1Monday) / 7) + 1;
  return year + '-W' + pad(week);
}

function monthKey(dateStr) {
  return dateStr.slice(0, 7);
}

function quarterKey(dateStr) {
  const m = +dateStr.slice(5, 7);
  return dateStr.slice(0, 4) + '-Q' + (Math.floor((m - 1) / 3) + 1);
}

function yearKey(dateStr) {
  return dateStr.slice(0, 4);
}

/**
 * Lokale Wanduhrzeit eines UTC-Zeitpunkts in einer IANA-Zeitzone (via Intl).
 * Liefert { date, time, offsetMinutes }.
 */
function localPartsIntl(ms, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hourCycle: 'h23'
  });
  const parts = {};
  fmt.formatToParts(new Date(ms)).forEach(p => { parts[p.type] = p.value; });
  const hour = parts.hour === '24' ? '00' : parts.hour;
  const wallUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
  const offsetMinutes = Math.round((wallUtc - Math.floor(ms / 1000) * 1000) / 60000);
  return {
    date: parts.year + '-' + parts.month + '-' + parts.day,
    time: hour + ':' + parts.minute,
    offsetMinutes: offsetMinutes
  };
}

function formatOffset(minutes) {
  const sign = minutes < 0 ? '-' : '+';
  const a = Math.abs(minutes);
  return sign + pad(Math.floor(a / 60)) + ':' + pad(a % 60);
}

/**
 * Erzeugt eine Zeitzonen-Hilfe. `localParts(ms, tz)` kann für Laufzeitumgebungen
 * ohne vollständiges Intl (z. B. Apps Script → Utilities.formatDate) ersetzt werden.
 */
function createZone(timeZone, localParts) {
  const lp = localParts || localPartsIntl;
  return {
    timeZone: timeZone,
    /** Lokales Datum + Uhrzeit für einen Zeitpunkt. */
    local(ms) { return lp(ms, timeZone); },
    /** Heutiges lokales Datum. */
    today(nowMs) { return lp(nowMs, timeZone).date; },
    /**
     * Wandelt lokales Datum + Uhrzeit in ISO 8601 mit korrektem Offset um
     * (sommerzeitfest durch zweistufige Offset-Bestimmung).
     */
    toIso(dateStr, timeStr) {
      if (!isValidDateString(dateStr) || !isValidTimeString(timeStr)) return '';
      const wall = Date.UTC(+dateStr.slice(0, 4), +dateStr.slice(5, 7) - 1, +dateStr.slice(8, 10),
        +timeStr.slice(0, 2), +timeStr.slice(3, 5));
      let off = lp(wall, timeZone).offsetMinutes;
      const off2 = lp(wall - off * 60000, timeZone).offsetMinutes;
      if (off2 !== off) off = off2;
      return dateStr + 'T' + timeStr + ':00' + formatOffset(off);
    }
  };
}

/** Zerlegt einen ISO-String in lokales Datum und Uhrzeit (so wie gespeichert). */
function splitIso(iso) {
  if (typeof iso !== 'string' || iso.length < 16) return { date: '', time: '' };
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

function isoToMs(iso) {
  const t = Date.parse(iso);
  return isNaN(t) ? null : t;
}

module.exports = {
  DAY_MS,
  pad,
  isValidDateString,
  isValidTimeString,
  toDayNumber,
  fromDayNumber,
  addDays,
  daysBetween,
  isoWeekKey,
  monthKey,
  quarterKey,
  yearKey,
  localPartsIntl,
  formatOffset,
  createZone,
  splitIso,
  isoToMs
};
