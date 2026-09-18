import {
  ArrowLeft,
  CalendarDays,
  ClipboardList,
  FileText,
  Flag,
  FolderKanban,
  Landmark,
  Link2,
  Users,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import { ArtifactRightPanel, type ArtifactRightPanelSection } from '@/components/standard/ArtifactRightPanel';
import { StandardModuleBar, StandardTable, type TableColumn, type TableRow } from '@/components/standard';
import { Api } from '@/services/api';
import { ROUTES } from '@/routes/routeConfig';
import { formatListDate } from '@/utils/listDateFormat';

interface ProjectMemberRow {
  id?: string;
  user_id?: string;
  userId?: string;
  first_name?: string | null;
  firstName?: string | null;
  last_name?: string | null;
  lastName?: string | null;
  email?: string | null;
  role?: string | null;
  account_role?: string | null;
}

interface ProjectLinkedRow {
  id: string;
  name?: string;
  title?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  type?: string;
}

interface ProjectDetails {
  id: string;
  name?: string;
  description?: string | null;
  goal?: string | null;
  status?: string | null;
  health?: string | null;
  current_phase?: string | null;
  currentPhase?: string | null;
  owner_first_name?: string | null;
  ownerFirstName?: string | null;
  owner_last_name?: string | null;
  ownerLastName?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  team?: ProjectMemberRow[];
  members?: ProjectMemberRow[];
  initiatives?: ProjectLinkedRow[];
  tasks?: ProjectLinkedRow[];
  assessments?: ProjectLinkedRow[];
  documents?: ProjectLinkedRow[];
  workstreams?: ProjectLinkedRow[];
}

const valueOrDash = (value: unknown): string => {
  const text = value == null ? '' : String(value).trim();
  return text || '—';
};

const personName = (member: ProjectMemberRow): string => {
  const first = member.firstName ?? member.first_name ?? '';
  const last = member.lastName ?? member.last_name ?? '';
  return `${first} ${last}`.trim() || member.email || member.userId || member.user_id || member.id || '—';
};

const normalizeRows = (rows: ProjectLinkedRow[] | undefined): TableRow[] =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    ...row,
    id: row.id,
    displayName: row.name || row.title || row.id,
    statusLabel: row.status ? String(row.status).replace(/_/g, ' ') : '—',
    dateLabel: formatListDate(row.updated_at || row.created_at || undefined, '—'),
  }));

