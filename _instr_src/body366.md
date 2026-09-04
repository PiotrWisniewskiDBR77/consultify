## Po co ten dyżur istnieje

Trzy niedomknięcia z dwóch odbiorów. Każde małe. Wszystkie realne. I wszystkie trzy mają
jedną wspólną cechę: **dowód, który wygląda jak dowód, a nim nie jest.**

**Zastrzeżenie (1) — dyżur 351.** Licznik kompletności ocen został ujednolicony do jednej
definicji per drzewo i większość miejsc jest broniona mutacją. **Ale dwa miejsca są bronione
asercją na tekście źródła:**

```text
tests/unit/assessment/day351.assessmentCompleteness.test.ts:77-87
  const source = readFileSync(resolve(process.cwd(), 'src/components/assessment/tools/SIRIForm.tsx'), 'utf8');
  expect(source).toContain('Object.values(dimensions).filter(hasAssessmentResponse).length');
  expect(source).not.toContain('(d.current > 0 || d.target > 0)');
```

To jest **ten sam kształt, który dwa razy dziś przepuścił mutację**: test broni napisu
w pliku. Przechodzi po każdej zmianie, która napis zachowa, i nie przechodzi po żadnej,
która go tylko przeformatuje. **Przepisać na asercję zachowania z dowodem mutacyjnym.**

**Zastrzeżenie (2) — dyżur 351.** `progress` na żywej trasie **dalej zwiera się kolumną
`completion_percent` i statusem `APPROVED`** — i to jest **niezmierzone**, bo ziarno dyżuru
351 miało jawnie `completion_percent='0'`:

```text
server/src/routes/assessment/assessment-hub.routes.ts, computeProgressFields
  :84-92   progress liczony z osi:  Math.round((completedAxes / totalAxes) * 100)
  :85-87   ★ ale gałąź `if (completionPercent > 0) progress = completionPercent`
           OMIJA to liczenie w całości
  :94-97   ★ oraz `if (status === 'APPROVED' && progress < 100)` nadpisuje
           progress = 100 ORAZ completedAxes = totalAxes
```

**Zmierzyć obie gałęzie i rozstrzygnąć.**

**Zastrzeżenie (3) — dyżur 355.** Dyżur wniósł **sam raport, zero kodu**: `R3` zatrzymany
merytorycznie, `R4` i `R5` niewykonane. Jego wniosek `R3` („wymaganie pomiarowo fałszywe”)
**obalił odbiorca**, bo zamówiona mutacja trafiła w `validateOrgMembership`
(`server/src/middleware/auth.middleware.ts:1901-1911`) — middleware, którego badane testy
**nie montują**. Prawdziwym strażnikiem jest
`server/src/services/legacyCutover/requireActiveMembership.ts`. Po mutacji **właściwego**
warunku pakiet zachował się tak, jak powinien:

> **GREEN 44/44 → RED 33/11 → GREEN 44/44.**
>
> **Pakiet broni bramki.**

**★★ I druga rzecz, którą zobaczył odbiorca:** przebieg bazowy miał **68** przypadków,
a zmutowany **62**. `financeIntelligence.membershipGate.pg.test.ts` (6 przypadków) **wypadł
między A i B** — i nikt tego nie odnotował. Oba przebiegi były w **100% zielone**. To nie był
pomiar; to były dwa różne pomiary porównane po liczbie.

## ★ Stan zastany, zmierzony przeze mnie na markerze `2a7273e087cbd3e44344725b524f6ddd79d5badc`

| Co | Wartość zmierzona | Gdzie |
| --- | --- | --- |
| asercje na tekście źródła | **2 bloki `it()`** | `day351.assessmentCompleteness.test.ts:77-81` (SIRIForm), `:83-87` (DRDForm) |
| wywołań `hasAssessmentResponse` w produkcie | **11 w 7 plikach** | raport 351 mówi o **9 miejscach** — **mianowniki różne, podaj swój** |
| zwarcie `progress` kolumną | `:85-87` | `completionPercent > 0` omija liczenie z osi |
| zwarcie `progress` statusem | `:94-97` | `APPROVED` ustawia `progress=100` **i** `completedAxes=totalAxes` |
| warunek strażnika członkostwa | **linia 34** (`403` w linii 35) | `legacyCutover/requireActiveMembership.ts` |
| bliźniak, w który chybiła mutacja 355 | `:1901-1911` | `auth.middleware.ts`, `validateOrgMembership` |
| przebieg bazowy 355 | **68 / 68 / 0** w **3** pakietach | `evidence/g15/day355-artefakty/r3-gates-before.json` |
| przebieg zmutowany 355 | **62 / 62 / 0** w **2** pakietach | `evidence/g15/day355-artefakty/r3-gates-mutated.json` |
| czerwienie Finansów po nazwach | **114** wierszy | `evidence/g15/day355/przed-nazwy.txt` (**istnieje — nie odtwarzasz**) |
| kubełki 355 | `403≠X` 59 · `createArtifactViaHttp` 20 · `TypeError` 31 · reszta 4 | raport 355, suma 114 |

**★ Kontekst dla dyżuru 356 — ZROBIONE I ZWERYFIKOWANE, NIE POWTARZASZ:** bezpiecznik
obliczonego dostępu do `import.meta.env` działa, bezpiecznik typów łapie brakujące
`ariaLabel`, rodzina policzona całościowo **109/109 od korzenia** (105 żywych ∧ obliczonych),
wszystkie dowody w repo. **Tego obszaru nie dotykasz i nie mierzysz ponownie.**

## ★ Zmierz moje liczby sam

