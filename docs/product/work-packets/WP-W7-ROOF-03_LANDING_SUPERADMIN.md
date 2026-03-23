# WP-W7-ROOF-03 — Landing and Broader Superadmin Analysis

> Packet: WP-W7-ROOF-03
> Wave: 7 — Roof hardening for weaker branches
> Status: completed
> Produced by: worker agent (bounded)
> Sources: see §9 context pack

---

## 1. Landing/onboarding readiness

### 1.1 Current documentation state

Landing is one of the weakest branches in the V8 canon. `SYSTEMATYKA_PRZEGLADU_V8.md` explicitly classifies it:

| Sub-area | Coverage | Assessment |
|---|---|---|
| Landing as a whole | `Czesciowe pokrycie` | Only `BUSINESS_POSITIONING_SSOT.md` exists; no full `LANDING_V8` package |
| Home page visuals | `Brak pakietu` | No visual/asset plan or landing content spec |
| Value proposition redefinition | `Czesciowe pokrycie` | Business narrative exists but no translation to page messaging system |
| Expert showcase | `Brak pakietu` | No expert catalog, role descriptions, or use-case mapping |
| Anna as LP AI guide | `Czesciowe pokrycie` | `ANNA_LP_ASSISTANT_CONTRACT_V8.md` exists but no full Landing IA embedding |

No dedicated `LANDING_V8_SSOT.md` exists. `SYSTEMATYKA_PRZEGLADU_V8.md` §5 recommends it as the #1 next canonical file to produce.

### 1.2 What exists in code and legacy docs

From `DEMO_TRIAL_V3.md` and `DEMO_TRIAL_ENTERPRISE_PLAN.md`:

- Landing has a topbar with a "Demo" button (`src/components/Landing/HeroSection.tsx`)
- Demo entry flow: login gate → language selection → start demo → Atelier ToolToys dataset
- Trial conversion path: Demo → "Start Trial" → create org + 7 days
- Demo/trial banners, limits, and telemetry events are partially implemented
- Some DBR77 visual refresh has been applied to demo/trial surfaces

From `BUSINESS_POSITIONING_SSOT.md`:

- Canonical positioning: "Consulting Intelligence Platform" / "Spotify for consulting knowledge"
- Five value layers: Inspiration → Knowledge → Frameworks → Guidance → Execution
- Full consulting journey: Understanding → Diagnosis → Designing initiatives → Execution → Results
- Product decision filter exists but is not translated into landing page sections

### 1.3 V8 gaps for Landing

| Gap | Severity | What is needed |
|---|---|---|
| **No Landing V8 SSOT** | Critical | A canonical doc defining: IA, hero messaging, section structure, value proof, expert system, CTA architecture, Anna embedding, and responsive/i18n requirements |
| **No page messaging system** | High | Translation of `BUSINESS_POSITIONING_SSOT.md` narrative into concrete headline/subhead/proof-point copy for each landing section |
| **No expert showcase model** | High | Catalog of experts/personas, their roles, descriptions, and mapping to use cases and value layers |
| **No visual/asset plan** | High | Image strategy, illustration system, screenshot/demo-video plan aligned with DBR77 visual language |
| **Anna LP integration incomplete** | Medium | `ANNA_LP_ASSISTANT_CONTRACT_V8.md` is referenced in the registry but the file is missing from the repository; the assistant contract needs to be restored and embedded into the landing IA |
| **Demo → Trial → Paid conversion UX** | Medium | Demo/trial mechanics exist (v3) but are not aligned with V8 product narrative; strategic CTA moments need V8 framing |
| **First-run / tenant setup experience** | Medium | No canonical doc for what happens after a user converts from trial: org creation wizard, initial context capture, Teresa introduction, first-value-moment design |
| **No onboarding journey spec** | Medium | The gap between "user signs up" and "user gets first value" is undocumented at V8 level |

### 1.4 What a Landing V8 package must contain

Based on the V8 Master Program requirements and the gap analysis:

1. `LANDING_V8_SSOT.md` — page IA, section definitions, messaging hierarchy, CTA architecture
2. Landing content spec — section-by-section copy framework anchored to `BUSINESS_POSITIONING_SSOT.md`
3. Expert showcase model — personas, credentials, use-case mapping
4. Anna LP assistant embedding — placement, trigger points, conversation starters, handoff to in-app Teresa
5. Demo/trial V8 alignment — update v3 demo/trial to use V8 product narrative
6. First-run onboarding spec — post-signup journey from org creation through first value moment
7. Visual/asset plan — aligned with DBR77 visual language

