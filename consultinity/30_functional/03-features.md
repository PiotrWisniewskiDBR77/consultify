# Features Documentation

## Overview

Consultify provides a comprehensive platform for digital transformation planning and execution. The platform is organized into distinct modules that guide organizations through a structured journey from assessment to full rollout.

## Core Modules

### 1. Dashboard (Home)

**Purpose:** Simple, clean entry point showing project status and progress through the transformation journey.

**Features:**
- **Overview Tab** (Before/Early Phase):
  - Description of the 5-step transformation process
  - Current step status indicators
  - Navigation to next steps

- **Execution Snapshot** (After Initiatives exist):
  - Initiative counters (total, in progress, completed, delayed)
  - Project status (On Track / At Risk / Off Track)
  - Key metrics (active pilots, estimated savings, roadmap completion)
  - Quick navigation to key modules

**AI Behavior:**
- Explains the transformation process structure
- Provides status commentary and insights
- Offers to generate executive summaries

---

### 2. Expectations & Challenges (Context Builder)

**Purpose:** Build comprehensive strategic context that informs all subsequent transformation decisions.

**Key Elements:**
- **Company Profile:**
  - Industry, size, main processes, business model
  - Market context and competitive landscape

- **Goals & Expectations:**
  - Strategic objectives
  - Time horizons
  - Success criteria

- **Challenges & Pain Points:**
  - Current problems and constraints
  - Risk factors
  - Organizational limitations

- **Document Upload:**
  - Strategy documents
  - Existing audits
  - Internal reports

**AI Role:**
- Leads structured conversation about context
- Helps articulate goals and challenges
- Suggests missing aspects to consider
- Reads and summarizes uploaded documents
- Acts as a senior consultant, not a form filler

---

### 3. Assessment (DRD & Additional Audits)

**Purpose:** Determine current and target digital maturity across 7 DRD (Digital Readiness Dimensions) axes.

**DRD Axes:**
1. **Digital Processes** – Process digitization and automation
2. **Digital Products** – Digital product development capabilities
3. **Digital Business Models** – Business model innovation
4. **Data & Analytics** – Data management and analytics maturity
5. **Organizational Culture** – Digital culture and change readiness
6. **Cybersecurity** – Security posture and practices
7. **AI** – Artificial intelligence adoption and capabilities

**For Each Axis:**
- Select **Actual Level** (current state)
- Select **Target Level** (desired state)
- Add comments and evidence
- AI suggests realistic levels based on context

**Additional Audits:**
- Upload results from external frameworks (ADMA, SIRI, ISO, Lean)
- AI maps external assessments to DRD axes
- Cross-reference multiple assessment sources

**RapidLean Production Observations (Gemba Walk):**
- **Automated Data Collection:** Operators use standardized templates on production floor
- **6 Observation Templates:**
  1. Value Stream Observation → DRD Axis 1 (Processes), Areas 1A, 1B, 1C
  2. Waste Identification → DRD Axis 1 (Processes), Area 1C
  3. Flow & Pull Systems → DRD Axis 1 (Processes), Area 1C
  4. Quality at Source → DRD Axis 1 (Processes), Area 1B
  5. Continuous Improvement → DRD Axis 5 (Culture), Area 5A
  6. Visual Management → DRD Axis 5 (Culture), Area 5B
- **Mobile-Friendly Interface:** Optimized for operators on production floor
- **Automatic Mapping:** Observations → RapidLean scores (1-5) → DRD levels (1-7)
- **Report Generation:** Comprehensive PDF report (DBR77 format) with:
  - Executive summary
  - Observation details with photos
  - DRD mapping & gap analysis
  - AI-powered recommendations
  - Evidence gallery
- **Integration:** Observations feed into Initiative Generator as evidence

**AI Role:**
- Suggests realistic maturity levels
- Explains each level in plain language
- Challenges unrealistic choices
- Ensures assessment quality as foundation for initiatives
- Analyzes observation notes/photos for enhanced scoring
- Generates DRD-aligned recommendations

**Architecture:**
- **Backend Services:**
  - `RapidLeanObservationMapper`: Maps observations to RapidLean responses
  - `RapidLeanService`: Extended with observation support and DRD mapping
  - `RapidLeanReportService`: Generates comprehensive PDF/Excel reports
- **Frontend Components:**
  - `RapidLeanObservationForm`: Mobile-friendly observation form
  - `RapidLeanWorkspace`: Main workspace orchestrating observation flow
  - `RapidLeanResultsCard`: Extended with DRD mapping display
