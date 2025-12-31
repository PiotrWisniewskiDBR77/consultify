# CONSULTIFY ENTERPRISE SPECIFICATION
## Version 1.1 | Enterprise-Grade SaaS for Strategic Decision Management

> **Target Quality:** BCG / McKinsey / Capgemini consulting standard  
> **Scope:** User Journey Phases A → F  
> **Philosophy:** Trust-first, AI-disciplined, Organization-centric  
> **Last Updated:** 30 December 2025

### Related Documents

| Document | Purpose |
|----------|---------|
| `docs/AI_ENTERPRISE_AUDIT_REPORT.md` | AI system compliance with PMO standards |
| `docs/00_foundation/PMO_STANDARDS_COMPLIANCE.md` | ISO 21500 / PMBOK / PRINCE2 mapping |
| `docs/ai_research/AI_MASTER_ARCHITECTURE.md` | Technical AI architecture |
| `docs/api/AI_API_REFERENCE.md` | AI API documentation |

---

# EXECUTIVE SUMMARY

Consultify is an **enterprise decision support platform** that enables organizations to structure, document, and improve their strategic decision-making processes.

Unlike typical SaaS products that optimize for speed and scale, Consultify optimizes for:
- **Decision quality** over decision speed
- **Organizational learning** over individual productivity  
- **Intellectual credibility** over feature count

This specification defines the ideal enterprise implementation across six phases of user engagement.

---

# CORE DESIGN PRINCIPLES

## 1. Trust Progression Model

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TRUST PROGRESSION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  ANON → DEMO → TRIAL → ORG → VALUE → TEAM → ECOSYSTEM                  │
│    │      │       │      │       │       │         │                    │
│  Zero   Read   Limited  Memory  Dialog  Growth  Advocacy               │
│  Trust  Only   Write    Start   Start   Start   Start                  │
└─────────────────────────────────────────────────────────────────────────┘
```

## 2. AI Discipline Model

| Phase | AI Mode | Behavior Constraints |
|-------|---------|---------------------|
| A | **SILENT** | No AI presence |
| B | **NARRATOR** | Explain only, no questions |
| C | **GUIDE** | Explain limits, set expectations |
| D | **MEMORY** | Activate context, confirm consent |
| E | **PARTNER** | Dialog, not solutions |
| F | **FACILITATOR** | Surface, synthesize, never judge |

## 3. Commercial Philosophy

```
NOT: "How many users can we capture?"
BUT: "How many organizations can we transform?"
```

---

# PHASE A: PRE-ENTRY (PUBLIC)

## A.1 Strategic Intent

| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Quality filter, not lead capture |
| **User Perception** | "These people understand the problem deeply" |
| **Success Metric** | Category comprehension in < 60 seconds |

## A.2 User Experience Specification

### Landing Page Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                     [LOGO — minimal]                            │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│               NORTH STAR STATEMENT                               │
│    (One sentence defining the category, not the product)        │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│              PROBLEM NARRATIVE (3-4 sentences)                  │
│    Structural problem of decision-making in complex orgs        │
│    No features. No promises. No AI mentions.                    │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│            [ Zobacz, jak to działa ]  ← Single CTA              │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│   [Optional: 2-3 organization logos — no claims, just presence] │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Content Rules

| Element | Rule | Rationale |
|---------|------|-----------|
| **Headlines** | Problem-focused | Builds intellectual credibility |
| **Copy** | Max 100 words total | Respect for attention |
| **CTAs** | Exactly ONE | Trust through restraint |
| **Forms** | NONE | No data before value |
| **AI mentions** | ZERO | No technology hype |
| **Feature lists** | ZERO | Category, not product |
| **Testimonials** | ZERO | Implied ROI triggers skepticism |

### Visual Language

| Aspect | Specification |
|--------|--------------|
| **Color palette** | Muted, professional (no gradients) |
| **Typography** | Serif for headlines (authority), sans-serif for body |
| **Imagery** | Abstract or none (no stock photos of meetings) |
| **Animation** | Minimal to none |
| **White space** | Generous (60%+ of viewport) |

## A.3 Technical Implementation

### Frontend Components

```typescript
// LandingPage.tsx
interface LandingPageProps {
  northStarStatement: string;      // Max 15 words
  problemNarrative: string;         // Max 50 words
  ctaText: string;                  // "Zobacz, jak to działa"
  ctaAction: () => void;            // Navigate to demo
  partnerLogos?: string[];          // Max 3, optional
}

// NO tracking pixels
// NO analytics on landing (respects EPIC-A2)
// NO cookies before consent
```

### State Machine

```
State: ANONYMOUS
├── Actions allowed: VIEW_LANDING, CLICK_CTA
├── Actions blocked: ALL write operations
└── Transition: CLICK_CTA → DEMO_SESSION
```

## A.4 Quality Checklist

| Criterion | Pass Condition |
|-----------|---------------|
| Zero forms visible | ✓ |
| Zero AI/ML/automation language | ✓ |
| Zero feature descriptions | ✓ |
| Zero ROI promises | ✓ |
| Single CTA only | ✓ |
| Page loads < 2s | ✓ |
| WCAG 2.1 AA compliant | ✓ |
| Mobile responsive | ✓ |

---

# PHASE B: DEMO SESSION

## B.1 Strategic Intent

| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Demonstrate method maturity, not features |
| **User Perception** | "This is serious. Nobody is trying to trap me." |
| **Success Metric** | User understands DRD methodology |

## B.2 Entry Flow

### Authentication Options

```
┌─────────────────────────────────────────────────────────────────┐
│                     DEMO ACCESS                                  │
│                                                                  │
│   To explore the full system, please sign in:                   │
│                                                                  │
│   [ Continue with Google ]                                      │
│   [ Continue with LinkedIn ]                                    │
│   [ Continue with Email ]                                       │
│                                                                  │
│   ─────────────────────────────────────────────────────────────  │
│   No account will be created.                                   │
│   No data will be stored.                                       │
│   This is a read-only exploration.                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Authentication Technical Spec

