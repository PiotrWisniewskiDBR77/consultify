# Cross-app row menu policy — three-skeptic review

Status: `REVIEW_COMPLETE / POLICY_PARTIAL / IMPLEMENTATION_NOT_AUTHORIZED`

Date: 2026-08-22
Trigger: owner review of sparse right-click and kebab menus in Tools and Interview

## Executive verdict

Three independent reviews — UX/usability, domain/governance/security and
platform/design-system — reached the same conclusion:

> The existing canon is a strong interaction shell, but it is not yet a
> sufficient executable contract for domain-correct menus.

The primary defect is not the number of visible buttons. It is the absence of
one governed action catalogue and a mandatory matrix:

`entity × lifecycle state × persona/capability × source eligibility × surface`.

`RowActionsMenu` already provides a shared renderer and the normative contract
requires kebab↔right-click parity. Runtime consumers can still assemble local
action arrays, so a visually canonical menu can remain incomplete, divergent,
unauthorized or backed by a no-op. Adding actions locally before repairing this
governance layer would deepen the fork.

## Binding decisions for table row menus

1. **One governed registry.** Every action has one stable namespaced
   `actionId`, PL/EN label, icon, zone, entity scope, allowed surfaces,
   capability, permission and lifecycle predicate, required handler,
   confirmation/reversibility policy, async states, telemetry and audit policy.
2. **Exact kebab↔right-click parity.** Both triggers resolve the exact same,
   ordered descriptor set. Only the anchor and focus-return target differ.
3. **Preview and bulk are projections, not forks.** They may expose a declared
   subset, but the same `actionId` must retain the same meaning, permission,
   confirmation and handler on every surface.
4. **Domain matrix before UI completion.** Actions are derived from real
   lifecycle transitions, capabilities, source qualification and backend
   operations. They are never inferred from screenshots or added merely to make
   the menu look richer.
5. **No placeholders.** `Coming soon`, empty handlers and silent no-ops are not
   representable. A feature that does not exist is absent.
6. **Truthful availability.** A real but temporarily blocked action may remain
   disabled with a machine reason and a safe user-visible explanation available
   by pointer, keyboard and screen reader. Sensitive authorization failures are
   hidden or expressed without leaking tenant/object data.
7. **Governed mutations.** Backend authorization is authoritative. Mutations
   define version/concurrency handling, idempotency, pending/success/error,
   receipt/audit and refresh plus cold readback.
8. **Risk-aware destructive actions.** Archive, soft delete and irreversible
   delete are distinct. Destructive actions are isolated last and require a
   confirmation proportional to impact, including target and consequences.
9. **Task-based labels.** Generic `Chat`, `Open` and technical route names are
   replaced where needed by outcome labels such as `Continue session`,
   `Submit for review`, `Approve result`, `Send back for correction`,
   `Create insight`, `Generate report` or `Create initiative`.
10. **No action dumping ground.** Menus retain the canonical
    `context → manage → danger` structure. Usually 5–7 direct entries are the
    practical ceiling; conversions/targets use one governed submenu or picker.

## Canon conflicts to resolve

- The later, explicitly normative table-surface contract requires exact
  kebab↔right-click parity. Older iconography guidance allowing extra PPM
  actions applies only outside this table contract and must not be used to
  justify divergence.
- `Open` and `Preview` are currently ordered differently across older sources.
  Cross-app policy must define them once: keep both only when `Open full record`
  and `Preview` have genuinely different, tested effects; otherwise retain one.
- Disabled reasons cannot live only in test/audit metadata. The label remains
  clean, but the safe explanation must be perceivable by all input modes.

## Governed action descriptor — required minimum

Each action catalogue row records:

`actionId | entity | states | roles/capability | source eligibility | surfaces |
visible/disabled/hidden rule | safe reason code | label PL/EN | icon | zone |
handler/API | target state | risk | confirmation | reversibility | concurrency |
idempotency | pending/success/error | readback | telemetry | audit event`.

The server must revalidate tenant, membership, capability, object identity,
version, lifecycle and source lineage. Frontend visibility is never authority.

## Two implementation recommendations — required order

### RM-01 — Platform Action Registry + parity enforcement

Extend the current model into one governed cross-app registry and adapters for
StandardTable, kebab, right-click, Preview Actions and bulk. Add CI checks for
duplicate IDs, missing handlers, placeholders, capability mismatch, telemetry
omission, raw local menus outside an explicit allowlist and parity drift.

### RM-02 — Menu completeness audit and domain rollout

After RM-01, inventory every surface and reconcile it against the business
matrix. Pilot Tools and Interview, then cover the previously recorded hotspots
including Sejf, Run Agent and Documents/Sheets. Classify every entry as
`PASS`, `MISSING`, `DIVERGENT`, `DEAD_NOOP`, `DUPLICATE`, `WRONG_GATING`,
`WRONG_SURFACE` or `UNVERIFIED`.

## Acceptance v1

A surface passes only when:

- kebab and right-click match on the exact ordered resolved descriptors;
- every visible action has a real handler and server-side authorization;
- entity/state/persona/source matrices cover normal, review, approved/final,
  archived, locked and no-access states;
- lifecycle, generator, archive/restore and destructive mutations are
  idempotent where required and survive refresh plus cold readback;
- denial, stale version, conflict, timeout, retry and partial failure are
  truthful and cannot double-execute;
- audit captures actor, tenant, action, object/version, before/after, surface,
  request/idempotency ID and result without sensitive telemetry payloads;
- downstream insight/report/initiative actions reject draft, stale,
  foreign-tenant or otherwise ineligible sources;
- keyboard support includes Shift+F10, arrows, Home/End, Enter/Space, Escape,
  typeahead, submenu navigation and correct focus return;
- viewport clamp/flip, touch alternative, PL/EN, light/dark, 200% zoom and
  compact viewport preserve every available action;
- evidence is SHA-bound and includes descriptor snapshot, both triggers,
  handler/API trace, permission cases, mutation readback and telemetry.

## Review disposition

- UX/usability skeptic: `PARTIAL / DOMAIN MATRIX AND DISCOVERABILITY MISSING`
- governance/security skeptic: `PARTIAL / GOVERNED SERVER CONTRACT MISSING`
- platform/design-system skeptic: `PARTIAL / LOCAL ACTION FORKS REMAIN`
- Combined: `POLICY_EXTENSION_REQUIRED_BEFORE_CROSS_APP_ROLLOUT`
