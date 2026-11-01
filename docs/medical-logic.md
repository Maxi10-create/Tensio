# Medizinische und statistische Logik

Tensio dokumentiert und beschreibt Messwerte statistisch. Es stellt **keine Diagnosen** und gibt
**keine Therapieempfehlungen**. Medizinische Bewertung (`src/analytics/medicalReferences.js`) ist
strikt von allgemeiner Statistik (`statistics.js`, `aggregation.js`, `trends.js`) getrennt.

## 1. Welche Messungen zählen

Für alle Analysen gelten nur Messungen, die
* nicht gelöscht sind (`deleted_at` leer),
* nicht als Messfehler markiert sind (`is_valid` ≠ FALSE),
* systolisch, diastolisch und Datum enthalten.

Historische Messungen ohne Uhrzeit zählen voll, da Tagesaggregationen nur das Datum brauchen.

## 2. Aggregationsmethode: Tagesmittel zuerst

1. Pro Kalendertag (`measurement_date`) wird das arithmetische Mittel aller gültigen Messungen gebildet
   (SYS, DIA und Puls getrennt; fehlende Pulswerte werden ausgelassen).
2. Alle weiteren Kennzahlen (Ø 7/30 Tage, Wochen-, Monats-, Quartals- und Jahresmittel, Kennzahlen im
   Analysebereich, Trend) basieren auf diesen **Tagesmitteln**.

Begründung: Tage mit mehreren Messungen sollen im Langzeitverlauf nicht stärker gewichtet werden
als Tage mit einer Messung. Beispiel: Tag 1 = 160 mmHg, Tag 2 = 3 × 120 mmHg ergibt 140 mmHg (nicht 130).

**Fehlende Tage** erzeugen keine Werte. Es gibt keine Interpolation und kein Auffüllen.

## 3. Kennzahlen

| Kennzahl | Definition |
|---|---|
| Mittelwert | arithmetisches Mittel |
| Median | 50. Perzentil |
| Perzentile (P10, P90) | lineare Interpolation zwischen Rängen (R-7, wie Excel `PERCENTILE.INC`) |
| Standardabweichung | Stichproben-SD mit n − 1, erst ab 2 Werten |
| Variationskoeffizient | SD / Mittelwert × 100 % |
| Messabdeckung | Tage mit Messung / Kalendertage im Fenster |
| Zeitfenster „letzte N Tage“ | N Kalendertage bis einschließlich heute (Nutzerzeitzone) |

## 4. Gleitende Mittelwerte

Nachlaufendes Fenster über N **Kalendertage** (einschließlich des Tages selbst), berechnet aus Tagesmitteln.
Ein Wert entsteht nur an Tagen mit eigener Messung und nur, wenn im Fenster genügend Tage liegen:

| Fenster | Mindestanzahl Tage mit Messung |
|---|---|
| 7 Tage (Dashboard) | 3 |
| allgemein | ⌈N / 2⌉ (Standard) |

Im Diagramm wird die Linie bei Lücken von mehr als 3 Tagen unterbrochen.

## 5. Trend

* **30-Tage-Vergleich:** Mittel der letzten 30 Tage gegenüber den 30 Tagen davor. Ein Delta wird nur
  angezeigt, wenn beide Zeiträume mindestens ⌈30/4⌉ = 8 Messtage enthalten. Die App nennt immer
  beide Zeiträume und die Anzahl der Messtage.
* **Lineare Trendsteigung:** Kleinste-Quadrate-Regression der Tagesmittel über die Zeit, angegeben in
  mmHg pro 30 Tage. Angezeigt erst ab 14 Tagen mit Messung.

## 6. Plausibilitätsprüfung (Messqualität, keine Bewertung)

