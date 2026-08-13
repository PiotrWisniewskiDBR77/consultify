/**
 * AuditsMethodHub — U7: pięć powierzchni metodycznego kernela Audits
 * (Library · Processes · Outputs · Reports · Initiatives), za flagą
 * `auditsFiveSurfacesV1` (default OFF — patrz `src/hooks/useFeatureFlags.tsx`).
 *
 * Wzorzec 1:1 z `src/components/assessment/AssessmentHub.tsx`
 * (`FIVE_SURFACES_TAB_IDS`/`resolveFiveSurfacesTabFromUrl`/`setActiveTab`):
 * `?tab=` jest źródłem prawdy (przetrwa odświeżenie, wstecz/dalej, deep
 * link), domyślna zakładka to `library`, nieznana wartość → `processes`.
 * W przeciwieństwie do AssessmentHub NIE ma trybu dwustanowego (flaga
 * OFF/ON) wewnątrz komponentu — trasa (`src/routes/AppRoutes.tsx`) w ogóle
 * nie montuje tego huba, gdy flaga jest OFF, więc ten plik zawsze zachowuje
 * się jak "ON".
 *
 * NIE dotyka `src/components/Audit/AuditsHub.tsx` (istniejący hub programów
 * orkiestratora `/api/audit`) — to osobny, równoległy ekran pod innym
 * kontraktem (`/api/audits`, liczba mnoga, kernel metodyczny U0-U7).
 *
 * Menu 2 (StandardModuleBar): lupa (jedyny slot wyszukiwania w fasadzie) +
 * pięć pigułek zakładek. Menu 3: chipy klasyfikacji (Library) / etapu
 * lifecycle (Processes) z LICZNIKAMI — to tu, a NIE na pigułkach zakładek
 * (kanon: „bez liczników w Menu 2"; `StandardModuleTab` nawet nie ma pola
 * `count`, więc naruszenie nie jest tu fizycznie możliwe).
 */
import { ClipboardList, FileText, Library, Lightbulb, Package } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { type StandardCounterChip, StandardModuleBar, type StandardModuleTab } from '@/components/standard';
import type { StatusTone } from '@/components/ui/primitives/chips';

import {
  packClassificationLabel,
  packClassificationTone,
  programLifecycleLabel,
  programLifecycleTone,
} from './auditStatusTones';
import {
  createProgram,
  listPacks,
  listPrograms,
  PACK_CLASSIFICATIONS,
  AUDIT_LIFECYCLE_STATES,
  type AuditPackSummary,
  type AuditProgramSummary,
  type PackClassification,
  type AuditLifecycleState,
} from './auditsMethodApi';
import { AuditInitiativesTab } from './tabs/AuditInitiativesTab';
import { AuditLibraryTab } from './tabs/AuditLibraryTab';
import { AuditOutputsTab } from './tabs/AuditOutputsTab';
import { AuditProcessesTab } from './tabs/AuditProcessesTab';
import { AuditReportsTab } from './tabs/AuditReportsTab';

export type AuditsMethodTabId = 'library' | 'processes' | 'outputs' | 'reports' | 'initiatives';

const TAB_IDS: AuditsMethodTabId[] = ['library', 'processes', 'outputs', 'reports', 'initiatives'];
const TAB_ID_SET = new Set<string>(TAB_IDS);

/** Nieznana/legacy wartość `?tab=` → `processes` (nigdy `library`, żeby nie
 * ukrywać błędnego linku pod domyślnym stanem). Brak parametru → `library`. */
function resolveTabFromUrl(raw: string | null): AuditsMethodTabId {
  if (!raw) return 'library';
  return TAB_ID_SET.has(raw) ? (raw as AuditsMethodTabId) : 'processes';
}

const TONE_DOT_CLASS: Record<StatusTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-slate-400',
};

function permissionAwareMessage(e: any, isPolish: boolean, fallback: string): string {
  if (e?.status === 403) {
    return isPolish
      ? 'Brak uprawnień do tego zasobu w tej organizacji.'
      : 'You do not have permission to view this resource in this organization.';
  }
  return e?.message || fallback;
}

