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

import type { TFunction } from 'i18next';
import { AlertTriangle, CheckCircle2, ChevronRight, Pencil, RefreshCw, Undo2 } from 'lucide-react';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { StandardTable, type TableColumn } from '@/components/standard/StandardTable';
import { closureTypeLabel, planNodeTypeLabel, planVersionStatusLabel } from '@/utils/enumLabels';

import { getPlanVersion, updatePlanDraft } from './api';
import { layoutGraph, nodeLabel, PlanGraphCanvas } from './PlanGraphCanvas';
import type { CanonicalGraph, CaseCoreView, CasePlanVersion, PlanValidationResult } from './types';
import {
  CommandBanner,
  type CommandNotice,
  FactRow,
  FOCUS_RING,
  formatDateTime,
  StatusTag,
  TechnicalId,
  useRemainingHeight,
  useViewportWidth,
} from './ui';

export type PlanProjection = 'prosty' | 'ekspercki' | 'lista';

export function getPlanProjections(
  t: TFunction,
): Array<{ id: PlanProjection; label: string; description: string }> {
  return [
    {
      id: 'prosty',
      label: t('caseWorkspace.plan.projections.simpleLabel', 'Simple'),
      description: t('caseWorkspace.plan.projections.simpleDescription', 'Steps in order, without technical detail.'),
    },
    {
      id: 'ekspercki',
      label: t('caseWorkspace.plan.projections.expertLabel', 'Expert'),
      description: t('caseWorkspace.plan.projections.expertDescription', 'Flow canvas with technical identifiers.'),
    },
    {
      id: 'lista',
      label: t('caseWorkspace.plan.projections.listLabel', 'List'),
      description: t(
        'caseWorkspace.plan.projections.listDescription',
        'A table of steps — best on a phone and for screen readers.',
      ),
    },
  ];
}

