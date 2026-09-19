#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

import {
  buildGroups,
  classifyResult,
  flagDiff,
  flagProfile,
  localeOf,
  worstClass,
} from './classify.mjs';
import {
  SURFACE_KINDS,
  buildVariants,
  matrixContract,
  parseVariant,
  variantKey,
} from './contract.mjs';
import { validateVariantResult } from './evidence.mjs';

const root = path.resolve(process.argv[2] || 'test-results/e2e-1-matrix');
const out = path.resolve(process.argv[3] || path.join(root, 'aggregate'));

function findResults(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return findResults(target);
    return entry.name === 'result.json' ? [target] : [];
  });
}

function safeVariant(key) {
  try {
    return parseVariant(key);
  } catch {
    return null;
  }
}

/** Flags belong to the principal (org), never to the presentation: locale and
 *  theme must not move them. Only a difference INSIDE one principal is ENV. */
function principalOf(key) {
  const variant = safeVariant(key);
  return variant ? `${variant.actor}/${variant.org}` : String(key || 'unknown');
}

const results = findResults(root).map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
const byVariant = new Map(results.map((result) => [result.variant, result]));
const variants = buildVariants();
const missingVariants = variants.map(variantKey).filter((key) => !byVariant.has(key));
const regressions = results.flatMap((result) => result.delta?.regressions || []);
const unexpectedWrites = results.flatMap((result) => result.cleanup?.mutatingRequests || []);
const contract = matrixContract();
const contractErrors = results.flatMap((result) => {
  try {
    return validateVariantResult(result, parseVariant(result.variant)).map(
      (error) => `${result.variant}: ${error}`
    );
  } catch (error) {
    return [`${result.variant || 'UNKNOWN'}: ${String(error)}`];
  }
});
if (results.length !== contract.variantCount) {
  contractErrors.push(`variant denominator ${results.length}/${contract.variantCount}`);
}
const observedModuleRuns = results.reduce((sum, result) => sum + (result.modules?.length || 0), 0);
if (observedModuleRuns !== contract.moduleRuns) {
  contractErrors.push(`module-run denominator ${observedModuleRuns}/${contract.moduleRuns}`);
}

// QD6 — the matrix must say WHICH of the two broke: the product or the harness.
// Cells are grouped only with variants that are genuinely comparable (same
// principal, same locale — so the free axis is the theme), and every non-PASS
// cell gets PRODUCT / CONTRACT / ENV with a reason.
const groups = buildGroups(results, (result) => localeOf(result.variant), (result) =>
  principalOf(result.variant)
);
const profilesByPrincipal = new Map();
for (const result of results) {
  const principal = principalOf(result.variant);
  const list = profilesByPrincipal.get(principal) || [];
  list.push({ variant: result.variant, profile: flagProfile(result), result });
  profilesByPrincipal.set(principal, list);
}
const flagMinoritives = new Set();
const flagIssues = [];
for (const [principal, entries] of profilesByPrincipal) {
  const distinct = new Set(entries.map((entry) => entry.profile));
  if (distinct.size < 2) continue;
  const tally = new Map();
  for (const entry of entries) tally.set(entry.profile, (tally.get(entry.profile) || 0) + 1);
  const majority = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
  const majorityEntry = entries.find((entry) => entry.profile === majority);
  const minorityEntry = entries.find((entry) => entry.profile !== majority);
  for (const entry of entries) if (entry.profile !== majority) flagMinoritives.add(entry.variant);
  const differing = flagDiff(majorityEntry.result, minorityEntry.result)
    .map((entry) => `${entry.flag} ${JSON.stringify(entry.a)}→${JSON.stringify(entry.b)}`)
    .join(', ');
  flagIssues.push(
    `${principal}: ${distinct.size} flag profiles (${[...distinct].join(', ')}) — minority ${
      minorityEntry.variant
    }; differing flags: ${differing || 'none'}`
  );
}

const classes = { PRODUCT: 0, CONTRACT: 0, ENV: 0 };
const nonPassing = [];
for (const result of results) {
  const classified = classifyResult(result, {
    locale: localeOf(result.variant),
    principal: principalOf(result.variant),
    groups,
    flagMinority: flagMinoritives.has(result.variant),
  });
  for (const klass of Object.keys(classes)) classes[klass] += classified.counts[klass];
  for (const cell of classified.cells) if (cell.status !== 'PASS') nonPassing.push(cell);
}
const worst = worstClass(classes);

// Surfaces that exist for one principal and not another are the ambiguous class
// (an authorization rule or a harness expectation). Named, never silently folded
// into a product defect.
const presence = new Map();
for (const cell of results.flatMap((result) => result.cells || [])) {
  const locale = localeOf(cell.variant);
  const key = `${locale}|${cell.module}|${cell.kind}`;
  const entry = presence.get(key) || { locale, module: cell.module, kind: cell.kind, byPrincipal: new Map() };
  const principal = principalOf(cell.variant);
  const seen = entry.byPrincipal.get(principal) || { rendered: 0, missing: 0 };
  if (cell.status === 'MISSING') seen.missing += 1;
  else seen.rendered += 1;
  entry.byPrincipal.set(principal, seen);
  presence.set(key, entry);
}
const principalOnlySurfaces = [...presence.values()]
  .map((entry) => ({
    ...entry,
    rendered: [...entry.byPrincipal.entries()].filter(([, seen]) => seen.rendered > 0),
    absent: [...entry.byPrincipal.entries()].filter(([, seen]) => seen.rendered === 0),
  }))
  .filter((entry) => entry.rendered.length && entry.absent.length);

