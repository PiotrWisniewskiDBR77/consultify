# Co zostało z planu — stan 2026-06-03

Mapowanie roadmapy z `docs/audit/2026-06-02/_MASTER_READINESS_REPORT.md` (Fale 0–4) + `CONSULTIFY_WAVE1_MASTER_PLAN.md` na stan faktyczny (branch `feat/wave1-foundations`, 31 commitów).

## ✅ ZROBIONE
- **Fala 0 (higiena/blokery):** debris " 2"/" 3" usunięte · 5 testów api.test naprawione · twarda bramka demo · 5 blokerów P0 (superadmin→/admin, hasło przy usuwaniu konta, migracje, fałszywa karta Stripe→uczciwa) · repo-wide prettier → **CI lint zielony (0)**.
- **Fala 1 (część):** `Admin/shared/Button|Card` → adaptery ✓ · ESLint guardrails ✓ · coming-soon prawie czyste (został 1 route — Meeting).
- **Fala 2:** Records API Tabel + applyProposal ✓ (mod 11) · sekcje Admina zamontowane ✓ (mod 17) · `/wordy`↔`/document-studio` + persystencja ✓ (mod 10) · `/prezentacje` bez bramki + MELS ✓ (mod 12).
- **Fala 3 (komplet):** wszystkie moduły do 98 — 01,02,03,04,05,06,07,08(uczciwy),08b,09,10,11,12,16,17,18,19. IRIS(14)+Marketplace(15) = wyrzucone (decyzja D7).
- **Fala 4 (część):** smoke-testy frontu dodane w każdym module · „ciche 503" → jawne stany w dotkniętych modułach.

## ⏳ ZOSTAŁO

### A. Sesja wizualna X1 — RAZEM (Twoje oko); najwyższa widoczna wartość
- `SplitLayout → ModuleHub`: **18 plików**
- `KimiWorkspaceShell → ExecutiveModuleShell`: **11 plików**
- sweep `slate-* → navy/primary`: **~45 000 wystąpień**
- sweep zahardkodowanych hex: **~1 450**
- ostatni route „coming soon" (Meeting) — do decyzji razem z B

### B. Moduł 13 Meeting — świadomie „później" (decyzja)
- zamontować gotowy `MeetingHub` + fix bug `operatorBrief.meetingId`
- north-star: transkrypcja na żywo + „Teresa na spotkaniu" (własny stack, fazowo)

### C. Domknięcie cross-cutting — mogę SOLO (funkcjonalne, weryfikowalne)
- **X3:** zunifikowany realtime gateway + Teresa voice Phase 2 (po Socket.IO) + presence/collab enable
- **X4:** realny first-run onboarding flow (welcome → rola → sample/Atelier → drzwi wejściowe)
- **X2:** weryfikacja spójności E2E datasetu Atelier (jedna historia transformacji od końca do końca)

### D. Większe inicjatywy techniczne — osobny program
- **Server type-safety:** ~4 543 błędy `tsc` → dopiero potem zdjęcie `--noCheck` z builda (Fala 0, świadomie nietknięte)
- **`@ts-nocheck`:** 202 pliki do redukcji
- głębsze pokrycie testami (ponad smoke) + reszta „cichych 503" w nietkniętych obszarach

### E. Akcje właścicielskie — blokują realne użycie (nie kod), RAZEM
- Railway `GEMINI_LIVE_API_KEY` (głos + prose Teresy)
- uruchomić ~8 nowych migracji + re-seed flag narzędzi
- zablokować prowizję partnerską (15%)
- LLM key dla prose Document Studio
- gdy Stripe: `STRIPE_*_KEY` + `VITE_BILLING_SELF_SERVE=true` + tabele 35 analityk
- flip `ENABLE_TABLE_ARTIFACT_CONVERSION` gdy UI triggera konwersji

### F. Opcjonalny P2 polish (z planów modułów)
- multiplayer collab (decki/whiteboard — wymaga `/ws/presentations` handlera) · rollout optimizer/rebaseline · personalizacja sygnałów Radaru · pełne testy E2E Playwright per ścieżka

## Rekomendacja kolejności
1. **Teraz (solo, w tle Twojej pracy):** C — X3/X4/X2 (funkcjonalne, dowiozę z gatingiem jak moduły).
2. **Razem po Twoim powrocie:** E (podłączenia) → testy E2E → A (sesja wizualna X1).
3. **Później/osobny program:** B (Meeting), D (type-safety serwera).
