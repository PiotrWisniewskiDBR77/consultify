# Macierz DRD — sedno aplikacji (05.09.2026)

**Gałąź:** `agent/drd-macierz-sedno-20260905` · baza `6350362f35` (linia m03)
**Zlecenie:** właściciel 05.09: „koniecznie chcę moją macierz — to jest sedno tej aplikacji".
**Kanon treści:** `docs/program/grafika/MACIERZ_TRESC_KOMOREK.md`
**Zrzuty PO:** `evidence/drd-sedno-20260905/`

---

## 1. Co właściciel zobaczy inaczej

| Miejsce | Przed 05.09 | Po |
| --- | --- | --- |
| Zakładka „Macierz" w sesji DRD | uboga tabelka `LiveMatrix`: wiersze = jednostki, kolumny L1–L7 jako kwadraciki z numerem, kolumna „Current · Target · Gap" | macierz właściciela: 9 kolumn obszarów × 7 wierszy drabiny, treść merytoryczna w komórce, dolny pasek `AREA` z chipami `AS 2` / `TO 4` |
| Macierz w raporcie z oceny | kadr 503 px, widoczne 3 kolumny z 9, pod spodem „Jeszcze 7 kolumn po prawej" | kadr 870 px, **9 z 9 kolumn bez przewijania** (zmierzone: `clientWidth 870 = scrollWidth 870`) |
| Podpisy kolumn (wszędzie) | „Sales Processes", „Marketing Processes" — a drzewo obok pisało „Procesy Sprzedaży" | „Procesy Sprzedaży", „Procesy Marketingowe" — ta sama reguła, co w drzewie |
| Szyna rozdziałów w raporcie | „Pr…", „Cy…", „Za…" (ucięte) | „Oś 1 … Oś 7" (drzewo sesji nie zabiera już 240 px na zakładce „Raport") |
| Sesja SIRI | otwierała się na ścianie kafli „V8 SHARED WORKBENCH"; wszystko poniżej (w tym panel „Zarządzanie") było poza kadrem i nie dało się doscrollować | otwiera się na powierzchni pracy; lane governance na żądanie, przełącznikiem „Governance" |

---

## 2. A — dane macierzy (skąd biorą się nazwy)

### 2.1. Nazwy obszarów — to był realny defekt, naprawiony

Źródło: `DRDArea.namePL` w `src/services/drdStructure.ts` (48 wpisów, komplet dla osi 1).
Nowa funkcja `etykietaObszaru()` w `src/components/assessment/drd/drdMatrixCellContent.ts`
jest jedynym miejscem, które tę nazwę wybiera, i używa jej **jedna siatka**
(`DRDMatrixGrid`) obsługująca cztery ekrany: edytor · sesja · raport z oceny ·
slajd prezentacji. Zero kopii.

**Reguła: `namePL || name`, bez warunku na język interfejsu.** Dwa powody, oba
sprawdzalne:

1. Kryterium odbioru brzmiało „te same nazwy, co w drzewie". Drzewo
   (`DrdMethodWorkspaceScreen:674`, `DrdHttpMethodWorkspaceScreen:1202`,
   `drdWorkspaceViewModel:140`), panel jakości i mapy SIRI/ADMA biorą
   `namePL || name` **bezwarunkowo**. Warunek na język rozjechałby macierz
   z drzewem dokładnie w tym jednym przypadku, dla którego ta poprawka powstała.
2. Globalny mock `react-i18next` w `tests/setup.ts` przybija `language: 'en'`,
   więc **żaden test nie mógłby obronić gałęzi polskiej**. Zabezpieczenie, którego
   nie da się zmierzyć, nie jest zabezpieczeniem.

