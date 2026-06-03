# Consultify — Master Closure Plan (cała aplikacja)

**Single source of truth dla domknięcia całego produktu.** Spina: audyt (`docs/audit/2026-06-02/_MASTER_READINESS_REPORT.md`), decyzje (`CONSULTIFY_PRODUCT_DECISIONS_2026-06-02.md`), pricing (`CONSULTIFY_PRICING_STRATEGY_2026-06-02.md`), plan Wave 1 (`CONSULTIFY_WAVE1_MASTER_PLAN.md`), tracker (`REMAINING_WORK_2026-06-03.md`).
**Branch:** `feat/wave1-foundations` · **Ostatnia akt.:** 2026-06-03 · **Definicja gotowości:** D20 (98/100, zero placeholderów w ścieżce płatnej, jeden shell, backend-wired, smoke-test, EN+PL, spójne tokeny).

---

## 1. Status modułów (19) — gdzie jesteśmy

| # | Moduł | Audyt (start) | Teraz | Uwaga |
|---|---|:--:|:--:|---|
| 01 | Czat / Teresa | 68 | **98** ✓ | voice foundation; live głos czeka na klucz Railway |
| 02 | Moja Praca | 57 | **98** ✓ | notatnik L1 + Process Flow persystencja |
| 03 | Wywiad | 72 | **98** ✓ | AI quality gate, realne bulk-akcje |
| 04 | Narzędzia | 52 | **98** ✓ | 14 ship / 17 ukrytych czysto |
| 05 | Inicjatywy | 58 | **98** ✓ | realny ROI view, generator odblokowany |
| 06 | Realizacja | 52 | **98** ✓ | rollout scalony + persystencja |
| 07 | Rezultaty | 52 | **98** ✓ | bramki finalizacji + ROI lock |
| 08 | Finanse (billing) | 42 | **98 (uczciwy)** ✓ | bez fałszywych płatności; live Stripe odłożony (D8) |
| 08b | Model finansowy | — | **98** ✓ | ścieżka wejścia (modelowanie, nie billing) |
| 09 | Outputs | 62 | **98** ✓ | approval-gate, Teresa→Outputs |
| 10 | Dokumenty (Doc Studio) | 52 | **98** ✓ | Wave 2; persystencja, prose LLM, figury PDF |
| 11 | Tabele (Table Studio) | 42 | **98** ✓ | Wave 2; records API ON, realne mutacje AI |
| 12 | Prezentacje (Deck) | 62 | **98** ✓ | Wave 2; self-serve, wersje, MELS, PNG |
| 16 | Organizacja | 68 | **98** ✓ | żywy org-context zasila Teresę |
| 17 | Panel Admina | 38 | **98** ✓ | 5 sekcji, manualny billing (plan/limity) |
| 18 | Ustawienia | 72 | **98** ✓ | AI-settings fallback, uczciwy push |
| 19 | Portal Partnerski | 48 | **98 (MVP)** ✓ | rejestracja→link→atrybucja→dashboard |
| 13 | Meeting | 28 | **ZOSTAŁO** ⏳ | „później"; MeetingHub gotowy, niezamontowany |
| 14 | MCP IRIS | 22 | **WYRZUCONE** | decyzja D7 |
| 15 | MCP Marketplace | 14 | **WYRZUCONE** | decyzja D7 |

**Wynik: 17/17 modułów w zakresie na 98.** Poza zakresem: 13 (później), 14+15 (wyrzucone).

---

## 2. Strumienie przekrojowe (X1–X5)

| | Stan | Co zostało |
|---|---|---|
| **X1 Design System** | 🟡 tokeny/prymitywy/ESLint/fork ✓ | **shell-e (18 SplitLayout + 11 Kimi), slate→navy (~45k), hex (~1450)** → sesja wizualna RAZEM |
| **X2 Demo/Atelier** | 🟡 bramka + seed domen ✓ | weryfikacja spójności E2E jednej historii |
| **X3 Realtime/Voice** | 🟡 namespaces + voice Phase 1 ✓ | zunifikowany gateway + voice Phase 2 + presence |
| **X4 Onboarding/i18n** | 🟡 P0 fixy + i18n modułowe ✓ | realny first-run onboarding flow |
| **X5 Higiena/P0** | ✅ kompletne | (debris, security, lint zielony) |

---

## 3. Dług techniczny (osobny program)
- **Server type-safety:** ~4 543 błędy `tsc` (wzorzec overloadów Express) → tolerowane przez `--noCheck`; dopiero po naprawie można zdjąć `--noCheck`.
- **`@ts-nocheck`:** 202 pliki (głównie serwer — sensowne dopiero po wyżej; front można redukować od razu).
- Głębsze pokrycie testami (ponad smoke) + reszta „cichych 503" w nietkniętych obszarach.

---

## 4. Akcje właścicielskie (blokują realne użycie — nie kod)
1. Railway `GEMINI_LIVE_API_KEY` → głos + prose Teresy.
2. Uruchomić ~8 nowych migracji + re-seed flag narzędzi (`is_coming_soon`).
3. Zablokować prowizję partnerską (domyślnie 15%, próg 100 €) przed publikacją cennika.
4. LLM key dla prose Document Studio.
5. Gdy Stripe: `STRIPE_*_KEY` + `VITE_BILLING_SELF_SERVE=true` + tabele 35 analityk billingowych.
6. Flip `ENABLE_TABLE_ARTIFACT_CONVERSION` gdy powstanie UI triggera.

---

## 5. Plan domknięcia — sekwencja do GA

### Faza I — Cross-cutting completion (SOLO, w toku)
- [ ] **X3** zunifikowany realtime gateway + Teresa voice Phase 2 (po Socket.IO) + presence/collab enable
- [ ] **X4** realny first-run onboarding (welcome → rola → sample/Atelier → drzwi wejściowe)
- [ ] **X2** weryfikacja spójności E2E datasetu Atelier (jedna historia transformacji)

### Faza II — Moduł 13 Meeting (SOLO, tanio)
- [ ] Zamontować gotowy `MeetingHub` na `/meeting` + fix bug `operatorBrief.meetingId` + CRUD widoczny
- [ ] (north-star fazowo: transkrypcja na żywo, Teresa-na-spotkaniu — własny stack)

### Faza III — Type-safety frontu (SOLO, bezpieczne)
- [ ] Redukcja `@ts-nocheck` we froncie (utrzymując tsc=0); serwer dopiero po programie type-safety

### Faza IV — RAZEM (potrzebuję właściciela)
- [ ] **E. Podłączenia** (klucze, migracje, flagi) → **testy E2E na Atelier** → **A. sesja wizualna X1** (shell-e + tokeny, z Twoim okiem)

### Faza V — Później / osobny program
- [ ] Server type-safety (4.5k błędów) → zdjęcie `--noCheck`
- [ ] P2 polish: multiplayer collab, rollout optimizer/rebaseline, pełne E2E Playwright
- [ ] Faza sprzedażowa: live Stripe self-serve, moduły wyrzucone (IRIS/Marketplace) gdy strategia kanału

---

## 6. Definition of Done dla całej aplikacji (GA)
Każdy moduł w zakresie: działa end-to-end na Atelier Toys · zero placeholderów w ścieżce płatnej · jeden spójny shell · backend-wired (brak cichych 503) · smoke-test · EN+PL · spójne tokeny (po sesji X1) · podłączone klucze/migracje · przejście golden-path z głosem Teresy.

**Bramki pozostałe do GA:** Faza I (solo) + Faza IV (razem). Faza V to post-GA / sprzedaż.
