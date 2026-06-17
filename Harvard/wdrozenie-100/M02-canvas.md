# TECZKA M02 — Canvas (chat split-view / deliverables-light) (pogłębiona do M13-level)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + `docs/standards/*` + kod) i dokłada brakujące ogniwa (Rejestr Wejść z uwagą żywą #1 · Rejestr Decyzji · DoD z liczbami · korekta staleności). Wzór głębi: [`M13-inicjatywy.md`](M13-inicjatywy.md) · struktura: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · decyzje: [`_DECYZJE.md`](_DECYZJE.md) (DP-2 trzeci panel, DP-5 stuby). SPEC kręgosłupa: `Harvard/SPEC_ZADANIE_01_chat_controller.md`.

## 00 · Nagłówek
- **Moduł:** M02 Canvas (chat split-view, deliverables-light) · **Pula:** beta · **Faza:** FAZA 3 (szlif beta; korzysta z kręgosłupa FAZA 0)
- **Ocena audytu:** 59/100 (**najsilniejszy moduł, 0× P0/P1, jeden z dwóch bez IDOR obok M25**) · **Tier:** Alpha górny → kandydat Beta · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak P0/P1 *modułowych* — ALE **uwaga żywa #1 (chat-as-controller) = P0-PROGRAM**, kręgosłup; tu = główny kanał weryfikacji
- **Właściciel:** Piotr · **Daty:** karta 2026-06-11 (`327de9144f`) · teczka 2026-06-13
- **Karta:** `Harvard/modules/M02-canvas/KARTA_AUDYTU.md` (+ `CANVAS_MODULE_AUDITOR_BRIEF.md`, `DELIVERABLES_HARVARD_AUDIT_HANDOFF.md`)
- **Kod:** `src/components/AIChat/WorkCanvasDocumentPanel.tsx` · `…/CanvasEditor/` (CanvasRichEditor, CanvasAIFloatingMenu, CanvasEditorToolbar, useCanvasAIStream) · `…/CanvasPresentationView.tsx` · `…/CanvasVersionHistory.tsx` · `…/CanvasArtifactSwitcher.tsx` · `…/canvasStreamIntentDetector.ts` · `…/documentIntentDetector.ts` · `server/src/routes/work-canvas.routes.ts` · `server/src/routes/deliverablesGenerations.routes.ts` · `server/src/services/canvasMaterialize.ts` · `server/src/services/deliverables/docGenerationRuntime.ts` · `server/src/services/presentationGeneratorService.ts` · `src/types/canvasWorkspace.ts`

## MAPA POKRYCIA
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + `[[project_canvas_overhaul]]`/`[[project_canvas_program]]` | job-to-be-done + persony + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 + `[[project_deliverables_light_l1]]` | **agentic-canvas: layout + WSZYSTKIE stany + cykl życia + delta #1** (niżej) |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + kod | **enumeracja ~30 endp. work-canvas + 4 deliverables + maszyna `kind` + dwa silniki** (niżej) |
| D AI/Teresa | 🟢 | `CARD_CONTENT_FORMULA.md` + detektory + SPEC_01 | dwa silniki artefaktów + granica persony + delta #1 |
| E Integracje | 🟢 | karta §1g | mosty + kręgosłup |
| F Epiki | 🟢 | poprzedni WP §3 + SPEC_01 | **epiki→stories→Gherkin→L-xx** (niżej) |
| G DoD/jakość | 🟢 | karta §0/§2 | **liczby grep** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (#1) + Decyzji + korekta staleności** |

---

## A · INTENCJA / PRODUKT
Kontekst: `[[project_canvas_overhaul]]`, `[[project_canvas_program]]`, `[[project_deliverables_light_l1]]`. Terminologia: `[[feedback_canvas_vs_ideas]]` (Canvas = chat split-view; Ideas = My Work tools).
- **Job-to-be-done:** zamienić rozmowę z Teresą w **żywy artefakt** (deck/doc/sheet) widoczny i edytowalny po prawej, bez opuszczania czatu — „agentic canvas".
- **Persony/role:** **konsultant** (twórca/edytor), **klient** (odbiorca przez share), **admin** (org-scope), **GUEST** (decyzja D-02 — dziś może tworzyć/materializować, sprzeczne z briefem). Wszystko org-scoped (bez IDOR).
- **Zakres v1:** triada generacji deck/doc/sheet (flaga `ENABLE_DELIVERABLES_LIGHT`) · patch-mode + streaming do TipTap · cykl życia artefaktu (wersje/switcher/chip) · public share+revoke (`/public/artifacts/:token`) · materializacja do encji (idea/note/initiative/decision/task, org-guard) · eksport 7 formatów (md/csv/json/pdf/docx/xlsx/pptx).
- **POZA v1:** agentic „polecenia wpisane wewnątrz dokumentu" (decyzja produktowa), what-if, multiplayer Canvas.
- **Metryka:** % rozmów „zrób deck/doc" kończących się WIDOCZNYM artefaktem (nie halucynacją „dodałem"); trwałość draftu po reload.

