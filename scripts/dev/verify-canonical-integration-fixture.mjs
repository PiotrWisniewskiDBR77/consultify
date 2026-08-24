#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixturePath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-integration-fixture.v1.json'
);
const bindingsPath = path.join(
  repoRoot,
  'docs/program/waves/WAVE_03_ACCEPTANCE/canonical-16-module-bindings.json'
);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const bindings = JSON.parse(fs.readFileSync(bindingsPath, 'utf8'));

assert.equal(fixture.schemaVersion, 1);
assert.equal(fixture.modules.length, 16, 'integration contract must cover 16 modules');
assert.equal(new Set(fixture.modules.map((module) => module.id)).size, 16, 'module IDs must be unique');
assert.deepEqual(
  new Set(fixture.modules.map((module) => module.id)),
  new Set(bindings.modules.map((module) => module.id)),
  'integration contract and canonical bindings must cover the same modules'
);
assert.equal(fixture.databasePolicy.databaseDumpImportAllowed, false);
assert.equal(fixture.databasePolicy.productionTargetAllowed, false);
assert.equal(fixture.freezeGate.buildAllowedBeforeFreeze, false);
assert.equal(fixture.freezeGate.requiredOwnerVerdicts, 16);

for (const module of fixture.modules) {
  assert.ok(fs.existsSync(path.join(repoRoot, module.builder)), `${module.id}: owned builder is absent`);
  assert.match(module.fixtureId, /^W3-[A-Z-]+-OWNER-v1$/);
  assert.equal(module.mode, 'ADAPT_OWNED_DEFINITION');
}

const objects = new Map(fixture.canonicalObjects.map((object) => [object.key, object]));
assert.equal(objects.size, fixture.canonicalObjects.length, 'canonical object keys must be unique');
assert.equal(
  new Set(fixture.canonicalObjects.map((object) => object.identity)).size,
  fixture.canonicalObjects.length,
  'canonical identities must be unique'
);
for (const edge of fixture.edges) {
  assert.ok(objects.has(edge.from), `${edge.from}: edge source is absent`);
  assert.ok(objects.has(edge.to), `${edge.to}: edge target is absent`);
}

const requiredContracts = [
  ['governed-proposal', 'initiative', 'HUMAN_DECISION_MATERIALIZES'],
  ['initiative', 'execution-case', 'PRESERVES_INITIATIVE_IDENTITY'],
  ['execution-case', 'results-kpi', 'IMMUTABLE_ACTUAL'],
  ['results-kpi', 'finance-model', 'REFERENCES_ACTUAL_NO_OVERWRITE'],
  ['finance-model', 'material', 'EXPORTS_VERSIONED_SNAPSHOT'],
];
for (const [from, to, contract] of requiredContracts) {
  assert.ok(
    fixture.edges.some((edge) => edge.from === from && edge.to === to && edge.contract === contract),
    `${from} -> ${to}: required ${contract} edge is absent`
  );
}

console.log(
  JSON.stringify(
    {
      ok: true,
      status: fixture.status,
      modules: fixture.modules.length,
      ownedBuildersPresent: fixture.modules.length,
      canonicalObjects: fixture.canonicalObjects.length,
      explicitEdges: fixture.edges.length,
      ownerVerdictsRequired: fixture.freezeGate.requiredOwnerVerdicts,
      buildAllowedBeforeFreeze: fixture.freezeGate.buildAllowedBeforeFreeze,
      productionTargetAllowed: fixture.databasePolicy.productionTargetAllowed
    },
    null,
    2
  )
);
