# RN-G6 UI-FIX — raport wykonania

**Worktree**: `/Users/piotrwisniewski/rn-g2-lanes/g6-uifix`, gałąź `rn-g6-uifix`.
**HEAD startowy**: `c5852ace32` (`docs(rn-g6): checkpoint handoff + manifest zmienionych plikow`).
**HEAD końcowy**: `28330ba265` (`feat(results-vnext): close 3 KPI-tool data gaps (RN-G6 task 3)`).
**Commity tej sesji** (3, wszystkie na `rn-g6-uifix`, NIE pushowane):

```
684888f162 fix(results-vnext): flag survives in-app navigation (RN-G6 task 1)
1c4a8807b1 feat(results-vnext): wire CreateKpiScorecardModal (RN-G6 task 2)
28330ba265 feat(results-vnext): close 3 KPI-tool data gaps (RN-G6 task 3)
```

`git status --short` na koniec sesji: tylko `docs/qa/screens/rn-g6-uifix/` (zrzuty, ten
raport) — bez niezacommitowanych zmian kodu.

**Środowisko runtime użyte**: PostgreSQL 17.9 na `:55821` (dzielony z innymi torami,
NIE dotknięty), backend **ponownie użyty** z istniejącego procesu na `:3097`
(gałąź `rn-g6-testdrive` @ `3ad73a98d3` — zweryfikowane `git diff --stat` między
`c5852ace32` a `3ad73a98d3`: różnica to WYŁĄCZNIE pliki dok./zrzuty, zero różnicy w
`src/`/`server/`, więc backend jest kodowo identyczny na potrzeby tej pracy).
Frontend uruchomiony **własny**, z tego worktree, na `:3199` (port `:3197` z runbooka
był już zajęty przez inny tor — `:3198` też zajęty przez `g6-roi` — `:3199` był wolny;
`VITE_API_TARGET=http://127.0.0.1:3097`). Uzasadnienie: `navigate()`/query-string bug
trzeba było obserwować na REALNYCH edycjach tego worktree — frontend z cudzego katalogu
nigdy by ich nie pokazał.

---

## ZADANIE 1 — nawigacja gubi flagę domenową

**Przyczyna (nie objaw)**: `navigate(ROUTES.RESULTS_KPI.TOOL.replace(':kpiId', kpiId))`
w `ResultsKpiRegistryPage.tsx` (i analogiczne wywołania w `kpiTool/**`,
`kpiScorecards/**`) budują GOŁĄ ścieżkę (`/results/kpi/:kpiId`) i NIGDY nie doklejają
bieżącego `location.search`. Po kliknięciu „Open" `window.location.search` staje się
puste, więc `readQuery()` w `resultsVNextFeatureFlags.ts` zwraca `null` dla tego
odczytu — flaga spada na `localStorage` (puste) → `env` (puste) → domyślne `false`.
To NIE jest błąd kolejności rozstrzygania (query→localStorage→env→default działała
poprawnie) — to utrata samego query stringa przy nawigacji.

**Wybrane rozwiązanie**: `isResultsVNextFlagEnabled()` (`resultsVNextFeatureFlags.ts`)
teraz zapisuje EXPLICITNĄ wartość z query do `localStorage` w momencie jej odczytu
(nowa funkcja `writeLocalStorage`). Ponieważ `localStorage` jest już 2. w istniejącej
kolejności rozstrzygania, każdy kolejny odczyt w tej samej sesji — również ten po
`navigate()`, który zgubił query — trafia na `localStorage` z tą samą wartością.

