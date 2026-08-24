import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import process from 'node:process';

const root = process.cwd();
const manifestPath = `${root}/docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-visual-candidates.json`;
const bindingsPath = `${root}/docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json`;
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const bindings = JSON.parse(await readFile(bindingsPath, 'utf8'));

if (manifest.modules.length !== 16) {
  throw new Error(`Expected 16 visual candidates, received ${manifest.modules.length}`);
}

const ids = new Set();
const orders = new Set();
const counts = {};

for (const candidate of manifest.modules) {
  if (ids.has(candidate.id)) throw new Error(`Duplicate module id: ${candidate.id}`);
  if (orders.has(candidate.order)) throw new Error(`Duplicate module order: ${candidate.order}`);
  ids.add(candidate.id);
  orders.add(candidate.order);

  const bytes = await readFile(`${root}/${candidate.path}`);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== candidate.sha256) {
    throw new Error(`SHA-256 mismatch for ${candidate.id}: ${actual}`);
  }
  counts[candidate.classification] = (counts[candidate.classification] ?? 0) + 1;
}

const expectedOrder = Array.from({ length: 16 }, (_, index) => index + 1);
if (JSON.stringify([...orders].sort((a, b) => a - b)) !== JSON.stringify(expectedOrder)) {
  throw new Error('Module order must be exactly 1..16');
}

const visualIds = manifest.modules.map((module) => module.id);
const bindingIds = bindings.modules.map((module) => module.id);
if (JSON.stringify(visualIds) !== JSON.stringify(bindingIds)) {
  throw new Error('Visual module identities/order do not match canonical bindings');
}

console.log(JSON.stringify({ modules: manifest.modules.length, verifiedHashes: manifest.modules.length, classifications: counts }, null, 2));
