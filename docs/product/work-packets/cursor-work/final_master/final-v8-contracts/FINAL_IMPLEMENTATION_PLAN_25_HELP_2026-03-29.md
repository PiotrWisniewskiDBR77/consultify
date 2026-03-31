# Final Implementation Contract — Help (Position 25/35)
Date: 2026-03-29  
Owner: Product + Engineering  
Status: verified(evidence) — P25-A/B/C complete

## 1. Executive summary
- **Intent**: Kontekstowy help; spójny język; dostępny dla Anny i Teresy.
- **Primary users**: każdy użytkownik potrzebujący wsparcia w kontekście aktualnej pracy.
- **Success metric**: „contextual guidance” działa na kluczowych powierzchniach i jest konsystentny językowo + integruje się z AI (Anna/Teresa) bez chaosu.

## 2. Scope
### 2.1 In-scope
- Contextual help entry points z modułów.
- Spójny język i routing; integracja z Teresa/Anna jako przewodnikiem.

### 2.2 Out-of-scope / non-goals
- Pełna platforma „Edukacja” (osobny plan Wave2).
- Community/forum.

### 2.3 P25-A canon (Help runtime + content ops baseline)

Poniższy kanon jest **zamrożonym kontraktem** dla Help jako produktu runtime (nie repo-docs) i jest podstawą dla P25-B/P25-C.

#### 2.3.1 Contextual help entry points — per surface (bounded list)

**Kanon entry points** (obowiązuje dla każdej powierzchni pracy; P25-B implementuje pilot na 3 surfaces: `Tools`, `Interview`, `Results/Outputs`):

- **Surface action (primary)**: z każdej powierzchni pracy istnieje jawna akcja `Help / Contextual help`, która otwiera help w kontekście aktualnego surface/module.
- **Inline degraded entry (secondary)**: każdy degraded stan powiązany z brakiem wiedzy lub błędem (search no results, missing article, brak uprawnień) zawiera link `Open help` / `Search help`.
- **AI entry (grounded)**: Teresa/Anna mogą kierować do help artykułów, ale wyłącznie przez jawne `article_id` (brak „ogólników” bez źródła).

**Bounded surface list (P0 dla kontekstu i rekomendacji)**:

- `Tools`
- `Interview`
- `Results/Outputs` (np. raporty, prezentacje, wyniki pracy)

**Contextual entry points — pilot surfaces (P25-B must implement; bounded)**:

- `Tools`
  - Primary: `Help / Contextual help` z poziomu surface (bezpośrednio z pracy w narzędziu)
  - Secondary: degraded entry w pustych stanach (np. brak wyników, brak rekomendacji) oraz w błędach (np. permission/network) → `Open help`
- `Interview`
  - Primary: `Help / Contextual help` z poziomu Interview (w kontekście aktualnej rozmowy / widoku)
  - Secondary: degraded entry dla stanów “missing / can’t proceed” (np. brak danych, brak uprawnień) → `Open help`
- `Results/Outputs`
  - Primary: `Help / Contextual help` z poziomu Results/Outputs (w kontekście bieżącego artifactu, jeśli istnieje)
  - Secondary: degraded entry dla stanów “no output / no preview / restricted” → `Open help`

**Surface list (P1+; objęte kanonem entry-point, ale poza pilotem P25-B)**:

- `My Work`
- `Initiatives`
- `Execution`
- pozostałe moduły narzędziowe (np. tabele/board/mindmap) — zgodnie z ich PNN-A kanonem

#### 2.3.2 Routing rules: context → article → next action → back to correct surface

**Routing musi zachować „ciągłość kontekstu”**:

- **Context capture** (minimalny kontrakt):
  - `surface_id` (np. `tools`, `interview`, `results`)
  - `module_id` (jeśli różni się od surface)
  - `view_id` (jeśli istnieje; np. `table`, `kanban`, `timeline`)
  - `artifact_type` + `artifact_id` (opcjonalnie; jeśli help dotyczy konkretnego artefaktu)
  - `locale` (np. `pl-PL` / `en-US`)
