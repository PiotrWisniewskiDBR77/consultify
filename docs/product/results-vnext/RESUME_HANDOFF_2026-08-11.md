# Results Next — HANDOFF 2026-08-11

Napisany, bo sesji skończył się budżet, **nie dlatego, że praca stanęła**.
Zastępuje `RESUME_HANDOFF.md` jako punkt wejścia; tamten opisuje stan sprzed
tej doby i zostaje jako historia.

> **Czytaj w tej kolejności**: ten plik → `EXECUTION_LEDGER.md` §54–§56 →
> `RN_G2_OPEN_QUESTIONS_UI.md` (OQ-UI-A…I) → `RN_G3_F0_INTERACTIVE_REVERIFY.md`
> → `RN_G2_UI_SCOPE.md`. Ledger jest autorytatywny; ten plik jest skrótem.

---

## 1. Dokładny stan

| | |
|---|---|
| Worktree | `/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809` |
| Gałąź | `codex/results-vnext-g0-20260809` |
| HEAD | patrz `git rev-parse HEAD` — **NIE ufaj SHA zapisanemu w żadnym dokumencie, sprawdź na żywo** |
| Przed `origin/demo` | ~330 commitów |
| Wypchnięte | **nic, nigdy** |
| Wdrożone | **nic, nigdy** |
| Flagi `kpiRegistry`/`roiRegistry`/`okrRegistry` | **domyślnie OFF**, niepromowane |
| Wysoka woda ledgera | **§56** — `grep '^## ' docs/product/results-vnext/EXECUTION_LEDGER.md` na żywo przed dopisaniem; sesje kolidowały na tym trzy razy |
| Stan programu | **NIE osiągnięto `IMPLEMENTED_EVIDENCED_CANDIDATE`** |

### Brudne drzewo — pięć plików CUDZEJ sesji

```
server/src/database/PostgresDatabase.ts                                   (M)
tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts    (M)
tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts            (M)
tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts (M)
server/migrations/20260810_fix_initiatives_status_default.sql             (??)
```

Nietknięte przez całą tę sesję i **mają takie zostać**. Zero `reset`,
`checkout`, `restore`, `stash`, `clean`, `stage`, `commit`, automatycznego
merge. Nie twórz trzeciej konkurencyjnej naprawy `initiatives.status`.

---

## 2. Co zostało dowiezione w tej dobie

Program przeszedł z **1 pakietu RN-G2** na **~19**, w dwóch falach po kilka
równoległych torów każda.

**Pakiety rejestrów i pod-widoków**: rejestry KPI/ROI/OKR · karty wyników KPI
z własną trasą · tworzenie sprawy ROI + 7 przejść cyklu życia · modelowanie ROI
(baseline, polityka, założenia, linie kosztów i korzyści) · Cele/KR/check-iny
OKR · pomiary KPI (rejestracja, korekta, weryfikacja, spór) · wspólny panel
archiwum legacy (zbudowany, wyeksportowany, **świadomie niepodpięty**).

**Pełne narzędzia klasy L (D03)**:
- **KPI** — `/results/kpi/:kpiId`, 8 sekcji, sprawa odchylenia jako **subwidok**
  (D05) z realnym 9-stanowym automatem i nakładką `escalated` (nigdy 10. stan).
- **ROI** — cztery fazy Build Case → Decision → Realize Value → Learn, ~5600 linii.
- **OKR** — obszar roboczy zestawu (przegląd, cele, dopasowania, rozmowy,
  przegląd i refleksja, historia) + **osobne** powierzchnie Programu i Cyklu.

**Platforma**: powłoka klasy L (`ArtifactBreadcrumb`, bez nowego standardu) ·
**D06 nadpisało decyzję R01** — powód blokady wrócił do UI · dokończone i18n
komponentów wspólnych · Esc + powrót fokusu w podglądzie · wspólny stan
„Teresa niedostępna".

**Naprawy narzędzi pomiarowych** (ważniejsze, niż wygląda):
- `check-gestosc.sh` **mierzył nieprawdę** na macOS — `\s` to rozszerzenie GNU
  awk, BSD awk go nie zna, więc reguły zamykające strefę nigdy nie odpalały i
  licznik sumował Menu 2 z Menu 3. Naprawione i sprawdzone w obie strony.
- Luka fikstur w 18 plikach testowych ROI (brak `organizations` przed
  `initiatives`).
- `dev-render/shot.mjs` raportuje teraz odpowiedzi ≥400 i nie ucina listy
  błędów konsoli.

---

## 3. Dowody, które REALNIE istnieją — i czego nie dowodzą

