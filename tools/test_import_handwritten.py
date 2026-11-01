"""Tests für tools/import_handwritten.py – nur fiktive Werte.

Ausführen:  python3 -m unittest discover -s tools -p 'test_*.py'
"""
import csv
import io
import itertools
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import import_handwritten as ih  # noqa: E402

NOW = '2026-01-01T12:00:00.000Z'


def opts(**kw):
    counter = itertools.count(1)
    base = dict(today='2026-06-30', now=lambda: NOW, new_id=lambda: f'test-{next(counter):04d}')
    base.update(kw)
    return ih.Options(**base)


def run(text, name='blatt.csv', existing=None, **kw):
    results, problems = ih.process([(name, text)], opts(**kw), existing)
    return results, problems


def kinds(r):
    return [(i.kind, i.field) for i in r.issues]


class ParseTests(unittest.TestCase):
    def test_dates(self):
        self.assertEqual(ih.parse_date('03.04.2025'), ('2025-04-03', None))
        self.assertEqual(ih.parse_date('3.4.25'), ('2025-04-03', None))
        self.assertEqual(ih.parse_date('2025-04-03'), ('2025-04-03', None))
        self.assertEqual(ih.parse_date('03/04/2025'), ('2025-04-03', None))
        self.assertIsNone(ih.parse_date('31.02.2025')[0])
        self.assertIsNone(ih.parse_date('03.04.')[0])          # ohne Jahr: nichts erfinden
        self.assertEqual(ih.parse_date('03.04.', 2025), ('2025-04-03', None))

    def test_times(self):
        self.assertEqual(ih.parse_time(''), ('', None))
        self.assertEqual(ih.parse_time('7:05'), ('07:05', None))
        self.assertEqual(ih.parse_time('19.30'), ('19:30', None))
        self.assertEqual(ih.parse_time('8 Uhr'), ('08:00', None))
        self.assertIsNone(ih.parse_time('25:00')[0])
        self.assertIsNone(ih.parse_time('morgens')[0])

    def test_headers(self):
        cols = ih.map_headers(['Datum', 'Uhrzeit', 'Sys (mmHg)', 'DIA', 'Puls', 'Bemerkung'])
        self.assertEqual(cols, {'date': 0, 'time': 1, 'systolic': 2, 'diastolic': 3, 'pulse': 4, 'notes': 5})

    def test_measured_at_offset_dst(self):
        self.assertEqual(ih.to_measured_at('2025-01-15', '07:30', 'Europe/Berlin'), '2025-01-15T07:30:00+01:00')
        self.assertEqual(ih.to_measured_at('2025-07-15', '07:30', 'Europe/Berlin'), '2025-07-15T07:30:00+02:00')
        self.assertEqual(ih.to_measured_at('2025-07-15', '', 'Europe/Berlin'), '')


class ConvertTests(unittest.TestCase):
    def test_full_row_matches_measurements_format(self):
        text = 'Datum,Uhrzeit,Sys,Dia,Puls,Notiz\n03.04.2025,07:30,128,82,64,nach Kaffee\n'
        results, problems = run(text)
        self.assertEqual(problems, [])
        rec = results[0].record
        out = io.StringIO()
        ih.write_measurements([rec], out)
        rows = list(csv.reader(io.StringIO(out.getvalue())))
        self.assertEqual(rows[0], ih.MEASUREMENT_COLUMNS)
        self.assertEqual(rows[1], [
            'test-0001', 'patient-1', '2025-04-03T07:30:00+02:00', '2025-04-03', '128', '82', '64',
            'daily', '', '[]', '[]', 'nach Kaffee', 'TRUE', 'historical_import', NOW, NOW, ''])

    def test_no_time_no_pulse_left_empty(self):
        results, _ = run('Datum;Sys;Dia;Puls\n03.04.2025;128;82;\n')
        rec = results[0].record
        self.assertEqual(rec['measured_at'], '')
        self.assertEqual(rec['pulse'], '')
        self.assertEqual(results[0].issues, [])

    def test_combined_rr_column(self):
        results, _ = run('Datum\tRR\tPuls\n03.04.2025\t135 / 85\t70\n')
        self.assertEqual((results[0].record['systolic'], results[0].record['diastolic']), (135, 85))

    def test_errors_are_not_corrected(self):
        text = ('Datum,Sys,Dia,Puls\n'
                '03.04.2025,82,128,60\n'      # vertauscht
                '03.04.2025,1280,82,60\n'     # außerhalb
                '03.04.2025,12?,82,60\n'      # unleserlich
                '03.04.2025,128,,60\n'        # Dia fehlt
                '01.01.2030,128,82,60\n'      # Zukunft
                '03.04.2025,128,82,6\n')      # Puls unter 20
        results, _ = run(text)
        self.assertTrue(all(not r.ok and r.record is None for r in results))
        self.assertIn(('fehler', 'diastolic'), kinds(results[0]))
        self.assertIn(('fehler', 'systolic'), kinds(results[1]))
        self.assertIn(('fehler', 'systolic'), kinds(results[2]))
        self.assertIn(('fehler', 'diastolic'), kinds(results[3]))
        self.assertIn(('fehler', 'measurement_date'), kinds(results[4]))
        self.assertIn(('fehler', 'pulse'), kinds(results[5]))

    def test_plausibility_warnings_keep_row(self):
        results, _ = run('Datum,Sys,Dia,Puls\n03.04.2025,185,112,155\n')
        r = results[0]
        self.assertTrue(r.ok)
        self.assertEqual(r.record['systolic'], 185)
        self.assertEqual({k for k, _ in kinds(r)}, {'hinweis'})
        self.assertEqual({f for _, f in kinds(r)}, {'systolic', 'diastolic', 'pulse'})

    def test_skip_rows_without_values(self):
        results, _ = run('Datum,Sys,Dia\nApril,,\n,,\n03.04.2025,128,82\n')
        self.assertEqual([r.line for r in results], [4])

    def test_fill_date_only_when_asked(self):
        text = 'Datum,Uhrzeit,Sys,Dia\n03.04.2025,07:30,128,82\n,19:30,124,80\n'
        results, _ = run(text)
        self.assertFalse(results[1].ok)
        results, _ = run(text, fill_date=True)
        self.assertTrue(results[1].ok)
        self.assertEqual(results[1].record['measurement_date'], '2025-04-03')
        self.assertIn(('hinweis', 'measurement_date'), kinds(results[1]))

    def test_missing_headers(self):
        results, problems = run('Tag,Wert1,Wert2\n03.04.2025,128,82\n')
        self.assertEqual(results, [])
        self.assertEqual(len(problems), 1)


