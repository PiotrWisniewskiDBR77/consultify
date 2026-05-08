# EPIC-T9 — Confidence & Validation Status

**Block:** B — Record Provenance
**Status:** `PLANNED`
**Spec source:** Consultify Table Studio specification, sections 8, 5C, 11, 14.
**Owner agent:** A (algorithm) + B (UI)

---

## Goal

Each record in `tp_records` carries `confidence_score: NUMERIC(3,2) | NULL` and `validation_status: TEXT | NULL`. Confidence is recomputed automatically; validation status is set explicitly by user actions or AI auto-validation rules. Surface both in the grid (confidence bar in row gutter, validation badge on leading cell) and in the Tabele Word-canvas records section.

## Acceptance criteria

- Migration adds 2 columns: `confidence_score NUMERIC(3,2) NULL` (range 0–1), `validation_status TEXT NULL CHECK (validation_status IN ('unverified','auto_validated','human_validated','rejected'))`.
- `ConfidenceScoringService.recompute(recordId)` runs on every record write (debounced via batched job).
- Algorithm v1 inputs: source count (≥1 source = +0.3 baseline), human_validated flag (= 1.0 short-circuit), AI-generated flag (= 0.5 baseline), required-field completion (% completed × 0.4), formula-field consistency (× 0.2 if any formulas pass).
- Algorithm output bucketed into bands: 0.0–0.3 red, 0.3–0.7 amber, 0.7–1.0 green; UI consumes band, not raw score.
- `ValidationStatusService.setStatus(recordId, newStatus, actor, reason)` enforces:
  - `human_validated` → only by users with `validate` permission.
  - `auto_validated` → only by AI service via service-internal token.
  - `rejected` → user with `reject` permission; cascades to AI fields (clears them).
- Audit row on every status flip.
- `<ConfidenceBar>` renders tiny gradient bar in row gutter when score < 0.7.
- `<ValidationBadge>` renders 4 variants (`?`, `✓ AI`, `✓`, strikethrough).
- Tabele Word-canvas records section adds Source/Confidence column.
- Feature flag `featureRecordProvenanceEnabled` gates all UI + recompute.

## Algorithm v1 — pseudocode

```ts
function computeConfidence(record, sources, fields, formulas) {
  if (record.validation_status === 'human_validated') return 1.0;
  if (record.validation_status === 'rejected') return 0.0;

  let score = 0.0;

  // Sources contribution (0.0 – 0.3)
  const verifiedSources = sources.filter(s => !s.deleted_at && s.last_verified_at);
  const anySources = sources.filter(s => !s.deleted_at);
  if (verifiedSources.length > 0) score += 0.3;
  else if (anySources.length > 0) score += 0.15;

  // Required field completion (0.0 – 0.4)
  const required = fields.filter(f => f.required);
  if (required.length > 0) {
    const filled = required.filter(f => record.data[f.id] != null).length;
    score += 0.4 * (filled / required.length);
  } else {
    score += 0.4; // no required fields → full credit
  }

  // AI-generated baseline (max 0.5)
  if (record.metadata?.ai_generated && record.validation_status !== 'auto_validated') {
    score = Math.min(score, 0.5);
  }
  if (record.validation_status === 'auto_validated') {
    score = Math.max(score, 0.6);
  }

  // Formula consistency (0.0 – 0.2)
  if (formulas.every(f => f.evaluatesWithoutError)) score += 0.2;

  return Math.min(1.0, Math.max(0.0, score));
}
```

Tunable thresholds live in `tp_workspace_settings.confidence_weights` (JSONB).

## State transitions for `validation_status`

```
unverified → auto_validated (AI service)
unverified → human_validated (user with validate perm)
unverified → rejected (user with reject perm)
auto_validated → human_validated (user)
auto_validated → rejected (user)
human_validated → rejected (user with elevated audit reason)
rejected → unverified (user with reset perm)
```

Service rejects any other transition.

## In scope

### Backend
- Migration adds 2 columns.
- `ConfidenceScoringService.ts` exporting `recompute(recordId)`, `recomputeBulk(recordIds)`.
- `ValidationStatusService.ts` exporting `setStatus(...)`, `getAllowedTransitions(currentStatus, actorRole)`.
- `RecordsService.ts` extended: write hook calls `recompute`.
- Routes: `POST /records/:id/validation-status` with body `{newStatus, reason}`.
- Unit + integration tests.

### Frontend
- `ConfidenceBar.tsx`, `ValidationBadge.tsx`.
- `GridView.tsx` integration.
- `TabeleProvenanceColumn.tsx` for canvas.
- Component tests.

## Out of scope

- Algorithm v2 with embedding-based similarity (separate program).
- Per-tenant custom algorithm scripts (out of scope; only weights tunable).

## Dependencies

- B-XB2: schema is contract for Block C QA Engine.
- A-XB1: Block A `source_reference` field type integrates with `tp_record_sources`.

## Estimated effort

- S1 (0.5 day): migration columns.
- S3 (1.5 days): scoring + validation services + tests.
- S4 (1 day): grid UI integration.
- S5 (0.5 day): canvas integration in `TabelePreviewLayout`.
