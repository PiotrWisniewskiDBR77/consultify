# Database Migration History

## Overview

This document tracks all database schema migrations applied to the Consultinity platform. Each migration represents a specific change to the database structure, from initial setup through enterprise features.

## Migration Status

**Total Migrations**: 142  
**Tracking System**: Implemented January 6, 2026  
**Last Migration**: 210_stripe_production.sql.sql

## Migration Timeline

### Phase 0: Foundation (001-010)

- **001_upgrade_tasks** - Enhanced task management with progress tracking
- **002_add_task_progress** - Task progress indicators
- **003_add_initiative_progress** - Initiative tracking
- **004_project_notification_settings** - Project-level notifications
- **005_ai_explainability** - AI decision transparency
- **006_ai_evidence_ledger** - AI audit trail
- **007_rapidlean_observations** - Rapid assessment observations
- **010_assessment_workflow** - Assessment engine

### Phase 1: Core Platform (011-050)

- **011_initiative_generator** - Initiative creation engine
- **014_governance_enterprise** - Enterprise governance
- **015_enterprise_customers_module** - Customer management (28KB - major migration)
- **016_organization_skeleton** - Multi-tenant foundation
- **017_consultant_mode** - Consultant access patterns
- **018_access_codes_engine** - Access control system
- **018_token_ledger** - Token tracking
- **019_audit_events** - Comprehensive audit logging
- **020_trial_limits** - Trial account limitations
- **021_trial_entry_status** - Trial lifecycle management
- **022_phase_g_referrals** - Referral system
- **023_user_state_machine** - User journey states
- **025_ai_actions_complete** - AI action framework (10KB - major)
- **026_mfa_infrastructure** - Multi-factor authentication
- **027_email_verification** - Email verification system
- **028_refresh_tokens** - Token refresh mechanism
- **029_dunning_system** - Payment recovery
- **029_journey_analytics** - User journey tracking
- **030_multi_currency** - Multi-currency support
- **030_user_goals** - User goal tracking
- **031_gamification** - Gamification engine
- **031_performance_indexes** - Performance optimization (4.7KB)
- **031_prompt_versioning** - AI prompt management
- **032_analytics** - Analytics foundation
- **032_sso_configuration** - Single sign-on
- **033_user_preferences** - User preferences
- **034_outbound_webhooks** - Webhook system
- **035_gdpr_requests** - GDPR compliance
- **036_feature_flags** - Feature flag system
- **037_log_correlation** - Log correlation IDs
- **038_budget_hardening** - Budget validation
- **039_initiative_report_tracking** - Report tracking
- **040_initiative_roadmap_columns** - Roadmap features
- **041_report_sections** - Report builder (5.7KB)
- **042_multi_framework_assessment** - Multi-framework support (11.6KB - major)
- **042_pmo_roles_workstreams** - PMO structure (8KB)
- **043_multi_framework_assessments_complete** - Framework completion (12.6KB - major)
- **043_security_policies** - Security policy engine (6KB)
- **044_api_keys** - API key management (5KB)
- **044_multi_framework_audit** - Framework audit (10.6KB - major)
- **045_branding** - Organization branding (6.1KB)
- **045_initiative_templates** - Initiative templates
- **046_compliance** - Compliance framework (12.3KB - major)
- **047_content_module_enterprise** - Content management (22.9KB - MAJOR)
- **048_content_module_permissions** - Content permissions (8.6KB)
- **050_area_assessments** - Area-based assessments (12.1KB - major)
- **050_organization_profiles** - Organization profiles (9.6KB)

### Phase 2: AI & Intelligence (051-080)

- **051_memory_system** - AI memory system (8.2KB)
- **051_report_comments** - Report collaboration (5.2KB)
- **052_ab_testing** - A/B testing framework (5.5KB)
- **053_learning_system** - AI learning system (5.4KB)
- **055_security_module** - Security module (7.4KB)
- **060_digitization_analyses** - Digital transformation analysis
- **060_work_dimensions** - Work dimension tracking (27.1KB - MAJOR)
- **061_digitization_versioning** - Version control (7.8KB)
- **061_initiative_lifecycle** - Initiative lifecycle (5.4KB)
- **062_management_reports** - Management reporting (6.4KB)
- **063_project_kpis** - KPI tracking (5.3KB)
- **063_raid_items** - RAID log
- **064_execution_stages** - Execution phases
- **064_management_reports_enterprise** - Enterprise reporting (9.9KB)
- **065_budget_tracking** - Budget management (4.8KB)
- **065_report_templates** - Report templates (7.9KB)
- **066_status_reports** - Status reporting (5KB)
- **067_economics_initiative_integration** - Economic analysis (11KB - major)
- **070_help_feedback** - Help system (7.1KB)
- **071_create_metrics_snapshots** - Metrics snapshots
- **072_project_intelligence** - Project intelligence
- **073_conversations** - AI conversations (5.5KB)
- **074_pinned_prompts** - Prompt pinning
- **075_ai_user_memory** - User-specific AI memory
- **076_ai_self_learning_enhanced** - Enhanced learning (3.9KB)
- **080_prompt_templates** - Prompt template system (20.2KB - MAJOR)
- **080_user_settings_extended** - Extended settings (7KB)

### Phase 3: Enterprise Features (081-150)

