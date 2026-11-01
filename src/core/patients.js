'use strict';
/**
 * Patientenprofil. Technisch erforderlich ist nur patient_id;
 * alle medizinischen Angaben sind optional.
 */
const Schema = require('./schema');
const Validation = require('./validation');
const { AppError, CODES } = require('./errors');

const DEFAULT_PATIENT_ID = 'patient-1';

/** Liefert die ID des (ersten) Patienten oder legt einen leeren an. */
function ensureDefaultPatient(repo, now) {
  const rows = repo.getAll('Patients');
  if (rows.length) return rows[0].patient_id;
  const ts = new Date(now()).toISOString();
  repo.insert('Patients', {
    patient_id: DEFAULT_PATIENT_ID, birth_year: null, sex: '', height_cm: null,
    hypertension_diagnosis: '', relevant_conditions: '', created_at: ts, updated_at: ts
  });
  return DEFAULT_PATIENT_ID;
}

function createPatientService(deps) {
  function find() {
    return deps.repo.getAll('Patients').filter(p => p.patient_id === deps.patientId)[0] || null;
  }

  function get() {
    const p = find() || { patient_id: deps.patientId };
    return {
      patient_id: p.patient_id,
      birth_year: p.birth_year === undefined ? null : p.birth_year,
      sex: p.sex || '',
      height_cm: p.height_cm === undefined ? null : p.height_cm,
      hypertension_diagnosis: p.hypertension_diagnosis || '',
      relevant_conditions: p.relevant_conditions || ''
    };
  }

  function save(patch) {
    const p = patch || {};
    const errors = [];
    const year = new Date(deps.now()).getUTCFullYear();
    const next = Object.assign({}, find() || { patient_id: deps.patientId, created_at: new Date(deps.now()).toISOString() });

    if (p.birth_year !== undefined) {
      const v = Validation.toNumber(p.birth_year);
      if (v === null) next.birth_year = null;
      else if (isNaN(v) || Math.round(v) !== v || v < 1900 || v > year) errors.push({ field: 'birth_year', message: 'Geburtsjahr zwischen 1900 und ' + year + ' angeben.' });
      else next.birth_year = v;
    }
    if (p.height_cm !== undefined) {
      const v = Validation.toNumber(p.height_cm);
      if (v === null) next.height_cm = null;
      else if (isNaN(v) || v < 50 || v > 250) errors.push({ field: 'height_cm', message: 'Körpergröße zwischen 50 und 250 cm angeben.' });
      else next.height_cm = Math.round(v);
    }
    if (p.sex !== undefined) {
      if (Schema.SEX_OPTIONS.indexOf(p.sex) < 0) errors.push({ field: 'sex', message: 'Ungültige Auswahl.' });
      else next.sex = p.sex;
    }
    if (p.hypertension_diagnosis !== undefined) {
      if (Schema.DIAGNOSIS_OPTIONS.indexOf(p.hypertension_diagnosis) < 0) errors.push({ field: 'hypertension_diagnosis', message: 'Ungültige Auswahl.' });
      else next.hypertension_diagnosis = p.hypertension_diagnosis;
    }
    if (p.relevant_conditions !== undefined) {
      const s = String(p.relevant_conditions || '').trim();
      if (s.length > 500) errors.push({ field: 'relevant_conditions', message: 'Maximal 500 Zeichen.' });
      else next.relevant_conditions = s;
    }
    if (errors.length) throw new AppError(CODES.VALIDATION, errors[0].message, { errors });
    next.updated_at = new Date(deps.now()).toISOString();
    if (find()) deps.repo.update('Patients', next);
    else deps.repo.insert('Patients', next);
    deps.audit.log('patient', deps.patientId, 'update', 'Profil geändert');
    return get();
  }

  return { get, save };
}

module.exports = { DEFAULT_PATIENT_ID, ensureDefaultPatient, createPatientService };
