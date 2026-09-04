# R3 — jedna naprawa i para dowodów

## Wybrana droga

Wybrano wariant **C**: rozdzielenie wariantu pomiarowego G15. `enforce` pozostaje obowiązkowe dla pakietów, których przedmiotem jest koperta, natomiast izolowane kontrakty tras, które zastępują middleware i nie tworzą realnego `organization_members`, biegną bez `enforce`. Jedyna trwała zmiana została dopisana do istniejącego rejestru G15; kod produktu i dozwolone role pozostały bez zmian.

Odrzucono A, ponieważ mechaniczne dopisanie lokalnego mocka do 16 pakietów Results i rodziny Finance powielałoby istniejący, jawny opt-out middleware'u i zwiększało powierzchnię zmian testowych. Odrzucono B jako domyślny sposób dla izolowanych kontraktów tras, bo zmieniłby ich charakter w integracyjne testy członkostwa. D nie było potrzebne: pomiar R2 jednoznacznie wskazał wariant C.

## Dowody przed i po

| Pakiet | Przed | Po |
| --- | ---: | ---: |
| `res-internal-beta-visibility.mounted.pg.test.ts` | 4/4 PASS | 4/4 PASS |
| pięć `tests/integration/results/day46.*.realpg.test.ts` | 77/77 PASS | 77/77 PASS |

Pakiet akceptacyjny jest uruchamiany z `vitest.acceptance.config.ts`; pięć pakietów Day46 z konfiguracją root, `pool=forks`, sekwencyjnie i po kanonicznym seedzie RN-G6. Wspólny pierwszy przebieg bez seeda nie był dowodem: 12 testów zostało pominiętych przez brak fixtury. Po seedzie pełny mianownik wynosi 77 i nie ma przypadków pending.

## Para kodów odpowiedzi przez realny ApiGateway

`tests/integration/results/day46.gateway-reachability.realpg.test.ts` montuje `ApiGateway.getInstance().initializeRoutes(app)`, podpisuje JWT sekretem testowym i tworzy realne wiersze `organization_members`. W 60/60 zielonych przypadkach zapisane asercje statusu potwierdzają:

- użytkownik z realnym `ACTIVE OWNER` lub `ACTIVE ADMIN`: **HTTP 200**;
- użytkownik bez dozwolonej roli (`MEMBER`, `CONSULTANT`, `GUEST`): **HTTP 403** z `RESULTS_INTERNAL_BETA_VISIBILITY_DENIED`.

## Dowód mutacyjny zabezpieczenia

Mutacja niecommitowana: `ALLOWED_RESULTS_ROLES` tymczasowo rozszerzono o `MEMBER`.

- mutacja: 4 wykonane, 2 PASS, **2 FAIL**; test zobaczył m.in. 400 zamiast oczekiwanego 403, ponieważ żądanie użytkownika MEMBER przeszło za kopertę;
- przywrócenie przez `cp` z `/private/tmp/cx-day347-403-przyczyna-scratch`: 4/4 PASS;
- `git diff --exit-code -- server/src/middleware/resultsInternalBetaVisibility.middleware.ts`: kod 0, diff pusty.

## Bezpieczeństwo środowiska

Wszystkie przebiegi wskazywały jawnie `postgresql://postgres:cx@127.0.0.1:6394/cx347`, `RUN_DB_TESTS=1`, `MOCK_DB=false`, `DB_TYPE=postgres`, `NODE_ENV=test`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `enforce` i `--retry=0`. Baza miała 894 migracje, drugi przebieg migratora zastosował 0. Nie ustawiono zmiennych SMTP; tabela `settings` miała 0 kluczy `smtp%`; nie uruchomiono `server/src/index.ts` ani drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

