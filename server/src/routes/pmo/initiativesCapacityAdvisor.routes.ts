import { type Request, Router } from 'express';
import { Pool, type PoolConfig } from 'pg';
import { z } from 'zod';

import databaseConfig from '../../config/DatabaseConfig.js';
import {
  capacityOptionFindings,
  createCapacityOptions,
} from '../../domain/initiatives-execution/capacityOptions.js';
import {
  NoCapacityPressureError,
  proposeCapacityOptions,
} from '../../domain/initiatives-execution/capacityOptionsAdvisor.js';
import {
  MaterialCommandConflictError,
  MaterialCommandValidationError,
} from '../../domain/initiatives-execution/materialCommand.js';
import { PostgresInitiativeReader } from '../../domain/initiatives-execution/postgresInitiativeReader.js';
import { PostgresMaterialCommandUnitOfWork } from '../../domain/initiatives-execution/postgresMaterialCommandUnitOfWork.js';

const router = Router();
const pool = new Pool(databaseConfig.postgres as PoolConfig | undefined);
const reader = new PostgresInitiativeReader(pool);
const unitOfWork = new PostgresMaterialCommandUnitOfWork(pool);
const CommandSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  clientRequestId: z.string().min(1),
  planRef: z.object({ scenarioId: z.string().min(1), version: z.number().int().positive() }),
  capacityRef: z.object({ scenarioId: z.string().min(1), version: z.number().int().positive() }),
});

function actorFromRequest(req: Request) {
  const runtimeRequest = req as Request & { user?: Record<string, unknown>; userId?: string };
  const user = runtimeRequest.user;
  const userId = String(user?.id || runtimeRequest.userId || '').trim();
  const organizationId = String(user?.organizationId || user?.organization_id || '').trim();
  return userId && organizationId ? { userId, organizationId } : null;
}

router.post('/capacity-options/:id/propose', async (req, res) => {
  const actor = actorFromRequest(req);
  if (!actor) return res.status(401).json({ error: { code: 'AUTH_REQUIRED' } });
  const parsed = CommandSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_FAILED' } });
  try {
    const plan = await reader.findPlanScenario(
      actor.organizationId,
      parsed.data.planRef.scenarioId
    );
    const capacity = await reader.findCapacityScenario(
      actor.organizationId,
      parsed.data.capacityRef.scenarioId
    );
    if (
      !plan ||
      !capacity ||
      plan.version !== parsed.data.planRef.version ||
      capacity.version !== parsed.data.capacityRef.version ||
      plan.scenario.status !== 'PUBLISHED' ||
      capacity.scenario.status !== 'PUBLISHED' ||
      capacity.scenario.planScenarioId !== plan.scenario.scenarioId ||
      capacity.scenario.planScenarioVersion !== plan.version
    ) {
      return res.status(400).json({ error: { code: 'EXACT_PUBLISHED_SCENARIOS_REQUIRED' } });
    }
    const options = proposeCapacityOptions(plan.scenario, capacity.scenario);
    if (options.flatMap(capacityOptionFindings).length) {
      return res.status(500).json({ error: { code: 'ADVISOR_OUTPUT_INVALID' } });
    }
    return res.json(
      await createCapacityOptions(unitOfWork, {
        organizationId: actor.organizationId,
        actorId: actor.userId,
        aggregateType: 'capacity_options',
        aggregateId: String(req.params.id),
        expectedVersion: parsed.data.expectedVersion,
        clientRequestId: parsed.data.clientRequestId,
        correlationId: parsed.data.clientRequestId,
        policyId: 'capacity-options',
        policyVersion: 1,
        commandType: 'capacity-options.create',
        createIfMissing: true,
        payload: { planRef: parsed.data.planRef, capacityRef: parsed.data.capacityRef, options },
      })
    );
  } catch (error) {
    if (error instanceof NoCapacityPressureError)
      return res.status(409).json({ error: { code: error.code } });
    if (error instanceof MaterialCommandConflictError)
      return res.status(409).json({ error: { code: 'VERSION_CONFLICT' } });
    if (error instanceof MaterialCommandValidationError)
      return res.status(400).json({ error: { code: 'COMMAND_VALIDATION_FAILED' } });
    return res.status(500).json({ error: { code: 'CAPACITY_ADVISOR_FAILED' } });
  }
});

export default router;
