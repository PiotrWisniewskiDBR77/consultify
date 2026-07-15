import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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
                className="text-xs text-slate-500 hover:text-danger-600"
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
  const { session } = props;
  const { t } = useTranslation();
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

  const addLabel = t('discoveryToolsSteps.reasoningStep.add');
  const removeLabel = t('discoveryToolsSteps.reasoningStep.remove');
  const emptyLabel = t('discoveryToolsSteps.reasoningStep.noItems');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.reasoningStep.title')}
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.reasoningStep.subtitle')}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.reasoningStep.narrative')}
        </div>
        <textarea
          value={reasoning.narrative}
          onChange={(e) => patch({ narrative: e.target.value })}
          rows={5}
          placeholder={t('discoveryToolsSteps.reasoningStep.narrativePlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none"
        />
      </div>

      <BulletListEditor
        label={t('discoveryToolsSteps.reasoningStep.evidence')}
        placeholder={t('discoveryToolsSteps.reasoningStep.evidencePlaceholder')}
        items={reasoning.evidence}
        onChange={(items) => patch({ evidence: items })}
        addLabel={addLabel}
        removeLabel={removeLabel}
        emptyLabel={emptyLabel}
      />

      <BulletListEditor
        label={t('discoveryToolsSteps.reasoningStep.openQuestions')}
        placeholder={t('discoveryToolsSteps.reasoningStep.openQuestionsPlaceholder')}
        items={reasoning.openQuestions}
        onChange={(items) => patch({ openQuestions: items })}
        addLabel={addLabel}
        removeLabel={removeLabel}
        emptyLabel={emptyLabel}
      />
    </div>
  );
}
