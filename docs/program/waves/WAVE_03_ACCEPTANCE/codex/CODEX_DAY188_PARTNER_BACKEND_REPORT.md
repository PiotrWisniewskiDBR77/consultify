# CODEX DAY 188 — PARTNER BACKEND — RAPORT

Stan: **RDZEŃ R1/R2 NAPRAWIONY I ZWERYFIKOWANY MUTACYJNIE; ODBIÓR PRZEGLĄDARKOWY NOT_PROVEN**  
Baza: marker `b4651675f6`, branch `codex/day188-partner-backend-20260831`  
Zasoby: lokalny `cx-day188-pg`, `127.0.0.1:6108/cx188`; porty 5048/5049 niewykorzystane.

## Wynik

- R1: `GET /api/v8/partner/earnings-summary` przechwytuje wyłącznie
  `PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER`. Przy nieustawionej polityce odpowiada 200 oraz
  `payoutEligibility.reason=POLICY_NOT_APPROVED`; wartości ekonomiczne, których bez polityki
  nie da się znać, są `null`, nie atrapowym zerem. Inne błędy nadal są rzucane.
- R2: JOIN ma kierunek zmierzony w realnym PG:
  `partner_attributions.organization_id UUID -> ::text`,
  `projects.organization_id TEXT`. Dodatkowo `DbPromise.all(..., { fallback:false })`
  wyłącza wcześniejsze, niezależne maskowanie błędu jako `[]`; zachowany `catch` loguje i
  rzuca `PARTNER_PROJECTS_QUERY_FAILED`.
- Front w licencjonowanym bloku `projects` czyści poprzednie dane i pokazuje stan błędu.
  Prawidłowe `200 {projects:[]}` nadal renderuje niezmieniony pusty stan.
- Nie wybrano migracji typu: rzutowanie jest lokalne, addytywne na poziomie zapytania i nie
  zmienia licznych kluczy/kontraktów UUID tabel partnera ani odziedziczonych kontraktów TEXT
  rdzenia.

## Dowód wejścia — komendy (2) i (7), dosłownie

```text
ce127952b5 partia 3 wydana (188-193: partner backend+i18n, drugi kasownik z LLM, stopka PDF, sygnaly params, piny Z31 — sweep znalazl 7 nie 3) + D-9 zaakceptowana + odbior 183 SCALONO
e758db0c44 merge: dyzur 183 + FIX-183 (kalendarz V2 domyslnie ON — D-6; wlasne wydarzenia przezywaja reload, zrzuty x4 potwierdzone wzrokiem)
cd9c545dc1 fix(day183): dedupe calendar sources so own events survive reload; full screenshot set
9e86cf531c odbior 180: SCALONO po FIX-180 — mechanika K6 DOMKNIETA; do wlaczenia agenta zostala decyzja wlasciciela o fail-open polityk + env przy deployu
d998ff21ae merge: dyzur 180 + FIX-180 (plany z czatu pod limitami; odmowa nie-trwala opt-in, klucz per proba z dedupem redelivery, krok terminalny po cancel, NaN-guard, happy-path, licznik odmow)
a3a70b2878 docs(day180): errata FIX-180 — cztery wady z sond, mutacje, stan sasiadow
84cadd53fc fix(agent/F1+F2): a refusal must not outlive its peak, a retry must retry
96e2714d36 odbior 181: SCALONO po FIX-181 (D-1 end-to-end, errata karty); strona obiektu -> dyzur 194
707ee1334d merge: dyzur 181 + FIX-181 (beta Spotkan otwarta D-1, /meetings w prefiksach pilota — MEMBER wchodzi, mutacja routera; errata karty uczciwa) — strona obiektu do 181-bis
4a6f6487b8 fix(day181): allow /meetings for pilot roles, honest card errata, object-page 403 surfaced
77fef4f11e test(agent/180): governed chat-plan happy path + one greppable denial counter
ed2e6fc17f fix(agent/F4): malformed timing envs fall back to the default, not to NaN
fa38aaf298 fix(agent/F3): close the in-flight step terminally when a plan is cancelled
b4651675f6 odbior 186: SCALONO (B+/A-) — plik dowodowy REALNY odtworzony niezaleznie; strop PARTIAL uczciwy (zadne wejscie UI nie niesie briefu -> decyzja produktowa); dyzur 193 zbiorcze piny Z31
fc9d7410bc merge: dyzur 186 (brief -> tresc slajdow w trasie szablonowej PPT; plik dowodowy REALNY — odtworzony niezaleznie bit-w-bit) — odbior B+/A-
846f9eaf34 odbior 180: NIE SCALAC — F1 trwala odmowa wspolbieznosci (krok martwy na zawsze), F2 retry polyka blad, F3 'W toku' po cancel, F4 NaN na env; FIX-180 Opus wydany
14ce6dc6bf odbior 187: FIX-187 wykonany — przycisk PDF w obu miejscach UI, D-3 zamkniete klientowo
1548ef5c7b Merge branch 'codex/m03-admin-20260824' of https://github.com/PiotrWisniewskiDBR77/consultify-recovery-private-20260820 into HEAD
53ebbf2088 fix(day187): PDF download button beside DOCX in audit report UI
67c819d9f8 odbior 183: flip wstrzymany do FIX-183 — includeOwnEvents gubi wlasne wydarzenia (diagnoza linia po linii); R1 klasa A; sprostowanie: ideaInspector ON od 26.08
809c5b8aff odbior 184: SCALONY po FIX-184 — plan migracji kompletny, gotowy do decyzji wlasciciela o wykonaniu D-7
e15eefec56 merge: dyzur 184 + FIX-184 (plan migracji legacy->kanon z rozdzialem A4.0 o budowie domu kanonicznego, tabele A1/A2, warianty personal-tasks) — do decyzji wlasciciela
48e034c207 marzenie wlasciciela: prezentacje jakosci Gammy — sciezka G-0..G-5 (rekonesans -> prototyp-plik do akceptu -> budowa za flaga), start po rundzie 30
4913eb6404 odbiory: 185 SCALONO po FIX; 182 SCALONO (A) — znalezisko {{value}} w 5/8 regulach -> dyzur 192; env staging przy deployu kandydata
503d259f75 merge: dyzur 182 (producent sygnalow: realny zapis do PG, mutacja niezalezna, inwentarz 8/8) — odbior A
MARKER OK

b4651675f6ba0cc880c07fee94d2667a952d92f4
```

