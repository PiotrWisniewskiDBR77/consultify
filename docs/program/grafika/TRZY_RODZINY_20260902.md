---
doc_id: grafika-trzy-rodziny-20260902
status: canonical
truth_type: repair-report
established: 2026-09-02
galaz: grafika/trzy-rodziny-20260902
zrzuty: evidence/grafika/217-trzy-rodziny/
---

# Trzy niedokończone rodziny + defekt `execution-tab-control` — domknięcie u przyczyny

Zlecenie: `POPRAWIONE_20260902.md` § „NAJWAŻNIEJSZE ZNALEZISKO DNIA". Oględziny 196 zrzutów
wykazały, że z jedenastu meldowanych rodzin **trzy żyją dalej** — poprzedni wykonawcy naprawili
punkt, nie rodzinę (REGUŁA NR 20). Ten dokument zamyka je u przyczyny, z dowodem w obrazie.

**Pierwsza liczba, zgodnie z regułą 13: obejrzałem 24 świeże zrzuty (12 ekranów × 2 motywy),
wszystkie zrobione PO naprawie, wszystkie we własnym katalogu `evidence/grafika/217-trzy-rodziny/`.**

---

## RODZINA 1 — odmiana liczebnika

### Zasięg zmierzony (własnym poleceniem, nie z cudzego meldunku)

Narzędzie pomiarowe: skrypt przechodzący `public/locales/pl/translation.json` w całości, dzielący
znaleziska na dwie klasy. Wynik PRZED naprawą:

| klasa | liczba |
| --- | --- |
| **A — proteza w nawiasie** (`harmonogram(ów)`, `reguł(y)`, `blok(ów)`) przy zmiennej liczbowej | **16 kluczy** |
| A2 — proteza w nawiasie WEWNĄTRZ istniejącej rodziny mnogiej | 0 |
| **B — `{{count}} + rzeczownik` bez rodziny `_one/_few/_many/_other`** | **314 kluczy** |
| kluczy, które JUŻ używały natywnego mechanizmu i18next | 285 |

Poprzedni pomiar mówił „~68 wystąpień w ~46 plikach i 156 kluczy". **Ta liczba była zaniżona
w klasie B (314, nie 156) i zawyżona w klasie A** — protez w nawiasie z liczebnikiem jest 16,
a nie 68; pozostałe wystąpienia nawiasu to jednostki (`(dni)`, `(h)`, `(cron)`) i formy rodzaju
(`Podpisał(a)`, `Zatwierdził(a)`), które **nie są** defektem odmiany liczebnika.

★ Trop z reguły 20 potwierdzony dosłownie: `ExecutionSummaryOneLook.tsx` **już miał** poprawne
`liczebnik(row.ageDays, ['dzień','dni','dni'])` w linii 373 — a pięć liczników niżej w tym samym
pliku nie miało nic. Istniejąca poprawna implementacja obok była najsilniejszym sygnałem.

### Co naprawione

**Mechanizm: żadnego trzeciego.** Klucze i18n → natywne `_one/_few/_many/_other` i18next
(285 kluczy już tak działało). Twarde ciągi w TSX → wspólna funkcja `liczebnik()`
(`src/utils/liczebnik.ts`, test 11 przypadków). Trzeci mechanizm — lokalną kopię reguły CLDR
w `dev-render/screens/results-zestawienia.tsx` — **usunięto** na rzecz `liczebnik()`.

| miejsce | było | jest |
| --- | --- | --- |
| **16 protez w nawiasie** (pl + en, po 4 / po 2 formy) | `5 harmonogram(ów)`, `0 reguł(y)`, `{{count}} blok(ów)` … | rodziny mnogie; **klasa A = 0** |
| `myWork.calendarView.partialLoadSuggestion` + `heavyLoadSuggestion` + `calendarCreateEvent.itemsOnThisDay` | `Wybrany dzień ma 1 pozycji.` | `…ma 1 pozycję.` |
| `ExecutionSummaryOneLook.tsx` — **cały plik, 5 liczników** | `1 pozycji`, `1 blokery`, `0 ryzyko`, `0 wolne`, `0 osób` | `1 pozycja`, `1 bloker`, `0 ryzyk`, `0 wolnych`, `0 osób` |
| `ExecutionWorkSurface.tsx:741` | `1 powiązanych dowodów` | `1 powiązany dowód` |
| `results-zestawienia.tsx` | własna `pluralizeWskaznik` (trzeci mechanizm) | delegacja do `liczebnik()` |

Wołacze, które musiały zacząć przekazywać `count` (i18next pluralizuje WYŁĄCZNIE po `count`):
`CalendarView.tsx` (2×, `totalItems` → `count`), `TemplateBuilder.tsx` (`warnings` → `count`).
Pozostałe 16 wołaczy sprawdzono jeden po drugim — już przekazywały `count`.

**Pomiar PO naprawie: klasa A = 0 · klasa B = 296 · kluczy z rodziną mnogą = 361 (+76).**

