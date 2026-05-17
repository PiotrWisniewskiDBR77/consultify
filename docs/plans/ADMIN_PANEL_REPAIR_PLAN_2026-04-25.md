# Konsultify Admin Panel - plan napraw po testach demo

Data utworzenia: 2026-04-25  
Srodowisko z raportu: `demo.consultify.ai`  
Konto testowe: Piotr Wisniewski, rola `Owner`  
Zakres: modul Admin Panel, wszystkie glowne sekcje administracyjne  
Status: CLOSED lokalnie - P0/P1 naprawione i zweryfikowane; pozostaje wyłącznie powtórka smoke po deployu na demo/staging

## Status realizacji 2026-04-25

Zrobione w pierwszych pakietach napraw:

- Overview: pusty ekran zastapiony czytelnym error state z retry.
- People & Access: `Add member` reaguje takze przy pustym emailu, a `Generate code` obsluguje oba formaty odpowiedzi serwera.
- Security & Identity: `/api/api-keys` jest zamontowane jako produkcyjna trasa, frontend uzywa kontraktu `permissions` i odczytuje `plainTextKey`; IAM policy, delegated assignments i SCIM token flow sa obslugiwane przez P32 admin routes.
- AI Governance: Owner/administrator moze zapisywac ustawienia AI organizacji.
- Billing & FinOps: `Add method` waliduje pusty input, invoices maja empty state, alerts maja domyslne kontrolki.
- Integrations & Sync: bledy API sa formatowane bez `[object Object]`; connectory niegotowe sa oznaczone jako `Not available`; jesli V8 connect zwraca `externalAuth`, UI otwiera sesje autoryzacji.
- Audit Log: export CSV mapuje bledy na czytelny komunikat zamiast surowego obiektu; retention zapisuje sie przez `/api/admin/compliance/data-retention`.
- Organization Ops: approved email domains maja zamontowany backend route i podstawowy add/remove flow; primary brand color zapisuje sie przez `/api/branding/:orgId`; custom domain zapisuje konfiguracje brandingu jako pending verification.
- Competencies: katalog kompetencji korzysta ze wspolnego klienta API z auth/org-context headers i czytelnymi bledami.
- V8 Sync backend: katalog connectorow jest spójny z kontraktem V8 (`project_management`, wymagane pola OAuth/config), a connect/configure dla Jira, Gmail, Asana, Teams i Slack przechodzi testy.
- Organization Ops / Branding: Owner/Admin moze uploadowac logo przez `/api/branding/:orgId/upload`; UI zapisuje `logoLightUrl` i odczytuje aktualny branding z `/branding/:orgId`.
- Routing i role guard: legacy role zwracane przez backend (`administrator`, `owner`) sa normalizowane w frontendowym guardzie, dzieki czemu Admin Panel nie przekierowuje admina/ownera do `/chat`.
- AI Governance UI: uzywany widok `OrgAISettingsView` ma czytelne mapowanie bledow i walidacje limitow, budzetow oraz aktywnych rol AI przed zapisem.

Weryfikacja wykonana:

- Linter IDE: brak bledow dla zmienionych plikow.
- Regresja admin/AI/API keys: `17/17` testow passed (`adminP32.routes`, `ai-settings-api`, `ApiKeyService`).
- Regresja P32 admin cockpit: `9/9` testow passed (`server/src/routes/__tests__/adminP32.routes.test.ts`), w tym security policy, collaboration controls, IAM policy, delegated assignments, payment methods i SCIM tokens.
- Regresja V8 sync: `39/39` testow passed (`server/src/routes/v8/__tests__/sync.routes.test.ts`).
- Regresja finalna targeted: `48/48` testow passed (`v8 sync`, `integrations.routes`, `adminIntegrations.routes`, `organizationIdentityService`).
- Smoke e2e readiness: `3/3` testow passed (`npm run test:e2e:readiness`), obejmuje routy Settings, Admin i SuperAdmin; wykryty redirect `/admin/overview -> /chat` zostal naprawiony normalizacja legacy ról.

Decyzje końcowe / zależności zewnętrzne:

