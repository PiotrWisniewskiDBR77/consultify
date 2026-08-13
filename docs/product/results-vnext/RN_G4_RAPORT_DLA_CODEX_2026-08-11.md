# Results Next — raport dla Codexa, 2026-08-11

Raport z doby pracy orkiestratora nad RN-G2/RN-G3. Napisany po to, żeby dało się
go zweryfikować, a nie żeby przekonał.

**Stan programu: `IMPLEMENTED_EVIDENCED_CANDIDATE` NIE OSIĄGNIĘTY.**
Nic nie wypchnięte, nic nie zmergowane do `demo`, nic nie wdrożone, wszystkie
trzy flagi domenowe domyślnie WYŁĄCZONE.

---

## 1. Zakres i identyfikacja

| | |
|---|---|
| Gałąź | `codex/results-vnext-g0-20260809` |
| Worktree | `.../consultify-results-vnext-g0-20260809` |
| SHA początkowy doby | `0b161c7719` |
| SHA końcowy | sprawdź `git rev-parse HEAD` — **nie ufaj SHA z dokumentu, sprawdź na żywo** |
| Przed `origin/demo` | ~330 commitów |
| Zakres | RN-G2 (warstwa UI) + naprawy narzędzi pomiarowych. Backendy KPI 7/7, ROI 8/8, OKR 8/8 były zamknięte PRZED tą dobą i **nie były w tej sesji zmieniane** |

---

## 2. Co dowiozłem

RN-G2 z **1 pakietu** do **~19**. Pełne narzędzia klasy L dla wszystkich trzech
domen (KPI z subwidokiem spraw odchyleń, ROI w czterech fazach, OKR z osobnymi
powierzchniami Programu i Cyklu), rejestry, pod-widoki pomiarów i modelowania,
panel archiwum legacy, powłoka klasy L, D06 nadpisujące R01.

**Bramki na scalonym HEAD**: `tsc --noEmit` **0 błędów** · `vite build`
**zielony** · `check-list-canon.sh` dług **408 przy baseline 409 — SPADŁ** ·
`check-artefakt.sh` **7/7 bez zmian** · **~250 zrzutów** · wszystkie `persistKey`
w `results-vnext.*` (zero kolizji z żywymi ekranami legacy T36/T37/T38).

**Runda interaktywna** (`RN_G3_F0_INTERACTIVE_REVERIFY.md`): realny Playwright,
8 ekranów, każda zakładka i chip kliknięte, kebab otwierany myszą i klawiaturą,
ustawienia kolumn przeżyły realne przeładowanie, Tab przez 12 przystanków bez
pułapki, Esc rozwijał jedną warstwę naraz z powrotem fokusu. **Zero błędów
konsoli, zero odpowiedzi ≥400.**

---

## 3. Czego te dowody NIE dowodzą — czytaj przed oceną

To jest najważniejsza sekcja tego raportu.

1. **Żaden pakiet UI tej doby nie ma własnego dowodu readback na realnym
   PostgreSQL.** Wszystkie są klientami backendu zamkniętego wcześniej. Realna
   baza była użyta tylko do naprawy fikstur i do dowodu zdjęcia maski
   `initiatives.status`.
2. **Zrzuty i interakcje pochodzą z harnessu `dev-render` z podstawioną warstwą
   sieciową.** To dowód układu i logiki komponentu, **nie** dowód endpointu ani
   trwałości.
3. **Macierz UI/CX z `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` nie została
   przejechana w całości na jednym finalnym SHA** — role, widoki
   (indywidualny/zespół/jednostka/organizacja) i część stanów pozostają
   niesprawdzone.
4. **Teresa (Fala 2) i dowody przekrojowe (Fala 3) NIE zostały wykonane.**
   Praca jest rozpoczęta i zabezpieczona na gałęziach, ale **niezweryfikowana
   i nieuruchomiona** — patrz §6.

---

## 4. Defekty, które sam wprowadziłem albo przepuściłem

**Nie wygładzam tego. Oba pakiety zostają w historii jako przyjęte z wadą.**

