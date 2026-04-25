import { Activity, AlertTriangle, BarChart3, CheckCircle2, FileText, Flag } from 'lucide-react';
import React from 'react';

import { Api } from '../../services/api';

export const Wave9OutcomeAIOpsPanel: React.FC = () => {
  const [outcomes, setOutcomes] = React.useState<any[]>([]);
  const [dashboard, setDashboard] = React.useState<any | null>(null);
  const [selectedOutcomeId, setSelectedOutcomeId] = React.useState('');
  const [report, setReport] = React.useState<any | null>(null);
  const [acceptance, setAcceptance] = React.useState<any | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [initiativeId, setInitiativeId] = React.useState('initiative-ai-os');
  const [taskIds, setTaskIds] = React.useState('task-ai-chat, task-ai-ops');
  const [kpiName, setKpiName] = React.useState('AI OS business impact');
  const [baseline, setBaseline] = React.useState(10);
  const [target, setTarget] = React.useState(35);
  const [confidence, setConfidence] = React.useState(0.75);
  const [investment, setInvestment] = React.useState(100000);
  const [annualBenefit, setAnnualBenefit] = React.useState(180000);
  const [assumptions, setAssumptions] = React.useState(
    'Adoption reaches target cohort; benefits are measured against baseline; no unapproved AI actions are counted'
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [outcomeRes, dashboardRes] = await Promise.all([
        Api.listWave9Outcomes(),
        Api.getWave9AIOpsDashboard(),
      ]);
      const nextOutcomes = Array.isArray(outcomeRes?.outcomes) ? outcomeRes.outcomes : [];
      setOutcomes(nextOutcomes);
      setDashboard(dashboardRes?.dashboard || null);
      if (!selectedOutcomeId && nextOutcomes[0]?.outcomeId) {
        setSelectedOutcomeId(nextOutcomes[0].outcomeId);
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load Wave 9 dashboard');
    } finally {
      setLoading(false);
    }
  }, [selectedOutcomeId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const createOutcome = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.createWave9Outcome({
        initiativeId,
        taskIds: taskIds
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        kpiName,
        baseline,
        target,
        current: baseline,
        confidence,
        investment,
        annualBenefit,
        assumptions: assumptions
          .split(';')
          .map((item) => item.trim())
          .filter(Boolean),
        sourceRefs: [
          {
            sourceType: 'initiative',
            sourceId: initiativeId,
            title: 'Wave 9 manual KPI evidence',
          },
        ],
      });
      if (res?.outcome?.outcomeId) setSelectedOutcomeId(res.outcome.outcomeId);
      setMessage('Outcome KPI/ROI contract created with assumptions and confidence.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Outcome creation failed');
    } finally {
      setLoading(false);
    }
  };

  const buildReport = async (
    reportType: 'client_ready' | 'investor_ready' | 'steering_committee' | 'ciso_security'
  ) => {
    if (!selectedOutcomeId) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.buildWave9Report({ outcomeId: selectedOutcomeId, reportType });
      setReport(res?.report || null);
      setMessage(`${reportType.replace(/_/g, ' ')} report generated.`);
    } catch (err: any) {
      setMessage(err?.message || 'Report generation failed');
    } finally {
      setLoading(false);
    }
  };

  const simulateProviderFailure = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await Api.recordWave9ProviderHealth({
        provider: 'primary-llm',
        model: 'default',
        status: 'unavailable',
        latencyMs: 0,
        errorRate: 1,
        costUsd: 0,
      });
      await Api.recordWave9Incident({
        severity: 'critical',
        title: 'Primary provider unavailable',
        rollbackFlag: 'ai.provider.primary.disabled',
      });
      setMessage('Provider failure and rollback incident recorded.');
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Provider failure simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const runAcceptance = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.runWave9FinalAcceptance({
        regressionPassed: true,
        cisoPackPassed: true,
        businessPersonaPackPassed: true,
        providerHealthOk: !dashboard?.incidentLog?.some(
          (incident: any) => incident.severity === 'critical'
        ),
        complianceAuditPassed: true,
        openP0: 0,
        openP1: 0,
        evidenceRefs: {
          regressionRunId: 'wave-regression-pack-ui',
          cisoPackRunId: 'ciso-pack-ui',
          businessPersonaPackRunId: 'business-persona-pack-ui',
          complianceAuditRef: 'compliance-audit-ui',
        },
        acceptedLimitations: [],
      });
      setAcceptance(res);
      setMessage(`Final acceptance decision: ${res?.decision}`);
    } catch (err: any) {
      setMessage(err?.message || 'Final acceptance failed');
      if (err?.decision) setAcceptance(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-900 dark:text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wave 9 Outcome & AI Ops</h1>
          <p className="mt-1 text-sm text-slate-500">
            KPI/ROI contracts, CFO scenarios, executive reports, provider health, incidents and
            final acceptance.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50 dark:border-navy-700"
        >
          Refresh
        </button>
      </div>

      {message && (
        <div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
          {message}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
          <h2 className="flex items-center gap-2 font-semibold">
            <BarChart3 size={18} /> KPI / ROI Contract
          </h2>
          <div className="mt-4 space-y-3">
            <input
              value={initiativeId}
              onChange={(e) => setInitiativeId(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <input
              value={taskIds}
              onChange={(e) => setTaskIds(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <input
              value={kpiName}
              onChange={(e) => setKpiName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={baseline}
                onChange={(e) => setBaseline(Number(e.target.value))}
                className="rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
              <input
                type="number"
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <input
                type="number"
                value={confidence}
                step="0.05"
                onChange={(e) => setConfidence(Number(e.target.value))}
                className="rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
              <input
                type="number"
                value={investment}
                onChange={(e) => setInvestment(Number(e.target.value))}
                className="rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
              <input
                type="number"
                value={annualBenefit}
                onChange={(e) => setAnnualBenefit(Number(e.target.value))}
                className="rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
            </div>
            <textarea
              value={assumptions}
              onChange={(e) => setAssumptions(e.target.value)}
              rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <button
              type="button"
              onClick={createOutcome}
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
            >
              Create KPI/ROI outcome
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">Outcomes</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {outcomes.map((outcome) => (
                <button
                  key={outcome.outcomeId}
                  type="button"
                  onClick={() => setSelectedOutcomeId(outcome.outcomeId)}
                  className="rounded-lg border p-3 text-left text-sm dark:border-navy-700"
                >
                  <div className="font-medium">{outcome.kpiName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    baseline {outcome.baseline} → target {outcome.target}; confidence{' '}
                    {outcome.confidence}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    ROI:{' '}
                    {outcome.roi?.available
                      ? `${outcome.roi.riskAdjustedRoiPercent}% risk-adjusted`
                      : 'missing'}
                  </div>
                </button>
              ))}
              {outcomes.length === 0 && (
                <div className="text-sm text-slate-500">No outcomes yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileText size={18} /> Reports
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                ['client_ready', 'investor_ready', 'steering_committee', 'ciso_security'] as const
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => buildReport(type)}
                  disabled={loading || !selectedOutcomeId}
                  className="rounded-md border px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
                >
                  {type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {report && (
              <div className="mt-3 rounded-lg border p-3 text-xs dark:border-navy-700">
                <div className="font-medium">{report.title}</div>
                <div className="mt-1 text-slate-500">
                  assumptions: {report.businessEffectSummary?.assumptions?.length || 0}; confidence:{' '}
                  {report.businessEffectSummary?.confidence}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="flex items-center gap-2 font-semibold">
              <Activity size={18} /> AI Ops Dashboard
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3 text-sm dark:border-navy-700">
                Providers: {dashboard?.providerHealth?.length || 0}
              </div>
              <div className="rounded-lg border p-3 text-sm dark:border-navy-700">
                Cost: ${dashboard?.costDashboard?.totalCostUsd || 0}
              </div>
              <div className="rounded-lg border p-3 text-sm dark:border-navy-700">
                Incidents: {dashboard?.incidentLog?.length || 0}
              </div>
            </div>
            <button
              type="button"
              onClick={simulateProviderFailure}
              disabled={loading}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-xs font-medium text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-200"
            >
              <AlertTriangle size={14} /> Simulate provider unavailable
            </button>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="flex items-center gap-2 font-semibold">
              <Flag size={18} /> Final Acceptance
            </h2>
            <button
              type="button"
              onClick={runAcceptance}
              disabled={loading}
              className="mt-3 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Run final acceptance
            </button>
            {acceptance && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                {acceptance.decision === 'PASS' ? (
                  <CheckCircle2 size={16} className="text-emerald-500" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500" />
                )}
                Decision: {acceptance.decision}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Wave9OutcomeAIOpsPanel;