const gateIssues =
  missingVariants.length ||
  regressions.length ||
  unexpectedWrites.length ||
  contractErrors.length;
const summary = {
  generatedAt: new Date().toISOString(),
  contract,
  observed: {
    variants: results.length,
    moduleRuns: observedModuleRuns,
    cells: results.reduce((sum, result) => sum + (result.cells?.length || 0), 0),
  },
  missingVariants,
  nonPassingCells: nonPassing.length,
  classes,
  worstClass: worst,
  flagProfiles: [...profilesByPrincipal.entries()].map(([principal, entries]) => ({
    principal,
    profiles: [...new Set(entries.map((entry) => entry.profile))],
    variants: entries.map((entry) => entry.variant),
  })),
  flagIssues,
  principalOnlySurfaces: principalOnlySurfaces.map((entry) => ({
    locale: entry.locale,
    module: entry.module,
    kind: entry.kind,
    renderedFor: entry.rendered.map(([principal]) => principal),
    absentFor: entry.absent.map(([principal]) => principal),
  })),
  regressions: regressions.length,
  unexpectedWrites,
  contractErrors,
  status: worst ? `FAIL_${worst}` : gateIssues ? 'FAIL' : 'PASS',
};
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2));

const counts = Object.fromEntries(
  SURFACE_KINDS.map((kind) => [
    kind,
    { PASS: 0, FAIL: 0, MISSING: 0, BLOCKED: 0, PRODUCT: 0, CONTRACT: 0, ENV: 0 },
  ])
);
for (const result of results) {
  for (const cell of result.cells || []) {
    counts[cell.kind][cell.status] += 1;
    if (cell.classification) counts[cell.kind][cell.classification.class] += 1;
  }
}
const lines = [
  '# E2E-1 krok 2 — matrix report',
  '',
  `- Result: **${summary.status}**`,
  `- Variants: ${results.length}/${contract.variantCount}`,
  `- Module runs: ${summary.observed.moduleRuns}/${contract.moduleRuns}`,
  `- Non-passing cells: ${nonPassing.length} (PRODUCT ${classes.PRODUCT} · CONTRACT ${classes.CONTRACT} · ENV ${classes.ENV})`,
  `- Regressions vs exact previous variants: ${regressions.length}`,
  `- Unexpected writes: ${unexpectedWrites.length}`,
  `- Contract errors: ${contractErrors.length}`,
  `- Flag issues: ${flagIssues.length}`,
  '',
  'PRODUCT = the app broke. CONTRACT = the harness expectation is stale (a surface',
  'this module does not have, a control that is not interactable and reported no',
  'app error). ENV = neither: a route that never settled, or a flag profile that',
  'moved between variants of the same principal.',
  '',
  '| Surface | PASS | FAIL | MISSING | BLOCKED | PRODUCT | CONTRACT | ENV |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...SURFACE_KINDS.map(
    (kind) =>
      `| ${kind} | ${counts[kind].PASS} | ${counts[kind].FAIL} | ${counts[kind].MISSING} | ${counts[kind].BLOCKED} | ${counts[kind].PRODUCT} | ${counts[kind].CONTRACT} | ${counts[kind].ENV} |`
  ),
  '',
  '## Flag profiles (captured, never toggled)',
  '',
  '| Principal | Profiles | Variants |',
  '| --- | --- | --- |',
  ...summary.flagProfiles.map(
    (entry) => `| ${entry.principal} | ${entry.profiles.join(', ')} | ${entry.variants.length} |`
  ),
  ...(flagIssues.length ? ['', ...flagIssues.map((issue) => `- ${issue}`)] : []),
  '',
  '## Surfaces present for one principal only (role/org axis — triage, not a verdict)',
  '',
  '| Locale | Module | Surface | Rendered for | Absent for |',
  '| --- | --- | --- | --- | --- |',
  ...(principalOnlySurfaces.length
    ? principalOnlySurfaces.map(
        (entry) =>
          `| ${entry.locale} | ${entry.module} | ${entry.kind} | ${entry.rendered
            .map(([principal]) => principal)
            .join(', ')} | ${entry.absent.map(([principal]) => principal).join(', ')} |`
      )
    : ['| — | — | — | — | — |']),
  '',
  '## Non-passing cells',
  '',
  '| Variant | Module | Surface | Control | Result | Class | Why |',
  '| --- | --- | --- | --- | --- | --- | --- |',
  ...nonPassing
    .slice(0, 500)
    .map(
      (cell) =>
        `| ${cell.variant} | ${cell.module} | ${cell.kind} | ${String(cell.control).replaceAll('|', '\\|')} | ${cell.status} | ${cell.classification?.class || '—'} | ${String(cell.classification?.reason || '—').replaceAll('|', '\\|')} |`
    ),
  '',
];
fs.writeFileSync(path.join(out, 'REPORT.md'), lines.join('\n'));
if (summary.status !== 'PASS') process.exitCode = 1;
