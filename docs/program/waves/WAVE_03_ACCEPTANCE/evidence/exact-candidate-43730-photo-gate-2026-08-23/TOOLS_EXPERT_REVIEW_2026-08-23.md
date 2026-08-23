# Tools — three-perspective expert review

Date: 2026-08-23  
Candidate: `43730f86f8a74943c36a58b9ff07aa680a42aa3e`  
Screenshot: `04-tools.png`  
SHA-256: `fcbf50127ecdf3c6238d28127034d5b3e6bac0bc7604f7cadd2e261f093a25c4`  
Route: `/discovery-tools?tab=library`  
Viewport/theme: `1280×720`, desktop, dark  
Review perspectives: UX/visual system; consulting flow/methodology; technical integration/data/RBAC.

## Verdict

`NO-GO / VISUAL_REGRESSION / DOMAIN_FLOW_NOT_IMPLEMENTED / EXACT-CANDIDATE_E2E_NOT_PROVEN / NOT_OWNER_ACCEPTED`

The photograph proves only that the Library shell renders on the exact candidate. It does not prove menu handlers, persistence, approval, RBAC, lineage, cold readback or any downstream journey. The current implementation also contradicts the canonical four-class value chain: native `Outputs`, interpreted `Insights`, publishable `Reports`, actionable `Initiatives`.

## Atomic correction register

| ID | Priority | Class | Evidence / defect | Required correction | Closure evidence | Gates |
|---|---:|---|---|---|---|---|
| `TLS-XPR-001` | P0 | Visible visual defect | The active first record does not show the Dynamic SWOT name. A large bordered body element labelled `TOOLS` occupies the Tool cell while its tags, licence and status render normally. | Restore the canonical tool identity; remove the orphan overlay/body header; preserve correct focus and selected-row geometry. | Before/after image plus keyboard/focus and cold catalog readback. | G06, G08, G09, G14–G18 |
| `TLS-XPR-002` | P1 | Visible visual defect | Most tool names and at least one tag are truncated despite a wide desktop viewport. | Make tool identity primary: rebalance columns, allow at most two lines, and provide an accessible full-name disclosure. | Desktop/tablet images and keyboard-accessible name verification. | G06, G08, G15, G16 |
| `TLS-XPR-003` | P1 | Visible visual defect | Dark-mode text, `In development` chips, checkboxes and metadata have very low contrast and appear disabled. | Use canonical contrast tokens and distinguish unavailable, inactive and interactive states. | Token inspection, axe/contrast result and state images. | G06, G10, G15, G16 |
| `TLS-XPR-004` | P1 | Product semantics | Rows simultaneously show `In development` and `Inactive` without explaining whether these represent readiness, availability or lifecycle. | Establish one domain vocabulary or explicitly separate availability from lifecycle with a descriptor and reason. | Contract update, mapped API values and UI state replay. | G02, G08, G09, G13–G16 |
| `TLS-XPR-005` | P1 | Visible visual defect | The runtime badge overlaps the bottom table row; filter/view icons do not visibly expose active state; empty `Other 0` adds noise. | Move the local marker to a non-content safe area; use labelled/selected controls; hide or disable empty filters with a reason. | 1280/1440/tablet images and accessible-name/state checks. | G01, G06, G10, G15, G16 |
| `TLS-XPR-006` | P0 | Information architecture | Menu 2 shows `Library / Sessions / Outputs / Reports / Initiatives`; `Insights` is absent. The register simultaneously requires four distinct downstream classes, so the current 5-versus-6-surface contract is unresolved. | Owner decision: navigation stages and domain classes must be explicitly mapped. Recommended domain vocabulary: Tool Definition → Session → native Output → Insight → Report or Initiative. Update one canonical source before implementation. | Reconciled owner decision and one updated SSOT used by route and API contracts. | G00, G02, G08, G09, G12, G13 |
| `TLS-XPR-007` | P0 | Technical/domain defect | The current `outputs` list is not Tool Outputs or Insights; it merges Assessment reports, Report Builder records and Presentation decks. | Create a real immutable Tool Output model/catalog and a separate interpreted Insight model/catalog with source version and approval lineage. | Schema/API tests and browser/API/DB cold readback from an approved Tool session. | G02, G05, G09, G14–G18 |
| `TLS-XPR-008` | P0 | Technical/domain defect | `Reports` filters the same in-memory `outputs` array and has no independent fetch or persistence boundary. | Implement a distinct report registry and generation receipt for DOCX/PPTX/XLSX, with owner, lifecycle, source versions, template and provenance. | Generated artifact, API/DB receipt, reopen/download and source lineage proof. | G02, G05, G09, G14–G18 |
| `TLS-XPR-009` | P0 | Lifecycle defect | Sessions are filtered to `DRAFT` and `PENDING_REVIEW`; approved/frozen sessions disappear even though they are the eligible sources for downstream work. | Show the complete governed lifecycle and expose a server-authoritative source-eligibility query. | Draft, review, sent-back, approved and frozen fixtures plus positive/negative eligibility replay. | G02–G05, G09, G10, G15–G18 |
| `TLS-XPR-010` | P0 | Flow/lineage gap | There is no exact-candidate proof of `approved Session → immutable Output → Insight → Report/Initiative`. Existing lists load unrelated legacy artifacts. | Implement one versioned, idempotent lineage chain with human approval and no implicit promotion. | RealPG/API/browser cold replay with every object/version ID and exactly-once checks. | G02, G05, G09, G10, G15–G18 |
| `TLS-XPR-011` | P0 | RBAC/capability gap | The hub does not expose a governed capability contract; submit-for-review issues a direct status PATCH and relies on backend rejection instead of state/persona-aware actions. | Introduce server-authoritative available commands and a persona × lifecycle × action matrix; use the shared governed Action Registry. | Allow/deny API and UI tests for owner, participant, reviewer, inactive and foreign tenant. | G03, G05, G09, G10, G15–G18 |
| `TLS-XPR-012` | P0 | Exact-baseline gap | Historical G01–G06 evidence in `MODULE_ACCEPTANCE.md` refers to another SHA, runtime and database. It cannot qualify candidate `43730...`; the candidate also contains intentional uncommitted integration work. | Freeze a later clean candidate only after remediation, bind process/DB/auth/tenant/migrations, then repeat the bounded Tools replay. | Immutable manifest, clean SHA, runtime coordinates, DB proof and indexed evidence. | G01, G04–G06, G14–G18 |
| `TLS-XPR-013` | P1 | Action ambiguity | `Add tool` is dominant but does not say whether it creates a definition, licenses a tool, or starts a session. Checkboxes likewise expose selection without a proven bulk-action contract. | Rename and capability-gate the real action; either provide governed bulk actions or remove selection affordance. | Role/state matrix, handler tests and readback of resulting state. | G00, G02, G03, G05, G09, G15 |
| `TLS-XPR-014` | P0 | Evidence gap | Only Library/desktop/dark is photographed. Sessions, Output, Insight, Report, Initiative, detail, preview, menus, workspace, alternate states, PL/EN, light and tablet remain unverified. | Produce the complete indexed photo/browser packet after data and flow are connected; do not infer functionality from this screenshot. | Exact-candidate photographs plus console/HTTP/API/DB and cold-readback evidence. | G06, G09–G11, G15–G20 |

