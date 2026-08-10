/**
 * IdeaDecisionLogPanel — real decision log for Ideas (Program D / epic E08,
 * master program §6.4), wiring `ideaDecisionGovernance.ts` into a screen a
 * user can actually reach (2026-08-10).
 *
 * ── WHAT THIS REPLACES / DOES NOT TOUCH ─────────────────────────────────────
 * The Table tool's existing "Log decyzji" saved VIEW (`decision_log` preset,
 * `DECISION_COLUMN_KEY = 'decision'`) is a column-preset that GROUPS rows by
 * a single `select` field with four status VALUES (open/made/deferred/
 * rejected) — see `ViewSetupEmptyState.tsx`'s own header comment: "a status
 * chip on a row, not a decision log". This panel is a DIFFERENT, additive
 * surface: it does not touch `data.decision`/`DECISION_COLUMN_KEY`, does not
 * remove the saved view, and does not change what that view groups by. It
 * writes a real, structured, append-only history to a NEW field,
 * `data.decisionLog: DecisionLogEntry[]`, reachable via a toolbar/kebab
 * button ("Decyzja") next to Scoring Model, mirroring that dialog's shape.
 *
 * ── ROLE ─────────────────────────────────────────────────────────────────
 * `DecisionRole` is derived from the app's REAL permission system
 * (`useUserCan()`, `src/hooks/useUserCan.ts`) rather than invented:
 *   isSuperAdmin/isAdmin  → 'admin'
 *   canApprove (MANAGER)  → 'approver'
 *   canEdit               → 'contributor'
 *   otherwise             → 'viewer'
 * This is an honest, coarse mapping (the app has no native `DecisionRole`
 * concept) — see the report for the exact reasoning.
 *
 * ── FINANCIAL FRESHNESS (E08 §6.4 × E09 §7, epic B4) ────────────────────────
 * `financialFreshnessProvider` is an optional prop; when the caller does not
 * supply one this panel uses `UNWIRED_FINANCIAL_FRESHNESS_PROVIDER` (honest
 * "unknown", never silently promoted to "fresh") — see `IdeaTableTool.tsx`
 * for whether/how a real provider is threaded in.
 */
import { AlertTriangle, Plus, RotateCcw, Save, Scale, ShieldAlert, X } from 'lucide-react';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useUserCan } from '@/hooks/useUserCan';

import {
  canRecordOutcome,
  canReopenDecision,
  createDecisionEntry,
  DECISION_OUTCOMES,
  type DecisionAlternative,
  type DecisionLogEntry,
  type DecisionOutcome,
  type DecisionRole,
  evaluateApprovalGate,
  type FinancialFreshnessProvider,
  getActiveDecisions,
  recordDecisionOutcome,
  reopenDecision,
  UNWIRED_FINANCIAL_FRESHNESS_PROVIDER,
  validateDecisionEntry,
} from './ideaDecisionGovernance';
import type { TableNode } from './tableTypes';

export interface IdeaDecisionLogPanelProps {
  open: boolean;
  onClose: () => void;
  nodes: TableNode[];
  ideaId: string;
  /** Writes back the FULL next `decisionLog` array for one row — the caller
   *  (`IdeaTableTool`) owns persistence (same `nodesUndo` pattern every other
   *  tool dialog in that file uses). */
  onApplyDecisionLog: (nodeId: string, nextLog: DecisionLogEntry[]) => void;
  financialFreshnessProvider?: FinancialFreshnessProvider;
}

const OUTCOME_LABEL: Record<DecisionOutcome, { pl: string; en: string }> = {
  approved: { pl: 'Zatwierdź', en: 'Approve' },
  rejected: { pl: 'Odrzuć', en: 'Reject' },
  returned_for_evidence: { pl: 'Zwróć po dowody', en: 'Return for evidence' },
  deferred: { pl: 'Odłóż', en: 'Defer' },
};

function mapAppRoleToDecisionRole(can: ReturnType<typeof useUserCan>): DecisionRole {
  if (can.isSuperAdmin || can.isAdmin) return 'admin';
  if (can.canApprove) return 'approver';
  if (can.canEdit) return 'contributor';
  return 'viewer';
}

const INPUT_CLASS =
  'w-full h-8 px-2.5 rounded-md text-[11px] bg-c-surface border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-focus transition-colors';
