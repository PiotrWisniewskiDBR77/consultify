/**
 * AuditsMethodHub — kanoniczne pięć powierzchni kernela Audits
 * (Library · Processes · Outputs · Reports · Initiatives), montowane jako
 * produkt pod `/audit-programs` nad jednym kontraktem `/api/audits`.
 *
 * Wzorzec 1:1 z `src/components/assessment/AssessmentHub.tsx`
 * (`FIVE_SURFACES_TAB_IDS`/`resolveFiveSurfacesTabFromUrl`/`setActiveTab`):
 * `?tab=` jest źródłem prawdy (przetrwa odświeżenie, wstecz/dalej, deep
 * link), domyślna zakładka to `library`, nieznana wartość → `processes`.
 * Dawny równoległy `AuditsHub` nad `/api/audit` nie jest już mounted; jego
 * write endpoints pozostają wycofane po stronie serwera.
 *
 * Menu 2 (StandardModuleBar): lupa (jedyny slot wyszukiwania w fasadzie) +
 * pięć pigułek zakładek — druga nazywa się „Sesje"/„Sessions" (Piotr,
 * P0 2026-08-13: „Processes" mylące dla klienta; id `?tab=processes`
 * ZOSTAJE dla zgodności istniejących linków — zmienia się WYŁĄCZNIE etykieta
 * widoczna). Menu 3: JEDEN tor chipów z licznikami — weryfikacja (Library) /
 * etap lifecycle (Processes) — na wbudowanym `chips`/`activeChip`/
 * `onChipChange` StandardModuleBar (kanon A3, DEC-2026-08-25-66: dwa stacked
 * rzędy chipów — typ źródła + weryfikacja — czytały się jako „czwarte menu";
 * `sourceType` zostaje filtrowalny przez lejek kolumny w `AuditLibraryTab`,
 * patrz `auditStatusTones.ts` dla obu osi danych). Bez liczników na
 * pigułkach zakładek (kanon: „bez liczników w Menu 2"; `StandardModuleTab`
 * nawet nie ma pola `count`, więc naruszenie nie jest tu fizycznie możliwe).
 */
import { ClipboardList, FileText, Library, Lightbulb, Package } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';

import { type StandardCounterChip, StandardModuleBar, type StandardModuleTab } from '@/components/standard';
import type { StatusTone } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import {
  clearPersistentCommandId,
  persistentCommandId,
} from '@/services/initiatives-execution/persistentCommandId';
import { useAppStore } from '@/store/useAppStore';
import { formatListDate } from '@/utils/listDateFormat';

import {
  packVerificationLabel,
  packVerificationTone,
  programLifecycleLabel,
  programLifecycleTone,
} from './auditStatusTones';
import {
  createProgram,
  getProgram,
  listPacks,
  listPrograms,
  AUDIT_VERIFICATION_STATES,
  AUDIT_LIFECYCLE_STATES,
  type AuditPackSummary,
  type AuditProgramSummary,
  type AuditVerificationState,
  type AuditLifecycleState,
} from './auditsMethodApi';
import { AuditInitiativesTab } from './tabs/AuditInitiativesTab';
import { AuditLibraryTab } from './tabs/AuditLibraryTab';
import { AuditOutputsTab } from './tabs/AuditOutputsTab';
import { AuditProcessesTab } from './tabs/AuditProcessesTab';
import { AuditReportsTab } from './tabs/AuditReportsTab';

export type AuditsMethodTabId = 'library' | 'processes' | 'outputs' | 'reports' | 'initiatives';

export function claimAuditStart(inFlight: Set<string>, packId: string): boolean {
  if (inFlight.has(packId)) return false;
  inFlight.add(packId);
  return true;
}

export const AUDIT_START_COMMAND_NAMESPACE = 'audits.program.start.v1';

