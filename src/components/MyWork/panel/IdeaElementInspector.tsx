import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

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
  <h3 className="text-xs font-semibold uppercase tracking-wide text-c-text-secondary">
    {title} <span aria-label={`${title}: ${count}`}>{count}</span>
  </h3>
);

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

  const sectionClasses = 'space-y-2 border-b border-c-border-subtle p-4';
  const counts = useMemo(
    () => ({
      // FIX-11: "Podstawowe"/"Treść i głębia" no longer report a hardcoded 1/5 —
      // count only the fields that actually rendered in each section.
      basics: draft ? (draft.owner ? 1 : 0) + (draft.semanticType ? 1 : 0) + 1 : 0,
      content: [draft?.description, draft?.context, draft?.goal, draft?.rationale, draft?.risk]
        .filter(Boolean).length,
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
      <aside className="flex h-full flex-col bg-c-surface" aria-label={emptyText}>
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
      aria-label={t('myWork.ideaInspector.ariaElementProperties', 'Właściwości elementu')}
      onKeyDown={(event) => {
        if (event.key === 'Escape') onReturnToCanvas?.();
      }}
    >
      <header className="border-b border-c-border p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{safeText(draft.label)}</h2>
            <p className="text-xs text-c-text-secondary">
              {safeText(draft.branch)} · {safeText(draft.semanticType)}
            </p>
          </div>
          {confirmedAt ? (
            <time
              className="shrink-0 text-xs text-c-text-secondary"
              dateTime={confirmedAt.toISOString()}
            >
              {t('myWork.ideaInspector.saved', 'Zapisano')}{' '}
              {confirmedAt.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
            </time>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* FIX-2 (Day 3 acceptance): these two actions have no implementation yet
              (drill-down-in-place and AI summary are out of scope here — module 17
              owns the AI surface). Disable with a real reason instead of a dead
              onClick, matching the "AI porada" pattern already used below. */}
          <button
            type="button"
            disabled
            title={t('myWork.ideaInspector.drillReason', 'Akcja czeka na definicję zakresu')}
            className="rounded border border-c-border px-2 py-1 text-xs disabled:opacity-50"
          >
            {t('myWork.ideaInspector.drill', 'Drąż w głąb')}
          </button>
          <button
            type="button"
            disabled
            title={t('myWork.ideaInspector.summarizeReason', 'Akcja czeka na definicję zakresu')}
            className="rounded border border-c-border px-2 py-1 text-xs disabled:opacity-50"
          >
            {t('myWork.ideaInspector.summarize', 'AI podsumuj')}
          </button>
          <button
            type="button"
            disabled
            title={t('myWork.ideaInspector.adviceReason', 'Akcja czeka na definicję zakresu')}
            className="rounded border border-c-border px-2 py-1 text-xs disabled:opacity-50"
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
        <section className={sectionClasses}>
          <CountHeading
            title={t('myWork.ideaInspector.sections.basics', 'Podstawowe')}
            count={counts.basics}
          />
          <label className="block text-xs">
            {t('myWork.ideaInspector.labelField', 'Etykieta')}
            <input
              aria-label={t('myWork.ideaInspector.labelField', 'Etykieta')}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              onBlur={() => void commit({ label: draft.label })}
              className="mt-1 w-full rounded border border-c-border bg-c-surface px-2 py-1"
            />
          </label>
          {tool === 'process' ? (
            <p className="text-sm text-c-text-secondary">
              {t('myWork.ideaInspector.noState', 'To narzędzie nie prowadzi stanu elementu')}
            </p>
          ) : (
            <select
              aria-label={t('myWork.ideaInspector.stateField', 'Stan')}
              value={draft.state ?? ''}
              onChange={(e) => void commit({ state: e.target.value })}
              className="w-full rounded border border-c-border bg-c-surface px-2 py-1"
            >
              <option value="" disabled>
                —
              </option>
              {nativeStates.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label={t('myWork.ideaInspector.priorityField', 'Priorytet')}
            type="range"
            min={0}
            max={100}
            value={draft.priority ?? 0}
            onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })}
            onMouseUp={() => void commit({ priority: draft.priority })}
          />
          <p className="text-sm">{safeText(draft.owner)}</p>
          <p className="text-sm">{safeText(draft.semanticType)}</p>
        </section>
        <section className={sectionClasses}>
          <CountHeading
            title={t('myWork.ideaInspector.sections.contentDepth', 'Treść i głębia')}
            count={counts.content}
          />
          {[draft.description, draft.context, draft.goal, draft.rationale, draft.risk]
            .filter(Boolean)
            .map((text, index) => (
              <p key={index} className="text-sm">
                {safeText(text)}
              </p>
            ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading
            title={t('myWork.ideaInspector.sections.classification', 'Klasyfikacja')}
            count={draft.tags?.length ?? 0}
          />
          <div className="flex flex-wrap gap-1">
            {draft.tags?.map((tag) => (
              <span key={tag} className="rounded bg-c-surface-raised px-2 py-1 text-xs">
                {safeText(tag)}
              </span>
            ))}
          </div>
        </section>
        <section className={sectionClasses}>
          <CountHeading
            title={t('myWork.ideaInspector.sections.evidence', 'Dowody i źródła')}
            count={counts.evidence}
          />
          {draft.evidence?.map((item) => (
            <p key={item.id ?? item.title} className="text-sm">
              {safeText(item.title)} · {safeText(item.type)} · {safeText(item.source)} ·{' '}
              {safeText(item.date)}
            </p>
          ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading
            title={t('myWork.ideaInspector.sections.relations', 'Powiązania')}
            count={counts.relations}
          />
          {draft.relations?.map((item) => (
            <p key={item.id ?? item.title} className="text-sm">
              {safeText(item.title)} · {safeText(item.type)} · {safeText(item.branch)}
            </p>
          ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading
            title={t('myWork.ideaInspector.sections.outputs', 'Artefakty wyjściowe')}
            count={counts.outputs}
          />
          {draft.outputs?.map((item) => (
            <div
              key={item.id ?? item.title}
              className="mb-2 flex items-center justify-between gap-2"
            >
              <p className="text-sm">
                {safeText(item.title)} · {safeText(item.type)} · {safeText(item.status)}
              </p>
              {item.targetId ? (
                <button
                  type="button"
                  onClick={() => onOpenOutput?.(item.targetId!)}
                  className="rounded border border-c-border px-2 py-1 text-xs"
                >
                  {t('myWork.ideaInspector.openButton', 'Otwórz')}
                </button>
              ) : null}
            </div>
          ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading title={toolTitle} count={toolSection ? 1 : 0} />
          {toolSection}
        </section>
      </div>
      <footer className="border-t border-c-border p-3 text-xs text-c-text-secondary">
        {safeText(draft.lineage)}
      </footer>
    </aside>
  );
};

export default IdeaElementInspector;
