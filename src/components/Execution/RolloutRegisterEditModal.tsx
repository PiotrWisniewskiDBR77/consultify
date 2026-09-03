/**
 * RolloutRegisterEditModal — edit modal for the four editable Rollout registers
 * (KPI / Risk / Change / Closure) that RolloutTab.tsx renders via FilterableTable.
 *
 * Replaces the previous INLINE row-editing (every cell was an <input>/<select>
 * that patched on blur/change). The canonical Table+Preview pattern keeps rows
 * read-only and routes edits through a kebab → "Edit" → modal flow. On Save the
 * modal computes a minimal diff and calls the SAME persistence handlers that
 * RolloutTab already owns (patchKpi/patchRisk/patchChange/patchClosure → the
 * /api/rollout/* endpoints in server/src/routes/rollout.routes.ts), so rows
 * persist and survive reload exactly as before.
 *
 * Design canon: ui primitives Modal + Input + Button; navy/slate surfaces with
 * Harvard Crimson on the primary Save action.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button, Input, Modal } from '@/components/ui/primitives';

// Row shapes mirror the interfaces in RolloutTab.tsx (kept structurally
// compatible — these are the persisted /api/rollout/* response rows).
export interface RolloutKpiRow {
  id: string;
  name: string;
  baseline: number;
  target: number;
  current_value: number;
  unit: string;
}
export interface RolloutRiskRow {
  id: string;
  title: string;
  probability: string;
  impact: string;
  mitigation: string | null;
  status: string;
}
export interface RolloutChangeRow {
  id: string;
  title: string;
  type: string;
  status: string;
  impact: string | null;
}
export interface RolloutClosureRow {
  id: string;
  title: string;
  category: string;
  status: string;
}

export type RolloutRegisterKind = 'kpi' | 'risk' | 'change' | 'closure';

export type RolloutEditTarget =
  | { kind: 'kpi'; row: RolloutKpiRow }
  | { kind: 'risk'; row: RolloutRiskRow }
  | { kind: 'change'; row: RolloutChangeRow }
  | { kind: 'closure'; row: RolloutClosureRow };

export interface RolloutRegisterEditModalProps {
  target: RolloutEditTarget | null;
  onClose: () => void;
  /** Persist a KPI diff. Maps to RolloutTab.patchKpi (→ PATCH /rollout/kpis/:id). */
  onSaveKpi: (
    id: string,
    updates: Partial<Omit<RolloutKpiRow, 'id'>> & { currentValue?: number }
  ) => Promise<void> | void;
  /** Persist a Risk diff. Maps to RolloutTab.patchRisk. */
  onSaveRisk: (id: string, updates: Partial<Omit<RolloutRiskRow, 'id'>>) => Promise<void> | void;
  /** Persist a Change diff. Maps to RolloutTab.patchChange. */
  onSaveChange: (
    id: string,
    updates: Partial<Omit<RolloutChangeRow, 'id'>>
  ) => Promise<void> | void;
  /** Persist a Closure diff. Maps to RolloutTab.patchClosure. */
  onSaveClosure: (
    id: string,
    updates: Partial<Omit<RolloutClosureRow, 'id'>>
  ) => Promise<void> | void;
  /** Disable the Save button while a write is in flight (RolloutTab `busy`). */
  busy?: boolean;
}

const FIELD_LABEL =
  'block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1';
const SELECT_CLASS =
  'w-full rounded-lg border border-slate-300 dark:border-navy-600 bg-white dark:bg-navy-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-c-focus';

/**
 * The modal is keyed by `target.row.id` from RolloutTab so React remounts it for
 * each row — the local draft state is therefore re-seeded from the row whenever a
 * new row is opened (no stale draft leaking between rows).
 */
