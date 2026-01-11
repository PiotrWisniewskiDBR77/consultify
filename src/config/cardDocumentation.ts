export interface CardDocumentation {
  title: string;
  description: string;
  moduleId?: string;
  features: string[];
  howToUse: string[];
  tips: string[];
  relatedDocs?: string[];
}

export const CARD_DOCS: Record<string, CardDocumentation> = {
  // ==========================================
  // SUPERADMIN MODULES
  // ==========================================

  'superadmin-overview': {
    title: 'SuperAdmin Overview',
    description:
      'Central command center for platform administrators. Monitor system health, track key metrics, and respond to real-time signals across all organizations.',
    moduleId: 'SUPERADMIN_OVERVIEW',
    features: [
      'Real-time dashboard with key platform metrics',
      'Organization and user counts at a glance',
      'AI usage monitoring (calls, tokens, costs)',
      'Live user sessions tracking',
      'Revenue metrics (MRR, ARR estimates)',
      'Recent activity feed',
      'Conversion intelligence and funnel analytics',
      'System signals: alerts, tickets, and feedback',
    ],
    howToUse: [
      'Dashboard tab shows real-time KPIs - click cards to drill down',
      'Metrics tab provides conversion funnels and attribution data',
      'Signals tab displays system alerts, client tickets, and user feedback',
      'Click organization count to navigate to Customers module',
      'Click Revenue card to access Billing Center',
    ],
    tips: [
      'Check Signals regularly for critical system alerts',
      'Monitor conversion funnels weekly to track growth',
      'Use Early Warnings to proactively prevent churn',
      'Review Attribution data to optimize marketing spend',
    ],
    relatedDocs: ['superadmin-customers', 'superadmin-billing', 'superadmin-analytics'],
  },

  'superadmin-customers': {
    title: 'Customers Management',
    description:
      'Manage all organizations, users, lifecycle stages, playbooks, contracts, and security settings for your customers.',
    moduleId: 'SUPERADMIN_CUSTOMERS',
    features: [
      'Organization management with full CRUD operations',
      'User administration and role assignments',
      'Customer lifecycle stage tracking',
      'Playbook assignments and progress monitoring',
      'Contract management and renewals',
      'Security policies per organization',
      'Feedback collection and analysis',
      'Customer health scoring',
    ],
    howToUse: [
      'Use Organizations tab to view and manage all customer accounts',
      'Users tab allows adding, editing, and deactivating users',
      'Lifecycle tab shows customer journey stages',
      'Assign playbooks to guide customer success',
    ],
    tips: [
      'Regularly review customer health scores',
      'Set up automated lifecycle transitions',
      'Use playbooks for consistent onboarding',
    ],
    relatedDocs: ['superadmin-overview', 'superadmin-security'],
  },

  'superadmin-ai-infrastructure': {
    title: 'AI Infrastructure',
    description:
      'Configure LLM providers, model tiers, global AI settings, and monitor AI system health.',
    moduleId: 'SUPERADMIN_AI_INFRASTRUCTURE',
    features: [
      'LLM provider management (OpenAI, Anthropic, Ollama, etc.)',
      'Model tier assignments (Budget, Standard, Premium, Reasoning)',
      'Global AI settings (rate limits, token limits, fallback chains)',
      'Health monitoring with capability diagnostics',
      'Circuit breaker configuration',
      'Data residency compliance settings',
    ],
    howToUse: [
      'Add new LLM providers in LLM Providers tab',
      'Assign models to tiers based on cost/quality tradeoffs',
      'Configure global limits in Global Settings',
      'Run diagnostic tests in Health Monitoring',
    ],
    tips: [
      'Always configure fallback providers for high availability',
      'Monitor health metrics daily during initial deployment',
      'Adjust rate limits based on actual usage patterns',
    ],
    relatedDocs: ['superadmin-ai-development', 'superadmin-ai-operations'],
  },

  'superadmin-ai-development': {
    title: 'AI Development',
    description:
      'Prompt engineering, experiments (A/B), intelligence configuration, and knowledge administration.',
    moduleId: 'SUPERADMIN_AI_DEVELOPMENT',
    features: [
      'Prompt library management (system prompts + versioning)',
      'A/B testing experiments (create/start/pause/stop/archive)',
      'AI Intelligence / Co-Thinker configuration panels',
      'Knowledge Base administration (candidates, strategies, documents)',
    ],
    howToUse: [
      'Use Prompt Library to review and update system prompts (with version history)',
      'Run controlled A/B experiments before changing production prompts/models',
      'Use Knowledge Base tools to curate documents and ideas used by the AI',
    ],
    tips: [
      'Treat prompts as production code: review, version, and test changes',
      'Prefer experiments over “big bang” prompt changes',
      'Keep knowledge sources curated to avoid hallucinations and drift',
    ],
    relatedDocs: ['superadmin-ai-infrastructure', 'superadmin-ai-operations'],
  },

  'superadmin-ai-operations': {
    title: 'AI Operations',
    description:
      'Operational monitoring: mission control, performance, costs, SLA, and usage analytics.',
    moduleId: 'SUPERADMIN_AI_OPERATIONS',
    features: [
      'Mission Control (capability diagnostics)',
      'Performance metrics and trends',
      'Costs and token usage monitoring',
      'SLA monitoring and breach alerts',
      'Usage analytics (trends, models, capabilities, peak hours)',
    ],
    howToUse: [
      'Verify providers and capability diagnostics in Mission Control',
      'Monitor costs regularly and set alerts before rollout',
      'Use SLA view for uptime/latency/error budgets',
    ],
    tips: [
      'Seed demo usage logs for dry-run dashboards before client testing',
      'Investigate high error rates first: providers, keys, rate limits, network',
      'Use tier routing to optimize cost vs quality',
    ],
    relatedDocs: ['superadmin-ai-infrastructure', 'superadmin-ai-development'],
  },

  // Backward-compatible help ID used by AI Intelligence view
  'superadmin-ai-intelligence': {
    title: 'AI Intelligence',
    description:
      'Co-Thinker configuration: prompt templates, blocks, testing bench, assistant, and learning.',
    moduleId: 'SUPERADMIN_AI_DEVELOPMENT',
    features: [
      'System stats for prompt library',
      'Prompt templates editor/test bench',
      'Block builder and assistant tools',
      'Learning system overview',
    ],
    howToUse: [
      'Start from Overview to validate the system is populated',
      'Use Test Bench to validate outputs and latency before enabling changes',
    ],
    tips: [
      'Keep an approval process for high-impact prompt changes',
      'Document why a prompt changed (audit trail)',
    ],
    relatedDocs: ['superadmin-ai-development', 'superadmin-ai-infrastructure'],
  },

  'superadmin-llm-management': {
    title: 'LLM Management',
    description:
      'Configure and manage Large Language Model providers, routing rules, and monitor usage.',
    moduleId: 'SUPERADMIN_LLM_MANAGEMENT',
    features: [
      'Provider configuration with API keys',
      'Smart routing between providers',
      'Usage analytics and cost tracking',
      'Health status per provider',
      'Ollama local model integration',
    ],
    howToUse: [
      'Add providers using the Add Provider button',
      'Test connections before enabling',
      'Configure routing rules in Routing tab',
      'Monitor usage in Usage tab',
    ],
    tips: [
      'Test provider connections regularly',
      'Set up cost alerts to prevent overruns',
      'Use local Ollama models for sensitive data',
    ],
    relatedDocs: ['superadmin-ai-infrastructure'],
  },

  'superadmin-ai-global-settings': {
    title: 'Global AI Settings',
    description:
      'Platform-wide AI configuration: default provider, fallback chains, rate limits, security and compliance.',
    moduleId: 'SUPERADMIN_AI_GLOBAL_SETTINGS',
    features: [
      'Default provider selection for the platform',
      'Fallback chain configuration (ordered list of backup providers)',
      'Global rate limits (requests per minute/hour, token limits)',
      'Circuit breaker configuration (failure threshold, cooldown)',
      'PII detection sensitivity (low/medium/high)',
      'Data residency settings (EU/US/APAC/global)',
      'Encryption requirements toggle',
    ],
    howToUse: [
      'Select a default provider from configured LLM providers',
      'Add providers to fallback chain by dragging or selecting',
      'Set rate limits based on your infrastructure capacity',
      'Configure circuit breaker to auto-disable failing providers',
      'Choose PII sensitivity based on compliance requirements',
    ],
    tips: [
      'Always have at least 2 providers in the fallback chain',
      'Set conservative rate limits initially and increase as needed',
      'Match data residency settings to your regulatory requirements',
      'Test fallback behavior by temporarily disabling the primary provider',
    ],
    relatedDocs: ['superadmin-ai-infrastructure', 'superadmin-llm-management'],
  },

  'superadmin-ai-model-tiers': {
    title: 'Model Tier Assignments',
    description:
      'Assign AI models to performance tiers for intelligent routing based on task complexity.',
    moduleId: 'SUPERADMIN_AI_MODEL_TIERS',
    features: [
      'Four performance tiers: Budget, Standard, Premium, Reasoning',
      'Many-to-many model assignments (one model can serve multiple tiers)',
      'Drag-and-drop priority ordering within each tier',
      'Real-time health status per model',
      'Automatic round-robin selection within tiers',
      'Automatic fallback to lower tiers when needed',
    ],
    howToUse: [
      'Click on a tier to expand its model list',
      'Use the dropdown to add available models to a tier',
      'Drag models to reorder priority (first = highest priority)',
      'Remove models with the trash icon',
      'Monitor health indicators for each model',
    ],
    tips: [
      'Assign cost-effective models (like GPT-3.5) to Budget tier',
      'Keep at least 2 models per tier for redundancy',
      'Order by latency: faster models higher priority for Budget',
      'Order by quality: better models higher priority for Premium/Reasoning',
      'Review tier assignments after adding new providers',
    ],
    relatedDocs: ['superadmin-ai-infrastructure', 'superadmin-llm-management'],
  },

  'superadmin-ai-health-monitoring': {
    title: 'AI Health Monitoring',
    description:
      'Real-time health status, diagnostics, and capability testing for all configured AI providers.',
    moduleId: 'SUPERADMIN_AI_HEALTH_MONITORING',
    features: [
      'Summary cards: total, healthy, degraded, unhealthy providers',
      'Active alerts with error categories and recommended actions',
      'Per-provider status with response times',
      'Expandable details with error diagnostics',
      'Manual test button for each provider',
      'Auto-refresh (configurable interval)',
    ],
    howToUse: [
      'Review summary cards for quick status overview',
      'Check alerts section for immediate issues',
      'Click on a provider row to expand details',
      'Use "Testuj ponownie" to manually verify a provider',
      'Click Refresh to update all statuses',
    ],
    tips: [
      'Investigate unhealthy providers immediately',
      'Degraded status usually means high latency - check network/load',
      'Use capability tests (Connection, AI Eyes, Memory, Hands) for deeper diagnostics',
      'Set up external monitoring/alerts for production',
      'Keep this panel open during provider configuration changes',
    ],
    relatedDocs: ['superadmin-ai-infrastructure', 'superadmin-ai-global-settings'],
  },

  'superadmin-billing': {
    title: 'Billing Center',
    description: 'Manage subscriptions, invoices, payments, and revenue analytics.',
    moduleId: 'SUPERADMIN_BILLING',
    features: [
      'Subscription management',
      'Invoice generation and tracking',
      'Payment processing',
      'Revenue analytics and MRR tracking',
      'Dunning management',
      'Usage-based billing',
    ],
    howToUse: [
      'View all subscriptions in Subscriptions tab',
      'Generate invoices from Invoices tab',
      'Track revenue trends in Analytics',
    ],
    tips: [
      'Set up automated invoice reminders',
      'Review failed payments weekly',
      'Monitor churn signals in revenue analytics',
    ],
    relatedDocs: ['superadmin-overview', 'superadmin-customers', 'superadmin-invoices'],
  },

  'superadmin-invoices': {
    title: 'Invoice Center',
    description:
      'Comprehensive invoice management with credit notes, tax configuration, templates, and usage billing settings.',
    moduleId: 'SUPERADMIN_INVOICES',
    features: [
      'Invoice listing with status filtering',
      'Send payment reminders to customers',
      'Mark invoices as paid manually',
      'Download invoice PDFs',
      'Credit note creation and management',
      'Apply credits to outstanding invoices',
      'Refund and void credit notes',
      'Multi-country tax rate configuration',
      'VAT number validation (VIES integration)',
      'Tax calculator for instant estimates',
      'Customizable invoice templates',
      'Template preview and cloning',
      'Usage-based billing overage settings',
    ],
    howToUse: [
      'Invoices tab: View all invoices, filter by status, send reminders',
      'Credit Notes tab: Create credits for refunds or billing adjustments',
      'Tax Settings tab: Configure tax rates per country, validate VAT numbers',
      'Usage Billing tab: Set overage rates for tokens, storage, seats',
      'Templates tab: Customize invoice appearance, create org-specific templates',
    ],
    tips: [
      'Always validate VAT numbers for EU B2B transactions',
      'Set up automatic payment reminders for overdue invoices',
      'Use credit notes instead of manual adjustments for audit trail',
      'Configure tax rates before creating invoices',
      'Create organization-specific templates for white-label billing',
    ],
    relatedDocs: ['superadmin-billing', 'superadmin-customers'],
  },

  // =============================================
  // REVENUE MODULE
  // =============================================

  'superadmin-revenue': {
    title: 'Revenue Management',
    description:
      'Comprehensive revenue operations center with pricing plans, subscription lifecycle management, ASC 606 revenue recognition, forecasting, and payment management.',
    moduleId: 'SUPERADMIN_REVENUE',
    features: [
      'Advanced pricing plan management',
      'Subscription change workflows (upgrades, downgrades, cancellations)',
      'ASC 606 compliant revenue recognition',
      'Predictive revenue forecasting',
      'Payment method management',
      'Dunning and failed payment recovery',
      'Plan feature comparison',
    ],
    howToUse: [
      'Pricing Plans: Configure and compare subscription tiers',
      'Subscriptions: Approve/reject plan change requests',
      'Recognition: Track revenue recognition schedules',
      'Forecast: Generate and analyze revenue projections',
      'Payments: Manage payment methods and recover failures',
    ],
    tips: [
      'Review pending subscription changes daily',
      'Set up automated revenue recognition for recurring contracts',
      'Use forecasts for budget planning',
      'Monitor payment failure recovery rate',
    ],
    relatedDocs: [
      'superadmin-billing',
      'superadmin-revenue-pricing',
      'superadmin-revenue-recognition',
    ],
  },

  'superadmin-revenue-pricing': {
    title: 'Pricing Plans Management',
    description:
      'Configure and manage subscription pricing tiers with feature comparison, plan limits, and pricing strategies.',
    moduleId: 'SUPERADMIN_REVENUE_PRICING',
    features: [
      'Multi-tier pricing plan configuration',
      'Feature matrix comparison',
      'Plan limits (users, projects, storage, AI tokens)',
      'Monthly and annual billing options',
      'Custom enterprise plan creation',
      'Price testing and rollout',
    ],
    howToUse: [
      'View all plans in the pricing table',
      'Click "Compare" to see feature differences',
      'Create new plans with "Add Plan" button',
      'Edit limits and features per plan',
    ],
    tips: [
      'Test pricing changes in staging first',
      'Highlight key differentiators between plans',
      'Consider annual discount of 15-20%',
    ],
    relatedDocs: ['superadmin-revenue', 'superadmin-billing'],
  },

  'superadmin-revenue-subscriptions': {
    title: 'Subscription Changes',
    description:
      'Manage subscription lifecycle including upgrades, downgrades, cancellations, and reactivations with approval workflows.',
    moduleId: 'SUPERADMIN_REVENUE_SUBSCRIPTIONS',
    features: [
      'Subscription change requests queue',
      'Approval/rejection workflow',
      'Proration calculation',
      'Change type filtering (upgrade, downgrade, cancel)',
      'Effective date scheduling',
      'Change history tracking',
    ],
    howToUse: [
      'Review pending changes in the queue',
      'Click "Approve" or "Reject" with reason',
      'Filter by status or change type',
      'View proration amounts before approval',
    ],
    tips: [
      'Process pending changes within 24 hours',
      'Document rejection reasons for customer support',
      'Review cancellation patterns for churn analysis',
    ],
    relatedDocs: ['superadmin-revenue', 'superadmin-customers'],
  },

  'superadmin-revenue-recognition': {
    title: 'Revenue Recognition',
    description:
      'ASC 606 compliant revenue recognition with multiple recognition methods and schedule tracking.',
    moduleId: 'SUPERADMIN_REVENUE_RECOGNITION',
    features: [
      'ASC 606 compliance tracking',
      'Multiple recognition methods (straight-line, milestone, usage-based)',
      'Recognition schedule visualization',
      'Deferred revenue tracking',
      'Contract-based recognition',
      'Audit trail for recognized revenue',
    ],
    howToUse: [
      'View recognition items by status',
      'Check recognition schedules per contract',
      'Create new recognition entries for contracts',
      'Mark revenue as recognized',
    ],
    tips: [
      'Use straight-line for SaaS subscriptions',
      'Use milestone for professional services',
      'Review deferred revenue monthly',
    ],
    relatedDocs: ['superadmin-revenue', 'superadmin-invoices'],
  },

  'superadmin-revenue-forecast': {
    title: 'Revenue Forecasting',
    description: 'Predictive revenue analytics with multiple scenarios and accuracy tracking.',
    moduleId: 'SUPERADMIN_REVENUE_FORECAST',
    features: [
      'MRR/ARR forecasting',
      'Multiple scenarios (base, optimistic, pessimistic)',
      'Confidence intervals',
      'Model accuracy tracking',
      'Forecast vs actuals comparison',
      'Export forecasts for financial planning',
    ],
    howToUse: [
      'View existing forecasts by type',
      'Generate new forecasts with parameters',
      'Compare scenarios side by side',
      'Track forecast accuracy over time',
    ],
    tips: [
      'Update forecasts quarterly',
      'Use pessimistic scenario for budgeting',
      'Compare actuals to improve model accuracy',
    ],
    relatedDocs: ['superadmin-revenue', 'superadmin-analytics'],
  },

  'superadmin-revenue-payments': {
    title: 'Payment Management',
    description: 'Manage payment methods and recover failed payments through dunning automation.',
    moduleId: 'SUPERADMIN_REVENUE_PAYMENTS',
    features: [
      'Payment method overview',
      'Failed payment recovery (dunning)',
      'Retry payment attempts',
      'Recovery rate analytics',
      'Payment failure reasons',
      'Manual resolution options',
    ],
    howToUse: [
      'Monitor failed payments in the failures tab',
      'Click "Retry" to attempt payment again',
      'Resolve failures manually if needed',
      'Track recovery rate over time',
    ],
    tips: [
      'Set up automatic retry schedules',
      'Send dunning emails before retry',
      'Escalate after 3 failed attempts',
    ],
    relatedDocs: ['superadmin-revenue', 'superadmin-billing'],
  },

  'superadmin-security': {
    title: 'Security Center',
    description:
      'Enterprise security hub with 13 modules covering SSO, SCIM, roles, permissions, policies, sessions, audit logs, workflows, incidents, threats, DLP, AI budgets, and compliance.',
    moduleId: 'SUPERADMIN_SECURITY',
    features: [
      'SSO configuration (Google, SAML 2.0, Azure AD, Okta)',
      'SCIM 2.0 user provisioning',
      'Custom roles and permissions (RBAC)',
      'Security policies and MFA enforcement',
      'Admin session management',
      'Audit logging with risk scoring',
      'Approval workflows for sensitive operations',
      'Security incident management',
      'Threat intelligence and IP reputation',
      'Data Loss Prevention (DLP)',
      'AI budget controls',
      'Compliance center (GDPR, SOC 2, ISO 27001)',
    ],
    howToUse: [
      'SSO tab: Configure enterprise identity providers',
      'SCIM tab: Set up automatic user provisioning',
      'Roles tab: Create custom roles with specific permissions',
      'Policies tab: Define organization-wide security rules',
      'Incidents tab: Track and resolve security events',
      'Threats tab: Monitor and block malicious IPs/domains',
    ],
    tips: [
      'Enable SSO before SCIM for proper integration',
      'Create approval workflows for sensitive operations',
      'Review security incidents daily',
      'Keep threat intelligence updated from external sources',
    ],
    relatedDocs: [
      'superadmin-security-sso',
      'superadmin-security-scim',
      'superadmin-security-incidents',
    ],
  },

  'superadmin-security-sso': {
    title: 'SSO Configuration',
    description:
      'Configure Single Sign-On for enterprise organizations using Google Workspace, SAML 2.0, Azure AD, or Okta.',
    moduleId: 'SUPERADMIN_SECURITY_SSO',
    features: [
      'Google Workspace OAuth 2.0 / OIDC integration',
      'Generic SAML 2.0 for any enterprise IdP',
      'Domain-based organization routing',
      'Automatic user provisioning on first SSO login',
      'SSO enforcement policies per organization',
      'Multiple IdP support per organization',
    ],
    howToUse: [
      'Overview tab shows all configured SSO integrations with status',
      'Google Workspace tab: Enter Client ID and Secret from Google Cloud Console',
      'SAML 2.0 tab: Upload IdP metadata or enter SSO URL and certificate manually',
      'Domain Mapping tab: Route users to correct org based on email domain',
      'Click Configure SSO to add new organization integration',
    ],
    tips: [
      'Test SSO in staging environment before production',
      'Keep password fallback enabled during initial rollout',
      'Verify domain ownership via DNS TXT record',
      'Use domain mapping to auto-route enterprise users',
    ],
    relatedDocs: ['superadmin-security', 'superadmin-security-scim'],
  },

  'superadmin-security-scim': {
    title: 'SCIM Provisioning',
    description:
      'Automatic user provisioning via SCIM 2.0 protocol for enterprise identity providers like Azure AD, Okta, and OneLogin.',
    moduleId: 'SUPERADMIN_SECURITY_SCIM',
    features: [
      'SCIM 2.0 compliant /Users and /Groups endpoints',
      'API token management with scoped permissions',
      'IdP group to application role mapping',
      'Sync activity logging and monitoring',
      'Automatic user deprovisioning on IdP removal',
    ],
    howToUse: [
      'Overview tab: Enable SCIM and view endpoint configuration',
      'API Tokens tab: Generate tokens for IdP authentication',
      'Group Mappings tab: Map IdP groups to application roles',
      'Sync Logs tab: Monitor provisioning activity and errors',
      'Copy Base URL to configure in your IdP admin console',
    ],
    tips: [
      'Use descriptive token names (e.g., "Azure AD Production")',
      'Test with a single user before enabling full sync',
      'Set up group mappings before enabling provisioning',
      'Monitor sync logs during initial setup for errors',
    ],
    relatedDocs: ['superadmin-security-sso', 'superadmin-security-roles'],
  },

  'superadmin-security-roles': {
    title: 'Custom Roles',
    description:
      'Create and manage custom RBAC roles with granular permission assignments for organizations.',
    moduleId: 'SUPERADMIN_SECURITY_ROLES',
    features: [
      'Visual role builder with permission categories',
      'Role templates for common use cases',
      'Permission inheritance from base roles',
      'User count per role tracking',
      'Role color and icon customization',
      'Risk level indicators per permission',
    ],
    howToUse: [
      'Click Create Role to build a new custom role',
      'Select base role (viewer, member, manager, admin) for inheritance',
      'Check/uncheck permissions by category',
      'Use Templates tab for pre-built role configurations',
      'Assign users to roles from the role detail view',
    ],
    tips: [
      'Start with the most restrictive base role needed',
      'Use templates to speed up role creation',
      'Review high-risk permissions carefully before assigning',
      'Document role purposes in the description field',
    ],
    relatedDocs: ['superadmin-security-permissions', 'superadmin-security-scim'],
  },

  'superadmin-security-permissions': {
    title: 'Permissions Matrix',
    description:
      'View and manage the complete permissions matrix showing all available permissions by category and resource.',
    moduleId: 'SUPERADMIN_SECURITY_PERMISSIONS',
    features: [
      'Permission categories (Users, Projects, Billing, AI, Security)',
      'Risk level classification (low, medium, high, critical)',
      'Resource-action permission naming',
      'Permission definitions with descriptions',
    ],
    howToUse: [
      'Browse permissions by category',
      'View risk level to understand permission sensitivity',
      'Use this reference when building custom roles',
      'Click permission name for detailed description',
    ],
    tips: [
      'Critical permissions should require approval workflows',
      'Map permissions to job functions, not individuals',
      'Review permission matrix quarterly for cleanup',
    ],
    relatedDocs: ['superadmin-security-roles'],
  },

  'superadmin-security-policies': {
    title: 'Security Policies',
    description:
      'Define and enforce organization-wide security policies including password requirements, session management, and MFA.',
    moduleId: 'SUPERADMIN_SECURITY_POLICIES',
    features: [
      'Password policy (length, complexity, expiration)',
      'Session timeout configuration',
      'MFA enforcement levels',
      'IP allowlist/blocklist',
      'Maximum sessions per user',
      'Login attempt lockout thresholds',
    ],
    howToUse: [
      'Select organization to configure policies',
      'Set password minimum length and complexity requirements',
      'Enable MFA enforcement for all users or admins only',
      'Configure session timeout and maximum concurrent sessions',
      'Add IP addresses to allowlist for restricted access',
    ],
    tips: [
      'Enforce MFA for all admin users at minimum',
      'Set reasonable session timeouts (30-60 minutes)',
      'Use IP allowlist for sensitive admin panels',
      'Test policy changes in staging first',
    ],
    relatedDocs: ['superadmin-security', 'superadmin-security-sessions'],
  },

  'superadmin-security-sessions': {
    title: 'Admin Sessions',
    description: 'Monitor and manage active administrator sessions across the platform.',
    moduleId: 'SUPERADMIN_SECURITY_SESSIONS',
    features: [
      'Active session list with device info',
      'MFA status per session',
      'IP address and location tracking',
      'Session duration and last activity',
      'Revoke single or all sessions',
      'Session count statistics',
    ],
    howToUse: [
      'View all active admin sessions in the table',
      'Click Revoke to terminate a specific session',
      'Use Revoke All to force re-authentication',
      'Filter by user or organization',
      'Monitor for suspicious locations or devices',
    ],
    tips: [
      'Revoke sessions after security incidents',
      'Monitor for sessions from unexpected locations',
      'Check for multiple concurrent sessions per user',
      'Review sessions after employee termination',
    ],
    relatedDocs: ['superadmin-security-audit', 'superadmin-security-policies'],
  },

  'superadmin-security-audit': {
    title: 'Audit Logs',
    description:
      'Comprehensive audit trail of all administrative actions with risk scoring and export capabilities.',
    moduleId: 'SUPERADMIN_SECURITY_AUDIT',
    features: [
      'All admin action logging',
      'Risk score calculation (0-100)',
      'Filter by action type, admin, date range',
      'Export to CSV for compliance',
      'Log resolution workflow',
      'IP address and user agent tracking',
    ],
    howToUse: [
      'Use filters to find specific actions or time periods',
      'Sort by risk score to prioritize review',
      'Click Export CSV for compliance reports',
      'Mark logs as reviewed after investigation',
      'Set up alerts for high-risk actions',
    ],
    tips: [
      'Export logs monthly for compliance archives',
      'Review high-risk actions (score > 50) daily',
      'Correlate audit logs with security incidents',
      'Retain logs according to compliance requirements',
    ],
    relatedDocs: ['superadmin-security-incidents', 'superadmin-compliance'],
  },

  'superadmin-security-workflows': {
    title: 'Approval Workflows',
    description:
      'Configure approval workflows for sensitive operations like API key creation, role assignments, and budget increases.',
    moduleId: 'SUPERADMIN_SECURITY_WORKFLOWS',
    features: [
      'Workflow templates for common operations',
      'Multiple approvers with AND/OR logic',
      'Auto-expiration of pending requests',
      'Request history and audit trail',
      'Email notifications for approvers',
      'Approval/rejection with comments',
    ],
    howToUse: [
      'Workflows tab: Create and manage approval workflows',
      'Requests tab: View pending, approved, and rejected requests',
      'Click Create Workflow to define new approval process',
      'Set approvers and expiration time',
      'Enable for specific resource types',
    ],
    tips: [
      'Require multiple approvers for critical operations',
      'Set reasonable expiration times (24-72 hours)',
      'Use workflow for API key creation and role changes',
      'Review rejected requests for policy issues',
    ],
    relatedDocs: ['superadmin-security-roles', 'superadmin-security-audit'],
  },

  'superadmin-security-incidents': {
    title: 'Security Incidents',
    description:
      'Track, investigate, and resolve security incidents across the platform with severity classification and resolution workflow.',
    moduleId: 'SUPERADMIN_SECURITY_INCIDENTS',
    features: [
      'Incident creation and tracking',
      'Severity levels (Low, Medium, High, Critical)',
      'Status workflow (Open → In Progress → Resolved → Closed)',
      'Affected resources documentation',
      'Resolution notes and timeline',
      'Incident statistics dashboard',
    ],
    howToUse: [
      'Click Report Incident to log new security events',
      'Use filters to find incidents by severity or status',
      'Click on incident for full details and history',
      'Update status as investigation progresses',
      'Add resolution notes before closing',
    ],
    tips: [
      'Log all security events, even minor ones',
      'Prioritize Critical and High severity incidents',
      'Document root cause in resolution notes',
      'Link related incidents for pattern detection',
    ],
    relatedDocs: ['superadmin-security-threats', 'superadmin-security-audit'],
  },

  'superadmin-security-threats': {
    title: 'Threat Intelligence',
    description:
      'Monitor, track, and block malicious IPs, domains, and other threat indicators with reputation scoring.',
    moduleId: 'SUPERADMIN_SECURITY_THREATS',
    features: [
      'IP and domain threat tracking',
      'Reputation scores (0-100)',
      'Block/unblock functionality',
      'Threat level classification',
      'External source integration (AbuseIPDB, VirusTotal)',
      'IP/domain reputation check',
    ],
    howToUse: [
      'Add Threat to manually log suspicious indicators',
      'Click Check Reputation to query external databases',
      'Block to prevent access from threat indicator',
      'Use Filters to find specific threat types or levels',
      'Review threats periodically for status updates',
    ],
    tips: [
      'Block confirmed malicious IPs immediately',
      'Integrate with external threat feeds',
      'Review blocked indicators quarterly for cleanup',
      'Correlate threats with security incidents',
    ],
    relatedDocs: ['superadmin-security-incidents', 'superadmin-security-policies'],
  },

  'superadmin-security-dlp': {
    title: 'Data Loss Prevention (DLP)',
    description:
      'Configure DLP policies to detect and prevent sensitive data exposure including PII, credit cards, API keys, and custom patterns.',
    moduleId: 'SUPERADMIN_SECURITY_DLP',
    features: [
      'Pre-built policies (PII, credit cards, SSN, API keys)',
      'Custom regex pattern detection',
      'Enforcement actions (warn, block, log, quarantine)',
      'Violation tracking and resolution',
      'Content redaction in logs',
      'Policy scope configuration',
    ],
    howToUse: [
      'Enable pre-built policies for common data types',
      'Create custom policies with regex patterns',
      'Set enforcement action based on severity',
      'Monitor violations in the Violations tab',
      'Resolve violations after investigation',
    ],
    tips: [
      'Start with warn mode before enabling block',
      'Test custom regex patterns thoroughly',
      'Review violations weekly for false positives',
      'Enable critical data detection (credit cards, SSN) immediately',
    ],
    relatedDocs: ['superadmin-security-incidents', 'superadmin-compliance'],
  },

  'superadmin-security-budgets': {
    title: 'AI Budgets',
    description:
      'Control AI spending with budgets, alerts, and model permissions per organization and team.',
    moduleId: 'SUPERADMIN_SECURITY_BUDGETS',
    features: [
      'Organization and team budgets',
      'Spending alerts at thresholds',
      'Model permission controls',
      'Usage tracking and analytics',
      'Budget rollover configuration',
      'Cost estimation by model',
    ],
    howToUse: [
      'Set monthly AI budget per organization',
      'Configure alert thresholds (50%, 75%, 90%)',
      'Restrict expensive models for cost control',
      'Monitor spending in real-time dashboard',
      'Review usage patterns to optimize costs',
    ],
    tips: [
      'Set conservative initial budgets',
      'Enable alerts before hitting limits',
      'Restrict GPT-4/Claude for premium features only',
      'Review usage weekly during rollout',
    ],
    relatedDocs: ['superadmin-ai-operations', 'superadmin-security'],
  },

  'superadmin-security-compliance': {
    title: 'Compliance Center',
    description:
      'Track compliance status for GDPR, SOC 2, ISO 27001, and other frameworks with certification management.',
    moduleId: 'SUPERADMIN_SECURITY_COMPLIANCE',
    features: [
      'Compliance framework tracking',
      'Certification status dashboard',
      'Audit evidence collection',
      'Data retention policies',
      'GDPR data subject requests',
      'Compliance report generation',
    ],
    howToUse: [
      'View compliance status by framework',
      'Upload certification documents',
      'Track data subject requests',
      'Configure retention policies per data type',
      'Generate compliance reports for auditors',
    ],
    tips: [
      'Keep certifications updated before expiry',
      'Document all data processing activities',
      'Respond to GDPR requests within 30 days',
      'Automate evidence collection where possible',
    ],
    relatedDocs: ['superadmin-security-audit', 'superadmin-security-dlp'],
  },

  // =============================================
  // SYSTEM MODULE HELP
  // =============================================

  'superadmin-system': {
    title: 'System Module',
    description:
      'Enterprise system management with health monitoring, audit logs, feature flags, integrations, security panel, configuration, analytics, backup, and API management.',
    moduleId: 'SUPERADMIN_SYSTEM',
    features: [
      'Health monitoring with real-time metrics',
      'Enterprise audit logs with tamper detection',
      'Feature flags for progressive rollout',
      'Integration hub for third-party services',
      'Security panel with threat overview',
      'Configuration management',
      'System analytics and performance',
      'Backup and disaster recovery',
      'API key management',
    ],
    howToUse: [
      'Health tab: Monitor system health, response times, and error rates',
      'Audit Log tab: Track administrative actions with filters',
      'Feature Flags tab: Enable/disable features per organization',
      'Integrations tab: Configure and monitor third-party connections',
      'Security tab: View threat summary and active incidents',
      'Configuration tab: Manage system-wide settings',
      'Analytics tab: Review system performance metrics',
      'Backup tab: Schedule and manage backups',
      'API Keys tab: Manage API access tokens',
    ],
    tips: [
      'Set up alerts for health metrics going critical',
      'Review audit logs weekly for security compliance',
      'Use feature flags for A/B testing',
      'Schedule backups during low-traffic periods',
      'Rotate API keys quarterly',
    ],
    relatedDocs: ['superadmin-security', 'superadmin-settings'],
  },

  'superadmin-system-health': {
    title: 'System Health',
    description:
      'Real-time monitoring of system health including uptime, response times, error rates, and resource utilization.',
    moduleId: 'SUPERADMIN_SYSTEM_HEALTH',
    features: [
      'Uptime monitoring',
      'Response time tracking',
      'Error rate analysis',
      'Resource utilization (CPU, memory, disk)',
      'Service status dashboard',
      'Alerting configuration',
    ],
    howToUse: [
      'View dashboard for overall system status',
      'Click on metrics for detailed time series',
      'Configure alert thresholds for each metric',
      'Set up PagerDuty/Slack integrations for alerts',
    ],
    tips: [
      'Set conservative thresholds initially',
      'Monitor during peak hours for baseline',
      'Enable automatic scaling based on metrics',
    ],
    relatedDocs: ['superadmin-system', 'superadmin-system-analytics'],
  },

  'superadmin-system-audit': {
    title: 'System Audit Logs',
    description:
      'Enterprise-grade audit logging with tamper detection, filtering, and compliance export.',
    moduleId: 'SUPERADMIN_SYSTEM_AUDIT',
    features: [
      'Complete action audit trail',
      'User and admin action tracking',
      'IP address and geolocation logging',
      'Tamper detection with hashes',
      'Advanced filtering and search',
      'Export to CSV/JSON',
    ],
    howToUse: [
      'Use filters to narrow down to specific actions',
      'Search by user email or action type',
      'Export logs for compliance reporting',
      'Check hash integrity for tamper detection',
    ],
    tips: [
      'Set retention policy based on compliance needs',
      'Archive old logs to cold storage',
      'Review failed login attempts daily',
    ],
    relatedDocs: ['superadmin-security-audit', 'superadmin-system'],
  },

  'superadmin-system-flags': {
    title: 'Feature Flags',
    description:
      'Control feature availability across organizations with gradual rollout capabilities.',
    moduleId: 'SUPERADMIN_SYSTEM_FLAGS',
    features: [
      'Organization-level feature toggles',
      'Percentage-based rollouts',
      'User segment targeting',
      'Kill switches for emergencies',
      'Flag history and audit trail',
    ],
    howToUse: [
      'Create new flag with unique key',
      'Target specific organizations or percentages',
      'Monitor flag changes in audit log',
      'Use kill switch for immediate disable',
    ],
    tips: [
      'Start rollouts at 10% and increase gradually',
      'Document flag purpose and owner',
      'Clean up deprecated flags quarterly',
    ],
    relatedDocs: ['superadmin-system'],
  },

  // =============================================
  // SUPPORT MODULE HELP
  // =============================================

  'superadmin-support': {
    title: 'Support Module',
    description:
      'Customer support operations center with ticket management, customer success notes, and health scoring.',
    moduleId: 'SUPERADMIN_SUPPORT',
    features: [
      'Support ticket management',
      'Customer success notes',
      'Customer health scoring',
      'Priority and SLA tracking',
      'Escalation workflows',
    ],
    howToUse: [
      'Tickets tab: View and manage support requests',
      'CS Notes tab: Track customer interactions and insights',
      'Health tab: Monitor customer health scores and at-risk accounts',
    ],
    tips: [
      'Set SLA alerts for high-priority tickets',
      'Document all customer interactions',
      'Review health scores weekly for proactive outreach',
    ],
    relatedDocs: ['superadmin-customers', 'superadmin-support-tickets'],
  },

  'superadmin-support-tickets': {
    title: 'Support Tickets',
    description:
      'Manage customer support requests with priority assignment, SLA tracking, and resolution workflow.',
    moduleId: 'SUPERADMIN_SUPPORT_TICKETS',
    features: [
      'Ticket inbox with filters',
      'Priority classification (P1-P4)',
      'SLA countdown timers',
      'Assignment to support agents',
      'Resolution tracking',
      'Customer satisfaction feedback',
    ],
    howToUse: [
      'Use filters to focus on your queue',
      'Assign tickets based on expertise',
      'Track SLA compliance in dashboard',
      'Close tickets with resolution notes',
    ],
    tips: [
      'Respond to P1 tickets within 15 minutes',
      'Document resolution steps for knowledge base',
      'Escalate complex issues to engineering',
    ],
    relatedDocs: ['superadmin-support'],
  },

  'superadmin-support-health': {
    title: 'Customer Health',
    description:
      'Monitor customer health scores based on usage, engagement, support tickets, and NPS feedback.',
    moduleId: 'SUPERADMIN_SUPPORT_HEALTH',
    features: [
      'Health score calculation',
      'At-risk customer alerts',
      'Usage pattern analysis',
      'Engagement metrics',
      'Churn prediction',
    ],
    howToUse: [
      'Review at-risk customers daily',
      'Click on customer for detailed breakdown',
      'Schedule outreach for declining scores',
      'Track improvement over time',
    ],
    tips: [
      'Focus on customers below 60% health',
      'Combine health data with CS notes',
      'Use playbooks for at-risk recovery',
    ],
    relatedDocs: ['superadmin-support', 'superadmin-customers'],
  },

  // =============================================
  // ANALYTICS MODULE HELP
  // =============================================

  'superadmin-analytics': {
    title: 'Analytics Module',
    description:
      'Business intelligence platform with custom dashboard builder, saved reports, business metrics, and predictive analytics.',
    moduleId: 'SUPERADMIN_ANALYTICS',
    features: [
      'Custom dashboard builder',
      'Widget library (charts, KPIs, tables)',
      'Saved reports with scheduling',
      'Business metrics tracking',
      'Predictive analytics models',
      'Data visualization',
    ],
    howToUse: [
      'Dashboards tab: Create and manage custom dashboards',
      'Reports tab: Build, schedule, and share reports',
      'Metrics tab: Define and track business KPIs',
      'Predictive tab: Train and use ML models for forecasting',
    ],
    tips: [
      'Start with pre-built templates',
      'Schedule reports for weekly delivery',
      'Share dashboards with stakeholders',
      'Review predictions against actuals monthly',
    ],
    relatedDocs: ['superadmin-revenue', 'superadmin-overview'],
  },

  'superadmin-analytics-dashboards': {
    title: 'Dashboard Builder',
    description:
      'Create custom analytics dashboards with drag-and-drop widgets and real-time data updates.',
    moduleId: 'SUPERADMIN_ANALYTICS_DASHBOARDS',
    features: [
      'Drag-and-drop widget placement',
      'Multiple chart types (line, bar, pie, area)',
      'KPI cards with trend indicators',
      'Data tables with sorting and filtering',
      'Real-time data refresh',
      'Dashboard sharing and permissions',
    ],
    howToUse: [
      'Click "New Dashboard" to start',
      'Drag widgets from library to canvas',
      'Configure data sources for each widget',
      'Arrange layout and save',
      'Share with team via link or embed',
    ],
    tips: [
      'Keep dashboards focused (5-8 widgets max)',
      'Use consistent color schemes',
      'Add context with text widgets',
    ],
    relatedDocs: ['superadmin-analytics', 'superadmin-analytics-reports'],
  },

  'superadmin-analytics-reports': {
    title: 'Saved Reports',
    description:
      'Build parameterized reports with scheduling, export, and distribution capabilities.',
    moduleId: 'SUPERADMIN_ANALYTICS_REPORTS',
    features: [
      'Report builder with templates',
      'SQL query editor',
      'Parameter inputs',
      'Schedule execution (daily, weekly, monthly)',
      'Email distribution',
      'Export to PDF, Excel, CSV',
    ],
    howToUse: [
      'Create report from template or scratch',
      'Define parameters for flexibility',
      'Preview and test report',
      'Schedule for recurring execution',
      'Add recipients for distribution',
    ],
    tips: [
      'Name reports descriptively',
      'Document data sources',
      'Set reasonable execution timeouts',
    ],
    relatedDocs: ['superadmin-analytics-dashboards'],
  },

  'superadmin-analytics-metrics': {
    title: 'Business Metrics',
    description: 'Define and track custom business metrics with formulas, thresholds, and alerts.',
    moduleId: 'SUPERADMIN_ANALYTICS_METRICS',
    features: [
      'Custom metric definitions',
      'Formula builder',
      'Threshold configuration',
      'Alert rules',
      'Historical tracking',
      'Metric comparison',
    ],
    howToUse: [
      'Define metric with formula',
      'Set target and threshold values',
      'Configure alert rules',
      'Add to dashboards for visibility',
      'Review metric history',
    ],
    tips: [
      'Align metrics with business goals',
      'Set realistic targets',
      'Review and adjust quarterly',
    ],
    relatedDocs: ['superadmin-analytics'],
  },

  'superadmin-analytics-predictive': {
    title: 'Predictive Analytics',
    description:
      'Machine learning powered predictions for churn, revenue, growth, and custom forecasting.',
    moduleId: 'SUPERADMIN_ANALYTICS_PREDICTIVE',
    features: [
      'Pre-built prediction models',
      'Custom model training',
      'Model accuracy tracking',
      'Prediction confidence scores',
      'What-if analysis',
    ],
    howToUse: [
      'Select pre-built model or create custom',
      'Configure training data and features',
      'Train model and review accuracy',
      'Run predictions on new data',
      'Monitor prediction accuracy over time',
    ],
    tips: [
      'Start with pre-built models',
      'Require 80%+ accuracy before deployment',
      'Retrain models quarterly with new data',
    ],
    relatedDocs: ['superadmin-analytics', 'superadmin-revenue-forecast'],
  },

  'superadmin-settings': {
    title: 'System Settings',
    description:
      'Central configuration hub for platform-wide settings including application identity, security policies, email configuration, storage management, and administrative access.',
    moduleId: 'SUPERADMIN_SETTINGS',
    features: [
      'Application identity (name, language, branding)',
      'Security policies (MFA enforcement, session timeout)',
      'SMTP email configuration',
      'Legal document URLs (Terms of Service, Privacy Policy)',
      'Super Administrator management',
      'Storage usage monitoring per organization',
      'Audit log viewer with filtering',
      'Advanced database explorer (debugging tool)',
      'Maintenance mode toggle',
      'System-wide announcements',
    ],
    howToUse: [
      'General tab: Set application name, default language, maintenance mode, and announcements',
      'Security tab: Configure MFA enforcement and session timeout duration',
      'Email tab: Configure SMTP settings for platform emails',
      'Legal tab: Set URLs for Terms of Service and Privacy Policy',
      'Admins tab: Manage Super Administrator accounts',
      'Storage tab: Monitor file storage usage across organizations',
      'Audit tab: Review all administrative actions with filters',
      'Advanced tab: Direct database access for debugging (use with caution!)',
    ],
    tips: [
      'Enable MFA enforcement in production for all users',
      'Set appropriate session timeouts based on security requirements',
      'Review audit logs regularly for compliance and security',
      'Use maintenance mode during major deployments',
      'The Advanced tab bypasses all validation - use only for debugging',
      'Monitor storage usage to prevent quota issues',
    ],
    relatedDocs: ['superadmin-whitelabel', 'superadmin-security', 'superadmin-overview'],
  },

  'superadmin-whitelabel': {
    title: 'White-label Studio',
    description:
      'Customize branding for each organization including logos, color themes, typography, login page customization, and custom domain configuration. Enable enterprise clients to have their own branded experience.',
    moduleId: 'SUPERADMIN_WHITELABEL',
    features: [
      'Logo uploads (light mode, dark mode, icon, favicon)',
      'Color theme customization (light and dark modes)',
      'Typography settings (body and heading fonts)',
      'Login page customization (tagline, welcome message, background)',
      'Custom domain configuration with SSL',
      'Branding cloning between organizations',
      '"Powered by" badge toggle',
      'Custom support email and legal URLs per organization',
    ],
    howToUse: [
      'Select an organization from the list to customize its branding',
      'Brand Identity tab: Upload logos for different contexts',
      'Colors & Theme tab: Set primary, secondary, and accent colors for both modes',
      'Typography tab: Choose fonts for body text and headings',
      'Login Page tab: Customize the login experience with tagline and welcome message',
      'Custom Domain tab: Configure and verify custom domains with SSL',
      'Use Clone feature to copy branding between organizations',
      'Click Preview to see how changes will look',
    ],
    tips: [
      'Always test both light and dark mode appearances',
      'Ensure logo contrast is adequate against background colors',
      'Use SVG format for logos for best quality at all sizes',
      'Verify custom domain DNS records before expecting SSL activation',
      'Clone branding from a reference org to speed up setup',
      'Hide "Powered by" badge for enterprise clients if contracted',
    ],
    relatedDocs: ['superadmin-settings', 'superadmin-customers'],
  },

  'superadmin-legal': {
    title: 'Legal & Compliance',
    description:
      'Manage platform legal documents and handle GDPR data requests. Track compliance certifications and user document acceptances.',
    moduleId: 'SUPERADMIN_LEGAL',
    features: [
      'Legal document management (Privacy Policy, Terms of Service, DPA, SLA)',
      'Document version tracking and publishing',
      'GDPR data export request handling',
      'GDPR deletion request management',
      'Compliance certification status tracking (GDPR, SOC 2, ISO 27001)',
      'User document acceptance tracking',
    ],
    howToUse: [
      'Legal Documents section shows all platform legal documents with status',
      'Download documents or view external URLs directly',
      'GDPR Export Requests section lists pending data export requests',
      'Process export requests and provide download links',
      'Compliance Status cards show certification status at a glance',
    ],
    tips: [
      'Update legal documents before effective dates',
      'Process GDPR export requests within 30 days (legal requirement)',
      'Keep compliance certifications up to date',
      'Require acceptance for major document updates',
    ],
    relatedDocs: ['superadmin-settings', 'superadmin-security'],
  },

  // ==========================================
  // ADMIN MODULES
  // ==========================================

  'admin-metrics': {
    title: 'Organization Metrics',
    description: 'View analytics and metrics for your organization.',
    moduleId: 'ADMIN_METRICS',
    features: [
      'Team activity metrics',
      'Project progress tracking',
      'AI usage statistics',
      'Help system effectiveness',
    ],
    howToUse: [
      'Review metrics dashboard regularly',
      'Track team adoption trends',
      'Monitor AI feature usage',
    ],
    tips: ['Share metrics with stakeholders monthly', 'Use data to identify training needs'],
    relatedDocs: ['admin-settings'],
  },

  // ==========================================
  // SETTINGS MODULE
  // ==========================================

  // MY SETTINGS GROUP
  'settings-profile': {
    title: 'Profile Settings',
    description: 'Manage your personal profile information displayed across the platform.',
    moduleId: 'SETTINGS_PROFILE',
    features: [
      'Edit display name and contact info',
      'Update job title and department',
      'Set profile visibility preferences',
      'Manage timezone and locale settings',
    ],
    howToUse: [
      'Click on any field to edit directly',
      'Changes are saved automatically',
      'Profile photo can be updated in Avatar settings',
    ],
    tips: [
      'Keep your profile complete for better team collaboration',
      'Use a professional photo for video calls integration',
      'Update your timezone for accurate scheduling',
    ],
    relatedDocs: ['settings-avatar', 'settings-regional'],
  },

  'settings-avatar': {
    title: 'Avatar & Photo',
    description: 'Upload and manage your profile picture used throughout the application.',
    moduleId: 'SETTINGS_AVATAR',
    features: [
      'Upload profile photo with drag & drop',
      'Crop and zoom functionality',
      'Multiple image format support (JPG, PNG, GIF)',
      'Automatic image optimization',
    ],
    howToUse: [
      'Click the upload area or drag an image',
      'Adjust zoom to frame your photo',
      'Click Save to apply changes',
      'Use Remove Photo to revert to default avatar',
    ],
    tips: [
      'Use a square image for best results',
      'Keep file size under 5MB for faster uploads',
      'Professional headshots work best for enterprise environments',
    ],
    relatedDocs: ['settings-profile'],
  },

  'settings-signatures': {
    title: 'Email Signatures',
    description: 'Create and manage email signatures for use in notifications and communications.',
    moduleId: 'SETTINGS_SIGNATURES',
    features: [
      'Create multiple signature templates',
      'Rich text formatting support',
      'HTML signature support',
      'Set default signature for emails',
    ],
    howToUse: [
      'Click "Add Signature" to create new template',
      'Use the rich text editor to format your signature',
      'Set one signature as default for automatic use',
      'Preview signature before saving',
    ],
    tips: [
      'Include contact info in professional signature',
      'Create separate signatures for internal vs external use',
      'Keep signatures concise for mobile email clients',
    ],
    relatedDocs: ['settings-notifications'],
  },

  'settings-working-hours': {
    title: 'Working Hours',
    description: 'Define your availability schedule for meetings and focus time.',
    moduleId: 'SETTINGS_WORKING_HOURS',
    features: [
      'Set daily start and end times',
      'Configure working days',
      'Define focus time blocks',
      'Sync with calendar integrations',
    ],
    howToUse: [
      'Set your typical work hours',
      'Mark specific days as non-working',
      'Enable focus time to block notifications during deep work',
      'Connect calendar to sync availability',
    ],
    tips: [
      'Block focus time for complex tasks',
      'Adjust hours when traveling across time zones',
      'Share your schedule with team for better collaboration',
    ],
    relatedDocs: ['settings-calendar-sync', 'settings-notifications'],
  },

  // WORK PREFERENCES GROUP
  'settings-dashboard': {
    title: 'Dashboard Preferences',
    description: 'Customize your dashboard layout and default views.',
    moduleId: 'SETTINGS_DASHBOARD',
    features: [
      'Choose default view (cards, list, kanban)',
      'Configure visible widgets',
      'Set widget order and layout',
      'Quick actions customization',
    ],
    howToUse: [
      'Select your preferred default view',
      'Drag widgets to reorder',
      'Toggle widgets on/off',
      'Configure quick action shortcuts',
    ],
    tips: [
      'Start with card view for visual overview',
      'Use kanban view for task-focused workflows',
      'Pin most-used widgets to the top',
    ],
    relatedDocs: ['settings-work-preferences'],
  },

  'settings-work-preferences': {
    title: 'Work Preferences',
    description: 'General preferences for how you work in the application.',
    moduleId: 'SETTINGS_WORK_PREFERENCES',
    features: [
      'Task sorting and filtering defaults',
      'Auto-save preferences',
      'Confirmation dialogs settings',
      'Default project and team settings',
    ],
    howToUse: [
      'Configure your preferred defaults',
      'Settings apply across all projects',
      'Reset to defaults if needed',
    ],
    tips: [
      'Configure once, work faster everywhere',
      'Review preferences periodically as your workflow evolves',
    ],
    relatedDocs: ['settings-dashboard', 'settings-regional'],
  },

  'settings-regional': {
    title: 'Regional Settings',
    description: 'Configure timezone, date format, and locale preferences.',
    moduleId: 'SETTINGS_REGIONAL',
    features: [
      'Timezone selection with auto-detect',
      'Date and time format customization',
      'First day of week preference',
      'Number and currency formats',
    ],
    howToUse: [
      'Select your timezone from the dropdown',
      'Choose preferred date format',
      'Set first day of week for calendar views',
    ],
    tips: [
      'Enable auto-detect timezone for travel',
      'Use ISO date format for international teams',
      'Currency settings affect budget displays',
    ],
    relatedDocs: ['settings-language', 'settings-working-hours'],
  },

  'settings-language': {
    title: 'Language Settings',
    description: 'Choose your preferred language for the application interface.',
    moduleId: 'SETTINGS_LANGUAGE',
    features: [
      'Interface language selection',
      'Multiple language support (EN, PL, DE, ES, AR)',
      'AI response language preferences',
      'Date and number localization',
    ],
    howToUse: [
      'Select language from dropdown',
      'Changes apply immediately',
      'Some content may require refresh',
    ],
    tips: [
      'Choose language matching your team communication',
      'AI responses adapt to your language setting',
    ],
    relatedDocs: ['settings-regional'],
  },

  // AI & AUTOMATION GROUP
  'settings-ai-instructions': {
    title: 'AI Custom Instructions',
    description: 'Provide custom instructions that guide AI responses to your preferences.',
    moduleId: 'SETTINGS_AI_INSTRUCTIONS',
    features: [
      'Custom system prompt configuration',
      'Response style preferences (concise, balanced, detailed)',
      'Context inclusion settings',
      'Industry-specific terminology guidance',
    ],
    howToUse: [
      'Write instructions describing your preferences',
      'Be specific about tone, format, and style',
      'Test with AI assistant to verify behavior',
      'Adjust based on results',
    ],
    tips: [
      'Start simple, then refine based on responses',
      'Include domain-specific terminology requirements',
      'Mention formats you prefer (bullets, paragraphs, tables)',
    ],
    relatedDocs: ['settings-ai-model', 'settings-ai-personality'],
  },

  'settings-ai-model': {
    title: 'AI Model Selection',
    description: 'Choose which AI models are available and set your preferred model.',
    moduleId: 'SETTINGS_AI_MODEL',
    features: [
      'Enable/disable specific models',
      'Set preferred model for default use',
      'Configure fallback model',
      'Model capability comparison',
    ],
    howToUse: [
      'Toggle models you want available',
      'Set preferred model for daily use',
      'Configure fallback for high-availability',
    ],
    tips: [
      'Use GPT-4 for complex reasoning tasks',
      'GPT-3.5 Turbo is faster for simple queries',
      'Claude excels at analysis and summaries',
    ],
    relatedDocs: ['settings-ai-parameters', 'settings-ai-usage'],
  },

  'settings-ai-parameters': {
    title: 'AI Parameters',
    description: 'Fine-tune AI behavior with temperature, token limits, and other parameters.',
    moduleId: 'SETTINGS_AI_PARAMETERS',
    features: [
      'Temperature control (creativity vs consistency)',
      'Maximum token limits',
      'Context window size',
      'Response streaming toggle',
    ],
    howToUse: [
      'Adjust temperature slider (0 = focused, 2 = creative)',
      'Set token limits based on your needs',
      'Enable streaming for real-time responses',
    ],
    tips: [
      'Lower temperature for factual queries',
      'Higher temperature for creative brainstorming',
      'Larger context windows for document analysis',
    ],
    relatedDocs: ['settings-ai-model', 'settings-ai-instructions'],
  },

  'settings-ai-usage': {
    title: 'AI Usage Dashboard',
    description: 'Monitor your AI usage, token consumption, and costs.',
    moduleId: 'SETTINGS_AI_USAGE',
    features: [
      'Token usage tracking by period',
      'Cost estimation and breakdown',
      'Usage by feature (chat, analysis, etc.)',
      'Daily and weekly trends',
    ],
    howToUse: [
      'Select time period to view',
      'Click charts for detailed breakdown',
      'Export usage data for reports',
    ],
    tips: [
      'Monitor usage to optimize costs',
      'Identify high-usage features',
      'Set alerts for budget thresholds',
    ],
    relatedDocs: ['settings-ai-model', 'settings-ai-parameters'],
  },

  'settings-ai-personality': {
    title: 'AI Personality',
    description: 'Define the tone and communication style for AI responses.',
    moduleId: 'SETTINGS_AI_PERSONALITY',
    features: [
      'Tone selection (professional, friendly, formal)',
      'Verbosity preferences (concise, detailed)',
      'Formality level configuration',
      'Custom personality instructions',
    ],
    howToUse: [
      'Choose base tone from presets',
      'Fine-tune with custom instructions',
      'Test in AI assistant to verify',
    ],
    tips: [
      'Match AI tone to your organization culture',
      'Professional tone works best for enterprise',
      'Adjust based on use case (reports vs chat)',
    ],
    relatedDocs: ['settings-ai-instructions'],
  },

  'settings-ai-autocomplete': {
    title: 'AI Auto-Complete',
    description: 'Configure AI-powered suggestions and auto-completion.',
    moduleId: 'SETTINGS_AI_AUTOCOMPLETE',
    features: [
      'Enable/disable auto-suggestions',
      'Sensitivity and trigger delay',
      'Context types for suggestions',
      'Suggestion display preferences',
    ],
    howToUse: [
      'Toggle auto-complete on/off',
      'Adjust sensitivity for more/fewer suggestions',
      'Select where suggestions appear',
    ],
    tips: [
      'Start with low sensitivity and increase gradually',
      'Disable in focused writing mode',
      'Enable for repetitive content creation',
    ],
    relatedDocs: ['settings-ai-instructions'],
  },

  'settings-ai-memory': {
    title: 'AI Memory',
    description: 'Control how AI remembers context from your conversations.',
    moduleId: 'SETTINGS_AI_MEMORY',
    features: [
      'Enable/disable AI memory',
      'Memory retention period',
      'Clear memory data',
      'Context types included',
    ],
    howToUse: [
      'Toggle memory on for personalized responses',
      'Set retention period in days',
      'Clear memory for fresh start',
    ],
    tips: [
      'Enable memory for ongoing projects',
      'Clear memory before sensitive discussions',
      'Shorter retention for privacy-conscious use',
    ],
    relatedDocs: ['settings-privacy', 'settings-ai-instructions'],
  },

  'settings-ai-voice': {
    title: 'AI Voice Settings',
    description: 'Configure voice input and text-to-speech options.',
    moduleId: 'SETTINGS_AI_VOICE',
    features: [
      'Voice input (speech-to-text) toggle',
      'Text-to-speech for AI responses',
      'Voice selection and speed',
      'Auto-play settings',
    ],
    howToUse: [
      'Enable voice input for hands-free operation',
      'Choose preferred voice for TTS',
      'Adjust speech speed to your preference',
    ],
    tips: [
      'Use voice input for quick task creation',
      'TTS useful for reviewing long AI responses',
      'Test different voices for clarity',
    ],
    relatedDocs: ['settings-accessibility'],
  },

  // NOTIFICATIONS GROUP
  'settings-notifications': {
    title: 'Notification Preferences',
    description: 'Control which notifications you receive and how.',
    moduleId: 'SETTINGS_NOTIFICATIONS',
    features: [
      'Email notification toggles',
      'Push notification settings',
      'In-app notification preferences',
      'Notification sound settings',
    ],
    howToUse: [
      'Toggle individual notification types',
      'Set quiet hours for focus time',
      'Configure email digest frequency',
    ],
    tips: [
      'Enable critical alerts, disable noise',
      'Use digest for non-urgent updates',
      'Set quiet hours during deep work',
    ],
    relatedDocs: ['settings-notification-digest', 'settings-dnd'],
  },

  'settings-notification-digest': {
    title: 'Notification Digest',
    description: 'Configure summary email digests of your notifications.',
    moduleId: 'SETTINGS_NOTIFICATION_DIGEST',
    features: [
      'Digest frequency (daily, weekly)',
      'Content selection',
      'Delivery time preference',
      'Format customization',
    ],
    howToUse: [
      'Choose digest frequency',
      'Select content types to include',
      'Set preferred delivery time',
    ],
    tips: [
      'Daily digest for active projects',
      'Weekly for lower-priority monitoring',
      'Schedule delivery before your workday starts',
    ],
    relatedDocs: ['settings-notifications'],
  },

  // INTEGRATIONS GROUP
  'settings-integrations': {
    title: 'Connected Apps',
    description: 'Connect external services and applications.',
    moduleId: 'SETTINGS_INTEGRATIONS',
    features: [
      'OAuth-based app connections',
      'Integration status monitoring',
      'Permission management',
      'Sync settings per integration',
    ],
    howToUse: [
      'Click Connect on desired app',
      'Authorize via OAuth flow',
      'Configure sync preferences',
      'Disconnect apps you no longer need',
    ],
    tips: [
      'Connect calendar for scheduling features',
      'Slack integration enables team notifications',
      'Regularly review connected apps',
    ],
    relatedDocs: ['settings-calendar-sync'],
  },

  'settings-calendar-sync': {
    title: 'Calendar Sync',
    description: 'Sync your calendar for scheduling and availability.',
    moduleId: 'SETTINGS_CALENDAR_SYNC',
    features: [
      'Google Calendar integration',
      'Outlook/Office 365 support',
      'Two-way sync options',
      'Event creation preferences',
    ],
    howToUse: [
      'Connect your calendar provider',
      'Choose sync direction',
      'Select calendars to sync',
      'Set event creation defaults',
    ],
    tips: [
      'Enable two-way sync for full integration',
      'Create separate calendar for Consultinity events',
      'Set buffer time between meetings',
    ],
    relatedDocs: ['settings-integrations', 'settings-working-hours'],
  },

  // DATA & PRIVACY GROUP
  'settings-privacy': {
    title: 'Privacy Settings',
    description: 'Control your data privacy and visibility settings.',
    moduleId: 'SETTINGS_PRIVACY',
    features: [
      'Profile visibility controls',
      'Activity sharing preferences',
      'Online status visibility',
      'Data sharing with AI',
    ],
    howToUse: [
      'Set profile visibility level',
      'Toggle activity sharing options',
      'Control online status display',
    ],
    tips: [
      'Review settings when joining new teams',
      'Disable AI data sharing for sensitive projects',
      'Regular privacy audits recommended',
    ],
    relatedDocs: ['settings-gdpr', 'settings-data-controls'],
  },

  'settings-gdpr': {
    title: 'GDPR & Compliance',
    description: 'Manage your GDPR rights and data compliance settings.',
    moduleId: 'SETTINGS_GDPR',
    features: [
      'Consent management',
      'Data retention settings',
      'Export your data (portability)',
      'Account deletion requests',
    ],
    howToUse: [
      'Review and update consents',
      'Set data retention preferences',
      'Request data export for backup',
      'Submit deletion request if needed',
    ],
    tips: [
      'Export data regularly for personal backup',
      'Review consents annually',
      'Deletion has 30-day grace period',
    ],
    relatedDocs: ['settings-privacy', 'settings-data-controls'],
  },

  'settings-data-controls': {
    title: 'Data Controls',
    description: 'Manage your data storage and processing preferences.',
    moduleId: 'SETTINGS_DATA_CONTROLS',
    features: [
      'Data collection preferences',
      'Storage location settings',
      'Processing consent toggles',
      'Third-party data sharing',
    ],
    howToUse: [
      'Review data collection settings',
      'Toggle processing consent',
      'Configure third-party sharing',
    ],
    tips: [
      'Minimize data collection for privacy',
      'Review third-party access periodically',
      'Enable only essential processing',
    ],
    relatedDocs: ['settings-privacy', 'settings-gdpr'],
  },

  // APPEARANCE GROUP
  'settings-appearance': {
    title: 'Appearance Settings',
    description: 'Customize the visual appearance of the application.',
    moduleId: 'SETTINGS_APPEARANCE',
    features: [
      'Light/Dark theme selection',
      'System theme sync',
      'Accent color customization',
      'Density preferences',
    ],
    howToUse: [
      'Choose light, dark, or system theme',
      'Select accent color',
      'Adjust interface density',
    ],
    tips: [
      'Dark theme reduces eye strain in low light',
      'System sync automatically adapts to OS settings',
      'Comfortable density recommended for most users',
    ],
    relatedDocs: ['settings-accessibility'],
  },

  'settings-accessibility': {
    title: 'Accessibility',
    description: 'Configure accessibility features for better usability.',
    moduleId: 'SETTINGS_ACCESSIBILITY',
    features: [
      'Font size adjustment',
      'High contrast mode',
      'Reduced motion option',
      'Screen reader optimization',
    ],
    howToUse: [
      'Increase font size for better readability',
      'Enable high contrast for visual impairment',
      'Reduce motion for vestibular sensitivity',
    ],
    tips: [
      'Test with your assistive technology',
      'Combine settings for optimal experience',
      'Keyboard shortcuts enhance accessibility',
    ],
    relatedDocs: ['settings-shortcuts', 'settings-appearance'],
  },

  'settings-shortcuts': {
    title: 'Keyboard Shortcuts',
    description: 'View and customize keyboard shortcuts for faster navigation.',
    moduleId: 'SETTINGS_SHORTCUTS',
    features: [
      'View all available shortcuts',
      'Customize key bindings',
      'Category-based organization',
      'Conflict detection',
    ],
    howToUse: [
      'Browse shortcuts by category',
      'Click to edit a shortcut',
      'Reset to defaults if needed',
    ],
    tips: [
      'Cmd/Ctrl+K opens quick search',
      'Cmd/Ctrl+J opens AI assistant',
      'Learn navigation shortcuts first',
    ],
    relatedDocs: ['settings-accessibility'],
  },

  // ADVANCED GROUP
  'settings-templates': {
    title: 'Settings Templates',
    description: 'Save and apply predefined settings configurations.',
    moduleId: 'SETTINGS_TEMPLATES',
    features: [
      'System templates (Minimal, Power User, Privacy)',
      'Custom template creation',
      'Template application',
      'Sharing templates with team',
    ],
    howToUse: [
      'Browse available templates',
      'Click Apply to use a template',
      'Save current settings as new template',
    ],
    tips: [
      'Start with a system template, then customize',
      'Create templates for different work modes',
      'Share templates with new team members',
    ],
    relatedDocs: ['settings-export-import'],
  },

  'settings-history': {
    title: 'Settings History',
    description: 'View audit log of all your settings changes.',
    moduleId: 'SETTINGS_HISTORY',
    features: [
      'Chronological change log',
      'Filter by category and date',
      'Restore previous values',
      'Device and IP tracking',
    ],
    howToUse: [
      'Browse change history',
      'Filter by category or time range',
      'Click entry to see details',
      'Restore previous value if needed',
    ],
    tips: [
      'Check history after unexpected behavior',
      'Use restore to undo accidental changes',
      'Review periodically for security',
    ],
    relatedDocs: ['settings-templates'],
  },

  'settings-export-import': {
    title: 'Export & Import',
    description: 'Backup and restore your settings configuration.',
    moduleId: 'SETTINGS_EXPORT_IMPORT',
    features: [
      'Export settings as JSON',
      'Selective category export',
      'Import from file',
      'Validation and preview',
    ],
    howToUse: [
      'Select categories to export',
      'Download JSON file',
      'Import by uploading file',
      'Review preview before applying',
    ],
    tips: [
      'Export before major changes',
      'Use for device migration',
      'Sensitive data not included',
    ],
    relatedDocs: ['settings-templates'],
  },

  'settings-api-keys': {
    title: 'API Keys',
    description: 'Manage API keys for external integrations.',
    moduleId: 'SETTINGS_API_KEYS',
    features: [
      'Create and revoke API keys',
      'Permission scopes',
      'Rate limiting configuration',
      'Usage monitoring',
    ],
    howToUse: [
      'Create new key with descriptive name',
      'Set appropriate scopes',
      'Copy key immediately (shown once)',
      'Monitor usage and rotate regularly',
    ],
    tips: [
      'Use descriptive names for keys',
      'Apply principle of least privilege',
      'Rotate keys periodically',
      'Revoke unused keys',
    ],
    relatedDocs: ['settings-webhooks', 'settings-developer'],
  },

  'settings-webhooks': {
    title: 'Webhooks',
    description: 'Configure webhooks for real-time event notifications.',
    moduleId: 'SETTINGS_WEBHOOKS',
    features: [
      'Create webhook endpoints',
      'Event type selection',
      'Signature verification',
      'Delivery monitoring',
    ],
    howToUse: [
      'Add webhook URL',
      'Select events to subscribe',
      'Configure retry settings',
      'Test webhook delivery',
    ],
    tips: [
      'Verify webhook signatures for security',
      'Monitor delivery success rate',
      'Handle retries gracefully',
    ],
    relatedDocs: ['settings-api-keys', 'settings-developer'],
  },

  'settings-developer': {
    title: 'Developer Settings',
    description: 'Advanced settings for developers and power users.',
    moduleId: 'SETTINGS_DEVELOPER',
    features: ['Developer mode toggle', 'API logging', 'Debug information', 'Beta features access'],
    howToUse: [
      'Enable developer mode',
      'Turn on API logging for debugging',
      'Access beta features',
    ],
    tips: [
      'Disable in production environments',
      'Use logging sparingly (performance impact)',
      'Beta features may be unstable',
    ],
    relatedDocs: ['settings-api-keys', 'settings-webhooks'],
  },

  // ==========================================
  // ADDITIONAL SETTINGS MODULE CARDS
  // ==========================================

  'settings-ai': {
    title: 'AI Settings',
    titleKey: 'help.cards.settings-ai.title',
    description: 'Configure your AI assistant preferences, model selection, and behavior settings.',
    descriptionKey: 'help.cards.settings-ai.description',
    steps: [
      'Choose your preferred AI model',
      'Set custom instructions for the AI',
      'Configure response parameters',
    ],
    tips: [
      'Custom instructions help AI understand your context',
      'Different models have different strengths',
      'Adjust parameters for creative vs factual responses',
    ],
    relatedDocs: ['settings-ai-model', 'settings-ai-instructions'],
  },

  'settings-search': {
    title: 'Settings Search',
    titleKey: 'help.cards.settings-search.title',
    description: 'Quickly find and navigate to any setting using the search feature.',
    descriptionKey: 'help.cards.settings-search.description',
    steps: [
      'Type keywords to search settings',
      'Click a result to navigate directly',
      'Use filters to narrow results',
    ],
    tips: ['Search by setting name or description', 'Recent searches are saved for quick access'],
    relatedDocs: ['settings-advanced'],
  },

  'settings-notification-rules': {
    title: 'Notification Rules',
    titleKey: 'help.cards.settings-notification-rules.title',
    description: 'Create custom rules to control when and how you receive notifications.',
    descriptionKey: 'help.cards.settings-notification-rules.description',
    steps: [
      'Create a new notification rule',
      'Set conditions (project, type, priority)',
      'Choose notification channels',
    ],
    tips: [
      'Combine conditions for precise control',
      'Test rules before enabling',
      'Use priority rules for urgent items',
    ],
    relatedDocs: ['settings-notifications', 'settings-notification-channels'],
  },

  'settings-notification-channels': {
    title: 'Notification Channels',
    titleKey: 'help.cards.settings-notification-channels.title',
    description: 'Configure how notifications are delivered across different channels.',
    descriptionKey: 'help.cards.settings-notification-channels.description',
    steps: [
      'Enable/disable channels (email, push, in-app)',
      'Set channel-specific preferences',
      'Configure delivery timing',
    ],
    tips: ['Email for non-urgent, push for urgent', 'In-app notifications are always instant'],
    relatedDocs: ['settings-notifications', 'settings-notification-rules'],
  },

  'settings-ai-context': {
    title: 'AI Context Settings',
    titleKey: 'help.cards.settings-ai-context.title',
    description: 'Control what context and information the AI can access to assist you.',
    descriptionKey: 'help.cards.settings-ai-context.description',
    steps: [
      'Choose context sources (projects, tasks, docs)',
      'Set context depth (shallow, medium, deep)',
      'Configure privacy boundaries',
    ],
    tips: ['More context = better AI responses', 'Limit sensitive data access when needed'],
    relatedDocs: ['settings-ai-memory', 'settings-privacy'],
  },

  'settings-billing': {
    title: 'Billing Settings',
    titleKey: 'help.cards.settings-billing.title',
    description: 'Manage your subscription, payment methods, and billing preferences.',
    descriptionKey: 'help.cards.settings-billing.description',
    steps: ['View current subscription plan', 'Update payment methods', 'Download invoices'],
    tips: ['Enable auto-renewal to avoid interruption', 'Check usage to optimize your plan'],
    relatedDocs: ['settings-export-import'],
  },

  'settings-data-controls-extended': {
    title: 'Extended Data Controls',
    titleKey: 'help.cards.settings-data-controls-extended.title',
    description: 'Advanced data management including retention, export, and deletion controls.',
    descriptionKey: 'help.cards.settings-data-controls-extended.description',
    steps: ['Set data retention period', 'Request data export (GDPR)', 'Schedule data deletion'],
    tips: ['Export your data regularly for backup', 'Review retention settings annually'],
    relatedDocs: ['settings-privacy', 'settings-gdpr'],
  },

  'settings-quick-actions': {
    title: 'Quick Actions',
    titleKey: 'help.cards.settings-quick-actions.title',
    description: 'Configure quick action shortcuts for frequently used operations.',
    descriptionKey: 'help.cards.settings-quick-actions.description',
    steps: [
      'Add quick actions to your toolbar',
      'Customize action parameters',
      'Arrange action order',
    ],
    tips: ['Pin your most-used actions', 'Use keyboard shortcuts for speed'],
    relatedDocs: ['settings-shortcuts'],
  },

  'settings-contact-information': {
    title: 'Contact Information',
    titleKey: 'help.cards.settings-contact-information.title',
    description: 'Manage your contact details and communication preferences.',
    descriptionKey: 'help.cards.settings-contact-information.description',
    steps: ['Update email and phone', 'Add backup contact methods', 'Verify contact information'],
    tips: ['Keep backup email for recovery', 'Verify phone for 2FA'],
    relatedDocs: ['settings-profile', 'settings-security'],
  },

  'settings-integration-health': {
    title: 'Integration Health',
    titleKey: 'help.cards.settings-integration-health.title',
    description: 'Monitor the status and health of your connected integrations.',
    descriptionKey: 'help.cards.settings-integration-health.description',
    steps: [
      'View integration status dashboard',
      'Check sync status and errors',
      'Reconnect failed integrations',
    ],
    tips: ['Review health weekly', 'Set up alerts for failures'],
    relatedDocs: ['settings-integrations', 'settings-calendar-sync'],
  },

  'settings-advanced-security': {
    title: 'Advanced Security',
    titleKey: 'help.cards.settings-advanced-security.title',
    description:
      'Configure advanced security features including sessions, devices, and audit logs.',
    descriptionKey: 'help.cards.settings-advanced-security.description',
    steps: ['Review active sessions', 'Manage trusted devices', 'View security audit log'],
    tips: ['Revoke unknown sessions immediately', 'Enable alerts for new devices'],
    relatedDocs: ['settings-security', 'settings-privacy'],
  },

  'settings-integrations-marketplace': {
    title: 'Integrations Marketplace',
    titleKey: 'help.cards.settings-integrations-marketplace.title',
    description: 'Browse and install integrations from the marketplace.',
    descriptionKey: 'help.cards.settings-integrations-marketplace.description',
    steps: [
      'Browse available integrations',
      'Read reviews and requirements',
      'Install and configure',
    ],
    tips: ['Check compatibility before installing', 'Start with popular integrations'],
    relatedDocs: ['settings-integrations'],
  },

  'settings-availability-status': {
    title: 'Availability Status',
    titleKey: 'help.cards.settings-availability-status.title',
    description: 'Set your availability status and working hours preferences.',
    descriptionKey: 'help.cards.settings-availability-status.description',
    steps: ['Set your current status', 'Configure auto-status rules', 'Define working hours'],
    tips: ['Sync with calendar for auto-status', 'Use custom statuses for specific needs'],
    relatedDocs: ['settings-work-preferences', 'settings-calendar-sync'],
  },

  'settings-ai-behavior': {
    title: 'AI Behavior Settings',
    titleKey: 'help.cards.settings-ai-behavior.title',
    description: 'Fine-tune how the AI assistant behaves and responds to your requests.',
    descriptionKey: 'help.cards.settings-ai-behavior.description',
    steps: [
      'Adjust response style and tone',
      'Set creativity level',
      'Configure proactive suggestions',
    ],
    tips: ['Lower creativity for factual tasks', 'Higher creativity for brainstorming'],
    relatedDocs: ['settings-ai-personality', 'settings-ai-parameters'],
  },

  'settings-security': {
    title: 'Security Settings',
    titleKey: 'help.cards.settings-security.title',
    description: 'Manage your account security including password, 2FA, and security alerts.',
    descriptionKey: 'help.cards.settings-security.description',
    steps: ['Change your password', 'Enable two-factor authentication', 'Set up security alerts'],
    tips: ['Use a strong, unique password', 'Enable 2FA for best protection'],
    relatedDocs: ['settings-advanced-security', 'settings-privacy'],
  },

  'settings-keyboard-shortcuts': {
    title: 'Keyboard Shortcuts',
    titleKey: 'help.cards.settings-keyboard-shortcuts.title',
    description: 'Customize keyboard shortcuts for faster navigation and actions.',
    descriptionKey: 'help.cards.settings-keyboard-shortcuts.description',
    steps: ['View all available shortcuts', 'Customize key bindings', 'Create custom shortcuts'],
    tips: ['Learn core shortcuts first', 'Print shortcuts cheat sheet'],
    relatedDocs: ['settings-accessibility', 'settings-shortcuts'],
  },

  'settings-professional-profile': {
    title: 'Professional Profile',
    titleKey: 'help.cards.settings-professional-profile.title',
    description: 'Manage your professional information, skills, and expertise.',
    descriptionKey: 'help.cards.settings-professional-profile.description',
    steps: [
      'Add your job title and department',
      'List your skills and expertise',
      'Set your professional bio',
    ],
    tips: ['Keep skills updated for better AI assistance', 'Add certifications for credibility'],
    relatedDocs: ['settings-profile'],
  },

  'settings-notifications-v2': {
    title: 'Notifications',
    titleKey: 'help.cards.settings-notifications-v2.title',
    description: 'Comprehensive notification management with advanced filtering and scheduling.',
    descriptionKey: 'help.cards.settings-notifications-v2.description',
    steps: [
      'Configure notification preferences',
      'Set up quiet hours',
      'Create notification rules',
    ],
    tips: ['Use digest mode for less interruption', 'Set quiet hours for focus time'],
    relatedDocs: ['settings-notifications', 'settings-notification-rules'],
  },

  'settings-personal-automation': {
    title: 'Personal Automation',
    titleKey: 'help.cards.settings-personal-automation.title',
    description: 'Set up automated workflows for your personal tasks and reminders.',
    descriptionKey: 'help.cards.settings-personal-automation.description',
    steps: [
      'Create automated task workflows',
      'Set up recurring reminders',
      'Configure auto-assign rules',
    ],
    tips: ['Start with simple automations', 'Test before enabling on important tasks'],
    relatedDocs: ['settings-work-preferences'],
  },

  'settings-privacy-visibility': {
    title: 'Privacy & Visibility',
    titleKey: 'help.cards.settings-privacy-visibility.title',
    description: 'Control who can see your profile, activity, and work.',
    descriptionKey: 'help.cards.settings-privacy-visibility.description',
    steps: [
      'Set profile visibility level',
      'Control activity visibility',
      'Manage data sharing preferences',
    ],
    tips: ['Review visibility settings regularly', 'Use team visibility for collaboration'],
    relatedDocs: ['settings-privacy', 'settings-profile'],
  },

  'settings-work': {
    title: 'Work Preferences',
    titleKey: 'help.cards.settings-work.title',
    description: 'Configure your work schedule, task preferences, and productivity settings.',
    descriptionKey: 'help.cards.settings-work.description',
    steps: [
      'Set working days and hours',
      'Configure task scheduling preferences',
      'Enable focus time',
    ],
    tips: ['Sync with your calendar', 'Use focus time for deep work'],
    relatedDocs: ['settings-work-preferences', 'settings-availability-status'],
  },

  'settings-legal': {
    title: 'Legal & Compliance',
    titleKey: 'help.cards.settings-legal.title',
    description: 'View terms of service, privacy policy, and compliance information.',
    descriptionKey: 'help.cards.settings-legal.description',
    steps: ['Review terms of service', 'Read privacy policy', 'View compliance certifications'],
    tips: ['Check for policy updates periodically', 'Download policies for records'],
    relatedDocs: ['settings-privacy', 'settings-gdpr'],
  },

  'settings-personal-analytics': {
    title: 'Personal Analytics',
    titleKey: 'help.cards.settings-personal-analytics.title',
    description: 'View and configure your personal productivity analytics and insights.',
    descriptionKey: 'help.cards.settings-personal-analytics.description',
    steps: ['View productivity dashboard', 'Set personal goals', 'Configure analytics preferences'],
    tips: ['Review weekly for trends', 'Set achievable daily goals'],
    relatedDocs: ['settings-work-preferences'],
  },

  'settings-visual-customization': {
    title: 'Visual Customization',
    titleKey: 'help.cards.settings-visual-customization.title',
    description: 'Customize colors, fonts, and visual elements of the interface.',
    descriptionKey: 'help.cards.settings-visual-customization.description',
    steps: ['Choose accent color', 'Adjust font size', 'Configure UI density'],
    tips: ['High contrast for better readability', 'Use compact mode for more content'],
    relatedDocs: ['settings-appearance', 'settings-accessibility'],
  },

  'settings-ai-model-selection': {
    title: 'AI Model Selection',
    titleKey: 'help.cards.settings-ai-model-selection.title',
    description: 'Choose and configure AI models for different use cases.',
    descriptionKey: 'help.cards.settings-ai-model-selection.description',
    steps: [
      'Select default AI model',
      'Configure fallback model',
      'Set model preferences per task type',
    ],
    tips: ['GPT-4 for complex reasoning', 'Claude for long documents'],
    relatedDocs: ['settings-ai-model', 'settings-ai-parameters'],
  },

  'settings-advanced': {
    title: 'Advanced Settings',
    titleKey: 'help.cards.settings-advanced.title',
    description: 'Access advanced configuration options for power users.',
    descriptionKey: 'help.cards.settings-advanced.description',
    steps: [
      'Configure advanced options',
      'Access experimental features',
      'Manage data export/import',
    ],
    tips: ['Back up settings before changes', 'Use templates for consistent setup'],
    relatedDocs: ['settings-developer', 'settings-export-import'],
  },

  'settings-layout-preferences': {
    title: 'Layout Preferences',
    titleKey: 'help.cards.settings-layout-preferences.title',
    description: 'Customize the application layout and panel arrangement.',
    descriptionKey: 'help.cards.settings-layout-preferences.description',
    steps: ['Choose default layout', 'Configure sidebar behavior', 'Set panel positions'],
    tips: ['Use collapsed sidebar for more space', 'Pin frequently used panels'],
    relatedDocs: ['settings-appearance'],
  },

  'settings-general-preferences': {
    title: 'General Preferences',
    titleKey: 'help.cards.settings-general-preferences.title',
    description: 'Configure general application preferences and defaults.',
    descriptionKey: 'help.cards.settings-general-preferences.description',
    steps: ['Set default views', 'Configure startup behavior', 'Manage general settings'],
    tips: ['Review preferences after updates', 'Reset to defaults if issues occur'],
    relatedDocs: ['settings-appearance', 'settings-work-preferences'],
  },

  'settings-organization': {
    title: 'Organization Settings',
    titleKey: 'help.cards.settings-organization.title',
    description: 'Manage organization-level settings and preferences.',
    descriptionKey: 'help.cards.settings-organization.description',
    steps: [
      'View organization details',
      'Update organization profile',
      'Manage organization preferences',
    ],
    tips: ['Keep organization info updated', 'Review settings quarterly'],
    relatedDocs: ['settings-profile'],
  },
};
