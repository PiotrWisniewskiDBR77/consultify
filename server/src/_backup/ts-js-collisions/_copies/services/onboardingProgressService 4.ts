/**
 * Onboarding Progress Service
 * GAP-AUTH-002: Track user onboarding progress
 */

import { v4 as uuidv4 } from 'uuid';

import { getDatabase } from '../database/Database.js';
import type { IDatabase } from '../database/IDatabase.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface OnboardingProgress {
  id: string;
  userId: string;
  organizationId: string;
  profileCompleted: boolean;
  teamInvited: boolean;
  firstProjectCreated: boolean;
  firstAssessmentRun: boolean;
  aiAssistantUsed: boolean;
  settingsConfigured: boolean;
  currentStep: string;
  completedSteps: string[];
  skippedSteps: string[];
  startedAt: string;
  completedAt: string | null;
  lastActivityAt: string;
  percentComplete: number;
}

export const ONBOARDING_STEPS = [
  { id: 'profile', name: 'Complete Profile', order: 1 },
  { id: 'team', name: 'Invite Team Members', order: 2, optional: true },
  { id: 'project', name: 'Create First Project', order: 3 },
  { id: 'assessment', name: 'Run First Assessment', order: 4 },
  { id: 'ai', name: 'Use AI Assistant', order: 5 },
  { id: 'settings', name: 'Configure Settings', order: 6, optional: true },
];

// ==========================================
// CLASS IMPLEMENTATION
// ==========================================

class OnboardingProgressService {
  private db: IDatabase | null = null;

  private async getDb(): Promise<IDatabase> {
    if (!this.db) {
      this.db = await getDatabase();
    }
    return this.db;
  }

  /**
   * Initialize onboarding for new user
   */
  async initializeOnboarding(userId: string, organizationId: string): Promise<OnboardingProgress> {
    const db = await this.getDb();
    const id = `onboard-${uuidv4()}`;

    await db.run(
      `INSERT INTO user_onboarding (id, user_id, organization_id, current_step, started_at)
             VALUES (?, ?, ?, 'profile', datetime('now'))
             ON CONFLICT(user_id) DO NOTHING`,
      [id, userId, organizationId]
    );

    logger.info(`[Onboarding] Initialized for user ${userId}`);
    return this.getProgress(userId);
  }