---

## 2. Superadmin partner control tower

### 2.1 Current state

`SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md` defines a comprehensive Partner Control Tower with 8 canonical families:

| Family | Key surfaces | Maturity |
|---|---|---|
| `Program Ops` | PartnerOrganizationsTable, LifecycleManager, TrackAssignment, TierReview, ManualOverride | Documented; not yet implemented as unified tower |
| `Applications` | ApplicationsQueue, ApplicationDetail, ApprovalRejectFlow, MissingDataRequests, AuditLog | Documented |
| `Directory` | ListingReview, FeaturedPartnerManager, ProfileQualityReview, SpecializationTaxonomy, RegionalTaxonomy | Documented |
| `Enablement` | AcademyCatalog, CertificationProgramManager, ResourcePublishing, TierBasedAccess, VersionExpiry | Documented |
| `Communications` | AnnouncementsComposer, SegmentedCampaigns, NewsPublishing, AcknowledgementTracking, CampaignPerformance | Documented |
| `Settlements` | SettlementsSummary, PendingCommissions, PendingPayouts, AttributionReview, ExpiringAttributions, CodeAnalytics, CommissionAuditTrail | Documented; partial implementation exists (settlements, config, outreach) |
| `Configuration` | CommissionRatesByTier, DiscountConfig, PayoutSettings, TrackPolicy, TierPolicy | Documented; partial implementation exists |
| `HealthAndReviews` | HealthDashboard, RiskFlags, InactivityAlerts, PerformanceScorecards, QuarterlyReviewWorkflow | Documented |

### 2.2 Completion plan alignment

`PARTNER_PROGRAM_PORTAL_AND_SUPERADMIN_COMPLETION_PLAN_V8.md` §4 defines 7 SuperAdmin addition areas (§4.1–§4.7) that map directly to the Control Tower families. The completion plan also specifies a 6-wave implementation order:

1. Canonicalize product and visibility (expose SuperAdmin partner branch)
2. Close partner program basics (onboarding, application, tier, payout readiness)
3. Close directory and profile growth loop
4. Close enablement layer
5. Close commercial growth layer
6. Close health and governance

### 2.3 Gaps

| Gap | Severity | Notes |
|---|---|---|
| **Mounting and visibility** | High | Strong tools (settlements, config, outreach) exist but remain hidden in orphaned views. The Control Tower doc explicitly calls this out: "operator truth should not be hidden in orphaned views" |
| **Unified IA branch** | High | No visible `Partner Program` branch in SuperAdmin navigation; tools are scattered |
| **Exception and dispute doctrine** | Medium | `AttributionDisputeQueue`, `ExceptionApproval`, `OverrideDecisionLog` are defined but have no implementation anchor |
| **Completion criteria not testable** | Medium | §14 criteria are qualitative ("lifecycle is governed", "settlements are auditable") but lack measurable acceptance gates |

---

## 3. Superadmin content operations

### 3.1 Current state

`HELP_KNOWLEDGE_BASE_SUPERADMIN_CONTENT_OPERATIONS_RUNTIME_V8.md` defines a full content operations layer for Help/Knowledge Base:

- **Core objects governed:** categories, domains, articles, guides, collections, learning paths, Teresa briefs, featured recommendations, article-to-module linkage, language coverage
- **Content lifecycle:** `draft → review → approved → published → deprecated → archived` with operational flags (`featured`, `recommended`, `internal_only`, `public_safe`, `needs_translation`, `needs_refresh`)
- **Recommendation operations:** home recommendations, help-panel featured content, Teresa-curated collections, module-specific featured content
- **Content quality operations:** title/summary quality, category/audience correctness, module linkage, bilingual completeness, staleness checks with 4 health states (`healthy`, `warning`, `stale`, `review_required`)
- **Teresa operations:** welcome framing, article intros, brief summaries, learning path intros, topic entry framing — all editable, not hardcoded
- **Analytics:** views, completion depth, saves, article-to-chat handoffs, article-to-module handoffs, feedback scores, low-performing content identification
- **Editorial workflows:** create, clone-and-adapt, save-as-draft, submit-for-review, publish, republish, deprecate-with-replacement

