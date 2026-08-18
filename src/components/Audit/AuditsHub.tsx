/**
 * AuditsHub — lists audit programs and shows a per-program preview (owner
 * flagged direction ⭐⭐⭐, audit #19d / #19e). Mounted at /audits.
 *
 * Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7): the list is
 * StandardTable + StandardPreview, 1:1 with the Assessment 'list' / Results
 * KPI catalog adopters. Kebab (canon A6): Open · Generate surveys · Open
 * preview/Edit/Archive (Edit gated by isAuditProgramEditEnabled() — real
 * backend, no wired screen yet; Archive has no backend at all — both shown
 * disabled with a note, never hidden) · Delete (destructive, always last).
 *
 * What it does (works end-to-end):
 *  - Lists the org's audit programs from GET /api/audit/programs.
 *  - Server-side search by name/objective + status filter (L-02).
 *  - "New audit program" + quick "ISO 27001" launcher open the wizard.
 *  - Selecting a program shows a StandardPreview: status, objective, counts
 *    (templates, assignees), and a completion % derived from the real rollup.
 *  - Delete a program (row kebab, preview action, or Menu 3 bulk bar).
 *
 * Scale note (#19e): for the 400-assignee scale the owner targets, this list
 * would move to server-side pagination + saved views + batch-AI summaries. For
 * the MVP we use a clean client-side filtered list. The TODO markers below pin
 * exactly where those upgrades slot in.
 *
 * Self-contained page (rendered as a standalone route): includes its own
 * header/back affordance so it works whether or not it sits inside the app shell.
 * Bilingual (pl/en).
 */