```typescript
interface DemoSession {
  sessionId: string;           // Temporary, expires on logout
  authProvider: 'google' | 'linkedin' | 'email';
  userEmail: string;           // For session only, not persisted
  expiresAt: Date;             // Max 24 hours
  isDemo: true;                // Immutable flag
  permissions: 'READ_ONLY';    // Cannot change
}

// Session storage only — no database writes
// No user record created
// No organization created
// Expires on browser close or 24h
```

## B.3 Demo Environment

### Reference Data Set

```typescript
interface DemoOrganization {
  name: "Legolex";                    // Fictional reference company
  industry: "Legal Tech";
  employees: 150;
  context: "Growing SaaS company facing scaling decisions";
  
  drdAxes: [
    {
      name: "Technology Investment",
      positions: [...],               // Pre-populated positions
      perspectives: [...],            // Multiple viewpoints
      insights: [...],                // Generated insights
    },
    // 3-5 complete axes demonstrating full capability
  ];
  
  initiatives: [
    // 2-3 sample initiatives showing execution mode
  ];
}
```

### Navigation Structure

```
DEMO VIEW
├── Dashboard (overview of Legolex state)
├── DRD Workspace
│   ├── Axes explorer (read-only browsing)
│   ├── Position details (view sample data)
│   └── Insights panel (AI-generated, pre-cached)
├── Execution Mode (sample initiatives)
│   ├── Initiative list
│   ├── Task breakdown
│   └── Progress tracking
└── Reports (sample outputs)
    ├── DRD Snapshot
    └── Executive Summary
```

### UI State Indicators

```
┌─────────────────────────────────────────────────────────────────┐
│  ⓘ DEMO MODE — You are viewing reference data from Legolex     │
│    All actions are disabled. This is a read-only exploration.  │
│                                              [Exit Demo]        │
└─────────────────────────────────────────────────────────────────┘
```

**Banner Requirements:**
- Persistent, non-dismissible
- Visible on every screen
- Clear "Exit Demo" path
- No urgency language

## B.4 AI Behavior in Demo

### AI Mode: NARRATOR

```typescript
interface AINarratorConfig {
  mode: 'NARRATOR';
  
  allowed: [
    'EXPLAIN_CONCEPT',        // "DRD axes represent..."
    'DESCRIBE_ELEMENT',       // "This position shows..."
    'CLARIFY_METHODOLOGY',    // "The reason for this is..."
    'ANSWER_HOW_IT_WORKS',    // "The system works by..."
  ];
  
  blocked: [
    'ASK_QUESTION',           // Never asks user anything
    'SUGGEST_ACTION',         // Never recommends next steps
    'PERSONALIZE',            // Never uses "you" or "your"
    'REQUEST_INPUT',          // Never prompts for data
    'MAKE_PROMISE',           // Never implies future value
  ];
  
  tone: {
    style: 'educator',        // Teaching, not selling
    formality: 'professional',
    length: 'concise',        // Max 3 sentences per response
  };
}
```

### AI Interaction Points

```
┌─────────────────────────────────────────────────────────────────┐
│  AI NARRATOR PANEL                                              │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  "You're looking at the Technology Investment axis.             │
│   Each position represents a different stakeholder's view       │
│   on how the company should allocate technical resources.       │
│   The system surfaces disagreements to enable better dialogue." │
│                                                                  │
│  [What is a position?]  [How are insights generated?]           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Interaction Rules:**
- AI speaks only when user clicks explanation buttons
- AI never initiates conversation
- AI responses are pre-generated for consistency
- No streaming/typing animations (feels too "alive")

## B.5 Exit Flow

### Primary CTA

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│     You've explored the Consultify method.                      │
│                                                                  │
│     To work on your organization's decisions,                   │
│     you'll need trusted access.                                 │
│                                                                  │
│            [ Zróbmy to dla Twojej firmy ]                       │
│                                                                  │
│     ─────────────────────────────────────────────────────────   │
│     Not ready? You can return to this demo anytime.             │
│                                                                  │
│            [ Exit and return later ]                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Exit Without Action

- No exit intent tracking
- No popup retention
- No email capture
- Clean logout, session destroyed
- Optional: Email "Your demo is waiting" (opt-in only)

## B.6 Quality Checklist

| Criterion | Pass Condition |
|-----------|---------------|
| No persistent data created | ✓ |
| Demo banner visible on all screens | ✓ |
| All write actions disabled | ✓ |
| AI never asks questions | ✓ |
| Reference data is consistent | ✓ |
| Session expires properly | ✓ |
| Exit path is clean | ✓ |

---

# PHASE C: TRIAL ENTRY

## C.1 Strategic Intent

| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Filter serious organizations |
| **User Perception** | "This is selective. My time investment matters." |
| **Success Metric** | High intent → high conversion |

## C.2 Access Control

### Entry Requirements

```typescript
type TrialEntryMethod = 
  | { type: 'INVITATION_CODE'; code: string; }
  | { type: 'REFERRAL'; referrerId: string; }
  | { type: 'CONSULTANT_INVITE'; consultantId: string; organizationId: string; }
  | { type: 'TEAM_INVITE'; teamId: string; inviterId: string; };

