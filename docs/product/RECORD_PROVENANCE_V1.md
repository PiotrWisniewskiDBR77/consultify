# Record Provenance V1 (Block B · Tabele Studio)

**Status:** `IMPLEMENTED — backend (S1+S2+S3)`
**Owners:** Tabele Backend WG · QA · UI/UX
**Related Source-of-Truth:** `consultify/docs/product/work-packets/tabele-full-product/00_CTO_DECISIONS.md`,
`docs/product/work-packets/tabele-full-product/block-B-record-provenance/BLOCK_B_TASK_PACKET.md`
**Implementation:** `ConfidenceScoringService.ts`, `ValidationStatusService.ts`,
`RecordSourcesService.ts`, `RecordsService.ts` (write hook), routes in
`table-platform.routes.ts` and `table-platform.record-sources.routes.ts`
**Feature flag:** `ENABLE_RECORD_PROVENANCE` (default `false`).

This document is the canonical specification for the Record Provenance
subsystem: how AI confidence is computed, how validation status flows
between actors, what audit signals are emitted, and what the UI is allowed
to claim about each record.

---

## 1. Vocabulary

| Term | Meaning |
| --- | --- |
| **Source** | A row in `tp_record_sources` that documents where a piece of record data came from (manual entry, AI extraction, import, etc.). |
| **Active source** | `tp_record_sources` row with `archived_at IS NULL`. |
| **Confidence score** | A `[0.00, 1.00]` floating-point number stored on `tp_records.confidence_score`. Reflects the system's belief in the record's data **based on its provenance and validation history** — NOT a generic data-quality measure. |
| **Validation status** | Tri-state human-controlled flag on `tp_records.validation_status`: `unverified` (default) → `verified` → `flagged`. |
| **Provenance ledger** | The full set of active and archived `tp_record_sources` rows for a record, i.e., the auditable trail of where the data came from. |

> **B-P1: AI confidence ≠ data quality.** Surface labels in the UI **MUST**
> say "AI confidence" or equivalent; never "Data quality" or "Trustworthy".
> A record can have a high confidence score and still be wrong; the score
> only attests that the record has a healthy provenance trail.

---

## 2. Data Model

### 2.1 `tp_records` (additions)

| Column | Type | Notes |
| --- | --- | --- |
| `confidence_score` | `NUMERIC(3,2) NULL` | Persisted result of `ConfidenceScoringService.recompute`. `NULL` means "never scored". |
| `validation_status` | `TEXT NOT NULL DEFAULT 'unverified'` | Constrained to `('unverified','verified','flagged')` by service-level guards (no DB CHECK to keep migrations reversible). |

### 2.2 `tp_record_sources`

```sql
CREATE TABLE tp_record_sources (
  id                       UUID PRIMARY KEY,
  organization_id          TEXT      NOT NULL,
  record_id                UUID      NOT NULL REFERENCES tp_records(id) ON DELETE CASCADE,
  source_type              TEXT      NOT NULL,
  source_uri               TEXT      NULL,
  source_metadata          JSONB     NOT NULL,
  confidence_contribution  NUMERIC(3,2) NULL,
  created_by               TEXT      NOT NULL,
  created_at               TIMESTAMPTZ NOT NULL,
  last_verified_at         TIMESTAMPTZ NULL,
  last_verified_by         TEXT      NULL,
  archived_at              TIMESTAMPTZ NULL
);
```

Caps and rules:

* **50 active sources per record** (`MAX_SOURCES_PER_RECORD`). Soft-deleted
  rows do not count.
* `source_type ∈ {manual, ai_extraction, import, integration, system}`.
* `confidence_contribution` (when not null) MUST be in `[0.00, 1.00]`.
* `organization_id` is materialised on insert from the parent record's
  org chain (`tp_records → tp_tables → tp_bases.organization_id`). Cross-
  tenant attempts surface as `RECORD_NOT_FOUND` (404) — existence is hidden
  from the wrong tenant.

---

## 3. Confidence Algorithm

The score is a clamped weighted sum:

```
confidence_score =
    clamp01(
        base
      + sourceCountBonus
      + sourceContribution
      + verificationBonus
      + manualVerifiedBonus
      + flaggedPenalty
    )
```

