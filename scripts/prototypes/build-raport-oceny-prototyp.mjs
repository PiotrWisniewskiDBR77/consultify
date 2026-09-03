/**
 * PROTOTYP B1 — budowa pliku DOCX raportu końcowego Oceny (DRD).
 *
 * Uruchomienie (z katalogu roboczego z dowiązanym node_modules):
 *   node scripts/prototypes/build-raport-oceny-prototyp.mjs
 *
 * Wynik: docs/program/prototypy/RAPORT_OCENY_DRD_PROTOTYP_20260903.docx
 *
 * Paleta: tokeny z src/index.css (slate/neutral). Crimson --c-accent #85182F
 * WYŁĄCZNIE jako semantyka krytyczna (priorytet „Krytyczny", ramka ryzyka).
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType, BorderStyle, Document, Footer, Header, PageBreak, PageNumber, Packer,
  Paragraph, ShadingType, Table, TableCell, TableRow, TextRun, VerticalAlign,
  WidthType, convertMillimetersToTwip,
} from 'docx';
import { META, OSIE, WYNIK_OGOLNY, WNIOSKI_PRZEKROJOWE, MAPA_DROGOWA, KOLEJNY_KROK, GRANICE } from './raport-oceny-tresc.mjs';

// ---------- paleta (src/index.css) ----------
const C = {
  text: '0F172A',        // --c-text
  sec: '475569',         // --c-text-secondary
  muted: '64748B',       // --c-text-muted
  line: 'E6E9ED',        // --c-border-subtle
  border: 'CBD2DA',      // --c-border
  strong: '9AA6B5',      // --c-border-strong
  subtle: 'EEF2F6',      // --c-surface-subtle
  raised: 'F8FAFC',      // --c-surface-raised
  dark: '334155',
  accent: '85182F',      // --c-accent (crimson) — TYLKO semantyka krytyczna
  info: '3B2883',        // --c-info
};
const FONT = 'Helvetica Neue';
const FONT_SERIF = 'Georgia';
const W = convertMillimetersToTwip(170); // szerokość kolumny tekstu

// ---------- pomocnicze ----------
const run = (text, o = {}) => new TextRun({ text, font: o.font || FONT, size: o.size || 20,
  bold: !!o.bold, italics: !!o.italics, color: o.color || C.text, allCaps: !!o.caps,
  characterSpacing: o.spacing });

const p = (text, o = {}) => new Paragraph({
  alignment: o.align, spacing: { before: o.before ?? 0, after: o.after ?? 100, line: o.line ?? 264 },
  indent: o.indent, keepNext: o.keepNext, keepLines: o.keepLines !== false, widowControl: true,
  border: o.border,
  children: Array.isArray(text) ? text : [run(text, o)],
});

const kicker = (t) => p(t, { size: 15, bold: true, color: C.muted, caps: true, spacing: 40, after: 40, keepNext: true });

const h1 = (t) => new Paragraph({
  spacing: { before: 0, after: 130, line: 250 }, keepNext: true,
  border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: C.text, space: 8 } },
  children: [run(t, { size: 32, bold: true })],
});

const h2 = (t) => p(t, { size: 21, bold: true, color: C.dark, before: 200, after: 70, keepNext: true });

const h3 = (t) => p(t, { size: 17, bold: true, color: C.sec, before: 130, after: 45, keepNext: true, caps: true, spacing: 20 });

const bullet = (t, o = {}) => new Paragraph({
  bullet: { level: 0 }, spacing: { after: o.after ?? 60, line: 258 }, widowControl: true,
  children: [run(t, { size: o.size || 19, color: o.color || C.text })],
});

const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};
const hairline = (color = C.line) => ({
  top: { style: BorderStyle.SINGLE, size: 2, color },
  bottom: { style: BorderStyle.SINGLE, size: 2, color },
  left: { style: BorderStyle.SINGLE, size: 2, color },
  right: { style: BorderStyle.SINGLE, size: 2, color },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color },
  insideVertical: { style: BorderStyle.SINGLE, size: 2, color },
});

const cell = (children, o = {}) => new TableCell({
  children, verticalAlign: o.valign || VerticalAlign.CENTER,
  columnSpan: o.span,
  shading: o.fill ? { type: ShadingType.CLEAR, fill: o.fill, color: 'auto' } : undefined,
  margins: { top: o.pad ?? 58, bottom: o.pad ?? 58, left: 95, right: 95 },
  borders: o.borders,
});

/** Tabela danych: nagłówek + wiersze. `cols` = udziały procentowe. */
function tbl(headers, rows, cols, o = {}) {
  const widths = cols.map((c) => Math.round((c / 100) * W));
  const headRow = new TableRow({
    tableHeader: true,
    children: headers.map((htxt, i) => cell(
      [p(htxt, { size: 16, bold: true, color: C.dark, after: 0, line: 230,
        align: o.alignRight?.includes(i) ? AlignmentType.RIGHT : (o.alignCenter?.includes(i) ? AlignmentType.CENTER : undefined) })],
      { fill: C.subtle, pad: 68 }
    )),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    children: r.map((v, i) => {
      const isCrit = typeof v === 'string' && v === 'Krytyczny';
      return cell([p(String(v), {
        size: 17, color: isCrit ? C.accent : (i === 0 && o.boldFirst ? C.text : C.text),
        bold: isCrit || (i === 0 && o.boldFirst), after: 0, line: 250,
        align: o.alignRight?.includes(i) ? AlignmentType.RIGHT : (o.alignCenter?.includes(i) ? AlignmentType.CENTER : undefined),
      })], { fill: ri % 2 === 1 ? C.raised : undefined });
    }),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: widths,
    borders: hairline(), rows: [headRow, ...bodyRows], layout: 'fixed',
  });
}