### 3.2 Relationship to existing AI Platform Knowledge area

The doc (§12) explicitly distinguishes:

- `Knowledge infrastructure` (documents, RAG) — the existing `SuperAdmin > AI Platform > Knowledge` area
- `Knowledge product operations` (articles, collections, recommendations, Teresa framing) — the new content ops layer

These must coexist without conflating infrastructure governance with editorial operations.

### 3.3 Gaps

| Gap | Severity | Notes |
|---|---|---|
| **No implementation anchor** | High | The content ops model is fully documented but has no code-level implementation plan or backlog |
| **Teresa framing governance** | Medium | Teresa guidance is currently prompt-hardcoded; the doc requires it to be editable and governable through SuperAdmin, which is a significant runtime change |
| **Bilingual completeness enforcement** | Medium | PL + EN coverage is required but no tooling exists to track or enforce it |
| **Analytics infrastructure** | Medium | Content analytics (views, depth, handoffs) require instrumentation that does not exist today |
| **Source governance** | Low | Specialist content needs source origin, author/curator, and refresh owner tracking — useful but not blocking |

---

## 4. Platform-wide admin capabilities

### 4.1 Broader Superadmin coverage assessment

`SYSTEMATYKA_PRZEGLADU_V8.md` classifies Superadmin as `Czesciowe pokrycie`:

- **Strong sub-package:** Virtual Workers (`VIRTUAL_WORKERS_SUPERADMIN_V8_READINESS_AUDIT.md`, benchmark, control plane, implementation plan) — this is already documentation-strong and implementation-ready
- **Strong sub-package:** Partner Control Tower (§2 above) — fully documented
- **Strong sub-package:** Help/KB Content Operations (§3 above) — fully documented
- **Missing:** General SuperAdmin operating model for remaining domains

### 4.2 Domains without SuperAdmin V8 coverage

The V8 Implementation Master Program (§4.2) identifies "Superadmin outside the already-strong Virtual Workers package" as needing roof-level hardening. The following SuperAdmin domains lack V8-level documentation:

| Domain | Current state | What is needed |
|---|---|---|
| **Organization/tenant management** | Legacy admin module docs only (`ADMIN_ORGANIZATION_MODULE_ANALYSIS.md`) | SuperAdmin view of all tenants: lifecycle, plan, usage, health, billing status |
| **User management (cross-tenant)** | No V8 doc | Platform-level user operations: impersonation, access review, account actions |
| **Platform configuration** | Scattered across module configs | Unified platform settings governance: feature flags, plan definitions, limit policies |
| **Demo/trial operations** | `DEMO_TRIAL_V3.md` mentions SuperAdmin telemetry | Demo/trial analytics dashboard, conversion funnel, usage stats (partially specified in v3 but not V8-canonical) |
| **Billing/subscription operations** | No V8 doc | Plan management, subscription lifecycle, payment operations, revenue visibility |
| **Platform health and observability** | Covered by Wave 1 `WP-W1-TRUST-01` for AI operations | Needs extension to cover full platform health: service status, error rates, performance, capacity |
| **Audit and compliance** | Wave 1 baseline exists | Needs SuperAdmin-specific audit console for cross-tenant compliance review |
| **Connector fleet management** | `WP-W5-EXT-03` defines platform operator access | Needs explicit SuperAdmin mounting for connector fleet health, promotion lifecycle, emergency controls |

### 4.3 SuperAdmin IA gap

There is no canonical document defining the full SuperAdmin information architecture. The existing docs define strong vertical packages (Virtual Workers, Partner Control Tower, Help/KB Content Ops) but no horizontal IA that organizes all SuperAdmin capabilities into one coherent navigation structure.

---

## 5. Wave 5 operator/admin integration

### 5.1 What Wave 5 established

`WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md` delivered:

- **Operator dashboard:** 7 dashboard views (connector fleet health, active/queued/failed runs, dead-letter queue, conflict queue, provider health, object-level sync status, reauth queue)
- **Support incident surfaces:** 7 reconstruction capabilities, sync-specific trace extension, 7 query dimensions
- **Admin control capabilities:** 7 lifecycle controls, 5 mapping/configuration controls, 6 dead-letter/conflict controls, 5 governance rules
- **Diagnostics:** 4 health checks, 4 sync status deep-dive tools, 4 event trace types
- **Connector promotion/demotion controls:** 6 promotion lifecycle controls, 3 demotion/rollback controls, 4 drift detection dimensions