Twierdzę, na markerze: **2** asercje na tekście źródła; **11** wywołań licznika w **7** plikach
produktu (raport 351 mówi o **9 miejscach**); zwarcie `progress` w **dwóch** gałęziach
(`:85-87` i `:94-97`); warunek strażnika w linii **34**; przebiegi 355 **68/3** kontra **62/2**,
oba w 100% zielone; **114** nazw czerwieni Finansów w pliku, który już jest w repo;
liście słowników **pl 35199**, **en 33066**; cztery bezpieczniki kanonu kończą się kodem **0**.

**Jeśli Twój pomiar przeczy liczbie podanej w tej instrukcji, obowiązuje TWÓJ pomiar —
zapisz rozbieżność wprost.**

## ★★ TABELA LICENCJI — CAŁA ŚCIEŻKA: WALIDATOR · TRASA · KONTROLER · SERWIS · REPOZYTORIUM · TESTY · MACIERZ ODBIORU

Plik spoza tej tabeli traktujesz jako **TYLKO DO ODCZYTU** i produkujesz zamiast zmiany
brief z `plik:linia` oraz diff **nienałożony**. Pozycja z takim produktem jest
**ZROBIONA, nie STOP**.

| Warstwa | Plik / wzorzec | Licencja | Produkt, gdy tylko odczyt |
| --- | --- | --- | --- |
| **Walidator / schematy** | `server/src/schemas/**`, `src/schemas/**` | **TYLKO ODCZYT** | Cytat wiersza + brief |
| **Trasa (montaż)** | `server/src/services/ApiGateway.ts`, `server/src/Gateway.ts`, `server/src/routes/v8/index.ts` | **TYLKO ODCZYT — WOŁASZ, NIE ZMIENIASZ.** Każde „działa” znaczy realne żądanie HTTP z **zapisanym kodem odpowiedzi** | Opis w raporcie |
| **Trasa `assessment-hub` (zwarcie `progress`)** | `server/src/routes/assessment/assessment-hub.routes.ts` | **★ TYLKO ODCZYT W `R2` — MIERZYSZ, NIE ZMIENIASZ.** Gałęzie `:85-87` i `:94-97` obsługują wszystkie oceny w produkcie; jeżeli okażą się defektem, produktem jest **pytanie do właściciela z propozycją jako diff nienałożony** | Brief z `plik:linia` + diff **nienałożony** |
| **Strażnik członkostwa (cel mutacji)** | `server/src/services/legacyCutover/requireActiveMembership.ts` | **★ WĄSKA LICENCJA NA MUTACJĘ TYMCZASOWĄ** w `R3`, z obowiązkowym cofnięciem przez `cp` ze `SCRATCH` (nigdy `git stash`, `Z27`); `git diff` po cofnięciu **pusty**. **Zakaz zostawienia jakiejkolwiek zmiany w commicie i zakaz poszerzenia dopuszczalnych statusów** | — |
| **Pozostałe middleware / model uprawnień** | `server/src/middleware/**` (w tym `auth.middleware.ts`) | **NIETYKALNE DO ZAPISU** (`Z12`). Wolno CZYTAĆ — i musisz, żeby pokazać różnicę wobec właściwego strażnika | Brief |
| **Testy tras / pakiety Finansów** | `server/src/routes/v8/finance-v2/__tests__/**`, `server/src/services/finance/__tests__/**` | **★ WĄSKA LICENCJA POD WARUNKIEM `R3`:** wolno **dopisać seed** wiersza `organization_members` w `beforeAll`, dokładnie w formie skopiowanej z pliku, który dziś jest zielony — jeżeli `R3` wskaże to jako właściwą drogę. **Zakaz zmiany progu, usuwania asercji, zawężania zakresu i zmiany oczekiwanego kodu odpowiedzi** (`Z35`) | — |
| **Pakiety broniące bramki** | `financeValue.membershipGate.pg.test.ts`, `financeIntelligence.membershipGate.pg.test.ts`, `auditsStrictMembership.middleware.test.ts` | **NIETYKALNE DO ZAPISU.** Wolno **uruchamiać** i **musisz** uruchomić PRZED i PO, **razem, w jednym wywołaniu**, z kontrolą mianownika **68 w 3 pakietach** | Wynik do raportu |
| **Kontrakt licznika kompletności** | `tests/unit/assessment/day351.assessmentCompleteness.test.ts` | **★ PEŁNA LICENCJA na przepisanie dwóch bloków `it()` (`:77-87`) na asercję zachowania.** **Zakaz osłabienia pozostałych asercji i zakaz usunięcia którejkolwiek pełnej nazwy** | — |
| **Definicja licznika** | `src/services/assessmentCompleteness.ts`, `server/src/services/report/assessmentCompleteness.ts` | **TYLKO ODCZYT** — jedna definicja per drzewo jest wynikiem 351 i zostaje | Brief |
| **Wołacze licznika** | `src/components/assessment/tools/{SIRIForm,DRDForm}.tsx`, `src/services/drdVizAdapter.ts`, `src/services/report/drdReportModel.ts`, `server/src/services/report/{drdVizAdapter,drdReportModel}.ts` | **★ WĄSKA LICENCJA:** wolno dodać **uchwyt pomiarowy** (`data-testid`/eksport funkcji), jeżeli `R1` udowodni, że asercja zachowania inaczej jest niewykonalna. **Zakaz zmiany logiki liczenia** | Brief z `plik:linia` |
| **Nowe testy** | `tests/**` (nowe pliki, `git add -f`) | **★ PEŁNA LICENCJA.** **Nowe pliki testowe kładziesz w `tests/`, NIGDY pod `src/`** | — |
| **Produkt UI poza licznikiem** | `src/**` | **TYLKO ODCZYT** | Opis w raporcie |
| **Bezpieczniki i konfiguracja testów** | `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**` | **TYLKO ODCZYT — `Z18`, NAJOSTRZEJSZY.** Globalny `vi.mock` strażnika w tych plikach = wygaszenie zabezpieczenia dla całego korpusu | Opis w raporcie |
| **Słowniki** | `public/locales/**` | **NIETYKALNE DO ZAPISU.** Liście nie mogą zmaleć | Opis w raporcie |
| **Dowody 351 / 355 / 356** | `evidence/licznik-kompletnosci-20260904/**`, `evidence/g15/day355*/**` (istniejące pliki), `evidence/g15/day347/**`, dowody 356 | **TYLKO ODCZYT dla istniejących plików.** Do `evidence/g15/day355/` wolno **DOPISAĆ** nowe nazwy (`po-nazwy.txt`, `dlug-po-naprawie.md`) | — |
| **Nowe dowody** | `evidence/g15/day366/**`, `evidence/licznik-kompletnosci-domkniecie-20260904/**` (**oba NIE ISTNIEJĄ — tworzysz**) | **★ PEŁNA LICENCJA**; commitujesz przez `git add -f` | — |
| **Macierz odbioru** | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` | ★★★ **NIETYKALNE DO ZAPISU — ŻADEN wiersz, ŻADEN moduł**, w tym `04_ASSESSMENT` i `10_FINANCE` | Rekomendacja w raporcie |
| **Rejestry bramek** | `REJESTR_G15_SAMOKONTROLA_20260903.md`, `G19_INWENTARZ_OBOWIAZKOW_20260903.md` | **TYLKO ODCZYT** — zajmują się nimi dyżury 359-362 | Rekomendacja w raporcie |
| **Rejestr znalezisk** | `docs/program/REJESTR_ZNALEZISK_20260903.md` | **AKTUALIZACJA** — jedna nowa sekcja o **pierwszej wolnej literze** (`AA`, `AB`, …), sprawdzonej komendą tuż przed commitem | — |
| **Raport dyżuru** | `docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY366_ZASTRZEZENIA_REPORT.md` (**NOWY**) | `R5` — **JEDYNY nowy dokument rejestrowy, jaki wolno Ci utworzyć** (`Z13`) | — |
| **Cudze tereny** | `evidence/g15/day336-artefakty/**` i orzekanie o dziesięciu wierszach `G15` (dyżur 363) · `src/store/useToolStore.ts`, `src/components/DiscoveryTools/**`, `scripts/dev/check-etykiety-dwujezyczne*`, `scripts/dev/i18n-pl-audyt.mjs` (dyżur 364) · `src/components/standard/StandardPreview.tsx`, `src/components/Economics/FinancePreviewPanel.tsx`, `scripts/dev/grafika-zrzuty.mjs`, `evidence/podglad-relations-20260904/**` (dyżur 365) · rodzina `import.meta.env` i `ariaLabel` (dyżur 356 — **zrobione**) · wiersze macierzy i rejestry bramek (dyżury 359-362) | **TYLKO ODCZYT** | Wpis do raportu: plik, linia, problem, rekomendacja jako diff, **nienałożony** |
| **Wszystko inne** | — | **TYLKO ODCZYT** | Opis potrzeby z dowodem `plik:linia` i idziesz dalej |

## ★★ WARUNKI WSPÓLNE SERII

Mierzysz **PRZED pierwszym commitem i PO ostatnim**, obie pary liczb do raportu:

```bash
cd "$WT"
# (a) liscie slownikow NIE MOGA ZMALEC
node -e "const f=require('fs');function c(o){let n=0;const w=v=>{if(v&&typeof v==='object'){for(const k of Object.keys(v))w(v[k]);}else n++;};w(o);return n;}for(const l of ['pl','en'])console.log(l,c(JSON.parse(f.readFileSync('public/locales/'+l+'/translation.json','utf8'))));"
#   moje liczby: pl 35199, en 33066

# (b) cztery bezpieczniki maja konczyc sie kodem 0
bash scripts/check-focus-canon.sh --ci >/dev/null 2>&1; echo "focus-canon=$?"
bash scripts/check-list-canon.sh       >/dev/null 2>&1; echo "list-canon=$?"
bash scripts/check-artefakt.sh         >/dev/null 2>&1; echo "artefakt=$?"
node scripts/dev/reachability-from-root.mjs --check-baseline >/dev/null 2>&1; echo "reach=$?"
#   moje liczby: wszystkie 0
```

**Jeżeli którakolwiek liczba zmaleje albo bramka zaczerwieni się od Twojej zmiany —
naprawiasz KODEM, nigdy progiem i nigdy `--no-verify`** (`Z35`).

## ★★ TABELA MIANOWNIKÓW — każdą liczbę mierzysz sam (`Z24`)

| # | Co liczę | Liczba autora | Komenda | Czy komenda obejmuje badany obiekt? |
| --- | --- | --- | --- | --- |
| 1 | asercji na tekście źródła | `2` bloki `it()` | komenda (1) z `§0.3` | TAK — czyta plik testu, nie raport |
| 2 | wywołań licznika w produkcie | `11` w `7` plikach | komenda (2) | TAK — **raport 351 mówi „9 miejsc”; podaj definicję swojego mianownika** |
| 3 | gałęzi zwierających `progress` | `2` (`:85-87`, `:94-97`) | komenda (3) | TAK — czyta kod trasy |
| 4 | linia warunku strażnika | `34` (`403` w `35`) | komenda (4) | TAK |
| 5 | pliki montujące strażnika | — | komenda (4) | TAK — **to jest dowód, że mutacja ma szansę trafić** |
| 6 | mianownik przebiegów 355 | `68/3` kontra `62/2` | komenda (5) | TAK — **i tu jest defekt pomiaru, nie produktu** |
| 7 | czerwienie Finansów po nazwach | `114` | komenda (6) | TAK — plik istnieje, nie odtwarzasz |
| 8 | kubełki 114 czerwieni | `59/20/31/4` | raport 355 + własny odczyt JSON | TAK — suma ma się zgadzać ze 114, sprawdź jawnie |
| 9 | czerwienie PO zmianie | — | przemiar `R4`, po **nazwach** | TAK — `Z37`: liczba bez nazw nie jest wynikiem |
| 10 | kontrolny `09_RESULTS` | — | przemiar `R4` | TAK — dowód, że nie zgasiłeś naprawy 347 |
| 11 | ZASTANA / REGRESJA dla tego, co zostaje | — | ta sama `fullName` po obu stronach | TAK — **tylko jeżeli baza się skompilowała** |
| 12 | liście słowników PL/EN | `35199` / `33066` | blok (a) „WARUNKÓW WSPÓLNYCH” | TAK |

## ★★ ROZŁĄCZNOŚĆ — pliki do zapisu tego dyżuru

**Zapisujesz NA PEWNO:**
`docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY366_ZASTRZEZENIA_REPORT.md` ·
`evidence/g15/day366/**` · `evidence/licznik-kompletnosci-domkniecie-20260904/**` (oba nowe) ·
`tests/unit/assessment/day351.assessmentCompleteness.test.ts` (przepisane dwa bloki `it()`).

**Zapisujesz WARUNKOWO:**
serwerowe testy `10_FINANCE` (wyłącznie seed w `beforeAll`, z dowodem `R3`) ·
uchwyt pomiarowy w wołaczu licznika (wyłącznie z dowodem `R1`) ·
nowe pliki testowe w `tests/` (`git add -f`) ·
nowe nazwy w `evidence/g15/day355/` (`po-nazwy.txt`, `dlug-po-naprawie.md`) ·
`docs/program/REJESTR_ZNALEZISK_20260903.md` (jedna nowa sekcja).

**JAWNIE NIE ZAPISZESZ:** `public/locales/**`,
`server/src/routes/assessment/assessment-hub.routes.ts`,
`server/src/middleware/**`, `server/src/services/ApiGateway.ts`,
`server/src/services/legacyCutover/requireActiveMembership.ts` (mutacja `R3` jest tymczasowa
i cofnięta), `src/services/assessmentCompleteness.ts`,
`server/src/services/report/assessmentCompleteness.ts`,
pakiety broniące bramki, `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`,
`vitest*.config.ts`, `server/vitest.config*.ts`, `.github/workflows/**`, `server/migrations/**`,
`docs/program/waves/WAVE_03_ACCEPTANCE/modules/*/MODULE_ACCEPTANCE.md` (**wszystkie 16**),
`REJESTR_G15_SAMOKONTROLA_20260903.md`, **istniejące** pliki w
`evidence/licznik-kompletnosci-20260904/`, `evidence/g15/day355*/`, `evidence/g15/day347/`,
`src/store/useToolStore.ts`, `src/components/standard/StandardPreview.tsx`,
`scripts/dev/grafika-zrzuty.mjs`, `scripts/dev/check-etykiety-dwujezyczne*`.

**Kontrola przed KAŻDYM commitem:**

```bash
cd /private/tmp/cx-day366-zastrzezenia
git diff --name-only --cached | tee /private/tmp/cx-day366-zastrzezenia-artefakty/staged.txt
bash -c "grep -iE '^public/locales/|assessment-hub\.routes|^server/src/middleware/|ApiGateway|requireActiveMembership|assessmentCompleteness\.ts|membershipGate|auditsStrictMembership|^tests/setup|^tests/helpers|^tests/__mocks__|vitest.*config|^\.github/|^server/migrations/|MODULE_ACCEPTANCE|REJESTR_G15|useToolStore|StandardPreview|grafika-zrzuty|check-etykiety' /private/tmp/cx-day366-zastrzezenia-artefakty/staged.txt" \
  && echo "★★ NARUSZENIE ROZLACZNOSCI — COFNIJ (git restore --staged)" \
  || echo "rozlacznosc OK"