export function auditStartFingerprint(organizationId: string, userId: string, packId: string): string {
  return `${organizationId}:${userId}:${packId}`;
}

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
  const currentUserId = useAppStore((state) => state.currentUser?.id ?? null);
  const currentOrganizationId = useAppStore((state) => state.currentOrganization?.id ?? null);

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
  // Library ma DWIE osie w danych (`sourceType` + `verificationStatus`, patrz
  // nagłówek pliku i `auditStatusTones.ts`), ale Menu 3 kanonicznie niesie
  // TYLKO JEDNĄ (DEC-2026-08-25-66 — dwa stacked rzędy chipów czytały się jako
  // "czwarte menu"; ten sam wzorzec co Processes' `processesChips` — jeden
  // tor). `sourceType` zostaje filtrowalny przez lejek w nagłówku kolumny
  // tabeli (`AuditLibraryTab` → `filterable`/`filterOptions` na kolumnie
  // „Typ źródła") — mechanika kolumnowa działa niezależnie od stanu tutaj.
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
    return listPrograms({ search })
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
      packsAll.filter((p) => libraryVerification === 'all' || p.verificationStatus === libraryVerification),
    [packsAll, libraryVerification]
  );

  const filteredPrograms = useMemo(
    () =>
      processesLifecycle === 'all'
        ? programsAll
        : programsAll.filter((p) => p.lifecycleState === processesLifecycle),
    [programsAll, processesLifecycle]
  );

  const verificationChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: isPolish ? 'Wszystkie' : 'All', count: packsAll.length },
      ...AUDIT_VERIFICATION_STATES.map((value) => ({
        id: value,
        label: packVerificationLabel(value, isPolish),
        count: packsAll.filter((p) => p.verificationStatus === value).length,
        dot: TONE_DOT_CLASS[packVerificationTone(value)],
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
  const startsInFlight = useRef(new Set<string>());

  const handleStartAudit = useCallback(
    async (pack: AuditPackSummary) => {
      if (!claimAuditStart(startsInFlight.current, pack.id)) return;
      setStartingPackId(pack.id);
      const toastId = toast.loading(isPolish ? `Uruchamianie audytu „${pack.title}"…` : `Starting audit "${pack.title}"…`);
      try {
        if (!currentOrganizationId || !currentUserId) {
          throw new Error(isPolish ? 'Brak aktywnej organizacji lub użytkownika.' : 'No active organization or user.');
        }
        const commandFingerprint = auditStartFingerprint(currentOrganizationId, currentUserId, pack.id);
        const idempotencyKey = persistentCommandId(AUDIT_START_COMMAND_NAMESPACE, commandFingerprint);
        const created = await createProgram({
          packId: pack.id,
          // `formatListDate` (SSOT `utils/listDateFormat.ts`), NIE
          // `toLocaleDateString()` bez locale — ten ostatni bierze locale z
          // przeglądarki, nie z języka konta, i to jest dokładnie defekt,
          // który dał `6/18/2026` na koncie polskim (C4 audytu jakości list).
          name: `${pack.title} — ${formatListDate(new Date())}`,
        }, idempotencyKey);
        const readback = await getProgram(created.id);
        if (!readback || readback.id !== created.id || readback.packId !== pack.id) {
          throw new Error(
            isPolish
              ? 'Nie potwierdzono utworzonego programu w kanonicznym odczycie.'
              : 'The created program was not confirmed by canonical readback.'
          );
        }
        const refreshed = await listPrograms({ search });
        setProgramsAll(refreshed.items);
        setProgramsError(null);
        clearPersistentCommandId(AUDIT_START_COMMAND_NAMESPACE, commandFingerprint);
        toast.success(isPolish ? 'Program audytowy utworzony' : 'Audit program created', { id: toastId });
        setActiveTab('processes');
      } catch (e: any) {
        toast.error(
          permissionAwareMessage(e, isPolish, isPolish ? 'Nie udało się rozpocząć audytu' : 'Failed to start the audit'),
          { id: toastId }
        );
      } finally {
        startsInFlight.current.delete(pack.id);
        setStartingPackId(null);
      }
    },
    [currentOrganizationId, currentUserId, isPolish, search, setActiveTab]
  );

  const tabs: StandardModuleTab[] = useMemo(
    () => [
      { id: 'library', label: t('audits.method.tabs.library', 'Library'), icon: <Library size={16} /> },
      {
        id: 'processes',
        // Id URL zostaje `processes` (linki/deep-linki nie mogą się zepsuć) —
        // zmienia się WYŁĄCZNIE etykieta widoczna. Etykieta jest teraz w
        // `audits.method.tabs.processes` (PL „Sesje” / EN „Sessions”) —
        // dodane do `public/locales/*/translation.json` 2026-08-17.
        label: t('audits.method.tabs.processes', isPolish ? 'Sesje' : 'Sessions'),
        icon: <ClipboardList size={16} />,
      },
      { id: 'outputs', label: t('audits.method.tabs.outputs', 'Outputs'), icon: <Package size={16} /> },
      { id: 'reports', label: t('audits.method.tabs.reports', 'Reports'), icon: <FileText size={16} /> },
      { id: 'initiatives', label: t('audits.method.tabs.initiatives', 'Initiatives'), icon: <Lightbulb size={16} /> },
    ],
    [t, isPolish]
  );

  // Menu 3 = JEDEN tor (kanon A3/DEC-2026-08-25-66) — Library i Processes
  // dzielą dokładnie ten sam wbudowany `chips`/`activeChip`/`onChipChange`
  // mechanizm StandardModuleBar, zero escape-hatchu `commandRowContent`.
  const chips = activeTab === 'library' ? verificationChips : activeTab === 'processes' ? processesChips : undefined;
  const activeChip =
    activeTab === 'library' ? libraryVerification : activeTab === 'processes' ? processesLifecycle : null;
  const onChipChange =
    activeTab === 'library'
      ? (id: string) => setLibraryVerification(id as 'all' | AuditVerificationState)
      : activeTab === 'processes'
        ? (id: string) => setProcessesLifecycle(id as 'all' | AuditLifecycleState)
        : undefined;

  // Rozwiązywanie ID → nazwa dla kolumn/podglądu w Reports/Outputs/
  // Initiatives/Processes. `/api/audits/{reports,outputs,proposals}` NIE
  // dołącza `programName`/`finalizedByName`/`leadAuditorName` (zweryfikowano
  // w `server/src/services/audits/{reportService,outputService,programService}.ts`
  // — te pola nie istnieją w wierszu, tylko `*Id`); frontendowy typ je
  // deklarował, ale zawsze renderowały się jako „—”. Zamiast dotykać
  // backendu (poza zakresem DEC-2026-08-25-66, czysto UI), rozwiązujemy je
  // tutaj z danych, które Hub już wczytuje (`programsAll`, `packsAll`) plus
  // jedno dodatkowe pobranie listy użytkowników organizacji — dokładnie wzór
  // `authorNameById` z `DiscoveryToolsHub.tsx`.
  const programNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of programsAll) map.set(p.id, p.name);
    return map;
  }, [programsAll]);

  const packTitleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of packsAll) map.set(p.id, p.version ? `${p.title} v${p.version}` : p.title);
    return map;
  }, [packsAll]);

  const [orgUsers, setOrgUsers] = useState<Array<{ id: string; firstName: string; lastName: string }>>([]);
  useEffect(() => {
    let cancelled = false;
    Api.getUsers()
      .then((fetched) => {
        if (!cancelled) setOrgUsers(fetched || []);
      })
      .catch((err) => console.error('[AuditsMethodHub] Failed to load users for name resolution', err));
    return () => {
      cancelled = true;
    };
  }, []);
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of orgUsers) map.set(u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id);
    return map;
  }, [orgUsers]);

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
            initialSelectedId={searchParams.get('programId')}
            programs={filteredPrograms}
            loading={programsLoading}
            error={programsError}
            onRetry={loadPrograms}
            isPolish={isPolish}
            onProgramChanged={loadPrograms}
            packTitleById={packTitleById}
            userNameById={userNameById}
          />
        ) : activeTab === 'outputs' ? (
          <AuditOutputsTab isPolish={isPolish} programNameById={programNameById} userNameById={userNameById} />
        ) : activeTab === 'reports' ? (
          <AuditReportsTab isPolish={isPolish} programNameById={programNameById} />
        ) : (
          <AuditInitiativesTab isPolish={isPolish} programNameById={programNameById} />
        )}
      </div>
    </StandardModuleBar>
  );
};

export default AuditsMethodHub;