**Bramki na scalonym HEAD**: `tsc --noEmit` 0 błędów · `vite build` zielony ·
`check-list-canon.sh` dług **408 przy baseline 409 (SPADŁ)** ·
`check-artefakt.sh` 7/7 bez zmian · **~250 zrzutów** w katalogach
`docs/qa/screens/rn-g2-*` i `rn-g3-*` · wszystkie `persistKey` w przestrzeni
`results-vnext.*`, zero kolizji z legacy T36/T37/T38.

**Runda interaktywna (Fala 0)** — `RN_G3_F0_INTERACTIVE_REVERIFY.md`: realny
Playwright, każda zakładka i chip kliknięte, wiersz kliknięty dwukrotnie,
kebab otwierany myszą **i klawiaturą**, ustawienia kolumn przeżyły realne
`page.reload()`, Tab przez 12 przystanków bez pułapki, Esc rozwijał jedną
warstwę naraz z powrotem fokusu. **Zero błędów konsoli i zero odpowiedzi ≥400
na 8 ekranach.**

**Czego to NIE dowodzi — czytaj uważnie:**
- Realny PostgreSQL był używany **tylko** do naprawy fikstur i do dowodu
  zdjęcia maski `initiatives.status`. **Żaden z pakietów UI tej doby nie ma
  własnego dowodu readback na realnej bazie** — wszystkie są klientami
  backendu zamkniętego wcześniej.
- Zrzuty i interakcje pochodzą z harnessu `dev-render` z podstawioną warstwą
  sieciową. **To dowód układu i logiki komponentu, nie dowód endpointu ani
  trwałości.**
- Macierz UI/CX z `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md` (role, widoki,
  wszystkie stany) **nie została przejechana w całości na jednym finalnym SHA**.

---

## 4. Dwa pakiety przyjęte Z WADĄ — zostają w historii jako takie

**To nie jest wygładzone. Oba są zapisane w ledgerze §55/§56 jako przyjęte z wadą.**

1. **Rejestr zestawów OKR** — odebrałem go na zrzutach, a niósł błąd skali:
   `progress` przychodzi jako ułamek 0–1, formater nie mnożył przez 100, a mock
   w harnessie był wykalibrowany na 0–100. **Dwa błędy się znosiły na ekranie.**
   Realne dane pokazałyby „0,6%" zamiast „62,5%". Naprawione.
2. **Karty wyników KPI** — odebrałem je na 21 zrzutach, a niosły złamanie zasad
   hooków (`useMemo` za wczesnym zwrotem), które wywalało ekran przy kliknięciu
   nowej zakładki **na żywej trasie**. Nie zobaczyłem, bo ekran harnessu KPI
   padał wcześniej z innego powodu — **ta zakładka nigdy nie została kliknięta
   na żadnym zaakceptowanym zrzucie**. Naprawione.

**Lekcja do zapamiętania: zrzut dowodzi, że ekran się RENDERUJE, nie że da się
go KLIKAĆ. Przy pakiecie dodającym zakładkę żądaj zrzutu Z TEJ zakładki.**

Trzeci przypadek tej samej rodziny: **siedem `window.prompt`** w kodzie
produkcyjnym (6 w OKR, 1 w KPI). Natywne okno przeglądarki nie ma motywu, nie da
się go zrzucić ani przetestować i wygląda jak awaria. Usunięte, zastąpione
realnymi dialogami. **Twarde kryterium na przyszłość:**
`grep -rn "window\.\(prompt\|confirm\|alert\)(" src/components/ResultsVNext/`
musi zwracać wyłącznie komentarze.

---

## 5. BLOCKERY — przeczytaj przed czymkolwiek innym

### B1 — OQ-UI-I, częściowo domknięty
Pięć z sześciu ekranów harnessu **nie montowało komponentu produkcyjnego**,
tylko drugą implementację ze wspólnej powłoki i prezenterów. To dokładnie
dlatego awaria hooków przeszła odbiór. Tory OKR, ROI-full-tool i ostatni tor
domykający przerobiły większość, **ale konwersja nie została zweryfikowana w
całości ani ponowiona rundą interaktywną**.

**Pierwsze zadanie następcy**: sprawdź KAŻDY `dev-render/screens/results-vnext-*.tsx`,
czy montuje komponent produkcyjny i czy przekazuje **realne `onClose`** (nie
`() => {}`), dokończ konwersję i **powtórz Falę 0 na realnych komponentach**.
Dopóki to nie jest zrobione, dowody interaktywne dla tych ekranów nie są
dowodami o produkcie.

