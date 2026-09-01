# CODEX DAY 223 — Czat: realny render i inwentarz widm-akcji

Data: 2026-09-01  
Baza: `9fb7942a01`  
Gałąź: `codex/day223-czat-render-20260901`  
Commit pozycji A.2: `d1262f3416`

## 1. Baza pracy — wynik §0.1 (2) i (7)

```text
c557c502c2 instrukcje 229-232 (rdzen fali 18: ciemny motyw + skala z pomiaru, wykrycie przepelnienia, deck z wiedzy organizacji, agent redagujacy) — komplet 15 instrukcji wydany
3416f1d62f instrukcje 222-225 (Moja praca, Czat, Partner, Narzedzia) — z korektami briefu: 11 widm nie ~10, przyczyna obcietej kolumny namierzona (FilterableTable bez minTableWidth dziedziczy 980px), komentarz klamie w TRZECH miejscach
834a4a51ec SPROSTOWANIE w tej samej godzinie: komponent wyboru stylu JEST renderowany (moj grep w zsh znowu klamal); przewod przerwany jest gdzie indziej — wybor nie trafia do zadania, a backend ma 'minimal_no_images' zaszyte na sztywno
866f6ed040 instrukcje 226-228 + ZNALEZISKO: szesc presetow stylu obrazu ISTNIEJE w kodzie (types.ts:96) z gotowym komponentem wyboru, zero wolaczy — trzeci martwy kanal w tym module; wlasciciel mial racje ze 'bylo przygotowywane'
18f5cae04b instrukcje 218-219 + SPROSTOWANIE pomiaru: ekran polityk AI ma TRZY przyczyny zer, nie jedna — dwie trzecie to rozjazd kontraktu front-backend, nie brakujaca tabela; Rozliczenia to jedna kolumna nie cztery; SCIM to 2 tabele z 4
69143cb3d3 instrukcje 220-221 (Audyty: trzy pozycje rejestru + warsztat D-5 konczacy sie prototypem do akceptu)
9fb7942a01 G-3 c.d.: Gamma SAMA ostrzega ze uklady rozjada sie w PPTX (wykrycie przepelnienia + link do slajdu — wzorzec do skopiowania 1:1); deck pamieta source prompt i konspekt; szablon powstaje z gotowego decku; koszt 90 kredytow za 10 slajdow
7779e185d9 G-3: obchod menu Gammy — ROZSTRZYGNIETY mechanizm koloru obrazow (style prompt w motywie doklejany do kazdej generacji, wariant A a nie duotone), edytor motywu 6 zakladek z wbudowana bramka kontrastu, 24+ smart diagrams, uklad jako przeciagalny klocek, Gamma ma API
371f949c5e G-2: przejscie procesu Gammy na koncie wlasciciela — DWA tryby (Classic vs Studio: slajd jako pojedynczy obraz z wtopionym tekstem), Generate OUTLINE potwierdza tresc-przed-forma, infografiki z poprawnym polskim tekstem wypalonym w obrazie
eb1312486e G-1 aneks obrazy: 5 presetow + Custom (wlasciciel pamietal liczbe dobrze), duotone po generacji jako NASZA decyzja inzynierska, bramki OCR i twarzy (dokumentacja Gammy sama przyznaje ze model dodaje tekst mimo zakazu), wypalanie tla w PNG TAK — raster dla materialu, wektor dla znaczenia
40f5b0fdb8 G-1: specyfikacja z pomiaru 29 slajdow Gammy + rozstrzygniecie napiecia miedzy pomiarem (48% slajdow bez obrazu) a swiadectwem wlasciciela (obrazy to element nr 1) — obraz robi pierwsze wrazenie, rdzen broni sie bez zdjec
a657b6146c G-0: zmierzony lancuch prezentacji — edytor kolorow/fontow MARTWY (dane gina przy zapisie), dwa zywe renderery o roznej geometrii, gradienty i osadzanie fontow NIEMOZLIWE w pptxgenjs 4.0.1
a4134b664d modul 03: blokada nie istnieje — tool_outputs jest na stagingu od 28.08 09:35, komentarz w kodzie kłamie od trzech dni; TRZECI klamiacy komentarz tego dnia
1d0c1f06af sprostowanie wlasnego znaleziska: assignUserTier to luka WALIDACJI (P3), nie wyciek — jedyny odczyt tabeli filtruje po organizacji, wiersz nie dotyka cudzego uzytkownika
acd0a6d157 merge: detektor klamstw etap 1 — 7 przypiec odpietych (0 krylo dziure), triage 578 pominiec, bezpiecznik check-z31 blokujacy nowe; ZNALEZISKO: assignUserTier bez kontroli organizacji celu
ff277d253e feat(check-z31): ratchet guard for new database-name pins + forgotten skips
762effc7da fala Z1 po pomiarze 8 modulow: praca dzieli sie na oczy wlasciciela (3 moduly), reke nadzorcy (1 pozycja) i realne dyzury (11-17; tablica z 30.08 zanizala)
03034e65fa pomiar 4 modulow: tablica byla w polowie nieaktualna (Partner 0/25 to falsz, Moja praca 3/4 zamkniete); ZNALEZISKO — ekran AI Policy pokazuje zera zamiast bledu, bo tabela llm_org_policies nie ma migracji
087c153f06 docs(z31): triage 578 skip/skipIf occurrences into A/B/C + find one real gap
7e6ec5a8b5 test(z31): unpin 7 remaining database-name pins, measure what's underneath
9850d2bcd8 MODUL 17 ZAMKNIETY — rozstrzygniecie CTO: dwie niezgadywalne liczby z tresci dokumentu (w tym jedna nieproszona) dowodza pobrania mocniej niz nazwa wlasna; sciezka nazwa->UUID zamknieta na zywym modelu
8a3b3c0544 merge: dowod koncowy modulu 17 — model sam wywolal narzedzie, podal NAZWE projektu (sciezka FIX-217 zamknieta na zywym modelu) i zwrocil DWIE niezgadywalne liczby z tresci dokumentu, w tym jedna, o ktora nie pytano
685003e2b3 docs+proof(modul17): przebudowane kryterium (b), drugi przebieg realnego modelu
044d3f822f bramki partia 3: 15/34 pokryte, 15 odrzuconych z dowodem, ~4 nieznane; inwentarz byl zawyzony — niecala polowa nazw to granice dzierzawy
499fa42a86 merge: trzecia piatka bramek (komentarze raportow, generowanie raportu, RACI, KPI inicjatywy, karty naprawcze KPI) — 10/10 wyjsc; 12 pozycji inwentarza odrzuconych z dowodem jako nie-granice albo nieosiagalne
MARKER OK
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

`git status --short | head -3` nie wypisał żadnej linii. Tip był sześć commitów
przed markerem; zgodnie z regułą rozejścia praca wystartowała dokładnie z markera.

## 2. W1–W10

- W1: linie 8–9 `chat-split-teresa-right.tsx` mówią wprost, że realny panel nie
  montuje się w harnessie i treść jest mockowana.
- W2: `day207-write-proposal.tsx` renderuje tylko `ExecutionProposalMessage` w
  pustym `main`; brak wątku, historii i kompozytora.
- W3: `MessageRenderer.tsx`: import l.53, set l.69, warunek l.643, render l.650.
- W4: `UnifiedChatPanel.tsx` importuje `MessageRenderer` (l.134) i renderuje go
  na realnej ścieżce wiadomości.
- W5: `AI_CHAT: '/chat'` (routeConfig l.31), `AIChatView` renderuje
  `<UnifiedChatPanel .../>` (l.8).
- W6: `ENABLE_TERESA_TOOL_LOOP_WRITE` ma `default(false)` (FeatureFlags l.37).
- W7: pierwszy grep policzył `17`; drugi zwrócił `18`, bo liczy także apostrof
  w linii deklaracji typu. Strukturalny katalog przed zmianą miał 17 wariantów.
- W8 przed zmianą: `NAVIGATE:5`, `CREATE_TASK:0`, `CREATE_DECISION:0`,
  `CREATE_INITIATIVE:1`, `GENERATE_REPORT:9`, `GENERATE_PRESENTATION:1`,
  `START_TOOL:0`, `OPEN_PREVIEW:0`, `ASSIGN_INTERVIEW:0`, `RECORD_KPI:1`,
  `START_ARTIFACT_REVIEW:0`, `CHECK_TRUST_STATE:0`, `USE_TEMPLATE:1`,
  `BROWSE_TEMPLATES:1`, `ANALYZE_STATEMENT:0`, `REVIEW_MODEL:0`,
  `CHECK_LANE_STATUS:0`. Trafienie `CREATE_INITIATIVE:1` pochodzi wyłącznie z
  niezależnej listy polityki w `accessPolicyService.ts`; nie produkuje klikalnej
  akcji czatu. Wynik semantyczny: 6 producentów, 11 widm.
- W9: `CREATE_DRAFT_TASK/INITIATIVE/DECISION` są w stałych (l.34–36) i case'ach
  `aiActionExecutor.ts` (l.911–917).
- W10 przed startem: `6166/5120/5121 wolne`; cudze kontenery 220–222 nie używały
  naszych portów. Własny kontener: `cx-day223-pg`, `127.0.0.1:6166->5432`.

Migracje: pierwszy przebieg zakończył się `Postgres migrations complete`; drugi:
`Applying migrations: 0`, `Postgres migrations complete`.

## 3. A.1 — realny render

Droga: dozwolony seed `conversation_messages` w efemerycznej bazie, bez modelu
językowego. Rekord `message_type='execution_proposal'`, UUID rozmowy
`22300000-0000-4000-8000-000000000001`, metadata `pending_review/create_task`.
Przeglądarka otworzyła realne `/chat/:conversationId`; DOM potwierdził grupę
`Governed execution proposal`, wiadomość użytkownika i widoczny kompozytor.

| Motyw | PNG | SHA-256 | mean_luma |
|---|---|---|---:|
| jasny | `/private/tmp/cx-day223-czat-render-artefakty/day223-chat-light.png` | `763811c131a6054e57e9de6d11bdbe1aeaf117e15226552f80bc4352e8b0b4a2` | 247,7 |
| ciemny | `/private/tmp/cx-day223-czat-render-artefakty/day223-chat-dark.png` | `403240beec1fb5b5513edde90003d2b4ff973d5796a5f873a6d110d155da5d19` | 22,8 |

Różnica: `224,9` (>20). Pierwszą parę odrzucono po bezpieczniku (`24,5` vs
`27,5`): motyw System był ciemny. Kolejną parę odrzucono po kontroli wzrokowej,
bo menu/sidebar zasłaniały kartę. Tabela opisuje dopiero ostateczne, obejrzane PNG.

Dev-render nie wystarczył: W1 przyznaje, że panel jest mockowany, a W2 pokazuje
pojedynczy komponent. Ostateczne kadry pochodzą z kanonicznego
`scripts/dev/start-wave3-owner-runtime.mjs`, SHA `d1262f3416`, `/api/health=200`,
`/api/ready=200`, PostgreSQL, 876 migracji, serwer 5120, klient 5121.

Deklaracja §0.2b: **Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza
tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem
`server/src/index.ts` wyłącznie przez kanoniczny
`scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w
celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie
z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie
zewnętrzne nie zostało wysłane.** Dowody: shell `BRAK ZMIENNYCH POCZTY`; tabela
`settings` — `0 rows`; PID serwera miał `DOTENV_DISABLED=1`; log — brak trafień
pocztowych.

