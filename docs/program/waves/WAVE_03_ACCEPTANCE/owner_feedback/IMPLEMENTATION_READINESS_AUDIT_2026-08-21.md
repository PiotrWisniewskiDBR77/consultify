# Wave 3 — implementation-readiness audit

Audit date: `2026-08-21`

Scope: `Organization / Admin / Settings` documentation under this owner-feedback
area. Product code, tests and runtime were not inspected or changed.

## Result

`IMPLEMENTABLE_WITH_EXPLICIT_GATES / NOT OWNER-COMPLETE`

The packet is sufficiently structured for agents to begin controlled inventory,
shared-shell work and owner-explicit requirements. It is not authority to invent
answers to the open product/security/commercial decisions in `DECISION_REGISTER.md`,
and it is not proof that any runtime behavior has passed.

## Corrections made by this audit

1. Resolved the documentation conflict between earlier autosave proposals and the
   later explicit owner requirement: editable screens use one authoritative
   `Save Changes` action in the canonical header slot. Draft protection may exist,
   but cannot impersonate a server-confirmed save.
2. Added traceability for `XMOD-OWN-002–006` and `SET-OWN-001`.
3. Expanded the visual audit from grouped Admin/Settings domains to one row per
   canonical child screen: `109` separate review targets.
4. Preserved all runtime and owner-acceptance states as unverified; no smoke test,
   screenshot or specification is treated as acceptance.
5. Defined the execution order and minimum evidence bundle below.

## Binding baseline for replay

- Intended owner-replay runtime: `http://127.0.0.1:3957`
- Candidate SHA: `97e8ab0116d95ed3db0c3c7fa53b4f0e0ed09717`
- The supplied recent screenshots came from a different ambient runtime context;
  they are design/issue evidence only, not exact-SHA acceptance proof.
- Before implementation or verification, an agent must record repository root,
  branch, HEAD SHA, dirty-state fingerprint, runtime URL, build SHA displayed by
  the runtime, viewport, role and organization fixture.
- Any mismatch stops acceptance claims and is reported as `BASELINE_MISMATCH`.

## Authority order

If documents appear to conflict, agents apply this order:

1. latest verbatim owner observation in an `OWNER_FEEDBACK_REGISTER.md`;
2. explicit integrator/owner decision in `DECISION_REGISTER.md`;
3. `FINAL_THREE_MODULE_CONTRACT.md`;
4. module `FINAL_IMPLEMENTATION_SPEC.md`;
5. derived blueprints and expert proposals.

`PROPOSED_UNRECONCILED` material is design input, not permission to decide product,
security, commercial or operating policy.

## Work packages and gates

| Order | Work package | Entry condition | Required output | Gate |
|---:|---|---|---|---|
| 0 | Baseline and route inventory | correct repo available | exact route/screen/component/token map; role fixtures; mismatch report | no implementation claim before baseline match |
| 1 | Shared shell foundation | package 0 complete | shared container, sidebar hierarchy, breadcrumb, header action slot, typography and semantic visual tokens | cross-module component tests plus visual evidence |
| 2 | Owner-explicit removals | shared shell available | remove Organization Megatrends/Administration and Settings floating Help shortcut | route-wide absence, keyboard and accessibility-tree checks |
| 3 | Organization reconstruction | applicable Organization decisions resolved | canonical child screens, Files and Readiness behavior, persistence/readback | Organization AC packet and owner replay |
| 4 | Settings standardization | effective Admin-policy interfaces known | canonical Settings child screens and explicit header save | Settings AC packet and owner replay |
| 5 | Admin reconstruction | relevant RBAC/billing/platform decisions resolved | seven domains with real authorization, readback and audit behavior | domain-by-domain security/functional evidence |
| 6 | Card-by-card visual replay | target screens reachable | all `VIS-*` rows completed on exact SHA with before/after evidence | `109/109` reviewed; no missing applicable states |
| 7 | Final owner gate | all prerequisite packets pass | exact-SHA Organization → Admin → Settings replay record | only explicit integrator result may mark accepted |

Parallel work is allowed only where packages do not edit the same shell/token
foundation or depend on an unresolved decision. The shared foundation must have one
integration owner.

## Atomic work-item template

Every agent task derived from this packet must state:

- requirement and acceptance-criterion IDs;
- exact route(s), role(s), organization fixture and viewport(s);
- current behavior and expected behavior;
- named shared components/tokens to reuse after inventory;
- mutation preconditions and test data;
- expected UI receipt, API/database/provider readback and audit event;
- negative authorization case;
- required screenshot/artifact filenames;
- rollback/recovery expectation;
- completion status from the controlled vocabulary.

An agent must not receive only “standardize this module”.

## Minimum evidence bundle

For a visual-only criterion:

1. exact SHA/runtime/viewport/role metadata;
2. route and screen ID;
3. before and after screenshot;
4. keyboard/focus and 200% zoom result;
5. PL/EN and compact-layout result where applicable;
6. linked `VIS-*` and AC IDs.

For a mutation criterion, additionally:

1. authorized UI action and durable receipt;
2. unauthorized-role negative result;
3. API/database/provider readback;
4. audit event with actor, target, result and timestamp;
5. persistence after refresh or cold session;
6. error-path proof that entered data is preserved.

## Open gates that agents may not decide

The following remain in `DECISION_REGISTER.md` and block only their dependent work:

- `ORG-DEC-001`: final Organization modules and child names;
- `ORG-DEC-002`: canonical Knowledge Graph placement;
- `ORG-DEC-003`: readiness formula, blockers and authority;
- `ORG-DEC-004`: legal entity/group/unit/perimeter scope;
- `ORG-DEC-005`: business facts vs organization AI policy vs personal settings;
- `ADM-DEC-001`: RBAC, dual approval and break-glass;
- `ADM-DEC-002`: Customer Admin vs Platform Operations;
- `ADM-DEC-003`: Billing self-service boundary;
- `ADM-DEC-004`: Command Center vs System Health boundary;
- `ADM-DEC-005`: canonical ownership across Organization/Admin/Settings.

Shared-shell, breadcrumb, width, typography, colour, border/background standards and
the three explicit removals can proceed without silently closing these decisions.
Dependent business/security behavior cannot.

## Stop conditions

Agents stop and report instead of guessing when:

- candidate SHA/runtime/role/organization does not match;
- a required route or backing capability does not exist;
- two canonical writers exist for one object;
- server acknowledgement/readback is unavailable;
- authorization, audit or provider truth cannot be verified;
- an open decision materially changes the implementation;
- evidence cannot be linked to the exact requirement and candidate.

## Documentation completeness statement

Complete now:

- owner observations and preserved wording;
- evidence indexes and hashes for supplied screenshots;
- shared shell/width/typography/breadcrumb/save/visual contracts;
- three module maps and functional boundaries;
- atomic traceability for current explicit observations;
- individual visual-review targets for all 109 proposed canonical child screens;
- execution order, evidence requirements and stop conditions.

Not complete by design:

- answers to the 10 open owner decisions;
- exact-current route/component/token inventory;
- implementation, test, readback and audit evidence;
- exact-SHA owner replay and acceptance result.

Therefore the correct handoff state is
`READY_FOR_CONTROLLED_IMPLEMENTATION_AND_DECISION_CLOSURE`, never `ACCEPTED`.
