/**
 * AuditsMethodHub — kanoniczne pięć powierzchni kernela Audits
 * (Biblioteka · Sesje · Wyniki · Raporty · Inicjatywy), montowane jako
 * produkt pod `/audit-programs` nad jednym kontraktem `/api/audits`.
 *
 * Wzorzec 1:1 z `src/components/assessment/AssessmentHub.tsx`
 * (`FIVE_SURFACES_TAB_IDS`/`resolveFiveSurfacesTabFromUrl`/`setActiveTab`):
 * `?tab=` jest źródłem prawdy (przetrwa odświeżenie, wstecz/dalej, deep
 * link), domyślna zakładka to `library`, nieznana wartość → `processes`.
 *
 * ★ DEC-417b/c/d (właściciel, 06.09.2026, 7 zrzutów Audytów — 1.1-A2):
 *
 *  b) JEDEN WZÓR MENU 3 WE WSZYSTKICH ZAKŁADKACH. Słowa właściciela:
 *     „Straszny bałagan w menu trzecim. Poukładaj, żeby było we wszystkich
 *     zakładkach i funkcjonowało tak, jak powinno." Sesje miały 12 chipów
 *     etapów wychodzących poza ekran, Biblioteka 5, Wyniki/Raporty ZERO,
 *     Inicjatywy linijkę disclaimera zamiast Menu 3. Teraz KAŻDA zakładka ma
 *     dokładnie ten sam kształt: dropdown z PEŁNĄ listą w Menu 2
 *     (`Menu2PresetDropdown`, ten sam komponent co Inicjatywy/DEC-420 i
 *     Wyniki/DEC-422) + Menu 3 z ≤3 chipami o największej wartości
 *     decyzyjnej. Filtry kolumnowe w nagłówkach tabel zostają bez zmian.
 *
 *  c) ZAKŁADKA „USTALENIA" USUNIĘTA. Słowa właściciela: „Wywal Ustalenia z
 *     tej zakładki — nie wiem, po co to jest." Ustalenia są i zostają
 *     osiągalne tam, gdzie powstają: w warsztacie kryterium
 *     (`workspace/FindingPanel.tsx`, wołacz `listFindings`). Serwer
 *     (`/api/audits/findings`) i `listFindings` NIE są ruszane — czyta je
 *     m.in. adapter `audit` generatora inicjatyw.
 *
 *  d) GENERATORY JAK W NARZĘDZIACH I OCENIE. Słowa właściciela: „Podpiąć
 *     generator raportów, inicjatyw i insightów jak w pozostałych modułach.
 *     Nic tu nie działa, ma działać dokładnie tak samo jak w Tools albo
 *     Assessment." CTA jest teraz PER ZAKŁADKA i każde woła powierzchnię,
 *     która ISTNIAŁA na serwerze przed tym zadaniem:
 *       Biblioteka/Sesje → „Nowy audyt" (ZAMROŻONY, DEC-417 — bez zmian)
 *       Wyniki           → „Nowy wynik"      → POST /audits/outputs/finalize
 *                          (od DEC-417e osiągalne z pustego stanu „Nowy raport")
 *       Raporty          → „Nowy raport"     → POST /audits/reports
 *       Inicjatywy       → „Nowa inicjatywa" → GeneratorInicjatywModal
 *                                              (adapter `audit`, DEC-413)
 *     WNIOSKI (insighty): w chwili DEC-417d pojęcia „wniosek audytu" nie było
 *     w kodzie, więc zakładki świadomie nie budowano (zakaz atrap).
 *
 * ★ DEC-417e (właściciel, 06.09, karta 3 Audytów — 1.1-A4): „zamiast Wyniki to
 *   Wnioski — to ma działać tak jak pozostałe moduły, które się kończą
 *   wnioskami, raportami i inicjatywami". Menu 2 to dziś Biblioteka · Sesje ·
 *   WNIOSKI · Raporty · Inicjatywy. Silnik powstał w tym samym kroku
 *   (`services/conclusions/auditReportConclusionBridge.ts` +
 *   `POST /api/audits/reports/:id/conclusion` + `syncAuditReports`), więc
 *   zakładka stoi na realnym producencie, nie na atrapie.
 *
 *   WYNIKI (Outputy jądra) przestały być ZAKŁADKĄ, ale ZOSTAJĄ ŹRÓDŁEM i nic
 *   z ich silnika nie zostało skasowane: `POST /audits/outputs/finalize` woła
 *   „Sfinalizuj Output" w podglądzie sesji (`AuditProcessesTab`) oraz modal
 *   „Nowy wynik", do którego prowadzi pusty stan generatora raportu
 *   (raport bez Outputu powstać nie może). Stary link `?tab=outputs` jest
 *   przekierowywany na `conclusions` — żaden nie kończy się pustką.
 *   CTA zakładki Wnioski → „Nowy wniosek" → POST /audits/reports/:id/conclusion.
 */
