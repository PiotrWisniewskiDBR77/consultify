import type { Request, Response, NextFunction, Router } from 'express';
import { gateRule } from '../../domain/initiatives-execution/organizationGovernance.js';
import type { EffectiveGovernancePolicy } from '../../domain/initiatives-execution/postgresGovernancePolicyResolver.js';
import type {
  InitiativesExecutionRuntimeDependencies,
  RuntimeActor,
} from './initiativesExecutionRuntime.routes.js';

export const definitionApprovalEnabled = () => process.env.ENABLE_INITIATIVE_APPROVAL_V2 === 'true';

export async function definitionAuthorities(
  deps: InitiativesExecutionRuntimeDependencies,
  organizationId: string,
  projectId: string,
  policy: EffectiveGovernancePolicy
) {
  const rule = gateRule(policy, 'DEFINITION');
  const bindings = (policy.config.roleBindings ?? []) as Array<{
    roleKey: string;
    principalId: string;
  }>;
  const members = await deps.reader.listDefinitionApprovalMembers(organizationId, projectId);
  const result = [];
  for (const member of members) {
    if (
      !bindings.some(
        (b) =>
          b.principalId === member.id &&
          (rule.requiredRoles.length === 0 || rule.requiredRoles.includes(b.roleKey))
      )
    )
      continue;
    if (
      await deps.authorize(
        { userId: member.id, organizationId, applicationRole: member.role, isImpersonating: false },
        projectId,
        'initiative.review'
      )
    )
      result.push({ id: member.id, name: member.name });
  }
  return result;
}

export function mountDefinitionApprovalReads(
  router: Router,
  deps: InitiativesExecutionRuntimeDependencies,
  actorFromRequest: (req: Request) => RuntimeActor | null
) {
  const wrap =
    (fn: (req: Request, res: Response) => Promise<void>) =>
    (req: Request, res: Response, next: NextFunction) =>
      void fn(req, res).catch(next);
  router.get(
    '/initiatives/:initiativeId/definition-approval',
    wrap(async (req, res) => {
      if (!definitionApprovalEnabled()) {
        res.json({ enabled: false });
        return;
      }
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const id = String(req.params.initiativeId);
      const found = await deps.reader.findById(actor.organizationId, id);
      if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view'))) {
        res.status(404).json({ error: { code: 'NOT_FOUND' } });
        return;
      }
      const policy = await deps.resolvePolicy(actor.organizationId, found.initiative.projectId, id);
      const authorities = await definitionAuthorities(
        deps,
        actor.organizationId,
        found.initiative.projectId,
        policy
      );
      const decisions = await deps.reader.listDefinitionApprovalDecisions(actor.organizationId, id);
      const decision =
        decisions.find(
          (d: any) => d.decisionId === (found.initiative as any).definitionDecisionId
        ) ?? null;
      const canUpdate = deps.authorizeInitiativeObject
        ? await deps.authorizeInitiativeObject(
            actor,
            found.initiative.projectId,
            'initiative.update',
            [found.initiative.initiativeOwnerId]
          )
        : await deps.authorize(actor, found.initiative.projectId, 'initiative.update');
      res.json({
        enabled: true,
        sourceContract: 'RUNTIME_INITIATIVE_GATE',
        initiativeOrigin: 'initiatives-runtime-v1',
        initiativeId: id,
        initiativeVersion: found.version,
        title: found.initiative.title,
        lifecycleState: found.initiative.lifecycleState,
        policy: { policyId: policy.policyId, policyVersion: policy.version },
        decision,
        authorities,
        actorId: actor.userId,
        participants: await deps.reader.listDefinitionApprovalMembers(
          actor.organizationId,
          found.initiative.projectId
        ),
        capabilities: {
          edit: canUpdate,
          review: await deps.authorize(actor, found.initiative.projectId, 'initiative.review'),
          request:
            canUpdate &&
            found.initiative.lifecycleState === 'REGISTERED_DRAFT' &&
            (!decision ||
              (decision.status === 'RETURNED' && decision.requesterId === actor.userId)),
          decide:
            decision?.status === 'PENDING' &&
            decision.authorityId === actor.userId &&
            authorities.some((a) => a.id === actor.userId),
        },
      });
    })
  );
  router.get(
    '/my-work/definition-approvals',
    wrap(async (req, res) => {
      if (!definitionApprovalEnabled()) {
        res.json({ enabled: false, items: [] });
        return;
      }
      const actor = actorFromRequest(req);
      if (!actor) {
        res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
        return;
      }
      const decisions = await deps.reader.listDefinitionApprovalDecisions(actor.organizationId);
      const items = [];
      for (const decision of decisions) {
        if (decision.authorityId !== actor.userId && decision.requesterId !== actor.userId)
          continue;
        const found = await deps.reader.findById(actor.organizationId, decision.initiativeId);
        if (!found || !(await deps.authorize(actor, found.initiative.projectId, 'initiative.view')))
          continue;
        items.push({
          ...decision,
          sourceContract: 'RUNTIME_INITIATIVE_GATE',
          initiativeOrigin: 'initiatives-runtime-v1',
          initiativeVersion: found.version,
          projectId: found.initiative.projectId,
          initiativeTitle: found.initiative.title,
        });
      }
      res.json({ enabled: true, items });
    })
  );
}
