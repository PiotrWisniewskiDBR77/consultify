import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

describe('ExceleParametricTemplates runtime contract', () => {
  it('imports every React hook used by the initial custom-template selection bridge', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/AIChat/KimiWorkspace/ExceleParametricTemplates.tsx'),
      'utf8'
    );

    expect(source).toMatch(/import React,\s*\{[^}]*\buseRef\b[^}]*\}\s*from ['"]react['"]/s);
    expect(source).toContain('const initialSelectionApplied = useRef<string | null>(null);');
  });
});
