# Broader Notes Acceptance Closeout Runbook

> Date: 2026-03-28
> Purpose: exact doc-update sequence to execute immediately after broader `Notes` is accepted
> Scope: documentation and control-board closeout only
> Status: ready

---

## 1. When to use this

Use this runbook only after both are true:

1. the next broader-notes packet has landed
2. the final residual assessment confirms that no smaller honest broader-notes packet remains before acceptance

Do not use this runbook while the lane is still mid-packet.

---

## 2. Inputs required before closeout

- the final broader-notes acceptance evidence number
- the final landed packet evidence number
- the final broader-notes residual assessment evidence number

If any of those are missing, stop and write the evidence first.

---

## 3. File-by-file update sequence

### File 1 - `docs/product/work-packets/POST_V81_BACKLOG_TRACKER.md`

Update the tranche board row for broader `Notes`:

- change status from `active` to `done`
- append the acceptance evidence reference
- replace `landed packets:` if needed so it includes the final packet list up to acceptance

Update the active lane checklist for broader `Notes`:

- mark `choose the next broader-notes packet...` as done if that packet was chosen and landed
- add checklist lines for the final packet and its focused regression
- add one line confirming the final residual assessment found no smaller honest packet
- add one line: `lane accepted and moved to done`

Update the change log:

- add the final landed packet entry
- add the final residual-assessment entry
- add the acceptance entry

### File 2 - `docs/product/work-packets/POST_V81_BACKLOG_DEBT_REDUCTION_PROGRAM.md`

In `## 9. Active execution slice`:

- rewrite the current result bullets so they include the final broader-notes packet, the final residual assessment, and the acceptance result
- change the lane wording from active execution language to accepted bounded-lane language

In `## 10. Route to 100%`:

- change broader `Notes` from `active` to `done`
- rewrite the row text so it no longer describes an active residual and instead describes what the accepted lane now covers
- update any summary line that still says broader `Notes` is the active broader lane

If there is no remaining visible backlog theme:

- make it explicit that the program can now be marked complete rather than `held`

### File 3 - `docs/product/work-packets/Plan V8.1 Final.md`

Update `Current success metric`:

- change `12 / 13` to `13 / 13`
- change `active lane` to `none`
- change `landed packets in the current active lane` to `0` or remove if you choose to keep the section minimal
- change `last accepted lane` to broader `Notes`

Update `Final queue to 100%`:

- change broader `Notes` row status from `active` to `done`

Update `Live control board`:

- set current lane status to `none`
- set lane to `none`
- set latest evidence to the broader-notes acceptance evidence
- set reason to a one-line closeout explanation
- empty `Next three lanes`
- empty `Active blockers` at the plan level unless a non-program blocker still intentionally remains listed

Update `Per-lane execution ledger` for broader `Notes`:

- set status to `done`
- set current packet to `none`
- set last accepted packet to the final landed packet
- set next action to hold the accepted lane unless a wider notes/output lane is explicitly promoted later
- set acceptance evidence to the final broader-notes acceptance evidence

### File 4 - broader-notes acceptance evidence

Use:

- `docs/product/work-packets/BROADER_NOTES_ACCEPTANCE_TEMPLATE_2026-03-28.md`

Fill in:

- evidence number
- final residual assessment reference
- final landed packet reference
- exact bounded scope that acceptance now covers

---

## 4. Expected final state after this runbook

After the runbook is complete, all of the following should be true:

- broader `Notes` is `done` in tracker, program, and plan
- `Plan V8.1 Final.md` shows `13 / 13`
- `Current lane` is `none`
- `Next three lanes` is empty
- the broader-notes acceptance evidence is linked from the control docs

---

## 5. Safety checks

Before ending the closeout pass, verify:

- no control doc still says broader `Notes` is `active`
- no control doc still says the next step is to choose the broader-notes packet
- no control doc still lists an old last accepted packet such as `508` if a newer packet was the actual final one
- the accepted lane is clearly capped and not described as a full notebook/attachment redesign

---

## 6. Optional paired move

If credential hygiene is also closed around the same time, immediately follow this runbook with:

- `docs/product/work-packets/PRODUCTION_CREDENTIAL_HYGIENE_CLOSEOUT_CHECKLIST_2026-03-28.md`
- `docs/product/work-packets/PRODUCTION_CREDENTIAL_HYGIENE_EVIDENCE_TEMPLATE_2026-03-28.md`
- `docs/product/work-packets/FINAL_CLOSEOUT_SEQUENCE_13_OF_13_AND_WIDER_GO_2026-03-28.md`

That allows the team to move from `13 / 13` straight into the final wider-production decision with minimal additional admin work.
