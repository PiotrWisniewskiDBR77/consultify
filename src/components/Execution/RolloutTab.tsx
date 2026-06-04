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
  Plus,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/primitives';
import { Api } from '@/services/api';

import type { FullInitiative } from '../../types';
import { HubWorkAreaLoadError, HubWorkAreaLoading } from '../shared/ModuleHub';
import {
  MENU_3_BADGE_ACTIVE,
  MENU_3_BADGE_INACTIVE,
  MENU_3_CHIP_ACTIVE,
  MENU_3_CHIP_INACTIVE,
  MENU_3_LEFT_CLASS,
} from '../shared/ModuleMenu3';
import { Callout } from '../shared/NModeBlocks';
import type { DelaySignalItem, RiskSignalItem } from './ExecutionTimelineView';

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
  const [subview, setSubview] = useState<RolloutSubview>('kpi');

  const [kpis, setKpis] = useState<RolloutKpi[]>([]);
  const [kpiHistory, setKpiHistory] = useState<Record<string, number[]>>({});
  const [risks, setRisks] = useState<RolloutRisk[]>([]);
  const [changes, setChanges] = useState<RolloutChange[]>([]);
  const [closures, setClosures] = useState<RolloutClosure[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

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
      {subview === 'plan' && <RolloutPlanView initiatives={initiatives} t={t} />}

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
            action={
              !readOnly && (
                <Button variant="brand" size="sm" onClick={addKpi} disabled={busy}>
                  <Plus size={16} /> {t('execution.rollout.kpi.add', 'Add KPI')}
                </Button>
              )
            }
          />
          {kpis.length === 0 ? (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {kpis.map((kpi) => {
                const pct = progressPct(kpi);
                const belowBaseline = kpi.current_value < kpi.baseline;
                return (
                  <div
                    key={kpi.id}
                    className="bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 p-5 rounded-xl shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <input
                        value={kpi.name}
                        disabled={readOnly}
                        onChange={(e) =>
                          setKpis((p) =>
                            p.map((k) => (k.id === kpi.id ? { ...k, name: e.target.value } : k))
                          )
                        }
                        onBlur={(e) => patchKpi(kpi.id, { name: e.target.value })}
                        className="flex-1 bg-transparent font-bold text-slate-800 dark:text-white outline-none"
                      />
                      <span
                        className={`shrink-0 text-xs font-bold px-2 py-1 rounded ${
                          belowBaseline
                            ? 'bg-crimson-50 text-crimson-700 dark:bg-crimson-900/30 dark:text-crimson-300'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }`}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                      <KpiCell label={t('execution.rollout.kpi.baseline', 'Baseline')}>
                        {kpi.baseline}
                        {kpi.unit}
                      </KpiCell>
                      <div className="border-x border-slate-200 dark:border-navy-700">
                        <div className="text-[10px] text-slate-600 uppercase font-bold">
                          {t('execution.rollout.kpi.current', 'Current')}
                        </div>
                        <input
                          type="number"
                          value={kpi.current_value}
                          disabled={readOnly}
                          onChange={(e) =>
                            setKpis((p) =>
                              p.map((k) =>
                                k.id === kpi.id
                                  ? { ...k, current_value: Number(e.target.value) }
                                  : k
                              )
                            )
                          }
                          onBlur={(e) => patchKpi(kpi.id, { currentValue: Number(e.target.value) })}
                          className="w-full text-center bg-transparent font-mono font-bold text-xl text-slate-800 dark:text-white outline-none"
                        />
                      </div>
                      <KpiCell label={t('execution.rollout.kpi.target', 'Target')}>
                        {kpi.target}
                        {kpi.unit}
                      </KpiCell>
                    </div>
                    <KpiSparkline points={kpiHistory[kpi.id] || []} target={kpi.target} />
                    {!readOnly && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => deleteKpi(kpi.id)}
                          className="text-crimson-500 hover:text-crimson-600 text-xs font-medium flex items-center gap-1"
                        >
                          <Trash2 size={12} /> {t('common.delete', 'Delete')}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
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
            action={
              !readOnly && (
                <Button variant="brand" size="sm" onClick={addRisk} disabled={busy}>
                  <Plus size={16} /> {t('execution.rollout.risks.add', 'Add Risk')}
                </Button>
              )
            }
          />
          {risks.length === 0 ? (
            <EmptyBox
              icon={<AlertOctagon className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
              message={t('execution.rollout.risks.empty', 'No risks logged.')}
            />
          ) : (
            <RegisterTable
              headers={[
                t('execution.rollout.risks.col.title', 'Title'),
                t('execution.rollout.risks.col.probability', 'Probability'),
                t('execution.rollout.risks.col.impact', 'Impact'),
                t('execution.rollout.risks.col.status', 'Status'),
                '',
              ]}
            >
              {risks.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-3">
                    <input
                      value={r.title}
                      disabled={readOnly}
                      onChange={(e) =>
                        setRisks((p) =>
                          p.map((x) => (x.id === r.id ? { ...x, title: e.target.value } : x))
                        )
                      }
                      onBlur={(e) => patchRisk(r.id, { title: e.target.value })}
                      className="w-full bg-transparent font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                  </td>
                  <td className="p-3">
                    <LevelSelect
                      value={r.probability}
                      disabled={readOnly}
                      onChange={(v) => patchRisk(r.id, { probability: v })}
                    />
                  </td>
                  <td className="p-3">
                    <LevelSelect
                      value={r.impact}
                      disabled={readOnly}
                      onChange={(v) => patchRisk(r.id, { impact: v })}
                    />
                  </td>
                  <td className="p-3">
                    <select
                      value={r.status}
                      disabled={readOnly}
                      onChange={(e) => patchRisk(r.id, { status: e.target.value })}
                      className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none"
                    >
                      <option value="OPEN">Open</option>
                      <option value="MITIGATED">Mitigated</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    {!readOnly && <DeleteBtn onClick={() => deleteRisk(r.id)} />}
                  </td>
                </tr>
              ))}
            </RegisterTable>
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
              'Document and approve rollout change requests.'
            )}
            action={
              !readOnly && (
                <Button variant="brand" size="sm" onClick={addChange} disabled={busy}>
                  <Plus size={16} /> {t('execution.rollout.change.add', 'Add Change')}
                </Button>
              )
            }
          />
          {changes.length === 0 ? (
            <EmptyBox
              icon={<Sparkles className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
              message={t('execution.rollout.change.empty', 'No change requests logged.')}
            />
          ) : (
            <RegisterTable
              headers={[
                t('execution.rollout.change.col.title', 'Title'),
                t('execution.rollout.change.col.type', 'Type'),
                t('execution.rollout.change.col.status', 'Status'),
                '',
              ]}
            >
              {changes.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-3">
                    <input
                      value={c.title}
                      disabled={readOnly}
                      onChange={(e) =>
                        setChanges((p) =>
                          p.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x))
                        )
                      }
                      onBlur={(e) => patchChange(c.id, { title: e.target.value })}
                      className="w-full bg-transparent font-medium text-slate-700 dark:text-slate-200 outline-none"
                    />
                  </td>
                  <td className="p-3 text-sm text-slate-500 dark:text-slate-400 capitalize">
                    {c.type}
                  </td>
                  <td className="p-3">
                    <select
                      value={c.status}
                      disabled={readOnly}
                      onChange={(e) => patchChange(c.id, { status: e.target.value })}
                      className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none"
                    >
                      <option value="PROPOSED">Proposed</option>
                      <option value="APPROVED">Approved</option>
                      <option value="REJECTED">Rejected</option>
                      <option value="IMPLEMENTED">Implemented</option>
                    </select>
                  </td>
                  <td className="p-3 text-right">
                    {!readOnly && <DeleteBtn onClick={() => deleteChange(c.id)} />}
                  </td>
                </tr>
              ))}
            </RegisterTable>
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
            action={
              !readOnly && (
                <Button variant="brand" size="sm" onClick={addClosure} disabled={busy}>
                  <Plus size={16} /> {t('execution.rollout.closure.add', 'Add Item')}
                </Button>
              )
            }
          />
          {closures.length === 0 ? (
            <EmptyBox
              icon={<CheckSquare className="w-8 h-8 text-slate-600 dark:text-slate-400" />}
              message={t('execution.rollout.closure.empty', 'No closure items yet.')}
            />
          ) : (
            <div className="space-y-2">
              {closures.map((c) => {
                const done = c.status.toUpperCase() === 'DONE';
                return (
                  <div
                    key={c.id}
                    className="flex items-center gap-3 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl p-3"
                  >
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={readOnly}
                      onChange={() => patchClosure(c.id, { status: done ? 'OPEN' : 'DONE' })}
                      className="h-4 w-4 accent-crimson-600"
                    />
                    <input
                      value={c.title}
                      disabled={readOnly}
                      onChange={(e) =>
                        setClosures((p) =>
                          p.map((x) => (x.id === c.id ? { ...x, title: e.target.value } : x))
                        )
                      }
                      onBlur={(e) => patchClosure(c.id, { title: e.target.value })}
                      className={`flex-1 bg-transparent outline-none ${
                        done
                          ? 'line-through text-slate-600 dark:text-slate-500'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}
                    />
                    {!readOnly && <DeleteBtn onClick={() => deleteClosure(c.id)} />}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
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
    <div className="text-[10px] text-slate-600 uppercase font-bold">{label}</div>
    <div className="font-mono font-bold text-slate-600 dark:text-slate-400">{children}</div>
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

const RegisterTable: React.FC<{ headers: string[]; children: React.ReactNode }> = ({
  headers,
  children,
}) => (
  <div className="overflow-x-auto bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl">
    <table className="w-full text-left">
      <thead className="bg-slate-50 dark:bg-navy-950 text-xs text-slate-500 dark:text-slate-400 uppercase font-semibold">
        <tr>
          {headers.map((h, i) => (
            <th key={i} className="p-3">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-200 dark:divide-white/5">{children}</tbody>
    </table>
  </div>
);

const LevelSelect: React.FC<{
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}> = ({ value, disabled, onChange }) => (
  <select
    value={value}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value)}
    className="bg-transparent text-sm text-slate-600 dark:text-slate-300 outline-none capitalize"
  >
    <option value="low">low</option>
    <option value="medium">medium</option>
    <option value="high">high</option>
  </select>
);

const DeleteBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="text-crimson-500 hover:text-crimson-600 inline-flex items-center"
    aria-label="Delete"
  >
    <Trash2 size={14} />
  </button>
);

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