- **Help open behavior**:
  - Wejście z surface ustawia `context` i pokazuje: (a) rekomendacje, (b) szybkie kategorie, (c) search.
- **Article open behavior**:
  - Artykuł zawsze pokazuje (a) tytuł, (b) język/stan tłumaczeń, (c) „next action” (jeżeli zdefiniowane).
- **Next action contract**:
  - Artykuł może deklarować `next_action` (co użytkownik ma zrobić po przeczytaniu).
  - `next_action` zawsze routuje **z powrotem do poprawnego surface** (lub do jego poprawnego sub-view).
  - Jeśli `next_action` brak — UI oferuje bezpieczne `Back to <surface>` (powrót do wejściowego kontekstu).

#### 2.3.3 PL/EN posture + explicit degraded + EN fallback rules (frozen)

**Postawa językowa** jest kontraktem produktu:

- **Locale selection**:
  - Domyślny język UI/help = preferencja użytkownika (lub locale aplikacji).
- **Required baseline**:
  - Każdy artykuł ma **EN jako minimalny** język źródłowy (wymóg P0).
  - PL jest wymagany dla seed minimum (2.3.4) i dla surfaces pilotowych (P25-B).
- **Missing translation rule (explicit degraded + EN fallback)**:
  - Jeżeli użytkownik jest w PL, a artykuł nie ma PL:
    - UI pokazuje jawny degraded komunikat po PL: „Brak wersji PL — wyświetlamy EN”.
    - UI wyświetla EN treść artykułu (fallback), z widocznym oznaczeniem języka.
  - UI **nie może** udawać, że treść jest po PL ani mieszać języków bez oznaczenia.
- **Search results posture**:
  - Wyniki są oznaczone językiem.
  - W trybie PL najpierw pokazujemy wyniki PL; jeśli brak, pokazujemy wyniki EN z etykietą `EN-only`.
- **AI guidance posture (Teresa/Anna)**:
  - Gdy rekomendowany artykuł jest `EN-only`, Teresa/Anna muszą to powiedzieć wprost („Artykuł jest dostępny tylko po EN”).
  - Teresa/Anna nie parafrazują „na pewno” treści, jeśli nie mają artykułu jako źródła (no overclaim).

#### 2.3.4 Content ops baseline (seed minimum, owner model, lifecycle/update posture)

**Content ops jest częścią produktu**, nie „poza produktem”.

Seed minimum (P0, must-exist aby Help nie był pustą skorupą):

- **1× Help overview**: „Help w Consultify — jak działa i gdzie szukać wsparcia”.
- **1× Search article**: „Jak działa wyszukiwarka Help i jak interpretować wyniki”.
- **1× Tool article per tool**: zgodnie z `docs/product/KB_ARTICLE_TEMPLATE_FOR_TOOLS_V1.md` (slug + metadata + struktura).
- **Surface pilot primers (P25-B)**: po 1 artykule startowym dla `Tools`, `Interview`, `Results/Outputs` (minimum „what to do next”).

Owner model (frozen):

- **Accountable owner (A)**: Owner modułu/surface (PM) — odpowiada za aktualność i kompletność seed minimum.
- **Content editor (R)**: wyznaczona rola Content Ops / Docs (lub Engineering z przypisaną odpowiedzialnością).
- **Approver (A2)**: Product/Engineering lead dla kanonu (gdy zmienia się routing / kontrakt).

Lifecycle & freshness posture (frozen):

- Każdy artykuł ma jawne pola (kontrakt meta): `article_id/slug`, `status`, `translations`, `last_reviewed_at`, `owner`.
- Zmiana UX/flow, która dotyka kroków opisanych w artykule, wymaga aktualizacji artykułu **w tym samym cyklu** (lub jawnego „known limit” w artykule).
- Artykuły bez `last_reviewed_at` są traktowane jako degraded („content freshness unknown”).

