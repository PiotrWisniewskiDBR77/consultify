/**
 * Contract: the FE convert-target SSOT must never offer a `live` target the server rejects.
 *
 * Guards the P1 unification (docs/product/IDEA_WORKSPACE_UNIFICATION_ACTIVATION.md §1.1):
 * before this, the FE menu surfaced `action_plan`/`raid_log`, which the server answers with a
 * raw 400 — a CANON §4 dead path. This test fails the build if FE-live drifts above the server
 * allowlist (the actual coupling we care about), and sanity-checks the registry shape.
 */
import { describe, expect, it } from 'vitest';

import {
  IDEA_CONVERT_TARGETS,
  LIVE_CONVERT_TARGETS,
  isLiveConvertTarget,
} from '../../src/components/MyWork/ideaConvertTargets';

// Mirror of server/src/routes/my-work.routes.ts `LIVE_CONVERT_TARGETS`.
// If you add a server handler, add the id here AND flip its registry entry to `status: 'live'`.
const SERVER_ALLOWLIST = [
  'initiative',
  'task_set',
  'decision',
  'team_chat',
  'report',
  'presentation',
] as const;

describe('idea convert-target SSOT contract', () => {
  it('every FE `live` target has a server handler (FE-live ⊆ server allowlist)', () => {
    const serverSet = new Set<string>(SERVER_ALLOWLIST);
    const offenders = LIVE_CONVERT_TARGETS.filter((t) => !serverSet.has(t));
    expect(offenders).toEqual([]);
  });

  it('LIVE_CONVERT_TARGETS is derived from `status: live` entries only', () => {
    const derived = IDEA_CONVERT_TARGETS.filter((t) => t.status === 'live').map((t) => t.id);
    expect(LIVE_CONVERT_TARGETS).toEqual(derived);
  });

  it('the two historically-broken targets are `soon`, never sent', () => {
    expect(isLiveConvertTarget('action_plan')).toBe(false);
    expect(isLiveConvertTarget('raid_log')).toBe(false);
  });

  it('registry entries are well-formed (id + status + bilingual labels)', () => {
    for (const t of IDEA_CONVERT_TARGETS) {
      expect(t.id).toBeTruthy();
      expect(['live', 'soon']).toContain(t.status);
      expect(t.labelPl).toBeTruthy();
      expect(t.labelEn).toBeTruthy();
    }
  });

  it('no duplicate ids in the registry', () => {
    const ids = IDEA_CONVERT_TARGETS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
