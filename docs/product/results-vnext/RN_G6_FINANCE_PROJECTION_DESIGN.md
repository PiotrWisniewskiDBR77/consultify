# RN-G6 — `finance_projection` Outbox Consumer — FROZEN DESIGN

Status: **FROZEN**. Integration Owner: Claude (orchestrator session, 2026-08-10).
Second consumer built against the landed RN-G3 dispatcher. Backend only.

---

## 0. What this closes

`finance_projection` has **11 live event types** (13 literal strings) routing to
it in `EVENT_TYPE_CONSUMER_GROUPS`, with no consumer. Since RN-G3 their rows
*park* (status `parked`, INFO notice) via `UNBUILT_CONSUMER_GROUPS`.

Unparking requires exactly three changes — the dispatcher itself changes **not
at all**, which is the whole point of the registry pattern:
1. Write `dispatchFinanceProjection`.
2. Add one line to `CONSUMER_REGISTRY`.
3. Remove `'finance_projection'` from `UNBUILT_CONSUMER_GROUPS`.

Governing rule (D06, from the master plan): *"Results never overwrites Finance
values; Finance never overwrites Approved, Forecast or Actual ROI truth;
divergence produces a reconciliation case, not silent last-write-wins
synchronization."*

---

## 1. Integration Owner rulings

| # | Open question | Ruling | Rationale |
|---|---|---|---|
| **IO-F1** | Who populates `pinned_finance_value` / `tracked_metric`, and when? No document names an owner. | **Make the columns exist; build no owner.** They are caller-supplied and nullable. When either is NULL the consumer maintains only lifecycle + current ROI figure and performs **no** divergence check — "nothing to diverge against" is the correct behaviour, not an error. Do NOT build a UI field or a Finance-side write command in this slice. Record as backlog naming both candidate owners. | Building an owner requires deciding whether Finance analysts type it or a Finance integration pushes it — a product decision with no source. The column's existence is what unblocks either path later without a second schema round-trip; that is the honest minimum. |
| **IO-F2** | Divergence tolerance / materiality threshold. | **Exact non-zero difference opens a reconciliation. No tolerance band.** Confirmed as designed. | No source document defines a threshold. Inventing "within 1%" would be precisely the fabricated-parameter failure this program has rejected three times already (the OKR linear-falloff formula, the attention-state thresholds, the scoring buckets). A threshold is a decision for someone with authority to set it. |
| **IO-F3** | `semantic_unit` validation. | **Copy through, never compare or validate.** Confirmed as designed. | No document defines legal values or how two units would be judged compatible. Comparing free text would produce confident nonsense. |
| **IO-F4** | `link_purpose` vs `tracked_metric` overlap; should existing links be backfilled by parsing `link_purpose`? | **No backfill, no parsing.** Keep the two columns independent. Existing links get no automatic `tracked_metric`. | `link_purpose` is unconstrained TEXT with ad hoc values already in fixtures (`'reference'`, `'npv_reference'`, `'totally_made_up_artifact_type'`). Parsing a typed metric out of free text is guessing, and a wrong guess here silently mis-attributes a financial figure. |
| **IO-F5** | Seed-source priority `actual > forecast > approved` for `roi.finance_link_created`. | **Ratified.** | It is the natural business ordering — realized data outranks a forecast, which outranks the original approval. The design correctly flagged it as its own choice rather than smuggling it in; ratifying it explicitly is the right close. |
| **IO-F6** | The two-layer transaction shape (§5) deviates from `mywork_projection`'s single-transaction precedent. | **Approved as designed**, and the reasoning must be preserved verbatim in the implementation file's header. | The deviation is forced and correct: `openRoiFinanceReconciliation` is an `executeAtomicCreate` call with its own idempotency-key guard, so it cannot and need not be inlined into the outer transaction. Both layers are independently safe under redelivery. This is the one place the consumer differs structurally from its own precedent — it must be visible to a reviewer, not discovered later. |

Everything else in §2–§9 below is ratified as designed.

---

## 2. Target table — there is no suitable Finance read model

