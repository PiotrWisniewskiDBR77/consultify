import React, { useMemo, useState } from 'react';

import { ToolFlowResults, ToolSession, useToolStore } from '@/store/useToolStore';

function BulletListEditor(props: {
  label: string;
  placeholder: string;
  items: string[];
  onChange: (items: string[]) => void;
  addLabel: string;
  removeLabel: string;
  emptyLabel: string;
}) {
  const { label, placeholder, items, onChange, addLabel, removeLabel, emptyLabel } = props;
  const [draft, setDraft] = useState('');

  const add = () => {
    const value = draft.trim();
    if (!value) return;
    onChange([...(items || []), value]);
    setDraft('');
  };

  const remove = (idx: number) => onChange((items || []).filter((_, i) => i !== idx));

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-slate-900 dark:text-white">{label}</div>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
        <button
          onClick={add}
          disabled={!draft.trim()}
          className="px-4 py-3 rounded-lg bg-navy-900 text-white dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] hover:bg-navy-800 disabled:opacity-50"
        >
          {addLabel}
        </button>
      </div>
      {items.length === 0 ? (
        <div className="p-4 rounded-lg border-2 border-dashed border-slate-200 dark:border-navy-700 text-center text-slate-600 text-sm">
          {emptyLabel}
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((v, idx) => (
            <li
              key={`${idx}-${v}`}
              className="flex items-start justify-between gap-3 p-3 rounded-lg bg-white dark:bg-navy-800 border border-slate-200 dark:border-navy-700"
            >
              <div className="text-sm text-slate-700 dark:text-slate-200">{v}</div>
              <button
                onClick={() => remove(idx)}
                className="text-xs text-slate-500 hover:text-rose-600"
              >
                {removeLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResultsStep(props: { session: ToolSession; isPolish: boolean }) {
  const { session, isPolish } = props;
  const { updateInputData } = useToolStore();

  const flow = (session.inputData as any)?.flow || {};
  const results: ToolFlowResults = {
    executiveSummary: '',
    keyFindings: [],
    quickWins: [],
    strategicBets: [],
    prerequisites: [],
    risks: [],
    dependencies: [],
    ...(flow.results || {}),
  };

  const patch = (next: Partial<ToolFlowResults>) => {
    updateInputData({
      flow: {
        ...flow,
        results: { ...results, ...next },
      },
    });
  };

  const title = useMemo(() => (isPolish ? 'Wyniki' : 'Results'), [isPolish]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zamknij wnioski w zwięzłe rezultaty: quick wins, zakłady strategiczne oraz ryzyka/prerekwizyty.'
            : 'Turn inputs into crisp outcomes: quick wins, strategic bets, and key risks/prerequisites.'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {isPolish ? 'Podsumowanie wykonawcze' : 'Executive Summary'}
        </div>
        <textarea
          value={results.executiveSummary}
          onChange={(e) => patch({ executiveSummary: e.target.value })}
          rows={4}
          placeholder={
            isPolish
              ? 'Napisz 3–5 zdań: co znaleźliśmy i co to znaczy.'
              : 'Write 3–5 sentences: what you found and what it means.'
          }
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none"
        />
      </div>

      <BulletListEditor
        label={isPolish ? 'Kluczowe wnioski' : 'Key Findings'}
        placeholder={isPolish ? 'Dodaj wniosek...' : 'Add a finding...'}
        items={results.keyFindings}
        onChange={(items) => patch({ keyFindings: items })}
        addLabel={isPolish ? 'Dodaj' : 'Add'}
        removeLabel={isPolish ? 'Usuń' : 'Remove'}
        emptyLabel={isPolish ? 'Brak elementów.' : 'No items.'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BulletListEditor
          label={isPolish ? 'Quick wins' : 'Quick wins'}
          placeholder={isPolish ? 'Dodaj quick win...' : 'Add a quick win...'}
          items={results.quickWins}
          onChange={(items) => patch({ quickWins: items })}
          addLabel={isPolish ? 'Dodaj' : 'Add'}
          removeLabel={isPolish ? 'Usuń' : 'Remove'}
          emptyLabel={isPolish ? 'Brak elementów.' : 'No items.'}
        />
        <BulletListEditor
          label={isPolish ? 'Zakłady strategiczne' : 'Strategic bets'}
          placeholder={isPolish ? 'Dodaj zakład...' : 'Add a strategic bet...'}
          items={results.strategicBets}
          onChange={(items) => patch({ strategicBets: items })}
          addLabel={isPolish ? 'Dodaj' : 'Add'}
          removeLabel={isPolish ? 'Usuń' : 'Remove'}
          emptyLabel={isPolish ? 'Brak elementów.' : 'No items.'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BulletListEditor
          label={isPolish ? 'Prerekwizyty' : 'Prerequisites'}
          placeholder={isPolish ? 'Dodaj prerequisite...' : 'Add a prerequisite...'}
          items={results.prerequisites}
          onChange={(items) => patch({ prerequisites: items })}
          addLabel={isPolish ? 'Dodaj' : 'Add'}
          removeLabel={isPolish ? 'Usuń' : 'Remove'}
          emptyLabel={isPolish ? 'Brak elementów.' : 'No items.'}
        />
        <BulletListEditor
          label={isPolish ? 'Ryzyka' : 'Risks'}
          placeholder={isPolish ? 'Dodaj ryzyko...' : 'Add a risk...'}
          items={results.risks}
          onChange={(items) => patch({ risks: items })}
          addLabel={isPolish ? 'Dodaj' : 'Add'}
          removeLabel={isPolish ? 'Usuń' : 'Remove'}
          emptyLabel={isPolish ? 'Brak elementów.' : 'No items.'}
        />
      </div>

      <BulletListEditor
        label={isPolish ? 'Zależności (dependency map)' : 'Dependencies (dependency map)'}
        placeholder={isPolish ? 'Dodaj zależność...' : 'Add a dependency...'}
        items={results.dependencies}
        onChange={(items) => patch({ dependencies: items })}
        addLabel={isPolish ? 'Dodaj' : 'Add'}
        removeLabel={isPolish ? 'Usuń' : 'Remove'}
        emptyLabel={isPolish ? 'Brak elementów.' : 'No items.'}
      />
    </div>
  );
}
