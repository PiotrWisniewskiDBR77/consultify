/**
 * ResultsReportGeneratorDrawer — generator raportu zarządczego uruchamiany z
 * Menu 2 modułu Wyniki (CTA „Nowy raport", DEC-422b/e, 06.09).
 *
 * Słowa właściciela (06.09 16:02): „Dołącz generator raportu zarządczego
 * wymagający wybrania NARZĘDZIA i TYPU raportu — taki generator, jak już mamy
 * gdzieś". Ten generator jest tym samym generatorem co
 * `Reports/Management/ReportGeneratorDrawer.tsx`:
 *   • ten sam endpoint     — POST /api/management-reports/generate
 *   • ta sama lista typów  — `validTypes` z managementReports.routes.ts:43
 *   • ta sama lista źródeł — scope PORTFOLIO | PROJECT (+ /api/projects)
 * ZERO NOWEGO SILNIKA. Nowa jest wyłącznie POWŁOKA: trzy jawne kroki
 * (1. Źródło → 2. Typ → 3. Generuj), polskie napisy i tokeny `c-*`. Powodem
 * osobnego pliku jest pkt 4 zlecenia — sekcja `/reports/management` ma
 * ZOSTAĆ NIETKNIĘTA (przejmuje ją Fala 2, 3.16), więc tamtego drawera (cały
 * po angielsku, na crimsonowej palecie CTA) nie wolno tu przerabiać.
 *
 * ŹRÓDŁA BEZ GENERATORA. Właściciel wymienił jako źródła również narzędzia
 * Wyników (karta wyników KPI / zestaw OKR / analiza ROI). Silnik raportów
 * zarządczych ICH NIE OBSŁUGUJE — `POST /generate` przyjmuje wyłącznie
 * `scope: PORTFOLIO | PROJECT`. Zamiast udawać, że działają, są widoczne i
 * WYSZARZONE z dosłownym powodem („Brak generatora dla tego źródła”).
 */

import { Loader2, X } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

import { SelectField } from '@/components/ui/primitives';
import type { ManagementReportScope, ManagementReportType } from '@/types';

import {
  fetchProjectsForReports,
  generateManagementReport,
  type ManagementReportProject,
} from './managementReportsApi';

/** Krok 1 — źródło. `portfolio`/`project` mapują się na `scope` serwera. */
export type ReportSourceId = 'portfolio' | 'project' | 'kpi_scorecard' | 'okr_set' | 'roi_case';

interface SourceOption {
  id: ReportSourceId;
  pl: string;
  en: string;
  descriptionPl: string;
  descriptionEn: string;
  /** `null` = źródło bez generatora (pozycja wyszarzona). */
  scope: ManagementReportScope | null;
}

export const REPORT_SOURCE_OPTIONS: SourceOption[] = [
  {
    id: 'portfolio',
    pl: 'Portfel (cała organizacja)',
    en: 'Portfolio (whole organization)',
    descriptionPl: 'Wszystkie projekty i inicjatywy organizacji.',
    descriptionEn: 'Every project and initiative in the organization.',
    scope: 'PORTFOLIO',
  },
  {
    id: 'project',
    pl: 'Projekt',
    en: 'Project',
    descriptionPl: 'Jeden wybrany projekt z listy poniżej.',
    descriptionEn: 'One selected project from the list below.',
    scope: 'PROJECT',
  },
  {
    id: 'kpi_scorecard',
    pl: 'Karta wyników KPI',
    en: 'KPI scorecard',
    descriptionPl: 'Brak generatora dla tego źródła',
    descriptionEn: 'No generator for this source',
    scope: null,
  },
  {
    id: 'okr_set',
    pl: 'Zestaw OKR',
    en: 'OKR set',
    descriptionPl: 'Brak generatora dla tego źródła',
    descriptionEn: 'No generator for this source',
    scope: null,
  },
  {
    id: 'roi_case',
    pl: 'Analiza ROI',
    en: 'ROI case',
    descriptionPl: 'Brak generatora dla tego źródła',
    descriptionEn: 'No generator for this source',
    scope: null,
  },
];

interface TypeOption {
  id: ManagementReportType;
  pl: string;
  en: string;
  defaultPeriod: number;
  /** Zakresy, w których serwer potrafi ten typ policzyć. */
  scopes: ManagementReportScope[];
}