| Component | Default weight | How it is computed |
| --- | --- | --- |
| `base` | `+0.30` | Prior; every record starts at 0.30 |
| `sourceCountBonus` | `+0.10 × min(activeSources, 3)` | 0 → 0.00, 1 → 0.10, 2 → 0.20, 3+ → 0.30 |
| `sourceContribution` | `+0.20 × avg(non_null confidence_contribution)` | Per-source signal (e.g., AI extractor's own confidence). Null contributions are excluded from the average. |
| `verificationBonus` | `+0.10` | When at least one active source has `last_verified_at` within the last **30 days** |
| `manualVerifiedBonus` | `+0.10` | When `validation_status = 'verified'` |
| `flaggedPenalty` | `-0.20` | When `validation_status = 'flagged'` |

The final value is rounded to 2 decimal places and persisted only when it
changes (idempotent UPDATE). Weights live in `CONFIDENCE_WEIGHTS` and can be
calibrated in S5 without an algorithm rewrite.

Worked examples:

| Scenario | Math | Score |
| --- | --- | --- |
| Brand-new record, no sources, unverified | `0.30` | `0.30` |
| 2 manual sources, no contributions, unverified | `0.30 + 2·0.10` | `0.50` |
| 2 sources, contributions `0.5/1.0`, unverified | `0.30 + 0.20 + avg(0.75)·0.20` | `0.65` |
| 3 sources with `0.9` contrib each, flagged | `0.30 + 0.30 + 0.18 − 0.20` | `0.58` |
| 1 fresh-verified source, unverified | `0.30 + 0.10 + 0.10` | `0.50` |

### 3.1 Recompute trigger surface

* `RecordsService.createRecord` — after formula recompute, before realtime.
* `RecordsService.updateRecord` — after formula recompute, before realtime.
* `ValidationStatusService.setStatus` — after the status flip is committed.
* `RecordSourcesService.createSource / updateSource / markVerified /
  deleteSource` — these mutate `tp_record_sources` and trigger
  `confidenceScoringService.recompute(recordId)` via the same call site as
  `RecordsService` (planned for S4 wiring; today the recompute fires on the
  next record write).

All triggers are wrapped in `try/catch` and **never** roll back the
underlying mutation. A recompute failure logs at `warn` and the score
catches up on the next mutation.

### 3.2 Feature-flag contract

`ENABLE_RECORD_PROVENANCE` defaults to `false`. When OFF:

* `recompute()` short-circuits with `{applied: false, reason:
  'feature_disabled'}` BEFORE any DB query — preserves DB I/O parity with
  the pre-Block-B path.
* `RecordsService` write hooks therefore execute zero extra queries.
* The `POST /records/:id/validation-status` route is still wired (state-
  machine logic is independent of the score) but UI must hide the affordance
  when the flag is OFF (`featureProvenanceUi`).

---

## 4. Validation Status State Machine

```
   ┌────────────┐   verifyHuman    ┌──────────┐   flag       ┌─────────┐
   │ unverified │ ───────────────▶ │ verified │ ───────────▶ │ flagged │
   └────────────┘                  └──────────┘              └─────────┘
         ▲                              ▲   reset                ▲
         │ flag                          ──── (admin only) ───────
         │
         └─────── reset (admin only, from any state) ────────────┘
```

| From | To | Allowed actor |
| --- | --- | --- |
| `unverified` | `verified` | data_editor |
| `unverified` | `flagged` | data_editor |
| `verified` | `flagged` | data_editor |
| `verified` | `unverified` | **super-admin only** |
| `flagged` | `verified` | data_editor |
| `flagged` | `unverified` | **super-admin only** |

### 4.1 Invariants

* **AI cannot promote a record to `verified`.** The route that emits
  `validation_status_changed` requires an authenticated human actor and
  rejects calls without `actorUserId`. AI agents must use the source
  ledger to influence the score, never the validation status. (B-S2.)
* **Resets erase signal.** Going back to `unverified` removes the manual-
  verified bonus and the flagged penalty; we restrict it to super-admin so
  ordinary triage cannot accidentally wipe the human review record.

### 4.2 Audit

Every successful flip writes a `tp_audit_events` row with:

* `event_type = 'record_validation_status_changed'`
* `entity_type = 'record_validation'`
* `entity_id = <recordId>`
* `before = { validation_status: <prev> }`
* `after  = { validation_status: <next> }`
* `metadata = { note, is_super_admin }`

Audit is the source of truth for the validation history surface in the UI;
no parallel ledger column exists.

---

## 5. API Surface

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| `GET` | `/records/:recordId/sources` | record-access | List active or archived sources for a record |
| `POST` | `/records/:recordId/sources` | record-access | Create a source (cap 50/record) |
| `PATCH` | `/sources/:sourceId` | record-access | Patch metadata, contribution, archive |
| `POST` | `/sources/:sourceId/verify` | record-access | Stamp `last_verified_at = now()`, `last_verified_by = actor` |
| `DELETE` | `/sources/:sourceId` | record-access | Soft delete (sets `archived_at`) |
| `GET` | `/records/:recordId/validation-status/transitions` | record-access | Returns `{current, allowed[]}` |
| `POST` | `/records/:recordId/validation-status` | record-access (+ super-admin for `*→unverified`) | Flip the status |

Error code map:

| Service code | HTTP |
| --- | --- |
| `INVALID_INPUT` | 400 |
| `RECORD_NOT_FOUND` | 404 |
| `INVALID_VALIDATION_TRANSITION` | 409 |
| `TRANSITION_REQUIRES_SUPER_ADMIN` | 403 |
| `RECORD_SOURCES_CAP_EXCEEDED` | 409 |

---

## 6. Performance and Throughput Notes

* **Per-record recompute** is two short SQL statements (record SELECT +
  sources SELECT) plus a conditional UPDATE. Telemetry baseline is captured
  by the Anygravity P0 trial #2 on 100 sample records.
* **Bulk paths** (`recomputeBulk`) are sequential by design — a `Promise.all`
  fan-out would saturate the pool on import bursts. Bulk imports MUST go
  through the `automationService` import path which sets a debounce flag and
  performs a single recompute pass at the end of the import (B-T4 — to be
  wired in S4).
* **No per-recompute audit row.** The score is a derived value; audit lives
  on the underlying source / validation events instead.

---

## 7. UI Contract (B-P1 reminder)

* Badge labels: `AI confidence: 0.85` (NOT "Data quality: 0.85").
* Tooltip on the badge MUST link to the provenance drawer (right rail,
  Module Executive Layout Standard).
* Validation status chip palette: `unverified` neutral, `verified` accent,
  `flagged` warning.
* When `ENABLE_RECORD_PROVENANCE = false` the badge and the validation chip
  are hidden — the UI feature flag is `featureProvenanceUi` (read from the
  same env, no separate frontend flag).

---

## 8. Open Items for Sprint 4+

* Wire confidence recompute as a side-effect of source mutations (today it
  fires only on the next record write).
* Add `recomputeAllForTable(tableId)` admin tool (super-admin only) to
  catch up score on legacy data after the flag is flipped on.
* UI: provenance drawer + grid badges (B-S4 frontend).
* Calibration sprint (S5): replay historical mutations, tune
  `CONFIDENCE_WEIGHTS` against labelled examples.
