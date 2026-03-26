# Post-V8/V8.1 Backlog Debt Reduction Program

> Status: active debt-reduction program
> Owner: Manager Agent
> Scope: post-closure backlog reduction after the frozen `V8 + V8.1` wave
> Authority inputs: `docs/product/work-packets/V8_V81_CLOSURE_LEDGER.md`, `docs/product/work-packets/V8_V81_FINAL_SIGNOFF_MEMO.md`, `docs/product/work-packets/V8_V81_FINAL_GO_DECISION.md`, `docs/product/work-packets/V8_V81_WAVE_CLOSURE_DECLARATION.md`
> Last updated: 2026-03-26

---

## 1. Purpose

This document is the operating program for reducing backlog and technical/product debt **after** the formal closure of the frozen `V8 + V8.1` wave.

It exists to ensure that:

- the closed wave is not silently reopened under the label of "small finishing work",
- debt is classified honestly instead of mixed into one undifferentiated queue,
- only one tranche at a time is promoted into active execution,
- and each promoted slice has the same acceptance discipline as the closure wave: runtime truth, surface truth, regression, and evidence.

This document does **not** replace area SSOTs. It sequences them.

---

## 2. Program goals

The program has five goals:

1. close or formally retire the remaining bounded closure residue,
2. remove the most expensive split-brain paths between V8 and legacy runtime truth,
3. promote selected `hold bounded` lanes into explicit parity tranches one at a time,
4. keep deferred work visible without silently pulling it back into execution,
5. move the platform from closure-mode into clean tranche-based delivery.

---

## 3. Debt taxonomy

All backlog items must be classified before implementation starts.

### `T0` - Closure residue

Bounded proof/runtime gaps that survived final sign-off.

Current items:

- `Calendar`
- `Organization / Admin / Superadmin`

### `T1` - Structural split-brain

Areas where API, UI, or runtime truth are still split across legacy and V8/V8.1 paths.

Current items:

- `Reports / Presentations`
- `Idea workspace`
- any lane where the user-facing happy path still depends on legacy truth

### `T2` - Promoted parity tranche

Lanes previously accepted as `hold bounded` that now require explicit promotion into active delivery.

Current items:

- `Chat`
- `AI core`
- `Execution / delivery control`
- `Results / KPI / ROI`
- `Finance`
- `Partner Program`
- `Sync / connectors / interoperability`
- `Multiplayer / collaboration`

### `T3` - Adjunct and side-lane debt

Non-core side lanes that are real backlog but should not reopen already accepted core slices.

Current items:

- `Notes` adjuncts (`ai-proposals`, `classify`, upload/convert)
- object-linked outputs breadth not required by current package acceptance

### `T4` - Explicitly deferred product backlog

Visible backlog that remains outside execution until separately approved.

Current items:

- `Mobile`
- broad `Landing page` redesign
- broad `Communication` expansion
- standalone `Edukacja` outside KB
- `sheet` chat-driven `ArtifactRun` materialization parity

---

## 4. Tranche order

The backlog must be executed in ordered tranches.

### Tranche 0 - Exception burn-down

Goal:

- finish or formally retire `T0` closure residue

Included now:

- `Calendar`
- `Organization / Admin / Superadmin`

Out of scope:

- broad parity
- new UI programs
- lifecycle expansion disguised as proof work

### Tranche 1 - Split-brain removal

Goal:

- convert structurally ambiguous runtime paths into one explicit source of truth

Candidate lanes:

- `Reports / Presentations`
- `Idea workspace`
- any confirmed V8/legacy mixed happy path

### Tranche 2 - Promoted parity

Goal:

- pick **one** former `hold bounded` lane and expand it deliberately

Promotion rule:

- no lane enters Tranche 2 without a short written charter describing why it is being promoted now and what remains explicitly out of scope

### Tranche 3 - Adjuncts and polish

Goal:

- close bounded side lanes only after Tranche 1 or Tranche 2 slices are stable

### Parking lot

Everything in `T4` stays visible but not executable until explicitly promoted.

---

## 5. Three-agent operating model

This program runs with three active agents plus one manager decision layer.

### Agent A - Program and acceptance

Owns:

- tranche queue
- taxonomy classification
- definition of done
- acceptance rules
- evidence linkage
- promotion and defer decisions

Primary output:

- one trusted debt program and one current execution slice

### Agent B - Runtime and contract closure

Owns:

- backend routes and services
- API clients
- fallback correctness
- schema/runtime alignment
- regression tests at route/service/client level

