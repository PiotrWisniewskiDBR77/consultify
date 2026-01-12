# State Machine Technical Specification

**Last Updated:** 1 January 2026  
**Reference File:** `server/services/statusMachine.js`  
**Authority:** PMO Governance Engine

This specification defines the rigorous state transition rules enforced by the Consultinity governance engine. It serves as the authoritative source for backend validation and frontend UI state management.

---

## 1. Initiative Lifecycle

The initiative state defines which module "owns" the object. Transitions across modules gated by specific business rules.

| Current Status | Allowed Transitions | Crossing Module? | Validation Rules |
| :--- | :--- | :--- | :--- |
| **DRAFT** | PLANNING, CANCELLED | Yes (to M3) | Initial creation in Assessment (M2). |
| **PLANNING** | REVIEW, DRAFT, CANCELLED | No | Moves to Initiative Management (M3). |
| **REVIEW** | APPROVED, PLANNING, CANCELLED| No | Requires `pendingReviews == 0`. |
| **APPROVED** | EXECUTING, PLANNING, CANCELLED| Yes (to M4) | Governance lock. Ready for Execution (M4). |
| **EXECUTING** | BLOCKED, DONE, CANCELLED | No | Core work module. |
| **BLOCKED** | EXECUTING, CANCELLED | No | Requires `blockedReason`. |
| **DONE** | ARCHIVED | No | Requires `pendingTasks == 0`. |
| **CANCELLED** | ARCHIVED | No | Terminal logic reset. |
| **ARCHIVED** | [NONE] | No | Read-only historical state. |

---

## 2. Task Lifecycle

Tasks within an initiative follow a simplified, high-velocity logic.

| State | Transition To | Rule / Behavior |
| :--- | :--- | :--- |
| **TODO** | IN_PROGRESS, BLOCKED | Initial state of suggested tasks. |
| **IN_PROGRESS** | BLOCKED, DONE, TODO | Active ownership by a Team Member. |
| **BLOCKED** | TODO, IN_PROGRESS | Requires `blockedReason` and `blockerType`. |
| **DONE** | IN_PROGRESS | Completes contribution to Initiative progress %. |

---

## 3. Module Boundary Rules

### M2 (Assessment) to M3 (PMO)
- **Trigger**: Transition `DRAFT` → `PLANNING`.
- **System Action**: Transfers initiative from the Diagnosis context to the Project Management Office (PMO) registry.
- **Requirement**: Initiative must be linked to a valid `assessment_axis`.

### M3 (PMO) to M4 (Execution)
- **Trigger**: Transition `APPROVED` → `EXECUTING`.
- **System Action**: Activates Task Tracking and KPI Measurement.
- **Requirement**: `approvalThreshold` must be met; all designated `owners` must be notified.

---

## 4. Constraint Definitions
1. **Blocked Transition**: Transition to `BLOCKED` (Initiative or Task) is invalid without a string payload in `context.blockedReason`.
2. **Completion Lock**: An Initiative cannot transition to `DONE` if any children tasks remain in `TODO`, `IN_PROGRESS`, or `BLOCKED`.
3. **Draft Reversion**: Reverting from `APPROVED` to `PLANNING` resets the `stageGate` audit but preserves the historical `planning_history`.
