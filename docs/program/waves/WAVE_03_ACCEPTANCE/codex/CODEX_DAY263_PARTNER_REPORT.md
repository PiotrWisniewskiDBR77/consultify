# CODEX DAY263 — PARTNER — RAPORT

Data: 2026-09-01  
Marker: `df7f13056f`  
Gałąź: `codex/day263-partner-retest-20260901`  
Werdykt: `PARTIAL / HTTP_6_OF_6_VERIFIED / UI_AND_MOBILE_NOT_PROVEN`.

## Streszczenie

Sześć niezależnych przypadków przeszło przez realny `ApiGateway`, `verifyToken`, podpisany JWT, tenantowy fixture Partner oraz lokalny PostgreSQL po pełnych migracjach. Wszystkie wywołania readerów produkcyjnych używanych przez sześć sekcji zwróciły HTTP `200`; `organizations` podniosło fixture `Wave 3 Referred Participant`, a `projects` nie zwróciło `PARTNER_PROJECTS_QUERY_FAILED` ani błędu `uuid = text`.

Nie ogłaszam sześciu sekcji jako `renderuje się`. Literalna baza i porty z instrukcji (`cx263`, `6266`, `5246/5247`) zostały zachowane. Kanoniczny `start-wave3-owner-runtime.mjs` odrzucił `cx263`, ponieważ tryb `adopt-existing` dopuszcza wyłącznie nazwę `consultify_w3_partner_owner_*`. Zmiana nazwy bazy byłaby zgadywaniem i złamaniem polecenia o zasobach. W konsekwencji nie powstały zrzuty Light/Dark ani mobile 375 px, a mianownik 25 sekcji pozostał bez zmian.

## Wejście, marker i R1

Wynik markera i sanity dosłownie:

```text
MARKER OK
df7f13056fa24995be07f64b0e8c877b3faeab45
```

`git status --short` był pusty. Przed startem było 12 GiB wolnego, po utworzeniu worktree 9.4 GiB. Porty `6266`, `5246`, `5247` i nazwa kontenera były wolne.

- T1 statycznie potwierdzona: catch `PARTNER_ACCRUAL_POLICY_BLOCKED_OWNER` projektuje `reason: POLICY_NOT_APPROVED`; żywo `earnings-summary` zwróciło `200`.
- T2 potwierdzona: `pa.organization_id::text = p.organization_id`, błąd zapytania jest rzucany jako `PARTNER_PROJECTS_QUERY_FAILED`; żywy reader zwrócił `200`.
- T3 obalona: `git log --since=2026-08-31` zwrócił `e4be55b7fc fix(partner): measure organization width and user counts`.
- T4 statycznie częściowo potwierdzona: `PartnerPortalView.tsx:1267` ma `minTableWidth="auto"`; mobile 375 px `NOT_PROVEN` bez runtime.
- T5 potwierdzona przed dopiskiem: grep Dzień 263 był pusty.
- T6 potwierdzona: powyżej 5 GB.

## R2 — sześć niezależnych pomiarów HTTP

| Sekcja | Stan 30.08 | Stan dziś | HTTP dziś | Zmiana | Mobile |
|---|---|---|---|---|---|
| `dashboard` | błąd | `UI NOT_PROVEN` | dashboard `200`; program/status `200`; onboarding-status `200` | HTTP zielone | `NOT_PROVEN` |
| `statements` | błąd | `UI NOT_PROVEN` | earnings-summary, commission-transactions, payouts, program/status: `200` | HTTP zielone | `NOT_PROVEN` |
| `payouts` | błąd | `UI NOT_PROVEN` | te same cztery readery uruchomione niezależnie: `200` | HTTP zielone | `NOT_PROVEN` |
| `payout-settings` | błąd | `UI NOT_PROVEN` | cztery readery + payout-settings: `200` | HTTP zielone | `NOT_PROVEN` |
| `organizations` | błąd | `UI NOT_PROVEN` | clients `200`, fixture odczytany | HTTP zielone | `NOT_PROVEN` |
| `projects` | błąd | `UI NOT_PROVEN` | projects `200`, brak kodu query failure | HTTP zielone | `NOT_PROVEN` |

Pełny body i każdy kod: `/private/tmp/cx-day263-partner-retest-artefakty/day263-http-section-evidence.json`.

## R3

Dopisano wyłącznie nową sekcję Dzień 263 na końcu karty modułu. Mianownika nie zmieniono, bo bez dowodu UI nie wolno przypisać kategorii renderowania. Istniejącego `PRT-D112-003` nie zmieniono.

## R4, testy i pułapki Z33

Nowy test `day263-partner-sections-retest.realpg.test.ts` wykonał 6/6 pełnych nazw, każdą sekcję niezależnie, z `retry: 0` i CLI `--retry=0`. JSON został odczytany, nie polegano na samym exit code: `success=true`, `6 passed`, `0 failed`.

