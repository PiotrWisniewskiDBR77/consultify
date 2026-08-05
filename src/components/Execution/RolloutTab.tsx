/**
 * RolloutTab — Module 06 Realizacja (Execution) rollout sub-surface.
 *
 * Lives as the `rollout` tab inside ExecutionHub (ModuleHub shell). Replaces the
 * retired FullRolloutView (legacy SplitLayout, duplicate AI panel) and the seven
 * in-memory Rollout*Tab.tsx components that lost all data on refresh.
 *
 * Sub-views: Plan, KPI, Risks, Change, Closure — all backed by /api/rollout/*
 * (server/src/routes/rollout.routes.ts), so data persists across sessions.
 *
 * Design canon: ModuleHub MENU_3 chips, rounded-xl surfaces, navy/neutral UI with
 * Harvard Crimson (#A51C30 → `crimson` scale, Button variant="brand") accents on
 * critical/primary actions. Teresa AI touchpoint via useOpenChatWithContext.
 */
import {
  AlertOctagon,
  CheckSquare,
  ClipboardList,
  Pencil,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { useConfirmDialog } from '@/components/MyWork/shared/ConfirmDialog';
import { Button } from '@/components/ui/primitives';
import { Api } from '@/services/api';

import type { FullInitiative } from '../../types';
import {
  FilterableTable,
  FilterChip,
  HubWorkAreaLoadError,
  HubWorkAreaLoading,
  TableColumn,
} from '../shared/ModuleHub';
import {
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
} from '../shared/ModuleMenu3';
import { Callout } from '../shared/NModeBlocks';
import type { RowAction } from '../shared/RowActionsMenu';
import CutoverRunbookPanel from './CutoverRunbookPanel';
import { isExecutionFlagEnabled } from './executionFeatureFlags';
import type { DelaySignalItem, RiskSignalItem } from './ExecutionTimelineView';
import RolloutBaselinePanel from './RolloutBaselinePanel';
import { type RolloutEditTarget, RolloutRegisterEditModal } from './RolloutRegisterEditModal';
import RolloutStagesPanel from './RolloutStagesPanel';

// ── Resource shapes (mirror rollout.routes.ts response rows) ────────────────

interface RolloutKpi {
  id: string;
  name: string;
  baseline: number;
  target: number;
  current_value: number;
  unit: string;
}

interface RolloutRisk {
  id: string;
  title: string;
  probability: string;
  impact: string;
  mitigation: string | null;
  status: string;
}

interface RolloutChange {
  id: string;
  title: string;
  type: string;
  status: string;
  impact: string | null;
}

interface RolloutClosure {
  id: string;
  title: string;
  category: string;
  status: string;
}

type RolloutSubview = 'plan' | 'kpi' | 'risks' | 'change' | 'closure';

export interface RolloutTabProps {
  projectId?: string;
  initiatives: FullInitiative[];
  riskSignals?: RiskSignalItem[];
  delaySignals?: DelaySignalItem[];
  readOnly?: boolean;
  /** Register the MENU_3 sub-tab chip row in the ModuleHub command row. */
  onRegisterCommandRowContent?: (node: React.ReactNode) => void;
  /** Optional Teresa / AI chat opener (entityType 'execution-rollout-risk'). */
  onOpenChat?: (topSignal: string) => void;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function progressPct(kpi: RolloutKpi): number {
  const span = kpi.target - kpi.baseline;
  if (!span) return 0;
  return Math.round(((kpi.current_value - kpi.baseline) / span) * 100);
}

const SUBVIEW_ORDER: RolloutSubview[] = ['plan', 'kpi', 'risks', 'change', 'closure'];

// ── Derived-data helpers (#14/#16/#18) ───────────────────────────────────────
// When the rollout API returns an empty list, we surface representative,
// READ-ONLY rows computed entirely from the real `initiatives` prop (and the
// execution risk/delay signals when present). No random/fake values — every
// number traces back to an initiative field.

const COMPLETED_STATUSES = new Set<string>(['DONE', 'TRACKING', 'ARCHIVED']);
const ACTIVE_STATUSES = new Set<string>([
  'EXECUTING',
  'BLOCKED',
  'SCHEDULED',
  'APPROVED',
  'PLANNING',
]);
const GATE_READY_STATUSES = new Set<string>(['APPROVED', 'SCHEDULED', 'PROMOTED']);

/** Health bucket for a single initiative, derived from status + dates + progress. */
type InitiativeHealth = 'on-track' | 'at-risk' | 'overdue';

function isOverdue(init: FullInitiative): boolean {
  const end =
    (init as { plannedEndDate?: string }).plannedEndDate || (init as { endDate?: string }).endDate;
  if (!end) return false;
  const d = new Date(end);
  if (Number.isNaN(d.getTime())) return false;
  const status = String(init.status || '').toUpperCase();
  if (COMPLETED_STATUSES.has(status) || status === 'CANCELLED') return false;
  return d.getTime() < Date.now();
}

function initiativeHealth(init: FullInitiative): InitiativeHealth {
  const status = String(init.status || '').toUpperCase();
  if (isOverdue(init)) return 'overdue';
  if (status === 'BLOCKED') return 'at-risk';
  return 'on-track';
}

/** A derived row shares the persisted shape but is flagged read-only. */
interface DerivedKpi extends RolloutKpi {
  derived: true;
  tone: SignalTone;
}
interface DerivedRisk extends RolloutRisk {
  derived: true;
}
interface DerivedClosure extends RolloutClosure {
  derived: true;
}

function deriveKpis(
  initiatives: FullInitiative[],
  t: ReturnType<typeof useTranslation>['t']
): DerivedKpi[] {
  const total = initiatives.length;
  if (total === 0) return [];

  const active = initiatives.filter((i) =>
    ACTIVE_STATUSES.has(String(i.status || '').toUpperCase())
  );
  const onTrackCount = initiatives.filter((i) => initiativeHealth(i) === 'on-track').length;
  const overdueCount = initiatives.filter((i) => isOverdue(i)).length;
  const gateReadyCount = initiatives.filter((i) =>
    GATE_READY_STATUSES.has(String(i.status || '').toUpperCase())
  ).length;

  const progresses = initiatives
    .map((i) => (typeof i.progress === 'number' ? i.progress : null))
    .filter((p): p is number => p !== null);
  const avgProgress = progresses.length
    ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length)
    : 0;

  const onTrackPct = Math.round((onTrackCount / total) * 100);

  const tri = (good: boolean, warn: boolean): SignalTone =>
    good ? 'success' : warn ? 'warning' : 'danger';

  return [
    {
      id: 'derived-on-track',
      name: t('execution.rollout.kpi.derived.onTrackPct', '% initiatives on track'),
      baseline: 0,
      target: 100,
      current_value: onTrackPct,
      unit: '%',
      derived: true,
      tone: tri(onTrackPct >= 80, onTrackPct >= 50),
    },
    {
      id: 'derived-avg-progress',
      name: t('execution.rollout.kpi.derived.avgProgress', 'Avg progress %'),
      baseline: 0,
      target: 100,
      current_value: avgProgress,
      unit: '%',
      derived: true,
      tone: tri(avgProgress >= 70, avgProgress >= 40),
    },
    {
      id: 'derived-overdue',
      name: t('execution.rollout.kpi.derived.overdue', 'Overdue initiatives'),
      baseline: total,
      target: 0,
      current_value: overdueCount,
      unit: '',
      derived: true,
      tone: tri(overdueCount === 0, overdueCount <= Math.max(1, Math.round(total * 0.15))),
    },
    {
      id: 'derived-gate-ready',
      name: t('execution.rollout.kpi.derived.gateReady', 'Gate-ready count'),
      baseline: 0,
      target: total,
      current_value: gateReadyCount,
      unit: '',
      derived: true,
      tone: tri(gateReadyCount > 0, true),
    },
    {
      id: 'derived-active',
      name: t('execution.rollout.kpi.derived.active', 'Active initiatives'),
      baseline: 0,
      target: total,
      current_value: active.length,
      unit: '',
      derived: true,
      tone: 'neutral',
    },
  ];
}

function deriveRisks(
  initiatives: FullInitiative[],
  riskSignals: RiskSignalItem[],
  delaySignals: DelaySignalItem[]
): DerivedRisk[] {
  const sevToLevel = (s: string): string => {
    const k = s.toUpperCase();
    if (k === 'CRITICAL' || k === 'HIGH') return 'high';
    if (k === 'MEDIUM' || k === 'WARNING') return 'medium';
    return 'low';
  };

  // Prefer the real execution signals when the host passed them.
  if (riskSignals.length || delaySignals.length) {
    const rows: DerivedRisk[] = [];
    for (const r of riskSignals) {
      rows.push({
        id: `derived-risk-${r.id}`,
        title: `${r.initiativeName}: ${r.title}`,
        probability: sevToLevel(r.severity),
        impact: sevToLevel(r.severity),
        mitigation: r.suggestedAction || null,
        status: 'OPEN',
        derived: true,
      });
    }
    for (const d of delaySignals) {
      rows.push({
        id: `derived-delay-${d.id}`,
        title: `${d.entityName}: ${d.deviationType.replace(/_/g, ' ').toLowerCase()} (${d.daysDeviation}d)`,
        probability: d.severity === 'CRITICAL' ? 'high' : 'medium',
        impact: sevToLevel(d.severity),
        mitigation: d.whySlipReasons?.[0]?.detail || null,
        status: 'OPEN',
        derived: true,
      });
    }
    if (rows.length) return rows;
  }

  // Fallback: derive from initiative health (blocked / overdue / at-risk).
  return initiatives
    .filter((i) => initiativeHealth(i) !== 'on-track')
    .map((i) => {
      const overdue = isOverdue(i);
      const status = String(i.status || '').toUpperCase();
      const reason = overdue
        ? 'Past planned end date'
        : status === 'BLOCKED'
          ? (i as { blockedReason?: string }).blockedReason || 'Blocked'
          : 'At risk';
      const priority = String(i.priority || '').toLowerCase();
      const impact =
        priority === 'critical' || priority === 'high'
          ? 'high'
          : priority === 'medium'
            ? 'medium'
            : 'low';
      return {
        id: `derived-init-risk-${i.id}`,
        title: `${i.name || i.id}: ${reason}`,
        probability: overdue ? 'high' : status === 'BLOCKED' ? 'high' : 'medium',
        impact,
        mitigation: null,
        status: 'OPEN',
        derived: true as const,
      };
    });
}

function deriveClosures(initiatives: FullInitiative[]): DerivedClosure[] {
  const completed = initiatives.filter((i) =>
    COMPLETED_STATUSES.has(String(i.status || '').toUpperCase())
  );
  const rows: DerivedClosure[] = [];
  // PMI/PRINCE2 closure categories, one checklist item per completed initiative.
  for (const i of completed) {
    const name = i.name || i.id;
    const status = String(i.status || '').toUpperCase();
    rows.push({
      id: `derived-handover-${i.id}`,
      title: `Handover: transfer ${name} deliverables to operations`,
      category: 'Handover',
      status: 'OPEN',
      derived: true,
    });
    rows.push({
      id: `derived-signoff-${i.id}`,
      title: `Sign-off: obtain sponsor acceptance for ${name}`,
      category: 'Sign-off',
      status: status === 'ARCHIVED' ? 'DONE' : 'OPEN',
      derived: true,
    });
    rows.push({
      id: `derived-closure-${i.id}`,
      title: `Closure: capture lessons learned & archive ${name}`,
      category: 'Closure',
      status: status === 'ARCHIVED' ? 'DONE' : 'OPEN',
      derived: true,
    });
  }
  return rows;
}

// ── Component ─────────────────────────────────────────────────────────────

export const RolloutTab: React.FC<RolloutTabProps> = ({
  projectId,
  initiatives,
  riskSignals = [],
  delaySignals = [],
  readOnly = false,
  onRegisterCommandRowContent,
  onOpenChat,
}) => {
  const { t } = useTranslation();
  const { dialog: confirmDialog, confirm } = useConfirmDialog();
  const [subview, setSubview] = useState<RolloutSubview>('kpi');

  // Canon §27 — registers are read-only rows; edits route through a modal opened
  // from the FilterableTable kebab. One target at a time across all registers.
  const [editTarget, setEditTarget] = useState<RolloutEditTarget | null>(null);
  // Per-register FilterableTable filter state (column header dropdowns).
  const [riskFilters, setRiskFilters] = useState<FilterChip[]>([]);
  const [changeFilters, setChangeFilters] = useState<FilterChip[]>([]);
  const [closureFilters, setClosureFilters] = useState<FilterChip[]>([]);
  const [kpiFilters, setKpiFilters] = useState<FilterChip[]>([]);

  // #19 — broadcast the active rollout sub-view so the ExecutionHub host can pick
  // the right Menu-2 CTA (Add KPI / Add Risk / Add Item, or none for plan/change).
  // Fires on mount (initial 'kpi') and on every sub-tab switch. The sub-view ids
  // (plan | kpi | risks | change | closure) match what ExecutionHub.menuCta checks.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('rollout:subview-change', { detail: { subview } }));
  }, [subview]);

  const [kpis, setKpis] = useState<RolloutKpi[]>([]);
  const [kpiHistory, setKpiHistory] = useState<Record<string, number[]>>({});
  const [risks, setRisks] = useState<RolloutRisk[]>([]);
  const [changes, setChanges] = useState<RolloutChange[]>([]);
  const [closures, setClosures] = useState<RolloutClosure[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // #14/#16/#18 — derived (read-only) rows from real in-app data, shown only when
  // the API list for that resource is empty. User-created/persisted rows win.
  const derivedKpis = useMemo(() => deriveKpis(initiatives, t), [initiatives, t]);
  const derivedRisks = useMemo(
    () => deriveRisks(initiatives, riskSignals, delaySignals),
    [initiatives, riskSignals, delaySignals]
  );
  const derivedClosures = useMemo(() => deriveClosures(initiatives), [initiatives]);

  const showDerivedKpis = kpis.length === 0 && derivedKpis.length > 0;
  const showDerivedRisks = risks.length === 0 && derivedRisks.length > 0;
  const showDerivedClosures = closures.length === 0 && derivedClosures.length > 0;

  const projectQuery = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const [kRes, rRes, cRes, clRes] = await Promise.all([
        Api.get(`/rollout/kpis${projectQuery}`),
        Api.get(`/rollout/risks${projectQuery}`),
        Api.get(`/rollout/changes${projectQuery}`),
        Api.get(`/rollout/closures${projectQuery}`),
      ]);
      setKpis(kRes.data?.kpis || []);
      setRisks(rRes.data?.risks || []);
      setChanges(cRes.data?.changes || []);
      setClosures(clRes.data?.closures || []);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [projectQuery]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Load per-KPI value history for the sparkline (P2-2 — real time-series, no
  // hardcoded values). Best-effort: failures leave the sparkline empty.
  const loadKpiHistory = useCallback(async (id: string) => {
    try {
      const res = await Api.get(`/rollout/kpis/${id}/history`);
      const points: number[] = (res.data?.history || []).map((h: { value: number }) =>
        Number(h.value)
      );
      setKpiHistory((prev) => ({ ...prev, [id]: points }));
    } catch {
      // non-blocking
    }
  }, []);

  useEffect(() => {
    kpis.forEach((k) => {
      if (kpiHistory[k.id] === undefined) void loadKpiHistory(k.id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpis, loadKpiHistory]);

  // ── MENU_3 sub-tab chips ───────────────────────────────────────────────
  const subviewMeta: Record<
    RolloutSubview,
    { label: string; icon: React.ReactNode; count: number }
  > = useMemo(
    () => ({
      plan: {
        label: t('execution.rollout.plan.title', 'Master Plan'),
        icon: <ClipboardList size={14} className="text-blue-400" />,
        count: initiatives.length,
      },
      kpi: {
        label: t('execution.rollout.kpi.title', 'KPI Tracking'),
        icon: <TrendingUp size={14} className="text-emerald-400" />,
        count: kpis.length,
      },
      risks: {
        label: t('execution.rollout.risks.title', 'Risk Register'),
        icon: <AlertOctagon size={14} className="text-crimson-500" />,
        count: risks.length,
      },
      change: {
        label: t('execution.rollout.change.title', 'Change Log'),
        icon: <Sparkles size={14} className="text-amber-400" />,
        count: changes.length,
      },
      closure: {
        label: t('execution.rollout.closure.title', 'Closure Checklist'),
        icon: <CheckSquare size={14} className="text-blue-400" />,
        count: closures.length,
      },
    }),
    [t, initiatives.length, kpis.length, risks.length, changes.length, closures.length]
  );

  useEffect(() => {
    if (!onRegisterCommandRowContent) return;
    onRegisterCommandRowContent(
      <div className={MENU_3_LEFT_CLASS}>
        {SUBVIEW_ORDER.map((id) => {
          const active = subview === id;
          const meta = subviewMeta[id];
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSubview(id)}
              className={active ? MENU_3_CHIP_ACTIVE : MENU_3_CHIP_INACTIVE}
            >
              {meta.icon}
              <span>{meta.label}</span>
              <span className={active ? MENU_3_BADGE_ACTIVE : MENU_3_BADGE_INACTIVE}>
                {meta.count}
              </span>
            </button>
          );
        })}
      </div>
    );
    return () => onRegisterCommandRowContent(null);
  }, [onRegisterCommandRowContent, subview, subviewMeta]);

  // ── Mutations ──────────────────────────────────────────────────────────
  const withSave = useCallback(
    async (fn: () => Promise<void>) => {
      setBusy(true);
      try {
        await fn();
      } catch {
        toast.error(t('execution.rollout.saveFailed', 'Failed to save. Please try again.'));
      } finally {
        setBusy(false);
      }
    },
    [t]
  );

  const addKpi = () =>
    withSave(async () => {
      const res = await Api.post('/rollout/kpis', { projectId });
      if (res.data?.kpi) setKpis((p) => [...p, res.data.kpi]);
    });

  const patchKpi = (id: string, updates: Partial<RolloutKpi> & { currentValue?: number }) =>
    withSave(async () => {
      const res = await Api.patch(`/rollout/kpis/${id}`, updates);
      if (res.data?.kpi) setKpis((p) => p.map((k) => (k.id === id ? res.data.kpi : k)));
      // A value change appends a history point server-side; refresh the sparkline.
      if (updates.currentValue !== undefined) void loadKpiHistory(id);
    });

  const deleteKpi = (id: string) =>
    withSave(async () => {
      await Api.delete(`/rollout/kpis/${id}`);
      setKpis((p) => p.filter((k) => k.id !== id));
    });

  // Atelier Toys onboarding seed — populates representative KPIs + risks so the
  // rollout surface demonstrates value immediately (P1-10 / spine demo).
  const seedAtelierRollout = () =>
    withSave(async () => {
      const kpiSeeds = [
        { name: 'NPS', baseline: 20, target: 60, currentValue: 38, unit: 'pt' },
        { name: 'On-time delivery %', baseline: 70, target: 95, currentValue: 84, unit: '%' },
        { name: 'Employee adoption rate', baseline: 0, target: 80, currentValue: 45, unit: '%' },
      ];
      const riskSeeds = [
        { title: 'Supplier lead-time slippage', probability: 'high', impact: 'high' },
        { title: 'Change fatigue on shop floor', probability: 'medium', impact: 'medium' },
      ];
      const createdKpis: RolloutKpi[] = [];
      for (const k of kpiSeeds) {
        const res = await Api.post('/rollout/kpis', { projectId, ...k });
        if (res.data?.kpi) createdKpis.push(res.data.kpi);
      }
      const createdRisks: RolloutRisk[] = [];
      for (const r of riskSeeds) {
        const res = await Api.post('/rollout/risks', { projectId, ...r });
        if (res.data?.risk) createdRisks.push(res.data.risk);
      }
      if (createdKpis.length) setKpis((p) => [...p, ...createdKpis]);
      if (createdRisks.length) setRisks((p) => [...p, ...createdRisks]);
    });

  const addRisk = () =>
    withSave(async () => {
      const res = await Api.post('/rollout/risks', { projectId });
      if (res.data?.risk) setRisks((p) => [...p, res.data.risk]);
    });

  const patchRisk = (id: string, updates: Partial<RolloutRisk>) =>
    withSave(async () => {
      const res = await Api.patch(`/rollout/risks/${id}`, updates);
      if (res.data?.risk) setRisks((p) => p.map((r) => (r.id === id ? res.data.risk : r)));
    });

  const deleteRisk = (id: string) =>
    withSave(async () => {
      await Api.delete(`/rollout/risks/${id}`);
      setRisks((p) => p.filter((r) => r.id !== id));
    });

  const addChange = () =>
    withSave(async () => {
      const res = await Api.post('/rollout/changes', { projectId });
      if (res.data?.change) setChanges((p) => [...p, res.data.change]);
    });

  const patchChange = (id: string, updates: Partial<RolloutChange>) =>
    withSave(async () => {
      const res = await Api.patch(`/rollout/changes/${id}`, updates);
      if (res.data?.change) setChanges((p) => p.map((c) => (c.id === id ? res.data.change : c)));
    });

  const deleteChange = (id: string) =>
    withSave(async () => {
      await Api.delete(`/rollout/changes/${id}`);
      setChanges((p) => p.filter((c) => c.id !== id));
    });

  const addClosure = () =>
    withSave(async () => {
      const res = await Api.post('/rollout/closures', { projectId });
      if (res.data?.closure) setClosures((p) => [...p, res.data.closure]);
    });

  const patchClosure = (id: string, updates: Partial<RolloutClosure>) =>
    withSave(async () => {
      const res = await Api.patch(`/rollout/closures/${id}`, updates);
      if (res.data?.closure) setClosures((p) => p.map((c) => (c.id === id ? res.data.closure : c)));
    });

  const deleteClosure = (id: string) =>
    withSave(async () => {
      await Api.delete(`/rollout/closures/${id}`);
      setClosures((p) => p.filter((c) => c.id !== id));
    });

  // #14/#16/#18 — Single source of truth for the "Add" CTA is the ExecutionHub
  // Menu-2 button. The in-body Add buttons were removed; instead we listen for
  // the window CustomEvents that the host dispatches when its CTA is clicked.
  // Change has no add CTA (#17 — Change Log is an automatic timeline). Stable
  // refs keep the listeners current without re-subscribing every render.
  const addKpiRef = React.useRef(addKpi);
  const addRiskRef = React.useRef(addRisk);
  const addClosureRef = React.useRef(addClosure);
  addKpiRef.current = addKpi;
  addRiskRef.current = addRisk;
  addClosureRef.current = addClosure;

  useEffect(() => {
    if (readOnly) return;
    const onAddKpi = () => void addKpiRef.current();
    const onAddRisk = () => void addRiskRef.current();
    const onAddClosure = () => void addClosureRef.current();
    window.addEventListener('execution:add-kpi', onAddKpi);
    window.addEventListener('execution:add-risk', onAddRisk);
    window.addEventListener('execution:add-closure-item', onAddClosure);
    return () => {
      window.removeEventListener('execution:add-kpi', onAddKpi);
      window.removeEventListener('execution:add-risk', onAddRisk);
      window.removeEventListener('execution:add-closure-item', onAddClosure);
    };
  }, [readOnly]);

  // ── FilterableTable columns + row actions (canon §27) ──────────────────
  // Rows are read-only; the kebab exposes Edit (→ modal) + Delete (→ confirm).
  const confirmDelete = useCallback(
    async (title: string, run: () => void) => {
      const ok = await confirm({
        title: t('execution.rollout.deleteConfirm.title', 'Delete this item?'),
        description: t('execution.rollout.deleteConfirm.body', {
          title,
          defaultValue: '"{{title}}" will be permanently removed. This cannot be undone.',
        }),
        confirmLabel: t('common.delete', 'Delete'),
        cancelLabel: t('common.cancel', 'Cancel'),
        variant: 'danger',
      });
      if (ok) run();
    },
    [confirm, t]
  );

  // KPI rows: read-only progress + edit/delete actions. (KPI render stays a card
  // grid below — its kebab actions live on each card via buildKpiRowActions.)
  const kpiColumns = useMemo<TableColumn[]>(
    () => [
      { id: 'name', label: t('execution.rollout.kpi.col.name', 'Name') },
      {
        id: 'current_display',
        label: t('execution.rollout.kpi.current', 'Current'),
        width: '120px',
        align: 'right',
      },
      {
        id: 'baseline_display',
        label: t('execution.rollout.kpi.baseline', 'Baseline'),
        width: '110px',
        align: 'right',
      },
      {
        id: 'target_display',
        label: t('execution.rollout.kpi.target', 'Target'),
        width: '110px',
        align: 'right',
      },
      {
        id: 'progress_display',
        label: t('execution.rollout.kpi.col.progress', 'Progress'),
        width: '110px',
        align: 'right',
        render: (row: any) => {
          const pct = Number(row.progress_pct);
          const tone: SignalTone =
            row.below_baseline === true ? 'danger' : pct >= 50 ? 'success' : 'warning';
          return (
            <span className="inline-flex items-center gap-1.5 justify-end tabular-nums text-sm text-slate-700 dark:text-slate-200">
              <SignalDot tone={tone} />
              {pct}%
            </span>
          );
        },
      },
      {
        id: 'trend',
        label: t('execution.rollout.kpi.col.trend', 'Trend'),
        width: '140px',
        render: (row: any) => (
          <KpiSparkline points={kpiHistory[String(row.id)] || []} target={Number(row.target)} />
        ),
      },
    ],
    [t, kpiHistory]
  );

  const kpiRows = useMemo(
    () =>
      kpis.map((k) => {
        const pct = progressPct(k);
        return {
          ...k,
          current_display: `${k.current_value}${k.unit}`,
          baseline_display: `${k.baseline}${k.unit}`,
          target_display: `${k.target}${k.unit}`,
          progress_pct: pct,
          below_baseline: k.current_value < k.baseline,
        };
      }),
    [kpis]
  );

  const buildKpiRowActions = useCallback(
    (id: string): RowAction[] => {
      const row = kpis.find((k) => k.id === id);
      if (!row) return [];
      return [
        {
          id: 'edit',
          label: t('common.edit', 'Edit'),
          icon: Pencil,
          variant: 'primary',
          onClick: () => setEditTarget({ kind: 'kpi', row }),
        },
        {
          id: 'delete',
          label: t('common.delete', 'Delete'),
          icon: Trash2,
          divider: true,
          variant: 'danger',
          onClick: () => void confirmDelete(row.name, () => void deleteKpi(id)),
        },
      ];
    },
    [kpis, t, confirmDelete]
  );

  // Risk rows
  const riskColumns = useMemo<TableColumn[]>(
    () => [
      { id: 'title', label: t('execution.rollout.risks.col.title', 'Title') },
      {
        id: 'probability',
        label: t('execution.rollout.risks.col.probability', 'Probability'),
        width: '140px',
        filterable: true,
        filterOptions: [
          { value: 'low', label: 'low' },
          { value: 'medium', label: 'medium' },
          { value: 'high', label: 'high' },
        ],
        render: (row: any) => (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 capitalize">
            <SignalDot tone={levelTone(String(row.probability))} />
            {row.probability}
          </span>
        ),
      },
      {
        id: 'impact',
        label: t('execution.rollout.risks.col.impact', 'Impact'),
        width: '120px',
        filterable: true,
        filterOptions: [
          { value: 'low', label: 'low' },
          { value: 'medium', label: 'medium' },
          { value: 'high', label: 'high' },
        ],
        render: (row: any) => (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 capitalize">
            <SignalDot tone={levelTone(String(row.impact))} />
            {row.impact}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('execution.rollout.risks.col.status', 'Status'),
        width: '130px',
        filterable: true,
        filterOptions: [
          { value: 'OPEN', label: t('execution.rollout.risks.status.open', 'Open') },
          { value: 'MITIGATED', label: t('execution.rollout.risks.status.mitigated', 'Mitigated') },
          { value: 'CLOSED', label: t('execution.rollout.risks.status.closed', 'Closed') },
        ],
        render: (row: any) => (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 capitalize">
            <SignalDot tone={riskStatusTone(String(row.status))} />
            {String(row.status).toLowerCase()}
          </span>
        ),
      },
    ],
    [t]
  );

  const buildRiskRowActions = useCallback(
    (id: string): RowAction[] => {
      const row = risks.find((r) => r.id === id);
      if (!row) return [];
      return [
        {
          id: 'edit',
          label: t('common.edit', 'Edit'),
          icon: Pencil,
          variant: 'primary',
          onClick: () => setEditTarget({ kind: 'risk', row }),
        },
        {
          id: 'delete',
          label: t('common.delete', 'Delete'),
          icon: Trash2,
          divider: true,
          variant: 'danger',
          onClick: () => void confirmDelete(row.title, () => void deleteRisk(id)),
        },
      ];
    },
    [risks, t, confirmDelete]
  );

  // Change rows
  const changeColumns = useMemo<TableColumn[]>(
    () => [
      { id: 'title', label: t('execution.rollout.change.col.title', 'Title') },
      {
        id: 'type',
        label: t('execution.rollout.change.col.type', 'Type'),
        width: '160px',
        render: (row: any) => (
          <span className="inline-flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 capitalize">
            <SignalDot tone="neutral" />
            {row.type || '—'}
          </span>
        ),
      },
      {
        id: 'status',
        label: t('execution.rollout.change.col.status', 'Status'),
        width: '150px',
        filterable: true,
        filterOptions: [
          { value: 'PROPOSED', label: t('execution.rollout.change.status.proposed', 'Proposed') },
          { value: 'APPROVED', label: t('execution.rollout.change.status.approved', 'Approved') },
          { value: 'REJECTED', label: t('execution.rollout.change.status.rejected', 'Rejected') },
          {
            value: 'IMPLEMENTED',
            label: t('execution.rollout.change.status.implemented', 'Implemented'),
          },
        ],
        render: (row: any) => (
          <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 capitalize">
            <SignalDot tone={changeStatusTone(String(row.status))} />
            {String(row.status).toLowerCase()}
          </span>
        ),
      },
    ],
    [t]
  );

  const buildChangeRowActions = useCallback(
    (id: string): RowAction[] => {
      const row = changes.find((c) => c.id === id);
      if (!row) return [];
      return [
        {
          id: 'edit',
          label: t('common.edit', 'Edit'),
          icon: Pencil,
          variant: 'primary',
          onClick: () => setEditTarget({ kind: 'change', row }),
        },
        {
          id: 'delete',
          label: t('common.delete', 'Delete'),
          icon: Trash2,
          divider: true,
          variant: 'danger',
          onClick: () => void confirmDelete(row.title, () => void deleteChange(id)),
        },
      ];
    },
    [changes, t, confirmDelete]
  );

  // Closure rows — a "Done" toggle stays inline (cheap, single-field), but Edit
  // (title/category/status) and Delete route through the canon kebab + modal.
  const closureColumns = useMemo<TableColumn[]>(
    () => [
      {
        id: 'done',
        label: t('execution.rollout.closure.col.done', 'Done'),
        width: '70px',
        align: 'center',
        render: (row: any) => {
          const done = String(row.status).toUpperCase() === 'DONE';
          return (
            <input
              type="checkbox"
              checked={done}
              disabled={readOnly}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                void patchClosure(String(row.id), { status: done ? 'OPEN' : 'DONE' });
              }}
              className="h-4 w-4 accent-crimson-600"
              aria-label={t('execution.rollout.closure.col.done', 'Done')}
            />
          );
        },
      },
      {
        id: 'title',
        label: t('execution.rollout.closure.col.title', 'Title'),
        render: (row: any) => {
          const done = String(row.status).toUpperCase() === 'DONE';
          return (
            <span
              className={
                done
                  ? 'line-through text-slate-500 dark:text-slate-500'
                  : 'text-slate-700 dark:text-slate-200'
              }
            >
              {row.title}
            </span>
          );
        },
      },
      {
        id: 'category',
        label: t('execution.rollout.closure.col.category', 'Category'),
        width: '160px',
        filterable: true,
        filterOptions: [
          { value: 'Handover', label: 'Handover' },
          { value: 'Sign-off', label: 'Sign-off' },
          { value: 'Closure', label: 'Closure' },
        ],
      },
    ],
    [t, readOnly]
  );

  const buildClosureRowActions = useCallback(
    (id: string): RowAction[] => {
      const row = closures.find((c) => c.id === id);
      if (!row) return [];
      return [
        {
          id: 'edit',
          label: t('common.edit', 'Edit'),
          icon: Pencil,
          variant: 'primary',
          onClick: () => setEditTarget({ kind: 'closure', row }),
        },
        {
          id: 'delete',
          label: t('common.delete', 'Delete'),
          icon: Trash2,
          divider: true,
          variant: 'danger',
          onClick: () => void confirmDelete(row.title, () => void deleteClosure(id)),
        },
      ];
    },
    [closures, t, confirmDelete]
  );

  // ── Teresa risk touchpoint ─────────────────────────────────────────────
  const activeSignalCount = riskSignals.length + delaySignals.length;
  const topSignal =
    (riskSignals[0] as { message?: string; title?: string } | undefined)?.message ||
    (riskSignals[0] as { message?: string; title?: string } | undefined)?.title ||
    (delaySignals[0] as { message?: string; title?: string } | undefined)?.message ||
    '';

  // ── Loading / error ────────────────────────────────────────────────────
  if (loading) return <HubWorkAreaLoading />;
  if (error)
    return (
      <HubWorkAreaLoadError
        title={t('execution.rollout.loadErrorTitle', 'Could not load rollout data')}
        message={t(
          'execution.rollout.loadErrorMessage',
          'Something went wrong while loading rollout resources. Please try again.'
        )}
        retryLabel={t('common.retry', 'Retry')}
        dismissLabel={t('common.dismiss', 'Dismiss')}
        onRetry={() => void loadAll()}
        onDismiss={() => setError(false)}
      />
    );

  const teresaCallout =
    activeSignalCount > 0 ? (
      <Callout
        variant="critical"
        icon={Sparkles}
        title={t('execution.rollout.teresaTitle', 'Teresa — rollout at risk')}
        action={
          onOpenChat
            ? {
                label: t('execution.rollout.teresaCta', 'Review now'),
                onClick: () => onOpenChat(topSignal),
              }
            : undefined
        }
      >
        {t('execution.rollout.teresa', {
          count: activeSignalCount,
          topSignal: topSignal || t('execution.rollout.teresaGeneric', 'delivery signals detected'),
          defaultValue:
            'Teresa detects {{count}} active risk signal(s) — {{topSignal}}. Review now.',
        })}
      </Callout>
    ) : null;

  return (
    <div className="h-full overflow-auto p-4 space-y-5">
      {/* ── PLAN ── */}
      {subview === 'plan' && (
        <>
          {isExecutionFlagEnabled('rolloutStages') && (
            <>
              <RolloutStagesPanel projectId={projectId} />
              <RolloutBaselinePanel projectId={projectId} />
              <CutoverRunbookPanel initiativeId={initiatives[0]?.id} />
            </>
          )}
          <RolloutPlanView initiatives={initiatives} t={t} />
        </>
      )}

      {/* ── KPI ── */}
      {subview === 'kpi' && (
        <section className="space-y-4">
          <SectionHeader
            icon={<TrendingUp className="text-emerald-500" />}
            title={t('execution.rollout.kpi.title', 'KPI Tracking')}
            subtitle={t(
              'execution.rollout.kpi.subtitle',
              'Monitor operational and financial rollout performance.'
            )}
          />
          {showDerivedKpis ? (
            <div className="space-y-3">
              <DerivedNote
                label={t(
                  'execution.rollout.kpi.derivedNote',
                  'Derived from your initiatives — portfolio delivery health. Add a KPI to start tracking your own.'
                )}
              />
              <DerivedKpiGrid kpis={derivedKpis} t={t} />
            </div>
          ) : kpis.length === 0 ? (
            <EmptyBox
              icon={<Target className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
              message={t(
                'execution.rollout.kpi.empty',
                'No KPIs tracked yet. Add your first KPI to start monitoring rollout performance.'
              )}
            >
              {!readOnly && (
                <Button variant="outline" size="sm" onClick={seedAtelierRollout} disabled={busy}>
                  <Sparkles size={14} />{' '}
                  {t('execution.rollout.kpi.seedDemo', 'Load Atelier Toys example')}
                </Button>
              )}
            </EmptyBox>
          ) : (
            <FilterableTable
              columns={kpiColumns}
              data={kpiRows}
              persistKey="rollout-kpis"
              activeFilters={kpiFilters}
              onFilterChange={setKpiFilters}
              onRowDoubleClick={
                readOnly
                  ? undefined
                  : (row) => {
                      const k = kpis.find((x) => x.id === row.id);
                      if (k) setEditTarget({ kind: 'kpi', row: k });
                    }
              }
              getRowActions={readOnly ? () => [] : (row) => buildKpiRowActions(String(row.id))}
              hideRowActions={readOnly}
              emptyMessage={t('execution.rollout.kpi.empty', 'No KPIs tracked yet.')}
              density="compact"
              canvasClassName="p-0"
            />
          )}
        </section>
      )}

      {/* ── RISKS ── */}
      {subview === 'risks' && (
        <section className="space-y-4">
          {teresaCallout}
          <SectionHeader
            icon={<AlertOctagon className="text-crimson-500" />}
            title={t('execution.rollout.risks.title', 'Risk Register')}
            subtitle={t(
              'execution.rollout.risks.subtitle',
              'Track rollout risks, likelihood, impact, and mitigation.'
            )}
          />
          {showDerivedRisks ? (
            <div className="space-y-3">
              <DerivedNote
                label={t(
                  'execution.rollout.risks.derivedNote',
                  'Derived from your initiatives — blocked, at-risk and overdue items. Add a risk to maintain your own register.'
                )}
              />
              <DerivedRiskTable risks={derivedRisks} t={t} />
            </div>
          ) : risks.length === 0 ? (
            <EmptyBox
              icon={<AlertOctagon className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
              message={t('execution.rollout.risks.empty', 'No risks logged.')}
            />
          ) : (
            <FilterableTable
              columns={riskColumns}
              data={risks as any[]}
              persistKey="rollout-risks"
              activeFilters={riskFilters}
              onFilterChange={setRiskFilters}
              onRowDoubleClick={
                readOnly
                  ? undefined
                  : (row) => {
                      const r = risks.find((x) => x.id === row.id);
                      if (r) setEditTarget({ kind: 'risk', row: r });
                    }
              }
              getRowActions={readOnly ? () => [] : (row) => buildRiskRowActions(String(row.id))}
              hideRowActions={readOnly}
              emptyMessage={t('execution.rollout.risks.empty', 'No risks logged.')}
              density="compact"
              canvasClassName="p-0"
            />
          )}
        </section>
      )}

      {/* ── CHANGE ── */}
      {subview === 'change' && (
        <section className="space-y-4">
          <SectionHeader
            icon={<Sparkles className="text-amber-500" />}
            title={t('execution.rollout.change.title', 'Change Log')}
            subtitle={t(
              'execution.rollout.change.subtitle',
              'Automatic timeline of rollout changes — logged as approvals and edits land.'
            )}
          />
          {changes.length === 0 ? (
            <EmptyBox
              icon={<Sparkles className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
              message={t('execution.rollout.change.empty', 'No change requests logged.')}
            />
          ) : (
            <FilterableTable
              columns={changeColumns}
              data={changes as any[]}
              persistKey="rollout-changes"
              activeFilters={changeFilters}
              onFilterChange={setChangeFilters}
              onRowDoubleClick={
                readOnly
                  ? undefined
                  : (row) => {
                      const c = changes.find((x) => x.id === row.id);
                      if (c) setEditTarget({ kind: 'change', row: c });
                    }
              }
              getRowActions={readOnly ? () => [] : (row) => buildChangeRowActions(String(row.id))}
              hideRowActions={readOnly}
              emptyMessage={t('execution.rollout.change.empty', 'No change requests logged.')}
              density="compact"
              canvasClassName="p-0"
            />
          )}
        </section>
      )}

      {/* ── CLOSURE ── */}
      {subview === 'closure' && (
        <section className="space-y-4">
          <SectionHeader
            icon={<CheckSquare className="text-blue-500" />}
            title={t('execution.rollout.closure.title', 'Closure Checklist')}
            subtitle={t(
              'execution.rollout.closure.subtitle',
              'Handover, sign-off, and project closure actions.'
            )}
          />
          {/* L-05 / DP-6: feed-forward M14→M15 (Results) is preview-only this round.
              No real sync is performed yet — surface a clear, honest label instead
              of a dead "sync" affordance. Real export lands after the Results (M15)
              beta opens. */}
          <Callout
            variant="info"
            compact
            title={t(
              'execution.rollout.closure.resultsHandoff.title',
              'Results hand-off — preview only'
            )}
          >
            {t(
              'execution.rollout.closure.resultsHandoff.body',
              'Closure outcomes (value delivered, ROI, KPI deltas) are not yet synced to the Results module. This hand-off is a preview for this release; automatic sync to Results will be enabled in an upcoming phase.'
            )}
          </Callout>
          {showDerivedClosures ? (
            <div className="space-y-3">
              <DerivedNote
                label={t(
                  'execution.rollout.closure.derivedNote',
                  'Derived from completed initiatives — PMI/PRINCE2 handover, sign-off and closure actions. Add an item to maintain your own checklist.'
                )}
              />
              <DerivedClosureList closures={derivedClosures} />
            </div>
          ) : closures.length === 0 ? (
            <EmptyBox
              icon={<CheckSquare className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
              message={t('execution.rollout.closure.empty', 'No closure items yet.')}
            />
          ) : (
            <FilterableTable
              columns={closureColumns}
              data={closures as any[]}
              persistKey="rollout-closures"
              activeFilters={closureFilters}
              onFilterChange={setClosureFilters}
              onRowDoubleClick={
                readOnly
                  ? undefined
                  : (row) => {
                      const c = closures.find((x) => x.id === row.id);
                      if (c) setEditTarget({ kind: 'closure', row: c });
                    }
              }
              getRowActions={readOnly ? () => [] : (row) => buildClosureRowActions(String(row.id))}
              hideRowActions={readOnly}
              emptyMessage={t('execution.rollout.closure.empty', 'No closure items yet.')}
              density="compact"
              canvasClassName="p-0"
            />
          )}
        </section>
      )}

      {/* Canon §27 — register edit modal + delete confirmation (shared across
          KPI / Risk / Change / Closure). Persistence routes back through the
          existing patch + delete handlers (to /api/rollout/*). */}
      <RolloutRegisterEditModal
        target={editTarget}
        onClose={() => setEditTarget(null)}
        onSaveKpi={(id, updates) => patchKpi(id, updates)}
        onSaveRisk={(id, updates) => patchRisk(id, updates)}
        onSaveChange={(id, updates) => patchChange(id, updates)}
        onSaveClosure={(id, updates) => patchClosure(id, updates)}
        busy={busy}
      />
      {confirmDialog}
    </div>
  );
};

// ── Sub-components ──────────────────────────────────────────────────────────

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action?: React.ReactNode;
}> = ({ icon, title, subtitle, action }) => (
  <div className="flex items-start justify-between gap-3">
    <div>
      <h2 className="text-xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
        {icon}
        {title}
      </h2>
      <p className="text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
    </div>
    {action}
  </div>
);

/** Subtle banner marking a table/grid as derived (read-only) from initiatives. */
const DerivedNote: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-navy-950 border border-dashed border-slate-200 dark:border-navy-700 rounded-lg px-3 py-2">
    <Sparkles size={13} className="text-blue-400 shrink-0" />
    <span>{label}</span>
  </div>
);

const EmptyBox: React.FC<{
  icon: React.ReactNode;
  message: string;
  children?: React.ReactNode;
}> = ({ icon, message, children }) => (
  <div className="py-14 flex flex-col items-center justify-center gap-3 text-center bg-slate-50 dark:bg-navy-900 border border-dashed border-slate-200 dark:border-navy-700 rounded-xl">
    {icon}
    <p className="text-sm text-slate-600 dark:text-slate-500 max-w-md">{message}</p>
    {children}
  </div>
);

const KpiCell: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
      {label}
    </div>
    <div className="font-mono font-bold text-slate-700 dark:text-slate-300">{children}</div>
  </div>
);

const KpiSparkline: React.FC<{ points: number[]; target: number }> = ({ points, target }) => {
  if (points.length < 2) {
    return (
      <div className="h-12 mb-3 rounded border border-dashed border-slate-200 dark:border-navy-700 flex items-center justify-center">
        <span className="text-[10px] text-slate-600 dark:text-slate-500">No history yet</span>
      </div>
    );
  }
  const max = Math.max(target || 1, ...points, 1);
  return (
    <div className="h-12 mb-3 bg-slate-50 dark:bg-navy-950 rounded border border-slate-200 dark:border-navy-700 flex items-end gap-0.5 px-2 pb-1 overflow-hidden">
      {points.map((val, idx) => (
        <div
          key={idx}
          className="flex-1 bg-emerald-500/30 rounded-t-sm"
          style={{ height: `${Math.max(4, (val / max) * 100)}%` }}
          title={String(val)}
        />
      ))}
    </div>
  );
};

// §27-exempt: document-layout — renders JSX children with styled badges/signals, not a flat data array
const RegisterTable: React.FC<{ headers: string[]; children: React.ReactNode }> = ({
  headers,
  children,
}) => (
  <div className="overflow-x-auto bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
    <table className="w-full text-left">
      <thead className="bg-slate-50 dark:bg-navy-950">
        <tr>
          {headers.map((h, i) => (
            <th
              key={i}
              className={`sticky top-0 z-10 bg-slate-50 dark:bg-navy-950 p-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 ${
                i === headers.length - 1 ? 'text-right' : 'text-left'
              }`}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-white/5">{children}</tbody>
    </table>
  </div>
);

// ── Derived (read-only) renderers (#14/#16/#18) ─────────────────────────────

const DerivedKpiGrid: React.FC<{
  kpis: DerivedKpi[];
  t: ReturnType<typeof useTranslation>['t'];
}> = ({ kpis, t }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {kpis.map((kpi) => (
      <div
        key={kpi.id}
        className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 p-5 rounded-xl shadow-sm"
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className="flex-1 font-bold text-slate-800 dark:text-white">{kpi.name}</span>
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded ${
              kpi.tone === 'danger'
                ? 'bg-crimson-50 text-crimson-700 dark:bg-crimson-900/30 dark:text-crimson-300'
                : kpi.tone === 'warning'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                  : kpi.tone === 'success'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300'
            }`}
          >
            <SignalDot tone={kpi.tone} />
            {progressPct(kpi)}%
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <KpiCell label={t('execution.rollout.kpi.baseline', 'Baseline')}>
            {kpi.baseline}
            {kpi.unit}
          </KpiCell>
          <div className="border-x border-slate-200 dark:border-navy-700">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              {t('execution.rollout.kpi.current', 'Current')}
            </div>
            <div className="font-mono font-bold text-xl text-slate-800 dark:text-white tabular-nums">
              {kpi.current_value}
              {kpi.unit}
            </div>
          </div>
          <KpiCell label={t('execution.rollout.kpi.target', 'Target')}>
            {kpi.target}
            {kpi.unit}
          </KpiCell>
        </div>
      </div>
    ))}
  </div>
);

const DerivedRiskTable: React.FC<{
  risks: DerivedRisk[];
  t: ReturnType<typeof useTranslation>['t'];
}> = ({ risks, t }) => (
  <RegisterTable
    headers={[
      t('execution.rollout.risks.col.title', 'Title'),
      t('execution.rollout.risks.col.probability', 'Probability'),
      t('execution.rollout.risks.col.impact', 'Impact'),
      t('execution.rollout.risks.col.status', 'Status'),
    ]}
  >
    {risks.map((r) => (
      <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
        <td className="p-3 font-medium text-slate-700 dark:text-slate-200">{r.title}</td>
        <td className="p-3">
          <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 capitalize">
            <SignalDot tone={levelTone(r.probability)} />
            {r.probability}
          </span>
        </td>
        <td className="p-3">
          <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 capitalize">
            <SignalDot tone={levelTone(r.impact)} />
            {r.impact}
          </span>
        </td>
        <td className="p-3">
          <span className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <SignalDot tone={riskStatusTone(r.status)} />
            {t('execution.rollout.risks.status.open', 'Open')}
          </span>
        </td>
      </tr>
    ))}
  </RegisterTable>
);

const DerivedClosureList: React.FC<{ closures: DerivedClosure[] }> = ({ closures }) => (
  <div className="space-y-2">
    {closures.map((c) => {
      const done = c.status.toUpperCase() === 'DONE';
      return (
        <div
          key={c.id}
          className="flex items-center gap-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-3"
        >
          <span className="shrink-0 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-navy-800 dark:text-slate-300">
            <SignalDot tone={done ? 'success' : 'neutral'} />
            {c.category}
          </span>
          <span
            className={`flex-1 ${
              done
                ? 'line-through text-slate-600 dark:text-slate-500'
                : 'text-slate-700 dark:text-slate-200'
            }`}
          >
            {c.title}
          </span>
        </div>
      );
    })}
  </div>
);

// ── Signal-dot tones (canon §4: leading colored dot on status/level chips) ──
type SignalTone = 'success' | 'warning' | 'danger' | 'neutral';

const DOT_CLASS: Record<SignalTone, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-crimson-500',
  neutral: 'bg-slate-400 dark:bg-slate-500',
};

/** Leading signal dot — builds the vertical scan-rail on status/level columns. */
const SignalDot: React.FC<{ tone: SignalTone }> = ({ tone }) => (
  <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASS[tone]}`} aria-hidden />
);

const levelTone = (v: string): SignalTone => {
  const k = v.toLowerCase();
  if (k === 'high') return 'danger';
  if (k === 'medium') return 'warning';
  if (k === 'low') return 'success';
  return 'neutral';
};

const riskStatusTone = (v: string): SignalTone => {
  const k = v.toUpperCase();
  if (k === 'CLOSED') return 'success';
  if (k === 'MITIGATED') return 'warning';
  if (k === 'OPEN') return 'danger';
  return 'neutral';
};

const changeStatusTone = (v: string): SignalTone => {
  const k = v.toUpperCase();
  if (k === 'IMPLEMENTED' || k === 'APPROVED') return 'success';
  if (k === 'PROPOSED') return 'warning';
  if (k === 'REJECTED') return 'danger';
  return 'neutral';
};

// ── Plan view: real initiatives grouped by quarter from plannedStartDate ────

const RolloutPlanView: React.FC<{
  initiatives: FullInitiative[];
  t: ReturnType<typeof useTranslation>['t'];
}> = ({ initiatives, t }) => {
  const groups = useMemo(() => {
    const map = new Map<string, FullInitiative[]>();
    for (const init of initiatives) {
      const start = (init as { plannedStartDate?: string }).plannedStartDate;
      let key = t('execution.rollout.plan.unscheduled', 'Unscheduled');
      if (start) {
        const d = new Date(start);
        if (!Number.isNaN(d.getTime())) {
          key = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
        }
      }
      map.set(key, [...(map.get(key) || []), init]);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [initiatives, t]);

  return (
    <section className="space-y-4">
      <SectionHeader
        icon={<ClipboardList className="text-blue-500" />}
        title={t('execution.rollout.plan.title', 'Master Rollout Plan')}
        subtitle={t(
          'execution.rollout.plan.subtitle',
          'Initiatives grouped by planned rollout quarter.'
        )}
      />
      {initiatives.length === 0 ? (
        <EmptyBox
          icon={<ClipboardList className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
          message={t('execution.rollout.plan.empty', 'No initiatives scheduled for rollout yet.')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(([quarter, inits]) => {
            const overloaded = inits.length > 4;
            return (
              <div
                key={quarter}
                className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-slate-800 dark:text-white">{quarter}</h3>
                  {overloaded && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-crimson-50 text-crimson-700 dark:bg-crimson-900/30 dark:text-crimson-300">
                      {t('execution.rollout.plan.overloaded', 'Overloaded')}
                    </span>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {inits.map((i) => (
                    <li
                      key={i.id}
                      className="text-sm text-slate-600 dark:text-slate-300 truncate flex items-center gap-2"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                      {i.name || i.id}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default RolloutTab;
