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
    title: 'Licensed Tools Hub',
    description: 'AI-powered digital maturity assessments using industry frameworks (DRD, SIRI, ADMA, Lean).',
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

  // ============================================
  // INDUSTRIAL IRIS MODULES (19 Modules)
  // Enterprise Manufacturing & Operations
  // ============================================

  mes: {
    id: 'mes',
    title: 'Manufacturing Execution (MES)',
    description: 'Real-time production monitoring, work orders, and OEE tracking.',
    content: `The MES module is your command center for shop floor operations:

**Production Monitoring**
• Real-time machine status and production counts
• OEE calculation (Availability × Performance × Quality)
• Shift reports and production summaries
• Downtime tracking and categorization

**Work Order Management**
• Create, schedule, and track work orders
• Material consumption and yield tracking
• Quality checkpoints and inspections
• Operator assignment and labor tracking

**Performance Analytics**
• OEE trend analysis and benchmarking
• Six Big Losses identification
• Pareto analysis of stops and rejects
• Shift and line comparison dashboards

**Integration Points**
• Connects to QMS for quality data
• Links with CMMS for maintenance events
• Feeds KPI module with production metrics
• Syncs with APS for scheduling

**Best Practices**
💡 Start with pilot line before plant-wide rollout
📊 Target world-class OEE: 85%+
🔗 Use standardized downtime reason codes`,
    icon: 'Factory',
    translationKey: 'help.modules.mes',
    relatedModules: ['wms', 'qms', 'cmms', 'iot', 'gemba', 'kpi'],
    targetAudience: ['production_manager', 'operations', 'plant_manager'],
  },

  wms: {
    id: 'wms',
    title: 'Warehouse Management (WMS)',
    description: 'Inventory control, storage optimization, and logistics execution.',
    content: `The WMS module optimizes your warehouse and logistics operations:

**Inventory Management**
• Real-time stock levels across locations
• Lot and serial number tracking
• Expiration date management (FEFO/FIFO)
• ABC/XYZ classification for optimization

**Warehouse Operations**
• Receiving and put-away workflows
• Picking strategies (wave, batch, zone)
• Packing and shipping management
• Cross-docking for fast throughput

**Storage Optimization**
• Bin location management
• Slotting optimization algorithms
• Space utilization dashboards
• Heat maps for movement patterns

**Integration Points**
• Syncs with MES for production materials
• Links to MRP for demand planning
• Feeds KPI with logistics metrics
• Connects to external 3PL systems

**Key Metrics**
📦 Inventory Accuracy: Target 99%+
⚡ Order Fill Rate: Target 98%+
📍 Location Accuracy: Target 99.5%+`,
    icon: 'Warehouse',
    translationKey: 'help.modules.wms',
    relatedModules: ['mes', 'mrp', 'aps', 'kpi'],
    targetAudience: ['logistics_manager', 'warehouse_supervisor', 'supply_chain'],
  },

  qms: {
    id: 'qms',
    title: 'Quality Management (QMS)',
    description: 'Document control, non-conformance, audits, and compliance tracking.',
    content: `The QMS module ensures quality excellence and regulatory compliance:

**Document Control**
• Version-controlled procedures and work instructions
• Approval workflows with electronic signatures
• Distribution and acknowledgment tracking
• Automatic revision notifications

**Non-Conformance Management**
• NC/CAPA creation and tracking
• Root cause analysis (8D, 5-Why, Ishikawa)
• Corrective action assignment and verification
• Trend analysis for recurring issues

**Audit Management**
• Internal and external audit scheduling
• Finding documentation and tracking
• Audit checklist templates
• Compliance status dashboards

**Quality Metrics**
• First Pass Yield (FPY)
• Customer complaint rates
• Supplier quality scores
• Cost of Quality (CoQ) tracking

**Compliance Standards**
🏭 ISO 9001:2015
🚗 IATF 16949 (Automotive)
💊 GMP/FDA 21 CFR Part 11 (Pharma)
✈️ AS9100 (Aerospace)`,
    icon: 'ClipboardCheck',
    translationKey: 'help.modules.qms',
    relatedModules: ['mes', 'cmms', 'hse', 'kpi'],
    targetAudience: ['quality_manager', 'compliance_officer', 'auditor'],
  },

  cmms: {
    id: 'cmms',
    title: 'Maintenance Management (CMMS)',
    description: 'Asset lifecycle, preventive maintenance, and spare parts management.',
    content: `The CMMS module maximizes asset availability and reduces maintenance costs:

**Work Order Management**
• Corrective and preventive work orders
• Priority-based scheduling
• Technician assignment and tracking
• Time and material logging

**Preventive Maintenance**
• Calendar and meter-based PM schedules
• Maintenance procedure library
• Compliance tracking and overdue alerts
• PM optimization analytics

**Asset Management**
• Complete asset hierarchy and registry
• Criticality classification (A/B/C)
• Warranty and contract tracking
• Asset lifecycle cost analysis

**Spare Parts**
• Parts inventory with min/max levels
• Part-to-asset relationships
• Automatic reorder suggestions
• Supplier lead time tracking

**Predictive Maintenance (Advanced)**
• IoT sensor integration
• Failure prediction algorithms
• Condition-based maintenance triggers
• AI-powered anomaly detection

**Key Metrics**
⏱️ MTBF: Mean Time Between Failures
🔧 MTTR: Mean Time To Repair
📊 PM Compliance: Target 95%+
💰 Maintenance Cost per Unit`,
    icon: 'Wrench',
    translationKey: 'help.modules.cmms',
    relatedModules: ['mes', 'iot', 'kpi', 'aps'],
    targetAudience: ['maintenance_manager', 'reliability_engineer', 'plant_manager'],
  },

  hse: {
    id: 'hse',
    title: 'Health, Safety & Environment (HSE)',
    description: 'Incident management, risk assessments, and safety compliance.',
    content: `The HSE module protects your workforce and ensures environmental compliance:

**Incident Management**
• Injury and near-miss reporting
• Incident investigation workflows
• Root cause analysis tools
• Corrective action tracking

**Risk Assessment**
• Job Safety Analysis (JSA)
• Risk matrices with probability/severity
• Control measure documentation
• Periodic reassessment scheduling

**Safety Inspections**
• Scheduled safety walks and audits
• Mobile checklist execution
• Finding documentation with photos
• Trend analysis by area/type

**Training & Compliance**
• Safety training requirements by role
• Certification tracking and renewals
• Training completion dashboards
• Compliance gap identification

**Environmental Management**
• Waste tracking and classification
• Emission monitoring
• Permit management
• Environmental incident response

**Key Metrics**
🦺 TRIR: Total Recordable Incident Rate
📈 Leading Indicators: Inspections, training, near-misses
🎯 Zero Harm Target tracking`,
    icon: 'ShieldCheck',
    translationKey: 'help.modules.hse',
    relatedModules: ['qms', 'hrm', 'esg', 'gemba'],
    targetAudience: ['safety_manager', 'ehs_specialist', 'plant_manager'],
  },

  esg: {
    id: 'esg',
    title: 'ESG & Sustainability',
    description: 'Carbon tracking, sustainability reporting, and ESG compliance.',
    content: `The ESG module drives sustainability and stakeholder value:

**Carbon Management**
• Scope 1, 2, and 3 emissions tracking
• Carbon footprint calculators
• Reduction target setting and monitoring
• Science-based targets alignment

**Sustainability Metrics**
• Energy consumption dashboards
• Water usage and recycling rates
• Waste diversion and recycling
• Renewable energy percentage

**ESG Reporting**
• GRI Standards alignment
• TCFD climate disclosure
• CDP questionnaire preparation
• Sustainability report generation

**Supply Chain Sustainability**
• Supplier ESG assessments
• Responsible sourcing tracking
• Conflict minerals compliance
• Modern slavery due diligence

**Social Metrics**
• Diversity and inclusion tracking
• Community engagement
• Employee wellbeing indices
• Human rights compliance

**Governance**
• ESG policy management
• Board oversight documentation
• Stakeholder engagement tracking
• Materiality assessments`,
    icon: 'Leaf',
    translationKey: 'help.modules.esg',
    relatedModules: ['hse', 'kpi', 'qms'],
    targetAudience: ['sustainability_manager', 'cfo', 'investor_relations'],
  },

  iot: {
    id: 'iot',
    title: 'IoT & Connected Devices',
    description: 'Device management, telemetry collection, and industrial connectivity.',
    content: `The IoT module connects your physical assets to the digital platform:

**Device Management**
• Device registry and provisioning
• Firmware version management
• Health status monitoring
• Remote configuration

**Data Collection**
• Real-time telemetry ingestion
• Edge processing and filtering
• Time-series data storage
• Data validation and cleansing

**Protocol Support**
• OPC-UA for industrial equipment
• MQTT for sensors
• Modbus/TCP for PLCs
• REST APIs for modern devices

**Digital Twin Integration**
• Asset digital representations
• Real-time state synchronization
• Simulation and what-if scenarios
• Predictive analytics

**Alerts & Automation**
• Threshold-based alerting
• Anomaly detection
• Automated escalation rules
• Integration with CMMS for work orders

**Security**
🔐 Device authentication
🔒 Encrypted communications
📜 Audit logging
🛡️ Network segmentation support`,
    icon: 'Radio',
    translationKey: 'help.modules.iot',
    relatedModules: ['mes', 'cmms', 'gemba', 'dt'],
    targetAudience: ['it_manager', 'automation_engineer', 'plant_manager'],
  },

  gemba: {
    id: 'gemba',
    title: 'GEMBA Shop Floor Management',
    description: 'Digital shop floor walks, visual management, and operator engagement.',
    content: `The GEMBA module brings lean management to your shop floor:

**Digital GEMBA Walks**
• Structured walk templates by area
• Mobile-first checklist execution
• Photo and video capture
• Real-time finding submission

**Visual Management**
• Digital Andon boards
• Production status displays
• KPI visualization screens
• Problem escalation boards

**Operator Engagement**
• Suggestion submission system
• Quick problem reporting
• Skill matrix visualization
• Shift communication logs

**AI Panel (Agent 01)**
• Real-time OEE summaries
• AI-powered insights
• Anomaly detection alerts
• Natural language queries

**Live Dashboard (Agent 02)**
• Production overview
• Equipment status
• Active alarms
• Performance trends

**Shift/Line KPIs (Agent 03)**
• OEE by shift comparison
• Line ranking charts
• Historical trends
• Target vs. actual

**Best Practices**
🚶 Daily GEMBA walks by leadership
📊 5-15 minute shift handover meetings
🎯 Focus on process, not people
📱 Mobile-first for real-time capture`,
    icon: 'Footprints',
    translationKey: 'help.modules.gemba',
    relatedModules: ['mes', 'hse', 'kpi', 'iot'],
    targetAudience: ['plant_manager', 'supervisor', 'lean_specialist'],
  },

  kpi: {
    id: 'kpi',
    title: 'KPI & Performance Management',
    description: 'Metrics dashboards, OKRs, scorecards, and performance analytics.',
    content: `The KPI module drives data-driven performance management:

**Dashboard Builder**
• Drag-and-drop dashboard creation
• Widget library (charts, gauges, tables)
• Real-time data connections
• Role-based dashboard sharing

**KPI Library**
• Pre-built industrial KPIs
• Custom KPI definitions
• Calculation formulas
• Benchmark references

**OKR Management**
• Objective and Key Result creation
• Progress tracking and updates
• Alignment visualization
• Quarterly review workflows

**Scorecards**
• Balanced Scorecard templates
• Dimension-based scoring
• Traffic light indicators
• Historical trend analysis

**Analytics**
• Trend analysis over time
• Drill-down capabilities
• Correlation discovery
• Predictive forecasting

**Common Industrial KPIs**
📈 OEE - Overall Equipment Effectiveness
📦 OTIF - On Time In Full
🔧 MTBF/MTTR - Reliability metrics
💰 Cost per Unit
⏱️ Lead Time
📊 First Pass Yield`,
    icon: 'BarChart3',
    translationKey: 'help.modules.kpi',
    relatedModules: ['mes', 'wms', 'qms', 'dashboard'],
    targetAudience: ['plant_manager', 'operations', 'executive'],
  },

  data_ai: {
    id: 'data_ai',
    title: 'Data Analytics & AI',
    description: 'Data warehouse, machine learning, and predictive analytics.',
    content: `The DATA_AI module unlocks advanced analytics and AI capabilities:

**Data Warehouse**
• Unified data from all modules
• Historical data retention
• Dimensional modeling
• Query and reporting tools

**Report Builder**
• Visual report designer
• Scheduled report generation
• Multiple export formats
• Email distribution

**Machine Learning**
• Model training interface
• Feature engineering tools
• Model versioning
• Performance monitoring

**Predictive Analytics**
• Demand forecasting
• Equipment failure prediction
• Quality prediction
• Anomaly detection

**Advanced Capabilities**
🤖 AutoML for automated model selection
📊 A/B testing framework
🔮 What-if scenario modeling
📈 Root cause analysis`,
    icon: 'BrainCircuit',
    translationKey: 'help.modules.data_ai',
    relatedModules: ['kpi', 'mes', 'qms', 'cmms'],
    targetAudience: ['data_analyst', 'data_scientist', 'operations'],
  },

  mrp: {
    id: 'mrp',
    title: 'Material Requirements Planning (MRP)',
    description: 'Demand planning, material scheduling, and procurement optimization.',
    content: `The MRP module optimizes material availability and inventory investment:

**Demand Planning**
• Sales forecast integration
• Demand sensing and adjustment
• Promotional impact modeling
• Customer order incorporation

**Material Planning**
• BOM explosion and netting
• Lead time consideration
• Safety stock calculation
• Order quantity optimization

**Procurement Actions**
• Purchase requisition generation
• Vendor selection support
• Expedite/defer recommendations
• Supplier capacity visibility

**Inventory Optimization**
• ABC/XYZ classification
• Reorder point calculation
• Economic order quantities
• Excess/obsolete identification

**Key Planning Horizons**
📅 Short-term: Weekly execution
📊 Medium-term: Monthly planning
🎯 Long-term: S&OP process`,
    icon: 'Boxes',
    translationKey: 'help.modules.mrp',
    relatedModules: ['wms', 'aps', 'mes', 'kpi'],
    targetAudience: ['supply_chain', 'planner', 'procurement'],
  },

  aps: {
    id: 'aps',
    title: 'Advanced Planning & Scheduling (APS)',
    description: 'Finite capacity scheduling, constraint optimization, and what-if scenarios.',
    content: `The APS module enables intelligent production scheduling:

**Finite Capacity Scheduling**
• Resource constraint modeling
• Setup time optimization
• Parallel operation support
• Machine and labor constraints

**Optimization Engine**
• Multi-objective optimization
• Priority rule configuration
• constraint-based solving
• Genetic algorithm options

**Gantt Visualization**
• Interactive drag-and-drop
• Order color coding
• Constraint highlighting
• Real-time rescheduling

**What-If Scenarios**
• Scenario comparison
• Rush order simulation
• Capacity change impact
• Demand variation analysis

**Integration**
🔗 Links to MRP for material availability
📋 Connects to MES for execution
⚙️ Syncs with CMMS for maintenance windows
📊 Feeds KPI with schedule adherence`,
    icon: 'CalendarClock',
    translationKey: 'help.modules.aps',
    relatedModules: ['mes', 'mrp', 'cmms', 'kpi'],
    targetAudience: ['planner', 'scheduler', 'operations'],
  },

  dt: {
    id: 'dt',
    title: 'Digital Twin',
    description: 'Virtual asset models, simulation, and real-time synchronization.',
    content: `The Digital Twin module creates virtual representations of your physical assets:

**Asset Modeling**
• 3D model integration
• Component hierarchy
• Parameter definitions
• State representation

**Real-Time Sync**
• IoT sensor connection
• Live state updates
• Historical playback
• Event recording

**Simulation**
• Process simulation
• What-if scenarios
• Failure impact analysis
• Optimization testing

**Visualization**
• 3D interactive views
• Heat maps and overlays
• Animation support
• Mobile AR preview

**Use Cases**
🏭 Factory layout optimization
🔧 Maintenance planning
📈 Performance prediction
🎓 Training and onboarding`,
    icon: 'Boxes',
    translationKey: 'help.modules.dt',
    relatedModules: ['iot', 'mes', 'cmms', 'aps'],
    targetAudience: ['engineer', 'plant_manager', 'it_manager'],
  },

  hrm: {
    id: 'hrm',
    title: 'Human Resources Management (HRM)',
    description: 'Workforce management, skills tracking, and organizational development.',
    content: `The HRM module manages your most important asset — your people:

**Employee Management**
• Employee profiles and records
• Organizational structure
• Position management
• Employment history

**Skills & Competencies**
• Skills matrix
• Competency frameworks
• Gap analysis
• Development planning

**Scheduling**
• Shift planning
• Absence management
• Overtime tracking
• Labor compliance

**Performance**
• Performance reviews
• Goal setting
• 360 feedback
• Talent assessment

**Recruitment**
• Job requisitions
• Candidate tracking
• Interview scheduling
• Offer management

**Integration**
🔗 Links to LMS for training
📋 Connected to SKILLS module
⚙️ Syncs with payroll systems`,
    icon: 'Users',
    translationKey: 'help.modules.hrm',
    relatedModules: ['lms', 'skills', 'hse', 'kpi'],
    targetAudience: ['hr_manager', 'people_ops', 'plant_manager'],
  },

  lms: {
    id: 'lms',
    title: 'Learning Management (LMS)',
    description: 'Training programs, certifications, and skills development.',
    content: `The LMS module accelerates workforce development:

**Course Management**
• Course catalog
• Multi-format content (video, docs, quizzes)
• Learning paths
• Prerequisite chains

**Enrollment & Tracking**
• Self-enrollment options
• Manager-assigned training
• Progress tracking
• Completion certificates

**Certifications**
• Certification programs
• Validity periods
• Renewal tracking
• Compliance reporting

**Assessment**
• Quiz and exam builder
• Passing score configuration
• Attempt tracking
• Detailed results analysis

**Instructor-Led Training**
• Session scheduling
• Attendance tracking
• Classroom resource booking
• Virtual training integration

**Compliance**
📋 Mandatory training assignment
⏰ Due date tracking
📊 Compliance dashboards
🔔 Reminder notifications`,
    icon: 'GraduationCap',
    translationKey: 'help.modules.lms',
    relatedModules: ['hrm', 'skills', 'hse', 'qms'],
    targetAudience: ['training_manager', 'hr_manager', 'supervisor'],
  },

  skills: {
    id: 'skills',
    title: 'Skills Matrix & Competency',
    description: 'Skill tracking, competency frameworks, and gap analysis.',
    content: `The SKILLS module ensures workforce capability alignment:

**Skills Matrix**
• Visual skill/employee grid
• Proficiency level tracking
• Coverage analysis
• Skill demand planning

**Competency Frameworks**
• Define competency models
• Role requirements mapping
• Behavioral indicators
• Development resources

**Gap Analysis**
• Current vs. required skills
• Individual development plans
• Team capability views
• Succession planning support

**Skill Development**
• Training recommendations
• Mentoring matches
• On-the-job learning tracking
• Cross-training programs

**Operational Planning**
🎯 Shift skill coverage
📊 Project team capability
🔄 Cross-training priorities
📈 Skill trending analysis`,
    icon: 'Star',
    translationKey: 'help.modules.skills',
    relatedModules: ['hrm', 'lms', 'mes', 'aps'],
    targetAudience: ['hr_manager', 'supervisor', 'plant_manager'],
  },

  execution: {
    id: 'execution',
    title: 'Execution Tracking',
    description: 'Initiative progress monitoring, task management, and milestone tracking.',
    content: `The Execution module ensures transformation initiatives deliver results:

**Progress Tracking**
• Overall completion percentage
• Status distribution (On Track/At Risk/Blocked)
• Burndown charts
• Velocity trends

**Task Management**
• Task creation and assignment
• Status workflow (To Do → Done)
• Time logging
• Comments and attachments

**Milestones**
• Milestone definition
• Due date tracking
• Achievement logging
• Stakeholder notifications

**Risk Management**
• Risk identification
• Probability/impact scoring
• Mitigation actions
• Risk owner assignment

**Reporting**
📊 Weekly progress reports
📈 Executive summaries
🎯 Milestone hit rates
⏱️ Cycle time analytics`,
    icon: 'Play',
    translationKey: 'help.modules.execution',
    relatedModules: ['initiatives', 'roadmap', 'dashboard', 'kpi'],
    targetAudience: ['project_manager', 'manager', 'executive'],
  },

  billing: {
    id: 'billing',
    title: 'Billing & Subscription',
    description: 'Subscription management, invoicing, and payment processing.',
    content: `Manage your Consultinity subscription and billing:

**Subscription**
• Current plan details
• Feature access levels
• Usage monitoring
• Upgrade/downgrade options

**Billing Details**
• Invoice history
• Payment methods
• Billing contacts
• Tax information

**Add-ons**
• Module add-ons
• User seat expansion
• Storage upgrades
• API access tiers

**Support Levels**
• Standard support included
• Premium support options
• SLA commitments
• Escalation paths`,
    targetAudience: ['admin', 'owner', 'finance'],
  },
  economics: {
    id: 'economics',
    title: 'Economics & Value Realization',
    description: 'Financial analysis, ROI tracking, and value maturity modeling.',
    content: `The Economics module translates digital transformation into financial impact:

**ROI Analysis**
• Automated Net Present Value (NPV) calculation for initiatives
• Payback period estimation and tracking
• Internal Rate of Return (IRR) for capital investments
• Cost-benefit analysis for technology adoption

**Digitization Maturity**
• Dimension-based maturity scoring
• Financial impact of maturity level transitions
• Benchmarking against industry leaders (SIRI/ADMA)
• Strategic alignment with business goals

**Cost Management**
• Total Cost of Ownership (TCO) calculators
• Capex vs. Opex optimization
• SaaS licensing and infrastructure cost tracking
• Resource efficiency and labor savings quantification

**Integration Points**
• Connects to Initiatives for project budgets
• Syncs with KPI module for realized savings
• Feeds Executive View with financial summaries
• Links with Data AI for anomaly-based loss detection

**Executive Insights**
💰 High-maturity organizations see 2-3x higher EBITDA growth
📊 Target transformation ROI: >250% over 3 years
🚀 Focus on "Quick Wins" to fund long-term strategic shifts`,
    icon: 'TrendingUp',
    translationKey: 'help.modules.economics',
    relatedModules: ['initiatives', 'kpi', 'dashboard', 'data_ai'],
    targetAudience: ['cfo', 'ceo', 'owner', 'executive'],
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