Pułapki: (a) wyłączona przez `ENABLE_V8_GLOBAL=true`; (b) ustawiono `RESULTS_INTERNAL_BETA_VISIBILITY_TEST_MODE=enforce`; (c) `MOCK_DB=false DB_TYPE=postgres` oraz asercja `process.env.DB_TYPE === postgres`; (d) `ENABLE_TEST_AUTH_BYPASS=false` i podpisany JWT przechodzący realny middleware; (e) statements/payouts/payout-settings wykonano jako trzy osobne przypadki, bez ekstrapolacji. Wszystkie zmienne były w tej samej linii komendy wraz z `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:6266/cx263` i `JWT_SECRET`.

Pomiar §0.4a na wskazanym pakiecie `day188.PartnerPortalView.projects-honesty.test.tsx`: `przed` i `po` miały po 2 pełne nazwy, oba JSON-y `success=true`; `diff przed-nazwy.txt po-nazwy.txt` był pusty. Nowy pakiet dodał sześć jawnie wymienionych pełnych nazw w `day263-test.json`.

## Z30

Przed zapisem: `BRAK ZMIENNYCH POCZTY`; SQL `settings.key LIKE 'smtp%'` zwrócił 0 wierszy; grep drenaży w `server/src/Gateway.ts` był pusty. Po seedzie SQL nadal zwrócił 0.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Nie uruchomiłem `server/src/index.ts` ani żadnego drenażu outboxu. Żaden e-mail ani zaproszenie kalendarzowe nie zostało wysłane.

## Korekty wobec instrukcji

1. `§0.2c(A)` nakazuje literalnie bazę `cx263`; `§R2` nakazuje kanoniczny runtime i tę samą metodę co Day177. Kanoniczny runtime w `scripts/dev/start-wave3-owner-runtime.mjs:137-164` przy `adopt-existing` dopuszcza tylko prefiks `consultify_w3_partner_owner_*`. Próba na zasobach instrukcji zakończyła się: `BLOCKED: adopted DB must be local and match the closed Wave3 owner prefix allowlist`. Bezpieczniejsza interpretacja: nie zmieniono nazwy ani portów, dostarczono dozwolony realpg HTTP test, UI/mobile oznaczono `NOT_PROVEN`.
2. T3 była nieprawdziwa: istnieje commit `e4be55b7fc` po 31.08 dotyczący pomiaru organizacji. To wynik pomiaru, nie powód STOP.

## TWIERDZENIA NIEZWERYFIKOWANE

- Kategoria UI `renderuje się / błąd / pusta` dla wszystkich sześciu sekcji — `NOT_PROVEN`.
- Light/Dark, kliknięcie wiersza i panel boczny — `NOT_PROVEN`.
- Widoczność kolumny Status lub odpowiednika przy 375 px — `NOT_PROVEN`.
- Owner acceptance — `PENDING`.
- Pełne działanie economics — poza zakresem i nadal świadomie OFF.

## Artefakty i SHA-256

- `day263-http-section-evidence.json` — `317d89dbf04d9be4d0ee1f0718786baea730c208dfc90b5559eae116d2780f10`
- `day263-test.json` — `ac3e545b2644f674c967fe79d9ebc8b6838b81a13f76b890282d9e0d89080dd0`
- `migrate-1.log` — `aa35f6b19a78bdffcba95dabc8cf173664fc9f13f78188bd00f95b485dd2c546`
- `migrate-2.log` — `7091f57a21a0489973aec7c7836c2662dacf19d98ce1e304243e8fafc0bcd788`
- `partner-owner-manifest.json` — `fc1204e6d2e2f5719f03b87608d891b1858a4c8b84658054746884e2259b1581`
- `przed-nazwy.txt` i `po-nazwy.txt` — `eeffcc14a9d4e70f7fccad7a1b1eec146beac513d8cde86b3bba739444d35f61`
- `przed.json` — `7c2c2f6ceb798a1ce4ba75b03569479ca54b587f0232a1a1536c1ab629c948ad`
- `po.json` — `73efa5badfa36ff913c91299a4fb92740c2ae03f69a7a0930acec8d702b47acb`
- `runtime-blocked.log` — `6da5e081251ab90c279ce715c3b5a5a95e62164793d0e43a4db931b2573cc12a`
- `seeder.log` — `8652b7cf63a49f7216bfa1c485c05992ed593e125d4cdd0ef188b90a648f01ae`

## Zakres zmian

Do repo weszły wyłącznie: dozwolony nowy test realpg, ten raport i append-only sekcja karty modułu. Kod produktu, bramki, konfiguracja testowa i decyzje właściciela: 0 zmian.
