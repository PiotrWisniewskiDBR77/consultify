# PROMPT DLA NASTĘPNEJ SESJI — grupa DOKUMENTY (do wklejenia)

Skopiuj poniższy blok jako pierwszą wiadomość w nowej sesji:

---

Jesteś sesją roboczą Consultify, kontynuujesz pracę nad grupą DOKUMENTY (Prezentacja/Deck · Word · Excel + ich generatory template'ów). Poprzednia sesja skończyła okno kontekstowe. Właściciel: Piotr — nie-koder, PO POLSKU, krótko, obrazkami; chce żebyś DZIAŁAŁ autonomicznie („decyduj sam, jedź w pętli, nie pytaj co krok"), a jedyne co robisz ZA KAŻDYM RAZEM na świeże „tak" to **deploy na demo**.

**KROK 0 — przeczytaj, zanim cokolwiek zrobisz:**
`Harvard/wdrozenie-100/_HANDOFF_DOKUMENTY_2026-07-22.md` (master, pełny stan) + `_HANDOFF_FALA_A/B/C_*.md` + `_FRAMEWORK_6_NARZEDZI_DOKUMENTY_2026-07-22.md`. Wywołaj skille `consultify-finisz-modulu`, `consultify-promocja-demo`, `consultify-petla`.

**STAN (2026-07-22):**
- Audyt grupy DOKUMENTY zrobiony, naprawa audytu WDROŻONA na demo (gitSha `533d353896`). Werdykt: wejście przez czat (Teresa) było atrapą prawdziwych silników.
- Framework 6 narzędzi (3 narzędzia + 3 generatory template'ów, 5 osi 0–10 PRZED/PO) — ZAAKCEPTOWANY przez Piotra.
- FALA A (merytoryka §0.3) + FALA B (generatory template'ów Excel+Deck) + FALA C (tokeny galerii) — ZBUDOWANE przez agentów i SKONSOLIDOWANE w gałęzi **`integr/dokumenty-fala-abc`** (od origin/demo, 18 plików +1793/−105, esbuild całości + test threeScenarioPnL 17/17 zielone, NIE pushowana). Kolizja Excel A3↔§0.3 rozwiązana (obie zmiany współistnieją).

**TWÓJ NASTĘPNY RUCH:**
1. Zapytaj Piotra o „tak" na **deploy `integr/dokumenty-fala-abc` na demo** (duża partia — zawiera migrację bazy `20260412_seed_business_templates.sql` potrzebną dla „zapisz jako szablon" arkusza). Procedura = skill `consultify-promocja-demo` (merge NIE force, punkt cofania `git rev-parse origin/demo`, monitor przez `curl https://demo.consultify.ai/api/health` aż gitSha=nowy). Runbook w `_HANDOFF_FALA_A_2026-07-22.md`.
2. Po deployu — **weryfikacja LIVE** (treści/wizualu NIE da się offline, brak LLM lokalnie): przez Claude-in-Chrome (sesja Piotra zalogowana na demo.consultify.ai), czat Auto → wygeneruj deck/dokument/arkusz „dla zarządu o pilocie faktur"; sprawdź: deck bez „brak danych", dokument bez „Assumption:" co zdanie, arkusz z groundingiem + „(założenie)"; sprawdź `matchWorkbookTemplate` na „model 3-scenariusze"; round-trip „zapisz jako szablon" arkusza; dev-render galerii (dark+light). Zrzuty before/after → akcept Piotra.
3. Potem: dokończ generatory template'ów FE (Word Template Architect już istnieje — domykać nie budować; klon na Deck/Excel), Fala C reszta. Backlog: `_HANDOFF_FALA_B/C_*.md`.

**TWARDE REGUŁY (nienaruszalne):**
- Baza gałęzi ZAWSZE `origin/demo`. Świeży worktree isolation. NIE pushujesz bez „tak" Piotra. NIGDY force/reset na demo (punkt cofania `a42ee33280` z tej sesji).
- Weryfikuj REALNY RUNTIME, nie docy/flagi — audyty starzeją się w 3 dni (ta sesja złapała 3 nieaktualne zarzuty: Deck ←powrót/prezenter już naprawione 07-19, generator Word MA frontend). Grep realnego callera; flagi bywają fantomami.
- Zmiany promptów są GLOBALNE (dotykają każdej odpowiedzi Teresy) → treść Piotr akceptuje na żywym LLM PRZED „done". Offline: esbuild per plik, testy pure-funkcji; NIGDY pełny tsc/vitest (OOM).
- NIE zmyślaj że coś zweryfikowane — rozróżniaj offline (kod/esbuild/test) vs live (treść/wizual). Metoda: oczekiwanie-vs-wynik na OBEJRZANYM artefakcie.
- Excel: reguła „(założenie)" jest już w prompcie (dodane w tej sesji) — ale ZWERYFIKUJ na żywym LLM że model ją respektuje.
- Test-rekordy na demo do sprzątnięcia (utworzone przy weryfikacji): deck `ac227fdea0` + ~2 dokumenty. NIE kasuj trwale bez zgody Piotra.
- Higiena: modele tanie do mechaniki, Opus/Fable do trudnego kodu; commit-per-krok; nowe testy w `tests/` → `git add -f`. Możesz wypuszczać wielu agentów (Piotr to lubi) — worktree isolation, każdy commituje swoją gałąź, ty recenzujesz i scalasz.

Zacznij od KROK 0 (przeczytaj handoff), potem potwierdź Piotrowi jednym obrazkiem co jest gotowe i zapytaj o deploy.

---
