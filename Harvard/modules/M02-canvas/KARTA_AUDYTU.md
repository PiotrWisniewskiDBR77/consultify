# M02 — Canvas — Karta audytu (Protokół V1)

**Data:** 2026-06-11 · **Branch:** `feat/deliverables-light` (commit `327de9144f`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M02 · inwentarz `Harvard/podzial/inventory/INV_A_czat_canvas.md` (sekcja CANVAS, poz.1-33) · podkłady `CANVAS_MODULE_AUDITOR_BRIEF.md` + `DELIVERABLES_HARVARD_AUDIT_HANDOFF.md` (2026-06-11) · audyty `docs/audit/2026-06-10/CANVAS_*` i `DELIVERABLES_*` · `[[project_canvas_program]]`, `[[project_deliverables_light_l1]]`
**Evidence:** `Harvard/modules/M02-canvas/evidence/` (f1_code_truth.md, f2_tests_report.md, f2_tests.log, f56_kanon_sec.md)

## OCENA: 57/100 — Tier: Alpha (górny — kandydat na Beta) · status 🟦 NIEPEŁNY (Fazy 3+4 do wykonania)

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | 22 | Większość z 33 pozycji REALNA (część live-proven 06-10); realne STUB-y: `regenerateSlide`, brak pickera sourceRefs, martwy duplikat `commitProposalToDomain`. |
| B. Wiring i dane | 15 | 13 | Jeden kontrakt generacji, SSOT `content_md` po fixie P0-1, wersje append-only, registry; flagi czyste (404/redirect/cicha-pustka — wszystkie świadome). |
| C. Testy automatyczne | 15 | 9 | 99/99 PASS (brief zaniżał), ale S6 (share viewer/revoke) i S7 (org-guard materializacji) bez testu regresji; nic w PR-gate na `Londyn`, testy server/ poza CI. |
| D. Żywa użyteczność | 15 | 0 | Faza 4 (osobista) niewykonana — brief deklaruje LIVE z 06-10, ale protokół wymaga własnego dowodu. |
| E. Kanony/UI | 10 | 6 | §27 N/D (brak tabel-list), ale główny panel `WorkCanvasDocumentPanel` bez `useTranslation` (miesza PL/EN), ~61 surowych utili palety. |
| F. Bezpieczeństwo/dostęp | 10 | 7 | **0× P0/P1** — org-scope szczelny (`ownedDraft`), guard cross-org realny, public viewer solidny; P2: 8/9 capabilities `canvas.*` martwe serwerowo + GUEST może edytować. |
| G. Środowiska (Railway) | 10 | 0 | Faza 3 niewykonana. |
| **Hard cap zastosowany?** | — | — | **Faza 4 niewykonana → max 70 + „NIEPEŁNY".** BRAK cap cross-org (pierwszy obok M25 moduł bez IDOR — zweryfikowane osobiście). Suma 57 < 70. |

**Werdykt jednym akapitem:** Najsilniejszy dotąd zaudytowany moduł i jeden z dwóch (obok M25) **łamiących serię cross-org IDOR** — zweryfikowane osobiście: każdy endpoint `work-canvas.routes.ts` z `:draftId` przechodzi przez centralny loader `ownedDraft` (`:2068` `SELECT * FROM work_canvas_drafts WHERE id = ? AND organization_id = ?` + check własności/widoczności → 404), a materializacja do encji jest blokowana przez realny `assertOrgScopedReferences` (`canvasMaterialize.ts:87-114`, weryfikuje org-membership project/owner/assignee, wołany na OBU ścieżkach: save + accept propozycji). Triada generacji (deck/doc/sheet) za flagą `ENABLE_DELIVERABLES_LIGHT`, deck+doc live-proven 06-10; cykl życia artefaktu (wersje/switcher/chip/patch/auto-emisja) wdrożony; wszystkie mosty międzymodułowe (Notatki, Ideas, Inicjatywy, Insighty, Outputs, Decyzje/Tasks, Eksport, Share) zbudowane. Public viewer w pełni utwardzony (token 32-hex, rate-limit 30/min/IP, 404/410, payload sanitizowany, revoke unieważnia). **Kluczowe odkrycie audytowe: 4 z 6 „czerwonych flag" z inwentarza są STALE** — opisują stan sprzed commitów P1 z 2026-06-10: deck `##`/`[Fact:]` sanityzowany (`presentationGeneratorService.ts:378-406`, commit `d61f532f8d`), C4 provenance pisany na żywej ścieżce (`work-canvas.routes.ts:3632,4027`), sourceRefs używane w doc/sheet (`docGenerationRuntime.ts:115-187`), zapis-jako-notatka daje link „Open →". Realne pozostałe braki to: `regenerateSlide` STUB (`presentationGeneratorService.ts:1656-1672` zwraca istniejący slajd, zero LLM), `POST /:id/generate` defaultuje do 'deck' (P2), brak pickera sourceRefs w UI, oraz dwie luki RBAC-kompletności (8/9 capabilities martwe serwerowo, GUEST edytuje — ale wszystko org-scoped, więc nie IDOR). Sufit oceny to wyłącznie niewykonane Fazy 3+4 (D=0, G=0 kosztują 30 pkt) — po żywej weryfikacji moduł realnie wskakuje w Beta.

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist:** INV_A sekcja CANVAS, poz.1-33 (8 grup A-H). Backbone Fazy 0/1 oparty na briefie + inwentarzu (2026-06-11), zweryfikowany w kodzie.
**Scenariusze krytyczne (8):**
1. **S1** — Deck z czatu: intent → checklista → żywy deck w panelu.
2. **S2** — Doc z czatu: realna proza z anti-placeholder gate → edytor bez reloadu.
3. **S3** — Sheet z czatu: GFM-table z bezstratnym round-tripem.
4. **S4** — Patch-mode: chirurgiczna edycja z czatu → diff accept/reject.
5. **S5** — Historia wersji + restore.
6. **S6** — Public share + revoke + viewer `/public/artifacts/:token`.
7. **S7** — Promote/materializacja do encji (idea/note/initiative/decision/task) z org-guardem.
8. **S8** — Eksport 7 formatów (md/csv/json/pdf/docx/xlsx/pptx).
**Obowiązujące kanony:** §27 — **N/D** (brak tabel-list; wersje/switcher/propozycje = ad-hoc) · CARD_CONTENT_FORMULA: **N/D** (Canvas to edytor, nie produkuje kart) · wzorzec hubowy: panel w czacie (`WorkCanvasDocumentPanel`, brak własnego route) · gating: częściowo za `ENABLE_DELIVERABLES_LIGHT`.

## 1. Prawda kodu (FAZA 1)
> Raport: `evidence/f1_code_truth.md`. Metoda: weryfikacja znanych czerwonych flag (nie re-inwentaryzacja 33 poz.).

### 1a. REALNE (zweryfikowane / live-proven 06-10)
- Edytor TipTap, AI floating menu (diff accept/reject), streaming, autosave z anty-szkieletem; triada deck/doc/sheet (za flagą); wersje+restore (B1 live); switcher+chip reload-safe (B2 live); patch-mode (B3, 13 testów); auto-emisja (B4 live); public share+revoke (D1 live); eksport 7 formatów (live); mosty: Notatki C3, Ideas C5, Inicjatywy C1/C2 (panel `InitiativeDocumentView.tsx:654`), Outputs registry C7, Decyzje/Tasks materializacja.

### 1b. MOCK / STUB / fabrykowane klientem
- **[P2] `regenerateSlide` STUB** — `presentationGeneratorService.ts:1656-1672` zwraca `slides[idx]` bez LLM/regeneracji. **POTWIERDZONE.**
- **[P2] sourceRefs bez pickera** — generator UŻYWA refów (`docGenerationRuntime.ts:115-187`), ale UI wysyła tylko z `workspaceContext`, brak pickera; deck pomija. (poz.17 „nieużywane" — CZĘŚCIOWO OBALONE.)
- **[P3] `POST /:id/generate` default 'deck'** — `deliverablesGenerations.routes.ts:198`. **POTWIERDZONE.**

### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- **[P3] M-5 endpoint 500** — NIEZWERYFIKOWANE (audyt podał etykietę bez adresu route; wymaga live-repro w Fazie 4).
- **Czerwone flagi STALE (OBALONE w kodzie):** deck `##`/`[Fact:]` (sanityzer `presentationGeneratorService.ts:378-406`), C4 provenance dead-path (realnie pisze `:3632,:4027`), note bez linku (`WorkCanvasDocumentPanel.tsx:2116` daje `[Open →]`).

### 1d. UKRYTE / MARTWY KOD
- **[MARTWY] `commitProposalToDomain`** (`workCanvasService.ts`) — duplikat materializera; żywa ścieżka idzie przez `createWorkspaceResource`→`materializeWorkspaceTarget` → wytnij.
- **[NIE MARTWY — stale doc] `/ai/work-canvas`** — to `<Navigate>` redirect do `/chat?workPanel=1` (`WorkCanvasRedirect.tsx`), nie „internal tools".
- **[ŻYWY RÓWNOLEGŁY] `ArtifactsPanel/ArtifactViewer/ArtifactEditor`** — starszy silnik artefaktów czatu, render w `SplitLayout.tsx:21,403` (~10 widoków), sterowany `useArtifactsStore`. **Kandydat do konsolidacji z `WorkCanvasDocumentPanel`** (dwa równoległe systemy artefaktów).

### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint/serwis | Tabela DB | Status |
|---|---|---|---|
| Generacja triady | `POST /api/deliverables/generations` (poll `GET /:id`) | work_canvas_drafts | DZIAŁA (za flagą; org-scoped w serwisie) |
| Draft GET/PUT/save/export | `work-canvas.routes.ts` przez `ownedDraft` | work_canvas_drafts | DZIAŁA (org-scoped `:2068`) |
| Wersje | versions list/restore | work_canvas_versions (append-only) | DZIAŁA (draft_id z org-scoped SELECT) |
| Materializacja → encje | `canvasMaterialize` (`materializeWorkspaceTarget`) | ideas/notes/initiatives/decisions/tasks | DZIAŁA (guard cross-org) |
| Public share | `public-artifacts.routes.ts` | artifact + token | DZIAŁA (utwardzone) |
| Registry Outputs | `artifactRegistryService` | artifact_registry, ArtifactOriginLink | DZIAŁA |

### 1f. Flagi (realne defaulty RUNTIME — zweryfikowane)
| Flaga | Default | Runtime warunek | OFF → | Kto włącza |
|---|---|---|---|---|
| `ENABLE_DELIVERABLES_LIGHT` (backend) | OFF | `=== 'true'` (`FeatureFlags.ts:121`) | **404** (gate `deliverablesGenerations.routes.ts:39-44`) | env Railway |
| `VITE_ENABLE_DELIVERABLES_LIGHT` (frontend) | OFF | `=== 'true'` (`deliverablesGeneration.ts:46`) | **legacy redirect** `/wordy`/`/excele`/`/prezentacje` (cichy) | env build |
| `ENABLE_TERESA_RETRIEVAL` | OFF | `persona.ts:328`, `ai.routes.ts:3116` | **cicha pustka** (narzędzia READ nie rejestrowane, bez 404) | env |

### 1g. Połączenia międzymodułowe
| Kierunek | Moduł | Mechanizm | Status |
|---|---|---|---|
| WEJŚCIE ← | M01 Czat/Teresa | intent PL/EN (deck/doc/sheet), patch, auto-emisja, streaming | DZIAŁA |
| WEJŚCIE ← | M04 Notatnik | C3 „Rozwiń w dokument" | DZIAŁA |
| WEJŚCIE ← | M06 Ideas Mind Map | C5 „Omów z Teresą" (mapa→seed czatu) | DZIAŁA |
| dwukier. | M13 Inicjatywy | „Zrób z tego dokument" + panel artefaktów (`InitiativeDocumentView.tsx:654`) | DZIAŁA |
| WEJŚCIE ← | M10 Wywiad/Insighty | grounding sourceRefs/ContextPack + retrieval (flaga) | DZIAŁA (retrieval za flagą) |
| WYJŚCIE → | M17 Outputs | rejestracja artefaktów + D2 duplikuj/szablon | DZIAŁA |
| WYJŚCIE → | M03/M13 | materializacja Decyzja/Task/Inicjatywa (org-guard) | DZIAŁA |
| WYJŚCIE → | pliki | eksport 7 formatów (`UnifiedExportService`) | DZIAŁA (live) |
| WYJŚCIE → | public | `/public/artifacts/:token` viewer | DZIAŁA (utwardzony) |

## 2. Testy automatyczne (FAZA 2)
> Raport: `evidence/f2_tests_report.md` · log: `f2_tests.log`.
**Uruchomienie (lokalnie @ `327de9144f`):** **99 PASS / 0 FAIL / 0 SKIP** (7 zestawów Canvas/deliverables). **Brief „97/97" OBALONY na plus** — `docGenerationRuntime` urosło 16→25.
| Zestaw | PASS | FAIL |
|---|---|---|
| canvasEmissionHeuristic / canvasPatchOps / ideaMapToMarkdown | 8 / 13 / 9 | 0 |
| notebookExpandToDocument / duplicateArtifactToDraft | 5 / 7 | 0 |
| WorkCanvasDocumentPanel | 32 | 0 |
| docGenerationRuntime (BE) | 25 | 0 |

**`UnifiedChatPanel.test.tsx`: 14 FAIL / 15 PASS — POTWIERDZONE jako test-only dryf** (nie regresja): prod `:3030` woła `useConversationStore.getState().setConversationChatLanguage` (metoda istnieje `:576,1421`), ale mock testu (`:90-108`) jej nie ma → fix: dodać `setConversationChatLanguage: vi.fn()`.

**Pokrycie scenariuszy:**
| Scenariusz | FE | BE | E2E | CI (PR-gate) | Luka |
|---|---|---|---|---|---|
| S1 deck | ✓ | ✓ | nightly | ✗ | — |
| S2 doc | ✓ (16) | ✓ | — | ✗ | — |
| S3 sheet | ✓ | ✓ | — | ✗ | — |
| S4 patch | ✓ (13) | — | — | ✗ | — |
| S5 wersje | ✓ | ✓ | — | ✗ | — |
| S6 share/viewer/revoke | częśc. | create-token | ✗ | ✗ | **brak testu viewera+revoke** |
| S7 materializacja org-guard | ✗ | ✗ | ✗ | ✗ | **brak testu cross-org 403 (mimo zamkniętego P0)** |
| S8 eksport | ✓ | — | — | ✗ | — |

**Pułapki:** `WorkCanvasDocumentPanel` (32) mockuje globalny `fetch` → testuje kontrakt FE→API, nie realny zapis DB. Flaga: testy biegają ścieżką ON; brak testu OFF→404. **CI:** `test-suite.yml` triggeruje tylko `[main, develop]`, default branch = `Londyn` → **żaden z 99 testów Canvas nie jest w PR-gate dla PR do Londyn**; `docGenerationRuntime` (server/) poza jakimkolwiek workflow CI.

**Backlog testowy:** [P0] fix mocka UnifiedChatPanel (BT-1); [P0] test org-guard `CANVAS_CROSS_ORG_REFERENCE` cross-org 403 (BT-2); [P0] test public-artifacts viewer/revoke (BT-3); [P1] test flagi OFF→404/ON→202 (BT-4); [P1] work-canvas smoke do tier0 (BT-5); [P1] CI: testy server/ + PR-gate dla `Londyn` (BT-6, systemowe z M13/M14/M25).

## 3. Środowiska / Railway (FAZA 3)
**Status: NIEWYKONANE (PENDING).** Smoke: generations POST (z flagą ON), draft GET/PUT, version restore, export, share+public viewer, materializacja. **Kluczowe:** wartości `ENABLE_DELIVERABLES_LIGHT`/`VITE_ENABLE_DELIVERABLES_LIGHT`/`ENABLE_TERESA_RETRIEVAL` na staging/prod (decydują czy triada żyje); migracje work_canvas_drafts/versions/artifact_registry. **Uwaga DB:** dev `.env` może wskazywać Railway PROD.
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit / migracje / flagi / smoke / logi | — | — | PENDING |

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Status: NIEWYKONANE (PENDING).** 8 scenariuszy z reloadem (brief deklaruje S1-S2/S5/S6/E1 jako LIVE 06-10, ale protokół wymaga własnego dowodu). Szczególnie: S6 share→reload→viewer→revoke→410; S7 materializacja + próba cross-org (403); regenerateSlide (czy UI pokazuje regenerację per slajd mimo STUB); M-5 500 (live-repro); flaga OFF → legacy redirect (czy cichy).
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1–S8 | — | PENDING | evidence/f4_* |

## 5. Kanony i standardy (FAZA 5)
> Raport: `evidence/f56_kanon_sec.md`.
**§27: N/D (uzasadnione)** — brak tabel-list; `CanvasVersionHistory`/switcher/propozycje to ad-hoc `.map` div/button.
**Wzorzec hubowy:** panel w czacie — świadomy, nie ModuleHub.
**i18n: [P2]** — główny panel `WorkCanvasDocumentPanel.tsx` **bez `useTranslation`**; miesza hardkodowane PL („Edytuj Markdown ręcznie") i EN („Save Markdown", „Download CSV/PDF"); nie reaguje na język. Deck-szkielet: language LLM-driven per `setup.language` — teza briefu „PL-only dla EN" **NIE odtworzona** (OBALONA).
**Kolory: [P3]** — ~61 surowych utili palety Tailwind zamiast tokenów.
**Stany / cicha degradacja: [P3]** — legacy redirect przy fladze OFF bez komunikatu.
**CARD_CONTENT_FORMULA: N/D** potwierdzone.

## 6. Bezpieczeństwo i dostęp (FAZA 6)
> Raport: `evidence/f56_kanon_sec.md`. **Teza briefu o naprawie org-scope POTWIERDZONA niezależnie (2 agentów + osobiście).**
| Warstwa | Stan | Dowód |
|---|---|---|
| Org-scope (wszystkie by-id) | szczelny | `ownedDraft` `work-canvas.routes.ts:2068` (`WHERE id=? AND organization_id=?`), 26 handlerów |
| Guard cross-org materializacja | realny, obie ścieżki | `assertOrgScopedReferences` `canvasMaterialize.ts:87-114` (save `:4017` + accept `:3611`) |
| Public viewer | utwardzony | token 32-hex, rate-limit 30/min/IP, 404/410, sanitized, revoke unieważnia |
| Capabilities serwerowo | częściowe | tylko `canvas.share` egzekwowany (`:3915,:3943`) |

**Findingi (0× P0, 0× P1 — pierwszy obok M25):**
- **[P2] SEC-M02-1: 8/9 capabilities `canvas.*` martwe serwerowo** — `canvas.convert.*`, `canvas.output.*` nie egzekwowane; `POST /drafts`, `/save-to-workspace`, `/create-output` gate'ują tylko `ownedDraft`. Capability istnieje w modelu, ale nie sprawdzana.
- **[P2] SEC-M02-2: GUEST może tworzyć/edytować/materializować Canvas** — sprzeczne z briefem „GUEST=brak"; luka kompletności RBAC, **nie IDOR** (wszystko org-scoped).
- **[P3] SEC-M02-3:** accept propozycji używa legacy `canUseWorkCanvasCapability` zamiast SSOT `effectiveAccessService`.
- **[P3] SEC-M02-4:** `/shared/:token` bez shape-walidacji przed LIKE.

**Org NIE spoofowalny; sekrety/PII w logach: czysto. P0-1 (utrata danych) i P0-2 (admin-only) zamknięte — model USER istnieje (z zastrzeżeniem niepełnej egzekucji GUEST).**

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0/P1)
1. **Faza 4 żywa (8 scenariuszy)** — to jedyny realny sufit oceny; szczególnie S6 share/revoke i S7 cross-org 403 — Weryfikacja: screenshoty PASS + reload-trwałość.
2. **Testy regresji bezpieczeństwa** — BT-2 (cross-org materialize 403) + BT-3 (public viewer/revoke) — Weryfikacja: zielone, dodane do PR-gate.
3. **Fix mocka `UnifiedChatPanel`** (BT-1) — Weryfikacja: 14 FAIL → 0.

### Fala 2 — Domknięcie wartości (P1/P2)
1. **`regenerateSlide` realny** lub ukryć akcję „regeneruj slajd" (obecnie zwraca ten sam slajd) — Weryfikacja: regeneracja zmienia treść.
2. **Egzekucja capabilities `canvas.*` serwerowo** (8/9 martwych) + decyzja o GUEST — Weryfikacja: GUEST/brak-capability → 403 na convert/output.
3. **Picker sourceRefs w UI** (generator już używa) — Weryfikacja: ref wybrany w UI ląduje w „## Źródła".
4. **`POST /:id/generate` bez default-deck** (wymuś `format`) — Weryfikacja: brak formatu → 400, nie cichy deck.
5. **M-5 500** — live-repro + fix lub usunięcie etykiety — Weryfikacja: brak 500.

### Fala 3 — Jakość i kanony (P2/P3)
1. **i18n głównego panelu** — `useTranslation` w `WorkCanvasDocumentPanel`, koniec hardkodów PL/EN — Weryfikacja: panel reaguje na język.
2. **Konsolidacja `ArtifactsPanel/Viewer/Editor` ↔ `WorkCanvasDocumentPanel`** (dwa równoległe systemy) — Weryfikacja: jeden silnik artefaktów.
3. **Wytnij `commitProposalToDomain`** (martwy duplikat) — Weryfikacja: 0 referencji.
4. **~61 surowych utili palety → tokeny** + komunikat przy legacy redirect — Weryfikacja: lint koloru czysty.
5. **CI** — testy server/ + PR-gate dla `Londyn` (systemowe) — Weryfikacja: 99 testów biegnie na PR.

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych (zwł. S6/S7) zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: flagi triady ustawione i udokumentowane, smoke 200, czyste logi
- [ ] 4. Kanony: i18n panelu, tokeny kolorów
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE (regenerateSlide, M-5)
- [ ] 6. Capabilities `canvas.*` egzekwowane serwerowo / decyzja GUEST

---
**Pozostałe do domknięcia audytu M02:** Faza 3 (Railway — flagi triady) + Faza 4 (żywe 8 scenariuszy). BRAK blockera bezpieczeństwa (0 P0/P1) — moduł najsilniejszy w audycie; po Fazach 3/4 realnie Beta. Inwentarz/brief w kilku punktach STALE (4/6 czerwonych flag obalonych) — zaktualizować INV_A po tym audycie.
