/* eslint-disable */
/** Macierz partii C — ZMIERZONA z kodu (nie z opisu). */
import fs from 'node:fs';
import path from 'node:path';

const MODULY = [
  ['My Work', ['src/components/MyWork']],
  ['Assessment', ['src/components/assessment']],
  ['Interview', ['src/components/Interview']],
  ['Materialy', ['src/components/Materials', 'src/components/ReportsAndPresentations', 'src/components/DocumentStudio']],
  ['Wyniki', ['src/components/ResultsVNext', 'src/components/Results']],
  ['Audyty', ['src/components/Audit']],
  ['Spotkania', ['src/components/Meeting']],
  ['Admin', ['src/components/Admin', 'src/views/admin', 'src/views/superadmin']],
  ['Inicjatywy', ['src/components/Initiatives']],
  ['Realizacja', ['src/components/Execution']],
];

const walk = (dir, out = []) => {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out); }
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
};

const rows = [];
for (const [nazwa, katalogi] of MODULY) {
  const pliki = katalogi.flatMap((d) => walk(d));
  const tabele = pliki.filter((f) => /<(StandardTable|FilterableTable)[\s>]/.test(fs.readFileSync(f, 'utf8')));
  const typowane = tabele.filter((f) => /dataType:/.test(fs.readFileSync(f, 'utf8')));
  const podglady = pliki.filter((f) => /<StandardPreview[\s>]/.test(fs.readFileSync(f, 'utf8')));
  const bespokePodglad = pliki.filter((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return /<PreviewPaneShell[\s>]/.test(s) && !/<StandardPreview[\s>]/.test(s);
  });
  const wlasnaPustkaRelacji = pliki.filter((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return /(No relations|Brak powiązań)/.test(s) && !/PreviewRelations/.test(s);
  });
  // Tylko WEWNATRZ bloku `meta={{ ... }}` — poprzednia wersja skanowala caly
  // plik i dawala falszywe trafienia (`|| '—'` z tabeli wlasciwosci w Details).
  const blokMeta = (s) => {
    const i = s.indexOf('meta={{');
    if (i < 0) return '';
    return s.slice(i, i + 1400);
  };
  const wlasneMeta = pliki.filter((f) => {
    const s = fs.readFileSync(f, 'utf8');
    if (!/<StandardPreview[\s>]/.test(s)) return false;
    const m = blokMeta(s);
    return /(\|\| '—'|\|\| '-'|'Unknown'|'None'|v\{|v—)/.test(m);
  });
  const surowaTabela = pliki.filter((f) => {
    const s = fs.readFileSync(f, 'utf8');
    return /<table[\s>/]/.test(s) && !/§27-exempt/.test(s);
  });
  rows.push({ modul: nazwa, tabelKanonu: tabele.length, ztypami: typowane.length,
    podgladKanonu: podglady.length, podgladBespoke: bespokePodglad.length,
    wlasnaPustkaRelacji: wlasnaPustkaRelacji.length, metaZeSmieciami: wlasneMeta.length,
    surowaTabela: surowaTabela.length,
    pliki: { typy: typowane.map(p=>p), metaSmieci: wlasneMeta, pustkaRelacji: wlasnaPustkaRelacji } });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('MODUŁ', 12), pad('tabel', 6), pad('z typami', 9), pad('podgląd kanon', 14), pad('podgląd własny', 15), pad('własna pustka rel.', 19), pad('meta ze śmieciami', 18), 'surowa <table>');
for (const r of rows) {
  console.log(pad(r.modul, 12), pad(r.tabelKanonu, 6), pad(r.ztypami, 9), pad(r.podgladKanonu, 14), pad(r.podgladBespoke, 15), pad(r.wlasnaPustkaRelacji, 19), pad(r.metaZeSmieciami, 18), r.surowaTabela);
}
fs.writeFileSync('evidence/k5-7-kanon-sweep/macierz-partia-c.json', JSON.stringify(rows, null, 1));