export const REPORT_TYPE_OPTIONS: TypeOption[] = [
  {
    id: 'TEAM_MEETING',
    pl: 'Raport ze spotkania zespołu',
    en: 'Team meeting report',
    defaultPeriod: 7,
    scopes: ['PROJECT'],
  },
  {
    id: 'TEAM_WEEKLY',
    pl: 'Raport tygodniowy zespołu',
    en: 'Team weekly report',
    defaultPeriod: 7,
    scopes: ['PROJECT'],
  },
  {
    id: 'STEERING_COMMITTEE',
    pl: 'Raport dla komitetu sterującego',
    en: 'Steering committee report',
    defaultPeriod: 30,
    scopes: ['PORTFOLIO', 'PROJECT'],
  },
  {
    id: 'PORTFOLIO_HEALTH',
    pl: 'Kondycja portfela',
    en: 'Portfolio health',
    defaultPeriod: 30,
    scopes: ['PORTFOLIO'],
  },
  {
    id: 'RAID',
    pl: 'RAID (ryzyka, założenia, problemy, zależności)',
    en: 'RAID (risks, assumptions, issues, dependencies)',
    defaultPeriod: 30,
    scopes: ['PORTFOLIO', 'PROJECT'],
  },
];

const PERIOD_OPTIONS = [
  { value: 7, pl: 'Ostatnie 7 dni', en: 'Last 7 days' },
  { value: 30, pl: 'Ostatnie 30 dni', en: 'Last 30 days' },
  { value: 90, pl: 'Ostatni kwartał (90 dni)', en: 'Last quarter (90 days)' },
];

export interface ResultsReportGeneratorDrawerProps {
  open: boolean;
  isPolish: boolean;
  onClose: () => void;
  onGenerated: (reportId: string) => void;
}