### 5.2 Wave 5 decisions relevant to SuperAdmin

From `DECISION_LOG_WAVE_5.md`:

| Decision | Impact on SuperAdmin |
|---|---|
| **W5-9:** Connector packages as platform-managed assets | SuperAdmin owns connector package lifecycle; tenant admins own installation/configuration |
| **W5-10:** Support notes durability | Support notes must be durable and incident-scoped; visible to support and authorized operators |
| **W5-11:** Tenant-scoped emergency pause | Tenant admins get tenant-scoped emergency pause; platform operators (SuperAdmin) get cross-tenant emergency pause |

### 5.3 Integration gaps

| Gap | Severity | Notes |
|---|---|---|
| **SuperAdmin mounting of connector fleet** | High | WP-W5-EXT-03 §4.5 defines platform operator access to full diagnostic access across tenants, but no SuperAdmin navigation entry or mounting point is specified |
| **Cross-tenant connector operations** | Medium | Decision W5-9 establishes SuperAdmin as connector package lifecycle owner, but the SuperAdmin surfaces for package management (submit, approve, promote, deprecate, retire, rollback, emergency pause) are not yet mounted |
| **Support note console** | Medium | Decision W5-10 requires durable support notes, but no SuperAdmin surface for reviewing or searching support notes across tenants is defined |
| **Emergency controls visibility** | Medium | Decision W5-11 grants platform operators cross-tenant emergency pause, but the SuperAdmin UI for triggering and monitoring emergency pauses is not specified |

### 5.4 Alignment with WP-W5-EXT-03 downstream map

WP-W5-EXT-03 §7.1 explicitly lists "Wave 7 Organization/Admin hardening" as a downstream consumer: "Admin control capabilities defined here must be surfaced through the Organization/Admin UI." This confirms that the Wave 5 operator/admin surfaces are designed to be consumed by Wave 7 roof hardening — the integration path is intentional but the mounting work remains.

---

## 6. Priority ordering

### 6.1 Priority framework

Priorities are ordered by: (1) blocking risk to platform coherence, (2) dependency on earlier waves, (3) user-facing impact, (4) documentation readiness.

### 6.2 Recommended priority order

| Priority | Item | Rationale |
|---|---|---|
| **P0** | SuperAdmin unified IA and navigation | Without a coherent IA, all vertical packages (Virtual Workers, Partner Tower, Content Ops, Connector Fleet) remain orphaned. This is the structural prerequisite for everything else |
| **P0** | SuperAdmin connector fleet mounting | Wave 5 delivered the capability model; SuperAdmin needs to mount it. Decision W5-9 makes SuperAdmin the package lifecycle owner — this must be visible |
| **P1** | Partner Control Tower visibility | Strong tools exist but are hidden. Mounting under a visible branch is high-value, low-effort |
| **P1** | Landing V8 SSOT creation | Landing is the product's front door. No V8 doc means no V8-aligned first impression. This is a documentation gap, not an implementation gap — it should be closed before implementation begins |
| **P1** | Help/KB Content Ops implementation anchor | The content ops model is fully documented but has no implementation plan. Creating a backlog/wave plan is needed before work can start |
| **P2** | First-run onboarding spec | Important for conversion but depends on Landing V8 SSOT and demo/trial V8 alignment |
| **P2** | Demo/trial V8 alignment | Existing v3 mechanics work but need V8 narrative framing |
| **P2** | Platform-wide admin capabilities (org/tenant, user, billing) | Important for production operations but less urgent than mounting already-documented packages |
| **P2** | SuperAdmin audit and compliance console | Extends Wave 1 baseline; important for enterprise readiness but not blocking other work |
| **P3** | Expert showcase model | Valuable for landing but depends on Landing V8 SSOT |
| **P3** | Anna LP assistant restoration and embedding | Depends on Landing V8 SSOT and IA |

---

## 7. Downstream dependency map

### 7.1 What this analysis provides to later work

