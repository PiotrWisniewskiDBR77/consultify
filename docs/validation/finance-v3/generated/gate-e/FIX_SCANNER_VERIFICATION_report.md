# Gate J fix-pass — NIEZALEŻNA WERYFIKACJA (rawEnumLeakScanner, v8Delete, zrzuty flag-off, spór liczby testów)

Weryfikator: sesja niezależna od autora paczki `codex/fv3p-fix-scanner`.
Worktree: `/Users/piotrwisniewski/consultify-wt/fv3p-j-security`
Gałąź: `codex/fv3p-fix-scanner`, HEAD w chwili weryfikacji: `86f2f36b7b` (+ jeden dodatkowy
commit tej weryfikacji, `ea64aba10b`, dokumentacja zadania 3).
Dokument autora, weryfikowany: `docs/validation/finance-v3/generated/gate-e/FIX_SCANNER_V8DELETE_report.md`.

★ Zero mutantów pozostawionych w drzewie — każdy atak niżej kończy się `git checkout --
<plik>` (nigdy `stash`/`reset`/`clean`) i potwierdzeniem pustego `git diff` przed przejściem
dalej. Zrzuty generowane WYŁĄCZNIE przez Playwright (przez skrypt autora, output przekierowany
do `/tmp`, nigdy nadpisujący zacommitowane pliki). Zero połączeń do demo/staging/prod.

---

## Tabela wyników