const TEXTAREA_CLASS =
  'w-full px-2.5 py-2 rounded-md text-[11px] bg-c-surface border border-c-border-subtle text-c-text placeholder:text-c-text-muted focus:outline-none focus:border-c-focus transition-colors resize-none';
const LABEL_CLASS = 'text-[9.5px] font-bold uppercase tracking-wide text-c-text-muted mb-1 block';

export const IdeaDecisionLogPanel: React.FC<IdeaDecisionLogPanelProps> = ({
  open,
  onClose,
  nodes,
  ideaId,
  onApplyDecisionLog,
  financialFreshnessProvider = UNWIRED_FINANCIAL_FRESHNESS_PROVIDER,
}) => {
  const { t, i18n } = useTranslation();
  const isPl = i18n.language?.startsWith('pl');
  const can = useUserCan();
  const role = mapAppRoleToDecisionRole(can);

  const [selectedNodeId, setSelectedNodeId] = useState<string>(nodes[0]?.id ?? '');
  const [draftQuestion, setDraftQuestion] = useState('');
  const [draftRecommendation, setDraftRecommendation] = useState('');
  const [draftApprover, setDraftApprover] = useState('');
  const [draftAlternatives, setDraftAlternatives] = useState<DecisionAlternative[]>([]);
  const [draftRequiredEvidence, setDraftRequiredEvidence] = useState<string[]>([]);
  const [draftEvidenceRefs, setDraftEvidenceRefs] = useState<string[]>([]);
  const [rationale, setRationale] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Always a resolved value in state, never the possibly-async provider's
  // return type directly — `selectNode`/the mount effect below resolve any
  // Promise before it ever reaches state.
  const [freshness, setFreshness] = useState<ReturnType<typeof UNWIRED_FINANCIAL_FRESHNESS_PROVIDER>>(
    () => ({ status: 'unknown', reason: 'Loading…' })
  );

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const log: DecisionLogEntry[] = Array.isArray(selectedNode?.data?.decisionLog)
    ? selectedNode!.data!.decisionLog
    : [];
  const active = getActiveDecisions(log)[0] ?? null;

  React.useEffect(() => {
    let cancelled = false;
    Promise.resolve(financialFreshnessProvider(selectedNodeId)).then((r) => {
      if (!cancelled) setFreshness(r);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const selectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setError(null);
      setRationale('');
      Promise.resolve(financialFreshnessProvider(nodeId)).then(setFreshness);
    },
    [financialFreshnessProvider]
  );

  const handleCreateDraft = useCallback(() => {
    setError(null);
    const validation = validateDecisionEntry({
      id: 'draft',
      ideaId,
      version: 1,
      question: draftQuestion,
      alternatives: draftAlternatives,
      recommendation: draftRecommendation,
      approver: draftApprover,
      decision: 'pending',
      evidenceRefs: draftEvidenceRefs,
      requiredEvidenceKeys: draftRequiredEvidence,
      createdAt: new Date().toISOString(),
    });
    if (validation.length > 0) {
      setError(validation.map((e) => e.message).join(' '));
      return;
    }
    const entry = createDecisionEntry({
      id: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ideaId,
      question: draftQuestion,
      alternatives: draftAlternatives,
      recommendation: draftRecommendation,
      approver: draftApprover,
      requiredEvidenceKeys: draftRequiredEvidence,
      evidenceRefs: draftEvidenceRefs,
    });
    onApplyDecisionLog(selectedNodeId, [...log, entry]);
    setDraftQuestion('');
    setDraftRecommendation('');
    setDraftApprover('');
    setDraftAlternatives([]);
    setDraftRequiredEvidence([]);
    setDraftEvidenceRefs([]);
  }, [
    draftAlternatives,
    draftApprover,
    draftEvidenceRefs,
    draftQuestion,
    draftRecommendation,
    draftRequiredEvidence,
    ideaId,
    log,
    onApplyDecisionLog,
    selectedNodeId,
  ]);

  const gate = active ? evaluateApprovalGate(active, { financialFreshness: freshness }) : null;

  const handleRecord = useCallback(
    (outcome: DecisionOutcome) => {
      if (!active) return;
      setError(null);
      try {
        const next = recordDecisionOutcome(active, {
          outcome,
          rationale,
          decidedBy: 'current-user',
          role,
          financialFreshness: freshness,
        });
        onApplyDecisionLog(
          selectedNodeId,
          log.map((e) => (e.id === next.id ? next : e))
        );
        setRationale('');
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [active, freshness, log, onApplyDecisionLog, rationale, role, selectedNodeId]
  );

  const handleReopen = useCallback(() => {
    if (!active) return;
    setError(null);
    try {
      const { previous, next } = reopenDecision(active, {
        role,
        nextId: `dec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      onApplyDecisionLog(
        selectedNodeId,
        log.map((e) => (e.id === previous.id ? previous : e)).concat(next)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [active, log, onApplyDecisionLog, role, selectedNodeId]);

  const canReopen = canReopenDecision(role);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[92vw] max-h-[88vh] rounded-2xl border border-slate-200/60 dark:border-white/[0.03] bg-c-surface shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-c-border-subtle shrink-0">
          <Scale size={16} className="text-c-text-secondary" />
          <span className="text-sm font-bold text-c-text">
            {isPl ? 'Log decyzji' : 'Decision log'}
          </span>
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-c-surface-raised text-c-text-muted uppercase">
            {role}
          </span>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-c-surface-raised transition-colors"
            aria-label={t('common.close', 'Close')}
          >
            <X size={14} className="text-c-text-secondary" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-c-border-subtle shrink-0">
          <span className={LABEL_CLASS}>{isPl ? 'Idea' : 'Idea'}</span>
          <select
            className={INPUT_CLASS}
            value={selectedNodeId}
            onChange={(e) => selectNode(e.target.value)}
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.data?.label || n.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 space-y-3">
          {error && (
            <div className="flex items-center gap-1.5 text-[11px] text-c-danger bg-c-danger/5 border border-c-danger/20 rounded-md px-2 py-1.5">
              <AlertTriangle size={12} />
              {error}
            </div>
          )}

          {!active ? (
            <div className="space-y-2.5">
              <p className="text-[11px] text-c-text-muted italic">
                {isPl
                  ? 'Brak decyzji dla tej idei — utwórz pierwszy wpis.'
                  : 'No decision yet for this idea — create the first entry.'}
              </p>
              <label>
                <span className={LABEL_CLASS}>{isPl ? 'Pytanie decyzyjne' : 'Decision question'}</span>
                <textarea
                  className={TEXTAREA_CLASS}
                  rows={2}
                  value={draftQuestion}
                  onChange={(e) => setDraftQuestion(e.target.value)}
                />
              </label>
              <label>
                <span className={LABEL_CLASS}>{isPl ? 'Rekomendacja' : 'Recommendation'}</span>
                <textarea
                  className={TEXTAREA_CLASS}
                  rows={2}
                  value={draftRecommendation}
                  onChange={(e) => setDraftRecommendation(e.target.value)}
                />
              </label>
              <label>
                <span className={LABEL_CLASS}>{isPl ? 'Zatwierdzający' : 'Approver'}</span>
                <input
                  className={INPUT_CLASS}
                  value={draftApprover}
                  onChange={(e) => setDraftApprover(e.target.value)}
                />
              </label>
              <label>
                <span className={LABEL_CLASS}>
                  {isPl
                    ? 'Wymagane dowody przed zatwierdzeniem (po przecinku)'
                    : 'Required evidence before approval (comma-separated)'}
                </span>
                <input
                  className={INPUT_CLASS}
                  value={draftRequiredEvidence.join(', ')}
                  onChange={(e) =>
                    setDraftRequiredEvidence(
                      e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                    )
                  }
                />
              </label>
              <label>
                <span className={LABEL_CLASS}>
                  {isPl ? 'Dowody już dostarczone (po przecinku)' : 'Evidence already attached (comma-separated)'}
                </span>
                <input
                  className={INPUT_CLASS}
                  value={draftEvidenceRefs.join(', ')}
                  onChange={(e) =>
                    setDraftEvidenceRefs(
                      e.target.value.split(',').map((v) => v.trim()).filter(Boolean)
                    )
                  }
                />
              </label>
              <button
                type="button"
                onClick={handleCreateDraft}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold bg-c-text text-c-surface hover:opacity-90 transition-opacity"
              >
                <Plus size={12} />
                {isPl ? 'Utwórz wpis' : 'Create entry'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-c-border-subtle bg-c-surface-raised p-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-c-text">{active.question}</p>
                <p className="text-[10.5px] text-c-text-muted">{active.recommendation}</p>
                <div className="flex items-center gap-2 text-[10px] text-c-text-muted">
                  <span>
                    {isPl ? 'Wersja' : 'Version'} {active.version}
                  </span>
                  <span>·</span>
                  <span>
                    {isPl ? 'Zatwierdzający' : 'Approver'}: {active.approver}
                  </span>
                  <span>·</span>
                  <span className="uppercase font-bold">{active.decision}</span>
                </div>
                {active.rationale && (
                  <p className="text-[10.5px] text-c-text italic">"{active.rationale}"</p>
                )}
              </div>

              {gate && gate.blocked && (
                <div className="flex items-start gap-1.5 text-[11px] text-c-warning bg-c-warning/5 border border-c-warning/20 rounded-md px-2 py-1.5">
                  <ShieldAlert size={13} className="shrink-0 mt-0.5" />
                  <div>
                    {isPl ? 'Zatwierdzenie zablokowane: ' : 'Approval blocked: '}
                    {gate.blockers
                      .map((b) =>
                        b.type === 'missing-evidence'
                          ? (isPl ? 'brak dowodów: ' : 'missing evidence: ') + b.missingKeys.join(', ')
                          : (isPl ? 'nieaktualna karta finansowa' : 'stale financial case') +
                            (b.reason ? ` (${b.reason})` : '')
                      )
                      .join(' · ')}
                  </div>
                </div>
              )}
              {gate && gate.warnings.length > 0 && (
                <p className="text-[10px] text-c-text-muted italic">{gate.warnings.join(' · ')}</p>
              )}

              {active.decision === 'pending' ? (
                <div className="space-y-2">
                  <label>
                    <span className={LABEL_CLASS}>{isPl ? 'Uzasadnienie (wymagane)' : 'Rationale (required)'}</span>
                    <textarea
                      className={TEXTAREA_CLASS}
                      rows={2}
                      value={rationale}
                      onChange={(e) => setRationale(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {DECISION_OUTCOMES.map((o) => {
                      const allowed = canRecordOutcome(role, o);
                      const blockedByGate = o === 'approved' && gate?.blocked;
                      return (
                        <button
                          key={o}
                          type="button"
                          disabled={!allowed || !rationale.trim() || blockedByGate}
                          onClick={() => handleRecord(o)}
                          title={
                            !allowed
                              ? isPl
                                ? `Rola "${role}" nie może zapisać wyniku "${o}".`
                                : `Role "${role}" may not record outcome "${o}".`
                              : blockedByGate
                                ? isPl
                                  ? 'Zablokowane przez bramkę zatwierdzenia — patrz wyżej.'
                                  : 'Blocked by the approval gate — see above.'
                                : undefined
                          }
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10.5px] font-semibold bg-c-surface-raised text-c-text border border-c-border-subtle hover:bg-c-border-subtle disabled:opacity-40 transition-colors"
                        >
                          <Save size={11} />
                          {isPl ? OUTCOME_LABEL[o].pl : OUTCOME_LABEL[o].en}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                canReopen && (
                  <button
                    type="button"
                    onClick={handleReopen}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10.5px] font-semibold bg-c-surface-raised text-c-text border border-c-border-subtle hover:bg-c-border-subtle transition-colors"
                  >
                    <RotateCcw size={11} />
                    {isPl ? 'Otwórz ponownie (nowa wersja)' : 'Reopen (new version)'}
                  </button>
                )
              )}

              {log.length > 1 && (
                <div className="pt-2 border-t border-c-border-subtle">
                  <span className={LABEL_CLASS}>{isPl ? 'Historia wersji' : 'Version history'}</span>
                  <div className="space-y-1">
                    {log
                      .filter((e) => e.id !== active.id)
                      .map((e) => (
                        <div
                          key={e.id}
                          className="flex items-center gap-2 text-[10px] text-c-text-muted"
                        >
                          <span>
                            v{e.version} — {e.decision}
                            {e.decidedAt ? ` (${new Date(e.decidedAt).toLocaleDateString()})` : ''}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IdeaDecisionLogPanel;
