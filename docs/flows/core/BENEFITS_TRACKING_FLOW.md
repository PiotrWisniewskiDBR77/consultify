# FLOW-BENEFITS-001: Benefits Tracking & KPIs

> **ID:** FLOW-BENEFITS-001 | **Status:** ✅ Complete | **Priority:** P2

## Overview

| Metric                    | Value              |
| ------------------------- | ------------------ |
| **Completeness**          | 100%               |
| **Implementation Status** | New implementation |

## Purpose

Śledzenie i analiza korzyści (benefits) z zrealizowanych inicjatyw. Weryfikacja trwałości wyników transformacji.

## Benefits Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     BENEFITS TRACKING FLOW                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Initiative Completed                                                │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  1. DEFINE BENEFITS                                          │   │
│  │     • Expected benefits from initiative                       │   │
│  │     • KPIs to measure                                         │   │
│  │     • Baseline values                                         │   │
│  │     • Target values                                           │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  2. TRACK PROGRESS                                           │   │
│  │     • Regular measurements                                    │   │
│  │     • Manual or automated data entry                         │   │
│  │     • Trend visualization                                     │   │
│  └──────────────────────────────────────────────────────────────┘   │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  3. ANALYZE & REPORT                                         │   │
│  │     • Benefits realization rate                               │   │
│  │     • ROI calculation                                         │   │
│  │     • Sustainability assessment                               │   │
│  │     • Recommendations                                         │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## KPI Types

| Type            | Description              | Example             |
| --------------- | ------------------------ | ------------------- |
| **Financial**   | Revenue, cost savings    | Cost reduced by 20% |
| **Operational** | Efficiency, productivity | Cycle time -30%     |
| **Quality**     | Error rates, defects     | Defect rate < 1%    |
| **Customer**    | NPS, satisfaction        | NPS > 50            |
| **Employee**    | Engagement, retention    | Turnover < 10%      |

## Benefits Module UI

```
┌─────────────────────────────────────────────────────────────────────┐
│  Benefits Tracking                              [+ Add Benefit]     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Initiative: Process Automation Implementation                      │
│  Status: ✅ Completed (3 months ago)                                │
│                                                                     │
│  Expected Benefits                                                  │
│  ─────────────────────────────────────────────────────────────────  │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  💰 Cost Reduction                                  ████████░░│ │
│  │  Baseline: $500K/year → Target: $400K → Current: $420K        │ │
│  │  Progress: 80% | Status: 🟢 On Track                          │ │
│  │  [View Details] [Update Value]                                 │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  ⚡ Cycle Time Reduction                            ██████████│ │
│  │  Baseline: 5 days → Target: 2 days → Current: 1.8 days        │ │
│  │  Progress: 100%+ | Status: 🟢 Exceeded                        │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐ │
│  │  📊 Quality Improvement                             █████░░░░░│ │
│  │  Baseline: 5% error rate → Target: 1% → Current: 2.5%         │ │
│  │  Progress: 50% | Status: 🟡 At Risk                           │ │
│  └───────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  Overall Benefit Realization: 77%                                   │
│  Estimated ROI: 340%                                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Database Schema

```sql
-- KPI definitions
CREATE TABLE IF NOT EXISTS kpi_definitions (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'financial', 'operational', 'quality', 'customer', 'employee', 'custom'

    -- Measurement
    unit TEXT NOT NULL, -- '$', '%', 'days', 'count', 'score'
    direction TEXT NOT NULL, -- 'higher_better', 'lower_better', 'target'

    -- Default targets
    default_target REAL,
    warning_threshold REAL,
    critical_threshold REAL,

    -- Data source
    is_manual INTEGER DEFAULT 1,
    data_source TEXT, -- API endpoint for automatic fetch

    is_active INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Initiative benefits
CREATE TABLE IF NOT EXISTS initiative_benefits (
    id TEXT PRIMARY KEY,
    initiative_id TEXT NOT NULL,
    organization_id TEXT NOT NULL,

    -- Benefit definition
    name TEXT NOT NULL,
    description TEXT,
    kpi_id TEXT, -- Link to KPI definition

    -- Values
    baseline_value REAL NOT NULL,
    target_value REAL NOT NULL,
    current_value REAL,

    -- Timeline
    measurement_start_date DATE,
    target_date DATE,

    -- Progress
    progress_percentage REAL DEFAULT 0,
    status TEXT DEFAULT 'tracking', -- 'not_started', 'tracking', 'achieved', 'at_risk', 'failed'

    -- Financial (for ROI)
    estimated_annual_value REAL,
    actual_annual_value REAL,
    currency TEXT DEFAULT 'USD',

    -- Notes
    notes TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (initiative_id) REFERENCES initiatives(id),
    FOREIGN KEY (kpi_id) REFERENCES kpi_definitions(id)
);

-- Benefit measurements (history)
CREATE TABLE IF NOT EXISTS benefit_measurements (
    id TEXT PRIMARY KEY,
    benefit_id TEXT NOT NULL,

    measured_value REAL NOT NULL,
    measured_at DATE NOT NULL,
    measured_by TEXT,

    notes TEXT,
    evidence_url TEXT, -- Link to supporting document

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (benefit_id) REFERENCES initiative_benefits(id) ON DELETE CASCADE
);

-- Benefits reports
CREATE TABLE IF NOT EXISTS benefits_reports (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,

    report_type TEXT NOT NULL, -- 'initiative', 'project', 'portfolio'
    reference_id TEXT, -- Initiative/Project ID

    -- Summary metrics
    total_benefits_count INTEGER,
    achieved_count INTEGER,
    at_risk_count INTEGER,

    total_estimated_value REAL,
    total_realized_value REAL,
    realization_rate REAL,
    roi_percentage REAL,

    -- Report content
    report_data TEXT, -- JSON with full analysis

    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    generated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_benefits_initiative ON initiative_benefits(initiative_id);
CREATE INDEX IF NOT EXISTS idx_benefits_org ON initiative_benefits(organization_id);
CREATE INDEX IF NOT EXISTS idx_measurements_benefit ON benefit_measurements(benefit_id);
CREATE INDEX IF NOT EXISTS idx_reports_org ON benefits_reports(organization_id);
```

## API Endpoints

| Method | Endpoint                         | Description              |
| ------ | -------------------------------- | ------------------------ |
| GET    | `/api/benefits`                  | List org benefits        |
| GET    | `/api/initiatives/:id/benefits`  | Get initiative benefits  |
| POST   | `/api/initiatives/:id/benefits`  | Add benefit              |
| PUT    | `/api/benefits/:id`              | Update benefit           |
| POST   | `/api/benefits/:id/measurements` | Add measurement          |
| GET    | `/api/benefits/:id/history`      | Get measurement history  |
| GET    | `/api/benefits/report`           | Generate benefits report |
| GET    | `/api/kpis`                      | List KPI definitions     |
| POST   | `/api/kpis`                      | Create KPI definition    |

## Related Flows

- FLOW-INITIATIVE-001: Initiative completion triggers benefits tracking
- FLOW-REPORT-001: Benefits reports
- FLOW-ANALYTICS-001: Benefits analytics
