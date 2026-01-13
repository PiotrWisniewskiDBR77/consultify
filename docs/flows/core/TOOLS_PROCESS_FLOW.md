# FLOW-TOOLS-001: Tools & Process Flow

> **ID:** FLOW-TOOLS-001 | **Status:** ✅ Complete | **Priority:** P1

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Moduł narzędzi - zestaw narzędzi wspierających transformację i strategię. Można pracować w ramach projektów lub w "piaskownicy".

## Tools Catalog

### Assessment Tools (Ocena Dojrzałości)

| Tool         | Status   | Description                       |
| ------------ | -------- | --------------------------------- |
| **SIRI**     | Licensed | Smart Industry Readiness Index    |
| **ADMA**     | Licensed | Advanced Manufacturing Assessment |
| **CMMI**     | Standard | Capability Maturity Model         |
| **DRD**      | DBR77    | Digital Readiness Diagnosis       |
| **Lean 4.0** | DBR77    | Lean + Digital Assessment         |

### Process Tools

| Tool                        | Status  | Description                                |
| --------------------------- | ------- | ------------------------------------------ |
| **Process Flow Automation** | Planned | Map, measure, optimize, automate processes |
| **A3 + PDCA**               | Planned | Lean problem-solving worksheet             |
| **Economic Evaluation**     | Planned | ROI calculation for projects               |

### AI Tools

| Tool           | Status  | Description                            |
| -------------- | ------- | -------------------------------------- |
| **AI Adviser** | Active  | Brainstorming and tool recommendations |
| **Studio**     | Planned | Create diagrams and flowcharts         |

### Special

| Tool                | Status | Description                             |
| ------------------- | ------ | --------------------------------------- |
| **Sandbox Project** | Active | Practice area for tools without project |

## Process Flow Automation Tool

Kluczowe narzędzie do optymalizacji procesów:

```
┌──────────────────────────────────────────────────────────────────────┐
│              PROCESS FLOW AUTOMATION STAGES                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  STAGE 1: MAP (Mapowanie procesu)                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • Rysowanie procesu flow                                       │ │
│  │ • Identyfikacja kroków                                         │ │
│  │ • Określenie wejść/wyjść                                       │ │
│  │ • Zdefiniowanie ról                                            │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  STAGE 2: CLASSIFY (Klasyfikacja kroków)                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • Krok = Działanie czy Decyzja?                                │ │
│  │ • Czy dodaje wartość?                                          │ │
│  │ • Czy jest bottleneckiem?                                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  STAGE 3: MEASURE (Pomiar)                                          │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • Czas każdego kroku                                           │ │
│  │ • Koszty                                                       │ │
│  │ • Częstotliwość błędów                                         │ │
│  │ • Volume                                                        │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  STAGE 4: OPTIMIZE (Optymalizacja)                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ ⚠️ NIE automatyzuj nieefektywności!                            │ │
│  │ • Eliminacja zbędnych kroków                                   │ │
│  │ • Uproszczenie procesu                                         │ │
│  │ • Redukcja czasu/kosztów                                       │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  STAGE 5: AUTOMATE (Automatyzacja)                                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ • Poszukiwanie narzędzi do automatyzacji                       │ │
│  │ • Może być proste (kilka $) lub zaawansowane                   │ │
│  │ • Własna aplikacja jeśli potrzeba                              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                              │                                       │
│                              ▼                                       │
│  OUTPUT: ROI Analysis + Implementation Plan → Initiative            │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## A3 + PDCA Tool

Lean problem-solving w jednym narzędziu:

```
┌──────────────────────────────────────────────────────────────────────┐
│                         A3 TEMPLATE                                  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  LEFT SIDE (Problem Understanding)     │  RIGHT SIDE (Solution)     │
│  ─────────────────────────────────────│───────────────────────────  │
│                                        │                             │
│  1. BACKGROUND                         │  5. COUNTERMEASURES         │
│     Why is this problem important?     │     What will we do?        │
│                                        │                             │
│  2. CURRENT STATE                      │  6. PLAN                    │
│     What is happening now?             │     Who, What, When?        │
│                                        │                             │
│  3. GOAL / TARGET                      │  7. FOLLOW-UP               │
│     What should be happening?          │     How will we check?      │
│                                        │                             │
│  4. ROOT CAUSE ANALYSIS                │                             │
│     Why is this happening?             │                             │
│     (5 Whys, Fishbone)                 │                             │
│                                        │                             │
└──────────────────────────────────────────────────────────────────────┘

                    ┌───────────────────────────────┐
                    │        PDCA CYCLE             │
                    │                               │
                    │      ┌─────┐   ┌─────┐       │
                    │      │PLAN │──►│ DO  │       │
                    │      └──▲──┘   └──┬──┘       │
                    │         │         │          │
                    │      ┌──┴──┐   ┌──▼──┐       │
                    │      │ ACT │◄──│CHECK│       │
                    │      └─────┘   └─────┘       │
                    │                               │
                    └───────────────────────────────┘
```

## Tool Integration with Projects

Prace w narzędziach mogą być przypisane do tasków:

```typescript
interface ToolWork {
  id: string;
  toolId: string;
  name: string;

