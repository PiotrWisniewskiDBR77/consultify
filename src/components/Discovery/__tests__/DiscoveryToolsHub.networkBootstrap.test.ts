import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('DiscoveryToolsHub network bootstrap', () => {
  it('uses the explicit legacy assessment read without probing feature-gated V8', () => {
    const hub = readFileSync(path.join(root, 'src/components/Discovery/DiscoveryToolsHub.tsx'), 'utf8');
    const api = readFileSync(path.join(root, 'src/services/api.ts'), 'utf8');

    expect(hub).toContain('Api.listAssessmentsLegacy({');
    expect(hub).not.toContain('Api.listAssessments({');
    expect(api).toContain('listAssessmentsLegacy,');
    expect(api).toContain('return listAssessmentsLegacy(params);');
  });
});
