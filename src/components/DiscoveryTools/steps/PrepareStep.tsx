import React, { useState } from 'react';

import { ToolFlowPrepare, ToolSession, useToolStore } from '@/store/useToolStore';

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

export function PrepareStep(props: { session: ToolSession; isPolish: boolean }) {
  const { session, isPolish } = props;
  const { updateInputData } = useToolStore();

  const flow = (session.inputData as any)?.flow || {};
  const prepare: ToolFlowPrepare = {
    nextSteps: [],
    stakeholders: [],
    dataNeeded: [],
    timeline: '',
    ...(flow.prepare || {}),
  };

  const patch = (next: Partial<ToolFlowPrepare>) => {
    updateInputData({
      flow: {
        ...flow,
        prepare: { ...prepare, ...next },
      },
    });
  };

  const addLabel = isPolish ? 'Dodaj' : 'Add';
  const removeLabel = isPolish ? 'Usuń' : 'Remove';
  const emptyLabel = isPolish ? 'Brak elementów.' : 'No items.';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {isPolish ? 'Przygotuj' : 'Prepare'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zamień analizę w plan: kolejne kroki, dane, stakeholderzy i horyzont.'
            : 'Turn analysis into a plan: next steps, data, stakeholders, and timeline.'}
        </p>
      </div>

      <BulletListEditor
        label={isPolish ? 'Kolejne kroki' : 'Next steps'}
        placeholder={isPolish ? 'Dodaj krok...' : 'Add a step...'}
        items={prepare.nextSteps}
        onChange={(items) => patch({ nextSteps: items })}
        addLabel={addLabel}
        removeLabel={removeLabel}
        emptyLabel={emptyLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BulletListEditor
          label={isPolish ? 'Stakeholderzy' : 'Stakeholders'}
          placeholder={isPolish ? 'Dodaj osobę/rolę...' : 'Add person/role...'}
          items={prepare.stakeholders}
          onChange={(items) => patch({ stakeholders: items })}
          addLabel={addLabel}
          removeLabel={removeLabel}
          emptyLabel={emptyLabel}
        />
        <BulletListEditor
          label={isPolish ? 'Dane do zebrania' : 'Data to collect'}
          placeholder={isPolish ? 'Dodaj dane...' : 'Add data...'}
          items={prepare.dataNeeded}
          onChange={(items) => patch({ dataNeeded: items })}
          addLabel={addLabel}
          removeLabel={removeLabel}
          emptyLabel={emptyLabel}
        />
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {isPolish ? 'Timeline' : 'Timeline'}
        </div>
        <input
          value={prepare.timeline}
          onChange={(e) => patch({ timeline: e.target.value })}
          placeholder={
            isPolish
              ? 'np. 2 tygodnie discovery + 4 tygodnie wdrożenia'
              : 'e.g. 2 weeks discovery + 4 weeks delivery'
          }
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white"
        />
      </div>
    </div>
  );
}
