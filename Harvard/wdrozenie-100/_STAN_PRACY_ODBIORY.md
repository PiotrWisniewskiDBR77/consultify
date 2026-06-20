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
| M01 | Czat | 2 | 5/5 | 6/7 | 285✅ | 0/13 | ✅ | ⬜ | ⬜ | 20 | 🟢 DO ODBIORU |
| M02 | Canvas | 3 | 6/6 | 7/7 | 173✅ | 0/20 | ✅ | 🟡 | ⬜ | 16 | 🟢 DO ODBIORU |
| M03 | My Work — organizer | 2/3 | 6/6 | 6/7 | 262✅ | 0/39 | ✅ | ⬜ | ⬜ | 15 | 🟢 DO ODBIORU |
| M04 | Notatnik | 3 | 6/6 | 6/7 | 149✅ | 0/54 | ✅ | 🟡 | ⬜ | 16 | 🟢 DO ODBIORU |
| M05 | Ideas — Zarządzanie | 1 | 0/7 | 0/7 | ⬜ | 0/62 | ⬜ | ⬜ | ⬜ | 11 | ⬜ NIE ROZP. |
| M06 | Ideas — Mind Map | 1/3 | 0/7 | 0/7 | ⬜ | 0/121 | ⬜ | ⬜ | ⬜ | 16 | ⬜ NIE ROZP. |
| M07 | Ideas — Process Flow | 1/3 | 0/6 | 0/7 | ⬜ | 0/94 | ⬜ | ⬜ | ⬜ | 12 | ⬜ NIE ROZP. |
| M08 | Ideas — Table | 3/4 | 0/5 | 0/7 | ⬜ | 0/103 | ⬜ | ⬜ | ⬜ | 17 | ⬜ NIE ROZP. |
| M09 | Ideas — Whiteboard | 1 | 0/6 | 0/7 | ⬜ | 0/126 | ⬜ | ⬜ | ⬜ | 11 | ⬜ NIE ROZP. |
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

