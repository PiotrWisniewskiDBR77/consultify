# PKG_D — Statements — RAPORT NIEZALEŻNEJ WERYFIKACJI (Gate-E)

Weryfikator: agent niezależny od autora pakietu (nowa sesja, świeże drzewo).
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-d-statements`
Gałąź: `codex/fv3p-d-statements` @ `a278e58dd9268e4a642bfe0fe38d5c6fdf3d24fd`
Baza porównawcza: `45c39d68d0`
Raport autora zweryfikowany: `docs/validation/finance-v3/generated/gate-e/PKG_D_STATEMENTS_report.md`

Nastawienie przyjęte w tej weryfikacji: zakładać zawyżenie, dopóki nie
zmierzone samodzielnie. Poniżej — tylko to, co sam zmierzyłem, uruchomiłem
lub przeczytałem w kodzie źródłowym (nie w komentarzach autora).

---

## 0. Zakres zmian (kontrola wstępna)

```
$ git diff --stat 45c39d68d0..HEAD -- .
23 files changed, 4409 insertions(+), 0 deletions(-)
```

Zgadza się z deklaracją briefu. Drzewo czyste na starcie weryfikacji
(`git status --short` = puste), zero `git reset --hard`/`clean`/`stash`
użyte w tej sesji weryfikacyjnej.

---

## 1. Tabela werdyktów

| # | Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|---|
| 1 | „81/81 testów vitest, exit 0, z korzenia repo" | Uruchomiłem DWA razy. (a) Tylko katalog pakietu D (`src/components/Finance/statementPackWorkspaceV2`): **8 plików, 68 testów, exit 0**. (b) Dokładna komenda autora (dodatkowo `src/services/api/__tests__/financeV2.types.test.ts`, plik pakietu C, NIEDOTKNIĘTY w tej sesji): **9 plików, 81 testów, exit 0**. Oba przebiegi `--maxWorkers=2`, z korzenia repo. | **POTWIERDZONE** (dosłownie, dla dokładnej komendy autora) — z zastrzeżeniem: **pakiet D sam z siebie to 68 testów**, nie 81; „81" istnieje tylko przy doliczeniu 13 cudzych, wcześniej istniejących testów pakietu C jako „dowodu spójności". To metodologicznie uczciwe (autor to jawnie opisuje w §3 swojego raportu), ale liczba 81 w tytule raportu bez tego kontekstu myli. |
| 2 | „esbuild czysty dla 8/8 plików" | Odtworzyłem `npx esbuild <plik> --bundle --outfile=/dev/null` dla wszystkich 8 plików komponentów pakietu D — **8/8 exit 0**, zero błędów. | **POTWIERDZONE** (esbuild rzeczywiście czysty) — ALE zobacz §2 poniżej: to NIE dowodzi poprawności typów, i faktycznie znalazłem realny błąd typu, którego esbuild nie widzi. |
| 3 | Łańcuch źródło→mapping→canonical line→prezentacja, dopasowanie STRUKTURALNE (nigdy po etykiecie), z kontrolą negatywną | Przeczytałem `findReconciliationDetailRowForCell` (dopasowanie po `canonicalLineId`+`periodId`+`entityId`, zero odwołań do etykiety/nazwy w całym pliku `deriveStatementTable.ts`). Odtworzyłem WŁASNORĘCZNIE kontrolę negatywną #1 (patrz §4) — potwierdzone czerwone 3/6, przywrócone bajtowo identycznie. Wizualnie potwierdzone w zapisanym zrzucie (§5): klik komórki „Przychody ze sprzedaży" FY2025 → krok 1 (`trial_balance_fy2025.xlsx`, wiersz 12) → po rozwinięciu „Rekoncyliacja" → krok 2 z TĄ SAMĄ `sourceRowRef`. | **POTWIERDZONE** — dopasowanie jest wyłącznie strukturalne, zweryfikowane czytaniem kodu I własną kontrolą negatywną, I zrzutem. |
| 4 | ★ Pięć stanów pokrytych testami, `formatFinanceValueForDisplay` rozstrzyga wszystkie pięć — „zweryfikowane, nie założone" | Patrz **§3 (rozstrzygnięcie kluczowe)** poniżej — to najważniejszy wynik tej weryfikacji. | **CZĘŚCIOWO POTWIERDZONE** — prawdziwe na poziomie formatowania/prezentacji i typów DTO; **OBALONE na poziomie serwisu/danych dla domeny Statements**: `NA` i `NOT_APPLICABLE` są strukturalnie nieosiągalne przez `statementMappingService.ts` (jedyny pisarz `value_status` dla linii sprawozdań). GoldCo oracle **POTWIERDZONY** niezależnym pomiarem (grep + czytanie kodu, nie przyjęte na wiarę). |
| 5 | `ReconciliationLedgerPanel` = realny odczyt; brak przycisku „uruchom rekoncyliację", bo surowe linie/reguły niedostępne w TYM widoku | Sprawdziłem: `StatementPackWorkspaceV2Fetchers`/`DEFAULT_FETCHERS` nigdzie nie pobiera `rawLines`/`rules`. `mapStatementLines`/`runStatementReconciliation` istnieją w `financeV2.api.ts` ale nie są wołane z workspace'u. Zgrepowałem cały `src/`: `rawLines`/mapping UI żyje wyłącznie w `FinancialStatementImportWizard.tsx`/`FinancialStatementMappingEditor.tsx` — osobny, istniejący komponent ingestii, poza tym pakietem. Uzasadnienie NIE jest wygodną wymówką — jest strukturalnie prawdziwe: ten widok architektonicznie nie ma dostępu do danych ingestii. | **POTWIERDZONE** |
| 6 | Trzy jawne akcje raportu z bramkowaniem STANEM; krok 3 nieosiągalny bez faktycznego otwarcia kroku 2 | Na poziomie UI/DOM: **POTWIERDZONE** — natywny `disabled` na `<button>` blokuje `onClick` (zweryfikowane testem i logiką reactową; disabled button nie przyjmuje fokusu ani zdarzeń kliknięcia w przeglądarce/JSDOM). ALE ★ **NOWY DEFEKT (drobny, obronność w głąb)**: w `StatementPackWorkspaceV2.tsx` `handleOpenResult()` i `handlePublish()` bramkują WYŁĄCZNIE przez `if (!reportArtifact) return;` — NIE sprawdzają `draftStatus`/`openStatus` enum. Bramka realnie istnieje TYLKO w warstwie prezentacyjnej (`disabled` prop wyliczony w `StatementReportActionsSection`), nie jest zduplikowana w logice biznesowej wywoływanej przez `onClick`. Dziś nie da się tego wywołać inaczej niż przez UI (więc nie jest to żywy bug), ale to krucha bariera — przyszły refaktor przycisku/testu mógłby ją ominąć bez żadnego ostrzeżenia kompilatora/testu. | **POTWIERDZONE na poziomie UI**, z **jednym nowym zastrzeżeniem architektonicznym** (patrz plik:linia w §6). |
| 7 | Trzy kontrole negatywne, każda potwierdzona czerwona i przywrócona bajtowo identycznie | Odtworzyłem **DWIE z trzech** samodzielnie (patrz §4) — obie dały DOKŁADNIE liczby zgłoszone przez autora (3/6 i 2/7), obie przywrócone i zweryfikowane `git diff --quiet` = brak różnicy. Trzeciej (integracyjnej, `mappingRow` na sztywno `null`) NIE odtworzyłem — oceniam ją jako **wiarygodną przez analogię i przez czytanie kodu** (mechanizm identyczny jak w #1), ale nie jest to niezależny pomiar. | **POTWIERDZONE** (2/3 zmierzone bezpośrednio, 1/3 NIE ZMIERZONA — ograniczenie czasowe tej sesji, nie sprzeczny sygnał) |
| 8 | Allowlist: `financeV2.api.ts`/`financeV2.types.ts` tylko DODANE, zero usunięć cudzego kodu | `git diff 45c39d68d0..HEAD -- <oba pliki> \| grep "^-" \| grep -v "^---"` → **zero wierszy**. Zero usunięć w obu plikach. | **POTWIERDZONE** — fan-in z pakietami E/F/G/H bezpieczny dla tych dwóch plików. |
| 9 | Testy NIE osłabione (brak skip/only, brak usuniętych asercji) vs WIP `53c2a6e382` | `git diff 53c2a6e382..HEAD -- '**/__tests__/*'` → **2 usunięte linie w całości**, obie to stary `import` (zastąpiony szerszym importem), zero usuniętych asercji. `grep -rn "\.skip(\|\.only(\|\.todo(\|xit(\|xdescribe("` na całym katalogu testów pakietu → **zero trafień**. | **POTWIERDZONE** |
| 10 | Zrzuty obejrzane, ale NIEZAPISANE (brak narzędzia w tej sesji) | Zobacz §5 — JA zapisałem 6 realnych plików PNG używając Playwright (już w `node_modules`, `npx playwright` na tym repo), niezależnie od narzędzia przeglądarkowego użytego przez autora. Więc autor miał rację o SWOIM ograniczeniu narzędziowym, ale luka BYŁA możliwa do zamknięcia w tej samej sesji z inną drogą (Playwright), co teraz robię. | **CZĘŚCIOWO POTWIERDZONE** — ograniczenie autora realne, ale obchodzone (zamknięte w tej weryfikacji). |

---

## 2. „esbuild czysty" — co to realnie dowodzi (i czego nie)

Zmierzone: `server/tsconfig.json` wyklucza `**/*.test.ts`/`**/*.spec.ts`.
Ale **root `tsconfig.json` (frontend, `src/`) NIE wyklucza plików testowych
ani `__tests__/`** — `"include": ["src", ...]`, żadnego wykluczenia
testów w `"exclude"`. `npm run type-check` = `tsc --noEmit` na root
configu, więc **pełny `tsc` frontendu FAKTYCZNIE obejmowałby te pliki**,
gdyby ktoś go uruchomił (zakazane w tej sesji regulaminem robotnika —
autor to respektował, świadomie NOT_ATTEMPTED).

Ja (weryfikator, bez zakazu robotnika) zbudowałem **scoped `tsconfig`**
(plik tymczasowy, usunięty po użyciu, nie w repo) rozszerzający root
config, `include` zawężone do plików pakietu D + dwóch shared plików, i
uruchomiłem `tsc --noEmit -p <ten config>`. Wynik:

- **8× TS2783** (`stmtLineId`/`id`/`reconciliationRunId` „specified more
  than once") — wyłącznie w plikach `__tests__/*`, wzorzec fixture-builder
  (`{ pole: overrides.pole, ...domyślne, ...overrides }`) powtórzony w 4
  plikach testowych. Funkcjonalnie NIESZKODLIWE (runtime poprawny —
  spread nadpisuje samym sobą), ale to REALNY błąd typu, którego esbuild
  nie widzi.
- **1× TS7053, PRODUKCYJNY, nie test**: `CanonicalStatementTableV2.tsx:96`
  — `UNIT_LABELS[headerScale.unit]`, gdzie `UNIT_LABELS: Record<FinanceValue['unit'], string>`
  (unia `'UNITS'|'THOUSANDS'|'MILLIONS'|'BILLIONS'`), ale
  `pickHeaderCurrencyAndScale` (w `deriveStatementTable.ts`) deklaruje
  zwracany typ jako `{ currency: string; unit: string }` — **`unit`
  poszerzone do zwykłego `string`**, mimo że w runtime zawsze pochodzi z
  `FinanceValue['unit']`. TypeScript w trybie strict słusznie odmawia
  bezpiecznego indeksowania. **Runtime nie jest zepsuty** (wartość string
  zawsze jest jednym z 4 poprawnych kluczy), ale to jest DZIURA W
  BEZPIECZEŃSTWIE TYPÓW, którą `esbuild --bundle` (transpiler, nie
  typechecker) systemowo nie może wykryć.

**Wniosek dla przyszłych pakietów**: „esbuild 8/8 czysty" w tym repo
oznacza wyłącznie „składnia poprawna, importy się rozwiązują" — **nie**
oznacza zgodności z `strict: true` roota. Dla frontendu (w odróżnieniu od
`server/`) pełny `tsc` FAKTYCZNIE obejmuje testy i komponenty tego
pakietu — zakaz pełnego tsc u robotników jest uzasadniony kosztem
maszyny, nie brakiem pokrycia.

**Rekomendacja (nie wykonana — poza mandatem weryfikatora, zgłaszam z
plikiem:linią)**: `src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts`,
funkcja `pickHeaderCurrencyAndScale` — zmienić zwracany typ `unit` z
`string` na `FinanceValue['unit']`.

---

## 3. ★ ROZSTRZYGNIĘCIE KLUCZOWE — pięć stanów: dane/serwis czy tylko prezentacja?

**Pytanie orkiestratora**: czy `NA` jest osiągalny przez żywe serwisy
kanoniczne dla domeny Statements, czy tylko w warstwie formatowania?

**Metoda**: nie przyjąłem twierdzenia GoldCo na wiarę — zmierzyłem
niezależnie, czytając (nie zgadując) jedyny kod, który faktycznie PISZE
`value_status` dla linii sprawozdań kanonicznych.

```
$ grep -n "function valueStatusFor" -A5 server/src/services/finance/canonical/statementMappingService.ts

function valueStatusFor(value: number | null | undefined): FinanceValueStatus {
  if (value === null || value === undefined) return 'MISSING';
  if (value === 0) return 'PRESENT_ZERO';
  return 'PRESENT_NONZERO';
}
```

To jest **jedyna funkcja w `statementMappingService.ts` która produkuje
`value_status`** zapisywany do bazy (wywołanie: linia 391, zapis do
kolumny `value_status` w INSERT, linia ~396-411). Zgrepowałem cały
`server/src/services/finance/canonical/statementMappingService.ts` pod
kątem `'NA'`/`'NOT_APPLICABLE'` — **jedyne wystąpienie to deklaracja typu
unii na górze pliku** (linia 52), zero miejsc, gdzie te dwie wartości są
faktycznie PRZYPISYWANE. Sprawdziłem też ścieżkę odczytu
(`statements.routes.ts:207`, `status: l.value_status`) — to CZYSTY
odczyt kolumny z bazy, nie ma logiki nadpisującej. Sprawdziłem
`server/src/services/finance/grid/BulkOpsEngine.ts` (jedyny inny pisarz
`value_status` w kodzie grid/bulk-edit) — operuje na INNEJ tabeli (zero
wystąpień `finance_statement_lines`/`statement_line` w tym pliku), więc
nie dotyczy linii sprawozdań.

**Wniosek, zmierzony a nie zgadywany**: dla domeny Statements (to, co
faktycznie konsumuje Pakiet D przez `GET /statements/:id/lines`), **tylko
3 z 5 wartości `FinanceValueStatus` są kiedykolwiek osiągalne w
produkcji**: `MISSING`, `PRESENT_ZERO`, `PRESENT_NONZERO`. `NA` i
`NOT_APPLICABLE` są zadeklarowane w typie (bo `FinanceValue` jest
współdzielonym kształtem z innymi domenami — `baselineComputeService.ts`
i `predictionComputeService.ts` FAKTYCZNIE produkują `'NA'`, ale to inne
artefakty: `BASELINE_MODEL`/`PREDICTION_SCENARIO`, nie `STATEMENT_PACK`),
ale **strukturalnie martwe dla tej konkretnej ścieżki danych**.

**Co to oznacza dla twierdzenia autora**: `formatFinanceValueForDisplay`
faktycznie poprawnie formatuje wszystkie pięć (to jest test pakietu C,
prawdziwy, nie zakładany). Testy pakietu D (`CanonicalStatementTableV2`,
`SourceEvidencePanel`, `deriveStatementTable`) faktycznie renderują
wszystkie pięć poprawnie — **ale wyłącznie na MOCKOWANYCH danych ręcznie
skonstruowanych z `status: 'NA'`/`'NOT_APPLICABLE'`**, kształtach, których
żaden żywy request do `GET /statements/:id/lines` nigdy realnie nie
zwróci dla tej domeny. To NIE unieważnia testów (poprawnie dowodzą, że
UI SIĘ NIE ZAŁAMIE i NIE POKAŻE ZERA, jeśli kiedyś taki stan się pojawi —
np. przez przyszłą zmianę `valueStatusFor` albo inny pisarz) — ale
twierdzenie „zweryfikowano, nie założono" w raporcie autora jest
**precyzyjne dla warstwy prezentacji i NIEPRECYZYJNE bez zastrzeżenia dla
warstwy danych/serwisu**. Autor NIE napisał w swoim raporcie (§6), że 2
z 5 stanów są martwe dla tej konkretnej domeny — to jest luka
ujawnieniowa, nie luka w kodzie.

**GoldCo oracle: POTWIERDZONY** niezależnym pomiarem (grep + czytanie
`valueStatusFor`, nie przyjęty na wiarę).

---

## 4. Kontrole negatywne — dwie odtworzone samodzielnie

Wszystkie operacje na plikach robione przez `git show HEAD:<plik> ><plik>`
(NIGDY `git stash`/`reset`/`clean`, zgodnie z zakazem — stash jest
współdzielony między worktree w tym repo).

### 4.1 `findReconciliationDetailRowForCell` (funkcja czysta)

Zepsute: pętla `if (true) return row;` zamiast porównania 3 pól.
```
$ npx vitest run .../deriveStatementTable.test.ts --maxWorkers=2
 Test Files  1 failed (1)
      Tests  3 failed | 16 passed (19)
```
Zgadza się dokładnie z tabelą autora („3/6 testów findReconciliationDetailRowForCell").
Przywrócone: `git show HEAD:.../deriveStatementTable.ts > .../deriveStatementTable.ts`,
`git diff --quiet` = brak różnicy (bajtowo identyczne).

### 4.2 `StatementReportActionsSection` — krok 2 (`open`) `disabled` na sztywno

Zepsute: `disabled: draftStatus !== 'ready'` → `disabled: false`.
```
$ npx vitest run .../StatementReportActionsSection.test.tsx --maxWorkers=2
 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
```
Zgadza się dokładnie z tabelą autora („2/7 testów poczerwieniało").
Przywrócone: `git show HEAD:... > ...`, `git diff --quiet` = brak różnicy.

### 4.3 Trzecia kontrola (integracyjna, `mappingRow` → `null`)

NIE odtworzona bezpośrednio w tej sesji (ograniczenie czasu/obciążenia
maszyny). Oceniam jako wiarygodną przez czytanie kodu
(`StatementPackWorkspaceV2.tsx:257-264`, `mappingRow` liczony przez
dokładnie tę samą funkcję zweryfikowaną w §4.1) — status: **NIE ZMIERZONA
NIEZALEŻNIE**, nie sprzeczna z żadnym innym pomiarem.

---

## 5. Zrzuty — ZAPISANE na dysk (zamknięcie luki #10 z briefu autora)

Autor zgłosił brak narzędzia do zapisu PNG w swojej sesji przeglądarkowej.
W tej sesji: uruchomiłem `dev-render` (`npx vite --config dev-render/vite.config.ts`,
port 58923 — port z `.claude/launch.json` 58123 był już zajęty przez inną
równoległą sesję na tej maszynie, więc użyłem wolnego portu, bez dotykania
cudzego procesu) i użyłem **Playwright** (już w `node_modules`/`package.json`
tego repo — `test:e2e` go używa produkcyjnie) do wygenerowania i zapisania
6 realnych plików PNG:

```
docs/validation/finance-v3/generated/gate-e/screenshots/pkg-d/statement-pack-v2-populated-light.png
docs/validation/finance-v3/generated/gate-e/screenshots/pkg-d/statement-pack-v2-populated-dark.png
docs/validation/finance-v3/generated/gate-e/screenshots/pkg-d/statement-pack-v2-empty-light.png
docs/validation/finance-v3/generated/gate-e/screenshots/pkg-d/statement-pack-v2-empty-dark.png
docs/validation/finance-v3/generated/gate-e/screenshots/pkg-d/statement-pack-v2-missing-light.png
docs/validation/finance-v3/generated/gate-e/screenshots/pkg-d/statement-pack-v2-missing-dark.png
```

`populated-*` zrzucone PO kliknięciu komórki „Przychody ze sprzedaży"
FY2025 i rozwinięciu sekcji „Rekoncyliacja", żeby zrzut pokazywał PEŁNY
łańcuch dowodowy (krok 1 + krok 2), nie tylko pusty stan startowy.

### Ocena wizualna wobec kanonu (patrzone bezpośrednio na zapisane pliki)

- **Crimson na CTA/stanach aktywnych**: `grep -rn "primary-\|bg-primary\|text-primary\|border-primary\|crimson\|#85182F\|#85182f" src/components/Finance/statementPackWorkspaceV2/` → **zero trafień** (potwierdzone niezależnie, nie przepisane z raportu autora). Wizualnie: badge „KOREKTA"/„NIEPRZYPISANA"/„DUPLICATE: N" są bursztynowe (`c-warning`), nie czerwone. Jedyny czerwony tekst w całym zestawie zrzutów to komunikat błędu sieci w stanie `missing` (`c-danger`, `#e80538`/`#ed5565` — zmierzone z `src/index.css:100-103,300-303` — to inny odcień czerwieni niż crimson `#85182F` i jest to DOZWOLONE użycie: „semantyka krytyczna", zgodnie z regułą UI #3 CLAUDE.md). **Zgodne z kanonem.**
- **Fokus niebieski**: `--c-focus-solid: #2563eb` (light) / `#5b8def` (dark), zmierzone z `src/index.css:73,286`; wszystkie interaktywne elementy pakietu (komórki tabeli, przyciski kroków raportu, wiersze ledgera) używają klasy `focus-visible:ring-c-focus` (zmierzone grepem w kodzie źródłowym trzech plików). **Zgodne z kanonem** — nie zmierzone przez faktyczne wciśnięcie Tab w tej sesji (ograniczenie czasu), ale zmierzone przez kod źródłowy, nie przez komentarz autora.
- **Język jednolity PL**: wszystkie napisy widoczne na zrzutach są po polsku; jedyne wyjątki to skróty kanoniczne dozwolone briefem (`COGS`, `MAPPED`, `UNMAPPED`, `DUPLICATE`, `WITHIN_TOLERANCE`, `PRESENT_NONZERO` w polu „Status" dowodu źródłowego) — brak mieszanki w obrębie jednego zdania. **Zgodne z kanonem.**
- **Status nie tylko kolorem**: potwierdzone na zrzutach — każdy badge niesie WIDOCZNY TEKST obok koloru („WITHIN_TOLERANCE", „completed", „MAPPED: 2 / UNMAPPED: 1 / DUPLICATE: 1", „Czeka na otwarcie wyniku", „Najpierw otwórz wynik (krok 2)."). **Zgodne z kanonem.**
- Stany puste (`empty`) i błędu (`missing`) są uczciwe — zero list/wierszy „()" udających dane, jawny tekst „Brak linii sprawozdania dla tej wersji." / komunikat błędu sieci nieukryty.

---

## 6. Nowe defekty znalezione w tej weryfikacji (nie zgłoszone przez autora)

| # | Plik:linia | Opis | Dotkliwość |
|---|---|---|---|
| D1 | `src/components/Finance/statementPackWorkspaceV2/deriveStatementTable.ts`, `pickHeaderCurrencyAndScale` (deklaracja zwracanego typu) | `unit` zwracane jako `string` zamiast `FinanceValue['unit']` — powoduje realny błąd `tsc --noEmit` (TS7053) w `CanonicalStatementTableV2.tsx:96` przy indeksowaniu `UNIT_LABELS`. Runtime OK (wartość zawsze jest poprawnym kluczem), ale to dziura w bezpieczeństwie typów niewidoczna dla `esbuild`. | Niska (runtime nie zepsuty; naprawa to zmiana jednej linii typu) |
| D2 | `src/components/Finance/statementPackWorkspaceV2/StatementPackWorkspaceV2.tsx`, `handleOpenResult`/`handlePublish` (linie ~229-247) | Bramka sekwencyjna („krok 3 nieosiągalny bez otwarcia kroku 2") istnieje WYŁĄCZNIE w warstwie prezentacyjnej (`disabled` prop wyliczony w dziecku). Handlery w rodzicu sprawdzają tylko `if (!reportArtifact) return;`, nie `openStatus`/`draftStatus`. Dziś nieszkodliwe (nie ma innej drogi wywołania niż klik w niezablokowany przycisk), ale brak obronności w głąb. | Niska/informacyjna (zalecenie: dodać jawny warunek stanu w handlerach, nie tylko truthy-check obiektu) |
| D3 | 8× w plikach `__tests__/*.test.tsx` (fixture builder pattern) | `{ pole: overrides.pole, ...domyślne, ...overrides }` — `tsc --noEmit` zgłasza TS2783 „specified more than once" dla pola ustawionego explicite I przez spread. Funkcjonalnie nieszkodliwe. | Kosmetyczna |

Żaden z D1-D3 nie unieważnia werdyktów autora — wszystkie trzy są
drobne i nie zostały wykryte przez `esbuild`/vitest (co samo w sobie
jest ciekawym potwierdzeniem, że „esbuild+vitest zielone" ≠ „zero
problemów" nawet gdy testy faktycznie przechodzą).

---

## 7. Ocena końcowa

**PASS z zastrzeżeniami (PARTIAL byłby zbyt surowy, FULL PASS byłby
zawyżeniem)** — a dokładniej: **PASS dla zakresu zadeklarowanego przez
autora**, pod warunkiem że raport autora zostanie uzupełniony o
jednoznaczne ujawnienie z §3 tego raportu (NA/NOT_APPLICABLE martwe dla
domeny Statements na poziomie serwisu).

Uzasadnienie:
- Wszystkie twardo weryfikowalne twierdzenia (testy, esbuild, allowlist,
  brak osłabienia testów, montaż backendu, brak crimson) **POTWIERDZONE
  niezależnym pomiarem**, nie na słowo autora.
- Łańcuch dowodowy (twierdzenie 3, rdzeń pakietu) **POTWIERDZONY** własną
  kontrolą negatywną i zrzutem — to jest najsilniejszy dowód w tym
  pakiecie i broni się.
- Jedyne rzeczywiste zawyżenie: twierdzenie o „pięciu zweryfikowanych
  stanach" jest prawdziwe TYLKO dla warstwy prezentacji, nie dla
  warstwy danych/serwisu tej konkretnej domeny — i to nie zostało jasno
  odróżnione w raporcie autora. To nie jest kłamstwo (autor nie napisał
  nic fałszywego), ale jest to niekompletne ujawnienie dokładnie tego
  rodzaju, którego szuka ta procedura weryfikacji.
- Dwa drobne, nowe defekty (D1, D2) — żaden nie blokuje, oba warte
  jednolinijkowych poprawek w następnej sesji.
- Luka „zrzuty niezapisane" — zamknięta w tej sesji (Playwright), pliki
  w repo, wizualnie zgodne z kanonem UI CLAUDE.md #3.
- Pakiet POZOSTAJE za flagą OFF, niewpięty produkcyjnie — zweryfikowane
  niezależnie (grep), zero ryzyka regresji dla żywego demo.

**Rekomendacja dla koordynatora**: dopuścić pakiet dalej w procesie, z
wymogiem: (a) dopisać do raportu autora jedno zdanie o martwych stanach
NA/NOT_APPLICABLE dla domeny Statements (§3 tego raportu), (b) opcjonalnie
naprawić D1 (zmiana typu, 1 linia) przy najbliższej okazji dotykania tego
pliku — nie wymaga osobnej sesji.
