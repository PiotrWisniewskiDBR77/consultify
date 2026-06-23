# NOCNY RUN — HANDOFF dla następnego agenta: pełne przejście M5–M9 (narzędzia + praca z kontekstem)

> **Ten plik jest samowystarczalny.** Masz tu CAŁY kontekst, środowisko, inwentarz case'ów, wzorce naprawcze i dokładny plan. Repo: `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`. Branch: `feat/deliverables-w1`. Właściciel: **Piotr** (product, na konferencji sprzedaje ten soft). **Ty = CTO** — cała inżynieria + decyzje. Komunikacja PL. Data handoffu: 2026-06-23.

---

## 0. CEL NOCNEGO RUNU (czego chce Piotr — dosłownie)

Pełne, autonomiczne potwierdzenie, że **CAŁA pula Ideas M05–M09 działa** — nie tylko narzędzia canvasa, ale **praca z kontekstem**: wszystkie przejścia, cała nawigacja, wszystkie wymogi graficzne, wszystkie wymogi dokumentacyjne. **A jeżeli coś nie działa — automaty fix-until-green to naprawiają.** Preferencja Piotra: **Playwright w chmurze na demo.consultify.ai** (publiczny deploy, ten który sprzedaje), ze screenshotami jako dowód.

Definicja „done": każdy case M05–M09 = **green** (realny dowód: DOM/Network/DB + screenshot) **albo honest-skip z dowodem `file:line`** (rzeczy headless-niesterowalne / env-gated). **Honest-skip ≠ fałszywy green — to żelazna zasada** (testy lecą u klientów VTS/Apator/Elkomtech; fałszywy zielony = kłamstwo). Na koniec: zaktualizowane plansze, raport, tracker, DoD/epiki/manual.

---

## 1. STAN OBECNY (co już zrobione i ZACOMMITOWANE — nie powtarzaj)

**Automaty Playwright 120 case'ów (CASES_M0X), pula Ideas:**
- M06 Mind Map: **23–26/30 pass / 0 fail** · M07 Process Flow: **27–30/31 pass / 0 fail** · M08 Table: **29/30 pass / 0 fail** · M09 Whiteboard: **27–29/30 pass / 0 fail**. Łącznie **~108–115/121 zielonych, 0 czerwonych**, reszta = honest-skip. (Wahania bo caboose bywał przeciążony — w nocy stabilny → wyższe liczby.)
- Specy: `tests/e2e/cases/m06-cases.spec.ts`, `m07-cases.spec.ts`, `m08-cases.spec.ts`, `m09-cases.spec.ts` + helpery `_m07-helpers.ts`, `tests/e2e/smoke/m09-whiteboard-helpers.ts`, `tests/e2e/m06/_m06.ts`.
- Plansze (PIL, 30 miniatur/moduł): `python3 tests/e2e/_helpers/montage_cases.py m0X` → `tests/e2e/screenshots/cases/_montage_m0X.png`.

**2 REALNE BUGI PRODUKTU naprawione (commitnięte na main):**
1. `06326decfe` — **staging AI był całkowicie zepsuty** dla generacji strukturalnej: `@ai-sdk/openai` v3 + `ai` v6 `generateObject` wymusza OpenAI STRICT json_schema, które odrzuca KAŻDY schemat z polem `.optional()` (strict wymaga wszystkich pól w `required`) → 400 „Invalid schema for response_format" → „Provider returned error". Klucz OpenRouter był OK ($190 kredytów). Fix w `server/src/services/ai/llmService.ts` (callStructured): dla openrouter/ollama omija generateObject — `generateText` + opis JSON-Schema w prompcie (`asSchema().jsonSchema`) + parse + walidacja Zod. **Zweryfikowane lokalnie HTTP 200.** UWAGA: na **demo.consultify.ai AI i tak działa** (inny deploy/config — zweryfikowane: ai-suggestions/ai-generate/map/expand wszystkie 200 z realną treścią). Fix dotyczy lokalnego caboose-backendu i prod gdy zdeployujesz (za zgodą Piotra).
2. `ffa318ed1a` — **martwe skróty Ctrl+Shift+V (walidacja) i Ctrl+Shift+Z (redo)**: handler sprawdzał `e.key === 'v'/'z'`, ale przy Shift przeglądarka daje 'V'/'Z' → skróty nigdy nie działały. Fix: normalizacja `e.key.length===1 ? toLowerCase`. `IdeaProcessFlowTool.tsx:~1707`.

