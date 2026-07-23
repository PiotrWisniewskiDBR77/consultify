/**
 * ExceleParametricTemplates — C3 (2026-07-22).
 *
 * Surfaces the server-side workbook TEMPLATE REGISTRY (live-formula models) on
 * /excele. Before C3 the registry (`WORKBOOK_TEMPLATES` → `buildFromTemplate`,
 * flagship `threeScenarioPnL`) was code-only: reachable only via an LLM heuristic
 * inside generation, never directly usable from the FE. This section lists each
 * template, opens a parameter form (prefilled with the registry defaults), and
 * builds a real .xlsx deterministically (no LLM) via
 * `POST /api/workbook/templates/:id/build` — same Outputs card + downloadUrl as a
 * generated workbook, so it also lands in Recent.
 *
 * Mounted ONLY inside ArtifactModuleHome for the `excele` lane (which is itself
 * behind the ff_excele flag), so no new flag is introduced.
 *
 * Inline grid preview (2026-07-23): after a successful build the result card no
 * longer offers only a download link — it fetches the built workbook's real
 * WorkbookSchema via `Api.getWorkbookSchema(built.id)` (same read endpoint and
 * `built.id` from `POST /templates/:id/build`'s response as the download URL —
 * see finalizeGeneratedWorkbook in server/src/routes/workbook.routes.ts) and
 * renders it with the SAME grid-shaping util as the B3 KimiWorkspaceShell xlsx
 * preview (`buildWorkbookGridSheets`/`isFormulaDisplayValue` from
 * `src/utils/workbookGridPreview.ts`) — read-only, cells + formulas, row-capped
 * with a "show all" toggle, sheet tabs when the template has more than one sheet.
 *
 * Styling: c-* tokens only, zero crimson (neutral CTA = bg-c-text; focus = c-focus).
 */

import {
  FileSpreadsheet,
  Loader2,
  Download,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { API_URL } from '@/services/api';
import { Api } from '@/services/api';
import { buildWorkbookGridSheets, isFormulaDisplayValue } from '@/utils/workbookGridPreview';
import type { WorkbookGridSheet } from '@/utils/workbookGridPreview';

type ParamType = 'text' | 'integer' | 'number' | 'percent' | 'currency' | 'enum';

interface TemplateParam {
  name: string;
  label: string;
  type: ParamType;
  default: string | number;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: string;
  help?: string;
}

interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  params: TemplateParam[];
}

interface BuildResult {
  id: string;
  title: string;
  fileName: string;
  downloadUrl: string;
  sheetCount: number;
}

interface Props {
  isPolish: boolean;
  /** Called after a successful build so the parent can refresh the Recent list. */
  onBuilt?: () => void;
}

/** Percent params store a FRACTION (0.08); we show whole percents (8) in the form. */
const pctToDisplay = (native: number): number => Math.round(native * 1000) / 10;
const displayToPct = (shown: number): number => shown / 100;

/** Inline preview keeps the grid compact — cap rows, offer "show all" like the
 *  full-size KimiWorkspaceShell grid (src/utils/workbookGridPreview.ts consumer). */
const PREVIEW_ROW_CAP = 50;

