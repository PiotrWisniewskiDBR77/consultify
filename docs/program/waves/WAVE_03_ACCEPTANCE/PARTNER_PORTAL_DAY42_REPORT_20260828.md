# Partner dzień 42 — odblokowanie portalu, inwentarz tras, izolacja tenantowa — raport dyżuru 2026-08-28

Gałąź: `codex/partner-day42c-20260828` · baza: `23652ec80a` · poziom ukończenia: W TOKU  
Kontener: `cx-day42-pg`, host `127.0.0.1`, port hosta `5697`, baza `cx_day42`

## Oświadczenia bezpieczeństwa

- Chroniony checkout `/Users/piotrwisniewski/Developer/Consultify` nie był
  czytany ani modyfikowany; użyto wyłącznie dozwolonego symlinka `node_modules`.
- `git stash list` był pusty. Nie wykonano `git stash`, push ani żadnej
  interakcji z Railway, demo, stagingiem lub produkcją.
- Każda komenda DB miała jawny
  `DATABASE_URL=postgresql://postgres:cx@127.0.0.1:5697/cx_day42` oraz, dla
  testów, `RUN_DB_TESTS=1 MOCK_DB=false`.

## Marker i korekty BLOKU 0

- `git merge-base --is-ancestor 23652ec80a codex/m03-admin-20260824` → exit 0,
  `MARKER OK`.
- `git fetch --all --prune` częściowo odmówił przez zastany remote
  `icloud-source` wskazujący nieistniejący
  `/private/tmp/consultify-staging-deploy-e6ca`; `origin` i `github-backup`
  zostały pobrane. Marker zweryfikowano niezależną komendą, bez łańcucha `&&`.
- Pierwszy przebieg runnera bez `NODE_ENV=test` odmówił lokalnego hosta przed
  połączeniem. Z udokumentowanym trybem `NODE_ENV=test` zastosowano 855
  migracji; drugi przebieg: `Applying migrations: 0`.
- Lokalny binarny `psql` nie istnieje. Niezależny klient `pg` potwierdził cel
  `127.0.0.1:5697/cx_day42`; PostgreSQL wewnątrz kontenera raportował własny
  adres `172.17.0.8:5432`. Kolumna `owner_organization_id` i pięć wymaganych
  tabel Partner były obecne.

## D.1 — werdykt przyczyny 404

**PRZYCZYNA 404 = (a) KONFIGURACJA.** Bez `ENABLE_V8_GLOBAL` pięć
reprezentatywnych żądań zwróciło `404 V8_DISABLED`; z
`ENABLE_V8_GLOBAL=true` niepowiązany członek dostał `200 connected:false` na
`/connection` oraz `403 PARTNER_ORG_REQUIRED` na `/clients`, a dokładnie
powiązany tenant i użytkownik osiągnęli realny handler `/clients` z `200`.

| Hipoteza               | Wynik                                                                                     | Werdykt                                                    |
| ---------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| (a) flaga środowiskowa | ta sama baza i Gateway: brak env → `404 V8_DISABLED`; env `true` → handler                | POTWIERDZONA                                               |
| (b) brak mountu        | log realnego Gateway: `[ApiGateway] Mounting /api/v8`; handler osiągnięty                 | OBALONA                                                    |
| (c) `mountStub`        | realny `ApiGateway`; partner nie występuje w `mountStub`; handler osiągnięty              | OBALONA                                                    |
| (d) schemat            | pełny runner tworzy wiązanie; autorun statycznie pomija `955_` przez wzorzec `7xx`/8 cyfr | NIEZALEŻNA LUKA AUTORUNU, nie przyczyna po pełnym runnerze |

Czy portal ożywa w kanonicznym env: **TAK, po pełnym runnerze migracji**.
Dowód: `8b78c335cc`, test
`partner-portal-gate-diagnosis.day42.realpg.test.ts`, `6 PASS / 0 FAIL / 0 SKIPPED`.

## D.2 — wariant

Wybrano wariant 1: portal pozostaje za globalną bramką. Nie istnieje decyzja
właściciela zezwalająca na przeniesienie mountu przed `v8FeatureGate`.

Wymaganie dla dyżuru 38: `ENABLE_V8_GLOBAL=true jest WYMAGANE w każdym
środowisku, w którym ma działać moduł Partner, Interview, Execution, Results i
Finance; jego brak daje 404 na ~połowie produktu i NIE jest odróżnialny od
awarii po stronie klienta.`

## D.7 — teza „orgId z URL-a”

**TEZA OBALONA.** Kotwiczony pomiar wykazał 35 tras. `user-tiers/:orgId/:userId`
na linii 270 jest cytatem w JSDoc; realna trasa żyje w
`server/src/routes/admin-data.routes.ts:107`. Router Partner nie czyta
`req.params.orgId`, `req.params.organizationId`, `req.body.orgId` ani
`req.body.organizationId`. Pomyłkę spowodował grep bez kotwicy `^`, który
policzył komentarz jako 36. Parametry istniejące w Partner identyfikują zasoby,
nie tenantów; ich ownership podlega osobnej macierzy D.6.

## D.3 — prawda komentarzy

Komentarz mountu mówi teraz wprost: Partner omija wyłącznie organizacyjną
`v8OrgGate`, lecz cały `/api/v8` nadal podlega globalnej bramce w `Gateway.ts`;
bez `ENABLE_V8_GLOBAL` wynikiem jest `404 V8_DISABLED`. Komentarze o
nieistniejącym seederze request-time zastąpiono opisem realnej kolejności
middleware. Diff plików tras zawierał wyłącznie komentarze; dwa przypadki
behawioralne są częścią zestawu 12/12 PASS. Commit: `5104d6c328`.

