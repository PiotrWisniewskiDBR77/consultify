/** @vitest-environment node */

/**
 * D-46 — locale of Report Builder binary exports.
 *
 * WHY THIS SUITE EXISTS: `GET /api/report-builder/:id/export/pptx` passed
 * `(language as any) || 'pl'` to the deck renderer and `language: (language as
 * string) || 'pl'` to the export record, so every report whose caller did not
 * send `?language=` got a Polish title-slide date — including an English report
 * of an English-speaking organization, whose DOCX export written in the same
 * minute carried the English date. This covers the decision order itself; the
 * wiring into the real route is covered by
 * `../../../routes/__tests__/report-builder-export-locale.routes.test.ts`.
 */

import { describe, expect, it, vi } from 'vitest';

const mockResolveLocale = vi.fn();

vi.mock('../../ai/languagePolicy.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../ai/languagePolicy.js')>();
  return {
    ...actual,
    resolveLocale: (...args: unknown[]) => mockResolveLocale(...args),
  };
});

import {
  normalizeExportLocale,
  pickExportLocale,
  resolveReportExportLocale,
} from '../exportLocale.js';

const req = { userId: 'user-1', organizationId: 'org-1' } as any;

describe('normalizeExportLocale', () => {
  it('accepts only what the renderers understand', () => {
    expect(normalizeExportLocale('pl')).toBe('pl');
    expect(normalizeExportLocale('pl-PL')).toBe('pl');
    expect(normalizeExportLocale('EN')).toBe('en');
    expect(normalizeExportLocale('en-GB')).toBe('en');
    expect(normalizeExportLocale('de')).toBeNull();
    expect(normalizeExportLocale('')).toBeNull();
    expect(normalizeExportLocale(undefined)).toBeNull();
    expect(normalizeExportLocale(12)).toBeNull();
  });
});

describe('pickExportLocale — decision order', () => {
  it('explicit request language wins over the report language', () => {
    expect(
      pickExportLocale({ explicit: 'pl', reportLanguage: 'en', sectionLanguages: ['en'] })
    ).toBe('pl');
  });

  it('report language wins over section language', () => {
    expect(pickExportLocale({ reportLanguage: 'en', sectionLanguages: ['pl'] })).toBe('en');
  });

  it('takes the first section that carries a usable language', () => {
    expect(pickExportLocale({ sectionLanguages: [undefined, 'de', 'pl-PL', 'en'] })).toBe('pl');
  });

  it('returns null when nothing in the request or the report decided', () => {
    expect(pickExportLocale({})).toBeNull();
    expect(pickExportLocale({ explicit: 'de', reportLanguage: 'fr', sectionLanguages: [] })).toBeNull();
  });
});

describe('resolveReportExportLocale — DEC-510 fallback', () => {
  it('falls back to the identity chain when neither request nor report decided', async () => {
    mockResolveLocale.mockReset();
    mockResolveLocale.mockResolvedValue('en');

    await expect(resolveReportExportLocale(req, { report: {}, sections: [] })).resolves.toBe('en');
    expect(mockResolveLocale).toHaveBeenCalledTimes(1);
  });

  it('maps a profile language the renderers do not know to English', async () => {
    mockResolveLocale.mockReset();
    mockResolveLocale.mockResolvedValue('de');

    await expect(resolveReportExportLocale(req, {})).resolves.toBe('en');
  });

  it('does not query the profile when the report already decided', async () => {
    mockResolveLocale.mockReset();
    mockResolveLocale.mockResolvedValue('pl');

    await expect(
      resolveReportExportLocale(req, { report: { language: 'en' }, sections: [] })
    ).resolves.toBe('en');
    expect(mockResolveLocale).not.toHaveBeenCalled();
  });

  it('keeps Polish for a Polish report', async () => {
    mockResolveLocale.mockReset();
    mockResolveLocale.mockResolvedValue('en');

    await expect(
      resolveReportExportLocale(req, { report: { language: 'pl-PL' }, sections: [] })
    ).resolves.toBe('pl');
  });

  it('defaults to English when no source at all speaks', async () => {
    mockResolveLocale.mockReset();
    mockResolveLocale.mockResolvedValue('en');

    await expect(resolveReportExportLocale(null, {})).resolves.toBe('en');
  });
});
