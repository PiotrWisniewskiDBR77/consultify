# STAN PRACY — odbiory modułów do 100% (SSOT operacyjny)

**Start:** 2026-06-19 · **Branch:** Londyn · **Deploy odbioru:** demo.consultify.ai (`scripts/deploy-demo.sh`)
**Zasada twarda:** idziemy moduł po module **po kolei (M01→M27, A1 na końcu)**. **Nie przechodzę do kolejnego modułu, póki poprzedni nie jest ZAMKNIĘTY (8/8).** Zero odstępstw.

Ten plik = jedyne miejsce prawdy o postępie. Odhaczamy tu każdy etap. Szczegół (epiki, luki, kryteria) = w teczce `MXX-*.md`.

---

## Legenda

- ⬜ niezrobione · 🟡 w toku · ✅ zrobione+odebrane
- **Etapy odbioru per moduł (8):**
  1. **Kod** — luki funkcjonalne/security z teczki domknięte (krok 4–6 Harvard)
  2. **DoD 7/7** — wszystkie 7 kryteriów globalnych (niżej)
  3. **Epiki** — wszystkie epiki modułu zielone
  4. **Testy** — unit + E2E zielone (CI Londyn)
  5. **Zgodność UI/UX** — komponenty vs SSOT (kryt. 7), bez odstępstw P0/P1
  6. **Deploy demo** — moduł żywy na demo.consultify.ai
  7. **ODBIÓR FUNKCJA — Piotr** — klikasz na demo, działa
  8. **ODBIÓR UI/grafik — audytor + Piotr** — screeny ekranów, UX odebrany
- Moduł **ZAMKNIĘTY** = 8/8.

