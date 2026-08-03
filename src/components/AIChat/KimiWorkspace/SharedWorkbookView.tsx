/**
 * SharedWorkbookView — MAT-006 (2026-08-02). Public, unauthenticated reader
 * for `GET /api/workbook/shared/:token`, mirroring the existing
 * `SharedPresentationView` pattern (src/components/Presentations/) 1:1:
 * standalone page, no app chrome, fetch-on-mount, honest error state for a
 * missing/revoked/expired token. Deliberately plain (a simple read-only
 * table per sheet) — full visual polish is a separate Visual QA pass per the
 * MAT-006 brief ("proving function, not polish").
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

interface PublicSheet {
  name: string;
  columns: Array<{ key: string; header: string }>;
  rows: Array<{ cells: Record<string, { value?: unknown; formula?: string }> }>;
}

interface PublicWorkbook {
  id: string;
  title: string | null;
  description: string | null;
  sheets: PublicSheet[];
}

export const SharedWorkbookView: React.FC = () => {
  const { t } = useTranslation();
  const { shareToken } = useParams<{ shareToken: string }>();
  const [workbook, setWorkbook] = useState<PublicWorkbook | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!shareToken) {
        setError('Missing share token');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/workbook/shared/${encodeURIComponent(shareToken)}`);
        const payload = await res.json();
        if (!res.ok || !payload?.data) {
          throw new Error(payload?.error || 'Shared workbook not found');
        }
        if (!cancelled) {
          setWorkbook(payload.data as PublicWorkbook);
          setActiveSheet(0);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(String(err?.message || 'Shared workbook not found'));
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg text-c-text">
        <div className="text-sm text-c-text-muted">
          {t('excele.shared.loading', 'Loading shared workbook...')}
        </div>
      </div>
    );
  }

  const sheet = workbook?.sheets?.[activeSheet];

  if (!workbook || !sheet) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-c-bg px-6 text-c-text">
        <div className="max-w-md rounded-2xl border border-c-border-subtle bg-c-surface p-6 text-center">
          <h1 className="text-lg font-semibold text-c-text">
            {t('excele.shared.unavailableTitle', 'Workbook unavailable')}
          </h1>
          <p className="mt-2 text-sm text-c-text-muted" data-testid="shared-workbook-error">
            {error ||
              t(
                'excele.shared.unavailableBody',
                'The shared link is invalid, revoked, or expired.'
              )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-c-bg text-c-text">
      <div className="border-b border-c-border-subtle bg-c-surface px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-c-text-muted">
              {t('excele.shared.badge', 'Shared workbook (read-only)')}
            </div>
            <h1 className="mt-1 text-lg font-semibold text-c-text">
              {workbook.title || t('excele.shared.untitled', 'Untitled workbook')}
            </h1>
          </div>
          {workbook.sheets.length > 1 && (
            <select
              value={activeSheet}
              onChange={(e) => setActiveSheet(Number(e.target.value))}
              className="rounded-md border border-c-border-subtle bg-c-surface px-2 py-1 text-sm text-c-text"
              aria-label={t('excele.shared.selectSheet', 'Select sheet')}
            >
              {workbook.sheets.map((s, i) => (
                <option key={s.name + i} value={i}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-5xl overflow-x-auto px-6 py-8">
        {/* §27-exempt — archetyp Excel (docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md): plain read-only spreadsheet grid, not a module list screen. */}
        {/* prettier-ignore */}
        <table className="min-w-full border-collapse text-sm" data-testid="shared-workbook-table">{/* §27-exempt */}
          <thead>
            <tr>
              {sheet.columns.map((col) => (
                <th
                  key={col.key}
                  className="border border-c-border-subtle bg-c-surface-raised px-2 py-1 text-left font-medium text-c-text"
                >
                  {col.header || col.key}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {sheet.columns.map((col) => {
                  const cell = row.cells?.[col.key];
                  const display =
                    cell?.formula !== undefined
                      ? `=${cell.formula}`
                      : cell?.value === undefined || cell.value === null
                        ? ''
                        : String(cell.value);
                  return (
                    <td
                      key={col.key}
                      className="border border-c-border-subtle px-2 py-1 text-c-text"
                    >
                      {display}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SharedWorkbookView;