`git status --short | head -3` po utworzeniu worktree nie wypisał żadnego wiersza.
Tip uciekł do przodu; wykonano wymagane `log` i `diff --name-only` dla zakresu
`b4651675f6..github-backup/codex/m03-admin-20260824`. Scalenie pozostaje po stronie nadzorcy.

## Baza i Z30

- Dysk wejściowo: 16 GiB wolne (>5 GiB); porty 6108/5048/5049 były wolne.
- Pełny łańcuch migracji na `pgvector/pgvector:pg16`: 870 zastosowanych; drugi przebieg:
  `Applying migrations: 0`, `Postgres migrations complete`.
- `settings WHERE key LIKE 'smtp%'`: 0 wierszy.
- `env`: `BRAK ZMIENNYCH POCZTY`; `Gateway.ts`: zero montażu drenaży.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera
wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu
outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Testy i mutacje

Każda komenda real-PG miała w tej samej linii: `RUN_DB_TESTS=1 MOCK_DB=false
DB_TYPE=postgres NODE_ENV=test ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce DATABASE_URL=...6108/cx188`, podpisany
JWT i `--retry=0`. Test asertuje `DB_TYPE=postgres`, host `127.0.0.1`, port 6108,
bazę `cx188` oraz wyłączony auth bypass. Montaż: wyłącznie
`ApiGateway.getInstance().initializeRoutes(app)`.

| Dowód | Wynik | SHA-256 |
|---|---:|---|
| `day188-final-green.json` | 5/5 PASS, pełne nazwy zapisane w JSON | `8904dde6f577ff810e8f40ee14fad0b3400bf3d8529c832890a228578f3b96ab` |
| `day188-front.json` | 2/2 PASS: prawdziwa pustka vs błąd | `fc8a69c039744dbed33f3e35e1e59ffdf807c56b0b61ce0a7fc8e95a026bbcf9` |
| `day188-r1-mutation-red.json` | 4 PASS / 1 FAIL; bez catch status 500 zamiast 200 | `4bddd4287c90a8053f45608d5017267ea036e62afbb53b1a56dc427c9a0641b8` |
| `day188-r2-mutation-red.json` | 3 PASS / 2 FAIL; bez `::text` status 500 zamiast 200 | `f2f1238e4b7c8a73cd4f7f50c85e5fe14b5363f86457a8f5b9fc50d0f527b398` |

Po obu mutacjach pliki przywrócono z kopii w scratch (bez `stash`), a finalny przebieg
jest zielony. Test innego błędu SQL tymczasowo zmienia nazwę kolumny wyłącznie w lokalnej
bazie i dowodzi 500 bez `data.projects=[]`; `finally` przywraca schemat.