# ★ osobno: zaden ISTNIEJACY plik dowodowy 347/351/355 nie moze byc zmodyfikowany
git diff --name-status --cached -- evidence/g15/day347 evidence/g15/day355 evidence/g15/day355-artefakty evidence/licznik-kompletnosci-20260904 | grep -v '^A' \
  && echo "★★ NADPISUJESZ CUDZY DOWOD — COFNIJ" || echo "cudze dowody nietkniete"
```

---

## R0 — CZTERY TWARDE ZASADY TEGO DYŻURU (przeczytaj, zanim cokolwiek zrobisz)

**(1) Asercja na ZACHOWANIU, nigdy na tekście źródła.** Nowy test wywołuje funkcję albo
renderuje komponent i sprawdza wynik. `readFileSync` + `toContain` nie jest dowodem — to jest
sprawdzenie, czy ktoś nie przeformatował pliku.

**(2) Mutacja celuje w ZABEZPIECZENIE, nie w mechanizm** (`Z32`). Mutujesz
`requireActiveMembership.ts`, nie `auth.middleware.ts`. Jeżeli mutacja nie czerwieni —
**NAJPIERW** sprawdzasz, czy trafiła w to, co miała trafić, i dopiero potem wolno Ci orzekać.
Dziś dokładnie ten krok został pominięty i obalił wniosek całego dyżuru.

**(3) Mianownik po obu stronach musi być IDENTYCZNY.** Porównujesz **listy pakietów i listy
pełnych nazw**, nie `numFailedTests`. `68 → 62` przy 100% zieleni po obu stronach nie jest
pomiarem.

**(4) Każda zmiana dotykająca członkostwa wymaga PARY dowodów w tym samym commicie:**
**(a)** użytkownik bez wiersza `ACTIVE` w `organization_members` **nadal** dostaje `403`;
**(b)** użytkownik z takim wierszem dostaje `200`/`201`. Jeden bez drugiego jest wygaszeniem
zabezpieczenia, nie naprawą.

**Wymagany dowód:** cztery zdania w raporcie, że przeczytałeś te zasady, plus `git show --stat`
każdego commita. **Bez commita — to jest warunek, nie pozycja.**

## R1 — DWIE ASERCJE NA TEKŚCIE ŹRÓDŁA → ASERCJE ZACHOWANIA (rdzeń)

1. **Pokaż defekt.** Zmutuj `SIRIForm.tsx:143` tak, żeby licznik znów liczył „cel bez
   odpowiedzi” (na przykład wróć do kształtu `(d.current > 0 || d.target > 0)`), **ale zachowaj
   w pliku napis, którego szuka dzisiejszy test** — na przykład w komentarzu albo w martwej
   stałej. **Dzisiejszy test ma pozostać ZIELONY.** To jest dowód, że broni napisu, nie
   zachowania. Zapisz komendę i wynik dosłownie.
2. **Przepisz oba bloki `it()`** (`:77-81` i `:83-87`) na asercję zachowania: wywołaj logikę
   liczenia dla danych `target-only` i dla danych z odpowiedzią, i sprawdź **liczby**, nie
   napisy. Jeżeli logika jest zamknięta w komponencie i nie da się jej wywołać — **wtedy,
   i tylko wtedy**, wolno Ci dodać uchwyt pomiarowy w wołaczu (`data-testid` albo eksport
   czystej funkcji), i piszesz w raporcie, dlaczego było to konieczne.
3. **Powtórz mutację z punktu 1 na NOWYM teście** — ma **zaczerwienić się** i wskazać nazwę
   przypadku; cofnij przez `cp` ze `SCRATCH` → ma **zzielenieć**; `git diff` po cofnięciu
   **pusty**.
4. **Nie osłabiasz reszty pakietu.** Porównaj listy pełnych nazw przed i po: **żadna nazwa
   nie ma zniknąć**, liczba `numTotalTests` nie ma zmaleć.
5. **KROK 0 dla rodziny:** policz wszystkie wołacze `hasAssessmentResponse` w produkcie
   i powiedz, ile z nich ma dziś ochronę **zachowaniem**, ile **napisem**, a ile **żadnej**.
   Moja liczba: **11 wywołań w 7 plikach**; raport 351 mówi o **9 miejscach** —
   **podaj swój mianownik i jego definicję.**

**Wymagany dowód:** dosłowna komenda i wynik mutacji, która przeszła przez STARY test ·
diff przepisanych bloków · mutacja na NOWYM teście w obie strony · `diff` list pełnych nazw ·
tabela rodziny wołaczy z kolumną „ochrona: zachowanie / napis / brak”. **Commit po `R1`.**

## R2 — ZWARCIE `progress`: ZMIERZYĆ I ORZEC (rdzeń)

**Mierzysz. Nie naprawiasz.** Ta trasa obsługuje wszystkie oceny w produkcie.

1. **Postaw kontener** `cx-day366-pg` na porcie `6437`, baza `cx366`, migracje wg `§0.2c` (A) —
   **dwa przebiegi**, drugi bezbłędny i bez zmian (idempotencja). `pgvector/pgvector:pg16`;
   `postgres:15` **nie przechodzi migracji**.
2. **Zasiej TRZY oceny, nie jedną**, i **wypisz w raporcie, co dokładnie posiałeś**
   (to jest ta pułapka, na której stanął 351):
   - (i) `completion_percent = 0`, `status != 'APPROVED'`, 7 z 39 osi wypełnionych;
   - (ii) `completion_percent = 100`, ale **tylko 7 z 39 osi** wypełnionych — gałąź `:85-87`;
   - (iii) `status = 'APPROVED'`, `completion_percent = 0`, **7 z 39 osi** — gałąź `:94-97`.
3. **Uderz w żywą trasę** przez realny `ApiGateway`, z podpisanym JWT, na Twoim PostgreSQL
   po pełnych migracjach, i **zapisz kod odpowiedzi oraz zwrócone `progress`, `completedAxes`,
   `totalAxes`** dla każdej z trzech ocen (`Z34`).
4. **Orzeknij per gałąź**, jednym z trzech werdyktów:
   - `ZGODNE Z INTENCJĄ` — kolumna jest cache'em prawdy i wolno jej wierzyć; uzasadnij czym;
   - `DEFEKT` — trasa pokazuje 100% dla oceny wypełnionej w 18%; **to jest kłamstwo licznika
     dla użytkownika** i idzie do pytania do właściciela z propozycją jako **diff nienałożony**;
   - `NIEORZECZONY` — z podaniem, czego zabrakło.
5. **Sprawdź, kto ustawia `completion_percent`.** Jeżeli kolumnę zapisuje ta sama logika,
   która liczy osie — zwarcie jest nieszkodliwe. Jeżeli zapisuje ją coś innego (import,
   migracja, stary kod) — zwarcie jest realnym ryzykiem. **Podaj `plik:linia` każdego
   zapisu tej kolumny.**
6. **Kontrola mianownika:** `numTotalTests` każdego przebiegu. Przebieg z zerem wykonanych
   przypadków kończy się `exit 0` i **nie jest pomiarem**. `No test files found`
   i `Transform failed` to **BŁĄD KOMENDY**.

**Wymagany dowód:** log obu przebiegów migracji · opis trzech ziaren dosłownie · trzy odpowiedzi
HTTP z kodami i wartościami `progress`/`completedAxes` · werdykt per gałąź · lista `plik:linia`
zapisów `completion_percent`. **Commit po `R2`.**

## R3 — DOKOŃCZENIE `R3` DYŻURU 355: MUTACJA, KTÓRA TRAFIA (rdzeń)

**To jest pozycja, w której dyżur 355 poległ. Przeczytaj ją dwa razy.**

1. **Przebieg BAZOWY.** Uruchom **razem, w jednym wywołaniu**, na realnym PostgreSQL:
   `server/src/routes/v8/__tests__/financeValue.membershipGate.pg.test.ts`,
   `server/src/routes/v8/__tests__/financeIntelligence.membershipGate.pg.test.ts`,
   `server/src/middleware/__tests__/auditsStrictMembership.middleware.test.ts`.
   **Zapisz `numTotalTests`, listę pakietów i listę pełnych nazw.** Wartość wzorcowa:
   **68 przypadków w 3 pakietach**. **Jeżeli Twój przebieg da mniej pakietów — zatrzymujesz
   się tutaj**, zanim cokolwiek zmutujesz, i piszesz dlaczego.
2. **Mutacja celująca w strażnika.** W `server/src/services/legacyCutover/requireActiveMembership.ts`
   zmień warunek statusu (linia **34** — potwierdź numer sam) tak, żeby zabezpieczenie
   przestało odrzucać. **Cel: obcy PRZESTAJE dostawać `403`.**
3. **Przebieg ZMUTOWANY — tym samym wywołaniem, bez zmiany zakresu.** Porównaj **listę
   pakietów i listę nazw**. Oczekiwany kształt: **RED, z tym samym mianownikiem 68 w 3
   pakietach**. Wynik zmierzony przez odbiorcę na samym `financeValue.membershipGate`:
   **GREEN 44/44 → RED 33/11 → GREEN 44/44**.
4. **Cofnięcie przez `cp`** ze `SCRATCH`; `git diff` po cofnięciu **pusty**; przebieg końcowy
   **zielony, z tym samym mianownikiem**.
5. **Drugi strażnik rodziny.** `requireFinanceEditorMembership` mieszka w tym samym pliku
   i ma dodatkowy warunek roli. **Powiedz, czy Twoja mutacja go obejmowała** — praca
   per wywołanie zamiast per rodzina daje „poprawne w 2 z 3”.
6. **JEDNA zmiana, uzasadniona.** Dopiero po udowodnionej mutacji wybierasz drogę i wypisujesz,
   co odrzuciłeś i dlaczego:
   - **(A)** seed wiersza `organization_members` w `beforeAll` pakietów, które są kontraktami
     HTTP — w formie skopiowanej z pliku, który dziś jest zielony;
   - **(B)** wspólny pomocnik seedujący — **tylko jeżeli forma jest identyczna we wszystkich
     plikach**, co masz wykazać;
   - **(C)** zgłoszenie REALNEGO DEFEKTU jako briefu z diffem **nienałożonym**, bez zmiany
     kodu produktu;
   - **(D)** cokolwiek innego, co pomiar wskaże.
7. **Para dowodów, obowiązkowa, w tym samym commicie:** **(a)** obcy bez wiersza `ACTIVE`
   **nadal** `403` — na realnym PostgreSQL; **(b)** właściciel z wierszem `ACTIVE` dostaje
   `200`/`201` — realne żądanie HTTP przez realny `ApiGateway`, z podpisanym JWT,
   **z zapisanym kodem odpowiedzi** (`Z34`).
   ★ Uwaga na FK: sam `INSERT organization_members` bez użytkownika zatrzymuje `beforeAll`
   na `organization_members_user_id_fkey` i wszystkie przypadki lecą jako `skipped` —
   dyżur 355 to zmierzył; siej **użytkownika i członkostwo**.

**Wymagany dowód:** dwa JSON-y (bazowy i zmutowany) z `numTotalTests` i listą pakietów ·
`diff` list pełnych nazw · dosłowna komenda mutacji i cofnięcia · `git diff` pusty ·
JSON końcowy zielony · zdanie o drugim strażniku · opis wybranej drogi z odrzuceniem
pozostałych · para „obcy `403` / właściciel `200`” z kodami. **Commit po `R3`.**

## R4 — PRZEMIAR FINANSÓW PO NAZWACH I KONTROLNY PRZELOT RESULTS

1. Uruchom **cały** `10_FINANCE` tym samym wariantem, którym mierzył dyżur 336 (poza świadomie
   zmienionym elementem z `R3`), `--retry=0 --reporter=json`.
2. **Kontrolnie uruchom `09_RESULTS`** — dowód, że nie zgasiłeś tego, co naprawił dyżur 347
   (413 → 12 czerwieni).
3. Zapisz `evidence/g15/day355/po-nazwy.txt` (**nowa nazwa — nie nadpisujesz
   `przed-nazwy.txt` ani `po347-nazwy.txt`**) i zrób
   `diff evidence/g15/day355/przed-nazwy.txt evidence/g15/day355/po-nazwy.txt`.
4. **Tabela główna:** trzy kolumny — **nazwy, które zniknęły**, **nazwy, które zostały**,
   **nazwy, które się POJAWIŁY** (każda pojawiona wymaga wyjaśnienia albo STOP-u).
5. **Podaj `numTotalTests`, nie tylko `numFailedTests`.**
6. **ZASTANA kontra REGRESJA dla tego, co zostaje.** Worktree bazowy w
   `/private/tmp/cx-day366-zastrzezenia-artefakty/baza` (POZA repo, `Z13`). **Zanim cokolwiek
   uruchomisz — udowodnij, że baza się kompiluje** (`npx esbuild` na mierzonych plikach);
   `Transform failed` jest błędem komendy, nie wynikiem; baza, na której plik wykonał zero
   przypadków, **nie jest bazą**. Skasuj worktree po pomiarze; `df -h /` przed i po.

**Wymagany dowód:** `po-nazwy.txt` · pełny `diff` · tabela trzech kolumn · `numTotalTests`
każdego przebiegu · wynik kontrolny `09_RESULTS` · dowód kompilowalności bazy · `df -h /`
przed i po · potwierdzenie skasowania worktree. **Commit po `R4`.**

## R5 — JAWNA LICZBA, RAPORT I PYTANIA DO WŁAŚCICIELA

Raport zawiera: dowód, że stary test przepuszczał mutację, i diff przepisanych asercji z `R1` ·
werdykt per gałąź zwarcia `progress` z `R2`, z trzema odpowiedziami HTTP · mutację z `R3`
w obie strony **z mianownikiem po obu stronach** · opis JEDNEJ zmiany z uzasadnieniem
odrzucenia pozostałych dróg · parę „obcy `403` / właściciel `200`” · tabelę „przed / po”
po nazwach z `R4` · listę rozbieżności wobec liczb tej instrukcji · **niepustą sekcję
„TWIERDZENIA NIEZWERYFIKOWANE”** · obowiązkowy akapit `§0.2e` dla każdego uruchomionego pakietu.

★★ **Osobna, obowiązkowa sekcja: „JAWNA LICZBA — ARTEFAKT KONTRA REALNY DEFEKT”.**
„Ze 114 czerwieni Finansów zniknęło N, zostaje M, z czego K to realne defekty produktu
wymagające osobnego dyżuru — i oto ich nazwy.” **Bez listy nazw to nie jest wynik** (`Z37`).
Jeżeli Twój pomiar potwierdzi wniosek 355 (114 artefakt / 0 defekt) — napisz to wprost
**wraz z dowodem mutacyjnym, którego 355 nie miał**. Jeżeli obali — tym lepiej.

★★ **Osobna, obowiązkowa sekcja: „CO NADAL WYMAGA OSOBNEGO ZLECENIA”.** Każdy plik
sklasyfikowany jako REALNY DEFEKT z nazwy, z liczbą czerwieni i jednozdaniowym opisem, czego
brakuje w produkcie. Tu trafia też luka dowodowa nazwana przez 355: samowystarczalny kontrakt
przez realny `ApiGateway`, który broni zarówno braku wiersza, jak i statusu `REVOKED`,
oraz odtwarzalna fikstura dla `day116-approved-valuation-wacc-conflict.realpg.test.ts`.

★★ **Osobna, obowiązkowa sekcja: „PYTANIA DO WŁAŚCICIELA”.** Pierwsze pytanie jest znane
z `R2`: czy `progress` ma wierzyć kolumnie `completion_percent` i statusowi `APPROVED`
wbrew policzonym osiom — **tak/nie**. Drugie, jeżeli je zobaczysz, z `R3`. Sekcja **nie może
być pusta** — pytanie z `R2` jest w niej obowiązkowo.

★ Zanim dopiszesz cokolwiek do jakiegokolwiek dokumentu, sprawdź, czy nie jest GENEROWANY:
`bash -c "grep -rl '<nazwa-pliku>' scripts/"`. Sekcję w `REJESTR_ZNALEZISK_20260903.md`
dopisujesz o **pierwszej wolnej literze** — sekcje doszły dziś do `Z`, więc następne idą
`AA`, `AB`, …; sprawdź komendą
`bash -c "grep -nE '^## [A-Z]+\.' docs/program/REJESTR_ZNALEZISK_20260903.md | tail -3"`
**tuż przed commitem**, bo równolegle piszą inni autorzy.

**Commit po `R5`.**

## Próg odbioru

**Trzy zastrzeżenia domknięte: dwie asercje przepisane na zachowanie z dowodem, że stary test
przepuszczał mutację; dwie gałęzie zwarcia `progress` zmierzone na żywej trasie i orzeczone;
`R3`–`R5` dyżuru 355 dokończone z mutacją, która TRAFIA w `requireActiveMembership.ts`,
przy mianowniku identycznym po obu stronach — i z jawną liczbą ARTEFAKT/REALNY DEFEKT
podaną z nazwami.**

Odbiorca odrzuci dyżur, w którym: nowy test nadal sprawdza tekst źródła; mutacja nie
zaczerwieniła i nie sprawdzono, czy trafiła; przebiegi bazowy i zmutowany mają różną liczbę
pakietów; zmieniono zachowanie trasy `assessment-hub` zamiast je zmierzyć; porównanie jest
po liczbach zamiast po nazwach; albo zmienił się stan choćby jednego wiersza macierzy odbioru.

## Prawo zatrzymania

Zatrzymujesz się **po każdej pozycji `R`**, z commitem. Zdanie: „dwie asercje przepisane
i udowodnione mutacyjnie, zwarcie `progress` zmierzone i orzeczone jako defekt, `R3`
zatrzymany, bo wymaga decyzji właściciela o drodze naprawy” — **jest pełnowartościowym
wynikiem**, nawet jeżeli ani jedna czerwień Finansów nie zgaśnie.

## ★ Wznowienie dyżuru zatrzymanego warunkiem startu

Jeżeli ten dyżur stanął na warunku wejściowym i wracasz do niego później: **sprawdzasz
warunek NA BIEŻĄCEJ LINII, nie ponownie na starym markerze i nie na zapamiętanym wyniku.**
Wynik ponownego sprawdzenia wklejasz do raportu z datą i godziną.

## AUDYT SPRZECZNOŚCI

| Para wymagań, która mogłaby się wykluczać | Gdzie rozstrzygnięta |
| --- | --- |
| „Przepisz test na zachowanie” vs „nie zmieniaj logiki produktu” | `R1` punkt 2: uchwyt pomiarowy wolno dodać **tylko** gdy asercja zachowania inaczej jest niewykonalna, i piszesz dlaczego; logika liczenia zostaje |
| „Zmierz zwarcie `progress`” vs „trasa jest nietykalna” | Tabela licencji i `R2`: **mierzysz przez HTTP, nie zmieniasz kodu**; propozycja idzie jako diff nienałożony i pytanie do właściciela |
| „Strażnik nietykalny (`Z12`)” vs „zmutuj strażnika” | Tabela licencji: wąska licencja na mutację TYMCZASOWĄ z obowiązkowym cofnięciem przez `cp` i pustym `git diff`; `auth.middleware.ts` zostaje nietykalny |
| „Napraw 114 czerwieni” vs „zakaz wygaszania bramki” | `R0` (4) i `R3` punkt 7: naprawa wymaga PARY dowodów — obcy nadal `403`, właściciel `200` |
| „Mutacja ma zaczerwienić” vs „a jeśli nie zaczerwieni” | `R0` (2) i `R3`: najpierw sprawdzasz, czy trafiła; dopiero potem orzekasz. Obalenie jest wynikiem, ale **po** sprawdzeniu celu |
| „Uruchom pakiety bramkowe” vs „są nietykalne” | Tabela licencji: nietykalne **do zapisu**; uruchamianie jest jawnie zamówione i obowiązkowe przed i po |
| „Zmierz spadek” vs `Z37` | `R4` punkty 3-4: `po-nazwy.txt` i `diff` wobec istniejącego `przed-nazwy.txt`; produktem jest lista nazw |
| „Dopisz do `evidence/g15/day355/`” vs „cudze dowody są nietykalne” | Sekcja o dokumentach i kontrola commita: **dopisujesz nowe nazwy**, nie modyfikujesz istniejących; kontrola `git diff --name-status` to wymusza |
| „Worktree bazowy ułatwia dowód” vs `Z13` i próg 5 GB | `R4` punkt 6: worktree bazowy leży **poza repo**, jest kasowany po pomiarze, `df -h /` przed i po |
| „351 mówi 9 miejsc” vs „mój pomiar daje 11 wywołań” | Mianownik #2 i `R1` punkt 5: podajesz swój mianownik **i jego definicję**; rozbieżność zapisujesz wprost |
| „Aktualizuj macierz i rejestr G15” vs „oba nietykalne” | Tabela licencji: bramkami zajmują się dyżury 359-362; Twoim produktem jest rekomendacja |
| „Dopisz sekcję do rejestru znalezisk” vs „równolegle piszą inni autorzy” | `R5`: literę sprawdzasz komendą tuż przed commitem; sekcje doszły do `Z`, następne to `AA`, `AB` |

## AUDYT WYKONANY PRZEZ AUTORA (CZĘŚĆ C listy kontrolnej)

| # | Punkt | Wynik |
| --- | --- | --- |
| 1 | Audyt sprzeczności — pary wymagań rozstrzygnięte w treści | TAK — tabela wyżej, 12 par |
| 2 | Każda ścieżka istnieje na markerze albo jest jawnie oznaczona | TAK — `day351.assessmentCompleteness.test.ts:77-87`, `assessment-hub.routes.ts:84-97`, `requireActiveMembership.ts:34-35`, `auth.middleware.ts:1901-1911`, trzy pakiety bramkowe, `evidence/g15/day355/przed-nazwy.txt` (114 wierszy), `evidence/licznik-kompletnosci-20260904/` (4 pliki) sprawdzone; `evidence/g15/day366/` i `evidence/licznik-kompletnosci-domkniecie-20260904/` **jawnie oznaczone jako nieistniejące** |
| 3 | Każda liczba ma odtwarzalną komendę, uruchomioną przez autora | TAK — tabela mianowników, 12 wierszy; wiersze 1-8 i 12 zmierzone przy wydaniu na markerze |
| 4 | Tabela licencji kompletna — cała ścieżka, trzecia kolumna nigdy nie brzmi samo „STOP” | TAK — walidator · montaż · trasa `assessment-hub` · strażnik · pozostałe middleware · testy tras Finansów · pakiety bramkowe · kontrakt licznika · definicja licznika · wołacze licznika · nowe testy · UI · infrastruktura testów · słowniki · dowody 351/355/356 · nowe dowody · macierz · rejestry bramek · rejestr znalezisk · raport · cudze tereny |
| 5 | Wykonalność per pozycja bez plików przekrojowych | TAK — `R1` dotyka jednego pliku testu, `R2` tylko mierzy, `R3` mutuje jeden warunek, `R4` mierzy, `R5` składa |
| 6 | Zasoby wyłączne sprawdzone wobec dyżurów równoległych | TAK — 6437/5577 wolne (`lsof` przy wydaniu), brak kontenera `cx-day366-pg`, brak gałęzi `codex/day366-*` i worktree; 363/364/365 mają rozłączne porty i pliki; paczka 359-362 ma zarezerwowany przedział 6430-6433/5570-5573 i rozłączny temat |
| 7 | Komendy paste-ready | TAK — blok `§0.3` uruchomiony w całości na worktree z markera |
| 8 | Pułapki środowiska wklejone w całości + właściwe temu dyżurowi | TAK — `§0.2d` w komplecie; pułapki właściwe: test broni napisu, ziarno przesądza wynik, bliźniaczy strażnik, zmiana mianownika w zieleni, atrapa bazy, `NODE_ENV=test` bez `RUN_DB_TESTS`, `grep --include` w `zsh` |
| 9 | Samodzielność dokumentu | TAK — zero odwołań do rozmów; każdy kontekst ma ścieżkę w repo albo komendę |
| 10 | Klauzula sprzeczności obecna, `§0.5` z tabelą „STOP proceduralny zakazany”, zero pól szablonu | TAK — kontrola generatora przy wydaniu |
