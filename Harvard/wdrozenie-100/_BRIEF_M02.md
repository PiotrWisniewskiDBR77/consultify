# BRIEF AGENTA — M02 Canvas (dokończenie do 100%)

> Wklej to jako pierwszą wiadomość do świeżego czata. Agent łapie kontekst **tylko M02**.

## Twoja rola i cel
Jesteś agentem-wykonawcą **jednego modułu: M02 Canvas** (split-view w czacie + deliverables-light: doc/sheet/deck; viewer publiczny `/public/artifacts/:token`). Doprowadzasz go do stanu **🟢 GOTOWY DO ODBIORU**: 6 bramek realizacji zrobione z dowodami (Epiki N/N, DoD 7/7, Testy, UI). Dwa odbiory końcowe (funkcja + UI/grafik) robi Piotr — ty przygotowujesz moduł i dowody, **nie zamykasz sam**. Nie dotykasz innych modułów.

## Repo i źródła prawdy (przeczytaj NAJPIERW, w tej kolejności)
- Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify` · branch **Londyn**
- **Teczka modułu:** `Harvard/wdrozenie-100/M02-canvas.md` — czytaj W CAŁOŚCI (rejestr luk L-XX, epiki, DoD, decyzje, inwentarz ekranów).
- **Spec testów manualnych E2E:** `Harvard/Testy manualne/TESTY_M02_CANVAS.md` — **20 scenariuszy**.
- **Instrukcja flagi Railway:** `Harvard/wdrozenie-100/M02_RAILWAY_DELIVERABLES_FLAG_INSTRUKCJA.md`.
- **Werdykt weryfikacji kodu 2026-06-19:** `Harvard/wdrozenie-100/_WERYFIKACJA_DOKUMENTACJI_2026-06-19.md` (M02 = SOLID, najsilniejszy moduł, 0× P0/P1).
- **Tracker odbiorów (wpisuj postęp M02):** `Harvard/wdrozenie-100/_STAN_PRACY_ODBIORY.md`.

## Stan wejściowy M02 (zweryfikowany 2026-06-19 — nie zgaduj, potwierdź w kodzie)
- **Najsilniejszy moduł, 0× P0/P1.** Zweryfikowane w kodzie: L-08 (9/9 capabilities serwerowo w `work-canvas.routes.ts`), L-06 (`regenerateSlide` realny, nie stub — `presentationGeneratorService.ts:1660`), L-05 (generate→400 zamiast cichego decka — `deliverablesGenerations.routes.ts:167-173`), L-15 (test cross-org istnieje).
- **Otwarte luki:**
  - **L-01** — dwa silniki artefaktów (store ↔ panel), ODROCZONA Fala 3 BETA, czeka na decyzję D-01. Rozstrzygnij/zaproponuj konsolidację albo potwierdź odroczenie z uzasadnieniem.
  - **L-03** — Tryb A (function-calling runtime auto-korekta): guard+lock zrobione, **wiring function-call = Fala 2** (do domknięcia). Sprawdź realny stan: `generate_deliverable` tool → SSE `deliverable` → montaż canvasa.
  - **L-07** — picker `sourceRefs` wymaga backendu B-1 (FE-only = no-op). Domknij lub jawnie odrocz.
- **⚠ DEBLOKER ŻYWY (krytyczny dla odbioru):** kod triady deck/doc/sheet jest gotowy, ale **`VITE_ENABLE_DELIVERABLES_LIGHT` (build-time FE) + `ENABLE_DELIVERABLES_LIGHT` (runtime BE) MUSZĄ być ustawione na Railway demo** — bez tego Canvas wygląda jakby „nigdy nie działał" (to jest root-cause „never worked" na staging/prod). Ustawienie env = Piotr (zgłoś jako bloker odbioru, nie ustawiaj sam).
- **Kluczowe pliki:** `src/components/AIChat/WorkCanvasDocumentPanel.tsx`, `src/components/AIChat/CanvasArtifactSwitcher.tsx`, `server/src/routes/work-canvas.routes.ts`, `server/src/routes/deliverablesGenerations.routes.ts`, `server/src/services/.../presentationGeneratorService.ts`, store `useArtifactsStore`.
- ⚠ **PLIKI WSPÓLNE Z M01** (jeśli M01 robi inny agent równolegle): `UnifiedChatPanel.tsx`, `WorkCanvasDocumentPanel.tsx`. Edytuj ostrożnie, commituj często jawnymi ścieżkami, `git log -1` przed założeniem stanu. Konflikty zgłoś orchestratorowi.

## Procedura dokończenia (wykonaj po kolei, odhaczaj bramki)
1. **Kod** — domknij L-03 (Tryb A function-call wiring) + L-07 (sourceRefs albo jawne odroczenie) + rozstrzygnij L-01 (D-01). Weryfikuj w kodzie, nie zgaduj.
2. **DoD 7/7** — 1) front↔back · 2) bezpieczeństwo (capabilities 9/9 + cross-org test) · 3) i18n PL/EN przez `t()` · 4) tokeny (zero „rose"/hex) · 5) §27 (canvas — potwierdź zakres) · 6) E2E w PR-gate · 7) zgodność UI/UX (canon).
3. **Epiki** — wszystkie epiki sekcji F teczki (6 epików), każdy zielony z dowodem.
4. **Testy** — wykonaj **20 scenariuszy** z `TESTY_M02_CANVAS.md` na żywo (E2E: UI + payload Network + stan store/DB; dowód = screenshot + payload). Kluczowe: handoff czat→canvas, generacja triady, autosave-persist po reload, viewer publiczny, capability-gates. Uruchom/dołóż automaty w `tests/` (CI puszcza tylko `tests/unit|integration|components` — NIE `src/**/__tests__`). **Uwaga:** pełny E2E triady wymaga flagi Railway (wyżej) — jeśli niedostępna, testuj lokalnie z `.env.local` i zgłoś że żywy odbiór czeka na env demo.
5. **Zgodność UI/UX** — komponenty M02 vs SSOT canon, napraw odstępstwa P0/P1; a11y/dark-mode.
6. **Commit na Londyn** (jawne ścieżki). **Deploy na demo NIE rób sam** — koordynuje orchestrator. Zgłoś gotowość + przypomnij o fladze Railway.

## Twarde zasady
- Nie dotykaj innych modułów ani wspólnej warstwy bez odnotowania.
- **NIGDY `git add -A` / `git add .`** — tylko jawne ścieżki.
- **prod = centerbeam:** zero zmian na prod bez osobnej zgody Piotra. Pracujesz Londyn → demo.
- **Sekrety/klucze/env (w tym flagi Railway):** nie ustawiasz; robi Piotr. Zgłaszasz jako blokery.
- **Każda zmiana UI:** zweryfikuj w preview/na demo, dowód = screenshot. Nigdy „done" na samym `tsc`.
- Weryfikuj zanim ogłosisz zrobione — żadnych deklaracji bez dowodu.

## Co zwracasz (raport odbioru do orchestratora)
- Stan 6 bramek: **Epiki x/6 · DoD x/7 · Testy x/20 (+automaty) · UI ✅/🟡** z dowodem per pozycja.
- Co zrobione, co zostało, ryzyka/blokery wymagające Piotra (przede wszystkim flaga Railway demo + ew. backend B-1).
- Końcowy status: **🟢 GOTOWY DO ODBIORU** (etapy 1–6 ✅) albo precyzyjna lista czego brakuje.
- Zaktualizuj wiersz M02 w `_STAN_PRACY_ODBIORY.md`.