/** Wskaźnik poziomu: pasek natywnej skali osi z numerami poziomów w polach. */
function levelBar(asIs, toBe, max) {
  const cw = Math.round(W / max);
  const cells = [];
  for (let lvl = 1; lvl <= max; lvl++) {
    const osiagniety = lvl <= Math.round(asIs);
    const docelowy = !osiagniety && lvl <= Math.round(toBe);
    const fill = osiagniety ? C.dark : docelowy ? C.border : C.subtle;
    const col = osiagniety ? 'FFFFFF' : docelowy ? C.text : C.muted;
    cells.push(cell([p(String(lvl), { size: 18, bold: osiagniety || docelowy, color: col, align: AlignmentType.CENTER, after: 0, line: 240 })],
      { fill, pad: 90, borders: { top: { style: BorderStyle.SINGLE, size: 2, color: 'FFFFFF' }, bottom: { style: BorderStyle.SINGLE, size: 2, color: 'FFFFFF' }, left: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' }, right: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' } } }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: new Array(max).fill(cw),
    borders: noBorders, rows: [new TableRow({ children: cells })], layout: 'fixed',
  });
}

/** Ramka wyróżnienia: pionowa linia z lewej + treść. */
function callout(children, o = {}) {
  const barColor = o.color || C.dark;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [Math.round(W * 0.012), Math.round(W * 0.988)],
    borders: noBorders, layout: 'fixed',
    rows: [new TableRow({ children: [
      cell([p('', { after: 0 })], { fill: barColor, pad: 0 }),
      cell(children, { fill: o.fill || C.raised, pad: 120, valign: VerticalAlign.TOP }),
    ] })],
  });
}

const spacer = (h = 120) => new Paragraph({ spacing: { before: 0, after: h }, children: [run('', { size: 2 })] });
const fmt = (n) => n.toFixed(n % 1 === 0 ? 1 : 2).replace('.', ',').replace(/,(\d)0$/, ',$1');
const pct = (n) => `${n.toFixed(1).replace('.', ',')}%`;