import {
  AlertTriangle,
  ClipboardList,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { type FilterChip } from '@/components/shared/ModuleHub';
import type { ModuleTab, ViewMode } from '@/components/shared/ModuleHub/types';
import {
  MENU_3_ACTION_DANGER,
  MENU_3_LEFT_CLASS,
  MENU_3_RIGHT_CLASS,
  Menu3Chip,
} from '@/components/shared/ModuleMenu3';
import { EmptyState } from '@/components/shared/states';
import {
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { StandardModuleBar } from '@/components/standard/StandardModuleBar';
import { EntityStatusChip, MetaChip, statusChipTone } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import { AUDIT_ISO27001_LEGACY_PRESET_ENABLED } from '@/utils/auditIso27001LegacyPresetGate';
import { isAuditProgramEditEnabled } from '@/utils/auditProgramEditStubFlag';
import { isDrdReportEnabled } from '@/utils/drdReportFlag';

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

const PAGE_SIZE = 50;

const STATUS_FILTERS: Array<AuditProgramStatus | 'all'> = [
  'all',
  'draft',
  'active',
  'completed',
  'archived',
];

// Map our domain status to a status string the canonical EntityStatusChip
// recognizes for tone purposes (it owns the color SSOT). All four tokens are
// recognized natively (active → success/emerald, preserving "ongoing"
// semantics); the visible text still comes from our bilingual statusLabel().
const STATUS_PILL_ALIAS: Record<AuditProgramStatus, string> = {
  draft: 'draft',
  active: 'active',
  completed: 'completed',
  archived: 'archived',
};

export const AuditsHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = i18n.language === 'pl';
  const navigate = useNavigate();

  const [programs, setPrograms] = useState<AuditProgram[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // L-02: search + status are applied SERVER-SIDE (the hub no longer filters the
  // already-fetched page). ModuleNavBar debounces the search box internally and
  // calls onSearch with the settled value.
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AuditProgramStatus | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<string | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardPresetId, setWizardPresetId] = useState<string | null>(null);
  // StandardTable owns the (unused-here) column filter chips. Search + status
  // remain SERVER-SIDE via ModuleHub (load()); these stay empty by design.
  const [tableFilters, setTableFilters] = useState<FilterChip[]>([]);
  // Triada standard (canon A3/A6): checkbox selection on the program list
  // switches Menu 3 into bulk mode (1:1 markup with Assessment/Results catalog).
  const [selectedListIds, setSelectedListIds] = useState<Set<string>>(new Set());

  // Which module tab is active. Audit Orchestrator "programs" (this hub's core
  // domain, /api/audit/programs) carry NO relation to assessment_reports rows
  // — they're separate backends (interview-based audit programs vs. DRD
  // maturity assessment reports). So the DRD report engine can't be a
  // per-program-row action; it's its own tab listing the org's assessment
  // reports directly. Flag-gated (audyt 2026-07-26, isDrdReportEnabled,
  // default OFF): the tab itself doesn't exist in `tabs` below when off, so
  // this state is inert and the hub renders byte-identical to before.
  const [activeTab, setActiveTab] = useState<ModuleTab>('list' as ModuleTab);
  const drdReportFlagOn = isDrdReportEnabled();

  interface DrdReportRow {
    id: string;
    name: string;
    assessmentName?: string;
    status: string;
    updatedAt: string;
  }
  const [drdReports, setDrdReports] = useState<DrdReportRow[]>([]);
  const [drdLoading, setDrdLoading] = useState(false);
  const [drdError, setDrdError] = useState<string | null>(null);
  const [selectedDrdReportId, setSelectedDrdReportId] = useState<string | null>(null);
  // The DRD list is fetched inside an effect, so there was no callback the
  // error banner could retry with — unlike the Programs tab below, which has
  // had a Retry button all along. Bumping this nonce re-runs the effect.
  const [drdReloadNonce, setDrdReloadNonce] = useState(0);

  // Lazy-load the DRD report list only once the tab is actually opened.
  useEffect(() => {
    if (!drdReportFlagOn || activeTab !== 'drd-reports') return;
    let cancelled = false;
    setDrdLoading(true);
    setDrdError(null);
    Api.getAssessmentReports(undefined)
      .then((reports: DrdReportRow[]) => {
        if (!cancelled) setDrdReports(Array.isArray(reports) ? reports : []);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setDrdError(e instanceof Error ? e.message : t('audit.failedToLoadPrograms'));
        }
      })
      .finally(() => {
        if (!cancelled) setDrdLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [drdReportFlagOn, activeTab, drdReloadNonce, t]);

  // Load the first page (resets the list). Used on mount, after mutations, and
  // whenever the server-side search/status filter changes.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listPrograms({
        limit: PAGE_SIZE,
        offset: 0,
        search: query,
        status: statusFilter,
      });
      setPrograms(res.programs);
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        msg.toLowerCase().includes('transport safeguard') || msg.toLowerCase().includes('circuit')
          ? t(
              'audit.temporarilyUnavailable',
              'Service temporarily unavailable. Please try again in a moment.'
            )
          : msg || t('audit.failedToLoadPrograms')
      );
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter]);

  // Append the next page server-side (#19e pagination), preserving active filters.
  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const res = await listPrograms({
        limit: PAGE_SIZE,
        offset: programs.length,
        search: query,
        status: statusFilter,
      });
      setPrograms((prev) => {
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...res.programs.filter((p) => !seen.has(p.id))];
      });
      setTotal(res.total);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      setError(
        msg.toLowerCase().includes('transport safeguard') || msg.toLowerCase().includes('circuit')
          ? t(
              'audit.temporarilyUnavailable',
              'Service temporarily unavailable. Please try again in a moment.'
            )
          : msg || t('audit.failedToLoadPrograms')
      );
    } finally {
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programs.length, query, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const statusLabel = (s: AuditProgramStatus | 'all'): string => {
    const map: Record<AuditProgramStatus | 'all', string> = {
      all: t('audit.all'),
      draft: t('audit.draft'),
      active: t('audit.active'),
      completed: t('audit.completed'),
      archived: t('audit.archived'),
    };
    return map[s];
  };

  // Triada standard (StandardTable/StandardPreview): the table consumes rows
  // with an `id`; we keep the full AuditProgram on the row so row actions
  // (generate / delete) and the preview dashboard can read the full record.
  type AuditRow = AuditProgram & {
    title: string;
    templateCount: number;
    assigneeCount: number;
    generatedCount: number;
    surveysGenerated: boolean;
  };

  const rows = useMemo<AuditRow[]>(
    () =>
      programs.map((p) => ({
        ...p,
        title: p.name,
        templateCount: p.config.templateIds?.length ?? 0,
        assigneeCount: p.config.assigneeIds?.length ?? 0,
        generatedCount: p.config.generation?.created ?? 0,
        surveysGenerated: p.config.surveysGenerated === true,
      })),
    [programs]
  );

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('audit.deleteThisAuditProgram'))) return;
    try {
      await deleteProgram(id);
      if (selectedId === id) setSelectedId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit.failedToDelete'));
    }
  };

  const handleGenerate = async (program: AuditProgram) => {
    const templateCount = program.config.templateIds?.length ?? 0;
    const assigneeCount = program.config.assigneeIds?.length ?? 0;
    const pairs = templateCount * assigneeCount;
    if (pairs === 0) {
      setError(t('audit.pickAtLeastOneTemplateAndAssignee'));
      return;
    }
    if (
      !window.confirm(
        t('audit.generateSurveyAssignmentsConfirm', {
          pairs,
          templateCount,
          assigneeCount,
        })
      )
    ) {
      return;
    }
    setGeneratingId(program.id);
    setError(null);
    try {
      const res = await generateSurveys(program.id);
      if (res.alreadyGenerated) {
        setError(t('audit.surveysWereAlreadyGenerated'));
      } else if (res.failed > 0) {
        setError(
          t('audit.generatedOfRequestedFailed', {
            created: res.created,
            requested: res.requested,
            failed: res.failed,
          })
        );
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('audit.failedToGenerateSurveys'));
    } finally {
      setGeneratingId(null);
    }
  };

  const openWizard = (presetId: string | null) => {
    setWizardPresetId(presetId);
    setWizardOpen(true);
  };

  // Triada standard (docs/ui-standards/TRIADA_KANON.md A4): name (+status
  // chip), objective, templates / assignees counts, surveys indicator, updated.
  // RYGOR: width is ALWAYS a literal px string — parsePx's digit-strip
  // fallback silently turns a '%' string into a tiny px value (see
  // ResultsHub fix 45e2a15408), so '18%' would render as '18px' and overlap
  // headers. Never use percentage widths here.
  const columns = useMemo<StandardTableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('audit.program'),
        width: '240px',
        render: (row: AuditRow) => (
          <span className="truncate text-sm font-semibold text-c-text block">{row.name}</span>
        ),
      },
      {
        id: 'status',
        label: t('common.status', 'Status'),
        width: '140px',
        filterable: true,
        // NOTE: filtering matches `row.status` (this column's id) — must stay a
        // dedicated column separate from `name`, otherwise FilterableTable's
        // `row[column.id]` lookup (canon mechanic) silently never matches.
        filterOptions: STATUS_FILTERS.filter((s) => s !== 'all').map((s) => ({
          value: s,
          label: statusLabel(s),
        })),
        render: (row: AuditRow) => (
          <EntityStatusChip
            status={STATUS_PILL_ALIAS[row.status]}
            label={statusLabel(row.status)}
          />
        ),
      },
      {
        id: 'objective',
        label: t('audit.objective'),
        width: '260px',
        render: (row: AuditRow) => (
          <span className="line-clamp-1 text-sm text-c-text-muted">{row.objective || '—'}</span>
        ),
      },
      {
        id: 'templates',
        label: t('audit.templates'),
        width: '120px',
        align: 'right' as const,
        render: (row: AuditRow) => (
          <MetaChip icon={ClipboardList} label={String(row.templateCount)} />
        ),
      },
      {
        id: 'assignees',
        label: t('audit.assignees'),
        width: '120px',
        align: 'right' as const,
        render: (row: AuditRow) => <MetaChip icon={Users} label={String(row.assigneeCount)} />,
      },
      {
        id: 'surveys',
        label: t('audit.surveys'),
        width: '120px',
        align: 'right' as const,
        render: (row: AuditRow) =>
          row.surveysGenerated ? (
            <span className="inline-flex items-center gap-1 text-sm text-c-success">
              <Send className="h-3.5 w-3.5" />
              {row.generatedCount}
            </span>
          ) : (
            <span className="text-sm text-c-text-muted/60">—</span>
          ),
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '130px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => {
          const r = row as unknown as AuditRow;
          return r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        },
        render: (row: Record<string, unknown>) => {
          const r = row as unknown as AuditRow;
          return r.updatedAt ? (
            <span className="text-[11px] text-c-text-muted">
              {new Date(r.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-c-text-muted">—</span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolish]
  );

  // Triada kebab (canon A6): 5-block contract. Module declares blocks 1-2
  // only; StandardTable always appends block 4 (Open preview/Edit/Archive)
  // and block 5 (Delete, red, last). Generate surveys is a domain state
  // transition (block 2) — idempotent, disabled once already generated.
  const buildRowMenu = useCallback(
    (row: AuditRow): StandardRowMenu => {
      const isGenerating = generatingId === row.id;
      return {
        primary: [
          {
            id: 'open',
            label: t('common.open', 'Open'),
            icon: ExternalLink,
            onClick: () => setSelectedId(row.id),
          },
        ],
        statusTransitions: [
          {
            id: 'generate',
            label: row.surveysGenerated ? t('audit.surveysGenerated') : t('audit.generateSurveys'),
            icon: Send,
            disabled: row.surveysGenerated || isGenerating,
            onClick: () => void handleGenerate(row),
          },
        ],
        universalHandlers: {
          preview: () => setSelectedId(row.id),
          // DP-5 (src/utils/auditProgramEditStubFlag.ts): backend PATCH exists
          // but no wired edit screen yet — gated OFF by default, disabled with
          // a note rather than hidden, until the edit UI ships.
          edit: isAuditProgramEditEnabled() ? () => setSelectedId(row.id) : undefined,
          editNote: isAuditProgramEditEnabled()
            ? undefined
            : t('common.comingSoonBackend', 'Coming soon (backend)'),
          // No archive endpoint exists for audit programs at all — disabled
          // with a note, never hidden (canon A6 block 4).
          archiveNote: t('common.comingSoonBackend', 'Coming soon (backend)'),
        },
        destructive: {
          onClick: () => void handleDelete(row.id),
        },
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatingId, isPolish]
  );

  // Triada standard (StandardPreview, canon A7): selected row for the preview
  // pane, kept in sync with `selectedId` (shared with the kebab's Open/preview).
  const selectedProgram: AuditRow | null = selectedId
    ? (rows.find((r) => r.id === selectedId) ?? null)
    : null;

  // Real completion rollup (#19e): fetched when the selected program has
  // generated surveys — feeds the `details` block of the preview.
  const [completionSummary, setCompletionSummary] = useState<ProgramCompletion | null>(null);
  useEffect(() => {
    if (!selectedProgram?.surveysGenerated) {
      setCompletionSummary(null);
      return;
    }
    let cancelled = false;
    getCompletion(selectedProgram.id)
      .then((c) => {
        if (!cancelled) setCompletionSummary(c);
      })
      .catch(() => {
        if (!cancelled) setCompletionSummary(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProgram?.id, selectedProgram?.surveysGenerated]);

  // Triada standard (StandardPreview actions, canon A8): Generate surveys
  // (neutral, domain transition) + Delete (destructive). No "Open" action here
  // — the preview pane already IS the full view for the selected row (see
  // `onOpenFull` note above), so a same-row "Open" button would be a no-op.
  const previewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedProgram
        ? {
            informational: [
              {
                id: 'generate',
                variant: 'neutral',
                label: selectedProgram.surveysGenerated
                  ? t('audit.surveysGenerated')
                  : t('audit.generateSurveys'),
                icon: Send,
                shortcut: 'G',
                disabled: selectedProgram.surveysGenerated || generatingId === selectedProgram.id,
                onClick: () => void handleGenerate(selectedProgram),
              },
            ],
            resolutions: [
              {
                id: 'delete',
                variant: 'destructive',
                label: t('audit.delete'),
                icon: Trash2,
                shortcut: 'D',
                onClick: () => void handleDelete(selectedProgram.id),
              },
            ],
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedProgram, generatingId, isPolish]
  );

  // Esc closes preview; single-key shortcuts (G/D) active while preview open
  // (kanon B.24/B.31 — mirrors Assessment/Results catalog adopters).
  useEffect(() => {
    if (!selectedId) return;
    const shortcuts = standardPreviewShortcuts(previewActions);
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setSelectedId(null);
        return;
      }
      const handler = shortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, previewActions]);

  // Bulk delete (Triada canon A3/A6): Menu 3 bulk bar Delete action for the
  // checkbox-selected rows. Sequential to reuse the existing single-delete
  // endpoint/confirmation semantics; no bulk API exists for audit programs.
  const handleBulkDelete = useCallback(async () => {
    if (selectedListIds.size === 0) return;
    if (!window.confirm(t('audit.confirmDeleteBulk', { count: selectedListIds.size }))) {
      return;
    }
    for (const id of Array.from(selectedListIds)) {
      try {
        await deleteProgram(id);
      } catch {
        /* best-effort — continue with remaining rows */
      }
    }
    setSelectedListIds(new Set());
    if (selectedId && selectedListIds.has(selectedId)) setSelectedId(null);
    await load();
  }, [selectedListIds, selectedId, isPolish, load]);

  // Triada standard (canon A3/A6): checkbox selection switches Menu 3 into
  // bulk mode via ModuleHub's `commandRowContent` override.
  const bulkCommandRowContent =
    selectedListIds.size > 0 ? (
      <div className={MENU_3_LEFT_CLASS + ' w-full justify-between flex'}>
        <div className={MENU_3_LEFT_CLASS}>
          <span className="inline-flex h-7 items-center rounded-full px-2.5 text-[11px] font-semibold text-c-text whitespace-nowrap">
            {`${selectedListIds.size} ${t('common.selected')}`}
          </span>
          <Menu3Chip onClick={() => setSelectedListIds(new Set(rows.map((r) => r.id)))}>
            {t('common.selectAll', 'Select all')}
          </Menu3Chip>
          <Menu3Chip onClick={() => setSelectedListIds(new Set())}>{t('common.clear')}</Menu3Chip>
        </div>
        <div className={MENU_3_RIGHT_CLASS}>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            className={MENU_3_ACTION_DANGER}
          >
            <Trash2 size={12} />
            {t('common.delete', 'Delete')}
          </button>
        </div>
      </div>
    ) : null;

  // L-05: adopt the canonical ModuleHub shell (standard header / search / tabs /
  // view-mode / primary CTA / filter controls), the same shell Results &
  // Initiatives use. The list surface itself is StandardTable/StandardPreview
  // (Triada standard, see above).
  const tabs = useMemo(
    () => [
      {
        id: 'list' as ModuleTab,
        label: t('audit.auditPrograms'),
        icon: <ShieldCheck className="h-4 w-4" />,
      },
      // DRD Audit Report engine entry (audyt 2026-07-26, flag-gated, default
      // OFF): this tab doesn't exist in the array at all when the flag is
      // off, so the hub is byte-identical to before for every user until
      // Piotr accepts the visual.
      ...(drdReportFlagOn
        ? [
            {
              id: 'drd-reports' as ModuleTab,
              label: t('audit.drdReports', 'Raporty DRD'),
              icon: <FileText className="h-4 w-4" />,
            },
          ]
        : []),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolish, drdReportFlagOn]
  );

  // DRD Reports tab (flag-gated, see drdReportFlagOn above): thin StandardTable
  // over the org's assessment reports (GET /api/assessment-reports, already
  // consumed elsewhere by AssessmentHub via Api.getAssessmentReports). "Open"
  // navigates to the flag-gated DRDAuditReportView route.
  const drdColumns = useMemo<StandardTableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('audit.program'),
        width: '260px',
        render: (row: DrdReportRow) => (
          <span className="truncate text-sm font-semibold text-c-text block">{row.name}</span>
        ),
      },
      {
        id: 'assessmentName',
        label: t('audit.drdSourceAssessment', 'Assessment'),
        width: '220px',
        render: (row: DrdReportRow) => (
          <span className="line-clamp-1 text-sm text-c-text-muted">
            {row.assessmentName || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('common.status', 'Status'),
        width: '140px',
        render: (row: DrdReportRow) => <EntityStatusChip status={row.status} />,
      },
      {
        id: 'updatedAt',
        label: t('common.updated', 'Updated'),
        width: '130px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => {
          const r = row as unknown as DrdReportRow;
          return r.updatedAt ? new Date(r.updatedAt).getTime() : 0;
        },
        render: (row: Record<string, unknown>) => {
          const r = row as unknown as DrdReportRow;
          return r.updatedAt ? (
            <span className="text-[11px] text-c-text-muted">
              {new Date(r.updatedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          ) : (
            <span className="text-c-text-muted">—</span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolish]
  );

  const openDrdReport = useCallback(
    (id: string) => navigate(`/audit-programs/drd-report/${encodeURIComponent(id)}`),
    [navigate]
  );

  const buildDrdRowMenu = useCallback(
    (row: DrdReportRow): StandardRowMenu => ({
      primary: [
        {
          id: 'open',
          label: t('common.open', 'Open'),
          icon: ExternalLink,
          onClick: () => openDrdReport(row.id),
        },
      ],
      universalHandlers: {
        preview: () => setSelectedDrdReportId(row.id),
      },
    }),
    [t, openDrdReport]
  );

  const selectedDrdReport: DrdReportRow | null = selectedDrdReportId
    ? (drdReports.find((r) => r.id === selectedDrdReportId) ?? null)
    : null;

  const drdPreviewActions: StandardPreviewActions | undefined = useMemo(
    () =>
      selectedDrdReport
        ? {
            informational: [
              {
                id: 'open',
                variant: 'neutral',
                label: t('common.open', 'Open'),
                icon: ExternalLink,
                shortcut: 'O',
                onClick: () => openDrdReport(selectedDrdReport.id),
              },
            ],
          }
        : undefined,
    [selectedDrdReport, t, openDrdReport]
  );

  // Status filters drive the SERVER-SIDE status param (L-02): ModuleNavBar renders
  // them as the canonical left-side phase buttons.
  const statusFilters = useMemo(
    () =>
      STATUS_FILTERS.map((s) => ({
        id: s,
        label: statusLabel(s),
        color: 'bg-c-text-muted',
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isPolish]
  );

  return (
    <div className="h-full" data-testid="audits-hub">
      <StandardModuleBar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSearch={setQuery}
        searchValue={query}
        openItems={[]}
        activeItemId={null}
        onSelectItem={() => {}}
        onCloseItem={() => {}}
        onShowList={() => setSelectedId(null)}
        activeFilters={[]}
        onRemoveFilter={() => {}}
        onClearFilters={() => {}}
        onNewItem={() => openWizard(null)}
        newItemLabel={t('audit.newAuditProgram')}
        statusFilters={statusFilters}
        activeStatusFilter={statusFilter === 'all' ? null : statusFilter}
        onStatusFilterChange={(s) => setStatusFilter((s as AuditProgramStatus | null) ?? 'all')}
        viewModes={['table']}
        commandRowContent={bulkCommandRowContent}
        filterControls={
          // AMD-AUD-RIGHTS-001: legacy ISO 27001 preset is hard-disabled and
          // cannot be re-enabled by any runtime input — see
          // auditIso27001LegacyPresetGate.ts. AUDIT_PRESETS already excludes
          // the preset (which also empties getPresetById('iso27001')); this is
          // the second, independent choke point so the launcher never renders.
          // No new UI is introduced — this only removes an existing control.
          AUDIT_ISO27001_LEGACY_PRESET_ENABLED ? (
            <button
              type="button"
              onClick={() => openWizard('iso27001')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-c-border px-3 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised"
            >
              <ShieldCheck className="h-4 w-4" />
              {t('audit.iso27001')}
            </button>
          ) : undefined
        }
      >
        <div className="mx-auto max-w-6xl px-6 py-6">
          {activeTab === 'drd-reports' ? (
            <>
              {/* Canonical failed-load state (docs/ui-standards/02-components/
                  empty-loading-states.md §2): the shared `EmptyState` with
                  `variant="error"` owns the icon, the assertive live region and
                  the "Try again" affordance. This tab previously showed the
                  message with no way to retry at all. */}
              {drdError && (
                <div className="mb-4" data-testid="drd-reports-error">
                  <EmptyState
                    variant="error"
                    compact
                    title={t('audit.drdReports.loadFailed', 'Could not load DRD reports')}
                    description={drdError}
                    onRetry={() => setDrdReloadNonce((n) => n + 1)}
                  />
                </div>
              )}
              {drdLoading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface py-12 text-sm text-c-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('audit.loading')}
                </div>
              ) : (
                <div className="h-[calc(100vh-260px)] min-h-[420px] flex overflow-hidden rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
                  <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
                    <StandardTable
                      columns={drdColumns}
                      data={
                        drdReports as unknown as Array<Record<string, unknown> & { id: string }>
                      }
                      selectedRowId={selectedDrdReportId}
                      onRowClick={(row) =>
                        setSelectedDrdReportId(String((row as unknown as DrdReportRow).id))
                      }
                      rowDescription={() => null}
                      defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
                      persistKey="audits.drdReports.list"
                      empty={{
                        icon: FileText,
                        title: t('audit.noDrdReportsYet', 'No DRD reports yet'),
                      }}
                      rowMenu={(row) => buildDrdRowMenu(row as unknown as DrdReportRow)}
                    />
                  </div>
                  {selectedDrdReport ? (
                    <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
                      <StandardPreview
                        title={selectedDrdReport.name || t('audit.drdReports', 'Raporty DRD')}
                        onClose={() => setSelectedDrdReportId(null)}
                        onOpenFull={() => openDrdReport(selectedDrdReport.id)}
                        meta={{
                          pills: [
                            {
                              label: selectedDrdReport.status,
                              tone: statusChipTone(selectedDrdReport.status),
                            },
                          ],
                        }}
                        details={{
                          text: [
                            `${t('audit.drdSourceAssessment', 'Assessment')}: ${selectedDrdReport.assessmentName || '—'}`,
                          ].join('\n'),
                        }}
                        ai={{
                          hints: [t('audit.aiHintSummarize'), t('audit.aiHintNextSteps')],
                          disabled: true,
                          disabledTooltip: t('common.comingSoon', 'Coming soon'),
                        }}
                        actions={drdPreviewActions}
                      />
                    </aside>
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <>
              {error && (
                <div className="mb-4 flex items-start gap-3 rounded-xl border border-danger-200 bg-danger-50 p-4 dark:border-danger-500/20 dark:bg-danger-500/10">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger-600 dark:text-danger-400" />
                  <div className="flex-1">
                    <p className="text-sm text-danger-800 dark:text-danger-300">{error}</p>
                  </div>
                  <button
                    onClick={load}
                    className="flex items-center gap-1.5 rounded-lg border border-danger-200 bg-c-surface px-3 py-1.5 text-xs font-medium text-danger-700 transition-colors hover:bg-danger-50 dark:border-danger-500/30 dark:bg-transparent dark:text-danger-300 dark:hover:bg-danger-500/10"
                  >
                    <RefreshCw className="h-3 w-3" />
                    {t('common.retry', 'Retry')}
                  </button>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface py-12 text-sm text-c-text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('audit.loading')}
                </div>
              ) : (
                <>
                  {/* Triada standard (docs/ui-standards/TRIADA_KANON.md A4-A7):
                  StandardTable + StandardPreview, 1:1 with the Assessment
                  'list' / Results KPI catalog adopters. Single click selects a
                  row and opens the program preview in the right pane. Kebab
                  (⋮) carries Open · Generate surveys · Open preview/Edit/Archive
                  (Edit+Archive disabled — no wired UI/API yet, see
                  auditProgramEditStubFlag.ts) · Delete. */}
                  <div className="h-[calc(100vh-260px)] min-h-[420px] flex overflow-hidden rounded-xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface">
                    <div className="flex-1 min-w-0 overflow-auto pl-4 pr-1.5 pt-3 pb-4">
                      <StandardTable
                        columns={columns}
                        data={rows as unknown as Array<Record<string, unknown> & { id: string }>}
                        selectedRowId={selectedId}
                        onRowClick={(row) => setSelectedId(String((row as unknown as AuditRow).id))}
                        rowDescription={() => null}
                        defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
                        persistKey="audits.programs.list"
                        selection={{ selectedIds: selectedListIds, onChange: setSelectedListIds }}
                        empty={{
                          icon: ShieldCheck,
                          title:
                            query.trim() || statusFilter !== 'all'
                              ? t('audit.noProgramsMatchFilters')
                              : t('audit.noAuditProgramsYet'),
                          actionLabel: t('audit.newAuditProgram'),
                          onAction: () => openWizard(null),
                        }}
                        rowMenu={(row) => buildRowMenu(row as unknown as AuditRow)}
                      />
                    </div>

                    {selectedProgram ? (
                      <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
                        <StandardPreview
                          title={selectedProgram.name || t('audit.program')}
                          onClose={() => setSelectedId(null)}
                          // No `onOpenFull`: the preview pane IS the program's full
                          // view (no separate detail route exists for /audits) —
                          // omitting the header's "Open" button rather than wiring
                          // a same-row no-op is the honest choice here.
                          meta={{
                            pills: [
                              {
                                label: statusLabel(selectedProgram.status),
                                tone: statusChipTone(selectedProgram.status),
                              },
                              ...(selectedProgram.surveysGenerated
                                ? [
                                    {
                                      label: t('audit.surveysGenerated'),
                                      tone: 'success' as const,
                                    },
                                  ]
                                : []),
                            ],
                            trailing: (
                              <span className="text-[11px] font-semibold text-c-text-secondary">
                                {selectedProgram.updatedAt
                                  ? new Date(selectedProgram.updatedAt).toLocaleDateString(
                                      undefined,
                                      {
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric',
                                      }
                                    )
                                  : '—'}
                              </span>
                            ),
                          }}
                          details={{
                            text: [
                              `${t('audit.objective')}: ${selectedProgram.objective || '—'}`,
                              `${t('audit.templates')}: ${selectedProgram.templateCount}`,
                              `${t('audit.assignees')}: ${selectedProgram.assigneeCount}`,
                              `${t('audit.completion')}: ${
                                completionSummary ? `${completionSummary.percent}%` : '—'
                              }`,
                              '',
                              selectedProgram.description?.trim() ||
                                t('common.noDescription', 'No description'),
                            ].join('\n'),
                            onCopy: () => {
                              void navigator.clipboard?.writeText(
                                `${selectedProgram.name} — ${statusLabel(selectedProgram.status)}`
                              );
                            },
                          }}
                          ai={{
                            hints: [t('audit.aiHintSummarize'), t('audit.aiHintNextSteps')],
                            disabled: true,
                            disabledTooltip: t('common.comingSoon', 'Coming soon'),
                          }}
                          relations={
                            Array.isArray(selectedProgram.config.plan)
                              ? selectedProgram.config.plan.map((row, i) => ({
                                  id: String((row as { areaKey?: string })?.areaKey ?? i),
                                  label: String((row as { area?: string })?.area ?? '') || '—',
                                  value:
                                    String(
                                      (row as { suggestedRole?: string })?.suggestedRole ?? ''
                                    ) || '—',
                                }))
                              : []
                          }
                          relationsEmptyLabel={t('audit.noSuggestedPlan')}
                          actions={previewActions}
                        />
                      </aside>
                    ) : null}
                  </div>

                  {/* Load more (#19e server-side pagination). Only when more rows exist
                AND the user isn't narrowing the current page via search/status. */}
                  {programs.length < total && (
                    <div className="mt-3 flex flex-col items-center gap-1">
                      <button
                        type="button"
                        onClick={() => void loadMore()}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-c-border px-4 py-2 text-sm text-c-text-secondary hover:bg-c-surface-raised disabled:opacity-60"
                      >
                        {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t('audit.loadMore')}
                      </button>
                      <span className="text-[11px] text-c-text-muted">
                        {t('audit.showingOfTotal', {
                          shown: programs.length,
                          total,
                        })}
                      </span>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </StandardModuleBar>

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

export default AuditsHub;
