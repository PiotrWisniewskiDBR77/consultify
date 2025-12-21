# Phase C – Trial Functional Specification

## 1. Purpose of Phase C
The **Trial** phase is a controlled entry into real work that tests an organization's readiness for change. It provides a guided, AI‑first consulting experience that moves the user toward a clear decision:
- continue as an organization,
- engage consulting support, or
- exit consciously.
It is **not** a free sandbox or a "try‑before‑you‑buy" experience.

## 2. Entry Paths
| Entry Path | Eligibility Conditions | Required Context | Data Initialized |
|------------|------------------------|------------------|-------------------|
| From Demo (Phase B) | Demo completed, no existing organization | Demo session ID, user profile | `trial_start_timestamp`, AI token budget, provisional org placeholder |
| Invitation Code | Valid, unexpired code linked to a partner or campaign | Code string, inviter ID | `trial_start_timestamp`, referral attribution, token budget |
| Referral | Referral link containing `referrer_id` | Referrer must have an active organization | `trial_start_timestamp`, referral chain data |
| Consultant Invitation | Invitation issued by an authorized consultant (`consultant_id`) | Consultant must be active | `trial_start_timestamp`, consultant attribution |
| Team Invitation | Invitation from an existing team member (`team_id`) | Team member belongs to a trial‑eligible organization | `trial_start_timestamp`, team context |

## 3. Trial Constraints
- **Duration**: Fixed **14‑day** period from `trial_start_timestamp`.
  - **Extensions**: Up to **2 extensions** of **14 days** each (admin‑approved only).
- **Resource Limits**:
  - **Projects**: Maximum **3** projects.
  - **Initiatives**: Up to **5** initiatives may be created.
  - **Team Members**: Up to **4 total users** (owner + 3 additional invites).
  - **Storage**: **100 MB** maximum storage allocation.
- **AI Usage Limits**:
  - **Daily Soft Limit**: **50 AI calls per day** (velocity limiter).
  - **Total Token Budget**: **100,000 AI tokens** per trial (hard limit).
  - **Visibility**: Token consumption displayed in the UI dashboard with a progress bar.
  - **AI Roles**: Limited to **ADVISOR** role only during trial.
- **Export Limit**: **5 reports** maximum (with trial watermark).

## 4. AI Behavior in Trial
- **Primary Guide** – The AI drives the user through the trial, offering contextual explanations and next‑step suggestions.
- **Decision Partner** – AI proposes actions and evaluates readiness but never makes the final commitment.
- **Escalation Logic**:
  1. When a **Success Signal** (see §6) is detected, AI presents three options:
     - **Create Organization** – hand‑off to the permanent organization flow.
     - **Talk to Consulting** – schedule a consulting conversation.
     - **Exit** – provide a summary and graceful exit.
  2. If the trial expires without a success signal, AI shows an **Exit** screen with the same three options.

## 5. Data Persistence & Safety
- **Saved During Trial**: All initiatives, user actions, AI suggestions, token usage logs, and referral/attribution data.
- **Not Saved After Expiry**: Temporary AI reasoning caches and preview drafts that were not promoted to initiatives.
- **Freezing Rules**: On expiry, all mutable data becomes **read‑only**; no further edits are allowed.
- **Retention Grace Period**: **7 days** after expiry the data remains accessible for export before permanent deletion.

## 6. Success Signals (AHA Moments)
| Signal | Triggered Action |
|--------|-------------------|
| Completion of a **Decision‑Ready Document (DRD)** | AI offers conversion nudge to create organization. |
| Generation of a **final report** | AI proposes consulting hand‑off. |
| Invitation of **≥ 2 team members** | AI highlights collaborative potential and suggests organization creation. |
| Repeated session usage (> 3 days) | AI shows a "Ready to decide?" prompt. |

## 7. Exit Paths
1. **Create Organization** – user confirms; trial data is migrated to a permanent organization.
2. **Talk to Consulting** – schedule a consulting call; trial data is attached to the request.
3. **Extend Trial** – up to **2 extensions** of **14 days** each (admin‑approved only).
4. **Exit Without Continuation** – user receives a summary and optional data export.

## 8. Phase Boundaries
- **No Overlap with Demo** – the trial never collects payment, personal data, or creates persistent entities; those responsibilities belong exclusively to Phase C.
- **Handover to Organization** – on successful conversion the trial data is frozen and handed off to the Organization phase.

---

> **Note:** This document has been updated to reflect current system limits as implemented in `server/services/accessPolicyService.js`. Previous version referenced outdated limits (30 days, 10,000 tokens) which have been superseded.

*Prepared by Antigravity – 2025‑12‑21*
*Updated: 2025‑12‑21 (system limits synchronization)*
