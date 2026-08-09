#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const gatePath = path.join(
  root,
  'docs/ui-standards/01-shell-layout/artifact-studio/program-gates.json',
);
const requireComplete = process.argv.includes('--require-complete');
const asJson = process.argv.includes('--json');

const fail = (message) => {
  process.stderr.write(`Artifact Studio gate error: ${message}\n`);
  process.exit(2);
};

if (!fs.existsSync(gatePath)) fail(`missing ${gatePath}`);

let program;
try {
  program = JSON.parse(fs.readFileSync(gatePath, 'utf8'));
} catch (error) {
  fail(`invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
}

const allowedStatuses = new Set(['pending', 'partial', 'verified', 'blocked']);
const requiredKinds = new Set(program.requiredEvidenceKinds ?? []);
const gates = Array.isArray(program.gates) ? program.gates : [];
const byId = new Map();

for (const gate of gates) {
  if (!gate?.id || typeof gate.id !== 'string') fail('every gate requires a string id');
  if (byId.has(gate.id)) fail(`duplicate gate id ${gate.id}`);
  if (!allowedStatuses.has(gate.status)) fail(`invalid status ${gate.status} for ${gate.id}`);
  if (!Array.isArray(gate.dependsOn) || !Array.isArray(gate.checks)) {
    fail(`${gate.id} requires dependsOn and checks arrays`);
  }
  for (const check of gate.checks) {
    if (!requiredKinds.has(check)) fail(`${gate.id} references unknown evidence kind ${check}`);
  }
  byId.set(gate.id, gate);
}

if (!byId.has(program.terminalGate)) fail(`terminal gate ${program.terminalGate} does not exist`);

for (const gate of gates) {
  for (const dependency of gate.dependsOn) {
    if (!byId.has(dependency)) fail(`${gate.id} depends on unknown gate ${dependency}`);
  }
  if (gate.status === 'verified') {
    if ((gate.missing ?? []).length > 0) fail(`${gate.id} is verified but still has missing evidence`);
  }
}

const terminal = byId.get(program.terminalGate);
if (terminal.status === 'verified') {
  const incompleteGate = gates.find((gate) => gate.status !== 'verified');
  if (incompleteGate) {
    fail(`terminal gate is verified while ${incompleteGate.id} is ${incompleteGate.status}`);
  }
}

const summary = Object.fromEntries(
  ['verified', 'partial', 'pending', 'blocked'].map((status) => [
    status,
    gates.filter((gate) => gate.status === status).map((gate) => gate.id),
  ]),
);
const result = {
  program: program.program,
  version: program.version,
  terminalGate: program.terminalGate,
  terminalStatus: terminal.status,
  complete: terminal.status === 'verified',
  summary,
};

process.stdout.write(`${asJson ? JSON.stringify(result, null, 2) : [
  `${program.program} v${program.version}`,
  `verified: ${summary.verified.join(', ') || 'none'}`,
  `partial: ${summary.partial.join(', ') || 'none'}`,
  `pending: ${summary.pending.join(', ') || 'none'}`,
  `blocked: ${summary.blocked.join(', ') || 'none'}`,
  `terminal ${program.terminalGate}: ${terminal.status}`,
].join('\n')}\n`);

if (requireComplete && terminal.status !== 'verified') process.exit(1);
