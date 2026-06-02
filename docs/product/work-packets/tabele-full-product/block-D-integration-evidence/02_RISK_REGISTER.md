# Risk Register — Block D: Integration & Evidence

**Block ID:** `TABELE_BLOCK_D_INTEGRATION_EVIDENCE`
**Status:** `PLANNED`

---

## Technical risks (D-T)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| D-T1 | V8 snapshot shape drift between Tabele and Wordy/Prezentacje conversion targets | Medium | High | P1 | Shared `V8Snapshot` contract; contract tests for each artifact target | Agent A |
| D-T2 | Conversion takes too long for large tables; UI blocks | High | Medium | P1 | Async job + notification on completion; show progress in toast | Agent A |
| D-T3 | Public form schema drift breaks live forms when admin edits the table schema | Medium | Medium | P2 | Snapshot form schema at publish time; warn admin if subsequent table change breaks form | Agent A |
| D-T4 | JWT secret rotation breaks live links | Low | Medium | P2 | Per-form `public_jwt_secret`; rotation requires re-publish; expiry communicated | Agent A |
| D-T5 | Public form abuse (bot spam) overwhelms record table | Medium | Medium | P2 | Rate limit per IP and per token; CAPTCHA on free tier; soft-cap submissions per day | Agent A |

## Product / UX risks (D-P)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| D-P1 | Convert button confused with "Create new" | Medium | Low | P3 | Icon + label "Convert to..." | Agent C |
| D-P2 | Resulting Wordy doc lacks clear table provenance citation | Medium | Medium | P2 | V8 snapshot includes records' confidence + sources; Wordy renders citation block | Agent C |
| D-P3 | Public form looks unbranded / generic | Medium | Low | P3 | Use organization's logo + name; DBR77 styling | Agent C |
| D-P4 | "Field allow-list" UX too technical for non-admins | Medium | Medium | P2 | Default to "all visible non-PII fields"; advanced toggle for power users | Agent B |

## Security / tenant risks (D-S)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| D-S1 | Public form leaks tenant data through field harvest | High | Critical | P0 | Field allow-list enforced server-side; default deny; L7.5 review | Agent A |
| D-S2 | JWT secret leak via URL bookmarks shared in screenshots | Low | High | P1 | Token in body, not URL; URL has opaque short ID; token issued per session | Agent A |
| D-S3 | Conversion service exposes records actor cannot see | Medium | High | P1 | ACL filter on records BEFORE building V8 snapshot; L7.4 | Agent A |
| D-S4 | Cross-tenant submission via stolen public token | Low | Medium | P2 | Token claims include tenant_id + form_id; mismatch rejected | Agent A |
| D-S5 | XSS via form text submissions | Medium | Medium | P2 | Sanitize on render in Tabele grid; do not render raw HTML | Agent B |

## Cross-block dependencies (D-XB)

| # | Risk | Counterpart | Mitigation |
|---|---|---|---|
| D-XB1 | Conversion service consumes Block C's `SourcePackService` V8 snapshot | Block C EPIC-T12 | Stable contract documented in EPIC-T12 |
| D-XB2 | Conversion respects Block B's `confidence_score`/`validation_status` | Block B EPIC-T9 | V8 snapshot includes both fields per record |
| D-XB3 | Form intake writes provenance with type `form_submission` (Block B's source type union) | Block B EPIC-T8 | Schema already accommodates |

---

## Rollback strategy

### Tier 1 — Feature flag
- `featureTabeleIntegrationEnabled=false` → buttons hidden; public form endpoint returns 404; conversion endpoints return 404.

### Tier 2 — Code revert
- All additive: `git revert <pr>`.

### Tier 3 — Migration rollback
- `ALTER TABLE tp_forms DROP COLUMN embed_target_table_id, public_jwt_secret, field_allow_list`.

### Tier 4 — Hot patch
- If P0 lands post-merge: enable Tier 1; investigate; fix or escalate.
