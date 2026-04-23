export const APPROVAL_MODES = [
  'implicit',
  'inline',
  'explicit_form',
  'multi_reviewer',
  'admin_only',
] as const;

export type ApprovalMode = (typeof APPROVAL_MODES)[number];

export function assertApprovalMode(value: unknown): asserts value is ApprovalMode {
  if (
    value !== 'implicit' &&
    value !== 'inline' &&
    value !== 'explicit_form' &&
    value !== 'multi_reviewer' &&
    value !== 'admin_only'
  ) {
    throw new Error(`Invalid approval mode: ${String(value)}`);
  }
}

