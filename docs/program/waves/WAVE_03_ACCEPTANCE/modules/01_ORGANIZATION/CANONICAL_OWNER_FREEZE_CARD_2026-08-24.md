# Organization — canonical owner freeze card — 2026-08-24

Status: `READY_FOR_QUICK_OWNER_REVIEW / VERDICT_PENDING`  
Candidate component: `src/views/OrganizationView.tsx`  
Entry route: `/organization`  
Current product runtime: `NOT REPLAYED ON THIS CANDIDATE`  
Owner acceptance: `NOT GRANTED`

## One-sentence contract

Organization builds one governed, evidence-backed description of the company
that downstream modules can read without confusing business context with
administration, settings or a second competing source of truth.

## Proposed canonical information architecture

Keep one stable shell and exactly six primary destinations in the vertical
Organization navigation:

1. `Profil organizacji` — identity and scale; operating model; position and
   direction; technology, culture and constraints.
2. `Cele i oczekiwania` — strategic intent; success measures; scope and
   boundaries; stakeholder expectations.
3. `Wyzwania` — declared challenges; root causes; goal blockers; evidence.
4. `Synteza strategiczna` — risks and opportunities; scenarios;
   recommendation; executive brief.
5. `Źródła i wiedza` — files; claims and sources; source conflicts; knowledge
   graph as a secondary view, not another primary module.
6. `Gotowość i nadzór` — completeness, freshness, conflicts, decisions and
   publication/version state.

The sequence is:

`Profil -> Cele -> Wyzwania -> Synteza -> Źródła -> Gotowość`

This is already represented by `ORGANIZATION_MODULES` in
`src/components/Organization/OrganizationSidebar.tsx`. `Megatrendy` is absent
and `/organization/megatrends` redirects to the canonical Tools route.
Administration entries are absent and legacy Organization administration URLs
redirect to the dedicated Admin module.

## Keep

- `OrganizationView` as the only selected route-level shell.
- `OrganizationSidebar` / shared `DomainNavigation` as the navigation system.
- One consistent header, content width and mobile drawer across every screen.
- `OrganizationProfileModule`, `GoalsExpectationsModule`,
  `ChallengeMapModule` and `StrategicSynthesisModule` as the selected working
  implementations pending visual owner review.
- Files, governed claims, source conflicts and Knowledge Graph inside the
  `Źródła i wiedza` boundary.
- Readiness and publication/version evidence inside `Gotowość i nadzór`.
- The visible unsynced state until a server write and matching cold readback
  are confirmed.

## Remove / forbid

- `Megatrendy` as an Organization navigation item.
- `Administracja` as an Organization navigation section.
- `ContextBuilderView` as a second route-level canonical Organization shell.
- The historical screenshot as a complete target. It is
  `USEFUL_FRAGMENT`, not acceptance evidence.
- Any profile write into the legacy context-store profile blob.
- Any claim that source tests or an old isolated replay prove the current
  integrated runtime or owner acceptance.

## Data and API ownership

| Business object | Canonical owner | Current connection | Freeze condition |
|---|---|---|---|
| Organization profile | `organization_profiles` plus core organization fields | `/api/organization-profiles/:orgId` | same-tenant read; privileged write; save receipt and cold readback |
| Goals, challenges, synthesis | `organization_context_store` | `GET/PUT /api/organization-context-store` | tenant-bound payload; persisted version; exact readback match |
| Files, claims, decisions, snapshots | governed Organization context services | Organization source/governance components | provenance, role, version and immutable snapshot visible |
| Knowledge graph | knowledge graph service | `/api/knowledge-graph/*` | derived view only; no competing ownership of profile/context |

The context-store route explicitly keeps the historical company-profile blob
read-only and returns `companyProfileOwnership: organization_profiles`.

## Still requiring owner confirmation

The earlier owner register contains seven open design questions. They are not
silently resolved by the code or expert proposals. For the quick freeze, the
owner needs to confirm only these three decisions:

1. **Primary structure:** accept the six destinations and sequence above, or
   name the destination that must change.
2. **Profile hierarchy:** accept the four Profile child screens above, or name
   the grouping that must change.
3. **Governance boundary:** accept Sources and Readiness as primary cards with
   Knowledge Graph secondary, or request a different placement.

Minimum business dataset, readiness formula, entity scope, accountability and
AI-settings boundary remain implementation requirements from `ORG-Q-004..007`;
they must be reconciled before the module can pass its 21 gates, but they do
not justify inventing another shell.

## Quick owner walkthrough

1. Open `/organization/profile/identity-scale` and judge the shared shell and
   four Profile child screens.
2. Move once through Goals, Challenges and Strategic Synthesis; navigation
   mechanics must not change between them.
3. Open Files/Claims and Readiness; verify that provenance, completeness and
   version state are understandable without technical labels dominating the
   screen.
4. Confirm that neither Megatrends nor Administration appears.

Required verdict: `ACCEPT`, `CHANGE` or `BLOCKED`. Every comment remains an
atomic observation until an explicit verdict is recorded.

## Evidence boundaries

- Route/component/navigation inspection: `CURRENT SOURCE EVIDENCE`.
- Earlier isolated PostgreSQL/browser evidence in `MODULE_ACCEPTANCE.md`:
  `HISTORICAL TECHNICAL EVIDENCE`, not current integrated replay.
- Current saved visual: `USEFUL_FRAGMENT`.
- Current integrated data/browser/readback: `NOT YET REPLAYED`.
- Owner acceptance and production release: `NOT GRANTED`.

