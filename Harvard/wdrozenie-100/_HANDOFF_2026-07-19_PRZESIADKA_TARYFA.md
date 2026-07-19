# HANDOFF 2026-07-19 — przesiadka na drugi plan taryfowy

> **Cel dokumentu:** ciągłość bez utraty kontekstu przy zmianie planu/sesji. Nowa sesja
> START = przeczytaj `_REJESTR_DOKONCZENIA.md` (SSOT, liczniki + fale) + ten handoff.

## STAN NA TERAZ (po W9 — FINAŁ sesji)
- **Demo tip / demo-safe-2026-07-19 = `da3fb86381`** (rejestr W9; kod `38eda846ab`). Wszystkie **10 deployów** sesji boot-zielone.
- **Postęp: 183/304 rozstrzygnięte (60%)** — start sesji 120/265 (45%). Liczniki w rejestrze §LICZNIKI.
- **Kodowalny backlog WYCZERPANY** — red-final trafił rewir czysty, fail-soft 166→1. Dalej = Piotr-gated (SESJA#1/decyzje/Vegas) + chipy.
- **PROD (Londyn / centerbeam) NIETKNIĘTE.** Wszystko szło na demo (TROLLEY-shared staging).

## CO ZROBIONE W SESJI (fale W2b→W9)
Silniki/mechanika Harvard/Harvey/Oxford dowiedzione E2E; ~50 realnych 500-tek produkcyjnych naprawionych
(klasa: legacy migracje 3-cyfrowe/`.sql.sql` nie odpalają — regex autorun `/^(7\d{2}|\d{8})_/`);
długi systemowe domknięte: **adaptQuery** (quote-aware `?` + finding DDL-mangle `*_update()`), **657 aliasów SQL**,
**B13 baseline_gap** (fresh-env==TROLLEY, 33k linii), DecisionController korupcja danych, DOC-1 „dokument z czatu",
**axis_data guard** (>100% w raporcie klienta niemożliwe), Oxford proof-sweep O1/O2/O4/O7/O8.
Decyzje Piotra 07-19: O2.1 CONCLUSION_LAYER ✅ · O7.1 karty=twarda-brama ✅ · B13 wdrożone · SESJA#1 materiały gotowe.

## PROTOKÓŁ INTEGRACJI (jak domykać kolejne fale — sprawdzony 9× w tej sesji)
1. `git worktree add -b integrate-wN <scratchpad>/wt-integrate-wN origin/demo` + symlink node_modules root+server.
2. `git merge --no-edit <gałąź>` każdą gotową gałąź (robotnicy commitują na worktree, NIE push).
3. Konflikty rzadkie (rozłączne rewiry) — przy aliasach bierz `--ours` (identyczny fix). 
4. BRAMKI (wszystkie muszą przejść): server `tsc` = **baseline 146/204, 0-nowych** · FE `tsc` EXIT=0 · `node scripts/check-hardcoded-colors.cjs` PASS · `bash scripts/check-artefakt.sh` PASS · `bash scripts/check-list-canon.sh <zmienione .tsx>` PASS · eslint `--fix` na zmienionych → 0 errors.
5. `git push origin HEAD:demo` (jawny refspec).
6. BOOT-POLL: `curl -A "consultify-health/1.0" https://demo.consultify.ai/api/health` → 4× kolejne 200 (6× dla dużych migracji) + 40-60s stabilność.
7. Re-tag: `git tag -f demo-safe-2026-07-19 <sha> && git push -f origin demo-safe-2026-07-19`.
8. Update `_REJESTR_DOKONCZENIA.md` (blok FALA-wN + przelicz LICZNIKI) → commit+push na demo → sync główny checkout (`git show origin/demo:...rejestr > <główny>`).

Env robotnika (parity :5443): `DATABASE_URL=postgres://consultinity:consultinity@localhost:5443/consultinity NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=true JWT_SECRET=development_secret_key_change_in_production_abc123xyz` (+ANTHROPIC_API_KEY z .env.staging.local dla LLM).

## GAŁĘZIE GOTOWE / W TOKU (do zebrania w nowej sesji)
- **W9 — WDROŻONE** (`da3fb86381`): failsoft-batch6, red-final, sweep-silent-degr już na demo. Nic do harvestu.
- **6 chipów Piotra (osobne sesje, sprawdzić czy dostarczyły gałąź):** initiative-batches INSERT org_id · conversations.context-os 500 · TaskService.createTask · notification_outbox drain · risk_register · normalizeBaseUrl(/v1). Jak gotowe → harvest jak każdą gałąź (protokół wyżej). To JEDYNE otwarte gałęzie kodu.

## CO ZOSTAJE (39% — NIE „więcej kodu ode mnie")
1. **SESJA#1 (Piotr, 2-3h) — NAJWYŻSZA DŹWIGNIA.** Materiał: `_SESJA1_ODBIOR_OXFORD.md`. Odblokowuje ~30-40 pozycji Oxford (O1/O3/O5/O6 czekają na odbiór, nie na kod). Po odbiorze → flip 🟡→✅ w rejestrze.
2. **Decyzje 🔵 (14):** DRD Kanon P1-P5 (K1) · K3 39 śmieci · K4 sekcje-bez-AI · K5 SWOT×3/PPTX×3 · K6 profile · K7 179 orgs · 6 martwych buildDeepen (usunąć/zbudować UI). Rekomendacje w `_SESJA1_ODBIOR_OXFORD.md` §3.
3. **Vegas (34 poz., sekcja D)** — CAŁY wygląd, świadomie ostatni. Tryb: prototyp→OK→JA renderuję zrzut (harness/dev-render, mock-dane, bez logowania Piotra)→zrzut czysty→Piotr akceptuje (reguła #7: Piotr NIGDY pierwszym testerem wizualnym). Flaga OFF do akceptu.
4. **ENV Railway (Piotr, E1-E5):** DELIVERABLES_LIGHT+VITE_ (guard demo≠centerbeam) · RECONCILE_ENFORCE=enforce · EFFECTIVE_ACCESS_ENFORCE=true · CAPABILITY_ENFORCE=enforce · CARD_CONTENT_HARD_GATE (default ON — zawór do wyłączenia gdyby fałszywie blokował) · DEMO_CLEANUP_ENABLED (default OFF, włączyć po obejrzeniu logów dry-run) · storage/TERESA_*/OAuth.
5. **Kalendarz twardy:** 📅 ELKOMTECH ≤03.08 (PROD, per-zgoda) · audyt ISO 04.08 · cert „Certified" ~10.08.

## OTWARTE RED (⬜, udokumentowane z dowodem — do domknięcia falami)
- ~43→(W9) gołych `res.status(500).json({error:err.message})` (fail-soft batch6 domyka).
- Systemowe do DECYZJI: `DbPromise fallback=true` maskuje każdy schema-500 jako cichy 404/pustkę (dlatego bugi żyły niezauważone — rozważ fail-loud w dev).
- Prod-check: `normalizeBaseUrl` — jeśli baza prod trzyma `.../v1/messages` → 404 wszystkich callów LLM (chip; demo OK).
- assessment: deprecated `assessment-workflow` naprawiony; brakujące tabele dodane; zostają pomniejsze (permissions role_id — naprawione W7).
- 6 martwych `buildXDeepenPrompt` (🔵), `interviewInsightReportPackService` reportPath-hard (opcjonalny gate).

## NIENARUSZALNE (z CLAUDE.md + memory)
demo=święte (merge nie force, poza re-tag) · PROD Londyn/centerbeam per-zgoda · Vegas=wygląd na końcu ·
Piotr nigdy pierwszym testerem wizualnym · weryfikuj REALNY runtime (nie flagi/docy) · baza gałęzi ZAWSZE origin/demo.
