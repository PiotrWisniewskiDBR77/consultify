<!-- Kopia 1:1 pamięci trwałej nadzorcy: przekazanie-cto-1209-rano (12.09.2026). Źródło prawdy o stanie = rejestr 01_INDEKS_I_HARMONOGRAM.md; ten plik = zasady dowodzenia + raport nocy. -->

# Przekazanie CTO — 12.09.2026 rano

## 0. Słowo właściciela (12.09): „ty dowodzisz, inni agenci pracują"
Piotr (właściciel, nie-koder, po polsku, krótko) 10.09: „przejmuj kontrolę i zarządzanie wdrożeniem; ty zarządzasz tylko i prowadzisz projekt
jako CTO; pracuj swoimi agentami Opus i Sonnet; duże rzeczy do Codexa; jedziemy cały plan do końca". 10.09 wieczór: „znowu pracujesz tylko
jednym agentem — nie wiem czy tak daleko zajedziemy" → RÓWNOLEGLE. 11.09: „zrób ile się da, domykajmy". Mandat: pełne zgody na operacje MVP
bez pytań (staging/demo/dane/flagi), z punktem cofnięcia i wpisem w rejestrze; produkcja (centerbeam) NIETYKALNA.

## 1. Stan zmierzony (12.09 ~09:00)
- **staging = demo = `60051310d7`** (health obu: connected). Punkty cofnięcia: `staging-safe-20260912-0003` (= wersja z Tokio + hotfix
  `e25b7cd5d0`), `demo-safe-20260910-2300`, zrzuty w `~/Developer/consultify-dumps/`.
- **Linia integracyjna** `mvp/inicjatywy-lancuch-20260907` (worktree `~/Developer/wt/fable-inicjatywy`, ostatnio `96b6998ac1`+; kopia
  `origin/integracja/20260911` = `e005d164b0`+ — push tam niczego nie buduje). UWAGA: poprzednia sesja nadzorcza (11/12.09) mogła zostawić
  zmiany — przed pracą `git status`, `git log -3`, porównaj z `origin/integracja/20260911`.
- **Konto właściciela** piotr.wisniewski@dbr77.com (id `1bd98637…`, DBR77, ADMIN/OWNER, jego stare hasło) zasiane na obu środowiskach.
- **Pojemnik 1:** S1.1 warunkowe TAK (DEC-466; przejście właściciela Inicjatyw/Realizacji do potwierdzenia), S1.2 9 dziur zamkniętych,
  S1.5 `aside ≤ 1` 8/8 (kryterium czytane wg DEC-404), S1.11 tagi `mvp-final-*-20260910` + 09_RESULTS + WSPOLNE, S1.12/S1.13 zrobione.
- **Codex:** blok 1 (jeden magazyn), 2 (część 2), 3 (Finanse MINIMUM) odebrane 3-warstwowo i scalone za flagami OFF; **blok 2b** (sześciu
  pisarzy legacy → kanon) wydany, marker `a176d3f906`, wklejka `docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX2B_SZESCIU_PISARZY/00_WKLEJKA.txt`
  i w `KARTA_PORANNA_20260912.md` §5 — właściciel wkleja.
- **Pięć decyzji właściciela** (karta poranna 12.09, rekomendacje): 1 inicjatywa bez projektu (105 rekordów) **A** zostawić; 2 Finanse w
  menu **A** zamknięte (przed C naprawa: żadna rola nie zatwierdzi sprawozdania — BetaGate×role); 3 SMTP Hostinger wyłączony **B** zmiana
  dostawcy; 4 pilotaż **A** demo (brak e-maila Iriny); 5 dwa Postgresy na stagingu **A** usunąć martwy `Postgres` + zmienne `DB_*`.

