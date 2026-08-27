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
  notAssessedCount: number;
  clientMissingCount: number;
  bytes: number;
}>;

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
  const notAssessed = occurrences(text, /Oś nie została oceniona\./g);
  const clientMissing = occurrences(text, /\[Nazwa klienta do uzupełnienia\]/g);
  const placeholderWords = [...placeholders, ...notAssessed, ...clientMissing].reduce(
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
