'use strict';
/** Fachliche Fehler mit maschinenlesbarem Code und verständlicher Meldung. */
class AppError extends Error {
  constructor(code, message, details) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details || null;
  }
}

const CODES = {
  VALIDATION: 'VALIDATION',
  NEEDS_CONFIRMATION: 'NEEDS_CONFIRMATION',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNKNOWN_METHOD: 'UNKNOWN_METHOD',
  INTERNAL: 'INTERNAL'
};

module.exports = { AppError, CODES };
