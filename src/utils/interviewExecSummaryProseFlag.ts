type InterviewExecSummaryProseEnv = { VITE_INTERVIEW_EXEC_SUMMARY_PROSE?: string };

/**
 * DEC-510 (U-08 / IS-3b) rollout guard for the Executive Summary prose render
 * in the Interview insight viewer. Fail-closed: a missing, empty, or any value
 * other than the exact string `true` is OFF, so the viewer keeps deriving the
 * summary from the markdown content (today's behaviour) until the owner accepts
 * the generated-prose screen on a dump.
 */
export const isInterviewExecSummaryProseEnabled = (
  env: InterviewExecSummaryProseEnv = import.meta.env as InterviewExecSummaryProseEnv
): boolean => env.VITE_INTERVIEW_EXEC_SUMMARY_PROSE === 'true';