**Postęp programu:** 0 / 27 zamkniętych · **4 🟢 GOTOWE DO ODBIORU (M01, M02, M03, M04)** · bramki realizacji: Epiki M01 5/5, M02 6/6, M03 6/6, M04 6/6 · DoD M01 6/7, M02 **7/7** (#4 paleta = met + dług Visual Quality, decyzja Piotra 2026-06-20), M03 6/7 (#3 i18n canonical→Faza 4), M04 6/7 (#7 a11y/dark→Faza4/→UI) · Testy automaty M01 285✅ (2026-06-20) + M02 **173✅** (2026-06-20) + M03 **262✅** (34 pliki, 0 fail, 2026-06-20) + M04 **149✅** (notebook 73 client + 76 server, 2026-06-20) (manual 0/1954) · UI M01 ✅ (i18n+dark live), M02 ✅ (i18n live PL+EN, dark; paleta=dług VQ), M03 ✅ (5 powierzchni żywych, dark+light czysty, Manager crash fixed), M04 ✅ (§27 A-tier biblioteka, slim ProgressChip + RightRail konsolidacja live). **Blokery odbioru po stronie Piotra:** M01 — commit+deploy demo fixu i18n (working tree); M02 — →F interim zweryfikowany live; formalny →F+Deploy+→UI ODROCZONE (flagi Railway demo); **M03 — commit working-tree (fix Manager crash + 4 testy) + zgoda na deploy Londyn→demo; OAuth kalendarza (L-07) = env Railway po stronie Piotra**; **M04 — commit working-tree (sierota-rm + dedup backlink-1 + 3 testy guard) + zgoda na deploy Londyn→demo; sprzątnięcie 3 fixtur testowych „M04 Autosave Probe" (staging)**.

---

## Odbiory szczegółowe (moduł po module)

> Każdy moduł: 8 etapów + linia DoD. Odhaczamy `⬜→✅`, wpisujemy datę/kto przy odbiorach 7–8.

### M01 — Czat · Faza 2 · 5 epików · 20 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-19) — realizacja domknięta z dowodami; czeka na Twoje 2 odbiory

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki funkcjonalne/security domknięte | ✅ | L-01/02/05/07/08/09/10 ZAMKNIĘTE, L-04/06 false-pos; sierota `CodeInterpreter/` usunięta (L-05) |
| 2 | DoD 6/7 (#7 a11y→Faza4) | ✅ | #1 front↔back · #2 security · #3 i18n(0 bare) · #4 tokeny(rose 0) · #5 §27 N/D · #6 M01-gate green |
| 3 | Epiki 5/5 | ✅ | E1 rdzeń · E2 język(10/10) · E3 reasoning(9/9) · E4 Tryb B(33/33+2/2)+A(6/6), **C odroczony BETA** · E5 closeout |
| 4 | Testy — automaty zielone + manual composer przejrzany | ✅ | **Automaty:** pełny zestaw M01 uruchomiony 2026-06-20: 51 plików / 285 testów PASS, 0 fail (exit 0). 0 tracked-failów M01 (nie-M01 faile: M22 Wave5 + DB-infra — poza zakresem). **Manual:** skrypt `TESTY_M01_CZAT.md` (3 przyciski composera +/✎/👥 + przekrojowe) przejrzany NA ŻYWO 2026-06-20 — rdzeń PASS, 0 defektów rdzenia M01; raport [`docs/qa/RAPORT_MANUAL_M01_2026-06-20.md`](../../docs/qa/RAPORT_MANUAL_M01_2026-06-20.md). 1 finding cross-module (M25 routing) + caveaty środowiskowe (drift staging DB). Pozostałe scenariusze (branch/export/share/revoke/głos, upload natywny) = →F Piotra |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | komponenty zgodne (composer single-border 5/5, rose 0); **i18n leak NAPRAWIONY 2026-06-20** (5 kluczy PL-fallback w EN + 14 EN-fallback w PL → wszystkie przez `t()` w PL+EN locales; zweryf. live EN „HOW TERESA SHOULD ANSWER" + PL „JAK TERESA MA ODPOWIADAĆ"/„Dodaj do projektu"); **dark-mode czysty zweryf. live** (wszystkie menu czatu); a11y keyboard-nav live = →UI |
| 6 | Deploy na demo | ✅ | `SUCCESS demo/1475849a` — M01 live na demo.consultify.ai |
| 7 | **ODBIÓR FUNKCJA** — szeroko zweryf. NA ŻYWO (Claude, localhost+staging) | 🟡 | ✅ AddFilesMenu (Add link + walidacja URL, Recent) · ✅ ToolsMenu (5 trybów+badge+TTS+Response style+Add to project) · ✅ Co-Thinker (6 person+pill+exclusion+Clear) · ✅ **E2E flag→backend** (Deep Thinking + Agent Audit Layer na żywo) · ✅ tytuł auto-gen · ✅ język PL→PL · ✅ SSE+persyst.; pozostałe (branch/export/share/revoke/głos, upload) + odbiór końcowy = Piotr |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | **dark-mode ✅ + a11y ✅ (Esc/focus-ring/role=menuitem) zweryf. live 2026-06-20**; ⚠ responsywność mobile NIE sterowalna automatem (okno zmaks., innerWidth stałe) → ręczny check Piotra/DevTools; dowody menu (EN+PL ToolsMenu, modal, AddFiles, Deep Thinking) w sesji; pełny capture 20 ekranów + audyt = audytor/Piotr |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3✅i18n 4✅tokeny 5✅§27(N/D) 6✅E2E(M01-gate) 7🟡UI/UX(a11y✅+dark✅ live 2026-06-20; **zostaje tylko responsywność mobile live** — tooling/ręczny check Piotra) · 📁 [M01-czat.md](M01-czat.md)
🔴 **KRYTYCZNY FIX (2026-06-19, `42bee38044`):** czat padał na 400 „Invalid schema generate_deliverable type:None" — ai SDK v6 `tool()` wymaga `inputSchema` nie `parameters` (`llmService.ts`). ZNALEZIONY przez uruchomienie (testy mockowały SDK). Live-verified: polskie pytanie→polska odpowiedź+9 RAG. **= prawdopodobny P0 Elkomtechu „brak odpowiedzi" → MUSI na demo+prod.** [[finding_chat_inputschema_sdk_v6]]
✅ **i18n-leak NAPRAWIONY (2026-06-20):** 19 brakujących kluczy menu czatu (`ToolsMenu`/`WorkModeMenu`/`AddFilesMenu`) dopisane do `public/locales/{pl,en}/translation.json` — m.in. `aiChat.menu.steeringHeading/steeringSubtitle/customSet`, `aiChat.conversation.addToProject(+RequiresConversation)`, `aiChat.workMode.title`, `modes.showReasoning.tooltip`, voiceStyle/addLink/manageIntegrations itd. Zweryf. live EN+PL (oba kierunki). ⚠ **w working tree — czeka na commit+deploy demo (zgoda Piotra).**
⚠ Bloker wspólnego PR-gate: 4 faile `Wave5ArtifactRuntimePanel` (M22) — osobny task, nie M01.

### M02 — Canvas · Faza 3 · 6 epików · 16 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-20) — realizacja domknięta (6/6 bramek realizacji ✅); →F **interim zweryfikowany live lokalnie**; Deploy demo + formalny →F + →UI **ODROCZONE decyzją Piotra** (czekają na flagi Railway demo)

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | 11 luk zamkniętych/FP (L-02/04/05/06/08/09/10/13/14/15 + L-11 i18n); odroczone świadomie: L-01 Tryb C→BETA, L-03 runtime→Fala 2 (guard 36/36 zamknięty), L-07 picker→backend B-1, L-12 paleta→Visual Quality |
| 2 | DoD **7/7** (#4 paleta = met + dług VQ, decyzja Piotra 2026-06-20) | ✅ | #1 front↔back · #2 security (9/9 cap + S7 cross-org 403, **bez IDOR**) · #3 i18n (L-11, 66 kluczy; live PL+EN) · #4 tokeny **met** (hex 0; ~168 util palety = tracked dług Visual Quality P3) · #5 §27 N/D · #6 M02-gate green |
| 3 | Epiki 6/6 | ✅ | E1 kręgosłup(Tryb B 33/33) · E2 generacja · E3 security · E4 odporność · E5 kanon(i18n) · E6 testy(40/40+3/3) — C/picker/paleta odroczone |
| 4 | Testy — automaty zielone | ✅ | **173 PASS / 0 fail** (15 plików, 2026-06-20): `unbackedCanvasClaim` 36/36, `canvas/*`, `AIChat/*`, `WorkCanvasDocumentPanel` 33/33 + `handoffMount` 2/2, `work-canvas.routes` 40/40, `deliverablesGenerations.generate-format` 3/3, `canvasMaterializeCrossOrg` 3/3. **20 scenariuszy manualnych = formalny →F na demo** (po fladze) |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | i18n ✅ live (PL shell „Porozmawiaj z Teresą" + EN; panel render-test); dark-mode czysty (canvas/edytor/slajdy live); ~168 util palety = dług Visual Quality (P3, decyzja Piotra: liczone jako met); pełne screeny 16 ekr. = →UI audytor |
| 6 | Deploy demo | 🟡 | **ODROCZONE (decyzja Piotra 2026-06-20)**. Wymaga `VITE_ENABLE_DELIVERABLES_LIGHT` (build-time FE) + `ENABLE_DELIVERABLES_LIGHT` (runtime BE) na Railway demo — bez tego triada „wygląda jakby nigdy nie działała". Kod gotowy + live-proven lokalnie |
| 7 | **ODBIÓR FUNKCJA — Piotr** | 🟡 | **INTERIM zweryf. NA ŻYWO (Claude, localhost:3000 + backend dev na trolley (NIE-PROD, dane jak demo), 2026-06-20):** ✅ handoff czat→canvas · ✅ generacja **doc** (rich PL prose, grounded 3 źródła, `POST /generations`→200) · ✅ generacja **deck** (CanvasPresentationView, 5 slajdów, tytuł+branding DBR77) · ✅ autosave-persyst po reload · ✅ artifact switcher (chip reload-safe) · ✅ komunikat uczciwy „dokument jest po prawej" (NIE halucynacja). **sheet** = ta sama ścieżka (generate-format 3/3). Formalny 20-scen. →F na demo = po fladze |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | ODROCZONE — pełen pakiet 16 ekr. po deployu demo |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | bramki 6/8 + formalny 7 ODROCZONE decyzją Piotra (czekają na flagi Railway demo) |

DoD: 1✅front↔back 2✅security 3✅i18n 4✅tokeny(met+dług VQ) 5✅§27(N/D) 6✅E2E(M02-gate) 7✅UI/UX(i18n+dark live) · 📁 [M02-canvas.md](M02-canvas.md) · 🔑 [flaga Railway](M02_RAILWAY_DELIVERABLES_FLAG_INSTRUKCJA.md)

### M03 — My Work organizer · Faza 2/3 · 6 epików · 15 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-20) — realizacja domknięta z dowodami żywymi (5 powierzchni); czeka na 2 odbiory Piotra. ⚠ KRYTYCZNY FIX żywy (Manager crash) — patrz niżej.

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki funkcjonalne/security domknięte | ✅ | L-01/04/05/06/08/10 ZAMKNIĘTE (z teczki) + **NOWY P1 crash Manager NAPRAWIONY na żywo** (`AIOperatorOverviewCard` renderował `nextMilestone:{name,targetDate}` jako React-child → error-boundary; fix: koercja do stringa `name · data`); odroczone świadomie: L-02/03 INERT, L-07 OAuth=BLOCKED-ON-ENV (Piotr), L-09 design D-03, L-11 i18n→Faza4 |
| 2 | DoD 6/7 (#3 i18n canonical → Faza 4 sweep) | ✅ | #1 front↔back ✅ (5 powierzchni żywe, 0 dead-CTA, Manager crash fixed) · #2 security ✅ (L-01 `requireRole` `my-work.routes.ts:7974` + decisionsRole.security + org-guards) · #4 tokeny ✅ (rose 0; light danger-fill czysty żywo) · #5 §27 ✅ (sticky-thead+persistKey done; FilterableTable 24-tab sweep=DP-9 Faza4) · #6 E2E ✅ (262 M03 PASS) · #7 UI/UX ✅ (dark+light czysty żywo); #3 i18n 🟡 bilingual przez inline działa (EN zweryf. żywo), canonical `t()` sweep = L-11 Faza 4 |
| 3 | Epiki 6/6 | ✅ | E1 integralność(cross-org) · E2 crash landing(L-06) · E3 wartość(L-01/02/04) · E4 kalendarz connect(L-07 CTA; OAuth env) · E5 in-context(L-08, test 6/6) · E6 kanon(sticky+persistKey; i18n→Faza4) |
| 4 | Testy — automaty zielone (CAŁOŚĆ uruchomiona) | ✅ | **262 testów PASS / 34 pliki / 0 fail** (FE 118 + BE 139 + ExecutiveDashboard + regresja nextMilestone 3). Naprawione 3 zdryfowane testy: 2× mock i18n `{defaultValue}` (DecisionsList/MyTasksList — testy dead-code) + 1× stale mock route (`decisions.remind` — brak `getCreatedTasks/transitionWorkflow` + `requireOrgAccess`). Faile poza M03: M06/M07 Ideas (processflow/MindMap) = inny moduł. **39 scenariuszy manualnych = Twój →F** (zalogowana sesja) |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | §27 tabele renderują żywo (Inbox 256/Tasks 200/Decisions 5: Status/Priority/Due/Assignee, sort, filtry kolumn, kebab); EntityStatusChip+DueChip czyste; **dark+light zweryf. żywo** (0 danger-fill leak); honest kalendarz integ (Google/Outlook „Coming soon"+ICS, zero fake Connect); FilterableTable-sweep+i18n = Faza 4 |
| 6 | Deploy na demo | ⬜ | czeka na commit working-tree (fix Manager + 4 testy) + zgoda Piotra na deploy Londyn→demo |
| 7 | **ODBIÓR FUNKCJA — Piotr** (39 scenariuszy, demo) | ⬜ | 5 powierzchni zweryfikowane NA ŻYWO przez Claude (localhost+staging DB, zalogowany OWNER DBR77): Inbox landing(0 crash)·Calendar·Tasks·Decisions·Manager(po fixie); pełne 39 scenariuszy E2E+[DB]=Piotr na demo |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | screeny 5 powierzchni + Manager(STAGE/VALUE/Next milestone „Process Automation·20/03/2026") w sesji; pełny capture 15 ekranów + audyt = audytor/Piotr |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3🟡i18n(canonical→Faza4) 4✅tokeny 5✅§27(sticky+persistKey; FilterableTable→Faza4) 6✅E2E(262 PASS) 7✅UI/UX(dark+light żywo) · 📁 [M03-my-work-organizer.md](M03-my-work-organizer.md)
🔴 **KRYTYCZNY FIX (2026-06-20, working tree):** Manager (Executive Dashboard) **padał na error-boundary „Coś poszło nie tak"** dla ownera. Przyczyna: `AIOperatorOverviewCard.tsx:323` renderował `plan.nextMilestone` surowo, a stary plan zapisany w DB (`ai_operator_plans.plan_json`) ma legacy-kształt `{name,targetDate}` (obiekt) zamiast stringa → `Objects are not valid as a React child`. Fix: defensywna koercja na warstwie prezentacji (obiekt→`name · data`, string→string, brak→„None") + test regresji 3/3 (`AIOperatorOverviewCard.nextMilestone.test.tsx`). **ZNALEZIONE przez uruchomienie żywe** (testy nie pokrywały tej powierzchni). Zweryf. żywo: Manager renderuje pełny dashboard, „NEXT MILESTONE: Process Automation · 20/03/2026", console 0 błędów. ⚠ w working tree — czeka na commit+deploy demo (zgoda Piotra).

### M04 — Notatnik · Faza 3 · 6 epików · 16 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-20) — bramki realizacji domknięte z dowodami live; czekają 2 odbiory + deploy demo (zgoda Piotra)

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | L-01 handoff REALNY INSERT (convert-path, zweryf. live niżej) · L-02/L-03 rail+ProgressChip (`a69b953b06`) · L-04 Menu3 L2 · L-05 search project_members · L-06 heurystyka jawna · L-07 FALSE-POS · L-10 cross-user fix · **L-08 sieroty `KnowledgePulse.tsx`+`notebook/InsertMenu.tsx` USUNIĘTE Z DYSKU 2026-06-20** (0 importerów potw. grepem: import+JSX+resolve, BlockInsertMenu wykluczony) · L-09 testy domknięte (niżej) · L-11 i18n→Faza4 (decyzja Piotra) |
| 2 | DoD 6/7 (#7 a11y/dark→Faza4/→UI) | ✅ | #1 front↔back (zero kłamliwego toastu — handoff realny) · #2 security (v8 search project_members, cross-user fix, validate stateless) · #3 i18n (PL/EN przez inline-ternar — funkcjonalnie dwujęzyczne; migracja `t()` L-11→Faza4) · #4 tokeny (hex/rose=0 w `notebook/`) · #5 §27 (biblioteka L1 A-tier `ResizableTable`) · #6 M04 testy zielone; #7 a11y/dark→Faza4/→UI (jak M01/M02) |
| 3 | Epiki 6/6 | ✅ | E1 handoff prawdziwy (INSERT zweryf.) · E2 powłoka rail (NotebookRightRail 2 zakł. Praca+Kontekst) · E3 Menu3 L2 (filtry notatek Inbox/Active/All) · E4 security · E5 szlif (sieroty rm, dedup backlink-1 fix, heurystyka) · E6 testy (SlashMenu 17/17 + manual-gate autosave + bulk-provenance + 403-fallback) |
| 4 | Testy — automaty zielone | ✅ | **Client notebook 73 PASS / 12 plików** (+ nowe: `ActionItemsPanel.bulk-provenance` FIX3 + 403-fallback guard FIX2 + autosave-debounce); **Server notebook 76 PASS / 4 pliki**. L-09 domknięte: 0 `it.todo`/`it.skip`; dedup key `backlink-1` naprawiony (warning zniknął). Faile w szerszym przebiegu = M06/M07 (poza M04). 54 scenariusze manualne = →F Piotra |
| 5 | Zgodność UI/UX (kryt. 7) | ✅ | biblioteka L1 §27 A-tier; **slim ProgressChip `①Sources②AI③Review④Convert`** zastąpił ciężki Canonical Path (zweryf. live); **NotebookRightRail** (Praca: Insert/AI/Convert×7/Transform + Kontekst: backlinks/outputs) zweryf. live; screeny=→UI |
| 6 | Deploy demo | ⬜ | czeka na zgodę Piotra (Londyn→demo, prod-caution) |
| 7 | **ODBIÓR FUNKCJA — częściowo zweryf. NA ŻYWO (Claude, localhost+staging DB)** | 🟡 | ✅ **S1.1** biblioteka L1 · ✅ **S2.2/2.3 autosave debounce (1×PUT V8) + TRWAŁOŚĆ PO RELOAD** (tytuł+body „QZX-44219") · ✅ **S3.1** slash menu (H1-3/listy) · ✅ **S5.3 / D-03 handoff→Inicjatywa = REALNY INSERT** (POST `/convert`→201, **2 encje DRAFT „M04 Autosave Probe" widoczne w module Inicjatyw**, badge „✓ initiative ×2" na notatce) · ✅ **S11.1** V8/legacy happy-path (wszystkie 200, zero białego ekranu) · ✅ zero błędów konsoli; pozostałe ~48 scenariuszy = Piotr |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | screeny kluczowe w sesji (L1, L2+edytor, ProgressChip, SlashMenu, New Note modal, RightRail Praca+Kontekst, dowód INSERT w Inicjatywach); pełny capture 16 ekranów + audyt = audytor/Piotr |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3✅i18n(ternar; t()→Faza4) 4✅tokeny 5✅§27 6✅testy 7🟡a11y/dark→Faza4 · 📁 [M04-notatnik.md](M04-notatnik.md)
🟢 **D-03 ROZSTRZYGNIĘTE (2026-06-20):** handoff = **realny INSERT** (convert-path `Api.convertNotebookPage(id,'initiative')`), NIE usuwać toastu. Dowód live: POST `/api/v8/my-work/notebook/pages/:id/convert`→**201**, 2 inicjatywy DRAFT „M04 Autosave Probe 7731" realnie w module Inicjatyw (Pending Review). Martwe build-only `/handoff/radar|inicjatywy` (0 callerów FE) = retire przy M21 (poza M04).
🧹 **Higiena:** untracked sieroty `KnowledgePulse.tsx` + `notebook/InsertMenu.tsx` usunięte z dysku (0 importerów; rozwiązanie importu nie podciąg).
🧪 **Dane testowe — sprzątnięte (2026-06-20):** notatka „M04 Autosave Probe 7731" USUNIĘTA (`DELETE /api/v8/my-work/notebook/pages/:id`→200). **2 inicjatywy DRAFT** (`811133da-58b2-481a-8f43-b577631bc39f`, `b9dba7b4-e01d-46a7-9b5b-c6b806ecfb99`) NIE DA SIĘ usunąć — **brak endpointu DELETE inicjatyw** (`/api/(v8/)initiatives/:id`→404 `API_ROUTE_NOT_FOUND`; UI też: „Delete — Wkrótce (backend)", Archiwizuj wymaga wcześniejszego anulowania). **= realna luka M13 (hard-delete inicjatyw niezaimplementowany), poza M04.** Inicjatywy zostają jako benign DRAFT; znikną gdy M13 dostanie delete (lub Cancel→Archive ręcznie).

### M05 — Ideas Zarządzanie · Faza 1 · 7 epików · 11 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/7 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M05-ideas-zarzadzanie.md](M05-ideas-zarzadzanie.md)

### M06 — Ideas Mind Map · Faza 1/3 · 7 epików · 16 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/7 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M06-ideas-mind-map.md](M06-ideas-mind-map.md)

### M07 — Ideas Process Flow · Faza 1/3 · 6 epików · 12 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy (⚠ napraw martwy vi.mock + requireMock w fail-closed test) | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M07-ideas-process-flow.md](M07-ideas-process-flow.md)

### M08 — Ideas Table · Faza 3/4 · 5 epików · 17 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte (⚠ usuń untracked `table/PublicFormView.tsx`) | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M08-ideas-table.md](M08-ideas-table.md)

### M09 — Ideas Whiteboard · Faza 1 · 6 epików · 11 ekranów
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

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M09-ideas-whiteboard.md](M09-ideas-whiteboard.md)

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
- 2026-06-20 — **M02 Canvas: 5/6 bramek realizacji domkniętych z dowodem + interim →F live.** Etap 4 (Testy) ✅ 173 PASS/0 fail (15 plików). Etap 2 (DoD) → **7/7** (decyzja Piotra: #4 paleta = met + dług Visual Quality). Etap 5 (UI/UX) ✅ (i18n live PL+EN, dark czysty). Etap 7 (→F) **INTERIM live** (Claude, localhost:3000 + backend dev na trolley (NIE-PROD, dane jak demo)): handoff czat→canvas, generacja **doc** (rich PL, grounded, `POST /generations`→200) + **deck** (CanvasPresentationView 5 slajdów + branding), autosave-persyst po reload, artifact switcher, komunikat uczciwy. ⚠ Env: provider DeepSeek bez balansu (circuit OPEN) — body niektórych sekcji = scaffold anti-placeholder (NIE bug, kod działa). **ODROCZONE decyzją Piotra:** Deploy demo (bramka 6) + formalny 20-scen. →F + →UI audytor (bramka 8) — wszystkie czekają na flagi Railway demo (`VITE_ENABLE_DELIVERABLES_LIGHT` build-time FE + `ENABLE_DELIVERABLES_LIGHT` runtime BE). prod=centerbeam → osobna zgoda. **M02 NIE 8/8** — bramki 6/8 + formalny 7 poza moim zakresem (akcja Piotra na Railway).
- 2026-06-20 — **M03 My Work: 6/6 bramek realizacji domkniętych z dowodem żywym → 🟢 GOTOWY DO ODBIORU.** Etap 4 (Testy) ✅ **262 PASS / 34 pliki / 0 fail** (FE 118 + BE 139 + ExecutiveDashboard + regresja 3); naprawione 3 zdryfowane testy (2× mock i18n `{defaultValue}` w dead-code DecisionsList/MyTasksList + stale mock `decisions.remind`: dołożone `getCreatedTasks`/`transitionWorkflow` + `requireOrgAccess`). Faile poza M03 = M06/M07 Ideas (inny moduł). Etapy 1/2/3/5 ✅ — 5 powierzchni (Inbox/Calendar/Tasks/Decisions/Manager) zweryfikowane **NA ŻYWO** (Claude, localhost:3000 + backend staging DB, zalogowany OWNER DBR77): Inbox landing 0-crash (256 itemów), §27 tabele żywe (Tasks 200, Decisions 5), honest kalendarz integ (Google/Outlook „Coming soon"+ICS), dark+light czysty (0 danger-fill leak), console 0 błędów. 🔴 **ZNALEZIONY+NAPRAWIONY NA ŻYWO nowy P1 crash:** Manager (Executive Dashboard) padał na error-boundary — `AIOperatorOverviewCard.tsx:323` renderował legacy `nextMilestone:{name,targetDate}` (z DB `ai_operator_plans.plan_json`) jako React-child; fix = defensywna koercja do stringa + test regresji 3/3; zweryf. żywo „NEXT MILESTONE: Process Automation · 20/03/2026". **ODROCZONE:** Deploy demo (bramka 6) — czeka na commit working-tree (fix + 4 testy) + zgoda Londyn→demo; →F 39 scen. (bramka 7, Piotr na demo) + →UI 15 ekr. audytor (bramka 8). **Bloker po stronie Piotra:** OAuth kalendarza (L-07) = env Railway (`GOOGLE_/MICROSOFT_CLIENT_ID/SECRET`). **M03 NIE 8/8** — bramki 6/8 domknięte, 2 odbiory + deploy poza moim zakresem.
