import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const guardedFixtureScripts = [
  'scripts/dev/seed-wave3-my-work-owner-review-owned.mjs',
  'scripts/dev/seed-wave3-settings-owner-review.mjs',
  'server/scripts/seed-wave3-admin-owner-review.ts',
  'server/scripts/seed-wave3-assessment-owner-review.ts',
  'server/scripts/seed-wave3-finance-owner-review.ts',
  'server/scripts/seed-wave3-initiatives-owner-review.ts',
  'server/scripts/seed-wave3-organization-owner-review.ts',
  'server/scripts/seed-wave3-partner-owner-review.ts',
];

describe('Wave 3 owner fixture migration denominator', () => {
  it.each(guardedFixtureScripts)('%s does not retain the superseded 817 denominator', (file) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
    expect(source).not.toMatch(/\b817\b/);
    expect(source).toMatch(/\b831\b/);
  });
});
