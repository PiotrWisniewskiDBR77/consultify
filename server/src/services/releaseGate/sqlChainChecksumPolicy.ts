/**
 * SQL-chain checksum policy for the release migration gate.
 *
 * WHY THIS EXISTS
 * ---------------
 * `server/scripts/migrate.postgres.ts` records a sha256 per migration but, until the
 * integration foundation wave, never read it back. Demo therefore accumulated migrations whose
 * file bytes changed in git AFTER they were applied. A forensic pass (2026-08-13, read-only
 * against demo) classified every one of them.
 *
 * This module is the ONLY place where such a historical variant may be accepted, and it is
 * deliberately strict:
 *
 *   - Acceptance requires filename + EXACT stored checksum + EXACT current checksum.
 *     A filename-only rule would silently accept any future rewrite of that file, and would not
 *     distinguish the safe files below from the ones proven to still carry a real schema gap.
 *   - Every entry was proven by locating the exact git commit whose blob hashes to the stored
 *     value. No entry is here on inference.
 *   - Files with a CONFIRMED live schema gap are deliberately ABSENT. Grandfathering them would
 *     mark them "already applied" and permanently strand the columns their newer version adds.
 *     They are fixed by forward repair migrations instead.
 *
 * DELIBERATELY EXCLUDED (do not add without a new forensic pass + CTO decision):
 *   730_partner_users_uuid_columns.sql        -> SCHEMA_ATTESTED_LEGACY_VARIANT (see below)
 *   20260628_initiative_core_section_prompts  -> DML gap; NO_REPAIR_NEEDED (the app ships
 *                                                CORE_FALLBACK_PROMPTS.raid, which engages
 *                                                automatically), so nothing to approve.
 *
 * 520, 700 and 000_z_core_baseline ARE listed below, but ONLY because their confirmed schema
 * gaps are now closed by the 20260813_repair_* forward migrations. Approving a drifted file
 * before its repair exists would permanently strand the columns its newer version adds.
 */

export type ChecksumVerdict =
  | 'MATCH'
  | 'APPROVED_HISTORICAL_VARIANT'
  | 'SCHEMA_ATTESTED_LEGACY_VARIANT'
  | 'DRIFT';

export interface ApprovedVariant {
  /** exact sha256 recorded in schema_migrations on the environment that applied it */
  stored: string;
  /** exact sha256 of the file as it exists in the tree today */
  current: string;
}

/**
 * filename -> the ONE approved (stored, current) pair.
 * Both halves must match exactly; any other combination is DRIFT.
 */
