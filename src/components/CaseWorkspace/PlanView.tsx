/**
 * Zlecenie → zakładka PLAN. Trzy projekcje JEDNEJ definicji planu:
 * „Prosty" (orientacja), „Ekspercki" (płótno + szczegóły techniczne),
 * „Lista" (odpowiednik mobilny i dostępnościowy — zawsze dostępny).
 *
 * Przełączenie projekcji zachowuje wybrany krok i wersję planu (jedziemy po
 * adresie: `?widok-planu=&krok=`), więc Wstecz wraca dokładnie tam, gdzie
 * użytkownik był.
 *
 * Lista kroków to EKRAN LISTOWY → `StandardTable`. Płótno to centrum
 * archetypu Canvas → własny komponent `PlanGraphCanvas` (kanon list go nie
 * dotyczy; kanon powłoki i podglądu — tak).
 */

import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import { closureTypeLabel, planNodeTypeLabel, planVersionStatusLabel } from '@/utils/enumLabels';

import { layoutGraph, nodeLabel, PlanGraphCanvas } from './PlanGraphCanvas';
import type { CanonicalGraph, CaseCoreView, CasePlanVersion, PlanValidationResult } from './types';
import {
  FactRow,
  formatDateTime,
  StatusTag,
  TechnicalId,
  useRemainingHeight,
  useViewportWidth,
} from './ui';

export type PlanProjection = 'prosty' | 'ekspercki' | 'lista';

export const PLAN_PROJECTIONS: Array<{ id: PlanProjection; label: string; description: string }> = [
  { id: 'prosty', label: 'Prosty', description: 'Kroki po kolei, bez szczegółów technicznych.' },
  {
    id: 'ekspercki',
    label: 'Ekspercki',
    description: 'Płótno przepływu z identyfikatorami technicznymi.',
  },
  {
    id: 'lista',
    label: 'Lista',
    description: 'Tabela kroków — najlepsza na telefonie i dla czytnika ekranu.',
  },
];