| Downstream capability | Dependency on this analysis |
|---|---|
| **Landing V8 SSOT creation** | Gap analysis (§1.3) and required contents list (§1.4) define the scope for the SSOT author |
| **SuperAdmin IA design** | Platform-wide admin gap analysis (§4.2–§4.3) provides the domain inventory for IA design |
| **Partner Program implementation** | Control Tower gap analysis (§2.3) and completion plan alignment (§2.2) confirm the implementation sequence |
| **Help/KB Content Ops implementation** | Gap analysis (§3.3) identifies the prerequisites before implementation can begin |
| **Wave 5 → Wave 7 integration** | Integration gaps (§5.3) provide the specific mounting work items needed |
| **Demo/trial V8 refresh** | Landing readiness assessment (§1.2–§1.3) identifies what must change in the demo/trial flow |

### 7.2 What this analysis depends on

| Upstream dependency | What it provides | Status |
|---|---|---|
| **V8_IMPLEMENTATION_MASTER_PROGRAM.md** | Wave 7 scope definition, Track F placement | Canonical |
| **SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md** | Partner Control Tower families and surfaces | Canonical |
| **PARTNER_PROGRAM_PORTAL_AND_SUPERADMIN_COMPLETION_PLAN_V8.md** | Missing package definition and implementation order | Canonical |
| **HELP_KNOWLEDGE_BASE_SUPERADMIN_CONTENT_OPERATIONS_RUNTIME_V8.md** | Content ops model | Canonical |
| **WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md** | Operator/admin capability model for connectors | Completed |
| **DECISION_LOG_WAVE_5.md** (W5-9, W5-10, W5-11) | Connector package ownership, support notes, emergency pause | Ratified |
| **BUSINESS_POSITIONING_SSOT.md** | Canonical business narrative for landing messaging | Canonical |
| **DEMO_TRIAL_V3.md** / **DEMO_TRIAL_ENTERPRISE_PLAN.md** | Current demo/trial mechanics | Legacy (v3) |
| **SYSTEMATYKA_PRZEGLADU_V8.md** | Coverage assessment for Landing and Superadmin | Canonical |

---

## 8. Open questions and conflicts

### 8.1 Missing ANNA_LP_ASSISTANT_CONTRACT_V8.md

`DOCUMENTATION_REGISTRY.md` lists `ANNA_LP_ASSISTANT_CONTRACT_V8.md` as a canonical doc with scope "public/landing assistant contract for Anna including persona, voice, knowledge boundaries, session memory limits and separation from tenant-bound assistants." However, the file does not exist in the repository.

**Assessment:** This is a gap, not a conflict. The registry entry describes what the doc should contain, but the file was either not created or was lost.

**Recommendation:** Restore or create `ANNA_LP_ASSISTANT_CONTRACT_V8.md` before Landing V8 SSOT work begins, as Anna's LP embedding depends on this contract.

### 8.2 Demo/trial docs are v3, not V8

`DEMO_TRIAL_V3.md` and `DEMO_TRIAL_ENTERPRISE_PLAN.md` define the demo/trial mechanics but are explicitly v3 documents. The V8 Implementation Master Program places Landing in Wave 7 (§8.8) and Track F (§6.6), but does not specify whether demo/trial should be refreshed as part of Landing V8 or remain at v3.

**Assessment:** Not a conflict — the v3 docs are operational and partially implemented. The V8 program is silent on demo/trial refresh timing.

**Recommendation:** Demo/trial V8 alignment should be scoped as part of the Landing V8 SSOT work, not as a separate workstream. The v3 mechanics are sound; what is needed is V8 narrative framing, not a rewrite.

### 8.3 SuperAdmin IA ownership: no single canonical doc