### B2 — D08 nieosiągalne bez zmiany w `server/**`
Powód `not_calculable` **nie jest persystowany ani zwracany** dla Zestawu OKR
(`okrCheckInCommands.ts` — UPDATE pomija `reason`) ani dla check-inu (brak pola
w `okrCheckInTypes.ts`). Dla Celu i Kluczowego Rezultatu **jest**. UI pokazuje
dokładnie to, co przychodzi, i **nie zgaduje** — ale D08 wymaga, żeby API
przenosiło rozróżnienie. To decyzja właściciela: albo zmiana w backendzie, albo
świadome złagodzenie D08.

### B3 — luki API bez obejścia (udokumentowane, nie zasłonięte)
- brak `GET` dla listy **działań korygujących** i **weryfikacji skuteczności**
  sprawy odchylenia KPI (repozytorium ma funkcje, żadna trasa ich nie wystawia);
- brak odwrotnego endpointu `kpi → scorecards`;
- brak trasy dla `listScenarioOverrides` w ROI — nadpisania scenariusza żyją
  wyłącznie w pamięci sesji klienta;
- `cadenceOccurrenceId` (wymagany przy check-inie OKR) i cel dopasowania **nie
  mają punktu odkrycia** — pola wymagają ręcznego wklejenia UUID.
- **żadna komenda sprawy odchylenia KPI poza `approvePlan` nie sprawdza roli
  aktora**; to samo dotyczy `verify`/`dispute`/`correct` pomiaru. UI tego **nie
  zasłania fałszywym wyszarzeniem** — pokazuje realne uprawnienia.

### B4 — `initiatives.status DEFAULT 'step3'` (OQ-UI-E)
Łamie własny CHECK; Postgres sprawdza CHECK **przed** kluczem obcym, więc testy
ROI umierają na `23514`, nie docierając do `23503`. Dowiedzione w izolacji
(gałąź `rn-g2-lane-status`, cherry-pick istniejącego `f99016b632`, realny PG17):
**ROI 129/48/12 → 189/0/0**, sumy zgodne 684=684, kontrola negatywna przeszła,
**zero porażek z przyczyny produktowej w ROI i OKR po zdjęciu maski**.
**Nie scalone** — dotyka `PostgresDatabase.ts` należącego do równoległej sesji.
Oczekiwany konflikt to **jedna linia** (`'step3'` vs `'DRAFT'`).

### B5 — trzy pliki testowe KPI z tą samą luką fikstur
Padają na `initiatives_organization_id_fkey`, ale ich `beforeAll` rzuca własny
wyjątek, więc vitest liczy je jako **3 nieudane pliki, a zawarte testy jako
skipped** — w liczniku wyglądają jak 5 pominiętych, nie jak porażki. Należą do
równoległej sesji. Łatka jest gotowa:
`tests/resultsVnext/roi/roiRealdbOrgFixture.ts` (`ensureRoiFixtureOrganization`).

---

## 6. Praca PRZERWANA w połowie — gałęzie do obejrzenia, NIE do ślepego scalenia

Trzy tory zatrzymałem, gdy skończył się budżet. Ich praca jest zabezpieczona na
gałęziach, **oznaczona jawnie jako WIP i NIE scalona**:

| Gałąź | Co tam jest | Stan |
|---|---|---|
| `rn-g4-lane-teresa` | powierzchnie Teresy (KPI/ROI/OKR), nowy katalog `ResultsVNext/teresa/`, testy | **NIEZWERYFIKOWANE** — bez typechecku, bez kanonów, bez dowodu interaktywnego, bez raportu |
| `rn-g4-lane-crossdomain` | 5 plików `tests/acceptance/rvn-g4-*.e2e.test.ts` (dowody przekrojowe + testy negatywne bezpieczeństwa, w tym D07 utrata dostępu do KPI po migawce) | **NIEURUCHOMIONE** — żaden nie był wykonany na realnym Postgresie, bez kontroli negatywnej. **Nieuruchomiony test nie dowodzi niczego.** |
| `rn-g4-lane-polish` | zadanie 1 (konwersja harnessów) **scalone**; zadania 2 i 3 **nie rozpoczęte** | patrz niżej |

Zadania 2 i 3 z toru domykającego, **do zrobienia**:
- destrukcyjna pozycja kebaba w archiwum legacy jest `disabled`, ale ma pełny
  crimson i wygląda na aktywną (nie zmieniaj koloru pozycji **aktywnej** —
  crimson dla destrukcyjnej to poprawna semantyka);
- surowy `err.message` backendu (angielski) renderuje się wprost w stanie błędu
  na czterech stronach domenowych — wzorzec `err instanceof Error ? err.message : String(err)`.

**Ostrzeżenie**: tor naprawiający `window.prompt` zawiesił się przed
uruchomieniem bramek i wprowadził **8 błędów typów** (użycie zmiennych w
martwej strefie czasowej w `OkrReviewReflectionView.tsx` i `OkrSupportView.tsx`).
Naprawione ręcznie na końcu sesji. **To jest dowód, dlaczego bramki muszą
biegać PRZED scaleniem, nie po.**

