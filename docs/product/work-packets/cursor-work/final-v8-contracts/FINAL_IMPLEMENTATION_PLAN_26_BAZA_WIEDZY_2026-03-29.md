# Final Implementation Contract — Baza wiedzy (Position 26/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: draft (shared-sourced contract; extracted scope for position 26)

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
| P26-A |  |  |  |  |  |
| P26-B |  |  |  |  |  |
| P26-C |  |  |  |  |  |

