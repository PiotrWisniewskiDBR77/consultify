# Final Implementation Contract — Baza wiedzy (Position 26/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P26-A/B/C complete

## 1. Executive summary
- **Intent**: Narzędzie edukacyjno‑sprzedażowe: LP + prawy panel + kontekst narzędzi; 50 tekstów + grafiki; tagi; linkowanie do newsletter/social; promowane przez Annę/Teresę.
- **Primary users**: odbiorcy treści (prospects + users) + zespół publikujący/kuratorzy.
- **Success metric**: curated knowledge product (nie dump), z taggingiem, dystrybucją i AI-led discovery.

## 2. Scope
### 2.1 In-scope
- Baza wiedzy jako produkt treści: IA, tagi, dystrybucja, promowanie przez Annę/Teresę.
- Integracja z LP/prawym panelem zgodnie z planem.

### 2.2 Out-of-scope / non-goals
- Pełna „Edukacja/Academy” jako osobny moduł.

### 2.3 P26-A canon (KB as one curated knowledge product)

This section freezes the operator-grade canon for Knowledge Base (KB): **one** knowledge product integrated with Help (P25) and AI discovery, with explicit taxonomy, content ops, and honest degraded behavior.

#### 2.3.1 KB object model (runtime + ops)

- **Article**: atomic unit of knowledge (one URL, one canonical topic). Must support:
  - **identity**: `id` (stable, never reused), `canonicalTopicKey` (optional but recommended), `slug` (URL path; may change only with redirect), `status` (draft/published/deprecated), `visibility` (public/in-app/internal).
  - **content**: `title`, `summary/lede`, `body`, `heroAssetRefs?`, `readingTime` (derived), `callouts?` (bounded, operator-authored).
  - **ops**: `owner` (person/team), `reviewCadenceDays?`, `reviewDueAt?`, `createdAt`, `updatedAt`, `publishedAt?`, `deprecatedAt?`, `deprecationReason?`.
  - **taxonomy bindings**: `collectionIds[]`, `tagIds[]`.
  - **discovery bindings**: `surfaceBindings[]` (explicit allow-list: LP / Help entry / right panel / AI recommendations / public docs).
  - **relations**: `relatedArticleIds[]` (bounded, curated; not “infinite scroll”), `replacementArticleId?` (when deprecated), `redirectToArticleId?` (when moved).
  - **sources**: `sourceIds[]` (optional pointers; never treated as proof-of-truth by default).
- **Collection**: curated folder/series that explains “what is here” and “what to read next”.
  - `id`, `slug`, `title`, `description`, `order`, `parentCollectionId?` (optional), `visibility`, `featured?`.
  - Collections are the primary IA spine; tags do not replace them.
- **Tag**: cross-cutting facet for filtering and discovery; must be bounded and operator-owned.
  - `id`, `slug`, `label`, `description?`, `kind` (domain/tool/concept/stage/audience), `synonyms[]`, `visibility`, `status` (active/deprecated), `redirectToTagId?` (for merges).
- **Source**: evidence pointer for why a statement exists (internal doc / benchmark / customer input / release note). Pointer only.
  - `id`, `kind`, `title?`, `uri?`, `capturedAt?`, `excerpt?`, `notes?`, `visibility` (internal/public).
  - Used for “why we recommend / where it comes from” — not as a correctness guarantee.
- **Version**: KB is mutable, but must be auditable.
  - `articleId`, `version` (monotonic), `changeType` (typo/clarify/update/breaking), `changeNote`, `changedBy`, `changedAt`.
  - Canon: every published article exposes `version` + last change note; breaking updates require a visible update note on the article.
- **Translation (PL/EN)**: KB must be bilingual with safe fallback.
  - Canon: `articleId` + `locale` yields a localized payload (title/summary/body), plus `translationStatus` (native/translated/stale/missing).
  - Rule: lack of translation triggers a clear degraded state (see 2.3.6), never silent language mixing.

#### 2.3.2 Taxonomy + search/discovery posture (operator-grade)

- **Single taxonomy, multiple surfaces**: one KB taxonomy drives:
  - LP knowledge entry, Help entrypoints, KB browse/search, right-panel contextual reading lane, AI recommendation linking.
