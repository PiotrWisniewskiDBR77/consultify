import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

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

export function ResultsStep(props: { session: ToolSession; isPolish: boolean }) {
  const { session } = props;
  const { t } = useTranslation();
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

  const title = t('discoveryToolsSteps.resultsStep.title');
  const addLabel = t('discoveryToolsSteps.resultsStep.add');
  const removeLabel = t('discoveryToolsSteps.resultsStep.remove');
  const emptyLabel = t('discoveryToolsSteps.resultsStep.noItems');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {t('discoveryToolsSteps.resultsStep.subtitle')}
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium text-slate-900 dark:text-white">
          {t('discoveryToolsSteps.resultsStep.executiveSummary')}
        </div>
        <textarea
          value={results.executiveSummary}
          onChange={(e) => patch({ executiveSummary: e.target.value })}
          rows={4}
          placeholder={t('discoveryToolsSteps.resultsStep.executiveSummaryPlaceholder')}
          className="w-full px-4 py-3 rounded-lg border border-slate-200 dark:border-navy-700 bg-white dark:bg-navy-800 text-slate-900 dark:text-white resize-none"
        />
      </div>

      <BulletListEditor
        label={t('discoveryToolsSteps.resultsStep.keyFindings')}
        placeholder={t('discoveryToolsSteps.resultsStep.keyFindingsPlaceholder')}
        items={results.keyFindings}
        onChange={(items) => patch({ keyFindings: items })}
        addLabel={addLabel}
        removeLabel={removeLabel}
        emptyLabel={emptyLabel}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BulletListEditor
          label="Quick wins"
          placeholder={t('discoveryToolsSteps.resultsStep.quickWinsPlaceholder')}
          items={results.quickWins}
          onChange={(items) => patch({ quickWins: items })}
          addLabel={addLabel}
          removeLabel={removeLabel}
          emptyLabel={emptyLabel}
        />
        <BulletListEditor
          label={t('discoveryToolsSteps.resultsStep.strategicBets')}
          placeholder={t('discoveryToolsSteps.resultsStep.strategicBetsPlaceholder')}
          items={results.strategicBets}
          onChange={(items) => patch({ strategicBets: items })}
          addLabel={addLabel}
          removeLabel={removeLabel}
          emptyLabel={emptyLabel}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BulletListEditor
          label={t('discoveryToolsSteps.resultsStep.prerequisites')}
          placeholder={t('discoveryToolsSteps.resultsStep.prerequisitesPlaceholder')}
          items={results.prerequisites}
          onChange={(items) => patch({ prerequisites: items })}
          addLabel={addLabel}
          removeLabel={removeLabel}
          emptyLabel={emptyLabel}
        />
        <BulletListEditor
          label={t('discoveryToolsSteps.resultsStep.risks')}
          placeholder={t('discoveryToolsSteps.resultsStep.risksPlaceholder')}
          items={results.risks}
          onChange={(items) => patch({ risks: items })}
          addLabel={addLabel}
          removeLabel={removeLabel}
          emptyLabel={emptyLabel}
        />
      </div>

      <BulletListEditor
        label={t('discoveryToolsSteps.resultsStep.dependencies')}
        placeholder={t('discoveryToolsSteps.resultsStep.dependenciesPlaceholder')}
        items={results.dependencies}
        onChange={(items) => patch({ dependencies: items })}
        addLabel={addLabel}
        removeLabel={removeLabel}
        emptyLabel={emptyLabel}
      />
    </div>
  );
}