import { ClipboardList, FileText, Library, Lightbulb, Package, Plus } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { adapterAudit } from '@/components/Initiatives/Generator/adapters/audit';
import { GeneratorInicjatywModal } from '@/components/Initiatives/Generator/GeneratorInicjatywModal';
import {
  Menu2PresetDropdown,
  type Menu2PresetOption,
} from '@/components/Initiatives/Menu2PresetDropdown';
import {
  type StandardCounterChip,
  StandardModuleBar,
  type StandardModuleTab,
} from '@/components/standard';
import type { StatusTone } from '@/components/ui/primitives/chips';
import { Api } from '@/services/api';
import {
  clearPersistentCommandId,
  persistentCommandId,
} from '@/services/initiatives-execution/persistentCommandId';
import { useAppStore } from '@/store/useAppStore';
import { isAuditsScaleAndPolishEnabled } from '@/utils/auditsScaleAndPolishFlag';
import { formatListDate } from '@/utils/listDateFormat';
import { isAdminOwnerOrSuperAdminRole } from '@/utils/roleGuards';

import {
  AUDIT_LIFECYCLE_STATES,
  AUDIT_PROPOSAL_STATUSES,
  AUDIT_REPORT_STATUSES,
  AUDIT_VERIFICATION_STATES,
  approvePackByExpert,
  type AuditLifecycleState,
  type AuditPackSummary,
  type AuditProgramSummary,
  type AuditVerificationState,
  createProgram,
  getProgram,
  listPacks,
  listPrograms,
  publishPack,
} from './auditsMethodApi';
import {
  packVerificationLabel,
  packVerificationTone,
  programLifecycleLabel,
  programLifecycleTone,
  proposalStatusLabel,
  proposalStatusTone,
  reportStatusLabel,
  reportStatusTone,
} from './auditStatusTones';
import { GeneratorWnioskuAudytuModal } from './GeneratorWnioskuAudytuModal';
import { NewAuditModal } from './NewAuditModal';
import { NewAuditOutputModal } from './NewAuditOutputModal';
import { NewAuditReportModal } from './NewAuditReportModal';
import { AuditConclusionsTab } from './tabs/AuditConclusionsTab';
import { AuditInitiativesTab } from './tabs/AuditInitiativesTab';
import { AuditLibraryTab } from './tabs/AuditLibraryTab';
import { AuditProcessesTab } from './tabs/AuditProcessesTab';
import { AuditReportsTab } from './tabs/AuditReportsTab';
import { etykietaStanuWniosku } from './wnioski/projekcjaWnioskowAudytu';

export type AuditsMethodTabId = 'library' | 'processes' | 'conclusions' | 'reports' | 'initiatives';

export function claimAuditStart(inFlight: Set<string>, packId: string): boolean {
  if (inFlight.has(packId)) return false;
  inFlight.add(packId);
  return true;
}

export const AUDIT_START_COMMAND_NAMESPACE = 'audits.program.start.v1';

export function auditStartFingerprint(
  organizationId: string,
  userId: string,
  packId: string
): string {
  return `${organizationId}:${userId}:${packId}`;
}

const TAB_IDS: AuditsMethodTabId[] = [
  'library',
  'processes',
  'conclusions',
  'reports',
  'initiatives',
];
const TAB_ID_SET = new Set<string>(TAB_IDS);

/**
 * Stare adresy sprzed DEC-417e. `?tab=outputs` żył w linkach, zakładkach i
 * testach — po zamianie zakładki na „Wnioski" musi TRAFIAĆ na Wnioski, a nie
 * spadać na `processes` jak nieznana wartość (deep link nie może kończyć się
 * cudzym ekranem).
 */
const TAB_ALIASY: Record<string, AuditsMethodTabId> = { outputs: 'conclusions' };

/**
 * Menu 3 niesie ≤3 chipy NA KAŻDEJ zakładce (DEC-417b). To są te trzy — jeden
 * wzór, jedna lista, żadnej zakładki-wyjątku. Pełna lista wartości mieszka w
 * dropdownie Menu 2 obok (`Menu2PresetDropdown`), więc nic nie znika z
 * produktu — zmienia się tylko miejsce, w którym się je wybiera.
 */