## D.6 — izolacja tenantowa danych finansowych

Test `partner-tenant-isolation.day42.realpg.test.ts` przeszedł **8/8** przez
realny `ApiGateway` i własny PostgreSQL. Dwie firmy, dwa partner-orgi i
wartość-sentinel `987654.32` były realnymi rekordami.

| Próba | Powierzchnia                                            | Wynik                                        | Zimny readback                |
| ----- | ------------------------------------------------------- | -------------------------------------------- | ----------------------------- |
| N1    | `DELETE /campaign-links/:linkId` A→zasób B              | `404`                                        | rekord B identyczny           |
| N2    | `GET /earnings-summary`, token A + header B             | odmowa, brak B                               | brak zmian                    |
| N3    | `PUT /organization`, header A + body `organizationId=B` | zmieniono A, body zignorowane                | B bit-identyczne              |
| N4    | `PUT /organization`, header B + body B, token A         | odmowa                                       | A i B identyczne              |
| N5    | ledger, earnings, commissions, payouts, settings        | pięć `200`, tylko A                          | brak identyfikatorów i kwot B |
| rola  | MEMBER A na pięciu odczytach pieniędzy                  | pięć `403`                                   | finanse A/B identyczne        |
| N6    | OWNER A po `organization_members.status=INACTIVE`       | pięć `403`                                   | finanse A/B identyczne        |
| N7    | legacy `GET /api/partners/earnings`                     | faktyczne `200`, `Deprecation:true`, tylko A | brak B                        |

**Nie stwierdzono wycieku między firmami na kanonicznych powierzchniach V8 ani
na sprawdzonym legacy earnings.** Legacy pozostaje powierzchnią do usunięcia
po migracji wołaczy. Commit: `0d4cba8c7b`.

## D.4 — inwentarz tras

Pomiar kotwiczony: **35** tras. Podział: **26 REALNE, 2
REALNE_Z_SYNTEZĄ, 4 KIKUT_503, 3 ODMOWA_410, 0 NIEOSIĄGALNE**. „Wołacz” w
tej tabeli oznacza metodę klienta z `src/services/api/v8/partner.ts:384-451`;
dokładny stan jej użycia rozstrzyga D.8.

|   # | Metoda + ścieżka                                          | Linia | Klasa            | Źródło danych               | Realny wołacz w `src/`                  | Ekran/zakładka | Uwaga                                 |
| --: | --------------------------------------------------------- | ----: | ---------------- | --------------------------- | --------------------------------------- | -------------- | ------------------------------------- |
|   1 | POST `/clients`                                           |   149 | KIKUT_503        | brak                        | brak metody                             | Klienci        | `partner_client_creation`             |
|   2 | POST `/employees`                                         |   156 | KIKUT_503        | brak                        | brak metody                             | Zespół         | `partner_employee_creation`           |
|   3 | POST `/access-links`                                      |   163 | KIKUT_503        | brak                        | brak metody                             | Dostęp         | `partner_access_link_creation`        |
|   4 | POST `/licenses/order`                                    |   170 | KIKUT_503        | brak                        | brak metody                             | Licencje       | `partner_license_order`               |
|   5 | GET `/connection`                                         |   206 | REALNE           | partner org/users           | `getConnection:385`                     | shell          | przed bound guard                     |
|   6 | POST `/connect`                                           |   299 | REALNE           | partner org/user/receipt    | `connect:395`                           | onboarding     | zapis idempotentny                    |
|   7 | GET `/program/status`                                     |   323 | REALNE_Z_SYNTEZĄ | runtime/ledger/payouts      | `getProgramStatus:417`                  | podsumowanie   | GET pisze runtime; degraded oznaczony |
|   8 | GET `/program/ledger`                                     |   367 | REALNE           | program ledger              | brak metody                             | finanse        | odczyt audytowy                       |
|   9 | GET `/program/participant-ledger`                         |   399 | REALNE           | attributions                | `getParticipantLedger:418`              | program        | projekcja zdarzeń                     |
|  10 | POST `/program/lifecycle/request-payout-phase`            |   431 | ODMOWA_410       | brak zapisu                 | brak metody                             | wypłaty        | polityka ekonomii                     |
|  11 | GET `/clients`                                            |   504 | REALNE           | attributions/organizations  | `getClients:392`                        | Klienci        | pusty = pusty                         |
|  12 | GET `/projects`                                           |   539 | REALNE           | projekty klientów           | `getProjects:393`                       | Projekty       | realny SQL                            |
|  13 | GET `/employees`                                          |   573 | REALNE           | partner users/users         | `getEmployees:394`                      | Zespół         | realny SQL                            |
|  14 | GET `/onboarding-status`                                  |   608 | REALNE           | partner org/akceptacje      | `getOnboardingStatus:415`               | onboarding     | realny stan                           |
|  15 | POST `/onboarding/accept-terms`                           |   655 | REALNE           | akceptacje partnera         | `acceptOnboardingTerms:420`             | onboarding     | zapis                                 |
|  16 | POST `/onboarding/select-tier`                            |   720 | REALNE           | partner org                 | `selectOnboardingTier:422`              | onboarding     | zapis                                 |
|  17 | POST `/onboarding/complete`                               |   766 | REALNE           | partner org/checklist       | `completeOnboarding:424`                | onboarding     | zapis                                 |
|  18 | GET `/referral-tools`                                     |   841 | REALNE_Z_SYNTEZĄ | partner org/campaign links  | `getReferralTools:426`                  | Polecenia      | GET może zapisać kod syntetyczny      |
|  19 | GET `/referral-analytics`                                 |   937 | REALNE           | clicks/attributions         | `getReferralAnalytics:386`              | Analityka      | realny agregat                        |
|  20 | GET `/attributions`                                       |   967 | REALNE           | attributions                | `getAttributions:429`                   | Polecenia      | realny SQL                            |
|  21 | GET `/earnings-summary`                                   |  1002 | REALNE           | commissions/ledger/payouts  | `getEarningsSummary:427`                | Zarobki        | polityka odczytu wymagana             |
|  22 | GET `/commission-transactions`                            |  1048 | REALNE           | commission transactions     | `getCommissionTransactions:430`         | Zarobki        | realny SQL                            |
|  23 | GET `/payouts`                                            |  1086 | REALNE           | payouts                     | `getPayouts:432`                        | Wypłaty        | realny SQL                            |
|  24 | POST `/payouts/request`                                   |  1122 | ODMOWA_410       | brak zapisu                 | `requestPayout:433`                     | Wypłaty        | polityka ekonomii                     |
|  25 | POST `/campaign-links`                                    |  1206 | REALNE           | campaign links              | `createCampaignLink:435`                | Polecenia      | zapis                                 |
|  26 | DELETE `/campaign-links/:linkId`                          |  1247 | REALNE           | campaign links              | `deleteCampaignLink:437`                | Polecenia      | ownership w SQL                       |
|  27 | PUT `/organization`                                       |  1278 | REALNE           | partner org                 | `updateOrganization:439`                | Profil         | tenant z serwera                      |
|  28 | PUT `/organization/specializations`                       |  1319 | REALNE           | specializations             | `updateOrganizationSpecializations:441` | Profil         | zapis                                 |
|  29 | PUT `/organization/regions`                               |  1379 | REALNE           | regions                     | `updateOrganizationRegions:443`         | Profil         | zapis                                 |
|  30 | PUT `/organization/listing`                               |  1439 | REALNE           | partner org                 | `updateOrganizationListing:445`         | Profil         | zapis                                 |
|  31 | POST `/certifications/:certId/modules/:moduleId/progress` |  1476 | REALNE           | certification progress      | brak metody                             | Certyfikacje   | zapis                                 |
|  32 | POST `/certifications/:certId/exam/start`                 |  1506 | REALNE           | exam attempts               | `startCertificationExam:399`            | Certyfikacje   | idempotency key                       |
|  33 | POST `/certifications/:certId/exam/submit`                |  1526 | REALNE           | exam attempts/results       | `submitCertificationExam:407`           | Certyfikacje   | idempotency key                       |
|  34 | GET `/payout-settings`                                    |  1555 | REALNE           | partner org/payout accounts | `getPayoutSettings:447`                 | Wypłaty        | odczyt audytowy                       |
|  35 | PUT `/payout-settings`                                    |  1582 | ODMOWA_410       | brak zapisu                 | `updatePayoutSettings:448`              | Wypłaty        | polityka ekonomii                     |