  /**
   * Get onboarding progress for user
   */
  async getProgress(userId: string): Promise<OnboardingProgress> {
    const db = await this.getDb();

    const row = await db.get<{
      id: string;
      user_id: string;
      organization_id: string;
      profile_completed: number;
      team_invited: number;
      first_project_created: number;
      first_assessment_run: number;
      ai_assistant_used: number;
      settings_configured: number;
      current_step: string;
      completed_steps: string;
      skipped_steps: string;
      started_at: string;
      completed_at: string | null;
      last_activity_at: string;
    }>(`SELECT * FROM user_onboarding WHERE user_id = ?`, [userId]);

    if (!row) {
      // Return default progress if not found
      return {
        id: '',
        userId,
        organizationId: '',
        profileCompleted: false,
        teamInvited: false,
        firstProjectCreated: false,
        firstAssessmentRun: false,
        aiAssistantUsed: false,
        settingsConfigured: false,
        currentStep: 'profile',
        completedSteps: [],
        skippedSteps: [],
        startedAt: new Date().toISOString(),
        completedAt: null,
        lastActivityAt: new Date().toISOString(),
        percentComplete: 0,
      };
    }

    const completedSteps = JSON.parse(row.completed_steps || '[]');
    const requiredSteps = ONBOARDING_STEPS.filter((s) => !s.optional);
    const percentComplete = Math.round((completedSteps.length / requiredSteps.length) * 100);

    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      profileCompleted: row.profile_completed === 1,
      teamInvited: row.team_invited === 1,
      firstProjectCreated: row.first_project_created === 1,
      firstAssessmentRun: row.first_assessment_run === 1,
      aiAssistantUsed: row.ai_assistant_used === 1,
      settingsConfigured: row.settings_configured === 1,
      currentStep: row.current_step,
      completedSteps,
      skippedSteps: JSON.parse(row.skipped_steps || '[]'),
      startedAt: row.started_at,
      completedAt: row.completed_at,
      lastActivityAt: row.last_activity_at,
      percentComplete,
    };
  }

  /**
   * Mark a step as completed
   */
  async completeStep(userId: string, step: string): Promise<OnboardingProgress> {
    const db = await this.getDb();
    const progress = await this.getProgress(userId);

    if (!progress.id) {
      throw new Error('Onboarding not initialized');
    }

    const completedSteps = [...progress.completedSteps];
    if (!completedSteps.includes(step)) {
      completedSteps.push(step);
    }

    // Map step to column
    const stepColumnMap: Record<string, string> = {
      profile: 'profile_completed',
      team: 'team_invited',
      project: 'first_project_created',
      assessment: 'first_assessment_run',
      ai: 'ai_assistant_used',
      settings: 'settings_configured',
    };

    const column = stepColumnMap[step];
    if (column) {
      await db.run(
        `UPDATE user_onboarding SET ${column} = 1, last_activity_at = datetime('now') WHERE user_id = ?`,
        [userId]
      );
    }

    // Update completed steps and current step
    const nextStep = this.getNextStep(completedSteps);
    const isComplete = this.isOnboardingComplete(completedSteps);

    await db.run(
      `UPDATE user_onboarding 
             SET completed_steps = ?, current_step = ?, completed_at = ?, updated_at = datetime('now')
             WHERE user_id = ?`,
      [
        JSON.stringify(completedSteps),
        nextStep,
        isComplete ? new Date().toISOString() : null,
        userId,
      ]
    );

    logger.info(`[Onboarding] Step '${step}' completed for user ${userId}`);
    return this.getProgress(userId);
  }

  /**
   * Skip a step
   */
  async skipStep(userId: string, step: string): Promise<OnboardingProgress> {
    const db = await this.getDb();
    const progress = await this.getProgress(userId);

    if (!progress.id) {
      throw new Error('Onboarding not initialized');
    }

    // Only optional steps can be skipped
    const stepConfig = ONBOARDING_STEPS.find((s) => s.id === step);
    if (!stepConfig?.optional) {
      throw new Error('This step cannot be skipped');
    }

    const skippedSteps = [...progress.skippedSteps];
    if (!skippedSteps.includes(step)) {
      skippedSteps.push(step);
    }

    const nextStep = this.getNextStep([...progress.completedSteps, step]);

    await db.run(
      `UPDATE user_onboarding 
             SET skipped_steps = ?, current_step = ?, last_activity_at = datetime('now'), updated_at = datetime('now')
             WHERE user_id = ?`,
      [JSON.stringify(skippedSteps), nextStep, userId]
    );

    logger.info(`[Onboarding] Step '${step}' skipped for user ${userId}`);
    return this.getProgress(userId);
  }

  /**
   * Get the next uncompleted step
   */
  private getNextStep(completedSteps: string[]): string {
    const sortedSteps = [...ONBOARDING_STEPS].sort((a, b) => a.order - b.order);
    const nextStep = sortedSteps.find((s) => !completedSteps.includes(s.id));
    return nextStep?.id || 'complete';
  }

  /**
   * Check if onboarding is complete
   */
  private isOnboardingComplete(completedSteps: string[]): boolean {
    const requiredSteps = ONBOARDING_STEPS.filter((s) => !s.optional);
    return requiredSteps.every((s) => completedSteps.includes(s.id));
  }

  /**
   * Get onboarding steps with status
   */
  async getStepsWithStatus(userId: string): Promise<
    Array<{
      id: string;
      name: string;
      order: number;
      optional: boolean;
      status: 'completed' | 'current' | 'skipped' | 'pending';
    }>
  > {
    const progress = await this.getProgress(userId);

    return ONBOARDING_STEPS.map((step) => ({
      id: step.id,
      name: step.name,
      order: step.order,
      optional: step.optional || false,
      status: progress.completedSteps.includes(step.id)
        ? 'completed'
        : progress.skippedSteps.includes(step.id)
          ? 'skipped'
          : step.id === progress.currentStep
            ? 'current'
            : 'pending',
    }));
  }
}

// Export singleton instance
const onboardingProgressService = new OnboardingProgressService();
export default onboardingProgressService;

// Named exports
export const initializeOnboarding = (userId: string, orgId: string) =>
  onboardingProgressService.initializeOnboarding(userId, orgId);
export const getProgress = (userId: string) => onboardingProgressService.getProgress(userId);
export const completeStep = (userId: string, step: string) =>
  onboardingProgressService.completeStep(userId, step);
export const skipStep = (userId: string, step: string) =>
  onboardingProgressService.skipStep(userId, step);
export const getStepsWithStatus = (userId: string) =>
  onboardingProgressService.getStepsWithStatus(userId);