- **Database:**
  - `rapid_lean_observations`: Stores observation data
  - `rapid_lean_reports`: Stores generated report metadata
  - Extended `rapid_lean_assessments` with observation count and DRD mapping

---

### 4. Initiatives & Roadmap

**Purpose:** Convert maturity gaps into a structured portfolio of initiatives and a logical execution roadmap.

**Features:**

- **AI Initiatives Generator:**
  - Generates initiative proposals based on:
    - Assessment gaps
    - Challenges and context
    - Uploaded documents
    - Industry benchmarks

- **Initiatives List:**
  - Impact assessment
  - Difficulty rating
  - DRD axis mapping
  - Priority indicators
  - Status tracking

- **Initiative Cards:**
  - Full initiative details
  - Business value proposition
  - Required competencies
  - Cost estimates (CAPEX/OPEX)
  - Expected ROI
  - Success criteria

- **Roadmap Builder:**
  - Drag & drop timeline interface
  - Workstream grouping
  - Dependency management
  - Resource allocation
  - Timeline visualization

**AI Role:**
- Generates initiative proposals
- Explains why initiatives are needed
- Links initiatives to DRD levels and gaps
- Suggests realistic ordering and dependencies
- Warns about overload and illogical sequences

---

### 5. Pilot Execution

**Purpose:** Test selected initiatives on limited scope to de-risk full rollout.

**Key Features:**
- **Pilot Selection:**
  - Choose initiatives for pilot
  - Define pilot scope (where, for whom, what exactly)
  - Set pilot boundaries

- **Pilot Team:**
  - Assign owner and sponsor
  - Define team members and roles
  - Establish responsibilities

- **Pilot Planning:**
  - Action plan and milestones
  - Timeline and deliverables
  - Success criteria

- **Pilot KPIs:**
  - Operational metrics
  - Financial metrics
  - Adoption indicators

- **Pilot Dashboard:**
  - Execution tracking
  - Progress monitoring
  - Risk identification

- **Pilot Evaluation:**
  - Go / No Go / Adjust decision framework
  - Lessons learned capture
  - Rollout readiness assessment

**AI Role:**
- Suggests which initiatives to pilot
- Proposes pilot plans and KPIs
- Monitors pilot execution
- Identifies risks and root causes
- Writes evaluation summary and recommendations

---

### 6. Full Rollout

**Purpose:** Roll out successful solutions across the entire organization.

**Features:**
- **Rollout Scope:**
  - Overview of all initiatives included
  - Workstream organization
  - Dependency mapping

- **Execution Dashboard:**
  - Status of all initiatives
  - Progress tracking
  - Timeline visualization

- **Initiative Execution Views:**
  - Task management
  - Progress tracking
  - Risk management
  - Owner assignment

- **Risk & Issue Management:**
  - Risk register
  - Issue tracking
  - Escalation workflows

- **Change Management:**
  - Communication plans
  - Training programs
  - Adoption tracking

- **Review Support:**
  - Monthly/quarterly review templates
  - Progress reports
  - Executive summaries

**AI Role:**
- Acts as AI PMO (Project Management Office)
- Monitors progress across initiatives
- Flags delays and overloads
- Proposes corrective actions
- Tracks risk changes
- Validates progress toward assessment targets

---

### 7. Economics & ROI

**Purpose:** Translate operational improvements into real financial impact.

**Features:**
- **Cost Baseline:**
  - Current costs and waste identification
  - Baseline metrics

- **Initiative Costs:**
  - Implementation costs
  - Ongoing operational costs
  - Total cost of ownership

- **Benefit Model:**
  - Operational improvements
  - Financial impact conversion
  - Time and error savings quantification

- **Financial Metrics:**
  - ROI (Return on Investment)
  - NPV (Net Present Value)
  - Payback period
  - Total savings

- **Scenario Simulation:**
  - Optimistic scenario
  - Realistic scenario
  - Conservative scenario
  - Sensitivity analysis

- **Investment Summary:**
  - Executive-level financial overview
  - Board-ready presentations

**AI Role:**
- Checks realism of assumptions
- Uses industry benchmarks
- Converts time & error savings into money
- Explains economics in CFO-friendly language
- Validates financial projections

---

### 8. Execution Reports

**Purpose:** Provide clear, structured reports for different audiences.

**Report Types:**
- **Board/CEO Reports:**
  - High-level strategic overview
  - Key metrics and insights
  - Executive summary

- **PMO/Transformation Office Reports:**
  - Detailed execution status
  - Initiative progress
  - Risk and issue tracking

