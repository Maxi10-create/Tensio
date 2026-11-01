# Tensio – Blutdruck-Logger und Analyse

Persönliche Web-App zur täglichen Blutdruckerfassung und langfristigen statistischen Auswertung.
Google Apps Script + Google Sheets, Apple-inspirierte mobile Oberfläche, Chart.js.

> Tensio dokumentiert und beschreibt Messwerte. Es ist kein Medizinprodukt, stellt keine Diagnosen
> und gibt keine Therapieempfehlungen.

## Stand: Phase 1 (Functional MVP)

* Messung erfassen in wenigen Sekunden: große Zahlenfelder, numerische Tastatur, Datum/Uhrzeit vorausgefüllt,
  optional Puls, Kontext, Symptome, Notiz
* Plausibilitätsprüfung mit Rückfrage statt Korrektur, Duplikaterkennung
* Messungshistorie mit Suche, Zeitraum-, Quellen- und Auffälligkeitsfilter, Detailansicht
* Bearbeiten (gleiche UUID, optimistische Sperre), Löschen als Soft-Delete mit „Rückgängig“ und „Kürzlich gelöscht“
* Übersicht: letzte Messung, Ø 7/30 Tage mit Messabdeckung, interaktiver Verlauf (7 T bis gesamt,
  Einzelmessungen antippbar, 7-Tage-Mittel, Referenzlinie, Reihen ein-/ausblendbar, PNG-Export), 30-Tage-Vergleich
* Analyse: Mittelwert, Median, SD, VK, Min/Max, P10/P90, Trendsteigung, Monatsmittel, Einordnung des Mittelwerts (ESC 2024 / ESH 2023)
* Profil (alles optional), Einstellungen (Hell/Dunkel/Auto, Zeitzone, Leitlinie), CSV-Export
* Zugriffskontrolle: Web-App nur für das eigene Konto plus serverseitige E-Mail-Prüfung bei jedem Aufruf
* Historische Messungen ohne Uhrzeit werden unterstützt; Import-Hilfe im Sheet-Menü

## Schnellstart

```bash
npm ci
npm test           # 48 Unit-Tests (Statistik, Aggregation, Validierung, CRUD, Zeitzonen, Export, Build)
npm run preview    # lokale Vorschau mit fiktiven Demo-Daten: http://localhost:8080
npm run push       # Build + clasp push (siehe docs/deployment.md)
```

## Projektstruktur

```
src/
  analytics/   reine Statistik: statistics, aggregation, trends, medicalReferences
  core/        Anwendungslogik: schema, validation, measurements, settings, patients, dashboard, exporter, api
  backend/     Apps Script: Code.gs (doGet, api), Auth.gs, Database.gs (Sheets-Repository, Setup, Import)
  frontend/    HtmlService-Templates: Index, Styles, Scripts, Dashboard, Measurements, Analytics, Profile, Sheets
  preview/     In-Memory-Backend für die lokale Vorschau
scripts/       build (esbuild → dist/), Demo-Daten, Vorschau-Server
samples/       fiktiver Beispiel-Datensatz im Sheet-Format
tests/         node:test
docs/          architecture, data-model, medical-logic, deployment
```

## Dokumentation

* [Architektur](docs/architecture.md): Schichten, Build für clasp, API, Sicherheit, PWA-Grenzen
* [Datenmodell](docs/data-model.md): alle Tabellenblätter, Import historischer Daten
* [Medizinische Logik](docs/medical-logic.md): Aggregationsmethode, Kennzahlen, Plausibilität, Referenzwerte mit Quellen
* [Deployment](docs/deployment.md): Einrichtung, clasp, Web-App, Prüfung der Zugriffskontrolle, Sicherung

## Datenschutz

Keine echten Gesundheitsdaten im Repository. Alle Beispiel- und Testdaten sind fiktiv und erzeugt
(`src/core/demoData.js`, IDs mit Präfix `demo-`). Messdaten liegen ausschließlich im privaten Google Sheet.

## Nächste Phasen

2. Longitudinale Analysen: Monats-/Jahresansichten, Variabilität, Verteilung, Pulsdruck, Kalender-Heatmap, Gesundheitsereignisse
3. Standardisierte Messprotokolle (morgens/abends), Protokollstatistik, PDF-Bericht
4. Kontextanalysen, Gewichtsverlauf, regelbasierte Insights, erweiterte Exporte
