import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeSettingsSectionFromPath } from '../syncEntryResolver';

const directSections = [
  'password',
  'mfa',
  'sessions',
  'login-history',
  'recovery',
  'security-overview',
  'sessions-activity',
  'shortcuts',
  'overview',
  'module-preferences',
  'tenant-defaults',
  'tenant-branding',
  'tenant-security',
] as const;

describe('Day 55 A.3 — direct Settings section aliases', () => {
  for (const section of directSections) {
    it(`/settings/${section} resolves to a named SettingsView switch branch`, () => {
      expect(normalizeSettingsSectionFromPath(`/settings/${section}`)).toBe(section);
      const source = fs.readFileSync(
        path.resolve(process.cwd(), 'src/views/SettingsView.tsx'),
        'utf8'
      );
      expect(source).toContain(`case '${section}':`);
    });
  }
});
