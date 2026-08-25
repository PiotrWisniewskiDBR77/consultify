# INSTRUKCJA DYŻURU nr 12 — Codex — „Partner: `/partner` jako WYŁĄCZNIE pulpit podłączonego partnera (wykonanie decyzji D8), przepięcie bramki `connection` na kanoniczny `/api/v8/partner`, wycofanie treści marketingowej na publiczne trasy, test ścieżki niepodłączonej, sprzątnięcie crimsonu w pulpicie"

Dokument samodzielny. Zakładam, że dostajesz TYLKO ten plik i repozytorium
Consultify. Nie masz dostępu do rozmowy, w której powstał, ani do instrukcji
dyżurów nr 1–11. Wszystko, czego potrzebujesz, jest poniżej albo pod wskazanymi
ścieżkami w repo.

Data wystawienia: 2026-08-25.
Autor zlecenia: nadzorca sesji głównej, w imieniu właściciela produktu (Piotr).
Język pracy i raportowania: **polski**.

Poprzednie dyżury dotyczyły Admin/Superadmin, My Work, Results/Finance,
Initiatives, Szablonów, Assessment, Meetings i kolejnych obszarów (nr 1–11).
**Ten dyżur ich nie kontynuuje.** To osobny obszar integracji: **moduł
Partner**, w zakresie wykonania **decyzji właściciela `DEC-2026-08-24-08`
(„Partner — landing", dalej: D8)**.

**Uwaga o numeracji i tożsamości — przeczytaj, żeby się nie pomylić.**

| Moduł | Katalog rejestru w repo | Trasa runtime pulpitu | Trasy publiczne (marketing) | Decyzja wiążąca |
| --- | --- | --- | --- | --- |
| Partner | `docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/` | `/partner` (pulpit; `?tab=...`) + `/partner/onboarding` | `/become-partner`, `/become-partner/apply`, `/partner/pricing` | `DEC-2026-08-24-08` (`OWNER_DECISION_LEDGER_2026-08-24.md:30`) |

Numer katalogu rejestru `16_PARTNER` to numer modułu w **fali odbiorowej**, nie
numer dyżuru. Rejestr odbiorowy fali to **`modules/16_PARTNER/`** i tylko on
jest wiążący dla tego dyżuru. Rejestr uwag właściciela:
`docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/16_PARTNERS/`.

---

## ★ KRYTYCZNE OGRANICZENIE CAŁEGO DYŻURU — przeczytaj przed §0

**Cały ten dyżur to wykonanie jednej decyzji właściciela literą po literze.**
Kod dziś ją **łamie**: `/partner` renderuje pełną stronę marketingową dla
niepodłączonych i dla partnerów w fazie onboarding, zamiast pulpitu. Twoim
produktem jest **zgodność runtime z D8**, nie „ulepszenie strony partnera".

**Zacytuj D8 w raporcie dosłownie z `OWNER_DECISION_LEDGER_2026-08-24.md:30`:**

> `/partner` = wyłącznie pulpit operacyjny podłączonego partnera (domyślnie
> „Pulpit"). Ekran pierwszego podłączenia = osobny, jednoekranowy stan. Treści
> programowe/marketingowe wyłącznie na publicznych `/become-partner`,
> `/partner/apply`, `/partner/pricing`; siedem wewnętrznych podstron
> marketingowych wycofane z `/partner` z zapisem, gdzie treść żyje dalej.
> Bramki: `connection` decyduje podłączony/nie; `lifecyclePhase` tylko
> o zawartości pulpitu; stan nieznany/błąd nigdy nie pokazuje rejestracji.
> Ekonomia partnerska pozostaje wyłączona polityką AMD-PRT-ECONOMICS-002 —
> poza zakresem tej decyzji.

Z tego cytatu wynikają cztery twarde reguły całego dyżuru:

1. **`/partner` po Twoim dyżurze NIE pokazuje treści marketingowej w ŻADNYM
   stanie.** Ani dla niepodłączonego, ani dla partnera w onboardingu, ani
   w stanie błędu. Marketing żyje **wyłącznie** na trzech trasach publicznych
   wymienionych w D8.
2. **`connection` i `lifecyclePhase` to DWA różne sygnały o dwóch różnych
   rolach.** `connection` (podłączony / niepodłączony) decyduje, czy w ogóle
   wchodzisz na pulpit. `lifecyclePhase` (onboard/activate/earn/payout) decyduje
   **tylko o zawartości pulpitu** — nigdy o tym, czy pokazać marketing lub
   rejestrację. Dzisiejszy kod myli te role (patrz §2).
3. **Stan nieznany/błąd NIGDY nie pokazuje rejestracji ani marketingu.** To jest
   w D8 wprost. Uczciwy ekran wyjaśniający („nie ustaliliśmy Twojego statusu,
   spróbuj ponownie") — tak. Fallback do strony „zostań partnerem" — nie.
4. **Ekonomia partnerska (prowizje/wypłaty/salda) pozostaje WYŁĄCZONA**
   polityką `AMD-PRT-ECONOMICS-002`. Nie włączasz jej, nie budujesz jej UI, nie
   „naprawiasz" jej pod pretekstem pulpitu. Poza zakresem — twardo.

**Odbiór wizualny = nadzorca, po dyżurze.** D8 dotyka **pierwszego ekranu, jaki
partner widzi**. To jest dokładnie sytuacja z CLAUDE.md reguła 7: właściciel
nigdy nie jest pierwszym testerem wizualnym. Twoja rola kończy się na „gotowe do
zrzutu przez nadzorcę", z Twoimi własnymi zrzutami dev-render w dowodach.
**Nigdy** nie piszesz „gotowe do pokazania właścicielowi".

Naruszenie tego ograniczenia = odrzucenie dyżuru, niezależnie od jakości reszty.

---

## 0. TWARDE BEZPIECZNIKI — PRZECZYTAJ, ZANIM COKOLWIEK URUCHOMISZ

Te reguły są bezwzględne. Złamanie którejkolwiek = przerwanie dyżuru i wpis
w raporcie. Nie ma wyjątków „bo tak było szybciej".

### 0.1. Baza pracy, marker i gałąź

1. Punktem wyjścia jest **NAJNOWSZY tip gałęzi `codex/m03-admin-20260824`**.

   Nadzorca podaje Ci **SHA commitu-markera** przy wklejaniu tej instrukcji.

   **SHA markera: «MARKER_SHA»**

   ```bash
   cd <root-repo>
   git fetch --all --prune
   git log --oneline -25 codex/m03-admin-20260824
   git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo "MARKER OK" || echo "MARKER BRAK"
   ```

2. **Jeśli marker nie jest przodkiem tipa albo gałąź nie istnieje — STOP.**
   Nie improwizuj bazy. Nie startuj z `origin/demo`, nie startuj z `main`,
   nie startuj z `Londyn`, nie startuj z żadnej gałęzi `codex/preserve-*`
   ani `codex/wave3-16-module-acceptance-*`. Załóż raport, wpisz pozycję STOP
   z wynikiem obu komend powyżej i zakończ dyżur. To jedyna dopuszczalna
   reakcja.

   Powód twardości: `codex/m03-admin-20260824` niesie **komplet materiałów
   wiążących tego dyżuru** — rejestr decyzji z `DEC-2026-08-24-08` (D8),
   kanoniczny serwis `src/services/api/v8/partner.ts`, rejestr uwag właściciela
   `owner_feedback/16_PARTNERS/` i pytania otwarte `PAR-Q-001..005`. Praca poza
   tą bazą = praca bez wymagań.

3. **Sprawdź, że materiały wiążące faktycznie widzisz** (warunek wstępny,
   nie formalność):

   ```bash
   grep -n "DEC-2026-08-24-08" docs/program/waves/WAVE_03_ACCEPTANCE/OWNER_DECISION_LEDGER_2026-08-24.md   # oczekiwane :30
   grep -n "PAR-Q-001" docs/program/waves/WAVE_03_ACCEPTANCE/owner_feedback/16_PARTNERS/OWNER_FEEDBACK_REGISTER.md
   grep -n "getProgramStatus" src/services/api/v8/partner.ts
   grep -n "partners/connection" src/views/partner/PartnerPortalView.tsx     # oczekiwane :3046
   ls docs/program/waves/WAVE_03_ACCEPTANCE/modules/16_PARTNER/MODULE_ACCEPTANCE.md
   ```

   Brak któregokolwiek = **STOP**.

4. Tworzysz **własną świeżą gałąź** z tego tipa:

   ```bash
   git branch codex/partner-day12-<data> codex/m03-admin-20260824
   ```

   (Podmień `<data>` na faktyczną datę dyżuru, format `YYYYMMDD` — np.
   `codex/partner-day12-20260825`.)

5. Pracujesz we **własnym worktree**, nigdy w cudzym:

   ```bash
   git worktree add /private/tmp/consultify-partner-day12 codex/partner-day12-<data>
   cd /private/tmp/consultify-partner-day12
   ```

6. **Wszystkie porównania w raporcie robisz wobec bazy**, nie wobec `HEAD~1`:

   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```

### 0.2. Bezwzględne ZAKAZY

| # | Zakaz | Dlaczego |
| --- | --- | --- |
| Z1 | **Żadnego `git push` na `origin`** — w ogóle, na żadną gałąź | Push wykonuje wyłącznie nadzorca sesji głównej |
| Z2 | **Nie dotykasz `origin/demo`** ani lokalnego `demo`, ani `Londyn` | `demo` = święta baza deployu |
| Z3 | **Żadnego `--force`, `push --force-with-lease`, `git reset --hard` na gałęziach współdzielonych** | Krach 3/4 powstał dokładnie tak |
| Z4 | **NIE CZYTASZ i NIE KOPIUJESZ wariantów WIP właściciela** — plików `PRESERVED_PRODUCT_WIP` / `NO_COPY` z `CANONICAL_16_MODULE_SOURCE_CONTROL_MAP_2026-08-24.md` | Wymagania są już przełożone na rejestr uwag i D8. Zajrzenie tam nie da nic nowego, a może Cię skłonić do cofnięcia modułu |
| Z5 | **Nie dotykasz katalogu `/Users/piotrwisniewski/Developer/Consultify` — ani do zapisu, ani do odczytu, ani `git diff`, ani `cat`, ani `grep -r`** | Chroniony, brudny worktree właściciela |
| Z6 | **Nie dotykasz cudzych worktree** `/private/tmp/consultify-*` poza własnym `/private/tmp/consultify-partner-day12` | Cudze worktree, część w użyciu przez równoległe dyżury |
| Z7 | **Nie zajmujesz portów zajętych przez inne dyżury** (3987 sesja nadzorcza; 4280–4481 pasmo odbiorowe). Lokalny runtime — **4320/4321** | Kolizja portów psuje cudze runtime'y odbiorowe |
| Z8 | **Zero interakcji z Railway** — brak `railway` CLI, brak zmiennych env, brak redeployu, brak logów produkcyjnych | Produkcja/demo poza Twoim zakresem |
| Z9 | **Żadnej bazy poza jednorazowym lokalnym kontenerem** — nigdy baza demo/staging/produkcyjna, nigdy cudza retained-DB (`consultify_w3_partner_owner_recovered_20260823`) | Reguła „dane demo = twarz produktu". Retained-DB są dowodem odbiorowym cudzego etapu — nadpisanie kasuje dowód |
| **Z10** | **Zero nowych flag funkcyjnych. Zero zmian wartości domyślnej istniejącej flagi.** Nowy pulpit, jeśli zmienia wygląd, idzie za flagą **default OFF** (patrz §2.8, CLAUDE.md reguła 7) — ale nie mnożysz flag ponad jedną i nie włączasz jej sam | CLAUDE.md reguła 9 (zakaz masowego włączania flag) |
| **Z11** | **Nie zmieniasz gramatyki tras.** `/partner`, `/partner/onboarding`, `/become-partner*`, `/partner/pricing` zostają, jak są w `src/routes/routeConfig.ts` i `src/routes/AppRoutes.tsx`. Nie ruszasz `src/components/ProtectedRoute.tsx` ani guardów ról | Gramatyka tras jest ustalona; decyzje P0 dostępu poza Twoim zakresem |
| **Z12** | **Nie tworzysz nowych dokumentów rejestrowych.** Dokładnie JEDEN plik raportu: `docs/program/waves/WAVE_03_ACCEPTANCE/PARTNER_DAY12_REPORT_<data>.md`. Jedyny inny dokument do zmiany to `modules/16_PARTNER/MODULE_ACCEPTANCE.md` — i **wyłącznie** w ramach pozycji `R.1` | Repo tonie w dokumentach-duchach |
| **Z13** | **Nie zmieniasz decyzji w `OWNER_DECISION_LEDGER_2026-08-24.md`** (w szczególności `:30` D8) i nie podważasz ich w kodzie ani w raporcie | Rejestr decyzji jest `FINAL / IRREVOCABLE` |
| **Z14** | **Zakaz włączania i budowania ekonomii partnerskiej** (prowizje/salda/wypłaty/`payout`). `AMD-PRT-ECONOMICS-002` = OFF. Nie podpinasz endpointów ekonomicznych, nie renderujesz sald jako żywych danych | Poza zakresem D8; ekonomia to osobna decyzja właściciela |
| **Z15** | **Nie usuwasz i nie „naprawiasz" uczciwych stanów pustych/błędnych.** `PartnerStartRouter.tsx` odmawia fallbacku do rejestracji w stanie unknown/error — ta odmowa jest **wprost wymagana przez D8** i zostaje | Uczciwy pusty/błędny stan > udawany ekran. Cofnięcie = odrzucenie dyżuru |
| **Z16** | **★ Zakaz wszystkiego poza modułem Partner.** Nie dotykasz: Organization, Settings, Admin, Superadmin, Chat, Interview, Assessment, Tools, Initiatives, Execution, Results, Finance, Audits, Meetings, My Work. Granica w ramce §0.2a | Program konsolidacji = „jeden moduł na raz" |
| **Z17** | **★★ NAJOSTRZEJSZY — ABSOLUTNY zakaz modyfikowania globalnej infrastruktury testowej.** Nie dotykasz `tests/setup.ts`, `tests/helpers/**`, `tests/__mocks__/**`, `vitest.config.ts` ani żadnego `vitest.*.config.ts`, `server/vitest.config*.ts`, ani żadnego mocka/helpera współdzielonego przez całe repo. **Naruszenie = automatyczne odrzucenie CAŁEGO dyżuru** | **Lekcja z odbioru dnia 2:** cicha zmiana globalnego mocka w `tests/setup.ts` wywaliła 27 testów w cudzych modułach |
| **Z18** | **Serwer: legacy vs kanon.** Wolno CZYTAĆ `server/src/routes/partners.routes.ts` i `server/src/routes/v8/partner.routes.ts`. Jeśli P.1 wymaga **nowego** kanonicznego endpointu connection — patrz §2.4 i §P.1, to jest praca **dozwolona, ale z twardym warunkiem addytywności i STOP przy dwuznaczności semantyki** | Legacy `/api/partners/connection` jest deprecjonowany, ale wciąż głównym callerem; kanon może nie mieć jeszcze GET connection |

**Zasięg Z17 — konkretnie, bo to jest zakaz, który najłatwiej złamać
„w dobrej wierze".**

```
tests/setup.ts
tests/helpers/**
tests/__mocks__/**
vitest.config.ts  vitest.l1.config.ts  vitest.l2.config.ts  vitest.l3.config.ts
vitest.acceptance.config.ts  vitest.security.config.ts  vitest.orphans.config.ts
server/vitest.config.ts  server/vitest.config.v8-db.ts
tests/integration/**/vitest.*.config.ts
```

**Co robisz, gdy potrzebujesz innego zachowania mocka.** Dokładnie jedno
z dwóch, zawsze **opt-in, nigdy globalnie**:

1. **`vi.mock` lokalnie w Twoim pliku testowym** — mock żyje i umiera razem
   z tym jednym plikiem;
2. **dedykowany helper w NOWYM pliku**, importowany jawnie tylko przez Twoje
   testy (np. `tests/components/partner/partnerDay12Harness.ts`).

**Nie wolno**: „tylko dodam jedno pole do globalnego mocka". Jeśli Twój test nie
przechodzi bez zmiany globalnego mocka — to jest **STOP**, opisany w raporcie.

### 0.2a. Granica zakresu — ostra, plik po pliku

```
WOLNO (Twój zakres):
  src/views/partner/PartnerPortalView.tsx        (bramka connection, render, sprzątnięcie crimsonu)
  src/views/partner/PartnerStartRouter.tsx       (rola lifecyclePhase — TYLKO zawartość pulpitu)
  src/views/partner/ClientAccessView.tsx         (crimson + i18n; przebudowa StandardTable TYLKO jeśli P.6 → TAK)
  src/views/partner/ProviderHomeView.tsx         (marketing — WYCOFYWANY z /partner, patrz P.3)
  src/views/partner/partnerLegacyRoutes.ts       (mapowanie sekcji — jeśli dotyczy retirementu)
  src/components/Partner/**                       (PartnerLayout, Sidebar — powłoka pulpitu)
  src/services/api/v8/partner.ts                 (WYŁĄCZNIE dopisanie metody connection, jeśli P.1 tego wymaga)
  server/src/routes/v8/partner.routes.ts         (WYŁĄCZNIE nowy addytywny GET connection, jeśli §2.4/P.1)
  server/src/services/partnerConnectionService.ts (WOLNO CZYTAĆ i WOŁAĆ; zmiana semantyki = STOP)
  public/locales/{pl,en}/translation.json        (TYLKO klucze partner.*)
  docs/.../modules/16_PARTNER/MODULE_ACCEPTANCE.md (TYLKO §R.1)
  docs/.../modules/16_PARTNER/evidence/**         (TYLKO nowe zrzuty §R.2)
  docs/.../PARTNER_DAY12_REPORT_<data>.md         (jedyny nowy dokument)
  tests/components/partner/**  ·  tests/integration/partners/**  (NOWE pliki; istniejące — patrz §T.1)

NIE WOLNO:
  src/components/standard/**  ·  src/components/shared/**   ← WOLNO UŻYWAĆ, NIE WOLNO ZMIENIAĆ
  src/routes/AppRoutes.tsx  ·  src/routes/routeConfig.ts    ← gramatyka tras (Z11)
  src/components/ProtectedRoute.tsx  · guardy ról            ← Z11
  server/src/routes/partners.routes.ts                      ← legacy: TYLKO ODCZYT (deprecjonowany, nie ruszasz)
  wszystko poza modułem Partner (Z16)
```

Jeśli Twoja praca wymagałaby zmiany w pliku spoza ramki „WOLNO" — to **nie
jest** praca w zakresie tego dyżuru. Zatrzymujesz się, opisujesz w raporcie, co
dokładnie brakuje, i idziesz dalej. Wyjątku nie ma nawet dla „jednej linii".

### 0.3. Higiena wykonania

- **Commit per pozycję.** Jedna pozycja = jeden commit. Nie zbiorcze „fix partner".
- **Conventional commits**, wzór:
  ```
  fix(partner): gate /partner on canonical connection, never marketing (P.1)
  fix(partner): unconnected/onboarding/error → orientation, never registration (P.2)
  refactor(partner): retire marketing subpages to public routes (P.3)
  test(partner): unconnected /partner shows no acquisition surface (P.4)
  fix(partner): remove decorative crimson from partner dashboard (P.x)
  ```
- **★ `prettier` OBOWIĄZKOWY przed KAŻDYM commitem.**
  ```bash
  npx prettier --write <lista plików tego commita>
  ```
- **Testy celowane per pozycja** — **nigdy pełny `tsc` ani pełny `vitest` repo.**
  ```bash
  npx vitest run tests/components/partner
  npx vitest run tests/unit/services/v8-partner-api.test.ts
  npx vitest run tests/integration/partners
  ```
- **★ KAŻDA nowa/zmieniona ścieżka renderu = minimum CZTERY testy zachowania**:
  podłączony (pulpit) · niepodłączony (BRAK marketingu na `/partner`) · onboarding
  (pulpit-orientacja, nie marketing) · błąd/unknown (ekran wyjaśniający, nigdy
  rejestracja). Dla nowego endpointu connection dodatkowo **negatyw tenanta**
  (obcy `organizationId` nie dostaje `connected:true` cudzego partnera).
- **★ TESTY DOWODOWE TYLKO BEHAWIORALNE.** Test, który czyta plik źródłowy
  i asertuje `expect(source).toContain('...')`, **nie liczy się do DoD**. Każda
  pozycja ma co najmniej jeden test renderujący realny komponent / wołający realny
  handler i sprawdzający WYNIK. Grep-test wolno dołożyć jako dodatek.
- **NOWE pliki w `tests/` wymagają `git add -f`.** Pliki `__tests__` obok kodu
  w `src/` dodają się normalnie.
- **Sprawdzanie typów punktowo**, nie całe repo:
  ```bash
  npx tsc --noEmit -p tsconfig.json    # ZAKAZANE (godziny, wyczerpuje stertę)
  npx esbuild src/views/partner/PartnerPortalView.tsx --loader:.tsx=tsx --outfile=/dev/null   # OK
  ```
- **★ MIGRACJE — jeśli w ogóle konieczne (raczej NIE w tym dyżurze).** Wyłącznie
  addytywne (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`,
  `INSERT ... ON CONFLICT DO NOTHING`). Zakaz `DROP`/`RENAME`/`ALTER COLUMN TYPE`/
  bezwarunkowego `UPDATE`. Ten dyżur to głównie przepięcie odczytu i render —
  jeśli sięgasz po migrację, to jest sygnał, że przeceniłeś zakres: **zatrzymaj
  się i sprawdź**, czy kanoniczny odczyt już istnieje (§2.4).
- **Hooki pre-commit działają i będą Cię blokować.** Nie obchodź ich przez
  `--no-verify`. `scripts/check-list-canon.sh` blokuje własne tabele — jeśli
  robisz P.6 (StandardTable), ten hook jest Twoim sprzymierzeńcem, nie wrogiem.
  ```bash
  bash scripts/check-list-canon.sh src/views/partner/ClientAccessView.tsx
  ```
  **`scripts/check-list-canon.sh --update` jest w tym dyżurze ZAKAZANE.**
- **Dane demo = twarz produktu.** Każdy probe sprząta po sobie. Zero rekordów
  testowych zostawionych w jakiejkolwiek bazie.

### 0.4. Definicja ukończenia (DoD) — obowiązuje KAŻDĄ pozycję

**Pozycja** jest zrobiona dopiero, gdy spełnia **wszystkie dziesięć**:

1. **Realne dane.** Odczyt idzie do backendu (kanonicznego, §2.4). Zero mocków,
   zero `sampleData`, zero zaszytych tablic, zero `localStorage` jako źródła
   prawdy. Pusty/błędny wynik z API = uczciwy stan, nie fikcyjne dane, **i nigdy
   nie marketing/rejestracja** (D8).
2. **Zapis z readbackiem** — jeśli pozycja zapisuje (connect), po `POST` ekran
   ponownie odczytuje stan z serwera. Zakaz optymistycznego „sukces" bez
   potwierdzenia.
3. **Zero atrap.** Każda kontrolka coś robi. Kontrolka bez API — **nie powstaje**;
   zamiast niej wpis `BRAK_API` do raportu.
4. **Minimum 4 testy zachowania** przechodzą (§0.3). Testy grepujące źródło się
   nie liczą.
5. **Zero crimsonu dekoracyjnego.** `primary-*` KAŻDY numer = crimson `#85182F`.
   Czerwień **wyłącznie** semantyka krytyczna. CTA i stany aktywne = neutralne,
   **nigdy `bg-c-accent`**, **nigdy `text-primary-600` jako akcent dekoracyjny**.
   Fokus = niebieski `focus-visible:ring-2 ring-[color:var(--c-focus)]`.
   **Uwaga:** pulpit partnera (`PartnerPortalView.tsx`, `ClientAccessView.tsx`)
   ma dziś **~57 wystąpień `primary-*`** — sprzątnięcie ich w powierzchniach,
   które dotykasz, jest częścią DoD (patrz §2.8).
6. **i18n PL + EN OD RAZU**, w tym samym commicie co kod. Zero polskich literałów
   w JSX, zero angielskich literałów w JSX. Klucze w
   `public/locales/{pl,en}/translation.json`. Stan zastany: **468 kluczy
   `partner.*` w PL i 468 w EN, parytet pełny** (§2.7) — Twój dyżur ten parytet
   utrzymuje.
7. **Light i dark** — powierzchnia wygląda poprawnie w obu motywach.
8. **★ Zrzut własny dla każdej NOWEJ/zmienionej powierzchni wizualnej** —
   dev-render/harness z danymi z fixture, **light i dark, PL**, wykonany przez
   Ciebie, wrzucony do `modules/16_PARTNER/evidence/day12/`. Zrzut czysty: zero
   gwiazdek, zero ozdób, tokeny `c-*`. **Bez zrzutu pozycja wizualna jest
   CZĘŚCIOWA.** Cztery stany do udokumentowania: podłączony · niepodłączony ·
   onboarding · błąd/unknown.
9. **Plik przepuszczony przez `prettier`** przed commitem.
10. **Wpis w raporcie**: `pozycja → commit SHA → status → dowód`.

### 0.4a. ★ POMIAR ZASIĘGU TESTÓW — warunek oddania raportu

**Lekcja z odbioru dnia 2:** raport deklarował „N/N PASS", ale liczone było
wyłącznie na plikach własnych; równolegle 27 testów w cudzych modułach było
czerwonych.

**Przed oddaniem raportu:**

1. Wypisz wszystkie dotknięte pliki:
   ```bash
   git diff --name-only codex/m03-admin-20260824...HEAD
   ```
2. Wyodrębnij pliki **współdzielone** i sprawdź ich konsumentów jawnie:
   ```bash
   grep -rln "from '@/services/api/v8/partner'\|api/v8/partner" src/ tests/ | wc -l
   grep -rln "partnerConnectionService" server/src/ tests/ | head -20
   grep -rln "PartnerPortalView\|PartnerStartRouter\|ProviderHomeView" src/ tests/ | head -20
   ```
   **Pliki współdzielone z definicji w tym dyżurze:**
   `src/services/api/v8/partner.ts` (importowany przez wiele powierzchni partnera),
   `public/locales/{pl,en}/translation.json` (globalny),
   `server/src/routes/v8/partner.routes.ts` (jeśli dodasz endpoint).
3. **Uruchom testy KATALOGÓW konsumentów**, nie tylko własnych plików:
   ```bash
   npx vitest run tests/components/partner
   npx vitest run tests/unit/services/v8-partner-api.test.ts
   npx vitest run tests/unit/services/partner-trust-runtime.test.ts
   npx vitest run tests/integration/partners
   ```
4. **W raporcie deklarujesz zasięg jawnie**: `ZASIĘG PEŁNY` (uruchomiłeś testy
   wszystkich katalogów konsumentów tego, co ruszyłeś, z wynikami) albo
   `ZASIĘG CZĘŚCIOWY` (tylko własne — wtedy piszesz to wprost i wymieniasz, czego
   nie uruchomiłeś i dlaczego).

**To nie jest pełny `vitest` repo** (nadal zakazany — §0.3). To jest pomiar
celowany: katalogi konsumentów tego, co ruszyłeś.

### 0.5. Reguła STOP

**Przy jakiejkolwiek wątpliwości: STOP i wpis w raporcie — nigdy improwizacja.**

Konkretnie zatrzymujesz się i opisujesz problem, gdy:

- **kanoniczny `/api/v8/partner` nie eksponuje jednoznacznego sygnału
  „connected"** i mapowanie connection ⇄ lifecyclePhase jest dwuznaczne
  (§2.4). **To jest w tym dyżurze najbardziej prawdopodobny STOP.** Nie
  zgadujesz semantyki „podłączony" — piszesz propozycję i STOP;
- musiałbyś **osłabić albo usunąć asercję w teście istniejącym wcześniej** — poza
  jednym jawnym wyjątkiem opisanym w §T.1 (test route-alignment `:102`, który
  dziś asertuje ZŁE, przed-D8 zachowanie);
- musiałbyś **włączyć albo zbudować ekonomię partnerską** (Z14);
- musiałbyś **stworzyć drugą flagę funkcyjną** albo włączyć swoją sam (Z10);
- musiałbyś **zmienić gramatykę tras** `/partner*` / `/become-partner*` (Z11)
  albo guard ról;
- musiałbyś **zbudować kontrolkę, dla której nie ma API** — wtedy wpis `BRAK_API`
  z pełną tabelą jest **wynikiem pełnowartościowym**;
- musiałbyś **zmienić semantykę `partnerConnectionService`** albo legacy
  `partners.routes.ts` — wolno je **czytać i wołać**; zmiana = STOP;
- musiałbyś dotknąć innego modułu (Z16) albo globalnej infrastruktury testowej (Z17);
- musiałbyś rozstrzygnąć **kwestię komercyjną** `PAR-Q-001/002/003/005` — to
  decyzja Piotra, nie kod (patrz §1.7);
- **pomiar zasięgu (§0.4a) pokazał czerwone testy w cudzym module** — nie
  „naprawiasz" ich po cichu: opisujesz, który commit je zapalił.

Format wpisu STOP w raporcie:

```
### STOP — <pozycja>
Powód: <jedno zdanie>
Dowód: <plik:linia lub komenda + wynik>
Co zrobiłbym, gdyby zapadła decyzja X: <2-3 zdania>
Stan: NIE ZACOMMITOWANO / zacommitowano częściowo w <SHA>
```

---

## 1. KONTEKST — co się wydarzyło i gdzie jesteśmy

### 1.1. Skąd bierze się ten dyżur

Właściciel podjął 2026-08-24 decyzję D8 (`DEC-2026-08-24-08`, `OWNER_ACCEPT`):
`/partner` ma być **wyłącznie pulpitem operacyjnym podłączonego partnera**.
Rekonesans runtime (nie docy — reguła złota nr 1) wykazał, że **kod tej decyzji
NIE realizuje**:

- `grep -rn "D8\|DEC-2026-08-24-08" src/ server/` = **0 trafień w kodzie** — nikt
  nie tknął implementacji od czasu decyzji;
- `src/views/partner/ProviderHomeView.tsx` (pełna strona marketingowa) ma
  najświeższy commit **sprzed** decyzji;
- runtime `/partner` dla niepodłączonego i dla partnera w onboardingu renderuje
  marketing, a nie pulpit (dowód w §2).

To jest **realna praca integracyjna**, nie kosmetyka: przepięcie źródła prawdy
o połączeniu, zmiana tego, co renderuje się w każdym z czterech stanów, i
wycofanie siedmiu podstron marketingowych na trasy publiczne.

### 1.2. Dokumenty wiążące merytorycznie

| Dokument | Rola |
| --- | --- |
| `OWNER_DECISION_LEDGER_2026-08-24.md:30` (D8) | **Jedyne źródło prawdy o docelowym zachowaniu.** Cytat w §0 górze |
| `owner_feedback/16_PARTNERS/OWNER_FEEDBACK_REGISTER.md` | Rejestr uwag właściciela + pytania otwarte `PAR-Q-001..005` |
| `owner_feedback/16_PARTNERS/PAR_OWN_001_CONTENT_MATRIX.md` | Macierz treści partnera (gdzie która treść żyje) — przydatne do zapisu retirementu w P.3 |
| `modules/16_PARTNER/MODULE_ACCEPTANCE.md` | Rejestr odbiorowy fali; obecna bramka `TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF` |
| `CLAUDE.md` reguły 7 i 9 | Właściciel nie jest pierwszym testerem wizualnym; zakaz masowego włączania flag |

### 1.3. Decyzje wiążące

- **D8** (`DEC-2026-08-24-08`) — pełny cytat w §0. `FINAL / IRREVOCABLE`.
- **`AMD-PRT-ECONOMICS-002`** — ekonomia partnerska OFF. Nie ruszasz.
- **`PAR-Q-004`** (audience i landing) w rejestrze uwag jest formalnie
  `OPEN_UNRECONCILED`, **ale D8 je rozstrzyga**: `/partner` = pulpit-only.
  Gdziekolwiek zobaczysz sugestię „state-aware router serving both / acquisition
  surface for prospects", **D8 ma pierwszeństwo** (jest późniejsze i zaakceptowane).
  Odnotuj tę nadpisaność w raporcie, nie zmieniaj rejestru uwag (Z12).

### 1.4. ★ Znane pułapki — przeczytaj, zanim zaczniesz

1. **`connection` i `lifecyclePhase` to dwa sygnały, nie jeden.** Dzisiejszy
   `PartnerStartRouter.tsx` (komentarz w nagłówku) opiera się na decyzji
   **`owner decision 2026-08-05`**, która kazała onboardingowi pokazywać
   „acquisition + onboarding step". **D8 (2026-08-24) to nadpisuje.** Nie
   traktuj komentarza `2026-08-05` jak prawa — jest starszy niż D8.
2. **Marketing wycieka DWOMA drogami** (obie musisz zamknąć):
   - **niepodłączony** (`isConnected===false`) → `renderProgramContent()` →
     pełny marketing (`ProgramBenefitsView`, kalkulator, Academy, FAQ);
   - **podłączony, ale `lifecyclePhase` = onboard/onboarding** →
     `PartnerStartRouter` renderuje `onboardingSurface = <ProviderHomeView />`
     → pełny marketing.
   Zamknięcie tylko jednej drogi = D8 dalej złamane.
3. **Legacy `/api/partners/connection` jest deprecjonowany, ale wciąż głównym
   callerem.** Bramka w `PartnerPortalView.tsx:3046` czyta legacy. Kanon to
   `/api/v8/partner` (`src/services/api/v8/partner.ts`). Przepięcie musi
   zachować **dokładnie tę samą semantykę „podłączony"** — inaczej podłączeni
   partnerzy nagle wypadają na ekran wyjaśniający. Patrz §2.4.
4. **i18n NIE jest tak zepsute, jak wygląda.** Parytet `partner.*` jest **pełny
   (468/468)**, a klucze mają realne polskie wartości (`partner.clientAccess.
   noClients` = `„Nikogo tu nie ma"`). Angielskie napisy w `ClientAccessView.tsx`
   to **drugi argument `t()` (fallback domyślny)**, który w trybie PL **nie
   renderuje się**, bo klucz istnieje. Czyli P.5 to głównie **higiena kodu**
   (usunięcie angielskich fallbacków-literałów), a nie widoczny użytkownikowi
   wyciek EN. **Nie raportuj tego jako user-facing bug — to byłoby zawyżenie.**
   Twój obowiązek: sprawdzić runtime (`i18next` w trybie `pl`), potwierdzić, że
   napisy renderują się po polsku, i dopiero wtedy zdecydować o zakresie P.5.
5. **Partner nie używa `StandardTable` nigdzie** (`grep -rl StandardTable
   src/views/partner src/components/Partner` = 0). `ClientAccessView.tsx` robi
   bespoke listę (`filteredClients.map(ClientRow)`). To jest kandydat do fali
   triady list — **ale tylko jeśli P.6 zostanie potwierdzone jako TAK** (§P.6).

### 1.5. ★ Reguła 7 — dlaczego nic nie idzie na ekran właściciela

D8 dotyka **pierwszego ekranu partnera**. To jest kanoniczna sytuacja z reguły 7
CLAUDE.md. Nowy pulpit / zmieniony render idzie **za flagą default OFF**, a Ty
robisz **własne zrzuty dev-render** (light+dark, PL) dla wszystkich czterech
stanów. Właściciel patrzy dopiero po Tobie i po nadzorcy — do AKCEPTU, nie do
odkrywania zepsucia. Nigdy „włącz flagę i zobacz" jako pierwszego sprawdzenia.

### 1.6. Pozycje otwarte — czego NIE ZGADUJESZ (STOP-y komercyjne)

Cztery pytania są **komercyjne, decyzja Piotra, nie kod** — przy każdym STOP:

- **`PAR-Q-001`** — Final commercial schedule (prowizje/tiery/wypłaty/SLA do
  publikacji). `OPEN_UNRECONCILED`.
- **`PAR-Q-002`** — Publishable references (realne case'y/logo/liczby ze zgodą).
  `OPEN_UNRECONCILED`.
- **`PAR-Q-003`** — Live capability boundary (co jest żywe, co „limited/planned").
  `OPEN_UNRECONCILED`.
- **`PAR-Q-005`** — Final information hierarchy (dziewięcioczęściowa hierarchia
  role-aware vs osobne strony per typ partnera). `OPEN_UNRECONCILED`.

`PAR-Q-004` jest rozstrzygnięte przez D8 (§1.3) — to jedyne z piątki, którego
NIE stawiasz jako STOP.

---

## 2. MAPA TECHNICZNA — skrót niezbędny

> **Blok 0 (§3) każe Ci tę mapę zweryfikować własnymi oczami na tipie, zanim
> cokolwiek zmienisz.** Numery linii mogą się przesunąć — sprawdzasz je, nie
> ufasz im na słowo.

### 2.1. Rozmiar obszaru

- `src/views/partner/PartnerPortalView.tsx` — **3342 linie**. Główny plik:
  bramka connection, wybór sekcji, render pulpitu vs marketingu.
- `src/views/partner/ProviderHomeView.tsx` — **744 linie**, pełny marketing
  (Hero, ValueCards, CommissionCalculator, Academy, Tiers, SuccessStories,
  OnboardingChecklist, ContactManager, FAQ).
- `src/views/partner/PartnerStartRouter.tsx` — **294 linie**, router
  lifecyclePhase (loading/error/onboarding/active/unknown).
- `src/views/partner/ClientAccessView.tsx` — bespoke lista klientów.

### 2.2. Bramka connection — stan faktyczny (zweryfikuj)

`PartnerPortalView.tsx`:

- **`:3042`** `const [isConnected, setIsConnected] = useState<boolean>(false);`
- **`:3046`** `const response = await Api.get('/api/partners/connection');`
  ← **LEGACY endpoint**, nie kanoniczny `/api/v8/partner`.
- **`:3049`** ustawia `isConnected` z `data.connected` (boolean).
- **`:3315`** `!isConnected ?` → `renderProgramContent()` (marketing) `:` render
  pulpitu.
- **`:3070–3071`** dla niepodłączonego wymusza sekcję `partner-home` i trzyma go
  w powierzchni programowej.

**Wniosek:** dziś sygnał „podłączony" pochodzi z **legacy** endpointu. P.1 = to
przepiąć na kanon, bez zmiany znaczenia „podłączony".

### 2.3. Dwie drogi wycieku marketingu (zweryfikuj obie)

- **Droga A — niepodłączony.** `PartnerPortalView.tsx:3272` `renderProgramContent()`
  mapuje sekcje sidebara na `ProgramBenefitsView`, `ProgramStoriesView`,
  `ProgramTiersView`+`ProgramCalculatorView`, `ProgramOnboardingView`+
  `ProgramContactView`, `ProgramAcademyView`, `ProgramResourcesView`,
  `ProgramFaqView`, `ProviderHomeView`. To jest **siedem podstron marketingowych**
  z D8. `PartnerLayout ... programMode={!isConnected}` (`:3309`).
- **Droga B — podłączony, ale onboarding.** `PartnerPortalView.tsx:3221`
  case `'partner-home'` renderuje `<PartnerStartRouter onboardingSurface=
  {<ProviderHomeView />} />`. `PartnerStartRouter.tsx:150–153`: gdy
  `variant === 'onboarding'` → zwraca `onboardingSurface` (czyli marketing).

### 2.4. ★ Kanon vs legacy — RDZEŃ RYZYKA P.1

- Kanoniczny serwis: `src/services/api/v8/partner.ts`. Ma:
  - `getProgramStatus: () => v8Get<V8PartnerProgramStatus>('/partner/program/status')`
    (`:413`) — zwraca `lifecyclePhase` (`onboard|activate|earn|payout`);
  - `connect(...)` (POST, `:387`) z wynikiem `V8PartnerConnectResult { connected: boolean }`
    (`:335`).
- Serwer kanon: `server/src/routes/v8/partner.routes.ts` — ma
  `GET /api/v8/partner/program/status` (`:291`), **ale rekonesans nie znalazł
  kanonicznego `GET .../connection`** zwracającego czysty boolean „podłączony".
- Legacy connection żyje w `server/src/services/partnerConnectionService.ts`
  (wołany przez `partners.routes.ts:288 GET /connection`).

**To jest dwuznaczność, którą MUSISZ rozstrzygnąć w Bloku 0, a nie zgadnąć:**

- **Wariant 1 (preferowany, jeśli semantyka się zgadza):** dodaj **addytywny**
  kanoniczny `GET /api/v8/partner/connection`, który czyta ten sam
  `partnerConnectionService` co legacy (żadnej nowej logiki połączenia — to samo
  źródło), i dopisz metodę w `src/services/api/v8/partner.ts`. Bramka
  `PartnerPortalView` przechodzi na tę metodę.
- **Wariant 2:** jeśli „podłączony" jest już jednoznacznie wyprowadzalny z
  `program/status` (np. brak rekordu partnera / konkretna faza = niepodłączony),
  użyj `getProgramStatus` bez nowego endpointu.
- **Jeśli obie ścieżki dają NIESPÓJNY wynik** (partner podłączony wg legacy,
  a wg v8 „unknown") — **STOP**, opisz rozjazd, zaproponuj Wariant 1 i czekaj na
  decyzję. Nie przepinaj „na oko": ryzyko, że podłączeni partnerzy wypadną na
  ekran wyjaśniający na produkcji.

Zakaz: nie zmieniasz semantyki `partnerConnectionService` ani legacy route —
tylko czytasz/wołasz (Z18).

### 2.5. Trasy publiczne (cel retirementu P.3) — potwierdzone

`src/routes/routeConfig.ts`: `BECOME_PARTNER: '/become-partner'` (`:26`),
`PUBLIC_APPLY: '/become-partner/apply'` (`:282`), `PRICING: '/partner/pricing'`
(`:283`). `AppRoutes.tsx:1112/1122/1132` montuje `BecomePartnerView`,
`PartnerApplicationView`, `PartnerPricingView`.

**Uwaga — rozjazd z literą D8:** D8 pisze `/partner/apply`, a faktyczna trasa to
`/become-partner/apply`. To **nie jest** upoważnienie do zmiany gramatyki tras
(Z11). W Bloku 0 potwierdź, na której trasie realnie żyje formularz aplikacji,
i **w raporcie zapisz mapowanie**, gdzie każda z siedmiu treści marketingowych
żyje dalej (D8 wymaga tego zapisu wprost). Jeśli któraś treść nie ma odpowiednika
na trasie publicznej — to `BRAK_CELU_RETIREMENTU`, STOP z propozycją, nie
kasowanie treści bez adresu docelowego.

### 2.6. Testy zastane — co Cię pilnuje i co jest do naprawy

- `tests/components/partner/PartnerPortalView.route-alignment.test.tsx`:
  - `beforeEach` (`:56–60`) mockuje `connected: true` **bezwarunkowo** dla
    większości przypadków → ścieżka podłączona jest testowana, niepodłączona
    domyślnie nie.
  - **ALE** przypadek `:102` „shows the ready Consultify partner program before
    profile connection" mockuje `connected: false` i **asertuje, że marketing
    JEST pokazany na `/partner`** (`findByText('Program overview')`,
    `getByText('Models and commercial terms')`). **Ten test enshrine'uje
    zachowanie sprzeczne z D8.** Jego przepisanie to jedyny dopuszczalny przypadek
    zmiany istniejącej asercji (§T.1).
- `tests/components/partner/PartnerStartRouter.routing.test.tsx`,
  `tests/unit/services/v8-partner-api.test.ts`,
  `tests/integration/partners/*` — pilnują kanonu v8, ekonomii OFF, negatywów
  tenanta. **Nie osłabiasz ich.**

### 2.7. i18n — parytet pełny, u Ciebie ma taki zostać

```
partner.* : PL 468, EN 468, PL-only [], EN-only []
```

Utrzymujesz parytet. Każdy nowy napis = klucz w PL i EN w tym samym commicie.
Angielskie literały jako drugi argument `t()` (fallback) w powierzchniach, które
dotykasz, zastępujesz kluczem — ale to higiena, nie „bug EN w PL" (§1.4 pkt 4).

### 2.8. Kanon UI — co obowiązuje

- **Zero crimsonu dekoracyjnego.** `PartnerPortalView.tsx` ma ~49 wystąpień
  `primary-*` (m.in. `:418/419/439/456/458/459/476/509/525/533` + spinnery
  `:3313/3320/3331` `border-primary-600`), `ClientAccessView.tsx` ~8. W każdej
  powierzchni, którą dotykasz, sprzątasz je na tokeny `c-*` / neutralne. Hook
  `check-list-canon.sh` / `check-artefakt.sh` może Cię blokować — popraw kod,
  nie hook.
- **Pulpit (lista klientów) — jeśli P.6 = TAK**, ekran listowy przechodzi na
  `StandardTable`/`StandardModuleBar` z `src/components/standard/` (skill
  `consultify-triada`). Powłoki NIE kleją własnych tabel (złamany kanon 07-12).
  **Jeśli P.6 = NIE** (decyzja nadzorcy w Bloku 0), zostawiasz bespoke listę i
  ograniczasz się do crimsonu + i18n.
- Nowy/zmieniony wygląd pulpitu = **flaga default OFF** + Twoje zrzuty (reguła 7).

---

## 3. KOLEJNOŚĆ PRACY

### Blok 0 — start (obowiązkowo, ~70 min, NIE pomijasz)

Zanim dotkniesz kodu, **zweryfikuj mapę §2 własnymi oczami** i wpisz wynik do
raportu (sekcja „Blok 0 — weryfikacja mapy"). Minimum:

```bash
# 1. Marker i baza (§0.1)
git merge-base --is-ancestor «MARKER_SHA» codex/m03-admin-20260824 && echo OK || echo BRAK

# 2. Bramka legacy — potwierdź linię i endpoint
grep -n "partners/connection\|isConnected\|renderProgramContent\|programMode" src/views/partner/PartnerPortalView.tsx

# 3. Dwie drogi wycieku marketingu
grep -n "onboardingSurface\|ProviderHomeView\|variant === 'onboarding'" src/views/partner/PartnerStartRouter.tsx

# 4. Kanon vs legacy — RDZEŃ RYZYKA (§2.4): czy istnieje kanoniczny GET connection?
grep -rn "connection\|connected" server/src/routes/v8/partner.routes.ts
grep -n "getProgramStatus\|connect\|connected" src/services/api/v8/partner.ts

# 5. Test enshrine'ujący złe zachowanie
sed -n '100,131p' tests/components/partner/PartnerPortalView.route-alignment.test.tsx

# 6. Trasy publiczne (cel retirementu)
grep -n "become-partner\|partner/apply\|partner/pricing\|PUBLIC_APPLY\|PRICING" src/routes/routeConfig.ts

# 7. i18n runtime — potwierdź PL renderuje po polsku (nie EN fallback)
grep -c "partner" public/locales/pl/translation.json

# 8. Crimson do sprzątnięcia
grep -c "primary-[0-9]" src/views/partner/PartnerPortalView.tsx src/views/partner/ClientAccessView.tsx
```

**Rozstrzygnięcie §2.4 (kanon connection) MUSI zapaść w Bloku 0.** Jeśli
dwuznaczne → STOP przed jakąkolwiek zmianą bramki. Wynik (Wariant 1/2/STOP)
zapisujesz do raportu.

**Rozstrzygnięcie P.6 (StandardTable) MUSI zapaść w Bloku 0** — to decyzja
zakresu (patrz §P.6). Domyślnie: **NIE w tym dyżurze**, chyba że nadzorca w
markerze / instrukcji potwierdzi wejście Partnera w falę triady.

### Blok 1 — bramka na kanon (P.1)
Przepięcie `connection` na kanoniczny odczyt (§2.4), test negatywny: niepodłączony
NIE widzi marketingu na `/partner`.

### Blok 2 — cztery stany bez marketingu (P.2)
Niepodłączony / onboarding / błąd / unknown → pulpit-orientacja albo ekran
wyjaśniający. Nigdy rejestracja/marketing. Obie drogi wycieku (§2.3) zamknięte.

### Blok 3 — retirement marketingu (P.3)
Wycofanie siedmiu podstron z `/partner`, zapis „gdzie treść żyje dalej" (§2.5).

### Blok 4 — testy ścieżki niepodłączonej (P.4) + przepisanie testu `:102` (§T.1)

### Blok 5 — higiena: crimson + i18n (P.5) w dotykanych powierzchniach

### Blok 6 — (warunkowo) P.6 StandardTable, jeśli Blok 0 = TAK

### Blok 7 — dowody, zrzuty własne, rejestr (§R), raport, pomiar zasięgu (§0.4a)

---

## 4. POZYCJE — definicje ukończenia

### P.1 — Przepięcie bramki `connection` na kanoniczny `/api/v8/partner`

**Ukończone, gdy:** bramka w `PartnerPortalView` czyta sygnał „podłączony"
z kanonu (Wariant 1 lub 2 z §2.4), zachowując dokładnie semantykę legacy;
legacy `/api/partners/connection` przestaje być callerem bramki (może zostać na
serwerze jako deprecjonowany — nie kasujesz go). **Test negatywny: niepodłączony
partner NIE widzi żadnej treści marketingowej na `/partner`.** Cztery testy
zachowania (podłączony/niepodłączony/błąd/negatyw tenanta) zielone. Jeśli
semantyka dwuznaczna — **STOP** (§2.4), pozycja oddana jako `STOP` z propozycją.

### P.2 — Cztery stany → pulpit/orientacja, NIGDY rejestracja (wykonanie D8 litera po literze)

**Ukończone, gdy:** dla `!isConnected`, dla `lifecyclePhase` onboard/onboarding,
oraz dla błędu/unknown, `/partner` renderuje **pulpit-orientację albo uczciwy
ekran wyjaśniający** — nigdy `ProviderHomeView`/marketing/rejestrację. Obie drogi
wycieku (§2.3 A i B) zamknięte. `PartnerStartRouter` przestaje przekazywać
`<ProviderHomeView />` jako `onboardingSurface` (onboarding to zawartość pulpitu,
nie marketing — D8: `lifecyclePhase` tylko o zawartości pulpitu). Uczciwy stan
błędu/unknown z `PartnerStartRouter.tsx` (odmowa fallbacku do rejestracji)
zostaje i jest wzmocniony, nie osłabiony (Z15). Cztery zrzuty własne (§0.4 pkt 8).

### P.3 — Retirement / przekierowanie treści marketingowej na `/become-partner*`

**Ukończone, gdy:** siedem podstron marketingowych (§2.3 A) jest wycofanych
z `/partner`, a w raporcie **jest tabela „gdzie każda treść żyje dalej"**
(trasa publiczna docelowa albo `BRAK_CELU_RETIREMENTU` + STOP). D8 wymaga tego
zapisu wprost. Nie kasujesz komponentów `ProviderHomeView`/`Program*View`, jeśli
są nadal montowane przez trasy publiczne — sprawdzasz to (`grep` callera) i
zapisujesz. Gramatyka tras nietknięta (Z11).

### P.4 — Test ścieżki niepodłączonej (dziś nietestowanej poprawnie)

**Ukończone, gdy:** istnieje behawioralny test renderujący `/partner` z
`connected:false` i asertujący **brak** powierzchni akwizycyjnej (brak
`ProviderHomeView`/Hero/kalkulatora) oraz obecność pulpitu-orientacji / ekranu
wyjaśniającego. Analogiczny test dla onboarding (`connected:true` +
`lifecyclePhase:'onboard'`) — brak marketingu. Testy są behawioralne (render
+ asercja wyniku), nie grep źródła.

### P.5 — i18n EN→PL (higiena) w dotykanych powierzchniach

**Ukończone, gdy:** w powierzchniach, które dotykasz, angielskie literały jako
drugi argument `t()` są zastąpione kluczem z realną wartością PL+EN (parytet
utrzymany 468/468 lub wyższy równo). **Najpierw sprawdzasz runtime** (§1.4 pkt 4):
jeśli klucz już istnieje i PL renderuje po polsku, to jest higiena kodu, nie bug —
raportujesz uczciwie, bez zawyżania. Zero nowych literałów w JSX.

### P.6 — (DO POTWIERDZENIA W BLOKU 0 — domyślnie STOP/poza zakresem) StandardTable dla listy klientów

**Status:** decyzja zakresu. Partner nie używa `StandardTable` nigdzie;
`ClientAccessView.tsx` robi bespoke listę. **Wejście Partnera w falę triady list
to osobna decyzja** — jeśli nadzorca jej nie potwierdził w markerze/instrukcji,
**P.6 jest poza zakresem tego dyżuru**: zostawiasz bespoke listę (tylko crimson
+ i18n z P.5) i zapisujesz w raporcie jako `POZA_ZAKRESEM_DO_DECYZJI`.
**Ukończone (jeśli TAK), gdy:** `ClientAccessView` przebudowany na
`StandardTable`/`StandardModuleBar` z `src/components/standard/` (skill
`consultify-triada`), hook `check-list-canon.sh` przechodzi bez `--update`,
zrzuty własne light+dark. **Nie zgadujesz** — to STOP, jeśli brak jawnej zgody.

---

## §T. SEKCJA TESTY

### T.1 — Jedyny dopuszczalny przypadek zmiany testu istniejącego

`tests/components/partner/PartnerPortalView.route-alignment.test.tsx:102`
(„shows the ready Consultify partner program before profile connection")
asertuje **zachowanie sprzeczne z D8** (marketing na `/partner` dla
niepodłączonego). **Wolno Ci ten jeden przypadek przepisać**, tak by asertował
zachowanie zgodne z D8 (brak marketingu, pulpit-orientacja / ekran wyjaśniający).
W raporcie: cytujesz starą asercję, nową asercję i D8 jako uzasadnienie. **Każda
inna zmiana istniejącego testu = STOP.**

### T.2 — Kontrakty per nowa powierzchnia/endpoint
Jeśli dodajesz kanoniczny `GET connection` (§2.4 Wariant 1): happy · brak
partnera (niepodłączony) · błąd DB (`featureUnavailable`, nie 200) · negatyw
tenanta (obcy `organizationId` nie dostaje cudzego `connected:true`).

### T.3 — i18n PL + EN, parytet utrzymany
```bash
# polskie literały w JSX dotykanych plików — pusto; parytet partner.* — równy
```

### T.4 — Dane dowodowe i zrzuty
Cztery stany (`podłączony/niepodłączony/onboarding/błąd`) w light+dark, PL,
w `modules/16_PARTNER/evidence/day12/`.

---

## §R. SEKCJA REJESTR I DOWODY

### R.1 — `MODULE_ACCEPTANCE.md` 16_PARTNER do stanu faktycznego
Aktualizujesz **wyłącznie** fakty wynikające z tego dyżuru (co przepięte, co
wycofane, stan bramki). Nie zmieniasz werdyktu odbiorowego — to rola nadzorcy/
właściciela. Bramka pozostaje `OWNER_PENDING` do odbioru wizualnego.

### R.2 — Komplet dowodów
Zrzuty własne (§T.4), wyniki testów (§0.4a `ZASIĘG PEŁNY/CZĘŚCIOWY`), tabela
retirementu (P.3), rozstrzygnięcie §2.4 (Wariant/STOP).

---

## 5. RAPORT

Dokładnie jeden plik: `docs/program/waves/WAVE_03_ACCEPTANCE/PARTNER_DAY12_REPORT_<data>.md`.
Zawiera: cytat D8; tabelę pozycji `P.1–P.6 → commit SHA → status → dowód`;
rozstrzygnięcie §2.4 (kanon connection); tabelę retirementu P.3 („gdzie treść
żyje dalej"); listę STOP-ów (w tym komercyjne `PAR-Q-001/002/003/005`); pomiar
zasięgu testów (§0.4a); ryzyka (szczególnie migracja legacy→v8 i retirement
siedmiu podstron); zrzuty (§T.4).

**Marker, którego nadzorca użyje przy wklejeniu tej instrukcji: «MARKER_SHA».**

Koniec instrukcji.