export const RolloutRegisterEditModal: React.FC<RolloutRegisterEditModalProps> = ({
  target,
  onClose,
  onSaveKpi,
  onSaveRisk,
  onSaveChange,
  onSaveClosure,
  busy = false,
}) => {
  const { t } = useTranslation();

  // Draft state, one bag for each register kind. Seeded from `target` on open and
  // whenever the targeted row changes (effect below).
  const [kpiDraft, setKpiDraft] = useState<RolloutKpiRow | null>(null);
  const [riskDraft, setRiskDraft] = useState<RolloutRiskRow | null>(null);
  const [changeDraft, setChangeDraft] = useState<RolloutChangeRow | null>(null);
  const [closureDraft, setClosureDraft] = useState<RolloutClosureRow | null>(null);

  useEffect(() => {
    if (!target) return;
    if (target.kind === 'kpi') setKpiDraft({ ...target.row });
    else if (target.kind === 'risk') setRiskDraft({ ...target.row });
    else if (target.kind === 'change') setChangeDraft({ ...target.row });
    else if (target.kind === 'closure') setClosureDraft({ ...target.row });
  }, [target]);

  const titleByKind = useMemo<Record<RolloutRegisterKind, string>>(
    () => ({
      kpi: t('execution.rollout.kpi.editTitle', 'Edit KPI'),
      risk: t('execution.rollout.risks.editTitle', 'Edit risk'),
      change: t('execution.rollout.change.editTitle', 'Edit change'),
      closure: t('execution.rollout.closure.editTitle', 'Edit closure item'),
    }),
    [t]
  );

  if (!target) return null;

  const handleSave = async () => {
    if (target.kind === 'kpi' && kpiDraft) {
      const orig = target.row;
      const updates: Partial<Omit<RolloutKpiRow, 'id'>> & { currentValue?: number } = {};
      if (kpiDraft.name !== orig.name) updates.name = kpiDraft.name;
      if (Number(kpiDraft.baseline) !== Number(orig.baseline))
        updates.baseline = Number(kpiDraft.baseline);
      if (Number(kpiDraft.target) !== Number(orig.target)) updates.target = Number(kpiDraft.target);
      if (Number(kpiDraft.current_value) !== Number(orig.current_value))
        updates.currentValue = Number(kpiDraft.current_value);
      if (kpiDraft.unit !== orig.unit) updates.unit = kpiDraft.unit;
      if (Object.keys(updates).length > 0) await onSaveKpi(orig.id, updates);
    } else if (target.kind === 'risk' && riskDraft) {
      const orig = target.row;
      const updates: Partial<Omit<RolloutRiskRow, 'id'>> = {};
      if (riskDraft.title !== orig.title) updates.title = riskDraft.title;
      if (riskDraft.probability !== orig.probability) updates.probability = riskDraft.probability;
      if (riskDraft.impact !== orig.impact) updates.impact = riskDraft.impact;
      if ((riskDraft.mitigation ?? '') !== (orig.mitigation ?? ''))
        updates.mitigation = riskDraft.mitigation || null;
      if (riskDraft.status !== orig.status) updates.status = riskDraft.status;
      if (Object.keys(updates).length > 0) await onSaveRisk(orig.id, updates);
    } else if (target.kind === 'change' && changeDraft) {
      const orig = target.row;
      const updates: Partial<Omit<RolloutChangeRow, 'id'>> = {};
      if (changeDraft.title !== orig.title) updates.title = changeDraft.title;
      if (changeDraft.type !== orig.type) updates.type = changeDraft.type;
      if ((changeDraft.impact ?? '') !== (orig.impact ?? ''))
        updates.impact = changeDraft.impact || null;
      if (changeDraft.status !== orig.status) updates.status = changeDraft.status;
      if (Object.keys(updates).length > 0) await onSaveChange(orig.id, updates);
    } else if (target.kind === 'closure' && closureDraft) {
      const orig = target.row;
      const updates: Partial<Omit<RolloutClosureRow, 'id'>> = {};
      if (closureDraft.title !== orig.title) updates.title = closureDraft.title;
      if (closureDraft.category !== orig.category) updates.category = closureDraft.category;
      if (closureDraft.status !== orig.status) updates.status = closureDraft.status;
      if (Object.keys(updates).length > 0) await onSaveClosure(orig.id, updates);
    }
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={titleByKind[target.kind]}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button variant="brand" onClick={() => void handleSave()} loading={busy}>
            {t('common.save', 'Save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {target.kind === 'kpi' && kpiDraft && (
          <>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-kpi-name">
                {t('execution.rollout.kpi.col.name', 'Name')}
              </label>
              <Input
                id="rollout-kpi-name"
                value={kpiDraft.name}
                onChange={(e) => setKpiDraft({ ...kpiDraft, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={FIELD_LABEL} htmlFor="rollout-kpi-baseline">
                  {t('execution.rollout.kpi.baseline', 'Baseline')}
                </label>
                <Input
                  id="rollout-kpi-baseline"
                  type="number"
                  value={String(kpiDraft.baseline)}
                  onChange={(e) => setKpiDraft({ ...kpiDraft, baseline: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="rollout-kpi-current">
                  {t('execution.rollout.kpi.current', 'Current')}
                </label>
                <Input
                  id="rollout-kpi-current"
                  type="number"
                  value={String(kpiDraft.current_value)}
                  onChange={(e) =>
                    setKpiDraft({ ...kpiDraft, current_value: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="rollout-kpi-target">
                  {t('execution.rollout.kpi.target', 'Target')}
                </label>
                <Input
                  id="rollout-kpi-target"
                  type="number"
                  value={String(kpiDraft.target)}
                  onChange={(e) => setKpiDraft({ ...kpiDraft, target: Number(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-kpi-unit">
                {t('execution.rollout.kpi.unit', 'Unit')}
              </label>
              <Input
                id="rollout-kpi-unit"
                value={kpiDraft.unit}
                onChange={(e) => setKpiDraft({ ...kpiDraft, unit: e.target.value })}
              />
            </div>
          </>
        )}

        {target.kind === 'risk' && riskDraft && (
          <>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-risk-title">
                {t('execution.rollout.risks.col.title', 'Title')}
              </label>
              <Input
                id="rollout-risk-title"
                value={riskDraft.title}
                onChange={(e) => setRiskDraft({ ...riskDraft, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={FIELD_LABEL} htmlFor="rollout-risk-probability">
                  {t('execution.rollout.risks.col.probability', 'Probability')}
                </label>
                <select
                  id="rollout-risk-probability"
                  className={SELECT_CLASS}
                  value={riskDraft.probability}
                  onChange={(e) => setRiskDraft({ ...riskDraft, probability: e.target.value })}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
              <div>
                <label className={FIELD_LABEL} htmlFor="rollout-risk-impact">
                  {t('execution.rollout.risks.col.impact', 'Impact')}
                </label>
                <select
                  id="rollout-risk-impact"
                  className={SELECT_CLASS}
                  value={riskDraft.impact}
                  onChange={(e) => setRiskDraft({ ...riskDraft, impact: e.target.value })}
                >
                  <option value="low">low</option>
                  <option value="medium">medium</option>
                  <option value="high">high</option>
                </select>
              </div>
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-risk-status">
                {t('execution.rollout.risks.col.status', 'Status')}
              </label>
              <select
                id="rollout-risk-status"
                className={SELECT_CLASS}
                value={riskDraft.status}
                onChange={(e) => setRiskDraft({ ...riskDraft, status: e.target.value })}
              >
                <option value="OPEN">{t('execution.rollout.risks.status.open', 'Open')}</option>
                <option value="MITIGATED">
                  {t('execution.rollout.risks.status.mitigated', 'Mitigated')}
                </option>
                <option value="CLOSED">
                  {t('execution.rollout.risks.status.closed', 'Closed')}
                </option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-risk-mitigation">
                {t('execution.rollout.risks.col.mitigation', 'Mitigation')}
              </label>
              <textarea
                id="rollout-risk-mitigation"
                className={`${SELECT_CLASS} min-h-[72px] resize-y`}
                value={riskDraft.mitigation ?? ''}
                onChange={(e) => setRiskDraft({ ...riskDraft, mitigation: e.target.value })}
              />
            </div>
          </>
        )}

        {target.kind === 'change' && changeDraft && (
          <>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-change-title">
                {t('execution.rollout.change.col.title', 'Title')}
              </label>
              <Input
                id="rollout-change-title"
                value={changeDraft.title}
                onChange={(e) => setChangeDraft({ ...changeDraft, title: e.target.value })}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-change-type">
                {t('execution.rollout.change.col.type', 'Type')}
              </label>
              <Input
                id="rollout-change-type"
                value={changeDraft.type}
                onChange={(e) => setChangeDraft({ ...changeDraft, type: e.target.value })}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-change-status">
                {t('execution.rollout.change.col.status', 'Status')}
              </label>
              <select
                id="rollout-change-status"
                className={SELECT_CLASS}
                value={changeDraft.status}
                onChange={(e) => setChangeDraft({ ...changeDraft, status: e.target.value })}
              >
                <option value="PROPOSED">
                  {t('execution.rollout.change.status.proposed', 'Proposed')}
                </option>
                <option value="APPROVED">
                  {t('execution.rollout.change.status.approved', 'Approved')}
                </option>
                <option value="REJECTED">
                  {t('execution.rollout.change.status.rejected', 'Rejected')}
                </option>
                <option value="IMPLEMENTED">
                  {t('execution.rollout.change.status.implemented', 'Implemented')}
                </option>
              </select>
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-change-impact">
                {t('execution.rollout.change.col.impact', 'Impact')}
              </label>
              <textarea
                id="rollout-change-impact"
                className={`${SELECT_CLASS} min-h-[72px] resize-y`}
                value={changeDraft.impact ?? ''}
                onChange={(e) => setChangeDraft({ ...changeDraft, impact: e.target.value })}
              />
            </div>
          </>
        )}

        {target.kind === 'closure' && closureDraft && (
          <>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-closure-title">
                {t('execution.rollout.closure.col.title', 'Title')}
              </label>
              <Input
                id="rollout-closure-title"
                value={closureDraft.title}
                onChange={(e) => setClosureDraft({ ...closureDraft, title: e.target.value })}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-closure-category">
                {t('execution.rollout.closure.col.category', 'Category')}
              </label>
              <Input
                id="rollout-closure-category"
                value={closureDraft.category}
                onChange={(e) => setClosureDraft({ ...closureDraft, category: e.target.value })}
              />
            </div>
            <div>
              <label className={FIELD_LABEL} htmlFor="rollout-closure-status">
                {t('execution.rollout.closure.col.status', 'Status')}
              </label>
              <select
                id="rollout-closure-status"
                className={SELECT_CLASS}
                value={closureDraft.status}
                onChange={(e) => setClosureDraft({ ...closureDraft, status: e.target.value })}
              >
                <option value="OPEN">{t('execution.rollout.closure.status.open', 'Open')}</option>
                <option value="DONE">{t('execution.rollout.closure.status.done', 'Done')}</option>
              </select>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default RolloutRegisterEditModal;