- `demo.consultify.ai` / staging: powtórzyć smoke po deployu, bo ten krok wymaga wdrożonego artefaktu i danych/sekretów środowiskowych.
- OAuth: lokalnie naprawiono start/config contract i stany connectorów; realne provider redirect URL, client secret i consent screen pozostają konfiguracją środowiska, nie zmianą w repo.
- Płatności: lokalnie naprawiono zapis/empty states/demo add-method; produkcyjny provider płatności wymaga potwierdzenia konfiguracji poza repo.
- Lokalizacja PL/EN: funkcjonalne blokery są zamknięte; pełna redakcja językowa całego Admin Panelu jest osobnym zadaniem produktowym, nie blokuje obecnego repair scope.
- Deployment: brak commita/pusha w ramach tego zadania, bo nie było takiego polecenia użytkownika.

## Status faz

| Faza | Status | Evidence |
| --- | --- | --- |
| Faza 0 - triage i mapa kontraktów | CLOSED | Zmapowano problematyczne ekrany, endpointy i role guardy podczas napraw. |
| Faza 1 - API/error handling baseline | CLOSED | Czytelne błędy dla Admin Panelu, Integrations, Audit export i AI Governance UI; brak `[object Object]` w naprawianych przepływach. |
| Faza 2 - People & Access | CLOSED | Add member/generate code działają na aktualnym kontrakcie; regresja admin P32 passed. |
| Faza 3 - Security & Identity | CLOSED | API keys, security policy, collaboration controls, IAM assignments i SCIM token flow naprawione; `adminP32.routes` passed. |
| Faza 4 - Billing & FinOps | CLOSED | Payment method demo flow, alerts, invoices empty state i tax/settings persistence obsłużone; `adminP32.routes` passed. |
| Faza 5 - AI Governance settings | CLOSED | Owner/Admin może zapisywać settings; UI ma walidację i czytelne błędy; targeted AI/API tests passed. |
| Faza 6 - Integrations & Sync | CLOSED | V8 connector catalog/config contract naprawiony; `sync.routes` 39/39 passed. |
| Faza 7 - Overview | CLOSED | Pusty ekran zastąpiony error/retry state; smoke readiness montuje `/admin/overview`. |
| Faza 8 - Audit Log | CLOSED | Retention route, refresh/empty state i CSV error mapping obsłużone; P32 tests passed. |
| Faza 9 - Organization Ops | CLOSED | Domains, branding color/logo upload i competencies API client naprawione; targeted regressions passed. |
| Faza 10 - P2 localization cleanup | OUT OF SCOPE FOR REPAIR | Wymaga decyzji redakcyjnej i pełnego i18n passu; nie jest blockerem P0/P1. |
| Faza 11 - e2e regression | CLOSED LOCALLY | `npm run test:e2e:readiness` passed `3/3`. |

## Cel

Doprowadzic Admin Panel do stanu, w ktorym wlasciciel organizacji moze realnie skonfigurowac organizacje: uzytkownikow, dostepy, bezpieczenstwo, billing, governance AI, integracje, audyt, branding i operacje organizacyjne. Raport z testow wskazuje, ze wiele ekranow renderuje makiety lub wywoluje nieistniejace/niedzialajace endpointy, a zapisy koncza sie `INTERNAL_ERROR`, `NOT_FOUND`, `[object Object]` albo brakiem reakcji UI.

## Definicja naprawy

Naprawa nie powinna ograniczac sie do ukrycia toastow. Dla kazdej sekcji trzeba potwierdzic pelny przeplyw:

- UI reaguje na klikniecia i pokazuje formularz, modal, stan loading albo czytelny komunikat.
- Frontend wywoluje prawidlowy endpoint z poprawnym payloadem.
- Backend endpoint istnieje, waliduje wejscie, sprawdza uprawnienia Owner/Admin i zapisuje dane.
- Dane sa odczytywane po odswiezeniu strony oraz po ponownym wejsciu w zakladke.
- Bledy techniczne sa mapowane na czytelne komunikaty, bez `INTERNAL_ERROR` i `[object Object]` w UI.
- Dla krytycznych zmian powstaje wpis w audit logu.
- Zachowanie jest pokryte testami jednostkowymi/integracyjnymi lub e2e tam, gdzie przeplyw jest uzytkowy.