## D.8 — inwentarz dwukierunkowy

### Backend ma, front nie woła

| Stan                      | Trasy/metody                                                                                                                                                                                                                                                           | Dowód                                                                                                     |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| WOŁANA (25)               | connection; analytics; clients; projects; employees; dwa exam; onboarding status + trzy mutacje; program status + participant ledger; referral tools; earnings; attributions; commissions; payouts; campaign create/delete; cztery update profilu; payout settings GET | `PartnerPortalView.tsx:1117,1583,2571`, `EarningsSection.tsx:261-335`, `ReferralToolsSection.tsx:229-436` |
| MARTWA_METODA_KLIENTA (3) | `connect`, `requestPayout`, `updatePayoutSettings`                                                                                                                                                                                                                     | definicje `src/services/api/v8/partner.ts:395,433,448`; grep wołaczy poza klientem = 0                    |
| BRAK_METODY_KLIENTA (7)   | cztery kikuty POST; `GET /program/ledger`; `POST /program/lifecycle/request-payout-phase`; certification progress                                                                                                                                                      | tabela D.4 + brak ścieżek w `partner.ts:384-451`                                                          |

Suma 25 + 3 + 7 = 35. „WOŁANA” oznacza co najmniej jeden bezpośredni wołacz;
pełny pomiar 28 metod wykonano osobno dla każdej nazwy.

### Zapis bez czytelnika

| Zapis                                              | Czytelnik + użycie frontu                              | Werdykt                               |
| -------------------------------------------------- | ------------------------------------------------------ | ------------------------------------- |
| connect                                            | connection, `PartnerPortalView.tsx:3035`               | skutek czytelny, metoda zapisu martwa |
| onboarding (3)                                     | onboarding status, `EnterpriseOnboardingWizard.tsx:84` | czytelny                              |
| campaign create/delete                             | referral tools, `ReferralToolsSection.tsx:229`         | czytelny                              |
| organization + specializations + regions + listing | brak kompletnego kanonicznego GET profilu w 35 trasach | **zapis bez pełnego czytelnika**      |
| exam start/submit/progress                         | start/submit mają UI; progress nie ma metody klienta   | progress: brak czytelnika/wołacza     |
| trzy odmowy ekonomiczne                            | brak zapisu z definicji (`410`)                        | nie wolno przedstawiać jako zapis     |
| cztery kikuty                                      | brak zapisu z definicji (`503`)                        | nie wolno przedstawiać jako zapis     |

### Kontrolka bez trasy / trasa zawsze odmawia / liczba frontowa

