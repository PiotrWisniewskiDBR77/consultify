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
 * pięć pigułek zakładek — druga nazywa się „Sesje"/„Sessions" (Piotr,
 * P0 2026-08-13: „Processes" mylące dla klienta; id `?tab=processes`
 * ZOSTAJE dla zgodności istniejących linków — zmienia się WYŁĄCZNIE etykieta
 * widoczna). Menu 3: DWA niezależne rzędy chipów na Library (typ źródła +
 * weryfikacja — P0 rozdzielenia osi, patrz `auditStatusTones.ts`) przez luk
 * ucieczkowy `commandRowContent` (fasada ma tylko JEDEN wbudowany tor
 * `chips`/`activeChip`/`onChipChange`, za mało na dwie niezależne osie) /
 * chipy etapu lifecycle (Processes) — wszystkie z LICZNIKAMI, to tu a NIE na
 * pigułkach zakładek (kanon: „bez liczników w Menu 2"; `StandardModuleTab`
 * nawet nie ma pola `count`, więc naruszenie nie jest tu fizycznie możliwe).
 */
import { ClipboardList, FileText, Library, Lightbulb, Package } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { type StandardCounterChip, StandardModuleBar, type StandardModuleTab } from '@/components/standard';
import type { StatusTone } from '@/components/ui/primitives/chips';
import { formatListDate } from '@/utils/listDateFormat';