// NO open signup
// NO credit card trial
// NO "start free" path
```

### Access Code System

```typescript
interface AccessCode {
  id: string;
  codeHash: string;           // SHA-256, never store plaintext
  type: 'INVITATION' | 'REFERRAL' | 'CONSULTANT' | 'TEAM';
  createdBy: string;          // User or system
  createdAt: Date;
  expiresAt: Date;            // Default: 14 days
  maxUses: number;            // Default: 1
  currentUses: number;
  targetEmail?: string;       // If specific person
  metadata: {
    referrerOrg?: string;
    consultantId?: string;
    campaignId?: string;
  };
}

// Code format: XXXX-XXXX-XXXX (12 chars, alphanumeric)
// Case insensitive
// Single use by default
```

### Entry UI

```
┌─────────────────────────────────────────────────────────────────┐
│                     TRIAL ACCESS                                 │
│                                                                  │
│   Consultify works with selected organizations.                 │
│   Enter your invitation code to begin.                          │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │  XXXX  -  XXXX  -  XXXX                                 │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│                    [ Verify Code ]                              │
│                                                                  │
│   ─────────────────────────────────────────────────────────────  │
│   Don't have a code?                                            │
│   Request access from your consultant or organization admin.    │
│                                                                  │
│   [Request Access] → (opens contact form, not signup)           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## C.3 Trial Configuration

### Limits & Constraints

```typescript
interface TrialLimits {
  duration: {
    days: 14;                    // Fixed base period (updated from 30)
    extensions: 2;               // Max trial extensions allowed
    extensionDays: 14;           // Days per extension
  };
  
  features: {
    drdAxes: 3;                  // Max axes in trial
    positions: 10;               // Max positions per axis
    initiatives: 5;              // Max initiatives (updated from 1)
    teamMembers: 4;              // Total users: owner + 3 invites (updated from 3)
    projects: 3;                 // Max projects
    aiQueries: 50;               // Daily AI call soft limit
    aiTokens: 100000;            // Total AI token budget (hard limit)
    storage: 100;                // Storage limit in MB
    reports: 5;                  // Max generated reports
  };
  
  capabilities: {
    export: 'WATERMARKED';       // Trial watermark on all exports
    integrations: false;         // No external integrations
    api: false;                  // No API access
    sso: false;                  // No SSO
    aiRoles: ['ADVISOR'];        // Limited to ADVISOR role only
  };
}
```

### Limit Communication

```
┌─────────────────────────────────────────────────────────────────┐
│  TRIAL STATUS                                                   │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░  Day 8 of 14                              │
│                                                                  │
│  Projects: 1 of 3 used                                          │
│  Axes: 2 of 3 used                                              │
│  Team: 1 of 4 members                                           │
│  Initiatives: 2 of 5 active                                     │
│                                                                  │
│  AI queries: 12 of 50 today                                     │
│  AI tokens: 8,450 of 100,000 used                               │
│  Storage: 23 MB of 100 MB used                                  │
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  Trial limits exist to ensure focused exploration.              │
│  When you're ready to scale, create your organization.          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## C.4 AI Behavior in Trial

### AI Mode: GUIDE

```typescript
interface AIGuideConfig {
  mode: 'GUIDE';
  
  allowed: [
    'EXPLAIN_LIMITS',           // "This feature requires org setup"
    'SET_EXPECTATIONS',         // "In trial, you can..."
    'DESCRIBE_UPGRADE_PATH',    // "Creating an organization enables..."
    'VALIDATE_READINESS',       // "Before proceeding, consider..."
  ];
  
  blocked: [
    'CREATE_URGENCY',           // Never push for upgrade
    'APOLOGIZE_FOR_LIMITS',     // Never say "sorry, trial can't..."
    'PROMISE_OUTCOMES',         // Never imply success
  ];
  
  tone: {
    style: 'respectful',
    formality: 'professional',
    urgency: 'zero',
  };
}
```

### Limit Reached Response

```
┌─────────────────────────────────────────────────────────────────┐
│  AI GUIDE                                                       │
│  ─────────────────────────────────────────────────────────────  │
│                                                                  │
│  "You've reached the trial limit for DRD axes.                  │
│   This is intentional — trial is designed for focused           │
│   exploration, not full implementation.                         │
│                                                                  │
│   When you're ready to work comprehensively on your             │
│   organization's decisions, the next step is creating           │
│   your organization space."                                     │
│                                                                  │
│  [ Learn about organizations ]   [ Continue trial ]             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## C.5 Transition Gate

### Explicit Consent

```typescript
interface TrialToOrgTransition {
  // User must confirm:
  confirmations: [
    'I am ready to commit time to this process',
    'I understand an organization is a permanent decision space',
    'I have considered involving relevant stakeholders',
  ];
  
  // No auto-transitions
  autoTransition: false;
  
  // Transition requires explicit action
  transitionAction: 'CREATE_ORGANIZATION';
}
```

### Transition UI

