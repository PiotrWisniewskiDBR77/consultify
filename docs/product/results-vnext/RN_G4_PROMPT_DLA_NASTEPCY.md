# PROMPT DLA NASTĘPCY — Results Next, kontynuacja od 2026-08-11

> Skopiuj wszystko poniżej linii jako pierwszą wiadomość do nowej sesji.

---

RESULTS NEXT — KONTYNUACJA DO PEŁNEGO IMPLEMENTED_EVIDENCED_CANDIDATE

Jesteś głównym agentem zarządzającym programem Results Next. Poprzednia sesja
skończyła się wyczerpaniem budżetu, **nie blokadą**.

## MODEL I ORGANIZACJA

Ty pracujesz na **Opusie** jako orkiestrator. **Wszystkie** agenty wykonawcze
uruchamiasz na **Sonnecie**.

Opus: kanon i architektura · dekompozycja · allowlist · zależności · integracja ·
konflikty · ledger · **niezależna weryfikacja wyników Sonnetów** · decyzja o
przyjęciu pakietu.
Sonnet: implementacja ograniczonego pakietu · testy · realDB jeśli dotyka danych ·
interaktywny test UI · dokumentacja dowodowa · własny commit na własnej gałęzi.

**Sonnet nigdy nie jest acceptorem własnej pracy.** W poprzedniej dobie
niezależna weryfikacja Opusa wyłapała trzy defekty, których raporty Sonnetów nie
zgłaszały — w tym awarię hooków wywalającą żywy ekran.

## REPOZYTORIUM

```
/Users/piotrwisniewski/Library/Mobile Documents/com~apple~CloudDocs/Documents/Antygracity/DRD/consultify-results-vnext-g0-20260809
```
Gałąź `codex/results-vnext-g0-20260809`.

**Pierwsze polecenia — nie zakładaj SHA z żadnego dokumentu:**
```
git rev-parse HEAD && git log --oneline -15 && git status --short && git worktree list && git branch --show-current
```

**Przeczytaj w tej kolejności, w całości:**
1. `docs/product/results-vnext/RESUME_HANDOFF_2026-08-11.md` ← **punkt wejścia, wszystko tam jest**
2. `docs/product/results-vnext/RN_G4_RAPORT_DLA_CODEX_2026-08-11.md`
3. `docs/product/results-vnext/EXECUTION_LEDGER.md` §54–§56
4. `docs/product/results-vnext/RN_G2_OPEN_QUESTIONS_UI.md` (OQ-UI-A…I)
5. `docs/product/results-vnext/RN_G3_F0_INTERACTIVE_REVERIFY.md`
6. `CLAUDE.md` · `docs/ui-standards/TRIADA_KANON.md` · `Harvard/wdrozenie-100/ARTIFACT_ANATOMY_STANDARD.md`
7. `docs/product/results-vnext/06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md`
8. `RN_G2_UI_SCOPE.md` + `0{1,2,3,4}_*_IMPLEMENTATION_PLAN.md` + odpowiednie `*_E00X_DESIGN.md`

**Nie twórz konkurencyjnego planu.** Aktualizuj istniejący plan, handoff i ledger.

## OCHRONA CUDZEJ PRACY — NIENARUSZALNE

Pięć plików należy do **równoległej sesji** i było nietkniętych przez całą
poprzednią dobę:
```
server/src/database/PostgresDatabase.ts
tests/resultsVnext/kpi/initiativeKpiImpactBaselineFreeze.realdb.test.ts
tests/resultsVnext/kpi/kpiIdentityAcrossSurfaces.realdb.test.ts
tests/resultsVnext/kpi/kpiInitiativeImpactPerspectivesRoutesRealdb.test.ts
server/migrations/20260810_fix_initiatives_status_default.sql
```
Najpierw sprawdź, czy nadal są dirty i czy nadal są cudze. Jeśli tak — zero
`reset`/`checkout`/`restore`/`stash`/`clean`/`stage`/`commit`/automatycznego
merge. **Nie twórz trzeciej konkurencyjnej naprawy `initiatives.status`.**

## KOLEJNOŚĆ PRAC

### KROK 0 — domknij blocker B1, zanim cokolwiek zbudujesz
Pięć z sześciu ekranów `dev-render/screens/results-vnext-*.tsx` montowało
**drugą implementację ekranu**, nie komponent produkcyjny. To dlatego awaria
hooków przeszła odbiór. Część przerobiono, **konwersja nie została zweryfikowana
w całości**.

