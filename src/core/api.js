'use strict';
/**
 * Einheitliche API-Schicht. Wird serverseitig von Apps Script (google.script.run)
 * und in der lokalen Vorschau mit einem In-Memory-Repository verwendet.
 *
 * Jede Methode liefert { ok: true, data } oder { ok: false, error: { code, message, details } }.
 * Die Autorisierung erfolgt VOR dem Aufruf (backend/Auth.gs).
 */
const Dates = require('./dates');
const Schema = require('./schema');
const Refs = require('../analytics/medicalReferences');
const { AppError, CODES } = require('./errors');
const { createAudit } = require('./audit');
const { createMeasurementService } = require('./measurements');
const { createSettingsService, APP_VERSION } = require('./settings');
const { ensureDefaultPatient, createPatientService } = require('./patients');
const Dashboard = require('./dashboard');
const Exporter = require('./exporter');

const READ_METHODS = ['bootstrap', 'getDashboard', 'getAnalytics', 'listMeasurements', 'getMeasurement', 'exportMeasurementsCsv'];
const WRITE_METHODS = ['createMeasurement', 'updateMeasurement', 'deleteMeasurement', 'restoreMeasurement', 'saveSettings', 'saveProfile'];

/**
 * @param {object} env { repo, now: () => ms, newId: () => string, localParts?, isValidTimeZone?, user? }
 */
function createApi(env) {
  function context() {
    const patientId = ensureDefaultPatient(env.repo, env.now);
    const base = { repo: env.repo, now: env.now, newId: env.newId, patientId };
    const audit = createAudit(base);
    const settings = createSettingsService(Object.assign({ audit, isValidTimeZone: env.isValidTimeZone }, base));
    const s = settings.get();
    const zone = Dates.createZone(s.timezone, env.localParts);
    return {
      patientId, audit, settings, s, zone,
      today: zone.today(env.now()),
      patients: createPatientService(Object.assign({ audit }, base)),
      measurements: createMeasurementService(Object.assign({ audit, zone }, base))
    };
  }

  const handlers = {
    bootstrap(ctx) {
      return {
        version: APP_VERSION,
        schemaVersion: Schema.SCHEMA_VERSION,
        user: env.user ? { email: env.user.email } : null,
        today: ctx.today,
        settings: ctx.s,
        profile: ctx.patients.get(),
        options: {
          contextTags: Schema.CONTEXT_TAGS,
          symptoms: Schema.SYMPTOMS,
          periods: Object.keys(Schema.CHART_PERIODS),
          guidelines: Refs.listGuidelines(),
          referencesVersion: Refs.REFERENCES_VERSION,
          eshCategories: Refs.GUIDELINES['esh-2023'].methods.office.categories
        }
      };
    },
    getDashboard(ctx, p) {
      const period = (p && p.period) || ctx.s.preferred_chart_period;
      return Dashboard.buildDashboard(ctx.measurements.list(), { today: ctx.today, period, guideline: ctx.s.reference_guideline });
    },
    getAnalytics(ctx, p) {
      return Dashboard.buildAnalytics(ctx.measurements.list(), { today: ctx.today, period: (p && p.period) || '90d', guideline: ctx.s.reference_guideline });
    },
    listMeasurements(ctx, p) {
      return ctx.measurements.list({ deletedOnly: !!(p && p.deletedOnly) });
    },
    getMeasurement(ctx, p) {
      return ctx.measurements.get(p && p.id);
    },
    createMeasurement(ctx, p) {
      return ctx.measurements.create(p && p.input, { confirmed: !!(p && p.confirmed) });
    },
    updateMeasurement(ctx, p) {
      return ctx.measurements.update(p && p.id, p && p.input, { confirmed: !!(p && p.confirmed), expectedUpdatedAt: p && p.expectedUpdatedAt });
    },
    deleteMeasurement(ctx, p) {
      return ctx.measurements.remove(p && p.id);
    },
    restoreMeasurement(ctx, p) {
      return ctx.measurements.restore(p && p.id);
    },
    saveSettings(ctx, p) {
      return ctx.settings.save(p);
    },
    saveProfile(ctx, p) {
      return ctx.patients.save(p);
    },
    exportMeasurementsCsv(ctx, p) {
      const from = p && p.from, to = p && p.to;
      if ((from && !Dates.isValidDateString(from)) || (to && !Dates.isValidDateString(to))) {
        throw new AppError(CODES.VALIDATION, 'Ungültiger Zeitraum für den Export.');
      }
      return {
        filename: 'tensio-messungen' + (from || to ? '_' + (from || 'anfang') + '_' + (to || ctx.today) : '_' + ctx.today) + '.csv',
        csv: Exporter.measurementsToCsv(ctx.measurements.list(), { from, to })
      };
    }
  };

  function call(method, payload) {
    try {
      if (!Object.prototype.hasOwnProperty.call(handlers, method)) {
        throw new AppError(CODES.UNKNOWN_METHOD, 'Unbekannte Aktion.');
      }
      return { ok: true, data: handlers[method](context(), payload || {}) };
    } catch (e) {
      if (e instanceof AppError || (e && e.name === 'AppError')) {
        return { ok: false, error: { code: e.code, message: e.message, details: e.details } };
      }
      if (env.onError) env.onError(e);
      return { ok: false, error: { code: CODES.INTERNAL, message: 'Es ist ein unerwarteter Fehler aufgetreten. Bitte erneut versuchen.' } };
    }
  }

  return { call, isWrite: m => WRITE_METHODS.indexOf(m) >= 0, methods: READ_METHODS.concat(WRITE_METHODS) };
}

module.exports = { createApi, READ_METHODS, WRITE_METHODS };