export const APPROVED_SQL_CHAIN_VARIANTS: Readonly<Record<string, ApprovedVariant>> = Object.freeze({
  '20260127_pmo_task_fields.sql': {
    stored: '3c826aa199b5b449a2a5d1e3922b8a30b50459b1300808045d428e3458989553',
    current: '80fcccdd05d45c95916c537249dd3e19643b6343d77df52858be0d45de663d5b',
  },
  '20260128_task_notification_rules.sql': {
    stored: '12bb16f4387259987877763bcb644930efc78eb1b81c20b5f40781114a0c57c9',
    current: 'a9b5ac3ceb84c1d44961042e0b8c29d51b2a922cd43d0d8f265275e6a7bdf708',
  },
  '20260128_task_overdue_notifications.sql': {
    stored: '1978f6b03f77fe3bad3a45d08cc4def5f5caeaf93e954e4d6cef492e820a3201',
    current: '1ad2f41d70d8f2daf70eae9b2b614af608e5b4fe0dbb4be700c9462b42d08e4e',
  },
  '20260213_task_source_origin.sql': {
    stored: 'cccdd95deb254c7c2d8a3ced295f9ce11d58d1e479c3b34f041cf235ce6b81f7',
    current: '3a48f93ad30c262c8fdb3e094dc74cf79c2ea25b11a79065aeeaab5665ff2228',
  },
  '20260222_interview_conversational_inference.sql': {
    stored: '552b3596cd73f03d06c3981aa988130c0b96039877beb9941ad63c0caa370028',
    current: '7cebd37b30d3f9c7886d55b1ff59e2c09ff42ee16627c34cbd601c279dd6fe9c',
  },
  '20260223_competency_taxonomy.sql': {
    stored: '498eeeeeed4fb09185d791c56990b9ff7a510ba82f194dec77c1cbee85efd7bf',
    current: 'b038612e51e3f8a07b176912077794c673b6d86ce2cfafcc56ae3f387ba69a99',
  },
  '20260228_budget_initiative_links.sql': {
    stored: '7826f403a14163b1016ed54e110366716c4bc9fae64b3eacf0b4aaefd32cd6c1',
    current: '50e3c21219cae7843026fe38d804b9908988ffd9b4743f08f6c9790871dfd59b',
  },
  '20260228_financial_model_versions.sql': {
    stored: 'd8c532865f46011f88b1e304e71eff2485954915055d9e5a3815018771dd7ee9',
    current: '3074dc0e589f6d97e39056d8fcb9276cd5acad2a498853a8c8c7a6c5e672a1a9',
  },
  '20260303_feedback_behavior_t106_t113.sql': {
    stored: '498a662b68a2313b05f44319eab2b7bbaded2b83b7c205d4646099f3c02b67db',
    current: '71b158de25f67e9e6729401660e68578d37b9c72b254cc3ef9b8381276f23a87',
  },
  '20260304_feedback_items_canonical_tickets.sql': {
    stored: '79e27f6fa4c91cf4203275a561f533a887eb2f396da4e50f178b99e3b1c007f3',
    current: '0ca78bd5c5f9cb2ba90288bed282d941917d0672d998fc408d59006853330fd5',
  },
  '20260311_origin_tracking.sql': {
    stored: 'a7172fcff85ff6988f995713df12d71ed73620c763c9fd65caac72195957a140',
    current: '938c8bf5582eabf79ed93e9d8c3f1fc32a29f47d253cfaff26ae8b4173081090',
  },
  '20260314_presentation_decks_deck_json.sql': {
    stored: '7db981177509e44de40b5d3721cee29ddc7a6c5f0f7cbc532da3bc6a07163de9',
    current: '002810e1ad5a85b684dcc99d7b2bea4c4744633b968059568fc257b46f2821f6',
  },
  '20260316_financial_statement_packs.sql': {
    stored: '67b02166371cd93badb04cb9f514f4c94bae9d37ccd8616669202b027626a426',
    current: 'f276ca048cb5c3fc53b8105654a01c59ab0121b7ad0d57dc0e42c9642ed04708',
  },
  '513_initiative_card_scope_templates.sql': {
    stored: '07d870364941faa8639c638b726c3e1623e06999ed08f7c86746690e6e1a3db0',
    current: '1494a8fd8b692897e662f59a2e9c4c9f5846c316116e3a1465568eb7ffe5ab65',
  },
  '515_team_chat_projects.sql': {
    stored: '1d58c7c67eb2184fce95a223f2216142ad4910fa414b6b9d08444b96207ded76',
    current: 'b688dce15f9b2d7e33acbd5af6a61b5fe0fc4e247b0ba4d1e0d4c14c05dbdc5d',
  },
  '534_notification_enhancements.sql': {
    stored: '1fad6f3f5860be044ecec4145e09f5d975d545fd330f54d70374ffb40b94638b',
    current: '13a762728bd2eb8d9d31f3cdd1c13a35c58ae2f240f4445a9e84819852616764',
  },
  '543_initiative_resource_tables.sql': {
    stored: '13d0a42e71ccede52dec513ca16547e8ec59161c67179c6312158ce55eb0f4e1',
    current: '7673ea4b4cac8416075aa1384f1b90be7e6cafb7d790d17e1eff3fac145ccb96',
  },
  '561_execution_control_t039_t040.sql': {
    stored: '6ced0159a7498f09818e71d78a9b4ad133f95717b6398b5db706541c032cd02d',
    current: '8f316c55438fbca5678a9cfbdeb78a05ad11e9a7ecfa501127aa180a9acfee0f',
  },
  '565_kpi_time_series_roi_attribution_finance.sql': {
    stored: 'ca63659e21074caf95c2ae5f187978865820f5604b38e24ebe4749b27381381b',
    current: '33c36f24e087712c7f088206ab735ec6560817a9441be772943d88d3af0923a4',
  },
  '570_finance_analysis_budgeting_t052_t053.sql': {
    stored: 'b36ab064cdd392be478fd999e926dc67c0dbe39de2e3adaf7f2de9968ba2a6c4',
    current: 'e0a107fbe20563958addd6f04ba99c401efb18409998942d3e84461f3ed42726',
  },
  '575_interview_sendback_missing_items.sql': {
    stored: '659eaf8a81adc61642781ff435516cc6572f26ee5a15c60561dc10597d76baa3',
    current: '9ae9385cd57b9f97d59e3494c4ead3bc9e5abacff307c22cf6bac4763712effe',
  },
  '578_llm_logs_compat_columns.sql': {
    stored: 'c5faaf3e72b3d61506ae83db606df257fdde24aa894e7658fb0dc0aa0d8ca4b2',
    current: 'bc9faa89c425fd922b20fd9aeeef44dbff3c2df81a571ce3ae205846505470fd',
  },
  '704_forms.sql': {
    stored: '8dc9c413c96dd0ec6d9dc93ed6393a192bbc67014edaa9d529a8f85ffe04a0a2',
    current: '9bc702478ab9d26c42385256fceacfe5bea6c7ba126a42b985c483def94fc551',
  },
  '727_beta_missing_tables.sql': {
    stored: 'a96fa80041fd89000c08636f33cdc22d45f462341bff31b57405af962cd88560',
    current: 'e27bc8a583b3524980dc58ff5fea8a36a5fa618b3298f190282b25b20f3a474b',
  },
  '914_okr_management.sql': {
    stored: 'd38760252fd78adf2e42ea493674103b6a40aa91eff31bdeacd6b69067968ba5',
    current: '2363ff101ca6d7e6b73f41735dd6b30ca60cf1be4d94c2aa1b3f6acb5a333622',
  },
  // MANUAL REVIEW CLOSED 2026-08-13. Semantic difference: the current file declares
  // created_at/updated_at as TIMESTAMPTZ while demo has TEXT (verified read-only). That
  // divergence sits inside CREATE TABLE IF NOT EXISTS, so the newer version could never
  // convert an existing table — approving loses nothing. The TEXT/TIMESTAMPTZ divergence is
  // pre-existing and NOT closable by this migration; converting it needs its own approved
  // migration. Additive tables (workstreams, project_members) verified present on demo.
  '542_project_members_consultant_overlay_and_steering_board.sql': {
    stored: 'ac3f23b321115b0ed1a8aaccbf02fb9519651542ea0342751907e6dd57a664e2',
    current: '0ff1cd5abfcf04fac1d54550923e46bcf89967098596067662c040dc80879df9',
  },
  // MANUAL REVIEW CLOSED 2026-08-13. The current file compares COALESCE(is_active, TRUE) =
  // FALSE, but demo's api_keys.is_active is INTEGER (verified read-only), so the current
  // logic would ERROR if replayed there. Approving is the SAFE outcome precisely because an
  // approved file is never re-run. DO NOT 'fix drift by re-running' this migration.
  '548_audit_log_api_keys_compatibility.sql': {
    stored: '52c82dd3dc139ab1f174e54277f0473ce9b00e9f31995d9e4d180e56f69af30a',
    current: '0b0482d63f986052fd6c26e75119080492b5d9a18f3e215df879830f3a7d7a86',
  },
  // MANUAL REVIEW CLOSED 2026-08-13. The historical version demo ran declares
  // communication_plans.id UUID (demo has uuid — matches). The current version deliberately
  // declares TEXT so a FRESH replay's FK does not fail; on demo that CREATE is a no-op. The
  // change only affects fresh installs, which is exactly where it runs. No gap on demo.
  '573_people_change_comms_t043_t044_t045.sql': {
    stored: '1975869857dcb91a41651fff219e0ed6839c2d3b8c9f554206ece15b9f22e6ef',
    current: '7ccf7c15df4195f29f5b4303d7e7ea7741c3428c496fd4146a230b551c56b5eb',
  },
  // MANUAL REVIEW CLOSED 2026-08-13 — approved ONLY because the gap is now repaired.
  // 29 columns the newer version adds were confirmed missing on demo. They are delivered by
  // forward repairs 20260813_repair_c1/c2/c3, so approving this checksum no longer hides
  // anything. Never approve a drifted baseline before its repair migrations exist.
  '000_z_core_baseline.sql': {
    stored: '593c19c74f986e8f07e2153de665a72ef8f7fdbec1c862238e473be8ac1f78bf',
    current: '48fcc5700598125b0623af9a544dca78743100d88d2e3f61bcac54ebfad62e72',
  },
  // Approved ONLY because 20260813_repair_a_ai_instruction_suggestions.sql now delivers the
  // suggested_instruction/confidence_score columns the newer version adds.
  '520_ai_enterprise_tables.sql': {
    stored: 'db5f219588a4a95b5f276568d23a91e538650ff60d05b45b6444a98609beacd0',
    current: 'e59d960ed53e626cbb97669ead5e9a100aaba1af4438338947bc349622cbb2e0',
  },
  // Approved ONLY because 20260813_repair_b_tp_schema_proposals_level.sql now delivers the
  // level column, its CHECK and its index.
  '700_table_platform_foundation.sql': {
    stored: 'b7bfc315bb2658a1eba1fb625efb131f7e0901637a934e568f8df617ff3c155e',
    current: '052bd8e8ce6fb0431446ccb32f82a90e387b2f562563c4b6d20e605c7925a556',
  },
});

