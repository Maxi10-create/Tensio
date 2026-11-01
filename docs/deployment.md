# Installation und Deployment

## Voraussetzungen

* Google-Konto
* Node.js ≥ 20 und npm
* clasp: `npm install -g @google/clasp`, dann `clasp login`
* Apps Script API aktivieren: https://script.google.com/home/usersettings

## 1. Apps-Script-Projekt anlegen (einmalig)

```bash
git clone https://github.com/Maxi10-create/Tensio.git
cd Tensio
npm ci
npx clasp login          # Anmeldung mit deinem Google-Konto
npm run clasp:create     # legt ein eigenständiges Apps-Script-Projekt „Tensio“ an, schreibt .clasp.json
npm test
npm run push             # Build + Upload nach Apps Script
```

`.clasp.json` (mit der Skript-ID) ist in `.gitignore` und wird nicht eingecheckt.

## 2. Spreadsheet automatisch erstellen (einmalig)

Im Apps-Script-Editor (`npx clasp open`) die Funktion **`createTensioSpreadsheet`** auswählen und
„Ausführen“. Beim ersten Mal bestätigst du die Berechtigungen. Das Skript legt in deinem Google Drive
ein privates Spreadsheet „Tensio Daten“ an, richtet alle Tabellenblätter ein und speichert seine ID.
Die URL steht im Ausführungsprotokoll. Ein zweiter Lauf tut nichts.

Zum Ausprobieren: Menü **Tensio → Fiktive Demo-Daten einfügen** (nur wenn das Blatt leer ist), vor der echten
Nutzung wieder **Demo-Daten entfernen**.

## 3. Prüfen

Das Setup legt Measurements, Patients, HealthEvents, WeightHistory, Protocols, Settings und AuditLog an.
Bei Bedarf lässt sich `setupSpreadsheet` (bzw. im Sheet-Menü **Tabellenblätter einrichten / prüfen**) erneut ausführen; bestehende Daten bleiben erhalten.

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