export const AuditsMethodHub: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isPolish = !!i18n.language?.startsWith('pl');
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTabState] = useState<AuditsMethodTabId>(() =>
    resolveTabFromUrl(searchParams.get('tab'))
  );

  const setActiveTab = useCallback(
    (tab: string) => {
      const next = TAB_ID_SET.has(tab) ? (tab as AuditsMethodTabId) : 'processes';
      setActiveTabState(next);
      const params = new URLSearchParams(searchParams);
      params.set('tab', next);
      setSearchParams(params);
    },
    [searchParams, setSearchParams]
  );

  // Kanonizacja URL: brak `?tab=` albo nieznana wartość → dopisz rozwiązaną
  // wartość i zsynchronizuj stan (obsługuje też wstecz/dalej przeglądarki).
  useEffect(() => {
    const raw = searchParams.get('tab');
    const resolved = resolveTabFromUrl(raw);
    if (!raw || resolved !== raw) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', resolved);
      setSearchParams(params, { replace: true });
    }
    if (resolved !== activeTab) {
      setActiveTabState(resolved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [search, setSearch] = useState('');
  const [libraryClassification, setLibraryClassification] = useState<'all' | PackClassification>('all');
  const [processesLifecycle, setProcessesLifecycle] = useState<'all' | AuditLifecycleState>('all');

  const [packsAll, setPacksAll] = useState<AuditPackSummary[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState<string | null>(null);

  const loadPacks = useCallback(() => {
    setPacksLoading(true);
    setPacksError(null);
    listPacks({ search })
      .then((result) => setPacksAll(result.items))
      .catch((e: any) =>
        setPacksError(permissionAwareMessage(e, isPolish, isPolish ? 'Nie udało się wczytać biblioteki' : 'Failed to load the library'))
      )
      .finally(() => setPacksLoading(false));
  }, [search, isPolish]);

  useEffect(() => {
    loadPacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const [programsAll, setProgramsAll] = useState<AuditProgramSummary[]>([]);
  const [programsLoading, setProgramsLoading] = useState(true);
  const [programsError, setProgramsError] = useState<string | null>(null);

  const loadPrograms = useCallback(() => {
    setProgramsLoading(true);
    setProgramsError(null);
    listPrograms({ search })
      .then((result) => setProgramsAll(result.items))
      .catch((e: any) =>
        setProgramsError(
          permissionAwareMessage(e, isPolish, isPolish ? 'Nie udało się wczytać programów' : 'Failed to load programs')
        )
      )
      .finally(() => setProgramsLoading(false));
  }, [search, isPolish]);

  useEffect(() => {
    loadPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const filteredPacks = useMemo(
    () =>
      libraryClassification === 'all'
        ? packsAll
        : packsAll.filter((p) => p.classification === libraryClassification),
    [packsAll, libraryClassification]
  );

  const filteredPrograms = useMemo(
    () =>
      processesLifecycle === 'all'
        ? programsAll
        : programsAll.filter((p) => p.lifecycleState === processesLifecycle),
    [programsAll, processesLifecycle]
  );

  const libraryChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: packsAll.length },
      ...PACK_CLASSIFICATIONS.map((value) => ({
        id: value,
        label: packClassificationLabel(value, isPolish),
        count: packsAll.filter((p) => p.classification === value).length,
        dot: TONE_DOT_CLASS[packClassificationTone(value)],
      })),
    ],
    [packsAll, isPolish]
  );

  const processesChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: programsAll.length },
      ...AUDIT_LIFECYCLE_STATES.map((value) => ({
        id: value,
        label: programLifecycleLabel(value, isPolish),
        count: programsAll.filter((p) => p.lifecycleState === value).length,
        dot: TONE_DOT_CLASS[programLifecycleTone(value)],
      })),
    ],
    [programsAll, isPolish]
  );

  const [startingPackId, setStartingPackId] = useState<string | null>(null);

  const handleStartAudit = useCallback(
    async (pack: AuditPackSummary) => {
      setStartingPackId(pack.id);
      const toastId = toast.loading(isPolish ? `Uruchamianie audytu „${pack.title}"…` : `Starting audit "${pack.title}"…`);
      try {
        await createProgram({
          packId: pack.id,
          name: `${pack.title} — ${new Date().toLocaleDateString()}`,
        });
        toast.success(isPolish ? 'Program audytowy utworzony' : 'Audit program created', { id: toastId });
        loadPrograms();
        setActiveTab('processes');
      } catch (e: any) {
        toast.error(
          permissionAwareMessage(e, isPolish, isPolish ? 'Nie udało się rozpocząć audytu' : 'Failed to start the audit'),
          { id: toastId }
        );
      } finally {
        setStartingPackId(null);
      }
    },
    [isPolish, loadPrograms, setActiveTab]
  );

  const tabs: StandardModuleTab[] = useMemo(
    () => [
      { id: 'library', label: t('audits.method.tabs.library', 'Library'), icon: <Library size={16} /> },
      { id: 'processes', label: t('audits.method.tabs.processes', 'Processes'), icon: <ClipboardList size={16} /> },
      { id: 'outputs', label: t('audits.method.tabs.outputs', 'Outputs'), icon: <Package size={16} /> },
      { id: 'reports', label: t('audits.method.tabs.reports', 'Reports'), icon: <FileText size={16} /> },
      { id: 'initiatives', label: t('audits.method.tabs.initiatives', 'Initiatives'), icon: <Lightbulb size={16} /> },
    ],
    [t]
  );

  const chips = activeTab === 'library' ? libraryChips : activeTab === 'processes' ? processesChips : undefined;
  const activeChip =
    activeTab === 'library' ? libraryClassification : activeTab === 'processes' ? processesLifecycle : null;
  const onChipChange =
    activeTab === 'library'
      ? (id: string) => setLibraryClassification(id as 'all' | PackClassification)
      : activeTab === 'processes'
        ? (id: string) => setProcessesLifecycle(id as 'all' | AuditLifecycleState)
        : undefined;

  return (
    <StandardModuleBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSearch={setSearch}
      searchValue={search}
      chips={chips}
      activeChip={activeChip}
      onChipChange={onChipChange}
    >
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === 'library' ? (
          <AuditLibraryTab
            packs={filteredPacks}
            loading={packsLoading}
            error={packsError}
            onRetry={loadPacks}
            isPolish={isPolish}
            onStartAudit={handleStartAudit}
            startingPackId={startingPackId}
          />
        ) : activeTab === 'processes' ? (
          <AuditProcessesTab
            programs={filteredPrograms}
            loading={programsLoading}
            error={programsError}
            onRetry={loadPrograms}
            isPolish={isPolish}
            onProgramChanged={loadPrograms}
          />
        ) : activeTab === 'outputs' ? (
          <AuditOutputsTab isPolish={isPolish} />
        ) : activeTab === 'reports' ? (
          <AuditReportsTab isPolish={isPolish} />
        ) : (
          <AuditInitiativesTab isPolish={isPolish} />
        )}
      </div>
    </StandardModuleBar>
  );
};

export default AuditsMethodHub;
