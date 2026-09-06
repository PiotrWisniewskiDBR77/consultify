# Finanse — CD PROJEKT do pokazu (2026-09-06)

Gałąź `fin/cdprojekt-do-pokazu` (baza `445b8c6f54`). Naprawa 5 blokerów i 5 uwag ważnych
z audytu `evidence/audyt-mvp-20260906/FIN/RAPORT_FIN.md` (werdykt: **NIE**).

Środowisko dowodowe: własny serwer `127.0.0.1:4120` + własny vite `127.0.0.1:3094`
(worktree `/private/tmp/wt-fincdp`), lokalna baza `consultify_noc` na 54400, org DBR77
`cc9db573-260f-4a19-927f-f3cc1fbaea38`. Sesja: KOPIA `auth.json` → `auth-fincdp.json`.
Staging tknięty wyłącznie skryptem seeda (dry-run → apply), zero ręcznego SQL.

---

## 1. Co było zepsute i co z tym zrobiono

### BLOKER #3 audytu — „Otwórz" tworzył pusty duplikat

**Zmierzona przyczyna (nie hipoteza).** Ścieżka: `FinanceHub.handleOpenFull` →
`FinanceLegacyBridgeGate` → `useFinanceLegacyBridge` → `POST /artifacts/resolve-legacy/…/ensure`
→ `legacyIdentityMaterializationService.ensureLegacyFinanceArtifactIdentity`. Ta funkcja
szukała istniejącego artefaktu **wyłącznie po `natural_key` zbudowanym z NAZWY wiersza
legacy** („Grupa Kapitałowa CD PROJEKT FY2024"). Prawdziwy pakiet z 238 liniami nosi klucz
seeda (`seed:finance-cdprojekt-2025:<org>:GRUPA_KAPITALOWA_CD_PROJEKT`) — nie pasował, więc
powstawał DRUGI, PUSTY `STATEMENT_PACK` i to on dostawał alias.

Ślad w bazie przed naprawą (odczyt na zimno):
`fe74a3a5-b7a5-4417-8721-b484b7a5dcb7`, `mapping_reason = materialized_on_open:STATEMENT_PACK`,
0 linii — dokładnie artefakt-widmo opisany w audycie.

**Naprawa w dwóch niezależnych warstwach:**

1. **Kod (żeby nie odrosło u nikogo innego)** —
   `server/src/services/finance/canonical/legacyIdentityMaterializationService.ts`:
   nowa `findCanonicalStatementPackBySource()` dopasowuje pakiet po **ŹRÓDLE** (podmiot
   `finance_stmt_entities.legal_name`/`entity_code` + pokrycie okresów pakietu legacy),
   z twardym warunkiem `COUNT(l.id) > 0` — wiążemy się tylko z pakietem, który NAPRAWDĘ ma
   linie. Gdy ani alias, ani źródło, ani nazwa nic nie znajdą → `NOT_MIGRATED`, czyli
   uczciwy polski komunikat bramki („Ten rekord jeszcze nie ma odpowiednika w nowym
   systemie"), a **nie** nowy, pusty artefakt. Zawężone do `STATEMENT_PACK` — Baseline,
   Predykcja i Wycena celowo powstają jako pusta powłoka do wypełnienia i mają zachowanie
   bez zmian.
2. **Dane (żeby zadziałało jutro rano)** — `server/scripts/finance-seed-cdprojekt.ts`:
   `ensureCanonicalAlias()` zakłada most legacy→kanoniczny idempotentnie, a gdy zastanie
   alias wskazujący gdzie indziej — przepina go na pakiet seeda i **archiwizuje puste
   widmo** (tylko jeśli ma 0 linii i pochodzi z materializacji; artefakt z treścią zostaje
   nietknięty, z głośnym ostrzeżeniem). Diagnoza mostu wypisywana także w `--dry-run`.

**Sprzątnięcie widma lokalnie:** `fe74a3a5-…` → `archived_at = 2026-09-05 22:30:19+00`,
alias przepięty na `921a3360-7f2a-4e53-ac42-3c58842654cf` (238 linii).

### BLOKER #4 — kody `AP` / `CASH` / `CURRENT_ASSETS` zamiast nazw pozycji

`src/labels/financeLineLabels.ts` — **246 kodów** kanonicznych → nazwy PL:
- **119** przepisanych DOSŁOWNIE z PDF (`server/scripts/data/cdprojekt-2025.json`, pole `key`);
- **122** terminologia sprawozdawcza dla kodów, których PDF nie zawiera;
- **5** z `line_name_pl` migracji repo (tam, gdzie niesie realną nazwę, a nie echo kodu).

Zakres = CAŁA taksonomia systemowa, nie tylko pakiet CD PROJEKT — inaczej naprawa byłaby
„poprawna w 1 z N" i odrosłaby przy pierwszym innym sprawozdaniu. Kolejność wyboru:
słownik → nazwa z DTO taksonomii tej instalacji → jawne `Nieznana pozycja (KOD)`.
Goły kod NIGDY nie wychodzi na ekran.

Serwer: `GET /statements/:bv/lines` niesie odtąd `lineName` / `lineNamePl` / `sortOrder`
(`statementMappingService.listStatementLines` + `statements.routes.ts`), a **kolejność
wierszy idzie po `sort_order` taksonomii, nie po alfabecie kodów** — sprawozdanie czyta się
jak sprawozdanie, nie jak posortowany rejestr.

### BLOKER #3b — tytuły artefaktów = klucze techniczne

Migracja **addytywna** `server/migrations/20261102_finance_artifact_display_name.sql`
(jedna kolumna nullable, zero DROP, zero zmian istniejących wierszy) rozdziela role:
`natural_key` = KLUCZ idempotencji, `display_name` = NAZWA dla człowieka.

`src/labels/financeArtifactTitle.ts` to JEDNO miejsce decyzji „co pokazać":
`display_name` → `natural_key` (tylko jeśli nie jest techniczny) → uczciwa nazwa rodzajowa.
`isRawTechnicalValue()` łapie UUID w dowolnym miejscu, maszynowy prefiks z dwukropkiem i
pojedynczy token bez spacji — a nie łapie nazw pisanych przez człowieka („Analiza 2025:
wnioski"). Wpięte w: kartę pakietu, kartę analizy, `CanonicalFinanceDirectWorkspace`, rzut
rejestru kanonicznego na liście i panel powiązań.

Seedy ustawiają nazwy: „Grupa Kapitałowa CD PROJEKT — skonsolidowane sprawozdanie 2025
(z 2024)" i „Analiza wskaźnikowa 2024–2025 — CD PROJEKT".

### BLOKER #6 — karta analizy po angielsku, z komentarzem z kodu i UUID-em

- `src/labels/financeKpiLabels.ts` — 18 wskaźników katalogu P0: nazwa PL, kategoria PL
  (koniec z `EFFICIENCY`/`LIQUIDITY`/`LEVERAGE`) oraz **rozdzielone** WZÓR
  („Aktywa obrotowe / Zobowiązania krótkoterminowe") i OGÓLNA INTERPRETACJA. Przed naprawą
  `AnalysisWorkspace.tsx` wpisywało w OBIE kolumny to samo pole `catalog.description`,
  które jest notatką inżynierską autora formuły („…via formula_ref (DRY at the AST level,
  ADR section 5.4)").
- `src/labels/financeKpiCommentLabels.ts` — mapper komunikatów silnika:
  `NA_REASON:DENOMINATOR_MISSING — … got 'FY' for 3206a8c3-…` → „Nie policzono: ten wskaźnik
  wymaga danych kwartalnych (suma z 4 kwartałów), a pakiet zawiera wyłącznie okresy roczne."
  Komentarz napisany przez człowieka przechodzi bez zmian; nieznany komunikat silnika też
  nie przecieka surowy (żaden UUID nie wychodzi na ekran).

### BLOKER #7 — crimson na CTA Modeli

`FinanceHub.tsx` pusty stan Modeli: ikona `bg-crimson-500/10` → `bg-c-surface-raised`,
przycisk `bg-crimson-600` → `bg-c-text`, hover `border-crimson-300` → `border-c-border`.
Pomiar pikselowy zrzutu `06-modele-bez-crimson.png`: **zero** pikseli `#85182F ±18`
w obszarze treści. 23 piksele, które zostają, są w dwóch miejscach POZA modułem:
logo „77" (x 0–50) i kropka statusu „Model" w górnym pasku aplikacji (x ≈ 1050) — obecne
identycznie na zrzutach audytu SPRZED zmian, więc nie regresja.

### WAŻNE #2, #5, #12 i kosmetyka

- **badge „APPROVED"** w podglądzie → `statusChipLabel` → „Zatwierdzone" (ta sama encja
  w tabeli obok pokazywała już polską wersję — niespójność na jednym ekranie).
- **angielskie zdanie „Stan pakietu"** z `financialStatementPackService.ts:216-224` →
  `statementPackStateSentence()` w `statementReadinessCopy.ts` składa zdanie po polsku ze
  STANU + KODÓW POWODÓW; backend nie zna języka użytkownika i nie powinien znać.
  Klucze i18n `finance.statements.state.*` (pl + en).
- **lista Analiz pusta mimo istniejącej analizy** → `financeCanonicalMerge.ts` +
  `useFinanceData.loadAnalyses` czyta ZAWSZE oba źródła (legacy i rejestr kanoniczny),
  awaria odczytu kanonicznego degraduje się do pustej tablicy i nie wywraca listy.
  Wzorzec z `mergeLegacyInitiativesIntoRegister`, z jedną ZMIERZONĄ różnicą: w Finansach
  bogatszy jest wiersz legacy (ma typ, walutę, okresy i wskaźnik na kanonicznego
  bliźniaka), więc to ON wygrywa kolizję, a rejestr dokłada wyłącznie sieroty.
- **„v.d7b0b5de" + „Manual link"** w panelu powiązań → krawędzie rodowodu niosą nazwy
  artefaktów na obu końcach (`lineageService` + `crosscutting.routes`), panel pokazuje
  „Analiza wskaźnikowa 2024–2025 — CD PROJEKT" i „Powiązanie ręczne".
- **dwa nagłówki „TYP"** obok siebie na liście Analiz → drugi to „Rodzaj analizy".
- **„0 okresów"** dla rzutu kanonicznego → kreska. Zero było FAŁSZEM (analiza ma dwa
  okresy), a nie brakiem danych.

---

## 2. Dowody

### Testy i mutacje

| Plik testu | Twierdzeń | Mutacja (skasowanie zabezpieczenia) |
|---|---|---|
| `server/src/services/finance/canonical/__tests__/legacyIdentityMaterializationStatementPack.pg.test.ts` | 3 | wyłączenie dopasowania po źródle + zakazu pustego pakietu → **2 czerwone** |
| `src/labels/__tests__/financeLineLabels.test.ts` | 8 | usunięcie etykiety `CASH` → **3 czerwone** |
| `src/labels/__tests__/financeKpiLabels.test.ts` | 6 | powrót `description` do kolumny WZÓR → **1 czerwony** |
| `src/labels/__tests__/financeKpiCommentLabels.test.ts` | 6 | echo surowego tekstu silnika → **3 czerwone** |
| `src/labels/__tests__/financeArtifactTitle.test.ts` | 5 | puszczenie `natural_key` bez sprawdzenia → **2 czerwone** |
| `src/components/Economics/__tests__/financeCanonicalMerge.test.ts` | 4 | ignorowanie rejestru kanonicznego → **2 czerwone** |

Test `.pg` biegnie na REALNYM Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false`), zakłada własną
organizację i sprząta po sobie (`session_replication_role=replica`; po przebiegu
`select count(*) from organizations where id like 'org-fin-matz-%'` = **0**).

### Bramki

- `cd server && npx tsc --build tsconfig.build.json` → **exit 0**
- `bash scripts/check-list-canon.sh` → OK (naruszeń 361, baseline 364 — **dług SPADŁ o 3**)
- `bash scripts/check-artefakt.sh` → OK (crimson 8, baseline 8 — dług nie rośnie)
- esbuild per plik dla każdego dotkniętego `.ts`/`.tsx` → OK
- **zmodyfikowanych migracji: 0** (tylko jedna NOWA, addytywna)

### Zero nowych czerwonych (pomiar różnicowy, nie deklaracja)

Ten sam zestaw uruchomiony na gałęzi i na bazie `445b8c6f54` (osobny worktree):

| Zakres | Baza | Po zmianach | Różnica |
|---|---|---|---|
| `src/components/Finance` + `src/components/Economics` + `src/labels` | 27 czerwonych plików | 27 | **0 nowych** |
| `server/src/services/finance/canonical` (`RUN_DB_TESTS=1`) | 18 | 18 + 2 | patrz niżej |

Dwa „nowe" czerwone w `benefitTrackingUpgradeProtection.pg.test.ts` (ochrona
`benefit_tracking`, zero związku z Finansami-UI) **przechodzą 15/15 uruchomione osobno
NA OBU gałęziach** — to flake zależny od kolejności na współdzielonej bazie, nie regresja.
Jeden realnie nowy czerwony (`AnalysisWorkspace.smoke`) był STARYM oczekiwaniem testu:
fikstura trzymała `kpiName: 'Marża brutto'`, a ekran pokazuje odtąd nazwę ze słownika
(„Marża brutto na sprzedaży") — asercja zaktualizowana wraz z uzasadnieniem w kodzie testu.

### Zrzuty NA ŻYWO (własny serwer + własny vite + lokalna baza), `bledyKonsoli: []` na każdym

| Zrzut | Co widać |
|---|---|
| `01-lista-sprawozdan.png` | Lista Sprawozdań: `StandardTable`, jeden wiersz „Grupa Kapitałowa CD PROJEKT", chip „Zatwierdzone", P&L / BS / CF, FY2024, PLN, 6 dokumentów. |
| `02-podglad.png` | Podgląd po kliknięciu wiersza: pastylka **„Zatwierdzone"** (było „APPROVED"), „Stan pakietu" = *„Pakiet jest kompletny: rachunek zysków i strat, bilans oraz rachunek przepływów pieniężnych."* (było angielskie zdanie z backendu). |
| `03-pakiet-po-otworz.png` | **Klik „Otwórz" otwiera PRAWDZIWY pakiet**: „119 linii × 2 okresów", nazwy po polsku (Środki pieniężne i ekwiwalenty…, AKTYWA OBROTOWE, Należności handlowe, Zobowiązania handlowe, KAPITAŁ WŁASNY), liczby zgodne z PDF: **AKTYWA RAZEM 3 026 438 / 3 503 320**, PASYWA RAZEM identycznie, KAPITAŁ WŁASNY 2 774 059 / 3 289 859. Panel powiązań: „Analiza wskaźnikowa 2024–2025 — CD PROJEKT · Powiązanie ręczne". |
| `04-lista-analiz.png` | Lista Analiz **nie jest już pusta**: „Analiza wskaźnikowa 2024–20…", nagłówki „TYP" i „RODZAJ ANALIZY" (koniec duplikatu), OKRESY = „—". |
| `05-analiza-karta.png` | Karta analizy: tytuł „Analiza wskaźnikowa 2024–2025 — CD PROJEKT" (był `derived-analysis:script:4db71c39-…`), **18/18 wskaźników po polsku**, kategorie „Efektywność"/„Płynność"/„Zadłużenie", WZÓR czytelny („Aktywa obrotowe / Zobowiązania krótkoterminowe"), KOMENTARZ = „Nie policzono: ten wskaźnik wymaga danych kwartalnych…". Skan tekstu: **zero** wystąpień `Cash Ratio`, `LIQUIDITY`, `NA_REASON`, `formula_ref`, `ADR section`. |
| `06-modele-bez-crimson.png` | Pusty stan Modeli: CTA „Utwórz model finansowy" neutralny, zero crimson w treści. |

---

## 3. Staging

Baza z `DATABASE_PUBLIC_URL` (`thomas.proxy.rlwy.net:52567/railway`), org właściciela
`a3e05d4a-5397-419d-b486-8e44366c0063`. Zapis WYŁĄCZNIE przez seed, najpierw `--dry-run`.

**Dry-run zapowiedział:** `MOST legacy→kanoniczny: alias = BRAK; artefakt seeda =
67f0e754-… → --apply ZAŁOŻY alias` oraz `kolumna finance_artifacts.display_name NIE
ISTNIEJE w tej bazie (migracja 20261102 wejdzie z wdrożeniem) — --apply jej NIE ustawi`.

**`--apply` zrobił dokładnie to:** alias `cdp2025-pack-e2daa0b810 → 67f0e754-…` założony,
238 linii kanonicznych przepisanych, 6 sprawozdań legacy / 292 pozycje, `pack_readiness_status = ready`.

**Odczyt na zimno (osobne połączenie, po fakcie):**
- alias istnieje i wskazuje pakiet z **238 liniami**, `bv = e57594d1-…`;
- liczba artefaktów `STATEMENT_PACK` w organizacji **bez zmian (7)** — żadnego widma nie przybyło.

**Czego na stagingu NIE ma i dlaczego:** nazw wyświetlanych (`display_name`). Kolumna
powstaje migracją `20261102`, która wjedzie razem z wdrożeniem tej gałęzi. Skrypt jest na to
odporny — nie wywraca się, mówi wprost i prosi o powtórny `--apply` po wdrożeniu. Do tego
czasu tytuły artefaktów na stagingu zostają techniczne. **Nie uruchamiałem ręcznego DDL na
cudzym środowisku.**

---

## 4. Czego NIE zrobiono (wprost)

- **Tryb ciemny** — niesprawdzony (ten sam brak co w audycie).
- **Baseline / Predykcja / Wycena** — nietknięte. Ryzyko `409 BASELINE_CONTEXT_NOT_CONFIGURED`
  z audytu F0 pozostaje nierozstrzygnięte; **nie pokazywać Baseline na żywo**.
- **Panel 21 narzędzi wartości** (`FinanceValuePanelsSurface`) — przyczyna
  niewyrenderowania mimo `VITE_FINANCE_VALUE_PANELS=true` dalej nierozstrzygnięta.
- **Kosmetyka „-234,897 dni"** (nadmierna precyzja cyklu konwersji gotówki) — zostaje.
- **Wysokie wiersze tabeli wskaźników** — kolumna „Interpretacja" zawija się na trzy–cztery
  linie przy 1440 px; czytelne, ale nie eleganckie.
- **Kolejność pozycji w sprawozdaniu** idzie po `sort_order` taksonomii, co jest DUŻO lepsze
  od alfabetu kodów, ale nie jest jeszcze układem 1:1 z PDF (Aktywa trwałe przed obrotowymi).
- **Zero pushy.** Gałąź `fin/cdprojekt-do-pokazu` czeka na decyzję nadzorcy.