Deprecation / redirect posture (frozen):

- **No duplicates**: w runtime istnieje dokładnie jeden kanoniczny artykuł na temat (1× `article_id`).
- **Deprecation**: gdy artykuł ma zostać zastąpiony:
  - stary artykuł przechodzi na `status: deprecated`,
  - UI pokazuje banner: „Ten artykuł jest przestarzały — przejdź do <new_article_id>”.
- **Redirect**:
  - wejścia po starym `article_id` przekierowują do nowego `article_id` (lub renderują deprecated banner + CTA),
  - redirect jest jawny i audytowalny (nie “ciche podmiany” bez śladu).
- **Translation drift**:
  - jeśli PL i EN mają różne znaczenie (drift), artykuł jest traktowany jako degraded i wymaga review; UI może pokazać ostrzeżenie “translation under review”.

#### 2.3.5 Recommendation payload contract (for Teresa/Anna grounding) — v1 frozen

Rekomendacje są jawne i audytowalne: **context (surface/module) → article ids → rationale**.

Minimalny payload (v1):

```json
{
  "version": "help-reco-v1",
  "context": {
    "surface_id": "tools",
    "module_id": "tools",
    "view_id": "table",
    "artifact_type": "tool",
    "artifact_id": "risk-register",
    "locale": "pl-PL"
  },
  "recommendations": [
    {
      "article_id": "tools-risk-how-to",
      "rationale": {
        "pl": "Jesteś w narzędziu Risk — ten artykuł pokazuje wymagane inputy i jak interpretować wynik.",
        "en": "You are in the Risk tool — this article lists required inputs and how to interpret results."
      }
    }
  ]
}
```

Zasady (frozen):

- `article_id` musi istnieć (albo być jawnie „missing” w degraded posture).
- `rationale` jest wymagane (krótka, kontekstowa przyczyna dopasowania).
- Teresa/Anna przy cytowaniu muszą wskazać `article_id` jako źródło rekomendacji.

#### 2.3.6 Anti-duplicate gate: Help runtime product ≠ repo docs only

Kanon anty-duplikacji:

- Help w produkcie runtime **nie jest** tylko linkiem do repo dokumentów.
- Repo docs są źródłem autorskim, ale produktowa warstwa Help:
  - ma własne `article_id/slug`,
  - wspiera wyszukiwanie, rekomendacje i routing „next action”,
  - ma ownership i lifecycle (2.3.4).
- Dla każdego toola istnieje **jedna** kanoniczna strona Help (template V1). Duplikaty wymagają redirect / deprecate posture.

#### 2.3.7 Error + degraded posture (frozen) + acceptance checklist (10+)

Degraded stany muszą być jawne, spokojne i prowadzić do bezpiecznego następnego kroku:

- **Missing article** (`article_id` nie istnieje): komunikat + propozycja search + link do overview.
- **Missing translation** (PL missing): jawny komunikat po PL + EN fallback (2.3.3).
- **Search: no results**: propozycja alternatywnych zapytań + kategorie + link do overview.
- **Permission denied** (restricted content): komunikat + co zrobić (poproś admina / przejdź do publicznych artykułów).
- **Network / service down**: komunikat + retry + offline fallback (ostatnio otwarte / pinned, jeśli istnieje).
- **Unknown context** (surface nie rozpoznany): fallback do ogólnego Help entry + popular articles.
- **Recommendation empty / error**: UI nie udaje „smart”; pokazuje search + kategorie.
- **AI cannot cite**: Teresa/Anna nie wymyślają — zamiast tego proszą o doprecyzowanie i wskazują kategorie/search.

Acceptance checklist (P25-A scope approval; must-pass dla P25-B/P25-C):

