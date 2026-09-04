# CODEX — DYŻUR 343 — DEC388 DOMKNIĘCIE

Data: 2026-09-04  
Gałąź: `codex/day343-dec388-domkniecie-20260904`  
Marker wejściowy: `6a4919f72db338e7f49a2cacb3787d20cc649883`  
Worktree: `/private/tmp/cx-day343-dec388-domkniecie`  
Zasoby wyłączne: PostgreSQL `127.0.0.1:6390`, Vite dev-render `127.0.0.1:5530`

## Werdykt

**R1–R5: wykonane. R6: raport i kontrola końcowa wykonane. DEC388: DOMKNIĘTE W ZAKRESIE DYŻURU, z zachowaniem default OFF.**

Nie jest to dowód gotowości produkcyjnej ani wdrożenia. Pełny wskazany pakiet pozostaje czerwony na tych samych 16 odziedziczonych asercjach: przed zmianą `344/360` PASS, po zmianie `353/369` PASS. Zestaw nazw 16 porażek jest identyczny; przyrost dziewięciu zielonych asercji pochodzi wyłącznie z nowych testów dyżuru.

## 1. Wejście, marker i izolacja

Instrukcja została pobrana z vaulta i przeczytana w całości (1138 linii) przed rozpoczęciem pracy. Katalog właściciela nie był używany do zmian ani uruchamiania produktu. Worktree rozpoczął pracę dokładnie z markera i był czysty:

```text
git rev-parse HEAD
6a4919f72db338e7f49a2cacb3787d20cc649883

git status --short
[brak wyjścia]

git merge-base --is-ancestor 6a4919f72d HEAD && echo "MARKER OK"
MARKER OK
```

Przed materializacją było 35 GiB wolnego miejsca, po materializacji 26 GiB; próg STOP 5 GiB nie został naruszony. Porty 6390 i 5530 były wolne. Kontener `cx-day343-pg` nie istniał przed dyżurem.

Tip `github-backup/grafika/m03-20260902` był przed markerem rozwinięty o instrukcje i raporty innych dyżurów. Zgodnie z instrukcją nie włączono tych zmian do podstawy produktu; jedynym źródłem prawdy wykonawczej pozostawała instrukcja 343 odczytana z tipa, a kod startował z markera.

## 2. Baza i bezpieczeństwo wysyłek

Uruchomiono wyłącznie `pgvector/pgvector:pg16` jako `cx-day343-pg`, baza `cx343`, bind `127.0.0.1:6390`. Migracje zakończyły się powodzeniem; drugi przebieg podał literalnie `Applying migrations: 0`. Liczba migracji zastosowanych w pierwszym przebiegu nie została zachowana w pełnym logu (zachowano tylko końcówkę), dlatego pozostaje `UNKNOWN`, bez rekonstrukcji.

Kontrola bezpieczeństwa:

- środowisko procesu: `BRAK ZMIENNYCH POCZTY`;
- tabela `settings`, klucze `smtp%`: 0 wierszy;
- kontrola drenażu w `Gateway.ts`: brak dopasowań;
- nie uruchamiano pełnego backendu, workerów, cronów ani drenażu outboxu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## 3. R1 — pomiar wejściowy i falsyfikacja starego testu

Rekord: `init-smed-linia-pakowania`. Szablon niepusty: `tpl-quick-win` / `szablon=quick-win`; wariant pusty: bez parametru szablonu.

| Wejście | Flaga | Pozycje | Grupy | localStorage | Console errors |
|---|---:|---:|---:|---|---:|
| quick_win | OFF | 6 | 3 | `null` | 0 |
| quick_win | ON | 24 | 5 | `null` | 0 |
| puste | OFF | 24 | 5 | `null` | 0 |
| puste | ON | 24 | 5 | `null` | 0 |

Dwie mutacje udowodniły lukę starego testu `initiativeTemplateNavigation.test.ts`:

- wtórny filtr po selektorze: stary test nadal `4/4` GREEN, realny DOM ON spadł z 24/5 do 6/3;
- resolver wymuszony na `false`: stary test nadal `4/4` GREEN, realny DOM spadł do 6/3.

