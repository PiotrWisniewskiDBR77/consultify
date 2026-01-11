# FLOW-SANDBOX-001: Sandbox Project

> **ID:** FLOW-SANDBOX-001 | **Status:** ✅ Complete | **Priority:** P2

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Projekt "piaskownica" dla użytkowników do testowania narzędzi bez wpływu na produkcyjne dane. Tryb nauki i eksperymentowania.

## Sandbox Concept

```
┌──────────────────────────────────────────────────────────────────────┐
│                     SANDBOX PROJECT                                 │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  "Piaskownica" = Bezpieczne miejsce do:                              │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  🧪 TESTOWANIA NARZĘDZI                                         ││
│  │  • Process Flow Automation                                       ││
│  │  • A3 + PDCA                                                     ││
│  │  • Economic Evaluation                                           ││
│  │  • AI Adviser                                                    ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  📚 NAUKI                                                       ││
│  │  • Guided tutorials                                             ││
│  │  • Sample data                                                   ││
│  │  • No-risk environment                                           ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │  🔬 EKSPERYMENTOWANIA                                           ││
│  │  • Try AI features                                               ││
│  │  • Test workflows                                                ││
│  │  • Prototype initiatives                                         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Sandbox Features

| Feature               | Description                               |
| --------------------- | ----------------------------------------- |
| **Auto-created**      | Created for each new organization         |
| **Sample Data**       | Pre-populated with demo content           |
| **Reset Option**      | User can reset to initial state           |
| **No Billing Impact** | AI tokens counted but with generous limit |
| **Export to Real**    | Move work from sandbox to real project    |

## Sandbox UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  🧪 Sandbox Project                              [Reset] [Settings] │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ 💡 This is your sandbox - experiment freely!                  │ │
│  │    Changes here won't affect your real projects.              │ │
│  │    [Learn more] [Hide this]                                   │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Quick Start                                                        │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐   │
│  │ 🔄 Process  │ │ 📋 A3+PDCA  │ │ 💰 Economic │ │ 🤖 AI       │   │
│  │ Flow        │ │             │ │ Eval        │ │ Adviser     │   │
│  │ [Try it]    │ │ [Try it]    │ │ [Try it]    │ │ [Try it]    │   │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘   │
│                                                                     │
│  Your Sandbox Work                                                  │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ Process: "Order Fulfillment"              Draft    [Continue] │ │
│  │ Created: 2 days ago | Stage: Analysis                         │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ A3: "Quality Improvement"                  Active   [Continue]│ │
│  │ Created: 1 week ago | Step: Root Cause                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Sample Data Available                                              │
│  ─────────────────────────────────────────────────────────────────  │
│  ☑ Manufacturing Process Flow (demo)                                │
│  ☑ Sample A3 Problem Solving                                        │
│  ☐ Economic Evaluation Template                                     │
│  [Load Sample Data]                                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
-- Sandbox projects configuration
CREATE TABLE IF NOT EXISTS sandbox_projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL UNIQUE,
    project_id TEXT NOT NULL, -- Reference to actual project

    -- Status
    is_active INTEGER DEFAULT 1,

    -- Settings
    sample_data_loaded INTEGER DEFAULT 0,
    ai_tokens_limit INTEGER DEFAULT 10000, -- Monthly sandbox limit
    ai_tokens_used_this_month INTEGER DEFAULT 0,

    -- Reset
    last_reset_at TIMESTAMP,
    reset_count INTEGER DEFAULT 0,

    -- Export
    exports_to_real_count INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (organization_id) REFERENCES organizations(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
);

-- Sandbox sample data templates
CREATE TABLE IF NOT EXISTS sandbox_templates (
    id TEXT PRIMARY KEY,

    name TEXT NOT NULL,
    description TEXT,
    template_type TEXT NOT NULL, -- 'process_flow', 'a3', 'assessment', 'initiative'

    -- Content
    template_data TEXT NOT NULL, -- JSON: full template content

    -- Metadata
    category TEXT,
    difficulty TEXT DEFAULT 'beginner', -- 'beginner', 'intermediate', 'advanced'
    estimated_time_minutes INTEGER,

    -- Display
    thumbnail_url TEXT,

    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed sample templates
INSERT OR IGNORE INTO sandbox_templates (id, name, description, template_type, template_data, category, difficulty) VALUES
    ('tmpl-process-manufacturing', 'Manufacturing Process', 'Sample manufacturing process flow with bottleneck analysis', 'process_flow', '{"steps":[{"name":"Order Receipt","type":"activity"},{"name":"Material Check","type":"decision"},{"name":"Production","type":"activity"},{"name":"Quality Check","type":"decision"},{"name":"Shipping","type":"activity"}]}', 'manufacturing', 'beginner'),
    ('tmpl-a3-quality', 'Quality Problem A3', 'A3 template for quality improvement', 'a3', '{"problem":"High defect rate in final assembly","target":"Reduce defect rate from 5% to 1%","analysis":{"root_causes":[]}}', 'quality', 'beginner'),
    ('tmpl-initiative-digital', 'Digital Transformation', 'Sample digital transformation initiative', 'initiative', '{"name":"Process Digitalization","description":"Convert manual processes to digital workflows","estimated_value":50000}', 'transformation', 'intermediate');

CREATE INDEX IF NOT EXISTS idx_sandbox_org ON sandbox_projects(organization_id);
CREATE INDEX IF NOT EXISTS idx_sandbox_templates_type ON sandbox_templates(template_type);
```

## API Endpoints

| Method | Endpoint                         | Description              |
| ------ | -------------------------------- | ------------------------ |
| GET    | `/api/sandbox`                   | Get sandbox status       |
| POST   | `/api/sandbox/reset`             | Reset sandbox            |
| POST   | `/api/sandbox/load-template/:id` | Load sample data         |
| POST   | `/api/sandbox/export/:workId`    | Export to real project   |
| GET    | `/api/sandbox/templates`         | List available templates |

## Sandbox → Real Project Export

```
┌─────────────────────────────────────────────────────────────────────┐
│  Export to Real Project                                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  You're about to export:                                            │
│  "Order Fulfillment Process Analysis"                               │
│                                                                     │
│  Select destination project:                                        │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │ ○ Digital Transformation 2026                                 │ │
│  │ ● Process Excellence Program                                  │ │
│  │ ○ Lean Implementation                                         │ │
│  │ ○ + Create new project                                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Export options:                                                    │
│  ☑ Include all process steps                                       │
│  ☑ Include analysis notes                                          │
│  ☐ Include AI conversation history                                  │
│  ☑ Create as new initiative                                        │
│                                                                     │
│                              [Cancel]  [Export to Project]          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Related Flows

- FLOW-TOOLS-001: Tools available in sandbox
- FLOW-ONBOARDING-001: Sandbox as learning tool
- FLOW-PROJECT-001: Export to real projects