// ---------- 1. Strona tytułowa ----------
const cover = [
  spacer(1600),
  p('CONSULTIFY · DBR77', { size: 17, bold: true, color: C.muted, caps: true, spacing: 60, after: 900 }),
  p(META.tytul, { font: FONT_SERIF, size: 56, bold: true, after: 140, line: 380 }),
  p(META.metodyka, { size: 24, color: C.sec, after: 700 }),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [W],
    borders: { top: { style: BorderStyle.SINGLE, size: 12, color: C.text }, bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [new TableRow({ children: [cell([
      p(META.klient, { font: FONT_SERIF, size: 30, bold: true, after: 80 }),
      p(META.klientOpis, { size: 18, color: C.sec, after: 0, line: 260 }),
    ], { pad: 220, valign: VerticalAlign.TOP })] })],
  }),
  spacer(900),
  new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [Math.round(W * 0.3), Math.round(W * 0.7)], layout: 'fixed',
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: C.line }, insideVertical: { style: BorderStyle.NONE } },
    rows: [
      ['Data raportu', META.dataRaportu],
      ['Okres badania', META.okresBadania],
      ['Wersja', META.wersja],
      ['Partner prowadzący', `${META.zespolDoradczy[0][0]} — ${META.zespolDoradczy[0][1]}`],
      ['Wynik ogólny', `${pct(WYNIK_OGOLNY.procent)} skali · ${META.benchmark}`],
    ].map(([k, v]) => new TableRow({ children: [
      cell([p(k, { size: 17, color: C.muted, after: 0, line: 240 })], { pad: 100, valign: VerticalAlign.TOP }),
      cell([p(v, { size: 18, bold: true, after: 0, line: 240 })], { pad: 100, valign: VerticalAlign.TOP }),
    ] })),
  }),
  spacer(400),
  p('Dokument poufny. Przeznaczony wyłącznie dla zarządu TechProd Manufacturing Sp. z o.o. oraz wskazanych przez zarząd odbiorców wewnętrznych.', { size: 16, color: C.muted, after: 0 }),
];