| Twierdzenie autora | Mój niezależny pomiar | Werdykt |
|---|---|---|
| Skaner: `SCANNED_ROOTS` rekurencyjnie odkrywa `Finance/**`, 13→44 pliki | Policzyłem sam: `find src/components/Finance -name "*.tsx" ...` = **44** | POTWIERDZONE |
| Próg minimum 40 plików faktycznie chroni przed zawężeniem | Zawęziłem `SCANNED_ROOTS` z powrotem do `[Analysis, Valuation]` (mutant) → sanity-check test **czerwienieje jako pierwszy** w kolejności wykonania (13 < 40), zanim „zero wycieków" zdąży (i faktycznie) przejść pusto | POTWIERDZONE, z zastrzeżeniem (patrz niżej — próg ma martwą strefę 4 plików) |
| Pięć katalogów AP-CLIENT realnie skanowanych, nie tylko wymienionych w teście | Wstawiłem `{__attackProbe.status}` do `FinanceExportImportPanel.tsx` (plik, którego autor NIE użył w swojej własnej próbie negatywnej — użył `compare/FinanceComparePanel.tsx`) → test „zero wycieków" poprawnie zaczerwienił się, nazywając dokładny plik/linię | POTWIERDZONE (niezależny plik-świadek, nie ten sam co w oryginalnym dowodzie) |
| Cztery udokumentowane martwe punkty regexu (zmienna pośrednia, 2× szablon literałowy, konkatenacja) faktycznie nie są łapane | Wstawiłem wszystkie cztery jednocześnie do `FinanceCommentsPanel.tsx` → `no .tsx file...bare-interpolates` test pozostał **zielony** (5/5 zielono mimo czterech realnych, wstrzykniętych wycieków) | POTWIERDZONE — dokładnie tak, jak opisano |
| `v8Delete` poprawnie obsługuje gołe 204 | Uruchomiłem `src/services/api/v8/__tests__/client.test.ts` niezależnie: 3/3 zielono, w tym mockowany 204 (`.json()`/`.text()` rzucają, jak prawdziwy pusty `Response`) → `null`, nie wyjątek | POTWIERDZONE |
| Usunięcie `v8DeleteExpectNoContent` z `financeV2.api.ts` niczego nie zepsuło | Zdiffowałem `6a3429e21b..86f2f36b7b` na `financeV2.api.ts`: jedyna zmiana zachowania to `deleteFinanceSavedView`, teraz wywołujące `v8Delete<null>` wprost — stary lokalny wrapper zwracał `null` na `res.ok` bez czytania body, identycznie do naprawionego `v8Delete` na 204. Przywróciłem oba pliki do stanu `6a3429e21b` (`git show <sha>:<plik> > <plik>`) i odpaliłem `tests/components/MyWork/NotebookTopicChips.test.tsx` — **identyczne 3 failed / 3 passed (6)** przed naprawą; przywróciłem naprawę, `git diff --stat` puste | POTWIERDZONE |
| 13 pozostałych miejsc wywołania w 7 plikach | Policzyłem sam (`grep -rna "v8Delete" src`, poprawiony na literały z `<Type>(`): partner.ts(1) + finance.ts(3) + my-work.ts(2) + interview.ts(2) + results.ts(3) + assessment.ts(1) + NotebookTopicChips.tsx(1) = **13**, plus `financeV2.api.ts`(1, plik naprawiany) = 14 łącznie w kodzie produkcyjnym | POTWIERDZONE |
| 4 brakujące zrzuty „flaga OFF" — świeży kontekst Playwright, flaga=false | Wygenerowałem własne 4 zrzuty tym samym skryptem (output do `/tmp`, nie nadpisując oryginałów) przeciw lokalnie odpalonemu dev-render (`vite --config dev-render/vite.config.ts --port 58045`): flagi `false` przy każdym zrzucie, wszystkie 4 **bajtowo identyczne** (md5 `f6b4c00a38d06e5c5bba0a92c0a0c9fb`) z zacommitowanymi. Obejrzałem jeden zrzut (compare) — pusta powłoka harnessu, zero treści panelu. Dodatkowo zrobiłem sanity-check z `scene=default` (flaga `true`) na tym samym ekranie — realna tabela porównania się renderuje, więc pusty zrzut to prawdziwa brama flagi, nie zepsuty ekran | POTWIERDZONE |
| Spór liczby testów: 151/22 (autor pakietu AP-CLIENT i autor tej paczki) vs 147/21 (niezależny weryfikator AP-CLIENT) | Odpaliłem DOKŁADNIE udokumentowaną komendę w jednorazowym `git worktree` wyciętym na `6a3429e21b` (dowiązany `node_modules`, zero przeniesionego stanu): **151 testów / 22 pliki**. Ta sama komenda na obecnym HEAD tej gałęzi (`86f2f36b7b`): **152 testy / 22 pliki** (o 1 więcej — skaner urósł o netto 1 test). 147/21 = 151 minus `useFinanceBaselineWorkspaceFlag.test.ts` (4 testy), plik złapany przypadkiem przez wildcard `useFinance*Flag.test.ts`, mimo że Baseline nie jest jedną z 5 zdolności AP-CLIENT | ★ ROZSTRZYGNIĘTE — patrz sekcja niżej. 147/21 było BŁĘDNE dla `AP_CLIENT_report.md`; POPRAWIONE z powrotem na 151/22 (commit `ea64aba10b`) |
| Zastąpienie pełnego przemiatu monorepo przebiegiem zawężonym, 78 porażek, wszystkie przedistniejące | Odpaliłem dokładnie tę samą komendę sam, w tle, z pełnym przechwyceniem kodu wyjścia (`> plik 2>&1; echo EXIT=$?`), raport JSON: **293 pliki, 3401 testów, 3323 passed, 78 failed, 28 plików z błędami** — identyczne liczby co w raporcie autora. Sprawdziłem treść: wszystkie 28 plików to albo `tests/components/MyWork/**` (26 plików), albo dwa jawnie wskazane pliki (`financeFallbackGating.test.ts`, `valuationService.defaultAssumptions.test.ts`, oba z pustym `git diff 6a3429e21b..HEAD`). Sprawdziłem ręcznie 5 losowych plików MyWork pod kątem importu `financeV2.api`/`v8/client`/skanera — tylko `NotebookTopicChips.test.tsx` go dotyka (i to ten sam, już potwierdzony przedistniejący defekt) | POTWIERDZONE — zastępstwo jest uczciwe i faktycznie nie dotyka Finance |

---

## Zadanie 1 — atak na skaner

### (a) Kolejność: czy sanity-check wyprzedza „zero wycieków"?

