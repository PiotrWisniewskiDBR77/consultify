import { validateControlKpiPolicyParameters } from '../../services/executionControl/controlKpiPolicySchema.js';
import {
  executeMaterialCommand,
  MaterialCommandConflictError,
  type MaterialCommandEnvelope,
  type MaterialCommandResult,
  type MaterialCommandTransaction,
  type MaterialCommandUnitOfWork,
  MaterialCommandValidationError,
} from './materialCommand.js';

export interface KpiPolicyCapableTransaction extends MaterialCommandTransaction {
  upsertExecutionControlKpiPolicy(input: {
    organizationId: string;
    policyId: string;
    name: string;
    parameters: Record<string, unknown>;
    expectedRowVersion: number;
    nextRowVersion: number;
  }): Promise<'INSERTED' | 'UPDATED' | 'CONFLICT'>;
}

export interface ExecutionControlKpiPolicyAuthoringPayload {
  name: string;
  parameters: Record<string, unknown>;
}

export interface AuthoredExecutionControlKpiPolicy {
  policyId: string;
  name: string;
  parameters: Record<string, unknown>;
  rowVersion: number;
}

export async function authorExecutionControlKpiPolicy(
  unitOfWork: MaterialCommandUnitOfWork,
  envelope: MaterialCommandEnvelope<ExecutionControlKpiPolicyAuthoringPayload>
): Promise<MaterialCommandResult<AuthoredExecutionControlKpiPolicy>> {
  if (
    envelope.commandType !== 'execution-control-kpi-policy.author' ||
    envelope.aggregateType !== 'execution_control_kpi_policy'
  ) {
    throw new MaterialCommandValidationError('Invalid KPI policy command target');
  }

  const name = envelope.payload.name.trim();
  const parameters = envelope.payload.parameters;
  if (!name) throw new MaterialCommandValidationError('name is required');
  if (parameters === null || Array.isArray(parameters) || typeof parameters !== 'object') {
    throw new MaterialCommandValidationError('parameters must be an object');
  }
  const validation = validateControlKpiPolicyParameters(parameters);
  if (validation.invalidParameters.length > 0) {
    const invalid = validation.invalidParameters[0];
    throw new MaterialCommandValidationError(
      `INVALID_PARAMETERS:${invalid.parameter}:${invalid.rule}`
    );
  }

  return executeMaterialCommand(
    unitOfWork,
    { ...envelope, payload: { name, parameters } },
    async (transaction) => {
      const capable = transaction as Partial<KpiPolicyCapableTransaction>;
      if (typeof capable.upsertExecutionControlKpiPolicy !== 'function') {
        throw new MaterialCommandValidationError(
          'This transaction cannot author execution control KPI policies'
        );
      }

      const nextRowVersion = envelope.expectedVersion + 1;
      const outcome = await capable.upsertExecutionControlKpiPolicy({
        organizationId: envelope.organizationId,
        policyId: envelope.aggregateId,
        name,
        parameters,
        expectedRowVersion: envelope.expectedVersion,
        nextRowVersion,
      });
      if (outcome === 'CONFLICT') {
        const currentVersion = await transaction.getAggregateVersion(
          envelope.organizationId,
          envelope.aggregateType,
          envelope.aggregateId
        );
        throw new MaterialCommandConflictError(
          'execution control KPI policy row version conflict',
          envelope.expectedVersion,
          currentVersion
        );
      }

      const policy: AuthoredExecutionControlKpiPolicy = {
        policyId: envelope.aggregateId,
        name,
        parameters,
        rowVersion: nextRowVersion,
      };
      return {
        mutation: policy,
        response: policy,
        eventType: 'execution-control-kpi-policy.authored',
        eventPayload: policy,
        auditPayload: policy,
      };
    }
  );
}