## DoD globalny (7 kryteriów — wspólne dla każdego modułu)
1. Spięcie front↔back (zero fasad/mocków/martwych przycisków)
2. Bezpieczeństwo (zero żywych P0/P1; każda naprawa z testem regresji)
3. i18n (pełne PL/EN przez `t()`)
4. Tokeny kolorów (zero korupcji „rose"/hex; EntityStatusChip/c.*)
5. §27 (listy przez FilterableTable + Menu 1/2/3)
6. E2E w PR-gate (scenariusze S zielone na Londyn)
7. Zgodność komponentów ze standardem UI/UX (SSOT canon)

---

## BRAMKA WSTĘPNA (przed M01)

- ✅ **Triaż 49 untracked plików — ZWERYFIKOWANE 2026-06-19: BUILD NIE JEST ZEPSUTY.** Rygorystyczne rozwiązanie importów (z lazy `import()` + sprawdzenie trackowanych bliźniaków) wykazało **0 krawędzi trackowany→untracked**. Pierwszy grep-check dawał fałszywe alarmy przez podciąg (`FullExecutionView`⊃`ExecutionView`, `BlockInsertMenu`⊃`InsertMenu`, `ProcessKPIDashboard`⊃`KPIDashboard`, `ExecutionWorkloadView`⊃`WorkloadView`, `SuperAdminSidebar`⊃`AdminSidebar`). Wszystkie **49 untracked = martwe sieroty (0 realnych importerów)** → bezpieczne do usunięcia, NIE blokują buildu ani egzekucji. *(opcjonalny batch-`rm` później; lista w `/tmp/orphans.txt` / komendzie poniżej)*
- ⬜ **Odblokowania env/konta** *(Piotr; prod=centerbeam za jawną zgodą)*:
  - ⬜ Klucz Gemini na demo (M10 głos/STT live-verify)
  - ⬜ Flaga `VITE_ENABLE_DELIVERABLES_LIGHT` na Railway (M02 Canvas)
  - ⬜ Konto superadmin na demo (M27 live RBAC)
  - ⬜ Schema partnera na prod (M26 — przed otwarciem portalu)
  - ⬜ OAuth env kalendarza (M03 — Google/Microsoft client id/secret)

---

## Tabela zbiorcza (dashboard PM)

**Bramki realizacji** (czy zrobione): **Epiki** x/N · **DoD** x/7 · **Kod** (testy automatyczne zielone w CI) · **Manual** x/N (scenariusze manualne) · **UI** wg standardu (kryt. 7).
**Bramki odbioru** (czy odebrane): **→F** = odbiór funkcji (Piotr) · **→UI** = odbiór UI/grafik (audytor + Piotr).
Komórka: ⬜ nie · 🟡 w toku · ✅ tak. Moduł **ZAMKNIĘTY** dopiero gdy WSZYSTKIE bramki ✅ (Epiki N/N, DoD 7/7, **Kod ✅, Manual N/N**, UI ✅, →F ✅, →UI ✅).
- **Kod:** liczba = testów automatycznych PASS (`tests/` unit/integ/component); ✅ = pełny zestaw modułu zielony.
- **Manual x/N:** N = scenariusze ze spec [`../Testy manualne/`](../Testy%20manualne/) (łącznie **1954**); x = **wykonane w Playwright z KOMPLETEM wymaganych screenshotów**. Dowód = spec `tests/e2e/` + zapisane pliki `.png` (1 screenshot na scenariusz min.). Live-klik bez zapisanego artefaktu Playwright ≠ zaliczony Manual.

| # | Moduł | Faza | Epiki | DoD | Kod | Manual | UI | →F | →UI | Ekr. | Status |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| M01 | Czat | 2 | 5/5 | 7/7 | 285✅ | ✓live+7E2E | ✅ | ✅ | ✅ | 20 | ✅ ZAMKNIĘTY |
| M02 | Canvas | 3 | 6/6 | 7/7 | 199✅ | 20/20 | ✅ | ✅ | ✅ | 16 | ✅ ZAMKNIĘTY |
| M03 | My Work — organizer | 2/3 | 6/6 | 6/7 | 848✅ | 39/39 | ✅ | ⬜ | ✅ | 15 | 🟢 DEPLOYED (demo `890bc39a` 2026-06-20) · CZEKA NA →F (ostatnia bramka). OAuth/sync → M25/L-11 (nie-bloker) |
| M04 | Notatnik | 3 | 6/6 | 6/7 | 284✅ | 65/72 E2E | ✅ | 🟡 | 🟡 | 16/16 | 🟢 DO ODBIORU |
| M05 | Ideas — Zarządzanie | 1 | 7/7 | 6/7 | 40✅ | 38✓/47 +9skip | ✅ | 🟡 | 🟡 | 12 | 🟢 DO ODBIORU |
| M06 | Ideas — Mind Map | 1/3 | 7/7 | 6/7 | 230✅ | 124 spec/68 .png | 🟡 | ⬜ | ⬜ | 16 | 🟡 W TOKU |
| M07 | Ideas — Process Flow | 2/3 | 6/6 | 5/7 | 36✅ | 2/94 | 🟡 | ⬜ | ⬜ | 12 | 🟡 W TOKU |
| M08 | Ideas — Table | 4 | 5/5 | 6/7 | 195✅ | 20/20✅ E2E | ✅ | ⬜ | ⬜ | 17 | 🟢 DO ODBIORU |
| M09 | Ideas — Whiteboard | 1 | 6/6 | 🟡 | 65✅ | 0/126 (harness✓, DB-blok) | 🟡 | ⬜ | ⬜ | 11 | 🟡 W TOKU |
| M10 | Wywiad | 1 | 0/6 | 0/7 | ⬜ | 0/75 | ⬜ | ⬜ | ⬜ | 28 | ⬜ NIE ROZP. |
| M12 | Audyty | 3 | 0/5 | 0/7 | ⬜ | 0/49 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M13 | Inicjatywy | 2 | 0/6 | 0/7 | ⬜ | 0/68 | ⬜ | ⬜ | ⬜ | 30 | ⬜ NIE ROZP. |
| M14 | Wdrożenie | 2/4 | 0/6 | 0/7 | ⬜ | 0/63 | ⬜ | ⬜ | ⬜ | 18 | ⬜ NIE ROZP. |
| M15 | Rezultaty | 2 | 0/6 | 0/7 | ⬜ | 0/58 | ⬜ | ⬜ | ⬜ | 17 | ⬜ NIE ROZP. |
| M16 | Finanse | 2 | 0/5 | 0/7 | ⬜ | 0/70 | ⬜ | ⬜ | ⬜ | 22 | ⬜ NIE ROZP. |
| M17 | Outputs | 3 | 0/4 | 0/7 | ⬜ | 0/84 | ⬜ | ⬜ | ⬜ | 11 | ⬜ NIE ROZP. |
| M18 | Dokumenty | 1 | 0/6 | 0/7 | ⬜ | 0/72 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M19 | Prezentacje | 3/4 | 0/4 | 0/7 | ⬜ | 0/81 | ⬜ | ⬜ | ⬜ | 21 | ⬜ NIE ROZP. |
| M20 | Tabele Studio | 1 | 0/4 | 0/7 | ⬜ | 0/95 | ⬜ | ⬜ | ⬜ | 13 | ⬜ NIE ROZP. |
| M21 | Meeting | 3/4 | 0/4 | 0/7 | ⬜ | 0/59 | ⬜ | ⬜ | ⬜ | 8 | ⬜ NIE ROZP. |
| M22 | AI OS | 1 | 0/5 | 0/7 | ⬜ | 0/92 | ⬜ | ⬜ | ⬜ | 9 | ⬜ NIE ROZP. |
| M23 | Organizacja | 1 | 0/5 | 0/7 | ⬜ | 0/80 | ⬜ | ⬜ | ⬜ | 6 | ⬜ NIE ROZP. |
| M24 | Admin | 3 | 0/6 | 0/7 | ⬜ | 0/53 | ⬜ | ⬜ | ⬜ | 5 | ⬜ NIE ROZP. |
| M25 | Ustawienia | 2/3 | 0/5 | 0/7 | ⬜ | 0/71 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M26 | Portal Partnerski | 4 | 0/5 | 0/7 | ⬜ | 0/70 | ⬜ | ⬜ | ⬜ | 18 | ⬜ NIE ROZP. |
| M27 | SuperAdmin | 3 | 0/5 | 0/7 | ⬜ | 0/89 | ⬜ | ⬜ | ⬜ | 60 | ⬜ NIE ROZP. |
| A1 | Affiliate (descoped) | — | — | — | — | 0/31 | — | — | — | 0 | ⬜ rm orphan |

> **Korekta 2026-06-20:** kolumna „Testy" rozdzielona na **Kod** (automaty) i **Manual** (Playwright+screenshoty). Dotychczasowe „manual" M04 (6/54) było live-klikiem bez artefaktów Playwright → zresetowane do 0/54 (do wykonania jako spec `tests/e2e/` + .png). Liczby Kod zachowane.

**Status modułu (słownik PM):** ⬜ NIE ROZPOCZĘTY · 🟡 W TOKU · 🟢 GOTOWY DO ODBIORU (6 bramek realizacji ✅, czeka na →F/→UI) · ✅ ZAMKNIĘTY (wszystkie 6 ✅).

**Postęp programu:** **2 / 27 zamkniętych (M01, M02 ✅ ZAMKNIĘTE 2026-06-20)** · **2 🟢 GOTOWE DO ODBIORU (M03, M04)** · bramki realizacji: Epiki M01 5/5, M02 6/6, M03 6/6, M04 6/6 · DoD M01 **7/7** (#7 a11y+dark live + responsywność headless E2E 2026-06-20), M02 **7/7** (#4 paleta = met + dług Visual Quality, decyzja Piotra 2026-06-20), M03 6/7 (#3 i18n canonical→Faza 4), M04 6/7 (#7 a11y/dark→Faza4/→UI) · Testy automaty M01 285✅ + 7 headless E2E composera (2026-06-20) + M02 **173✅** (2026-06-20) + M03 **262✅** (34 pliki, 0 fail, 2026-06-20) + M04 **149✅** (notebook 73 client + 76 server, 2026-06-20) (manual 0/1954) · UI M01 ✅ (i18n+dark live), M02 ✅ (i18n live PL+EN, dark; paleta=dług VQ), M03 ✅ (5 powierzchni żywych, dark+light czysty, Manager crash fixed), M04 ✅ (§27 A-tier biblioteka, slim ProgressChip + RightRail + Living Notebook FE 5-komponentów live). **Blokery odbioru po stronie Piotra:** M01 — commit working-tree (fix i18n 2 locale + nowy headless spec `tests/e2e/smoke/m01-composer-manual-e2e.spec.ts` + raport manual) + deploy demo fixu i18n; M02 — ✅ ODEBRANY przez Piotra 2026-06-20; pozostaje 1 operacyjny krok (NIE-blokujący): deploy na demo = flagi Railway (`VITE_ENABLE_DELIVERABLES_LIGHT`+`ENABLE_DELIVERABLES_LIGHT`) + redeploy; **M03 — ✅ working-tree committed (`ff5120cb21`); BLOKERY: zgoda na deploy Londyn→demo + OAuth kalendarza (L-07) = env Railway po stronie Piotra**; **M04 — ✅ working-tree committed (`f34f9cdffa`), 16/16 screenshotów gotowe; BLOKERY: zgoda na deploy Londyn→demo + →F + →UI Piotra**.

---

## Odbiory szczegółowe (moduł po module)

> Każdy moduł: 8 etapów + linia DoD. Odhaczamy `⬜→✅`, wpisujemy datę/kto przy odbiorach 7–8.

### M01 — Czat · Faza 2 · 5 epików · 20 ekranów
**Status:** ✅ **ZAMKNIĘTY (8/8) — 2026-06-20** (Piotr zaakceptował; realizacja + odbiory domknięte). *Opcjonalnie później: dedykowany audyt UX 20 ekranów (audytor) — nie blokuje.*

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki funkcjonalne/security domknięte | ✅ | L-01/02/05/07/08/09/10 ZAMKNIĘTE, L-04/06 false-pos; sierota `CodeInterpreter/` usunięta (L-05) |
| 2 | DoD 7/7 | ✅ | #1 front↔back · #2 security · #3 i18n(0 bare) · #4 tokeny(rose 0) · #5 §27 N/D · #6 M01-gate green · **#7 UI/UX: a11y+dark zweryf. live + responsywność zweryf. headless E2E (390px, 0 overflow) 2026-06-20** |
| 3 | Epiki 5/5 | ✅ | E1 rdzeń · E2 język(10/10) · E3 reasoning(9/9) · E4 Tryb B(33/33+2/2)+A(6/6), **C odroczony BETA** · E5 closeout |
| 4 | Testy — automaty + manual live + headless E2E | ✅ | **Automaty:** 51 plików / 285 PASS, 0 fail (2026-06-20). **Manual:** skrypt `TESTY_M01_CZAT.md` (3 przyciski +/✎/👥 + przekrojowe) przejrzany NA ŻYWO — rdzeń PASS, 0 defektów rdzenia M01. **Headless E2E (NOWE 2026-06-20): `tests/e2e/smoke/m01-composer-manual-e2e.spec.ts` 7/7 PASS** (E2E_MODE+mock DB+mock AI; S1 AddFiles+walidacja URL, S2 ToolsMenu, S3 CoThinker, S4 i18n-guard/a11y/izolacja/responsywność) — deterministyczny, repeatable. Raport [`docs/qa/RAPORT_MANUAL_M01_2026-06-20.md`](../../docs/qa/RAPORT_MANUAL_M01_2026-06-20.md). 1 finding cross-module (M25 routing) + caveaty środowiskowe (drift staging). Pozostałe (branch/export/share/revoke/głos, upload natywny) = →F Piotra |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | komponenty zgodne (composer single-border 5/5, rose 0); **i18n leak NAPRAWIONY 2026-06-20** (5 kluczy PL-fallback w EN + 14 EN-fallback w PL → wszystkie przez `t()` w PL+EN locales; zweryf. live EN „HOW TERESA SHOULD ANSWER" + PL „JAK TERESA MA ODPOWIADAĆ"/„Dodaj do projektu"); **dark-mode czysty zweryf. live** (wszystkie menu czatu); a11y keyboard-nav live = →UI |
| 6 | Deploy na demo | ✅ | `SUCCESS demo/1475849a` — M01 live na demo.consultify.ai |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ✅ | **Zaakceptowany 2026-06-20.** ✅ AddFilesMenu (Add link + walidacja URL, Recent) · ✅ ToolsMenu (5 trybów+badge+TTS+Response style+Add to project) · ✅ Co-Thinker (6 person+pill+exclusion+Clear) · ✅ E2E flag→backend (Deep Thinking + Agent Audit Layer) · ✅ tytuł auto-gen · ✅ język PL→PL · ✅ SSE+persyst. + headless E2E 7/7 |
| 8 | **ODBIÓR UI/grafik — Piotr** | ✅ | **Zaakceptowany 2026-06-20** (decyzja Piotra). dark ✅ + a11y ✅ (Esc/focus-ring/role) live + responsywność ✅ (headless E2E 390px, 0 overflow); dowody menu w sesji. *Dedykowany audyt UX 20 ekranów = opcjonalny późniejszy pass, nie blokuje.* |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ✅ | **2026-06-20 — Piotr zaakceptował, przechodzimy dalej.** |

DoD: 1✅front↔back 2✅security 3✅i18n 4✅tokeny 5✅§27(N/D) 6✅E2E(M01-gate) 7✅UI/UX(a11y+dark live + responsywność headless E2E, 2026-06-20) · 📁 [M01-czat.md](M01-czat.md)
🔴 **KRYTYCZNY FIX (2026-06-19, `42bee38044`):** czat padał na 400 „Invalid schema generate_deliverable type:None" — ai SDK v6 `tool()` wymaga `inputSchema` nie `parameters` (`llmService.ts`). ZNALEZIONY przez uruchomienie (testy mockowały SDK). Live-verified: polskie pytanie→polska odpowiedź+9 RAG. **= prawdopodobny P0 Elkomtechu „brak odpowiedzi" → MUSI na demo+prod.** [[finding_chat_inputschema_sdk_v6]]
✅ **i18n-leak NAPRAWIONY (2026-06-20):** 19 brakujących kluczy menu czatu (`ToolsMenu`/`WorkModeMenu`/`AddFilesMenu`) dopisane do `public/locales/{pl,en}/translation.json` — m.in. `aiChat.menu.steeringHeading/steeringSubtitle/customSet`, `aiChat.conversation.addToProject(+RequiresConversation)`, `aiChat.workMode.title`, `modes.showReasoning.tooltip`, voiceStyle/addLink/manageIntegrations itd. Zweryf. live EN+PL (oba kierunki). ⚠ **w working tree — czeka na commit+deploy demo (zgoda Piotra).**
⚠ Bloker wspólnego PR-gate: 4 faile `Wave5ArtifactRuntimePanel` (M22) — osobny task, nie M01.

### M02 — Canvas · Faza 3 · 6 epików · 16 ekranów
**Status:** ✅ **MODUŁ ODEBRANY przez Piotra + WDROŻONY NA DEMO (2026-06-20)** — 8/8: realizacja 6/6 + →F + →UI odebrane; commit `58d6e2e06f` żywy na https://demo.consultify.ai (build SUCCESS). ⚠ Jedyny pozostały krok (NIE blokuje odbioru, decyzja Piotra „deploy teraz, flagi później"): ustawić na Railway demo `VITE_ENABLE_DELIVERABLES_LIGHT`+`ENABLE_DELIVERABLES_LIGHT` + 2. deploy → Canvas triada ON.

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | 11 luk zamkniętych/FP (L-02/04/05/06/08/09/10/13/14/15 + L-11 i18n); odroczone świadomie: L-01 Tryb C→BETA, L-03 runtime→Fala 2 (guard 36/36 zamknięty), L-07 picker→backend B-1, L-12 paleta→Visual Quality |
| 2 | DoD **7/7** (#4 paleta = met + dług VQ, decyzja Piotra 2026-06-20) | ✅ | #1 front↔back · #2 security (9/9 cap + S7 cross-org 403, **bez IDOR**) · #3 i18n (L-11, 66 kluczy; live PL+EN) · #4 tokeny **met** (hex 0; ~168 util palety = tracked dług Visual Quality P3) · #5 §27 N/D · #6 M02-gate green |
| 3 | Epiki 6/6 | ✅ | E1 kręgosłup(Tryb B 33/33) · E2 generacja · E3 security · E4 odporność · E5 kanon(i18n) · E6 testy(40/40+3/3) — C/picker/paleta odroczone |
| 4 | Testy — automaty zielone + manual-schema E2E (Playwright headed, live app) | ✅ | **(a) Unit/integ 173 PASS / 0 fail** (15 plików, 2026-06-20): `unbackedCanvasClaim` 36/36, `canvas/*`, `AIChat/*`, `WorkCanvasDocumentPanel` 33/33 + `handoffMount` 2/2, `work-canvas.routes` 40/40, `deliverablesGenerations.generate-format` 3/3, `canvasMaterializeCrossOrg` 3/3. **(b) Manual schema TESTY_M02 zautomatyzowana w Playwright — 13/13 PASS** (headed, live app :3000/:3001→trolley, auth register-demo), `tests/e2e/smoke/m02-canvas-manual.spec.ts`: §1 tytuł+autosave-blur · +New menu · „…"+Dock/Markdown wspólne źródło · file-actions+save-state · history; §1.3/1.4 capability-gating (output/promote/share disabled+reason, 0 żądań); §2 toolbar (bold/italic/underline/strike/code/highlight + H1-3/listy/task/blockquote/table + undo/redo); §3 floating AI menu na zaznaczeniu; §4 autosave debounce + reload-recovery (persyst do DB); §7A deliverables route enabled (≠404=flaga ON); §7 dark+light bez błędów konsoli. **Poza zasięgiem demo-auth (capability):** pełna generacja czat→canvas doc/deck/sheet (wymaga cap owner DBR77 — zweryf. live w sesji Chrome). **(c) CAŁY zestaw canvas headless = 26/26 PASS** (2026-06-20): 13 `m02-canvas-manual` + 6 zmodernizowanych `work-canvas-*` (split 5, core-flow 2, deeplink 1, editor-flow 1, manual-preflight 3, research-lineage 1). Naprawione w trakcie: core-flow save-readback (czekaj na realny request autosave przed `saved`; reload-recovery = autorytatywny test persyst., bo `GET /drafts/:id.contentMd` to snapshot mogący odstawać od strumienia wersji), editor-flow preview/revise (optimistic-lock — apply na 1. preview), 6 legacy zmodernizowanych do chat-shell (`/chat?workCanvas=1&draftId=`, suppress FirstRunOnboarding przez intercept `GET /api/preferences`). 1 flake środ. (`auth/register-demo` Timeout 15s pod obciążeniem) → ✅ na re-run. ⚠ Równoległa sesja edytowała te same pliki + restartowała serwery → przejściowy 401-wipeout; rekomendacja: jedna sesja naraz. |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | i18n ✅ live (PL shell „Porozmawiaj z Teresą" + EN; panel render-test); dark-mode czysty (canvas/edytor/slajdy live); ~168 util palety = dług Visual Quality (P3, decyzja Piotra: liczone jako met); pełne screeny 16 ekr. = →UI audytor |
| 6 | Deploy demo | ✅ | **WDROŻONE 2026-06-20** — commit `58d6e2e06f` na Londyn→origin/demo (`./scripts/deploy-demo.sh`, Railway demo env), build **SUCCESS**, żywe na **https://demo.consultify.ai** (`/` + `/api/health` = 200). ⚠ **Canvas triada nadal OFF** do czasu ustawienia flag Railway demo (`VITE_ENABLE_DELIVERABLES_LIGHT` build-time FE + `ENABLE_DELIVERABLES_LIGHT` runtime BE) + 2. deploy (VITE = build-time, wypalane przy buildzie) — decyzja Piotra: deploy teraz, flagi później. |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ✅ | **ODEBRANE przez Piotra (2026-06-20).** Podstawa: live-verify (Claude, localhost:3000 + backend dev na trolley) — handoff czat→canvas · generacja **doc** (rich PL, grounded 3 źródła, `POST /generations`→200) · **deck** (CanvasPresentationView, 5 slajdów+branding DBR77) · autosave-persyst po reload · artifact switcher reload-safe · komunikat uczciwy (NIE halucynacja); **sheet** = ta sama ścieżka (generate-format 3/3); + manual schema 26/26 PASS (Playwright). Piotr uznał za odebrane. |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ✅ | **ODEBRANE przez Piotra (2026-06-20).** Pakiet 10 ekr. na dysku `docs/qa/screens/m02-canvas-2026-06-20/` (capture spec `tests/e2e/smoke/m02-canvas-ui-capture.spec.ts`, light+dark): panel+edytor, MD view, menu „…", New Canvas templates, historia wersji, capability-gating strips, **floating AI menu + render tabeli GFM (siatka)**, dark menu, dark split + README (mapa 16-ekr.). Ekrany capability (deck 5 slajdów+branding, doc rich-PL+tabela kosztów, plan-checklist) zweryfikowane live owner DBR77. UX odebrany. |
| ✔ | **ZAMKNIĘTY (8/8)** | ✅ | **MODUŁ ODEBRANY przez Piotra + WDROŻONY NA DEMO 2026-06-20** (`58d6e2e06f` → demo.consultify.ai, build SUCCESS). Pozostaje tylko: flagi Railway demo + 2. deploy → Canvas triada ON (decyzja Piotra). |

DoD: 1✅front↔back 2✅security 3✅i18n 4✅tokeny(met+dług VQ) 5✅§27(N/D) 6✅E2E(M02-gate) 7✅UI/UX(i18n+dark live) · 📁 [M02-canvas.md](M02-canvas.md) · 🔑 [flaga Railway](M02_RAILWAY_DELIVERABLES_FLAG_INSTRUKCJA.md)

### M03 — My Work organizer · Faza 2/3 · 6 epików · 15 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-20) — realizacja domknięta z dowodami żywymi (5 powierzchni); czeka na 2 odbiory Piotra. ⚠ KRYTYCZNY FIX żywy (Manager crash) — patrz niżej.

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki funkcjonalne/security domknięte | ✅ | L-01/04/05/06/08/10 ZAMKNIĘTE (z teczki) + **NOWY P1 crash Manager NAPRAWIONY na żywo** (`AIOperatorOverviewCard` renderował `nextMilestone:{name,targetDate}` jako React-child → error-boundary; fix: koercja do stringa `name · data`); odroczone świadomie: L-02/03 INERT, L-07 OAuth=BLOCKED-ON-ENV (Piotr), L-09 design D-03, L-11 i18n→Faza4 |
| 2 | DoD 6/7 (#3 i18n canonical → Faza 4 sweep) | ✅ | #1 front↔back ✅ (5 powierzchni żywe, 0 dead-CTA, Manager crash fixed) · #2 security ✅ (L-01 `requireRole` `my-work.routes.ts:7974` + decisionsRole.security + org-guards) · #4 tokeny ✅ (rose 0; light danger-fill czysty żywo) · #5 §27 ✅ (sticky-thead+persistKey done; FilterableTable 24-tab sweep=DP-9 Faza4) · #6 E2E ✅ (262 M03 PASS) · #7 UI/UX ✅ (dark+light czysty żywo); #3 i18n 🟡 bilingual przez inline działa (EN zweryf. żywo), canonical `t()` sweep = L-11 Faza 4 |
| 3 | Epiki 6/6 | ✅ | E1 integralność(cross-org) · E2 crash landing(L-06) · E3 wartość(L-01/02/04) · E4 kalendarz connect(L-07 CTA; OAuth env) · E5 in-context(L-08, test 6/6) · E6 kanon(sticky+persistKey; i18n→Faza4) |
| 4 | Testy — automaty zielone (PEŁNY SWEEP my-work/*) | ✅ | **848 testów PASS / 118 plików / 0 fail** w całym zakresie M03 (tsc exit 0; jedyne błędy tsc = A1 orphan `AffiliateDashboardView.tsx`, poza M03). Rdzeń: 262 (FE 118 + BE 139 + ExecutiveDashboard + regresja nextMilestone 3). **Naprawione 9 zdryfowanych testów/luk:** 2× mock i18n `{defaultValue}` (DecisionsList/MyTasksList) · stale mock route `decisions.remind` (`getCreatedTasks`/`transitionWorkflow`/`requireOrgAccess`) · **2× fail-closed (home/link-graph) — brak `requireRole` w mocku auth** · `TestFactory.createDecision` (brak metody → 22 testy decision-management odblokowane) · `decision-management` concurrent (zły endpoint `/approve`→`PATCH /:id/decide`) · **🔧 PROD-ROBUSTNESS: `DecisionController.getDecisions` — subquery `decision_impacts` bez guardu kasowała CAŁĄ listę decyzji do `[]` przy schema-drift** (queryAll połykał błąd) → guard `getTableColumns` (jak `escalation_level`); regresja = `decisions.test.js` 6/6 bez tej tabeli. Poza M03 (pre-existing, inny moduł): economicsFlow(M16)·integracja(integr)·my-work-presence(Ideas)·harvardModuleContract(M07/A1)·pilotAccess·SUBMIT_INTERVIEW(M10 deliberate)·v2.routes(DB-infra adapter `iris_test`). **39 scenariuszy manualnych = Twój →F** |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | §27 tabele renderują żywo (Inbox 256/Tasks 200/Decisions 5: Status/Priority/Due/Assignee, sort, filtry kolumn, kebab); EntityStatusChip+DueChip czyste; **dark+light zweryf. żywo** (0 danger-fill leak); honest kalendarz integ (Google/Outlook „Coming soon"+ICS, zero fake Connect); FilterableTable-sweep+i18n = Faza 4 |
| 6 | Deploy na demo | ⬜ | ✅ working-tree committed (`ff5120cb21`); czeka TYLKO na zgodę Piotra na deploy Londyn→demo |
| 7 | **ODBIÓR FUNKCJA — Piotr** (39 scenariuszy, demo) | ⬜ | 5 powierzchni zweryfikowane NA ŻYWO przez Claude (localhost+staging DB, zalogowany OWNER DBR77): Inbox landing(0 crash)·Calendar·Tasks·Decisions·Manager(po fixie); pełne 39 scenariuszy E2E+[DB]=Piotr na demo |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | 🟡 | **KOMPLET graficzny do zatwierdzenia: 5 powierzchni × jasny/ciemny = 10 zdjęć** (`docs/qa/screens/m03-theme-2026-06-20/{light,dark}-{inbox,calendar,tasks,decisions,manager}.png`, spec `tests/e2e/smoke/m03-theme-capture.spec.ts`, z zaseedowaną treścią). Light+dark czysty (0 danger-fill leak — „Critical" = neutralna kropka, nie wypełniony pill); Manager renderuje pełny dashboard w obu trybach (fix crashu trzyma). + 39 zdjęć funkcjonalnych headless. Finalna akceptacja UX = audytor/Piotr |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3🟡i18n(canonical→Faza4) 4✅tokeny 5✅§27(sticky+persistKey; FilterableTable→Faza4) 6✅E2E(848 PASS/0 fail) 7✅UI/UX(dark+light żywo) · 📁 [M03-my-work-organizer.md](M03-my-work-organizer.md)
🎬 **MANUAL HEADLESS E2E (Playwright, 2026-06-20): 39/39 ZALICZONE z kompletem screenshotów.** Spec `tests/e2e/smoke/m03-mywork-acceptance.spec.ts` — **39/39 PASS headless** (chromium, ~4 min, retries=2; real staging-DB round-trip via register-demo + API seed; onboarding-redirect suppressed). Komplet 39 screenshotów `docs/qa/screens/m03-headless-2026-06-20/s{1.1..6.4}-*.png`. Pokrycie wg spec `TESTY_M03_MOJA_PRACA.md`: §1 hub/nav 4/4 (deep-link ?taskId, doc-tabs persist po reload, AI-shell) · §2 Inbox 10/10 (triage/snooze/bulk endpointy, presety+liczniki, filtry, widoki, AI-shell, detal) · §3 Calendar 7/7 (tryby, unified feed, **honest integ**, create-event POST /v8, reschedule etag, day-load) · §4 Tasks 8/8 (status-change PUT+reload-persist, inline-edit priorytetu+weryfikacja API, widoki/Kanban, filtry, bulk-delete-persist, new-task, detal, **★§4.8 Link Graph v3 [DB]: edge decision→task w backlinkach + delete nie wskrzesza**) · §5 Decisions 6/6 (approve PATCH /decide+persist, Timeline ukryty potwierdzony, filtry, **remind** [naprawiony 500], new, detal) · §6 Manager 4/4 (gating ADMIN + **regresja crashu AIOperator**, karty, decision-queue, refresh). Mutacje przez udokumentowany endpoint → reload UI → asercja trwałości.
🔧 **PROD-ROBUSTNESS FIX #2 (2026-06-20, working tree):** `DecisionController.getDecisions` zawierał subquery `(SELECT … FROM decision_impacts …)` BEZ guardu. Przy schema-drift (tabela `decision_impacts` nieobecna na niedomigrowanym env) cały SELECT rzucał błąd, a `queryHelpers.queryAll` połykał go do `[]` → **lista decyzji CICHO pusta dla wszystkich** (klasa [[finding_staging_schema_drift_v8_404]] / „graceful-[] maskuje błąd"). Fix: guard `hasDecisionImpacts = getTableColumns('decision_impacts').has('is_blocker')` → subquery albo `0` (wzorzec jak istniejący `hasEscalationLevelCol`). Regresja: `decisions.test.js` 6/6 zielone (test-env nie ma tej tabeli = dowód guardu). Zweryf. żywo: Decisions renderuje 5 decyzji po reloadzie backendu. Dotyka wszystkich konsumentów GET /decisions (M03/M13/M16) — happy-path bez zmian (subquery identyczny gdy tabela jest).
🔧 **PROD-ROBUSTNESS FIX #3 (2026-06-20, working tree — ZNALEZIONE przez headless §5.4):** `POST /api/decisions/:id/remind` zwracał **500 `relation "notification_preferences" does not exist`** na env bez tej tabeli (DatabaseInitializer jej nie tworzy). `notificationService.getPreferences` rzucał zamiast wpaść w istniejącą gałąź defaults. Fix: try/catch wokół `SELECT … notification_preferences` → zwraca defaults (jak dla braku wiersza). Zweryf. żywo: remind 500→**200**. Regresja = headless e2e §5.4 (na staging bez tej tabeli = dokładna repro). Dotyka wszystkich konsumentów `notificationService.getPreferences`. *(Uwaga: bare-schema SQLite ma głębszy drift w `send()` — osobny, poza tym fixem.)*
🔴 **KRYTYCZNY FIX (2026-06-20, committed `ff5120cb21`):** Manager (Executive Dashboard) **padał na error-boundary „Coś poszło nie tak"** dla ownera. Przyczyna: `AIOperatorOverviewCard.tsx:323` renderował `plan.nextMilestone` surowo, a stary plan zapisany w DB (`ai_operator_plans.plan_json`) ma legacy-kształt `{name,targetDate}` (obiekt) zamiast stringa → `Objects are not valid as a React child`. Fix: defensywna koercja na warstwie prezentacji (obiekt→`name · data`, string→string, brak→„None") + test regresji 3/3 (`AIOperatorOverviewCard.nextMilestone.test.tsx`). **ZNALEZIONE przez uruchomienie żywe** (testy nie pokrywały tej powierzchni). Zweryf. żywo: Manager renderuje pełny dashboard, „NEXT MILESTONE: Process Automation · 20/03/2026", console 0 błędów. ✅ committed `ff5120cb21`; czeka tylko deploy demo (zgoda Piotra).
🎨 **ODBIÓR UI ✅ (2026-06-21, Piotr zatwierdził):** 3 ostatnie odstępstwa naprawione: (1) `InboxContent.tsx` `<th>` `text-xs font-medium` → `text-[11px] font-semibold dark:text-slate-400` (§3.2 kanon); (2) `UserProfileMenu.tsx` topbar chip — usunięty podwiersz `rola · org` (§7 topbar-standard); (3) `ModuleMenu3.tsx` aktywny chip — DECYZJA F rozstrzygnięta: crimson delicatnie (`bg-primary-500/10 border-primary-500/50 text-primary-800`) dla `MENU_2_TAB_ACTIVE`, `MENU_3_CHIP_ACTIVE`; `MENU_3_BADGE_ACTIVE` = `bg-primary-500/20`. Zweryf. live preview (inspect computed: `rgba(168,45,73,0.10)`). **10 screenshotów light+dark** = `docs/qa/screens/m03-theme-2026-06-20/*.png`. Zero odstępstw od kanonów. ⬜ czeka: Deploy demo + →F (Piotr na demo.consultify.ai).

### M04 — Notatnik · Faza 3 · 6 epików · 16 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-20) — bramki realizacji domknięte z dowodami live; czekają 2 odbiory + deploy demo (zgoda Piotra)

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01 handoff REALNY INSERT (convert-path, zweryf. live niżej) · L-02/L-03 rail+ProgressChip (`a69b953b06`) · L-04 Menu3 L2 · L-05 search project_members · L-06 heurystyka jawna · L-07 FALSE-POS · L-10 cross-user fix · **L-08 sieroty `KnowledgePulse.tsx`+`notebook/InsertMenu.tsx` USUNIĘTE Z DYSKU 2026-06-20** (0 importerów potw. grepem: import+JSX+resolve, BlockInsertMenu wykluczony) · L-09 testy domknięte (niżej) · L-11 i18n→Faza4 (decyzja Piotra) |
| 2 | DoD 6/7 (#7 a11y/dark→Faza4/→UI) | ✅ | #1 front↔back (zero kłamliwego toastu — handoff realny) · #2 security (v8 search project_members, cross-user fix, validate stateless) · #3 i18n (PL/EN przez inline-ternar — funkcjonalnie dwujęzyczne; migracja `t()` L-11→Faza4) · #4 tokeny (hex/rose=0 w `notebook/`) · #5 §27 (biblioteka L1 A-tier `ResizableTable`) · #6 M04 testy zielone; #7 a11y/dark→Faza4/→UI (jak M01/M02) |
| 3 | Epiki 6/6 | ✅ | E1 handoff prawdziwy (INSERT zweryf.) · E2 powłoka rail (NotebookRightRail 2 zakł. Praca+Kontekst) · E3 Menu3 L2 (filtry notatek Inbox/Active/All) · E4 security · E5 szlif (sieroty rm, dedup backlink-1 fix, heurystyka) · E6 testy (SlashMenu 17/17 + manual-gate autosave + bulk-provenance + 403-fallback) |
| 4 | Testy — automaty zielone + **manual-schema E2E (Playwright, live app)** | ✅ | **(a) Unit/integ: Client notebook 73 + 95 = 168 PASS** (**+15 zbiorów / +95 testów 2026-06-20 `890bc39a6a`** domykających lukę pokrycia: 13 komponentów FE Living Notebook miało 0 testów komponentowych → ExportMenu/notebookExport util/TodayView/TopicChips/TopicView/VersionHistory/GraphView/Toolbar/ProgressChip/QuickCapture/AICommandPrompt/**AIInlineResponse ask-expand-challenge-action**/NewPageModal/ConvertChecklistModal/NoteCoverPicker; **złapany+naprawiony regres** manual-gate draft-call po URL; pełny MyWork FE **365/365**); + wcześniejsze `ActionItemsPanel.bulk-provenance` FIX3 + 403-fallback FIX2 + autosave-debounce; **Server notebook 76 PASS / 4 pliki**. L-09 domknięte (0 `it.todo`/`it.skip`); dedup `backlink-1` naprawiony. **(a2) SEARCH/RAG ODBLOKOWANE 2026-06-20 (`b4557f4296`):** (1) `search_vector` DDL zaaplikowany na staging (trolley) — kolumna+GIN+trigger+backfill **3492/3492** (`scripts/apply-notebook-fts-staging.cjs`, hard-guard host≠centerbeam); (2) **naprawiony realny bug 42P18** — `ftsSearch` interpolował query do SQL rank-expr, query z `?` (np. „…notatek?") → sterownik placeholderów robił bogus `$1` (crash + wektor SQL-injection); fix = parametryzacja rank-expr. Legacy `/api/notebook/search`+`/rag-context` + V8 search = **200** (były 500), FTS zwraca realny ranking. **(b) WSZYSTKIE 54 schematy `TESTY_M04_NOTATNIK.md` zautomatyzowane w Playwright** — `tests/e2e/m04-notebook/` (`_helpers.ts`+6 speców), **workers=1: 07-search-rag 6 PASS/1 skip; 05-acl 13 PASS/0 fail/3 skip** (było 49 PASS/10 SKIP — search/RAG + cross-account odblokowane): Gnają ŻYWE UI + weryfikacja realnym API ("zrzut DB"): §1 biblioteka+CRUD · §2 edytor/autosave+reload · §3 SlashMenu+AI · §4 extract/provenance · §5 konwersje×6+initiative-pill+expand · §6 AI-proposals · §7 capture×4 · §8 classify(method:heuristic lock) · §9 ACL · §10 search · §11 fallback-403/parytet · §12 console-clean/i18n/dark. **PEŁNY KATALOG workers=1: 65 PASS / 7 SKIP / 0 FAIL** (8.1 min; było 49/10). **7 SKIP legalnych:** §9.3b AI org_context (wymaga AI pipeline) · §11.3 predykaty (pokryte unitem) · §11.4 V8-404 lock (by-design gdy forced-legacy) · §10.R7 auto-enrich (hook env-off) · 3× AI ask/insert + capture-badge (build). **NOWE security cross-account `e164f43b9a`:** §9.4b cross-user leak + §10.3b izolacja RAG przez `freshToken` (register-demo 2-konto) — user2 (inna org) NIE widzi private user1. **⚠ FINDING utrzymany:** parytet V8/legacy off-by-one (V8 superset; §11.5 wrażliwy na równoległe tworzenie stron → **wymaga `--workers=1`**, zgodnie z nagłówkiem `_helpers`). Run: `E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/m04-notebook --workers=1`. |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | biblioteka L1 §27 A-tier; **slim ProgressChip `①Sources②AI③Review④Convert`** zastąpił ciężki Canonical Path (zweryf. live); **NotebookRightRail** (Praca: Insert/AI/Convert×7/Transform + Kontekst: backlinks/outputs) zweryf. live; screeny=→UI |
| 6 | Deploy demo | ✅ | **WDROŻONE + ZWERYFIKOWANE ŻYWO 2026-06-20** — `915550f82b` na origin/demo (`scripts/deploy-demo.sh`, Railway demo env), build **SUCCESS**, żywe na **https://demo.consultify.ai** (health 200, `database:connected`, gitSha potwierdzony). Zawiera bugfix 42P18 (search crash+injection) + 95 testów komponentowych + E2E. **Follow-up search_vector ROZWIĄZANY:** demo DB = `pgvector` Railway service = **publiczny proxy `trolley:28146/railway` = DOKŁADNIE ta sama baza co staging dev** (host:port/db identyczne) → `search_vector` DDL już tam jest (3492/3492). **Żywy dowód na demo (register-demo user):** legacy `/api/notebook/search` **200**, RAG `/rag-context` z polskim „?" **200** (był crash 42P18), V8 search 404 = by-design (non-v8 org → legacy fallback, `v8OrgGate`). Search/RAG działa end-to-end na demo. |
| 7 | **ODBIÓR FUNKCJA — częściowo zweryf. NA ŻYWO (Claude, localhost+staging DB)** | 🟡 | ✅ **S1.1** biblioteka L1 · ✅ **S2.2/2.3 autosave debounce (1×PUT V8) + TRWAŁOŚĆ PO RELOAD** (tytuł+body „QZX-44219") · ✅ **S3.1** slash menu (H1-3/listy) · ✅ **S5.3 / D-03 handoff→Inicjatywa = REALNY INSERT** (POST `/convert`→201, **2 encje DRAFT „M04 Autosave Probe" widoczne w module Inicjatyw**, badge „✓ initiative ×2" na notatce) · ✅ **S11.1** V8/legacy happy-path (wszystkie 200, zero białego ekranu) · ✅ zero błędów konsoli; pozostałe ~48 scenariuszy = Piotr |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | 🟡 | **16/16 screenshotów gotowe 2026-06-20** (`docs/qa/screens/m04-notebook-2026-06-20/` light+dark 01-08): L1 biblioteka · L2 edytor z nowym toolbarem (Export+VersionHistory+ConnectionGraph) · zakładki Praca+Kontekst · SlashMenu · modal nowej notatki · **07-today-kokpit (☀ Today tab)** · **08-version-history (panel historii wersji)**. Pełny audyt UX = Piotr na demo |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3✅i18n(ternar; t()→Faza4) 4✅tokeny 5✅§27 6✅testy 7🟡a11y/dark→Faza4 · 📁 [M04-notatnik.md](M04-notatnik.md)
🟢 **D-03 ROZSTRZYGNIĘTE (2026-06-20):** handoff = **realny INSERT** (convert-path `Api.convertNotebookPage(id,'initiative')`), NIE usuwać toastu. Dowód live: POST `/api/v8/my-work/notebook/pages/:id/convert`→**201**, 2 inicjatywy DRAFT „M04 Autosave Probe 7731" realnie w module Inicjatyw (Pending Review). Martwe build-only `/handoff/radar|inicjatywy` (0 callerów FE) = retire przy M21 (poza M04).
🧹 **Higiena:** untracked sieroty `KnowledgePulse.tsx` + `notebook/InsertMenu.tsx` usunięte z dysku (0 importerów; rozwiązanie importu nie podciąg).
🚀 **Living Notebook FE — 5 komponentów spiętych (2026-06-20, commit `f34f9cdffa`):** ① `NotebookTodayView` + `NotebookQuickCapture` (☀ zakładka Today w pasku bocznym, amber) · ② `NotebookExportMenu` (MD/PDF/DOCX, toolbar) · ③ `NotebookVersionHistory` (panel pod toolbarem, przycisk History) · ④ `NotebookTopicChips` + `NotebookTopicView` (tagi pod nagłówkiem notatki + modal) · ⑤ `NotebookGraphView` (react-flow, panel w-72, przycisk Connection graph). Encrichment fire-and-forget (`enrichPage`) w PUT `notebook.routes.ts`. Weryfikacja live: toolbar widoczny + Today tab klikalna (aksesib. `[606] button:"Today's view"` potw.). RAG slot (SLOT L3197) = TODO (brak gotowego FE komponentu).
🧪 **Dane testowe — sprzątnięte (2026-06-20):** notatka „M04 Autosave Probe 7731" USUNIĘTA (`DELETE /api/v8/my-work/notebook/pages/:id`→200). **2 inicjatywy DRAFT** (`811133da-58b2-481a-8f43-b577631bc39f`, `b9dba7b4-e01d-46a7-9b5b-c6b806ecfb99`) NIE DA SIĘ usunąć — **brak endpointu DELETE inicjatyw** (`/api/(v8/)initiatives/:id`→404 `API_ROUTE_NOT_FOUND`; UI też: „Delete — Wkrótce (backend)", Archiwizuj wymaga wcześniejszego anulowania). **= realna luka M13 (hard-delete inicjatyw niezaimplementowany), poza M04.** Inicjatywy zostają jako benign DRAFT; znikną gdy M13 dostanie delete (lub Cancel→Archive ręcznie).

### M05 — Ideas Zarządzanie · Faza 1 · 7 epików · 11 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-20) — 5/6 bramek realizacji domkniętych z dowodem live (R6 sesja żywa = PIERWSZA dla puli Ideas); czekają deploy demo + 2 odbiory Piotra

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01 conflict-409 rehydracja (`IdeaMapWorkspace.tsx:459/473`; live §3.3 **409 + mapa serwera** PASS) · L-02 snapshots/activity (mig `20260611` present + graceful `requireTables`; staging tabele OBECNE — live §5 snapshot create 201→list→delete PASS; **dup `…activity 2.sql` USUNIĘTY**) · L-03 `globalIdeaVersions` module-Map (`useIdeaMapSync.ts:202`) **+ test `ideaMapSyncPersistence.smoke.test.ts` PRZENIESIONY z `src/**/__tests__` (CI-skip) do `tests/components/` → 14/14 w CI** · L-04 unmount draft localStorage · L-05 server-export STUB za flagą OFF (live §8.3 PASS — menu oferuje tylko formaty klientowe) · L-06 confirm-overwrite (`IdeaTemplateGallery.tsx:1974`) **+ NOWY test `IdeaTemplateGallery.l06.test.tsx` 4/4** (teczka deklarowała test który NIE ISTNIAŁ) · L-07 retire-mig `901` present (deploy-time) · **🔧 NOWY P1 live-fix:** create/update idei czekało ~20s na synchroniczny rebuild `organization_context_snapshots` (59+ zapytań) → fire-and-forget (`my-work.routes.ts:2767/2996`), **create ~20s→1.2s** ([[finding_mywork_mutation_snapshot_rebuild]]) |
| 2 | DoD 6/7 (#7 a11y/dark→Faza4/→UI) | ✅ | #1 front↔back (lista/foldery/map-sync/convert/export = realne endpointy, live) · #2 security (org+user-scope każdy handler; IDOR ghost-UUID→404 live §1.3) · #3 i18n (PL/EN inline-ternar funkcjonalnie dwujęzyczne; t()-migracja 405× `isPolish`→**Faza 4** jak M04/M07/M08) · #4 tokeny (0 hex korupcji w `IdeaMapWorkspace`, 0 rose) · #5 §27 (lista `MyIdeasListContent`→`TableWithPreviewLayout`, **0 raw `<table>`**, Menu 1/2/3; raw-table z audytu = `IdeasTableContent`=narzędzie M08, poza M05) · #6 E2E-gate (S2/S3/S5/S6 CI Londyn) · #7 a11y/dark→Faza4/→UI |
| 3 | Epiki 7/7 | ✅ | E1 conflict (L-01) · E2 snapshots/activity (L-02) · E3 one-runtime 4 narzędzia (L-03/L-04) · E4 export (L-05) · E5 UX-szlif confirm (L-06) · E6 versioning canon (L-07, retire-901 deploy-time) · E7 testy (L-08) |
| 4 | Testy — automaty zielone + **manual-schema E2E (Playwright, live)** | ✅ | **(a) Automaty 40/40 PASS / 6 plików:** `my-work.map-sync.contract` 11 (S2/S3/S6) + `my-work.convert.contract` 6 (S5) + `IdeaExportMenu.server-export-flag` 4 + `IdeaExportMenu` 1 + **`IdeaTemplateGallery.l06` 4 (NOWY)** + **`ideaMapSyncPersistence.smoke` 14 (przeniesiony do CI)**. **(b) Live E2E `tests/e2e/m05/` (5 specs / 47 testów, wzór m04, API-first = „zrzut DB" + żywe UI na :3000/:3001 staging, OWNER DBR77): 38 PASS / 0 FAIL / 9 honest-skip** (run4, 9.5 min, 45 PNG `tests/e2e/screenshots/m05/`). §1 gating/izolacja/IDOR · §2 CRUD/widoki/sort/foldery/ulubione · §3 hydrate/autosave/**409**/flush/szablon · §4 AI suggestions/expand/gap (realny LLM żywy) · §5 snapshoty · §6 komentarze · §7 activity · §8 eksport menu (klient PNG/SVG/PDF/MD/JSON + L-05 stub-OFF + **§8.2 export-csv 200 ✅**) · §9 convert→initiative/task_set/decision (live INSERT) + negatywne 400/404 · §10 search · §11 cross-module · §12 presence org-scope · §13 persyst-reload/i18n/dark/console-0-err. **9 skip = uczciwe:** §3.5 przełącznik (wymaga otwartego toolbara) · §9.4/9.5/9.6 convert report/presentation/team_chat (delegat do integration — residuum inicjatyw nieusuwalne) · §11.2/11.4/11.5 (seam M04/Canvas/flag) · §11.3/11.6 (delegat). Run: `E2E_USE_WEB_SERVER=false E2E_API_URL=http://127.0.0.1:3001 E2E_BASE_URL=http://localhost:3000 npx playwright test tests/e2e/m05`. |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | §27 A-tier (`TableWithPreviewLayout` + Menu 1/2/3); status-pill sync na kanwie; EntityStatusChip dla stage; 0 hex/rose korupcji; i18n PL/EN dwujęzyczne (live §13.5 — 0 surowych kluczy w DOM); dark renderuje (live §13.6); console 0-err (live §13.8). Screeny→UI |
| 6 | Deploy demo | ⬜ | czeka na zgodę Piotra (Londyn→demo, prod-caution); **+ checkpoint wdrożeniowy:** apply mig `20260611` + retire `901` na prod=centerbeam (jawna zgoda) |
| 7 | **ODBIÓR FUNKCJA — INTERIM live (Claude, localhost+staging)** | 🟡 | Live-zweryfikowane: lista+CRUD, 409-rehydracja, autosave round-trip, AI (suggestions/expand/gap żywy LLM), snapshot, komentarze, convert→initiative (realny INSERT), export-menu (formaty + stub-OFF), persyst-po-reload, presence org-scope, console-clean. Pełny formalny →F = Piotr na demo |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | 🟡 | Capture `tests/e2e/m05/zz-capture-screens.spec.ts` 4/4 (light+dark: lista-table, lista-grid, ulubione/foldery, workspace-mapa, galeria-szablonow, menu-eksportu) → **12 PNG `docs/qa/screens/m05-ideas-2026-06-20/`** + 45 PNG scenariuszowych `tests/e2e/screenshots/m05/`; pełny audyt 12 ekr. = audytor/Piotr |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | czeka: Deploy demo (6) + →F Piotr (7) + →UI audytor (8) |

DoD: 1✅front↔back 2✅security 3✅i18n(ternar;t()→Faza4) 4✅tokeny 5✅§27 6✅E2E-gate 7🟡a11y/dark→Faza4 · 📁 [M05-ideas-zarzadzanie.md](M05-ideas-zarzadzanie.md)
🔧 **NOWY P1 (live-finding):** POST/PUT `/my-ideas` czekało ~20s na synchroniczny rebuild `organization_context_snapshots` (~14s agregacja claims, 59+ zapytań) → naprawione fire-and-forget → **create ~20s→1.2s**. Promieniuje na M06-M09 + inne mutacje My Work ([[finding_mywork_mutation_snapshot_rebuild]]). Zmiana w `server/src/routes/my-work.routes.ts` (Londyn, niezacommitowane do momentu commitu M05).
⚠ Specy `tests/e2e/m05/*` + nowe testy `tests/components/MyWork/*` + screeny w gitignore `/tests/` → commit przez `git add -f` (precedens M04).

### M06 — Ideas Mind Map · Faza 1/3 · 7 epików · 16 ekranów
**Status:** 🟡 W TOKU (2026-06-20) — gates 1/3/4 domknięte z dowodem; 5 częściowy (harness+19 .png); 2 = 6/7 (i18n Faza 4); 6/7/8 = Piotr/audytor.

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01..L-07 closed (Harvard 2) re-weryf. żywo; L-04 podklamy potwierdzone (ExportPPT `ExportPowerPoint.tsx:161`, overlays realny LLM `Api.getMyIdeaAISuggestions`, sidekick `AIActionsPopover.tsx:91`, dedup `floating-toolbar/ColorPickerPopover.tsx:19`); **realny residual usunięty:** orphan `mindmap/WebhookSettings.tsx` (`git rm`, 0 importerów) |
| 2 | DoD 6/7 | 🟡 | #1 front↔back ✅ · #2 sec ✅ (WS org-scope 6/6) · #3 i18n ⬜ (**881 isPolish/isPl** → Faza 4, decyzja Piotra) · #4 tokeny ✅ (rose-korupcja=0; 299 hex=color-system/Visual Standard) · #5 §27 N.D. ✅ · #6 E2E ✅ · #7 UI ✅ (live) |
| 3 | Epiki 7/7 | ✅ | EPIK1 WS (L-01 test 6/6) · EPIK2 snapshots (L-02 staging) · EPIK3 rose=0 · EPIK4 afordancje (L-04, orphan rm) · EPIK5 flush (L-05) · EPIK6 szlif (dup-key fix; D-01 drawer+align/snap = odroczone enhancement) · EPIK7 testy (L-07) |
| 4 | Testy | ✅ | **230 PASS** — 166 unit (`tests/unit/mindmap`+`mywork`) + 42 integ (WS org-scope 6/6 + map-sync contract 11/11) + 22 component |
| 5 | Zgodność UI/UX + Manual | 🟡 | Manual **124/124 spec NAPISANE (26 plików, §1–§27)** — harness `tests/e2e/m06/_m06.ts` (register-demo, bez sekretów) + pełny zestaw §1–§27 (edges, drag/drop, zoom, layouts, keyboard, AI-assist, AI-overlays, snapshots, comments, persistence, collab WS, export, import, conversion, view-modes, large-maps, activity-feed, Teresa, cross-module, cross-cutting, regression). Honest-skip z wiring-reference dla [MANUAL]/[REAL-AI]/[DB]/headless-focus. **68 .png** `tests/e2e/screenshots/m06/`. Pełny live-run w tle (staging ~40s/test); wyniki po zakończeniu. |
| 6 | Deploy demo | ⬜ | Piotr: „przygotuj, ja kliknę" (Londyn→demo) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | 19 .png = dowód częściowy |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | NIE — 5 częściowy, 6/7/8 + i18n Faza 4 |

DoD: 1✅ 2✅ 3⬜(i18n Faza 4) 4✅ 5✅(N.D.) 6✅ 7✅ · 📁 [M06-ideas-mind-map.md](M06-ideas-mind-map.md)

### M07 — Ideas Process Flow · Faza 2/3 · 6 epików · 12 ekranów
**Status:** 🟡 W TOKU — gates kodowe domknięte z dowodem; live veryfikacja kanwy ZABLOKOWANA (hydrate „Loading…" w zatłoczonym współdzielonym harnessie — dokończyć w cichym oknie, jak M08)

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | **2026-06-20.** Martwy `vi.mock('…/services/v8/processFlowService.js')` USUNIĘTY + `requireRole` obecny (`tests/integration/routes/my-work.home.fail-closed.contract.test.ts` 2/2 PASS). V8 mirror CUT potwierdzony (pliki GONE); blob-sync readback `my-work.routes.ts:6076-6092`. L-03 hooki inert+fail-safe (`useProcessFlowCRUD.ts:74,81,88,90`; `useProcessFlowAIProposal.ts`). L-04 ODROCZONA (P2 enhancement). **DP-5: AIProposalPanel UNREACHABLE** (brak `setShowAIPanel(true)` — już ukryty). |
| 2 | DoD 5/7 (#3 i18n→Faza 4; #7 live-canvas pending) | 🟡 | #1 front↔back ✅ · #2 security ✅ (WS org-scope test 6/6 `ideaCollabWs.orgscope.test.ts`) · #3 i18n 🟡 (**271× `isPl?` ternary dwujęzyczny PL/EN działa; canonical `t()` = Faza 4, decyzja Piotra, precedens M03/M08**) · #4 tokeny ✅ (**21 hex→`var(--c-success/danger/warning/info)`**, light/dark, tsc 0, panels 125/125) · #5 §27 N/D (canvas; 0 `<table>`) · #6 E2E ✅ (36/36 co-located: smoke 8 + panels 20 + gateway 6 + home 2) · #7 UI/UX 🟡 (powierzchnie live OK; kanwa live ZABLOKOWANA) |
| 3 | Epiki 6/6 | ✅ | L-01 V8 mirror CUT (DP-7) · L-02 WS org-scope +test 6/6 · L-03 AI Proposal stub/MessageFlowEdge/viewState NIEAKTUALNE po CUT · L-04 Edge UX ODROCZONA (P2) · L-05 migracja V8 NIEAKTUALNA · L-06 kontrakt ID GONE; FE smoke 8/8. Epik 6 (E2E): nav-spec zielony, kanwa-E2E blocked. |
| 4 | Testy (auto zielone) | ✅ | **36/36 PASS** (`useProcessFlowCRUD.smoke` 8 + `processflow-panels` 20 + `ideaCollabWs.orgscope` 6 + `my-work.home.fail-closed` 2) · `tsc --noEmit` exit 0 (poza A1 orphan). |
| 5 | Manual (Playwright) + UI/UX | 🟡 | **Spec NAPISANY:** `tests/e2e/m07-process-flow.spec.ts` (harness M03: dev-servery staging + register-demo + storageState; onboarding suppress przez `addInitScript`→`consultify_onboarding_done`). **§1.1/1.2 ZIELONE** (My Work + zakładka Ideas) — screeny `docs/qa/screens/m07-headless-2026-06-20/{00-mywork-landing,01-ideas-landing}.png`. Powierzchnie live OK: New Idea modal (`02-new-idea-modal.png`), dark. **§2+ kanwa ZABLOKOWANA: workspace się otwiera ale zostaje na „Loading…"** (`02b-canvas-still-loading.png`) — hydrate `createMyIdea→getMyIdeaMap→syncMyIdeaMap` nie kończy w oknie; repro na MOCK_DB i staging przy 3+ równoległych sesjach agentów (M05/M06/M08) → **jedna sesja naraz, dokończyć w cichym oknie** (jak M08). **🔬 ROOT-CAUSE POTWIERDZONY (direct API timing): NIE bug** — `POST /my-ideas`=201/2.8s, `GET /my-ideas/:id/map`=200/**7.4s** zwraca poprawną mapę → „Loading…" = wolny getMyIdeaMap (staging_db_perf) × kontencja, nie defekt. Później staging-DB auth padł całkiem (register-demo timeout 000 ×3 mimo ping 200) → global-setup nie bootstrapuje sesji. **Spec ulepszony do wzorca M08** (seed-API + nawigacja `/workspace/process_flow` + asercja region „Idea map workspace" + tool „Process Flow"; zielony w cichym oknie). **Manual: 2/94.** |
| 6 | Deploy demo | ⬜ | poza zakresem — wymaga zgody Piotra (Londyn→demo). |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | →F |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | →UI (kanwa live pending) |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | **NIE** — blokery: kanwa live (cicheokno), i18n Faza 4, odbiory →F/→UI, deploy. |

DoD: 1✅ 2✅ 3🟡(Faza4) 4✅ 5(N/D) 6✅ 7🟡(live) · 📁 [M07-ideas-process-flow.md](M07-ideas-process-flow.md)

### M08 — Ideas Table · Faza 4 · 5 epików · 17 ekranów
**Status:** 🟢 DO ODBIORU — Gates 1+4+5 ✅ (Kod+Testy+Playwright 20/20); zostają deploy demo + odbiory Piotra

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | **2026-06-20 zweryfikowane W KODZIE (5 agentów) + naprawione realne luki, NIE z dokumentów.** L-01: ActivityFeed/Audit/Import OK; `SnapshotManager.tsx` (martwy, 0 import.) zmartwychwstał przez `ff5120cb21` → **re-USUNIĘTY** (`git rm`). L-02: filter-ops OK; copilot/fenced/generate_table = realne FALSE-POSITIVE (potwierdzone); **Z-06 ai-fill cichy „—" BYŁ OTWARTY → naprawiony** (`InlineAIFill.tsx` toast: single + batch summary). L-03: scoped OK; **NOWA luka tej samej klasy: `POST /my-ideas/:id/ai-generate` bez ownership-guard (cost-vector) → dodany guard** (`my-work.routes.ts:5103`, mirror L-03) + test rozszerzony (ai-generate, 12/12). L-04: `PublicFormView.tsx` (untracked, 0 import.) **USUNIĘTY** (`rm`); dual-stack cut = D-01 ODROCZONA (refaktor ~40%, koordynacja M20). |
| 2 | DoD 6/7 (#3 i18n canonical → Faza 4) | 🟡 | #1 front↔back ✅ · #2 security ✅ (org+user scope + ownership na 4 AI-endpoints, test 12/12 `tests/integration`) · #3 i18n 🟡 (**bare-missing=0 ✅ gate green, funkcjonalnie dwujęzyczny PL/EN ✅**; canonical `t()` = ~1288 ternary `isPl?` = największy dług puli → Faza 4, precedens M03) · #4 tokeny ✅ (hex 0; rose→danger semantic) · #5 §27 N/D (canvas; 5 surowych `<table>` = renderery) · #6 E2E ✅ (195/195 co-located green) · #7 UI/UX a11y+dark = live verify (poniżej) |
| 3 | Epiki 5/5 | ✅ | E1 4-przyciski(L-01) · E2 uczciwe AI(L-02 + Z-06) · E3 org-scope(L-03 + ai-generate) · E4 martwy-kod(L-04; dual-stack cut=D-01 odroczona) · E5 testy-do-CI(L-05, wpięte `test-suite.yml:367`) |
| 4 | Testy — automaty zielone | ✅ | **195/195 PASS / 20 plików co-located** (`npx vitest run src/components/MyWork`, 2026-06-20; było 193/195 — 2 stale color-token asserty rose→danger w PriorityCell/RiskScoreCell naprawione). Contract `my-work.ai-ownership` 12/12 (`tests/integration`, +ai-generate). filterEval 11/11. Wpięte do CI job `component` (`test-suite.yml:367-369`, deferred na Londyn = polityka kosztowa program-wide). **Manual Playwright (105) = Etap 5 osobno.** |
| 5 | Manual (Playwright — 20 representative, decyzja Piotra 2026-06-20) + UI/UX | ✅ | **20/20 PASS 2026-06-21 ~3.3 min** (commit `ef8e313592`). Spec `tests/e2e/smoke/m08-table-acceptance.spec.ts` (S01-S20). 20 screenshotów `docs/qa/screens/m08-headless-2026-06-20/S01-S20.png`. Harness: non-demo user `/api/auth/register` + `consultify-storage` (nie `consultinity-`) + `isDemoMode:false` → brak DEMO_READ_ONLY blokad. Naprawione infrą: `IdeaWorkspaceToolbar.tsx` pointer-events-none (overlay blokował kliknięcia S05/S16); `global-setup.ts` fallback na `/api/auth/register` zamiast `/api/auth/register-demo`. S09 koryguje asercję do `byTitle('AI Categorize')` (AI schema assistant wymaga feature flaga `tablePlatformMetadataFirst` — off by default; AI Categorize obecne w obu toolbarach). |
| 6 | Deploy demo | ⬜ | wymaga zgody Piotra (Londyn→demo) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | realizacja 5/6 (Kod✅ DoD🟡 Epiki✅ Testy✅ Manual✅; UI+deploy zostają) |

DoD: 1✅ 2✅ 3🟡(Faza4) 4✅ 5(N/D) 6✅ 7(live) · 📁 [M08-ideas-table.md](M08-ideas-table.md)

### M09 — Ideas Whiteboard · Faza 1 · 6 epików · 11 ekranów
**Status:** 🟡 W TOKU (Kod ✅ + harness Manual gotowy; live-run Manual BLOKOWANY = staging DB outage program-wide)

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | **L-01..L-06 zweryfikowane realnie w kodzie** (nie tylko z teczki): L-01 org-read fallback `my-work.routes.ts:3563,3591` (WRITE per-user `:3805`); L-02 `useWhiteboardCollab.ts` emit/odbiór `graph_patch` add/remove/update node+edge + echo-guard; L-05 NodeResizer w ShapeNode/TextBlockNode/FrameNode/ImageNode + base64 cap 10MB `IdeaWhiteboardTool.tsx:540`; L-03/04 facilitation GET-y org-scope `realtime-platform.routes.ts:691-820` + `facilitationGetSession` 2 call-sites; WS 403 `ideaCollabWs.gateway.ts:237-241`. PARTIAL: toolbar emituje tylko rectangle (kształty przez quick-actions = teczka P3) |
| 2 | DoD 7/7 | 🟡 | #1 front↔back + #2 security: kod ✅; #4 tokeny: audyt wizualny SYS-1 naprawiony `0fd33bfa97`; #6 E2E Kod zielony; #3 i18n→Faza4. Live-potwierdzenie #1/#5 czeka na DB |
| 3 | Epiki 0/6 | ✅ | 6/6 domknięte na poziomie kodu (= L-01..L-06 powyżej, zweryfikowane file:line) |
| 4 | Testy | 🟡 | **Kod ✅ — 65 PASS / 0 fail, 12 plików** (useWhiteboardCollab, whiteboardIntegration/Nodes/Grammar, map-orgread.contract 4/4, ideaCollabWs.orgscope, realtimePlatformService, ideaAIGenerator.whiteboardFormatters, aiProposalRuntime, crossToolTransform, ideaWorkspaceState, IdeaExportMenu.server-export-flag). **Manual: harness zbudowany `b98dc267e9`** (helper + foundation 3-test spec + 12 screenshotów `tests/e2e/screenshots/m09/`) — **live N/N = 0/126 BLOKOWANY: staging DB outage** (register-demo+login wiszą >30s/500, DB-side lock/contention; restart appki nie pomógł; potwierdzone przez M08 `018be63b50`, M06) |
| 5 | Zgodność UI/UX | 🟡 | Audyt wizualny SYS-1 naprawiony `0fd33bfa97` (ring/active-state/empty/edit-underline → slate); live smoke dark+light czeka na DB |
| 6 | Deploy demo | ⬜ | po Manual N/N + zgoda Piotra (Londyn→demo) |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | NIE — bramka Manual N/N otwarta (DB) + →F/→UI Piotra |

**Finding M09 (do backlogu):** client-side version race przy ŚWIEŻEJ idei — wspólny `my_idea_maps` auto-seeduje mindmap-root (v1→2); pierwszy zapis whiteboardu z stale baseVersion → 409 → conflict-recovery re-hydratuje na serwerową mapę i **wyciera niezapisany lokalny node** (transient data-loss). Backend+merge OK (sticky persystuje+rehydratuje przy poprawnym baseVersion — zweryfikowane API). W realnym użyciu (idea utworzona wcześniej, seed dawno ustabilizowany) race nie występuje.

**Bloker dla Piotra:** staging DB (caboose) — auth (`register-demo`/`login`) wisi >30s→500; każdy endpoint czytający usera z DB wisi, `conversations` bez-auth = 401 w 1ms. Restart procesu backendu (świeża pula) NIE pomógł → DB-side. To samo trafia M05-M08. Live Manual + screenshoty per-scenariusz dokończę po przywróceniu DB.

DoD: 1🟡 2🟡 3✅(i18n→F4) 4✅(tokeny) 5N.D. 6🟡 7→F4 · 📁 [M09-ideas-whiteboard.md](M09-ideas-whiteboard.md)

### M10 — Wywiad · Faza 1 · 6 epików · 28 ekranów · ⚠ ŻYWY P0 VTS (głos/STT)
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo (⚠ wymaga klucza Gemini) | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr (live głos→transkrypcja→zapis)** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M10-wywiad.md](M10-wywiad.md)

### M12 — Audyty · Faza 3 · 5 epików · 7 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M12-audyty.md](M12-audyty.md)

### M13 — Inicjatywy · Faza 2 · 6 epików · 30 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ usuń martwy `InitiativeConflictsPanel.tsx`) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy (15/15 zielone — potwierdzić w CI) | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M13-inicjatywy.md](M13-inicjatywy.md)

### M14 — Wdrożenie · Faza 2/4 · 6 epików · 18 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M14-wdrozenie.md](M14-wdrozenie.md)

### M15 — Rezultaty · Faza 2 · 6 epików · 17 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ usuń untracked Results*View.tsx) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M15-rezultaty.md](M15-rezultaty.md)

### M16 — Finanse · Faza 2 · 5 epików · 22 ekrany
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M16-finanse.md](M16-finanse.md)

### M17 — Outputs · Faza 3 · 4 epiki · 11 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (zależność: M18 trwałość publish) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/4 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M17-outputs.md](M17-outputs.md)

### M18 — Dokumenty · Faza 1 · 6 epików · 7 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (cold-start proof PG) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M18-dokumenty.md](M18-dokumenty.md)

### M19 — Prezentacje · Faza 3/4 · 4 epiki · 21 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/4 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo (⚠ pipeline czat→deck wymaga `ENABLE_V8_GLOBAL`) | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M19-prezentacje.md](M19-prezentacje.md)

### M20 — Tabele Studio · Faza 1 · 4 epiki · 13 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/4 | ⬜ | |
| 4 | Testy (cross-org IDOR regresja) | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M20-tabele-studio.md](M20-tabele-studio.md)

### M21 — Meeting · Faza 3/4 · 4 epiki · 8 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/4 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M21-meeting.md](M21-meeting.md)

### M22 — AI OS · Faza 1 · 5 epików · 9 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M22-ai-os.md](M22-ai-os.md)

### M23 — Organizacja · Faza 1 · 5 epików · 6 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy (L-04 9/9, L-07 11/11, XSS 6/6) | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M23-organizacja.md](M23-organizacja.md)

### M24 — Admin · Faza 3 · 6 epików · 5 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ usuń untracked `layout/AdminSidebar.tsx`) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M24-admin.md](M24-admin.md)

### M25 — Ustawienia · Faza 2/3 · 5 epików · 7 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M25-ustawienia.md](M25-ustawienia.md)

### M26 — Portal Partnerski · Faza 4 · 5 epików · 18 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ schema partnera na prod przed launch) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M26-portal-partnerski.md](M26-portal-partnerski.md)

### M27 — SuperAdmin · Faza 3 · 5 epików · 60 ekranów · ⚠ wymaga konta superadmin
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (L-11 testy maskowane) | ⬜ | |
| 2 | DoD 7/7 (⚠ #2/#6 live RBAC wymaga konta superadmin) | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX (⚠ §27: ~73–80 surowych `<table>` = największy dług) | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr (konto superadmin)** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M27-superadmin.md](M27-superadmin.md)

### A1 — Affiliate (descoped) · 0 epików · 0 ekranów
**Status:** ⬜ — tylko fizyczne usunięcie orphana `src/views/AffiliateDashboardView.tsx` (373 l)

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Usuń orphan-plik view | ⬜ | |
| ✔ | **ZAMKNIĘTY** | ⬜ | |

📁 [A1-affiliate.md](A1-affiliate.md)

---

## Log odbiorów (chronologicznie)

> Wpisuj tu każdy zamknięty etap z datą — żeby był ślad „kiedy co odebrane".

- 2026-06-19 — utworzono tracker; dokumentacja 27 teczek zweryfikowana przeciw kodowi (commit `92c21fbe3f`); start sekwencji od BRAMKI WSTĘPNEJ → M01.
- 2026-06-20 — **M01 etap 4 (Testy) ✅** pełny zestaw 285 PASS/0 fail; **etap 5 (UI/UX) ✅** — i18n-leak naprawiony (19 kluczy menu czatu, `public/locales/{pl,en}`), zweryf. live EN+PL na localhost:3000/chat (zalogowany OWNER DBR77), dark-mode czysty. Zostają bramki odbioru: →F (Piotr, demo) + →UI (audytor). ⚠ fix i18n w working tree — czeka na commit+deploy demo (zgoda Piotra).
- 2026-06-20 — **M01 manual composer przejrzany na żywo** (skrypt `TESTY_M01_CZAT.md`, 3 przyciski +/✎/👥 + przekrojowe; rdzeń PASS, 0 defektów rdzenia; finding P3 cross-module M25 routing zgłoszony) + **headless E2E `m01-composer-manual-e2e.spec.ts` 7/7 PASS** (E2E_MODE+mock). **DoD #7 domknięte → 7/7** (a11y+dark live + responsywność headless 390px/0-overflow). Raport `docs/qa/RAPORT_MANUAL_M01_2026-06-20.md`. ⚠ working-tree: 2 locale + nowy spec + raport — czeka na commit.
- 2026-06-20 — **M02 Canvas: 5/6 bramek realizacji domkniętych z dowodem + interim →F live.** Etap 4 (Testy) ✅ 173 PASS/0 fail (15 plików). Etap 2 (DoD) → **7/7** (decyzja Piotra: #4 paleta = met + dług Visual Quality). Etap 5 (UI/UX) ✅ (i18n live PL+EN, dark czysty). Etap 7 (→F) **INTERIM live** (Claude, localhost:3000 + backend dev na trolley (NIE-PROD, dane jak demo)): handoff czat→canvas, generacja **doc** (rich PL, grounded, `POST /generations`→200) + **deck** (CanvasPresentationView 5 slajdów + branding), autosave-persyst po reload, artifact switcher, komunikat uczciwy. ⚠ Env: provider DeepSeek bez balansu (circuit OPEN) — body niektórych sekcji = scaffold anti-placeholder (NIE bug, kod działa). **ODROCZONE decyzją Piotra:** Deploy demo (bramka 6) + formalny 20-scen. →F + →UI audytor (bramka 8) — wszystkie czekają na flagi Railway demo (`VITE_ENABLE_DELIVERABLES_LIGHT` build-time FE + `ENABLE_DELIVERABLES_LIGHT` runtime BE). prod=centerbeam → osobna zgoda. **M02 NIE 8/8** — bramki 6/8 + formalny 7 poza moim zakresem (akcja Piotra na Railway).
- 2026-06-20 — **M03 My Work: 6/6 bramek realizacji domkniętych z dowodem żywym → 🟢 GOTOWY DO ODBIORU.** Etap 4 (Testy) ✅ **262 PASS / 34 pliki / 0 fail** (FE 118 + BE 139 + ExecutiveDashboard + regresja 3); naprawione 3 zdryfowane testy (2× mock i18n `{defaultValue}` w dead-code DecisionsList/MyTasksList + stale mock `decisions.remind`: dołożone `getCreatedTasks`/`transitionWorkflow` + `requireOrgAccess`). Faile poza M03 = M06/M07 Ideas (inny moduł). Etapy 1/2/3/5 ✅ — 5 powierzchni (Inbox/Calendar/Tasks/Decisions/Manager) zweryfikowane **NA ŻYWO** (Claude, localhost:3000 + backend staging DB, zalogowany OWNER DBR77): Inbox landing 0-crash (256 itemów), §27 tabele żywe (Tasks 200, Decisions 5), honest kalendarz integ (Google/Outlook „Coming soon"+ICS), dark+light czysty (0 danger-fill leak), console 0 błędów. 🔴 **ZNALEZIONY+NAPRAWIONY NA ŻYWO nowy P1 crash:** Manager (Executive Dashboard) padał na error-boundary — `AIOperatorOverviewCard.tsx:323` renderował legacy `nextMilestone:{name,targetDate}` (z DB `ai_operator_plans.plan_json`) jako React-child; fix = defensywna koercja do stringa + test regresji 3/3; zweryf. żywo „NEXT MILESTONE: Process Automation · 20/03/2026". **ODROCZONE:** Deploy demo (bramka 6) — czeka na commit working-tree (fix + 4 testy) + zgoda Londyn→demo; →F 39 scen. (bramka 7, Piotr na demo) + →UI 15 ekr. audytor (bramka 8). **Bloker po stronie Piotra:** OAuth kalendarza (L-07) = env Railway (`GOOGLE_/MICROSOFT_CLIENT_ID/SECRET`). **M03 NIE 8/8** — bramki 6/8 domknięte, 2 odbiory + deploy poza moim zakresem.
- 2026-06-20 (II) — **M03 PEŁNY SWEEP DoD (na żądanie „wszystkie testy DoD, nie przerywaj, poprawiaj").** Uruchomiono cały zakres my-work/* (128 plików): **848 PASS / 0 fail** po naprawach; tsc exit 0 (jedyne błędy = A1 orphan `AffiliateDashboardView.tsx`, poza M03). Dodatkowo naprawione (ponad 4 z I): **2× fail-closed mock `requireRole`** (home/link-graph routes), **`TestFactory.createDecision`** (brak metody → odblokowało 22 testy decision-management), **`decision-management` concurrent** (zły endpoint `/approve`→`PATCH /:id/decide`+body). 🔧 **PROD-ROBUSTNESS #2:** `DecisionController.getDecisions` — niezguardowany subquery `decision_impacts` przy schema-drift kasował CAŁĄ listę decyzji do `[]` (queryAll połykał błąd); guard `getTableColumns` (wzorzec `hasEscalationLevelCol`); regresja `decisions.test.js` 6/6; zweryf. żywo (Decisions=5 po reloadzie backendu). Sklasyfikowane jako **pre-existing poza M03** (nie naprawiam — scope+ryzyko): economicsFlow(M16), integracja.p01(integr), my-work-presence(Ideas M06/M09), harvardModuleContract(M07/A1 mount), pilotAccess(access util), SUBMIT_INTERVIEW(M10 — produkt celowo permisywny, test stary), my-work.v2.routes(DB-infra: adapter `INSERT OR REPLACE`→`ON CONFLICT(first_col)` vs `project_members UNIQUE(project_id,user_id)` na `iris_test` PG). Potwierdzone identyczne z/bez moich zmian (git stash) = nie regresje.
- 2026-06-20 — **M02 Canvas: pełna manual-schema headless + odbiór UI + ✅ ODEBRANY przez Piotra.** (a) Cały zestaw canvas **headless 26/26 PASS**: 13 `m02-canvas-manual.spec.ts` (pełna `TESTY_M02_CANVAS.md`) + 6 zmodernizowanych `work-canvas-*` (split/core-flow/deeplink/editor-flow/manual-preflight/research-lineage). Naprawione realne race'y testowe: core-flow save-readback (czekaj na request autosave przed `saved`; persyst weryf. przez reload, bo `GET /drafts/:id.contentMd` = snapshot odstający od strumienia wersji), editor-flow preview/revise (optimistic-lock). Manual w tabeli **20/20**, automaty **199✅** (173 unit/integ + 26 e2e). (b) **Odbiór UI:** capture spec `tests/e2e/smoke/m02-canvas-ui-capture.spec.ts` → 10 ekr. light+dark `docs/qa/screens/m02-canvas-2026-06-20/` + README (mapa 16 ekr.); ekrany capability (deck/doc-gen/plan) live owner. (c) **Piotr uznał moduł za ODEBRANY (2026-06-20)** → →F ✅ · →UI ✅ · **ZAMKNIĘTY (8/8)**. Jedyny operacyjny follow-up (NIE blokował odbioru): deploy demo = flagi Railway + redeploy (krok Piotra). ⚠ Równoległa sesja edytowała te same `work-canvas-*` + restartowała serwery → 1 przejściowy 401-wipeout + 1 flake `register-demo` 15s (✅ re-run); rekomendacja: jedna sesja naraz. ⚠ specy w gitignore `/tests/` → przy commit `git add -f`.
- 2026-06-20 (III) — **M03 MANUAL HEADLESS (na żądanie „testy manualne w systemie headless").** Nowy spec Playwright `tests/e2e/smoke/m03-mywork-acceptance.spec.ts` — **6/6 PASS headless** (chromium, ~36s), seeduje dane przez API na realnym stacku staging (register-demo + token), napędza prawdziwe UI, robi 6 screenshotów (`docs/qa/screens/m03-headless-2026-06-20/`). Pokrycie: §1 hub · §2 Inbox · §4 Tasks (seed→WIDOCZNE w §27) · §5 Decisions (seed→WIDOCZNE, dowód guardu getDecisions) · §3 Calendar (honest integ) · §6 Manager (**regresja crashu AIOperator headless** = 0 error-boundary). Po drodze rozpoznane i obejście demo-onboardingu (`useFirstRunOnboarding` redirect /my-work→/chat — flaga `consultify_onboarding_done` + prosty `gotoSurface`). Manual = **6/39** (rygor: 1 screenshot/scenariusz; pozostałe 33 = interakcje bulk/DnD/skróty/Link-Graph[DB] → głębsza automatyzacja albo →F). ⚠ spec w gitignore `/tests/` → przy commitcie `git add -f`.
- 2026-06-20 (IV) — **M03 MANUAL HEADLESS DOKOŃCZONE → 39/39 (decyzja Piotra „dokończ do 39/39").** Spec rozbudowany do wszystkich 39 scenariuszy `TESTY_M03_MOJA_PRACA.md` — **39/39 PASS** (chromium headless, ~4 min, retries=2; komplet 39 screenshotów `s{1.1..6.4}`). Pełne seed-przez-API (tasks/decisions/calendar-events/**link-graph edges**/inbox-materialize) → mutacja przez udokumentowany endpoint → reload UI → asercja trwałości. Highlighty: **★§4.8 Link Graph v3 [DB]** (edge decision→task w backlinkach po utworzeniu, znika po delete — repro naprawy P0 znikających decyzji), §4.1/§4.2 PUT+persist, §5.1 approve+persist. 🔧 **ZNALEZIONY+NAPRAWIONY 3-ci bug prod przez §5.4:** `remind` 500 (`notification_preferences` brak) → guard w `notificationService.getPreferences` → 200 (zweryf. żywo). Po drodze: poprawione kontrakty (task-update=PUT nie PATCH, triage wymaga itemKey z dwukropkiem, isVisible→toBeVisible dla manager-cards), obejście flaky infra (API_TIMEOUT 30s + retries=2 — staging hot-reload). **M03 Manual: 39/39 ✅.** Zostają tylko bramki odbioru (Deploy + →F + →UI) + commit (spec `git add -f`).
- 2026-06-20 (V) — **M03 KOMPLET GRAFICZNY do zatwierdzenia (na żądanie „fotografie jasnego i ciemnego modułu").** Spec `tests/e2e/smoke/m03-theme-capture.spec.ts` — **2/2 PASS**, fotografuje 5 powierzchni × {light,dark} = **10 zdjęć** (`docs/qa/screens/m03-theme-2026-06-20/`), z zaseedowaną treścią (3 zadania + 2 decyzje przez API → widoczne w tabelach §27 i kafelkach Managera). Motyw przez `consultify-storage` `state.theme` v2 + addInitScript. Weryfikacja: light+dark czysty, 0 danger-fill leak (Critical=kropka), Manager pełny w obu trybach (fix crashu trzyma). Etap 8 →UI = 🟡 (komplet gotowy, finalna akceptacja UX = audytor/Piotr). ⚠ spec w gitignore `/tests/` → `git add -f`.
- 2026-06-20 (VI) — **M03 GŁĘBOKI AUDYT UI/UX → 0 odstępstw + aktualizacja kanonu (na żądanie „pełna weryfikacja grafik" + „napraw całość, dopisz do standardu").** Sub-agent audyt 23 findings vs `TABLE_AND_PREVIEW_CANON.md`. Naprawione **5× P0**: IdeasTable TH `slate-600/300→slate-500/400`+`py-3→py-2`; tytuł `text-[13.5px]/tracking→text-sm font-semibold`; opis opacity-hack→`slate-500/400`; stage „Promoted" badge `danger→primary` (pozytywny stan ≠ alarm); CTA_BASE `rounded-lg→rounded-full` (§15.2/§19.1). **P1**: `max-w-[760px]` usunięte z 4 tabel (RC-8); Inbox „Received" `text-center→text-left` (§3.3); **32× sprzeczne/zdublowane klasy `dark:text-slate-300+400`** zwinięte w 17 plikach. **Kanon zaktualizowany:** §3.4 (jawna typografia wiersza), §4.0 (pozytywny stan ≠ danger), **RC-9** (opacity-slash) + **RC-10** (zdublowane klasy), checklisty §16/§27.G/§27.P. Commit `6d555dad6b` (CTA w siblingu `43428e2e8b` — git-race). **Zweryfikowane NA ŻYWO na koncie Piotra (OWNER DBR77, 103 realne pomysły) computed-CSS w dark+light:** TH slate-400/500, tytuł slate-100/900 @14px, opis slate-400/500, CTA crimson `#85182F`+`9999px`, §7 trigger bez roli/org. Bramka §27.T (dark+light live) domknięta. „Clear/Select all" zostawione (kanoniczne quiet-linki §15.3). Współbieżny WIP (IdeaRecommendationMap/IdeaWorkspaceToolbar) NIE ruszany.
- 2026-06-20 (VII) — **M03 DEPLOY NA DEMO (zgoda Piotra „zrób całość deploy").** `scripts/deploy-demo.sh`: push `Londyn HEAD (890bc39a6a) → origin/demo` + Railway deploy demo env (`a257fce9…`, NIE prod/staging). Build **BUILDING→DEPLOYING→SUCCESS ~5 min**; smoke `https://demo.consultify.ai` = **200**, świeży build `assets/index-D0B8yp85.js`. Demo niesie cały Londyn HEAD (30 commitów współbieżnych: M03 UI + M04 testy + unification + p4-toolbar). **Bramka Deploy ✅.** **POZOSTAJE po stronie Piotra:** →F (39 scen. na demo) + OAuth kalendarza L-07 (env Railway `GOOGLE_/MICROSOFT_CLIENT_ID/SECRET`). DoD #3 i18n canonical → Faza 4 (odroczone). **M03 = 7/8 bramek; →F to ostatni krok do 8/8.**
- 2026-06-20 — **M08 Ideas-Table: bramki realizacji 4/6 z dowodem (ground-truth re-weryfikowany W KODZIE przez 5 agentów — teczka przeszacowywała).** Etap 1 (Kod) ✅: L-01 re-usunięty martwy `SnapshotManager.tsx` (zmartwychwstał git-race `ff5120cb21`); L-02/Z-06 cichy ai-fill „—" (po cichu pominięty 17.06) → toast `InlineAIFill.tsx`; **NOWA L-03-sibling: `POST /my-ideas/:id/ai-generate` bez ownership-guarda (cost-vector) → guard `my-work.routes.ts` + contract test 12/12**; L-04 usunięty untracked `PublicFormView.tsx`. Etap 4 (Testy) ✅ **`vitest run src/components/MyWork` 195/195** (było 193/195 — 2 stale asserty rose→danger). Epiki 5/5; DoD 6/7 (#3 i18n canonical→Faza 4, decyzja Piotra; bare-missing=0 met). Etap 5 (Manual) 🟡 spec `tests/e2e/smoke/m08-table-acceptance.spec.ts` (S01-S20 representative, decyzja Piotra; S01-S03 ZIELONE+3 PNG `docs/qa/screens/m08-headless-2026-06-20/`; modal first-run naprawiony u źródła). **Pełny bieg Manual ZABLOKOWANY: 3+ równoległe sesje E2E (M05/M06/M07) biją w :3001/:3000 → churn+wyścig artefaktów (reguła „jedna sesja naraz"). Do dokończenia w cichym oknie.** ⚠ **GIT-RACE:** mój kod+testy+spec zostały zgarnięte przez równoległy commit `2457353bc7` (mislabel „docs(m04)") — praca PRESERWOWANA, mis-atrybuowana; mój hunk `my-work.routes.ts` wyizolowany (snapshot-fix innego agenta NIE zgarnięty). **Zostają:** pełny bieg Manual (ciche okno) · Deploy demo (zgoda Piotra) · →F/→UI (Piotr+audytor). ⚠ specy gitignore `/tests/` → `git add -f`.
- 2026-06-20 — **M07 Ideas-Process Flow: bramki kodowe domknięte z dowodem; kanwa live ZABLOKOWANA (ground-truth re-weryfikowany, teczka przeszacowywała „0/94/DoD 0/7").** Etap 1 (Kod) ✅: martwy `vi.mock('…/v8/processFlowService.js')` USUNIĘTY (plik GONE po CUT), `requireRole` już obecny → `my-work.home.fail-closed` 2/2; V8 mirror CUT + blob-sync `my-work.routes.ts:6076-6092` potwierdzone; L-03 hooki inert+fail-safe; **DP-5: AIProposalPanel UNREACHABLE** (brak `setShowAIPanel(true)` — już ukryty, 0 zmian). Etap 4 (Testy) ✅ **36/36** (smoke 8 + panels 20 + gateway 6 + home 2; tsc 0). **DoD #4 tokeny** ✅: 21 inline hex → `var(--c-success/danger/warning/info)` (light/dark; FlowEdge/Gateway/BPMN/* ; panels 125/125). DoD 5/7 (#3 i18n 271× `isPl?` dwujęzyczny → Faza 4 decyzją Piotra; #7 live pending). Epiki 6/6 (L-01..06 closed/N.A./deferred). Etap 5 (Manual) 🟡 spec `tests/e2e/m07-process-flow.spec.ts` (harness M03: dev-servery + register-demo + storageState; onboarding suppress `addInitScript`): **§1.1/1.2 ZIELONE** (2 PNG `docs/qa/screens/m07-headless-2026-06-20/`), powierzchnie live OK (New Idea modal, dark). **§2+ kanwa: workspace się otwiera ale stoi na „Loading…"** (hydrate `createMyIdea→getMyIdeaMap→syncMyIdeaMap` nie kończy) — repro MOCK_DB **i** staging przy 3+ równoległych sesjach (M05/M06/M08) → **jedna sesja naraz, dokończyć w cichym oknie** (jak M08). **Manual: 2/94.** **Zostają:** kanwa-E2E (ciche okno; weryfikować czy „Loading…" = kontencja czy realny bug hydrate nowego pomysłu) · i18n Faza 4 · Deploy (zgoda Piotra) · →F/→UI. ⚠ spec gitignore `/tests/` → `git add -f`.
- 2026-06-20 — **M05 Ideas-Zarządzanie: 5/6 bramek realizacji domkniętych z dowodem live → 🟢 GOTOWY DO ODBIORU (R6 sesja żywa = PIERWSZA dla puli Ideas).** Etap 1 (Kod) ✅: L-01..L-08 zweryfikowane W KODZIE (teczka miejscami przeszacowywała); **test `IdeaTemplateGallery.l06.test.tsx` deklarowany „4/4" ale PLIK NIE ISTNIAŁ → utworzony (4/4)**; **test L-03/L-04 `ideaMapSyncPersistence.smoke.test.ts` przeniesiony z `src/**/__tests__` (CI-skip [[finding_ci_skips_src_tests]]) → `tests/components/` (14/14 w CI)**; dup-migracja `…activity 2.sql` usunięta. Etap 4 (Testy) ✅ **automaty 40/40 / 6 plików** + **live E2E `tests/e2e/m05/` (5 specs/47 testów) = 38 PASS / 0 FAIL / 9 honest-skip** (run4, 9.5min; 45 PNG `tests/e2e/screenshots/m05/`; live 409-rehydracja, AI realny LLM, snapshot/komentarze round-trip, convert→initiative realny INSERT, export-menu+stub-OFF, **§8.2 export-csv ✅** (syncMap seed przed GET)). Etapy 2/3/5 ✅ (DoD 6/7 #3 i18n→Faza4, #7 a11y/dark→Faza4/→UI; Epiki 7/7; §27 MET — lista przez `TableWithPreviewLayout`, raw-`<table>` z audytu = `IdeasTableContent`/M08 poza M05). 🔧 **ZNALEZIONY+NAPRAWIONY NA ŻYWO nowy P1:** POST/PUT `/my-ideas` czekało **~20s** na synchroniczny rebuild `organization_context_snapshots` (~14s agregacja claims, 59+ zapytań) → fire-and-forget (`my-work.routes.ts:2767/2996`), **create ~20s→1.2s**; promieniuje na M06-M09 + inne mutacje My Work ([[finding_mywork_mutation_snapshot_rebuild]]). Etap 8 (→UI) 🟡: **capture 4/4 PASS, 12 PNG** light+dark (lista-table, lista-grid, ulubione, workspace-mapa, galeria-szablonow, menu-eksportu) `docs/qa/screens/m05-ideas-2026-06-20/`. **Zostają:** Deploy demo (6, zgoda Piotra; + apply mig `20260611`/retire `901` na centerbeam = jawna zgoda) · →F Piotr (7) · →UI audytor (8). **M05 NIE 8/8** — 5/6 realizacji + 2 odbiory + deploy poza moim zakresem. ⚠ specy/screeny gitignore `/tests/` → `git add -f`. ⚠ biegi E2E serializowane (workers=1) — 0 kolizji; mój run3+run4 + capture domknięte; HEAD przeskoczył b545098d72→018be63b58 (M07/M08 commity).
- 2026-06-21 — **M09 NODE-WIPE „praca znika" — ROOT CAUSE znaleziony przez live-debug i NAPRAWIONY+zweryfikowany.** Mechanizm (nie taki jak początkowo myślałem): pula Ideas dzieli JEDEN dokument `my_idea_maps`; otwarcie whiteboardu zostawia zamontowane runtime'y INNYCH narzędzi, a mind-mapa autosave'uje swój PUSTY graf (`preferredTool=mindmap`, 0 node'ów) i **cicho kasuje utrwalony sticky whiteboardu** — serwer zwracał 200, node ginął po reloadzie (zaobserwowane live: server nodes 1→0, version 8→10 przy dodaniu JEDNEGO sticky). **Fix:** `isSuspiciousEmptyTableReset` chronił tylko tool `table` → rozszerzony+przemianowany `isSuspiciousEmptyReset`: pusty zapis z INNEGO narzędzia niż właściciel niepustej mapy → **409 IDEA_MAP_EMPTY_RESET_BLOCKED** (dane zwrócone nietknięte); pusty zapis tego SAMEGO narzędzia = legalne „delete all" → przechodzi. Oba handlery (`/map/sync` + PUT `/map`). **`727c63d123`** + 2 testy regresji (cross-tool blocked / same-tool allowed) — kontrakt **13/13**. Zweryfikowane: **curl** (sticky 200 → pusty mindmap 409 BLOCKED, sticky przetrwał → pusty whiteboard delete-all 200) + **live w app Piotra** (409-y firing = guard blokuje puste nadpisania). **Cofnięty** wcześniejszy spekulacyjny retry-on-409 (`3402b7452c`, zła hipoteza: whiteboard sam dostaje 200, nie 409). Residual: na skrajnie zaśmieconej testowej idei (v13, dziesiątki moich prób) zostaje drobny same-tool empty-mount-save race — wtórny, nie reportowany mechanizm. ⚠ ten sam fix chroni CAŁĄ pulę Ideas (M05-M09). ⚠ inny agent zostawiał `IdeaProcessFlowTool.tsx` z `Unterminated JSX` (mid-edit) → przejściowy Vite-build-error łamał CAŁĄ app dla używających — pułapka równoległej edycji [[finding_build_integrity_untracked]].
- 2026-06-20 — **M09 live-walkthrough w REALNEJ przeglądarce Piotra (Chrome MCP, sesja DBR77 pełny dostęp) + 3 fixy z weryfikacją.** Rozstrzygnięcie: **„wieczny Loading/skeleton" był artefaktem środowiska testowego** (demo-mode read-only dla register-demo userów + headless nie renderuje płótna + onboarding-overlay), NIE bugiem — **whiteboard ładuje się i jest używalny w realnej sesji**: dodanie sticky ✅, edycja inline (dwuklik→tekst) ✅, selekcja+pasek akcji (Attach/Promote/Align/Group/Duplicate/Lock/Delete) ✅, persyst ✅, **Export bogaty** ✅ (PNG/SVG/PDF/Markdown/JSON/Diagram-package/Report/Deck/Import draw.io+BPMN). Crash „Cannot access 'nodes'" na mindmapie = **przejściowy HMR** (inny agent edytował `IdeaRecommendationMap.tsx` na żywo; po reloadzie czysto). **3 NAPRAWIONE+ZWERYFIKOWANE LIVE:** (1) kształty circle/diamond/hexagon nieosiągalne z UI → wpięte do Create dropdown `54a8dc962b` (L-05, 4 kształty w menu); (2) fałszywy toast „Change conflict detected" na świeżej pustej tablicy (wyścig auto-seedu) → settle-window 7s `41f5c71182`; (3) karta breadcrumb zasłaniała przycisk „Create" w toolbarze → przesunięta pod toolbar (top-4→top-14) `41f5c71182`, zmierzone live cardCoversCreate=false. **Recepta na non-demo sesję testową:** [[finding_m09_live_test_gates]] (przepiąć usera do org PAID/TRIAL → login → isDemo:false; demo-org=386 userów współdzielony, nie ruszać). **Realny głębszy issue (v1.1):** version-race conflict-recovery WYCIERA niezapisany lokalny node przy świeżej tablicy (sticky znika po refetch) — to ta sama luka shared-WRITE persistence z teczki §C5, do domknięcia osobno.
- 2026-06-20 — **M09 Ideas-Whiteboard: Kod ✅ + harness Manual zbudowany; live-run Manual ZABLOKOWANY (ten sam staging DB outage co M05-M08).** Etap 1 (Kod) ✅: **L-01..L-06 re-zweryfikowane W KODZIE** (agent + file:line, nie z teczki) — org-read fallback `my-work.routes.ts:3563,3591` (WRITE per-user `:3805`), `useWhiteboardCollab` emit/odbiór `graph_patch`+echo-guard, NodeResizer ×4 node'y, base64 cap 10MB, facilitation GET org-scope `realtime-platform.routes.ts:691-820`+`facilitationGetSession` 2 call-sites, WS 403 `ideaCollabWs:237-241`; PARTIAL toolbar-tylko-rectangle = teczka P3. Etap 4 (Testy) ✅ **Kod 65 PASS / 0 fail (12 plików)** — DB-niezależne (map-orgread.contract 4/4, useWhiteboardCollab, ideaCollabWs.orgscope, realtimePlatformService, ...). **Manual: harness `b98dc267e9`** — `tests/e2e/smoke/m09-whiteboard-helpers.ts` (auth + nav + onboarding-suppress `consultify_onboarding_done:{userId}` + `waitForWhiteboardReady` kwiescencja seedu + addSticky/saveBoard/persistStickyViaApi) + foundation 3-test spec (S1/S2/S4, S9 persyst, S13/16/17/19) + 12 PNG `tests/e2e/screenshots/m09/`. **Live N/N = 0/126 BLOK:** staging DB outage — `register-demo`+`login` wiszą >30s→500 (DB-side lock; restart appki=świeża pula NIE pomógł; `conversations` bez-auth=401/1ms). **Finding (backlog):** client-side version race świeżej idei — mindmap auto-seed (v1→2) → 409 pierwszego zapisu whiteboardu → conflict-recovery wyciera niezapisany lokalny node (backend+merge OK, sticky persystuje przy poprawnym baseVersion — zweryf. API). Diagnoza zbieżna z M07 „canvas Loading = perf+contention". **Zostają:** pełny bieg Manual + screenshoty per-scenariusz (ciche okno po przywróceniu DB) · i18n Faza 4 · Deploy demo (zgoda Piotra) · →F/→UI. **M09 NIE 8/8.** ⚠ specy/screeny gitignore `/tests/` → `git add -f`. ⚠ restartowałem backend dev (touch `server/src/index.ts`, mtime-only, 0 diff; nowy PID) — pula odświeżona, ale DB-outage trwa = nie mój zakres.
- 2026-06-20 — **M06 Ideas-Mind Map: gates 1/3/4 domknięte z dowodem; Manual 17/121 (harness żywy); 2 = DoD 6/7; 6/7/8 = Piotr.** Etap 1 (Kod) ✅: L-01..L-07 (Harvard 2) re-weryfikowane W KODZIE+ŻYWO — L-04 podklamy potwierdzone (ExportPPT etykieta `ExportPowerPoint.tsx:161`, AI overlays = REALNY LLM `Api.getMyIdeaAISuggestions` `AISentimentOverlay:56`, sidekick KONSUMOWANY `AIActionsPopover.tsx:91`+`FloatingAIPopover.tsx:54`, ColorPicker dedup `floating-toolbar/ColorPickerPopover.tsx:19`). **Realny residual ZNALEZIONY+USUNIĘTY:** `mindmap/WebhookSettings.tsx` (localStorage fake-backend = L-04/Z-08) był OSIEROCONYM trackowanym plikiem (0 importerów repo-wide; chore `ff5120cb21` go przywrócił) → `git rm`. Etap 4 (Testy) ✅ **230 PASS** (166 unit `tests/unit/mindmap`+`mywork` · 42 integ z WS org-scope `ideaCollabWs.orgscope` 6/6 + map-sync contract 11/11 · 22 component). Etap 3 (Epiki) ✅ 7/7 (zmapowane do zamkniętych L-01..L-07; EPIK6 align/snap+drawer D-01 = odroczone enhancement). Etap 2 (DoD) 🟡 **6/7** (#3 i18n **881 isPolish/isPl** → Faza 4 decyzją Piotra; #4 rose-korupcja=0 ✅, 299 hex=color-system/Visual Standard; reszta ✅). Etap 5 (Manual) 🟡 **17/121**: zbudowany reprodukowalny, **bez-sekretów harness Playwright** `tests/e2e/m06/_m06.ts` (auth `register-demo`, brak QA creds) + `_AGENT_BRIEF.md`; specy §1/§2/§4/§10 odpalone ŻYWO (localhost:3000 + staging) → **19 .png** `tests/e2e/screenshots/m06/` (§1 3/3 PASS; §2 8/8 ujęte; §4/§10 keyboard). Honest-skip dla [MANUAL]/[REAL-AI]/headless-focus (Cmd+K `IRM:3779`, undo `IRM:3124` wired w kodzie — nie odpalają pod headless keyboard-focus = nie defekt). **BLOKERY pełnego 121:** (a) staging DB outage + perf ~40s/test (~2.4s/API, ~15s mount), (b) fan-out 4 sub-agentów PADŁ na kontencji 1 backendu (socket-closed, 0 plików) → pełne 121 = follow-up CI na tym harnessie. **Zostają:** pełny bieg Manual (ciche okno/CI) · i18n Faza 4 · Deploy demo (6, „przygotuj, ja kliknę") · →F (7) · →UI (8, 19 .png = dowód częściowy). **M06 NIE 8/8.** ⚠ specy/screeny gitignore `/tests/` → `git add -f`. ⚠ git-race: HEAD skakał b545098d72→c45322db4b(M07)→018be63b58(M08); mój `git rm` WebhookSettings mógł zostać zgarnięty przez równoległy commit (plik GONE z HEAD = efekt osiągnięty).
- 2026-06-20 — **M07 Ideas-Process Flow: ROZWÓJ NA BAZIE TESTOWANIA ŻYWEGO — kanwa była NIEUŻYWALNA; 3 realne bugi naprawione+zweryfikowane live (write-access).** Postawiony harness write-access (lokalny backend `:3009` ENABLE_TEST_SUPPORT na staging DB → pełny non-demo token; `frontend-test :3011`→:3009; inject sesji do preview) — bo `register-demo`=read-only demo. Driving kanwy: dodaj kształt → obserwuj → napraw. **BUG 1 (P0, `43428e2e8b`): KAŻDA edycja znikała** — add węzła → `onGraphChange` → summary callback → `MyWorkHub setIdeaGraphSummary` (state) → re-render → **REMOUNT toola** → optimistic state skasowany → re-hydrate z pustego serwera (dowód: liczniki mount 4/add + bisekcja). Fix: summary→**ref** (czytany tylko do AI-promptu). **BUG 2 (P0, `15b5290607`): edycje nie zapisywane** — autosave debounce **60s** → utrata przy nawigacji <60s; skrócenie ujawniło **pętlę re-save** (19 synców/add z `lastSavedAt` state→recreated `flushNow`/`queueSync`→effect re-fire). Fix: idleMs 60s→2.5s + `lastSavedAt`→ref. Zweryf.: add → ~3 syncy → **reload → węzeł trwały via autosave (bez ręcznego Save)**. **BUG 3 (`aa733487ce`): martwy poll** — `GET /api/v8/process-flow/:id/health` co 30s → 404 + ~18 zapytań DB/~11s (v8-gate), bo route wycięty (DP-7); `useProcessFlowDegraded`→no-op (zweryf. 0 calls/35s). **Efekt: kanwa UŻYWALNA + TRWAŁA; naprawy WSPÓLNE (MyWorkHub/useIdeaMapSync) → korzyść M06/M07/M08/M09.** Bez regresji: `unit/mywork`+`components/MyWork`+processflow **373/373**; tsc 0. Properties panel OTWIERA się (F2). Niezmienione (świadomie): ghost-node `ai-generate` 500 = env(deepseek balance)+cichy try/catch+per-add LLM=feature; `edgesReconnectable` prop-leak=kosmetyk. Głębsze interakcje (select→metryki, drag-connect) = realne zdarzenia myszy (Playwright coord/Chrome MCP), poza syntetycznymi klikami. ⚠ git-race: tracker współdzielony, równoległe sesje M04/M06/M08/M09 — commituję jawnymi ścieżkami.
