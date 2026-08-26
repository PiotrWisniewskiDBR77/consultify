/** @vitest-environment node */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const root = process.cwd();
const readLocale = (language: 'en' | 'pl') =>
  JSON.parse(
    fs.readFileSync(path.join(root, `public/locales/${language}/translation.json`), 'utf8')
  ) as Record<string, any>;

function flatten(value: unknown, prefix = '', output: Record<string, unknown> = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value as Record<string, unknown>))
      flatten(child, prefix ? `${prefix}.${key}` : key, output);
  } else {
    output[prefix] = value;
  }
  return output;
}

describe('Organization Profile EN/PL locale contract', () => {
  it('keeps exact key parity for the profile and governed-context review surfaces', () => {
    const en = readLocale('en').organization;
    const pl = readLocale('pl').organization;
    const enKeys = Object.keys(flatten({ profile: en.profile, governance: en.governance })).sort();
    const plKeys = Object.keys(flatten({ profile: pl.profile, governance: pl.governance })).sort();

    expect(plKeys).toEqual(enKeys);
    for (const value of Object.values(flatten({ profile: pl.profile, governance: pl.governance })))
      expect(String(value ?? '').trim()).not.toBe('');
  });

  it('localizes visible labels while preserving canonical enum values in product source', () => {
    const en = readLocale('en').organization.profile;
    const pl = readLocale('pl').organization.profile;
    // Kanoniczne wartości enum mieszkają od 2026-08-24 w wyodrębnionej taksonomii
    // (`organizationProfileTaxonomy.tsx`) — czytana przez STARY moduł profilu
    // i przez redesign v1 ekranu „Tożsamość i model działania". Kontrakt bez
    // zmian: te same literały + ten sam klucz i18n, tylko w dwóch plikach.
    const source = [
      'src/views/ContextBuilder/modules/OrganizationProfileModule.tsx',
      'src/views/ContextBuilder/modules/organizationProfileTaxonomy.tsx',
    ]
      .map((relative) => fs.readFileSync(path.join(root, relative), 'utf8'))
      .join('\n');

    expect(pl.options.organizationType.SERVICES.label).toBe('Usługi profesjonalne');
    expect(en.options.organizationType.SERVICES.label).toBe('Professional Services');
    expect(pl.fields.industry).toBe('Branża');
    expect(pl.readiness.title).toBe('Gotowość modułów');
    for (const canonical of [
      "value: 'MANUFACTURING'",
      "value: 'SERVICES'",
      "value: 'TECHNOLOGY'",
      "value: 'PUBLIC_SECTOR'",
      "value: 'NONPROFIT'",
      "value: 'OTHER'",
    ])
      expect(source).toContain(canonical);
    expect(source).toContain('organization.profile.options.organizationType.${ot.value}.label');
  });
});