export const ResultsReportGeneratorDrawer: React.FC<ResultsReportGeneratorDrawerProps> = ({
  open,
  isPolish,
  onClose,
  onGenerated,
}) => {
  const [source, setSource] = useState<ReportSourceId | null>(null);
  const [reportType, setReportType] = useState<ManagementReportType | null>(null);
  const [projectId, setProjectId] = useState<string>('');
  const [periodDays, setPeriodDays] = useState(30);
  const [projects, setProjects] = useState<ManagementReportProject[]>([]);
  const [projectsError, setProjectsError] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchProjectsForReports()
      .then((rows) => {
        if (cancelled) return;
        setProjects(rows);
        setProjectsError(false);
      })
      .catch(() => {
        if (!cancelled) setProjectsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const scope = useMemo(
    () => REPORT_SOURCE_OPTIONS.find((option) => option.id === source)?.scope ?? null,
    [source]
  );

  const handleSourceChange = (next: SourceOption) => {
    if (!next.scope) return; // źródło bez generatora — nieklikalne
    setSource(next.id);
    if (next.scope !== 'PROJECT') setProjectId('');
    // Typ, którego nowe źródło nie obsługuje, znika z wyboru — użytkownik nie
    // może wysłać kombinacji, którą serwer odrzuci.
    setReportType((current) => {
      if (!current) return null;
      const option = REPORT_TYPE_OPTIONS.find((o) => o.id === current);
      return option && option.scopes.includes(next.scope!) ? current : null;
    });
  };

  const handleTypeChange = (option: TypeOption) => {
    if (!scope || !option.scopes.includes(scope)) return;
    setReportType(option.id);
    setPeriodDays(option.defaultPeriod);
  };

  const canGenerate =
    !!scope && !!reportType && (scope !== 'PROJECT' || !!projectId) && !generating;

  const handleGenerate = useCallback(async () => {
    if (!scope || !reportType) return;
    setGenerating(true);
    try {
      const created = await generateManagementReport({
        reportType,
        scope,
        projectId: projectId || undefined,
        periodDays,
      });
      if (created?.id) onGenerated(created.id);
      else
        toast.error(
          isPolish ? 'Serwer nie zwrócił raportu.' : 'The server returned no report.'
        );
    } catch (error: any) {
      toast.error(
        error?.message ||
          (isPolish ? 'Nie udało się wygenerować raportu' : 'Report generation failed')
      );
    } finally {
      setGenerating(false);
    }
  }, [scope, reportType, projectId, periodDays, onGenerated, isPolish]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-overlay overflow-hidden" data-testid="results-report-generator">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isPolish ? 'Nowy raport zarządczy' : 'New management report'}
        className="absolute right-0 top-0 flex h-full w-full max-w-xl flex-col border-l border-[color:var(--c-border-subtle)] bg-[color:var(--c-surface)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[color:var(--c-border-subtle)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-c-text">
              {isPolish ? 'Nowy raport zarządczy' : 'New management report'}
            </h2>
            <p className="text-sm text-c-text-muted">
              {isPolish
                ? 'Wybierz źródło i typ raportu, potem wygeneruj.'
                : 'Pick a source and a report type, then generate.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={isPolish ? 'Zamknij' : 'Close'}
            className="rounded-token-md p-2 text-c-text-muted hover:bg-[color:var(--c-surface-raised)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* KROK 1 — ŹRÓDŁO */}
          <section data-testid="results-report-generator-step-source">
            <h3 className="mb-3 text-sm font-semibold text-c-text">
              {isPolish ? '1. Źródło' : '1. Source'}
            </h3>
            <div className="space-y-2">
              {REPORT_SOURCE_OPTIONS.map((option) => {
                const unavailable = !option.scope;
                const selected = source === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={unavailable}
                    aria-pressed={selected}
                    title={
                      unavailable
                        ? isPolish
                          ? 'Brak generatora dla tego źródła'
                          : 'No generator for this source'
                        : undefined
                    }
                    onClick={() => handleSourceChange(option)}
                    data-testid={`results-report-source-${option.id}`}
                    className={`w-full rounded-token-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                      selected
                        ? 'border-[color:var(--c-text)] bg-[color:var(--c-surface-raised)]'
                        : 'border-[color:var(--c-border-subtle)] bg-[color:var(--c-surface)]'
                    } ${unavailable ? 'cursor-not-allowed opacity-50' : 'hover:bg-[color:var(--c-surface-raised)]'}`}
                  >
                    <span className="block text-sm font-medium text-c-text">
                      {isPolish ? option.pl : option.en}
                    </span>
                    <span className="block text-xs text-c-text-muted">
                      {isPolish ? option.descriptionPl : option.descriptionEn}
                    </span>
                  </button>
                );
              })}
            </div>
            {scope === 'PROJECT' ? (
              <div className="mt-3">
                <SelectField
                  id="results-report-project"
                  label={isPolish ? 'Wybierz projekt' : 'Select project'}
                  value={projectId}
                  onChange={setProjectId}
                  placeholder={isPolish ? 'Wskaż projekt…' : 'Choose a project…'}
                  options={projects.map((project) => ({
                    value: project.id,
                    label: project.name,
                  }))}
                  error={
                    projectsError
                      ? isPolish
                        ? 'Nie udało się wczytać listy projektów.'
                        : 'Failed to load the project list.'
                      : undefined
                  }
                />
              </div>
            ) : null}
          </section>

          {/* KROK 2 — TYP RAPORTU */}
          <section data-testid="results-report-generator-step-type">
            <h3 className="mb-3 text-sm font-semibold text-c-text">
              {isPolish ? '2. Typ raportu' : '2. Report type'}
            </h3>
            <div className="space-y-2">
              {REPORT_TYPE_OPTIONS.map((option) => {
                const unavailable = !scope || !option.scopes.includes(scope);
                const selected = reportType === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    disabled={unavailable}
                    aria-pressed={selected}
                    title={
                      !scope
                        ? isPolish
                          ? 'Najpierw wybierz źródło'
                          : 'Pick a source first'
                        : unavailable
                          ? isPolish
                            ? 'Ten typ nie jest dostępny dla wybranego źródła'
                            : 'This type is unavailable for the selected source'
                          : undefined
                    }
                    onClick={() => handleTypeChange(option)}
                    data-testid={`results-report-type-${option.id}`}
                    className={`w-full rounded-token-md border px-3 py-2.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                      selected
                        ? 'border-[color:var(--c-text)] bg-[color:var(--c-surface-raised)] font-medium'
                        : 'border-[color:var(--c-border-subtle)] bg-[color:var(--c-surface)]'
                    } ${unavailable ? 'cursor-not-allowed opacity-50' : 'hover:bg-[color:var(--c-surface-raised)]'} text-c-text`}
                  >
                    {isPolish ? option.pl : option.en}
                  </button>
                );
              })}
            </div>
            <div className="mt-3">
              <SelectField
                id="results-report-period"
                label={isPolish ? 'Okres raportowania' : 'Reporting period'}
                value={String(periodDays)}
                onChange={(value) => setPeriodDays(Number(value))}
                options={PERIOD_OPTIONS.map((option) => ({
                  value: String(option.value),
                  label: isPolish ? option.pl : option.en,
                }))}
              />
            </div>
          </section>
        </div>

        {/* KROK 3 — GENERUJ */}
        <div className="border-t border-[color:var(--c-border-subtle)] px-6 py-4">
          <button
            type="button"
            onClick={handleGenerate}
            disabled={!canGenerate}
            data-testid="results-report-generator-submit"
            className="flex w-full items-center justify-center gap-2 rounded-token-md bg-[color:var(--c-text)] px-6 py-3 font-semibold text-[color:var(--c-bg)] transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {generating ? <Loader2 size={18} className="animate-spin" /> : null}
            <span>
              {isPolish ? '3. Generuj raport' : '3. Generate report'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResultsReportGeneratorDrawer;
