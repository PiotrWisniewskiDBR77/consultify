# CODEX DAY 226 — Gamma edytor motywu

Stan: **PARTIAL**. Rdzeń R1/R2 ma dowód RealPG i mutacyjny. R3 nie jest zamknięte: nie wykonałem eksportu PPTX z wiersza zapisanego w tym samym przebiegu HTTP ani wymaganych zrzutów UI. Zastany plik kontraktowy po zmianie ma 1/4 zielone; trzy pozostałe przypadki mierzą inne handlery, których licencja dyżuru nie pozwala zmieniać.

## Wejście

Instrukcja przeczytana do EOF (957 linii), stan `WYDANY`.

```text
MARKER OK
9fb7942a0117aaf4001836f00bf8bbdc4e717669
```

`git status --short | head -3` nie zwrócił wpisów. Wolne miejsce: 16 GiB. Porty 6170, 5128 i 5129 oraz nazwa `cx-day226-pg` były wolne. Tip bazowej gałęzi wyprzedzał marker o sześć commitów; różnica obejmowała wyłącznie dokumentację i instrukcje, bez plików produktu z licencji dyżuru.

## Baza i bezpieczeństwo wysyłki

- Kontener: `cx-day226-pg`, `pgvector/pgvector:pg16`, wyłącznie `127.0.0.1:6170`, baza `cx226`.
- Pierwszy przebieg migracji: zakończony `Postgres migrations complete`.
- Drugi przebieg: `Applying migrations: 0`, zakończony `Postgres migrations complete`.
- `env | grep -iE "^(SMTP_|RESEND|SENDGRID|MAIL)"`: `BRAK ZMIENNYCH POCZTY`.
- `SELECT ... FROM settings WHERE key LIKE 'smtp%'`: 0 wierszy.
- grep drenaży w `server/src/Gateway.ts`: 0 trafień.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Pomiar wejściowy

- PUT nie pobierał `customTemplate` z `req.body`.
- Front wysyłał `customTemplate: editCustomTemplate`.
- `presentationTemplateRuntimeService.ts` miał 0 trafień `colorTemplateId|color_template_id`.
- `presentationCustomTemplateContract.test.ts`: 4 testy, 0 passed, 4 failed, z `--retry=0`; wynik zmierzony z JSON, nie przepisany z instrukcji.

## R1 — SAVE

Dodano jedną flagę `ENABLE_PRESENTATION_TEMPLATE_CUSTOM_SAVE`, `default false`. Handler `PUT /api/presentations/templates/:id`:

- przy ON waliduje przez tę samą funkcję `validatePresentationCustomTemplate`, której używa odczyt runtime, i scala zwalidowany kontrakt bez utraty `colorTemplateId`;
- przy OFF nie zmienia `layout_policy_json`, gdy body zawiera tylko `customTemplate`;
- błędny kontrakt przy ON zwraca `400 custom_template_invalid` przed SQL UPDATE.

RealPG przez `ApiGateway.getInstance().initializeRoutes(app)`, podpisany JWT, `verifyToken`, Postgres i SQL readback: 3/3 passed. Pułapki: jawne `DB_TYPE=postgres`, `MOCK_DB=false`, `ENABLE_V8_GLOBAL=true`, `ENABLE_TEST_AUTH_BYPASS=false`, `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`, lokalny `DATABASE_URL`, `--retry=0`. Próba z `server/vitest.config.ts` znalazła 0 testów i została odrzucona jako brak pomiaru; właściwy przebieg użył rootowego configu.

## R2 — READ i T7

`PresentationTemplateRuntime` dostał opcjonalne `colorTemplateId?: string | null`; przy OFF pole jest nieobecne, przy ON pochodzi z już sparsowanego `layoutPolicy.colorTemplateId`.

T7 zmierzony:

- `resolveApprovedPresentationTemplate` wywołuje `buildTemplateRuntimeFromRow`;
- `presentationGeneratorService.ts` przenosi `customTemplate` do metadanych decku i opcji pipeline;
- `PptxPipelineService.ts:177-200` czyta `titleFont`, `bodyFont` i pięć kolorów z `customTemplate.theme` i buduje z nich tokeny renderera.

`customTemplate` ma zatem żywego konsumenta PPTX. `colorTemplateId` nie ma konsumenta stylu po stronie backendu; jest identyfikatorem/metadanymi. Nie zmieniałem renderera ani mapowania 13 presetów, bo renderer jest zakresem dyżuru 227.

## R3 — bramka

- Ogniwo 1 zapis: PASS — realny PUT, SQL readback obu pól.
- Ogniwo 2 odczyt: PASS — runtime z tego samego świeżo pobranego wiersza zwrócił `customTemplate.theme.titleFont` i `colorTemplateId`.
- Ogniwo 3 plik: **NIEZWERYFIKOWANE** — kod konsumenta jest osiągalny statycznie, ale nie wygenerowałem i nie sparsowałem XML pliku z wartościami zapisanymi w tym samym przebiegu. Nie przedstawiam grepu jako dowodu pliku.
- Zrzuty ON ×2 motywy po reloadzie: **NIE WYKONANO**. Nie twierdzę, że pochodzą z realnego runtime ani z harnessu.

## Dowód mutacyjny Z32

Po kopii do scratch zmieniłem bramkę na stałe `false`:

```text
MUTATION_EXIT=1
```

Po odtworzeniu pliku przez `cp`:

```text
RESTORED_EXIT=0
git diff --exit-code: 0, brak diffu
```

## Zasięg testów po nazwach

`nazwy.diff` nie zawiera nazw znikniętych. Dodano dziewięć pełnych nazw pakietu runtime, w tym nowy przypadek `exposes colorTemplateId only when the day226 custom-save flag is enabled`.

Końcowy pakiet jednostkowy: 13 total, 10 passed, 3 failed. Trzy czerwone przypadki zastanego kontraktu dotyczą delete/create/governance approval; na markerze odpowiednie wymagane fragmenty produktu nie istnieją. Nie osłabiłem asercji i nie zmieniałem handlerów spoza licencji. Przypadek R1 `merges custom contract updates without dropping color-template metadata` jest zielony.

## Korekty wobec instrukcji

1. Instrukcja oczekiwała zazielenienia całego `presentationCustomTemplateContract.test.ts`, ale pomiar bazowy wykazał, że wszystkie 4 przypadki były czerwone, a tylko jeden dotyczy licencjonowanego handlera PUT. Pozostałych trzech nie naprawiałem poza zakresem.
2. `server/vitest.config.ts` zwrócił 0 testów dla nowego pliku; wiążący pomiar wykonano rootowym configiem.
3. `customTemplate` dociera do renderera PPTX, ale `colorTemplateId` nie steruje stylem w backendzie. Nie dopisałem niezamówionego mapowania presetów.

## TWIERDZENIA NIEZWERYFIKOWANE

- Przed naprawą potwierdzono strukturalnie, że handler nie czyta `customTemplate`, oraz czerwony kontrakt; nie wykonano przed-naprawowego realnego PUT+SQL readback na bazie.
- Kontrakt był 4/4 czerwony przed zmianą; po zmianie przypadek PUT jest zielony, cały plik pozostaje 3/4 czerwony.
- T7 zmierzono do realnego konsumenta tokenów PPTX, lecz nie zmierzono XML pliku wygenerowanego z wiersza tego przebiegu.
- OFF jest zasercjonowane przez realny PUT i SQL readback; nie wykonano porównania bajtów odpowiedzi HTTP.
- Zapis i odczyt używają tej samej eksportowanej funkcji `validatePresentationCustomTemplate`.
- Zrzutów nie wykonano.
- Sześć zakładek i kontrola kontrastu pozostają zmierzonymi lukami poza zakresem.

## Artefakty i SHA-256

- `/private/tmp/cx-day226-gamma-edytor-artefakty/day226-realpg.json` — `a8000b6636a0d27234c580b1146aee6b08051bed165648265d1c3e60460879d2`
- `/private/tmp/cx-day226-gamma-edytor-artefakty/mutacja-red.json` — `36e13013b804e85f592c50c06d8a49aaa8eea2042588073f8ea23e68b679af4b`
- `/private/tmp/cx-day226-gamma-edytor-artefakty/mutacja-green.json` — `03ebb31a610b5f1f81425658ea24297ba7650f44dc6613bd37ae8727f257e90a`
- `/private/tmp/cx-day226-gamma-edytor-artefakty/przed-contract.json` — `fd32caf5a1380c3fc0c38ace8713ab3f19893ca0bffd88a7b79ffcda87878261`
- `/private/tmp/cx-day226-gamma-edytor-artefakty/po-unit-final.json` — `6794241f824ab32a4f03dba3e1d0b01d5212b044384f78aa9f06ae60c2f57d9a`
- `/private/tmp/cx-day226-gamma-edytor-artefakty/nazwy.diff` — `09b93afc3cdc09958e7d152c65e7a9d8c82b702bc1e8680393ddc5f6cedae377`

Commit rdzenia: `0aea4829e5`.
