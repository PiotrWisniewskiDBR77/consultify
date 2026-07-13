/**
 * InitiativesTable
 *
 * Table view for transformation initiatives in Assessment Module:
 * - Shows only DRAFT and PLANNING status initiatives
 * - When status changes to REVIEW, initiative moves to Initiative Management module
 * - Includes status dropdown for transitions and completeness checker
 */

import {
  ArrowRight,
  Building2,
  Copy,
  Eye,
  Lightbulb,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type StandardRowMenu,
  StandardTable,
  type TableColumn as StandardTableColumn,
} from '@/components/standard';
import { LoadingState, StatusChip } from '@/components/ui/primitives';

import { getStatusesForModule, getStatusMeta } from '../../services/initiativeLifecycle';
import { InitiativeStatus } from '../../types';
import { InitiativeCompletenessChecker } from '../PMO/InitiativeCompletenessChecker';
import { StatusTransitionDropdown } from '../PMO/StatusTransitionDropdown';
import { GenerateInitiativesModal } from './modals/GenerateInitiativesModal';
import { InitiativeDetailsModal } from './modals/InitiativeDetailsModal';
import { TransferToRoadmapModal } from './modals/TransferToRoadmapModal';

interface Initiative {
  id: string;
  name: string;
  description: string;
  reportId: string;
  reportName: string;
  sourceId?: string;
  sourceType?: string;
  projectId?: string;
  projectName?: string;
  locationId?: string;
  locationName?: string;
  axis: string;
  status: InitiativeStatus;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  estimatedROI: number;
  estimatedBudget: number;
  timeline: string;
  charterCompleteness?: number;
  ownerBusiness?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  ownerExecution?: { id: string; firstName: string; lastName: string; avatarUrl?: string };
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  // Charter fields for completeness check
  summary?: string;
  problemStatement?: string;
  hypothesis?: string;
  businessValue?: string | number;
  costCapex?: number;
  costOpex?: number;
  expectedRoi?: number;
  ownerBusinessId?: string;
  ownerExecutionId?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  deliverables?: string[];
  successCriteria?: string[];
  keyRisks?: string[];
}

// Map API response to Initiative interface
const mapApiToInitiative = (item: any): Initiative => ({
  id: item.id,
  name: item.name || 'Unnamed Initiative',
  description: item.summary || item.description || '',
  summary: item.summary,
  problemStatement: item.problemStatement,
  hypothesis: item.hypothesis,
  businessValue: item.businessValue,
  sourceId: item.sourceId || item.source_id,
  sourceType: item.sourceType || item.source_type,
  reportId: item.reportId || '',
  reportName: item.reportName || item.projectId || '',
  projectId: item.projectId,
  projectName: item.projectName,
  locationId: item.locationId,
  locationName: item.locationName,
  axis: item.axis || '',
  status: (String(item.status || '').toUpperCase() as InitiativeStatus) || InitiativeStatus.DRAFT,
  priority: (
    item.priority ||
    item.businessValue ||
    'MEDIUM'
  ).toUpperCase() as Initiative['priority'],
  estimatedROI: item.expectedRoi || item.estimatedROI || 0,
  estimatedBudget: item.costCapex || item.estimatedBudget || 0,
  costCapex: item.costCapex,
  costOpex: item.costOpex,
  expectedRoi: item.expectedRoi,
  timeline: item.timeline || 'Q1-Q4 2025',
  charterCompleteness: item.charterCompleteness || 0,
  ownerBusiness: item.ownerBusiness,
  ownerExecution: item.ownerExecution,
  ownerBusinessId: item.ownerBusinessId || item.ownerBusiness?.id,
  ownerExecutionId: item.ownerExecutionId || item.ownerExecution?.id,
  plannedStartDate: item.plannedStartDate,
  plannedEndDate: item.plannedEndDate,
  deliverables: item.deliverables || [],
  successCriteria: item.successCriteria || [],
  keyRisks: item.keyRisks || [],
  createdAt: item.createdAt,
  updatedAt: item.updatedAt || item.createdAt,
  createdBy: item.createdBy || undefined,
});

const ASSESSMENT_STATUSES = getStatusesForModule('assessment');
const STATUS_TABS = ASSESSMENT_STATUSES.length ? ASSESSMENT_STATUSES : [InitiativeStatus.DRAFT];

type FilterStatus = 'all' | InitiativeStatus;

type AssessmentFramework = 'DRD' | 'SIRI' | 'ADMA' | 'CMMI' | 'LEAN';

