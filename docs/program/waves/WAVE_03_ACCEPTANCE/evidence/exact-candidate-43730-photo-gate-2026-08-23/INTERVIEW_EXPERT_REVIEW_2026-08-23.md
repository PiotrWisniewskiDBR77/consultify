# Interview — three-perspective expert review — 2026-08-23

Status: `NO-GO / PHOTOGRAPHIC GATE FAILED / FAIL_DATA_GATE`

## Evidence boundary

- candidate: `43730f86f8a74943c36a58b9ff07aa680a42aa3e`;
- dirty fingerprint: `e4bb10f8b18d0e0556f8d948da12eb776037765ab44de972113b68ca0ba0076a`;
- route/persona/state: `/discovery`, authenticated local OWNER, Inbox;
- screenshot: `03-interview.png`, 1280×720, dark EN;
- SHA-256: `09ba788b2001ad7502a7894f3a8d5bfc81b439162aaffcf6dce48ba09513a509`.

Historical exact-runtime evidence retained an owner fixture with two sessions,
six questions and active/revoked respondent links. The current exact-candidate
tenant scope exposes none of it. The prior owner approval covered the shared
table shape and upper menus; it did not approve empty data, current behavior or
the entire module.

## Review team

| Perspective | Reviewer | Scope |
|---|---|---|
| UX and visual system | independent UX reviewer | menus, table shell, scrolling, contextual empty states and visual canon |
| Business flow and methodology | independent flow reviewer | Template → Assign → respondent → approval → Insight → Initiative chain |
| Technical and integration | primary integration reviewer | scoped fixture, tokens, CAS, RBAC, API/DB lineage, provider failure and cold readback |

## Consensus findings

