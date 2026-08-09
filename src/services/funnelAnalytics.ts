export type FunnelEventName =
  | 'artifact_studio_shell_selected'
  | 'auth_login_success'
  | 'reports_entry_redirected'
  | 'demo_session_started'
  | 'trial_org_setup_completed'
  | 'billing_payment_method_added'
  | 'assessment_session_started_from_library'
  | 'interview_conversational_started'
  | 'interview_transcript_message_added'
  | 'interview_ai_parse_requested'
  | 'interview_ai_parse_applied'
  | 'interview_question_marked_answered'
  | 'interview_question_needs_follow_up'
  | 'interview_runtime_mode_selected'
  | 'interview_runtime_mode_changed'
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
  | 'insight_generated'
  | 'insight_approved'
  | 'insight_regenerated'
  | 'insight_exported'
  | 'insight_used_in_ai_context'
  | 'sponsor_report_created'
  | 'sponsor_report_generated'
  | 'sponsor_report_section_edited'
  | 'sponsor_report_approved'
  | 'sponsor_report_rejected'
  | 'sponsor_report_exported'
  | 'presentation_export_failed'
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
  | 'landing_anna_guided_prompt_clicked'
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
  | 'my_idea_developed'
  // My Ideas — workspace / map catalog instrumentation (T009)
  | 'idea_inbox_opened'
  | 'idea_triaged'
  | 'idea_bulk_tag_added'
  | 'idea_bulk_deleted'
  | 'idea_converted_initiative'
  | 'idea_converted_task_set'
  | 'idea_converted_decision'
  | 'idea_converted_team_chat'
  // Z3 audit (2026-07-24): 'target' union in MyIdeasListContent.handleConvert
  // was widened to also accept 'report'/'presentation' — these two event
  // names complete the matching FunnelEventName set (see that file's comment).
  | 'idea_converted_report'
  | 'idea_converted_presentation'
  | 'idea_edge_created'
  | 'idea_edge_deleted'
  | 'notebook_page_saved'
  | 'notebook_page_created'
  | 'notebook_page_edited'
  | 'notebook_search_used'
  | 'notebook_template_used'
  | 'notebook_ai_command_used'
  | 'notebook_handoff'
  | 'notebook_pulse_viewed'
  | 'notebook_convert_triggered'
  | 'mywork_convert_clicked'
  | 'mywork_convert_completed'
  | 'ideas_tool_switched'
  | 'ideas_selection_changed'
  | 'ideas_generator_proposal_created'
  | 'ideas_proposal_accepted'
  | 'ideas_proposal_rejected'
  | 'ideas_quick_tool_used'
  | 'ideas_ai_suggestion_inserted'
  | 'ideas_cross_system_transform'
  | 'ideas_attach_artifact'
  | 'ideas_open_linked'
  | 'ideas_convert_selection'
  | 'ideas_discuss_with_teresa'
  | 'ideas_focus_mode'
  | 'ideas_artifact_attached'
  | 'ideas_table_view_changed'
  | 'ideas_table_filter_applied'
  | 'ideas_table_sort_applied'
  | 'ideas_table_autofill_triggered'
  | 'ideas_table_refresh_triggered'
  | 'ideas_table_field_fill_applied'
  // Notebook — extra UI actions used in My Work notebook
  | 'notebook_action_item_created'
  | 'notebook_action_items_bulk_created'
  | 'notebook_ai_command_prompt_used'
  | 'notebook_inline_ai_rewrite_proposed'
  | 'notebook_inline_ai_rewrite_accepted'
  | 'notebook_checklist_bulk_convert'
  | 'notebook_context_panel_opened'
  | 'notebook_pulse_picker_opened'
  | 'notebook_ai_block_dropped'
  | 'notebook_ai_topics_fetched'
  | 'notebook_ai_topic_added'
  | 'notebook_ai_topic_edited'
  | 'notebook_ai_topic_sent_to_chat'
  | 'notebook_transform_used'
  | 'notebook_share_email'
  | 'active_notes_suggested'
  | 'active_notes_opened'
  | 'active_notes_inserted'
  | 'signal_feed_opened'
  | 'signal_saved_to_ideas'
  | 'signal_saved_to_notebook'
  | 'signal_snoozed'
  | 'signal_type_muted'
  | 'signal_dismissed'
  | 'tools_hub_opened'
  | 'tools_wizard_step_completed'
  | 'tools_wizard_finalized'
  | 'tools_wizard_output_created'
  | 'known_tools_opened'
  | 'known_tool_viewed'
  | 'tool_filtered'
  | 'tool_preview_opened'
  | 'tool_session_started_from_library'
  | 'tool_kb_opened'
  | 'help_video_watched'
  | 'help_video_skipped'
  | 'help_video_dont_show'
  // V3-A08 Video Enablement — MicroVideoPrompt
  | 'help_video_prompt_shown'
  | 'help_video_view_started'
  | 'help_video_view_completed'
  | 'ai_authoring_used'
  | 'ai_authoring_applied'
  | 'ai_authoring_undone'
  | 'ai_card_generated'
  | 'initiative_gate_readiness_viewed'
  | 'initiative_gate_readiness_ai_requested'
  | 'skills_gap_viewed'
  | 'licensed_tool_framework_opened'
  | 'licensed_tool_assessment_completed'
  | 'licensed_tool_assessment_approved'
  | 'licensed_tools_report_generated'
  | 'licensed_tools_deck_exported'
  | 'licensed_tool_roadmap_generated'
  | 'licensed_tool_initiatives_created_from_roadmap'
  | 'licensed_tool_locked_viewed'
  | 'licensed_tool_unlock_cta_clicked'
  | 'pdf_import_started'
  | 'pdf_import_extracted'
  | 'pdf_import_mapping_confirmed'
  | 'execution_timeline_viewed'
  | 'execution_hub_opened'
  | 'execution_status_updated'
  | 'execution_timeline_initiative_updated'
  | 'execution_timeline_filtered'
  | 'execution_risk_signal_viewed'
  | 'execution_risk_signal_dismissed'
  | 'execution_risk_mitigation_updated'
  | 'execution_warning_clicked'
  | 'execution_exec_snapshot_loaded'
  | 'execution_exec_snapshot_ai_toggled'
  | 'execution_exec_snapshot_refreshed'
  | 'execution_dependency_created'
  | 'execution_dependency_deleted'
  | 'delay_detection_viewed'
  | 'delay_signal_detected'
  | 'delay_signal_dismissed'
  | 'delay_alert_sent'
  | 'delay_alert_clicked'
  | 'budget_dashboard_viewed'
  | 'budget_plan_updated'
  | 'budget_actual_updated'
  | 'budget_overspend_signal_detected'
  | 'budget_recommendation_applied'
  | 'roi_assumptions_updated'
  | 'roi_realized_value_updated'
  | 'roi_variance_viewed'
  // V3-H03 — Results Operational + ROI Analysis
  | 'results_analysis_opened'
  | 'kpi_created'
  | 'kpi_value_updated'
  | 'kpi_mapping_updated'
  | 'kpi_viewed'
  | 'kpi_attribution_viewed'
  | 'kpi_attribution_parameters_updated'
  | 'kpi_attribution_exported'
  | 'kpi_financial_mapping_created'
  | 'kpi_financial_mapping_updated'
  | 'kpi_financial_impact_viewed'
  | 'integration_sync_hub_viewed'
  | 'integration_connected'
  | 'integration_disconnected'
  | 'integration_reauth_required'
  | 'integration_reauth_completed'
  | 'integration_sync_run_started'
  | 'integration_sync_run_completed'
  | 'integration_error_resolved'
  | 'financial_statement_import_started'
  | 'financial_statement_import_completed'
  | 'financial_statement_import_failed'
  | 'financial_statement_mapping_corrected'
  | 'financial_ratios_viewed'
  | 'financial_benchmark_updated'
  | 'financial_ratio_exported'
  | 'finance_export_initiatives_created'
  | 'presentation_generator_opened'
  | 'presentation_outline_generated'
  | 'presentation_exported'
  | 'presentation_shared'
  | 'template_selected'
  | 'brand_kit_updated'
  | 'template_cloned'
  | 'template_published'
  | 'report_builder_opened'
  | 'report_section_added'
  | 'report_section_reordered'
  | 'report_section_generated'
  | 'report_section_regenerated'
  | 'report_exported'
  | 'report_shared'
  | 'report_agent_message_sent'
  | 'report_quality_check_run'
  | 'report_template_selected'
  | 'report_template_applied'
  | 'portfolio_ai_analysis_requested'
  | 'portfolio_ai_analysis_succeeded'
  | 'portfolio_ai_analysis_failed'
  | 'portfolio_ai_suggestion_applied'
  | 'portfolio_timeline_optimization_requested'
  | 'portfolio_timeline_scenario_applied'
  | 'portfolio_nonhuman_resources_viewed'
  | 'portfolio_nonhuman_conflict_detected'
  | 'portfolio_scenario_optimization_requested'
  | 'portfolio_scenario_selected'
  | 'portfolio_scenario_applied'
  | 'finance_analysis_generated'
  | 'finance_analysis_approved'
  | 'finance_export_clicked'
  | 'finance_export_created'
  | 'finance_export_investment_case_candidate_confirmed'
  | 'finance_insight_converted_to_initiative'
  | 'budget_created'
  | 'budget_scenario_updated'
  | 'budget_approved'
  | 'budget_exported'
  | 'financial_model_created'
  | 'financial_model_event_added'
  | 'financial_model_event_updated'
  | 'financial_model_validation_failed'
  | 'financial_model_approved'
  | 'report_schedule_created'
  | 'report_schedule_updated'
  | 'report_schedule_paused'
  | 'report_schedule_trigger_fired'
  | 'report_schedule_run_completed'
  | 'report_schedule_delivery_sent'
  | 'report_schedule_delivery_failed'
  | 'landing_docs_section_viewed'
  | 'landing_docs_cta_clicked'
  | 'landing_docs_search_used'
  | 'landing_viewed'
  | 'landing_primary_cta_clicked'
  | 'landing_demo_clicked'
  | 'landing_anna_widget_opened'
  | 'landing_anna_message_sent'
  | 'landing_anna_handoff_clicked'
  | 'landing_anna_fallback_shown'
  | 'landing_video_teaser_started'
  | 'landing_video_teaser_completed'
  | 'landing_watch_full_after_login_clicked'
  | 'landing_video_full_opened'
  | 'landing_video_full_started'
  | 'landing_video_full_completed'
  | 'pricing_viewed'
  | 'pricing_cta_clicked'
  | 'valuation_created'
  | 'valuation_assumption_updated'
  | 'valuation_approved'
  | 'valuation_exported'
  | 'valuation_advisory_generated'
  | 'valuation_advisory_recommendation_converted'
  | 'valuation_advisory_exported'
  | 'valuation_negotiation_pack_generated'
  | 'valuation_negotiation_pack_exported'
  // T063 — Organization UX
  | 'org_workspace_opened'
  | 'org_workspace_admin_handoff'
  | 'org_admin_cta_clicked'
  | 'org_member_invite_sent'
  // T064 — Megatrend relocation
  | 'megatrends_opened'
  | 'megatrends_redirect_used'
  // T043 — Capability Management
  | 'capability_profile_updated'
  | 'capability_match_viewed'
  | 'capability_assignment_suggestion_generated'
  | 'capability_assignment_applied'
  // T065 — Competency Taxonomy
  | 'competency_created'
  | 'competency_updated'
  | 'competency_deleted'
  | 'initiative_requirement_added'
  | 'initiative_requirement_removed'
  // V3-F02 — Initiatives Portfolio Analysis
  | 'initiatives_analysis_opened'
  | 'initiatives_analysis_issue_opened'
  // T066 — Skills Gap Analysis
  | 'skills_gap_viewed'
  | 'skills_gap_action_created'
  // T044 — Change Sentiment
  | 'change_pulse_submitted'
  | 'change_sentiment_trend_changed'
  | 'change_resistance_alert_sent'
  | 'change_resistance_alert_clicked'
  // T045 — Stakeholder Communication
  | 'change_comm_plan_created'
  | 'change_comm_plan_updated'
  | 'change_comm_sent'
  | 'change_comm_overdue_detected'
  // T090 — Demo-to-Trial Conversion
  | 'demo_started'
  | 'demo_value_moment_reached'
  | 'demo_cta_clicked'
  // StoryRail — the guided demo path (docs/demo/DEMO_JOURNEY_REDESIGN.md)
  | 'demo_story_stop_viewed'
  | 'demo_story_completed'
  | 'demo_story_dismissed'
  | 'signup_started'
  | 'signup_completed'
  | 'trial_activated'
  // T099 — C-Type Table View
  | 'table_view_mode_changed'
  | 'table_row_quick_action_used'
  // T102 — Sidebar Design System
  | 'sidebar_item_clicked'
  | 'sidebar_collapsed_toggled'
  | 'sidebar_flyout_opened'
  // T104/T105 — Chat UI Polish
  | 'chat_business_button_clicked'
  | 'chat_action_rendered'
  | 'chat_action_clicked'
  | 'chat_action_failed'
  | 'chat_suggestion_clicked'
  | 'ai_actions_view_opened'
  // T108 — SuperAdmin Control & System Testing
  | 'superadmin_action_executed'
  | 'superadmin_impersonation_started'
  | 'superadmin_impersonation_ended'
  | 'test_support_bootstrap_called'
  | 'test_support_cleanup_called'
  // T116 — AI Prompt Management & Learning
  | 'prompt_version_published'
  | 'prompt_version_rolled_back'
  | 'prompt_ab_experiment_started'
  | 'prompt_ab_experiment_winner_promoted'
  | 'ai_feedback_submitted'
  | 'ai_learning_instruction_applied'
  // T117 — Core Documentation Layer
  | 'core_docs_reindexed'
  | 'core_docs_drift_detected'
  | 'ai_citation_verification_score'
  // T109 — Payment System Integration
  | 'billing_checkout_started'
  | 'billing_checkout_completed'
  | 'billing_subscription_changed'
  | 'billing_payment_failed'
  | 'billing_payment_recovered'
  | 'token_purchase_started'
  | 'token_purchase_completed'
  // T118 — Web Search Governance
  | 'ai_web_search_used'
  | 'ai_web_search_blocked'
  // T119 — Org Context Governance
  | 'ai_context_category_used'
  | 'ai_context_blocked'
  // T120 — User Privacy
  | 'ai_private_mode_enabled'
  | 'ai_private_mode_disabled'
  | 'ai_memory_write_blocked'
  // T121 — Document Governance
  | 'ai_doc_used'
  | 'ai_doc_blocked'
  // T014 — Survey Shell (additional granularity)
  | 'survey_question_answered'
  | 'survey_section_completed'
  // T067 — CV-Based Matching Engine
  | 'cv_uploaded'
  | 'cv_extracted'
  | 'cv_competencies_approved'
  | 'cv_match_viewed'
  | 'cv_match_applied'
  // T106 — Advanced User Feedback System
  | 'feedback_opened'
  | 'feedback_submitted'
  | 'feedback_status_changed'
  | 'feature_request_submitted'
  | 'feature_vote_cast'
  // T113 — User Behavioral Intelligence
  | 'journey_event_tracked'
  | 'activation_phase_changed'
  | 'churn_warning_created'
  // My Work Tasks — enhanced instrumentation
  | 'triage_action_used'
  | 'bulk_edit_opened'
  | 'bulk_edit_applied'
  | 'inline_edit_used'
  | 'undo_used'
  | 'smart_sort_toggled'
  | 'saved_view_applied'
  | 'saved_view_created'
  | 'column_config_toggled'
  | 'task_deleted'
  | 'task_bulk_deleted'
  // V3-J02 — Presentations Hub
  | 'presentations_hub_opened'
  | 'presentation_opened'
  | 'presentation_exported'
  // V3-A02 — Dynamic tabs
  | 'dynamic_tab_opened'
  | 'dynamic_tab_closed'
  | 'dynamic_tab_overflow_opened'
  // V3-F01 — Initiative Level Templates
  | 'initiative_level_changed'
  | 'initiative_section_completed'
  | 'initiative_completeness_viewed'
  // V3-A04 / V3-J01 — Reports entry & sidebar
  | 'sidebar_navigation_clicked'
  | 'reports_entry_opened'
  | 'route_redirected'
  // V3-A06 — Model Registry
  | 'model_registry_viewed'
  | 'model_assignment_changed'
  | 'model_fallback_used'
  | 'model_audit_log_entry'
  // V3-A01 — Traceability
  | 'artifact_created'
  | 'artifact_convert_clicked'
  | 'artifact_source_opened'
  | 'mywork_session_materialized'
  // V3-A06 — Model Registry
  | 'model_registry_viewed'
  | 'model_assignment_changed'
  | 'model_audit_log_viewed'
  // V3 — Idea Table events
  | 'ideas_table_row_added'
  | 'ideas_table_column_added'
  | 'ideas_table_framework_applied'
  | 'ideas_table_suggestion_applied'
  | 'ideas_table_csv_imported'
  | 'ideas_table_sort_applied'
  | 'ideas_table_filter_applied'
  | 'ideas_table_categorize_applied'
  | 'ideas_table_scoring_applied'
  | 'ideas_table_export_presentation'
  | 'ideas_table_timeline_opened'
  // V5-IDEA-48: Ideas V5 telemetry model
  | 'ideas_v5_seed_surface_opened'
  | 'ideas_v5_seed_start_mode'
  | 'ideas_v5_seed_template_selected'
  | 'ideas_v5_seed_popular_start_used'
  | 'ideas_v5_seed_brief_submitted'
  | 'ideas_v5_workspace_opened'
  | 'ideas_v5_system_switched'
  | 'ideas_v5_focus_mode_changed'
  | 'ideas_v5_node_depth_expanded'
  | 'ideas_v5_cross_system_transform'
  | 'ideas_v5_knowledge_card_created'
  | 'ideas_v5_evidence_captured'
  | 'ideas_v5_knowledge_search_used'
  | 'ideas_v5_artifact_attached'
  | 'ideas_v5_artifact_opened'
  | 'ideas_v5_artifact_removed'
  | 'ideas_v5_ai_retrieve_artifacts'
  | 'ideas_v5_ai_propose_attachments'
  | 'ideas_v5_convert_whole_idea'
  | 'ideas_v5_convert_selection'
  | 'ideas_v5_export_report'
  | 'ideas_v5_export_presentation'
  | 'ideas_v5_linkgraph_edge_created'
  | 'ideas_v5_viewport_restored'
  | 'ideas_v5_zoom_fit_used'
  | 'ideas_table_column_renamed'
  | 'ideas_table_column_config_updated'
  | 'ideas_table_column_deleted'
  | 'ideas_table_bulk_convert'
  | 'ideas_table_relation_created'
  | 'ideas_table_artifact_linked'
  // Chat V9 / VOICE VM4 — barge-in acknowledgement toast actually shown
  // (i.e. the 1.5 s debounce guard was cleared). Payload: closed-enum
  // `source` describing which gesture triggered the barge-in. Drops inside
  // the debounce window do NOT emit — only visible toasts are counted.
  | 'voice_barge_in_notified'
  // Chat V9 / VOICE VM3 — user opened the voice-modes legend popover
  // next to the mic. One event per open gesture (each open is a
  // distinct "I needed an explanation now" signal). Zero ids / PII.
  | 'voice_mode_legend_opened'
  // Chat V9 / VOICE VM3.1 — user triggered the voice-modes legend
  // via the Alt+Shift+V keyboard shortcut. Empty payload; symmetric
  // with `voice_mode_legend_opened`. The split lets us measure what
  // fraction of users learn the shortcut vs. click the trigger
  // button, without spreading a `trigger` field onto the original
  // event. Zero ids / PII.
  | 'voice_mode_legend_shortcut'
  // ---------------------------------------------------------------------
  // Chat V9 / TRUST T-PM2-lite — advisory post-send PII heuristic.
  // Fired exactly once per toast window (cooldown-throttled on the
  // client). Payload is a closed-enum `categories` array of detected
  // classes — `email | phone | iban`. No raw text, no substrings,
  // no counts. The event is a "user was nudged" signal, not a
  // "PII existed" signal; suppressed emissions (cooldown / no-hit)
  // do not fire anything.
  // ---------------------------------------------------------------------
  | 'pii_heuristic_warning_shown'
  // ---------------------------------------------------------------------
  // Chat V9 / VOICE VM10 — voice funnel. Closed-enum payloads, zero
  // transcript content. See `src/utils/voiceFunnelTelemetry.ts` for the
  // exact PII contract. All four emit through `safeTrack()`; failures
  // never block the voice hot path.
  // ---------------------------------------------------------------------
  // Fired when `useUniversalVoice.startListening` actually transitions
  // idle → listening (not on duplicate calls). Payload: sttProvider,
  // trigger (single vs conversation), language.
  | 'voice_start'
  // Fired after `transcribeWithServer` (whisper) OR a web-speech final
  // result returns a usable transcript. Carries a length BUCKET, never
  // the text.
  | 'voice_stt_success'
  // Fired for STT failures — permission denied, server error, network,
  // web-speech `error` event, or aborted-before-transcript. Reason is a
  // closed enum so infra-specific error strings never leak.
  | 'voice_stt_fail'
  // Fired when `speak()` actually starts audio playback. Captures
  // provider (openai/edge/web) and whether it was an auto-speak vs
  // manual replay.
  | 'tts_on'
  // ---------------------------------------------------------------------
  // Chat V9 / TRUST T-PM1 — user clicked the "Private mode" chip in the
  // header and the details popover rendered. One event per open gesture
  // (re-opening after a close still emits — each open is a distinct
  // "what does this guarantee mean?" signal). Payload is intentionally
  // empty: the badge only renders when private mode is already on, so
  // the event's presence is the full signal. Zero transcripts, zero ids.
  // ---------------------------------------------------------------------
  | 'private_mode_details_opened'
  // ---------------------------------------------------------------------
  // Chat V9 / TRUST T-TR1 — user clicked the trust badge on an AI reply
  // and the citation summary popover rendered. RODO-safe: the payload
  // carries only a bucketed source-count (`none` / `few` / `many`) and
  // a single enum flag for whether a model id was known. NEVER includes
  // message ids, conversation ids, model names, citation text, or any
  // user-generated content. Bucketing lets the dashboard track citation
  // health without turning this event into a per-message tracker.
  // ---------------------------------------------------------------------
  | 'trust_badge_opened'
  // ---------------------------------------------------------------------
  // Chat V9 / NAV NAV-M1 — user clicked the floating "Back to chat"
  // pill rendered globally on non-chat views when an active
  // conversation exists. Payload carries only the `fromView` AppView
  // enum value (closed set) so the funnel can rank which surfaces
  // most often send users back to the conversation. NEVER includes
  // the conversation id, artifact id, or any user content.
  // ---------------------------------------------------------------------
  | 'navigation_back_to_chat_clicked'
  // ---------------------------------------------------------------------
  // Chat V9 / NAV NAV-M1.1 — user pressed the Alt+Shift+C keyboard
  // shortcut and it actually triggered `returnToFullChat()`. The
  // handler only dispatches when the same gates as NAV-M1's button
  // are satisfied (non-chat view, active conversation, focus not
  // trapped in an input). Payload mirrors NAV-M1's: only `fromView`
  // (closed `AppView` enum). NEVER any conversation / user ids.
  // ---------------------------------------------------------------------
  | 'navigation_back_to_chat_shortcut';

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
