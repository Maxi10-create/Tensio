# Architektur

Tensio ist eine Google-Apps-Script-Web-App mit Google Sheets als Datenbank. Die gesamte
Fach- und Statistiklogik ist plattformunabhängiges JavaScript und wird mit Node getestet.

## Schichten

| Schicht | Ort | Inhalt |
|---|---|---|
| Presentation | `src/frontend/*.html` | UI (HtmlService-Templates), Navigation, Chart.js-Diagramme |
| Application | `src/core/` | Anwendungsfälle: Messungen (CRUD), Profil, Einstellungen, Export, API-Dispatch |
| Analytics | `src/analytics/` | reine Statistik, Aggregation, Trends, medizinische Referenzwerte |
| Data Access | `src/backend/Database.gs` | Google-Sheets-Repository, Einrichtung, Import-Hilfen |
| Configuration | `src/core/settings.js`, `src/analytics/medicalReferences.js` | Benutzer- und Referenzwert-Konfiguration |
| Plattform | `src/backend/Code.gs`, `Auth.gs` | `doGet`, `api()`-Einstieg, Zugriffskontrolle, LockService |

Abhängigkeiten zeigen nur nach innen: Frontend → API → Services → Analytics. Services sprechen
den Datenzugriff über ein Repository-Interface an (`getAll`, `insert`, `update`). Dafür gibt es zwei
Implementierungen: `SheetRepository_` (Apps Script) und `createMemoryRepository` (Tests, Vorschau).
Ein Wechsel auf eine andere Datenbank betrifft nur dieses Interface.

## Abweichung von der vorgeschlagenen Struktur

Der Master-Prompt schlägt `Measurements.gs`, `Patients.gs` usw. im Backend vor. Diese Logik liegt
stattdessen in `src/core/*.js`, damit sie ohne Google-Konto testbar ist. Im Backend bleibt nur, was
zwingend Apps-Script-APIs braucht. Protokolle, Gesundheitsereignisse und Gewicht folgen in späteren
Phasen nach demselben Muster (`src/core/protocols.js` usw.); ihre Tabellenblätter existieren bereits.

## Build und clasp

```
src/core + src/analytics ──esbuild──▶ dist/Core.js   (IIFE, globaler Namensraum `Tensio`)
src/backend/*.gs         ──Kopie───▶ dist/*.gs
src/frontend/*.html      ──Kopie───▶ dist/*.html
appsscript.json          ──Kopie───▶ dist/appsscript.json
                                     └── clasp push (rootDir: dist)
```

Die Module sind CommonJS. esbuild bündelt sie zu einer Datei, die im globalen Apps-Script-Scope
`var Tensio = …` definiert. `.gs`-Dateien greifen nur innerhalb von Funktionen auf `Tensio` zu,
die Ladereihenfolge der Dateien spielt daher keine Rolle.

Zusätzlich erzeugt der Build `dist-preview/index.html`: dieselbe Oberfläche mit In-Memory-Backend
und fiktiven Demo-Daten, lauffähig ohne Google-Konto (`npm run preview`).

## Kommunikation

Das Frontend ruft genau eine Serverfunktion auf: `google.script.run.api(method, payloadJson)`.
Antworten sind JSON-Strings `{ ok, data }` oder `{ ok: false, error: { code, message, details } }`.
Fehlercodes: `VALIDATION`, `NEEDS_CONFIRMATION`, `NOT_FOUND`, `CONFLICT`, `UNAUTHORIZED`, `INTERNAL`.

| Methode | Zweck |
|---|---|
| `bootstrap` | Einstellungen, Profil, Auswahllisten, heutiges Datum in der Nutzerzeitzone |
| `getDashboard {period}` | letzte Messung, Ø 7/30 Tage, 30-Tage-Vergleich, Chartdaten |
| `getAnalytics {period}` | Kennzahlen, Trend, Monatsmittel, Einordnung des Mittelwerts |
| `listMeasurements {deletedOnly?}` | Messungsliste (Suche/Filter erfolgen clientseitig) |
| `getMeasurement {id}` | Details |
| `createMeasurement {input, confirmed?}` | anlegen |
| `updateMeasurement {id, input, confirmed?, expectedUpdatedAt?}` | ändern (optimistische Sperre) |
| `deleteMeasurement {id}` / `restoreMeasurement {id}` | Soft-Delete / Wiederherstellen |
| `saveSettings`, `saveProfile` | Konfiguration |
| `exportMeasurementsCsv {from?, to?}` | CSV-Export |

Nach jeder Änderung lädt das Frontend die betroffene Ansicht neu. Alle Kennzahlen werden bei jedem
Abruf aus den Rohdaten berechnet. Es gibt keine gespeicherten Aggregate, die veralten könnten.

## Sicherheit

* Deployment mit `executeAs: USER_DEPLOYING` und `access: MYSELF`: nur das eigene Google-Konto öffnet die App.
* Jeder `api()`-Aufruf prüft serverseitig die E-Mail gegen die Script-Property `ALLOWED_EMAILS`
  (leer = nur Eigentümer). Ohne ermittelbare E-Mail wird der Zugriff verweigert.
* Schreibzugriffe laufen unter `LockService.getScriptLock()`.
* Zellwerte, die mit `= + - @` beginnen, werden beim Schreiben in Sheets und im CSV-Export maskiert (Formel-Injection).
* Kein `CacheService` für Gesundheitsdaten. Pro Anfrage wird jedes Blatt einmal gelesen und nur im Speicher dieser Anfrage gehalten.
* Das AuditLog speichert, *welche* Felder sich geändert haben, aber keine Messwerte oder Notizen.
* Keine Secrets im Repository. `.clasp.json` und `.clasprc.json` stehen in `.gitignore`.

## Performance

Bei 5.000 Messungen liest eine Anfrage das Blatt `Measurements` mit einem einzigen
`getDataRange().getValues()`. Die Berechnung im Kern dauert im Test (`tests/dashboard.test.js`)
deutlich unter einer Sekunde. Schreibvorgänge betreffen genau eine Zeile (`appendRow` bzw. `setValues`
auf eine Zeile). Wenn die Datenmenge später stark wächst, ist der nächste Schritt ein serverseitiger
Cache für nicht-sensible Aggregate (z. B. Monatsmittel ohne Notizen), der bei jedem Schreibvorgang
invalidiert wird.

## PWA und HtmlService

Apps-Script-Web-Apps laufen in einem sandboxed iframe auf `*.googleusercontent.com`. Daraus folgt:

* **Service Worker:** nicht registrierbar (fremder Origin, Sandbox). Dadurch keine Offline-Nutzung.
* **Web-App-Manifest / Installierbarkeit:** wird von HtmlService nicht ausgeliefert. „Zum Home-Bildschirm“
  legt auf iOS und Android ein Lesezeichen an, das im Browser öffnet.
* **Push-Benachrichtigungen:** nicht möglich (benötigen Service Worker). Erinnerungen könnten später
  per Apps-Script-Trigger und E-Mail umgesetzt werden.

Umgesetzt ist deshalb eine mobil optimierte Web-App: Viewport-Meta-Tags, Safe-Area-Abstände,
numerische Tastatur, Touchflächen ≥ 44 pt, reduzierte Animationen. Eine echte PWA wäre nur mit
einem separaten Frontend-Hosting (z. B. GitHub Pages) und Apps Script als reiner API möglich. Das
ist eine bewusste spätere Option, kein Teil von Phase 1.
