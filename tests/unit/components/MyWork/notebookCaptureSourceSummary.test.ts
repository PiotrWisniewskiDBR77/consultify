import { describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../../public/locales/en/translation.json';
import plTranslation from '../../../../public/locales/pl/translation.json';

// notebookCaptureSourceSummary.ts's tr() calls the REAL i18next singleton directly
// (`import i18n from '../../../i18n'` → `i18n.t(key, default, { lng })`) instead of the
// react-i18next hook, so the global react-i18next mock in tests/setup.ts does not cover
// it. The real i18n module loads its translation bundles over HTTP (i18next-http-backend);
// tests/setup.ts globally mocks `fetch` to always return `{ data: [] }`, so no locale ever
// actually loads in tests and `i18n.t(key, default, { lng: 'pl' })` always fell back to the
// English `default` — the Polish-copy assertion could never pass. Mock `@/i18n`'s default
// export to resolve real copy from the locale JSON per requested `lng` (same pattern as
// ProcessFlowContextMenu/useProcessFlowAIProposal test fixes).
function resolveTranslation(
  dict: unknown,
  key: string,
  fallback: string,
  vars?: Record<string, unknown>
): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      dict
    );
  const template = typeof value === 'string' ? value : fallback;
  if (!vars) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : `{{${name}}}`
  );
}
vi.mock('@/i18n', () => ({
  default: {
    t: (key: string, fallback: string, options?: { lng?: string } & Record<string, unknown>) => {
      const { lng, ...vars } = options || {};
      return resolveTranslation(lng === 'pl' ? plTranslation : enTranslation, key, fallback, vars);
    },
  },
}));

import { getNotebookUploadSourceSummary } from '@/components/MyWork/notebook/notebookCaptureSourceSummary';

describe('getNotebookUploadSourceSummary', () => {
  it('returns a filename-based upload badge when notebook upload metadata is present', () => {
    expect(
      getNotebookUploadSourceSummary(
        'upload',
        { fileOriginalname: 'customer-discovery.xlsx', fileMimetype: 'application/vnd.ms-excel' },
        false
      )
    ).toEqual({
      label: 'File: customer-discovery.xlsx',
      title: 'Note created from file customer-discovery.xlsx',
    });
  });

  it('returns null for non-upload capture sources', () => {
    expect(getNotebookUploadSourceSummary('manual', { fileOriginalname: 'ignored.pdf' }, false)).toBe(null);
  });

  it('returns a web clip badge for web_clipper capture source', () => {
    expect(getNotebookUploadSourceSummary('web_clipper', { url: 'https://example.com' }, false)).toEqual({
      label: 'Web clip',
      title: 'Note created from a clipped page: https://example.com',
    });
  });

  // C4 — Canvas provenance pilot: notes materialized from a Work Canvas draft
  // carry capture_source='api_import' + metadata.sourceType='work_canvas'.
  it('returns a Canvas badge when metadata.sourceType is work_canvas', () => {
    expect(
      getNotebookUploadSourceSummary(
        'api_import',
        { sourceType: 'work_canvas' },
        true
      )
    ).toEqual({
      label: 'Canvas',
      title: 'Źródło: Canvas (rozmowa)',
    });
    expect(
      getNotebookUploadSourceSummary('api_import', { sourceType: 'work_canvas' }, false)
    ).toEqual({
      label: 'Canvas',
      title: 'Source: Canvas (conversation)',
    });
  });

  it('keeps the generic API-import badge when sourceType is absent', () => {
    expect(getNotebookUploadSourceSummary('api_import', {}, false)).toEqual({
      label: 'API import',
      title: 'Note created from an external import',
    });
  });
});
