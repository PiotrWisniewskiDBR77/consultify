/**
 * AssessmentTable — ADOPTER TRIADY STANDARD (dowód API).
 *
 * Lista assessmentów (hub „Tools > Licensed") przepięta W CAŁOŚCI na
 * StandardModuleBar + StandardTable + StandardPreview
 * (SSOT: Harvard/wdrozenie-100/_STANDARD_TRIADA_NOTATKA.md + aneksy #2-#5).
 * Moduł deklaruje wyłącznie dane + akcje; cały chrome pochodzi z fasad.
 * ZERO zmian w server/ — używa wyłącznie istniejących Api.*.
 */

import { AlertCircle, FileOutput, FileText, Map, Plus, RefreshCw, Trash2 } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { statusChipTone } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';

import { WorkflowState } from '../../types';

interface Assessment {
  id: string;
  name: string;
  projectName: string;
  status: WorkflowState;
  progress: number;
  completedAxes: number;
  totalAxes: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  canCreateReport: boolean;
}

type FilterStatus = 'all' | 'draft' | 'in_review' | 'approved';

interface AssessmentTableProps {
  projectId: string;
  onOpenInMap: (assessmentId: string) => void;
  onNewAssessment: () => void;
  onCreateReport: (assessmentId: string) => void;
}