| # | Pakiet | Defekt | Jak przeszedł | Stan |
|---|---|---|---|---|
| 1 | Rejestr zestawów OKR | `progress` przychodzi jako ułamek 0–1, formater nie mnożył ×100, **a mock w harnessie był wykalibrowany na 0–100** — dwa błędy znosiły się na ekranie. Realne dane pokazałyby „0,6%" zamiast „62,5%" | odebrałem na zrzutach, które wyglądały poprawnie | naprawione |
| 2 | Karty wyników KPI | `useMemo` za wczesnym zwrotem — kliknięcie nowej zakładki wywalało ekran **na żywej trasie** („Rendered fewer hooks than expected") | odebrałem na 21 zrzutach; **ekran harnessu KPI padał wcześniej z innego powodu, więc ta zakładka nigdy nie została kliknięta** | naprawione |
| 3 | OKR + KPI | **siedem `window.prompt`** w kodzie produkcyjnym | nie sprawdziłem grepem przy pierwszym odbiorze; ogłosiłem pakiet KPI jako czysty i **musiałem tę klasyfikację skorygować** | naprawione, zastąpione realnymi dialogami |
| 4 | tor naprawczy `window.prompt` | zawiesił się przed uruchomieniem bramek i zostawił **8 błędów typów** (martwa strefa czasowa) | wykryte moim typecheckiem po scaleniu | naprawione ręcznie |

**Wniosek metodyczny, który zapisałem w ledgerze**: *zrzut dowodzi, że ekran się
RENDERUJE, nie że da się go KLIKAĆ*. Przy pakiecie dodającym zakładkę trzeba
żądać zrzutu Z TEJ zakładki, po kliknięciu.

---

## 5. Blockery — do decyzji, nie do obejścia

**B1 — OQ-UI-I (częściowo domknięty).** Pięć z sześciu ekranów harnessu
montowało **drugą implementację ekranu**, nie komponent produkcyjny. To dokładnie
dlatego defekt #2 przeszedł odbiór. Większość przerobiona, **ale konwersja nie
została zweryfikowana w całości ani ponowiona rundą interaktywną**. Dopóki to
nie jest zrobione, dowody interaktywne dla tych ekranów nie są dowodami o
produkcie.

**B2 — D08 nieosiągalne bez zmiany w `server/**`.** Powód `not_calculable` nie
jest persystowany ani zwracany dla Zestawu OKR (`okrCheckInCommands.ts` — UPDATE
pomija `reason`) ani dla check-inu (brak pola w `okrCheckInTypes.ts`). Dla Celu
i Kluczowego Rezultatu jest. **UI pokazuje dokładnie to, co przychodzi, i nie
zgaduje.** Decyzja właściciela: zmiana w backendzie albo świadome złagodzenie D08.

**B3 — luki API udokumentowane, nie zasłonięte.** Brak `GET` dla działań
korygujących i weryfikacji skuteczności sprawy odchylenia KPI · brak odwrotnego
`kpi → scorecards` · brak trasy dla `listScenarioOverrides` w ROI (nadpisania
scenariusza żyją tylko w pamięci sesji) · `cadenceOccurrenceId` i cel dopasowania
OKR bez punktu odkrycia (ręczne wklejenie UUID) · **żadna komenda sprawy
odchylenia KPI poza `approvePlan` nie sprawdza roli aktora**, to samo dla
`verify`/`dispute`/`correct` pomiaru — UI **nie zasłania tego fałszywym
wyszarzeniem**.

**B4 — `initiatives.status DEFAULT 'step3'`.** Łamie własny CHECK; Postgres
sprawdza CHECK **przed** kluczem obcym, więc testy ROI umierają na `23514`, nie
docierając do `23503`. Dowiedzione w izolacji (gałąź `rn-g2-lane-status`,
cherry-pick istniejącego `f99016b632`, realny PG17, pełne migracje):

| Domena | Przed | Po zdjęciu maski |
|---|---|---|
| ROI | 129 passed / 48 failed / 12 skipped | **189 / 0 / 0** |
| KPI | 146 / 0 / 5 | bez zmian |
| OKR | 344 / 0 / 0 | bez zmian |

Sumy zgodne w obu pomiarach (684 = 684) — żaden test nie zniknął. Kontrola
negatywna przeszła. **Po zdjęciu maski w ROI i OKR nie zostaje ani jedna porażka
z przyczyny produktowej.** Naprawa **nie scalona**, bo dotyka
`server/src/database/PostgresDatabase.ts` należącego do równoległej sesji.
Oczekiwany konflikt to **jedna linia**.

**B5 — trzy pliki testowe KPI** z tą samą luką fikstur, należące do równoległej
sesji. Ich `beforeAll` rzuca własny wyjątek, więc vitest liczy je jako 3
nieudane pliki, a zawarte testy jako **skipped** — w liczniku wyglądają jak 5
pominiętych, nie jak porażki. Łatka gotowa:
`tests/resultsVnext/roi/roiRealdbOrgFixture.ts`.

---

## 6. Praca przerwana — NIE scalona, oznaczona jawnie

| Gałąź | Zawartość | Dlaczego nie scalona |
|---|---|---|
| `rn-g4-lane-teresa` | powierzchnie Teresy dla trzech domen, `ResultsVNext/teresa/`, testy | **bez typechecku, bez kanonów, bez dowodu interaktywnego, bez raportu** |
| `rn-g4-lane-crossdomain` | 5 plików `tests/acceptance/rvn-g4-*.e2e.test.ts` — dowody przekrojowe, testy negatywne bezpieczeństwa, **D07 (utrata dostępu do KPI po migawce)** | **żaden nie był uruchomiony na realnym Postgresie, bez kontroli negatywnej. Nieuruchomiony test nie dowodzi niczego** |

Oba commity noszą prefiks `WIP(...)` i jawne ostrzeżenie w treści.

---

## 7. Ochrona cudzej pracy

Pięć plików równoległej sesji pozostało **nietkniętych przez całą dobę**:
`server/src/database/PostgresDatabase.ts` · trzy testy
`tests/resultsVnext/kpi/*.realdb.test.ts` (initiativeKpiImpactBaselineFreeze,
kpiIdentityAcrossSurfaces, kpiInitiativeImpactPerspectivesRoutesRealdb) ·
`server/migrations/20260810_fix_initiatives_status_default.sql`.

Zero `reset`/`checkout`/`restore`/`stash`/`clean`/`stage`/`commit`. **Nie
utworzyłem trzeciej konkurencyjnej naprawy `initiatives.status`**, mimo że
miałem dowód, że jej brak kosztuje 48 czerwonych testów.

---

## 8. Naprawione narzędzia pomiarowe

- **`check-gestosc.sh` mierzył nieprawdę na macOS.** `\s` to rozszerzenie GNU
  awk; BSD awk go nie zna, więc reguły zamykające strefę nigdy nie odpalały i
  licznik sumował Menu 2 z Menu 3 („7-8 zakładek" dla hubów z 2 pigułkami i 5
  chipami). Naprawione i sprawdzone **w obie strony**: sztuczny hub z 8
  zakładkami ostrzega, ten sam przycięty do 6 milczy. *Bramka, która odpala na
  poprawnym kodzie, jest gorsza niż jej brak — ludzie uczą się ją przewijać.*
- **Luka fikstur w 18 plikach testowych ROI** (brak `organizations` przed
  `initiatives`).
- **`dev-render/shot.mjs`** raportuje teraz odpowiedzi ≥400 i nie ucina listy
  błędów konsoli — poprzednia runda musiała dopisać to narzędzie, żeby w ogóle
  zobaczyć, czego brakuje.

---

## 9. Co proponuję sprawdzić w pierwszej kolejności

1. **Czy B1 jest realnie domknięty.** `grep -l "ResultsRoiHub\|ResultsOkrHub\|KpiToolPage\|RoiCaseFullTool" dev-render/screens/results-vnext-*.tsx`
   — każdy ekran ma montować komponent produkcyjny i przekazywać realne `onClose`.
2. **Czy nie ma `window.prompt`**: `grep -rn "window\.\(prompt\|confirm\|alert\)(" src/components/ResultsVNext/`
   — powinny zostać wyłącznie komentarze.
3. **Czy flagi są OFF**: `src/components/ResultsVNext/resultsVNextFeatureFlags.ts`,
   rozstrzygnięcie kończy się na `return false`.
4. **Czy `persistKey` nie koliduje z legacy**: żaden nie zaczyna się od
   `results.kpi-scorecards`/`results.roi-reviews`/`results.okr-sets`.
5. **Czy blokady odwzorowują serwer**, a nie własną interpretację — każda ma
   cytat `plik:linia` w komentarzu przy tablicy.

---

## 10. Werdykt

Program jest **istotnie dalej** niż dobę temu i **bliżej** kandydata, ale nim
**nie jest**. Brakuje: domknięcia B1, Fali 2 (Teresa), Fali 3 (dowody
przekrojowe i bezpieczeństwo), pełnej macierzy UI/CX na jednym SHA, decyzji
właściciela w B2 oraz pakietu dowodowego.

Nie deklaruję `ACCEPTED_ACCEPTANCE_ENV`, `ACCEPTED_TERMINAL` ani gotowości
produkcyjnej. Te decyzje należą do Ciebie i do Właściciela.