Primary output:

- one clean runtime path per promoted slice

### Agent C - Surface and proof closure

Owns:

- frontend wiring
- operator/user-facing coherence
- staging/browser/API proof
- evidence freshness
- no-legacy-fallback confirmation where relevant

Primary output:

- visible surfaces backed by the intended runtime truth

### Manager rules

- only the manager promotes a tranche,
- only the manager declares a slice accepted,
- and only the manager may move a lane back to parking or defer.

---

## 6. Sequencing rules

1. `T0` residue first.
2. No Tranche 2 promotion until Tranche 0 is either cleared or formally risk-accepted.
3. Only one major parity tranche may be active at a time unless two lanes are proven independent.
4. Split-brain cleanup wins before deeper writes in the same lane.
5. Regression containment is always allowed; scope expansion is not.

---

## 7. Definition of done

No backlog item is done unless it returns all of the following:

- bounded scope statement,
- real runtime path,
- real surface using that path,
- automated regression for the bounded slice,
- environment proof or explicit note why it was not obtainable,
- open risks list,
- next dependency or explicit closure note.

The following do **not** qualify as done:

- code without proof,
- UI wired to the wrong runtime,
- legacy fallback still serving the happy path without explicit acceptance,
- or hidden scope expansion used to make a slice appear green.

---

## 8. Risk rules

- `hold bounded` lanes remain regression-only until formally promoted.
- `429` or `503` must be classified honestly as infrastructure noise or product/runtime failure; neither may be silently ignored.
- No Railway or DB targeting guesses are allowed; shared resolver and public DB targeting rules remain mandatory.
- Frozen layout rules still apply to any UI changes.
- If a slice requires new breadth to pass, it must be deferred or rechartered rather than silently expanded.

---

## 9. Active execution slice

### Slice name

`Post-closure exception closure pack v1`

### Scope

This first slice covers only:

1. `Calendar`
2. `Organization / Admin / Superadmin`
3. debt-program orchestration needed to run the next tranches cleanly

### Three-agent assignment

- `Agent A`: maintain this program, tranche rules, and acceptance state
- `Agent B`: tighten runtime/API correctness for `Calendar` and `Admin`
- `Agent C`: tighten surface/proof coherence for `Calendar` and `Admin`

### Exit criteria

- `Calendar` is either staging-proven end-to-end or reduced to one explicit carried runtime blocker with no ambiguity,
- `Admin / Superadmin` exposes read-only bounded V8 diagnostics coherently enough for operator verification,
- and the post-closure program exists as a stable execution authority.

### Explicitly out of scope

- `Chat` / `AI core` expansion
- `Execution`, `Results`, `Finance`, `Partner` write parity
- `Sync` OAuth completion
- `Multiplayer` websocket expansion
- `Reports / Presentations` full cleanup
- `Notes` adjunct reactivation

---

## 10. Initial lane map

| lane | taxonomy | tranche | current posture | next packet |
| --- | --- | --- | --- | --- |
| `Calendar` | `T0` | `Tranche 0` | active | clarify conflict/runtime truth and create-path proof |
| `Organization / Admin / Superadmin` | `T0` | `Tranche 0` | active | expose bounded V8 diagnostics coherently on superadmin surface |
| `Reports / Presentations` | `T1` | `Tranche 1` | parked | remove API/UI split-brain |
| `Idea workspace` | `T1` | `Tranche 1` | parked | resolve runtime red / collaboration split-brain |
| `Execution / delivery control` | `T2` | `Tranche 2` | parked | charter broader write continuity slice |
| `Results / KPI / ROI` | `T2` | `Tranche 2` | parked | charter workflow/write parity slice |
| `Finance` | `T2` | `Tranche 2` | parked | charter ingest and mutation parity slice |
| `Partner Program` | `T2` | `Tranche 2` | parked | charter lifecycle and payout parity slice |
| `Sync / connectors / interoperability` | `T2` | `Tranche 2` | parked | charter provider auth and mutation slice |
| `Multiplayer / collaboration` | `T2` | `Tranche 2` | parked | charter realtime behavior slice |
| `Notes` adjuncts | `T3` | `Tranche 3` | parked | bounded adjunct recovery only |
| `Mobile` / broad `Landing` / broad `Communication` / standalone `Edukacja` / `sheet ArtifactRun` parity | `T4` | `Parking lot` | deferred | explicit product unlock required |

---

## 11. Change log

- 2026-03-26: created the first post-closure debt reduction program and activated `Post-closure exception closure pack v1`
