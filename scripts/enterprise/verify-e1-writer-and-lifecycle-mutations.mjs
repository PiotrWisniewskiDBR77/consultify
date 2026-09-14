#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { verifyClassificationInventory } from './verify-organization-export-classification.mjs';

const [inventoryPath, exclusionsPath, lifecyclePath] = process.argv.slice(2);
if (!inventoryPath || !exclusionsPath || !lifecyclePath) {
  throw new Error('usage: verify-e1-writer-and-lifecycle-mutations.mjs <inventory> <exclusions> <lifecycle>');
}

const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf8'));
const exclusions = JSON.parse(fs.readFileSync(exclusionsPath, 'utf8'));
const lifecycle = JSON.parse(fs.readFileSync(lifecyclePath, 'utf8'));
const requiredColumnExclusions = new Map(
  exclusions.tables.map((row) => [`${row.schema}.${row.table}`, row.columns])
);
const requiredLifecycleStateExports = new Set(
  lifecycle.tables.map((row) => `${row.schema}.${row.table}`)
);
const options = {
  requiredColumnExclusions,
  requiredLifecycleStateExports,
  requireLifecycleStateCompleteness: true,
  validateSemanticEvidence: true,
};

const baseline = verifyClassificationInventory(inventory, options);
assert.deepEqual(baseline.errors, [], baseline.errors.join('\n'));

let red = 0;
for (const identity of requiredLifecycleStateExports) {
  const mutated = structuredClone(inventory);
  const row = mutated.tables.find((candidate) => `${candidate.schema}.${candidate.table}` === identity);
  assert(row, `missing lifecycle row ${identity}`);
  row.projection = row.projection.filter((column) => column !== 'state');
  row.excludedColumns.push('state');
  row.columnDecisions.find((decision) => decision.column === 'state').category =
    'EXCLUDE_SECURITY_COLUMN';
  const result = verifyClassificationInventory(mutated, options);
  assert.match(result.errors.join('\n'), /required business lifecycle export missing: state/);
  console.log(`RED_OK ${identity}.state lifecycle-export-removal`);
  red += 1;
}

{
  const mutated = structuredClone(inventory);
  const row = mutated.tables.find(
    (candidate) => `${candidate.schema}.${candidate.table}` === 'public.ownership_transfers'
  );
  assert(row, 'missing public.ownership_transfers');
  row.semanticEvidence[0].line = 440;
  const result = verifyClassificationInventory(mutated, options);
  assert.match(result.errors.join('\n'), /semanticEvidence is not an executable SQL or exact policy source/);
  console.log('RED_OK public.ownership_transfers stale-writer-line-440');
  red += 1;
}

{
  const publicPolicy = inventory.tables.find(
    (candidate) => `${candidate.schema}.${candidate.table}` === 'public.v8_feature_flags'
  );
  const v8Policy = inventory.tables.find(
    (candidate) => `${candidate.schema}.${candidate.table}` === 'v8.v8_feature_flags'
  );
  assert(publicPolicy && v8Policy, 'missing schema-collision policies');
  for (const [identity, semanticEvidence] of [
    ['v8.v8_feature_flags', publicPolicy.semanticEvidence],
    ['public.v8_feature_flags', v8Policy.semanticEvidence],
  ]) {
    const mutated = structuredClone(inventory);
    const row = mutated.tables.find((candidate) => `${candidate.schema}.${candidate.table}` === identity);
    row.semanticEvidence = structuredClone(semanticEvidence);
    const result = verifyClassificationInventory(mutated, options);
    assert.match(result.errors.join('\n'), /semanticEvidence is not an executable SQL or exact policy source/);
    console.log(`RED_OK ${identity} cross-schema-writer-evidence`);
    red += 1;
  }
}

console.log(`MUTATION_GREEN expected-red=${red} observed-red=${red}`);
