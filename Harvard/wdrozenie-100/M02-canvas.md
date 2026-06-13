# TECZKA M02 — Canvas (chat split-view / deliverables-light)

> Teczka = **cienki indeks + reconciliation**, NIE duplikat. Linkuje istniejące (karta audytu + `docs/standards/*` + kod) i dokłada brakujące ogniwa (Rejestr Wejść z uwagą żywą #1 · Rejestr Decyzji · DoD z liczbami · korekta staleności). Wzór: [`_WZORZEC_TECZKI.md`](_WZORZEC_TECZKI.md) · format: [`M13-inicjatywy.md`](M13-inicjatywy.md).

## 00 · Nagłówek
- **Moduł:** M02 Canvas (chat split-view, deliverables-light) · **Pula:** beta · **Faza:** FAZA 3 (szlif beta; korzysta z kręgosłupa FAZA 0)
- **Ocena audytu:** 59/100 (najsilniejszy moduł) · **Tier:** Alpha górny → kandydat Beta · **Rozmiar:** M (1–3 dni)
- **Żywy bloker:** brak P0/P1 *modułowych* — ALE **uwaga żywa #1 (chat-as-controller) = P0-PROGRAM**, kręgosłup; tu = kanał weryfikacji
- **Właściciel:** Piotr · **Daty:** karta 2026-06-XX · teczka 2026-06-13
- **Karta:** `Harvard/modules/M02-canvas/KARTA_AUDYTU.md` · **WP-baza:** poprzednia wersja tego pliku (zachowana niżej w warstwach B/C/F)
- **Kod:** `src/components/AIChat/WorkCanvasDocumentPanel.tsx` · `…/UnifiedChatPanel.tsx` · `…/CanvasEditor/` · `…/canvasStreamIntentDetector.ts` · `server/src/routes/work-canvas.routes.ts` · `server/src/services/canvasMaterialize.ts` · `server/src/services/deliverables/docGenerationRuntime.ts` · `server/src/services/presentationGeneratorService.ts`
- **SPEC kręgosłupa:** `Harvard/SPEC_ZADANIE_01_chat_controller.md`

## MAPA POKRYCIA (co już jest vs co dokłada teczka)
| Warstwa | Stan | Źródło (istnieje) | Co dokłada teczka |
|---|---|---|---|
| A Intencja | 🟢 | karta werdykt + `[[project_canvas_overhaul]]`/`[[project_canvas_program]]` | job-to-be-done + zakres (niżej) |
| B UX docelowe | 🟢 | karta §5 + `[[project_deliverables_light_l1]]` | agentic-canvas docelowy + delta #1 |
| C Dane+API+reguły | 🟢 | karta §1e/§1f + `work-canvas.routes.ts` + `canvasMaterialize.ts` | skrót kontraktu (niżej) |
| D AI/Teresa | 🟢 | `CARD_CONTENT_FORMULA.md` + detektory intencji + SPEC_01 | dwa silniki artefaktów + delta #1 |
| E Integracje | 🟢 | karta §1g | skrót mostów |
| F Epiki | 🟢 | poprzedni WP §3 (6 kroków) | przeformułowane na epiki |
| G DoD/jakość | 🟢 | karta §0/§2 + poprzedni WP §4 | **liczby grep** (niżej) |
| H Governance | 🟢 (dołożone) | karta §1/§6 | **Rejestr Wejść (#1) + Decyzji + korekta staleności** |

---

## A · INTENCJA *(link + uzupełnienie)*
Kontekst: `[[project_canvas_overhaul]]`, `[[project_canvas_program]]`, `[[project_deliverables_light_l1]]`. Terminologia: `[[feedback_canvas_vs_ideas]]` (Canvas = chat split-view; Ideas = My Work tools).
- **Job-to-be-done:** zamienić rozmowę z Teresą w żywy artefakt (deck/doc/sheet) widoczny i edytowalny po prawej, bez opuszczania czatu — „agentic canvas".
- **Persony/role:** konsultant (twórca/edytor), klient (odbiorca przez share), admin (org-scope). GUEST = decyzja (SEC-M02-2).
- **Zakres v1:** triada generacji deck/doc/sheet (flaga `ENABLE_DELIVERABLES_LIGHT`) · patch-mode + streaming do TipTap · cykl życia artefaktu (wersje/switcher/chip) · public share+revoke · materializacja do encji (idea/note/initiative/decision/task) · eksport 7 formatów. **POZA v1:** agentic „polecenia wpisane wewnątrz dokumentu" (decyzja produktowa), what-if.
- **Metryka:** % rozmów „zrób deck/doc" kończących się WIDOCZNYM artefaktem (nie halucynacją „dodałem"); trwałość draftu po reload.

## B · UX DOCELOWE
Stan obecny UI + odstępstwa §27: karta §5. Cykl życia artefaktu (wersje/switcher/chip/patch/auto-emisja) wdrożony i live-proven 06-10.
- **Stany ekranu:** pusty (szablon „Company Work Note") · ładowanie · błąd · pełny (artefakt) · flaga OFF (legacy redirect — patrz L-04, ma być z banerem).
- **Delta docelowa (#1, kręgosłup):** po `deliverables:draft-ready` prawy panel MUSI auto-przełączyć się na świeży draft niezależnie od bieżącego `draftId`; potwierdzenie Teresy = realny tool-call z weryfikacją widoczności, nie proza „Plan został dodany". **To rekoncyliacja kręgosłupa, nie greenfield** — projekt fazami w `SPEC_ZADANIE_01_chat_controller.md`.

## C · DANE + API + REGUŁY *(link + skrót)*
- **Wiring FE↔BE↔DB:** karta §1e. **Flagi:** karta §1f (`ENABLE_DELIVERABLES_LIGHT` / `VITE_ENABLE_DELIVERABLES_LIGHT`).
- **Org-scope (wzorcowy):** każdy endpoint `work-canvas.routes.ts` z `:draftId` przez centralny `ownedDraft` (`WHERE id=? AND organization_id=?`); materializacja przez `assertOrgScopedReferences` (`canvasMaterialize.ts:87-114`, save+accept). **Jeden z dwóch modułów bez cross-org IDOR** (obok M25).
- **Reguły:** triada za flagą; `POST /:id/generate` domyśla 'deck' przy braku formatu (L-05 — wymusić 400). Capabilities `canvas.*`: tylko `canvas.share` egzekwowane serwerowo (SEC-M02-1).

## D · AI / TERESA *(SSOT + dwa silniki)*
- **Co generuje:** deck/doc/sheet wg `docGenerationRuntime.ts` (anti-placeholder gate) + `presentationGeneratorService.ts`; treść wg `docs/standards/CARD_CONTENT_FORMULA.md`.
- **Sterowanie (kręgosłup #1):** intencja z czatu przez `canvasStreamIntentDetector.ts:91-101` + `documentIntentDetector.ts`; patch-mode działa TYLKO gdy dokument już otwarty (`activeCanvasDocument !== null`, `UnifiedChatPanel.tsx:2956`). Granica persony „nie udawaj wykonania" łamana w trybie A (halucynacja) — `persona.ts:303-319`.
- **Dwa rozłączne silniki artefaktów:** legacy `ArtifactsPanel`+`useArtifactsStore` (`SplitLayout.tsx:461`) vs nowy `WorkCanvasDocumentPanel` (`UnifiedChatPanel.tsx:5905`); typy `Artifact.type` (`core.ts:2248`) vs `ActiveCanvasDocument.kind` niełączone → artefakt ląduje w jednym store, user patrzy na drugi panel (L-01, kręgosłup Tryb C).

## E · INTEGRACJE
Pełna tabela: karta §1g. Skrót: **→** M17 Outputs (eksport), M03 (Decyzja/Task), M13 (Inicjatywa), M05/M04 (Idea/Notatka), public share `/public/artifacts/:token`. **←** M01 czat (intent). **Kręgosłup:** `UnifiedChatPanel` + `WorkCanvasDocumentPanel` + pipeline `deliverables:draft-ready` — wspólny z M18/M19/M20 (Document/Presentation/Table Studio); pęknięcie promieniuje (uwaga #1 SYSTEMOWE).

## F · EPIKI *(z poprzedniego WP §3, forma epików)*
- **EPIK 1 — Kręgosłup czat→canvas (#1):** auto-mount świeżego draftu po `draft-ready` (L-02); realny tool-call zamiast halucynacji (L-03); konsolidacja/most dwóch silników artefaktów (L-01). [SPEC_01 Fala 1 Tryb B → Tryb C]
- **EPIK 2 — Domknięcie generacji:** `regenerateSlide` realny lub ukryć (L-06); picker sourceRefs (L-07); `POST /:id/generate` bez default-deck (L-05).
- **EPIK 3 — Bezpieczeństwo capabilities:** egzekucja `canvas.*` serwerowo 8/9 (L-08) + decyzja GUEST (L-09); SEC-M02-3/4 (L-10).
- **EPIK 4 — Odporność:** baner przy flaga-OFF legacy redirect (L-04).
- **EPIK 5 — Szlif kanonu:** i18n panelu `WorkCanvasDocumentPanel` (L-11); tokeny (L-12); wytnij martwy `commitProposalToDomain` (L-13).
- **EPIK 6 — Testy do PR-gate:** fix mocka UnifiedChatPanel (L-14); S6/S7 E2E (L-15).

## G · JAKOŚĆ / DoD *(skwantyfikowane — grep 2026-06-13)*
| # | Kryterium | Miara M02 |
|---|-----------|-----------|
| 1 | Front↔back | triada deck/doc/sheet generuje na realnych danych; po `draft-ready` panel auto-przełącza (#1); `regenerateSlide` realnie regeneruje lub ukryty; draft+wersje trwałe po reload; 0 martwych CTA |
| 2 | Bezpieczeństwo | cross-org już szczelne (test regresji S7); capabilities `canvas.*` egzekwowane serwerowo (1/9→9/9) lub świadoma decyzja; GUEST rozstrzygnięty |
| 3 | i18n | **0** `isPolish` w plikach Canvas (`WorkCanvasDocumentPanel`+`Canvas*`+`CanvasEditor`) — ALE panel **bez `useTranslation`** (0 wywołań) i miesza hardkody PL/EN; wprowadzić `t()` |
| 4 | Tokeny | **0** hex w plikach Canvas; ~34 surowych util palety (`rounded-xl`/literały) w `WorkCanvasDocumentPanel` → tokeny Visual Standard |
| 5 | §27 | **0** surowych `<table>` w plikach Canvas — N/D (brak tabel-list; wersje/switcher ad-hoc dopuszczone) |
| 6 | E2E w PR-gate | fix mocka `UnifiedChatPanel.test.tsx` (14 FAIL→0) + S6 (share/revoke) + S7 (cross-org materialize 403) zielone na `Londyn` |

Scenariusze S1–S8: karta §0. Bezpieczeństwo: karta §6.

## H · GOVERNANCE *(dołożone ogniwa)*

### 01 · Rejestr wejść (R1) — scala WSZYSTKIE źródła
| ID | Źródło | Data | Treść (1 zd.) | → Luka |
|----|--------|------|----------------|--------|
| W-01 | Karta audytu §1–§7 | karta | wiring/sec/plan | L-04..L-15 |
| W-02 | **Uwaga żywa #1 — czat NIE steruje aplikacją (SYSTEMOWE/P0-program)** | 2026-06-13 | Teresa mówi „dodałem do Canvasa", panel pusty; zerwana więź `draft-ready`, dwa silniki artefaktów | **L-01,L-02,L-03 (KRĘGOSŁUP)** |
| W-03 | **SPEC `SPEC_ZADANIE_01_chat_controller.md`** | 2026-06-13 | pełny work-package fazami (Tryb A halucynacja / B zerwana więź / C konsolidacja) | L-01,L-02,L-03 |
| W-04 | `docs/standards/CARD_CONTENT_FORMULA.md` | — | formuła treści deliverables | D (kanon) |
| W-05 | Feedback prod (triada live 06-10) | 2026-06-10 | deck/doc/sheet zweryfikowane żywo | (potwierdza A1a karty) |

### 02 · Stan obecny (prawda kodu) — karta §1. Org-scope wzorcowy (bez IDOR). Triada REALNA. Dwa silniki artefaktów = realny dług integracji. `regenerateSlide` STUB (`presentationGeneratorService.ts`).

### 03 · Rejestr luk (= docelowy − obecny)
| ID | Opis | Wejście | Dowód `plik:linia` | Klasa | Faza | Status | Zweryf. |
|----|------|---------|--------------------|-------|------|--------|---------|
| L-01 | dwa rozłączne silniki artefaktów (store↔panel) | W-02,W-03 | `SplitLayout.tsx:461` vs `UnifiedChatPanel.tsx:5905`; `core.ts:2248` | INTEGRACJA-program | 0/Tryb C | otwarta (D-01) | 2026-06-13 |
| L-02 | zerwana więź po `draft-ready` (panel nie przełącza) | W-02,W-03 | `WorkCanvasDocumentPanel.tsx:1039-1043` | P0-program | 0/Fala1-B | otwarta | 2026-06-13 |
| L-03 | halucynowane „dodałem" bez tool-calla | W-02,W-03 | brak komunikatu w kodzie; `persona.ts:303-319` | P1-program | 0 | otwarta | 2026-06-13 |
| L-04 | cicha degradacja przy fladze OFF (legacy redirect bez banera) | W-01 | `VITE_ENABLE_DELIVERABLES_LIGHT` OFF | P3 | 3 | otwarta | — |
| L-05 | `POST /:id/generate` default 'deck' | W-01 | `deliverablesGenerations.routes.ts:198` | P3 | 3 | otwarta | — |
| L-06 | `regenerateSlide` STUB | W-01 | `presentationGeneratorService.ts:1656-1672` | P2 | 3 | **otwarta — R3: re-audit twierdzi `36a6f240ff` (per-card AI w DeckBuilder); zweryfikować runtime czy pokrywa regenerateSlide** | 2026-06-13 (commit istnieje, zakres do potwierdzenia) |
| L-07 | brak pickera sourceRefs | W-01 | `docGenerationRuntime.ts:115-187` | P2 | 3 | otwarta | — |
| L-08 | 8/9 capabilities `canvas.*` martwe serwerowo | W-01 | `work-canvas.routes.ts:3915,3943` | P2 | 3 | otwarta | — |
| L-09 | GUEST może tworzyć/edytować/materializować | W-01 | RBAC kompletność (org-scoped) | P2-design | 3 | **D-02** | — |
| L-10 | SEC-M02-3/4 (legacy capability check; share token shape) | W-01 | accept-proposal; `/shared/:token` | P3 | 3 | otwarta | — |
| L-11 | panel `WorkCanvasDocumentPanel` bez `useTranslation`, hardkody PL/EN | W-01 | grep: 0× `useTranslation` | P2 | 3/4 | otwarta | 2026-06-13 |
| L-12 | ~34 surowych util palety w panelu | W-01 | `WorkCanvasDocumentPanel.tsx` (grep 34) | P3 | 4 | otwarta | 2026-06-13 |
| L-13 | martwy `commitProposalToDomain` duplikat materializera | W-01 | `workCanvasService.ts` | MARTWY | 4 | otwarta | — |
| L-14 | mock `UnifiedChatPanel.test.tsx` 14 FAIL (brak `setConversationChatLanguage`) | W-01 | test `:90-108`; prod `:3030` | P0-test | — | otwarta | — |
| L-15 | brak testów S6 (viewer/revoke) + S7 (cross-org 403) | W-01 | brak regresji | P0-test | — | otwarta | — |

### 04 · Rejestr decyzji (R5)
| ID | Pytanie | Opcje | Właściciel | Termin | Status |
|----|---------|-------|------------|--------|--------|
| D-01 | Konsolidacja dwóch silników artefaktów: most store↔panel czy jeden silnik? | most adapter / pełna konsolidacja na `WorkCanvasDocumentPanel` | Piotr | TBD (przed szlifem) | otwarta |
| D-02 | GUEST: czy może tworzyć/materializować w Canvas? | tak (z org-scope) / nie (read+share only) | Piotr | TBD | otwarta |
| D-03 | `regenerateSlide`: realny LLM-call czy ukryć akcję? | realny narrative-engine / hide | Piotr | TBD | otwarta |

### 05 · Flagi/rollout — `ENABLE_DELIVERABLES_LIGHT` (triada; staging→prod za zgodą); beta core (otwarty). Flaga OFF → legacy `/wordy`/`/excele`/`/prezentacje`.
### 06 · Ryzyka — kręgosłup #1 dotyka M18/M19/M20 (re-ocena D w `_TRACKER.md` po fixie). Dev `.env` → Railway PROD (flagi decydują czy triada żyje).
### 07 · Log — 2026-06-13: teczka spięta z SPEC_01; triada live-proven 06-10; org-scope wzorcowy potwierdzony. Re-ocena D po naprawie kręgosłupa (Faza 0).

---

## Bramka teczki: 9/9 dokumentacyjnie ✅
R1 wejścia pełne (karta+SPEC_01+uwaga żywa #1+formuła+feedback prod) · R2 zero sierot (W→L→DoD) · R3 statusy z dowodem (L-06 `36a6f240ff` istnieje, zakres do potwierdzenia runtime; org-scope zweryfikowany) · R4 DoD z liczbami grep (i18n 0/`useTranslation` 0, hex 0, util ~34, table 0) · R5 decyzje z właścicielem (terminy TBD) · A–E docelowy zlinkowany · F epiki↔luki · G DoD+S+sec · R6 sesja żywa = weryfikacja kręgosłupa #1 (Faza 0). **Teczka kompletna do egzekucji.**