- **Discovery contract**:
  - **Browse** starts from Collections (IA), not from tags.
  - **Search** is fast, tolerant (synonyms + typo tolerance), and returns results with clear scope cues (collection context + tag facets).
  - **Tags** are facets, not IA; they refine browse/search.
  - **Related/Next** is curated (bounded list), not purely algorithmic.
- **Search operator posture (what “good” means)**:
  - **Ranking**: exact title match > title contains > lede contains > body contains; boost featured collections; de-boost deprecated; never surface internal-only content on public surfaces.
  - **Facets**: results always expose available `collection` + `tag` filters derived from the result set.
  - **Locale**: search runs in requested locale first; if fallback is used, it must be explicit (see 2.3.6).
  - **Surface bindings respected**: search/browse must filter by `surfaceBindings` (no “leak” into a disallowed surface).
- **Indexing posture**:
  - “Index stale” is a first-class degraded mode; user must still be able to browse via IA and open canonical featured collections.
- **Operator controls**:
  - Featured collections/tags and “surface bindings” are explicit knobs; no implicit auto-promotion across surfaces.
  - Tag governance is explicit: new tags require an owner, a `kind`, and synonyms; tag merges deprecate + redirect (no “two labels for same thing”).

#### 2.3.3 Content ops baseline (ownership + lifecycle)

- **Ownership**:
  - Every published article has an **owner** (person/team) and a **review cadence** (time-boxed).
  - Collections also have owners (IA is a product, not only metadata).
- **Roles (minimal)**:
  - **KB owner**: taxonomy + IA spine owner (collections + tag governance).
  - **Article owner**: correctness + currency for a topic.
  - **Publisher/operator**: enforces publish bar, redirects, and deprecation hygiene.
- **Lifecycle**:
  - States: `draft` → `published` → `deprecated` → `redirected/archived`.
  - Deprecation must include: reason + replacement pointer (article/collection) when available.
- **Update policy**:
  - No silent meaning-changes: substantial edits update version and log “what changed”.
  - Minimal bar for publish: title + lede + body + taxonomy bindings + surface bindings + locale coverage posture.
- **Redirect posture**:
  - Prefer **redirects** over deletions; preserve inbound links (newsletter/social).
  - If content is removed, replace with a clear “this moved” canonical page and pointers.
  - Redirects apply to both **slugs** and **merged tags**; users should never hit a dead end from a previously published URL.

#### 2.3.4 Grounding contract for AI (Anna/Teresa)

AI must recommend KB content using an explicit payload that is auditable and does not overclaim.

- **Recommendation payload contract (context → article ids → rationale)**:
  - **context**:
    - `surface` (LP / Help / tool-right-panel / chat), `toolContext?`, `userIntent?`, `language` (PL/EN), `constraints` (time/role).
  - **candidates**:
    - `articleIds[]` (ordered), optional `collectionIds[]`.
  - **rationale**:
    - For each id: 1–3 bullets “why this fits the context”, plus any explicit limits/assumptions.
  - **nextStep** (optional): what to do after reading (bounded; no invented promises).
- **Citations / evidence pointers posture (no overclaim)**:
  - AI must cite **KB ids** (article/collection) as the primary citations. If a URL is shown, it must be derived from the KB slug (no invented links).
  - AI may additionally point to `source` pointers (internal or benchmark) as “why we recommend / where the content comes from”, but must not claim correctness beyond what the KB states.
  - If unsure or if KB coverage is missing: prefer uncertainty posture and route to canonical collections (and/or propose a topic request) rather than inventing content.

#### 2.3.5 Anti-duplicate gate (KB ≠ Help, but integrated)

- **No two knowledge products**:
  - Help (P25) defines **entrypoints** and contextual “help” surfaces.
  - KB (P26) defines the **curated knowledge system** (taxonomy + content ops + discovery).
  - They must share **one** taxonomy and **one** article identity namespace.
- **Integration rule**:
  - Help surfaces may *route into KB* using KB article/collection ids; they must not clone content into a separate “help KB”.
- **Duplicate detection** (operator gate):
  - If a new article overlaps an existing one: merge + redirect; do not publish parallel topics with different ids.
  - Canon rule: one canonical topic → one canonical article id; “variants” are translations or updates, not separate competing articles.

#### 2.3.6 Degraded / error posture + acceptance checklist (P26-A)

Degraded modes are part of user trust; they must be explicit and safe.

