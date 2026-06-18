import React, { useState } from 'react';

import { ToolFlowReasoning, ToolSession, useToolStore } from '@/store/useToolStore';

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

export function ReasoningStep(props: { session: ToolSession; isPolish: boolean }) {
  const { session, isPolish } = props;
  const { updateInputData } = useToolStore();

  const flow = (session.inputData as any)?.flow || {};
  const reasoning: ToolFlowReasoning = {
    narrative: '',
    evidence: [],
    openQuestions: [],
    ...(flow.reasoning || {}),
  };

  const patch = (next: Partial<ToolFlowReasoning>) => {
    updateInputData({
      flow: {
        ...flow,
        reasoning: { ...reasoning, ...next },
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
          {isPolish ? 'Uzasadnienie' : 'Reasoning'}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isPolish
            ? 'Zapisz logikę: co jest evidence, co jest założeniem i gdzie są znaki zapytania.'
            : 'Capture the logic: evidence vs assumptions and what remains unknown.'}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {isPolish ? 'Narracja' : 'Narrative'}
        </div>
        <textarea
          value={reasoning.narrative}
          onChange={(e) => patch({ narrative: e.target.value })}
          rows={5}
          placeholder={
            isPolish
              ? 'Dlaczego te wyniki wynikają z danych i obserwacji?'
              : 'Why do these results follow from your inputs and observations?'
          }
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none"
        />
      </div>

      <BulletListEditor
        label={isPolish ? 'Evidence / fakty' : 'Evidence / facts'}
        placeholder={isPolish ? 'Dodaj evidence...' : 'Add evidence...'}
        items={reasoning.evidence}
        onChange={(items) => patch({ evidence: items })}
        addLabel={addLabel}
        removeLabel={removeLabel}
        emptyLabel={emptyLabel}
      />

      <BulletListEditor
        label={isPolish ? 'Otwarte pytania' : 'Open questions'}
        placeholder={isPolish ? 'Dodaj pytanie...' : 'Add a question...'}
        items={reasoning.openQuestions}
        onChange={(items) => patch({ openQuestions: items })}
        addLabel={addLabel}
        removeLabel={removeLabel}
        emptyLabel={emptyLabel}
      />
    </div>
  );
}
