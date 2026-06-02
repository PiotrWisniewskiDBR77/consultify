# Risk Register — Table Studio Foundation Block

**Block ID:** `TABLE_STUDIO_FOUNDATION_BLOCK`
**Status:** `PLANNED`
**Severity scale:** P0 (block release) > P1 (must fix before merge) > P2 (allowed with mitigation) > P3 (note only)

---

## Technical risks (T)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| T1 | Widening `KimiLane` union breaks exhaustive switches in `KimiWorkspaceShell.tsx`, `useKimiArtifactPipeline.ts`, `ArtifactModuleHome.tsx`, `useModuleTemplates.ts`, `useModuleRecentArtifacts.ts` | Medium | Medium | P1 | TS `never`-check audit; `tsc --noEmit` in CI; dedicated 4-lane regression unit test (L2.4) | Agent B |
| T2 | `ArtifactPreview` shape extension breaks Wordy/Prezentacje/Excele consumers | Low | High | P1 | All new fields optional; snapshot tests on existing lanes; component test grid (L3.2) | Agent B |
| T3 | `useKimiArtifactPipeline` content-generation switch regression (lane-specific branches in lines ~376–630, ~870–900, ~910–929) | Medium | Medium | P1 | Add lane-mapping unit test that exercises all 4 lanes; preserve order of branches | Agent D |
| T4 | Governance routes silently leak proposals across tenants (existing routes — out of our edit scope but called from new frontend) | Low | Critical | P0 | Route-level tenant guard verification in L4.4 audit; cross-tenant 403 test; if leak found → STOP and file P0 follow-up | Agent A |
| T5 | `RelationExplainabilityService` grows unbounded in-memory reasoning cache before persistence backing | High | Low | P2 | Cap to 500 entries with FIFO eviction + warn log; persistence in next block | Agent A |
| T6 | New backend route under `/api/table-platform/...` collides with existing wildcard handler | Low | Medium | P1 | Mount BEFORE wildcards in `index.ts`; smoke test on existing `/api/table-platform/bases` after mount | Agent A |
| T7 | Builder deep-link `/my-work/sheets/:workspaceId/tables/:tableId` requires resolving `workspaceId` from `tableId`; resolver may fail for orphan tables | Medium | Low | P2 | Reuse `resolveTablePlatformWorkspaceIdForTable` from existing `sheetArtifactOpen.ts`; surface error toast if null | Agent D |
| T8 | i18n keys missing in PL locale at runtime cause console warnings | Medium | Low | P3 | i18n linter (`npm run i18n:check`) before merge; placeholder `defaultValue` on every `t()` call | Agent D |

## Product / UX risks (P)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| P1 | Users confuse Excele (one-shot xlsx) with Tabele (operational table-as-document) | High | Medium | P1 | Distinct icon (`Table`), sky accent (vs Excele emerald), distinct PL label "Tabele Studio" vs "Tabele", hero copy in `ArtifactModuleHome` explaining the difference | Agent D |
| P2 | Word-canvas preview feels heavy/slow for tables with ≤3 fields or 0 relations | Medium | Low | P2 | Auto-collapse Schema/Relation sections when below threshold; render skeleton during load | Agent C |
| P3 | Deep link to `/my-work/sheets/...` confuses users (different surface, sidebar shifts) | Medium | Medium | P2 | Open in NEW tab + transition toast "Opening Table Builder…"; preserve back-nav; never navigate same-tab | Agent D |
| P4 | DBR77 drift via ad-hoc accent colors in new components | Medium | Medium | P1 | Reuse Wordy/Prezentacje token patterns; lint custom rule for hex literals (L1.4); visual review (L6.2) | Agent C |
| P5 | Word-canvas idiom diverges from Wordy reference, breaks "looks analogous to Word documentation" promise | Medium | High | P1 | Side-by-side screenshot review (L6.4); component test mirrors Wordy structure | Agent C |
| P6 | Schema proposal queue surfaced in canvas without action affordances confuses users | Medium | Medium | P2 | Rationale section shows status pill + "Review proposals" link to existing governance UI; no new approval flow in canvas | Agent C |
| P7 | Builtin templates (8 cards) drift from real organizational table use cases | Low | Low | P3 | Mirror BUILTIN_TEMPLATES.excele structure; user-validate after Sprint 5 | Agent D |

## Security / tenant risks (S)

| # | Risk | Likelihood | Impact | Severity | Mitigation | Owner |
|---|---|---|---|---|---|---|
| S1 | Cross-tenant proposal listing via `/schema/proposals/*` (existing routes) | Low | Critical | P0 | L4.4 ACL audit (READ-ONLY); 403 test on every governance endpoint | Agent A |
| S2 | "Auto-approve when low risk" temptation creates hidden writes | Low | Critical | P0 | Hard rule: every proposal returns `proposalId`, no auto-execute path; audit log records `proposed_by`, `approved_by`; L7.2 code review | Agent A |
| S3 | Prompt injection via record content into governance reasoning | Medium | High | P1 | Quote-fenced injection of record snippets; reject any tool-call from record body; L7.3 review | Agent A |
| S4 | `relations/explain` exposes records actor cannot read | Medium | High | P1 | `explain()` filters targets by ACL BEFORE reasoning; L4.3 integration test | Agent A |
| S5 | Tabele lane API client leaks JWT in URL (deep link) | Low | High | P1 | Use existing `getHeaders()` Authorization pattern; never put tokens in URLs; code review | Agent B |
| S6 | New i18n strings allow XSS via interpolation | Low | Medium | P2 | All `t()` calls use safe defaults; no `dangerouslySetInnerHTML`; React-i18next default escaping | Agent D |
| S7 | `RelationExplainabilityService` calls LLM on every request, exposing tenant data to provider without retention controls | Medium | High | P1 | Honor existing `prompt-safety` guardrails (`services/chatToSchema/safetyGuardrails.ts`); cache responses with TTL; respect `confidentiality` flag from organization settings | Agent A |

---

## Rollback strategy (block-level)

### Tier 1 — Feature flag disable (no revert)
- Set `featureTabeleLaneEnabled=false` in env. Effects:
  - `Sidebar` removes Tabele entry.
  - `AppRoutes.tsx` `/tabele` returns 404 redirect.
  - `ArtifactModuleHome` lane=tabele branch unreachable.
  - Backend `relations/explain` route still mounted but unreachable from UI.

### Tier 2 — Backend disable
- Comment out `app.use('/api/table-platform', tablePlatformRelationsExplainRoutes)` line in `server/src/index.ts`.
- Single-line revert; no other backend impact.

### Tier 3 — Full PR revert
- All changes additive; `git revert <pr-merge-sha>` cleanly removes the block.
- No DB migration to roll back (governance/audit tables already existed).
- Other lanes (Wordy, Excele, Prezentacje) untouched, blast radius = 0.

### Tier 4 — Hot patch path
- If a P0 lands post-merge: enable Tier 1 immediately; investigate; ship a tiny fix or escalate to Tier 3 within the same business day.

---

## Risk monitoring during execution

- Each sprint card opens with a "Pre-sprint risk check" against this register.
- Each sprint card closes with a "Realized risks" section listing risks that fired and how they were resolved.
- Closeout (`03_BLOCK_CLOSEOUT.md`) aggregates realized risks under "Remaining Risks" with mitigation/owner.
