/**
 * Zlecenie — POWŁOKA ARTEFAKTU (SPEC-A, archetyp C „Rekord", klasa L).
 *
 * ★ CO SIĘ TU ZMIENIŁO (2026-08-10). Ten ekran był wcześniej zbudowany na
 * `StandardModuleBar` — czyli na powłoce LISTY. To realne odstępstwo od
 * SPEC-A: zlecenie jest OBIEKTEM (ma tożsamość, adres, cykl życia, powiązania
 * i historię), a nie zbiorem wierszy. Teraz ekran stoi na
 * `StandardArtifactShell` (`src/components/standard/StandardArtifactShell.tsx`),
 * który opakowuje `NModeShell` i sam renderuje `ArtifactRightPanel`
 * (tamże, linia 399) — zero lokalnej imitacji powłoki.
 *
 * Co z tego wynika wprost (ARTIFACT_ANATOMY_STANDARD.md §10.2/§11.2):
 *  · Menu 1 = powrót · ikona-typ · tytuł · pigułka statusu · wskaźnik zapisu ·
 *    JEDEN primary · kebab z kodem obiektu i linkiem — wszystko z `NModeHeader`,
 *  · Plan · Realizacja · Rezultaty to KANONICZNA nawigacja powłoki (lewa
 *    kolumna `NModeLeftNav`), nie własny pasek zakładek,
 *  · prawy panel to accordion o stałej kolejności Akcje · Właściwości ·
 *    Powiązania · Źródła i założenia · Historia (Komentarze jawnie pominięte),
 *  · projekcja planu (Prosty/Ekspercki/Lista) siedzi w slocie `toolbar`
 *    (`NModeToolbar`) — jedyna dozwolona droga własnego paska (SPEC-N §2.4).
 *
 * Stan ekranu żyje w adresie (`?zakladka=&widok-planu=&krok=`), więc adres da
 * się wysłać drugiej osobie i pokaże jej to samo. Wyjście do obiektu w innym
 * module DODATKOWO zapisuje migawkę powrotu (sekcja „PAMIĘĆ POWROTU" niżej).
 *
 * Ładowanie jest ROZDZIELONE na sekcje (`settleSection`): padnięcie jednej
 * z nich daje jawny stan CZĘŚCIOWY z nazwą brakującej sekcji, a nie cichą
 * pustkę i nie błąd całego ekranu.
 */

import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Link2,
  ListChecks,
  Lock,
  RefreshCw,
  Route as RouteIcon,
  ScrollText,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import { NModeToolbar } from '@/components/shared/NModeLayout/NModeToolbar';
import { PreviewActionBar, PreviewActivityStrip } from '@/components/shared/PreviewPane';
import { ArtifactPropertiesTable } from '@/components/standard/ArtifactPropertiesTable';
import type { KartaNKey } from '@/components/standard/registry';
import {
  StandardArtifactShell,
  type StandardSekcjaDef,
} from '@/components/standard/StandardArtifactShell';
import type { PresentationMode } from '@/hooks/usePresentationMode';
import {
  artifactLinkRelationLabel,
  autonomyPolicyLabel,
  caseProfileLabel,
  caseStatusLabel,
  closureTypeLabel,
  governanceTierLabel,
  linkedTypeLabel,
  planVersionStatusLabel,
  valueMeasurementStatusLabel,
} from '@/utils/enumLabels';

import {
  getCase,
  getCaseIntakeSummary,
  getPlanGraph,
  listArtifactLinks,
  listHistoryEvents,
  listPlanVersions,
  listProposals,
  listValueMeasurements,
  listWaits,
  newIdempotencyKey,
  settleSection,
  toFailure,
  validatePlanVersion,
} from './api';
import { startLightOneClick } from './apiLightStart';
import {
  nazwaZlecenia,
  rememberedListLocation,
  rememberOpenedCase,
} from './CasesListScreen';
import { PLAN_PROJECTIONS, type PlanProjection, PlanView } from './PlanView';
import { RealizacjaView } from './RealizacjaView';
import {
  jestPowiazaniemDokumentu,
  kluczFokusuObiektu,
  type OtwarcieObiektu,
  type OtwarcieZadanie,
  type RezultatSelection,
  RezultatyView,
  rozstrzygnijOtwarcie,
  weryfikujIstnienieDokumentu,
} from './RezultatyView';
import type {
  CanonicalGraph,
  CaseActionProposal,
  CaseApiFailure,
  CaseArtifactLink,
  CaseCoreView,
  CaseHistoryEvent,
  CaseIntakeSummary,
  CasePlanVersion,
  CaseWait,
  PlanGraphEnvelope,
  PlanValidationResult,
  ValueMeasurement,
} from './types';
import {
  CaseStateBlock,
  FOCUS_RING,
  formatDate,
  formatDateTime,
  PartialBanner,
  StatusTag,
  TechnicalId,
} from './ui';

type Tab = 'plan' | 'realizacja' | 'rezultaty';

