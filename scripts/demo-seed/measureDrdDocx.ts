#!/usr/bin/env npx tsx
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import JSZip from 'jszip';

export type DrdDocxMetrics = Readonly<{
  file: string;
  totalWords: number;
  placeholderWords: number;
  placeholderRatio: number;
  /**
   * FIX-4 (nadzorca 2026-08-28): kept for backward compatibility with
   * existing callers, but no longer independently computed — it is always
   * exactly `emptySlotCount`. Previously a second, narrower regex counted
   * a DIFFERENT number here (56 vs. the real 95 empty-slot denominator on
   * the Metalpol demo document) and the two numbers silently drifted.
   */
  placeholderCount: number;
  narrativeSlotCount: number;
  filledSlotCount: number;
  emptySlotCount: number;
  slots: Readonly<
    Record<NarrativeSlotKind, Readonly<{ total: number; filled: number; empty: number }>>
  >;
  notAssessedCount: number;
  clientMissingCount: number;
  bytes: number;
}>;

export type NarrativeSlotKind =
  | 'wstep_rozdzialu'
  | 'podpis_matrycy'
  | 'komentarz_obszaru'
  | 'wnioski_rozdzialu'
  | 'linia_decyzyjna_rozdzialu'
  | 'linia_decyzyjna_programu'
  | 'streszczenie'
  | 'wnioski_koncowe';

const SLOT_TOTALS: Readonly<Record<NarrativeSlotKind, number>> = Object.freeze({
  wstep_rozdzialu: 7,
  podpis_matrycy: 7,
  komentarz_obszaru: 39,
  wnioski_rozdzialu: 7,
  linia_decyzyjna_rozdzialu: 28,
  linia_decyzyjna_programu: 4,
  streszczenie: 2,
  wnioski_koncowe: 1,
});

// FIX-3 (nadzorca 2026-08-28) replaced the raw editorial placeholder with
// honest sentences in exactly two places — the area comment and the
// "Horyzont" decision-line cell (see assessmentDrdReportSchemaService.ts).
// The patterns below recognise BOTH the pre-FIX-3 raw placeholder (for any
// already-generated .docx still on disk) and the new honest text, so this
// measurement tool keeps counting the same real slots instead of silently
// reporting them as "filled" once the raw jargon disappeared.
//
// AREA_NOT_ASSESSED_TEXT is a special case: assessmentDrdReportSchemaService
// prints the identical sentence TWICE for a not-assessed area with no skip
// notice — once as the area's own "not assessed" notice paragraph, once
// again as the area-comment fallback (areaCommentPlaceholder). Both prints
// are real, load-bearing text in the rendered document (real duplicated
// words), so word-counting (narrativePlaceholders below) counts every
// occurrence; but as a SLOT count there is only one comment slot per area,
// so komentarz_obszaru halves this specific count.
const AREA_COMMENT_LEGACY_PLACEHOLDER =
  /Sekcja do uzupełnienia — limit 110–170 słów; wymagane:[^.]*\./g;
const AREA_NOT_ASSESSED_TEXT = /Obszaru \S+ nie oceniono — brak danych źródłowych\./g;
const AREA_COMMENT_NOT_PREPARED_TEXT = /Komentarz obszaru \S+ nie został przygotowany\./g;
const DECISION_LEGACY_PLACEHOLDER = /Sekcja do uzupełnienia — limit 10–30 słów\./g;
// `\s` (not a literal space) between "w" and "danych": the docx renderer
// inserts a non-breaking space after one-letter Polish prepositions, and
// JS `\s` matches U+00A0 — a literal space here would silently never match
// the real rendered document.
const HORIZON_HONEST_TEXT = /Nie określono — brak źródła w\s+danych\./g;

