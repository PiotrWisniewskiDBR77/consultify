# FLOW-AILEARNING-001: AI Learning System

> **ID:** FLOW-AILEARNING-001 | **Status:** ✅ Complete | **Priority:** P0

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

System uczenia się AI - fundamentalne dla sukcesu Consultinity. AI musi się ciągle doskonalić.

## Learning Sources

```
┌──────────────────────────────────────────────────────────────────────┐
│                      AI LEARNING SOURCES                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  1. USER FEEDBACK                                              │ │
│  │     ├── Like/Dislike responses                                 │ │
│  │     ├── Corrections ("AI said X, correct is Y")                │ │
│  │     ├── Suggestions ("Would be better if...")                  │ │
│  │     └── Ratings (1-5 stars)                                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  2. OPERATOR FEEDBACK (Admin/Owner)                            │ │
│  │     ├── Custom instructions for organization                   │ │
│  │     ├── Terminology definitions                                │ │
│  │     ├── Process corrections                                    │ │
│  │     └── Quality assessments                                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  3. SUPERADMIN FEEDBACK                                        │ │
│  │     ├── System-wide instruction updates                        │ │
│  │     ├── Best practices from successful orgs                    │ │
│  │     ├── Pattern recognition from aggregated data               │ │
│  │     └── Quality baseline improvements                          │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  4. SYSTEM OBSERVATIONS                                        │ │
│  │     ├── Decision patterns (what's approved/rejected)           │ │
│  │     ├── Usage patterns (what's used/ignored)                   │ │
│  │     ├── Success metrics (initiatives that succeed)             │ │
│  │     └── Error patterns (what goes wrong)                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Feedback Loop Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FEEDBACK PROCESSING LOOP                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   ┌────────────┐    ┌──────────────┐    ┌───────────────┐          │
│   │  Collect   │───►│   Analyze    │───►│   Generate    │          │
│   │  Feedback  │    │   Patterns   │    │  Instruction  │          │
│   └────────────┘    └──────────────┘    └───────┬───────┘          │
│         ▲                                        │                  │
│         │                                        ▼                  │
│   ┌─────┴──────┐                        ┌───────────────┐          │
│   │  Monitor   │◄───────────────────────│    Apply      │          │
│   │  Quality   │                        │  Instruction  │          │
│   └────────────┘                        └───────────────┘          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Instruction Management

### System Instructions (SuperAdmin)

```typescript
interface SystemInstruction {
  id: string;
  category: 'general' | 'assessment' | 'initiative' | 'reporting' | 'consulting' | 'decision';
  name: string;
  instruction: string;
  priority: number; // Higher = more important
  isActive: boolean;
  createdBy: string; // SuperAdmin ID
  createdAt: string;
  updatedAt: string;

  // Effectiveness tracking
  usageCount: number;
  positiveRatingCount: number;
  negativeRatingCount: number;
  effectivenessScore: number; // Calculated
}
```

### Organization Instructions (Admin)

```typescript
interface OrgInstruction {
  id: string;
  organizationId: string;
  category: string;
  name: string;
  instruction: string;
  priority: number;
  isActive: boolean;
  createdBy: string; // Admin ID

  // Context
  appliesTo: 'all' | 'project' | 'assessment' | 'chat';
  projectIds?: string[]; // If applies to specific projects

