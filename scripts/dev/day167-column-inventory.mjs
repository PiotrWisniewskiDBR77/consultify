#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migrationsDir = resolve(process.argv[2] || 'server/migrations');
const files = readdirSync(migrationsDir)
  .filter((name) => name.endsWith('.sql'))
  .sort();

const normalizeIdentifier = (value) => value.replaceAll('"', '').toLowerCase().split('.').at(-1);
const tablePattern = '((?:"?[a-zA-Z_][\\w$]*"?\\.)?"?[a-zA-Z_][\\w$]*"?)';
const columnPattern = '("?[a-zA-Z_][\\w$]*"?)';

function statementSpans(sql) {
  const spans = [];
  let start = 0;
  for (let index = 0; index < sql.length; index += 1) {
    if (sql[index] === ';') {
      spans.push({ start, end: index + 1, text: sql.slice(start, index + 1) });
      start = index + 1;
    }
  }
  if (start < sql.length) spans.push({ start, end: sql.length, text: sql.slice(start) });
  return spans;
}

function producersForFile(file, sql, mode) {
  const producers = [];
  const occurrences = [...sql.matchAll(/\bADD\s+COLUMN\b/gi)];
  const recognizedOffsets = new Set();

  for (const span of statementSpans(sql)) {
    const alter = new RegExp(`\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${tablePattern}`, 'i').exec(
      span.text
    );
    if (!alter) continue;

    const table = normalizeIdentifier(alter[1]);
    const additions = [
      ...span.text.matchAll(
        new RegExp(`\\bADD\\s+COLUMN\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?${columnPattern}`, 'gi')
      ),
    ];
    const selected = mode === 'legacy-first-only' ? additions.slice(0, 1) : additions;
    for (const addition of selected) {
      const offset = span.start + (addition.index || 0);
      recognizedOffsets.add(offset);
      producers.push({
        table,
        column: normalizeIdentifier(addition[1]),
        file,
        line: sql.slice(0, offset).split('\n').length,
      });
    }
  }

  return {
    producers,
    totalAddColumn: occurrences.length,
    producerNotParsed: occurrences.length - recognizedOffsets.size,
  };
}

function consumersForFile(file, sql) {
  const consumers = [];
  const patterns = [
    new RegExp(
      `\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?${tablePattern}[\\s\\S]*?\\bALTER\\s+COLUMN\\s+${columnPattern}`,
      'gi'
    ),
    new RegExp(`\\bUPDATE\\s+${tablePattern}\\s+SET\\s+${columnPattern}`, 'gi'),
  ];
  for (const pattern of patterns) {
    for (const match of sql.matchAll(pattern)) {
      consumers.push({
        table: normalizeIdentifier(match[1]),
        column: normalizeIdentifier(match[2]),
        file,
        line: sql.slice(0, match.index || 0).split('\n').length,
      });
    }
  }
  return consumers;
}

function inventory(mode, corpus) {
  const producers = [];
  const consumers = [];
  let totalAddColumn = 0;
  let producerNotParsed = 0;

  for (const { file, sql } of corpus) {
    const result = producersForFile(file, sql, mode);
    producers.push(...result.producers);
    consumers.push(...consumersForFile(file, sql));
    totalAddColumn += result.totalAddColumn;
    producerNotParsed += result.producerNotParsed;
  }

  const firstProducer = new Map();
  for (const producer of producers) {
    const key = `${producer.table}.${producer.column}`;
    if (!firstProducer.has(key)) firstProducer.set(key, producer);
  }
  const inversionCandidates = consumers
    .filter((consumer) => {
      const producer = firstProducer.get(`${consumer.table}.${consumer.column}`);
      if (!producer) return false;
      const fileOrder = consumer.file.localeCompare(producer.file);
      return fileOrder < 0 || (fileOrder === 0 && consumer.line < producer.line);
    })
    .map(({ table, column, file, line }) => ({ table, column, file, line }));

  return {
    mode,
    totalAddColumn,
    recognizedProducers: producers.length,
    producerNotParsed,
    producers,
    inversionCandidates,
  };
}

const corpus = files.map((file) => ({
  file,
  sql: readFileSync(resolve(migrationsDir, file), 'utf8'),
}));
const before = inventory('legacy-first-only', corpus);
const after = inventory('all-add-column-clauses', corpus);
const target = after.producers.find(
  ({ file, table, column }) =>
    file === '20261039_settings_mfa_challenges.sql' &&
    table.endsWith('trusted_devices') &&
    column === 'credential_hash'
);

const compact = ({
  mode,
  totalAddColumn,
  recognizedProducers,
  producerNotParsed,
  inversionCandidates,
}) => ({
  mode,
  totalAddColumn,
  recognizedProducers,
  producerNotParsed,
  inversionCandidateCount: inversionCandidates.length,
  inversionCandidates,
});

console.log(
  JSON.stringify(
    {
      migrationsDir,
      sqlFileCount: files.length,
      before: compact(before),
      after: compact(after),
      inversionCandidatesChanged:
        JSON.stringify(before.inversionCandidates) !== JSON.stringify(after.inversionCandidates),
      credentialHash: target || 'PRODUCER_NOT_PARSED',
    },
    null,
    2
  )
);
