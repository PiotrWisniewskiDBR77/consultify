## Po co ten dyżur istnieje

22.08 właściciel zobaczył, że w Wywiadzie pełne menu akcji ma tylko Przydział — Skrzynka, Sesje,
Szablony, Wnioski i Inicjatywy Wywiadu wyglądają jak ten sam produkt, ale nie dają tych samych
możliwości. Dyżur 292 (03.09) zrobił R1 (macierz akcji, jedna tabela dla sześciu typów) i R2
(wspólny mechanizm — `interviewActionMatrix.ts` jako SSOT, z którego korzysta i kebab wiersza,
i pasek podglądu). R3-R6 — dopięcie pozostałych pięciu typów, naprawa testu, dowód, raport —
**nie zostały rozpoczęte**: worktree ma dokładnie dwa commity nad wspólnym przodkiem, oba z
03.09, zero z 04.09.

Dyżur 322 dostał zadanie domknięcia R3-R6 i też ich nie zaczął. Zamiast tego postawił w swoim
raporcie tezę o przyczynie: „test wymienia `InsightViewer.tsx`". **To jest fałsz — w pliku testu
nie ma ani jednego wystąpienia tego napisu.** Prawdziwy defekt jest inny i cichszy: czwarty blok
testu kontraktowego (`is consumed by the row-menu host and every dedicated preview action
component`) sprawdza obecność `interviewActionMeta` w liście **pięciu** plików — hosta kebaba
(`InterviewHub.tsx`) i czterech podglądów (Assignment/Session/Template/Initiative). **Pomija
szósty realny konsument: `InterviewInsightPreview.tsx`**, który macierz faktycznie importuje
(`import { interviewActionMeta } from './interviewActionMatrix';`, linia 32) — po prostu nikt go
nie dopisał do listy testowanych plików. Test dziś przechodzi, bo nie patrzy tam, gdzie powinien.

Osobno, z odbioru dyżuru 323 (którego całym zakresem była właśnie ta konwencja): mimo naprawy
czterech asercji testu a11y i 16 obejrzanych kadrów, **`InsightCreatorModal.tsx:2177` nadal ma
literał gwiazdki** — `{t('interview.insightCreatorModal.selectSourceSessions')} *` w
`renderSessionsBlock()` (krok 2, wybór sesji źródłowych). Krok 1 (pole Tytuł, linie 1786-1792)
ma poprawną konwencję: `({t('interview.insightCreatorModal.requiredMarker', 'wymagane')})`,
z komentarzem w kodzie cytującym `CLAUDE.md` §3 i odbiór 2026-08-30. Dyżur 323 naprawił i
zweryfikował mutacyjnie tylko pole Tytuł — krok 2 nie był w zakresie jego dowodu i literał
przetrwał niezauważony. Do tego rejestr 43×2 obu kreatorów (`REJESTR_KREATORY_LISTA_CZEKOWANIA_
20260904.md`), który dyżur 323 zbudował, nosi marker starszy niż ten dokument i nikt niezależny
go jeszcze nie zweryfikował.

## ★ Zmierz moje liczby sam

