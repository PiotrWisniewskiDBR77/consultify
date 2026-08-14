/**
 * EvidenceEditor — STREAM G1 (2026-08-13), Deliverable A.
 *
 * Before this component, `SWOTEvidenceType` and `SWOTStrengthClassification`
 * (src/store/useToolStore.ts) existed and were consumed by the engine
 * (config/swot/dynamicSwotQuestionBank.ts's `evaluateSwotItemEvidence`,
 * `classifyStrengthFromAnswers`) and the Output builder
 * (toolOutputs/buildSwotOutput.ts's `toEvidenceKind`), but had ZERO UI — the
 * only way these fields were ever populated was the AI chat-mentor flow
 * (hooks/discovery/toolAi/dynamicSwot.ts). A user could not choose an
 * evidence type, write a source, or set/change a classification.
 *
 * This is a small, reusable, per-item editor mounted inline in each SWOT item
 * card (SWOTBuildPhase.tsx). It edits ONLY existing `SWOTItem` fields plus two
 * minimal additions justified in useToolStore.ts's `SWOTItem` docstring
 * (`evidenceType`, `evidenceSource`) — `evidenceNote` (description),
 * `confidence` (strength/credibility) and `classification` all already
 * existed.
 *
 * The live evidence-status badge and the blocking-rule warning both call the
 * SAME canonical gate (`config/swot/swotAcceptGate.ts`) the accept command
 * uses, so what the user sees here is never a separate opinion from what
 * accept will actually enforce.
 */
import { AlertTriangle } from 'lucide-react';
import React, { useState } from 'react';

import { evaluateSwotAcceptGate } from '@/config/swot/swotAcceptGate';
import type {
  SWOTEvidenceType,
  SWOTItem,
  SWOTStrengthClassification,
} from '@/store/useToolStore';

const EVIDENCE_TYPE_LABEL: Record<SWOTEvidenceType, { pl: string; en: string }> = {
  fact: { pl: 'Fakt', en: 'Fact' },
  observation: { pl: 'Obserwacja', en: 'Observation' },
  hypothesis: { pl: 'Hipoteza', en: 'Hypothesis' },
};

/** Same tone mapping as SwotLiveArtifact.tsx's EVIDENCE_TONE — single source of truth. */
const EVIDENCE_TYPE_TONE: Record<SWOTEvidenceType, string> = {
  fact: 'text-c-success',
  observation: 'text-c-info',
  hypothesis: 'text-c-warning',
};

const CLASSIFICATION_LABEL: Record<SWOTStrengthClassification, { pl: string; en: string }> = {
  'core-competency': { pl: 'Rdzeń kompetencji', en: 'Core competency' },
  'niche-strength': { pl: 'Siła niszowa', en: 'Niche strength' },
  'claimed-strength': { pl: 'Deklarowana siła', en: 'Claimed strength' },
  'table-stakes': { pl: 'Standard rynkowy', en: 'Table stakes' },
};

const CONFIDENCE_LEVELS = [1, 2, 3, 4, 5] as const;

export interface EvidenceEditorProps {
  item: SWOTItem;
  isPolish: boolean;
  onChange: (patch: Partial<SWOTItem>) => void;
}

