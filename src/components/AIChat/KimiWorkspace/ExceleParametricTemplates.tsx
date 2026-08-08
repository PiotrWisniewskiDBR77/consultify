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
 * Quality badge (2026-07-23): the deterministic critic (`critiqueWorkbook`, already
 * run server-side for EVERY template build — see `qualityReport` on
 * `WorkbookGenerationResult` in WorkbookGeneratorService.generateFromTemplate) is
 * now surfaced next to the grid preview as a NON-BLOCKING badge — "Model
 * zweryfikowany ✓ (0 uwag)" when clean, or "N uwag" with an expandable list
 * (severity + message + fix) when the critic found something. Purely additive:
 * no generation/export logic changes, no new flag (the signal already computes
 * unconditionally), never blocks download.
 *
 * Styling: c-* tokens only, zero crimson (neutral CTA = bg-c-text; focus = c-focus).
 *
 * Saved parameter sets (2026-07-23): a real step of AUTHORSHIP — configuring a
 * template's params (sometimes a dozen fields) is repeated work across builds,
 * so the form now lets the user save the current values as a named preset and
 * reload it later. There is no backend preset mechanism for workbook templates
 * (checked server/src/routes/workbook.routes.ts — only /templates + /templates/:id/build
 * exist), so this is FE-only, localStorage-backed per templateId — see
 * `src/utils/exceleTemplatePresets.ts`. Zero backend risk, purely additive,
 * no new flag (same ff_excele-gated surface).
 *
 * Mini bar chart (2026-07-23): above the grid preview, a small pure-SVG bar
 * chart (`MiniBarChart.tsx`, zero charting library) gives a poglądowa
 * ("at a glance") trend/comparison read of the FIRST sheet — it picks the
 * first row with ≥2 numeric, non-formula value cells as its series (column
 * headers become the labels underneath) and renders nothing when no row
 * qualifies (all-formula/text sheets stay exactly as before). FE-only, reuses
 * the already-fetched `gridSheets` state — no extra request, no new flag.
 *
 * Edytowalna siatka (2026-07-28, "jeden Excel na każdej ścieżce"): przed tą
 * zmianą ten ekran ("Ścieżka A" — /excele → szablon → "Build workbook") i
 * `KimiWorkspaceShell`'s reopen ("Ścieżka B" — `?artifactId=`) renderowały
 * DWA różne widoki tego samego skoroszytu: tu zawsze tylko-do-odczytu
 * `<table>` (dwuklik nic nie robił), tam za `ff_excele_edit` prawdziwy
 * `EditableSpreadsheetGrid`. Zamiast przekierowywać po zbudowaniu (co
 * zgubiłoby "Zbuduj ponownie"/"Zapisz zestaw parametrów"/odznakę jakości —
 * wszystkie żyją TYLKO na tym ekranie, w stanie `result`/`presets`), grid
 * został OSADZONY tutaj: ten sam `Api.getWorkbookSchema(built.id)`, którego
 * już wołaliśmy dla `gridSheets` (kształt do wykresu/tabeli read-only), daje
 * też SUROWE arkusze (`schema.sheets`) — dokładnie ten kształt, którego
 * `EditableSpreadsheetGrid` oczekuje jako `sheets` (identyczny z `rawSheets`
 * w `ExceleView.tsx`'s reopen). Za `ff_excele_edit` (domyślnie ON od
 * 2026-07-28) renderuje się grid; przy kill-switchu `?ff_excele_edit=0`
 * albo braku kolumn w arkuszu (np. przyszły pusty szablon) zostaje stary,
 * tylko-do-odczytu render — zero regresji.
 */

import {
  AlertTriangle,
  Bookmark,
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  Download,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { API_URL } from '@/services/api';
import { Api } from '@/services/api';
import { isExceleEditEnabled } from '@/utils/exceleEditFlag';
import {
  deleteTemplatePreset,
  type ExceleTemplatePreset,
  readTemplatePresets,
  saveTemplatePreset,
} from '@/utils/exceleTemplatePresets';
import type { FormulaSheet } from '@/utils/workbookFormulaEngine';
import type { WorkbookGridSheet } from '@/utils/workbookGridPreview';
import { buildWorkbookGridSheets, isFormulaDisplayValue } from '@/utils/workbookGridPreview';

import { EditableSpreadsheetGrid } from './EditableSpreadsheetGrid';
import { findBarChartSeries, MiniBarChart } from './MiniBarChart';

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
  kind?: 'parametric' | 'custom';
}

