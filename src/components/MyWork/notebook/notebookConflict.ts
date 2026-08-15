export interface NotebookConflictPageLike {
  id?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * Normalize the two HTTP error shapes used by notebook routes. The API client
 * stores the complete parsed response in `error.data`; the fresh page is thus
 * normally nested at `error.data.data`. Accepting the direct row keeps the
 * legacy adapter compatible without ever treating the envelope itself as a
 * notebook page/version token.
 */
export function extractNotebookConflictPage<T extends NotebookConflictPageLike>(
  error: unknown
): T | null {
  const body = (error as { data?: unknown } | null)?.data;
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const nested = (body as { data?: unknown }).data;
  const candidate = nested && typeof nested === 'object' && !Array.isArray(nested) ? nested : body;
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const updatedAt = (candidate as NotebookConflictPageLike).updatedAt;
  return typeof updatedAt === 'string' && Number.isFinite(new Date(updatedAt).getTime())
    ? (candidate as T)
    : null;
}
