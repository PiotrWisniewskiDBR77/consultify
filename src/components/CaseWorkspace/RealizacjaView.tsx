/**
 * Zlecenie → zakładka REALIZACJA.
 *
 * Odpowiada na jedno pytanie: co się teraz dzieje i na co czekamy. Dwie listy
 * (oczekiwania i sprawy do zatwierdzenia) idą przez `StandardTable`; szczegóły
 * przez `StandardPreview`, ZAMKNIĘTY domyślnie (warunek właściciela #6) —
 * otwiera się dopiero po kliknięciu wiersza.
 *
 * „W toku" nie jest używane dla kroku, który w rzeczywistości CZEKA
 * (`02_INFORMATION_ARCHITECTURE_AND_UX.md` §6.5) — stan oczekiwania nazywamy
 * po imieniu: na kogo/na co czekamy i od kiedy.
 */

import { Ban, CheckCircle2, Clock, Inbox, Pause, Play, RotateCcw, Route as RunIcon, XCircle } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { StandardPreview, type StandardPreviewAction } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  caseStatusLabel,
  caseWaitStatusLabel,
  caseWaitTypeLabel,
  effectClassLabel,
  proposalStatusLabel,
  runOutcomeStatusLabel,
  runStatusLabel,
} from '@/utils/enumLabels';

import {
  approveProposal,
  cancelRun,
  cancelWait,
  deferProposal,
  newIdempotencyKey,
  pauseRun,
  provideHumanInput,
  provideNodeInput,
  rejectProposal,
  requestChangesOnProposal,
  resumeRun,
  startRun,
} from './api';
import { listNodeResultAcceptancesForCase } from './apiResults';
import type { CaseActionProposal, CaseCoreView, CaseHistoryEvent, CaseRun, CaseWait } from './types';
import {
  CommandBanner,
  type CommandNotice,
  CommandDialog,
  formatDateTime,
  relativeDays,
  StatusTag,
  TechnicalId,
} from './ui';

/**
 * Zliczenie wyników wykonania kroków, do JEDNEGO zdania w karcie „Co się
 * teraz dzieje".
 *
 * ★ DLACZEGO TU TYLKO LICZNIK, nie cała tabela. Pełna, klikalna projekcja
 * wyników kroku (status akceptacji, źródłowy Run/NodeRun, dowód, otwarcie
 * obiektu w jego module) jest w zakładce Rezultaty — TAM biegnie mechanizm
 * powrotu (`onOpenDeliverable`/zapamiętane przewinięcie i fokus), którego ten
 * plik nie dostaje z powłoki. Duplikowanie tej samej tabeli tutaj bez
 * możliwości jej otwarcia byłoby atrapą interakcji, a nie funkcją — i
 * łamałoby doktrynę gęstości (ta sama treść w dwóch zakładkach). Realizacja
 * i tak MUSI umieć honest powiedzieć „częściowo zakończone" (kanon:
 * `04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:276`, wiersz Realizacji) —
 * dlatego czyta te same dane, tylko jako policzone podsumowanie.
 */
interface WynikiKrokowLiczby {
  accepted: number;
  partial: number;
  rejected: number;
}

function useWynikiKrokowLiczby(caseId: string): WynikiKrokowLiczby | null {
  const [liczby, setLiczby] = useState<WynikiKrokowLiczby | null>(null);
  useEffect(() => {
    let anulowano = false;
    listNodeResultAcceptancesForCase(caseId)
      .then((items) => {
        if (anulowano) return;
        const policzone = items.reduce<WynikiKrokowLiczby>(
          (acc, item) => {
            if (item.resultAcceptance === 'ACCEPTED') acc.accepted += 1;
            else if (item.resultAcceptance === 'PARTIAL') acc.partial += 1;
            else if (item.resultAcceptance === 'REJECTED') acc.rejected += 1;
            return acc;
          },
          { accepted: 0, partial: 0, rejected: 0 }
        );
        setLiczby(policzone);
      })
      .catch(() => {
        // Zdanie po prostu tego nie wspomni — to podsumowanie DODATKOWE, a
        // pełny, uczciwy stan błędu (z przyciskiem „Spróbuj ponownie") ma
        // sekcja „Wyniki wykonania kroków" w zakładce Rezultaty.
        if (!anulowano) setLiczby(null);
      });
    return () => {
      anulowano = true;
    };
  }, [caseId]);
  return liczby;
}

export interface RealizacjaViewProps {
  caseItem: CaseCoreView;
  waits: CaseWait[];
  proposals: CaseActionProposal[];
  /** Przebiegi (Run) tego zlecenia — `listRunsForCase`, patrz `api.ts` §„PRZEBIEGI". */
  runs: CaseRun[];
  history: CaseHistoryEvent[];
  /** Widok ekspercki = wolno pokazać identyfikatory techniczne obok polskiego opisu. */
  expert?: boolean;
  /**
   * Po KAŻDEJ udanej komendzie mutującej (decyzja o sprawie, oczekiwanie,
   * przebieg) rodzic wczytuje CAŁĄ paczkę zlecenia ponownie z serwera —
   * to samo `load()`, którego używa Menu 1 „Wczytaj ponownie". Jeden powód:
   * `cancelRun` kaskadowo anuluje też oczekiwania i propozycje tego Runu, więc
   * lokalna, częściowa aktualizacja jednej listy zostawiłaby pozostałe
   * nieaktualne. Pełny odczyt jest tu AUTORYTATYWNYM potwierdzeniem stanu,
   * zgodnie z regułą „authoritative readback" z `api.ts`.
   */
  onReload: () => void;
}

type Selection =
  | { kind: 'oczekiwanie'; id: string }
  | { kind: 'propozycja'; id: string }
  | { kind: 'przebieg'; id: string }
  | null;

/**
 * Komendy mutujące tej zakładki — JEDNO miejsce, w którym żyje `pending`
 * (co czeka na potwierdzenie w `CommandDialog`), `busy` (trwa wysyłka) i
 * `notice` (wynik ostatniej komendy, `CommandBanner`). Ten sam wzorzec co
 * `CasesListScreen.tsx` (start/wstrzymaj/wznów/anuluj zlecenia) — tu
 * rozszerzony o decyzje w sprawach, oczekiwania i przebiegi.
 */