/** Mirrors server/src/services/workbook/workbookQualityGate.ts WorkbookIssue
 *  (deterministic critic — fields we actually render; server may send more). */
interface WorkbookQualityIssue {
  code: string;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  sheet: string;
  cell?: string | null;
  message: string;
  fix?: string;
}

/** Mirrors WorkbookQualityReport — score 0-100, issues[], passed = brak CRITICAL. */
interface WorkbookQualityReport {
  score: number;
  issues: WorkbookQualityIssue[];
  passed: boolean;
}

interface BuildResult {
  id: string;
  title: string;
  fileName: string;
  downloadUrl: string;
  sheetCount: number;
  qualityReport?: WorkbookQualityReport | null;
}

interface Props {
  isPolish: boolean;
  initialTemplateId?: string | null;
  /** Durable generated_workbooks id restored from the URL after a reload. */
  initialWorkbookId?: string | null;
  /** Called after a successful build so the parent can refresh the Recent list. */
  onBuilt?: (result: BuildResult) => void;
}

/** Percent params store a FRACTION (0.08); we show whole percents (8) in the form. */
const pctToDisplay = (native: number): number => Math.round(native * 1000) / 10;
const displayToPct = (shown: number): number => shown / 100;

/** Zakresy parametrów (2026-07-23): template min/max come from the registry in
 *  NATIVE units (fractions for percent, same as `default`) — convert them to
 *  the same display scale the input/value already use (×100 for percent,
 *  unchanged otherwise) so both the hint text and the HTML min/max line up
 *  with what the user actually types. */
const getDisplayRange = (p: TemplateParam): { min?: number; max?: number } => {
  if (p.type === 'percent') {
    return {
      min: typeof p.min === 'number' ? pctToDisplay(p.min) : undefined,
      max: typeof p.max === 'number' ? pctToDisplay(p.max) : undefined,
    };
  }
  return { min: p.min, max: p.max };
};

/** Small "zakres: min – max" hint shown next to a field — only when the
 *  template actually defines a bound (many params have none). */
const formatRangeHint = (
  displayMin: number | undefined,
  displayMax: number | undefined,
  isPercent: boolean,
  t: (pl: string, en: string) => string
): string | null => {
  if (displayMin === undefined && displayMax === undefined) return null;
  const suffix = isPercent ? '%' : '';
  const range =
    displayMin !== undefined && displayMax !== undefined
      ? `${displayMin} – ${displayMax}${suffix}`
      : displayMin !== undefined
        ? `≥ ${displayMin}${suffix}`
        : `≤ ${displayMax}${suffix}`;
  return `${t('zakres', 'range')}: ${range}`;
};

/** Inline preview keeps the grid compact — cap rows, offer "show all" like the
 *  full-size KimiWorkspaceShell grid (src/utils/workbookGridPreview.ts consumer). */
const PREVIEW_ROW_CAP = 50;