export interface PlanViewProps {
  caseItem: CaseCoreView;
  planVersion: CasePlanVersion | null;
  graph: CanonicalGraph | null;
  validation: PlanValidationResult | null;
  projection: PlanProjection;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  /**
   * Wołane po UDANYM zapisie szkicu. Bez tego `CaseDetailScreen` trzyma swój
   * `bundle` z wersją planu sprzed edycji, więc „Zaproponuj"/„Publikuj"
   * kliknięte zaraz po zapisie wysyłają nieaktualny `expectedVersion` i dostają
   * 409 — bezpiecznie, bez uszkodzenia danych, ale użytkownik widzi błąd tam,
   * gdzie nic nie jest zepsute. Ten callback pozwala właścicielowi stanu
   * pobrać wersję autorytatywną. Opcjonalny, więc istniejący caller bez niego
   * nadal działa (tylko z tą samą szorstką krawędzią).
   */
  onDraftSaved?: () => void;
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

const EMPTY_GRAPH: CanonicalGraph = {
  entryNodeIds: [],
  terminalNodeIds: [],
  nodes: [],
  edges: [],
};

/**
 * Kopia robocza JEDNEGO semantycznego grafu, z której czytają wszystkie trzy
 * projekcje naraz (WARUNEK WŁAŚCICIELA: Prosty/Ekspercki/Lista to projekcje
 * jednego modelu, nie trzy osobne). `draftGraph` to jedyne miejsce, które
 * edycja modyfikuje; `graph` obok niego to ostatnia treść POTWIERDZONA przez
 * serwer (do porównania/odrzucenia zmian), nie duplikat modelu.
 */
interface PlanWorkingState {
  planVersion: CasePlanVersion;
  graph: CanonicalGraph;
  draftGraph: CanonicalGraph;
  dirty: boolean;
}

function graphFor(planVersion: CasePlanVersion, graphProp: CanonicalGraph | null): CanonicalGraph {
  return graphProp ?? planVersion.semanticGraph ?? EMPTY_GRAPH;
}

/** Opis reguły walidacji (lokalizowany). Kod techniczny pokazujemy tylko obok. */
function blockerText(code: string, detail: string, t: TFunction): string {
  const known: Record<string, string> = {
    plan_has_no_entry_node: t('caseWorkspace.plan.blockers.noEntryNode', 'The plan has no starting step.'),
    plan_has_no_terminal_node: t('caseWorkspace.plan.blockers.noTerminalNode', 'The plan has no final step.'),
    plan_node_unreachable: t(
      'caseWorkspace.plan.blockers.unreachableNode',
      "One of the steps can't be reached from the start of the plan.",
    ),
    plan_edge_target_missing: t(
      'caseWorkspace.plan.blockers.missingEdgeTarget',
      "An arrow leads to a step that isn't in the plan.",
    ),
    plan_required_input_unbound: t(
      'caseWorkspace.plan.blockers.unboundInput',
      "A step requires data that nothing provides to it.",
    ),
  };
  return (
    known[code] ??
    (detail?.trim() ? detail : t('caseWorkspace.plan.blockers.default', 'The plan needs a fix before it can be approved.'))
  );
}

export const PlanView: React.FC<PlanViewProps> = ({
  caseItem,
  planVersion,
  graph,
  validation,
  projection,
  selectedNodeId,
  onSelectNode,
  onDraftSaved,
}) => {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || '').toLowerCase().startsWith('pl');
  /*
   * ── EDYCJA SZKICU (`updatePlanDraft`) ─────────────────────────────────────
   *
   * Ten ekran wcześniej był WYŁĄCZNIE odczytem — nagłówek pliku to jeszcze
   * mówił wprost („ten ekran nie ma edytora grafu"). `updatePlanDraft` nie
   * miało żadnego realnego wywoływacza w `src/` (sprawdzone `grep`em po
   * całym drzewie, nie tylko po tym pliku) — packet M3 domyka tę lukę tutaj,
   * bo `CaseDetailScreen.tsx` jest poza zakresem tej zmiany (własność innego
   * pakietu równoległego).
   *
   * Ponieważ nie wolno dotykać rodzica, ekran NIE dostaje callbacku „odśwież
   * po zapisie" — musi sam być autorytatywny. `local` trzyma: ostatnią
   * POTWIERDZONĄ przez serwer treść (`planVersion`/`graph`) i KOPIĘ ROBOCZĄ
   * (`draftGraph`), z której czytają WSZYSTKIE TRZY projekcje poniżej — jeden
   * model, nie trzy. Efekt niżej przejmuje świeższe dane z propsów (rodzic
   * jednak gdzieś odświeżył — np. inna akcja w prawym panelu), ale NIGDY nie
   * cofa lokalnego stanu do starszej wersji niż ta, którą ekran już zna (np.
   * właśnie zapisaną tutaj).
   */
  const [local, setLocal] = useState<PlanWorkingState | null>(() =>
    planVersion ? { planVersion, graph: graphFor(planVersion, graph), draftGraph: graphFor(planVersion, graph), dirty: false } : null
  );
  const [editMode, setEditMode] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);
  const [notice, setNotice] = useState<CommandNotice | null>(null);

  useEffect(() => {
    setLocal((prev) => {
      if (!planVersion) return null;
      const nextGraph = graphFor(planVersion, graph);
      if (
        !prev ||
        prev.planVersion.casePlanVersionId !== planVersion.casePlanVersionId ||
        planVersion.version > prev.planVersion.version
      ) {
        return { planVersion, graph: nextGraph, draftGraph: nextGraph, dirty: false };
      }
      return prev;
    });
  }, [planVersion, graph]);

  // Zmiana WERSJI PLANU (nie tej samej wersji na nowo) zamyka edycję i czyści
  // komunikat — inaczej „Zapisz zmiany" z poprzedniego szkicu mogłoby zostać
  // aktywne nad zupełnie innym planem (np. po utworzeniu nowego szkicu w
  // panelu „Akcje" po prawej, poza zasięgiem tego pliku).
  const planVersionKey = planVersion?.casePlanVersionId ?? null;
  const prevPlanVersionKeyRef = useRef(planVersionKey);
  useEffect(() => {
    if (prevPlanVersionKeyRef.current !== planVersionKey) {
      prevPlanVersionKeyRef.current = planVersionKey;
      setEditMode(false);
      setNotice(null);
    }
  }, [planVersionKey]);

  // Mutowalny WYŁĄCZNIE gdy DRAFT — WARUNEK WŁAŚCICIELA #3: opublikowany plan
  // jest niezmienny, zmianę robi nowy szkic (istniejący przycisk w panelu
  // „Akcje"), nie edycja na miejscu. Serwer odrzuca to i tak (`updatePlanDraft`
  // → `plan_version_not_editable` → 409), ale ekran nie ma nawet pokazywać
  // przycisku, który zawsze by się nie udał.
  const canEdit = local?.planVersion.status === 'DRAFT';

  const updateNodeLabel = useCallback((nodeId: string, value: string) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const nextGraph: CanonicalGraph = {
        ...prev.draftGraph,
        nodes: prev.draftGraph.nodes.map((n) =>
          n.nodeId === nodeId ? { ...n, metadata: { ...(n.metadata ?? {}), label: value } } : n
        ),
      };
      return { ...prev, draftGraph: nextGraph, dirty: true };
    });
  }, []);

  const handleDiscard = useCallback(() => {
    setLocal((prev) => (prev ? { ...prev, draftGraph: prev.graph, dirty: false } : prev));
    setNotice(null);
  }, []);

  /**
   * `expectedVersion` = wersja, którą ekran ZNA w tej chwili (`local.planVersion.version`)
   * — nigdy zgadywana. Rozjazd z serwerem wraca jako `kind:'conflict'` (409,
   * polski komunikat już gotowy w `toCommandFailure`) i celowo NIE dotyka
   * `draftGraph` — użytkownik NIE traci wpisanych zmian, dostaje tylko
   * podpowiedź „Odśwież dane" zanim spróbuje ponownie.
   */
  const handleSave = useCallback(async () => {
    if (!local || !local.dirty || local.planVersion.status !== 'DRAFT') return;
    setSaveBusy(true);
    setNotice(null);
    const result = await updatePlanDraft(local.planVersion.casePlanVersionId, {
      semanticGraph: local.draftGraph,
      expectedVersion: local.planVersion.version,
    });
    setSaveBusy(false);
    if (!result.ok) {
      setNotice({
        tone: result.failure.kind === 'conflict' || result.failure.kind === 'invalid' ? 'warning' : 'critical',
        text: result.failure.message,
        refresh: result.failure.refreshSuggested,
      });
      return;
    }
    const savedGraph = graphFor(result.value, null);
    setLocal({ planVersion: result.value, graph: savedGraph, draftGraph: savedGraph, dirty: false });
    setNotice({
      tone: 'success',
      text:
        result.readback === 'confirmed'
          ? t('caseWorkspace.plan.header.savedDraft', 'Saved changes to the plan draft (version {{version}}).', {
              version: result.value.version,
            })
          : t(
              'caseWorkspace.plan.header.saveUnconfirmed',
              "The save was accepted, but the follow-up check with the server couldn't confirm the state. Refresh the data.",
            ),
      refresh: result.readback !== 'confirmed',
    });
    // Właściciel stanu (CaseDetailScreen) trzyma własny `bundle` z wersją planu
    // sprzed tego zapisu. Bez tego sygnału „Zaproponuj"/„Publikuj" kliknięte
    // zaraz po zapisie wysyłają nieaktualny `expectedVersion` i dostają 409.
    onDraftSaved?.();
  }, [local, onDraftSaved]);

  /**
   * WARUNEK WŁAŚCICIELA #5: odśwież = zawsze z serwera, nigdy z tego, co ekran
   * już myśli, że wie. Porzuca niezapisaną kopię roboczą świadomie — to jest
   * jawne działanie użytkownika, nie ciche nadpisanie w tle.
   */
  const handleRefresh = useCallback(async () => {
    const id = local?.planVersion.casePlanVersionId ?? planVersion?.casePlanVersionId;
    if (!id) return;
    setRefreshBusy(true);
    try {
      const fresh = await getPlanVersion(id);
      const freshGraph = graphFor(fresh, null);
      setLocal({ planVersion: fresh, graph: freshGraph, draftGraph: freshGraph, dirty: false });
      setNotice(null);
    } catch {
      setNotice({
        tone: 'critical',
        text: t('caseWorkspace.plan.header.refreshFailed', "Couldn't refresh the plan data from the server. Try again."),
      });
    } finally {
      setRefreshBusy(false);
    }
  }, [local, planVersion]);

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

  // JEDEN graf dla wszystkich trzech projekcji poniżej: kopia robocza, gdy
  // trwa edycja, ostatnia potwierdzona treść, gdy nie trwa (poza edycją
  // `draftGraph === graph`, więc to rozróżnienie nic nie zmienia w widoku).
  const effectiveGraph = local?.draftGraph ?? graph;
  const effectivePlanVersion = local?.planVersion ?? planVersion;

  const layout = useMemo(
    () => (effectiveGraph ? layoutGraph(effectiveGraph, isPolish) : { nodes: [], width: 0, height: 0 }),
    [effectiveGraph, isPolish]
  );

  const successorsById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of effectiveGraph?.edges ?? []) {
      map.set(edge.sourceNodeId, [...(map.get(edge.sourceNodeId) ?? []), edge.targetNodeId]);
    }
    return map;
  }, [effectiveGraph]);

  const predecessorsById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const edge of effectiveGraph?.edges ?? []) {
      map.set(edge.targetNodeId, [...(map.get(edge.targetNodeId) ?? []), edge.sourceNodeId]);
    }
    return map;
  }, [effectiveGraph]);

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
      <CommandBanner notice={notice} onRefresh={handleRefresh} onDismiss={() => setNotice(null)} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-c-text">
            {t('caseWorkspace.plan.header.goalHeading', "What we're aiming for")}
          </h2>
          <p className="mt-0.5 text-sm text-c-text-secondary">
            {caseItem.projectDescription?.trim() ||
              t('caseWorkspace.plan.header.goalUndescribed', 'The expected outcome has not been described in the project yet.')}
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
            {t('caseWorkspace.plan.header.closurePrefix', 'Closure: {{type}}', {
              type: closureTypeLabel(caseItem.contractedClosureType, isPolish),
            })}
          </StatusTag>
          {effectivePlanVersion ? (
            <StatusTag tone={effectivePlanVersion.status === 'PUBLISHED' ? 'success' : 'warning'}>
              {t('caseWorkspace.plan.header.planPrefix', 'Plan: {{status}} (version {{number}})', {
                status: planVersionStatusLabel(effectivePlanVersion.status, isPolish),
                number: effectivePlanVersion.planNumber,
              })}
            </StatusTag>
          ) : null}
          {editMode && local?.dirty ? (
            <StatusTag tone="warning">{t('caseWorkspace.plan.header.unsavedChanges', 'Unsaved changes')}</StatusTag>
          ) : null}
        </div>
      </div>

      {/*
       * Sterowanie edycją szkicu — WSPÓLNE dla trzech projekcji, bo działa na
       * TYM SAMYM `local.draftGraph`, niezależnie od tego, w której zakładce
       * użytkownik akurat jest. Widoczne tylko, gdy jest jakiś plan do
       * pokazania (`effectivePlanVersion`); przy DRAFT pokazuje edycję, przy
       * innym statusie tłumaczy WPROST, dlaczego edycji nie ma (WARUNEK
       * WŁAŚCICIELA #3 — opublikowany plan jest niezmienny).
       */}
      {effectivePlanVersion ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-c-border-subtle pt-3">
          {canEdit ? (
            editMode ? (
              <>
                <button
                  type="button"
                  data-testid="plan-zapisz"
                  disabled={!local?.dirty || saveBusy}
                  onClick={handleSave}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-c-border bg-c-surface-raised px-2.5 py-1.5 text-xs font-semibold text-c-text hover:bg-c-bg disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                >
                  {saveBusy
                    ? t('caseWorkspace.plan.header.saving', 'Saving…')
                    : t('caseWorkspace.plan.header.saveChanges', 'Save changes')}
                </button>
                <button
                  type="button"
                  data-testid="plan-odrzuc"
                  disabled={!local?.dirty || saveBusy}
                  onClick={handleDiscard}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
                >
                  <Undo2 size={13} aria-hidden />
                  {t('caseWorkspace.plan.header.discardChanges', 'Discard changes')}
                </button>
                <button
                  type="button"
                  onClick={() => setEditMode(false)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
                >
                  {t('caseWorkspace.plan.header.closeEditing', 'Close editing')}
                </button>
              </>
            ) : (
              <button
                type="button"
                data-testid="plan-edytuj"
                onClick={() => setEditMode(true)}
                className={`inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised ${FOCUS_RING}`}
              >
                <Pencil size={13} aria-hidden />
                {t('caseWorkspace.plan.header.editPlan', 'Edit plan')}
              </button>
            )
          ) : (
            <p className="text-xs text-c-text-muted">
              {effectivePlanVersion.status === 'PUBLISHED'
                ? t(
                    'caseWorkspace.plan.header.publishedImmutable',
                    'A published plan is immutable. To make changes, create a new draft in the "Actions" panel on the right.',
                  )
                : t(
                    'caseWorkspace.plan.header.notEditableHere',
                    "This plan version is no longer a draft — in-place editing isn't available here.",
                  )}
            </p>
          )}
          <button
            type="button"
            data-testid="plan-odswiez"
            onClick={handleRefresh}
            disabled={refreshBusy}
            className={`ml-auto inline-flex items-center gap-1.5 rounded-lg border border-c-border px-2.5 py-1.5 text-xs font-medium text-c-text-secondary hover:bg-c-surface-raised disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS_RING}`}
          >
            <RefreshCw size={13} aria-hidden className={refreshBusy ? 'animate-spin' : ''} />
            {refreshBusy ? t('caseWorkspace.plan.header.refreshing', 'Refreshing…') : t('caseWorkspace.plan.header.refresh', 'Refresh')}
          </button>
        </div>
      ) : null}

      {validation ? (
        <div className="mt-3 border-t border-c-border-subtle pt-3">
          {validation.valid ? (
            <p className="flex items-center gap-2 text-sm text-success-700 dark:text-success-300">
              <CheckCircle2 size={16} aria-hidden />
              {t('caseWorkspace.plan.header.validationPassed', 'The plan passed validation — nothing blocks approval.')}
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
                    {blockerText(blocker.code, blocker.detail, t)}
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

  if (!effectiveGraph || !layout.nodes.length) {
    return (
      <div className="min-w-0">
        {header}
        <div className="rounded-xl border border-c-border bg-c-surface p-8 text-center">
          <p className="text-sm font-medium text-c-text">
            {t('caseWorkspace.plan.empty.noStepsTitle', "This plan doesn't have any steps yet")}
          </p>
          <p className="mt-1 text-sm text-c-text-muted">
            {/*
             * ★ Dwa różne fakty pod jednym „pusto" (2026-08-12). Gdy `planVersion`
             * jest `null`, zlecenie NIE MA jeszcze żadnej wersji planu — jedyna
             * droga naprzód to panel „Akcje" po prawej („Utwórz szkic planu"),
             * nie czekanie, aż coś „powstanie samo". Gdy wersja ISTNIEJE, ale jej
             * graf jest pusty, to fakt o TEJ wersji, nie o braku planu w ogóle —
             * inny komunikat, żeby nie sugerować przycisku, który tu nie pomoże
             * (edycja tego ekranu zmienia TREŚĆ istniejących kroków — patrz
             * „Edytuj plan" w nagłówku wyżej — nie dodaje pierwszych kroków od
             * zera do pustego grafu).
             */}
            {effectivePlanVersion
              ? t('caseWorkspace.plan.empty.versionHasNoSteps', "This plan version doesn't have any saved steps yet.")
              : t(
                  'caseWorkspace.plan.empty.noVersionAtAll',
                  'The order doesn\'t have any plan version yet. Create the first draft in the "Actions" panel on the right.',
                )}
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
    /*
     * WARUNEK WŁAŚCICIELA: „Lista → edycja dostępna KLAWIATURĄ". `<input>` w
     * komórce jest domyślnie w kolejności Tab (natywny element, bez sztucznego
     * `tabIndex`) — nie potrzeba osobnego trybu ani modala. `onClick`
     * `stopPropagation()`, bo `<tr>` w `FilterableTable` ma własny
     * `onClick={() => onRowClick?.(row)}` (wybór wiersza) — bez tego klik w
     * pole wpisywało literę I zaznaczało/odznaczało krok naraz.
     */
    const isEditableList = editMode && canEdit;
    const stepLabelInput = (row: Record<string, unknown>, className: string) => (
      <input
        type="text"
        value={String(row.krok)}
        onChange={(event) => updateNodeLabel(String(row.id), event.target.value)}
        onClick={(event) => event.stopPropagation()}
        aria-label={t('caseWorkspace.plan.list.stepNameAria', 'Step name {{number}}', {
          number: String(row.kolejnosc ?? row.krok),
        })}
        className={`${className} rounded-md border border-c-border bg-c-bg px-1.5 py-0.5 ${FOCUS_RING}`}
      />
    );

    const columnsWide: TableColumn[] = [
      {
        id: 'krok',
        label: t('caseWorkspace.plan.list.step', 'Step'),
        width: '260px',
        sortable: true,
        render: (row: Record<string, unknown>) =>
          isEditableList ? (
            stepLabelInput(row, 'block w-full text-sm font-medium text-c-text')
          ) : (
            <span className="text-sm font-medium text-c-text">{String(row.krok)}</span>
          ),
      },
      {
        id: 'rodzaj',
        label: t('caseWorkspace.plan.list.who', 'Who does it'),
        width: '150px',
        filterable: true,
        sortable: true,
      },
      { id: 'poprzednik', label: t('caseWorkspace.plan.list.after', 'Comes after'), width: '180px' },
      { id: 'nastepnik', label: t('caseWorkspace.plan.list.leadsTo', 'Leads to'), width: '180px' },
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
        label: t('caseWorkspace.plan.list.stepAndOwner', 'Step and owner'),
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-xs tabular-nums text-c-text-muted">
                {String(row.kolejnosc)}.
              </span>
              {isEditableList ? (
                stepLabelInput(row, 'min-w-0 flex-1 text-sm font-medium leading-snug text-c-text')
              ) : (
                <span className="min-w-0 text-sm font-medium leading-snug text-c-text">
                  {String(row.krok)}
                </span>
              )}
            </div>
            <div className="pl-6 text-xs text-c-text-muted">{String(row.rodzaj)}</div>
          </div>
        ),
      },
      {
        id: 'nastepnik',
        label: t('caseWorkspace.plan.list.flow', 'Flow'),
        width: '240px',
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5 text-xs text-c-text-muted">
            <div>{t('caseWorkspace.plan.list.afterPrefix', 'After: {{value}}', { value: String(row.poprzednik) })}</div>
            <div>{t('caseWorkspace.plan.list.nextPrefix', 'Next: {{value}}', { value: String(row.nastepnik) })}</div>
          </div>
        ),
      },
    ];

    const columnsNarrow: TableColumn[] = [
      {
        id: 'krok',
        label: t('caseWorkspace.plan.list.stepsInOrder', 'Plan steps in order'),
        sortable: true,
        render: (row: Record<string, unknown>) => (
          <div className="min-w-0 space-y-0.5">
            <div className="flex items-baseline gap-2">
              <span className="shrink-0 text-xs tabular-nums text-c-text-muted">
                {String(row.kolejnosc)}.
              </span>
              {isEditableList ? (
                stepLabelInput(row, 'min-w-0 flex-1 text-sm font-medium leading-snug text-c-text')
              ) : (
                <span className="min-w-0 text-sm font-medium leading-snug text-c-text">
                  {String(row.krok)}
                </span>
              )}
            </div>
            <div className="pl-6 text-xs text-c-text-muted">{String(row.rodzaj)}</div>
            <div className="pl-6 text-xs text-c-text-muted">
              {t('caseWorkspace.plan.list.afterAndNext', 'After: {{after}} → Next: {{next}}', {
                after: String(row.poprzednik),
                next: String(row.nastepnik),
              })}
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
          .map((id) => labelById.get(id) ?? t('caseWorkspace.plan.list.unnamedStep', 'Unnamed step'))
          .join(', ') || t('caseWorkspace.plan.list.isStart', 'This is the start'),
      nastepnik:
        (successorsById.get(item.node.nodeId) ?? [])
          .map((id) => labelById.get(id) ?? t('caseWorkspace.plan.list.unnamedStep', 'Unnamed step'))
          .join(', ') || t('caseWorkspace.plan.list.isEnd', 'This is the end'),
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
            empty={{ title: t('caseWorkspace.plan.list.emptyTitle', 'The plan has no steps') }}
          />
        </div>
      </div>
    );
  }

  if (projection === 'prosty') {
    const isEditableProsty = editMode && canEdit;
    return (
      <div className="min-w-0">
        {header}
        <ol className="space-y-2">
          {layout.nodes.map((item, index) => {
            const isSelected = item.node.nodeId === selectedNodeId;
            const next = (successorsById.get(item.node.nodeId) ?? [])
              .map((id) => labelById.get(id) ?? t('caseWorkspace.plan.simple.unnamedStep', 'Unnamed step'))
              .join(', ');
            /*
             * WARUNEK WŁAŚCICIELA: „Prosty → edycja semantyczna". W trybie
             * edycji wiersz PRZESTAJE być jednym `<button>` — `<input>`
             * zagnieżdżony w `<button>` byłby nieprawidłowym HTML-em i łamał
             * klawiaturę (klik/Enter w polu aktywowałby też przycisk-rodzica).
             * Pole nazwy i przycisk „szczegóły" stoją obok siebie jako
             * RÓWNORZĘDNE elementy interaktywne — oba nadal w kolejności Tab.
             */
            if (isEditableProsty) {
              return (
                <li key={item.node.nodeId}>
                  <div
                    className={`flex w-full items-start gap-3 rounded-xl border bg-c-surface px-3 py-2.5 text-left ${
                      isSelected ? 'border-c-border-strong' : 'border-c-border'
                    }`}
                  >
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-c-surface-raised text-xs font-semibold tabular-nums text-c-text-secondary">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <label className="sr-only" htmlFor={`plan-prosty-label-${item.node.nodeId}`}>
                        {t('caseWorkspace.plan.simple.stepNameLabel', 'Step name {{number}}', { number: index + 1 })}
                      </label>
                      <input
                        id={`plan-prosty-label-${item.node.nodeId}`}
                        type="text"
                        value={item.label}
                        onChange={(event) => updateNodeLabel(item.node.nodeId, event.target.value)}
                        className={`block w-full rounded-md border border-c-border bg-c-bg px-2 py-1 text-sm font-medium text-c-text ${FOCUS_RING}`}
                      />
                      <span className="mt-1 block text-xs text-c-text-muted">
                        {item.typeLabel}
                        {next
                          ? t('caseWorkspace.plan.simple.nextPrefix', ' · next: {{value}}', { value: next })
                          : t('caseWorkspace.plan.simple.isEndSuffix', ' · this is the end')}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectNode(isSelected ? null : item.node.nodeId)}
                      aria-pressed={isSelected}
                      aria-label={t('caseWorkspace.plan.simple.stepDetailsAria', 'Step details: {{label}}', {
                        label: item.label || t('caseWorkspace.plan.simple.unnamedStepFallback', 'unnamed step'),
                      })}
                      className={`mt-0.5 shrink-0 rounded-lg p-1 text-c-text-muted hover:bg-c-surface-raised ${FOCUS_RING}`}
                    >
                      <ChevronRight size={16} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            }
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
                      {next
                        ? t('caseWorkspace.plan.simple.nextPrefix', ' · next: {{value}}', { value: next })
                        : t('caseWorkspace.plan.simple.isEndSuffix', ' · this is the end')}
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
          graph={effectiveGraph}
          selectedNodeId={selectedNodeId}
          onSelectNode={(id) => onSelectNode(id)}
        />
      </div>
      {selected ? (
        <div className="min-w-0 rounded-xl border border-c-border bg-c-surface p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            {/*
             * WARUNEK WŁAŚCICIELA: „Ekspercki → edycja semantyczna". To pole
             * pisze do TEGO SAMEGO `draftGraph` co „Prosty" i „Lista" —
             * `updateNodeLabel` jest jedną funkcją, wspólną dla całego pliku,
             * nie osobną kopią per projekcja. Zmiana widoczna na płótnie
             * natychmiast (węzeł czyta `nodeLabel()` z tego samego grafu).
             */}
            {editMode && canEdit ? (
              <div className="min-w-0 flex-1">
                <label
                  className="block text-xs font-medium uppercase tracking-wide text-c-text-muted"
                  htmlFor={`plan-ekspercki-label-${selected.node.nodeId}`}
                >
                  {t('caseWorkspace.plan.expert.stepNameLabel', 'Step name')}
                </label>
                <input
                  id={`plan-ekspercki-label-${selected.node.nodeId}`}
                  type="text"
                  value={selected.label}
                  onChange={(event) => updateNodeLabel(selected.node.nodeId, event.target.value)}
                  className={`mt-0.5 w-full rounded-md border border-c-border bg-c-bg px-2 py-1 text-sm font-semibold text-c-text ${FOCUS_RING}`}
                />
              </div>
            ) : (
              <h3 className="text-sm font-semibold text-c-text">{selected.label}</h3>
            )}
            <button
              type="button"
              onClick={() => onSelectNode(null)}
              className="rounded-lg px-2 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised focus:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              {t('caseWorkspace.plan.expert.closeDetails', 'Close details')}
            </button>
          </div>
          {/*
            WARUNEK WŁAŚCICIELA #5: surowe identyfikatory (`HUMAN_TASK`,
            `CAPABILITY`, nodeId) wolno pokazać WYŁĄCZNIE tutaj — w widoku
            eksperckim i zawsze OBOK polskiego wyjaśnienia, nigdy zamiast.
          */}
          <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
            <FactRow label={t('caseWorkspace.plan.expert.who', 'Who does it')}>
              {planNodeTypeLabel(String(selected.node.type ?? ''), isPolish)}
              <TechnicalId value={selected.node.type ? String(selected.node.type) : null} />
            </FactRow>
            <FactRow label={t('caseWorkspace.plan.expert.stepIdLabel', 'Step identifier')}>
              <span className="text-c-text-muted">{t('caseWorkspace.plan.expert.technicalName', 'technical name')}</span>
              <TechnicalId value={selected.node.nodeId} />
            </FactRow>
            {selected.node.effectClass ? (
              <FactRow label={t('caseWorkspace.plan.expert.changeKind', 'Type of change')}>
                {String(selected.node.effectClass)}
                <TechnicalId value={String(selected.node.effectClass)} />
              </FactRow>
            ) : null}
            <FactRow label={t('caseWorkspace.plan.expert.comesAfter', 'Comes after')}>
              {(predecessorsById.get(selected.node.nodeId) ?? [])
                .map((id) => labelById.get(id) ?? t('caseWorkspace.plan.expert.unnamedStep', 'Unnamed step'))
                .join(', ') || t('caseWorkspace.plan.expert.isStartOfPlan', 'This is the start of the plan')}
            </FactRow>
            <FactRow label={t('caseWorkspace.plan.expert.leadsTo', 'Leads to')}>
              {(successorsById.get(selected.node.nodeId) ?? [])
                .map((id) => labelById.get(id) ?? t('caseWorkspace.plan.expert.unnamedStep', 'Unnamed step'))
                .join(', ') || t('caseWorkspace.plan.expert.isEndOfPlan', 'This is the end of the plan')}
            </FactRow>
          </div>
        </div>
      ) : null}
      {effectivePlanVersion ? (
        <p className="text-xs text-c-text-muted">
          {t('caseWorkspace.plan.expert.versionFooter', 'Plan version {{number}} · last change {{date}}', {
            number: effectivePlanVersion.planNumber,
            date: formatDateTime(effectivePlanVersion.updatedAt),
          })}
          <TechnicalId
            value={effectivePlanVersion.graphDigest?.slice(0, 12)}
            title={t('caseWorkspace.plan.expert.graphDigestTitle', 'Plan graph fingerprint')}
          />
        </p>
      ) : null}
    </div>
  );
};

export default PlanView;
