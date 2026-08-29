# CODEX DAY 80 — CYKL ŻYCIA SZABLONU PREZENTACJI

Data: 2026-08-29  
Marker: `f6032bdaaa52469871e1010190c40d62261b8113`  
Gałąź: `codex/day80-template-lifecycle-20260829`

## Werdykt

**PARTIAL / rdzeń B.1–B.2 domknięty, K2 zablokowane niezależnym defektem eksportu PPTX.**

Świadome zatwierdzenie provenance szablonu prezentacji jest teraz jedną transakcją, która ustawia także `lifecycle_state=approved`, `approved_at` i `approved_by`. Bramka nie została rozluźniona: przed promocją świeży `unknown/draft` nadal zwraca `403 TEMPLATE_FORBIDDEN`.

Pomiar obalił jednak tezę, że `lifecycle_state=draft` powoduje 403: resolver sprawdza `provenance_status=approved` (`creationIntent.ts:518-522`), lecz nie odrzuca draftu (`:524-535`). Bez zmiany po zatwierdzeniu samego provenance generator decku zwrócił `201`, mimo readbacku `approved/draft`. Zmiana domyka cykl zgodnie z poleceniem, ale nie jest przyczyną odblokowania 403.

Eksport utworzonego decku zwraca niezależne `422 PPTX_CURRENT_RENDER_FAILED` z tekstem `The current deck has no renderable slides.`. Nie zmieniałem `server/src/services/report/pptx/**` ani innych plików dyżuru 79.

## §0.1 — wynik dosłowny

`df -h /`:

```text
Filesystem        Size    Used   Avail Capacity iused ifree %iused  Mounted on
/dev/disk3s1s1   1.8Ti    12Gi    82Gi    13%    459k  861M    0%   /
```

Komenda (2), końcówka wiążąca:

```text
972a68e723 docs(instrukcje): dyzury 79/80/81 — pierwsze NAPRAWCZE, na podstawie diagnoz z 76/77/78
f6032bdaaa docs(ledger): DEC-299..302 — petla Word dziala, grafika PPT 7/18, komplet przyczyn, defekt #4 zdiagnozowany
MARKER OK
```

Krok (4):

```text
[core]
	bare = false
```

Komenda (7):

```text
f6032bdaaa52469871e1010190c40d62261b8113
```

`git status --short | head -3` nie wypisał linii. Tip był o jeden commit do przodu (`972a68e723`), wyłącznie trzy instrukcje 79/80/81; praca ruszyła dokładnie z markera.

## B.1 — diagnoza z mianownikiem

1. `lifecycle_state`: **3 z 3** wartości schematu: `draft`, `approved`, `deprecated` (`server/migrations/767_presentation_template_governance.sql:49-60`; `presentations.routes.ts:1618-1625`). `provenance_status`: **3 z 3**: `unknown`, `approved`, `quarantined` (`server/migrations/20261017_material_export_policy_provenance.sql:161`). Resolver przepuszcza tylko provenance `approved`; lifecycle odrzuca tylko `deprecated`, a więc dopuszcza `draft` i `approved` (`creationIntent.ts:518-535`).
2. Ścieżka promocji istnieje. Dla lifecycle **3 z 3 stanów** są akceptowanymi celami trasy `POST /presentations/templates/:id/governance/transition` (`presentations.routes.ts:1672-1697`). Fasada deliverable `/templates/:id/approve` obsługuje wyłącznie `table` (`deliverableTemplates.routes.ts:186-208`). Osobna trasa provenance istnieje (`:311-332`), lecz przed zmianą nie promowała lifecycle.
3. Word nie ma tego samego problemu: `createDeliverableTemplate` przeprowadza kanoniczny szablon Document Studio przez istniejący draft/approve, podczas gdy deck był zapisywany jako `unknown/draft`. Bramka presentation resolvera jest formatowo osobna (`creationIntent.ts:464-535`).

## B.2 — najmniejsza zmiana

W `deliverableTemplateService.ts:1589-1600`, wewnątrz istniejącej transakcji zatwierdzenia provenance, tylko dla rejestru `presentation_templates` ten sam `UPDATE` ustawia lifecycle `approved` i audytora. Pozostałe dwa rejestry zachowują dotychczasowe SQL i parametry. Nie usunięto ani nie zmieniono żadnego warunku 403.

## B.3 / Z32 — dowód mutacyjny w obie strony

Kopia zielona i kopia oryginalna leżały poza repo. Cofnięcie i przywrócenie wykonano przez `cp`, bez `stash`.

Bez zmiany (`cp ...original.ts .../deliverableTemplateService.ts`), `git diff -- server/src/services/deliverableTemplateService.ts` był pusty:

```text
BEFORE_PROMOTION_STATUS 403
PROMOTION_STATUS 201
LIFECYCLE_READBACK {"provenance_status":"approved","lifecycle_state":"draft","has_approver":false}
DECK_GENERATE_STATUS 201
DECK_EXPORT_STATUS 422
```

Po przywróceniu (`cp ...green.ts .../deliverableTemplateService.ts`):

```text
BEFORE_PROMOTION_STATUS 403
PROMOTION_STATUS 201
LIFECYCLE_READBACK {"provenance_status":"approved","lifecycle_state":"approved","has_approver":true}
DECK_GENERATE_STATUS 201
DECK_EXPORT_STATUS 422
```

