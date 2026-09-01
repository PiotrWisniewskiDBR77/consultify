import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(`${process.cwd()}/server/src/config/FeatureFlags.ts`, 'utf8');

describe('Day221 ENABLE_AUDITS_WORKSHOP scaffold', () => {
  it('declares the flag in FeatureFlagsSchema with default false', () => {
    expect(source).toContain('ENABLE_AUDITS_WORKSHOP: z.boolean().default(false)');
  });

  it('loads the flag only from an explicit true environment value', () => {
    expect(source).toContain("ENABLE_AUDITS_WORKSHOP: process.env.ENABLE_AUDITS_WORKSHOP === 'true'");
  });
});