```
┌─────────────────────────────────────────────────────────────────┐
│                 READY TO BEGIN?                                  │
│                                                                  │
│   Creating an organization is a deliberate step.                │
│   It's not an account upgrade — it's a decision to work         │
│   seriously on your organization's strategic challenges.        │
│                                                                  │
│   ─────────────────────────────────────────────────────────────  │
│                                                                  │
│   Before proceeding, confirm:                                   │
│                                                                  │
│   [ ] I am ready to commit time to this process                 │
│   [ ] I understand this creates a permanent decision space      │
│   [ ] I have considered who else should be involved             │
│                                                                  │
│                [ Create Organization ]                          │
│                                                                  │
│   ─────────────────────────────────────────────────────────────  │
│   Not ready? Continue exploring in trial mode.                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## C.6 Quality Checklist

| Criterion | Pass Condition |
|-----------|---------------|
| No open signup path | ✓ |
| Codes expire appropriately | ✓ |
| Limits clearly communicated | ✓ |
| No urgency language | ✓ |
| Explicit transition consent | ✓ |
| No auto-upgrade prompts | ✓ |

---

# PHASE D: ORGANIZATION SETUP

## D.1 Strategic Intent

| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Transform user→customer to org→partner |
| **User Perception** | "I'm founding a decision space, not buying a subscription" |
| **Success Metric** | Organizational ownership felt |

## D.2 Mental Shift Communication

### Language Rules

| ❌ Avoid | ✅ Use Instead |
|----------|---------------|
| "Create account" | "Found organization" |
| "Your profile" | "Your role" |
| "Settings" | "Organization context" |
| "Upgrade" | "Expand" |
| "Subscribe" | "Activate" |
| "Plan" | "Capacity" |

## D.3 Setup Flow

### Step 1: Organization Identity

```
┌─────────────────────────────────────────────────────────────────┐
│                 STEP 1 OF 4                                      │
│                                                                  │
│   YOUR ORGANIZATION'S NAME                                      │
│                                                                  │
│   This is the name of the organization you'll be working with.  │
│   It becomes the identity of your decision space.               │
│                                                                  │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                                                          │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│   Example: "Acme Corporation" or "Strategy Unit - London"       │
│                                                                  │
│                    [ Continue ]                                 │
│                                                                  │
│   ─────────────────────────────────────────────────────────────  │
│   This will be visible to all team members.                     │
│   You can invite others after setup.                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 2: Your Role

```
┌─────────────────────────────────────────────────────────────────┐
│                 STEP 2 OF 4                                      │
│                                                                  │
│   YOUR ROLE IN THIS ORGANIZATION                                │
│                                                                  │
│   How you think about decisions shapes how AI supports you.     │
│                                                                  │
│   ○ Executive / C-Suite                                         │
│     Strategic decisions, resource allocation                    │
│                                                                  │
│   ○ Director / Senior Manager                                   │
│     Operational decisions, team coordination                    │
│                                                                  │
│   ○ Manager / Team Lead                                         │
│     Tactical decisions, execution focus                         │
│                                                                  │
│   ○ Specialist / Contributor                                    │
│     Domain expertise, input perspective                         │
│                                                                  │
│   ○ External Consultant                                         │
│     Advisory role, objective facilitation                       │
│                                                                  │
│                    [ Continue ]                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 3: Organization Context

```
┌─────────────────────────────────────────────────────────────────┐
│                 STEP 3 OF 4                                      │
│                                                                  │
│   ORGANIZATION CONTEXT                                          │
│                                                                  │
│   This helps the system understand your decision environment.   │
│                                                                  │
│   Organization type:                                             │
│   ○ Operating company (we make decisions for ourselves)        │
│   ○ Consulting firm (we help others make decisions)            │
│                                                                  │
│   Primary industry:                                              │
│   ○ Technology / Software                                       │
│   ○ Financial Services                                          │
│   ○ Healthcare / Life Sciences                                  │
│   ○ Manufacturing / Industrial                                  │
│   ○ Professional Services                                       │
│   ○ Other                                                       │
│                                                                  │
│   Organization size:                                             │
│   ○ 1-50 employees                                              │
│   ○ 51-200 employees                                            │
│   ○ 201-1000 employees                                          │
│   ○ 1000+ employees                                             │
│                                                                  │
│                    [ Continue ]                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Step 4: Memory Activation

```
┌─────────────────────────────────────────────────────────────────┐
│                 STEP 4 OF 4                                      │
│                                                                  │
│   SYSTEM MEMORY ACTIVATION                                      │
│                                                                  │
│   From this point forward, the system will remember:            │
│                                                                  │
│   ✓ Your organization's context                                 │
│   ✓ Decisions and discussions                                   │
│   ✓ Insights and patterns discovered                            │
│   ✓ Team perspectives and positions                             │
│                                                                  │
│   This creates continuity in your decision process.             │
│   Memory belongs to your organization, not to individuals.      │
│                                                                  │
│   ─────────────────────────────────────────────────────────────  │
│                                                                  │
│   [ ] I understand that the system will remember our work       │
│                                                                  │
│                [ Activate Organization ]                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## D.4 AI Behavior in Setup

### AI Mode: MEMORY

```typescript
interface AIMemoryActivationConfig {
  mode: 'MEMORY';
  
  actions: {
    onActivation: [
      'Store organization context permanently',
      'Initialize decision memory graph',
      'Set AI personality to organizational context',
      'Confirm memory activation to user',
    ];
  };
  
