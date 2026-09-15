/**
 * Document-template authoring locale — DEC-461/DEC-510 (F8b, 2026-09-15).
 *
 * `POST /api/deliverables/templates` used to author every `doc` template with
 * `language = 'pl'` hardcoded (documentTemplateService drafted with a `?? 'pl'`
 * fallback and `document_studio_templates.language` defaults to `'pl'` at the
 * schema level). A template authored by an English-speaking consultant was
 * therefore stamped Polish and generated Polish documents.
 *
 * EN is now the server default; PL is opt-in through the DEC-510 candidate
 * chain, mirroring `resolveWorkbookTemplateLocale` in `routes/workbook.routes.ts`:
 *   explicit request override → users.language → users.locale
 *   → organizations.default_language → 'en'.
 *
 * Every lookup is defensive: a missing column or a failed query degrades to the
 * next candidate and ultimately to English — never to Polish, never a throw.
 */
import * as dbPromise from '../../utils/DbPromise.js';

export type DocumentTemplateLocale = 'pl' | 'en';

export function normalizeDocumentTemplateLocale(value: unknown): DocumentTemplateLocale | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase().replace('_', '-').split('-')[0];
  return normalized === 'en' || normalized === 'pl' ? normalized : null;
}

export async function resolveDocumentTemplateLocale(params: {
  explicit?: unknown;
  userId?: string | null;
  organizationId?: string | null;
}): Promise<DocumentTemplateLocale> {
  const explicit = normalizeDocumentTemplateLocale(params.explicit);
  if (explicit) return explicit;

  if (params.userId) {
    for (const column of ['language', 'locale'] as const) {
      try {
        const row = (await dbPromise.get(`SELECT ${column} AS value FROM users WHERE id = ?`, [
          params.userId,
        ])) as { value?: string | null } | undefined;
        const locale = normalizeDocumentTemplateLocale(row?.value);
        if (locale) return locale;
      } catch {
        // Column missing or query failed — try the next candidate.
      }
    }
  }

  if (params.organizationId) {
    try {
      const row = (await dbPromise.get(
        `SELECT default_language AS value FROM organizations WHERE id = ?`,
        [params.organizationId]
      )) as { value?: string | null } | undefined;
      const locale = normalizeDocumentTemplateLocale(row?.value);
      if (locale) return locale;
    } catch {
      // Fall through to the English default.
    }
  }

  return 'en';
}
