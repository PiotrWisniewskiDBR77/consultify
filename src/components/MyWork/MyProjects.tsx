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
  ClipboardList,
  FolderKanban,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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
import { ROUTES } from '@/routes/routeConfig';
import { statusChipLabel } from '@/components/ui/primitives/chips/EntityStatusChip';
import { formatListDate } from '@/utils/listDateFormat';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';

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

/** Zwornik (#78) — project team member (pmo/project-members GET /:projectId). */
interface ProjectTeamMember {
  id: string;
  user_id?: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  role?: string | null;
}

/** Zwornik (#78) — project task slice (GET /api/tasks?projectId=…). */
interface ProjectTask {
  id: string;
  title?: string;
  status?: string;
  priority?: string;
  assignee?: { firstName?: string | null; lastName?: string | null } | null;
  dueDate?: string | null;
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

/**
 * Odbiór 2026-08-30 (przegląd całości): dwie osobne wady tej funkcji —
 * (1) `toLocaleDateString(undefined, …)` bierze locale z PRZEGLĄDARKI, nie
 *     z języka konta (ten sam mechanizm co N-7 w `listDateFormat.ts`);
 * (2) kolumny tabeli (`created_at`/`createdAt` niżej) nie wołały TEJ funkcji
 *     w ogóle — nie miały `render:`, więc StandardTable pokazywał surowe
 *     ISO `2026-06-11` wprost z mocka. Piąty format daty w aplikacji obok
 *     kanonu z `listDateFormat.ts`.
 * Teraz jedna funkcja, kanoniczna, użyta w obu miejscach (preview + tabela).
 */
const formatDate = (dateStr?: string) => formatListDate(dateStr, '—');

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

const memberLabel = (m: ProjectTeamMember): string =>
  m.first_name || m.last_name
    ? `${m.first_name || ''} ${m.last_name || ''}`.trim()
    : m.email || '—';

const assigneeLabel = (a: ProjectTask['assignee']): string | null =>
  a && (a.firstName || a.lastName) ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : null;

/** Task status → tone class (neutral badges; NO crimson — reguła #4). */
const taskStatusTone = (status?: string): string => {
  const s = String(status || '').toLowerCase();
  if (s === 'done' || s === 'completed') return 'bg-c-success/15 text-[var(--c-success)]';
  if (s === 'in_progress' || s === 'active') return 'bg-c-info/15 text-[var(--c-info)]';
  if (s === 'blocked') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
  return 'bg-c-surface-raised text-c-text-secondary';
};

export const MyProjects: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const navigate = useNavigate();
  // ★ Odbiór 2026-08-30 (droga-dojscia #4): breadcrumb pokazywał „My Work"
  // jako martwy tekst (ten sam styl co link, zero onClick) — wygląda na
  // nawigację, nic nie robi po kliknięciu. Kanon breadcrumbs (patrz
  // SettingsView.tsx/OrganizationView.tsx: pierwszy człon zawsze ma
  // onClick) — tu wraca do huba Moja Praca, jedynego realnego rodzica
  // koncepcyjnego tego ekranu.
  const handleBackToMyWork = useCallback(() => {
    navigate(ROUTES.MY_WORK);
  }, [navigate]);

  // ── Menu 2: Projekty | Programy (Zwornik D3) ─────────────────────────────
  const [activeMainTab, setActiveMainTab] = useState<MainTab>('projects');