### Co odłożone — z liczbą

**296 kluczy klasy B** (`{{count}} + rzeczownik` bez rodziny mnogiej). Wpis w `ODLOZONE.md`.
Powód odłożenia: to nie jest defekt widoczny na żadnym z 12 ekranów tego zlecenia, a naprawa
dotyka 296 kluczy w dwóch plikach zbiorczych — idzie osobną, mierzalną partią. Formy rodzaju
(`Podpisał(a)`, `utworzył(a)`, `Rozwiązał(a)`, `Zatwierdził(a)`, `zaktualizował(a)` — 6 kluczy)
NIE są objęte: nawias rodzaju to poprawna polska konwencja, nie proteza.

---

## RODZINA 2 — łamanie wyrazu w połowie

### Zasięg zmierzony i PRZYCZYNA, której poprzednia naprawa nie ruszyła

Poprawka `parsePx` z 02.09 (procent nie udaje pikseli) **zamknęła zapadanie kolumny do 10 px** —
sprawdzone: w definicjach `TableColumn` w `src/` i `dev-render/` zostało **0 szerokości
procentowych**. Ale defekt wizualny żył dalej, bo przyczyna jest **piętro niżej i nie ma z
procentami nic wspólnego**:

> `td` w `FilterableTable.tsx` nosi `break-words` (= `overflow-wrap: break-word`) jako ostatnią
> deskę ratunku. Ta reguła jest **dziedziczona**. Treść, którą moduł zwraca z `render` jako GOŁY
> tekst, była chroniona warstwą `CELL_TEXT_CLAMP_CLASS` od 30.08. Treść zwracana jako **WŁASNE
> ELEMENTY** (`<div>`, `<span>`, dwie linie, chip) nie była chroniona niczym — siedziała
> bezpośrednio pod `td` i dziedziczyła `break-word`, czyli rozrywanie wyrazu.

Oba zgłoszone przypadki to dokładnie ta gałąź: `chat-signals-feed` (kolumna Sygnał zwraca
dwuliniowy `<div>`), `results-zestawienia` (kolumna Wskaźniki zwraca `<span>`).

### Rozstrzygnięcie u źródła (decyzja nadzorcy wg reguły 0)

Kanon tabel już rozstrzyga tę sprawę — komentarz przy `CELL_TEXT_CLAMP_CLASS`: **„granica wyrazu,
nigdy środek wyrazu"**. Wybrałem więc egzekwowanie istniejącej reguły, nie nową:

1. **Naprawa RODZINY, w jądrze:** nowa stała `CELL_ELEMENT_WRAP_CLASS = 'min-w-0 break-normal'`
   opakowuje KAŻDĄ treść elementową w `td`. Zbija dziedziczone `overflow-wrap` do `normal`
   (łamanie tylko na spacji) na **każdym ekranie listowym zbudowanym na `StandardTable`**,
   nie na dwóch zgłoszonych.
2. **Świadomie BEZ `overflow-hidden`** na tej warstwie — z tego samego powodu, dla którego nie ma
   go `td`: komórki renderują popovery bez portalu (`PMO/StatusTransitionDropdown.tsx` w
   `assessment/InitiativesTable.tsx`), a przycięcie obcięłoby je do szerokości kolumny.
3. **ODRZUCONE: podniesienie podłogi szerokości globalnie.** Zmierzone: **180 kolumn w 76 plikach**
   deklaruje szerokość poniżej `FIT_MIN_COLUMN_WIDTH` (112 px). Kanon mówi wprost — „podłoga nigdy
   nie ROZPYCHA, tylko ogranicza kurczenie". Podniesienie ich hurtem przepchnęłoby dziesiątki
   już odebranych tabel w nadmiar → `columnFit` skalowałby wszystko w dół → regresja na ekranach
   z akceptem. Nie wchodzę w to.
4. **Punktowo, tam gdzie kolumna była poniżej podłogi czytelności:** `results-zestawienia`
   `itemCount` 90 → 120 px (po odjęciu `px-4` zostawało 58 px, a odmieniony wyraz ma ~65 px).
   Budżet odzyskany z `owner` i `updatedAt` (po −10 px), żeby suma nie wypchnęła tabeli poza
   realny obszar z otwartym podglądem (~981 px). Zero zmiany dla pozostałych kolumn.

### Bezpiecznik mechaniczny, nie uważność

Nowy test `src/components/shared/ModuleHub/__tests__/FilterableTable.cellWordBreak.test.tsx`
(4 przypadki). **Dowód mutacyjny wykonany:** usunięcie `CELL_ELEMENT_WRAP_CLASS` z gałęzi
elementowej → test 1 czerwony; przywrócenie → 4/4 zielone. Test celuje w ZABEZPIECZENIE
(brak `break-all`, brak `overflow-hidden` na warstwie elementowej), nie w mechanizm renderowania.

---

## RODZINA 3 — czerwień poza semantyką krytyczną