  firstMessage: `
    "I now have context about [Organization Name].
    From this point, I'll remember our conversations and decisions.
    This helps me provide consistent, relevant support.
    
    What would you like to explore first?"
  `;
}
```

## D.5 Data Model

```typescript
interface Organization {
  id: string;                     // UUID
  name: string;
  slug: string;                   // URL-safe identifier
  
  context: {
    type: 'OPERATING' | 'CONSULTING';
    industry: string;
    size: string;
    createdAt: Date;
    createdBy: string;            // User ID
  };
  
  memory: {
    activatedAt: Date;
    contextVersion: number;       // For context updates
  };
  
  capabilities: {
    tier: 'TRIAL' | 'PROFESSIONAL' | 'ENTERPRISE';
    limits: CapabilityLimits;
    features: EnabledFeatures;
  };
  
  team: TeamMember[];
  
  audit: {
    createdAt: Date;
    lastActivityAt: Date;
  };
}
```

## D.6 Quality Checklist

| Criterion | Pass Condition |
|-----------|---------------|
| Each step requires conscious input | ✓ |
| No defaults pre-selected | ✓ |
| Memory activation requires consent | ✓ |
| Language is organizational, not personal | ✓ |
| Setup takes > 2 minutes (intentional slowness) | ✓ |
| Progress indicator visible | ✓ |

---

# PHASE E: GUIDED FIRST VALUE

## E.1 Strategic Intent

| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Create "AHA" moment via insight, not output |
| **User Perception** | "I see my problem more clearly now" |
| **Success Metric** | User articulates insight they didn't have before |

## E.2 Onboarding Flow

### AI-Led Dialog Structure

```
ONBOARDING FLOW
├── Introduction (AI explains process)
├── Domain Selection (what area to explore first)
├── Question 1: Situation
├── Question 2: Challenge
├── Question 3: Stakeholders
├── Question 4: Tensions
├── Question 5: Priorities
├── Question 6: Constraints (optional)
├── Question 7: Success criteria (optional)
├── Axis Generation
├── Position Mapping
└── Insight Presentation
```

### Maximum Questions

```typescript
interface OnboardingConfig {
  maxQuestions: 7;                // Hard limit
  requiredQuestions: 5;           // Minimum before axis generation
  
  questionTypes: [
    'SITUATION',                  // Current state
    'CHALLENGE',                  // What's difficult
    'STAKEHOLDERS',               // Who's involved
    'TENSIONS',                   // Where disagreements exist
    'PRIORITIES',                 // What matters most
    'CONSTRAINTS',                // What can't change
    'SUCCESS_CRITERIA',           // How you'll know it worked
  ];
  
  flow: {
    skipAllowed: true;            // After question 5
    backAllowed: true;            // Can revise answers
    saveProgress: true;           // Can resume later
  };
}
```

## E.3 AI-Led Dialog UI

### Conversation Interface

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  BUILDING YOUR FIRST DRD AXIS                                   │
│  Question 2 of 5-7                                              │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  AI THINKING PARTNER                                     │   │
│  │                                                          │   │
│  │  "What is the central challenge you're trying to solve?  │   │
│  │                                                          │   │
│  │   I'm asking because understanding the core challenge    │   │
│  │   helps identify which perspectives need to be gathered. │   │
│  │   Often, stakeholders frame the same challenge          │   │
│  │   differently — and those differences matter."           │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Your response:                                          │   │
│  │                                                          │   │
│  │  _                                                       │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│       [ ← Previous ]              [ Continue → ]                │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│  👁 You can see and edit your responses anytime.                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key UI Elements

| Element | Purpose |
|---------|---------|
| **Progress indicator** | "Question 2 of 5-7" — clear scope |
| **AI explanation** | "I'm asking because..." — transparency |
| **Edit access** | User can revise previous answers |
| **No rushing** | No "skip to results" button |

## E.4 AI Behavior in First Value

### AI Mode: THINKING_PARTNER

```typescript
interface AIThinkingPartnerConfig {
  mode: 'THINKING_PARTNER';
  
  allowed: [
    'ASK_CLARIFYING_QUESTION',    // Deepen understanding
    'EXPLAIN_WHY_ASKING',         // "I ask because..."
    'REFLECT_BACK',               // "So you're saying..."
    'SURFACE_TENSION',            // "I notice a tension between..."
    'PROPOSE_AXIS',               // "This suggests an axis around..."
  ];
  
  blocked: [
    'JUMP_TO_CONCLUSION',         // Never skip steps
    'SUMMARIZE_PREMATURELY',      // Wait until user is ready
    'SUGGEST_SOLUTION',           // Insight, not answers
    'EVALUATE_ANSWERS',           // Never judge input
  ];
  
  questionBehavior: {
    alwaysExplainPurpose: true;   // Every question has a "why"
    allowRefinement: true;        // User can push back
    adaptToResponses: true;       // Not scripted
  };
}
```

### Sample AI Responses

**Good:**
```
"You mentioned both cost reduction and innovation as priorities.
I notice these sometimes create tension — investment in innovation
often conflicts with short-term cost goals.

Is this tension something your organization experiences?
Understanding this helps map different stakeholder perspectives."
```

**Bad (blocked):**
```
"Based on your answers, you should focus on cost reduction first.
Here are three recommendations..."
```

## E.5 First Axis Generation

### Generation Process

```typescript
interface AxisGeneration {
  input: {
    onboardingResponses: Response[];
    organizationContext: OrgContext;
  };
  
