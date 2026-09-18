type InterviewTemplateFullPageEnv = { VITE_INTERVIEW_TEMPLATE_FULLPAGE?: string };

/**
 * DEC-533 (U-07 / IS-3a) rollout guard for the full-page interview template
 * editor. Fail-closed: a missing, empty, or any value other than the exact
 * string `true` is OFF, so the document editor keeps the current N-card
 * StandardArtifactShell until the owner accepts the full-page screen on a dump.
 */
export const isInterviewTemplateFullPageEnabled = (
  env: InterviewTemplateFullPageEnv = import.meta.env as InterviewTemplateFullPageEnv
): boolean => env.VITE_INTERVIEW_TEMPLATE_FULLPAGE === 'true';