### Zasięg zmierzony — trzy podrodziny, nie jedna

`--c-accent: #85182f` (`src/index.css:68`) to Harvard Crimson. Zmierzone:

| podrodzina | zmierzone | naprawione | zostawione ŚWIADOMIE |
| --- | --- | --- | --- |
| **przycisk z pełnym czerwonym wypełnieniem + biały tekst** | 21 | 1 (`Wykonaj retencję teraz`) | 20 — to potwierdzenia usunięcia („Usuń", „Delete"), gdzie właściciel czerwień **przyjął** (`finance-saved-views-panel`, 02.09) |
| **pastylka Menu 3 `MENU_3_ACTION_DANGER`** | 10 na realnych przyciskach | 1 (`Anuluj zaznaczone` w agent-hub → `MENU_3_ACTION_NEUTRAL`) | 8 × „Usuń" + 1 × „Odrzuć" |
| **`PreviewActionButton variant="destructive"` z etykietą Anuluj/Cancel** | 3 | **3** (agent-hub + OKR cel + OKR kluczowy rezultat) | — |
| **ikona nagłówka zwykłej sekcji ustawień** (`size={14} text-c-accent`) | 21 w 8 plikach | **21** → `text-c-text-secondary` | — |

### Rozstrzygnięcie dla `Wykonaj retencję teraz` (zgodnie z poleceniem)

Akcja jest nieodwracalna, ale **nie jest stanem krytycznym**. Ostrzeżenie już istnieje i jest
właściwym wzorcem: `handleExecute` woła `confirm({ …, variant: 'danger' })` z jawnym tekstem
„This permanently deletes data… This cannot be undone.". **Ostrzeżenie niesie okno potwierdzenia,
nie kolor przycisku.** Przycisk zneutralizowany, potwierdzenie nietknięte.

### Co zostawione świadomie — i dlaczego to jest pytanie do właściciela, nie do mnie

`src/components/settings/shared/SettingsSection.tsx:141-142` rysuje **crimsonowy kafelek ikony
w nagłówku KAŻDEJ karty ustawień** (`bg-c-accent-soft` + `text-c-accent`) — jeden wspólny
komponent, **23 pliki** ustawień. Właściciel zgłosił „ikony zwykłych sekcji", czyli podnagłówki
(te naprawiłem, 21 sztuk). Kafelek nagłówka karty jest elementem MARKI stosowanym konsekwentnie
na wszystkich kartach ustawień — jego zdjęcie to restyling całego modułu, którego nikt nie zlecił
(REGUŁA NR 16: reguła dopuszcza czy nakazuje?). **Widać go na zrzucie `ustawienia-dane-prywatnosc`
w lewym górnym rogu karty. To jedyna czerwień, jaka na tym ekranie została.** Decyzja: pytanie
do właściciela na zrzucie, nie zmiana bez zlecenia.

---

## DEFEKT PRODUKTOWY — `execution-tab-control`: literalne `undefined:`

### Przyczyna (znaleziona w danych i prezenterze, nie załatana napisem)

Panel POWIĄZANIA składał etykietę jako `` `${option.kind}: ${option.label}` `` bez żadnej osłony.
Pole `kind` **istnieje w kontrakcie serwera** —
`server/src/domain/initiatives-execution/managementIntervention.ts:32`,
`InterventionOption.kind: 'DO_NOTHING' | 'ACTION'`. **Nie ma go w atrapie danych**
(`executionLocalReviewData.ts:250-251`). To NIE jest luka kontraktu → **żadnego STOP-u do toru
funkcji nie zgłaszam.**

To jest podręcznikowa REGUŁA NR 21: *atrapa miała kształt wygodny dla frontu, nie kształt serwera*.
Poza brakiem `kind` atrapa niosła też `reversibility: 'HIGH' | 'MEDIUM'`, czego słownik kontraktu
(`REVERSIBLE | PARTIALLY_REVERSIBLE | IRREVERSIBLE | UNKNOWN`) w ogóle nie zna, oraz
`impacts: string[]` zamiast `Array<{targetRef, effect}>`.

★ I znowu trop z reguły 20: poprawny wzorzec stał **80 linii wyżej w tym samym module** —
`ExecutionControlSurface.tsx:462` buduje opcje z `kind: 'DO_NOTHING'` / `kind: 'ACTION'`.

### Naprawa — dwie warstwy, w kolejności z reguły 21 (najpierw atrapa)

1. **Atrapa doprowadzona do kształtu serwera:** `kind`, słownikowe `reversibility`, `impacts`
   w kształcie `{targetRef, effect}`.
2. **Prezenter uodporniony:** `optionKindLabel` / `confidenceLabel` / `reversibilityLabel` —
   `undefined` nie może wyciec NIGDY (przy braku `kind` przedrostek jest pomijany, nie zastępowany
   napisem), a kody są tłumaczone na polski zamiast trafiać na ekran surowe.