// ---------- 2. Wstęp ----------
const wstep = [
  kicker('Rozdział wstępny'),
  h1('Wstęp'),
  h2('Cel oceny'),
  p('Zarząd TechProd Manufacturing zlecił ocenę dojrzałości cyfrowej, żeby odpowiedzieć na jedno pytanie: czy pieniądze wydawane na cyfryzację trafiają tam, gdzie firma ma największą lukę. Ocena ma dostarczyć podstawy do decyzji budżetowej na lata 2027–2028, a nie katalogu życzeń technologicznych.'),
  p('Raport odpowiada na trzy pytania: gdzie organizacja jest dzisiaj (stan AS-IS, potwierdzony dowodem), dokąd powinna dojść w horyzoncie 24 miesięcy (stan TO-BE, uzgodniony z zarządem) oraz w jakiej kolejności należy działać, żeby kolejne kroki nie blokowały się nawzajem.'),
  h2('Zakres i sposób prowadzenia badania'),
  p('Badanie objęło całą organizację w siedmiu osiach metodyki DRD i 39 obszarach szczegółowych. Podstawą oceny są dowody — dokumenty, zrzuty z systemów, eksporty danych i obserwacja na miejscu. Wypowiedź bez artefaktu jest w tym raporcie oznaczana jako deklaracja i jako taka wchodzi do oceny z niższą wagą.'),
  tbl(['Termin', 'Działanie'], META.kalendarz, [22, 78]),
  spacer(140),
  h2('Metodyka DRD'),
  p('Digital Readiness Diagnosis to metodyka oceny dojrzałości cyfrowej opisana w książce „Digital Pathfinder" dr. Piotra Wiśniewskiego. Łączy doradztwo strategiczne z reorganizacją operacyjną: najpierw ustala stan faktyczny, potem definiuje inicjatywy transformacyjne, a na końcu układa je w spójną sekwencję z efektami ekonomicznymi. Metodyka wymaga, żeby zdolności warunkujące powstały przed rozwiązaniami zaawansowanymi — dlatego mapa drogowa w tym raporcie ma wymuszoną kolejność, a nie listę priorytetów do dowolnego wyboru.'),
  tbl(['Oś', 'Nazwa', 'Obszary', 'Skala'], OSIE.map((o) => [String(o.nr), o.nazwa, String(o.obszary), `1–${o.skala}`]),
    [10, 58, 16, 16], { alignCenter: [0, 2, 3] }),
  spacer(160),
  h2('Jak czytać poziomy'),
  p('Osie mają różne skale, bo mierzą różne rzeczy. Procesy cyfrowe i zarządzanie danymi mają siedem poziomów, kultura i cyberbezpieczeństwo sześć, pozostałe pięć. Poziom 4 na osi produktów nie znaczy tego samego co poziom 4 na osi procesów.'),
  p([
    run('Dlatego porównania między osiami prowadzimy w ', { size: 21 }),
    run('procencie skali', { size: 21, bold: true }),
    run(' (poziom osiągnięty podzielony przez maksimum danej osi), a wewnątrz osi — w poziomach natywnych. Wynik ogólny w tym raporcie to średnia z procentów skali siedmiu osi, liczona z równą wagą.', { size: 21 }),
  ]),
  callout([
    p('Wyższy poziom nie jest automatycznie lepszy.', { size: 21, bold: true, after: 70 }),
    p('Metodyka DRD nie zakłada, że każda oś ma dojść do maksimum. Poziom docelowy wynika ze znaczenia strategicznego obszaru, zależności między osiami, kosztu, zdolności wykonawczej i ryzyka. W trzech osiach tego raportu rekomendujemy świadomie sufit poniżej maksimum skali i podajemy uzasadnienie w rozdziale każdej z nich.', { size: 20, color: C.sec, after: 0 }),
  ]),
  spacer(160),
  p('Każdy rozdział osi ma tę samą budowę: werdykt jednym zdaniem, wskaźnik poziomu, co zbadano, odpowiedzi klienta, dowody, tabela obszarów, wnioski, rekomendacje i linia decyzyjna. Kolejność jest stała we wszystkich siedmiu rozdziałach, żeby dało się je porównywać.'),
  h2('Skład zespołu'),
  tbl(['Zespół doradczy', 'Rola'], META.zespolDoradczy, [38, 62]),
  spacer(120),
  tbl(['Zespół klienta', 'Rola'], META.zespolKlienta, [38, 62]),
];

