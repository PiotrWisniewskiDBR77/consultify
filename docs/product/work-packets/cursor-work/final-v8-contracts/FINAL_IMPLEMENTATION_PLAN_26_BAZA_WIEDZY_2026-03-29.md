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

