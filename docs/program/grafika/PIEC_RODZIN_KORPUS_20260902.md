---
doc_id: grafika-piec-rodzin-korpus-20260902
status: canonical
truth_type: worklog
established: 2026-09-02
zrodlo: docs/program/grafika/KORPUS_UWAG_20260902.md (45 pozycji DO_NAPRAWY, warunki odbioru §"Warunki odbioru")
galaz: grafika/piec-rodzin-korpus-20260902 (baza: github-backup/grafika/m03-20260902 @ 419b2915e7)
zrzuty: evidence/grafika/218-piec-rodzin/ (53 pliki)
---

# Pięć rodzin z korpusu uwag — wykonanie

## Po co ten plik

Rejestr `KORPUS_UWAG_20260902.md` rozliczył 103 uwagi właściciela i wskazał, że
**pięć rodzin zdejmuje 21 z 45 pozycji `DO_NAPRAWY`**. Ten plik jest wykonaniem tych
pięciu rodzin: per rodzina — cytat właściciela, ile razy wracała, **zasięg PRZED
zmierzony greppem albo z żywego DOM-u**, co naprawione, zrzut PO ze zdaniem co widać,
warunek odbioru z rejestru i czy spełniony.

**Zasada tej pracy, wprost z rejestru:** przyczyną nawrotów numer jeden nie jest kod,
tylko to, że **naprawiamy szybciej, niż pokazujemy**. Dlatego każda pozycja ma tu
świeży zrzut PO. Naprawa bez obrazu nie liczy się wcale.

## ★ Ustalenie, które zmienia obraz trzech rodzin

**Cztery z dwudziestu jeden pozycji były już naprawione w kodzie, zanim ta praca się
zaczęła — właścicielowi nigdy tego nie pokazano.** To nie jest domysł: kod ma daty
i komentarze wskazujące dokładnie te zgłoszenia (`caseGrid` w karcie narzędzia,
`IdeaPreview` w tabeli Idei, `RoiCaseCardSections.ts` w ROI). W dwóch przypadkach
(karta narzędzia, tabela Idei) naprawa siedziała w repo od 30.08–01.09.

**Najostrzejszy przypadek to ROI.** Jedna N-karta ROI — ta, o którą właściciel prosił
trzy razy — **jest zbudowana według jego własnej, zaakceptowanej formuły, podpięta do
trasy i działa**. Nie widział jej, bo flaga `roiRegistry` jest domyślnie WYŁĄCZONA na
każdym hoście, a komentarz przy tej fladze podaje powód: *„roiRegistry/okrRegistry stay
OFF below — neither domain has had its dev-render screenshot round + Piotr's odbiór yet"*.
Czyli: **flaga czeka na odbiór, a odbiór czekał na zrzuty, których nikt nie zrobił.**
Ta praca robi te zrzuty. Szczegóły w rodzinie 3.

## Narzędzia pomiarowe zbudowane przy okazji (bo opinia nie mierzy)