interface InitiativesTableProps {
  projectId: string;
  framework?: AssessmentFramework;
  pendingReportId?: string | null;
  assessmentId?: string;
  onOpenInitiative?: (initiativeId: string, initiativeName: string, status?: string) => void;
}

const PRIORITY_TONE: Record<string, 'neutral' | 'warning' | 'danger'> = {
  LOW: 'neutral',
  MEDIUM: 'warning',
  HIGH: 'warning',
  CRITICAL: 'danger',
};

export const InitiativesTable: React.FC<InitiativesTableProps> = ({
  projectId,
  pendingReportId,
  assessmentId,
  onOpenInitiative,
}) => {
  // State
  const [initiatives, setInitiatives] = useState<Initiative[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterProject, setFilterProject] = useState<string>('');
  const [filterLocation, setFilterLocation] = useState<string>('');
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(!!pendingReportId);
  const [viewingInitiativeId, setViewingInitiativeId] = useState<string | null>(null);
  const [transferringInitiativeId, setTransferringInitiativeId] = useState<string | null>(null);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [locations, setLocations] = useState<{ id: string; name: string }[]>([]);

  // Fetch initiatives - only DRAFT and PLANNING for Assessment module
  const fetchInitiatives = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('token');
      // Fetch only assessment module initiatives
      const statuses = STATUS_TABS.join(',');
      const url = `/api/initiatives/by-status/${statuses}${projectId ? `?projectId=${projectId}` : ''}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        // Map API response to Initiative interface
        const mapped = (data.initiatives || []).map(mapApiToInitiative);
        setInitiatives(mapped);

        // Extract unique projects and locations for filters
        const uniqueProjects = new Map<string, string>();
        const uniqueLocations = new Map<string, string>();
        mapped.forEach((i: Initiative) => {
          if (i.projectId && i.projectName) {
            uniqueProjects.set(i.projectId, i.projectName);
          }
          if (i.locationId && i.locationName) {
            uniqueLocations.set(i.locationId, i.locationName);
          }
        });
        setProjects(Array.from(uniqueProjects, ([id, name]) => ({ id, name })));
        setLocations(Array.from(uniqueLocations, ([id, name]) => ({ id, name })));
      }
    } catch (err) {
      console.error('[InitiativesTable] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchInitiatives();
  }, [fetchInitiatives]);

  // Handle status change from dropdown
  const handleStatusChange = useCallback(
    (initiativeId: string, newStatus: InitiativeStatus, moduleTransition?: any) => {
      // If initiative moved to REVIEW, it leaves this module
      if (newStatus === InitiativeStatus.REVIEW) {
        // Remove from list (it's now in Initiative Management module)
        setInitiatives((prev) => prev.filter((i) => i.id !== initiativeId));
      } else {
        // Update status locally
        setInitiatives((prev) =>
          prev.map((i) => (i.id === initiativeId ? { ...i, status: newStatus } : i))
        );
      }
    },
    []
  );

  // Delete initiative
  const handleDelete = async (initiativeId: string) => {
    if (!confirm('Are you sure you want to delete this initiative?')) return;

    try {
      const token = localStorage.getItem('token');
      await fetch(`/api/initiatives/${initiativeId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchInitiatives();
    } catch (err) {
      console.error('[InitiativesTable] Delete error:', err);
    }
  };

  // Filter initiatives
  const filteredInitiatives = initiatives.filter((initiative) => {
    if (assessmentId) {
      if (!initiative.sourceId || initiative.sourceId !== assessmentId) return false;
    }
    // Status filter
    if (filterStatus !== 'all') {
      if (initiative.status !== filterStatus) return false;
    }

    // Project filter
    if (filterProject && initiative.projectId !== filterProject) return false;

    // Location filter
    if (filterLocation && initiative.locationId !== filterLocation) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        initiative.name.toLowerCase().includes(query) ||
        initiative.description.toLowerCase().includes(query) ||
        (initiative.projectName || '').toLowerCase().includes(query) ||
        (initiative.locationName || '').toLowerCase().includes(query)
      );
    }

    return true;
  });

  // Format currency
  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M PLN`;
    }
    if (amount >= 1000) {
      return `${(amount / 1000).toFixed(0)}k PLN`;
    }
    return `${amount} PLN`;
  };

  // Stats
  const stats = STATUS_TABS.reduce(
    (acc, status) => {
      acc.byStatus[status] = initiatives.filter((i) => i.status === status).length;
      return acc;
    },
    {
      total: initiatives.length,
      byStatus: {} as Record<InitiativeStatus, number>,
    }
  );

  const formatStatusList = (statuses: InitiativeStatus[]) => {
    const labels = statuses.map((status) => getStatusMeta(status).label.toLowerCase());
    if (labels.length <= 1) return labels[0] || 'draft';
    if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
    return `${labels.slice(0, -1).join(', ')}, and ${labels[labels.length - 1]}`;
  };

  // Open initiative — 1:1 z dawnym inline handlerem (nazwa + strzałka + kebab).
  const openInitiative = useCallback(
    (initiative: Initiative) => {
      if (onOpenInitiative) {
        onOpenInitiative(initiative.id, initiative.name, initiative.status);
      } else {
        setViewingInitiativeId(initiative.id);
      }
    },
    [onOpenInitiative]
  );

  // Triada standard (kanon §1, migracja bespoke tabeli #27-todo): kolumny
  // deklaratywne StandardTable — 1:1 z dawnymi komórkami <tr>.
  const columns: StandardTableColumn[] = useMemo(
    () => [
      {
        id: 'name',
        label: 'Initiative',
        width: '320px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          return (
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg shrink-0">
                <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openInitiative(initiative)}
                    className="font-medium text-navy-900 dark:text-white hover:underline transition-colors text-left truncate"
                  >
                    {initiative.name}
                  </button>
                  <button
                    onClick={() => openInitiative(initiative)}
                    className="p-1 text-slate-600 dark:text-slate-500 hover:text-navy-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded transition-colors shrink-0"
                    title="Open initiative details"
                  >
                    <ArrowRight size={14} />
                  </button>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {initiative.description}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-500 mt-1">
                  <span>{initiative.axis}</span>
                  {initiative.projectName && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Building2 size={10} />
                        {initiative.projectName}
                      </span>
                    </>
                  )}
                  {initiative.locationName && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin size={10} />
                        {initiative.locationName}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        id: 'status',
        label: 'Status',
        width: '190px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          return (
            <StatusTransitionDropdown
              initiativeId={initiative.id}
              currentStatus={initiative.status}
              charterCompleteness={initiative.charterCompleteness}
              onStatusChange={(newStatus, moduleTransition) =>
                handleStatusChange(initiative.id, newStatus, moduleTransition)
              }
              size="sm"
            />
          );
        },
      },
      {
        id: 'completeness',
        label: 'Completeness',
        width: '120px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          return <InitiativeCompletenessChecker initiative={initiative} compact className="w-24" />;
        },
      },
      {
        id: 'owner',
        label: 'Owner',
        width: '110px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          const owner = initiative.ownerBusiness;
          if (!owner) {
            return <span className="text-xs text-slate-600 dark:text-slate-500 italic">Unassigned</span>;
          }
          return (
            <div
              className="flex items-center gap-2 cursor-default"
              title={`${owner.firstName} ${owner.lastName}`}
            >
              <div className="w-7 h-7 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-medium text-amber-700 dark:text-amber-300 overflow-hidden shrink-0">
                {owner.avatarUrl ? (
                  <img src={owner.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  `${owner.firstName[0]}${owner.lastName[0]}`
                )}
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400 truncate max-w-[80px]">
                {owner.firstName}
              </span>
            </div>
          );
        },
      },
      {
        id: 'priority',
        label: 'Priority',
        width: '100px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          return (
            <StatusChip
              label={initiative.priority}
              tone={PRIORITY_TONE[initiative.priority] ?? 'neutral'}
            />
          );
        },
      },
      {
        id: 'budget',
        label: 'Budget',
        width: '130px',
        render: (row) => {
          const initiative = row as unknown as Initiative;
          return (
            <div className="text-sm">
              <span className="font-medium text-navy-900 dark:text-white">
                {formatCurrency(initiative.estimatedBudget)}
              </span>
              {initiative.estimatedROI > 0 && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={12} />
                  <span>{initiative.estimatedROI}x ROI</span>
                </div>
              )}
            </div>
          );
        },
      },
    ],
    [openInitiative, handleStatusChange]
  );

  // Triada standard (StandardTable rowMenu contract, ANEKS #4): moduł deklaruje
  // TYLKO bloki 1-3; StandardTable SAM dokłada bloki 4 (Open preview · Edit ·
  // Archive) i 5 (Delete). 1:1 z dawnym dropdownem "More" wiersza — Duplicate
  // był w oryginale bez handlera (martwy przycisk), więc zostaje disabled z
  // notą zamiast pozornie działającego CTA.
  const buildRowMenu = useCallback(
    (row: Record<string, unknown>): StandardRowMenu => {
      const initiative = row as unknown as Initiative;
      const canDelete =
        initiative.status === InitiativeStatus.DRAFT ||
        initiative.status === InitiativeStatus.PLANNING;
      return {
        primary: [
          {
            id: 'view-details',
            label: 'View Details',
            icon: Eye,
            onClick: () => openInitiative(initiative),
          },
          {
            id: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
          },
        ],
        universalHandlers: {
          preview: () => openInitiative(initiative),
          edit: () => openInitiative(initiative),
        },
        destructive: canDelete
          ? { onClick: () => handleDelete(initiative.id) }
          : { note: 'Only draft/planning initiatives can be deleted here' },
      };
    },
    [openInitiative, handleDelete]
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-slate-200 dark:border-navy-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-navy-900 dark:text-white">
              Strategic Initiatives Board
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Initiatives in {formatStatusList(STATUS_TABS)} phase • {stats.total} total
            </p>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-navy-900 hover:bg-navy-800 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] font-medium rounded-lg transition-colors"
          >
            <Sparkles size={18} />
            Generate from Report
          </button>
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3 mt-4">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 dark:bg-navy-950 rounded-lg p-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                filterStatus === 'all'
                  ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
              }`}
            >
              All ({stats.total})
            </button>
            {STATUS_TABS.map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  filterStatus === status
                    ? 'bg-white dark:bg-navy-800 text-navy-900 dark:text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-300 dark:hover:text-slate-300'
                }`}
              >
                {getStatusMeta(status).label} ({stats.byStatus[status] ?? 0})
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10" />

          {/* Project Filter */}
          {projects.length > 0 && (
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {/* Location Filter */}
          {locations.length > 0 && (
            <select
              value={filterLocation}
              onChange={(e) => setFilterLocation(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white dark:bg-navy-950 border border-slate-200 dark:border-navy-700 rounded-lg text-navy-900 dark:text-white"
            >
              <option value="">All Locations</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          <div className="flex-1" />

          {/* Search */}
          <div className="relative w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
              size={16}
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search initiatives..."
              className="w-full pl-9 pr-4 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-950 text-navy-900 dark:text-white"
            />
          </div>

          <button
            onClick={fetchInitiatives}
            className="p-1.5 text-slate-600 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg"
            title="Refresh"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl overflow-hidden">
          <StandardTable
            columns={columns}
            data={filteredInitiatives as unknown as Array<Record<string, unknown> & { id: string }>}
            loading={isLoading}
            empty={{
              title: searchQuery ? 'No initiatives match your search' : 'No initiatives yet',
              description: 'Generate initiatives from a finalized report',
              icon: Lightbulb,
            }}
            onRowDoubleClick={(row) => openInitiative(row as unknown as Initiative)}
            rowMenu={buildRowMenu}
            persistKey="assessment.initiatives-table.list"
            density="compact"
            canvasClassName="p-0"
          />
        </div>
      </div>


      {/* Initiative Details Modal */}
      {viewingInitiativeId && (
        <InitiativeDetailsModal
          initiativeId={viewingInitiativeId}
          onClose={() => setViewingInitiativeId(null)}
          onEdit={(id) => {
            const initiative = initiatives.find((i) => i.id === id);
            if (initiative) {
              setEditingInitiative(initiative);
            }
            setViewingInitiativeId(null);
          }}
          onDelete={(id) => {
            handleDelete(id);
            setViewingInitiativeId(null);
          }}
        />
      )}

      {/* Transfer to Roadmap Modal */}
      {transferringInitiativeId && (
        <TransferToRoadmapModal
          initiativeId={transferringInitiativeId}
          initiativeName={
            initiatives.find((i) => i.id === transferringInitiativeId)?.name || 'Initiative'
          }
          onClose={() => setTransferringInitiativeId(null)}
          onTransferred={() => {
            fetchInitiatives();
            setTransferringInitiativeId(null);
          }}
        />
      )}

      {/* Generate Initiatives Modal */}
      {showGenerateModal && (
        <GenerateInitiativesModal
          projectId={projectId}
          preselectedReportId={pendingReportId || undefined}
          onClose={() => setShowGenerateModal(false)}
          onGenerated={(count) => {
            fetchInitiatives();
            setShowGenerateModal(false);
          }}
        />
      )}
    </div>
  );
};
