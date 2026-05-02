import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Inbox,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ConvertToButton } from '@/components/shared/artifact-conversion/ConvertToButton';
import { ArtifactConversionModal } from '@/components/shared/artifact-conversion/ArtifactConversionModal';
import { ModuleHub } from '@/components/shared/ModuleHub';
import type { FilterChip, ModuleTab, ViewMode } from '@/components/shared/ModuleHub';
import { ConclusionsApi, type Conclusion } from '@/services/api/conclusions.api';

const TABS: Array<{ id: ModuleTab; label: string; icon: React.ReactNode }> = [
  { id: 'inbox', label: 'Do przeglądu', icon: <Inbox size={16} /> },
  { id: 'library', label: 'Biblioteka', icon: <Layers size={16} /> },
  { id: 'readout', label: 'Readout', icon: <MessageSquare size={16} /> },
  { id: 'conversions', label: 'Konwersje', icon: <Link2 size={16} /> },
  { id: 'documents', label: 'Dokumenty', icon: <FileText size={16} /> },
];

function statusBadge(status: Conclusion['status']): string {
  switch (status) {
    case 'published':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'converted':
      return 'bg-violet-500/10 text-violet-700 dark:text-violet-300';
    case 'needs_evidence':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'rejected':
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
    default:
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
  }
}

function confidenceBadge(confidence: string): string {
  switch (confidence) {
    case 'high':
      return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'medium':
      return 'bg-blue-500/10 text-blue-700 dark:text-blue-300';
    case 'low':
      return 'bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'contradicted':
      return 'bg-red-500/10 text-red-700 dark:text-red-300';
    default:
      return 'bg-slate-500/10 text-slate-600 dark:text-slate-300';
  }
}

