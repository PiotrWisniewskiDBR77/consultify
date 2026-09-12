---
doc_id: codex4-dlug-mvp
status: WYDANY
truth_type: codex-block-instruction
established: 2026-09-12
author: CTO
marker: d4ebea2c86
baza: origin/integracja/20260911
---

# CODEX 4 — DŁUG MVP (cztery etapy, jeden blok)

Blok zamyka cztery pozycje długu nazwane w odbiorze adwersaryjnym stagingu `60051310d7`
(12.09.2026, raport `docs/program/PRZEKAZANIE_KODOWANIA_20260907/ODBIOR_STAGING_60051310d7_20260912.md`)
oraz w pomiarze wydajności (`POMIAR_WYDAJNOSCI_STAGING_20260911.md`) i diagnozie
(`DIAGNOZA_W3_W4_20260911.md`). Wszystkie cztery etapy są niezależne — rób je w kolejności E1→E4,
każdy kończ commitem i wpisem w raporcie. Jeżeli etap okaże się niewykonalny, STOP z uzasadnieniem
i przejdź do następnego — blok nie przepada przez jeden etap.

## §0 BEZPIECZNIKI (Z1–Z24)

- **Z1.** Katalog roboczy tworzysz sam (komendy w `00_WKLEJKA.txt`), baza = **marker `d4ebea2c86`**,
  gałąź `codex/dlug-mvp-20260912`. Warunek wejścia:
  `git merge-base --is-ancestor d4ebea2c86 origin/integracja/20260911` = TAK.
- **Z2.** **NIE pushujesz nic i nigdzie.** Push, scalanie, wdrożenie — wyłącznie nadzorca.
- **Z3.** **ZERO połączeń** do Railway, stagingu, demo i produkcji — w każdą stronę. Żaden skrypt,
  który piszesz, nie może sam łączyć się z żywym środowiskiem: przyjmuje `DATABASE_URL` z env
  i domyślnie działa w `--dry-run`.
- **Z4.** NIE dotykasz `/Users/piotrwisniewski/Developer/Consultify` poza symlinkiem `node_modules`.
- **Z5.** Zasoby wyłączne: kontener `cx-codex4-pg` (port **6455**), bazy o prefiksie `cx4_`,
  harness **5595**, API **4214**, vite preview **5214**, migracje z zakresu **20262170–20262179**,
  artefakty i logi w `~/Developer/codex-wt/codex4-artefakty` (POZA repo).
  **NIETYKALNE cudze:** `cx-codex1-inicjatywy-pg` (6451), `cx-codex2-pg` (6452), `cx-codex3-pg` (6453),
  `cx-codex2b-pg` (6454), `consultify-pg18` (54418 — wolno WYŁĄCZNIE `pg_dump`, `SELECT`
  i `CREATE DATABASE cx4_* TEMPLATE consultify_staging_1009`; **żadnego DROP poza własnym `cx4_*`**).
- **Z6.** ZAKAZ `git stash` (kopiuj do `codex4-scratch`). ZAKAZ `--no-verify`. ZAKAZ `git push`.
- **Z7.** Każdy commit niesie znaczniki odmrożenia, inaczej hook `commit-msg` go odrzuci.
  Dla E1: `[ODMROZENIE 07_MY_WORK_AGENT DEC-468] [ODMROZENIE WSPOLNE DEC-468]`.
  Dla E2: `[ODMROZENIE 06_EXECUTION DEC-468] [ODMROZENIE WSPOLNE DEC-468]`.
  Dla E3 i E4: `[ODMROZENIE WSPOLNE DEC-468]`.
  Jeżeli hook wskaże inny moduł — odczytaj jego komunikat i dopasuj znacznik; nigdy go nie omijaj.
- **Z8.** Testy uruchamiasz **per plik**, env w JEDNEJ linii, `--retry=0`,
  `--config server/vitest.config.ts`. Kilka plików naraz daje fałszywe „No test files found".
- **Z9.** **NIE uruchamiasz pełnego `tsc` frontu** (zabija maszynę). Front: `esbuild` per zmieniony plik.
  Serwer: `cd server && npx tsc --noEmit` — dozwolone i wymagane po E1/E2 (ma dać 0).
- **Z10.** Każda naprawa ma **test z mutacją**: czerwony na markerze, zielony po zmianie. Wynik obu
  biegów wklejasz do raportu. „Testy przeszły" bez pokazania RED nie jest dowodem.