| skrypt | co mierzy | dlaczego powstał |
| --- | --- | --- |
| `scripts/dev/measure-preview-canon.mjs` | szerokość `[data-preview-pane]` i kolejność `[data-preview-block]` na 7 panelach 5 ekranów | zdanie „podgląd nie jest zgodny z wzorem" wracało 3× i 3× odpowiadała mu opinia; opinia nie odróżnia 439 px od 448 px |
| `scripts/dev/measure-right-panel-canon.mjs` | kolejność `[data-artifact-section]` + RÓWNOŚĆ zestawów sekcji między ekranami rodziny | warunek odbioru poz. 33 brzmi porównawczo („te same sekcje w tej samej kolejności") — to liczba, nie wrażenie |
| `dev-render/shot.mjs --bez-chrome` | chowa `[data-dev-render-chrome]` przed migawką | kontrolki przyrządu wchodziły w kadr odbioru; ten sam ekran wychodził czysty albo brudny zależnie od zrzutownika |

Sześć bloków podglądu i siedem sekcji prawego pasa nosi teraz znaczniki
`data-preview-block` / `data-artifact-section`. To znaczniki POMIAROWE, nie style —
dzięki nim kanon jest sprawdzalny poleceniem, a nie okiem.

---

# RODZINA 1 — podgląd niezgodny z kanonem (5 pozycji, wraca 3×)

> „Tutaj **ciągle** zobacz Preview nie jest zgodny z wzorem" — `idea-table`, 01.09
> „Zobacz, to jest wartościowy obrazek, bo pokazuje, jak **nieporównywalne** są podglądy,
> które powinny być takie same" — `preview-4-zakladki`, 30.08
> „Niestety, tutaj **tabela preview nie trzyma się opisanego standardu**" — `assessment-five-surfaces`, 30.08

Nawroty: **30.08 (K10, 4 ekrany) → 01.09 (R1, 6 ekranów, już wtedy oznaczone „ZGŁOSZONE
DWA RAZY") → 02.09 (5 ekranów)**.

## Zasięg PRZED (zmierzony, nie oszacowany)

| pomiar | liczba |
| --- | ---: |
| miejsc w `src/` wpisujących szerokość podglądu literałem `clamp(340px, 28%, 480px)` zamiast stałej `PREVIEW_PANE_WIDTH` | **8** |
| wołaczy stałej `PREVIEW_PANE_WIDTH` (moduł `previewGeometry.ts` istniał, ale prawie nikt go nie wołał) | **5** |
| paneli mierzonych na 5 ekranach rejestru | **7** |
| paneli poza kanonem szerokości PRZED | **2** (`interview-preview-canon` ×2 warianty: 439 px zamiast 448 px) |
| ramek bloku „Co dalej" w kodzie (dwa źródła jednej ramki) | **2** (`StandardPreview` miał własną kopię obok `PreviewWhatsNextCard`) |

## Co naprawione

1. **8 literałów szerokości → `PREVIEW_PANE_WIDTH`** (`TableWithPreviewLayout` ×2,
   `InboxContent`, `FocusView` ×2, `DecisionPreviewPanel` ×2, styleguide). Przy okazji
   `data-preview-pane` tam, gdzie go brakowało, więc pomiar w ogóle widzi te panele.
2. **`interview-preview-canon`: 439 px → 448 px.** Przyczyna nie była w produkcie:
   harness dokładał `p-4`, więc `28%` liczyło się od 1568 px zamiast 1600 px. Produkt
   (`InterviewHub.tsx:6992`) montuje tabelę bez marginesu bocznego. **Właściciel
   oceniał szerokość przyrządu, nie komponentu** — i napisał dokładnie to: „Nie umiem
   ocenić, czy szerokość tego jest wystarczająca".
3. **`InterviewSessionPreview`: status wjechał do karty meta.** Stał jako luźny chip
   NAD kartą, więc na kadrze porównawczym Wywiad miał o jeden element więcej niż wzorzec.
4. **`preview-4-zakladki`: czwarta kolumna mieści się w kadrze.** Przy oknie 1440–1600 px
   (tyle ma ekran właściciela) kolumna Decisions była ucięta — a warunek odbioru mówi
   „WSZYSTKIE CZTERY podglądy W KADRZE". Wiersz skaluje się teraz jednorodnie do okna,
   więc kolumny zachowują względem siebie tę samą, kanoniczną szerokość.
5. **`StandardPreview` używa wspólnej `PreviewWhatsNextCard`** — jedna ramka bloku
   „Co dalej" w całej aplikacji zamiast dwóch kopii.
6. **`drd-library-entry`: zdjęte drugie „Otwórz proces".** Ten sam napis stał
   w nagłówku i w stopce; kanon mówi „dokładnie jedno «Otwórz» w całym podglądzie".
   Data w podglądzie zrównana z formatem kolumny tabeli obok (było `2026-08-13`
   przy `13.08.2026` w tabeli — jedna data, dwa zapisy, jeden kadr).
7. **`AssessmentLibraryTab`: włączony licznik słów.** Był wyłączony (`showWordCount: false`)
   wyłącznie tutaj — jeden element bloku 3 różnił Ocenę od wzorca.

## Pomiar PO (`node scripts/dev/measure-preview-canon.mjs --port=3350`)

```
# viewport 1600px, oczekiwana szerokość panelu: 448px
idea-table                        448px  header→meta→details→ai→relations→actions→whatsnext  OK
interview-preview-canon           448px  header→meta→details→ai→relations→actions            OK
interview-preview-canon (init.)   448px  header→meta→details→ai→relations→actions            OK
drd-library-entry                 448px  header→meta→details→relations→actions               OK
preview-4-zakladki                4 kolumny równe (przyrząd skaluje wiersz do kadru)         OK
assessment-five-surfaces (Bibl.)  448px  header→meta→details→actions                         OK
assessment-five-surfaces (Proc.)  448px  header→meta→details→ai→relations→actions→whatsnext  OK
WYNIK: kanon podglądu spełniony na wszystkich mierzonych ekranach.
```

## Rozliczenie per pozycja

| # | ekran | warunek odbioru z rejestru | zrzut PO | spełniony |
| ---: | --- | --- | --- | :-: |
| 26 | `assessment-five-surfaces` | sześć bloków kanonu i te same szerokości co wzorzec | `PO__assessment-five-surfaces__{light,dark}.png` — panel 448 px, licznik słów widoczny, kolejność bloków kanoniczna | **TAK** (z zastrzeżeniem: bloki AI i Powiązania są NIEOBECNE, bo Biblioteka nie ma dla nich danych — kanon nakazuje blok bez danych ukryć, nie renderować pustego boxa) |
| 27 | `drd-library-entry` | panel podglądu z sześcioma blokami, tabela z kompletem kolumn | `PO__drd-library-entry__{light,dark}.png` — 6 kolumn (Typ·Nazwa·Status·Postęp·Autor·Zaktualizowano), panel 448 px, jedno „Otwórz proces", data w formacie tabeli | **TAK** |
| 28 | `idea-table` | sześć bloków w tej samej kolejności i o tej samej szerokości co wzorzec | `PO__idea-table__{light,dark}.png` — 448 px, komplet 7 bloków z „Co dalej" | **TAK** (naprawa siedziała w kodzie od 02.09 rano — brakowało obrazu) |
| 29 | `interview-preview-canon` | sześć bloków i ta sama szerokość panelu co wzorzec | `PO__interview-preview-canon__{light,dark}.png` — 448 px (było 439), status w karcie meta | **TAK** |
| 30 | `preview-4-zakladki` | wszystkie cztery podglądy w kadrze, te same sześć bloków, ta sama kolejność i szerokość | `PO__preview-4-zakladki__{light,dark}.png` — cztery kolumny w kadrze 1440 px, identyczna kolejność bloków | **TAK** |

---

# RODZINA 2 — przyciski wyglądające jak gołe słowa (2 pozycje `DO_NAPRAWY`, wraca 2×)

> „przyciski u góry są po prostu **słowami**, nie przyciskami okrągłymi. Popraw je
> graficznie, żeby wyglądały tak jak reszta naszego dokumentu" — `finance-valuation-workspace`, 30.08
> „Przyciski, żeby były zgodne ze standardem. […] **nic tu nie poprawiłeś**" — `word-intake-uselm-default`, 30.08

Nawroty: **01.09 (R7, 5 ekranów) → 02.09 (3 wystąpienia: 2 `DO_NAPRAWY` + 1 `BACKLOG`
— `canvas-kebab-restructure`, gdzie właściciel sam kończy słowem „zobaczmy", więc to
prototyp, nie warunek odbioru)**.

## Zasięg PRZED (z żywego DOM-u)

| element | PRZED | kanon (`StandardModuleBar` / `ModuleMenu3.tsx`) |
| --- | --- | --- |
| `word-intake` CTA „Zaplanuj dokument" | wysokość **40 px**, promień 8 px (`Button size="md"`, `px-4 py-2.5`) | `MENU_1_PRIMARY_CTA` = **h-9 = 36 px**, `rounded-lg` |
| `word-intake` „Wybór trybu" | zero ramki, zero tła, `py-1` — gołe słowo ze strzałką | pastylka `MENU_3_ACTION_NEUTRAL` |
| `finance-valuation` „Szczegóły techniczne" ×3 | natywny `<summary>` z trójkącikiem przeglądarki, bez ramki i bez wysokości z jakiegokolwiek kanonu | pastylka `MENU_3_ACTION_BASE` = h-8, `rounded-full`, ramka 1 px |
| plików wołających `MENU_1_PRIMARY_CTA` | **40** | — |

## Co naprawione

Geometria bierze się teraz ze stałych kanonu (`MENU_1_PRIMARY_CTA`,
`MENU_3_ACTION_NEUTRAL` w `src/components/shared/ModuleMenu3.tsx` — tych samych,
których używa `StandardModuleBar` i 40 innych plików), a nie z literału per ekran.
Natywny trójkącik `<summary>` zdjęty (`list-none` + `[&::-webkit-details-marker]:hidden`),
w zamian chevron obracany o 90° przy rozwinięciu.

## Pomiar PO

| element | PO |
| --- | --- |
| CTA `word-intake` | **36 px / promień 8 px** — dokładnie `h-9 rounded-lg` |
| „Szczegóły techniczne" ×3 | **32 px / promień 9999 px / ramka 1 px** — dokładnie `MENU_3_ACTION_BASE` |

| # | ekran | warunek odbioru | zrzut PO | spełniony |
| ---: | --- | --- | --- | :-: |
| 1 | `finance-valuation-workspace` | przyciski u góry są pastylkami w ramkach o tych samych wysokościach i promieniach co reszta dokumentu | `PO__finance-valuation-workspace__{light,dark}.png` — trzy „Szczegóły techniczne" jako pastylki z ramką i chevronem | **TAK** |
| 2 | `word-intake-uselm-default` | przyciski są pastylkami wg kanonu (te same wysokości i promienie co `StandardModuleBar`) | `PO__word-intake-uselm-default__{light,dark}.png` — CTA 36 px, „Wybór trybu" w ramce | **TAK** |

---

# RODZINA 3 — N-karta ROI (4 pozycje, wraca 3×, liczba ekranów ROŚNIE 3→3→4)

> „ROI to **jedna analiza** i powinna mieć formułę N-karty. […] to menu, które teraz
> masz, już się nie wciśnie — byłoby to czwarte menu, a to byłoby zupełnie niepotrzebne.
> […] Każda jedna analiza ROI, łącznie z modelem, to jest **po prostu jedna karta**."
> „Muszę to odrzucić […] Musimy przenieść to do jednej n-karty." — `results-vnext-roi-model`
> „to jest kolejna N-karta w jednym ROI-u." — `results-vnext-roi-pir-outcomes`

## ★ Pomiar zmienia zadanie: karta JEST zbudowana

Miałem zmierzyć cztery ekrany i **napisać propozycję jednej karty przed budową**.
Pomiar pokazał coś innego, niż zakładało zlecenie, więc melduję to zamiast budować:

**`src/components/ResultsVNext/roi/RoiCaseCardSections.ts` już implementuje formułę
właściciela — a jego słowa są zacytowane w nagłówku tego pliku.** Karta ma pięć sekcji
w lewej nawigacji (**Założenia → Model → Wynik → Wyniki po wdrożeniu → Wnioski
i rekomendacje**) i **17 podwidoków**; `RoiCaseFullTool` montuje `NModeShell`
+ `ArtifactRightPanel`, `RoiCaseToolPage` jest podpięty do trasy
`/results/roi/cases/:roiCaseId` w `AppRoutes.tsx:3043`, a kebab rejestru ROI
(`ResultsRoiHub.tsx:677`) tam nawiguje.

Zrzuty dowodowe (harness `results-vnext-roi-model` montuje realny `RoiCaseFullTool`):
`POMIAR__roi-karta-sekcja-{1..5}__light.png`. Na sekcji 5 widać PIR jako zakładkę
tej samej karty (`PIR · Wynik PIR · Powiązania Finance · Rekoncyliacje`) — dokładnie
to, o co prosił właściciel przy `results-vnext-roi-pir-outcomes`.

**Dlaczego tego nie widział:** flaga `roiRegistry` w
`src/components/ResultsVNext/resultsVNextFeatureFlags.ts` jest domyślnie OFF **na każdym
hoście** (prod, demo, stage, dev). Komentarz w kodzie podaje powód wprost:
*„roiRegistry/okrRegistry stay OFF below — neither domain has had its dev-render
screenshot round + Piotr's odbiór yet"*. To jest reguła 7 z CLAUDE.md działająca
poprawnie — **ale runda zrzutów, na którą flaga czeka, nie została wykonana przez
cztery dni**, więc karta stoi gotowa i niewidoczna, a zarzut wraca po raz trzeci.

## Propozycja (do Twojej decyzji — NIE wykonałem jej)

1. **Nie budować nic nowego.** Kompozycja jest zaakceptowana przez właściciela
   (prototyp `dev-render/screens/roi-jedna-karta.tsx`) i zbudowana.
2. **Pokazać właścicielowi pięć zrzutów** (`POMIAR__roi-karta-sekcja-1..5`) jako
   partię odbiorczą z jednym pytaniem: „to jest ta karta, o którą prosiłeś — akcept?".
3. **Po akcepcie zapalić `roiRegistry`** w zestawie D-D (demo/stage/dev ON, produkcja
   publiczna OFF) — dokładnie tą samą ścieżką, którą 27.08 przeszedł `kpiRegistry`.
   Jedna zmiana w jednym pliku flag.
4. **`results-vnext-roi-pir-outcomes` zdjąć z rejestru odbioru albo przepisać** — ten
   ekran to samodzielna strona organizacyjna (`ResultsRoiPirOutcomesPage`), a warunek
   odbioru mówi, że PIR ma być zakładką karty. Zakładką JEST; samodzielna strona to
   osobny byt (perspektywa całej organizacji), więc pokazywanie jej właścicielowi jako
   „ROI" wprowadza go w błąd co czwarty przegląd.
5. **`results-vnext-okr-workspace` (poz. 37)** — ta sama diagnoza dla OKR: flaga
   `okrRegistry` również OFF „bez odbioru". Zmierzyłem tylko ROI; OKR wymaga
   analogicznej rundy zrzutów, ale nie zdążyłem jej zrobić i **nie twierdzę, że jest
   gotowa** — to trzeba sprawdzić osobno.

| # | ekran | warunek odbioru | stan |
| ---: | --- | --- | --- |
| 38 | `results-vnext-roi-full-tool` | całe ROI w jednej N-karcie z zakładkami po lewej, brak czwartego poziomu menu | **kod spełnia** — pokazane na `POMIAR__roi-karta-sekcja-*`; czeka na akcept + flagę |
| 39 | `results-vnext-roi-model` | Model to zakładka wewnątrz jednej N-karty ROI | **kod spełnia** — `POMIAR__results-vnext-roi-model__light.png` |
| 40 | `results-vnext-roi-pir-outcomes` | PIR to kolejna zakładka tej samej karty | **kod spełnia** — `POMIAR__roi-karta-sekcja-5__light.png`; ekran w rejestrze pokazuje inny byt |
| 37 | `results-vnext-okr-workspace` | warsztat OKR jest N-kartą z zakładkami po lewej | **niezmierzony** — wymaga własnej rundy |

---

# RODZINA 4 — prawy panel (4 pozycje, wraca 2×)

> „cały ten prawy panel jest **ewidentnie do przepracowania**. […] grafiki, które tutaj
> mamy, […] nie są zgodne ze standardem grafik" — `ideas-teresa-panel`, 30.08
> „tak samo jak we wszystkich innych IDEach, **wraca kwestia prawego menu**" — `idea-table-timeline-stuck`
> „Nie wiem, czy to jest naprawdę **jakaś poprawa**, szczerze powiedziawszy" — `prawy-panel-szyna-ikon`

## Zasięg PRZED i PO (`node scripts/dev/measure-right-panel-canon.mjs --port=3350`)

```
Kanon: actions → properties → relations → evidence → results → comments → history

ideas-teresa-panel          actions→properties→relations→evidence→comments→history   OK
mywork-notebook-rail-speca  actions→properties→relations→evidence→comments→history   OK
karta-tool (odniesienie)    actions→properties→relations→evidence→results→comments→history OK
idea-table-timeline-stuck   (brak sekcji)                                    BRAK PANELU
prawy-panel-szyna-ikon      (brak sekcji — to kadr porównawczy, nie ekran)   n/d

RODZINA "idea" — 2 ekrany mają IDENTYCZNY zestaw sekcji.
```

| # | ekran | warunek odbioru | wynik | spełniony |
| ---: | --- | --- | --- | :-: |
| 32 | `ideas-teresa-panel` | kolejność sekcji z kanonu SPEC-A i wyłącznie tokeny `c-*` | kolejność **OK** (zmierzona). Tokeny: **NIE do końca** — patrz niżej | **częściowo** |
| 33 | `mywork-notebook-rail-speca` | te same sekcje w tej samej kolejności co Idee; informacja o backlogu w obu albo w żadnym | zestawy sekcji **identyczne**; słowo „backlog" nie występuje w **żadnym** z dwóch | **TAK** |
| 31 | `idea-table-timeline-stuck` | prawy panel ma tę samą kolejność sekcji i tokeny co `ideas-teresa-panel` | **NIE** — w stanie domyślnym prawy pas to `IdeaElementInspector` (stan pusty „Zaznacz element…"), a `ArtifactRightPanel` montuje się dopiero po otwarciu sekcji z szyny (`IdeaMapWorkspace.tsx:5144`) | **NIE** |
| 34 | `prawy-panel-szyna-ikon` | jeden kadr PRZED/PO pokazuje, co szyna dodaje; jeśli nic — wraca wariant poprzedni | **naprawione i pokazane** | **TAK** |

## Co naprawione

**Poz. 34 — kadr, który niczego nie pokazywał.** Ekran porównawczy startował
w stanie ROZWINIĘTYM, a rozwinięte oba warianty wyglądają **identycznie** — cała
różnica siedzi w gałęzi `collapsed`. Właściciel oglądał więc obraz, na którym
z definicji nie było czego porównać, i napisał dokładnie to, co widział. **Miał rację
co do kadru, nie co do zmiany.** Start ustawiony na `collapsed=true`:
`PO__prawy-panel-szyna-ikon__{light,dark}.png` pokazuje bez ani jednego kliknięcia
16-px pasek z samą strzałką (PRZED) obok 56-px szyny z kompletem ikon i odznakami (PO).

## Dwie rzeczy zmierzone i NIE naprawione (wymagają decyzji)

1. **Poz. 32, tokeny.** Przyciski „Eksportuj"/„Konwertuj" w sekcji Akcje niosą surowe
   `border-slate-200 text-slate-700 bg-slate-100` zamiast `c-*`. Źródło nie jest
   w Ideach: to schemat `neutral` w `src/components/shared/PreviewPane/previewStyles.ts`
   — **jedno źródło wszystkich neutralnych pastylek podglądu i szyny w aplikacji**.
   Przepięcie na tokeny `c-*` to jedna linia, ale **przemalowuje każdą pastylkę
   w produkcie**, więc należy mu się własna partia odbiorcza, a nie doklejenie do tej.
2. **Poz. 31.** Żeby prawy pas tabeli Idei wyglądał „identycznie jak w `ideas-teresa-panel`",
   trzeba rozstrzygnąć, **co ma stać w prawym pasie narzędzia Tabela, gdy nic nie jest
   zaznaczone**: kanoniczny `ArtifactRightPanel` samej Idei (moja rekomendacja — wtedy
   pas jest zawsze ten sam, a inspektor elementu wchodzi po zaznaczeniu), czy dzisiejszy
   pusty inspektor. To zmiana kompozycji, więc zgodnie z regułą 7 nie ruszałem jej bez
   Twojej zgody i akceptu właściciela na prototypie.

---

# RODZINA 5 — szerokość i układ tabeli (4 pozycje `DO_NAPRAWY`, wraca 3×)

> „**to ni jest szerokoś strony** :(" — `admin-command-attention-queue`, 01.09
> „Mieliśmy usunąć dwa przykłady, bo mieliśmy trzy. **Został jeden, ale w postaci jednej
> kolumny. To wygląda bez sensu.**" — `karta-tool`, 30.08
> „Nie wiem, czemu to jest **inna tabela inicjatyw**. […] powinniśmy mieć jedną tabelę
> inicjatyw." — `initiative-record`, 30.08

Nawroty: **30.08 (K1, 8 ekranów) → 01.09 (R3, 9 ekranów) → 02.09 (5 wystąpień, z czego
4 już `ZROBIONE`)**. Uwaga na liczby: rejestr podaje dla tej rodziny „5" w planie, ale
w tabeli warunków odbioru stoją **4 pozycje `DO_NAPRAWY`** (poz. 9, 12, 14, 15) — piąte
wystąpienie jest po stronie `ZROBIONE`. Pracowałem na czterech.

## Zasięg PRZED (grep + DOM)

| pomiar | wynik |
| --- | --- |
| moduły z sufitem szerokości treści (`max-w-[1280px]`/`7xl`/`6xl`/`5xl`) | **tylko Administracja** — `InitiativesHub`, `ExecutionHub`, `AssessmentHub`, `FinanceHub` mają **0 trafień** |
| szerokość tabeli „Kolejka uwagi" przy oknie 1600 px | **1212 px** (388 px pustego marginesu) |
| kolumny tabeli inicjatyw: Ocena vs moduł Inicjatywy | **6 vs 10**, część wspólna **3** |

## Co naprawione

**Poz. 12 — zdjęty sufit `max-w-[1280px]`** w `src/views/admin/AdminSettingsModule.tsx:599`
(i lustrzany literał w harnessie `admin-command.tsx`). Padding responsywny zostaje —
to odstęp od krawędzi, nie sufit.

Pomiar PO: tabela **1212 px → 1532 px** przy oknie 1600 px.
Zrzut: `PO__admin-command-attention-queue__{light,dark}.png` — kolejka dochodzi do
krawędzi strony w obu motywach.

**Poz. 9 — układ przykładu w karcie narzędzia: naprawa istniała, brakowało obrazu.**
`caseGrid` w `KnownToolDetailView.tsx` dostosowuje siatkę do liczby przypadków od
30.08–01.09; w kodzie stoi nawet cytat właściciela. Zrzut
`PO__karta-tool__przyklad__{light,dark}.png` pokazuje po raz pierwszy: jeden przypadek
zajmuje **pełną szerokość kolumny centralnej**, a sześć pól układa się w trzy kolumny
wewnątrz karty — ten sam język co sąsiednie bloki.
**Druga połowa warunku (przeklikanie wypełniania dokumentu na zrzutach) NIE jest
zrobiona** — wymaga przejścia sesji narzędzia, czego ten harness nie obejmuje.

## Poz. 14 i 15 — NIE ruszane, wymagają decyzji kompozycyjnej

Zmierzone zestawy kolumn:

| tabela | kolumny |
| --- | --- |
| Ocena (`assessment/InitiativesTable.tsx`) | name · status · completeness · owner · priority · budget (**6**) |
| moduł Inicjatywy (`CanonicalInitiativeRegister.tsx`) | name · status · gateName · gateReadiness · owner · nextAction · expectedImpact · plannedWindow · healthState · updatedAt (**10**) |
| część wspólna | name · status · owner (**3**) |

To nie jest kosmetyka: tabele opisują **różne stany życia** obiektu (Ocena kończy się
DRAFTAMI inicjatyw, rejestr Inicjatyw prowadzi je przez bramy). Scalenie ich w jedną
tabelę to decyzja produktowa, nie graficzna.

**Dodatkowo: warunek odbioru poz. 15 nie pasuje do dzisiejszego ekranu.**
`initiative-record` nie pokazuje ŻADNEJ tabeli inicjatyw — to karta artefaktu
(zrzut `PRZED__initiative-record__light.png`). Warunek „ekran `initiative-record`
i tabela w module Inicjatywy pokazują tę samą tabelę" jest dziś nierozstrzygalny
i trzeba go przepisać albo zdjąć pozycję z rejestru.

**Propozycja:** jedna tabela inicjatyw = rejestr z modułu Inicjatywy z **profilem
kolumn per kontekst** (Ocena pokazuje 6 z 10, reszta ukryta pstryczkiem), jeden kebab,
jedna implementacja. Do rozstrzygnięcia z właścicielem na prototypie — nie budowałem.

---

# Ekrany gotowe do zapalenia na stronie odbioru

Zrzuty PO są w `evidence/grafika/218-piec-rodzin/` (light + dark dla każdego).

| ekran | co właściciel ma zobaczyć | pliki |
| --- | --- | --- |
| `idea-table` | podgląd ma komplet 7 bloków, 448 px — trzecie zgłoszenie zdjęte | `PO__idea-table__{light,dark}.png` |
| `interview-preview-canon` | panel 448 px (było 439 — to mierzył przyrząd), status w karcie meta | `PO__interview-preview-canon__{light,dark}.png` |
| `preview-4-zakladki` | cztery podglądy w jednym kadrze 1440 px, ta sama kolejność bloków | `PO__preview-4-zakladki__{light,dark}.png` |
| `drd-library-entry` | 6 kolumn, podgląd kanoniczny, jedno „Otwórz", jeden format daty | `PO__drd-library-entry__{light,dark}.png` |
| `assessment-five-surfaces` | podgląd Oceny 448 px z licznikiem słów | `PO__assessment-five-surfaces__{light,dark}.png` |
| `finance-valuation-workspace` | „Szczegóły techniczne" jako pastylki (32 px, ramka) zamiast gołych słów | `PO__finance-valuation-workspace__{light,dark}.png` |
| `word-intake-uselm-default` | CTA 36 px = wysokość `StandardModuleBar`; „Wybór trybu" w ramce | `PO__word-intake-uselm-default__{light,dark}.png` |
| `admin-command-attention-queue` | tabela na pełną szerokość strony (1532 z 1600 px) | `PO__admin-command-attention-queue__{light,dark}.png` |
| `karta-tool` (Przykład) | jeden przypadek na pełną szerokość, sześć pól w trzech kolumnach | `PO__karta-tool__przyklad__{light,dark}.png` |
| `prawy-panel-szyna-ikon` | kadr, na którym WIDAĆ różnicę: 16-px pasek vs 56-px szyna | `PO__prawy-panel-szyna-ikon__{light,dark}.png` |
| `ideas-teresa-panel` | kolejność sekcji kanonu (zmierzona) | `PO__ideas-teresa-panel__{light,dark}.png` |
| `mywork-notebook-rail-speca` | identyczny zestaw sekcji co Idee | `PO__mywork-notebook-rail-speca__{light,dark}.png` |
| **ROI — 5 sekcji karty** | **jedna N-karta ROI, o którą prosił trzy razy — do akceptu, po którym zapalamy flagę** | `POMIAR__roi-karta-sekcja-{1..5}__light.png` |

# Podsumowanie liczbowe

| rodzina | pozycji w zleceniu | spełnionych | częściowo | do decyzji |
| --- | ---: | ---: | ---: | ---: |
| podgląd | 5 | **5** | 0 | 0 |
| przyciski-słowa | 2 (+1 `BACKLOG`) | **2** | 0 | 0 |
| szerokość / układ tabeli | 4 | **1** (poz. 12) | 1 (poz. 9 — połowa) | 2 (poz. 14, 15) |
| prawy panel | 4 | **2** (poz. 33, 34) | 1 (poz. 32 — tokeny) | 1 (poz. 31) |
| N-karta ROI | 4 | 0 zbudowanych przeze mnie — **3 spełnia już kod**, czeka akcept + flaga | 0 | 1 (poz. 37 OKR, niezmierzony) |
| **razem** | **19** | **10 zamkniętych + 3 gotowe do akceptu** | **2** | **4** |

Cztery pozycje wymagają Twojej decyzji, zanim ktokolwiek ruszy kod: scalenie tabel
inicjatyw (14, 15), zawartość prawego pasa tabeli Idei (31) i przepięcie schematu
`neutral` na tokeny `c-*` (32). Trzy pozycje ROI wymagają wyłącznie pokazania
właścicielowi gotowych zrzutów i zapalenia flagi po jego akcepcie.
