#!/usr/bin/env python3
"""
Tensio – handschriftlich erfasste Blutdruckwerte in das Format des Blatts
„Measurements“ bringen.

Eingabe:  eine oder mehrere CSV-/TSV-Dateien (z. B. Export aus Google Sheets oder
          abgetippte Blätter). Erkannte Spalten (Groß-/Kleinschreibung egal):
            Datum      datum, date, tag, measurement_date
            Uhrzeit    uhrzeit, zeit, time, measurement_time   (optional)
            Systolisch sys, systolisch, systolic, syst
            Diastolisch dia, diastolisch, diastolic, diast
            Puls       puls, pulse, hf, herzfrequenz            (optional)
            RR         rr, blutdruck, bp                         (statt sys/dia, z. B. „135/85“)
            Notiz      notiz, notizen, bemerkung, kommentar, notes (optional)

Ausgabe:  CSV (oder TSV mit --tsv) mit genau den Spalten von „Measurements“:
            id, patient_id, measured_at, measurement_date, systolic, diastolic, pulse,
            measurement_type, protocol_id, context_tags, symptoms, notes, is_valid,
            source, created_at, updated_at, deleted_at
          plus ein Prüfbericht (CSV) mit Fehlern und Hinweisen je Zeile.

Grundsätze (wie in der App, siehe docs/data-model.md und src/core/validation.js):
  * Es wird nichts erfunden: Ohne Uhrzeit bleibt measured_at leer, ohne Puls bleibt
    pulse leer. Ein Datum ohne Jahr wird nur mit ausdrücklichem --year ergänzt.
  * Es wird nichts automatisch korrigiert. Zeilen mit Fehlern (z. B. Dia ≥ Sys,
    Wert außerhalb 50–300) landen NICHT in der Ausgabe, sondern im Bericht.
  * Ungewöhnliche, aber mögliche Werte und mögliche Duplikate werden übernommen
    und im Bericht als Hinweis aufgeführt.

Nur Python-Standardbibliothek (ab 3.9).

Beispiel:
  python3 tools/import_handwritten.py data/blatt1.csv data/blatt2.csv \\
      -o data/measurements_import.csv --report data/import_bericht.csv
"""
from __future__ import annotations

import argparse
import csv
import io
import re
import sys
import uuid
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Callable, Iterable

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None  # type: ignore

# --------------------------------------------------------------------------
# Datenmodell (muss zu src/core/schema.js passen)
# --------------------------------------------------------------------------

MEASUREMENT_COLUMNS = [
    'id', 'patient_id', 'measured_at', 'measurement_date', 'systolic', 'diastolic', 'pulse',
    'measurement_type', 'protocol_id', 'context_tags', 'symptoms', 'notes', 'is_valid',
    'source', 'created_at', 'updated_at', 'deleted_at',
]

SOURCE = 'historical_import'
MEASUREMENT_TYPE = 'daily'

# Grenzen wie src/core/validation.js (LIMITS)
LIMITS = {
    'systolic': {'min': 50, 'max': 300, 'warn_low': 90, 'warn_high': 180},
    'diastolic': {'min': 20, 'max': 200, 'warn_low': 50, 'warn_high': 110},
    'pulse': {'min': 20, 'max': 250, 'warn_low': 40, 'warn_high': 150},
}
PULSE_PRESSURE = {'warn_low': 20, 'warn_high': 100}
NOTES_MAX = 1000
EARLIEST_DATE = date(1900, 1, 1)

LABELS = {'systolic': 'Systolisch', 'diastolic': 'Diastolisch', 'pulse': 'Puls'}

HEADER_ALIASES = {
    'date': ['datum', 'date', 'tag', 'measurement_date'],
    'time': ['uhrzeit', 'zeit', 'time', 'measurement_time'],
    'systolic': ['sys', 'systolisch', 'systolic', 'syst', 'systole'],
    'diastolic': ['dia', 'diastolisch', 'diastolic', 'diast', 'diastole'],
    'pulse': ['puls', 'pulse', 'hf', 'herzfrequenz', 'pul'],
    'bp': ['rr', 'blutdruck', 'bp'],
    'notes': ['notiz', 'notizen', 'bemerkung', 'bemerkungen', 'kommentar', 'notes', 'note'],
}