- **Z11.** **KROK 0 każdego etapu = ZMIERZ PREMISĘ.** Premisy w tym dokumencie bywają nieaktualne.
  Jeżeli pomiar obala premisę — napisz to wprost w raporcie i nie naciągaj naprawy pod tezę.
- **Z12.** RODZINA: po naprawie wypisz rodzeństwo defektu (te same wzorce w innych plikach). Naprawiaj
  rodzeństwo tylko wtedy, gdy przyczyna jest **ta sama**; inaczej wypisz je w raporcie.
- **Z13.** Zero zmian wyglądu poza jawnie dopuszczonymi w E2. Zakaz `primary-*` w Tailwind (= crimson).
- **Z14.** Migracje: tylko gdy etap tego wymaga, z zakresu Z5, **addytywne** (bez `DROP`/`ALTER ... DROP`).
  Jeżeli naprawa wymaga skasowania lub zmiany istniejącej kolumny — STOP i propozycja w raporcie.
- **Z15.** Konta do stanowisk lokalnych zakładasz sam w **kopii** bazy (`audyt@dbr77.local`, skrót hasła
  tym samym algorytmem co aplikacja, onboarding oznaczony jako ukończony). Nigdy nie ustawiasz haseł
  w żywej bazie i nie logujesz się na cudze konta.
- **Z16.** Zrzuty ekranu: motyw z zustand (`consultify-storage.state.theme`), **nie** `prefers-color-scheme`
  ani `emulateMedia` — inaczej „jasny" i „ciemny" wychodzą tym samym obrazem. Sprawdź bezpiecznikiem
  jasności, że para różni się o > 40.
