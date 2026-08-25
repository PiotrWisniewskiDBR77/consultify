import React, { useMemo, useRef, useState } from 'react';

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
const safeText = (value?: string) => (value ?? '').replace(UUID, '').trim();

const COPY = {
  pl: {
    sections: [
      'Podstawowe',
      'Treść i głębia',
      'Klasyfikacja',
      'Dowody i źródła',
      'Powiązania',
      'Artefakty wyjściowe',
    ],
    empty: 'Zaznacz element, aby zobaczyć właściwości',
    emptyHint: 'Kliknij węzeł, wiersz, kartkę albo krawędź',
    recent: 'Ostatnio otwarte',
    saved: 'Zapisano',
    advice: 'AI porada',
    adviceReason: 'Akcja czeka na definicję zakresu',
    drill: 'Drąż w głąb',
    summarize: 'AI podsumuj',
    noState: 'To narzędzie nie prowadzi stanu elementu',
    tool: {
      mindmap: 'Wygląd węzła',
      process: 'Krawędź i tor',
      whiteboard: 'Sesja warsztatu',
      table: 'Kolumna',
    },
  },
  en: {
    sections: [
      'Basics',
      'Content and depth',
      'Classification',
      'Evidence and sources',
      'Relations',
      'Output artifacts',
    ],
    empty: 'Select an element to see its properties',
    emptyHint: 'Click a node, row, card, or edge',
    recent: 'Recently opened',
    saved: 'Saved',
    advice: 'AI advice',
    adviceReason: 'This action is waiting for its scope to be defined',
    drill: 'Drill down',
    summarize: 'AI summary',
    noState: 'This tool does not track element state',
    tool: {
      mindmap: 'Node appearance',
      process: 'Edge and lane',
      whiteboard: 'Workshop session',
      table: 'Column',
    },
  },
} as const;

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
  const copy = COPY[language];
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
      setSaveError(
        language === 'pl' ? 'Nie udało się zapisać zmian' : 'Changes could not be saved'
      );
    } finally {
      setSaving(false);
    }
  };

  const sectionClasses = 'space-y-2 border-b border-c-border-subtle p-4';
  const counts = useMemo(
    () => ({
      evidence: draft?.evidence?.length ?? 0,
      relations: draft?.relations?.length ?? 0,
      outputs: draft?.outputs?.length ?? 0,
    }),
    [draft]
  );

  if (!draft) {
    return (
      <aside className="flex h-full flex-col bg-c-surface" aria-label={copy.empty}>
        <div className="m-auto max-w-xs p-6 text-center">
          <p className="font-medium text-c-text">{copy.empty}</p>
          <p className="mt-1 text-sm text-c-text-secondary">{copy.emptyHint}</p>
          {recentItems?.length ? (
            <section className="mt-6 text-left" aria-labelledby="idea-recent-title">
              <h3
                id="idea-recent-title"
                className="text-xs font-semibold uppercase text-c-text-secondary"
              >
                {copy.recent}
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
      aria-label={language === 'pl' ? 'Właściwości elementu' : 'Element properties'}
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
              {copy.saved}{' '}
              {confirmedAt.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })}
            </time>
          ) : null}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="rounded border border-c-border px-2 py-1 text-xs">
            {copy.drill}
          </button>
          <button type="button" className="rounded border border-c-border px-2 py-1 text-xs">
            {copy.summarize}
          </button>
          <button
            type="button"
            disabled
            title={copy.adviceReason}
            className="rounded border border-c-border px-2 py-1 text-xs disabled:opacity-50"
          >
            {copy.advice}
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
          <CountHeading title={copy.sections[0]} count={1} />
          <label className="block text-xs">
            {language === 'pl' ? 'Etykieta' : 'Label'}
            <input
              aria-label={language === 'pl' ? 'Etykieta' : 'Label'}
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              onBlur={() => void commit({ label: draft.label })}
              className="mt-1 w-full rounded border border-c-border bg-c-surface px-2 py-1"
            />
          </label>
          {tool === 'process' ? (
            <p className="text-sm text-c-text-secondary">{copy.noState}</p>
          ) : (
            <select
              aria-label={language === 'pl' ? 'Stan' : 'State'}
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
            aria-label={language === 'pl' ? 'Priorytet' : 'Priority'}
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
          <CountHeading title={copy.sections[1]} count={5} />
          {[draft.description, draft.context, draft.goal, draft.rationale, draft.risk]
            .filter(Boolean)
            .map((text, index) => (
              <p key={index} className="text-sm">
                {safeText(text)}
              </p>
            ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading title={copy.sections[2]} count={draft.tags?.length ?? 0} />
          <div className="flex flex-wrap gap-1">
            {draft.tags?.map((tag) => (
              <span key={tag} className="rounded bg-c-surface-raised px-2 py-1 text-xs">
                {safeText(tag)}
              </span>
            ))}
          </div>
        </section>
        <section className={sectionClasses}>
          <CountHeading title={copy.sections[3]} count={counts.evidence} />
          {draft.evidence?.map((item) => (
            <p key={item.id ?? item.title} className="text-sm">
              {safeText(item.title)} · {safeText(item.type)} · {safeText(item.source)} ·{' '}
              {safeText(item.date)}
            </p>
          ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading title={copy.sections[4]} count={counts.relations} />
          {draft.relations?.map((item) => (
            <p key={item.id ?? item.title} className="text-sm">
              {safeText(item.title)} · {safeText(item.type)} · {safeText(item.branch)}
            </p>
          ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading title={copy.sections[5]} count={counts.outputs} />
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
                  {language === 'pl' ? 'Otwórz' : 'Open'}
                </button>
              ) : null}
            </div>
          ))}
        </section>
        <section className={sectionClasses}>
          <CountHeading title={copy.tool[tool]} count={toolSection ? 1 : 0} />
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
