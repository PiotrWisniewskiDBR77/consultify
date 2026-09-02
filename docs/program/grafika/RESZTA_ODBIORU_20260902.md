---
doc_id: reszta-odbioru-20260902
status: canonical
truth_type: measurement
established: 2026-09-02
mierzone: 2026-09-02, rano — wszystkie liczby z żywej bazy i z kodu, nie z dokumentów
---

# Co właścicielowi zostało do przeklikania — pomiar 02.09

Powstało na prośbę właściciela: *„chcę skończyć odbiór ekranów, bo zostało nam już
bardzo niewiele"*. Poniżej **jest to zmierzone, nie oszacowane**. Każda liczba ma
obok polecenie, którym ją odtworzysz.

---

## ★ GŁÓWNY WYNIK — jednym zdaniem

**Nie ma ani jednej karty, której właściciel by nie kliknął.** Wszystkie **253** karty
z oceną A/B mają decyzję w bazie (255 „tak", 3 „poprawka", 2 „nie" — łącznie 260, bo
5 decyzji dotyczy ekranów, które później zeszły do oceny C/D). Do przeklikania zostaje
więc nie „reszta zbioru", tylko **karty wymagające ponownego spojrzenia** — bo albo
poprosił o poprawkę, albo obraz, na który patrzył, nie pokazywał produktu.

| Miara | Wartość | Skąd |
| --- | --- | --- |
| Ekranów w rejestrze | 313 | `status.json` |
| — ocena A | 181 | policzone ze `status.json` |
| — ocena B | 72 | j.w. |
| — ocena C (nie pokazujemy) | 27 | j.w. |
| — ocena D (odłożone) | 33 | j.w. |
| Kart A/B (do odbioru) | **253** | j.w. |
| Kart A/B **bez decyzji** | **0** | `odbior.sqlite`, tabela `decyzje` |
| Decyzji łącznie | 260 | j.w. |

---

## ★ SPROSTOWANIE TEGO DOKUMENTU (02.09, kilka godzin po pierwszym pomiarze)

**Liczba 22 spadła do 20, a lista niepodłączonych z 12 do 10.** `finance-model-workspace`
i `finance-prediction-workspace` **są osiągalne w produkcie** — renderuje je `FinanceHub.tsx`
(`:3585` oraz `:340` przez otoczkę `FinanceV3PredictionWorkspace`), a `FinanceHub` ma
wołacza w `src/views/EconomicsView.tsx:19`.

Mój pierwszy pomiar szukał wołaczy wzorcem `<Nazwa` i przegapił te ukryte za
`const Alias = lazy(() => import(...).then(m => ({ default: m.Nazwa })))` — czyli
popełniłem **tę samą ślepotę, którą w tym samym dokumencie wytknąłem bramce parytetu**.
Wykrył to robotnik, bo zlecenie kazało mu sprawdzić moją liczbę zamiast przyjąć ją na wiarę.
Narzędzie liczące poprawnie: `node scripts/dev/grafika-wolacze.mjs`.

Zastrzeżenie: `PredictionWorkspace` jest montowany **za flagą**
(`useFinancePredictionWorkspaceFlag`) — osiągalny, ale nie dla każdego.

**Po naprawie bramki** (ten sam dzień) linia bazowa spadła ze 112 do 103 pozycji,
a R1 z 41 do 32 ekranów: dziewięć oskarżeń było fałszywych.

---

## LISTA DO PRZEKLIKANIA DZIŚ — **20 kart** (9 do oceny, 11 czeka na budowę)

Trzy grupy. Pierwsza jest najkrótsza i najważniejsza.

### Grupa 1 — właściciel poprosił o poprawkę (3 karty)

Te trzy czekają na naprawę i ponowne pokazanie. Cytaty są jego, dosłowne.

