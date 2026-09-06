/**
 * AnswerStateControl — the six honest answer states (HELP §4):
 * Potwierdzone · Częściowo · Nie · Nie wiem/potrzebuję pomocy · Nie mam dowodu ·
 * Nie dotyczy (wymaga uzasadnienia).
 *
 * `dont_know` never sets a level and never scores as zero — selecting it opens
 * `ResolutionCard` instead of committing an answer. `not_applicable` requires a
 * justification before it can be confirmed (canon forbids unjustified N/A).
 */
import { AlertCircle, Check, CircleSlash, FileQuestion, HelpCircle, Minus } from 'lucide-react';
import React, { useState } from 'react';

import type { MethodAnswerState, ResolutionAction, ResolutionCardData } from './types';
import { ANSWER_STATE_TONE, ANSWER_TONE_BUTTON_SELECTED } from './answerStateColors';
import { ResolutionCard } from './ResolutionCard';

export interface AnswerStateControlProps {
  value: MethodAnswerState | null;
  onChange: (state: MethodAnswerState, justification?: string) => void;
  resolutionData: ResolutionCardData;
  onResolutionAction: (action: ResolutionAction) => void;
  disabled?: boolean;
  className?: string;
}

const OPTIONS: Array<{
  id: MethodAnswerState;
  label: string;
  icon: React.ReactNode;
}> = [
  { id: 'confirmed', label: 'Potwierdzone', icon: <Check size={14} /> },
  { id: 'partial', label: 'Częściowo', icon: <Minus size={14} /> },
  { id: 'no', label: 'Nie', icon: <CircleSlash size={14} /> },
  { id: 'dont_know', label: 'Nie wiem / potrzebuję pomocy', icon: <HelpCircle size={14} /> },
  { id: 'no_evidence', label: 'Nie mam dowodu', icon: <FileQuestion size={14} /> },
  { id: 'not_applicable', label: 'Nie dotyczy', icon: <AlertCircle size={14} /> },
];

export const AnswerStateControl: React.FC<AnswerStateControlProps> = ({
  value,
  onChange,
  resolutionData,
  onResolutionAction,
  disabled = false,
  className = '',
}) => {
  const [naJustification, setNaJustification] = useState('');
  const [pendingNa, setPendingNa] = useState(false);

  const handleSelect = (state: MethodAnswerState) => {
    if (disabled) return;
    if (state === 'not_applicable') {
      setPendingNa(true);
      return;
    }
    setPendingNa(false);
    onChange(state);
  };

  return (
    <div className={`space-y-3 ${className}`} data-testid="answer-state-control">
      <div
        role="radiogroup"
        aria-label="Stan odpowiedzi"
        className="grid grid-cols-2 sm:grid-cols-3 gap-2"
      >
        {OPTIONS.map((option) => {
          const selected = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              data-selected={selected}
              disabled={disabled}
              onClick={() => handleSelect(option.id)}
              data-tone={ANSWER_STATE_TONE[option.id]}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus ${
                selected
                  ? `font-semibold ${ANSWER_TONE_BUTTON_SELECTED[ANSWER_STATE_TONE[option.id]]}`
                  : 'border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised'
              }`}
            >
              {option.icon}
              <span className="truncate">{option.label}</span>
            </button>
          );
        })}
      </div>

      {pendingNa && value !== 'not_applicable' && (
        <div className="space-y-2 rounded-lg border border-c-border bg-c-surface-raised p-3">
          <label htmlFor="na-justification" className="text-xs font-medium text-c-text">
            Uzasadnij „Nie dotyczy" (wymagane)
          </label>
          <textarea
            id="na-justification"
            value={naJustification}
            onChange={(e) => setNaJustification(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-c-border bg-c-surface p-2 text-xs text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            placeholder="Dlaczego to pytanie nie ma zastosowania w tym przypadku?"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setPendingNa(false)}
              className="rounded px-2 py-1 text-xs text-c-text-secondary hover:bg-c-surface"
            >
              Anuluj
            </button>
            <button
              type="button"
              disabled={naJustification.trim().length === 0}
              onClick={() => {
                onChange('not_applicable', naJustification.trim());
                setPendingNa(false);
              }}
              className="rounded bg-c-surface border border-c-border px-2 py-1 text-xs font-medium text-c-text disabled:opacity-40 disabled:cursor-not-allowed hover:bg-c-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
            >
              Potwierdź „Nie dotyczy"
            </button>
          </div>
        </div>
      )}

      {value === 'dont_know' && <ResolutionCard data={resolutionData} onAction={onResolutionAction} />}
    </div>
  );
};

export default AnswerStateControl;
