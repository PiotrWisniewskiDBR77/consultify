import {
  executeMaterialCommand,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export const GOAL_PERSPECTIVES = [
  'financial',
  'customer',
  'process',
  'learning',
  'governance_data_quality',
] as const;

export type GoalPerspective = (typeof GOAL_PERSPECTIVES)[number];

interface GoalPerspectiveTransaction extends MaterialCommandTransaction {
  assignGoalPerspective(input: {
    organizationId: string;
    goalId: string;
    perspective: GoalPerspective | null;
  }): Promise<void>;
}

export async function assignGoalPerspective(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<{ perspective: GoalPerspective | null }>
): Promise<MaterialCommandResult<{ goalId: string; perspective: GoalPerspective | null }>> {
  if (
    envelope.commandType !== 'goal-perspective.assign' ||
    envelope.aggregateType !== 'goal_perspective'
  ) {
    throw new MaterialCommandValidationError('Invalid goal perspective command target');
  }
  const perspective = envelope.payload.perspective;
  if (perspective !== null && !GOAL_PERSPECTIVES.includes(perspective)) {
    throw new MaterialCommandValidationError('INVALID_PERSPECTIVE');
  }

  return executeMaterialCommand(unitOfWork, envelope, async (transaction) => {
    const capable = transaction as Partial<GoalPerspectiveTransaction>;
    if (typeof capable.assignGoalPerspective !== 'function') {
      throw new MaterialCommandValidationError('Goal perspective writer unavailable');
    }
    await capable.assignGoalPerspective({
      organizationId: envelope.organizationId,
      goalId: envelope.aggregateId,
      perspective,
    });
    const response = { goalId: envelope.aggregateId, perspective };
    return {
      mutation: response,
      response,
      eventType: 'goal-perspective.assigned',
      eventPayload: response,
      auditPayload: { ...response, declarationSource: 'HUMAN', actorId: envelope.actorId },
    };
  });
}
