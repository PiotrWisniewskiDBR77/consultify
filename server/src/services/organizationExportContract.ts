import { ORGANIZATION_EXPORT_MVP_TABLES } from './organizationExportMvpContract.js';

/** Explicit export authorization. Catalog discovery never grants permission. */
export interface OrganizationExportTableContract {
  schema: 'public' | 'v8';
  table: string;
  category: 'EXPORT' | 'EXCLUDE_SECURITY' | 'UNRESOLVED';
  columnTypes: Record<string, string>;
  primaryKey: string[];
  foreignKeys: Array<{
    columns: string[];
    parentSchema: string;
    parentTable: string;
    parentColumns: string[];
    deleteAction: string;
  }>;
  ownerColumn?: string;
  ownerVia?: {
    parentSchema: string;
    parentTable: string;
    childColumn: string;
    parentColumn: string;
  };
  counterpartyColumns: string[];
  projection: string[];
  excludedColumns: string[];
  source: string;
}
export const ORGANIZATION_EXPORT_POLICY_VERSION = 'tenant-export-contract-v4-20260912';
// Original inventory: 1802 public +121 v8; 1 EXPORT /4 EXCLUDE_SECURITY /1918 UNRESOLVED.
// Unlisted relations remain UNRESOLVED; a new migration cannot silently authorize export.
export const ORGANIZATION_EXPORT_TABLES: readonly OrganizationExportTableContract[] = [
  ...ORGANIZATION_EXPORT_MVP_TABLES,
  {
    schema: 'public',
    table: 'organizations',
    category: 'EXPORT',
    columnTypes: {
      id: 'text',
      name: 'text',
      plan: 'text',
      status: 'text',
      created_at: 'timestamp with time zone',
      valid_until: 'timestamp with time zone',
      industry: 'text',
      active_llm_provider_id: 'text',
      discount_percent: 'integer',
      organization_type: 'text',
      is_active: 'integer',
      trial_started_at: 'timestamp with time zone',
      trial_expires_at: 'timestamp with time zone',
      billing_status: 'text',
      token_balance: 'integer',
      billing_currency: 'text',
      billing_country: 'text',
      vat_number: 'text',
      tax_exempt: 'boolean',
      onboarding_status: 'text',
      onboarding_plan_snapshot: 'text',
      onboarding_plan_version: 'integer',
      onboarding_accepted_at: 'timestamp without time zone',
      transformation_context: 'text',
      domain: 'text',
      payment_status: 'text',
      dunning_stage: 'integer',
      dunning_started_at: 'timestamp with time zone',
      suspension_scheduled_at: 'timestamp with time zone',
      suspension_reason: 'text',
      stripe_customer_id: 'text',
      last_payment_attempt_at: 'timestamp with time zone',
      last_successful_payment_at: 'timestamp with time zone',
      trial_tokens_used: 'integer',
      updated_at: 'timestamp without time zone',
      owner_id: 'text',
      trial_exports_used: 'integer',
      trial_share_links_used: 'integer',
      default_language: 'text',
      default_timezone: 'text',
      mfa_required: 'integer',
      mfa_grace_period_days: 'integer',
      logo_url: 'text',
      branding_primary_color: 'text',
      branding_accent_color: 'text',
      monthly_budget_usd: 'real',
      budget_spent_current_period: 'real',
      budget_alert_threshold: 'real',
      budget_period_start: 'timestamp without time zone',
      memory_usage_mb_current: 'integer',
      cpu_usage_percent_avg: 'real',
      created_by_user_id: 'text',
      ai_assertiveness_level: 'text',
      ai_autonomy_level: 'text',
      attribution_data: 'text',
      mfa_required_since: 'timestamp without time zone',
      trial_extension_count: 'integer',
      trial_warning_sent_at: 'timestamp without time zone',
      onboarding_accept_idempotency_key: 'text',
    },
    primaryKey: ['id'],
    foreignKeys: [
      {
        columns: ['owner_id'],
        parentSchema: 'public',
        parentTable: 'users',
        parentColumns: ['id'],
        deleteAction: 'NO ACTION',
      },
    ],
    ownerColumn: 'id',
    counterpartyColumns: [],
    projection: [
      'id',
      'name',
      'plan',
      'status',
      'created_at',
      'valid_until',
      'industry',
      'active_llm_provider_id',
      'discount_percent',
      'organization_type',
      'is_active',
      'trial_started_at',
      'trial_expires_at',
      'billing_status',
      'billing_currency',
      'billing_country',
      'vat_number',
      'tax_exempt',
      'onboarding_status',
      'onboarding_plan_snapshot',
      'onboarding_plan_version',
      'onboarding_accepted_at',
      'transformation_context',
      'domain',
      'payment_status',
      'dunning_stage',
      'dunning_started_at',
      'suspension_scheduled_at',
      'suspension_reason',
      'stripe_customer_id',
      'last_payment_attempt_at',
      'last_successful_payment_at',
      'updated_at',
      'owner_id',
      'trial_exports_used',
      'trial_share_links_used',
      'default_language',
      'default_timezone',
      'logo_url',
      'branding_primary_color',
      'branding_accent_color',
      'monthly_budget_usd',
      'budget_spent_current_period',
      'budget_alert_threshold',
      'budget_period_start',
      'memory_usage_mb_current',
      'cpu_usage_percent_avg',
      'created_by_user_id',
      'ai_assertiveness_level',
      'ai_autonomy_level',
      'attribution_data',
      'trial_extension_count',
      'trial_warning_sent_at',
      'onboarding_accept_idempotency_key',
    ],
    excludedColumns: [
      'token_balance',
      'trial_tokens_used',
      'mfa_required',
      'mfa_grace_period_days',
      'mfa_required_since',
    ],
    source:
      'organizationLifecycleService.ts:assertNotReservedOrganizationId; C6_EXPORT_TABLE_CONTRACT.json public.organizations tenant root',
  },
  ...['api_keys', 'integration_secrets', 'refresh_tokens', 'user_sessions'].map(
    (table): OrganizationExportTableContract => ({
      schema: 'public',
      table,
      category: 'EXCLUDE_SECURITY',
      columnTypes: {},
      primaryKey: [],
      foreignKeys: [],
      counterpartyColumns: [],
      projection: [],
      excludedColumns: [],
      source: `C6_EXPORT_TABLE_CONTRACT.json public.${table} security exclusion`,
    })
  ),
];
