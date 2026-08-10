/**
 * IdeaMaturityGate — inspectable stage-gate panel for the Idea maturity model
 * (Program D, E08). Renders EVERY stage's criteria (met/missing, mandatory
 * vs optional, derived vs user-attested) so a user can see WHY an Idea is
 * not yet at the next stage, not just a stage badge.
 *
 * Pure presentational shell over `ideaMaturityModel.ts` — all evaluation
 * logic lives there; this component only renders `MaturityReport` and, for
 * `attested` criteria, offers a checkbox + note the host can wire to
 * persistence (see `onAttest`). When persistence isn't available yet
 * (`attestationsSupported=false` — the additive `maturity_gates_json` column
 * from `server/migrations/20260810_idea_maturity_gates.sql` has not been
 * applied), the checkbox is disabled with an explanatory label instead of
 * silently pretending the click saved anything.
 */
import { AlertTriangle, Check, CheckCircle2, ChevronDown, ChevronRight, Circle } from 'lucide-react';
import React, { useState } from 'react';

import type {
  MaturityCriterionResult,
  MaturityReport,
  MaturityStageId,
} from '../ideaMaturityModel';
import { MATURITY_STAGE_ORDER } from '../ideaMaturityModel';

export interface IdeaMaturityGateProps {
  report: MaturityReport;
  isPolish?: boolean;
  /** Whether attested criteria can actually be persisted (see file header). */
  attestationsSupported?: boolean;
  /** Called when the user toggles an attested criterion. Host owns the API call + refresh. */
  onAttest?: (criterionId: string, met: boolean, note: string) => void;
  /** Collapsed by default except the current + next stage. */
  defaultExpandAll?: boolean;
}

