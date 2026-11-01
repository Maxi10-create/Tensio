'use strict';
/**
 * Zentrale, versionierte Konfiguration medizinischer Referenzbereiche.
 *
 * WICHTIG
 *  - Grenzwerte werden ausschließlich hier gepflegt, nie in UI-Komponenten.
 *  - Referenzwerte hängen von der Messmethode ab (Praxis vs. Heimmessung).
 *  - Einzelne Alltagsmessungen sind keine Diagnose. Für eine Einordnung nach
 *    Leitlinie ist eine standardisierte Heimmessserie (Messprotokoll, Phase 3)
 *    vorgesehen.
 *  - Es werden keine Therapieempfehlungen abgeleitet.
 *
 * Quellen und Prüfstand: docs/medical-logic.md
 */

const GUIDELINES = {
  'esh-2023': {
    id: 'esh-2023',
    name: 'ESH 2023',
    citation: 'Mancia G, et al. 2023 ESH Guidelines for the management of arterial hypertension. J Hypertens. 2023;41(12):1874–2071.',
    methods: {
      home: {
        label: 'Heimmessung (Mittelwert einer Messserie)',
        hypertensionThreshold: { systolic: 135, diastolic: 85 },
        categories: [
          { key: 'below', label: 'Unter dem Schwellenwert', maxSystolic: 134, maxDiastolic: 84 },
          { key: 'at_or_above', label: 'Am oder über dem Schwellenwert (≥ 135 und/oder ≥ 85 mmHg)' }
        ]
      },
      office: {
        label: 'Praxismessung',
        hypertensionThreshold: { systolic: 140, diastolic: 90 },
        categories: [
          { key: 'optimal', label: 'Optimal', maxSystolic: 119, maxDiastolic: 79 },
          { key: 'normal', label: 'Normal', maxSystolic: 129, maxDiastolic: 84 },
          { key: 'high_normal', label: 'Hoch-normal', maxSystolic: 139, maxDiastolic: 89 },
          { key: 'grade1', label: 'Hypertonie Grad 1', maxSystolic: 159, maxDiastolic: 99 },
          { key: 'grade2', label: 'Hypertonie Grad 2', maxSystolic: 179, maxDiastolic: 109 },
          { key: 'grade3', label: 'Hypertonie Grad 3' }
        ]
      }
    }
  },
  'esc-2024': {
    id: 'esc-2024',
    name: 'ESC 2024',
    citation: 'McEvoy JW, et al. 2024 ESC Guidelines for the management of elevated blood pressure and hypertension. Eur Heart J. 2024;45(38):3912–4018.',
    methods: {
      home: {
        label: 'Heimmessung (Mittelwert einer Messserie)',
        hypertensionThreshold: { systolic: 135, diastolic: 85 },
        categories: [
          { key: 'non_elevated', label: 'Nicht erhöht', maxSystolic: 119, maxDiastolic: 69 },
          { key: 'elevated', label: 'Erhöht', maxSystolic: 134, maxDiastolic: 84 },
          { key: 'hypertension', label: 'Hypertonie-Bereich (≥ 135 und/oder ≥ 85 mmHg)' }
        ]
      },
      office: {
        label: 'Praxismessung',
        hypertensionThreshold: { systolic: 140, diastolic: 90 },
        categories: [
          { key: 'non_elevated', label: 'Nicht erhöht', maxSystolic: 119, maxDiastolic: 69 },
          { key: 'elevated', label: 'Erhöht', maxSystolic: 139, maxDiastolic: 89 },
          { key: 'hypertension', label: 'Hypertonie-Bereich (≥ 140 und/oder ≥ 90 mmHg)' }
        ]
      }
    }
  }
};

const DEFAULT_GUIDELINE = 'esc-2024';
const REFERENCES_VERSION = '2026-11-01';

function getGuideline(id) {
  return GUIDELINES[id] || GUIDELINES[DEFAULT_GUIDELINE];
}

/**
 * Ordnet einen MITTELWERT in eine Kategorie ein. Systolisch und diastolisch
 * werden getrennt bewertet; maßgeblich ist die höhere Kategorie.
 * Für Einzelmessungen nicht verwenden.
 */
function categorize(guidelineId, method, systolic, diastolic) {
  if (typeof systolic !== 'number' || typeof diastolic !== 'number') return null;
  const g = getGuideline(guidelineId);
  const m = g.methods[method];
  if (!m) return null;
  const idx = (value, field) => {
    for (let i = 0; i < m.categories.length; i++) {
      const lim = m.categories[i][field];
      if (lim === undefined || value <= lim) return i;
    }
    return m.categories.length - 1;
  };
  const i = Math.max(idx(systolic, 'maxSystolic'), idx(diastolic, 'maxDiastolic'));
  const c = m.categories[i];
  return {
    key: c.key,
    label: c.label,
    guideline: g.name,
    method: m.label,
    threshold: m.hypertensionThreshold
  };
}

/** Referenzlinien für Diagramme (Schwellenwert der gewählten Methode). */
function referenceLines(guidelineId, method) {
  const g = getGuideline(guidelineId);
  const m = g.methods[method || 'home'];
  return {
    guideline: g.name,
    method: m.label,
    systolic: m.hypertensionThreshold.systolic,
    diastolic: m.hypertensionThreshold.diastolic
  };
}

function listGuidelines() {
  return Object.keys(GUIDELINES).map(k => ({ id: k, name: GUIDELINES[k].name, citation: GUIDELINES[k].citation }));
}

module.exports = {
  GUIDELINES,
  DEFAULT_GUIDELINE,
  REFERENCES_VERSION,
  getGuideline,
  categorize,
  referenceLines,
  listGuidelines
};