| Kontrolka                                                      | Stan                                                         | Dowód                                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| żądanie wypłaty                                                | metoda klienta istnieje, brak wołacza; backend zawsze `410`  | `partner.ts:433`, `partner.routes.ts:1122`                                    |
| zapis ustawień wypłat                                          | metoda istnieje, brak wołacza; backend zawsze `410`          | `partner.ts:448`, `partner.routes.ts:1582`                                    |
| tworzenie klienta/pracownika/linku dostępu/zamówienia licencji | backend `503`, brak metod klienta                            | `partner.routes.ts:149-176`                                                   |
| `totalEarned` / `readyForPayout`                               | UI stosuje fallback `?? 0`; może spłaszczyć UNKNOWN/degraded | `EarningsSection.tsx:113-120,455-475`, `PartnerRuntimeSummaryStrip.tsx:51-58` |
| sidebar przed connection                                       | disabled zależy od `connected`, nie od capability            | `PartnerSidebar.tsx:427-428`                                                  |

Podsumowanie kierunku 2: dwa typy zapisu bez pełnego czytelnika. Kierunek 3:
pięć rodzin kontrolek wymagających kontraktu frontowego. Zero zmian w `src/`.

## D.9 — kontrakt dla przyszłego dyżuru frontowego

### 1. DO UKRYCIA

- Akcje tworzenia klienta, pracownika, linku dostępu i zamówienia licencji:
  backend zwraca `503` (`partner.routes.ts:149-176`). Zgodnie z
  `DEC-2026-08-25-21/22` kontrolka nie może udawać dostępnej funkcji.
- Żądanie wypłaty i edycja ustawień wypłat: backend zwraca `410`
  (`partner.routes.ts:1122,1582`); nie wolno spłaszczać tej odmowy do neutralnego
  sukcesu.
- Pewne zera z fallbacków UI (`EarningsSection.tsx:113-120`,
  `PartnerRuntimeSummaryStrip.tsx:51-58`) muszą być ukryte przy `degraded`, bo
  UNKNOWN nie jest zerem.

### 2. DO OPISANIA JAKO „PLANOWANE”

- Cztery kikuty: PL „Funkcja planowana — obecnie niedostępna”; EN “Planned
  capability — currently unavailable”. Źródło capability:
  `partner.routes.ts:149-176`.
- Pełny odczyt skutków zmian profilu: PL „Pełny podgląd profilu — planowany”;
  EN “Full profile readback — planned”. Brak kompletnego GET w tabeli D.4.

### 3. DO WŁĄCZENIA

- `GET /program/ledger` i zapis postępu modułu certyfikacji nie mają metod
  klienta (`partner.routes.ts:367,1476`); można je podłączyć dopiero po osobnym
  kontrakcie ekranu.
- Każde włączenie ma nastąpić **za flagą domyślnie OFF, z polish-passem i
  akceptem właściciela na zrzutach**, zgodnie z regułą 7 `CLAUDE.md`.

### 4. DO NIETKNIĘCIA

- Cała ekonomia Partnera: lifecycle payout, payout request, payout settings
  write oraz wszystkie powiązane kontrolki. `AMD-PRT-ECONOMICS-002` jest stałą
  kompilacyjną (`partnerEconomicsPolicy.ts:55-72,164-172`); reaktywacja wymaga
  nowej decyzji właściciela.

### 5. KSZTAŁT KOPERTY

- Trasy realne zachowują `{ data, meta }`; `meta` zawiera `version`,
  `contract`, `partnerOrgId` i `v8TenantOrganizationId` zgodnie z
  `partner.routes.ts:213-232`. Odczyty ekonomiczne dodają
  `policyUnavailable` z decyzją, kodem, operacjami i `historicalReadOnly`.
- `program/status` i `earnings-summary` mogą zawierać `data.degraded = {
reason, snapshotAt }`; UI musi pokazać UNKNOWN, nie pewne zero.
- Kikut zachowuje `503 { success:false, code:'FEATURE_NOT_AVAILABLE',
capability, message }`; odmowa ekonomiczna zachowuje `410 {
success:false, code, decision, operation, message, policyUnavailable }`.
- Planowane `meta.dataFidelity: 'real'|'synthesized'|'unavailable'` oraz
  `meta.dataFidelityReason` **nie zostało dostarczone w D.5** z powodu STOP
  zakresowego opisanego niżej. Front nie może zakładać obecności tych pól.

### STOP — D.5 — ★ WYCOFANY PO ODBIORZE (2026-08-28)

**Ten STOP był NIEZASADNY i cała poniższa propozycja jest WYKREŚLONA.**

Ramka licencji dyżuru (`§1.7`) dopuszczała `server/src/routes/v8/partner.routes.ts`
w zakresie „addytywne pola `meta` z `§D.5`". Jednocześnie DoD `§D.5` wymagało,
by koperta trasy `ODMOWA_410` pozostała **NIETKNIĘTA**. Plik, na który
powołano STOP — `server/src/services/partnerEconomicsPolicy.ts` — był
dokładnie tym, którego **nie wolno** było ruszać, a licencjonowana praca leżała
gdzie indziej. Wykonawca nie doczytał licencji.

**WYKREŚLONE:** propozycja dopisania `meta: { dataFidelity: 'unavailable', … }`
do `partnerEconomicsPolicyBody()`. Jest sprzeczna z DoD `§D.5`, a guard jest
zamontowany na **czterech** powierzchniach (`v8/partner.routes.ts:121`,
`partners.routes.ts:277`, `:2491`, `:2966`), więc zmiana wyszłaby również na
legacy i dwie powierzchnie superadmina. Nie realizować jej ani teraz, ani
później, bez osobnej decyzji właściciela dotyczącej kontraktu `410`.

