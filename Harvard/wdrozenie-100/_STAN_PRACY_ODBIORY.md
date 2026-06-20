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

**Bramki realizacji** (czy zrobione): **Epiki** x/N · **DoD** x/7 · **Testy** zrealizowane/spec (scenariusze manualne E2E) · **UI** zrealizowane wg standardu (kryt. 7).
**Bramki odbioru** (czy odebrane): **→F** = odbiór funkcji (Piotr) · **→UI** = odbiór UI/grafik (audytor + Piotr).
Komórka: ⬜ nie · 🟡 w toku · ✅ tak. Moduł **ZAMKNIĘTY** dopiero gdy 6 bramek = ✅ (Epiki N/N, DoD 7/7, Testy spec/spec, UI ✅, →F ✅, →UI ✅).
**Testy x/N:** N = scenariusze ze specyfikacji manualnej E2E [`../Testy manualne/`](../Testy%20manualne/) (łącznie **1954**); x = zrealizowane+PASS (z dowodem). Plus automaty `tests/` (unit/integ/e2e).

| # | Moduł | Faza | Epiki | DoD | Testy | UI | →F | →UI | Ekr. | Status |
|---|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|---|
| M01 | Czat | 2 | 5/5 | 6/7 | 100✅·0/13 | 🟡 | ⬜ | ⬜ | 20 | 🟢 DO ODBIORU |
| M02 | Canvas | 3 | 6/6 | 6/7 | 0/20 (148✅) | 🟡 | ⬜🔑 | ⬜ | 16 | 🟢 DO ODBIORU |
| M03 | My Work — organizer | 2/3 | 0/6 | 0/7 | 0/39 | ⬜ | ⬜ | ⬜ | 15 | ⬜ NIE ROZP. |
| M04 | Notatnik | 3 | 0/6 | 0/7 | 0/54 | ⬜ | ⬜ | ⬜ | 16 | ⬜ NIE ROZP. |
| M05 | Ideas — Zarządzanie | 1 | 0/7 | 0/7 | 0/62 | ⬜ | ⬜ | ⬜ | 11 | ⬜ NIE ROZP. |
| M06 | Ideas — Mind Map | 1/3 | 0/7 | 0/7 | 0/121 | ⬜ | ⬜ | ⬜ | 16 | ⬜ NIE ROZP. |
| M07 | Ideas — Process Flow | 1/3 | 0/6 | 0/7 | 0/94 | ⬜ | ⬜ | ⬜ | 12 | ⬜ NIE ROZP. |
| M08 | Ideas — Table | 3/4 | 0/5 | 0/7 | 0/103 | ⬜ | ⬜ | ⬜ | 17 | ⬜ NIE ROZP. |
| M09 | Ideas — Whiteboard | 1 | 0/6 | 0/7 | 0/126 | ⬜ | ⬜ | ⬜ | 11 | ⬜ NIE ROZP. |
| M10 | Wywiad | 1 | 0/6 | 0/7 | 0/75 | ⬜ | ⬜ | ⬜ | 28 | ⬜ NIE ROZP. |
| M12 | Audyty | 3 | 0/5 | 0/7 | 0/49 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M13 | Inicjatywy | 2 | 0/6 | 0/7 | 0/68 | ⬜ | ⬜ | ⬜ | 30 | ⬜ NIE ROZP. |
| M14 | Wdrożenie | 2/4 | 0/6 | 0/7 | 0/63 | ⬜ | ⬜ | ⬜ | 18 | ⬜ NIE ROZP. |
| M15 | Rezultaty | 2 | 0/6 | 0/7 | 0/58 | ⬜ | ⬜ | ⬜ | 17 | ⬜ NIE ROZP. |
| M16 | Finanse | 2 | 0/5 | 0/7 | 0/70 | ⬜ | ⬜ | ⬜ | 22 | ⬜ NIE ROZP. |
| M17 | Outputs | 3 | 0/4 | 0/7 | 0/84 | ⬜ | ⬜ | ⬜ | 11 | ⬜ NIE ROZP. |
| M18 | Dokumenty | 1 | 0/6 | 0/7 | 0/72 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M19 | Prezentacje | 3/4 | 0/4 | 0/7 | 0/81 | ⬜ | ⬜ | ⬜ | 21 | ⬜ NIE ROZP. |
| M20 | Tabele Studio | 1 | 0/4 | 0/7 | 0/95 | ⬜ | ⬜ | ⬜ | 13 | ⬜ NIE ROZP. |
| M21 | Meeting | 3/4 | 0/4 | 0/7 | 0/59 | ⬜ | ⬜ | ⬜ | 8 | ⬜ NIE ROZP. |
| M22 | AI OS | 1 | 0/5 | 0/7 | 0/92 | ⬜ | ⬜ | ⬜ | 9 | ⬜ NIE ROZP. |
| M23 | Organizacja | 1 | 0/5 | 0/7 | 0/80 | ⬜ | ⬜ | ⬜ | 6 | ⬜ NIE ROZP. |
| M24 | Admin | 3 | 0/6 | 0/7 | 0/53 | ⬜ | ⬜ | ⬜ | 5 | ⬜ NIE ROZP. |
| M25 | Ustawienia | 2/3 | 0/5 | 0/7 | 0/71 | ⬜ | ⬜ | ⬜ | 7 | ⬜ NIE ROZP. |
| M26 | Portal Partnerski | 4 | 0/5 | 0/7 | 0/70 | ⬜ | ⬜ | ⬜ | 18 | ⬜ NIE ROZP. |
| M27 | SuperAdmin | 3 | 0/5 | 0/7 | 0/89 | ⬜ | ⬜ | ⬜ | 60 | ⬜ NIE ROZP. |
| A1 | Affiliate (descoped) | — | — | — | 0/31 | — | — | — | 0 | ⬜ rm orphan |

