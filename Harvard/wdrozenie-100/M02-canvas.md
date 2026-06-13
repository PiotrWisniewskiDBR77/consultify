# WP M02 — Canvas · dokończenie do 100%

**Pula:** beta · **Karta:** `Harvard/modules/M02-canvas/KARTA_AUDYTU.md` (ocena 59/100) · **Rozmiar:** M (1–3 dni) · **Żywy bloker:** brak P0/P1
**Faza programu:** FAZA 3 (szlif beta) — korzysta z kręgosłupa FAZA 0 (deliverables idą przez czat→canvas) · **Master:** `Harvard/wdrozenie-100/MASTER.md`

## 1. Stan obecny (jednym akapitem)
Najsilniejszy moduł audytu i jeden z dwóch (obok M25) **bez cross-org IDOR** — każdy endpoint `work-canvas.routes.ts` z `:draftId` przechodzi przez centralny loader `ownedDraft` (`:2068` `WHERE id=? AND organization_id=?`), a materializacja do encji jest blokowana przez realny `assertOrgScopedReferences` (`canvasMaterialize.ts:87-114`, na obu ścieżkach save+accept). Triada generacji deck/doc/sheet (za flagą `ENABLE_DELIVERABLES_LIGHT`) live-proven 06-10; cykl życia artefaktu (wersje/switcher/chip/patch/auto-emisja) wdrożony; mosty międzymodułowe (Notatki, Ideas, Inicjatywy, Insighty, Outputs, Decyzje/Tasks, eksport, public share) zbudowane. Sufit 59/100 to wyłącznie niewykonane Fazy 3+4 (D=0, G=0) plus 3 realne resztki: `regenerateSlide` STUB, brak pickera sourceRefs, dwa równoległe silniki artefaktów (`ArtifactsPanel` vs `WorkCanvasDocumentPanel`).

## 2. Luki do DoD

