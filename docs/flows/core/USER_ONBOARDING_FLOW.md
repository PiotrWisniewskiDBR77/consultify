# FLOW-ONBOARDING-001: User Onboarding

> **ID:** FLOW-ONBOARDING-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Prowadzenie nowych użytkowników przez pierwsze kroki w aplikacji. Gamifikacja i checklist.

## Onboarding Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                      ONBOARDING JOURNEY                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  STEP 1: WELCOME                                    ✓ Complete ││
│  │  ────────────────────────────────────────────────────────────  ││
│  │  • Welcome email sent                                          ││
│  │  • First login completed                                       ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  STEP 2: PROFILE SETUP                              ✓ Complete ││
│  │  ────────────────────────────────────────────────────────────  ││
│  │  • Profile photo uploaded                                      ││
│  │  • Language preferences set                                    ││
│  │  • Notification preferences configured                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  STEP 3: ORGANIZATION CONTEXT                       → Current  ││
│  │  ────────────────────────────────────────────────────────────  ││
│  │  • Company information filled                                  ││
│  │  • Industry selected                                           ││
│  │  • Team size defined                                           ││
│  │  [Continue →]                                                  ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  STEP 4: FIRST PROJECT                              ○ Pending  ││
│  │  ────────────────────────────────────────────────────────────  ││
│  │  • Create your first project                                   ││
│  │  • Or explore Sandbox                                          ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  STEP 5: FIRST ASSESSMENT                           ○ Pending  ││
│  │  ────────────────────────────────────────────────────────────  ││
│  │  • Start DRD Assessment (recommended)                          ││
│  │  • Or try Lean 4.0                                             ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  STEP 6: TEAM INVITATION                            ○ Optional ││
│  │  ────────────────────────────────────────────────────────────  ││
│  │  • Invite team members                                         ││
│  │  • Assign roles                                                ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  Progress: ████████░░░░░░░░░░░░ 40%                                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Steps Definition

### Step 1: Welcome

| Action            | Required | Trigger                 |
| ----------------- | -------- | ----------------------- |
| Email verified    | Yes      | Click verification link |
| First login       | Yes      | Login to app            |
| Watch intro video | No       | Play video              |

### Step 2: Profile Setup

| Action                  | Required | Trigger         |
| ----------------------- | -------- | --------------- |
| Set name                | Yes      | Save profile    |
| Upload photo            | No       | Upload file     |
| Set language            | Yes      | Select language |
| Set timezone            | No       | Select timezone |
| Configure notifications | No       | Save settings   |

### Step 3: Organization Context

| Action            | Required | Trigger           |
| ----------------- | -------- | ----------------- |
| Company name      | Yes      | Save org settings |
| Industry          | Yes      | Select from list  |
| Company size      | Yes      | Select range      |
| Strategic context | No       | Fill description  |

### Step 4: First Project

| Action                          | Required | Trigger         |
| ------------------------------- | -------- | --------------- |
| Create project OR visit sandbox | Yes      | Project created |

### Step 5: First Assessment

| Action               | Required | Trigger              |
| -------------------- | -------- | -------------------- |
| Start any assessment | Yes      | Assessment created   |
| Answer 5+ questions  | Bonus    | Progress > 20%       |
| Complete assessment  | Bonus    | Assessment completed |

### Step 6: Team (Optional)

| Action               | Required | Trigger          |
| -------------------- | -------- | ---------------- |
| Invite 1 team member | No       | Invitation sent  |
| Member joins         | Bonus    | Member activated |

## Gamification

### Achievements

| Achievement            | Condition            | Points |
| ---------------------- | -------------------- | ------ |
| 🎉 First Steps         | Complete step 1      | 10     |
| 📸 Looking Good        | Upload profile photo | 5      |
| 🏢 Company Ready       | Complete org context | 20     |
| 🚀 Project Started     | Create first project | 25     |
| 📊 Assessment Pro      | Complete assessment  | 50     |
| 👥 Team Builder        | Invite team member   | 15     |
| ⭐ Onboarding Complete | All required steps   | 100    |

### Progress Tracking

```typescript
interface OnboardingProgress {
  userId: string;
  organizationId: string;

  // Step completion
  steps: {
    stepId: string;
    status: 'pending' | 'in_progress' | 'completed' | 'skipped';
    completedAt?: string;
    skippedAt?: string;
  }[];

  // Gamification
  points: number;
  achievements: string[];

  // Overall
  completionPercentage: number;
  isOnboardingComplete: boolean;

  startedAt: string;
  completedAt?: string;
}
```

## UI Components

### Onboarding Checklist (Sidebar)

```
┌─────────────────────────────┐
│  🚀 Getting Started         │
│  ─────────────────────────  │
│  ✓ Welcome                  │
│  ✓ Profile setup            │
│  → Organization context     │
│  ○ First project            │
│  ○ First assessment         │
│  ○ Invite team              │
│                             │
│  [40% complete]             │
│  [Hide for now]             │
└─────────────────────────────┘
```

