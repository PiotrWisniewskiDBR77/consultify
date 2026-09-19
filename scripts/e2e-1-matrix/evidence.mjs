import fs from 'node:fs';
import path from 'node:path';

import { classifyResult, flagProfile, localeOf } from './classify.mjs';
import { MODULES, SURFACE_KINDS, variantKey } from './contract.mjs';

function stableCellKey(cell) {
  return `${cell.variant}|${cell.module}|${cell.kind}|${cell.control || '__surface__'}`;
}

function normalizeStatus(value) {
  return ['PASS', 'FAIL', 'MISSING', 'BLOCKED'].includes(value) ? value : 'FAIL';
}

export function computeDelta(previous, current) {
  if (!previous?.cells || !Array.isArray(previous.cells)) {
    return { hasPrevious: false, regressions: [], fixes: [], unchanged: 0 };
  }
  const before = new Map(
    previous.cells.map((cell) => [stableCellKey(cell), normalizeStatus(cell.status)])
  );
  const after = new Map(
    current.cells.map((cell) => [stableCellKey(cell), normalizeStatus(cell.status)])
  );
  const regressions = [];
  const fixes = [];
  let unchanged = 0;

  for (const [key, status] of after) {
    const prior = before.get(key);
    if (prior === status) unchanged += 1;
    else if (status === 'PASS' && prior && prior !== 'PASS')
      fixes.push({ key, from: prior, to: status });
    else if (status !== 'PASS' && (prior === 'PASS' || prior === undefined)) {
      regressions.push({ key, from: prior || 'ABSENT', to: status });
    }
  }
  return { hasPrevious: true, regressions, fixes, unchanged };
}

export function validateVariantResult(result, expectedVariant) {
  const errors = [];
  if (result.variant !== variantKey(expectedVariant)) errors.push('variant key mismatch');
  const moduleIds = new Set((result.modules || []).map((module) => module.id));
  for (const module of MODULES) {
    if (!moduleIds.has(module.id)) errors.push(`missing module ${module.id}`);
    for (const kind of SURFACE_KINDS) {
      const present = (result.cells || []).some(
        (cell) => cell.module === module.id && cell.kind === kind
      );
      if (!present) errors.push(`missing denominator cell ${module.id}/${kind}`);
    }
  }
  if (moduleIds.size !== MODULES.length)
    errors.push(`module denominator ${moduleIds.size}/${MODULES.length}`);
  if (!result.cleanup?.verified) errors.push('cleanup/read-only proof not verified');
  if (result.cleanup?.mutatingRequests?.length) {
    errors.push(`unexpected mutation attempts ${result.cleanup.mutatingRequests.length}`);
  }
  if (!result.flags || typeof result.flags !== 'object')
    errors.push('staging flag snapshot missing');
  return errors;
}

export function summarize(result) {
  const statuses = { PASS: 0, FAIL: 0, MISSING: 0, BLOCKED: 0 };
  for (const cell of result.cells || []) statuses[normalizeStatus(cell.status)] += 1;
  return {
    modules: new Set((result.cells || []).map((cell) => cell.module)).size,
    cells: (result.cells || []).length,
    statuses,
    hardFailures: statuses.FAIL + statuses.MISSING + statuses.BLOCKED,
  };
}

// DEC-590 (Wpis 47): settle outcomes used to be thrown away by run.mjs. Reducing
// them here keeps the spinner/wait telemetry in the variant artifact so a run that
// scored cells against a stuck spinner is visible in the evidence.
export function summarizeSettle(settle) {
  const runs = Array.isArray(settle) ? settle : [];
  return {
    runs: runs.length,
    spinnerGone: runs.filter((item) => item.spinnerGone).length,
    stuckRoutes: runs.filter((item) => !item.spinnerGone).map((item) => item.route),
    maxElapsedMs: runs.reduce((max, item) => Math.max(max, item.elapsedMs || 0), 0),
  };
}

function esc(value) {
  return String(value ?? '—')
    .replaceAll('|', '\\|')
    .replaceAll('\n', ' ');
}

export function writeVariantArtifacts({ outDir, result, previous }) {
  fs.mkdirSync(outDir, { recursive: true });
  result.delta = computeDelta(previous, result);
  result.summary = summarize(result);
  const classified = classifyResult(result, { locale: localeOf(result.variant) });
  result.cells = classified.cells;
  result.classes = classified.counts;
  result.flagProfile = flagProfile(result);
  fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));

  const lines = [
    `# E2E-1 krok 2 — ${result.variant}`,
    '',
    `- Base: ${result.base}`,
    `- SHA: ${result.sha || 'UNKNOWN'}`,
    `- Flags snapshot: ${Object.keys(result.flags || {}).length}`,
    `- Modules: ${result.summary.modules}/${MODULES.length}`,
    `- Cells: ${result.summary.cells}`,
    `- PASS: ${result.summary.statuses.PASS}`,
    `- FAIL/MISSING/BLOCKED: ${result.summary.hardFailures}`,
    `- Classes: PRODUCT ${result.classes.PRODUCT} · CONTRACT ${result.classes.CONTRACT} · ENV ${result.classes.ENV}`,
    `- Flag profile: ${result.flagProfile}`,
    `- Writes observed: ${result.cleanup?.mutatingRequests?.length || 0}`,
    `- Cleanup verified: ${result.cleanup?.verified ? 'YES' : 'NO'}`,
    '',
    '## Diff vs previous run',
    '',
    result.delta.hasPrevious
      ? `Regressions: ${result.delta.regressions.length}; fixes: ${result.delta.fixes.length}; unchanged: ${result.delta.unchanged}.`
      : 'No previous artifact for this exact variant.',
    '',
    '| Module | Surface | Control | Result | Class | Why | Screenshot | Console / HTTP |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  for (const cell of result.cells || []) {
    const errors = [...(cell.consoleErrors || []), ...(cell.httpErrors || [])].join('; ') || '—';
    lines.push(
      `| ${esc(cell.module)} | ${esc(cell.kind)} | ${esc(cell.control)} | ${esc(cell.status)} | ${esc(
        cell.classification?.class
      )} | ${esc(cell.classification?.reason)} | ${esc(cell.screenshot)} | ${esc(errors)} |`
    );
  }
  lines.push('');
  lines.push('## Settle (spinner-aware wait)');
  lines.push('');
  lines.push('| Module | Settle runs | Spinner gone | Stuck routes | Max elapsed (ms) |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const module of result.modules || []) {
    const stats = summarizeSettle(module.settle);
    lines.push(
      `| ${esc(module.id)} | ${stats.runs} | ${stats.spinnerGone}/${stats.runs} | ${esc(
        stats.stuckRoutes.join(', ') || '—'
      )} | ${stats.maxElapsedMs} |`
    );
  }
  lines.push('');
  fs.writeFileSync(path.join(outDir, 'REPORT.md'), lines.join('\n'));
  return result;
}
