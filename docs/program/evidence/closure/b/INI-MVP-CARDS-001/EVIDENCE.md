# INI-MVP-CARDS-001 — Evidence: deterministic persisted cards, reopen, retirement of old variants

Lane B (evidence-only). Worktree: `/Users/piotrwisniewski/Developer/consultify-closure-claude-b`,
branch `codex/closure-claude-b-transformation`, HEAD `64f507859c` at analysis time. Live DB:
`postgresql://consultinity:consultinity@127.0.0.1:55811/consultinity` (703 migrations, isolated lane
instance, read-only queries only). `postgresMaterialCommandUnitOfWork.ts` is being actively edited by
another Lane B executor in this same worktree — it was read in full but never modified.

## 1. Persisted or computed? Single-writer claim.

**Persisted**, via three real Postgres tables from migration
`server/migrations/933_initiative_card_versions.sql` (`:6-96`):
`ie_initiative_card_catalog` (static registry, 26 canonical cards seeded by the migration itself,
`:16-50`), `ie_initiative_card_selection` (per-initiative include/exclude + position + REQUIRED/
OPTIONAL), `ie_initiative_card_versions` (append-only published content, one row per
`(organization_id, initiative_id, card_key, card_version)`).

**Single-writer claim: CONFIRMED.** `grep` across `server/src` for all three table names finds
exactly two referencing files:
- `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts` — the only file
  that `INSERT`/`UPDATE`/`DELETE`s these tables (`isCanonicalInitiativeCard`/
  `listCanonicalInitiativeCardKeys` read the catalog at `:392-405`; `replaceInitiativeCardSelection`
  writes selection via `DELETE`+loop-`INSERT` at `:407-441`; `getInitiativeCardVersionForUpdate`/
  `getLatestInitiativeCardForUpdate` read-lock versions at `:443-502`;
  `publishInitiativeCardVersion` inserts a new version row at `:504-544`;
  `reviewInitiativeCardVersion` inserts a review-derived version row via `INSERT ... SELECT` at
  `:546-584`).
- `server/src/domain/initiatives-execution/postgresInitiativeReader.ts` — confirmed **read-only**:
  its only statements touching these tables are three `SELECT`s (`:1268-1272` latest-version-per-card,
  `:1308-1309` selection list, `:1332` unrelated aggregate-state select nearby). No write verb found.

No other file in `server/src` references any of the three table names. **Writer inventory here is
already exactly 1**, unlike INI-MVP-PROFILE-001's `initiatives` table.

## 2. Idempotency — correction of the prior inventory's specific claim

The prior inventory said "an `ON CONFLICT ... DO NOTHING` is reported at ~line 113." **Verified
imprecise**: `postgresMaterialCommandUnitOfWork.ts:113` is real, but it is the `ON CONFLICT
(organization_id, aggregate_type, aggregate_id) DO NOTHING` inside `persistAggregate` (`:93-120`),
which applies to the **generic `ie_aggregate_state` table** (every aggregate type, not
card-specific) on its very first version-0 insert. It is not on `ie_initiative_card_versions`
itself — that table's two `INSERT`s (`publishInitiativeCardVersion:521`,
`reviewInitiativeCardVersion:559`) have **no `ON CONFLICT` clause at all**.

The real idempotency mechanism for card commands is a **different, stronger guarantee**: the
command-receipt dedup in `server/src/domain/initiatives-execution/materialCommand.ts`,
`executeMaterialCommand` (`:418-533`). Every command (including
`initiative.card.publish`/`initiative.card.review`/`initiative.cards.configure`) is wrapped in this
function, which:
1. Looks up a stored receipt by `(organizationId, clientRequestId)` (`:430-433`,
   `findReceipt` at `postgresMaterialCommandUnitOfWork.ts:25-59`, `ie_command_receipts` table).
2. If found and the request fingerprint (SHA-256 over aggregate/command/version/policy/payload,
   `materialCommandFingerprint:290-306`) matches, returns the **exact same stored response** with
   `status: 'REPLAYED'` and performs **zero writes** (`:434-456`).
3. If found with a mismatched fingerprint, throws a conflict rather than silently double-applying
   (`:435-446`).
4. Otherwise proceeds, and additionally guards concurrent writers via optimistic version checks
   (`getAggregateVersion`/`getInitiativeCardVersionForUpdate`, both `SELECT ... FOR UPDATE` under an
   advisory lock keyed on `${orgId}:${aggregateType}:${aggregateId}`,
   `postgresMaterialCommandUnitOfWork.ts:66-77`).

**Verdict: idempotent, but via client-request-id + fingerprint receipt replay, not via
`ON CONFLICT DO NOTHING` on the card-versions table.** A caller retrying the *same* publish command
(same `clientRequestId`) gets the same result with no duplicate row; a caller retrying with a *new*
`clientRequestId` but a stale `expectedCardVersion` gets a `MaterialCommandConflictError`
(`publishInitiativeCard.ts:87-93`), not a silent duplicate. No duplicate-row failure mode was found.