**Uzasadnienie wyboru** (nad alternatywą „przenoszenie parametru przy nawigacji"):
1. Jeden punkt prawdy — plik `resultsVNextFeatureFlags.ts` jest explicite nazwany w
   briefie zadania jako miejsce z kolejnością rozstrzygania; naprawa tam jest
   najmniejsza, DRY i naprawia problem dla WSZYSTKICH trzech domen (kpi/roi/okr)
   naraz, bez dotykania ~10 wywołań `navigate()` rozsianych po plikach `roi/**`/
   `okr/**`, które są poza moim podziałem pracy.
2. Zero zmiany domyślnych wartości — bez query/localStorage/env flaga nadal `false`
   wszędzie (test `never changes the DEFAULT`).
3. Trwałość jest ZAWSZE wynikiem JAWNEGO wyboru z adresu (użytkownik musiał wpisać
   `?ff_x=1` raz) — nigdy nie włącza się sama.
4. Plik `resultsVNextFeatureFlags.ts` nie jest w dosłownej allowlist (allowlist
   wymienia `ResultsKpiRegistryPage.tsx`/`kpiScorecards/**`/`kpiTool/**`/`index.ts`) —
   ale to jedyny plik implementujący kolejność rozstrzygania, którą brief każe czytać
   i naprawić; nie należy do toru `roi/**`/`okr/**` ani do żadnego zakazanego obszaru
   (`server/`, `standard/`, `shared/`). Odstępstwo świadome, analogiczne do decyzji
   podjętej dla zadania 3.2 (patrz niżej) — zgłaszam wprost.

**Dowód PRZED/PO — realne kliknięcia**:
- `docs/qa/screens/rn-g6-uifix/task1-before-not-yet-enabled.dark.pl.1440.png` —
  `/results/kpi` bez query → „Rejestr KPI — jeszcze nie włączony".
- `docs/qa/screens/rn-g6-uifix/task1-registry-flag-on.dark.pl.1440.png` —
  `/results/kpi?ff_resultsVNextKpi=1` → rejestr renderuje się, zakładka „Organizacja".
- Kliknięto wiersz `KPI-A-001` → panel podglądu → kliknięto „Otwórz".
- `docs/qa/screens/rn-g6-uifix/task1-after-open-flag-survives.dark.pl.1440.png` —
  URL po kliknięciu: `http://127.0.0.1:3199/results/kpi/4d5db4f2-…` (BEZ query —
  potwierdzone `page.url()`, zapisane też w
  `docs/qa/screens/rn-g6-uifix/task1-url-after-open.txt`) — a mimo to renderuje się
  PEŁNE narzędzie KPI (Wyniki/Kontrakt/Pomiary/…), nie „not yet enabled".
- Zweryfikowano bezpośrednio: `localStorage.getItem('ff.results_vnext_kpi_registry')
  === '1'` na tym ekranie.

**Kontrola negatywna #1 (żywa aplikacja, `git stash`)**: wycofano poprawkę
(`git stash push --keep-index -- resultsVNextFeatureFlags.ts`), wyczyszczono
`localStorage`, powtórzono dokładnie tę samą sekwencję kliknięć (rejestr →
`?ff_resultsVNextKpi=1` → Organizacja → wiersz KPI-A-001 → Otwórz) → REALNIE
wylądowano na „KPI tool — not yet enabled" (zrzut zrobiony, potem nadpisany kolejną
iteracją — treść potwierdzona wizualnie w trakcie sesji: nagłówek „KPI tool — not yet
enabled", opis „This screen is still being built..."). `git stash pop` przywrócił
poprawkę, ta sama sekwencja ponownie wylądowała na treści narzędzia.

**Testy + kontrola negatywna #1 (automatyczna)**:
`tests/resultsVnext/resultsVNextFeatureFlags.navigationPersist.test.ts` (nowy plik,
7 testów) — symuluje dokładnie tę sekwencję przez `window.location.search`/
`window.localStorage` (bez routera). Uruchomiono z poprawką (7/7 zielone), wycofano
poprawkę przez `git stash` (2/7 czerwone — dokładnie te asercje, które sprawdzają
przetrwanie nawigacji), przywrócono (7/7 zielone ponownie).