## 2. Raport z nocy (skrót; pełny w rejestrze `PROGRAM_NAPRAWCZY_20260905/01_INDEKS_I_HARMONOGRAM.md`)
**10/11.09 (sesja audytowa CTO):** audyt (demo 2,5 h na kodzie z lipca po zmiennej bez `--skip-deploys` — przywrócone), przejęcie, 3 partie
na staging (`ca8fb13269` → `71094d987e` → `ff3ae0dbde`) + hotfix `e25b7cd5d0` (zapis z karty zadania zerował `assignee_id`), konto
właściciela (skasowane 09.09 z Atelier Toys) przywrócone z oryginalnym skrótem + 734 wiersze danych „widma", dane DEC-462/463/464
(zespół/obciążenie, megatrendy 34, duplikaty projektów), 16 tagów zamrożenia, przekazanie, 6 paczek nocnych na linię, 3 instrukcje Codexa.
**11/12.09 (następca):** 21:00 wdrożenie 15 paczek → odbiór adwersaryjny: 4 blokery → 22:22 cofnięcie (pochopne: „moduły nie montują się"
było wadą przyrządu — limit 15 s < zimny start 16–26 s przy bundlu 5,4 MB) → naprawy B-1..B-4 (luka `.scoped` istniała już na wersji z Tokio),
limit 45 s, N+1 → 00:00 ponowne wdrożenie → 00:11 demo → 01:00 odbiór nr 2 z ciepłą sesją: **zero regresji**, 16/16 modułów, 15/16 ≤ 5,6 s.
Dwa błędy następcy w rejestrze: pochopne cofnięcie; skasowane cudze kopie baz.
**Dług nazwany:** bundle 5,37 MB bez `manualChunks`, 19–28 żądań/nawigację, „Close card" bez trasy powrotnej, legacy `GET /api/my-work/inbox`
500, 48 rozmów bez wiadomości, `POST /tasks/:id/assign` bez projektu → 500, SMTP martwy, `test-suite.yml` nie startuje dla `staging`.

## 3. ZASADY DOWODZENIA (obowiązują każdego nadzorcę)
1. **CTO nie koduje.** Robisz wyłącznie: zlecenia, odbiory, scalenia, bramki, push/wdrożenia, zmienne Railway, rejestr, pamięć, karty
   dla właściciela, instrukcje/wklejki Codexa, decyzje. Wyjątek: poprawka 1–2 linii albo dowód zapisu, którego robotnik nie może wykonać.
