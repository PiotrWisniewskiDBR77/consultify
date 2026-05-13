---
module_id: MODULE_PRESENTATIONS
doc_kind: DEEP_RAW_GAP_AUDIT
version: 1.0
owner: user
status: review
last_updated: 2026-05-11
scope_anchor: 12_prezentacje/MODULE_INTEGRATION
work_type: docs-only
---

# Deep RAW Gap Audit — MODULE_PRESENTATIONS

## 1. Audit Intent

Deepen RAW alignment and close contract gaps for module 12 in docs-only mode:

1. As-Is code-vs-docs gap audit (`/prezentacje` vs `/presentations`)
2. RAW decision hardening (`must/should/out`, delta classification, and evidence chains)

## 2. As-Is Runtime Truth (Code-Backed)

| Surface | As-Is truth | Evidence |
| --- | --- | --- |
| Lane route | `/prezentacje` exists as `ROUTES.PREZENTACJE_GEN` | `src/routes/routeConfig.ts` |
| Lane mount | `/prezentacje` renders `V4ComingSoonView` | `src/routes/AppRoutes.tsx`, `src/views/V4ComingSoonView.tsx` |
| Outputs route | `/presentations` exists as `ROUTES.PRESENTATIONS` | `src/routes/routeConfig.ts` |
| Outputs mount | `/presentations` renders `ReportsAndPresentationsHub` | `src/routes/AppRoutes.tsx`, `src/components/ReportsAndPresentations/ReportsAndPresentationsHub.tsx` |
| Active generator tools | `/presentations/wizard` and `/presentations/builder/:deckId` are mounted | `src/routes/AppRoutes.tsx`, `src/components/Presentations/PresentationWizard.tsx`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` |
| Standalone target runtime | `PrezentacjeView` exists, imported, not route-mounted on `/prezentacje` | `src/routes/AppRoutes.tsx`, `src/components/AIChat/KimiWorkspace/PrezentacjeView.tsx` |
| Sidebar split | separate entries for Outputs (`MODULE_PRESENTATIONS`) and lane (`MODULE_PREZENTACJE_GEN`) | `src/components/navigation/Sidebar/menuConfig.ts` |

## 3. RAW Synthesis (Deep)

### Must

1. Keep explicit ownership boundary: `/prezentacje` lane vs `/presentations` outputs runtime.
2. Keep AI governance: no silent write/share/export; explicit review/approval for high-impact actions.
3. Keep Menu 3 right-side-only doctrine for contextual AI actions.
4. Keep mandatory runtime state semantics (loading/empty/error/degraded/success) in contract truth.

### Should

1. Maintain Gamma-like flow continuity via active outputs runtime.
2. Provide explicit handoff guidance from blocked lane to active ownership route.
3. Keep lightweight UX (no duplicated toolbars).

### Out (this pass)

1. Runtime remount of `PrezentacjeView` on `/prezentacje`.
2. Runtime code edits.

## 4. As-Is / Target / Delta

| Domain | As-Is | Target | Delta |
| --- | --- | --- | --- |
| Route ownership | split is code-real and docs-real | keep split explicit and user-understandable | `KEEP + ENHANCE` |
| Lane UX | placeholder is generic interest/contact page | placeholder should explicitly point to active `/presentations` path | `ENHANCE` |
| Standalone generator | code exists but not mounted on lane route | either mount with governance or keep explicitly deferred | `DEFER_RUNTIME` |
| Governance | strong in product docs, partial in module acceptance granularity | hard-wire claims to function-level evidence | `ENHANCE` |
| Teresa deck-work execution rule | referenced in impact RAW (`104`) but not canonized in module-12 sources | must be either closed or explicit owner decision | `OWNER_DECISION_REQUIRED` |

## 5. KEEP / ENHANCE / NEW / DEFER

| Function | Decision |
| --- | --- |
| `PR_GEN_PLACEHOLDER` | `KEEP + ENHANCE` |
| `PR_GEN_RUNTIME_TARGET` | `NEW_DOC_TARGET + DEFER_RUNTIME` |
| `PR_OUTPUTS_OWNERSHIP_BOUNDARY` | `KEEP + ENHANCE` |

## 6. RAW -> Decision -> Evidence Chain

| RAW thesis | Decision | Evidence / status |
| --- | --- | --- |
| Presentation runtime must be governed artifact flow, not simple slide tool | `KEEP` | `docs/RAW/presentation-studio/96_RAW_PRESENTATION_STUDIO_GAMMA_CLASS_2026-05-09.md`, `docs/product/PREZENTACJE_V8_SSOT.md` |
| No silent high-impact operations (publish/export/share) | `KEEP` | `docs/product/PREZENTACJE_V8_AI_GOVERNANCE.md`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` |
| Lane and outputs runtime must not collapse into one ownership ambiguity | `KEEP` | `src/routes/routeConfig.ts`, `src/routes/AppRoutes.tsx`, `src/components/navigation/Sidebar/menuConfig.ts` |
| Active production generator flow runs in `/presentations` family | `KEEP` | `src/routes/AppRoutes.tsx`, `src/components/Presentations/PresentationWizard.tsx`, `src/components/Presentations/DeckBuilder/DeckBuilder.tsx` |
| Placeholder lane should explicitly hand off to active ownership route | `ENHANCE` | `NOT_DONE` (`V4ComingSoonView` copy remains generic) |
| Teresa deck-work execution doctrine should be hard-coded in module 12 docs | `OWNER_DECISION_REQUIRED` | `impact-only` source: `docs/UI_UX/104_RAW_CONVERSATIONAL_WORK_OS_TERESA_CHAT_ENGINE_2026-05-09.md` (no direct module-12 canonical closure yet) |
| Menu 3 / right-side only | `KEEP + ENHANCE` | module 12 docs + UI governance rules; function-level evidence depth still partial |

## 7. Gaps and Severity

| Gap ID | Severity | Gap | Needed closure |
| --- | --- | --- | --- |
| `PR-RAW-P0-001` | `P0` | `/prezentacje` placeholder does not explicitly route user to active `/presentations` ownership flow in copy contract | update function/UX acceptance clauses |
| `PR-RAW-P1-001` | `P1` | Teresa deck-work execution rule has no canonical closure in module 12 docs | explicit owner decision record (closed options) |
| `PR-RAW-P1-002` | `P1` | function-level state and Menu 3 evidence is not fully test-linked | deepen evidence rows in cards/tests pointers |
| `PR-RAW-P2-001` | `P2` | screenshot evidence path unavailable | provide asset or replace with approved evidence source |

## 8. Teresa Rule Status (Hard Rule Closure Record)

Status: `EXPLICIT_OWNER_DECISION_REQUIRED`

Decision options to close in docs:

- `OPTION_A_CLOSE_IMPACT_ONLY`: Teresa rule remains impact-only for module 12 (module 12 keeps ownership split and governance constraints only).
- `OPTION_B_CLOSE_AS_REQUIRED`: module 12 contract explicitly binds Teresa deck-work execution doctrine as a mandatory UX gate for future standalone runtime.

Current state in this pass: `PENDING_OWNER_DECISION` (explicitly recorded, not silent).

## 9. Final Verdict

- docs verdict: `NEEDS_OWNER_DECISION`
- runtime readiness context: `BLOCKED_P1`

Rationale:

1. Core `/prezentacje` vs `/presentations` ownership split is code-backed and contract-backed.
2. Deep RAW chain is complete with evidence and `NOT_DONE` flags.
3. Teresa hard-rule closure requires owner decision record to move from pending to closed.