Obie mutacje cofnięto bitowo (`git diff` pusty). Dowód dopisano do rejestru kompletności. Commit: `2b1a9f1416`.

## 4. R2 — test renderowanego widoku i trzy mutacje

Dodano `initiativeTemplateNavigationRendered.day343.test.ts`. Test uruchamia rzeczywisty dev-render widoku `KartaInitiativeScreen`, otwiera quick-win z flagą ON i sprawdza 24 jawnie wypisane identyfikatory oraz pięć grup. Nie opiera oczekiwania na importowanej produkcyjnej tablicy.

| Mutacja | Wynik RED | Po odtworzeniu |
|---|---|---|
| wtórny filtr po selektorze | brak 18 pozycji / tylko 6 | GREEN |
| resolver zawsze `false` | brak 18 pozycji / tylko 6 | GREEN |
| usunięcie `lessons-learned` z kanonicznej kolejności | `brak sekcji ... lessons-learned` | GREEN |

Po docelowej zmianie resolvera ponowiono mutację `false`; test ponownie był RED, a po odtworzeniu GREEN. Stary i nowy test razem: `5/5` GREEN. Timeout nawigacji ujawniony wyłącznie pod obciążeniem pełnego pakietu został ustabilizowany bez osłabiania asercji. Commity: `cab6c05bb2`, `b7092f9913`.

## 5. R3 — deskryptory 24 sekcji

Katalog kart wzrósł z 27 do 36. Dodano własne deskryptory dla dziewięciu brakujących sekcji: `deliverables-milestones`, `suggested-changes`, `change-log`, `okr`, `hypothesis`, `workstream-owners`, `used-in`, `artifacts`, `lessons-learned`. Jawna mapa `INITIATIVE_BOARD_DESCRIPTOR_BY_ID` obejmuje wszystkie 24 identyfikatory boardu; pozostałe 15 używa właściwych semantycznie istniejących deskryptorów.

Dodano brakujący klucz `initiatives.okr` w PL i EN. Liczba liści tłumaczeń: PL `35198 → 35199`, EN `33065 → 33066`. Nowe testy: `3/3` GREEN; usunięcie `lessons-learned` z katalogu daje jawny RED, po odtworzeniu `3/3` GREEN. Pełna tabela 24 pozycji została dopisana do `REJESTR_KOMPLETNOSCI_KART_20260904.md`. Commit: `7effce4702`.

## 6. R4 — jeden resolver, trzy warstwy, default OFF

Dodano `src/utils/initiativeSectionsCompleteFlag.ts`. Precedencja:

1. query `ff_initiative_sections_complete`,
2. localStorage `ff.initiative.sections_complete`,
3. statyczne `VITE_VF1_INITIATIVE_SECTIONS_COMPLETE`,
4. brak wartości → `false`.

Brak `window` także kończy się `false`. Widok korzysta z jednego resolvera. Pięć testów pokrywa default, precedencję query, precedencję localStorage, env oraz SSR: `5/5` GREEN. Mutacja default `false → true` dała `1` RED; po odtworzeniu `5/5` GREEN. Skan `.env*`, compose i Railway nie wykazał wpisów tej flagi. Commit: `eb9c6bc6fd`.

Uwaga interpretacyjna: końcowy skan tekstu źródłowego ma dwa wystąpienia nazwy env w module resolvera — stałą eksportowaną jako kontrakt oraz pojedynczy statyczny odczyt `import.meta.env`. W widoku nie pozostał bezpośredni odczyt.

## 7. R5 — para zrzutów z czystego produktu

Oba zrzuty: PL, light, 1440×900, ten sam rekord i quick-win, `dane=pelne`, pięć rozwiniętych sekcji, brak kontrolek harnessu, console errors `0`, HTTP errors `[]`, localStorage flagi `null`.

| Stan | DOM | Jasność | SHA-256 |
|---|---:|---:|---|
| OFF / PRZED | 6 pozycji / 3 grupy | 243.2952 | `189d6f3c1d680ada28a0c40a3f51e023cf89e544d3237125ad9b3c6523a1decb` |
| ON / PO | 24 pozycje / 5 grup | 242.9179 | `0cf20b0033fc277ddc01f28fbcb37f39839450163a902ee3c62dfcffb4458602` |

