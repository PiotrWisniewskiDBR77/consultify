export type FunnelEventName =
  | 'auth_login_success'
  | 'demo_session_started'
  | 'trial_org_setup_completed'
  | 'billing_payment_method_added'
  | 'interview_conversational_started'
  | 'interview_transcript_message_added'
  | 'interview_ai_parse_requested'
  | 'interview_ai_parse_applied'
  | 'interview_question_marked_answered'
  | 'interview_question_needs_follow_up'
  | 'survey_started'
  | 'survey_resumed'
  | 'survey_completed'
  | 'survey_abandoned'
  | 'external_assessment_opened'
  | 'external_assessment_started'
  | 'external_assessment_completed'
  | 'external_assessment_result_viewed'
  | 'external_assessment_cta_clicked'
  | 'inference_run_started'
  | 'inference_run_completed'
  | 'inference_run_failed'
  | 'insight_approved'
  | 'insight_regenerated'
  | 'insight_exported'
  | 'sponsor_report_created'
  | 'sponsor_report_generated'
  | 'sponsor_report_section_edited'
  | 'sponsor_report_approved'
  | 'sponsor_report_rejected'
  | 'sponsor_report_exported'
  | 'sponsor_report_utilized'
  | 'ai_access_blocked'
  | 'upgrade_cta_clicked'
  | 'upgrade_viewed'
  | 'plan_selected'
  | 'checkout_started'
  | 'checkout_completed'
  | 'checkout_failed'
  | 'subscription_cancelled'
  | 'cloud_source_connected'
  | 'dataset_import_started'
  | 'dataset_import_succeeded'
  | 'dataset_import_failed'
  | 'deep_thinking_started'
  | 'deep_thinking_report_generated'
  | 'deep_thinking_exported'
  | 'market_research_started'
  | 'market_research_report_generated'
  | 'market_research_exported'
  | 'cothinker_mode_selected'
  | 'cothinker_response_generated'
  | 'oauth_login_started'
  | 'oauth_login_succeeded'
  | 'oauth_login_failed'
  | 'oauth_linked'
  | 'oauth_unlinked'
  | 'linkedin_connect_cta_shown'
  | 'linkedin_connect_cta_clicked'
  | 'linkedin_connect_cta_dismissed'
  | 'personal_task_created'
  | 'personal_task_completed'
  | 'personal_task_due_date_set'
  | 'my_idea_saved'
  | 'my_idea_edited'
  | 'my_idea_suggested'
  | 'my_idea_used'
  | 'tools_hub_opened'
  | 'known_tools_opened'
  | 'known_tool_viewed'
  | 'tool_filtered'
  | 'tool_preview_opened'
  | 'tool_session_started_from_library'
  | 'tool_kb_opened'
  | 'help_video_watched'
  | 'help_video_skipped'
  | 'help_video_dont_show'
  | 'ai_authoring_used'
  | 'ai_authoring_applied'
  | 'ai_authoring_undone'
  | 'ai_card_generated'
  | 'initiative_gate_readiness_viewed'
  | 'initiative_gate_readiness_ai_requested';

export function trackFunnelEvent(eventName: FunnelEventName, data: Record<string, unknown> = {}) {
  try {
    // Persist last events for debugging/support
    const existing = JSON.parse(sessionStorage.getItem('funnel_events') || '[]');
    existing.push({ eventName, data, timestamp: Date.now() });
    sessionStorage.setItem('funnel_events', JSON.stringify(existing.slice(-100)));
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', eventName, data);
    }
  } catch {
    // ignore
  }

  try {
    if (typeof window !== 'undefined' && (window as any).journeyAnalytics) {
      (window as any).journeyAnalytics.trackMilestone?.(eventName, data);
    }
  } catch {
    // ignore
  }
}
