import { CircleDot, Plus, Tags } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';

import { SEMANTIC_TYPE_OPTIONS } from './SemanticTypeDropdown';

type SemanticNodeData = {
  semanticType?: string;
  notes?: string;
  tags?: string[];
};

interface SemanticControlsPopoverProps {
  isPl: boolean;
  disabled?: boolean;
  nodeData?: SemanticNodeData;
  onUpdate: (patch: { semanticType?: string; notes?: string; tags?: string[] }) => void;
  onOpenNodeDetail: () => void;
}

export const SemanticControlsPopover: React.FC<SemanticControlsPopoverProps> = ({
  isPl,
  disabled = false,
  nodeData,
  onUpdate,
  onOpenNodeDetail,
}) => {
  const [noteDraft, setNoteDraft] = useState('');
  const [tagInput, setTagInput] = useState('');

  useEffect(() => {
    setNoteDraft(nodeData?.notes || '');
    setTagInput('');
  }, [nodeData?.notes, nodeData?.semanticType, (nodeData?.tags || []).join('|')]);

  const currentTags = useMemo(
    () => (Array.isArray(nodeData?.tags) ? nodeData.tags : []),
    [nodeData?.tags]
  );

  const addTag = () => {
    const normalized = tagInput
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!normalized.length) return;
    const next = Array.from(new Set([...currentTags, ...normalized]));
    onUpdate({ tags: next });
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    onUpdate({ tags: currentTags.filter((item) => item !== tag) });
  };

  return (
    <div className="w-72 rounded-xl bg-c-surface-raised dark:bg-c-surface border border-c-border-subtle dark:border-c-border shadow-xl p-3 space-y-3">
      <div>
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-2">
          <CircleDot size={11} />
          {isPl ? 'Semantyka' : 'Semantics'}
        </div>
        <select
          value={nodeData?.semanticType || ''}
          onChange={(e) => onUpdate({ semanticType: e.target.value || '' })}
          disabled={disabled}
          className="w-full rounded-xl border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface px-3 py-2 text-xs text-c-text-secondary dark:text-c-text focus:outline-none focus:ring-2 focus:ring-c-border disabled:opacity-50"
        >
          <option value="">{isPl ? 'Wybierz typ semantyczny' : 'Select semantic type'}</option>
          {SEMANTIC_TYPE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {isPl ? option.labelPl : option.labelEn}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-2">
          <Tags size={11} />
          {isPl ? 'Tagi i kolor' : 'Tags and color'}
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2 min-h-[1.75rem]">
          {currentTags.map((tag) => (
            <button
              key={tag}
              type="button"
              disabled={disabled}
              onClick={() => removeTag(tag)}
              className="inline-flex items-center gap-1 rounded-full border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface px-2 py-1 text-[10px] font-medium text-c-text-secondary dark:text-c-text disabled:opacity-50"
            >
              <span>#{tag}</span>
              <span className="text-c-text-secondary">x</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
              }
            }}
            disabled={disabled}
            placeholder={
              isPl ? 'Dodaj tag lub kilka po przecinku' : 'Add tag or comma-separated tags'
            }
            className="flex-1 rounded-xl border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface px-3 py-2 text-xs text-c-text-secondary dark:text-c-text focus:outline-none focus:ring-2 focus:ring-c-border disabled:opacity-50"
          />
          <button
            type="button"
            onClick={addTag}
            disabled={disabled || !tagInput.trim()}
            className="inline-flex items-center gap-1 rounded-xl bg-c-surface-raised dark:bg-c-surface px-3 py-2 text-[11px] font-semibold text-c-text-secondary dark:text-c-text disabled:opacity-40"
          >
            <Plus size={11} />
            {isPl ? 'Dodaj' : 'Add'}
          </button>
        </div>
        <div className="mt-1.5 text-[10px] text-c-text-secondary dark:text-c-text-muted">
          {isPl
            ? 'Tagi i typ semantyczny nadają akcent kolorystyczny węzła i kontekst dla AI.'
            : 'Tags and semantic type drive node accent color and AI context.'}
        </div>
      </div>

      <div>
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-c-text-secondary mb-2">
          {isPl ? 'Szybka notatka' : 'Quick note'}
        </div>
        <textarea
          rows={3}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => onUpdate({ notes: noteDraft })}
          disabled={disabled}
          placeholder={
            isPl ? 'Krótki kontekst, znaczenie, decyzja...' : 'Short context, meaning, decision...'
          }
          className="w-full rounded-xl border border-c-border-subtle dark:border-c-border bg-c-surface-raised dark:bg-c-surface px-3 py-2 text-xs text-c-text-secondary dark:text-c-text focus:outline-none focus:ring-2 focus:ring-c-border resize-none disabled:opacity-50"
        />
      </div>

      <button
        type="button"
        onClick={onOpenNodeDetail}
        className="w-full rounded-xl border border-c-border-subtle dark:border-c-border px-3 py-2 text-[11px] font-semibold text-c-text-secondary dark:text-c-text-muted hover:bg-c-surface-raised dark:hover:bg-c-surface-raised transition-colors"
      >
        {isPl ? 'Otwórz pełne właściwości' : 'Open full properties'}
      </button>
    </div>
  );
};