**Konsola / sieć**: na ekranie „po" (task1-after-open) — 0 nowych błędów sieci
związanych z tą zmianą; `GET /api/vnext/results/kpi/…/version` → 200. Tło sesji ma
powtarzalne, NIEZWIĄZANE 401 (`/api/v10/teresa/voice-config` przed pełną hydratacją
auth) i kilka 404 (favicon-podobne) na KAŻDYM cold-loadzie tej aplikacji, niezależnie
od moich zmian — potwierdzone przez identyczny wzorzec przed jakąkolwiek edycją.

---

## ZADANIE 2 — wpięcie trzech gotowych elementów

**1. `CreateKpiScorecardModal`** — WPIĘTY. Plik `CreateKpiScorecardModal.tsx` dodany
(pola: nazwa*/opis/zakres*/id zakresu/częstotliwość przeglądu*/wrażliwość/notatka,
informacyjna linia „Właściciel"), primaryCta „Nowa karta wyników" dodane do
`moduleBar` gałęzi `tab === 'scorecards'` w `ResultsKpiRegistryPage.tsx`, export
dodany w `index.ts`.
Dowód na żywo: wypełniono formularz („RN-G6 UI fix probe scorecard"), kliknięto
„Utwórz kartę wyników" → **`POST /api/vnext/results/kpi/scorecards` → 201 Created**,
nowa karta typu Draft pojawiła się natychmiast w tabeli i w panelu podglądu
(`docs/qa/screens/rn-g6-uifix/task2-create-scorecard-modal.dark.pl.1440.png`,
`task2-scorecards-tab-new-cta.dark.pl.1440.png` +
`task2-scorecards-tab-new-cta.light.pl.1280.png`). **Rekord testowy usunięty**
bezpośrednio po weryfikacji (`DELETE FROM rvn_kpi_scorecards WHERE scorecard_id =
'dd0478a4-f6db-4dc2-8a41-cc6de9644284'`).

**2. `RoiPirOutcomesTab`** — NIE wpięty (hub ROI poza moim torem, zgodnie z
instrukcją). Zweryfikowano, że działa pod własną trasą:
`GET http://127.0.0.1:3199/results/roi/pir-outcomes?ff_resultsVNextRoi=1` →
`GET /api/vnext/results/roi/org/pir-outcomes` → **200**, 2 realne wiersze
wyrenderowane (widoczne w sesji przeglądarki). Miejsce wpięcia (dla toru ROI) już
udokumentowane w `docs/product/results-vnext/RN_G5_SCOPEGAP_DESIGN.md` §3:
`ResultsRoiHub.tsx` L91 (poszerzyć `RoiTab`), L374-377 (dodać tab „PIR outcomes"),
L420 (gałąź `if (tab === 'pir-outcomes')`) — gotowy diff, nieaplikowany, zgodnie z
instrukcją nie ruszałem tego pliku.

**3. Programy/Cykle OKR** — potwierdzone: JUŻ SĄ wpięte przez tor OKR.
`ResultsOkrHub.tsx` L267-294 ma `adminLinksCta` (przyciski „Programy"/„Cykle",
`navigate(ROUTES.RESULTS_OKR.PROGRAMS)`/`.CYCLES`), podpięte przez
`primaryCtaContent: adminLinksCta` w L414. Zweryfikowano NA ŻYWO:
`docs/qa/screens/rn-g6-uifix/task2-okr-programs-cycles-no-dup.dark.pl.1440.png` —
dokładnie JEDEN przycisk „Programs" i JEDEN „Cycles" w prawym górnym rogu, zero
duplikatu. **Nic nie zrobiono** (zgodnie z instrukcją „jeśli są — nic nie rób, tylko
potwierdź").

---

## ZADANIE 3 — braki w pełnym narzędziu KPI

**1. Zakładka Kontrakt bez danych definicji** — NAPRAWIONE.
`KpiToolPage.tsx`: nowy stan `definitionVersion` (`KpiDefinitionVersionDto | null |
'loading'`), nowy `useEffect` wołający `getKpiCurrentDefinitionVersion(kpiId)`
(`GET /kpi/:kpiId/version`, P0-D — już istniejący na tym SHA, wcześniej używany
tylko w `ResultsKpiRegistryPage.tsx` do `knownVersions`, NIGDY w `KpiToolPage.tsx`).
Sekcja Kontrakt renderuje teraz: nazwa, opis, jednostka, geometria celu (etykieta
PL/EN przez nowy `kpiTargetGeometryLabel`), granice specyficzne dla geometrii (przez
`HonestValueCell` — `null` → „—", nigdy fabrykowane `0`), status zatwierdzenia
(`kpiApprovalStatusLabel` + `KPI_APPROVAL_STATUS_TONE`, nowe w `kpiToolMappers.ts`),
numer wersji. Gap-notice pokazuje się TYLKO przy `'loading'` lub gdy odczyt faktycznie
zwróci `null` (D06-generic, ta sama dyscyplina co reszta pakietu).
Dowód: `docs/qa/screens/rn-g6-uifix/task3-contract-tab.dark.pl.1440.png` (PL) +
`task3-contract-tab.light.en.1280.png` (EN) — widoczne prawdziwe dane: „Odchylenie
budżetu utrzymania ruchu względem planu rocznego dla linii precyzyjnej", jednostka
PLN, „Próg minimalny (im więcej, tym lepiej)"/„Minimum threshold (higher is better)",
status „Zatwierdzona"/„Approved". `GET .../version` → 200.

**2. Kadencja i właściciel w formularzu definicji** — CZĘŚCIOWO, resztę
ZGŁASZAM (server, poza allowlistą):
- **Właściciel**: dodana READ-ONLY linia „Właściciel" w `KpiDraftFormModal.tsx`
  (create: „Ty (id)"; edit: prawdziwy aktualny właściciel z `KpiDefinitionDto.
  ownerUserId`, przekazany przez nowy `initialValues.ownerUserId` z
  `ResultsKpiRegistryPage.tsx`). To NIE jest picker — `createKpiDraft` CELOWO nie
  przyjmuje nadpisania `ownerUserId` (`kpiApi.ts`, własny komentarz: serwer domyślnie
  ustawia wywołującego, i nie ma ogólnodostępnego endpointu „lista członków
  organizacji" dla zwykłego membera — ten sam powód co przy `RoiCaseCreateModal.tsx`).
  Edycja właściciela istniejącego KPI też nie ma endpointu zapisu. Pokazanie
  prawdziwej wartości to uczciwa naprawa; picker byłby fabrykowaną możliwością.
  Dowód: `docs/qa/screens/rn-g6-uifix/task3-owner-field-create-form.dark.pl.1440.png`
  — „WŁAŚCICIEL / Ty (rn-g6-user-a-admin)".
- **Kadencja pomiaru („measurement cadence")**: NIE DA SIĘ dodać po stronie
  klienta — kolumna istnieje w bazie (`measurement_frequency_days`, migracja
  `server/migrations/20260813_rvn_kpi_measurement_cadence.sql:14-16`), ale ma ZERO
  okablowania: brak pola w `CreateKpiDraftSchema`
  (`server/src/validators/resultsVnextKpi.validators.ts:76-102`) i
  `EditKpiDraftSchema` (tamże:118-135), brak zapisu w
  `server/src/services/resultsVnext/kpi/kpiDefinitionCommands.ts`, i — co ważne —
  brak odczytu: `toKpiDefinitionVersion`
  (`server/src/services/resultsVnext/kpi/kpiTypes.ts:194-228`) NIGDY nie mapuje tej
  kolumny, więc nawet `GET /kpi/:kpiId/version` (ten sam odczyt użyty w punkcie 1)
  by jej nie zwrócił. Jedyny istniejący konsument to wewnętrzna heurystyka SQL w
  `kpiPerspectivesRepository.ts` (branch „update due"), nie żaden publiczny kontrakt.
  Dodanie pola formularza bez tych trzech zmian serwerowych byłoby fabrykowaną
  możliwością (wysłana wartość zostałaby po cichu zignorowana przez zod) —
  **zgłaszam plik:linia, nie naprawiam** (poza `server/src/**`).

**3. Surowy identyfikator zamiast nazwy przy wyborze KPI** — NAPRAWIONE.
`AddKpiScorecardItemModal` (`KpiScorecardItemDialogs.tsx`) teraz rozpoznaje na żywo
(debounce 300ms, ten sam odczyt `getKpiCurrentDefinitionVersion`) i pokazuje
prawdziwą nazwę pod polem ID w miarę wpisywania — pole ID nadal jest tym, co się
wysyła (nie ma pickera, który mógłby je zastąpić — ten sam udokumentowany powód co
w punkcie 1), ale osoba wklejająca UUID WIDZI, że wkleiła właściwy.
Dowód: `docs/qa/screens/rn-g6-uifix/task3-add-item-resolved-name.dark.pl.1440.png` —
„Rozpoznano: Odchylenie budżetu utrzymania ruchu względem planu rocznego dla linii
precyzyjnej" pod wpisanym `4d5db4f2-454e-4813-8813-4d5db4454ebd`.

**Powiązane, NIE naprawione (poza dosłownym zakresem „przy wyborze")**:
`kpiScorecardPresenters.tsx:385-390` (kolumna „KPI" tabeli pozycji) i `:515/:527`
(podgląd pozycji) nadal pokazują skrócony surowy `kpiId`, nie nazwę — ten sam wzorzec,
ale to lista już DODANYCH pozycji (odczyt), nie punkt WYBORU. Naprawa wymagałaby
wsadowego resolve nazw dla widocznych wierszy (N zapytań lub nowy endpoint zbiorczy) —
większy zakres niż zadanie 3.3 dosłownie prosiło. Zgłaszam jako możliwy follow-up.

**Testy**: `tests/resultsVnext/kpi/kpiToolMappers.test.ts` rozszerzony o
`kpiApprovalStatusLabel`/`KPI_APPROVAL_STATUS_TONE`/`kpiTargetGeometryLabel` (każdy
element enuma, PL≠EN, tony niekonfliktowane).

**Kontrola negatywna #2 (automatyczna)**: zmieniono `KPI_APPROVAL_STATUS_TONE.approved`
z `'success'` na `'danger'` → test `approved is success tone, rejected is danger
tone` poszedł na czerwono (`expected 'danger' to be 'success'`) → przywrócono →
16/16 zielone.

---

## ZADANIE 4 — zniekształcony payload migawki

**UI uodporniony?** NIE trzeba było niczego zmieniać — **UI już jest odporny**,
zweryfikowane NA ŻYWO, nie tylko czytaniem kodu:

`ResultsKpiScorecardDetailPage.tsx`'s `loadSnapshots()` już łapie błąd fetcha
(`.catch((err) => setSnapshotsError(toUserFacingErrorMessage(err, isPolish)))`), a
`StandardTable`'s `error` prop (linia 526+ w `StandardTable.tsx`) już renderuje
`EmptyState variant="error"` z przyciskiem Retry — NIGDY fałszywy „brak wierszy".

**Weryfikacja na żywo (dwie ścieżki, nie jedna)**:
1. Wstawiono sentinelowy zniekształcony wiersz (`snapshot_payload = '{}'`, brak
   klucza `items`) bezpośrednio do bazy dla scorecardu `a7a84b5c-…` → otwarto
   zakładkę „Migawki przeglądu" → **realny 500** na
   `GET /api/vnext/results/kpi/scorecards/…/review-snapshots` → UI pokazał
   „Something went wrong completing this action. Please try again." + przycisk
   „Try again" (NIE pustą listę, NIE crash). Kliknięto „Try again" dwukrotnie —
   ten sam uczciwy stan błędu za każdym razem, żadnego wyjątku w konsoli poza
   jednym czystym, ustrukturyzowanym logiem `[ResultsVNext] request failed: {status:
   500, …}`. **Rekord testowy usunięty** (`DELETE … WHERE content_hash =
   'sentinel-malformed-hash'`).
2. **Odkrycie po drodze**: po usunięciu mojego sentinela błąd 500 NIE zniknął —
   okazało się, że w bazie `rn_g6_runtime` (współdzielone środowisko) już ISTNIEJE
   wcześniejszy, niezależny od mnie zniekształcony wiersz seedowy
   (`snapshot_id = '5ec8a662-3724-45db-85db-5ec8a6372481'`, `status = 'published'`,
   `snapshot_payload = '{"note": "seed snapshot"}'` — też bez klucza `items`). To
   dowodzi, że bug jest realny i JUŻ aktywny w bieżącym stanie współdzielonego
   środowiska, niezależnie od mojej sesji — **NIE usunąłem tego wiersza** (nie mój,
   inne tory mogą zależeć od obecnego stanu danych) — zostawiam do decyzji
   właściciela środowiska/serwera.

**Przyczyna (zgłoszona, NIE naprawiona — `server/src/**` poza allowlistą)**:
`server/src/services/resultsVnext/kpi/kpiScorecardRepository.ts:153` —
`redactSnapshotPayloadForReader()`:
```
const filteredItems: ScorecardSnapshotItemFact[] = row.snapshot_payload.items.filter(...)
```
Zakłada bezwarunkowo, że `row.snapshot_payload.items` istnieje i jest tablicą. Payload
kształtu `{}`/`{"note": "..."}` (brak klucza `items`) rzuca `TypeError` przy
`.items.filter`, który propaguje jako 500 zarówno w `listReviewSnapshots` (dotyczy
tej listy) jak i w `getPublishedSnapshot` (ta sama funkcja pomocnicza, wg
komentarza nagłówkowego pliku — nie zweryfikowałem osobno tej drugiej ścieżki na
żywo, tylko czytaniem kodu).

**Skutek dla środowiska**: zakładka „Migawki przeglądu" karty wyników
`a7a84b5c-cfae-4680-8680-a7a84bcfaea3` będzie pokazywać stan błędu KAŻDEMU, kto ją
otworzy, dopóki serwer nie zostanie naprawiony (lub wiersz `5ec8a662-…` nie zostanie
wyczyszczony) — to NIE jest regresja tej sesji, ale warto to wiedzieć przy kolejnym
demo/teście tego ekranu.

---

## Ścieżki zrzutów (co kliknięte przed każdym)

Katalog: `docs/qa/screens/rn-g6-uifix/`

| Plik | Co kliknięte/wpisane przed zrzutem |
|---|---|
| `task1-before-not-yet-enabled.dark.pl.1440.png` | Nawigacja na `/results/kpi` (bez query) |
| `task1-registry-flag-on.dark.pl.1440.png` | Nawigacja na `/results/kpi?ff_resultsVNextKpi=1`, zakładka „Organizacja" |
| `task1-after-open-flag-survives.dark.pl.1440.png` | …→ klik wiersza KPI-A-001 → klik „Otwórz" (query string zgubiony przez `navigate()`, potwierdzone `task1-url-after-open.txt`) |
| `task2-scorecards-tab-new-cta.dark.pl.1440.png` / `.light.pl.1280.png` | Zakładka „Karty wyników" |
| `task2-create-scorecard-modal.dark.pl.1440.png` | …→ klik „Nowa karta wyników" |
| `task2-okr-programs-cycles-no-dup.dark.pl.1440.png` | Nawigacja `/results/okr?ff_resultsVNextOkr=1` |
| `task3-contract-tab.dark.pl.1440.png` / `.light.en.1280.png` | `/results/kpi/:kpiId` → klik „Kontrakt"/„Contract" |
| `task3-owner-field-create-form.dark.pl.1440.png` | Rejestr KPI → klik „Nowy KPI" |
| `task3-add-item-resolved-name.dark.pl.1440.png` | Karta wyników → klik „Dodaj KPI" → wpisano UUID KPI-A-001 |

## Liczby błędów (na kluczowych ekranach, po każdym kroku)

- Task 1 „po" (flaga przeżyła nawigację): 0 nowych błędów sieci ≥400 poza tłem
  sesji (401 teresa/voice-config przed hydratacją auth, kilka 404 favicon-podobnych —
  identyczne PRZED jakąkolwiek moją zmianą, niezwiązane).
- Task 2 (utworzenie scorecardu): `POST … → 201`, 2×`GET … → 200`, 0 błędów.
- Task 3 Kontrakt: `GET …/version → 200`, 0 błędów.
- Task 4 (zniekształcony payload): `GET …/review-snapshots → 500` ×3 (load + 2×
  retry) — TO JEST oczekiwany, prawdziwy serwerowy błąd (przyczyna wyjaśniona wyżej),
  nie regresja UI; konsola: 1 czysty, ustrukturyzowany log błędu, ZERO nieobsłużonych
  wyjątków.

## Kontrola negatywna ×2 (wymagane)

1. **Task 1** (żywa aplikacja + testy): `git stash` poprawki
   `resultsVNextFeatureFlags.ts` → realne kliknięcie Open wylądowało na „not yet
   enabled" (czerwień) → `git stash pop` → to samo kliknięcie wylądowało na treści
   (zieleń). Równolegle: `tests/resultsVnext/resultsVNextFeatureFlags.
   navigationPersist.test.ts` 7/7 zielone → wycofano poprawkę → 2/7 czerwone
   (dokładnie te asercje o przetrwaniu nawigacji) → przywrócono → 7/7 zielone.
2. **Task 3** (testy): `KPI_APPROVAL_STATUS_TONE.approved` zmieniono na `'danger'` →
   test `approved is success tone…` czerwony → przywrócono → 16/16 zielone.

## Bramki (exit code)

- `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` — **EXIT 0** (cały
  monorepo, zero błędów typów).
- `npx vite build` — **EXIT 0** (10236 modułów, zbudowano w 1m20s).
- `scripts/check-list-canon.sh` — dług: **408** (baseline 409) — **SPADŁ o 1**, nie
  wzrósł (fallback na pełny skan repo, bo staging był pusty w momencie sprawdzenia).
- `scripts/check-artefakt.sh` — **7/7** (baseline 7), zero nowych naruszeń crimson.
- `scripts/check-focus-canon` (uruchomiony automatycznie przez pre-commit) —
  dług nie rośnie (baseline 130 plików/261 wystąpień, bez zmian).
- `git diff --check` — **EXIT 0**, zero błędów białych znaków.
- `npx vitest run tests/resultsVnext/kpi tests/resultsVnext/
  resultsVNextFeatureFlags.navigationPersist.test.ts tests/components/ResultsVNext` —
  **225 passed**, 2 failed. Oba faile to `*RoutesRealdb.test.ts`
  (`kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts`,
  `kpiScorecardRepositoryRoutesRealdb.test.ts`) wymagające WŁASNEGO schematu
  Postgres (`relation "rvn_kpi_scorecards" does not exist` itd.) — **pre-existing,
  niezwiązane z moimi zmianami** (środowisko RN-G6 seed nie ma tego konkretnego
  schematu testowego pod tym `RUN_DB_TESTS` configiem). Żaden z nich nie jest
  jednym z trzech zakazanych plików (nie dotknąłem żadnego `*.realdb.test.ts`).

## Czego to NIE dowodzi

- Nie zweryfikowano PEŁNEJ macierzy PL×EN×dark×light×1440×1280 dla KAŻDEGO
  zmienionego ekranu — Task 1 ma pełny cykl przed/po w PL/dark/1440 (kliknięty na
  żywo, to jest sedno naprawy); Task 2/3 mają dark/PL/1440 jako główny dowód +
  punktowe sprawdzenia light/EN. Tryb light w tej aplikacji jest sterowany
  persystowanym stanem Zustand (nie samym `prefers-color-scheme`) — wymuszenie go
  przez usunięcie klasy `dark` z `<html>` w skrypcie zrzutów dało TYLKO częściowe
  odwrócenie (górny pasek), nie pełną paletę — `task2-scorecards-tab-new-cta.
  light.pl.1280.png`/`task3-contract-tab.light.en.1280.png` pokazują to częściowe
  odwrócenie, NIE pełny, poprawny tryb jasny. Prawdziwy przełącznik motywu w UI
  aplikacji nie został odnaleziony/użyty w tej sesji.
- Nie kliknięto NA ŻYWO drugiej ścieżki `getPublishedSnapshot` w Task 4 (ta sama
  funkcja `redactSnapshotPayloadForReader`, ale inny endpoint) — tylko przeczytana w
  kodzie jako współdzieląca ten sam defekt.
- Nie naprawiono serwera (Task 4 — 500, Task 3.2 — brak pola kadencji) — poza
  `server/src/**`, zgłoszone plik:linia, nie zaimplementowane.
- Nie naprawiono `kpiScorecardPresenters.tsx`'s surowego ID w liście pozycji karty
  wyników (odczyt, nie punkt wyboru) — zgłoszone jako powiązany, nie naprawiony ślad.
- Nie usunięto pre-existing zniekształconego wiersza seedowego
  `5ec8a662-3724-45db-85db-5ec8a6372481` ze współdzielonej bazy — zostawiony
  celowo (nie mój, może być zależność innego toru), ale zakładka „Migawki
  przeglądu" tego konkretnego scorecardu (`a7a84b5c-…`) pozostaje w stanie błędu
  dla każdego, kto ją otworzy.
- Testy jednostkowe pokrywają logikę flag i maperów etykiet — NIE ma nowego testu
  e2e/Playwright commitowanego do repo (użyto jednorazowych skryptów w
  `/private/tmp/.../scratchpad/` do zrzutów, usuniętych po zakończeniu, zgodnie z
  regułą „zero sub-agentów"/minimalny ślad w repo — same zrzuty PNG trafiły do
  `docs/qa/screens/rn-g6-uifix/`, skrypty generujące nie są commitowane).
- „Testy przeszły" ≠ „działa" — dlatego każdy z 4 zadań ma osobny dowód z
  REALNEGO kliknięcia na żywej aplikacji (nie tylko dev-render, nie tylko unit test),
  udokumentowany wyżej z URL-ami/statusami sieci.

## Czy ruszyłem coś poza dosłowną allowlistą

Tak, jeden plik: `src/components/ResultsVNext/resultsVNextFeatureFlags.ts` (zadanie
1) i pomocniczo `src/components/ResultsVNext/KpiDraftFormModal.tsx` (zadanie 3.2,
pole właściciela) — oba uzasadnione wyżej przy każdym zadaniu: żaden nie należy do
`roi/**`/`okr/**`/`server/**`/`standard/**`/`shared/**`, oba są jedynymi miejscami,
gdzie dosłowna treść zadania dawała się zrealizować bez fabrykowania funkcjonalności
lub bez łamania podziału pracy. Zero zmian w `server/src/**`,
`src/components/standard/**`, `src/components/shared/**`, `roi/**`, `okr/**`,
pięciu zakazanych plikach równoległej sesji, `.claude/launch.json` — potwierdzone
`git status`/`git diff --stat` na każdym z trzech commitów tej sesji.