## Protected owner-approved elements

- Preserve the accepted Library/Sessions table shell rather than redesigning the module wholesale.
- Preserve the accepted Tool Detail composition in light and dark.
- Preserve the accepted Preview visual layer; improve its content contract separately.
- Reuse the canonical Initiative Creator rather than making a Tools-specific creator shell.

These protections do not override the visible regression in the first Library row or the unresolved domain flow.

## Gate assessment on this candidate

| Gate range | Assessment |
|---|---|
| G00 | `PARTIAL` — scope exists, target IA remains contradictory. |
| G01 | `FAIL / EXACT BASELINE NOT PROVEN` — historical evidence is from a different SHA/runtime/DB. |
| G02 | `FAIL` — no correct end-to-end Tool value chain. |
| G03–G05 | `HISTORICAL OR PREFLIGHT ONLY / NOT PROVEN ON 43730`. |
| G06 | `PARTIAL_DESKTOP_DARK_VISUAL / DEFECTS OPEN`. |
| G07 | `READY_MATERIALS_ONLY`. |
| G08–G09 | `FAIL / OWNER FINDINGS AND JOURNEY OPEN`. |
| G10 | `NOT_STARTED`. |
| G11 | `PARTIAL` — current photo and review are registered, full surface denominator is missing. |
| G12 | `OWNER_RECONCILIATION_PENDING`. |
| G13 | `PARTIAL / CANON CONFLICT REQUIRES DECISION`. |
| G14–G20 | `NOT_PROVEN / NOT_STARTED`. |

## Required closure order

1. Reconcile navigation stages against the four domain classes.
2. Establish real Output, Insight and Report persistence/API boundaries.
3. Restore the complete Session lifecycle and eligibility rules.
4. Connect immutable lineage and the shared Initiative Creator.
5. Apply capability/RBAC and shared Action Registry contracts.
6. Fix the Library visual regressions without replacing protected baselines.
7. Freeze a clean candidate and run the bounded exact-runtime replay.
8. Capture before/after evidence and obtain explicit owner retest decisions.