**Test-infra / wzorce naprawcze (commitnięte) — UŻYWAJ ICH:**
- `seedPageAuth` (`_m07-helpers.ts`): wstrzykuje pełny stan auth do localStorage per-page (token+user+`consultinity-storage`) zamiast kruchego project-storageState (origin-scoped, łamie się przy zmianie portu → flash login → region workspace nigdy nie wstaje). M09 ma analogiczny w `m09-whiteboard-helpers.ts`.
- **Event-bus dispatch** zamiast kliku w zakryty/hover-gated przycisk: `window.dispatchEvent(new CustomEvent('idea-workspace-quick-action',{detail:{action:'<id>'}}))`. Mapy akcji: `useTableQuickActions.ts` (`tbl_*`), `useMindMapQuickActions.ts` (`mm_*`), `useProcessFlowQuickActions.ts` (`pf_*`).
- **API round-trip** (`seedNodesViaApi` w m09-helpers, `seedMapViaApi` w _m07-helpers): seeduj węzły/krawędzie byte-identyczne z `createNode` przez POST `/map/sync`, GET, asercja round-trip. **Z 409-retry** (re-read version + re-POST) — bo autosave UI churnuje wersję.
- **ensureTableTool / ensureWhiteboardTool**: klik przełącznika narzędzia (title="Table"/"Whiteboard") + marker, bo świeży idea-workspace bywa na złym narzędziu (race montażu MyWorkHub).
- **REAL-AI honest-skip → green po fixie**: gdy AI działa, dispatch akcji AI (`mm_ai_expand`/`mm_ai_gap_analysis`/`mm_ai_suggest`, `pf_*`, tbl AI) → asercja „request poleciał + status<400". Helper `assertAiFiredOrSkip` (_m07-helpers): <400 PASS · ≥500 honest-skip (provider down) · 4xx hard-fail.

**Gotowość M5-M9 (commitnięte):** epiki ✅ (M05 7/7, M06 7/7, M07 6/6, M08 5/5, M09 6/6); DoD domknięte **poza #3 i18n** (M09=7/7, reszta 6/7 — i18n odroczone do „Fazy 4", decyzja Piotra: robimy gdy on na targach); testy security WS org-scope JUŻ istnieją (`tests/integration/gateways/ideaCollabWs.orgscope.test.ts` + map-orgread + ai-ownership contract). Paczki: `Harvard/wdrozenie-100/_GOTOWOSC_IDEAS_M05_M09.md` + per-moduł `_GOTOWOSC_M0X.md`. Tracker: `_STAN_PRACY_ODBIORY.md`.

---

## 2. ŚRODOWISKO — demo.consultify.ai (PUBLICZNE, osiągalne z chmury)

- **URL:** `https://demo.consultify.ai`. Backend `environment:production`, **DZIAŁA i jest ZAPISYWALNE** (zweryfikowane 2026-06-23).
- **Auth bez hasła (KLUCZOWE — agentowi NIE WOLNO wpisywać haseł/tworzyć kont w formularzu):** użyj publicznego trialu `POST /api/auth/register-demo` z `user-agent` (WAF blokuje 403 bez UA). Zwraca `{user, token}` — org `atelier`, `isDemo:true`, `accessLevel:full`, **write działa**. Token ~1h ważności (re-mintuj w pętli). Przykład:
  ```bash
  UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
  curl -s -X POST https://demo.consultify.ai/api/auth/register-demo -H "user-agent: $UA" \
    -H "content-type: application/json" -d '{"email":"qa-'$RANDOM'@demo.local","password":"x","firstName":"QA"}'
  ```
  W Playwright: wstrzyknij token do localStorage (`token`, `user`, `consultinity-storage` ze `state.sessionMode='FULL', currentUser, currentOrganization`) jak `seedPageAuth`, albo użyj Playwright `page.request` z `Authorization: Bearer`.