Pliki znajdują się poza repozytorium w `/private/tmp/cx-day343-dec388-domkniecie-artefakty/r5/`, zgodnie z zakazem dodawania artefaktów binarnych do drzewa produktu. Commit rejestru: `e80150b50f`.

## 8. Testy pełnego zakresu i porównanie nazw

Polecenie przed i po:

```bash
RUN_DB_TESTS=0 MOCK_DB=true npx vitest run tests/unit/initiatives tests/unit/cards tests/unit/flags/initiativeSectionsCompleteFlag.day343.test.ts --retry=0 --reporter=json --outputFile=...
```

| Pomiar | Wszystkie | PASS | FAIL |
|---|---:|---:|---:|
| PRZED | 360 | 344 | 16 |
| PO | 369 | 353 | 16 |

Porównanie `fullName`: dziewięć nazw dodanych, zero usuniętych, żadna nowa porażka. Te same 16 porażek dotyczy odziedziczonych obszarów `handleChatAction CREATE_INITIATIVE` (3), canonical Initiative register parity (2), `ExecutionControlSurface` (4), Execution canonical work/resources (6) i InitiativesHub canonical intake navigation (1). Nie były naprawiane poza zakresem.

SHA-256 dowodów:

- `day343-przed.json`: `acbf0fdee53dfa7506ddc7c7ed11cea5089961a9e72ad59de6b6a91a8cb2801c`
- `day343-po.json`: `9597d571d951471fda6cd9ccdd083bc470dd6fdb5a91cf32f3b96aade03101a0`
- `przed-nazwy.txt`: `ff705ee20c82bedf57a07dd869e2b138a7ab4517c6d7636dc94e13274404722a`
- `po-nazwy.txt`: `529d8f35715b705127807612a7944ba8afc1d054d1493dcf2aa709eb67d2121a`
- `nazwy.diff`: `ff79d4f392d0da9c57facc391fad0f460c7c2e6f06a673cf8c2d4a9744179282`

## 9. Pułapki testowe i granice dowodu

Pakiet jednostkowy celowo używał `RUN_DB_TESTS=0 MOCK_DB=true`; nie stanowi dowodu RealPG/ApiGateway/JWT. Nowy test R2 używa świeżej przeglądarki i rzeczywistego renderu widoku, lecz transport danych jest fixture dev-render, nie backend produkcyjny. W pomiarze browserowym localStorage pozostawał pusty, a warianty flagi były sterowane jawnie przez query lub build-time env.

Nie uruchomiono ani nie udowodniono: produkcji, demo, stagingu, Railway, deployu, realnego łańcucha HTTP/ApiGateway/JWT/PostgreSQL produktu, akceptacji właściciela ani zachowania na urządzeniu fizycznym. Default pozostaje OFF. Pierwsza liczba zastosowanych migracji pozostaje `UNKNOWN`; potwierdzono tylko powodzenie i zerowy drugi przebieg.

## 10. Korekty i rozbieżności instrukcji

- Instrukcja odwołuje się do §R.2, ale taki nagłówek nie występuje w pliku; raport zachowuje wszystkie jawnie wymagane pola bez odtwarzania nieistniejącego wzoru.
- Instrukcja oczekuje katalogu artefaktów, a jednocześnie zabrania dodawania binariów do repo. Zastosowano katalog poza repo i wpisy tekstowe w istniejącym rejestrze.
- Nie rekonstruowano brakującej liczby pierwszego przebiegu migracji.

## 11. Commity dyżuru

```text
2b1a9f1416 docs(day343): pomiar wejsciowy i odtworzenie dwoch mutacji obchodzacych test (343 R1)
cab6c05bb2 test(initiatives): kompletnosc 24 sekcji broniona renderem widoku, nie literalem (343 R2)
7effce4702 feat(initiatives): dopisz dziewiec brakujacych deskryptorow sekcji boardu (343 R3)
eb9c6bc6fd feat(initiatives): flaga kompletnosci sekcji rozstrzygana trojwarstwowo, default OFF (343 R4)
e80150b50f docs(day343): para zrzutow OFF-ON karty inicjatywy (343 R5)
b7092f9913 test(day343): ustabilizuj render karty w pelnym pakiecie
```