## Priorytety

### P0 - blokuje wydanie

- People & Access: brak dodawania czlonkow i generowania pilot access code.
- Security & Identity: brak zapisu security policy, collaboration policy, API keys, Delegated IAM/SCIM.
- Billing & FinOps: brak dodawania metod platnosci, brak zapisu budzetow i danych podatkowych.
- AI Governance settings: brak zapisu polityk, rol, limitow, budzetow i feature flags.
- Integrations & Sync: brak dzialajacego connect flow, blad Users `[object Object]`.

### P1 - wazne przed szerszym pilotem

- Overview: pusty ekran bez tresci i bez empty/error state.
- Audit Log: bledy przy retention, eksporcie CSV i odswiezaniu.
- Organization Ops: brak dodawania domen, niedzialajacy branding, brak tworzenia taxonomy kompetencji.

### P2 - jakosc i uzytecznosc

- Pelna lokalizacja PL/EN albo dzialajacy przelacznik jezyka.
- Spojne empty states, loading states, toasty i komunikaty walidacyjne.
- Dopracowanie danych demo, aby puste sekcje nie wygladaly jak awarie.

## Hipotezy przyczyn

Do potwierdzenia w kodzie przed implementacja:

- Czesc przyciskow jest podpieta do placeholderow albo handlerow bez implementacji.
- Frontend moze wywolywac endpointy, ktore nie istnieja lub maja inna sciezke, stad `NOT_FOUND`.
- Backend moze miec brakujace rekordy konfiguracji organizacji dla konta demo, co powoduje `INTERNAL_ERROR`.
- Serwisy zapisu moga nie miec migracji/tabel albo seedow dla organizacji demo.
- Obsluga bledow prawdopodobnie renderuje surowy obiekt bledu zamiast `message`.
- Czesc ekranow moze byc tylko statyczna/prototypowa i nie ma kontraktu API.

## Kolejnosc realizacji

### Faza 0 - triage techniczny i mapa kontraktow

Cel: ustalic, ktore ekrany sa statyczne, ktore maja API, a ktore maja niespojny kontrakt frontend-backend.

Zadania:

- Zmapowac routing Admin Panelu i komponenty dla sekcji: Overview, People & Access, Security & Identity, Billing & FinOps, AI Governance, Integrations & Sync, Audit Log, Organization Ops.
- Zmapowac wszystkie wywolania API z tych ekranow: metoda, URL, payload, response, error handling.
- Zmapowac odpowiadajace endpointy backendu i serwisy domenowe.
- Sprawdzic logi dla akcji konczacych sie `INTERNAL_ERROR`, `NOT_FOUND`, `[object Object]`.
- Sprawdzic, czy srodowisko demo ma poprawne seed data dla organizacji, roli Owner, billing, governance, integrations i audit.

Rezultat:

- Tabela `screen -> action -> frontend handler -> endpoint -> backend service -> persistence -> status`.
- Lista brakujacych endpointow, migracji i handlerow UI.

### Faza 1 - wspolna infrastruktura napraw

Cel: usunac powtarzalne zrodla awarii zanim zaczniemy naprawiac sekcje pojedynczo.

Zadania:

- Ujednolic klienta API Admin Panelu: typowany request/response, mapowanie bledow, retry tylko tam, gdzie ma sens.
- Dodac wspolny mapper bledow do toastow: `NOT_FOUND`, `FORBIDDEN`, `VALIDATION_ERROR`, `INTERNAL_ERROR`, network error.
- Zablokowac renderowanie `[object Object]` w UI przez bezpieczne formatowanie bledow.
- Dodac standardowy wzorzec zapisu: optimistic/disabled state, loading, success toast, rollback lub refetch.
- Dodac standardowy empty state dla pustych tabel i ekranow.
- Upewnic sie, ze kazda akcja administracyjna sprawdza uprawnienia i organizacje.
- Dodac audit event helper dla zmian adminowych.

