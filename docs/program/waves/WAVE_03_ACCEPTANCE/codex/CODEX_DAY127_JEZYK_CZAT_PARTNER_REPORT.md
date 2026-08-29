# CODEX DAY 127 — język Czatu i Partnera

Data: 2026-08-29  
Gałąź: `codex/day127-jezyk-czat-partner-20260829`  
Marker: `714faf5f8b0d9cda8204fec9495893c9fe97bed7`  
Końcowy commit aplikacyjny: `8cd5b2059a27175f8c58f671d9a3ced339736c96`

## Werdykt

`PASS / K5 PROVEN / CLEANUP COMPLETE`.

Początkowa teza o interfejsie „w 100% angielskim” nie potwierdziła się dla klasy A: statyczny mianownik użytych kluczy wykazał `0/2088` braków PL w Czacie i `0/339` w Partnerze. Pomiar wizualny ujawnił punktowe wady klas B/D. Widoczne w stanach odbiorowych etykiety zostały zlokalizowane; techniczne identyfikatory Partnera usunięto z UI.

## Tożsamość i izolacja

- osobny worktree: `/private/tmp/cx-day127-jezyk-czat-partner`;
- start dokładnie z markera; tip był o jeden commit dokumentacyjny dalej;
- push wyłącznie do `github-backup`;
- zero operacji na owner checkout poza dozwolonym dowiązaniem `node_modules`;
- runtime i DB wyłącznie na `127.0.0.1`.

## Baza, runtime i Z30

- `cx-day127-pg`, `pgvector/pgvector:pg16`, `127.0.0.1:6010`;
- baza `consultify_w3_chat_owner_day127`;
- migracje: pierwszy przebieg kompletny, drugi `Applying migrations: 0`;
- runtime wyłącznie przez `scripts/dev/start-wave3-owner-runtime.mjs`;
- końcowy runtime: SHA `8cd5b2059a27175f8c58f671d9a3ced339736c96`, health/ready/frontend `200/200/200`, 863 migracje, `prohibitedKeysAbsentInOwnedGroupProcesses=true`;
- bezpośrednio przed każdym startem: brak zmiennych poczty, `settings WHERE lower(key) LIKE 'smtp%'` = `0`;
- Gateway: `0` trafień dla `startNotificationOutboxDrainCron|outboxWorker|platformOutboxDrainCron`;
- żadnego ręcznego drenażu.

Nie ustawiłem żadnej zmiennej SMTP ani flagi wysyłki. Baza tego dyżuru nie zawiera wierszy konfiguracji SMTP. Uruchomiłem `server/src/index.ts` wyłącznie przez kanoniczny `scripts/dev/start-wave3-owner-runtime.mjs`, na lokalnej bazie dyżuru, tylko w celu wykonania zrzutów. Zweryfikowałem środowisko procesu i log serwera zgodnie z `§0.2b` (4). Żaden e-mail, zaproszenie kalendarzowe ani powiadomienie zewnętrzne nie zostało wysłane.

## Zmiana

- Czat: `Rich/DOC/MD` → `Edytor/Dokument/Markdown`; lokalizacja breadcrumbu, panelu roboczego, dyktowania, wysyłki, legendy głosu, kart startowych, wskazówki, regionu rozmowy i etykiet dostępności;
- Partner: lokalizacja breadcrumbów, badge `Nowość`, fazy `earn`, poziomu `certified` i szybkich akcji;
- usunięcie fallbacku `AMD-PRT-ECONOMICS-002` i identyfikatora certyfikatu z widoku Partnera;
- istniejących wartości locale nie zmieniono; dodano wyłącznie nowe klucze EN/PL;
- kontrakty kart N pozostały nietknięte.

## Pomiar i testy

| Moduł | Użyte klucze | EN istnieje, PL brak | Literalny JSX | Etykiety serwera | Żargon |
| --- | ---: | ---: | ---: | ---: | ---: |
| Czat | 2088 | 0 | 109 | 15 | 39 |
| Partner | 339 | 0 | 38 | 18 | 34 |

Pierwsza mutacja: `5/13 FAIL` → `13/13 PASS`, delta nazw `0/13`. Dodatkowa mutacja breadcrumbów: `1/11 FAIL` → `11/11 PASS`. Końcowy pakiet dostępności: `18/18 PASS`. Wszystko z `--retry=0`.

Szerszy pakiet 22 testów dał `21 PASS / 1 FAIL`: zastany test `PartnerCanonicalRuntimePanel fails closed per surface...` oczekuje starej nazwy regionu `Governed Partner runtime`, a komponent i18n renderuje `Current partner programme status`. `git diff --check`, parse JSON i pre-commit ratchety: PASS. Pełny type-check wskazał dwa zastane błędy: `src/components/billing/UsageMeters.tsx:174` i `src/views/partner/sections/EarningsSection.tsx:448`.

## Zrzuty odbiorowe poza repo

Katalog: `/private/tmp/cx-day127-jezyk-czat-partner-artefakty`

```text
224484c54c1606d2bb271ac8b9d4c3efb31c0e62c256b7257d87ac2a30b02d79  day127-chat-pl-dark-after.png
ed9270d0f0a27856813639a32e86696c3d34c262a0f1871069e31093a5a36cea  day127-chat-pl-dark-before.png
db1ed29c87a3e019b927ba3e34fe1b241c29a0261bc27aaf1131e355a09ac4fc  day127-chat-pl-light-after.png
364a16cda165dcf7a69d9dbc54355521377477b75bf0817bbd99d2b1ab9a11fe  day127-chat-pl-light-before.png
906c56e96f01debe9874a0d71b7e2b649d3aae4e3a8e55d0e40d621515e4e743  day127-partner-pl-dark-after.png
d5caa7dc8151bab8810599c5ee21156bff4b1b8b0fcae3992300a13a16fdf883  day127-partner-pl-dark-before.png
a7bd92568647b6fd7315dc8894ef523e620866a2f74f543aeeb16fbc590f6bb4  day127-partner-pl-light-after.png
c0a61dc6e127962def71a7dc3181fa7de12aab82aa8ea626e78daded3fd50c33  day127-partner-pl-light-before.png
```

Zrzuty wykonano przez wpisanie wyłącznie lokalnych danych fixture po zgodzie nadzorcy. Runtime był tylko do odczytu i zrzutów. Nie utworzono wiadomości, zaproszenia ani powiadomienia.

## Cleanup

- kanoniczny stop: `stopped=true`, `ownedProcessGroupsOnly=true`, `processGroupsVerifiedTerminated=true`, `portsFree=true`;
- `docker rm -fv cx-day127-pg`: wykonane;
- porty `6010`, `4920`, `4921`: `FREE`;
- lokalna karta przeglądarki: zamknięta.

## Twierdzenia niezweryfikowane

- nie wykonano pełnej suity repo;
- statyczne mianowniki B–D są kandydatami, nie dowodem osiągalności każdej etykiety;
- brak formalnej akceptacji właściciela i brak dowodu deploymentu (poza zakresem, zakaz Z28).

## Kryteria

| Kryterium | Stan |
| --- | --- |
| K1 | PASS — punktowe klasy B/D naprawione, klasa A zmierzona |
| K2 | PASS — wyłącznie pliki dozwolone instrukcją |
| K3 | PASS — RED → GREEN z `--retry=0` |
| K4 | PASS dla pakietu wpływu; szerszy pakiet ma 1 nazwany zastany fail |
| K5 | PASS — 4/4 stany po zmianie i 4/4 obrazy przed zmianą |
| K6 | PASS — sekcja niepusta |
| K7 | PASS — brak zmian kontraktów i rendererów kart N |
