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
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ConvertToButton } from '@/components/shared/artifact-conversion/ConvertToButton';
import { ArtifactConversionModal } from '@/components/shared/artifact-conversion/ArtifactConversionModal';
import { ModuleHub } from '@/components/shared/ModuleHub';
import type { FilterChip, ModuleTab, ViewMode } from '@/components/shared/ModuleHub';
import {
  ConclusionsApi,
  type Conclusion,
  type ConclusionReadout,
} from '@/services/api/conclusions.api';

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
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ModuleTab>('library');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [search, setSearch] = useState('');
  const [conclusions, setConclusions] = useState<Conclusion[]>([]);
  const [readouts, setReadouts] = useState<ConclusionReadout[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedReadoutId, setSelectedReadoutId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [readoutLoading, setReadoutLoading] = useState(false);
  const [convertConclusion, setConvertConclusion] = useState<Conclusion | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const loadReadouts = useCallback(async () => {
    setReadoutLoading(true);
    try {
      const res = await ConclusionsApi.listReadouts();
      setReadouts(res.readouts || []);
      setSelectedReadoutId((current) => current || res.readouts?.[0]?.id || null);
    } finally {
      setReadoutLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'readout' || activeTab === 'documents') {
      loadReadouts();
    }
  }, [activeTab, loadReadouts]);

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

  const selectedReadout = useMemo(
    () => readouts.find((item) => item.id === selectedReadoutId) || readouts[0] || null,
    [readouts, selectedReadoutId]
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

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateReadout = async () => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : selected ? [selected.id] : [];
    if (ids.length === 0) {
      toast.error('Wybierz co najmniej jeden wniosek');
      return;
    }
    try {
      const res = await ConclusionsApi.createReadout({ conclusionIds: ids });
      toast.success('Readout utworzony');
      setSelectedIds(new Set());
      setActiveTab('readout');
      setSelectedReadoutId(res.readout.id);
      await loadReadouts();
    } catch (err: any) {
      toast.error(err?.message || 'Nie udało się utworzyć readout');
    }
  };

  const handleGenerateReport = async (readoutId: string) => {
    try {
      const res = await ConclusionsApi.generateReadoutReport(readoutId);
      toast.success('Raport utworzony w Outputs');
      await loadReadouts();
      navigate(`/reports/builder/${encodeURIComponent(res.reportId)}`);
    } catch (err: any) {
      toast.error(err?.message || 'Nie udało się wygenerować raportu');
    }
  };

  const handleDiscussWithChat = async (readoutId: string) => {
    try {
      const res = await ConclusionsApi.getReadoutChatContext(readoutId);
      sessionStorage.setItem('consultify_chat_context_pack', JSON.stringify(res.context));
      toast.success('Kontekst readout przygotowany dla czatu');
      navigate('/chat');
    } catch (err: any) {
      toast.error(err?.message || 'Nie udało się przygotować kontekstu czatu');
    }
  };

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
      primaryCta={
        activeTab === 'library' || activeTab === 'inbox' ? (
          <button
            type="button"
            onClick={handleCreateReadout}
            className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
          >
            <MessageSquare size={15} />
            Create readout
          </button>
        ) : null
      }
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
      {activeTab === 'documents' && (
        <div className="p-5 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Dokumenty z Wniosków
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Raporty wygenerowane z readoutów są zapisywane w Report Builder / Outputs.
          </p>
          {readoutLoading ? (
            <Loader2 className="animate-spin text-slate-400" size={22} />
          ) : (
            readouts.flatMap((readout) =>
              readout.outputArtifactRefs.map((ref) => (
                <button
                  key={`${readout.id}-${ref.id}`}
                  type="button"
                  onClick={() => navigate(ref.url || `/reports/builder/${ref.id}`)}
                  className="w-full rounded-2xl border border-slate-200/70 dark:border-navy-800 bg-white dark:bg-navy-900/40 p-4 text-left hover:border-purple-300"
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {ref.title || readout.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Readout: {readout.title}</div>
                </button>
              ))
            )
          )}
          {!readoutLoading && readouts.every((r) => r.outputArtifactRefs.length === 0) &&
            renderPlaceholder(
              'Brak dokumentów',
              'Wygeneruj raport z readoutu, aby pojawił się w tej sekcji i w Outputs Library.'
            )}
        </div>
      )}
      {activeTab === 'readout' && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] h-full min-h-0">
          <div className="border-r border-slate-200/70 dark:border-navy-800 min-h-0 overflow-auto p-4 space-y-2">
            {readoutLoading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="animate-spin text-slate-400" size={22} />
              </div>
            ) : readouts.length === 0 ? (
              renderPlaceholder(
                'Brak readoutów',
                'Zaznacz jeden lub kilka wniosków w Bibliotece i utwórz readout dla sponsora lub zespołu.'
              )
            ) : (
              readouts.map((readout) => (
                <button
                  key={readout.id}
                  type="button"
                  onClick={() => setSelectedReadoutId(readout.id)}
                  className={`w-full rounded-2xl border p-4 text-left ${
                    selectedReadout?.id === readout.id
                      ? 'border-purple-400 bg-purple-500/5'
                      : 'border-slate-200/70 dark:border-navy-800 bg-white dark:bg-navy-900/40'
                  }`}
                >
                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {readout.title}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {readout.sourceConclusionIds.length} wniosków • {readout.visibilityScope}
                  </div>
                </button>
              ))
            )}
          </div>
          <div className="min-h-0 overflow-auto p-6">
            {selectedReadout ? (
              <div className="max-w-4xl space-y-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Readout
                    </div>
                    <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                      {selectedReadout.title}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">{selectedReadout.summary}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleGenerateReport(selectedReadout.id)}
                      className="rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-700"
                    >
                      Generate report
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDiscussWithChat(selectedReadout.id)}
                      className="rounded-xl border border-slate-200 dark:border-navy-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-navy-900"
                    >
                      Discuss with chat
                    </button>
                  </div>
                </div>

                {[
                  ['Research summary', [selectedReadout.sections.researchSummary]],
                  ['Strongest conclusions', selectedReadout.sections.strongestConclusions],
                  ['Risks and limits', selectedReadout.sections.risks],
                  ['Opportunities', selectedReadout.sections.opportunities],
                  ['Contradictions', selectedReadout.sections.contradictions],
                  ['Coverage gaps', selectedReadout.sections.coverageGaps],
                  ['Decisions needed', selectedReadout.sections.decisionsNeeded],
                ].map(([title, items]) => (
                  <section
                    key={String(title)}
                    className="rounded-3xl border border-slate-200/70 dark:border-navy-800 bg-white dark:bg-navy-900/40 p-5"
                  >
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {String(title)}
                    </h3>
                    <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
                      {(items as string[]).length ? (
                        (items as string[]).map((item, idx) => <li key={idx}>• {item}</li>)
                      ) : (
                        <li>• Brak danych.</li>
                      )}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              renderPlaceholder('Wybierz readout', 'Readout będzie miejscem rozmowy z zespołem i sponsorem.')
            )}
          </div>
        </div>
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
                <div className="grid grid-cols-[36px_1fr_130px_120px_120px] gap-3 px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-slate-400">
                  <div></div>
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
                    className={`w-full grid grid-cols-[36px_1fr_130px_120px_120px] gap-3 items-center rounded-2xl border px-4 py-3 text-left transition ${
                      selected?.id === item.id
                        ? 'border-purple-400 bg-purple-500/5'
                        : 'border-slate-200/70 dark:border-navy-800 bg-white/70 dark:bg-navy-900/30 hover:bg-slate-50 dark:hover:bg-navy-900/70'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleSelected(item.id)}
                      className="h-4 w-4 rounded border-slate-300 text-purple-600"
                    />
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