## B · UI/UX — STAN DOCELOWY
**Layout (`WorkCanvasDocumentPanel` w prawym slocie `UnifiedChatPanel`, brak własnego route):** nagłówek (tytuł + switcher wersji `CanvasVersionHistory` + chip + eksport) · kanwa (TipTap `CanvasRichEditor` dla doc/sheet jako markdown; `CanvasPresentationView` dla deck) · `CanvasAIFloatingMenu` (diff accept/reject) · toolbar (`CanvasEditorToolbar`).
**Cykl życia artefaktu** (wdrożony + live-proven 06-10): generacja → wersje append-only → switcher → chip reload-safe → patch-mode → auto-emisja.

**Stany ekranu (docelowo każdy z komunikatem):**
- **Pusty:** szablon „Company Work Note" (`base`, `WorkCanvasDocumentPanel.tsx:735`).
- **Ładowanie:** generacja w tle → poll `GET /deliverables/generations/:id`; hydracja draftu async (`:898-1028`).
- **Błąd:** generacja padła → komunikat; M-5 endpoint 500 (NIEZWERYFIKOWANE — live-repro Faza 4).
- **Pełny:** artefakt (deck/doc/sheet) renderowany; wersje + switcher.
- **Flaga OFF:** legacy redirect `/wordy`/`/excele`/`/prezentacje` — **cichy (L-04, ma być z banerem)**.
- **Brak-uprawnień:** draft cudzej org → 404 (`ownedDraft`); GUEST → decyzja D-02.

