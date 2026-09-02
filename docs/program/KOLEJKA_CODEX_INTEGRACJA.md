---
doc_id: program-kolejka-codex-integracja
status: canonical
data: 2026-09-02
---

# Kolejka prac Codexa — faza trzecia (pełna integracja)

Ten plik istnieje po to, żeby **wydanie kolejnych dyżurów nie zależało od kontekstu żadnej sesji**.
Każda pozycja ma dość treści, żeby złożyć z niej instrukcję generatorem
`scripts/dyzury/gen_instrukcja.py`, bez pytania nadzorcy o cokolwiek.

Kolejność jest ułożona wg **blokowania**, nie wg wielkości.

## Stan wyjściowy (zmierzony 2026-09-02)

- Moduły z `G17`+`G18` `PASS`: **15 z 16** (otwarty: `16_PARTNER`).
- Bramek zamkniętych: **151 z 336**.
- **Kolumny z zerem na 16:** `G05`, `G06`, `G13`, `G14`, `G15`, `G16`, `G19`, `G20`.
- Zamknięta jest **warstwa ekranowa**, nie działający system.

## WYDANE, czekają na wykonanie

| Nr | Rzecz | Zakres | Stan |
| --- | --- | --- | --- |
| **279** | `G05` — przelot funkcjonalny i odczyt na zimno, 16 modułów | POMIAR | wydany, wklejka gotowa |
| **280** | `G06` — języki, motywy, rozdzielczości, konsola, 16 modułów | POMIAR | wydany, wklejka gotowa |
| **281** | **P0** — schemat bazy od zera | POMIAR + wąska NAPRAWA | wydany, wklejka gotowa |
| **282** | Sześć przepływów międzymodułowych | POMIAR | **w toku**, znalazł P0 z 281 |

★ **283 wykonany przez robotnika nadzorcy 02.09** — zrzuty Partnera gotowe, sześć znalezisk niżej.

Marker wszystkich czterech: `eeb253c3ec`. Gałąź odczytu: `github-backup/grafika/m03-20260902`.

## DO WYDANIA — kolejka fazy trzeciej

### 283 · Partner — zrzuty i przegląd
Jedyny moduł bez `G17`/`G18`. **Nie ma w rejestrze grafiki ani jednego ekranu.**
`partner-settlements-view` **nie należy** do tego modułu (to SuperAdmin → Revenue, policzony
w Administracji wg pola `gdzie`). Zakres: ustalić, co realnie renderuje się pod `/partner`
(uwaga na kształt „wołacz istnieje ≠ renderuje się”), zrobić komplet zrzutów jasny/ciemny,
pusty/pełny, opisać językiem właściciela. **Jeśli portal praktycznie nie istnieje — to jest wynik.**
*W chwili pisania robi to robotnik nadzorcy; jeśli nie dowiezie, wydać jako dyżur.*

### 283b · Partner — sześć znalezisk z przeglądu 02.09
Zrzuty zrobione (**25 sztuk**, `evidence/grafika/16-partner/`, para jasny/ciemny sprawdzona:
różnica luminancji 213-228 przy progu 150, 99,1-100% różnych pikseli). Inwentarz i opisy:
`docs/program/grafika/PRZEGLAD_16_PARTNER_20260902.md`. Portal **istnieje i renderuje się**:
`/partner/*` montowane w `src/routes/AppRoutes.tsx:3494` jako `PartnerPortalViewNew`, gate to
wyłącznie `requireAuth`, **zero flagi frontendowej**. Znalezione defekty, potwierdzone w źródle:

1. **Zero ekranów listowych z podglądem po kliknięciu w wiersz** — w całym module.
2. **Kebab wiersza działa tylko w tabeli kampanii**; pozostałe trzy tabele mają `hideRowActions`.
3. **`projects` i `users` w Zarządzaniu klientami to bespoke karty**, nie `FilterableTable`
   ani `StandardTable` — naruszenie kanonu list z CLAUDE.md §9.
4. **Crimson (`primary-*`) jako kolor dekoracyjny w 5 plikach, 45+ wystąpień** — pułapka nr 1
   z CLAUDE.md; czerwień wolno wyłącznie dla semantyki krytycznej.
5. **Twardy znak € w Pulpicie** (`PartnerPortalView.tsx:345`) obok PLN na tym samym ekranie.
6. **Cztery miejsca z twardo wpisanym angielskim tekstem w polskim UI** — m.in. nagłówek
   „Documentation" obok okruszka „Dokumentacja", surowy enum „Subscription Renewal".

★ **`G07`-`G12` tego modułu NIE zostały zamknięte i nie wolno ich zamknąć bez oczu właściciela** —
to jedyny moduł, którego nigdy nie widział. Zrzuty są gotowe do jego przeglądu.

### 284 · Cykl napraw `G13`–`G16` z rejestrów 279, 280 i 282
Cztery bramki po zero na szesnaście. **Nie da się ich wydać przed 279/280/282** — ich treścią jest
analiza wpływu, naprawa z tropem do commita, self-QA i pakiet przed/po dla znalezisk, których
jeszcze nie mamy spisanych. Wydać **natychmiast po** powrocie tamtych trzech rejestrów, wąsko,
po jednej rodzinie defektów na dyżur. Nie robić jednego wielkiego.