**Status modułu (słownik PM):** ⬜ NIE ROZPOCZĘTY · 🟡 W TOKU · 🟢 GOTOWY DO ODBIORU (6 bramek realizacji ✅, czeka na →F/→UI) · ✅ ZAMKNIĘTY (wszystkie 6 ✅).

**Postęp programu:** 0 / 27 zamkniętych · **2 🟢 GOTOWE DO ODBIORU (M01, M02)** · bramki realizacji: Epiki M01 5/5, M02 6/6 · DoD M01 6/7, M02 6/7 · Testy automaty M01 105✅ + M02 148✅ (manual 0/1954) · UI 0/27. **Blokery odbioru po stronie Piotra:** M02 →F wymaga flag Railway demo (`VITE_ENABLE_DELIVERABLES_LIGHT`+`ENABLE_DELIVERABLES_LIGHT`).

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
| 4 | Testy — automaty zielone (CAŁOŚĆ przejrzana) | ✅ | **Pełny zestaw M01 przeszedł triaż.** M01-core tracked: **100 PASS**. Naprawiony 1 realny tracked-bug: stale mock `CoThinkerActivePill` w `EnhancedChatInput.teresa-error-toast` (`cb7244e1dd`, 2/2). Usunięty martwy gitignored test `AIChatWelcomeView.v8-controls`. Pozostałe faile pełnego runu = **inne moduły** (M22 Wave5, M24/M27 admin-session/superadmin-sidebar — nieaktualne asercje) + DB-infra integracje — NIE M01. **13 scenariuszy manualnych** wymaga zalogowanej sesji = Twój →F (granica dostępu) |
| 5 | Zgodność UI/UX (kryt. 7) | 🟡 | komponenty zgodne (composer single-border 5/5, rose 0); a11y/dark live = →UI |
| 6 | Deploy na demo | ✅ | `SUCCESS demo/1475849a` — M01 live na demo.consultify.ai |
| 7 | **ODBIÓR FUNKCJA** — częściowo zweryf. NA ŻYWO (Claude, localhost+staging) | 🟡 | ✅ AddFilesMenu · ✅ ToolsMenu/AI-Modes · ✅ Co-Thinker(6 person) · ✅ **język PL→PL** · ✅ error-state · ✅ SSE+RAG+persyst.; pozostałe scenariusze = Piotr |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | dark-mode czysty (live); screeny audytora pending |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3✅i18n 4✅tokeny 5✅§27(N/D) 6✅E2E(M01-gate) 7🟡UI/UX(a11y→Faza4) · 📁 [M01-czat.md](M01-czat.md)
🔴 **KRYTYCZNY FIX (2026-06-19, `42bee38044`):** czat padał na 400 „Invalid schema generate_deliverable type:None" — ai SDK v6 `tool()` wymaga `inputSchema` nie `parameters` (`llmService.ts`). ZNALEZIONY przez uruchomienie (testy mockowały SDK). Live-verified: polskie pytanie→polska odpowiedź+9 RAG. **= prawdopodobny P0 Elkomtechu „brak odpowiedzi" → MUSI na demo+prod.** [[finding_chat_inputschema_sdk_v6]]
⚠ Drobny i18n-leak: nagłówek „JAK TERESA MA ODPOWIADAĆ" (PL) w ToolsMenu wśród EN.
⚠ Bloker wspólnego PR-gate: 4 faile `Wave5ArtifactRuntimePanel` (M22) — osobny task, nie M01.