`§D.5` została wykonana w pliku objętym licencją — patrz sekcja
„SPROSTOWANIA PO ODBIORZE" niżej.

## Pomiar bazowy Z24

Pełny zakres przed pierwszym commitem: **548 PASS / 15 FAIL / 92 SKIPPED** w
78 plikach (`54 passed / 22 failed / 2 skipped`). Czerwień jest zastana.
Wspólny przebieg jest destrukcyjny dla jednej bazy: zastane testy kasowały
tabele i kolidowały na `CREATE TABLE`; po pomiarze kontener został usunięty z
wolumenem, odtworzony i ponownie zmigrowany przed testami Day 42.

## Pomiar HEAD Z24

Pełny zakres na HEAD: **565 PASS / 18 FAIL / 92 SKIPPED** w 80 plikach
(`56 passed / 22 failed / 2 skipped`). Zakres uruchomiono katalogami, ponieważ
zacytowane globy przekazane literalnie do Vitest wybrały tylko 5 plików; wynik
tego pierwszego, niepełnego przebiegu 30/30 nie jest używany jako Z24.

- Czerwone ZASTANE: marker miał 15 FAIL; dotyczą zastanych testów Partner i
  `legacyCutover` operujących współbieżnie na jednej bazie, m.in. oczekiwań
  503/404 przy faktycznym 403, brakujących tabel po destrukcyjnych sąsiadach i
  wymagań prefiksu bazy.
- Czerwone WPROWADZONE: arytmetyczna różnica wynosi +3 FAIL, ale żaden nie jest
  w dotkniętych testach Day 42. Oba nowe pliki przeszły samodzielnie: 12/12 i
  8/8. Nie przypisuję tych trzech do SHA bez dowodu; pełny pakiet jest
  niehermetyczny i zmienia wspólny schemat podczas przebiegu.
- 92 SKIPPED: jawne bramki poszczególnych zastanych harnessów wymagają innych
  nazw/prefiksów disposable DB lub własnych zmiennych `REAL_PG`; nie były
  raportowane jako PASS.
- Nie osłabiono ani nie usunięto żadnego zastanego testu/`describe`. Zmieniono
  wyłącznie nazwy dwóch istniejących przypadków Day 42 przed ich pierwszym
  commitem; asercje pozostały identyczne.

Deklaracja: **ZASIĘG PEŁNY** według listy §0.4a, z 92 jawnymi pominięciami.
**NIE przepisałem liczb dnia 12 ani z MODULE_ACCEPTANCE — zmierzyłem sam.**

## Pozycje — stan

| Pozycja | Status          | Commit         | Dowód                                                                        |
| ------- | --------------- | -------------- | ---------------------------------------------------------------------------- |
| D.1     | ZROBIONE_WG_DoD | `8b78c335cc`   | realny Gateway/PG, 6/6                                                       |
| D.2     | ZROBIONE_WG_DoD | `9f8f49aebe`   | wariant 1, łańcuchy connection/read/write/readback                           |
| D.3     | ZROBIONE_WG_DoD | `5104d6c328`   | komentarze + 12/12                                                           |
| D.4     | ZROBIONE_WG_DoD | `968e810ebe`   | 35 wierszy, suma 35                                                          |
| D.5     | ZROBIONE_WG_DoD | `f7e50bec80`   | addytywne `meta` w pliku licencjonowanym, 5/5; STOP wycofany jako niezasadny |
| D.6     | ZROBIONE_WG_DoD | `0d4cba8c7b`   | 8/8, A/B + readback                                                          |
| D.7     | ZROBIONE_WG_DoD | `1a267cd0ee`   | teza obalona                                                                 |
| D.8     | ZROBIONE_WG_DoD | `80a5c3e688`   | trzy kierunki, 35 tras                                                       |
| D.9     | ZROBIONE_WG_DoD | `e02f3ec481`   | pięć list kontraktu                                                          |
| R.1     | ZROBIONE_WG_DoD | `3d05a5ca1e`   | jeden blok, gate bez zmian                                                   |
| R.2     | ZROBIONE_WG_DoD | commit raportu | raport końcowy                                                               |

Licznik po naprawach: **11 ZROBIONE_WG_DoD / 0 CZĘŚCIOWO / 0 STOP /
0 BRAK_API / 0 BRAK_POTRZEBY / 0 NIE_ZACZĘTE** (jeden wąski, nazwany STOP
cząstkowy dotyczy wyłącznie `getPartnerConnectionHandler` — patrz niżej).

## Dowód braku atrapy i nietknięcia ekonomii

- Cztery `503 FEATURE_NOT_AVAILABLE`, trzy `410
PARTNER_ECONOMICS_POLICY_DISABLED`, odmowy auth i stany degraded zachowano.
- Diff `partnerEconomicsPolicy.ts`, `partnerCommissionService.ts` i
  `partnerPayoutSettingsService.ts` względem markera: pusty.
- `src/` diff: 0 linii. Nie ukrywano ani nie reaktywowano kontrolek, ponieważ
  `src/**` było poza zakresem zapisu.

## Bezpieczniki i zakres

- `git stash list` → puste; `git status --short` → puste przed aktualizacją
  raportu.