export interface PlanViewProps {
  caseItem: CaseCoreView;
  planVersion: CasePlanVersion | null;
  graph: CanonicalGraph | null;
  validation: PlanValidationResult | null;
  projection: PlanProjection;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

/**
 * Szerokość REALNIE dostępna dla tabeli — mierzona na jej karcie, nie na oknie.
 *
 * ★ DLACZEGO NIE `useViewportWidth()`, którego ten plik używał wcześniej.
 * ZMIERZONE na żywym ekranie zlecenia (łańcuch rodziców tabeli):
 *
 *     okno 768 px  → kontener tabeli 564 px
 *     okno 1024 px → kontener tabeli 284 px   ← WĘŻSZY niż przy 768!
 *     okno 1440 px → kontener tabeli 700 px
 *     okno 1920 px → kontener tabeli 876 px
 *
 * Przebieg nie jest monotoniczny, bo powyżej `lg` obok treści staje prawy pas
 * (~216 px), a całość i tak ogranicza `max-w-6xl` (1152 px). Próg liczony z
 * `window.innerWidth` musi się w takim układzie mylić — i mylił się: przy oknie
 * 1024 px „szeroki" zestaw 4 kolumn dostawał 284 px kontenera i chował 696 px
 * treści za przewijaniem WEWNĄTRZ tabeli, przy zupełnie czystym pomiarze strony
 * (`documentElement.scrollWidth === innerWidth === 1024`).
 *
 * Wniosek liczbowy, który wyznacza progi niżej: sufit dla tej tabeli to 876 px
 * (okno 1920 px). Wymuszane wcześniej 980 px NIE MIEŚCI SIĘ NIGDZIE na tym
 * ekranie — żadna szerokość okna go nie ratowała.
 *
 * (Miejsce docelowe tego hooka to `ui.tsx`, wspólny dla modułu — ten plik jest
 * poza zakresem tej zmiany, więc hook stoi na razie tutaj i w `RealizacjaView`.)
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

/** Suma szerokości kolumn zestawu pełnego (260+150+180+180). */
const PLAN_FULL_WIDTH = 770;

/** Polski opis reguły walidacji. Kod techniczny pokazujemy tylko obok. */
function blockerText(code: string, detail: string): string {
  const known: Record<string, string> = {
    plan_has_no_entry_node: 'Plan nie ma kroku początkowego.',
    plan_has_no_terminal_node: 'Plan nie ma kroku końcowego.',
    plan_node_unreachable: 'Do jednego z kroków nie da się dojść z początku planu.',
    plan_edge_target_missing: 'Strzałka prowadzi do kroku, którego nie ma w planie.',
    plan_required_input_unbound: 'Krok wymaga danych, których nikt mu nie przekazuje.',
  };
  return known[code] ?? (detail?.trim() ? detail : 'Plan wymaga poprawki przed zatwierdzeniem.');
}

export const PlanView: React.FC<PlanViewProps> = ({
  caseItem,
  planVersion,
  graph,
  validation,
  projection,
  selectedNodeId,
  onSelectNode,
}) => {
  // `narrow` zostaje WYŁĄCZNIE do wysokości płótna — tam pytanie brzmi „ile
  // miejsca ma okno w pionie", a to naprawdę jest cecha okna. O zestawie kolumn
  // decyduje pomiar kontenera (`listAvailableWidth`), nie ta flaga.
  const narrow = useViewportWidth() < 768;
  // Płótno eksperckie dostaje wysokość z POMIARU miejsca do dołu okna.
  // Hooki muszą stać przed wcześniejszymi `return` dla projekcji „lista"
  // i „prosty" — inaczej kolejność hooków zmienia się między renderami.
  const canvasSlotRef = useRef<HTMLDivElement | null>(null);
  // Karta tabeli kroków mierzy się sama — patrz `useAvailableWidth`.
  const listCardRef = useRef<HTMLDivElement | null>(null);
  const listAvailableWidth = useAvailableWidth(listCardRef);

  /*
   * Escape odznacza wybrany krok (zamyka „szczegóły kroku" w widoku eksperckim
   * i podświetlenie w pozostałych projekcjach). Bez tego jedynym wyjściem był
   * celowany klik w „Zamknij szczegóły" — ta sama luka co przy podglądzie w
   * Realizacji.
   *
   * Świadomie NIE przechwytuję Escape, gdy fokus jest w polu tekstowym albo w
   * otwartym oknie dialogowym — tam Escape ma już swoje znaczenie i odbieranie
   * go byłoby regresją.
   */
  useEffect(() => {
    if (!selectedNodeId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) {
        return;
      }
      onSelectNode(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedNodeId, onSelectNode]);
  // Na telefonie nad płótnem stoi więcej zawijanego tekstu, więc próg 320 px
  // znowu wypychał sterowanie poza ekran (zmierzone na 375×812: dół przycisku
  // 858 przy oknie 812, strona nie przewija się w pionie). Na wąskim ekranie
  // płótno jest widokiem pomocniczym — pełną treść planu daje „Lista" — więc
  // próg jest niższy, a sterowanie zawsze zostaje w zasięgu palca.
  const canvasHeight = useRemainingHeight(canvasSlotRef, {
    min: narrow ? 220 : 320,
    bottomGap: 16,
  });
  const layout = useMemo(
    () => (graph ? layoutGraph(graph) : { nodes: [], width: 0, height: 0 }),
    [graph]
  );

  const successorsById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graph?.edges ?? []) {
      map.set(edge.sourceNodeId, [...(map.get(edge.sourceNodeId) ?? []), edge.targetNodeId]);
    }
    return map;
  }, [graph]);

  const predecessorsById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of graph?.edges ?? []) {
      map.set(edge.targetNodeId, [...(map.get(edge.targetNodeId) ?? []), edge.sourceNodeId]);
    }
    return map;
  }, [graph]);

  const labelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of layout.nodes) map.set(item.node.nodeId, item.label);
    return map;
  }, [layout]);

  const selected = useMemo(
    () => layout.nodes.find((item) => item.node.nodeId === selectedNodeId) ?? null,
    [layout, selectedNodeId]
  );

  const header = (
    <div className="mb-4 rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-c-text">Do czego dążymy</h2>
          <p className="mt-0.5 text-sm text-c-text-secondary">
            {caseItem.projectDescription?.trim() ||
              'Oczekiwany rezultat nie został jeszcze opisany w projekcie.'}
          </p>
        </div>
        {/*
         * ★ ZMIERZONE NA 320 px, nie ocenione okiem: z `shrink-0` ten rząd
         * pigułek nie schodził poniżej swojej szerokości maksymalnej (370,8 px)
         * mimo `flex-wrap` — a `flex-wrap` zawija to, co JEST W ŚRODKU, dopiero
         * gdy zwęzi się KONTENER. Rodzic dawał 270 px, więc pigułka
         * „Plan: Zatwierdzony (wersja 3)" kończyła się na 395,8 px przy oknie
         * 320 px. Strona nie przewijała się w poziomie (pomiar `documentElement`
         * czysty), bo przepełnienie pochłaniał kontener modułu
         * (`flex-1 min-h-0 overflow-auto`) — czyli LITERA warunku #4 spełniona,
         * DUCH złamany: treść była ucięta, a poziome przewijanie schowane
         * wewnątrz modułu (zmierzone: scrollLeft 0 → 76).
         *
         * `min-w-0` + domyślne kurczenie: kontener zwęża się do dostępnych
         * 270 px, a `flex-wrap` robi wtedy to, po co tu jest — kładzie pigułki
         * w dwóch liniach. Na szerokim ekranie nic się nie zmienia, bo tam
         * miejsca nie brakuje.
         */}
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <StatusTag tone="neutral">
            Zamknięcie: {closureTypeLabel(caseItem.contractedClosureType, true)}
          </StatusTag>
          {planVersion ? (
            <StatusTag tone={planVersion.status === 'PUBLISHED' ? 'success' : 'warning'}>
              Plan: {planVersionStatusLabel(planVersion.status, true)} (wersja{' '}
              {planVersion.planNumber})
            </StatusTag>
          ) : null}
        </div>
      </div>

      {validation ? (
        <div className="mt-3 border-t border-c-border-subtle pt-3">
          {validation.valid ? (
            <p className="flex items-center gap-2 text-sm text-success-700 dark:text-success-300">
              <CheckCircle2 size={16} aria-hidden />
              Plan przeszedł sprawdzenie — nic nie blokuje zatwierdzenia.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {validation.blockers.map((blocker) => (
                <li
                  key={`${blocker.code}-${blocker.detail}`}
                  className="flex items-start gap-2 text-sm text-c-text"
                >
                  <AlertTriangle
                    size={16}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-danger-600 dark:text-danger-400"
                  />
                  <span className="min-w-0">
                    {blockerText(blocker.code, blocker.detail)}
                    {projection === 'ekspercki' ? <TechnicalId value={blocker.code} /> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );

  if (!graph || !layout.nodes.length) {
    return (
      <div className="min-w-0">
        {header}
        <div className="rounded-xl border border-c-border bg-c-surface p-8 text-center">
          <p className="text-sm font-medium text-c-text">Ten plan nie ma jeszcze kroków</p>
          <p className="mt-1 text-sm text-c-text-muted">
            {/*
             * ★ Dwa różne fakty pod jednym „pusto" (2026-08-12). Gdy `planVersion`
             * jest `null`, zlecenie NIE MA jeszcze żadnej wersji planu — jedyna
             * droga naprzód to panel „Akcje" po prawej („Utwórz szkic planu"),
             * nie czekanie, aż coś „powstanie samo". Gdy wersja ISTNIEJE, ale jej
             * graf jest pusty, to fakt o TEJ wersji, nie o braku planu w ogóle —
             * inny komunikat, żeby nie sugerować przycisku, który tu nie pomoże
             * (ten ekran nie ma edytora grafu — patrz nagłówek pliku).
             */}
            {planVersion
              ? 'Ta wersja planu nie ma jeszcze zapisanych kroków.'
              : 'Zlecenie nie ma jeszcze żadnej wersji planu. Utwórz pierwszy szkic w panelu „Akcje" po prawej.'}
          </p>
        </div>
      </div>
    );
  }

  if (projection === 'lista') {
    /*
     * ★ ZE ZRZUTU 375 px: przy czterech kolumnach telefon pokazywał wyłącznie
     * nazwę kroku — „kto to robi" i kierunek przepływu chowały się za poziomym
     * przewijaniem wewnątrz tabeli. A to jest WŁAŚNIE ta projekcja, która ma
     * być dostępną alternatywą płótna, więc kierunek przepływu musi być w niej
     * widoczny bez szukania. Na wąskim ekranie moduł deklaruje jedną kolumnę
     * z pełnym opisem kroku; `StandardTable` nadal odpowiada za wygląd.
     */
    const columnsWide: TableColumn[] = [
      {
        id: 'krok',
        label: 'Krok',
        width: '260px',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <span className="text-sm font-medium text-c-text">{String(row.krok)}</span>
        ),
      },
      { id: 'rodzaj', label: 'Kto to robi', width: '150px', filterable: true, sortable: true },
      { id: 'poprzednik', label: 'Po czym następuje', width: '180px' },
      { id: 'nastepnik', label: 'Prowadzi do', width: '180px' },
    ];

    /*
     * Zestaw POŚREDNI — dla kontenerów, w których cztery kolumny się nie
     * mieszczą, ale jedna marnuje miejsce (zmierzone: 564 px przy oknie 768 px,
     * 700 px przy oknie 1440 px). Dwie kolumny danych to dokładnie próg, przy
     * którym `minTableWidth="columns"` znosi wymuszone 980 px, więc tabela
     * zwęża się do kontenera zamiast chować kierunek przepływu.
     */
    const columnsMedium: TableColumn[] = [
      {
        id: 'krok',
        label: 'Krok i wykonawca',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-xs tabular-nums text-c-text-muted">
                {String(row.kolejnosc)}.
              </span>
              <span className="min-w-0 text-sm font-medium leading-snug text-c-text">
                {String(row.krok)}
              </span>
            </div>
            <div className="pl-6 text-xs text-c-text-muted">{String(row.rodzaj)}</div>
          </div>
        ),
      },
      {
        id: 'nastepnik',
        label: 'Przepływ',
        width: '240px',
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5 text-xs text-c-text-muted">
            <div>Po: {String(row.poprzednik)}</div>
            <div>Dalej: {String(row.nastepnik)}</div>
          </div>
        ),
      },
    ];

    const columnsNarrow: TableColumn[] = [
      {
        id: 'krok',
        label: 'Kroki planu po kolei',
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-xs tabular-nums text-c-text-muted">
                {String(row.kolejnosc)}.
              </span>
              <span className="min-w-0 text-sm font-medium leading-snug text-c-text">
                {String(row.krok)}
              </span>
            </div>
            <div className="pl-6 text-xs text-c-text-muted">{String(row.rodzaj)}</div>
            <div className="pl-6 text-xs text-c-text-muted">
              Po: {String(row.poprzednik)} → Dalej: {String(row.nastepnik)}
            </div>
          </div>
        ),
      },
    ];

    // Zestaw wybiera POMIAR kontenera, nie szerokość okna — uzasadnienie i
    // liczby przy `useAvailableWidth` na górze pliku.
    const tier =
      listAvailableWidth === null
        ? 'waski'
        : listAvailableWidth >= PLAN_FULL_WIDTH + 40
          ? 'pelny'
          : listAvailableWidth >= 460
            ? 'sredni'
            : 'waski';
    const columns =
      tier === 'pelny' ? columnsWide : tier === 'sredni' ? columnsMedium : columnsNarrow;
    const rows = layout.nodes.map((item, index) => ({
      id: item.node.nodeId,
      kolejnosc: index + 1,
      krok: item.label,
      rodzaj: item.typeLabel,
      poprzednik:
        (predecessorsById.get(item.node.nodeId) ?? [])
          .map((id) => labelById.get(id) ?? 'Krok bez nazwy')
          .join(', ') || 'To jest początek',
      nastepnik:
        (successorsById.get(item.node.nodeId) ?? [])
          .map((id) => labelById.get(id) ?? 'Krok bez nazwy')
          .join(', ') || 'To jest koniec',
    }));

    return (
      <div className="min-w-0">
        {header}
        <div
          ref={listCardRef}
          className="min-w-0 overflow-hidden rounded-xl border border-c-border bg-c-surface p-2 sm:p-3"
        >
          <StandardTable
            columns={columns}
            data={rows}
            selectedRowId={selectedNodeId}
            onRowClick={(row) => onSelectNode(String(row.id))}
            rowDescription={() => null}
            // Osobny klucz per zestaw: pstryczek kolumn zapamiętuje widoczność
            // po `id`, a te same identyfikatory znaczą co innego w każdym
            // zestawie (ukrycie kolumny na desktopie chowałoby jedyną kolumnę
            // telefonu).
            persistKey={`caseWorkspace.plan.steps.${tier}`}
            density="compact"
            /*
             * `'columns'` znosi min-width przy ≤2 kolumnach danych (zestaw wąski
             * i pośredni). Zestaw pełny deklaruje tyle, ile jego kolumny
             * NAPRAWDĘ potrzebują (770 px), a nie zapożyczone 980 px —
             * zmierzony sufit kontenera na tym ekranie to 876 px, więc 980 px
             * nie mieściło się przy ŻADNEJ szerokości okna (416/696/280/104 px
             * ukrytego przewijania przy 768/1024/1440/1920).
             */
            minTableWidth={tier === 'pelny' ? PLAN_FULL_WIDTH : 'columns'}
            empty={{ title: 'Plan nie ma kroków' }}
          />
        </div>
      </div>
    );
  }

  if (projection === 'prosty') {
    return (
      <div className="min-w-0">
        {header}
        <ol className="space-y-2">
          {layout.nodes.map((item, index) => {
            const isSelected = item.node.nodeId === selectedNodeId;
            const next = (successorsById.get(item.node.nodeId) ?? [])
              .map((id) => labelById.get(id) ?? 'Krok bez nazwy')
              .join(', ');
            return (
              <li key={item.node.nodeId}>
                <button
                  type="button"
                  onClick={() => onSelectNode(isSelected ? null : item.node.nodeId)}
                  aria-pressed={isSelected}
                  /*
                   * `motion-reduce:transition-none` — jedyne przejście w całej
                   * projekcji planu (kolor obramowania kroku). Płótno eksperckie
                   * NIE ma żadnej animacji ani przejścia (zmierzone na żywym
                   * ekranie: 0 elementów z niezerowym `transition-duration`/
                   * `animation-duration` wewnątrz `[role=application]`), więc
                   * cała projekcja „Plan" spełnia `prefers-reduced-motion`
                   * dopiero razem z tym wariantem — bez niego zostawałby jeden
                   * niezabezpieczony punkt.
                   */
                  className={`flex w-full items-start gap-3 rounded-xl border bg-c-surface px-3 py-2.5 text-left transition motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                    isSelected
                      ? 'border-c-border-strong'
                      : 'border-c-border hover:border-c-border-strong'
                  }`}
                >
                  <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-c-surface-raised text-xs font-semibold tabular-nums text-c-text-secondary">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-c-text">{item.label}</span>
                    <span className="mt-0.5 block text-xs text-c-text-muted">
                      {item.typeLabel}
                      {next ? ` · dalej: ${next}` : ' · to jest koniec'}
                    </span>
                  </span>
                  <ChevronRight size={16} aria-hidden className="mt-1 shrink-0 text-c-text-muted" />
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // ── Ekspercki ──────────────────────────────────────────────────────────────
  return (
    <div className="flex min-w-0 flex-col gap-3">
      {header}
      {/*
       * Wysokość ZMIERZONA, nie zgadnięta: płótno dostaje dokładnie tyle, ile
       * zostało do dołu okna. Poprzednie `h-[min(62vh,560px)]` wypychało dolny
       * pasek sterowania (powiększanie, „Dopasuj do ekranu") poza ekran, a
       * obszar treści nie przewija się w pionie — przyciski były nieklikalne.
       * Szczegóły pomiaru: `useRemainingHeight` w `ui.tsx`.
       */}
      {/*
       * BEZ `min-h-[320px]`: klasa Tailwinda ustawia `min-height`, które
       * WYGRYWA z wyliczoną `height` i przywracało dokładnie ten defekt na
       * telefonie (zmierzone: wysokość wracała do 318 px, dół przycisku 858
       * przy oknie 812). Dolny próg pilnuje wyłącznie `useRemainingHeight`,
       * żeby istniała jedna reguła wysokości, a nie dwie sprzeczne.
       */}
      <div ref={canvasSlotRef} className="min-w-0" style={{ height: `${canvasHeight ?? 320}px` }}>
        <PlanGraphCanvas
          graph={graph}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => onSelectNode(id)}
        />
      </div>
      {selected ? (
        <div className="min-w-0 rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-sm font-semibold text-c-text">{selected.label}</h3>
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="rounded-lg px-2 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              Zamknij szczegóły
            </button>
          </div>
          {/*
            WARUNEK WŁAŚCICIELA #5: surowe identyfikatory (`HUMAN_TASK`,
            `CAPABILITY`, nodeId) wolno pokazać WYŁĄCZNIE tutaj — w widoku
            eksperckim i zawsze OBOK polskiego wyjaśnienia, nigdy zamiast.
          */}
          <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <FactRow label="Kto to robi">
              {planNodeTypeLabel(String(selected.node.type ?? ''), true)}
              <TechnicalId value={selected.node.type ? String(selected.node.type) : null} />
            </FactRow>
            <FactRow label="Identyfikator kroku">
              <span className="text-c-text-muted">nazwa techniczna</span>
              <TechnicalId value={selected.node.nodeId} />
            </FactRow>
            {selected.node.effectClass ? (
              <FactRow label="Rodzaj zmiany">
                {String(selected.node.effectClass)}
                <TechnicalId value={String(selected.node.effectClass)} />
              </FactRow>
            ) : null}
            <FactRow label="Po czym następuje">
              {(predecessorsById.get(selected.node.nodeId) ?? [])
                .map((id) => labelById.get(id) ?? 'Krok bez nazwy')
                .join(', ') || 'To jest początek planu'}
            </FactRow>
            <FactRow label="Prowadzi do">
              {(successorsById.get(selected.node.nodeId) ?? [])
                .map((id) => labelById.get(id) ?? 'Krok bez nazwy')
                .join(', ') || 'To jest koniec planu'}
            </FactRow>
          </div>
        </div>
      ) : null}
      {planVersion ? (
        <p className="text-xs text-c-text-muted">
          Wersja planu {planVersion.planNumber} · ostatnia zmiana{' '}
          {formatDateTime(planVersion.updatedAt)}
          <TechnicalId value={planVersion.graphDigest?.slice(0, 12)} title="Odcisk grafu planu" />
        </p>
      ) : null}
    </div>
  );
};

export default PlanView;
