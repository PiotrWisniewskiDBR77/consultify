/**
 * AI Notification Triggers
 * Programmatic creation of AI-specific notifications:
 * - AI_RISK_DETECTED
 * - AI_RECOMMENDATION
 * - AI_OVERLOAD_DETECTED
 * - AI_DEPENDENCY_CONFLICT
 *
 * These can be called from AI pipelines, scheduled jobs, or manual triggers.
 */

import logger from '../utils/Logger.js';

// Lazy-load to avoid circular deps
let _notificationService: any = null;
const getNotificationService = async () => {
  if (!_notificationService) {
    try {
      const mod = (await import('./notificationService.js')) as any;
      _notificationService = mod.default || mod;
    } catch (e) {
      logger.warn('[AINotificationTriggers] NotificationService not available');
    }
  }
  return _notificationService;
};

export interface AINotificationContext {
  userId: string;
  organizationId: string;
  projectId?: string;
  relatedObjectType?: string;
  relatedObjectId?: string;
}

/**
 * Trigger AI_RISK_DETECTED notification
 * Called when AI analysis identifies a risk in a project/task/decision
 */
export async function triggerAIRiskDetected(
  ctx: AINotificationContext,
  riskDetails: {
    title: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    affectedEntity?: string;
    recommendation?: string;
    confidence?: number;
  }
): Promise<string | null> {
  const NotificationSvc = await getNotificationService();
  if (!NotificationSvc) return null;

  try {
    const severity =
      riskDetails.riskLevel === 'critical'
        ? 'CRITICAL'
        : riskDetails.riskLevel === 'high'
          ? 'WARNING'
          : 'INFO';

    return await NotificationSvc.send({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      type: 'AI_RISK_DETECTED',
      severity,
      title: riskDetails.title,
      body: riskDetails.description,
      message: riskDetails.description,
      relatedObjectType: ctx.relatedObjectType,
      relatedObjectId: ctx.relatedObjectId,
      projectId: ctx.projectId,
      isActionable: true,
      data: {
        riskLevel: riskDetails.riskLevel,
        affectedEntity: riskDetails.affectedEntity,
        recommendation: riskDetails.recommendation,
        confidence: riskDetails.confidence,
        aiGenerated: true,
        whyYouGotIt: 'AI detected a risk that may affect your project or tasks.',
      },
    });
  } catch (error) {
    logger.error('[AINotificationTriggers] Failed to trigger AI_RISK_DETECTED:', error);
    return null;
  }
}

/**
 * Trigger AI_RECOMMENDATION notification
 * Called when AI has an optimization suggestion
 */
export async function triggerAIRecommendation(
  ctx: AINotificationContext,
  recommendation: {
    title: string;
    description: string;
    impact?: string;
    savings?: string;
    confidence?: number;
    actionLabel?: string;
  }
): Promise<string | null> {
  const NotificationSvc = await getNotificationService();
  if (!NotificationSvc) return null;

  try {
    return await NotificationSvc.send({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      type: 'AI_RECOMMENDATION',
      severity: 'INFO',
      title: recommendation.title,
      body: recommendation.description,
      message: recommendation.description,
      relatedObjectType: ctx.relatedObjectType,
      relatedObjectId: ctx.relatedObjectId,
      projectId: ctx.projectId,
      isActionable: true,
      data: {
        impact: recommendation.impact,
        savings_annual: recommendation.savings,
        confidence: recommendation.confidence,
        actionLabel: recommendation.actionLabel || 'Review recommendation',
        aiGenerated: true,
        whyYouGotIt: 'AI identified an optimization opportunity in your project.',
      },
    });
  } catch (error) {
    logger.error('[AINotificationTriggers] Failed to trigger AI_RECOMMENDATION:', error);
    return null;
  }
}

/**
 * Trigger AI_OVERLOAD_DETECTED notification
 * Called when AI detects resource or workload overload
 */
export async function triggerAIOverloadDetected(
  ctx: AINotificationContext,
  overload: {
    title: string;
    description: string;
    affectedResource: string;
    currentLoad: number;
    threshold: number;
    recommendation?: string;
  }
): Promise<string | null> {
  const NotificationSvc = await getNotificationService();
  if (!NotificationSvc) return null;

  try {
    return await NotificationSvc.send({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      type: 'AI_OVERLOAD_DETECTED',
      severity: 'WARNING',
      title: overload.title,
      body: overload.description,
      message: overload.description,
      relatedObjectType: ctx.relatedObjectType,
      relatedObjectId: ctx.relatedObjectId,
      projectId: ctx.projectId,
      isActionable: true,
      data: {
        affectedResource: overload.affectedResource,
        currentLoad: overload.currentLoad,
        threshold: overload.threshold,
        recommendation: overload.recommendation,
        aiGenerated: true,
        whyYouGotIt: 'AI detected a workload or resource overload affecting your area.',
      },
    });
  } catch (error) {
    logger.error('[AINotificationTriggers] Failed to trigger AI_OVERLOAD_DETECTED:', error);
    return null;
  }
}

/**
 * Trigger AI_DEPENDENCY_CONFLICT notification
 * Called when AI detects conflicting dependencies
 */
export async function triggerAIDependencyConflict(
  ctx: AINotificationContext,
  conflict: {
    title: string;
    description: string;
    conflictingEntities: string[];
    suggestedResolution?: string;
  }
): Promise<string | null> {
  const NotificationSvc = await getNotificationService();
  if (!NotificationSvc) return null;

  try {
    return await NotificationSvc.send({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      type: 'AI_DEPENDENCY_CONFLICT',
      severity: 'WARNING',
      title: conflict.title,
      body: conflict.description,
      message: conflict.description,
      relatedObjectType: ctx.relatedObjectType,
      relatedObjectId: ctx.relatedObjectId,
      projectId: ctx.projectId,
      isActionable: true,
      data: {
        conflictingEntities: conflict.conflictingEntities,
        suggestedResolution: conflict.suggestedResolution,
        aiGenerated: true,
        whyYouGotIt: 'AI detected a dependency conflict that requires your attention.',
      },
    });
  } catch (error) {
    logger.error('[AINotificationTriggers] Failed to trigger AI_DEPENDENCY_CONFLICT:', error);
    return null;
  }
}

export default {
  triggerAIRiskDetected,
  triggerAIRecommendation,
  triggerAIOverloadDetected,
  triggerAIDependencyConflict,
};