  output: {
    suggestedAxis: {
      name: string;               // e.g., "Technology Investment Strategy"
      description: string;        // What this axis represents
      rationale: string;          // Why this emerged from conversation
    };
    
    suggestedPositions: [
      {
        label: string;            // e.g., "Conservative Approach"
        description: string;
        indicativeStakeholders: string[];
      },
      // 3-5 positions
    ];
    
    initialInsight: {
      observation: string;        // What the data suggests
      tension: string;            // Where disagreement likely exists
      question: string;           // What to explore next
    };
  };
}
```

### Presentation UI

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  YOUR FIRST DRD AXIS                                            │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  Based on our conversation, I've identified a key axis:         │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  TECHNOLOGY INVESTMENT STRATEGY                         │   │
│  │                                                          │   │
│  │  How your organization allocates resources between       │   │
│  │  maintaining current systems and investing in new        │   │
│  │  capabilities.                                           │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │                                                          │   │
│  │  [Conservative] ◄──────────────────────► [Aggressive]   │   │
│  │       ▲                                        ▲         │   │
│  │   Finance                                    Product     │   │
│  │   Ops team                                   Innovation  │   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  💡 INITIAL INSIGHT                                             │
│                                                                  │
│  "Your responses suggest tension between operational            │
│   efficiency (favored by Finance) and innovation speed          │
│   (favored by Product). This is common in growing               │
│   organizations — making it explicit enables better dialogue."  │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│      [ Refine this axis ]    [ Save and continue ]              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## E.6 Snapshot Generation

### Snapshot Structure

```typescript
interface DRDSnapshot {
  id: string;
  organizationId: string;
  createdAt: Date;
  version: number;
  
  content: {
    axis: {
      name: string;
      description: string;
      positions: Position[];
    };
    
    context: {
      situation: string;
      challenge: string;
      stakeholders: string[];
    };
    
    insights: [
      {
        observation: string;
        implication: string;
        suggestedAction: string;
      }
    ];
    
    metadata: {
      generatedBy: 'ONBOARDING_DIALOG';
      questionsAnswered: number;
      timeSpent: number;
    };
  };
  
  state: 'DRAFT' | 'SHARED' | 'ARCHIVED';
}
```

### Snapshot UI

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  DRD SNAPSHOT                                                   │
│  Your first decision map                                        │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  This snapshot captures:                                        │
│  • Your organization's context                                  │
│  • The axis you've defined                                      │
│  • Initial positions and tensions                               │
│  • First insights from the analysis                             │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  This is a starting point, not a conclusion.                    │
│  Snapshots are designed to evolve as you gather more            │
│  perspectives and refine your understanding.                    │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  What's next?                                                   │
│                                                                  │
│  • Invite team members to add their perspectives               │
│  • Create additional axes                                       │
│  • Discuss the tensions identified                              │
│                                                                  │
│      [ Share snapshot ]    [ Add another axis ]                 │
│                                                                  │
│                    [ Invite team ]                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## E.7 Quality Checklist

| Criterion | Pass Condition |
|-----------|---------------|
| Max 7 questions | ✓ |
| AI explains every question | ✓ |
| User can revise answers | ✓ |
| Insight is explicit | ✓ |
| Snapshot feels revisitable | ✓ |
| No premature summarization | ✓ |

---

# PHASE F: TEAM EXPANSION

## F.1 Strategic Intent

| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Organic MAU growth via decision complexity |
| **User Perception** | "This decision needs more perspectives" |
| **Success Metric** | Value increases without marketing |

## F.2 Natural Expansion Triggers

### System-Initiated Suggestions

```typescript
interface ExpansionTrigger {
  type: 'PERSPECTIVE_GAP' | 'DECISION_COMPLEXITY' | 'STAKEHOLDER_MENTION';
  
  triggers: {
    PERSPECTIVE_GAP: {
      condition: 'axis has < 3 distinct perspectives';
      message: "This axis would benefit from additional viewpoints.";
    };
    
    DECISION_COMPLEXITY: {
      condition: 'multiple axes intersect on same decision';
      message: "This decision spans multiple areas. Consider involving domain leads.";
    };
    
    STAKEHOLDER_MENTION: {
      condition: 'user mentions stakeholder not in system';
      message: "You referenced [Finance team]. Would their perspective help here?";
    };
  };
}
```

### Expansion Prompt UI

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  💡 MULTIPLE PERSPECTIVES RECOMMENDED                           │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  "This decision involves trade-offs between technology          │
│   investment and operational costs. Your current view           │
│   represents one perspective.                                   │
│                                                                  │
│   Decisions like this typically benefit from:                   │
│   • Finance perspective (cost implications)                     │
│   • Technical lead perspective (feasibility)                    │
│   • Operations perspective (implementation impact)              │
│                                                                  │
│   Gathering these perspectives now leads to better              │
│   dialogue later."                                              │
│                                                                  │
│      [ Invite team members ]    [ Continue solo ]               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## F.3 Invitation System

### Role-Based Invitations

```typescript
interface TeamInvitation {
  id: string;
  organizationId: string;
  invitedBy: string;
  
  target: {
    email: string;
    suggestedRole: TeamRole;       // Based on context
    reason: string;                // Why they're being invited
  };
  
  access: {
    type: 'FULL' | 'SPECIFIC_AXIS' | 'VIEWER';
    axes?: string[];               // If specific
  };
  
  expiration: Date;               // 14 days default
  
  metadata: {
    triggerContext: string;       // What prompted this invite
  };
}