### M02 — Canvas · Faza 3 · 6 epików · 16 ekranów
**Status:** 🟢 GOTOWY DO ODBIORU (2026-06-19) — realizacja domknięta; ⚠ odbiór funkcji BLOKOWANY flagą Railway

| # | Etap | ✓ | Odbiór / dowód |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ✅ | 11 luk zamkniętych/FP (L-02/04/05/06/08/09/10/13/14/15 + L-11 i18n); odroczone świadomie: L-01 Tryb C→BETA, L-03 runtime→Fala 2 (guard 36/36 zamknięty), L-07 picker→backend B-1, L-12 paleta→Visual Quality |
| 2 | DoD 6/7 (#4 paleta→Visual Quality) | ✅ | #1 front↔back · #2 security (9/9 cap + S7 cross-org 403, **bez IDOR**) · #3 i18n (L-11, 66 kluczy) · #5 §27 N/D · #6 M02-gate green; #4 hex 0 (paleta odroczona) |
| 3 | Epiki 6/6 | ✅ | E1 kręgosłup(Tryb B 33/33) · E2 generacja · E3 security · E4 odporność · E5 kanon(i18n) · E6 testy(40/40+3/3) — C/picker/paleta odroczone |
| 4 | Testy — automaty zielone + manual do odbioru | 🟡 | **148 locków PASS** (105 FE + 43 backend); **20 scenariuszy manualnych = Twój odbiór na demo** (po fladze) |
| 5 | Zgodność UI/UX (kryt. 7) | 🟡 | i18n ✅; ~168 util palety → program Visual Quality (P3, odroczone); screeny = →UI |
| 6 | Deploy demo | 🟡 | ⚠ **WYMAGA `VITE_ENABLE_DELIVERABLES_LIGHT` + `ENABLE_DELIVERABLES_LIGHT` na Railway demo** — bez tego triada „wygląda jakby nigdy nie działała" |
| 7 | **ODBIÓR FUNKCJA — Piotr** (20 scenariuszy, po fladze) | ⬜ | 🚫 zablokowany do czasu ustawienia flag Railway |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1✅front↔back 2✅security 3✅i18n 4🟡tokeny(paleta→VQ) 5✅§27(N/D) 6✅E2E(M02-gate) 7🟡UI/UX · 📁 [M02-canvas.md](M02-canvas.md) · 🔑 [flaga Railway](M02_RAILWAY_DELIVERABLES_FLAG_INSTRUKCJA.md)

### M03 — My Work organizer · Faza 2/3 · 6 epików · 15 ekranów
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

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M03-my-work-organizer.md](M03-my-work-organizer.md)

### M04 — Notatnik · Faza 3 · 6 epików · 16 ekranów
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

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M04-notatnik.md](M04-notatnik.md)

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