Sprawdź KAŻDY ekran: czy montuje komponent produkcyjny i czy przekazuje
**realne `onClose`** (nie `() => {}`). Dokończ konwersję i **powtórz Falę 0 —
pełną rundę interaktywną — na realnych komponentach**. Spodziewaj się, że
wyjdą błędy ukryte dotąd przez drugą implementację; to jest cel, nie problem.

Wzorce: `dev-render/screens/results-vnext-kpi-registry.tsx` (przez `Api`),
`results-vnext-legacy-archive.tsx` i `results-vnext-roi-full-tool.tsx` (przez
`window.fetch`).

### KROK 1 — obejrzyj i oceń pracę przerwaną
Dwie gałęzie mają pracę **niezweryfikowaną, jawnie oznaczoną WIP, NIE scaloną**:
- `rn-g4-lane-teresa` — powierzchnie Teresy dla trzech domen. Bez typechecku,
  bez kanonów, bez dowodu interaktywnego, bez raportu.
- `rn-g4-lane-crossdomain` — 5 plików `tests/acceptance/rvn-g4-*.e2e.test.ts`.
  **Żaden nie był uruchomiony na realnym Postgresie.** Nieuruchomiony test nie
  dowodzi niczego.

Zdecyduj: dokończyć czy odtworzyć. **Nie scalaj ich na ślepo.**

### KROK 2 — dwa niedokończone drobiazgi
- destrukcyjna pozycja kebaba w archiwum legacy jest `disabled`, ale ma pełny
  crimson i wygląda na aktywną (nie zmieniaj koloru pozycji **aktywnej**);
- surowy `err.message` backendu renderuje się wprost w stanie błędu na czterech
  stronach domenowych (`err instanceof Error ? err.message : String(err)`).

### KROK 3 — Fala Teresy (D13)
Pełna ścieżka, widoczna w UI: dowód/źródło → propozycja → proponowana zmiana →
**podgląd konsekwencji** → sprawdzenie uprawnień → **jawna akceptacja ALBO
odrzucenie** → autoryzowana komenda → zapis domenowy → outbox → konsument →
audyt → przeładowanie i zimne otwarcie.
**Ścieżka ręczna musi działać, gdy Teresy nie ma** — to wymóg twardy.
Teresa nigdy nie zatwierdza, nie odrzuca, nie zmienia wartości, nie zamyka
sprawy i nie omija polityki uprawnień sama.

### KROK 4 — dowody przekrojowe i bezpieczeństwo, na realnym PostgreSQL
Osiem punktów opisanych w handoffie §9.3, w tym **D07**: użytkownik, który
stracił dostęp do jednego KPI **po** opublikowaniu migawki przeglądu, nie może
zobaczyć jego danych. Testy negatywne sprawdzaj **przez publiczną ścieżkę**, nie
zapytaniem wprost do tabeli, i asertuj po `organizationId` na KAŻDYM wierszu.

### KROK 5 — pełna macierz UI/CX na JEDNYM finalnym SHA
Wg `06_ACCEPTANCE_AND_VERIFICATION_HANDBOOK.md`: domeny × poziomy × stany × role
× widoki × prezentacja × interakcje. **Jeżeli późniejsza zmiana dotyka wcześniej
odebranego ekranu — stare zrzuty i testy interakcyjne dla tego ekranu tracą
ważność.**

### KROK 6 — pakiet dowodowy
Baseline i finalny SHA · zakres commitów · brudne drzewo i właściciele · tabela
epik → AC → implementacja → test → dowód runtime → evidence · komendy testowe i
pełne wyniki · odcisk realnej bazy · realne identyfikatory obiektów ·
before/write/readback/cold-reopen · macierz ról · manifest zrzutów · dowody
konsoli i sieci · log klawiatury i fokusu · PL/EN i dark/light · lista N/A z
uzasadnieniami · znane ograniczenia · potwierdzenie flag OFF · potwierdzenie
braku push i deploy.

## ZASADY WIELOAGENTOWE, KTÓRE SIĘ OBRONIŁY

1. **Jeden agent = jeden izolowany worktree = jedna gałąź.** Katalog
   `/Users/piotrwisniewski/rn-g2-lanes/*`, `node_modules` przez **dowiązanie
   symboliczne** do worktree głównego (bez tego vite umiera po cichu).
2. Każdy worktree twórz z **aktualnego** integration SHA. Agent ma potwierdzić
   bazę (`git rev-parse HEAD`) przed pierwszą zmianą — czterech agentów w
   historii tego programu wystartowało ze złego commita.
3. **Tylko JEDEN tor ma prawo do `src/components/standard/**` i
   `src/components/shared/**`.** Reszta eskaluje, nie naprawia sama.
4. Konflikty scalania są zawsze te same trzy pliki i zawsze addytywne:
   `ResultsVNext/index.ts`, `dev-render/main.tsx`, `src/routes/AppRoutes.tsx`.
