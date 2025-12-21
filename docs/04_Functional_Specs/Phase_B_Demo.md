# Phase B – Demo Experience Functional Specification

---

## 1. Purpose of Phase B

Phase B (Demo) provides a **controlled, free‑roam experience** that showcases the core value of **Consultinity** without allowing users to complete real work or persist any changes. The demo feels like a real consulting workflow, presents authentic‑looking outputs, and uses AI as a subtle guide rather than a decision‑making authority. It is explicitly **not** a trial; it never collects payment information, creates persistent entities, or triggers downstream processes.

---

## 2. Demo User Journey

| Step | Description |
|------|-------------|
| **Entry** | User arrives from Phase A (Landing) via the **Explore Demo** CTA. A temporary demo‑session identifier is generated and stored only in memory for the duration of the session. |
| **Exploration** | The user can navigate through the main product UI (reports, road‑maps, initiative views, etc.). All data shown is **sample/anonymized** and rendered in **read‑only** mode. AI‑driven tooltips, narration panels, and suggestion bubbles appear to explain context and demonstrate capabilities. |
| **Exit** | The session ends either when the user clicks **Finish Demo**, the inactivity timeout (5 min) fires, or the maximum session duration (15 min) is reached. A conversion modal is displayed (see Section 6). |

---

## 3. Demo Data Model

- **Sample Data Sets** – Pre‑generated JSON fixtures representing organizations, initiatives, assessments, and AI insights. They are loaded at session start and never written back to the production database.
- **Read‑Only Enforcement** – All UI components receive a `readOnly` flag. Buttons that would normally perform `POST/PUT/DELETE` are disabled and display a tooltip: *“Demo mode – actions are not persisted.”*
- **No Persistence** – No API calls that modify data are executed. Any attempted mutation is intercepted by a middleware that returns a `403` with a friendly message.
- **Anonymization** – Real customer identifiers are replaced with generic placeholders (e.g., `Acme Corp → Demo Corp`).

---

## 4. AI Behavior in Demo

| Role | Behaviour |
|------|----------|
| **Explainer** | Provides contextual information about UI elements, data fields, and product capabilities via hover tooltips and side‑panel narration. |
| **Narrator** | Guides the user through a predefined storyboard that highlights key value propositions (e.g., *“Here we generate a strategic roadmap based on assessment scores.”*). |
| **Guide** | Offers non‑committal suggestions (e.g., *“You could filter the report by ‘Q4 2024’ to see recent trends.”*). All suggestions end with a *“demo‑only”* disclaimer and never trigger an action. |

### Explicit Limitations
- **No Personalization** – AI does not store or recall user preferences across sessions.
- **No Decision Ownership** – AI never makes a final decision; it only proposes and explains.
- **No Data Persistence** – Any AI‑generated content is discarded when the session ends.
- **No External Calls** – AI operates on the static sample data; no external services are invoked.

---

## 5. Allowed vs Blocked Actions

| Category | Allowed | Blocked |
|----------|---------|---------|
| **Navigation** | Switching pages, applying filters, opening reports, viewing road‑maps. | – |
| **Data Interaction** | Viewing, sorting, searching sample data. | Creating, editing, deleting any entity (initiatives, reports, assessments). |
| **AI Interaction** | Receiving explanations, narrative guidance, suggestion prompts. | Triggering AI‑driven write‑back actions (e.g., *“Create initiative”*). |
| **Export/Download** | Viewing generated charts in‑app. | Exporting PDFs, CSVs, or any artifact that would imply real deliverables. |

---

## 6. Conversion Triggers

| Trigger | Condition | Resulting Conversion Path |
|---------|-----------|---------------------------|
| **Time‑based** | User spends **≥ 10 minutes** actively in the demo. | Show a **Trial Invitation** modal with a CTA to start a 14‑day trial. |
| **Interaction‑based** | User opens a **Report View** or **Road‑map** page. | Prompt to **Contact Sales** (email capture) for a deeper walkthrough. |
| **Moment‑based** | User reaches the **AI Narration “Key Insight”** step. | Display a **Start Trial** CTA directly in the narration panel. |
| **Inactivity Timeout** | No activity for **5 minutes**. | Show an **Exit** screen offering three options: **Start Trial**, **Contact Sales**, **Close Demo**. |

---

## 7. Exit & Escalation Behavior

1. **Automatic Termination** – When the session timer expires or the user clicks **Finish Demo**, the demo session is cleared from memory.
2. **Message** – *“Thank you for exploring Consultinity! Your demo session has ended.”*
3. **Next‑Step Options** – Three distinct buttons appear:
   - **Start a Free Trial** – Links to the trial onboarding flow (Phase C).
   - **Contact Sales** – Opens a pre‑filled contact form.
   - **Return to Homepage** – Takes the user back to the main landing page.
4. **Escalation** – If the user attempts a blocked action, a modal appears explaining the limitation and offering the same three next‑step options.

---

## 8. Phase Boundaries

- **Hand‑off from Phase A** – The **Explore Demo** CTA in the Phase A landing spec routes to the demo entry point defined in this document.
- **Hand‑off to Phase C** – Conversion triggers (time‑based, interaction‑based, or moment‑based) direct the user to the **Trial** flow (`Phase_C_Trial.md`).
- **No Overlap with Trial** – The demo never collects payment, personal data, or creates persistent entities; those responsibilities belong exclusively to Phase C.

---

## Definition of Done (DoD)
- `docs/04_Functional_Specs/Phase_B_Demo.md` exists with the full content above.
- No placeholders or TODOs remain.
- All sections are implementation‑ready for UI/UX and backend teams.
- Links from Phase A and the Product Lifecycle correctly reference this spec.

---

*Prepared by Antigravity – 2025‑12‑21*