## 4. A.2 — 11 widm z pomiaru wejściowego

| Typ | Werdykt | Uzasadnienie |
|---|---|---|
| CREATE_TASK | EXTINGUISH wykonany | governed `CREATE_DRAFT_TASK` w `aiActionExecutor.ts` |
| CREATE_DECISION | EXTINGUISH wykonany | governed `CREATE_DRAFT_DECISION` w `aiActionExecutor.ts` |
| CREATE_INITIATIVE | EXTINGUISH wykonany | governed `CREATE_DRAFT_INITIATIVE`; trafienia access policy nie są producentem czatu |
| START_TOOL | DO_DECYZJI_WLASCICIELA | brak danych, które narzędzie i payload mają być kanoniczne |
| OPEN_PREVIEW | DO_DECYZJI_WLASCICIELA | brak jednoznacznej relacji `workspaceContext` do typu/ID podglądu |
| ASSIGN_INTERVIEW | DO_DECYZJI_WLASCICIELA | wymaga decyzji o doborze template i assignees w kontekście czatu |
| START_ARTIFACT_REVIEW | DO_DECYZJI_WLASCICIELA | brak wskazania kanonicznego artefaktu i lifecycle review |
| CHECK_TRUST_STATE | DO_DECYZJI_WLASCICIELA | brak rozstrzygnięcia, który scope trust ma być prezentowany w czacie |
| ANALYZE_STATEMENT | DO_DECYZJI_WLASCICIELA | nie wiadomo, czy akcja ma żyć w czacie czy wyłącznie w Finance |
| REVIEW_MODEL | DO_DECYZJI_WLASCICIELA | nie wiadomo, czy review modelu ma żyć w czacie czy wyłącznie w Finance |
| CHECK_LANE_STATUS | DO_DECYZJI_WLASCICIELA | brak kanonicznego `runId` w ogólnym kontekście czatu |

