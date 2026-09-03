// Scala JSON od robotnika do warstwy dla właściciela. Nie nadpisuje zdań już zatwierdzonych.
import fs from 'fs';
const [,, plikCo, plikPoza] = process.argv;
const CO = 'docs/program/grafika/CO_DOMYKA_20260902.json';
const POZA = 'docs/program/grafika/EKRANY_POZA_ODBIOREM_20260902.json';

if (plikCo && fs.existsSync(plikCo)) {
  const doc = JSON.parse(fs.readFileSync(CO, 'utf8'));
  const nowe = JSON.parse(fs.readFileSync(plikCo, 'utf8')).co_domyka || {};
  let dodane = 0, pominiete = 0;
  for (const [id, t] of Object.entries(nowe)) {
    if (doc.ekrany[id]) { pominiete++; continue; }   // zatwierdzone zostaje
    doc.ekrany[id] = t; dodane++;
  }
  fs.writeFileSync(CO, JSON.stringify(doc, null, 2) + '\n');
  console.log(`co_domyka: dodane ${dodane}, pominięte (już zatwierdzone) ${pominiete}`);
}
if (plikPoza && fs.existsSync(plikPoza)) {
  const doc = JSON.parse(fs.readFileSync(POZA, 'utf8'));
  const src = JSON.parse(fs.readFileSync(plikPoza, 'utf8'));
  let dodane = 0;
  for (const [id, o] of Object.entries(src.poza_odbiorem || {})) {
    if (doc.ekrany[id]) continue;
    doc.ekrany[id] = { nazwa: o.nazwa_dla_wlasciciela, kategoria: o.kategoria, powod: o.powod };
    dodane++;
  }
  const zostaje = (src.nadal_watpliwe || []).map((x) => x.id);
  doc._watpliwe = (doc._watpliwe || []).filter((w) => zostaje.includes(w.id));
  fs.writeFileSync(POZA, JSON.stringify(doc, null, 2) + '\n');
  console.log(`poza_odbiorem: domknięte ${dodane}, luka zostaje przy ${doc._watpliwe.length}`);
}
