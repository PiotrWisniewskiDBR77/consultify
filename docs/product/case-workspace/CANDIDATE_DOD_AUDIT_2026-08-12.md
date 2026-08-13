# Candidate DoD Audit — packet H2, 2026-08-12

> **Role: auditor, not fixer.** Nothing outside this file was changed by this
> packet. No status cell in any acceptance CSV was edited. No test was
> written. Where a defect was found, it is recorded here, not repaired.
>
> **Worktree / SHA at audit time:**
> `/Users/piotrwisniewski/dev/consultify-case-workspace-v1-20260809`,
> branch `claude/case-workspace-v1-20260809`, `HEAD = d02ebe924d1a75ca4c81614b39889f9b6712dbdc`,
> tree clean except one coordinator-owned untracked scratch file
> (`server/scratch_poll_capability_rows.mjs`, not touched by this audit).
> `git diff --check 9d17cac114..HEAD` → exit 0 (re-verified).
>
> **VoiceOver is explicitly OUT OF SCOPE for this packet** (H1 owns it). It is
> mentioned here only where it affects the candidate-readiness verdict.

---

## 0. Method and what "closed" means here

Every row below was evaluated against the six-point rule given in the brief:
(1) code exists, (2) a real consumer calls it, (3) a test covers exactly that
requirement, (4) evidence exists as a file or reproducible command, (5) the
evidence is from the right layer, (6) the evidence names a real SHA. A row
fails to "closed" if **any single point** fails — the specific failing point
is named, not just "open".

Two independent evidence corpora exist in this program and they **disagree
sharply**, which is itself the headline finding of this audit:

1. **Git history / test files / evidence directories** — real code, real
   commits, real (spot-re-run) test results. This is what "37-ish narrow,
   deeply-verified fixes landed correctly" looks like, and on inspection it
   mostly does.
2. **The acceptance ledger corpus** (`docs/product/case-workspace/acceptance/*.csv`,
   1682 effective requirement rows, machine-parsed by the committed
   `scripts/case-workspace/ledger-report.mjs`) — the formal, granular,
   per-requirement Definition of Done this program itself set up to answer
   "is V1 done". By that corpus's own numbers, **90.2% of tracked
   requirements are still open** (1516 of 1682: `NOT_IMPLEMENTED` 1273 +
   `PARTIAL` 227 + `EVIDENCE_MISSING` 16).

Both are true at once. The candidate is not "mostly done with some rough
edges" — it is a narrow, well-verified vertical slice (Golden Cases, a
handful of security/contract/migration guarantees, several UI a11y fixes)
sitting inside a formally-tracked requirement surface that is overwhelmingly
still open. Anyone reading only the git log would over-conclude; anyone
reading only the raw ledger counts without the file-provenance caveat below
would under-conclude (many ledger files were never touched with real
evidence to begin with — see §2).

**I could not locate a literal, itemized "37 points" document.**
`RESUME_HANDOFF_2026-08-11.md` §9 references "37 punktów w dyrektywie
właściciela z 2026-08-11" but that directive's itemized text is not
committed anywhere in this repo (searched: `docs/product/case-workspace/**`,
`Harvard/**`, git log messages, `11_OWNER_DECISION_REGISTER.md`). The closest
in-repo authoritative proxy — same intent, same "no PARTIAL/EVIDENCE_MISSING/
BLOCKED survives" rule, machine-checkable — is
`14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md` §5, **92 individual
checkbox criteria across 12 categories (DoD-A through DoD-L)**. This audit
uses that structure. **Flag for the coordinator:** confirm whether "37
points" is a distinct, smaller directive that supersedes/narrows document
14's 92, or whether "37" was an approximate count of a subset — this
document cannot resolve that ambiguity from repo contents alone.

---

## 1. Independently re-verified this session (not copied from prior reports)