5. **Bramki biegają PRZED scaleniem.** W poprzedniej dobie tor zawiesił się
   przed `tsc` i wprowadził 8 błędów typów, które wykrył dopiero mój typecheck
   po scaleniu.
6. Po każdym merge Opus robi **własną** weryfikację na zintegrowanym SHA i klika
   przynajmniej jedną rzecz, którą agent mógł pominąć.
7. Agent, który skończył bez raportu, **nie jest agentem, który skończył pracę** —
   sprawdź jego worktree sam, zacommituj i oceń diff.

## PUŁAPKI, KTÓRE JUŻ KOSZTOWAŁY

- **Zrzut dowodzi, że ekran się RENDERUJE, nie że da się go KLIKAĆ.** Przy
  pakiecie dodającym zakładkę żądaj zrzutu **z tej zakładki, po kliknięciu**.
- **Mock w harnessie musi mieć kształt danych z SERWERA**, nie kształt wygodny
  dla oka. Skala OKR 0–1 vs 0–100: dwa błędy się znosiły i przepuściły wadę.
- **Mierz trzema stanami** (passed/failed/skipped), nigdy samym licznikiem
  porażek. Poprawna naprawa fikstur nie ruszyła licznika, bo maskował ją CHECK
  sprawdzany przed kluczem obcym.
- **`RUN_DB_TESTS=1` ORAZ `NODE_ENV=test`** — samo `NODE_ENV` kieruje zapisy
  `DbPromise` w cichy mock, a `acquirePgClient` w realną bazę.
- **Kontrola negatywna obowiązkowa**: zepsuj asercję, potwierdź czerwień, cofnij.
- **Zero `window.prompt/confirm/alert`** — siedem takich trzeba było usuwać.
- `tsc` na tej maszynie potrafi trwać kilkadziesiąt minut pod obciążeniem i
  **potrafi OOM-ować udając sukces** — używaj `NODE_OPTIONS=--max-old-space-size=8192`.

## DECYZJE — NIE OTWIERAJ ICH PONOWNIE

D01 bez restartu RN-G2 · D02 gołe `/results` zostaje legacy · D03 pełne
narzędzia klasy L, żadnych edytorów w podglądzie · D04 trzy rejestry rodziców,
zero encji-liści na najwyższym poziomie · D05 sprawy odchyleń KPI to subwidok ·
D06 akcja zablokowana widoczna, disabled, **z powodem**; powód odmowy
bezpieczeństwa **ogólny** — **D06 nadpisuje R01** · D07 nigdy
nieprzefiltrowanego `snapshot_payload` · D08 postęp i pewność to dwa pojęcia,
`null` ≠ zero ≠ nieobliczalne · D09 `persistKey` per powierzchnia · D10
`/attention` to jeden widok przekrojowy · D11 flagi OFF · D12 perspektywy to
projekcje, nie kopie · D13 Teresa proponuje, nie decyduje · D14 brak drobnej
decyzji wizualnej nie zatrzymuje programu.

## WARUNKI ZATRZYMANIA

Zatrzymaj się tylko przy: operacji nieodwracalnej · konieczności push/merge do
demo/deploy · konflikcie z cudzą niezacommitowaną pracą, którego nie da się
ominąć izolowanym worktree · rozszerzeniu zakresu poza Results Next · P0
bezpieczeństwa lub integralności danych bez kanonicznego rozwiązania · braku
danych dostępowych albo środowiska.

W takim przypadku: nie zgaduj, nie deklaruj PASS, zapisz blocker z plikiem, SHA,
testem i konsekwencją, **kontynuuj wszystkie niezablokowane tory** i zatrzymaj
się dopiero, gdy nie ma już bezpiecznego toru pracy.

## CZEGO NIE WOLNO UZNAĆ ZA DoD

Liczba commitów · liczba zrzutów · sam typecheck · sam build · sam unit test ·
testy na mocku · widoczny przycisk bez wykonania akcji · zielony test, którego
setup pominął przypadki · raport Sonnetu bez niezależnej kontroli Opusa ·
backend bez UI · UI bez realDB/readback · zakończenie jednej domeny.

## NA KONIEC

Nie deklaruj `ACCEPTED_ACCEPTANCE_ENV`, `ACCEPTED_TERMINAL`, wdrożenia ani
produkcyjnego GO. Te decyzje należą do Codexa i Właściciela.

Gdy wszystko z KROKU 0–6 będzie kompletne na jednym finalnym SHA, zakończ
odpowiedź dokładnie ostatnią linią:

READY_FOR_CODEX_REVIEW