REPORT_COLUMNS = ['datei', 'zeile', 'art', 'feld', 'meldung', 'datum', 'uhrzeit', 'sys', 'dia', 'puls']


# --------------------------------------------------------------------------
# Parsen einzelner Felder
# --------------------------------------------------------------------------

def _norm_header(h: str) -> str:
    h = (h or '').strip().lower()
    h = re.sub(r'\(.*?\)|\[.*?\]', '', h)          # „Sys (mmHg)“ → „sys“
    h = re.sub(r'[^a-zäöüß_]+', '', h)
    return h


def map_headers(headers: list[str]) -> dict[str, int]:
    """Ordnet Spaltenüberschriften den internen Feldern zu (Feld → Spaltenindex)."""
    result: dict[str, int] = {}
    for idx, raw in enumerate(headers):
        n = _norm_header(raw)
        for key, aliases in HEADER_ALIASES.items():
            if n in aliases and key not in result:
                result[key] = idx
    return result


def parse_date(text: str, default_year: int | None = None) -> tuple[str | None, str | None]:
    """Gibt (JJJJ-MM-TT, None) oder (None, Fehlermeldung) zurück."""
    s = (text or '').strip()
    if not s:
        return None, 'Datum fehlt.'
    y = mo = d = None
    m = re.fullmatch(r'(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})', s)
    if m:
        d, mo, y = int(m[1]), int(m[2]), m[3]
        y = int(y) + 2000 if len(y) == 2 else int(y)
    else:
        m = re.fullmatch(r'(\d{4})-(\d{1,2})-(\d{1,2})', s)
        if m:
            y, mo, d = int(m[1]), int(m[2]), int(m[3])
        else:
            m = re.fullmatch(r'(\d{1,2})\.(\d{1,2})\.?', s)
            if m:
                if default_year is None:
                    return None, 'Datum ohne Jahr. Jahr ergänzen oder --year angeben.'
                d, mo, y = int(m[1]), int(m[2]), default_year
            else:
                return None, f'Datum „{s}“ nicht erkannt (TT.MM.JJJJ, TT.MM.JJ oder JJJJ-MM-TT).'
    try:
        return date(y, mo, d).isoformat(), None
    except ValueError:
        return None, f'Datum „{s}“ existiert nicht.'


def parse_time(text: str) -> tuple[str | None, str | None]:
    """Gibt ('HH:MM' oder '', None) oder (None, Fehlermeldung) zurück. Leer = unbekannt."""
    s = (text or '').strip().lower()
    s = re.sub(r'\s*uhr$', '', s)
    if not s:
        return '', None
    m = re.fullmatch(r'(\d{1,2})[:.](\d{2})(?::\d{2})?', s) or re.fullmatch(r'(\d{1,2})()', s)
    if not m:
        return None, f'Uhrzeit „{text.strip()}“ nicht erkannt (HH:MM oder leer).'
    h, mi = int(m[1]), int(m[2] or 0)
    if h > 23 or mi > 59:
        return None, f'Uhrzeit „{text.strip()}“ ungültig.'
    return f'{h:02d}:{mi:02d}', None


def parse_int(text: str) -> tuple[int | None, bool]:
    """Gibt (Zahl, ok). Leer → (None, True). Keine ganze Zahl → (None, False)."""
    s = (text or '').strip()
    if s == '':
        return None, True
    if re.fullmatch(r'\d+', s):
        return int(s), True
    return None, False


def split_bp(text: str) -> tuple[str, str] | None:
    """„135/85“, „135 / 85“, „135:85“ → ('135', '85')."""
    m = re.fullmatch(r'\s*(\S+?)\s*[/:]\s*(\S+?)\s*', text or '')
    return (m[1], m[2]) if m else None