Znacznik zielonego przebiegu: `ZNACZNIK-DAY80-cbe3432b-7965-44c5-9ee7-f6a62d056ef5`. PPTX nie powstał, więc nie podaję fałszywego SHA ani miejsca znacznika.

## Testy i kompilacja

Real-PG, real auth, `--retry=0`, config serwerowy uruchomiony z katalogu `server` (pierwsza próba z roota i `--config server/vitest.config.ts` uczciwie dała 0 testów i nie jest liczona):

```text
RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres NODE_ENV=test \
ENABLE_V8_GLOBAL=true ENABLE_TEST_AUTH_BYPASS=false \
RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce \
DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5952/cx_day80 \
JWT_SECRET=<lokalny-sekret> npx vitest run \
src/routes/__tests__/deliverableTemplates.provenance.test.ts \
--config vitest.config.ts --retry=0 --reporter=json --outputFile=...
```

Wynik nazwowy: 33 zebrane przypadki, 16 PASS, 17 SKIP, 0 FAIL. Obejmuje realny JWT, OWNER/ADMIN, odmowy MEMBER/revoked/cross-tenant/no-token, rollback, współbieżność i widoczność po zatwierdzeniu.

Pułapki Z33: (a) `ENABLE_V8_GLOBAL=true`; (b) `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) asercja pakietu potwierdza `DB_TYPE=postgres`, `MOCK_DB=false`; (d) `ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT; (e) UI/flagę pominięto, bo dowód szedł realnym HTTP przez Gateway, nie przez ekran.

Kompilacja produkcyjna serwera:

```text
> tsc --build tsconfig.build.json --force
Verified 11 server runtime mirror files.
build:copy-assets
exit 0
```

## Artefakty poza repo

- `/private/tmp/cx-day80-tmpl-lifecycle-artefakty/day80-red.log` — `50fdca08947097f94df9ace73dfa450290d890f057081f7b5b54b8a96b183fd9`
- `/private/tmp/cx-day80-tmpl-lifecycle-artefakty/day80-green.log` — `8ff475fb778d3d772784044128e36b557375c418aa7ce7bd8d4da5be87350ad8`
- `/private/tmp/cx-day80-tmpl-lifecycle-artefakty/provenance.json` — `cfaf4e7b1941e47306f1d8e4e0a148362dbbcfba3113fba3892a071c7ec4c38f`
- `/private/tmp/cx-day80-tmpl-lifecycle-artefakty/server-build.log` — `c6b590dfddf5cbae7500d5eb521c2e08177644dbc6fda3a69faacbbeb988896e`

## Z30 — deklaracja obowiązkowa

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

Dowody: `BRAK ZMIENNYCH POCZTY`; zapytanie do `settings` zwróciło `(0 rows)`; grep drenów w `server/src/Gateway.ts` zwrócił 0 trafień.

## Korekty wobec instrukcji i STOP pozycji K2

1. Instrukcja odwołuje się do nieistniejącej osobnej tabeli licencji i BLOKU 0. Bezpieczna interpretacja: §D jest licencją (`deliverableTemplates.routes.ts`, `deliverableTemplateService.ts`, raport), §0.2c jest BLOKIEM 0. Zmieniono tylko serwis i raport.
2. Teza „403 przy lifecycle_state=draft” jest obalona: 403 wynika z `provenance_status != approved`; po samej promocji provenance generator zwrócił 201 przy lifecycle draft. Domknięcie lifecycle pozostaje wymaganym i wdrożonym kontraktem governance.

### STOP — K2 eksport PPTX ze znacznikiem

Rodzaj: MERYTORYCZNY  
Powód: po skutecznym utworzeniu decku eksport zwraca niezależne `422 PPTX_CURRENT_RENDER_FAILED`, bez pliku.  
Licencja, którą sprawdziłem: §D zabrania zapisu `server/src/services/report/pptx/**` (teren dyżuru 79); dozwolone są dwa pliki backendu i raport.  
Dowód: oba logi: `DECK_GENERATE_STATUS 201`, `DECK_EXPORT_STATUS 422`, komunikat `The current deck has no renderable slides.`  
Co dostarczyłem ZAMIAST zmiany: realny dowód HTTP 403→promocja 201→deck 201, mutację lifecycle w obie strony, readback PG, zielony pakiet auth/provenance i brief dla nadzorcy.  
Co zrobiłbym, gdyby zapadła decyzja X: po integracji wyniku dyżuru 79 powtórzyłbym identyczny harness, zapisał PPTX, sprawdził marker w OOXML i wyrenderował PDF.  
Rekomendacja dla nadzorcy: scalić z wynikiem 79 i powtórzyć B.3; nie rozszerzać licencji 80 na silnik PPTX.  
Stan: zacommitowano częściowo — SHA poniżej.  
Czy kontynuowałem pozostałe pozycje: TAK — K4, K5 i K6 wykonane.

## Kryteria K1–K6

- K1: PASS.
- K2: STOP MERYTORYCZNY — brak PPTX z powodu 422.
- K3: PASS dla naprawianego kontraktu lifecycle; logi pokazują `draft` bez zmiany i `approved` ze zmianą.
- K4: PASS — przed świadomą promocją nadal 403.
- K5: PASS — produkcyjny build serwera exit 0.
- K6: PASS — lista zmian poniżej zawiera tylko serwis i raport.

```text
server/src/services/deliverableTemplateService.ts
docs/program/waves/WAVE_03_ACCEPTANCE/codex/CODEX_DAY80_TEMPLATE_LIFECYCLE_REPORT.md
```