type TeamRole =
  | 'ADMIN'                       // Full control
  | 'MEMBER'                      // Can contribute
  | 'VIEWER'                      // Read only
  | 'EXTERNAL_ADVISOR';           // Limited scope
```

### Invitation UI

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  INVITE TEAM MEMBER                                             │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  Who should contribute their perspective?                       │
│                                                                  │
│  Email:                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Their role in decisions:                                        │
│  ○ Team Member (can add positions, comment, discuss)            │
│  ○ Viewer (can see everything, cannot modify)                   │
│  ○ External Advisor (limited to specific axes)                  │
│                                                                  │
│  Why are you inviting them? (helps them understand context)     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  e.g., "I'd like your perspective on the technology     │   │
│  │  investment trade-offs, given your role in Finance."    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│                    [ Send Invitation ]                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## F.4 Team Collaboration Features

### Multi-Perspective View

```
┌─────────────────────────────────────────────────────────────────┐
│  TECHNOLOGY INVESTMENT AXIS                                     │
│  3 perspectives captured                                        │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  [Conservative] ◄──────────────────────────────► [Aggressive]   │
│                                                                  │
│          ●                           ●              ●           │
│       Finance                     Ops Lead       CTO            │
│       (Maria)                     (John)         (Sarah)        │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  🔔 TENSION DETECTED                                            │
│                                                                  │
│  "Finance and CTO have significantly different positions        │
│   on this axis. This suggests a potential alignment discussion  │
│   may be valuable before major investment decisions."           │
│                                                                  │
│      [ View all positions ]    [ Start discussion ]             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Comment & Discussion System

```typescript
interface Comment {
  id: string;
  authorId: string;
  targetType: 'AXIS' | 'POSITION' | 'INSIGHT' | 'SNAPSHOT';
  targetId: string;
  
  content: {
    text: string;
    mentions?: string[];          // @user references
    attachments?: Attachment[];
  };
  
  thread: {
    parentId?: string;            // If reply
    replies: Comment[];
  };
  
  metadata: {
    createdAt: Date;
    editedAt?: Date;
  };
}
```

### Discussion UI

```
┌─────────────────────────────────────────────────────────────────┐
│  DISCUSSION: Technology Investment Axis                        │
│  3 comments                                                     │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  MARIA (Finance) — 2 hours ago                                  │
│  "I positioned conservative because our Q1 cash flow           │
│   projections don't support the proposed new platform           │
│   investment. Happy to discuss alternatives."                   │
│        [ Reply ]                                                │
│                                                                  │
│  └─ SARAH (CTO) — 1 hour ago                                    │
│     "I understand the cash flow concern. The aggressive        │
│      position is based on technical debt risk — if we don't    │
│      invest now, maintenance costs will increase 40% by Q3."   │
│          [ Reply ]                                              │
│                                                                  │
│  └─ JOHN (Ops) — 30 minutes ago                                 │
│     "Is there a middle path? Phased investment that addresses  │
│      the critical technical debt while respecting cash flow?"  │
│          [ Reply ]                                              │
│                                                                  │
│  ───────────────────────────────────────────────────────────    │
│  Add comment:                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                                                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                               [ Post ]                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## F.5 AI Behavior in Team Mode

### AI Mode: FACILITATOR

```typescript
interface AIFacilitatorConfig {
  mode: 'FACILITATOR';
  
  allowed: [
    'SURFACE_DIFFERENCES',        // "I notice a gap between..."
    'IDENTIFY_PATTERNS',          // "Three perspectives share..."
    'SYNTHESIZE_VIEWS',           // "Common ground appears to be..."
    'SUGGEST_DISCUSSION_POINTS',  // "This might be worth discussing..."
    'SUMMARIZE_THREAD',           // "The conversation suggests..."
  ];
  
  blocked: [
    'TAKE_SIDES',                 // Never favor one perspective
    'RESOLVE_CONFLICT',           // Never declare a winner
    'DISMISS_POSITION',           // Never minimize any view
    'RECOMMEND_ACTION',           // Never tell what to do
  ];
  
  synthesis: {
    frequency: 'ON_REQUEST';      // Not automatic
    format: 'NEUTRAL_SUMMARY';    // Just facts
  };
}
```

### AI Facilitation UI

```
┌─────────────────────────────────────────────────────────────────┐
│  AI FACILITATOR                                                 │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  "Looking at the three positions on this axis:                  │
│                                                                  │
│   Similarities:                                                  │
│   • All acknowledge technical debt is a real concern            │
│   • All agree investment is necessary at some point             │
│                                                                  │
│   Differences:                                                   │
│   • Timing: Finance prefers Q3, CTO prefers immediate          │
│   • Scope: Finance suggests targeted, CTO suggests platform     │
│                                                                  │
│   Potential discussion points:                                   │
│   • What's the cost of waiting until Q3?                        │
│   • Is phased investment feasible?                               │
│   • What triggers would change each position?                   │
│                                                                  │
│   I'm not suggesting which position is right.                   │
│   The value is in having this conversation explicitly."         │
│                                                                  │
│      [ Request updated synthesis ]    [ Close ]                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## F.6 Activity Notifications

### Notification System