- **Sponsor & Owner Reports:**
  - Initiative-specific reports
  - Task-level details
  - Action items

**Features:**
- Configurable dashboards
- Monthly and quarterly AI-generated summaries
- Progress vs. assessment targets
- Impact on KPIs & ROI
- Key risks and decisions needed
- Export formats (PDF, PPT, text)

**AI Role:**
- Automatically generates human-readable reports
- Tailors tone and detail level to audience
- Highlights insights, not only data
- Performs sense-check on conclusions
- Ensures data accuracy

---

## AI Assistant Features

### AI Roles

The AI operates in different roles depending on context:

- **ADVISOR** – Strategic guidance and recommendations
- **PMO_MANAGER** – Project management and execution support
- **EXECUTOR** – Task execution and action taking
- **EDUCATOR** – Teaching and knowledge transfer

### AI Chat Modes

- **EXPLAIN** – Explains concepts and methodologies
- **GUIDE** – Guides through processes
- **ANALYZE** – Analyzes data and situations
- **DO** – Performs actions (with approval)
- **TEACH** – Educational content delivery

### AI Capabilities

- **Context Awareness:** AI sees current module, data, and project state
- **Proactive Suggestions:** AI comments on user actions and suggests improvements
- **Sense-Check:** Validates assumptions, numbers, sequences, and ROI
- **Industry Adaptation:** Adapts to industry context (manufacturing, logistics, services)
- **Multi-Layer Knowledge:**
  - Digital Pathfinder methodology
  - Internal DRD model (7 axes)
  - External industry benchmarks and trends

---

## PMO Framework

### PMO Domains

Consultify implements a certifiable PMO model aligned with:
- ISO 21500:2021
- PMI PMBOK 7th Edition
- PRINCE2

**7 PMO Domains:**
1. Governance & Strategy
2. Portfolio Management
3. Program Management
4. Project Management
5. Resource Management
6. Performance Management
7. Change Management

### PMO Health Monitoring

- **Health Snapshots:** Real-time project health assessment
- **Stage Gates:** Gate review management
- **Blockers:** Automatic blocker identification
- **Risk Tracking:** Risk register and monitoring
- **Decision Management:** Decision log and tracking

---

## Collaboration Features

### Team Management

- **Teams:** Create and manage teams
- **Team Members:** Assign roles and responsibilities
- **Collaboration:** Shared workspaces and communication

### Task Management

- **Tasks:** Create, assign, and track tasks
- **Task Dependencies:** Define task relationships
- **Task Types:** Analytical, design, execution, validation
- **Task Status:** Todo, in progress, blocked, completed

### Notifications

- **Real-time Notifications:** Task assignments, updates, mentions
- **Notification Preferences:** Customizable notification settings
- **Notification Center:** Centralized notification management

---

## My Work Module

### Overview

**Purpose:** Personal productivity hub for managing tasks, inbox, focus planning, and notifications - designed with PMO best practices from McKinsey, BCG, Deloitte and tools like Jira, Linear, Asana.

### Focus Board

**Purpose:** Plan your day using time blocking methodology.

**Features:**
- **Focus Tasks:** Priority tasks for today
- **Time Blocks:** Allocate specific hours to tasks
- **Visual Schedule:** See your day at a glance
- **Quick Prioritize:** Drag tasks from inbox to focus
- **AI Suggestions:** Smart task prioritization recommendations

**Best Practices:**
- Limit to 3-5 focus tasks per day
- Block morning hours for deep work
- Include buffer time between blocks

### Inbox Triage

**Purpose:** Process new tasks efficiently using Inbox Zero methodology.

**PMO Categories:**
- 🔴 **Blocking Phase:** Tasks blocking phase gates
- 🟠 **Blocking Initiative:** Tasks blocking initiative progress
- 🟡 **Awaiting Decision:** Tasks waiting for stakeholder decisions
- ⚫ **Overdue:** Past-due tasks
- ✅ **Other:** Remaining tasks

**Triage Actions:**
- **Complete:** Mark task as done
- **Prioritize:** Add to Focus Board
- **Defer:** Postpone to later date
- **Delegate:** Reassign to teammate
- **Delete:** Remove task

### All Tasks View

**Features:**
- **Multi-Select Filters:** Status, Priority, Due Date, PMO Category
- **Virtualized List:** Smooth scrolling for large task lists
- **Bulk Actions:** Select multiple tasks for batch operations
- **Quick Search:** Find tasks by title, description, or labels

### Personal Dashboard

