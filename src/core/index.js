'use strict';
/**
 * Einstiegspunkt des Core-Bundles. Wird per esbuild zu einer IIFE mit dem
 * globalen Namen `Tensio` gebündelt (dist/Core.js für Apps Script,
 * dist-preview für den Browser).
 */
module.exports = {
  Schema: require('./schema'),
  Dates: require('./dates'),
  Errors: require('./errors'),
  Validation: require('./validation'),
  Measurements: require('./measurements'),
  Settings: require('./settings'),
  Patients: require('./patients'),
  Dashboard: require('./dashboard'),
  Exporter: require('./exporter'),
  Api: require('./api'),
  MemoryRepository: require('./memoryRepository'),
  DemoData: require('./demoData'),
  Statistics: require('../analytics/statistics'),
  Aggregation: require('../analytics/aggregation'),
  Trends: require('../analytics/trends'),
  MedicalReferences: require('../analytics/medicalReferences')
};
