# Datenmodell (Google Sheets)

Ein Spreadsheet, ein Tabellenblatt pro Entität. Zeile 1 enthält die Spaltennamen; Spalten werden
über den Namen angesprochen (Reihenfolge ist egal, zusätzliche eigene Spalten bleiben erhalten).
Die maßgebliche Definition steht in `src/core/schema.js`. Das Menü **Tensio → Tabellenblätter
einrichten / prüfen** legt fehlende Blätter und Spalten an.

Konventionen:

* **IDs:** UUID v4 (`Utilities.getUuid()`), stabil über alle Änderungen. Demo-Daten beginnen mit `demo-`.
* **Datum:** `YYYY-MM-DD` als Text (lokales Datum des Patienten). Maßgeblich für Tagesaggregationen.
* **Zeitpunkte:** ISO 8601 als Text. `measured_at` mit Offset der Nutzerzeitzone (`2026-03-29T07:30:00+02:00`),
  `created_at`/`updated_at`/`deleted_at` in UTC (`…Z`). Text-Spalten sind als „Nur Text“ formatiert,
  damit Sheets nichts in Datumswerte umwandelt.
* **Listen** (`context_tags`, `symptoms`, `metadata`) als JSON-Text, z. B. `["stress","caffeine"]`.
* **Leere Zelle** = Wert unbekannt. Es werden keine Werte erfunden.

## Measurements

| Spalte | Typ | Pflicht | Beschreibung |
|---|---|---|---|
| id | UUID | ja | Eindeutige ID |
| patient_id | String | ja | Referenz auf Patients |
| measured_at | ISO-DateTime | nein | Messzeitpunkt. **Leer, wenn die Uhrzeit unbekannt ist** (historische Daten) |
| measurement_date | Datum | ja | Kalendertag der Messung |
| systolic | Zahl | ja | mmHg, ganzzahlig, 50–300 |
| diastolic | Zahl | ja | mmHg, ganzzahlig, 20–200, < systolic |
| pulse | Zahl | nein | /min, 20–250 |
| measurement_type | Enum | ja | `daily`, `protocol`, `event` |
| protocol_id | String | nein | Referenz auf Protocols (Phase 3) |
| context_tags | JSON | nein | `stress`, `poor_sleep`, `activity`, `caffeine`, `alcohol`, `medication`, `illness`, `dehydration`, `other` |
| symptoms | JSON | nein | `none`, `dizziness`, `weakness`, `headache`, `palpitations`, `other` |
| notes | String | nein | Freitext, max. 1000 Zeichen |
| is_valid | Boolean | ja | `FALSE` = als Messfehler markiert; bleibt gespeichert, fließt nicht in Analysen ein |
| source | Enum | ja | `app`, `historical_import` |
| created_at | ISO-DateTime | ja | Erstellung |
| updated_at | ISO-DateTime | ja | Letzte Änderung (auch für die optimistische Sperre) |
| deleted_at | ISO-DateTime | nein | Soft-Delete. Gesetzt = gelöscht, aus Ansichten und Analysen ausgeschlossen, wiederherstellbar |

Mehrere Messungen pro Tag sind erlaubt. **Mögliche Duplikate** (gleicher Tag, gleiche Uhrzeit oder
beide ohne Uhrzeit, gleiche Werte) werden beim Lesen erkannt und in der Liste markiert. Beim Erfassen
fragt die App vorher nach. Es wird nichts automatisch gelöscht.

## Patients

`patient_id`, `birth_year`, `sex` (`female`/`male`/`diverse`/leer), `height_cm`,
`hypertension_diagnosis` (`yes`/`no`/`unknown`/leer), `relevant_conditions`, `created_at`, `updated_at`.
Nur `patient_id` ist erforderlich. Beim ersten Start wird `patient-1` angelegt.

## HealthEvents (Phase 2)

`event_id`, `patient_id`, `event_date`, `event_type`, `description`, `metadata` (JSON), `created_at`, `updated_at`.

## WeightHistory (Phase 4)

`id`, `patient_id`, `date`, `weight_kg`. Gewicht ist zeitabhängig und wird nie rückwirkend auf alte Messungen übertragen.

## Protocols (Phase 3)

`protocol_id`, `patient_id`, `protocol_type`, `start_date`, `end_date`, `status`, `analysis_method`, `notes`.

## Settings

`patient_id`, `timezone` (IANA, Standard `Europe/Berlin`), `preferred_measurement_time`,
`preferred_chart_period` (`7d`, `30d`, `90d`, `1y`, `3y`, `all`), `reference_guideline` (`esc-2024`, `esh-2023`),
`theme` (`auto`, `light`, `dark`), `application_version`, `updated_at`.

## AuditLog

`log_id`, `timestamp`, `patient_id`, `entity_type`, `entity_id`, `action` (`create`, `update`, `delete`, `restore`),
`change_summary` (nur Feldnamen, keine Werte).

## Historische Daten importieren

1. Digitalisierte Altdaten in das Blatt `Measurements` einfügen. Mindestens `measurement_date`, `systolic`
   und `diastolic` müssen gefüllt sein; `measured_at` nur, wenn die Uhrzeit wirklich bekannt ist.
2. **Tensio → Importierte Messungen vervollständigen** ausführen. Das vergibt IDs und setzt `source = historical_import`,
   `measurement_type = daily`, `is_valid = TRUE` und die Zeitstempel. Uhrzeiten werden nicht ergänzt.

`samples/demo-measurements.csv` zeigt das Format mit fiktiven Werten.
