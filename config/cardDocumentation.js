/**
 * Card Documentation Registry
 *
 * Contains documentation for all Admin, SuperAdmin, and Settings cards.
 * Used by InfoButton component to show contextual help.
 * Extended with moduleId for integration with HelpSidePanel.
 */
export const CARD_DOCS = {
    // ==========================================
    // USER SETTINGS
    // ==========================================
    'settings-profile': {
        id: 'settings-profile',
        title: 'Personal Information',
        description: 'Manage your personal profile information, including your name, contact details, and display preferences. Changes here affect how you appear to other users in the system.',
        features: [
            'Update your first and last name',
            'Set your phone number and company affiliation',
            'Upload a profile photo',
            'Choose your preferred theme (Light/Dark/System)',
            'Set your preferred language'
        ],
        howToUse: [
            'Fill in your personal details in the form fields',
            'Click "Change Photo" on your avatar to upload a new image',
            'Toggle between Light, Dark, or System theme',
            'Select your preferred language from the dropdown',
            'Click "Save Changes" to apply your updates'
        ],
        tips: [
            'Profile photos are automatically optimized for best quality',
            'Your email address is managed by your organization admin',
            'System theme follows your device preferences automatically'
        ],
        moduleId: 'settings'
    },
    'settings-security': {
        id: 'settings-security',
        title: 'Security Settings',
        description: 'Protect your account with Two-Factor Authentication (2FA) and manage your security preferences. We recommend enabling 2FA for enhanced account protection.',
        features: [
            'Enable/disable Two-Factor Authentication',
            'Generate backup codes for account recovery',
            'View active sessions',
            'Manage trusted devices'
        ],
        howToUse: [
            'Click "Enable 2FA" to start the setup process',
            'Scan the QR code with Google Authenticator or similar app',
            'Enter the 6-digit verification code to complete setup',
            'Save your backup codes in a secure location',
            'Use backup codes if you lose access to your authenticator'
        ],
        tips: [
            'Keep your backup codes in a secure place - they are the only way to recover access',
            'Each backup code can only be used once',
            'Regularly review your active sessions for suspicious activity'
        ],
        moduleId: 'settings'
    },
    'settings-billing': {
        id: 'settings-billing',
        title: 'Billing & Subscription',
        description: 'View your current subscription plan, manage payment methods, and track your usage. Upgrade or change your plan to access more features.',
        features: [
            'View current subscription tier and status',
            'Monitor token usage and quotas',
            'Track storage consumption',
            'Compare available plans',
            'Manage payment methods'
        ],
        howToUse: [
            'Review your current plan details in the Plan Info section',
            'Check usage meters to monitor consumption',
            'Click "Upgrade Plan" to see available options',
            'Compare plan features in the pricing table',
            'Contact support for custom enterprise plans'
        ],
        tips: [
            'Token usage resets monthly based on your billing cycle',
            'Storage includes all uploaded documents and files',
            'Enterprise plans include custom quotas and SLA'
        ],
        moduleId: 'settings'
    },
    'settings-ai': {
        id: 'settings-ai',
        title: 'AI Configuration',
        description: 'Configure your AI assistant preferences including which models to use, API keys for personal providers, and AI behavior settings.',
        features: [
            'Choose default AI provider (System/Google/OpenAI)',
            'Configure personal API keys for direct access',
            'Set preferred AI models for different tasks',
            'Adjust AI response preferences'
        ],
        howToUse: [
            'Select your preferred AI provider from the dropdown',
            'Enter your API key if using personal provider',
            'Choose specific models for different use cases',
            'Save your preferences to apply changes',
            'Test AI responses with different settings'
        ],
        tips: [
            'Personal API keys are stored encrypted and never shared',
            'System default uses the organization\'s configured providers',
            'Different models excel at different tasks - experiment to find your preference'
        ],
        moduleId: 'settings'
    },
    'settings-notifications': {
        id: 'settings-notifications',
        title: 'Notification Preferences',
        description: 'Control how and when you receive notifications. Configure in-app alerts, email notifications, and third-party integrations like Slack or Teams.',
        features: [
            'Toggle in-app notifications by category',
            'Configure email notification preferences',
            'Set up Slack/Teams notifications (if integrated)',
            'Customize notification frequency',
            'Mute specific notification types'
        ],
        howToUse: [
            'Toggle switches for each notification category',
            'Enable email notifications for important updates',
            'Connect integrations to receive notifications in Slack/Teams',
            'Use the grid to fine-tune per-channel preferences',
            'Click "Save Preferences" to apply changes'
        ],
        tips: [
            'Critical notifications are always delivered regardless of settings',
            'Email notifications may have slight delays compared to in-app',
            'Integration channels require separate setup in Integrations section'
        ],
        moduleId: 'settings'
    },
    'settings-integrations': {
        id: 'settings-integrations',
        title: 'Integrations',
        description: 'Connect Consultify with external tools and services. Set up webhooks, connect to Slack/Teams, and configure third-party integrations.',
        features: [
            'Connect to Slack workspaces',
            'Integrate with Microsoft Teams',
            'Configure incoming webhooks',
            'Set up Jira/ClickUp/Trello sync',
            'Manage API connections'
        ],
        howToUse: [
            'Click "Connect" next to the service you want to integrate',
            'Follow the OAuth flow to authorize access',
            'Configure which events trigger notifications',
            'Test the connection with the "Test" button',
            'Remove integrations by clicking "Disconnect"'
        ],
        tips: [
            'Webhook URLs should be kept confidential',
            'Test integrations in a non-production channel first',
            'Some integrations require admin approval in the external service'
        ],
        moduleId: 'settings'
    },
    'settings-regional': {
        id: 'settings-regional',
        title: 'Regional Settings',
        description: 'Configure your timezone, date format, number format, and other localization preferences to match your region.',
        features: [
            'Set your timezone for accurate scheduling',
            'Choose date format (DD/MM/YYYY, MM/DD/YYYY, etc.)',
            'Configure number format (decimal separator)',
            'Set first day of week preference',
            'Currency display format'
        ],
        howToUse: [
            'Select your timezone from the dropdown',
            'Choose your preferred date format',
            'Set number formatting preferences',
            'Configure week start day for calendars',
            'Preview changes before saving'
        ],
        tips: [
            'Timezone affects all scheduled tasks and deadlines',
            'Date format applies to exports and reports',
            'Currency is primarily informational - actual billing uses org settings'
        ],
        moduleId: 'settings'
    },
    'settings-legal': {
        id: 'settings-legal',
        title: 'Legal & Compliance',
        description: 'Review and accept legal documents, manage your consent preferences, and access compliance information required by regulations.',
        features: [
            'Review Terms of Service',
            'Access Privacy Policy',
            'Manage cookie preferences',
            'View consent history',
            'Download personal data (GDPR)'
        ],
        howToUse: [
            'Click on document links to read full text',
            'Review any pending consent requests',
            'Update your marketing preferences',
            'Request data export if needed',
            'Contact DPO for privacy concerns'
        ],
        tips: [
            'Document versions are tracked for compliance',
            'You can withdraw consent at any time',
            'Data export requests are processed within 30 days'
        ],
        moduleId: 'settings'
    },
    'settings-organization': {
        id: 'settings-organization',
        title: 'Organization Settings',
        description: 'View and manage your organization membership, switch between organizations (if applicable), and access organization-specific settings.',
        features: [
            'View current organization details',
            'Switch between organizations',
            'See your role and permissions',
            'Access organization branding',
            'View team members'
        ],
        howToUse: [
            'Review your current organization in the header',
            'Use the switcher to change organizations',
            'Check your assigned role and capabilities',
            'Contact admin to request role changes',
            'View team directory for collaboration'
        ],
        tips: [
            'Each organization may have different features enabled',
            'Your role determines what actions you can perform',
            'Organization admins can invite new members'
        ],
        moduleId: 'settings'
    },
    // ==========================================
    // ADMIN PANEL
    // ==========================================
    'admin-dashboard': {
        id: 'admin-dashboard',
        title: 'Admin Dashboard',
        description: 'Central overview of your organization\'s activity, user statistics, and key metrics. Monitor system health and access quick administration actions.',
        features: [
            'Total users and active user counts',
            'Project statistics and status overview',
            'Recent activity feed',
            'Quick action buttons for common tasks',
            'System alerts and notifications'
        ],
        howToUse: [
            'Review the metrics cards for quick insights',
            'Click on metrics to drill down into details',
            'Use quick action buttons for common admin tasks',
            'Monitor the activity feed for recent changes',
            'Address any system alerts promptly'
        ],
        tips: [
            'Dashboard refreshes automatically every few minutes',
            'Click "Refresh" for immediate updates',
            'Activity feed shows the last 50 actions'
        ],
        moduleId: 'admin'
    },
    'admin-users': {
        id: 'admin-users',
        title: 'User Management',
        description: 'Manage all users in your organization. Add new users, modify roles, control access, and handle user lifecycle from onboarding to offboarding.',
        features: [
            'View all organization users in a table',
            'Invite new users via email',
            'Assign and modify user roles',
            'Activate/deactivate user accounts',
            'Reset user passwords',
            'View user activity and last login'
        ],
        howToUse: [
            'Click "+ Add User" to invite a new team member',
            'Enter their email and select initial role',
            'Use the search bar to find specific users',
            'Click on a user row to view details',
            'Use action buttons to modify roles or status',
            'Bulk select users for batch operations'
        ],
        tips: [
            'Invited users receive an email with setup instructions',
            'Deactivated users cannot login but data is preserved',
            'Regular audits of user access are recommended',
            'Export user list for compliance reporting'
        ],
        moduleId: 'admin'
    },
    'admin-projects': {
        id: 'admin-projects',
        title: 'Project Management',
        description: 'Oversee all transformation projects in your organization. Monitor progress, manage team assignments, and ensure projects stay on track.',
        features: [
            'View all active and archived projects',
            'Create new transformation projects',
            'Assign project owners and team members',
            'Monitor project status and health',
            'Access project analytics and reports'
        ],
        howToUse: [
            'Click "+ New Project" to create a project',
            'Fill in project details and objectives',
            'Assign an owner responsible for the project',
            'Add team members from the organization',
            'Track progress through status indicators',
            'Archive completed projects'
        ],
        tips: [
            'Each project should have a clear owner',
            'Regular status updates keep stakeholders informed',
            'Use tags to categorize projects by type or priority'
        ],
        moduleId: 'admin'
    },
    'admin-llm': {
        id: 'admin-llm',
        title: 'LLM Management',
        description: 'Configure AI language model settings for your organization. Manage API connections, set usage limits, and monitor AI consumption.',
        features: [
            'Configure LLM provider connections',
            'Set organization-wide AI policies',
            'Monitor token usage and costs',
            'Configure model routing rules',
            'Set user-level AI quotas'
        ],
        howToUse: [
            'Select active LLM providers for the organization',
            'Enter API keys for each provider',
            'Configure default models for different functions',
            'Set monthly token limits if needed',
            'Review usage reports regularly'
        ],
        tips: [
            'API keys are encrypted and securely stored',
            'Token costs vary by model - monitor usage closely',
            'Consider setting quotas to control costs'
        ],
        moduleId: 'admin'
    },
    'admin-knowledge': {
        id: 'admin-knowledge',
        title: 'Knowledge Base',
        description: 'Manage the organization\'s knowledge base that powers AI recommendations. Upload documents, manage content, and train AI on your specific context.',
        features: [
            'Upload organizational documents',
            'Manage document categories and tags',
            'View document processing status',
            'Configure AI learning sources',
            'Monitor knowledge base health'
        ],
        howToUse: [
            'Click "Upload" to add new documents',
            'Select document type and assign categories',
            'Wait for processing to complete (may take a few minutes)',
            'Review processed content for accuracy',
            'Remove outdated documents periodically'
        ],
        tips: [
            'PDF, Word, and text files are supported',
            'Smaller, focused documents work better for AI',
            'Update knowledge base when processes change'
        ],
        moduleId: 'admin'
    },
    'admin-metrics': {
        id: 'admin-metrics',
        title: 'Metrics & Analytics',
        description: 'Deep dive into organization metrics including user adoption, feature usage, conversion rates, and transformation progress indicators.',
        features: [
            'User adoption and engagement metrics',
            'Feature usage analytics',
            'Onboarding funnel visualization',
            'Transformation progress tracking',
            'Custom metric dashboards'
        ],
        howToUse: [
            'Select date range for analysis',
            'Review key metrics in summary cards',
            'Click on charts to drill down',
            'Export data for external reporting',
            'Set up alerts for metric thresholds'
        ],
        tips: [
            'Compare metrics across time periods for trends',
            'Focus on leading indicators, not just outcomes',
            'Share dashboards with stakeholders'
        ],
        moduleId: 'admin'
    },
    'admin-ai-health': {
        id: 'admin-ai-health',
        title: 'AI Health Monitor',
        description: 'Monitor the health and performance of AI systems. Track response times, error rates, and overall AI service availability.',
        features: [
            'Real-time AI system status',
            'Response time metrics',
            'Error rate monitoring',
            'Provider availability status',
            'Historical performance data'
        ],
        howToUse: [
            'Check the status indicators for each AI service',
            'Review response time trends',
            'Investigate any elevated error rates',
            'Contact support if issues persist',
            'Monitor after configuration changes'
        ],
        tips: [
            'Green status indicates normal operation',
            'Minor delays during peak hours are normal',
            'Subscribe to status updates for proactive alerts'
        ],
        moduleId: 'admin'
    },
    // ==========================================
    // SUPERADMIN
    // ==========================================
    'superadmin-dashboard': {
        id: 'superadmin-dashboard',
        title: 'Platform Dashboard',
        description: 'Global overview of the entire Consultify platform. Monitor all organizations, users, revenue, and system health from a single view.',
        features: [
            'Total organizations and users across platform',
            'Monthly Recurring Revenue (MRR) tracking',
            'Live active users count',
            'AI usage statistics (calls, tokens)',
            'Recent platform activity feed',
            'Quick actions for common tasks'
        ],
        howToUse: [
            'Review platform-wide metrics at a glance',
            'Click metric cards to navigate to detailed views',
            'Use quick action buttons for common tasks',
            'Monitor activity feed for important events',
            'Click "Refresh" for latest data'
        ],
        tips: [
            '"Live Now" shows currently active users in real-time',
            'Revenue calculations are estimates until invoiced',
            'Activity feed shows cross-organization events'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-organizations': {
        id: 'superadmin-organizations',
        title: 'Organizations',
        description: 'Manage all organizations on the platform. Create new tenants, modify plans, handle access requests, and oversee organization lifecycle.',
        features: [
            'List all organizations with key stats',
            'Create new organizations',
            'Modify organization plans and status',
            'Apply discounts to organizations',
            'Handle access requests',
            'Delete/archive organizations'
        ],
        howToUse: [
            'Use search to find specific organizations',
            'Click on org row to view details',
            'Use "Edit" to modify plan or status',
            'Apply discounts in the edit modal',
            'Review pending access requests',
            'Use "Delete" cautiously - this is irreversible'
        ],
        tips: [
            'Blocked organizations cannot access the platform',
            'Trial organizations convert after payment setup',
            'Discounts apply to future invoices'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-users': {
        id: 'superadmin-users',
        title: 'Global User Management',
        description: 'Manage all users across all organizations. Move users between orgs, impersonate for support, and handle platform-wide user operations.',
        features: [
            'View all users across all organizations',
            'Move users between organizations',
            'Impersonate users for support',
            'Generate password reset links',
            'Block/unblock user accounts',
            'Invite users to specific organizations'
        ],
        howToUse: [
            'Search for users by name or email',
            'Click "Move" to transfer user to another org',
            'Use "Impersonate" to login as user (for support)',
            'Generate reset link and send to user',
            'Block users who violate terms',
            'Click "Invite" to add new user'
        ],
        tips: [
            'Impersonation is logged for security audits',
            'Reset links expire after 24 hours',
            'Moving users preserves their data'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-sso': {
        id: 'superadmin-sso',
        title: 'SSO Configuration',
        description: 'Configure Single Sign-On for organizations. Set up Google Workspace, SAML 2.0, and domain-based authentication routing.',
        features: [
            'Configure Google Workspace SSO',
            'Set up SAML 2.0 identity providers',
            'Map email domains to organizations',
            'Enable/disable SSO per organization',
            'Configure auto-provisioning'
        ],
        howToUse: [
            'Select organization to configure',
            'Choose SSO provider type (Google/SAML)',
            'Enter provider credentials and settings',
            'Configure domain mapping for routing',
            'Test SSO before enforcing',
            'Enable "Enforce SSO" to require SSO login'
        ],
        tips: [
            'Test thoroughly before enforcing SSO',
            'Keep password login enabled during setup',
            'Auto-provisioning creates users on first SSO login'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-security': {
        id: 'superadmin-security',
        title: 'Security Policies',
        description: 'Define platform-wide and per-organization security policies. Configure password requirements, MFA enforcement, session settings, and more.',
        features: [
            'Set password complexity requirements',
            'Configure password expiration policies',
            'Enforce MFA for organizations',
            'Set session timeout durations',
            'Configure failed login lockouts',
            'IP allowlisting (per org)'
        ],
        howToUse: [
            'Review default platform policies',
            'Select organization to customize policies',
            'Adjust password requirements as needed',
            'Enable MFA enforcement with grace period',
            'Set appropriate session timeouts',
            'Configure lockout thresholds'
        ],
        tips: [
            'Balance security with usability',
            'Allow grace period when enabling MFA',
            'Shorter sessions are more secure but less convenient'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-api': {
        id: 'superadmin-api',
        title: 'API Management',
        description: 'Manage API access across the platform. View API usage, manage API keys, configure rate limits, and monitor API health.',
        features: [
            'View platform API statistics',
            'Manage organization API keys',
            'Configure rate limiting rules',
            'Monitor API errors and latency',
            'Review API audit logs'
        ],
        howToUse: [
            'Review API usage metrics',
            'Generate or revoke API keys for orgs',
            'Set rate limits based on plan tier',
            'Investigate error spikes',
            'Export API logs for analysis'
        ],
        tips: [
            'Rate limits prevent abuse and ensure fairness',
            'API keys should be rotated periodically',
            'Monitor error rates for integration issues'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-billing': {
        id: 'superadmin-billing',
        title: 'Billing Center',
        description: 'Central hub for all billing operations. Manage subscription plans, configure pricing, track revenue, and oversee the token economy.',
        features: [
            'MRR and ARR dashboards',
            'Subscription plan management',
            'Token pricing configuration',
            'Usage-based billing settings',
            'Payment processing overview'
        ],
        howToUse: [
            'Review revenue metrics in overview tab',
            'Manage plans in Subscription Plans tab',
            'Configure token costs in Token Economy',
            'View transaction history',
            'Set up new pricing tiers as needed'
        ],
        tips: [
            'Plan changes affect new subscriptions only',
            'Token margins should cover provider costs',
            'Revenue metrics update in near real-time'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-invoices': {
        id: 'superadmin-invoices',
        title: 'Invoice Center',
        description: 'Manage all invoices and billing documents. Create invoices, issue credit notes, configure tax settings, and track payment status.',
        features: [
            'View all invoices across organizations',
            'Create manual invoices',
            'Issue credit notes and refunds',
            'Configure tax settings',
            'Set up usage-based billing rates'
        ],
        howToUse: [
            'Use filters to find specific invoices',
            'Click "Create Invoice" for manual billing',
            'Issue credit notes for adjustments',
            'Configure tax rates in Tax Settings',
            'Set overage rates in Usage Billing'
        ],
        tips: [
            'Credit notes link to original invoices',
            'Tax settings vary by region - consult accountant',
            'Usage billing is calculated at period end'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-whitelabel': {
        id: 'superadmin-whitelabel',
        title: 'White-label Studio',
        description: 'Customize branding for organizations. Configure logos, colors, typography, and login pages for white-labeled deployments.',
        features: [
            'Upload custom logos (light/dark modes)',
            'Configure brand colors and themes',
            'Customize typography settings',
            'Design custom login pages',
            'Set up custom domains'
        ],
        howToUse: [
            'Select organization to customize',
            'Upload logos in Brand Identity tab',
            'Set colors in Color Palette tab',
            'Configure fonts in Typography tab',
            'Design login page in Login tab',
            'Preview changes before publishing'
        ],
        tips: [
            'Upload logos in both light and dark versions',
            'Test colors for accessibility (contrast)',
            'Custom domains require DNS configuration'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-compliance': {
        id: 'superadmin-compliance',
        title: 'Compliance Center',
        description: 'Manage regulatory compliance across the platform. Handle GDPR data requests, schedule audits, and track processing records.',
        features: [
            'Overall compliance score dashboard',
            'Regulatory framework tracking',
            'Data Subject Access Requests (DSAR)',
            'Compliance audit scheduling',
            'Processing records (GDPR Art. 30)'
        ],
        howToUse: [
            'Review compliance score in Overview',
            'Track framework compliance in Frameworks',
            'Process DSARs within legal deadlines',
            'Schedule regular compliance audits',
            'Maintain processing records'
        ],
        tips: [
            'DSAR requests must be completed within 30 days',
            'Regular audits help identify gaps',
            'Processing records are legally required'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-ai-config': {
        id: 'superadmin-ai-config',
        title: 'AI Configuration',
        description: 'Platform-wide AI system configuration. Manage AI functions, LLM providers, model routing, and monitor AI usage across all organizations.',
        features: [
            'Configure AI function instructions',
            'Manage LLM provider connections',
            'Set up intelligent model routing',
            'Monitor AI usage and costs',
            'View AI system health'
        ],
        howToUse: [
            'Edit AI functions in AI Functions tab',
            'Configure providers in LLM Providers',
            'Set routing rules in Model Routing',
            'Review usage in Usage & Costs',
            'Check health in System Health'
        ],
        tips: [
            'Clear instructions improve AI quality',
            'Route complex tasks to capable models',
            'Monitor costs regularly to optimize spend'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-knowledge': {
        id: 'superadmin-knowledge',
        title: 'Global Knowledge Base',
        description: 'Manage the platform-wide knowledge base that enhances AI capabilities. Upload system documents and manage shared knowledge resources.',
        features: [
            'Upload platform-wide documents',
            'Manage global knowledge categories',
            'Monitor processing status',
            'Configure knowledge sharing rules',
            'View knowledge base statistics'
        ],
        howToUse: [
            'Upload documents that apply to all orgs',
            'Categorize for better organization',
            'Wait for processing to complete',
            'Set visibility rules per category',
            'Remove outdated content regularly'
        ],
        tips: [
            'Global knowledge supplements org knowledge',
            'Keep documents focused and up-to-date',
            'Processing time depends on document size'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-settings': {
        id: 'superadmin-settings',
        title: 'System Settings',
        description: 'Core platform configuration including application identity, security defaults, email settings, and advanced database operations.',
        features: [
            'Application name and branding',
            'Security default settings',
            'Email/SMTP configuration',
            'Legal document URLs',
            'Super admin account management',
            'Storage monitoring',
            'Audit log access',
            'Advanced database operations'
        ],
        howToUse: [
            'Configure app identity in General',
            'Set security defaults in Security',
            'Configure email in Email/SMTP',
            'Update legal URLs in Legal',
            'Manage super admins in Super Admins',
            'Monitor storage in Storage',
            'Review logs in Audit Logs'
        ],
        tips: [
            'Test SMTP settings before going live',
            'Maintain at least 2 super admin accounts',
            'Use Advanced tab with extreme caution'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-feedback': {
        id: 'superadmin-feedback',
        title: 'User Feedback Center',
        description: 'Central hub for reviewing and managing user-submitted feedback across the platform. Track bug reports, feature ideas, and user suggestions from all organizations.',
        features: [
            'View all user feedback submissions',
            'Filter by type (Bug/Idea)',
            'Track feedback status (New/Read/Resolved)',
            'Search across all feedback',
            'Mark items as resolved',
            'View submitter details and organization'
        ],
        howToUse: [
            'Review new feedback submissions daily',
            'Filter by type to prioritize bug reports',
            'Mark items as read when reviewed',
            'Update status to resolved when addressed',
            'Use search to find related feedback',
            'Export feedback for team review'
        ],
        tips: [
            'Bug reports should be prioritized over feature ideas',
            'Respond to critical bugs within 24 hours',
            'Group similar feedback for pattern identification'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-bulk-ops': {
        id: 'superadmin-bulk-ops',
        title: 'Bulk Operations',
        description: 'Execute mass operations across multiple organizations, users, or entities. Perform bulk updates, migrations, and administrative actions efficiently.',
        features: [
            'Bulk user operations (activate/deactivate)',
            'Mass organization updates',
            'Batch data migrations',
            'Bulk notification sending',
            'Multi-tenant data operations',
            'Scheduled bulk tasks'
        ],
        howToUse: [
            'Select operation type from available options',
            'Define target entities using filters',
            'Preview affected records before execution',
            'Confirm operation with admin verification',
            'Monitor progress in real-time',
            'Review operation log upon completion'
        ],
        tips: [
            'Always preview before executing bulk operations',
            'Schedule large operations during off-peak hours',
            'Keep backup before major data migrations'
        ],
        moduleId: 'superadmin'
    },
    'superadmin-playbooks': {
        id: 'superadmin-playbooks',
        title: 'Playbook Templates',
        description: 'Manage AI automation playbook templates that define standard workflows distributed to all tenant organizations. Create, validate, and publish templates for platform-wide use.',
        features: [
            'List all playbook templates with status',
            'Create new playbook templates',
            'Validate template structure',
            'Publish templates to make available',
            'Archive deprecated templates',
            'View template usage statistics'
        ],
        howToUse: [
            'Browse existing templates by status',
            'Click "+ New Template" to create',
            'Use "Validate" to check template structure',
            'Publish valid templates for organization use',
            'Archive old versions instead of deleting',
            'Monitor usage across organizations'
        ],
        tips: [
            'Always validate templates before publishing',
            'Use descriptive keys for programmatic access',
            'Deprecate old versions to preserve history'
        ],
        moduleId: 'playbook-templates'
    },
    'superadmin-playbook-editor': {
        id: 'superadmin-playbook-editor',
        title: 'Playbook Visual Editor',
        description: 'Visual drag-and-drop editor for designing AI automation playbooks. Define triggers, agent actions, conditions, and workflow logic graphically.',
        features: [
            'Visual node-based editor',
            'Drag-and-drop workflow design',
            'Node types: Trigger, Agent Task, Human Review, Condition, End',
            'Edge connections between nodes',
            'Real-time validation',
            'Template metadata editing',
            'Graph export/import'
        ],
        howToUse: [
            'Start with a Trigger node defining activation condition',
            'Add Agent Task nodes for AI actions',
            'Use Condition nodes for branching logic',
            'Connect nodes with edges to define flow',
            'Add Human Review nodes for approval steps',
            'End flows with End nodes',
            'Validate and save template'
        ],
        tips: [
            'Every playbook needs exactly one Trigger node',
            'Ensure all paths lead to End nodes',
            'Test playbooks with sample data before publishing',
            'Use clear node labels for maintainability'
        ],
        moduleId: 'playbook-templates'
    },
    // ==========================================
    // ASSESSMENT MODULE
    // ==========================================
    'assessment-drd': {
        id: 'assessment-drd',
        title: 'DRD Assessment',
        description: 'Digital Readiness Diagnostic (DRD) is a comprehensive 7-dimension assessment framework covering Strategy, Organization, Operations, Technology, Data, Customer, and Innovation readiness.',
        features: [
            '7 dimensions with 35+ sub-dimensions',
            'Maturity level 1-5 scoring',
            'Evidence-based validation',
            'AI-assisted scoring suggestions',
            'Gap analysis and benchmarking',
            'Actionable recommendations per dimension'
        ],
        howToUse: [
            'Start with Strategy dimension for context',
            'Work through dimensions sequentially',
            'Upload supporting evidence for each score',
            'Review AI suggestions but apply judgment',
            'Complete all dimensions for full analysis',
            'Export results for stakeholder review'
        ],
        tips: [
            'Score based on current state, not aspirations',
            'Evidence strengthens assessment validity',
            'Involve multiple stakeholders for accuracy'
        ],
        moduleId: 'assessment'
    },
    'assessment-siri': {
        id: 'assessment-siri',
        title: 'SIRI Assessment',
        description: 'Smart Industry Readiness Index (SIRI) is specifically designed for manufacturing and industrial organizations assessing Industry 4.0 readiness.',
        features: [
            '3 building blocks (Process, Technology, Organization)',
            '8 pillars with 16 dimensions',
            'Manufacturing-specific metrics',
            'Industry 4.0 maturity levels',
            'Comparative benchmarking',
            'Transformation prioritization matrix'
        ],
        howToUse: [
            'Ensure industrial context is set up',
            'Assess Process block first',
            'Evaluate Technology capabilities',
            'Complete Organization readiness',
            'Review heat map for gaps',
            'Use prioritization matrix for planning'
        ],
        tips: [
            'Best for manufacturing companies',
            'Consider shopfloor input for accuracy',
            'Benchmark against industry peers'
        ],
        moduleId: 'assessment'
    },
    'assessment-adma': {
        id: 'assessment-adma',
        title: 'ADMA Assessment',
        description: 'Advanced Manufacturing Assessment framework for evaluating production excellence, lean practices, and operational efficiency.',
        features: [
            'Lean manufacturing metrics',
            'OEE benchmarking',
            'Quality management assessment',
            'Supply chain integration',
            'Sustainability metrics',
            'Continuous improvement tracking'
        ],
        howToUse: [
            'Start with current production metrics',
            'Evaluate lean practices maturity',
            'Assess quality management systems',
            'Review supply chain integration',
            'Complete sustainability assessment',
            'Identify improvement priorities'
        ],
        tips: [
            'Gather OEE data before starting',
            'Involve production team members',
            'Compare with industry benchmarks'
        ],
        moduleId: 'assessment'
    },
    'assessment-cmmi': {
        id: 'assessment-cmmi',
        title: 'CMMI-DMM Assessment',
        description: 'Data Management Maturity (CMMI-DMM) assessment for organizations focusing on data governance, quality, and analytics capabilities.',
        features: [
            '25 process areas across 6 categories',
            'Data governance assessment',
            'Data quality evaluation',
            'Analytics maturity scoring',
            'Data architecture review',
            'Platform capability assessment'
        ],
        howToUse: [
            'Begin with Data Strategy category',
            'Assess Data Governance practices',
            'Evaluate Data Quality processes',
            'Review Data Operations maturity',
            'Complete Platform assessment',
            'Analyze Supporting Processes'
        ],
        tips: [
            'Ideal for data-driven initiatives',
            'Involve CDO/Data team leadership',
            'Document data-related policies'
        ],
        moduleId: 'assessment'
    },
    'assessment-lean': {
        id: 'assessment-lean',
        title: 'Lean 4.0 Assessment',
        description: 'Combined Lean methodology with Industry 4.0 technologies assessment for operational excellence and digital transformation.',
        features: [
            'Traditional lean metrics',
            'Digital lean integration',
            'Automation readiness',
            'Digital value stream mapping',
            'Smart manufacturing capabilities',
            'Kaizen digitalization'
        ],
        howToUse: [
            'Assess current lean maturity',
            'Evaluate digital integration',
            'Review automation capabilities',
            'Map digital value streams',
            'Identify technology opportunities',
            'Create improvement roadmap'
        ],
        tips: [
            'Foundation in lean principles required',
            'Consider digital twins for VSM',
            'Balance lean basics with technology'
        ],
        moduleId: 'assessment'
    },
    'assessment-context': {
        id: 'assessment-context',
        title: 'Assessment Context Setup',
        description: 'Configure the context and parameters for your assessment including scope, objectives, and assessment team.',
        features: [
            'Assessment scope definition',
            'Objectives and success criteria',
            'Team member assignment',
            'Timeline configuration',
            'Stakeholder identification',
            'Evidence requirements setup'
        ],
        howToUse: [
            'Define assessment scope clearly',
            'Set measurable objectives',
            'Assign responsible team members',
            'Establish realistic timeline',
            'Identify key stakeholders',
            'Configure evidence requirements'
        ],
        tips: [
            'Clear scope prevents scope creep',
            'SMART objectives work best',
            'Include diverse stakeholder perspectives'
        ],
        moduleId: 'assessment'
    },
    'assessment-summary': {
        id: 'assessment-summary',
        title: 'Assessment Summary',
        description: 'Comprehensive summary view of completed assessment with scores, gaps, recommendations, and export options.',
        features: [
            'Overall maturity score',
            'Dimension-by-dimension breakdown',
            'Strength and weakness analysis',
            'Gap visualization',
            'AI-generated recommendations',
            'Export to PDF/PowerPoint'
        ],
        howToUse: [
            'Review overall maturity score',
            'Analyze dimension breakdowns',
            'Identify strengths and weaknesses',
            'Study gap analysis results',
            'Review AI recommendations',
            'Export for stakeholder sharing'
        ],
        tips: [
            'Share summary with leadership',
            'Use gaps to drive initiatives',
            'Track progress with reassessments'
        ],
        moduleId: 'assessment'
    },
    'my-assessments': {
        id: 'my-assessments',
        title: 'My Assessments',
        description: 'Personal dashboard showing all assessments you are involved in, either as contributor, owner, or reviewer.',
        features: [
            'Assessment portfolio view',
            'Status tracking (draft, in-progress, complete)',
            'Deadline monitoring',
            'Quick access to continue work',
            'Historical assessments archive',
            'Comparison across assessments'
        ],
        howToUse: [
            'View all your assessments',
            'Filter by status or framework',
            'Continue incomplete assessments',
            'Review completed assessments',
            'Access historical data',
            'Compare assessment results'
        ],
        tips: [
            'Complete drafts before deadlines',
            'Review historical trends',
            'Archive outdated assessments'
        ],
        moduleId: 'assessment'
    },
    'reviewer-dashboard': {
        id: 'reviewer-dashboard',
        title: 'Reviewer Dashboard',
        description: 'Quality assurance view for designated reviewers to approve, reject, or request changes on submitted assessments.',
        features: [
            'Pending reviews queue',
            'Evidence verification tools',
            'Score validation interface',
            'Comment and feedback system',
            'Approval workflow',
            'Review history tracking'
        ],
        howToUse: [
            'Check pending reviews queue',
            'Review submitted evidence',
            'Validate scoring accuracy',
            'Add comments for improvements',
            'Approve or request changes',
            'Track review decisions'
        ],
        tips: [
            'Provide constructive feedback',
            'Verify evidence authenticity',
            'Maintain consistent standards'
        ],
        moduleId: 'assessment'
    },
    'gap-map': {
        id: 'gap-map',
        title: 'Gap Analysis Map',
        description: 'Visual representation of gaps between current and target maturity levels across all assessed dimensions.',
        features: [
            'Interactive gap visualization',
            'Current vs target comparison',
            'Priority heat mapping',
            'Drill-down capabilities',
            'Export and sharing',
            'Initiative linking'
        ],
        howToUse: [
            'Set target maturity levels',
            'Review gap visualization',
            'Identify priority areas (red)',
            'Drill down into dimensions',
            'Link gaps to initiatives',
            'Export for planning sessions'
        ],
        tips: [
            'Focus on high-impact gaps first',
            'Realistic targets prevent frustration',
            'Use gaps to justify initiatives'
        ],
        moduleId: 'assessment'
    },
    // ==========================================
    // INITIATIVES MODULE
    // ==========================================
    'initiatives-list': {
        id: 'initiatives-list',
        title: 'Initiatives Portfolio',
        description: 'Complete list of all transformation initiatives with filtering, sorting, and portfolio management capabilities.',
        features: [
            'Portfolio overview with metrics',
            'Advanced filtering and sorting',
            'Bulk operations support',
            'Status workflow management',
            'Resource allocation view',
            'Initiative templates'
        ],
        howToUse: [
            'View all initiatives in list or grid',
            'Filter by status, priority, or owner',
            'Bulk update multiple initiatives',
            'Track progress through status',
            'Monitor resource utilization',
            'Use templates for new initiatives'
        ],
        tips: [
            'Regular portfolio reviews are key',
            'Archive completed initiatives',
            'Balance portfolio across dimensions'
        ],
        moduleId: 'initiatives'
    },
    'initiative-generator': {
        id: 'initiative-generator',
        title: 'AI Initiative Generator',
        description: 'Intelligent initiative suggestion engine that analyzes assessment gaps and recommends tailored transformation initiatives.',
        features: [
            'Gap-based recommendations',
            'Industry best practice suggestions',
            'Impact and effort estimation',
            'Resource requirement forecasting',
            'Dependency identification',
            'Business case generation'
        ],
        howToUse: [
            'Select assessment gaps to address',
            'Configure generation parameters',
            'Review AI suggestions',
            'Customize recommended initiatives',
            'Validate business case',
            'Add approved initiatives to portfolio'
        ],
        tips: [
            'Better assessment = better suggestions',
            'Review all options before selecting',
            'Customize AI suggestions to context'
        ],
        moduleId: 'initiatives'
    },
    'initiative-detail': {
        id: 'initiative-detail',
        title: 'Initiative Details',
        description: 'Comprehensive view of a single initiative including objectives, tasks, timeline, resources, risks, and progress tracking.',
        features: [
            'Initiative overview and objectives',
            'Task breakdown structure',
            'Timeline and milestones',
            'Resource assignments',
            'Risk register',
            'Progress tracking and reporting'
        ],
        howToUse: [
            'Review initiative objectives',
            'Break down into tasks',
            'Set timeline and milestones',
            'Assign resources',
            'Identify and track risks',
            'Update progress regularly'
        ],
        tips: [
            'SMART objectives drive success',
            'Regular updates keep momentum',
            'Proactive risk management is key'
        ],
        moduleId: 'initiatives'
    },
    // ==========================================
    // ROADMAP MODULE
    // ==========================================
    'roadmap-view': {
        id: 'roadmap-view',
        title: 'Roadmap Overview',
        description: 'Strategic timeline view of your transformation journey showing phases, initiatives, and milestones.',
        features: [
            'Visual transformation timeline',
            'Phase-based organization',
            'Initiative positioning',
            'Milestone tracking',
            'Resource capacity overlay',
            'Dependency visualization'
        ],
        howToUse: [
            'View transformation timeline',
            'Organize initiatives into phases',
            'Position initiatives on timeline',
            'Set key milestones',
            'Monitor resource capacity',
            'Visualize dependencies'
        ],
        tips: [
            'Keep roadmap focused and achievable',
            'Regular reviews ensure relevance',
            'Communicate roadmap to stakeholders'
        ],
        moduleId: 'roadmap'
    },
    'roadmap-gantt': {
        id: 'roadmap-gantt',
        title: 'Gantt Chart View',
        description: 'Traditional Gantt chart visualization for detailed scheduling and dependency management.',
        features: [
            'Interactive Gantt bars',
            'Dependency arrows',
            'Critical path highlighting',
            'Resource loading view',
            'Baseline comparison',
            'Drag-and-drop scheduling'
        ],
        howToUse: [
            'View initiatives as Gantt bars',
            'Create dependency links',
            'Identify critical path',
            'Review resource loading',
            'Compare against baseline',
            'Adjust schedule by dragging'
        ],
        tips: [
            'Critical path determines min duration',
            'Buffer time reduces risk',
            'Update baseline when approved'
        ],
        moduleId: 'roadmap'
    },
    'roadmap-phases': {
        id: 'roadmap-phases',
        title: 'Transformation Phases',
        description: 'Define and manage transformation phases that group related initiatives and provide structure to your journey.',
        features: [
            'Phase definition and editing',
            'Initiative assignment to phases',
            'Phase objectives and criteria',
            'Phase gate reviews',
            'Progress tracking per phase',
            'Phase templates'
        ],
        howToUse: [
            'Define transformation phases',
            'Set phase objectives',
            'Assign initiatives to phases',
            'Configure gate criteria',
            'Track phase progress',
            'Conduct phase reviews'
        ],
        tips: [
            '3-5 phases is typically optimal',
            'Clear objectives per phase',
            'Gate reviews ensure quality'
        ],
        moduleId: 'roadmap'
    },
    // ==========================================
    // IMPLEMENTATION MODULE
    // ==========================================
    'implementation-center': {
        id: 'implementation-center',
        title: 'Implementation Center',
        description: 'Central hub for managing active initiative implementations including status tracking, issue management, and change control.',
        features: [
            'Active implementations dashboard',
            'Status and health indicators',
            'Issue and risk tracking',
            'Change request management',
            'Stakeholder communication',
            'Implementation playbooks'
        ],
        howToUse: [
            'Monitor active implementations',
            'Track status and health',
            'Manage issues and risks',
            'Process change requests',
            'Communicate with stakeholders',
            'Follow implementation playbooks'
        ],
        tips: [
            'Daily standups maintain momentum',
            'Early issue escalation is key',
            'Document lessons learned'
        ],
        moduleId: 'implementation'
    },
    'implementation-pilot': {
        id: 'implementation-pilot',
        title: 'Pilot Management',
        description: 'Design, execute, and evaluate pilot programs to validate initiatives before full-scale rollout.',
        features: [
            'Pilot design wizard',
            'Success criteria definition',
            'Pilot execution tracking',
            'Data collection and analysis',
            'Go/no-go decision framework',
            'Rollout planning'
        ],
        howToUse: [
            'Design pilot scope and criteria',
            'Define success metrics',
            'Execute and monitor pilot',
            'Collect and analyze data',
            'Make go/no-go decision',
            'Plan full rollout'
        ],
        tips: [
            'Small scope reduces pilot risk',
            'Clear criteria enable decisions',
            'Document findings thoroughly'
        ],
        moduleId: 'implementation'
    },
    'implementation-rollout': {
        id: 'implementation-rollout',
        title: 'Rollout Management',
        description: 'Plan and execute full-scale deployment of validated initiatives across the organization.',
        features: [
            'Rollout wave planning',
            'Site/team deployment scheduling',
            'Training coordination',
            'Support escalation management',
            'Adoption tracking',
            'Stabilization monitoring'
        ],
        howToUse: [
            'Plan rollout waves',
            'Schedule deployments',
            'Coordinate training',
            'Monitor adoption rates',
            'Manage support escalations',
            'Ensure stabilization'
        ],
        tips: [
            'Phased rollout reduces risk',
            'Training drives adoption',
            'Support during stabilization is critical'
        ],
        moduleId: 'implementation'
    },
    // ==========================================
    // REPORTS MODULE
    // ==========================================
    'reports-overview': {
        id: 'reports-overview',
        title: 'Reports Center',
        description: 'Central hub for all reporting capabilities including standard reports, custom reports, and scheduled distributions.',
        features: [
            'Standard report library',
            'Custom report builder',
            'Report scheduling',
            'Distribution management',
            'Export formats (PDF, Excel, PPT)',
            'Report templates'
        ],
        howToUse: [
            'Browse standard reports',
            'Build custom reports',
            'Schedule recurring reports',
            'Configure distribution lists',
            'Export in preferred format',
            'Save report templates'
        ],
        tips: [
            'Standard reports cover most needs',
            'Schedule weekly summaries',
            'Use templates for consistency'
        ],
        moduleId: 'reports'
    },
    'reports-roi': {
        id: 'reports-roi',
        title: 'ROI Calculator',
        description: 'Calculate and track return on investment for transformation initiatives including NPV, payback period, and IRR.',
        features: [
            'Investment tracking',
            'Benefit realization tracking',
            'NPV calculation',
            'Payback period analysis',
            'IRR calculation',
            'Sensitivity analysis'
        ],
        howToUse: [
            'Enter investment costs',
            'Define expected benefits',
            'Configure discount rate',
            'Review NPV and payback',
            'Analyze IRR results',
            'Run sensitivity scenarios'
        ],
        tips: [
            'Conservative estimates are safer',
            'Include all cost categories',
            'Update actuals regularly'
        ],
        moduleId: 'reports'
    },
    'reports-executive': {
        id: 'reports-executive',
        title: 'Executive Summary',
        description: 'One-page executive summary report designed for board presentations and stakeholder updates.',
        features: [
            'Single-page format',
            'Key metrics dashboard',
            'Progress highlights',
            'Risk and issue summary',
            'Next period priorities',
            'Branding customization'
        ],
        howToUse: [
            'Select reporting period',
            'Review auto-generated summary',
            'Add custom highlights',
            'Include risk callouts',
            'Set next period priorities',
            'Export with branding'
        ],
        tips: [
            'Focus on outcomes not activities',
            'Lead with achievements',
            'Clear calls to action'
        ],
        moduleId: 'reports'
    },
    'reports-kpi-okr': {
        id: 'reports-kpi-okr',
        title: 'KPI & OKR Dashboard',
        description: 'Track Key Performance Indicators and Objectives & Key Results for transformation program measurement.',
        features: [
            'KPI definition and tracking',
            'OKR cascade management',
            'Target vs actual visualization',
            'Trend analysis',
            'Automated data collection',
            'Alert configuration'
        ],
        howToUse: [
            'Define transformation KPIs',
            'Set OKRs with targets',
            'Track progress over time',
            'Analyze trends',
            'Configure alerts for thresholds',
            'Review in stakeholder meetings'
        ],
        tips: [
            'Fewer KPIs = better focus',
            'Leading indicators predict outcomes',
            'Quarterly OKR reviews work well'
        ],
        moduleId: 'reports'
    },
    // ==========================================
    // MY WORK MODULE
    // ==========================================
    'mywork-tasks': {
        id: 'mywork-tasks',
        title: 'My Tasks',
        description: 'Personal task list showing all tasks assigned to you across all initiatives and projects.',
        features: [
            'Consolidated task view',
            'Priority-based sorting',
            'Due date tracking',
            'Quick status updates',
            'Task grouping options',
            'Time tracking'
        ],
        howToUse: [
            'View all assigned tasks',
            'Sort by priority or due date',
            'Update task status quickly',
            'Group by initiative or project',
            'Log time spent',
            'Mark tasks complete'
        ],
        tips: [
            'Start day with P1 tasks',
            'Update status daily',
            'Use time tracking for planning'
        ],
        moduleId: 'mywork'
    },
    'mywork-inbox': {
        id: 'mywork-inbox',
        title: 'Inbox',
        description: 'Notification center for all mentions, assignments, approvals, and updates requiring your attention.',
        features: [
            'Unified notification stream',
            'Action-required filtering',
            'Quick actions from inbox',
            'Read/unread management',
            'Archive capability',
            'Notification preferences'
        ],
        howToUse: [
            'Review new notifications',
            'Filter by type or urgency',
            'Take action directly from inbox',
            'Mark items as read',
            'Archive resolved items',
            'Configure notification preferences'
        ],
        tips: [
            'Process inbox regularly',
            'Use filters to prioritize',
            'Archive to reduce clutter'
        ],
        moduleId: 'mywork'
    },
    'mywork-focus': {
        id: 'mywork-focus',
        title: 'Focus Mode',
        description: 'Distraction-free work environment for deep work on assessments, initiatives, or complex tasks.',
        features: [
            'Minimalist interface',
            'Notification muting',
            'Timer/Pomodoro support',
            'Progress persistence',
            'Quick exit (ESC)',
            'Session statistics'
        ],
        howToUse: [
            'Enter focus mode for deep work',
            'Select task to focus on',
            'Set focus duration',
            'Work without distractions',
            'Exit with ESC when done',
            'Review session statistics'
        ],
        tips: [
            'Use for complex assessments',
            'Pomodoro technique effective',
            'Inform team before focusing'
        ],
        moduleId: 'mywork'
    },
    // ==========================================
    // ORGANIZATION MODULE
    // ==========================================
    'org-context': {
        id: 'org-context',
        title: 'Organization Context',
        description: 'Central configuration for organizational context that powers AI recommendations and benchmarking.',
        features: [
            'Company profile setup',
            'Industry classification',
            'Size and geography',
            'Strategic context',
            'Cultural attributes',
            'Context completeness score'
        ],
        howToUse: [
            'Complete company profile',
            'Select accurate industry',
            'Set size and geography',
            'Define strategic context',
            'Add cultural attributes',
            'Achieve high completeness score'
        ],
        tips: [
            'Complete context = better AI',
            'Update quarterly',
            'Accurate industry improves benchmarks'
        ],
        moduleId: 'organization'
    },
    'org-profile': {
        id: 'org-profile',
        title: 'Company Profile',
        description: 'Basic company information including name, industry, size, locations, and company description.',
        features: [
            'Company name and legal entity',
            'Industry and sub-industry',
            'Employee count and revenue',
            'Headquarters and locations',
            'Company description',
            'Logo and branding'
        ],
        howToUse: [
            'Enter company name',
            'Select industry classification',
            'Set size metrics',
            'Add location information',
            'Write company description',
            'Upload logo'
        ],
        tips: [
            'Accurate size enables benchmarking',
            'Description helps AI context',
            'Update after significant changes'
        ],
        moduleId: 'organization'
    },
    'org-goals': {
        id: 'org-goals',
        title: 'Strategic Goals',
        description: 'Define transformation goals that guide initiative prioritization and success measurement.',
        features: [
            'Goal definition wizard',
            'Priority ranking',
            'Target metrics',
            'Timeline assignment',
            'Initiative linking',
            'Progress tracking'
        ],
        howToUse: [
            'Define strategic goals',
            'Rank by priority',
            'Set measurable targets',
            'Assign timelines',
            'Link to initiatives',
            'Track progress'
        ],
        tips: [
            '3-5 goals maintains focus',
            'SMART goals work best',
            'Review goals quarterly'
        ],
        moduleId: 'organization'
    },
    'org-challenges': {
        id: 'org-challenges',
        title: 'Current Challenges',
        description: 'Document organizational challenges and pain points that transformation should address.',
        features: [
            'Challenge categorization',
            'Impact assessment',
            'Root cause analysis',
            'Initiative linking',
            'Resolution tracking',
            'Challenge prioritization'
        ],
        howToUse: [
            'Document key challenges',
            'Categorize by area',
            'Assess impact',
            'Analyze root causes',
            'Link to initiatives',
            'Track resolution'
        ],
        tips: [
            'Focus on significant challenges',
            'Root cause drives solutions',
            'Update as challenges evolve'
        ],
        moduleId: 'organization'
    },
    'org-megatrends': {
        id: 'org-megatrends',
        title: 'Megatrends Tracking',
        description: 'Monitor external megatrends affecting your industry and organization to inform transformation strategy.',
        features: [
            'Trend library access',
            'Industry-relevant filtering',
            'Impact assessment',
            'Opportunity identification',
            'Threat analysis',
            'Strategic response planning'
        ],
        howToUse: [
            'Browse trend library',
            'Filter for your industry',
            'Assess impact on organization',
            'Identify opportunities',
            'Analyze threats',
            'Plan strategic response'
        ],
        tips: [
            'Focus on high-impact trends',
            'Balance opportunities and threats',
            'Review trends quarterly'
        ],
        moduleId: 'organization'
    },
    'org-strategy': {
        id: 'org-strategy',
        title: 'Transformation Strategy',
        description: 'Define overall transformation strategy including vision, approach, and success criteria.',
        features: [
            'Vision statement definition',
            'Strategic approach selection',
            'Success criteria setting',
            'Scope boundaries',
            'Governance model',
            'Communication plan'
        ],
        howToUse: [
            'Define transformation vision',
            'Select strategic approach',
            'Set success criteria',
            'Define scope boundaries',
            'Establish governance',
            'Plan communications'
        ],
        tips: [
            'Clear vision aligns stakeholders',
            'Approach should match culture',
            'Communicate strategy widely'
        ],
        moduleId: 'organization'
    },
    // ==========================================
    // ONBOARDING MODULE
    // ==========================================
    'onboarding-profile': {
        id: 'onboarding-profile',
        title: 'Profile Setup',
        description: 'Initial profile configuration for new users including personal information and preferences.',
        features: [
            'Personal information entry',
            'Profile photo upload',
            'Language preference',
            'Timezone setting',
            'Notification preferences',
            'Theme selection'
        ],
        howToUse: [
            'Enter your name and details',
            'Upload profile photo',
            'Select preferred language',
            'Set your timezone',
            'Configure notifications',
            'Choose theme preference'
        ],
        tips: [
            'Complete profile improves collaboration',
            'Photo helps team recognition',
            'Accurate timezone ensures correct scheduling'
        ],
        moduleId: 'onboarding'
    },
    'onboarding-wizard': {
        id: 'onboarding-wizard',
        title: 'Getting Started Wizard',
        description: 'Step-by-step guide to help new users understand Consultify and complete initial setup.',
        features: [
            'Interactive walkthrough',
            'Feature introduction',
            'First assessment guidance',
            'Key concepts explanation',
            'Progress tracking',
            'Skip option'
        ],
        howToUse: [
            'Follow the wizard steps',
            'Learn key features',
            'Complete your first assessment',
            'Understand core concepts',
            'Track your progress',
            'Skip if experienced'
        ],
        tips: [
            'Complete wizard for best experience',
            'Interactive demos teach quickly',
            'Return to wizard anytime from Help'
        ],
        moduleId: 'onboarding'
    },
    'onboarding-org-setup': {
        id: 'onboarding-org-setup',
        title: 'Organization Setup',
        description: 'Initial organization configuration for administrators including context, team, and settings.',
        features: [
            'Organization profile setup',
            'Team member invitation',
            'Role assignment',
            'Context configuration',
            'Integration setup',
            'Branding customization'
        ],
        howToUse: [
            'Complete organization profile',
            'Invite team members',
            'Assign appropriate roles',
            'Configure organization context',
            'Set up integrations',
            'Customize branding'
        ],
        tips: [
            'Complete context improves AI',
            'Start with core team',
            'Role assignment controls access'
        ],
        moduleId: 'onboarding'
    },
    'onboarding-trial': {
        id: 'onboarding-trial',
        title: 'Trial Experience',
        description: 'Guided trial experience highlighting key features and maximizing value during evaluation period.',
        features: [
            'Trial timeline tracking',
            'Feature exploration checklist',
            'Sample data and scenarios',
            'Upgrade prompts',
            'Support access',
            'Trial extension requests'
        ],
        howToUse: [
            'Track remaining trial time',
            'Complete feature checklist',
            'Explore with sample data',
            'Consider upgrade options',
            'Access support if needed',
            'Request extension if required'
        ],
        tips: [
            'Maximize trial by exploring all features',
            'Use sample data to test scenarios',
            'Contact support for questions'
        ],
        moduleId: 'onboarding'
    },
    // ==========================================
    // AI TOOLS MODULE
    // ==========================================
    'ai-advisor': {
        id: 'ai-advisor',
        title: 'AI Action Advisor',
        description: 'Proactive AI assistant that suggests next best actions based on your transformation state.',
        features: [
            'Contextual recommendations',
            'Priority-based suggestions',
            'Action impact estimation',
            'One-click action initiation',
            'Feedback mechanism',
            'Learning from choices'
        ],
        howToUse: [
            'Review daily recommendations',
            'Understand suggested actions',
            'Evaluate impact estimates',
            'Accept or dismiss suggestions',
            'Provide feedback on quality',
            'Track adopted actions'
        ],
        tips: [
            'Regular review maximizes value',
            'Feedback improves suggestions',
            'Context completeness matters'
        ],
        moduleId: 'ai-tools'
    },
    'ai-chat': {
        id: 'ai-chat',
        title: 'AI Assistant Chat',
        description: 'Conversational AI interface for questions, analysis, and guidance on transformation topics.',
        features: [
            'Natural language interaction',
            'Context-aware responses',
            'Document analysis',
            'Scenario exploration',
            'Conversation history',
            'Export capabilities'
        ],
        howToUse: [
            'Ask questions naturally',
            'Upload documents for analysis',
            'Explore what-if scenarios',
            'Review conversation history',
            'Export useful insights',
            'Provide feedback on responses'
        ],
        tips: [
            'Specific questions get better answers',
            'Upload documents for context',
            'Save valuable insights'
        ],
        moduleId: 'ai-tools'
    },
    'ai-automation': {
        id: 'ai-automation',
        title: 'AI Automation Hub',
        description: 'Configure and manage AI-powered automations for routine tasks and notifications.',
        features: [
            'Automation templates',
            'Custom automation builder',
            'Trigger configuration',
            'Action sequencing',
            'Execution monitoring',
            'Error handling'
        ],
        howToUse: [
            'Browse automation templates',
            'Configure triggers',
            'Define action sequences',
            'Test automation',
            'Monitor execution',
            'Handle errors'
        ],
        tips: [
            'Start with templates',
            'Test before enabling',
            'Monitor initially'
        ],
        moduleId: 'ai-tools'
    },
    // ==========================================
    // KNOWLEDGE MODULE
    // ==========================================
    'knowledge-masterclass': {
        id: 'knowledge-masterclass',
        title: 'Masterclass Library',
        description: 'Video-based training courses on transformation methodologies, tools, and best practices.',
        features: [
            'Structured video courses',
            'Progress tracking',
            'Certificates of completion',
            'Interactive exercises',
            'Downloadable resources',
            'Discussion forums'
        ],
        howToUse: [
            'Browse available courses',
            'Enroll in relevant training',
            'Watch video lessons',
            'Complete exercises',
            'Download resources',
            'Earn certificates'
        ],
        tips: [
            'Complete foundational courses first',
            'Practice with exercises',
            'Share certificates'
        ],
        moduleId: 'knowledge'
    },
    'knowledge-resources': {
        id: 'knowledge-resources',
        title: 'Resource Library',
        description: 'Comprehensive collection of guides, articles, case studies, and reference materials.',
        features: [
            'Categorized content',
            'Search functionality',
            'Bookmarking',
            'Download options',
            'Related content suggestions',
            'Contribution capability'
        ],
        howToUse: [
            'Browse by category',
            'Search for specific topics',
            'Bookmark useful content',
            'Download for offline use',
            'Explore related content',
            'Suggest new resources'
        ],
        tips: [
            'Bookmark frequently used resources',
            'Case studies provide insights',
            'Check for updates regularly'
        ],
        moduleId: 'knowledge'
    },
    'knowledge-templates': {
        id: 'knowledge-templates',
        title: 'Template Gallery',
        description: 'Ready-to-use templates for assessments, initiatives, reports, and transformation activities.',
        features: [
            'Template categories',
            'Preview capability',
            'Customization options',
            'Download formats',
            'Template ratings',
            'Custom template upload'
        ],
        howToUse: [
            'Browse template categories',
            'Preview before selecting',
            'Customize for your needs',
            'Download in preferred format',
            'Rate templates used',
            'Upload custom templates'
        ],
        tips: [
            'Templates save time',
            'Customize to your context',
            'Share effective templates'
        ],
        moduleId: 'knowledge'
    },
    // ==========================================
    // DASHBOARD MODULE
    // ==========================================
    'dashboard-overview': {
        id: 'dashboard-overview',
        title: 'Dashboard Overview',
        description: 'Main dashboard view showing key transformation metrics, progress indicators, and quick actions.',
        features: [
            'Maturity score display',
            'Initiative status overview',
            'Upcoming milestones',
            'Activity feed',
            'Quick action buttons',
            'Customizable widgets'
        ],
        howToUse: [
            'Review maturity score',
            'Check initiative status',
            'Note upcoming milestones',
            'Follow activity feed',
            'Use quick actions',
            'Customize your view'
        ],
        tips: [
            'Check dashboard daily',
            'Act on urgent items first',
            'Customize for your role'
        ],
        moduleId: 'dashboard'
    },
    'dashboard-snapshot': {
        id: 'dashboard-snapshot',
        title: 'Transformation Snapshot',
        description: 'Executive-friendly single-page summary of transformation status designed for sharing.',
        features: [
            'One-page summary format',
            'Key metrics visualization',
            'Progress highlights',
            'Risk indicators',
            'Export to PDF',
            'Sharing options'
        ],
        howToUse: [
            'Access snapshot view',
            'Review key metrics',
            'Note progress highlights',
            'Check risk indicators',
            'Export for sharing',
            'Share with stakeholders'
        ],
        tips: [
            'Share weekly with leadership',
            'Use for board updates',
            'Customize branding for exports'
        ],
        moduleId: 'dashboard'
    },
    'dashboard-widgets': {
        id: 'dashboard-widgets',
        title: 'Widget Configuration',
        description: 'Configure and arrange dashboard widgets to create your personalized command center.',
        features: [
            'Widget library',
            'Drag-and-drop layout',
            'Widget sizing options',
            'Data source configuration',
            'Refresh settings',
            'Layout presets'
        ],
        howToUse: [
            'Access widget library',
            'Drag widgets to dashboard',
            'Resize as needed',
            'Configure data sources',
            'Set refresh intervals',
            'Save layout'
        ],
        tips: [
            'Start with essential widgets',
            'Group related metrics',
            'Save multiple layouts'
        ],
        moduleId: 'dashboard'
    },
    // ==========================================
    // CONSULTANT MODULE
    // ==========================================
    'consultant-panel': {
        id: 'consultant-panel',
        title: 'Consultant Panel',
        description: 'External consultant access panel for reviewing assessments and providing guidance.',
        features: [
            'Client organization access',
            'Assessment review tools',
            'Recommendation submission',
            'Collaboration features',
            'Report generation',
            'Time tracking'
        ],
        howToUse: [
            'Access client organizations',
            'Review assessments',
            'Submit recommendations',
            'Collaborate with teams',
            'Generate reports',
            'Track time spent'
        ],
        tips: [
            'Review context before assessment',
            'Document recommendations clearly',
            'Track time for billing'
        ],
        moduleId: 'consultant'
    },
    'consultant-invites': {
        id: 'consultant-invites',
        title: 'Consultant Invitations',
        description: 'Manage invitations to external consultants for assessment support and guidance.',
        features: [
            'Invitation creation',
            'Scope definition',
            'Access level control',
            'Duration setting',
            'NDA acknowledgment',
            'Invitation tracking'
        ],
        howToUse: [
            'Create consultant invitation',
            'Define engagement scope',
            'Set access permissions',
            'Configure duration',
            'Require NDA acceptance',
            'Track invitation status'
        ],
        tips: [
            'Define scope clearly',
            'Limit access appropriately',
            'Set reasonable duration'
        ],
        moduleId: 'consultant'
    },
    // ==========================================
    // ECOSYSTEM MODULE
    // ==========================================
    'affiliate-dashboard': {
        id: 'affiliate-dashboard',
        title: 'Affiliate Dashboard',
        description: 'Partner/affiliate dashboard for tracking referrals, commissions, and partner resources.',
        features: [
            'Referral tracking',
            'Commission reporting',
            'Marketing materials',
            'Partner resources',
            'Performance metrics',
            'Payout history'
        ],
        howToUse: [
            'View referral statistics',
            'Track commissions earned',
            'Download marketing materials',
            'Access partner resources',
            'Monitor performance',
            'Review payout history'
        ],
        tips: [
            'Regular promotion drives referrals',
            'Use provided materials',
            'Track what works best'
        ],
        moduleId: 'ecosystem'
    },
    // ==========================================
    // ADMIN - WORK MODE
    // ==========================================
    'admin-work-mode': {
        id: 'admin-work-mode',
        title: 'Work Mode Configuration',
        description: 'Configure how your organization structures work - by locations, projects, or both.',
        features: [
            'Work mode selection (Simple, Location-Based, Project-Based, Full)',
            'Custom labels for projects and locations',
            'User assignment rules',
            'Capability configuration',
            'PMO role integration',
            'Task visibility rules'
        ],
        howToUse: [
            'Select appropriate work mode',
            'Configure custom labels',
            'Set up user assignment rules',
            'Review capability settings',
            'Enable PMO roles if needed',
            'Test task visibility'
        ],
        tips: [
            'Choose mode matching your structure',
            'Custom labels improve usability',
            'Test with sample users first'
        ],
        moduleId: 'admin'
    }
};
export default CARD_DOCS;
//# sourceMappingURL=cardDocumentation.js.map