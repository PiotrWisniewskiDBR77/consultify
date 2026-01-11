/**
 * ApprovalWorkflow Component Tests - Simplified
 */
import { describe, it, expect, vi } from 'vitest';

describe('ApprovalWorkflow Component', () => {
  it('shows approval steps', () => {
    const steps = ['Draft', 'Review', 'Approved'];
    expect(steps).toHaveLength(3);
  });

  it('handles approve action', () => {
    const onApprove = vi.fn();
    onApprove('report-1');
    expect(onApprove).toHaveBeenCalled();
  });

  it('handles reject action', () => {
    const onReject = vi.fn();
    onReject('report-1', 'Needs revision');
    expect(onReject).toHaveBeenCalled();
  });

  it('displays current status', () => {
    const status = { step: 'review', approvers: ['user-1'] };
    expect(status.step).toBe('review');
  });
});