def to_measured_at(date_str: str, time_str: str, tz_name: str) -> str:
    """Lokales Datum + Uhrzeit → ISO 8601 mit Offset der Zeitzone (sommerzeitfest)."""
    if not time_str:
        return ''
    local = datetime.fromisoformat(f'{date_str}T{time_str}:00')
    if ZoneInfo is None:  # pragma: no cover
        raise RuntimeError('zoneinfo nicht verfügbar (Python ≥ 3.9 nötig).')
    aware = local.replace(tzinfo=ZoneInfo(tz_name))
    return aware.isoformat(timespec='seconds')


# --------------------------------------------------------------------------
# Zeilenverarbeitung
# --------------------------------------------------------------------------

@dataclass
class Issue:
    kind: str      # 'fehler' | 'hinweis'
    field: str
    message: str


@dataclass
class RowResult:
    file: str
    line: int
    raw: dict
    record: dict | None = None
    issues: list[Issue] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not any(i.kind == 'fehler' for i in self.issues)


def _check_number(name: str, raw: str, required: bool, issues: list[Issue]) -> int | None:
    v, ok = parse_int(raw)
    lab = LABELS[name]
    if not ok:
        issues.append(Issue('fehler', name, f'{lab} „{raw.strip()}“ ist keine ganze Zahl.'))
        return None
    if v is None:
        if required:
            issues.append(Issue('fehler', name, f'{lab} fehlt.'))
        return None
    lim = LIMITS[name]
    if v < lim['min'] or v > lim['max']:
        issues.append(Issue('fehler', name, f'{lab} {v} liegt außerhalb {lim["min"]}–{lim["max"]}.'))
        return None
    return v


def plausibility_warnings(sys_v: int, dia_v: int, pulse: int | None) -> list[Issue]:
    w: list[Issue] = []
    ls, ld, lp = LIMITS['systolic'], LIMITS['diastolic'], LIMITS['pulse']
    if sys_v >= ls['warn_high']:
        w.append(Issue('hinweis', 'systolic', f'Systolisch sehr hoch (≥ {ls["warn_high"]} mmHg).'))
    if sys_v < ls['warn_low']:
        w.append(Issue('hinweis', 'systolic', f'Systolisch ungewöhnlich niedrig (< {ls["warn_low"]} mmHg).'))
    if dia_v >= ld['warn_high']:
        w.append(Issue('hinweis', 'diastolic', f'Diastolisch sehr hoch (≥ {ld["warn_high"]} mmHg).'))
    if dia_v < ld['warn_low']:
        w.append(Issue('hinweis', 'diastolic', f'Diastolisch ungewöhnlich niedrig (< {ld["warn_low"]} mmHg).'))
    pp = sys_v - dia_v
    if pp < PULSE_PRESSURE['warn_low']:
        w.append(Issue('hinweis', 'diastolic', f'Abstand Sys–Dia ungewöhnlich klein ({pp} mmHg).'))
    if pp > PULSE_PRESSURE['warn_high']:
        w.append(Issue('hinweis', 'systolic', f'Abstand Sys–Dia ungewöhnlich groß ({pp} mmHg).'))
    if pulse is not None:
        if pulse > lp['warn_high']:
            w.append(Issue('hinweis', 'pulse', f'Puls ungewöhnlich hoch (> {lp["warn_high"]} /min).'))
        if pulse < lp['warn_low']:
            w.append(Issue('hinweis', 'pulse', f'Puls ungewöhnlich niedrig (< {lp["warn_low"]} /min).'))
    return w


@dataclass
class Options:
    patient_id: str = 'patient-1'
    timezone: str = 'Europe/Berlin'
    default_year: int | None = None
    fill_date: bool = False
    today: str | None = None                      # JJJJ-MM-TT; Standard: heute
    now: Callable[[], str] | None = None          # UTC-Zeitstempel für created_at/updated_at
    new_id: Callable[[], str] | None = None


