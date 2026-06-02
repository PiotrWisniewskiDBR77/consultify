import { describe, expect, it } from 'vitest';

import { syncWorkflowPolicyErrorMessage } from '@/utils/sync/syncWorkflowPolicyErrorMessage';

const codedError = (code: string, message = 'server message') =>
  ({
    data: { code },
    message,
  }) as Error & { data: { code: string } };

describe('syncWorkflowPolicyErrorMessage', () => {
  it('maps known sync workflow-policy machine codes to deterministic messages', () => {
    expect(
      syncWorkflowPolicyErrorMessage(
        codedError('SYNC_WORKFLOW_POLICY_INTEGRATION_NOT_FOUND'),
        'fallback'
      )
    ).toBe('Integration no longer exists in the governed sync lane. Refresh integrations and retry.');
    expect(syncWorkflowPolicyErrorMessage(codedError('SYNC_WORKFLOW_POLICY_INVALID'), 'fallback')).toBe(
      'Workflow policy is invalid. Choose one of: active, paused, blocked, safety_gate.'
    );
    expect(
      syncWorkflowPolicyErrorMessage(codedError('SYNC_WORKFLOW_POLICY_READ_FAILED'), 'fallback')
    ).toBe('Workflow policy could not be read from the sync substrate. Retry in a moment.');
    expect(
      syncWorkflowPolicyErrorMessage(codedError('SYNC_WORKFLOW_POLICY_UPDATE_FAILED'), 'fallback')
    ).toBe('Workflow policy update failed on the governed substrate. Retry in a moment.');
  });

  it('falls back to error message and then fallback text', () => {
    expect(syncWorkflowPolicyErrorMessage(new Error('server says no'), 'FB')).toBe('server says no');
    expect(syncWorkflowPolicyErrorMessage({ data: {} }, 'FB')).toBe('FB');
  });
});