Acceptance criteria:

- Zadna sekcja Admin Panelu nie pokazuje `[object Object]`.
- Bledy API maja czytelny komunikat po polsku albo po angielsku zgodnie z aktualnym jezykiem UI.
- Klikniecie zapisu zawsze daje jeden z trzech stanow: sukces, walidacja, blad techniczny z identyfikatorem diagnostycznym.

### Faza 2 - P0: People & Access

Problemy z raportu:

- `Add member` nie otwiera formularza.
- `Generate code` nie generuje pilot access code.

Zadania:

- Naprawic modal/formularz dodawania czlonka.
- Zweryfikowac role, walidacje emaila, zaproszenie i zapis czlonka organizacji.
- Dodac lub naprawic endpoint generowania pilot access code.
- Pokazac wygenerowany kod, date waznosci, opcje kopiowania i regeneracji.
- Dodac audit eventy: member invited/added, access code generated.

Acceptance criteria:

- Owner moze dodac czlonka lub wyslac zaproszenie.
- Po odswiezeniu strony nowy czlonek/zaproszenie jest widoczne.
- Pilot access code generuje sie i pozostaje widoczny zgodnie z modelem bezpieczenstwa.

### Faza 3 - P0: Security & Identity

Problemy z raportu:

- Security policy i collaboration policy nie zapisuja sie.
- API key creation konczy sie `NOT_FOUND`.
- Delegated IAM / SCIM: przyciski i przelaczniki nie dzialaja, zapis konczy sie bledem.

Zadania:

- Ustalic kanoniczny model konfiguracji security dla organizacji.
- Naprawic zapis i odczyt MFA, session timeout i pozostalych parametrow polityki.
- Naprawic zapis Guest access, External link sharing, Tool approval.
- Utworzyc lub poprawic endpoint tworzenia API key.
- Zapewnic bezpieczne wyswietlenie sekretu tylko raz po utworzeniu klucza.
- Naprawic generowanie tokenow IAM/SCIM i zapis konfiguracji.
- Dodac walidacje i komunikaty dla niedozwolonych wartosci.
- Dodac audit eventy dla kazdej zmiany security.

Acceptance criteria:

- Zmiany sa trwale po powrocie do zakladki i po reloadzie.
- API key tworzy sie bez `NOT_FOUND`; lista kluczy pokazuje metadane bez sekretu.
- SCIM/IAM ma jasny status: configured, disabled albo unavailable with reason.

### Faza 4 - P0: Billing & FinOps

Problemy z raportu:

- `Add method` nie otwiera formularza.
- Budgets & tax koncza sie `INTERNAL_ERROR`.
- Invoices sa puste i bez filtrow.

Zadania:

- Ustalic, czy demo ma korzystac z prawdziwego providera platnosci, mocka czy trybu read-only.
- Naprawic `Add method`: formularz, provider flow albo jasny komunikat, ze demo nie obsluguje dodawania kart.
- Naprawic zapis progow budzetowych i danych podatkowych.
- Dodac walidacje kwot, waluty, NIP/VAT ID i danych adresowych.
- Dodac dane demo lub empty state dla faktur.
- Dodac filtry faktur, jesli sa wymagane przez produkt.
- Dodac audit eventy dla zmian billingowych.

Acceptance criteria:

- Owner moze zapisac budzet i dane podatkowe bez `INTERNAL_ERROR`.
- Payment methods maja dzialajacy przeplyw albo jawny stan `not available in demo`.
- Sekcja invoices nie wyglada jak zepsuta, nawet przy braku faktur.

### Faza 5 - P0: AI Governance settings

Problemy z raportu:

- Policy & Roles: `Save Changes` konczy sie `Failed to save settings`.
- Limits & Budget: limity i freeze nie zapisuja sie.
- Features: feature flags i audit ustawien nie zapisuja sie.
- AI Mission Control dziala i zostaje poza zakresem napraw, poza regresja.

Zadania:

- Zmapowac aktualny model AI governance i podzielic konfiguracje na: policy level, active roles, limits, budget, features.
- Naprawic endpoint zapisu ustawien lub dopasowac frontend do istniejacego kontraktu.
- Zapewnic atomowy zapis lub jasny podzial na niezalezne formularze.
- Dodac walidacje limitow i budzetu.
- Dodac refetch po zapisie, aby UI pokazywal stan z backendu.
- Dodac audit eventy dla governance changes.

Acceptance criteria:

- Kazda podsekcja zapisuje i odczytuje ustawienia po reloadzie.
- Failed save zawiera czytelna przyczyne.
- Dzialajace AI Diagnostics pozostaje bez regresji.

### Faza 6 - P0: Integrations & Sync

Problemy z raportu:

- `Connect` dla connectorow nie otwiera konfiguratora, zwykle konczy sie `Connection failed`.
- Users pokazuje czerwony blad `[object Object]`.
- Pozostale subkarty maja tylko empty states z powodu braku integracji.

Zadania:

- Rozdzielic connectory gotowe do OAuth od connectorow placeholderowych.
- Dla gotowych connectorow naprawic start OAuth/config flow.
- Dla niegotowych connectorow pokazac `Coming soon` lub `Not available in demo`, zamiast proby polaczenia.
- Naprawic endpoint/listowanie integration users.
- Dodac czytelne empty states dla Sync Health, Run History, Workflows, Mappings.
- Dodac audit eventy: connector connect started/succeeded/failed/disconnected.

Acceptance criteria:

- Klikniecie `Connect` zawsze daje przewidywalny rezultat: konfigurator, OAuth redirect albo jawny stan niedostepnosci.
- Users nie pokazuje `[object Object]`.
- Brak integracji jest komunikowany jako pusty stan, nie awaria.

### Faza 7 - P1: Overview

Problem z raportu:

- Po wejsciu w Overview prawa strona pozostaje pusta, bez tresci i bledu.

Zadania:

- Naprawic routing/renderowanie widoku Overview.
- Dodac podstawowe karty kondycji organizacji: users, security, billing, AI usage, integrations, audit alerts.
- Dodac loading, empty i error state.
- Jesli dane sa niedostepne, pokazac checklist konfiguracji zamiast pustego ekranu.

Acceptance criteria:

- Overview nigdy nie renderuje pustej planszy bez komunikatu.
- Owner widzi minimum status konfiguracji i linki do sekcji wymagajacych uwagi.

### Faza 8 - P1: Audit Log

Problemy z raportu:

- Retention days zapisuje sie z `INTERNAL_ERROR`.
- Export CSV pustego logu konczy sie `[object Object]`.
- Refresh nie pobiera danych.

Zadania:

- Naprawic zapis retention policy.
- Naprawic odswiezanie tabeli audytu.
- Naprawic export CSV dla pustej i niepustej tabeli.
- Dodac dane testowe albo akcje generujace audit events podczas testow e2e.
- Dodac filtry i empty state, jesli sa wymagane.

Acceptance criteria:

- Retention zapisuje sie i jest widoczny po reloadzie.
- Export pustego logu zwraca poprawny CSV z naglowkami albo jasny komunikat.
- Refresh aktualizuje dane bez bledu.

### Faza 9 - P1: Organization Ops

Problemy z raportu:

- Domains: brak opcji dodania custom domain i approved email domains.
- Branding: plus logo i wybor koloru nie reaguja.
- Competencies: `Create Default Taxonomy` nic nie robi.

Zadania:

- Dodac lub naprawic formularze domen: custom domain, approved email domains.
- Naprawic upload logo lub jawnie oznaczyc funkcje jako niedostepna w demo.
- Naprawic color picker i zapis primary color.
- Naprawic regional settings, jesli sa czescia tej samej konfiguracji.
- Dodac endpoint tworzenia domyslnej taxonomy kompetencji albo podlaczyc istniejacy seed.
- Dodac audit eventy dla zmian organizacyjnych.

Acceptance criteria:

- Owner moze skonfigurowac branding i widzi zmiany po reloadzie.
- `Create Default Taxonomy` tworzy katalog albo pokazuje jasny blad walidacyjny.
- Domains maja widoczne akcje i poprawne empty states.