### (a) FRONTEND / UX (FAZA 3)
- **[P2] `regenerateSlide` STUB** — `presentationGeneratorService.ts:1656-1672` zwraca `slides[idx]` bez LLM (UI pokazuje akcję „regeneruj slajd", ale treść się nie zmienia). Fix: realny call narrative-engine LLM lub ukrycie akcji. (Karta §8 Fala 2.1 — UWAGA: re-audit Fala 5 deklaruje „naprawiony commit `36a6f240ff`” — zweryfikować runtime przed pracą.)
- **[P2] Brak pickera sourceRefs** — generator UŻYWA refów (`docGenerationRuntime.ts:115-187`), ale UI wysyła je tylko z `workspaceContext`; deck pomija. Fix: picker w UI → ref ląduje w „## Źródła”.
- **[P2] i18n głównego panelu** — `WorkCanvasDocumentPanel.tsx` **bez `useTranslation`**, miesza hardkody PL („Edytuj Markdown ręcznie”) i EN („Save Markdown”, „Download CSV/PDF”); nie reaguje na język. Sweep FAZA 4, ale panel-rdzeń domknąć tu.
- **[P3] cicha degradacja przy fladze OFF** — `VITE_ENABLE_DELIVERABLES_LIGHT` OFF → legacy redirect (`/wordy`/`/excele`/`/prezentacje`) bez komunikatu. Fix: baner/toast.

### (b) BACKEND / API (FAZA 3)
- **[P2] SEC-M02-1: 8/9 capabilities `canvas.*` martwe serwerowo** — tylko `canvas.share` egzekwowany (`:3915,:3943`); `canvas.convert.*`/`canvas.output.*` nie sprawdzane (gate'ują tylko `ownedDraft`). Fix: egzekucja serwerowa lub świadoma decyzja.
- **[P2] SEC-M02-2: GUEST może tworzyć/edytować/materializować** — luka kompletności RBAC (NIE IDOR, wszystko org-scoped); decyzja o GUEST.
- **[P3] `POST /:id/generate` default 'deck'** — `deliverablesGenerations.routes.ts:198`; brak formatu → cichy deck. Fix: wymusić `format` (400 zamiast default).
- **[P3] SEC-M02-3/4** — accept propozycji używa legacy `canUseWorkCanvasCapability` zamiast SSOT `effectiveAccessService`; `/shared/:token` bez shape-walidacji przed LIKE.

### (c) INTEGRACJA / TESTY E2E (FAZA 3 + 4)
- **[INTEGRACJA] dwa równoległe silniki artefaktów** — `ArtifactsPanel/ArtifactViewer/ArtifactEditor` (starszy, `SplitLayout.tsx:21,403`, `useArtifactsStore`) vs `WorkCanvasDocumentPanel`. Kandydat do konsolidacji (kręgosłup #1 Tryb C). Decyzja przed szlifem.
- **[MARTWY] `commitProposalToDomain`** (`workCanvasService.ts`) — duplikat materializera; żywa ścieżka idzie przez `createWorkspaceResource`→`materializeWorkspaceTarget`. Wytnij.
- **[P0 testowy] fix mocka `UnifiedChatPanel.test.tsx`** — 14 FAIL test-only dryf (mock `:90-108` brak `setConversationChatLanguage: vi.fn()`); prod woła `:3030`. Fix mocka.
- **[P0 testowy] brak testów S6/S7** — S6 (public viewer/revoke) i S7 (cross-org materialize 403) bez regresji mimo zamkniętego P0. Dodać.
- **[P3] M-5 endpoint 500** — NIEZWERYFIKOWANE (etykieta bez route'a); live-repro w FAZA 4 lub usunąć etykietę.
- CI: `test-suite.yml` tylko `[main,develop]`; default `Londyn` → 99 testów Canvas + server/ poza PR-gate (sweep FAZA 4).

## 3. Kroki realizacji
1. **(FAZA 3)** `regenerateSlide` realny (lub ukryć akcję) — re-weryfikacja runtime po `36a6f240ff`; picker sourceRefs w UI; `POST /:id/generate` bez default-deck.
2. **(FAZA 3)** Egzekucja capabilities `canvas.*` serwerowo (8/9) + decyzja GUEST; SEC-M02-3/4 (SSOT effectiveAccess, shape-walidacja share token).
3. **(FAZA 3)** i18n panelu `WorkCanvasDocumentPanel` (`useTranslation`, koniec hardkodów PL/EN); baner przy legacy redirect; ~61 surowych utili palety → tokeny.
4. **(decyzja/Tryb C)** Konsolidacja `ArtifactsPanel/Viewer/Editor` ↔ `WorkCanvasDocumentPanel` (jeden silnik); wytnij `commitProposalToDomain`.
5. **(testy)** Fix mocka UnifiedChatPanel (14→0); BT-2 cross-org materialize 403; BT-3 public viewer/revoke; BT-4 flaga OFF→404/ON→202.
6. **(FAZA 4)** Żywa weryfikacja 8 scenariuszy z reloadem (S6 share→revoke→410; S7 cross-org 403; regenerateSlide; flaga OFF redirect; M-5 live-repro). **(FAZA 3-Railway)** flagi triady na staging + smoke.

## 4. DoD (6 kryteriów — bramka 6/6)
1. **Front↔back:** triada deck/doc/sheet generuje na realnych danych; `regenerateSlide` realnie regeneruje (lub ukryty); zero martwych przycisków; draft+wersje trwałe po reload.
2. **Bezpieczeństwo:** zero cross-org (już szczelne) — z testem regresji S7; capabilities `canvas.*` egzekwowane serwerowo lub świadoma decyzja GUEST.
3. **i18n:** `WorkCanvasDocumentPanel` przez `t()`, koniec hardkodów PL/EN.
4. **Tokeny:** ~61 surowych utili palety → tokeny Visual Standard.
5. **§27:** N/D (brak tabel-list) — wersje/switcher ad-hoc dopuszczone.
6. **E2E w PR-gate:** S6 (viewer/revoke) + S7 (cross-org 403) + fix mocka UnifiedChatPanel zielone na `Londyn`.

## 5. Weryfikacja
- Triada: intent z czatu → deck/doc/sheet w panelu; reload → trwałe.
- `regenerateSlide`: regeneracja zmienia treść slajdu (nie zwraca tego samego).
- S6: share → reload → public viewer `/public/artifacts/:token` → revoke → 410.
- S7: próba materializacji na cudzą org → 403 (test + screenshot).
- Flaga OFF → legacy redirect z komunikatem (nie cicha pustka).
- Uwaga DB: dev `.env` może wskazywać Railway PROD; wartości `ENABLE_DELIVERABLES_LIGHT`/`VITE_*`/`ENABLE_TERESA_RETRIEVAL` decydują czy triada żyje.

## 6. Zależności
- **Kręgosłup FAZA 0** (Tryb A function-calling + Tryb C konsolidacja artefaktów) odblokowuje pełne sterowanie czat→canvas — konsolidacja dwóch silników artefaktów to część Trybu C.
- Mosty wyjścia (Outputs, materializacja Decyzja/Task/Inicjatywa) dotykają M17/M03/M13 — bez zmiany kontraktu.
- CI PR-gate dla `Londyn` (BT-6) — systemowe, wspólne z M13/M14/M25 (FAZA 4).