export function EvidenceEditor({ item, isPolish, onChange }: EvidenceEditorProps) {
  const [open, setOpen] = useState(false);
  const gate = evaluateSwotAcceptGate(item);
  const isAccepted = item.status === 'accepted' || item.proposalStatus === 'accepted';

  const statusBadge = (() => {
    if (!isAccepted) return null;
    if (!gate.ok) {
      // Structurally shouldn't happen for an already-accepted item, but stay
      // honest if the item was mutated after acceptance (e.g. classification
      // changed to an unvalidated one post-hoc).
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-danger-50 px-2 py-0.5 text-[10px] font-semibold text-danger-700 dark:bg-danger-900/30 dark:text-danger-300">
          <AlertTriangle className="h-3 w-3" />
          {isPolish ? 'Wymaga ponownej akceptacji' : 'Needs re-accept'}
        </span>
      );
    }
    return gate.evidenceStatus === 'confirmed' ? (
      <span className="rounded-full bg-c-success/10 px-2 py-0.5 text-[10px] font-semibold text-c-success">
        {isPolish ? 'Potwierdzone' : 'Confirmed'}
      </span>
    ) : (
      <span className="rounded-full bg-c-warning/10 px-2 py-0.5 text-[10px] font-semibold text-c-warning">
        {gate.evidenceLabel ? (isPolish ? gate.evidenceLabel.pl : gate.evidenceLabel.en) : ''}
      </span>
    );
  })();

  return (
    <div className="mt-2 border-t border-slate-100 pt-2 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        aria-expanded={open}
      >
        <span className="flex items-center gap-2">
          {isPolish ? 'Dowód i klasyfikacja' : 'Evidence & classification'}
          {statusBadge}
        </span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open ? (
        <div className="mt-2 space-y-2 rounded-xl bg-slate-50/70 p-2.5 dark:bg-white/[0.03]">
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {isPolish ? 'Typ dowodu' : 'Evidence type'}
              <select
                value={item.evidenceType ?? ''}
                onChange={(e) =>
                  onChange({
                    evidenceType: (e.target.value || undefined) as SWOTEvidenceType | undefined,
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
              >
                <option value="">{isPolish ? '— wybierz —' : '— choose —'}</option>
                {(Object.keys(EVIDENCE_TYPE_LABEL) as SWOTEvidenceType[]).map((key) => (
                  <option key={key} value={key} className={EVIDENCE_TYPE_TONE[key]}>
                    {isPolish ? EVIDENCE_TYPE_LABEL[key].pl : EVIDENCE_TYPE_LABEL[key].en}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {isPolish ? 'Siła / wiarygodność' : 'Strength / credibility'}
              <select
                value={item.confidence ?? ''}
                onChange={(e) =>
                  onChange({
                    confidence: e.target.value ? Number(e.target.value) : undefined,
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
              >
                <option value="">{isPolish ? '— brak —' : '— none —'}</option>
                {CONFIDENCE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}/5
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {isPolish ? 'Opis dowodu' : 'Evidence description'}
            <textarea
              value={item.evidenceNote ?? ''}
              onChange={(e) => onChange({ evidenceNote: e.target.value })}
              rows={2}
              placeholder={
                isPolish
                  ? 'Co dokładnie widzieliście / zmierzyliście / usłyszeliście?'
                  : 'What exactly did you see / measure / hear?'
              }
              className="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
            />
          </label>

          <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {isPolish ? 'Źródło' : 'Source'}
            <input
              value={item.evidenceSource ?? ''}
              onChange={(e) => onChange({ evidenceSource: e.target.value })}
              placeholder={
                isPolish ? 'np. wywiad z klientem X, raport Q3, benchmark' : 'e.g. interview with client X, Q3 report, benchmark'
              }
              className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
            />
          </label>

          {item.quadrant === 'strengths' ? (
            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {isPolish ? 'Klasyfikacja siły' : 'Strength classification'}
              <select
                value={item.classification ?? ''}
                onChange={(e) =>
                  onChange({
                    classification: (e.target.value || undefined) as
                      | SWOTStrengthClassification
                      | undefined,
                  })
                }
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-c-focus dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
              >
                <option value="">{isPolish ? '— brak —' : '— none —'}</option>
                {(Object.keys(CLASSIFICATION_LABEL) as SWOTStrengthClassification[]).map((key) => (
                  <option key={key} value={key}>
                    {isPolish ? CLASSIFICATION_LABEL[key].pl : CLASSIFICATION_LABEL[key].en}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!gate.ok ? (
            <div className="flex items-start gap-1.5 rounded-lg bg-danger-50 px-2 py-1.5 text-[11px] text-danger-700 dark:bg-danger-900/20 dark:text-danger-300">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{isPolish ? gate.message.pl : gate.message.en}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default EvidenceEditor;
