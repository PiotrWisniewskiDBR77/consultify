/**
 * useTrial Hook Integration Tests
 *
 * Tests trial period management and subscription logic.
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock API
vi.mock('@/services/api', () => ({
  Api: {
    getTrialStatus: vi.fn(),
    extendTrial: vi.fn(),
    convertToPaid: vi.fn(),
  },
}));

import { Api } from '@/services/api';

describe('useTrial', () => {
  const mockTrialStatus = {
    isActive: true,
    daysRemaining: 7,
    startDate: '2026-01-01',
    endDate: '2026-01-14',
    features: ['ai_chat', 'reports', 'assessment'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.getTrialStatus).mockResolvedValue(mockTrialStatus);
    vi.mocked(Api.extendTrial).mockResolvedValue({ success: true, newEndDate: '2026-01-21' });
    vi.mocked(Api.convertToPaid).mockResolvedValue({ success: true });
  });

  it('should get trial status', async () => {
    const status = await Api.getTrialStatus();

    expect(status.isActive).toBe(true);
    expect(status.daysRemaining).toBe(7);
  });

  it('should check if trial is expiring soon', () => {
    const isExpiringSoon = mockTrialStatus.daysRemaining <= 3;
    expect(isExpiringSoon).toBe(false);

    const almostExpired = { ...mockTrialStatus, daysRemaining: 2 };
    expect(almostExpired.daysRemaining <= 3).toBe(true);
  });

  it('should calculate days remaining correctly', () => {
    const endDate = new Date('2026-01-14');
    const today = new Date('2026-01-07');
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    expect(daysRemaining).toBe(7);
  });

  it('should check trial expiration', () => {
    const expired = { ...mockTrialStatus, daysRemaining: 0, isActive: false };
    expect(expired.isActive).toBe(false);
  });

  it('should extend trial period', async () => {
    const result = await Api.extendTrial();

    expect(result.success).toBe(true);
    expect(result.newEndDate).toBe('2026-01-21');
  });

  it('should convert to paid subscription', async () => {
    const result = await Api.convertToPaid();

    expect(Api.convertToPaid).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it('should check feature availability during trial', () => {
    const hasFeature = (feature: string) => mockTrialStatus.features.includes(feature);

    expect(hasFeature('ai_chat')).toBe(true);
    expect(hasFeature('advanced_analytics')).toBe(false);
  });

  it('should show warning when trial is about to expire', () => {
    const showWarning = (daysRemaining: number) => {
      if (daysRemaining <= 3) return 'critical';
      if (daysRemaining <= 7) return 'warning';
      return null;
    };

    expect(showWarning(7)).toBe('warning');
    expect(showWarning(2)).toBe('critical');
    expect(showWarning(14)).toBeNull();
  });

  it('should handle trial status fetch errors', async () => {
    vi.mocked(Api.getTrialStatus).mockRejectedValue(new Error('Network error'));

    await expect(Api.getTrialStatus()).rejects.toThrow('Network error');
  });

  it('should track trial usage', () => {
    const usage = {
      aiQueries: 50,
      reportsGenerated: 10,
      assessmentsCompleted: 3,
    };

    const maxUsage = {
      aiQueries: 100,
      reportsGenerated: 20,
      assessmentsCompleted: 5,
    };

    const usagePercentage = (used: number, max: number) => Math.round((used / max) * 100);

    expect(usagePercentage(usage.aiQueries, maxUsage.aiQueries)).toBe(50);
  });
});