const MENU3_LIBRARY: AuditVerificationState[] = ['VERIFIED', 'PENDING_REVIEW'];
const MENU3_PROCESSES: AuditLifecycleState[] = ['planning', 'fieldwork'];
/** Menu 3 to ≤3 chipy RAZEM z „Wszystkie” (bramka DEC-417b), więc dwa stany
 * o największej wartości decyzyjnej; pełna lista stanów wniosku żyje w
 * dropdownie Menu 2 obok. */
const MENU3_CONCLUSIONS = ['candidate', 'published'] as const;

/** PEŁNA lista stanów wniosku — dropdown Menu 2 (nic nie znika z produktu,
 * zmienia się tylko miejsce, w którym się je wybiera). */
const STANY_WNIOSKU_MENU2 = [
  'candidate',
  'needs_evidence',
  'needs_review',
  'ready_for_readout',
  'published',
  'converted',
  'rejected',
] as const;
const MENU3_REPORTS = ['draft', 'published'] as const;
const MENU3_INITIATIVES = ['draft', 'registered'] as const;

/** Nieznana/legacy wartość `?tab=` (w tym `findings` sprzed DEC-417c) →
 * `processes` (nigdy `library`, żeby nie ukrywać błędnego linku pod
 * domyślnym stanem). Brak parametru → `library`. */