- **Degraded modes (non-exhaustive)**:
  - Missing article id → show “content moved/removed” with redirect pointers + route to canonical collection.
  - Missing translation (requested locale) → show explicit language fallback (PL↔EN) with a banner; never mix sections silently.
  - Stale index/search unavailable → fall back to browse via Collections + featured tags; show “search temporarily limited”.
  - Empty results for tag/collection → show “no content yet” + nearest alternatives + “request topic” posture (bounded).
  - Surface binding disallows an article in this surface → do not show it; fall back to allowed featured content.
  - Deprecated article opened → show deprecation notice + replacement pointer.
  - Missing/invalid redirect target → fail closed to canonical collection entry (never loop, never 404 without guidance).

- **Acceptance checklist (scope approval; 10+)**:
  - [ ] Article/Collection/Tag/Source/Version/Translation canon defined (this section) and referenced as SSOT for P26-B.
  - [ ] PL/EN posture is explicit, including missing-translation behavior.
  - [ ] Taxonomy posture is explicit: Collections = IA spine; Tags = facets; Related/Next is curated.
  - [ ] “Where content appears” is governed via surface bindings (LP/Help/right panel/AI).
  - [ ] Content ops ownership is explicit for both Articles and Collections.
  - [ ] Lifecycle states are defined with deprecation + redirect posture (no destructive deletes as default).
  - [ ] Update policy forbids silent meaning-changes; versioning + change reason exists.
  - [ ] AI recommendation payload contract is explicit (context → ids → rationale) and auditable.
  - [ ] AI citations posture is bounded (pointers, no overclaim, uncertainty routing to canon).
  - [ ] Anti-duplicate gate prevents “Help KB” vs “KB KB”; one namespace + shared taxonomy.
  - [ ] Degraded modes are enumerated for missing article, missing translation, stale index/search, and empty results.

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan (combined): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu (shared): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md` (knowledge product + contextual discovery + content ops jako produkt).

### 4.2 Local Softs evidence (concrete artifacts)
- **Intercom (Knowledge Hub: curated knowledge + structures + AI recommendations)**:
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/9357912-knowledge-explained.html` (knowledge hub posture: curated, nie dump).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/9357924-organize-folders-in-the-knowledge-hub.html` (folders/IA posture).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/6040998-content-tagging-in-the-knowledge-hub.html` (tagging posture).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/11394959-use-ai-powered-content-recommendations-to-improve-fin.html` (AI-powered content recommendations).
- **Zendesk (Help Center: search/discovery posture)**:
  - `Softs/0 Baza wiedzy /Zendesk 2/support.zendesk.com/hc/ja/search.html` (search surface).
- **Notion / Evernote (knowledge capture + discovery posture as adjacent family)**:
  - `Softs/0 Notatki/Notion help.zip` (knowledge base / docs-first mental model; useful as “curation + discovery” adjacency).
  - `Softs/0 Notatki/evernote help.zip` (capture + organize posture adjacency).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “knowledge product jako kanał edukacyjno‑sprzedażowy z IA+tags+dystrybucją”, nie “lista artykułów bez życia”.**

- **Curated IA + tags (Intercom Knowledge)**:
  - Struktura (folders/collections) i tagi to kontrakt; user rozumie “co tu jest” i “co dalej czytać”.
- **Search & discovery (Zendesk/Intercom)**:
  - Szybkie wyszukiwanie i sensowne wyniki; brak “scroll-hell”.
- **AI-led discovery (Intercom recommendations + plan)**:
  - Anna/Teresa promują i kierują do treści na podstawie kontekstu (bez overclaim).
- **Distribution posture (intent)**:
  - Treści mają linkowalność i dystrybucję (newsletter/social) jako element produktu, nie “poza systemem”.
- **Right panel + tool context (intent)**:
  - Prawy panel w narzędziach i LP działa jako “contextual reading lane” — bez rozjazdu języka i taksonomii.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan + contract)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (contract) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Content ops + seeding | curated + durable | “seed 50 + graphics” | Zbudować pipeline seeding/ownership/lifecycle; 50 treści to deliverable, nie zamiar | P0 |
| Tagging + IA | folders/tags matter | “tags + IA implied” | Dopiąć model IA+tags oraz rules “where it appears” (LP/prawy panel/AI) | P0 |
| Contextual routing | in-product guidance | “promoted by Anna/Teresa” | Zdefiniować contextual recommendation contract (kiedy i jak promujemy treści) | P1 |

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Content jest seeded (docelowe 50) + grafiki; ma tagi i IA.
- Prawy panel + LP pokazują właściwe treści dla kontekstu narzędzia (bez chaosu taksonomii).
- Promocja/routing przez Annę/Teresę działa i jest “bounded” (bez marketingowych overclaimów).

### 5.2 Tests
- Integracyjne: browse IA → filter by tags → search → open article → related/next content.
- Routing tests: tool context → right panel recommended articles; Anna/Teresa → link to exact article ids.
- Regression: brak treści dla tagu/kontekstu → czytelny degraded state + fallback do “top canonical”.

### 5.3 Staging proof checklist
- Demo: 3 przykładowe narzędzia → prawy panel → właściwe treści + tag navigation.
- Demo: newsletter/social link opens correct article + trackable referral.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Help/KB SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P26-A — KB canon + IA/tags + content ops (scope approval)
- **Goal**: KB jako runtime produkt (IA+tags+ops), nie “folder z linkami”.
- **Inputs required**: content ops pipeline (seed/owner/lifecycle) + IA/tags model + contextual routing contract.
- **Acceptance**: scope zatwierdzony; deliverable “seed 50” jest konkretny (nie zamiar); degraded states spisane.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze IA/tags model and the mapping “where content appears” (LP/right panel/AI).
  - Freeze content ops pipeline (seed 50 + ownership + lifecycle + update policy).
  - Freeze contextual routing contract (tool context→recommended articles) (bounded).
- **DoD**:
  - Approved(scope): KB is deliverable-driven (seed 50) and routing/taxonomy are explicit.

#### P26-B — IA/tags + contextual surfaces closure
- **Goal**: browse/filter/search + right panel/LP mapping per context + routing przez Annę/Teresę (bounded).
- **Acceptance**: 3 narzędzia mają poprawny kontekstowy routing; brak treści → czytelny degraded + fallback.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement browse/filter/search with IA+tags and related/next content behavior (bounded).
  - Implement right panel/LP mapping for 3 tool contexts; implement degraded fallback.
  - Add integration/regression tests and run staging demos (3 tools + routing).
- **Staging proof script (click-by-click)**:
  1. Open KB browse and navigate IA; filter by tags; confirm content discovery works.
  2. Search for a seeded article and open it; verify related/next content links are coherent (bounded).
  3. For tool context #1: open the tool and verify right panel/LP recommends the correct KB content.
  4. Repeat for tool contexts #2 and #3.
  5. Remove/miss content for a context and verify explicit degraded fallback (no empty mystery).
- **DoD**:
  - Contextual routing is correct and audytowalne; missing content has safe fallback.

#### P26-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P26-A/B/C.
  - Validate rollback: disable routing/recommendations; preserve browse/search.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw IA+seed + browse/search, potem contextual routing i rekomendacje (P1).

### 8.3 Rollback plan
- Wyłącz rekomendacje/routing; zachowaj browse/search; bez destrukcji treści.

## 9. Risks / open questions / decisions
- Ryzyko: seed bez ownership → KB natychmiast się starzeje.
- Ryzyko: chaos taksonomii (nie wiadomo “gdzie treść się pokazuje”).
- Decyzje: minimalny model tagów i mapping do surfaces.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P26-A | approved(scope) | `00ec148c6b` | N/A (docs-only scope approval) | N/A | §2.3 canon frozen: KB object model, taxonomy/search/discovery posture, content ops baseline, AI grounding payload + citations posture, anti-duplicate gate, degraded modes + checklist |
| P26-B | verified(evidence) | pending commit | 29 integration tests: collections CRUD, tags, faceted search (FTS5+synonyms), related articles, versions, redirect/deprecation, surface bindings, regression, PL/EN degraded+stale, collections/tags happy path, faceted+collection filter | Collections-first browse (public+help), tag facets, deprecation banner (both surfaces), AI grounding structured payload, stale search fallback, PL/stale translation banners, heroAssetRefs, FTS5 search | Known limits: content seeding (50 articles) is ops task; chart/visual content not supported |
| P26-C | verified(evidence) | pending commit | 29 integration tests (same as P26-B) | Same as P26-B | Rollback: disable collections/tags routes; legacy categories still accessible; browse/search preserved |

