#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const MODULES = join(ROOT, 'docs/program/waves/WAVE_03_ACCEPTANCE/modules');
const gatePattern = /^\|\s*(G\d{2})\s*\|[^|]*\|\s*`?([^|`]+?)`?\s*\|/gm;
const closedStates = new Set(['PASS', 'NOT_APPLICABLE', 'OWNER_ACCEPTED']);

function classifyGate(state) {
  const normalized = state.trim().toUpperCase();

  if (closedStates.has(normalized)) return 'closed';

  // A literal unresolved condition remains open even when the same label also
  // mentions an owner or policy gate. This prevents BLOCKED/NOT_STARTED from
  // being hidden behind a softer category.
  if (
    /(^|\W)(NOT_STARTED|BLOCKED|FAILED|FAIL|REJECTED|MISSING|NOT_IMPLEMENTED|NOT_TESTED|EVIDENCE_MISSING)(\W|$)/.test(
      normalized
    )
  ) {
    return 'open';
  }

  // Owner judgement is deliberately separate from technical completeness.
  if (/OWNER_(PENDING|REVIEW|RETEST|GATE|DECISION|CONFIRMATION|ACCEPTANCE)|GUIDED_REPLAY/.test(normalized)) {
    return 'owner_gated';
  }

  // Policy/external authorization must never be silently promoted to pass.
  if (/POLICY|NOT_AUTHORIZED|AUTHORIZATION_REQUIRED|EXTERNAL_(DECISION|CONFIRMATION)/.test(normalized)) {
    return 'policy_gated';
  }

  // Preserve evidence of useful technical progress without calling the gate
  // terminal. Many historical packets use qualified PASS/VERIFIED/READY labels.
  if (/^PASS(?:_|\b)|TECHNICAL_BROWSER_PASS|(^|_)VERIFIED(?:_|$)|^READY(?:_|\b)/.test(normalized)) {
    return 'qualified_pass';
  }

  return 'open';
}

const files = readdirSync(MODULES, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => join(MODULES, entry.name, 'MODULE_ACCEPTANCE.md'))
  .sort();

const modules = files.map((file) => {
  const text = readFileSync(file, 'utf8');
  const gates = {};
  for (const match of text.matchAll(gatePattern)) {
    gates[match[1]] = match[2].trim();
  }

  const missing = [];
  const classified = {
    closed: [],
    qualified_pass: [],
    owner_gated: [],
    policy_gated: [],
    open: [],
  };
  for (let index = 0; index <= 20; index += 1) {
    const id = `G${String(index).padStart(2, '0')}`;
    if (!gates[id]) missing.push(id);
    else classified[classifyGate(gates[id])].push({ id, state: gates[id] });
  }

  return {
    module: basename(dirname(file)),
    file: file.slice(ROOT.length + 1),
    gates,
    missing,
    classified,
    fullyClosed:
      missing.length === 0 &&
      classified.qualified_pass.length === 0 &&
      classified.owner_gated.length === 0 &&
      classified.policy_gated.length === 0 &&
      classified.open.length === 0,
  };
});

const totals = modules.reduce(
  (summary, module) => {
    summary.gates += Object.keys(module.gates).length;
    summary.missing += module.missing.length;
    for (const category of Object.keys(module.classified)) {
      summary[category] += module.classified[category].length;
    }
    summary.unresolved +=
      module.classified.qualified_pass.length +
      module.classified.owner_gated.length +
      module.classified.policy_gated.length +
      module.classified.open.length;
    summary.fullyClosedModules += Number(module.fullyClosed);
    return summary;
  },
  {
    modules: modules.length,
    gates: 0,
    missing: 0,
    closed: 0,
    qualified_pass: 0,
    owner_gated: 0,
    policy_gated: 0,
    open: 0,
    unresolved: 0,
    fullyClosedModules: 0,
  }
);

const result = {
  generatedFrom: 'MODULE_ACCEPTANCE.md files in the current checkout',
  exactHead: process.env.ACCEPTANCE_PRODUCT_SHA || null,
  closedStates: [...closedStates],
  totals,
  modules: modules.map(({ module, file, missing, classified, fullyClosed }) => ({
    module,
    file,
    missing,
    classified,
    fullyClosed,
  })),
};

process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = totals.modules === 16 && totals.gates === 336 && totals.missing === 0 ? 0 : 1;