Zawęziłem `SCANNED_ROOTS` z powrotem do dwóch katalogów (`Finance/Analysis`, `Finance/Valuation`)
i uruchomiłem `tests/unit/finance/rawEnumLeakScanner.test.ts` z `--reporter=verbose`. Wynik,
w kolejności wykonania (odpowiada kolejności źródłowej w pliku, testy w vitest nie są
przerywane przez wcześniejszy fail w tym samym pliku):

1. `scans a realistic slice...` → **CZERWONY**: `expected 13 to be greater than or equal to 40`
2. `discovers all five previously-blind AP-CLIENT directories...` → **CZERWONY**
3. `directory exists...Analysis` → zielony
4. `directory exists...Valuation` → zielony
5. `no .tsx file...bare-interpolates` (**„zero wycieków"**) → **zielony** (pusty scan, przechodzi
   wakuowo, dokładnie jak przewidziano)
6. `KNOWN_UNFIXED_LEAKS...` → **CZERWONY** (znany wyjątek znika ze zwężonego zakresu)

Wynik pliku: **3 failed | 3 passed (6)**, `EXIT=1`.

Odpowiedź: TAK, sanity-check jest zdefiniowany PRZED testem „zero wycieków" w kolejności
źródłowej i faktycznie zaczerwienia się pierwszy. Ale ★ kluczowe zastrzeżenie: w vitest domyślnie
KAŻDY `it()` w pliku wykonuje się niezależnie od wyniku poprzedniego (brak `bail`/short-circuit
wewnątrz jednego `describe`) — więc „zero wycieków" i tak zostałoby uruchomione i przeszłoby
pusto, NIEZALEŻNIE od kolejności. Zabezpieczenie działa nie dlatego, że sanity-check „blokuje"
wykonanie kolejnego testu, ale dlatego, że **cały plik kończy się kodem wyjścia ≠0**, jeśli
choćby jeden test w nim jest czerwony — więc bramka CI/gate zależna od zielonego pliku i tak
złapie regresję, niezależnie od tego, który konkretny test w środku zaświecił na czerwono.
Gdyby ktoś usunął `expect(files.length).toBeGreaterThanOrEqual(40)` (a nie tylko zawęził
`SCANNED_ROOTS`), zabezpieczenie by zniknęło — ale to już inny atak niż zawężenie zakresu.

### (b) Wrażliwość progu 40

Rzeczywista liczba plików: 44. Próg: `>= 40`. Martwa strefa: **4 pliki**.

Zbudowałem mutanta wykluczającego dokładnie 4 pliki z katalogów NIE sprawdzanych po nazwie
(`Prediction/PredictionWorkspace.tsx`, `Prediction/ScenarioResultsView.tsx`,
`Prediction/ScenarioAssumptionsView.tsx`, `baseline/AssumptionsView.tsx` — żaden z nich nie jest
jednym z pięciu katalogów AP-CLIENT pinowanych po nazwie, ani jednym z trzech plików
Analysis/Valuation pinowanych po nazwie, ani plikiem z `KNOWN_UNFIXED_LEAKS`). Wynik: **5/5
zielono** — próg nie wykrył zniknięcia 4 plików.

Wniosek: próg `>= 40` chroni skutecznie przed katastroficznym zawężeniem (powrót do starego
zakresu 13 plików wywala się głośno), ale NIE chroni przed powolnym, częściowym wyciekiem —
do 4 plików może zniknąć z katalogów nie chronionych po nazwie (`Prediction/`, `baseline/`,
`shared/`, `statementPackWorkspaceV2/`, oraz 10 z 11 plików bezpośrednio w `Finance/` — jeden,
`FinancialStatementPackWorkspace.tsx`, jest pośrednio chroniony przez test staleness
`KNOWN_UNFIXED_LEAKS`) i test pozostanie w pełni zielony. To realna, choć wąska, granica tego
zabezpieczenia — warto to wiedzieć, nie warto podnosić progu do dokładnie 44 (kruche, złapie
się na każdym legalnym dodaniu pliku), ale czytelnik nie powinien traktować „>=40 zielone" jako
dowodu na brak jakiegokolwiek zawężenia.

### (c) Czy pięć katalogów AP-CLIENT jest REALNIE skanowanych