def convert_row(raw: dict, opts: Options, file: str, line: int, now_iso: str, new_id: Callable[[], str]) -> RowResult:
    res = RowResult(file=file, line=line, raw=raw)
    issues = res.issues

    date_str, err = parse_date(raw.get('date', ''), opts.default_year)
    if err:
        issues.append(Issue('fehler', 'measurement_date', err))
    elif date_str < EARLIEST_DATE.isoformat():
        issues.append(Issue('fehler', 'measurement_date', 'Datum ist unplausibel früh.'))
    elif opts.today and date_str > opts.today:
        issues.append(Issue('fehler', 'measurement_date', 'Datum liegt in der Zukunft.'))
    if raw.get('date_filled'):
        issues.append(Issue('hinweis', 'measurement_date', 'Datum aus der Zeile darüber übernommen (--fill-date).'))

    time_str, err = parse_time(raw.get('time', ''))
    if err:
        issues.append(Issue('fehler', 'measured_at', err))

    sys_v = _check_number('systolic', raw.get('systolic', ''), True, issues)
    dia_v = _check_number('diastolic', raw.get('diastolic', ''), True, issues)
    pulse = _check_number('pulse', raw.get('pulse', ''), False, issues)

    if sys_v is not None and dia_v is not None and dia_v >= sys_v:
        issues.append(Issue('fehler', 'diastolic', 'Diastolisch ist nicht kleiner als systolisch. Vertauscht oder verlesen?'))

    notes = (raw.get('notes') or '').strip()
    if len(notes) > NOTES_MAX:
        issues.append(Issue('fehler', 'notes', f'Notiz zu lang (max. {NOTES_MAX} Zeichen).'))

    if not res.ok:
        return res

    issues.extend(plausibility_warnings(sys_v, dia_v, pulse))
    res.record = {
        'id': new_id(),
        'patient_id': opts.patient_id,
        'measured_at': to_measured_at(date_str, time_str, opts.timezone),
        'measurement_date': date_str,
        'systolic': sys_v,
        'diastolic': dia_v,
        'pulse': '' if pulse is None else pulse,
        'measurement_type': MEASUREMENT_TYPE,
        'protocol_id': '',
        'context_tags': '[]',
        'symptoms': '[]',
        'notes': notes,
        'is_valid': 'TRUE',
        'source': SOURCE,
        'created_at': now_iso,
        'updated_at': now_iso,
        'deleted_at': '',
        '_time': time_str,
    }
    return res


def duplicate_key(date_str: str, time_str: str, sys_v, dia_v) -> str:
    """Wie src/core/measurements.js: gleicher Tag, gleiche (oder beide unbekannte) Uhrzeit, gleiche Werte."""
    return '|'.join([date_str, time_str or '', str(sys_v), str(dia_v)])


def mark_duplicates(results: list[RowResult], existing_keys: dict[str, str] | None = None) -> None:
    seen: dict[str, RowResult] = {}
    existing_keys = existing_keys or {}
    for r in results:
        if not r.record:
            continue
        rec = r.record
        k = duplicate_key(rec['measurement_date'], rec['_time'], rec['systolic'], rec['diastolic'])
        if k in existing_keys:
            r.issues.append(Issue('hinweis', 'duplikat', f'Mögliches Duplikat: steht schon im Blatt Measurements (id {existing_keys[k]}).'))
        if k in seen:
            o = seen[k]
            r.issues.append(Issue('hinweis', 'duplikat', f'Mögliches Duplikat von {o.file} Zeile {o.line}.'))
        else:
            seen[k] = r


# --------------------------------------------------------------------------
# Dateien lesen / schreiben
# --------------------------------------------------------------------------

def read_text(path: Path) -> str:
    data = path.read_bytes()
    for enc in ('utf-8-sig', 'cp1252'):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    return data.decode('latin-1')


def sniff_delimiter(text: str) -> str:
    first = text.splitlines()[0] if text else ''
    counts = {d: first.count(d) for d in ('\t', ';', ',')}
    best = max(counts, key=counts.get)
    return best if counts[best] else ','