```typescript
interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  
  content: {
    title: string;
    body: string;
    actionUrl: string;
  };
  
  channels: ('IN_APP' | 'EMAIL')[];
  
  state: 'UNREAD' | 'READ' | 'DISMISSED';
  
  createdAt: Date;
}

type NotificationType =
  | 'NEW_TEAM_MEMBER'             // Someone joined
  | 'NEW_POSITION'                // Someone added a position
  | 'NEW_COMMENT'                 // Someone commented
  | 'MENTION'                     // You were @mentioned
  | 'TENSION_DETECTED'            // AI surfaced disagreement
  | 'INVITATION_ACCEPTED';        // Your invite was accepted
```

### Notification Examples

**In-App:**
```
┌─────────────────────────────────────────────────────────────────┐
│  🔔 NOTIFICATIONS                                               │
│  ───────────────────────────────────────────────────────────    │
│                                                                  │
│  ● Maria added a position on "Technology Investment"           │
│    2 hours ago                                                  │
│                                                                  │
│  ● Sarah commented on your position                             │
│    "I see your point about cash flow..."                        │
│    1 hour ago                                                   │
│                                                                  │
│  ● John accepted your invitation                                │
│    30 minutes ago                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Email (Weekly Digest):**
```
Subject: Week in [Organization Name] — 3 new perspectives

This week in your organization's decision space:

• 3 new positions added to Technology Investment axis
• 2 team discussions active
• AI detected 1 new tension pattern

[View activity →]
```

## F.7 Quality Checklist

| Criterion | Pass Condition |
|-----------|---------------|
| Expansion triggered by context, not promotion | ✓ |
| Invitations explain why | ✓ |
| AI never takes sides | ✓ |
| Differences surfaced, not hidden | ✓ |
| Notifications are informative, not urgent | ✓ |
| Value grows with perspectives | ✓ |

---

# CROSS-CUTTING REQUIREMENTS

## Security & Compliance

### Enterprise Security

```typescript
interface SecurityRequirements {
  authentication: {
    sso: 'SAML2' | 'OIDC';        // Enterprise SSO support
    mfa: 'REQUIRED_ENTERPRISE';   // MFA for enterprise tier
    sessionDuration: '8h';        // Auto-logout
  };
  
  authorization: {
    rbac: true;                   // Role-based access control
    orgIsolation: 'STRICT';       // No cross-org data leakage
    auditLog: 'IMMUTABLE';        // All actions logged
  };
  
  data: {
    encryption: {
      atRest: 'AES-256';
      inTransit: 'TLS-1.3';
    };
    residency: 'CONFIGURABLE';    // EU, US, etc.
    retention: 'CONFIGURABLE';    // org-defined
  };
  
  compliance: {
    soc2: true;
    gdpr: true;
    iso27001: 'PLANNED';
  };
}
```

### Audit Log Structure

```typescript
interface AuditEvent {
  id: string;
  timestamp: Date;
  
  actor: {
    userId: string;
    role: string;
    ip: string;
    userAgent: string;
  };
  
  action: {
    type: string;                 // e.g., 'POSITION_CREATED'
    resource: string;             // e.g., 'axis:123'
    organizationId: string;
  };
  
  context: {
    before?: object;              // State before action
    after?: object;               // State after action
    metadata: object;             // Additional context
  };
  
  // Immutable, append-only
}
```

## Performance Requirements

| Metric | Target | Measurement |
|--------|--------|-------------|
| Page load | < 2s | P95 |
| AI response | < 3s | P95 |
| API response | < 500ms | P95 |
| Uptime | 99.9% | Monthly |
| Data backup | 4h RPO | RTO < 1h |

## Accessibility

| Requirement | Standard |
|-------------|----------|
| WCAG | 2.1 AA |
| Keyboard navigation | Full |
| Screen reader | Tested |
| Color contrast | 4.5:1 minimum |
| Focus indicators | Visible |

---

# IMPLEMENTATION PRIORITY

## Phase 1: Foundation (Weeks 1-4)
- [ ] Phase A: Landing page
- [ ] Phase B: Demo environment
- [ ] Authentication system
- [ ] Basic AI modes (NARRATOR, GUIDE)

## Phase 2: Core Experience (Weeks 5-8)
- [ ] Phase C: Trial system
- [ ] Phase D: Organization setup
- [ ] Access code system
- [ ] Memory activation

## Phase 3: Value Delivery (Weeks 9-12)
- [ ] Phase E: Onboarding dialog
- [ ] AI THINKING_PARTNER mode
- [ ] Axis generation
- [ ] Snapshot system

## Phase 4: Growth (Weeks 13-16)
- [ ] Phase F: Team invitations
- [ ] Collaboration features
- [ ] AI FACILITATOR mode
- [ ] Notification system

---

# APPENDIX: LANGUAGE GUIDELINES

## Tone of Voice

| ✅ Use | ❌ Avoid |
|--------|---------|
| "Your organization" | "Your account" |
| "Decision space" | "Dashboard" |
| "Perspective" | "Opinion" |
| "Explore" | "Unlock" |
| "Continue" | "Get started" |
| "Multiple perspectives" | "Team collaboration" |
| "Insight" | "AI magic" |

## Error Messages

| ❌ Generic | ✅ Human |
|------------|---------|
| "Error 403" | "You don't have access to this organization" |
| "Invalid input" | "Please enter a valid email address" |
| "Rate limited" | "Please wait a moment before trying again" |
| "Session expired" | "Your session ended. Please sign in again." |

---

# DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2024-12-21 | Consultify Team | Initial specification |

---

> **This document is the canonical source of truth for Consultify implementation.**  
> All development must align with this specification.  
> Deviations require explicit approval and documentation update.
