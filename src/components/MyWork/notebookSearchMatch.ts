/**
 * Notebook library search — title AND body.
 *
 * S1.14b / W10 (pomiar 13.09, staging): "Search notes…" matched the title only.
 * "Warsaw" (in the title) returned the note; "dunning" and "Peppol" — both
 * verified present in its ~2000-word body via
 * `GET /api/v8/my-work/notebook/pages/:id` — returned nothing, and the empty
 * result rendered the first-run screen ("No pages yet / Create your first page"),
 * so the library looked empty rather than unmatched.
 *
 * The list rows already carry `contentText` and `summary`
 * (`buildNotebookSelectFields`, server/src/routes/v8/my-work.routes.ts), so this
 * needs no extra request.
 */

export interface NotebookSearchablePage {
  title?: string | null;
  contentText?: string | null;
  summary?: string | null;
}

export function normalizeNoteQuery(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase();
}

export function matchesNoteQuery(
  page: NotebookSearchablePage | null | undefined,
  normalizedQuery: string
): boolean {
  if (!normalizedQuery) return true;
  if (!page) return false;
  const haystack = [page.title, page.contentText, page.summary]
    .map((part) => String(part ?? '').toLowerCase())
    .join('\n');
  return haystack.includes(normalizedQuery);
}
