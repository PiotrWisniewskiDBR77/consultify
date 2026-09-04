#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REQUIRED_G19_ROWS = 16;
export const VALIDITY_DAYS = 7;

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const defaultRoot = resolve(scriptDir, '../..');
const OPEN_STATES = /\b(?:NOT_PROVEN|NOT_STARTED|OWNER_RETEST_PENDING)\b/;

export function parseSnapshotDate(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.valueOf())) {
    throw new Error(`Nieprawidlowa data migawki: ${value}`);
  }
  return date;
}

export function classifyG19Line(line, snapshotDate, validityDays = VALIDITY_DAYS) {
  const cells = line.split('|');
  const state = (cells[3] || '').replaceAll('`', '').trim();
  const date = line.match(/\bdata=(\d{4}-\d{2}-\d{2})\b/)?.[1] ?? '';
  const sha = line.match(/\bsha=([0-9a-f]{10,40})\b/i)?.[1] ?? '';

  if (OPEN_STATES.test(state)) return { state, date, sha, verdict: 'NIE_DOTYCZY' };
  if (!date || !sha) return { state, date, sha, verdict: 'BRAK_DATY_POMIARU' };

  const measuredAt = parseSnapshotDate(date);
  const ageDays = Math.floor((snapshotDate.valueOf() - measuredAt.valueOf()) / 86_400_000);
  return { state, date, sha, verdict: ageDays > validityDays ? 'PASS_STALE' : 'WAZNY' };
}

export function collectG19Rows(root = defaultRoot, snapshotDate = new Date(), floor = REQUIRED_G19_ROWS) {
  const modulesRoot = resolve(root, 'docs/program/waves/WAVE_03_ACCEPTANCE/modules');
  const rows = [];
  for (const moduleName of readdirSync(modulesRoot).sort()) {
    const file = resolve(modulesRoot, moduleName, 'MODULE_ACCEPTANCE.md');
    let text;
    try { text = readFileSync(file, 'utf8'); } catch { continue; }
    const line = text.split('\n').find((candidate) => /^\| G19 +\|/.test(candidate));
    if (line) rows.push({ module: moduleName, ...classifyG19Line(line, snapshotDate) });
  }
  const blocking = rows.filter((row) => row.verdict === 'BRAK_DATY_POMIARU' || row.verdict === 'PASS_STALE');
  return { rows, blocking, floorMet: rows.length >= floor, exitCode: rows.length >= floor && blocking.length === 0 ? 0 : 1 };
}

export function renderResult(result) {
  const lines = ['modul | stan | data | SHA | orzeczenie', '--- | --- | --- | --- | ---'];
  for (const row of result.rows) lines.push(`${row.module} | ${row.state} | ${row.date || '-'} | ${row.sha || '-'} | ${row.verdict}`);
  lines.push(`Zbadanych wierszy G19: ${result.rows.length}`);
  lines.push(`Podloga ${REQUIRED_G19_ROWS}: ${result.floorMet ? 'OK' : 'BRAK'}`);
  lines.push(`Kod wyjscia: ${result.exitCode}`);
  return lines.join('\n');
}

export function run(argv = process.argv.slice(2), root = defaultRoot) {
  const index = argv.indexOf('--snapshot-date');
  const value = index >= 0 ? argv[index + 1] : new Date().toISOString().slice(0, 10);
  if (!value) throw new Error('Brak wartosci --snapshot-date');
  const result = collectG19Rows(root, parseSnapshotDate(value));
  console.log(renderResult(result));
  return result.exitCode;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = run(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
