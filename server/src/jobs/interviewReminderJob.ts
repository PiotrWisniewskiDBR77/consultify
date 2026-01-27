/**
 * Interview Reminder Job
 *
 * Hourly cron job to:
 * 1. Send automatic reminders for upcoming interview deadlines (48h, 24h, 2h)
 * 2. Escalate overdue assignments to the assigner
 * 3. Log all notification events
 *
 * Run via: npx ts-node server/src/jobs/interviewReminderJob.ts
 * Or schedule with cron: 0 * * * * (every hour)
 */

import interviewAssignmentService from '../services/InterviewAssignmentService.js';
import logger from '../utils/Logger.js';

/**
 * Run reminder check - sends notifications for upcoming deadlines
 */
async function runReminderCheck(): Promise<{ sent: number; errors: number }> {
  logger.info('[InterviewReminderJob] Starting reminder check at', new Date().toISOString());

  try {
    const result = await interviewAssignmentService.checkAndSendReminders();
    logger.info('[InterviewReminderJob] Reminder check completed:', result);
    return result;
  } catch (error: any) {
    logger.error('[InterviewReminderJob] Reminder check failed:', error?.message || error);
    return { sent: 0, errors: 1 };
  }
}

/**
 * Run escalation check - notifies assigners about overdue assignments
 */
async function runEscalationCheck(): Promise<{ escalated: number; errors: number }> {
  logger.info('[InterviewReminderJob] Starting escalation check at', new Date().toISOString());

  try {
    const result = await interviewAssignmentService.checkAndEscalate();
    logger.info('[InterviewReminderJob] Escalation check completed:', result);
    return result;
  } catch (error: any) {
    logger.error('[InterviewReminderJob] Escalation check failed:', error?.message || error);
    return { escalated: 0, errors: 1 };
  }
}

/**
 * Main job function - runs both reminder and escalation checks
 */
async function runJob(): Promise<{
  success: boolean;
  reminders: { sent: number; errors: number };
  escalations: { escalated: number; errors: number };
}> {
  logger.info('[InterviewReminderJob] ========================================');
  logger.info('[InterviewReminderJob] Starting interview reminder job at', new Date().toISOString());
  logger.info('[InterviewReminderJob] ========================================');

  try {
    // Run reminder check first
    const reminderResult = await runReminderCheck();

    // Then run escalation check
    const escalationResult = await runEscalationCheck();

    const success = reminderResult.errors === 0 && escalationResult.errors === 0;

    logger.info('[InterviewReminderJob] ========================================');
    logger.info('[InterviewReminderJob] Job completed:', {
      success,
      remindersSent: reminderResult.sent,
      reminderErrors: reminderResult.errors,
      escalated: escalationResult.escalated,
      escalationErrors: escalationResult.errors,
      timestamp: new Date().toISOString(),
    });
    logger.info('[InterviewReminderJob] ========================================');

    return {
      success,
      reminders: reminderResult,
      escalations: escalationResult,
    };
  } catch (error: any) {
    logger.error('[InterviewReminderJob] Fatal error:', error?.message || error);
    return {
      success: false,
      reminders: { sent: 0, errors: 1 },
      escalations: { escalated: 0, errors: 1 },
    };
  }
}

// Export for programmatic use
export { runJob, runReminderCheck, runEscalationCheck };

export default {
  runJob,
  runReminderCheck,
  runEscalationCheck,
};

// Run directly if executed as script
const isMainModule = typeof require !== 'undefined' && require.main === module;
if (isMainModule) {
  runJob()
    .then((result) => {
      console.log('[InterviewReminderJob] Result:', JSON.stringify(result, null, 2));
      process.exit(result.success ? 0 : 1);
    })
    .catch((err) => {
      console.error('[InterviewReminderJob] Fatal error:', err);
      process.exit(1);
    });
}