def read_rows(text: str, file: str, fill_date: bool = False) -> tuple[list[tuple[int, dict]], list[str]]:
    """Liest eine Tabelle und liefert [(Zeilennummer, {date, time, systolic, ...})] und Fehler zur Kopfzeile."""
    reader = csv.reader(io.StringIO(text), delimiter=sniff_delimiter(text))
    rows = list(reader)
    if not rows:
        return [], [f'{file}: Datei ist leer.']
    cols = map_headers(rows[0])
    problems = []
    if 'date' not in cols:
        problems.append(f'{file}: Keine Datumsspalte gefunden (z. B. „Datum“). Kopfzeile: {rows[0]}')
    if not ({'systolic', 'diastolic'} <= cols.keys() or 'bp' in cols):
        problems.append(f'{file}: Keine Spalten für Sys/Dia (oder „RR“ mit 135/85) gefunden. Kopfzeile: {rows[0]}')
    if problems:
        return [], problems

    def cell(row: list[str], key: str) -> str:
        i = cols.get(key)
        return row[i].strip() if i is not None and i < len(row) else ''

    out = []
    last_date = ''
    for n, row in enumerate(rows[1:], start=2):
        if not any(c.strip() for c in row):
            continue
        raw = {k: cell(row, k) for k in ('date', 'time', 'systolic', 'diastolic', 'pulse', 'notes')}
        if 'bp' in cols and not raw['systolic'] and not raw['diastolic']:
            bp = cell(row, 'bp')
            parts = split_bp(bp)
            if parts:
                raw['systolic'], raw['diastolic'] = parts
            elif bp:
                raw['systolic'] = bp  # wird als „keine ganze Zahl“ gemeldet
        if not (raw['systolic'] or raw['diastolic'] or raw['pulse']):
            # Zeile ohne Messwerte (z. B. Überschrift „Oktober“ oder nur Notiz) → überspringen
            if raw['date']:
                last_date = raw['date']
            continue
        if raw['date']:
            last_date = raw['date']
        elif fill_date and last_date:
            raw['date'] = last_date
            raw['date_filled'] = True
        out.append((n, raw))
    return out, []


def read_existing_keys(path: Path) -> dict[str, str]:
    """Liest einen CSV-Export des Blatts Measurements für den Duplikatabgleich."""
    text = read_text(path)
    reader = csv.DictReader(io.StringIO(text), delimiter=sniff_delimiter(text))
    keys = {}
    for r in reader:
        if (r.get('deleted_at') or '').strip():
            continue
        measured_at = (r.get('measured_at') or '').strip()
        d = (r.get('measurement_date') or '').strip()
        t = measured_at[11:16] if measured_at[:10] == d else ''
        k = duplicate_key(d, t, (r.get('systolic') or '').strip(), (r.get('diastolic') or '').strip())
        keys.setdefault(k, (r.get('id') or '').strip())
    return keys


def write_measurements(records: Iterable[dict], out, delimiter: str = ',', header: bool = True) -> None:
    w = csv.writer(out, delimiter=delimiter, lineterminator='\n')
    if header:
        w.writerow(MEASUREMENT_COLUMNS)
    for rec in records:
        w.writerow([rec[c] for c in MEASUREMENT_COLUMNS])


def write_report(results: list[RowResult], out, extra: list[str] | None = None) -> None:
    w = csv.writer(out, lineterminator='\n')
    w.writerow(REPORT_COLUMNS)
    for msg in extra or []:
        w.writerow(['', '', 'fehler', 'kopfzeile', msg, '', '', '', '', ''])
    for r in results:
        for i in r.issues:
            w.writerow([r.file, r.line, i.kind, i.field, i.message,
                        r.raw.get('date', ''), r.raw.get('time', ''), r.raw.get('systolic', ''),
                        r.raw.get('diastolic', ''), r.raw.get('pulse', '')])