type PendingCommand =
  | { kind: 'proposal-decision'; decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DEFER'; proposal: CaseActionProposal }
  | { kind: 'wait-provide-input'; wait: CaseWait }
  | { kind: 'wait-cancel'; wait: CaseWait }
  | { kind: 'run-pause'; run: CaseRun }
  | { kind: 'run-resume'; run: CaseRun }
  | { kind: 'run-cancel'; run: CaseRun }
  | { kind: 'run-start'; run: CaseRun };

/**
 * Szerokość REALNIE dostępna dla tabeli — mierzona na jej własnym kontenerze,
 * nie na oknie.
 *
 * ★ DLACZEGO NIE `useViewportWidth()` (jak na liście zleceń i w „Planie →
 * Lista"). ZMIERZONE NA ŻYWYM EKRANIE, nie wydedukowane: przy TYM SAMYM oknie
 * 1024 px kontener tabeli ma
 *
 *     916 px  gdy podgląd jest zamknięty,
 *     520 px  gdy użytkownik kliknął wiersz i otworzył prawy panel
 *             (`lg:w-[380px]`, patrz układ na dole tego pliku).
 *
 * Czyli jedna szerokość okna daje DWIE różne szerokości tabeli. Próg liczony z
 * `window.innerWidth` musiałby zgadnąć, którą — i przy otwartym podglądzie
 * zawsze zgadywałby źle (zmierzone: 460 px ukrytego przewijania przy oknie
 * 1024 px z otwartym podglądem, mimo że okno „jest desktopowe"). Na tych
 * dwóch tabelach panel jest częścią tego samego rzędu flex, więc źródłem
 * prawdy jest kontener.
 *
 * Zwraca szerokość WNĘTRZA (bez paddingu karty), bo to ona ogranicza tabelę.
 */
function useAvailableWidth(ref: React.RefObject<HTMLElement | null>): number | null {
  const [width, setWidth] = useState<number | null>(null);

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    const style = window.getComputedStyle(node);
    const padding = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0');
    setWidth(Math.max(0, Math.round(node.clientWidth - padding)));
  }, [ref]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return undefined;
    measure();
    const node = ref.current;
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => measure()) : null;
    if (node) observer?.observe(node);
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [measure, ref]);

  return width;
}

/**
 * Trzy zestawy kolumn, wybierane szerokością kontenera.
 *
 * Progi NIE są okrągłe „dla ładności" — biorą się z sumy szerokości kolumn,
 * które zestaw deklaruje (oczekiwania 250+150+150+150 = 700 px, propozycje
 * 260+180+140+150 = 730 px). Zestaw pełny wolno pokazać dopiero wtedy, gdy
 * mieści się BEZ przewijania; poniżej tego moduł deklaruje węższy zestaw,
 * zamiast ściskać cztery kolumny do ~60 px (to był jawny warunek właściciela:
 * MOBILNE ZESTAWY KOLUMN, nie ściśnięta tabela desktopowa).
 */
type ColumnTier = 'pelny' | 'sredni' | 'waski';

function tierFor(available: number | null, fullWidth: number): ColumnTier {
  // Pierwszy render (przed pomiarem) celowo zakłada zestaw wąski: lepiej
  // pokazać komplet treści w jednej kolumnie i rozszerzyć po pomiarze, niż
  // mignąć tabelą z ukrytym przewijaniem.
  if (available === null) return 'waski';
  if (available >= fullWidth + 40) return 'pelny';
  if (available >= 460) return 'sredni';
  return 'waski';
}

const WAITS_FULL_WIDTH = 700;
const PROPOSALS_FULL_WIDTH = 730;
const RUNS_FULL_WIDTH = 620;

const RUN_TERMINAL: ReadonlySet<CaseRun['status']> = new Set([
  'COMPLETED',
  'COMPLETED_WITH_WARNINGS',
  'FAILED',
  'CANCELLED',
  'COMPENSATED',
]);

function runTone(run: CaseRun): 'critical' | 'warning' | 'success' | 'neutral' {
  if (run.status === 'FAILED') return 'critical';
  if (run.status === 'BLOCKED' || run.status === 'PAUSED' || run.status === 'RETRY_SCHEDULED') {
    return 'warning';
  }
  if (run.status === 'COMPLETED' || run.status === 'COMPLETED_WITH_WARNINGS') return 'success';
  if (run.status === 'CANCELLED') return 'neutral';
  return 'neutral';
}

function waitTone(wait: CaseWait): 'critical' | 'warning' | 'success' | 'neutral' {
  if (wait.status === 'EXPIRED') return 'critical';
  if (wait.status === 'ACTIVE') {
    const deadline = wait.timeoutAt || wait.dueAt;
    if (deadline && new Date(deadline).getTime() < Date.now()) return 'critical';
    return 'warning';
  }
  if (wait.status === 'SATISFIED') return 'success';
  return 'neutral';
}

function proposalTone(
  status: CaseActionProposal['status']
): 'critical' | 'warning' | 'success' | 'neutral' {
  if (status === 'FAILED' || status === 'REJECTED') return 'critical';
  if (status === 'PENDING_REVIEW' || status === 'REQUESTED_CHANGES') return 'warning';
  if (status === 'EXECUTED' || status === 'AUDITED') return 'success';
  return 'neutral';
}

