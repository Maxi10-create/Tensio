'use strict';
const T = require('../src/core');

/** Testumgebung mit fester Uhr, deterministischen IDs und In-Memory-Repository. */
function setup(opts) {
  const o = opts || {};
  let clock = Date.parse(o.now || '2026-11-01T09:00:00Z');
  let n = 0;
  const repo = T.MemoryRepository.createMemoryRepository(o.initial);
  const env = {
    repo,
    now: () => clock,
    newId: () => 'id-' + (++n),
    user: { email: 'test@example.org' }
  };
  const api = T.Api.createApi(env);
  return {
    T, repo, api,
    setNow(iso) { clock = Date.parse(iso); },
    call(method, payload) {
      const r = api.call(method, payload);
      if (!r.ok) throw Object.assign(new Error(r.error.message), r.error);
      return r.data;
    },
    raw: (method, payload) => api.call(method, payload)
  };
}

/** Fiktive Messung im Anzeigeformat. */
function m(date, sys, dia, extra) {
  return Object.assign({ id: date + '-' + sys + '-' + dia, measurement_date: date, measurement_time: '', systolic: sys, diastolic: dia, pulse: null, is_valid: true, deleted_at: '' }, extra || {});
}

module.exports = { T, setup, m };
