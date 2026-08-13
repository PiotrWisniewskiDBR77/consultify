/**
 * Immutable compatibility ledger for migrations that were already applied on
 * the demo environment before later idempotency/fresh-schema repairs changed
 * their files in git.
 *
 * This is deliberately an exact two-sided allowlist, not a filename bypass:
 * the database must contain the observed historical checksum AND the file on
 * disk must hash to the reviewed current checksum. A different historical
 * value or any future edit remains checksum drift and the runtime still fails
 * closed. The runner never rewrites history when this compatibility path is
 * used.
 */
export interface HistoricalChecksumVariant {
  stored: string;
  current: string;
}

export type HistoricalChecksumVariants =
  | HistoricalChecksumVariant
  | readonly HistoricalChecksumVariant[];

export const APPROVED_HISTORICAL_CHECKSUM_VARIANTS: Readonly<
  Record<string, HistoricalChecksumVariants>
> = Object.freeze({
  '739_knowledge_base_public_articles.sql': {
    stored: '444c848e37783b96',
    current: '2d18c96665b82f8c',
  },
  '20260330_v81_templates_as_outputs_artifacts.sql': {
    stored: '5eca0e1ace91934a',
    current: '8c6fb6d01926935a',
  },
  '20260221_01_prompt_ssot_compat.sql': {
    stored: '3b86817e1f71b412',
    current: '28b9f553054e4be9',
  },
  '20260213_task_source_origin.sql': {
    stored: 'cccdd95deb254c7c',
    current: '3a48f93ad30c262c',
  },
  '20260222_interview_conversational_inference.sql': {
    stored: '552b3596cd73f03d',
    current: '7cebd37b30d3f9c7',
  },
  '20260223_competency_taxonomy.sql': { stored: '498eeeeeed4fb091', current: 'b038612e51e3f8a0' },
  '20260228_budget_initiative_links.sql': {
    stored: '7826f403a14163b1',
    current: '50e3c21219cae784',
  },
  '20260228_financial_model_versions.sql': {
    stored: 'd8c532865f46011f',
    current: '3074dc0e589f6d97',
  },
  '20260303_feedback_behavior_t106_t113.sql': {
    stored: '498a662b68a2313b',
    current: '71b158de25f67e9e',
  },
  '20260303_schema_alignment.sql': { stored: '8346cdf811694f5c', current: '2f24fa6845dce97f' },
  '20260304_feedback_items_canonical_tickets.sql': {
    stored: '79e27f6fa4c91cf4',
    current: '0ca78bd5c5f9cb2b',
  },
  '20260311_origin_tracking.sql': { stored: 'a7172fcff85ff698', current: '938c8bf5582eabf7' },
  '20260314_presentation_decks_deck_json.sql': {
    stored: '7db981177509e44d',
    current: '002810e1ad5a85b6',
  },
  '20260316_financial_statement_packs.sql': {
    stored: '67b02166371cd93b',
    current: 'f276ca048cb5c3fc',
  },
  '20260318_postgres_datetime_compat.sql': {
    stored: '9b627dacd3f1d867',
    current: 'd830f00f3552c51b',
  },
  '20260323_v8_chat_execution.sql': { stored: 'ccbef04283d81a77', current: '11969b94eff1d5f7' },
  '20260323_v8_context_snapshot_identity_chain.sql': {
    stored: 'e5453b4845a79843',
    current: 'b11ac7f2745025aa',
  },
  '20260323_v8_execution_spine_approval_flow.sql': {
    stored: 'e07b14eda8e6666f',
    current: '7f9edbd39707cc01',
  },
  '20260323_v8_execution_spine_context_binding.sql': {
    stored: '9b24bf38b01cf00c',
    current: '7b0fbcdaaccfd11c',
  },
  '20260323_v8_execution_spine.sql': { stored: '423efccd361283da', current: 'fafedb892bfa533d' },
  '20260323_v8_finance_runtime.sql': { stored: 'adb3cc16af4055a9', current: '4351ffc5b6875829' },
  '20260323_v8_governed_retrieval_freshness.sql': {
    stored: '703661ff3196a3da',
    current: 'ae99477fdfbbe9e4',
  },
  '20260323_v8_planning_execution_visibility.sql': {
    stored: '2cd0be7ae698f7d6',
    current: 'e81b6f4249fc6355',
  },
  '20260323_v8_pm_sync_truth_operator_recovery.sql': {
    stored: '3de44df75f072e87',
    current: 'f594474cbaa560d0',
  },
  '20260323_v8_reports_output_runtime.sql': {
    stored: '5cee2671b45f14f2',
    current: '355513aca7c3025e',
  },
  '20260323_v8_reports_pres_model.sql': { stored: '05467d2a42f29e04', current: 'fcb46802ee273a12' },
  '20260323_v8_results_runtime.sql': { stored: '38105feaa86bb20f', current: '2c5299d3dc7992f5' },
  '20260323_v8_source_truth_lifecycle.sql': {
    stored: '7bd2e65a633210ac',
    current: 'c2604f24f072ffc2',
  },
  '20260323_v8_tool_governance_enforcement.sql': {
    stored: 'db32d052593649d2',
    current: 'd14297d218333dbe',
  },
  '20260323_v8_trust_audit_provenance.sql': {
    stored: '60cf76c6c4597acb',
    current: 'd7d0e56c3ec0ce35',
  },
  '20260323_v8_version_replay_runtime.sql': {
    stored: 'd0149d1e4169fee9',
    current: '860bfcecb8707f8c',
  },
  '20260327_partner_owned_payout_settings.sql': {
    stored: '2c2804bd5eb5c1c1',
    current: '12e73417c22f8abe',
  },
  '20260330_p25b_kb_next_action_and_primers.sql': {
    stored: '9f23ba2b318ca541',
    current: 'f5acf17b1ad060b3',
  },
  '20260331_p26b_kb_collections_tags_surfaces.sql': {
    stored: 'dfbf605897372a13',
    current: '3c81dbfc4b796275',
  },
  '20260331_p28_workbench_p29_partner_program_ledger.sql': {
    stored: '8662c1ce32d8679a',
    current: 'a3a9e54337cb453e',
  },
  '20260331_p35b_canonical_model_completion.sql': {
    stored: '50bcc34793b78f58',
    current: '3423d8bd5f1fadc3',
  },
  '20260331_v8_mindmap_nodes_p12b.sql': { stored: '5784afc4a1174b1d', current: '034aa65953c09c5b' },
  '20260402_llm_providers_vector_dbr77.sql': {
    stored: 'e13a38cfa9e58ca8',
    current: '2c09cb3b899703a8',
  },
  '20260409_fix_virtual_workers_postgres.sql': {
    stored: '5dcb9a29bd7bc07a',
    current: '63c97cb59133f167',
  },
  '20260409_p17c_artifact_runs_cancelled_status.sql': {
    stored: '93cebee1919b03d3',
    current: '1dac5a6356ed7525',
  },
  '20260409_p25d_help_seed_and_lifecycle.sql': {
    stored: 'd299bf66c6c2b0ab',
    current: '4a35fe9a560f72d5',
  },
  '20260409_p26_kb_fts5_search.sql': {
    stored: '2d02d7d75e90c8d2',
    current: '0647b8f4c05a6598',
  },
  '20260411_p01_workflow_policy.sql': { stored: '6630cbec686d185d', current: '1de83a93e6c67d7c' },
  '20260411_consultify_partner_kb_seed.sql': {
    stored: '691568dbf8bc3b8f',
    current: 'be5a2523f8bee2da',
  },
  '20260411_p11_status_history_org_id_backfill.sql': {
    stored: '4b7da5902c4329ff',
    current: 'f513d458cea1fb04',
  },
  '20260411_p28_definition_versions.sql': {
    stored: '558f1f415a2dbfa1',
    current: '2e8abd8eb8ec30c5',
  },
  '20260411_p30d_organization_type_and_new_fields.sql': {
    stored: 'fe4c4d75e94841e2',
    current: '65afa38710fb90a4',
  },
  '20260411_partner_certification_v2.sql': {
    stored: '1cef84512d5990f3',
    current: 'e7ecfe5ba06879fd',
  },
  '20260411_tp_record_comments_mentions.sql': {
    stored: 'de45a653577c491e',
    current: 'be3c433d4d5bbfda',
  },
  '20260411_v8_calendar_interop_p02d_bridge.sql': {
    stored: 'a6b8920a3ed3a842',
    current: '42f94440617cae7d',
  },
  '20260411_v8_calendar_items_extended_itemtype.sql': {
    stored: '0f6651811aba90e7',
    current: 'b834db3e3b541bf8',
  },
  '20260411_v8_p03d_manager_lane_tables.sql': {
    stored: 'd4994c85a2985024',
    current: '6d7558c11536588f',
  },
  '20260411_v8_p03e_forecast_columns.sql': {
    stored: '9cadf0ccdccb70c6',
    current: 'a9ff0d5a00173b57',
  },
  '20260412_kb_promote_consultify_lanes.sql': {
    stored: '313436d3c9433010',
    current: 'efc5fedf44c3dea4',
  },
  '20260412_organization_switch_log.sql': {
    stored: '82248ac3838ee046',
    current: '7d9a503f7988e727',
  },
  '20260412_performance_indexes.sql': { stored: '94ea07da6cd82890', current: '956a434d7fdb4fba' },
  '20260412_seed_business_templates.sql': {
    stored: '34e3fa0cec814d09',
    current: '2a575df4d4cc517d',
  },
  '20260502_canvas_content_contract.sql': {
    stored: 'a7b4246356c8d5cd',
    current: '2284dc30a267f0c5',
  },
  '20260508_block_a_template_lifecycle.sql': {
    stored: '321f9398bf479c22',
    current: '6770c511adeeea13',
  },
  '20260508_block_b_record_provenance.sql': {
    stored: '8eccabb700dbd814',
    current: '0d8754e1235ec0ad',
  },
  '20260508_block_c_ai_operator.sql': { stored: '828716f8d06609f8', current: 'dc0a1da0297d9497' },
  '20260509_block_c_qa_engine.sql': { stored: '36fb3a4cfa0088a6', current: 'b128a83ca6b9a887' },
  '20260510_block_c_source_pack.sql': { stored: '7fb7186d6985c553', current: '7fca6f31685b28bd' },
  '20260512_block_d_table_conversions.sql': {
    stored: '91b5e4a64e310ff4',
    current: '5ddb79d81bf4216f',
  },
  '20260513_block_d_form_intake.sql': { stored: 'fd9132abbca790b1', current: '39ebbb16de80b459' },
  '20260604_collab_sessions_duration.sql': {
    stored: 'd5b1be720560b015',
    current: 'eaed30a802a37dc2',
  },
  '20260608_megatrends_seed.sql': {
    stored: 'e072d9b6f62460e6',
    current: 'd390d7fe14d6ef02',
  },
  '20260611_my_idea_map_snapshots_and_activity.sql': {
    stored: 'd6e7b86bc8514598',
    current: '7d08e60f4ea10393',
  },
  '20260623_distribution_delivery.sql': [
    { stored: 'afb449dbaf10f409', current: '947a918d7445c294' },
    { stored: '7712332cdc298d49', current: '947a918d7445c294' },
  ],
  '20260623_raid_assumption_issue.sql': { stored: '9d44483e49c782a6', current: 'efde02c1e44a9671' },
  '20260624_finance_analysis_investment_category.sql': {
    stored: 'f2f3a0704a888827',
    current: '48e083f29e5ce1e8',
  },
  '20260624_initiative_column_dedup.sql': {
    stored: 'f93964c6f9c34a55',
    current: 'b2deb8b58871c513',
  },
  '20260628_ensure_digitization_analyses.sql': {
    stored: '5a7c2dc918223e3b',
    current: '8a05ca9e15782ee5',
  },
  '20260628_finance_seed_readiness_fix.sql': {
    stored: '46fbcbcd9ee9a7c4',
    current: '101ed6effda1b204',
  },
  '20260624_kpi_kind_lineage.sql': { stored: '92f571881ea2455b', current: 'd5e4641889d801a2' },
  '20260719_baseline_gap.sql': { stored: '64fd2d7808258e5d', current: '232178c1e69ab6af' },
  '20260803_res010_kpi_scorecards.sql': { stored: '4664886cee3c4763', current: '109cfdb42ec1cef5' },
  '725_module_sync.sql': { stored: '79db562130016782', current: '89a77480dbecff92' },
  '726_table_dependency_config.sql': { stored: '5b870ce22d8a3e8b', current: '038e5bc45eafe1f1' },
  '729_fix_boolean_columns.sql': { stored: '86ed3610cea092de', current: 'e83758b9fe4117da' },
  '730_beta_schema_fixes.sql': { stored: '4c593be43195592c', current: '048cc1822527abf9' },
  '730_partner_users_uuid_columns.sql': { stored: '9364461aec6b0c0a', current: 'eec2e7dcab85898a' },
  '731_tasks_missing_columns.sql': { stored: 'd0c784a4ce7d1b52', current: '8f4a3c592bcddb0c' },
  '737_virtual_workers.sql': { stored: 'a998246ab89e9a08', current: '0715ac5d38df2cfd' },
  '750_v4_results_enterprise_runtime_completion.sql': {
    stored: 'dc488f64ace609f5',
    current: '44611148dfcbcfa7',
  },
  '752_p20_deck_version_and_history.sql': {
    stored: 'a76883f7d0b4fc88',
    current: 'ab59da4557881b18',
  },
  '760_presentation_legacy_normalization.sql': {
    stored: '82970d38da3959f8',
    current: 'f06afe73c1517dca',
  },
  '761_presentation_runtime_events.sql': {
    stored: 'dc5edf32cc5d4222',
    current: 'fef86d9433aba19a',
  },
  '753_p10_interview_insight_artifact.sql': {
    stored: '57751e37cd842049',
    current: 'e787f48f4c37eb3d',
  },
  '765_presentation_governance_subscriber_tokens.sql': {
    stored: 'd5a003a592d93ca9',
    current: 'bbe96ab217bb0e7b',
  },
  '767_presentation_template_governance.sql': {
    stored: 'bbcfbd2e3680f1d8',
    current: '0275674e87e8abf6',
  },
  '771_demo_mock_seed_cleanup.sql': {
    stored: '1f26ddd1cdfd9d91',
    current: '3ee78d938ffd1a86',
  },
  '797_user_sessions_missing_columns.sql': {
    stored: '514a8fd88eaddc59',
    current: 'fb44072d9e737ce7',
  },
});