export const RealizacjaView: React.FC<RealizacjaViewProps> = ({
  caseItem,
  waits,
  proposals,
  runs,
  history,
  expert,
  onReload,
}) => {
  const [selection, setSelection] = useState<Selection>(null);
  const wynikiKrokow = useWynikiKrokowLiczby(caseItem.caseId);

  // Karty trzech tabel mierzą się SAME — patrz `useAvailableWidth`. Osobne
  // pomiary, bo każda karta może kiedyś stanąć w innej kolumnie układu.
  const waitsCardRef = useRef<HTMLDivElement | null>(null);
  const proposalsCardRef = useRef<HTMLDivElement | null>(null);
  const runsCardRef = useRef<HTMLDivElement | null>(null);
  const waitsAvailableWidth = useAvailableWidth(waitsCardRef);
  const proposalsAvailableWidth = useAvailableWidth(proposalsCardRef);
  const runsAvailableWidth = useAvailableWidth(runsCardRef);

  /*
   * ── KOMENDY MUTUJĄCE ────────────────────────────────────────────────────
   * Jeden zestaw stanu dla WSZYSTKICH komend tej zakładki (decyzje w
   * sprawach, oczekiwania, przebiegi) — patrz `PendingCommand` i komentarz
   * przy `onReload` w propsach. Klucz idempotencji żyje na intencję (mapa
   * `intent → key`), nie na pojedyncze żądanie — powtórzenie tej samej
   * intencji (podwójny klik, ponowienie po błędzie sieci) REUŻYWA klucza,
   * inaczej idempotencja niczego by nie chroniła (`api.ts` §1).
   */
  const [pending, setPending] = useState<PendingCommand | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const [notice, setNotice] = useState<CommandNotice | null>(null);
  const intentKeysRef = useRef<Map<string, string>>(new Map());
  const keyForIntent = useCallback((intent: string) => {
    const existing = intentKeysRef.current.get(intent);
    if (existing) return existing;
    const fresh = newIdempotencyKey();
    intentKeysRef.current.set(intent, fresh);
    return fresh;
  }, []);
  // Pole „Podaj dane" w oknie potwierdzenia dla `wait-provide-input` — jedyna
  // komenda tej listy, która potrzebuje WŁASNEGO pola (referencja do danych),
  // nie tylko opcjonalnego powodu, więc `CommandDialog.reason` (jedno pole)
  // jest tu użyte jako pole na `inputRef` z inną etykietą.
  const closeDialog = useCallback(() => setPending(null), []);

  const runPendingCommand = useCallback(
    async (reasonOrInput: string) => {
      if (!pending) return;
      setCommandBusy(true);
      try {
        if (pending.kind === 'proposal-decision') {
          const intent = `proposal:${pending.decision}:${pending.proposal.actionProposalId}`;
          const idempotencyKey = keyForIntent(intent);
          const fn =
            pending.decision === 'APPROVE'
              ? approveProposal
              : pending.decision === 'REJECT'
                ? rejectProposal
                : pending.decision === 'REQUEST_CHANGES'
                  ? requestChangesOnProposal
                  : deferProposal;
          const result = await fn(pending.proposal.actionProposalId, {
            idempotencyKey,
            reason: reasonOrInput || null,
          });
          if (!result.ok) {
            setNotice({
              tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: 'success',
            text:
              result.readback === 'confirmed'
                ? `Decyzja zapisana. Sprawa ma teraz status: ${proposalStatusLabel(result.value.proposal.status, true)}.`
                : 'Decyzja została przyjęta, ale nie udało się jej potwierdzić ponownym odczytem. Odśwież dane.',
          });
          onReload();
          return;
        }

        if (pending.kind === 'wait-provide-input') {
          const intent = `wait-input:${pending.wait.waitId}`;
          const idempotencyKey = keyForIntent(intent);
          const inputRef = reasonOrInput.trim();
          if (!inputRef) {
            setNotice({ tone: 'warning', text: 'Podaj treść danych przed wysłaniem.' });
            return;
          }
          const result = pending.wait.nodeRunId
            ? await provideNodeInput(pending.wait.nodeRunId, inputRef, { idempotencyKey })
            : await provideHumanInput(pending.wait.waitId, inputRef, pending.wait.version, { idempotencyKey });
          if (!result.ok) {
            setNotice({
              tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: 'success',
            text:
              result.readback === 'confirmed'
                ? 'Dane zostały przekazane — czekamy, aż krok ruszy dalej.'
                : 'Dane zostały przyjęte, ale nie udało się potwierdzić stanu ponownym odczytem. Odśwież dane.',
          });
          onReload();
          return;
        }

        if (pending.kind === 'wait-cancel') {
          const intent = `wait-cancel:${pending.wait.waitId}`;
          const idempotencyKey = keyForIntent(intent);
          const reason = reasonOrInput.trim();
          if (!reason) {
            setNotice({ tone: 'warning', text: 'Podaj powód anulowania oczekiwania — jest wymagany.' });
            return;
          }
          const result = await cancelWait(pending.wait.waitId, reason, pending.wait.version, { idempotencyKey });
          if (!result.ok) {
            setNotice({
              tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({ tone: 'success', text: 'Oczekiwanie zostało anulowane.' });
          onReload();
          return;
        }

        // ── Przebiegi (Run) ──────────────────────────────────────────────
        const runIntentPrefix = pending.kind;
        const intent = `${runIntentPrefix}:${pending.run.runId}`;
        const idempotencyKey = keyForIntent(intent);

        if (pending.kind === 'run-start') {
          const result = await startRun(pending.run.runId, { idempotencyKey });
          if (!result.ok) {
            setNotice({
              tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: 'success',
            text:
              result.value.outcome === 'started'
                ? `Przebieg wystartował — utworzono ${result.value.nodeRunIds.length} ${result.value.nodeRunIds.length === 1 ? 'krok wejściowy' : 'kroki wejściowe'}.`
                : 'Przebieg był już wystartowany.',
          });
          onReload();
          return;
        }

        if (pending.kind === 'run-pause') {
          const result = await pauseRun(pending.run.runId, pending.run.version, { idempotencyKey });
          if (!result.ok) {
            setNotice({
              tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({ tone: 'success', text: 'Przebieg został wstrzymany.' });
          onReload();
          return;
        }

        if (pending.kind === 'run-resume') {
          const result = await resumeRun(pending.run.runId, pending.run.version, { idempotencyKey });
          if (!result.ok) {
            setNotice({
              tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({ tone: 'success', text: 'Przebieg został wznowiony.' });
          onReload();
          return;
        }

        // run-cancel — powód jest OPCJONALNY po stronie serwera
        // (`cancelRunBody`: `reason: z.string().trim().min(1).optional()`,
        // `runLifecycle.routes.ts`), więc UI go nie wymusza — inaczej
        // `CommandDialog` (pole opcjonalne) i ta funkcja mówiłyby co innego.
        {
          const reason = reasonOrInput.trim();
          const result = await cancelRun(pending.run.runId, pending.run.version, reason || undefined, {
            idempotencyKey,
          });
          if (!result.ok) {
            setNotice({
              tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({ tone: 'success', text: 'Przebieg został anulowany.' });
          onReload();
        }
      } finally {
        setCommandBusy(false);
        setPending(null);
      }
    },
    [pending, keyForIntent, onReload]
  );

  // Wiersz, na który ma wrócić fokus po zamknięciu podglądu Escape'em.
  // Ref, nie stan: to nie jest treść ekranu, a jego zmiana nie ma prawa
  // wywołać renderu.
  const powrotFokusuRef = useRef<string | null>(null);

  /*
   * Escape zamyka podgląd.
   *
   * ★ ZMIERZONE, nie założone: w przebiegu klawiaturowym podgląd otwierał się
   * kliknięciem, ale Escape go NIE zamykał — jedynym wyjściem był celowany klik
   * w „×". `StandardPreview` nie obsługuje Escape w ogóle (grep po
   * `src/components/standard/StandardPreview.tsx`: zero trafień), więc dotyczy
   * to KAŻDEGO modułu, który go używa — zgłoszone osobno jako luka wspólnego
   * komponentu. Tutaj domykam to po stronie modułu, bo to moduł jest
   * właścicielem stanu wyboru.
   *
   * Po zamknięciu fokus wraca na wiersz, z którego podgląd wyszedł — inaczej
   * użytkownik klawiatury ląduje na początku dokumentu i gubi miejsce w tabeli.
   */
  useEffect(() => {
    if (!selection) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      powrotFokusuRef.current = selection.id;
      setSelection(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection]);

  /*
   * Przywrócenie fokusu PO zamknięciu podglądu — osobny efekt, bo jedna klatka
   * nie wystarcza.
   *
   * ★ ZMIERZONE NA ŻYWYM EKRANIE (okno 1920, podgląd otwarty na pierwszym
   * wierszu, Escape): poprzednia wersja robiła `requestAnimationFrame` zaraz po
   * `setSelection(null)` i fokus NIE wracał — `document.activeElement` lądował
   * na nagłówku sekcji (`H2`), a nie na wierszu. Powód nie jest oczywisty:
   * zamknięcie podglądu ODDAJE tabeli szerokość panelu (`lg:w-[380px]`), więc
   * `useAvailableWidth` przelicza próg i tabela przechodzi na SZERSZY zestaw
   * kolumn. Kotwica `[data-realizacja-wiersz]` żyje w komórce, a komórki
   * zestawu są tworzone OD NOWA — pojedyncza klatka trafiała albo w węzeł
   * jeszcze nieistniejący, albo w taki, który zaraz potem znikał (i fokus
   * spadał na `body`).
   *
   * Dlatego powtarzamy próbę przez kilka klatek: każda klatka szuka AKTUALNEJ
   * kotwiki i ustawia na niej fokus. Ostatnia klatka trafia już w zestaw po
   * przeliczeniu, więc fokus siada tam, gdzie użytkownik był. Powtórne
   * `focus()` na tym samym węźle jest bezkosztowe i niewidoczne.
   */
  useEffect(() => {
    if (selection) return undefined;
    const rowId = powrotFokusuRef.current;
    if (!rowId) return undefined;

    let klatka = 0;
    let uchwyt = 0;
    const KLATKI = 6;
    const sprobuj = () => {
      document
        .querySelector<HTMLElement>(`[data-realizacja-wiersz="${CSS.escape(rowId)}"]`)
        ?.focus();
      klatka += 1;
      if (klatka < KLATKI) {
        uchwyt = window.requestAnimationFrame(sprobuj);
      } else {
        powrotFokusuRef.current = null;
      }
    };
    sprobuj();
    return () => window.cancelAnimationFrame(uchwyt);
  }, [selection]);

  const activeWaits = useMemo(() => waits.filter((w) => w.status === 'ACTIVE'), [waits]);
  const pendingProposals = useMemo(
    () => proposals.filter((p) => p.status === 'PENDING_REVIEW'),
    [proposals]
  );

  const waitRows = useMemo(
    () =>
      waits.map((wait) => ({
        id: wait.waitId,
        naCo: caseWaitTypeLabel(wait.waitType, true),
        stan: caseWaitStatusLabel(wait.status, true),
        stanTone: waitTone(wait),
        odKiedy: wait.createdAt,
        termin: wait.timeoutAt || wait.dueAt || '',
        sygnal: wait.expectedEventType || '',
        raw: wait,
      })),
    [waits]
  );

  const proposalRows = useMemo(
    () =>
      proposals.map((proposal) => ({
        id: proposal.actionProposalId,
        czego: effectClassLabel(proposal.effectClass, true),
        stan: proposalStatusLabel(proposal.status, true),
        stanTone: proposalTone(proposal.status),
        ktoZglosil:
          proposal.proposerType === 'HUMAN'
            ? 'Człowiek'
            : proposal.proposerType === 'AGENT'
              ? 'Asystent AI'
              : 'System',
        zgloszone: proposal.createdAt,
        wazneDo: proposal.expiresAt || '',
        raw: proposal,
      })),
    [proposals]
  );

  const runRows = useMemo(
    () =>
      runs.map((run, index) => ({
        id: run.runId,
        numer: index + 1,
        stan: runStatusLabel(run.status, true),
        stanTone: runTone(run),
        rozpoczety: run.startedAt || '',
        zaktualizowany: run.updatedAt,
        raw: run,
      })),
    [runs]
  );

  // Termin czytelnie w JEDNEJ linii — używany przez zestaw średni i wąski,
  // gdzie „Czeka od" i „Termin" dzielą komórkę.
  const terminText = (row: Record<string, unknown>) =>
    row.termin ? formatDateTime(String(row.termin)) : 'bez terminu';

  const waitColumnsByTier: Record<ColumnTier, TableColumn[]> = {
    pelny: [
      {
        id: 'naCo',
        label: 'Na co czekamy',
        width: '250px',
        sortable: true,
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <span
            // Kotwica fokusu: po zamknięciu podglądu Escape'em wracamy dokładnie
            // na ten wiersz. `tabIndex={-1}` = poza kolejnością Tab, ale można
            // mu oddać fokus programowo.
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="block rounded text-sm font-medium text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {String(row.naCo)}
          </span>
        ),
      },
      {
        id: 'stan',
        label: 'Stan',
        width: '150px',
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
        ),
      },
      {
        id: 'odKiedy',
        label: 'Czeka od',
        width: '150px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <span
            className="text-sm text-c-text-secondary"
            title={formatDateTime(String(row.odKiedy))}
          >
            {relativeDays(String(row.odKiedy))}
          </span>
        ),
      },
      {
        id: 'termin',
        label: 'Termin',
        width: '150px',
        sortable: true,
        render: (row: Record<string, unknown>) =>
          row.termin ? (
            <span className="text-sm text-c-text-secondary">
              {formatDateTime(String(row.termin))}
            </span>
          ) : (
            <span className="text-sm text-c-text-muted">bez terminu</span>
          ),
      },
    ],
    // Dwie kolumny: co i w jakim stanie · kiedy. Dwie kolumny danych to próg,
    // przy którym `minTableWidth="columns"` znosi wymuszone 980 px, więc
    // tabela zwęża się do kontenera zamiast chować treść za przewijaniem.
    sredni: [
      {
        id: 'naCo',
        label: 'Na co czekamy',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="text-sm font-medium leading-snug text-c-text">{String(row.naCo)}</div>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
          </div>
        ),
      },
      {
        id: 'odKiedy',
        label: 'Od kiedy i do kiedy',
        width: '190px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => String(row.odKiedy ?? ''),
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div className="text-sm text-c-text-secondary" title={formatDateTime(String(row.odKiedy))}>
              Czeka {relativeDays(String(row.odKiedy))}
            </div>
            <div className="text-xs text-c-text-muted">Termin: {terminText(row)}</div>
          </div>
        ),
      },
    ],
    // Telefon: jedna kolumna, w niej pełna odpowiedź na pytanie „na co czekamy
    // i czy się pali" — nic nie zostaje za przewijaniem.
    waski: [
      {
        id: 'naCo',
        label: 'Na co czekamy',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="text-sm font-medium leading-snug text-c-text">{String(row.naCo)}</div>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
            <div className="text-xs text-c-text-muted">
              Czeka {relativeDays(String(row.odKiedy))} · termin: {terminText(row)}
            </div>
          </div>
        ),
      },
    ],
  };

  const proposalColumnsByTier: Record<ColumnTier, TableColumn[]> = {
    pelny: [
      {
        id: 'czego',
        label: 'Czego dotyczy',
        width: '260px',
        sortable: true,
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <span
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="block rounded text-sm font-medium text-c-text outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {String(row.czego)}
          </span>
        ),
      },
      {
        id: 'stan',
        label: 'Stan',
        width: '180px',
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
        ),
      },
      { id: 'ktoZglosil', label: 'Kto zgłosił', width: '140px', filterable: true },
      {
        id: 'zgloszone',
        label: 'Zgłoszone',
        width: '150px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <span className="text-sm text-c-text-secondary">
            {relativeDays(String(row.zgloszone))}
          </span>
        ),
      },
    ],
    sredni: [
      {
        id: 'czego',
        label: 'Czego dotyczy',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="text-sm font-medium leading-snug text-c-text">{String(row.czego)}</div>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
          </div>
        ),
      },
      {
        id: 'zgloszone',
        label: 'Kto i kiedy',
        width: '180px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => String(row.zgloszone ?? ''),
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div className="text-sm text-c-text-secondary">{String(row.ktoZglosil)}</div>
            <div className="text-xs text-c-text-muted">{relativeDays(String(row.zgloszone))}</div>
          </div>
        ),
      },
    ],
    waski: [
      {
        id: 'czego',
        label: 'Sprawy do zatwierdzenia',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <div className="text-sm font-medium leading-snug text-c-text">{String(row.czego)}</div>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
            <div className="text-xs text-c-text-muted">
              Zgłosił: {String(row.ktoZglosil)} · {relativeDays(String(row.zgloszone))}
            </div>
          </div>
        ),
      },
    ],
  };

  /**
   * Dwa zestawy kolumn (nie trzy): przebiegów jest zwykle niewiele
   * (LIGHT — co najwyżej jeden; STANDARD/TRANSFORMATION — garstka), a jedyne
   * dwie kolumny danych (numer/stan i kiedy) mieszczą się bez przewijania od
   * progu 460 px w górę — trzeci, jeszcze węższy zestaw dokładałby kod bez
   * potrzeby (ta sama zasada co przy `minTableWidth="columns"` niżej).
   */
  const runColumnsByTier: Record<ColumnTier, TableColumn[]> = {
    pelny: [
      {
        id: 'stan',
        label: 'Przebieg',
        width: '280px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <span className="block text-sm font-medium text-c-text">Przebieg {String(row.numer)}</span>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
          </div>
        ),
      },
      {
        id: 'zaktualizowany',
        label: 'Ostatnia zmiana',
        width: '200px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <span className="text-sm text-c-text-secondary">
            {relativeDays(String(row.zaktualizowany))}
          </span>
        ),
      },
    ],
    sredni: [
      {
        id: 'stan',
        label: 'Przebieg',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <span className="block text-sm font-medium text-c-text">Przebieg {String(row.numer)}</span>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
            <span className="block text-xs text-c-text-muted">
              zmiana {relativeDays(String(row.zaktualizowany))}
            </span>
          </div>
        ),
      },
    ],
    waski: [
      {
        id: 'stan',
        label: 'Przebiegi',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <span className="block text-sm font-medium text-c-text">Przebieg {String(row.numer)}</span>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
            <span className="block text-xs text-c-text-muted">
              zmiana {relativeDays(String(row.zaktualizowany))}
            </span>
          </div>
        ),
      },
    ],
  };

  const waitTier = tierFor(waitsAvailableWidth, WAITS_FULL_WIDTH);
  const proposalTier = tierFor(proposalsAvailableWidth, PROPOSALS_FULL_WIDTH);
  const runTier = tierFor(runsAvailableWidth, RUNS_FULL_WIDTH);
  const waitColumns = waitColumnsByTier[waitTier];
  const proposalColumns = proposalColumnsByTier[proposalTier];
  const runColumns = runColumnsByTier[runTier];

  const selectedWait =
    selection?.kind === 'oczekiwanie'
      ? (waits.find((w) => w.waitId === selection.id) ?? null)
      : null;
  const selectedProposal =
    selection?.kind === 'propozycja'
      ? (proposals.find((p) => p.actionProposalId === selection.id) ?? null)
      : null;
  const selectedRun =
    selection?.kind === 'przebieg' ? (runs.find((r) => r.runId === selection.id) ?? null) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
        <CommandBanner notice={notice} onRefresh={onReload} onDismiss={() => setNotice(null)} />

        {/* Co się teraz dzieje — jedno zdanie, bez żargonu. */}
        <div className="rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
          <h2 className="text-base font-semibold text-c-text">Co się teraz dzieje</h2>
          <p className="mt-1 text-sm text-c-text-secondary">
            Zlecenie jest w stanie „{caseStatusLabel(caseItem.caseStatus, true).toLowerCase()}".{' '}
            {activeWaits.length
              ? `Czekamy na ${activeWaits.length} ${activeWaits.length === 1 ? 'rzecz' : 'rzeczy'}.`
              : 'Nic nie jest w stanie oczekiwania.'}{' '}
            {pendingProposals.length
              ? `${pendingProposals.length} ${pendingProposals.length === 1 ? 'sprawa czeka' : 'sprawy czekają'} na Twoją decyzję.`
              : 'Nic nie czeka na Twoją decyzję.'}{' '}
            {/*
             * ★ „Częściowo zakończone" tylko z JAWNEGO `resultAcceptance='PARTIAL'`
             * zapisanego dla kroku (`case_workspace_node_result_acceptances`),
             * NIGDY z licznika ostrzeżeń ani ze stanu Run — to dosłowny wymóg
             * kanonu (`04_DOMAIN_RUNTIME_AND_STATE_MACHINES.md:263`). Zdanie
             * pojawia się WYŁĄCZNIE gdy jest coś, co wymaga uwagi (częściowe
             * lub odrzucone) — same akceptacje w komplecie nie zaśmiecają tego
             * podsumowania. Pełna, klikalna lista jest w zakładce Rezultaty.
             */}
            {wynikiKrokow && (wynikiKrokow.partial > 0 || wynikiKrokow.rejected > 0)
              ? `${
                  wynikiKrokow.partial > 0
                    ? `${wynikiKrokow.partial} ${wynikiKrokow.partial === 1 ? 'krok zakończony częściowo' : 'kroki zakończone częściowo'}`
                    : ''
                }${wynikiKrokow.partial > 0 && wynikiKrokow.rejected > 0 ? ', ' : ''}${
                  wynikiKrokow.rejected > 0
                    ? `${wynikiKrokow.rejected} ${wynikiKrokow.rejected === 1 ? 'odrzucony' : 'odrzucone'}`
                    : ''
                } — szczegóły w zakładce Rezultaty.`
              : null}
          </p>
        </div>

        <section aria-labelledby="zlecenia-oczekiwania" className="min-w-0">
          <h3 id="zlecenia-oczekiwania" className="mb-2 text-sm font-semibold text-c-text">
            Na co czekamy
          </h3>
          <div
            ref={waitsCardRef}
            className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3"
          >
            <StandardTable
              columns={waitColumns}
              data={waitRows}
              selectedRowId={selection?.kind === 'oczekiwanie' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'oczekiwanie', id: String(row.id) })}
              rowDescription={() => null}
              /*
               * Klucz zależy od zestawu kolumn: pstryczek kolumn zapamiętuje
               * WIDOCZNOŚĆ po `id`, a te same identyfikatory znaczą co innego w
               * każdym zestawie. Wspólny klucz przenosiłby ukrycie kolumny z
               * desktopu na telefon i chował jedyną kolumnę, jaka tam jest.
               */
              persistKey={`caseWorkspace.execution.waits.${waitTier}`}
              density="compact"
              defaultSort={{ columnId: 'odKiedy', direction: 'desc' }}
              /*
               * Ten sam defekt co na liście zleceń i w „Planie → Lista":
               * `StandardTable` wymuszał 980 px min-width niezależnie od liczby
               * kolumn. ZMIERZONE przed naprawą: przy oknie 375 px kontener miał
               * 299 px, a tabela 980 px → 681 px przewijania UKRYTEGO wewnątrz
               * tabeli, przy czystym pomiarze strony
               * (`documentElement.scrollWidth === innerWidth === 375`).
               * Zestawy 1- i 2-kolumnowe schodzą przez `'columns'` do braku
               * min-width; zestaw pełny deklaruje tyle, ile jego kolumny
               * naprawdę potrzebują (700 px), a nie zapożyczone 980 px.
               */
              minTableWidth={waitTier === 'pelny' ? WAITS_FULL_WIDTH : 'columns'}
              empty={{
                icon: Clock,
                title: 'Nic nie czeka',
                description: 'Żaden krok zlecenia nie jest w tej chwili wstrzymany.',
              }}
            />
          </div>
        </section>

        <section aria-labelledby="zlecenia-decyzje" className="min-w-0">
          <h3 id="zlecenia-decyzje" className="mb-2 text-sm font-semibold text-c-text">
            Sprawy do zatwierdzenia
          </h3>
          <div
            ref={proposalsCardRef}
            className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3"
          >
            <StandardTable
              columns={proposalColumns}
              data={proposalRows}
              selectedRowId={selection?.kind === 'propozycja' ? selection.id : null}
              onRowClick={(row) => setSelection({ kind: 'propozycja', id: String(row.id) })}
              rowDescription={() => null}
              persistKey={`caseWorkspace.execution.proposals.${proposalTier}`}
              density="compact"
              defaultSort={{ columnId: 'zgloszone', direction: 'desc' }}
              minTableWidth={proposalTier === 'pelny' ? PROPOSALS_FULL_WIDTH : 'columns'}
              empty={{
                icon: Inbox,
                title: 'Nic nie czeka na decyzję',
                description: 'Gdy system będzie chciał coś zrobić w Twoim imieniu, zapyta tutaj.',
              }}
            />
          </div>
        </section>

        {/*
         * Przebiegi (Run) — TU po raz pierwszy jest UI dla `runLifecycle.routes.ts`
         * (start/wstrzymaj/wznów/anuluj przebieg). Sekcja pojawia się TYLKO gdy
         * jest co pokazać: zlecenie LIGHT ma co najwyżej jeden Run i uruchamia
         * go przyciskiem „Zatwierdź i rozpocznij" w Menu 1 (`CaseDetailScreen`) —
         * ta lista wtedy po prostu pokaże ten jeden wiersz, bez duplikowania
         * przycisku startu. STANDARD/TRANSFORMATION nie mają dziś ŻADNEGO
         * innego miejsca do wystartowania Runu po publikacji planu — stąd akcja
         * „Uruchom" w podglądzie działa dla KAŻDEGO Runu w stanie CREATED,
         * niezależnie od profilu zlecenia.
         */}
        {runs.length ? (
          <section aria-labelledby="zlecenia-runs" className="min-w-0">
            <h3 id="zlecenia-runs" className="mb-2 text-sm font-semibold text-c-text">
              Przebiegi wykonania
            </h3>
            <div
              ref={runsCardRef}
              className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3"
            >
              <StandardTable
                columns={runColumns}
                data={runRows}
                selectedRowId={selection?.kind === 'przebieg' ? selection.id : null}
                onRowClick={(row) => setSelection({ kind: 'przebieg', id: String(row.id) })}
                rowDescription={() => null}
                persistKey={`caseWorkspace.execution.runs.${runTier}`}
                density="compact"
                defaultSort={{ columnId: 'zaktualizowany', direction: 'desc' }}
                minTableWidth={runTier === 'pelny' ? RUNS_FULL_WIDTH : 'columns'}
                empty={{
                  icon: RunIcon,
                  title: 'Brak przebiegów',
                  description: 'Ten Run nie ma jeszcze żadnego przebiegu.',
                }}
              />
            </div>
          </section>
        ) : null}

        {history.length ? (
          <section aria-labelledby="zlecenia-przebieg" className="min-w-0">
            <h3 id="zlecenia-przebieg" className="mb-2 text-sm font-semibold text-c-text">
              Przebieg zlecenia
            </h3>
            <ol className="space-y-1.5">
              {history.slice(0, 12).map((event) => (
                <li
                  key={event.eventId}
                  className="flex flex-wrap items-baseline gap-x-2 rounded-lg border border-c-border bg-c-surface px-3 py-2"
                >
                  <span className="text-xs tabular-nums text-c-text-muted">
                    {formatDateTime(event.occurredAt)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm text-c-text">{event.summary}</span>
                  {expert ? <TechnicalId value={event.eventType} /> : null}
                </li>
              ))}
            </ol>
          </section>
        ) : null}
      </div>

      {/* Prawy panel kontekstowy — ZAMKNIĘTY domyślnie, otwiera go dopiero
          kliknięcie wiersza (warunek właściciela #6). */}
      {selectedWait ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={caseWaitTypeLabel(selectedWait.waitType, true)}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: caseWaitStatusLabel(selectedWait.status, true), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedWait.createdAt)}
                </span>
              ),
            }}
            /*
             * Akcje mutujące — dopiero od pakietu B3. Wcześniej ten podgląd był
             * WYŁĄCZNIE do patrzenia: `POST /waits/:waitId/human-input` i
             * `POST /waits/:waitId/cancel` istniały w `api.ts`, ale żaden
             * ekran ich nie wołał. `Podaj dane" tylko dla oczekiwania na
             * CZŁOWIEKA — dla TIMER/DOMAIN_EVENT/EXTERNAL_CALLBACK „podanie
             * danych" nie ma znaczenia domenowego (§5 ProvideHumanInput jest
             * rodziną komend WYŁĄCZNIE dla HUMAN wait).
             */
            actions={
              selectedWait.status === 'ACTIVE'
                ? {
                    resolutions: [
                      ...(selectedWait.waitType === 'HUMAN'
                        ? ([
                            {
                              id: 'podaj-dane',
                              variant: 'positive',
                              label: 'Podaj dane',
                              icon: CheckCircle2,
                              onClick: () => setPending({ kind: 'wait-provide-input', wait: selectedWait }),
                            },
                          ] satisfies StandardPreviewAction[])
                        : []),
                      {
                        id: 'anuluj-oczekiwanie',
                        variant: 'destructive',
                        label: 'Anuluj oczekiwanie',
                        icon: XCircle,
                        onClick: () => setPending({ kind: 'wait-cancel', wait: selectedWait }),
                      },
                    ],
                  }
                : undefined
            }
            details={{
              text: 'Ten krok zlecenia jest wstrzymany do czasu, aż nadejdzie opisany niżej sygnał.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'czeka-od',
                  label: 'Czeka od',
                  value: formatDateTime(selectedWait.createdAt),
                },
                {
                  id: 'termin',
                  label: 'Termin',
                  value: selectedWait.timeoutAt
                    ? formatDateTime(selectedWait.timeoutAt)
                    : selectedWait.dueAt
                      ? formatDateTime(selectedWait.dueAt)
                      : 'bez terminu',
                },
                {
                  id: 'sygnal',
                  label: 'Oczekiwany sygnał',
                  value: selectedWait.expectedEventType
                    ? expert
                      ? selectedWait.expectedEventType
                      : 'zdarzenie w systemie'
                    : 'brak — czekamy na człowieka',
                },
                {
                  id: 'rozwiazane',
                  label: 'Doczekało się',
                  value: selectedWait.satisfiedAt
                    ? formatDateTime(selectedWait.satisfiedAt)
                    : 'jeszcze nie',
                },
              ],
            }}
          />
        </aside>
      ) : selectedProposal ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={effectClassLabel(selectedProposal.effectClass, true)}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: proposalStatusLabel(selectedProposal.status, true), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedProposal.createdAt)}
                </span>
              ),
              recommendation:
                selectedProposal.status === 'PENDING_REVIEW'
                  ? 'Ta sprawa czeka na Twoją decyzję.'
                  : undefined,
            }}
            /*
             * Cztery decyzje z JEDNEJ trasy backendu (`POST
             * /proposals/:id/decision`, `decideProposal` w `api.ts`) — ta
             * funkcja SAMA odczytuje propozycję tuż przed wysłaniem, żeby
             * dostać `proposalVersion`/`payloadDigest`/`policySnapshotRef` z
             * serwera (nigdy nie zgaduje ich tutaj). Tylko dla spraw, które
             * REALNIE czekają na decyzję — dla pozostałych stanów przycisków
             * nie ma (blok akcji po prostu znika, `StandardPreview` renderuje
             * go warunkowo).
             */
            actions={
              selectedProposal.status === 'PENDING_REVIEW'
                ? {
                    resolutions: [
                      {
                        id: 'zatwierdz',
                        variant: 'positive',
                        label: 'Zatwierdź',
                        icon: CheckCircle2,
                        onClick: () =>
                          setPending({ kind: 'proposal-decision', decision: 'APPROVE', proposal: selectedProposal }),
                      },
                      {
                        id: 'odrzuc',
                        variant: 'destructive',
                        label: 'Odrzuć',
                        icon: XCircle,
                        onClick: () =>
                          setPending({ kind: 'proposal-decision', decision: 'REJECT', proposal: selectedProposal }),
                      },
                    ],
                    informational: [
                      {
                        id: 'popros-o-zmiany',
                        variant: 'neutral',
                        label: 'Poproś o zmiany',
                        icon: RotateCcw,
                        onClick: () =>
                          setPending({
                            kind: 'proposal-decision',
                            decision: 'REQUEST_CHANGES',
                            proposal: selectedProposal,
                          }),
                      },
                      {
                        id: 'odloz',
                        variant: 'neutral',
                        label: 'Odłóż',
                        icon: Clock,
                        onClick: () =>
                          setPending({ kind: 'proposal-decision', decision: 'DEFER', proposal: selectedProposal }),
                      },
                    ],
                  }
                : undefined
            }
            details={{
              text: 'Propozycja czynności zgłoszona w ramach tego zlecenia.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                {
                  id: 'kto',
                  label: 'Kto zgłosił',
                  value:
                    selectedProposal.proposerType === 'HUMAN'
                      ? 'Człowiek'
                      : selectedProposal.proposerType === 'AGENT'
                        ? 'Asystent AI'
                        : 'System',
                },
                {
                  id: 'zgloszone',
                  label: 'Zgłoszone',
                  value: formatDateTime(selectedProposal.createdAt),
                },
                {
                  id: 'wazne',
                  label: 'Ważne do',
                  value: selectedProposal.expiresAt
                    ? formatDateTime(selectedProposal.expiresAt)
                    : 'bezterminowo',
                },
              ],
            }}
          />
        </aside>
      ) : selectedRun ? (
        <aside className="w-full shrink-0 lg:w-[380px]">
          <StandardPreview
            title={`Przebieg ${runRows.find((r) => r.id === selectedRun.runId)?.numer ?? ''}`}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: runStatusLabel(selectedRun.status, true), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedRun.updatedAt)}
                </span>
              ),
            }}
            /*
             * Gating 1:1 z `ALLOWED_TRANSITIONS` po stronie serwisu
             * (`runLifecycleService.ts`): CREATED→Uruchom, RUNNING→Wstrzymaj,
             * PAUSED→Wznów, każdy nieterminalny stan→Anuluj. Serwer i tak
             * odrzuci nielegalne przejście (409), ale pokazywanie przycisku,
             * który ZAWSZE dostanie 409, byłoby atrapą — dokładnie ta sama
             * zasada co przy przycisku „Zatwierdź i rozpocznij" w Menu 1.
             */
            actions={{
              resolutions: [
                ...(selectedRun.status === 'CREATED'
                  ? ([
                      {
                        id: 'uruchom',
                        variant: 'positive',
                        label: 'Uruchom',
                        icon: Play,
                        onClick: () => setPending({ kind: 'run-start', run: selectedRun }),
                      },
                    ] satisfies StandardPreviewAction[])
                  : []),
                ...(selectedRun.status === 'RUNNING'
                  ? ([
                      {
                        id: 'wstrzymaj',
                        variant: 'warning',
                        label: 'Wstrzymaj',
                        icon: Pause,
                        onClick: () => setPending({ kind: 'run-pause', run: selectedRun }),
                      },
                    ] satisfies StandardPreviewAction[])
                  : []),
                ...(selectedRun.status === 'PAUSED'
                  ? ([
                      {
                        id: 'wznow',
                        variant: 'positive',
                        label: 'Wznów',
                        icon: Play,
                        onClick: () => setPending({ kind: 'run-resume', run: selectedRun }),
                      },
                    ] satisfies StandardPreviewAction[])
                  : []),
                ...(!RUN_TERMINAL.has(selectedRun.status)
                  ? ([
                      {
                        id: 'anuluj-przebieg',
                        variant: 'destructive',
                        label: 'Anuluj przebieg',
                        icon: Ban,
                        onClick: () => setPending({ kind: 'run-cancel', run: selectedRun }),
                      },
                    ] satisfies StandardPreviewAction[])
                  : []),
              ],
            }}
            details={{
              text: 'Przebieg wykonania planu tego zlecenia — konkretna próba wykonania kroków w kolejności grafu.',
              showWordCount: false,
              propertyLabel: 'Właściwość',
              valueLabel: 'Wartość',
              properties: [
                { id: 'stan', label: 'Stan', value: runStatusLabel(selectedRun.status, true) },
                {
                  id: 'wynik',
                  label: 'Ocena wyniku',
                  value: runOutcomeStatusLabelDisplay(selectedRun.outcomeStatus),
                },
                {
                  id: 'wystartowal',
                  label: 'Wystartował',
                  value: selectedRun.startedAt ? formatDateTime(selectedRun.startedAt) : 'jeszcze nie',
                },
                {
                  id: 'zakonczony',
                  label: 'Zakończony',
                  value: selectedRun.completedAt ? formatDateTime(selectedRun.completedAt) : 'jeszcze nie',
                },
                {
                  id: 'zmieniony',
                  label: 'Ostatnia zmiana',
                  value: formatDateTime(selectedRun.updatedAt),
                },
                ...(expert
                  ? [
                      {
                        id: 'run-id',
                        label: 'Identyfikator Run',
                        value: <TechnicalId value={selectedRun.runId} title="runId" />,
                      },
                      {
                        id: 'graph-digest',
                        label: 'Odcisk grafu',
                        value: <TechnicalId value={selectedRun.graphDigest} title="graphDigest" />,
                      },
                    ]
                  : []),
              ],
            }}
          />
        </aside>
      ) : null}

      <CommandDialog
        open={pending !== null}
        title={dialogConfig(pending).title}
        description={dialogConfig(pending).description}
        confirmLabel={dialogConfig(pending).confirmLabel}
        reason={dialogConfig(pending).reason}
        busy={commandBusy}
        onConfirm={(value) => void runPendingCommand(value)}
        onCancel={closeDialog}
      />
    </div>
  );
};

