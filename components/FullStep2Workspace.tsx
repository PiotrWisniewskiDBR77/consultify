import React, { useState, useMemo } from 'react';
import { FullSession, FullInitiative, Language, AxisId } from '../types';
import { translations } from '../translations';
import { ArrowRight, Plus, Search, Layers } from 'lucide-react';
import { InitiativeCard } from './InitiativeCard';
import { InitiativeDetailModal } from './InitiativeDetailModal';
import { useAppStore } from '../store/useAppStore';

interface FullStep2WorkspaceProps {
  fullSession: FullSession;
  onUpdateInitiative: (initiative: FullInitiative) => void;
  onCreateInitiative: (initiative: FullInitiative) => void;
  onEnrichInitiative?: (id: string) => Promise<void>;
  onNextStep: () => void;
  language: Language;
}

export const FullStep2Workspace: React.FC<FullStep2WorkspaceProps> = ({
  fullSession,
  onUpdateInitiative,
  onCreateInitiative,
  onEnrichInitiative,
  onNextStep,
  language
}) => {
  const t = translations.fullInitiatives;
  const ts = translations.sidebar;
  const initiatives = useMemo(() => fullSession.initiatives || [], [fullSession.initiatives]);
  const { currentUser } = useAppStore();

  // Temporary: use currentUser as the only available user for assignment
  const users = currentUser ? [currentUser] : [];

  const [modalData, setModalData] = useState<FullInitiative | null>(null);

  // Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAxis, setFilterAxis] = useState<AxisId | 'ALL'>('ALL');
  const [filterPriority, setFilterPriority] = useState<'ALL' | 'High' | 'Medium' | 'Low'>('ALL');
  const [groupBy, setGroupBy] = useState<'none' | 'axis' | 'priority' | 'status'>('none');

  const handleEditClick = (init: FullInitiative) => {
    setModalData({ ...init });
  };

  const handleCreateClick = () => {
    const newInit: FullInitiative = {
      id: '',
      name: '',
      axis: filterAxis !== 'ALL' ? filterAxis : 'processes',
      priority: 'Medium',
      complexity: 'Medium',
      status: 'step3',
      businessValue: 'Medium',
      costCapex: 0,
      costOpex: 0,
      expectedRoi: 0,
      progress: 0
    };
    setModalData(newInit);
  };

  const getAxisLabel = React.useCallback((id: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const key = `fullStep1_${id === 'digitalProducts' ? 'prod' : id.substring(0, 4)}` as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (ts as any)[key]?.[language] || id;
  }, [language, ts]);

  // Filter Logic
  const filteredInitiatives = useMemo(() => {
    return initiatives.filter(init => {
      const matchesSearch = init.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        init.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        init.id.includes(searchQuery);

      const matchesAxis = filterAxis === 'ALL' || init.axis === filterAxis;
      const matchesPriority = filterPriority === 'ALL' || init.priority === filterPriority;

      return matchesSearch && matchesAxis && matchesPriority;
    });
  }, [initiatives, searchQuery, filterAxis, filterPriority]);

  // Grouping Logic
  const groupedInitiatives = useMemo(() => {
    if (groupBy === 'none') return { 'All Initiatives': filteredInitiatives };

    const groups: Record<string, FullInitiative[]> = {};

    filteredInitiatives.forEach(init => {
      let key = '';
      if (groupBy === 'axis') key = getAxisLabel(init.axis);
      else if (groupBy === 'priority') key = init.priority;
      else if (groupBy === 'status') key = init.status?.replace('_', ' ') || 'Unknown';

      if (!groups[key]) groups[key] = [];
      groups[key].push(init);
    });

    return groups;
  }, [filteredInitiatives, groupBy, getAxisLabel]);

  return (
    <div className="flex flex-col h-full bg-transparent">
      {/* Header */}
      <div className="h-auto md:h-24 border-b border-slate-200 dark:border-white/5 flex flex-col justify-center px-6 bg-white dark:bg-navy-800 shrink-0 gap-3 py-3 md:py-0">
        <div className="flex justify-between items-center">
          <span className="text-sm font-bold text-navy-900 dark:text-white tracking-wide">Strategic Initiatives Board</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-slate-400">{filteredInitiatives.length} items</span>
            <button onClick={handleCreateClick} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 rounded text-xs font-semibold hover:bg-blue-500 transition-colors text-white shadow-lg shadow-blue-900/20">
              <Plus size={14} /> New Initiative
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="pl-8 pr-3 py-1.5 bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-md text-xs w-48 focus:outline-none focus:border-blue-500 text-navy-900 dark:text-white"
              placeholder="Search initiatives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-white/10 hidden md:block"></div>

          {/* Filters */}
          <select
            className="bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-xs text-navy-900 dark:text-slate-300 outline-none focus:border-blue-500"
            value={filterAxis}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e) => setFilterAxis(e.target.value as any)}
          >
            <option value="ALL">All Axes</option>
            <option value="processes">Processes</option>
            <option value="digitalProducts">Product</option>
            <option value="businessModels">Business Model</option>
            <option value="dataManagement">Data</option>
            <option value="culture">Culture</option>
            <option value="cybersecurity">Security</option>
            <option value="aiMaturity">AI</option>
          </select>

          <select
            className="bg-slate-100 dark:bg-navy-900 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1.5 text-xs text-navy-900 dark:text-slate-300 outline-none focus:border-blue-500"
            value={filterPriority}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onChange={(e) => setFilterPriority(e.target.value as any)}
          >
            <option value="ALL">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          <div className="flex-1"></div>

          {/* Group By */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-slate-500 font-bold">Group By:</span>
            <div className="flex bg-slate-100 dark:bg-navy-900 p-0.5 rounded-md border border-slate-200 dark:border-white/10">
              {['none', 'axis', 'priority', 'status'].map((g) => (
                <button
                  key={g}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={() => setGroupBy(g as any)}
                  className={`px-2 py-1 round text-[10px] font-medium transition-colors ${groupBy === g ? 'bg-white dark:bg-navy-800 text-blue-600 dark:text-blue-400 get-shadow-sm' : 'text-slate-400 hover:text-navy-900 dark:hover:text-white'}`}
                >
                  {g === 'none' ? 'None' : g.charAt(0).toUpperCase() + g.slice(1)}
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
                <span className="text-xs font-normal text-slate-500 bg-slate-200 dark:bg-white/10 px-1.5 py-0.5 rounded-full">{groupedInitiatives[groupKey].length}</span>
              </h3>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {groupedInitiatives[groupKey].map((init) => (
                <InitiativeCard
                  key={init.id}
                  initiative={init}
                  language={language}
                  onClick={() => handleEditClick(init)}
                  onEnrich={onEnrichInitiative}
                />
              ))}
            </div>

            {groupedInitiatives[groupKey].length === 0 && (
              <p className="text-sm text-slate-400 italic">No initiatives found in this group.</p>
            )}
          </div>
        ))}

        {filteredInitiatives.length === 0 && (
          <div className="border border-dashed border-slate-300 dark:border-white/10 rounded-xl p-10 text-center text-slate-400 dark:text-slate-500 text-sm">
            <p>No initiatives match your filters.</p>
            <button onClick={() => { setSearchQuery(''); setFilterPriority('ALL'); setFilterAxis('ALL'); }} className="text-blue-500 hover:underline mt-2">Clear Filters</button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-white/5 bg-white dark:bg-navy-900 flex justify-end">
        <button
          onClick={onNextStep}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-all shadow-lg bg-blue-600 hover:bg-blue-500 text-white shadow-blue-900/30"
        >
          {t.nextStep[language]}
          <ArrowRight size={16} className={language === 'AR' ? 'rotate-180' : ''} />
        </button>
      </div>

      {/* Modal */}
      {modalData && (
        <InitiativeDetailModal
          initiative={modalData}
          isOpen={true}
          onClose={() => setModalData(null)}
          onSave={(updated) => {
            if (!updated.id || updated.id === '') {
              onCreateInitiative(updated);
            } else {
              onUpdateInitiative(updated);
            }
            setModalData(null);
          }}
          users={users}
          language={language}
        />
      )}
    </div>
  );
};


