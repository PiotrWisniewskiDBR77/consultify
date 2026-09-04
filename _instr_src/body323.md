## Po co ten dyżur istnieje

Dyżur 299 zmierzył poprawnie: rodzina przełącznika kreatora to 6 plików, dwie powierzchnie
produktowe (`InsightCreatorModal` w Wywiadzie, `InitiativeWizardModal` w Inicjatywach), lista
czekowania część B ma 43 punkty (nie 40 — nazwa „40-punktowa" jest historyczna), a test a11y ma
4 czerwone z 12. Dyżur postawił też WŁASNĄ hipotezę o przyczynie i **obalił ją pomiarem, poprawnie**:
etykieta pola Tytuł ISTNIEJE i jest poprawnie związana (`label[for=insight-creator-title]`,
`input#insight-creator-title`), a zmieniła się jedynie KONWENCJA znacznika wymagalności — z gwiazdki
` *` na `({t('interview.insightCreatorModal.requiredMarker')})`, czyli „(wymagane)"/„(required)",
zgodnie z zatwierdzonym kanonem (komentarz w kodzie cytuje `CLAUDE.md` §3 i odbiór 2026-08-30).
Cztery czerwone są więc **zestarzałymi asercjami testu**, nie defektem produktu.

Mimo poprawnej diagnozy dyżur **utknął z zerowym postępem na R2**. Powód leży po stronie
nadzorcy, nie wykonawcy — dwa błędy w instrukcji 299:

1. **Instrukcja 299 powoływała się na tabelę licencji TRZYKROTNIE**, w tym w treści `Z13`
   („Kod: wyłącznie naprawy w wymienionej rodzinie 6 plików plus testy") i w opisie zlecenia — ale
   **żadna tabela licencji nie istniała w wydanym dokumencie**. Wykonawca, poprawnie stosując
   regułę „gdy nie wiesz, czy masz licencję, nie masz", zgłosił STOP.
2. **`Z12` był wewnętrznie sprzeczny**: ta sama komórka ogłaszała
   `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` **nietykalnym do
   zapisu**, jednocześnie dopisując w nawiasie „(dziś 8/12 zielonych — po dyżurze 12/12)" — co
   jest wprost wymaganiem edycji tego samego pliku, żeby przejść z 8/12 na 12/12. Sprzeczność
   nierozstrzygnięta w treści.

Odbiorca adwersaryjny (04.09) **dostarczył dowód mutacyjny, którego dyżur 299 nie zdążył zrobić**:
wzorce `/^Insight Title \(required\)$/` i `/^Tytuł wniosków \(wymagane\)$/` dają **12/12 PASS**;
usunięcie `htmlFor="insight-creator-title"` z produktu daje **4 FAIL**; przywrócenie wraca do
12/12. **Zweryfikowane niezależnie przy pisaniu tej instrukcji, na tym samym markerze — patrz
`§0.1` weryfikacja (1).** Promień naprawy to dokładnie 4 linie w pliku testu, zero zmian produktu.

Ta instrukcja naprawia oba błędy nadzorcy: ma pełną tabelę licencji (`B.1`) i `Z12` bez
sprzeczności (test ma jawną wąską licencję, nie jest na liście nietykalnych).

## ★ Zmierz moje liczby sam

Twierdzę: baza dziś to 4 FAIL / 8 PASS z 12, na starym wzorcu ` *`; po naprawie 12/12; mutacja
`htmlFor` daje 4 FAIL; lista czekowania część B ma 43 punkty; flaga jest ON z `DEC-2026-09-03-350`;
rejestr 43×2 jeszcze nie istnieje. **Jeśli Twój pomiar przeczy mojej liczbie, obowiązuje Twój —
zapisz rozbieżność wprost.**

---

## B.1. TABELA LICENCJI PLIKOWYCH

> **★★ ZASTRZEŻENIE.** Powyższa tabela **JEST** licencją. Jeżeli plik, którego potrzebujesz,
> jest opisany jako „PEŁNA/WĄSKA LICENCJA" — **masz pozwolenie i STOP z tytułu »nie wolno mi«
> jest NIEZASADNY**. Jeżeli pliku nie ma w tabeli — domyślnie **TYLKO DO ODCZYTU**, produkt
> zastępczy: czerwony kontrakt + brief.

| Plik / wzorzec | Licencja | Co robisz, gdy pozycja wymagałaby zmiany pliku TYLKO-DO-ODCZYTU |
| --- | --- | --- |
| `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` | **★ WĄSKA LICENCJA — WYŁĄCZNIE cztery wywołania `getByLabelText` w liniach 140, 152, 178, 231** (patrz diff gotowy w `R2`). **ZAKAZ** zmiany jakiejkolwiek innej linii, innego testu, importów, `describe`-bloków | — |
| `src/components/Interview/InsightCreatorModal.tsx` | **TYLKO ODCZYT** — produkt jest już poprawny (etykieta, `htmlFor`, `required`, `aria-required` wszystkie na miejscu). Jeśli odbiór 43×2 znajdzie realny defekt kanonu (kolor/fokus/kontrast) — patrz wiersz „naprawy kanonu" niżej | — |
| `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | **TYLKO ODCZYT**, chyba że odbiór 43×2 znajdzie realny defekt kanonu — patrz wiersz „naprawy kanonu" | Kadr + brief w raporcie, STOP z nazwą defektu jeśli poważny |
| `src/components/shared/WizardModal/WizardModal.tsx` | **TYLKO ODCZYT — WSPÓLNA powłoka OBU kreatorów I `ReportGeneratorWizard.tsx` (poza zakresem tego dyżuru)**. Ma akcent `rgb(var(--color-primary-600, 79 70 229))` — zweryfikuj czy to narusza kanon crimson-neutralny podczas odbioru 43×2; jeśli tak, NIE naprawiaj tutaj (promień rażenia wykracza poza dwa kreatory) — wpisz `DO DECYZJI WŁAŚCICIELA` z kadrem i opisem promienia | Wpis `DO DECYZJI WŁAŚCICIELA` z kadrem, opisem promienia rażenia, i jednym zdaniem czego brakuje do samodzielnego rozstrzygnięcia |
| Pliki produktu kreatorów, punktowa naprawa kanonu (kolor/fokus/kontrast/`focus-visible`), WYŁĄCZNIE `InsightCreatorModal.tsx` i `InitiativeWizardModal.tsx`, NIE `WizardModal.tsx` | **★ WĄSKA LICENCJA — naprawy kanonu**: wolno zmienić klasę/token koloru, `tabIndex`, atrybut `aria-*`, kolejność fokusa. **ZAKAZ** zmiany struktury, kroków, layoutu, treści | Kadr PRZED/PO w raporcie, STOP jeśli defekt zbyt duży na naprawę bez decyzji właściciela |
| `docs/ui-standards/TRIADA_KANON.md` | **TYLKO ODCZYT** (`Z14`-podobny, źródło listy 43 punktów) | Errata w raporcie, jeśli lista jest niespójna z tym, co widzisz |
| `src/utils/interviewCreatorShellFlag.ts`, `src/utils/__tests__/interviewCreatorShellFlag.test.ts` | **TYLKO ODCZYT** (`Z10` — flaga ON z `DEC-2026-09-03-350`, nie zmieniasz; test dziś zielony, nie psujesz) | — |
| `scripts/dev/grafika-zrzuty.mjs` | **TYLKO ODCZYT** — kanoniczne narzędzie kadrów, nie modyfikujesz | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` (**NOWY**) | **★ PEŁNA LICENCJA** | — |
| `evidence/kreatory-odbior-20260904/**` (**NOWY**, poza repo-śledzeniem standardowym) | **★ PEŁNA LICENCJA**, `git add -f` | — |
| `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY323_KREATOR_WYWIADU_REPORT.md` | `§R.2` — **JEDYNY nowy dokument raportowy** (`Z13`) | — |
| `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY** | Opis w raporcie, patrz pułapka (3) o atrapie `react-i18next` |
| **Wszystko inne** | **TYLKO ODCZYT** | Opisujesz potrzebę w raporcie z dowodem plik:linia i idziesz dalej |

---

## B.2. TABELA POZYCJI

| Pozycja | Nazwa | Rdzeń? | Przekrojowe? | DoD | Definicja ukończenia | Komenda dowodowa | Commit |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | Pomiar wejściowy | TAK | NIE | bazowe | Wszystkie tezy z `§0.1` zmierzone na Twoim markerze | 7 komend `§0.1` | brak (bez zmian) |
| R2 | Naprawa 4 asercji | TAK | NIE — dowód: wiersz `B.1` daje jawną wąską licencję | 0 nowych (4 istniejące naprawione) | 12/12 PASS; dowód mutacyjny `htmlFor` w obie strony wklejony do raportu | `npx vitest run src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx --retry=0` | `fix(interview): 4 zestarzałe asercje getByLabelText — konwencja (wymagane) (323 R2)` |
| R3 | Lista czekowania 43×2 | TAK | NIE | n/d | Każdy z 43 punktów rozstrzygnięty ✓/✗/„n/d + powód" dla OBU kreatorów, zapisany w nowym rejestrze | plik `REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` istnieje z 86 wierszami (43×2) | `docs(day323): rejestr 43x2 kreatorów (323 R3)` |
| R4 | 16 kadrów | TAK | NIE | n/d | 8 kadrów na kreator (krok1/krok2 × light/dark × pl/en), każdy obejrzany przez `Read`, opisany | `node scripts/dev/grafika-zrzuty.mjs …` × 16, ścieżki w raporcie | `docs(day323): 16 kadrów obu kreatorów (323 R4)` |
| R5 | Blok dostępności | TAK | NIE | n/d | Cykl `Tab`/`Shift+Tab` bez pułapki fokusa, `Esc` zamyka jeden poziom, `focus-visible` na każdym elemencie, zero `primary-*` (poza znanym wyjątkiem WizardModal, zgłoszonym osobno) | opis manualnego przejścia + zrzut stanu fokusa w raporcie | `docs(day323): blok A11Y 41-43 (323 R5)` |
| R6 | Raport | NIE | NIE | n/d | Struktura `§R.2`, TWIERDZENIA NIEZWERYFIKOWANE niepuste | — | `docs(day323): raport` |

---

## B.3. TABELA MIANOWNIKÓW

| # | Co liczę | Liczba autora | Komenda | Obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | Testy a11y bazowe | 4 FAIL / 8 PASS z 12 | `npx vitest run …InsightCreatorModal.a11y.test.tsx --reporter=verbose` | TAK — zweryfikowane niezależnie przy pisaniu tej instrukcji |
| 2 | Punkty listy czekowania część B | 43 | `sed -n '90,275p' docs/ui-standards/TRIADA_KANON.md \| grep -c '^- \[ \] '` | TAK |
| 3 | Powierzchnie produktowe | 2 (`InsightCreatorModal`, `InitiativeWizardModal`) | `grep -rn 'WizardModal' src/components/Interview/InsightCreatorModal.tsx src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | TAK |
| 4 | Kadry wymagane | 16 (8×2) | krok1/krok2 × light/dark × pl/en | TAK |
| 5 | Pliki rodziny flagi | 6 (teza 299, niezmieniona przez ten dyżur) | `grep -rl 'creator-shell\|creatorShell' src` | Nie mierzone ponownie — poza rdzeniem tego dyżuru, dziedziczone z 299 |

---

## B.4. TABELA ROZŁĄCZNOŚCI

### B.4.1. Pliki zapisywane NA PEWNO

| # | Plik | Rodzaj | Pozycja | Ryzyko kolizji |
| --- | --- | --- | --- | --- |
| 1 | `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx` | istniejący | R2 | ZEROWE |
| 2 | `docs/program/waves/WAVE_03_ACCEPTANCE/REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md` | NOWY | R3 | ZEROWE |
| 3 | `evidence/kreatory-odbior-20260904/**` | NOWY | R4 | ZEROWE |
| 4 | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY323_KREATOR_WYWIADU_REPORT.md` | NOWY | R6 | ZEROWE |

### B.4.2. Pliki zapisywane WARUNKOWO

| Plik | Pozycja | Warunek |
| --- | --- | --- |
| `src/components/Interview/InsightCreatorModal.tsx`, `src/components/Initiatives/Wizard/InitiativeWizardModal.tsx` | R3/R5 | Tylko jeśli odbiór 43×2 znajdzie realny, drobny defekt kanonu (kolor/fokus/kontrast) — z kadrem PRZED/PO |

### B.4.3. Pliki, których ten dyżur JAWNIE NIE ZAPISZE

```
src/components/shared/WizardModal/WizardModal.tsx — współdzielony z ReportGeneratorWizard.tsx, poza zakresem
public/locales/*/translation.json — dyżur 317
scripts/dev/testy-puste-skan.mjs, tests/unit/services/api-extensions.test.ts — dyżur 318
scripts/dev/reachability-from-root.mjs, worktree cx-day292/293/297 — dyżur 322
```

### B.4.4. Zasoby wyłączne

| Zasób | Wartość | Sprawdzone |
| --- | --- | --- |
| Port PostgreSQL | 6339 | `lsof -nP -iTCP:6339 -sTCP:LISTEN` → puste (nieużywany w praktyce) |
| Port harnessu | 5479 | `lsof -nP -iTCP:5479 -sTCP:LISTEN` → puste |
| Kontener | `cx-day323-pg` | `docker ps` → brak |
| Baza | `cx323` | n/d |
| Gałąź | `codex/day323-kreator-wywiadu-20260904` | nie istnieje |
| Worktree | `/private/tmp/cx-day323-kreator-wywiadu` | nie istnieje |
| Flagi | `interviewCreatorShellFlag` — NIEZMIENIANA, ON | `grep -n parseFlag src/utils/interviewCreatorShellFlag.ts` |

### B.4.5. Kontrola przed KAŻDYM commitem

```bash
cd /private/tmp/cx-day323-kreator-wywiadu
git diff --name-only --cached | tee /private/tmp/cx-day323-kreator-wywiadu-artefakty/staged.txt
grep -iE 'WizardModal\.tsx$|public/locales/|testy-puste-skan|reachability-from-root' /private/tmp/cx-day323-kreator-wywiadu-artefakty/staged.txt \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
```

---

## R1 — POMIAR

Wykonaj i wklej wynik siedmiu komend `§0.1`. Potwierdź na SWOIM markerze: 4 FAIL/8 PASS,
43 punkty, flaga ON, rejestr nieistniejący.

Prawo zatrzymania po tej pozycji.

## R2 — NAPRAWA 4 ASERCJI (gotowa do wklejenia)

Zastosuj DOKŁADNIE ten diff w `src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx`
(cztery linie, zweryfikowany na tym markerze — daje 12/12 PASS):

```diff
- fireEvent.change(screen.getByLabelText(/^Insight Title \*$/), {
+ fireEvent.change(screen.getByLabelText(/^Insight Title \(required\)$/), {
    ...  # (dwa wystąpienia identycznej zmiany, linie ok. 140 i 152)

- const titleInput = screen.getByLabelText(/^Insight Title \*$/);
+ const titleInput = screen.getByLabelText(/^Insight Title \(required\)$/);
    ...  # linia ok. 178

- const titleInput = screen.getByLabelText(/^Tytuł wniosków \*$/);
+ const titleInput = screen.getByLabelText(/^Tytuł wniosków \(wymagane\)$/);
    ...  # linia ok. 231
```

Po naprawie: `npx vitest run src/components/Interview/__tests__/InsightCreatorModal.a11y.test.tsx --retry=0`
→ musi dać 12/12 PASS. **Dowód mutacyjny obowiązkowy mimo że naprawa jest gotowa** — nie
przepisujesz cudzego dowodu, wykonujesz go sam: usuń `htmlFor="insight-creator-title"` z
`InsightCreatorModal.tsx` (linia ok. 1780), uruchom ten sam test, wklej wynik (musi być 4 FAIL),
przywróć `htmlFor` przez `cp` kopii (`Z27`), uruchom ponownie (musi wrócić 12/12), `git diff --check`
na pliku produkcyjnym musi być pusty przed commitem.

Prawo zatrzymania po tej pozycji.

## R3 — LISTA CZEKOWANIA 43×2

Przejdź część B `TRIADA_KANON.md` (43 punkty) literalnie, punkt po punkcie, DLA KAŻDEGO
kreatora osobno (86 wierszy razem). Punkty o tabeli, pstryczku kolumn, kebabie wiersza i widoku
kanban dostają **jawne „n/d — kreator to modal, nie ekran listowy"**, nigdy milczące pominięcie.
Punkty o kolorze, fokusie, przyciskach, dostępności, motywach light/dark obowiązują w całości —
tu sprawdzasz też akcent `--color-primary-600` z `WizardModal.tsx` (patrz `B.1` i pułapka (5) w
`§0.2d`) i wpisujesz wynik (zgodny z kanonem / defekt do zgłoszenia, nie do naprawy tutaj). Zapisz
tabelę do `REJESTR_KREATORY_LISTA_CZEKOWANIA_20260904.md`.

Prawo zatrzymania po tej pozycji.

## R4 — 16 KADRÓW

Kanonicznym `scripts/dev/grafika-zrzuty.mjs`: krok 1 i krok 2 każdego kreatora, light i dark,
polski i angielski (2×2×2×2 = 16). Dla kreatorów z sekcjami zwijanymi:
`--rozwin-sekcje=1 --klik-po-rozwinieciu=1 --osiad-po-rozwinieciu=1500 --cofnij-jesli-skraca=1
--a11y=1`. KAŻDY kadr obejrzany przez `Read` i opisany z nazwy: co widać, czego brakuje. Para
light/dark, która jest tym samym obrazem, to defekt kadru (przyrząd kłamie — patrz pamięć
`duplikat-zamiast-motywu`), nie akceptujesz jej jako dowodu.

Prawo zatrzymania po tej pozycji.

## R5 — BLOK DOSTĘPNOŚCI (punkty 41-43)

Pełny cykl `Tab`/`Shift+Tab` bez pułapki fokusa w obu krokach obu kreatorów. `Esc` zamyka JEDEN
poziom naraz (jeśli jest zagnieżdżony popover/select, `Esc` zamyka jego, nie cały modal). Sprawdź
`focus-visible` widoczny na KAŻDYM elemencie interaktywnym. Zero `primary-*` poza jawnie
zgłoszonym wyjątkiem `WizardModal` z R3.

Prawo zatrzymania po tej pozycji.

## R6 — RAPORT

Tabela 43×2 (link do rejestru), rozstrzygnięcie czterech asercji z dowodem mutacyjnym w obie
strony, 16 ścieżek kadrów z opisem, stan bloku dostępności, ewentualny wpis `DO DECYZJI
WŁAŚCICIELA` dla akcentu `WizardModal`, TWIERDZENIA NIEZWERYFIKOWANE.

## Prawo zatrzymania

Obowiązuje po każdej pozycji z osobna. „R1-R2 zrobione (12/12 zielone), R3 rozpoczęte, R4-R5
nietknięte" jest pełnowartościowym wynikiem — o ile naprawa R2 stoi na dowodzie mutacyjnym, nie
na gotowym diffie wklejonym bez weryfikacji.