export function ProjectDetailScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'initiatives' | 'tasks' | 'documents'>('initiatives');

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await Api.getProjectDetails(projectId);
      setProject(data as ProjectDetails);
    } catch (err: any) {
      setError(err?.message || t('myWork.projects.detail.loadFailed', 'Failed to load project.'));
    } finally {
      setLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const owner = useMemo(() => {
    if (!project) return '—';
    const first = project.ownerFirstName ?? project.owner_first_name ?? '';
    const last = project.ownerLastName ?? project.owner_last_name ?? '';
    return `${first} ${last}`.trim() || '—';
  }, [project]);

  const team = project?.team || project?.members || [];
  const initiatives = normalizeRows(project?.initiatives);
  const tasks = normalizeRows(project?.tasks);
  const documents = normalizeRows(project?.documents);

  const columns: TableColumn[] = useMemo(
    () => [
      { key: 'displayName', label: t('myWork.projects.detail.columns.name', 'Name'), sortable: true },
      { key: 'statusLabel', label: t('myWork.projects.detail.columns.status', 'Status'), width: '140px' },
      { key: 'dateLabel', label: t('myWork.projects.detail.columns.updated', 'Updated'), width: '150px' },
    ],
    [t]
  );

  const currentRows = activeTab === 'initiatives' ? initiatives : activeTab === 'tasks' ? tasks : documents;

  const rightPanelSections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('common.actions', 'Actions'),
      icon: Flag,
      defaultOpen: true,
      children: (
        <div className="space-y-2 text-xs text-c-text-secondary">
          <button
            type="button"
            onClick={() => navigate(ROUTES.PROJECTS)}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-c-border-subtle px-3 py-2 font-semibold text-c-text hover:bg-c-surface-hover focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <ArrowLeft size={14} />
            {t('myWork.projects.detail.backToList', 'Back to projects')}
          </button>
          <p>{t('myWork.projects.detail.actionsHint', 'Project edits and governance actions stay in the existing project panels until PMO-1b is accepted.')}</p>
        </div>
      ),
    },
    {
      id: 'properties',
      label: t('common.properties', 'Properties'),
      icon: Landmark,
      defaultOpen: true,
      children: (
        <dl className="space-y-2 text-xs">
          <div className="flex justify-between gap-3"><dt className="text-c-text-muted">{t('common.status', 'Status')}</dt><dd className="font-semibold text-c-text">{valueOrDash(project?.status)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-c-text-muted">{t('myWork.projects.phase', 'Phase')}</dt><dd className="font-semibold text-c-text">{valueOrDash(project?.currentPhase ?? project?.current_phase)}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-c-text-muted">{t('myWork.projects.owner', 'Owner')}</dt><dd className="font-semibold text-c-text">{owner}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-c-text-muted">{t('myWork.projects.created', 'Created')}</dt><dd className="font-semibold text-c-text">{formatListDate(project?.created_at || undefined, '—')}</dd></div>
        </dl>
      ),
    },
    {
      id: 'relations',
      label: t('common.relations', 'Relations'),
      icon: Link2,
      badge: initiatives.length + tasks.length + documents.length,
      children: (
        <div className="space-y-1 text-xs text-c-text-secondary">
          <p>{t('myWork.projects.detail.relationsInitiatives', '{{count}} initiatives', { count: initiatives.length })}</p>
          <p>{t('myWork.projects.detail.relationsTasks', '{{count}} tasks', { count: tasks.length })}</p>
          <p>{t('myWork.projects.detail.relationsDocuments', '{{count}} documents', { count: documents.length })}</p>
        </div>
      ),
    },
    {
      id: 'evidence',
      label: t('common.sourcesAndAssumptions', 'Sources and assumptions'),
      icon: FileText,
      children: <p className="text-xs text-c-text-secondary">{t('myWork.projects.detail.evidenceHint', 'This screen reads the existing project, team, initiative, task and document records. It does not create a new project data model.')}</p>,
    },
    {
      id: 'comments',
      label: t('common.comments', 'Comments'),
      icon: Users,
      isEmpty: true,
      emptyLabel: t('myWork.projects.detail.noComments', 'No project comments are shown here yet.'),
      children: null,
    },
    {
      id: 'history',
      label: t('common.history', 'History'),
      icon: CalendarDays,
      children: <p className="text-xs text-c-text-secondary">{t('myWork.projects.detail.historyHint', 'History will use the accepted PMO and DOC-0 audit streams when those packages are on the line.')}</p>,
    },
  ];

  if (!projectId) {
    return <div className="p-6 text-sm text-c-text-secondary">{t('myWork.projects.detail.missingId', 'Project id is missing.')}</div>;
  }

  if (loading) {
    return <div className="p-6 text-sm text-c-text-secondary">{t('common.loading', 'Loading…')}</div>;
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="rounded-xl border border-c-border-subtle bg-c-surface p-4">
          <p className="text-sm font-semibold text-c-text">{error || t('myWork.projects.detail.notFound', 'Project was not found.')}</p>
          <button
            type="button"
            onClick={() => navigate(ROUTES.PROJECTS)}
            className="mt-3 inline-flex items-center gap-2 rounded-lg border border-c-border-subtle px-3 py-2 text-sm font-semibold text-c-text hover:bg-c-surface-hover focus:outline-none focus:ring-2 focus:ring-c-focus"
          >
            <ArrowLeft size={14} /> {t('myWork.projects.detail.backToList', 'Back to projects')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 p-4" data-testid="project-detail-screen">
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_340px] gap-4">
        <main className="min-w-0 overflow-auto rounded-2xl border border-c-border-subtle bg-c-surface">
          <div className="border-b border-c-border-subtle p-4">
            <button
              type="button"
              onClick={() => navigate(ROUTES.PROJECTS)}
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-c-text-secondary hover:text-c-text focus:outline-none focus:ring-2 focus:ring-c-focus"
            >
              <ArrowLeft size={16} /> {t('myWork.projects.detail.backToList', 'Back to projects')}
            </button>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-c-text-muted">{t('myWork.projects.project', 'Project')}</p>
                <h1 className="truncate text-2xl font-bold text-c-text">{valueOrDash(project.name)}</h1>
                {project.description ? <p className="mt-2 max-w-3xl text-sm text-c-text-secondary">{project.description}</p> : null}
              </div>
              <span className="rounded-full border border-c-border-subtle px-3 py-1 text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
                {valueOrDash(project.status)}
              </span>
            </div>
          </div>

          <div className="grid gap-3 p-4 sm:grid-cols-4">
            {[
              [t('myWork.projects.initiatives', 'Initiatives'), initiatives.length, FolderKanban],
              [t('myWork.projects.tasks', 'Tasks'), tasks.length, ClipboardList],
              [t('myWork.projects.team', 'Team'), team.length, Users],
              [t('myWork.projects.documents', 'Documents'), documents.length, FileText],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="rounded-xl border border-c-border-subtle bg-c-surface-subtle p-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-c-text-muted">
                  {React.createElement(Icon as any, { size: 14 })}
                  <span>{String(label)}</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-c-text">{String(value)}</p>
              </div>
            ))}
          </div>

          <div className="px-4 pb-4">
            <StandardModuleBar
              breadcrumbs={[
                { label: t('myWork.projects.detail.workspace', 'Project workspace') },
                { label: valueOrDash(project.name) },
              ]}
              tabs={[
                { id: 'initiatives', label: t('myWork.projects.initiatives', 'Initiatives') },
                { id: 'tasks', label: t('myWork.projects.tasks', 'Tasks') },
                { id: 'documents', label: t('myWork.projects.documents', 'Documents') },
              ]}
              activeTab={activeTab}
              onTabChange={(id) => setActiveTab(id as 'initiatives' | 'tasks' | 'documents')}
              forceCommandRow
              chips={[
                { id: 'initiatives', label: t('myWork.projects.initiatives', 'Initiatives'), count: initiatives.length },
                { id: 'tasks', label: t('myWork.projects.tasks', 'Tasks'), count: tasks.length },
                { id: 'documents', label: t('myWork.projects.documents', 'Documents'), count: documents.length },
              ]}
              activeChip={activeTab}
              onChipChange={(id) => setActiveTab(id as 'initiatives' | 'tasks' | 'documents')}
            >
              <StandardTable
                columns={columns}
                data={currentRows}
                loading={false}
                emptyMessage={t('myWork.projects.detail.emptyTable', 'No records in this project section yet.')}
                persistKey={`project-detail-${activeTab}`}
              />
            </StandardModuleBar>
          </div>
        </main>

        <ArtifactRightPanel
          sections={rightPanelSections}
          ariaLabel={t('myWork.projects.detail.panelLabel', 'Project details panel')}
        />
      </div>
    </div>
  );
}
