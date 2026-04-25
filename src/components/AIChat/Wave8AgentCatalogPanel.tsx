import { AlertTriangle, Bot, CalendarClock, CheckCircle2, Play, ShieldCheck } from 'lucide-react';
import React from 'react';

import { Api } from '../../services/api';

type Wave8Agent = {
  agentId: string;
  name: string;
  role: string;
  purpose: string;
  persona: string;
  allowedTools: string[];
  blockedTools: string[];
  outputSchema: { type?: string; required?: string[] };
  approvalPolicy: string;
  costClass: string;
  riskLevel: string;
  examples: string[];
};

export const Wave8AgentCatalogPanel: React.FC = () => {
  const [agents, setAgents] = React.useState<Wave8Agent[]>([]);
  const [runs, setRuns] = React.useState<any[]>([]);
  const [schedules, setSchedules] = React.useState<any[]>([]);
  const [notifications, setNotifications] = React.useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = React.useState('research-agent');
  const [goal, setGoal] = React.useState(
    'Prepare a weekly status review with risks and next actions.'
  );
  const [requestedTools, setRequestedTools] = React.useState('search_knowledge_base');
  const [approvalAiRunId, setApprovalAiRunId] = React.useState('');
  const [approvalBudget, setApprovalBudget] = React.useState(false);
  const [cadence, setCadence] = React.useState<'none' | 'daily' | 'weekly'>('none');
  const [swarmEnabled, setSwarmEnabled] = React.useState(false);
  const [swarmApproved, setSwarmApproved] = React.useState(false);
  const [budgetApproved, setBudgetApproved] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const selectedAgent = React.useMemo(
    () => agents.find((agent) => agent.agentId === selectedAgentId) || agents[0],
    [agents, selectedAgentId]
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [catalogRes, runsRes, schedulesRes, notificationsRes] = await Promise.all([
        Api.getWave8AgentCatalog(),
        Api.listWave8AgentRuns(),
        Api.listWave8AgentSchedules(),
        Api.listWave8AgentNotifications(),
      ]);
      const nextAgents = Array.isArray(catalogRes?.agents) ? catalogRes.agents : [];
      setAgents(nextAgents);
      setRuns(Array.isArray(runsRes?.runs) ? runsRes.runs : []);
      setSchedules(Array.isArray(schedulesRes?.schedules) ? schedulesRes.schedules : []);
      setNotifications(
        Array.isArray(notificationsRes?.notifications) ? notificationsRes.notifications : []
      );
      if (!nextAgents.some((agent: Wave8Agent) => agent.agentId === selectedAgentId)) {
        setSelectedAgentId(nextAgents[0]?.agentId || 'research-agent');
      }
    } catch (err: any) {
      setMessage(err?.message || 'Failed to load agent catalog');
    } finally {
      setLoading(false);
    }
  }, [selectedAgentId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const launch = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.launchWave8Agent({
        agentId: selectedAgentId,
        goal,
        requestedTools: requestedTools
          .split(',')
          .map((tool) => tool.trim())
          .filter(Boolean),
        schedule:
          cadence === 'none'
            ? null
            : {
                cadence,
                nextRunAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
              },
        swarm: swarmEnabled
          ? {
              enabled: true,
              approved: swarmApproved,
              budgetApproved,
            }
          : null,
        approval: {
          aiRunId: approvalAiRunId || null,
          budgetApproved: approvalBudget,
        },
      });
      setMessage(
        res?.allowed
          ? `Agent run ${res?.run?.status || 'accepted'} with schema ${res?.run?.schemaValid ? 'valid' : 'pending'}.`
          : `Agent blocked: ${
              res?.run?.audit?.toolDecision?.reason ||
              res?.run?.audit?.swarmDecision?.reason ||
              res?.run?.audit?.approvalDecision?.reason ||
              'policy'
            }`
      );
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Agent launch failed');
      await load();
    } finally {
      setLoading(false);
    }
  };

  const processDue = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await Api.processDueWave8AgentSchedules(new Date().toISOString());
      setMessage(
        `Processed ${Array.isArray(res?.processed) ? res.processed.length : 0} due schedules.`
      );
      await load();
    } catch (err: any) {
      setMessage(err?.message || 'Schedule processing failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-900 dark:text-white">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Wave 8 Agent Catalog</h1>
          <p className="mt-1 text-sm text-slate-500">
            Specialized agents with role prompts, tool scopes, output schemas and scheduled work
            audit.
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

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
          <h2 className="flex items-center gap-2 font-semibold">
            <Bot size={18} /> Launch Agent
          </h2>
          <div className="mt-4 space-y-3">
            <select
              value={selectedAgentId}
              onChange={(event) => setSelectedAgentId(event.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              {agents.map((agent) => (
                <option key={agent.agentId} value={agent.agentId}>
                  {agent.name} ({agent.riskLevel})
                </option>
              ))}
            </select>
            <textarea
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={4}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <input
              value={requestedTools}
              onChange={(event) => setRequestedTools(event.target.value)}
              placeholder="Requested tools, comma separated"
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <select
              value={cadence}
              onChange={(event) => setCadence(event.target.value as typeof cadence)}
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            >
              <option value="none">Run now</option>
              <option value="daily">Schedule daily</option>
              <option value="weekly">Schedule weekly</option>
            </select>
            <input
              value={approvalAiRunId}
              onChange={(event) => setApprovalAiRunId(event.target.value)}
              placeholder="Approved AIRun id for execution agents"
              className="w-full rounded-md border px-3 py-2 text-sm dark:border-navy-700 dark:bg-navy-950"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={approvalBudget}
                onChange={(event) => setApprovalBudget(event.target.checked)}
              />
              Budget gate approved
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={swarmEnabled}
                onChange={(event) => setSwarmEnabled(event.target.checked)}
              />
              Swarm mode
            </label>
            {swarmEnabled && (
              <div className="rounded-md border p-3 text-sm dark:border-navy-700">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={swarmApproved}
                    onChange={(event) => setSwarmApproved(event.target.checked)}
                  />
                  Approval granted
                </label>
                <label className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={budgetApproved}
                    onChange={(event) => setBudgetApproved(event.target.checked)}
                  />
                  Budget gate approved
                </label>
              </div>
            )}
            <button
              type="button"
              onClick={launch}
              disabled={loading || !selectedAgent}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-sky-600"
            >
              <Play size={16} /> Launch governed agent
            </button>
          </div>

          {selectedAgent && (
            <div className="mt-6 rounded-lg border p-3 text-sm dark:border-navy-700">
              <div className="font-medium">{selectedAgent.name}</div>
              <p className="mt-1 text-slate-500">{selectedAgent.purpose}</p>
              <div className="mt-3 text-xs text-slate-500">Persona: {selectedAgent.persona}</div>
              <div className="mt-2 text-xs text-slate-500">
                Allowed tools: {selectedAgent.allowedTools.join(', ')}
              </div>
              <div className="mt-2 text-xs text-slate-500">
                Output schema: {selectedAgent.outputSchema?.type} /{' '}
                {(selectedAgent.outputSchema?.required || []).join(', ')}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">Catalog</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {agents.map((agent) => (
                <div
                  key={agent.agentId}
                  className="rounded-lg border p-3 text-sm dark:border-navy-700"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium">{agent.name}</div>
                    {agent.riskLevel === 'high' ? (
                      <AlertTriangle size={16} className="text-amber-500" />
                    ) : (
                      <ShieldCheck size={16} className="text-emerald-500" />
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">{agent.purpose}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    Policy: {agent.approvalPolicy}; cost: {agent.costClass}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="flex items-center gap-2 font-semibold">
              <CalendarClock size={18} /> Scheduled Agents
            </h2>
            <button
              type="button"
              onClick={processDue}
              disabled={loading}
              className="mt-3 rounded-md border px-3 py-2 text-xs font-medium disabled:opacity-50 dark:border-navy-700"
            >
              Process due schedules
            </button>
            <div className="mt-3 space-y-2">
              {schedules.map((schedule) => (
                <div
                  key={schedule.scheduleId}
                  className="rounded-lg border p-3 text-xs dark:border-navy-700"
                >
                  {schedule.agentId} / {schedule.cadence} / owner {schedule.ownerUserId}
                </div>
              ))}
              {schedules.length === 0 && (
                <div className="text-sm text-slate-500">No schedules yet.</div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">AgentRun Audit</h2>
            <div className="mt-3 space-y-2">
              {runs.map((run) => (
                <div key={run.runId} className="rounded-lg border p-3 text-xs dark:border-navy-700">
                  <div className="flex items-center gap-2 font-medium">
                    {run.schemaValid ? (
                      <CheckCircle2 size={14} className="text-emerald-500" />
                    ) : (
                      <AlertTriangle size={14} className="text-amber-500" />
                    )}
                    {run.agentId} / {run.status}
                  </div>
                  <div className="mt-1 text-slate-500">
                    Tool: {run.audit?.toolDecision?.reason || 'unknown'}; swarm:{' '}
                    {run.audit?.swarmDecision?.reason || 'unknown'}; approval:{' '}
                    {run.audit?.approvalDecision?.reason || 'unknown'}
                  </div>
                </div>
              ))}
              {runs.length === 0 && <div className="text-sm text-slate-500">No runs yet.</div>}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-navy-700 dark:bg-navy-900">
            <h2 className="font-semibold">Notifications</h2>
            <div className="mt-3 space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.notificationId}
                  className="rounded-lg border p-3 text-xs dark:border-navy-700"
                >
                  {notification.notificationType} / run {notification.runId} / owner{' '}
                  {notification.ownerUserId}
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-sm text-slate-500">No notifications yet.</div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Wave8AgentCatalogPanel;
