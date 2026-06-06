/**
 * AuditsHub — lists audit programs and shows a simple per-program dashboard
 * (owner flagged direction ⭐⭐⭐, audit #19d / #19e). Mounted at /audits.
 *
 * What it does (works end-to-end):
 *  - Lists the org's audit programs from GET /api/audit/programs.
 *  - Client-side filter by name/objective + status filter.
 *  - "New audit program" + quick "ISO 27001" launcher open the wizard.
 *  - Selecting a program shows a dashboard panel: status, counts (templates,
 *    assignees), and a completion indicator derived from config.
 *  - Delete a program.
 *
 * Scale note (#19e): for the 400-assignee scale the owner targets, this list
 * would move to server-side pagination + saved views + batch-AI summaries. For
 * the MVP we use a clean client-side filtered list. The TODO markers below pin
 * exactly where those upgrades slot in.
 *
 * Completion (#19e): a true completion % requires joining to the underlying
 * interview sessions/assignments. The MVP shows the planned counts and a
 * "surveys generated" flag from config; the real rollup is a documented TODO.
 *
 * Self-contained page (rendered as a standalone route): includes its own
 * header/back affordance so it works whether or not it sits inside the app shell.
 * Bilingual (pl/en).
 */

import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import {
  type AuditProgram,
  type AuditProgramStatus,
  deleteProgram,
  generateSurveys,
  getCompletion,
  listPrograms,
  type ProgramCompletion,
} from './auditApi';
import { AuditOrchestratorWizard } from './AuditOrchestratorWizard';
import { getPresetById } from './auditPresets';

const PAGE_SIZE = 50;

const STATUS_FILTERS: Array<AuditProgramStatus | 'all'> = [
  'all',
  'draft',
  'active',
  'completed',
  'archived',
];

const statusClasses: Record<AuditProgramStatus, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-slate-300',
  active: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  completed: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  archived: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
};

