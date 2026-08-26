import { ChevronDown, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { statusChipLabel } from '@/components/ui/primitives/chips/EntityStatusChip';

export type IdeaInspectorTool = 'mindmap' | 'process' | 'whiteboard' | 'table';

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
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
// FIX-11 (Day 3 acceptance): strip internal id-slugs too (e.g. "initiative-1",
// "node-1699999999-ab12cd") — not just full UUIDs — so a raw targetId/nodeId
// that leaks into a text field never renders verbatim in the inspector.
const SLUG = /\b[a-z]+-\d+(?:-[a-z0-9]+)*\b/gi;
const safeText = (value?: string) => (value ?? '').replace(UUID, '').replace(SLUG, '').trim();

const CountHeading = ({ title, count }: { title: string; count: number }) => (
  <h3 className="flex-1 min-w-0 truncate text-[11px] font-semibold uppercase tracking-wider text-c-text-muted">
    {title} <span aria-label={`${title}: ${count}`}>{count}</span>
  </h3>
);

/**
 * DEC-68 — „lekki charakter": accordion section with NO surrounding card/box.
 * Header = hairline top border + 44px row (L1 muted label via CountHeading +
 * chevron). Body = plain padding, no nested border. All sections default
 * OPEN (matches pre-existing behavior — every field was always visible with
 * no click-to-expand step; this keeps that contract while adding the
 * collapse affordance the prototype shows).
 */
const InspectorSection: React.FC<{
  title: string;
  count: number;
  children: React.ReactNode;
}> = ({ title, count, children }) => {
  const [open, setOpen] = useState(true);
  return (
    <section className="border-t border-c-border-subtle first:border-t-0">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((v) => !v);
          }
        }}
        className="flex h-11 w-full cursor-pointer items-center gap-2 px-4 hover:bg-c-surface-raised"
      >
        <CountHeading title={title} count={count} />
        <ChevronDown
          size={15}
          className={`shrink-0 text-c-text-muted transition-transform duration-150 ${open ? '' : '-rotate-90'}`}
          aria-hidden="true"
        />
      </div>
      {open ? <div className="space-y-2 px-4 pb-4 pt-0.5">{children}</div> : null}
    </section>
  );
};

/** Quiet field row: 104px muted label + value/control. No box, no default border. */
const FieldRow: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
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

  const toolTitle = t(
    `myWork.ideaInspector.tool.${tool}`,
    {
      mindmap: 'Wygląd węzła',
      process: 'Krawędź i tor',
      whiteboard: 'Sesja warsztatu',
      table: 'Kolumna',
    }[tool]
  );

  if (!draft) {
    const emptyText = t('myWork.ideaInspector.empty', 'Zaznacz element, aby zobaczyć właściwości');
    return (
      <aside
        className="flex h-full w-[360px] flex-col bg-c-surface"
        style={{ width: 360, minWidth: 360 }}
        aria-label={emptyText}
      >
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
      </aside>
    );
  }

  return (
    <aside
      ref={rootRef}
      className="flex h-full flex-col bg-c-surface text-c-text"
      style={{ width: 360, minWidth: 360 }}
      aria-label={t('myWork.ideaInspector.ariaElementProperties', 'Właściwości elementu')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onReturnToCanvas?.();
      }}
    >
      {/* Header — no box, typographic title + light meta line (DEC-68). */}
      <header className="px-4 pb-3 pt-3.5">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold leading-snug tracking-tight">
            {safeText(draft.label)}
          </h2>
          {onReturnToCanvas ? (
            <button
              type="button"
              onClick={onReturnToCanvas}
              aria-label={t('myWork.ideaInspector.close', 'Zamknij inspektor')}
              className="shrink-0 rounded-md p-1 text-c-text-muted hover:bg-c-surface-raised hover:text-c-text"
            >
              <X size={15} />
            </button>
          ) : null}
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
        <InspectorSection
          title={t('myWork.ideaInspector.sections.basics', 'Podstawowe')}
          count={counts.basics}
        >
          <FieldRow label={t('myWork.ideaInspector.labelField', 'Etykieta')}>
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
        </InspectorSection>

        <InspectorSection
          title={t('myWork.ideaInspector.sections.contentDepth', 'Treść i głębia')}
          count={counts.content}
        >
          {[draft.description, draft.context, draft.goal, draft.rationale, draft.risk]
            .filter(Boolean)
            .map((text, index) => (
              <p key={index} className="text-[12.5px] leading-relaxed text-c-text-secondary">
                {safeText(text)}
              </p>
            ))}
        </InspectorSection>

        <InspectorSection
          title={t('myWork.ideaInspector.sections.classification', 'Klasyfikacja')}
          count={draft.tags?.length ?? 0}
        >
          <div className="flex flex-wrap gap-1.5">
            {draft.tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex h-[22px] items-center rounded-full bg-c-surface-raised px-2 text-[11px] text-c-text-secondary"
              >
                {safeText(tag)}
              </span>
            ))}
          </div>
        </InspectorSection>

        <InspectorSection
          title={t('myWork.ideaInspector.sections.evidence', 'Dowody i źródła')}
          count={counts.evidence}
        >
          {draft.evidence?.map((item) => (
            <p key={item.id ?? item.title} className="text-[12.5px] leading-relaxed text-c-text">
              {safeText(item.title)} · {safeText(item.type)} · {safeText(item.source)} ·{' '}
              {safeText(item.date)}
            </p>
          ))}
        </InspectorSection>

        <InspectorSection
          title={t('myWork.ideaInspector.sections.relations', 'Powiązania')}
          count={counts.relations}
        >
          {draft.relations?.map((item) => (
            <p key={item.id ?? item.title} className="text-[12.5px] leading-relaxed text-c-text">
              {safeText(item.title)} · {safeText(item.type)} · {safeText(item.branch)}
            </p>
          ))}
        </InspectorSection>

        <InspectorSection
          title={t('myWork.ideaInspector.sections.outputs', 'Artefakty wyjściowe')}
          count={counts.outputs}
        >
          {draft.outputs?.map((item) => (
            <div key={item.id ?? item.title} className="flex items-center justify-between gap-2">
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
        </InspectorSection>

        <InspectorSection title={toolTitle} count={toolSection ? 1 : 0}>
          {toolSection}
        </InspectorSection>
      </div>
      <footer className="border-t border-c-border-subtle px-4 py-2.5 text-[11px] text-c-text-muted">
        {safeText(draft.lineage)}
      </footer>
    </aside>
  );
};

export default IdeaElementInspector;
