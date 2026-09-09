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

import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Inbox,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Route as RunIcon,
  Send,
  Undo2,
  XCircle,
} from 'lucide-react';
import type { TFunction } from 'i18next';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardPreview, type StandardPreviewAction } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import { JedenPrawyPanel } from '@/components/shared/PreviewPane/JedenPrawyPanel';
import { useJedenPanel } from '@/components/shared/PreviewPane/useJedenPanel';
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
  executeProposal,
  markProposalFailed,
  newIdempotencyKey,
  pauseRun,
  provideHumanInput,
  provideNodeInput,
  rejectProposal,
  requestChangesOnProposal,
  resumeRun,
  retryProposal,
  revokeProposal,
  startRun,
  submitProposalForReview,
} from './api';
import { listNodeResultAcceptancesForCase } from './apiResults';
import type {
  CaseActionProposal,
  CaseCoreView,
  CaseHistoryEvent,
  CaseRun,
  CaseWait,
} from './types';
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
  | {
      kind: 'proposal-decision';
      decision: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DEFER';
      proposal: CaseActionProposal;
    }
  /**
   * Cztery przejścia stanu propozycji BEZ decyzji zatwierdzającej — pakiet M2.
   * DRAFT→PENDING_REVIEW (wyślij), FAILED→APPROVED (ponów),
   * APPROVED→REVOKED (cofnij zatwierdzenie), EXECUTING→FAILED (oznacz jako
   * nieudane) — dokładnie te krawędzie, które `ALLOWED_TRANSITIONS` w
   * `proposalApprovalService.ts:448` dopuszcza dla tych czterech stanów.
   */
  | { kind: 'proposal-submit'; proposal: CaseActionProposal }
  | { kind: 'proposal-retry'; proposal: CaseActionProposal }
  | { kind: 'proposal-revoke'; proposal: CaseActionProposal }
  | { kind: 'proposal-execute'; proposal: CaseActionProposal }
  | { kind: 'proposal-mark-failed'; proposal: CaseActionProposal }
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

/**
 * Zestaw akcji podglądu propozycji — GATING 1:1 z `ALLOWED_TRANSITIONS` po
 * stronie serwisu (`proposalApprovalService.ts:448`):
 *
 *   DRAFT             -> PENDING_REVIEW   (submitProposalForReview)
 *   PENDING_REVIEW     -> APPROVED/REJECTED/REQUESTED_CHANGES (decideProposal)
 *   APPROVED           -> REVOKED         (revokeProposal)
 *   EXECUTING          -> FAILED          (markProposalFailed)
 *   FAILED             -> APPROVED        (retryProposal, „ponowiony retry")
 *   EXECUTED/AUDITED/REJECTED/REQUESTED_CHANGES/REVOKED -> [] (bez akcji)
 *
 * Pokazywanie przycisku, który serwer i tak odrzuci 409-tką, byłoby atrapą —
 * ta sama zasada co przy przebiegach (Run) i statusie zlecenia niżej w tym
 * pliku i w `CasesListScreen.tsx`.
 *
 * WARIANTY (CLAUDE.md pułapka #1 — crimson TYLKO dla semantyki krytycznej):
 * „Wyślij do przeglądu" i „Ponów" przesuwają sprawę DO PRZODU (jak „Uruchom"/
 * „Wznów" przy przebiegach) — `positive`, nigdy crimson. „Cofnij zatwierdzenie"
 * i „Oznacz jako nieudane" SĄ destrukcyjne z osobna: pierwsze unieważnia
 * ważne zatwierdzenie i twardo blokuje wykonanie („revocation after approval
 * blocks execution" — kanon §3.6), drugie zapisuje porażkę wykonywanej właśnie
 * czynności. Obie idą jako `destructive` (danger-*, ta sama pula co „Odrzuć"/
 * „Anuluj przebieg" wyżej) — żaden zwykły CTA tego pliku nie używa tego
 * wariantu.
 */