Przy okazji ujednolicone: selektor osi i lista obszarów w prawym pasku edytora
(pokazywały „Sales Processes" obok macierzy pisanej po polsku).

### 2.2. Granica językowa z kanonu ZOSTAJE — i to jest świadoma decyzja

`docs/program/grafika/KANON_Z_ODBIOROW.md` (31.08) stanowi, że metodyka DRD
zostaje po angielsku, bo książka jest po angielsku, i wprost: „angielskie nazwy
poziomów w komórkach nie są powodem do naprawy". **Nie zmieniam tego.** Nazwy
poziomów (etykiety wierszy) i technologie w komórkach zostają angielskie — dla
poziomów po prostu nie ma polskich odpowiedników w SSOT (`DRDLevel` nie ma pola
`titlePL`, `MACIERZ_TRESC_KOMOREK.md` §2.4).

Zmieniła się jedna rzecz — nazwa obszaru — bo dla niej polski odpowiednik
**istnieje w SSOT i cała reszta produktu już go używa**. Jeśli właściciel uzna,
że kanon zabrania i tego, wycofanie to jedna funkcja w jednym pliku.

### 2.3. SPROSTOWANIE POMIARU: etykiety wierszy były POPRAWNE

Pomiar z 05.09 napisał: *„etykiety wierszy to NAZWY SYSTEMÓW (7. AI Support,
6. ERP, 5. MES…) zamiast drabiny poziomów z kanonu"*.

**To nieprawda i niczego tu nie zmieniałem.** Kanon
(`MACIERZ_TRESC_KOMOREK.md`, Część 1, tabela „Nazwa poziomu wg książki") podaje
drabinę osi 1 dokładnie tak:

| # | Nazwa poziomu wg książki |
| --- | --- |
| 1 | Basic Data Registration |
| 2 | Workstation Control |
| 3 | Process Control |
| 4 | Automation |
| 5 | Manufacturing Execution Systems (MES) |
| 6 | Enterprise Resource Planning (ERP) |
| 7 | AI Support Algorithms |

Poziomy 5–7 **nazywają się** w książce od systemów — to autor tak je nazwał.
Ekran pokazywał drabinę wiernie. Nowy test przepisuje tę tabelę **z dokumentu,
nie z kodu**, więc gdyby ktoś podmienił tytuły w SSOT, test spadnie zamiast
przyklepać nową wersję.

---

## 3. B — szerokość: dlaczego 1180 px nie pomogło i co pomogło

### 3.1. Pomiar przyczyny

Poprzedni agent podniósł sekcję macierzy do `max-w-[1180px]`. To był **sufit,
a nie podłoga** — faktyczny kadr wynosił 503 px, bo dokument raportu dzieli
1440 px z czterema rzeczami naraz:

```
1440 = szyna aplikacji 64 + drzewo sesji 240 + szyna rozdziałów raportu ~140
     + prawy panel artefaktu ~320 + marginesy  →  na dokument zostaje ~580,
       a po `p-8` rozdziału i `p-2` siatki: 503 px
```

Przy zaszytym minimum kolumny 92 px potrzeba było 1148 px. Sufit 1180 px nie
miał więc żadnego wpływu.

### 3.2. Trzy zmiany, każda mierzalna

1. **Drzewo sesji znika na zakładce „Raport"** (`MethodWorkspaceShell`). Raport ma
   własną szynę rozdziałów — dwie szyny obok siebie kosztowały 240 px. Wraca
   natychmiast po powrocie na „Wywiad"/„Macierz". Efekt uboczny: etykiety szyny
   rozdziałów przestały być ucięte do „Pr…" (osobne zgłoszenie z tego samego pomiaru).
2. **Sekcja macierzy traci sufit i wychodzi poza margines rozdziału**
   (`-mx-8 px-4`). Akapity zostają w kolumnie czytelniczej 760 px.
3. **Siatka liczy szerokość kolumny z faktycznego kadru** —
   `minimumKolumnyMacierzy()`: przy ≥8 obszarach kolumna etykiet 150 px zamiast
   240, przerwa 4 px zamiast 8, czcionka komórki 10 px i ciaśniejszy padding
   poniżej 80 px kolumny. Minimum schodzi tylko do progu czytelności
   `MIN_CZYTELNA_KOLUMNA_PX = 56`; poniżej wraca przewijanie z podpisem.

Dodatkowo `overflow-hidden` na komórkach, etykiecie wiersza i pasku obszarów:
tory siatki mieściły się co do piksela (854 px), ale długie słowo wystawało poza
swój tor i podbijało `scrollWidth` do 874 px — pasek przewijania pojawiał się
mimo że kolumny się mieściły.

### 3.3. Wynik pomiaru PO

| Ekran | kadr | scrollWidth | kolumn widocznych |
| --- | ---: | ---: | ---: |
| Raport z oceny (1440 px, jasny) | 870 | **870** | **9 z 9** |
| Sesja DRD, zakładka „Macierz" | pełna szerokość zakładki | bez przewijania | 9 z 9 |
| Edytor (`drd-macierz-oceny`) | szeroki | bez przewijania | 9 z 9 |
| Slajd prezentacji | szeroki | bez przewijania | 9 z 9 |

Edytor i prezentacja **nie schudły**: przy szerokim kadrze minimum zostaje bazowe
(92 px) i kolumny rosną do ~150 px, dokładnie jak przed zmianą.

### 3.4. Uczciwie o kompromisie

W raporcie kolumna ma 74 px. Cztery najdłuższe terminy dalej łamią się w środku
słowa („Workflow Managem/ent", „B2B Procurem/ent", „KPI Dashboar/ds"). To jest
cena za komplet dziewięciu kolumn w kadrze, który po odjęciu prawego panelu
artefaktu i dwóch szyn ma 870 px. Alternatywy, gdyby właściciel wolał inaczej:
schować prawy panel na czas oglądania macierzy, albo pozwolić przewijać w bok.
Wycinek do oceny: `evidence/drd-sedno-20260905/02b-raport-macierz-wycinek.png`.

---

## 4. C — sesja DRD, zakładka „Macierz". **To nie była flaga**

Pytanie ze zlecenia brzmiało: „jeśli to flaga — ustaw domyślnie tak, żeby
właściciel widział swoją macierz; zapisz, którą flagę i dlaczego".

**Odpowiedź: żadnej flagi nie ma i nie było.** Sprawdzone w kodzie, nie w opisie:

```
shouldMountDrdMethodWorkspace('drd', true)  === true
shouldMountDrdMethodWorkspace('drd', false) === true   ← flaga OFF, i tak montuje
```

(`src/views/AssessmentSessionEditorView.tsx`, dowód w istniejącym teście
`drdMethodWorkspaceGating.test.tsx`). Warsztat metody montuje się dla DRD
**niezależnie** od `drdMethodWorkspaceSliceV1` i `methodWorkspaceShellV1` — obie
mają `defaultValue: false`, ale dla tej ścieżki nie znaczą nic. Nie istniał więc
przełącznik, którym dałoby się „przywrócić" macierz właściciela; opis pomiaru
(„przy włączonej fladze warsztatu metody stary edytor nie jest już renderowany")
sugerował flagę, której w tej decyzji nie ma.

Jedyną drogą było narysowanie macierzy właściciela w tej zakładce. Nowy plik
`src/components/assessment/drd/DrdOwnerMatrixPanel.tsx`:

- rysuje **`DRDMatrixGrid`** — eksport, nie kopia (kopii tej macierzy jest w repo
  już kilka: `AreaMatrixTable`, `EmbeddedMatrix`, `DRDMatrixSession`, i to one są
  przyczyną kolejnych pudeł — `DZIENNIK_GRAFIKA.md` Z-12);
- przelicza stan warsztatu na stan siatki **tą samą funkcją**, której używa raport
  i prezentacja (`drdOdpowiedziZOutputu`): `current` = szczyt potwierdzonej rampy,
  `target` = poziom z flagą `target`, jednostka nietknięta **nie dostaje wpisu**
  (kolumna nieoceniona, a nie zmierzone zero);
- zachowuje mechanikę zakładki bez zmian: klik w komórkę wybiera ją i otwiera ten
  sam panel szczegółów, Esc zamyka.

Powłoka `MethodWorkspaceShell` dostała opcjonalne `matrixContent`. **SIRI i każda
następna metodyka bez własnej, przyjętej macierzy dostają `LiveMatrix` dokładnie
jak dotąd** — powłoka nadal nie wie nic o DRD.

Celowa różnica wobec starego edytora: macierz w warsztacie **nie ustawia poziomu
kliknięciem w kratkę**, bo poziom wynika tu z odpowiedzi w magazynie zdarzeń.
Gdyby właściciel chciał ustawiania AS/TO wprost z macierzy — to osobna decyzja
produktowa, nie przeoczenie.

---

## 5. D — SIRI: co naprawiłem i czego NIE ma

### 5.1. Naprawione: sesja otwiera się na pracy

Przyczyna zmierzona, nie zgadnięta. Lane governance (`AssessmentV8CanonPanel`
+ `AssessmentWorkbenchPanel`) był dla metodyk innych niż DRD renderowany
**zawsze**, nad powierzchnią pracy, w bloku nagłówka. Dowód z tego samego pomiaru
05.09: panel „Zarządzanie" tej sesji miał zmierzone `top` równe **dokładnie
wysokości okna** (900 przy oknie 900, 1600 przy oknie 1600) i nie reagował na
`scrollIntoView`. Cztery zgłoszenia z pakietu „Ocena" — `siri-workspace`,
`assessment-manage-panel`, `assessment-reports-panel`,
`assessment-initiatives-panel` — mają jedną przyczynę.

Reguła, którą DRD dostało wcześniej, obowiązuje teraz wszystkie metodyki: lane
governance pokazuje się na żądanie, przełącznikiem „Governance" w podnagłówku
(dodanym dla metodyk, które go nie miały). Nic nie ubywa — ten sam panel, jedno
kliknięcie dalej.

### 5.2. NIEnaprawione i ważniejsze: zatwierdzonego warsztatu SIRI nie ma w produkcie

Warsztat z obrazu (drzewo wymiarów · pytanie · sześć przycisków odpowiedzi ·
strefa dowodu · pasek Wstecz/Zapisz/Dalej) to `MethodWorkspaceShell` +
`InterviewFocusPanel` z danymi SIRI (`src/method-core/methods/siri/siriWorkspaceView.ts`).

Zmierzone: **`MethodWorkspaceShell` jest montowany w produkcie wyłącznie przez
dwa ekrany DRD.** Dla SIRI nie ma ŻADNEGO montażu — jedynym miejscem, w którym
ten warsztat żyje, jest harness `dev-render/screens/siri-workspace.tsx`. Trasa
`/assessment/siri/:id` renderuje `SIRIAssessmentEditor` (stara powierzchnia).

To jest kształt „biblioteka bez wywołania": slice A7 napisany, przetestowany
i zaakceptowany na zrzucie z harnessu, ale nigdy niepodłączony do trasy.
**Ekran `siri-workspace` z rejestru odbioru porównuje obraz harnessu z produkcją,
która renderuje coś innego** — dopóki nie powstanie ekran `SiriMethodWorkspaceScreen`
(odpowiednik `DrdMethodWorkspaceScreen`), ten punkt nie może być zgodny, niezależnie
od kafli. To osobne, większe zlecenie i świadomie go tu nie robiłem.

---

## 6. E — testy i dowód mutacyjny

Nowe: `src/components/assessment/drd/__tests__/macierz-sedno-20260905.test.tsx`
(11 przypadków) · `tests/components/assessment/AssessmentSessionEditorView.siriGovernanceLane.test.tsx`
(2 przypadki). Zaktualizowane: checkpoint A6 (`DrdMethodWorkspaceScreen.matrix.test.tsx`
— uchwyty, bez zmiany sensu) i `AssessmentReportContractView.test.tsx` (polska nazwa
+ asercja negatywna na angielską).

**Dowód mutacyjny — uruchomiony, nie zadeklarowany:**

| Mutacja (skasowanie zabezpieczenia) | Wynik |
| --- | --- |
| `{area.name}` z powrotem w siatce | 2 testy czerwone (PL brak, EN obecna) |
| `minimumKolumnyMacierzy` zwraca zawsze minimum bazowe | 2 testy czerwone |
| powłoka rysuje zawsze `LiveMatrix` (usunięte `matrixContent ??`) | 2 testy checkpointu A6 czerwone |
| `framework !== 'drd' \|\| showGovernance` z powrotem | 2 testy SIRI czerwone |

**Pułapka złapana po drodze, warta zapisania:** pierwsza wersja testu SIRI
przechodziła na asercji „nie ma ściany kafli", bo ekran stał na
„Loading assessment…", a potem na pustym `<body>` — globalny mock `react-i18next`
nie ma `getFixedT`, którego używa jeden z komponentów sesji, więc wyjątek wywalał
całe drzewo Reacta. Test mierzył NICOŚĆ. Naprawione: mock uzupełniony, a każdy
z dwóch testów **najpierw dowodzi, że sesja się otworzyła** (widoczny przełącznik
„Governance"), zanim sprawdza brak kafli.

**Stan zastanych czerwonych — bez zmian.** Zmierzone na bazie `6350362f35`
w osobnym worktree:

| Zakres | baza | po zmianach |
| --- | ---: | ---: |
| `src/components/assessment` + `src/components/method-workspace` | 11 czerwonych / 220 zielonych | 11 / 220 |
| `tests/components/assessment` | 32 / 238 | 32 / 238 |

Czerwone zastane to `DrdHttpMethodWorkspaceScreen.*` i banner „SESJA
DEMONSTRACYJNA" w `drdMethodWorkspaceGating` — nietknięte tą pracą.

---

## 7. Zrzuty i czym zostały zrobione — z jawnym ograniczeniem

`evidence/drd-sedno-20260905/`, wszystkie 1440 px, motyw jasny, język polski:

| Plik | Co pokazuje |
| --- | --- |
| `00-PRZED-raport-macierz-zywo-20260905.png` | stan PRZED z odbioru na żywo (kadr 503 px, 3 kolumny z 9, angielskie podpisy) |
| `01-sesja-macierz__PO__pl__1440__light.png` | zakładka „Macierz" sesji DRD — macierz właściciela, 9 kolumn, pasek AREA z `AS 2`/`TO 4` |
| `02-raport-macierz__PO__pl__1440__light.png` | raport z oceny — 9 kolumn, szyna „Oś 1…Oś 7" czytelna |
| `02b-raport-macierz-wycinek.png` | zbliżenie komórek do oceny łamania wyrazów przy 74 px |
| `03-edytor-macierz__PO__pl__1440__light.png` | edytor `drd-macierz-oceny` — bez regresji, polskie podpisy także w prawym pasku |
| `04-prezentacja-macierz__PO__pl__1440__light.png` | slajd 6/13 prezentacji — ta sama siatka |

**★ OGRANICZENIE, KTÓRE TRZEBA ZNAĆ PRZED DEMEM.** Zrzuty PO są z harnessu
`dev-render` (realne komponenty, dane z atrapy serwera `methodCoreFakeServer`),
**nie** z aplikacji na żywo. Powód: sesja logowania właściciela
(`/private/tmp/odbior-auth/auth.json`, zapisana 06:39) wygasła — o 07:34 zarówno
port 3000, jak i moja kopia na 3041 dostawały `401` na odświeżeniu tokenu
i lądowały na `/login`. Hasła właściciela nie wpisuję.

Konsekwencje, wypisane wprost:
- **Sesja DRD, raport, edytor i prezentacja** — harness montuje te same, realne
  komponenty w tym samym łańcuchu przodków (powłoka warsztatu → `NModeShell` →
  prawy panel), więc pomiar szerokości jest wiarygodny; brakuje wyłącznie lewej
  szyny aplikacji (64 px), która zmniejszy kadr raportu o te 64 px — 9 kolumn
  nadal się mieści (870 − 64 = 806 > 782 potrzebnych przy progu 56 px).
- **Zmiana SIRI (§5.1) NIE MA ZRZUTU.** Broni jej pomiar przyczyny z 05.09
  i dwa testy z dowodem mutacyjnym, ale nikt tego ekranu nie widział po naprawie.
  **Nie wypuszczać na demo bez zrzutu** — wymaga odnowionej sesji logowania
  właściciela (`scripts/dev/odbior-zywo/zaloguj.mjs`).

Narzędzie: kopia kanonicznego zrzutownika w `scripts/dev/drd-sedno/zrzut.mjs`
(port 3041 zamiast 3000) z **dołożoną opcją opt-in `--mierz="<selektor CSS>"`,
która zapisuje `getBoundingClientRect` + `scrollWidth`/`clientWidth` do pliku
`.json` obok zrzutu. Bez flagi zachowuje się identycznie jak oryginał — szerokość
macierzy była przedmiotem naprawy, a „na oko ze zrzutu" to nie pomiar.

---

## 8. Pliki

**Nowe:** `src/components/assessment/drd/DrdOwnerMatrixPanel.tsx` ·
`src/components/assessment/drd/__tests__/macierz-sedno-20260905.test.tsx` ·
`tests/components/assessment/AssessmentSessionEditorView.siriGovernanceLane.test.tsx` ·
`scripts/dev/drd-sedno/zrzut.mjs`

**Zmienione:** `src/components/assessment/drd/DRDAssessmentEditor.tsx`
(`DRDMatrixGrid`) · `src/components/assessment/drd/drdMatrixCellContent.ts` ·
`src/components/method-workspace/MethodWorkspaceShell.tsx` ·
`src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx` ·
`src/components/assessment/drd/DrdHttpMethodWorkspaceScreen.tsx` ·
`src/components/assessment/report/AssessmentReportContractView.tsx` ·
`src/views/AssessmentSessionEditorView.tsx` · dwa pliki testowe (aktualizacja)

## 9. Co zostaje otwarte

1. **Warsztat SIRI nie ma montażu w produkcie** (§5.2) — osobne zlecenie.
2. **Zrzut sesji SIRI po naprawie** — blokuje wypuszczenie §5.1 na demo.
3. **Łamanie wyrazów w komórce przy 74 px** (§3.4) — do decyzji właściciela:
   zostawić, chować prawy panel, czy wrócić do przewijania.
4. **Polskie nazwy poziomów** — nie istnieją w SSOT (`DRDLevel` bez `titlePL`);
   kanon mówi, że mają zostać angielskie. Jeśli właściciel zmieni zdanie, to
   praca redakcyjna na 7 osiach, nie zmiana kodu.
