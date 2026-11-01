'use strict';
/**
 * AuditLog: protokolliert WAS geändert wurde, nicht die Messwerte selbst
 * (Datenminimierung – keine Duplikation sensibler Inhalte).
 */
function createAudit(deps) {
  return {
    log(entityType, entityId, action, summary) {
      deps.repo.insert('AuditLog', {
        log_id: deps.newId(),
        timestamp: new Date(deps.now()).toISOString(),
        patient_id: deps.patientId,
        entity_type: entityType,
        entity_id: entityId,
        action: action,
        change_summary: summary || ''
      });
    }
  };
}
module.exports = { createAudit };
