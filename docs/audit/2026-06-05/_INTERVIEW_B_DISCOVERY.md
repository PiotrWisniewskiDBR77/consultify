# Interview B — Discovery Module Audit (code-verified)

**Date:** 2026-06-05
**Branch:** `feat/wave1-foundations`
**Auditor scope:** Discovery (canvas-based SPIN discovery consultant + the misnamed "Discovery Tools" hub). Excludes structured Interview module and Interview Enterprise (separate agents).
**Method:** Full reads of every file in `src/components/Discovery/**`, `src/store/useDiscoveryStore.ts`, `src/types/discovery.ts`, `src/components/Discovery/ai/discoveryPrompts.ts`, plus exhaustive grep of `server/src/routes` and `server/src/services` for any discovery persistence.

---

## Score: 14 / 100

**One-line justification:** The "Discovery Consultant" canvas product described in the brief (live conversation → pain/insight/quote nodes → recommendations → convert-to-project) is **a fully orphaned, never-rendered, backend-less front-end demo whose AI extraction can never fire** because its system prompt is never sent to any LLM and its route renders the Interview module instead. The only thing under `Discovery/` that ships is `DiscoveryToolsHub`, which is a *different product* (a real, backend-integrated strategic-tools library) that happens to share the folder name. The score reflects: the consultant subsystem ≈ 5/100 (dead code with a non-functional pipeline), the ToolsHub ≈ 60/100 (real but out of this audit's intended subject), averaged and weighted toward the named subject.

---

## THE REAL-OR-DEMO VERDICT (most important finding)

**The Discovery Consultant (the SPIN canvas tool this audit was commissioned to evaluate) is dead demo code. It is not reachable, not persisted, and its extraction pipeline is structurally incapable of producing a single node.**

Three independent, individually-fatal facts establish this:

1. **It is never rendered.** `DiscoveryConsultantView` is lazy-imported in `src/routes/AppRoutes.tsx:233` but appears in **zero** JSX. The route that *should* mount it — `ROUTES.DISCOVERY_CONSULTANT` — renders `<InterviewHub />` instead (`AppRoutes.tsx:1360-1373`, comment: *"Discovery Consultant - Redirects to Interview Hub"*). `index.ts:9` self-documents it: *"Legacy - use InterviewHub"*. Grep `<DiscoveryConsultantView` → only the definition, no usage.

2. **There is no backend.** Exhaustive grep of `server/src` for `discovery_session`, `discoverySession`, `/discovery/sessions`, `convert`, etc. returns **nothing**. The store fires `Api.put('/discovery/sessions/:id')` (`useDiscoveryStore.ts:278`), `Api.post('/discovery/sessions/convert')` (`:677`), `Api.post('/discovery/sessions/:id/attach')` (`:720`), `Api.get('/discovery/sessions/:id')` (`:217`), `Api.delete('/discovery/sessions/:id')` (`:296`) — **none of these routes exist**. Every call 404s, and every `catch` block swallows the error and silently keeps local state (`:284-291`, `:297-299`). Persistence is `localStorage` only, via the Zustand `persist` middleware (`:836-844`), and it only persists `sessions` + `activeSessionId`.

3. **The AI extraction cannot fire.** The SPIN system prompt (`discoveryPrompts.ts:DISCOVERY_SYSTEM_PROMPT`) — the thing that instructs the model to append a ```json extraction block — is **never imported by any runtime code** (grep: only `ai/discoveryPrompts.ts` self and `index.ts` re-export). The sync hook `useDiscoverySync.ts` parses an extraction block out of the **main chat panel's** AI messages (`activeChatMessages`), but nothing ever injects the discovery system prompt into that chat. So the main chat AI is never told to emit `{"extraction": {...}}`, the regex `parseExtraction` (`useDiscoverySync.ts:21-40`) never matches, `processExtraction` is never called, and the canvas stays empty forever. The empty-state copy ("Start the conversation and AI will automatically add findings to the board", `DiscoveryCanvas.tsx:144`) is a promise the code cannot keep.

Net: a consultant could open this view (if it were routed), talk all day, and **get zero nodes, zero recommendations, zero persistence, and a convert button that never appears.**

### What IS real (and why it muddies the verdict)

`DiscoveryToolsHub.tsx` (4651 lines, actively maintained — last touched Jun 4) is a **genuinely backend-integrated** module, but it is a *strategic-tools library*, not the discovery-conversation canvas. Its header comment (`:1-7`) says it plainly: *"unified 'Tools' hub … Library → Sessions → Reports & Presentations → Initiatives. Categories: Strategy, Operations, Digital, Process Automation, Licensed."* It calls real endpoints: `Api.listToolSessions` (real route — `useToolStore`/tool-platform), `Api.listAssessments`, `Api.getAssessmentReports`, `Api.get('/report-builder')`, `Api.get('/presentations/decks')`, `Api.patch('/initiatives/:id/status')` (`:902-932`, `:1229`, `:2777`). It has graceful bootstrap fallbacks and real status mapping. This is the only "Discovery" thing on a live route (`AppRoutes.tsx:1407+`, gated by `ProductionModuleGate`). **It shares the folder name with the dead consultant but is otherwise unrelated.** Its persistence lives in the separate `useToolStore` + tool-platform backend, not in `useDiscoveryStore`.

---

## P0 — blockers / "it's a lie" findings

- **P0-1 — The consultant view is never mounted; the route lies.** `AppRoutes.tsx:1360-1373` mounts `InterviewHub` under `ROUTES.DISCOVERY_CONSULTANT`. `DiscoveryConsultantView` (lazy-imported `:233`) has no JSX site. **Decision required: delete it, or actually wire it.** Right now it is ~1,800 LOC of dead weight (view + canvas + header + footer + panel + modal + 8 nodes + store + prompts + types).

- **P0-2 — No backend persistence whatsoever.** `useDiscoveryStore.ts:217,278,296,677,720` all target non-existent `/discovery/sessions*` routes. A "session" survives reload **only** via localStorage and **only** on the same browser/device; it is invisible to the team, to the server, and to any other surface. The brief's question "does a session survive a reload?" — yes, locally; "are nodes/edges saved to a backend table?" — **no, there is no table and no route.**

- **P0-3 — Extraction pipeline is structurally inert.** `discoveryPrompts.ts` system prompt never injected anywhere (grep proven). `useDiscoverySync` depends on the *main chat* emitting a discovery-specific JSON block it is never instructed to produce. The entire "live conversation → nodes" promise is non-functional. This is the headline capability of the product and it does not exist in running code.

- **P0-4 — Recommendation engine produces nothing; it is not even hardcoded.** `setRecommendations` (`useDiscoveryStore.ts:480`) has **zero callers** anywhere in `src` (grep proven). `recommendations.transformationType` is initialized to `null` (`:30-37`) and never changes. Consequences cascade:
  - `RecommendationPanel` renders the empty placeholder forever (`RecommendationPanel.tsx:34-45`, gated on `transformationType !== null`).
  - `matchScore` stays `0` (`:212`) — so the "match score" the brief asks about is **neither real logic nor hardcoded; it is a permanently-zero stub**.
  - `DiscoveryFooterActions` gates "Start Project" and "Attach to Project" behind `hasRecommendations` (`DiscoveryFooterActions.tsx:101,123,149`) — both buttons **never render**, so even the dead view can't reach conversion through its own UI.
  - `ProjectConversionModal` always shows `0 initiatives` and no transformation type (`ProjectConversionModal.tsx:133,172`).

- **P0-5 — Convert-to-project produces nothing real (and can't be reached anyway).** `convertToProject` (`useDiscoveryStore.ts:668-712`) POSTs to the non-existent `/discovery/sessions/convert`. There is no backend handler, so it always rejects; the modal shows its error path (`ProjectConversionModal.tsx:55-58`). Even if the route existed, the payload it would send (`painPoints`, `insights`, empty `recommendations`) carries no real recommendation/initiative data because P0-4. **Verdict: convert-to-project creates zero real entities — it creates nothing, because it 404s.** (Contrast with the Canvas audit's "fake entities" disease — here it's worse: not even fake entities, just a dead POST.)

---

## P1 — serious

- **P1-1 — Phase progression is cosmetic.** `advancePhase` and `setPhase` (`useDiscoveryStore.ts:327,348`) have **zero callers** outside the store/types (grep proven). `canAdvancePhase`'s gating logic (`:332-346`) is never exercised. `DiscoveryHeader`'s `PhaseIndicator` (`DiscoveryHeader.tsx:13-59`) reads `currentPhase`, which only ever holds `'welcome'`. The welcome→context→…→decision tracker is pure decoration with no driver.

- **P1-2 — `InsightDetailView.tsx` (601 LOC) is fully dead.** Rendered by nobody (grep: no importer outside its own file). Large, polished, completely orphaned.

- **P1-3 — `DiscoveryHeader`, `DiscoveryFooterActions`, `RecommendationPanel`, `ProjectConversionModal`, `DiscoveryCanvas`, and all 8 node components are dead-by-transitivity** — only ever rendered (if at all) by the un-routed `DiscoveryConsultantView`. They are well-built (see "working well") but currently unreachable.

- **P1-4 — Security cannot be assessed because there is no backend, but the localStorage persistence is org-blind.** Discovery sessions are stored under the global key `consultify-discovery` (`useDiscoveryStore.ts:837`) with **no org/user scoping**. If/when this is wired to a backend, the convert/attach/save routes must enforce auth + org-scoping; today there is nothing to scope. Client PII (company name, role, pain quotes verbatim — see `QuoteNodeData`) sits in plaintext localStorage indefinitely with no TTL and no clear-on-logout (not verified to be cleared anywhere).

- **P1-5 — Silent failure masking.** Every store API call swallows errors and proceeds with local state (`:284-291`, `:297-299`, the bootstrap pattern). In the dead view this is moot, but the pattern means a future wiring would *appear* to work while persisting nothing — exactly the failure mode that let this ship dead for months.

---

## P2 — quality / hygiene

- **P2-1 — `id` generation collision risk.** `generateId()` uses `Date.now()` for nodes (`:125`, ok-ish with random suffix) but `addEdge` uses bare `edge_${Date.now()}` (`:442`) — two edges added in the same ms collide. Harmless today (dead), real if revived.
- **P2-2 — `Api.get('/api/initiatives/${id}')` double-prefix.** `DiscoveryToolsHub.tsx:2052` uses `/api/initiatives/...` while every sibling call uses `/initiatives/...` (`:1229,:2777`). One of these is wrong relative to the Api base path; likely the `/api/` one 404s. (In the live ToolsHub, so worth a quick check.)
- **P2-3 — `onClose` prop on `DiscoveryConsultantView` is declared but unused** (`DiscoveryConsultantView.tsx:22,25`). Dead within dead.
- **P2-4 — `console.log` instrumentation throughout the store** (`:205,242,283,...`) — fine for a prototype, noise for production.
- **P2-5 — Type/impl drift.** `types/discovery.ts:286` declares `convertToProject: () => Promise<string>` (no args) but the impl takes `(projectName, options)` (`useDiscoveryStore.ts:668`). The `DiscoveryStoreActions` interface (`types/discovery.ts:250-291`) is largely aspirational and out of sync with the actual store.
- **P2-6 — `discoveryPrompts.ts` hardcodes the DBR77 persona** ("Senior Partner w DBR77 Industrial Intelligence", `:13`). Per v1 scope (HBS brand decision), DBR77 branding in prompts is a liability if this is ever revived for a non-DBR77 tenant.

---

## Convert-to-project integrity

**Verdict: produces NO entities — real or fake.** The conversion path (`useDiscoveryStore.ts:668-712` → `Api.post('/discovery/sessions/convert')`) targets a route that does not exist; the call rejects, the modal shows its error state. There is no backend handler that creates a Project, no handler that creates Initiatives, no `initiativesCreated` count source. The `ConvertToProjectResponse` type (`types/discovery.ts:341-344`) describes a contract with no implementation on either side. Additionally the conversion is **unreachable through the UI** because the "Start Project" button is gated on `hasRecommendations` which is permanently false (P0-4/P0-5). This is *cleaner-but-deader* than the Canvas promote-path disease: Canvas at least created fake entities; Discovery creates nothing.

---

## Phase progression — verdict

Cosmetic. `currentPhase` never leaves `'welcome'` because the only mutators (`advancePhase`/`setPhase`) are never invoked. The `PHASE_CONFIGS` min-requirements gating (`types/discovery.ts:407-460`, evaluated in `canAdvancePhase` `:332-346`) is dead logic. The tracker is a static SVG-equivalent.

---

## AI prompt quality (SPIN)

Read `discoveryPrompts.ts` in full. **As a prompt artifact in isolation, it is genuinely good** — the one bright spot in the consultant subsystem:
- Proper SPIN adaptation (Situation/Problem/Implication/Need-payoff) with consulting framing.
- Strong conversational discipline rules (one question at a time, 2-3 sentence answers, acknowledge before asking).
- **Structured JSON extraction is enforced** with a precise schema (painPoints/insights/quotes/clientContext/phaseProgress), severity rubric (1-5), area taxonomy (process/technology/people/data), and transformation typing.
- **PL/EN handling is explicit** (`:15` "Polski (przełącz na angielski jeśli użytkownik pisze po angielsku)").
- Injects assessment frameworks (DRD/SIRI/ADMA/CMMI/LEAN) and a tool catalog.

**But:** (a) it is never sent to any model, so all of the above is theoretical; (b) `## Aktualny kontekst rozmowy będzie podany poniżej` (`:142`) promises client-context injection that no caller wires; (c) the extraction schema in the prompt and the `ExtractedEntities` TS type match well, which makes the *non-wiring* the only thing standing between this and a working pipeline. The prompt is the highest-leverage salvageable asset here.

---

## Node-type coverage

All 8 declared node types (`painPoint/insight/opportunity/quote/recommendation/tool/assessment/initiative`) have **real, polished, interactive React Flow components** (read `RecommendationNode`, `InitiativeNode`, confirmed `nodes/index.ts:47-64` maps all 8 + 5 shared diagram nodes). Handles, severity/confidence meters, impact/effort badges, quick-win flags, i18n — all present and decent quality. **They are not placeholders.** The tragedy is they render only what `processExtraction` feeds them, and `processExtraction` is never called (P0-3). So: components real, data flow dead.

---

## Recommendation engine

`DiscoveryRecommendations` (transformationType, matchScore, frameworks, tools, initiatives) has a full type, a full UI (`RecommendationPanel`), and a setter (`setRecommendations`) — and **no producer**. There is no scoring function, no LLM call that fills it, no heuristic, nothing. `matchScore` is a literal `0` initializer that never updates. The brief asks "is match-score real logic or hardcoded?" — neither: **it is a perpetual zero.**

---

## Discovery ↔ Interview relationship

Architecturally separate with **zero bridge** (grep: no `useDiscoveryStore`/`types/discovery` import anywhere under `src/components/Interview`). They overlap conceptually — Interview *also* produces pain points / insights (`Interview/InsightViewer.tsx`, `InterviewWorkspace.tsx`) and is the module the `DISCOVERY_CONSULTANT` route actually mounts. **Interview has already de facto superseded the Discovery consultant** — the routing redirect and the `index.ts:9` "Legacy - use InterviewHub" comment make this an intentional, half-completed migration. The two were never integrated; one simply replaced the other in routing while the loser was left as dead code.

---

## Dead / stubbed inventory (the Discovery consultant subsystem)

| File | LOC | Status |
|---|---|---|
| `DiscoveryConsultantView.tsx` | 111 | **Dead** — never rendered; route → InterviewHub |
| `DiscoveryCanvas.tsx` | 346 | **Dead** (only via ConsultantView). Well-built. |
| `DiscoveryHeader.tsx` | 138 | **Dead** (only via ConsultantView) |
| `DiscoveryFooterActions.tsx` | 163 | **Dead** (only via ConsultantView) |
| `RecommendationPanel.tsx` | 262 | **Dead** + shows nothing (P0-4) |
| `ProjectConversionModal.tsx` | 232 | **Dead** + 404s on submit (P0-5) |
| `InsightDetailView.tsx` | 601 | **Dead** — no importer at all |
| `nodes/*` (8 components) | ~30KB | **Dead by transitivity**; quality is real |
| `hooks/useDiscoverySync.ts` | 77 | **Inert** — parses a block never produced |
| `hooks/useAutoLayout.ts` | 201 | **Dead** (not read in full; not referenced by live route) |
| `store/useDiscoveryStore.ts` | 848 | **Live-but-pointless** — backs only dead view; localStorage-only |
| `ai/discoveryPrompts.ts` | 196 | **Unused** — never imported by runtime |
| `types/discovery.ts` | 460 | Used only by the above dead chain |

**Live, real, but mis-foldered (not the audit's subject):**
| File | LOC | Status |
|---|---|---|
| `DiscoveryToolsHub.tsx` | 4651 | **Live** — real tool-platform/assessment/initiatives/reports integration |
| `ToolsV8CanonPanel.tsx` | 314 | **Live** — used by ToolWizardShell + ToolsShowcasePage |

No `TODO`/`FIXME`/`mock`/`fake` markers found in the Discovery dir (the only hits were `ListTodo` icon and `status: 'TODO'` enum in ToolsHub). The dead code is "clean" — which is exactly why it shipped unnoticed.

---

## What's working well

1. **`DiscoveryToolsHub`** — real backend integration, graceful degradation, status normalization, 5-category model, ties into assessments/reports/presentations/initiatives. Genuinely useful module (just misnamed/mis-foldered).
2. **The SPIN prompt** — well-crafted, PL/EN aware, structured-extraction-enforcing. Salvageable IP.
3. **The 8 React Flow node components** — production-quality visuals, i18n, handles, meters. Reusable.
4. **The type model** (`types/discovery.ts`) — comprehensive and coherent; a good blueprint if anyone revives the product.
5. **Defensive coding in `processExtraction`** (`useDiscoveryStore.ts:496-519`) — normalizes/guards malformed AI output before touching state. Good instinct, wasted on a path that never runs.

---

## Ranked remediation plan

### S (small) — stop the bleeding, this week

**S1. Delete the dead consultant subsystem (recommended default).** If Interview is the canonical discovery experience (it is, per routing), remove the orphan: `DiscoveryConsultantView`, `DiscoveryCanvas`, `DiscoveryHeader`, `DiscoveryFooterActions`, `RecommendationPanel`, `ProjectConversionModal`, `InsightDetailView`, `nodes/*`, `hooks/useDiscoverySync`, `hooks/useAutoLayout`, `useDiscoveryStore`, `ai/discoveryPrompts` (preserve the prompt text in a `docs/` snippet), `types/discovery`. Remove the lazy import at `AppRoutes.tsx:233`. ~3,700 LOC deleted. **Salvage first:** copy the SPIN prompt + extraction schema into the Interview module's prompt assets (see M2).

```diff
// src/routes/AppRoutes.tsx
- const DiscoveryConsultantView = lazyWithRetry(() =>
-   import('@/components/Discovery/DiscoveryConsultantView').then(...));
```

**S2. Rename `DiscoveryToolsHub` → `ToolsHub` (and its folder).** It is not Discovery. The shared name is the single biggest source of confusion in this audit. Update `index.ts`, `AppRoutes.tsx` imports, breadcrumbs already say "Tools".

**S3. Clear discovery localStorage on logout** (if not deleting per S1). Add `useDiscoveryStore.persist.clearStorage()` to the logout path; the `consultify-discovery` key holds verbatim client quotes (PII) with no TTL (`useDiscoveryStore.ts:837`).

### M (medium) — if the product is to be *revived* instead of deleted

**M2. Fold SPIN extraction into the live Interview chat (the real path forward).** Don't resurrect the dead view — instead inject the discovery system prompt + extraction schema into the Interview module's existing, working AI loop, and render extracted pains/insights with the (already-good) node components inside Interview's canvas. This makes the SPIN IP live without reviving 3,700 LOC of dead UI. Code sketch — wire the prompt where Interview builds its system message:

```ts
// in Interview's AI request builder
import { DISCOVERY_SYSTEM_PROMPT } from '.../discoveryPrompts';
const system = [DISCOVERY_SYSTEM_PROMPT, clientContextBlock(clientContext)].join('\n\n');
// then on each AI message, run the existing parseExtraction() and feed nodes
```

**M3. Build the missing backend (only if standalone Discovery is a real product line).** Create `server/src/routes/discovery.routes.ts` + a `discovery_sessions` table (or reuse the `tool_sessions`/artifact model). Implement `GET/PUT/DELETE /discovery/sessions/:id`, `POST /discovery/sessions/convert`. Enforce `requireAuth` + org-scoping on every handler (today there is none). The convert handler must call the **canonical** project + initiative services (the same ones the Canvas audit flagged for producing fake entities — use the real `ProjectService.create` + `InitiativeService.create`, not ad-hoc inserts).

```ts
router.post('/sessions/convert', requireAuth, async (req, res) => {
  const { orgId, userId } = req.auth;
  const session = await assertSessionInOrg(req.body.sessionId, orgId); // org-scope
  const project = await ProjectService.create({ orgId, name: req.body.projectName, ... });
  const initiatives = req.body.createInitiatives
    ? await Promise.all(recs.initiatives.map(i => InitiativeService.create({ projectId: project.id, ... })))
    : [];
  res.json({ projectId: project.id, initiativesCreated: initiatives.length });
});
```

**M4. Implement the recommendation producer.** Either (a) a second LLM pass that fills `DiscoveryRecommendations` from the accumulated pains/insights, or (b) a deterministic mapper (area-mix → transformationType, framework relevance → matchScore). Wire it to `setRecommendations` (currently 0 callers). Without this, conversion and the whole "decision" phase are inert even if M2/M3 land.

### L (large) — strategic

**L1. Decide the product question (below) and execute one direction fully.** The current half-migrated state — Interview live, Discovery dead-but-present, ToolsHub mis-named — is the worst of all worlds: maintenance surface, audit confusion, and a route that silently lies about what it renders.

---

## Strategic note — converge, separate, or retire?

**Retire the Discovery *consultant* as a separate codebase; converge its IP into Interview; keep ToolsHub as its own (renamed) module.**

Reasoning:
- The org has **already chosen** Interview as the discovery surface — the `DISCOVERY_CONSULTANT` route renders `InterviewHub`, and the code is annotated "Legacy - use InterviewHub". This audit just confirms the loser was never cleaned up.
- The Discovery consultant has **no functioning backend, no functioning pipeline, no functioning recommendations, and no route** — there is nothing to preserve except (a) the SPIN prompt and (b) the node components, both of which are portable into Interview.
- Maintaining two parallel "talk → extract pains/insights" systems is indefensible at this team size, especially when one of them has never executed in production.
- `DiscoveryToolsHub` is a legitimately useful, backend-real module that is **wrongly named** — it should be extracted from this decision entirely and called "Tools". It is not part of the Discovery-vs-Interview question.

**Concrete recommendation:** Execute S1 (delete) + M2 (fold SPIN into Interview) + S2 (rename ToolsHub). Only pursue M3/M4 (revive standalone Discovery) if there is a deliberate product decision to ship a discovery experience *distinct from* Interview — which nothing in the current codebase suggests. Absent that decision, every hour spent on the Discovery consultant subsystem is spent on a corpse.