- **Zweryfikowane na demo (API, 2026-06-23, wszystkie 200 z realną treścią):** register-demo · my-ideas create/list · `/map` GET · `/map/sync` (persyst graf+kształty, round-trip OK, preferredTool zachowany) · `/map/ai-suggestions` · `/ai-generate` (process_coach) · `/map/expand` · table AI · context-summary.
- **Render frontu:** M05 hub, M06/M07/M09 workspaces renderują się (canvas, toolbary, region „Idea map workspace").

### ⚠️ ZNANE GOTCHA-e środowiskowe (NIE odkrywaj od zera)
- **Chrome-extension (Claude in Chrome) NIE nadaje się** do tego SPA: ciągła aktywność tła → brak `document_idle` → screenshot/find/javascript_tool timeoutują; renderer zamarza pod ciężkim load (CDP timeout). **Dlatego idź PLAYWRIGHT, nie extension.** Playwright `page.screenshot()` działa normalnie.
- **caboose (lokalny staging DB)** bywał przeciążony za dnia (sesja M13 + konferencja) → timeouty workspace-load. W nocy spokojny. Jeśli używasz lokalnego harnessu — `DB_POOL_SIZE=40`, `--workers=1` (sufit caboose; workers=2 ryzykowne).
- **Tool-mount race (REALNY bug produktu, zgłoszony, NIE naprawiony):** świeży deep-link do idei whiteboard/table potrafi wyrenderować Process Flow zamiast docelowego narzędzia (`activeTool=externalActiveTool??internalActiveTool` IdeaMapWorkspace.tsx:361; MyWorkHub.tsx:1386 nie odświeża per-doc toola). Mityguj `ensureWhiteboardTool/ensureTableTool`. Fix produktu = decyzja Piotra.

---

## 3. DWIE DROGI URUCHOMIENIA W CHMURZE (wybierz; rekomendacja = obie)

### DROGA A (rekomendowana, najwierniejsza) — harness przeciw publicznemu demo
Cloud agent ma repo. Odpal **istniejące 120 case'ów Playwright** kierując je na demo:
- `E2E_USE_WEB_SERVER=false E2E_API_URL=https://demo.consultify.ai E2E_BASE_URL=https://demo.consultify.ai`
- **Auth-tor:** M05/M06/M09 używają register-demo (działa na demo). **M07/M08 używają test-support** (`E2E_REQUIRE_TEST_SUPPORT=true`) — **demo prawdopodobnie NIE ma `ENABLE_TEST_SUPPORT`**. Sprawdź: `curl .../api/test-support/bootstrap` — jeśli 404/403, **zaadaptuj M07/M08 do register-demo** (mintuj token register-demo, wstrzyknij seedPageAuth, createIdea/seed przez Bearer) — wzorzec jest w m05/m06/m09 helperach. To główna adaptacja Drogi A.
- WAF: dodaj `user-agent` w `page.request` i kontekście (extraHTTPHeaders).
- Komenda: `npx playwright test tests/e2e/cases/m0X-cases.spec.ts --workers=1 --trace off --reporter=list`. Batchuj po 15 (unikaj OOM/kill). Per-case screenshot już wbudowany (`casesShot`/`shot`).

### DROGA B (komplement) — lokalny harness przeciw caboose
Jak w tej sesji: worktree `consultify-e2e`, backend `node` na :3006 (omija sesję M13), `ENV_FILE=.env.staging.local` (caboose), `ENABLE_TEST_SUPPORT=true TEST_SUPPORT_KEY=local-test-support-key-change-me`, `FRONTEND_DIST_PATH=$WT/dist`. Frontend redirectuje na localhost:3000 dev-server (M13) — w nocy dev-server może nie żyć; użyj `vite preview` na osobnym porcie albo testuj API+Playwright headless na built dist. **Używaj 127.0.0.1 nie localhost.** Wszystkie wzorce z §1 są tu sprawdzone.

> **Praktycznie:** Droga A daje „potwierdzenie że DEMO które sprzedajemy działa" (czego chce Piotr). Droga B daje „kod jest zielony" (re-weryfikacja). Zrób A jako główną; B jeśli zostanie czas/budżet.

---

## 4. PEŁNY ZAKRES — „praca z kontekstem", NIE tylko narzędzia

To jest klucz wymagania Piotra. Pula Ideas to nie tylko 4 widgety canvasa. Pokryj:

**A. CASES_M0X (po 30/moduł = 120) — narzędzia + efekty:** SSOT `Harvard/Testy manualne/CASES_M0X_*.md`. To masz w automatach — dociągnij do green/honest-skip Drogą A.

**B. TESTY_M0X (pełne scenariusze manualne, ~481) — PRACA Z KONTEKSTEM:** SSOT `Harvard/Testy manualne/TESTY_M05…M09_IDEAS_*.md` (M05 103/54 · M06 ~121 · M07 89 · M08 100 · M09 117). Te pokrywają to, czego CASES nie łapią:
- **M05 hub (najszerszy):** 3 widoki listy, **foldery, ulubione, recents**, AI Context panel, **AI suggestions/generate/gap-analysis**, snapshoty, **komentarze węzłów**, aktywność, **konwersja idea→6 outputów** (initiative/task/decision/report/presentation/tool/notebook), eksport (PNG/SVG/MD/JSON/CSV), **ścieżki cross-module**: Czat→Idea, Notebook→Idea, Ideas→Inicjatywy, Ideas→Canvas, Ideas→Outputs, **beta-gating**.
- **Org-context / AI-context awareness:** czy AI widzi kontekst organizacji (context-summary, claims), czy konwersje przenoszą kontekst, czy backlinki działają.
- Każda akcja create/update/delete/sync/convert MUSI mieć dowód w **Network** (poprawny endpoint, payload, 2xx) — to reguła z TESTY_M0X. Sama zmiana w UI bez żądania = FAIL.
- **Wymogi graficzne (UI/UX canon):** dark+light, brak korupcji tokenów (rose/hex), §27 (listy = FilterableTable+Menu1/2/3 — N/D dla canvasa), responsywność, zgodność z `docs/ui-standards/CANON.md`. Screenshot dark+light per kluczowy ekran.
- **Wymogi dokumentacyjne:** po przejściu zaktualizuj `_STAN_PRACY_ODBIORY.md` (Manual x/N, DoD, bramki), `_GOTOWOSC_M0X.md`, regeneruj plansze, napisz raport końcowy `Harvard/wdrozenie-100/_RAPORT_NOCNY_M05_M09_<data>.md` (per moduł: pass/skip/fail + dowody + znalezione bugi + screeny).

> Część scenariuszy z TESTY_M0X NIE jest jeszcze w automatach — **dopisz brakujące jako Playwright** (wzorce §1) albo wykonaj headless i udokumentuj. Cel: każdy scenariusz ma werdykt z dowodem.

---

## 5. PĘTLA FIX-UNTIL-GREEN (auto-naprawa faili)

Dla każdego czerwonego case'a:
1. Zdiagnozuj (screenshot błędu, Network, console, DOM). Klasy przyczyn (znane): (a) zakryty/hover-gated przycisk → event-bus dispatch; (b) zły tool zamontowany → ensure*Tool; (c) UI-autosave race → API round-trip + 409-retry; (d) auth flash-login → seedPageAuth; (e) REAL-AI → assertAiFiredOrSkip; (f) selektor → popraw na realny z kodu źródłowego.
2. Napraw w teście (preferowane) lub — jeśli to **realny bug produktu** — napraw w `src/`/`server/` z testem regresji. **Prod-deploy = TYLKO za jawną zgodą Piotra** (NIGDY sam na centerbeam).
3. Re-run, potwierdź green realnym przebiegiem + screenshot.
4. **Czego NIE udawać green (honest-skip z dowodem):** mikrofon/Web-Speech (mockuj SpeechRecognition jeśli chcesz green — legit), drag uchwytów react-flow (lub API round-trip efektu), schowek/drop (synthetic event lub API), multiplayer broadcast <1s (lub asercja org-scope shared-read), M07-28 (panele AI Proposal/Readback świadomie nie-spięte = DP-5 cut; albo dopnij `pf_*` trigger jako fix produktu).
5. **Commituj surgicznie:** `git add -f <ścieżki>` (tests/ jest w .gitignore; NIGDY `git add -A`). Stopka:
   ```
   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   ```
   Branch `feat/deliverables-w1` jest aktywny (równoległe sesje) — twoje commity additive na wierzch; sprawdzaj `git rev-parse HEAD` przed/po. NIE commituj cudzych zmian (deliverables/M13/server src których nie tknąłeś).

---

## 6. PROCEDURA STARTU (krok po kroku dla nocnego agenta)

1. Przeczytaj ten plik + `_GOTOWOSC_IDEAS_M05_M09.md` + `CASES_M0X` + `TESTY_M0X`.
2. Smoke demo: `curl` register-demo (z UA) → create idea → `/map/sync` → `/ai-generate`. Potwierdź 200 (jak §2).
3. Droga A: zaadaptuj auth-tor M07/M08 do register-demo (jeśli demo bez test-support), ustaw env na demo, odpal `m05…m09` po batchach 15, zbierz faile.
4. Fix-until-green (pętla §5) — dociągnij CASES do green/honest-skip.
5. Dopisz/wykonaj brakujące scenariusze TESTY_M0X (praca z kontekstem §4B), z dowodami Network.
6. Wymogi graficzne: screeny dark+light kluczowych ekranów; sprawdź tokeny/canon.
7. Regeneruj 4 plansze (`montage_cases.py`).
8. Dokumentacja: zaktualizuj tracker + GOTOWOSC + napisz `_RAPORT_NOCNY_M05_M09_<data>.md`.
9. **Sprzątanie demo:** usuń testowe idee `QA *` z org „atelier" jeśli Piotr potwierdzi że to org pokazywana prospektom (na razie zostają — patrz §7).
10. Rano: zwięzły raport dla Piotra (per moduł: green/skip/fail, znalezione bugi, screeny, co wymaga jego decyzji).

---

## 7. ZASADY TWARDE + OTWARTE DECYZJE PIOTRA
- **Honest-skip ≠ green.** Dowód `file:line`/status zawsze. Klienci na produkcie.
- **Prod (centerbeam) = jawna zgoda Piotra.** Staging/demo OK. Sekrety (klucze) wpisuje Piotr, nie agent. **Nie wpisuj haseł, nie twórz kont w formularzu** (register-demo API = OK, to publiczny trial).
- **Nie kasuj danych których nie stworzyłeś.** Testowe `QA *` na demo „atelier" stworzył poprzedni agent (2026-06-23) — usuń tylko po potwierdzeniu Piotra że to org sprzedażowa.
- **Otwarte decyzje Piotra:** (a) #3 i18n (Faza 4, gdy na targach); (b) fix produktu tool-mount race (MyWorkHub:1386); (c) M07-28 dopięcie triggera vs zostaw jako DP-5 cut; (d) deploy fixu AI (`06326decfe`) na prod.
- **Idee testowe demo (org atelier, 2026-06-23):** QA Smoke Idea `2240b0ee`, QA M06 `0608e579`, QA M07 `03f98296`, QA M08 `88e80a3d`, QA M09 `0b7f3845`.

---

**TL;DR:** Noc, chmura, Playwright na **demo.consultify.ai** (auth = register-demo trial z user-agent, bez hasła; demo zapisywalne + AI działa). Dociągnij **wszystkie 120 CASES + scenariusze TESTY (praca z kontekstem)** do green/honest-skip, **auto-naprawiaj faile** wzorcami z §1/§5, pokryj wymogi graficzne (dark+light, canon) i dokumentacyjne (tracker+GOTOWOSC+raport+plansze). NIE extension (timeoutuje) — Playwright. Honest-skip ≠ green. Surgical commits. Prod tylko za zgodą Piotra.