Twierdzę: 292 ma dokładnie dwa commity nad `58ef0771d7` (`aa8fdcc8bd`, `73c03f41a2`), worktree
czysty; test kontraktowy nie zawiera stringu `InsightViewer`; lista `files` w czwartym bloku ma
5 wpisów, brakuje `InterviewInsightPreview.tsx`, który realnie importuje `interviewActionMeta`;
`InsightCreatorModal.tsx:2177` ma surowy ` *`, linie 1791/1822 mają poprawny `requiredMarker`;
rejestr 43×2 istnieje (53 linie, marker `bc18bc7a...`) z werdyktem „nie osiąga 100%" (punkty
31/32/40/41/43 czerwone dla co najmniej jednego kreatora); sekcja „Stan PO" rejestru menu akcji
Wywiadu jest nadal placeholderem jednozdaniowym. **Jeśli Twój pomiar przeczy mojej liczbie,
obowiązuje Twój — zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Licencja | Zastępczy produkt |
| --- | --- | --- |
| `src/components/Interview/interviewActionMatrix.ts` | **★ PEŁNA LICENCJA** w zakresie R3-R6 (dopisanie akcji Sesji/Szablonów/Skrzynki/Wniosków/Inicjatyw Wywiadu, jeśli macierz ich dziś nie niesie) | — |
| `src/components/Interview/InterviewHub.tsx`, `InterviewAssignmentPreview.tsx`, `InterviewSessionPreview.tsx`, `InterviewTemplatePreview.tsx`, `InterviewInitiativePreview.tsx`, `InterviewInsightPreview.tsx` | **★ PEŁNA LICENCJA** w zakresie wiring macierzy → kebab/pasek podglądu | — |
| `src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx` | **★ PEŁNA LICENCJA** — dopisanie `InterviewInsightPreview.tsx` do listy `files`, wzmocnienie asercji z `toContain('interviewActionMeta')` na dowód EFEKTU (wywołanie handlera) | — |
| `src/components/Interview/InsightCreatorModal.tsx` | **★ WĄSKA LICENCJA: wyłącznie linia ok. 2177** (`renderSessionsBlock()`), zamiana literału ` *` na konwencję `({t('interview.insightCreatorModal.requiredMarker', 'wymagane')})` analogiczną do linii 1791/1822. **ZAKAZ** zmiany innych linii, kroków, layoutu | Czerwony kontrakt + brief |
| `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | **TYLKO ODCZYT** — wchodzi wyłącznie do weryfikacji rejestru 43×2 (R4), nie do naprawy | Wpis `DO DECYZJI WŁAŚCICIELA` jeśli znajdziesz nowy defekt |
| `src/components/shared/WizardModal/WizardModal.tsx` | **TYLKO ODCZYT — WSPÓLNA powłoka obu kreatorów** | Wpis `DO DECYZJI WŁAŚCICIELA` z promieniem rażenia, nie naprawiasz tutaj |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_MENU_AKCJI_WYWIAD_20260903.md` | **PEŁNA LICENCJA — wyłącznie dopisanie sekcji „Stan PO"**. **ZAKAZ** zmiany „Pomiar PRZED" | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` | **PEŁNA LICENCJA na DOPISYWANIE** pod istniejącym „Werdykt". **ZAKAZ kasowania 43 istniejących wierszy** | — |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | **★ WYŁĄCZNIE DOPISYWANIE KLUCZY**, parytet PL+EN w tym samym commicie, jeśli R1-R2 (Sesje/Szablony/Skrzynka/Wnioski/Inicjatywy) wymaga nowych kluczy akcji | — |
| `evidence/day330-wywiad-menu/**` (**NOWY**, poza repo-śledzeniem standardowym) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie |
| `scripts/check-list-canon.sh`, `scripts/check-focus-canon.sh`, `scripts/check-artefakt.sh` | **TYLKO ODCZYT** | Musisz przechodzić zielono, nie zmieniać reguł |
| `docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md` | **TYLKO ODCZYT** (`Z14`) | Errata w raporcie |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY330_WYWIAD_MENU_REPORT.md` | **JEDYNY nowy raport zbiorczy** (`Z13`) | — |
| **Wszystko inne, w tym CAŁE `server/`** | **TYLKO ODCZYT** | Opis w raporcie z plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R0 | Odczyt instrukcji 292 + historia worktree + 9 komend `§0.1` | TAK | NIE | bazowe | Wszystko przeczytane i zmierzone na Twoim markerze | 9 komend | brak |
| R1 | Sesje + Szablony (R3 instr. 292) | TAK | NIE — dowód: `Z12` nie chroni plików Wywiadu | wg instr. 292 | Akcje z macierzy uzupełnione w obu miejscach dla tych dwóch typów, klucze i18n pl/en, esbuild każdego pliku | `npx esbuild <plik> --bundle --outfile=/dev/null` per plik | `feat(interview): R3 sesje+szablony menu akcji (330 R1)` |
| R2 | Skrzynka + Wnioski + Inicjatywy Wywiadu (R4 instr. 292) + naprawa listy konsumentów testu | TAK | NIE | wg instr. 292 + 1 wzmocniona asercja | Trzy pozostałe typy uzupełnione; `InterviewInsightPreview.tsx` dopisany do listy `files`; czwarty blok asertuje EFEKT (wywołanie handlera), nie sam string | `npx vitest run src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx --retry=0` | `feat(interview): R4 skrzynka+wnioski+inicjatywy + szósty konsument testu (330 R2)` |
| R3 | Naprawa literału `InsightCreatorModal.tsx:2177` | TAK | NIE — dowód: wiersz `B.1` daje wąską licencję | 0 nowych | Krok 2 używa `requiredMarker`, zero surowych `*` w polach wymaganych modalu | `grep -n \"') \\*'\" src/components/Interview/InsightCreatorModal.tsx` → pusto | `fix(interview): usuwa ostatni literał gwiazdki — krok 2 kreatora wniosku (330 R3)` |
| R4 | Weryfikacja niezależna rejestru 43×2 | NIE | NIE | n/d | Dopisek pod „Werdykt" z Twoim własnym przejściem punktów na marker `1c3d3da8...`, zgodny/niezgodny per punkt, nie przepisany z 323 | `evidence/day330-wywiad-menu/rejestr-weryfikacja.md` | `docs(day330): weryfikacja niezależna rejestru 43x2 (330 R4)` |
| R5 | Dowód (R5 instr. 292) | TAK | NIE | wg instr. 292 | Zrzuty kebaba+podglądu 6 typów, light+dark, pl+en, a11y bez naruszeń hosta, lista czekowania część B per typ | `node scripts/dev/grafika-zrzuty.mjs …` | `docs(day330): dowód 6 typów Wywiadu (330 R5)` |
| R6 | Raport zbiorczy + „Stan PO" | NIE | NIE | n/d | Struktura `§R.2`, „Stan PO" rejestru menu akcji uzupełnione, TWIERDZENIA NIEZWERYFIKOWANE niepuste | — | `docs(day330): raport` |

> Żadna pozycja nie wymaga zmiany pliku serwera — cały zakres jest frontowy.

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Commity 292 ponad wspólnym przodkiem | 2 | `git -C /private/tmp/cx-day292-wywiad-menu log --oneline 58ef0771d7..HEAD \| wc -l` | TAK |
| 2 | Wystąpienia `InsightViewer` w teście kontraktowym | 0 | `grep -c InsightViewer src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx` | TAK |
| 3 | Pliki w liście `files` czwartego bloku | 5 (brakuje 6.) | `sed -n '63,70p' src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx \| grep -c \"src/components/Interview\"` | TAK |
| 4 | Import `interviewActionMeta` w `InterviewInsightPreview.tsx` | 1 | `grep -c interviewActionMeta src/components/Interview/InterviewInsightPreview.tsx` | TAK |
| 5 | Literały ` *` pozostałe w `InsightCreatorModal.tsx` (wzorzec `') *'` po tekście i18n, nie w komentarzu) | 1 (linia 2177) | `grep -n \"') \\*'\\|)} \\*\" src/components/Interview/InsightCreatorModal.tsx` | ★ SPRAWDŹ — dopasuj wzorzec do realnego stylu linii, nie kopiuj ślepo |
| 6 | Wiersze rejestru 43×2 | 43 (86 rozstrzygnięć: kreator × 2) | `grep -c '^| [0-9]' docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` | TAK |
| 7 | Punkty czerwone w werdykcie 43×2 dla co najmniej jednego kreatora | 5 (31,32,40,41,43) | odczyt tabeli, kolumna zawiera `✗` | TAK — do potwierdzenia niezależnie w R4 |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik/katalog | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- |
| 1 | `src/components/Interview/**` (poza `InsightCreatorModal.tsx` poza linią 2177) | R1-R2 | NISKIE — Twój worktree reużywany, nikt inny go dziś nie dotyka |
| 2 | `src/components/Interview/__tests__/interviewActionMatrix.contract.test.tsx` | R2 | NISKIE |
| 3 | `src/components/Interview/InsightCreatorModal.tsx` (wyłącznie linia 2177) | R3 | ŚREDNIE — plik dotykany przez dyżur 323 wcześniej, ale ten commit już scalony |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_MENU_AKCJI_WYWIAD_20260903.md` (sekcja Stan PO) | R6 | NISKIE |
| 5 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` (dopisek) | R4 | NISKIE |
| 6 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY330_WYWIAD_MENU_REPORT.md` | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `public/locales/pl/translation.json`, `public/locales/en/translation.json` | R1-R2 | Tylko jeśli uzupełnienie akcji wymaga nowych kluczy i18n — dopisujesz, parytet w tym samym commicie |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
server/** (cały katalog) — zero zmian tras w tym dyżurze
src/components/shared/WizardModal/WizardModal.tsx — wspólna powłoka, promień rażenia poza zakresem
src/components/Initiatives/Wizard/InitiativeWizardModal.tsx — tylko odczyt w tym dyżurze
scripts/dev/testy-puste-skan.mjs, tests/unit/config/noEmptyAssertions.test.ts — dyżur 332
server/migrations/**, server/scripts/migrationOrdering.ts, tests/unit/backend/schema/** — dyżur 333
src/components/MyWork/**, src/components/Initiatives/** (poza WizardModal) — dyżur 331
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6356 | `lsof -nP -iTCP:6356 -sTCP:LISTEN` → puste |
| Port harnessu | 5496 | `lsof -nP -iTCP:5496 -sTCP:LISTEN` → puste |
| Kontener | `cx-day330-pg` | `docker ps` → brak |
| Baza | `cx330` | n/d — front-only, kontener prawdopodobnie niepotrzebny, ale zarezerwowany |
| Gałąź | `codex/day292-wywiad-menu-akcji-20260903` (REUŻYWANA, nie tworzysz nowej) | `git -C /private/tmp/cx-day292-wywiad-menu branch --show-current` |
| Worktree | `/private/tmp/cx-day292-wywiad-menu` (istniejący, reużywany) | `ls -d /private/tmp/cx-day292-wywiad-menu` |
| Flagi | brak nowych | n/d |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day292-wywiad-menu
git diff --name-only --cached | tee /private/tmp/cx-day330-wywiad-menu-akcji-artefakty/staged.txt
grep -iE '^server/|testy-puste-skan|migrationOrdering|WizardModal\.tsx$|InitiativeWizardModal\.tsx$' /private/tmp/cx-day330-wywiad-menu-akcji-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R0 — ODCZYT I POMIAR

Przeczytaj `INSTRUKCJA_DYZUR_292.md` w całości. Wykonaj i wklej wynik 9 komend `§0.1`. Potwierdź
na SWOIM markerze: dwa commity 292, brak `InsightViewer` w teście, pięć plików w liście `files`,
import `interviewActionMeta` w `InterviewInsightPreview.tsx`, literał w linii 2177, marker
rejestru 43×2 starszy niż Twój, „Stan PO" nadal placeholder.

Prawo zatrzymania po tej pozycji.

## R1 — SESJE + SZABLONY (rdzeń, R3 instrukcji 292)

Uzupełnij akcje z macierzy w obu miejscach (kebab wiersza + pasek podglądu) dla typów `session`
i `template`, jeśli macierz dziś nie niesie dla nich pełnego kompletu z rejestru „Pomiar PRZED"
(`REJESTR_MENU_AKCJI_WYWIAD_20260903.md`). Klucze i18n pl/en dla każdej nowej akcji. Esbuild
KAŻDEGO zmienionego pliku osobno (zakaz pełnego `tsc`). Zrzuty kebaba i podglądu obu typów,
light/dark, jako dowód wstępny (pełny dowód formalny idzie do R5).

Commit po R1.

## R2 — SKRZYNKA + WNIOSKI + INICJATYWY WYWIADU + SZÓSTY KONSUMENT (rdzeń, R4 instrukcji 292)

Jak R1, dla typów `inbox`, `insight`, `initiative`. Dla Inicjatyw Wywiadu: każda akcja „otwórz
inicjatywę" prowadzi do zatwierdzonego rekordu (`DEC-2026-09-03-346`: `InitiativeDocumentView`),
zweryfikuj testem `initiativeRecordCanon`, jeśli istnieje, albo opisz brak i zaprojektuj
odpowiednik.

**Naprawa listy konsumentów (pozycja przeniesiona z fałszywej diagnozy dyżuru 322):** dopisz
`'src/components/Interview/InterviewInsightPreview.tsx'` do tablicy `files` w bloku `is consumed
by the row-menu host and every dedicated preview action component`
(`interviewActionMatrix.contract.test.tsx`, dziś linie ok. 63-70). Następnie wzmocnij samą
asercję: zamiast `toContain('interviewActionMeta')` (dowód obecności stringu w pliku źródłowym,
nie dowód wywołania), zbuduj dowód EFEKTU — np. renderuj każdy z sześciu komponentów (host
kebaba + 5 podglądów), otwórz menu/pasek akcji i sprawdź, że wybranie pozycji z macierzy
faktycznie wywołuje odpowiadający handler/trasę, nie tylko że identyfikator `interviewActionMeta`
występuje w kodzie pliku. **Dowód mutacyjny obowiązkowy**: usuń wywołanie handlera z JEDNEGO
z sześciu plików, uruchom test — musi zaczerwienić się; przywróć przez `cp` kopii (`Z27`) —
musi wrócić do zielonego; `git diff --check` na pliku produkcyjnym pusty przed commitem.

Commit po R2.

## R3 — NAPRAWA LITERAŁU `InsightCreatorModal.tsx:2177`

W `renderSessionsBlock()` zamień:

```diff
- {t('interview.insightCreatorModal.selectSourceSessions')} *
+ {t('interview.insightCreatorModal.selectSourceSessions')}{' '}
+ <span className="text-xs font-normal text-slate-600 dark:text-slate-400">
+   ({t('interview.insightCreatorModal.requiredMarker', 'wymagane')})
+ </span>
```

(dopasuj dokładny JSX do stylu sąsiedniego labela w liniach 1786-1792 — ta sama klasa, ten sam
klucz `requiredMarker`). Po naprawie: `grep -n "') \*'" src/components/Interview/
InsightCreatorModal.tsx` → pusto (zero pozostałych surowych gwiazdek w polach wymaganych).
Sprawdź istniejący test a11y (`InsightCreatorModal.a11y.test.tsx`, naprawiony przez dyżur 323)
— **jeśli** zawiera asercję na `selectSourceSessions` z literałem `*`, napraw ją analogicznie do
naprawy z dyżuru 323 (`getByLabelText` na nowy wzorzec), z tym samym dowodem mutacyjnym w obie
strony (usuń `htmlFor`/`aria-label`, pokaż czerwony, przywróć, pokaż zielony).

Commit po R3.

## R4 — WERYFIKACJA NIEZALEŻNA REJESTRU 43×2

Rejestr `REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` istnieje z markerem `bc18bc7a...` —
starszym niż ten dyżur. Przejdź WSZYSTKIE 43 punkty dla obu kreatorów na SWOIM markerze
(`1c3d3da8...`), niezależnie, bez kopiowania cudzych wyników. Zapisz dopisek pod istniejącym
„Werdykt": per punkt — zgodny z zapisem 323 / niezgodny (z dowodem) / nie dotyczy zmieniło się.
Punkty 31/32/40/41/43 (dziś czerwone dla co najmniej jednego kreatora) sprawdź ze szczególną
uwagą — to one niosą werdykt „nie osiąga 100%". Nie naprawiasz `WizardModal.tsx` (poza zakresem,
patrz `B.1`) — jeśli defekt tam nadal stoi, potwierdź to i zostaw `DO DECYZJI WŁAŚCICIELA`.

Commit po R4.

## R5 — DOWÓD (rdzeń, R5 instrukcji 292)

Dla każdego z 6 typów Wywiadu: zrzut kebaba otwartego i podglądu z paskiem akcji, light + dark,
pl 1440 i en 1024, kanonicznym narzędziem `scripts/dev/grafika-zrzuty.mjs` z flagami z pułapki
(5) `§0.2e` tej instrukcji jeśli dotyczy sekcji zwijanych. A11y zero realnych naruszeń poza
trzema regułami hosta. Test kontraktowy `interviewActionMatrix.contract.test.tsx` w całości
zielony (R2). Lista czekowania część B z `TRIADA_KANON.md` przejrzana per typ, z zaznaczeniem
punktów nie do spełnienia i dlaczego (np. Wywiad to nie ekran kanban — `n/d`).

Commit po R5.

## R6 — RAPORT ZBIORCZY

Macierz PRZED/PO wszystkich sześciu typów, stan naprawy literału z dowodem mutacyjnym testu
a11y (jeśli dotknięty), wynik weryfikacji niezależnej 43×2 (zgodny/niezgodny per punkt), ścieżki
zrzutów R5, uzupełniona sekcja „Stan PO" w `REJESTR_MENU_AKCJI_WYWIAD_20260903.md`, TWIERDZENIA
NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1-R3 zrobione, R4 rozpoczęte, R5-R6 nietknięte" jest
pełnowartościowym wynikiem. Menu z przyciskiem, który nic nie robi, nie jest warte nic — to
atrapa. Zamknięcie w raporcie pozycji, której nie domknąłeś w całości, nie jest wynikiem —
rejestr, który kłamie, kosztuje więcej niż praca, której nie zrobiono.