1) Każdy pilotowy surface ma jawny entry point `Help / Contextual help`.  
2) Wejście z surface przekazuje `context` co najmniej: `surface_id`, `module_id`, `locale`.  
3) Artykuł może mieć `next_action` i prowadzi on do poprawnego surface (bez „gubienia” kontekstu).  
4) Brak `next_action` daje bezpieczny `Back to <surface>`.  
5) Brak artykułu (missing `article_id`) nie crashuje UI; pokazuje degraded + search.  
6) Brak tłumaczenia PL pokazuje jawny degraded po PL i EN fallback.  
7) Search w PL oznacza język wyników i pokazuje EN-only jawnie, jeśli trzeba.  
8) Search no results pokazuje alternatywy + kategorie (nie zostawia pustej ściany).  
9) Rekomendacje (jeśli istnieją) mają `article_id` + `rationale`.  
10) Teresa/Anna przy rekomendacji wskazują `article_id` i nie overclaimują bez źródła.  
11) Help runtime nie jest tylko linkiem do repo docs (anti-duplicate gate spełniony).  
12) Content ops ma jawny owner model i seed minimum jest zdefiniowany (2.3.4).  
13) Deprecation/redirect działa bez duplikatów (1× `article_id` na temat; deprecated ma jawny CTA do następcy).

## 3. Authority chain (SSOT)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Shared source plan (combined): `docs/product/work-packets/cursor-work/wave2-full-audit/WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md`

## 4. Softs inspirations (benchmark apps)
### 4.1 Primary benchmark family (SSOT)
- Plan modułu: `WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md` (contextual help + curated knowledge + content ops jako część produktu).
- Artykuły/formaty w repo (content ops seed posture):
  - `docs/product/KB_ARTICLE_TEMPLATE_FOR_TOOLS_V1.md`