function proposalPreviewActions(
  proposal: CaseActionProposal,
  setPending: (cmd: PendingCommand) => void,
  t: TFunction
): { resolutions: StandardPreviewAction[]; informational?: StandardPreviewAction[] } | undefined {
  if (proposal.status === 'PENDING_REVIEW') {
    return {
      resolutions: [
        {
          id: 'zatwierdz',
          variant: 'positive',
          label: t('caseWorkspace.execution.actions.approve', 'Approve'),
          icon: CheckCircle2,
          onClick: () => setPending({ kind: 'proposal-decision', decision: 'APPROVE', proposal }),
        },
        {
          id: 'odrzuc',
          variant: 'destructive',
          label: t('caseWorkspace.execution.actions.reject', 'Reject'),
          icon: XCircle,
          onClick: () => setPending({ kind: 'proposal-decision', decision: 'REJECT', proposal }),
        },
      ],
      informational: [
        {
          id: 'popros-o-zmiany',
          variant: 'neutral',
          label: t('caseWorkspace.execution.actions.requestChanges', 'Request changes'),
          icon: RotateCcw,
          onClick: () =>
            setPending({ kind: 'proposal-decision', decision: 'REQUEST_CHANGES', proposal }),
        },
        {
          id: 'odloz',
          variant: 'neutral',
          label: t('caseWorkspace.execution.actions.defer', 'Defer'),
          icon: Clock,
          onClick: () => setPending({ kind: 'proposal-decision', decision: 'DEFER', proposal }),
        },
      ],
    };
  }
  if (proposal.status === 'DRAFT') {
    return {
      resolutions: [
        {
          id: 'wyslij-do-przegladu',
          variant: 'positive',
          label: t('caseWorkspace.execution.actions.sendForReview', 'Send for review'),
          icon: Send,
          onClick: () => setPending({ kind: 'proposal-submit', proposal }),
        },
      ],
    };
  }
  if (proposal.status === 'APPROVED') {
    return {
      resolutions: [
        {
          id: 'rozpocznij-wykonanie',
          variant: 'positive',
          label: t('caseWorkspace.execution.actions.startExecution', 'Start execution'),
          icon: Play,
          onClick: () => setPending({ kind: 'proposal-execute', proposal }),
        },
        {
          id: 'cofnij-zatwierdzenie',
          variant: 'destructive',
          label: t('caseWorkspace.execution.actions.revokeApproval', 'Revoke approval'),
          icon: Undo2,
          onClick: () => setPending({ kind: 'proposal-revoke', proposal }),
        },
      ],
    };
  }
  if (proposal.status === 'FAILED') {
    return {
      resolutions: [
        {
          id: 'ponow',
          variant: 'positive',
          label: t('caseWorkspace.execution.actions.retry', 'Retry'),
          icon: RefreshCw,
          onClick: () => setPending({ kind: 'proposal-retry', proposal }),
        },
      ],
    };
  }
  if (proposal.status === 'EXECUTING') {
    return {
      resolutions: [
        {
          id: 'oznacz-jako-nieudane',
          variant: 'destructive',
          label: t('caseWorkspace.execution.actions.markAsFailed', 'Mark as failed'),
          icon: AlertTriangle,
          onClick: () => setPending({ kind: 'proposal-mark-failed', proposal }),
        },
      ],
    };
  }
  return undefined;
}

