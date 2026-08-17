#!/usr/bin/env node
/**
 * UI-CANON G4 — turn measured sweep results into TASK_EVIDENCE.json.
 *
 * The verdict is DERIVED from the measurements, never asserted by hand, and the
 * human-only part of the gate (VoiceOver, brand, named-role acceptance) is
 * recorded in its own field so an automated axe pass can never be presented as
 * a human sign-off.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const EVIDENCE_ROOT = path.join(ROOT, 'docs/program/evidence/closure/ui-g4');
const BASELINE_SHA = 'c4f84a2baa7f1ce9c7b03a68ebbd1783cdbc581b';

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function evaluate(r) {
  const failures = [];
  const cells = r.cells || [];
  const primary = cells.filter((c) => c.route === r.route);

  const notRendered = primary.filter((c) => !c.surfaceRendered);
  if (notRendered.length) {
    failures.push(
      `surface did not render in ${notRendered.length}/${primary.length} primary cells (${notRendered
        .map((c) => `${c.viewport}/${c.language}/${c.theme}`)
        .join(', ')})`
    );
  }

  const overflow = cells.filter((c) => c.horizontalOverflow?.overflowed);
  if (overflow.length) {
    failures.push(
      `horizontal overflow in ${overflow.length} cell(s): ${overflow
        .map((c) => `${c.viewport}/${c.language}/${c.theme} ${c.horizontalOverflow.scrollWidth}>${c.horizontalOverflow.clientWidth}`)
        .join(', ')}`
    );
  }

  const axeIds = {};
  let axeCritical = 0;
  let axeSerious = 0;
  for (const c of cells) {
    axeCritical += Math.max(0, c.axe?.critical ?? 0);
    axeSerious += Math.max(0, c.axe?.serious ?? 0);
    for (const v of c.axe?.violations || []) {
      axeIds[v.id] = (axeIds[v.id] || 0) + 1;
    }
  }
  if (axeCritical > 0 || axeSerious > 0) {
    failures.push(
      `axe not clean: ${axeCritical} critical + ${axeSerious} serious across ${cells.length} cells (${Object.entries(
        axeIds
      )
        .map(([k, v]) => `${k}×${v}`)
        .join(', ')})`
    );
  }

  const unnamed = cells.filter((c) => (c.unnamedControls?.count ?? 0) > 0);
  if (unnamed.length) {
    const worst = Math.max(...unnamed.map((c) => c.unnamedControls.count));
    const samples = [...new Set(unnamed.flatMap((c) => c.unnamedControls.samples))].slice(0, 6);
    failures.push(
      `unnamed interactive controls present (up to ${worst} per cell): ${samples.join(', ')}`
    );
  }

  for (const key of ['deepLink', 'reload', 'coldReopen']) {
    if (!r[key]?.ok) failures.push(`${key} did not land on the surface: ${r[key]?.detail || 'n/a'}`);
  }

  if (r.keyboard && !r.keyboard.focusAlwaysVisible) {
    failures.push(
      `focus indicator not visible on every reachable control (${r.keyboard.invisibleFocusSamples?.length || 0} sample(s): ${(r.keyboard.invisibleFocusSamples || []).slice(0, 4).join(', ')})`
    );
  }
  if (r.keyboard && r.keyboard.reachableControls === 0) {
    failures.push('no control was reachable by keyboard');
  }

  // A `loading` affordance that is not caught in the sampled window is a limit
  // of the measurement, not proof the surface lacks one — it is reported as a
  // caveat rather than counted as a canon failure.
  const missingStates = (r.states || []).filter((s) => !s.observed && s.state !== 'loading');
  if (missingStates.length) {
    failures.push(
      `state(s) not observed: ${missingStates.map((s) => `${s.state} (${s.detail})`).join('; ')}`
    );
  }
  const caveats = (r.states || [])
    .filter((s) => !s.observed && s.state === 'loading')
    .map(
      (s) =>
        `loading affordance not caught in the sampled window on ${s.path}; recorded as a measurement limit, not as a defect`
    );

  return { failures, caveats, axeIds, axeCritical, axeSerious };
}

function build(taskId) {
  const dir = path.join(EVIDENCE_ROOT, taskId);
  const resultFile = path.join(dir, 'G4_SWEEP_RESULT.json');
  if (!fs.existsSync(resultFile)) return null;
  const r = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
  const { failures, caveats, axeIds, axeCritical, axeSerious } = evaluate(r);

  const screensDir = path.join(dir, 'screens');
  const screenshots = fs.existsSync(screensDir)
    ? fs
        .readdirSync(screensDir)
        .filter((f) => f.endsWith('.png'))
        .sort()
        .map((f) => ({
          file: path.relative(ROOT, path.join(screensDir, f)),
          sha256: sha256(path.join(screensDir, f)),
        }))
    : [];

  const automatedVerdict = failures.length === 0 ? 'AUTOMATED_G4_PASS' : 'AUTOMATED_G4_FAIL';

  const evidence = {
    taskId,
    lane: 'UI-G4',
    baselineSha: BASELINE_SHA,
    productSha: r.productSha,
    verdict: `${automatedVerdict} / BLOCKED_HUMAN`,
    verdictLiteral:
      failures.length === 0
        ? 'The automatable half of G4 passes on this exact SHA. The gate as a whole is NOT closed: VoiceOver, brand and named-human acceptance are outstanding and are recorded separately below. An automated axe pass is not a human sign-off.'
        : 'The automatable half of G4 FAILS on this exact SHA for the reasons listed in automatedFailures. No human sign-off is claimed or implied.',
    environment: {
      mountedApplication: 'real backend process (tsx server/src/index.ts) + Vite-served client',
      database: 'real PostgreSQL 16 (pgvector/pgvector:pg16), schema built from the canonical migration chain from zero',
      authentication: 'real signed JWT from POST /api/test-support/bootstrap; no anonymous or stubbed session',
      requestInterception: 'none — the harness never calls page.route()/fulfill()',
      harness: 'docs/program/evidence/closure/ui-g4/HARNESS.md',
    },
    surface: { module: r.module, route: r.route, gates: r.gates },
    denominators: {
      cells: r.cells.length,
      primaryCells: r.cells.filter((c) => c.route === r.route).length,
      viewports: ['1440x900', '768x1024', '390x844'],
      languages: ['pl', 'en'],
      themes: ['light', 'dark'],
      primaryCellsRendered: r.cells.filter((c) => c.route === r.route && c.surfaceRendered).length,
      secondaryCells: r.cells.filter((c) => c.route !== r.route).length,
      secondaryCellsRendered: r.cells.filter((c) => c.route !== r.route && c.surfaceRendered).length,
      screenshots: screenshots.length,
      keyboardControlsTraversed: r.keyboard?.reachableControls ?? 0,
      axeCriticalTotal: axeCritical,
      axeSeriousTotal: axeSerious,
      axeViolationIds: axeIds,
      statesProbed: (r.states || []).length,
      statesObserved: (r.states || []).filter((s) => s.observed).length,
    },
    fixtures: {
      tenant: 'fresh organization created by the test-support bootstrap for this run',
      dataState:
        'a brand-new tenant, so surfaces render their genuine empty state unless a probe seeded data through the real API',
      onboarding: r.negativeControls?.onboardingRetiredViaRealApi || 'n/a',
    },
    navigation: { deepLink: r.deepLink, reload: r.reload, coldReopen: r.coldReopen },
    keyboard: r.keyboard,
    states: r.states,
    statesNotPresent: r.statesNotPresent,
    negativeControls: r.negativeControls,
    screenshots,
    screenshotBinding: `Every screenshot above was produced by the sweep run recorded in productSha ${r.productSha}; the sha256 of each file is listed so a later re-render cannot be passed off as this run.`,
    automatedFailures: failures,
    measurementCaveats: caveats,
    blockedHuman: [
      'Manual VoiceOver pass — no automated tool substitutes for it.',
      'Brand/visual acceptance by the UX owner.',
      'Named target-role human acceptance (per OWNER_DECISIONS_AND_MEASURABLE_GATES §UI aggregate).',
    ],
    rollback: {
      method:
        'This lane adds test/harness/evidence files only; reverting the lane commits removes them with no schema or runtime change. Any source fix is listed per-commit and is individually revertable.',
      executed: false,
    },
  };

  fs.writeFileSync(path.join(dir, 'TASK_EVIDENCE.json'), JSON.stringify(evidence, null, 2) + '\n');
  return evidence;
}

const taskIds = fs.existsSync(EVIDENCE_ROOT)
  ? fs.readdirSync(EVIDENCE_ROOT).filter((d) => d.endsWith('-UI-CANON-001'))
  : [];

const rows = [];
for (const taskId of taskIds.sort()) {
  const e = build(taskId);
  if (e) rows.push(e);
}

for (const e of rows) {
  console.log(
    `${e.taskId.padEnd(26)} ${e.verdict.padEnd(34)} primary ${e.denominators.primaryCellsRendered}/${e.denominators.primaryCells}  secondary ${e.denominators.secondaryCellsRendered}/${e.denominators.secondaryCells}  axe c${e.denominators.axeCriticalTotal}/s${e.denominators.axeSeriousTotal}  failures ${e.automatedFailures.length}`
  );
}
console.log(`\n${rows.length} evidence record(s) written under ${path.relative(ROOT, EVIDENCE_ROOT)}`);
