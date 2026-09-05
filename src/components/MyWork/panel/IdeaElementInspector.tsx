import { Loader2, Sparkles, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { setCanvasAnalysisSlot } from './canvasAnalysisSlot';

import {
  ArtifactRightPanel,
  type ArtifactRightPanelSection,
} from '@/components/standard/ArtifactRightPanel';
import { statusChipLabel } from '@/components/ui/primitives/chips/EntityStatusChip';

export type IdeaInspectorTool = 'mindmap' | 'process' | 'whiteboard' | 'table';

/** Zakładki JEDNEGO prawego panelu warsztatu Pomysłów (decyzja CTO 2026-09-05). */
export type IdeaInspectorTab = 'element' | 'teresa';

export interface IdeaInspectorItem {
  id?: string;
  title: string;
  type?: string;
  source?: string;
  date?: string;
  branch?: string;
  status?: string;
  targetId?: string;
}

export interface IdeaInspectorElement {
  id: string;
  label: string;
  state?: string;
  priority?: number;
  owner?: string;
  semanticType?: string;
  description?: string;
  context?: string;
  goal?: string;
  rationale?: string;
  risk?: string;
  tags?: string[];
  evidence?: IdeaInspectorItem[];
  relations?: IdeaInspectorItem[];
  outputs?: IdeaInspectorItem[];
  branch?: string;
  lineage?: string;
  savedAt?: string | number | Date | null;
}

export interface IdeaInspectorActivityItem {
  id: string;
  action: 'created' | 'edited' | 'comment' | 'attachment' | 'status_change' | 'ai_suggestion';
  field?: string;
  oldValue?: string;
  newValue?: string;
  author: string;
  createdAt: string;
}

export interface IdeaElementInspectorProps {
  element: IdeaInspectorElement | null;
  tool: IdeaInspectorTool;
  toolSection?: React.ReactNode;
  nativeStates?: readonly string[];
  recentItems?: IdeaInspectorItem[];
  onOpenRecent?: (id: string) => void;
  onOpenOutput?: (targetId: string) => void;
  onSave?: (patch: Partial<IdeaInspectorElement>) => Promise<IdeaInspectorElement>;
  onReturnToCanvas?: () => void;
  language?: 'pl' | 'en';
  /**
   * RowDetailPanel parity (P0, 2026-08-26 — STOP `f864a060f0`, day 3): the old
   * Table detail panel had six tabs (Properties/Comments/Attachments/Activity/
   * AI Insights/Drawing). This is the "Historia i AI" 8th section the accepted
   * prototype (`mywork-inspektor-prototyp.html`, Question 1 — picked variant)
   * specifies for Activity + AI — the two RowDetailPanel tabs this build
   * closes. Comments/Attachments/Drawing are NOT part of `MYW-IDEAS-CORE-002`
   * (the owner atom this component implements) or of the accepted prototype's
   * 8-section list, so they stay out of this component; see the parity
   * evidence log for that decision trail.
   */
  activity?: IdeaInspectorActivityItem[];
  aiInsights?: string[];
  aiLoading?: boolean;
  onGenerateInsights?: () => void;
  /**
   * ★ JEDEN PRAWY PANEL (decyzja CTO 2026-09-05). Teresa NIGDY nie jest drugą
   * kolumną obok tego panelu — gdy gospodarz poda `teresaContent`, panel
   * dostaje w nagłówku dwie zakładki („Element" | „Teresa") i pokazuje w
   * swoim ciele albo element, albo rozmowę. Bez tego propsa nagłówek nie ma
   * zakładek i komponent renderuje się 1:1 jak wcześniej.
   */
  teresaContent?: React.ReactNode;
  /** Aktywna zakładka (sterowana przez gospodarza). Domyślnie 'element'. */
  activeTab?: IdeaInspectorTab;
  onTabChange?: (tab: IdeaInspectorTab) => void;
  /**
   * Zamknięcie CAŁEGO panelu (X w nagłówku). Gdy podane, X zamyka panel;
   * gdy nie — X zachowuje dotychczasowe znaczenie (`onReturnToCanvas`).
   */
  onClosePanel?: () => void;
  /**
   * Gdy `true`, panel wystawia gniazdo na karty „Analiza płótna" (sekcja
   * „Akcje"). Karty trafiają tam portalem — patrz `canvasAnalysisSlot.ts`.
   */
  showCanvasAnalysis?: boolean;
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
// FIX-11 (Day 3 acceptance): strip internal id-slugs too (e.g. "initiative-1",
// "node-1699999999-ab12cd") — not just full UUIDs — so a raw targetId/nodeId
// that leaks into a text field never renders verbatim in the inspector.
const SLUG = /\b[a-z]+-\d+(?:-[a-z0-9]+)*\b/gi;
const safeText = (value?: string) => (value ?? '').replace(UUID, '').replace(SLUG, '').trim();

/**
 * ★ NAPRAWA 2026-09-05 (uwaga właściciela — odbiór na żywo `mywork-idea-
 * inspector-lekki`): the DEC-68 bespoke accordion (`InspectorSection`/
 * `CountHeading`, custom h3 headings + own collapse state) is retired in
 * favor of the SAME canonical accordion every other artifact panel uses —
 * `ArtifactRightPanel` (SPEC-A, `ARTIFACT_PANEL_SECTION_ORDER`: Akcje ·
 * Właściwości · Powiązania · Źródła i założenia · Komentarze · Historia).
 * The owner's approved reference screenshot for this exact screen (round 3,
 * `evidence/grafika/odbior-302-303-20260904/302-flaga-on/
 * mywork-idea-inspector-lekki__PO__pl__1440__light.png`) is byte-identical to
 * `ideas-teresa-panel`'s screenshot — both rendered the same
 * `IdeaNotebookRightPanelPrototype` fallback (Akcje/Udostępnij·Kopiuj link,
 * Właściwości, Powiązania, Źródła i założenia, Komentarze, Historia — every
 * mandatory canon section, `showZeroBadge` counts). That six-section shell
 * (not the old eight custom sections) is the approved composition. The
 * `sections` array built just before this component's `return` (below the
 * empty-state early return) is the field→section mapping; the element's own
 * `description` is promoted out of "Treść i głębia" and into a new block at
 * the very top of the header instead (owner: "dodać opis problemu … na
 * górze nowego panelu") — see the comment next to that block.
 */

/**
 * Quiet field row: 104px muted label + value/control. No box, no default border.
 *
 * `stacked` układa etykietę NAD polem (pole na pełną szerokość pasa).
 *
 * ★ POWÓD ISTNIENIA `stacked` (2026-09-01, dyżur 164 — ujednolicenie szerokości
 * prawego pasa do 320 px). Zmierzone na żywym renderze: w układzie dwukolumnowym
 * pole wartości ma 210 px przy pasie 360 px i 170 px przy pasie 320 px. Pole
 * „Etykieta" trzyma TYTUŁ elementu — przykładowy tytuł zajmował 207 px, więc
 * mieścił się przy 360 px o TRZY PIKSELE, a przy 320 px zaczynał się ucinać.
 * To jedyne miejsce w całej rodzinie prawych paneli, gdzie 320 px cokolwiek
 * ucinało. Rozwiązanie jest UKŁADEM TREŚCI, nie wyjątkiem od szerokości:
 * pole tożsamości dostaje własny wiersz na pełną szerokość (≈288 px), czyli
 * WIĘCEJ miejsca niż miało kiedykolwiek wcześniej.
 */
const FieldRow: React.FC<{ label: string; children: React.ReactNode; stacked?: boolean }> = ({
  label,
  children,
  stacked = false,
}) =>
  stacked ? (
    <div className="py-1">
      <span className="block pb-0.5 text-xs leading-relaxed text-c-text-muted">{label}</span>
      <div className="min-w-0 text-[12.5px] leading-relaxed text-c-text">{children}</div>
    </div>
  ) : (
    <div className="flex items-start gap-3 py-1">
      <span className="w-[104px] shrink-0 pt-px text-xs leading-relaxed text-c-text-muted">
        {label}
      </span>
      <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-c-text">{children}</div>
    </div>
  );

/** Quiet control classes shared by inputs/selects/textareas (border only on hover/focus). */
const quietControlClass =
  '-mx-1.5 w-full rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-[12.5px] text-c-text transition-colors hover:border-c-border-subtle hover:bg-c-surface-raised focus:border-c-border focus:bg-c-surface focus:outline-none';

export const IdeaElementInspector: React.FC<IdeaElementInspectorProps> = ({
  element,
  tool,
  toolSection,
  nativeStates = [],
  recentItems,
  onOpenRecent,
  onOpenOutput,
  onSave,
  onReturnToCanvas,
  language = 'pl',
  activity,
  aiInsights,
  aiLoading = false,
  onGenerateInsights,
  teresaContent,
  activeTab = 'element',
  onTabChange,
  onClosePanel,
  showCanvasAnalysis = false,
}) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(element);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<Date | null>(() =>
    element?.savedAt ? new Date(element.savedAt) : null
  );
  const rootRef = useRef<HTMLElement>(null);
  React.useEffect(() => {
    setDraft(element);
    setConfirmedAt(element?.savedAt ? new Date(element.savedAt) : null);
    setSaveError(null);
  }, [element]);

  const commit = async (patch: Partial<IdeaInspectorElement>) => {
    if (!draft || !onSave) return;
    setSaving(true);
    setSaveError(null);
    try {
      const readback = await onSave(patch);
      setDraft(readback);
      setConfirmedAt(new Date());
    } catch {
      setSaveError(t('myWork.ideaInspector.saveFailed', 'Nie udało się zapisać zmian'));
    } finally {
      setSaving(false);
    }
  };

  const counts = useMemo(
    () => ({
      // FIX-11: "Podstawowe"/"Treść i głębia" no longer report a hardcoded 1/5 —
      // count only the fields that actually rendered in each section.
      basics: draft ? (draft.owner ? 1 : 0) + (draft.semanticType ? 1 : 0) + 1 : 0,
      content: [
        draft?.description,
        draft?.context,
        draft?.goal,
        draft?.rationale,
        draft?.risk,
      ].filter(Boolean).length,
      evidence: draft?.evidence?.length ?? 0,
      relations: draft?.relations?.length ?? 0,
      outputs: draft?.outputs?.length ?? 0,
    }),
    [draft]
  );
  // ArtifactRightPanel's canonical "Powiązania" section (SPEC-A) has no
  // separate slot for "Artefakty wyjściowe" — outputs (converted artifacts)
  // are a kind of relation, so they render inside the same section (badge
  // counts both) instead of inventing a 7th accordion the approved
  // composition does not have.
  const relationsTotal = counts.relations + counts.outputs;
  // "Treść i głębia" minus `description` — the description now renders as
  // the "opis problemu" block at the very top of the panel (owner's note,
  // 2026-09-05), so it is not repeated lower down.
  const depthParagraphs = [draft?.context, draft?.goal, draft?.rationale, draft?.risk].filter(
    (text): text is string => Boolean(text)
  );

  const historyAiCount = (activity?.length ?? 0) + (aiInsights?.length ?? 0);

  const formatActivityTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return `${d.toLocaleDateString(language)} ${d.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}`;
    } catch {
      return iso;
    }
  };

  const activityLabel = (item: IdeaInspectorActivityItem) => {
    switch (item.action) {
      case 'comment':
        return t('myWork.ideaInspector.activity.commented', 'skomentował(a)');
      case 'edited':
        return t('myWork.ideaInspector.activity.edited', 'zmienił(a) {{field}}', {
          field: item.field ?? '',
        });
      case 'attachment':
        return t('myWork.ideaInspector.activity.addedAttachment', 'dodał(a) załącznik');
      case 'status_change':
        return t('myWork.ideaInspector.activity.changedStatus', 'zmienił(a) stan: {{oldValue}} → {{newValue}}', {
          oldValue: item.oldValue,
          newValue: item.newValue,
        });
      case 'ai_suggestion':
        return t('myWork.ideaInspector.activity.aiSuggested', 'AI zasugerowało');
      default:
        return t('myWork.ideaInspector.activity.created', 'utworzył(a)');
    }
  };

  const toolTitle = t(
    `myWork.ideaInspector.tool.${tool}`,
    {
      mindmap: 'Wygląd węzła',
      process: 'Krawędź i tor',
      whiteboard: 'Sesja warsztatu',
      table: 'Kolumna',
    }[tool]
  );

  /**
   * ★ JEDEN PRAWY PANEL — powłoka wspólna (decyzja CTO 2026-09-05).
   * Nagłówek panelu niesie zakładki („Element" | „Teresa") i jeden X. Ta sama
   * powłoka opakowuje WSZYSTKIE trzy ciała panelu (Teresa · stan pusty ·
   * element), żeby zakładka „Teresa" była dostępna także wtedy, gdy nic nie
   * jest zaznaczone — inaczej użytkownik bez zaznaczenia nie miałby jak
   * otworzyć rozmowy i wróciłaby druga kolumna.
   */
  const zakladkaAktywna: IdeaInspectorTab = teresaContent ? activeTab : 'element';
  const zakladki = teresaContent ? (
    <div
      role="tablist"
      aria-label={t('myWork.ideaInspector.tabs.aria', 'Zakładki panelu')}
      className="inline-flex items-center gap-0.5 rounded-full bg-c-surface-raised p-0.5"
    >
      {(
        [
          { id: 'element' as const, label: t('myWork.ideaInspector.tabs.element', 'Element') },
          { id: 'teresa' as const, label: t('myWork.ideaInspector.tabs.teresa', 'Teresa') },
        ] as const
      ).map((tab) => {
        const aktywna = zakladkaAktywna === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={aktywna}
            data-testid={`idea-panel-tab-${tab.id}`}
            onClick={() => onTabChange?.(tab.id)}
            className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)] ${
              aktywna
                ? 'bg-c-surface text-c-text shadow-sm'
                : 'text-c-text-secondary hover:text-c-text'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  ) : null;
  const zamknijPanel = onClosePanel ?? onReturnToCanvas;
  const przyciskZamknij = zamknijPanel ? (
    <button
      type="button"
      onClick={zamknijPanel}
      data-testid="idea-panel-close"
      aria-label={
        onClosePanel
          ? t('myWork.ideaInspector.closePanel', 'Zamknij panel')
          : t('myWork.ideaInspector.close', 'Zamknij inspektor')
      }
      className="shrink-0 rounded-md p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--c-focus)]"
    >
      <X size={15} />
    </button>
  ) : null;
  const powlokaNaglowka =
    zakladki || przyciskZamknij ? (
      <div className="flex items-center gap-2 border-b border-c-border-subtle px-3 py-2">
        {zakladki}
        <span className="flex-1" />
        {przyciskZamknij}
      </div>
    ) : null;
  /**
   * Gniazdo kart „Analiza płótna". Renderowane DOKŁADNIE RAZ (tylko jedna z
   * trzech ścieżek `return` niżej się wykonuje), więc rejestr zawsze wskazuje
   * jeden żywy węzeł. W zakładce „Teresa" gniazdo jest ukryte (`hidden`), ale
   * obecne — dzięki temu przełączenie zakładki nie gubi kart ani nie wypycha
   * ich z powrotem na płótno.
   */
  const gniazdoAnalizy = showCanvasAnalysis ? (
    <div
      ref={setCanvasAnalysisSlot}
      data-testid="idea-canvas-analysis-slot"
      className="flex flex-col gap-2"
    />
  ) : null;
  const wspolneAtrybutyKorzenia = {
    className: 'flex h-full w-full flex-col bg-c-surface text-c-text',
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Escape') onReturnToCanvas?.();
    },
  };

  if (teresaContent && zakladkaAktywna === 'teresa') {
    return (
      <aside
        ref={rootRef}
        {...wspolneAtrybutyKorzenia}
        aria-label={t('myWork.ideaInspector.ariaPanel', 'Panel pomysłu')}
        data-testid="idea-right-panel"
      >
        {powlokaNaglowka}
        <div className="min-h-0 flex-1 overflow-hidden">{teresaContent}</div>
        {gniazdoAnalizy ? <div hidden>{gniazdoAnalizy}</div> : null}
      </aside>
    );
  }

  if (!draft) {
    const emptyText = t('myWork.ideaInspector.empty', 'Zaznacz element, aby zobaczyć właściwości');
    return (
      <aside
        ref={rootRef}
        {...wspolneAtrybutyKorzenia}
        aria-label={emptyText}
        data-testid="idea-right-panel"
      >
        {powlokaNaglowka}
        <div className="m-auto max-w-xs p-6 text-center">
          <p className="font-medium text-c-text">{emptyText}</p>
          <p className="mt-1 text-sm text-c-text-secondary">
            {t('myWork.ideaInspector.emptyHint', 'Kliknij węzeł, wiersz, kartkę albo krawędź')}
          </p>
          {recentItems?.length ? (
            <section className="mt-6 text-left" aria-labelledby="idea-recent-title">
              <h3
                id="idea-recent-title"
                className="text-xs font-semibold uppercase text-c-text-secondary"
              >
                {t('myWork.ideaInspector.recent', 'Ostatnio otwarte')}
              </h3>
              <ul className="mt-2 space-y-1">
                {recentItems.slice(0, 3).map((item) => (
                  <li key={item.id ?? item.title}>
                    <button
                      className="w-full rounded p-2 text-left text-sm hover:bg-c-surface-raised"
                      onClick={() => item.id && onOpenRecent?.(item.id)}
                    >
                      <span className="block text-c-text">{safeText(item.title)}</span>
                      <span className="text-xs text-c-text-secondary">
                        {safeText(item.type)} {safeText(item.date)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
        {/* Analiza płótna dotyczy CAŁEGO płótna, nie zaznaczenia — pokazujemy
            ją także wtedy, gdy nic nie jest zaznaczone. */}
        {gniazdoAnalizy ? <div className="px-4 pb-4">{gniazdoAnalizy}</div> : null}
      </aside>
    );
  }

  /**
   * SPEC-A canon body — six mandatory sections, exact order (Akcje ·
   * Właściwości · Powiązania · Źródła i założenia · Komentarze · Historia),
   * `ArtifactRightPanel` enforces label/order/icon for every id below; only
   * `children`/`badge`/`isEmpty` are this component's job. See the note above
   * `FieldRow` for why this replaces the old bespoke 8-section accordion.
   */
  const sections: ArtifactRightPanelSection[] = [
    {
      id: 'actions',
      label: t('myWork.ideaInspector.sections.actions', 'Akcje'),
      defaultOpen: true,
      // ★ 2026-09-05: sekcja przestaje być pusta, gdy gospodarz włączy
      // „Analizę płótna" — karty, które do dziś PŁYWAŁY nad płótnem, mają tu
      // swoje miejsce (decyzja CTO: nad płótnem nie pływa nic poza menu
      // kontekstowym węzła). Bez `showCanvasAnalysis` sekcja zachowuje
      // dotychczasowy uczciwy stan pusty.
      isEmpty: !showCanvasAnalysis,
      // Honest empty state — the real quick actions (Drąż w głąb/AI podsumuj/
      // AI porada) live in the header next to the element's identity, same as
      // before; there is no second, distinct set of actions to show here.
      emptyLabel: t('myWork.ideaInspector.actionsEmpty', 'Brak dostępnych akcji.'),
      children: gniazdoAnalizy,
    },
    {
      id: 'properties',
      label: t('myWork.ideaInspector.sections.properties', 'Właściwości'),
      defaultOpen: true,
      children: (
        <>
          <FieldRow label={t('myWork.ideaInspector.labelField', 'Etykieta')} stacked>
            <input
              aria-label={t('myWork.ideaInspector.labelField', 'Etykieta')}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              onBlur={() => void commit({ label: draft.label })}
              className={quietControlClass}
            />
          </FieldRow>
          {tool === 'process' ? (
            <p className="text-sm text-c-text-secondary">
              {t('myWork.ideaInspector.noState', 'To narzędzie nie prowadzi stanu elementu')}
            </p>
          ) : (
            <FieldRow label={t('myWork.ideaInspector.stateField', 'Stan')}>
              <select
                aria-label={t('myWork.ideaInspector.stateField', 'Stan')}
                value={draft.state ?? ''}
                onChange={(e) => void commit({ state: e.target.value })}
                className={quietControlClass}
              >
                <option value="" disabled>
                  —
                </option>
                {nativeStates.map((state) => (
                  // FIX (Day 3 layer-2 acceptance): a native <option> can only
                  // render text, not a <EntityStatusChip> component, so this
                  // routes through the same statusChip.* label-resolution the
                  // chip uses internally (see NotebookContextPanel,
                  // commit 58ff6ac3fe) instead of the raw "in_progress" string.
                  <option key={state} value={state}>
                    {statusChipLabel(state, t)}
                  </option>
                ))}
              </select>
            </FieldRow>
          )}
          {/* FIX-17 (Day 3 layer-2 acceptance): the accepted inspector prototype
              (mywork-fala3/proto-01-ideas-inspektor.html) shows the priority
              label as "Priorytet — 70" — a numeric readout right beside the
              slider, not a bare unlabeled range input. */}
          <FieldRow
            label={`${t('myWork.ideaInspector.priorityField', 'Priorytet')} — ${draft.priority ?? 0}`}
          >
            <input
              aria-label={t('myWork.ideaInspector.priorityField', 'Priorytet')}
              type="range"
              min={0}
              max={100}
              value={draft.priority ?? 0}
              onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
              onMouseUp={() => void commit({ priority: draft.priority })}
              className="w-full accent-[color:var(--c-focus-solid)]"
            />
          </FieldRow>
          {/* FIX-12 addendum (Day 3 layer-2 acceptance): owner/semanticType
              rendered as two bare, unlabeled <p> tags — a value with no
              visible field name. Labeled to match every other field in this
              section (Etykieta/Stan/Priorytet all have a label).
              FIX-17 extends this: Table's "person" column and Mindmap's
              "assign person" (AssignPersonModal) are real, functioning edit
              paths the OLD per-tool panels already had — the prototype shows
              Owner as an editable input, like Etykieta. Process Flow's own
              assignee input was never wired to persistence (dead field) and
              Whiteboard never had an assign feature at all, so both keep the
              read-only rendering rather than fabricating a new edit surface. */}
          {tool === 'table' || tool === 'mindmap' ? (
            <FieldRow label={t('myWork.ideaInspector.ownerField', 'Właściciel')}>
              <input
                aria-label={t('myWork.ideaInspector.ownerField', 'Właściciel')}
                value={draft.owner ?? ''}
                onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
                onBlur={() => void commit({ owner: draft.owner })}
                className={quietControlClass}
              />
            </FieldRow>
          ) : (
            <FieldRow label={t('myWork.ideaInspector.ownerField', 'Właściciel')}>
              {safeText(draft.owner) || (
                <span className="text-c-text-muted">
                  {t('myWork.ideaInspector.ownerEmpty', '—')}
                </span>
              )}
            </FieldRow>
          )}
          <FieldRow label={t('myWork.ideaInspector.semanticTypeField', 'Typ semantyczny')}>
            {safeText(draft.semanticType) || <span className="text-c-text-muted">—</span>}
          </FieldRow>
          {draft.tags?.length ? (
            <FieldRow label={t('myWork.ideaInspector.tagsField', 'Tagi')}>
              <div className="flex flex-wrap gap-1.5">
                {draft.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex h-[22px] items-center rounded-full bg-c-surface-raised px-2 text-[11px] text-c-text-secondary"
                  >
                    {safeText(tag)}
                  </span>
                ))}
              </div>
            </FieldRow>
          ) : null}
          {depthParagraphs.length ? (
            <div className="mt-3 space-y-1.5 border-t border-c-border-subtle pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                {t('myWork.ideaInspector.sections.contentDepth', 'Treść i głębia')}
              </p>
              {depthParagraphs.map((text, index) => (
                <p key={index} className="text-[12.5px] leading-relaxed text-c-text-secondary">
                  {safeText(text)}
                </p>
              ))}
            </div>
          ) : null}
          {toolSection ? (
            <div className="mt-3 space-y-2 border-t border-c-border-subtle pt-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                {toolTitle}
              </p>
              {toolSection}
            </div>
          ) : null}
        </>
      ),
    },
    {
      id: 'relations',
      label: t('myWork.ideaInspector.sections.relations', 'Powiązania'),
      defaultOpen: false,
      badge: relationsTotal,
      showZeroBadge: true,
      isEmpty: relationsTotal === 0,
      emptyLabel: t('myWork.ideaInspector.relationsEmpty', 'Brak powiązań.'),
      // ArtifactRightPanel's canon has no separate "outputs" slot — converted
      // artifacts are a kind of relation, so they render here (own labeled
      // sub-group), not as a 7th accordion the approved composition lacks.
      children:
        relationsTotal === 0 ? null : (
          <>
            {draft.relations?.map((item) => (
              <p
                key={item.id ?? item.title}
                className="text-[12.5px] leading-relaxed text-c-text"
              >
                {safeText(item.title)} · {safeText(item.type)} · {safeText(item.branch)}
              </p>
            ))}
            {draft.outputs?.length ? (
              <div className="mt-2 space-y-1.5 border-t border-c-border-subtle pt-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
                  {t('myWork.ideaInspector.sections.outputs', 'Artefakty wyjściowe')}
                </p>
                {draft.outputs.map((item) => (
                  <div
                    key={item.id ?? item.title}
                    className="flex items-center justify-between gap-2"
                  >
                    <p className="text-[12.5px] leading-relaxed text-c-text">
                      {safeText(item.title)} · {safeText(item.type)} · {safeText(item.status)}
                    </p>
                    {item.targetId ? (
                      <button
                        type="button"
                        onClick={() => onOpenOutput?.(item.targetId!)}
                        className="shrink-0 rounded-md px-2 py-1 text-xs text-c-text-secondary hover:bg-c-surface-raised hover:text-c-text"
                      >
                        {t('myWork.ideaInspector.openButton', 'Otwórz')}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        ),
    },
    {
      id: 'evidence',
      label: t('myWork.ideaInspector.sections.evidence', 'Dowody i źródła'),
      defaultOpen: false,
      badge: counts.evidence,
      showZeroBadge: true,
      isEmpty: counts.evidence === 0,
      emptyLabel: t('myWork.ideaInspector.evidenceEmpty', 'Brak zapisanych źródeł i założeń.'),
      children:
        counts.evidence === 0
          ? null
          : draft.evidence?.map((item) => (
              <p
                key={item.id ?? item.title}
                className="text-[12.5px] leading-relaxed text-c-text"
              >
                {safeText(item.title)} · {safeText(item.type)} · {safeText(item.source)} ·{' '}
                {safeText(item.date)}
              </p>
            )),
    },
    {
      id: 'comments',
      label: t('myWork.ideaInspector.sections.comments', 'Komentarze'),
      defaultOpen: false,
      badge: 0,
      showZeroBadge: true,
      isEmpty: true,
      // Honest — this element inspector has no comment thread of its own
      // (per-node comment threads are a separate, already-shipped surface).
      emptyLabel: t('myWork.ideaInspector.commentsEmpty', 'Brak komentarzy.'),
      children: null,
    },
    {
      id: 'history',
      label: t('myWork.ideaInspector.sections.history', 'Historia'),
      defaultOpen: false,
      badge: historyAiCount,
      showZeroBadge: true,
      children: (
        <>
          <div className="space-y-1.5">
            {(activity?.length ?? 0) === 0 ? (
              <p className="text-[12.5px] text-c-text-muted">
                {t('myWork.ideaInspector.noActivity', 'Brak aktywności')}
              </p>
            ) : (
              [...(activity ?? [])]
                .reverse()
                .map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-c-border-strong" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] leading-relaxed text-c-text-secondary">
                        <strong className="font-semibold text-c-text">{item.author}</strong>{' '}
                        {activityLabel(item)}
                      </p>
                      <span className="text-[10.5px] text-c-text-muted">
                        {formatActivityTime(item.createdAt)}
                      </span>
                    </div>
                  </div>
                ))
            )}
          </div>

          {onGenerateInsights ? (
            <div className="mt-3 space-y-2 border-t border-c-border-subtle pt-3">
              <button
                type="button"
                onClick={onGenerateInsights}
                disabled={aiLoading}
                className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-c-text-secondary disabled:opacity-40"
              >
                {aiLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Sparkles size={13} />
                )}
                {aiLoading
                  ? t('myWork.ideaInspector.generatingInsights', 'Generowanie…')
                  : t('myWork.ideaInspector.generateInsights', 'Wygeneruj podpowiedzi AI')}
              </button>
              {(aiInsights?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  {aiInsights!.map((insight, idx) => (
                    <p
                      key={idx}
                      className="rounded-md bg-c-surface-raised px-2.5 py-2 text-[12px] leading-relaxed text-c-text-secondary"
                    >
                      {insight}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </>
      ),
    },
  ];

  return (
    <aside
      ref={rootRef}
      data-testid="idea-right-panel"
      /*
       * ★ NAPRAWA 2026-09-01 (dyżur 164). Inspektor był PRZYBITY do 360 px
       * wewnątrz powłoki, która rezerwowała 400 px (`ExecutiveModuleShell`,
       * `mels-element-inspector-rail`) — 40 px zostawało puste, a uchwyt
       * zmiany rozmiaru (320–560 px) nic nie robił, bo treść i tak nie
       * rosła. To jest dosłownie „niepotrzebny panel" ze zgłoszenia
       * właściciela. Teraz inspektor WYPEŁNIA swojego gospodarza, a jedyną
       * szerokość ustala powłoka z tokenu `--ntype-right-panel-width`.
       */
      {...wspolneAtrybutyKorzenia}
      aria-label={t('myWork.ideaInspector.ariaElementProperties', 'Właściwości elementu')}
    >
      {powlokaNaglowka}
      {/* Header — no box, typographic title + light meta line (DEC-68).
          X przeniesiony do wspólnej powłoki nagłówka (jeden przycisk zamknięcia
          na panel, nie dwa) — patrz `powlokaNaglowka`. */}
      <header className="px-4 pb-3 pt-3.5">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug tracking-tight">
            {safeText(draft.label) || t('myWork.ideaInspector.untitledElement', 'Element bez nazwy')}
          </h2>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-c-text-muted">
          {safeText(draft.semanticType) ? <span>{safeText(draft.semanticType)}</span> : null}
          {safeText(draft.semanticType) && safeText(draft.branch) ? (
            <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-c-border-strong" />
          ) : null}
          {safeText(draft.branch) ? <span>{safeText(draft.branch)}</span> : null}
          {confirmedAt ? (
            <>
              <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-c-border-strong" />
              <time dateTime={confirmedAt.toISOString()}>
                {t('myWork.ideaInspector.saved', 'Zapisano')}{' '}
                {confirmedAt.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
              </time>
            </>
          ) : null}
        </div>
        {/* ★ Opis problemu (uwaga właściciela, 2026-09-05, odbiór na żywo
            `mywork-idea-inspector-lekki`): "Warto byłoby dodać opis problemu
            tak jak to jest obecnie na górze nowego panelu" — the element's
            own description, promoted to the very top of the panel (same
            paragraph markup the old "Treść i głębia" section used), so the
            reader sees what this Problem/element is about before opening any
            accordion. Not repeated inside Właściwości below (see
            `depthParagraphs`, which excludes `description`). */}
        {safeText(draft.description) ? (
          <p className="mt-2 text-[12.5px] leading-relaxed text-c-text-secondary">
            {safeText(draft.description)}
          </p>
        ) : null}
        {/* Quick actions — quiet text links, no borders (DEC-68). */}
        <div className="mt-2.5 flex flex-wrap items-center gap-4">
          <button
            type="button"
            disabled
            title={t('myWork.ideaInspector.drillReason', 'Akcja czeka na definicję zakresu')}
            className="text-[11.5px] font-medium text-c-text-secondary disabled:opacity-40"
          >
            {t('myWork.ideaInspector.drill', 'Drąż w głąb')}
          </button>
          <button
            type="button"
            disabled
            title={t('myWork.ideaInspector.summarizeReason', 'Akcja czeka na definicję zakresu')}
            className="text-[11.5px] font-medium text-c-text-secondary disabled:opacity-40"
          >
            {t('myWork.ideaInspector.summarize', 'AI podsumuj')}
          </button>
          <button
            type="button"
            disabled
            title={t('myWork.ideaInspector.adviceReason', 'Akcja czeka na definicję zakresu')}
            className="text-[11.5px] font-medium text-c-text-secondary disabled:opacity-40"
          >
            {t('myWork.ideaInspector.advice', 'AI porada')}
          </button>
        </div>
        {saving ? (
          <p role="status" className="mt-2 text-xs text-c-text-secondary">
            …
          </p>
        ) : null}
        {saveError ? (
          <p role="alert" className="mt-2 text-xs text-c-danger">
            {saveError}
          </p>
        ) : null}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ArtifactRightPanel
          // Ten komponent JEST już `<aside aria-label>` — accordion renderuje
          // się jako `div`, żeby panel miał JEDEN korzeń (decyzja CTO
          // 2026-09-05: „policz aside — ma być 1 albo 0").
          renderAs="div"
          ariaLabel={t('myWork.ideaInspector.ariaElementProperties', 'Właściwości elementu')}
          sections={sections}
          width="100%"
          className="min-h-0 flex-1 border-0"
        />
      </div>
      <footer className="border-t border-c-border-subtle px-4 py-2.5 text-[11px] text-c-text-muted">
        {safeText(draft.lineage)}
      </footer>
    </aside>
  );
};

export default IdeaElementInspector;