- `git diff ... -- src/ | wc -l` → `0`.
- diff `.env.example server/src/middleware/` → `0`.
- kontrola wiązania `grep -c 23652ec80a ...INSTRUKCJA.md` → `13`.
- Dotknięte pliki: dwa komentarzowe pliki routera, dwa nowe testy Partner,
  raport i jeden blok `MODULE_ACCEPTANCE.md`; dodatkowo branch bazowy niesie
  trzy wiążące commity samej instrukcji.
- Nie było push, stash, Railway, demo, stagingu ani produkcji.

## Sprzątanie

`docker rm -fv cx-day42-pg` → `cx-day42-pg`; następny `docker ps -a` dla tej
nazwy zwrócił pusty wynik. Kontener i anonimowy wolumen zostały usunięte.

## Twierdzenia niezweryfikowane / gotowość

- Brak dowodu przeglądarkowego i akceptu właściciela; gate modułu pozostaje
  `TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF`.
- Nie zweryfikowano konfiguracji żadnego środowiska wdrożeniowego; zdanie dla
  dnia 38 jest wyłącznie kontraktem, bez kontaktu z infrastrukturą.
- D.5 pozostaje STOP. Portal jest osiągalny przy kanonicznym env i pełnym
  schemacie, a izolacja finansowa V8 jest udowodniona; pakiet nie jest pełnym
  PASS całego dyżuru z powodu D.5 i zastanej czerwieni Z24.

---

## SPROSTOWANIA PO ODBIORZE ADWERSARYJNYM (FIX-1 … FIX-7)

Gałąź naprawcza: `day42-fixes-20260828` (baza `e741931a06`). Własny efemeryczny
PostgreSQL 17 + pgvector, host `127.0.0.1`, port `5799`, kontener `cx-fix42-pg`,
baza migrowana pełnym runnerem. Zero kontaktu z Railway, demo, stagingiem i
produkcją. Bez `git stash`, bez `push`.

### FIX-1 — test bezpieczeństwa leczył się skutkiem ataku

`vitest.config.ts:311` ustawia `retry: process.env.CI ? 3 : 1`. Suita izolacji
dnia 42 dawała przez to **8/8 PASS przy realnym, żywym IDOR-ze**: pierwsze
podejście kasowało cudzy wiersz, ponowienie widziało `404` i „readback bez
zmian". Odtworzone tutaj co do znaku.

Naprawa jest **lokalna**: opcja suity `{ retry: 0 }` w plikach dnia 42
(`@vitest/runner`: `retry: options.retry ?? runner.config.retry`, a opcje suity
są scalane w każdy test). **`vitest.config.ts` NIE został zmieniony** — trwa
osobne śledztwo nad tym wektorem.

| Przebieg     | Stan kodu produkcyjnego                                      | Wynik suity izolacji                         |
| ------------ | ------------------------------------------------------------ | -------------------------------------------- |
| bazowy       | czysty `HEAD`                                                | `11 passed (11)`                             |
| mutant M1    | `partnerReferralService.ts:832` bez `AND partner_org_id = ?` | `1 failed \| 10 passed (11)` — czerwony `N1` |
| po cofnięciu | czysty `HEAD`                                                | `11 passed (11)`                             |

### FIX-2 — wiązanie tenant→partner nie było sprawdzane

Dodane przypadki `B1` (użytkownik w `partner_users` partner-orga należącego do
OBCEGO tenanta) i `B2` (`owner_organization_id IS NULL`), każdy na odczycie,
pięciu odczytach pieniędzy i zapisie z zimnym readbackiem.

| Przebieg     | Stan kodu produkcyjnego                                                  | Wynik                                             |
| ------------ | ------------------------------------------------------------------------ | ------------------------------------------------- |
| mutant M2    | `partnerOrgResolution.ts:117` → `(po.owner_organization_id = ? OR TRUE)` | `2 failed \| 9 passed (11)` — czerwone `B1`, `B2` |
| po cofnięciu | czysty `HEAD`                                                            | `11 passed (11)`                                  |

Przed FIX-2 ta sama mutacja nie zapalała **żadnego** testu.

### FIX-3 — asercje bez zębów

`expect(status).not.toBe(200)` w `N2`, `N4` i w teście bramki przepuszczało `500`
jako „izolacja działa". Wszystkie trzy zaostrzone do dokładnego statusu i kodu
(`403` / `ORG_MEMBERSHIP_REVOKED`, źródło: `partner.routes.ts:103-106`).
Dodatkowo przypadek `MEMBER` zaostrzony do `RBAC_INSUFFICIENT_ROLE` — i to
właśnie ten przypadek pilnuje `partner.routes.ts:272` (mutacja tej tablicy →
czerwień).

### FIX-4 — ★ TEZA ODBIORU CZĘŚCIOWO OBALONA

Odbiór twierdził, że `403` po odebraniu członkostwa przychodzi z
`server/src/middleware/auth.middleware.ts`, nie z routera partnera. **Pomiar tego
nie potwierdza.** Ciało odmowy to `{ success:false, code }` **bez** pola `error`,
czyli `requireActiveMembership`
(`server/src/services/legacyCutover/requireActiveMembership.ts:35`) wewnątrz
routera partnera; `validateOrgMembership` odpowiada kształtem `{ error, code }`.

Prawdziwy powód, dla którego usunięcie `partner.routes.ts:272` nie zapalało `N6`,
to **redundancja**: ta sama ściana stoi też na łapaczu `router.use` w
`partner.routes.ts:213`.