export const ExceleParametricTemplates: React.FC<Props> = ({ isPolish, onBuilt }) => {
  const [templates, setTemplates] = useState<TemplateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TemplateEntry | null>(null);
  const [values, setValues] = useState<Record<string, string | number>>({});
  const [building, setBuilding] = useState(false);
  const [result, setResult] = useState<BuildResult | null>(null);

  // Inline read-only grid preview of the built workbook (reuses B3's
  // getWorkbookSchema + buildWorkbookGridSheets — same source as the KimiWorkspaceShell
  // xlsx grid — instead of leaving the user with only a download link).
  const [gridSheets, setGridSheets] = useState<WorkbookGridSheet[] | null>(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState<string | null>(null);
  const [activeSheet, setActiveSheet] = useState(0);
  const [showAllRows, setShowAllRows] = useState(false);

  const t = useCallback(
    (pl: string, en: string) => (isPolish ? pl : en),
    [isPolish]
  );

  useEffect(() => {
    let alive = true;
    Api.listWorkbookTemplates()
      .then((data) => {
        if (!alive) return;
        setTemplates(Array.isArray(data?.templates) ? (data.templates as TemplateEntry[]) : []);
      })
      .catch(() => {
        if (alive) setTemplates([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const openForm = useCallback((tpl: TemplateEntry) => {
    const initial: Record<string, string | number> = {};
    for (const p of tpl.params) {
      if (p.type === 'percent' && typeof p.default === 'number') {
        initial[p.name] = pctToDisplay(p.default);
      } else {
        initial[p.name] = p.default;
      }
    }
    setValues(initial);
    setResult(null);
    setGridSheets(null);
    setGridError(null);
    setGridLoading(false);
    setSelected(tpl);
  }, []);

  const groups = useMemo(() => {
    if (!selected) return [];
    const order: string[] = [];
    const map = new Map<string, TemplateParam[]>();
    for (const p of selected.params) {
      const g = p.group || t('Parametry', 'Parameters');
      if (!map.has(g)) {
        map.set(g, []);
        order.push(g);
      }
      map.get(g)!.push(p);
    }
    return order.map((g) => ({ group: g, params: map.get(g)! }));
  }, [selected, t]);

  const setValue = useCallback((name: string, raw: string, type: ParamType) => {
    setValues((prev) => {
      if (type === 'text' || type === 'enum') return { ...prev, [name]: raw };
      // numeric-ish: keep the raw string while editing; coerce on submit.
      return { ...prev, [name]: raw };
    });
  }, []);

  const handleBuild = useCallback(async () => {
    if (!selected) return;
    setBuilding(true);
    try {
      // Convert the form values into the registry's native param units:
      // percent fields are shown ×100, everything else passes through as a number
      // (or string for text/enum). Empty numeric fields are OMITTED so the server
      // applies the template default.
      const params: Record<string, unknown> = {};
      for (const p of selected.params) {
        const v = values[p.name];
        if (p.type === 'text' || p.type === 'enum') {
          if (typeof v === 'string' && v.trim()) params[p.name] = v;
          continue;
        }
        if (v === '' || v === undefined || v === null) continue;
        const num = typeof v === 'number' ? v : Number(v);
        if (!Number.isFinite(num)) continue;
        params[p.name] = p.type === 'percent' ? displayToPct(num) : num;
      }

      const res = await Api.buildWorkbookTemplate(selected.id, {
        params,
        language: isPolish ? 'pl' : 'en',
      });
      const built: BuildResult = {
        id: res?.id,
        title: res?.title || selected.name,
        fileName: res?.fileName || 'workbook.xlsx',
        downloadUrl: res?.downloadUrl || `/api/workbook/${res?.id}/download`,
        sheetCount: Array.isArray(res?.sheets) ? res.sheets.length : 0,
      };
      setResult(built);
      toast.success(t('Skoroszyt zbudowany', 'Workbook built'));
      onBuilt?.();

      // Load the real cell/formula grid so the build result shows the actual
      // content inline instead of only a download link (same shape/endpoint as
      // the B3 KimiWorkspaceShell xlsx preview: GET /api/workbook/:id/schema).
      if (built.id) {
        setGridSheets(null);
        setGridError(null);
        setActiveSheet(0);
        setShowAllRows(false);
        setGridLoading(true);
        Api.getWorkbookSchema(built.id)
          .then((schema) => {
            setGridSheets(buildWorkbookGridSheets(schema?.sheets));
          })
          .catch((err) => {
            console.warn('[ExceleParametricTemplates] Failed to load workbook grid schema:', err);
            setGridError(
              t(
                'Nie udało się wczytać podglądu komórek. Pobierz plik, aby zobaczyć zawartość.',
                'Failed to load the cell preview. Download the file to see the content.'
              )
            );
          })
          .finally(() => {
            setGridLoading(false);
          });
      }
    } catch (err: any) {
      const msg =
        err?.data?.issues?.map((i: any) => `${i.path}: ${i.message}`).join('; ') ||
        err?.message ||
        t('Nie udało się zbudować skoroszytu', 'Failed to build workbook');
      toast.error(msg);
    } finally {
      setBuilding(false);
    }
  }, [selected, values, isPolish, onBuilt, t]);

  const handleDownload = useCallback((r: BuildResult) => {
    const url = r.downloadUrl.startsWith('http')
      ? r.downloadUrl
      : `${API_URL.replace(/\/api$/, '')}${r.downloadUrl}`;
    window.open(url, '_blank');
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 size={20} className="animate-spin text-c-text-secondary" />
      </div>
    );
  }

  if (templates.length === 0) return null;

  // ---- Detail: parameter form ----
  if (selected) {
    return (
      <section className="mb-8 rounded-xl border border-c-border-subtle bg-c-surface p-4">
        <button
          onClick={() => setSelected(null)}
          className="inline-flex items-center gap-1 text-xs font-medium text-c-text-secondary hover:text-c-text mb-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus rounded"
        >
          <ChevronLeft size={14} />
          {t('Wróć do szablonów', 'Back to templates')}
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-c-surface-raised flex items-center justify-center shrink-0">
            <FileSpreadsheet size={18} className="text-c-text-secondary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-c-text">{selected.name}</h3>
            <p className="text-xs text-c-text-secondary mt-0.5">{selected.description}</p>
          </div>
        </div>

        {result ? (
          <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={18} className="text-c-success" />
              <p className="text-sm font-medium text-c-text">
                {t('Gotowe', 'Ready')}: {result.title}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleDownload(result)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-c-text text-c-bg text-xs font-medium hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <Download size={14} />
                {result.fileName}
              </button>
              <button
                onClick={() => {
                  setResult(null);
                  setGridSheets(null);
                  setGridError(null);
                  setGridLoading(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-c-border text-c-text-secondary text-xs font-medium hover:bg-c-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('Zbuduj ponownie', 'Build again')}
              </button>
            </div>

            {/* Inline read-only grid preview of the built workbook (cells + formulas). */}
            <div className="mt-4">
              {gridLoading ? (
                <div className="rounded-lg border border-c-border-subtle bg-c-surface overflow-hidden">
                  <div className="p-6 text-center text-c-text-secondary">
                    <Loader2 size={24} className="mx-auto mb-2 animate-spin" />
                    <p className="text-xs font-medium">
                      {t('Wczytywanie komórek i formuł…', 'Loading cells and formulas…')}
                    </p>
                  </div>
                </div>
              ) : gridError ? (
                <div className="rounded-lg border border-c-border-subtle bg-c-surface overflow-hidden">
                  <div className="p-6 text-center text-c-text-secondary">
                    <AlertTriangle size={24} className="mx-auto mb-2 text-c-warning" />
                    <p className="text-xs font-medium text-c-text">{gridError}</p>
                  </div>
                </div>
              ) : gridSheets && gridSheets.length > 0 ? (
                <div className="rounded-lg border border-c-border-subtle bg-c-surface overflow-hidden">
                  {gridSheets.length > 1 && (
                    <div className="flex items-center gap-1 px-2 pt-2 overflow-x-auto border-b border-c-border-subtle">
                      {gridSheets.map((sheet, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setActiveSheet(i);
                            setShowAllRows(false);
                          }}
                          className={`px-2.5 py-1.5 text-xs font-medium rounded-t-md whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                            activeSheet === i
                              ? 'text-c-text border-b-2 border-c-text'
                              : 'text-c-text-secondary hover:text-c-text'
                          }`}
                        >
                          {`Sheet ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {(() => {
                    const sheetData = gridSheets[activeSheet] || gridSheets[0];
                    if (!sheetData || sheetData.columns.length === 0) return null;
                    const visibleRows = showAllRows
                      ? sheetData.rows
                      : sheetData.rows.slice(0, PREVIEW_ROW_CAP);
                    return (
                      <>
                        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                          <table className="w-full text-xs">
                            <thead className="sticky top-0 z-10">
                              <tr className="bg-c-surface-raised">
                                {sheetData.columns.map((col, ci) => (
                                  <th
                                    key={`${col}-${ci}`}
                                    className="px-3 py-2 text-left font-medium text-c-text-secondary border-b border-c-border-subtle whitespace-nowrap"
                                  >
                                    {col}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {visibleRows.map((row, ri) => (
                                <tr
                                  key={ri}
                                  className="border-b border-c-border-subtle hover:bg-c-surface-raised"
                                >
                                  {sheetData.columns.map((col, ci) => {
                                    const raw = row[col];
                                    const isFormula = isFormulaDisplayValue(raw);
                                    return (
                                      <td
                                        key={`${col}-${ci}`}
                                        title={isFormula ? raw : undefined}
                                        className={`px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate ${
                                          isFormula
                                            ? 'font-mono text-c-text-secondary'
                                            : 'text-c-text'
                                        }`}
                                      >
                                        {String(raw ?? '')}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {sheetData.rows.length > PREVIEW_ROW_CAP && (
                          <div className="px-3 py-2 flex items-center justify-center gap-3 text-[11px] text-c-text-secondary border-t border-c-border-subtle">
                            <span>
                              {showAllRows
                                ? t('Pokazano wszystkie {{n}} wierszy', 'Showing all {{n}} rows').replace(
                                    '{{n}}',
                                    String(sheetData.rows.length)
                                  )
                                : t(
                                    'Pokazano pierwsze {{cap}} z {{n}} wierszy',
                                    'Showing first {{cap}} of {{n}} rows'
                                  )
                                    .replace('{{cap}}', String(PREVIEW_ROW_CAP))
                                    .replace('{{n}}', String(sheetData.rows.length))}
                            </span>
                            {!showAllRows && (
                              <button
                                type="button"
                                onClick={() => setShowAllRows(true)}
                                className="px-2 py-0.5 rounded font-medium text-c-text hover:bg-c-surface-raised transition-colors"
                              >
                                {t('Pokaż wszystkie', 'Show all')}
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-5">
              {groups.map(({ group, params }) => (
                <div key={group}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-2">
                    {group}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {params.map((p) => (
                      <label key={p.name} className="flex flex-col gap-1">
                        <span className="text-xs text-c-text-secondary">
                          {p.label}
                          {p.type === 'percent' ? ' (%)' : ''}
                        </span>
                        {p.type === 'enum' ? (
                          <select
                            value={String(values[p.name] ?? '')}
                            onChange={(e) => setValue(p.name, e.target.value, p.type)}
                            className="px-2.5 py-1.5 rounded-lg border border-c-border bg-c-surface text-sm text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          >
                            {(p.options || []).map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={p.type === 'text' ? 'text' : 'number'}
                            inputMode={p.type === 'text' ? undefined : 'decimal'}
                            step={p.type === 'percent' ? 0.5 : p.step}
                            value={String(values[p.name] ?? '')}
                            onChange={(e) => setValue(p.name, e.target.value, p.type)}
                            className="px-2.5 py-1.5 rounded-lg border border-c-border bg-c-surface text-sm text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                          />
                        )}
                        {p.help ? (
                          <span className="text-[11px] text-c-text-muted">{p.help}</span>
                        ) : null}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={handleBuild}
                disabled={building}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-c-text text-c-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {building ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                {t('Zbuduj skoroszyt', 'Build workbook')}
              </button>
            </div>
          </>
        )}
      </section>
    );
  }

  // ---- List: template cards ----
  return (
    <section className="mb-8">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles size={15} className="text-c-text-secondary" />
        <h2 className="text-sm font-semibold text-c-text">
          {t('Szablony parametryczne (żywe formuły)', 'Parametric templates (live formulas)')}
        </h2>
      </div>
      <p className="text-xs text-c-text-secondary mb-3">
        {t(
          'Sprawdzone modele z prawdziwymi formułami Excela — ustaw parametry i zbuduj gotowy .xlsx.',
          'Proven models with real Excel formulas — set the parameters and build a ready .xlsx.'
        )}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {templates.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => openForm(tpl)}
            className="group text-left p-4 rounded-xl border border-c-border-subtle bg-c-surface hover:border-c-border-strong hover:shadow-sm transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <FileSpreadsheet size={16} className="text-c-text-secondary" />
              <p className="text-sm font-medium text-c-text line-clamp-1">{tpl.name}</p>
            </div>
            <p className="text-xs text-c-text-secondary line-clamp-3">{tpl.description}</p>
            <p className="text-[11px] text-c-text-muted mt-2">
              {tpl.params.length} {t('parametrów', 'parameters')}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ExceleParametricTemplates;
