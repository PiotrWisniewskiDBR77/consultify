/**
 * MyProjects — Zwornik (#78) minimal functional screen.
 *
 * SSOT: Harvard/wdrozenie-100/_KONCEPT_ZWORNIK_2026-07-10.md.
 * Was an "under construction" placeholder with zero data wiring — the
 * FIRST real screen for the stakeholder registry + project finance rollup
 * (backend complete, see stakeholderRegistryService.ts /
 * projectFinanceRollupService.ts). Adopts the Triada standard EXACTLY like
 * `AssessmentTable.tsx` (StandardModuleBar + StandardTable + StandardPreview,
 * zero bespoke chrome) — mandate 2026-07-12: funkcja > wygląd, zero restylu.
 *
 * Preview panel adds two read-only sections as `children` (StandardPreview
 * blok 3.5, before AI/Relations/Actions footer):
 *  - Effective stakeholders (§3.3: own + inherited from org, RACI, redacted
 *    influence/interest when the caller lacks `stakeholder.assessment.view`).
 *  - Finance rollup (§4.2: container budget vs Σ initiative budgets/value,
 *    soft over-committed warning — never a hard block).
 */

import {
  AlertTriangle,
  FolderKanban,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import {
  StandardModuleBar,
  StandardPreview,
  type StandardPreviewActions,
  standardPreviewShortcuts,
  type StandardRowMenu,
  StandardTable,
  type TableColumn,
  type TableRow,
} from '@/components/standard';
import { Api } from '@/services/api';
import { type EffectiveStakeholder, StakeholderApi } from '@/services/api/stakeholders.api';

import { CreateProgramModal, type ProgramSummary } from './CreateProgramModal';

interface ProjectRow {
  id: string;
  name: string;
  status: string;
  memberCount?: number;
  initiativeCount?: number;
  created_at?: string;
  createdAt?: string;
  is_system?: boolean;
  /** Zwornik D3 — present only once migration 916 is applied (projects.program_id). */
  program_id?: string | null;
  programId?: string | null;
}

interface FinanceRollup {
  currency: string;
  initiativeCount: number;
  budget: { containerTotal: number };
  initiativesBudget: { totalPlanned: number; totalActual: number };
  value: { total: number };
  benefits: { count: number; targetTotal: number; currentTotal: number };
  roi: { avgExpectedRoiPercent: number | null; npvTotal: number };
  variance: {
    containerBudget: number;
    initiativesPlanned: number;
    delta: number;
    overCommitted: boolean;
  };
}

/** Zwornik D3 — program list row (V4-INIT-02 CRUD, /api/initiatives/programs). */
interface ProgramRow {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  parentProgramId?: string | null;
  initiativeCount: number;
  childProgramCount: number;
  createdAt?: string;
}

/** Program rollup (programRollupService.getProgramRollup) — matches the /rollup endpoint shape 1:1. */
interface ProgramRollup {
  program: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    startDate: string | null;
    endDate: string | null;
  };
  projectCount: number;
  initiativeCount: number;
  currency: string;
  budget: { containerTotal: number; initiativesPlanned: number };
  value: { total: number };
  benefits: { count: number; targetTotal: number; currentTotal: number };
  roi: { capexTotal: number; opexAnnualTotal: number; npvTotal: number };
  health: { green: number; amber: number; red: number };
  projects: Array<{
    projectId: string;
    projectName: string;
    initiativeCount: number;
    budgetContainerTotal: number;
    initiativesBudgetPlanned: number;
    valueTotal: number;
    currency: string;
  }>;
  childPrograms: Array<{ id: string; name: string; status: string; initiativeCount: number }>;
}

type FilterStatus = 'all' | 'active' | 'archived' | 'completed';
type MainTab = 'projects' | 'programs';

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatMoney = (n: number | null | undefined, currency: string) => {
  const v = Number(n) || 0;
  try {
    return v.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
  } catch {
    return `${v.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`;
  }
};

const stakeholderLabel = (s: EffectiveStakeholder): string =>
  s.firstName || s.lastName
    ? `${s.firstName || ''} ${s.lastName || ''}`.trim()
    : s.externalName || s.email || s.externalEmail || '—';

