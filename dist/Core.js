/* Tensio 0.1.0 – generiert aus src/core und src/analytics. Nicht direkt bearbeiten. */
"use strict";
var Tensio = (() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/core/schema.js
  var require_schema = __commonJS({
    "src/core/schema.js"(exports, module) {
      "use strict";
      var SCHEMA_VERSION = 1;
      var SHEETS = {
        Measurements: {
          key: "id",
          columns: {
            id: "string",
            patient_id: "string",
            measured_at: "string",
            measurement_date: "string",
            systolic: "number",
            diastolic: "number",
            pulse: "number",
            measurement_type: "string",
            protocol_id: "string",
            context_tags: "json",
            symptoms: "json",
            notes: "string",
            is_valid: "boolean",
            source: "string",
            created_at: "string",
            updated_at: "string",
            deleted_at: "string"
          }
        },
        Patients: {
          key: "patient_id",
          columns: {
            patient_id: "string",
            birth_year: "number",
            sex: "string",
            height_cm: "number",
            hypertension_diagnosis: "string",
            relevant_conditions: "string",
            created_at: "string",
            updated_at: "string"
          }
        },
        HealthEvents: {
          key: "event_id",
          columns: {
            event_id: "string",
            patient_id: "string",
            event_date: "string",
            event_type: "string",
            description: "string",
            metadata: "json",
            created_at: "string",
            updated_at: "string"
          }
        },
        WeightHistory: {
          key: "id",
          columns: {
            id: "string",
            patient_id: "string",
            date: "string",
            weight_kg: "number"
          }
        },
        Protocols: {
          key: "protocol_id",
          columns: {
            protocol_id: "string",
            patient_id: "string",
            protocol_type: "string",
            start_date: "string",
            end_date: "string",
            status: "string",
            analysis_method: "string",
            notes: "string"
          }
        },
        Settings: {
          key: "patient_id",
          columns: {
            patient_id: "string",
            timezone: "string",
            preferred_measurement_time: "string",
            preferred_chart_period: "string",
            reference_guideline: "string",
            theme: "string",
            application_version: "string",
            updated_at: "string"
          }
        },
        AuditLog: {
          key: "log_id",
          columns: {
            log_id: "string",
            timestamp: "string",
            patient_id: "string",
            entity_type: "string",
            entity_id: "string",
            action: "string",
            change_summary: "string"
          }
        }
      };
      var MEASUREMENT_TYPES = ["daily", "protocol", "event"];
      var SOURCES = ["app", "historical_import"];
      var CONTEXT_TAGS = [
        { key: "stress", label: "Stress" },
        { key: "poor_sleep", label: "Schlechter Schlaf" },
        { key: "activity", label: "K\xF6rperliche Aktivit\xE4t" },
        { key: "caffeine", label: "Koffein" },
        { key: "alcohol", label: "Alkohol" },
        { key: "medication", label: "Medikamente" },
        { key: "illness", label: "Erkrankung" },
        { key: "dehydration", label: "Fl\xFCssigkeitsmangel" },
        { key: "other", label: "Sonstiges" }
      ];
      var SYMPTOMS = [
        { key: "none", label: "Keine Beschwerden" },
        { key: "dizziness", label: "Schwindel" },
        { key: "weakness", label: "Schw\xE4che" },
        { key: "headache", label: "Kopfschmerzen" },
        { key: "palpitations", label: "Herzklopfen" },
        { key: "other", label: "Andere Beschwerden" }
      ];
      var CHART_PERIODS = {
        "7d": 7,
        "30d": 30,
        "90d": 90,
        "1y": 365,
        "3y": 1095,
        "all": null
      };
      var THEMES = ["auto", "light", "dark"];
      var SEX_OPTIONS = ["", "female", "male", "diverse"];
      var DIAGNOSIS_OPTIONS = ["", "yes", "no", "unknown"];
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
    }
  });

  // src/core/dates.js
  var require_dates = __commonJS({
    "src/core/dates.js"(exports, module) {
      "use strict";
      var DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
      var TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
      var DAY_MS = 864e5;
      function pad(n, w) {
        let s = String(Math.abs(n));
        while (s.length < (w || 2)) s = "0" + s;
        return s;
      }
      function isValidDateString(s) {
        if (typeof s !== "string") return false;
        const m = DATE_RE.exec(s);
        if (!m) return false;
        const y = +m[1], mo = +m[2], d = +m[3];
        const t = new Date(Date.UTC(y, mo - 1, d));
        return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d;
      }
      function isValidTimeString(s) {
        return typeof s === "string" && TIME_RE.test(s);
      }
      function toDayNumber(dateStr) {
        const m = DATE_RE.exec(dateStr);
        if (!m) throw new Error("Ung\xFCltiges Datum: " + dateStr);
        return Math.round(Date.UTC(+m[1], +m[2] - 1, +m[3]) / DAY_MS);
      }
      function fromDayNumber(n) {
        const d = new Date(n * DAY_MS);
        return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
      }
      function addDays(dateStr, days) {
        return fromDayNumber(toDayNumber(dateStr) + days);
      }
      function daysBetween(a, b) {
        return toDayNumber(b) - toDayNumber(a);
      }
      function isoWeekKey(dateStr) {
        const n = toDayNumber(dateStr);
        const d = new Date(n * DAY_MS);
        const dow = (d.getUTCDay() + 6) % 7;
        const thursday = new Date((n - dow + 3) * DAY_MS);
        const year = thursday.getUTCFullYear();
        const jan4 = Date.UTC(year, 0, 4) / DAY_MS;
        const jan4dow = (new Date(jan4 * DAY_MS).getUTCDay() + 6) % 7;
        const week1Monday = jan4 - jan4dow;
        const week = Math.floor((n - dow - week1Monday) / 7) + 1;
        return year + "-W" + pad(week);
      }
      function monthKey(dateStr) {
        return dateStr.slice(0, 7);
      }
      function quarterKey(dateStr) {
        const m = +dateStr.slice(5, 7);
        return dateStr.slice(0, 4) + "-Q" + (Math.floor((m - 1) / 3) + 1);
      }
      function yearKey(dateStr) {
        return dateStr.slice(0, 4);
      }
      function localPartsIntl(ms, timeZone) {
        const fmt = new Intl.DateTimeFormat("en-CA", {
          timeZone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23"
        });
        const parts = {};
        fmt.formatToParts(new Date(ms)).forEach((p) => {
          parts[p.type] = p.value;
        });
        const hour = parts.hour === "24" ? "00" : parts.hour;
        const wallUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +hour, +parts.minute, +parts.second);
        const offsetMinutes = Math.round((wallUtc - Math.floor(ms / 1e3) * 1e3) / 6e4);
        return {
          date: parts.year + "-" + parts.month + "-" + parts.day,
          time: hour + ":" + parts.minute,
          offsetMinutes
        };
      }
      function formatOffset(minutes) {
        const sign = minutes < 0 ? "-" : "+";
        const a = Math.abs(minutes);
        return sign + pad(Math.floor(a / 60)) + ":" + pad(a % 60);
      }
      function createZone(timeZone, localParts) {
        const lp = localParts || localPartsIntl;
        return {
          timeZone,
          /** Lokales Datum + Uhrzeit für einen Zeitpunkt. */
          local(ms) {
            return lp(ms, timeZone);
          },
          /** Heutiges lokales Datum. */
          today(nowMs) {
            return lp(nowMs, timeZone).date;
          },
          /**
           * Wandelt lokales Datum + Uhrzeit in ISO 8601 mit korrektem Offset um
           * (sommerzeitfest durch zweistufige Offset-Bestimmung).
           */
          toIso(dateStr, timeStr) {
            if (!isValidDateString(dateStr) || !isValidTimeString(timeStr)) return "";
            const wall = Date.UTC(
              +dateStr.slice(0, 4),
              +dateStr.slice(5, 7) - 1,
              +dateStr.slice(8, 10),
              +timeStr.slice(0, 2),
              +timeStr.slice(3, 5)
            );
            let off = lp(wall, timeZone).offsetMinutes;
            const off2 = lp(wall - off * 6e4, timeZone).offsetMinutes;
            if (off2 !== off) off = off2;
            return dateStr + "T" + timeStr + ":00" + formatOffset(off);
          }
        };
      }
      function splitIso(iso) {
        if (typeof iso !== "string" || iso.length < 16) return { date: "", time: "" };
        return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
      }
      function isoToMs(iso) {
        const t = Date.parse(iso);
        return isNaN(t) ? null : t;
      }
      module.exports = {
        DAY_MS,
        pad,
        isValidDateString,
        isValidTimeString,
        toDayNumber,
        fromDayNumber,
        addDays,
        daysBetween,
        isoWeekKey,
        monthKey,
        quarterKey,
        yearKey,
        localPartsIntl,
        formatOffset,
        createZone,
        splitIso,
        isoToMs
      };
    }
  });

  // src/core/errors.js
  var require_errors = __commonJS({
    "src/core/errors.js"(exports, module) {
      "use strict";
      var AppError = class extends Error {
        constructor(code, message, details) {
          super(message);
          this.name = "AppError";
          this.code = code;
          this.details = details || null;
        }
      };
      var CODES = {
        VALIDATION: "VALIDATION",
        NEEDS_CONFIRMATION: "NEEDS_CONFIRMATION",
        NOT_FOUND: "NOT_FOUND",
        CONFLICT: "CONFLICT",
        UNAUTHORIZED: "UNAUTHORIZED",
        UNKNOWN_METHOD: "UNKNOWN_METHOD",
        INTERNAL: "INTERNAL"
      };
      module.exports = { AppError, CODES };
    }
  });

  // src/core/validation.js
  var require_validation = __commonJS({
    "src/core/validation.js"(exports, module) {
      "use strict";
      var Schema = require_schema();
      var Dates = require_dates();
      var LIMITS = {
        systolic: { min: 50, max: 300, warnLow: 90, warnHigh: 180 },
        diastolic: { min: 20, max: 200, warnLow: 50, warnHigh: 110 },
        pulse: { min: 20, max: 250, warnLow: 40, warnHigh: 150 },
        pulsePressure: { warnLow: 20, warnHigh: 100 },
        notesMaxLength: 1e3,
        earliestDate: "1900-01-01"
      };
      var LABELS = { systolic: "Systolischer Wert", diastolic: "Diastolischer Wert", pulse: "Puls" };
      function toNumber(v) {
        if (v === null || v === void 0 || v === "") return null;
        if (typeof v === "number") return v;
        const s = String(v).trim().replace(",", ".");
        if (!/^-?\d+(\.\d+)?$/.test(s)) return NaN;
        return Number(s);
      }
      function toList(v) {
        if (v === null || v === void 0 || v === "") return [];
        if (Array.isArray(v)) return v.map(String);
        if (typeof v === "string") {
          try {
            const parsed = JSON.parse(v);
            if (Array.isArray(parsed)) return parsed.map(String);
          } catch (e) {
          }
          return v.split(",").map((s) => s.trim()).filter(Boolean);
        }
        return [];
      }
      function checkNumber(field, raw, required, errors) {
        const v = toNumber(raw);
        const lim = LIMITS[field];
        if (v === null) {
          if (required) errors.push({ field, message: LABELS[field] + " fehlt." });
          return null;
        }
        if (isNaN(v)) {
          errors.push({ field, message: LABELS[field] + " muss eine Zahl sein." });
          return null;
        }
        if (Math.round(v) !== v) {
          errors.push({ field, message: LABELS[field] + " bitte als ganze Zahl eingeben." });
          return null;
        }
        if (v < lim.min || v > lim.max) {
          errors.push({ field, message: LABELS[field] + " muss zwischen " + lim.min + " und " + lim.max + " liegen." });
          return null;
        }
        return v;
      }
      function plausibilityWarnings(m) {
        const w = [];
        const s = m.systolic, d = m.diastolic, p = m.pulse;
        if (typeof s === "number") {
          if (s >= LIMITS.systolic.warnHigh) w.push({ field: "systolic", code: "systolic_high", message: "Systolischer Wert ist sehr hoch (\u2265 " + LIMITS.systolic.warnHigh + " mmHg)." });
          if (s < LIMITS.systolic.warnLow) w.push({ field: "systolic", code: "systolic_low", message: "Systolischer Wert ist ungew\xF6hnlich niedrig (< " + LIMITS.systolic.warnLow + " mmHg)." });
        }
        if (typeof d === "number") {
          if (d >= LIMITS.diastolic.warnHigh) w.push({ field: "diastolic", code: "diastolic_high", message: "Diastolischer Wert ist sehr hoch (\u2265 " + LIMITS.diastolic.warnHigh + " mmHg)." });
          if (d < LIMITS.diastolic.warnLow) w.push({ field: "diastolic", code: "diastolic_low", message: "Diastolischer Wert ist ungew\xF6hnlich niedrig (< " + LIMITS.diastolic.warnLow + " mmHg)." });
        }
        if (typeof s === "number" && typeof d === "number" && s > d) {
          const pp = s - d;
          if (pp < LIMITS.pulsePressure.warnLow) w.push({ field: "diastolic", code: "pulse_pressure_low", message: "Abstand zwischen systolischem und diastolischem Wert ist ungew\xF6hnlich klein (" + pp + " mmHg)." });
          if (pp > LIMITS.pulsePressure.warnHigh) w.push({ field: "systolic", code: "pulse_pressure_high", message: "Abstand zwischen systolischem und diastolischem Wert ist ungew\xF6hnlich gro\xDF (" + pp + " mmHg)." });
        }
        if (typeof p === "number") {
          if (p > LIMITS.pulse.warnHigh) w.push({ field: "pulse", code: "pulse_high", message: "Puls ist ungew\xF6hnlich hoch (> " + LIMITS.pulse.warnHigh + " /min)." });
          if (p < LIMITS.pulse.warnLow) w.push({ field: "pulse", code: "pulse_low", message: "Puls ist ungew\xF6hnlich niedrig (< " + LIMITS.pulse.warnLow + " /min)." });
        }
        return w;
      }
      function validateMeasurement(input, ctx) {
        const errors = [];
        const inp = input || {};
        const today = ctx && ctx.today;
        const systolic = checkNumber("systolic", inp.systolic, true, errors);
        const diastolic = checkNumber("diastolic", inp.diastolic, true, errors);
        const pulse = checkNumber("pulse", inp.pulse, false, errors);
        if (systolic !== null && diastolic !== null && diastolic >= systolic) {
          errors.push({ field: "diastolic", message: "Der diastolische Wert muss kleiner als der systolische sein. Wurden die Felder vertauscht?" });
        }
        const date = typeof inp.measurement_date === "string" ? inp.measurement_date.trim() : "";
        if (!Dates.isValidDateString(date)) {
          errors.push({ field: "measurement_date", message: "Bitte ein g\xFCltiges Datum angeben." });
        } else {
          if (today && date > today) errors.push({ field: "measurement_date", message: "Das Datum liegt in der Zukunft." });
          if (date < LIMITS.earliestDate) errors.push({ field: "measurement_date", message: "Das Datum ist unplausibel fr\xFCh." });
        }
        const time = typeof inp.measurement_time === "string" ? inp.measurement_time.trim() : "";
        if (time && !Dates.isValidTimeString(time)) {
          errors.push({ field: "measurement_time", message: "Bitte eine g\xFCltige Uhrzeit (HH:MM) angeben oder leer lassen." });
        }
        const type = inp.measurement_type || "daily";
        if (Schema.MEASUREMENT_TYPES.indexOf(type) < 0) errors.push({ field: "measurement_type", message: "Unbekannte Messart." });
        const allowedTags = Schema.CONTEXT_TAGS.map((t) => t.key);
        const tags = toList(inp.context_tags);
        if (tags.some((t) => allowedTags.indexOf(t) < 0)) errors.push({ field: "context_tags", message: "Unbekannter Einflussfaktor." });
        const allowedSymptoms = Schema.SYMPTOMS.map((t) => t.key);
        const symptoms = toList(inp.symptoms);
        if (symptoms.some((t) => allowedSymptoms.indexOf(t) < 0)) errors.push({ field: "symptoms", message: "Unbekanntes Symptom." });
        const notes = inp.notes === null || inp.notes === void 0 ? "" : String(inp.notes).trim();
        if (notes.length > LIMITS.notesMaxLength) errors.push({ field: "notes", message: "Die Notiz ist zu lang (max. " + LIMITS.notesMaxLength + " Zeichen)." });
        const value = {
          systolic,
          diastolic,
          pulse,
          measurement_date: date,
          measurement_time: time,
          measurement_type: type,
          context_tags: tags,
          symptoms,
          notes,
          is_valid: inp.is_valid === false || inp.is_valid === "false" ? false : true
        };
        const warnings = errors.length ? [] : plausibilityWarnings(value);
        return { errors, warnings, value };
      }
      module.exports = { LIMITS, toNumber, toList, plausibilityWarnings, validateMeasurement };
    }
  });

  // src/analytics/medicalReferences.js
  var require_medicalReferences = __commonJS({
    "src/analytics/medicalReferences.js"(exports, module) {
      "use strict";
      var GUIDELINES = {
        "esh-2023": {
          id: "esh-2023",
          name: "ESH 2023",
          citation: "Mancia G, et al. 2023 ESH Guidelines for the management of arterial hypertension. J Hypertens. 2023;41(12):1874\u20132071.",
          methods: {
            home: {
              label: "Heimmessung (Mittelwert einer Messserie)",
              hypertensionThreshold: { systolic: 135, diastolic: 85 },
              categories: [
                { key: "below", label: "Unter dem Schwellenwert", maxSystolic: 134, maxDiastolic: 84 },
                { key: "at_or_above", label: "Am oder \xFCber dem Schwellenwert (\u2265 135 und/oder \u2265 85 mmHg)" }
              ]
            },
            office: {
              label: "Praxismessung",
              hypertensionThreshold: { systolic: 140, diastolic: 90 },
              categories: [
                { key: "optimal", label: "Optimal", maxSystolic: 119, maxDiastolic: 79 },
                { key: "normal", label: "Normal", maxSystolic: 129, maxDiastolic: 84 },
                { key: "high_normal", label: "Hoch-normal", maxSystolic: 139, maxDiastolic: 89 },
                { key: "grade1", label: "Hypertonie Grad 1", maxSystolic: 159, maxDiastolic: 99 },
                { key: "grade2", label: "Hypertonie Grad 2", maxSystolic: 179, maxDiastolic: 109 },
                { key: "grade3", label: "Hypertonie Grad 3" }
              ]
            }
          }
        },
        "esc-2024": {
          id: "esc-2024",
          name: "ESC 2024",
          citation: "McEvoy JW, et al. 2024 ESC Guidelines for the management of elevated blood pressure and hypertension. Eur Heart J. 2024;45(38):3912\u20134018.",
          methods: {
            home: {
              label: "Heimmessung (Mittelwert einer Messserie)",
              hypertensionThreshold: { systolic: 135, diastolic: 85 },
              categories: [
                { key: "non_elevated", label: "Nicht erh\xF6ht", maxSystolic: 119, maxDiastolic: 69 },
                { key: "elevated", label: "Erh\xF6ht", maxSystolic: 134, maxDiastolic: 84 },
                { key: "hypertension", label: "Hypertonie-Bereich (\u2265 135 und/oder \u2265 85 mmHg)" }
              ]
            },
            office: {
              label: "Praxismessung",
              hypertensionThreshold: { systolic: 140, diastolic: 90 },
              categories: [
                { key: "non_elevated", label: "Nicht erh\xF6ht", maxSystolic: 119, maxDiastolic: 69 },
                { key: "elevated", label: "Erh\xF6ht", maxSystolic: 139, maxDiastolic: 89 },
                { key: "hypertension", label: "Hypertonie-Bereich (\u2265 140 und/oder \u2265 90 mmHg)" }
              ]
            }
          }
        }
      };
      var DEFAULT_GUIDELINE = "esc-2024";
      var REFERENCES_VERSION = "2026-11-01";
      function getGuideline(id) {
        return GUIDELINES[id] || GUIDELINES[DEFAULT_GUIDELINE];
      }
      function categorize(guidelineId, method, systolic, diastolic) {
        if (typeof systolic !== "number" || typeof diastolic !== "number") return null;
        const g = getGuideline(guidelineId);
        const m = g.methods[method];
        if (!m) return null;
        const idx = (value, field) => {
          for (let i2 = 0; i2 < m.categories.length; i2++) {
            const lim = m.categories[i2][field];
            if (lim === void 0 || value <= lim) return i2;
          }
          return m.categories.length - 1;
        };
        const i = Math.max(idx(systolic, "maxSystolic"), idx(diastolic, "maxDiastolic"));
        const c = m.categories[i];
        return {
          key: c.key,
          label: c.label,
          guideline: g.name,
          method: m.label,
          threshold: m.hypertensionThreshold
        };
      }
      function referenceLines(guidelineId, method) {
        const g = getGuideline(guidelineId);
        const m = g.methods[method || "home"];
        return {
          guideline: g.name,
          method: m.label,
          systolic: m.hypertensionThreshold.systolic,
          diastolic: m.hypertensionThreshold.diastolic
        };
      }
      function listGuidelines() {
        return Object.keys(GUIDELINES).map((k) => ({ id: k, name: GUIDELINES[k].name, citation: GUIDELINES[k].citation }));
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
    }
  });

  // src/core/measurements.js
  var require_measurements = __commonJS({
    "src/core/measurements.js"(exports, module) {
      "use strict";
      var Validation = require_validation();
      var Dates = require_dates();
      var { AppError, CODES } = require_errors();
      var Refs = require_medicalReferences();
      var SHEET = "Measurements";
      function eshOf(sys, dia) {
        const c = Refs.categorize("esh-2023", "office", sys, dia);
        return c ? { key: c.key, label: c.label } : null;
      }
      function toView(rec) {
        const t = Dates.splitIso(rec.measured_at);
        return {
          id: rec.id,
          measurement_date: rec.measurement_date,
          measurement_time: t.date === rec.measurement_date ? t.time : "",
          measured_at: rec.measured_at || "",
          systolic: rec.systolic,
          diastolic: rec.diastolic,
          pulse: rec.pulse === void 0 ? null : rec.pulse,
          measurement_type: rec.measurement_type || "daily",
          protocol_id: rec.protocol_id || "",
          context_tags: Validation.toList(rec.context_tags),
          symptoms: Validation.toList(rec.symptoms),
          notes: rec.notes || "",
          is_valid: rec.is_valid !== false,
          source: rec.source || "app",
          created_at: rec.created_at || "",
          updated_at: rec.updated_at || "",
          deleted_at: rec.deleted_at || "",
          esh: eshOf(rec.systolic, rec.diastolic)
        };
      }
      function duplicateKey(m) {
        return [m.measurement_date, m.measurement_time || "", m.systolic, m.diastolic].join("|");
      }
      function markDuplicates(views) {
        const first = {};
        views.filter((v) => !v.deleted_at).slice().sort((a, b) => a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0).forEach((v) => {
          const k = duplicateKey(v);
          if (first[k]) v.duplicate_of = first[k];
          else first[k] = v.id;
        });
        return views;
      }
      function sortChronological(views) {
        return views.sort((a, b) => {
          if (a.measurement_date !== b.measurement_date) return a.measurement_date < b.measurement_date ? 1 : -1;
          const ta = a.measurement_time || "", tb = b.measurement_time || "";
          if (ta !== tb) return ta < tb ? 1 : -1;
          return a.created_at < b.created_at ? 1 : -1;
        });
      }
      function changedFields(before, after, fields) {
        return fields.filter((f) => JSON.stringify(before[f]) !== JSON.stringify(after[f]));
      }
      var EDITABLE = [
        "measured_at",
        "measurement_date",
        "systolic",
        "diastolic",
        "pulse",
        "measurement_type",
        "context_tags",
        "symptoms",
        "notes",
        "is_valid"
      ];
      function createMeasurementService(deps) {
        const repo = deps.repo;
        const zone = deps.zone;
        const nowIso = () => new Date(deps.now()).toISOString();
        function allRecords() {
          return repo.getAll(SHEET).filter((r) => !r.patient_id || r.patient_id === deps.patientId);
        }
        function list(opts) {
          const o = opts || {};
          let views = markDuplicates(allRecords().map(toView));
          if (o.deletedOnly) views = views.filter((v) => v.deleted_at);
          else if (!o.includeDeleted) views = views.filter((v) => !v.deleted_at);
          views.forEach((v) => {
            v.flags = Validation.plausibilityWarnings(v).map((w) => w.code);
          });
          return sortChronological(views);
        }
        function findRecord(id) {
          const rec = allRecords().filter((r) => r.id === id)[0];
          if (!rec) throw new AppError(CODES.NOT_FOUND, "Die Messung wurde nicht gefunden. M\xF6glicherweise wurde sie inzwischen entfernt.");
          return rec;
        }
        function get(id) {
          const v = toView(findRecord(id));
          v.flags = Validation.plausibilityWarnings(v).map((w) => w.code);
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
              const [h, m] = nowLocal.split(":").map(Number);
              const [hh, mm] = v.measurement_time.split(":").map(Number);
              if (hh * 60 + mm - (h * 60 + m) > 10) {
                throw new AppError(CODES.VALIDATION, "Die Uhrzeit liegt in der Zukunft.", { errors: [{ field: "measurement_time", message: "Die Uhrzeit liegt in der Zukunft." }] });
              }
            }
          }
          const warnings = res.warnings.slice();
          const dupKey = duplicateKey(v);
          const dup = allRecords().map(toView).filter((x) => !x.deleted_at && x.id !== excludeId && duplicateKey(x) === dupKey)[0];
          if (dup) {
            warnings.push({ field: "systolic", code: "duplicate", message: "Eine Messung mit denselben Werten " + (v.measurement_time ? "zur selben Uhrzeit " : "") + "existiert bereits an diesem Tag." });
          }
          if (warnings.length && !(opts && opts.confirmed)) {
            throw new AppError(CODES.NEEDS_CONFIRMATION, "Bitte die Eingabe best\xE4tigen.", { warnings });
          }
          return v;
        }
        function toRecordFields(v) {
          return {
            measured_at: v.measurement_time ? zone.toIso(v.measurement_date, v.measurement_time) : "",
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
            protocol_id: "",
            source: "app",
            created_at: ts,
            updated_at: ts,
            deleted_at: ""
          }, toRecordFields(v));
          repo.insert(SHEET, rec);
          deps.audit.log("measurement", rec.id, "create", "Messung erfasst");
          return get(rec.id);
        }
        function update(id, input, opts) {
          const existing = findRecord(id);
          if (existing.deleted_at) throw new AppError(CODES.CONFLICT, "Gel\xF6schte Messungen bitte zuerst wiederherstellen.");
          if (opts && opts.expectedUpdatedAt && existing.updated_at && opts.expectedUpdatedAt !== existing.updated_at) {
            throw new AppError(CODES.CONFLICT, "Die Messung wurde zwischenzeitlich ge\xE4ndert. Bitte neu laden und erneut bearbeiten.");
          }
          const v = validateOrThrow(input, opts, id);
          const before = toView(existing);
          const next = Object.assign({}, existing, toRecordFields(v));
          const changes = changedFields(Object.assign({}, existing, { context_tags: before.context_tags, symptoms: before.symptoms }), next, EDITABLE);
          if (!changes.length) return get(id);
          next.updated_at = nowIso();
          repo.update(SHEET, next);
          deps.audit.log("measurement", id, "update", "Ge\xE4nderte Felder: " + changes.join(", "));
          return get(id);
        }
        function remove(id) {
          const existing = findRecord(id);
          if (existing.deleted_at) return get(id);
          const ts = nowIso();
          repo.update(SHEET, Object.assign({}, existing, { deleted_at: ts, updated_at: ts }));
          deps.audit.log("measurement", id, "delete", "Messung gel\xF6scht (Soft-Delete)");
          return get(id);
        }
        function restore(id) {
          const existing = findRecord(id);
          if (!existing.deleted_at) return get(id);
          repo.update(SHEET, Object.assign({}, existing, { deleted_at: "", updated_at: nowIso() }));
          deps.audit.log("measurement", id, "restore", "Messung wiederhergestellt");
          return get(id);
        }
        return { list, get, create, update, remove, restore, records: allRecords };
      }
      module.exports = { createMeasurementService, toView, markDuplicates, duplicateKey };
    }
  });

  // src/core/settings.js
  var require_settings = __commonJS({
    "src/core/settings.js"(exports, module) {
      "use strict";
      var Schema = require_schema();
      var Refs = require_medicalReferences();
      var Dates = require_dates();
      var { AppError, CODES } = require_errors();
      var APP_VERSION = "0.1.0";
      var DEFAULTS = {
        timezone: "Europe/Berlin",
        preferred_measurement_time: "",
        preferred_chart_period: "30d",
        reference_guideline: Refs.DEFAULT_GUIDELINE,
        theme: "auto"
      };
      function isValidTimeZone(tz) {
        if (typeof tz !== "string" || !tz) return false;
        try {
          new Intl.DateTimeFormat("en-US", { timeZone: tz });
          return true;
        } catch (e) {
          return false;
        }
      }
      function createSettingsService(deps) {
        const tzCheck = deps.isValidTimeZone || isValidTimeZone;
        function find() {
          return deps.repo.getAll("Settings").filter((s) => s.patient_id === deps.patientId)[0] || null;
        }
        function get() {
          const s = find() || {};
          const out = { patient_id: deps.patientId, application_version: APP_VERSION };
          Object.keys(DEFAULTS).forEach((k) => {
            out[k] = s[k] || DEFAULTS[k];
          });
          return out;
        }
        function save(patch) {
          const p = patch || {};
          const cur = get();
          const next = Object.assign({}, cur);
          const errors = [];
          if (p.timezone !== void 0) {
            if (!tzCheck(p.timezone)) errors.push({ field: "timezone", message: "Unbekannte Zeitzone." });
            else next.timezone = p.timezone;
          }
          if (p.theme !== void 0) {
            if (Schema.THEMES.indexOf(p.theme) < 0) errors.push({ field: "theme", message: "Unbekanntes Design." });
            else next.theme = p.theme;
          }
          if (p.preferred_chart_period !== void 0) {
            if (!Object.prototype.hasOwnProperty.call(Schema.CHART_PERIODS, p.preferred_chart_period)) errors.push({ field: "preferred_chart_period", message: "Unbekannter Zeitraum." });
            else next.preferred_chart_period = p.preferred_chart_period;
          }
          if (p.reference_guideline !== void 0) {
            if (!Refs.GUIDELINES[p.reference_guideline]) errors.push({ field: "reference_guideline", message: "Unbekannte Leitlinie." });
            else next.reference_guideline = p.reference_guideline;
          }
          if (p.preferred_measurement_time !== void 0) {
            if (p.preferred_measurement_time && !Dates.isValidTimeString(p.preferred_measurement_time)) errors.push({ field: "preferred_measurement_time", message: "Bitte Uhrzeit als HH:MM angeben." });
            else next.preferred_measurement_time = p.preferred_measurement_time || "";
          }
          if (errors.length) throw new AppError(CODES.VALIDATION, errors[0].message, { errors });
          next.application_version = APP_VERSION;
          next.updated_at = new Date(deps.now()).toISOString();
          if (find()) deps.repo.update("Settings", next);
          else deps.repo.insert("Settings", next);
          deps.audit.log("settings", deps.patientId, "update", "Einstellungen ge\xE4ndert");
          return get();
        }
        return { get, save };
      }
      module.exports = { APP_VERSION, DEFAULTS, isValidTimeZone, createSettingsService };
    }
  });

  // src/core/patients.js
  var require_patients = __commonJS({
    "src/core/patients.js"(exports, module) {
      "use strict";
      var Schema = require_schema();
      var Validation = require_validation();
      var { AppError, CODES } = require_errors();
      var DEFAULT_PATIENT_ID = "patient-1";
      function ensureDefaultPatient(repo, now) {
        const rows = repo.getAll("Patients");
        if (rows.length) return rows[0].patient_id;
        const ts = new Date(now()).toISOString();
        repo.insert("Patients", {
          patient_id: DEFAULT_PATIENT_ID,
          birth_year: null,
          sex: "",
          height_cm: null,
          hypertension_diagnosis: "",
          relevant_conditions: "",
          created_at: ts,
          updated_at: ts
        });
        return DEFAULT_PATIENT_ID;
      }
      function createPatientService(deps) {
        function find() {
          return deps.repo.getAll("Patients").filter((p) => p.patient_id === deps.patientId)[0] || null;
        }
        function get() {
          const p = find() || { patient_id: deps.patientId };
          return {
            patient_id: p.patient_id,
            birth_year: p.birth_year === void 0 ? null : p.birth_year,
            sex: p.sex || "",
            height_cm: p.height_cm === void 0 ? null : p.height_cm,
            hypertension_diagnosis: p.hypertension_diagnosis || "",
            relevant_conditions: p.relevant_conditions || ""
          };
        }
        function save(patch) {
          const p = patch || {};
          const errors = [];
          const year = new Date(deps.now()).getUTCFullYear();
          const next = Object.assign({}, find() || { patient_id: deps.patientId, created_at: new Date(deps.now()).toISOString() });
          if (p.birth_year !== void 0) {
            const v = Validation.toNumber(p.birth_year);
            if (v === null) next.birth_year = null;
            else if (isNaN(v) || Math.round(v) !== v || v < 1900 || v > year) errors.push({ field: "birth_year", message: "Geburtsjahr zwischen 1900 und " + year + " angeben." });
            else next.birth_year = v;
          }
          if (p.height_cm !== void 0) {
            const v = Validation.toNumber(p.height_cm);
            if (v === null) next.height_cm = null;
            else if (isNaN(v) || v < 50 || v > 250) errors.push({ field: "height_cm", message: "K\xF6rpergr\xF6\xDFe zwischen 50 und 250 cm angeben." });
            else next.height_cm = Math.round(v);
          }
          if (p.sex !== void 0) {
            if (Schema.SEX_OPTIONS.indexOf(p.sex) < 0) errors.push({ field: "sex", message: "Ung\xFCltige Auswahl." });
            else next.sex = p.sex;
          }
          if (p.hypertension_diagnosis !== void 0) {
            if (Schema.DIAGNOSIS_OPTIONS.indexOf(p.hypertension_diagnosis) < 0) errors.push({ field: "hypertension_diagnosis", message: "Ung\xFCltige Auswahl." });
            else next.hypertension_diagnosis = p.hypertension_diagnosis;
          }
          if (p.relevant_conditions !== void 0) {
            const s = String(p.relevant_conditions || "").trim();
            if (s.length > 500) errors.push({ field: "relevant_conditions", message: "Maximal 500 Zeichen." });
            else next.relevant_conditions = s;
          }
          if (errors.length) throw new AppError(CODES.VALIDATION, errors[0].message, { errors });
          next.updated_at = new Date(deps.now()).toISOString();
          if (find()) deps.repo.update("Patients", next);
          else deps.repo.insert("Patients", next);
          deps.audit.log("patient", deps.patientId, "update", "Profil ge\xE4ndert");
          return get();
        }
        return { get, save };
      }
      module.exports = { DEFAULT_PATIENT_ID, ensureDefaultPatient, createPatientService };
    }
  });

  // src/analytics/statistics.js
  var require_statistics = __commonJS({
    "src/analytics/statistics.js"(exports, module) {
      "use strict";
      function clean(values) {
        const out = [];
        for (let i = 0; i < (values || []).length; i++) {
          const v = values[i];
          if (typeof v === "number" && isFinite(v)) out.push(v);
        }
        return out;
      }
      function sortedCopy(values) {
        return clean(values).sort((a, b) => a - b);
      }
      function count(values) {
        return clean(values).length;
      }
      function sum(values) {
        return clean(values).reduce((s, v) => s + v, 0);
      }
      function mean(values) {
        const v = clean(values);
        if (!v.length) return null;
        return sum(v) / v.length;
      }
      function percentile(values, p) {
        const v = sortedCopy(values);
        if (!v.length) return null;
        if (typeof p !== "number" || p < 0 || p > 100) throw new RangeError("Perzentil muss zwischen 0 und 100 liegen");
        if (v.length === 1) return v[0];
        const h = (v.length - 1) * (p / 100);
        const lo = Math.floor(h);
        const hi = Math.ceil(h);
        return v[lo] + (h - lo) * (v[hi] - v[lo]);
      }
      function median(values) {
        return percentile(values, 50);
      }
      function min(values) {
        const v = clean(values);
        return v.length ? Math.min.apply(null, v) : null;
      }
      function max(values) {
        const v = clean(values);
        return v.length ? Math.max.apply(null, v) : null;
      }
      function standardDeviation(values) {
        const v = clean(values);
        if (v.length < 2) return null;
        const m = mean(v);
        const ss = v.reduce((s, x) => s + (x - m) * (x - m), 0);
        return Math.sqrt(ss / (v.length - 1));
      }
      function coefficientOfVariation(values) {
        const sd = standardDeviation(values);
        const m = mean(values);
        if (sd === null || m === null || m === 0) return null;
        return sd / m * 100;
      }
      function round(value, digits) {
        if (value === null || value === void 0 || !isFinite(value)) return null;
        const f = Math.pow(10, digits || 0);
        return Math.round(value * f) / f;
      }
      function summarize(values) {
        const v = clean(values);
        return {
          n: v.length,
          mean: round(mean(v), 1),
          median: round(median(v), 1),
          min: min(v),
          max: max(v),
          sd: round(standardDeviation(v), 1),
          cv: round(coefficientOfVariation(v), 1),
          p10: round(percentile(v, 10), 1),
          p90: round(percentile(v, 90), 1)
        };
      }
      module.exports = {
        clean,
        count,
        sum,
        mean,
        median,
        percentile,
        min,
        max,
        standardDeviation,
        coefficientOfVariation,
        round,
        summarize
      };
    }
  });

  // src/analytics/aggregation.js
  var require_aggregation = __commonJS({
    "src/analytics/aggregation.js"(exports, module) {
      "use strict";
      var S = require_statistics();
      var D = require_dates();
      function isAnalyzable(m) {
        if (!m) return false;
        if (m.deleted_at) return false;
        if (m.is_valid === false) return false;
        return typeof m.systolic === "number" && typeof m.diastolic === "number" && D.isValidDateString(m.measurement_date);
      }
      function analyzable(measurements) {
        return (measurements || []).filter(isAnalyzable);
      }
      function dailyMeans(measurements) {
        const byDate = {};
        analyzable(measurements).forEach((m) => {
          const g = byDate[m.measurement_date] || (byDate[m.measurement_date] = { sys: [], dia: [], pulse: [], ids: [] });
          g.sys.push(m.systolic);
          g.dia.push(m.diastolic);
          if (typeof m.pulse === "number") g.pulse.push(m.pulse);
          g.ids.push(m.id);
        });
        return Object.keys(byDate).sort().map((date) => {
          const g = byDate[date];
          return {
            date,
            systolic: S.mean(g.sys),
            diastolic: S.mean(g.dia),
            pulse: S.mean(g.pulse),
            n: g.sys.length,
            nPulse: g.pulse.length,
            ids: g.ids
          };
        });
      }
      function filterDays(days, from, to) {
        return days.filter((d) => (!from || d.date >= from) && (!to || d.date <= to));
      }
      function summarizeDays(days, from, to) {
        const span = from && to ? D.daysBetween(from, to) + 1 : null;
        const n = days.reduce((s, d) => s + d.n, 0);
        return {
          from: from || days[0] && days[0].date || null,
          to: to || days.length && days[days.length - 1].date || null,
          daysWithData: days.length,
          windowDays: span,
          coverage: span ? S.round(days.length / span, 3) : null,
          nMeasurements: n,
          systolic: S.mean(days.map((d) => d.systolic)),
          diastolic: S.mean(days.map((d) => d.diastolic)),
          pulse: S.mean(days.map((d) => d.pulse))
        };
      }
      function windowSummary(days, endDate, windowDays) {
        const from = D.addDays(endDate, -(windowDays - 1));
        return summarizeDays(filterDays(days, from, endDate), from, endDate);
      }
      function aggregateBy(days, keyFn) {
        const groups = {};
        const order = [];
        days.forEach((d) => {
          const k = keyFn(d.date);
          if (!groups[k]) {
            groups[k] = [];
            order.push(k);
          }
          groups[k].push(d);
        });
        return order.sort().map((k) => {
          const g = groups[k];
          const s = summarizeDays(g, g[0].date, g[g.length - 1].date);
          return {
            key: k,
            from: g[0].date,
            to: g[g.length - 1].date,
            daysWithData: g.length,
            nMeasurements: s.nMeasurements,
            systolic: s.systolic,
            diastolic: s.diastolic,
            pulse: s.pulse
          };
        });
      }
      var weekly = (days) => aggregateBy(days, D.isoWeekKey);
      var monthly = (days) => aggregateBy(days, D.monthKey);
      var quarterly = (days) => aggregateBy(days, D.quarterKey);
      var yearly = (days) => aggregateBy(days, D.yearKey);
      function movingAverage(days, windowDays, minDays) {
        const need = minDays || Math.ceil(windowDays / 2);
        const nums = days.map((d) => D.toDayNumber(d.date));
        const out = [];
        let start = 0;
        for (let i = 0; i < days.length; i++) {
          while (nums[i] - nums[start] >= windowDays) start++;
          const slice = days.slice(start, i + 1);
          if (slice.length >= need) {
            out.push({
              date: days[i].date,
              systolic: S.mean(slice.map((d) => d.systolic)),
              diastolic: S.mean(slice.map((d) => d.diastolic)),
              daysInWindow: slice.length
            });
          }
        }
        return out;
      }
      module.exports = {
        isAnalyzable,
        analyzable,
        dailyMeans,
        filterDays,
        summarizeDays,
        windowSummary,
        aggregateBy,
        weekly,
        monthly,
        quarterly,
        yearly,
        movingAverage
      };
    }
  });

  // src/analytics/trends.js
  var require_trends = __commonJS({
    "src/analytics/trends.js"(exports, module) {
      "use strict";
      var S = require_statistics();
      var A = require_aggregation();
      var D = require_dates();
      function comparePeriods(days, endDate, windowDays, minDays) {
        const need = minDays || Math.max(3, Math.ceil(windowDays / 4));
        const current = A.windowSummary(days, endDate, windowDays);
        const previous = A.windowSummary(days, D.addDays(endDate, -windowDays), windowDays);
        const sufficient = current.daysWithData >= need && previous.daysWithData >= need;
        return {
          windowDays,
          minDays: need,
          current,
          previous,
          sufficient,
          delta: sufficient ? {
            systolic: S.round(current.systolic - previous.systolic, 1),
            diastolic: S.round(current.diastolic - previous.diastolic, 1)
          } : null
        };
      }
      function linearRegression(points) {
        const p = (points || []).filter((q) => isFinite(q.x) && isFinite(q.y));
        if (p.length < 2) return null;
        const mx = S.mean(p.map((q) => q.x));
        const my = S.mean(p.map((q) => q.y));
        let num = 0, den = 0;
        p.forEach((q) => {
          num += (q.x - mx) * (q.y - my);
          den += (q.x - mx) * (q.x - mx);
        });
        if (den === 0) return null;
        const slope = num / den;
        return { slope, intercept: my - slope * mx, n: p.length };
      }
      function dailyTrend(days) {
        const sys = linearRegression(days.map((d) => ({ x: D.toDayNumber(d.date), y: d.systolic })));
        const dia = linearRegression(days.map((d) => ({ x: D.toDayNumber(d.date), y: d.diastolic })));
        return {
          n: days.length,
          systolicPer30Days: sys ? S.round(sys.slope * 30, 1) : null,
          diastolicPer30Days: dia ? S.round(dia.slope * 30, 1) : null
        };
      }
      module.exports = { comparePeriods, linearRegression, dailyTrend };
    }
  });

  // src/core/dashboard.js
  var require_dashboard = __commonJS({
    "src/core/dashboard.js"(exports, module) {
      "use strict";
      var S = require_statistics();
      var A = require_aggregation();
      var T = require_trends();
      var Refs = require_medicalReferences();
      var Schema = require_schema();
      var Dates = require_dates();
      function roundSummary(s) {
        return Object.assign({}, s, {
          systolic: S.round(s.systolic, 0),
          diastolic: S.round(s.diastolic, 0),
          pulse: S.round(s.pulse, 0)
        });
      }
      function periodStart(period, today, firstDate) {
        const days = Schema.CHART_PERIODS[period];
        if (days === void 0) throw new Error("Unbekannter Zeitraum: " + period);
        if (days === null) return firstDate || today;
        return Dates.addDays(today, -(days - 1));
      }
      function buildDashboard(measurements, ctx) {
        const today = ctx.today;
        const period = ctx.period || "30d";
        const valid = A.analyzable(measurements);
        const days = A.dailyMeans(valid);
        const from = periodStart(period, today, days.length ? days[0].date : null);
        const sorted = valid.slice().sort((a, b) => {
          if (a.measurement_date !== b.measurement_date) return a.measurement_date < b.measurement_date ? 1 : -1;
          return (a.measurement_time || "") < (b.measurement_time || "") ? 1 : -1;
        });
        const last = sorted[0] || null;
        const ma7 = A.movingAverage(days, 7, 3).filter((p) => p.date >= from);
        const points = valid.filter((m) => m.measurement_date >= from && m.measurement_date <= today).map((m) => ({
          id: m.id,
          date: m.measurement_date,
          time: m.measurement_time || "",
          systolic: m.systolic,
          diastolic: m.diastolic,
          pulse: m.pulse
        })).sort((a, b) => a.date + a.time < b.date + b.time ? -1 : 1);
        const comparison = T.comparePeriods(days, today, 30);
        return {
          today,
          period,
          totals: { measurements: valid.length, days: days.length, firstDate: days.length ? days[0].date : null },
          latest: last ? {
            id: last.id,
            date: last.measurement_date,
            time: last.measurement_time || "",
            systolic: last.systolic,
            diastolic: last.diastolic,
            pulse: last.pulse,
            flags: last.flags || []
          } : null,
          avg7: roundSummary(A.windowSummary(days, today, 7)),
          avg30: roundSummary(A.windowSummary(days, today, 30)),
          comparison30: comparison,
          chart: {
            from,
            to: today,
            points,
            daily: A.filterDays(days, from, today).map((d) => ({
              date: d.date,
              systolic: S.round(d.systolic, 1),
              diastolic: S.round(d.diastolic, 1),
              n: d.n
            })),
            ma7: ma7.map((p) => ({ date: p.date, systolic: S.round(p.systolic, 1), diastolic: S.round(p.diastolic, 1), daysInWindow: p.daysInWindow }))
          },
          reference: Refs.referenceLines(ctx.guideline, "home")
        };
      }
      function buildAnalytics(measurements, ctx) {
        const today = ctx.today;
        const period = ctx.period || "90d";
        const days = A.dailyMeans(measurements);
        const from = periodStart(period, today, days.length ? days[0].date : null);
        const inPeriod = A.filterDays(days, from, today);
        const window = A.summarizeDays(inPeriod, from, today);
        const eshPoints = A.analyzable(measurements).filter((m) => m.measurement_date >= from && m.measurement_date <= today).map((m) => ({ sys: m.systolic, dia: m.diastolic, cat: (Refs.categorize("esh-2023", "office", m.systolic, m.diastolic) || {}).key }));
        const eshCounts = {};
        eshPoints.forEach((p) => {
          eshCounts[p.cat] = (eshCounts[p.cat] || 0) + 1;
        });
        return {
          period,
          from,
          to: today,
          basis: "daily_means",
          eshPoints,
          eshCounts,
          daysWithData: window.daysWithData,
          windowDays: window.windowDays,
          coverage: window.coverage,
          nMeasurements: window.nMeasurements,
          systolic: S.summarize(inPeriod.map((d) => d.systolic)),
          diastolic: S.summarize(inPeriod.map((d) => d.diastolic)),
          pulse: S.summarize(inPeriod.map((d) => d.pulse)),
          trend: T.dailyTrend(inPeriod),
          monthly: A.monthly(inPeriod).map((m) => ({
            key: m.key,
            daysWithData: m.daysWithData,
            nMeasurements: m.nMeasurements,
            systolic: S.round(m.systolic, 0),
            diastolic: S.round(m.diastolic, 0),
            pulse: S.round(m.pulse, 0)
          })),
          meanCategory: window.daysWithData ? Refs.categorize(ctx.guideline, "home", S.round(window.systolic, 0), S.round(window.diastolic, 0)) : null
        };
      }
      module.exports = { periodStart, buildDashboard, buildAnalytics };
    }
  });

  // src/core/exporter.js
  var require_exporter = __commonJS({
    "src/core/exporter.js"(exports, module) {
      "use strict";
      var Schema = require_schema();
      var COLUMNS = [
        ["id", "id"],
        ["datum", "measurement_date"],
        ["uhrzeit", "measurement_time"],
        ["systolisch", "systolic"],
        ["diastolisch", "diastolic"],
        ["puls", "pulse"],
        ["messart", "measurement_type"],
        ["kontext", "context_tags"],
        ["symptome", "symptoms"],
        ["notiz", "notes"],
        ["gueltig", "is_valid"],
        ["quelle", "source"],
        ["erstellt", "created_at"],
        ["geaendert", "updated_at"]
      ];
      function labelFor(list, key) {
        const f = list.filter((x) => x.key === key)[0];
        return f ? f.label : key;
      }
      function cell(v) {
        if (v === null || v === void 0) return "";
        let s = typeof v === "boolean" ? v ? "ja" : "nein" : String(v);
        if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = "'" + s;
        if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }
      function measurementsToCsv(measurements, opts) {
        const o = opts || {};
        const rows = measurements.filter((m) => !m.deleted_at).filter((m) => (!o.from || m.measurement_date >= o.from) && (!o.to || m.measurement_date <= o.to)).slice().sort((a, b) => a.measurement_date + (a.measurement_time || "") < b.measurement_date + (b.measurement_time || "") ? -1 : 1);
        const lines = [COLUMNS.map((c) => c[0]).join(";")];
        rows.forEach((m) => {
          lines.push(COLUMNS.map((c) => {
            let v = m[c[1]];
            if (c[1] === "context_tags") v = (v || []).map((k) => labelFor(Schema.CONTEXT_TAGS, k)).join(", ");
            if (c[1] === "symptoms") v = (v || []).map((k) => labelFor(Schema.SYMPTOMS, k)).join(", ");
            return cell(v);
          }).join(";"));
        });
        return (o.bom === false ? "" : "\uFEFF") + lines.join("\r\n") + "\r\n";
      }
      module.exports = { COLUMNS, cell, measurementsToCsv };
    }
  });

  // src/core/audit.js
  var require_audit = __commonJS({
    "src/core/audit.js"(exports, module) {
      "use strict";
      function createAudit(deps) {
        return {
          log(entityType, entityId, action, summary) {
            deps.repo.insert("AuditLog", {
              log_id: deps.newId(),
              timestamp: new Date(deps.now()).toISOString(),
              patient_id: deps.patientId,
              entity_type: entityType,
              entity_id: entityId,
              action,
              change_summary: summary || ""
            });
          }
        };
      }
      module.exports = { createAudit };
    }
  });

  // src/core/api.js
  var require_api = __commonJS({
    "src/core/api.js"(exports, module) {
      "use strict";
      var Dates = require_dates();
      var Schema = require_schema();
      var Refs = require_medicalReferences();
      var { AppError, CODES } = require_errors();
      var { createAudit } = require_audit();
      var { createMeasurementService } = require_measurements();
      var { createSettingsService, APP_VERSION } = require_settings();
      var { ensureDefaultPatient, createPatientService } = require_patients();
      var Dashboard = require_dashboard();
      var Exporter = require_exporter();
      var READ_METHODS = ["bootstrap", "getDashboard", "getAnalytics", "listMeasurements", "getMeasurement", "exportMeasurementsCsv"];
      var WRITE_METHODS = ["createMeasurement", "updateMeasurement", "deleteMeasurement", "restoreMeasurement", "saveSettings", "saveProfile"];
      function createApi(env) {
        function context() {
          const patientId = ensureDefaultPatient(env.repo, env.now);
          const base = { repo: env.repo, now: env.now, newId: env.newId, patientId };
          const audit = createAudit(base);
          const settings = createSettingsService(Object.assign({ audit, isValidTimeZone: env.isValidTimeZone }, base));
          const s = settings.get();
          const zone = Dates.createZone(s.timezone, env.localParts);
          return {
            patientId,
            audit,
            settings,
            s,
            zone,
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
                eshCategories: Refs.GUIDELINES["esh-2023"].methods.office.categories
              }
            };
          },
          getDashboard(ctx, p) {
            const period = p && p.period || ctx.s.preferred_chart_period;
            return Dashboard.buildDashboard(ctx.measurements.list(), { today: ctx.today, period, guideline: ctx.s.reference_guideline });
          },
          getAnalytics(ctx, p) {
            return Dashboard.buildAnalytics(ctx.measurements.list(), { today: ctx.today, period: p && p.period || "90d", guideline: ctx.s.reference_guideline });
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
            if (from && !Dates.isValidDateString(from) || to && !Dates.isValidDateString(to)) {
              throw new AppError(CODES.VALIDATION, "Ung\xFCltiger Zeitraum f\xFCr den Export.");
            }
            return {
              filename: "tensio-messungen" + (from || to ? "_" + (from || "anfang") + "_" + (to || ctx.today) : "_" + ctx.today) + ".csv",
              csv: Exporter.measurementsToCsv(ctx.measurements.list(), { from, to })
            };
          }
        };
        function call(method, payload) {
          try {
            if (!Object.prototype.hasOwnProperty.call(handlers, method)) {
              throw new AppError(CODES.UNKNOWN_METHOD, "Unbekannte Aktion.");
            }
            return { ok: true, data: handlers[method](context(), payload || {}) };
          } catch (e) {
            if (e instanceof AppError || e && e.name === "AppError") {
              return { ok: false, error: { code: e.code, message: e.message, details: e.details } };
            }
            if (env.onError) env.onError(e);
            return { ok: false, error: { code: CODES.INTERNAL, message: "Es ist ein unerwarteter Fehler aufgetreten. Bitte erneut versuchen." } };
          }
        }
        return { call, isWrite: (m) => WRITE_METHODS.indexOf(m) >= 0, methods: READ_METHODS.concat(WRITE_METHODS) };
      }
      module.exports = { createApi, READ_METHODS, WRITE_METHODS };
    }
  });

  // src/core/memoryRepository.js
  var require_memoryRepository = __commonJS({
    "src/core/memoryRepository.js"(exports, module) {
      "use strict";
      var Schema = require_schema();
      function clone(o) {
        return JSON.parse(JSON.stringify(o));
      }
      function createMemoryRepository(initial) {
        const tables = {};
        Object.keys(Schema.SHEETS).forEach((n) => {
          tables[n] = [];
        });
        if (initial) Object.keys(initial).forEach((n) => {
          tables[n] = initial[n].map(clone);
        });
        function keyOf(sheet) {
          return Schema.SHEETS[sheet].key;
        }
        return {
          getAll(sheet) {
            return tables[sheet].map(clone);
          },
          insert(sheet, rec) {
            const k = keyOf(sheet);
            if (tables[sheet].some((r) => r[k] === rec[k])) throw new Error("Doppelte ID in " + sheet + ": " + rec[k]);
            tables[sheet].push(clone(rec));
          },
          update(sheet, rec) {
            const k = keyOf(sheet);
            const i = tables[sheet].findIndex((r) => r[k] === rec[k]);
            if (i < 0) throw new Error("Datensatz nicht gefunden: " + rec[k]);
            tables[sheet][i] = clone(rec);
          },
          dump() {
            return clone(tables);
          }
        };
      }
      module.exports = { createMemoryRepository };
    }
  });

  // src/core/demoData.js
  var require_demoData = __commonJS({
    "src/core/demoData.js"(exports, module) {
      "use strict";
      var Dates = require_dates();
      function mulberry32(seed) {
        let a = seed >>> 0;
        return function() {
          a = a + 1831565813 >>> 0;
          let t = a;
          t = Math.imul(t ^ t >>> 15, t | 1);
          t ^= t + Math.imul(t ^ t >>> 7, t | 61);
          return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
      }
      function gauss(rnd) {
        const u = 1 - rnd(), v = rnd();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      }
      function generateDemoMeasurements(o) {
        const rnd = mulberry32(o.seed || 42);
        const total = o.days || 540;
        const histDays = o.historicalDays === void 0 ? 180 : o.historicalDays;
        const zone = o.zone || Dates.createZone("Europe/Berlin");
        const out = [];
        let n = 0;
        const id = () => "demo-" + String(++n).padStart(5, "0");
        const ts = Dates.addDays(o.today, -total) + "T20:00:00.000Z";
        for (let i = total - 1; i >= 1; i--) {
          const date = Dates.addDays(o.today, -i);
          const historical = i >= total - histDays;
          const progress = (total - i) / total;
          const baseSys = 139 - 10 * progress + 3 * Math.sin(Dates.toDayNumber(date) / 365 * 2 * Math.PI);
          const baseDia = 88 - 6 * progress + 2 * Math.sin(Dates.toDayNumber(date) / 365 * 2 * Math.PI);
          if (rnd() > (historical ? 0.7 : 0.88)) continue;
          const count = !historical && rnd() < 0.12 ? 2 : 1;
          for (let k = 0; k < count; k++) {
            const sys = Math.round(baseSys + gauss(rnd) * 6 + (k ? -4 : 0));
            const dia = Math.round(baseDia + gauss(rnd) * 4 + (k ? -2 : 0));
            const pulse = rnd() < 0.15 ? null : Math.round(66 + gauss(rnd) * 6);
            const hour = k ? 19 + Math.floor(rnd() * 3) : 6 + Math.floor(rnd() * 3);
            const time = Dates.pad(hour) + ":" + Dates.pad(Math.floor(rnd() * 12) * 5);
            const tags = [];
            if (!historical && rnd() < 0.08) tags.push("stress");
            if (!historical && rnd() < 0.06) tags.push("poor_sleep");
            if (!historical && rnd() < 0.05) tags.push("caffeine");
            out.push({
              id: id(),
              patient_id: o.patientId || "patient-1",
              measured_at: historical ? "" : zone.toIso(date, time),
              measurement_date: date,
              systolic: sys,
              diastolic: dia,
              pulse,
              measurement_type: "daily",
              protocol_id: "",
              context_tags: tags,
              symptoms: [],
              notes: historical ? "" : tags.length && rnd() < 0.5 ? "Demo-Notiz (fiktiv)" : "",
              is_valid: true,
              source: historical ? "historical_import" : "app",
              created_at: ts,
              updated_at: ts,
              deleted_at: ""
            });
          }
        }
        return out;
      }
      module.exports = { mulberry32, generateDemoMeasurements };
    }
  });

  // src/core/index.js
  var require_index = __commonJS({
    "src/core/index.js"(exports, module) {
      module.exports = {
        Schema: require_schema(),
        Dates: require_dates(),
        Errors: require_errors(),
        Validation: require_validation(),
        Measurements: require_measurements(),
        Settings: require_settings(),
        Patients: require_patients(),
        Dashboard: require_dashboard(),
        Exporter: require_exporter(),
        Api: require_api(),
        MemoryRepository: require_memoryRepository(),
        DemoData: require_demoData(),
        Statistics: require_statistics(),
        Aggregation: require_aggregation(),
        Trends: require_trends(),
        MedicalReferences: require_medicalReferences()
      };
    }
  });
  return require_index();
})();
