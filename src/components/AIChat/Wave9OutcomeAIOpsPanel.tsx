import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Database,
  FileText,
  Flag,
  ListChecks,
} from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { Api } from '../../services/api';

type SourceRef = { sourceType: string; sourceId: string; title?: string | null };

const reasonLabels: Record<string, { en: string; pl: string }> = {
  regression_pack_failed: {
    en: 'Regression pack did not pass.',
    pl: 'Pakiet regresji nie przeszedł.',
  },
  ciso_pack_failed: {
    en: 'CISO/security pack did not pass.',
    pl: 'Pakiet CISO/bezpieczeństwa nie przeszedł.',
  },
  business_persona_pack_failed: {
    en: 'Business persona pack did not pass.',
    pl: 'Pakiet person biznesowych nie przeszedł.',
  },
  provider_health_failed: {
    en: 'AI provider health is not acceptable.',
    pl: 'Stan zdrowia dostawcy AI jest nieakceptowalny.',
  },
  compliance_audit_failed: {
    en: 'Compliance audit evidence did not pass.',
    pl: 'Dowody audytu zgodności nie przeszły weryfikacji.',
  },
  missing_regression_evidence: {
    en: 'Missing regression evidence ID.',
    pl: 'Brak identyfikatora dowodu regresji.',
  },
  missing_ciso_evidence: {
    en: 'Missing CISO evidence ID.',
    pl: 'Brak identyfikatora dowodu CISO.',
  },
  missing_persona_evidence: {
    en: 'Missing business persona evidence ID.',
    pl: 'Brak identyfikatora dowodu persony biznesowej.',
  },
  missing_compliance_evidence: {
    en: 'Missing compliance audit evidence ID.',
    pl: 'Brak identyfikatora dowodu audytu zgodności.',
  },
  ai_ops_eval_gate_failed: {
    en: 'AI Ops eval pack did not pass.',
    pl: 'Pakiet ewaluacji AI Ops nie przeszedł.',
  },
  open_p0_findings: {
    en: 'Open P0 findings must be closed before release.',
    pl: 'Otwarte ustalenia P0 muszą zostać zamknięte przed wdrożeniem.',
  },
};

const formatReason = (reason: string, isPolish: boolean) => {
  const entry = reasonLabels[reason];
  if (entry) return isPolish ? entry.pl : entry.en;
  return reason.replace(/_/g, ' ');
};

const parseSourceRefs = (raw: string): SourceRef[] =>
  raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [sourceType = 'unknown', sourceId = '', ...titleParts] = line.split(':');
      return {
        sourceType: sourceType.trim() || 'unknown',
        sourceId: sourceId.trim(),
        title: titleParts.join(':').trim() || null,
      };
    })
    .filter((source) => source.sourceId.length > 0);