- **Z17.** Przyrząd Playwright: **jeden kontekst** na całą serię; warunek gotowości = **zmieniona**
  treść `body.innerText` + stabilność w 3 sprawdzeniach co 400 ms (przy nawigacji klienckiej poprzedni
  ekran zostaje w DOM i naiwny warunek daje fałszywe „3 ms"); wzorzec:
  `scripts/dev/odbior-2-60051310d7/harness2.mjs` i `nav2.mjs`.
- **Z18.** Liczniki błędów konsoli rozdziel: błędy produktu vs własne znaczniki przyrządu.
- **Z19.** Po pracy `DROP DATABASE` **tylko własnych** nazw `cx4_*`. Cudzych baz i worktree nie kasujesz.
- **Z20.** Sprzątasz po sobie w danych: żaden rekord testowy nie zostaje w bazie, którą ktoś ogląda.
- **Z21.** Jeden nowy dokument w repo: `98_RAPORT.md` (niżej). Zrzuty i logi **poza** repo (Z5),
  z wyjątkiem katalogów `evidence/` wskazanych w E2 i E3.
- **Z22.** Nie dotykasz: bramek istnienia (E3 z bloków wcześniejszych), `demoSeedService`,
  `effectiveAccessService`, magazynu kanonicznego inicjatyw (to zakres bloku 2b, trwa równolegle).
- **Z23.** `df -h /` przed startem: poniżej 5 GB wolnego = STOP całego bloku.
- **Z24.** Gdy dwie części tego dokumentu są sprzeczne — wiążąca jest sekcja etapu, nie streszczenie.

---

## E1 — Dwa zastane 5xx (inbox legacy, przypisanie zadania bez projektu)

**Premisa (do zmierzenia).**
1. `GET /api/my-work/inbox` (trasa legacy) zwraca **500 INTERNAL_ERROR** na 4 z 4 wariantów zapytania,
   którymi woła ją kod: `src/components/MyWork/…/InboxContent.tsx` ok. linii 2453–2458
   (`Api.get('/my-work/inbox?limit=200&status=<status>')`). Ekran dziś idzie ścieżką kanoniczną v8
   (`/api/v8/my-work/inbox/canonical` → 200), więc defekt jest niewidoczny — ale **awaryjne zejście
   ze ścieżki kanonicznej prowadzi w 500**.
2. `POST /api/tasks/:id/assign {assigneeId}` na zadaniu **bez projektu** (`project_id IS NULL`)
   → **500 INTERNAL_ERROR**; dotyczy 9 z 46 zadań w organizacji Northwind na stagingu. Hipoteza
   z 11.09: `TaskAssignmentService` rzuca, gdy nie ma wiersza w `project_members`.

**KROK 0.** Odtwórz oba 500 na lokalnej kopii, testem realdb przez **realny ApiGateway** (wzorzec:
`*.pg.test.ts` w `server/src`, np. `e3bramki2.existenceGates.pg.test.ts`). Zanotuj dokładny stos
i przyczynę (plik:linia) dla obu. Jeżeli któryś nie reprodukuje się — napisz to i nie zmyślaj naprawy.

**Definicja ukończenia.**
- Trasa legacy inbox zwraca **200** na wszystkich czterech wariantach, z kształtem odpowiedzi
  zgodnym z tym, czego oczekuje `InboxContent.tsx` w gałęzi awaryjnej (sprawdź w kodzie frontu,
  nie zgaduj). Kontraktu ścieżki kanonicznej **nie zmieniasz**.
- `POST /tasks/:id/assign` dla zadania bez projektu: albo działa (przypisanie dozwolone, gdy
  wskazana osoba należy do **tej samej organizacji**), albo zwraca **4xx z kodem błędu i czytelnym
  komunikatem po angielsku**. **500 nie jest dopuszczalne w żadnym wariancie.** Wybór uzasadnij
  w raporcie; rekomendacja CTO: dopuścić przypisanie w obrębie organizacji, bo zadanie bez projektu
  jest stanem legalnym (105 takich rekordów w produkcie).
- Test z mutacją dla obu (Z10), `tsc` serwera 0, rodzina wypisana (inne trasy `my-work/*` legacy).

**Poza zakresem.** Zmiany w `src/**` (front) — poza odczytem; zmiana kontraktu odpowiedzi 200 ścieżki
kanonicznej; migracje (jeśli 500 wynika z braku tabeli — STOP i propozycja).

---

## E2 — „Close card" to drzwi w jedną stronę (brak ponownego otwarcia)

**Premisa (do zmierzenia).** `POST /api/action-cards/:id/close`
(`server/src/routes/actionCards.routes.ts:59`) zamyka kartę działania **nieodwracalnie**: nie istnieje
żadna trasa ponownego otwarcia, a `updateActionCard` nie przyjmuje pola `status`. Sonda odbioru
zamknęła kartę `13efc367-f4ad-400e-be76-19c5688ff266` na stagingu i **nie da się jej przywrócić**
inaczej niż `UPDATE` na bazie.

**KROK 0.** Potwierdź grepem: brak trasy `reopen`, `status` nie przechodzi przez update. Sprawdź, co
dokładnie zmienia `close` (tabela, kolumny `closed_at`/`closed_by`, wpis w historii/audycie).

**Definicja ukończenia.**
- Trasa `POST /api/action-cards/:id/reopen`: CLOSED → OPEN, **ta sama bramka uprawnień co `close`**,
  idempotentna (reopen otwartej = 200 bez zmiany albo 409 — wybierz spójnie z `close` i uzasadnij),
  odwrócenie kolumn ustawionych przez `close`, ślad w historii/audycie, jeżeli `close` go zostawia.
- Przewód w interfejsie: tam, gdzie karta działania pokazuje akcję **„Close card"**, dla karty
  w stanie CLOSED pojawia się **w tym samym miejscu i stylu** akcja **„Reopen card"**. Żadnych nowych
  paneli, ikon ani kolorów. Klucze tłumaczeń `en` **i** `pl` (pl: „Otwórz ponownie").
- Test realdb: close → reopen → odczyt `status = OPEN`; osoba bez uprawnień dostaje to samo, co przy
  `close` (403/404 — zgodnie z pomiarem, nie z założeniem); mutacja RED (404 na markerze) → GREEN.
- **Zrzuty robisz sam** (właściciel nigdy nie jest pierwszym testerem): karta CLOSED z akcją
  „Reopen card" i karta po ponownym otwarciu, motyw jasny **i** ciemny, 1440 px, do
  `evidence/n1-reopen-card/` (PNG + krótki sidecar JSON z adresem i stanem). Bezpiecznik jasności (Z16).

**Poza zakresem.** Pozostałe karty N, refaktor powłoki artefaktu, nowe kolory/ikony, migracje.

---

## E3 — Pakiet startowy 5,37 MB (zimny start 16–26 s)

**Premisa (do zmierzenia).** Aplikacja ładuje przed pierwszym ekranem **7 chunków eager / 5,37 MB JS**
(`App-*.js` 3,78 MB, `index-*.js` 317 kB). `manualChunks` jest **wyłączone**
(`vite.config.ts:267`, `chunkSizeWarningLimit: 500`). Zimny start 16–26 s przekraczał dawny limit 15 s
w `useDeferredLoading.ts` i dawał pełnoekranowy błąd; limit podniesiono do 45 s — to obejście, nie naprawa.
Jedyny `Suspense` wokół `<Routes>` w `src/AppRoutes.tsx` (~:1199).

**KROK 0.** Na markerze: `npx vite build`, tabela chunków > 200 kB, **łączny eager JS w bajtach**
(z `index.html`: importy statyczne + `modulepreload`), czas budowy. Ustal, **co** siedzi w `App-*.js`:
ile tras jest `React.lazy` a ile eager, czy jakiś barrel `index.ts` wciąga wszystkie moduły, czy ciężkie
biblioteki (pdf, xlsx, wykresy, edytor, mermaid, monaco, three, d3) są eager.

**Cel liczbowy.** Eager JS **≤ 2 MB** (ideał ≤ 1,5 MB), `App-*.js` rozbity. Bez zmiany wyglądu,
bez błędów `Cannot access 'X' before initialization` i bez cykli w runtime.

**Kolejność (zysk/ryzyko).** (1) `React.lazy` dla tras i modułów eager bez potrzeby — z istniejącym
`Suspense`; (2) ciężkie biblioteki → dynamiczny import w miejscu użycia; (3) `manualChunks` funkcją
(vendor-react, vendor-charts, vendor-editor…) **dopiero** gdy (1)–(2) nie wystarczą — to ona bywała
źródłem cykli. Każdy krok = osobny commit z pomiarem PRZED→PO.

**Weryfikacja (obowiązkowa, wzrokiem, sam).** Stanowisko lokalne: kopia bazy `cx4_bundle`, API 4214,
`vite preview` **zbudowanego dist** na 5214 (nie dev server). Przyrząd wg Z17: zimny start, potem
nawigacja kliencka po **16 modułach** paska bocznego + 3 karty (inicjatywa, zadanie, karta działania);
per ekran: treść zmieniona, 0 `pageerror`, 0 błędów konsoli produktu, zrzut 1440 jasny. Ten sam przyrząd
na budowie z markera (PRZED) i po zmianach (PO). Adresy modułów bierz z **żywego paska bocznego**,
nie z dokumentacji (trzy adresy w starych briefach prowadzą nie tam).
Wyniki: `evidence/bundle-chunks/` + raport
`docs/program/PRZEKAZANIE_KODOWANIA_20260907/POMIAR_BUNDLE_20260912.md` (tabela PRZED→PO: eager B,
liczba chunków, zimny start, czas per moduł, błędy).

**Poza zakresem.** Zmiany wyglądu, refaktory logiki, podbicia wersji bibliotek, zmiany serwera.

---

## E4 — Trzy narzędzia operacyjne (CI, konta pilotażu, sprzątanie klonów)

Ten etap **przygotowuje**; uruchomienie na żywych środowiskach robi nadzorca (Z3).

**E4.1 — `test-suite.yml` nie startuje dla gałęzi `staging`.**
`.github/workflows/test-suite.yml` ma `on.push.branches: [main, develop, Londyn, demo]`, a linia
integracyjna jedzie przez `staging` — więc zestaw testów nie uruchomił się ani razu przy wdrożeniach.
Dodaj `staging` do `push` i `pull_request`; joby, które na `staging` nie mają sensu (wdrożeniowe),
wyłącz warunkiem `if`, żeby nie dublować `railway-deploy.yml`. Sprawdź składnię
(`python3 -c "import yaml;yaml.safe_load(open('.github/workflows/test-suite.yml'))"`).
W raporcie: które joby ruszą po pushu na `staging` i ile potrwają (z historii `gh run list` — tylko odczyt).

**E4.2 — konta pilotażu na demo, przy wyłączonej poczcie.**
Cztery osoby pierwszej linii, organizacja DBR77 `a3e05d4a-5397-419d-b486-8e44366c0063`:
Tomasz Jankowski `tomasz.jankowski@dbr77.com` (konto istnieje, nigdy nie logowany),
Justyna Laskowska `justyna.laskowska@dbr77.com` (istnieje, logowana 26.08),
Katarzyna Marszałkiewicz `katarzyna.marszalkiewicz@dbr77.com` (**brak**),
Irina Lebedjuk `irina.lebedjuk@dbr77.com` (**brak** — adres potwierdzony przez właściciela 12.09).
KROK 0: ustal z kodu, jak aplikacja zakłada użytkownika i ustawia hasło (algorytm i koszt skrótu,
kolumny `users`, `organization_members`, oznaczenie ukończonego onboardingu, czy istnieje wymuszenie
zmiany hasła przy pierwszym logowaniu, jak działa token w `password_resets` i jego ważność).
Napisz `scripts/dane/pilotaz-demo-konta-20260912.mjs`: `DATABASE_URL` z env, **domyślnie `--dry-run`**
(plan + stan PRZED, bez zapisu), `--apply` w jednej transakcji zakłada brakujące konta (rola członka
organizacji, e-mail zweryfikowany, onboarding ukończony — dokładnie tak, jak robi to aplikacja),
wszystkim czterem ustawia **nowe hasło tymczasowe** (losowe, 14 znaków, zapisywane **wyłącznie** do
pliku z `--out=<ścieżka poza repo>`, nigdy na ekran i nigdy do repo) i — jeśli aplikacja ma taki
mechanizm — wymusza zmianę przy pierwszym logowaniu; `--manifest=<ścieżka>` zapisuje stan PRZED
umożliwiający cofnięcie. Sprawdź na kopii `cx4_pilot`: dry-run, apply, a potem **realne logowanie**
przez `POST /api/auth/login` na lokalnym API (4214) nowym hasłem.

**E4.3 — 20 klonów „Atelier Toys" na stagingu.**
Staging ma 20 organizacji `ateliertoys-demo-session-<id>-<sufiks>`, każda z **zerem** aktywnych
członków, mimo `DEMO_SESSION_TTL_HOURS=2`. KROK 0: znajdź sprzątacz sesji demo i ustal (a) czy
w ogóle uruchamia się na stagingu (jaki warunek środowiska), (b) co dokładnie kasuje i czy chroni
ludzi, (c) dlaczego te 20 przetrwało. Napisz
`scripts/dane/sprzatanie-klonow-demo-session-20260912.mjs` (`--dry-run` domyślnie: lista organizacji,
liczby wierszy zależnych per tabela i **STOP**, gdy w klonie jest człowiek — `last_login` niepusty albo
adres spoza wzorca ziarna; `--apply` w transakcji z manifestem). Użyj **istniejącego** łańcucha
kasowania organizacji z aplikacji — nie wymyślaj własnej kolejności kluczy obcych.
Poprawkę samego sprzątacza (jeśli nie startuje na stagingu) **opisz** (plik:linia + propozycja), ale
**nie wdrażaj** — decyduje nadzorca.
Przestroga z 09.09: czystka po wzorcu „sierota" skasowała kiedyś 319 wierszy konfiguracji produktu
i konto człowieka. Wzorce wykluczaj **jawnie**, a po czystce sprawdź, że tworzenie inicjatywy nadal działa.

---

## §9 RAPORT — jedyny nowy dokument

`docs/program/PROGRAM_NAPRAWCZY_20260905/CODEX4_DLUG_MVP/98_RAPORT.md`, sekcje:
1. Stanowisko (worktree, SHA markera, kontener, porty, bazy `cx4_*`).
2. E1 — premisa PRZED (kod HTTP + przyczyna plik:linia) → PO, co zmieniłeś, rodzina, testy RED→GREEN, `tsc`.
3. E2 — premisa PRZED → PO, trasa, bramka, interfejs, testy RED→GREEN, ścieżki zrzutów, wynik bezpiecznika jasności.
4. E3 — tabela PRZED→PO (eager B, chunki, zimny start, czas per moduł, błędy), co przeniesione do lazy, ryzyka cykli.
5. E4 — trzy narzędzia: co robi każdy skrypt, wynik dry-run i apply **na kopii**, komendy dla nadzorcy
   (z zastępnikiem `DATABASE_URL`) w bloku kodu.
6. SHA per etap.
7. STOP-y i wątpliwości — wszystkie, także drobne.
8. Czego **nie** sprawdziłeś. Ta sekcja nie może być pusta bez uzasadnienia.

Samoocena („sceptycy 9,4/10") nie jest dowodem i nie wchodzi do raportu. Odbiór jest trójwarstwowy
i adwersaryjny; STOP z uzasadnieniem jest wart więcej niż etap domknięty na siłę.