### Step Modal

```
┌──────────────────────────────────────────────┐
│  🏢 Set Up Your Organization                 │
│  ──────────────────────────────────────────  │
│                                              │
│  This helps AI understand your context       │
│  and provide better recommendations.         │
│                                              │
│  Company Name: [___________________]         │
│                                              │
│  Industry:     [Select industry    ▼]        │
│                                              │
│  Company Size: [○ 1-10  ○ 11-50  ○ 51-200   │
│                 ○ 201-500  ○ 500+]          │
│                                              │
│  [Skip for now]           [Continue →]       │
│                                              │
└──────────────────────────────────────────────┘
```

## Tooltips & Guided Tours

First-time users see contextual tooltips:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  [Dashboard]  [Projects ▼]  [Assessments ▼]  [MyWork]  [Tools ▼]    │
│                    │                                                 │
│               ┌────┴─────────────────────────────┐                  │
│               │ 💡 Projects                       │                  │
│               │ ────────────────────────────────  │                  │
│               │ Create projects to organize your  │                  │
│               │ transformation initiatives.       │                  │
│               │                                   │                  │
│               │ [Got it]  [1/5 →]                │                  │
│               └──────────────────────────────────┘                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
-- Onboarding steps definition
CREATE TABLE IF NOT EXISTS onboarding_steps (
    id TEXT PRIMARY KEY,
    step_order INTEGER NOT NULL,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    is_required INTEGER DEFAULT 1,
    points INTEGER DEFAULT 10,
    trigger_action TEXT, -- What completes this step
    help_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User onboarding progress (enhanced from migration 244)
CREATE TABLE IF NOT EXISTS user_onboarding (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Steps progress
    steps_progress TEXT DEFAULT '{}', -- JSON: {stepId: {status, completedAt, skippedAt}}

    -- Gamification
    points INTEGER DEFAULT 0,
    achievements TEXT DEFAULT '[]', -- JSON array of achievement IDs

    -- Overall
    completion_percentage INTEGER DEFAULT 0,
    is_complete INTEGER DEFAULT 0,

    -- UI state
    show_checklist INTEGER DEFAULT 1,
    dismissed_until TIMESTAMP, -- Hide temporarily

    -- Timestamps
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    last_step_at TIMESTAMP,

    UNIQUE(user_id)
);

-- Onboarding achievements
CREATE TABLE IF NOT EXISTS onboarding_achievements (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    description TEXT,
    icon TEXT,
    points INTEGER DEFAULT 10,
    condition_type TEXT NOT NULL, -- 'step_complete', 'points_reached', 'all_complete'
    condition_value TEXT, -- Step ID or points threshold
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tooltips configuration
CREATE TABLE IF NOT EXISTS onboarding_tooltips (
    id TEXT PRIMARY KEY,
    target_element TEXT NOT NULL, -- CSS selector
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    position TEXT DEFAULT 'bottom', -- 'top', 'bottom', 'left', 'right'
    order_index INTEGER NOT NULL,
    page_path TEXT, -- Which page this appears on
    show_once INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User tooltip dismissals
CREATE TABLE IF NOT EXISTS user_tooltips_seen (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tooltip_id TEXT NOT NULL,
    seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tooltip_id)
);
```

## API Endpoints

| Method | Endpoint                                | Description                    |
| ------ | --------------------------------------- | ------------------------------ |
| GET    | `/api/onboarding/progress`              | Get user's onboarding progress |
| POST   | `/api/onboarding/step/:stepId/complete` | Mark step as complete          |
| POST   | `/api/onboarding/step/:stepId/skip`     | Skip step                      |
| POST   | `/api/onboarding/dismiss`               | Hide checklist temporarily     |
| GET    | `/api/onboarding/achievements`          | Get available achievements     |
| GET    | `/api/onboarding/tooltips`              | Get tooltips for current page  |
| POST   | `/api/onboarding/tooltips/:id/seen`     | Mark tooltip as seen           |

## Triggers Integration

Onboarding steps are automatically triggered by actions:

```typescript
// In various services, trigger onboarding completion
import onboardingService from './onboardingService';

// When user completes profile
await onboardingService.triggerStepCompletion(userId, 'profile_setup');

// When user creates first project
await onboardingService.triggerStepCompletion(userId, 'first_project');

// When user starts assessment
await onboardingService.triggerStepCompletion(userId, 'first_assessment');
```

## Related Flows

- FLOW-AUTH-001: Registration triggers onboarding start
- FLOW-HELP-001: Help content linked from onboarding
- FLOW-PROJECT-001: First project step
- FLOW-ASSESSMENT-001: First assessment step