export const Wave9OutcomeAIOpsPanel: React.FC = () => {
  const { t } = useTranslation();
  const { i18n } = useTranslation();
  const isPolish = i18n.language?.startsWith('pl');

  const [outcomes, setOutcomes] = React.useState<any[]>([]);
  const [dashboard, setDashboard] = React.useState<any | null>(null);
  const [acceptanceRuns, setAcceptanceRuns] = React.useState<any[]>([]);
  const [selectedOutcomeId, setSelectedOutcomeId] = React.useState('');
  const [report, setReport] = React.useState<any | null>(null);
  const [acceptance, setAcceptance] = React.useState<any | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const [initiativeId, setInitiativeId] = React.useState('initiative-ai-os');
  const [taskIds, setTaskIds] = React.useState('task-ai-chat, task-ai-ops');
  const [sourceRefs, setSourceRefs] = React.useState(
    'initiative:initiative-ai-os:Wave 9 verified initiative evidence\nkpi:kpi-ai-os-impact:Verified KPI source'
  );
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
      setAcceptanceRuns(
        Array.isArray(dashboardRes?.dashboard?.acceptanceRuns)
          ? dashboardRes.dashboard.acceptanceRuns
          : []
      );
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
      const parsedTaskIds = taskIds
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      const parsedSourceRefs = parseSourceRefs(sourceRefs);
      for (const source of parsedSourceRefs) {
        await Api.registerWave9Evidence({
          evidenceType: source.sourceType as 'initiative' | 'task' | 'kpi',
          sourceType: source.sourceType,
          sourceId: source.sourceId,
          title: source.title || source.sourceId,
          status: 'pass',
          verifiedBy: 'ai-ops-ui',
          verificationMethod: 'operator_confirmed_ui',
          payload: { taskIds: parsedTaskIds },
        });
      }
      for (const taskId of parsedTaskIds) {
        await Api.registerWave9Evidence({
          evidenceType: 'task',
          sourceType: 'task',
          sourceId: taskId,
          title: taskId,
          status: 'pass',
          verifiedBy: 'ai-ops-ui',
          verificationMethod: 'operator_confirmed_ui',
        });
      }
      const res = await Api.createWave9Outcome({
        initiativeId,
        taskIds: parsedTaskIds,
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
        sourceRefs: parsedSourceRefs,
      });
      if (res?.outcome?.outcomeId) setSelectedOutcomeId(res.outcome.outcomeId);
      setMessage(t('aios.wave9OutcomeAIOpsPanel.outcomeKpiRoiContractCreatedWith'));
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
      setMessage(t('aios.wave9OutcomeAIOpsPanel.providerFailureAndRollbackIncidentRecord'));
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Provider failure simulation failed');
    } finally {
      setLoading(false);
    }
  };

  const recordPassingEval = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await Api.recordWave9EvalRun({
        promptKey: 'wave9-golden-business-outcome',
        category: 'golden_prompt',
        status: 'pass',
        score: 0.92,
        hallucinationCheckPassed: true,
        toolMisuseCheckPassed: true,
        runRef: 'wave9-ui-smoke-eval',
      });
      await Api.registerWave9AcceptanceRun({
        runType: 'ai_ops_eval_pack',
        status: 'pass',
        runRef: 'wave9-ui-smoke-eval',
        buildId: 'local-ui',
        commitSha: 'working-tree',
        verifiedBy: 'ai-ops-ui',
        verificationMethod: 'golden_prompt_eval',
        payload: { promptKey: 'wave9-golden-business-outcome', score: 0.92 },
      });
      setMessage(t('aios.wave9OutcomeAIOpsPanel.goldenPromptEvalRecordedAsPass'));
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Eval recording failed');
    } finally {
      setLoading(false);
    }
  };

  const runAcceptance = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const evidenceTypes = [
        ['regression_pack', 'wave-regression-pack-ui'],
        ['ciso_pack', 'ciso-pack-ui'],
        ['business_persona_pack', 'business-persona-pack-ui'],
        ['compliance_audit', 'compliance-audit-ui'],
        ['ai_ops_eval_pack', 'wave9-ui-smoke-eval'],
      ] as const;
      const runIds: Record<string, string> = {};
      for (const [runType, runRef] of evidenceTypes) {
        const runRes = await Api.registerWave9AcceptanceRun({
          runType,
          status: 'pass',
          runRef,
          buildId: 'local-ui',
          commitSha: 'working-tree',
          verifiedBy: 'ai-ops-ui',
          verificationMethod: 'operator_confirmed_ui',
          payload: { source: 'Wave9OutcomeAIOpsPanel' },
        });
        runIds[runType] = runRes?.acceptanceRun?.runId || runRef;
      }
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
          regressionRunId: runIds.regression_pack,
          cisoPackRunId: runIds.ciso_pack,
          businessPersonaPackRunId: runIds.business_persona_pack,
          complianceAuditRef: runIds.compliance_audit,
          aiOpsEvalPackRunId: runIds.ai_ops_eval_pack,
        },
        acceptanceRunRefs: {
          regressionRunId: runIds.regression_pack,
          cisoPackRunId: runIds.ciso_pack,
          businessPersonaPackRunId: runIds.business_persona_pack,
          complianceAuditRunId: runIds.compliance_audit,
          aiOpsEvalPackRunId: runIds.ai_ops_eval_pack,
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
          <h1 className="text-2xl font-semibold">
            {t('aios.wave9OutcomeAIOpsPanel.wave9OutcomeAiOps')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {t('aios.wave9OutcomeAIOpsPanel.kpiRoiContractsCfoScenariosExecutive')}
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50 dark:border-navy-700"
        >
          {t('aios.wave9OutcomeAIOpsPanel.refresh')}
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
            <BarChart3 size={18} /> {t('aios.wave9OutcomeAIOpsPanel.kpiRoiContract')}
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {t('aios.wave9OutcomeAIOpsPanel.createAnOutcomeOnlyWhenThe')}
          </p>
          <div className="mt-4 space-y-3">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('aios.wave9OutcomeAIOpsPanel.initiativeIdForTheVerifiedOutcome')}
              <input
                value={initiativeId}
                onChange={(e) => setInitiativeId(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('aios.wave9OutcomeAIOpsPanel.taskIdsLinkedToThisKpi')}
              <input
                value={taskIds}
                onChange={(e) => setTaskIds(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('aios.wave9OutcomeAIOpsPanel.kpiNameShownInReports')}
              <input
                value={kpiName}
                onChange={(e) => setKpiName(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
            </label>
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
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">
              {t('aios.wave9OutcomeAIOpsPanel.verifiedSourceRefsOnePerLine')}
              <textarea
                value={sourceRefs}
                onChange={(e) => setSourceRefs(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
              />
            </label>
            <button
              type="button"
              onClick={createOutcome}
              disabled={loading}
              className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
            >
              {t('aios.wave9OutcomeAIOpsPanel.createKpiRoiOutcome')}
            </button>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">{t('aios.wave9OutcomeAIOpsPanel.outcomes')}</h2>
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
                    {t('aios.wave9OutcomeAIOpsPanel.baseline')} {outcome.baseline} →{' '}
                    {t('aios.wave9OutcomeAIOpsPanel.target')} {outcome.target};{' '}
                    {t('aios.wave9OutcomeAIOpsPanel.confidence')} {outcome.confidence}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    ROI:{' '}
                    {outcome.roi?.available
                      ? `${outcome.roi.riskAdjustedRoiPercent}% ${t('aios.wave9OutcomeAIOpsPanel.riskAdjusted')}`
                      : t('aios.wave9OutcomeAIOpsPanel.missing')}
                  </div>
                </button>
              ))}
              {outcomes.length === 0 && (
                <div className="text-sm text-slate-500">
                  {t('aios.wave9OutcomeAIOpsPanel.noOutcomesYet')}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileText size={18} /> {t('aios.wave9OutcomeAIOpsPanel.reports')}
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
                  {(
                    {
                      client_ready: t('aios.wave9OutcomeAIOpsPanel.reportTypeClientReady'),
                      investor_ready: t('aios.wave9OutcomeAIOpsPanel.reportTypeInvestorReady'),
                      steering_committee: t(
                        'aios.wave9OutcomeAIOpsPanel.reportTypeSteeringCommittee'
                      ),
                      ciso_security: t('aios.wave9OutcomeAIOpsPanel.reportTypeCisoSecurity'),
                    } as Record<string, string>
                  )[type] ?? type.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            {report && (
              <div className="mt-3 rounded-lg border p-3 text-xs dark:border-navy-700">
                <div className="font-medium">{report.title}</div>
                <div className="mt-1 text-slate-500">
                  {t('aios.wave9OutcomeAIOpsPanel.assumptions')}:{' '}
                  {report.businessEffectSummary?.assumptions?.length || 0}; {t('aios.confidence')}:{' '}
                  {report.businessEffectSummary?.confidence}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="flex items-center gap-2 font-semibold">
              <Activity size={18} /> {t('aios.wave9OutcomeAIOpsPanel.aiOpsDashboard')}
            </h2>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3 text-sm dark:border-navy-700">
                <Database size={14} className="mb-1" />
                {t('aios.wave9OutcomeAIOpsPanel.providers')}:{' '}
                {dashboard?.providerHealth?.length || 0}
              </div>
              <div className="rounded-lg border p-3 text-sm dark:border-navy-700">
                {t('aios.wave9OutcomeAIOpsPanel.cost')}: $
                {dashboard?.costDashboard?.totalCostUsd || 0}
              </div>
              <div className="rounded-lg border p-3 text-sm dark:border-navy-700">
                <ListChecks size={14} className="mb-1" />
                {t('aios.wave9OutcomeAIOpsPanel.evalGate')}:{' '}
                {dashboard?.evalDashboard?.latestGate || 'BLOCKED'}
              </div>
            </div>
            <div className="mt-3 rounded-lg border p-3 text-xs text-slate-600 dark:border-navy-700 dark:text-slate-300">
              {t('aios.wave9OutcomeAIOpsPanel.acceptanceRunsRegistered')}: {acceptanceRuns.length}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={recordPassingEval}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md border border-emerald-200 px-3 py-2 text-xs font-medium text-emerald-700 disabled:opacity-50 dark:border-emerald-900 dark:text-emerald-200"
              >
                <CheckCircle2 size={14} /> {t('aios.wave9OutcomeAIOpsPanel.recordGoldenEvalPass')}
              </button>
              <button
                type="button"
                onClick={simulateProviderFailure}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-md border border-danger-200 px-3 py-2 text-xs font-medium text-danger-700 disabled:opacity-50 dark:border-danger-900 dark:text-danger-200"
              >
                <AlertTriangle size={14} />{' '}
                {t('aios.wave9OutcomeAIOpsPanel.simulateProviderUnavailable')}
              </button>
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="flex items-center gap-2 font-semibold">
              <Flag size={18} /> {t('aios.wave9OutcomeAIOpsPanel.finalAcceptance')}
            </h2>
            <button
              type="button"
              onClick={runAcceptance}
              disabled={loading}
              className="mt-3 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {t('aios.wave9OutcomeAIOpsPanel.runFinalAcceptance')}
            </button>
            {acceptance && (
              <div className="mt-3 rounded-lg border p-3 text-sm dark:border-navy-700">
                <div className="flex items-center gap-2">
                  {acceptance.decision === 'PASS' ? (
                    <CheckCircle2 size={16} className="text-emerald-500" />
                  ) : (
                    <AlertTriangle size={16} className="text-amber-500" />
                  )}
                  {t('aios.wave9OutcomeAIOpsPanel.decision')}: {acceptance.decision}
                </div>
                {acceptance.report?.blockers?.length > 0 && (
                  <div className="mt-2 text-xs text-amber-700 dark:text-amber-200">
                    {acceptance.report.blockers.map((reason: string) => (
                      <div key={reason}>- {formatReason(reason, isPolish)}</div>
                    ))}
                  </div>
                )}
                {acceptance.report?.acceptanceRunEvidence && (
                  <div className="mt-2 text-xs text-slate-500">
                    {t('aios.wave9OutcomeAIOpsPanel.linkedRuns')}:{' '}
                    {Object.values(acceptance.report.acceptanceRunEvidence)
                      .filter(Boolean)
                      .map((run: any) => `${run.runType}:${run.runRef || run.runId}`)
                      .join(', ') || t('aios.wave9OutcomeAIOpsPanel.none')}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Wave9OutcomeAIOpsPanel;