class DuplicateTests(unittest.TestCase):
    def test_within_import(self):
        text = ('Datum,Uhrzeit,Sys,Dia\n'
                '03.04.2025,,128,82\n'
                '03.04.2025,,128,82\n'          # Duplikat (beide ohne Uhrzeit)
                '03.04.2025,07:30,128,82\n'     # andere Uhrzeit → kein Duplikat
                '03.04.2025,7:30,128,82\n')     # Duplikat der vorherigen
        results, _ = run(text)
        dup = [any(i.field == 'duplikat' for i in r.issues) for r in results]
        self.assertEqual(dup, [False, True, False, True])
        self.assertTrue(all(r.ok for r in results))   # nichts wird verworfen

    def test_against_existing_sheet(self):
        existing_csv = ('id,patient_id,measured_at,measurement_date,systolic,diastolic,deleted_at\n'
                        'x-1,patient-1,2025-04-03T07:30:00+02:00,2025-04-03,128,82,\n'
                        'x-2,patient-1,,2025-04-04,130,85,2025-05-01T00:00:00Z\n')
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / 'existing.csv'
            p.write_text(existing_csv, encoding='utf-8')
            keys = ih.read_existing_keys(p)
        results, _ = run('Datum,Uhrzeit,Sys,Dia\n03.04.2025,07:30,128,82\n04.04.2025,,130,85\n', existing=keys)
        self.assertTrue(any('x-1' in i.message for i in results[0].issues))
        self.assertEqual(results[1].issues, [])   # gelöschte Zeilen zählen nicht


class CliTests(unittest.TestCase):
    def test_end_to_end(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / 'blatt.csv').write_text('Datum,Uhrzeit,Sys,Dia,Puls\n03.04.2025,07:30,128,82,64\n03.04.2025,,82,128,\n',
                                         encoding='utf-8')
            code = ih.main([str(d / 'blatt.csv'), '-o', str(d / 'out.tsv'), '--tsv'])
            self.assertEqual(code, 1)   # eine fehlerhafte Zeile
            out = (d / 'out.tsv').read_text(encoding='utf-8').splitlines()
            self.assertEqual(out[0].split('\t'), ih.MEASUREMENT_COLUMNS)
            self.assertEqual(len(out), 2)
            report = list(csv.DictReader((d / 'out_bericht.csv').open(encoding='utf-8')))
            self.assertEqual(report[0]['zeile'], '3')
            self.assertEqual(report[0]['art'], 'fehler')

    def test_strict_writes_nothing(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / 'blatt.csv').write_text('Datum,Sys,Dia\n03.04.2025,82,128\n', encoding='utf-8')
            code = ih.main([str(d / 'blatt.csv'), '-o', str(d / 'out.csv'), '--strict'])
            self.assertEqual(code, 1)
            self.assertFalse((d / 'out.csv').exists())


if __name__ == '__main__':
    unittest.main()