## 3. Determinism — same input → same card set / same version?

**Two different things need separating, and they have different answers:**

- **Command replay determinism**: CONFIRMED YES, by construction (§2) — identical envelope +
  identical `clientRequestId` always yields the identical stored response, never a new version.
- **"Given an initiative's content, is a deterministic set of applicable cards/content derived
  automatically"**: **NO — there is no such derivation anywhere in this call chain.** Read in full:
  - `configureInitiativeCards.ts:29-103` — the set of included/excluded/required cards is **entirely
    caller-supplied** in `envelope.payload.cards` (validated only for structural well-formedness:
    no duplicate keys, unique positions, exactly the 26 canonical keys present, a waiver required to
    omit a REQUIRED card — `:42-56, 58-67`). The server does not compute *which* cards apply from
    initiative fields; it only validates the shape of whatever the caller (frontend) sent.
  - `publishInitiativeCard.ts:38-141` — `content`, `completion`, `quality`, `freshness`,
    `applicability`, `reviewState` are all **caller-supplied fields in the payload** (`:10-21`); the
    server persists them as given after the OCC version check, it does not compute completion/
    quality/freshness from the initiative's actual data.
  So "same input" only produces "same output" in the trivial sense of "same HTTP request replayed
  is idempotent" — there is no algorithm in this codebase that takes an initiative's field values and
  deterministically re-derives what its card set or card content *should* be. Whatever the frontend
  (or another future automation) sends is what gets persisted, unchanged. **This should not be
  read as a defect finding** (the task did not describe an intended auto-derivation algorithm to
  compare against) — it is a factual scope clarification: "deterministic" here means
  request-replay-safe, not "computed from source-of-truth business data."

## 4. Empirical check against the live database — cannot be completed as asked

```sql
SELECT (SELECT count(*) FROM ie_initiative_card_catalog)              AS catalog_rows,
       (SELECT count(*) FROM ie_initiative_card_selection)            AS selection_rows,
       (SELECT count(*) FROM ie_initiative_card_versions)             AS version_rows,
       (SELECT count(DISTINCT initiative_id) FROM ie_initiative_card_versions) AS distinct_initiatives_with_cards,
       (SELECT count(*) FROM ie_aggregate_state WHERE aggregate_type='initiative') AS initiative_aggregates,
       (SELECT count(*) FROM initiatives)                             AS initiatives_total;
```
Result: `catalog_rows=26, selection_rows=0, version_rows=0, distinct_initiatives_with_cards=0,
initiative_aggregates=0, initiatives_total=1`.