const CriterionRow: React.FC<{
  criterion: MaturityCriterionResult;
  isPolish: boolean;
  attestationsSupported: boolean;
  onAttest?: (criterionId: string, met: boolean, note: string) => void;
}> = ({ criterion, isPolish, attestationsSupported, onAttest }) => {
  const [noteDraft, setNoteDraft] = useState(criterion.note || '');
  const [editingNote, setEditingNote] = useState(false);
  const label = isPolish ? criterion.label.pl : criterion.label.en;
  const explain = isPolish ? criterion.explain.pl : criterion.explain.en;
  const canAttest = criterion.kind === 'attested' && attestationsSupported && onAttest;

  return (
    <div className="py-1.5">
      <div className="flex items-start gap-2">
        {criterion.kind === 'attested' ? (
          <button
            type="button"
            disabled={!canAttest}
            onClick={() => canAttest && onAttest?.(criterion.id, !criterion.met, noteDraft)}
            className={`mt-0.5 flex-shrink-0 h-3.5 w-3.5 rounded-sm border flex items-center justify-center ${
              criterion.met
                ? 'bg-c-success border-c-success text-white'
                : 'border-c-border-subtle'
            } ${canAttest ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
            title={
              canAttest
                ? undefined
                : isPolish
                  ? 'Wymaga potwierdzenia po stronie serwera (migracja jeszcze nie odpalona).'
                  : 'Requires server-side attestation (migration not applied yet).'
            }
          >
            {criterion.met ? <Check size={10} /> : null}
          </button>
        ) : criterion.met ? (
          <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0 text-c-success" />
        ) : (
          <Circle size={14} className="mt-0.5 flex-shrink-0 text-c-text-muted" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`text-xs ${criterion.met ? 'text-c-text' : 'text-c-text-muted'} ${
                criterion.mandatory ? 'font-medium' : ''
              }`}
            >
              {label}
            </span>
            {!criterion.mandatory && (
              <span className="text-[9px] uppercase tracking-wide text-c-text-muted">
                {isPolish ? 'opcjonalne' : 'optional'}
              </span>
            )}
            {criterion.kind === 'attested' && (
              <span className="text-[9px] uppercase tracking-wide text-c-text-muted">
                {isPolish ? 'ręczne' : 'manual'}
              </span>
            )}
          </div>
          <p className="text-[10.5px] text-c-text-muted mt-0.5 leading-snug">{explain}</p>
          {criterion.kind === 'attested' && canAttest && (
            <div className="mt-1">
              {editingNote ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    onBlur={() => setEditingNote(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onAttest?.(criterion.id, criterion.met, noteDraft);
                        setEditingNote(false);
                      }
                    }}
                    placeholder={isPolish ? 'Notatka (opcjonalnie)' : 'Note (optional)'}
                    className="text-[10.5px] px-1.5 py-0.5 rounded border border-c-border-subtle bg-c-surface flex-1"
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingNote(true)}
                  className="text-[10.5px] text-c-text-muted underline decoration-dotted"
                >
                  {criterion.note ||
                    (isPolish ? '+ dodaj notatkę' : '+ add note')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StageBlock: React.FC<{
  stageId: MaturityStageId;
  report: MaturityReport;
  isPolish: boolean;
  open: boolean;
  onToggle: () => void;
  attestationsSupported: boolean;
  onAttest?: (criterionId: string, met: boolean, note: string) => void;
}> = ({ stageId, report, isPolish, open, onToggle, attestationsSupported, onAttest }) => {
  const stage = report.stages.find((s) => s.id === stageId)!;
  const isComputedCurrent = report.computedBucket === stageId;
  const isPast = MATURITY_STAGE_ORDER.indexOf(stageId) < MATURITY_STAGE_ORDER.indexOf(report.computedBucket);

  return (
    <div className="border-b border-c-border-subtle last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-1 py-2 text-left hover:bg-c-surface-raised transition-colors"
      >
        {open ? (
          <ChevronDown size={12} className="text-c-text-muted flex-shrink-0" />
        ) : (
          <ChevronRight size={12} className="text-c-text-muted flex-shrink-0" />
        )}
        <span
          className={`text-[11px] font-semibold uppercase tracking-wide flex-1 ${
            isPast || stage.allMandatoryMet
              ? 'text-c-success'
              : isComputedCurrent
                ? 'text-c-text'
                : 'text-c-text-muted'
          }`}
        >
          {isPolish ? stage.label.pl : stage.label.en}
        </span>
        <span className="text-[10px] text-c-text-muted">
          {stage.criteria.filter((c) => c.met).length}/{stage.criteria.length}
        </span>
      </button>
      {open && (
        <div className="px-1 pb-2.5 divide-y divide-c-border-subtle/60">
          {stage.criteria.map((c) => (
            <CriterionRow
              key={c.id}
              criterion={c}
              isPolish={isPolish}
              attestationsSupported={attestationsSupported}
              onAttest={onAttest}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const IdeaMaturityGate: React.FC<IdeaMaturityGateProps> = ({
  report,
  isPolish = false,
  attestationsSupported = false,
  onAttest,
  defaultExpandAll = false,
}) => {
  const [openStages, setOpenStages] = useState<Set<MaturityStageId>>(
    () =>
      new Set(
        defaultExpandAll
          ? MATURITY_STAGE_ORDER
          : [report.computedBucket, report.nextStage].filter(Boolean) as MaturityStageId[]
      )
  );

  const toggle = (id: MaturityStageId) =>
    setOpenStages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="text-c-text">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-c-text-muted">
          {isPolish ? 'Model dojrzałości' : 'Maturity model'}
        </span>
        <span className="text-[10.5px] text-c-text-muted">
          {isPolish ? 'Rzeczywisty etap: ' : 'Actual stage: '}
          <strong className="text-c-text">
            {isPolish
              ? report.stages.find((s) => s.id === report.computedBucket)?.label.pl
              : report.stages.find((s) => s.id === report.computedBucket)?.label.en}
          </strong>
        </span>
      </div>

      {report.overclaimed && (
        <div className="mb-2 flex items-start gap-1.5 rounded-md border border-c-warning/40 bg-c-warning/10 px-2 py-1.5">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0 text-c-warning" />
          <p className="text-[10.5px] text-c-warning leading-snug">
            {isPolish
              ? `Etap oznaczony jako "${report.stages.find((s) => s.id === report.storedBucket)?.label.pl}", ale kryteria potwierdzają tylko "${report.stages.find((s) => s.id === report.computedBucket)?.label.pl}".`
              : `Stage label says "${report.stages.find((s) => s.id === report.storedBucket)?.label.en}" but the gates only support "${report.stages.find((s) => s.id === report.computedBucket)?.label.en}".`}
          </p>
        </div>
      )}

      {report.nextStage && report.blockersForNext.length > 0 && (
        <div className="mb-2 rounded-md border border-c-border-subtle bg-c-surface-raised px-2 py-1.5">
          <p className="text-[10.5px] font-medium text-c-text mb-1">
            {isPolish
              ? `Aby osiągnąć "${report.stages.find((s) => s.id === report.nextStage)?.label.pl}", brakuje:`
              : `To reach "${report.stages.find((s) => s.id === report.nextStage)?.label.en}", missing:`}
          </p>
          <ul className="space-y-0.5">
            {report.blockersForNext.slice(0, 5).map((c) => (
              <li key={c.id} className="text-[10.5px] text-c-text-muted">
                • {isPolish ? c.label.pl : c.label.en}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        {MATURITY_STAGE_ORDER.map((id) => (
          <StageBlock
            key={id}
            stageId={id}
            report={report}
            isPolish={isPolish}
            open={openStages.has(id)}
            onToggle={() => toggle(id)}
            attestationsSupported={attestationsSupported}
            onAttest={onAttest}
          />
        ))}
      </div>
    </div>
  );
};

export default IdeaMaturityGate;
