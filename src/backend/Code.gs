/**
 * Tensio – Einstiegspunkte für Google Apps Script.
 *
 * Schichten:
 *   Code.gs      Web-App, Menü, API-Einstieg (dieses File)
 *   Auth.gs      Zugriffskontrolle
 *   Database.gs  Google-Sheets-Repository, Einrichtung, Import-Hilfen
 *   Core.js      gebündelte, plattformunabhängige Logik (global `Tensio`, aus src/core + src/analytics)
 */

/** Liefert die Web-App aus. */
function doGet() {
  var auth = authorize_();
  if (!auth.ok) {
    return HtmlService.createHtmlOutput(
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;padding:32px;max-width:480px;margin:auto">' +
      '<h2>Kein Zugriff</h2><p>Dieses Konto ist für Tensio nicht freigeschaltet.</p></div>'
    ).setTitle('Tensio');
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Tensio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes');
}

/** Bindet eine HTML-Teildatei ein (für <?!= include('Name'); ?>). */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/**
 * Zentrale API für das Frontend (google.script.run.api).
 * Jede Anfrage wird serverseitig autorisiert; Schreibzugriffe laufen unter LockService.
 * @param {string} method
 * @param {string} payloadJson
 * @return {string} JSON { ok, data | error }
 */
/**
 * Kurzer Server-Cache für Leseaufrufe (Übersicht, Analyse, Liste, Bootstrap).
 * Jeder Schreibvorgang erhöht die Datenversion; alte Einträge werden dann nicht mehr
 * gefunden. Zusätzlich läuft jeder Eintrag nach 5 Minuten ab, damit Datumsangaben
 * wie „heute“ nicht veralten. Größere Antworten als ~95 KB werden nicht gecacht.
 */
var READ_CACHE_METHODS_ = ['bootstrap', 'getDashboard', 'getAnalytics', 'listMeasurements'];
var READ_CACHE_TTL_S_ = 300;

function readCached_(method, payloadText, compute) {
  if (READ_CACHE_METHODS_.indexOf(method) < 0) return compute();
  var cache = CacheService.getScriptCache();
  var version = cache.get('dataVersion') || '0';
  var key = 'v' + version + ':' + method + ':' + payloadText;
  if (key.length > 240) return compute();
  var hit = cache.get(key);
  if (hit) return hit;
  var out = compute();
  if (out.length < 95000) cache.put(key, out, READ_CACHE_TTL_S_);
  return out;
}

function bumpDataVersion_() {
  CacheService.getScriptCache().put('dataVersion', String(Date.now()), 21600);
}

function api(method, payloadJson) {
  var auth = authorize_();
  if (!auth.ok) {
    return JSON.stringify({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Kein Zugriff für dieses Konto.' } });
  }
  var payload = {};
  try {
    payload = payloadJson ? JSON.parse(payloadJson) : {};
  } catch (e) {
    return JSON.stringify({ ok: false, error: { code: 'VALIDATION', message: 'Ungültige Anfrage.' } });
  }
  var runtime = createRuntime_(auth.email);
  if (!runtime.api.isWrite(method)) {
    return readCached_(method, payloadJson || '{}', function () {
      return JSON.stringify(runtime.api.call(method, payload));
    });
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return JSON.stringify({ ok: false, error: { code: 'CONFLICT', message: 'Gerade wird eine andere Änderung gespeichert. Bitte gleich noch einmal versuchen.' } });
  }
  try {
    return JSON.stringify(runtime.api.call(method, payload));
  } finally {
    SpreadsheetApp.flush();
    bumpDataVersion_();
    lock.releaseLock();
  }
}

/** Baut die Laufzeitumgebung (Repository + Uhr + IDs) für eine Anfrage. */
function createRuntime_(email, ss) {
  var repo = new SheetRepository_(ss || getSpreadsheet_());
  return {
    repo: repo,
    api: Tensio.Api.createApi({
      repo: repo,
      now: function () { return Date.now(); },
      newId: function () { return Utilities.getUuid(); },
      localParts: gasLocalParts_,
      user: { email: email },
      onError: function (e) { console.error(e && e.stack ? e.stack : e); }
    })
  };
}

/**
 * Lokale Datums-/Zeitteile über Utilities.formatDate (zuverlässig in Apps Script).
 * @return {{date: string, time: string, offsetMinutes: number}}
 */
function gasLocalParts_(ms, timeZone) {
  var s = Utilities.formatDate(new Date(ms), timeZone, "yyyy-MM-dd'|'HH:mm'|'XXX");
  var p = s.split('|');
  var off = 0;
  if (p[2] !== 'Z') {
    var sign = p[2].charAt(0) === '-' ? -1 : 1;
    off = sign * (parseInt(p[2].substr(1, 2), 10) * 60 + parseInt(p[2].substr(4, 2), 10));
  }
  return { date: p[0], time: p[1], offsetMinutes: off };
}

/** Menü im Spreadsheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Tensio')
    .addItem('Tabellenblätter einrichten / prüfen', 'setupSpreadsheet')
    .addItem('Importierte Messungen vervollständigen', 'normalizeImportedMeasurements')
    .addItem('Import-Vorlage anlegen', 'createImportTemplate')
    .addItem('Handschriftliche Daten übernehmen', 'importHandwrittenMeasurements')
    .addSeparator()
    .addItem('Fiktive Demo-Daten einfügen', 'insertDemoData')
    .addItem('Demo-Daten entfernen', 'removeDemoData')
    .addToUi();
}