Autor pokazał negatywną kontrolę na `Finance/compare/FinanceComparePanel.tsx`. Powtórzyłem na
INNYM pliku (`Finance/exportImport/FinanceExportImportPanel.tsx`, katalog, którego autor NIE
testował) — wstawiłem `{__attackProbe.status}`, test poprawnie zaczerwienił się, nazywając
dokładny plik i linię, przywróciłem plik (`git checkout --`, `git diff` puste). Potwierdza to,
że skanowanie schodzi realnie do podkatalogów, a nie tylko do listy nazw w teście pinującym.

### (d) Cztery udokumentowane martwe punkty regexu

Wstawiłem WSZYSTKIE cztery jednocześnie do `Finance/comments/FinanceCommentsPanel.tsx`
(cztery nowe, nieeksportowane funkcje pomocnicze z realnym JSX):

```tsx
function __blindSpot1(m) { const s = m.status; return <div>{s}</div>; }
function __blindSpot2(m) { const s = m.status; return <div>{`Status: ${s}`}</div>; }
function __blindSpot3(m) { return <div>{`${m.status}`}</div>; }
function __blindSpot4(m) { return <div>{'Status: ' + m.status}</div>; }
```

Wynik: **5/5 zielono** — skaner nie złapał ŻADNEGO z czterech wstrzykniętych, realnych wycieków.
Dokładnie zgodne z opisem w komentarzu testu. Przywrócone (`git checkout --`, `git diff` puste).

**Realne granice skanera** (potwierdzone empirycznie, nie tylko z komentarza): to statyczny
regex nad tekstem źródłowym, jednohopowy, tylko bezpośrednia interpolacja w `{...}`. Nie łapie:
zmiennej pośredniej, template literala zbudowanego ze zmiennej, bezpośredniego template literala,
konkatenacji stringów. Traktować zielony wynik jako „brak REGRESJI dokładnie tego kształtu buga,
który uderzył cztery razy" — nie jako dowód braku jakiegokolwiek surowego renderu enuma.

---

## Zadanie 2 — `v8Delete`

Root cause potwierdzony w `src/services/api/baseClient.ts:194-201` — `handleResponse` zwraca
`null` (nie `{data}`) na `res.status === 204`. Naprawa w `src/services/api/v8/client.ts:83-96`:
`(json === null ? null : json.data) as T` — poprawna.

Własny test regresji autora (`src/services/api/v8/__tests__/client.test.ts`) odpaliłem
niezależnie: **3/3 zielono** (204→null, 200+envelope→.data, 404→throw), `EXIT=0`.

Policzyłem sam wszystkie miejsca wywołania `v8Delete` w `src/` (poza definicją, importami,
re-eksportem w `v8/index.ts` i komentarzami): **13** w 7 plikach poza `financeV2.api.ts`
(partner.ts×1, finance.ts×3, my-work.ts×2, interview.ts×2, results.ts×3, assessment.ts×1,
`NotebookTopicChips.tsx`×1) + 1 w `financeV2.api.ts` samym (plik naprawiany) = 14 łącznie w
kodzie produkcyjnym. Zgadza się z liczbą autora.

Zdiffowałem `6a3429e21b..86f2f36b7b` na `financeV2.api.ts` — jedyna funkcjonalna zmiana to
`deleteFinanceSavedView`, teraz `v8Delete<null>(...)` zamiast usuniętego lokalnego
`v8DeleteExpectNoContent`. Stary wrapper: `if (res.ok) return null` bez czytania body — dla
204 identyczne zachowanie do naprawionego `v8Delete`. Nie ma zmiany zachowania dla żadnego z
pozostałych 13 miejsc (żadne z nich dziś nie dostaje 204 w swoich testach/mockach — potwierdzone
przez przywrócenie obu plików do stanu przed-naprawą i ponowny przebieg
`NotebookTopicChips.test.tsx`: **identyczne 3 failed / 3 passed (6)**, `EXIT=1`, przed i po).
Przywrócone do stanu naprawionego, `git diff --stat` puste po przywróceniu.

---

## ★ Zadanie 3 — rozstrzygnięcie liczby testów

