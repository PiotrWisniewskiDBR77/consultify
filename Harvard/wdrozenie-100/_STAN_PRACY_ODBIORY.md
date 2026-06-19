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

- ⬜ **Triaż 49 untracked plików** (build-integrity, `git archive` → próbny build) — żeby egzekucja nie stała na zatrutym working-tree. *(robi Claude)*
- ⬜ **Odblokowania env/konta** *(Piotr; prod=centerbeam za jawną zgodą)*:
  - ⬜ Klucz Gemini na demo (M10 głos/STT live-verify)
  - ⬜ Flaga `VITE_ENABLE_DELIVERABLES_LIGHT` na Railway (M02 Canvas)
  - ⬜ Konto superadmin na demo (M27 live RBAC)
  - ⬜ Schema partnera na prod (M26 — przed otwarciem portalu)
  - ⬜ OAuth env kalendarza (M03 — Google/Microsoft client id/secret)

---

## Tabela zbiorcza

| # | Moduł | Faza | Epiki | Ekrany | Status | Funkcja | UI |
|---|---|---|:--:|:--:|---|:--:|:--:|
| M01 | Czat | 2 | 5 | 20 | ⬜ NIE ROZPOCZĘTY | ⬜ | ⬜ |
| M02 | Canvas | 3 | 6 | 16 | ⬜ | ⬜ | ⬜ |
| M03 | My Work — organizer | 2/3 | 6 | 15 | ⬜ | ⬜ | ⬜ |
| M04 | Notatnik | 3 | 6 | 16 | ⬜ | ⬜ | ⬜ |
| M05 | Ideas — Zarządzanie | 1 | 7 | 11 | ⬜ | ⬜ | ⬜ |
| M06 | Ideas — Mind Map | 1/3 | 7 | 16 | ⬜ | ⬜ | ⬜ |
| M07 | Ideas — Process Flow | 1/3 | 6 | 12 | ⬜ | ⬜ | ⬜ |
| M08 | Ideas — Table | 3/4 | 5 | 17 | ⬜ | ⬜ | ⬜ |
| M09 | Ideas — Whiteboard | 1 | 6 | 11 | ⬜ | ⬜ | ⬜ |
| M10 | Wywiad | 1 | 6 | 28 | ⬜ | ⬜ | ⬜ |
| M12 | Audyty | 3 | 5 | 7 | ⬜ | ⬜ | ⬜ |
| M13 | Inicjatywy | 2 | 6 | 30 | ⬜ | ⬜ | ⬜ |
| M14 | Wdrożenie | 2/4 | 6 | 18 | ⬜ | ⬜ | ⬜ |
| M15 | Rezultaty | 2 | 6 | 17 | ⬜ | ⬜ | ⬜ |
| M16 | Finanse | 2 | 5 | 22 | ⬜ | ⬜ | ⬜ |
| M17 | Outputs | 3 | 4 | 11 | ⬜ | ⬜ | ⬜ |
| M18 | Dokumenty | 1 | 6 | 7 | ⬜ | ⬜ | ⬜ |
| M19 | Prezentacje | 3/4 | 4 | 21 | ⬜ | ⬜ | ⬜ |
| M20 | Tabele Studio | 1 | 4 | 13 | ⬜ | ⬜ | ⬜ |
| M21 | Meeting | 3/4 | 4 | 8 | ⬜ | ⬜ | ⬜ |
| M22 | AI OS | 1 | 5 | 9 | ⬜ | ⬜ | ⬜ |
| M23 | Organizacja | 1 | 5 | 6 | ⬜ | ⬜ | ⬜ |
| M24 | Admin | 3 | 6 | 5 | ⬜ | ⬜ | ⬜ |
| M25 | Ustawienia | 2/3 | 5 | 7 | ⬜ | ⬜ | ⬜ |
| M26 | Portal Partnerski | 4 | 5 | 18 | ⬜ | ⬜ | ⬜ |
| M27 | SuperAdmin | 3 | 5 | 60 | ⬜ | ⬜ | ⬜ |
| A1 | Affiliate (descoped) | — | 0 | 0 | ⬜ | ⬜ | ⬜ |

**Postęp programu:** 0 / 27 zamkniętych.

---

## Odbiory szczegółowe (moduł po module)

> Każdy moduł: 8 etapów + linia DoD. Odhaczamy `⬜→✅`, wpisujemy datę/kto przy odbiorach 7–8.

### M01 — Czat · Faza 2 · 5 epików · 20 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór (data / kto) |
|---|---|:--:|---|
| 1 | Kod — luki funkcjonalne/security domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/5 | ⬜ | |
| 4 | Testy unit+E2E zielone | ⬜ | |
| 5 | Zgodność UI/UX (kryt. 7) | ⬜ | |
| 6 | Deploy na demo | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **MODUŁ ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜front↔back 2⬜security 3⬜i18n 4⬜tokeny 5⬜§27(N/D) 6⬜E2E 7⬜UI/UX · 📁 [M01-czat.md](M01-czat.md)

### M02 — Canvas · Faza 3 · 6 epików · 16 ekranów
**Status:** ⬜ NIE ROZPOCZĘTY

| # | Etap | ✓ | Odbiór |
|---|---|:--:|---|
| 1 | Kod — luki domknięte | ⬜ | |
| 2 | DoD 7/7 | ⬜ | |
| 3 | Epiki 0/6 | ⬜ | |
| 4 | Testy | ⬜ | |
| 5 | Zgodność UI/UX | ⬜ | |
| 6 | Deploy demo (⚠ wymaga flagi `VITE_ENABLE_DELIVERABLES_LIGHT`) | ⬜ | |
| 7 | **ODBIÓR FUNKCJA — Piotr** | ⬜ | |
| 8 | **ODBIÓR UI/grafik — audytor + Piotr** | ⬜ | |
| ✔ | **ZAMKNIĘTY (8/8)** | ⬜ | |

DoD: 1⬜ 2⬜ 3⬜ 4⬜ 5⬜ 6⬜ 7⬜ · 📁 [M02-canvas.md](M02-canvas.md)

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
