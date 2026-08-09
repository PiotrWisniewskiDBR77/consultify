import React, { useEffect, useState } from 'react';
import {
  TransformationCasesApi,
  type ProjectTeamBlueprintDto,
} from '@/services/api/v8/transformation-cases';

export const ProjectTeamCard: React.FC<{
  caseId: string;
  caseVersion: number;
  projectId: string | null;
  currentUserId: string | null;
  isPolish: boolean;
  onProjectBound?: () => Promise<void> | void;
}> = ({ caseId, caseVersion, projectId, currentUserId, isPolish, onProjectBound }) => {
  const [team, setTeam] = useState<ProjectTeamBlueprintDto | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [sponsor, setSponsor] = useState(currentUserId ?? ''),
    [projectInput, setProjectInput] = useState(projectId ?? ''),
    [humanId, setHumanId] = useState(''),
    [humanName, setHumanName] = useState(''),
    [agentBudget, setAgentBudget] = useState('0');
  useEffect(() => setProjectInput(projectId ?? ''), [projectId]);
  const bindProject = async () => {
    setBusy(true);
    setError(null);
    try {
      await TransformationCasesApi.bindProject(caseId, projectInput);
      await onProjectBound?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Project binding failed');
    } finally {
      setBusy(false);
    }
  };
  const load = async () => {
    try {
      setTeam(await TransformationCasesApi.getProjectTeam(caseId));
    } catch {
      setTeam(null);
    }
  };
  useEffect(() => {
    void load();
  }, [caseId]);
  const propose = async () => {
    setBusy(true);
    setError(null);
    try {
      await TransformationCasesApi.proposeProjectTeam(
        caseId,
        {
          expectedCaseVersion: caseVersion,
          sponsorUserId: sponsor || null,
          members: [
            {
              kind: 'human',
              identityId: humanId || null,
              displayName: humanName || 'UNKNOWN',
              role: 'Project owner',
              authority: humanId ? ['coordinate'] : [],
              sourceRefs: [],
            },
            {
              kind: 'agent',
              identityId: 'consultify:teresa:transformation-agent',
              displayName: 'Teresa Project Agent',
              role: 'Transformation orchestration',
              authority: ['prepare', 'coordinate'],
              autonomy: 'execute_with_approval',
              budgetLimit: agentBudget ? Number(agentBudget) : null,
              sourceRefs: ['canonical-plan'],
            },
          ],
          raci: [
            {
              workItem: 'Transformation delivery',
              responsible: humanId ? [humanId] : [],
              accountable: sponsor || null,
              consulted: [],
              informed: [],
            },
          ],
          agentLimits: {
            'consultify:teresa:transformation-agent': {
              autonomy: 'execute_with_approval',
              budgetLimit: agentBudget ? Number(agentBudget) : null,
            },
          },
          work: [
            {
              workItem: 'Transformation delivery',
              ownerIdentityId: humanId || null,
              branchStatus: 'planned',
              estimatedCost: null,
              conflicts: [],
              pendingDecisions: humanId ? [] : ['Confirm project owner'],
            },
          ],
        },
        crypto.randomUUID()
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Team proposal failed');
    } finally {
      setBusy(false);
    }
  };
  const act = async (action: 'approve' | 'activate') => {
    if (!team) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'approve')
        await TransformationCasesApi.approveProjectTeam(
          caseId,
          team.blueprint_version_id,
          {
            expectedVersion: team.blueprint_version,
            reason: 'User approved exact team, RACI, autonomy and budget limits',
          },
          crypto.randomUUID()
        );
      else
        await TransformationCasesApi.activateProjectTeam(
          caseId,
          team.blueprint_version_id,
          crypto.randomUUID()
        );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Team action failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section
      className="rounded-lg border border-c-border bg-c-surface p-3"
      data-testid="project-team-card"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-c-text">
          {isPolish ? 'Zespół projektu' : 'Project Team'}
        </h3>
        <span className="text-xs text-c-text-muted">
          {team ? `${team.status} · v${team.blueprint_version}` : 'draft'}
        </span>
      </div>
      <p className="mt-1 text-xs text-c-text-muted">
        {isPolish
          ? 'Teresa proponuje ludzi i agentów; UNKNOWN wymaga odpowiedzi przed zatwierdzeniem.'
          : 'Teresa proposes humans and agents; UNKNOWN requires an answer before approval.'}
      </p>
      {!projectId && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label={isPolish ? 'ID projektu dla Case' : 'Project ID for Case'}
            value={projectInput}
            onChange={(e) => setProjectInput(e.target.value)}
            placeholder={isPolish ? 'ID istniejącego projektu' : 'Existing project ID'}
            className="min-w-0 flex-1 rounded border border-c-border bg-c-bg p-2 text-xs"
          />
          <button
            type="button"
            disabled={busy || !projectInput.trim()}
            onClick={() => void bindProject()}
            className="rounded border border-c-border px-3 py-2 text-xs text-c-text"
          >
            {isPolish ? 'Przypnij projekt' : 'Bind project'}
          </button>
        </div>
      )}
      {!team && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            aria-label="Sponsor user ID"
            value={sponsor}
            onChange={(e) => setSponsor(e.target.value)}
            placeholder="Sponsor user ID"
            className="rounded border border-c-border bg-c-bg p-2 text-xs"
          />
          <input
            aria-label="Project owner user ID"
            value={humanId}
            onChange={(e) => setHumanId(e.target.value)}
            placeholder="Project owner user ID"
            className="rounded border border-c-border bg-c-bg p-2 text-xs"
          />
          <input
            aria-label="Project owner name"
            value={humanName}
            onChange={(e) => setHumanName(e.target.value)}
            placeholder="Project owner name"
            className="rounded border border-c-border bg-c-bg p-2 text-xs"
          />
          <input
            aria-label="Agent budget limit"
            type="number"
            min="0"
            value={agentBudget}
            onChange={(e) => setAgentBudget(e.target.value)}
            className="rounded border border-c-border bg-c-bg p-2 text-xs"
          />
          <button
            disabled={busy || !projectId}
            onClick={() => void propose()}
            className="rounded bg-c-text px-3 py-2 text-xs text-c-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
          >
            {isPolish ? 'Poproś Teresę o propozycję' : 'Ask Teresa to propose'}
          </button>
        </div>
      )}
      {team && (
        <div className="mt-3 space-y-2">
          {team.clarification_questions_json?.map((q) => (
            <p key={q} role="alert" className="text-xs text-amber-600">
              {q}
            </p>
          ))}
          {team.members_json.map((m) => (
            <div
              key={`${m.kind}-${m.identityId}`}
              className="rounded border border-c-border p-2 text-xs"
            >
              <b>{m.displayName}</b> · {m.kind} · {m.role}
              <div>
                Authority: {m.authority.join(', ') || 'UNKNOWN'} · Autonomy: {m.autonomy ?? 'n/a'} ·
                Budget: {m.budgetLimit ?? 'UNKNOWN'}
              </div>
              <div>Sources: {m.sourceRefs.join(', ') || 'UNKNOWN'}</div>
            </div>
          ))}
          {team.work_json.map((w) => (
            <div key={w.workItem} className="text-xs text-c-text-muted">
              {w.workItem} · branch {w.branchStatus} · cost {w.estimatedCost ?? 'UNKNOWN'} ·
              conflicts {w.conflicts.join(', ') || 'none'} · pending{' '}
              {w.pendingDecisions.join(', ') || 'none'}
            </div>
          ))}
          <div className="flex gap-2">
            {team.status === 'pending_approval' && (
              <button
                disabled={busy}
                onClick={() => void act('approve')}
                className="rounded border px-3 py-2 text-xs"
              >
                {isPolish ? 'Zatwierdź skład i RACI' : 'Approve team and RACI'}
              </button>
            )}
            {team.status === 'approved' && (
              <button
                disabled={busy}
                onClick={() => void act('activate')}
                className="rounded bg-c-text px-3 py-2 text-xs text-c-bg hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-c-focus"
              >
                {isPolish ? 'Aktywuj zespół i A06' : 'Activate team and A06'}
              </button>
            )}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-c-danger">
          {error}
        </p>
      )}
    </section>
  );
};
