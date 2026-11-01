/**
 * Lokale Vorschau ohne Google-Konto: ersetzt google.script.run durch die gleiche
 * API-Schicht mit In-Memory-Repository und FIKTIVEN Demo-Daten.
 * Wird nur in dist-preview/index.html eingebunden, nie nach Apps Script deployt.
 */
(function () {
  'use strict';
  var T = window.Tensio;
  var tz = 'Europe/Berlin';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || tz; } catch (e) { /* Standard */ }
  var zone = T.Dates.createZone(tz);
  var repo = T.MemoryRepository.createMemoryRepository();
  var n = 0;
  var newId = function () {
    return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'preview-' + (++n) + '-' + Date.now();
  };
  var now = function () { return Date.now(); };
  var patientId = T.Patients.ensureDefaultPatient(repo, now);
  repo.insert('Settings', {
    patient_id: patientId, timezone: tz, preferred_measurement_time: '', preferred_chart_period: '30d',
    reference_guideline: T.MedicalReferences.DEFAULT_GUIDELINE, theme: 'auto', application_version: T.Settings.APP_VERSION, updated_at: ''
  });
  T.DemoData.generateDemoMeasurements({ today: zone.today(now()), zone: zone, patientId: patientId })
    .forEach(function (r) { repo.insert('Measurements', r); });
  var api = T.Api.createApi({ repo: repo, now: now, newId: newId, user: { email: 'vorschau@example.org' }, onError: function (e) { console.error(e); } });
  window.TensioPreviewApi = {
    call: function (method, body) { return JSON.stringify(api.call(method, JSON.parse(body || '{}'))); }
  };
  document.addEventListener('DOMContentLoaded', function () {
    var b = document.createElement('div');
    b.className = 'banner';
    b.setAttribute('role', 'note');
    b.textContent = 'Vorschau mit fiktiven Demo-Daten. Änderungen werden nicht gespeichert und gehen beim Neuladen verloren.';
    var main = document.getElementById('main');
    if (main) main.insertBefore(b, main.firstChild);
  });
})();