// ---------- 3. Rozdziały osi ----------
function rozdzialOsi(o) {
  const out = [];
  out.push(kicker(`Oś ${o.nr} z 7`));
  out.push(h1(`${o.nazwa}`));
  out.push(callout([p(o.werdykt, { size: 22, bold: true, after: 0, line: 280 })], { color: o.ryzyko ? C.accent : C.dark, fill: C.raised }));
  out.push(spacer(140));

  out.push(h3('Poziom dojrzałości'));
  out.push(levelBar(o.asIs, o.toBe, o.skala));
  out.push(spacer(60));
  out.push(p([
    run(`Stan obecny (AS-IS): ${fmt(o.asIs)} z ${o.skala}`, { size: 20, bold: true }),
    run(`   ·   Cel uzgodniony (TO-BE): ${fmt(o.toBe)} z ${o.skala}   ·   ${pct(o.procent)} skali   ·   ${o.obszary} obszarów`, { size: 20, color: C.sec }),
  ], { after: 60 }));
  out.push(p('Pola ciemne — poziomy osiągnięte. Pola szare — zakres do celu uzgodnionego. Pola jasne — poza zakresem tej mapy drogowej.', { size: 15, color: C.muted, after: 60 }));

  if (o.ryzyko) {
    out.push(callout([
      p('RYZYKO', { size: 16, bold: true, color: C.accent, caps: true, spacing: 60, after: 60 }),
      p(o.ryzyko, { size: 20, after: 0, line: 270 }),
    ], { color: C.accent, fill: 'FBF5F6' }));
    out.push(spacer(150));
  }

  out.push(h3('Zakres oceny'));
  out.push(p(o.zakres, { size: 18, color: C.sec, after: 60 }));

  out.push(spacer(90));
  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [Math.round(W * 0.44), Math.round(W * 0.56)],
    layout: 'fixed',
    borders: { top: { style: BorderStyle.SINGLE, size: 2, color: C.line }, bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: C.line }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: C.line } },
    rows: [
      new TableRow({ tableHeader: true, children: [
        cell([p('Co zbadano', { size: 16, bold: true, color: C.dark, caps: true, spacing: 20, after: 0, line: 230 })], { fill: C.subtle, pad: 68 }),
        cell([p('Odpowiedzi klienta w skrócie', { size: 16, bold: true, color: C.dark, caps: true, spacing: 20, after: 0, line: 230 })], { fill: C.subtle, pad: 68 }),
      ] }),
      new TableRow({ children: [
        cell(o.pytania.map((q, i) => bullet(q, { size: 17, color: C.sec, after: i === o.pytania.length - 1 ? 0 : 60 })), { valign: VerticalAlign.TOP, pad: 90 }),
        cell(o.odpowiedzi.map((a, i) => bullet(a, { size: 17, after: i === o.odpowiedzi.length - 1 ? 0 : 60 })), { valign: VerticalAlign.TOP, pad: 90 }),
      ] }),
    ],
  }));
  out.push(spacer(140));

  out.push(h3('Dowody'));
  out.push(tbl(['Dowód', 'Źródło', 'Stan'], o.dowody, [58, 26, 16], { alignCenter: [2] }));
  out.push(new Paragraph({ children: [new PageBreak()] }));

  out.push(h3('Obszary osi'));
  out.push(tbl(['', 'Obszar', 'AS-IS', 'TO-BE', 'Luka', 'Dowód'],
    o.tabelaObszarow.map(([id, nazwa, a, t, d]) => [id, nazwa, `${a} / ${o.skala}`, `${t} / ${o.skala}`, t - a === 0 ? '—' : `+${t - a}`, d]),
    [7, 43, 12, 12, 10, 16], { alignCenter: [0, 2, 3, 4, 5] }));
  out.push(spacer(130));

  out.push(h3('Wnioski'));
  o.wnioski.forEach((w) => out.push(p(w, { size: 19 })));

  out.push(h3('Rekomendacje'));
  out.push(tbl(['Rekomendacja', 'Priorytet', 'Horyzont', 'Właściciel'], o.rekomendacje, [50, 13, 14, 23], { alignCenter: [1, 2] }));
  out.push(spacer(120));
  out.push(p([run('Sufit rekomendowany.  ', { size: 18, bold: true, color: C.dark }), run(o.sufit, { size: 18, color: C.sec })], { after: 120 }));

  out.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [Math.round(W * 0.34), Math.round(W * 0.16), Math.round(W * 0.15), Math.round(W * 0.35)],
    borders: { top: { style: BorderStyle.SINGLE, size: 8, color: C.text }, bottom: { style: BorderStyle.SINGLE, size: 8, color: C.text }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.SINGLE, size: 2, color: C.line } },
    layout: 'fixed',
    rows: [
      new TableRow({ children: ['Rekomendowany kierunek', 'Priorytet', 'Horyzont', 'Warunek powodzenia'].map((t) =>
        cell([p(t, { size: 15, bold: true, color: C.muted, caps: true, spacing: 40, after: 30, line: 220 })], { pad: 90, valign: VerticalAlign.TOP })) }),
      new TableRow({ children: o.liniaDecyzyjna.map((t) =>
        cell([p(t, { size: 19, bold: true, after: 0, line: 250 })], { pad: 90, valign: VerticalAlign.TOP })) }),
    ],
  }));
  return out;
}

