'use strict';
/**
 * Anwendungsfälle rund um Blutdruckmessungen (Application Layer).
 * Unabhängig von Google Apps Script: Datenzugriff über ein Repository-Objekt
 * mit der Schnittstelle { getAll(sheet), insert(sheet, rec), update(sheet, rec) }.
 */
const Validation = require('./validation');
const Dates = require('./dates');
const { AppError, CODES } = require('./errors');
const Refs = require('../analytics/medicalReferences');

const SHEET = 'Measurements';

/** ESH-2023-Einordnung einer Einzelmessung (Praxis-Schwellen). Nur zur Orientierung. */
function eshOf(sys, dia) {
  const c = Refs.categorize('esh-2023', 'office', sys, dia);
  return c ? { key: c.key, label: c.label } : null;
}

/** Zerlegt einen gespeicherten Datensatz in Formular-/Anzeigeform. */
function toView(rec) {
  const t = Dates.splitIso(rec.measured_at);
  return {
    id: rec.id,
    measurement_date: rec.measurement_date,
    measurement_time: t.date === rec.measurement_date ? t.time : '',
    measured_at: rec.measured_at || '',
    systolic: rec.systolic,
    diastolic: rec.diastolic,
    pulse: rec.pulse === undefined ? null : rec.pulse,
    measurement_type: rec.measurement_type || 'daily',
    protocol_id: rec.protocol_id || '',
    context_tags: Validation.toList(rec.context_tags),
    symptoms: Validation.toList(rec.symptoms),
    notes: rec.notes || '',
    is_valid: rec.is_valid !== false,
    source: rec.source || 'app',
    created_at: rec.created_at || '',
    updated_at: rec.updated_at || '',
    deleted_at: rec.deleted_at || '',
    esh: eshOf(rec.systolic, rec.diastolic)
  };
}

function duplicateKey(m) {
  return [m.measurement_date, m.measurement_time || '', m.systolic, m.diastolic].join('|');
}

/**
 * Markiert mögliche Duplikate: gleiche Werte am gleichen Tag zur gleichen
 * (oder unbekannten) Uhrzeit. Der zuerst erfasste Datensatz gilt als Original.
 * Gelöschte Messungen werden ignoriert. Es wird nichts gelöscht.
 */
function markDuplicates(views) {
  const first = {};
  views
    .filter(v => !v.deleted_at)
    .slice()
    .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0))
    .forEach(v => {
      const k = duplicateKey(v);
      if (first[k]) v.duplicate_of = first[k];
      else first[k] = v.id;
    });
  return views;
}

