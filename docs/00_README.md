# Documentation Overview

This repository follows an enterprise‑grade documentation hierarchy. The top‑level `docs/` directory contains the following sections:

## Quick Start Documentation

- **[00-introduction.md](00-introduction.md)** – Introduction to Consultify platform
- **[01-getting-started.md](01-getting-started.md)** – Installation and setup guide
- **[02-architecture.md](02-architecture.md)** – System architecture and technical overview
- **[03-features.md](03-features.md)** – Detailed feature documentation
- **[04-development.md](04-development.md)** – Developer guide and coding standards
- **[06-deployment.md](06-deployment.md)** – Production deployment guide
- **[API_REFERENCE.md](API_REFERENCE.md)** – Complete API endpoint documentation

## Enterprise Documentation Structure

- **`00_foundation/`** – Core system specifications:
  - `00_SYSTEM_CONTRACT.md` – User journey, mental states, and system integrity
  - `01_USER_STATE_MACHINE.md` – User state machine documentation
  - `02_AI_BEHAVIOR_BY_PHASE.md` – AI behavior specifications
  - `ENTERPRISE_SPEC.md` – Enterprise-grade specifications

- **`03_methodology/`** – Methodology documentation:
  - `03_DRD_METHODOLOGY.md` – DRD methodology guide
  - `04_DRD_AXIS_LIFECYCLE.md` – DRD axis lifecycle

- **`10_product_flow/`** – Product flow by phase:
  - `00_GTM_PRODUCT_LOGIC.md` – Go-to-market and product logic
  - `10_PHASE_A_PRE_ENTRY.md` – Phase A: Pre-Entry
  - `11_PHASE_B_DEMO.md` – Phase B: Demo Session
  - `12_PHASE_C_TRIAL.md` – Phase C: Trial Entry
  - `13_PHASE_D_ORG_SETUP.md` – Phase D: Organization Setup
  - `14_PHASE_E_FIRST_VALUE.md` – Phase E: Guided First Value
  - `15_PHASE_F_TEAM.md` – Phase F: Team Expansion
  - `16_PHASE_G_ECOSYSTEM.md` – Phase G: Ecosystem Participation
  - `epics/` – Epic-level documentation

- **`20_execution/`** – Execution rules:
  - `20_UI_RULES.md` – UI rules and guidelines
  - `21_BACKEND_RULES.md` – Backend development rules
  - `22_RBAC_AND_LIMITS.md` – RBAC and limits
  - `23_ONBOARDING_IS_NOT_ONBOARDING.md` – Onboarding philosophy
  - `24_FEATURE_GATING_RULES.md` – Feature gating rules
  - `25_DATA_ETHICS_AND_TRUST.md` – Data ethics and trust

- **`30_ai_control/`** – AI control and behavior:
  - `30_AI_MODE_SWITCHING.md` – AI mode switching
  - `31_AI_FAILURE_MODES.md` – AI failure modes

- **`40_governance/`** – Governance documentation:
  - `40_AUDITABILITY.md` – Auditability requirements
  - `41_DECISION_OWNERSHIP.md` – Decision ownership

- **`50_antigravity_control/`** – Implementation validation:
  - `50_ANTIGRAVITY_MASTER_PROMPT.md` – Master prompt for AI assistants
  - `51_IMPLEMENTATION_VALIDATION_CHECKLIST.md` – Validation checklist

- **`99_release/`** – Release documentation:
  - `99_SYSTEM_INTEGRITY_STATEMENT.md` – System integrity statement

- **`api/`** – API documentation:
  - `openapi.yaml` – OpenAPI specification

- **`archive/`** – Legacy or non‑canonical documents

> **"This repository is the single source of truth for Consultify."**

Navigate to the appropriate section to find the authoritative documentation for a given topic.
