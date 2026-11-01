/**
 * Data Access Layer: Google Sheets.
 *
 * - Ein Spreadsheet, ein Tabellenblatt pro Entität (siehe Tensio.Schema / docs/data-model.md).
 * - Spalten werden über die Kopfzeile adressiert (Reihenfolge darf abweichen,
 *   zusätzliche eigene Spalten bleiben erhalten).
 * - Pro Anfrage wird jedes Blatt höchstens einmal komplett gelesen (Batch-Read)
 *   und im Speicher der Anfrage gehalten. Kein persistenter Cache für Gesundheitsdaten.
 */

var DATE_ONLY_COLUMNS_ = ['measurement_date', 'event_date', 'date', 'start_date', 'end_date'];

/**
 * Liefert das Tensio-Spreadsheet. Reihenfolge:
 *  1. Script-Property SPREADSHEET_ID (vom Setup gesetzt; funktioniert im eigenständigen Skript),
 *  2. das gebundene Spreadsheet, falls das Skript an eines gebunden ist.
 */
function getSpreadsheet_() {
  // Bevorzugt das Sheet, an das das Skript gebunden ist (Erweiterungen → Apps Script).
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;
  var id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  throw new Error('Kein Tensio-Spreadsheet gefunden. Bitte im Apps-Script-Editor einmal createTensioSpreadsheet() ausführen.');
}

/**
 * EINMALIG im Apps-Script-Editor ausführen („Ausführen“ → createTensioSpreadsheet).
 * Legt in deinem Google Drive ein privates Spreadsheet „Tensio Daten“ an, richtet alle
 * Tabellenblätter ein und merkt sich die ID. Die URL steht im Ausführungsprotokoll.
 */
function createTensioSpreadsheet() {
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('SPREADSHEET_ID');
  if (existing) {
    Logger.log('Tensio-Daten existieren bereits: https://docs.google.com/spreadsheets/d/' + existing);
    return;
  }
  var ss = SpreadsheetApp.create('Tensio Daten');
  props.setProperty('SPREADSHEET_ID', ss.getId());
  ensureSchema_(ss);
  Logger.log('Tensio-Daten angelegt: ' + ss.getUrl());
}

/** @constructor */
function SheetRepository_(ss) {
  this.ss = ss;
  this.tz = ss.getSpreadsheetTimeZone();
  this.tables = {};
}

SheetRepository_.prototype.sheet_ = function (name) {
  var sh = this.ss.getSheetByName(name);
  if (!sh) throw new Error('Tabellenblatt fehlt: ' + name + '. Bitte im Menü „Tensio → Tabellenblätter einrichten“ ausführen.');
  return sh;
};

SheetRepository_.prototype.load_ = function (name) {
  if (this.tables[name]) return this.tables[name];
  var sh = this.sheet_(name);
  var values = sh.getDataRange().getValues();
  var headers = (values[0] || []).map(function (h) { return String(h).trim(); });
  var def = Tensio.Schema.SHEETS[name];
  var t = { sheet: sh, headers: headers, rows: [], records: [], index: {} };
  for (var r = 1; r < values.length; r++) {
    var raw = values[r];
    var rec = this.toRecord_(name, headers, raw);
    var key = rec[def.key];
    if (!key) continue; // unvollständige Importzeilen → „Importierte Messungen vervollständigen“
    t.index[key] = t.records.length;
    t.records.push(rec);
    t.rows.push({ rowNumber: r + 1, raw: raw });
  }
  this.tables[name] = t;
  return t;
};

