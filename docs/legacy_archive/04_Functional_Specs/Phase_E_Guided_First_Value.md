# Phase E – Guided First Value (DRD Core) Functional Specification

---

## 1. Purpose of Phase E

Phase E is the **AHA moment**. The system comes alive when the user sees their first meaningful insight derived from their own organizational context. Without this moment, the product is just another tool.

**What Phase E is:**
- A structured AI-guided dialog (max 5-7 questions)
- The creation of the first DRD (Digital Readiness Degree) snapshot
- The moment user says "this makes sense"

**What Phase E is not:**
- A form to fill out
- A demo with fake data
- A long questionnaire

---

## 2. Entry Conditions

| Precondition | Source |
|--------------|--------|
| Organization exists | Phase D complete |
| `onboarding_status = 'PENDING'` | Set by Phase D |
| User is OWNER or ADMIN | RBAC check |

---

## 3. The Onboarding Dialog

### AI-Driven Question Flow

The AI asks 5-7 contextual questions to understand the organization. These are NOT fixed questions — the AI adapts based on:
- Industry context (if provided in Phase D)
- User's role
- Organization size signals

### Example Question Flow

| Q# | AI Question | Purpose |
|----|-------------|---------|
| 1 | "What's the primary transformation you're pursuing?" | Strategic intent |
| 2 | "Who are the key stakeholders in this decision?" | Governance context |
| 3 | "What's your timeline pressure?" | Urgency assessment |
| 4 | "What's been tried before?" | Historical context |
| 5 | "What would success look like in 90 days?" | Success criteria |

### Question Constraints

- **Maximum questions**: 7
- **Minimum questions**: 3
- **AI discretion**: Can skip questions if context is clear
- **User skip**: User can say "I don't know" — AI acknowledges and continues

---

## 4. DRD Axis Selection

After the dialog, the AI selects the relevant DRD axes for this organization.

### Standard DRD Axes

1. **Strategy** — Strategic clarity and alignment
2. **Technology** — Digital infrastructure maturity
3. **Operations** — Process efficiency
4. **Data** — Data governance and utilization
5. **Culture** — Change readiness

### AI Selection Logic

```
IF user mentions "digital transformation" → prioritize Technology, Data
IF user mentions "restructuring" → prioritize Operations, Culture
IF user mentions "growth" → prioritize Strategy, Technology
```

AI explains its selection:
> *"Based on your context, I'm focusing on Strategy and Technology as your primary axes. Here's why: [explanation]"*

---

## 5. First Snapshot Creation

### What Gets Created

| Element | Description |
|---------|-------------|
| `onboarding_plan_snapshot` | JSON capturing the dialog and AI analysis |
| `onboarding_plan_version` | Version number (starts at 1) |
| Selected DRD axes | Stored for future assessments |
| First insight | AI-generated observation based on context |

### The "AHA" Moment

The AI presents the first real insight:
> *"Based on what you've shared, I notice [specific observation]. This suggests [implication]. Would you like to explore this further?"*

This is the psychological turning point — the moment the system demonstrates value.

---

## 6. Success Signals (AHA Detection)

| Signal | Trigger | System Response |
|--------|---------|-----------------|
| Snapshot created | AI generates first DRD snapshot | Show "Your transformation baseline is ready" |
| First insight acknowledged | User responds positively to AI insight | Offer to proceed to initiatives |
| Session time > 5 min | User engaged in meaningful dialog | Note high engagement |
| User asks follow-up question | Interest signal | AI deepens the analysis |

---

## 7. Conversion Nudge Logic

When AHA signals are detected, the system offers next steps:

### Primary Path: Continue to Initiatives
> *"You've established your baseline. Ready to define your first initiative?"*

### Secondary Path: Invite Team
> *"This decision affects others. Would you like to invite 1-2 colleagues to add their perspective?"*

### Tertiary Path: Need More Time
> *"The snapshot is saved. You can return anytime to continue."*

---

## 8. Data Persistence

| State | Data Saved | Data Discarded |
|-------|------------|----------------|
| During dialog | Draft responses (auto-save) | — |
| On snapshot | Full plan snapshot, version | Preview drafts |
| On accept | Initiatives created, status = COMPLETED | — |

### Idempotency

- `acceptPlan()` is idempotent — calling it twice with same `idempotency_key` returns success without duplicate creation
- Version number prevents stale acceptance

---

## 9. AI Behavior Summary

| Role | Behavior |
|------|----------|
| **Dialog Driver** | Asks contextual questions, adapts to responses |
| **Axis Selector** | Chooses DRD dimensions, explains reasoning |
| **Insight Generator** | Produces first meaningful observation |
| **Guide** | Suggests next steps without deciding |

### What AI Does NOT Do
- Make decisions for the organization
- Promise outcomes
- Push toward purchase
- Generate generic advice

---

## 10. Exit Conditions (Phase E Complete)

Phase E is complete when:
- [x] Onboarding dialog finished (3-7 questions answered)
- [x] DRD axes selected
- [x] First snapshot created (`onboarding_plan_snapshot` populated)
- [x] `onboarding_status = 'COMPLETED'`
- [x] User has seen at least one AI insight

---

## 11. Phase Boundaries

- **Hand-off from Phase D**: Automatic redirect after organization creation
- **Hand-off to Phase F**: Conversion nudge offers team invitation
- **Return Path**: User can revisit onboarding to regenerate plan (new version)

---

## 12. Acceptance Criteria

- [ ] AI asks maximum 7 questions
- [ ] User can skip questions without blocking progress
- [ ] At least one AI insight is generated before completion
- [ ] Snapshot versioning works correctly
- [ ] Accept is idempotent

---

*Prepared by Antigravity – 2025-12-21*