| Mutacja                                                    | `MEMBER` | `N6`     | `N6b`                                |
| ---------------------------------------------------------- | -------- | -------- | ------------------------------------ |
| tylko `:272` (`requirePartnerEconomicsReadAccess` → puste) | CZERWONY | zielony  | zielony                              |
| tylko `:213` (łapacz bez `requireActiveMembership`)        | zielony  | zielony  | zielony                              |
| `:272` **oraz** `:213`                                     | CZERWONY | CZERWONY | CZERWONY (`200` na pięciu odczytach) |

Rozstrzygnięcie: `N6` **przemianowany** na to, co realnie dowodzi, z asercją
kształtu ciała (przypisanie warstwy), z własnym pryncypałem (odporność na
kolejność) — oraz **dodany `N6b`**, który rozgrzewa 60-sekundowy cache
`validateOrgMembership` (`auth.middleware.ts:1662`) legalnym odczytem `200`,
dopiero potem odbiera członkostwo. Nie przemianowałem testu „w bok": rozdzieliłem
twierdzenie od dowodu.

**ZNALEZISKO DLA DYŻURU 37 (bramka kontekstu organizacji):** po usunięciu **obu**
ścian routera odczyty pieniędzy odpowiadają `200` przy odebranym członkostwie.
Żadna bramka platformowa nie chroni `/api/v8/partner` — cała gwarancja opiera się
na middleware tego jednego routera.

### FIX-5 — D.5 wykonane, STOP wycofany

Wykonane wyłącznie w `server/src/routes/v8/partner.routes.ts` (plik objęty
licencją), addytywnie, bez zmiany żadnego istniejącego pola i bez zmiany żadnego
statusu:

| Trasa / grupa               | `dataFidelity` | Powód (mechanizm)                                                                                                  |
| --------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------ |
| 4 kikuty `503` (`:149-176`) | `unavailable`  | brak polecenia biznesowego dla danej `capability`                                                                  |
| `GET /program/status`       | `synthesized`  | runtime materializowany na odczycie przez `getOrCreateRuntime`; przy `degraded` doklejany powód zerowego snapshotu |
| `GET /referral-tools`       | `synthesized`  | kod, slug i QR wyprowadzone z NAZWY organizacji przez `ensurePartnerReferralIdentity`                              |
| pozostałe odczyty realne    | `real`         | przez `partnerReadMeta` / `partnerProgramMeta`                                                                     |
| **`410 ODMOWA`**            | **brak pola**  | **koperta polityki NIETKNIĘTA**                                                                                    |

`GET /referral-tools` deklaruje `synthesized` na **każdej** gałęzi, bo synteza
zachodzi w serwisie (`partnerReferralService.ts:574`), a nie tylko w fallbackach
trasy — gałąź, która się wykonała, nie jest dla wołacza obserwowalna.
Rozróżnienie „zsyntetyzowane teraz" od „zsyntetyzowane wcześniej i utrwalone"
wymagałoby dodatkowego odczytu kolumn tożsamości, czyli zmiany zachowania, a nie
addytywnego pola `meta` — dlatego tego nie zrobiono (decyzja jawna, nie zgadywana).

Dowód nienaruszenia koperty `410`: test `D.5-4` sprawdza dokładny zestaw kluczy
najwyższego poziomu (`code, decision, message, operation, policyUnavailable,
success`), brak `meta`, plus `D.5-4b` statycznie dowodzi, że wspólny builder
`partnerEconomicsPolicyBody()` nigdy nie dostał pola `dataFidelity`.

Dowód niezłamania konsumenta: `src/services/api/v8/client.ts:21` (`v8Get`) zwraca
`json.data` i **odrzuca `meta` w całości**, więc żadna z 28 metod klienta
partnera nie widzi dodanego pola. Ścieżka błędu czyta `data.code`
(`src/services/api/v8/partner.ts:376`), które pozostało bez zmian.

**★ WĄSKI STOP — jedna trasa.** `meta.dataFidelity: 'real'` należy się też
`getPartnerConnectionHandler`, ale zastany
`tests/integration/partners/partner-connection-handler.day12.test.ts:45`
asercjonuje tę kopertę dokładnie (`toHaveBeenCalledWith`), a licencja dnia 42 dla
`tests/integration/partners/**` obejmuje **wyłącznie nowe pliki**. Dodanie pola
bez licencji na edycję tej asercji świadomie zaczerwieniłoby zielony zastany test,
a osłabienie go zabrania `Z24`. Zostawione nietknięte, z komentarzem w kodzie.
Potrzebna licencja: jedna linia w trasie + jedna linia w tej asercji.

Parytet i18n: `dataFidelityReason` jest łańcuchem maszynowym cytującym mechanizm
(wymóg `§D.5` pkt 4), a nie napisem UI — spójnie z istniejącymi `message`
w tym routerze. Copy PL/EN dla użytkownika należy do dyżuru frontowego (`§D.9`).

### FIX-6 — rejestr modułu

`docs/…/modules/16_PARTNER/MODULE_ACCEPTANCE.md` dostał jawne sprostowanie:
zdanie „8/8 … nie znaleziono P0" wyprzedzało dowód, bo te 8/8 współistniało
z żywym IDOR-em. Wpisany stan po naprawach i zawężenie twierdzenia o braku `P0`
do faktycznie zmierzonych powierzchni. Bramka modułu bez zmian.

### FIX-7 — higiena

**Prefiksy commitów — sprostowanie.** `9f8f49aebe` i `5104d6c328` niosą prefiks
`fix(partner)`, który sugeruje naprawę produkcyjną. Faktyczna zawartość:

