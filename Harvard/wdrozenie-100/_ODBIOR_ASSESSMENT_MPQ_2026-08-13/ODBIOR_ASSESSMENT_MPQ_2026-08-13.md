# Odbiór ręczny + MPQ — moduł Assessment (8 powierzchni × Light/Dark)

Data: 2026-08-13 · Robotnik: Sonnet (worktree `if`) · Gałąź: `codex/asm-if` · Bazowy HEAD: `74bc2cd7828a17ef0497bb596ba640dce18fc1fc`
Środowisko: dev-render harness, `postgresql://$USER@127.0.0.1:5439/consultify_asm_if` (baza NIE była potrzebna do tego odbioru — wszystkie 8 ekranów renderują się z mock-danych harnessu, zero zapytań SQL wykonanych w tej rundzie).

## TL;DR — werdykt

| # | Ekran | Light | Dark | Bramki twarde trafione | Przechodzi (≥27, hero ≥29)? |
|---|---|---|---|---|---|
| 1 | assessment-list (kanon TRIADA, mock) | 28/30 | 28/30 | G2 (fokus bursztynowy) | **NIE** — blokuje G2 mimo dobrego wyniku |
| 2 | assessment-five-surfaces (realny AssessmentHub, tab Library) | 13/30 | 13/30 | G2 (odziedziczone, nie testowane osobno na tym ekranie) | **NIE** |
| 3 | assessment-quality-review-panel (Outputs review, variant=mixed) | 23/30 | 23/30 | G5 („brak" po czerwonym) | **NIE** |
| 4 | assessment-artifacts-restart (Outputs/Reports/Initiatives, kernel P0D) | 22/30 | 22/30 | G2 (odziedziczone) | **NIE** |
| 5 | assessment-initiatives-panel (Manage → Initiatives) | 16/30 | 16/30 | **G1 (crimson realny, kod)**, G3 (własna tabela/chrome) | **NIE** |
| 6 | assessment-reports-panel (Manage → Reports) | 19/30 | 19/30 | **G1 (crimson realny, kod)**, G3 | **NIE** |
| 7 | assessment-initiatives-table (Board → Initiatives, global) | 15/30 | 15/30 | G3, G5 (pasek postępu zawsze czerwony) | **NIE** |
| 8 | assessment-reports-table (Board → Reports, global) | 16/30 | 16/30 | G3 | **NIE** |

**Zero z ośmiu powierzchni przechodzi próg 27/30 bez zastrzeżeń — wszystkie osiem ma co najmniej jedną bramkę twardą (G1/G2/G3/G5) niezależnie od punktacji MPQ.** Napisane wprost: nawet najlepszy wynik (ekran #1, 28/30) NIE przechodzi, bo fokus klawiaturowy nie jest niebieski — a to bramka blokująca, nie punkt MPQ do zaokrąglenia.

---

## KROK 1 — czym jest MPQ w tym repo (ustalone, nie zmyślone)

`grep -rln "MPQ" docs Harvard` (2026-08-13, ten worktree) daje 4 trafienia:
- `docs/functional/assessment/A10_MPQ_2026-08-13.md` — JEDYNE miejsce z faktyczną rubryką. Napisane przez innego robotnika (T5, gałąź `codex/asm-t5`, ten sam dzień) dla **innego zestawu 3 widoków** („DRD Work View", „Report" = Frozen Output, „Presentation" = zinterpretowane jako lista Outputs) — nie dla ośmiu powierzchni Assessment z tego zadania. Rubryka tamtego dokumentu: 7 kryteriów × skala 0–5, zsumowane i **błędnie podpisane jako „/30"** mimo że 7×5=35, nie 30 (matematyczny błąd w precedensie — nie kopiuję go).
- `docs/program/METHOD_ASSESSMENT_CORE_2026-08-13/{CHECKPOINT_DRD_VERTICAL_SLICE,EVIDENCE_LEDGER,ASSESSMENT_CORE_CANDIDATE}.md` — wszystkie trzy tylko **wspominają** „MPQ nieocenione" / „MPQ NIE WYKONANY", zero rubryki.

**Wniosek: w repo NIE ISTNIEJE kanoniczna, wielokrotnego użytku rubryka MPQ 30-punktowa.** Zgodnie z poleceniem buduję WŁASNĄ, jawnie oznaczoną jako moja, opartą na `docs/ui-standards/TRIADA_KANON.md` (część A + C1/A10) i na `CLAUDE.md` UI-regułach #1/#3/#9.

### Rozdzielenie: MPQ (30 pkt, jakość) vs BRAMKI (blokujące, nie-punktowe)

Zadanie samo to rozróżnia w sekcji „TWARDE NARUSZENIA... to nie są punkty MPQ — to bramki blokujące". Trzymam się tego dosłownie: crimson-jako-UI, fokus-nie-niebieski i własna-tabela-zamiast-StandardTable to **bramki pass/fail**, niezależne od wyniku liczbowego. Ekran z 28/30 i złamaną bramką NIE przechodzi — wynik liczbowy nie „kupuje" zwolnienia z bramki.

**Bramki (gate), sprawdzane per ekran:**
- **G1** — crimson (`primary-*`/`#85182F`) użyty jako kolor UI/CTA/checkbox/fokus (nie marka) — CLAUDE.md „Pułapka nr 1", TRIADA A10.
- **G2** — fokus klawiaturowy inny niż niebieski `c-focus` (w tym domyślny bursztynowy outline przeglądarki) — TRIADA pkt 39/43.
- **G3** — ekran listowy skleja WŁASNĄ tabelę/nagłówek/filtry zamiast `StandardModuleBar`/`StandardTable` — CLAUDE.md reguła #9, hook `check-list-canon.sh`.
- **G4** — ekran nie działa / crashuje w Dark.
- **G5** — czerwień/`danger` użyta dla stanu, który NIE jest krytyczny/blokujący (np. „brak jeszcze" albo neutralny pasek postępu) — TRIADA A10 „Czerwień = wyłącznie semantyka krytyczna", A10_MPQ_2026-08-13.md kryterium „Brak dowodu nie jest czerwony" (przyjęte tu jako precedens metodyczny, nie jako źródło rubryki punktowej).

**MPQ (30 pkt = 6 kryteriów × 0–5, MOJA rubryka, jawnie nowa):**
1. **M1 — Jedna dominująca geometria/hierarchia** (nie zlepek kafelków, jasny punkt uwagi) — TRIADA „nie wygląda jak dashboard administracyjny".
2. **M2 — Uczciwość i kompletność stanu** (dane realne, zero martwych placeholderów/crashy na starcie ekranu).
3. **M3 — Spójność językowa i ton konsultingowy** (jeden język w obrębie ekranu, zero surowych ID/JSON widocznych użytkownikowi).
4. **M4 — Czytelność danych** (liczby/statusy/daty czytelne od razu, sensowne obcinanie tekstu, zero ucinania w środku słowa).
5. **M5 — Kompletność interakcji** (kebab/przyciski/linki prowadzą gdzieś sensownego, nie martwe atrapy bez wyjaśnienia).
6. **M6 — Ogólne wrażenie „gotowe przed klienta"** (spacing/polish, zero tonu deweloperskiego).

Progi z zadania: **≥27/30** dla ekranów pokazywanych klientowi, **≥29/30** dla ekranu-bohatera (żaden z ośmiu nie jest tu wyznaczony jako hero — próg 27 stosuję do wszystkich).

---

## KROK 2 — harness, ekrany, komendy

### Odkryty defekt blokujący CAŁY harness (naprawiony, poza write-setem ale konieczny)

`dev-render/main.tsx:433` — wpis `'rn-g3-class-l-record-shell'` nie miał zamykającego `},` przed kolejnym wpisem `'idea-financial-case-persistence'`. Ten sam gatunek błędu, co D4 w `A10_MPQ_2026-08-13.md` (martwy import), ale inny konkretny defekt — **potwierdzone niezależnie, na innej gałęzi, że klasa błędu „jeden zepsuty wpis w SCREENS blokuje WSZYSTKIE ekrany" nawraca**. esbuild:
```
✘ [ERROR] Expected "}" but found ";"
    dev-render/main.tsx:1052:1
```
Zlokalizowane licznikiem głębi nawiasów (skrypt Node, patrz niżej) — depth wracał do 1 zamiast 2 dopiero po linii 434, czyli entry `rn-g3-class-l-record-shell` (linie 430–433) nie miał `}`. Naprawa: jedna linia, `dev-render/main.tsx`, dodano brakujące `},`. To plik harnessu (nie `src/`/`server/src/`), więc w zakresie — bez tej naprawy ANI JEDEN z 8 ekranów Assessment nie renderowałby się, więc nie jest to praca poboczna, tylko warunek konieczny wykonania zadania.

Weryfikacja (odtwarzalna):
```bash
cd /Users/piotrwisniewski/consultify-wt/if
node -e "/* licznik głębi nawiasów z pominięciem stringów/komentarzy, patrz commit diff */"
npx vite --config dev-render/vite.config.ts --port 5305 --strictPort
```

### Serwer i przeglądarka

```bash
cd /Users/piotrwisniewski/consultify-wt/if
npx vite --config dev-render/vite.config.ts --port 5305 --strictPort
```
Uwaga do następcy: MCP Browser (`preview_start` po `name`) w tym środowisku czyta `.claude/launch.json` z **innego katalogu roboczego** niż worktree (`cwd` sesji Browser = `/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify`, główne repo, NIE worktree `if`) — `preview_start({name:...})` z configiem dopisanym do `.claude/launch.json` worktree'a nie znajduje serwera. Obejście zastosowane tutaj: serwer uruchomiony przez `Bash` (`nohup ... & disown`), przeglądarka podpięta przez `preview_start({url:"http://localhost:5305"})` (wariant „already-running server", bez configu). Zrzuty do plików — `dev-render/shot.mjs` (Playwright, ten sam wzorzec co `A10_MPQ_2026-08-13.md` §1), bo MCP `computer{action:"screenshot"}` nie zapisuje pliku na dysk.

### 8 wybranych powierzchni (z 9 zarejestrowanych pod `assessment-*` w `dev-render/main.tsx`)

```
grep -n "'assessment" dev-render/main.tsx
```
zwraca 9 wpisów. Wybrałem 8, pomijając `assessment-menu3-status-chips` — to ten sam realny `AssessmentHub` co #2 (`assessment-five-surfaces`), tylko z jedną dodatkową flagą (`assessmentMenu3StatusChips`) wymuszoną na zakładce `list`, czyli wariant flagowy tej samej powierzchni, nie odrębny ekran. Odnotowane jako lukę do ewentualnego dociągnięcia, nie ukryte.

| # | Nazwa (`?screen=`) | Realny komponent | URL (pełny, z `&theme=`) |
|---|---|---|---|
| 1 | `assessment-list` | mock host `StandardModuleBar`+`StandardTable` (NIE realny `AssessmentHub` — patrz nagłówek pliku źródłowego) | `...?screen=assessment-list&theme=light\|dark` |
| 2 | `assessment-five-surfaces` | realny `AssessmentHub` (tab domyślny: Library) | `...?screen=assessment-five-surfaces&theme=light\|dark` |
| 3 | `assessment-quality-review-panel` | realny `AssessmentQualityReviewPanel` | `...?screen=assessment-quality-review-panel&variant=mixed&theme=light\|dark` |
| 4 | `assessment-artifacts-restart` | realny `AssessmentHub` → `AssessmentOutputsTab` (P0D, kernel HTTP) | `...?screen=assessment-artifacts-restart&select=1&theme=light\|dark` |
| 5 | `assessment-initiatives-panel` | realny `InitiativesManagementPanel` (Assessment → Manage → Initiatives) | `...?screen=assessment-initiatives-panel&theme=light\|dark` |
| 6 | `assessment-reports-panel` | realny `ReportsManagementPanel` (Assessment → Manage → Reports) | `...?screen=assessment-reports-panel&theme=light\|dark` |
| 7 | `assessment-initiatives-table` | realny `InitiativesTable` (Assessment → Board → Initiatives, globalny) | `...?screen=assessment-initiatives-table&theme=light\|dark` |
| 8 | `assessment-reports-table` | realny `ReportsTable` (Assessment → Board → Reports, globalny) | `...?screen=assessment-reports-table&theme=light\|dark` |

16 zrzutów: `Harvard/wdrozenie-100/_ODBIOR_ASSESSMENT_MPQ_2026-08-13/zrzuty/<nazwa>-{light,dark}.png` (1600×1000, `deviceScaleFactor:2`).

---

## KROK 3 — punktacja MPQ + uzasadnienie per ekran

Light i Dark ocenione osobno wizualnie (16 zrzutów obejrzane); w praktyce dark konwertuje tokeny poprawnie na wszystkich 8 ekranach — te same defekty merytoryczne w obu motywach, zero dodatkowego złamania w Dark (G4 nie trafione nigdzie). Fokus (G2) i crimson w kodzie (G1) sprawdzone live tylko w Light (patrz KROK 4) — w Dark przyjęte przez analogię (te same klasy CSS/tokeny, nie retestowane osobno kliknięciem Tab) — oznaczone niżej jako „odziedziczone, nie zweryfikowane osobno".

### 1. assessment-list — 28/30 (Light i Dark) — mimo to NIE PRZECHODZI (G2)
M1 5 / M2 5 / M3 5 / M4 4 (kolumna „Aktualizowana" ucięta na krawędzi viewportu, data nieczytelna do końca) / M5 4 (checkbox+kebab obecne, nie klikane end-to-end w tej rundzie) / M6 5.
**Bramka G2 potwierdzona NA ŻYWO** (nie z domysłu): `Tab` na przycisk sortowania nagłówka → `getComputedStyle().outline = "rgb(229, 151, 0) auto 1px"` (bursztyn, domyślny outline przeglądarki), nie niebieski `c-focus`. To dokładnie ten sam defekt, który `A10_MPQ_2026-08-13.md` (D5, inna gałąź `codex/asm-t5`) opisał dla `StandardTable` — **reprodukowany tu niezależnie, na innej gałęzi (`codex/asm-if`), tego samego dnia**, więc to nie fantom jednej gałęzi, tylko defekt współdzielonego komponentu `src/components/standard/StandardTable.tsx`.

### 2. assessment-five-surfaces — 13/30 (Light i Dark)
M1 2 / M2 1 / M3 3 / M4 3 / M5 3 / M6 1.
Ekran ląduje domyślnie na zakładce „Library", która pokazuje **pełnoekranowy błąd** na samej górze: czerwony trójkąt ostrzegawczy, nagłówek „DRD definition catalog", treść „Unexpected token '<', "<!doctype "... is not valid JSON", przycisk „Spróbuj ponownie" — DOPIERO pod tym renderuje się tabela frameworków (Digital Readiness Diagnosis/SIRI/ADMA/CMMI/Lean 4.0), która sama w sobie wygląda w porządku. **Niedowiedzione, czy to defekt produktu czy luka mocka harnessu** (ten konkretny fetch nie jest jawnie stubowany w `dev-render/screens/assessment-five-surfaces.tsx`, komentarz w pliku mockuje tylko `/artifacts?limit=200`) — flaguję to jako **NIEROZSTRZYGNIĘTE**, wymaga sprawdzenia czy realny endpoint `GET` katalogu definicji DRD istnieje na serwerze; nie stwierdzam „to bug produkcyjny" bez tej weryfikacji. Niezależnie od przyczyny: to jest to, co ekran POKAZUJE jako pierwsza rzecz po wejściu, więc oceniam AS-IS.

### 3. assessment-quality-review-panel — 23/30 (Light i Dark)
M1 4 / M2 4 / M3 5 / M4 4 / M5 3 / M6 3.
**Bramka G5 potwierdzona na żywo**: dwa wiersze „brak" (Modele Biznesowe, Kultura — brak dowodu) renderują się `text-danger-600` = `rgb(193, 4, 47)`, czerwienią. Brak dowodu nie jest stanem krytycznym/błędem — to neutralny stan „jeszcze nie dodano" — dokładnie ten anty-wzorzec, który projekt już raz sam sobie udokumentował (`A10_MPQ_2026-08-13.md`, inne miejsce w kodzie, ten sam gatunek błędu). Ekran to fragment/widget bez własnego Menu 1/2/3 (świadomie, do osadzenia gdzie indziej) — nie karane jako G3, bo nie udaje samodzielnego ekranu listowego.

### 4. assessment-artifacts-restart — 22/30 (Light i Dark)
M1 4 / M2 5 / M3 3 / M4 4 / M5 2 / M6 4.
Powtarza się wzorzec z `A10_MPQ_2026-08-13.md` (ten sam ekran, inna gałąź, ten sam dzień — **potwierdzenie reprodukowalności**, nie nowe odkrycie): segmenty „Outputs/Reports/Initiatives" i nagłówki kolumn „SCOPE/MODULE/VERSION/FROZEN AT" po angielsku wśród polskiej treści preview; panel akcji ma TYLKO „View lineage" (jeden przycisk pełnej szerokości), nie standardową siatkę 2-kolumnową; brak checkboxów/bulk (uzasadnione dla immutable snapshotów, nie karane w M5 jako coś więcej niż już ujęto).

### 5. assessment-initiatives-panel — 16/30 (Light i Dark)
M1 2 / M2 3 / M3 2 / M4 4 / M5 3 / M6 2.
**Bramka G1 potwierdzona W KODZIE** (nie z domysłu z koloru na zrzucie) — `src/components/assessment/manage/InitiativesManagementPanel.tsx`:
- linia 393, 1113: checkbox `className="... text-primary-600 focus:ring-primary-500"` — `primary-600` = **`#85182F`** dosłownie (zweryfikowane w `tailwind.config.js:216`, `primary.600: '#85182F'`).
- linia 723: pole szukania `className="... focus:ring-primary-500/20 focus:border-primary-500 ..."` — fokus na search boxie jest CRIMSON, nie niebieski `c-focus`.
- linia 1229: `<Zap className="text-primary-500" />` w pigułce „Generation Batches" — crimson jako kolor dekoracyjny ikony.
**Bramka G3 potwierdzona wizualnie**: własny nagłówek (ikona+tytuł+licznik), własny dropdown „Status: All statuses", własne przyciski „New”/„Quick”, filled-pill priorytety („Critical” czerwona pigułka, „High” pomarańczowa pigułka — TRIADA A4 wymaga kropka+tekst, nie pigułkę), własny panel „GENERATION BATCHES”, własna legenda na dole — żadna z tych rzeczy nie pochodzi z `StandardModuleBar`.
Dodatkowo: konsola przy renderze zgłasza `Encountered two children with the same key... EXECUTING` (React duplicate-key warning) — realny defekt kodu (prawdopodobnie klucz listy oparty o wartość statusu zamiast id), niezwiązany z wizualną oceną, ale obniża M2 (uczciwość stanu — React może po cichu zdublować/pominąć wiersze).

### 6. assessment-reports-panel — 19/30 (Light i Dark)
M1 3 / M2 4 / M3 2 / M4 4 / M5 3 / M6 3.
**Bramka G1 potwierdzona w kodzie** — `src/components/assessment/manage/ReportsManagementPanel.tsx:723`: `focus:ring-primary-500/20 focus:border-primary-500` na polu „Search reports…” — crimson fokus, drugi niezależny przypadek tego samego wzorca co #5.
**Bramka G3**: własny nagłówek+meta, własny rząd „5 Total/2 In Progress/1 In Review/1 Approved” (filled chipy, nie Menu3 TRIADA), status jako badge z ikoną (nie kropka+tekst).

### 7. assessment-initiatives-table — 15/30 (Light i Dark)
M1 3 / M2 3 / M3 2 / M4 2 / M5 3 / M6 2.
**Bramka G3**: nagłówek H1 „Strategic Initiatives Board” + podtytuł, własne taby „All(4)/Draft(2)/Pending Review(0)”, dwa własne dropdowny „All Projects”/„All Locations”, CTA „Generate from Report” — kompletnie własna chrome.
**Bramka G5 potwierdzona na żywo**: pasek „Completeness” — `getComputedStyle` na wypełnieniu paska = `background-color: rgb(232, 5, 56)` (klasa `bg-danger-500`) dla WSZYSTKICH wierszy niezależnie od wartości (36%, 27%, 36% — żadna nie jest stanem krytycznym), czyli czerwień użyta jako domyślny kolor paska postępu, nie sygnał błędu.
Dodatkowo (M4): priorytet „CRITI…” ucięty w środku słowa wewnątrz sztywnej pigułki — literalne obcięcie tekstu, nie elipsa na granicy słowa. Konsola: `Failed to fetch transitions` (SyntaxError, `<!doctype`) powtórzone 8×/render — **niedowiedzione czy to luka mocka harnessu czy realny endpoint** (ten harness nie stubuje wywołania `StatusTransitionDropdown` per wiersz), flagowane jako NIEROZSTRZYGNIĘTE, nie liczone jako twardy defekt produktu.

### 8. assessment-reports-table — 16/30 (Light i Dark)
M1 3 / M2 4 / M3 1 / M4 3 / M5 3 / M6 2.
**Bramka G3**: własny H1 „Raporty”+podtytuł, własne przyciski „Importuj”/„Nowy Raport”, własny rząd tabów podkreślanych „Wszystkie(5)/W przeglądzie(1)/Zatwierdzone(1)/Wysłane(2)”.
**Najgorsza spójność językowa z ośmiu**: chrome i nagłówki kolumn po polsku („Raporty”, „RAPORT/AUTOR/KONTEKST/STATUS/ZAKTUALIZOWANY”, taby polskie), ale WARTOŚCI statusu w tej samej kolumnie po angielsku („In Review”, „Approved”, „Sent Internal”, „Sent External”, „Utilized”) — dwujęzyczność w OBRĘBIE JEDNEJ KOLUMNY, gorsza niż samo „cały ekran po angielsku” (#5/#7), bo czytelnik przełącza język w połowie zdania.

---

## Bramki twarde — zbiorczo

| Bramka | Gdzie trafiona | Dowód |
|---|---|---|
| **G1 crimson-jako-UI** | #5 `InitiativesManagementPanel.tsx:393,723,1113,1167,1229`; #6 `ReportsManagementPanel.tsx:723` | grep kodu + `tailwind.config.js:204-219` (`primary.500/600` = `#A82D49`/`#85182F`) |
| **G2 fokus nie-niebieski** | #1 potwierdzone live (Tab→`outline:rgb(229,151,0)`); #2/#4 odziedziczone z tego samego `StandardTable`, nie retestowane osobno | `mcp__Claude_Browser__javascript_tool`, `getComputedStyle` po realnym `Tab` |
| **G3 własna tabela/chrome** | #5, #6, #7, #8 (wszystkie 4 ekrany Manage+Board) | zrzuty — brak `StandardModuleBar`/Menu1-2-3 w DOM, własne H1/taby/dropdowny |
| **G4 crash w Dark** | nigdzie nie trafiona | 8×2 zrzuty porównane, brak dodatkowego złamania w Dark |
| **G5 czerwień dla stanu niekrytycznego** | #3 („brak” = `text-danger-600`); #7 (pasek postępu zawsze `bg-danger-500`) | `getComputedStyle` live |

**Odrębna obserwacja poza bramkami**: reprodukowalność. Ekran #4 (`assessment-artifacts-restart`) i defekty D5/D6/D7 z `A10_MPQ_2026-08-13.md` (inna gałąź, `codex/asm-t5`, ten sam dzień) potwierdzają się TU, na `codex/asm-if`, niezależnie — to nie fantom jednej gałęzi/jednego workera, tylko realny stan komponentów współdzielonych.

---

## KROK 4 — Evidence Ledger

| # | Twierdzenie | Dowód (komenda/zrzut) | Data/SHA |
|---|---|---|---|
| 1 | Harness `dev-render/main.tsx` był całkowicie martwy (esbuild fail) przed naprawą | `npx vite --config dev-render/vite.config.ts --port 5305` → log `Expected "}" but found ";" dev-render/main.tsx:1052:1` (zapisany przed naprawą w sesji) | 2026-08-13, HEAD przed naprawą `74bc2cd782` |
| 2 | Naprawa jest jednolinijkowa i lokalna do harnessu | `git diff dev-render/main.tsx` (dodane `},` po linii 433) | 2026-08-13 |
| 3 | 8 powierzchni renderuje się bez crasha po naprawie | 16 zrzutów w `zrzuty/*.png`, zero białego ekranu | 2026-08-13 |
| 4 | Fokus na `StandardTable` = bursztyn, nie `c-focus` | `getComputedStyle(document.activeElement).outline === "rgb(229, 151, 0) auto 1px"` po realnym `Tab` na `?screen=assessment-list&theme=light` | 2026-08-13, `codex/asm-if`@`74bc2cd782` |
| 5 | `primary-600` = `#85182F` dosłownie | `tailwind.config.js:216` `600: '#85182F'` | plik w repo, ten SHA |
| 6 | `InitiativesManagementPanel`/`ReportsManagementPanel` używają `primary-*` na checkboxach/fokusie inputów | `grep -noE "(bg\|text\|border\|ring)-primary(-[0-9]+)?" src/components/assessment/manage/*.tsx` → 6 trafień z numerami linii | plik w repo, ten SHA |
| 7 | „brak” w Quality Review Panel jest czerwone | `getComputedStyle` elementu z tekstem „brak” → `color: rgb(193, 4, 47)`, klasa `text-danger-600` | 2026-08-13, `?screen=assessment-quality-review-panel&variant=mixed&theme=light` |
| 8 | Pasek „Completeness” zawsze czerwony niezależnie od wartości | `getComputedStyle` wypełnienia paska (36%/27%/36%) → `rgb(232, 5, 56)` / `bg-danger-500` na wszystkich trzech | 2026-08-13, `?screen=assessment-initiatives-table&theme=light` |
| 9 | `assessment-five-surfaces` domyślnie pokazuje błąd JSON zamiast treści | zrzut `assessment-five-surfaces-{light,dark}.png` | 2026-08-13 |
| 10 | Duplicate-key warning na `assessment-initiatives-panel` | stdout `dev-render/shot.mjs` → `KONSOLA-BLEDY: ...same key... EXECUTING` ×2 | 2026-08-13 |
| 11 | `StandardTable`/`StandardModuleBar`/`StandardPreview`/`InitiativesTable.tsx`/`ReportsTable.tsx` NIE zawierają `primary-*` | `grep` — zero trafień w tych plikach | plik w repo, ten SHA |
| 12 | **NIEUDOWODNIONE**: czy błąd „DRD definition catalog” (#2) i „Failed to fetch transitions” (#7) to defekty produktu czy luki mocka tego konkretnego harnessu | brak — wymaga sprawdzenia realnego endpointu server-side, poza zakresem tej rundy (write-set nie obejmuje `server/src/`) | — |
| 13 | **NIEUDOWODNIONE**: czy G2 (fokus) występuje identycznie na ekranach #2/#4 (nie tylko odziedziczone z tego samego komponentu) | nie klikano `Tab` osobno na tych dwóch ekranach w tej rundzie | — |
| 14 | **NIEUDOWODNIONE**: pełny cykl Tab/Shift+Tab przez wszystkie 8 ekranów (pkt 41 TRIADA) | nie wykonano — budżet czasu tej rundy poszedł w szerokość (8 ekranów × 2 motywy) nie głębokość jednego | — |

---

## Werdykt końcowy

**Żadna z ośmiu powierzchni Assessment nie nadaje się jeszcze przed oczy Piotra bez poprawek** — wszystkie osiem mają co najmniej jedną bramkę blokującą (G1/G2/G3/G5), niezależnie od wyniku MPQ:

- **Najbliżej gotowości**: #1 `assessment-list` (28/30) — ale to ekran-mock (nie prawdziwy `AssessmentHub`), więc pokazanie GO nie pokazuje prawdziwego produktu; i tak blokuje G2.
- **Wymaga realnej naprawy kodu, nie tylko treści**: #5 i #6 (`InitiativesManagementPanel`/`ReportsManagementPanel`) — crimson wpisany wprost w JSX (nie coś, co się „samo naprawi” zmianą danych), plus fundamentalnie zła architektura (własna tabela zamiast `StandardTable`/`StandardModuleBar` — to nie „polish”, to przepisanie ekranu).
- **Najgorszy stan wizualny/merytoryczny**: #2 `assessment-five-surfaces` (13/30) — pierwsza rzecz widoczna po wejściu to nieobsłużony błąd JSON z czerwonym trójkątem. Jeśli to defekt harnessu (nie produktu) — wymaga to jednak potwierdzenia, zanim ktokolwiek uzna ten ekran za „gotowy pod warunkiem że dane są”.
- **Wspólny mianownik dla #5/#6/#7/#8**: wszystkie cztery ekrany „Manage”/„Board” Assessment to WCIĄŻ bespoke UI, nie TRIADA — dokładnie backlog `§27-todo` wspomniany w komentarzach tych plików źródłowych („migrated onto StandardTable facade”, co jest prawdą tylko częściowo — same wiersze owszem, ale cała reszta chrome nie).
- **Spójność językowa** to problem przekrojowy na 5 z 8 ekranów (#2, #4, #5, #6, #7, #8) — różne rejestry: całe UI po angielsku (#5, #7), wartości statusu po angielsku w polskim UI (#6, #8), albo mieszanka etykiet kolumn (#4).

Wynik NIE jest zawyżony ani zaniżony na wyrost: dwie bramki (G1, G5) są potwierdzone bezpośrednio w kodzie/computed-style, nie z domysłu na podstawie koloru piksela na zrzucie.

## Pliki

- Ten raport: `Harvard/wdrozenie-100/_ODBIOR_ASSESSMENT_MPQ_2026-08-13/ODBIOR_ASSESSMENT_MPQ_2026-08-13.md`
- 16 zrzutów: `Harvard/wdrozenie-100/_ODBIOR_ASSESSMENT_MPQ_2026-08-13/zrzuty/*.png`
- Naprawa harnessu: `dev-render/main.tsx` (jedna linia, `},` brakujące po `rn-g3-class-l-record-shell`)
- Nowy config podglądu: `.claude/launch.json` (`assessment-mpq-odbior`, port 5305) — plik współdzielony między sesjami, dopisany, nie nadpisany