| Check | Command | Result |
|---|---|---|
| Server typecheck | `cd server && NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` | **EXIT 0**, no output |
| Frontend typecheck | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc -p tsconfig.json --noEmit` | **EXIT 0**, no output |
| `git diff --check 9d17cac114..HEAD` | as written | **EXIT 0** |
| Ledger generator determinism | `node scripts/case-workspace/ledger-report.mjs --out <scratch>` then diff vs committed `LEDGER_SNAPSHOT.md` | **byte-identical**; committed file untouched (`git status` clean on it) |
| OpenAPI structural validation | `npx vitest run .../contract/openapiSchemaValidity.contract.test.ts .../openapiRouteParity.contract.test.ts` (offline, no DB) | **15/15 PASS** |
| Migration ordering parity, mechanisms #1/#2/#3/#5 | `npx vitest run tests/integration/migration-ordering-parity.realdb.test.ts` (no `DATABASE_URL` exported; picked up local `.env`, ran against a non-shared DB per the file's own `assertNotSharedDatabase` guard) | **11/11 PASS**, including 3 negative-control-style `--safe` semantics tests |
| Capability bootstrap production wiring | `grep bootstrapCaseWorkspaceCapabilities server/src/index.ts` | **real caller confirmed**, line 1898, called from boot |
| Golden Case / e2e / security test files exist on disk | `find` | **confirmed** (8 golden-case files, 2 e2e `.pg.test.ts` + 1 harness, 7 security files including `planVersionEnumeration.security` and `playsEnumeration.security`) |
| 30-minute Run evidence internal consistency | read the 4 **committed** JSON files directly | see §10 — **more coherent than the coordinator's brief states**, with a caveat |

I deliberately did **not** run: the full CW suite, the golden-case suite, the
e2e suite together, or anything against the shared `case_workspace_test`
database, per the brief's explicit prohibition (another packet is measuring
the full suite). The migration-ordering and OpenAPI runs above are safe
exceptions — both are self-contained (offline / own scratch DB / no shared
table writes), confirmed by reading each file's own isolation guards before
running.

---

## 2. The acceptance ledger, independently reconfirmed

Re-ran the committed generator to a scratch path and diffed against the
committed `LEDGER_SNAPSHOT.md` — **byte-identical**. The numbers below are
therefore independently reproduced, not copied on trust.

**Effective rows: 1682.** `IMPLEMENTED_AND_PROVEN` **161**, `PARTIAL` **227**,
`NOT_IMPLEMENTED` **1273**, `EVIDENCE_MISSING` **16**,
`OUT_OF_SCOPE_THIS_WAVE` **5**. GAP (not-`IMPLEMENTED_AND_PROVEN`/not-out-of-scope)
= **1516 / 1682 = 90.2%**.

**Critical caveat the raw percentage hides**, confirmed by reading
`acceptance/README.md` and per-file mtimes: three of the twelve ledger files
were generated once on 2026-08-09 as a first-pass document extraction and
**have never been touched since** — they are not "checked and found open",
they are **never checked at all**:

| File | Effective rows | Status | Evidence present |
|---|---:|---|---|
| `VISUAL_TRIADA_SPEC_A_LEDGER.csv` | 235 | 100% `NOT_IMPLEMENTED` | **0 rows have `test_ref` or `evidence_ref`** |
| `RESPONSIVE_ACCESSIBILITY_LEDGER.csv` | 32 | 100% `NOT_IMPLEMENTED` | **0 rows have any evidence** |
| `CUSTOMER_JOURNEY_LEDGER.csv` | 37 | 100% `NOT_IMPLEMENTED` | **0 rows have any evidence** |

That is **304 of the 1682 effective rows (18%)** sitting at a permanent,
never-revisited zero — not because nothing happened (real a11y fixes did
land, see §9), but because **the formal ledger that is supposed to be this
program's Definition-of-Done source of truth for TRIADA/SPEC-A, responsive/
accessibility, and customer journey was never wired to the actual
implementation work at all.** This is the single most important structural
finding of this audit: the DoD instrument for exactly the three areas the
brief asked me to check most carefully (TRIADA, SPEC-A, customer journey) is
not a live instrument. Reading it tells you nothing about current reality in
either direction.

The other nine ledger files **were** actively maintained this program (mtimes
2026-08-10 through 2026-08-12, real `test_ref`/`evidence_ref` values, real
`supersedes_row_id` append-only chains) and their `NOT_IMPLEMENTED`/`PARTIAL`
counts should be read as real, current signal — e.g.
`SECURITY_RESILIENCE_MATRIX.csv`: 92 effective rows, only **2**
`IMPLEMENTED_AND_PROVEN`, despite 7 real, passing `*.security.pg.test.ts`
files existing (see §8) — the granular security-matrix rows enumerate far
more discrete claims than those 7 files individually close, and that gap is
real, not a ledger-freshness artifact.

**GOLDEN_CASE_EVIDENCE_LEDGER.csv is stale relative to code that already
exists and passes** (its own author, `SCOPE_ADJUDICATION.md` §5, flagged this
and recommended the fix, not yet done): grepped it for the five NEW golden
case test files this program built —
`goldenCaseLightOneClick`/`goldenCaseTransformationMultiModule`/
`goldenCaseDirectModuleLateBinding`/`goldenCaseRequestChangesPartialRetry`/
`goldenCaseTenancyRefusal` — **zero matches**. The files exist on disk, were
reported passing by their own author, but have no corresponding ledger row at
all (not even a `NOT_IMPLEMENTED` placeholder).

---

## 3. Scope adjudication (`acceptance/SCOPE_ADJUDICATION.md`)

Read in full (812 lines). Findings:

- **Methodologically disciplined**: every exclusion claim carries a literal
  canon quote and file:line, exactly per the owner's stated rule
  ("wskaż DOKŁADNY fragment kanonu... W przeciwnym razie pozostaje otwarte").
  Only **3 of 29** reviewed wide-doc (Agent Execution V8) requirements are
  excluded from V1 with citation; the other 26 stay open by the document's
  own admission, ~20 of them "duplicate-covered" (proven under Case
  Workspace's own vocabulary) but **not mechanically promoted** — this is
  correctly not claimed as closed by the document itself.
- The remaining **~807 of 836 semantic requirement groups were never
  reviewed for scope at all** (§4 of the document says this explicitly) —
  scope adjudication covers a small fraction of the requirement surface, by
  its own admission.
- Ledger-hygiene work in this document (§8) is real and independently
  checkable: I reconfirmed via the generator (§2 above) that the described
  `IMPLEMENTED_AND_PROVEN`/`UNCOMMITTED-WORKTREE` sentinel and
  corpus-SHA-on-PROVEN-row hygiene counters are now **0/0/0** — matches
  `LEDGER_SNAPSHOT.md`'s own "Higiena dowodowa" section exactly.
- **Six `IMPLEMENTED_AND_PROVEN` rows previously sat on the `PENDING`-SHA
  sentinel** and were fixed by append-only superseding rows, each with a
  personally re-run test cited. I did not re-run those specific seven test
  files myself (would touch the shared DB); I accept this as a documented,
  append-only, non-status-flipping fix, correctly not reducing GAP.

**Verdict: SCOPE_ADJUDICATION.md is honest and internally consistent with
what it claims.** It explicitly does not claim to have resolved the bulk of
open requirements, and does not.

---

## 4. TRIADA checklist (`docs/ui-standards/TRIADA_KANON.md`)

**OPEN — literally, structurally.** Per §2 above,
`VISUAL_TRIADA_SPEC_A_LEDGER.csv` (which is where a TRIADA-per-screen review
would be recorded) has **235/235 rows at `NOT_IMPLEMENTED` with zero
evidence**, unchanged since 2026-08-09. I did not independently walk the
40-point checklist against a live Case Workspace screen myself (no dev server
was started for this audit, per the read-only mandate and to avoid
interfering with the coordinator-owned backend on :3001). Two things partly
offset this on the "real code" side, but neither is a checklist pass:

- Real, narrowly-scoped TRIADA-canon violations **were found and fixed**
  this program with genuine evidence: the bottom-nav active-state crimson
  misuse (`8c4ddd9f07`, real before/after pixel-sampled contrast
  measurements, `axe-core: 0 violations across the full 16-row matrix`, a
  permanent regression test
  `tests/components/navigation/BottomNavigation.activeStateCanon.test.tsx`
  proven RED→GREEN by stashing the pre-fix component).
- `scripts/check-triada.sh` and `scripts/check-artefakt.sh` are CI-style
  ratchets against crimson/canon regressions repo-wide, and per the last
  static gates report (2026-08-11, `CANDIDATE_GATES_REPORT.md`, itself now
  one commit stale relative to HEAD but not contradicted by anything found
  this session) they pass with debt **not increasing**.

Neither of those is "the 40-point TRIADA checklist completed item-by-item
with evidence" (DoD-F's literal requirement). **Rule failure: point 3 (a test
covers exactly that requirement) and point 4 (evidence exists as a file) —
no file anywhere records a completed, item-by-item TRIADA pass against any
Case Workspace screen.** Status: **OPEN**.

---

## 5. SPEC-A (`Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`)

**OPEN, same evidence gap as §4** — SPEC-A rows live in the same
`VISUAL_TRIADA_SPEC_A_LEDGER.csv` (235/235 `NOT_IMPLEMENTED`, 0 evidence).
DoD-G requires "Applicable object screens follow SPEC-A shell and archetype"
and "Required artifact checklist and render evidence pass before owner
review" — no such evidence file exists for any Case Workspace artifact
screen (Case/Plan/Run detail views) that I could find under
`docs/product/case-workspace/evidence/` or `acceptance/`. **Status: OPEN.**
Not independently walked live for the same reason as §4.

---

## 6. Customer journey (`CUSTOMER_JOURNEY_LEDGER.csv`)

**OPEN — 37/37 `NOT_IMPLEMENTED`, zero evidence, file untouched since
2026-08-09** (confirmed in §2). DoD-E's 11 functional-UX/customer-journey
criteria (five-second comprehension test, LIGHT-task simplicity, deep-link
restoration, five-tester uncoached comprehension study, etc.) have **no
corresponding evidence artifact anywhere in the repo** that I could locate —
searched `docs/product/case-workspace/evidence/*` for anything resembling a
five-second/comprehension user study; none exists. **Status: OPEN on all 11
DoD-E criteria**, not just the ledger's own 37 rows.

---

## 7. OpenAPI

**CLOSED**, six-point rule satisfied:
1. Code exists: `docs/product/case-workspace/api/openapi.yaml`, real spec.
2. Real consumer: the two contract test files load and validate it directly
   against the live route table (`openapiRouteParity.contract.test.ts`) —
   this is the intended consumer for a spec-conformance gate.
3. Test covers exactly the requirement: full OAS 3.0 meta-schema structural
   validation (embedded official meta-schema, no network dependency —
   verified: both files import only `node:*`, `ajv`, `yaml`, `vitest`),
   operationId uniqueness, router/spec parity, security-scheme completeness.
4. Evidence: **re-ran myself this session**, 15/15 PASS, offline.
5. Right layer: structural/offline validation is the correct layer for "is
   this an OpenAPI 3.0 document" — correctly does not claim to catch
   semantic/runtime drift (documented explicitly in the file's own header as
   a stated limitation, not hidden).
6. Real SHA: part of `HEAD d02ebe924d` via `cb96c748c1`.

One honest gap named by the test file itself and worth repeating here: the
spec currently declares **zero** `example`/`examples` values, so there is
"nothing to validate for conformance yet" on that axis — the test pins the
count at 0 so a future addition forces a deliberate decision. Not a defect,
a documented current limitation.

---

## 8. Migrations — fresh, replay, and the 5-mechanism ordering audit

**CLOSED for the ordering-parity claim**, six-point rule satisfied:
1–2. Code exists and is really used: `migrationRunner.ts` (mechanism #1, the
   one that actually gates `/api/ready` on every real boot) and
   `DatabaseInitializer.ts` (#2, runs every real boot just before #1) both
   confirmed wired into `server/src/index.ts` per
   `docs/product/case-workspace/evidence/e7-migration-paths-2026-08-12/MIGRATION_PATH_ASSESSMENT.md`'s
   own line-numbered citations (not re-verified line-by-line by me, but the
   claim is falsifiable and specific, not vague).
3–4. Test covers exactly this: **re-ran myself**,
   `tests/integration/migration-ordering-parity.realdb.test.ts`, 11/11 PASS,
   including a genuine negative control ("a naive raw-filename sort... DOES
   violate the parsed dependency graph") proving the suite would have caught
   the original bug, and three `--safe`-semantics tests against a real,
   isolated (non-shared) Postgres database.
5. Right layer: the ordering functions are compared directly (mechanism #2
   literally imports mechanism #1's `compareMigrationFilenames` — same
   function object, confirmed by the commit diff, not a parallel copy that
   could drift), which is the correct way to prove "these can no longer
   disagree" rather than asserting it in prose.
6. Real SHA: `906cc6b532`, part of HEAD.

**One mechanism (#4, `server/scripts/migrate.ts`, SQLite-dev-only) is
explicitly out of scope**, with a stated, specific reason (different dialect,
rewrites Postgres SQL to SQLite, never touches the real Postgres files) —
this is a defensible, documented scope call, not a silently dropped
mechanism.

**Fresh install / replay**: per `RESUME_HANDOFF_2026-08-12.md` §3 (not
independently re-run by me — would require standing up a fresh database,
outside this audit's time budget and adjacent to "don't corrupt the other
packet's measurement"): fresh migration PASS (`Database ready`, `/api/ready`
200), replay idempotent (`Applying migrations: 0`). **I did not re-verify
this row myself — recorded as reported, not independently confirmed,
consistent with rule-6 caution: I have no fresh-SHA-tagged log of my own for
it.**

`run-migrations-staging.cjs` (mechanism #5) has its ordering function tested
(11/11 above includes it) but its `main()` — the actual staging-affecting
code path — is **never exercised against real staging**, by design
(`OD-CW-DEMO-20260812` forbids it). That is a correctly-scoped, permanent
limitation, not a gap in this audit.

---

## 9. Restart / readback

**Two distinct claims, both with real evidence, different strength:**

- **Run-runtime restart** (`RESUME_HANDOFF_2026-08-12.md` §4.3): "Restart
  proven by a real separate V8 process" — this is the everyday-restart claim
  and I found nothing to contradict it; not independently re-run.
- **30-minute Run + mid-run restart**: see §10 below — this is the specific,
  higher-bar claim the brief flagged as suspect, and my own reading of the
  committed evidence differs materially from the coordinator's stated
  concern.

---

## 10. The 30-minute Run — reconciling the brief's concern against the actual committed files

The brief states: *"the committed evidence pack is INTERNALLY INCOHERENT —
run.log is from the 14:28 run while snapshots 01/02 are from the 11:07 run."*
I read all four **committed** files directly (not the working-tree `run.log`,
which is `*.log`-gitignored and **was never part of any commit** —
`git log --diff-filter=A` on the evidence directory shows only the 4 JSON
files added, ever, in `cb73de5e82`):

| File | Timestamp(s) inside | Consistent with |
|---|---|---|
| `01-before-restart-db-snapshot.json` | `capturedAtIso: 2026-08-12T11:07:45.900Z`, worker pid `40582` | — |
| `02-after-restart-db-snapshot.json` | `capturedAtIso: 2026-08-12T11:08:07.553Z`, worker pid `40754`, node-run went `RUNNING`(attempt 2)→`SUCCEEDED`(attempt 3) across the restart | 01 |
| `03-final-db-snapshot.json` | `run.createdAt: 11:07:35.404Z`, `run.completedAt: 11:37:35.545Z`, `runDurationMs: 1800041` | 01, 02 — same run window |
| `04-memory-and-latency.json` | 106 samples, first `11:11:08.376Z`, last `11:37:23.530Z`, `wallClockTestDurationMs: 1800235` | 01, 02, 03 |

**All four committed files describe the same single run** (11:07:35 →
11:37:35, ~30 minutes), with a genuine worker-process restart (pid
40582→40754) landing inside that window and the run subsequently completing
successfully with two independently-computed duration figures 194ms apart.
By the committed evidence alone, "restart DURING the 30-minute run" **is**
established.

The mismatch the coordinator (and commit `1d81d1c458`) flagged is real but is
against the **working-tree `run.log`** — an ephemeral, gitignored file from a
**later, unrelated 14:28–14:58 execution** of the same test, left on disk by
whoever most recently ran it locally, which was never committed and is not
part of the evidence pack a reviewer checking out this SHA would ever see.
`1d81d1c458`'s own commit message says as much ("this is my error... I
compared only the snapshots" — but the duration field is also inside 03,
which I found consistent).

**I am not overriding the coordinator's OPEN classification** — that is a
program-management call, and the underlying test's `EVIDENCE_DIR` was
correctly made opt-in this session specifically to stop this class of
confusion recurring. But the **specific factual claim in the brief ("the
committed evidence pack is internally incoherent") does not hold up against
the four files actually in git** — the incoherence was between a committed
artifact and an uncommitted, unrelated local file, not within the committed
pack itself. **Recording this as a correction for the coordinator to weigh,
not as a unilateral status change.** DoD-I's literal 30-minute-Run + no
duplicate-effects requirement has real, committed, self-consistent evidence
tied to `cb73de5e82`; whether that satisfies the bar is the coordinator's
call given the process confusion around it.

---

## 11. Security — cross-tenant, revoked membership, enumeration safety

Seven real `*.security.pg.test.ts` files exist and target exactly this
surface: `caseCoreService.security`, `artifactLinkService.security`,
`playService.security`, `proposalApprovalService.security`,
`newSurface.security`, `planVersionEnumeration.security`,
`playsEnumeration.security` — the last two are exactly "enumeration safety".
I did **not** re-run these myself (real Postgres, would risk colliding with
the other packet's full-suite measurement). `SCOPE_ADJUDICATION.md` §8.6
records personally re-running several of these very recently (13/13, 10/10,
11/11, 14/14, 13/13) as part of the ledger-hygiene pass — I treat that as
credible secondary evidence, not primary, per rule 6 (I have no run of my
own on the current exact SHA for these).

**F2's revoked-membership mechanism** (§5.1 of `RESUME_HANDOFF_2026-08-12.md`)
is the strongest cross-tenant evidence in the whole program: a real,
concurrently-run e2e test genuinely revokes a membership row mid-suite and
the sibling e2e file gets 403/404 on that same identity — this was
**initially misdiagnosed as a leak** and specifically investigated to rule
out cross-tenant leakage, concluding "POPRAWNE zachowanie produkcyjne...
Nie znaleziono żadnego przecieku cross-tenant/cross-org." That is a genuinely
adversarial-style finding process, not a rubber stamp.

**Against the formal ledger, however**: `SECURITY_RESILIENCE_MATRIX.csv` —
the granular, per-requirement security ledger — shows only **2 of 92**
effective rows at `IMPLEMENTED_AND_PROVEN` (§2). The 7 real security test
files are real and (by self-report) passing, but they do not individually
map onto and close the ~90 other discrete security claims the ledger
enumerates (specific role/ACL/delegation combinations, specific forged/
replayed-callback scenarios, etc.). **Verdict: the mechanisms proven are
real and well-verified; the formally-tracked security requirement surface is
overwhelmingly still open.** Both statements are true simultaneously and
neither should be dropped in a summary.

---

## 12. Golden Cases

Per `SCOPE_ADJUDICATION.md` §1 (self-reported by its author, not
independently re-run by me): **9/12 owner-listed scenarios PASS**, 8 test
files (4 pre-existing + 4 new, with one new file covering 3 scenarios), all
against real Postgres, real HTTP, no mocks. **Item 12 (deliverable
open-in-module / return-to-Case) is explicitly, honestly reported as
PARTIAL**, not PASS — the backend pointer contract is proven, the client-side
navigation half is `EVIDENCE_MISSING` by the test file's own header, stated
plainly rather than glossed. Two negative controls were run and shown
red→green (revoked-membership assertion, `causationId` sabotage) — real
adversarial verification, not just "it passed once".

**Ledger gap (repeated from §2, worth restating here specifically):** none of
the five new golden-case test files have a corresponding row in
`GOLDEN_CASE_EVIDENCE_LEDGER.csv` — confirmed by grep, 0 matches. **Rule
failure for "Golden Cases A–F pass" (DoD-L)**: point 4 (evidence exists as a
file, in the ledger this program built specifically for this purpose) fails
for the 5 new scenarios even though the underlying test evidence is real.

---

## 13. E2E, both files together

Not re-run by me (requires the coordinator-owned backend on :3001, explicitly
forbidden to start/restart). Relying on `RESUME_HANDOFF_2026-08-12.md` §5.1:
34/34 PASS across 3 consecutive together-runs, 0 leaked `cw-e2e-user-%`
fixture rows, **independently verified by the coordinator** (not just the
fixing packet's own self-report) — this is a stronger evidentiary chain than
most other rows in this audit specifically because two different actors
(fixer + coordinator) converged on the same number. I did independently
confirm both e2e files exist and are substantial (1156 + 857 lines, not
placeholder stubs) and that the underlying mechanism described (shared
mutable `SEED_USER` identity race between concurrent vitest file workers,
`fileParallelism` not set to false) is a plausible, specific, falsifiable
root cause rather than a vague "flaky test, retried until green" writeup.
**Treated as CLOSED**, on secondary (coordinator-corroborated) rather than
primary evidence — flagged as such, per rule 6's spirit (real SHA, but not
my own run).

---

## 14. Capability bootstrap

**CLOSED**, six-point rule satisfied:
1–2. Code exists and has a real caller — **confirmed this session**,
   `server/src/index.ts:1898` calls `bootstrapCaseWorkspaceCapabilities()` at
   boot.
3. Test file `capabilityBootstrap.pg.test.ts` maps its 9 `it()` blocks
   directly onto the 10-item packet brief (2 folded into 1), covering exactly
   the `OD-CW-BOOTSTRAP-20260812` mandate: missing actor/org id, wrong-org
   actor, MEMBER-role actor, REVOKED-membership actor, orphaned
   registry-without-binding, orphaned binding-without-registry — this is a
   genuinely adversarial test list, not a happy-path-only suite.
4. Evidence: file exists, read in full; **not personally re-run** (real
   Postgres, avoided per the no-shared-DB-interference rule).
5. Right layer: DB-row assertions ("asserted on the database... zero
   registrations"), not just a return-value check — correct layer for a
   fail-closed persistence guarantee.
6. Real SHA: `cb96c748c1`, part of HEAD.

Structurally significant: `capabilityBootstrap.ts` is grep-confirmed to
contain **zero database queries of its own** (the commit message's claim,
consistent with what "fail closed, no first-ADMIN fallback" requires) — I
did not re-grep this file myself this session but the claim is specific and
falsifiable, and the boot code path in `index.ts` (§ confirmed above) is
consistent with the described gate-then-delegate shape.

**Caveat carried forward from `RESUME_HANDOFF_2026-08-12.md` §5.2 itself,
worth repeating**: this proves the contract only on a synthetic, disposable
test organization — production will need a real, administratively-issued
service identity; the candidate does not claim to have built that
provisioning path, and correctly does not claim otherwise.

---

## 15. Automated accessibility

**Mixed — genuinely improved in three narrow, well-evidenced spots; not a
completed sweep.**

Closed (six-point rule satisfied) for the three specific fixes this program
made:
- **Back-button accessible name** (`b4a513bac0`): critical `button-name` axe
  finding, 14/14 detail-screen cells, fixed with a bilingual `aria-label`;
  verified live on all 14 cells (critical 0 everywhere); regression test
  4/4; real DOM query
  (`button[aria-label="Wstecz"]`) as evidence, not a snapshot.
- **Bottom-nav contrast + crimson active-state misuse** (`b4a513bac0`,
  `8c4ddd9f07`): measured on the composed background (pixel-sampled
  screenshots present as evidence, not a token read in isolation) — this
  specifically avoids a documented prior false-P0 pattern in this program.
  `axe-core: 0 violations across the full 16-row matrix`; permanent
  regression test present and proven RED→GREEN.
- **`partial`/`skipped` node-result states** (evidence dir
  `f3-partial-skipped-2026-08-12`, screenshots present desktop/mobile ×
  light/dark).

**Open**: DoD-H's literal bar is "zero critical/serious findings" across
**7 viewports × 2 themes** for the whole product surface, plus VoiceOver
(out of scope for H2, see below) and NVDA. `f1-back-button-a11y-2026-08-12`'s
own evidence notes scattered `serious` `color-contrast` findings persisting
on **other, unrelated** elements on several cells even after the critical fix
("not the back button... inspected") — whether every one of those has since
been closed by the bottom-nav fix or remains is not established by any
single document I found; no post-all-fixes, all-7-viewports×2-themes,
zero-critical-AND-zero-serious sweep exists as a single evidence artifact.
The formal ledger for this (`RESPONSIVE_ACCESSIBILITY_LEDGER.csv`) remains
32/32 `NOT_IMPLEMENTED` regardless (§2). **VoiceOver**: per the brief and
`VOICEOVER_MANUAL_RUNBOOK.md`, status is `BLOCKED_BY_HOST_PERMISSION —
VOICEOVER_MANUAL_EVIDENCE` — confirmed present, correctly not claimed as
PASS or N/A. This blocks DoD-H's "VoiceOver and NVDA critical paths pass"
line item outright; NVDA has a separate frozen
`N/A_WITH_CODEX_APPROVAL` per the file (not independently verified by H2 —
out of this packet's scope per the brief).

---

## 16. Everything OPEN — consolidated

- **VISUAL_TRIADA_SPEC_A_LEDGER.csv (235 rows)** — TRIADA + SPEC-A: no
  item-by-item checklist evidence exists anywhere for any Case Workspace
  screen. (§4, §5)
- **RESPONSIVE_ACCESSIBILITY_LEDGER.csv (32 rows)** — no full
  viewport×theme×critical/serious sweep exists post-fixes. (§15)
- **CUSTOMER_JOURNEY_LEDGER.csv (37 rows)**, all 11 DoD-E criteria — no
  five-second/comprehension evidence, no deep-link-restoration evidence
  artifact located. (§6)
- **~807 of 836 semantic requirement groups** never reviewed for V1 scope at
  all (SCOPE_ADJUDICATION's own admission). (§3)
- **SECURITY_RESILIENCE_MATRIX.csv**: 90/92 rows open despite 7 real,
  passing security test files — granular claims outrun what those files
  individually close. (§11)
- **GOLDEN_CASE_EVIDENCE_LEDGER.csv** not updated for the 5 new passing
  golden-case test files — zero ledger rows exist for them. (§2, §12)
- **Golden Case item 12** (deliverable open-in-module / return-to-Case): UI
  navigation half explicitly `EVIDENCE_MISSING` by the test's own header.
  (§12)
- **Fresh-install / replay migration**: reported PASS in
  `RESUME_HANDOFF_2026-08-12.md`, **not independently re-run this session** —
  treat as unverified-by-H2 rather than closed until someone re-runs it
  against the current HEAD.
- **`run-migrations-staging.cjs`'s actual `main()`** never verified against
  real staging (correctly, by policy — `OD-CW-DEMO-20260812`), so its
  real-world behavior remains formally unproven, permanently, by design.
- **VoiceOver**: `BLOCKED_BY_HOST_PERMISSION`, required for candidate on
  macOS, not satisfied. (§15, out of H2's fix-scope but blocks the verdict.)
- **NVDA**: relies on a frozen `N/A_WITH_CODEX_APPROVAL` not independently
  re-verified by this packet.
- **30-minute Run**: real, self-consistent committed evidence exists (§10),
  but the coordinator's classification remains OPEN pending their own
  re-review of the correction in §10; a "coherent replacement run" was
  reported as in flight and its completion was not visible in git history as
  of `HEAD d02ebe924d`.
- **DoD-A through DoD-L, all 12 categories**: none can be marked fully
  closed. Every category has at least one item resting on the never-updated
  TRIADA/SPEC-A/customer-journey ledgers or on the 90%-open granular
  requirement corpus.

---

## 17. Things marked (or reported) closed that do not survive the six-point rule — and one that survives better than reported

- **VISUAL_TRIADA_SPEC_A_LEDGER.csv / RESPONSIVE_ACCESSIBILITY_LEDGER.csv /
  CUSTOMER_JOURNEY_LEDGER.csv being "part of the acceptance corpus"**: these
  are never cited anywhere as closed, so there is no false-positive to catch
  here — but their *silent inclusion* in any blended "GAP" percentage without
  the freshness caveat in §2 would produce a misleadingly precise-looking
  number. Flagging the caveat itself as the finding.
- **`GOLDEN_CASE_EVIDENCE_LEDGER.csv` implicitly presented as covering the 9
  passing golden-case scenarios** by virtue of the file's name and purpose —
  it does not; 0 rows exist for 5 of the scenarios. Rule 4 failure (no
  evidence-ledger file entry) despite rules 1–3 and 5–6 being satisfied by
  the underlying test files themselves.
- **The 30-minute Run "internally incoherent" characterization** (§10) — on
  inspection of the actual committed files (not the stray local `run.log`),
  the four files that ARE in git history are mutually consistent and do
  establish the restart-during-run claim. This is the one item in this audit
  that survives *better* than reported, with a specific, falsifiable reason
  documented above (rather than "seems fine to me") — recorded for the
  coordinator to weigh, not asserted as a status flip.
- **`SECURITY_RESILIENCE_MATRIX.csv` "IMPLEMENTED_AND_PROVEN" rows (2 of
  them)**: not spot-checked individually by this packet for whether their
  cited `test_ref` lines still name the claimed test (the specific
  line-drift failure mode `packet E2` already found and fixed 5 instances of
  elsewhere in the corpus, per `SCOPE_ADJUDICATION.md` §9). Flagging as
  unverified rather than asserting a defect — I did not have time to
  personally chase these 2 rows to their cited lines.
- **`CANDIDATE_GATES_REPORT.md`** (2026-08-11) is now stale relative to HEAD
  — it reports 2 frontend / 8 server tsc errors that **no longer exist**
  (both typechecks are EXIT 0 as of this session's independent re-run, §1).
  Not a false-positive (the report never claimed candidate status), but
  citing it without the freshness caveat would understate current tsc
  health. Flagging so nobody cites its tsc numbers as current.

---

## 18. Counts

Using DoD-A..L (92 checkboxes, document 14 §5) as the structuring frame,
cross-referenced against the acceptance ledger and the evidence found above:

- **Categories with real, verifiable, evidence-backed progress on at least
  one item**: C (orchestration — capability registry, idempotency), D
  (governance/security — revoked-membership fail-closed, tenant checks), H
  (accessibility — 3 specific fixes), I (performance/reliability —
  30-minute-run evidence per §10, migration-restart), J (migration ordering)
  , K (documentation — this program produces extensive, honest evidence
  docs), L (candidate integrity — ledger hygiene, SHA discipline).
- **Categories where I found no credible evidence of completion on ANY
  item**: F (list/visual canon — TRIADA checklist never completed), G
  (artifact visual canon — SPEC-A checklist never completed), E (customer
  journey — ledger untouched, no comprehension-study evidence).
- **Not one of the 92 individual DoD-A..L checkboxes can be marked fully,
  literally satisfied** by what exists in the repo today, by the strict
  reading the brief demands. Several have strong partial evidence (e.g.
  DoD-D's "revoked membership... fail closed" is about as well-proven as
  anything in this program); none has the complete, ledger-recorded,
  item-by-item evidence trail DoD-A..L's own preamble requires
  ("All criteria are required unless the frozen canon literally marks the
  item out of scope or Codex grants an exact requirement-level exception").

**Ledger-level count (the more precise, granular instrument)**: **161 of
1682** tracked requirement rows are `IMPLEMENTED_AND_PROVEN` (9.6%). **1516
are open** (90.2%). 5 are `OUT_OF_SCOPE_THIS_WAVE` with citation.

---

## 19. Verdict — is this a candidate, VoiceOver aside?

**No.** VoiceOver aside, this is **not** a candidate, for reasons that have
nothing to do with VoiceOver:

1. **The formal Definition-of-Done instrument this program built for
   itself — the acceptance ledger corpus — shows 90.2% of tracked
   requirements open**, including 304 rows (TRIADA/SPEC-A, responsive/
   accessibility, customer journey) that were never even reviewed once
   after the initial 2026-08-09 extraction.
2. **DoD-E (customer journey), DoD-F (list/visual canon), DoD-G (artifact
   visual canon)** — three of twelve required categories — have **no
   located evidence of any completed item**, let alone the "100%, item by
   item, with evidence" bar DoD-F itself states.
3. **The work that IS genuinely done is real and well-verified** — Golden
   Cases (9/12, one honestly PARTIAL), the F2 e2e test-isolation fix
   (coordinator-corroborated), capability bootstrap (fail-closed, tested
   adversarially), OpenAPI structural validation (re-run and confirmed by
   this audit), migration-ordering parity across 4 of 5 mechanisms (re-run
   and confirmed by this audit), and three specific, well-evidenced a11y
   fixes. None of that is in question. It simply covers a narrow slice of
   what document 14's DoD (or whatever the real "37 points" are) requires.
4. Two ledgers that should be authoritative evidence sources for exactly the
   areas this audit was asked to weigh most carefully
   (`GOLDEN_CASE_EVIDENCE_LEDGER.csv`, `VISUAL_TRIADA_SPEC_A_LEDGER.csv`,
   `RESPONSIVE_ACCESSIBILITY_LEDGER.csv`, `CUSTOMER_JOURNEY_LEDGER.csv`) are
   demonstrably out of sync with reality in ways that would mislead a reader
   who trusted them at face value in either direction (missing rows for
   passing tests; zero rows touched despite real code changes elsewhere).

The gap to candidate is not "VoiceOver plus a short punch list" — it is a
substantial, multi-category remainder (customer journey, TRIADA/SPEC-A
checklist completion, ~90% of the granular requirement corpus,
ledger-reality reconciliation across at least 4 files) that this session's
evidence does not support closing quickly. This assessment does not reduce
any GAP counter and changes no status cell.
