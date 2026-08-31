# CODEX DAY179 — Czat i18n — raport

Data: 2026-08-30  
Gałąź: `codex/day179-czat-20260830`  
Marker: `d3d36cd5f5`  
Commit naprawy: `90636358bf1731d18d95f8bb31e7b44a6d348c6a`  
Zakres: `CHAT-OR-20260829-001`

## Werdykt

`CLOSED_DAY179 / OWNER_RETEST_PENDING`.

Brakująca gałąź `chat.governedHandoff` została dodana wyłącznie do polskiego słownika. Komponentu, angielskiego słownika i danych seeda nie zmieniono. Realny kanoniczny runtime na lokalnej fixture FINAL wyrenderował kartę w języku polskim z polskim statusem, provenance, pluralizacją, metadanymi i przyciskami. Angielska wiadomość źródłowa oraz tytuł propozycji pozostały danymi fixture, nie etykietami produktu.

## Stan wejściowy i baza

Wynik komend markera (§0.1 pkt 2), dosłownie:

```text
a3fa12bd66 docs(codex): dyzury 174-179 wydane — stop agenta+koszt+polityki, karta bez regresji (163-bis), ustawienia MEMBER, partner G08, ocena sourceType, czat i18n
93f979a865 decyzje wlasciciela runda 2: warsztat Audytow TERAZ, kalendarz ON, migracja legacy->kanon w MVP, straznik groundingu poluzowany z rubryka
7b4da09c7b doradca mocy: kolumna Rola/zespol przestaje powtarzac Opiekuna — realne role z proposedAssignments, ograniczenie bez zmyslonego przymiotnika
2142a145a0 dziennik: Z-10 macierz WSTRZYMANA (wzorzec = SIRI, zbudowalem prezentacje zamiast narzedzia) + Z-11 logowanie wlasciciela
74775cea67 decyzje wlasciciela 30.08 wieczor: Spotkania beta OD RAZU, sygnaly ON, PDF audytu w MVP, powierzchnia odbioru = STAGING (K5 doprecyzowany)
73725a19b2 plan i doradca mocy: duplikat kolumny usuniety, trzy zawsze-puste kolumny domyslnie ukryte, etykiety skrocone — 10 kolumn zamiast 14, zero ucinania
6ee31b4da1 macierz obszary x poziomy: prawdziwa siatka 2D wyrenderowana po raz pierwszy — 609 linii martwego kodu, siedem osi, liczba poziomow ze zrodla prawdy
d3d36cd5f5 sciezka wyjscia K1-K6 (kotwica: plan 4-fazowy 24.08, Faza 2 -> 3) + odbior 170 zaktualizowany: SCALONO po FIX-170, mechanika A
ab82afbc1b merge: dyzur 170 + FIX-170 (okna check-inu OKR — mechanika A po naprawie dat ::text, test przenosny, B2+isCurrent zasercjonowane; UI C do zrzutu B1) — odbior adwersaryjny
99f9e3bf71 dziennik: Z-9 — kopii prawdy o osiach jest osiem, nie piec; czwarty raz zawezilem zasieg
2eefeb93aa osie DRD: trzy kolejne odklejone kopie podlaczone do zrodla prawdy (radar, import raportu, import serwerowy) + kolejnosc osi 1-7 w harnessie
913edb8ad3 fix(day170): distinguish fetch failure from empty occurrence list
080516f294 fix(day170): dates as ::text, portable test, B2+isCurrent asserted
6a28e8f1d3 DRD 7E: propozycja pieciu poziomow kompetencji i kultury AI — obszar, ktory w dokumentacji wlasciciela byl zapowiedziany i nieopisany
645e5b9fc0 odbior 170: NIE SCALAC — data o dobe wstecz poza UTC (commit naprawy wprowadzil blad, ktory mial naprawic), test-tautologia 226b5aaae4, pin bazy wykonawcy klasy Z31; naprawa wydana robotnikowi
36a3085b2d dziennik: Z-9 — prawda o osiach DRD w szesciu kopiach; trzecie sprostowanie tego samego dnia i wzorzec bledu (zawezanie zasiegu do tego, co zmierzone)
4b8097b879 macierz DRD: poziomy osi z jednego zrodla prawdy (drdStructure) zamiast wlasnej kopii — kultura i cyber mialy 5 zamiast 6
2fc5e3321f tabele: ostatnia kolumna przestaje byc ucinana — jadro skaluje kolumny gdy suma przekracza kontener (8 ekranow zmierzonych, 6 naprawionych)
1abf43dbd4 rekonesans zamkniecia 16 modulow: szkic z kart zweryfikowany kodem przez 5 agentow — 8 tez obalonych, 6 nowych znalezisk, suma 21-29 dyzurow w trzech falach; sprostowanie wiersza komentarzy w rejestrze
ca147b3aef DRD: zrodlo nowsze niz ksiazka znalezione — os 6 ma 6 poziomow, os 7 ma 5; prostuje wlasna nieprecyzyjnosc (blad jest w JEDNYM pliku, nie w kodzie)
e7f35db083 grafika: dziennik zdarzen z kontekstem (regula 10) — osiem zdarzen sesji, w tym dwa sprostowania wlasnych bledow
7bbd512ad1 zasady: reguly 9 i 10 od wlasciciela — zlecaj robotnikom z doborem modelu do trudnosci; dokumentuj KONTEKST zdarzenia, nie tylko wynik
c94dffcfa0 zasady: regula 8 — zakaz git stash u robotnikow (wspolny stos zabiera cudza prace)
f2194c5bbc Finanse/predykcja: wybor trybu i wariantow to pigulki kanonu Menu 2 — ten sam defekt co w Wycenie, znaleziony przy okazji
54609cc2b4 DRD: ksiazka wlasciciela 'Digital Pathfinder' kontra kod — dwie osie maja o jeden poziom za malo, prostuje wlasna rekomendacje
MARKER OK
```