const STATUS_FILTER_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'AWAITING_APPROVAL', label: 'Awaiting Approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'ARCHIVED', label: 'Archived' },
];

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export const AssessmentTable: React.FC<AssessmentTableProps> = ({
  projectId,
  onOpenInMap,
  onNewAssessment,
  onCreateReport,
}) => {
  const { t } = useTranslation();

  // ── Dane ─────────────────────────────────────────────────────────────────
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [previewId, setPreviewId] = useState<string | null>(null);
  // Pin (kanon A7.1): przypięty preview nie podmienia się przy klikaniu wierszy.
  const [previewPinned, setPreviewPinned] = useState(false);
  const previewShortcutsRef = useRef<Record<string, () => void>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirmIds, setDeleteConfirmIds] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchAssessments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await Api.listAssessments({ projectId: projectId || undefined });
      setAssessments((data.items || data.assessments || []) as Assessment[]);
    } catch (err: any) {
      console.error('[AssessmentTable] Error:', err);
      setError(String(err?.message || t('assessment.table.loadError', 'Failed to load')));
    } finally {
      setIsLoading(false);
    }
  }, [projectId, t]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  // Esc zamyka preview; skróty akcji (R/O) wg standardPreviewShortcuts (kanon B.24/B.31).
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
      const handler = previewShortcutsRef.current[e.key.toUpperCase()];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewId]);

  // ── Filtrowanie (chipy Menu 3 + lupa) ────────────────────────────────────
  const filteredAssessments = useMemo(
    () =>
      assessments.filter((assessment) => {
        if (filterStatus === 'draft' && assessment.status !== 'DRAFT') return false;
        if (
          filterStatus === 'in_review' &&
          !['IN_REVIEW', 'AWAITING_APPROVAL'].includes(assessment.status)
        )
          return false;
        if (filterStatus === 'approved' && assessment.status !== 'APPROVED') return false;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          return (
            (assessment.name || '').toLowerCase().includes(query) ||
            (assessment.projectName || '').toLowerCase().includes(query)
          );
        }
        return true;
      }),
    [assessments, filterStatus, searchQuery]
  );

  const stats = useMemo(
    () => ({
      total: assessments.length,
      draft: assessments.filter((a) => a.status === 'DRAFT').length,
      inReview: assessments.filter((a) => ['IN_REVIEW', 'AWAITING_APPROVAL'].includes(a.status))
        .length,
      approved: assessments.filter((a) => a.status === 'APPROVED').length,
    }),
    [assessments]
  );

  const previewAssessment = previewId
    ? (assessments.find((a) => a.id === previewId) ?? null)
    : null;

  // ── Delete (istniejące Api.deleteAssessment; potwierdzenie w modalu) ─────
  const runDelete = useCallback(async () => {
    if (!deleteConfirmIds?.length) return;
    setIsDeleting(true);
    try {
      for (const id of deleteConfirmIds) {
        await Api.deleteAssessment(id);
      }
      setSelectedIds(new Set());
      setPreviewId((prev) => (prev && deleteConfirmIds.includes(prev) ? null : prev));
      await fetchAssessments();
    } catch (err) {
      console.error('[AssessmentTable] Delete error:', err);
    } finally {
      setIsDeleting(false);
      setDeleteConfirmIds(null);
    }
  }, [deleteConfirmIds, fetchAssessments]);

  // ── Kolumny StandardTable ────────────────────────────────────────────────
  const columns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'name',
        label: t('assessment.table.assessment', 'Assessment'),
        width: '280px',
        sortable: true,
      },
      {
        id: 'status',
        label: t('assessment.table.status', 'Status'),
        width: '160px',
        sortable: true,
        filterable: true,
        filterOptions: STATUS_FILTER_OPTIONS,
      },
      {
        id: 'progress',
        label: t('assessment.table.progress', 'Progress'),
        width: '160px',
        sortable: true,
        sortAccessor: (row: TableRow) => Number(row.progress) || 0,
      },
      {
        id: 'updatedAt',
        label: t('assessment.table.updated', 'Updated'),
        width: '140px',
        sortable: true,
        sortAccessor: (row: TableRow) => String(row.updatedAt || ''),
      },
    ],
    [t]
  );

  // ── Kebab — kontrakt 5 bloków (moduł deklaruje TYLKO bloki 1-3) ──────────
  const rowMenu = useCallback(
    (row: TableRow): StandardRowMenu => {
      const assessment = row as unknown as Assessment;
      return {
        primary: [
          {
            id: 'open-map',
            label:
              assessment.status === 'DRAFT'
                ? t('assessment.table.editInMap', 'Edit in Map')
                : t('assessment.table.viewInMap', 'View in Map'),
            icon: Map,
            onClick: () => onOpenInMap(assessment.id),
          },
          ...(assessment.status === 'APPROVED'
            ? [
                {
                  id: 'create-report',
                  label: t('assessment.table.createReport', 'Create Report'),
                  icon: FileOutput,
                  onClick: () => onCreateReport(assessment.id),
                },
              ]
            : []),
        ],
        universalHandlers: {
          preview: () => setPreviewId(assessment.id),
          edit: () => onOpenInMap(assessment.id),
          // Brak API archiwizacji assessmentu — pozycja disabled z notą (aneks #4).
        },
        destructive: {
          onClick: () => setDeleteConfirmIds([assessment.id]),
        },
      };
    },
    [t, onOpenInMap, onCreateReport]
  );

  // ── Preview — 6 bloków (StandardPreview) ────────────────────────────────
  const previewActions: StandardPreviewActions | undefined = previewAssessment
    ? {
        resolutions: [
          {
            id: 'create-report',
            variant: 'positive',
            label: t('assessment.table.createReport', 'Create Report'),
            icon: FileOutput,
            shortcut: 'R',
            onClick: () => onCreateReport(previewAssessment.id),
            disabled: previewAssessment.status !== 'APPROVED',
          },
          {
            id: 'delete',
            variant: 'destructive',
            label: t('common.delete', 'Delete'),
            icon: Trash2,
            onClick: () => setDeleteConfirmIds([previewAssessment.id]),
          },
        ],
        // canon §7.3 — "Open in Map" usunięte: dublowało onOpenFull przekazywane
        // do StandardPreview w tym samym renderze (header ma już Open).
        informational: [
          {
            id: 'refresh',
            variant: 'neutral',
            label: t('common.refresh', 'Refresh'),
            icon: RefreshCw,
            onClick: () => void fetchAssessments(),
          },
        ],
      }
    : undefined;

  // Skróty klawiszowe preview (R/O) — aktywne, gdy preview otwarty.
  previewShortcutsRef.current = standardPreviewShortcuts(previewActions);

  return (
    <div className="h-full flex flex-col">
      {/* MENU 1/2/3 — wyłącznie przez fasadę */}
      <StandardModuleBar
        breadcrumbs={[
          { label: t('nav.tools', 'Tools') },
          { label: t('licensedTools.breadcrumb', 'Licensed') },
          { label: t('assessment.table.title', 'Assessments') },
        ]}
        onSearch={setSearchQuery}
        primaryCta={{
          label: t('assessment.table.new', 'New Assessment'),
          icon: Plus,
          onClick: onNewAssessment,
          testId: 'assessment-new-cta',
        }}
        chips={[
          { id: 'all', label: t('common.all', 'All'), count: stats.total },
          { id: 'draft', label: 'Draft', count: stats.draft },
          { id: 'in_review', label: 'In Review', count: stats.inReview },
          { id: 'approved', label: 'Approved', count: stats.approved },
        ]}
        activeChip={filterStatus}
        onChipChange={(id) => setFilterStatus(id as FilterStatus)}
        bulk={
          selectedIds.size > 0
            ? {
                count: selectedIds.size,
                selectedLabel: t('assessment.table.selectedCount', '{{count}} selected', {
                  count: selectedIds.size,
                }),
                onSelectAll: () =>
                  setSelectedIds(new Set(filteredAssessments.map((a) => String(a.id)))),
                selectAllLabel: t('assessment.table.selectAll', 'Select all'),
                onClear: () => setSelectedIds(new Set()),
                clearLabel: t('assessment.table.clearSelection', 'Clear'),
                actions: [
                  {
                    id: 'bulk-delete',
                    label: t('common.delete', 'Delete'),
                    icon: Trash2,
                    variant: 'danger',
                    onClick: () => setDeleteConfirmIds(Array.from(selectedIds)),
                  },
                ],
              }
            : null
        }
      />

      {/* TABELA + PREVIEW */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto">
          <StandardTable
            columns={columns}
            data={filteredAssessments as unknown as TableRow[]}
            loading={isLoading}
            error={error}
            onRetry={fetchAssessments}
            empty={{
              icon: FileText,
              title: t('assessment.emptyState.title', 'No assessments yet'),
              description: t(
                'assessment.emptyState.description',
                'Create your first assessment to start the diagnosis.'
              ),
              actionLabel: t('assessment.emptyState.createFirst', 'Create First Assessment'),
              onAction: onNewAssessment,
            }}
            selectedRowId={previewId}
            onRowClick={(row) => {
              if (!previewPinned) setPreviewId(String(row.id));
            }}
            onRowDoubleClick={(row) => onOpenInMap(String(row.id))}
            rowMenu={rowMenu}
            rowDescription={(row) => (row.projectName ? String(row.projectName) : null)}
            defaultSort={{ columnId: 'updatedAt', direction: 'desc' }}
            persistKey="assessment.list"
            selection={{ selectedIds, onChange: setSelectedIds }}
          />
        </div>

        {previewAssessment ? (
          <aside className="w-[400px] shrink-0 bg-slate-50 dark:bg-navy-950 p-3 overflow-hidden">
            <StandardPreview
              title={previewAssessment.name || 'Assessment'}
              onClose={() => {
                setPreviewId(null);
                setPreviewPinned(false);
              }}
              onOpenFull={() => onOpenInMap(previewAssessment.id)}
              pinned={previewPinned}
              onTogglePin={() => setPreviewPinned((v) => !v)}
              meta={{
                pills: [
                  {
                    label: String(previewAssessment.status || 'DRAFT'),
                    tone: statusChipTone(previewAssessment.status),
                  },
                  {
                    label: `${previewAssessment.progress ?? 0}%`,
                    tone: 'neutral',
                  },
                  ...(previewAssessment.projectName
                    ? [
                        {
                          label: previewAssessment.projectName,
                          tone: 'neutral' as const,
                          className: 'bg-transparent text-c-text-secondary truncate max-w-[120px]',
                        },
                      ]
                    : []),
                ],
                trailing: (
                  <span className="text-[11px] font-semibold text-c-text-secondary">
                    {formatDate(previewAssessment.updatedAt)}
                  </span>
                ),
              }}
              details={{
                text: [
                  t('assessment.table.axesCompleted', '{{completed}}/{{total}} axes completed', {
                    completed: previewAssessment.completedAxes ?? 0,
                    total: previewAssessment.totalAxes ?? 0,
                  }),
                  previewAssessment.projectName
                    ? `${t('assessment.table.projectLabel', 'Project')}: ${previewAssessment.projectName}`
                    : '',
                  `${t('assessment.table.createdLabel', 'Created')}: ${formatDate(previewAssessment.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join('\n\n'),
                onCopy: () => {
                  void navigator.clipboard?.writeText(
                    `${previewAssessment.name} — ${previewAssessment.status} (${previewAssessment.progress ?? 0}%)`
                  );
                },
              }}
              ai={{
                hints: [
                  t('assessment.table.aiHintSummarize', 'Summarize assessment'),
                  t('assessment.table.aiHintNextSteps', 'Suggest next steps'),
                ],
                disabled: true,
                disabledTooltip: t('assessment.table.comingSoon', 'Coming soon'),
              }}
              relations={
                previewAssessment.projectName
                  ? [{ label: previewAssessment.projectName, icon: FileText }]
                  : []
              }
              actions={previewActions}
            />
          </aside>
        ) : null}
      </div>

      {/* Potwierdzenie usunięcia (wzór MyAssessmentsList; Api.deleteAssessment) */}
      {deleteConfirmIds ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-c-surface rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-danger-100 dark:bg-danger-900/30 rounded-lg">
                <AlertCircle className="w-6 h-6 text-danger-600 dark:text-danger-400" />
              </div>
              <h3 className="text-lg font-bold text-c-text">
                {t('assessment.table.confirmDeleteTitle', 'Confirm Deletion')}
              </h3>
            </div>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              {t(
                'assessment.table.confirmDeleteMessage',
                'Delete {{target}}? This action cannot be undone.',
                {
                  target:
                    deleteConfirmIds.length > 1
                      ? t('assessment.table.deleteTargetPlural', '{{count}} assessments', {
                          count: deleteConfirmIds.length,
                        })
                      : t('assessment.table.deleteTargetSingular', 'this assessment'),
                }
              )}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmIds(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-slate-100 dark:bg-navy-800 hover:bg-slate-200 dark:hover:bg-navy-700 text-slate-700 dark:text-slate-300 font-medium rounded-lg transition-colors"
              >
                {t('assessment.table.cancel', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => void runDelete()}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-danger-600 hover:bg-danger-500 text-white font-medium rounded-lg transition-colors disabled:opacity-60"
              >
                {isDeleting
                  ? t('assessment.table.deleting', 'Deleting…')
                  : t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