Efekt na zrzucie: `undefined: Nie zmieniaj planu` → **`Bez zmian: Nie zmieniaj planu`**,
a wartość `HIGH · HIGH` → **`Wysoka pewność · Odwracalna`**.

---

## Dowód — 12 ekranów, 24 zrzuty PO, obejrzane oczami

`evidence/grafika/217-trzy-rodziny/<ekran>__PO__<light|dark>.png`. Jedno zdanie o tym, co widać:

| ekran | co widać na zrzucie PO (light i dark identyczny stan) | gotowy do zapalenia |
| --- | --- | --- |
| `execution-tab-summary` | kafel DO ROZSTRZYGNIĘCIA mówi **„1 pozycja"** i **„1 bloker"** (było „1 pozycji", „1 blokery"), kafel NA CZAS **„0 ryzyk"**, OBŁOŻENIE **„0 osób"** | **TAK** |
| `execution-tab-work` | w podglądzie wiersz Dowody mówi **„1 powiązany dowód"** (było „1 powiązanych dowodów") | **TAK** |
| `execution-tab-control` | POWIĄZANIA: **„Bez zmian: Nie zmieniaj planu — Wysoka pewność · Odwracalna"** i **„Działanie: Równoległa walidacja obu źródeł — Średnia pewność · Częściowo odwracalna"**; słowa `undefined` nie ma | **TAK** |
| `admin-command-overview` | kafel RETENCJA mówi **„5 harmonogramów"** (było „5 harmonogram(ów)") | **TAK** |
| `admin-command-center-panel` | ten sam kafel, ta sama poprawna forma **„5 harmonogramów"** | **TAK** |
| `admin-command-ai-policy` | „Niestandardowe reguły bezpieczeństwa — **skonfigurowano 0 reguł.**" (było „0 reguł(y)") | **TAK** |
| `mw-007-calendar-narrow-viewport` | podpowiedź mówi **„Wybrany dzień ma 1 pozycję."** (było „1 pozycji") | **B** — patrz uwaga niżej |
| `results-zestawienia` | kolumna WSKAŹNIKI szeroka na **120 px**, wartości **„10 wskaźników", „3 wskaźniki", „1 wskaźnik"** — wyraz łamie się na spacji, po liczbie, nigdy w środku (było „3 wskaźnik / i") | **TAK** |
| `chat-signals-feed` | kolumna ŹRÓDŁO pokazuje **„Interpretacja / AI"** — całe słowo, złamane na spacji (było „Interpretac / ja AI"); WAGA pokazuje całe „Ostrzeżenie" (było „Ostrzeżeni / e") | **TAK** |
| `admin-command-retention` | przycisk **„Wykonaj retencję teraz" jest neutralny** — jasne tło, cienka szara ramka, ciemny tekst, identycznie jak sąsiedni „Zainicjuj harmonogramy"; na ekranie nie ma ani jednego czerwonego piksela | **TAK** |
| `agent-hub` | przycisk **„Anuluj" w stopce podglądu jest neutralny** — białe tło z szarą ramką (było różowe tło + czerwony tekst) | **B** — patrz uwaga niżej |
| `ustawienia-dane-prywatnosc` | ikony nagłówków **„Zarządzanie zgodami"** (tarcza) i **„Retencja danych"** (zegar) są **szare**, nie malinowe | **B** — patrz uwaga niżej |

### Trzy oceny B — wyjątki NAZWANE PRZED spojrzeniem właściciela

- `mw-007-calendar-narrow-viewport` — odmiana naprawiona, ale **drugi zgłoszony defekt tego ekranu
  ZOSTAJE**: podpis wydarzenia „Internal" po angielsku (kafelek „Warsztat z zespołem op… / Internal").
  To defekt językowy, nie moja rodzina.
