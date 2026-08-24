#!/usr/bin/env node
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const acceptanceRoot = path.join(repoRoot, 'docs/program/waves/WAVE_03_ACCEPTANCE');
const bindingsPath = path.join(acceptanceRoot, 'canonical-16-module-bindings.json');
const journalPath = path.join(acceptanceRoot, 'canonical-16-module-owner-observations.json');
const evidenceRoot = path.join(acceptanceRoot, 'evidence/canonical-owner-freeze-2026-08-24');
const allowedCategories = new Set([
  'VISUAL_DESIGN',
  'LAYOUT',
  'DATA_VISUALIZATION',
  'INFORMATION_ARCHITECTURE',
  'INTERACTION',
  'CUSTOMER_JOURNEY',
  'COPY_AND_LANGUAGE',
  'FEEDBACK_AND_STATUS',
  'PRODUCT_GAP',
  'ACCESSIBILITY',
]);

function fail(message) {
  throw new Error(`[canonical owner observation] BLOCKED: ${message}`);
}

function option(name) {
  const at = process.argv.indexOf(name);
  return at === -1 ? '' : String(process.argv[at + 1] || '').trim();
}

function atomicJsonWrite(target, value) {
  const temporary = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
  fs.renameSync(temporary, target);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

const moduleId = option('--module');
const quoteFileArg = option('--quote-file');
const screenshotArg = option('--screenshot');
const route = option('--route');
const category = option('--category').toUpperCase();

if (!moduleId || !quoteFileArg || !route || !category) {
  fail('required: --module ID --quote-file PATH --route ROUTE --category CATEGORY [--screenshot PATH]');
}
if (!route.startsWith('/')) fail('route must be an absolute application path');
if (!allowedCategories.has(category)) fail(`unsupported category ${category}`);

const bindings = JSON.parse(fs.readFileSync(bindingsPath, 'utf8'));
if (!bindings.modules.some((entry) => entry.id === moduleId)) fail(`unknown module ${moduleId}`);

const quoteSource = path.resolve(quoteFileArg);
if (!fs.existsSync(quoteSource) || !fs.statSync(quoteSource).isFile()) fail('quote file does not exist');
const quote = fs.readFileSync(quoteSource, 'utf8').trim();
if (!quote) fail('owner quote is empty');
let screenshotSource = '';
if (screenshotArg) {
  screenshotSource = path.resolve(screenshotArg);
  if (!fs.existsSync(screenshotSource) || !fs.statSync(screenshotSource).isFile()) {
    fail('screenshot does not exist');
  }
}

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const moduleSequence = journal.records.filter((record) => record.module === moduleId).length + 1;
const observationId = `${moduleId.toUpperCase().replaceAll('-', '_')}-FREEZE-${String(moduleSequence).padStart(3, '0')}`;
const recordDirectory = path.join(evidenceRoot, moduleId, observationId);
if (fs.existsSync(recordDirectory)) fail(`${observationId}: durable evidence directory already exists`);
fs.mkdirSync(recordDirectory, { recursive: false });

const durableQuote = path.join(recordDirectory, 'OWNER_QUOTE.txt');
fs.writeFileSync(durableQuote, `${quote}\n`, { flag: 'wx' });
const evidence = [];
if (screenshotSource) {
  const extension = path.extname(screenshotSource).toLowerCase() || '.bin';
  const durableScreenshot = path.join(recordDirectory, `SCREENSHOT${extension}`);
  fs.copyFileSync(screenshotSource, durableScreenshot, fs.constants.COPYFILE_EXCL);
  const bytes = fs.readFileSync(durableScreenshot);
  evidence.push({
    path: path.relative(repoRoot, durableScreenshot),
    sha256: sha256(bytes),
    bytes: bytes.length,
  });
}

const record = {
  sequence: journal.records.length + 1,
  observationId,
  module: moduleId,
  route,
  category,
  quoteFile: path.relative(repoRoot, durableQuote),
  quoteSha256: sha256(fs.readFileSync(durableQuote)),
  evidence,
  capturedAt: new Date().toISOString(),
  disposition: 'CAPTURED_UNRECONCILED',
  ownerVerdictEffect: 'NONE_UNTIL_EXPLICIT_VERDICT',
};
journal.records.push(record);
atomicJsonWrite(journalPath, journal);
console.log(JSON.stringify({ recorded: record, total: journal.records.length }, null, 2));
