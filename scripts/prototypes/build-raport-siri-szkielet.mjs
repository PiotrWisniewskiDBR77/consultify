/**
 * PROTOTYP B1 — szkielet raportu końcowego Oceny dla metodyki SIRI (2 strony).
 *
 * To NIE jest raport z danymi. To struktura: jak ta sama formuła
 * (wstęp → rozdziały jednostek metodyki → odpowiedzi i wnioski → podsumowanie)
 * układa się dla SIRI, która ma inną liczbę i inną naturę jednostek niż DRD.
 *
 * Źródła struktury: src/services/siriStructure.ts (3 bloki, 8 filarów,
 * 16 wymiarów priorytetyzacji, skala Band 0–5),
 * src/method-core/methods/siri/siriAdapter.ts (silnik operuje na 16D).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType, BorderStyle, Document, Footer, Header, PageNumber, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign,
  WidthType, convertMillimetersToTwip,
} from 'docx';

const C = { text: '0F172A', sec: '475569', muted: '64748B', line: 'E6E9ED', subtle: 'EEF2F6', raised: 'F8FAFC', dark: '334155', accent: '85182F' };
const FONT = 'Helvetica Neue';
const FONT_SERIF = 'Georgia';
const W = convertMillimetersToTwip(170);

const run = (t, o = {}) => new TextRun({ text: t, font: o.font || FONT, size: o.size || 20, bold: !!o.bold, color: o.color || C.text, allCaps: !!o.caps, characterSpacing: o.spacing });
const p = (t, o = {}) => new Paragraph({ alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 264 }, keepNext: o.keepNext, widowControl: true, children: Array.isArray(t) ? t : [run(t, o)] });
const kicker = (t) => p(t, { size: 15, bold: true, color: C.muted, caps: true, spacing: 40, after: 40, keepNext: true });
const h1 = (t) => new Paragraph({ spacing: { before: 0, after: 130, line: 250 }, keepNext: true, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.text, space: 8 } }, children: [run(t, { size: 32, bold: true })] });
const h2 = (t) => p(t, { size: 21, bold: true, color: C.dark, before: 200, after: 70, keepNext: true });
const bullet = (t, o = {}) => new Paragraph({ bullet: { level: 0 }, spacing: { after: o.after ?? 60, line: 258 }, widowControl: true, children: [run(t, { size: o.size || 19, color: o.color || C.text })] });
const hairline = () => ({ top: { style: BorderStyle.SINGLE, size: 2, color: C.line }, bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line }, left: { style: BorderStyle.SINGLE, size: 2, color: C.line }, right: { style: BorderStyle.SINGLE, size: 2, color: C.line }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: C.line }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: C.line } });
const cell = (children, o = {}) => new TableCell({ children, verticalAlign: o.valign || VerticalAlign.CENTER, shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined, margins: { top: 58, bottom: 58, left: 95, right: 95 } });
function tbl(headers, rows, cols, o = {}) {
  const widths = cols.map((c) => Math.round((c / 100) * W));
  const head = new TableRow({ tableHeader: true, children: headers.map((h, i) => cell([p(h, { size: 16, bold: true, color: C.dark, after: 0, line: 230, align: o.alignCenter?.includes(i) ? AlignmentType.CENTER : undefined })], { fill: C.subtle })) });
  const body = rows.map((r, ri) => new TableRow({ children: r.map((v, i) => cell([p(String(v), { size: 17, after: 0, line: 250, align: o.alignCenter?.includes(i) ? AlignmentType.CENTER : undefined })], { fill: ri % 2 === 1 ? C.raised : undefined })) }));
  return new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths, borders: hairline(), rows: [head, ...body], layout: 'fixed' });
}
const spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [run('', { size: 2 })] });
const callout = (children, color = C.dark, fill = C.raised) => new Table({
  width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [Math.round(W * 0.012), Math.round(W * 0.988)], layout: 'fixed',
  borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
  rows: [new TableRow({ children: [new TableCell({ children: [p('', { after: 0 })], shading: { type: ShadingType.CLEAR, fill: color, color: 'auto' }, margins: { top: 0, bottom: 0, left: 0, right: 0 } }), cell(children, { fill, valign: VerticalAlign.TOP })] })],
});

const D16 = [
  ['Procesy', 'Operations', 'Integracja Pionowa'],
  ['Procesy', 'Supply Chain', 'Integracja Pozioma'],
  ['Procesy', 'Product Lifecycle', 'Zintegrowany Cykl Życia Produktu'],
  ['Technologia', 'Automation', 'Automatyzacja Produkcji · Przedsiębiorstwa · Obiektów'],
  ['Technologia', 'Connectivity', 'Łączność Produkcji · Przedsiębiorstwa · Obiektów'],
  ['Technologia', 'Intelligence', 'Inteligencja Produkcji · Przedsiębiorstwa · Obiektów'],
  ['Organizacja', 'Talent Readiness', 'Rozwój i Szkolenia Pracowników · Kompetencje Liderów'],
  ['Organizacja', 'Structure & Management', 'Strategia i Governance · Współpraca Wewnętrzna i Zewnętrzna'],
];

const strona1 = [
  kicker('Prototyp B1 · szkielet, nie raport'),
  h1('Raport końcowy Oceny — szkielet dla metodyki SIRI'),
  p('Dokument pokazuje, jak formuła przyjęta dla DRD (wstęp → rozdziały jednostek metodyki → odpowiedzi i wnioski zbiorcze → podsumowanie) układa się dla SIRI. Nie zawiera danych klienta ani narracji — służy wyłącznie do rozstrzygnięcia struktury przed budową silnika.'),
  callout([
    p('Jedno rozstrzygnięcie do podjęcia przed budową.', { size: 20, bold: true, after: 70 }),
    p('SIRI mierzy na 16 wymiarach, a komunikuje na 8 filarach zgrupowanych w 3 bloki. DRD ma jeden poziom jednostek (7 osi). Dlatego dla SIRI rozdziałów może być 8 (po filarze, czytelne dla zarządu) albo 16 (po wymiarze, wierne pomiarowi). Rekomendacja: 8 rozdziałów po filarach, z tabelą wymiarów wewnątrz rozdziału.', { size: 19, color: C.sec, after: 0 }),
  ]),
  spacer(150),
  h2('Struktura metodyki'),
  tbl(['Blok', 'Filar (rozdział raportu)', 'Wymiary mierzone w rozdziale'], D16, [16, 26, 58]),
  spacer(90),
  p('Skala: Band 0–5 — jednolita dla wszystkich wymiarów (0 Not Started · 1 Defined · 2 Digital · 3 Integrated · 4 Automated · 5 Intelligent). To pierwsza istotna różnica wobec DRD, gdzie skale osi są różne (7/5/5/7/6/6/5) i wymagają przeliczania na procent skali.', { size: 19, color: C.sec }),
  h2('Różnice wobec raportu DRD — co silnik musi obsłużyć inaczej'),
  tbl(['Element', 'DRD', 'SIRI'], [
    ['Jednostka rozdziału', '7 osi', '8 filarów (rekomendacja) lub 16 wymiarów'],
    ['Skala', 'różna per oś: 7/5/5/7/6/6/5', 'jednolita 0–5 dla wszystkich wymiarów'],
    ['Porównanie między jednostkami', 'przez procent skali', 'wprost, na poziomach — bez przeliczania'],
    ['Wskaźnik poziomu', 'pasek o długości skali osi', 'pasek stały, 6 pól (0–5)'],
    ['Priorytetyzacja', 'ekspercka, per oś, z sufitem', 'Impact Value z macierzy metodyki (rangi 1–16)'],
    ['Poziom docelowy', 'uzgadniany, świadomie poniżej maksimum', 'wynika z Impact Value + decyzji zarządu'],
  ], [24, 34, 42]),
];

const strona2 = [
  kicker('Szkielet'),
  h1('Stały szablon rozdziału filaru'),
  p('Kolejność bloków identyczna jak w rozdziale osi DRD — dzięki temu oba raporty czyta się tak samo, mimo różnych metodyk.'),
  tbl(['#', 'Blok rozdziału', 'Zawartość', 'Źródło danych'], [
    ['1', 'Werdykt', 'jedno zdanie, maksimum 25 słów', 'narrator na stanie zatwierdzonym'],
    ['2', 'Wskaźnik poziomu', 'pasek 0–5, AS-IS i TO-BE filaru', 'agregat z wymiarów filaru'],
    ['3', 'Zakres oceny', 'co ten filar mierzy w tej firmie', 'opis filaru z paczki metodyki'],
    ['4', 'Co zbadano', 'pytania dowodowe użyte w wywiadzie', 'QBank SIRI, poziom wymiaru'],
    ['5', 'Odpowiedzi klienta w skrócie', '3–5 ustaleń', 'odpowiedzi zatwierdzone w sesji'],
    ['6', 'Dowody', 'dowód · źródło · stan (potwierdzony / deklarowany / brak)', 'załączniki i notatki sesji'],
    ['7', 'Wymiary filaru', 'tabela: wymiar · AS-IS · TO-BE · luka · Impact Value · dowód', 'silnik 16D'],
    ['8', 'Wnioski', '2–4 akapity syntezy, nie powtórzenie tabeli', 'narrator'],
    ['9', 'Rekomendacje', 'rekomendacja · priorytet · horyzont · właściciel', 'narrator + Impact Value'],
    ['10', 'Linia decyzyjna', 'kierunek | priorytet | horyzont | warunek powodzenia', 'narrator'],
  ], [5, 25, 40, 30], { alignCenter: [0] }),
  spacer(140),
  h2('Rozdziały wspólne'),
  tbl(['Rozdział', 'Zawartość specyficzna dla SIRI'], [
    ['Wstęp', 'cel, zakres, metodyka SIRI, jak czytać Bandy 0–5, skład zespołu, kalendarz badania'],
    ['Odpowiedzi i wnioski zbiorcze', 'macierz 8 filarów × Band, ranking 16 wymiarów po Impact Value, 3–5 wniosków przekrojowych'],
    ['Podsumowanie', 'mapa drogowa w falach, wymiary wskazane przez metodykę jako ogniska (focus dimensions), kolejny krok z terminami'],
    ['Granice wnioskowania', 'co potwierdzone dowodem, co deklarowane, czego nie badano; zastrzeżenie o braku formuły agregacji 16D → 8D w kanonie'],
  ], [26, 74]),
  spacer(150),
  callout([
    p('Uwaga metodyczna do rozstrzygnięcia', { size: 16, bold: true, color: C.accent, caps: true, spacing: 40, after: 60 }),
    p('Kanon SIRI (whitepaper) definiuje ocenę na poziomie 16 wymiarów i nie podaje formuły agregacji do 8 filarów. Jeżeli raport ma pokazywać wynik filaru, silnik musi używać własnej, jawnie udokumentowanej reguły agregacji i oznaczać ją w raporcie jako regułę Consultify, a nie jako wynik metodyki. Bez tego oznaczenia raport przypisze metodyce liczbę, której ona nie definiuje.', { size: 19, after: 0 }),
  ], C.accent, 'FBF5F6'),
];

const sekcja = (children) => ({
  properties: { page: { margin: { top: convertMillimetersToTwip(22), bottom: convertMillimetersToTwip(20), left: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20) } } },
  headers: { default: new Header({ children: [new Paragraph({ tabStops: [{ type: 'right', position: W }], border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line, space: 6 } }, spacing: { after: 220 }, children: [run('Szkielet raportu końcowego Oceny · metodyka SIRI · prototyp B1', { size: 15, color: C.muted }), run('\t', { size: 15 }), new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: C.muted })] })] }) },
  footers: { default: new Footer({ children: [new Paragraph({ spacing: { before: 160 }, children: [run('Consultify · dokument roboczy do akceptu właściciela · 3 września 2026', { size: 14, color: C.muted })] })] }) },
  children,
});

const doc = new Document({
  creator: 'Consultify', title: 'Szkielet raportu końcowego Oceny — SIRI',
  styles: { default: { document: { run: { font: FONT, size: 20, color: C.text } } } },
  sections: [sekcja(strona1), sekcja(strona2)],
});
const out = path.resolve(process.argv[2] || 'docs/program/prototypy/RAPORT_OCENY_SIRI_SZKIELET_20260903.docx');
fs.mkdirSync(path.dirname(out), { recursive: true });
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(out, buf);
console.log(`OK → ${out} (${(buf.length / 1024).toFixed(0)} kB)`);