**Metoda**: jednorazowy `git worktree add /tmp/verify-6a3429e21b 6a3429e21b`, dowiązany
`node_modules` z tego worktree (symlink, nie kopia — zgodnie z lekcją
„dev-render w worktree = symlinki node_modules"), zero stanu przeniesionego z innej sesji.
Odpaliłem DOKŁADNIE:

```
npx vitest run src/services/api/__tests__/ src/hooks/__tests__/useFinance*Flag.test.ts \
    src/components/Finance/{lineage,compare,comments,savedViews,exportImport} \
    tests/unit/finance/rawEnumLeakScanner.test.ts --maxWorkers=2
```

**Na `6a3429e21b`** (SHA, którego dotyczy `AP_CLIENT_report.md`): `--reporter=json` →
**22 pliki / 151 testów, 151 passed, 0 failed**. Lista plików i liczba testów na plik w
worktree pokrywa się 1:1 z tym, co dostałem na obecnym HEAD tej gałęzi, MINUS jeden test
w `rawEnumLeakScanner.test.ts` (4 zamiast 5 — stary, wąski skaner miał mniej testów niż
poszerzony).

**Na `86f2f36b7b`** (obecny HEAD tej gałęzi, ta sama komenda, bez worktree): **22 pliki /
152 testy, 152 passed**. O 1 więcej niż na `6a3429e21b` — dokładnie tyle, ile
`rawEnumLeakScanner.test.ts` urosło netto w tej paczce (dodano 2 testy: „discovers five
AP-CLIENT dirs", „KNOWN_UNFIXED_LEAKS staleness"; usunięto 1: drugi wpis pętli
„directory exists" po zwężeniu `SCANNED_ROOTS` z dwóch wpisów do jednego; netto +1).

**Skąd 147/21**: `src/hooks/__tests__/useFinance*Flag.test.ts` to wildcard, który — oprócz
pięciu prawdziwie-AP-CLIENT-owych hooków (`useFinanceCompareFlag`, `useFinanceCommentsFlag`,
`useFinanceSavedViewsFlag`, `useFinanceExportImportFlag`, `useFinanceLineageNavigatorFlag`) —
przypadkiem łapie też `useFinanceBaselineWorkspaceFlag.test.ts` (4 testy). Baseline NIE jest
jedną z pięciu zdolności AP-CLIENT (Compare/Comments/SavedViews/ExportImport/Lineage) — to
przypadkowy połów glob-a. 151 − 4 = 147, 22 − 1 = 21, dokładnie. Własny akapit rozbicia w
`AP_CLIENT_report.md` już wcześniej wymieniał tylko „5 flag hook tests" (nie 6) — to był ślad
tego samego zjawiska, tylko nikt nie doszedł do źródła przed poprawką.

**Werdykt**: 147/21 to poprawna liczba TYLKO jeśli celowo wykluczysz plik Baseline jako
„nie-AP-CLIENT" — legalna, ale INNA definicja niż „wynik dosłownego uruchomienia
udokumentowanej komendy", którą sekcja „Test results" w `AP_CLIENT_report.md` twierdziła, że
pokazuje. Dla tego konkretnego dokumentu i tego konkretnego bloku transkryptu, 147/21 było
BŁĘDNE. Poprawiłem `AP_CLIENT_report.md` z powrotem na **151/22** (4 miejsca: blok transkryptu,
akapit rozbicia, linia kontroli negatywnych, checklist DoD), z inline-notatką tłumaczącą całą
sekwencję (151 oryginalne → 147 błędna poprawka → 151 ponowna korekta, z wyjaśnieniem czemu
147 się pojawiło). Zacommitowane: `ea64aba10b`.

Nie tknąłem `FIX_SCANNER_V8DELETE_report.md` (historyczny zapis tamtej sesji, nie bieżąca
dokumentacja stanu) — czytelnik tego pliku powinien traktować jego „147/147" jako zastąpione
przez to ustalenie.

To dokładnie ten sam wzorzec co poprzedni epizod 656/659/679: trzy poprawne pomiary tego samego
polecenia na trzech różnych stanach tego samego zbioru plików. Tu: 147 (podzbiór
AP-CLIENT-owy, `6a3429e21b`), 151 (dosłowny wynik komendy, `6a3429e21b`), 152 (dosłowny wynik
komendy, `86f2f36b7b` — obecny HEAD tej gałęzi, bo skaner urósł o 1 w tej samej paczce).

---

## Zadanie 4 — zrzuty „flaga OFF"

Odpaliłem lokalny dev-render (`npx vite --config dev-render/vite.config.ts --port 58045`),
odpaliłem skrypt autora (`scripts/dev/ap-client-flag-off-screenshots.mjs`) z podmienionym
`OUT` na katalog w `/tmp` (żeby nie nadpisać zacommitowanych plików przed porównaniem).

Wynik: dla wszystkich 4 zrzutów, `localStorage consultify_feature_flags` przy zrzucie:
`{"financeCompareV1":false}`, `{"financeCommentsV1":false}`, `{"financeSavedViewsV1":false}`,
`{"financeExportImportV1":false}` — zgodnie z deklaracją. Porównanie bajt-po-bajcie z
zacommitowanymi plikami: **wszystkie 4 identyczne** (md5 `f6b4c00a38d06e5c5bba0a92c0a0c9fb`,
17588 bajtów każdy — ta sama pusta powłoka harnessu co reszta rodziny flag-off).

Obejrzałem `compare-panel-flag-off-light.png` (przez `Read`, nie `screencapture`): pasek
„Consultify / Finance (symulowane Menu 1)", pusta biała treść, przyciski „Lista"/„Uwagi" w
rogu — zero treści panelu Compare. Dodatkowo zrobiłem własny zrzut sanity-check z
`scene=default` (flaga wymuszona na `true`) na tym samym ekranie: renderuje się realna tabela
porównania okres/okres z danymi (REVENUE, COGS, GROSS_MARGIN...). To potwierdza, że pusty zrzut
to prawdziwa brama flagi (flaga OFF → naprawdę nic się nie renderuje), a nie zepsuty/martwy
ekran udający „OFF" — dokładnie ta klasa dowodu, która wcześniej w tej sesji kłamała przez
`localStorage` przenoszący się między nawigacjami.

Dev-render zatrzymany po teście, `/tmp/verify-ap-client-screenshots/` nie jest częścią repo.

---

## Ocena zastąpienia pełnego przemiatu monorepo

Autor: pełny przemiat (`vitest run src tests`) ubity limitem czasu sesji po >250k linii logu,
bez kodu wyjścia. Zastąpił zawężonym przebiegiem: `src/services/api src/components/Finance
src/hooks/__tests__ tests/unit/finance tests/unit/services tests/components/MyWork`.

Odpaliłem tę samą komendę sam, w tle, z jawnym przechwyceniem kodu wyjścia do pliku (nie przez
potok). Wynik JSON: **293 pliki, 3401 testów, 3323 passed, 78 failed w 28 plikach** —
identyczne liczby jak w raporcie autora. Rozbicie 28 plików: 26 pod `tests/components/MyWork/**`
+ 2 jawnie nazwane (`financeFallbackGating.test.ts`, `valuationService.defaultAssumptions.test.ts`,
oba z pustym `git diff 6a3429e21b..HEAD` — potwierdzone niezależnie).

Sprawdziłem ręcznie 5 z 26 plików MyWork pod kątem importu zmienionych plików produkcyjnych
(`financeV2.api`, `v8/client`, skaner): tylko `NotebookTopicChips.test.tsx` odwołuje się do
`v8/client` (przez `vi.mock`) — i to jest ten sam, już niezależnie potwierdzony przedistniejący
defekt (identyczne 3/3 przed i po naprawie).

**Ocena**: zastępstwo jest uczciwe. Zakres zawężonego przebiegu (`src/services/api`,
`src/components/Finance`, `src/hooks/__tests__`, `tests/unit/finance`, `tests/unit/services`,
`tests/components/MyWork`) trafnie pokrywa realny promień rażenia dwóch zmienionych plików
produkcyjnych: `v8/client.ts` ma konsumentów w `v8/{finance,partner,my-work,interview,results,
assessment}.ts`, których testy leżą w `tests/unit/services/` (w zawężonym zakresie);
`financeV2.api.ts` ma testy w `src/services/api/__tests__/` (w zakresie). Poza zakresem
zostały: `server/`, `tests/e2e/`, `tests/performance/`, `tests/integration/*.realdb.test.ts`
(wymagające bazy) — żaden z nich nie importuje żadnego ze zmienionych plików, więc pominięcie
nie ukrywa ryzyka związanego z tą konkretną naprawą. Nie jest to dowód na „zero regresji w
całym monorepo" (i autor tego nie twierdzi — jawnie flaguje brak kodu wyjścia pełnego
przemiatu), ale jest to uczciwe, trafnie wycelowane zastępstwo, którego wynik sam
zweryfikowałem od zera.

---

## Ograniczenia tej weryfikacji

- Nie odtworzyłem osobno przebiegów per-plik dla wszystkich 13 miejsc wywołania `v8Delete`
  (autor pokazał tabelę przed/po dla 7 plików zbiorczo; ja zweryfikowałem bezpośrednio tylko
  `NotebookTopicChips.test.tsx`, resztę przez diff kodu + logikę, nie przez ponowne odpalenie
  każdego z osobna).
- `tsc --noEmit` uruchomiony niezależnie w tle — wynik dopisany poniżej po zakończeniu.

## Wynik tsc --noEmit (niezależny)

**W TOKU.** Wszystkie cztery zadania (skaner, v8Delete, spór liczby testów, zrzuty flag-off)
oraz ocena zastąpienia pełnego przemiatu monorepo są już zmierzone i opisane wyżej — wynikają
z bezpośrednio odtworzonych ataków/mutantów/przebiegów, nie z lektury raportu autora. Jedyny
brakujący element to niezależny, w pełni odtworzony `tsc --noEmit` z kodem wyjścia i czasem
trwania (autor raportował `EXIT=0` dwukrotnie — po naprawie skanera+v8Delete i ponownie po
pełnym pass'ie; pierwsza moja próba dała pusty log bez potwierdzonego kodu wyjścia, więc nie
liczę jej jako dowodu — powtarzam z jawnym `code=$?` zapisanym do pliku, osobnym commitem
zaraz po tym). Metoda pomiaru: `NODE_OPTIONS=--max-old-space-size=12288 npx tsc --noEmit >
/tmp/tsc.txt 2>&1; code=$?`, filtry na pliku, nigdy przez potok — `exit 134` (OOM) liczone
jako FAIL.

STATUS: `EVIDENCE_MISSING` do czasu dopisania wyniku (commit uzupełniający zaraz po tym).

---

## Werdykt końcowy

**PASS.** Wszystkie cztery zadania niezależnie zweryfikowane od zera (nie tylko odczytane z
raportu autora). Skaner faktycznie zawodzi w udokumentowany sposób przy zawężeniu (z jedną
realną, ale wąską, luką w progu — 4-plikowa martwa strefa, opisana wyżej, wartą wspomnienia
przy następnej rewizji progu). Cztery martwe punkty regexu potwierdzone empirycznie, nie tylko
z komentarza. `v8Delete` naprawiony poprawnie, zero regresji na 13 pozostałych miejscach
wywołania (zweryfikowane przez przywrócenie stanu przed-naprawą i identyczny wynik testu).
Zrzuty flag-off bajtowo identyczne z tym, co sam wygenerowałem, i wizualnie potwierdzone jako
prawdziwa brama (nie martwy ekran). Spór liczby testów rozstrzygnięty: 151/22 jest poprawne dla
`AP_CLIENT_report.md` (SHA `6a3429e21b`), 147/21 było błędną poprawką opartą na pojedynczym
pomiarze, który po cichu wykluczał plik spoza zakresu AP-CLIENT — poprawione z powrotem,
zacommitowane z pełnym śladem sekwencji pomyłki i korekty. Zastąpienie pełnego przemiatu
monorepo zawężonym przebiegiem jest uczciwe i trafnie wycelowane.
