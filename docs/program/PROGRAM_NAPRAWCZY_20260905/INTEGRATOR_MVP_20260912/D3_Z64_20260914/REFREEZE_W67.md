# A/D D-3 + Z-64 + W67 — refreeze 2026-09-14

**Werdykt autora: READY_FOR_INDEPENDENT_REVIEW_WITH_STOP_OWNER_DECISION. Pełny zakres D-3, P1, Z-64 oraz liczniki W67 N1/N2/N4 jest gotowy do niezależnego odbioru; jedynym jawnym STOP pozostaje realna zmiana kontraktu `contractMirrorDrift`, której paczka świadomie nie integruje.**

## Tożsamość

- Exact base: `59a8c44c04`.
- Content tip przed dokumentami refreeze: `9c4402896a`.
- Gałąź: `codex/a-d3-debts-z64-20260914`.
- Poprzedni freeze `b7d63ed7e8` pozostaje checkpointem; ten dokument zastępuje jego werdykt odbiorowy po poprawkach review i W67.
- Migracje, deploy i push do chronionych gałęzi: brak.

## Wynik produktu

1. **D-3:** asercje DRD respektują locale, DOCX Day50, Interview STT, rejestr, kafle jakości i candidate gate są zielone. Produkt nie został przełączony na polski.
2. **My Work test-only:** produktowy diff `IdeaMapWorkspace.tsx` względem exact base wynosi zero. Pięć wskazanych plików My Work ma **25/25 PASS**; test Teresy sprawdza aktualną kanoniczną zakładkę, lazy import `UnifiedChatPanel` i brak dwóch legacy propsów.
3. **P1 Projects:** realny układ mobilny przy 360 px nie ucina wierszy ani statusów. Chromium mierzy listę 254 px, każdy wiersz 254 px, a pełny polski status `Zatwierdzony` mieści się od 183 do 280.47 px w viewportcie 62–318 px. Z-43 i Z-48 współistnieją, a breakpoint używa obsługiwanego `sm:`.
4. **Z-64:** organization scope i role listy sesji Library są egzekwowane przed odczytem. RealPG dowodzi OWNER create → ADMIN same-org read, cross-org MEMBER deny, 401 bez auth i właściwy 403/code dla obcego rekordu. Offline abort w Library/Assessment prowadzi do kanonicznego ErrorState z `Try again` i poprawnego retry.
5. **W67 N1:** `All 43 = Draft 8 + Ready 34 + Other statuses 1`; residualna kategoria jest jawna, a Menu3 zachowuje limit trzech pigułek.
6. **W67 N2:** szczegół Audytu pokazuje kanoniczne maksimum pełnego drzewa i `criteriaCount`, więc lista 9 i szczegół 9 korzystają z jednego widocznego mianownika nawet przy częściowych trzech korzeniach.
7. **W67 N4:** endpoint zwraca `claims`, `total` i `limit` z jednego role-scoped filtra przed `LIMIT`. UI pokazuje `Claims (727)` oraz `Showing 200 of 727`; stary klient `listClaims` zachowuje kompatybilność.

## Dowody końcowe

- Focused testy, każdy plik osobno z `--retry=0`: **19 plików / 99 testów PASS** — `evidence/d3-z64-w67/logs/final-focused.log` oraz końcowy N2 `n2-audit-library-final.log` (**22/22**).
- Real PostgreSQL `127.0.0.1:6454/consultify_d3`, `MOCK_DB=false`: **31/31 PASS** (Library HTTP 15, governed snapshot 12, mounted HTTP 4) — `final-realpg.log`.
- Real Chromium PL360: **1/1 PASS**, bounding boxes i overflow — `final-browser-p1.log`; PNG i JSON w `evidence/d3-review-fixes/screens/`.
- Frontend TypeScript po końcowym fixie: **177 błędów**, identycznie z baseline 177 — `final-front-tsc-postfix.log`. Server TypeScript: **0 błędów** — `final-server-tsc.log`.
- Esbuild per zmieniony plik: **11/11 PASS** (7 browser + 4 server z zależnościami pakietowymi external) — `final-esbuild.log`.
- `git diff --check` dla kodu i dokumentów poza surowymi odziedziczonymi logami: PASS.
- W67 BEFORE/AFTER EN: `evidence/d3-z64-w67/screens/counter-drift-before-en-light.png` i `counter-drift-after-en-light.png`; receipt JSON potwierdza brak błędów renderu.

## STOP_OWNER_DECISION — realny kontrakt, nie mechaniczny mirror

`contractMirrorDrift` pozostaje świadomie **4 FAIL / 3 PASS** bez osłabienia testu (`final-contract-mirror-stop.log`). Próba synchronizacji została wcześniej audytowalnie odwrócona; produkt nie zawiera tej zmiany.

- **Wariant A:** kanonizuje `TransitionAuthority` i `compiledLanguage` w obu publicznych lustrach, a odbiór obejmuje consumer tests `MethodSessionService`, kompilator DRD EN/PL i bajtowo zielony mirror.
- **Wariant B — rekomendowany:** przenosi server-only `TransitionAuthority` do osobnego kontraktu serwera, synchronizuje publiczne lustra z kanonem i testuje brak publicznego eksportu authority oraz oba realne konsumery.

Independent review dla tego zintegrowanego refreeze: **NOT_RUN**.
