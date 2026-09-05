/**
 * D-01 (Piotr, OBR-28, 2026-07-27) guard.
 *
 * Owner decision, still active on HEAD: the universal "+ Nowy"/"+ New" 3-way
 * chooser (`UnifiedCreateLauncher`) was deliberately removed from both
 * My Work (commit 255366d01b) and Interview (commit 47f51800e9) hubs in
 * favour of ONE contextual per-tab CTA. Both commit messages cite the same
 * source: `_ODBIOR_TABELE_PREVIEW_2026-07-27.md §D-01`.
 *
 * This test exists so nobody re-adds the import "to fix the unreachable
 * component" without noticing the decision — treat a red result here as a
 * signal to re-read the D-01 comment in the target file and confirm with the
 * owner before wiring it back in, not as a bug to silently patch around.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const interviewHubSource = fs.readFileSync(
  path.resolve(__dirname, '../../Interview/InterviewHub.tsx'),
  'utf8'
);
const myWorkHubSource = fs.readFileSync(
  path.resolve(__dirname, '../../MyWork/MyWorkHub.tsx'),
  'utf8'
);

describe('D-01 — universal "+ Nowy" launcher stays out of Interview/My Work Menu 2', () => {
  it('keeps InterviewHub free of UnifiedCreateLauncher and documents why', () => {
    expect(interviewHubSource).not.toMatch(/<UnifiedCreateLauncher/);
    expect(interviewHubSource).not.toMatch(/import\s+.*UnifiedCreateLauncher/);
    expect(interviewHubSource).toContain('D-01 (Piotr, OBR-28 2026-07-27)');
  });

  it('keeps MyWorkHub free of UnifiedCreateLauncher and documents why', () => {
    expect(myWorkHubSource).not.toMatch(/<UnifiedCreateLauncher/);
    expect(myWorkHubSource).not.toMatch(/import\s+.*UnifiedCreateLauncher/);
    expect(myWorkHubSource).toContain('D-01 (Piotr, OBR-28 2026-07-27)');
  });
});