The V8 canon has strong vertical SuperAdmin packages (Virtual Workers, Partner Control Tower, Help/KB Content Ops, Connector Fleet from Wave 5) but no horizontal doc that defines the full SuperAdmin IA. `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §4.2 identifies this gap ("Superadmin outside the already-strong Virtual Workers package") but does not assign ownership.

**Assessment:** Not a conflict — this is an acknowledged gap. The vertical packages are internally consistent and do not contradict each other.

**Recommendation:** A `SUPERADMIN_V8_SSOT.md` or `SUPERADMIN_IA_AND_OPERATING_MODEL_V8.md` should be created to define the horizontal IA and mount all vertical packages under one coherent navigation structure. This should be a P0 deliverable before SuperAdmin implementation begins.

### 8.4 No conflicts detected between canonical docs

The following pairs were checked for consistency:

- `SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md` ↔ `PARTNER_PROGRAM_PORTAL_AND_SUPERADMIN_COMPLETION_PLAN_V8.md`: Aligned. The Control Tower defines the target model; the Completion Plan defines what must be added. Surface names and families match.
- `HELP_KNOWLEDGE_BASE_SUPERADMIN_CONTENT_OPERATIONS_RUNTIME_V8.md` ↔ `SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md`: No overlap. They govern different domains (Help/KB vs Partner Program) with no shared surfaces.
- `WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md` ↔ `SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md`: No overlap. Wave 5 covers connector/sync operator surfaces; Partner Control Tower covers partner program governance. The diagnostic access model (§4.5) grants SuperAdmin full cross-tenant access, which is consistent with the Control Tower's platform-level governance model.
- `DECISION_LOG_WAVE_5.md` (W5-9, W5-10, W5-11) ↔ `WP-W5-EXT-03`: Aligned. Decisions ratify the recommendations made in the analysis.

### 8.5 Questions requiring escalation

1. **Should `ANNA_LP_ASSISTANT_CONTRACT_V8.md` be restored or recreated?** The registry entry exists but the file is missing. If it was intentionally removed, the registry should be updated. If it was lost, it should be recreated before Landing V8 work begins.
2. **Should a `SUPERADMIN_V8_SSOT.md` be created as a Wave 7 deliverable?** The vertical packages are strong but the horizontal IA is missing. This is the structural prerequisite for mounting all SuperAdmin capabilities coherently.
3. **Should demo/trial be refreshed to V8 as part of Landing V8, or remain at v3?** The v3 mechanics work but the narrative framing is pre-V8.

---

## 9. Packet output

### 9.1 Context pack

Canonical docs read:
- `SUPERADMIN_PARTNER_CONTROL_TOWER_RUNTIME_V8.md`
- `PARTNER_PROGRAM_PORTAL_AND_SUPERADMIN_COMPLETION_PLAN_V8.md`
- `HELP_KNOWLEDGE_BASE_SUPERADMIN_CONTENT_OPERATIONS_RUNTIME_V8.md`

Supporting anchors read:
- `V8_IMPLEMENTATION_MASTER_PROGRAM.md` §8.8 (Wave 7), §4.2 (weak branches), §6.6 (Track F)
- `WP-W5-EXT-03_OPERATOR_ADMIN_SURFACES.md`
- `DECISION_LOG_WAVE_5.md` (Decisions W5-9, W5-10, W5-11)
- `BUSINESS_POSITIONING_SSOT.md`
- `DEMO_TRIAL_V3.md`
- `DEMO_TRIAL_ENTERPRISE_PLAN.md`
- `SYSTEMATYKA_PRZEGLADU_V8.md`
- `DOCUMENTATION_REGISTRY.md` (Landing and Superadmin entries)

### 9.2 Summary

- **Status:** completed
- **Completed:**
  - Landing/onboarding readiness: 7 gaps identified, required package contents defined (7 items), no V8 SSOT exists (critical gap)
  - Superadmin Partner Control Tower: 8 families documented, 4 gaps identified, completion plan aligned with 6-wave sequence
  - Superadmin Content Operations: full content ops model documented, 5 gaps identified (no implementation anchor is highest)
  - Platform-wide admin capabilities: 8 domains without V8 coverage identified, SuperAdmin IA gap confirmed
  - Wave 5 integration: 4 integration gaps identified, downstream dependency path confirmed
  - Priority ordering: 11 items across P0–P3, with SuperAdmin unified IA and connector fleet mounting as P0
  - Downstream dependency map: 6 downstream consumers, 10 upstream dependencies
  - Open questions and conflict analysis: 5 items, 0 conflicts between canonical docs, 3 questions requiring escalation
- **Remaining:** none within packet scope
- **Blockers or risks:**
  - Missing `ANNA_LP_ASSISTANT_CONTRACT_V8.md` — registry entry exists but file is absent (§8.1)
  - No SuperAdmin horizontal IA doc — vertical packages are strong but unmounted (§8.3)
- **Questions requiring escalation:**
  1. Should `ANNA_LP_ASSISTANT_CONTRACT_V8.md` be restored or recreated? (§8.1)
  2. Should a `SUPERADMIN_V8_SSOT.md` be created as a Wave 7 deliverable? (§8.3)
  3. Should demo/trial be refreshed to V8 as part of Landing V8, or remain at v3? (§8.2)