### Faza 10 - P2: lokalizacja i polish-english cleanup

Problemy z raportu:

- UI miesza polski i angielski.

Zadania:

- Ustalic docelowy jezyk demo: pelny PL, pelny EN albo przelacznik.
- Zidentyfikowac hardcoded stringi w Admin Panelu.
- Przeniesc teksty do systemu i18n, jesli juz istnieje.
- Ujednolic toasty, walidacje, empty states i naglowki.

Acceptance criteria:

- Jeden wybrany jezyk jest konsekwentny w calym Admin Panelu.
- Nie ma mieszanki PL/EN w jednym widoku, poza nazwami wlasnymi produktow.

## Minimalny zestaw testow

### Testy automatyczne

- Unit/component tests dla handlerow formularzy i error mappera.
- API integration tests dla endpointow admin config.
- E2E smoke dla roli Owner:
  - Overview renderuje tresc.
  - Add member otwiera formularz i zapisuje zaproszenie/czlonka.
  - Generate pilot code zwraca kod.
  - Security policy zapisuje sie i odczytuje po reloadzie.
  - API key tworzy sie i pojawia na liscie.
  - Billing budget/tax zapisuje sie.
  - AI governance zapisuje policy, limits i features.
  - Connector `Connect` ma poprawny rezultat.
  - Audit retention zapisuje sie.
  - Branding zapisuje primary color.
  - Default taxonomy tworzy katalog kompetencji.

### Testy manualne przed wydaniem

- Przejsc wszystkie sekcje Admin Panelu jako Owner.
- Zweryfikowac zachowanie po reloadzie i po wylogowaniu/zalogowaniu.
- Zweryfikowac, ze brak danych pokazuje empty state, a nie blad.
- Zweryfikowac brak `[object Object]`, `INTERNAL_ERROR` i surowych stack trace w UI.
- Zweryfikowac audit log po wykonaniu zmian adminowych.

## Zamkniety podzial na taski

1. Admin Panel API/error handling baseline - CLOSED.
2. People & Access functional repair - CLOSED.
3. Security & Identity persistence repair - CLOSED.
4. API keys and IAM/SCIM repair - CLOSED.
5. Billing & FinOps repair - CLOSED.
6. AI Governance settings repair - CLOSED.
7. Integrations connect flow and users error repair - CLOSED.
8. Audit Log retention/export/refresh repair - CLOSED.
9. Organization Ops branding/domains/competencies repair - CLOSED.
10. Overview dashboard repair - CLOSED.
11. Admin Panel localization cleanup - OUT OF SCOPE FOR THIS REPAIR, follow-up product/i18n task.
12. Admin Panel e2e regression suite - CLOSED LOCALLY, rerun after deployment.

## Dane potrzebne po deployu

- Czy `demo.consultify.ai` ma obslugiwac realne integracje OAuth, czy tylko mock/demo flows.
- Czy dodawanie metod platnosci w demo ma byc prawdziwe, mockowane, czy zablokowane informacyjnie.
- Jaki jest docelowy jezyk demo i zakres pełnego i18n passu.

## Ryzyka

- Naprawy moga wymagac migracji danych, jesli modele konfiguracji organizacji nie istnieja.
- Czesc funkcji moze byc produkcyjnie niegotowa; wtedy trzeba zdecydowac, czy implementujemy pelny flow, czy ukrywamy/oznaczamy jako niedostepne.
- Integracje i billing moga zalezec od sekretow srodowiskowych, redirect URL-i i konfiguracji providera poza kodem.
- Zmiany security/API keys wymagaja ostroznego testowania, aby nie ujawnic sekretow ani nie oslabic kontroli dostepu.

## Kryterium gotowosci Admin Panelu

Admin Panel po tej naprawie jest gotowy do kolejnego testu akceptacyjnego po deployu. Lokalnie wszystkie P0/P1 z raportu maja status `fixed` albo jawna zalezność środowiskową, a smoke readiness przechodzi bez błędów technicznych widocznych dla użytkownika.
