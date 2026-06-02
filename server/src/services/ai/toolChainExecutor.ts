/**
 * Tool Chain Executor
 *
 * Executes chains of tools where the output of one tool
 * can feed into the input of the next. Supports parallel
 * execution of independent steps, variable interpolation,
 * and approval governance for side-effect tools.
 */
import logger from '../../utils/Logger.js';

export interface ChainStep {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  dependsOn?: string[];
  requiresApproval?: boolean;
}

export interface ChainResult {
  stepId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

export interface ChainExecutionResult {
  success: boolean;
  results: ChainResult[];
  totalDurationMs: number;
  failedStep?: string;
}

type ToolExecutorFn = (toolName: string, input: Record<string, unknown>) => Promise<unknown>;

type ApprovalFn = (step: ChainStep) => Promise<boolean>;

class ToolChainExecutor {
  async executeChain(
    steps: ChainStep[],
    executor: ToolExecutorFn,
    options?: {
      approvalCallback?: ApprovalFn;
      onStepComplete?: (result: ChainResult) => void;
      maxParallel?: number;
    }
  ): Promise<ChainExecutionResult> {
    const startTime = Date.now();
    const results: Map<string, ChainResult> = new Map();
    const completed = new Set<string>();
    const allSteps = new Map(steps.map((s) => [s.id, s]));

    const getReady = (): ChainStep[] => {
      return steps.filter((s) => {
        if (completed.has(s.id)) return false;
        if (!s.dependsOn?.length) return true;
        return s.dependsOn.every((dep) => completed.has(dep));
      });
    };

    while (completed.size < steps.length) {
      const ready = getReady();
      if (ready.length === 0 && completed.size < steps.length) {
        return {
          success: false,
          results: Array.from(results.values()),
          totalDurationMs: Date.now() - startTime,
          failedStep: 'deadlock_detected',
        };
      }

      const maxP = options?.maxParallel || 3;
      const batch = ready.slice(0, maxP);

      const batchResults = await Promise.allSettled(
        batch.map(async (step) => {
          if (step.requiresApproval && options?.approvalCallback) {
            const approved = await options.approvalCallback(step);
            if (!approved) {
              return {
                stepId: step.id,
                toolName: step.toolName,
                success: false,
                error: 'User rejected step',
                durationMs: 0,
              } as ChainResult;
            }
          }

          const resolvedInput = this.resolveInputVariables(step.toolInput, results);
          const stepStart = Date.now();

          try {
            const result = await executor(step.toolName, resolvedInput);
            return {
              stepId: step.id,
              toolName: step.toolName,
              success: true,
              result,
              durationMs: Date.now() - stepStart,
            } as ChainResult;
          } catch (err: any) {
            return {
              stepId: step.id,
              toolName: step.toolName,
              success: false,
              error: err?.message || 'Unknown error',
              durationMs: Date.now() - stepStart,
            } as ChainResult;
          }
        })
      );

      for (const settled of batchResults) {
        const result =
          settled.status === 'fulfilled'
            ? settled.value
            : {
                stepId: 'unknown',
                toolName: 'unknown',
                success: false,
                error: (settled as any).reason?.message || 'Promise rejected',
                durationMs: 0,
              };

        results.set(result.stepId, result);
        completed.add(result.stepId);
        options?.onStepComplete?.(result);

        if (!result.success) {
          logger.warn(
            `[ToolChain] Step ${result.stepId} (${result.toolName}) failed: ${result.error}`
          );
          return {
            success: false,
            results: Array.from(results.values()),
            totalDurationMs: Date.now() - startTime,
            failedStep: result.stepId,
          };
        }
      }
    }

    return {
      success: true,
      results: Array.from(results.values()),
      totalDurationMs: Date.now() - startTime,
    };
  }

  private resolveInputVariables(
    input: Record<string, unknown>,
    previousResults: Map<string, ChainResult>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (typeof value === 'string' && value.startsWith('$step.')) {
        const match = value.match(/^\$step\.(\w+)(?:\.(.+))?$/);
        if (match) {
          const [, stepId, path] = match;
          const stepResult = previousResults.get(stepId);
          if (stepResult?.result) {
            resolved[key] = path ? this.getNestedValue(stepResult.result, path) : stepResult.result;
          } else {
            resolved[key] = value;
          }
        } else {
          resolved[key] = value;
        }
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        resolved[key] = this.resolveInputVariables(
          value as Record<string, unknown>,
          previousResults
        );
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  private getNestedValue(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: any = obj;
    for (const part of parts) {
      if (current == null) return undefined;
      current = current[part];
    }
    return current;
  }
}

export const toolChainExecutor = new ToolChainExecutor();
export default toolChainExecutor;
