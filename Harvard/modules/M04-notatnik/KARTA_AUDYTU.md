# M04 — Notatnik — Karta audytu (Protokół V1)

**Data:** YYYY-MM-DD · **Branch:** `<branch>` (commit `<sha>`) · **Audytor:** Claude + agenci (KOD/TESTY/KANON+SEC)
**Wejścia:** _MODULE_MAP_V2 wpis M04 · inwentarz `Harvard/podzial/inventory/INV_B_my-work.md` · poprzednia karta `<link>` · plany `<linki>`
**Evidence:** `docs/audit/<data>/<modul>/evidence/`

## OCENA: __/100 — Tier: <GA-ready | Beta | Alpha | Broken> <· „NIEPEŁNY (bez Fazy 4)" jeśli dotyczy>

| Wymiar | Waga | Punkty | Uzasadnienie (1 zdanie) |
|---|---|---|---|
| A. Realność funkcji | 25 | __ | |
| B. Wiring i dane | 15 | __ | |
| C. Testy automatyczne | 15 | __ | |
| D. Żywa użyteczność | 15 | __ | |
| E. Kanony/UI | 10 | __ | |
| F. Bezpieczeństwo/dostęp | 10 | __ | |
| G. Środowiska (Railway) | 10 | __ | |
| **Hard cap zastosowany?** | — | — | <nie / jaki i dlaczego> |

**Werdykt jednym akapitem:** <co jest mocne, co łamie zaufanie, co blokuje tier wyżej>

---

## 0. Zakres i scenariusze krytyczne (FAZA 0)
**Checklist pozycji inwentarza:** N pozycji (z INV) + M nowych (git log od <data inwentarza>).
**Scenariusze krytyczne (3–7):**
1. S1: <happy path E2E — kroki>
2. S2: …
**Obowiązujące kanony:** <§27 dla tabel: które | CARD_CONTENT_FORMULA: tak/nie | ModuleHub/MELS | beta-gating>

## 1. Prawda kodu (FAZA 1)
### 1a. REALNE (zweryfikowane)
- … `plik:linia`
### 1b. MOCK / STUB / fabrykowane klientem
- … `plik:linia`
### 1c. ZEPSUTE / WIDOCZNE-ALE-ZEPSUTE
- … `plik:linia`
### 1d. UKRYTE / MARTWY KOD
- … `plik:linia` → rekomendacja: <wytnij | wepnij | zostaw świadomie>
### 1e. Wiring FE↔BE↔DB
| Funkcja | Endpoint | Tabela DB | Migracja | Status |
|---|---|---|---|---|
### 1f. Flagi
| Flaga | Default BE (komentarz vs runtime) | Default FE | Kto włącza | Wpływ |
|---|---|---|---|---|

### 1g. Połączenia międzymodułowe (zasila Krok 6 sekwencji — INTEGRACJE.md)
| Kierunek | Moduł po drugiej stronie | Mechanizm (event / API / registry / konwersja / deep-link / handoff czatu) | Plik:linia | Status (DZIAŁA/ZEPSUTE/STUB) |
|---|---|---|---|---|
| WEJŚCIE ← | | | | |
| WYJŚCIE → | | | | |

## 2. Testy automatyczne (FAZA 2)
**Uruchomienie:** `<komenda>` @ `<sha>` → **PASS __ / FAIL __ / SKIP __** (log: evidence/f2_tests.log)
| Plik testu | Zakres | Liczba | Wynik | W CI? |
|---|---|---|---|---|
**Pokrycie scenariuszy krytycznych:**
| Scenariusz | FE | BE | E2E | CI | Luka |
|---|---|---|---|---|---|
**Backlog testowy (→ plan dokończenia):**
1. [P_] <typ> — <plik docelowy> — <scenariusz>

## 3. Środowiska / Railway (FAZA 3)
| Aspekt | Staging | Prod | Werdykt |
|---|---|---|---|
| Wdrożony commit | | | |
| Migracje modułu zastosowane | | | |
| Flagi/env wymagane | | | |
| Smoke endpointów (lista+kody) | | | |
| Błędy w logach (24–48 h) | | | |
**Dowody:** evidence/f3_*.txt

## 4. Żywa weryfikacja frontu (FAZA 4 — Claude osobiście)
**Środowisko:** <preview localhost / staging> · **Konto/rola:** <…>
| # | Scenariusz | Wynik | Dowód |
|---|---|---|---|
| S1 | | PASS/FAIL/BLOCKED | evidence/f4_s1_*.png |
**Przyciski-zawsze-błąd znalezione:** <lista albo „brak">
**Stany (pusty/loading/błąd/overflow):** <wyniki>
**i18n PL↔EN:** <wyniki> · **Konsola/sieć:** <czysto / lista błędów> · **Role (member/pilot):** <wyniki> · **Skróty:** <wyniki>

## 5. Kanony i standardy (FAZA 5)
**§27 TABLE_AND_PREVIEW_CANON:**
| Tabela/powierzchnia | A | B | C | … | S | Odstępstwa |
|---|---|---|---|---|---|---|
**CARD_CONTENT_FORMULA (próbka ≥5):** <wynik walidatorów / n.d.>
**Wzorzec hubowy (ModuleHub/MELS):** <zgodny / odstępstwa>
**UI-standards / i18n / beta-plate / stany standardowe:** <wyniki>

## 6. Bezpieczeństwo i dostęp (FAZA 6)
| Warstwa | Nawigacja | Route | API | Dziura? |
|---|---|---|---|---|
**Org-scope:** <wynik przeglądu endpointów> · **Zasoby publiczne:** <wynik> · **WS/realtime:** <wynik / n.d.> · **Capabilities serwerowo:** <wynik>
**Findingi:** [P0] … · [P1] … · [P2] …

## 7. PLAN DOKOŃCZENIA (FAZA 8)
### Fala 1 — Integralność (P0)
1. **<co>** — <dlaczego, 1 zdanie z dowodem> — Weryfikacja: <test/screenshot>
### Fala 2 — Domknięcie wartości (P1)
### Fala 3 — Jakość i kanony (P2)

### Definition of Done (odhaczane przy realizacji)
- [ ] 1. Testy auto FE+BE scenariuszy krytycznych zielone w CI
- [ ] 2. Żywa weryfikacja Claude'a: pełny skrypt Fazy 4 PASS z dowodami
- [ ] 3. Railway: migracje + flagi + smoke 200 + czyste logi
- [ ] 4. Kanony: checklisty Fazy 5 bez odstępstw P0/P1
- [ ] 5. Zero WIDOCZNE-ALE-ZEPSUTE
- [ ] 6. Zero cichych degradacji bez komunikatu