Pomiar wpływu po pełnych nazwach: `rg` znalazł 37 istniejących plików testowych
odwołujących się do zmienionych modułów/symboli. Pakiet partner UI + referral miał
143 przypadki: 142 PASS, 1 zastany FAIL i18n
(`EarningsSection V8 payout request seam...`: test oczekuje angielskiego aria-label,
render zwraca polski). Sąsiedni `v8-partner-read.test.ts` nie uruchomił przypadków:
zastany mock `auth.middleware` nie eksportuje `validateOrgMembership`; to
`EVIDENCE_MISSING`, nie PASS. Nowe testy day188 mają 7/7 PASS.

## Konsumenci `/earnings-summary`

Kod produkcyjny ma dwa bezpośrednie callery:

1. `EarningsSection.tsx`, współdzielony przez cztery podsekcje: `earnings`, `statements`,
   `payouts`, `payout-settings`;
2. `PartnerRuntimeSummaryStrip.tsx` przez `getEarningsSummaryWithFallback()` wewnątrz
   zwykłego `Promise.all`.

Stąd „4 ekrany rozliczeń” z raportu 177 to cztery podsekcje jednego komponentu, nie
cztery niezależne callery. Strip jest dodatkowym konsumentem poza tą czwórką.

## Korekty wobec instrukcji

1. Instrukcja mówi „WERYFIKACJA ... pięć komend”, ale wylicza T1–T6; wykonano wszystkie
   sześć grup.
2. Instrukcja wielokrotnie wymaga pomiaru wg `§0.4a`, ale dokument przechodzi z `§0.2d`
   bezpośrednio do `§0.5`; sekcja `§0.4a` nie istnieje. Zastosowano pełny pomiar `rg`
   bez obcięcia i raport nazw/wyników JSON.
3. Podany sekret `cx188-test-secret-do-not-reuse` ma mniej niż wymagane 32 znaki i
   powodował 401 w realnym `verifyToken`. Użyto wyłącznie lokalnie
   `cx188-test-secret-do-not-reuse-32chars`; pierwszy przebieg 0/5 został zachowany w
   artefakcie `day188-targeted.json`.
4. Raport 177 w linii PRT-D62-006 nazywa `partner_attributions.organization_id` tekstem,
   ale migracje i katalog realnego PG dowodzą UUID; instrukcja 188 podaje kierunek
   poprawnie.
5. Wymóg: 200 oraz ten sam bursztynowy baner w `EarningsSection.tsx` jest sprzeczny z
   kodem tylko-do-odczytu: baner renderuje się wyłącznie przy `error && !summary`, a 200
   tworzy `summary`. Nie zmieniano pliku poza licencją. R1 zapewnia jawny
   `POLICY_NOT_APPROVED`; podłączenie tego pola do istniejącego banera wymaga osobnej
   licencji na `EarningsSection.tsx`.

## TWIERDZENIA NIEZWERYFIKOWANE

- **NOT_PROVEN:** odbiór przeglądarkowy na portach 5048/5049, zrzut i konsola. Kanoniczny
  runtime w trybie `create` wymaga osobnej bazy o prefiksie
  `consultify_w3_runtime_*`; baza dyżuru nazywa się wiążąco `cx188`. Nie uruchomiono
  niekanonicznego serwera ani nie obchodzono protokołu Z30.
- **NOT_PROVEN:** wizualne zachowanie istniejącego bursztynowego banera po 200 — patrz
  korekta 5. Test komponentu dowodzi wyłącznie rozróżnienia projects error/empty.
- Nie wykonano pełnego repozytoryjnego `tsc`: trzy zmieniane duże pliki mają zastane
  błędy lint poza licencjonowanymi fragmentami (sort importów w route oraz format linii
  1653 referral service). Nowe pliki day188 przechodzą lint.

## Pliki i commity

`git diff --name-only b4651675f6..HEAD` obejmuje wyłącznie:

- `server/src/routes/v8/partner.routes.ts`
- `server/src/services/partnerReferralService.ts`
- `src/views/partner/PartnerPortalView.tsx`
- `server/src/routes/v8/__tests__/day188.partner-backend.realpg.test.ts`
- `tests/components/partner/day188.PartnerPortalView.projects-honesty.test.tsx`
- ten raport

Commity pozycji: `e972957c06` (R1), `89f8d3fb2b` (R2). Oba wypchnięte po pozycji na
`github-backup/codex/day188-partner-backend-20260831`; push na `origin` nie wystąpił.
