/**
 * admin-health-dependencies / admin-health-incident-history defekt 05.09.
 *
 * Evidence: the page subtitle AND the second breadcrumb crumb for every
 * /admin/health/* screen read "Health" in English while the rest of the
 * Polish UI (including the sidebar's own "Stan systemu" label in
 * adminNavigation.ts) is Polish. Root cause: AdminSettingsModule.tsx's
 * SECTION_META['health'] points at i18n keys `admin.section.health.title` /
 * `admin.section.health.subtitle` (see the breadcrumb + subtitle wiring
 * around `t(meta.titleKey, { defaultValue: meta.titleDefault })`), but
 * unlike every sibling section (people/billing/ai/security/audit/command)
 * those two keys were simply never added to translation.json — so i18next
 * silently falls through to the call site's own English `defaultValue`
 * ("Health" / the English proof-of-life sentence) in EVERY language,
 * Polish included. "Klucz istnieje ≠ przetłumaczony" doesn't even apply
 * here — the key didn't exist at all.
 *
 * This asserts the real shipped resource, not a mock, so it fails exactly
 * as it would have before this key was added.
 */
import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function loadLocale(locale: 'pl' | 'en'): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(ROOT, `public/locales/${locale}/translation.json`), 'utf8')
  );
}

function resolve(resource: Record<string, unknown>, key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>(
      (node, segment) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined,
      resource
    );
}

describe('AdminSettingsModule SECTION_META.health i18n keys', () => {
  const pl = loadLocale('pl');
  const en = loadLocale('en');

  it('admin.section.health.title exists in Polish and is not the English "Health" default', () => {
    const plTitle = resolve(pl, 'admin.section.health.title');
    expect(typeof plTitle).toBe('string');
    expect(plTitle).not.toBe('Health');
  });

  it('admin.section.health.subtitle exists in Polish and is not the English default sentence', () => {
    const plSubtitle = resolve(pl, 'admin.section.health.subtitle');
    expect(typeof plSubtitle).toBe('string');
    expect(plSubtitle).not.toMatch(/Proof-of-life probes/);
  });

  it('admin.section.health.{title,subtitle} also exist in English (parity with every sibling section)', () => {
    expect(typeof resolve(en, 'admin.section.health.title')).toBe('string');
    expect(typeof resolve(en, 'admin.section.health.subtitle')).toBe('string');
  });
});
