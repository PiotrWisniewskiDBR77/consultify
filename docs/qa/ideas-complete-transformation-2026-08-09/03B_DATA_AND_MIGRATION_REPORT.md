# Data and migration report — Ideas transformation

Naming note: §16 of the master program numbers this file `03`. That number was already taken in
this directory by `03_CODEX_QUALITY_BACKLOG.md` (a live, actively-referenced backlog — QG-01
through QG-06 — that predates this delivery-package pass). This file is filed as `03B` to avoid
overwriting it. See `00_PROGRAM_STATUS_AND_VERSION.md` for the full naming-collision resolution
across this package.

Candidate: HEAD `deb103fcde` on `codex/ideas-transformation-20260809`, base `origin/demo` @
`9d17cac114`, 25 commits ahead / 0 behind. No push, no merge to demo, no deploy at any point in
this program (repeated in every commit body).

## 1. Migrations written by this program

All four are additive (new nullable columns / new tables), each carrying its own header comment
stating non-application. Verified directly from the files, not from a prior claim:

| Migration | Epic | Adds | Consumer that feature-detects it |
|---|---|---|---|
| `server/migrations/20260810_idea_maturity_gates.sql` | E08 | `maturity_gates_json` on `my_ideas` | `server/src/routes/my-work.routes.ts` (`ideaColumns.has('maturity_gates_json')`) |
| `server/migrations/20260810_idea_business_case.sql` | E08 | business-case schema (sections/lineage) | business-case service + routes + `IdeaBusinessCaseSection.tsx` |
| `server/migrations/20260810_idea_conversion_mapping_version.sql` | E11 | `mappingVersion` + `source_link` on conversion lineage | `ConversionPreviewDialog.tsx` / lineage read paths |
| `server/migrations/20260810_idea_confidentiality.sql` | E12 | `confidentiality` column on `my_ideas` | `server/src/services/ideaConfidentiality.ts`, wired into `my-work.routes.ts` |

## 2. Application status — UNAPPLIED, verified by direct inspection

Confirmed today by reading each file, not by trusting a prior report: all four still open with
their original "NOT APPLIED" header comment intact, e.g. `20260810_idea_maturity_gates.sql` line
5: `★★★ NOT APPLIED. This subagent has no deploy/DB authority...`. No migration runner, `psql`, or
database command was executed by this task or any task in this program's git history — every
commit body in `git log origin/demo..HEAD` ends with the same line, "No push, no merge to demo, no
deploy." This is a repo DATABASE SAFETY rule, not an oversight: applying these requires an
explicit owner/orchestrator decision outside subagent scope.

**Consequence, stated plainly:** every server-side code path that feature-detects one of these
four columns (`ideaColumns.has(...)`) is running today against a database that does not have the
column. Each of those paths has a documented fail-open or graceful-degrade behavior (e.g. E12's
own contract test explicitly exercises "unmigrated environment (column absent) fails open — proceeds
unchanged" and passes), but the *new* behavior each migration exists to enable — persisted
maturity attestations, a persisted business case, versioned conversion lineage, a real
confidentiality gate — has **never executed against a real column** on any database, dev, demo, or
otherwise. This is `PERSISTENCE: NOT VERIFIED`, not `PERSISTENCE: BLOCKED` — the code is ready and
additive; only the owner-gated apply step is missing.

## 3. Test-time evidence — mock-based only, explicitly labelled as such

The one migration with an accompanying contract test says so in its own header:

`tests/integration/mywork/my-work.idea-confidentiality.contract.test.ts` line 14: *"Mock-based: no
real DB. Same mock strategy as the other my-work contract tests."* Re-run today: **6/6 pass**
(restricted idea → 403 on all four gated endpoints; standard idea → LLM invoked normally;
unmigrated/column-absent environment → fails open unchanged). This proves the route-level logic is
internally consistent against a simulated schema, in both the "column present" and "column absent"
states. It proves nothing about a real Postgres instance, a real migration runner, or read-back
after a real write — those remain **NOT VERIFIED**.

No equivalent contract test exists for the other three migrations (maturity gates, business case,
conversion mapping version) in this program's history — their persistence chain is
**EVIDENCE_MISSING**, one level below the confidentiality migration's "mock-verified,
DB-unverified" state.

## 4. Pre-existing migration-tooling risk (repo-wide, not introduced by this program)

Per `MEMORY.md`/prior audits on this codebase, the migration runner's `--safe` mode swallows a
failed migration as `skipped` + exit 0, and the demo database is known to be missing tables present
in the canonical schema. This program did not re-verify that finding (out of scope — no DB access),
but it means "apply these four migrations" is not a mechanical `db:migrate` call to trust blindly
even after an owner decision — the runner itself needs the same real-database verification
discipline as the rest of this program (`CLAUDE.md` golden rule 1: "czytaj stan danych z ŻYWEJ
bazy, nie z kodu").

## 5. Verdict

**Data/migration layer: CODE READY, NOT APPLIED, NOT VERIFIED end-to-end.** Four additive
migrations exist, are individually self-documented as unapplied, and gate real feature code with
honest fail-open/feature-detect behavior. One of the four (confidentiality) has mock-level route
tests proving the gating logic; the other three have none. Zero of the four have ever run against
a database in this program. This is an explicit, named blocker requiring an owner/orchestrator
decision to apply — not a defect in the migrations themselves as written.

---

**Re-verified at `6fec03f7a0` (stream S11-DOCS, 2026-08-12):** the blocker this
report names is CLOSED, not by this document's own history but by later
sessions this report predates. All four migrations named above were applied
under the owner's explicit authorisation to an isolated local ephemeral
Postgres and proven via `information_schema`/`pg_constraint`, not the
migration runner's own report — see `13_RUNTIME_GATE_EVIDENCE.md` and
`16_OPEN_RISKS_AND_LIMITATIONS.csv` RISK-02/03/04/05 (all RESOLVED). A fifth
migration, `20260812_idea_financial_case.sql`, was added and applied this wave
(RISK-12) — see `10_FINANCIAL_CASE_ACCEPTANCE.md` §6. **Still true and
unchanged: none of these six migrations has ever run against demo, staging,
or production** — isolated local ephemeral Postgres only, torn down after
each session.
