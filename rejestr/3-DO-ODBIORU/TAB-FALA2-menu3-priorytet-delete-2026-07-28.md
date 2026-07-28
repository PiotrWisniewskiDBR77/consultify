# TAB-FALA2 — Fala tabel: Menu 3, priorytet, Delete, nagłówki, Sejf (2026-07-28)

**Stan:** do odbioru Piotra
**Gałąź:** `fix/tabele-fala2-2026-07-28` (worktree `/private/tmp/tabele-fala2`), baza `origin/demo` `b951f7cf81`
**Ekran odbioru:** `?screen=tabele-fala2-przed-po` na porcie **3450** (`/loop` niepotrzebny — serwer stoi)
**NIE wypchnięte na demo** — czeka na akcept.

---

## Co zostało naprawione (8 commitów)

| # | Znalezisko z przeglądu | Skala | Jak naprawione |
|---|---|---|---|
| 1 | **P-10 / P-20 / P-22 / P-27** — po prawej stronie Menu 3 stały przyciski nie-AI | 4 moduły, ~10 ekranów | Zostaje wyłącznie przycisk AI (kanon A3). `Generate Report` i `Initiative Pack` wołały DOKŁADNIE te same handlery co CTA Menu 2 — łamały też D-01 |
| 2 | **PILNE-10 / N-83** — `Delete` jako pierwszy przycisk stopki podglądu | 5 ekranów | Reguła wymuszona w `StandardPreview`, nie łatana per ekran. 16 plików podaje `resolutions` z wariantem `destructive` — żaden nie ma już jak jej złamać |
| 3 | **N-24 / N-29 / N-79** — priorytet jako wypełniona pigułka | 9 tabel | Nowy SSOT `standard/PriorityCell`; `PriorityChip` (karmi 6 tabel) przestał opakowywać treść w `ChipBase`. Zapis `MEDIUM`/`medium`/`Medium` znormalizowany |
| 4 | **Nagłówki po polsku wśród angielskich** (`TYP`, `TRYB`) | 3 zakładki Documents | Przyczyną były DWIE wartości w angielskim pliku i18n, nie kod ekranu |
| 5 | **PILNE-6** — Menu 3 Sejfu i Run agent pokazywało liczniki cudzych modułów | 2 ekrany | Oba spadały na wspólny fallback „alerty z innych zakładek". Pasek się nie renderuje, dopóki te tabele nie mają własnych filtrów |
| 6 | **P-17 / D-06** — czwarta warstwa nagłówkowa Sejfu | 1 ekran | `ClientDocumentsVault` renderował własny `StandardModuleBar` wewnątrz zakładki, która ma już Menu 1/2/3 → drugi breadcrumb i DRUGA wyszukiwarka. Fraza idzie teraz z lupy Menu 2 hosta |
| 7 | **N-7 / N-13 / N-54 / N-78 / N-94** — sześć formatów daty | globalne | Przyczyna: **270 wywołań `toLocaleDateString()` bez locale** — format brał się z przeglądarki, nie z konta. Nowy SSOT `utils/listDateFormat.ts`, jeden wzorzec `DD/MM/YYYY`. Źródłem `7/21/2026` z Sessions była generowana nazwa sesji |
| 8 | **P-28 / D-06** — czwarta warstwa w Sheets | 1 ekran | Przełącznik `Sheets \| Data sources` przeniesiony do Menu 2 (prawa strona), zgodnie z dosłowną prośbą Piotra. Tabela podnosi się o ~44px |

## Bramki

- `tsc --noEmit` z 8 GB po każdej zmianie: **3697 plików z `src/`, 0 błędów, zero FATAL**
  (sprawdzane `--listFiles`, żeby nie powtórzyć pomyłki z 07-27, gdy wysypany tsc udawał czysty
  wynik). Bramka zarobiła na siebie: złapała usunięte `t` w `SheetsTabContent`, którego esbuild
  nie widzi.
### Przejście Playwrightem (`tests/e2e/smoke/tabele-fala-odbior.spec.ts`, 6/6)

Sprawdza konkretne naprawy, nie „czy się wyrenderowało". **Dwie pułapki po drodze — obie
dawały fałszywą zieleń:**

1. Skopiowałem zamykanie okna powitalnego ze starego testu — szuka „Skip tour", a produkt
   ma **„Skip for now"**. Modal nie znikał, asercje czytały jego treść zamiast tabeli.
   **Sześć testów świeciło na zielono nad zasłoniętym ekranem.** Wyłapane oglądaniem zrzutów,
   nie wynikiem testu.