/**
 * 730_partner_users_uuid_columns.sql is NOT grandfathered.
 *
 * Its stored checksum matches no blob in git history: the file was applied to demo on
 * 2026-03-16 but first committed on 2026-03-19, so the applied bytes were never committed.
 * The resulting SCHEMA, however, is provably variant A's outcome. It may therefore be accepted
 * ONLY when the live schema is attested in the same transaction (see schemaAttestation.ts).
 */
export const SCHEMA_ATTESTED_FILENAME = '730_partner_users_uuid_columns.sql';
export const SCHEMA_ATTESTED_PAIR: ApprovedVariant = Object.freeze({
  stored: '15759c8f09e3cb6d985c17bfce36bac0eb9d7f2c675bf2686915e12751e94873',
  current: 'eec2e7dcab85898a209faca029a5e5073b43781311099382e9a2cca038bf7175',
});

/**
 * Pure classification. Does NOT perform schema attestation — the caller must do that for
 * SCHEMA_ATTESTED_LEGACY_VARIANT before treating it as acceptable.
 */
export function classifySqlChainChecksum(
  filename: string,
  storedChecksum: string | null | undefined,
  currentChecksum: string
): ChecksumVerdict {
  if (!storedChecksum) return 'DRIFT';
  if (storedChecksum === currentChecksum) return 'MATCH';

  if (filename === SCHEMA_ATTESTED_FILENAME) {
    return storedChecksum === SCHEMA_ATTESTED_PAIR.stored &&
      currentChecksum === SCHEMA_ATTESTED_PAIR.current
      ? 'SCHEMA_ATTESTED_LEGACY_VARIANT'
      : 'DRIFT';
  }

  const approved = APPROVED_SQL_CHAIN_VARIANTS[filename];
  if (!approved) return 'DRIFT';
  return approved.stored === storedChecksum && approved.current === currentChecksum
    ? 'APPROVED_HISTORICAL_VARIANT'
    : 'DRIFT';
}