export const MyProjects: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');

  // ── Menu 2: Projekty | Programy (Zwornik D3) ─────────────────────────────
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('projects');

  // ── Lista projektów ──────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewPinned, setPreviewPinned] = useState(false);

  // ── Zwornik D3: lista programów (dostępna niezależnie od aktywnego taba —
  // potrzebna też jako submenu "Przypisz do programu" w kebabie projektu) ──
  const [programs, setPrograms] = useState<ProgramRow[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [programPreviewId, setProgramPreviewId] = useState<string | null>(null);
  const [programRollup, setProgramRollup] = useState<ProgramRollup | null>(null);
  const [programRollupLoading, setProgramRollupLoading] = useState(false);
  const [programRollupError, setProgramRollupError] = useState<string | null>(null);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<ProgramSummary | null>(null);

  // ── Zwornik: efektywni stakeholderzy + finance rollup projektu ──────────
  const [stakeholders, setStakeholders] = useState<EffectiveStakeholder[]>([]);
  const [stakeholdersLoading, setStakeholdersLoading] = useState(false);
  const [stakeholdersError, setStakeholdersError] = useState<string | null>(null);
  const [finance, setFinance] = useState<FinanceRollup | null>(null);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeError, setFinanceError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await Api.getProjects();
      setProjects((Array.isArray(data) ? data : []) as ProjectRow[]);
    } catch (err: any) {
      console.error('[MyProjects] Error:', err);
      setError(
        String(
          err?.message ||
            t(
              'myWork.projects.loadError',
              isPolish ? 'Nie udało się wczytać projektów' : 'Failed to load projects'
            )
        )
      );
    } finally {
      setIsLoading(false);
    }
  }, [t, isPolish]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ── Zwornik D3: lista programów — fetched on mount regardless of active
  // tab (also feeds the "Przypisz do programu" submenu on project rows). ──
  const fetchPrograms = useCallback(async () => {
    setProgramsLoading(true);
    setProgramsError(null);
    try {
      const data = await Api.getPrograms();
      setPrograms((Array.isArray(data) ? data : []) as ProgramRow[]);
    } catch (err: any) {
      console.error('[MyProjects] programs error:', err);
      setProgramsError(
        String(
          err?.message || (isPolish ? 'Nie udało się wczytać programów' : 'Failed to load programs')
        )
      );
    } finally {
      setProgramsLoading(false);
    }
  }, [isPolish]);

  useEffect(() => {
    fetchPrograms();
  }, [fetchPrograms]);

  // Program rollup — fetched per selected program (preview panel, tab "Programy").
  useEffect(() => {
    if (!programPreviewId) {
      setProgramRollup(null);
      return;
    }
    let cancelled = false;
    setProgramRollupLoading(true);
    setProgramRollupError(null);
    Api.getProgramRollup(programPreviewId)
      .then((rollup) => {
        if (!cancelled) setProgramRollup(rollup);
      })
      .catch((err: any) => {
        console.error('[MyProjects] program rollup error:', err);
        if (!cancelled)
          setProgramRollupError(
            String(
              err?.message ||
                (isPolish
                  ? 'Nie udało się wczytać rollupu programu'
                  : 'Failed to load program rollup')
            )
          );
      })
      .finally(() => {
        if (!cancelled) setProgramRollupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [programPreviewId, isPolish]);

  // Zwornik data — fetched per selected project (org-level registry has no
  // list view yet in this first increment; effective/project view is the
  // minimal useful slice per HANDOFF §4 priority 2).
  useEffect(() => {
    if (!previewId) {
      setStakeholders([]);
      setFinance(null);
      return;
    }
    let cancelled = false;

    setStakeholdersLoading(true);
    setStakeholdersError(null);
    StakeholderApi.getProjectEffectiveStakeholders(previewId)
      .then((rows) => {
        if (!cancelled) setStakeholders(rows);
      })
      .catch((err) => {
        console.error('[MyProjects] effective stakeholders error:', err);
        if (!cancelled)
          setStakeholdersError(
            String(
              err?.message ||
                (isPolish ? 'Nie udało się wczytać stakeholderów' : 'Failed to load stakeholders')
            )
          );
      })
      .finally(() => {
        if (!cancelled) setStakeholdersLoading(false);
      });

    setFinanceLoading(true);
    setFinanceError(null);
    Api.getProjectFinance(previewId)
      .then((rollup: FinanceRollup) => {
        if (!cancelled) setFinance(rollup);
      })
      .catch((err: any) => {
        console.error('[MyProjects] finance rollup error:', err);
        if (!cancelled)
          setFinanceError(
            String(
              err?.message ||
                (isPolish ? 'Nie udało się wczytać finansów' : 'Failed to load finance')
            )
          );
      })
      .finally(() => {
        if (!cancelled) setFinanceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [previewId, isPolish]);

  // ── Filtrowanie (chipy Menu 3 + lupa) ────────────────────────────────────
  const filteredProjects = useMemo(
    () =>
      projects.filter((p) => {
        if (filterStatus !== 'all' && String(p.status || '').toLowerCase() !== filterStatus)
          return false;
        if (searchQuery) {
          return (p.name || '').toLowerCase().includes(searchQuery.toLowerCase());
        }
        return true;
      }),
    [projects, filterStatus, searchQuery]
  );

  const stats = useMemo(
    () => ({
      total: projects.length,
      active: projects.filter((p) => String(p.status || '').toLowerCase() === 'active').length,
      archived: projects.filter((p) => String(p.status || '').toLowerCase() === 'archived').length,
      completed: projects.filter((p) => String(p.status || '').toLowerCase() === 'completed')
        .length,
    }),
    [projects]
  );

  const previewProject = previewId ? (projects.find((p) => p.id === previewId) ?? null) : null;

  const programNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of programs) map.set(p.id, p.name);
    return map;
  }, [programs]);

  // ── Kolumny StandardTable ────────────────────────────────────────────────
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('myWork.projects.table.name', isPolish ? 'Projekt' : 'Project'),
        width: '280px',
        sortable: true,
      },
      {
        id: 'status',
        label: t('myWork.projects.table.status', 'Status'),
        width: '140px',
        sortable: true,
        filterable: true,
        filterOptions: [
          { value: 'active', label: isPolish ? 'Aktywny' : 'Active' },
          { value: 'completed', label: isPolish ? 'Zakończony' : 'Completed' },
          { value: 'archived', label: isPolish ? 'Zarchiwizowany' : 'Archived' },
        ],
      },
      {
        id: 'program',
        label: t('myWork.projects.table.program', isPolish ? 'Program' : 'Program'),
        width: '160px',
        sortable: true,
        sortAccessor: (row: TableRow) => {
          const project = row as unknown as ProjectRow;
          const pid = project.program_id || project.programId;
          return pid ? programNameById.get(pid) || '' : '';
        },
        render: (row: TableRow) => {
          const project = row as unknown as ProjectRow;
          const pid = project.program_id || project.programId;
          const label = pid ? programNameById.get(pid) : null;
          return label ? (
            <span className="inline-flex items-center gap-1 text-xs text-c-text-secondary">
              <Layers size={12} className="text-c-text-muted" />
              {label}
            </span>
          ) : (
            <span className="text-xs text-c-text-muted">—</span>
          );
        },
      },
      {
        id: 'memberCount',
        label: t('myWork.projects.table.members', isPolish ? 'Zespół' : 'Members'),
        width: '110px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.memberCount) || 0,
      },
      {
        id: 'initiativeCount',
        label: t('myWork.projects.table.initiatives', isPolish ? 'Inicjatywy' : 'Initiatives'),
        width: '110px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.initiativeCount) || 0,
      },
      {
        id: 'created_at',
        label: t('myWork.projects.table.created', isPolish ? 'Utworzono' : 'Created'),
        width: '140px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.created_at || row.createdAt || ''),
      },
    ],
    [t, isPolish, programNameById]
  );

  // Zwornik D3 — przypisanie projektu do programu (kebab, blok 1 "primary").
  const handleAssignProgram = useCallback(
    async (projectId: string, programId: string | null) => {
      try {
        await Api.assignProjectProgram(projectId, programId);
        toast.success(
          programId
            ? isPolish
              ? 'Projekt przypisany do programu'
              : 'Project assigned to program'
            : isPolish
              ? 'Projekt odłączony od programu'
              : 'Project unassigned from program'
        );
        await fetchProjects();
      } catch (err: any) {
        toast.error(
          err?.message ||
            (isPolish
              ? 'Nie udało się przypisać projektu do programu'
              : 'Failed to assign project to program')
        );
      }
    },
    [isPolish, fetchProjects]
  );

  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const project = row as unknown as ProjectRow;
      const currentProgramId = project.program_id || project.programId || null;
      return {
        primary: [
          {
            id: 'assign-program',
            label: isPolish ? 'Przypisz do programu' : 'Assign to program',
            icon: Layers,
            disabled: programs.length === 0,
            note:
              programs.length === 0
                ? isPolish
                  ? 'Utwórz najpierw program (zakładka Programy)'
                  : 'Create a program first (Programs tab)'
                : undefined,
            submenu: [
              {
                id: 'assign-program-none',
                label: isPolish ? '— Brak programu —' : '— No program —',
                disabled: !currentProgramId,
                onClick: () => handleAssignProgram(project.id, null),
              },
              ...programs.map((p) => ({
                id: `assign-program-${p.id}`,
                label: p.name,
                disabled: p.id === currentProgramId,
                onClick: () => handleAssignProgram(project.id, p.id),
              })),
            ],
          },
        ],
        universalHandlers: {
          preview: () => setPreviewId(project.id),
        },
      };
    },
    [programs, isPolish, handleAssignProgram]
  );

  // Skróty klawiszowe (brak akcji rozstrzygających w tym MVP — read-only).
  const previewActions: StandardPreviewActions | undefined = previewProject
    ? {
        informational: [
          {
            id: 'refresh',
            variant: 'neutral',
            label: t('common.refresh', isPolish ? 'Odśwież' : 'Refresh'),
            icon: RefreshCw,
            onClick: () => {
              void fetchProjects();
              if (previewId) {
                StakeholderApi.getProjectEffectiveStakeholders(previewId)
                  .then(setStakeholders)
                  .catch(() => {});
                Api.getProjectFinance(previewId)
                  .then(setFinance)
                  .catch(() => {});
              }
            },
          },
        ],
      }
    : undefined;
  const previewShortcuts = standardPreviewShortcuts(previewActions);

  // ── Zwornik D3: zakładka "Programy" — tabela + preview (rollup) ──────────
  const [programFilterStatus, setProgramFilterStatus] = useState<
    'all' | 'active' | 'on_hold' | 'completed'
  >('all');

  const filteredPrograms = useMemo(
    () =>
      programs.filter((p) => {
        if (
          programFilterStatus !== 'all' &&
          String(p.status || '').toLowerCase() !== programFilterStatus
        )
          return false;
        if (searchQuery) return p.name.toLowerCase().includes(searchQuery.toLowerCase());
        return true;
      }),
    [programs, programFilterStatus, searchQuery]
  );

  const programStats = useMemo(
    () => ({
      total: programs.length,
      active: programs.filter((p) => String(p.status || '').toLowerCase() === 'active').length,
      onHold: programs.filter((p) => String(p.status || '').toLowerCase() === 'on_hold').length,
      completed: programs.filter((p) => String(p.status || '').toLowerCase() === 'completed')
        .length,
    }),
    [programs]
  );

  const previewProgramListRow = programPreviewId
    ? (programs.find((p) => p.id === programPreviewId) ?? null)
    : null;

  const programColumns = useMemo<TableColumn[]>(
    () => [
      { id: 'name', label: isPolish ? 'Program' : 'Program', width: '280px', sortable: true },
      {
        id: 'status',
        label: 'Status',
        width: '140px',
        sortable: true,
      },
      {
        id: 'initiativeCount',
        label: isPolish ? 'Inicjatywy (bezpośrednio)' : 'Initiatives (direct)',
        width: '170px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.initiativeCount) || 0,
      },
      {
        id: 'childProgramCount',
        label: isPolish ? 'Podprogramy' : 'Sub-programs',
        width: '130px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.childProgramCount) || 0,
      },
      {
        id: 'createdAt',
        label: isPolish ? 'Utworzono' : 'Created',
        width: '140px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.createdAt || ''),
      },
    ],
    [isPolish]
  );

  const handleDeleteProgram = useCallback(
    async (programId: string) => {
      try {
        await Api.deleteProgram(programId);
        toast.success(isPolish ? 'Program usunięty' : 'Program deleted');
        setProgramPreviewId(null);
        await fetchPrograms();
      } catch (err: any) {
        toast.error(
          err?.message || (isPolish ? 'Nie udało się usunąć programu' : 'Failed to delete program')
        );
      }
    },
    [isPolish, fetchPrograms]
  );

  const programRowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const program = row as unknown as ProgramRow;
      return {
        universalHandlers: {
          preview: () => setProgramPreviewId(program.id),
          edit: () => {
            setEditingProgram(program);
            setIsProgramModalOpen(true);
          },
        },
        destructive: {
          onClick: () => handleDeleteProgram(program.id),
          note:
            program.initiativeCount > 0 || program.childProgramCount > 0
              ? isPolish
                ? 'Program z inicjatywami/podprogramami — najpierw je odłącz'
                : 'Program has linked initiatives/sub-programs — unlink them first'
              : undefined,
        },
      };
    },
    [isPolish, handleDeleteProgram]
  );

  useEffect(() => {
    if (!previewId) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable)
        return;
      if (e.key === 'Escape') {
        setPreviewId(null);
        setPreviewPinned(false);
        return;
      }
      const handler = previewShortcuts[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId]);

  const handleTabChange = useCallback((id: string) => {
    const tab = id as MainTab;
    setActiveMainTab(tab);
    setSearchQuery('');
    if (tab === 'projects') {
      setProgramPreviewId(null);
      setProgramFilterStatus('all');
    } else {
      setPreviewId(null);
      setPreviewPinned(false);
      setFilterStatus('all');
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* MENU 1/2/3 — wyłącznie przez fasadę */}
      <StandardModuleBar
        breadcrumbs={[
          { label: t('sidebar.myWork', 'My Work') },
          { label: t('myWork.projects', isPolish ? 'Projekty' : 'Projects') },
        ]}
        tabs={[
          { id: 'projects', label: isPolish ? 'Projekty' : 'Projects' },
          { id: 'programs', label: isPolish ? 'Programy' : 'Programs' },
        ]}
        activeTab={activeMainTab}
        onTabChange={handleTabChange}
        onSearch={setSearchQuery}
        searchValue={searchQuery}
        primaryCta={
          activeMainTab === 'programs'
            ? {
                label: isPolish ? 'Nowy program' : 'New program',
                icon: Plus,
                onClick: () => {
                  setEditingProgram(null);
                  setIsProgramModalOpen(true);
                },
              }
            : undefined
        }
        chips={
          activeMainTab === 'projects'
            ? [
                { id: 'all', label: t('common.all', 'All'), count: stats.total },
                { id: 'active', label: isPolish ? 'Aktywne' : 'Active', count: stats.active },
                {
                  id: 'completed',
                  label: isPolish ? 'Zakończone' : 'Completed',
                  count: stats.completed,
                },
                {
                  id: 'archived',
                  label: isPolish ? 'Zarchiwizowane' : 'Archived',
                  count: stats.archived,
                },
              ]
            : [
                { id: 'all', label: t('common.all', 'All'), count: programStats.total },
                {
                  id: 'active',
                  label: isPolish ? 'Aktywne' : 'Active',
                  count: programStats.active,
                },
                {
                  id: 'on_hold',
                  label: isPolish ? 'Wstrzymane' : 'On hold',
                  count: programStats.onHold,
                },
                {
                  id: 'completed',
                  label: isPolish ? 'Zakończone' : 'Completed',
                  count: programStats.completed,
                },
              ]
        }
        activeChip={activeMainTab === 'projects' ? filterStatus : programFilterStatus}
        onChipChange={(id) => {
          if (activeMainTab === 'projects') setFilterStatus(id as FilterStatus);
          else setProgramFilterStatus(id as typeof programFilterStatus);
        }}
      />

      {activeMainTab === 'programs' ? (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto">
            <StandardTable
              columns={programColumns}
              data={filteredPrograms as unknown as TableRow[]}
              loading={programsLoading}
              error={programsError}
              onRetry={fetchPrograms}
              empty={{
                icon: Layers,
                title: isPolish ? 'Brak programów' : 'No programs yet',
                description: isPolish
                  ? 'Program grupuje wiele projektów pod wspólnym rollupem finansowym.'
                  : 'A program groups multiple projects under a shared finance rollup.',
                actionLabel: isPolish ? 'Nowy program' : 'New program',
                onAction: () => {
                  setEditingProgram(null);
                  setIsProgramModalOpen(true);
                },
              }}
              selectedRowId={programPreviewId}
              onRowClick={(row) => setProgramPreviewId(String(row.id))}
              rowMenu={programRowMenu}
              defaultSort={{ columnId: 'createdAt', direction: 'desc' }}
              persistKey="mywork.programs.list"
            />
          </div>

          {previewProgramListRow ? (
            <aside className="w-[420px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={programRollup?.program.name || previewProgramListRow.name}
                onClose={() => setProgramPreviewId(null)}
                meta={{
                  pills: [
                    { label: String(previewProgramListRow.status || 'active'), tone: 'neutral' },
                    {
                      label: `${programRollup?.projectCount ?? 0} ${isPolish ? 'projektów' : 'projects'}`,
                      tone: 'neutral',
                    },
                    {
                      label: `${programRollup?.initiativeCount ?? previewProgramListRow.initiativeCount} ${isPolish ? 'inicjatyw' : 'initiatives'}`,
                      tone: 'neutral',
                    },
                  ],
                }}
                details={{
                  text:
                    programRollup?.program.description ||
                    previewProgramListRow.description ||
                    (isPolish
                      ? 'Rollup: budżet/wartość/ROI zsumowane po projektach programu.'
                      : 'Rollup: budget/value/ROI summed across the program’s projects.'),
                }}
                actions={{
                  informational: [
                    {
                      id: 'refresh',
                      variant: 'neutral',
                      label: t('common.refresh', isPolish ? 'Odśwież' : 'Refresh'),
                      icon: RefreshCw,
                      onClick: () => {
                        void fetchPrograms();
                        if (programPreviewId)
                          Api.getProgramRollup(programPreviewId)
                            .then(setProgramRollup)
                            .catch(() => {});
                      },
                    },
                    {
                      id: 'edit-program',
                      variant: 'neutral',
                      label: isPolish ? 'Edytuj' : 'Edit',
                      icon: Pencil,
                      onClick: () => {
                        setEditingProgram(previewProgramListRow);
                        setIsProgramModalOpen(true);
                      },
                    },
                    {
                      id: 'delete-program',
                      variant: 'neutral',
                      label: isPolish ? 'Usuń' : 'Delete',
                      icon: Trash2,
                      onClick: () => handleDeleteProgram(previewProgramListRow.id),
                    },
                  ],
                }}
              >
                {/* ── Rollup finansowy programu (programRollupService) ─────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary mb-2">
                    {isPolish ? 'Rollup programu' : 'Program rollup'}
                  </h4>
                  {programRollupLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {isPolish ? 'Wczytywanie…' : 'Loading…'}
                    </p>
                  ) : programRollupError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {programRollupError}
                    </p>
                  ) : !programRollup ? (
                    <p className="text-xs text-c-text-muted">
                      {isPolish ? 'Brak danych.' : 'No data.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {isPolish ? 'Budżet (kontenery)' : 'Budget (containers)'}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(programRollup.budget.containerTotal, programRollup.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {isPolish ? 'Σ budżety inicjatyw' : 'Σ initiative budgets'}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(
                            programRollup.budget.initiativesPlanned,
                            programRollup.currency
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {isPolish ? 'Wartość (KPI)' : 'Value (KPI)'}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(programRollup.value.total, programRollup.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">NPV</span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(programRollup.roi.npvTotal, programRollup.currency)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-c-text-muted">
                          {isPolish ? 'Zdrowie inicjatyw' : 'Initiative health'}
                        </span>
                        <span className="flex items-center gap-2 text-[11px] font-semibold">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {programRollup.health.green} ●
                          </span>
                          <span className="text-amber-600 dark:text-amber-400">
                            {programRollup.health.amber} ●
                          </span>
                          <span className="text-danger-500">{programRollup.health.red} ●</span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Projekty programu ──────────────────────────────────────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3 mt-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <FolderKanban size={14} className="text-c-text-secondary" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary">
                      {isPolish ? 'Projekty w programie' : 'Projects in this program'}
                    </h4>
                  </div>
                  {!programRollup || programRollup.projects.length === 0 ? (
                    <p className="text-xs text-c-text-muted">
                      {isPolish
                        ? 'Brak projektów przypisanych do tego programu.'
                        : 'No projects assigned to this program yet.'}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {programRollup.projects.map((p) => (
                        <li
                          key={p.projectId}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-c-text">{p.projectName}</span>
                          <span className="shrink-0 text-c-text-muted">
                            {p.initiativeCount} {isPolish ? 'inicjatyw' : 'initiatives'} ·{' '}
                            {formatMoney(p.valueTotal, p.currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ── Podprogramy ────────────────────────────────────────────── */}
                {programRollup && programRollup.childPrograms.length > 0 ? (
                  <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3 mt-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary mb-2">
                      {isPolish ? 'Podprogramy' : 'Sub-programs'}
                    </h4>
                    <ul className="space-y-1.5">
                      {programRollup.childPrograms.map((cp) => (
                        <li key={cp.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-c-text">{cp.name}</span>
                          <span className="shrink-0 text-c-text-muted">
                            {cp.initiativeCount} {isPolish ? 'inicjatyw' : 'initiatives'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </StandardPreview>
            </aside>
          ) : null}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-auto">
            <StandardTable
              columns={columns}
              data={filteredProjects as unknown as TableRow[]}
              loading={isLoading}
              error={error}
              onRetry={fetchProjects}
              empty={{
                icon: FolderKanban,
                title: t(
                  'myWork.projects.emptyState.title',
                  isPolish ? 'Brak projektów' : 'No projects yet'
                ),
                description: t(
                  'myWork.projects.emptyState.description',
                  isPolish
                    ? 'Projekty utworzone w module Initiatives pojawią się tutaj.'
                    : 'Projects created in the Initiatives module will appear here.'
                ),
              }}
              selectedRowId={previewId}
              onRowClick={(row) => {
                if (!previewPinned) setPreviewId(String(row.id));
              }}
              rowMenu={rowMenu}
              defaultSort={{ columnId: 'created_at', direction: 'desc' }}
              persistKey="mywork.projects.list"
            />
          </div>

          {previewProject ? (
            <aside className="w-[420px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
              <StandardPreview
                title={previewProject.name || (isPolish ? 'Projekt' : 'Project')}
                onClose={() => {
                  setPreviewId(null);
                  setPreviewPinned(false);
                }}
                pinned={previewPinned}
                onTogglePin={() => setPreviewPinned((v) => !v)}
                meta={{
                  pills: [
                    { label: String(previewProject.status || 'active'), tone: 'neutral' },
                    {
                      label: `${previewProject.memberCount ?? 0} ${isPolish ? 'osób' : 'members'}`,
                      tone: 'neutral',
                    },
                    {
                      label: `${previewProject.initiativeCount ?? 0} ${isPolish ? 'inicjatyw' : 'initiatives'}`,
                      tone: 'neutral',
                    },
                  ],
                  trailing: (
                    <span className="text-[11px] font-semibold text-c-text-secondary">
                      {formatDate(previewProject.created_at || previewProject.createdAt)}
                    </span>
                  ),
                }}
                details={{
                  text: isPolish
                    ? 'Zwornik: rejestr stakeholderów i rollup finansowy projektu (tylko odczyt).'
                    : 'Zwornik: project stakeholder registry and finance rollup (read-only).',
                }}
                actions={previewActions}
              >
                {/* ── Zwornik Delta A: efektywni stakeholderzy (§3.3) ──────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-c-text-secondary" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary">
                      {isPolish ? 'Stakeholderzy (efektywni)' : 'Stakeholders (effective)'}
                    </h4>
                  </div>
                  {stakeholdersLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {isPolish ? 'Wczytywanie…' : 'Loading…'}
                    </p>
                  ) : stakeholdersError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {stakeholdersError}
                    </p>
                  ) : stakeholders.length === 0 ? (
                    <p className="text-xs text-c-text-muted">
                      {isPolish
                        ? 'Brak stakeholderów dla tego projektu.'
                        : 'No stakeholders for this project yet.'}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {stakeholders.map((s, idx) => (
                        <li
                          key={`${s.id || s.userId || s.externalEmail || idx}`}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-c-text">{stakeholderLabel(s)}</span>
                          <span className="flex items-center gap-1 shrink-0">
                            {s.raciType ? (
                              <span className="px-1.5 py-0.5 rounded bg-c-surface-raised text-[10px] font-semibold text-c-text-secondary">
                                {s.raciType}
                              </span>
                            ) : null}
                            {s.role ? (
                              <span className="text-[10px] text-c-text-muted">{s.role}</span>
                            ) : null}
                            {s.inherited ? (
                              <span
                                className="px-1.5 py-0.5 rounded-full bg-c-info/15 text-[10px] font-semibold text-[var(--c-info)]"
                                title={
                                  isPolish ? 'Odziedziczone z organizacji' : 'Inherited from org'
                                }
                              >
                                {isPolish ? 'dziedz.' : 'inherited'}
                              </span>
                            ) : null}
                            {s.assessmentRedacted ? (
                              <span
                                className="text-[10px] text-c-text-muted"
                                title={
                                  isPolish
                                    ? 'Wpływ/interes ukryte — brak uprawnienia stakeholder.assessment.view'
                                    : 'Influence/interest hidden — missing stakeholder.assessment.view'
                                }
                              >
                                🔒
                              </span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ── Zwornik Delta B: finance rollup (§4.2) ───────────────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3 mt-2.5">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary mb-2">
                    {isPolish ? 'Finanse (rollup)' : 'Finance rollup'}
                  </h4>
                  {financeLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {isPolish ? 'Wczytywanie…' : 'Loading…'}
                    </p>
                  ) : financeError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {financeError}
                    </p>
                  ) : !finance ? (
                    <p className="text-xs text-c-text-muted">
                      {isPolish ? 'Brak danych finansowych.' : 'No finance data.'}
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {isPolish ? 'Budżet projektu' : 'Project budget'}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.budget?.containerTotal, finance.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {isPolish
                            ? 'Σ budżety inicjatyw (plan)'
                            : 'Σ initiative budgets (planned)'}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.initiativesBudget?.totalPlanned, finance.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {isPolish
                            ? 'Σ budżety inicjatyw (rzecz.)'
                            : 'Σ initiative budgets (actual)'}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.initiativesBudget?.totalActual, finance.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {isPolish ? 'Wartość (KPI)' : 'Value (KPI)'}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.value?.total, finance.currency)}
                        </span>
                      </div>
                      {finance.roi?.avgExpectedRoiPercent != null ? (
                        <div className="flex justify-between">
                          <span className="text-c-text-muted">
                            {isPolish ? 'Śr. ROI oczekiwane' : 'Avg expected ROI'}
                          </span>
                          <span className="font-semibold text-c-text">
                            {finance.roi.avgExpectedRoiPercent.toFixed(1)}%
                          </span>
                        </div>
                      ) : null}
                      {finance.variance?.overCommitted ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={12} />
                          {isPolish
                            ? 'Σ budżety inicjatyw przekraczają budżet projektu (soft warning).'
                            : 'Σ initiative budgets exceed the project budget (soft warning).'}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>
              </StandardPreview>
            </aside>
          ) : null}
        </div>
      )}

      <CreateProgramModal
        isOpen={isProgramModalOpen}
        onClose={() => {
          setIsProgramModalOpen(false);
          setEditingProgram(null);
        }}
        programs={programs}
        editing={editingProgram}
        onSaved={() => {
          void fetchPrograms();
          if (programPreviewId)
            Api.getProgramRollup(programPreviewId)
              .then(setProgramRollup)
              .catch(() => {});
        }}
      />
    </div>
  );
};

export default MyProjects;
