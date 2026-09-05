/**
 * D-01 (Piotr, OBR-28, 2026-07-27) guard.
 *
 * Owner decision, still active on HEAD: the universal "+ Nowy"/"+ New" 3-way
 * chooser (`UnifiedCreateLauncher`) was deliberately removed from both
 * My Work (commit 255366d01b) and Interview (commit 47f51800e9) hubs in
 * favour of ONE contextual per-tab CTA. Both commit messages cite the same
 * source: `_ODBIOR_TABELE_PREVIEW_2026-07-27.md §D-01`.
 *
 * 05.09.2026: decyzja potwierdzona na stronie 3100 — the component itself
 * (`src/components/shared/UnifiedCreateLauncher.tsx`) was confirmed dead
 * code (zero live callers anywhere in `src/`) and deleted, along with its
 * own test and the dev-render screen that mounted it. This guard now checks
 * the stronger invariant directly: the file must stay gone. It still also
 * checks both hubs, so if someone re-adds the file AND re-wires it into
 * either hub, both signals go red together — treat either as a signal to
 * re-read this history and confirm with the owner before undoing it, not as
 * a bug to silently patch around.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const removedComponentPath = path.resolve(__dirname, '../UnifiedCreateLauncher.tsx');

const interviewHubSource = fs.readFileSync(
  path.resolve(__dirname, '../../Interview/InterviewHub.tsx'),
  'utf8'
);
const myWorkHubSource = fs.readFileSync(
  path.resolve(__dirname, '../../MyWork/MyWorkHub.tsx'),
  'utf8'
);

describe('D-01 — universal "+ Nowy" launcher stays out of Interview/My Work Menu 2', () => {
  it('confirms the dead UnifiedCreateLauncher component file was removed (05.09.2026)', () => {
    expect(fs.existsSync(removedComponentPath)).toBe(false);
  });

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
