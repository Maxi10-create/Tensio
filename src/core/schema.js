'use strict';
/**
 * Datenmodell (Google Sheets). Jede Tabelle entspricht einem Tabellenblatt,
 * die erste Zeile enthält die Spaltennamen. Reihenfolge = Spaltenreihenfolge.
 *
 * Typen: string | number | boolean | json (als String gespeichert)
 * Datums-/Zeitwerte werden als Text gespeichert (ISO 8601), damit Google Sheets
 * sie nicht in zeitzonenabhängige Datumswerte umwandelt.
 * Ausführliche Beschreibung: docs/data-model.md
 */

const SCHEMA_VERSION = 1;

const SHEETS = {
  Measurements: {
    key: 'id',
    columns: {
      id: 'string',
      patient_id: 'string',
      measured_at: 'string',
      measurement_date: 'string',
      systolic: 'number',
      diastolic: 'number',
      pulse: 'number',
      measurement_type: 'string',
      protocol_id: 'string',
      context_tags: 'json',
      symptoms: 'json',
      notes: 'string',
      is_valid: 'boolean',
      source: 'string',
      created_at: 'string',
      updated_at: 'string',
      deleted_at: 'string'
    }
  },
  Patients: {
    key: 'patient_id',
    columns: {
      patient_id: 'string',
      name: 'string',
      birth_date: 'string',
      birth_year: 'number',
      sex: 'string',
      height_cm: 'number',
      hypertension_diagnosis: 'string',
      relevant_conditions: 'string',
      created_at: 'string',
      updated_at: 'string'
    }
  },
  HealthEvents: {
    key: 'event_id',
    columns: {
      event_id: 'string',
      patient_id: 'string',
      event_date: 'string',
      event_type: 'string',
      description: 'string',
      metadata: 'json',
      created_at: 'string',
      updated_at: 'string'
    }
  },
  WeightHistory: {
    key: 'id',
    columns: {
      id: 'string',
      patient_id: 'string',
      date: 'string',
      weight_kg: 'number'
    }
  },
  Protocols: {
    key: 'protocol_id',
    columns: {
      protocol_id: 'string',
      patient_id: 'string',
      protocol_type: 'string',
      start_date: 'string',
      end_date: 'string',
      status: 'string',
      analysis_method: 'string',
      notes: 'string'
    }
  },
  Settings: {
    key: 'patient_id',
    columns: {
      patient_id: 'string',
      timezone: 'string',
      preferred_measurement_time: 'string',
      preferred_chart_period: 'string',
      reference_guideline: 'string',
      theme: 'string',
      application_version: 'string',
      updated_at: 'string'
    }
  },
  AuditLog: {
    key: 'log_id',
    columns: {
      log_id: 'string',
      timestamp: 'string',
      patient_id: 'string',
      entity_type: 'string',
      entity_id: 'string',
      action: 'string',
      change_summary: 'string'
    }
  }
};

const MEASUREMENT_TYPES = ['daily', 'protocol', 'event'];
const SOURCES = ['app', 'historical_import'];

const CONTEXT_TAGS = [
  { key: 'stress', label: 'Stress' },
  { key: 'poor_sleep', label: 'Schlechter Schlaf' },
  { key: 'activity', label: 'Körperliche Aktivität' },
  { key: 'caffeine', label: 'Koffein' },
  { key: 'alcohol', label: 'Alkohol' },
  { key: 'medication', label: 'Medikamente' },
  { key: 'illness', label: 'Erkrankung' },
  { key: 'dehydration', label: 'Flüssigkeitsmangel' },
  { key: 'other', label: 'Sonstiges' }
];

const SYMPTOMS = [
  { key: 'none', label: 'Keine Beschwerden' },
  { key: 'dizziness', label: 'Schwindel' },
  { key: 'weakness', label: 'Schwäche' },
  { key: 'headache', label: 'Kopfschmerzen' },
  { key: 'palpitations', label: 'Herzklopfen' },
  { key: 'other', label: 'Andere Beschwerden' }
];

const CHART_PERIODS = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
  '3y': 1095,
  'all': null
};

const THEMES = ['auto', 'light', 'dark'];
const SEX_OPTIONS = ['', 'female', 'male', 'diverse'];
const DIAGNOSIS_OPTIONS = ['', 'yes', 'no', 'unknown'];

function columnNames(sheet) {
  return Object.keys(SHEETS[sheet].columns);
}

module.exports = {
  SCHEMA_VERSION,
  SHEETS,
  MEASUREMENT_TYPES,
  SOURCES,
  CONTEXT_TAGS,
  SYMPTOMS,
  CHART_PERIODS,
  THEMES,
  SEX_OPTIONS,
  DIAGNOSIS_OPTIONS,
  columnNames
};