| ID | Type | Evidence and deviation from expected state | Severity | Required correction | Gates / verification |
|---|---|---|---|---|---|
| `INT-PHOTO-001` | Data gate blocker | All Inbox filters return `0`; the required two-session/six-question owner journey cannot be opened. | `P0` | Bind an idempotent, same-tenant exact-candidate fixture with draft/in-progress, submitted, sent-back and approved states plus active/revoked public links. Do not bypass tenant isolation. | `G01,G03–G05,G07–G10,G16–G20`; API, SQL and cold UI readback. |
| `INT-PHOTO-002` | Visible semantic defect | The active tab is Inbox, but the empty state says `No assignments`. Inbox and Assigned are separate product registers. | `P0/P1` | Give Inbox and Assigned distinct object-specific empty/loading/error/denied states and truthful CTAs. | `G06,G08–G10,G15,G16`. |
| `INT-PHOTO-003` | Visible layout defect | A large orphaned `INTERVIEW` element overlays the first part of the table header. | `P0` | Remove the phantom layer or integrate it as a correctly sized first-column header without overlap. | `G06,G08,G15,G16`. |
| `INT-PHOTO-004` | Visible standards defect | Counters appear inside Menu 2 tabs, although the current menu standard places contextual counters in Menu 3. | `P1` | Remove Menu 2 counters and render counts from the same scoped query as table filters only in the contextual line. | `G05,G06,G08,G13,G15,G16`. |
| `INT-PHOTO-005` | Visible layout defect | Two vertical scrollbars and a horizontal scrollbar are visible at 1280×720; nested shells compete for ownership. | `P0` | Establish one scroll owner, use `min-width:0`, responsive column sizing and one table/empty-state frame. | `G06,G08,G09,G15,G16,G20`; desktop/tablet/keyboard replay. |
| `INT-PHOTO-006` | Lifecycle blocker | No evidence covers `assigned/in progress → submitted → approved OR sent back → corrected resubmission`, including edit lock, version, actor, reason and history. | `P0 evidence blocker` | Replay both lifecycle branches on one record and database; prove frozen approved version and cold persistence. | `G02,G03,G05,G09,G10,G15–G18`. |
| `INT-PHOTO-007` | Downstream blocker | There is no proof that only the approved frozen response enters Insight and then exactly one governed Initiative. | `P0 evidence blocker` | Negative-test draft/submitted/sent-back, positive-test approved, and record immutable Interview → Insight → Initiative lineage/receipt. | `G02,G03,G05,G10,G15,G16,G18`. |
| `INT-PHOTO-008` | Assignment blocker | `Assign` is visible but template eligibility, ineligible reason, person/team, dates, priority, anonymity and exact-version snapshot are not proven. | `P0 evidence blocker` | Replay system/org/private template eligibility and immutable assignment snapshot with API/DB/cold UI proof. | `G02–G06,G10,G15,G16`. |
| `INT-PHOTO-009` | Respondent/token blocker | Consent, anonymity boundary, active/resumed session, answer CAS, submit, expired/revoked token and concurrent stale writer are absent. | `P0 evidence blocker` | Capture manager and isolated public respondent routes; verify active, revoked/expired `410`, stale zero-write and no organization-navigation leakage. | `G02–G06,G10,G15,G16`. |
| `INT-PHOTO-010` | Workspace blocker | The restored wide single-question workspace, transcript, evidence, notes, links and summary are not visible on this candidate. | `P0/P1 evidence blocker` | Capture question rail, broad answer canvas, progress/save/navigation, evidence and reload; confirm no `NModeShell` regression. | `G06,G09,G10,G16`. |
| `INT-PHOTO-011` | List/action blocker | Sessions, Assigned, Templates, Insights and Initiatives tables, paired context/kebab menus and six canonical previews cannot be inspected. | `P1 evidence blocker` | Capture nonempty tables, two lifecycle/RBAC states per action registry, and previews ordered `AI → Relations → Actions → Co dalej`. | `G05,G08–G10,G15,G16`. |
| `INT-PHOTO-012` | Creator blocker | Insight/Initiative creator geometry, recovery and Initiative steps Candidates/Governance/Result remain unproved. | `P0 evidence blocker` | Like-for-like complete creators: save/resume, typed AI failure, retry/manual continuation, approval, exactly-one output and lineage readback. | `G06,G09,G10,G13–G16,G20`. |
| `INT-PHOTO-013` | RBAC/persistence gap | Current image proves neither manager/respondent roles nor tenant isolation, CAS/idempotency, provider unavailable behavior or database persistence. | `P0 evidence blocker` | Replay owner/admin/direct/team/unrelated/inactive/foreign personas; retain request/object/version IDs, SQL rows and typed provider failure without fabricated score. | `G01–G05,G10,G15,G16`. |

## Protected design decisions

- Preserve the owner-approved overall six-table shape and upper-menu direction.
- Preserve the positively received Template editor; improve discoverability
  without redesigning it.
- Preserve the business mechanics of the Insight and Initiative creators while
  applying the canonical Creator Shell only after its prototype gate.

## Required current-candidate journey

`published Template version → Assign → consent/public respondent session →
answers/transcript/evidence → submit → send-back/resubmit or approve → frozen
approved Insight → governed Initiative → cold API/DB/UI readback`

The alternate branch must also prove revoked/expired token, stale CAS,
provider-unavailable recovery, denied/foreign access and exactly-once handoff.

## Smallest correction-and-retest sequence

1. Restore and read back the same-tenant owner fixture.
2. Fix contextual empty state, phantom header, Menu 2 counters and scroll ownership.
3. Capture all six nonempty table surfaces, action menus and previews.
4. Run Assign and the active/revoked respondent journey.
5. Run send-back/resubmit and approval with frozen-version readback.
6. Complete Insight and Initiative creators plus downstream lineage.
7. Reconcile `REC-INT-001–009` and `G00–G20`; then request owner verdict.

## Verdict

`NO-GO / DATA_SCOPE_BLOCKED / FUNCTIONAL_EVIDENCE_MISSING / NOT_OWNER_ACCEPTED`

The screenshot proves only that the empty shell renders. It does not prove the
Interview module or any remediation complete.