  // Effectiveness
  lastReviewedAt: string;
  reviewedBy: string;
}
```

## Feedback Types

### 1. Response Rating

```typescript
interface ResponseRating {
  messageId: string;
  conversationId: string;
  userId: string;
  rating: 'like' | 'dislike';
  comment?: string;
}
```

### 2. Correction

```typescript
interface Correction {
  messageId: string;
  userId: string;
  aiResponse: string; // What AI said
  correctResponse: string; // What it should have said
  category: string; // 'factual', 'tone', 'recommendation', 'process'
}
```

### 3. Suggestion

```typescript
interface Suggestion {
  userId: string;
  context: string; // Where the suggestion came from
  suggestion: string;
  category: string;
  priority: 'low' | 'medium' | 'high';
}
```

## Pattern Learning

### Decision Patterns

AI learns from decisions made in the system:

```typescript
interface DecisionLearning {
  decisionType: string;
  context: {
    projectType: string;
    initiativeCategory: string;
    teamSize: number;
    budgetRange: string;
  };
  outcome: string;
  timeToDecision: number;
  wasSuccessful: boolean; // Based on later initiative success
}
```

### Initiative Success Patterns

```typescript
interface InitiativePattern {
  frameworkSource: string; // Assessment framework
  dimensionGap: number;
  initiativeType: string;
  estimatedEffort: string;
  actualEffort: string;
  wasSuccessful: boolean;
  successFactors: string[];
  failureFactors: string[];
}
```

## Database Schema

### ai_feedback (exists from migration 245)

```sql
id TEXT PRIMARY KEY
organization_id TEXT
user_id TEXT NOT NULL
conversation_id TEXT
message_id TEXT
feedback_type TEXT NOT NULL -- 'like', 'dislike', 'correction', 'suggestion'
rating INTEGER
comment TEXT
correction TEXT
ai_response_snippet TEXT
context_type TEXT
reviewed_by TEXT
reviewed_at TIMESTAMP
action_taken TEXT
```

### ai_learning_patterns

```sql
id TEXT PRIMARY KEY
pattern_type TEXT NOT NULL -- 'decision', 'initiative', 'assessment', 'usage'
pattern_data TEXT NOT NULL -- JSON
occurrence_count INTEGER DEFAULT 1
success_count INTEGER DEFAULT 0
failure_count INTEGER DEFAULT 0
confidence_score REAL
last_occurrence_at TIMESTAMP
created_at TIMESTAMP
updated_at TIMESTAMP
```

### ai_instruction_effectiveness

```sql
id TEXT PRIMARY KEY
instruction_id TEXT NOT NULL
instruction_type TEXT NOT NULL -- 'system' or 'org'
usage_count INTEGER DEFAULT 0
positive_feedback_count INTEGER DEFAULT 0
negative_feedback_count INTEGER DEFAULT 0
correction_count INTEGER DEFAULT 0
effectiveness_score REAL
last_calculated_at TIMESTAMP
```

## Sequence Diagram: Feedback Processing

```
┌──────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐   ┌────────────┐
│ User │   │ Feedback │   │ Analysis  │   │ Learning │   │Instruction │
│      │   │   API    │   │  Service  │   │  Store   │   │   Store    │
└──┬───┘   └────┬─────┘   └─────┬─────┘   └────┬─────┘   └─────┬──────┘
   │            │               │              │               │
   │ Submit     │               │              │               │
   │ Feedback   │               │              │               │
   │───────────►│ Store         │              │               │
   │            │──────────────────────────────►               │
   │            │               │              │               │
   │            │ Analyze       │              │               │
   │            │──────────────►│              │               │
   │            │               │ Extract      │               │
   │            │               │ Pattern      │               │
   │            │               │──────────────►               │
   │            │               │              │               │
   │            │               │ Check if     │               │
   │            │               │ new pattern  │               │
   │            │               │◄─────────────│               │
   │            │               │              │               │
   │            │               │ If threshold │               │
   │            │               │ met, suggest │               │
   │            │               │ instruction  │               │
   │            │               │──────────────────────────────►
   │            │               │              │               │
   │◄───────────│               │              │               │
   │ Thank you  │               │              │               │
```

## Quality Metrics

### AI Response Quality Score

```typescript
interface QualityMetrics {
  overallScore: number; // 0-100

  components: {
    accuracy: number; // Based on corrections
    helpfulness: number; // Based on ratings
    relevance: number; // Based on usage after response
    tone: number; // Based on feedback comments
  };

