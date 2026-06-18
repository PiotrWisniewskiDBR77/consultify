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
| L-03 | halucynowane „dodałem" bez tool-calla | W-02,W-03 | `unbackedCanvasClaim.ts` + `persona.ts:306/315` | P1-program | 0/Fala2-A | **ZAMKNIĘTA 2026-06-17 (guard + lock)** — dostarczony deterministyczny, testowalny guard BEZ function-callingu: `src/components/AIChat/unbackedCanvasClaim.ts` (`claimsCompletedCanvasAction` PL+EN, completed-claim vs propozycja, diacritic-safe + predykat kontraktowy `isHallucinatedCanvasConfirmation(text,{handoffOccurred})`). Test `tests/unit/unbackedCanvasClaim.test.ts` 36/36: claimy PL+EN wykryte, propozycje/pytania NIE flagowane, tabela prawdy + **source-guard kontraktu uczciwości w `persona.ts` (PL `:306`, EN `:315`)** — reguła nie zniknie po cichu. **Fala 2 (udokumentowane):** runtime auto-korekta wymaga `handoffOccurredThisTurnRef` w interceptach + finalizacja w `useAIStream.ts:561` (poza czystym zakresem FE). Punkt wpięcia: `UnifiedChatPanel.tsx:3768`. = M01/L-09 Tryb A | 2026-06-17 |
| L-04 | cicha degradacja flaga OFF (legacy redirect bez banera) | W-01,W-06 | `UnifiedChatPanel.tsx` excele `:2394/2398`, doc `:2645/2649`, prez `:2850/2854` | P3 | 3 | **ZAMKNIĘTA 2026-06-17** (R3 — NIE cicha: każda z 3 ścieżek redirect przy fladze OFF dodaje `addChatMessage` „Otwieram Tabele Studio/Dokumenty/Prezentacje — zaraz…" PRZED `navigateToRoute`. Numery linii dryfują przez współbieżne commity — kotwica = id `excele-redirect`/`doc-redirect`/`prez-redirect`) | 2026-06-17 |
| L-05 | `POST /:id/generate` default 'deck' | W-01 | `deliverablesGenerations.routes.ts:198-209` | P3 | 3 | **ZAMKNIĘTA 2026-06-17** (brak/zły format → 400 zamiast cichego 'deck'; FE zawsze wysyła jawny format; test `deliverablesGenerations.generate-format.test.ts` 3/3) | 2026-06-17 |
| L-06 | `regenerateSlide` STUB | W-01 | `presentationGeneratorService.ts:1660-1727` | P2 | 3 | **ZAMKNIĘTA 2026-06-17** (R3 PASS — NIE stub: org-scope query + Narrative Engine `generateNarrative` + post-check gate + surgical deck_json rebuild; commit `36a6f240ff`. D-03/DP-5 „hide" bezprzedmiotowe — realnie działa) | 2026-06-17 |
| L-07 | brak pickera sourceRefs | W-01 | `docGenerationRuntime.ts:496-545,704-729` | P2 | 5 | **ODROCZONA — SCOPED (wymaga backendu, nie FE-only)** 2026-06-17 (sub-agent audit): picker FE-only byłby **no-op** — `generate` IGNORUJE body-setup grounding (`startSheet` re-czyta `draft.provenance…sheetSetup.sourceRefs` `:704-729`), a kandydaci źródeł są odkrywani DOPIERO wewnątrz kroku PLAN (`autoScanOrgSources :496-545`); brak endpointu listującego źródła (tylko `POST /`, `POST /:id/generate`, `GET /:id`, `GET /metrics`). FE pokazuje już `planned.sources` read-only w checkliście (`UnifiedChatPanel.tsx:2311,2557,2776`). **Plan:** B-1 (backend) — `start*` honoruje body `setup.sourceRefs` LUB idempotentny re-plan; FE-1 `DeliverableSourcePicker.tsx` (checkboxy nad `planned.sources`); FE-2 wpięcie w 3 intercepty za flagą; FE-3 test. Poza moją strefą (FE-only) bez B-1 |
| L-08 | 8/9 capabilities `canvas.*` martwe serwerowo | W-01 | `work-canvas.routes.ts` (share/convert/output gates) | P2 | 3 | **ZAMKNIĘTA 2026-06-17** — **9/9 egzekwowane serwerowo** przez `requireCanvasCapability`/`hasCanvasCapability` (effective-access SSOT): `canvas.share` (share POST/DELETE), `canvas.convert.*` (approve `:3586` + bezpośredni save-to-workspace `:4019`), `canvas.output.*` (create-output `:4106` + send-to-table-studio + send-to-document-studio). Testy +3 deny (40/40). Lista kanoniczna: `effectiveAccessService.ts:376-386` | 2026-06-17 |
| L-09 | GUEST może tworzyć/edytować/materializować | W-01 | `effectiveAccessService.ts:393-394,685` + bramki L-08 | P2-design | 3 | **ZAMKNIĘTA 2026-06-17** (rozwiązane przez L-08 — GUEST NIE ma żadnej capability `canvas.*` (tylko USER dostaje `CANVAS_MEMBER_CAPABILITIES`, `:393-394`), a `hasEffectiveCapability` wymaga `'*'` lub dokł. cap (`:685`); nowe bramki convert/output/share → GUEST 403. Lock źródłowy: `effectiveAccessService.test.ts:70` „does not grant canvas capabilities to GUEST". D-02 produktowo: opt-in jawny — dodać GUEST do baseline jeśli Piotr chce) | 2026-06-17 |
| L-10 | SEC-M02-3/4 (legacy capability check; share token shape) | W-01 | accept-proposal; `/shared/:token` | P3 | 3 | **ZAMKNIĘTA 2026-06-17** — **L-10b SEC-M02-4** (token-shape `^[0-9a-f]{32}$` walidowany PRZED LIKE-scan). **L-10a SEC-M02-3** (accept-proposal `:3585` przeniesione z legacy `canUseWorkCanvasCapability` na async `hasCanvasCapability`→effective-access SSOT; legacy fn usunięty). Testy `work-canvas.routes.test.ts`: token-shape +2, effective-access deny przerobiony, 37/37 | 2026-06-17 |
| L-11 | panel `WorkCanvasDocumentPanel` bez `useTranslation`, hardkody PL/EN | W-01 | re-grep 2026-06-17: **0×** `useTranslation`/`t(`, **28** inline lang-conditionals (panel+`Canvas*`) | P2 | 3/4 | **ZAMKNIĘTA 2026-06-18** — `useTranslation` dodany do `WorkCanvasMarkdownDocumentPanel` (wewnętrzny komponent z JSX). ~50 hardkodów (większość PL) wyekstrahowanych inline→`t('canvas.panel.*', EN-fallback)`: bloki common-actions, hints, add-element, selection (AI na zaznaczeniu), manual-edit, templates (+builder placeholdery+walidacja), workspace-actions, export (saving/saveToOutputs), md-properties (Właściwości pliku MD/Ukryj/Pokaż), capabilities, share-strip (link publiczny/kopiuj/cofnij udostępnianie/wygasa + toasty revoke), source-note. Klucze realnie PL+EN w `public/locales/{pl,en}/translation.json` (namespace `canvas.panel.*`, 66 kluczy). **NIE-luki:** 3× `starterTemplates[].label` PL = module-scope const (poza komponentem, render via `template.label` — kosmetyczny rezydual, nie blokuje). Bramki: gate-skrypt 92/92 `chat.*`/`canvas.*` rozwiązuje się PL I EN; render-test 92/92; `check-bare-missing` 0; tsc 0; testy `WorkCanvasDocumentPanel` 33/33 + `handoffMount` 2/2 + `UnifiedChatPanel` 29/29 (asserty "Właściwości pliku MD"→"MD file properties" i18n-fallback). Preview PL live zielony (panel za auth — render dowiedziony i18next render-testem + fetch served locale). SHA `2266c2c8d9` | 2026-06-18 |
| L-12 | ~34 surowych util palety w panelu | W-01 | `WorkCanvasDocumentPanel.tsx` (~168 util) | P3 | 4 | **ODROCZONA → program Visual Quality** ([[project_visual_quality_program]]) — ~168 surowych util palety (slate/navy/blue/primary); przebudowa na tokeny Visual Standard należy do dedykowanego sprintu wizualnego (SSOT `docs/qa/VISUAL_QUALITY_SPRINT_PLAN`), nie do tej fali funkcjonalnej. P3 szlif | 2026-06-13 |
| L-13 | martwy `commitProposalToDomain` duplikat materializera | W-01 | `workCanvasService.ts:938,1119` | MARTWY | 4 | **FALSE POSITIVE 2026-06-17** (NIE martwy — wywoływany w ścieżce approve-proposal `workCanvasService.ts:1119` `const readBack = await commitProposalToDomain(...)`; aktywny kod) | 2026-06-17 |
| L-14 | mock `UnifiedChatPanel.test.tsx` 14 FAIL (brak `setConversationChatLanguage`) | W-01 | `tests/components/AIChat/UnifiedChatPanel.test.tsx` | P0-test | — | **ZAMKNIĘTA 2026-06-17** (R3 — mock naprawiony, **29/29 PASS** w tym test „derives chat language from explicit preference"; naprawione przy commitach L-08/steering) | 2026-06-17 |
| L-15 | brak testów S6 (viewer/revoke) + S7 (cross-org 403) | W-01 | `canvasMaterializeCrossOrg.test.ts`; `work-canvas.routes.test.ts` | P0-test | — | **ZAMKNIĘTA 2026-06-17** — **S7** cross-org 403 zalockowany (`canvasMaterializeCrossOrg.test.ts` 3/3: projectId/ownerId/taskAssignee → 403). **S6** komplet: viewer-active (200), revoke→404, expiry→410 (`work-canvas.routes.test.ts`) | 2026-06-17 |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Konsolidacja dwóch silników: most czy jeden silnik? | most adapter / konsolidacja na `WorkCanvasDocumentPanel` | Piotr | TBD (przed szlifem) | otwarta (modułowa — przy wejściu w moduł) |
| D-02 | GUEST: czy może tworzyć/materializować? | tak (z org-scope) / nie (read+share only) | Piotr | TBD | **DEFAULT WYMUSZONY 2026-06-17 → NIE (read-only)** — bramki capability L-08 blokują GUEST end-to-end. Zmiana na „tak" = jawny opt-in (GUEST do `APPLICATION_ROLE_BASELINE_CAPABILITIES`) — decyzja Piotra |
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
> **RUNDA 2 (kontynuacja rozwoju, 2026-06-17):** domknięte kolejne: **L-04** (redirect flaga-OFF NIE cichy — 3× `addChatMessage`), **L-08** (9/9 capabilities `canvas.*` egzekwowane serwerowo — convert/output gates + deny-testy), **L-09/D-02** (GUEST read-only wymuszony przez bramki L-08), **L-10a** (accept-proposal na effective-access SSOT), **L-15** (S6 komplet: revoke→404, expiry→410 + S7). **Bilans M02: 11 zamkniętych/FP** (L-02,04,05,06,08,09,10,13,14,15 + L-01 odroczona-BETA). **Pozostaje:** L-03 (Tryb A function-call — Fala 2), L-07 (picker — feature po fladze), L-11 (i18n — ZABLOKOWANE locales), L-12 (palette → program Visual Quality). Testy M02: `work-canvas.routes` 40/40, `deliverablesGenerations.generate-format` 3/3, `canvasMaterializeCrossOrg` 3/3. tsc czysty.
>
> **RUNDA 3 (2026-06-17, fan-out 5 sub-agentów):** L-03 Tryb A ZAMKNIĘTA (guard + lock) — `unbackedCanvasClaim.ts` detektor halucynowanego potwierdzenia + predykat kontraktowy + source-guard persony, test 36/36 (`dad9c9acd6`); runtime auto-korekta = Fala 2 (wiring poza czystym zakresem FE). i18n re-grep: panel **0 `t()`, 28 inline** (L-11). Teczki R3-zweryfikowane spójne (SA5) — korekta linii L-04 zastosowana.
>
> 2026-06-13: teczka pogłębiona + spięta z SPEC_01; triada live-proven 06-10; org-scope wzorcowy potwierdzony. Re-ocena D po naprawie kręgosłupa (Faza 0).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+SPEC_01+uwaga żywa #1+formuła+DP-2/DP-5+feedback prod) · R2 zero sierot (W→L→DoD) · R3 statusy z dowodem (L-06 `36a6f240ff` zakres do potwierdzenia; org-scope zweryfikowany) · R4 DoD z liczbami grep (useTranslation 0, hex 0, util ~34, table 0) · R5 decyzje rozstrzygnięte (D-03=DP-5; D-01/D-02 modułowe) · A–E docelowy z layoutem+stanami+enumeracją ~30 endp.+maszyna `kind` · F epiki↔stories↔Gherkin↔luki · G DoD+S+sec · R6 sesja żywa = weryfikacja kręgosłupa #1 (Faza 0). **Teczka kompletna do egzekucji.**
