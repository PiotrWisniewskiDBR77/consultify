## Initiative Artifact — AI improvements (implementation report)

**Date:** 2026-02-15  
**Scope:** Initiative artifact (N-mode) — AI-assisted authoring + structured AI proposals for tables.

This document summarizes shipped changes in the Initiative artifact AI UX and the contracts/prompts used for proposals.

---

## 1) Global AI language policy

- **All AI prompts are authored in English**.
- **AI output is standardized to English** for all Initiative AI actions (even if user input/context is in Polish).
  - Rationale: multi-national delivery teams; consistent governance language across workspaces.

---

## 2) Initiative Scope / “Generate scope”

**Goal:** One-click generation that fills the entire Scope/Definition card, not just a single field.

- “Generate scope” orchestrates generation for:
  - Problem
  - Proposed solution
  - Cost of inaction (supports bullets and `[confirm]` placeholders where numbers are unknown)
  - Market context
  - Scope lists: in-scope / out-of-scope / kill criteria
- Minimum output quality rule: **at least 2 sentences** (more for complex topics).

Files:

- `src/components/Initiatives/InitiativeDocumentView.tsx`
- `src/components/shared/AIFieldEnhancer.tsx`
- `server/src/validators/initiative.validators.ts` (marketContext)
- `server/src/controllers/InitiativeController.ts` (marketContext mapping)

---

## 3) Tasks — structured AI proposals (Analyze + Add one)

**UX:**

- CTA (Tasks tab) shows:
  - **Analyze with AI** → returns structured proposal: add/remove/reorder
  - **AI: Add task** → proposes exactly one task and prefills the “New task” modal
- “New task” modal simplified: Title + Assumptions/notes + Owner (no due date/priority at creation)

**Quality rules:**

- Atomic verb-led titles; concise descriptions; optional acceptance criteria bullets.
- No invented dates/estimates/priorities.
- Deterministic junk/duplicate detection to guide removals.
- Optional “reorder-only” proposal when backlog is otherwise good.

Files:

- `src/components/Initiatives/sections/TasksMilestonesSection.tsx`
- `src/components/Initiatives/InitiativeDocumentView.tsx`
- `src/components/Initiatives/sections/InitiativeContext.tsx`

---

## 4) Decisions — structured AI proposals (Analyze + Add one)

**UX:**

- CTA (Decisions tab) shows:
  - **Analyze with AI** → structured proposal: add/remove/reorder
  - **AI: Add decision** → proposes exactly one decision and prefills “New decision”

**Quality rules:**

- A decision is an approval/commitment/Go-No-Go (NOT a task).
- Additions are lean/high-signal; removals target placeholders/duplicates/low-quality rows.
- English-only output; no invented owners/dates/budgets/vendors.

Files:

- `src/components/Initiatives/sections/DecisionsSection.tsx`
- `src/components/Initiatives/InitiativeDocumentView.tsx`
- `src/components/Initiatives/sections/InitiativeContext.tsx`

---

## 5) Team — AI team proposal (single Analyze)

**UX:**

- CTA (Team tab) shows **Analyze with AI**.
- AI output is displayed in a unified, scannable proposal table (Add/Update/Remove) with checkboxes.
- Includes a compact “Missing functions” block.

**Contract:**

- JSON schema:
  - `add[]`, `update[]`, `remove[]`, `missingFunctions[]`, optional `note`
- Uses “evidence signals” in context (task assignees, decision owners, RACI roles).

Files:

- `src/components/Initiatives/sections/InitiativeTeamSection.tsx`

---

## 6) Resources — AI proposals per table + CTA fill-all (Add / Analyze; add-only)

Resources contains 4 tables:

1. Budget (CAPEX/OPEX)
2. Team / FTE Allocation
3. Tools & Infrastructure
4. Licenses, Training & Intangible Assets

### 6.1 Per-table AI (header sparkle)

Each table’s AI sparkle opens a dropdown:

- **Add**: proposes exactly **one** new row (as a proposal, applied via checkbox modal)
- **Analyze**: proposes **additions only** (never removes), based on existing rows

### 6.2 CTA “Analyze with AI” on Resources tab

- Triggers a single “fill all tables” proposal across all 4 tables.
- If **all tables are empty**: proposes a complete initial fill per table.
- If **any table has rows**: proposes **additions only** where truly missing; never removes.

### 6.3 Resources JSON contract (high level)

Per-table “Analyze”:

```json
{
  "add": [
    {
      /* row schema */
    }
  ],
  "note": "optional"
}
```

CTA “Analyze with AI”:

```json
{
  "budget": {
    "add": [
      {
        "category": "...",
        "costType": "CAPEX|OPEX",
        "amount": 0,
        "currency": "PLN|EUR|USD|GBP",
        "description": "...",
        "rationale": "..."
      }
    ]
  },
  "teamFte": {
    "add": [
      {
        "name": "...",
        "role": "lead|member|consultant|stakeholder",
        "allocationPercentage": 50,
        "notes": "...",
        "rationale": "..."
      }
    ]
  },
  "tools": {
    "add": [
      {
        "name": "...",
        "category": "software|hardware|cloud|platform|other",
        "licenseCost": 0,
        "licenseType": "subscription|perpetual|open_source|internal",
        "status": "planned|active|deprecated",
        "notes": "...",
        "rationale": "..."
      }
    ]
  },
  "intangibles": {
    "add": [
      {
        "assetType": "license|training|certification|knowledge|ip|legal_right|other",
        "name": "...",
        "cost": 0,
        "currency": "PLN|EUR|USD|GBP",
        "status": "planned|active|expired|renewed",
        "notes": "...",
        "rationale": "..."
      }
    ]
  },
  "note": "optional"
}
```

**Non-invention rule for Resources:** if numbers/vendors/dates are unknown, the model sets numeric fields to `0` and uses `[confirm]` placeholders in description/notes.

Files:

- `src/components/Initiatives/sections/ResourcesSection.tsx`
- `src/components/Initiatives/InitiativeDocumentView.tsx`
- `src/components/Initiatives/sections/InitiativeContext.tsx`

---

## 7) Manual test checklist (user-run)

- Scope: “Generate scope” fills all fields and scope lists; outputs are substantive (2+ sentences) and may use bullets.
- Tasks:
  - CTA Analyze returns add/remove/reorder proposals; reorder-only works.
  - CTA Add task proposes one task and opens creation modal prefilled.
- Decisions:
  - CTA Analyze returns add/remove/reorder proposals.
  - CTA Add decision proposes one decision and opens creation modal prefilled.
- Team:
  - CTA Analyze returns proposal table + missing functions.
- Resources:
  - Each table sparkle → dropdown Add/Analyze works.
  - Resources CTA Analyze proposes fill-all; never removes; when tables already have rows, proposes only additions.
