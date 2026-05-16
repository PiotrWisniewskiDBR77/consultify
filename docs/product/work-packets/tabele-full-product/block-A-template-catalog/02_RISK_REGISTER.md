# Risk Register — Block A: Template Catalog

**Block ID:** `TABELE_BLOCK_A_TEMPLATE_CATALOG`
**Status:** `PLANNED`
**Severity scale:** P0 > P1 > P2 > P3

---

## Technical risks (A-T)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| A-T1 | Migration `ALTER TABLE tp_base_templates ADD COLUMN ...` locks the table on large workspaces | Low | Medium | P2 | Use NULL-default columns (no rewrite); rehearse on staging snapshot | Agent C |
| A-T2 | 30 templates with rich field defs raise `BUILTIN_TEMPLATES` map to ~1500 lines, slow IDE | Medium | Low | P3 | Split into per-template files imported into a single index | Agent B |
| A-T3 | New `source_reference` field type couples to Block B's `tp_record_sources` not yet shipped | High | Medium | P1 | A's `source_reference` validator accepts `null` source_id when B not deployed (feature flag); end-to-end works only when both blocks deployed | Agent A |
| A-T4 | i18n: 30 templates × 2 locales × ~5 strings each = ~300 keys; risk of missing PL | Medium | Low | P2 | Centralize in `templateCatalogStrings.ts`; CI i18n linter | Agent C |
| A-T5 | `AddColumnDialog` extension breaks existing field type picker layout | Low | Medium | P2 | Component test with snapshot; visual review | Agent B |
| A-T6 | New cell renderers crash GridView when cell value is null | Medium | Medium | P2 | Each renderer has explicit null/undefined branch + test | Agent B |

## Product / UX risks (A-P)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| A-P1 | 30 templates feel overwhelming in `ArtifactModuleHome` | Medium | Medium | P2 | Default filter = `Approved` (12 visible); toggle to All shows 30; "popular" group at top | Agent B |
| A-P2 | "Risk Register" template name conflicts with existing Excele "Risk Register" template (different lane) | Medium | Low | P3 | Tabele variant labeled "Risk Register (operational)"; descriptions disambiguate | Agent A |
| A-P3 | Lifecycle badges create visual clutter | Low | Low | P3 | Subtle dot, not full pill; only on draft/deprecated | Agent C |
| A-P4 | `risk_score` heat-map gradient feels off-brand vs DBR77 monochrome | Medium | Medium | P2 | Use semantic accent ramp from `color-system.md`; visual review L6.2 | Agent B |
| A-P5 | `ai_generated_summary` cell hides AI provenance; users edit it manually thinking it's owned by them | High | Medium | P1 | Cell shows AI sparkle icon + "AI-derived" tooltip; manual edit prompts confirm | Agent B |

## Security / tenant risks (A-S)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| A-S1 | Approve / deprecate without owner check leaks template promotion across tenants | Low | Critical | P0 | Super-admin role check on every endpoint; cross-tenant test L4.3 | Agent A |
| A-S2 | `governance_rules` JSON allows arbitrary code injection through eval-like patterns | Low | High | P1 | JSON schema validation on input; no eval anywhere | Agent A |
| A-S3 | `source_reference` cell renders source preview without ACL filter | Medium | High | P1 | Resolution always through `PermissionsService.canRead(source_id)` before render | Agent A |
| A-S4 | Template promotion audit lacks actor identity (super-admin pool) | Low | Medium | P2 | Audit row records `actor_user_id`, `actor_role`, `previous_status`, `new_status`, `reason` | Agent A |

## Cross-block dependencies (A-XB)

| # | Risk | Counterpart | Mitigation |
|---|---|---|---|
| A-XB1 | `source_reference` field type points to B's `tp_record_sources` | Block B EPIC-T8 | Field type ships with `null source_id` tolerance; full functionality requires both blocks deployed |
| A-XB2 | `template.governance_rules` consumed by C's `TableQaService` | Block C EPIC-T11 | A's S1 ships with documented `governance_rules` schema; C reads or ignores per presence |
| A-XB3 | `template.field_schema.source_required` flag consumed by C's QA Engine | Block C EPIC-T11 | A's S2 schema includes `source_required: boolean` per field; C reads it |

---

## Rollback strategy

### Tier 1 — Feature flag disable
- Set `featureTemplateLifecycleEnabled=false`. Effects:
  - `ArtifactModuleHome` reverts to showing all templates without filter.
  - Lifecycle badges hidden.
  - Approve / deprecate endpoints return 404.
  - 5 new field types remain in schema but pickers hide them.

### Tier 2 — Code revert
- All additive: `git revert <pr-merge-sha>`.
- Migration is reversible: drop the 5 new columns from `tp_base_templates`.

### Tier 3 — Hot patch
- If P0 lands post-merge: enable Tier 1, then ship a tiny fix or escalate to Tier 2 within the same business day.

---

## Risk monitoring

- Each sprint card opens with "Pre-sprint risk check" referencing this register.
- Each sprint card closes with "Realized risks" — risks that fired and resolution.
- Closeout aggregates realized risks under "Remaining Risks" with mitigation/owner.
- Cross-block dependencies (A-XB*) are checked at the barrier gate before Block C starts.
