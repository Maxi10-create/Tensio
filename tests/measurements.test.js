'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup } = require('./helpers');

const input = (patch) => Object.assign({ systolic: '128', diastolic: '82', pulse: '64', measurement_date: '2026-11-01', measurement_time: '07:30' }, patch);

test('Messung anlegen: UUID, Zeitstempel, Offset, Quelle', () => {
  const t = setup();
  const r = t.call('createMeasurement', { input: input() });
  assert.ok(r.id);
  assert.equal(r.measured_at, '2026-11-01T07:30:00+01:00');
  assert.equal(r.source, 'app');
  assert.equal(r.created_at, '2026-11-01T09:00:00.000Z');
  assert.equal(r.created_at, r.updated_at);
  assert.equal(t.call('listMeasurements').length, 1);
});

test('Ohne Uhrzeit wird keine Uhrzeit erfunden', () => {
  const t = setup();
  const r = t.call('createMeasurement', { input: input({ measurement_time: '' }) });
  assert.equal(r.measured_at, '');
  assert.equal(r.measurement_time, '');
});

test('Uhrzeit in der Zukunft wird abgelehnt', () => {
  const t = setup({ now: '2026-11-01T09:00:00Z' }); // 10:00 in Berlin
  const res = t.raw('createMeasurement', { input: input({ measurement_time: '11:30' }) });
  assert.equal(res.ok, false);
  assert.equal(res.error.code, 'VALIDATION');
});

test('Warnungen erfordern Bestätigung, danach wird unverändert gespeichert', () => {
  const t = setup();
  const res = t.raw('createMeasurement', { input: input({ systolic: '190' }) });
  assert.equal(res.error.code, 'NEEDS_CONFIRMATION');
  assert.equal(t.call('listMeasurements').length, 0);
  const ok = t.call('createMeasurement', { input: input({ systolic: '190' }), confirmed: true });
  assert.equal(ok.systolic, 190);
  assert.deepEqual(ok.flags, ['systolic_high', 'pulse_pressure_high']);
});

test('Doppelte Messungen werden erkannt und gekennzeichnet', () => {
  const t = setup();
  t.call('createMeasurement', { input: input() });
  const dup = t.raw('createMeasurement', { input: input() });
  assert.equal(dup.error.code, 'NEEDS_CONFIRMATION');
  assert.equal(dup.error.details.warnings[0].code, 'duplicate');
  t.setNow('2026-11-01T09:01:00Z');
  const second = t.call('createMeasurement', { input: input(), confirmed: true });
  const list = t.call('listMeasurements');
  const marked = list.filter(x => x.duplicate_of);
  assert.equal(marked.length, 1);
  assert.equal(marked[0].id, second.id);
});

test('Bearbeiten: gleiche UUID, updated_at aktualisiert, Statistik neu berechnet', () => {
  const t = setup();
  const a = t.call('createMeasurement', { input: input({ systolic: '150', diastolic: '95' }) });
  assert.equal(t.call('getDashboard', { period: '7d' }).avg7.systolic, 150);
  t.setNow('2026-11-01T10:00:00Z');
  const b = t.call('updateMeasurement', { id: a.id, input: input({ systolic: '130', diastolic: '85' }), expectedUpdatedAt: a.updated_at });
  assert.equal(b.id, a.id);
  assert.equal(b.created_at, a.created_at);
  assert.equal(b.updated_at, '2026-11-01T10:00:00.000Z');
  assert.equal(t.call('getDashboard', { period: '7d' }).avg7.systolic, 130);
  assert.equal(t.call('listMeasurements').length, 1);
});

test('Bearbeiten erkennt zwischenzeitliche Änderungen (optimistische Sperre)', () => {
  const t = setup();
  const a = t.call('createMeasurement', { input: input() });
  t.setNow('2026-11-01T09:05:00Z');
  t.call('updateMeasurement', { id: a.id, input: input({ notes: 'neu' }) });
  const res = t.raw('updateMeasurement', { id: a.id, input: input({ notes: 'alt' }), expectedUpdatedAt: a.updated_at });
  assert.equal(res.error.code, 'CONFLICT');
});

test('Bearbeiten einer historischen Messung behält fehlende Uhrzeit', () => {
  const t = setup({ initial: { Measurements: [{
    id: 'h1', patient_id: 'patient-1', measured_at: '', measurement_date: '2023-04-02', systolic: 142, diastolic: 91, pulse: null,
    measurement_type: 'daily', protocol_id: '', context_tags: [], symptoms: [], notes: '', is_valid: true,
    source: 'historical_import', created_at: '2026-01-01T00:00:00.000Z', updated_at: '2026-01-01T00:00:00.000Z', deleted_at: ''
  }] } });
  const r = t.call('updateMeasurement', { id: 'h1', input: { systolic: 141, diastolic: 91, measurement_date: '2023-04-02', measurement_time: '' } });
  assert.equal(r.measured_at, '');
  assert.equal(r.source, 'historical_import');
});

test('Löschen ist ein Soft-Delete und kann rückgängig gemacht werden', () => {
  const t = setup();
  const a = t.call('createMeasurement', { input: input({ systolic: '150', diastolic: '95' }) });
  t.call('createMeasurement', { input: input({ systolic: '120', diastolic: '80', measurement_time: '08:00' }) });
  t.call('deleteMeasurement', { id: a.id });
  assert.equal(t.call('listMeasurements').length, 1);
  assert.equal(t.call('listMeasurements', { deletedOnly: true }).length, 1);
  assert.equal(t.repo.getAll('Measurements').length, 2); // physisch noch vorhanden
  assert.equal(t.call('getDashboard', { period: '7d' }).avg7.systolic, 120);
  assert.equal(t.raw('updateMeasurement', { id: a.id, input: input() }).error.code, 'CONFLICT');
  t.call('restoreMeasurement', { id: a.id });
  assert.equal(t.call('listMeasurements').length, 2);
  assert.equal(t.call('getDashboard', { period: '7d' }).avg7.systolic, 135);
});

test('Unbekannte ID → NOT_FOUND', () => {
  const t = setup();
  assert.equal(t.raw('getMeasurement', { id: 'gibt-es-nicht' }).error.code, 'NOT_FOUND');
  assert.equal(t.raw('gibtEsNicht', {}).error.code, 'UNKNOWN_METHOD');
});

test('AuditLog dokumentiert Änderungen ohne Messwerte zu duplizieren', () => {
  const t = setup();
  const a = t.call('createMeasurement', { input: input({ notes: 'privat' }) });
  t.setNow('2026-11-01T09:10:00Z');
  t.call('updateMeasurement', { id: a.id, input: input({ systolic: '131', notes: 'privat' }) });
  t.call('deleteMeasurement', { id: a.id });
  const log = t.repo.getAll('AuditLog');
  assert.deepEqual(log.map(l => l.action), ['create', 'update', 'delete']);
  assert.equal(log[1].change_summary, 'Geänderte Felder: systolic');
  const text = JSON.stringify(log);
  assert.ok(!text.includes('131') && !text.includes('privat'));
});
