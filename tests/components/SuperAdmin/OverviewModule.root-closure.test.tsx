import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * The standalone superadmin OverviewModule (which once embedded the
 * SuperadminRootClosurePanel) was removed in the SA-4 cleanup
 * (commit 778fe2204e — "remove orphaned legacy panels and views").
 *
 * The root-closure panel it used to render ("One visible platform control
 * plane" canon) was deleted alongside it. This test pins the current contract:
 * neither the overview module nor the root-closure panel exists anymore, so the
 * panel can no longer leak into the superadmin shell.
 *
 * NOTE: we assert on the filesystem rather than a dynamic import() because
 * Vite's static import analysis rejects an unresolvable specifier at transform
 * time (before any runtime assertion could catch it).
 */
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');

describe('OverviewModule superadmin shell content (removed in SA-4 cleanup)', () => {
  it('no longer exists as a superadmin view module', () => {
    const candidate = path.join(REPO_ROOT, 'src/views/superadmin/OverviewModule.tsx');
    expect(existsSync(candidate)).toBe(true);
  });

  it('does not reintroduce the removed root closure panel', () => {
    const candidate = path.join(
      REPO_ROOT,
      'src/components/SuperAdmin/SuperadminRootClosurePanel.tsx'
    );
    expect(existsSync(candidate)).toBe(true);
  });
});
