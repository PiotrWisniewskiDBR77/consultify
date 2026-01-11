/**
 * Onboarding Service Unit Tests
 *
 * Tests for user onboarding flow management.
 *
 * @module tests/unit/backend/onboardingService.test.js
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Create onboarding service implementation
const createOnboardingService = () => {
  const onboardingSteps = [
    { id: 'welcome', name: 'Welcome', order: 1 },
    { id: 'profile', name: 'Complete Profile', order: 2 },
    { id: 'organization', name: 'Setup Organization', order: 3 },
    { id: 'invite', name: 'Invite Team', order: 4 },
    { id: 'project', name: 'Create First Project', order: 5 },
    { id: 'tour', name: 'Platform Tour', order: 6 },
  ];

  const userProgress = new Map();

  // Internal helper: get progress
  const getProgressInternal = (userId) => {
    const progress = userProgress.get(userId) || {
      userId,
      currentStep: 1,
      completedSteps: [],
      skippedSteps: [],
      startedAt: null,
      completedAt: null,
    };

    const totalSteps = onboardingSteps.length;
    const completedCount = progress.completedSteps.length;

    return {
      ...progress,
      totalSteps,
      completedCount,
      percentComplete: Math.round((completedCount / totalSteps) * 100),
      isComplete: completedCount === totalSteps,
      nextStep: onboardingSteps.find(
        (s) => !progress.completedSteps.includes(s.id) && !progress.skippedSteps.includes(s.id)
      ),
    };
  };

  return {
    // Get onboarding status for user
    getProgress: async (userId) => {
      return getProgressInternal(userId);
    },

    // Start onboarding for user
    start: async (userId) => {
      const existing = userProgress.get(userId);
      if (existing && existing.startedAt) {
        throw new Error('Onboarding already started');
      }

      const progress = {
        userId,
        currentStep: 1,
        completedSteps: [],
        skippedSteps: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
      };
      userProgress.set(userId, progress);
      return progress;
    },

    // Complete a step
    completeStep: async (userId, stepId) => {
      const progress = userProgress.get(userId);
      if (!progress) throw new Error('Onboarding not started');

      const step = onboardingSteps.find((s) => s.id === stepId);
      if (!step) throw new Error('Invalid step');

      if (progress.completedSteps.includes(stepId)) {
        throw new Error('Step already completed');
      }

      progress.completedSteps.push(stepId);
      progress.currentStep = Math.max(progress.currentStep, step.order + 1);

      // Check if all steps complete
      if (
        progress.completedSteps.length + progress.skippedSteps.length ===
        onboardingSteps.length
      ) {
        progress.completedAt = new Date().toISOString();
      }

      userProgress.set(userId, progress);
      return getProgressInternal(userId);
    },

    // Skip a step
    skipStep: async (userId, stepId) => {
      const progress = userProgress.get(userId);
      if (!progress) throw new Error('Onboarding not started');

      const step = onboardingSteps.find((s) => s.id === stepId);
      if (!step) throw new Error('Invalid step');

      if (progress.skippedSteps.includes(stepId)) {
        throw new Error('Step already skipped');
      }

      progress.skippedSteps.push(stepId);
      progress.currentStep = Math.max(progress.currentStep, step.order + 1);

      userProgress.set(userId, progress);
      return getProgressInternal(userId);
    },

    // Reset onboarding
    reset: async (userId) => {
      userProgress.delete(userId);
      return true;
    },

    // Get all steps
    getSteps: async () => {
      return [...onboardingSteps];
    },

    // Check if specific step is complete
    isStepComplete: async (userId, stepId) => {
      const progress = userProgress.get(userId);
      if (!progress) return false;
      return progress.completedSteps.includes(stepId);
    },

    // Get onboarding metrics (for admin)
    getMetrics: async () => {
      let totalUsers = 0;
      let completedUsers = 0;
      let averageCompletion = 0;
      let stepCompletions = new Map(onboardingSteps.map((s) => [s.id, 0]));

      for (const progress of userProgress.values()) {
        totalUsers++;
        if (progress.completedAt) completedUsers++;
        averageCompletion += progress.completedSteps.length;

        for (const stepId of progress.completedSteps) {
          stepCompletions.set(stepId, (stepCompletions.get(stepId) || 0) + 1);
        }
      }

      return {
        totalUsers,
        completedUsers,
        completionRate: totalUsers > 0 ? (completedUsers / totalUsers) * 100 : 0,
        averageStepsCompleted: totalUsers > 0 ? averageCompletion / totalUsers : 0,
        stepBreakdown: Array.from(stepCompletions.entries()).map(([id, count]) => ({
          stepId: id,
          completions: count,
          rate: totalUsers > 0 ? (count / totalUsers) * 100 : 0,
        })),
      };
    },

    // Clear for testing
    clear: () => userProgress.clear(),
  };
};

describe('OnboardingService', () => {
  let onboardingService;

  beforeEach(() => {
    onboardingService = createOnboardingService();
  });

  describe('Starting Onboarding', () => {
    it('should start onboarding for new user', async () => {
      const progress = await onboardingService.start('user-1');

      expect(progress.userId).toBe('user-1');
      expect(progress.currentStep).toBe(1);
      expect(progress.startedAt).toBeDefined();
      expect(progress.completedSteps).toHaveLength(0);
    });

    it('should prevent starting twice', async () => {
      await onboardingService.start('user-1');

      await expect(onboardingService.start('user-1')).rejects.toThrow('Onboarding already started');
    });
  });

  describe('Progress Tracking', () => {
    it('should track completion progress', async () => {
      await onboardingService.start('user-1');

      await onboardingService.completeStep('user-1', 'welcome');
      await onboardingService.completeStep('user-1', 'profile');

      const progress = await onboardingService.getProgress('user-1');

      expect(progress.completedCount).toBe(2);
      expect(progress.percentComplete).toBe(33); // 2/6 ≈ 33%
      expect(progress.isComplete).toBe(false);
    });

    it('should calculate next step', async () => {
      await onboardingService.start('user-1');
      await onboardingService.completeStep('user-1', 'welcome');

      const progress = await onboardingService.getProgress('user-1');

      expect(progress.nextStep.id).toBe('profile');
    });

    it('should not allow completing same step twice', async () => {
      await onboardingService.start('user-1');
      await onboardingService.completeStep('user-1', 'welcome');

      await expect(onboardingService.completeStep('user-1', 'welcome')).rejects.toThrow(
        'Step already completed'
      );
    });
  });

  describe('Skipping Steps', () => {
    it('should allow skipping optional steps', async () => {
      await onboardingService.start('user-1');

      await onboardingService.skipStep('user-1', 'invite');

      const progress = await onboardingService.getProgress('user-1');
      expect(progress.skippedSteps).toContain('invite');
    });
  });

  describe('Completion', () => {
    it('should mark onboarding complete when all steps done', async () => {
      await onboardingService.start('user-1');

      const steps = await onboardingService.getSteps();
      for (const step of steps) {
        await onboardingService.completeStep('user-1', step.id);
      }

      const progress = await onboardingService.getProgress('user-1');

      expect(progress.isComplete).toBe(true);
      expect(progress.completedAt).toBeDefined();
      expect(progress.percentComplete).toBe(100);
    });
  });

  describe('Reset', () => {
    it('should reset onboarding progress', async () => {
      await onboardingService.start('user-1');
      await onboardingService.completeStep('user-1', 'welcome');

      await onboardingService.reset('user-1');

      const progress = await onboardingService.getProgress('user-1');
      expect(progress.startedAt).toBeNull();
      expect(progress.completedSteps).toHaveLength(0);
    });
  });

  describe('Step Verification', () => {
    it('should check if specific step is complete', async () => {
      await onboardingService.start('user-1');
      await onboardingService.completeStep('user-1', 'welcome');

      const isComplete = await onboardingService.isStepComplete('user-1', 'welcome');
      const isNotComplete = await onboardingService.isStepComplete('user-1', 'profile');

      expect(isComplete).toBe(true);
      expect(isNotComplete).toBe(false);
    });
  });

  describe('Metrics', () => {
    it('should calculate onboarding metrics', async () => {
      await onboardingService.start('user-1');
      await onboardingService.completeStep('user-1', 'welcome');
      await onboardingService.completeStep('user-1', 'profile');

      await onboardingService.start('user-2');
      await onboardingService.completeStep('user-2', 'welcome');

      const metrics = await onboardingService.getMetrics();

      expect(metrics.totalUsers).toBe(2);
      expect(metrics.stepBreakdown.find((s) => s.stepId === 'welcome').completions).toBe(2);
      expect(metrics.stepBreakdown.find((s) => s.stepId === 'profile').completions).toBe(1);
    });
  });
});
