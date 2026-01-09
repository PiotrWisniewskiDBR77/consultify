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

    'superadmin-llm-management': {
        title: 'LLM Management',
        description: 'Configure and manage Large Language Model providers, routing rules, and monitor usage.',
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
        relatedDocs: ['superadmin-overview', 'superadmin-customers'],
    },

    'superadmin-security': {
        title: 'Security Center',
        description: 'Configure security policies, manage access controls, and monitor security events.',
        moduleId: 'SUPERADMIN_SECURITY',
        features: [
            'Security policy management',
            'SSO/SAML configuration',
            'MFA enforcement',
            'IP whitelisting',
            'Audit logging',
            'Security event monitoring',
        ],
        howToUse: [
            'Define security policies in Policies tab',
            'Configure SSO providers in SSO tab',
            'Review security events regularly',
        ],
        tips: [
            'Enforce MFA for all admin users',
            'Review audit logs for suspicious activity',
            'Test SSO configurations in staging first',
        ],
        relatedDocs: ['superadmin-customers', 'superadmin-compliance'],
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
        tips: [
            'Share metrics with stakeholders monthly',
            'Use data to identify training needs',
        ],
        relatedDocs: ['admin-settings'],
    },
};