### 285 · `ResultsHub` — martwy rodzic
Zmierzone 2026-09-02: `ResultsHub.tsx` **nie ma wpisu w żadnej trasie** (od `8df1cd413d`, 24.08);
`/results` montuje `ResultsOwnerReviewEntry.tsx:12`, która przekierowuje dalej. Montuje kilka
tysięcy linii: `KPITimeSeriesDrawer` (104 KB), `RecoveryCardPanel` (83 KB), `StrategicLayerPanel`,
`AIInsightsPanel`, `PortfolioInsightsPanel`, `TransformationScorecard`, `ValueDriverTree`,
`M14HandoffInbox`. **Wymaga decyzji właściciela przed usunięciem** — część (diagnostyka odchyleń,
karta naprawcza) jest w aktywnym, osobno flagowanym rozwoju. Dyżur ma najpierw **wypisać, co żywe,
a co martwe**, dopiero potem ciąć.

### 286 · Rodzina `TableWithPreviewLayout` — około 48 konsumentów bez poprawki wysokości
Poprawka wysokości podglądu objęła **pięć zakładek Realizacji** (zmierzone: luka 154 px → 0 px).
Poza nią zgrepowano **~48 innych konsumentów**: Moja praca (15 kolejek decyzyjnych), Inicjatywy,
Wywiad, Finanse/Economics, Wyniki/ResultsVNext, Discovery, Benefits, AgentHub, ChatSignalsFeed,
Vault i inne — **niezmierzonych**. Znany kształt: naprawa per-wywołanie odrasta.
Narzędzie pomiarowe **już istnieje**: `scripts/dev/measure-preview-canon.mjs --wysokosc`.
Dyżur: przejechać nim wszystkie konsumenty, wydać rejestr, dopiero potem naprawiać rodzinami.

### 287 · Trzy dziury cross-org — weryfikacja, czy naprawdę zamknięte
`SCIEZKA_WYJSCIA_V2.md` §A wymienia je jako blokujące odbiór: wnioski o uprawnienia, wideo,
kontekst AI (ten ostatni ma **dwie** trasy, nie jedną). Opisane jako „wygaszone flagą na demo,
żywe kodowo wszędzie indziej”. **Zweryfikować parą dowodów: obcy NIE widzi + właściciel widzi**,
na realnym łańcuchu — sam fail-closed nie wystarcza, bo bywa zielony przez wygaszenie kontekstu.

### 288 · Rodzina „surowe ID zamiast etykiety”
Z dyżuru Finansów: `base_period_id` okazał się ogólniejszy niż zakładano — to dowolny okres
zakotwiczenia pakietu. Naprawiono okres otwarcia i zakotwiczenia, ale **rodzina może mieć dalsze
wystąpienia** w innych modułach. Szukać po wzorcu sklejania, nie po napisie.

### 289 · Rozliczenie 77 uwag z rejestru odbioru
`waves/WAVE_03_ACCEPTANCE/BACKLOG_UWAG_ODBIORU_20260902.md` — 77 uwag właściciela z własnymi
identyfikatorami. **Hipoteza warta zmierzenia:** duża część jest już naprawiona i nigdy mu nie
pokazana — tak było dziś z kartą ROI, przyciskiem w Finansach i wysokością podglądu. Dyżur:
dla każdej uwagi ustalić stan (zrobione / drobne / realny backlog) i dla „zrobione” **przygotować
zrzut do pokazania**, nie kolejną naprawę.

### 290 · `W5` — staging
Dystans **668 commitów**. Kolejność z `SCIEZKA_WYJSCIA_V2.md`: obejrzeć 10 cudzych commitów
`develop` → punkt bezpieczny → decyzja o flagach → pchnięcie (wdrożenie automatyczne) → **migracje
na pustej bazie**. ★ **Nie wydawać przed zamknięciem 281** — dziś na świeżym PostgreSQL rejestracja
użytkownika nie przechodzi. Staging dostanie pustą bazę i trafi dokładnie w to.

### 291 · `G19`/`G20` — finalny przebieg 16/16
Zero na szesnaście, obie. Z natury **ostatnie**: `G19` to obowiązki regresyjne po późniejszych
zmianach, `G20` to finalny przebieg wszystkich szesnastu. Wydać dopiero, gdy 279, 280, 282, 284
mają zamknięte rejestry.

## Reguły, które muszą wejść do KAŻDEJ instrukcji z tej kolejki

1. **Zdanie „zmierz moje liczby sam”.** Dziś złapało trzy fałszywe tezy nadzorcy w jedno
   popołudnie: nieistniejącą „rodzinę trzech” w Materiałach, poprawkę podglądu rzekomo
   niewniesioną (była już przodkiem bazy) i zakres `base_period_id`.
2. **Commit po każdej pozycji `R`, nigdy na koniec.** Instrukcja na 1394 linie urwała okno
   wykonawcy po fazie wejściowej, z zerem commitów.
3. **Jawne prawo zatrzymania.** Częściowy rejestr z uczciwą granicą jest pełnowartościowym
   wynikiem; rejestr z domysłami nie jest wart nic.
4. **Pomiar poza `vitest`.** `tests/setup.ts:858-896` podmienia `global.fetch` na atrapę
   zwracającą zawsze `ok:true`. Dowód idzie skryptem `npx tsx`.
5. **Potwierdzenie odczytem na zimno**, nigdy odpowiedzią zapisu — `Database.ts:686` zwraca
   `changes:1` dla każdego `UPDATE`, także takiego, który nic nie trafił.
6. **`NODE_ENV=test` bez `RUN_DB_TESTS=1`** podstawia atrapę bazy pod `DbPromise`. Bramkę
   `databaseTargetResolver.ts:152` na lokalny `127.0.0.1` otwiera się `CI=true`, **nie**
   `NODE_ENV=test`.
7. **Zero Railway, zero demo/stagingu/produkcji — nawet do odczytu.** Jednorazowy lokalny
   PostgreSQL, kasowany po pomiarze.
8. **Zrzuty tylko kanonicznym narzędziem**, z liczbami różnicy jasny/ciemny i bez kontrolek
   harnessu w kadrze.