const TABS: Array<{
  id: Tab;
  label: string;
  description: string;
  icon: React.FC<{ size?: number; className?: string }>;
}> = [
  {
    id: 'plan',
    label: 'Plan',
    description: 'Co i w jakiej kolejności ma się wydarzyć.',
    icon: RouteIcon,
  },
  {
    id: 'realizacja',
    label: 'Realizacja',
    description: 'Co się dzieje teraz i na co czekamy.',
    icon: ListChecks,
  },
  {
    id: 'rezultaty',
    label: 'Rezultaty',
    description: 'Co powstało i czy efekt został potwierdzony.',
    icon: BarChart3,
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// PAMIĘĆ POWROTU — wyjście do innego modułu i powrót „tam, gdzie byłem"
// ═══════════════════════════════════════════════════════════════════════════
//
// Adres niesie zakładkę, krok planu i projekcję, więc te trzy rzeczy wracają
// same. NIE wracają natomiast: pozycja przewijania i fokus — przeglądarka nie
// odtwarza scrolla kontenera wewnątrz aplikacji jednostronicowej, a fokus po
// zamontowaniu nowego drzewa ląduje na `<body>`. Dlatego przed wyjściem
// zapisujemy migawkę i odtwarzamy ją po powrocie.
//
// `sessionStorage`, nie `localStorage`: migawka dotyczy JEDNEJ sesji karty
// przeglądarki i nie ma prawa przetrwać jej zamknięcia. Zużywana JEDNORAZOWO —
// inaczej wejście na zlecenie z zakładki albo z listy przeskakiwałoby w dół
// bez powodu, dzień później.

const KLUCZ_POWROTU = 'zlecenia.powrot';
/** Migawka starsza niż 30 min to już nie „powrót", tylko przypadek. */
const WAZNOSC_POWROTU_MS = 30 * 60 * 1000;

interface StanPowrotu {
  caseId: string;
  zakladka: Tab;
  krok: string | null;
  widokPlanu: PlanProjection;
  scrollCentrum: number;
  scrollPanel: number;
  kluczFokusu: string | null;
  /** Przewinięcia (obie osie) wszystkich kontenerów nad elementem fokusu. */
  przewinieciaFokusu: PozycjaPrzewiniecia[];
  etykieta: string;
  /** Otwarty podgląd w sekcji Rezultaty — bez niego wysokość treści się zmienia. */
  wybor: RezultatSelection;
  adresListy: string;
  zapisanoO: number;
}

function zapiszStanPowrotu(stan: StanPowrotu): void {
  try {
    window.sessionStorage.setItem(KLUCZ_POWROTU, JSON.stringify(stan));
  } catch {
    // Prywatny tryb przeglądarki / wyłączony storage — powrót zadziała bez
    // przywrócenia przewinięcia. To degradacja, nie awaria: świadomie cicha.
  }
}

function pobierzStanPowrotu(caseId: string): StanPowrotu | null {
  try {
    const surowy = window.sessionStorage.getItem(KLUCZ_POWROTU);
    if (!surowy) return null;
    const stan = JSON.parse(surowy) as StanPowrotu;
    if (stan?.caseId !== caseId) return null;
    if (!stan.zapisanoO || Date.now() - stan.zapisanoO > WAZNOSC_POWROTU_MS) {
      window.sessionStorage.removeItem(KLUCZ_POWROTU);
      return null;
    }
    return stan;
  } catch {
    return null;
  }
}

function wyczyscStanPowrotu(): void {
  try {
    window.sessionStorage.removeItem(KLUCZ_POWROTU);
  } catch {
    /* jw. */
  }
}

/**
 * Najbliższy przodek, który REALNIE się przewija.
 *
 * Powłoka `NModeShell` przewija w dwóch niezależnych kontenerach (kolumna
 * centrum i prawy panel) i żadnego z nich nie wystawia refem. Zamiast zgadywać
 * selektorem CSS (kruche — klasy powłoki mogą się zmienić), pytamy DOM o fakt:
 * `overflow-y` pozwala przewijać I treść jest wyższa niż okno kontenera.
 */
function kontenerScrolla(node: HTMLElement | null): HTMLElement | null {
  let el: HTMLElement | null = node?.parentElement ?? null;
  while (el && el !== document.body) {
    const styl = window.getComputedStyle(el);
    if (/(auto|scroll)/.test(styl.overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
    el = el.parentElement;
  }
  return null;
}

/**
 * WSZYSTKIE przewijalne kontenery nad elementem (pionowo LUB poziomo).
 *
 * ★ ZMIERZONE: sam kontener kolumny centrum nie wystarczy. Przycisk „Otwórz"
 * siedzi w OSTATNIEJ kolumnie tabeli, a tabela ma własne przewijanie poziome.
 * Po powrocie kolumna wracała na pozycję 0, więc element z przywróconym fokusem
 * był poza kadrem — fokus istniał, ale nie było go WIDAĆ. Zapisujemy więc obie
 * osie dla całego łańcucha kontenerów nad elementem, a nie jedną liczbę.
 */
function kontenerySkrolla(node: HTMLElement | null): HTMLElement[] {
  const znalezione: HTMLElement[] = [];
  let el: HTMLElement | null = node?.parentElement ?? null;
  while (el && el !== document.body && znalezione.length < 4) {
    const styl = window.getComputedStyle(el);
    const przewijalny =
      (/(auto|scroll)/.test(styl.overflowY) && el.scrollHeight > el.clientHeight + 1) ||
      (/(auto|scroll)/.test(styl.overflowX) && el.scrollWidth > el.clientWidth + 1);
    if (przewijalny) znalezione.push(el);
    el = el.parentElement;
  }
  return znalezione;
}

interface PozycjaPrzewiniecia {
  top: number;
  left: number;
}

// ═══════════════════════════════════════════════════════════════════════════

interface CaseBundle {
  caseItem: CaseCoreView;
  planVersions: CasePlanVersion[];
  graph: CanonicalGraph | null;
  validation: PlanValidationResult | null;
  waits: CaseWait[];
  proposals: CaseActionProposal[];
  measurements: ValueMeasurement[];
  artifactLinks: CaseArtifactLink[];
  history: CaseHistoryEvent[];
  /**
   * Cel i oczekiwany rezultat z potwierdzonego work ordera — JEDYNE realne
   * źródło nazwy zlecenia (patrz komentarz przy `nazwaZlecenia`
   * w `CasesListScreen.tsx`). `null`, gdy sprawa powstała bez intake.
   */
  intake: CaseIntakeSummary | null;
  failedSections: string[];
  blocked: boolean;
}

/**
 * Przebieg zlecenia PO POLSKU, także dla zdarzeń, które backend generuje po
 * angielsku.
 *
 * ★ ZOBACZONE NA ZRZUCIE (2026-08-10): akordeon „Historia" mieszał języki —
 * obok polskich zdań („Plan zlecenia zatwierdzony przez sponsora") stało
 * `Value measurement recorded for metric "…" (…): PARTIAL`. To NIE jest literówka
 * w UI: `caseHistoryService.ts:916` składa ten napis po angielsku po stronie
 * serwera, a serwer nie należy do tej zmiany.
 *
 * Dlatego zdanie SKŁADAMY z danych (`payload` — realne pole odpowiedzi), a nie
 * tłumaczymy napisu. Nazwa wskaźnika żyje wyłącznie w `summary` (payload jej nie
 * niesie), więc wyjmujemy ją z cudzysłowu — a gdy kształt się nie zgadza, wraca
 * ORYGINALNY napis serwera. Nigdy nie zgadujemy treści zdarzenia.
 */
function opisZdarzenia(event: CaseHistoryEvent): string {
  const surowy = event.summary || event.eventType;
  if (event.eventType !== 'VALUE_MEASUREMENT_RECORDED') return surowy;

  const payload = event.payload ?? {};
  const nazwaZCudzyslowu = /"([^"]+)"/.exec(event.summary ?? '')?.[1]?.trim() || null;
  const klucz = typeof payload.metricKey === 'string' ? payload.metricKey.trim() : '';
  const wskaznik = nazwaZCudzyslowu || klucz || null;
  const stan =
    typeof payload.measurementStatus === 'string'
      ? valueMeasurementStatusLabel(payload.measurementStatus, true)
      : null;

  if (!wskaznik || !stan) return surowy;
  return `Zapisano pomiar wartości dla wskaźnika „${wskaznik}" — stan: ${stan}.`;
}

/**
 * Zdarzenie SKŁADANE z rdzenia zlecenia, nie odczytane z
 * `case_workspace_history_events` — patrz `syntetyczneZdarzeniaCyklu` niżej.
 */
interface ZdarzenieHistorii {
  id: string;
  description: string;
  timestamp: string;
}

/**
 * Bazowe fakty cyklu życia zlecenia — ZAWSZE dostępne z `case_core`,
 * niezależnie od tego, czy backend zapisał dla nich osobny wiersz w
 * `case_workspace_history_events`.
 *
 * ★ ZMIERZONE NA ŻYWEJ BAZIE (2026-08-10, `case_workspace_test`, 807 wierszy
 * `case_core`): tabela zdarzeń ma wpis `case.created` dla JEDNEGO zlecenia i
 * ZERO wpisów `case.cancelled`/`case.closed`/`case.failed` — mimo że
 * `case_status` realnie jest CANCELLED dla wielu wierszy (sprawdzone m.in. na
 * `case-069705ec-d59d-4d7a-a02b-e237cfdd750a`, zero wierszy historii).
 * Przyczyna: `transitionStatus` (`caseCoreService.ts:637-651`) i ścieżka
 * intake (`caseIntakeService.ts:1038`) publikują te fakty WYŁĄCZNIE do
 * outboksa zdarzeń integracyjnych (`eventOutboxService.publishEvent`) —
 * NIGDY do tabeli, z której czyta ten panel
 * (`caseHistoryService.listHistoryEvents`). To luka w danych backendu (poza
 * zasięgiem tej zmiany), ale panel „Historia" jest OBOWIĄZKOWYM blokiem
 * SPEC-A (`ARTIFACT_ANATOMY_STANDARD.md §18.1`) — pusty panel dla zlecenia,
 * które realnie powstało i (dla zleceń terminalnych) zostało zamknięte albo
 * anulowane, jest niehonest UI. Dopóki backend nie zapisuje tych faktów jako
 * zdarzeń, SKŁADAMY je tutaj z kolumn, których ekran już używa w sekcji
 * Właściwości (`createdAt`, `completedAt`/`closedAt`, `closureType`,
 * `caseStatus`) — nie zgadujemy niczego, czego `case_core` by nie potwierdzał.
 *
 * Dedup: gdy backend TAKI wiersz jednak zapisał (obserwowane u jednego z 807
 * zleceń), realny wpis wygrywa — nie dublujemy.
 */
function syntetyczneZdarzeniaCyklu(
  caseItem: CaseCoreView,
  history: CaseHistoryEvent[]
): ZdarzenieHistorii[] {
  const maRealnyWpis = (eventType: string) =>
    history.some((event) => event.eventType === eventType);
  const wpisy: ZdarzenieHistorii[] = [];

  if (!maRealnyWpis('case.created')) {
    wpisy.push({
      id: 'syntetyczne:zalozenie',
      description: 'Zlecenie założone.',
      timestamp: caseItem.createdAt,
    });
  }

  const TERMINALNE: Partial<
    Record<CaseCoreView['caseStatus'], { eventType: string; opis: string }>
  > = {
    CLOSED: {
      eventType: 'case.closed',
      opis: caseItem.closureType
        ? `Zlecenie zamknięte jako „${closureTypeLabel(caseItem.closureType, true).toLowerCase()}".`
        : 'Zlecenie zamknięte.',
    },
    FAILED: { eventType: 'case.failed', opis: 'Zlecenie zakończone niepowodzeniem.' },
    CANCELLED: { eventType: 'case.cancelled', opis: 'Zlecenie anulowane.' },
  };
  const terminal = TERMINALNE[caseItem.caseStatus];
  if (terminal && !maRealnyWpis(terminal.eventType)) {
    wpisy.push({
      id: `syntetyczne:${terminal.eventType}`,
      description: terminal.opis,
      // `closedAt` istnieje tylko dla ścieżki `recordClosure` (CLOSED);
      // CANCELLED/FAILED zapisują wyłącznie `completedAt` — stąd oba źródła,
      // z `updatedAt` jako ostatnią, zawsze-obecną deską ratunku.
      timestamp: caseItem.closedAt ?? caseItem.completedAt ?? caseItem.updatedAt,
    });
  }

  return wpisy;
}

/** Kolejność, w jakiej szukamy „rezultatu do otwarcia" przyciskiem głównym. */
const PIERWSZENSTWO_REZULTATU: Array<CaseArtifactLink['relation']> = [
  'DELIVERABLE',
  'OUTPUT',
  'OUTCOME_MEASUREMENT',
  'EVIDENCE',
  'DECISION_BASIS',
  'INPUT',
];

export const CaseDetailScreen: React.FC = () => {
  const { caseId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const tab = (searchParams.get('zakladka') as Tab | null) ?? 'plan';
  const projection = (searchParams.get('widok-planu') as PlanProjection | null) ?? 'prosty';
  const selectedNodeId = searchParams.get('krok');

  const [bundle, setBundle] = useState<CaseBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<CaseApiFailure | null>(null);
  const [gestosc, setGestosc] = useState<PresentationMode>('n');
  const [komunikat, setKomunikat] = useState<string | null>(null);

  /*
   * ★ ZMIERZONE NA ŻYWEJ BAZIE (2026-08-10): 0 z 70 powiązań typu „document"
   * w `case_workspace_artifact_links` wskazuje realny wiersz w
   * `wave5_artifacts` — `linkArtifactToCase` świadomie NIE sprawdza istnienia
   * przy powiązaniu (`artifactLinkService.ts:432`, komentarz „does not
   * pre-check"). Efekt na żywym ekranie: „Otwórz rezultat" (jedyny primary
   * Menu 1) i „Otwórz" w Powiązaniach wyglądały na aktywne dla
   * `cwlink-doc-otwieralny` → `case-8099338b-…`, a kliknięcie lądowało na
   * „Nie znaleziono tego dokumentu" w Document Studio — poprawny routing,
   * zła dana. `rozstrzygnijOtwarcie` (RezultatyView.tsx) klasyfikuje WYŁĄCZNIE
   * po typie + `link_status`, bo więcej nie ma z czego — nie dowodzi to
   * istnienia celu. Doganiamy to TU, jednym bezpiecznym odczytem na obiekt
   * (ten sam GET, którego Document Studio i tak używa przy otwarciu,
   * `weryfikujIstnienieDokumentu` w RezultatyView.tsx — cache współdzielony
   * z tabelą „Powiązane obiekty"), i NADPISUJEMY wynik na „niedostępny" z
   * uczciwym powodem, gdy się nie potwierdzi. Nigdy w drugą stronę: start
   * jest zawsze `rozstrzygnijOtwarcie` (brak flashu złego stanu), nadpisanie
   * tylko DOKŁADA ostrożność, nigdy jej nie zdejmuje.
   */
  const [nadpisaniaWeryfikacji, setNadpisaniaWeryfikacji] = useState<
    Record<string, OtwarcieObiektu>
  >({});

  useEffect(() => {
    let anulowano = false;
    const linki = bundle?.artifactLinks ?? [];
    linki
      .filter(jestPowiazaniemDokumentu)
      .filter((link) => rozstrzygnijOtwarcie(link).status === 'otwieralny')
      .forEach((link) => {
        weryfikujIstnienieDokumentu(link.artifactId).then((istnieje) => {
          if (anulowano || istnieje) return;
          setNadpisaniaWeryfikacji((prev) => ({
            ...prev,
            [link.linkId]: {
              status: 'niedostepny',
              powod:
                'Ten dokument nie istnieje w module Dokumenty (mógł zostać usunięty albo ' +
                'nigdy nie powstał mimo aktywnego powiązania). Sprawdzone na żywo przy ' +
                'otwarciu tego zlecenia.',
            },
          }));
        });
      });
    return () => {
      anulowano = true;
    };
  }, [bundle]);

  const rozstrzygnijOtwarcieZWeryfikacja = useCallback(
    (link: CaseArtifactLink): OtwarcieObiektu =>
      nadpisaniaWeryfikacji[link.linkId] ?? rozstrzygnijOtwarcie(link),
    [nadpisaniaWeryfikacji]
  );

  /*
   * LIGHT one-click ("Zatwierdź i rozpocznij") — jedna akcja: Plan v1 →
   * walidacja → publikacja → Run → NodeRun, atomowo po stronie backendu
   * (`lightOneClickService.startLightOneClick`). `lightStartKeyRef` niesie
   * TEN SAM klucz idempotencji przy ponowieniu tej samej intencji (podwójny
   * klik, błąd sieci) — zerowany dopiero, gdy komenda faktycznie DOSZŁA do
   * skutku (sukces ALBO świadoma odmowa), zgodnie z regułą z `api.ts`.
   */
  const [lightStart, setLightStart] = useState<
    | { status: 'idle' }
    | { status: 'pending' }
    | { status: 'refused'; reasonDetail: string }
    | { status: 'error'; message: string; refreshSuggested: boolean }
  >({ status: 'idle' });
  const lightStartKeyRef = useRef<string | null>(null);

  /*
   * Migawkę powrotu czytamy SYNCHRONICZNIE, w pierwszym renderze — nie w efekcie.
   * Gdyby czytał ją efekt, sekcja Rezultaty zdążyłaby się już zamontować z pustym
   * zaznaczeniem, a przywrócony podgląd „doklejałby się" po chwili, zmieniając
   * wysokość treści pod już odtworzonym przewinięciem.
   */
  const [stanPowrotu] = useState<StanPowrotu | null>(() =>
    caseId ? pobierzStanPowrotu(caseId) : null
  );
  const [wyborRezultatow, setWyborRezultatow] = useState<RezultatSelection>(
    () => stanPowrotu?.wybor ?? null
  );

  const kotwicaSekcjiRef = useRef<HTMLHeadingElement | null>(null);
  const znacznikCentrumRef = useRef<HTMLSpanElement | null>(null);
  const znacznikPanuRef = useRef<HTMLSpanElement | null>(null);
  const przywroconoRef = useRef(false);

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    setFailure(null);
    try {
      // Rdzeń zlecenia MUSI się udać — bez niego nie ma czego pokazywać, więc
      // jego błąd jest błędem ekranu (404 = enumeration-safe „nie znaleziono").
      const caseItem = await getCase(caseId);
      const failedSections: string[] = [];
      const blockedFlag = { blocked: false };

      const [planVersions, waits, proposals, measurements, artifactLinks, history, intake] =
        await Promise.all([
          settleSection(
            'plan',
            listPlanVersions(caseId),
            [] as CasePlanVersion[],
            failedSections,
            blockedFlag
          ),
          settleSection(
            'oczekiwania',
            listWaits(caseId),
            [] as CaseWait[],
            failedSections,
            blockedFlag
          ),
          settleSection(
            'sprawy do zatwierdzenia',
            listProposals(caseId),
            [] as CaseActionProposal[],
            failedSections,
            blockedFlag
          ),
          settleSection(
            'pomiary wartości',
            listValueMeasurements(caseId),
            [] as ValueMeasurement[],
            failedSections,
            blockedFlag
          ),
          settleSection(
            'powiązane obiekty',
            listArtifactLinks(caseId),
            [] as CaseArtifactLink[],
            failedSections,
            blockedFlag
          ),
          settleSection(
            'przebieg zlecenia',
            listHistoryEvents(caseId),
            [] as CaseHistoryEvent[],
            failedSections,
            blockedFlag
          ),
          settleSection<CaseIntakeSummary | null>(
            'cel zlecenia',
            getCaseIntakeSummary(caseId),
            null,
            failedSections,
            blockedFlag
          ),
        ]);

      // Wersja planu do pokazania: najpierw ta wskazana przez zlecenie,
      // potem ostatnia zatwierdzona, na końcu po prostu najnowsza.
      const current =
        planVersions.find((v) => v.casePlanVersionId === caseItem.currentPlanVersionId) ??
        planVersions.find((v) => v.status === 'PUBLISHED') ??
        planVersions[0] ??
        null;

      let graph: CanonicalGraph | null = current?.semanticGraph ?? null;
      let validation: PlanValidationResult | null = null;
      if (current) {
        /*
         * ★ DEFEKT ZMIERZONY W PRZEGLĄDARCE (2026-08-10), nie w harnessie.
         *
         * Trasa `/plan-versions/:id/graph` oddaje KOPERTĘ
         * `{ graphId, graphDigest, semanticGraph }`. Ta linia przypisywała
         * kopertę wprost do `graph`, więc `graph.nodes` było `undefined` i
         * PlanView pisał „Ten plan nie ma jeszcze kroków" dla planu
         * PUBLISHED z dwoma węzłami — po tym, jak linijkę wyżej ustawiono
         * już POPRAWNY graf z `current.semanticGraph`. Naprawa nadpisuje graf
         * WYŁĄCZNIE wtedy, gdy koperta faktycznie niesie węzły; gdy odczyt
         * padnie (settleSection zwróci `null`), zostaje graf z wersji planu i
         * ekran dalej ma co pokazać.
         */
        const koperta = await settleSection<PlanGraphEnvelope | null>(
          'graf planu',
          getPlanGraph(current.casePlanVersionId),
          null,
          failedSections,
          blockedFlag
        );
        if (koperta?.semanticGraph) graph = koperta.semanticGraph;
        validation = await settleSection(
          'sprawdzenie planu',
          validatePlanVersion(current.casePlanVersionId),
          null,
          failedSections,
          blockedFlag
        );
      }

      setBundle({
        caseItem,
        planVersions,
        graph,
        validation,
        waits,
        proposals,
        measurements,
        artifactLinks,
        history,
        intake,
        failedSections,
        blocked: blockedFlag.blocked,
      });
      setLoading(false);
    } catch (error) {
      setFailure(toFailure(error));
      setBundle(null);
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * "Zatwierdź i rozpocznij" — JEDNA akcja UI, JEDNO wywołanie backendu.
   * `outcome: 'refused'` to NIE błąd sieci/serwera — backend świadomie nie
   * uruchomił Runu i podał dokładny powód; ekran ma go POKAZAĆ, nie ukryć za
   * generycznym `toFailure`. Po każdym wyniku (sukces, odmowa, błąd)
   * odświeżamy `bundle` z serwera — nigdy nie malujemy stanu z pamięci.
   */
  const handleLightStart = useCallback(async () => {
    if (!caseId) return;
    setLightStart({ status: 'pending' });
    if (!lightStartKeyRef.current) lightStartKeyRef.current = newIdempotencyKey();
    const result = await startLightOneClick(caseId, { idempotencyKey: lightStartKeyRef.current });
    if (!result.ok) {
      setLightStart({
        status: 'error',
        message: result.failure.message,
        refreshSuggested: result.failure.refreshSuggested,
      });
      setKomunikat(result.failure.message);
      return;
    }
    // Komenda DOSZŁA do skutku (sukces albo świadoma odmowa) — kolejny klik
    // to nowa intencja, więc dostaje nowy klucz idempotencji.
    lightStartKeyRef.current = null;
    if (result.value.outcome === 'refused') {
      const powod = result.value.reasonDetail || 'Nieznany powód.';
      setLightStart({ status: 'refused', reasonDetail: powod });
      setKomunikat(`Zlecenie LIGHT nie zostało uruchomione: ${powod}`);
    } else {
      setLightStart({ status: 'idle' });
      setKomunikat(
        result.value.outcome === 'already_started'
          ? 'Zlecenie LIGHT jest już zatwierdzone i uruchomione.'
          : 'Zlecenie LIGHT zostało zatwierdzone i uruchomione.'
      );
    }
    await load();
  }, [caseId, load]);

  /*
   * Tożsamość `setParam` MUSI być stabilna, a nawigacja pomijana, gdy adres się
   * nie zmienia (`NModeLeftNav`/toolbar wołają handlery także z efektów;
   * niestabilny handler = pętla renderowania).
   */
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const prev = searchParamsRef.current;
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') next.delete(key);
        else next.set(key, value);
      }
      if (next.toString() === prev.toString()) return;
      setSearchParams(next, { replace: false });
    },
    [setSearchParams]
  );

  /*
   * Powrót do listy — JEDNO kliknięcie, właściwa lista, zachowany filtr.
   *
   * ★ ZMIERZONE NA ŻYWYM EKRANIE, nie wywnioskowane z kodu: `navigate(-1)`
   * cofało o JEDEN wpis historii, a przełączanie sekcji i projekcji planu wpisy
   * DODAJE, więc powrót do listy wymagał tylu kliknięć, ile rzeczy użytkownik
   * po drodze przełączył. Idziemy WPROST pod zapamiętany adres listy.
   */
  const goToList = useCallback(() => {
    rememberOpenedCase(caseId);
    wyczyscStanPowrotu();
    navigate(rememberedListLocation());
  }, [caseId, navigate]);

  const currentPlanVersion = useMemo(() => {
    if (!bundle) return null;
    return (
      bundle.planVersions.find(
        (v) => v.casePlanVersionId === bundle.caseItem.currentPlanVersionId
      ) ??
      bundle.planVersions.find((v) => v.status === 'PUBLISHED') ??
      bundle.planVersions[0] ??
      null
    );
  }, [bundle]);

  // ── Otwieranie obiektów w ICH modułach + zapis migawki powrotu ────────────
  const otworzObiekt = useCallback(
    (zadanie: OtwarcieZadanie) => {
      zapiszStanPowrotu({
        caseId,
        zakladka: tab,
        krok: selectedNodeId,
        widokPlanu: projection,
        scrollCentrum: kontenerScrolla(znacznikCentrumRef.current)?.scrollTop ?? 0,
        scrollPanel: kontenerScrolla(znacznikPanuRef.current)?.scrollTop ?? 0,
        kluczFokusu: zadanie.kluczFokusu,
        przewinieciaFokusu: kontenerySkrolla(
          document.querySelector<HTMLElement>(
            `[data-cw-focus="${CSS.escape(zadanie.kluczFokusu)}"]`
          )
        ).map((el) => ({ top: el.scrollTop, left: el.scrollLeft })),
        etykieta: zadanie.etykieta,
        wybor: wyborRezultatow,
        adresListy: rememberedListLocation(),
        zapisanoO: Date.now(),
      });
      navigate(zadanie.sciezka);
    },
    [caseId, navigate, projection, selectedNodeId, tab, wyborRezultatow]
  );

  /*
   * Przywrócenie po powrocie. Kolejność jest istotna:
   *  1. brakujące parametry adresu (gdy ktoś wrócił „gołym" linkiem do zlecenia),
   *  2. przewinięcie obu kontenerów,
   *  3. fokus na elemencie, z którego wyszliśmy.
   *
   * Uczciwie o zasięgu: element w ZWINIĘTEJ sekcji prawego panelu nie istnieje
   * w DOM po ponownym zamontowaniu (powłoka zwija wszystko poza „Akcje" —
   * `StandardArtifactShell.tsx:353`). Wtedy fokus ląduje na nagłówku sekcji
   * i mówimy o tym na głos (`role="status"`), zamiast zostawić fokus na
   * `<body>` i udawać, że wróciliśmy dokładnie tam, gdzie byliśmy.
   */
  useEffect(() => {
    if (loading || !bundle || przywroconoRef.current) return;
    const stan = stanPowrotu;
    przywroconoRef.current = true;
    if (!stan) {
      kotwicaSekcjiRef.current?.focus();
      return;
    }
    wyczyscStanPowrotu();

    const brakujace: Record<string, string | null> = {};
    if (!searchParamsRef.current.get('zakladka')) brakujace.zakladka = stan.zakladka;
    if (!searchParamsRef.current.get('widok-planu')) brakujace['widok-planu'] = stan.widokPlanu;
    if (!searchParamsRef.current.get('krok') && stan.krok) brakujace.krok = stan.krok;
    if (Object.keys(brakujace).length) setParam(brakujace);

    /*
     * ★ ZMIERZONE, nie założone: JEDNO ustawienie `scrollTop` w `requestAnimationFrame`
     * NIE wystarcza. Przy powrocie zapisane 237 px lądowało jako 213 px, bo w tej
     * klatce tabele „Zmierzona wartość" i „Powiązane obiekty" jeszcze się nie
     * rozwinęły — dokument był krótszy, więc przeglądarka PRZYCIĘŁA przewinięcie do
     * ówczesnego maksimum. Dlatego dociągamy pozycję kilka razy w oknie ~0,8 s,
     * dopóki treść nie urośnie. Ręczne przewinięcie użytkownika przerywa dociąganie
     * natychmiast — jego decyzja zawsze wygrywa z odtwarzaniem.
     */
    const znajdzCel = () =>
      stan.kluczFokusu
        ? document.querySelector<HTMLElement>(`[data-cw-focus="${CSS.escape(stan.kluczFokusu)}"]`)
        : null;

    const dociagnijScroll = () => {
      const centrum = kontenerScrolla(znacznikCentrumRef.current);
      if (centrum && Math.abs(centrum.scrollTop - stan.scrollCentrum) > 1) {
        centrum.scrollTop = stan.scrollCentrum;
      }
      const panel = kontenerScrolla(znacznikPanuRef.current);
      if (panel && Math.abs(panel.scrollTop - stan.scrollPanel) > 1) {
        panel.scrollTop = stan.scrollPanel;
      }
      // Łańcuch kontenerów nad elementem fokusu — obie osie, żeby przycisk,
      // z którego wyszliśmy, wrócił na ekran, a nie tylko do drzewa DOM.
      const cel = znajdzCel();
      if (cel) {
        kontenerySkrolla(cel).forEach((el, i) => {
          const zapis = stan.przewinieciaFokusu?.[i];
          if (!zapis) return;
          if (Math.abs(el.scrollTop - zapis.top) > 1) el.scrollTop = zapis.top;
          if (Math.abs(el.scrollLeft - zapis.left) > 1) el.scrollLeft = zapis.left;
        });
      }
    };
    let recznePrzewiniecie = false;
    const naKolku = () => {
      recznePrzewiniecie = true;
    };
    window.addEventListener('wheel', naKolku, { passive: true, once: true });
    window.addEventListener('touchmove', naKolku, { passive: true, once: true });
    const budziki = [120, 320, 640].map((ms) =>
      window.setTimeout(() => {
        if (!recznePrzewiniecie) dociagnijScroll();
      }, ms)
    );

    const klatka = window.requestAnimationFrame(() => {
      dociagnijScroll();

      const cel = znajdzCel();
      if (cel) {
        /*
         * `preventScroll` jest KONIECZNE, nie kosmetyczne. ★ ZMIERZONE: z domyślnym
         * `focus()` + `scrollIntoView` przeglądarka dosuwała przycisk „Otwórz" do
         * widoku, przewijając tabelę TAKŻE W POZIOMIE — po powrocie pierwsza
         * kolumna („Obiekt") była poza kadrem, a pionowe przewinięcie zmieniało
         * się z odtworzonych 237 px na 213 px. Skoro pozycję przewijania już
         * odtworzyliśmy dokładnie, przeglądarka nie ma czego poprawiać.
         */
        cel.focus({ preventScroll: true });
        /*
         * Obrys rysujemy RĘCZNIE, bo `focus-visible` NIE zapala się przy fokusie
         * nadanym programowo (przeglądarka wie, że użytkownik nie użył
         * klawiatury). Bez tego „przywróciliśmy fokus" byłoby prawdą wyłącznie
         * dla czytnika ekranu, a wzrokowo — niewidoczne. Ton to `--c-focus`
         * (niebieski), nigdy crimson. Obrys znika, gdy użytkownik pójdzie dalej.
         */
        cel.style.outline = '2px solid var(--c-focus)';
        cel.style.outlineOffset = '2px';
        cel.addEventListener(
          'blur',
          () => {
            cel.style.outline = '';
            cel.style.outlineOffset = '';
          },
          { once: true }
        );
        setKomunikat(`Wróciłeś do zlecenia — kursor stoi przy: ${stan.etykieta}.`);
      } else {
        kotwicaSekcjiRef.current?.focus();
        setKomunikat(
          `Wróciłeś do zlecenia. Element „${stan.etykieta}" jest w zwiniętej sekcji prawego ` +
            `panelu — kursor stoi na nagłówku sekcji.`
        );
      }
    });
    return () => {
      window.cancelAnimationFrame(klatka);
      budziki.forEach((id) => window.clearTimeout(id));
      window.removeEventListener('wheel', naKolku);
      window.removeEventListener('touchmove', naKolku);
    };
  }, [bundle, loading, setParam, stanPowrotu]);

  // ── Rezultat do otwarcia przyciskiem głównym Menu 1 ───────────────────────
  const rezultatDoOtwarcia = useMemo(() => {
    const linki = bundle?.artifactLinks ?? [];
    for (const relacja of PIERWSZENSTWO_REZULTATU) {
      const kandydat = linki
        .filter((link) => link.relation === relacja)
        .map((link) => ({ link, otwarcie: rozstrzygnijOtwarcieZWeryfikacja(link) }))
        .find((wpis) => wpis.otwarcie.status === 'otwieralny');
      if (kandydat) return kandydat;
    }
    return null;
  }, [bundle, rozstrzygnijOtwarcieZWeryfikacja]);

  // ── Sekcje lewej kolumny = KANONICZNA nawigacja powłoki ───────────────────
  const aktywnaSekcja = TABS.find((item) => item.id === tab) ?? TABS[0];

  const trescSekcji = (id: Tab): React.ReactNode => {
    if (loading || failure || !bundle) {
      return (
        <div className="rounded-xl border border-c-border bg-c-surface">
          <CaseStateBlock
            loading={loading}
            failure={failure}
            onRetry={() => void load()}
            onBack={goToList}
          />
        </div>
      );
    }
    if (id === 'plan') {
      return (
        <PlanView
          caseItem={bundle.caseItem}
          planVersion={currentPlanVersion}
          graph={bundle.graph}
          validation={bundle.validation}
          projection={projection}
          selectedNodeId={selectedNodeId}
          onSelectNode={(nodeId) => setParam({ krok: nodeId })}
        />
      );
    }
    if (id === 'realizacja') {
      return (
        <RealizacjaView
          caseItem={bundle.caseItem}
          waits={bundle.waits}
          proposals={bundle.proposals}
          /*
           * ★ CELOWO PUSTA TABLICA (2026-08-10), nie przeoczenie.
           * `RealizacjaView.tsx:656-676` („Przebieg zlecenia") jest DRUGĄ,
           * ROZBIEŻNĄ reprezentacją tych samych zdarzeń, które prawy panel
           * „Historia" pokazuje w tej samej chwili (patrz `zdarzeniaHistorii`
           * niżej) — surowe `event.summary` (bywa po angielsku, patrz
           * komentarz przy `opisZdarzenia`) i surowy `event.eventType` w
           * widoku eksperckim, bez przejścia przez `opisZdarzenia`/etykiety
           * PL. Dwie różne wersje tego samego faktu na jednym ekranie łamią
           * kanon SPEC-A („archetyp zmienia TYLKO centrum" — Historia żyje w
           * powłoce, nie w treści zakładki) i wprost `enumLabels.ts:161-164`
           * („surowy identyfikator wolno pokazać WYŁĄCZNIE w widoku
           * eksperckim, OBOK polskiego wyjaśnienia — nigdy zamiast"), bo ta
           * druga wersja pokazywała `eventType` SAMO, bez tłumaczenia.
           * `RealizacjaView` nie jest w tym pakiecie do edycji (allowlist tej
           * naprawy: `CaseDetailScreen.tsx`/`RezultatyView.tsx`/
           * `enumLabels.ts`) — jego sekcja jest już gated na `history.length`,
           * więc pusta tablica ją cicho wyłącza, zamiast wymuszać drugi,
           * gorszy render tych samych faktów. Jedna kanoniczna reprezentacja
           * zostaje: prawy panel „Historia", po polsku, przez
           * `opisZdarzenia`.
           */
          history={[]}
          expert={projection === 'ekspercki'}
        />
      );
    }
    return (
      <RezultatyView
        caseItem={bundle.caseItem}
        measurements={bundle.measurements}
        artifactLinks={bundle.artifactLinks}
        expert={projection === 'ekspercki'}
        onOpenDeliverable={otworzObiekt}
        wybor={wyborRezultatow}
        onWybor={setWyborRezultatow}
      />
    );
  };

  const opakujSekcje = (item: (typeof TABS)[number]): React.ReactNode => (
    <div className="min-w-0">
      {/* Znacznik do namierzenia kontenera przewijania centrum (patrz `kontenerScrolla`). */}
      <span ref={item.id === tab ? znacznikCentrumRef : null} aria-hidden className="sr-only" />
      <h2
        ref={item.id === tab ? kotwicaSekcjiRef : null}
        tabIndex={-1}
        className="mb-1 text-base font-semibold text-c-text outline-none"
      >
        {item.label}
      </h2>
      <p className="mb-3 text-sm text-c-text-secondary">{item.description}</p>
      <p aria-live="polite" role="status" className="sr-only">
        {komunikat ?? ''}
      </p>
      {bundle ? (
        <PartialBanner sections={bundle.failedSections} onRetry={() => void load()} />
      ) : null}
      {trescSekcji(item.id)}
    </div>
  );

  const sekcje: StandardSekcjaDef[] = TABS.map((item) => ({
    id: item.id,
    icon: item.icon,
    label: { en: item.label, pl: item.label },
    component: opakujSekcje(item),
    aiContract: {
      none: true,
      reason:
        'Treść tej sekcji pochodzi w całości z silnika zleceń (plan, przebieg, ' +
        'pomiary wartości) — model językowy jej nie pisze i nie ma tu czego regenerować.',
    },
  }));

  // ── Prawy panel (SPEC-A §11.2) ────────────────────────────────────────────
  const wierszeWlasciwosci = bundle
    ? [
        {
          id: 'status',
          label: 'Stan zlecenia',
          value: (
            <StatusTag tone="info">{caseStatusLabel(bundle.caseItem.caseStatus, true)}</StatusTag>
          ),
        },
        {
          id: 'profil',
          label: 'Profil',
          value: caseProfileLabel(bundle.caseItem.caseProfile, true),
        },
        {
          id: 'nadzor',
          label: 'Tryb nadzoru',
          value: governanceTierLabel(bundle.caseItem.governanceTier, true),
        },
        {
          id: 'samodzielnosc',
          label: 'Samodzielność',
          value: autonomyPolicyLabel(bundle.caseItem.autonomyPolicy, true),
        },
        {
          id: 'plan',
          label: 'Plan',
          value: currentPlanVersion
            ? `nr ${currentPlanVersion.planNumber} · ${planVersionStatusLabel(currentPlanVersion.status, true)}`
            : 'brak wersji planu',
        },
        {
          id: 'zalozone',
          label: 'Założone',
          value: formatDate(bundle.caseItem.createdAt),
          mono: true,
        },
        {
          id: 'zmienione',
          label: 'Ostatnia zmiana',
          value: formatDateTime(bundle.caseItem.updatedAt),
          mono: true,
        },
        {
          id: 'zamkniete',
          label: 'Zamknięte',
          value: bundle.caseItem.closedAt ? formatDateTime(bundle.caseItem.closedAt) : 'nie',
          mono: true,
        },
      ]
    : [];

  const linkiPanelu = (bundle?.artifactLinks ?? []).map((link) => ({
    link,
    otwarcie: rozstrzygnijOtwarcieZWeryfikacja(link),
  }));

  const zrodla = bundle
    ? [
        { id: 'kryteria', label: 'Kryteria odbioru', value: bundle.caseItem.acceptanceCriteriaRef },
        { id: 'budzet', label: 'Polityka budżetu', value: bundle.caseItem.budgetPolicyRef },
        {
          id: 'autonomia',
          label: 'Polityka samodzielności',
          value: bundle.caseItem.autonomyPolicyRef,
        },
        { id: 'dowod', label: 'Dowód zamknięcia', value: bundle.caseItem.closureEvidenceRef },
      ].filter((wpis) => Boolean(wpis.value))
    : [];

  const brakDostepuDoPowiazan = Boolean(
    bundle?.blocked && bundle.failedSections.includes('powiązane obiekty')
  );

  /*
   * Historia panelu = zdarzenia REALNE (`opisZdarzenia`, po polsku) +
   * SYNTETYCZNE fakty cyklu życia, których backend dziś nie zapisuje jako
   * zdarzenia (patrz `syntetyczneZdarzeniaCyklu` wyżej). Scalone i posortowane
   * chronologicznie w tej samej kolejności co realne zdarzenia z API
   * (`ORDER BY global_seq ASC`, `caseHistoryService.ts:766` — najstarsze
   * pierwsze), żeby data synteatyczna nie „wskakiwała" na koniec/początek
   * niezależnie od tego, kiedy naprawdę nastąpiła.
   */
  const zdarzeniaHistorii = useMemo(() => {
    if (!bundle) return [];
    const realne = bundle.history.map((event) => ({
      id: event.eventId,
      description: opisZdarzenia(event),
      timestamp: event.occurredAt,
      userName: event.actorId,
    }));
    const syntetyczne = syntetyczneZdarzeniaCyklu(bundle.caseItem, bundle.history);
    return [...realne, ...syntetyczne].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }, [bundle]);

  /*
   * "Zatwierdź i rozpocznij" pokazuje się TYLKO dla zleceń LIGHT, które
   * jeszcze nie mają opublikowanego planu (co w tym module znaczy: jeszcze
   * nie uruchomiono dla nich Runu — patrz `lightOneClickService.ts`, LIGHT ma
   * pułap dokładnie jednego Runu). Zamknięte/nieudane/anulowane zlecenia nie
   * dostają przycisku — backend i tak by odmówił (`light_one_click_case_not_
   * ready`), więc nie pokazujemy klikalnego przycisku, który zawsze odmawia.
   */
  const maPublikowanyPlanLight = (bundle?.planVersions ?? []).some((v) => v.status === 'PUBLISHED');
  const stanZleceniaStartowalnyLight =
    bundle?.caseItem.caseStatus === 'DRAFT' || bundle?.caseItem.caseStatus === 'ACTIVE';
  const pokazZatwierdzIRozpocznij =
    Boolean(bundle) &&
    bundle!.caseItem.caseProfile === 'LIGHT' &&
    stanZleceniaStartowalnyLight &&
    !maPublikowanyPlanLight;

  const prawyPanel = {
    actions: {
      label: 'Akcje',
      icon: ClipboardList,
      children: (
        <div>
          <span ref={znacznikPanuRef} aria-hidden className="sr-only" />
          <PreviewActionBar
            rows={[
              ...(pokazZatwierdzIRozpocznij
                ? [
                    {
                      buttons: [
                        {
                          label:
                            lightStart.status === 'pending'
                              ? 'Uruchamianie…'
                              : 'Zatwierdź i rozpocznij',
                          icon: CheckCircle2,
                          colorScheme: 'primary' as const,
                          flex: true,
                          disabled: lightStart.status === 'pending',
                          onClick: () => void handleLightStart(),
                        },
                      ],
                    },
                  ]
                : []),
              {
                buttons: [
                  {
                    label: 'Wczytaj ponownie',
                    icon: RefreshCw,
                    colorScheme: 'neutral',
                    flex: true,
                    onClick: () => void load(),
                  },
                  {
                    label: 'Wróć do listy zleceń',
                    icon: ListChecks,
                    colorScheme: 'neutral',
                    flex: true,
                    onClick: goToList,
                  },
                ],
              },
            ]}
          />
          {lightStart.status === 'refused' ? (
            <div className="mt-2 rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-2 text-xs text-c-text-secondary">
              <span className="font-medium text-c-text">Zlecenie LIGHT nie zostało uruchomione.</span>{' '}
              {lightStart.reasonDetail}
            </div>
          ) : null}
          {lightStart.status === 'error' ? (
            <div className="mt-2 rounded-lg border border-danger-300/40 bg-danger-50 px-3 py-2 text-xs text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-200">
              {lightStart.message}
              {lightStart.refreshSuggested ? ' Odśwież dane i spróbuj ponownie.' : ''}
            </div>
          ) : null}
        </div>
      ),
      actionIds: pokazZatwierdzIRozpocznij
        ? ['zatwierdz-i-rozpocznij', 'wczytaj-ponownie', 'wroc-do-listy']
        : ['wczytaj-ponownie', 'wroc-do-listy'],
    },
    properties: {
      label: 'Właściwości',
      children: wierszeWlasciwosci.length ? (
        <ArtifactPropertiesTable
          rows={wierszeWlasciwosci}
          propertyLabel="Właściwość"
          valueLabel="Wartość"
        />
      ) : null,
      isEmpty: !wierszeWlasciwosci.length,
      emptyLabel: 'Dane zlecenia nie zostały jeszcze wczytane.',
    },
    relations: {
      label: 'Powiązania',
      icon: Link2,
      badge: linkiPanelu.length,
      children: brakDostepuDoPowiazan ? (
        <div className="flex items-start gap-2 rounded-lg border border-c-border bg-c-surface-raised px-3 py-2">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-c-text-muted" aria-hidden />
          <p className="min-w-0 text-xs text-c-text-secondary">
            Nie masz uprawnień do listy obiektów powiązanych z tym zleceniem. Reszta zlecenia jest
            widoczna — poproś właściciela zlecenia o dostęp.
          </p>
        </div>
      ) : (
        <ul className="space-y-1.5">
          {linkiPanelu.map(({ link, otwarcie }) => {
            const otwieralny = otwarcie.status === 'otwieralny';
            // Nagłówek pozycji to zawsze RODZAJ obiektu (Dokument/Prezentacja/
            // Arkusz), a nie jego rola — inaczej pozycja niedostępna pokazywała
            // „Dowód / Dowód", czyli tę samą informację dwa razy.
            const etykietaTypu = linkedTypeLabel(link.artifactType, true) || link.artifactType;
            return (
              <li key={link.linkId}>
                <button
                  type="button"
                  data-cw-focus={kluczFokusuObiektu(link.linkId)}
                  disabled={!otwieralny}
                  title={otwieralny ? `Otwórz: ${otwarcie.etykieta}` : otwarcie.powod}
                  onClick={() =>
                    otwieralny
                      ? otworzObiekt({
                          sciezka: otwarcie.sciezka,
                          kluczFokusu: kluczFokusuObiektu(link.linkId),
                          etykieta: otwarcie.etykieta,
                        })
                      : undefined
                  }
                  className={`flex w-full items-start gap-2 rounded-lg border border-c-border-subtle px-2.5 py-2 text-left transition ${FOCUS_RING} ${
                    otwieralny
                      ? 'text-c-text hover:bg-c-surface-raised'
                      : 'cursor-not-allowed text-c-text-muted'
                  }`}
                >
                  {otwieralny ? (
                    <ArrowUpRight size={14} className="mt-0.5 shrink-0" aria-hidden />
                  ) : (
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{etykietaTypu}</span>
                    <span className="block truncate text-[11px] text-c-text-muted">
                      {artifactLinkRelationLabel(link.relation, true)}
                      {link.isStale ? ' · nieaktualny' : ''}
                    </span>
                    {!otwieralny ? (
                      // Pełny powód siedzi w `title`; tu dwie linijki, żeby panel
                      // pozostał panelem, a nie ścianą tekstu (doktryna gęstości).
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-c-text-secondary">
                        {otwarcie.powod}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ),
      isEmpty: !brakDostepuDoPowiazan && linkiPanelu.length === 0,
      emptyLabel:
        'Nic jeszcze nie powiązano. Tu trafiają dokumenty, decyzje i dowody tego zlecenia.',
    },
    evidence: {
      label: 'Źródła i założenia',
      icon: ScrollText,
      children: (
        <dl className="space-y-2">
          {zrodla.map((wpis) => (
            <div key={wpis.id}>
              <dt className="text-[11px] uppercase tracking-wide text-c-text-muted">
                {wpis.label}
              </dt>
              <dd className="text-xs text-c-text">
                <TechnicalId value={wpis.value} title={wpis.label} />
              </dd>
            </div>
          ))}
        </dl>
      ),
      isEmpty: zrodla.length === 0,
      emptyLabel:
        'Zlecenie nie wskazuje jeszcze kryteriów odbioru ani polityk, na których się opiera.',
    },
    comments: {
      pominieta: true as const,
      reason:
        'Backend zleceń nie ma dziś wątku komentarzy (brak serwisu i tabeli — ' +
        'w katalogu caseWorkspace nie istnieje żaden serwis komentarzy). Pusty akordeon ' +
        'udawałby funkcję, której nie ma; rozmowa o zleceniu toczy się w module, ' +
        'do którego należy dany obiekt.',
    },
    history: {
      label: 'Historia',
      children: <PreviewActivityStrip events={zdarzeniaHistorii} initialCount={5} />,
      isEmpty: zdarzeniaHistorii.length === 0,
      emptyLabel: 'Przebieg zlecenia jest jeszcze pusty — nic się na nim nie wydarzyło.',
    },
  };

  // ── Menu 3 (view-local): projekcja planu ──────────────────────────────────
  const przelacznikProjekcji = (
    <div
      role="radiogroup"
      aria-label="Sposób pokazania zlecenia"
      className="flex flex-wrap items-center gap-1 rounded-full border border-c-border p-0.5"
    >
      {PLAN_PROJECTIONS.map((item) => {
        const active = item.id === projection;
        return (
          <button
            key={item.id}
            type="button"
            role="radio"
            aria-checked={active}
            title={item.description}
            onClick={() => setParam({ 'widok-planu': item.id })}
            className={`h-7 whitespace-nowrap rounded-full px-3 text-xs font-medium transition ${FOCUS_RING} ${
              active
                ? 'bg-c-surface-raised text-c-text'
                : 'text-c-text-secondary hover:bg-c-surface-raised'
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );

  /*
   * Tytuł zlecenia — ta sama kolejność źródeł, co na liście
   * (`nazwaZlecenia`): cel z intake → nazwa projektu → uczciwy skrót sprawy.
   * Wcześniej stało tu `projectName || 'Zlecenie'`, więc każde zlecenie bez
   * projektu nazywało się dokładnie tak samo.
   */
  const tytul = bundle
    ? nazwaZlecenia(bundle.caseItem, {
        goal: bundle.intake?.goal ?? null,
        expectedOutcome: bundle.intake?.expectedOutcome ?? null,
        projectName: bundle.caseItem.projectName,
        projectDescription: bundle.caseItem.projectDescription,
      })
    : 'Zlecenie';
  const stanZlecenia = bundle?.caseItem.caseStatus;
  const tonStatusu: 'draft' | 'review' | 'approved' | 'rejected' | 'neutral' =
    stanZlecenia === 'BLOCKED' || stanZlecenia === 'FAILED'
      ? 'rejected'
      : stanZlecenia === 'ACTIVE'
        ? 'approved'
        : stanZlecenia === 'CLOSED'
          ? 'review'
          : 'draft';

  return (
    <div className="h-full min-w-0" data-testid="zlecenie-szczegol">
      <StandardArtifactShell
        /*
         * ★ UCZCIWIE: `registry.ts` (SSOT kart N) zna dziś siedem kluczy i nie
         * ma wśród nich zlecenia; dopisanie ósmego to zmiana rejestru, nie tego
         * ekranu. Klucz jest więc rzutowany — powłoka używa go WYŁĄCZNIE do
         * treści ostrzeżeń dev i do reguły warstwy dowodowej dla kart pisanych
         * przez AI (`StandardArtifactShell.tsx:192`), więc rzutowanie nie
         * wyłącza żadnej bramki obowiązującej ten ekran.
         */
        karta={'zlecenie' as KartaNKey}
        klasa="L"
        header={{
          title: tytul,
          onTitleChange: () => undefined,
          titleReadOnly: true,
          artifactType: 'project',
          artifactId: caseId,
          onSave: () => undefined,
          saveState: 'saved',
          lastSavedLabel: bundle
            ? `Dane odczytane z serwera · ostatnia zmiana zlecenia ${formatDateTime(bundle.caseItem.updatedAt)}`
            : undefined,
          onClose: goToList,
          statusLabel: stanZlecenia ? caseStatusLabel(stanZlecenia, true) : undefined,
          statusTone: tonStatusu,
        }}
        primaryAction={
          rezultatDoOtwarcia
            ? {
                id: 'otworz-rezultat',
                /*
                 * ★ ZOBACZONE NA ZRZUCIE 1440 px: przycisk pisał „Open result"
                 * w skądinąd polskim ekranie. Powód NIE jest w tym pliku:
                 * `NModeHeader` wybiera wariant po `i18n.language`
                 * (`NModeHeader.tsx:252,492`), a konto testowe miało język EN.
                 * Ten moduł nie ma i nie planuje angielskiej wersji tekstów —
                 * wszystkie pozostałe napisy ekranu są zaszyte po polsku —
                 * więc oba warianty niosą TĘ SAMĄ polską treść. To usuwa
                 * mieszankę językową w jednym pasku; pełne i18n modułu to
                 * osobna praca (klucze tłumaczeń, poza tą zmianą).
                 */
                label: { en: 'Otwórz rezultat', pl: 'Otwórz rezultat' },
                icon: ArrowUpRight,
                onClick: () =>
                  otworzObiekt({
                    sciezka:
                      rezultatDoOtwarcia.otwarcie.status === 'otwieralny'
                        ? rezultatDoOtwarcia.otwarcie.sciezka
                        : '',
                    kluczFokusu: kluczFokusuObiektu(rezultatDoOtwarcia.link.linkId),
                    etykieta:
                      rezultatDoOtwarcia.otwarcie.status === 'otwieralny'
                        ? rezultatDoOtwarcia.otwarcie.etykieta
                        : '',
                  }),
                title: {
                  en: 'Otwórz najważniejszy rezultat tego zlecenia w jego module',
                  pl: 'Otwórz najważniejszy rezultat tego zlecenia w jego module',
                },
              }
            : {
                /*
                 * ★ ZOBACZONE NA ZRZUCIE, nie wydedukowane: wersja z
                 * `disabled: true` wyglądała DOKŁADNIE tak samo jak aktywna —
                 * `MENU_1_PRIMARY_CTA` (`ModuleMenu3.tsx:15`) nie ma ŻADNEGO
                 * wariantu `disabled:`, więc powłoka rysuje pełny, biały przycisk
                 * niezależnie od stanu. Wyłączony przycisk wyglądający na
                 * klikalny to atrapa, więc gdy nie ma czego otworzyć, primary po
                 * prostu nie powstaje — zgodnie ze SPEC-N §2.3 brak jest JAWNY
                 * i uzasadniony, a nie przemilczany.
                 */
                intentionallyNone: true,
                reason:
                  'To zlecenie nie ma jeszcze ANI JEDNEGO powiązanego obiektu, który dałoby ' +
                  'się otworzyć (albo wszystkie są niedostępne/odpięte). Wyłączony przycisk ' +
                  'byłby atrapą: powłoka rysuje go identycznie jak aktywny.',
              }
        }
        sections={sekcje}
        rightPanel={prawyPanel}
        activeSection={tab}
        onSectionChange={(id) => setParam({ zakladka: id })}
        densityMode={gestosc}
        onDensityModeChange={setGestosc}
        toolbar={
          <NModeToolbar
            isPolish
            activeSectionLabel={aktywnaSekcja.label}
            sectionsDropdown={przelacznikProjekcji}
            visibleActionCount={PLAN_PROJECTIONS.length}
          />
        }
        panelAriaLabel="Szczegóły zlecenia"
        loading={false}
      />
    </div>
  );
};

export default CaseDetailScreen;
