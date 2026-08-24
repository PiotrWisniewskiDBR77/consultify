import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const guardedFixtureScripts = [
  ['scripts/dev/seed-wave3-my-work-owner-review-owned.mjs', 831],
  ['scripts/dev/seed-wave3-settings-owner-review.mjs', 831],
  ['server/scripts/seed-wave3-admin-owner-review.ts', 831],
  ['server/scripts/seed-wave3-assessment-owner-review.ts', 831],
  ['server/scripts/seed-wave3-finance-owner-review.ts', 831],
  ['server/scripts/seed-wave3-initiatives-owner-review.ts', 834],
  ['server/scripts/seed-wave3-organization-owner-review.ts', 831],
  ['server/scripts/seed-wave3-partner-owner-review.ts', 831],
] as const;

describe('Wave 3 owner fixture migration denominator', () => {
  it.each(guardedFixtureScripts)(
    '%s does not retain the superseded 817 denominator',
    (file, expectedMigrations) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8');
      expect(source).not.toMatch(/\b817\b/);
      expect(source).toMatch(new RegExp(`\\b${expectedMigrations}\\b`));
    }
  );
});
