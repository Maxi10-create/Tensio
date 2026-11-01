# Installation und Deployment

## Voraussetzungen

* Google-Konto
* Node.js ≥ 20 und npm
* clasp: `npm install -g @google/clasp`, dann `clasp login`
* Apps Script API aktivieren: https://script.google.com/home/usersettings

## 1. Spreadsheet und gebundenes Skript anlegen

1. In Google Drive ein neues, **privates** Google Sheet anlegen (z. B. „Tensio Daten“). Nicht freigeben.
2. Im Sheet: **Erweiterungen → Apps Script**. Das öffnet ein an das Sheet gebundenes Skriptprojekt.
3. Im Skript-Editor unter **Projekteinstellungen** die **Skript-ID** kopieren.
4. Optional: Zeitzone des Projekts auf die eigene Zeitzone setzen (Standard `Europe/Berlin` aus `appsscript.json`).

## 2. Code übertragen

```bash
git clone https://github.com/Maxi10-create/Tensio.git
cd Tensio
npm ci
cp .clasp.json.example .clasp.json   # scriptId eintragen
npm test                              # Unit-Tests
npm run push                          # build + clasp push (überschreibt das Skriptprojekt)
```

`.clasp.json` ist in `.gitignore` und wird nicht eingecheckt.

## 3. Tabellenblätter einrichten

Sheet neu laden. Im Menü **Tensio → Tabellenblätter einrichten / prüfen** ausführen und die
Berechtigungen bestätigen. Angelegt werden: Measurements, Patients, HealthEvents, WeightHistory,
Protocols, Settings, AuditLog. Bestehende Daten bleiben unverändert.

Zum Ausprobieren: **Tensio → Fiktive Demo-Daten einfügen** (nur in ein leeres Blatt). Vor der echten
Nutzung mit **Tensio → Demo-Daten entfernen** wieder löschen.

## 4. Web-App bereitstellen

Im Apps-Script-Editor: **Bereitstellen → Neue Bereitstellung → Typ: Web-App**

* Ausführen als: **Ich**
* Zugriff: **Nur ich**

(Diese Werte stehen auch in `appsscript.json` und werden mit `clasp deploy` übernommen.)

Die angezeigte URL (`https://script.google.com/macros/s/…/exec`) auf dem Smartphone öffnen, mit
demselben Google-Konto angemeldet. Über „Zum Home-Bildschirm“ wird ein App-Symbol angelegt.

Updates: `npm run push`, dann im Editor **Bereitstellungen verwalten → Bearbeiten → Version: Neue Version**,
oder `clasp deploy -i <deploymentId>`, damit die URL gleich bleibt.

## 5. Zugriffskontrolle prüfen (vor echten Gesundheitsdaten!)

1. Spreadsheet: **Freigeben** zeigt nur den Eigentümer, kein Link-Zugriff.
2. Web-App-URL in einem privaten Browserfenster öffnen. Es muss eine Google-Anmeldung verlangt werden;
   mit einem anderen Konto erscheint „Kein Zugriff“ oder eine Google-Fehlerseite.
3. Optional: Script-Property `ALLOWED_EMAILS` (Projekteinstellungen → Skripteigenschaften) auf die eigene
   Adresse setzen. Ohne die Property ist nur der Skript-Eigentümer zugelassen.

## 6. Datensicherung

* Google Sheets führt einen Versionsverlauf (Datei → Versionsverlauf).
* Regelmäßig **Profil → Alle Messungen als CSV exportieren** und die Datei sicher ablegen.
* Optional: Datei → Kopie erstellen, als zusätzliche Sicherung in einem privaten Ordner.

## Lokale Vorschau ohne Google-Konto

```bash
npm run preview    # http://localhost:8080, fiktive Demo-Daten, nichts wird gespeichert
```

## CI

`.github/workflows/ci.yml` führt bei jedem Push und Pull Request Tests und Build unter Node 20 und 22 aus
und lädt die Vorschau (`dist-preview/index.html`) als Build-Artefakt hoch. Ein automatisches Deployment
nach Apps Script ist bewusst nicht eingerichtet, weil dafür clasp-Zugangsdaten als GitHub-Secret nötig wären.

## Hinweis

Google Sheets eignet sich für ein persönliches Projekt, ist aber keine datenschutz- oder
medizinprodukterechtlich geprüfte Lösung.
