'use strict';
/**
 * Prüft das Apps-Script-Bundle: lädt dist/Core.js und alle .gs-Dateien gemeinsam
 * in einen isolierten Kontext (wie der globale Apps-Script-Scope).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');

test('Build erzeugt clasp-kompatibles dist/ und lauffähigen Kern', () => {
  execFileSync(process.execPath, [path.join(root, 'scripts/build.mjs')], { cwd: root, stdio: 'pipe' });
  const dist = path.join(root, 'dist');
  const files = fs.readdirSync(dist);
  for (const f of ['Core.js', 'Code.gs', 'Auth.gs', 'Database.gs', 'Index.html', 'appsscript.json']) {
    assert.ok(files.includes(f), f + ' fehlt');
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'appsscript.json'), 'utf8'));
  assert.equal(manifest.runtimeVersion, 'V8');
  assert.equal(manifest.webapp.access, 'MYSELF');

  const ctx = vm.createContext({ console, JSON, Date, Math, Intl });
  for (const f of files.filter(f => /\.(js|gs)$/.test(f))) {
    vm.runInContext(fs.readFileSync(path.join(dist, f), 'utf8'), ctx, { filename: f });
  }
  assert.equal(typeof ctx.Tensio.Api.createApi, 'function');
  for (const fn of ['doGet', 'api', 'include', 'onOpen', 'createTensioSpreadsheet', 'setupSpreadsheet', 'normalizeImportedMeasurements', 'authorize_']) {
    assert.equal(typeof ctx[fn], 'function', fn + ' fehlt');
  }
  // Alle Includes in Index.html existieren
  const index = fs.readFileSync(path.join(dist, 'Index.html'), 'utf8');
  for (const [, name] of index.matchAll(/include\('([A-Za-z0-9_]+)'\)/g)) {
    assert.ok(files.includes(name + '.html'), 'Include fehlt: ' + name);
  }
  const preview = fs.readFileSync(path.join(root, 'dist-preview/index.html'), 'utf8');
  assert.ok(!/<\?/.test(preview));
});

test('Repository enthält keine echten Messdaten aus dem Prototyp', () => {
  const csv = fs.readFileSync(path.join(root, 'samples/demo-measurements.csv'), 'utf8');
  const ids = csv.trim().split('\n').slice(1).map(l => l.split(',')[0]);
  assert.ok(ids.length > 100);
  assert.ok(ids.every(id => id.startsWith('demo-')), 'Beispieldaten müssen als Demo gekennzeichnet sein');
});
