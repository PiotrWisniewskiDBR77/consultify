# FLOW-HELP-001: Help & Education

> **ID:** FLOW-HELP-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

System pomocy i edukacji - użytkownicy muszą mieć dostęp do wiedzy podczas pracy.

## Help System Components

```
┌──────────────────────────────────────────────────────────────────────┐
│                      HELP & EDUCATION SYSTEM                        │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  1. HELP CENTER                                                 ││
│  │     • Articles & Guides                                         ││
│  │     • Video Tutorials                                           ││
│  │     • FAQ                                                       ││
│  │     • Search                                                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  2. CONTEXTUAL HELP                                             ││
│  │     • Tooltips (can be hidden 15/30/60 days)                    ││
│  │     • Help Buttons (?) per module                               ││
│  │     • Guided Tours                                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  3. AI HELP CHAT                                                ││
│  │     • Context-aware assistance                                  ││
│  │     • Can reference help articles                               ││
│  │     • Escalation to human support                               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  4. KNOWLEDGE BASE                                              ││
│  │     • Tool-specific documentation                               ││
│  │     • Best practices                                            ││
│  │     • Case studies                                              ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  5. TICKET SYSTEM                                               ││
│  │     • Create support ticket                                     ││
│  │     • Track ticket status                                       ││
│  │     • Chat with support                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Help Button (?)

Every module/view has a help button:

```
┌───────────────────────────────────────────────────────────────────┐
│  Initiatives    [+ New Initiative]    [Filter ▼]    [?]           │
│  ─────────────────────────────────────────────────────────────────│
│  ...                                                              │
│                                                                   │
│                         ┌─────────────────────────────────────┐   │
│                         │ ? Help: Initiatives                 │   │
│                         │ ─────────────────────────────────── │   │
│                         │ Initiatives are the building blocks │   │
│                         │ of your transformation roadmap.     │   │
│                         │                                     │   │
│                         │ 📺 Watch Tutorial (3 min)           │   │
│                         │ 📖 Read Documentation               │   │
│                         │ 💬 Ask AI Assistant                 │   │
│                         │                                     │   │
│                         │ [Don't show for 30 days]            │   │
│                         └─────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────┘
```

## Tooltip Dismissal

Tooltips can be hidden for configurable periods:

```typescript
interface TooltipDismissal {
  tooltipId: string;
  userId: string;
  dismissedAt: string;
  dismissDuration: '15_days' | '30_days' | '60_days' | 'forever';
  showAgainAt?: string;
}
```

## Help Center Structure

```
Help Center
├── Getting Started
│   ├── Quick Start Guide
│   ├── First Project Setup
│   └── Understanding Your Dashboard
├── Assessments
│   ├── DRD Assessment Guide
│   ├── SIRI Assessment Guide
│   ├── How to Interpret Results
│   └── Generating Initiatives from Results
├── Projects & Initiatives
│   ├── Creating Projects
│   ├── Managing Initiatives
│   ├── Task Management
│   └── Decision Workflow
├── Tools
│   ├── Process Flow Automation
│   ├── A3 + PDCA
│   └── AI Adviser
├── Reports
│   ├── Generating Reports
│   ├── Exporting & Sharing
│   └── Public Links
├── AI Features
│   ├── AI Assistant Guide
│   ├── AI Actions & Autonomy
│   └── Providing Feedback to AI
├── Settings & Admin
│   ├── Organization Settings
│   ├── Team Management
│   └── Billing & Plans
└── FAQ
    ├── General Questions
    ├── Billing Questions
    └── Technical Issues
```

## Video Tutorials

For each module, there will be video tutorials:

| Module      | Video                          | Duration |
| ----------- | ------------------------------ | -------- |
| Overview    | Platform Introduction          | 5 min    |
| Assessments | Running Your First Assessment  | 8 min    |
| Initiatives | From Assessment to Initiatives | 6 min    |
| Projects    | Project Management Basics      | 5 min    |
| Tools       | Process Flow Automation        | 10 min   |
| Tools       | A3 Problem Solving             | 7 min    |
| Reports     | Creating & Sharing Reports     | 4 min    |
| AI          | Getting the Most from AI       | 6 min    |

## Database Schema

```sql
-- Help articles
CREATE TABLE IF NOT EXISTS help_articles (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    subcategory TEXT,
    title TEXT NOT NULL,
    title_translations TEXT, -- JSON for i18n
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL, -- Markdown
    content_translations TEXT, -- JSON for i18n
    excerpt TEXT,
    video_url TEXT,
    video_duration_seconds INTEGER,
    related_module TEXT, -- Which module this helps with
    tags TEXT, -- JSON array
    sort_order INTEGER DEFAULT 0,
    is_published INTEGER DEFAULT 1,
    view_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Module help content (for ? button)
CREATE TABLE IF NOT EXISTS module_help (
    id TEXT PRIMARY KEY,
    module_key TEXT NOT NULL UNIQUE, -- e.g., 'initiatives', 'assessments.drd'
    title TEXT NOT NULL,
    title_translations TEXT,
    short_description TEXT NOT NULL,
    short_description_translations TEXT,
    video_url TEXT,
    article_id TEXT, -- Link to full article
    tips TEXT, -- JSON array of quick tips
    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (article_id) REFERENCES help_articles(id)
);

-- User help interactions
CREATE TABLE IF NOT EXISTS user_help_interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    interaction_type TEXT NOT NULL, -- 'article_view', 'video_watch', 'tooltip_dismiss', 'feedback'
    target_id TEXT, -- Article ID, video ID, tooltip ID
    target_type TEXT, -- 'article', 'video', 'tooltip', 'module_help'
    feedback_value INTEGER, -- 1 for helpful, -1 for not helpful
    duration_seconds INTEGER, -- Time spent
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tooltip dismissals
CREATE TABLE IF NOT EXISTS tooltip_dismissals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    tooltip_id TEXT NOT NULL,
    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dismiss_duration TEXT NOT NULL, -- '15_days', '30_days', '60_days', 'forever'
    show_again_at TIMESTAMP,
    UNIQUE(user_id, tooltip_id)
);

-- Support tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    user_id TEXT NOT NULL,

    -- Ticket details
    subject TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'general', -- 'general', 'billing', 'technical', 'feature_request'
    priority TEXT DEFAULT 'medium', -- 'low', 'medium', 'high', 'urgent'

    -- Status
    status TEXT DEFAULT 'open', -- 'open', 'in_progress', 'waiting_customer', 'resolved', 'closed'

    -- Assignment
    assigned_to TEXT,
    assigned_at TIMESTAMP,

    -- Resolution
    resolution TEXT,
    resolved_at TIMESTAMP,
    resolved_by TEXT,

    -- Feedback
    satisfaction_rating INTEGER, -- 1-5
    feedback_comment TEXT,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    first_response_at TIMESTAMP,
    last_activity_at TIMESTAMP
);