**Execution Score Card:**
- Personal execution score (0-100)
- Completed vs total tasks ratio
- Overdue penalty (-5 per overdue task)
- Trend indicator (up/down/stable)

**Workload Heatmap:**
- Team capacity visualization
- Color-coded utilization (green/yellow/red)
- 7-day or monthly view
- Click to see specific tasks per day

**Bottleneck Alerts:**
- AI-detected blocking issues
- Severity indicators (Warning/Critical)
- Suggested resolutions
- Quick action buttons

**Velocity Chart:**
- Weekly completed tasks trend
- Average cycle time
- Historical comparison

### Notification System

**Notification Types:**
| Type | Severity | Description |
|------|----------|-------------|
| Task Assigned | INFO | New task assignment |
| Task Overdue | WARNING | Task past due date |
| Decision Required | WARNING | Stakeholder decision needed |
| Initiative Blocked | CRITICAL | Initiative progress blocked |
| AI Risk Detected | CRITICAL | AI identified project risk |
| Gate Approaching | WARNING | Phase gate deadline near |

**Notification Preferences:**
- Mute by severity (Info/Warning/Critical)
- Mute specific notification types
- Email digest (daily/weekly)
- Quiet hours configuration

**Digest Emails:**
- Daily or weekly summary
- Configurable delivery time
- Unread notifications compilation
- Direct action links

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Command palette |
| `g + f` | Go to Focus |
| `g + i` | Go to Inbox |
| `g + t` | Go to All Tasks |
| `c` | Create new task |
| `d` | Complete task |
| `?` | Show shortcuts help |

### Mobile Experience

**Touch Gestures:**
- Swipe left → Quick actions (complete, delete)
- Swipe right → Prioritize / add to focus
- Pull down → Refresh list
- Long press → Context menu

**Mobile Optimizations:**
- Large touch targets (44px minimum)
- Bottom action bar for thumb access
- Collapsible sections
- Offline capability with sync

### AI Integration

**AI Capabilities:**
- Smart task prioritization based on PMO context
- Bottleneck detection and resolution suggestions
- Workload balancing recommendations
- Risk identification from task patterns
- Proactive deadline warnings

**AI Role:**
- Monitors execution velocity
- Flags potential blockers
- Suggests task reordering
- Identifies overloaded team members

---

## User Management & Access Control

### User Roles

- **SUPERADMIN** – Full system access
- **ADMIN** – Organization-level administration
- **USER** – Standard user access
- **CONSULTANT** – Consultant mode with client access

### Organization Management

- **Multi-tenant Architecture:** Organization-scoped data
- **Organization Settings:** Customizable organization configuration
- **Billing Management:** Subscription and usage tracking

---

## Integration Capabilities

### LLM Providers

- **Google Gemini** – Primary LLM provider
- **OpenAI** – Alternative LLM provider
- **Anthropic Claude** – Alternative LLM provider
- **Custom Providers** – Configurable provider support

### OAuth Authentication

- **Google OAuth** – Google account login
- **LinkedIn OAuth** – LinkedIn account login
- **Email/Password** – Traditional authentication

### Payment Processing

- **Stripe Integration** – Subscription billing
- **Token-based Billing** – Usage-based pricing
- **Invoice Management** – Invoice generation and tracking

---

## Analytics & Reporting

### Analytics Dashboards

- **Journey Analytics** – User journey tracking
- **Advanced Analytics** – Deep-dive analytics
- **AI Analytics** – AI usage and performance metrics
- **Performance Metrics** – System performance monitoring

### Reporting

- **Custom Reports** – Configurable report generation
- **Scheduled Reports** – Automated report delivery
- **Export Formats** – PDF, Excel, CSV export options

---

## Security & Compliance

### Security Features

- **JWT Authentication** – Secure token-based authentication
- **Password Hashing** – bcrypt password security
- **Rate Limiting** – API request throttling
- **Audit Logging** – Comprehensive audit trail
- **Data Isolation** – Multi-tenant data separation

### Compliance

- **GDPR Support** – Data protection compliance
- **Audit Trails** – Complete action logging
- **Data Export** – User data export capabilities
- **Data Deletion** – Right to be forgotten support

---

## Next Steps

- **[Architecture Guide](02-architecture.md)** – Understand system architecture
- **[API Reference](API_REFERENCE.md)** – Explore API endpoints
- **[Development Guide](04-development.md)** – Developer documentation
- **[Getting Started](01-getting-started.md)** – Setup and installation

---

*For detailed functional specifications, see [docs/functional_requirements_full.txt](functional_requirements_full.txt)*