- `agent-hub` — czerwień naprawiona, ale **zgłoszone ucięcia ZOSTAJĄ**: trzy nagłówki
  („ZAPLANOW…NA", „OSTATNIE URUCHOMI…", „CZAS WYKONANIA") i pięć wartości statusu
  („Planow…", „Zaplan…", „Zakońc…", „Nieuda…", „Czeka …") kończą się wielokropkiem. To kanon
  (wielokropek, nie rozdarcie), ale pięć nieczytelnych statusów to osobna sprawa do rozstrzygnięcia.
- `ustawienia-dane-prywatnosc` — podnagłówki naprawione, ale **crimsonowy kafelek ikony nagłówka
  karty ZOSTAJE** (wspólny `SettingsSection`, 23 pliki — patrz Rodzina 3, sekcja „zostawione
  świadomie"). To jedyna czerwień na tym ekranie i jest to pytanie do właściciela.

---

## ZGŁASZAM (czytać pierwsze, nie ostatnie)

1. **Bramka `check-dev-render-parytet.mjs` jest CZERWONA na tej gałęzi — 31 nowych naruszeń R1/R2.
   NIE są moje.** Sprawdzone mutacyjnie: po przywróceniu wersji `results-zestawienia.tsx` z HEAD
   wynik jest identyczny (31). Żaden z moich 12 ekranów nie występuje w liście naruszeń.
   Winowajcy: `day200-finance-panels` (13), `day238-ustawienia` (10 × R2), `day221-audyty-warsztat`,
   `day233-finanse-rejestry` i 5 innych. **Reguła 17 mówi, że partia nie idzie do odbioru, dopóki
   bramka nie da CZYSTO — to zablokuje odbiór KAŻDEJ partii, nie tylko tej.** Wymaga osobnego
   dyżuru: albo naprawa tych 9 ekranów, albo wpisy z POWODEM do
   `scripts/check-dev-render-parytet.baseline.txt`.
2. **`src/components/shared/__tests__/standardPreview.r03.test.tsx` — 2 czerwone testy, zastane.**
   Sprawdzone mutacyjnie tą samą metodą (HEAD-owa wersja `FilterableTable.tsx` → te same 2 czerwone).
   Nie moje, ale nikt ich chyba nie widzi.
3. **`execution-tab-work` i `execution-tab-control`: nazwiska w danych demo są z małej litery i bez
   polskich znaków** — „anna kowalska", „piotr wisniewski", „katarzyna wojcik". Dane demo są twarzą
   produktu. Poza moim zleceniem, ale właściciel to zobaczy.
4. **`execution-tab-control`: „Wybrana opcja: parallel-validation"** — surowy identyfikator zamiast
   etykiety opcji. Ta sama rodzina co naprawione `undefined:`, ale inne miejsce w pliku; nie ruszałem,
   bo nie było w zleceniu. Naprawa to jedna linia (mapowanie `selectedOptionId` → `option.label`).
5. **`execution-tab-rollout` („8dni", brak spacji) NIE naprawiony** — nie znalazłem tego ciągu w
   `src/components/Execution/`; wymaga zrzutu z podświetleniem elementu, nie grepa.
6. **Zmieniłem kolor „Anuluj" na dwóch ekranach OKR** (`okrObjectivePresenters`,
   `okrKeyResultPresenters`), których właściciel mógł już widzieć z czerwienią. To była świadoma
   decyzja z reguły 20 (rodzina, nie punkt) — ale jeśli te karty mają akcept, wymagają ponownego
   zrzutu przed awansem (reguła 15).

## Bramki

| bramka | wynik |
| --- | --- |
| `npx vite build` | ✓ zbudowane w 36 s |
| `scripts/check-list-canon.sh` | ✓ naruszeń 394, baseline 394 — dług nie rośnie |
| `scripts/dev/check-devrender-main.sh` | ✓ kod wyjścia 0, 266 ekranów |
| `vitest` — Execution + AIChat | ✓ 375/375 |
| `vitest` — nowy test rodziny 2 | ✓ 4/4, dowód mutacyjny wykonany |
| `check-dev-render-parytet.mjs` | ✗ CZERWONA — 31 naruszeń zastanych, patrz ZGŁASZAM #1 |

---

## DOPISEK 15:30 — trzy zadania z odbioru meldunku

### 1. Zapalone 12 ekranów (`status.json`)

Przed dotknięciem pliku: `--ff-only` **było niemożliwe** — gałęzie rozeszły się o 6 commitów,
a m03 ruszył DOKŁADNIE ten plik (widok „Odbiór modułowy", filtr „Poproszony przegląd"). Zapis
z własnej pamięci skasowałby cudzą pracę, więc najpierw `merge --no-ff` (bez konfliktów),
dopiero potem edycja. Zakres zmiany: 39 linii, wyłącznie pola `naprawione` / `wyjatki` /
`ocena` / `co` moich kart. Baza `odbior.sqlite` i serwery nietknięte.

Dwa opisy **poprawione, bo przestały być prawdą**: `admin-command-retention` miał w polu `co`
zdanie „Crimson poprawny (akcja nieodwracalna)" — przycisk jest już neutralny;
`chat-signals-feed` miał wyjątek „tytuły łamią się" bez rozróżnienia — teraz mówi wprost, że
zawijają się na spacjach, nigdy w środku wyrazu.

`mw-007-calendar` **obniżony z A na B** — angielskie „Internal" zostaje, a wyjątek ma być
widoczny przed spojrzeniem, nie po.

### 2. Dwie naprawy ze zgłoszeń

**Surowy identyfikator.** `Wybrana opcja: parallel-validation` → `Wybrana opcja: Równoległa
walidacja obu źródeł`. To była ta sama rodzina co `undefined:`: prezenter brał pole techniczne
i pokazywał je klientowi. Wyszukanie opcji po `optionId` **istniało już 770 linii wyżej**
w tym samym pliku (`interventionBusinessTitle`) — brakowało go tylko w pigułce rekomendacji.

**Nazwiska w danych demo — sprostowanie premisy zlecenia.** Zlecenie mówiło „popraw w źródle
danych demo, nie w prezenterze". Pomiar pokazał, że **dane są poprawne**: rekordy niosą
IDENTYFIKATORY (`anna-kowalska`, `piotr-wisniewski`), a identyfikator nie ma prawa mieć polskich
znaków. Defekt siedział w **czterech prezenterach jednego modułu**, z których każdy robił własną
zamianę myślnika na spację:

| plik | co robił | skutek |
| --- | --- | --- |
| `ExecutionWorkSurface.actorLabel` | `replaceAll('-', ' ')` | `anna kowalska` — z małej litery |
| `ExecutionWorkSurface.businessLabel` | `\b\w` → wielka litera | `Anna Kowalska` — **ten sam człowiek, ten sam ekran, inny zapis** |
| `ExecutionControlSurface.actorBusinessLabel` | `\b\w` → wielka litera | `Piotr Wisniewski` — bez `ś` |
| `ExecutionResourcesSurface.businessLabel` | granica po Unicode `\p{L}` | **poprawny — naprawiony 01.09 dokładnie na tym defekcie** |

★ Znowu REGUŁA 20 i jej najsilniejszy trop: **rodzeństwo, które JUŻ ma poprawkę.** Komentarz przy
`ExecutionResourcesSurface` wymienia wprost „Wójcik" jako przypadek testowy — ktoś naprawił jedną
powierzchnię i nie objął pozostałych trzech.

**Ale sama poprawka prezentera nie wystarczy i tu zlecenie miało rację co do kierunku:** żadna
zamiana znaków nie odtworzy `Wiśniewski` z `wisniewski` ani `Wójcik` z `wojcik`. Diakrytyk MUSI
przyjść z danych. Dlatego naprawa jest w OBU warstwach: **katalog osób w źródle danych demo**
(`executionReviewPeople`, 8 osób z poprawną pisownią) + trzy prezentery, które go czytają, z
zamianą znaków zostawioną wyłącznie jako ostatnia deska ratunku dla identyfikatora spoza katalogu.

Dowód, że katalog trafił we właściwe miejsce: `assigneeName: 'Katarzyna Wójcik'` **istniało w tym
pliku już wcześniej** — ale tylko przy trzech osobach i tylko na jednym typie rekordu, więc reszta
ekranów go nie widziała.

### 3. `execution-tab-rollout` („8dni") — ZLOKALIZOWANE, nie zgadnięte

Grep nie znajdował, bo ciąg **nie istnieje w kodzie** — powstaje ze sklejenia dwóch pól w czasie
renderowania. Zlokalizowane przyrządem, który pytał samą stronę o styk cyfry z literą.

**★ Pierwszy pomiar był FAŁSZYWIE ZIELONY i złapałem to tylko dlatego, że spojrzałem na zrzut:**
sonda zameldowała „0 styków cyfra-litera", a zrzut pokazywał „Ładowanie ekranu…". Przyrząd
zmierzył pustą stronę i nazwał to czystością. Dopiero czekanie na warunek („tekst przestał mówić
Ładowanie ORAZ ma ponad 200 znaków") dało pomiar. To jest dokładnie „brak pomiaru nie jest
wynikiem" — i drugi raz tego dnia narzędzie skłamało na korzyść.

**Gdzie to siedzi — dokładnie:**

| warstwa | miejsce | co robi |
| --- | --- | --- |
| ekran | zakładka **Rollout → tabela „Śledzenie KPI"**, wiersz **„Czas realizacji zamówienia (dni)"** | trzy komórki: `8dni`, `12dni`, `6dni` |
| prezenter | `src/components/Execution/RolloutTab.tsx:708-710` | `` `${k.current_value}${k.unit}` `` — **zero separatora** |
| to samo, 3 kolejne wystąpienia | `RolloutTab.tsx:1395`, `:1403`, `:1408` | ta sama skleja w kartach KPI |
| źródło danych | `dev-render/screens/execution-tab.tsx:105` | `unit: 'dni'` |

**Dlaczego widać to tylko w jednym wierszu:** pozostałe KPI mają `unit: '%'`, a `74%` jest
poprawne — procent spacji nie potrzebuje. Defekt odsłania się wyłącznie wtedy, gdy jednostka
jest SŁOWEM.

**Naprawa, której NIE zrobiłem (zlecenie mówiło „wróć z tym, gdzie to siedzi"):** separator
warunkowy w prezenterze — jednostka zaczynająca się od litery dostaje spację, symbol (`%`, `°`)
nie. Cztery miejsca w jednym pliku, obejmuje każdą przyszłą jednostkę (`h`, `szt.`, `PLN`).
**Uwaga do decyzji:** przy wartości `1` poprawne jest „1 dzień", a nie „1 dni" — ale jednostka
przychodzi z danych jako gotowy napis, więc odmiana wymaga zmiany kontraktu KPI, nie separatora.

Zrzut z podświetleniem trzech komórek:
`evidence/grafika/217-trzy-rodziny/execution-tab-rollout__DIAGNOZA-8dni__light.png`.

### Świeże zrzuty przed zapaleniem (jak zapowiedziane)

`execution-tab-work`, `execution-tab-control`, `execution-tab-rollout`,
`results-vnext-okr-registry`, `results-vnext-okr-objectives` — 10 zrzutów, oba motywy, wszystkie
po dzisiejszych zmianach. Obejrzane: nazwiska poprawne w tabeli I w panelu, „Wybrana opcja"
po polsku, „Anuluj" na OKR neutralny obok „Edytuj".

### ZGŁASZAM (nowe, z tej rundy)

**Ta sama rodzina nazwisk żyje w module Wyniki, w innym źródle danych.** Na obu ekranach OKR
kolumna WŁAŚCICIEL pokazuje `user-ann…`, `user-tom…`, `user-pio…`, a panel po prawej pełne
`user-piotr-wisniewski` i `user-anna-kowalska`. Katalog osób, który zrobiłem, obsługuje dane demo
Realizacji — Wyniki mają własne źródło, więc to osobne zadanie. Wpisane jako wyjątek na obu
kartach, żeby nie zniknęło; ocen tych kart NIE zmieniałem (nie moje zlecenie).

---

## DOPISEK 17:00 — separator jednostki + ZATRZYMANE nazwiska w Wynikach

### 1. „8dni" — naprawione u źródła, dla całej rodziny

**Pomiar PRZED, uczciwie w dwóch liczbach:** surowy grep po sklejeniu wartości z jednostką dał
**25 trafień**. Po przejrzeniu każdego z osobna realnych defektów jest **8, w 3 plikach**. Różnica
nie jest szumem — to dwie różne rzeczy pod jednym kształtem składni:

| co to naprawdę było | ile | werdykt |
| --- | --- | --- |
| liczba + **jednostka miary** bez separatora | **8** | DEFEKT — naprawione |
| przyrostek TEKSTOWY (`(kopia)`, `" (w toku)"`, ` — 3 slajdy`, przyrostek klucza uprawnień, identyfikator) | 11 | nie ta rodzina |
| jednostka, która może być **wyłącznie `%`** (`suffix = isPercent ? '%' : ''`) | 4 | poprawne — spacja byłaby błędem |
| wołacz wpisuje spację **do samej wartości** (`unit=" MB"`, `` unit={` ${…}`} ``) | 2 | poprawne — naprawa dałaby podwójną spację |

Naprawione 8 miejsc: `RolloutTab` 6 (3 w szablonie + 3 w kartach KPI), `LiveDashboard` 2.

**Rozstrzygnięcie:** wspólny pomocnik `src/utils/jednostka.ts`. Jednostka zaczynająca się od
LITERY jest osobnym wyrazem i dostaje spację (`8 dni`, `120 zł`, `4 h`, `3 µm`); jednostka będąca
SYMBOLEM przykleja się (`74%`, `20°`, `3×`). Funkcja **przycina jednostkę przed decyzją**, więc
jest odporna na drugą konwencję żyjącą w repozytorium (spacja wpisana do wartości) i można ją
tam bezpiecznie podłączyć później — `zJednostka(512, ' MB')` daje `512 MB`, nie `512  MB`.

**Bezpiecznik:** `src/utils/__tests__/jednostka.test.ts`, 6 grup. **Dowód mutacyjny na OBU
gałęziach reguły:** odebranie spacji słowu → 3 czerwone; dodanie spacji symbolowi → 3 czerwone;
stan poprawny → 6/6 zielonych. Żadna pojedyncza mutacja nie przechodzi. Test pilnuje też pułapki
`falsy`: `zJednostka(0, 'dni')` = `0 dni`, bo zero jest wartością, nie brakiem.

**Dowód w obrazie:** `execution-tab-rollout__PO__{light,dark}.png` — w jednym kadrze widać OBIE
gałęzie reguły naraz: „8 dni · 12 dni · 6 dni" ze spacją i „74% · 62% · 90%" bez niej.

**★ Ograniczenie dowodu, nazwane wprost:** z 8 naprawionych miejsc **6 mam na zrzucie**
(`RolloutTab`). Pozostałe 2 (`LiveDashboard`) **nie mają dowodu w obrazie** — ten komponent nie
ma ekranu w stanowisku podglądowym ani karty w odbiorze, więc nie ma czym zrobić zdjęcia.
Naprawa jest identyczna i pokryta testem jednostkowym, ale nie twierdzę, że ją zobaczyłem.

**Odmiana „1 dzień" odłożona** z uzasadnieniem i gotową drogą wyjścia — `ODLOZONE.md`.

### 2. Nazwiska w Wynikach — ZATRZYMANE, i to jest właściwy wynik

Reguła zatrzymania ze zlecenia uruchomiła się z zapasem: **źródeł jest 49, nie trzy**
(22 różne identyfikatory osób). Ale zatrzymuję się z **mocniejszego powodu niż liczba**:

**★ Moduł Wyniki MA JUŻ POPRAWNY MECHANIZM — i nie jest nim katalog atrap.** `resolveMemberName`
(`ResultsAttentionPage.tsx:112`, `ResultsRoiHub.tsx:275`) mapuje identyfikator na nazwisko
z **REALNEJ listy członków organizacji**, danych już pobranych, i uczciwie spada do skróconego
identyfikatora, gdy członka nie ma. Komentarz przy `attentionPresenters.tsx:83` opisuje wprost tę
samą lukę „surowe id zamiast nazwy". To jest rodzeństwo z gotową poprawką — trzeci raz dzisiaj ten
sam trop. **Zbudowanie obok niego katalogu atrap byłoby naprawą w złą stronę.**

To znaczy, że polecenie „katalog osób w źródle danych Wyników" prowadziłoby do gorszego stanu —
tak jak wcześniejsza premisa o nazwiskach w danych demo Realizacji. Różnica między modułami:
Realizacja czyta lokalny zestaw przeglądowy, który **nie ma** listy członków organizacji, więc
katalog był tam właściwy; Wyniki taką listę mają.

**I powód, który przeważa nad oboma:** `OkrObjectivesView` nie ma dostępu do organizacji
(0 wystąpień `currentOrganization`), a **stanowisko podglądowe nie atrapuje pobrania członków
organizacji** dla żadnego z dwóch ekranów OKR. Poprawnie wykonana naprawa **nie zmieniłaby nic na
zrzucie** — nazwiska dalej byłyby skrócone, właściciel zobaczyłby to samo, a ja zameldowałbym
naprawę bez dowodu w obrazie. To kształt „zamknięte przez wygaszenie": zielono, bo kontekst nie
dociera. Kolejność wyjścia (najpierw atrapa, potem kod) zapisana w `ODLOZONE.md`.

**Zasięg na przyszłość:** 29 plików w Wynikach dotyka `ownerUserId`, **6 renderuje go surowo**.

### 3. Reguła 22 — sprawdziłem NA SOBIE i miałem 23 wady

Scalenie przyniosło REGUŁĘ NR 22 (do właściciela w drugiej osobie) i bramkę językową. Reguła
dotyczy KAŻDEGO tekstu, który czyta właściciel — więc także moich zdań w kartach. Puściłem po
swoich wpisach tę samą listę wad, którą stosuje bramka: **23 trafienia w moich własnych zdaniach
z dzisiaj.** Poprawione wszystkie 20 wpisów:

- **20 × data skrótem** — „02.09:" → „2 września:";
- **1 × ścieżka** — nazwa pliku zrzutu w karcie Rolloutu → „Pokazuję Ci to na zdjęciu z
  zaznaczonymi trzema komórkami";
- **2 × trzecia osoba** — patrz niżej, to fałszywe trafienie bramki, ale i tak przepisałem.

**ZGŁOSZENIE O SAMEJ BRAMCE:** wzorzec `TRZECIA_OSOBA` (`/\bwłaścicie/`) trafia w **nazwę kolumny
produktu**. Zdanie „kolumna WŁAŚCICIEL pokazuje identyfikatory" jest poprawne i nie mówi o Piotrze
w trzeciej osobie — mówi o nagłówku, który tak się nazywa na ekranie. Obszedłem to („kolumna
z osobą odpowiedzialną"), ale bramka będzie karać poprawny tekst za każdym razem, gdy trzeba
nazwać tę kolumnę. Wart rozważenia wyjątek na WERSALIKI albo na nazwę w cudzysłowie.

### ZGŁASZAM (z tej rundy)

1. **Bramka `bramka-jezyk-kart.mjs` jest CZERWONA: 79 z 89 zdań.** Sprawdzone mutacyjnie —
   podstawiłem `status.json` prosto z linii i wynik jest **identyczny (79/89)**, więc to nie moje
   zdania. Bramka weszła dziś razem z długiem, którego jeszcze nie spełnia.
2. **`src/utils/__tests__` ma czerwone testy zastane**, m.in. `chatV9FeatureFlags` („resolver file
   count (104) does not match registry length (40)"). Sprawdzone mutacyjnie: **liczba 104 jest
   identyczna z moim nowym plikiem w `src/utils` i bez niego** — mój plik nie rusza tego licznika.
   Pozostałe czerwone (`artifactStudioTelemetry`, `orgRedesignFlag`, `DbPromise.timeout`) są
   w plikach, których nie dotykałem.
3. **Drugi raz tego dnia trafiłem we własną pułapkę** przy dodawaniu importu: warunek „nie dodawaj
   importu, jeśli nazwa modułu już występuje w pliku" trafił na **mój własny komentarz**
   zawierający tę nazwę, więc import się nie dodał. Rano to samo przy `results-zestawienia`.
   Za każdym razem złapane sprawdzeniem po fakcie, nigdy uważnością — warto, żeby następny wiedział.