| Ekran | Co powiedział | Czy to sprawa wyglądu |
| --- | --- | --- |
| `idea-table` (Tabela pomysłów) | „Tutaj ciągle zobacz Preview nie jest zgodny z wzorem" | TAK — podgląd niezgodny z kanonem; do naprawy w torze grafiki |
| `finance-baseline-workspace` (Baza porównania) | „dalej nie mam przycisku dodawania założeń i możliwości usuwania linii" | **NIE** — brakuje funkcji, nie wyglądu; idzie do toru funkcji |
| `admin-command-attention-queue` (Kolejka uwagi) | „to nie jest szerokość strony :(" | TAK — szerokość kontenera; do naprawy w torze grafiki |

### Grupa 2 — właściciel odrzucił, czeka decyzja o wycofaniu (2 karty)

Obie odrzucone tym samym argumentem: „po co to jest". **To nie są karty do ponownego
klikania** — to dwa ekrany do wycofania z odbioru. Decyzja należy do nadzorcy (reguła 0),
nie do właściciela; wpisuję ją tu, żeby nie wróciły same.

| Ekran | Co powiedział | Rekomendacja nadzorcy |
| --- | --- | --- |
| `gen-excel-templates-tab` | „To samo nie wiem, po co on jest." | Zejście do oceny D + wpis do `ODLOZONE.md` (kod zostaje, reguła 5) |
| `results-three-pairs` | „To jest jakiś historyczny ekran. chyba już tak dawno nie wygląda. - mam nadzieję" | j.w. — zweryfikować, czy trasa jeszcze żyje, potem D |

### Grupa 3 — karta stoi na obrazie, który nie pokazuje produktu (19 kart)

To jest realna reszta odbioru. Właściciel powiedział „tak" — ale patrzył na obraz,
którego użytkownik w aplikacji nie zobaczy. Ocena postawiona na takim obrazie **nie
jest oceną produktu** (reguła 17).

**Sprostowanie liczby.** `AUDYT_PRZYRZADU_20260901.md` mówił o **29** takich kartach.
Dziś, po naprawach z 01.09, bramka wskazuje **25** — a z tych 25 **sześć to fałszywe
alarmy samej bramki** (sprawdzone kontrolą dodatnią, opis niżej). Realna liczba to
**19**. Nie 29.

#### 3a. Ekran pokazuje własny markup — zero produktu w kadrze (3 karty)

Najgorszy przypadek: w kadrze nie ma ANI JEDNEGO komponentu z produktu.

`canvas-kebab-restructure` · `canvas-toolbar-md-history` · `teresa-confirm-chip`

Pierwsze dwa są w `status.json` opisane jako „stary dowód inżynierski, starszy niż
stan produktu" — czyli nigdy nie miały być ekranem produktowym. **Rekomendacja: zdjąć
z odbioru (ocena D, przyrząd), nie naprawiać.** Trzeci wymaga sprawdzenia, czy chip
potwierdzenia Teresy istnieje w produkcie.

#### 3b. Komponent istnieje w kodzie, ale NIC W PRODUKCIE GO NIE OTWIERA (12 kart)

Zmierzone kontrolą dodatnią: policzyłem pliki w `src/`, które renderują dany komponent,
**odejmując plik jego własnej definicji i pliki testów**. Wynik: zero wołaczy.

| Ekran | Komponent | Wołaczy w produkcie |
| --- | --- | --- |
| `teresa-chipy-panel-artefaktu` | `AIConsultantPanel` | 0 |
| `unified-create-launcher` | `UnifiedCreateLauncher` | 0 |
| `assessment-initiatives-table` | `InitiativesTable` | 0 |
| `assessment-output-report` | `AssessmentReportView` | 0 (tylko test) |
| `assessment-presentation-view` | `AssessmentPresentationView` | 0 (tylko test) |
| `assessment-reports-table` | `ReportsTable` | 0 |
| `results-vnext-legacy-archive` | `ResultsVNextLegacyArchivePanel` | 0 |
| `audyty-drd-report` | `AuditsHub` | 0 (tylko 2 testy) |
| `audyty-warsztat-kryterium` | `CriterionWorkspaceGate` | 0 (tylko 2 testy) |
| `rn-g3-class-l-record-shell` | `TeresaUnavailableNotice` | 0 |
| `finance-model-workspace` | `FinancialModelWorkspace` | 0 |
| `finance-prediction-workspace` | `PredictionWorkspace` | 0 |

**To nie jest defekt wyglądu.** Ekran wygląda dobrze i właściciel słusznie powiedział
„tak" — ale użytkownik nie ma jak do niego dojść. To dług „zbudowane, ale niepodłączone":
brakuje ostatniego przewodu. **Idzie w całości do toru funkcji**, a karty dostają jawny
wyjątek („ekran istnieje, nie jest jeszcze podłączony do nawigacji"), zamiast udawać
gotowość.

Uwaga o `AuditsHub` i `AssessmentPresentationView`: oba są wyeksportowane przez plik
zbiorczy (`index.ts`), ale nikt z tego eksportu nie korzysta. Sam eksport nie jest
dowodem, że coś się renderuje — to ta sama pułapka co „klucz istnieje ≠ przetłumaczony".

#### 3c. Kompozycja, której produkcja nigdy nie stawia razem (4 karty)

Komponenty są prawdziwe, ale nigdy nie występują obok siebie w żadnym pliku produkcji.

`ntype-analizuj-ai` · `results-vnext-okr-admin` · `excele-jeden-widok-materialy` ·
`fab-rail-kebab` (ten dodatkowo narzuca szerokość 560 px, której nie ma ani u wołacza,
ani w komponencie)

Najłagodniejsza kategoria — ekran pokazuje prawdziwe kawałki produktu w układzie, którego
produkt nie tworzy. Do rozstrzygnięcia per ekran, nie hurtem.

---

## ★ SPROSTOWANIE — bramka parytetu ma fałszywe alarmy (6 kart)

Zanim policzyłem 19, sprawdziłem bramkę kontrolą dodatnią. **Sześć z 25 zgłoszeń
to błąd samego przyrządu**, nie defekt karty:

| Ekran | Dlaczego bramka się myli |
| --- | --- |
| `finance-hub` | Harness owija prawdziwy `FinanceHub` we własną otoczkę `React.lazy` o nazwie `FinanceHubLazy`. Bramka widzi nazwę otoczki i nie umie rozwinąć `React.lazy(() => import(...))`. Ekran pokazuje **prawdziwy produkt** — `FinanceHub` ma realnego wołacza w `src/views/EconomicsView.tsx`. |
| `idea-table-tool-empty-filter`, `-grouping`, `-kebab`, `-paste`, `-sortfilter` (5) | `PlatformGridView` **jest** renderowany — w `src/components/MyWork/table/ViewRouter.tsx:1547`, czyli w tym samym pliku, w którym jest zdefiniowany. Bramka odejmuje plik definicji i przez to gubi realnego wołacza. |

**Do zrobienia w bramce** (nie w kartach): rozwijać `React.lazy(() => import('…'))` do nazwy
docelowej i nie odejmować pliku definicji, gdy zawiera on osobny punkt renderowania.
Dopóki to nie jest naprawione, bramka będzie karać uczciwe ekrany — a to uczy ignorować
jej ostrzeżenia, czyli jest gorsze niż brak bramki.

---

## Czego NA TEJ LIŚCIE NIE MA i dlaczego

**15 ekranów z `PARTIA_DO_ZATWIERDZENIA_20260901.md`** (5 poprawionych na uwagę
właściciela + 10 zmienionych po jego akcepcie) — **sprawdzone, nie trzeba klikać
ponownie**. Dokument partii został zapisany 01.09 o 11:40 czasu lokalnego, a decyzje
właściciela dla tych ekranów padły między 11:50 a 12:06 — czyli **po** opublikowaniu
partii. Wyjątek: `admin-command-attention-queue` z tej partii dostał „poprawka" i jest
w Grupie 1 powyżej.

Sprawdzone polecenie: `git log --format="%ci" -1 -- docs/program/grafika/PARTIA_DO_ZATWIERDZENIA_20260901.md`
wobec kolumny `kiedy` w tabeli `decyzje`.

---

## Jak to odtworzyć

```
node /private/tmp/reszta2.mjs          # karty A/B bez decyzji (dziś: 0)
node scripts/check-dev-render-parytet.mjs --report
node /private/tmp/kontrola-dodatnia.mjs # wołacze w produkcie, bez testów i bez definicji
node /private/tmp/lazy-check.mjs        # otoczka lazy czy realny brak wołacza
```

Skrypty pomiarowe leżą poza repozytorium, bo są jednorazowe; jeśli pomiar ma się
powtarzać, trzeba je wnieść do `scripts/dev/` z nagłówkiem mówiącym, po co istnieją.
