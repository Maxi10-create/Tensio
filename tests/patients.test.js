'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

test('Profil speichert Name und Geburtsdatum und leitet das Geburtsjahr ab', () => {
  const t = setup({ now: '2026-11-01T09:00:00Z' });
  const p = t.call('saveProfile', { name: '  Peter March ', birth_date: '1958-03-14' });
  assert.equal(p.name, 'Peter March');
  assert.equal(p.birth_date, '1958-03-14');
  assert.equal(p.birth_year, 1958);
  assert.equal(t.call('bootstrap', {}).profile.name, 'Peter March');
});

test('Profil lehnt ungültiges Geburtsdatum und Zukunftsdatum ab', () => {
  const t = setup({ now: '2026-11-01T09:00:00Z' });
  assert.throws(() => t.call('saveProfile', { birth_date: '14.03.1958' }), /Geburtsdatum/);
  assert.throws(() => t.call('saveProfile', { birth_date: '2030-01-01' }), /Geburtsdatum/);
});

test('Leeres Geburtsdatum lässt das bisherige Geburtsjahr unverändert', () => {
  const t = setup({ now: '2026-11-01T09:00:00Z' });
  t.call('saveProfile', { birth_year: '1960' });
  const p = t.call('saveProfile', { birth_date: '' });
  assert.equal(p.birth_date, '');
  assert.equal(p.birth_year, 1960);
});