  trend: 'improving' | 'stable' | 'declining';
  lastUpdated: string;
}
```

### Instruction Effectiveness

```typescript
interface InstructionEffectiveness {
  instructionId: string;
  effectivenessScore: number; // 0-100

  metrics: {
    usageCount: number;
    positiveRatio: number;
    correctionRate: number;
  };

  recommendation: 'keep' | 'review' | 'remove';
}
```

## SuperAdmin Dashboard

### Learning Insights View

```
┌─────────────────────────────────────────────────────────────────────┐
│                    AI LEARNING DASHBOARD                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  QUALITY METRICS                           FEEDBACK SUMMARY         │
│  ┌────────────────────────┐               ┌────────────────────┐   │
│  │ Overall Score: 85/100  │               │ Today: 45 feedbacks│   │
│  │ Accuracy: 88%          │               │ This week: 312     │   │
│  │ Helpfulness: 82%       │               │ Pending review: 23 │   │
│  │ Trend: ↑ Improving     │               └────────────────────┘   │
│  └────────────────────────┘                                         │
│                                                                     │
│  TOP PATTERNS LEARNED                      INSTRUCTIONS NEEDING     │
│  ┌────────────────────────┐               REVIEW                   │
│  │ 1. Decision approval   │               ┌────────────────────┐   │
│  │    for budget >100k    │               │ • Assessment help  │   │
│  │ 2. Initiative success  │               │   Score: 65 (-12)  │   │
│  │    factors for Lean    │               │ • Report format    │   │
│  │ 3. Assessment scoring  │               │   Score: 71 (-8)   │   │
│  │    preferences         │               └────────────────────┘   │
│  └────────────────────────┘                                         │
│                                                                     │
│  RECENT CORRECTIONS                        SUGGESTED INSTRUCTIONS   │
│  ┌────────────────────────┐               ┌────────────────────┐   │
│  │ • "DRD" not "Digital   │               │ Based on patterns: │   │
│  │   Readiness" (5x)      │               │ "When discussing   │   │
│  │ • Cost format EUR not  │               │  Lean 4.0, always  │   │
│  │   USD (3x)             │               │  mention 5S first" │   │
│  └────────────────────────┘               │ [Add] [Dismiss]    │   │
│                                           └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Method | Endpoint                             | Description                  |
| ------ | ------------------------------------ | ---------------------------- |
| POST   | `/api/ai/feedback`                   | Submit feedback              |
| GET    | `/api/ai/feedback/pending`           | Get pending feedback (Admin) |
| POST   | `/api/ai/feedback/:id/review`        | Review feedback (Admin)      |
| GET    | `/api/ai/learning/patterns`          | Get learned patterns         |
| GET    | `/api/ai/learning/metrics`           | Get quality metrics          |
| GET    | `/api/ai/learning/suggestions`       | Get instruction suggestions  |
| POST   | `/api/ai/instructions/system`        | Create system instruction    |
| PUT    | `/api/ai/instructions/system/:id`    | Update system instruction    |
| POST   | `/api/ai/instructions/org`           | Create org instruction       |
| PUT    | `/api/ai/instructions/org/:id`       | Update org instruction       |
| GET    | `/api/ai/instructions/effectiveness` | Get effectiveness scores     |

## Cron Jobs

| Job                | Schedule      | Purpose                             |
| ------------------ | ------------- | ----------------------------------- |
| Pattern Analysis   | Daily 3:00 AM | Analyze new feedback patterns       |
| Effectiveness Calc | Daily 4:00 AM | Calculate instruction effectiveness |
| Quality Metrics    | Hourly        | Update quality metrics              |
| Suggestion Gen     | Weekly        | Generate instruction suggestions    |

## Related Flows

- FLOW-AI-001: Main AI chat system
- FLOW-DECISION-001: Decision patterns learning
- FLOW-ASSESSMENT-001: Assessment guidance learning
