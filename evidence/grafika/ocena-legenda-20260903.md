# ASM-OWN-013 — usunięcie globalnej legendy stanów w macierzy Oceny

Dyżur: `agent/ocena-legenda-stanow-20260903`, worktree `/private/tmp/ag-legenda`, port vite 5438.
Cytat właściciela: `docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/04_ASSESSMENT/OWNER_FEEDBACK_REGISTER.md`
(ID `ASM-OWN-013`; legenda „Propozycja AI / Review / Blocker / Evidence luka / Nieoceniony").
Pakiet: `docs/program/DECYZJE_WLASCICIELA_P0P1_20260904.md` wiersz 15, decyzja R-3.

## 1. Gdzie była legenda (zmierzone przez `git grep`)

Jedno źródło w całym repo: `src/components/method-workspace/LiveMatrix.tsx`
(komponent "Graphic Mirror" — macierz jednostka × poziom, współdzielona przez
DRD i SIRI). Legenda była twardo wpisanym blokiem JSX (linie 179–197 w stanie
PRZED), NIE kluczami i18n — pięć etykiet ("Propozycja AI", "Review", "Blocker",
"Evidence luka", "Nieoceniony") było literałami po polsku wprost w komponencie,
sterowanymi propem `legendCollapsed?: boolean` (domyślnie `false` — legenda
zawsze widoczna, żaden wołacz nigdy nie ustawiał `true`).

Odrębna legenda "AS-IS / TO-BE" w `DRDMatrixLegend`
(`src/components/assessment/drd/DRDAssessmentEditor.tsx:477`) to INNY, kolorowy
komponent (poziom AS-IS/TO-BE, nie workflow AI/Review/Blocker) — właściciel jej
nie cytował, zostawiona bez zmian. Zmierzone na ekranie `drd-macierz-oceny`
(patrz `wynik-drd-macierz-oceny-kontrola.json`): nadal ma "AS-IS"/"TO-BE",
nigdy nie miała "Propozycja AI"/"Evidence luka"/"Nieoceniony".

### Ekrany z `scripts/dev/g06-macierz-ekrany.json` (04_ASSESSMENT)

| ekran harnessu        | komponent pod spodem                          | miał legendę ASM-OWN-013? |
|------------------------|------------------------------------------------|----------------------------|
| `method-workspace`     | `MethodWorkspaceShell` → `LiveMatrix`          | TAK |
| `siri-workspace`       | `MethodWorkspaceShell` → `LiveMatrix`          | TAK |
| `drd-http-workspace`   | `MethodWorkspaceShell` → `LiveMatrix` (+ fallback `LiveMatrix` w report-content gdy `assessmentReportEnabled` OFF) | TAK |
| `drd-macierz-oceny`    | `DRDAssessmentEditor` → `DRDMatrixLegend` (AS-IS/TO-BE) | NIE — inna legenda, poza skopem |

Dodatkowy żywy wołacz poza harnessem (ten sam komponent `LiveMatrix`, nie ma
osobnego ekranu w g06): `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx:650`
(legacy runtime DRD) — naprawiony tym samym patchem komponentu, bo legenda była
częścią `LiveMatrix`, nie powielona per-wołacz.

## 2. Co usunięto

- `src/components/method-workspace/LiveMatrix.tsx`:
  - usunięty blok JSX legendy (5 etykiet + ikony Sparkles/Eye/AlertTriangle +
    2 kropki obwódek) obok nagłówka „Macierz na żywo";
  - usunięty martwy prop `legendCollapsed?: boolean` (interfejs + destrukturyzacja
    + warunek `{!legendCollapsed && (...)}}`) — istniał wyłącznie po to, żeby
    ewentualnie ukrywać tę legendę, żaden wołacz go nie używał;
  - DOŁOŻONE (żeby znaczenie ikon Sparkles/Eye nie zniknęło razem z legendą):
    `workflowPhrase` w `accessibleName` komórki — `', Propozycja AI'` gdy
    `cell.aiProposalPending`, `', Review'` gdy `cell.reviewRequired` (bez
    `aiProposalPending`, tak jak w renderze ikon) — dokładnie te same słowa co
    w usuniętej legendzie, żadnego nowego tekstu. `aria-label` i `title` na
    przycisku komórki (już istniały) niosą teraz tę frazę.
- `src/components/method-workspace/MethodWorkspaceShell.tsx:68` — usunięty
  martwy wpis `'legendCollapsed'` z `Omit<LiveMatrixProps, ...>`.
- Klucze i18n: **0 usuniętych** — legenda nigdy nie była kluczami tłumaczeń
  (literały w komponencie). `git diff --stat` na `public/locales/{pl,en}/translation.json`
  = pusty (bez zmian), zgodnie z oczekiwaniem.
- Test: `src/components/method-workspace/__tests__/LiveMatrix.test.tsx` — dodany
  przypadek `ASM-OWN-013: a cell with an AI proposal or a required review
  states so in its own accessible name` (sprawdza frazę w `aria-label` komórek
  L2/L3 ORAZ `queryByText` na trzy usunięte etykiety = brak w DOM).

## 3. Dowód wizualny — PRZED/PO, light+dark, 1440×900

Narzędzie: `scripts/dev/grafika-zrzuty.mjs --base=http://127.0.0.1:5438
--parametry=view=matrix --a11y=1 --rozwin-sekcje=1 --klik-po-rozwinieciu=1
--osiad-po-rozwinieciu=1500 --cofnij-jesli-skraca=1`. PRZED = `git stash`
tymczasowo cofnięty patch (potem `git stash pop` — zob. §5, uwaga o
współdzielonym stosie stash), PO = patch nałożony.

Pliki (katalog `evidence/grafika/ocena-legenda-20260903/`):

- `method-workspace__PRZED__pl__1440__{light,dark}.png` / `…__PO__…`
- `siri-workspace__PRZED__pl__1440__{light,dark}.png` / `…__PO__…`
- `drd-http-workspace__PRZED__pl__1440__{light,dark}.png` / `…__PO__…`
- `drd-macierz-oceny__PO__pl__1440__{light,dark}.png` — kontrola: inna legenda,
  bez zmian (brak pary PRZED, bo nic tu nie ruszono)
- `wynik-PRZED.json`, `wynik-PO.json`, `wynik-drd-macierz-oceny-kontrola.json`
  — surowy wynik narzędzia (tekst strony, a11y, jasność obrazu)

### Wynik tekstowy (ekstrakcja `document.body.innerText`)

| ekran | motyw | PRZED zawiera „Propozycja AI"/„Evidence luka"/„Nieoceniony" | PO zawiera |
|---|---|---|---|
| method-workspace | light/dark | TAK | NIE |
| siri-workspace | light/dark | TAK | NIE |
| drd-http-workspace | light/dark | TAK | NIE |

### a11y (axe-core, `--a11y=1`) — zero nowych naruszeń

Wszystkie 6 par PRZED/PO: `a11yNaruszenia: []` (0 zarówno przed, jak i po —
usunięcie legendy nie tylko nie dodało naruszeń, baseline była już czysta).
`bledyKonsoli: []` na wszystkich 12 zrzutach (0 błędów JS).

Obejrzane własnymi oczami (nie tylko JSON): `method-workspace__PRZED/PO
__pl__1440__light.png` — siatka macierzy, kolory komórek, ikona Sparkles na
komórce L3 „Mapa drogowa cyfrowa", niebieski pierścień targetu na L4
„Governance danych", różowa obwódka blokera na L3 „Jakość danych" — WSZYSTKIE
identyczne PRZED/PO. Jedyna różnica: rząd etykiet tekstowych obok „Macierz na
żywo" zniknął.

## 4. Bramki

- `bash scripts/check-list-canon.sh` → `✓ brak NOWYCH naruszeń kanonu tabel
  (pełny skan repo: 157 plików; naruszeń 368, baseline 368 — dług nie rośnie)`.
- Testy (esbuild per plik + vitest per plik, bez pełnego tsc/vitest):
  - `LiveMatrix.test.tsx` — 10/10 PASS (9 istniejących + 1 nowy).
  - `MethodWorkspaceShell.test.tsx` — 4/4 PASS.
  - `DrdMethodWorkspaceScreen.matrix.test.tsx` — 3/3 PASS.
  - `DrdHttpMethodWorkspaceScreen.reportMatrixCoexist.test.tsx` — 1/1 PASS.
  - `npx esbuild` czysto na `LiveMatrix.tsx` i `MethodWorkspaceShell.tsx`.

## 5. Incydent w trakcie pracy (do wiadomości nadzorcy)

`/private/tmp/m03` to WSPÓŁDZIELONY hub — dziesiątki worktree innych agentów
(`ag-flagi-on`, `ag-mw-drobiazgi`, `ag-raport-proto`, liczne `cx-day*`) wiszą na
TYM SAMYM `.git`. Stos `git stash` jest per-repo, nie per-worktree: mój
`git stash push` (żeby zrobić zrzut PRZED) trafił na wspólny stos, a
`git stash pop` chwilę później ZDJĄŁ CUDZY wpis — `src/components/MyWork/Calendar/CalendarView.tsx`
(61 linii zmian, nie mój plik, nie mój temat) — zamiast mojego. Mój własny
stash (cofnięcie `LiveMatrix.tsx`/`MethodWorkspaceShell.tsx`) zniknął ze stosu
bez śladu w `git fsck --unreachable` (sprawdzone, pusto).

Naprawa: cudzy diff `CalendarView.tsx` odłożony z powrotem na wspólny stos
komendą `git stash push -m "RATOWNICZY: cudzy diff CalendarView.tsx…"` (opisany,
żeby właściciel tamtej pracy mógł go odzyskać — `git stash list` w
`/private/tmp/m03` NA DZIEŃ 2026-09-03 21:33 pokazuje ten wpis jako
`stash@{0}`). Moje własne zmiany w `LiveMatrix.tsx`/`MethodWorkspaceShell.tsx`
odtworzone ręcznie (nie przez stash) z pamięci tej sesji — zweryfikowane
`git diff` linia po linii identyczne z oryginalnym patchem, testy 14/14 zielone
po odtworzeniu.

**Wniosek dla dalszej pracy w tym repo: NIE używać `git stash` w
`/private/tmp/m03`-owych worktree — stos jest dzielony między wszystkimi
równoległymi agentami.** Do zrzutów PRZED/PO bezpieczniej: `git show
HEAD:<plik> > /tmp/kopia` albo osobny `git worktree` na commit macierzysty.

## 6. Czego NIE zrobiono

- Nie tknięto `DRDMatrixLegend` (AS-IS/TO-BE) w `DRDAssessmentEditor.tsx` —
  inna legenda, właściciel jej nie cytował w ASM-OWN-013.
- Nie zmieniono `src/components/assessment/drd/DrdMethodWorkspaceScreen.tsx`
  (legacy DRD runtime) bezpośrednio — naprawa przyszła automatycznie przez
  współdzielony komponent `LiveMatrix`, plik nie wymagał osobnej edycji.
- Nie dodano nowych kluczy i18n ani nowych tekstów UI — `workflowPhrase`
  używa dosłownie tych samych dwóch fraz co usunięta legenda.
- Nie uruchomiono pełnego `tsc`/`vitest` (zakaz dla robotników) — tylko
  esbuild per plik + vitest na plikach dotykających zmiany.
- Nie zrobiono zrzutu ekranu `report`-view fallbacku w `drd-http-workspace`
  (drugi, rzadziej używany render `LiveMatrix` gdy `assessmentReportEnabled`
  jest OFF) — ten sam komponent, ta sama naprawa, ale nie sfotografowany
  osobno z uwagi na budżet czasu.