-- Ticket messages
CREATE TABLE IF NOT EXISTS ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    sender_type TEXT NOT NULL, -- 'user', 'support', 'system'
    sender_id TEXT,
    message TEXT NOT NULL,
    attachments TEXT, -- JSON array of file IDs
    is_internal INTEGER DEFAULT 0, -- Internal notes for support team
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_help_articles_category ON help_articles(category);
CREATE INDEX IF NOT EXISTS idx_help_articles_module ON help_articles(related_module);
CREATE INDEX IF NOT EXISTS idx_help_interactions_user ON user_help_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_tooltip_dismissals_user ON tooltip_dismissals(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_org ON support_tickets(organization_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
```

## API Endpoints

### Help Center

| Method | Endpoint                          | Description                  |
| ------ | --------------------------------- | ---------------------------- |
| GET    | `/api/help/articles`              | List articles (with filters) |
| GET    | `/api/help/articles/:slug`        | Get article by slug          |
| GET    | `/api/help/search`                | Search help content          |
| GET    | `/api/help/module/:moduleKey`     | Get module help              |
| POST   | `/api/help/articles/:id/feedback` | Submit helpful/not helpful   |

### Tooltips

| Method | Endpoint                        | Description                   |
| ------ | ------------------------------- | ----------------------------- |
| POST   | `/api/help/tooltip/:id/dismiss` | Dismiss tooltip               |
| GET    | `/api/help/tooltip/dismissed`   | Get user's dismissed tooltips |

### Support Tickets

| Method | Endpoint                            | Description                  |
| ------ | ----------------------------------- | ---------------------------- |
| GET    | `/api/support/tickets`              | List my tickets              |
| POST   | `/api/support/tickets`              | Create ticket                |
| GET    | `/api/support/tickets/:id`          | Get ticket details           |
| POST   | `/api/support/tickets/:id/messages` | Add message                  |
| POST   | `/api/support/tickets/:id/resolve`  | Resolve ticket               |
| POST   | `/api/support/tickets/:id/feedback` | Submit satisfaction feedback |

## AI Help Integration

AI can reference help content:

```typescript
interface AIHelpContext {
  // When user asks about a feature, AI can:
  suggestArticles: HelpArticle[];
  suggestVideos: Video[];

  // AI response includes:
  answer: string;
  helpLinks: {
    type: 'article' | 'video';
    title: string;
    url: string;
  }[];

  // Escalation
  shouldEscalateToSupport: boolean;
  escalationReason?: string;
}
```

## Multi-language Support

All help content supports translations:

```typescript
interface HelpArticle {
  id: string;
  title: string;
  titleTranslations: {
    en: string;
    pl: string;
    de: string;
    es: string;
    ja: string;
    ar: string;
  };
  content: string;
  contentTranslations: {
    // Same structure
  };
}
```

## Related Flows

- FLOW-ONBOARDING-001: Help integrated with onboarding
- FLOW-AI-001: AI references help content
- FLOW-NOTIFICATION-001: Ticket updates notifications
