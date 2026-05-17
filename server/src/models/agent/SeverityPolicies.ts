import type { ApprovalMode } from './ApprovalMode.js';
import type { Severity } from './ExecutionProposalV1.js';

export type SeverityPolicy = {
  readonly defaultApproval: ApprovalMode;
};

const DEFAULT_POLICIES: Record<Severity, SeverityPolicy> = {
  S0: { defaultApproval: 'implicit' },
  S1: { defaultApproval: 'inline' },
  S2: { defaultApproval: 'explicit_form' },
  S3: { defaultApproval: 'multi_reviewer' },
  S4: { defaultApproval: 'admin_only' },
};

export function getSeverityPolicy(severity: Severity): SeverityPolicy {
  return DEFAULT_POLICIES[severity];
}
