'use strict';
/**
 * In-Memory-Repository mit derselben Schnittstelle wie das Google-Sheets-Repository.
 * Für Tests und die lokale Vorschau. Speichert Kopien, damit Aufrufer
 * Datensätze nicht versehentlich direkt verändern.
 */
const Schema = require('./schema');

function clone(o) { return JSON.parse(JSON.stringify(o)); }

function createMemoryRepository(initial) {
  const tables = {};
  Object.keys(Schema.SHEETS).forEach(n => { tables[n] = []; });
  if (initial) Object.keys(initial).forEach(n => { tables[n] = initial[n].map(clone); });

  function keyOf(sheet) { return Schema.SHEETS[sheet].key; }

  return {
    getAll(sheet) { return tables[sheet].map(clone); },
    insert(sheet, rec) {
      const k = keyOf(sheet);
      if (tables[sheet].some(r => r[k] === rec[k])) throw new Error('Doppelte ID in ' + sheet + ': ' + rec[k]);
      tables[sheet].push(clone(rec));
    },
    update(sheet, rec) {
      const k = keyOf(sheet);
      const i = tables[sheet].findIndex(r => r[k] === rec[k]);
      if (i < 0) throw new Error('Datensatz nicht gefunden: ' + rec[k]);
      tables[sheet][i] = clone(rec);
    },
    dump() { return clone(tables); }
  };
}

module.exports = { createMemoryRepository };