### 4.2 Local Softs evidence (concrete artifacts)
- **Intercom (Knowledge Hub + Messenger + AI agent knowledge sources)**:
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/9357912-knowledge-explained.html` (knowledge product posture).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/6612588-messenger-explained.html` (in-app messenger jako help entry surface).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/5241719-let-customers-search-for-articles-in-the-messenger.html` (contextual search entry).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/11394959-use-ai-powered-content-recommendations-to-improve-fin.html` (AI-powered content recommendations).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/9440354-knowledge-sources-to-power-ai-agents-and-self-serve-support.html` (knowledge sources powering AI agents).
  - `Softs/0 Baza wiedzy /Intercom 2/www.intercom.com/help/en/articles/8322387-set-up-fin-ai-agent-s-multilingual-support.html` (multilingual support posture).
- **Intercom developer posture (Help Center as API surface)**:
  - `Softs/0 Baza wiedzy /Intercom 1/developers.intercom.com/docs/references/rest-api/api.intercom.io/help-center/listhelpcenters.md` (list help centers).
  - `Softs/0 Baza wiedzy /Intercom 1/developers.intercom.com/docs/references/rest-api/api.intercom.io/articles/listarticles.md` (articles listing).
- **Zendesk (Help Center search posture)**:
  - `Softs/0 Baza wiedzy /Zendesk 2/support.zendesk.com/hc/ja/search.html` (help center search surface).
  - `Softs/0 Baza wiedzy /Zendesk 2/support.zendesk.com/hc/ja/articles/4408886879258-Zendesk-Support検索リファレンス.html` (search reference posture).
- **Atlassian (support posture as product surface)**:
  - `Softs/0 Baza wiedzy /Atlassion 1/developer.atlassian.com/support.html` (support entry posture).

### 4.3 Parity checklist vs Softs (approval-grade)
**Parity oznacza “calm contextual help product + curated knowledge + content ops”, nie “kolejny link do docs”.**

- **One clear help entry + in-context entry points (Intercom Messenger)**:
  - Help dostępny “tu i teraz” z powierzchni pracy (moduł → help), nie tylko przez globalny portal.
- **Search and discovery posture (Intercom/Zendesk)**:
  - Użytkownik może szybko szukać artykułów; wyniki są czytelne i nie wymagają “zgadywania”.
- **Knowledge curation (Intercom Knowledge)**:
  - Struktura (collections/folders/tags) i “what to read next” nie są przypadkowe.
- **AI guidance grounded in knowledge sources (Intercom knowledge sources)**:
  - Teresa/Anna kierują do treści na podstawie jawnych źródeł; brak overclaim.
- **Multilingual + consistent language (Intercom multilingual)**:
  - Pomoc jest spójna językowo i wspiera PL/EN bez driftu.
- **Content ops is part of the product (developer/API posture + KB templates)**:
  - Seedowanie, lifecycle, i ownership są jawne; istnieje format “tool KB article” jako baseline.

### 4.4 Gap ledger vs Softs (what we are missing — derived from Wave2 plan)
Źródło prawdy: `WAVE2_FINAL_IMPLEMENTATION_PLAN_HELP_KNOWLEDGE_BASE_2026-03-29.md`.

| Capability cluster (parity target) | What Softs implies | Current truth (per plan) | Gap statement (contract requirement) | Priority |
| --- | --- | --- | --- | --- |
| Contextual recommendation | help matches surface | “recommendation depth remains open” | Dopiąć kontekstowe rekomendacje na kluczowych surfaces (bounded) | P0 |
| Editorial/content ops | curated + durable | “content seeding… needs stronger packaging” | Zbudować widoczne content ops: seed, owner, lifecycle, update policy | P0 |
| Runtime vs docs cohesion | KB feels real | “docs > runtime maturity” | KB ma być używalnym produktem w runtime, nie tylko repo docs | P0

## 5. Evidence plan (DoD)
### 5.1 Acceptance criteria
- Help jest dostępny kontekstowo na zadeklarowanych surfaces (modułowe entry points).
- Teresa/Anna potrafią kierować do właściwego help content (bez “ogólników”) i wskazują źródło.
- Content ops jest widoczny: ownership, update posture, minimalny seed (np. tool KB articles wg template).
 - Kanon degraded/error posture jest jawny i testowalny (see §2.3.7 acceptance checklist).

### 5.2 Tests
- Integracyjne: entry point z modułu → open help → search → open article → “next step” routing.
- Regression: brak artykułu / brak tłumaczenia → czytelny degraded state + fallback do EN.
- Contract tests: recommendation payload zawiera context (surface/module) + article ids + rationale.

### 5.3 Staging proof checklist
- Demo: 3 surfaces (np. `Tools`, `Interview`, `Outputs`) → contextual help → artykuł → next action.
- Demo: PL/EN przełączenie + Teresa guidance bez driftu.

## 8. Delivery plan
### 8.0 Context pack (read first)
- Master index: `docs/product/work-packets/cursor-work/FINAL_V8_MASTER_PLAN_2026-03-29.md`
- Execution playbook: `docs/product/work-packets/cursor-work/final_master/PROGRAM_EXECUTION_PLAYBOOK.md`
- Authority chain (Help/KB SSOT): see section 3.
- Softs parity + gaps: see section 4.
- Evidence plan: see section 5.

### 8.1 Bounded delivery packets
#### P25-A — Help canon + content ops baseline (scope approval)
- **Goal**: contextual help jako produkt runtime + content ops (seed/owner/lifecycle).
- **Inputs required**: entry points per surface; recommendation payload contract; PL/EN posture.
- **Acceptance**: scope zatwierdzony; non-goals jawne; degraded state dla missing article/tłumaczeń spisany.
- **Evidence**: scope approval + linkowane SSOT.
- **Tasks** (see library: `docs/product/work-packets/cursor-work/final_master/PACKET_TASKS_AND_DOD_LIBRARY.md`):
  - Freeze entry points per surface + routing rules (bounded).
  - Freeze content ops baseline (seed/owner/lifecycle/update posture) and PL/EN fallback rules.
  - Freeze recommendation payload contract (context→article ids→rationale) (bounded).
- **DoD**:
  - Approved(scope): contextual help is a runtime product; degraded states are explicit and testable.

#### P25-B — Contextual entry points + recommendation closure
- **Goal**: entry point→search→article→next action routing + Teresa/Anna guidance z źródłem.
- **Acceptance**: 3 surfaces działają; brak artykułu daje czytelny degraded + fallback.
- **Evidence**: integracyjne testy + staging demo.
- **Tasks**:
  - Implement contextual entry points and search→article→next action routing for 3 surfaces.
  - Implement Teresa/Anna linking to exact articles with visible source.
  - Add integration/regression tests (5.2) and run staging demos (5.3).
- **Staging proof script (click-by-click)**:
  1. From surface #1 (e.g., Tools), open contextual help and verify the recommended article matches the context.
  2. Search within help, open an article, and follow “next action” routing back to the correct surface.
  3. Repeat for surfaces #2 and #3 (e.g., Interview/Outputs).
  4. Switch PL↔EN and verify fallback behavior for missing translations is explicit.
  5. Trigger Teresa/Anna guidance to an exact article and verify the link targets the correct article id.
- **DoD**:
  - Help works contextually; missing content has safe fallback; guidance is source-linked.

#### P25-C — Verification + rollout
- **Goal**: regresje, staging proof, rollout/rollback.
- **Acceptance**: bar `verified(evidence)` spełniony.
- **Evidence**: wypełniony evidence ledger (sekcja 10).
- **Tasks**:
  - Capture staging proof and fill ledger rows P25-A/B/C.
  - Validate rollback: disable recommendations; preserve browse/search.
- **DoD**:
  - Status `verified(evidence)` with complete ledger entries and known limits.

### 8.2 Rollout strategy
- Najpierw kontekstowe entry points, potem rekomendacje “smart” (P0 bounded), potem rozbudowa (P1).

### 8.3 Rollback plan
- Wyłącz rekomendacje; zachowaj search/browse; bez destrukcji danych.

## 9. Risks / open questions / decisions
- Ryzyko: Help jako repo-docs, nie runtime produkt.
- Ryzyko: brak content ops → KB się starzeje natychmiast.
- Decyzje: minimalny seed i ownership model per moduł.

## 10. Evidence ledger (fill after delivery)
| Packet ID | Status | PR / commit | Tests (what + result) | Staging proof | Notes / known limits |
| --- | --- | --- | --- | --- | --- |
| P25-A | approved(scope) | commit: `161eeae42a` | N/A (scope) | N/A (scope) | §2.3 canon frozen: entry points, routing, PL/EN posture, content ops baseline, reco payload, degraded acceptance |
| P25-B | delivered | `c06e33e746` | Playwright: `tests/e2e/smoke/help-contextual-entrypoints.spec.ts` (5/5 pass); Vitest: `server/src/routes/v8/__tests__/help.routes.test.ts` (pass) | Manual script + steps: `docs/product/work-packets/cursor-work/final_master/evidence/P25-B_CONTEXTUAL_HELP_RUNTIME_VERIFICATION_2026-03-30.md` | Deep-link params cleared after processing; E2E uses mock DB seed minimum for deterministic KB. |
| P25-C | verified(evidence) | `98bf75bf8a` | Playwright: `tests/e2e/smoke/help-contextual-entrypoints.spec.ts` (5/5 pass, rerun green after closeout repairs); Vitest: `server/src/routes/v8/__tests__/help.routes.test.ts` (pass) | `docs/product/work-packets/cursor-work/final_master/evidence/P25-C_CONTEXTUAL_HELP_CLOSEOUT_2026-03-31.md` | Closeout verified the full contextual Help loop on Tools/Interview/Outputs plus degraded missing-article and PL fallback paths; runtime now degrades safely when primer metadata or surface bootstrap are imperfect. |

