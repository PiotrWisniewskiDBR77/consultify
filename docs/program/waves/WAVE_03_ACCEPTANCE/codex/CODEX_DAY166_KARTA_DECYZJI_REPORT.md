# CODEX — DYŻUR 166 — KARTA DECYZJI

Data: 2026-08-30  
Marker: `22124537f7`  
Gałąź: `codex/day166-karta-decyzji-20260830`  
Werdykt: **PARTIAL — R2/R4 potwierdzone realnym HTTP+PG; R3 bez pełnego przebiegu przeglądarkowego dwóch loginów**

## Historia STOP i wznowienia

Pierwszy przebieg zasadnie zatrzymał zajęty port `5000` (`ControlCe`, PID 1122).
Nadzorca wznowił dyżur i przybił: baza `6057`, runtime `5004/5005`. Po
wznowieniu porty były wolne; marker nadal dał `MARKER OK`.

## §0.1

```text
MARKER OK
22124537f7c4e5ac523dc97ada2291f955721e3c
```

`git status --short | head -3` na wejściu nie wypisał żadnej linii. Dysk miał
`37 GiB` wolnego. Tip wyprzedzał marker o sześć commitów; praca dokładnie z
markera, bez rebase.

## R1 — pomiar przed kodem

### Ryzyko

| Warstwa | Stan wejściowy |
|---|---|
| Interfejs | `DecisionDetailView.tsx:330-348`: UI ma kategorię i contingency, mapper wpisywał stałe `business`/pusty tekst. |
| Wysyłka | `riskToServerInput` nie wysyłał obu pól. |
| Walidator | `decision.validators.ts:141-158`: oba schematy nie deklarowały pól. |
| Serwis/kontroler | `decisionCollaborationService.ts:522-672`, `DecisionController.ts:2904-2985`: brak w DTO, SQL i wejściu. |
| Baza | `932_decision_workflow_canonical.sql:130-142`: brak kolumn; realny SELECT przed migracją: `ERROR: column "category" does not exist`. |

Teza instrukcji potwierdzona.

### Pamięć przeglądarki

| Warstwa | Stan wejściowy |
|---|---|
| Interfejs | Przypomnienia, eskalacje, linked items i context details są edytowalne. |
| Wysyłka/walidator/backend | Brak serwera — świadomie poza zakresem przebudowy. |
| Magazyn | `DecisionDetailView.tsx:2401/2447`: `consultify-decision-enhancements:<decisionId>` bez użytkownika i organizacji. |

Teza wycieku między użytkownikami jednego profilu potwierdzona kodem.

### RACI

| Warstwa | Stan wejściowy |
|---|---|
| Interfejs | Cztery role RACI; mutacje wykonywały tylko `setStakeholders`. |
| Wysyłka | GET `/decisions/:id/stakeholders`; zero wołaczy zapisu. |
| Walidator/serwis/kontroler | Brak schematu, funkcji i handlerów. |
| Baza | `decision_stakeholders` istnieje; `role` to `TEXT` bez CHECK. |

Router miał **29** deklaracji według
`grep -cE "^router\.(get|post|put|patch|delete)"`; zero `/stakeholders`.
Notatka o „27” i „tylko odczycie” była nieaktualna. Inicjatywy mają osobne
trasy w `initiatives.routes.ts:3673-3680`.

## R2 — pola ryzyka

- Migracja `20260830_day166_decision_risk_fields.sql` dodaje idempotentnie
  `category TEXT` i `contingency TEXT`.
- Pola przechodzą przez Zod, kontroler, DTO, INSERT/UPDATE/SELECT i frontend.
- Istniejąca baza: pierwszy przebieg `Applying migrations: 1`, drugi `0`.
- `information_schema` zwróciło obie kolumny typu `text`.
- Pusta baza: `869` migracji, replay `0`, `DAY161_FRESH_MIGRATION_GATE=PASS`.

## R3 — klucz pamięci

Nowa konwencja:

```text
consultify-decision-enhancements:<organizationId>:<userId>:<decisionId>
```

Odczyt i zapis używają tego samego klucza. Gdy zalogowany użytkownik nie ma
nowego wpisu, legacy wpis jest jednokrotnie przenoszony pod jego klucz i
usuwany ze starej lokalizacji. Pierwszy uwierzytelniony użytkownik przejmuje
legacy wpis zgodnie z instrukcją.

Artefakt deterministyczny wykazał różne klucze dla A/B w jednej organizacji i
dla tego samego użytkownika w dwóch organizacjach. Nie wykonano jednak realnego
login A → zapis → logout → login B, dlatego B5 jest **PARTIAL**.

### Materiał decyzyjny — przeniesienie na serwer