export function measureNarrativeSlots(text: string) {
  const count = (pattern: RegExp) => occurrences(text, pattern).length;
  const empty: Record<NarrativeSlotKind, number> = {
    wstep_rozdzialu: count(/Sekcja do uzupełnienia — limit 120–180 słów\./g),
    podpis_matrycy: count(/Sekcja do uzupełnienia — limit 30–60 słów\./g),
    komentarz_obszaru:
      count(AREA_COMMENT_LEGACY_PLACEHOLDER) +
      count(AREA_COMMENT_NOT_PREPARED_TEXT) +
      Math.floor(count(AREA_NOT_ASSESSED_TEXT) / 2),
    wnioski_rozdzialu: count(/Sekcja do uzupełnienia — limit 180–260 słów\./g),
    linia_decyzyjna_rozdzialu: 0,
    linia_decyzyjna_programu: 0,
    streszczenie: count(/Sekcja do uzupełnienia — limit 120–150 słów\./g),
    wnioski_koncowe: count(/Sekcja do uzupełnienia — limit 250–300 słów\./g),
  };
  const decisionEmpty = count(DECISION_LEGACY_PLACEHOLDER) + count(HORIZON_HONEST_TEXT);
  empty.linia_decyzyjna_rozdzialu = Math.min(SLOT_TOTALS.linia_decyzyjna_rozdzialu, decisionEmpty);
  empty.linia_decyzyjna_programu = Math.max(0, decisionEmpty - empty.linia_decyzyjna_rozdzialu);
  const slots = Object.fromEntries(
    (Object.keys(SLOT_TOTALS) as NarrativeSlotKind[]).map((kind) => [
      kind,
      { total: SLOT_TOTALS[kind], empty: empty[kind], filled: SLOT_TOTALS[kind] - empty[kind] },
    ])
  ) as Record<NarrativeSlotKind, { total: number; empty: number; filled: number }>;
  return slots;
}

function decodeXml(value: string): string {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

function words(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function occurrences(value: string, pattern: RegExp): string[] {
  return [...value.matchAll(pattern)].map((match) => match[0]);
}

export async function measureDrdDocx(file: string): Promise<DrdDocxMetrics> {
  const buffer = await fs.readFile(file);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) throw new Error(`brak word/document.xml: ${file}`);
  const text = [...documentXml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join(' ');
  // FIX-4 (nadzorca 2026-08-28): this used to be TWO independently-drifting
  // counts of "how many placeholders are in this document" — a narrow
  // `placeholders` regex (period-ending only, blind to the area-comment
  // semicolon variant, reporting 56 where the real count was 95) feeding
  // `placeholderCount`, and a separate, wider `narrativePlaceholders` regex
  // feeding `placeholderWords`. `placeholderCount` is now the SAME number
  // as `emptySlotCount` below (the slot-based measurement, corrected for
  // FIX-3's honest-sentence text) — one source of truth, not a third
  // circulating number. `narrativePlaceholders` (word-counting, every raw
  // occurrence — including the FIX-3 area-comment duplicate — counts once
  // per literal print, unlike the slot count above) keeps its own broader
  // pattern set since it answers a different question (how many WORDS of
  // this document are placeholder text, not how many SLOTS are empty).
  const narrativePlaceholders = [
    ...occurrences(text, /Sekcja do uzupełnienia — limit \d+–\d+ słów(?:\.|; wymagane:[^.]*\.)/g),
    ...occurrences(text, AREA_NOT_ASSESSED_TEXT),
    ...occurrences(text, AREA_COMMENT_NOT_PREPARED_TEXT),
    ...occurrences(text, HORIZON_HONEST_TEXT),
  ];
  const slots = measureNarrativeSlots(text);
  const narrativeSlotCount = Object.values(slots).reduce((sum, slot) => sum + slot.total, 0);
  const emptySlotCount = Object.values(slots).reduce((sum, slot) => sum + slot.empty, 0);
  const notAssessed = occurrences(text, /Oś nie została oceniona\./g);
  const clientMissing = occurrences(text, /\[Nazwa klienta do uzupełnienia\]/g);
  const placeholderWords = [...narrativePlaceholders, ...notAssessed, ...clientMissing].reduce(
    (sum, value) => sum + words(value),
    0
  );
  const totalWords = words(text);
  return {
    file,
    totalWords,
    placeholderWords,
    placeholderRatio: placeholderWords / totalWords,
    placeholderCount: emptySlotCount,
    narrativeSlotCount,
    filledSlotCount: narrativeSlotCount - emptySlotCount,
    emptySlotCount,
    slots,
    notAssessedCount: notAssessed.length,
    clientMissingCount: clientMissing.length,
    bytes: buffer.length,
  };
}

async function main(): Promise<void> {
  if (process.argv.length < 3) throw new Error('użycie: measureDrdDocx.ts <docx> [docx...]');
  for (const file of process.argv.slice(2)) {
    const metrics = await measureDrdDocx(file);
    console.log(JSON.stringify(metrics));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main();