/** Napis Run.outcomeStatus po polsku — patrz `enumLabels.runOutcomeStatusLabel`. */
function runOutcomeStatusLabelDisplay(value: CaseRun['outcomeStatus']): string {
  return runOutcomeStatusLabel(value, true);
}

/**
 * Treść okna potwierdzenia per rodzaj komendy — jedna funkcja, żeby tytuł/opis/
 * pole „powód" nie rozjeżdżały się między siedmioma miejscami wywołania.
 * `pending === null` zwraca neutralne wartości (dialog jest wtedy `open=false`
 * i tak nic nie renderuje) — bez tego `CommandDialog` dostawałby `undefined`
 * i TypeScript wymuszałby siedem osobnych warunków przy każdym propie.
 */
function dialogConfig(pending: PendingCommand | null): {
  title: string;
  description: string;
  confirmLabel: string;
  reason?: { label: string; required: boolean; placeholder?: string };
} {
  if (!pending) return { title: '', description: '', confirmLabel: '' };
  switch (pending.kind) {
    case 'proposal-decision': {
      const decisionLabel =
        pending.decision === 'APPROVE'
          ? 'Zatwierdzić'
          : pending.decision === 'REJECT'
            ? 'Odrzucić'
            : pending.decision === 'REQUEST_CHANGES'
              ? 'Odesłać do poprawy'
              : 'Odłożyć';
      return {
        title: `${decisionLabel} tę sprawę?`,
        description: effectClassLabel(pending.proposal.effectClass, true),
        confirmLabel: decisionLabel,
        reason: { label: 'Powód (opcjonalnie)', required: false, placeholder: 'Krótkie uzasadnienie decyzji…' },
      };
    }
    case 'wait-provide-input':
      return {
        title: 'Podaj dane',
        description:
          'System czeka na dane od człowieka, żeby ruszyć dalej z tym krokiem. Wpisz treść, która ma zostać przekazana.',
        confirmLabel: 'Wyślij dane',
        reason: { label: 'Treść danych', required: true, placeholder: 'Np. decyzja, liczba, link do dokumentu…' },
      };
    case 'wait-cancel':
      return {
        title: 'Anulować to oczekiwanie?',
        description: 'Krok przestanie czekać na ten sygnał. Tej operacji nie da się cofnąć.',
        confirmLabel: 'Anuluj oczekiwanie',
        reason: { label: 'Powód anulowania', required: true, placeholder: 'Dlaczego anulujesz to oczekiwanie?' },
      };
    case 'run-start':
      return {
        title: 'Uruchomić ten przebieg?',
        description:
          'Zostaną utworzone kroki wejściowe planu i przebieg przejdzie w stan „W toku". Tej operacji nie da się cofnąć.',
        confirmLabel: 'Uruchom',
      };
    case 'run-pause':
      return {
        title: 'Wstrzymać ten przebieg?',
        description: 'Przebieg przestanie automatycznie ruszać dalej, dopóki go nie wznowisz.',
        confirmLabel: 'Wstrzymaj',
      };
    case 'run-resume':
      return {
        title: 'Wznowić ten przebieg?',
        description: 'Przebieg wróci do stanu „W toku".',
        confirmLabel: 'Wznów',
      };
    case 'run-cancel':
      return {
        title: 'Anulować ten przebieg?',
        description:
          'Wszystkie oczekujące kroki tego przebiegu zostaną anulowane razem z nim. Tej operacji nie da się cofnąć.',
        confirmLabel: 'Anuluj przebieg',
        reason: { label: 'Powód anulowania', required: false, placeholder: 'Dlaczego anulujesz ten przebieg?' },
      };
  }
}

export default RealizacjaView;
