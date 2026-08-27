#!/usr/bin/env npx tsx
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import JSZip from 'jszip';

export type DrdDocxMetrics = Readonly<{
  file: string;
  totalWords: number;
  placeholderWords: number;
  placeholderRatio: number;
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

export function measureNarrativeSlots(text: string) {
  const count = (pattern: RegExp) => occurrences(text, pattern).length;
  const empty: Record<NarrativeSlotKind, number> = {
    wstep_rozdzialu: count(/Sekcja do uzupełnienia — limit 120–180 słów\./g),
    podpis_matrycy: count(/Sekcja do uzupełnienia — limit 30–60 słów\./g),
    komentarz_obszaru: count(/Sekcja do uzupełnienia — limit 110–170 słów; wymagane:/g),
    wnioski_rozdzialu: count(/Sekcja do uzupełnienia — limit 180–260 słów\./g),
    linia_decyzyjna_rozdzialu: 0,
    linia_decyzyjna_programu: 0,
    streszczenie: count(/Sekcja do uzupełnienia — limit 120–150 słów\./g),
    wnioski_koncowe: count(/Sekcja do uzupełnienia — limit 250–300 słów\./g),
  };
  const decisionEmpty = count(/Sekcja do uzupełnienia — limit 10–30 słów\./g);
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
  const placeholders = occurrences(text, /Sekcja do uzupełnienia — limit \d+–\d+ słów\./g);
  const narrativePlaceholders = occurrences(
    text,
    /Sekcja do uzupełnienia — limit \d+–\d+ słów(?:\.|; wymagane:[^.]*\.)/g
  );
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
    placeholderCount: placeholders.length,
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