// ---------- 4. Odpowiedzi i wnioski zbiorcze ----------
const posortowane = [...OSIE].sort((a, b) => b.procent - a.procent);
const zbiorcze = [
  kicker('Synteza'),
  h1('Odpowiedzi i wnioski zbiorcze'),
  p('Rozdział zestawia siedem osi w jednym obrazie, wskazuje najsilniejsze i najsłabsze obszary organizacji oraz formułuje wnioski, których nie widać w żadnej pojedynczej osi.'),
  h2('Macierz osi i poziomów'),
  tbl(['Oś', 'Nazwa', 'AS-IS', 'TO-BE', 'Skala', '% skali', 'Luka (p.p.)'],
    OSIE.map((o) => [String(o.nr), o.nazwa, fmt(o.asIs), fmt(o.toBe), `1–${o.skala}`, pct(o.procent), `+${(((o.toBe - o.asIs) / o.skala) * 100).toFixed(1).replace('.', ',')}`]),
    [7, 37, 11, 11, 10, 12, 12], { alignCenter: [0, 2, 3, 4], alignRight: [5, 6] }),
  spacer(90),
  p(`Wynik ogólny organizacji: ${pct(WYNIK_OGOLNY.procent)} skali (średnia z równą wagą osi). ${META.benchmark}. Wynik plasuje firmę powyżej średniej sektorowej, a rozrzut między osiami — od ${pct(posortowane[posortowane.length - 1].procent)} do ${pct(posortowane[0].procent)} — jest w tej ocenie ważniejszy niż sama średnia.`, { size: 19, color: C.sec }),
  h2('Najsilniejsze i najsłabsze osie'),
  tbl(['Pozycja', 'Oś', '% skali', 'Co to znaczy'], [
    ['1', `Oś ${posortowane[0].nr} — ${posortowane[0].nazwa}`, pct(posortowane[0].procent), 'Rdzeń wytwórczy pracuje na zintegrowanych systemach z potwierdzonym dowodem.'],
    ['2', `Oś ${posortowane[1].nr} — ${posortowane[1].nazwa}`, pct(posortowane[1].procent), 'Komponent ICT produktu jest mocny, brakuje kanału do klienta.'],
    ['3', `Oś ${posortowane[2].nr} — ${posortowane[2].nazwa}`, pct(posortowane[2].procent), 'Zarząd sponsoruje zmianę; brakuje zdolności wykonawczej.'],
    ['5', `Oś ${posortowane[4].nr} — ${posortowane[4].nazwa}`, pct(posortowane[4].procent), 'Zakres certyfikacji nie nadąża za dojrzałością produkcji — jedyne realne ryzyko.'],
    ['6', `Oś ${posortowane[5].nr} — ${posortowane[5].nazwa}`, pct(posortowane[5].procent), 'Brak jakiegokolwiek przychodu z modelu cyfrowego mimo istniejących danych.'],
    ['7', `Oś ${posortowane[6].nr} — ${posortowane[6].nazwa}`, pct(posortowane[6].procent), 'Najniższa oś badania; jeden obszar na poziomie 1 z 5.'],
  ], [10, 32, 12, 46], { alignCenter: [0, 2] }),
  spacer(60),
  p('Pozycja 4 (Oś 4 — Zarządzanie Danymi, 57,1% skali) pominięta w zestawieniu skrajnych; jej pełne omówienie znajduje się w rozdziale osi i we wnioskach W2 oraz W3.', { size: 16, color: C.muted, after: 120 }),
  h2('Wnioski przekrojowe'),
  ...WNIOSKI_PRZEKROJOWE.flatMap((w) => [
    p([run(`${w.id}.  `, { size: 21, bold: true, color: C.muted }), run(w.tytul, { size: 21, bold: true })], { before: 160, after: 60, keepNext: true }),
    p(w.tresc, { size: 20, color: C.sec, after: 40 }),
  ]),
];

