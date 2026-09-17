import { Check, HelpCircle, Paperclip, Sparkles, X } from 'lucide-react';
import React, { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { MENU_1_PRIMARY_CTA } from '@/components/shared/ModuleMenu3';
import type { MethodEvent, MethodLevel, MethodQuestion } from '@/method-core/contracts';
import type { DRDArea, DRDAxis } from '@/services/drdStructure';
import { nazwaWJezyku } from './drdNazwa';

export type DrdLevelDecision = 'yes' | 'no' | 'help';

export class DrdLevelDecisionSaveError extends Error {}

const HELP_MARKER = '[DRD_NEED_HELP]';

export function drdLevelDecisions(events: readonly MethodEvent[], unitId: string): Map<number, DrdLevelDecision> {
  const decisions = new Map<number, DrdLevelDecision>();
  for (const event of events) {
    if (event.unitId !== unitId || event.type !== 'ANSWER_CONFIRMED' || typeof event.level !== 'number') continue;
    const payload = event.payload as { answerState?: string; justification?: string } | undefined;
    if (payload?.answerState === 'confirmed') decisions.set(event.level, 'yes');
    else if (payload?.answerState === 'no') decisions.set(event.level, 'no');
    else if (payload?.answerState === 'dont_know' && payload.justification?.includes(HELP_MARKER)) {
      decisions.set(event.level, 'help');
    }
  }
  return decisions;
}

export const DRD_HELP_JUSTIFICATION_MARKER = HELP_MARKER;

export function pickDrdEvidenceOwnerId(payload: unknown, fallbackOwnerId: string): string {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : root;
  const roles = Array.isArray(data.roles) ? data.roles : [];
  const evidenceOwner = roles.find((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    return (entry as Record<string, unknown>).role === 'evidence_owner';
  }) as Record<string, unknown> | undefined;
  return typeof evidenceOwner?.userId === 'string' && evidenceOwner.userId.trim()
    ? evidenceOwner.userId
    : fallbackOwnerId;
}

interface Props {
  axis: DRDAxis;
  area: DRDArea;
  levels: readonly MethodLevel[];
  questions: readonly MethodQuestion[];
  events: readonly MethodEvent[];
  selectedLevel: number;
  currentLevel: number | null;
  targetLevel: number | null;
  answerText: string;
  canWrite: boolean;
  onAnswerChange: (questionId: string, text: string) => void;
  onSelectLevel: (level: number) => void;
  onSaveDecision: (decision: DrdLevelDecision, answerText: string) => Promise<void>;
  onEvidenceDrop: (questionId: string, files: FileList) => void;
  onAskTeresa: (questionId: string) => void;
}

const LABEL: Record<DrdLevelDecision, string> = { yes: 'Yes', no: 'No', help: 'I need help' };
const DOT: Record<DrdLevelDecision, string> = { yes: 'bg-c-success', no: 'bg-c-text-muted', help: 'bg-c-text-muted' };

export function DrdLevelInterviewWorkspace({
  axis,
  area,
  levels,
  questions,
  events,
  selectedLevel,
  currentLevel,
  targetLevel,
  answerText,
  canWrite,
  onAnswerChange,
  onSelectLevel,
  onSaveDecision,
  onEvidenceDrop,
  onAskTeresa,
}: Props): React.ReactElement {
  const { t, i18n } = useTranslation();
  const isPolish = (i18n.language || 'en').toLowerCase().startsWith('pl');
  const [decision, setDecision] = useState<DrdLevelDecision | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const decisions = useMemo(() => drdLevelDecisions(events, area.id), [events, area.id]);
  const level = levels.find((item) => item.level === selectedLevel) ?? levels[0];
  const levelQuestions = questions.filter((question) => question.level === level?.level);
  const primaryQuestion = levelQuestions[0];
  const evidenceCount = events.filter(
    (event) => event.type === 'EVIDENCE_ATTACHED' && event.unitId === area.id && event.level === level?.level
  ).length;
  const firstNo = [...decisions.entries()].find(([, state]) => state === 'no')?.[0] ?? null;
  const areaName = nazwaWJezyku(area.namePL, area.name, isPolish);
  const axisName = nazwaWJezyku(axis.namePL, axis.name, isPolish);

  const save = async () => {
    if (!decision || !canWrite) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveDecision(decision, answerText);
      setDecision(null);
    } catch (error) {
      setSaveError(
        error instanceof DrdLevelDecisionSaveError
          ? error.message
          : t('common.saveError')
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="-m-4 flex h-[calc(100%+2rem)] min-h-0" data-testid="drd-level-interview-v2">
      <aside className="hidden w-64 shrink-0 flex-col overflow-y-auto border-r border-c-border-subtle bg-c-bg lg:flex" data-testid="drd-levels-column">
        <div className="sticky top-0 z-10 border-b border-c-border-subtle bg-c-bg px-3 py-2.5">
          <p className="truncate text-xs font-semibold text-c-text">{areaName}</p>
          <p className="mt-0.5 text-[11px] text-c-text-muted">
            {t('assessment.drd.levelInterview.summary', 'Levels 1–{{count}} · current {{current}} · target {{target}}', {
              count: levels.length,
              current: currentLevel ?? '—',
              target: targetLevel ?? '—',
            })}
          </p>
        </div>
        <ul className="flex-1 space-y-0.5 p-2">
          {levels.map((item) => {
            const state = decisions.get(item.level);
            const selected = item.level === level.level;
            const disabled = firstNo !== null && item.level > firstNo;
            return (
              <li key={item.level}>
                <button
                  type="button"
                  disabled={disabled}
                  aria-current={selected ? 'true' : undefined}
                  onClick={() => onSelectLevel(item.level)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-xs ${selected ? 'bg-c-surface-raised text-c-text ring-1 ring-c-border-strong' : 'text-c-text-secondary hover:bg-c-surface-raised'} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
                >
                  <span className={`mt-0.5 inline-flex h-5 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold tabular-nums ${selected ? 'bg-c-bg text-c-text' : 'bg-c-surface-raised text-c-text-muted'}`}>
                    L{item.level}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${selected ? 'font-semibold' : ''}`}>{item.title}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1">
                      {state ? <span className="inline-flex items-center gap-1 text-[10px] text-c-text-muted"><span className={`h-1.5 w-1.5 rounded-full ${DOT[state]}`} />{t(`assessment.drd.levelInterview.${state}`, LABEL[state])}</span> : <span className="text-[10px] text-c-text-muted">—</span>}
                      {item.level === currentLevel && <span className="rounded-full border border-c-border px-1.5 text-[10px] text-c-text-secondary">{t('assessment.drd.levelInterview.current', 'Current')}</span>}
                      {item.level === targetLevel && <span className="rounded-full border border-c-info/40 px-1.5 text-[10px] text-c-info">{t('assessment.drd.levelInterview.target', 'Target')}</span>}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="max-w-[900px] p-4">
          <section className="rounded-xl border border-c-border bg-c-surface" data-testid="drd-level-workspace">
            <header className="border-b border-c-border-subtle px-4 py-3">
              <p className="text-[11px] text-c-text-muted">{axisName} · {areaName}</p>
              <h2 className="mt-0.5 text-sm font-semibold text-c-text">{t('assessment.drd.levelInterview.levelTitle', 'Level {{level}} — {{name}}', { level: level.level, name: level.title })}</h2>
              <p className="mt-1 line-clamp-2 text-xs text-c-text-secondary">{level.canonicalDefinition}</p>
            </header>
            <details className="border-b border-c-border-subtle px-4 py-2">
              <summary className="cursor-pointer text-xs font-medium text-c-text-secondary hover:text-c-text">{t('assessment.drd.levelInterview.why', 'Why do we ask')}</summary>
              <p className="mt-2 text-xs leading-relaxed text-c-text-muted">{primaryQuestion?.whyItMatters ?? ''}</p>
            </details>
            <div className="border-b border-c-border-subtle px-4 py-3">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-c-text-muted">{t('assessment.drd.levelInterview.helperQuestions', 'Helper questions ({{count}})', { count: levelQuestions.length })}</p>
              <ul className="space-y-1">
                {levelQuestions.map((question, index) => <li key={question.questionId} className={`rounded-lg border px-3 py-2 text-xs ${index === 0 ? 'border-c-border bg-c-surface-raised text-c-text' : 'border-c-border-subtle text-c-text-secondary'}`}><span className="mr-2 text-[10px] font-semibold text-c-text-muted">{index + 1}</span>{question.canonicalWording}</li>)}
              </ul>
            </div>
            <div className="px-4 py-3">
              <label htmlFor="drd-level-answer" className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-c-text-muted">{t('assessment.drd.levelInterview.answer', 'Your answer for this level')}</label>
              <textarea id="drd-level-answer" rows={4} value={answerText} disabled={!canWrite} onChange={(event) => primaryQuestion && onAnswerChange(primaryQuestion.questionId, event.target.value)} className="w-full resize-none rounded-lg border border-c-border bg-c-bg px-3 py-2 text-xs leading-relaxed text-c-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-60" />
              <div className="mt-2 flex items-center justify-between rounded-lg border border-c-border-subtle bg-c-surface-raised px-3 py-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-c-text-secondary"><Paperclip size={12} />{t('assessment.drd.levelInterview.evidence', 'Evidence: {{count}} files', { count: evidenceCount })}</span>
                <span className="inline-flex items-center gap-3">
                  <input ref={fileInput} type="file" className="hidden" onChange={(event) => primaryQuestion && event.target.files && onEvidenceDrop(primaryQuestion.questionId, event.target.files)} />
                  <button type="button" disabled={!canWrite} onClick={() => fileInput.current?.click()} className="text-[11px] font-medium text-c-text-secondary hover:text-c-text disabled:opacity-50">{t('assessment.drd.levelInterview.attach', 'Attach')}</button>
                  <button type="button" disabled={!primaryQuestion} onClick={() => primaryQuestion && onAskTeresa(primaryQuestion.questionId)} className="inline-flex items-center gap-1 text-[11px] font-medium text-c-text-secondary hover:text-c-text disabled:opacity-50"><Sparkles size={11} />{t('assessment.drd.levelInterview.askTeresa', 'Ask Teresa')}</button>
                </span>
              </div>
            </div>
          </section>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-c-border bg-c-surface px-4 py-3" data-testid="drd-level-decision-bar">
            <div className="flex items-center gap-3"><span className="text-[11px] text-c-text-muted">{t('assessment.drd.levelInterview.decision', 'Level {{level}} decision', { level: level.level })}</span><div className="flex items-center gap-1.5">
              {(['yes', 'no', 'help'] as const).map((state) => { const Icon = state === 'yes' ? Check : state === 'no' ? X : HelpCircle; const selected = decision === state; return <button key={state} type="button" disabled={!canWrite} aria-pressed={selected} onClick={() => setDecision(state)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus disabled:opacity-50 ${selected ? state === 'yes' ? 'border-c-success bg-c-success/15 text-c-success' : 'border-c-border-strong bg-c-surface-raised text-c-text' : 'border-c-border bg-c-surface text-c-text-secondary hover:bg-c-surface-raised'}`}><Icon size={13} />{t(`assessment.drd.levelInterview.${state}`, LABEL[state])}</button>; })}
            </div></div>
            <button type="button" disabled={!decision || saving || !canWrite} onClick={() => void save()} className={`${MENU_1_PRIMARY_CTA} disabled:cursor-not-allowed disabled:opacity-50`}>{saving ? t('assessment.drd.levelInterview.saving', 'Saving…') : t('assessment.drd.levelInterview.saveNext', 'Save & next level')}</button>
          </div>
          {saveError && <p role="alert" className="mt-2 text-xs text-c-danger">{saveError}</p>}
        </div>
      </div>
    </div>
  );
}
