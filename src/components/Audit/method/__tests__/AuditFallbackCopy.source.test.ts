/**
 * @vitest-environment node
 *
 * OP-1/W101: Audit previews must not leak placeholder/debug copy such as
 * "undefined" or "— not provided —" in Library/Sessions details.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const files = {
  processes: readFileSync(new URL('../tabs/AuditProcessesTab.tsx', import.meta.url), 'utf8'),
  library: readFileSync(new URL('../tabs/AuditLibraryTab.tsx', import.meta.url), 'utf8'),
};

describe('Audit method preview fallback copy', () => {
  it('does not expose "not provided" placeholders in user-visible details', () => {
    for (const source of Object.values(files)) {
      expect(source).not.toContain('— not provided —');
      expect(source).not.toContain('— nie podano —');
    }
  });

  it('uses plain action-oriented empty descriptions instead', () => {
    expect(files.processes).toContain('No scope description yet.');
    expect(files.processes).toContain('No objective description yet.');
    expect(files.library).toContain('No pack purpose description yet.');
    expect(files.library).toContain('No pack scope description yet.');
  });
});
