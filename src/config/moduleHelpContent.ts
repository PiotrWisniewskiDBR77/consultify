/**
 * Module Help Content Configuration
 *
 * Contains help documentation for all application modules.
 * Used by HelpSidePanel to show contextual help.
 */

export type HelpModuleId = string;

export interface ModuleHelp {
  id: HelpModuleId;
  name?: string | { pl?: string; en?: string };
  title: string;
  description: string;
  content: string;
  icon?: string;
  translationKey?: string;
  relatedModules?: string[];
  targetAudience?: string[];
}

export const MODULE_HELP_CONTENT: Record<HelpModuleId, ModuleHelp> = {
  welcome: {
    id: 'welcome',
    title: 'Welcome',
    description: 'Welcome to Consultinity',
    content: 'Welcome to Consultinity help center.',
    icon: 'Home',
    translationKey: 'help.sidePanel.modules.welcome',
  },
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Your central command center for monitoring digital transformation progress.',
    content:
      'The dashboard provides a real-time overview of assessments, initiatives, and key metrics across your organization.',
    icon: 'LayoutDashboard',
    translationKey: 'help.sidePanel.modules.dashboard',
    relatedModules: ['assessment', 'initiatives', 'reports'],
    targetAudience: ['all'],
  },
  assessment: {
    id: 'assessment',
    title: 'Assessment Hub',
    description: 'AI-powered digital maturity assessments using industry frameworks.',
    content:
      'Run comprehensive assessments using CMMI, LEAN 4.0, and other frameworks to understand your digital readiness.',
    icon: 'ClipboardCheck',
    translationKey: 'help.sidePanel.modules.assessment',
    relatedModules: ['dashboard', 'initiatives', 'roadmap'],
    targetAudience: ['consultant', 'manager', 'executive'],
  },
  initiatives: {
    id: 'initiatives',
    title: 'Initiatives',
    description: 'Create and manage digital transformation initiatives.',
    content:
      'Full lifecycle management for transformation projects with stage-gate workflows, resource allocation, and risk management.',
    icon: 'Rocket',
    translationKey: 'help.sidePanel.modules.initiatives',
    relatedModules: ['assessment', 'roadmap', 'reports'],
    targetAudience: ['manager', 'executive'],
  },
  roadmap: {
    id: 'roadmap',
    title: 'Roadmap',
    description: 'Strategic planning timeline for your transformation journey.',
    content:
      'Visualize and plan your transformation timeline with dependencies, milestones, and resource allocation.',
    icon: 'Map',
    translationKey: 'help.sidePanel.modules.roadmap',
    relatedModules: ['initiatives', 'assessment'],
    targetAudience: ['executive', 'manager'],
  },
  reports: {
    id: 'reports',
    title: 'Reports',
    description: 'Generate comprehensive management reports and status updates.',
    content:
      'Create executive summaries, progress reports, and stakeholder presentations with AI-powered insights.',
    icon: 'FileText',
    translationKey: 'help.sidePanel.modules.reports',
    relatedModules: ['dashboard', 'initiatives'],
    targetAudience: ['executive', 'manager'],
  },
  ai_chat: {
    id: 'ai_chat',
    title: 'AI Chat',
    description: 'Interactive AI assistant for data analysis and recommendations.',
    content:
      'Ask questions about your data, get recommendations, and automate tasks with our AI-powered assistant.',
    icon: 'Bot',
    translationKey: 'help.sidePanel.modules.aiChat',
    relatedModules: ['dashboard', 'assessment', 'initiatives'],
    targetAudience: ['all'],
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    description: 'Configure your profile and organization settings.',
    content: 'Manage your profile, organization settings, billing, security, and preferences.',
    icon: 'Settings',
    translationKey: 'help.sidePanel.modules.settings',
    relatedModules: [],
    targetAudience: ['all'],
  },
  admin: {
    id: 'admin',
    title: 'Admin Panel',
    description: 'Organization administration and team management.',
    content: 'Manage team members, roles, permissions, and organization-wide settings.',
    icon: 'Users',
    translationKey: 'help.sidePanel.modules.admin',
    relatedModules: ['settings', 'admin-dashboard', 'admin-metrics', 'admin-analytics'],
    targetAudience: ['admin', 'owner'],
  },
  'admin-dashboard': {
    id: 'admin-dashboard',
    title: 'Admin Dashboard',
    description: 'Organization overview and quick statistics.',
    content: `The Admin Dashboard provides a real-time overview of your organization:

**Key Metrics:**
- Total Users: Active team members in your organization
- Active Projects: Currently running transformation initiatives
- Pending Invites: Team invitations awaiting response
- Est. Revenue: Projected revenue based on current activity

**Quick Actions:**
- Invite User: Send email invitations to new team members
- New Project: Create a new transformation initiative
- View Reports: Access management reports
- Settings: Configure organization settings

**System Health:** Monitor API, Database, AI Services, and Storage status in real-time.`,
    icon: 'LayoutDashboard',
    translationKey: 'help.admin.dashboard',
    relatedModules: ['admin-metrics', 'admin-analytics'],
    targetAudience: ['admin', 'owner'],
  },
  'admin-metrics': {
    id: 'admin-metrics',
    title: 'Admin Metrics',
    description: 'Key performance indicators and conversion intelligence.',
    content: `Track organization adoption and growth metrics:

**Conversion Intelligence:**
- Team Adoption Rate: Percentage of accepted invitations
- Playbook Completion: Help system effectiveness
- Active Users: 30-day active user count
- Conversion Success: Trial to paid conversion status

**Team Onboarding Funnel:**
Visualizes the journey from invitation to active user:
1. Invitations Sent → Invitations Accepted → Active Users

**Help & Training ROI:**
Track completion rates across different guidance playbooks to measure training effectiveness.

**Tips:**
- A low acceptance rate may indicate email delivery issues
- Monitor playbook completion to identify training gaps`,
    icon: 'TrendingUp',
    translationKey: 'help.admin.metrics',
    relatedModules: ['admin-dashboard', 'admin-analytics'],
    targetAudience: ['admin', 'owner'],
  },
  'admin-analytics': {
    id: 'admin-analytics',
    title: 'AI Analytics',
    description: 'AI performance monitoring and strategic insights.',
    content: `Monitor AI system performance and costs:

**Performance KPIs:**
- Success Rate: Percentage of successful AI requests
- Avg Response Time: Mean latency for AI operations
- Total Tokens: Total AI tokens consumed this period
- Est. Cost: Estimated cost based on token usage

**Failure Modes Analysis:**
Identifies common AI request failures to help troubleshoot issues.

**Token Usage Trend:**
Daily breakdown of AI token consumption over the last 30 days.

**Model Performance by Provider:**
Compare success rates and costs across different AI providers (OpenAI, Claude, Gemini).

**Strategic Ideas & Observations:**
AI-generated insights and recommendations for improving operations.

**Tips:**
- High failure rates may indicate API key issues or rate limits
- Monitor costs to stay within budget
- Use provider comparison to optimize AI routing`,
    icon: 'BarChart2',
    translationKey: 'help.admin.analytics',
    relatedModules: ['admin-dashboard', 'admin-metrics'],
    targetAudience: ['admin', 'owner'],
  },
  superadmin: {
    id: 'superadmin',
    title: 'Super Admin',
    description: 'Platform administration and system monitoring.',
    content:
      'Monitor platform health, manage organizations, view analytics, and configure system-wide settings.',
    icon: 'Shield',
    translationKey: 'help.sidePanel.modules.superadmin',
    relatedModules: [],
    targetAudience: ['superadmin'],
  },
  superadmin_ai_infrastructure: {
    id: 'superadmin_ai_infrastructure',
    title: 'AI Infrastructure',
    description: 'LLM providers, tiers, global AI settings, and health monitoring.',
    content:
      'Configure LLM providers, assign models to tiers, set global limits and fallback chains, and monitor provider health/capabilities.',
    icon: 'Cpu',
    relatedModules: ['superadmin_ai_development', 'superadmin_ai_operations'],
    targetAudience: ['superadmin'],
  },
  superadmin_ai_development: {
    id: 'superadmin_ai_development',
    title: 'AI Development',
    description: 'Prompts, experiments, intelligence tools, and knowledge base administration.',
    content:
      'Manage and version system prompts, run A/B tests, and curate knowledge sources used by AI systems.',
    icon: 'Sparkles',
    relatedModules: ['superadmin_ai_infrastructure', 'superadmin_ai_operations'],
    targetAudience: ['superadmin'],
  },
  superadmin_ai_operations: {
    id: 'superadmin_ai_operations',
    title: 'AI Operations',
    description: 'Mission control, performance, costs, SLA, and usage analytics.',
    content:
      'Monitor AI uptime/latency/errors, observe token spend and costs, validate SLAs, and analyze usage patterns across providers/models.',
    icon: 'Activity',
    relatedModules: ['superadmin_ai_infrastructure', 'superadmin_ai_development'],
    targetAudience: ['superadmin'],
  },
  knowledge: {
    id: 'knowledge',
    title: 'Knowledge Base',
    description: 'Browse resources, templates, and best practices.',
    content:
      'Access a library of transformation templates, best practices, case studies, and educational content.',
    icon: 'BookOpen',
    translationKey: 'help.sidePanel.modules.knowledge',
    relatedModules: ['assessment', 'initiatives'],
    targetAudience: ['all'],
  },
  mywork: {
    id: 'mywork',
    title: 'My Work',
    description: 'Your personal task inbox and focus view.',
    content: 'Track your assigned tasks, notifications, and personal workflow in one place.',
    icon: 'CheckSquare',
    translationKey: 'help.sidePanel.modules.mywork',
    relatedModules: ['initiatives', 'dashboard'],
    targetAudience: ['all'],
  },
  partner: {
    id: 'partner',
    title: 'Partner Portal',
    description: 'Comprehensive partner management, referral tracking, and commission system.',
    content: `The Partner Portal provides everything you need to manage your partnership with Consultinity:

**Partner Home** ⭐ NEW
• Welcome page with program benefits overview
• Onboarding progress tracker with guided steps
• Academy courses and certifications preview
• Quick stats and earnings summary

**Referral System**
• Generate unique referral codes and links
• Create UTM-tracked campaign links for marketing
• Track clicks, signups, and conversions in real-time
• View detailed analytics by campaign source
• See all referred customers and their status

**Commission Earnings**
• Track commission earnings with Statements/Payments tabs
• View pending, approved, and paid commissions
• Request payouts when threshold is reached
• Bank/tax info alerts for missing documents
• Access complete payout history

**Client Access Manager** ⭐ NEW
• View all referred clients in one place
• Manage team member access to client accounts
• Generate secure access links for onboarding
• Track employee permissions and last activity

**Certification Program**
• Complete learning paths for partner certifications
• Track progress through required modules
• Download certificates and credentials

**Resources**
• Access documentation and API guides
• Download marketing materials and templates
• View case studies and success stories

**Billing & Licenses**
• Manage license allocations for clients
• View invoices and payment history
• Track partner discount benefits

**Profile Settings**
• Update company information
• Manage framework specializations
• Configure public directory listing

**Commission Rates by Tier:**
• Registered: 10% • Bronze: 12% • Silver: 15% • Gold: 18% • Platinum: 20%

**Client Discounts:**
Partners can offer discounts to referred clients (configured by SuperAdmin). Default: 15% for 12 months.`,
    icon: 'Users',
    translationKey: 'help.sidePanel.modules.partner',
    relatedModules: ['admin', 'billing'],
    targetAudience: ['partner'],
  },
  'partner-home': {
    id: 'partner-home',
    title: 'Partner Home',
    description: 'Welcome page and program overview for partners.',
    content: `The Partner Home is your starting point in the Consultinity Partner Program:

**Welcome Banner**
• "Be Our Partner. Let's Grow Together." - Our partnership philosophy
• Quick overview of program benefits and earnings potential

**Value Proposition Cards**
• Recurring Revenue - Commission structure and earnings potential
• Growth Together - How we help you grow your business
• Expert Support - Dedicated partner manager and resources
• Premium Tools - Access to enterprise features and materials

**Success Stories (Beta Phase)**
• Real testimonials from beta partners
• Software companies and consulting firms achieving growth
• Proof of partnership value during beta testing

**Tier Progression**
• Visual representation of partner tiers: Registered → Bronze → Silver → Gold → Platinum
• Benefits increase as you progress through tiers
• Track your current position and next milestone

**Onboarding Checklist**
Gentle guided steps to get started:
1. Complete your profile (with explanation)
2. Connect your payment account (for commission payouts)
3. Generate your first referral link (start earning)
4. Complete Academy certification (unlock advanced features)

**Commission Calculator**
• Interactive tool to estimate potential earnings
• Adjust clients per month and average deal value
• See projected monthly and yearly commissions

**Academy Preview**
• Quick access to available courses
• Track certification progress
• Unlock new capabilities with certifications

**Contact Your Partner Manager**
• Direct access to Bartosz Sotomski, Partner Success Manager
• Book a call via calendar
• Email and LinkedIn contact options
• Quick questions? We're here to help!

**FAQ Section**
• Common questions answered
• How to start, earnings structure, support availability
• Expandable cards for detailed answers`,
    icon: 'Home',
    translationKey: 'help.sidePanel.modules.partner-home',
    relatedModules: ['partner', 'partner-dashboard'],
    targetAudience: ['partner'],
  },
  'partner-dashboard': {
    id: 'partner-dashboard',
    title: 'Partner Dashboard',
    description: 'Overview of your partnership metrics and activity.',
    content: `The Partner Dashboard provides a real-time snapshot of your partnership performance:

**Key Metrics**
• Active Clients - Number of organizations you've referred
• Active Projects - Ongoing transformation projects
• Certification Level - Your current partner certification status
• Monthly Revenue - Commission earnings this month

**Quick Actions**
• Add New Client - Start onboarding a new referred organization
• Start Project - Begin a new transformation project
• View Resources - Access partner materials
• Download Materials - Get marketing and sales assets

**Recent Activity**
• Latest client additions and project updates
• Certification completions
• Invoice and payment notifications
• Real-time activity feed

**Certification Progress**
• Visual tracker showing completed courses
• Current course in progress
• Upcoming certifications to unlock`,
    icon: 'LayoutDashboard',
    translationKey: 'help.sidePanel.modules.partner-dashboard',
    relatedModules: ['partner', 'partner-metrics'],
    targetAudience: ['partner'],
  },
  'partner-metrics': {
    id: 'partner-metrics',
    title: 'Partner Metrics',
    description: 'Detailed performance analytics for your partnership.',
    content: `Track your partnership performance with detailed metrics:

**Revenue Metrics**
• Total Revenue (YTD) - Year-to-date commission earnings
• Revenue Trend - Comparison with previous periods
• Monthly breakdown chart - Visual revenue over time

**Client Metrics**
• Client Retention Rate - How many clients stay active
• New Clients This Quarter - Growth in referrals
• Churned Clients - Track any lost accounts
• Average Project Duration - Typical engagement length

**Performance Score**
• Overall partner score out of 100
• Ranking among other partners
• Score breakdown by category:
  - Client Acquisition (finding new clients)
  - Project Delivery (successful implementations)
  - Customer Satisfaction (client feedback)
  - Certification Progress (your training completion)

**Revenue Charts**
• Bar chart showing monthly revenue
• Trend indicators for growth/decline
• Interactive hover for detailed values`,
    icon: 'BarChart3',
    translationKey: 'help.sidePanel.modules.partner-metrics',
    relatedModules: ['partner', 'partner-dashboard', 'partner-earnings'],
    targetAudience: ['partner'],
  },
  'partner-referrals': {
    id: 'partner-referrals',
    title: 'Referral Tools',
    description: 'Generate and manage your referral codes and links.',
    content: `Generate and track referral links to earn commissions:

**Your Referral Code**
• Unique code assigned to your partnership
• Copy and share with potential clients
• Code format: PARTNER123

**Referral Link**
• Direct link to registration with your attribution
• One-click copy functionality
• QR code generation available

**Campaign Links**
• Create UTM-tracked links for different campaigns
• Track which marketing efforts perform best
• Customize source, medium, and campaign name
• Example: LinkedIn ads, email newsletters, blog posts

**Analytics**
• Click tracking per link
• Signup conversions
• Trial-to-paid conversion rates
• Campaign performance comparison

**Best Practices**
• Use different campaign links for different channels
• Track which content drives the most signups
• Focus efforts on highest-converting sources`,
    icon: 'Link',
    translationKey: 'help.sidePanel.modules.partner-referrals',
    relatedModules: ['partner', 'partner-earnings'],
    targetAudience: ['partner'],
  },
  'partner-earnings': {
    id: 'partner-earnings',
    title: 'Commission Earnings',
    description: 'Track and manage your commission earnings and payouts.',
    content: `Manage your commission earnings and payouts:

**Earnings Summary**
• Total Earned - All-time commission earnings
• Pending - Commissions awaiting approval
• Available - Ready for payout
• Paid Out - Successfully transferred

**Statements Tab**
• Detailed transaction history
• Filter by date range and status
• Export for accounting

**Payments Tab**
• Payout history with status
• Processing times and methods
• Bank transfer details

**Commission Types**
• Initial - First payment from new client
• Renewal - Ongoing subscription commissions
• Bonus - Performance-based rewards

**Payout Process**
1. Commissions accumulate from client payments
2. Reach minimum payout threshold (€100)
3. Request payout via dashboard
4. Bank transfer processed within 5-7 business days

**Important**
• Keep bank information up to date
• Tax documents required for payouts
• Commissions approved after 30-day refund period`,
    icon: 'DollarSign',
    translationKey: 'help.sidePanel.modules.partner-earnings',
    relatedModules: ['partner', 'partner-referrals'],
    targetAudience: ['partner'],
  },
  'partner-clients': {
    id: 'partner-clients',
    title: 'Client Management',
    description: 'View and manage your referred client organizations.',
    content: `Manage client organizations you've referred:

**Organizations Tab**
• List of all referred organizations
• Industry classification
• User count and active projects
• Assessment scores and status
• Quick filters: active, onboarding, inactive

**Projects Tab**
• Active transformation projects
• Framework being used (DRD, SIRI, etc.)
• Progress percentage
• Target completion dates

**Actions**
• Add new client organization
• View client details and activity
• Track onboarding progress
• Monitor project health

**Client Lifecycle**
1. Referral - Initial signup via your link
2. Trial - Free evaluation period
3. Conversion - Paid subscription starts
4. Active - Ongoing engagement
5. Renewal - Subscription renewal (more commissions!)`,
    icon: 'Building2',
    translationKey: 'help.sidePanel.modules.partner-clients',
    relatedModules: ['partner', 'partner-dashboard'],
    targetAudience: ['partner'],
  },
  'partner-academy': {
    id: 'partner-academy',
    title: 'Partner Academy',
    description: 'Training and certification programs for partners.',
    content: `Complete certifications to enhance your partnership:

**Learning Path**
Progress through structured courses:
1. Consultinity Foundations - Platform basics
2. PMO Standards - ISO 21500, PMBOK 7, PRINCE2
3. AI Intelligence Modules - AI-powered features
4. Assessment Specialist - Framework expertise

**Course Structure**
• Video lessons and reading materials
• Interactive quizzes
• Practical exercises
• Time estimates per module

**Exams**
• Available after completing learning path
• Multiple choice and practical assessments
• Passing score: 80%
• Unlimited retakes

**Certificates**
• Downloadable PDF certificates
• Unique certificate ID for verification
• Add to LinkedIn profile
• Show expertise to clients

**Benefits of Certification**
• Unlock advanced features
• Higher commission rates for certified partners
• Priority support access
• Featured in partner directory`,
    icon: 'GraduationCap',
    translationKey: 'help.sidePanel.modules.partner-academy',
    relatedModules: ['partner', 'partner-home'],
    targetAudience: ['partner'],
  },
  'partner-resources': {
    id: 'partner-resources',
    title: 'Partner Resources',
    description: 'Access documentation, marketing materials, and templates.',
    content: `Download resources to support your partnership:

**Documentation**
• Partner Onboarding Guide - Getting started
• Platform Overview - Feature documentation
• API Documentation - Technical integration
• Integration Guide - Connect with your systems

**Marketing Materials**
• Partner Logo Kit - Official branding assets
• Sales Presentation Template - Client pitches
• Product One-Pager - Quick overview
• Email Templates - Outreach campaigns

**Case Studies**
• Success stories from real implementations
• Industry-specific examples
• ROI calculations and results
• Use in client presentations

**PMO Templates**
• Setup checklists
• Assessment report templates
• Roadmap templates
• Governance frameworks

**How to Use**
1. Browse by category
2. Click to download
3. Customize with your branding
4. Use in sales and marketing efforts`,
    icon: 'FileText',
    translationKey: 'help.sidePanel.modules.partner-resources',
    relatedModules: ['partner', 'partner-academy'],
    targetAudience: ['partner'],
  },
  'partner-profile': {
    id: 'partner-profile',
    title: 'Partner Profile',
    description: 'Manage your partner organization settings.',
    content: `Configure your partner organization profile:

**Company Information**
• Legal company name
• Tax ID / VAT number
• Contact email and phone
• Website URL

**Specializations**
Select frameworks you're certified in:
• DRD, SIRI, ADMA, CMMI
• Lean 4.0, ISO 21500
• PMBOK, PRINCE2

These appear in your public listing and help match you with relevant opportunities.

**Operating Regions**
Where you provide services:
• DACH, Nordics, Benelux
• UK & Ireland, France
• Southern Europe, CEE, Baltics

**Public Listing**
• Toggle visibility in partner directory
• Preview how your profile appears
• Control what information is shown
• Attract inbound leads from enterprises

**Why Complete Your Profile?**
• Better visibility in partner search
• More relevant client matches
• Trust signals for potential clients
• Required for advanced tier status`,
    icon: 'Building2',
    translationKey: 'help.sidePanel.modules.partner-profile',
    relatedModules: ['partner', 'partner-home'],
    targetAudience: ['partner'],
  },
  onboarding: {
    id: 'onboarding',
    title: 'Onboarding',
    description: 'Guided introduction to the platform.',
    content:
      'Step-by-step tutorials and setup assistance to help you get started with Consultinity.',
    icon: 'GraduationCap',
    translationKey: 'help.sidePanel.modules.onboarding',
    relatedModules: ['dashboard', 'assessment'],
    targetAudience: ['new_user'],
  },
};

export function getModuleHelp(id: HelpModuleId): ModuleHelp | null {
  return MODULE_HELP_CONTENT[id] || null;
}

export function getModuleHelpByTranslationKey(key: string): ModuleHelp | null {
  const entry = Object.values(MODULE_HELP_CONTENT).find((m) => m.translationKey === key);
  return entry || null;
}

export function getAllModuleIds(): HelpModuleId[] {
  return Object.keys(MODULE_HELP_CONTENT);
}
export function getRelatedModules(id: HelpModuleId): ModuleHelp[] {
  const module = MODULE_HELP_CONTENT[id];
  if (!module?.relatedModules) return [];
  return module.relatedModules
    .map((relId) => MODULE_HELP_CONTENT[relId])
    .filter((m): m is ModuleHelp => !!m);
}
