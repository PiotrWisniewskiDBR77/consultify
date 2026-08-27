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

## Pomiar bazowy Z24

Pełny zakres przed pierwszym commitem: **548 PASS / 15 FAIL / 92 SKIPPED** w
78 plikach (`54 passed / 22 failed / 2 skipped`). Czerwień jest zastana.
Wspólny przebieg jest destrukcyjny dla jednej bazy: zastane testy kasowały
tabele i kolidowały na `CREATE TABLE`; po pomiarze kontener został usunięty z
wolumenem, odtworzony i ponownie zmigrowany przed testami Day 42.

## Pozycje — stan

| Pozycja | Status          | Commit                  | Dowód                                       |
| ------- | --------------- | ----------------------- | ------------------------------------------- |
| D.1     | ZROBIONE_WG_DoD | `8b78c335cc`            | realny Gateway + realny PG, 6/6             |
| D.7     | ZROBIONE_WG_DoD | commit bieżącej pozycji | kotwiczony grep + lokalizacja realnej trasy |

## Twierdzenia jeszcze niezweryfikowane

Na tym etapie nie zakończono pełnych łańcuchów D.2, macierzy finansowej D.6,
inwentarza 35 tras, inwentarza konsumentów ani końcowego pomiaru Z24. Nie są
raportowane jako ukończone.
