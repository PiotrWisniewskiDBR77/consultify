import fs from 'node:fs';
import path from 'node:path';

import i18next from 'i18next';
import { describe, expect, it, beforeAll } from 'vitest';

const sectionSource = fs.readFileSync(
  path.resolve(__dirname, '../../../src/views/partner/sections/EarningsSection.tsx'),
  'utf8'
);
const en = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../public/locales/en/translation.json'), 'utf8')
);
const pl = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, '../../../public/locales/pl/translation.json'), 'utf8')
);

describe('day189 EarningsSection payout status i18n contract', () => {
  it('never falls back to the raw payout.status enum for the status chip', () => {
    // The regression: t(`partner.earnings.status.${status.toLowerCase()}`, payout.status)
    // returns the raw API enum (e.g. "FAILED") for any status missing from the dictionary.
    expect(sectionSource).not.toContain(
      '`partner.earnings.status.${payout.status.toLowerCase()}`, payout.status)'
    );
    expect(sectionSource).not.toMatch(
      /partner\.earnings\.status\.\$\{payout\.status\.toLowerCase\(\)\}`,\s*payout\.status\s*\)/
    );

    // Both status chip render sites must route through the safe nested fallback
    // key, matching the ClientsSection pattern (PartnerPortalView.tsx status col).
    const occurrences = sectionSource.match(
      /t\(\s*`partner\.earnings\.status\.\$\{payout\.status\.toLowerCase\(\)\}`,\s*t\('partner\.earnings\.status\.unknown',\s*'Nieznany status'\)\s*\)/g
    );
    expect(occurrences?.length).toBe(2);
  });

  it('ships failed/cancelled/unknown keys in both locales', () => {
    for (const key of ['failed', 'cancelled', 'unknown']) {
      expect(en.partner.earnings.status[key]).toBeTypeOf('string');
      expect(pl.partner.earnings.status[key]).toBeTypeOf('string');
    }
    expect(pl.partner.earnings.status.failed).toBe('Nieudana');
    expect(pl.partner.earnings.status.cancelled).toBe('Anulowana');
    expect(pl.partner.earnings.status.unknown).toBe('Nieznany status');
    expect(en.partner.earnings.status.failed).toBe('Failed');
    expect(en.partner.earnings.status.cancelled).toBe('Cancelled');
  });

  describe('runtime label resolution (real i18next resource resolution)', () => {
    beforeAll(async () => {
      await i18next.init({
        lng: 'pl',
        fallbackLng: 'en',
        resources: {
          pl: { translation: pl },
          en: { translation: en },
        },
        interpolation: { escapeValue: false },
      });
    });

    // Mirrors the exact expression used in EarningsSection.tsx
    const resolveStatusLabel = (lng: string, rawStatus: string) =>
      i18next
        .getFixedT(lng)(
          `partner.earnings.status.${rawStatus.toLowerCase()}`,
          i18next.getFixedT(lng)('partner.earnings.status.unknown', 'Nieznany status')
        )
        .toString();

    it('renders "Nieudana" for FAILED status in Polish', () => {
      expect(resolveStatusLabel('pl', 'FAILED')).toBe('Nieudana');
    });

    it('renders "Failed" for FAILED status in English', () => {
      expect(resolveStatusLabel('en', 'FAILED')).toBe('Failed');
    });

    it('renders "Anulowana" for CANCELLED status in Polish', () => {
      expect(resolveStatusLabel('pl', 'CANCELLED')).toBe('Anulowana');
    });

    it('renders the safe unknown fallback — never the raw enum — for a status outside the dictionary', () => {
      const label = resolveStatusLabel('pl', 'SOME_UNEXPECTED_STATUS');
      expect(label).toBe('Nieznany status');
      expect(label).not.toBe('SOME_UNEXPECTED_STATUS');
      expect(label).not.toBe('some_unexpected_status');
    });
  });
});
