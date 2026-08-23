# My Work — three-perspective expert review — 2026-08-23

Status: `NO-GO FOR OWNER RETEST / FAIL_DATA_GATE`

## Evidence boundary

- candidate: `43730f86f8a74943c36a58b9ff07aa680a42aa3e`;
- dirty fingerprint: `e4bb10f8b18d0e0556f8d948da12eb776037765ab44de972113b68ca0ba0076a`;
- route/persona/state: `/my-work`, authenticated local OWNER, Inbox;
- screenshot: `02-my-work.png`, 1280×720, dark EN;
- SHA-256: `c12db30d4acd021877c8cd5b9280d98779fc57f104d6c71350247e05ba2ceab8`.

The active database contains My Work records in other synthetic organizations,
but the active `dbr77` OWNER scope returns zero. Rows from another tenant must
not be exposed to make the screen appear populated. The required remedy is a
controlled, idempotent, same-tenant exact-candidate fixture or overlay, not an
RBAC bypass or destructive reset.

## Review team

| Perspective | Reviewer | Scope |
|---|---|---|
| UX and visual system | independent UX reviewer | menu, overflow, empty state, hierarchy and accessibility affordances |
| Business flow and methodology | independent flow reviewer | Tasks, Decisions, Ideas, Notebook and governed Agent journey |
| Technical and integration | primary integration reviewer | tenant/owner scoping, fixture binding, API/DB/RBAC/CAS and cold readback |

## Consensus findings

| ID | Type | Evidence and deviation from expected state | Severity | Required correction | Gates / verification |
|---|---|---|---|---|---|
| `MYW-PHOTO-001` | Data gate blocker | All counters are `0` and only the empty Inbox is available, while the canonical replay requires an OWNER task, decision, governed proposal, approval/materialization receipt and completed task. | `P0` | Add a controlled same-tenant owner fixture/overlay without changing fixture guards, resetting the database or exposing foreign rows. Bind it to the exact candidate and manifest. | `G01,G03–G05,G07–G10,G16–G20`; API and SQL fixture readback before browser capture. |
| `MYW-PHOTO-002` | Truth defect | `Inbox is empty — zero backlog! Everything processed. Great job!` represents success even though zero may result from tenant scope, missing fixture, API error or unavailable data. | `P0` | Render success only after an authorized successful query proves genuine zero. Provide distinct loading, API error, denied, unavailable/configuration and true-empty states. | `G05,G06,G09,G10`; network-state and browser-state replay. |
| `MYW-PHOTO-003` | Visible defect | The second-level menu overflows at 1280 px and exposes a native horizontal scrollbar; controls are compressed at the right edge. | `P1` | Define menu priorities and a canonical `More`/overflow or safe responsive grouping; remove the native scrollbar. | `G06,G16,G17,G20`; 1280, 1440 and tablet. |
| `MYW-PHOTO-004` | Visible defect | A large bordered `MY WORK` element remains below the filters with no understandable role. | `P1` | Give it a clear selector/control contract and correct placement, or remove it if it has no unique function. | `G08–G10,G13–G16,G20`; action and accessibility audit. |
| `MYW-PHOTO-005` | Visible defect | A nested vertical scroll gutter is visible on the left despite the empty surface; together with the horizontal menu bar it makes the viewport appear broken. | `P1` | Establish one owned scroll container and verify it in empty, table and open-workspace states. | `G06,G10,G15–G17,G20`. |
| `MYW-PHOTO-006` | UX/accessibility risk | Zero-count filters have disabled-like contrast, without a clear distinction between available-zero and disabled. | `P2` | Define selected, available-zero, hover/focus and disabled tokens and semantics. | `G06,G10,G15–G17`. |
| `MYW-PHOTO-007` | Acceptance blocker | The main journey — open Task/Decision, understand requester versus approver, perform an allowed transition, refresh and cold reopen — cannot be executed. | `P0 evidence blocker` | Seed active, blocked/overdue, action-required and Done tasks plus pending/approved decisions; capture row, preview, full detail, mutation and readback. | `G02,G04,G05,G07,G09,G15–G20`. |
| `MYW-PHOTO-008` | Acceptance blocker | Governed Agent proposal → distinct approver → exactly one Task/Decision/Notebook → receipt, idempotent replay and denial paths are not visible or proven. | `P0 evidence blocker` | Replay OWNER/requester/MEMBER/revoked/foreign; prove self-approval denial, zero foreign rows, exactly-one materialization, receipt and stale/duplicate zero-write. | `G02–G05,G09,G10,G15–G20`. |
| `MYW-PHOTO-009` | Acceptance blocker | Ideas, Notebook, Tasks and Decisions buttons render, but the P0 owner changes and `MYW-DEC-REC-001` cannot be inspected. | `P0/P1 evidence blocker` | Capture each submodule: Ideas panels/conversion, Notebook blocks/context/search, Tasks including Done, Decisions starting directly with the canonical table. | `G05,G08–G17,G20`. |
| `MYW-PHOTO-010` | Persistence/RBAC gap | No mutation request/response, CAS version, reload, cold login, SQL readback, stale `409` or denied zero-write evidence exists for this candidate. | `P0 evidence blocker` | Preserve an atomic receipt for every mutation and execute allowed/denied/stale/foreign checks without weakening tenant isolation. | `G02–G05,G10,G15–G18`. |
| `MYW-PHOTO-011` | Coverage gap | Only dark EN desktop and true-or-apparent empty state is captured. | `P1 gate gap` | After restoring the correct data fixture, cover the smallest PL/EN, theme, tablet, keyboard and alternate-state matrix. | `G06,G10,G11,G16,G17,G20`. |

## Minimum nonempty replay fixture

- Inbox: task, decision, proposal/notification and Done record;
- Tasks: active, blocked/overdue, action-required and completed;
- Decisions: pending OWNER approval, approved and MEMBER-denied;
- Ideas: one expandable idea with evidence and a governed conversion;
- Notebook: one document with native blocks, relations and history;
- Agent: one approved exactly-once materialization and its receipt.

Every record must belong to the active local owner-review organization, remain
synthetic/reconstructible and carry deterministic identifiers.

## Smallest correction-and-retest sequence

1. Build/read back the idempotent exact-candidate owner overlay.
2. Fix false-success state separation and the three visible overflow/layout
   defects.
3. Capture the nonempty Inbox, row menu, preview and full-detail transition.
4. Run one allowed mutation plus refresh, cold login and SQL readback.
5. Replay the governed Agent and persona/tenant denial boundaries.
6. Capture Ideas, Notebook, Tasks and Decisions against their owner registers.
7. Reconcile `G00–G20`; request owner verdict only after the packet is complete.

## Verdict

`FAIL_DATA_GATE / VISIBLE_OVERFLOW_DEFECTS / OWNER_REVIEW_NOT_POSSIBLE`

The current image proves the shell and an apparent empty state only. It cannot
support `PASS`, `FIXED` or `OWNER_ACCEPTED`.