- **081_studio_tables** - Studio features (6.4KB)
- **090_ai_settings_system** - AI configuration (5.8KB)
- **090_feedback_enhancements** - Feedback improvements
- **091_payment_methods** - Payment method management (3.8KB)
- **092_enhance_projects** - Project enhancements
- **099_create_email_tables** - Email system
- **100_owner_role** - Owner role permissions
- **100_owner_role_postgres** - PostgreSQL owner role
- **101_security_sessions** - Session security
- **101_security_sessions_postgres** - PostgreSQL sessions
- **105_user_integrations** - User integrations (9KB)
- **106_security_privacy_enterprise** - Enterprise security (4.9KB)
- **107_sms_mfa** - SMS-based MFA (2.8KB)
- **110_workspace_defaults** - Workspace defaults
- **120_settings_enhancement_tables** - Settings enhancements
- **125_settings_seed_data** - Settings seed data (3.5KB)
- **126_settings_complete_tables** - Complete settings (8KB)
- **127_consultant_project_access** - Consultant access (2.8KB)
- **127_user_profile_extensions** - Profile extensions
- **128_notification_extensions** - Notification enhancements
- **128_user_contact_information** - Contact information (3.9KB)
- **129_ai_preferences_extensions** - AI preferences
- **129_user_availability** - Availability tracking
- **130_profile_settings_enhancement** - Profile enhancements (6.7KB)
- **130_security_extensions** - Security extensions
- **130_user_achievements** - Achievement system
- **130_user_profile_extended** - Extended profiles (6.7KB)
- **131_integrations_extensions** - Integration extensions
- **131_settings_preferences_extended** - Extended preferences (10.5KB - major)
- **132_appearance_extensions** - Appearance customization
- **133_work_productivity_preferences** - Productivity settings (2.8KB)
- **134_advanced_security** - Advanced security (9.7KB)
- **140_settings_advanced_features** - Advanced features (3.4KB)
- **150_billing_phase2** - Billing Phase 2 (17.1KB - MAJOR)

### Phase 4: Production Hardening (160-210)

- **160_configuration_enhancements** - Configuration improvements (11.3KB - major)
- **200_security_mvp_enterprise** - Security MVP (29.2KB - MAJOR)
- **201_ai_partial_responses** - Streaming responses
- **202_ai_latency_metrics** - Performance metrics
- **203_ai_memory_metrics** - Memory metrics (2.8KB)
- **204_rag_quality_metrics** - RAG quality tracking
- **205_citation_verification** - Citation verification
- **206_proactive_suggestions** - Proactive AI (2.3KB)
- **206_secret_rotation** - Secret rotation
- **207_user_ai_preferences** - AI user preferences
- **210_stripe_production** - Stripe production (12.5KB - MAJOR)

### Special Migrations

- **20251212-create-megatrends** - Megatrend tracking
- **20260101_add_profile_fields_and_permission_requests** - Profile fields (4.9KB)
- **add_chat_projects.js** - Chat project integration (JS migration)
- **add_mywork_tables.sql** - My Work module (7.7KB)
- **add_response_feedback.sql** - Response feedback (5.1KB)
- **assessment-module.sql** - Assessment module (6.9KB)
- **init-pgvector.sql** - PostgreSQL vector support (7.7KB)

## Major Migrations (>10KB)

These migrations introduced significant schema changes:

1. **200_security_mvp_enterprise** (29.2KB) - Complete security overhaul
2. **060_work_dimensions** (27.1KB) - Work dimension framework
3. **015_enterprise_customers_module** (28KB) - Customer management
4. **047_content_module_enterprise** (22.9KB) - Content management
5. **080_prompt_templates** (20.2KB) - Prompt system
6. **150_billing_phase2** (17.1KB) - Billing improvements
7. **043_multi_framework_assessments_complete** (12.6KB)
8. **046_compliance** (12.3KB)
9. **050_area_assessments** (12.1KB)
10. **042_multi_framework_assessment** (11.6KB)

## Rollback Procedures

### General Rollback Strategy

1. Create backup before rollback: `npm run db:backup`
2. Identify migration to rollback
3. Manually reverse changes (no automated rollback yet)
4. Update schema_migrations table

### Critical Migrations (No Rollback)

These migrations should NEVER be rolled back in production:

- 015_enterprise_customers_module
- 200_security_mvp_enterprise
- 150_billing_phase2
- Any migration affecting user data or billing

## Migration Best Practices

1. **Always backup before migration**: `npm run db:backup`
2. **Test on development first**: Never run untested migrations in production
3. **Review migration file**: Check SQL syntax and logic
4. **Check dependencies**: Ensure prerequisite migrations are applied
5. **Monitor execution time**: Large migrations may lock tables
6. **Verify after migration**: Run integrity checks

## Troubleshooting

### Migration Failed

```bash
# Check migration status
sqlite3 server/consultinity.db "SELECT * FROM schema_migrations WHERE status='failed';"

# Review error logs
tail -f logs/migration.log

# Restore from backup if needed
npm run db:restore
```

### Missing Migration

```bash
# Check which migrations are applied
sqlite3 server/consultinity.db "SELECT version, filename FROM schema_migrations ORDER BY version;"

# Apply missing migration
npm run db:migrate
```

### Checksum Mismatch

If a migration file was modified after being applied, the checksum will differ. This is informational only and doesn't affect functionality.

---

**Last Updated**: January 6, 2026  
**Migration System Version**: 1.0  
**Total Schema Tables**: 122