**Delta docelowa (#1, kręgosłup):** po `deliverables:draft-ready` prawy panel MUSI **auto-przełączyć się na świeży draft niezależnie od bieżącego `draftId`** (deterministyczny montaż, SPEC_01 Fala 1: nowy `useEffect` po `:720` obserwujący `props.initialDraftId` → `setMountOverride({kind:'doc',draftId})`); potwierdzenie Teresy = realny tool-call z weryfikacją widoczności, NIE proza „Plan został dodany". **Rekoncyliacja kręgosłupa, nie greenfield.**

**Zgodność:** §27 **N/D** (brak tabel-list; wersje/switcher ad-hoc). i18n: panel **bez `useTranslation`** (0 wywołań — zweryfikowane grep), miesza hardkody PL/EN → wprowadzić `t()`. Tokeny: ~34–61 surowych util palety → Visual Standard.

## C · DANE + API + REGUŁY (kontrakt)
- **Model danych:** `work_canvas_drafts`, `work_canvas_versions` (append-only), `artifact_registry` + `ArtifactOriginLink`, share-token. Maszyna `kind` (`canvasWorkspace.ts:64-75`): `markdown · document · research · decision · plan · checklist · sheet · deck · table · presentation · report`. Mount-state panelu: `base` (szablon) / `doc` / `deck` (`WorkCanvasDocumentPanel.tsx:732-735`).
- **API — enumeracja (`work-canvas.routes.ts`, org-scope wzorcowy przez `ownedDraft` `:2068` = `WHERE id=? AND organization_id=?` → 404):**
  - **Drafts CRUD:** `GET /drafts` (L2639), `POST /drafts` (L2668), `GET /drafts/:id` (L2767), `PUT /drafts/:id` (L3283), `GET /drafts/:id/export` (L3242), `GET /drafts/:id/source-canvas` (L3203).
  - **Workflows:** `GET/POST /drafts/:id/workflows` (L2773/2779), `/resume` (L2823), `/run-next` (L2888), `/comments` (L3131), `PATCH …/collaboration` (L3052).
  - **Proposals (patch-mode):** `POST/GET /drafts/:id/proposals` (L3482/3533), `POST /proposals/:id/reject` (L3539), `POST /proposals/:id/approve` (L3574).
  - **Wersje:** `GET /drafts/:id/versions` (L3727), `POST /drafts/:id/operations` (L3740), `POST /drafts/:id/versions/:vid/restore` (L3847).
  - **Share:** `POST/DELETE /drafts/:id/share` (L3912/3941), `GET /shared/:token` (L3954, SEC-M02-4 bez shape-walidacji przed LIKE).
  - **Materializacja/handoff:** `POST /drafts/:id/save-to-workspace` (L3993, guard `assertOrgScopedReferences` `canvasMaterialize.ts:87-114`), `/create-output` (L4089), `/research/finalize-report` (L4154), `/send-to-table-studio` (L4270), `/register-in-outputs` (L4424), `/send-to-document-studio` (L4515), `/save-as-artifact` (L4613).
  - **Generacja triady (`deliverablesGenerations.routes.ts`):** `POST /` (L?), `POST /:id/generate` (**default 'deck' `:198` → wymusić 400, L-05**), `GET /:id` (poll), `GET /metrics`. Gate `ENABLE_DELIVERABLES_LIGHT === 'true'` → OFF=404 (`:39-44`).
- **Reguły biznesowe:**
  - **Org-scope (wzorcowy):** każdy endpoint z `:draftId` przez `ownedDraft`; materializacja przez `assertOrgScopedReferences` (save `:4017` + accept `:3611`). **Capabilities `canvas.*`:** tylko `canvas.share` egzekwowane serwerowo (`:3915/:3943`); 8/9 martwe (SEC-M02-1).
  - **Kontrakt artefaktów (#1):** `deliverables:draft-ready` → montaż; dziś listener wychodzi przy `readyDraftId === documentState.draftId` (`:1035-1070`), reset `mountOverride=null` przy zmianie propsów (`:704-706`), świeży stan startuje z `base` bez `draftId` (`:767-773`) → wyścig do szablonu (Tryb B).
  - **Dwa silniki artefaktów (Tryb C):** legacy `ArtifactsPanel`/`useArtifactsStore` (`SplitLayout.tsx:461`) vs `WorkCanvasDocumentPanel` (`UnifiedChatPanel.tsx:5905`); typy `Artifact.type` (`core.ts:2248`) vs `CanvasDocumentKind` niełączone → artefakt w jednym store, user patrzy na drugi panel (L-01).

## D · AI / TERESA
- **Co generuje:** deck/doc/sheet wg `docGenerationRuntime.ts` (anti-placeholder gate, `useLlm:true`, `:901-1012`) + `presentationGeneratorService.ts`; treść wg `docs/standards/CARD_CONTENT_FORMULA.md`. `planDoc` tworzy draft natychmiast jako szkielet (`:657-725`), treść w tle.
- **Sterowanie (kręgosłup #1):** intencja z czatu przez `canvasStreamIntentDetector.ts:91-101` + `documentIntentDetector.ts:1-51` (22 wzorce regex — wąskie, frazy spoza („chcę to w Canvasie") chybiają → Tryb A halucynacja). Patch-mode TYLKO gdy `activeCanvasDocument !== null` (`UnifiedChatPanel.tsx:2956`), pipeline `useCanvasAIStream.ts:81-182`. Granica persony „nie udawaj wykonania" (`persona.ts:303-319`) łamana w trybie A.
- **Delta (#1):** dać Teresie realne narzędzie `tool_generate_deliverable({type,intent,title})` (SPEC_01 Fala 2) → „dodałem" pada DOPIERO po zwrocie toola z `generationId`.

## E · INTEGRACJE — mapa połączeń
Pełna tabela: karta §1g. **→** M17 Outputs (rejestracja/eksport), M03 (Decyzja/Task), M13 (Inicjatywa + panel `InitiativeDocumentView.tsx:654`), M05/M04 (Idea/Notatka), public share `/public/artifacts/:token`. **←** M01 czat (intent PL/EN), M04 (Rozwiń w dokument C3), M06 (mapa→seed C5), M10 (grounding sourceRefs/ContextPack, retrieval za flagą).
**Kręgosłup:** `UnifiedChatPanel` + `WorkCanvasDocumentPanel` + pipeline `deliverables:draft-ready` — wspólny z M18/M19/M20 (Document/Presentation/Table Studio). **DO POTWIERDZENIA (SPEC_01 §3):** czy standalone studia reużywają tego panelu (flaga OFF → legacy `/wordy`). Pęknięcie promieniuje (uwaga #1 SYSTEMOWE) → re-ocena D w `_TRACKER.md`.

## F · EPIKI → STORIES → ZADANIA
**EPIK 1 — Kręgosłup czat→canvas (#1) [L-01/L-02/L-03]:**
- Story 1.1: jako user chcę widzieć świeży dokument po prawej. *Dane:* otwarty czat split-view. *Gdy:* klikam „Otwórz jako dokument" / fraza intencji trafia. *Wtedy:* dokument widoczny w <1s, trwały po reload. → Z (SPEC_01 Fala1/Tryb B): auto-mount `initialDraftId`.
- Story 1.2: jako user chcę prawdy od Teresy. *Dane:* fraza spoza regexu. *Gdy:* proszę o dokument. *Wtedy:* realny tool-call LUB jawna propozycja, ZERO fałszywego „dodałem". → Z (Fala 2/Tryb A).
- Story 1.3: jako dev chcę jeden SSOT widoku. *Dane:* dwa silniki. *Gdy:* artefakt powstaje. *Wtedy:* ląduje w panelu, który user widzi. → Z (Fala 3/Tryb C: most/konsolidacja, D-01).

**EPIK 2 — Domknięcie generacji [L-05/L-06/L-07]:**
- Story 2.1: *Dane:* deck z N slajdami. *Gdy:* „regeneruj slajd". *Wtedy:* treść slajdu się zmienia (lub akcja ukryta). → `regenerateSlide` realny lub hide (D-03).
- Story 2.2: *Gdy:* `POST /:id/generate` bez formatu. *Wtedy:* 400, nie cichy deck. Story 2.3: picker sourceRefs w UI.

**EPIK 3 — Bezpieczeństwo capabilities [L-08/L-09/L-10]:**
- Story 3.1: *Dane:* user bez `canvas.convert`. *Gdy:* convert/output. *Wtedy:* 403 serwerowo (8/9→9/9). Story 3.2: decyzja GUEST (D-02). Story 3.3: SEC-M02-3/4.

**EPIK 4 — Odporność [L-04]:** baner przy fladze OFF (legacy redirect).
**EPIK 5 — Szlif kanonu [L-11/L-12/L-13]:** `useTranslation` w panelu (0→t()); ~34 util palety→tokeny; wytnij `commitProposalToDomain`.
**EPIK 6 — Testy do PR-gate [L-14/L-15]:** fix mock `UnifiedChatPanel.test.tsx` (14 FAIL→0); S6 (share/revoke) + S7 (cross-org materialize 403) na `Londyn`.

## G · JAKOŚĆ / WERYFIKACJA
| # | Kryterium | Miara M02 (grep 2026-06-13) |
|---|-----------|-----------|
| 1 | Front↔back | triada deck/doc/sheet na realnych danych; po `draft-ready` panel auto-przełącza (#1); `regenerateSlide` realnie regeneruje lub ukryty; draft+wersje trwałe po reload; 0 martwych CTA |
| 2 | Bezpieczeństwo | cross-org szczelne (test regresji S7 cross-org 403); capabilities `canvas.*` 1/9→9/9 lub decyzja; GUEST rozstrzygnięty (D-02) |
| 3 | i18n | **0** wywołań `useTranslation` w `WorkCanvasDocumentPanel.tsx` *(grep potwierdzony)* → wprowadzić `t()`; miesza hardkody PL/EN |
| 4 | Tokeny | **0** hex w plikach Canvas; ~34 surowych util palety w panelu → tokeny |
| 5 | §27 | **0** surowych `<table>` (N/D — brak tabel-list) |
| 6 | E2E w PR-gate | fix mocka `UnifiedChatPanel.test.tsx` (14 FAIL→0) + S6 + S7 zielone na `Londyn` (dziś `test-suite.yml` tylko `[main,develop]`, default `Londyn` → 99 testów Canvas poza PR-gate) |

**Scenariusze S1–S8** (karta §0): S1 deck, S2 doc (anti-placeholder), S3 sheet (round-trip), S4 patch (diff), S5 wersje+restore, S6 share/viewer/revoke (brak testu), S7 materializacja org-guard (brak testu cross-org 403), S8 eksport 7 formatów. Bezpieczeństwo: karta §6 (0× P0/P1; public viewer utwardzony token 32-hex, rate-limit 30/min/IP, 404/410, revoke).

## H · GOVERNANCE / STEROWANIE

### 01 · Rejestr wejść (R1)
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | 2026-06-11 | wiring/sec/plan; 4/6 czerwonych flag STALE (obalone) | L-04..L-15 |
| W-02 | **Uwaga żywa #1 — czat NIE steruje aplikacją (SYSTEMOWE/P0-program)** | 2026-06-13 | Teresa mówi „dodałem do Canvasa", panel pusty | **L-01,L-02,L-03 (KRĘGOSŁUP)** |
| W-03 | **SPEC `SPEC_ZADANIE_01_chat_controller.md`** | 2026-06-13 | WP fazami (Tryb A halucynacja / B zerwana więź / C konsolidacja) | L-01,L-02,L-03 |
| W-04 | `docs/standards/CARD_CONTENT_FORMULA.md` | — | formuła treści deliverables | D (kanon) |
| W-05 | Feedback prod (triada live 06-10) | 2026-06-10 | deck/doc/sheet zweryfikowane żywo | (potwierdza A1a karty) |
| W-06 | `_DECYZJE.md` DP-2 (trzeci panel) + DP-5 (stuby) | 2026-06-13 | Canvas hostuje deck/doc; flaga OFF→stub z labelem | L-01,L-04 |

### 02 · Stan obecny (prawda kodu) — karta §1. Org-scope wzorcowy (bez IDOR). Triada REALNA (live-proven 06-10). Dwa silniki artefaktów = realny dług integracji. `regenerateSlide` — karta mówi naprawiony (`36a6f240ff`), zakres do potwierdzenia runtime (R3).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | dwa rozłączne silniki artefaktów (store↔panel) | W-02,W-03 | `SplitLayout.tsx:461` vs `UnifiedChatPanel.tsx:5905`; `core.ts:2248` | INTEGRACJA-program | 0/Tryb C | **ODROCZONA (Fala 3 BETA)** — Tryb C konsolidacji silników, świadomie poza ścieżką krytyczną (SPEC_01 §5 Fala 3); czeka na D-01. = M01/L-09 Tryb C | 2026-06-13 |
| L-02 | zerwana więź po `draft-ready` (panel nie przełącza) | W-02,W-03 | `WorkCanvasDocumentPanel.tsx:704-747` | P0-program | 0/Fala1-B | **ZAMKNIĘTA 2026-06-17** (R3 — montaż deterministyczny `:722-747` + N-5 guard; commity `8a0e64b866`+`5278114d71`; testy `WorkCanvasDocumentPanel.test.tsx` 33/33) | 2026-06-17 |
| L-03 | halucynowane „dodałem" bez tool-calla | W-02,W-03 | `persona.ts:306/315` (honesty); `documentIntentDetector.ts` | P1-program | 0/Fala2-A | **CZĘŚCIOWO** — Tryb A: persona honesty contract obecny (`persona.ts:306/315`) + steering (`:598-611`) + intent detector rozszerzony (N-4/N-12); **odroczone:** function-calling `tool_generate_deliverable` = Fala 2 (AI-layer, staging+zgoda). P0 live-blocker zneutralizowany przez Tryb B. = M01/L-09 Tryb A | 2026-06-17 |
| L-04 | cicha degradacja flaga OFF (legacy redirect bez banera) | W-01,W-06 | `VITE_ENABLE_DELIVERABLES_LIGHT` OFF | P3 | 3 | otwarta | — |
| L-05 | `POST /:id/generate` default 'deck' | W-01 | `deliverablesGenerations.routes.ts:198-209` | P3 | 3 | **ZAMKNIĘTA 2026-06-17** (brak/zły format → 400 zamiast cichego 'deck'; FE zawsze wysyła jawny format; test `deliverablesGenerations.generate-format.test.ts` 3/3) | 2026-06-17 |
| L-06 | `regenerateSlide` STUB | W-01 | `presentationGeneratorService.ts:1660-1727` | P2 | 3 | **ZAMKNIĘTA 2026-06-17** (R3 PASS — NIE stub: org-scope query + Narrative Engine `generateNarrative` + post-check gate + surgical deck_json rebuild; commit `36a6f240ff`. D-03/DP-5 „hide" bezprzedmiotowe — realnie działa) | 2026-06-17 |
| L-07 | brak pickera sourceRefs | W-01 | `docGenerationRuntime.ts:115-187` | P2 | 3 | otwarta | — |
| L-08 | 8/9 capabilities `canvas.*` martwe serwerowo | W-01 | `work-canvas.routes.ts:3915,3943` | P2 | 3 | otwarta | — |
| L-09 | GUEST może tworzyć/edytować/materializować | W-01 | RBAC (org-scoped, nie IDOR) | P2-design | 3 | **D-02** | — |
| L-10 | SEC-M02-3/4 (legacy capability check; share token shape) | W-01 | accept-proposal; `/shared/:token` | P3 | 3 | **CZĘŚCIOWO 2026-06-17** — **L-10b SEC-M02-4 ZAMKNIĘTA** (token-shape `^[0-9a-f]{32}$` walidowany PRZED LIKE-scan w `work-canvas.routes.ts:3959-3966`; test `work-canvas.routes.test.ts` +2). **L-10a SEC-M02-3 OTWARTA** (accept-proposal `:3585` używa legacy `canUseWorkCanvasCapability` zamiast async `requireCanvasCapability`/effective-access — do utwardzenia, P3) | 2026-06-17 |
| L-11 | panel `WorkCanvasDocumentPanel` bez `useTranslation`, hardkody PL/EN | W-01 | grep: 0× `useTranslation` | P2 | 3/4 | otwarta | 2026-06-13 |
| L-12 | ~34 surowych util palety w panelu | W-01 | `WorkCanvasDocumentPanel.tsx` | P3 | 4 | otwarta | 2026-06-13 |
| L-13 | martwy `commitProposalToDomain` duplikat materializera | W-01 | `workCanvasService.ts:938,1119` | MARTWY | 4 | **FALSE POSITIVE 2026-06-17** (NIE martwy — wywoływany w ścieżce approve-proposal `workCanvasService.ts:1119` `const readBack = await commitProposalToDomain(...)`; aktywny kod) | 2026-06-17 |
| L-14 | mock `UnifiedChatPanel.test.tsx` 14 FAIL (brak `setConversationChatLanguage`) | W-01 | `tests/components/AIChat/UnifiedChatPanel.test.tsx` | P0-test | — | **ZAMKNIĘTA 2026-06-17** (R3 — mock naprawiony, **29/29 PASS** w tym test „derives chat language from explicit preference"; naprawione przy commitach L-08/steering) | 2026-06-17 |
| L-15 | brak testów S6 (viewer/revoke) + S7 (cross-org 403) | W-01 | brak regresji | P0-test | — | otwarta | — |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Konsolidacja dwóch silników: most czy jeden silnik? | most adapter / konsolidacja na `WorkCanvasDocumentPanel` | Piotr | TBD (przed szlifem) | otwarta (modułowa — przy wejściu w moduł) |
| D-02 | GUEST: czy może tworzyć/materializować? | tak (z org-scope) / nie (read+share only) | Piotr | TBD | otwarta (modułowa — przy wejściu w moduł) |
| D-03 | `regenerateSlide`: realny LLM-call czy ukryć? | realny narrative-engine / hide | Piotr | TBD | **ROZSTRZYGNIĘTE → DP-5: ukryj za flagą + label „wkrótce"** |

### 05 · Flagi / rollout / beta — `ENABLE_DELIVERABLES_LIGHT` strict `=== 'true'` (OFF→404 backend / legacy redirect FE); `ENABLE_TERESA_RETRIEVAL` (cicha pustka READ-tooli); beta core otwarty.
### 06 · Ryzyka i założenia — kręgosłup #1 dotyka M18/M19/M20 (re-ocena D po fixie). Inwentarz/brief STALE (4/6 czerwonych flag obalonych). Dev `.env` → Railway PROD (flagi decydują czy triada żyje). `regenerateSlide` — R3: nie kwalifikować „naprawione" bez potwierdzenia runtime.
### 07 · Log + re-ocena — **2026-06-17 (Harvard 1) — R3 rekonsyliacja + 2 naprawy:**
> Teczka była nieaktualna (wzorzec jak M01). Zweryfikowane w runtime + testy zielone:
> - **ZAMKNIĘTE:** L-02 (Tryb B montaż deterministyczny, 33/33) · L-05 (generate→400, 3/3) · L-06 (regenerateSlide realny, R3) · L-10b SEC-M02-4 (token-shape walidacja, +2) · L-14 (mock 29/29).
> - **FALSE POSITIVE:** L-13 (commitProposalToDomain żywy `:1119`).
> - **CZĘŚCIOWO/ODROCZONE:** L-01 (Tryb C → Fala 3 BETA) · L-03 (Tryb A honesty done, function-call → Fala 2) · L-10a SEC-M02-3 (legacy cap check, P3).
> - **OTWARTE (udokumentowane):** L-04 (cichy redirect flaga-OFF, P3 — banner do dodania) · L-07 (sourceRefs picker UI, P2) · L-08 (8/9 capabilities `canvas.*` nieegzekwowane serwerowo, P2 — wymaga decyzji zakresowej) · L-09 (D-02 GUEST, decyzja Piotra) · L-11 (panel bez `useTranslation` — ZABLOKOWANE: locale keys zakazane dla H1) · L-12 (~168 palette → Visual Standard, P3 — nakłada się na program Visual Quality) · L-15 (testy S6/S7 canvas, P0-test — do napisania).
> - **DEBLOKER #1:** instrukcja flagi Railway dla Piotra → `M02_RAILWAY_DELIVERABLES_FLAG_INSTRUKCJA.md` (VITE_ENABLE_DELIVERABLES_LIGHT build-time + ENABLE_DELIVERABLES_LIGHT runtime). Kod gotowy, deploy czeka na Piotra.
>
> 2026-06-13: teczka pogłębiona + spięta z SPEC_01; triada live-proven 06-10; org-scope wzorcowy potwierdzony. Re-ocena D po naprawie kręgosłupa (Faza 0).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+SPEC_01+uwaga żywa #1+formuła+DP-2/DP-5+feedback prod) · R2 zero sierot (W→L→DoD) · R3 statusy z dowodem (L-06 `36a6f240ff` zakres do potwierdzenia; org-scope zweryfikowany) · R4 DoD z liczbami grep (useTranslation 0, hex 0, util ~34, table 0) · R5 decyzje rozstrzygnięte (D-03=DP-5; D-01/D-02 modułowe) · A–E docelowy z layoutem+stanami+enumeracją ~30 endp.+maszyna `kind` · F epiki↔stories↔Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = weryfikacja kręgosłupa #1 (Faza 0). **Teczka kompletna do egzekucji.**
