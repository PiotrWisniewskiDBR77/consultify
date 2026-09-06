import { ArrowRight, Layers, Plus, Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '@/components/shared/states';
import { ROUTES } from '@/routes/routeConfig';

import { useAppStore } from '../../store/useAppStore';
import { AxisId, FullInitiative, FullSession, InitiativeStatus, StrategicGoal } from '../../types';
import { InitiativeCard } from '../InitiativeCard';
import { Select } from '../ui/select';

interface FullStep2WorkspaceProps {
  fullSession: FullSession;
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onCreateInitiative: (initiative: FullInitiative) => void;
  onEnrichInitiative?: (id: string) => Promise<void>;
  onNextStep: () => void;
  users?: any[]; // Added
  currentUser?: any; // Added
  strategicGoals?: StrategicGoal[]; // Added
}

export const FullStep2Workspace: React.FC<FullStep2WorkspaceProps> = ({
  fullSession,
  onUpdateInitiative,
  onCreateInitiative,
  onEnrichInitiative,
  onNextStep,
  users = [], // Default to empty array
  currentUser,
  strategicGoals = [],
}) => {
  const { t: translate } = useTranslation();
  const t = translate('fullInitiatives', { returnObjects: true }) as any;
  const ts = translate('sidebar', { returnObjects: true }) as any;
  const initiatives = useMemo(() => fullSession.initiatives || [], [fullSession.initiatives]);
  const { currentUser: storeUser } = useAppStore();
  const navigate = useNavigate();
  // Use passed currentUser or storeUser
  // const effectiveUser = currentUser || storeUser;
  // Actually we passed currentUser from props so use that
  // const users = currentUser ? [currentUser] : []; // REMOVED THIS LINE

  // Legacy modal removed: use canonical InitiativeDocumentView in Initiatives module

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAxis, setFilterAxis] = useState<AxisId | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  const [groupBy, setGroupBy] = useState<'none' | 'axis' | 'priority' | 'status' | 'strategicGoal'>(
    'none'
  );

  const handleEditClick = (init: FullInitiative) => {
    if (!init.id) return;
    navigate(`${ROUTES.INITIATIVES}?open=${init.id}&mode=doc`);
  };

  const handleCreateClick = () => {
    const newInit: FullInitiative = {
      id: '',
      name: '',
      projectId: '',
      axis: filterAxis !== 'ALL' ? filterAxis : 'processes',
      priority: 'Medium',
      complexity: 'Medium',
      status: InitiativeStatus.PENDING_APPROVAL,
      businessValue: 'Medium',
      costCapex: 0,
      costOpex: 0,
      expectedRoi: 0,
      progress: 0,
    };
    // Legacy workspace: redirect creation to canonical Initiatives module
    navigate(`${ROUTES.INITIATIVES}?new=1`);
  };

  const getAxisLabel = React.useCallback(
    (id: string) => {
      const key =
        `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0, 4)}` as keyof typeof ts;
      return ts[key] || id;
    },
    [ts]
  );

  // Filter Logic
  const filteredInitiatives = useMemo(() => {
    return initiatives.filter((init) => {
      const name = init.name || '';
      const description = init.description || '';
      const id = init.id || '';
      const query = searchQuery.toLowerCase();

      const matchesSearch =
        name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        id.toLowerCase().includes(query); // Added toLowerCase for ID search consistency, though ID usually generic

      const matchesAxis = filterAxis === 'ALL' || init.axis === filterAxis;
      const matchesPriority = filterPriority === 'ALL' || init.priority === filterPriority;

      return matchesSearch && matchesAxis && matchesPriority;
    });
  }, [initiatives, searchQuery, filterAxis, filterPriority]);

  // Grouping Logic
  const groupedInitiatives = useMemo(() => {
    if (groupBy === 'none') return { 'All Initiatives': filteredInitiatives };

    const groups: Record<string, FullInitiative[]> = {};

    filteredInitiatives.forEach((init) => {
      let key = '';
      if (groupBy === 'axis') key = getAxisLabel(init.axis);
      else if (groupBy === 'priority') key = init.priority;
      else if (groupBy === 'status') key = init.status?.replace('_', ' ') || 'Unknown';
      else if (groupBy === 'strategicGoal') {
        const goal = strategicGoals.find((g) => g.id === init.strategicGoalId);
        key = goal ? `${goal.title} (${goal.priority})` : 'Unlinked';
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(init);
    });

    return groups;
  }, [filteredInitiatives, groupBy, getAxisLabel]);

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="h-auto md:h-24 border-b border-slate-200 dark:border-navy-700 flex flex-col justify-center px-6 bg-white dark:bg-navy-800 shrink-0 gap-3 py-3 md:py-0">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-navy-900 dark:text-white tracking-wide">
            Strategic Initiatives Board
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-600 dark:text-slate-500">
              {filteredInitiatives.length} items
            </span>
            <button
              onClick={handleCreateClick}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded text-xs font-semibold hover:bg-blue-500 transition-colors text-white shadow-lg shadow-blue-900/20"
            >
              <Plus size={14} /> New Initiative
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-500"
            />
            <input
              className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-md text-xs w-48 focus:outline-none focus:border-blue-500 text-navy-900 dark:text-white"
              placeholder="Search initiatives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden md:block"></div>

          {/* Filters */}
          {/* Filters */}
          <div className="w-40">
            <Select
              value={filterAxis}
              onChange={(value: string) => setFilterAxis(value as AxisId | 'ALL')}
              options={[
                { value: 'ALL', label: 'All Axes' },
                { value: 'processes', label: 'Processes' },
                { value: 'digitalProducts', label: 'Product' },
                { value: 'businessModels', label: 'Business Model' },
                { value: 'dataManagement', label: 'Data' },
                { value: 'culture', label: 'Culture' },
                { value: 'cybersecurity', label: 'Security' },
                { value: 'aiMaturity', label: 'AI' },
              ]}
              size="sm"
              fullWidth
            />
          </div>

          <div className="w-40">
            <Select
              value={filterPriority}
              onChange={(value: string) =>
                setFilterPriority(value as 'ALL' | 'High' | 'Medium' | 'Low')
              }
              options={[
                { value: 'ALL', label: 'All Priorities' },
                { value: 'High', label: 'High Priority' },
                { value: 'Medium', label: 'Medium Priority' },
                { value: 'Low', label: 'Low Priority' },
              ]}
              size="sm"
              fullWidth
            />
          </div>

          <div className="flex-1"></div>

          {/* Group By */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-bold">
              Group By:
            </span>
            <div className="flex bg-slate-100 dark:bg-navy-900 p-0.5 rounded-md border border-slate-200 dark:border-navy-700">
              {['none', 'axis', 'priority', 'status', 'strategicGoal'].map((g) => (
                <button
                  key={g}
                  onClick={() => setGroupBy(g as any)}
                  className={`px-2 py-1 round text-[10px] font-medium transition-colors ${groupBy === g ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-600 hover:text-navy-900 dark:hover:text-white'}`}
                >
                  {g === 'none'
                    ? 'None'
                    : g === 'strategicGoal'
                      ? 'Goal'
                      : g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-white/10">
        {Object.keys(groupedInitiatives).map((groupKey) => (
          <div key={groupKey} className="mb-8">
            {groupBy !== 'none' && (
              <h3 className="text-sm font-bold text-navy-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers size={14} className="text-blue-500" />
                {groupKey}
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
                  {groupedInitiatives[groupKey].length}
                </span>
              </h3>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedInitiatives[groupKey].map((init) => (
                <InitiativeCard
                  key={init.id}
                  initiative={{ ...init, title: (init as any).title || init.name || '' } as any}
                  onClick={() => handleEditClick(init)}
                  onEnrich={onEnrichInitiative}
                />
              ))}
            </div>

            {groupedInitiatives[groupKey].length === 0 && (
              <p className="text-sm text-slate-600 dark:text-slate-500 italic">
                No initiatives found in this group.
              </p>
            )}
          </div>
        ))}

        {filteredInitiatives.length === 0 && (
          <EmptyState
            variant="filter"
            compact
            title={translate('fullStep2.empty.title', 'No initiatives match your filters')}
            description={translate(
              'fullStep2.empty.desc',
              'Try a wider axis or priority, or clear the filters.'
            )}
            primaryAction={{
              label: translate('common.clearFilters', 'Clear filters'),
              onClick: () => {
                setSearchQuery('');
                setFilterPriority('ALL');
                setFilterAxis('ALL');
              },
            }}
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-900 flex justify-end">
        <button
          onClick={onNextStep}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
        >
          {t.nextStep}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};