Confirmed dead end: `financial_roi_links` is Finance's own legacy table, keyed
to legacy `initiative_id`/`benefit_id`/`model_id`, with **no column shaped like
`rvn_roi_cases.case_id`**. `financeEnterpriseService.ts` is the only code that
touches it and knows nothing of `rvn_roi_cases`. No other candidate exists —
verified across every `finance-*.routes.ts` and every `financial_*` table.

**The consumer therefore writes into a new `rvn_*`-owned table and never into
any `financial_*` table.** Writing into Finance's schema would be exactly the
shared-mutable-table coupling D06 forbids, and the ownership direction is
backwards.

```sql
CREATE TABLE IF NOT EXISTS rvn_roi_finance_projections (
  finance_link_id          UUID PRIMARY KEY REFERENCES rvn_roi_finance_links(link_id),
  case_id                  UUID NOT NULL REFERENCES rvn_roi_cases(case_id),
  organization_id          TEXT NOT NULL,

  case_status              TEXT NOT NULL,
  is_link_active           BOOLEAN NOT NULL DEFAULT true,

  tracked_metric           TEXT NULL,
  roi_value                NUMERIC NULL,
  roi_value_currency       TEXT NULL,

  source_kind              TEXT NULL CHECK (source_kind IN
                             ('approval_snapshot','forecast_version','actual_snapshot')),
  source_id                UUID NULL,
  source_sequence_number   INT NULL,

  reconciliation_status    TEXT NULL,
  last_reconciliation_id   UUID NULL REFERENCES rvn_roi_finance_reconciliations(reconciliation_id),

  projected_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rvn_roi_finance_projections_case
  ON rvn_roi_finance_projections(organization_id, case_id);
```

One row per **active link** (a case may carry several links with different
purposes). Visibility inherits via `case_id`, `resource_type='roi_case'` — no
new resource type, `::text` cast mandatory on the join.

### 2.1 The genuine schema gap (additive fix)

`rvn_roi_finance_links` pins an artifact *reference* but never a Finance
*value* — so there is nothing to diff against. Minimal additive fix, both
columns nullable, zero impact on landed rows:

```sql
ALTER TABLE rvn_roi_finance_links
  ADD COLUMN IF NOT EXISTS tracked_metric        TEXT NULL,
  ADD COLUMN IF NOT EXISTS pinned_finance_value  NUMERIC NULL;
ALTER TABLE rvn_roi_finance_links
  ADD CONSTRAINT chk_rvn_roi_finance_links_tracked_metric
    CHECK (tracked_metric IS NULL OR tracked_metric IN
      ('npv','simpleRoi','totalCosts','totalFinancialBenefits','paybackPeriods'));
```

Both caller-supplied, exactly like the already-landed `asOf`/`currency`/
`semantic_unit`. ROI-E007's D4 ("no read-through coupling") is not violated:
it forbids ROI *querying* Finance's tables, not storing a value the caller
typed. `tracked_metric` reuses `ROI_COMPARE_METRICS` verbatim rather than
inventing a parallel taxonomy.

---

## 3. Pinned versions

Every figure carries its lineage — `source_kind` + `source_id` +
`source_sequence_number` from the exact immutable artifact, never re-derived
at read time.

| Event | ROI figure source | `source_id` |
|---|---|---|
| `roi.case_approved` | `rvn_roi_approval_snapshots.snapshot_payload->'decisionCalculationRun'->>tracked_metric` | `event.payload.snapshotId` |
| `roi.forecast_published` | `rvn_roi_forecast_versions.<metric column>` | `event.payload.forecastVersionId` |
| `roi.actual_snapshot_published` | `rvn_roi_actual_snapshots.<actual_* column>`; **`paybackPeriods` unavailable for this source** — the table has no payback column | `event.payload.actualSnapshotId` |

Using the event's own payload id (not a fresh pointer lookup) is deliberate:
all three source tables are immutable by construction, so the payload id can
never go stale, and it avoids racing a later event that already moved
`rvn_roi_cases.latest_approved_snapshot_id` forward.

`mapping_version` and `finance_version_id` are copied unchanged from
`rvn_roi_finance_links` — the projection never invents its own.

---

## 4. Currency semantics

