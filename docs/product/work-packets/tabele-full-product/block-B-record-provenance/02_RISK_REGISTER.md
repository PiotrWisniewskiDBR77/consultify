# Risk Register — Block B: Record Provenance

**Block ID:** `TABELE_BLOCK_B_RECORD_PROVENANCE`
**Status:** `PLANNED`

---

## Technical risks (B-T)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| B-T1 | DB migration on `tp_records` blocks production for >30 s on multi-million row workspaces (also tracked as PR4) | Low | Critical | P0 | NULL-default columns (no rewrite); staging snapshot rehearsal in S0; transaction-wrapped | Agent C |
| B-T2 | Confidence scoring algorithm too aggressive → constant low scores erode user trust | Medium | High | P1 | Tunable thresholds in `tp_workspace_settings`; baseline telemetry in S3; calibration in S5 | Agent A |
| B-T3 | `tp_record_sources` grows unbounded for very active records | Medium | Medium | P2 | Cap to 50 sources per record; oldest-first eviction with audit log | Agent A |
| B-T4 | Recompute on every record write tanks throughput on bulk imports | Medium | Medium | P2 | Debounce + batched recompute; bypass on `import_in_progress` flag | Agent A |
| B-T5 | Grid `<ConfidenceBar>` rerender on every cell change kills scroll perf | Medium | Medium | P2 | Memoize per row; only rerender when score changes | Agent B |
| B-T6 | Validation badge state logic split between client + server drifts | Medium | Medium | P2 | Server is single source of truth; client only displays | Agent B |

## Product / UX risks (B-P)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| B-P1 | Confidence bar misinterpreted as data quality measure rather than AI confidence | High | Medium | P1 | Tooltip labels "AI confidence", not "quality"; doc page explains semantics | Agent C |
| B-P2 | Validation badges crowd the row gutter on dense tables | Medium | Low | P3 | Collapse to single icon; expand on hover | Agent B |
| B-P3 | Source popover hides under modal stack on certain views | Low | Medium | P2 | Z-index audit; portal-based popover | Agent B |
| B-P4 | Users add wrong source then never remove it; data quality degrades | Medium | Medium | P2 | Soft-delete + restore; "remove source" prompts confirmation | Agent B |
| B-P5 | Tabele records section bloated by added Source/Confidence column on tables with no provenance | Medium | Low | P3 | Auto-hide when 0 records have sources; keep collapsed group otherwise | Agent C |

## Security / tenant risks (B-S)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| B-S1 | Source content exposes data across ACL boundaries (e.g. linked record actor cannot read) | High | High | P1 | Resolution always through `PermissionsService.canRead`; L4.2 | Agent A |
| B-S2 | AI auto-validation forge into human-validation through manipulated payload | Low | High | P1 | Service-level invariant; L7.3 code review | Agent A |
| B-S3 | URL source type allows arbitrary scheme injection | Medium | Medium | P2 | Scheme allow-list (`https`, `consultify://`); L7.5 | Agent A |
| B-S4 | Audit trail for status flips lacks actor identity in multi-step flows | Low | Medium | P2 | Always pass `actor_user_id` through service signatures; log + verify | Agent A |
| B-S5 | Cross-tenant source listing | Low | Critical | P0 | L4.4 cross-tenant 403 test | Agent A |

## Cross-block dependencies (B-XB)

| # | Risk | Counterpart | Mitigation |
|---|---|---|---|
| B-XB1 | `tp_record_sources` table is the target of A's `source_reference` field type | Block A EPIC-T7 | A ships with null tolerance; full integration when both deployed |
| B-XB2 | Block C QA Engine reads `confidence_score` and `validation_status` to detect low-quality records | Block C EPIC-T11 | B's S3 documents schema as stable contract |
| B-XB3 | Block D form-as-intake writes records with sources `{ type: 'form_submission', form_id, ... }` | Block D EPIC-T14 | B's S2 source type union accepts `form_submission` |

---

## Rollback strategy

### Tier 1 — Feature flag
- Set `featureRecordProvenanceEnabled=false`. UI hides badges/bars/popover; new endpoints return 404.

### Tier 2 — Code revert
- All additive: `git revert <pr-merge-sha>`.

### Tier 3 — Migration rollback
- `DROP TABLE tp_record_sources` and `ALTER TABLE tp_records DROP COLUMN confidence_score, validation_status`.
- Data loss: only newly recorded provenance rows; original record data untouched.

### Tier 4 — Hot patch
- If P0 lands post-merge: enable Tier 1 immediately; investigate; fix or escalate.

---

## Risk monitoring

- Each sprint card opens with "Pre-sprint risk check" referencing this register.
- Each sprint card closes with "Realized risks" — risks that fired and resolution.
- Closeout aggregates realized risks under "Remaining Risks" with mitigation/owner.
