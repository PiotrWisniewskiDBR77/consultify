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

import { Clock, Inbox } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { StandardPreview } from '@/components/standard/StandardPreview';
import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import {
  caseStatusLabel,
  caseWaitStatusLabel,
  caseWaitTypeLabel,
  effectClassLabel,
  proposalStatusLabel,
} from '@/utils/enumLabels';

import { listNodeResultAcceptancesForCase } from './apiResults';
import type { CaseActionProposal, CaseCoreView, CaseHistoryEvent, CaseWait } from './types';
import { formatDateTime, relativeDays, StatusTag, TechnicalId } from './ui';

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
  history: CaseHistoryEvent[];
  /** Widok ekspercki = wolno pokazać identyfikatory techniczne obok polskiego opisu. */
  expert?: boolean;
}

type Selection = { kind: 'oczekiwanie'; id: string } | { kind: 'propozycja'; id: string } | null;

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
  history,
  expert,
}) => {
  const [selection, setSelection] = useState<Selection>(null);
  const wynikiKrokow = useWynikiKrokowLiczby(caseItem.caseId);

  // Karty obu tabel mierzą się SAME — patrz `useAvailableWidth`. Dwa osobne
  // pomiary, bo obie karty mogą kiedyś stanąć w różnych kolumnach układu.
  const waitsCardRef = useRef<HTMLDivElement | null>(null);
  const proposalsCardRef = useRef<HTMLDivElement | null>(null);
  const waitsAvailableWidth = useAvailableWidth(waitsCardRef);
  const proposalsAvailableWidth = useAvailableWidth(proposalsCardRef);

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

  const waitTier = tierFor(waitsAvailableWidth, WAITS_FULL_WIDTH);
  const proposalTier = tierFor(proposalsAvailableWidth, PROPOSALS_FULL_WIDTH);
  const waitColumns = waitColumnsByTier[waitTier];
  const proposalColumns = proposalColumnsByTier[proposalTier];

  const selectedWait =
    selection?.kind === 'oczekiwanie'
      ? (waits.find((w) => w.waitId === selection.id) ?? null)
      : null;
  const selectedProposal =
    selection?.kind === 'propozycja'
      ? (proposals.find((p) => p.actionProposalId === selection.id) ?? null)
      : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-4">
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
      ) : null}
    </div>
  );
};

export default RealizacjaView;