// ---------- 5. Podsumowanie ----------
const podsumowanie = [
  kicker('Zamknięcie'),
  h1('Podsumowanie i mapa drogowa'),
  p('Mapa drogowa układa czternaście przedsięwzięć w trzy fale. Kolejność nie jest listą priorytetów do dowolnego wyboru — wynika z zależności między osiami opisanych w rozdziałach szczegółowych. Uruchomienie fali 3 przed odbiorem hurtowni danych z fali 2 powtórzy dzisiejszy stan pilotaży pracujących na plikach.'),
  ...MAPA_DROGOWA.flatMap((f) => [
    h2(`${f.fala}   ·   ${f.horyzont}`),
    p(f.opis, { size: 19, color: C.sec, after: 110 }),
    tbl(['#', 'Przedsięwzięcie', 'Oś', 'Priorytet', 'Wpływ', 'Nakład', 'Właściciel'], f.pozycje,
      [5, 39, 7, 13, 10, 10, 16], { alignCenter: [0, 2, 3, 4, 5] }),
    spacer(120),
  ]),
  h2('Kolejny krok'),
  p('Cztery decyzje w najbliższych dwunastu tygodniach przesądzają, czy ta ocena zmieni cokolwiek w organizacji. Wszystkie leżą po stronie zarządu i żadna nie wymaga wcześniejszego nakładu inwestycyjnego.'),
  tbl(['Termin', 'Decyzja lub działanie'], KOLEJNY_KROK, [24, 76]),
  spacer(160),
  h2('Granice wnioskowania'),
  ...GRANICE.map((g) => bullet(g, { size: 19, color: C.sec })),
];

// ---------- dokument ----------
const sekcjaTresc = (children) => ({
  properties: {
    page: { margin: { top: convertMillimetersToTwip(22), bottom: convertMillimetersToTwip(20), left: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20) } },
  },
  headers: { default: new Header({ children: [new Paragraph({
    tabStops: [{ type: 'right', position: W }],
    border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line, space: 6 } },
    spacing: { after: 220 },
    children: [run(`${META.tytul} · ${META.klient}`, { size: 15, color: C.muted }), run('\t', { size: 15 }),
      new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 15, color: C.muted })],
  })] }) },
  footers: { default: new Footer({ children: [new Paragraph({
    spacing: { before: 160 },
    children: [run(`Consultify · metodyka DRD · wersja dokumentu z ${META.dataRaportu} · dokument poufny`, { size: 14, color: C.muted })],
  })] }) },
  children,
});

const doc = new Document({
  creator: 'Consultify', title: `${META.tytul} — ${META.klient}`, description: 'Prototyp B1 — struktura raportu końcowego Oceny (DRD)',
  styles: { default: { document: { run: { font: FONT, size: 21, color: C.text } } } },
  sections: [
    { properties: { page: { margin: { top: convertMillimetersToTwip(24), bottom: convertMillimetersToTwip(20), left: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20) } } }, children: cover },
    sekcjaTresc(wstep),
    ...OSIE.map((o) => sekcjaTresc(rozdzialOsi(o))),
    sekcjaTresc(zbiorcze),
    sekcjaTresc(podsumowanie),
  ],
});

const out = path.resolve(process.argv[2] || 'docs/program/prototypy/RAPORT_OCENY_DRD_PROTOTYP_20260903.docx');
fs.mkdirSync(path.dirname(out), { recursive: true });
const buf = await Packer.toBuffer(doc);
fs.writeFileSync(out, buf);
console.log(`OK → ${out} (${(buf.length / 1024).toFixed(0)} kB)`);