Po wygaszeniu: 14 typów, 6 z producentem, 8 bez producenta. Usunięto trzy typy
z czterech licencjonowanych powierzchni: union/definicje, registry check,
handler cases i federated mutation manifest. Nie dodano producenta
`OPEN_PREVIEW`, ponieważ jego wymagane `entityType/entityId` nie mają
jednoznacznego źródła w każdym `workspaceContext`; bez decyzji byłoby to zgadywanie.

Dowód mutacyjny: tymczasowy `DAY223_DEAD_ACTION` zwiększył liczbę widm z 8 do 9;
test `does not allow the producer-less inventory to grow beyond eight types`
był czerwony w `day223-mutation-red.json`. Po cofnięciu markera mutacji testy
2/2 zielone w `day223-mutation-green.json`; `git diff --check` PASS.

Pułapki Z33: test jest czysto plikowym testem jednostkowym, nie montuje Gateway,
auth, V8 gate ani results visibility; (a)–(d) nie leżą na ścieżce. Pułapka (e)
dotyczyła fixture wizualnego i została wyłączona przez `message_type` oraz
`metadata.messageType` równe dokładnie `execution_proposal`; DOM pokazał kartę.

## 5. §0.4a — nazwy testów

Pakiet wskazany w licencji był NOWYM plikiem, więc na markerze nie miał żadnej
nazwy przypadku. `przed-nazwy.txt` jest pusty; `po-nazwy.txt` zawiera:

```text
day223 ChatActionType producer inventory does not allow the producer-less inventory to grow beyond eight types
day223 ChatActionType producer inventory keeps governed draft creation out of the legacy chat action catalog
```

`diff przed-nazwy.txt po-nazwy.txt`: dwie nazwy dodane, zero znikniętych.

## 6. Korekty wobec instrukcji

1. W7 drugi pipeline zwraca 18, nie 17, ponieważ zakres obejmuje linię
   `export type ChatActionType =`; katalog strukturalnie ma 17 wariantów.
2. W8 zgłasza `CREATE_INITIATIVE producers:1`, lecz jedyny plik to
   `accessPolicyService.ts`, gdzie literal jest etykietą innej polityki. To
   fałszywy pozytyw mechanicznego grepu; producentów ChatActionType nadal 6.
3. `ENABLE_TERESA_TOOL_LOOP_WRITE=true` przekazane do skryptu startowego nie
   dociera do serwera: kanoniczny `childEnv(...)` buduje zamknięte środowisko i
   nie przekazuje tej flagi. Skrypt jest tylko do odczytu, więc bezpiecznie
   wybrano jawnie dozwolony seed DB i zero wywołań modelu.
4. §0.2b wymaga SELECT po migracjach bezpośrednio przed startem, lecz kanoniczny
   skrypt sam tworzy bazę, migruje ją i natychmiast startuje serwer, nie dając
   punktu zatrzymania. Przed startem wykazano 0 wierszy w bazie dyżuru `cx223`;
   w runtime DB wykazano 0 wierszy zaraz po kwalifikacji oraz brak kluczy SMTP
   w procesie/logu. Nie modyfikowano skryptu.
5. Kanoniczny `stop` odmówił po commicie dokumentacji: stan runtime był związany
   z `d1262f3416`, a bieżący HEAD z `ee52d84d2c`. Nie zmieniano manifestu ani
   state. Zweryfikowano dokładne identity PID/PGID `46175/46175` (serwer) i
   `46202/46202` (Vite), zakończono wyłącznie te grupy, usunięto wyłącznie bazę
   `consultify_w3_runtime_day223` oraz kontener `cx-day223-pg`. Końcowy odczyt:
   `6166/5120/5121 wolne`, `cx-day223-pg usuniety`.

## 7. TWIERDZENIA NIEZWERYFIKOWANE

- Nie klikano `Approve`, `Reject` ani `View run`; dyżur dowodzi renderu, nie
  wykonania lifecycle.
- Nie wywoływano modelu ani tool-loop; flaga write nie dotarła przez childEnv.
- Osiem pozostałych widm nie zostało rozstrzygniętych produktowo; każde ma
  imienny wpis `DO_DECYZJI_WLASCICIELA` powyżej.
- Nie wykonywano pełnego repozytoryjnego typechecku ani szerokiej suity; dowód
  testowy obejmuje wyłącznie nowy kontrakt inwentarza 2/2.