Wynik sanity (§0.1 pkt 7), dosłownie:

```text
d3d36cd5f51ed9db796bb350c1109ebc2e4b705c
```

`git status --short | head -3` nie wypisał żadnej linii.

Tip uciekł do przodu o siedem commitów. `git diff --name-only d3d36cd5f5..github-backup/codex/m03-admin-20260824` wskazał również `public/locales/pl/translation.json`; zgodnie z `DEC-2026-08-26-95` implementacja pozostała dokładnie na markerze, bez rebase. Scalenie nowszego tipa należy do nadzorcy.

## Pomiary T1–T5 i korekty wobec instrukcji

- T1: `CHAT-OR-20260829-001` był `OPEN` w linii 93 karty modułu.
- T2: `SOURCE_CONTENT`, `note`, `targetCommand.title` i `suggestedTitle` są literalnymi danymi fixture. Nie zmieniono ich.
- T3: pomiar zwrócił **21 wywołań**, nie 19. Parser kluczy zwrócił **19 unikalnych kluczy**, nie 18. Powtarzają się dwa klucze: `state.materializable` i `title` (po dwa wywołania). To rozbieżność pomiaru z tezą instrukcji i zgodnie z jej ostatnim zdaniem jest wynikiem dyżuru.
- T4: przed zmianą grep zwrócił `exit=1`, bez trafień w PL i EN.
- T5: obiekt `chat` istniał. Dodano do niego jeden siostrzany obiekt `governedHandoff`.
- Instrukcja odwołuje się w §0.1/Z24 do `§0.4a`, ale taki paragraf nie występuje w 753-liniowym dokumencie. Zastosowano bezpieczniejsze działanie zastępcze: zmierzono cały najbliższy katalog `src/components/AIChat/__tests__`, a nie tylko nowy test.

Konfiguracja `src/i18n.ts` używa i18next bez trybu legacy. Polski słownik już stosuje sufiksy `_one/_few/_many/_other`; dlatego `citations` otrzymał cztery realne formy i został sprawdzony dla `count=1`, `3`, `5`.

## Zakres zmian

`git diff --name-only d3d36cd5f5..HEAD` przed raportem:

```text
public/locales/pl/translation.json
src/components/AIChat/__tests__/GovernedChatHandoffCard.day179.i18n.test.tsx
```

Nie zmieniono `GovernedChatHandoffCard.tsx`, `en/translation.json`, seeda ani żadnego `server/**`.

## Testy i pułapki §0.2d/Z33

### Skupiony test day179

Komenda:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/AIChat/__tests__/GovernedChatHandoffCard.day179.i18n.test.tsx --retry=0 --reporter=json --outputFile=/private/tmp/cx-day179-czat-artefakty/day179-focused-green.json
```

Wynik: `4/4 PASS`, `numTotalTests=4`; trzy rendery: `pending`, `approved`, `rejected`; osobny test rozwiązuje wszystkie 19 unikalnych kluczy i polskie formy liczebne 1/3/5.

Pułapki (a)–(d) nie leżą na ścieżce: pakiet jest czysto renderujący, nie importuje Gateway, middleware ani DB. `RUN_DB_TESTS=0 MOCK_DB=true` jawnie kwalifikuje go jako jednostkowy. Pułapka (e) została wyłączona przez `vi.unmock('react-i18next')`, własną realną instancję i18next z zasobem PL oraz asercje przeciw każdemu angielskiemu fallbackowi. Bez `vi.unmock` globalny mock z `tests/setup.ts` zwracał fallback i trzy rendery były czerwone; nie zmieniono globalnej infrastruktury testowej.

### Pełny najbliższy pakiet AIChat

Komenda:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run src/components/AIChat/__tests__ --retry=0 --reporter=json --outputFile=/private/tmp/cx-day179-czat-artefakty/day179-aichat-full.json
```

