# tools/

## import_handwritten.py – handschriftliche Altdaten übernehmen

Wandelt abgetippte Blutdruckblätter (CSV/TSV, z. B. aus Google Sheets exportiert) in Zeilen für das
Blatt **Measurements** um. Nur Python-Standardbibliothek (ab 3.9).

```bash
python3 tools/import_handwritten.py data/blatt1.csv data/blatt2.csv -o data/measurements_import.csv
```

Eingabespalten (Überschrift in Zeile 1, Groß-/Kleinschreibung egal): `Datum`, `Uhrzeit` (optional),
`Sys` + `Dia` **oder** `RR` mit `135/85`, `Puls` (optional), `Notiz`/`Bemerkung` (optional).
Datum als `TT.MM.JJJJ`, `TT.MM.JJ` oder `JJJJ-MM-TT`; Uhrzeit als `7:30`, `07.30`, `8 Uhr` oder leer.

| Option | Wirkung |
|---|---|
| `--year 2026` | Jahr für Datumsangaben ohne Jahr (`27.09.`). Nur angeben, wenn sicher. |
| `--fill-date` | Leere Datumszelle = Datum der Zeile darüber (wird im Bericht vermerkt). |
| `--existing measurements.csv` | Abgleich mit dem bestehenden Blatt, mögliche Duplikate werden gemeldet. |
| `--tsv` | Tabulator-getrennt, zum direkten Einfügen per Zwischenablage. |
| `--no-header` | Ohne Kopfzeile, zum Anhängen unter vorhandene Zeilen. |
| `--strict` | Bei Fehlern gar keine Ausgabe schreiben. |
| `--patient-id`, `--timezone` | Standard `patient-1`, `Europe/Berlin`. |

Regeln (wie in der App):

* **Nichts wird erfunden.** Ohne Uhrzeit bleibt `measured_at` leer, ohne Puls bleibt `pulse` leer.
* **Nichts wird korrigiert.** Fehlerhafte Zeilen (Dia ≥ Sys, Werte außerhalb 50–300 / 20–200 / 20–250,
  unleserliche Zahlen, Datum in der Zukunft) kommen nicht in die Ausgabe, sondern in den Bericht
  `<ausgabe>_bericht.csv` mit Datei und Zeilennummer.
* Ungewöhnliche, aber mögliche Werte und **mögliche Duplikate** (gleicher Tag, gleiche oder beide
  unbekannte Uhrzeit, gleiche Werte) werden übernommen und im Bericht als Hinweis aufgeführt.
* `source = historical_import`, `measurement_type = daily`, `is_valid = TRUE`, neue UUIDs,
  `created_at`/`updated_at` = Zeitpunkt des Laufs (UTC).

In Google Sheets einfügen: Blatt **Measurements** → *Datei → Importieren → Hochladen* → „An aktuelles
Tabellenblatt anhängen“ und **„Text in Zahlen, Datumsangaben und Formeln umwandeln“ abwählen**, damit
Datum und Zeitstempel als Text bleiben. Bei Import mit Kopfzeile die doppelte Kopfzeile danach löschen
(oder gleich `--no-header` verwenden).

Echte Daten gehören in `data/` (per `.gitignore` ausgeschlossen), nie ins Repository.

Tests (fiktive Werte): `python3 -m unittest discover -s tools -p 'test_*.py'` bzw. `npm run test:py`.
