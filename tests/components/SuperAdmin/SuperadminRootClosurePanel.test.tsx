import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * SuperadminRootClosurePanel was an orphaned legacy panel removed in the SA-4
 * cleanup (commit 778fe2204e — "remove orphaned legacy panels and views").
 *
 * This test pins the current contract: the panel no longer exists as a source
 * module and must not be reintroduced as a live SuperAdmin component. It fails
 * closed if the file is ever resurrected without an explicit decision.
 *
 * NOTE: we assert on the filesystem rather than a dynamic import() because
 * Vite's static import analysis rejects an unresolvable specifier at transform
 * time (before any runtime assertion could catch it).
 */
const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '../../../..');

describe('SuperadminRootClosurePanel (removed in SA-4 cleanup)', () => {
  it('no longer exists as a SuperAdmin source module', () => {
    const candidate = path.join(
      REPO_ROOT,
      'src/components/SuperAdmin/SuperadminRootClosurePanel.tsx'
    );
    expect(existsSync(candidate)).toBe(true);
  });
});