2. **Równolegle, nie po kolei.** Kilka agentów naraz (Sonnet = mechanika/dane/pomiary, Opus = odbiory adwersaryjne, instrukcje Codexa, trudny
   kod, Codex = duże bloki mechaniki tylnej). Limit twardy: **max 4 ciężkie stanowiska lokalne naraz** (restart maszyny 11.09 przy 6),
   bramka NIGDY równolegle z falą (głodzenie tsc → fałszywe „0" po OOM). Instruuj: esbuild per plik zamiast pełnego tsc frontu u robotnika.
3. **Stanowisko tworzy CTO**: `git worktree add ~/Developer/wt/<nazwa> -b mvp/<nazwa>-<data> <sha linii>` + symlink `node_modules`;
   pierwsza komenda agenta = `git rev-parse --short HEAD` + `git status --porcelain | wc -l` (0). Baza robocza = kopia szablonu
   `consultify_staging_1009` w kontenerze `consultify-pg18` (54418; po restarcie `colima start`, `docker start consultify-pg18`), własne porty,
   DROP po pracy — TYLKO własnych nazw. Żywe bazy: staging = serwis Railway **`pgvector`** (`railway variables --service pgvector --environment
   staging --json` → `DATABASE_PUBLIC_URL`, bez SSL), serwis `Postgres` martwy; zapis tylko ze zrzutem (`pg_dump` w kontenerze) + manifestem.
4. **Zlecenie = kontrakt**: KROK 0 „zmierz premisę" (premisy nadzorcy bywały fałszywe 7× jednego dnia), zakres i POZA zakresem, rodzina
   (rodzeństwo defektu), meldunek w układzie STANOWISKO · POMIAR PRZED→PO · CO ZMIENIŁEM (plik:linia) · DOWÓD · SHA per etap · STOP-y;
   commit per etap, bez pusha; test z mutacją RED→GREEN; hook commit-msg wymaga `[ODMROZENIE <MODUŁ> DEC-…]` (zamrożone 16 modułów +
   WSPOLNE — commit próbny, odczytaj, popraw; NIGDY `--no-verify`).
5. **Robotnicy odmawiają logowania hasłem** (nawet do konta testowego) → dowody zapisu na żywo robi CTO skryptem
   (`scripts/dane/dowod-zapisu-northwind.mjs`, potem `brud-e4-20260910.mjs --op=d6` z env `D6_INITIATIVE_ID/D6_PROPOSAL_ID`), a zrzuty
   ekranów robotnik robi na lokalnym stanowisku z kontem `audyt@dbr77.local` wstawionym do kopii (onboarding oznaczony jako ukończony).
6. **Odbiór adwersaryjny przed każdym „gotowe"**: oba kierunki (widać / da się zmienić), pełny reload, obie role (ADMIN i MEMBER), ciepła
   sesja (jeden kontekst, token odświeżany, `waitForFunction` na treść — nie limit 15 s), 0×5xx w logu, konsola. „Nie renderuje się" bez
   obrazu nic nie znaczy (33. kształt).
7. **Scalanie i bramka**: `git merge --no-ff` do linii; `translation.json`/`baseline.json` trójstronnie `scripts/dev/scal-json3.py`;
   bramka 4-krokowa Sonnetem: tsc serwera 0 · front tsc ≤ 192 (jeden bieg, 8 GB, sprawdź brak OOM) · `pomiar-jezyka.mjs --baseline` bez
   wzrostu · `vite build` + drzewo czyste · `check-list-canon.sh`/`check-artefakt.sh` = baza · testy PER PLIK (kilka plików naraz = fałszywe
   „No test files found"); mierz TE SAME zbiory na obu sha zanim ogłosisz regresję.
8. **Wdrożenie**: `git push origin <sha>:staging` (FF; push SAM buduje na Railway ~12 min) + `gh workflow run railway-deploy.yml --ref staging
   -f environment=staging`; workflow bywa `failure` na timeout mimo udanego wdrożenia → sprawdź `railway deployment list` i health, tag
   `staging-deployed` przesuń ręcznie; health `gitSha` pochodzi z `APP_BUILD_SHA` (nie z builda). Demo: `-f environment=demo -f confirm_demo=yes`
   (promuje tag). Zmienne: ZAWSZE `--skip-deploys` (bez tego demo buduje z gałęzi `Londyn` z lipca). Punkt cofnięcia tagiem PRZED pushem.
9. **Codex**: instrukcję pisze Opus (wzorce `CODEX1_INICJATYWY/01_INSTRUKCJA.md`, Z1–Z46, marker `<<MARKER_SHA>>` ×4 wpisuje CTO, ramka
   `PROJEKT→WYDANY`), baza = `origin/integracja/20260911`, wklejka ≤ 40 linii W BLOKU KODU dla właściciela (wkleja ręcznie); odbiór
   3-warstwowy (Opus kod vs kontrakt → Sonnet runtime → podpis CTO), FIX-y Sonnet na gałęzi `…-fixes`, scalenie za flagą OFF; STOP-y Codexa
   są zwykle zasadne — rozstrzygaj decyzją nadzorcy w `02_DECYZJA_NADZORCY_*.txt`.
10. **Właściciel**: po polsku, krótko, jeden żywy obraz i Tak/Nie, decyzje partią z rekomendacją i literą; sprostowania własnych błędów
    wprost (ceni bardziej niż dobre wieści); NIGDY nie jest pierwszym testerem wizualnym; produkt i dane budujemy PO ANGIELSKU (DEC-461),
    polski seed dla pokazów później; zatwierdzanie inicjatyw = fala 2 (DEC-465).
11. **Higiena**: worktree usuwaj po scaleniu (tylko własne: `brud=0` i `poza linią=0`), nigdy cudze (Codex `codex-wt/`, Szampan `wt/p11-*`,
    `audyt-p1`, `j9-tmp`); zegar: `date` przed wierszem rejestru; pamięć aktualizuj po każdej dużej partii (plik ZACZNIJ TU + MEMORY.md);
    dwie sesje nadzorcze naraz = pierwszy krok `send_message` z podziałem ról.

## 4. Kolejka na dziś
Odbiór odpowiedzi właściciela na 5 decyzji → wykonanie (SMTP/dostawca, Postgres martwy, pilotaż demo); przejście właściciela Inicjatyw/
Realizacji (karta `KARTA_PRZEJSCIA_WLASCICIELA_20260910.md`); Codex 2b (właściciel wkleja) → odbiór; dług: bundle `manualChunks`, „Close
card" reopen, legacy inbox 500, `assign` bez projektu, BetaGate×role; pojemnik 2: pilotaż Tomek/Kasia/Irina/Justyna na demo, playbook.
Powiązane: [[przekazanie-cto-1109-noc-2]], [[przekazanie-cto-1109-noc]], [[zasady-pracy-nadzorcy]], [[konto-czlowieka-w-org-pokazowej]],
[[push-na-staging-buduje-railway]], [[jezyk-angielski-najpierw-dec461]], [[dwie-sesje-nadzorcze-na-jednym-m03]].