2. Stałe czekanie przepuszczało pomiar na spinnerze — 17 znaków tekstu udawało załadowany ekran.

Naprawione: onboarding wyłączany u źródła (localStorage), twarda asercja na brak modala,
`expect.poll` na realną treść.

**OGRANICZENIE:** tryb testowy nie niesie danych → tabele puste. Przejście potwierdza
**strukturę** (na zrzutach widać P-10 i P-20: po prawej Menu 3 stoi sam `AI Triage`),
ale **nie treść wierszy**. Od tego są strażniki i harness.

- 5 nowych plików-strażników, **26/26 zielone**: `standardPreviewActionOrder` (6),
  `priorityCellCanon` (5), `naglowkiKolumnJezyk` (5), `listDateFormat` (6),
  `sheetsSubviewWarstwa` (4)
- `check-list-canon`, `check-triada`, `check-artefakt`, `check-gestosc` — bez nowych naruszeń
- **Render-verify mój, przed Piotrem** (reguła #7): light + dark, zrzuty zrobione

## Do przeklikania / obejrzenia

1. Ekran PRZED/PO na `:3450` — trzy sekcje, w tym kontrola regresji Approve/Reject
2. `My Work → Inbox` — Menu 3 ma po prawej sam `AI Triage`, a `Done` zszedł na lewo jako filtr
3. `My Work → Sejf klienta` — jedna wyszukiwarka zamiast dwóch, bez chipów z cudzych modułów
4. `Tools → Assessment/Reports/Initiatives` — Menu 3 bez trzech nadmiarowych przycisków

---

## FALA 3 i 5 — dokończenie (18 commitów łącznie)

| # | Uwaga | Co się okazało po sprawdzeniu |
|---|---|---|
| 9 | **P-17 / P-18** — kebaby-atrapy | Sprawdziłem bazę, zanim naprawiłem: `my_ideas` i siostrzane tabele **nie mają nawet kolumny** na archiwizację, a `POST /archive` istnieje wyłącznie dla sesji wywiadu i report-buildera. „Coming soon (backend)" mówiło prawdę — to funkcja do zbudowania, nie do włączenia. Menu przestaje ją obiecywać: **39 pozycji w 20 plikach**. Blokady z POWODEM produktu zostają |
| 10 | **Interview → Assigned bez stopki** | Stopka **istniała**. Renderowała przyciski wyłącznie dla `assigned`/`in_progress`/`sent_back`; rekord na zrzucie miał `approved`, więc lista wychodziła pusta i znikał cały blok. `submitted` → para Zatwierdź/Odeślij (wzorzec Decisions), `approved` → baner stanu (wzorzec Interview→Initiatives) |
| 11 | **N-52** — treść preview = zrzut pól | Cztery podglądy robiły to samo obejście: właściwości nie miały gdzie mieszkać, więc szły w pole na prozę. `StandardPreview.details` dostał kontrakt `properties` → `ArtifactPropertiesTable` |
| 12 | **P-24** — „zmień ten czas w period" | `title` przechodził przez sanitizer, `periodLabel` **nie** — stąd surowy `Thu Dec 31 2026 00:00:00 GMT+0000`. Jeden brakujący przebieg psuł trzy miejsca (kolumna, karta Menu 3, tytuł podglądu) |
| 13 | **PILNE-12** — encje HTML | Dekoder istniał od dawna (radzi sobie z podwójnym kodowaniem), ale podpięty **tylko do idei**. Inicjatywy szły obok, choć wpadają w ten sam sanitizer |
| 14 | **P-4** — brak kebaba w Details Ideas | Blok dostawał sam `text`, bez ani jednej akcji — a kebab renderuje się dopiero, gdy jakaś jest. Ideas był jedynym podglądem bez niego |
| 15 | **P-6** — odstęp Menu 3 ↔ tabela | Racja co do odczucia, nie co do diagnozy: kanon opisywał tylko padding WEWNĄTRZ paska, odstępu pod nim **nie definiował nigdzie**. To była luka. `mb-2` |
| 16 | **P-15** — `Priority` innej wysokości | Ten sam gatunek co czwarte warstwy: filtr w **Menu 2** używał `Menu3DropdownChip`, komponentu **Menu 3** (`h-7` zamiast `h-9`) |

---

## FALA 3 — ciąg dalszy (23 commity łącznie)

| # | Pozycja planu | Co zrobione / co się okazało |
|---|---|---|
| 17 | **Kebab: przejścia stanu (blok 2 kanonu A6)** | **Ideas** dostały zmianę etapu prosto z listy — 5 etapów w kolejności cyklu życia, bieżący wyłączony. Kebab miał ~20 pozycji i ani jednej zmieniającej Stage; przestawić go dało się tylko wchodząc w ideę. Backend przyjmował `stage` od dawna — luka była w UI |
| 18 | **Blok „Co dalej"** | ★ `whatsNext` w `StandardPreview` miał **ZERO konsumentów** — kanon obiecywał blok, którego nie było nigdzie (jedyne wystąpienie, Insights, jest bespoke). Pierwszy konsument: podgląd oceny w Tools. Spina się z P-20: `Generate Report`/`Initiative Pack` w Menu 3 były duplikatem CTA, ale w podglądzie **jednej** oceny niosą sens — i naprawiają „brak akcji pozytywnej" (był tylko Delete + Duplicate) |
| 19 | **N-81 — akcje techniczne w stopce** | `Copy ID` / `Copy link` zeszły pod „…" w Interview→Initiatives i Initiatives→Portfolio (Sessions naprawione wcześniej). Nie znikają — przestają zajmować miejsce akcji głównej |

### Pozycje planu, które NIE są propagacją UI — wymagają decyzji

| Pozycja | Co pokazało sprawdzenie |
|---|---|
| **D-02 — Folder w każdej liście** (decyzja P-7) | Mechanizm jest wyłącznie idei: tabela `my_idea_folders`, kolumna `my_ideas.folder_id`, endpointy `/my-idea-folders`. **Grep migracji: `folder_id` nie istnieje w ŻADNEJ innej tabeli encji.** Folder dla Zadań/Decyzji/Wywiadów = migracja + generyczne endpointy + dopiero UI. Blok wielkości Fali 4, wymaga zgody na migrację |
| **Linia rekomendacji** (kanon A7.2) | W Decisions pochodzi z endpointu AI `/my-work/decisions/:id/brief`. Skopiowanie = endpoint per encja. Wariant deterministyczny (zdanie z terminu i priorytetu) to już **projektowanie**, a teza planu brzmi „nie projektujemy, propagujemy" — decyzja Piotra |
| **Interview→Assigned „brak bloku 2"** | ★ KOREKTA PRZEGLĄDU: kebab **ma** przejścia (start/continue/fix dla wykonawcy; approve/sendback/reassign/remind/escalate dla oceniającego), tylko warunkowe wobec roli i statusu. Obserwacja była nietrafna |
| **Interview→Templates przejścia stanu** | Statusy Draft/In review/Published filtrowane lokalnie; backend nie ma endpointu ich zmiany |

---

## ★ MOJA REGRESJA W TEJ FALI — złapana i naprawiona

Filtr atrap ukrył pozycje, które `StandardTable` **sam wcześniej dokładał** — test
`kebab contract` to wyłapał (zielony na `origin/demo`, czerwony u mnie).

Sedno było głębsze niż filtr: blok uniwersalny miał regułę „ZAWSZE obecny; brak handlera =
disabled z notą" — i **to ona produkowała atrapy**, na które narzekałeś. Filtrowanie leczyło
objaw. Naprawione u źródła: pozycja bez handlera i bez powodu w ogóle nie powstaje.

**Stan suity — pomiar tym samym poleceniem po obu stronach** (`vitest run tests/unit/ tests/components/`):

| | czerwone | zielone | pliki testowe |
|---|---|---|---|
| `origin/demo` | 434 | 17 821 | 2050 |
| ta gałąź | **434** | **17 845** | 2056 |

**Zero regresji** — liczba czerwonych identyczna. Fala dokłada **+24 zielone testy**
w 6 nowych plikach-strażnikach. Dług 434 czerwonych jest w całości zastany.

★ POPRAWKA MOJEGO WCZEŚNIEJSZEGO RAPORTU: napisałem najpierw „fala netto zmniejsza dług",
opierając się na pomiarze samego `tests/unit/` (179 vs 180). Pełny zakres pokazał najpierw
**+5 czerwonych plików** — czyli regresję, nie poprawę. Wniosek z wycinka o całości był błędny.
Przyczyna regresji: `listDateFormat` importował `@/i18n`, moduł INICJALIZUJĄCY (ciągnie
`initReactI18next`, detektor języka, backend HTTP), więc każdy komponent formatujący datę
wciągał to za sobą i wywalał zestawy mockujące `react-i18next` bez tego eksportu
(`MyIdeasListContent.folders`, 4× `apiGateway.stubRoutes`, `EarningsSection`).
Naprawa: import `i18next` zamiast `@/i18n` — ta sama instancja, ten sam `language`,
zero inicjalizacji przy okazji.



---

## ★★★ ZNALEZISKO DO DECYZJI: `MyWorkHub` ma własne menu, nie kanoniczne

Bramka `check-list-canon` (reguła R2b) wskazuje **1 hub z 12** renderujący listy
bez `StandardModuleBar` — i jest to **`MyWorkHub.tsx`, 4152 linie, 10 zakładek**
(Ideas · Notebook · Inbox · Calendar · Tasks · Decisions · Sejf · Run agent · Manager · Home).
Czyli moduł, w którym spędzasz najwięcej czasu, ma **bespoke pasek Menu 2** zamiast fasady.

**To wyjaśnia część uwag z przeglądu jednym powodem, nie ośmioma:**
- dublet CTA „New Idea" + „+ New" (P-1) — bespoke pasek nie miał kontraktu „jeden CTA"
- `Priority` niższy od sąsiednich przycisków (P-15) — brak wymuszonego `h-9`
- brak segmentu widoków w Notebook, inny w Ideas, inny w Tasks (N-5)
- czwarta warstwa Run agent — jego kontrolki nie mają gdzie wsiąść w legacy pasku

**Dlaczego NIE zrobiłem tego dzisiaj:** to migracja pliku na 4152 linie, a dokładnie
taka migracja 15 hubów z 07-26 dała **trzy regresje propów** (React po cichu ignoruje
nieznane propy — zniknął przełącznik widoków w 11 hubach i karty Menu 3 w 13).
Koszt tamtej pomyłki: dzień. To praca na osobną, etapową falę z render-verify
per zakładka — nie doklejka do fali kosmetycznej.

**Rekomendacja:** następny duży krok po Twoim akcepcie tej fali.

---

## Dług zastany, NIE moja regresja (zweryfikowane)

Testy `tests/components/ReportsAndPresentations/` — **24 czerwone / 59 zielonych**.
Sprawdzone w osobnym worktree na czystym `origin/demo`: **identyczny wynik**
(24/59). Czyli moduł Documents ma ten dług na demo od wcześniej. Do zbadania osobno.

---

## Świadomie NIE zrobione (i dlaczego)

- **Finance `Analyze ⌄`** — zawiera unikalne funkcje (Modelowanie, Budżetowanie, Finance Lane).
  Jego miejsce rozstrzyga **D-05** (narzędzia do karty pozycji), nie mechaniczne cięcie.
- **Run agent — czwarta warstwa** — jego pasek niesie realną treść (przełącznik `Moje procesy |
  Szablony` + CTA + tryb masowy). Przeniesienie go do **legacy** paska `MyWorkHub` znaczyłoby
  napisać segment drugi raz, w kodzie, który i tak ma zniknąć. Wchodzi w migrację `MyWorkHub`
  na `StandardModuleBar` (znalezisko wyżej) — tam kontrolki wsiądą w `filterControls` fasady
  bez reimplementacji.
- **`Show drafts` w Menu 2 Documents** (P-27) — na zrzucie wygląda jak duplikat chipa `Draft`
  z Menu 3, ale steruje **pobieraniem danych z serwera** (`fetchReports(showDrafts)` + trzy
  siostrzane wywołania), a chipy filtrują lokalnie. To nie duplikat — zostaje.
- **Finance `Analyze ⌄`** — j.w., rozstrzyga D-05.
- **641 nagłówków `<th>` bez `uppercase`** — to tabele wewnątrz artefaktów (SPEC-A), nie listy (C6).
- **248 pozostałych `toLocaleDateString()`** poza ekranami listowymi — przepięte 22 tam, gdzie
  przegląd wskazał rozjazd. Reszta (artefakty, raporty, panele admina) osobno, żeby nie mieszać
  fal.

## Cofnięcie

Nic nie poszło na demo. Gałąź `fix/tabele-fala2-2026-07-28`; demo stoi na `b951f7cf81`.