| Commit       | Prefiks w historii | Co realnie zawiera                                                             |
| ------------ | ------------------ | ------------------------------------------------------------------------------ |
| `9f8f49aebe` | `fix(partner)`     | **wyłącznie** nowy test integracyjny + komentarz mountu; zero zmian zachowania |
| `5104d6c328` | `fix(partner)`     | **wyłącznie** komentarze w routerze + przypadki testowe; zero zmian zachowania |

Historii nie przepisujemy — poprawny opis jest tutaj. Poprawny prefiks brzmiałby
`test(partner)` / `docs(partner)`.

**Zmienna środowiskowa.** `afterAll` zostawiał globalnie
`ENABLE_V8_GLOBAL='true'` dla wszystkich plików uruchamianych później w tym samym
workerze. Wartość wejściowa jest teraz zapamiętywana i przywracana dokładnie,
łącznie z przypadkiem „w ogóle nie była ustawiona".

**Przebieg całego katalogu.** Sąsiedzi z `tests/integration/partners` są
destrukcyjni: `m16-final-repair.realdb.test.ts:43` kasuje `organizations`,
`users`, `projects`, `partner_payouts`, `partner_program_ledger` `CASCADE`
i odtwarza `organizations` jako `(id text, name text, plan text)` — bez kolumny
`status`; `partner-accrual-payout-atomic.realdb.test.ts:21` odtwarza
`partner_organizations` jako `(id uuid, payout_method text)`. Stąd
`column "status" of relation "organizations" does not exist` w `beforeAll`
i `operator does not exist: uuid = text` w sprzątaniu.

Nowy `tests/integration/partners/day42SchemaResilience.ts` addytywnie
i idempotentnie odtwarza **tylko** kolumny zapisywane przez fikstury dnia 42
(`ADD COLUMN IF NOT EXISTS`, nigdy `DROP`/`ALTER TYPE`, wyłącznie na bazie
`cx_day42`), a gdy tabeli brakuje w całości — przerywa nazwanym błędem
`DAY42_PRECONDITION_SCHEMA_DAMAGED` wskazującym sąsiada. Sprzątanie porównuje
`partner_org_id::text`, co działa niezależnie od typu kolumny.

| Przebieg `tests/integration/partners` (cały katalog, świeża baza) | Pliki dnia 42                                                                                                                       |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| przed FIX-7                                                       | **3/3 CZERWONE** (`beforeAll`), katalog: `12 failed \| 11 passed \| 2 skipped` (25 plików), `14 failed \| 190 passed \| 84 skipped` |
| po FIX-7, przebieg 1                                              | **0 FAIL**, katalog: `8 failed \| 15 passed \| 2 skipped`, `9 failed \| 191 passed \| 88 skipped`                                   |
| po FIX-7, przebieg 2                                              | **0 FAIL**, katalog: `8 failed \| 15 passed \| 2 skipped`, `15 failed \| 185 passed \| 88 skipped`                                  |

Zmienność liczb sąsiadów jest ich własną, zastaną niestabilnością (współdzielona
baza, destrukcyjne `DROP`), nie skutkiem tych zmian: żaden zastany test nie był
edytowany ani osłabiony, a dwa pliki sąsiadów wręcz przestały padać.

### Mianownik testów po naprawach

| Plik                                                    | Przed             | Po                       |
| ------------------------------------------------------- | ----------------- | ------------------------ |
| `partner-tenant-isolation.day42.realpg.test.ts`         | 8/8 (z `retry`)   | **11/11 przy `retry=0`** |
| `partner-portal-gate-diagnosis.day42.realpg.test.ts`    | 12/12 (z `retry`) | **12/12 przy `retry=0`** |
| `partner-envelope-fidelity.day42.realpg.test.ts` (nowy) | —                 | **5/5 przy `retry=0`**   |
| razem                                                   | 20                | **28/28**                |

### TWIERDZENIA NIEZWERYFIKOWANE (po naprawach)

1. **Brak dowodu przeglądarkowego i akceptu właściciela.** Bramka modułu
   pozostaje `TECHNICAL_BROWSER_PASS / OWNER_PENDING / ECONOMICS_OFF`.
2. **Brak `P0` dotyczy wyłącznie zmierzonych powierzchni**: pięciu kanonicznych
   odczytów pieniędzy V8, `DELETE /campaign-links/:id`, `PUT /organization`
   i legacy `GET /api/partners/earnings`. Pozostałe z 35 tras nie były testowane
   pod kątem izolacji.
3. **Nie wykonano pomiaru `Z24` całego repozytorium** po tych naprawach — mierzony
   był katalog `tests/integration/partners` oraz trzy pliki dnia 42. Wpływ
   `meta.dataFidelity` na testy spoza tego katalogu nie został zmierzony; jedyny
   znany konsument zastany (`partner-connection-handler.day12.test.ts`) jest
   zielony i celowo nietknięty.
4. **Nie zmierzono ani nie naprawiono globalnego `retry`** w `vitest.config.ts` —
   inne suity bezpieczeństwa w repozytorium mogą mieć ten sam defekt. To jest
   przedmiotem osobnego śledztwa.
5. **Odporność na sąsiadów ma granicę.** Naprawa odtwarza kolumny i nazywa
   przyczynę; jeżeli destrukcyjny sąsiad usunie tabelę **w trakcie** przebiegu
   dnia 42, żaden mechanizm wewnątrz pliku tego nie uratuje.
6. **`N7` (legacy) nie był ponownie badany mutacyjnie** — pozostaje w kształcie
   z dyżuru, jako udokumentowany fakt, nie jako gwarancja.
7. **Nie zweryfikowano żadnego środowiska wdrożeniowego.** Zdanie dla dnia 38
   pozostaje kontraktem bez kontaktu z infrastrukturą.