export const ConclusionsHub: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ModuleTab>('library');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [conclusions, setConclusions] = useState<Conclusion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [convertConclusion, setConvertConclusion] = useState<Conclusion | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ConclusionsApi.list();
      setConclusions(res.conclusions || []);
      setSelectedId((current) => current || res.conclusions?.[0]?.id || null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const visibleConclusions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conclusions.filter((item) => {
      if (activeTab === 'inbox') {
        if (!['candidate', 'needs_evidence', 'needs_review', 'ready_for_readout'].includes(item.status)) {
          return false;
        }
      }
      if (activeTab === 'conversions' && item.status !== 'converted') return false;
      if (activeTab === 'documents') return false;
      if (activeTab === 'readout') return item.status === 'published' || item.status === 'converted';
      if (!q) return true;
      return `${item.title} ${item.statement} ${item.sourceModule}`.toLowerCase().includes(q);
    });
  }, [activeTab, conclusions, search]);

  const selected = useMemo(
    () => conclusions.find((item) => item.id === selectedId) || visibleConclusions[0] || null,
    [conclusions, selectedId, visibleConclusions]
  );

  const counts = useMemo(
    () => ({
      total: conclusions.length,
      inbox: conclusions.filter((item) =>
        ['candidate', 'needs_evidence', 'needs_review', 'ready_for_readout'].includes(item.status)
      ).length,
      published: conclusions.filter((item) => item.status === 'published').length,
      converted: conclusions.filter((item) => item.status === 'converted').length,
    }),
    [conclusions]
  );

  const activeFilters: FilterChip[] = search
    ? [{ id: 'search', column: 'Search', label: search, value: search }]
    : [];

  const renderPlaceholder = (title: string, body: string) => (
    <div className="h-full flex items-center justify-center px-6 py-16">
      <div className="max-w-xl text-center">
        <div className="mx-auto h-12 w-12 rounded-2xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
          <FileText size={22} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{body}</p>
      </div>
    </div>
  );

  return (
    <ModuleHub
      tabs={TABS}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      availableViewModes={['table', 'grid']}
      onSearch={setSearch}
      openDocuments={[]}
      activeDocumentId={null}
      onSelectDocument={() => {}}
      onCloseDocument={() => {}}
      onShowList={() => setSelectedId(null)}
      activeFilters={activeFilters}
      onRemoveFilter={() => setSearch('')}
      onClearFilters={() => setSearch('')}
      commandRowContent={
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span>{counts.total} wniosków</span>
          <span>•</span>
          <span>{counts.inbox} do przeglądu</span>
          <span>•</span>
          <span>{counts.published} opublikowane</span>
          <span>•</span>
          <span>{counts.converted} skonwertowane</span>
        </div>
      }
    >
      {activeTab === 'documents' &&
        renderPlaceholder(
          'Dokumenty z wniosków',
          'W kolejnym pakiecie readout będzie generował raporty, prezentacje i tabele zapisywane w Outputs Library.'
        )}
      {activeTab === 'readout' &&
        renderPlaceholder(
          'Readout sponsora',
          'Ten widok będzie układał opublikowane wnioski w narrację: wynik badania, ryzyka, szanse, luki i decyzje.'
        )}
      {activeTab !== 'documents' && activeTab !== 'readout' && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] h-full min-h-0">
          <div className="min-h-0 overflow-auto">
            {loading ? (
              <div className="h-full flex items-center justify-center py-20 text-slate-400">
                <Loader2 className="animate-spin" size={24} />
              </div>
            ) : visibleConclusions.length === 0 ? (
              <div className="h-full flex items-center justify-center py-20">
                <div className="text-center">
                  <AlertTriangle className="mx-auto text-slate-400" size={28} />
                  <div className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Brak wniosków w tym widoku
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Opublikowane findings z Interview pojawią się tutaj automatycznie.
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-4 space-y-2">
                <div className="grid grid-cols-[1fr_130px_120px_120px] gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <div>Tytuł</div>
                  <div>Status</div>
                  <div>Confidence</div>
                  <div>Źródło</div>
                </div>
                {visibleConclusions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedId(item.id)}
                    className={`w-full grid grid-cols-[1fr_130px_120px_120px] gap-3 items-center rounded-2xl border px-4 py-3 text-left transition ${
                      selected?.id === item.id
                        ? 'border-purple-400 bg-purple-500/5'
                        : 'border-slate-200/70 dark:border-navy-800 bg-white/70 dark:bg-navy-900/30 hover:bg-slate-50 dark:hover:bg-navy-900/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.title}
                      </div>
                      <div className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                        {item.statement}
                      </div>
                    </div>
                    <div>
                      <span className={`rounded-full px-2 py-1 text-[11px] ${statusBadge(item.status)}`}>
                        {item.status}
                      </span>
                    </div>
                    <div>
                      <span
                        className={`rounded-full px-2 py-1 text-[11px] ${confidenceBadge(
                          item.confidenceLevel
                        )}`}
                      >
                        {item.confidenceLevel}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{item.sourceModule}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="border-t xl:border-t-0 xl:border-l border-slate-200/70 dark:border-navy-800 bg-white/80 dark:bg-navy-950/80 min-h-0 overflow-auto">
            {selected ? (
              <div className="p-5 space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                    Wniosek
                  </div>
                  <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-slate-100">
                    {selected.title}
                  </h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    {selected.statement}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Evidence
                    </div>
                    <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                      {selected.evidenceRefs.length}
                    </div>
                  </div>
                  <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 p-4">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">
                      Source
                    </div>
                    <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {selected.sourceModule}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200/70 dark:border-amber-500/20 p-4">
                  <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    Limits
                  </div>
                  <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                    {selected.limits}
                  </p>
                </div>

                {selected.recommendedNextAction && (
                  <div className="rounded-2xl bg-slate-50 dark:bg-navy-900/50 p-4">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Next action
                    </div>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                      {selected.recommendedNextAction}
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <ConvertToButton
                    onClick={() => setConvertConclusion(selected)}
                    disabled={selected.status === 'converted'}
                    label="Convert to initiative"
                  />
                  {selected.status === 'converted' && (
                    <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 size={15} />
                      Converted
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-6 text-sm text-slate-500">
                Wybierz wniosek, aby zobaczyć szczegóły.
              </div>
            )}
          </aside>
        </div>
      )}

      <ArtifactConversionModal
        isOpen={!!convertConclusion}
        conclusion={convertConclusion}
        onClose={() => setConvertConclusion(null)}
        onConverted={() => load()}
      />
    </ModuleHub>
  );
};

export default ConclusionsHub;