SheetRepository_.prototype.toRecord_ = function (name, headers, raw) {
  var cols = Tensio.Schema.SHEETS[name].columns;
  var tz = this.tz;
  var rec = {};
  headers.forEach(function (h, i) {
    var type = cols[h];
    if (!type) return;
    var v = raw[i];
    if (type === 'number') {
      rec[h] = (v === '' || v === null) ? null : Number(v);
      if (rec[h] !== null && isNaN(rec[h])) rec[h] = null;
    } else if (type === 'boolean') {
      if (v === '' || v === null) rec[h] = null;
      else rec[h] = v === true || String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'wahr';
    } else if (type === 'json') {
      if (v === '' || v === null) rec[h] = [];
      else { try { rec[h] = JSON.parse(v); } catch (e) { rec[h] = String(v); } }
    } else {
      if (v instanceof Date) {
        rec[h] = DATE_ONLY_COLUMNS_.indexOf(h) >= 0
          ? Utilities.formatDate(v, tz, 'yyyy-MM-dd')
          : Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
      } else {
        rec[h] = v === null || v === undefined ? '' : String(v);
      }
    }
  });
  if (name === 'Measurements' && rec.is_valid === null) rec.is_valid = true;
  return rec;
};

/** Wandelt einen Wert in eine Zelle um (inkl. Schutz vor Formel-Injection). */
function toCell_(value, type) {
  if (value === null || value === undefined) return '';
  if (type === 'json') return JSON.stringify(value);
  if (type === 'boolean') return value === true;
  if (type === 'number') return typeof value === 'number' && isFinite(value) ? value : '';
  var s = String(value);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

SheetRepository_.prototype.toRow_ = function (name, t, rec, baseRaw) {
  var cols = Tensio.Schema.SHEETS[name].columns;
  return t.headers.map(function (h, i) {
    if (!cols[h]) return baseRaw ? baseRaw[i] : '';
    return toCell_(rec[h], cols[h]);
  });
};

SheetRepository_.prototype.getAll = function (name) {
  return this.load_(name).records.map(function (r) { return JSON.parse(JSON.stringify(r)); });
};

SheetRepository_.prototype.insert = function (name, rec) {
  var t = this.load_(name);
  var key = rec[Tensio.Schema.SHEETS[name].key];
  if (t.index[key] !== undefined) throw new Error('Doppelte ID in ' + name);
  var row = this.toRow_(name, t, rec, null);
  t.sheet.appendRow(row);
  t.index[key] = t.records.length;
  t.records.push(JSON.parse(JSON.stringify(rec)));
  t.rows.push({ rowNumber: t.sheet.getLastRow(), raw: row });
};

SheetRepository_.prototype.update = function (name, rec) {
  var t = this.load_(name);
  var key = rec[Tensio.Schema.SHEETS[name].key];
  var i = t.index[key];
  if (i === undefined) throw new Error('Datensatz nicht gefunden.');
  var meta = t.rows[i];
  var row = this.toRow_(name, t, rec, meta.raw);
  t.sheet.getRange(meta.rowNumber, 1, 1, row.length).setValues([row]);
  t.records[i] = JSON.parse(JSON.stringify(rec));
  meta.raw = row;
};

/**
 * Legt fehlende Tabellenblätter und Spalten an. Bestehende Daten bleiben unverändert.
 * Text-Spalten werden als Nur-Text formatiert, damit Sheets ISO-Datumswerte nicht umwandelt.
 */
function setupSpreadsheet() {
  assertAuthorized_();
  var created = ensureSchema_(getSpreadsheet_());
  safeAlert_('Tensio ist eingerichtet.' + (created.length ? '\nNeu angelegt: ' + created.join(', ') : '\nAlle Tabellenblätter vorhanden.'));
}

/** Legt fehlende Tabellenblätter/Spalten an (idempotent). Gibt die neu angelegten Blattnamen zurück. */
function ensureSchema_(ss) {
  var created = [];
  Object.keys(Tensio.Schema.SHEETS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); created.push(name); }
    var cols = Tensio.Schema.SHEETS[name].columns;
    var wanted = Object.keys(cols);
    var lastCol = Math.max(sh.getLastColumn(), 1);
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return String(h).trim(); });
    if (!headers.join('')) headers = [];
    wanted.forEach(function (c) { if (headers.indexOf(c) < 0) headers.push(c); });
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    headers.forEach(function (h, i) {
      var type = cols[h];
      if (type === 'string' || type === 'json') sh.getRange(1, i + 1, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });
  // Patient + Einstellungen anlegen, falls leer
  var runtime = createRuntime_(Session.getEffectiveUser().getEmail(), ss);
  runtime.api.call('bootstrap', {});
  SpreadsheetApp.flush();
  return created;
}