export const ExceleParametricTemplates: React.FC<Props> = ({
  isPolish,
  initialTemplateId,
  initialWorkbookId,
  onBuilt,
}) => {
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
  // Edytowalna siatka (2026-07-28): SUROWE arkusze z tego samego
  // getWorkbookSchema wołania co gridSheets wyżej — kształt zgodny z
  // `EditableSpreadsheetGrid`'s `sheets` prop (patrz nagłówek pliku).
  const [rawSheets, setRawSheets] = useState<FormulaSheet[] | null>(null);

  // Quality badge (2026-07-23): deterministic critic already computed server-side
  // for every template build — expandable list of issues, collapsed by default.
  const [showQualityIssues, setShowQualityIssues] = useState(false);

  // Saved parameter sets (2026-07-23): localStorage-backed per templateId —
  // see src/utils/exceleTemplatePresets.ts. FE-only, no backend involved.
  const [presets, setPresets] = useState<ExceleTemplatePreset[]>([]);
  const [savingPresetOpen, setSavingPresetOpen] = useState(false);
  const [presetName, setPresetName] = useState('');

  const t = useCallback((pl: string, en: string) => (isPolish ? pl : en), [isPolish]);

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
    setRawSheets(null);
    setGridError(null);
    setGridLoading(false);
    setShowQualityIssues(false);
    setPresets(readTemplatePresets(tpl.id));
    setSavingPresetOpen(false);
    setPresetName('');
    setSelected(tpl);
  }, []);

  const initialSelectionApplied = useRef<string | null>(null);
  useEffect(() => {
    const id = String(initialTemplateId || '').trim();
    if (!id || initialSelectionApplied.current === id || templates.length === 0) return;
    const match = templates.find((template) => template.id === id);
    if (!match) return;
    initialSelectionApplied.current = id;
    openForm(match);
  }, [initialTemplateId, openForm, templates]);

  const reopenedWorkbook = useRef<string | null>(null);
  useEffect(() => {
    const id = String(initialWorkbookId || '').trim();
    if (!id || reopenedWorkbook.current === id) return;
    if (result?.id === id) {
      reopenedWorkbook.current = id;
      return;
    }
    const templateId = String(initialTemplateId || '').trim();
    if (templateId && selected?.id !== templateId) return;
    reopenedWorkbook.current = id;
    let alive = true;
    setGridLoading(true);
    setGridError(null);
    Promise.all([Api.getWorkbook(id), Api.getWorkbookSchema(id)])
      .then(([metadata, schema]) => {
        if (!alive) return;
        const sheets = Array.isArray(schema?.sheets) ? schema.sheets : [];
        setResult({
          id,
          title: metadata?.title || schema?.title || 'Workbook',
          fileName: metadata?.file_name || 'workbook.xlsx',
          downloadUrl: metadata?.downloadUrl || `/api/workbook/${id}/download`,
          sheetCount: sheets.length,
          qualityReport: metadata?.qualityReport ?? null,
        });
        setGridSheets(buildWorkbookGridSheets(sheets));
        setRawSheets(sheets as FormulaSheet[]);
        setActiveSheet(0);
        setShowAllRows(false);
      })
      .catch((err) => {
        if (!alive) return;
        console.warn('[ExceleParametricTemplates] Failed to reopen workbook:', err);
        setGridError(t('Nie udało się ponownie otworzyć skoroszytu.', 'Failed to reopen workbook.'));
      })
      .finally(() => {
        if (alive) setGridLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [initialTemplateId, initialWorkbookId, result?.id, selected?.id, t]);

  // Mini bar chart (2026-07-23): poglądowa wizualizacja trendu/porównania nad
  // siatką — zawsze z PIERWSZEGO arkusza (gridSheets[0]), niezależnie od
  // aktywnej zakładki (activeSheet). Graceful: null gdy żaden wiersz nie ma
  // ≥2 liczbowych komórek wartości (same formuły/tekst) — patrz MiniBarChart.tsx.
  const chartSeries = useMemo(() => findBarChartSeries(gridSheets?.[0] ?? null), [gridSheets]);

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

  // Zakresy parametrów (2026-07-23): soft client-side validation against the
  // template's own min/max (in DISPLAY scale — see getDisplayRange) so an
  // out-of-range value is caught before the build call instead of surfacing
  // only as a zod rejection from the server. Empty fields are exempt (server
  // falls back to the template default), same as handleBuild's own omission
  // logic below.
  const outOfRangeParams = useMemo(() => {
    if (!selected) return [] as { name: string; label: string }[];
    const bad: { name: string; label: string }[] = [];
    for (const p of selected.params) {
      if (p.type === 'text' || p.type === 'enum') continue;
      const { min, max } = getDisplayRange(p);
      if (min === undefined && max === undefined) continue;
      const raw = values[p.name];
      if (raw === '' || raw === undefined || raw === null) continue;
      const num = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(num)) continue;
      if ((min !== undefined && num < min) || (max !== undefined && num > max)) {
        bad.push({ name: p.name, label: p.label });
      }
    }
    return bad;
  }, [selected, values]);

  const outOfRangeNames = useMemo(
    () => new Set(outOfRangeParams.map((o) => o.name)),
    [outOfRangeParams]
  );

  const setValue = useCallback((name: string, raw: string, type: ParamType) => {
    setValues((prev) => {
      if (type === 'text' || type === 'enum') return { ...prev, [name]: raw };
      // numeric-ish: keep the raw string while editing; coerce on submit.
      return { ...prev, [name]: raw };
    });
  }, []);

  const handleSavePreset = useCallback(() => {
    if (!selected) return;
    const name = presetName.trim();
    if (!name) return;
    const updated = saveTemplatePreset(selected.id, name, values);
    setPresets(updated);
    setPresetName('');
    setSavingPresetOpen(false);
    toast.success(t('Zapisano zestaw parametrów', 'Parameter set saved'));
  }, [selected, presetName, values, t]);

  const handleLoadPreset = useCallback(
    (preset: ExceleTemplatePreset) => {
      setValues({ ...preset.values });
      toast.success(t(`Wczytano zestaw „${preset.name}"`, `Loaded parameter set "${preset.name}"`));
    },
    [t]
  );

  const handleDeletePreset = useCallback(
    (preset: ExceleTemplatePreset, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!selected) return;
      const updated = deleteTemplatePreset(selected.id, preset.id);
      setPresets(updated);
    },
    [selected]
  );

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
        qualityReport: res?.qualityReport ?? null,
      };
      setResult(built);
      setShowQualityIssues(false);
      toast.success(t('Skoroszyt zbudowany', 'Workbook built'));
      onBuilt?.(built);

      // Load the real cell/formula grid so the build result shows the actual
      // content inline instead of only a download link (same shape/endpoint as
      // the B3 KimiWorkspaceShell xlsx preview: GET /api/workbook/:id/schema).
      if (built.id) {
        setGridSheets(null);
        setRawSheets(null);
        setGridError(null);
        setActiveSheet(0);
        setShowAllRows(false);
        setGridLoading(true);
        Api.getWorkbookSchema(built.id)
          .then((schema) => {
            setGridSheets(buildWorkbookGridSheets(schema?.sheets));
            // Edytowalna siatka (2026-07-28): te same surowe arkusze co
            // `rawSheets` w ExceleView.tsx's reopen — patrz nagłówek pliku.
            setRawSheets((schema?.sheets ?? null) as FormulaSheet[] | null);
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
              <a
                href={`/excele?artifactId=${encodeURIComponent(result.id)}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-c-border text-c-text-secondary text-xs font-medium hover:bg-c-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                <FileSpreadsheet size={14} />
                {t('Otwórz w Arkuszach', 'Open in Sheets')}
              </a>
              <button
                onClick={() => {
                  setResult(null);
                  setGridSheets(null);
                  setRawSheets(null);
                  setGridError(null);
                  setGridLoading(false);
                  setShowQualityIssues(false);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-c-border text-c-text-secondary text-xs font-medium hover:bg-c-surface transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {t('Zbuduj ponownie', 'Build again')}
              </button>
            </div>

            {/* Quality badge — nieblokujący, oparty na już liczonym critiqueWorkbook
                (server-side, template-path). Nie gate'uje pobrania/exportu — czysta
                informacja, jak wzorzec deck-critic (warning-banner). */}
            {result.qualityReport ? (
              <div className="mt-3">
                {result.qualityReport.issues.length === 0 ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-c-success/10 text-c-success text-xs font-medium">
                    <CheckCircle2 size={13} />
                    {t('Model zweryfikowany ✓ (0 uwag)', 'Model verified ✓ (0 notes)')}
                  </div>
                ) : (
                  <div>
                    <button
                      type="button"
                      onClick={() => setShowQualityIssues((v) => !v)}
                      aria-expanded={showQualityIssues}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                        result.qualityReport.passed
                          ? 'bg-c-warning/10 text-c-warning hover:bg-c-warning/20'
                          : 'bg-c-danger/10 text-c-danger hover:bg-c-danger/20'
                      }`}
                    >
                      <AlertTriangle size={13} />
                      {t(
                        `${result.qualityReport.issues.length} uwag (wynik ${result.qualityReport.score}/100)`,
                        `${result.qualityReport.issues.length} note${result.qualityReport.issues.length === 1 ? '' : 's'} (score ${result.qualityReport.score}/100)`
                      )}
                      <ChevronDown
                        size={12}
                        className={`transition-transform ${showQualityIssues ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {showQualityIssues && (
                      <ul className="mt-2 space-y-1.5">
                        {result.qualityReport.issues.map((iss, i) => (
                          <li
                            key={`${iss.code}-${i}`}
                            className="flex items-start gap-2 rounded-lg border border-c-border-subtle bg-c-surface px-2.5 py-1.5 text-xs"
                          >
                            <span
                              className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                iss.severity === 'CRITICAL'
                                  ? 'bg-c-danger/10 text-c-danger'
                                  : iss.severity === 'MAJOR'
                                    ? 'bg-c-warning/10 text-c-warning'
                                    : 'bg-c-surface-raised text-c-text-secondary'
                              }`}
                            >
                              {iss.severity}
                            </span>
                            <span className="text-c-text-secondary">
                              <span className="font-medium text-c-text">
                                {iss.sheet}
                                {iss.cell ? `!${iss.cell}` : ''}
                              </span>{' '}
                              — {iss.message}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            ) : null}

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
                  {chartSeries && <MiniBarChart series={chartSeries} />}
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
                          {sheet.name || `Sheet ${i + 1}`}
                        </button>
                      ))}
                    </div>
                  )}
                  {(() => {
                    // Edytowalna siatka (2026-07-28): za ff_excele_edit (domyślnie
                    // ON) i tylko gdy mamy surowe arkusze z realnymi kolumnami —
                    // patrz nagłówek pliku. Kill-switch/brak kolumn → stary,
                    // tylko-do-odczytu render niżej, zero regresji.
                    const activeRaw = rawSheets?.[activeSheet] ?? rawSheets?.[0] ?? null;
                    const canEdit =
                      isExceleEditEnabled() &&
                      !!result?.id &&
                      !!rawSheets &&
                      rawSheets.length > 0 &&
                      (activeRaw?.columns?.length ?? 0) > 0;
                    if (canEdit) {
                      return (
                        <div className="[&>div]:rounded-none [&>div]:border-0 [&>div]:border-t [&>div]:border-c-border-subtle">
                          <EditableSpreadsheetGrid
                            workbookId={result!.id}
                            sheets={rawSheets as FormulaSheet[]}
                            activeSheetIndex={activeSheet}
                          />
                        </div>
                      );
                    }

                    const sheetData = gridSheets[activeSheet] || gridSheets[0];
                    if (!sheetData || sheetData.columns.length === 0) return null;
                    const visibleRows = showAllRows
                      ? sheetData.rows
                      : sheetData.rows.slice(0, PREVIEW_ROW_CAP);
                    return (
                      <>
                        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                          <table
                            className="w-full text-xs" /* §27-exempt: podgląd arkusza Excel (kill-switch/brak kolumn fallback), nie lista rekordów — docs/ui-standards/DOKTRYNA_TABELA_NIE_EXCEL.md */
                          >
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
                                ? t(
                                    'Pokazano wszystkie {{n}} wierszy',
                                    'Showing all {{n}} rows'
                                  ).replace('{{n}}', String(sheetData.rows.length))
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
            {presets.length > 0 && (
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-2">
                  {t('Zapisane zestawy', 'Saved sets')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleLoadPreset(preset)}
                      title={t('Wczytaj ten zestaw parametrów', 'Load this parameter set')}
                      className="group inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full border border-c-border-subtle bg-c-surface-raised text-xs font-medium text-c-text hover:border-c-border-strong transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                    >
                      <Bookmark size={12} className="text-c-text-secondary shrink-0" />
                      {preset.name}
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => handleDeletePreset(preset, e)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleDeletePreset(preset, e as unknown as React.MouseEvent);
                          }
                        }}
                        title={t('Usuń zestaw', 'Delete set')}
                        className="shrink-0 p-0.5 rounded-full text-c-text-muted hover:text-c-danger hover:bg-c-danger/10 transition-colors"
                      >
                        <Trash2 size={11} />
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-5">
              {groups.map(({ group, params }) => (
                <div key={group}>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted mb-2">
                    {group}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {params.map((p) => {
                      const { min: displayMin, max: displayMax } = getDisplayRange(p);
                      const rangeHint = formatRangeHint(
                        displayMin,
                        displayMax,
                        p.type === 'percent',
                        t
                      );
                      const isOutOfRange = outOfRangeNames.has(p.name);
                      return (
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
                              min={displayMin}
                              max={displayMax}
                              value={String(values[p.name] ?? '')}
                              onChange={(e) => setValue(p.name, e.target.value, p.type)}
                              aria-invalid={isOutOfRange}
                              className={`px-2.5 py-1.5 rounded-lg border bg-c-surface text-sm text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                                isOutOfRange ? 'border-c-warning' : 'border-c-border'
                              }`}
                            />
                          )}
                          {rangeHint ? (
                            <span
                              className={`text-[11px] ${
                                isOutOfRange ? 'text-c-warning font-medium' : 'text-c-text-muted'
                              }`}
                            >
                              {rangeHint}
                            </span>
                          ) : null}
                          {p.help ? (
                            <span className="text-[11px] text-c-text-muted">{p.help}</span>
                          ) : null}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-5">
              <button
                onClick={handleBuild}
                disabled={building || outOfRangeParams.length > 0}
                title={
                  outOfRangeParams.length > 0
                    ? t(
                        'Popraw wartości poza dozwolonym zakresem, aby zbudować skoroszyt',
                        'Fix the out-of-range values to build the workbook'
                      )
                    : undefined
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-c-text text-c-bg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {building ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <FileSpreadsheet size={15} />
                )}
                {t('Zbuduj skoroszyt', 'Build workbook')}
              </button>

              {!savingPresetOpen ? (
                <button
                  type="button"
                  onClick={() => setSavingPresetOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-c-border text-c-text-secondary text-xs font-medium hover:bg-c-surface-raised transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                >
                  <BookmarkPlus size={14} />
                  {t('Zapisz zestaw parametrów', 'Save parameter set')}
                </button>
              ) : (
                <div className="inline-flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    value={presetName}
                    onChange={(e) => setPresetName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePreset();
                      if (e.key === 'Escape') {
                        setSavingPresetOpen(false);
                        setPresetName('');
                      }
                    }}
                    placeholder={t('Nazwa zestawu…', 'Set name…')}
                    className="px-2.5 py-1.5 rounded-lg border border-c-border bg-c-surface text-xs text-c-text focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus w-40"
                  />
                  <button
                    type="button"
                    onClick={handleSavePreset}
                    disabled={!presetName.trim()}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-c-text text-c-bg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {t('Zapisz', 'Save')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSavingPresetOpen(false);
                      setPresetName('');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-c-border text-c-text-secondary text-xs font-medium hover:bg-c-surface-raised transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
                  >
                    {t('Anuluj', 'Cancel')}
                  </button>
                </div>
              )}
            </div>

            {outOfRangeParams.length > 0 && (
              <p className="flex items-start gap-1.5 mt-2 text-xs text-c-warning">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                {t(
                  `Poza dozwolonym zakresem: ${outOfRangeParams.map((o) => o.label).join(', ')}. Popraw wartości, aby zbudować skoroszyt.`,
                  `Out of allowed range: ${outOfRangeParams.map((o) => o.label).join(', ')}. Fix the values to build the workbook.`
                )}
              </p>
            )}
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
          {t('Szablony skoroszytów', 'Workbook templates')}
        </h2>
      </div>
      <p className="text-xs text-c-text-secondary mb-3">
        {t(
          'Wybierz model parametryczny lub własny szablon i zbuduj gotowy .xlsx.',
          'Choose a parametric model or your own template and build a ready .xlsx.'
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
              {tpl.kind === 'custom'
                ? t('Własny szablon', 'Custom template')
                : `${tpl.params.length} ${t('parametrów', 'parameters')}`}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
};

export default ExceleParametricTemplates;