**`ie_initiative_card_selection` and `ie_initiative_card_versions` are empty in this lane's live
database.** This is not a query-scoping artifact — `ie_aggregate_state` has zero rows for
`aggregate_type='initiative'` too, and its own prerequisite table `initiative_candidates` (consumed
by `registerInitiative.ts:88-93` via `getSourceProposalForUpdate`) is also empty (`count=0`). The
one row in the classic `initiatives` table (`odbior--h16--init-scheduled-go-2`, an unrelated seed
row from another executor's session) was never created through `registerInitiative` — it is a
plain relational-table row (see INI-MVP-PROFILE-001 §0) and **structurally cannot have cards**,
because `ie_initiative_card_*` rows are keyed on an `initiative_id` that only exists once
`registerInitiative` has created an `ie_aggregate_state` row for it, which nothing in the relational
write path ever does.

**Conclusion: determinism cannot be empirically proven or refuted against live data in this
environment** — there is no data to run the "same input twice" experiment against. §2 and §3 are
code-path proofs (reading the actual OCC/receipt logic), not database observations. This should be
re-verified once a `registerInitiative` → `configureInitiativeCards` → `publishInitiativeCard`
sequence has actually been exercised against a populated environment (e.g. demo). Marking this
**NOT_VERIFIED empirically**, verified only by static code reading.

## 5. Reopen — exhaustively enumerated: the command does not exist

Enumerated every `initiative.*` command type registered across the whole
`server/src/domain/initiatives-execution/` directory (36 files) by grepping every
`commandType !== '...'` / `commandType: '...'` literal:

```
initiative.analysis.decide   initiative.analysis.request   initiative.analysis.start
initiative.archive           initiative.card.publish       initiative.card.review
initiative.cards.configure   initiative.definition.decide  initiative.definition.request
initiative.handoff.decide    initiative.handoff.request    initiative.portfolio.decide
initiative.portfolio.request initiative.register            initiative.schedule.decide
initiative.schedule.request  initiative.source.refresh
```

**There is no `initiative.reopen`, `initiative.restore`, or `initiative.unarchive` command type
anywhere in the codebase.** This is corroborated by an explicit runtime guard:
`materialCommand.ts:369-416` (`assertArchivedInitiativeIsReadOnly`), whose own comment states
"Archive is the final permitted material transition" (`:373`), and which throws
`'Archived Initiative is read-only; restore is not supported'` (`:410-413`) for **every** command
type except `initiative.archive` itself, once an initiative's aggregate payload has
`lifecycleState === 'ARCHIVED'` or `status === 'ARCHIVED'`.

**Verdict: "after a reopen, are cards deterministically rebuilt or duplicated" is a moot question —
reopen is not an implemented or reachable operation for initiatives in the canonical-runtime system,
by explicit design.** For the disjoint classic `initiatives` table (INI-MVP-PROFILE-001 §0), any
status flip away from `DONE`/`ARCHIVED` (if such a route exists — not traced further, out of this
task's scope) cannot affect cards either way, because classic-table initiatives never have an
`ie_aggregate_state`/card presence to begin with (§4). If a genuine "reopen and rebuild cards"
product requirement exists, it has **zero implementation today** and would need to be designed and
built from scratch, not fixed.

## 6. Old variants — retirement disposition, each verified independently

Checked via `grep -rln "<ComponentName>" src --include="*.tsx" --include="*.ts"` (excluding the
component's own file and tests), i.e. counting real importers, not assuming from the component name.

| Component | File | Importers found | Disposition |
|---|---|---|---|
| `PortfolioHealthTable` | `src/components/Initiatives/PortfolioHealthTable.tsx` | **0** | **DEAD — confirmed.** Safe to retire/delete; no reachable code path renders it. |
| `CandidatesTable` | `src/components/Initiatives/CandidatesTable.tsx` | **0** | **DEAD — confirmed.** Zero importers. |
| `CandidatesPanel` | `src/components/Initiatives/CandidatesPanel.tsx` | 1 — `CandidatesTable.tsx` only | **DEAD — confirmed transitively.** Its only importer (`CandidatesTable.tsx`) is itself unreachable from anywhere, so this component is unreachable from any live route despite not having "0" direct importers. |
| `InitiativeFullView` | `src/components/Initiatives/InitiativeFullView.tsx` | 2 — `src/components/MyWork/MyWorkHub.tsx` (`:185-186` lazy import, rendered at `:3804`) and `src/components/Initiatives/index.ts` (barrel, `:11,33` — comment there explicitly says "deprecated and no longer exported here, but it is STILL LIVE") | **LIVE — confirmed, not dead.** `MyWorkHub.tsx:3804` actually renders `<InitiativeFullView .../>` via a lazy-loaded component, so this is a genuine, reachable production render path, not a stale import. **Recommend: keep, do not retire** — matches the task brief's own framing ("survives only because MyWorkHub.tsx imports it") but "survives" here means "is live," not "is accidentally kept around." |

**Recommendation per variant:**
- `PortfolioHealthTable.tsx`, `CandidatesTable.tsx`, `CandidatesPanel.tsx`: safe to delete outright
  (zero reachability, confirmed by direct grep of every `.tsx`/`.ts` file under `src`, not by name
  pattern). This is a source-code deletion and is **out of Lane B's evidence-only lease** — flagging
  for a future code-writing task, not performed here.
- `InitiativeFullView.tsx`: **not a retirement candidate** — it is a live, rendered component reached
  from `MyWork/MyWorkHub.tsx`. Any future work should treat it as in active use, not dead weight.

## 7. Recommended verdict

**`PARTIAL`**

Reasoning: the persistence layer for cards is genuinely well-built — single writer (§1), receipt-based
idempotency with proper conflict detection (§2), and the dead-component cleanup story is fully
verified and low-risk (§6). But the task's core empirical ask — "prove or refute determinism against
the live database" — **cannot be completed**: the entire canonical-runtime card pipeline is
unpopulated in this environment (§4), because it depends on `registerInitiative`, which depends on
`initiative_candidates` (owned by `initiativeCandidateService.ts`, being worked on by another Lane B
executor right now and currently empty), which is structurally disconnected from the ~20 relational
`initiatives` writers inventoried in INI-MVP-PROFILE-001 (§0 there). Additionally, "reopen" as posed
in the task brief does not correspond to any implemented command (§5) — not a defect, but a scope
mismatch between the task's assumption and the current codebase that should be surfaced rather than
silently assumed answered. Not `BLOCKED_OWNER` (no owner decision is pending — the architecture is
already built and documented, it is simply empty of live data and missing a feature that was never
built); not `DONE_CURRENT_SHA` (the empirical determinism proof and the reopen behavior cannot be
shown positively); not `FIX_REQUIRED` under Lane B's evidence-only lease (nothing here is a Lane-B-
fixable bug — it is a data/feature-existence gap). `PARTIAL` reflects that the mechanism is sound and
verified by code reading, while live-data proof and the reopen feature are open items outside what
static analysis can close.