import { Menu3Badge, Menu3Chip, MENU_3_LEFT_CLASS } from '../../shared/ModuleMenu3';
import {
  packSourceTypeLabel,
  packSourceTypeTone,
  packVerificationLabel,
  packVerificationTone,
  programLifecycleLabel,
  programLifecycleTone,
} from './auditStatusTones';
import {
  createProgram,
  listPacks,
  listPrograms,
  AUDIT_SOURCE_TYPES,
  AUDIT_VERIFICATION_STATES,
  AUDIT_LIFECYCLE_STATES,
  type AuditPackSummary,
  type AuditProgramSummary,
  type AuditSourceType,
  type AuditVerificationState,
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
  // DWIE NIEZALEŻNE OSIE Library — patrz nagłówek pliku i `auditStatusTones.ts`.
  const [librarySourceType, setLibrarySourceType] = useState<'all' | AuditSourceType>('all');
  const [libraryVerification, setLibraryVerification] = useState<'all' | AuditVerificationState>('all');
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

  // Filtry kombinowalne: oba warunki AND — wybranie osi A nie resetuje osi B.
  const filteredPacks = useMemo(
    () =>
      packsAll.filter(
        (p) =>
          (librarySourceType === 'all' || p.sourceType === librarySourceType) &&
          (libraryVerification === 'all' || p.verificationStatus === libraryVerification)
      ),
    [packsAll, librarySourceType, libraryVerification]
  );

  const filteredPrograms = useMemo(
    () =>
      processesLifecycle === 'all'
        ? programsAll
        : programsAll.filter((p) => p.lifecycleState === processesLifecycle),
    [programsAll, processesLifecycle]
  );

  // Liczniki „faceted": każda oś liczy na podstawie packsAll przefiltrowanych
  // przez WYBÓR DRUGIEJ osi (nie przez samą siebie) — więc liczby aktualizują
  // się, gdy użytkownik zawęzi drugi filtr, a chipy obu osi zawsze widać razem.
  const packsForSourceTypeCounts = useMemo(
    () => packsAll.filter((p) => libraryVerification === 'all' || p.verificationStatus === libraryVerification),
    [packsAll, libraryVerification]
  );
  const packsForVerificationCounts = useMemo(
    () => packsAll.filter((p) => librarySourceType === 'all' || p.sourceType === librarySourceType),
    [packsAll, librarySourceType]
  );

  const sourceTypeChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: packsForSourceTypeCounts.length },
      ...AUDIT_SOURCE_TYPES.map((value) => ({
        id: value,
        label: packSourceTypeLabel(value, isPolish),
        count: packsForSourceTypeCounts.filter((p) => p.sourceType === value).length,
        dot: TONE_DOT_CLASS[packSourceTypeTone(value)],
      })),
    ],
    [packsForSourceTypeCounts, isPolish]
  );

  const verificationChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: packsForVerificationCounts.length },
      ...AUDIT_VERIFICATION_STATES.map((value) => ({
        id: value,
        label: packVerificationLabel(value, isPolish),
        count: packsForVerificationCounts.filter((p) => p.verificationStatus === value).length,
        dot: TONE_DOT_CLASS[packVerificationTone(value)],
      })),
    ],
    [packsForVerificationCounts, isPolish]
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
          // `formatListDate` (SSOT `utils/listDateFormat.ts`), NIE
          // `toLocaleDateString()` bez locale — ten ostatni bierze locale z
          // przeglądarki, nie z języka konta, i to jest dokładnie defekt,
          // który dał `6/18/2026` na koncie polskim (C4 audytu jakości list).
          name: `${pack.title} — ${formatListDate(new Date())}`,
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
      {
        id: 'processes',
        // Id URL zostaje `processes` (linki/deep-linki nie mogą się zepsuć) —
        // zmienia się WYŁĄCZNIE etykieta widoczna. Świadomie isPolish zamiast
        // `t()`: klucz nie ma dziś wpisu w `public/locales/*/translation.json`
        // (i5next zwraca wtedy zawsze angielski `defaultValue`, niezależnie od
        // języka konta) — dotykanie 35k-liniowych plików tłumaczeń dla jednej
        // etykiety byłoby nieproporcjonalne do zmiany.
        label: isPolish ? 'Sesje' : 'Sessions',
        icon: <ClipboardList size={16} />,
      },
      { id: 'outputs', label: t('audits.method.tabs.outputs', 'Outputs'), icon: <Package size={16} /> },
      { id: 'reports', label: t('audits.method.tabs.reports', 'Reports'), icon: <FileText size={16} /> },
      { id: 'initiatives', label: t('audits.method.tabs.initiatives', 'Initiatives'), icon: <Lightbulb size={16} /> },
    ],
    [t, isPolish]
  );

  // Library ma DWIE niezależne osie filtrów — więcej niż fasada obsługuje
  // przez wbudowany `chips` (jeden tor). Budujemy własny rząd (dwa
  // podrzędy) przez luk ucieczkowy `commandRowContent`; Processes zostaje na
  // wbudowanym torze `chips`, bez zmian.
  const libraryCommandRow =
    activeTab === 'library' ? (
      <div className="flex flex-col gap-1 px-4 pb-3">
        <div className={`${MENU_3_LEFT_CLASS} overflow-x-auto whitespace-nowrap no-scrollbar`}>
          <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
            {isPolish ? 'Typ źródła' : 'Source type'}
          </span>
          {sourceTypeChips.map((chip) => {
            const active = librarySourceType === chip.id;
            return (
              <Menu3Chip
                key={chip.id}
                active={active}
                onClick={() => setLibrarySourceType(chip.id as 'all' | AuditSourceType)}
                aria-pressed={active}
                data-testid={`audits-library-source-type-chip-${chip.id}`}
              >
                {chip.dot ? <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} /> : null}
                <span>{chip.label}</span>
                {chip.count !== undefined ? <Menu3Badge count={chip.count} active={active} /> : null}
              </Menu3Chip>
            );
          })}
        </div>
        <div className={`${MENU_3_LEFT_CLASS} overflow-x-auto whitespace-nowrap no-scrollbar`}>
          <span className="mr-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-c-text-muted">
            {isPolish ? 'Weryfikacja' : 'Verification'}
          </span>
          {verificationChips.map((chip) => {
            const active = libraryVerification === chip.id;
            return (
              <Menu3Chip
                key={chip.id}
                active={active}
                onClick={() => setLibraryVerification(chip.id as 'all' | AuditVerificationState)}
                aria-pressed={active}
                data-testid={`audits-library-verification-chip-${chip.id}`}
              >
                {chip.dot ? <span className={`h-1.5 w-1.5 rounded-full ${chip.dot}`} /> : null}
                <span>{chip.label}</span>
                {chip.count !== undefined ? <Menu3Badge count={chip.count} active={active} /> : null}
              </Menu3Chip>
            );
          })}
        </div>
      </div>
    ) : undefined;

  const chips = activeTab === 'processes' ? processesChips : undefined;
  const activeChip = activeTab === 'processes' ? processesLifecycle : null;
  const onChipChange =
    activeTab === 'processes' ? (id: string) => setProcessesLifecycle(id as 'all' | AuditLifecycleState) : undefined;

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
      commandRowContent={libraryCommandRow}
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
