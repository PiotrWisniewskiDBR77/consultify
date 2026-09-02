# REJESTR G05 — PRZELOT I ODCZYT NA ZIMNO — 2026-09-02

Wynik częściowy dyżuru 279. `PRZEŻYWA` oznacza realne HTTP przez produkcyjny `ApiGateway`, świeży JWT i PostgreSQL; `PODEJRZENIE` oznacza wyłącznie inwentarz kodu, bez wywołania.

| Moduł | Mierzony zapis | Trasa zapisu (plik i linia) | Trasa odczytu (plik i linia) | Stan | Dowód | Ekran frontu lub BRAK EKRANU |
| --- | --- | --- | --- | --- | --- | --- |
| Organizacja | utworzenie organizacji A przez rejestrację: ID `00f16ff2-c960-43ec-adc3-65ed2634818f`, nazwa `Day279 Organization A 1788367026484` | `POST /api/auth/register` — `server/src/routes/auth.routes.ts:1748` | `GET /api/organizations/:orgId` — `server/src/routes/organization/organizations.routes.ts:53` | PRZEŻYWA | cold readback 200 zwrócił dokładne ID i nazwę; token B dostał 403. Uwaga krytyczna: po zapisie rejestracja wywraca proces na `emailVerificationService.ts:26-33` (`DATETIME`, PG `42704`). | ekran rejestracji / tworzenia firmy |
| Wywiad | kandydat: sesja wywiadu | `POST /api/interview/sessions` — `server/src/routes/interview.routes.ts:75` | `GET /api/interview/sessions/:id` — `server/src/routes/interview.routes.ts:72` | PODEJRZENIE | trasy zamontowane `server/src/Gateway.ts:1349`; nie wywołano | `src/components/Interview/**` |
| Narzędzia | kandydat: sesja narzędzia | `POST /api/tools` — `server/src/routes/tools.routes.ts:39` | `GET /api/tools/:toolId` — `server/src/routes/tools.routes.ts:52` | PODEJRZENIE | trasy zamontowane `server/src/Gateway.ts:605`; nie wywołano | hub Narzędzia / sesja narzędzia |
| Ocena | kandydat: raport/sekcja oceny | `PUT /api/assessment-reports/:reportId` — wołacz `src/components/Assessment/ReportEditor.tsx:178` | `GET /api/assessment-reports/:reportId` — wołacz `src/components/Assessment/ReportEditor.tsx:130` | PODEJRZENIE | router zamontowany `server/src/Gateway.ts:1096`; nie wywołano | `src/components/Assessment/ReportEditor.tsx` |
| Inicjatywy | kandydat: zmiana inicjatywy | `PUT /api/initiatives/:initiativeId` — wołacz `src/components/Assessment/InitiativesTable.tsx:237` | `GET /api/initiatives/:initiativeId` — wołacz `src/components/Assessment/modals/InitiativeDetailsModal.tsx:161` | PODEJRZENIE | router zamontowany `server/src/Gateway.ts:689`; nie wywołano | tabela i modal inicjatyw |
| Realizacja | kandydat: decyzja wykonawcza Runtime-v1 | `POST /api/initiatives/runtime-v1/my-work/execution` — `src/services/initiatives-execution/runtimeApi.ts:121` | `GET /api/initiatives/runtime-v1/my-work/execution` — ta sama rodzina klienta | PODEJRZENIE | produkcyjny mount inicjatyw `server/src/Gateway.ts:680-700`; nie wywołano | `src/components/Execution/**` |
| Moja praca | kandydat: zadanie | rodzina `/api/tasks` — mount `server/src/Gateway.ts:903` | rodzina `/api/tasks` — mount `server/src/Gateway.ts:903` | PODEJRZENIE | nie ustalono kontraktu payloadu i nie wywołano | widok Moja praca / zadania |
| Spotkania | kandydat: spotkanie | router zapisu `server/src/routes/meeting.routes.ts:355` | router odczytu `server/src/routes/meeting.routes.ts:311` | PODEJRZENIE | nie wywołano | widok Spotkania |
| Wyniki | kandydat: strategiczny wynik/KPI | router zapisu `server/src/routes/resultsStrategic.routes.ts:379` | router odczytu `server/src/routes/resultsStrategic.routes.ts:368` | PODEJRZENIE | rodziny wyników zamontowane `server/src/Gateway.ts:1227-1232`; nie wywołano | widok Wyniki |
| Finanse | kandydat: analiza finansowa | router zapisu `server/src/routes/economics.routes.ts:704` | router odczytu `server/src/routes/economics.routes.ts:642` | PODEJRZENIE | beta-gated mount `server/src/Gateway.ts:1200`; nie wywołano | `src/components/Economics/**` |
| Materiały | kandydat: artefakt | router zapisu `server/src/routes/artifacts.routes.ts:624` | router odczytu `server/src/routes/artifacts.routes.ts:599` | PODEJRZENIE | mount `server/src/Gateway.ts:1038`; nie wywołano | biblioteka Materiały / artefakty |
| Audyty | kandydat: ustalenie audytowe | `POST` — `server/src/routes/audits/findings.routes.ts:91` | `GET` — `server/src/routes/audits/findings.routes.ts:47` | PODEJRZENIE | ścisły mount tenantowy `server/src/Gateway.ts:1367`; nie wywołano | widok Audyty / ustalenia |
| Czat | kandydat: projekt czatu | `POST /api/chat-projects` — `server/src/routes/chat-projects.routes.ts:386` | `GET /api/chat-projects/:id` — `server/src/routes/chat-projects.routes.ts:320` | PODEJRZENIE | mount `server/src/Gateway.ts:712`; nie wywołano | projekty Czat |
| Administracja | kandydat: profil organizacji | rodzina `/api/admin/organization-profile` — mount `server/src/Gateway.ts:789` | ta sama rodzina — mount `server/src/Gateway.ts:789` | PODEJRZENIE | nie wywołano | panel Administracja / profil organizacji |
| Ustawienia | kandydat: preferencje powiadomień | `PUT /api/settings/notifications/preferences` — wołacz `src/hooks/useUserNotificationPreferences.tsx:214` | `GET /api/settings/notifications/preferences` — `src/hooks/useUserNotificationPreferences.tsx:153` | PODEJRZENIE | mount `server/src/Gateway.ts:760`; nie wywołano | Ustawienia powiadomień |
| Partner | nie rozstrzygnięto, czy istnieje zapis użytkownika | rodzina `/api/partners` — mount `server/src/Gateway.ts:1308` | rodzina `/api/partners` — mount `server/src/Gateway.ts:1308` | PODEJRZENIE | nie wykonano pełnego negatywnego skanu wołaczy; nie wolno wpisać `BRAK ZAPISU` | widok Partner |

## Podsumowanie

- PRZEŻYWA: 1
- NIE PRZEŻYWA: 0
- BRAK ZAPISU: 0
- ZA FLAGĄ: 0
- PODEJRZENIE: 15