  // Assignment
  projectId?: string; // Może być null (sandbox)
  initiativeId?: string;
  taskId?: string;

  // Content
  workData: Record<string, unknown>; // Tool-specific data

  // Status
  status: 'draft' | 'in_progress' | 'completed';

  // Collaboration
  sharedWith: string[];

  createdBy: string;
  createdAt: string;
}
```

## Sandbox Project

Specjalny projekt do nauki i eksperymentów:

```typescript
interface SandboxProject {
  id: 'sandbox'; // Special ID
  name: 'Sandbox';
  organizationId: string;

  // Features
  isTrainingMode: boolean;
  showTips: boolean;

  // Contents (not real project data)
  demoAssessments: boolean;
  demoInitiatives: boolean;
}
```

## Database Schema

```sql
-- Tools registry
CREATE TABLE IF NOT EXISTS tools (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    display_name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'assessment', 'process', 'ai', 'analysis'
    description TEXT,
    icon TEXT,
    is_licensed INTEGER DEFAULT 0,
    is_active INTEGER DEFAULT 1,
    config_schema TEXT, -- JSON schema for tool config
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tool work items
CREATE TABLE IF NOT EXISTS tool_works (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    tool_id TEXT NOT NULL,
    name TEXT NOT NULL,

    -- Assignment
    project_id TEXT,
    initiative_id TEXT,
    task_id TEXT,

    -- Content
    work_data TEXT NOT NULL, -- JSON

    -- Status
    status TEXT DEFAULT 'draft',

    -- Collaboration
    shared_with TEXT, -- JSON array of user IDs

    -- Audit
    created_by TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tool_id) REFERENCES tools(id)
);

-- Process flows (for Process Flow Automation tool)
CREATE TABLE IF NOT EXISTS process_flows (
    id TEXT PRIMARY KEY,
    tool_work_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Process definition
    name TEXT NOT NULL,
    description TEXT,
    process_data TEXT NOT NULL, -- JSON with nodes, edges

    -- Stages
    current_stage TEXT DEFAULT 'map', -- 'map', 'classify', 'measure', 'optimize', 'automate'

    -- Metrics (calculated from process_data)
    total_steps INTEGER,
    decision_steps INTEGER,
    action_steps INTEGER,
    estimated_time_minutes INTEGER,
    estimated_cost REAL,

    -- Analysis
    optimization_suggestions TEXT, -- JSON from AI
    roi_analysis TEXT, -- JSON

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tool_work_id) REFERENCES tool_works(id)
);

-- A3 documents
CREATE TABLE IF NOT EXISTS a3_documents (
    id TEXT PRIMARY KEY,
    tool_work_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- A3 sections
    title TEXT NOT NULL,
    background TEXT,
    current_state TEXT,
    goal_target TEXT,
    root_cause_analysis TEXT, -- JSON with 5 whys, fishbone data
    countermeasures TEXT, -- JSON array
    plan TEXT, -- JSON with who, what, when
    follow_up TEXT,

    -- PDCA tracking
    pdca_cycles TEXT, -- JSON array of cycles
    current_pdca_phase TEXT DEFAULT 'plan',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tool_work_id) REFERENCES tool_works(id)
);
```

## API Endpoints

| Method | Endpoint                               | Description                    |
| ------ | -------------------------------------- | ------------------------------ |
| GET    | `/api/tools`                           | List available tools           |
| GET    | `/api/tools/:id`                       | Get tool details               |
| POST   | `/api/tools/:id/start`                 | Start new tool work            |
| GET    | `/api/tool-works`                      | List user's tool works         |
| GET    | `/api/tool-works/:id`                  | Get tool work                  |
| PUT    | `/api/tool-works/:id`                  | Update tool work               |
| DELETE | `/api/tool-works/:id`                  | Delete tool work               |
| POST   | `/api/tool-works/:id/assign`           | Assign to task/initiative      |
| POST   | `/api/tool-works/:id/share`            | Share with users               |
| POST   | `/api/process-flows/:id/analyze`       | AI analyze process             |
| POST   | `/api/process-flows/:id/to-initiative` | Create initiative from process |

## AI Integration

### AI Adviser Tool

```typescript
interface AIAdviserSession {
  topic: string;
  context: {
    projectId?: string;
    currentChallenge: string;
  };

  // AI recommends tools based on challenge
  recommendedTools: {
    toolId: string;
    reason: string;
    confidence: number;
  }[];

  // Brainstorming results
  ideas: string[];
  nextSteps: string[];
}
```

### Process Optimization AI

```typescript
interface ProcessOptimizationSuggestion {
  stepId: string;
  suggestionType: 'eliminate' | 'simplify' | 'automate' | 'parallelize';
  description: string;
  estimatedSaving: {
    time?: number;
    cost?: number;
  };
  confidence: number;
  implementationComplexity: 'low' | 'medium' | 'high';
}
```

## Related Flows

- FLOW-ASSESSMENT-001: Assessment tools
- FLOW-INITIATIVE-001: Tool outputs → initiatives
- FLOW-PROJECT-001: Tools in project context
- FLOW-AI-001: AI adviser integration