export const AuditsHub: React.FC = () => {
  const { i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const tr = (en: string, pl: string) => (isPolish ? pl : en);
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AuditProgramStatus | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPresetId, setWizardPresetId] = useState<string | null>(null);

  // Load the first page (resets the list). Used on mount + after mutations.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPrograms({ limit: PAGE_SIZE, offset: 0 });
      setPrograms(res.programs);
      setTotal(res.total);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Failed to load programs', 'Nie udało się załadować programów')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Append the next page server-side (#19e pagination).
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const res = await listPrograms({ limit: PAGE_SIZE, offset: programs.length });
      setPrograms((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.programs.filter((p) => !seen.has(p.id))];
      });
      setTotal(res.total);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Failed to load programs', 'Nie udało się załadować programów')
      );
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs.length]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (s: AuditProgramStatus | 'all'): string => {
    const map: Record<AuditProgramStatus | 'all', string> = {
      all: tr('All', 'Wszystkie'),
      draft: tr('Draft', 'Szkic'),
      active: tr('Active', 'Aktywny'),
      completed: tr('Completed', 'Zakończony'),
      archived: tr('Archived', 'Zarchiwizowany'),
    };
    return map[s];
  };

  // TODO(#19e): replace client-side filtering with server-side pagination +
  // saved views once programs scale past a few hundred.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programs.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.objective ?? '').toLowerCase().includes(q);
    });
  }, [programs, query, statusFilter]);

  const selected = useMemo(
    () => programs.find((p) => p.id === selectedId) ?? null,
    [programs, selectedId]
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm(tr('Delete this audit program?', 'Usunąć ten program audytu?'))) return;
    try {
      await deleteProgram(id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : tr('Failed to delete', 'Nie udało się usunąć'));
    }
  };

  const handleGenerate = async (program: AuditProgram) => {
    const templateCount = program.config.templateIds?.length ?? 0;
    const assigneeCount = program.config.assigneeIds?.length ?? 0;
    const pairs = templateCount * assigneeCount;
    if (pairs === 0) {
      setError(
        tr(
          'Pick at least one template and one assignee before generating surveys.',
          'Wybierz co najmniej jeden szablon i jedną osobę przed wygenerowaniem ankiet.'
        )
      );
      return;
    }
    if (
      !window.confirm(
        tr(
          `Generate ${pairs} survey assignment(s) (${templateCount} templates × ${assigneeCount} assignees)?`,
          `Wygenerować ${pairs} przydziałów ankiet (${templateCount} szablonów × ${assigneeCount} osób)?`
        )
      )
    ) {
      return;
    }
    setGeneratingId(program.id);
    setError(null);
    try {
      const res = await generateSurveys(program.id);
      if (res.alreadyGenerated) {
        setError(tr('Surveys were already generated.', 'Ankiety zostały już wygenerowane.'));
      } else if (res.failed > 0) {
        setError(
          tr(
            `Generated ${res.created} of ${res.requested}; ${res.failed} failed.`,
            `Wygenerowano ${res.created} z ${res.requested}; ${res.failed} nie powiodło się.`
          )
        );
      }
      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr('Failed to generate surveys', 'Nie udało się wygenerować ankiet')
      );
    } finally {
      setGeneratingId(null);
    }
  };

  const openWizard = (presetId: string | null) => {
    setWizardPresetId(presetId);
    setWizardOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-navy-950">
      {/* Page header */}
      <div className="border-b border-slate-200 bg-white px-6 py-4 dark:border-white/[0.08] dark:bg-navy-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              aria-label={tr('Back', 'Wstecz')}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary-500" />
              <div>
                <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {tr('Audits', 'Audyty')}
                </h1>
                <p className="text-xs text-slate-500">
                  {tr(
                    'Orchestrate multi-template, multi-assignee audit programs.',
                    'Orkiestruj programy audytowe z wieloma szablonami i osobami.'
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openWizard('iso27001')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-white/[0.08] dark:text-slate-200 dark:hover:bg-white/[0.06]"
            >
              <ShieldCheck className="h-4 w-4" />
              {tr('ISO 27001', 'ISO 27001')}
            </button>
            <button
              type="button"
              onClick={() => openWizard(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600"
            >
              <Plus className="h-4 w-4" />
              {tr('New audit program', 'Nowy program audytu')}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-6">
        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tr('Search programs…', 'Szukaj programów…')}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/40 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-white"
            />
          </div>
          <div className="flex items-center gap-1">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === s
                    ? 'bg-primary-500 text-white'
                    : 'bg-white text-slate-500 hover:bg-slate-100 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]'
                }`}
              >
                {statusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-400/30 bg-red-400/5 p-3 text-sm text-red-600 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* List */}
          <div className="lg:col-span-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-12 text-sm text-slate-400 dark:border-white/[0.08] dark:bg-navy-900">
                <Loader2 className="h-4 w-4 animate-spin" />
                {tr('Loading…', 'Ładowanie…')}
              </div>
            ) : filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center dark:border-white/[0.1] dark:bg-navy-900">
                <ClipboardList className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                <p className="text-sm text-slate-500">
                  {programs.length === 0
                    ? tr('No audit programs yet.', 'Brak programów audytu.')
                    : tr(
                        'No programs match your filters.',
                        'Brak programów pasujących do filtrów.'
                      )}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {filtered.map((p) => {
                  const templateCount = p.config.templateIds?.length ?? 0;
                  const assigneeCount = p.config.assigneeIds?.length ?? 0;
                  const generated = p.config.surveysGenerated === true;
                  const generatedCount = p.config.generation?.created ?? 0;
                  const pairs = templateCount * assigneeCount;
                  const isGenerating = generatingId === p.id;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(p.id)}
                        className={`w-full rounded-xl border bg-white p-4 text-left transition-colors dark:bg-navy-900 ${
                          selectedId === p.id
                            ? 'border-primary-500'
                            : 'border-slate-200 hover:border-slate-300 dark:border-white/[0.08]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium text-slate-900 dark:text-white">
                                {p.name}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClasses[p.status]}`}
                              >
                                {statusLabel(p.status)}
                              </span>
                            </div>
                            {p.objective && (
                              <p className="mt-1 line-clamp-1 text-xs text-slate-500">
                                {p.objective}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                              <span className="inline-flex items-center gap-1">
                                <ClipboardList className="h-3.5 w-3.5" />
                                {templateCount} {tr('templates', 'szablonów')}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <Users className="h-3.5 w-3.5" />
                                {assigneeCount} {tr('assignees', 'osób')}
                              </span>
                              {generated && (
                                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                  <Send className="h-3.5 w-3.5" />
                                  {generatedCount} {tr('surveys', 'ankiet')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span
                              role="button"
                              tabIndex={generated || isGenerating ? -1 : 0}
                              aria-disabled={generated || isGenerating}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (generated || isGenerating) return;
                                void handleGenerate(p);
                              }}
                              onKeyDown={(e) => {
                                if (
                                  (e.key === 'Enter' || e.key === ' ') &&
                                  !generated &&
                                  !isGenerating
                                ) {
                                  e.stopPropagation();
                                  void handleGenerate(p);
                                }
                              }}
                              aria-label={
                                generated
                                  ? tr('Surveys generated', 'Ankiety wygenerowane')
                                  : tr('Generate surveys', 'Generuj ankiety')
                              }
                              title={
                                generated
                                  ? tr('Surveys already generated', 'Ankiety już wygenerowane')
                                  : tr(`Generate ${pairs} survey(s)`, `Generuj ${pairs} ankiet`)
                              }
                              className={`rounded-lg p-1.5 ${
                                generated || isGenerating
                                  ? 'cursor-not-allowed text-slate-200 dark:text-white/20'
                                  : 'text-slate-300 hover:bg-primary-50 hover:text-primary-500 dark:hover:bg-primary-500/10'
                              }`}
                            >
                              {isGenerating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </span>
                            <span
                              role="button"
                              tabIndex={0}
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDelete(p.id);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.stopPropagation();
                                  void handleDelete(p.id);
                                }
                              }}
                              aria-label={tr('Delete', 'Usuń')}
                              className="rounded-lg p-1.5 text-slate-300 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </span>
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {/* Load more (#19e server-side pagination). Only when more rows exist
                AND the user isn't narrowing the current page via search/status. */}
            {!loading && programs.length < total && (
              <div className="mt-3 flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={() => void loadMore()}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-60 dark:border-white/[0.08] dark:text-slate-300 dark:hover:bg-white/[0.06]"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tr('Load more', 'Załaduj więcej')}
                </button>
                <span className="text-[11px] text-slate-400">
                  {tr(
                    `Showing ${programs.length} of ${total}`,
                    `Pokazano ${programs.length} z ${total}`
                  )}
                </span>
              </div>
            )}
          </div>

          {/* Dashboard panel */}
          <div className="lg:col-span-1">
            {selected ? (
              <ProgramDashboard program={selected} isPolish={isPolish} tr={tr} />
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400 dark:border-white/[0.1] dark:bg-navy-900">
                {tr(
                  'Select a program to see its dashboard.',
                  'Wybierz program, aby zobaczyć panel.'
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AuditOrchestratorWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        initialPresetId={wizardPresetId}
        onCreated={(program) => {
          setWizardOpen(false);
          setSelectedId(program.id);
          void load();
        }}
      />
    </div>
  );
};

// ---------------------------------------------------------------------------
// Per-program dashboard (#19d/#19e)
// ---------------------------------------------------------------------------

const ProgramDashboard: React.FC<{
  program: AuditProgram;
  isPolish: boolean;
  tr: (en: string, pl: string) => string;
}> = ({ program, isPolish, tr }) => {
  const templateCount = program.config.templateIds?.length ?? 0;
  const assigneeCount = program.config.assigneeIds?.length ?? 0;
  const surveysGenerated = program.config.surveysGenerated === true;
  const preset = getPresetById(program.preset);
  const plan = Array.isArray(program.config.plan) ? program.config.plan : [];

  // Real completion rollup (#19e): fetch when the program is generated.
  const [completion, setCompletion] = useState<ProgramCompletion | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  useEffect(() => {
    if (!surveysGenerated) {
      setCompletion(null);
      return;
    }
    let cancelled = false;
    setCompletionLoading(true);
    getCompletion(program.id)
      .then((c) => {
        if (!cancelled) setCompletion(c);
      })
      .catch(() => {
        if (!cancelled) setCompletion(null);
      })
      .finally(() => {
        if (!cancelled) setCompletionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [program.id, surveysGenerated]);

  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-white/[0.08] dark:bg-navy-900">
      <div>
        <h3 className="font-semibold text-slate-900 dark:text-white">{program.name}</h3>
        {preset && (
          <p className="text-xs text-primary-600 dark:text-primary-300">
            {isPolish ? preset.label.pl : preset.label.en}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Stat label={tr('Templates', 'Szablony')} value={templateCount} />
        <Stat label={tr('Assignees', 'Przypisani')} value={assigneeCount} />
      </div>

      {/* Completion (#19e): real rollup over the program's generated interview
          assignments (submitted/approved/completed vs total). */}
      <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {tr('Completion', 'Postęp')}
          </span>
          {surveysGenerated && completion && (
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {completion.percent}%
            </span>
          )}
        </div>
        {!surveysGenerated ? (
          <p className="text-xs text-slate-500">
            {tr(
              'Not generated. Use "Generate surveys" to fan out templates × assignees into interview assignments.',
              'Niewygenerowane. Użyj „Generuj ankiety”, aby rozłożyć szablony × osoby na przydziały wywiadów.'
            )}
          </p>
        ) : completionLoading ? (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {tr('Loading…', 'Ładowanie…')}
          </div>
        ) : completion ? (
          <div className="space-y-1.5">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-white/[0.08]">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${completion.percent}%` }}
              />
            </div>
            <p className="text-xs text-slate-500">
              {tr(
                `${completion.done} of ${completion.total} surveys completed`,
                `${completion.done} z ${completion.total} ankiet ukończonych`
              )}
            </p>
          </div>
        ) : (
          <p className="text-xs text-slate-500">
            {tr('Completion unavailable.', 'Postęp niedostępny.')}
          </p>
        )}
      </div>

      {plan.length > 0 && (
        <div>
          <div className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            {tr('Suggested plan', 'Sugerowany plan')}
          </div>
          <ul className="space-y-1">
            {plan.map((row, i) => (
              <li key={(row?.areaKey as string) ?? i} className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">
                  {String(row?.area ?? '')}
                </span>
                <span className="text-slate-400">{String(row?.suggestedRole ?? '')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/[0.04]">
    <div className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</div>
    <div className="text-xs text-slate-500">{label}</div>
  </div>
);

export default AuditsHub;