Rekomendacja: 4 encje (`decision_reminders`, `decision_escalation_rules`,
`decision_context_notes`, `decision_linked_items`), 8 tras kolekcja/element
albo 4 GET + 4 PUT, jeden `decisionEnhancementsService`, walidatory i testy
tenant/auth. Nie używać `decision_history`: to audyt, nie bieżący model.
Szacunek: 5–8 dni inżynierskich z migracją legacy i readbackiem. To materiał
do decyzji właściciela; kodu serwera tej części nie dodano.

## R4 — trwały RACI

- Przyjęto słownik frontendu:
  `responsible|accountable|consulted|informed`; istniejące `informed` jest zgodne.
- Dodano GET i PUT `/api/decisions/:id/stakeholders`.
- PUT ma `requireDecisionCapability('decision.update', { shadow: true })`,
  `isDossierEditor` i sprawdzenie przynależności użytkowników do organizacji
  przed usunięciem starego zestawu.
- Front zapisuje zestaw przez debounced PUT i odczytuje przez GET.
- Router po zmianie: 31 deklaracji (29 + GET + PUT).

## Real HTTP + PostgreSQL

Pakiet: `day166.decision-card-persistence.pg.test.ts`. Użyto `--root server
--config vitest.config.ts --retry=0` i pełnego inline env: `RUN_DB_TESTS=1`,
`MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`,
`ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`,
`RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny DATABASE_URL
`127.0.0.1:6057/cx166` oraz testowy JWT secret.

Finalnie **2/2 PASS, 0 FAIL** po pełnych nazwach:

1. `... persists risk category and contingency and reads them from the detail aggregate`
2. `... replaces and then reads RACI stakeholders from PostgreSQL`

Test montuje realny `ApiGateway`, podpisuje JWT, wykonuje HTTP, sprawdza wiersz
PG i niezależny od cache readback. Pułapki Z33 wyłączono imiennymi env;
DB_TYPE dodatkowo przybito i potwierdzono asercją w `beforeAll`.

## Dowód mutacyjny

Mutacja `toRiskDTO` ustawiła oba nowe pola na `null`: **1 PASS, 1 FAIL**;
czerwony był dokładnie round-trip ryzyka. Po przywróceniu przez `cp`:
**2 PASS, 0 FAIL**. `git diff --check` bez pozostałości mutacji.

## Walidacja

- ESLint sześciu zmienionych plików: exit `0`, 0 błędów; 33 zastane ostrzeżenia kontrolera.
- `tsc --noEmit -p server/tsconfig.json`: exit `0`, pusty log.
- `git diff --check`: PASS.

## Artefakty SHA-256

- `day166-vitest-final.json`: `7d269530cad5a23369200852d6cff46aaba3c0b848b22e9969c6c7a5cd654dd7`
- `day166-vitest-mutated-red.json`: `672a9e3b4358869040d37a4aa7dc4e6a2ac2c487ed756f353fc0fbc49e0bee59`
- `day166-vitest-restored-green.json`: `02e785ccb9cd4cd99d6d256526c0904c69e9052728f6f7a6914095710f225929`
- `day166-storage-key-proof.json`: `436ae4317656ba34b1015c92bb63662f46b422bab7f5a1e97dab48a873a47c3f`
- fresh-chain log: `eed0a83c5120b64c68c4df278b4571b1a0609881ca4ae88549529a1b3ec80c41`
- fresh-chain replay: `093be3fc713b6735098c5344b47b7160ffc499846530fb25f51180e64ebf6332`

Artefakty: `/private/tmp/cx-day166-karta-decyzji-artefakty`.

## Korekty wobec instrukcji

- Wznowienie rozstrzygnęło zasoby na `6057`, `5004/5005`.
- Pierwsza komenda Vitest z błędnym rootem znalazła 0 testów i nie została
  uznana za PASS. Poprawna użyła `--root server` i ścieżki `src/...`.
- Config serwera nadpisał shellowy DB_TYPE; test przybił go w `beforeAll` i
  natychmiast potwierdził asercją.

## Z30

`BRAK ZMIENNYCH POCZTY`; tabela `settings`: 0 wierszy `smtp%`; `Gateway.ts`:
zero drenaży. Nie uruchomiono `server/src/index.ts` ani runtime'u. Żaden e-mail,
zaproszenie ani powiadomienie zewnętrzne nie zostało wysłane.

## TWIERDZENIA NIEZWERYFIKOWANE

- Brak pełnego testu dwóch loginów w jednym profilu przeglądarki — B5 PARTIAL.
- Brak screenshotów i porównania pikselowego — B6 wizualnie niezmierzone;
  diff nie zmienia klas, układu, kolorów ani renderowanych tekstów.
- Railway, demo, staging i produkcja niebadane (Z8/Z28).
- Zastąpienie zestawu RACI jest wielozapytaniowe i nieatomowe; atomizacja to
  dalszy hardening, nie zweryfikowany wynik tego dyżuru.