def process(files: list[tuple[str, str]], opts: Options, existing_keys: dict[str, str] | None = None):
    """Kernfunktion: [(Dateiname, Text)] → (Ergebnisse je Zeile, Kopfzeilenprobleme)."""
    now_iso = opts.now() if opts.now else datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00', 'Z')
    new_id = opts.new_id or (lambda: str(uuid.uuid4()))
    if opts.today is None:
        opts.today = datetime.now(ZoneInfo(opts.timezone)).date().isoformat()
    results: list[RowResult] = []
    problems: list[str] = []
    for name, text in files:
        rows, probs = read_rows(text, name, opts.fill_date)
        problems.extend(probs)
        for line, raw in rows:
            results.append(convert_row(raw, opts, name, line, now_iso, new_id))
    mark_duplicates(results, existing_keys)
    return results, problems


# --------------------------------------------------------------------------
# Kommandozeile
# --------------------------------------------------------------------------

def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description='Handschriftliche Blutdruckwerte (CSV/TSV) in das Format des Blatts „Measurements“ umwandeln.')
    p.add_argument('inputs', nargs='+', type=Path, help='Eingabedateien (CSV/TSV, Trennzeichen wird erkannt)')
    p.add_argument('-o', '--output', type=Path, required=True, help='Ausgabedatei für das Blatt Measurements')
    p.add_argument('--report', type=Path, help='Prüfbericht als CSV (Standard: <output>_bericht.csv)')
    p.add_argument('--tsv', action='store_true', help='Tabulator statt Komma (zum direkten Einfügen per Zwischenablage)')
    p.add_argument('--no-header', action='store_true', help='Ausgabe ohne Kopfzeile (zum Anhängen unter bestehende Zeilen)')
    p.add_argument('--patient-id', default='patient-1', help='patient_id (Standard: patient-1)')
    p.add_argument('--timezone', default='Europe/Berlin', help='Zeitzone für measured_at (Standard: Europe/Berlin)')
    p.add_argument('--year', type=int, help='Jahr für Datumsangaben ohne Jahr (z. B. „27.09.“). Nur angeben, wenn sicher.')
    p.add_argument('--fill-date', action='store_true',
                   help='Leere Datumszellen mit dem Datum der Zeile darüber füllen (wenn im Blatt nur einmal pro Tag notiert)')
    p.add_argument('--existing', type=Path, help='CSV-Export des bestehenden Blatts Measurements für den Duplikatabgleich')
    p.add_argument('--strict', action='store_true', help='Bei Fehlern keine Ausgabedatei schreiben (Rückgabewert 1)')
    a = p.parse_args(argv)

    files = [(str(f.name), read_text(f)) for f in a.inputs]
    existing = read_existing_keys(a.existing) if a.existing else None
    opts = Options(patient_id=a.patient_id, timezone=a.timezone, default_year=a.year, fill_date=a.fill_date)
    results, problems = process(files, opts, existing)

    ok = [r for r in results if r.ok]
    bad = [r for r in results if not r.ok]
    hints = [r for r in ok if r.issues]

    report = a.report or a.output.with_name(a.output.stem + '_bericht.csv')
    with report.open('w', encoding='utf-8', newline='') as f:
        write_report(results, f, problems)

    failed = bool(bad or problems)
    if a.strict and failed:
        print(f'Abbruch (--strict): {len(bad)} fehlerhafte Zeile(n), {len(problems)} Kopfzeilenproblem(e). Bericht: {report}')
        return 1

    with a.output.open('w', encoding='utf-8', newline='') as f:
        write_measurements((r.record for r in ok), f, '\t' if a.tsv else ',', not a.no_header)

    print(f'Gelesen:     {len(results)} Messzeile(n) aus {len(files)} Datei(en)')
    print(f'Übernommen:  {len(ok)} → {a.output}')
    print(f'  davon mit Hinweis: {len(hints)}')
    print(f'Fehlerhaft:  {len(bad)} (nicht übernommen, bitte im Original prüfen)')
    for msg in problems:
        print(f'  ! {msg}')
    print(f'Bericht:     {report}')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
