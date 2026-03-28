import { z } from 'zod';

export const RequiredFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'select', 'date', 'user', 'boolean']),
  required: z.boolean().default(true),
  stage: z.string().optional(),
});

export const WorkflowStageSchema = z.object({
  id: z.string(),
  label: z.string(),
  reviewerRole: z.string().optional(),
  slaHours: z.number().optional(),
  requiredFields: z.array(z.string()).default([]),
  autoEscalate: z.boolean().default(false),
});

export const ApprovalConfigSchema = z.object({
  requireUnanimous: z.boolean().default(false),
  minApprovers: z.number().default(1),
  escalationAfterHours: z.number().optional(),
});

export const PlaybookSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  decisionType: z.string(),
  requiredFields: z.array(RequiredFieldSchema).default([]),
  workflowStages: z.array(WorkflowStageSchema).default([]),
  approvalConfig: ApprovalConfigSchema.optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type DecisionPlaybook = z.infer<typeof PlaybookSchema> & {
  id: string;
  organizationId: string;
};

export type RequiredField = z.infer<typeof RequiredFieldSchema>;

export function validateRequiredFields(
  playbook: DecisionPlaybook,
  decision: Record<string, unknown>,
  currentStage?: string
): { complete: boolean; missing: Array<{ key: string; label: string }> } {
  const fieldsForStage = currentStage
    ? playbook.requiredFields.filter((f) => !f.stage || f.stage === currentStage)
    : playbook.requiredFields.filter((f) => f.required);

  const missing = fieldsForStage.filter((field) => {
    const value = decision[field.key];
    return value === undefined || value === null || value === '';
  });

  return {
    complete: missing.length === 0,
    missing: missing.map((f) => ({ key: f.key, label: f.label })),
  };
}