  // ── Lista projektów ──────────────────────────────────────────────────────
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  // DEC-397b (1.1-K6): klik wiersza / kebab „Podgląd" po zamknięciu panelu
  // (X) mają go ponownie otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
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
  // ── Zwornik (#78): zespół (członkowie + role) + zadania projektu ─────────
  const [team, setTeam] = useState<ProjectTeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [tasksError, setTasksError] = useState<string | null>(null);

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
              t('myWork.projects.failedToLoadProjects', 'Failed to load projects')
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
        String(err?.message || t('myWork.projects.failedToLoadPrograms', 'Failed to load programs'))
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
                t('myWork.projects.failedToLoadProgram', 'Failed to load program rollup')
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
      setTeam([]);
      setTasks([]);
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
                t('myWork.projects.failedToLoadStakeholders', 'Failed to load stakeholders')
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
              err?.message || t('myWork.projects.failedToLoadFinance', 'Failed to load finance')
            )
          );
      })
      .finally(() => {
        if (!cancelled) setFinanceLoading(false);
      });

    // Zwornik (#78): zespół projektu (członkowie + role).
    setTeamLoading(true);
    setTeamError(null);
    Api.getProjectTeamMembers(previewId)
      .then((rows: ProjectTeamMember[]) => {
        if (!cancelled) setTeam(Array.isArray(rows) ? rows : []);
      })
      .catch((err: any) => {
        console.error('[MyProjects] project team error:', err);
        if (!cancelled)
          setTeamError(
            String(err?.message || t('myWork.projects.failedToLoadTeam', 'Failed to load team'))
          );
      })
      .finally(() => {
        if (!cancelled) setTeamLoading(false);
      });

    // Zwornik (#78): zadania projektu.
    setTasksLoading(true);
    setTasksError(null);
    Api.getTasks({ projectId: previewId })
      .then((rows: ProjectTask[]) => {
        if (!cancelled) setTasks(Array.isArray(rows) ? rows : []);
      })
      .catch((err: any) => {
        console.error('[MyProjects] project tasks error:', err);
        if (!cancelled)
          setTasksError(
            String(err?.message || t('myWork.projects.failedToLoadTasks', 'Failed to load tasks'))
          );
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
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

  // Zwornik (#78): przypisania ról — grupowanie członków po roli projektowej
  // (macierz RACI wymaga osobnego backendu, którego nie ma — pokazujemy realne
  // przypisania ról z tabeli project_members, bez 404).
  const roleGroups = useMemo(() => {
    const map = new Map<string, ProjectTeamMember[]>();
    for (const m of team) {
      const key = String(m.role || 'MEMBER').toUpperCase();
      const arr = map.get(key) || [];
      arr.push(m);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .map(([role, members]) => ({ role, members }))
      .sort((a, b) => b.members.length - a.members.length);
  }, [team]);

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
        label: t('myWork.projects.table.name', t('myWork.projects.project', 'Project')),
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
          { value: 'active', label: t('myWork.projects.label', 'Active') },
          { value: 'completed', label: t('myWork.projects.label2', 'Completed') },
          { value: 'archived', label: t('myWork.projects.label3', 'Archived') },
        ],
      },
      {
        id: 'program',
        label: t('myWork.projects.table.program', t('myWork.projects.program', 'Program')),
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
        label: t('myWork.projects.table.members', t('myWork.projects.members', 'Members')),
        width: '110px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.memberCount) || 0,
      },
      {
        id: 'initiativeCount',
        label: t(
          'myWork.projects.table.initiatives',
          t('myWork.projects.initiatives', 'Initiatives')
        ),
        width: '110px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.initiativeCount) || 0,
      },
      {
        id: 'created_at',
        label: t('myWork.projects.table.created', t('myWork.projects.created', 'Created')),
        width: '140px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.created_at || row.createdAt || ''),
        render: (row: TableRow) => formatDate((row.created_at || row.createdAt) as string | undefined),
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
            ? t('myWork.projects.projectAssignedToProgram', 'Project assigned to program')
            : t('myWork.projects.projectUnassignedFromProgram', 'Project unassigned from program')
        );
        await fetchProjects();
      } catch (err: any) {
        toast.error(
          err?.message ||
            t('myWork.projects.failedToAssignProject', 'Failed to assign project to program')
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
            label: t('myWork.projects.label4', 'Assign to program'),
            icon: Layers,
            disabled: programs.length === 0,
            note:
              programs.length === 0
                ? t('myWork.projects.createAProgramFirst', 'Create a program first (Programs tab)')
                : undefined,
            submenu: [
              {
                id: 'assign-program-none',
                label: t('myWork.projects.label5', '— No program —'),
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
          preview: () => {
            jedenPanel.otworz();
            setPreviewId(project.id);
          },
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
            label: t('common.refresh', t('myWork.projects.refresh', 'Refresh')),
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
                Api.getProjectTeamMembers(previewId)
                  .then((rows: ProjectTeamMember[]) => setTeam(Array.isArray(rows) ? rows : []))
                  .catch(() => {});
                Api.getTasks({ projectId: previewId })
                  .then((rows: ProjectTask[]) => setTasks(Array.isArray(rows) ? rows : []))
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
      { id: 'name', label: t('myWork.projects.label6', 'Program'), width: '280px', sortable: true },
      {
        id: 'status',
        label: 'Status',
        width: '140px',
        sortable: true,
      },
      {
        id: 'initiativeCount',
        label: t('myWork.projects.label7', 'Initiatives (direct)'),
        width: '170px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.initiativeCount) || 0,
      },
      {
        id: 'childProgramCount',
        label: t('myWork.projects.label8', 'Sub-programs'),
        width: '130px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.childProgramCount) || 0,
      },
      {
        id: 'createdAt',
        label: t('myWork.projects.label9', 'Created'),
        width: '140px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.createdAt || ''),
        render: (row: TableRow) => formatDate(row.createdAt as string | undefined),
      },
    ],
    [isPolish]
  );

  const handleDeleteProgram = useCallback(
    async (programId: string) => {
      try {
        await Api.deleteProgram(programId);
        toast.success(t('myWork.projects.toastSuccess', 'Program deleted'));
        setProgramPreviewId(null);
        await fetchPrograms();
      } catch (err: any) {
        toast.error(
          err?.message || t('myWork.projects.failedToDeleteProgram', 'Failed to delete program')
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
          preview: () => {
            jedenPanel.otworz();
            setProgramPreviewId(program.id);
          },
          edit: () => {
            setEditingProgram(program);
            setIsProgramModalOpen(true);
          },
        },
        destructive: {
          onClick: () => handleDeleteProgram(program.id),
          note:
            program.initiativeCount > 0 || program.childProgramCount > 0
              ? t(
                  'myWork.projects.programHasLinkedInitiatives',
                  'Program has linked initiatives/sub-programs — unlink them first'
                )
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
          { label: t('sidebar.myWork', 'My Work'), onClick: handleBackToMyWork },
          { label: t('myWork.projects.projects', 'Projects') },
        ]}
        tabs={[
          { id: 'projects', label: t('myWork.projects.label10', 'Projects') },
          { id: 'programs', label: t('myWork.projects.label11', 'Programs') },
        ]}
        activeTab={activeMainTab}
        onTabChange={handleTabChange}
        onSearch={setSearchQuery}
        searchValue={searchQuery}
        primaryCta={
          activeMainTab === 'programs'
            ? {
                label: t('myWork.projects.label12', 'New program'),
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
                {
                  id: 'active',
                  label: t('myWork.projects.label13', 'Active'),
                  count: stats.active,
                },
                {
                  id: 'completed',
                  label: t('myWork.projects.label14', 'Completed'),
                  count: stats.completed,
                },
                {
                  id: 'archived',
                  label: t('myWork.projects.label15', 'Archived'),
                  count: stats.archived,
                },
              ]
            : [
                { id: 'all', label: t('common.all', 'All'), count: programStats.total },
                {
                  id: 'active',
                  label: t('myWork.projects.label16', 'Active'),
                  count: programStats.active,
                },
                {
                  id: 'on_hold',
                  label: t('myWork.projects.label17', 'On hold'),
                  count: programStats.onHold,
                },
                {
                  id: 'completed',
                  label: t('myWork.projects.label18', 'Completed'),
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
                title: t('myWork.projects.title', 'No programs yet'),
                description: t(
                  'myWork.projects.description',
                  'A program groups multiple projects under a shared finance rollup.'
                ),
                actionLabel: t('myWork.projects.actionLabel', 'New program'),
                onAction: () => {
                  setEditingProgram(null);
                  setIsProgramModalOpen(true);
                },
              }}
              selectedRowId={programPreviewId}
              onRowClick={(row) => {
                jedenPanel.otworz();
                setProgramPreviewId(String(row.id));
              }}
              rowMenu={programRowMenu}
              defaultSort={{ columnId: 'createdAt', direction: 'desc' }}
              persistKey="mywork.programs.list"
            />
          </div>

          <JedenPrawyPanel rekord={previewProgramListRow ? (
              <StandardPreview
                title={programRollup?.program.name || previewProgramListRow.name}
                onClose={() => setProgramPreviewId(null)}
                meta={{
                  pills: [
                    {
                      // ★ Znalezisko 203-polski (zwornik-projects, 2026-09-02):
                      // ta pill czytała SUROWY status ('active') podczas gdy
                      // ta sama wartość w kolumnie tabeli obok (domyślny
                      // render EntityStatusChip → statusChip.active) mówi
                      // „Aktywne". `statusChipLabel` to ten sam mechanizm
                      // bez powłoki chipa — jeden SSOT dla obu miejsc.
                      label: statusChipLabel(previewProgramListRow.status || 'active', t),
                      tone: 'neutral',
                    },
                    {
                      label: `${programRollup?.projectCount ?? 0} ${t('myWork.projects.projects2', 'projects')}`,
                      tone: 'neutral',
                    },
                    {
                      label: `${programRollup?.initiativeCount ?? previewProgramListRow.initiativeCount} ${t('myWork.projects.initiatives2', 'initiatives')}`,
                      tone: 'neutral',
                    },
                  ],
                }}
                details={{
                  text:
                    programRollup?.program.description ||
                    previewProgramListRow.description ||
                    t(
                      'myWork.projects.rollupBudgetValueROI',
                      'Rollup: budget/value/ROI summed across the program’s projects.'
                    ),
                }}
                actions={{
                  informational: [
                    {
                      id: 'refresh',
                      variant: 'neutral',
                      label: t('common.refresh', t('myWork.projects.refresh2', 'Refresh')),
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
                      label: t('myWork.projects.label19', 'Edit'),
                      icon: Pencil,
                      onClick: () => {
                        setEditingProgram(previewProgramListRow);
                        setIsProgramModalOpen(true);
                      },
                    },
                    {
                      id: 'delete-program',
                      variant: 'neutral',
                      label: t('myWork.projects.label20', 'Delete'),
                      icon: Trash2,
                      onClick: () => handleDeleteProgram(previewProgramListRow.id),
                    },
                  ],
                }}
              >
                {/* ── Rollup finansowy programu (programRollupService) ─────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary mb-2">
                    {t('myWork.projects.programRollup', 'Program rollup')}
                  </h4>
                  {programRollupLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {t('myWork.projects.loading', 'Loading…')}
                    </p>
                  ) : programRollupError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {programRollupError}
                    </p>
                  ) : !programRollup ? (
                    <p className="text-xs text-c-text-muted">
                      {t('myWork.projects.noData', 'No data.')}
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {t('myWork.projects.budgetContainers', 'Budget (containers)')}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(programRollup.budget.containerTotal, programRollup.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {t('myWork.projects.initiativeBudgets', 'Σ initiative budgets')}
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
                          {t('myWork.projects.valueKPI', 'Value (KPI)')}
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
                          {t('myWork.projects.initiativeHealth', 'Initiative health')}
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
                      {t('myWork.projects.projectsInThisProgram', 'Projects in this program')}
                    </h4>
                  </div>
                  {!programRollup || programRollup.projects.length === 0 ? (
                    <p className="text-xs text-c-text-muted">
                      {t(
                        'myWork.projects.noProjectsAssignedTo',
                        'No projects assigned to this program yet.'
                      )}
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
                            {p.initiativeCount} {t('myWork.projects.initiatives3', 'initiatives')} ·{' '}
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
                      {t('myWork.projects.subPrograms', 'Sub-programs')}
                    </h4>
                    <ul className="space-y-1.5">
                      {programRollup.childPrograms.map((cp) => (
                        <li key={cp.id} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-c-text">{cp.name}</span>
                          <span className="shrink-0 text-c-text-muted">
                            {cp.initiativeCount} {t('myWork.projects.initiatives4', 'initiatives')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </StandardPreview>
          ) : null} />
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
                  t('myWork.projects.noProjectsYet', 'No projects yet')
                ),
                description: t(
                  'myWork.projects.emptyState.description',
                  t(
                    'myWork.projects.projectsCreatedInThe',
                    'Projects created in the Initiatives module will appear here.'
                  )
                ),
              }}
              selectedRowId={previewId}
              onRowClick={(row) => {
                if (!previewPinned) {
                  jedenPanel.otworz();
                  setPreviewId(String(row.id));
                }
              }}
              rowMenu={rowMenu}
              defaultSort={{ columnId: 'created_at', direction: 'desc' }}
              persistKey="mywork.projects.list"
            />
          </div>

          <JedenPrawyPanel rekord={previewProject ? (
              <StandardPreview
                title={previewProject.name || t('myWork.projects.project2', 'Project')}
                onClose={() => {
                  setPreviewId(null);
                  setPreviewPinned(false);
                }}
                pinned={previewPinned}
                onTogglePin={() => setPreviewPinned((v) => !v)}
                meta={{
                  pills: [
                    {
                      // ★ Ten sam znalezisko 203-polski co pill programu wyżej.
                      label: statusChipLabel(previewProject.status || 'active', t),
                      tone: 'neutral',
                    },
                    {
                      label: `${previewProject.memberCount ?? 0} ${t('myWork.projects.members2', 'members')}`,
                      tone: 'neutral',
                    },
                    {
                      label: `${previewProject.initiativeCount ?? 0} ${t('myWork.projects.initiatives5', 'initiatives')}`,
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
                  text: t(
                    'myWork.projects.text',
                    'Zwornik: project stakeholder registry and finance rollup (read-only).'
                  ),
                }}
                actions={previewActions}
              >
                {/* ── Zwornik Delta A: efektywni stakeholderzy (§3.3) ──────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-c-text-secondary" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary">
                      {t('myWork.projects.stakeholdersEffective', 'Stakeholders (effective)')}
                    </h4>
                  </div>
                  {stakeholdersLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {t('myWork.projects.loading2', 'Loading…')}
                    </p>
                  ) : stakeholdersError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {stakeholdersError}
                    </p>
                  ) : stakeholders.length === 0 ? (
                    <p className="text-xs text-c-text-muted">
                      {t(
                        'myWork.projects.noStakeholdersForThis',
                        'No stakeholders for this project yet.'
                      )}
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
                                title={t('myWork.projects.inheritedFromOrg', 'Inherited from org')}
                              >
                                {t('myWork.projects.inherited', 'inherited')}
                              </span>
                            ) : null}
                            {s.assessmentRedacted ? (
                              <span
                                className="text-[10px] text-c-text-muted"
                                title={t(
                                  'myWork.projects.influenceInterestHiddenMissing',
                                  'Influence/interest hidden — missing stakeholder.assessment.view'
                                )}
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
                    {t('myWork.projects.financeRollup', 'Finance rollup')}
                  </h4>
                  {financeLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {t('myWork.projects.loading3', 'Loading…')}
                    </p>
                  ) : financeError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {financeError}
                    </p>
                  ) : !finance ? (
                    <p className="text-xs text-c-text-muted">
                      {t('myWork.projects.noFinanceData', 'No finance data.')}
                    </p>
                  ) : (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {t('myWork.projects.projectBudget', 'Project budget')}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.budget?.containerTotal, finance.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {t(
                            'myWork.projects.initiativeBudgetsPlanned',
                            'Σ initiative budgets (planned)'
                          )}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.initiativesBudget?.totalPlanned, finance.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {t(
                            'myWork.projects.initiativeBudgetsActual',
                            'Σ initiative budgets (actual)'
                          )}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.initiativesBudget?.totalActual, finance.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-c-text-muted">
                          {t('myWork.projects.valueKPI2', 'Value (KPI)')}
                        </span>
                        <span className="font-semibold text-c-text">
                          {formatMoney(finance.value?.total, finance.currency)}
                        </span>
                      </div>
                      {finance.roi?.avgExpectedRoiPercent != null ? (
                        <div className="flex justify-between">
                          <span className="text-c-text-muted">
                            {t('myWork.projects.avgExpectedROI', 'Avg expected ROI')}
                          </span>
                          <span className="font-semibold text-c-text">
                            {finance.roi.avgExpectedRoiPercent.toFixed(1)}%
                          </span>
                        </div>
                      ) : null}
                      {finance.variance?.overCommitted ? (
                        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={12} />
                          {t(
                            'myWork.projects.initiativeBudgetsExceedThe',
                            'Σ initiative budgets exceed the project budget (soft warning).'
                          )}
                        </p>
                      ) : null}
                    </div>
                  )}
                </div>

                {/* ── Zwornik (#78): Zespół — członkowie projektu ──────────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3 mt-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={14} className="text-c-text-secondary" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary">
                      {t('myWork.projects.team', 'Team')}
                    </h4>
                    {team.length > 0 ? (
                      <span className="ml-auto text-[10px] font-semibold text-c-text-muted">
                        {team.length}
                      </span>
                    ) : null}
                  </div>
                  {teamLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {t('myWork.projects.loading4', 'Loading…')}
                    </p>
                  ) : teamError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {teamError}
                    </p>
                  ) : team.length === 0 ? (
                    <p className="text-xs text-c-text-muted">
                      {t(
                        'myWork.projects.noTeamMembersFor',
                        'No team members for this project yet.'
                      )}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {team.map((m, idx) => (
                        <li
                          key={`${m.id || m.user_id || m.email || idx}`}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="truncate text-c-text">{memberLabel(m)}</span>
                          {m.role ? (
                            <span className="shrink-0 px-1.5 py-0.5 rounded bg-c-surface-raised text-[10px] font-semibold text-c-text-secondary">
                              {String(m.role).toUpperCase()}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ── Zwornik (#78): Role — przypisania ról projektowych ────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3 mt-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield size={14} className="text-c-text-secondary" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary">
                      {t('myWork.projects.rolesAssignments', 'Roles (assignments)')}
                    </h4>
                  </div>
                  {teamLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {t('myWork.projects.loading5', 'Loading…')}
                    </p>
                  ) : teamError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {teamError}
                    </p>
                  ) : roleGroups.length === 0 ? (
                    <p className="text-xs text-c-text-muted">
                      {t('myWork.projects.noRolesAssignedYet', 'No roles assigned yet.')}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {roleGroups.map(({ role, members }) => (
                        <li key={role} className="flex items-center justify-between gap-2 text-xs">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <span className="px-1.5 py-0.5 rounded bg-c-surface-raised text-[10px] font-semibold text-c-text-secondary shrink-0">
                              {role}
                            </span>
                            <span className="truncate text-c-text-muted">
                              {members.map((m) => memberLabel(m)).join(', ')}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold text-c-text">
                            {members.length}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* ── Zwornik (#78): Zadania — zadania projektu ─────────────── */}
                <div className="rounded-xl border border-c-border-subtle bg-c-surface p-3 mt-2.5">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardList size={14} className="text-c-text-secondary" />
                    <h4 className="text-xs font-bold uppercase tracking-wide text-c-text-secondary">
                      {t('myWork.projects.tasks', 'Tasks')}
                    </h4>
                    {tasks.length > 0 ? (
                      <span className="ml-auto text-[10px] font-semibold text-c-text-muted">
                        {tasks.length}
                      </span>
                    ) : null}
                  </div>
                  {tasksLoading ? (
                    <p className="text-xs text-c-text-muted animate-pulse">
                      {t('myWork.projects.loading6', 'Loading…')}
                    </p>
                  ) : tasksError ? (
                    <p className="text-xs text-danger-500 flex items-center gap-1.5">
                      <AlertTriangle size={12} /> {tasksError}
                    </p>
                  ) : tasks.length === 0 ? (
                    <p className="text-xs text-c-text-muted">
                      {t('myWork.projects.noTasksForThis', 'No tasks for this project yet.')}
                    </p>
                  ) : (
                    <ul className="space-y-1.5">
                      {tasks.slice(0, 12).map((task, idx) => {
                        const who = assigneeLabel(task.assignee);
                        return (
                          <li
                            key={`${task.id || idx}`}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="truncate text-c-text">{task.title || '—'}</span>
                            <span className="flex items-center gap-1.5 shrink-0">
                              {who ? (
                                <span className="text-[10px] text-c-text-muted">{who}</span>
                              ) : null}
                              {task.status ? (
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${taskStatusTone(
                                    task.status
                                  )}`}
                                >
                                  {String(task.status).replace(/_/g, ' ')}
                                </span>
                              ) : null}
                            </span>
                          </li>
                        );
                      })}
                      {tasks.length > 12 ? (
                        <li className="text-[10px] text-c-text-muted pt-1">
                          {isPolish
                            ? `+${tasks.length - 12} więcej…`
                            : `+${tasks.length - 12} more…`}
                        </li>
                      ) : null}
                    </ul>
                  )}
                </div>
              </StandardPreview>
          ) : null} />
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