---

## 7. Decyzje architektoniczne — obowiązują, nie otwieraj ich ponownie

**D01** kontynuujemy program, bez restartu RN-G2 · **D02** gołe `/results`
zostaje legacy do pełnego cutoveru · **D03** pełne narzędzia to klasa L, żadnych
wielkich edytorów w podglądzie · **D04** na najwyższym poziomie dokładnie trzy
rejestry rodziców, żadnych encji-liści · **D05** sprawy odchyleń KPI to subwidok,
nie osobny rejestr · **D06** akcja zablokowana regułą produktu jest widoczna,
disabled, **z powodem**; powód odmowy bezpieczeństwa **ogólny**, bez ujawniania
istnienia obiektu — **D06 nadpisuje decyzję R01 z 2026-08-06** · **D07** nigdy
nie renderuj nieprzefiltrowanego `snapshot_payload`; do czasu projekcji
przefiltrowanej pod czytelnika — tylko metadane · **D08** postęp i pewność to
dwa odrębne pojęcia, `null` ≠ zero ≠ nieobliczalne · **D09** `persistKey` per
powierzchnia, nie per ID rekordu · **D10** `/attention` to jeden widok
przekrojowy, nie czwarta domena · **D11** flagi OFF do niezależnego odbioru ·
**D12** perspektywy to projekcje tych samych agregatów, nie kopie · **D13**
Teresa proponuje i wykonuje jawnie zaakceptowane komendy, **nigdy nie decyduje
sama** · **D14** brak drobnej decyzji wizualnej nie zatrzymuje programu.

---

## 8. Reguły pracy, które się obroniły

- **Jeden worktree = jeden agent.** Osiem izolowanych worktree w
  `/Users/piotrwisniewski/rn-g2-lanes/*`, `node_modules` przez **dowiązanie
  symboliczne** (bez tego vite umiera po cichu). Zero kolizji przez całą dobę.
- **Tylko JEDEN tor ma prawo do `src/components/standard/**`.** Reszta eskaluje.
- **Weryfikuj bazę worktree** (`git rev-parse HEAD`) przed pierwszą zmianą —
  czterech agentów w historii tego programu wystartowało ze złego commita.
- **Konflikty scalania są zawsze te same trzy pliki i zawsze addytywne**:
  `ResultsVNext/index.ts`, `dev-render/main.tsx`, `src/routes/AppRoutes.tsx`.
  Rozwiązuje się zachowaniem obu stron.
- **`RUN_DB_TESTS=1` ORAZ `NODE_ENV=test`** — samo `NODE_ENV` kieruje zapisy
  `DbPromise` w cichy mock, a `acquirePgClient` w realną bazę.
- **Kontrola negatywna obowiązkowa**: zepsuj asercję, potwierdź czerwień, cofnij.
  W tej sesji wykryła zielony test na nieistniejącej bazie.
- **Mierz trzema stanami** (passed/failed/skipped), nigdy samym licznikiem
  porażek — poprawna naprawa fikstur nie ruszyła licznika przez maskę CHECK.
- **Mock w harnessie musi mieć kształt danych z SERWERA**, nie kształt wygodny
  dla oka.
- Sonnety nie są acceptorami własnej pracy. Opus czyta diff, sprawdza allowlist
  i klika sam przynajmniej jedną rzecz, którą agent mógł pominąć. **Trzy razy w
  tej dobie wyłapało to defekt, którego raport nie zgłaszał.**

---

## 9. Do `IMPLEMENTED_EVIDENCED_CANDIDATE` brakuje

1. Domknięcie **B1** i powtórzenie Fali 0 na realnych komponentach.
2. **Fala 2 — Teresa**: pełna ścieżka dowód → propozycja → podgląd konsekwencji
   → sprawdzenie uprawnień → **akceptacja ALBO odrzucenie** → autoryzowana
   komenda → outbox → konsument → audyt → zimne otwarcie, plus **dowód, że
   ścieżka ręczna działa bez Teresy**.
3. **Fala 3 — dowody przekrojowe** na realnym Postgresie: 8 punktów z toru
   `crossdomain`, w tym testy negatywne bezpieczeństwa i **D07**.
4. **Fala 4 — pełna macierz UI/CX** na jednym finalnym SHA (domeny × poziomy ×
   stany × role × widoki × prezentacja × interakcje).
5. Rozstrzygnięcie **B2** przez właściciela.
6. **Pakiet dowodowy** wg §FINALNY HANDOFF z promptu programu.

**Nie deklaruj `ACCEPTED_*` ani wdrożenia. To należy do Codexa i Właściciela.**