/**
 * Vervollständigt manuell importierte Messzeilen (z. B. digitalisierte Altdaten):
 * vergibt fehlende IDs und setzt Standardwerte. Uhrzeiten werden NICHT ergänzt.
 */
function normalizeImportedMeasurements() {
  assertAuthorized_();
  var ss = getSpreadsheet_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = ss.getSheetByName('Measurements');
    var values = sh.getDataRange().getValues();
    var headers = values[0].map(function (h) { return String(h).trim(); });
    var col = function (n) { return headers.indexOf(n); };
    var tz = ss.getSpreadsheetTimeZone();
    var now = new Date().toISOString();
    var patientId = Tensio.Patients.ensureDefaultPatient(new SheetRepository_(ss), Date.now);
    var fixed = 0;
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var hasValues = row[col('systolic')] !== '' && row[col('diastolic')] !== '' && row[col('measurement_date')] !== '';
      if (!hasValues || row[col('id')]) continue;
      row[col('id')] = Utilities.getUuid();
      if (!row[col('patient_id')]) row[col('patient_id')] = patientId;
      if (row[col('measurement_date')] instanceof Date) row[col('measurement_date')] = Utilities.formatDate(row[col('measurement_date')], tz, 'yyyy-MM-dd');
      if (row[col('measured_at')] instanceof Date) row[col('measured_at')] = Utilities.formatDate(row[col('measured_at')], tz, "yyyy-MM-dd'T'HH:mm:ssXXX");
      if (!row[col('measurement_type')]) row[col('measurement_type')] = 'daily';
      if (!row[col('source')]) row[col('source')] = 'historical_import';
      if (row[col('is_valid')] === '') row[col('is_valid')] = true;
      if (!row[col('created_at')]) row[col('created_at')] = now;
      if (!row[col('updated_at')]) row[col('updated_at')] = now;
      sh.getRange(r + 1, 1, 1, row.length).setValues([row]);
      fixed++;
    }
    SpreadsheetApp.flush();
    safeAlert_(fixed + ' Messung(en) vervollständigt.');
  } finally {
    lock.releaseLock();
  }
}

/** Fügt fiktive Demo-Daten ein (IDs beginnen mit „demo-“). Nur zum Ausprobieren. */
function insertDemoData() {
  assertAuthorized_();
  var ss = getSpreadsheet_();
  var repo = new SheetRepository_(ss);
  if (repo.getAll('Measurements').length) {
    safeAlert_('Es sind bereits Messungen vorhanden. Demo-Daten werden nur in ein leeres Blatt eingefügt.');
    return;
  }
  var patientId = Tensio.Patients.ensureDefaultPatient(repo, Date.now);
  var zone = Tensio.Dates.createZone(ss.getSpreadsheetTimeZone(), gasLocalParts_);
  var recs = Tensio.DemoData.generateDemoMeasurements({ today: zone.today(Date.now()), patientId: patientId, zone: zone });
  var t = repo.load_('Measurements');
  var rows = recs.map(function (rec) { return repo.toRow_('Measurements', t, rec, null); });
  t.sheet.getRange(t.sheet.getLastRow() + 1, 1, rows.length, t.headers.length).setValues(rows);
  safeAlert_(rows.length + ' fiktive Demo-Messungen eingefügt.');
}

/** Entfernt alle Demo-Zeilen (IDs mit Präfix „demo-“) endgültig – in einem Batch-Schreibvorgang. */
function removeDemoData() {
  assertAuthorized_();
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sh = getSpreadsheet_().getSheetByName('Measurements');
    var values = sh.getDataRange().getValues();
    var idCol = values[0].indexOf('id');
    var keep = values.slice(1).filter(function (row) { return String(row[idCol]).indexOf('demo-') !== 0; });
    var removed = values.length - 1 - keep.length;
    if (removed) {
      sh.getRange(2, 1, values.length - 1, values[0].length).clearContent();
      if (keep.length) sh.getRange(2, 1, keep.length, values[0].length).setValues(keep);
    }
    safeAlert_(removed + ' Demo-Messungen entfernt.');
  } finally {
    lock.releaseLock();
  }
}