Wynik: `332/332 PASS`, `85/85` suit, zero czerwonych `fullName`. Pułapki (a)–(d) nie dotyczą pakietu jednostkowego; (e) jest pokryta nowym testem realnego słownika w tym samym przebiegu.

## Dowód mutacyjny Z32

Mutacja: po skopiowaniu zielonego słownika przez `cp` zmieniono wyłącznie `chat.governedHandoff.title` na angielski fallback `Governed document proposal`.

Ta sama komenda z `--retry=0` dała `exit=1`, `0/4 PASS`; czerwone były test słownika i wszystkie trzy rendery. Po przywróceniu przez `cp` ta sama suita dała `4/4 PASS`. `diff -u` kopii zielonej z przywróconym plikiem nie wypisał żadnej linii.

## Realny runtime i zrzut

- kontener: `cx-day179-pg`, obraz `pgvector/pgvector:pg16`, port `127.0.0.1:6079`;
- obie pełne migracje dla `cx179`: pierwszy przebieg zakończony `Postgres migrations complete`, drugi `Applying migrations: 0`;
- fixture: `W3-CHAT-OWNER-v1`, baza `consultify_w3_chat_owner_day179`, manifest FINAL;
- runtime uruchomiony wyłącznie przez `scripts/dev/start-wave3-owner-runtime.mjs` na `5028/5029`;
- manifest runtime: health `200`, ready `200`, frontend `200`, SHA serwera/klienta `90636358bf...`, 869 migracji, oba stany migracji `ok`, test bypass `false`, dotenv serwera i Vite wyłączony;
- deep link `/chat/13000000-0000-4000-8000-000000000001` po logowaniu personą fixture i wyborze języka `pl` wyrenderował region `Kontrolowana propozycja dokumentu`, status `Oczekuje na weryfikację`, polskie provenance, `Zachowano 2 odwołania do źródeł`, `Źródło/Skrót/Wersja`, `Zatwierdź/Odrzuć`;
- angielskie `SOURCE_CONTENT` i `Pilot Atlas — Q3 evidence brief` pozostały danymi fixture;
- runtime zatrzymany własnym mechanizmem: proces groups zakończone, porty wolne, baza fixture zachowana do cleanup.

Zrzut:

```text
/private/tmp/cx-day179-czat-artefakty/day179-governed-handoff-pl.png
SHA-256 6e9feba62bece6fdf0a951fe521c5c6b7494f5b6e9739c4ca909a78c681769fc
```

## Z30 — brak wysyłki

Przed seedem i runtime: `BRAK ZMIENNYCH POCZTY`. Po migracjach i po seedzie zapytanie `settings WHERE key LIKE 'smtp%'` zwróciło `0 rows`. W nazwach zmiennych obu kwalifikowanych procesów nie było `SMTP_*`, `RESEND`, `SENDGRID` ani `MAIL*`. Logi nie zawierały próby transportu poczty.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## Artefakty i sumy

```text
6e9feba62bece6fdf0a951fe521c5c6b7494f5b6e9739c4ca909a78c681769fc  day179-governed-handoff-pl.png
829c7ba36fa9c00fe51b5667b0d1467067c2ea285462d0d9a1c56f7353b2cc8d  day179-focused-green.json
f899e30e6ec8d44c57eea2f01eba810fb5fb7a9db2ef83cb91b5c79873814448  day179-mutation-red.json
65ece3f628d002ffb4c4785239e31651c74eb6d32d3cefa88bd16973043174b3  day179-mutation-restored-green.json
1e99a6b544b5b38b76aa10b502ed8955dd577ffa08b99a14bea21927cdb1f099  day179-aichat-full.json
```

## TWIERDZENIA NIEZWERYFIKOWANE

- Owner retest po scaleniu z nowszym tipem: `OWNER_RETEST_PENDING`.
- Nie wykonywano decyzji Approve/Reject ani materializacji; dyżur mierzył teksty bez mutowania propozycji.
- Nie wykonano screenshotów pozostałych stanów. Ich tłumaczenia i trzy stany bramkowe są pokryte testem; jedyny zrzut pokazuje stan `pending`.