/** Jedno zdanie rekomendacji w karcie meta, per stan propozycji. `null` = brak. */
function proposalRecommendation(status: CaseActionProposal['status'], t: TFunction): string | undefined {
  switch (status) {
    case 'DRAFT':
      return t(
        'caseWorkspace.execution.recommendation.draft',
        'This case is a draft — send it for review so someone can approve it.',
      );
    case 'PENDING_REVIEW':
      return t('caseWorkspace.execution.recommendation.pendingReview', 'This case is waiting on your decision.');
    case 'APPROVED':
      return t(
        'caseWorkspace.execution.recommendation.approved',
        'This case is approved and waiting for the system to execute it.',
      );
    case 'FAILED':
      return t(
        'caseWorkspace.execution.recommendation.failed',
        "This case's execution didn't succeed — you can retry it.",
      );
    case 'EXECUTING':
      return t('caseWorkspace.execution.recommendation.executing', 'This case is currently being executed.');
    default:
      return undefined;
  }
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
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || '').toLowerCase().startsWith('pl');
  const [selection, setSelectionState] = useState<Selection>(null);
  // DEC-397b (1.1-K6): klik wiersza po zamknięciu panelu (X) ma go ponownie
  // otworzyć — patrz InboxContent.tsx (K5, 2f5161f3b4).
  const jedenPanel = useJedenPanel();
  const setSelection = useCallback(
    (next: Selection) => {
      if (next) jedenPanel.otworz();
      setSelectionState(next);
    },
    [jedenPanel]
  );
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
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: result.readback === 'confirmed' ? 'success' : 'warning',
            text:
              result.readback === 'confirmed'
                ? `Decyzja zapisana. Sprawa ma teraz status: ${proposalStatusLabel(result.value.proposal.status, isPolish)}.`
                : 'Decyzja została przyjęta, ale nie udało się jej potwierdzić ponownym odczytem. Odśwież dane.',
          });
          onReload();
          return;
        }

        // ── Sprawy: wyślij do przeglądu / ponów / cofnij zatwierdzenie /
        // oznacz jako nieudane — CZTERY przejścia bez decyzji zatwierdzającej
        // (pakiet M2). Każde niesie WŁASNE `expectedVersion` z ostatnio
        // wczytanej propozycji (`pending.proposal.version`) — ten sam wzorzec
        // authoritative-readback co reszta tej zakładki.
        if (pending.kind === 'proposal-submit') {
          const intent = `proposal-submit:${pending.proposal.actionProposalId}`;
          const idempotencyKey = keyForIntent(intent);
          const result = await submitProposalForReview(
            pending.proposal.actionProposalId,
            pending.proposal.version,
            { idempotencyKey }
          );
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: result.readback === 'confirmed' ? 'success' : 'warning',
            text:
              result.readback === 'confirmed'
                ? `Sprawa wysłana do przeglądu. Ma teraz status: ${proposalStatusLabel(result.value.status, isPolish)}.`
                : 'Sprawa została wysłana do przeglądu, ale nie udało się tego potwierdzić ponownym odczytem. Odśwież dane.',
          });
          onReload();
          return;
        }

        if (pending.kind === 'proposal-retry') {
          const intent = `proposal-retry:${pending.proposal.actionProposalId}`;
          const idempotencyKey = keyForIntent(intent);
          const result = await retryProposal(
            pending.proposal.actionProposalId,
            pending.proposal.version,
            { idempotencyKey }
          );
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
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
                ? `Sprawa ponowiona. Ma teraz status: ${proposalStatusLabel(result.value.status, isPolish)}.`
                : 'Sprawa została ponowiona, ale nie udało się tego potwierdzić ponownym odczytem. Odśwież dane.',
          });
          onReload();
          return;
        }

        if (pending.kind === 'proposal-execute') {
          const intent = `proposal-execute:${pending.proposal.actionProposalId}`;
          const idempotencyKey = keyForIntent(intent);
          const result = await executeProposal(
            pending.proposal.actionProposalId,
            pending.proposal.version,
            { idempotencyKey }
          );
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          if (result.readback !== 'confirmed') {
            setNotice({
              tone: 'warning',
              text: 'Rozpoczęcie wykonania zostało przyjęte, ale nie potwierdzone ponownym odczytem. Odśwież dane.',
              refresh: true,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({ tone: 'success', text: 'Wykonanie czynności zostało rozpoczęte.' });
          onReload();
          return;
        }

        if (pending.kind === 'proposal-revoke') {
          const intent = `proposal-revoke:${pending.proposal.actionProposalId}`;
          const idempotencyKey = keyForIntent(intent);
          const reason = reasonOrInput.trim();
          if (!reason) {
            setNotice({
              tone: 'warning',
              text: 'Podaj powód cofnięcia zatwierdzenia — jest wymagany.',
            });
            return;
          }
          const result = await revokeProposal(
            pending.proposal.actionProposalId,
            reason,
            pending.proposal.version,
            { idempotencyKey }
          );
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: result.readback === 'confirmed' ? 'success' : 'warning',
            text:
              result.readback === 'confirmed'
                ? 'Zatwierdzenie zostało cofnięte. Czynność NIE zostanie wykonana, dopóki ktoś nie zatwierdzi jej ponownie.'
                : 'Cofnięcie zostało przyjęte, ale nie udało się tego potwierdzić ponownym odczytem. Odśwież dane.',
          });
          onReload();
          return;
        }

        if (pending.kind === 'proposal-mark-failed') {
          const intent = `proposal-mark-failed:${pending.proposal.actionProposalId}`;
          const idempotencyKey = keyForIntent(intent);
          const reason = reasonOrInput.trim();
          if (!reason) {
            setNotice({ tone: 'warning', text: 'Podaj powód niepowodzenia — jest wymagany.' });
            return;
          }
          const result = await markProposalFailed(
            pending.proposal.actionProposalId,
            reason,
            pending.proposal.version,
            { idempotencyKey }
          );
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
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
                ? 'Sprawa oznaczona jako nieudana. Można ją teraz ponowić.'
                : 'Operacja została przyjęta, ale nie udało się jej potwierdzić ponownym odczytem. Odśwież dane.',
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
            : await provideHumanInput(pending.wait.waitId, inputRef, pending.wait.version, {
                idempotencyKey,
              });
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
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
            setNotice({
              tone: 'warning',
              text: 'Podaj powód anulowania oczekiwania — jest wymagany.',
            });
            return;
          }
          const result = await cancelWait(pending.wait.waitId, reason, pending.wait.version, {
            idempotencyKey,
          });
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: result.readback === 'confirmed' ? 'success' : 'warning',
            text:
              result.readback === 'confirmed'
                ? 'Oczekiwanie zostało anulowane.'
                : 'Anulowanie zostało przyjęte, ale nie potwierdzone ponownym odczytem. Odśwież dane.',
            refresh: result.readback !== 'confirmed',
          });
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
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
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
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
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
          const result = await resumeRun(pending.run.runId, pending.run.version, {
            idempotencyKey,
          });
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
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
          const result = await cancelRun(
            pending.run.runId,
            pending.run.version,
            reason || undefined,
            {
              idempotencyKey,
            }
          );
          if (!result.ok) {
            setNotice({
              tone:
                result.failure.kind === 'conflict' || result.failure.kind === 'invalid'
                  ? 'warning'
                  : 'critical',
              text: result.failure.message,
              refresh: result.failure.refreshSuggested,
            });
            return;
          }
          intentKeysRef.current.delete(intent);
          setNotice({
            tone: result.readback === 'confirmed' ? 'success' : 'warning',
            text:
              result.readback === 'confirmed'
                ? 'Przebieg został anulowany.'
                : 'Anulowanie przebiegu zostało przyjęte, ale nie potwierdzone ponownym odczytem. Odśwież dane.',
            refresh: result.readback !== 'confirmed',
          });
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
        naCo: caseWaitTypeLabel(wait.waitType, isPolish),
        stan: caseWaitStatusLabel(wait.status, isPolish),
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
        czego: effectClassLabel(proposal.effectClass, isPolish),
        stan: proposalStatusLabel(proposal.status, isPolish),
        stanTone: proposalTone(proposal.status),
        ktoZglosil:
          proposal.proposerType === 'HUMAN'
            ? t('caseWorkspace.execution.proposalPreview.byHuman', 'Person')
            : proposal.proposerType === 'AGENT'
              ? t('caseWorkspace.execution.proposalPreview.byAgent', 'AI assistant')
              : t('caseWorkspace.execution.proposalPreview.bySystem', 'System'),
        zgloszone: proposal.createdAt,
        wazneDo: proposal.expiresAt || '',
        raw: proposal,
      })),
    [proposals, isPolish, t]
  );

  const runRows = useMemo(
    () =>
      runs.map((run, index) => ({
        id: run.runId,
        numer: index + 1,
        stan: runStatusLabel(run.status, isPolish),
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
        label: t('caseWorkspace.execution.columns.waitingOn', "What we're waiting on"),
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
        label: t('caseWorkspace.execution.columns.status', 'Status'),
        width: '150px',
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
        ),
      },
      {
        id: 'odKiedy',
        label: t('caseWorkspace.execution.waitPreview.waitingSince', 'Waiting since'),
        width: '150px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <span
            className="text-sm text-c-text-secondary"
            title={formatDateTime(String(row.odKiedy))}
          >
            {relativeDays(String(row.odKiedy), t)}
          </span>
        ),
      },
      {
        id: 'termin',
        label: t('caseWorkspace.execution.waitPreview.deadline', 'Deadline'),
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
        label: t('caseWorkspace.execution.columns.waitingOn', "What we're waiting on"),
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
        label: t('caseWorkspace.execution.columns.fromWhenToWhen', 'From when to when'),
        width: '190px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => String(row.odKiedy ?? ''),
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div
              className="text-sm text-c-text-secondary"
              title={formatDateTime(String(row.odKiedy))}
            >
              Czeka {relativeDays(String(row.odKiedy), t)}
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
        label: t('caseWorkspace.execution.columns.waitingOn', "What we're waiting on"),
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
              Czeka {relativeDays(String(row.odKiedy), t)} · termin: {terminText(row)}
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
        label: t('caseWorkspace.execution.columns.whatItConcerns', 'What it concerns'),
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
        label: t('caseWorkspace.execution.columns.status', 'Status'),
        width: '180px',
        filterable: true,
        render: (row: Record<string, unknown>) => (
          <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
        ),
      },
      {
        id: 'ktoZglosil',
        label: t('caseWorkspace.execution.proposalPreview.submittedBy', 'Submitted by'),
        width: '140px',
        filterable: true,
      },
      {
        id: 'zgloszone',
        label: t('caseWorkspace.execution.proposalPreview.submitted', 'Submitted'),
        width: '150px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <span className="text-sm text-c-text-secondary">
            {relativeDays(String(row.zgloszone), t)}
          </span>
        ),
      },
    ],
    sredni: [
      {
        id: 'czego',
        label: t('caseWorkspace.execution.columns.whatItConcerns', 'What it concerns'),
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
        label: t('caseWorkspace.execution.columns.whoAndWhen', 'Who and when'),
        width: '180px',
        sortable: true,
        sortAccessor: (row: Record<string, unknown>) => String(row.zgloszone ?? ''),
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div className="text-sm text-c-text-secondary">{String(row.ktoZglosil)}</div>
            <div className="text-xs text-c-text-muted">{relativeDays(String(row.zgloszone), t)}</div>
          </div>
        ),
      },
    ],
    waski: [
      {
        id: 'czego',
        label: t('caseWorkspace.execution.tables.approvalHeading', 'Cases for approval'),
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
              {t('caseWorkspace.execution.columns.submittedByPrefix', 'Submitted by: {{who}} · {{when}}', {
                who: String(row.ktoZglosil),
                when: relativeDays(String(row.zgloszone), t),
              })}
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
        label: t('caseWorkspace.execution.columns.run', 'Run'),
        width: '280px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <span className="block text-sm font-medium text-c-text">
              Przebieg {String(row.numer)}
            </span>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
          </div>
        ),
      },
      {
        id: 'zaktualizowany',
        label: t('caseWorkspace.execution.runPreview.lastChange', 'Last change'),
        width: '200px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <span className="text-sm text-c-text-secondary">
            {relativeDays(String(row.zaktualizowany), t)}
          </span>
        ),
      },
    ],
    sredni: [
      {
        id: 'stan',
        label: t('caseWorkspace.execution.columns.run', 'Run'),
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <span className="block text-sm font-medium text-c-text">
              Przebieg {String(row.numer)}
            </span>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
            <span className="block text-xs text-c-text-muted">
              zmiana {relativeDays(String(row.zaktualizowany), t)}
            </span>
          </div>
        ),
      },
    ],
    waski: [
      {
        id: 'stan',
        label: t('caseWorkspace.execution.columns.runs', 'Runs'),
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div
            data-realizacja-wiersz={String(row.id)}
            tabIndex={-1}
            className="min-w-0 space-y-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            <span className="block text-sm font-medium text-c-text">
              Przebieg {String(row.numer)}
            </span>
            <StatusTag tone={row.stanTone as 'critical'}>{String(row.stan)}</StatusTag>
            <span className="block text-xs text-c-text-muted">
              zmiana {relativeDays(String(row.zaktualizowany), t)}
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
          <h2 className="text-base font-semibold text-c-text">
            {t('caseWorkspace.execution.heading', "What's happening now")}
          </h2>
          <p className="mt-1 text-sm text-c-text-secondary">
            {t('caseWorkspace.execution.statusSentence', 'The order is in status "{{status}}".', {
              status: caseStatusLabel(caseItem.caseStatus, isPolish).toLowerCase(),
            })}{' '}
            {activeWaits.length
              ? t('caseWorkspace.execution.waitingCount', 'Waiting on {{count}} thing.', { count: activeWaits.length })
              : t('caseWorkspace.execution.waitingNone', 'Nothing is in a waiting state.')}{' '}
            {pendingProposals.length
              ? t('caseWorkspace.execution.pendingDecisionCount', '{{count}} case is waiting on your decision.', {
                  count: pendingProposals.length,
                })
              : t('caseWorkspace.execution.pendingDecisionNone', 'Nothing is waiting on your decision.')}{' '}
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
                    ? t('caseWorkspace.execution.partialCount', '{{count}} step completed partially', {
                        count: wynikiKrokow.partial,
                      })
                    : ''
                }${wynikiKrokow.partial > 0 && wynikiKrokow.rejected > 0 ? ', ' : ''}${
                  wynikiKrokow.rejected > 0
                    ? t('caseWorkspace.execution.rejectedCount', '{{count}} rejected', { count: wynikiKrokow.rejected })
                    : ''
                }${t('caseWorkspace.execution.detailsInResults', ' — details in the Results tab.')}`
              : null}
          </p>
        </div>

        <section aria-labelledby="zlecenia-oczekiwania" className="min-w-0">
          <h3 id="zlecenia-oczekiwania" className="mb-2 text-sm font-semibold text-c-text">
            {t('caseWorkspace.execution.waitingOnHeading', 'What we are waiting on')}
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
                title: t('caseWorkspace.execution.tables.waitsEmptyTitle', 'Nothing waiting'),
                description: t('caseWorkspace.execution.tables.waitsEmptyDescription', 'No order step is currently paused.'),
              }}
            />
          </div>
        </section>

        <section aria-labelledby="zlecenia-decyzje" className="min-w-0">
          <h3 id="zlecenia-decyzje" className="mb-2 text-sm font-semibold text-c-text">
            {t('caseWorkspace.execution.tables.approvalHeading', 'Cases for approval')}
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
                title: t('caseWorkspace.execution.tables.approvalEmptyTitle', 'Nothing waiting on a decision'),
                description: t(
                  'caseWorkspace.execution.tables.approvalEmptyDescription',
                  'When the system wants to do something on your behalf, it will ask here.',
                ),
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
              {t('caseWorkspace.execution.tables.runsHeading', 'Execution runs')}
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
                  title: t('caseWorkspace.execution.tables.runsEmptyTitle', 'No runs'),
                  description: t('caseWorkspace.execution.tables.runsEmptyDescription', "This run doesn't have any execution yet."),
                }}
              />
            </div>
          </section>
        ) : null}

        {history.length ? (
          <section aria-labelledby="zlecenia-przebieg" className="min-w-0">
            <h3 id="zlecenia-przebieg" className="mb-2 text-sm font-semibold text-c-text">
              {t('caseWorkspace.execution.tables.historyHeading', 'Order activity')}
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
      <JedenPrawyPanel rekord={selectedWait ? (
          <StandardPreview
            title={caseWaitTypeLabel(selectedWait.waitType, isPolish)}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: caseWaitStatusLabel(selectedWait.status, isPolish), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedWait.createdAt, t)}
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
                              label: t('caseWorkspace.execution.waitPreview.provideDataAction', 'Provide data'),
                              icon: CheckCircle2,
                              onClick: () =>
                                setPending({ kind: 'wait-provide-input', wait: selectedWait }),
                            },
                          ] satisfies StandardPreviewAction[])
                        : []),
                      {
                        id: 'anuluj-oczekiwanie',
                        variant: 'destructive',
                        label: t('caseWorkspace.execution.waitPreview.cancelWaitAction', 'Cancel wait'),
                        icon: XCircle,
                        onClick: () => setPending({ kind: 'wait-cancel', wait: selectedWait }),
                      },
                    ],
                  }
                : undefined
            }
            details={{
              text: t(
                'caseWorkspace.execution.waitPreview.detailsText',
                'This order step is paused until the signal described below arrives.',
              ),
              showWordCount: false,
              propertyLabel: t('caseWorkspace.execution.waitPreview.propertyLabel', 'Property'),
              valueLabel: t('caseWorkspace.execution.waitPreview.valueLabel', 'Value'),
              properties: [
                {
                  id: 'czeka-od',
                  label: t('caseWorkspace.execution.waitPreview.waitingSince', 'Waiting since'),
                  value: formatDateTime(selectedWait.createdAt),
                },
                {
                  id: 'termin',
                  label: t('caseWorkspace.execution.waitPreview.deadline', 'Deadline'),
                  value: selectedWait.timeoutAt
                    ? formatDateTime(selectedWait.timeoutAt)
                    : selectedWait.dueAt
                      ? formatDateTime(selectedWait.dueAt)
                      : t('caseWorkspace.execution.waitPreview.noDeadline', 'no deadline'),
                },
                {
                  id: 'sygnal',
                  label: t('caseWorkspace.execution.waitPreview.expectedSignal', 'Expected signal'),
                  value: selectedWait.expectedEventType
                    ? expert
                      ? selectedWait.expectedEventType
                      : t('caseWorkspace.execution.waitPreview.systemEvent', 'system event')
                    : t('caseWorkspace.execution.waitPreview.noneWaitingOnHuman', 'none — waiting on a person'),
                },
                {
                  id: 'rozwiazane',
                  label: t('caseWorkspace.execution.waitPreview.resolvedAt', 'Resolved'),
                  value: selectedWait.satisfiedAt
                    ? formatDateTime(selectedWait.satisfiedAt)
                    : t('caseWorkspace.execution.waitPreview.notYet', 'not yet'),
                },
              ],
            }}
          />
      ) : selectedProposal ? (
          <StandardPreview
            title={effectClassLabel(selectedProposal.effectClass, isPolish)}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: proposalStatusLabel(selectedProposal.status, isPolish), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedProposal.createdAt, t)}
                </span>
              ),
              recommendation: proposalRecommendation(selectedProposal.status, t),
            }}
            /*
             * Osiem przejść, DWIE trasy backendu: decyzja (`POST
             * /proposals/:id/decision`, tylko z `PENDING_REVIEW`) i cztery
             * przejścia bez decyzji — wyślij do przeglądu / ponów / cofnij
             * zatwierdzenie / oznacz jako nieudane (pakiet M2, `submit-for-
             * review`/`retry`/`revoke`/`transition-to-failed`). Jedna funkcja
             * (`proposalPreviewActions`, zdefiniowana nad tym komponentem)
             * gatuje WSZYSTKIE osiem 1:1 z `ALLOWED_TRANSITIONS` po stronie
             * serwisu — dla stanów bez wyjścia (EXECUTED/AUDITED/REJECTED/
             * REQUESTED_CHANGES/REVOKED) zwraca `undefined` i blok akcji po
             * prostu znika (`StandardPreview` renderuje go warunkowo).
             */
            actions={proposalPreviewActions(selectedProposal, setPending, t)}
            details={{
              text: t('caseWorkspace.execution.proposalPreview.detailsText', 'Action proposal submitted as part of this order.'),
              showWordCount: false,
              propertyLabel: t('caseWorkspace.execution.proposalPreview.propertyLabel', 'Property'),
              valueLabel: t('caseWorkspace.execution.proposalPreview.valueLabel', 'Value'),
              properties: [
                {
                  id: 'kto',
                  label: t('caseWorkspace.execution.proposalPreview.submittedBy', 'Submitted by'),
                  value:
                    selectedProposal.proposerType === 'HUMAN'
                      ? t('caseWorkspace.execution.proposalPreview.byHuman', 'Person')
                      : selectedProposal.proposerType === 'AGENT'
                        ? t('caseWorkspace.execution.proposalPreview.byAgent', 'AI assistant')
                        : t('caseWorkspace.execution.proposalPreview.bySystem', 'System'),
                },
                {
                  id: 'zgloszone',
                  label: t('caseWorkspace.execution.proposalPreview.submitted', 'Submitted'),
                  value: formatDateTime(selectedProposal.createdAt),
                },
                {
                  id: 'wazne',
                  label: t('caseWorkspace.execution.proposalPreview.validUntil', 'Valid until'),
                  value: selectedProposal.expiresAt
                    ? formatDateTime(selectedProposal.expiresAt)
                    : t('caseWorkspace.execution.proposalPreview.noExpiry', 'no expiry'),
                },
              ],
            }}
          />
      ) : selectedRun ? (
          <StandardPreview
            title={t('caseWorkspace.execution.runPreview.title', 'Run {{number}}', {
              number: runRows.find((r) => r.id === selectedRun.runId)?.numer ?? '',
            })}
            onClose={() => setSelection(null)}
            meta={{
              pills: [{ label: runStatusLabel(selectedRun.status, isPolish), tone: 'info' }],
              trailing: (
                <span className="text-xs text-c-text-muted">
                  {relativeDays(selectedRun.updatedAt, t)}
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
                        label: t('caseWorkspace.execution.actions.start', 'Start'),
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
                        label: t('caseWorkspace.execution.actions.pause', 'Pause'),
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
                        label: t('caseWorkspace.execution.actions.resume', 'Resume'),
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
                        label: t('caseWorkspace.execution.actions.cancelRun', 'Cancel run'),
                        icon: Ban,
                        onClick: () => setPending({ kind: 'run-cancel', run: selectedRun }),
                      },
                    ] satisfies StandardPreviewAction[])
                  : []),
              ],
            }}
            details={{
              text: t(
                'caseWorkspace.execution.runPreview.detailsText',
                "A run of this order's plan execution — a specific attempt at performing the steps in graph order.",
              ),
              showWordCount: false,
              propertyLabel: t('caseWorkspace.execution.runPreview.propertyLabel', 'Property'),
              valueLabel: t('caseWorkspace.execution.runPreview.valueLabel', 'Value'),
              properties: [
                {
                  id: 'stan',
                  label: t('caseWorkspace.execution.runPreview.status', 'Status'),
                  value: runStatusLabel(selectedRun.status, isPolish),
                },
                {
                  id: 'wynik',
                  label: t('caseWorkspace.execution.runPreview.outcomeAssessment', 'Outcome assessment'),
                  value: runOutcomeStatusLabelDisplay(selectedRun.outcomeStatus, isPolish),
                },
                {
                  id: 'wystartowal',
                  label: t('caseWorkspace.execution.runPreview.started', 'Started'),
                  value: selectedRun.startedAt
                    ? formatDateTime(selectedRun.startedAt)
                    : t('caseWorkspace.execution.runPreview.notYet', 'not yet'),
                },
                {
                  id: 'zakonczony',
                  label: t('caseWorkspace.execution.runPreview.completed', 'Completed'),
                  value: selectedRun.completedAt
                    ? formatDateTime(selectedRun.completedAt)
                    : t('caseWorkspace.execution.runPreview.notYet', 'not yet'),
                },
                {
                  id: 'zmieniony',
                  label: t('caseWorkspace.execution.runPreview.lastChange', 'Last change'),
                  value: formatDateTime(selectedRun.updatedAt),
                },
                ...(expert
                  ? [
                      {
                        id: 'run-id',
                        label: t('caseWorkspace.execution.runPreview.runId', 'Run identifier'),
                        value: <TechnicalId value={selectedRun.runId} title="runId" />,
                      },
                      {
                        id: 'graph-digest',
                        label: t('caseWorkspace.execution.runPreview.graphDigest', 'Graph fingerprint'),
                        value: <TechnicalId value={selectedRun.graphDigest} title="graphDigest" />,
                      },
                    ]
                  : []),
              ],
            }}
          />
      ) : null} />

      <CommandDialog
        open={pending !== null}
        title={dialogConfig(pending, isPolish, t).title}
        description={dialogConfig(pending, isPolish, t).description}
        confirmLabel={dialogConfig(pending, isPolish, t).confirmLabel}
        reason={dialogConfig(pending, isPolish, t).reason}
        busy={commandBusy}
        onConfirm={(value) => void runPendingCommand(value)}
        onCancel={closeDialog}
      />
    </div>
  );
};

/** Napis Run.outcomeStatus po polsku — patrz `enumLabels.runOutcomeStatusLabel`. */
function runOutcomeStatusLabelDisplay(value: CaseRun['outcomeStatus'], isPolish: boolean): string {
  return runOutcomeStatusLabel(value, isPolish);
}

/**
 * Treść okna potwierdzenia per rodzaj komendy — jedna funkcja, żeby tytuł/opis/
 * pole „powód" nie rozjeżdżały się między siedmioma miejscami wywołania.
 * `pending === null` zwraca neutralne wartości (dialog jest wtedy `open=false`
 * i tak nic nie renderuje) — bez tego `CommandDialog` dostawałby `undefined`
 * i TypeScript wymuszałby siedem osobnych warunków przy każdym propie.
 */
function dialogConfig(
  pending: PendingCommand | null,
  isPolish: boolean,
  t: TFunction
): {
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
          ? t('caseWorkspace.execution.decisionLabels.approve', 'Approve')
          : pending.decision === 'REJECT'
            ? t('caseWorkspace.execution.decisionLabels.reject', 'Reject')
            : pending.decision === 'REQUEST_CHANGES'
              ? t('caseWorkspace.execution.decisionLabels.requestChanges', 'Send back for changes')
              : t('caseWorkspace.execution.decisionLabels.defer', 'Defer');
      return {
        title: t('caseWorkspace.execution.dialog.decisionTitle', '{{decision}} this case?', {
          decision: decisionLabel,
        }),
        description: effectClassLabel(pending.proposal.effectClass, isPolish),
        confirmLabel: decisionLabel,
        reason: {
          label: t('caseWorkspace.execution.dialog.reasonOptional', 'Reason (optional)'),
          required: false,
          placeholder: t('caseWorkspace.execution.dialog.reasonOptionalPlaceholder', 'Short justification for the decision…'),
        },
      };
    }
    case 'proposal-submit':
      return {
        title: t('caseWorkspace.execution.dialog.submitTitle', 'Send this case to review?'),
        description: t(
          'caseWorkspace.execution.dialog.submitDescription',
          'The case moves from draft to the "Cases for approval" queue — you or another authorized person will be able to approve it, reject it, or send it back for changes.',
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.submitConfirm', 'Send for review'),
      };
    case 'proposal-retry':
      return {
        title: t('caseWorkspace.execution.dialog.retryTitle', 'Retry this case?'),
        description: t(
          'caseWorkspace.execution.dialog.retryDescription',
          'The case returns to the approved state and the system will try to perform the action again. The target will be re-checked — if it has gone stale in the meantime, the retry will be rejected.',
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.retryConfirm', 'Retry'),
      };
    case 'proposal-revoke':
      return {
        title: t('caseWorkspace.execution.dialog.revokeTitle', 'Revoke approval of this case?'),
        description: t(
          'caseWorkspace.execution.dialog.revokeDescription',
          "The approval stops being valid and the action will NOT be performed until someone approves it again. This operation can't be undone.",
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.revokeConfirm', 'Revoke approval'),
        reason: {
          label: t('caseWorkspace.execution.dialog.revokeReasonLabel', 'Reason for revoking'),
          required: true,
          placeholder: t('caseWorkspace.execution.dialog.revokeReasonPlaceholder', 'Why are you revoking this approval?'),
        },
      };
    case 'proposal-execute':
      return {
        title: t('caseWorkspace.execution.dialog.executeTitle', 'Start executing this case?'),
        description: t(
          'caseWorkspace.execution.dialog.executeDescription',
          'The approved action moves to execution. The state will only be shown after a confirming read from the server.',
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.executeConfirm', 'Start execution'),
      };
    case 'proposal-mark-failed':
      return {
        title: t('caseWorkspace.execution.dialog.markFailedTitle', 'Mark this case as failed?'),
        description: t(
          'caseWorkspace.execution.dialog.markFailedDescription',
          'The action currently being executed will be recorded as failed. You will be able to retry it later with the "Retry" button.',
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.markFailedConfirm', 'Mark as failed'),
        reason: {
          label: t('caseWorkspace.execution.dialog.failureReasonLabel', 'Reason for failure'),
          required: true,
          placeholder: t('caseWorkspace.execution.dialog.failureReasonPlaceholder', 'What went wrong?'),
        },
      };
    case 'wait-provide-input':
      return {
        title: t('caseWorkspace.execution.dialog.provideInputTitle', 'Provide data'),
        description: t(
          'caseWorkspace.execution.dialog.provideInputDescription',
          'The system is waiting for input from a person to move forward with this step. Enter the content that should be provided.',
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.provideInputConfirm', 'Send data'),
        reason: {
          label: t('caseWorkspace.execution.dialog.inputContentLabel', 'Input content'),
          required: true,
          placeholder: t('caseWorkspace.execution.dialog.inputContentPlaceholder', 'E.g. a decision, a number, a link to a document…'),
        },
      };
    case 'wait-cancel':
      return {
        title: t('caseWorkspace.execution.dialog.waitCancelTitle', 'Cancel this wait?'),
        description: t(
          'caseWorkspace.execution.dialog.waitCancelDescription',
          "The step will stop waiting for this signal. This operation can't be undone.",
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.waitCancelConfirm', 'Cancel wait'),
        reason: {
          label: t('caseWorkspace.execution.dialog.waitCancelReasonLabel', 'Reason for cancelling'),
          required: true,
          placeholder: t('caseWorkspace.execution.dialog.waitCancelReasonPlaceholder', 'Why are you cancelling this wait?'),
        },
      };
    case 'run-start':
      return {
        title: t('caseWorkspace.execution.dialog.runStartTitle', 'Start this run?'),
        description: t(
          'caseWorkspace.execution.dialog.runStartDescription',
          'The plan\'s entry steps will be created and the run will move to "Active". This operation can\'t be undone.',
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.runStartConfirm', 'Start'),
      };
    case 'run-pause':
      return {
        title: t('caseWorkspace.execution.dialog.runPauseTitle', 'Pause this run?'),
        description: t(
          'caseWorkspace.execution.dialog.runPauseDescription',
          'The run will stop advancing automatically until you resume it.',
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.runPauseConfirm', 'Pause'),
      };
    case 'run-resume':
      return {
        title: t('caseWorkspace.execution.dialog.runResumeTitle', 'Resume this run?'),
        description: t('caseWorkspace.execution.dialog.runResumeDescription', 'The run will return to "Active".'),
        confirmLabel: t('caseWorkspace.execution.dialog.runResumeConfirm', 'Resume'),
      };
    case 'run-cancel':
      return {
        title: t('caseWorkspace.execution.dialog.runCancelTitle', 'Cancel this run?'),
        description: t(
          'caseWorkspace.execution.dialog.runCancelDescription',
          "All pending steps of this run will be cancelled along with it. This operation can't be undone.",
        ),
        confirmLabel: t('caseWorkspace.execution.dialog.runCancelConfirm', 'Cancel run'),
        reason: {
          label: t('caseWorkspace.execution.dialog.runCancelReasonLabel', 'Reason for cancelling'),
          required: false,
          placeholder: t('caseWorkspace.execution.dialog.runCancelReasonPlaceholder', 'Why are you cancelling this run?'),
        },
      };
  }
}

export default RealizacjaView;