| Prüfung | Abgelehnt (Fehler) | Rückfrage (Warnung) |
|---|---|---|
| Systolisch | < 50 oder > 300 | ≥ 180 oder < 90 |
| Diastolisch | < 20 oder > 200, oder ≥ systolisch | ≥ 110 oder < 50 |
| Puls | < 20 oder > 250 | > 150 oder < 40 |
| Pulsdruck (SYS − DIA) | – | < 20 oder > 100 |
| Datum | ungültig, Zukunft, vor 1900 | – |
| Duplikat | – | gleiche Werte, gleicher Tag, gleiche/unbekannte Uhrzeit |

Warnungen müssen bestätigt werden. Danach wird **genau der eingegebene Wert** gespeichert. Es gibt keine
automatische Korrektur und kein Verwerfen. Auffällige Messungen werden in Listen mit Text und Symbol
markiert (nicht nur farblich). Bei hohen Werten bietet die App an, Kontext zu ergänzen, ohne
Ursachen zu behaupten.

Diese Grenzen dienen nur der Erkennung von Tippfehlern und ungewöhnlichen Eingaben. Sie sind keine
medizinischen Grenzwerte.

## 7. Referenzwerte (versioniert, zentral konfiguriert)

Datei: `src/analytics/medicalReferences.js`, Konfigurationsstand `REFERENCES_VERSION = 2026-11-01`.

| Leitlinie | Methode | Kategorien (SYS / DIA in mmHg) |
|---|---|---|
| ESC 2024 | Heimmessung | nicht erhöht < 120 / < 70 · erhöht 120–134 / 70–84 · Hypertonie-Bereich ≥ 135 / ≥ 85 |
| ESC 2024 | Praxis | nicht erhöht < 120 / < 70 · erhöht 120–139 / 70–89 · Hypertonie-Bereich ≥ 140 / ≥ 90 |
| ESH 2023 | Heimmessung | Schwellenwert ≥ 135 und/oder ≥ 85 |
| ESH 2023 | Praxis | optimal < 120/80 · normal 120–129/80–84 · hoch-normal 130–139/85–89 · Grad 1 140–159/90–99 · Grad 2 160–179/100–109 · Grad 3 ≥ 180/≥ 110 |

Systolisch und diastolisch werden getrennt eingeordnet; maßgeblich ist die höhere Kategorie.

Quellen:
* McEvoy JW, et al. *2024 ESC Guidelines for the management of elevated blood pressure and hypertension.* Eur Heart J. 2024;45(38):3912–4018. doi:10.1093/eurheartj/ehae178
* Mancia G, et al. *2023 ESH Guidelines for the management of arterial hypertension.* J Hypertens. 2023;41(12):1874–2071. doi:10.1097/HJH.0000000000003480

**Prüfstand:** Die Werte entsprechen den veröffentlichten Leitlinientexten (Stand der Konfiguration: 1. Nov. 2026).
Vor Phase 3 (Messprotokolle mit leitliniengerechter Einordnung) werden die Grenzwerte noch einmal gegen die
offiziellen Quellen (escardio.org, eshonline.org) auf Aktualisierungen geprüft.

**Verwendung in Phase 1:**
* Diagramm: gestrichelte Referenzlinie des Heim-Schwellenwerts (135/85), dezent und beschriftet.
* Analyse: Einordnung des **Mittelwerts** eines Zeitraums mit dem Hinweis, dass die Referenzwerte für
  standardisierte Heim-Messserien gelten und Alltags-Einzelmessungen nur eingeschränkt vergleichbar sind.
* Einzelmessungen werden **nie** kategorisiert. Die App zeigt dort „Einzelmessung – keine Diagnose“.

## 8. Zeitzonen

* Die Nutzerzeitzone (Einstellungen, Standard `Europe/Berlin`) bestimmt „heute“ und den Offset in `measured_at`.
* `measurement_date` ist das lokale Datum zum Messzeitpunkt und bleibt bei späteren Zeitzonenwechseln unverändert.
  Eine Messung um 23:30 in Berlin gehört also immer zu diesem Berliner Kalendertag.
* Tagesarithmetik erfolgt über UTC-Tagesnummern und ist dadurch sommerzeitfest.
