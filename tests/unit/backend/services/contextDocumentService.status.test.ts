import { describe, expect, it } from 'vitest';

import { canonicalizeContextDocumentStatus } from '../../../../server/src/services/organizationContext/ContextDocumentService.js';

describe('ContextDocumentService status projection', () => {
  it('maps legacy knowledge document statuses to canonical context statuses', () => {
    expect(canonicalizeContextDocumentStatus('indexed')).toBe('ready');
    expect(canonicalizeContextDocumentStatus('pending')).toBe('uploaded');
    expect(canonicalizeContextDocumentStatus('queued')).toBe('uploaded');
    expect(canonicalizeContextDocumentStatus('error')).toBe('failed');
    expect(canonicalizeContextDocumentStatus('archived')).toBe('deleted');
  });

  it('keeps canonical statuses unchanged and fails unknown values closed', () => {
    expect(canonicalizeContextDocumentStatus('processing')).toBe('processing');
    expect(canonicalizeContextDocumentStatus('partial_ready')).toBe('partial_ready');
    expect(canonicalizeContextDocumentStatus('policy_blocked')).toBe('policy_blocked');
    expect(canonicalizeContextDocumentStatus('unexpected_status')).toBe('failed');
  });
});