function safeAlert_(msg) {
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
}

/**
 * Legt das Blatt „Import“ an (Menü „Import-Vorlage anlegen“). Dort trägst du
 * handschriftlich erfasste Messungen ein; die Spalte „Status“ füllt das Skript.
 */
function createImportTemplate() {
  assertAuthorized_();
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName('Import') || ss.insertSheet('Import');
  var headers = Tensio.Importer.IMPORT_HEADERS;
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), 2).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setBackground('#e8e8ed');
    sh.setColumnWidth(7, 260);
  }
  safeAlert_('Blatt „Import“ ist bereit.\nTrage ab Zeile 2 deine Messungen ein (Datum im Format TT.MM.JJJJ, Uhrzeit HH:MM oder leer, Puls oder leer).\nDann im Menü „Tensio → Handschriftliche Daten übernehmen“ ausführen.');
}

/**
 * Übernimmt alle Zeilen aus dem Blatt „Import“ als Messungen (source „import“).
 * Jede Zeile wird wie eine App-Eingabe geprüft. Zeilen mit Status „übernommen“
 * werden nicht noch einmal übernommen, fehlerhafte Zeilen bekommen eine Meldung.
 */
function importHandwrittenMeasurements() {
  assertAuthorized_();
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName('Import');
  if (!sh) {
    safeAlert_('Es gibt noch kein Blatt „Import“. Bitte zuerst „Import-Vorlage anlegen“ ausführen.');
    return;
  }
  var last = sh.getLastRow();
  if (last < 2) {
    safeAlert_('Im Blatt „Import“ stehen noch keine Zeilen.');
    return;
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var width = Tensio.Importer.IMPORT_HEADERS.length;
    var values = sh.getRange(2, 1, last - 1, width).getValues();
    var tz = ss.getSpreadsheetTimeZone();
    var runtime = createRuntime_(Session.getEffectiveUser().getEmail());
    var ok = 0, failed = 0, skipped = 0;
    var today = Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy');
    var statuses = values.map(function (row) {
      var status = String(row[6] || '');
      if (status.indexOf('übernommen') === 0) { skipped++; return [status]; }
      if (row.slice(0, 5).every(function (c) { return String(c).trim() === ''; })) return [''];
      var date = row[0] instanceof Date ? Utilities.formatDate(row[0], tz, 'yyyy-MM-dd') : row[0];
      var time = row[1] instanceof Date ? Utilities.formatDate(row[1], tz, 'HH:mm') : row[1];
      var parsed = Tensio.Importer.parseImportRow({ date: date, time: time, systolic: row[2], diastolic: row[3], pulse: row[4], notes: row[5] });
      if (!parsed.ok) { failed++; return ['Fehler: ' + parsed.error]; }
      var res = runtime.api.call('createMeasurement', parsed.input);
      if (res.ok) { ok++; return ['übernommen ' + today]; }
      failed++;
      var msg = (res.error && res.error.message) || 'Unbekannter Fehler';
      if (res.error && res.error.warnings && res.error.warnings.length) {
        msg = 'Bitte prüfen: ' + res.error.warnings.map(function (w) { return w.message; }).join(' ');
      }
      return ['Fehler: ' + msg];
    });
    sh.getRange(2, 7, statuses.length, 1).setValues(statuses);
    SpreadsheetApp.flush();
    safeAlert_('Übernommen: ' + ok + '\nNicht übernommen: ' + failed + '\nBereits früher übernommen: ' + skipped +
      '\n\nDie Spalte „Status“ zeigt je Zeile, was passiert ist. Fehlerhafte Zeilen korrigieren und erneut ausführen.');
  } finally {
    lock.releaseLock();
  }
}