function sortChronological(views) {
  return views.sort((a, b) => {
    if (a.measurement_date !== b.measurement_date) return a.measurement_date < b.measurement_date ? 1 : -1;
    const ta = a.measurement_time || '', tb = b.measurement_time || '';
    if (ta !== tb) return ta < tb ? 1 : -1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

function changedFields(before, after, fields) {
  return fields.filter(f => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
}

const EDITABLE = ['measured_at', 'measurement_date', 'systolic', 'diastolic', 'pulse', 'measurement_type',
  'context_tags', 'symptoms', 'notes', 'is_valid'];

/**
 * @param {object} deps { repo, zone, now: () => ms, newId: () => string, patientId, audit }
 */
function createMeasurementService(deps) {
  const repo = deps.repo;
  const zone = deps.zone;
  const nowIso = () => new Date(deps.now()).toISOString();

  function allRecords() {
    return repo.getAll(SHEET).filter(r => !r.patient_id || r.patient_id === deps.patientId);
  }

  function list(opts) {
    const o = opts || {};
    let views = markDuplicates(allRecords().map(toView));
    if (o.deletedOnly) views = views.filter(v => v.deleted_at);
    else if (!o.includeDeleted) views = views.filter(v => !v.deleted_at);
    views.forEach(v => { v.flags = Validation.plausibilityWarnings(v).map(w => w.code); });
    return sortChronological(views);
  }

  function findRecord(id) {
    const rec = allRecords().filter(r => r.id === id)[0];
    if (!rec) throw new AppError(CODES.NOT_FOUND, 'Die Messung wurde nicht gefunden. Möglicherweise wurde sie inzwischen entfernt.');
    return rec;
  }

  function get(id) {
    const v = toView(findRecord(id));
    v.flags = Validation.plausibilityWarnings(v).map(w => w.code);
    return v;
  }

  function validateOrThrow(input, opts, excludeId) {
    const today = zone.today(deps.now());
    const res = Validation.validateMeasurement(input, { today });
    if (res.errors.length) {
      throw new AppError(CODES.VALIDATION, res.errors[0].message, { errors: res.errors });
    }
    const v = res.value;
    if (v.measurement_date === today && v.measurement_time) {
      const nowLocal = zone.local(deps.now()).time;
      if (v.measurement_time > nowLocal) {
        const [h, m] = nowLocal.split(':').map(Number);
        const [hh, mm] = v.measurement_time.split(':').map(Number);
        if ((hh * 60 + mm) - (h * 60 + m) > 10) {
          throw new AppError(CODES.VALIDATION, 'Die Uhrzeit liegt in der Zukunft.', { errors: [{ field: 'measurement_time', message: 'Die Uhrzeit liegt in der Zukunft.' }] });
        }
      }
    }
    const warnings = res.warnings.slice();
    const dupKey = duplicateKey(v);
    const dup = allRecords().map(toView).filter(x => !x.deleted_at && x.id !== excludeId && duplicateKey(x) === dupKey)[0];
    if (dup) {
      warnings.push({ field: 'systolic', code: 'duplicate', message: 'Eine Messung mit denselben Werten ' + (v.measurement_time ? 'zur selben Uhrzeit ' : '') + 'existiert bereits an diesem Tag.' });
    }
    if (warnings.length && !(opts && opts.confirmed)) {
      throw new AppError(CODES.NEEDS_CONFIRMATION, 'Bitte die Eingabe bestätigen.', { warnings });
    }
    return v;
  }

  function toRecordFields(v) {
    return {
      measured_at: v.measurement_time ? zone.toIso(v.measurement_date, v.measurement_time) : '',
      measurement_date: v.measurement_date,
      systolic: v.systolic,
      diastolic: v.diastolic,
      pulse: v.pulse,
      measurement_type: v.measurement_type,
      context_tags: v.context_tags,
      symptoms: v.symptoms,
      notes: v.notes,
      is_valid: v.is_valid
    };
  }

  function create(input, opts) {
    const v = validateOrThrow(input, opts, null);
    const ts = nowIso();
    const rec = Object.assign({
      id: deps.newId(),
      patient_id: deps.patientId,
      protocol_id: '',
      source: 'app',
      created_at: ts,
      updated_at: ts,
      deleted_at: ''
    }, toRecordFields(v));
    repo.insert(SHEET, rec);
    deps.audit.log('measurement', rec.id, 'create', 'Messung erfasst');
    return get(rec.id);
  }

  function update(id, input, opts) {
    const existing = findRecord(id);
    if (existing.deleted_at) throw new AppError(CODES.CONFLICT, 'Gelöschte Messungen bitte zuerst wiederherstellen.');
    if (opts && opts.expectedUpdatedAt && existing.updated_at && opts.expectedUpdatedAt !== existing.updated_at) {
      throw new AppError(CODES.CONFLICT, 'Die Messung wurde zwischenzeitlich geändert. Bitte neu laden und erneut bearbeiten.');
    }
    const v = validateOrThrow(input, opts, id);
    const before = toView(existing);
    const next = Object.assign({}, existing, toRecordFields(v));
    const changes = changedFields(Object.assign({}, existing, { context_tags: before.context_tags, symptoms: before.symptoms }), next, EDITABLE);
    if (!changes.length) return get(id);
    next.updated_at = nowIso();
    repo.update(SHEET, next);
    deps.audit.log('measurement', id, 'update', 'Geänderte Felder: ' + changes.join(', '));
    return get(id);
  }

  function remove(id) {
    const existing = findRecord(id);
    if (existing.deleted_at) return get(id);
    const ts = nowIso();
    repo.update(SHEET, Object.assign({}, existing, { deleted_at: ts, updated_at: ts }));
    deps.audit.log('measurement', id, 'delete', 'Messung gelöscht (Soft-Delete)');
    return get(id);
  }

  function restore(id) {
    const existing = findRecord(id);
    if (!existing.deleted_at) return get(id);
    repo.update(SHEET, Object.assign({}, existing, { deleted_at: '', updated_at: nowIso() }));
    deps.audit.log('measurement', id, 'restore', 'Messung wiederhergestellt');
    return get(id);
  }

  return { list, get, create, update, remove, restore, records: allRecords };
}

module.exports = { createMeasurementService, toView, markDuplicates, duplicateKey };
