---
doc_id: grafika-uwagi-odbior-20260901
status: canonical
truth_type: worklist
established: 2026-09-01
zrodlo: odbior.sqlite — tabele `historia` (278 wierszy z treścią) i `decyzje` (169 ekranów)
snapshot: 2026-09-01T05:10Z (baza jest ŻYWA — właściciel klikał w trakcie tej analizy)
poprzednik: MAPA_UWAG_WLASCICIELA.md (klastry K1–K12 z sesji 30.08) — ten plik go NIE zastępuje, tylko domyka o sesję 01.09 i przelicza całość
---

# Uwagi właściciela z odbioru — całość bazy, pogrupowane po przyczynie

Lista robocza. **Rodziny, nie ekrany.** Jedna przyczyna zdejmuje kilka uwag naraz;
naprawa robiona per wywołanie w tym repozytorium odrasta (udokumentowane wprost
w `src/components/shared/ModuleHub/FilterableTable.tsx:808-818`).

---

## Podsumowanie liczbowe

| miara | wartość |
| --- | --- |
| wierszy w `historia` z niepustą uwagą | **278** |
| uwag po odsianiu duplikatów-per-znak | **95** |
| — z tego gołe potwierdzenia („ok" / „OK") | 8 |
| — z tego porzucone fragmenty pisania („Totaj jest prz") | 2 |
| **realnych uwag merytorycznych** | **85** |
| ekranów, których uwagi dotyczą | 83 |
| uwag z 30.08 · z 01.09 | 72 · 23 |
| ekranów ocenionych w ogóle (`decyzje`) | 169 z 313 w `status.json` |
| stan bieżący: `ok` · `poprawka` · `nie` | 128 · 33 · 8 |
| rodzin problemów | **13** |
| uwag jednostkowych (nie tworzą rodziny) | 16 |
| uwag będących pytaniem/decyzją dla właściciela | 12 |

**Skala defektu danych.** 278 wierszy → 85 uwag. Na jedną uwagę przypadało średnio
**3,3 klatki tej samej myśli**, rekordzista (`canvas-kebab-restructure`) 18 klatek.
Defekt naprawiono u źródła dzisiaj — commit `c00ef35581` („jedna uwaga = jeden wpis
historii"), plus siatka bezpieczeństwa po stronie serwera
(`scripts/dev/odbior-serwer.mjs:143-169`). Odsiewanie było potrzebne **tylko dla
historii sprzed dzisiaj**; kolejne odbiory dadzą czyste dane.

### Co się stało 01.09 — sesja była w większości POTWIERDZAJĄCA

49 ekranów dostało decyzję, z tego **22 zmieniły werdykt z `poprawka`/`nie` na `ok`**.
W drugą stronę poszły dwa. Właściciel napisał wprost:
> „Potwierdzam ok. Będę wpisywał dalej tylko ok jako ponowne potwierdzenie"

**Regresje / rzeczy nadal otwarte po ponownym obejrzeniu — to jest sedno dzisiejszego dnia:**

| ekran | było | jest | słowa właściciela |
| --- | --- | --- | --- |
| `idea-table` | poprawka | **poprawka** | „dalej jest problem - preview z tej tabeli nie jest zgodny ze standardem preview" |
| `assessment-presentation-view` | nie | **poprawka** | „Ciągle nie wiem dlaczego nie używasz mojej macierzy DRD - nie mam już siły serio !!" |
| `notatnik-osierocone-graf` | ok | **poprawka** | „kilka na jednym ekranie nie daje komfortu pracy" |

Dwie pierwsze to rodziny **R1** i **R8** poniżej. To jedyne miejsca, gdzie właściciel
zgłosił ten sam problem **drugi raz po deklarowanej naprawie**.

---

## Rodziny problemów

Uszeregowane wg liczby dotkniętych ekranów. Ekran może należeć do dwóch rodzin
(np. `excele-prawy-panel-standard` do R2 i R4) — suma pozycji > 85.

---

### R1 · „Podgląd nie jest zgodny ze standardem preview" — 6 ekranów · ⚠ ZGŁOSZONE DWA RAZY

> „Tutaj podgląd, widoczny po prawej stronie ekranu, nie jest zgodny ze standardem.
> Układ od góry do dołu również nie spełnia wymagań." (`idea-table`, 30.08)
>
> „**dalej jest problem** - preview z tej tabeli nie jest zgodny ze standardem preview" (`idea-table`, 01.09)
>
> „to jest wartościowy obrazek, bo pokazuje, jak **nieporównywalne są podglądy**,
> które powinny być takie same" (`preview-4-zakladki`)

Ekrany: `idea-table` · `idea-table-timeline-stuck` („wraca kwestia prawego menu")
· `assessment-five-surfaces` · `interview-preview-canon` · `preview-4-zakladki`
· `drd-library-entry` („nie ma żadnego podglądu").

**Miejsce w kodzie** — cztery warstwy tej samej rzeczy, i to jest przyczyna
nieporównywalności:
- `src/components/standard/StandardPreview.tsx`
- `src/components/shared/PreviewPane/PreviewPaneAside.tsx`
- `src/components/ui/ResizableTable/PreviewPaneShell.tsx`
- `src/components/shared/TableWithPreviewLayout.tsx`

`PreviewPaneShell` ma **21 wołaczy w `src/`**. Kanon opisany w skillu `consultify-preview`.

**Oszacowanie: JEDNA zmiana w jednym miejscu, ale w miejscu ryzykownym.**
Naprawa idzie do wspólnej powłoki, nie do `idea-table`. Ta rodzina była w mapie
z 30.08 jako K10 „do naprawy" — właściciel 01.09 potwierdził, że nie została naprawiona.

#### ★ SPROSTOWANIE 2026-09-01 (dyżur 175) — dla `idea-table` powyższa diagnoza była BŁĘDNA

**NIE DOTYKAJ `PreviewPaneShell` z powodu `idea-table`.** Zmierzone w żywym DOM
(1440×900, `[data-preview-pane]`), oba ekrany montują TEN SAM `IdeasTableContent`:

| ekran | szerokość podglądu | werdykt |
| --- | --- | --- |
| `idea-table-production` | **403 px** | = kanon §7.2 `clamp(340px, 28%, 480px)` przy 1440 px |
| `idea-table` (przed naprawą) | **340 px** | dno `clamp()` |

Kolejność bloków, ramki, typografia nagłówka (16px/600), padding (12px) i
`border-left: 0px` były **identyczne** na obu. Różniła się WYŁĄCZNIE szerokość.

**Przyczyna nie była w produkcie ani we wspólnej powłoce, tylko w przyrządzie:**
`dev-render/screens/idea-table.tsx` dokładał z prawej **eksploracyjny**
`ArtifactRightPanel` (~440 px), więc 28% liczyło się z ~1000 px = 280 px i podgląd
spadał na dno `clamp()`. Skutek uboczny: ekran pokazywał DWA prawe panele obok
siebie z powtórzonymi nagłówkami „POWIĄZANIA" i „AI", w dodatku sprzecznymi
(„Brak powiązań" w podglądzie vs „1 inicjatywa promowana" w panelu — dane panelu
były zmyślone w harnessie).

**Produkcja tej kompozycji NIE MA:** `MyIdeasListContent.tsx:1943` montuje
`IdeasTableContent` jako jedyne dziecko kolumnowego flexa — zero trafień na
`RightPanel` w całym pliku. Właściciel trzy razy oceniał kompozycję, której w
produkcie nie ma, a my dwa razy naprawialiśmy produkt zgodny z kanonem.
To jest ten sam kształt awarii co „przyrząd kłamie" — patrz `--klik`, `--przewin`,
`--klawisze` w `scripts/dev/grafika-zrzuty.mjs`.

Naprawiono usunięciem eksploracyjnego panelu z ekranu harnessu (403 px po zmianie;
zrzuty PRZED/PO: `evidence/grafika/175-preview-wzor/`). Zero zmian w `src/`.

**Dwie rzeczy zostają otwarte i wymagają decyzji, nie kodu:**
1. **SPEC-A vs podgląd wiersza.** Jeśli tabela ma być artefaktem SPEC-A z własnym
   prawym panelem, to panel artefaktu i podgląd wiersza potrzebują reguły
   **wzajemnego wykluczania** — inaczej dwa prawe panele ZAWSZE zjadą podgląd na
   dno `clamp()`. To jest realne pytanie produktowe, które ta eksploracja odsłoniła.
2. **Skill `consultify-preview` jest NIEAKTUALNY.** Podaje „blok 4 = Co dalej,
   blok 5 = Akcje" (Co dalej PRZED akcjami). Normatywny `TABLE_AND_PREVIEW_CANON.md`
   §7.0 poprawiono 2026-08-02 na **AI → Relations → Akcje → Co dalej** (Co dalej
   poza numeracją, na końcu) — zgodnie z `StandardPreview.tsx`. Skill trzeba
   zrównać z normą, zanim wyśle kogoś w złą stronę.

Pozostałe pięć ekranów rodziny R1 (`assessment-five-surfaces`,
`interview-preview-canon`, `preview-4-zakladki`, `drd-library-entry`,
`idea-table-timeline-stuck`) **nie były przedmiotem tego pomiaru** — nie zakładaj,
że mają tę samą przyczynę. Zmierz każdy osobno, tym samym sposobem.

---

### R2 · „Cały ten prawy panel jest do przepracowania" — 6 ekranów

> „Dobra, przeanalizowałem i teraz tak: cały ten prawy panel jest ewidentnie do
> przepracowania. Zarówno w ujęciu graficznym, kolejności myśli, jak i merytorycznym
> (…) rozwiązania graficzne też nie są przeanalizowane przez Ciebie i nie są zgodne
> ze standardem grafik (…) To jest słabe." (`ideas-teresa-panel`)
>
> „one powinny wyglądać tak samo, mieć te same elementy (…) ale na pewno rządzić się
> tymi samymi zasadami" (`mywork-notebook-rail-speca`)
>
> „Tutaj wielkim wyzwaniem jest ten panel boczny" (`processflow-canvas`, 01.09)

Ekrany: `ideas-teresa-panel` · `mywork-notebook-rail-speca` · `processflow-canvas`
· `deck-artifact` · `excele-prawy-panel-standard` · `prawy-panel-szyna-ikon`.

**Miejsce w kodzie:**
- `src/components/standard/IdeaRightPanel.tsx` (ten, który właściciel nazwał „słabym")
- `src/components/standard/ArtifactRightPanel.tsx` — **61 wołaczy w `src/`**
- `src/components/standard/ArtifactRightRail.tsx`

**Oszacowanie: rozsiane, ale z jednym jądrem.** Właściciel sam poprosił, żeby to
poszło **do backlogu jako osobna analiza**, nie jako doraźna poprawka — i to jest
właściwe podejście przy 61 wołaczach.

---

### R3 · „Tabela nie jest na pełną szerokość / kolumna ucięta" — 9 ekranów · W WIĘKSZOŚCI ZAMKNIĘTE

> „tabela tego sejfu jest dziwnie wąska. Nie rozciąga się na całą szerokość (…)
> żeby każdy wiersz był jedną linią, jak w tabeli" (`vault-safes-table`)
>
> „To muszą być raporty, które są po prostu pełną tabelą na pełną szerokość" (`audyty-drd-report`)

Ekrany: `vault-safes-table` · `audyty-drd-report` · `assessment-list` ·
`assessment-reports-panel` · `assessment-initiatives-table` · `plan-scenario-d1` ·
`finance-analysis-workspace` · `template-library-new-entry` · `standard-module-bar-children`.

**Przyczyna była podwójna** (zmierzone 30.08, K1/K3):
1. **Stanowisko pomiarowe** — `maxWidth: 1180` w harnessie, nie w produkcie.
   Usunięte commitem `54f450efb8`. Zostało jedno: `dev-render/screens/standard-module-bar-children.tsx:26`.
2. **Realny defekt ucięcia ostatniej kolumny** — `src/components/shared/ModuleHub/FilterableTable.tsx`.
   Plik sam niesie ostrzeżenie w komentarzu (linie 808-818): *naprawa per wywołanie
   odrosła po ośmiu tygodniach w kilkunastu plikach, `min-width` przy `table-fixed`
   niczego nie ratuje, bo to on wymusza nadmiar*. Tabela renderuje się jako
   `w-full table-fixed` (linia 1090). **85 wołaczy w `src/`.**

**Stan po 01.09:** 6 z 9 ekranów właściciel przeklikał ponownie na `ok`
(`vault-safes-table`, `assessment-list`, `assessment-reports-panel`,
`assessment-initiatives-table`, `drd-library-entry`, `assessment-five-surfaces`).
Otwarte zostają: `audyty-drd-report`, `plan-scenario-d1`, `template-library-new-entry`,
`standard-module-bar-children`, `finance-analysis-workspace`.

**Oszacowanie: jedno jądro (`FilterableTable`), najbardziej ryzykowne w całym zestawie.**

---

### R4 · „Arkusz i prezentacja bez narzędzi do pracy" — 6 ekranów

> „jedna trzecia ekranu jest zużyta zupełnie niepotrzebnie na informacje albo funkcje,
> które mogłyby być w panelu bocznym rozwijanym. Mamy upodobnić się tutaj do narzędzi
> tabelarycznych, takich jak Excel." (`sheet-artifact`)
>
> „nie mam tutaj w ogóle narzędzia Excelowego (…) **w Wordzie mogę, w PowerPoincie też
> nie mogę** — to trzeba dorobić" (`excele-prawy-panel-standard`)
>
> „Tak jak pisałem już **trzy razy**, wyrzucamy całą tę zabawę z góry do prawego panelu
> i musimy dołożyć u góry listę narzędzi do pracy z tabelą" (`excele-edytowalna-siatka`)

Ekrany: `sheet-artifact` · `excele-prawy-panel-standard` · `excele-edytowalna-siatka`
· `deck-artifact` · `excele-jeden-widok-recent` · `excele-engine-reveal`.

**Miejsce w kodzie:**
- `src/components/AIChat/KimiWorkspace/KimiWorkspaceShell.tsx` — górna belka i układ
- `src/components/AIChat/KimiWorkspace/SpreadsheetArtifactStudio.tsx`, `ExceleView.tsx`
- `src/components/Presentations/` (Deck)

**Sprostowanie — edycja komórek ISTNIEJE.** `src/components/AIChat/KimiWorkspace/EditableSpreadsheetGrid.tsx`
działa i jest **domyślnie włączona od 2026-07-28** (`src/utils/exceleEditFlag.ts`:
klik → edycja → Enter/Tab, przeliczanie formuł, `PATCH /api/workbook/:id/cell`).
Brakuje **paska narzędzi tabelarycznych** i tego, żeby tabela zaczynała się od góry —
i to jest to, o co właściciel prosi trzeci raz. Czy edytowalna siatka jest osiągalna
z tego konkretnego ekranu, który oglądał — **do ustalenia zrzutem**.

**Oszacowanie: rozsiane — dwie osobne powłoki (arkusz i deck) plus decyzja o pasku narzędzi.**

---

### R5 · „Nie wiem, gdzie to jest / co to jest" — 10 ekranów · NIE JEST TO WADA GRAFIKI

> „Znowu nie wiem, gdzie to jest" · „Nie wiem, nie mam pojęcia, gdzie ten ekran jest" ·
> „Znowu nie mam pojęcia, co to jest" · „Nie wiem, gdzie to jest, ale to jest w ogóle super mądre"

Ekrany: `mywork-idea-inspector-lekki` · `notatnik-osierocone-graf` · `notatnik-centrum-mysli`
· `chat-signals-feed` · `prompt-registry-tab` · `admin-command-center-panel`
· `standard-module-bar-children` · `zwornik-projects` · `audyty-drd-report`
· `idea-financial-case-persistence`.

**Przyczyna: brak opisu drogi dojścia na karcie odbioru, nie defekt ekranu.**
Naprawione u źródła 30.08 — `scripts/dev/odbior-serwer.mjs:237` renderuje pole `gdzie`,
a `status.json` ma je wypełnione dla **wszystkich dziesięciu** tych ekranów (sprawdziłem
każdy). Dwa z nich mają szczerą odpowiedź wpisaną wprost: `standard-module-bar-children`
= „TO NIE JEST EKRAN PRODUKTOWY", `audyty-drd-report` = „ta zakładka jest ZA FLAGĄ,
domyślnie WYŁĄCZONĄ — w aplikacji jej dziś nie zobaczysz".

**Zostaje do zrobienia:** weryfikacja klikiem, że opisy `gdzie` są prawdziwe — powstały
z czytania kodu, nie z klikania (K9 z mapy 30.08, nadal niewykonane).

**Oszacowanie: jedna zmiana już zrobiona; reszta to praca weryfikacyjna, nie kodowa.**

---

### R6 · „Stara grafika, do podniesienia standardu" — 7 ekranów

> „Grafika tego jest fatalna, po prostu stara." (`results-vnext-teresa-okr-reflection`)
>
> „Też można poprawić grafiki, nie? W wielu miejscach można poprawić je na ładniejszy
> styl. Przyciski, żeby były zgodne ze standardem. **Wiem, że to nie jest super ważne,
> ale nic tu nie poprawiłeś.**" (`word-intake-uselm-default`)
>
> „Napisz to ładniej, wyśrodkuj na ekranie." (`document-studio-resume-error`)
>
> „Magicznie jest w porządku, tylko mogłoby być trochę bardziej seksowne." (`materialy-launcher`)

Ekrany: `results-vnext-teresa-okr-reflection` · `word-intake-uselm-default` ·
`materialy-launcher` · `interview-creator-shell` · `document-studio-resume-error` ·
`document-studio-template-resolve-error` · `teresa-confirm-chip` (zamknięty 01.09 na `ok`).

**Miejsce w kodzie: rozsiane per ekran — do ustalenia osobno dla każdego.**
Wspólna nie jest przyczyna techniczna, tylko fakt, że **te ekrany nigdy nie przeszły
formuły polerowania grafiki**. Dwa ekrany błędu (`document-studio-*`) to jeden wzorzec
„pusty stan / błąd" i można je zrobić razem.

**Oszacowanie: rozsiane, tanie, dobre na jeden dyżur zbiorczy.**

---

### R7 · „Akcje wyglądają jak gołe słowa, nie jak przyciski" — 5 ekranów

> „przyciski u góry są po prostu słowami, nie przyciskami okrągłymi. Popraw je graficznie,
> żeby wyglądały tak jak reszta naszego dokumentu." (`finance-valuation-workspace`)
>
> „nagle wielkie funkcje są pod pojedynczymi słowami (…) może warto byłoby zrobić z nich
> przyciski w delikatnych ramkach i półokrągłe. **To bardzo ważna zmiana bo dotyczy ona
> wszystkich idea.**" (`canvas-kebab-restructure`, 01.09)

Ekrany: `finance-valuation-workspace` · `canvas-kebab-restructure` ·
`word-intake-uselm-default` · `template-library-new-entry` · `results-vnext-okr-registry`
(„w prawym górnym rogu powinien być przycisk »Nowe OKR«, a teraz są jakieś inne
niepotrzebne przyciski").

**Miejsce w kodzie:** `src/components/standard/StandardModuleBar.tsx` dla ekranów listowych;
dla `finance-valuation-workspace` i `canvas-kebab-restructure` — **do ustalenia**
(oba mają własne, niestandardowe belki; dokładny plik trzeba wskazać zrzutem).

**Oszacowanie: potencjalnie jedna zmiana w `StandardModuleBar`, ale właściciel sam
ostrzegł, że dotknie „wszystkich idea" → ryzykowna, osobny dyżur, flaga OFF do akceptu.**

---

### R8 · „Nie używasz mojej macierzy DRD" — 3 ekrany · ⚠ ESKALACJA, DECYZJA JUŻ PODJĘTA

> „Nigdzie nie znalazłem macierzy. Macierz jest przedstawieniem graficznym na wszystkich
> osiach ze zmiennymi osiami. Poszukaj tego dokładnie. **To w kodzie istnieje.**"
> (`assessment-quality-review-panel`, 30.08)
>
> „**Ciągle nie wiem dlaczego nie używasz mojej macierzy DRD - nie mam już siły serio !!**
> moja macierz jest serio ładna - już ją znalazłeś przecież (zobacz mam to na ekranie
> Macierz oceny DRD — obszary x poziomy)" (`assessment-presentation-view`, 01.09)

Ekrany: `assessment-presentation-view` · `assessment-quality-review-panel` ·
`assessment-output-report`. Ekran, na który właściciel wskazuje jako dowód:
`drd-macierz-oceny` (moduł `05-ocena`, ocena B, przez niego zaakceptowany 01.09).

**Miejsce w kodzie — ustalone i rozstrzygnięte 30.08 (decyzja D-1: „Tak, 7 osi"):**
- `src/components/Reports/EmbeddedMatrix.tsx` — wybrana implementacja
- `src/utils/drdReportFlag.ts` — flaga `isDrdReportEnabled` domyślnie **wyłączona**,
  zmienna `VITE_DRD_REPORT_ENABLED` nigdzie nieustawiona → macierz dziś nieosiągalna
- `DrdHttpMethodWorkspaceScreen.tsx:977` — `FrozenOutputHttpView` usuwa macierz
  z ekranu po zamrożeniu sesji, czyli dokładnie wtedy, gdy ma wejść do raportu

**To nie jest problem do zbadania — to problem do WYKONANIA.** Decyzja zapadła 30.08,
przez dwa dni nie zrobiono nic, i dlatego właściciel pisze „nie mam już siły".

**Oszacowanie: jedna zmiana w jednym miejscu (wpięcie `EmbeddedMatrix` w raport
i w widok po zamrożeniu). Najwyższy priorytet ze wszystkich rodzin.**

---

### R9 · „ROI to jedna karta N" — 3 ekrany · CZĘŚCIOWO ZROBIONE

> „ROI to jedna analiza i powinna mieć formułę N-karty (…) to menu, które teraz masz,
> już się nie wciśnie – byłoby to czwarte menu (…) **Każda jedna analiza ROI, łącznie
> z modelem, to jest po prostu jedna karta.**"

Ekrany: `results-vnext-roi-full-tool` (`nie`) · `results-vnext-roi-model` (przeklikany
na `ok` 01.09) · `results-vnext-roi-pir-outcomes` (`nie`).

**Miejsce w kodzie:** `src/components/ResultsVNext/roi/` — `ResultsRoiHub.tsx`,
`ResultsRoiPirOutcomesPage.tsx`; powłoka `ResultsVNextRegistryShell.tsx`.
`roi-jedna-karta` i `cel-jedna-karta` w `status.json` mają 01.09 decyzję `ok` — czyli
kierunek został właścicielowi pokazany i przyjęty.

**Oszacowanie: jedna zmiana strukturalna w module Wyników, ograniczona do ROI.**

---

### R10 · „Generatory szablonów — po co one w ogóle są" — 5 ekranów · DECYZJA PRODUKTOWA

> „Znowu, gdy mamy generator do wyboru, wybieramy »generuj tabelę template«, otwiera się
> generator szablonów, a potem mamy je w liście szablonów." (`gen-word-content-hints`)
>
> „Samo, nie wiem, po co on w ogóle jest." · „To samo nie wiem, po co on jest."

Ekrany: `gen-word-content-hints` · `gen-deck-content-hints` · `gen-excel-templates-tab`
· `prezentacje-template-states` · `excele-jeden-widok-recent` („Nie potrzebny w ogóle
ten arkusz. To pozostałość pierwszych prób").

**Miejsce w kodzie: do ustalenia** — najpierw musi zapaść decyzja, czy te ekrany
w ogóle zostają. Właściciel opisał docelowy przepływ; to on jest kryterium.

**Oszacowanie: nie jest to praca graficzna. Najpierw usunięcie/scalenie, potem grafika.**

---

### R11 · „Pasek / panel nie mieści treści i przytłacza" — 4 ekrany

> „jak zaznaczam element, otwiera się pasek poziomy funkcji i on się nie mieści —
> są ikony, które wyglądają poza okno. Tutaj opisy trzeba skrócić albo wywalić."
> (`whiteboard-canvas`, 01.09)
>
> „powinny one startować **zwinięte**, a nie rozwinięte, bo tak przerażają swoją ilością"
> (`agent-plan-canvas`)

Ekrany: `whiteboard-canvas` · `agent-plan-canvas` · `agent-warsztat` ·
`canvas-kebab-restructure`.

**Miejsce w kodzie:** wszystkie cztery to powierzchnie kanwy —
`src/components/MyWork/IdeaMapWorkspace.tsx` jest wspólnym korzeniem dla
`whiteboard-canvas` i tabel pomysłów (potwierdzone w `dev-render/screens/whiteboard-canvas.tsx:31`).
Dla ekranów agenta — **do ustalenia**.

**Oszacowanie: jedna zasada (paski kanwy zwinięte domyślnie, ikony bez opisów),
przyłożona w 2-3 miejscach.**

---

### R12 · „Jedna tabela inicjatyw, nie kilka" — 3 ekrany

> „Nie wiem, czemu to jest inna tabela inicjatyw. Czy to pomyłka, czy celowo –
> **powinniśmy mieć jedną tabelę inicjatyw.**" (`initiative-record`)
>
> „na koniec każdej oceny to są po prostu drafty inicjatywy, a normalnie w tabeli
> inicjatyw" (`assessment-initiatives-table`)

Ekrany: `initiative-record` · `assessment-initiatives-table` · `plan-scenario-d1`.

**Miejsce w kodzie:** `src/components/assessment/InitiativesTable.tsx` (osobna
implementacja) kontra tabela inicjatyw w `src/components/Initiatives/`.
Dokładne wskazanie, która jest „tą jedyną" — **do ustalenia**, to decyzja architektoniczna.

**Oszacowanie: konsolidacja dwóch implementacji — średnio ryzykowna, dotyka dwóch modułów.**

---

### R13 · „Przycisk AI w górnym pasku karty" — 2 ekrany

> „mamy w górnym pasku przycisk »AI«, a później w pasku dalszego arkusza mamy
> »Analizuj z AI«. **To są dwie różne funkcjonalności.** Górny pasek AI dotyczy
> wypełnienia całego narzędzia, a dolny pasek dotyczy danej karty." (`karta-decision`)
>
> „nie ma przycisku AI w górnym pasku, który będzie odpowiadał za wypełnienie karty.
> Poza tym wygląda zajebiście." (`karta-initiative`)

Ekrany: `karta-decision` · `karta-initiative` (oba przeklikane na `ok` 01.09, ale
wymaganie zostaje).

**Miejsce w kodzie:** powłoka artefaktu — `src/components/standard/StandardArtifactShell.tsx`
+ `ArtifactRightPanel.tsx`. To jest **reguła kanonu**, nie poprawka jednego ekranu:
górny pasek = całe narzędzie, dolny/prawy = ta karta.

**Oszacowanie: jedna zmiana w powłoce artefaktu; kandydat do dopisania w `KANON_Z_ODBIOROW.md`.**

---

## Uwagi jednostkowe

Dotyczą jednego ekranu, nie tworzą rodziny.

| ekran | uwaga właściciela | charakter |
| --- | --- | --- |
| `decision-record` | „informacje przekazane nie są wysyłane do serwera, tylko zostają w pamięci przeglądarki. Mam nadzieję, że to jest jakiś błąd (…) aby ta karta była połączona z całym systemem" | **defekt funkcjonalny, nie graficzny** — do toru funkcji |
| `karta-task` | „połowa karty jest niewypełniona. Jak jest niewypełniona, to trudno jest to weryfikować" | dane demo do zrzutu, nie kod |
| `karta-tool` | „Mieliśmy usunąć dwa przykłady, bo mieliśmy trzy. Został jeden, ale w postaci jednej kolumny. To wygląda bez sensu" | układ jednego ekranu |
| `karta-insight` | „w oknie centralnym mamy trzy kolumny (…) zróbmy to w trzech dużych wierszach z trzema kolorami, aby było czytelne od góry do dołu" | układ; zamknięty na `ok` 01.09 |
| `calendar-sync-settings` | „Dodaj tutaj Outlooka i zmień to jabłuszko na jakieś normalne, a nie takie jabłko" | tanie, ikona + dostawca |
| `plan-scenario-d1` | „narzędzie otwiera tę wybraną linię jako tabelę poniżej tej tabeli. Ma ona otwierać konkretną kartę" | zachowanie tabeli |
| `capacity-advisor-a3` (2 uwagi) | „powinna być tabela, w której (…) przycisk »Twórz raport«. Raport generowany na bieżąco, na konkretną chwilę (…) **Nic tu nie zostało zmienione w ramach tej naprawy**" | przeprojektowanie modułu; przeklikany na `ok` 01.09 |
| `assessment-output-report` | struktura raportu: wstęp → 7 osi (oś + obszar) → odpowiedzi i wnioski → podsumowanie | wymaganie merytoryczne, tor funkcji |
| `exe-002-004-ui-audit` | „**Trzeci raz dajesz mi tę kartę do akceptacji**" | defekt procesu odbioru, nie ekranu |
| `tools-swot-session-workspace` | „Jest jakaś prehistoryczna karta jeszcze za tym, zanim przerobiliśmy to" | martwy ekran do usunięcia; `ok` 01.09 |
| `notatnik-osierocone-graf` | „Jak robimy takie nody notatek, to może zrób ją na całym ekranie jedną, bo kilka na jednym ekranie nie daje komfortu pracy" | **nowa uwaga 01.09, regresja z `ok`** |
| `canvas-toolbar-md-history` | „mam tylko uwagę do przycisku promote - tam były ikony, co z tą myślą można zrobić" | drobne, 01.09 |
| `vault-folder-block-proof` | „jestem ok z grafiką, ale cała funkcjonalność agenta powinna być dużo bardziej rozwinięta" | tor funkcji, 01.09 |
| `teresa-chipy-sugestii` | „możemy gdzieś kontekstowo to włączać, wyłączać (…) generalnie jestem przeciwnikiem, ale są tacy, którzy dzięki temu rozumieją" | przełącznik, `ok` 01.09 |
| `chat-split-teresa-right` | „akceptuję, ale (…) w czacie nie ma wszystkich przycisków. Pokazujemy koncepcyjnie" | akcept warunkowy |
| `standard-kanban-card` | „Super, wybierzmy ten standard jeden. To jest dobry pomysł." | **decyzja przyjęta** — do `KANON_Z_ODBIOROW.md` |

---

## Do decyzji właściciela

To nie są zlecenia dla robotników. Właściciel powiedział wprost, że **nie umie czegoś
ocenić** albo **pyta, co to jest**. Wysłanie tego do naprawy byłoby zgadywaniem.

| ekran | pytanie właściciela | co mu trzeba dać |
| --- | --- | --- |
| `interview-preview-canon` | „**Nie umiem ocenić, czy szerokość jest wystarczająca**, ale pamiętaj, że mamy opisane, jak ma to wyglądać. To jest komponent." | zrzut z linijką + wskazanie reguły z kanonu |
| `processflow-canvas` | „wielkim wyzwaniem jest ten panel boczny. **na tym obrazie jak go nie mogę ocenić**" | drugi zrzut z otwartym panelem |
| `siri-workspace` | „**Ja nie znam SIRI, więc trudno mi to ocenić**" | opis metodyki albo zdjęcie z oceny |
| `ideas-teresa-panel` | „**Byłoby dobrze, żebyś mi odpowiedział, co to ma być.** Może ja bez sensu to odrzucę." | odpowiedź, do czego ten panel służy |
| `prawy-panel-szyna-ikon` | „**Nie wiem, czy to jest naprawdę jakaś poprawa**" | porównanie przed/po |
| `preview-4-zakladki` | „Nie wiem, czy to przyda się w aplikacji – **chyba nie**" | decyzja: zostawić harness czy skasować |
| `prezentacje-template-states` | „Jeżeli to ma być tabela szablonów, to okej. **A jeżeli nie, to nie wiem, po co to jest**" | rozstrzygnięcie czym ten ekran jest |
| `mywork-idea-inspector-lekki` | „nie wiem, do czego służy" | opis `gdzie` już jest — pokazać go |
| `prompt-registry-tab` | „nie mam pojęcia, gdzie to jest i do czego ma służyć" | `gdzie` mówi: narzędzie inżynierskie, nie ekran klienta — **potwierdzić, czy w ogóle ma iść do odbioru** |
| `admin-command-center-panel` | „Znowu nie mam pojęcia, co to jest" | jw. |
| `standard-module-bar-children` | „Nie mam pojęcia, co to w ogóle jest" | `gdzie` mówi: to harness, nie produkt — **wypisać takie ekrany z kolejki odbioru** |
| `canvas-kebab-restructure` | „Nie wiem, czy to docelowo będzie ok (…) **Zobaczmy, co z tego będzie.** To bardzo ważna zmiana, bo dotyczy wszystkich idea" | prototyp przed budową (reguła #7) |

**Wniosek przekrojowy:** trzy ostatnie pozycje pokazują, że **do kolejki odbioru trafiają
ekrany, które nie są produktem** (harness komponentu, narzędzie SuperAdmina). Każdy taki
ekran kosztuje właściciela uwagę i kończy się zdaniem „nie mam pojęcia, co to jest".
Filtr na wejściu do kolejki jest tańszy niż tłumaczenie po fakcie.

---

## Rekomendowana kolejność prac

| # | rodzina | ekranów | ryzyko | dlaczego tu |
| --- | --- | --- | --- | --- |
| 1 | **R8 macierz DRD** | 3 | **niskie** | decyzja zapadła 30.08, kod wskazany, nic nie zrobiono, właściciel pisze „nie mam już siły". Jedna flaga + jedno wpięcie. Najlepszy stosunek efektu do ryzyka. |
| 2 | **R1 podgląd** | 6 | **WYSOKIE** ⚠ | zgłoszone drugi raz po deklarowanej naprawie. 21 wołaczy `PreviewPaneShell` → **osobny, ostrożny dyżur, flaga OFF, zrzuty przed akceptem** |
| 3 | **R3 tabele** | 9 | **NAJWYŻSZE** ⚠ | `FilterableTable` ma **85 wołaczy** i udokumentowaną historię odrostu naprawy per wywołanie. **Nie łączyć z żadną inną pracą.** 6 z 9 ekranów już zamkniętych — realny zakres to ucięta kolumna, nie szerokość |
| 4 | **R13 przycisk AI w powłoce** | 2 | średnie | reguła kanonu, nie ekran; im wcześniej, tym mniej kart do poprawiania później |
| 5 | **R11 paski kanwy** | 4 | niskie | jedna zasada, 2-3 miejsca, świeża uwaga z 01.09 |
| 6 | **R9 ROI = jedna karta** | 3 | średnie | zamknięte w module Wyników, kierunek przyjęty przez właściciela |
| 7 | **R6 stara grafika** | 7 | niskie | jeden dyżur zbiorczy, tanie, widoczny efekt |
| 8 | **R4 arkusz i deck** | 6 | średnie | najpierw ustalić zrzutem, czy edytowalna siatka jest osiągalna — potem pasek narzędzi |
| 9 | **R7 przyciski zamiast słów** | 5 | **WYSOKIE** ⚠ | właściciel sam ostrzegł: „dotyczy wszystkich idea". Prototyp → akcept → dopiero budowa |
| 10 | **R2 prawy panel** | 6 | **NAJWYŻSZE** ⚠ | 61 wołaczy `ArtifactRightPanel`. Właściciel sam poprosił o backlog i osobną analizę — **uszanować to, nie łatać** |
| 11 | **R12 jedna tabela inicjatyw** | 3 | średnie | konsolidacja dwóch implementacji, dwa moduły |
| 12 | **R10 generatory** | 5 | — | najpierw decyzja produktowa, potem cokolwiek |
| 13 | **R5 „nie wiem, gdzie to jest"** | 10 | zerowe | naprawione u źródła; zostaje weryfikacja klikiem opisów `gdzie` |

### Trzy prace, które NIE są naprawą ekranu, a zdejmą najwięcej bólu

1. **Filtr na wejściu kolejki odbioru** — harnessy komponentów i narzędzia SuperAdmina
   nie powinny trafiać do właściciela (3 uwagi „nie mam pojęcia, co to jest").
2. **Dowód po naprawie.** Ekrany z rodziny R3 naprawiono 30.08 o 14:15, właściciel
   zgłosił je między 10:01 a 11:44 i **nikt nie pokazał mu nowych zrzutów** — dopiero
   01.09 sam je przeklikał na `ok`. Dwa dni ekranu wisiały jako otwarte bez powodu.
3. **Odpowiedź na pytanie.** 12 uwag to pytania, nie zlecenia. Nieodpowiedziane wracają
   jako `nie` przy następnym przejściu.

### Ryzyko przekrojowe — jedno zdanie

Trzy rodziny (**R1 podgląd · R2 prawy panel · R3 tabele**) siedzą w komponentach
o łącznie **167 wołaczach w `src/`**. To 21 ekranów właściciela, ale też ryzyko wywrócenia
setek ekranów jednym commitem. **Każda z nich = osobny dyżur, flaga domyślnie OFF,
zrzut przed akceptem.** Zasada #9 z `CLAUDE.md` („zakaz masowego włączania") istnieje
dokładnie po to.
