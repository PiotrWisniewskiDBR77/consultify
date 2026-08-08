# U04 KPI diagnosis, recovery experiment and remeasurement — canonical evidence

Date: 2026-08-08
Scope: local canonical shared worktree; no commit, push or deployment claim

## Proven contract

U04 links a KPI deviation to a durable Recovery Card, versioned root-cause hypotheses, a governed experiment and scheduled remeasurement. Experiment approval and the later cause decision are separate human decisions. The system never converts an AI hypothesis, an experiment result or correlation into a confirmed cause.

When recovery remains open, the Transformation Case may truthfully advance with conclusion `active_recovery` only if a canonical open Recovery Card exists. Final Word and PowerPoint facts remain aligned and explicitly state that recovery is unresolved; they do not present the outcome as confirmed or sustained success.

## Test evidence

- focused recovery experiment/service/routes/scheduler suite: `39/39` PASS;
- focused Transformation Case/final-output causal-honesty regression: `27/27` PASS;
- full TypeScript check: PASS.

## Native PostgreSQL proof

Script: `server/scripts/proof-u04-recovery-experiments.ts`
Marker: `U04_RECOVERY_EXPERIMENT_NATIVE_PG_GREEN`

Exact asserted facts:

- same create idempotency key replays the same experiment;
- concurrent version allocation remains monotonic (`[1, 2]` in the proof tenant);
- experiment execution requires an explicit human approval;
- two concurrent due-remeasurement ticks produce exactly one durable claim and one audit receipt;
- the same due work remains restart-safe because claim truth and receipt are stored in PostgreSQL rather than scheduler memory;
- remeasurement verdict and next recovery decision are persisted separately;
- `confirmed_cause` is `NULL` before the explicit human cause-and-evidence decision;
- a separate idempotent human decision records the confirmed cause and its evidence;
- all reads and writes are tenant-scoped.

## Causal-honesty and output readback

- an open Recovery Card is required for `active_recovery`; absence is fail-closed;
- `sustained` remains a different conclusion with its own measurement-window evidence gate;
- canonical final-output facts count open Recovery Cards and unresolved experiments;
- both Word and PowerPoint use that same facts object and render recovery-in-progress language, warnings and next actions;
- no claim is made that the intervention caused the KPI change until an authorized human records the separate cause decision.

## Status boundary

`PARTIAL`: local code, focused tests, scheduler restart/concurrency contracts and native PostgreSQL evidence are GREEN. Remaining acceptance is limited to same-SHA authenticated browser and deployed scheduler/output proof plus measured real-world outcome evidence. No measured business improvement or production causality claim is made.