function resolveTabFromUrl(raw: string | null): AuditsMethodTabId {
  if (!raw) return 'library';
  if (TAB_ID_SET.has(raw)) return raw as AuditsMethodTabId;
  return TAB_ALIASY[raw] ?? 'processes';
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
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentUserId = useAppStore((state) => state.currentUser?.id ?? null);
  const currentOrganizationId = useAppStore((state) => state.currentOrganization?.id ?? null);
  const currentUserRole = useAppStore((state) => state.currentUser?.role ?? null);
  // 1.1-A5 (DEC-428): `POST /packs/:id/approve-expert` i `POST /packs/:id/publish`
  // są bramkowane `isPlatformAdmin(actor)` na backendzie (`packs.routes.ts`,
  // PLATFORM_ADMIN_ROLES = admin/administrator/owner/superadmin) — pakiety
  // nie mają programu audytowego, po którym dałoby się sprawdzić rolę
  // audytową, więc bramka jest platformowa. `isAdminOwnerOrSuperAdminRole`
  // (`utils/roleGuards.ts`) jest ten sam zestaw ról po stronie frontendu.
  const canManagePackLibrary = useMemo(
    () => isAdminOwnerOrSuperAdminRole(currentUserRole),
    [currentUserRole]
  );

  const [activeTab, setActiveTabState] = useState<AuditsMethodTabId>(() =>
    resolveTabFromUrl(searchParams.get('tab'))
  );

  const setActiveTab = useCallback(
    (tab: string) => {
      const next = TAB_ID_SET.has(tab)
        ? (tab as AuditsMethodTabId)
        : (TAB_ALIASY[tab] ?? 'processes');
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
  // JEDEN stan filtra na zakładkę — ten sam obsługuje chip Menu 3 i dropdown
  // Menu 2 (wzorzec `activeLifecyclePreset` z InitiativesHub). Wybór wartości
  // spoza trójki Menu 3 po prostu nie podświetla żadnego chipa.
  const [libraryVerification, setLibraryVerification] = useState<'all' | AuditVerificationState>(
    'all'
  );
  const [processesLifecycle, setProcessesLifecycle] = useState<'all' | AuditLifecycleState>('all');
  const [conclusionsStatus, setConclusionsStatus] = useState<string>('all');
  const [reportsStatus, setReportsStatus] = useState<string>('all');
  const [initiativesStatus, setInitiativesStatus] = useState<string>('all');

  const [reportsReloadToken, setReportsReloadToken] = useState(0);
  const [conclusionsReloadToken, setConclusionsReloadToken] = useState(0);
  const [initiativesReloadToken, setInitiativesReloadToken] = useState(0);

  // Liczniki dla zakładek, których dane wczytuje sam tab (Wyniki/Raporty/
  // Inicjatywy). Tab raportuje rozkład statusów, Hub rysuje z tego chipy i
  // dropdown — bez drugiego pobrania tej samej listy.
  const [conclusionsCounts, setConclusionsCounts] = useState<Record<string, number>>({});
  const [reportsCounts, setReportsCounts] = useState<Record<string, number>>({});
  const [initiativesCounts, setInitiativesCounts] = useState<Record<string, number>>({});

  const [packsAll, setPacksAll] = useState<AuditPackSummary[]>([]);
  const [packsLoading, setPacksLoading] = useState(true);
  const [packsError, setPacksError] = useState<string | null>(null);

  const loadPacks = useCallback(() => {
    setPacksLoading(true);
    setPacksError(null);
    listPacks({ search })
      .then((result) => setPacksAll(result.items))
      .catch((e: any) =>
        setPacksError(
          permissionAwareMessage(
            e,
            isPolish,
            isPolish ? 'Nie udało się wczytać biblioteki' : 'Failed to load the library'
          )
        )
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
          permissionAwareMessage(
            e,
            isPolish,
            isPolish ? 'Nie udało się wczytać programów' : 'Failed to load programs'
          )
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
      packsAll.filter(
        (p) => libraryVerification === 'all' || p.verificationStatus === libraryVerification
      ),
    [packsAll, libraryVerification]
  );

  const filteredPrograms = useMemo(
    () =>
      processesLifecycle === 'all'
        ? programsAll
        : programsAll.filter((p) => p.lifecycleState === processesLifecycle),
    [programsAll, processesLifecycle]
  );

  const allLabel = isPolish ? 'Wszystkie' : 'All';

  // ── Menu 3: ≤3 chipy · Menu 2: pełna lista w dropdownie ───────────────────
  const libraryChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: packsAll.length },
      ...MENU3_LIBRARY.map((value) => ({
        id: value,
        label: packVerificationLabel(value, isPolish),
        count: packsAll.filter((p) => p.verificationStatus === value).length,
        dot: TONE_DOT_CLASS[packVerificationTone(value)],
      })),
    ],
    [packsAll, isPolish, allLabel]
  );

  const libraryOptions: Menu2PresetOption[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: packsAll.length },
      ...AUDIT_VERIFICATION_STATES.map((value) => ({
        id: value,
        label: packVerificationLabel(value, isPolish),
        count: packsAll.filter((p) => p.verificationStatus === value).length,
      })),
    ],
    [packsAll, isPolish, allLabel]
  );

  const processesChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: programsAll.length },
      ...MENU3_PROCESSES.map((value) => ({
        id: value,
        label: programLifecycleLabel(value, isPolish),
        count: programsAll.filter((p) => p.lifecycleState === value).length,
        dot: TONE_DOT_CLASS[programLifecycleTone(value)],
      })),
    ],
    [programsAll, isPolish, allLabel]
  );

  const processesOptions: Menu2PresetOption[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: programsAll.length },
      ...AUDIT_LIFECYCLE_STATES.map((value) => ({
        id: value,
        label: programLifecycleLabel(value, isPolish),
        count: programsAll.filter((p) => p.lifecycleState === value).length,
      })),
    ],
    [programsAll, isPolish, allLabel]
  );

  // Etykieta stanu wniosku — TA SAMA reguła, co na zakładce Wnioski Oceny
  // (`assessment/wnioski/projekcjaWnioskow.ts`); kod techniczny (`candidate`,
  // `needs_review`…) nigdy nie trafia na twarz produktu.
  const conclusionStatusLabel = useCallback(
    (id: string) => etykietaStanuWniosku(id, isPolish),
    [isPolish]
  );

  const conclusionsChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: conclusionsCounts.all ?? 0 },
      ...MENU3_CONCLUSIONS.map((value) => ({
        id: value,
        label: conclusionStatusLabel(value),
        count: conclusionsCounts[value] ?? 0,
        dot: TONE_DOT_CLASS[value === 'published' ? 'success' : 'neutral'],
      })),
    ],
    [conclusionsCounts, conclusionStatusLabel, allLabel]
  );

  const conclusionsOptions: Menu2PresetOption[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: conclusionsCounts.all ?? 0 },
      ...STANY_WNIOSKU_MENU2.map((value) => ({
        id: value,
        label: conclusionStatusLabel(value),
        count: conclusionsCounts[value] ?? 0,
      })),
    ],
    [conclusionsCounts, conclusionStatusLabel, allLabel]
  );

  const reportsChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: reportsCounts.all ?? 0 },
      ...MENU3_REPORTS.map((value) => ({
        id: value,
        label: reportStatusLabel(value, isPolish),
        count: reportsCounts[value] ?? 0,
        dot: TONE_DOT_CLASS[reportStatusTone(value)],
      })),
    ],
    [reportsCounts, isPolish, allLabel]
  );

  const reportsOptions: Menu2PresetOption[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: reportsCounts.all ?? 0 },
      ...AUDIT_REPORT_STATUSES.map((value) => ({
        id: value,
        label: reportStatusLabel(value, isPolish),
        count: reportsCounts[value] ?? 0,
      })),
    ],
    [reportsCounts, isPolish, allLabel]
  );

  const initiativesChips: StandardCounterChip[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: initiativesCounts.all ?? 0 },
      ...MENU3_INITIATIVES.map((value) => ({
        id: value,
        label: proposalStatusLabel(value, isPolish),
        count: initiativesCounts[value] ?? 0,
        dot: TONE_DOT_CLASS[proposalStatusTone(value)],
      })),
    ],
    [initiativesCounts, isPolish, allLabel]
  );

  const initiativesOptions: Menu2PresetOption[] = useMemo(
    () => [
      { id: 'all', label: allLabel, count: initiativesCounts.all ?? 0 },
      ...AUDIT_PROPOSAL_STATUSES.map((value) => ({
        id: value,
        label: proposalStatusLabel(value, isPolish),
        count: initiativesCounts[value] ?? 0,
      })),
    ],
    [initiativesCounts, isPolish, allLabel]
  );

  const [newAuditModalOpen, setNewAuditModalOpen] = useState(false);
  const [newOutputModalOpen, setNewOutputModalOpen] = useState(false);
  const [newReportModalOpen, setNewReportModalOpen] = useState(false);
  const [generatorInicjatywOpen, setGeneratorInicjatywOpen] = useState(false);
  const [generatorWnioskuOpen, setGeneratorWnioskuOpen] = useState(false);
  const scaleAndPolishEnabled = useMemo(() => isAuditsScaleAndPolishEnabled(), []);

  const [startingPackId, setStartingPackId] = useState<string | null>(null);
  const startsInFlight = useRef(new Set<string>());

  const handleStartAudit = useCallback(
    async (pack: AuditPackSummary) => {
      if (!claimAuditStart(startsInFlight.current, pack.id)) return;
      setStartingPackId(pack.id);
      const toastId = toast.loading(
        isPolish ? `Uruchamianie audytu „${pack.title}"…` : `Starting audit "${pack.title}"…`
      );
      try {
        if (!currentOrganizationId || !currentUserId) {
          throw new Error(
            isPolish
              ? 'Brak aktywnej organizacji lub użytkownika.'
              : 'No active organization or user.'
          );
        }
        const commandFingerprint = auditStartFingerprint(
          currentOrganizationId,
          currentUserId,
          pack.id
        );
        const idempotencyKey = persistentCommandId(
          AUDIT_START_COMMAND_NAMESPACE,
          commandFingerprint
        );
        const created = await createProgram(
          {
            packId: pack.id,
            // `formatListDate` (SSOT `utils/listDateFormat.ts`), NIE
            // `toLocaleDateString()` bez locale — ten ostatni bierze locale z
            // przeglądarki, nie z języka konta, i to jest dokładnie defekt,
            // który dał `6/18/2026` na koncie polskim (C4 audytu jakości list).
            name: `${pack.title} — ${formatListDate(new Date())}`,
          },
          idempotencyKey
        );
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
        toast.success(isPolish ? 'Program audytowy utworzony' : 'Audit program created', {
          id: toastId,
        });
        setActiveTab('processes');
        setNewAuditModalOpen(false);
      } catch (e: any) {
        toast.error(
          permissionAwareMessage(
            e,
            isPolish,
            isPolish ? 'Nie udało się rozpocząć audytu' : 'Failed to start the audit'
          ),
          { id: toastId }
        );
      } finally {
        startsInFlight.current.delete(pack.id);
        setStartingPackId(null);
      }
    },
    [currentOrganizationId, currentUserId, isPolish, search, setActiveTab]
  );

  // 1.1-A5 (DEC-428): kebab Biblioteki nie miał ŻADNEJ trasy do
  // `POST /packs/:id/approve-expert` / `POST /packs/:id/publish` — pakiet
  // zostawał w szkicu na zawsze, bo `createProgramFromPack` odmawia
  // (409 `AUDIT_INVALID_STATE`) dopóki `publication_status !== 'published'`,
  // a `publishPack` z kolei odmawia (422 `AUDIT_PACK_NOT_PUBLISHABLE`) bez
  // wcześniejszego zatwierdzenia eksperckiego. Wzór identyczny jak
  // `handleStartAudit` powyżej: optymistyczna podmiana wiersza w `packsAll`
  // z API, `loadPacks()` jako honest fallback gdy odpowiedź jest pusta.
  const [pendingPackActionKey, setPendingPackActionKey] = useState<string | null>(null);

  const handleApprovePackExpert = useCallback(
    async (pack: AuditPackSummary) => {
      const key = `${pack.id}:approve-expert`;
      setPendingPackActionKey(key);
      const toastId = toast.loading(
        isPolish ? `Zatwierdzanie „${pack.title}"…` : `Approving "${pack.title}"…`
      );
      try {
        const updated = await approvePackByExpert(pack.id);
        if (updated) {
          setPacksAll((prev) => prev.map((p) => (p.id === pack.id ? updated : p)));
        } else {
          loadPacks();
        }
        toast.success(isPolish ? 'Pakiet zatwierdzony przez eksperta' : 'Pack expert-approved', {
          id: toastId,
        });
      } catch (e: any) {
        toast.error(
          permissionAwareMessage(
            e,
            isPolish,
            isPolish ? 'Nie udało się zatwierdzić pakietu' : 'Failed to approve the pack'
          ),
          { id: toastId }
        );
      } finally {
        setPendingPackActionKey(null);
      }
    },
    [isPolish, loadPacks]
  );

  const handlePublishPack = useCallback(
    async (pack: AuditPackSummary) => {
      const key = `${pack.id}:publish`;
      setPendingPackActionKey(key);
      const toastId = toast.loading(
        isPolish ? `Publikowanie „${pack.title}"…` : `Publishing "${pack.title}"…`
      );
      try {
        const updated = await publishPack(pack.id);
        if (updated) {
          setPacksAll((prev) => prev.map((p) => (p.id === pack.id ? updated : p)));
        } else {
          loadPacks();
        }
        toast.success(isPolish ? 'Pakiet opublikowany' : 'Pack published', { id: toastId });
      } catch (e: any) {
        toast.error(
          permissionAwareMessage(
            e,
            isPolish,
            isPolish ? 'Nie udało się opublikować pakietu' : 'Failed to publish the pack'
          ),
          { id: toastId }
        );
      } finally {
        setPendingPackActionKey(null);
      }
    },
    [isPolish, loadPacks]
  );

  const tabs: StandardModuleTab[] = useMemo(
    () => [
      {
        id: 'library',
        label: t('audits.method.tabs.library', isPolish ? 'Biblioteka' : 'Library'),
        icon: <Library size={16} />,
      },
      {
        id: 'processes',
        // Id URL zostaje `processes` (linki/deep-linki nie mogą się zepsuć) —
        // zmienia się WYŁĄCZNIE etykieta widoczna (PL „Sesje" / EN „Sessions").
        label: t('audits.method.tabs.processes', isPolish ? 'Sesje' : 'Sessions'),
        icon: <ClipboardList size={16} />,
      },
      {
        // DEC-417e: „zamiast Wyniki to Wnioski". Ikona i miejsce w Menu 2 jak
        // na zakładce Wniosków Oceny (`AssessmentHub`, `Package`).
        id: 'conclusions',
        label: t('audits.method.tabs.conclusions', isPolish ? 'Wnioski' : 'Conclusions'),
        icon: <Package size={16} />,
      },
      {
        id: 'reports',
        label: t('audits.method.tabs.reports', isPolish ? 'Raporty' : 'Reports'),
        icon: <FileText size={16} />,
      },
      {
        id: 'initiatives',
        label: t('audits.method.tabs.initiatives', isPolish ? 'Inicjatywy' : 'Initiatives'),
        icon: <Lightbulb size={16} />,
      },
    ],
    [t, isPolish]
  );

  // JEDEN wzór Menu 3 / Menu 2 dla wszystkich pięciu zakładek (DEC-417b).
  const menu3: Record<
    AuditsMethodTabId,
    {
      chips: StandardCounterChip[];
      options: Menu2PresetOption[];
      value: string;
      onChange: (id: string) => void;
      dropdownLabel: string;
      testId: string;
    }
  > = {
    library: {
      chips: libraryChips,
      options: libraryOptions,
      value: libraryVerification,
      onChange: (id) => setLibraryVerification(id as 'all' | AuditVerificationState),
      dropdownLabel: t(
        'audits.method.filters.verification',
        isPolish ? 'Weryfikacja' : 'Verification'
      ),
      testId: 'audits-library-verification-dropdown',
    },
    processes: {
      chips: processesChips,
      options: processesOptions,
      value: processesLifecycle,
      onChange: (id) => setProcessesLifecycle(id as 'all' | AuditLifecycleState),
      dropdownLabel: t('audits.method.filters.stage', isPolish ? 'Etap' : 'Stage'),
      testId: 'audits-processes-stage-dropdown',
    },
    conclusions: {
      chips: conclusionsChips,
      options: conclusionsOptions,
      value: conclusionsStatus,
      onChange: setConclusionsStatus,
      dropdownLabel: t('audits.method.filters.status', 'Status'),
      testId: 'audits-conclusions-status-dropdown',
    },
    reports: {
      chips: reportsChips,
      options: reportsOptions,
      value: reportsStatus,
      onChange: setReportsStatus,
      dropdownLabel: t('audits.method.filters.status', 'Status'),
      testId: 'audits-reports-status-dropdown',
    },
    initiatives: {
      chips: initiativesChips,
      options: initiativesOptions,
      value: initiativesStatus,
      onChange: setInitiativesStatus,
      dropdownLabel: t('audits.method.filters.status', 'Status'),
      testId: 'audits-initiatives-status-dropdown',
    },
  };

  const activeMenu3 = menu3[activeTab];

  const filterControls = (
    <Menu2PresetDropdown
      label={activeMenu3.dropdownLabel}
      options={activeMenu3.options}
      value={activeMenu3.value}
      onChange={activeMenu3.onChange}
      data-testid={activeMenu3.testId}
    />
  );

  // Rozwiązywanie ID → nazwa dla kolumn/podglądu w Reports/Outputs/
  // Initiatives/Processes. `/api/audits/{reports,outputs,proposals}` NIE
  // dołącza `programName`/`finalizedByName`/`leadAuditorName` (zweryfikowano
  // w `server/src/services/audits/{reportService,outputService,programService}.ts`
  // — te pola nie istnieją w wierszu, tylko `*Id`); frontendowy typ je
  // deklarował, ale zawsze renderowały się jako „—". Zamiast dotykać
  // backendu, rozwiązujemy je tutaj z danych, które Hub już wczytuje
  // (`programsAll`, `packsAll`) plus jedno dodatkowe pobranie listy
  // użytkowników organizacji — dokładnie wzór `authorNameById` z
  // `DiscoveryToolsHub.tsx`.
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

  const [orgUsers, setOrgUsers] = useState<
    Array<{ id: string; firstName: string; lastName: string }>
  >([]);
  useEffect(() => {
    let cancelled = false;
    Api.getUsers()
      .then((fetched) => {
        if (!cancelled) setOrgUsers(fetched || []);
      })
      .catch((err) =>
        console.error('[AuditsMethodHub] Failed to load users for name resolution', err)
      );
    return () => {
      cancelled = true;
    };
  }, []);
  const userNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of orgUsers)
      map.set(u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.id);
    return map;
  }, [orgUsers]);

  // CTA per zakładka (DEC-417d). Biblioteka i Sesje dzielą ten sam,
  // ZAMROŻONY „Nowy audyt" (DEC-417) — reszta woła realny generator.
  const frozenNewAuditCta = {
    label: t('audits.method.newAudit.cta', isPolish ? 'Nowy audyt' : 'New audit'),
    icon: Plus,
    // DEC-417 (06.09, uwaga właściciela 15:29): "Nowy audyt" zamrożony
    // do fali 2 — procedura wgrywania założeń (norma/formatka) i
    // generator pytań audytowych jeszcze nie istnieją. Przycisk
    // zostaje w Menu 2, ale natywnie `disabled` (bez toastu, bez
    // modalu) — `onClick` jest tu tylko dla zgodności typu, nigdy
    // się nie wywoła (patrz `disabled` w StandardModuleBar).
    onClick: () => setNewAuditModalOpen(true),
    disabled: true,
    disabledReason: t(
      'audits.method.newAudit.frozenReason',
      isPolish
        ? 'Zamrożone do fali 2: wgrywanie założeń audytu i generator pytań.'
        : 'Frozen until wave 2: uploading audit assumptions and the question generator.'
    ),
    testId: 'audits-method-new-audit-cta',
  };

  const primaryCta =
    activeTab === 'library' || activeTab === 'processes'
      ? scaleAndPolishEnabled
        ? frozenNewAuditCta
        : undefined
      : activeTab === 'conclusions'
        ? {
            label: t(
              'audits.method.newConclusion.cta',
              isPolish ? 'Nowy wniosek' : 'New conclusion'
            ),
            icon: Plus,
            onClick: () => setGeneratorWnioskuOpen(true),
            testId: 'audits-method-new-conclusion-cta',
          }
        : activeTab === 'reports'
          ? {
              label: t('audits.method.newReport.cta', isPolish ? 'Nowy raport' : 'New report'),
              icon: Plus,
              onClick: () => setNewReportModalOpen(true),
              testId: 'audits-method-new-report-cta',
            }
          : {
              label: t(
                'audits.method.newInitiative.cta',
                isPolish ? 'Nowa inicjatywa' : 'New initiative'
              ),
              icon: Plus,
              onClick: () => setGeneratorInicjatywOpen(true),
              testId: 'audits-method-new-initiative-cta',
            };

  return (
    <StandardModuleBar
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onSearch={setSearch}
      searchValue={search}
      chips={activeMenu3.chips}
      activeChip={activeMenu3.value}
      onChipChange={activeMenu3.onChange}
      filterControls={filterControls}
      primaryCta={primaryCta}
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
            canManagePackLibrary={canManagePackLibrary}
            onApprovePackExpert={handleApprovePackExpert}
            onPublishPack={handlePublishPack}
            pendingPackActionKey={pendingPackActionKey}
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
        ) : activeTab === 'conclusions' ? (
          <AuditConclusionsTab
            isPolish={isPolish}
            statusFilter={conclusionsStatus}
            onCountsChange={setConclusionsCounts}
            reloadToken={conclusionsReloadToken}
          />
        ) : activeTab === 'reports' ? (
          <AuditReportsTab
            isPolish={isPolish}
            programNameById={programNameById}
            statusFilter={reportsStatus}
            onCountsChange={setReportsCounts}
            reloadToken={reportsReloadToken}
          />
        ) : (
          <AuditInitiativesTab
            isPolish={isPolish}
            programNameById={programNameById}
            statusFilter={initiativesStatus}
            onCountsChange={setInitiativesCounts}
            reloadToken={initiativesReloadToken}
          />
        )}
      </div>
      {scaleAndPolishEnabled ? (
        <NewAuditModal
          open={newAuditModalOpen}
          onClose={() => setNewAuditModalOpen(false)}
          packs={packsAll}
          isPolish={isPolish}
          onStartAudit={handleStartAudit}
          starting={startingPackId !== null}
        />
      ) : null}
      <NewAuditOutputModal
        open={newOutputModalOpen}
        onClose={() => setNewOutputModalOpen(false)}
        programs={programsAll}
        isPolish={isPolish}
        onGoToSessions={() => setActiveTab('processes')}
        onFinalized={() => {
          // Output jest źródłem raportu, nie zakładką (DEC-417e) — po
          // finalizacji odświeżamy sesje i wracamy do generatora raportu
          // przez zwykłe „Nowy raport" w Menu 2 zakładki Raporty.
          void loadPrograms();
        }}
      />
      <NewAuditReportModal
        open={newReportModalOpen}
        onClose={() => setNewReportModalOpen(false)}
        isPolish={isPolish}
        programNameById={programNameById}
        onFinalizeSession={() => {
          // Wyniki nie są już zakładką (DEC-417e), więc pusty stan generatora
          // raportu prowadzi do JEDYNEGO producenta Outputu, jaki istnieje:
          // jawnej finalizacji sesji audytowej.
          setNewReportModalOpen(false);
          setNewOutputModalOpen(true);
        }}
        onGenerated={() => setReportsReloadToken((value) => value + 1)}
      />
      <GeneratorWnioskuAudytuModal
        otwarty={generatorWnioskuOpen}
        onClose={() => setGeneratorWnioskuOpen(false)}
        isPolish={isPolish}
        programNameById={programNameById}
        onWygenerowano={() => setConclusionsReloadToken((value) => value + 1)}
        onOtworzWniosek={(id) => navigate(`/conclusions?id=${encodeURIComponent(id)}`)}
      />
      {/* JEDEN generator inicjatyw (DEC-413) — adapter `audit` woła istniejący
          POST /audits/proposals { programId, findingIds[] }
          (`proposalService.draftProposalsFromFindings`). DEC-417d: wołanie
          przeniesione z przycisku wewnątrz zakładki do CTA Menu 2 — JEDNO
          wejście, dokładnie jak w Narzędziach i Ocenie. */}
      <GeneratorInicjatywModal
        isOpen={generatorInicjatywOpen}
        onClose={() => setGeneratorInicjatywOpen(false)}
        adaptery={[adapterAudit]}
        onCompleted={() => setInitiativesReloadToken((value) => value + 1)}
      />
    </StandardModuleBar>
  );
};

export default AuditsMethodHub;