`roiCalculationEngine.ts` already **hard-fails** any run with a line in a
different currency than the case, so every stored ROI figure is unambiguously
in the case's single currency. The mismatch that can occur is between the
case's currency and the link's own pinned `currency`.

**Ruling, mirroring the engine's own policy rather than inventing a new one:**
a currency mismatch is a **hard-fail divergence, never an auto-conversion**.
If `link.currency IS NOT NULL AND link.currency <> case.currency`, open a
reconciliation with `divergence_reason='currency_mismatch'` and attempt **no**
numeric comparison. If `link.currency IS NULL`, no check is possible or
attempted.

Picking an FX rate silently is exactly what the engine refuses to do; the
consumer must not be laxer than the engine it reads from.

---

## 5. Divergence and reconciliation

Preconditions: both `tracked_metric` and `pinned_finance_value` non-null.
Otherwise update the projection row and stop.

1. Currency check first (§4) — mismatch alone is a divergence.
2. Otherwise exact `IS DISTINCT FROM` on NUMERIC (exact, no float epsilon).
   **No tolerance** (IO-F2).
3. **Never open a second reconciliation while one is unresolved for the same
   link.** Enforced twice: an application-level check on
   `status IN ('open','investigating')`, and a DB-level partial unique index
   as a race backstop between concurrent dispatcher workers:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS ux_rvn_roi_finance_reconciliations_one_open_per_link
     ON rvn_roi_finance_reconciliations(finance_link_id)
     WHERE status IN ('open','investigating');
   ```
   A unique violation is caught and treated as "already opened", never
   surfaced as a dispatch failure.
4. Opening reuses the landed `openRoiFinanceReconciliation` unmodified, with
   `actorUserId: null`, `actorEffectiveRole: 'system'` — a direct reuse of
   `okrDecisionResolutionScanner.ts`'s landed precedent, not a new pattern.
   Constant: `FINANCE_PROJECTION_CONSUMER_ACTOR = 'system:finance_projection_consumer'`.

**Neither side's authoritative value is ever touched.** The three ROI source
tables have no UPDATE path at all; `pinned_finance_value` is read-only to the
consumer. The only write on divergence is a new reconciliation row.

---

## 6. Two-layer transaction shape (IO-F6)

- **Layer 1** (dispatcher's per-row transaction, passed-in `client`): the
  `rvn_platform_consumer_processed` claim + the projection upsert.
- **Layer 2** (separate connection, only on divergence):
  `openRoiFinanceReconciliation`, guarded by its own deterministic
  idempotency key `finance-projection-divergence:${event_id}:${link_id}`.

If Layer 1 rolls back after Layer 2 committed, redelivery re-runs both: the
claim re-inserts cleanly and Layer 2 hits its own `ON CONFLICT DO NOTHING`,
returning `duplicate` — no second reconciliation, no exception. Independently
safe without being one physical transaction.

---

## 7. Per-event behaviour

| Event | Projection row | Divergence check |
|---|---|---|
| `roi.case_approved` | Yes, all active links | Yes |
| `roi.tracking_started` | Lifecycle only | No |
| `roi.forecast_published` | Yes | Yes |
| `roi.actual_recorded` / `_corrected` | **No-op (claimed, no write)** | No |
| `roi.actual_snapshot_published` | Yes | Yes |
| `roi.benefits_realization_started` | Lifecycle only | No |
| `roi.case_cancelled` / `roi.case_closed` | Lifecycle only | No |
| `roi.finance_link_created` | New row, seeded actual > forecast > approved | Yes if seed + pinned value present |
| `roi.finance_link_removed` | `is_link_active = false` (history retained) | No |
| `roi.finance_reconciliation_opened` / `_resolved` | Mirror status + id | No |

**Why `actual_recorded`/`actual_corrected` are deliberate no-ops**: they fire
per raw append-only entry, not yet rolled into an immutable snapshot.
Projecting from unsnapshotted entries would let the figure Finance sees change
with no stable pinned artifact behind it — the same "never propagate a
volatile value automatically" principle ROI-E007's AC-05 established. They are
still *claimed* idempotently, so redelivery stays a no-op rather than an error.

---

## 8. The eight acceptance proofs

New file `tests/acceptance/rvn-outbox-finance-projection.e2e.test.ts`,
following the landed `rvn-outbox-mywork-projection.e2e.test.ts` precedent.
Fixtures call **real ROI commands**, never hand-inserted event rows.

1. **Atomic event+outbox** — negative control: force `applyMutation` to throw in `createRoiFinanceLink`; assert no link row, no event, no outbox row.
2. **Real consumer effect** — approve a case, link it with matching `pinned_finance_value`, run one tick; assert a projection row with correct `roi_value`/`source_kind`/`source_id`, and **zero** reconciliations (values matched).
3. **Idempotency** — run the same claimed row twice; assert one claim row, one projection row, and `updated_at` **unchanged** on the second call (a true no-op via the claim, never reaching the upsert).
4. **Retry/backoff** — force a throw; assert `next_attempt_at` advances by `backoff * 2^attempts`, status `failed`. Inherited from the landed dispatcher, no new logic.
5. **Dead-letter + alert** — drive to `max_attempts`; assert `dead_letter` and one CRITICAL `sendSystemAlert`. This also proves the group graduated out of `UNBUILT_CONSUMER_GROUPS` — it now dead-letters like any registered group instead of parking.
6. **Cross-org isolation** — `case_id` is a real UUID PK so it cannot collide; the meaningful equivalent is two orgs whose links point at the **same literal `finance_artifact_id`/`finance_artifact_type`** (a plausible real collision — Finance artifact ids are external and not vNext-namespaced). Assert each org's projection references only its own case/org and a query scoped to org B never returns org A's rows.
7. **Cold reopen/readback** — read back via the new `GET /cases/:caseId/finance-projections`; then publish an actual snapshot that diverges, re-run the tick, assert the projection updated its lineage **and** a new `open` reconciliation exists, reachable via the landed `listRoiFinanceReconciliations`.
8. **No silent failure** — any exception propagates to the dispatcher's per-row catch → `markFailed` with the real message in `last_error`. No swallow-and-continue path anywhere in the consumer.

**Negative tests (required, beyond the eight):**
- **Never writes to any `financial_*` table** — grep gate on the consumer's own source (must be 0 matches), plus a real-DB companion: snapshot every `financial_*` table's row count and content hash before and after a full tick; assert byte-identical.
- **Divergence never overwrites either side** — after proof 7, assert all three ROI source tables unchanged **and** `pinned_finance_value` still byte-identical to the caller's original.
- **Re-delivered event never double-opens a reconciliation** — two sub-cases, both required: (a) same outbox row twice → one reconciliation (the claim layer); (b) **two different events** for the same still-diverging link (`forecast_published` then `actual_snapshot_published`) → still exactly **one** `open` reconciliation, proving the §5.3 guard works across different `event_id`s, not just against literal redelivery.

---

## 9. Files

**New**: `<date>_rvn_roi_finance_projections.sql` (table + the additive
`rvn_roi_finance_links` columns + the partial unique index),
`financeProjectionConsumer.ts`, `roiFinanceProjectionRepository.ts`,
`tests/acceptance/rvn-outbox-finance-projection.e2e.test.ts`.

**Changed**: `consumerRegistry.ts` (register + unpark),
`roi.routes.ts` (`GET /cases/:caseId/finance-projections`), ledger docs.

**Explicitly not touched**: any `financial_*` table,
`financeEnterpriseService.ts`, `finance-enterprise.routes.ts`,
`outboxDrain.ts`, `platformOutboxDrainCron.ts` — the dispatcher needs zero
changes.

---

## 10. Definition of done

- [ ] All eight proofs plus all three negative tests pass on real Postgres
- [ ] `tsc --noEmit` clean
- [ ] Existing KPI/ROI/OKR suites unaffected (before/after evidence)
- [ ] `finance_projection` removed from `UNBUILT_CONSUMER_GROUPS`; previously parked rows are replayable
- [ ] Grep gate proves zero `financial_*` references in the consumer
- [ ] Closure entry records IO-F1's unbuilt owner, IO-F2's unset threshold, and the `paybackPeriods`-unavailable-for-actual limitation, all as open items rather than silently resolved
