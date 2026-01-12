# Phase D – Organization Setup Functional Specification

---

## 1. Purpose of Phase D

Phase D is the **mental shift moment**. The user stops "testing a tool" and begins "working on their company." This is the single most important cognitive transition in the product — it transforms a trial user into an organizational stakeholder.

**What Phase D is:**
- The moment of organizational commitment
- The start of persistent AI context and memory
- A conscious decision to invest time and focus

**What Phase D is not:**
- A payment gate (billing comes later)
- A bureaucratic form-filling exercise
- A required step that can be skipped accidentally

---

## 2. Entry Conditions

| Entry Path | Preconditions | Context Transferred |
|------------|---------------|---------------------|
| From Trial (Phase C) | Trial active, at least 1 session completed | `trial_id`, user profile, any draft work |
| From Demo + Trial | Demo completed → Trial started → Ready to commit | Demo insights, trial context |
| Direct Consultant Invite | Valid consultant invitation code | Consultant attribution, pre-configured org template |

---

## 3. The Mental Shift

### Before Phase D (Trial Mindset)
- "I am testing this tool"
- "This is my personal exploration"
- "I can leave anytime"

### After Phase D (Organization Mindset)
- "We are working on our company"
- "This is our shared workspace"
- "We are committing to this process"

### How the System Reinforces This Shift

1. **Language Change**: All UI copy switches from "you" to "your organization" / "your team"
2. **Naming Ceremony**: User explicitly names their organization (not just an account)
3. **AI Introduction**: AI introduces itself as the organization's partner, not the user's assistant
4. **Memory Statement**: System explicitly states "I will remember your organization's context from now on"

---

## 4. Organization Creation Flow

| Step | Action | AI Behavior |
|------|--------|-------------|
| 1 | User clicks "Create Organization" | AI: *"You're about to establish your organization's workspace. This is where we'll build your transformation strategy together."* |
| 2 | User enters organization name | AI validates name, suggests corrections if needed |
| 3 | User confirms industry/sector (optional) | AI uses this for contextual intelligence |
| 4 | Organization created | AI: *"Your organization [Name] is now active. I'll remember everything we discuss from this point forward."* |

---

## 5. Data Initialized at Organization Creation

| Data Element | Source | Purpose |
|--------------|--------|---------|
| `organization_id` | Generated | Primary key for all org-scoped data |
| `organization_type` | `'ACTIVE'` (from Trial) or `'PAID'` | Access control |
| `created_at` | System timestamp | Audit trail |
| `owner_user_id` | Creating user | RBAC owner role |
| `ai_context_initialized` | `true` | Signals AI memory start |
| `onboarding_status` | `'PENDING'` | Ready for Phase E |

---

## 6. What Transfers from Trial

| Data | Transfer Behavior |
|------|-------------------|
| Draft initiatives | Migrated to organization scope |
| Assessment answers | Preserved as baseline snapshot |
| User preferences | Carried forward |
| AI conversation history | **NOT transferred** (fresh start for org context) |
| Token usage | Reset for organization |

---

## 7. AI Behavior in Phase D

### Role: Organizational Partner Introduction

- AI explicitly introduces itself as the organization's cognitive partner
- AI does NOT make decisions for the organization
- AI explains its role: "I help you think through complex decisions, surface blind spots, and maintain continuity across your transformation journey"

### Memory Statement
> *"From this moment, I will build a persistent understanding of [Organization Name]. Every conversation, decision, and insight will contribute to our shared context."*

---

## 8. Exit Conditions (Phase D Complete)

Phase D is complete when:
- [x] Organization has a name
- [x] At least one user is OWNER
- [x] `ai_context_initialized = true`
- [x] User has seen the "memory start" confirmation
- [x] System redirects to Phase E (Guided First Value)

---

## 9. Phase Boundaries

- **Hand-off from Phase C**: Trial conversion triggers organization creation flow
- **Hand-off to Phase E**: Immediately after organization creation, user enters the Onboarding Wizard
- **No Overlap**: Organization setup never collects payment or detailed business data (that's Phase E)

---

## 10. Acceptance Criteria

- [ ] User cannot accidentally skip organization naming
- [ ] AI explicitly announces "memory start"
- [ ] All trial data is correctly migrated or explicitly discarded
- [ ] RBAC roles are correctly assigned at creation
- [ ] `onboarding_status` is set to `'PENDING'` for Phase E handoff

---

*Prepared by Antigravity – 2025-12-21*
