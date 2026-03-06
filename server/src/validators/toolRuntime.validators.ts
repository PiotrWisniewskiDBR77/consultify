import { z } from 'zod';

export const ToolInputFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'number', 'select', 'multiselect', 'boolean', 'date', 'json']),
  required: z.boolean().default(false),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
  defaultValue: z.unknown().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      message: z.string().optional(),
    })
    .optional(),
});

export const ToolOutputFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'number', 'json', 'matrix', 'chart', 'table', 'markdown']),
  source: z.enum(['user_input', 'ai_generated', 'calculated', 'imported']).default('user_input'),
});

export const ToolDoDGateSchema = z.object({
  id: z.string(),
  label: z.string(),
  check: z.enum([
    'required_fields_filled',
    'min_items',
    'ai_review_completed',
    'manual_approval',
    'score_threshold',
  ]),
  config: z.record(z.unknown()).optional(),
  passed: z.boolean().default(false),
  passedAt: z.string().datetime().optional(),
  passedBy: z.string().optional(),
});

export const ToolRuntimeContractSchema = z.object({
  frameworkId: z.string(),
  version: z.string().default('1.0'),
  inputs: z.array(ToolInputFieldSchema),
  outputs: z.array(ToolOutputFieldSchema),
  dodGates: z.array(ToolDoDGateSchema).default([]),
  exportPackage: z
    .object({
      format: z.enum(['json', 'pdf', 'xlsx', 'markdown']).default('json'),
      includeMetadata: z.boolean().default(true),
      includeAuditTrail: z.boolean().default(false),
    })
    .optional(),
});

export type ToolRuntimeContract = z.infer<typeof ToolRuntimeContractSchema>;
export type ToolInputField = z.infer<typeof ToolInputFieldSchema>;
export type ToolOutputField = z.infer<typeof ToolOutputFieldSchema>;
export type ToolDoDGate = z.infer<typeof ToolDoDGateSchema>;

export const ApproveDoDGateSchema = z.object({
  comment: z.string().optional(),
});

export function evaluateDoDGates(
  contract: ToolRuntimeContract,
  sessionData: Record<string, unknown>
): {
  allPassed: boolean;
  gates: Array<ToolDoDGate & { reason?: string }>;
} {
  const evaluatedGates = contract.dodGates.map((gate) => {
    if (gate.passed) return { ...gate };

    switch (gate.check) {
      case 'required_fields_filled': {
        const requiredInputs = contract.inputs.filter((i) => i.required);
        const allFilled = requiredInputs.every((input) => {
          const value = sessionData[input.key];
          return value !== undefined && value !== null && value !== '';
        });
        return {
          ...gate,
          passed: allFilled,
          reason: allFilled ? undefined : 'Required fields not filled',
        };
      }
      case 'min_items': {
        const minCount = (gate.config?.minCount as number) ?? 1;
        const field = gate.config?.field as string;
        const items = field ? (sessionData[field] as unknown[]) : [];
        const passed = Array.isArray(items) && items.length >= minCount;
        return {
          ...gate,
          passed,
          reason: passed ? undefined : `Minimum ${minCount} items required`,
        };
      }
      case 'score_threshold': {
        const threshold = (gate.config?.threshold as number) ?? 0;
        const scoreField = (gate.config?.field as string) ?? 'overallScore';
        const score = sessionData[scoreField] as number;
        const passed = typeof score === 'number' && score >= threshold;
        return {
          ...gate,
          passed,
          reason: passed ? undefined : `Score ${score ?? 'N/A'} below threshold ${threshold}`,
        };
      }
      default:
        return { ...gate, reason: 'Manual check required' };
    }
  });

  return {
    allPassed: evaluatedGates.every((g) => g.passed),
    gates: evaluatedGates,
  };
}
