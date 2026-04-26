# admin_dev_fin - program napraw Admin / SuperAdmin / Settings w Consultify

> Status: dokument wykonawczy dla programu napraw admin/superadmin/settings.
> Data wydzielenia: 2026-04-26.
> Zrodlo: sekcje `11-19` z `docs/AI_dev_fin.md`.
> Cel: zebrac w jednym miejscu raporty problemow, wymagania i plan naprawczy przed uruchomieniem prac implementacyjnych.

## 0. Executive summary

Ten dokument jest oddzielnym planem rozwoju i naprawy warstwy administracyjnej Consultify.

Powod wydzielenia:

- `AI_dev_fin.md` ma sluzyc do domykania AI / AI OS i testow AI;
- audyty Admin / SuperAdmin / Settings byly dopisywane do tego samego pliku, co zaczelo mieszac dwa rozne programy pracy;
- naprawa admina wymaga osobnej kolejnosci, innych testow i osobnych agentow wdrozeniowych.

Glowna zasada programu:

```text
visible = working or honest
```

Kazda widoczna akcja administracyjna musi:

- realnie dzialac i zapisywac dane po stronie backendu;
- albo byc read-only;
- albo byc disabled z jasnym powodem;
- albo byc ukryta, jesli wprowadza usera/admina w blad.

Nie akceptujemy:

- falszywych toastow sukcesu;
- `[object Object]`, `INTERNAL_ERROR`, `NaN`, `Invalid Date` w UI;
- przyciskow `Save`, `Connect`, `Create`, `Generate`, ktore nie maja realnego backendu albo uczciwego unavailable state;
- mutacji bez walidacji, refetchu, refresh proof i audytu tam, gdzie dotyczy admin/superadmin.

## 1. Zakres dokumentu

Ten dokument obejmuje:

- Super Admin Console;
- Tenant Admin P32;
- Settings persistence;
- Identity, users, organizations, access requests i access codes;
- Billing, commercial, usage, limits i operational costs;
- Security, MFA, SSO, SCIM, audit, incidents, DLP i approvals;
- Connector Ops, integrations, API keys, webhooks, backup/restore/DR;
- Governance, compliance, DSAR, legal policies i retention;
- AI Operations tylko jako **panel administracyjny**, nie jako core AI runtime.

Granica z `AI_dev_fin.md`:

- `AI_dev_fin.md` opisuje AI product/runtime: chat, trust, research, artifacts, agents, memory, outcome runtime.
- `admin_dev_fin.md` opisuje panele i operacje administracyjne, nawet jesli dotycza AI Operations.

## 2. Mapa raportow w tym dokumencie

Zachowujemy oryginalna numeracje sekcji z dokumentu zrodlowego, zeby latwo porownywac kontekst rozmow i audytow:

| Sekcja | Temat | Rola w programie |
|---|---|---|
| `11` | AI Operations - Super Admin Console | Audyt panelu administracyjnego AI Platform |
| `12` | Connector Ops oraz Governance & Compliance | Audyt integracji, governance i compliance |
| `13` | Platform Security - Agent | Audyt security i roli agent/user |
| `14` | Identity / Access / Settings / Security | Przekrojowy audyt rol i ustawien |
| `15` | Cross-App Admin Surface Gaps | Luki przekrojowe w kontraktach i UX |
| `16` | Billing / Commercial / Operations | Audyt finansow, usage, limits i commercial ops |
| `17` | Tenant Admin P32 i Settings Persistence | Audyt admina organizacji i settings |
| `18` | Program napraw Admin / SuperAdmin / Settings | Glowny plan wykonawczy |
| `19` | Launch readiness - 4 agenci | Instrukcja uruchomienia rownoleglych workstreamow |

## 3. Priorytety startowe

Pierwsza paczka prac nie powinna probowac naprawic calego systemu naraz. Startujemy od stabilizacji i prawdy w UI.

Kolejnosc startowa:

1. **Backbone / honest UI** - error mapper, safe formatters, `UnavailableState`, `ReadOnlyState`, `DegradedState`, brak `[object Object]`, `NaN`, `Invalid Date`.
2. **Identity / users / organizations / access** - create/invite/edit user, role/status, org update, access requests/codes, tenant isolation.
3. **Tenant Admin P32 + Settings** - `/admin/*`, settings persistence, scope user/org/global, refresh proof.
4. **Billing / FinOps** - invoices, plans, tax rates, usage, budgets, operational costs, zero/no data/error states.
5. **Security / Audit / SCIM** - password policy, MFA/SSO/SCIM, IP whitelist, sessions, audit trail, security events.
6. **Connector Ops / API keys / Backup** - connect/configure, webhooks, API keys, backup/restore/DR jako realne joby albo unavailable.
7. **Governance / Compliance** - DSAR, audits, processing records, legal publish, approvals i lifecycle status.
8. **UX / i18n / polish** - jezyk, empty states, source/timestamp, confirm modals, test smoke per modul.

## 4. Definition of Done programu

Program mozna uznac za domkniety dopiero gdy:

- kazdy widoczny przycisk admin/superadmin/settings ma realny efekt albo jasny status unavailable/read-only;
- wszystkie P0 przeplywy dzialaja i przetrwaja refresh;
- users/orgs/access/settings/billing/security maja audit trail;
- admin nie moze naruszyc izolacji tenantowej;
- dashboardy rozrozniaja `no data`, `zero`, `error`, `degraded`;
- UI nie pokazuje `[object Object]`, `Invalid Date`, `NaN`;
- testy e2e pokrywaja login, user/org CRUD, settings persistence, billing create, security policy, audit;
- dokumentacja i nawigacja nie obiecuja funkcji, ktore nie istnieja.

## 5. Oryginalne raporty i plan naprawczy

Ponizej sa przeniesione raporty i plan naprawczy z `AI_dev_fin.md`. Zachowana numeracja `11-19` jest celowa.

## 11. Audyt modulu AI Operations - Super Admin Console
> Status: audyt manualny modulu AI Operations / AI Platform.
> Data dopisania: 2026-04-25.
> Cel: utrwalic kontekst przed planem naprawczym, bo modul jest duzy i ryzyko utraty kontekstu w pracy agentowej jest wysokie.
> Zakres: Configuration, Development, Operations, Analytics, Policy Plane.

### 11A. Executive summary

Modul AI Operations wyglada wizualnie dojrzale, ale funkcjonalnie jest nierowny. Czesc paneli dziala jako realny interfejs administracyjny, czesc jest tylko warstwa pokazowa, a czesc jest podpieta do backendu tylko czesciowo.

Najwazniejszy wniosek: modul nie jest jeszcze gotowy jako produkcyjna konsola zarzadzania AI, poniewaz wiele funkcji tworzenia, zapisu, konfiguracji i przypisywania modeli nie dziala albo nie zapisuje zmian trwale.

Najlepiej dzialaja:

- testy providerow;
- edycja istniejacego providera;
- przypisywanie modeli do tierow w zakladce Model Tiers;
- eksporty CSV / PDF w niektorych sekcjach;
- Mission Control diagnostics;
- czesc paneli read-only.

Najgorzej dzialaja:

- tworzenie nowego providera;
- klonowanie providera;
- tworzenie routing rules;
- Purposes & Assignments;
- Org AI Policy;
- Prompt Builder;
- Prompt Assistant;
- Experiments;
- Model Registry;
- Health Monitoring.

### 11B. Ocena ogolna

| Obszar | Status |
|---|---|
| LLM Providers | Czesciowo dziala |
| Model Tiers | Dziala |
| Routing Rules | Nie dziala |
| Purposes & Assignments | Nie dziala |
| Org AI Policy | Nie dziala |
| AI Governance | Czesciowo dziala |
| Development / Prompt Builder | W wiekszosci nie dziala |
| Operations | Czesciowo dziala |
| Analytics | Czesciowo dziala |
| Policy Plane | Read-only / czesciowo |
| Security / Knowledge | Nie w pelni sprawdzone |

### 11C. Glowne problemy krytyczne

#### Funkcje wygladaja jak produkcyjne, ale nie zapisuja danych

W kilku miejscach UI pozwala kliknac `Save`, `Create`, `Add`, `Apply`, ale po akcji nie ma trwalego efektu. To jest najpowazniejszy problem, bo administrator moze miec falszywe poczucie, ze skonfigurowal system.

Dotyczy to szczegolnie:

- Add Provider;
- Clone Provider;
- Add Routing Rule;
- Purposes & Assignments;
- Org AI Policy;
- AI Governance switches;
- Create New Report;
- Pricing Registry snapshot.

#### Brakuje jasnej informacji, ktore sekcje sa read-only

Czesc ekranow jest tylko informacyjna, ale wyglada jak konfiguracja. Jesli dana sekcja jest tylko podgladem, powinna miec wyrazna etykiete:

```text
Read-only diagnostic view
```

albo:

```text
Configuration is managed by backend / policy engine
```

#### Brak spojnych toastow i feedbacku po akcjach

Niektore akcje pokazuja toast, inne nie. Przyklady:

- edycja providera dziala, ale nie ma komunikatu sukcesu;
- dodanie providera nie dziala i nie pokazuje bledu;
- eksport pokazuje toast;
- zapis polityki czesto nie daje realnego efektu.

#### Mieszanie jezyka polskiego i angielskiego

W module pojawiaja sie komunikaty angielskie i polskie, np. statusy typu `Nieznany` obok angielskich etykiet. W konsoli Super Admin powinien byc jeden spojny jezyk albo pelne i18n.

### 11D. Szczegolowy audyt funkcjonalny

#### Configuration: LLM Providers

Status: `PASS with limitations`.

Co dziala:

- lista providerow wyswietla aktywne modele, m.in. OpenRouter i DeepSeek;
- widoczne sa kolumny `Name`, `Provider`, `Model ID`, `Kind`, `Tier`, `Visibility`, `Status`, `Config`, `Actions`;
- test pojedynczego providera dziala i aktualizuje status, np. `OK - 341ms`;
- `Test All` dziala i aktualizuje statusy providerow;
- edycja istniejacego providera dziala czesciowo, np. zmiana nazwy OpenRouter na OpenRouterEdit zostala zapisana i widoczna w tabeli.

Co nie dziala:

- `Add Provider` otwiera formularz, ale zapis nie tworzy nowego providera;
- `Clone Provider` otwiera modal, ale zapis nie tworzy realnego wpisu;
- `Delete Provider` uzywa natywnego `confirm()`, niespojnego z reszta UI.

Backlog:

- podlaczyc `Add Provider` do realnego endpointu backendowego;
- podlaczyc `Clone Provider` do realnego endpointu backendowego;
- dodac toast po `create`, `update`, `clone`, `delete`, `test`;
- zastapic natywne `confirm()` modalem aplikacji;
- dodac walidacje pol z jasnymi komunikatami;
- po zapisie automatycznie odswiezac tabele providerow.

#### Configuration: Model Tiers

Status: `PASS`.

Co dziala:

- mozna przypisac model do tierow `Budget`, `Standard`, `Premium`, `Reasoning`;
- licznik zmienia sie z `0 models` na `1 models`;
- model pojawia sie w tierze;
- model mozna usunac ikona kosza;
- przypisanie utrzymuje sie po przejsciu do innej zakladki i powrocie.

Backlog:

- dodac toast po dodaniu i usunieciu modelu z tieru;
- potwierdzic i ewentualnie naprawic drag-and-drop priorytetow;
- dodac zapis kolejnosci modeli w tierze;
- pokazac, czy przypisanie jest globalne czy per organization.

#### Configuration: Routing

Status: `PASS with limitations`.

Widok pokazuje informacyjne mapowanie tierow: `Budget Tier`, `Standard Tier`, `Premium Tier`, `Reasoning Tier`.

Problemy:

- brak realnej edycji;
- nie wiadomo, czy to podglad czy konfigurator.

Backlog:

- oznaczyc sekcje jako read-only, jesli ma byc tylko podgladem;
- jesli ma byc edytowalna, dodac realne selecty i zapis;
- pokazac aktywny model per tier;
- pokazac fallback chain.

#### Configuration: Routing Rules

Status: `FAIL`.

Problemy:

- selecty wyboru modelu nie otwieraja sie albo sa puste;
- `Add Rule` otwiera modal;
- mozna wpisac nazwe i opis reguly;
- po `Save` regula nie pojawia sie na liscie;
- brak bledu i brak sukcesu.

Backlog:

- podlaczyc tworzenie reguly do backendu;
- dodac liste istniejacych regul;
- dodac edycje i usuwanie regul;
- naprawic selecty wyboru modeli;
- dodac walidacje: `name`, `type`, `priority`, `applies to tiers`, `applies to purposes`;
- po zapisie odswiezac liste regul;
- dodac symulator: dla danego purpose i tieru system wybierze model X.

#### Configuration: Purposes & Assignments

Status: `FAIL`.

Problemy:

- lista purpose jest pusta;
- lista providerow nie dziala;
- `Add` jest bezuzyteczny bez wyboru celu;
- wpisywanie reczne nie daje efektu;
- starter presets nie tworza konfiguracji.

Backlog:

- zaladowac purpose families z backendu;
- podlaczyc provider select do aktywnych modeli;
- dodac zapis assignmentow;
- dodac widok aktywnych assignmentow;
- dodac usuwanie assignmentow;
- naprawic starter presets: TEXT chain, IMAGE chain;
- dodac walidacje organization override;
- pokazac priorytet przypisania.

#### Configuration: Org AI Policy

Status: `FAIL`.

Widok pokazuje:

- `Organization`;
- `Organization ID override`;
- `Save mode`;
- `Change summary`;
- `Guided Policy Builder`;
- `Advanced JSON`;
- `Policy History`.

Problemy:

- pola wygladaja jak edytowalne, ale realnie nie da sie ich zmienic w uzyteczny sposob;
- Advanced JSON pokazuje `{}` i nie jest praktycznym edytorem;
- brak skutecznego zapisu i jasnego workflow publikacji;
- UI komunikuje `save draft -> send to review -> approve -> publish live`, ale proces nie jest domkniety w interfejsie.

Backlog:

- naprawic edycje pol Guided Policy Builder;
- podlaczyc `Save draft` do backendu;
- podlaczyc `Load` do aktywnej polityki organizacji;
- dodac historie wersji polityki;
- dodac statusy `draft`, `in review`, `approved`, `published`, `rolled back`;
- dodac walidacje JSON;
- dodac diff miedzy draft i published;
- dodac `Publish live`;
- dodac rollback.

#### Configuration: AI Governance

Status: `FAIL / PASS with limitations`.

Co dziala czesciowo:

- widoczne sa `Context Policy`, `Internet & Audit Policy`, `Sanity Check`;
- checkboxy da sie klikac;
- sanity check pokazuje tabele i uslugi: `db:ai_system_prompts`, `db:ai_usage_logs`, `db:knowledge_documents`, `env:TAVILY_API_KEY`, `service:promptAssembler`.

Problemy:

- zmiany checkboxow nie zapisuja sie trwale;
- po przejsciu na inna zakladke ustawienia wracaja albo nie ma dowodu zapisu;
- `Save` nie daje wystarczajacego feedbacku;
- nie ma pewnosci, ze backend zapisuje konfiguracje.

Backlog:

- zapewnic trwaly zapis checkboxow;
- dodac toast po zapisie;
- pokazac `last saved at`;
- pokazac, czy konfiguracja jest globalna czy organizacyjna;
- dodac audit log zmian governance;
- naprawic spojnosc jezykowa;
- dodac blokade wyjscia przy niezapisanych zmianach.

#### Development: Prompts Library

Status: `FAIL`.

Biblioteka promptow jest pusta i nie ma funkcjonalnych przyciskow tworzenia. Wyglada jak placeholder.

Backlog:

- dodac liste promptow z backendu;
- dodac create / edit / delete prompt;
- dodac filtrowanie i wyszukiwanie;
- dodac status publikacji promptu;
- dodac wersjonowanie promptow.

#### Development: Prompt Builder - Overview

Status: `PASS with limitations`.

Overview pokazuje statystyki `Prompt Templates: 0`, `Active Blocks: 0`, `Languages: 6`, `Feedback Items: 0`, `Avg Rating: 0.0` oraz karty mozliwosci. To glownie dashboard informacyjny.

#### Development: Prompt Templates

Status: `FAIL`.

Pusta lista. `New Template` nie otwiera formularza albo nie prowadzi do realnego dzialania.

Backlog:

- podlaczyc `New Template`;
- dodac modal lub strone tworzenia szablonu;
- dodac zapis, edycje, usuwanie i publikacje;
- dodac preview promptu.

#### Development: Block Builder

Status: `FAIL`.

`Block Library` i `Selected Blocks` sa puste. Nie mozna dodac bloku ani wybrac istniejacego.

Backlog:

- dodac biblioteke blokow;
- dodac tworzenie bloku;
- dodac wybor blokow do promptu;
- dodac preview skladanego promptu;
- dodac drag-and-drop kolejnosci blokow.

#### Development: Test Bench

Status: `FAIL`.

Zakladka wymaga wyboru szablonu. Poniewaz nie ma zadnego szablonu, testow nie da sie realnie uruchomic.

Backlog:

- umozliwic test bez szablonu testowego;
- dodac domyslny sample template;
- dodac wyniki testow per jezyk;
- dodac porownanie jakosci odpowiedzi;
- dodac log bledow.

#### Development: Prompt Assistant

Status: `FAIL`.

Po wpisaniu `Hello` asystent odpowiada:

```text
Sorry, I encountered an error. Please try again.
```

Backlog:

- sprawdzic endpoint czatu Prompt Assistant;
- sprawdzic konfiguracje providerow LLM;
- dodac szczegolowy komunikat bledu dla admina;
- logowac bledy w backendzie;
- dodac fallback model;
- zablokowac asystenta, jesli nie ma aktywnego modelu.

#### Development: Learning System

Status: `PASS with limitations`.

Pokazuje Learning Analytics: `Total interactions: 0`, `Success rate: 0%`, `Avg quality: 0%`, `Avg response: 0s`, `Patterns: 0`, `Active models: 0`. Eksport i refresh dzialaja wizualnie.

Problem: brak realnych danych i brak jasnego zrodla danych.

Backlog:

- podlaczyc realne learning analytics;
- dodac wykresy jakosci;
- dodac zrodla danych;
- dodac tabele interakcji;
- dodac filtrowanie po modelu, jezyku, purpose i organizacji.

#### Development: Experiments

Status: `FAIL`.

Zakladka nie pokazuje realnej zawartosci. Brak listy eksperymentow i przyciskow tworzenia.

Backlog:

- dodac liste eksperymentow;
- dodac tworzenie eksperymentu;
- dodac A/B testing promptow;
- dodac metryki eksperymentu;
- dodac statusy `draft`, `running`, `completed`, `archived`.

#### Development: Model Registry

Status: `FAIL`.

Zakladka jest pusta albo nie zawiera funkcji rejestru modeli.

Backlog:

- dodac liste modeli;
- dodac szczegoly modelu;
- dodac status aktywnosci;
- dodac powiazanie modelu z providerem;
- dodac wersjonowanie modeli.

#### Operations: Mission Control

Status: `PASS`.

Co dziala:

- pokazuje `Success Rate`, `Avg Latency`, `Active Providers`;
- diagnostyki `AI Connection`, `AI Eyes`, `AI Memory`, `AI Hands`, `MAX Mode` dzialaja;
- po uruchomieniu testow pojawia sie status sukcesu i czas wykonania.

Backlog:

- dodac szczegolowy log testu;
- dodac historie ostatnich testow;
- dodac status per organizacja;
- pokazac, ktory provider obsluzyl test;
- dodac alert przy nieudanym tescie.

#### Operations: Health Monitoring

Status: `FAIL`.

Problemy:

- wiekszosc providerow ma status `Nieznany`;
- `Odswiez` nie zmienia statusow;
- miesza sie PL/EN;
- statusy nie odzwierciedlaja realnych testow;
- czesc aktywnych providerow widnieje jako unknown.

Backlog:

- podlaczyc realne health checks;
- zsynchronizowac status z LLM Providers;
- usunac mieszanie jezykow;
- dodac timestamp ostatniego testu;
- dodac szczegoly bledu po rozwinieciu providera;
- dodac retry per provider.

#### Operations: Performance

Status: `PASS with limitations`.

Pokazuje `Avg response`, `Success rate`, `Cache hit rate`, `Total requests`, `Avg tokens`, `Total cost`. `Export` i `Refresh` dzialaja wizualnie.

Problem: wiekszosc danych to 0 i nie wiadomo, czy to prawdziwy brak danych, czy blad backendu.

Backlog:

- dodac stan `No data yet` zamiast pustych wykresow;
- podlaczyc realne metryki;
- dodac filtr per provider/model;
- dodac historie requestow;
- dodac alerty opoznien;
- dodac raport bledow.

#### Operations: SLA Management

Status: `PASS with limitations`.

Pokazuje SLA dashboard i eksport. Problemy:

- `100.000% uptime`;
- `NaN%` dla Success Rate;
- `Invalid Date`;
- brak realnych danych historycznych.

Backlog:

- naprawic `NaN%`;
- naprawic `Invalid Date`;
- dodac poprawne formatowanie uptime;
- dodac realne SLA events;
- dodac historie naruszen SLA;
- pokazac, czy SLA dotyczy globalnie czy organizacji.

#### Operations: AI Core Runtime

Status: `PASS with limitations`.

Read-only pokazuje `Healthy: Yes`, kontrakt, `Tools: 0`, `Layers: 4`, status warstw `context`, `retrieval`, `execution`, `trust`. Snapshot ID + `Load trust` pokazuje Audit Trail i Provenance Ledger.

Problemy:

- widok jest tylko read-only;
- liczba narzedzi wynosi 0;
- controlled tool catalog jest pusty.

Backlog:

- dodac realny katalog narzedzi;
- dodac szczegoly tool policy;
- dodac przykladowe trust snapshots;
- dodac jasny komunikat, gdy snapshot ID nie istnieje;
- dodac timestamp ostatniego odczytu.

#### Operations: Prompt OS Runtime

Status: `PASS with limitations`.

Pokazuje `Contract: prompt-os-runtime-v8`, `Presets: 0`, `Bundles: 0`, `Active bundles: 0`, supported purpose families.

Problem: tylko read-only summary, brak danych, akcji i diagnostyki.

Backlog:

- podlaczyc realne presets;
- podlaczyc bundles;
- dodac aktywne runtime bundles;
- dodac diagnostyke Prompt OS;
- dodac status per purpose family.

#### Analytics: LLM Observatory

Status: `PASS with limitations`.

Pokazuje `Requests`, `Avg latency`, `Tokens`, `Cost`, `Incidents`, `Scope`; filtry provider i zakresy `24h`, `7d`, `30d`, `90d`; `Refresh` dziala.

Problemy:

- dane zerowe;
- filtr providerow pokazuje tylko `All providers`, mimo ze providerzy istnieja w konfiguracji.

Backlog:

- podlaczyc realnych providerow do filtra;
- podlaczyc dane historyczne;
- dodac stan `No data`;
- dodac wykres requestow;
- dodac incident feed z realnymi eventami.

#### Analytics: Usage Analytics

Status: `PASS with limitations`.

Pokazuje metryki, eksport CSV dziala, PDF pokazuje komunikat generowania, refresh dziala.

Problemy:

- dane zerowe;
- wykresy puste;
- nie wiadomo, gdzie pobrac wygenerowany PDF.

Backlog:

- podlaczyc realne dane usage;
- dodac dane per provider, model i user;
- dodac eksport faktycznego pliku;
- dodac informacje, gdzie pobrac wygenerowany PDF.

#### Analytics: Cost Analytics

Status: `PASS with limitations`.

Pokazuje `Total Cost`, `Tokens Used`, `Avg Cost/Request`, `Estimated Monthly`, `Cost Breakdown by Provider`; OpenRouter ma `$0.00`.

Backlog:

- podlaczyc realne koszty;
- dodac koszt per model;
- dodac koszt per user/organization;
- dodac walute i zakres czasu;
- dodac alerty przekroczenia budzetu.

#### Analytics: Pricing Registry

Status: `FAIL`.

Widok ma filtry, liste snapshotow i formularz tworzenia snapshotu. Po `Create` pojawia sie `INTERNAL_ERROR`.

Backlog:

- naprawic endpoint tworzenia snapshotu cenowego;
- pokazac pelny komunikat bledu;
- dodac walidacje JSON ceny;
- po utworzeniu snapshotu odswiezac liste;
- dodac edycje i dezaktywacje snapshotow;
- dodac zrodlo ceny i date obowiazywania.

#### Analytics: Performance Metrics

Status: `PASS with limitations`.

Pokazuje `Provider Performance`, `Performance Alerts`, filtry czasu i `Export`. Eksport pokazuje toast, dane sa puste.

Backlog:

- podlaczyc realne dane provider performance;
- dodac alerts feed;
- dodac historie latency;
- dodac success rate i error rate per provider.

#### Analytics: Custom Reports

Status: `FAIL`.

Widok pokazuje `Reports (0)`, `Select a Report`, `New Report`. Modal pozwala wpisac opis i wybrac typ raportu, ale `Create Report` pozostaje nieaktywny albo raport nie tworzy sie skutecznie.

Backlog:

- naprawic walidacje formularza;
- podlaczyc tworzenie raportu do backendu;
- dodac liste zapisanych raportow;
- dodac harmonogram raportow;
- dodac eksport raportu;
- dodac edycje i usuwanie raportu.

#### Policy Plane: Enforcement State

Status: `PASS with limitations`.

Co dziala:

- pokazuje `Enforcement State: degraded`, `Drift Detection: 1`, `Provider Readiness: 11`, `Connector Coverage: 0`;
- tabela porownuje `Desired`, `Applied`, `Drift`, `Note`;
- wykrywa realny drift: DeepSeek ma desired `enabled`, applied `unknown`, drift detected.

Problem: widok jest read-only, nie ma akcji rozwiazania driftu ani linku do miejsca naprawy.

Backlog:

- dodac `Resolve drift`;
- dodac link do konkretnego providera;
- dodac severity driftu;
- dodac date wykrycia driftu;
- dodac historie driftow;
- blokowac rollout high-risk, jesli drift jest aktywny.

### 11E. Najwazniejsze bledy do naprawy

#### P0 - krytyczne

- `Add Provider` nie tworzy providera.
- `Clone Provider` nie tworzy providera.
- `Routing Rules` nie zapisuja sie.
- `Purposes & Assignments` nie dzialaja.
- `Prompt Assistant` zwraca blad.
- `Pricing Registry Create Snapshot` zwraca `INTERNAL_ERROR`.
- `Custom Reports` nie tworzy raportow.
- `AI Governance` wyglada jak edytowalny panel, ale zmiany nie zapisuja sie trwale.

#### P1 - wysokie

- Naprawic Health Monitoring.
- Naprawic Org AI Policy.
- Naprawic Prompt Templates.
- Naprawic Block Builder.
- Naprawic Test Bench.
- Naprawic Experiments.
- Naprawic Model Registry.
- Dodac pelne toasty sukcesu/bledu.
- Ujednolicic jezyk UI.
- Naprawic `NaN%` i `Invalid Date` w SLA.

#### P2 - srednie

- Dodac puste stany `No data yet` zamiast pustych wykresow.
- Dodac historie dzialan admina.
- Dodac audit log dla zmian AI governance.
- Dodac filtry per organization.
- Dodac export rzeczywistych plikow.
- Dodac widoczne timestamps dla danych.

### 11F. Proponowany backlog techniczny

#### Epic 1 - Provider Management Hardening

Cel: doprowadzic LLM Providers do pelnej produkcyjnej uzytecznosci.

Zadania:

- podlaczyc create provider;
- podlaczyc clone provider;
- podlaczyc update provider;
- podlaczyc delete provider;
- dodac pelna walidacje formularza;
- dodac toasty;
- dodac audit log;
- dodac refresh tabeli po kazdej akcji;
- dodac test connection z pelnym logiem odpowiedzi;
- dodac obsluge bledow API.

#### Epic 2 - Routing & Assignment Engine

Cel: uruchomic realne sterowanie routingiem modeli.

Zadania:

- naprawic Routing Rules;
- naprawic Purposes & Assignments;
- podlaczyc purpose families;
- podlaczyc model selecty;
- dodac zapis regul;
- dodac symulator routingu;
- dodac fallback chain;
- dodac priority resolver;
- dodac organization overrides;
- dodac test `which model will be selected?`.

#### Epic 3 - Governance & Policy Workflow

Cel: zamienic polityki AI z mocka w realny workflow governance.

Zadania:

- naprawic Org AI Policy;
- dodac draft/published workflow;
- dodac approval flow;
- dodac rollback;
- dodac version history;
- dodac JSON diff;
- dodac audit log;
- dodac persistent save w AI Governance;
- dodac read-only/runtime comparison;
- dodac enforcement validation.

#### Epic 4 - Prompt Builder MVP

Cel: uruchomic podstawowa wersje zarzadzania promptami.

Zadania:

- dodac create/edit/delete prompt template;
- dodac block library;
- dodac block builder;
- dodac test bench;
- naprawic Prompt Assistant;
- dodac multi-language validation;
- dodac rating/feedback;
- dodac learning analytics integration.

#### Epic 5 - Monitoring & Observability

Cel: sprawic, zeby dashboardy pokazywaly realne dane, a nie tylko puste karty.

Zadania:

- podlaczyc LLM Observatory do realnych requestow;
- podlaczyc Usage Analytics;
- podlaczyc Cost Analytics;
- podlaczyc Performance Metrics;
- naprawic Health Monitoring;
- dodac provider-level telemetry;
- dodac request logs;
- dodac incident feed;
- dodac alerty;
- dodac fallback error tracking.

#### Epic 6 - Reports & Export

Cel: uruchomic system raportow i eksportow.

Zadania:

- naprawic Custom Reports;
- dodac create report;
- dodac liste raportow;
- dodac harmonogram;
- dodac CSV export jako prawdziwy plik;
- dodac PDF export jako prawdziwy plik;
- dodac SLA report;
- dodac AI usage report;
- dodac cost report;
- dodac historie wygenerowanych raportow.

### 11G. Rekomendacja architektoniczna

Modul AI Operations powinien zostac podzielony logicznie na trzy poziomy.

#### Poziom 1 - Configuration

Funkcje, ktore admin moze zmieniac:

- providers;
- model tiers;
- routing rules;
- purpose assignments;
- org policies;
- governance switches.

Wymagania:

- zapis;
- walidacja;
- audit log;
- rollback;
- komunikat sukcesu/bledu.

#### Poziom 2 - Runtime

Funkcje diagnostyczne:

- mission control;
- health monitoring;
- AI core runtime;
- Prompt OS runtime;
- policy enforcement.

Moga byc read-only, ale musza miec:

- timestamp;
- source endpoint;
- status;
- details;
- link do miejsca naprawy.

#### Poziom 3 - Analytics

Dashboardy:

- usage;
- cost;
- performance;
- SLA;
- observability;
- reports.

Musza rozrozniac:

- brak danych;
- blad pobierania danych;
- dane zerowe;
- dane przefiltrowane.

Obecnie te stany czesto wygladaja tak samo: puste karty albo zera.

### 11H. Najwazniejszy wniosek produktowy

AI Operations ma bardzo dobra ambicje produktowa: centrum zarzadzania warstwa AI, obejmujace providerow, routing, governance, observability, runtime i prompt engineering.

Obecnie to jest jednak bardziej makieta zaawansowanej konsoli AI niz pelny system operacyjny dla AI. Najwiekszym ryzykiem jest to, ze zespol lub klient testowy kliknie konfiguracje i uzna, ze ona dziala, mimo ze backend jej nie zapisuje.

Rekomendowana kolejnosc:

1. Naprawic zapisy i backend dla konfiguracji.
2. Naprawic routing i assignmenty.
3. Uruchomic realna telemetryke.
4. Dopiero potem rozwijac prompt builder i learning system.

### 11I. Definition of Done dla AI Operations

Modul mozna uznac za gotowy dopiero wtedy, gdy:

- kazdy przycisk `Create`, `Save`, `Add`, `Delete`, `Export`, `Refresh`, `Test` ma realny efekt;
- kazda akcja ma toast sukcesu lub bledu;
- kazda zmiana zapisuje sie po refreshu strony;
- kazdy dashboard odroznia brak danych od bledu;
- kazda polityka ma wersjonowanie i audit log;
- routing modeli mozna przetestowac symulatorem;
- Prompt Assistant odpowiada bez bledu;
- Health Monitoring pokazuje realny status providerow;
- raporty mozna tworzyc i pobierac;
- jezyk UI jest spojny.

## 12. Audyt Connector Ops oraz Governance & Compliance - Super Admin Console

> Status: audyt manualny modulow Connector Ops oraz Governance & Compliance.
> Data dopisania: 2026-04-25.
> Cel: utrwalic druga paczke audytu Super Admin Console przed planem naprawczym.
> Zakres: Connector Ops oraz Governance & Compliance, ekran po ekranie i zakladka po zakladce.

### 12A. Executive summary

W trakcie audytu modulow Connector Ops oraz Governance & Compliance zidentyfikowano liczne nieukonczone lub nieaktywne funkcje, placeholdery i bledy integracji. Wiekszosc widokow przedstawia statyczne dane, np. `0 ms`, `0 logs`, `100% integrity`, ktore najprawdopodobniej sa zakodowane na sztywno albo pochodza z bezpiecznych fallbackow.

Formularze sluzace do tworzenia webhookow, kluczy API, workflowow, DSAR, audytow i polityk nie wysylaja danych na backend albo nie daja widocznego efektu po zapisie. Przyciski `Create`, `Save`, `Connect`, `Schedule` pozostaja nieaktywne lub nie wywoluja mutacji.

W module Governance & Compliance pojawiaja sie surowe bledy aplikacji, m.in. `INTERNAL_ERROR` oraz `[object Object]`. Czesc list, zwlaszcza Audit Timeline i Approvals, zawiera bledne daty `Invalid Date` albo brak szczegolow. Brakuje obslugi stanow pustych, bledow, loaderow, walidacji pol oraz refetchu po mutacjach.

Najwieksze ryzyka:

- podstawowe funkcje P0 nie dzialaja;
- wiele endpointow backendowych nie istnieje albo nie jest podpietych;
- brak refetchu danych po mutacjach;
- liczne placeholdery wygladaja jak realne metryki;
- brak testow krytycznych sciezek mutacji;
- funkcje security/backup/API keys moga wprowadzac administratora w blad.

Rekomendacja ogolna: ukryc albo jawnie zdegradowac interfejsy bez backendu, a nastepnie przejsc przez plan naprawczy od P0 do P2.

### 12B. Connector Ops - szczegolowy audyt

#### Health

Priorytet: `P1`.

Pliki startowe:

- `Health.tsx`;
- `HealthCard.tsx`.

Metody i endpointy:

- `getHealthStatus()`;
- `getMetrics()`;
- `GET /api/health`;
- `GET /api/metrics`.

Co dziala:

- wyswietlanie kart z metrykami;
- lista Services.

Problemy:

- wartosci sa statyczne albo nieprawdziwe, np. `0 ms`, `0 requests`;
- karty Services nie sa klikalne;
- brak szczegolow uslug;
- `Add Alert` otwiera modal, ale zapis alertu nie zapisuje na backendzie.

Braki UX/testow:

- brak stanow bledow;
- brak refetchu;
- brak testow integracyjnych z backendem.

Rekomendacja:

- podlaczyc realne endpointy monitoringu;
- dodac rozwiniecie Services;
- dodac walidacje formularza alertu;
- obslugiwac sukces i blad z backendu.

#### Feature Flags

Priorytet: `P1`.

Pliki startowe:

- `FeatureFlags.tsx`;
- `CreateFlagModal.tsx`.

Metody i endpointy:

- `listFeatureFlags()`;
- `createFlag()`;
- `GET /api/feature-flags`;
- `POST /api/feature-flags`.

Co dziala:

- modal tworzenia flagi otwiera sie.

Problemy:

- lista flag zawsze pusta;
- utworzenie flagi nie zapisuje jej;
- modal pozostaje bez skutecznego efektu.

Braki:

- brak toastow sukcesu/bledu;
- brak refetchu listy;
- brak testow stanu pustego i tworzenia flag.

Rekomendacja:

- dokonczyc listowanie i tworzenie flag;
- zapisac flagi w backendzie;
- dodac walidacje kluczy;
- dodac toast i refetch po mutacji.

#### Audit Log

Priorytet: `P1`.

Pliki startowe:

- `AuditLog.tsx`.

Metody i endpointy:

- `listAuditLogs()`;
- `exportAuditLogs()`;
- `GET /api/audit-logs`;
- `GET /api/audit-logs/analytics`.

Co dziala:

- przelaczanie miedzy widokiem logow a analytics;
- przycisk Export jest widoczny.

Problemy:

- brak logow, zawsze `No audit logs found`;
- analytics pokazuje `0` dla wszystkich kategorii;
- eksport nie dziala;
- filtry nie wplywaja na wyniki.

Braki:

- brak error state;
- brak paginacji;
- brak testow odczytu logow i analityki.

Rekomendacja:

- podlaczyc logi i analytics do backendu;
- dodac paginacje i filtry;
- zaimplementowac eksport CSV/PDF.

#### Integrations Hub

Priorytet: `P0`.

Pliki startowe:

- `IntegrationsHub.tsx`;
- `Catalog.tsx`;
- `WebhookModal.tsx`.

Metody i endpointy:

- `listIntegrations()`;
- `createIntegration()`;
- `listWebhooks()`;
- `createWebhook()`;
- `GET /api/integrations`;
- `POST /api/integrations`;
- `GET /api/webhooks`;
- `POST /api/webhooks`.

Co dziala:

- katalog integracji pokazuje 12 konektorow;
- przy kazdym widoczny jest przycisk `Connect`.

Problemy:

- `Connect` nie otwiera konfiguratora;
- zadna integracja nie jest tworzona;
- zakladki `Connected` i `Webhooks` sa puste;
- `Create Webhook` otwiera modal, ale `Create` nic nie robi.

Braki:

- brak feedbacku po nieudanej probie;
- brak walidacji URL i sekretow;
- brak testow tworzenia integracji i webhookow.

Rekomendacja:

- zaimplementowac tworzenie integracji i webhookow;
- modal powinien wysylac dane do backendu;
- lista powinna odswiezac sie po mutacji;
- dodac walidacje, obsluge bledow i testy.

#### Security & Compliance w Connector Ops

Priorytet: `P1`.

Pliki startowe:

- `Security.tsx`;
- `IPRules.tsx`;
- `Policies.tsx`;
- `Compliance.tsx`.

Metody i endpointy:

- `listSecurityEvents()`;
- `createIpRule()`;
- `getPolicies()`;
- `runComplianceAssessment()`;
- `GET /api/security-events`;
- `POST /api/ip-rules`;
- `GET /api/policies`;
- `POST /api/compliance/assess`.

Co dziala:

- wyswietla liste regul hasel, MFA i podobnych ustawien.

Problemy:

- Security Events, Sessions i IP Rules sa puste;
- `Add Rule` nie reaguje;
- `Run Assessment` nie uruchamia oceny.

Braki:

- brak komunikatu, czy nie ma danych, czy wystapil blad;
- brak formularzy;
- brak testow dla empty state i tworzenia regul.

Rekomendacja:

- dokonczyc backend IP Rules i Compliance Assessment;
- dodac formularze z walidacja;
- poprawic error/empty states;
- dodac testy.

#### Configuration Management

Priorytet: `P1`.

Pliki startowe:

- `Configuration.tsx`;
- `AddConfigModal.tsx`.

Metody i endpointy:

- `listConfigurations()`;
- `createConfiguration()`;
- `updateConfiguration()`;
- `GET /api/configurations`;
- `POST /api/configurations`;
- `PUT /api/configurations/:id`.

Co dziala:

- modal `Add Config` otwiera sie.

Problemy:

- tworzenie konfiguracji nie dziala;
- po `Create` modal nie zamyka sie;
- dane nie sa zapisywane.

Braki:

- brak informacji zwrotnej;
- brak filtrowania po srodowisku;
- brak testow tworzenia i edycji.

Rekomendacja:

- podlaczyc CRUD do backendu;
- dodac walidacje typu i kategorii;
- po zapisie przeladowac liste;
- dodac toasty sukcesu/bledu.

#### Analytics & Reporting

Priorytet: `P1`.

Pliki startowe:

- `Analytics.tsx`.

Metody i endpointy:

- `getAnalytics()`;
- `generateReport()`;
- `scheduleReport()`;
- `GET /api/analytics`;
- `POST /api/reports/generate`;
- `POST /api/reports/schedule`.

Co dziala:

- dashboard wyswietla statyczne wykresy;
- modal tworzenia i planowania raportu otwiera sie.

Problemy:

- generowanie PDF/CSV/Excel nie dziala;
- planowanie raportu nie zapisuje harmonogramu;
- lista zaplanowanych raportow pozostaje pusta.

Braki:

- brak progress state;
- brak historii raportow;
- brak testow generowania i planowania.

Rekomendacja:

- zaimplementowac backend generowania i zapisywania raportow;
- dodac spinner, toasty i historie raportow;
- dodac testy.

#### Backup & Recovery

Priorytet: `P0`.

Pliki startowe:

- `Backup.tsx`;
- `BackupSettings.tsx`;
- `DRTesting.tsx`.

Metody i endpointy:

- `listBackups()`;
- `createBackup()`;
- `listBackupSchedules()`;
- `updateBackupSettings()`;
- `runDRTest()`;
- `GET /api/backups`;
- `POST /api/backups`;
- `GET /api/backup-schedules`;
- `PUT /api/backup-settings`;
- `POST /api/dr-test`.

Co dziala:

- ustawienia pozwalaja zmienic liczbe dni retencji;
- przelacznik synchronizacji z chmura pokazuje liste providerow.

Problemy:

- `Create Backup` nie tworzy backupu;
- licznik pozostaje na 0;
- Schedules nie otwiera formularza;
- `Start DR Test` nic nie robi;
- statystyki DR, np. `4m 32s`, wygladaja na stale.

Braki:

- brak feedbacku;
- brak logow;
- brak walidacji;
- brak testow backupow i DR.

Rekomendacja:

- wdrozyc tworzenie i przywracanie backupow;
- wdrozyc harmonogram;
- uruchomic DR testy;
- dodac obsluge bledow i powiadomienia.

#### API Keys & API Management

Priorytet: `P0`.

Pliki startowe:

- `ApiKeys.tsx`;
- `CreateApiKeyModal.tsx`;
- `WebhookManagement.tsx`.

Metody i endpointy:

- `listApiKeys()`;
- `createApiKey()`;
- `listUsageAnalytics()`;
- `createWebhook()`;
- `GET /api/api-keys`;
- `POST /api/api-keys`;
- `GET /api/api-usage`;
- `POST /api/api-webhooks`.

Co dziala:

- modal tworzenia klucza API otwiera sie.

Problemy:

- brak organizacji w dropdown;
- checkboxy scope nie reaguja;
- `Create Key` jest zablokowany;
- Usage Analytics i Webhooks sa puste;
- `Add Webhook` nie tworzy webhooka.

Braki:

- brak informacji o wymaganych polach;
- brak toastow;
- brak paginacji kluczy;
- brak testow API keys i webhookow.

Rekomendacja:

- podlaczyc backend tworzenia kluczy i webhookow;
- wczytywac organizacje i zakresy;
- dodac walidacje i komunikaty.

#### Connector Ops - podsumowanie

Wiekszosc funkcji Connector Ops nie jest podpieta do backendu. Widoki wyswietlaja statyczne dane, a przyciski `Create`, `Run`, `Connect`, `Schedule` nie wywoluja mutacji. Brakuje stanow pustych, bledow, walidacji, toastow i testow. Metryki typu `Connected 0`, `Active 0`, `Errors 0`, `Available 10` trzeba zastapic realnymi danymi albo oznaczyc jako zdegradowane.

### 12C. Governance & Compliance - szczegolowy audyt

#### Overview

Priorytet: `P1`.

Pliki startowe:

- `ComplianceOverview.tsx`.

Metody i endpointy:

- `getOverviewMetrics()`;
- `getOperatorTimeline()`;
- `GET /api/gov/overview`;
- `GET /api/gov/operator-timeline`.

Co dziala:

- widoczne sa skroty `Audit Backlog`, `Approval Queue`, `Privileged Sessions`, `Compliance Posture`;
- lista `Latest operator timeline` pokazuje wpisy.

Problemy:

- wszystkie liczniki sa 0 i wygladaja na hard-coded albo fallback;
- timeline nie ma szczegolow;
- brak interakcji.

Braki:

- brak wyjasnienia metryk;
- brak paginacji timeline;
- brak error state;
- brak testow integracyjnych.

Rekomendacja:

- podlaczyc metryki i timeline do backendu;
- dodac filtry, historie i linki do szczegolow.

#### Audit Timeline

Priorytet: `P0`.

Pliki startowe:

- `AuditTimeline.tsx`.

Metody i endpointy:

- `listAuditEvents()`;
- `getAuditAnalytics()`;
- `GET /api/gov/audit-logs`;
- `GET /api/gov/audit-analytics`.

Problemy:

- pojawia sie `INTERNAL_ERROR`;
- tabela jest pusta mimo wskazania eventow;
- `Timestamp` pokazuje `Invalid Date`;
- klikniecie wiersza nie otwiera szczegolow;
- surowy JSON bledu trafia do usera.

Braki:

- brak paginacji;
- brak testow timeline;
- brak poprawnego formatowania dat.

Rekomendacja:

- naprawic backend logow;
- zwracac daty ISO;
- obslugiwac bledy czytelnym komunikatem;
- dodac szczegoly zdarzenia i filtrowanie po dacie.

#### Approvals

Priorytet: `P0`.

Pliki startowe:

- `Approvals.tsx`;
- `CreateWorkflowModal.tsx`.

Metody i endpointy:

- `listApprovals()`;
- `createApprovalWorkflow()`;
- `approveRequest()`;
- `GET /api/gov/approvals`;
- `POST /api/gov/approvals/workflow`;
- `POST /api/gov/approvals/:id/decision`.

Problemy:

- w gornej sekcji widoczny jest blad `[object Object]`;
- `Create Workflow` otwiera modal, ale `Create` nie dziala;
- Requests sa puste;
- approve/reject nie dziala.

Braki:

- brak czytelnej obslugi bledow;
- brak walidacji;
- brak toastow sukcesu/bledu;
- brak testow.

Rekomendacja:

- wdrozyc backend workflowow i decyzji;
- naprawic wyswietlanie bledow;
- dodac walidacje pol i powiadomienia.

#### Compliance

Priorytet: `P0`.

Pliki startowe:

- `ComplianceCenter.tsx`.

Metody i endpointy:

- `getComplianceSummary()`;
- `listFrameworks()`;
- `getFrameworkDetails()`;
- `createDSAR()`;
- `scheduleAudit()`;
- `listProcessingRecords()`;
- `GET /api/gov/compliance`;
- `GET /api/gov/frameworks`;
- `GET /api/gov/frameworks/:id`;
- `POST /api/gov/dsar`;
- `POST /api/gov/audits`;
- `GET /api/gov/processing-records`.

Co dziala:

- lista frameworkow jest widoczna;
- `View Details` otwiera widok kontroli z opisami artykulow.

Problemy:

- `Edit` na kontrolach nie dziala;
- `New Request` DSAR nie tworzy zgloszenia;
- `Schedule Audit` nie zapisuje audytu;
- Processing Records prawdopodobnie puste.

Braki:

- brak success/error;
- brak paginacji DSAR;
- brak walidacji email;
- brak testow DSAR i audytow.

Rekomendacja:

- zaimplementowac DSAR i planowanie audytow;
- dodac edycje statusu kontroli;
- zapewnic walidacje i obsluge bledow.

#### Exports & Retention

Priorytet: `P2`.

Pliki startowe:

- `ExportsRetention.tsx`.

Metody i endpointy:

- `listExports()`;
- `createExport()`;
- `listRetentionPolicies()`;
- `createRetentionPolicy()`;
- `GET /api/gov/exports`;
- `POST /api/gov/exports`;
- `GET /api/gov/retention-policies`;
- `POST /api/gov/retention-policies`.

Problem:

- modul nie zostal zbadany w UI; prawdopodobnie jest ukryty albo nieobecny w staging.

Rekomendacja:

- jesli funkcja istnieje w planie, dodac ja do UI;
- zaimplementowac tworzenie eksportow i polityk retencji.

#### Legal & Policies

Priorytet: `P2`.

Pliki startowe:

- `LegalPolicies.tsx`.

Metody i endpointy:

- `listPolicies()`;
- `createPolicy()`;
- `updatePolicy()`;
- `GET /api/gov/policies`;
- `POST /api/gov/policies`;
- `PUT /api/gov/policies/:id`.

Problem:

- brak dostepu do zakladki w staging;
- prawdopodobnie niezaimplementowana.

Rekomendacja:

- zaimplementowac listowanie, wersjonowanie, edycje i publikacje polityk prawnych.

#### Privileged Sessions

Priorytet: `P1`.

Pliki startowe:

- `PrivilegedSessions.tsx`.

Metody i endpointy:

- `listPrivilegedSessions()`;
- `startSession()`;
- `endSession()`;
- `GET /api/gov/sessions`;
- `POST /api/gov/sessions/start`;
- `POST /api/gov/sessions/end`.

Problem:

- w Overview licznik sesji wynosi 0;
- nie znaleziono widoku szczegolowego.

Rekomendacja:

- zaimplementowac liste aktywnych sesji;
- dodac start/end;
- dodac audit trail sesji.

#### Governance & Compliance - podsumowanie

Modul jest w wiekszosci szkieletowy. Widoki wyswietlaja dane domyslne albo zerowe. Akcje `create workflow`, `DSAR`, `schedule audit` nie wysylaja skutecznych zadan. Pojawiaja sie surowe bledy `INTERNAL_ERROR` i `[object Object]`. Funkcje Exports & Retention oraz Legal & Policies prawdopodobnie nie sa wdrozone w staging.

### 12D. Lista P0

- Integrations: brak tworzenia integracji i webhookow, `Connect` i `Create Webhook` sa nieaktywne.
- Audit Timeline: `INTERNAL_ERROR`, puste logi i `Invalid Date`.
- Approvals: `[object Object]`, brak tworzenia workflowow i brak decyzji approve/reject.
- Compliance: brak dzialania DSAR i planowania audytow.
- API Keys: brak tworzenia kluczy, brak organizacji i zakresow.
- Backup & DR Testing: brak tworzenia backupow, harmonogramow i testow DR.

### 12E. Lista P1

- Health: nieprawdziwe metryki, brak szczegolow i interakcji.
- Feature Flags: nie dziala zapis flag.
- Audit Log: brak paginacji, filtrow, analityki i eksportu.
- Connector Security & Compliance: brak security events, IP rules i compliance assessment.
- Analytics & Reporting: generowanie i planowanie raportow nie dziala.
- Configuration: brak zapisu ustawien.
- Governance Overview: statyczne dane i brak szczegolow timeline.
- Privileged Sessions: brak widoku listy i akcji.
- Brak systemowych toastow, walidacji i refetchu po mutacjach.

### 12F. Lista P2

- Usunac hard-coded metryki `0 ms`, `0 logs`, `100%`, `0/10`.
- Zamienic `[object Object]` i surowe JSON-y na czytelne komunikaty.
- Dodac empty states z instrukcjami.
- Umozliwic klikalnosc wierszy do szczegolow.
- Dopracowac formularze: sekcje, wymagane pola, formaty.
- Dodac loadery i spinnery przy mutacjach.
- Uspojnic tlumaczenia UI.

### 12G. Proponowany plan naprawy - Connector Ops

#### CO-1. Implementacja tworzenia integracji z katalogu

Pliki startowe:

- `Catalog.tsx`;
- `IntegrationsHub.tsx`;
- `src/services/api.ts`.

Endpointy:

- `POST /api/integrations`.

Definition of Done:

- `Connect` otwiera modal konfiguracji;
- po wypelnieniu integracja pojawia sie w `Connected`;
- mozna ja usunac;
- sa toasty i refetch.

Sugerowany test:

- e2e dodania integracji Slack i usuniecia jej z listy.

#### CO-2. Implementacja CRUD webhookow

Pliki startowe:

- `Webhooks.tsx`;
- `WebhookModal.tsx`.

Endpointy:

- `GET /api/webhooks`;
- `POST /api/webhooks`;
- `PATCH /api/webhooks/:id`;
- `DELETE /api/webhooks/:id`.

Definition of Done:

- user moze tworzyc, edytowac, testowac i usuwac webhooki;
- lista odswieza sie po zapisie;
- URL i sekrety sa walidowane.

Sugerowany test:

- utworzenie webhooka, wyslanie testowego eventu, edycja URL i usuniecie.

#### CO-3. Realne metryki Health

Endpointy:

- `GET /api/health`;
- `GET /api/metrics`.

Definition of Done:

- Health pobiera realne latency, uptime, memory;
- Services sa klikalne i rozwijaja szczegoly;
- bledy sa czytelne.

#### CO-4. Feature Flags

Endpointy:

- `GET /api/feature-flags`;
- `POST /api/feature-flags`;
- `PUT /api/feature-flags/:id`.

Definition of Done:

- lista wyswietla flagi;
- tworzenie i aktualizacja dzialaja;
- po zapisie widoczny jest toast i refetch.

#### CO-5. Audit Log i analytics

Endpointy:

- `GET /api/audit-logs`;
- `GET /api/audit-logs/analytics`.

Definition of Done:

- logi pobieraja sie z backendu;
- daty sa poprawne;
- filtry i eksport dzialaja.

#### CO-6. Security & Compliance

Endpointy:

- `POST /api/ip-rules`;
- `POST /api/compliance/assess`.

Definition of Done:

- mozna dodawac reguly IP;
- compliance assessment uruchamia backend;
- wynik jest widoczny.

#### CO-7. Configuration Management

Endpointy:

- `GET /api/configurations`;
- `POST /api/configurations`;
- `PUT /api/configurations/:id`.

Definition of Done:

- CRUD konfiguracji zapisuje dane;
- waliduje typ i kategorie;
- lista odswieza sie po zapisie.

#### CO-8. Analytics & Reporting

Endpointy:

- `POST /api/reports/generate`;
- `POST /api/reports/schedule`.

Definition of Done:

- raporty PDF/CSV/Excel generuja pliki;
- harmonogram raportow zapisuje sie;
- historia raportow jest widoczna.

#### CO-9. Backup & Recovery

Endpointy:

- `POST /api/backups`;
- `POST /api/dr-test`;
- `GET /api/backups`;
- `GET /api/backup-schedules`.

Definition of Done:

- full/incremental backup zapisuje rekord i status;
- harmonogram dziala;
- DR Test uruchamia symulacje i zwraca wynik.

#### CO-10. API Keys & Webhooks

Endpointy:

- `GET /api/api-keys`;
- `POST /api/api-keys`;
- `POST /api/api-webhooks`.

Definition of Done:

- formularz wczytuje organizacje;
- scope checkboxy dzialaja;
- klucz mozna stworzyc, skopiowac, rotowac i usunac;
- webhook mozna stworzyc.

### 12H. Proponowany plan naprawy - Governance & Compliance

#### GC-1. Audit Timeline INTERNAL_ERROR

Endpoint:

- `GET /api/gov/audit-logs`.

Definition of Done:

- endpoint zwraca prawidlowe dane;
- daty sa ISO;
- frontend pokazuje czytelny blad zamiast surowego JSON.

#### GC-2. Szczegoly zdarzen audytu

Endpoint:

- `GET /api/gov/audit-logs/:id`.

Definition of Done:

- wiersz zdarzenia otwiera panel szczegolow;
- widac kto, kiedy i jakie pola zmienil.

#### GC-3. Approvals i workflowy

Endpointy:

- `GET /api/gov/approvals`;
- `POST /api/gov/approvals/workflow`;
- `POST /api/gov/approvals/:id/decision`.

Definition of Done:

- blad nie renderuje sie jako `[object Object]`;
- workflow zapisuje sie;
- requesty mozna approve/reject;
- liczniki sie aktualizuja.

#### GC-4. DSAR

Endpoint:

- `POST /api/gov/dsar`.

Definition of Done:

- formularz waliduje email;
- tworzy DSAR;
- statusy `Pending` i `Fulfilled` sa widoczne i aktualizowalne.

#### GC-5. Planowanie audytow

Endpointy:

- `POST /api/gov/audits`;
- `GET /api/gov/audits`.

Definition of Done:

- audyt zapisuje sie z data;
- lista pokazuje zaplanowane audyty;
- mozna otworzyc szczegoly i anulowac audyt.

#### GC-6. Processing Records

Endpointy:

- `GET /api/gov/processing-records`;
- `POST /api/gov/processing-records`.

Definition of Done:

- ROPA wyswietla rekordy;
- mozna dodac i edytowac rekord przetwarzania.

#### GC-7. Exports & Retention

Endpointy:

- `GET /api/gov/exports`;
- `POST /api/gov/exports`;
- `GET /api/gov/retention-policies`;
- `POST /api/gov/retention-policies`.

Definition of Done:

- mozna tworzyc eksporty CSV/JSON;
- mozna definiowac polityki retencji;
- eksport da sie pobrac.

#### GC-8. Legal & Policies

Endpointy:

- `GET /api/gov/policies`;
- `POST /api/gov/policies`;
- `PUT /api/gov/policies/:id`.

Definition of Done:

- mozna tworzyc, edytowac, wersjonowac i publikowac polityki;
- lista filtruje po statusie;
- historia wersji jest widoczna.

#### GC-9. Privileged Sessions

Endpointy:

- `GET /api/gov/sessions`;
- `POST /api/gov/sessions/start`;
- `POST /api/gov/sessions/end`.

Definition of Done:

- widoczne sa aktywne sesje;
- mozna rozpoczac i zakonczyc sesje;
- jest dziennik/audit trail.

### 12I. Ryzyka i decyzje

- **Niepodpiete funkcje:** duza liczba przyciskow nie ma endpointow. Do czasu implementacji trzeba je ukryc, zablokowac albo oznaczyc jako niedostepne.
- **Statyczne dane:** placeholdery `0`, `-`, `n/a`, `100%` sugeruja falszywa pewnosc. Lepiej pokazac `No data yet` albo `Feature unavailable`.
- **Brak obslugi bledow:** surowe `INTERNAL_ERROR` i `[object Object]` musza zostac zastapione czytelnymi komunikatami.
- **Bezpieczenstwo:** API Keys, Webhooks, Backup i DR Test sa krytyczne operacyjnie. Ich niedostepnosc albo pozorne dzialanie jest ryzykiem P0.
- **Brak testow:** trzeba dodac testy jednostkowe, integracyjne i e2e dla mutacji, bo obecny stan latwo regresuje.

### 12J. Uzupelnienie audytu z pliku `audyt_connector_ops_governance_compliance.md`

> Status: szczegolowe uzupelnienie do rozdzialu 12.
> Zrodlo: `/Users/piotrwisniewski/Downloads/audyt_connector_ops_governance_compliance.md`.
> Cel: zachowac dokladniejsza wersje raportu z mapowaniem plikow, endpointow, testow, DoD i kolejnosci napraw.

#### Executive summary - wersja szczegolowa

W audycie Connector Ops oraz Governance & Compliance zidentyfikowano duza liczbe funkcji niedokonczonych, pozornych albo niepodpietych do realnej warstwy backendowej.

Najwazniejszy wniosek: oba moduly wygladaja jak zaawansowane panele administracyjne, ale wiele funkcji dziala tylko na poziomie UI. Czesc ekranow pokazuje dane zerowe, statyczne albo demonstracyjne. W wielu miejscach przyciski otwieraja modal, ale nie wykonuja zapisu. W innych miejscach akcje sa widoczne, lecz nie maja zauwazalnego efektu, nie pokazuja toastow, nie odswiezaja danych i nie obsluguja bledow w sposob czytelny.

Najwieksze ryzyka:

- `P0`: funkcje krytyczne pozorne: API Keys, Webhooks, Backup, Audit Timeline, Approvals, DSAR, planowanie audytow.
- `P0/P1`: brak wiarygodnosci danych: `0`, `n/a`, `100%`, `0 ms`, `0 errors` moga wynikac z fallbackow.
- `P1`: bledy obslugi danych: `INTERNAL_ERROR`, `[object Object]`, `Invalid Date`.
- `P1`: brak refetchu po mutacjach.
- `P1`: brak walidacji i toastow.
- `P2`: placeholdery i UX, ktore sprawiaja wrazenie gotowych funkcji.

Rekomendacja ogolna: przed dalszym rozwojem nalezy rozdzielic funkcje realnie dzialajace od demonstracyjnych. Funkcje bez backendu powinny zostac ukryte, oznaczone jako niedostepne albo zdegradowane do trybu read-only.

#### Connector Ops - szczegolowe wymagane endpointy

Health:

- `GET /api/super-admin/connector-ops/health`
- `GET /api/super-admin/connector-ops/health/services`
- `GET /api/super-admin/connector-ops/metrics`
- `POST /api/super-admin/connector-ops/alerts`

Audit Log:

- `GET /api/super-admin/connector-ops/audit-logs`
- `GET /api/super-admin/connector-ops/audit-logs/analytics`
- `GET /api/super-admin/connector-ops/audit-logs/export`

Feature Flags:

- `GET /api/super-admin/feature-flags`
- `POST /api/super-admin/feature-flags`
- `PATCH /api/super-admin/feature-flags/:id`
- `DELETE /api/super-admin/feature-flags/:id`

Integrations:

- `GET /api/super-admin/integrations/connected`
- `GET /api/super-admin/integrations/catalog`
- `POST /api/super-admin/integrations`
- `PATCH /api/super-admin/integrations/:id`
- `DELETE /api/super-admin/integrations/:id`
- `GET /api/super-admin/webhooks`
- `POST /api/super-admin/webhooks`
- `PATCH /api/super-admin/webhooks/:id`
- `POST /api/super-admin/webhooks/:id/test`
- `DELETE /api/super-admin/webhooks/:id`

Security:

- `GET /api/super-admin/connector-ops/security/events`
- `GET /api/super-admin/connector-ops/security/ip-rules`
- `POST /api/super-admin/connector-ops/security/ip-rules`
- `DELETE /api/super-admin/connector-ops/security/ip-rules/:id`
- `GET /api/super-admin/connector-ops/security/policies`
- `PATCH /api/super-admin/connector-ops/security/policies/:id`

Configuration:

- `GET /api/super-admin/connector-ops/configurations`
- `POST /api/super-admin/connector-ops/configurations`
- `PATCH /api/super-admin/connector-ops/configurations/:id`
- `DELETE /api/super-admin/connector-ops/configurations/:id`

Analytics:

- `GET /api/super-admin/connector-ops/analytics`
- `POST /api/super-admin/connector-ops/reports/generate`
- `POST /api/super-admin/connector-ops/reports/schedule`
- `GET /api/super-admin/connector-ops/reports/scheduled`

Backup:

- `GET /api/super-admin/connector-ops/backups`
- `POST /api/super-admin/connector-ops/backups`
- `POST /api/super-admin/connector-ops/backups/:id/restore`
- `GET /api/super-admin/connector-ops/backup-schedules`
- `POST /api/super-admin/connector-ops/backup-schedules`
- `PATCH /api/super-admin/connector-ops/backup-settings`
- `POST /api/super-admin/connector-ops/dr-tests`

API Keys:

- `GET /api/super-admin/api-keys`
- `POST /api/super-admin/api-keys`
- `POST /api/super-admin/api-keys/:id/revoke`
- `POST /api/super-admin/api-keys/:id/rotate`
- `GET /api/super-admin/api-keys/usage`

#### Connector Ops - dodatkowe rekomendacje techniczne

Health:

- wprowadzic strukture `ConnectorHealthSummary`;
- dodac `lastCheckedAt`;
- pokazac osobne stany `loading`, `error`, `empty`, `degraded`, `healthy`;
- alerty zapisywac w backendzie i po zapisie odswiezac liste.

Audit Log:

- zaimplementowac realne logowanie akcji Connector Ops;
- dodac backendowa paginacje i filtry;
- dodac drawer szczegolow rekordu;
- eksport powinien zwracac plik CSV/JSON/PDF i pokazywac toast.

Feature Flags:

- dodac pola `environment`, `scope`, `owner`, `description`, `defaultValue`;
- po zmianie flagi wymuszac refetch;
- dodac audit log dla kazdej zmiany flagi.

Integrations:

- zdefiniowac modele `IntegrationDefinition` i `ConnectedIntegration`;
- dodac realny proces connect/configure;
- dodac CRUD webhookow;
- dodac test webhooka z HTTP status, latency i response;
- dodac statusy `connected`, `degraded`, `failed`, `pending`, `disabled`;
- kazda akcja ma trafic do audit logu.

Security:

- walidowac CIDR/IP;
- dodac ostrzezenie przy regule mogacej zablokowac admina;
- dodac confirm dialog przy usuwaniu reguly;
- polityki security oznaczyc jako read-only, jesli nie maja realnego wplywu;
- kazda zmiana security musi zapisac audit log.

Configuration:

- wprowadzic model `ConnectorConfiguration`;
- dodac rozroznienie srodowisk `development`, `staging`, `production`;
- dodac walidacje klucza i typu wartosci;
- kazda zmiana powinna byc audytowana.

Analytics:

- raporty generowac jako job asynchroniczny;
- dodac statusy `queued`, `running`, `completed`, `failed`;
- po zakonczeniu udostepniac link do pobrania;
- dodac historie raportow.

Backup:

- traktowac jako funkcje krytyczna;
- do czasu realnej implementacji ukryc `Create Backup`, `Restore`, `DR Test` albo oznaczyc jako niedostepne;
- wdrozyc backend jobowy;
- dodac statusy, logi, historie i audit.

API Keys:

- nie pokazywac jako gotowej funkcji, jesli create/revoke/rotate nie dziala;
- sekret pokazywac tylko raz po utworzeniu;
- przechowywac tylko hash sekretu;
- dodac revoke/rotate z confirm dialogiem;
- kazda operacja musi miec audit log.

#### Governance & Compliance - szczegolowe wymagane endpointy

Overview:

- `GET /api/super-admin/governance/overview`
- `GET /api/super-admin/governance/operator-timeline`
- `GET /api/super-admin/governance/compliance-posture`

Audit Timeline:

- `GET /api/super-admin/governance/audit-events`
- `GET /api/super-admin/governance/audit-events/:id`
- `GET /api/super-admin/governance/audit-events/export`

Approvals:

- `GET /api/super-admin/governance/approvals`
- `POST /api/super-admin/governance/approval-workflows`
- `GET /api/super-admin/governance/approval-workflows/:id`
- `POST /api/super-admin/governance/approvals/:id/approve`
- `POST /api/super-admin/governance/approvals/:id/reject`
- `POST /api/super-admin/governance/approvals/:id/escalate`

Compliance:

- `GET /api/super-admin/governance/compliance/frameworks`
- `GET /api/super-admin/governance/compliance/frameworks/:id`
- `PATCH /api/super-admin/governance/compliance/controls/:id`
- `GET /api/super-admin/governance/dsar`
- `POST /api/super-admin/governance/dsar`
- `GET /api/super-admin/governance/audits`
- `POST /api/super-admin/governance/audits`
- `GET /api/super-admin/governance/processing-records`
- `POST /api/super-admin/governance/processing-records`

Exports & Retention:

- `GET /api/super-admin/governance/exports`
- `POST /api/super-admin/governance/exports`
- `GET /api/super-admin/governance/exports/:id/download`
- `GET /api/super-admin/governance/retention-policies`
- `POST /api/super-admin/governance/retention-policies`
- `PATCH /api/super-admin/governance/retention-policies/:id`
- `DELETE /api/super-admin/governance/retention-policies/:id`

Legal & Policies:

- `GET /api/super-admin/governance/legal-policies`
- `POST /api/super-admin/governance/legal-policies`
- `PATCH /api/super-admin/governance/legal-policies/:id`
- `POST /api/super-admin/governance/legal-policies/:id/publish`
- `GET /api/super-admin/governance/legal-policies/:id/versions`
- `POST /api/super-admin/governance/legal-policies/:id/rollback`

#### Governance & Compliance - dodatkowe rekomendacje techniczne

Overview:

- kazda karta musi miec zrodlo danych, definicje i link do szczegolowego widoku;
- `0` ma byc pokazywane tylko jako swiadoma odpowiedz backendu, nigdy jako fallback po bledzie;
- dodac `lastComputedAt` dla posture.

Audit Timeline:

- naprawic kontrakt backendu;
- daty zwracac jako ISO 8601;
- frontend nie moze renderowac `Invalid Date`, powinien pokazac `-` i zalogowac problem;
- dodac drawer szczegolow;
- dodac paginacje i filtry po typie akcji, uzytkowniku, module, dacie i ryzyku.

Approvals:

- zmapowac obiekt bledu do tekstu zamiast `[object Object]`;
- workflowy zatwierdzen musza byc realnym modelem backendowym;
- decyzje approve/reject/escalate musza tworzyc rekord audytowy;
- po kazdej decyzji kolejka musi zostac odswiezona.

Compliance:

- DSAR i Audits musza byc pelnymi CRUD-ami, nie modalami bez akcji;
- controls powinny miec status, ownera, due date i remediation action;
- Compliance Posture musi miec transparentna kalkulacje;
- kazda zmiana w compliance musi trafiac do audit timeline.

Exports & Retention:

- dodac jawny widok albo usunac z nawigacji, jesli nie jest gotowy;
- eksporty wykonywac asynchronicznie jako joby;
- retention policies powinny miec symulacje wplywu przed aktywacja.

Legal & Policies:

- wdrozyc jako pelny modul wersjonowania dokumentow;
- publikacja powinna wymagac approval flow;
- kazda publikacja musi tworzyc wpis w audit timeline.

#### Szczegolowy plan naprawy - Connector Ops

`CO-001 - Integrations Hub`

- Pliki: `IntegrationsHub.tsx`, `IntegrationCatalog.tsx`, `ConnectedIntegrations.tsx`, `Webhooks.tsx`, `AddIntegrationModal.tsx`, `CreateWebhookModal.tsx`, `src/services/api.ts`.
- DoD: katalog laduje realne definicje, `Connect` zapisuje integracje, `Connected` pokazuje realny stan, webhook mozna utworzyc/testowac/edytowac/usunac, po kazdej mutacji jest refetch, toast i audit log.
- Testy: e2e connect integration, e2e create/test/delete webhook, unit walidacja URL, integration backend zapisuje integracje.

`CO-002 - API Keys`

- Pliki: `ApiKeys.tsx`, `CreateApiKeyModal.tsx`, `ApiKeyTable.tsx`, `ApiUsageAnalytics.tsx`, `src/services/api.ts`.
- DoD: lista laduje backend, create wymaga organizacji i scope, sekret widoczny tylko raz, copy/revoke/rotate dzialaja, usage analytics pokazuje realne uzycie, operacje sa audytowane.
- Testy: e2e create key and copy secret, e2e revoke key, unit scope validation, security test secret nie wraca po refreshu.

`CO-003 - Backup & Recovery`

- Pliki: `Backup.tsx`, `CreateBackupModal.tsx`, `BackupSettings.tsx`, `DRTesting.tsx`, `src/services/api.ts`.
- DoD: full/incremental backup tworzy job, UI pokazuje status, lista odswieza sie po zakonczeniu, restore wymaga confirm dialogu, DR Test zapisuje wynik, operacje sa audytowane.
- Testy: integration create backup job, e2e start backup and see status, e2e run DR test, unit retencja nie moze byc ujemna.

`CO-004 - Feature Flags`

- Pliki: `FeatureFlags.tsx`, `CreateFlagModal.tsx`, `FeatureFlagTable.tsx`, `src/services/api.ts`.
- DoD: mozna utworzyc flage, zmienic status, usunac, lista odswieza sie po mutacji, duplikat klucza jest blokowany.
- Testy: unit flag key validation, e2e create/toggle/delete, integration backend blokuje duplikaty.

`CO-005 - Centralny error/loading/toast/refetch pattern`

- Pliki: `src/services/api.ts`, `src/hooks/useApiMutation.ts`, `src/components/common/EmptyState.tsx`, `src/components/common/ErrorState.tsx`, `src/components/common/LoadingState.tsx`.
- DoD: kazde pobranie ma loading/error/empty/success, kazda mutacja ma toast i refetch albo lokalny update, bledy nie pokazuja `[object Object]`.
- Testy: unit error mapper, component empty state, component loading state, e2e mutacja pokazuje toast i aktualizuje liste.

#### Szczegolowy plan naprawy - Governance & Compliance

`GC-001 - Audit Timeline`

- Pliki: `AuditTimeline.tsx`, `AuditTimelineTable.tsx`, `AuditTimelineFilters.tsx`, `AuditEventDetailsDrawer.tsx`, `src/services/api.ts`.
- DoD: endpoint zwraca daty ISO, UI nie pokazuje `Invalid Date`, filtry i paginacja dzialaja, klikniecie rekordu otwiera szczegoly, bledy sa czytelne.
- Testy: unit date parser, integration audit events contract, e2e filter/open details, e2e backend error shows friendly message.

`GC-002 - Approvals`

- Pliki: `Approvals.tsx`, `ApprovalQueue.tsx`, `CreateWorkflowModal.tsx`, `ApprovalDetailsDrawer.tsx`, `src/services/api.ts`.
- DoD: nie ma `[object Object]`, workflow mozna utworzyc, queue pokazuje realne requesty, approve/reject/escalate zmienia status, lista sie odswieza, decyzja trafia do audit timeline.
- Testy: e2e create workflow, e2e approve request, e2e reject request with reason, unit error mapper.

`GC-003 - Compliance DSAR`

- Pliki: `Compliance.tsx`, `DsarRequests.tsx`, `CreateDsarRequestModal.tsx`, `src/services/api.ts`.
- DoD: `New Request` tworzy DSAR, email jest walidowany, DSAR pojawia sie na liscie, status mozna zmieniac, kazda zmiana ma audit log.
- Testy: unit email validation, e2e create DSAR, e2e update status, integration DSAR zapisuje owner/status/due date.

`GC-004 - Compliance Audits`

- Pliki: `Compliance.tsx`, `Audits.tsx`, `ScheduleAuditModal.tsx`, `src/services/api.ts`.
- DoD: `Schedule Audit` zapisuje audyt, lista pokazuje audyty, audyt ma framework/ownera/date/status, po zapisie jest toast i refetch.
- Testy: e2e schedule audit, unit required fields validation, integration audit appears in list.

`GC-005 - Compliance Controls i Remediation`

- Pliki: `ComplianceControls.tsx`, `ComplianceControlDetailsDrawer.tsx`, `RemediationActionModal.tsx`, `src/services/api.ts`.
- DoD: edit control dziala, status kontroli da sie zmienic, mozna dodac remediation action, posture aktualizuje sie po zmianie, zmiany trafiaja do audit timeline.
- Testy: e2e edit control, e2e create remediation action, integration posture recalculates.

`GC-006 - Exports & Retention`

- Pliki: `ExportsRetention.tsx`, `CreateExportModal.tsx`, `RetentionPolicies.tsx`, `src/services/api.ts`.
- DoD: mozna utworzyc eksport jako job, eksport ma status i plik do pobrania, mozna utworzyc polityke retencji, retention policy ma preview wplywu, operacje sa audytowane.
- Testy: e2e create export and download, e2e create retention policy, unit retention period validation.

`GC-007 - Legal & Policies`

- Pliki: `LegalPolicies.tsx`, `PoliciesTable.tsx`, `CreatePolicyModal.tsx`, `PolicyVersionHistory.tsx`, `src/services/api.ts`.
- DoD: mozna utworzyc polityke jako draft, edytowac draft, opublikowac wersje, historia wersji jest widoczna, publikacja wymaga approval albo confirm dialogu, publikacja trafia do audit timeline.
- Testy: e2e create/edit/publish policy, integration version history, unit cannot publish empty policy.

#### Funkcje do ukrycia albo zdegradowania do czasu implementacji

1. Connector Ops / API Keys: nie pokazywac jako gotowej funkcji, jesli create/revoke/rotate nie dziala.
2. Connector Ops / Backup & Recovery: ukryc `Create Backup`, `Restore`, `DR Test`, jesli backend nie wykonuje realnych jobow.
3. Connector Ops / Webhooks: ukryc testowanie i tworzenie, jesli system ich nie zapisuje i nie wykonuje test calla.
4. Governance / Approvals: ukryc approve/reject/escalate, jesli nie zapisuja decyzji i audit trail.
5. Governance / Audit Timeline: do czasu naprawy `INTERNAL_ERROR` i `Invalid Date` pokazywac prosty error state zamiast tabeli z blednymi danymi.
6. Governance / DSAR: ukryc `New Request`, jesli zgloszenie nie zapisuje sie w backendzie.
7. Governance / Legal Policies: jesli nie ma wersjonowania i publikacji, oznaczyc jako `read-only / planned`.

#### Decyzje produktowe do podjecia

1. Czy Super Admin Console ma pokazywac moduly niedokonczone jako zapowiedz, czy tylko funkcje dzialajace?
2. Czy Connector Ops ma byc operacyjnym centrum integracji, czy tylko panelem obserwacyjnym?
3. Czy Governance & Compliance ma byc realnym systemem dowodowym/audytowym, czy tylko dashboardem statusow?
4. Czy wszystkie mutacje administracyjne maja wymagac approval flow?
5. Czy backup, API keys, webhooks i compliance actions maja wspolny audit envelope?
6. Czy raporty i backupy maja byc wykonywane jako joby asynchroniczne z kolejka?
7. Czy retention policies maja dzialac realnie na danych produkcyjnych, czy tylko jako dokumentacja polityk?

#### Minimalny standard techniczny dla obu modulow

Kazda funkcja w Connector Ops oraz Governance & Compliance powinna spelniac minimum:

1. Frontend: widok, formularz, walidacja, loading, empty, error, success.
2. API service: metoda w `src/services/api.ts` z typowanym request/response.
3. Backend: endpoint, walidacja, zapis, autoryzacja, spojny kontrakt.
4. Audit: kazda mutacja zapisuje audyt.
5. Toast: kazda mutacja pokazuje sukces albo blad.
6. Refetch: po kazdej mutacji lista/karta aktualizuje stan.
7. Tests: unit + integration + minimum jeden test e2e dla krytycznej sciezki.
8. Security: API keys, backup, webhooks, approvals i compliance musza miec osobne zabezpieczenia i audyt.

#### Rekomendowana kolejnosc naprawy

1. `P0 / API Keys` - bezpieczenstwo i wiarygodnosc systemu.
2. `P0 / Backup & Recovery` - krytyczna funkcja operacyjna.
3. `P0 / Audit Timeline` - bez audytu nie ma Governance.
4. `P0 / Approvals` - bez decyzji i sladu zatwierdzen Governance jest atrapa.
5. `P0 / Integrations & Webhooks` - rdzen Connector Ops.
6. `P0 / DSAR & Audits` - funkcje compliance musza zapisywac dane.
7. `P1 / Feature Flags, Configuration, Security Rules` - wazne funkcje administracyjne.
8. `P1 / Analytics & Reporting` - raportowanie po naprawie zrodel danych.
9. `P2 / UX cleanup, placeholder cleanup, tlumaczenia, tooltipy`.

## 13. Audyt modulu Platform Security - Agent

> Status: audyt manualny modulu Platform Security z perspektywy roli agent / zwykly uzytkownik.
> Zrodlo: `/Users/piotrwisniewski/Downloads/agent_module_security_audit.md`.
> Srodowisko: `https://demo.consultify.ai`.
> Cel: sprawdzic, czy zwykly uzytkownik ma dostep do analogicznego panelu security oraz ktore funkcje dzialaja.

### 13A. Kontekst audytu

Raport powstal po audytach wersji `superadmin` i `admin`. Celem bylo zweryfikowanie, czy zwykly uzytkownik lub agent ma dostep do analogicznego panelu Platform Security oraz jaki jest realny zakres funkcji w tej roli.

Testy zostaly wykonane na `https://demo.consultify.ai`.

### 13B. Dostep do modulu

Wynik audytu dostepu:

1. Po wylogowaniu z superadmina probowano przejsc pod `/login`. Strona logowania byla pusta, bez formularza logowania. Po odczekaniu kilku minut interfejs nadal sie nie zaladowal.
2. Proba wejscia na `demo.consultify.ai` zamiast `.../login` rowniez konczyla sie czarnym ekranem albo nieskonczonym ladowaniem.
3. Poniewaz nie udalo sie uzyskac widoku logowania, nie bylo mozliwe sprawdzenie, jak wyglada modul Platform Security dla roli agent / uzytkownik.

Wniosek: panel Platform Security dla roli agent nie zostal potwierdzony. Mozliwe, ze nie istnieje, nie jest udostepniony tej roli albo jest blokowany przez problem z logowaniem.

Z braku mozliwosci zalogowania sie do roli agent kontynuowano analize na podstawie wczesniejszych audytow wersji superadmin. Zidentyfikowane problemy najprawdopodobniej dotycza rowniez obszarow agent/admin, jesli wspoldziela te same komponenty albo backend.

### 13C. Potencjalne funkcje modulu agent

Na podstawie wersji superadmin mozna zalozyc, ze wersja agent moglaby zawierac uproszczone wersje nastepujacych funkcji.

#### Podstawowa postawa bezpieczenstwa

Potencjalny zakres:

- podglad liczby aktywnych sesji uprzywilejowanych;
- liczba krytycznych incydentow;
- status health planu, np. `operational`.

Wersja superadmin pokazuje te metryki jako widok tylko do odczytu.

#### MFA / SSO posture

Potencjalny zakres:

- ocena, czy organizacja wlaczyla MFA;
- ocena, czy organizacja wlaczyla SSO;
- karta stanu security controls.

Wersja superadmin ma kafle `MFA posture` i `SSO posture`, ale bez pelnej konfiguracji polityk z poziomu tego widoku.

#### Evidence checklist

Potencjalny zakres:

- lista kontrolna pokazujaca, jakie dowody sa zbierane;
- np. komunikat typu `Privileged activity is visible through admin session stats`.

Ten typ sekcji powinien byc wyraznie oznaczony jako read-only.

#### Podglad incydentow i zagrozen

Potencjalny zakres:

- lista wlasnych incydentow security;
- zgloszenia DLP dotyczace uzytkownika;
- incydenty dotyczace konta.

Ryzyko: w wersji superadmin moduly `Incidents` i `Threats` nie dzialaly poprawnie, zwracaly bledy lub nie zapisywaly zmian. Jesli agent korzysta z tych samych endpointow, funkcjonalnosc prawdopodobnie tez jest niekompletna.

### 13D. Ogolne problemy zidentyfikowane w wersji superadmin

Poniewaz modul agent nie wczytal sie, ponizsze problemy zostaly przeniesione z audytu Platform Security w wersji superadmin jako ryzyka wspoldzielone.

#### Brak zapisu ustawien i brak komunikatow sukcesu

W wielu miejscach mozna wprowadzic dane, ale po `Save` nie ma trwalego efektu. Dotyczy to m.in.:

- konfiguracji SSO;
- SCIM;
- polityk;
- DLP;
- ograniczen budzetu;
- incydentow;
- zagrozen.

Przyklady:

- zapis konfiguracji SSO konczyl sie komunikatem `Failed to save configuration`;
- utworzenie polityki DLP nie powodowalo pojawienia sie jej na liscie.

Wymagane dzialanie:

- kazdy formularz musi miec realny endpoint zapisu;
- kazda mutacja musi miec toast sukcesu albo bledu;
- po zapisie musi nastapic refetch albo lokalny update stanu.

#### Bledy systemowe

Wiele stron zwraca surowe bledy:

- `INTERNAL_ERROR`;
- `[object Object]`;
- brak szczegolow dla uzytkownika.

Przyklady:

- `Admin Sessions`: `INTERNAL_ERROR` przy odswiezaniu i brak danych;
- `Workflows`: po utworzeniu approval workflow pojawia sie `[object Object]`, a workflow nie jest tworzony;
- `Incidents` i `Threats`: przy ladowaniu danych pojawia sie `INTERNAL_ERROR`, a zgloszenie incydentu albo zagrozenia nic nie zmienia.

Wymagane dzialanie:

- opakowac bledy backendu w czytelny komunikat;
- nie renderowac surowego JSON ani `[object Object]`;
- logowac techniczne szczegoly po stronie backendu;
- pokazywac userowi konkretna informacje, co moze zrobic.

#### Brak danych i bledne dane

Wiele tabel i licznikow pokazuje:

- `0`;
- `n/a`;
- puste listy;
- bledne daty.

Dotyczy to m.in.:

- Audit Logs;
- Audit Events;
- Policies;
- Admin Sessions;
- DLP;
- Budgets.

W module `Audit Events` widoczna byla lista 35 zdarzen, ale daty mialy wartosc `Invalid Date`, a filtr zasobow nie dzialal.

Wymagane dzialanie:

- rozroznic `no data`, `loading`, `error`, `filtered empty`, `degraded`;
- naprawic parsowanie dat;
- dodac walidacje danych z backendu;
- nie pokazywac pustych zer jako prawdziwych metryk bez wyjasnienia.

#### Nieaktywne przyciski

W wielu miejscach przyciski nie wywoluja akcji:

- `Add`;
- `Generate`;
- `Apply`;
- generowanie kodu w SSO/SCIM;
- tworzenie access codes;
- generowanie API tokens.

Wymagane dzialanie:

- kazdy widoczny przycisk musi miec dzialanie;
- jesli funkcja nie jest gotowa, przycisk powinien byc disabled z wyjasnieniem albo ukryty;
- wszystkie mutacje musza miec test smoke.

#### Brak spojnych tlumaczen

Interfejs miesza jezyk angielski i polski. Przyklady:

- w Health Monitoring statusy providerow `Nieznany` sa obok angielskich etykiet typu `Provider`;
- podobne mieszanie wystepuje w `Threats` i `Incidents`.

Wymagane dzialanie:

- wybrac jeden jezyk bazowy dla Super Admin albo wdrozyc pelne i18n;
- usunac surowe klucze i mieszane fallbacki;
- tlumaczyc statusy i etykiety konsekwentnie.

#### Zbyt duzy poziomy scroll

W wielu miejscach, szczegolnie przy kaflach i tabach, konieczne jest przewijanie poziome. Utrudnia to korzystanie z panelu security.

Wymagane dzialanie:

- poprawic responsywnosc tabow;
- zawijac karty albo grupowac sekcje;
- unikac ukrywania krytycznych akcji poza widocznym obszarem.

### 13E. Rekomendacje dla modulu agent

#### 1. Naprawic logowanie

Formularz logowania musi ladowac sie zawsze. Obecnie `demo.consultify.ai/login` zwraca pusta strone, co uniemozliwia dostep do paneli agentow.

Definition of Done:

- `/login` renderuje formularz;
- bledy ladowania aplikacji sa widoczne;
- user moze zalogowac sie rola agent;
- istnieje smoke test dla login page.

#### 2. Przemyslec zakres funkcji dla roli agent

Jesli uzytkownik koncowy ma miec tylko wglad w incydenty i swoj stan MFA/SSO, panel powinien byc uproszczony.

Sekcje, ktore zwykle nie maja sensu dla agenta:

- SCIM configuration;
- SSO configuration;
- Roles;
- Permissions;
- global security policy;
- tenant-wide DLP configuration.

Rekomendacja:

- ukryc konfiguracje administracyjne;
- pokazac agentowi tylko informacyjne karty i akcje, ktore moze realnie wykonac;
- jasno oznaczyc read-only posture i evidence.

#### 3. Zapewnic pelna obsluge zapisu

W miejscach, gdzie agent albo admin moze wprowadzac dane, backend musi zapisywac dane trwale.

Dotyczy to:

- raportu incydentu;
- zgloszenia zagrozenia;
- edycji polityki;
- zgloszenia DLP;
- komentarzy i statusow incydentow.

Definition of Done:

- `Save/Create/Submit` wysyla request;
- backend waliduje payload;
- frontend pokazuje toast;
- po refreshu zmiana zostaje;
- istnieje test mutacji i test bledu.

#### 4. Poprawic obsluge bledow

Bledy typu `INTERNAL_ERROR` i `[object Object]` powinny byc przechwytywane i zamieniane na czytelny komunikat.

Przykladowy komunikat:

```text
Wystapil blad zapisu danych. Sprobuj ponownie pozniej.
```

Wersja techniczna bledu powinna trafic do logow serwera albo konsoli developerskiej, nie bezposrednio do UI.

#### 5. Uspojnic jezyk

Interfejs powinien byc w calosci po polsku albo po angielsku. Jesli ma dzialac wersja PL, wszystkie karty, etykiety i statusy powinny byc przetlumaczone konsekwentnie.

#### 6. Odróżnic read-only od konfiguracji

Sekcje tylko informacyjne, np. `Evidence checklist`, powinny byc wyraznie oznaczone jako read-only. Sekcje z formularzami powinny zapisywac dane i odswiezac widok.

Minimalny standard:

- read-only badge;
- opis zrodla danych;
- timestamp ostatniego odczytu;
- brak aktywnych przyciskow `Save`, jesli zapis nie istnieje.

#### 7. Poprawic responsywnosc

Nalezy ograniczyc koniecznosc przewijania poziomego i dopasowac karty oraz zakladki do szerokosci ekranu.

### 13F. P0 / P1 / P2 dla Platform Security Agent

#### P0

- Login page `/login` jest pusty albo laduje sie w nieskonczonosc.
- Nie da sie zweryfikowac panelu agent, bo rola agent nie jest osiagalna.
- Formularze security w wersji superadmin czesto nie zapisuja danych.
- Incidents i Threats zwracaja `INTERNAL_ERROR` albo nie zmieniaja stanu.
- Approval workflows zwracaja `[object Object]` i nie tworza workflowow.

#### P1

- Brak toastow sukcesu/bledu.
- Brak refetchu po mutacjach.
- `Invalid Date` w audit events.
- Puste listy bez wyjasnienia.
- Nieaktywne przyciski `Add`, `Generate`, `Apply`.
- Brak rozroznienia read-only od konfiguracji.

#### P2

- Mieszanie PL/EN w statusach i etykietach.
- Nadmierny poziomy scroll.
- Brak spójnych empty states.
- Brak opisow zrodel danych i timestampow.

### 13G. Proponowany plan naprawy

#### PSA-1. Naprawa dostepu i login page

Pliki startowe:

- routing frontendowy logowania;
- komponent login page;
- auth middleware;
- konfiguracja demo/staging.

Definition of Done:

- `/login` zawsze renderuje formularz;
- bledy inicjalizacji aplikacji sa widoczne;
- mozna zalogowac sie testowym agentem;
- smoke test potwierdza render login page.

#### PSA-2. Ustalenie zakresu Platform Security dla roli agent

Definition of Done:

- spisana jest macierz uprawnien agent/admin/superadmin;
- agent widzi tylko dozwolone sekcje;
- konfiguracje admin-only sa ukryte;
- read-only panele maja opis i badge.

#### PSA-3. Incident and Threat reporting

Definition of Done:

- agent moze zglosic incydent albo zagrozenie;
- backend zapisuje rekord;
- lista odswieza sie po zgloszeniu;
- status jest widoczny po refreshu;
- bledy sa czytelne.

#### PSA-4. Security posture read-only dashboard

Definition of Done:

- agent widzi MFA/SSO posture;
- widzi evidence checklist;
- dane maja timestamp i zrodlo;
- brak danych nie wyglada jak blad ani jak falszywa metryka.

#### PSA-5. Error handling and i18n cleanup

Definition of Done:

- `INTERNAL_ERROR` i `[object Object]` nie trafiaja do UI;
- statusy sa w jednym jezyku;
- wszystkie formularze maja walidacje;
- kazda mutacja ma toast.

### 13H. Podsumowanie

Modul Platform Security w wersji superadmin ma potencjal, ale w praktyce jest w duzej mierze makieta. Wiele funkcji nie dziala poprawnie, formularze nie zapisuja danych, a liczne bledy systemowe uniemozliwiaja korzystanie.

Na podstawie testow mozna wnioskowac, ze wersja agent, o ile istnieje, jest niedostepna przez problem z logowaniem albo dziedziczy te same problemy z backendem i UI.

Aby modul mogl zostac wykorzystany przez uzytkownikow koncowych, nalezy najpierw:

1. naprawic logowanie;
2. ustalic realny zakres funkcji roli agent;
3. podlaczyc backend mutacji security;
4. zapewnic trwaly zapis ustawien i zgloszen;
5. ujednolicic obsluge bledow;
6. dopiero potem rozszerzac funkcjonalnosci przenoszone z wersji superadmin.

## 14. Audyt Identity / Access / Settings / Security w Consultify

> Status: audyt manualny przekrojowy dla identity, access, settings i security.
> Srodowisko: `https://demo.consultify.ai`.
> Role testowe: superadmin, admin/owner, zwykly uzytkownik / agent.
> Cel: sprawdzic kompletność przeplywow administracyjnych przed budowa planu napraw.

### 14A. Executive summary

Testy manualne objely trzy role: superadmin, admin/owner i zwykly uzytkownik / agent. Celem bylo sprawdzenie kompletności przeplywow administracyjnych w obszarach loginu/sesji, zarzadzania uzytkownikami i organizacjami, ustawien aplikacji oraz bezpieczenstwa.

Wyniki wskazuja, ze moduly settings i security sa niedokonczone. Wiekszosc formularzy nie zapisuje danych, wielu funkcji brakuje, a liczne ekrany wyswietlaja `INTERNAL_ERROR`, `[object Object]` albo pozostaja puste.

Superadmin widzi pelne menu, admin widzi tylko wlasna organizacje, a agent ma dostep jedynie do podstawowych funkcji. Kluczowe bledy `P0` to:

- brak dzialajacego logowania dla konta zwyklego uzytkownika / agenta;
- brak mozliwosci tworzenia i edycji uzytkownikow;
- brak mozliwosci tworzenia i edycji organizacji;
- brak zapisu polityk bezpieczenstwa;
- brak trwalego zapisu ustawien user/org/security.

### 14B. Macierz rol i dostepu

| Modul / akcja | Superadmin | Admin / owner | User / agent | Priorytet / uwagi |
|---|---|---|---|---|
| Logowanie / sesja | Dostep do loginu, sesja zachowana po refreshu, logout dziala. | Login wymaga dedykowanego linku; sesja nie zawsze sie laduje, czasem przekierowuje na strone marketingowa. | Nie udalo sie zalogowac; formularz loginu sie nie laduje albo po zalogowaniu wraca na marketing page. | P0 |
| Podglad tenantow | Widzi wszystkie organizacje i uzytkownikow. | Widzi tylko wlasna organizacje, ale wiele akcji nie dziala. | Brak dostepu. | - |
| Zarzadzanie uzytkownikami | Nie dziala Add member, generate access, zmiana roli/statusu; brak toastow. | Podobnie jak superadmin; nie mozna utworzyc ani edytowac uzytkownika. | Brak dostepu. | P0 |
| Ustawienia organizacji / tenant | Plan, status, rabat widoczne, ale zapis wywoluje `INTERNAL_ERROR` albo nie zapisuje. | Widzi swoje dane; edycja nie dziala. | Brak. | P1 |
| Pending access requests | Lista widoczna, ale akcje approve/reject sa niedostepne albo nieskuteczne. | Widzi tylko swoje pending requests; brak akcji. | Brak. | P1 |
| Ustawienia uzytkownika | Settings ma wiele zakladek, ale zmiany nie zapisuja sie po refreshu. | Podobnie. | Widzi tylko podstawowe ustawienia albo czesc zakladek jest niedostepna. | P0 |
| MFA / SSO / SCIM | Panele istnieja, ale konfiguracja nie zapisuje sie; `Failed to save configuration`. | Brak dostepu do globalnej konfiguracji. | Brak dostepu. | P0 |
| Password policy / IP whitelist | Pola edytowalne, ale Save nie zapisuje; IP whitelist nie dodaje nowych adresow. | Brak. | Brak. | P1 |
| Audit / Sessions | Admin Sessions i Audit Logs zwracaja `INTERNAL_ERROR`; Audit Events ma `Invalid Date`. | Brak dostepu. | Brak. | P0 |
| Incidents / Threats / DLP / Budgets | Moduly laduja sie z bledami albo nie zapisuja rekordow; Model Access dziala czesciowo, usuwanie nie dziala. | Brak dostepu. | Brak. | P0 |
| Org AI Policy / Governance | AI Governance pokazuje polityki i przelaczniki, ale zmiany nie zapisuja sie; `Failed to save settings`. | Brak dostepu. | Brak. | P1 |
| Approval workflows | Modal tworzenia workflowu istnieje, ale zapis pokazuje `[object Object]` i nic nie tworzy. | Brak. | Brak. | P1 |

### 14C. P0 - bledy blokujace

1. **Brak dzialajacego logowania dla user/agent.** Formularz logowania dla zwyklego uzytkownika czesto sie nie laduje; proby logowania koncza sie przekierowaniem na strone marketingowa.
2. **Brak zapisywania ustawien i konfiguracji.** Zmiany w profilu, parametrach modelu, ustawieniach organizacji i politykach security nie sa zachowywane po `Save`; po refreshu wraca poprzedni stan.
3. **Brak funkcji zarzadzania uzytkownikami.** `Add member` nie dziala; nie mozna tworzyc, edytowac ani usuwac uzytkownikow; brak toastow.
4. **`INTERNAL_ERROR` i `[object Object]` w security/audit.** Admin Sessions, Audit Logs, Incidents, Threats, DLP i Budgets zwracaja wewnetrzne bledy przy odswiezaniu albo zapisie.
5. **SSO/MFA/SCIM sa atrapa.** Formularze SSO Google Workspace/SAML i SCIM tokenow istnieja, ale zapis konczy sie `Failed to save configuration`.
6. **Incident/threat management nie dziala.** Zgloszenie incydentu albo zagrozenia nie tworzy rekordow.
7. **AI Budgets nie dziala w pelni.** Budzet i alerty nie tworza wpisow; Model Access dziala czesciowo, ale usuwanie nie dziala.
8. **Bledne formaty danych.** `Invalid Date`, `NaN`, `n/a`, `0` sa widoczne bez wyjasnienia.

### 14D. P1 - problemy wysokiego priorytetu

- Formularze nie waliduja pol; puste lub niepoprawne wartosci przechodza bez czytelnego bledu.
- Po dodaniu/usunieciu elementu lista nie aktualizuje sie automatycznie.
- Brakuje komunikatow sukcesu i bledu; uzytkownik nie wie, czy operacja sie wykonala.
- Puste tabele nie rozrozniaja `no data`, `loading`, `error`, `filtered empty`.
- UI miesza polski i angielski; widoczne sa czasem surowe klucze tlumaczen, np. `auth.email`, `superadmin.customers.playbooks.title`.
- Zakladki superadmin/admin powinny byc ukryte dla nizszych rol; obecnie czasem pojawiaja sie puste strony, redirect albo internal error.
- Expired token/session timeout nie ma jasnego komunikatu.
- Platform Security wymaga poziomego scrolla w gornej nawigacji, przez co czesc zakladek jest ukryta.

### 14E. P2 - problemy sredniego priorytetu

- Brak jasnego rozgraniczenia sekcji read-only i edytowalnych.
- Placeholdery `n/a`, `0`, `Nieznany` sa pokazywane bez wyjasnienia.
- Brak historii zmian polityk i ustawien.
- Workflowy approval maja nieintuicyjny proces tworzenia i bledy `[object Object]`.
- `Invalid Date`, `NaN%` i brak separatorow tysiecy obnizaja wiarygodnosc danych.
- Tworzenie rol pozwala wybrac kolor, ale lista `Permission Definitions` jest pusta i nie ma realnego przypisania uprawnien.
- Dlugie formularze SSO/DLP wymagaja przewijania w dwoch osiach.
- SCIM/API keys/Access codes nie generuja tokenow/kodow w sposob uzyteczny.

### 14F. Szczegolowy raport per obszar

#### Login / logout / sesja

Superadmin:

- `/login` dziala i prowadzi do konsoli superadmina;
- sesja utrzymuje sie po odswiezeniu;
- logout z menu bocznego dziala, ale czasem wymaga podwojnego klikniecia.

Admin / owner:

- formularz loginu czasem sie nie laduje;
- po zalogowaniu user bywa przenoszony na strone marketingowa zamiast do aplikacji;
- testy konta owner/admin byly przez to ograniczone.

User / agent:

- formularz logowania praktycznie sie nie laduje albo przekierowuje na strone glowna;
- nie udalo sie zweryfikowac expired tokenow i re-loginu.

Braki:

- brak czytelnych bledow logowania;
- brak komunikatu o wygasnieciu sesji;
- brak stabilnego smoke flow dla wszystkich rol.

#### Role i uprawnienia

Superadmin:

- ma pelny dostep do modulow;
- wiele widocznych modulow jest jednak atrapa albo nie zapisuje zmian.

Admin / owner:

- powinien miec dostep do panelu tenantowego;
- widzi tylko wlasna organizacje;
- w Admin Panel przyciski `Add member` i `Generate code` nie dzialaja.

User / agent:

- powinien widziec podstawowe moduly, np. Chat, My Work, Settings;
- nie udalo sie tego potwierdzic przez problem z loginem.

Braki:

- brak jasnego 403;
- niedozwolone widoki czasem laduja puste strony albo internal error.

#### Zarzadzanie uzytkownikami

Problemy:

- w People & Access przycisk `Add member` nie reaguje;
- `Generate code` nic nie robi;
- modal edycji usera da sie otworzyc, ale zapis nie dziala;
- move user i zmiana roli nie przynosza efektu;
- Pending Requests pokazuje liste, ale brakuje approve/reject;
- brak reset password i invite link.

Wymagania naprawy:

- create/edit/delete user;
- role/status change;
- move user between organizations;
- invite/resend invite/reset password;
- toast + refetch + persist after refresh.

#### Organizacje i tenant settings

Problemy:

- lista organizacji i userow jest widoczna;
- edycja organizacji jest read-only albo nieskuteczna;
- Plan/Status/Discount w Billing & FinOps koncza sie `INTERNAL_ERROR`;
- brak brandingu i custom domain;
- admin widzi tylko swoja organizacje, ale nie moze edytowac pol.

Wymagania naprawy:

- zapis danych organizacji;
- walidacja plan/status/discount;
- jasne rozroznienie global vs tenant settings;
- refetch po zapisie.

#### Access requests / onboarding

Problemy:

- Access Codes otwiera modal, ale `Generate` nie tworzy kodu;
- Pending Requests nie ma skutecznego approve/reject;
- brak wysylki zaproszenia email;
- brak informacji o expiry/max uses.

Wymagania naprawy:

- generate access code;
- approve/reject pending request;
- invite email;
- success/error toast;
- request znika albo zmienia status po decyzji.

#### Ustawienia aplikacji

Zakres:

- Profile;
- Avatar;
- Email Signatures;
- Working Hours;
- Model & Parameters;
- AI Data & Privacy;
- Regional Settings;
- Security Settings;
- Voice & TTS;
- Prompt Library;
- AI Usage Dashboard.

Problemy:

- formularze przyjmuja dane i `Save`, ale dane znikaja po zmianie zakladki albo refreshu;
- brak walidacji, np. dowolny tekst w polu telefonu;
- ustawienia AI/Data/Privacy/Regional/Security pokazuja `Failed to save ...`;
- superadmin settings czesto pokazuja puste widoki albo bledy.

Wymagania naprawy:

- okreslic zakres ustawien: user/org/global;
- podlaczyc backend zapisu;
- walidowac pola;
- zachowywac dane po refreshu.

#### Platform Security

SSO:

- Google Workspace i SAML nie zapisuja konfiguracji;
- widoczny `Failed to save configuration`.

SCIM:

- ladowanie danych konczy sie `NOT_FOUND`;
- prawdopodobnie brak endpointu.

Roles:

- mozna stworzyc role testowa, ale brak przypisywania uprawnien;
- lista permission definitions jest pusta.

Permissions:

- definicje uprawnien sa puste;
- kopiowanie permission nie dziala;
- `Add permission` nie dziala.

Policies:

- MFA, SSO, Password policy, Data Governance sa widoczne;
- zapis nie dziala;
- `Apply compliance preset` nic nie robi.

Admin Sessions / Audit:

- Admin Sessions zwraca `INTERNAL_ERROR`;
- Audit Logs zwraca `INTERNAL_ERROR`;
- Audit Events ma wpisy, ale daty `Invalid Date`, filtr nie dziala.

Workflows:

- utworzenie workflowu konczy sie `[object Object]`;
- workflow nie pojawia sie na liscie.

Incidents / Threats / DLP:

- formularze nie zapisuja danych;
- strona czesto zglasza `INTERNAL_ERROR`.

AI Budgets:

- utworzenie budzetu nie dziala;
- Model Access dodaje restrykcje czesciowo;
- usuwanie restrykcji nie dziala.

#### Governance / Compliance z perspektywy dostepu

Problemy:

- superadmin widzi AI Governance, ale przelaczniki nie zapisuja zmian;
- admin nie ma dostepu do globalnego governance;
- approval queue nie dziala;
- Workflows nie tworzy flow;
- audit timeline pokazuje `Invalid Date` i `NaN`;
- brak klarownych stanow dla `n/a`, `unknown`, pustych list.

### 14G. Braki testow automatycznych

Brakuje testow dla:

- login/session dla superadmin/admin/user;
- wygasniecia tokenu i re-loginu;
- matrix permissions i ukrywania zakladek;
- create/edit/delete user;
- create/edit organization;
- approve/reject access request;
- generate access code;
- zapisu ustawien user/org/global;
- SSO/MFA/SCIM save;
- IP whitelist;
- password policy;
- audit events date formatting;
- incidents/threats/DLP create;
- AI budgets create/delete;
- tlumaczen i surowych kluczy i18n.

### 14H. Rekomendowana kolejnosc napraw

1. Naprawic login i sesje dla wszystkich rol. `/login` musi sie ladowac, bledne loginy musza miec czytelny komunikat, a expired session musi pokazac jasny alert.
2. Zaimplementowac podstawowe CRUD dla uzytkownikow i organizacji w admin/superadmin: create, edit, delete, role/status, toasty i refetch.
3. Zabezpieczyc uprawnienia: ukrywac niedostepne zakladki, zwracac czytelny 403, unikac pustych stron.
4. Naprawic zapisywanie ustawien: profile, AI params, org settings, policies, SSO, SCIM, DLP, budgets, workflows.
5. Obslugiwac bledy backendu: mapowac `INTERNAL_ERROR` i `[object Object]` na czytelne komunikaty.
6. Dopracowac security: SSO/MFA/SCIM, password policy, IP whitelist, incident management, threat intelligence, DLP, AI budgets.
7. Poprawic UI/UX: usunac poziomy scroll, ujednolicic jezyk, dodac loading/no data/error states, poprawic daty i liczby.
8. Wprowadzic audit trail: kto, kiedy, co zmienil, z prawidlowymi datami i historia polityk.
9. Dodac automatyczne testy e2e i integracyjne dla wszystkich krytycznych sciezek.
10. Komunikowac status funkcji: read-only, disabled z wyjasnieniem albo ukrycie, jesli backend nie istnieje.

## 15. Cross-App Admin Surface Gaps

> Status: uzupelnienie po analizie przekrojowej admin / superadmin / settings.
> Cel: zebrac luki, ktore nie sa pelnie pokryte przez audyty modulowe 11-14.
> Zakres: tenant admin P32, settings, organization routes, API client hygiene, billing contracts, SCIM multitenancy, assessment access requests i relacja Admin Integrations vs SuperAdmin Connector Ops.

### 15A. Executive summary

Dotychczasowe audyty dobrze pokrywaja SuperAdmin AI Ops, Connector Ops, Governance, Platform Security oraz Identity/Access. Nadal brakuje jednak osobnego planu dla powierzchni przecinajacych wiele modulow:

- tenant admin / owner panel;
- user settings i organization settings;
- przeplywy `organization/*` vs `admin/*`;
- hygiene klienta API;
- billing endpoint mismatch;
- tenant isolation w SCIM;
- assessment access requests;
- Admin V8 Sync Hub vs SuperAdmin Connector Ops.

To sa ryzyka systemowe, bo moga powodowac sytuacje, w ktorej jedna funkcja administracyjna ma dwa UI, dwa endpointy albo dwa rozne wzorce zapisu i obslugi bledu.

### 15B. Tenant Admin P32 contract audit

Zakres:

- `src/views/admin/AdminSettingsModule.tsx`;
- panele admin: people, security, billing, ai, integrations, audit, operations;
- backend `server/src/routes/adminP32.routes.ts`;
- metody `/api/admin/*` w `src/services/api.ts`.

Ryzyka:

- tenant admin ma bogaty zestaw endpointow, ale nie ma osobnego backlogu naprawczego;
- czesc operacji moze dzialac tylko w UI albo tylko w backendzie;
- audit logs dla admina moga miec falszywa paginacje, jesli filtracja odbywa sie po pobraniu limitu rekordow;
- czesc endpointow uzywa zwyklego `fetch` bez jednolitego retry/error handlingu.

Definition of Done:

- kazdy flow tenant admin ma UI -> API method -> backend endpoint -> walidacje -> zapis -> audit;
- kazda mutacja ma toast i refetch/lokalny update;
- admin widzi tylko dane swojej organizacji;
- test izolacji tenantowej przechodzi dla people, billing, security, IAM i audit.

### 15C. Settings persistence map

Zakres:

- `SettingsView`;
- `src/components/settings/*`;
- `src/services/api/settings.api.ts`;
- ustawienia user/org/global;
- profile, avatar, signatures, working hours, AI params, AI data/privacy, regional, security, notifications.

Ryzyka:

- rozdzial 14 opisuje problem ogolnie, ale nie mapuje kazdej zakladki settings na konkretny kontrakt;
- czesc settings moze uzywac `SettingsApi`, czesc monolitycznego `Api`, a czesc surowego `fetch`;
- sekcje moga miec `Save`, ktory nie zapisuje albo zapisuje w zlym scope: user/org/global;
- `SettingsView` zawiera duzo hardcoded angielskich opisow zamiast i18n.

Definition of Done:

- kazdy przycisk `Save` ma okreslony scope: user, organization albo global;
- kazde ustawienie ma endpoint, walidacje i persist po refreshu;
- kazdy ekran settings ma loading, empty, error i success;
- UI nie miesza surowych kluczy i hardcoded angielskich tekstow, jesli aktywne jest i18n.

### 15D. Organization routes vs Admin routes

Zakres:

- `OrganizationView`;
- `OrganizationAdminPanel`;
- `/organization/*`;
- `/admin/*`;
- `ADMIN_REDIRECTS`;
- endpointy `/api/organizations/:orgId/*` oraz `/api/admin/*`.

Ryzyka:

- istnieja dwa wejscia do podobnych tematow: organization panel i admin P32;
- bezposrednie URL-e `/organization/members` moga renderowac inny komponent niz `/admin/people`;
- user moze widziec dwa niespojnie dzialajace UI dla czlonkow, billing albo ustawien org;
- dokumentacja i manualne testy moga mylic te powierzchnie.

Definition of Done:

- jedno zrodlo prawdy dla tenant admin flows;
- jesli `/organization/*` ma byc tylko aliasem, zawsze przekierowuje do `/admin/*`;
- jesli oba widoki zostaja, maja jawnie rozne role i zakresy;
- test e2e potwierdza, ze admin trafia w ten sam kanoniczny flow.

### 15E. API client hygiene

Zakres:

- `src/services/api.ts`;
- `src/services/api/settings.api.ts`;
- `src/services/api/baseClient.ts`;
- surowe `fetch` w komponentach i kontekstach;
- `OrgContext`;
- `AccessPolicyContext`;
- komponenty SuperAdmin z surowym `/api/...`.

Ryzyka:

- aplikacja uzywa wielu wzorcow HTTP: `fetch`, `fetchWithRetry`, `handleResponse`, `SettingsApi`, `apiGet/apiPost`;
- bledy moga byc mapowane niespojnie, co prowadzi do `INTERNAL_ERROR` albo `[object Object]` w UI;
- czesc komponentow moze omijac token handling i retry;
- trudniej testowac kontrakty.

Definition of Done:

- mutacje admin/superadmin/settings uzywaja wspolnego error mappera;
- brak surowego `[object Object]` i surowych JSON errors w UI;
- `fetchWithRetry + handleResponse` albo `baseClient` jest standardem dla nowych i naprawianych przeplywow;
- komponenty nie skladaja recznie `/api/...`, jesli istnieje metoda w service layer;
- test jednostkowy error mappera pokrywa `INTERNAL_ERROR`, validation error i network error.

### 15F. Billing endpoint mismatch

Zakres:

- `getOperationalCosts` w `src/services/api.ts`;
- backend `server/src/routes/billing/billing.routes.ts`;
- admin/superadmin FinOps dashboards.

Ryzyka:

- frontend wolal `/api/billing/admin/costs`, podczas gdy backend ma `/api/billing/admin/operational-costs`;
- query string w kliencie moze zawierac bledny separator z odstepem po `?`;
- backend czesto zwraca zera przy bledzie, przez co UI pokazuje fałszywy brak kosztow zamiast error/degraded.

Definition of Done:

- frontend endpoint jest zgodny z backendiem;
- query string nie zawiera blednego `? `;
- UI rozroznia realne zero, brak danych i blad backendu;
- test kontraktowy sprawdza `operational-costs`.

### 15G. SCIM multitenancy hardening

Zakres:

- `adminP32.routes.ts`;
- SCIM group mappings;
- tenant admin identity settings;
- org admin SCIM summary.

Ryzyka:

- SCIM group mappings moga byc zapisywane bez `organization_id`;
- brak filtrowania tenantowego grozi mieszaniem danych miedzy organizacjami;
- admin moglby widziec albo modyfikowac mappingi spoza swojego tenanta.

Definition of Done:

- SCIM mappings maja `organization_id`;
- wszystkie odczyty i zapisy sa filtrowane po organizacji aktora;
- migracja/backfill uzupelnia tenant scope;
- test izolacji tenantowej przechodzi dla dwoch organizacji.

### 15H. Assessment access requests

Zakres:

- access requests zwiazane z assessment;
- rozne od SuperAdmin access requests;
- approve/reject/status/audit flow.

Ryzyka:

- system ma wiecej niz jeden typ access request;
- manualne audyty skupily sie na superadmin pending requests i access codes;
- assessment access requests moga miec osobny backend, UI i statusy;
- brak wspolnego modelu moze prowadzic do niespojnych decyzji dostepowych.

Definition of Done:

- spisana jest mapa typow access request;
- assessment access request ma create/list/approve/reject/status;
- decyzje sa audytowane;
- UI jasno rozroznia request tenant onboarding od request assessment/resource.

### 15I. Admin V8 Sync Hub vs SuperAdmin Connector Ops

Zakres:

- Admin integrations / V8 Sync Hub;
- SuperAdmin Connector Ops / Integrations Hub;
- `UnifiedSyncHub`;
- connector catalog, sync jobs, webhook/connectors.

Ryzyka:

- dwa moduly uzywaja podobnego jezyka: integrations/connectors/sync;
- moga miec osobne endpointy, modele i statusy;
- audyt Connector Ops nie pokrywa w pelni tenantowego V8 Sync Hub;
- user/admin moze nie rozumiec, ktory panel sluzy do konfiguracji, a ktory do globalnego nadzoru.

Definition of Done:

- ustalona terminologia: Connector Ops global vs Admin Integrations tenant;
- wspolny model statusow integracji albo jawnie rozne modele;
- dokumentacja opisuje relacje miedzy hubami;
- test e2e potwierdza tenantowy sync flow niezaleznie od SuperAdmin Connector Ops.

### 15J. PlaybookTemplateReviews API hygiene

Zakres:

- `src/components/SuperAdmin/PlaybookTemplateReviews.tsx`;
- content endpoints;
- review/approval UI.

Ryzyka:

- komponent uzywa surowego `fetch('/api/content/...')`;
- walidacja i bledy uzywaja `alert()` zamiast toastow;
- moze omijac `Api`, token handling, retry i wspolne mapowanie bledow;
- temat nie byl jasno ujety w poprzednich audytach.

Definition of Done:

- komponent uzywa service layer;
- brak `alert()` w przeplywach admin;
- kazda akcja review ma toast, loading state i refetch;
- endpointy content review maja walidacje i audit.

### 15K. Cross-app rekomendowana kolejnosc

1. Tenant Admin P32 contract audit.
2. Settings persistence map.
3. Organization routes vs Admin routes.
4. API client hygiene.
5. Billing endpoint mismatch.
6. SCIM multitenancy hardening.
7. Assessment access requests.
8. Admin V8 Sync Hub vs SuperAdmin Connector Ops.
9. PlaybookTemplateReviews API hygiene.

## 16. Audyt Billing / Commercial / Operations - SuperAdmin

> Status: zlagly raport manualny; ostatni audyt szczegolowy nadal trwa.
> Srodowisko: `https://demo.consultify.ai`.
> Role testowe: superadmin `admin@dbr77.com`, user `piotr.wisniewski@dbr77.com`.
> Cel: utrwalic obserwacje z obszaru billing, commercial, usage, limits, AI Ops, Connector/Ops i governance przed planem napraw.

### 16A. Executive summary

Podczas manualnego przegladu platformy Consultify w srodowisku demo sprawdzono moduly finansowe, subskrypcje, usage/limits, AI Ops, Connector/Ops i narzedzia governance.

Wiekszosc danych w panelach jest pusta albo oznaczona jako `0`, `NaN`, `n/a`, co sugeruje brak integracji z backendem, fallbacki albo placeholdery. Wiele operacji tworzenia i edycji konczy sie komunikatem sukcesu, ale po odswiezeniu dane nie sa zapisane. Wystepuja bledy `[object Object]` i nieobslugiwane walidacje formularzy.

Najpilniejsze problemy `P0` dotycza:

- finansow: fakturowanie, platnosci, plany, usage;
- generowania i zarzadzania API keys / webhookami;
- backupow;
- konfiguracji providerow AI;
- security/compliance;
- zapisu danych po refreshu.

Wiele widokow wyswietla statyczne dane `0/n/a` i nie zwraca szczegolow po requestach API, co uniemozliwia pelny test produkcyjny.

### 16B. P0 - krytyczne problemy

#### Billing / Payments

Problemy:

- formularze tworzenia planow abonamentowych sa dostepne, ale zapis nowego planu nie dziala;
- po `Save` nie pojawia sie toast ani nowy wpis na liscie;
- tworzenie faktur nie jest mozliwe;
- pole `Organization ID` jest tekstowym UUID zamiast wyboru organizacji;
- dodanie tax rate pokazuje sukces, ale lista podatkow pozostaje pusta;
- karty MRR/ARR, usage i tokens pokazuja `0`, `NaN`, `n/a`;
- czesc formularzy zwraca `[object Object]` albo nie zapisuje danych.

Ryzyko:

- administrator moze zalozyc, ze plan, faktura lub tax rate zostaly utworzone, mimo ze backend nie zapisuje danych.

Wymagane:

- realne endpointy create/list/update dla plans, invoices, tax rates;
- selector organizacji zamiast tekstowego UUID;
- refetch po zapisie;
- rozroznienie real zero / no data / backend error;
- test kontraktowy billing.

#### Subscriptions / Plans

Problemy:

- zmiana rabatu w General Info pokazuje toast `Organization updated`, ale po ponownym otwarciu wartosc sie nie zmienia;
- brak przyciskow upgrade/downgrade;
- `Billing & Settlement` jest read-only;
- wartosci `Monthly Cost $0`, `Token Usage 0 of Unlimited (NaN%)` wygladaja na fallback.

Wymagane:

- trwaly zapis planu/rabatu/statusu;
- jasny workflow upgrade/downgrade;
- poprawne liczenie usage percent;
- test po refreshu strony.

#### Usage / Limits / Budgets

Problemy:

- CPU, Memory, Storage, Tokens pokazuja `0` albo `0% used`;
- Monthly Budget pokazuje budget/spent/remaining `0`;
- nie mozna ustawic limitow ani budzetow;
- brak rozroznienia `no data`, `unlimited`, `0 usage`, `error`.

Wymagane:

- realne usage endpoints;
- zapis limitow i budzetow;
- walidacja kwot i progow;
- UI dla `unlimited` zamiast `NaN%`.

#### AI Operations

Problemy:

- LLM Providers maja liste, ale edycja wymagajaca API keys nie daje widocznego efektu zapisu;
- Org AI Policy, Model Registry i Prompt Builder sa puste albo read-only;
- czesc AI Governance wyglada jak konfiguracja, ale nie zapisuje zmian.

Wymagane:

- do czasu implementacji oznaczyc read-only;
- naprawic provider config persistence;
- rozroznic configuration, runtime i analytics.

#### Connector Ops

Problemy:

- katalog integracji pokazuje Slack, Teams, Jira, ale `Connect` nie reaguje;
- tworzenie webhooka konczy sie `Failed to create webhook`;
- API Management pokazuje `0 total keys`;
- backup/restore/DR sa informacyjne i nie wykonuja akcji.

Wymagane:

- connect integration;
- create/test/delete webhook;
- create/copy/revoke/rotate API key;
- backup/restore/DR jako joby albo ukrycie przyciskow.

#### Governance & Compliance / Security

Problemy:

- ladowanie MFA methods konczy sie `Failed to fetch MFA methods`;
- zapis password policy zwraca `[object Object]`;
- Security Events nie laduje danych;
- IP Whitelist pokazuje toast po dodaniu IP, ale lista pozostaje pusta;
- DSAR/Audit/Compliance actions sa nieskuteczne albo niedostepne.

Wymagane:

- endpointy MFA/password policy/security events;
- prawdziwy zapis IP whitelist;
- error mapper dla `[object Object]`;
- audit log dla zmian security.

#### Support / CS / Lifecycle

Problemy:

- support tickets nie zapisuja sie;
- CS notes nie zapisuja sie;
- Customer Health nie zawiera danych;
- Contracts, Playbooks i Lifecycle sa puste;
- utworzenie lifecycle stage nie zapisuje danych.

Wymagane:

- create/list/update support tickets;
- create/list customer success notes;
- lifecycle stages and transitions persistence;
- playbook/contract CRUD;
- refetch po kazdej mutacji.

#### Uzytkownicy i organizacje

Problemy:

- dodawanie i zapraszanie uzytkownikow nie dziala;
- formularze zwracaja `[object Object]` albo `Invalid option`;
- przenoszenie uzytkownika do innej organizacji nie dziala;
- rabaty/plan org nie utrwalaja sie mimo toasta.

Wymagane:

- create user;
- invite user;
- update role/status/org;
- walidacja enumow;
- persist po refreshu.

### 16C. P1 - problemy wymagajace uwagi

- `NaN`, `Invalid Date`, `n/a` i puste pola w statystykach.
- Brak toastow albo nieczytelne komunikaty `[object Object]`.
- Brak walidacji formularzy; puste pola trafiaja do backendu.
- Po refreshu dane znikaja, czyli zapis nie jest trwaly.
- Brak loading/empty/error states w wielu tabelach.
- Brak informacji, czy `0` oznacza brak danych, realne zero, blad czy brak konfiguracji.

### 16D. P2 - UX / tlumaczenia / klarownosc

- Placeholdery bez wyjasnien, np. tekstowe `Organization ID`.
- Mieszanie angielskiego i polskiego.
- Dashboardy pokazuja same zera bez `No data yet`.
- Brak linkow z pustych dashboardow do konfiguracji.
- Brak spojnosci walut i formatowania dat.
- Brak jasnych disabled/read-only states.

### 16E. Macierz endpointow brakujacych albo niedzialajacych

Kluczowe endpointy do weryfikacji i naprawy:

- `POST /plans`
- `POST /invoices`
- `POST /tax`
- `PUT /organizations/:id`
- `POST /users/invite`
- `POST /users`
- `POST /lifecycle`
- `POST /support/tickets`
- `POST /webhooks`
- `GET /security`
- `PUT /security`
- `GET /security/events`
- `GET /usage`
- endpointy MFA methods;
- endpointy password policy;
- endpointy IP whitelist;
- endpointy API keys;
- endpointy backup/restore/DR.

Priorytet: wiekszosc powyzszych to `P0`, jesli przyciski sa widoczne w UI.

### 16F. Funkcje do ukrycia albo zdegradowania

Do czasu realnej implementacji ukryc, zablokowac albo oznaczyc jako `read-only / in preparation`:

- tworzenie planow;
- tworzenie faktur;
- tax rates;
- user invite/add;
- lifecycle/playbooks/contracts;
- support ticketing;
- CS notes;
- integrations connect;
- webhooks;
- API keys;
- MFA methods;
- password policy;
- IP whitelist;
- security events;
- DSAR/Audit actions;
- backup/restore/DR;
- AI Ops Model Registry;
- Prompt Builder;
- Org AI Policy editing, jesli nie zapisuje.

### 16G. Rekomendowana kolejnosc napraw

1. **Funkcje finansowe i billing** - plany, faktury, tax rates, kontrakty, realne MRR/ARR i usage.
2. **Uzytkownicy i organizacje** - invite/add user, licencje, rabaty, role/status, walidacja formularzy.
3. **Connector Ops i API** - API keys, integracje, webhooki, backup/restore.
4. **Security & Compliance** - MFA, password policy, IP whitelist, security logs, DSAR.
5. **Support & CS oraz Lifecycle** - tickets, CS notes, customer health, lifecycle stages.
6. **AI Operations & Governance** - provider config, model registry, prompt builder, policy editing; do czasu implementacji read-only.
7. **UX & tlumaczenia** - placeholdery, jezyk, waluty, daty, toasty, zero/empty states.

### 16H. Wnioski

Srodowisko testowe Consultify jest bogate w moduly, ale wiekszosc funkcji jest obecnie szkieletowa albo konczy sie bledem. Aby platforma byla gotowa do uzycia, konieczne jest wdrozenie backendow dla operacji finansowych, uzytkownikow, integracji, bezpieczenstwa i supportu oraz poprawa UX.

Najwazniejsze kryterium przed uznaniem dowolnego flow za naprawiony:

- akcja ma realny endpoint;
- backend waliduje payload;
- frontend pokazuje toast;
- lista/karta odswieza sie;
- zmiana przetrwa refresh strony;
- blad jest czytelny i nie pokazuje `[object Object]`.

## 17. Audyt Tenant Admin P32 i Settings Persistence

> Status: ostatni audyt manualno-techniczny przed planem napraw.
> Srodowisko: `https://demo.consultify.ai`.
> Zakres: Tenant Admin P32, Settings Persistence, Organization vs Admin routes, API hygiene.
> Cel: zweryfikowac trwalosc zapisow w panelu admina organizacji i w ustawieniach uzytkownika/organizacji.

### 17A. Executive summary

Audyt Tenant Admin P32 oraz Settings Persistence pokazuje, ze panel tenant admin jest w wiekszosci atrapa. Prawie wszystkie formularze i przyciski `Save` albo `Add`:

- nie wywoluja zadnej skutecznej akcji w backendzie;
- generuja `INTERNAL_ERROR`;
- wymagaja pol, ktore nie sa wyswietlane;
- albo daja falszywy toast sukcesu bez trwalego zapisu.

Jedynymi sekcjami settings, w ktorych potwierdzono czesciowa trwalosc danych, sa:

- Email Signatures;
- Working Hours.

Pozostale ustawienia, m.in. Profile, Avatar, Security, Regional, AI Model & Parameters, AI Memory, AI Privacy oraz Voice/TTS, nie zapisuja sie trwale albo zwracaja blad.

Najwieksze ryzyka:

- user/admin widzi kompletne UI, ale backend nie zapisuje danych;
- czesc toastow sukcesu jest falszywa;
- `INTERNAL_ERROR`, `[object Object]` i `You do not have access to this organization` trafiaja do UI;
- `/admin/*` i `/organization/*` moga prowadzic do niespojnych widokow;
- brak audit trail dla prob zapisu i zmian.

### 17B. Mapa przeplywow - Tenant Admin P32

| UI path | Sekcja | Domniemane endpointy | Wynik | Persist po refreshu | Toast / blad | Ryzyko |
|---|---|---|---|---|---|---|
| `/admin/overview` | Overview dashboard | `GET /api/admin/overview` | Nie laduje sie poprawnie; `Admin overview is unavailable` | N/A | `INTERNAL_ERROR` | P0 |
| `/admin/people` | People & Access | `/api/admin/people`, `/api/admin/access-codes` | `Add member` i `Generate code` nie dzialaja; brak pola email | Nie | Toast tylko `Enter an email address...` | P0 |
| `/admin/security` | Security & Identity | `/api/admin/security/policy`, `/api/admin/collaboration`, `/api/admin/api-keys`, `/api/admin/iam` | MFA/SSO/session/collaboration nie zapisuja sie | Nie | `INTERNAL_ERROR`, `You do not have access to this organization` | P0 |
| `/admin/billing` | Billing & FinOps | `/api/admin/billing/*` | Payment method, budgets, alerts zwracaja blad | Nie | `INTERNAL_ERROR` | P0 |
| `/admin/ai` | AI Governance & Operations | `/api/admin/ai/policy`, `/api/admin/ai/limits` | Policy/limits/features nie zapisuja sie; walidacje sa niespojnie | Nie | `Failed to save settings`, validation errors | P0 |
| `/admin/integrations` | Integrations & Sync | `/api/admin/integrations/connect/:provider` | `Connect` nie robi widocznej akcji | Nie | Brak | P1 |
| `/admin/audit` | Audit, Compliance & Risk | `/api/admin/audit` | Logi puste; retention days zapisuje sie czesciowo mimo bledu | Czesciowo | `INTERNAL_ERROR` mimo utrwalenia wartosci | P1 |
| `/admin/operations` | Organization Ops | `/api/admin/organization/domains` | Custom domain i approved email domain nie zapisuja sie | Nie | Brak | P1 |

Wnioski:

- zadna kluczowa sekcja P32 nie dziala w pelni;
- formularze sa niepelne, np. brak pola email przy `Add member`;
- `You do not have access to this organization` dla ownera wskazuje na blad organization scope / token / `organization_id`;
- jedyny czesciowy sukces to audit retention days, ale UI pokazuje blad mimo zapisu.

### 17C. Settings Persistence Matrix

| Sekcja | Sciezka | Wynik | Uwagi |
|---|---|---|---|
| Profile | `/settings/profile` | Nie persistuje | Zmiana zaimkow wraca do domyslnej; brak toasta sukcesu |
| Avatar & Photo | `/settings/avatar` | Nie persistuje | Avatar znika po zmianie zakladki albo refreshu |
| Email Signatures | `/settings/email-signatures` | Dziala | `TestSig` utrzymuje sie po refreshu; default signature pokazuje toast |
| Working Hours | `/settings/working-hours` | Dziala | Zmiana poniedzialku na `09:30` utrzymuje sie po refreshu |
| Work Preferences | settings work prefs | Nie persistuje | `Failed to save preferences` |
| Notifications | `/settings/notifications/*` | Niepotwierdzone / prawdopodobnie nie dziala | Wczesniejsze audyty wskazuja `Failed to save` albo brak efektu |
| Language / Regional | `/settings/regional-settings` | Nie persistuje | `Failed to save preferences`; UI miesza PL/EN |
| Security / MFA / Session | `/settings/security/*` | Nie persistuje | `INTERNAL_ERROR` |
| AI Model & Parameters | `/settings/model-parameters` | Falszywy sukces | Toast `saved`, ale wartosci wracaja po refreshu |
| AI Memory & Context | `/settings/ai-memory` | Falszywy sukces | Toast `AI memory settings saved`, ale stan wraca do domyslnego |
| AI Data & Privacy | `/settings/ai-privacy` | Nie persistuje | `Failed to save AI privacy settings` |
| Voice & TTS | `/settings/voice-tts` | Nie persistuje | `Failed to save voice settings`; brak wplywu na system |
| AI Usage Dashboard / Prompt Library | settings AI sections | Nie dziala | Sekcje puste albo bez zapisu |
| Import / Export Settings | settings import/export | Nie dziala | Eksportuje pusty JSON; import nie dziala |
| Templates | settings templates | Nie dziala | Tworzenie template nie zapisuje danych |

Wnioski:

- tylko Email Signatures i Working Hours sa realnie funkcjonalne;
- czesc settings pokazuje falszywy toast sukcesu;
- brakuje rozroznienia `read-only`, `draft`, `failed save`, `saved`;
- kazdy settings flow musi byc testowany po refreshu.

### 17D. P0 - bledy blokujace

1. **Podstawowe funkcje panelu admina sa martwe.** People, Security, Billing, AI, Integrations i Organization Ops nie wykonuja skutecznych zapisow.
2. **Settings udaja zapis.** Profile, Security i AI Settings potrafia pokazac toast, ale po refreshu wartosci wracaja.
3. **Brak albo zly backend contract.** `INTERNAL_ERROR` i `You do not have access to this organization` wskazuja na brak tras, zly org scope albo problem tenant isolation.
4. **Niepelne formularze.** `Add member` nie ma pola email, wiec operacja jest niemozliwa.
5. **Audit/security events nie dzialaja.** Logi sa puste, daty bledne, a retention zapisuje sie niespojnie z tostem.

### 17E. P1 - problemy wysokiego priorytetu

- Brak walidacji i jasnego feedbacku.
- Brak automatycznego refetchu po zmianie.
- AI Governance policy/limits/features nie zapisuja sie.
- Admin owner otrzymuje `You do not have access to this organization`.
- UI miesza jezyki i pokazuje surowe klucze albo angielskie fallbacki.
- Dzialajace sekcje Settings nie stanowia jeszcze wzorca dla reszty.

### 17F. P2 - problemy sredniego priorytetu

- Dlugie formularze wymagaja przewijania w dwoch osiach.
- Brak oznaczenia pol obowiazkowych.
- `0`, `n/a`, `Invalid Date` sa pokazywane bez komentarza.
- Brak historii zmian i audit log dla prob zapisu.
- Brak trybu offline/read-only przy braku backendu.

### 17G. Organization vs Admin routes

W aplikacji istnieja rownolegle sciezki:

- `/admin/*` - panel wlasciciela/admina organizacji;
- `/organization/*` - widoki organizacyjne.

Ryzyka:

- `/admin/people` i `/organization/members` moga reprezentowac ten sam workflow innymi komponentami;
- brak kanonicznego adresu prowadzi do dwoch niespojnych UI;
- bezposrednie wejscie w URL moze pokazac niedzialajacy ekran zamiast redirectu;
- manualne testy moga mylic admin P32 z organization panel.

Rekomendacja:

- wybrac jeden kanoniczny flow;
- drugi adres przekierowac albo ukryc;
- jesli oba zostaja, jasno opisac roznice zakresu i roli.

### 17H. API Hygiene Findings

Problemy:

- UI pokazuje `[object Object]` i `INTERNAL_ERROR`;
- czesc operacji prawdopodobnie uzywa surowego `fetch('/api/...')`;
- brakuje centralnego `handleResponse`/error mappera w admin/settings;
- brak retry i timeout messaging;
- SCIM endpoint `api/scim/admin/service-provider` zwraca `NOT_FOUND` bez sensownego fallbacku;
- placeholdery `0`, `n/a`, `Nieznany`, `NaN`, `Invalid Date` sa widoczne w produkcyjnym UI;
- owner organizacji widzi `You do not have access to this organization`, co wskazuje na blad tokena albo `organization_id`;
- w wielu mutacjach brakuje toastow.

Wymagane:

- wszystkie admin/settings calls przez jeden service layer;
- jeden error mapper;
- brak surowego `[object Object]`;
- testy error mappingu;
- jawny `feature unavailable` zamiast udawanego zapisu.

### 17I. Missing tests

Brakuje:

- e2e dla panelu admina: add/edit user, generate code, save policies;
- testow walidacji formularzy: email, required fields, daty, limity;
- testow settings persistence po reloadzie;
- testow uprawnien: admin nie edytuje innych org, user nie widzi admin tabs;
- testow API error handling: `INTERNAL_ERROR`, `[object Object]`, `NOT_FOUND`;
- testow integracyjnych backendu dla `/api/admin/*`;
- testow i18n i surowych kluczy;
- testow audit log przy mutacjach.

### 17J. Recommended Fix Order

1. **Naprawic Tenant Admin P32 P0.** Dodac/naprawic endpointy `adminP32.routes.ts` dla members, access codes, security policy, billing, AI limits i integrations. Ukryc funkcje bez backendu.
2. **Zapewnic trwalosc Settings.** Ustalic scope user/org/global i naprawiac sekcje wedlug macierzy: najpierw Profile, Security, AI Model, AI Memory, Regional.
3. **Wprowadzic globalna obsluge bledow i walidacje.** Wszystkie requesty przez jeden helper; brak `[object Object]`; jasne komunikaty.
4. **Ujednolicic `/admin/*` i `/organization/*`.** Jeden kanoniczny flow albo jasne redirecty.
5. **Zaimplementowac audit i logi.** Kazda proba zapisu i zmiana admin/settings powinna miec audit trail.
6. **Dodac testy automatyczne.** E2E + integration dla admin panel i settings persistence.
7. **Wprowadzic i18n cleanup.** Usunac mieszanie jezykow i surowe klucze.

### 17K. Podsumowanie

Tenant Admin P32 i wiekszosc Settings sa w fazie wczesnej implementacji albo nie sa obslugiwane backendowo. UI wyglada na kompletne, ale w praktyce nie zapisuje danych i nie komunikuje bledow poprawnie. To tworzy falszywe poczucie bezpieczenstwa i prowadzi do frustracji.

Najwazniejszy standard na dalsze prace:

- jesli funkcja nie ma backendu, ukryc ja albo oznaczyc `in progress`;
- jesli przycisk `Save` jest widoczny, zmiana musi przetrwac refresh;
- jesli backend zwraca blad, UI musi pokazac czytelny komunikat;
- jesli admin zmienia dane tenantowe, musi powstac audit log.

## 18. Program napraw Admin / SuperAdmin / Settings

> Status: glowny program wykonawczy po audytach 11-17.
> Cel: zamienic szeroka, czesciowo szkieletowa konsole administracyjna w wiarygodne narzedzie operacyjne.
> Zakres: login, role, admin P32, superadmin, settings, billing, security, connectors, governance, AI operations, audit, testy i UX.
> Zasada nadrzedna: `visible = working or honest`.

### 18A. Diagnoza

Audyt pokazal, ze Consultify ma bardzo szeroki interfejs administracyjny, ktory wizualnie opisuje docelowy produkt. Problem nie lezy w ambicji ani architekturze produktu, tylko w rozjezdzie dojrzalosci:

- UI pokazuje wiele funkcji jako gotowe;
- backend i kontrakty nie zawsze istnieja albo nie zapisuja danych;
- czesc akcji pokazuje falszywy sukces;
- czesc widokow ukrywa blad pod zerami, `n/a`, `NaN`, `Invalid Date`;
- role admin/superadmin/user nie maja jeszcze jednego, twardego modelu dostepu i widocznosci;
- mutacje nie maja wspolnego standardu: walidacja, toast, refetch, audit, test.

Dlatego program napraw nie moze byc lista "popraw ekran X". To musi byc stabilizacja calej warstwy administracyjnej.

### 18B. Zasady programu

1. **Visible = working or honest.** Widoczna funkcja musi dzialac, byc read-only, disabled z wyjasnieniem albo ukryta.
2. **No fake success.** Toast sukcesu jest dozwolony tylko wtedy, gdy backend potwierdzil zapis, a UI odswiezyl stan.
3. **Refresh is truth.** Kazda mutacja musi przetrwac refresh strony.
4. **Audit for admin mutations.** Kazda istotna akcja admin/superadmin musi zapisac audit event.
5. **One error language.** Uzytkownik nie moze widziec `[object Object]`, surowego JSON ani golego `INTERNAL_ERROR`.
6. **Scope is explicit.** Kazde ustawienie ma zakres: `user`, `organization`, `tenant admin`, `superadmin global`.
7. **Security before convenience.** API keys, backup, billing, SSO, SCIM, DLP, approval i compliance nie moga byc atrapami.
8. **Read-only is acceptable. Fake write is not.** Lepszy uczciwy panel read-only niz formularz, ktory udaje zapis.
9. **Tests follow risk.** Najpierw testujemy logowanie, role, users/orgs, billing, settings persistence, audit i security.

### 18C. Decision gate dla kazdej widocznej akcji

Kazdy przycisk, formularz i akcja w admin/superadmin/settings przechodzi przez jedna decyzje:

| Decyzja | Znaczenie | Kiedy uzyc |
|---|---|---|
| `FIX NOW` | Naprawiamy UI, backend, zapis, audit i test. | Core admin, billing, users, security, access, settings persistence. |
| `READ-ONLY` | Widok zostaje, ale bez akcji zapisu. | Runtime, dashboards, AI diagnostics, compliance summaries bez backendu mutacji. |
| `DISABLE WITH REASON` | Przycisk widoczny, ale nieaktywny z opisem. | Funkcja planowana, ale istotna kontekstowo. |
| `HIDE` | Ukrywamy z UI. | Funkcja krytyczna, ktora nie dziala i moze wprowadzac w blad. |

Minimalna karta decyzji:

```text
UI action:
Role:
Current state:
Backend endpoint:
Persists after refresh:
Audit:
Decision: FIX NOW / READ-ONLY / DISABLE WITH REASON / HIDE
Owner:
Test required:
```

### 18D. Program etapowy

#### Faza 0 - Triage, degradacja i uczciwy UI

Cel: natychmiast ograniczyc ryzyko funkcji pozornych.

Zakres:

- oznaczyc albo ukryc niedzialajace funkcje P0;
- dodac `Feature unavailable`, `Read-only diagnostic view`, `No data yet`, `Telemetry unavailable`;
- usunac falszywe toasty sukcesu;
- zastapic `[object Object]`, `INTERNAL_ERROR`, `Invalid Date`, `NaN` czytelnymi stanami;
- wprowadzic centralna liste feature availability dla admin/superadmin/settings;
- zablokowac destrukcyjne akcje bez backendu: API keys, backup restore, DR test, legal publish, DSAR, approvals, billing create.

Zadania:

- `F0-01`: stworzyc macierz wszystkich widocznych akcji admin/superadmin/settings.
- `F0-02`: oznaczyc kazda akcje decyzja `FIX NOW`, `READ-ONLY`, `DISABLE WITH REASON`, `HIDE`.
- `F0-03`: dodac wspolne komponenty `UnavailableState`, `ReadOnlyBadge`, `DegradedState`.
- `F0-04`: usunac falszywe success toasts z przeplywow, ktore nie potwierdzaja zapisu.
- `F0-05`: zamienic `NaN`, `Invalid Date`, gole `n/a` na jawne formatery.
- `F0-06`: dodac quick smoke route checklist dla najwiekszych P0.

Definition of Done:

- zaden widoczny P0 przycisk nie udaje dzialajacego;
- user widzi, czy funkcja jest live, read-only, degraded albo unavailable;
- bledy backendu nie renderuja sie jako `[object Object]`;
- wszystkie znane `NaN` i `Invalid Date` maja fallback.

### 18E. Faza 1 - Identity, Access, Users, Organizations

Cel: podstawowa administracja tenantami i uzytkownikami dziala.

Zakres:

- login/sesja/role;
- users CRUD;
- organization CRUD;
- access requests;
- access codes;
- invite/resend/reset password;
- role/status/move user;
- tenant isolation.

Zadania:

- `F1-01`: naprawic login dla superadmin, admin/owner, user/agent.
- `F1-02`: dodac jasny expired session flow i blad logowania.
- `F1-03`: ujednolicic macierz rol: user, agent, admin/owner, superadmin.
- `F1-04`: naprawic create/edit/delete user.
- `F1-05`: naprawic invite user, resend invite, reset password albo ukryc, jesli nie gotowe.
- `F1-06`: naprawic role/status change i move user between organizations.
- `F1-07`: naprawic organization update: name, plan, status, discount.
- `F1-08`: naprawic access requests approve/reject.
- `F1-09`: naprawic access codes: code, expiry, max uses, role, organization.
- `F1-10`: dodac test tenant isolation: admin nie widzi/nie edytuje cudzej organizacji.

Endpointy i obszary:

- `/api/superadmin/users/*`;
- `/api/superadmin/organizations/*`;
- `/api/superadmin/access-requests/*`;
- `/api/superadmin/access-codes/*`;
- `/api/organizations/:orgId/members`;
- `/api/access-control/codes`.

Definition of Done:

- kazda mutacja user/org/access ma toast, audit i refetch;
- zmiana przetrwa refresh;
- niedozwolona rola widzi 403 albo ukryta nawigacje, nie pusty ekran;
- backend waliduje payload i enumy;
- test e2e pokrywa create user, invite/access code, update org i role change.

### 18F. Faza 2 - Settings Persistence i Tenant Admin P32

Cel: admin organizacji i user maja realne ustawienia.

Zakres:

- `/admin/*`;
- `/settings/*`;
- `/organization/*` vs `/admin/*`;
- user/org/global settings;
- admin people/security/billing/ai/audit/operations.

Zadania:

- `F2-01`: ustalic kanoniczne trasy: `/admin/*` vs `/organization/*`.
- `F2-02`: przekierowac albo ukryc duplikaty organization panel.
- `F2-03`: naprawic `/admin/overview`.
- `F2-04`: naprawic `/admin/people`: add member, generate code, remove/change role.
- `F2-05`: naprawic `/admin/security`: security policy, collaboration, API access, IAM.
- `F2-06`: naprawic `/admin/billing`: payment methods, budgets, alerts, tax.
- `F2-07`: naprawic `/admin/ai`: AI policy, limits, features.
- `F2-08`: naprawic `/admin/integrations`: connect provider albo read-only.
- `F2-09`: naprawic `/admin/audit`: logs, retention, dates, export.
- `F2-10`: naprawic `/admin/operations`: custom domains, approved email domains, branding.
- `F2-11`: settings profile persistence.
- `F2-12`: settings avatar persistence.
- `F2-13`: settings regional/language persistence.
- `F2-14`: settings security/MFA/session persistence.
- `F2-15`: settings AI model, memory, privacy persistence.
- `F2-16`: settings voice/TTS persistence albo read-only.
- `F2-17`: zachowac i rozszerzyc dzialajacy wzorzec Email Signatures i Working Hours.

Definition of Done:

- kazda sekcja settings ma okreslony scope: user/org/global;
- `Save` zapisuje i przetrwa refresh;
- falszywe toasty sukcesu usuniete;
- `/admin/*` i `/organization/*` nie dubluja niespojnych flows;
- admin P32 ma audit log dla zmian;
- test e2e potwierdza persist po reloadzie dla minimum 5 krytycznych settings.

### 18G. Faza 3 - Billing, Commercial, Usage, Limits

Cel: finanse i usage przestaja byc szkieletem.

Zakres:

- plans;
- invoices;
- tax rates;
- payment methods;
- discounts;
- contracts;
- subscriptions;
- usage;
- AI budgets;
- operational costs.

Zadania:

- `F3-01`: naprawic endpoint mismatch `operational-costs`.
- `F3-02`: naprawic create/list/update plans.
- `F3-03`: naprawic create/list/update invoices.
- `F3-04`: zastapic tekstowy `Organization ID` selectorem organizacji.
- `F3-05`: naprawic tax rates create/list/delete.
- `F3-06`: naprawic payment methods add/remove.
- `F3-07`: naprawic discounts i org plan/status persistence.
- `F3-08`: naprawic usage endpoints: tokens, storage, CPU, memory, costs.
- `F3-09`: naprawic budgets i alerts.
- `F3-10`: rozroznic `0`, `no data`, `unlimited`, `error`.
- `F3-11`: naprawic MRR/ARR i revenue dashboards albo oznaczyc jako unavailable.
- `F3-12`: dodac test faktury, tax rate, budget limit i operational costs.

Definition of Done:

- faktura, plan, tax rate i budget tworza rekord;
- wartosci finansowe maja walute, format i walidacje;
- `NaN%` nie wystepuje;
- po refreshu dane zostaja;
- billing actions maja audit log;
- endpointy zwracaja czytelny blad, nie puste zera.

### 18H. Faza 4 - Security, Audit, Compliance Core

Cel: bezpieczenstwo i zgodnosc maja realne dane, audit trail i brak atrap.

Zakres:

- MFA;
- SSO;
- SCIM;
- password policy;
- IP whitelist;
- sessions;
- audit logs/events;
- incidents;
- threats;
- DLP;
- AI budgets security;
- privileged sessions;
- approvals.

Zadania:

- `F4-01`: naprawic centralny error mapper dla security.
- `F4-02`: naprawic password policy save i persist.
- `F4-03`: naprawic IP whitelist add/delete.
- `F4-04`: naprawic MFA methods load albo oznaczyc unavailable.
- `F4-05`: naprawic SSO config save albo read-only.
- `F4-06`: naprawic SCIM service provider i tokens albo read-only.
- `F4-07`: naprawic roles/permissions definitions.
- `F4-08`: naprawic admin sessions.
- `F4-09`: naprawic audit logs/events i `Invalid Date`.
- `F4-10`: naprawic approval workflows: create, approve, reject, escalate.
- `F4-11`: naprawic incidents/threats create/list/status.
- `F4-12`: naprawic DLP policy create/list/delete.
- `F4-13`: naprawic SCIM multitenancy: `organization_id`, filters, tests.

Definition of Done:

- security actions nie zwracaja `[object Object]`;
- wszystkie daty audytu sa poprawne;
- kazda mutacja security ma audit log;
- admin nie widzi danych innego tenanta;
- funkcje bez backendu sa read-only albo hidden.

### 18I. Faza 5 - Connector Ops, Integrations, Backup, API Keys

Cel: operacje integracyjne i klucze przestaja byc pozorne.

Zakres:

- integrations catalog;
- connected integrations;
- webhooks;
- API keys;
- feature flags;
- system health;
- connector audit log;
- backup/restore/DR;
- reports.

Zadania:

- `F5-01`: ustalic relacje Admin V8 Sync Hub vs SuperAdmin Connector Ops.
- `F5-02`: naprawic integrations catalog i connect/configure.
- `F5-03`: naprawic connected integrations list/status.
- `F5-04`: naprawic webhook create/edit/test/delete.
- `F5-05`: naprawic API keys create/reveal once/copy/revoke/rotate.
- `F5-06`: naprawic feature flags CRUD.
- `F5-07`: naprawic connector audit log i analytics.
- `F5-08`: naprawic backup create/list/status.
- `F5-09`: naprawic restore i DR test jako joby albo ukryc.
- `F5-10`: naprawic report generate/schedule albo ukryc.

Definition of Done:

- API key secret pokazuje sie tylko raz;
- webhook test pokazuje status HTTP/latency/result;
- backup i DR sa jobami z realnym statusem;
- connector actions sa audytowane;
- brak pozornych `Connect`, `Create Webhook`, `Create Backup`.

### 18J. Faza 6 - Governance & Compliance

Cel: governance staje sie realnym systemem dowodowym, a nie dashboardem.

Zakres:

- audit timeline;
- approvals;
- compliance frameworks;
- controls;
- DSAR;
- audits;
- processing records;
- exports & retention;
- legal policies;
- privileged sessions.

Zadania:

- `F6-01`: naprawic audit timeline: data ISO, filters, pagination, details.
- `F6-02`: naprawic approvals queue i workflows.
- `F6-03`: naprawic DSAR create/list/status.
- `F6-04`: naprawic schedule audit i audit list.
- `F6-05`: naprawic compliance controls edit i remediation actions.
- `F6-06`: naprawic processing records.
- `F6-07`: naprawic exports jako joby.
- `F6-08`: naprawic retention policies z preview wplywu.
- `F6-09`: naprawic legal policies draft/version/publish/rollback.
- `F6-10`: naprawic privileged sessions start/end/audit trail.

Definition of Done:

- kazda compliance action zapisuje dane;
- audit timeline pokazuje poprawne daty i szczegoly;
- legal publish wymaga approval albo confirm;
- DSAR i audits maja lifecycle status;
- funkcje regulacyjne bez backendu sa ukryte.

### 18K. Faza 7 - AI Operations

Cel: AI Operations przestaje byc makieta i dzieli sie na configuration, runtime i analytics.

Zakres:

- LLM Providers;
- Model Tiers;
- Routing Rules;
- Purposes & Assignments;
- Org AI Policy;
- AI Governance;
- Prompt Builder;
- Prompt Assistant;
- Learning System;
- Experiments;
- Model Registry;
- Health Monitoring;
- Pricing Registry;
- Custom Reports;
- Policy Plane.

Zadania:

- `F7-01`: naprawic Add Provider.
- `F7-02`: naprawic Clone Provider.
- `F7-03`: naprawic delete/update provider z toast/refetch.
- `F7-04`: dodac toasty Model Tiers i zapis kolejnosci.
- `F7-05`: naprawic Routing Rules CRUD.
- `F7-06`: naprawic Purposes & Assignments.
- `F7-07`: naprawic Org AI Policy draft/publish/history/rollback.
- `F7-08`: naprawic AI Governance switches persistence.
- `F7-09`: naprawic Prompt Assistant albo zablokowac bez aktywnego modelu.
- `F7-10`: uruchomic Prompt Templates i Block Builder MVP.
- `F7-11`: naprawic Test Bench.
- `F7-12`: naprawic Experiments i Model Registry albo read-only.
- `F7-13`: naprawic Health Monitoring providerow.
- `F7-14`: naprawic Pricing Registry snapshot create.
- `F7-15`: naprawic Custom Reports create/list/export.

Definition of Done:

- konfiguracja AI zapisuje sie po refreshu;
- read-only runtime widoki maja timestamp i source;
- analytics rozroznia no data/error/zero;
- Prompt Assistant odpowiada albo jasno komunikuje brak konfiguracji;
- routing da sie zasymulowac: purpose + tier -> selected model.

### 18L. Faza 8 - UX, i18n, polish and confidence

Cel: aplikacja wyglada i zachowuje sie jak narzedzie, nie jak demo.

Zakres:

- i18n;
- toasty;
- empty/error/loading;
- long forms;
- horizontal scroll;
- dates/numbers/currency;
- destructive confirmations;
- source/timestamp labels.

Zadania:

- `F8-01`: usunac surowe klucze tlumaczen.
- `F8-02`: ujednolicic jezyk UI.
- `F8-03`: zastapic native `alert()` i `confirm()` modalami/toastami.
- `F8-04`: dodac standard `No data yet`.
- `F8-05`: dodac standard `Telemetry unavailable`.
- `F8-06`: dodac source/timestamp do dashboardow.
- `F8-07`: poprawic formaty dat, liczb, walut.
- `F8-08`: usunac poziomy scroll tam, gdzie ukrywa zakladki.
- `F8-09`: dodac required markers i walidacje inline.
- `F8-10`: dodac smoke checklist per modul.

Definition of Done:

- brak mieszania PL/EN w jednym widoku;
- brak `NaN`, `Invalid Date`, golego `n/a`;
- wszystkie puste widoki maja opis i CTA albo reason;
- destrukcyjne akcje maja modal confirm;
- user rozumie, czy patrzy na realne dane, brak danych czy blad.

### 18M. Standard implementacyjny dla kazdego zadania

Kazde zadanie naprawcze musi zawierac:

1. **UI path** - gdzie user klika.
2. **Role** - superadmin/admin/user.
3. **Component** - plik frontendowy.
4. **API method** - metoda service layer.
5. **Endpoint** - backend route.
6. **Validation** - frontend i backend.
7. **Persistence** - tabela/rekord/ustawienie.
8. **Audit** - event z aktorem, org, action, target.
9. **Toast** - success/error.
10. **Refetch** - albo lokalny update.
11. **Refresh proof** - potwierdzenie po reloadzie.
12. **Tests** - unit/integration/e2e wedlug ryzyka.

Template zadania:

```text
id:
title:
phase:
priority:
roles:
ui_paths:
frontend_files:
api_methods:
backend_routes:
db_tables:
current_problem:
decision:
implementation_steps:
validation:
audit_event:
test_plan:
definition_of_done:
manual_smoke:
```

### 18N. Test gates

#### Gate 1 - Route renders

- route laduje sie dla uprawnionej roli;
- niedozwolona rola dostaje 403/redirect/hidden nav;
- nie ma czarnego ekranu.

#### Gate 2 - Mutation works

- payload jest walidowany;
- backend zapisuje;
- UI pokazuje toast;
- lista/karta odswieza sie.

#### Gate 3 - Refresh proof

- po refreshu zmiana nadal istnieje;
- nie ma falszywego success.

#### Gate 4 - Audit proof

- mutacja admin/superadmin tworzy audit event;
- daty sa poprawne;
- event jest widoczny w odpowiednim audit view.

#### Gate 5 - Error proof

- backend error pokazuje czytelny komunikat;
- validation error pokazuje pola;
- network error pokazuje retry/degraded;
- UI nie renderuje `[object Object]`.

### 18O. Minimalny test pack przed kazdym merge

P0 task wymaga minimum:

- unit walidacji payload;
- integration endpoint success;
- integration endpoint validation error;
- component test empty/error/success;
- e2e happy path;
- e2e refresh proof.

P1 task wymaga minimum:

- unit albo component;
- integration endpoint;
- manual smoke z refresh proof.

P2 task wymaga minimum:

- lint;
- visual/manual smoke;
- brak regresji w smoke route.

### 18P. Kolejnosc uruchomienia prac

1. **Start sprint: Faza 0 + error mapper.**
2. **Core sprint: Faza 1 Identity/Access.**
3. **Admin sprint: Faza 2 Tenant Admin P32 + Settings.**
4. **Money sprint: Faza 3 Billing/Usage.**
5. **Security sprint: Faza 4 Security/Audit.**
6. **Ops sprint: Faza 5 Connector Ops/API Keys/Backup.**
7. **Governance sprint: Faza 6 Governance/Compliance.**
8. **AI Ops sprint: Faza 7 AI Operations.**
9. **Polish sprint: Faza 8 UX/i18n.**

### 18Q. Pierwsza paczka implementacyjna

Pierwszy realny pakiet pracy powinien byc maly, ale systemowy:

1. Centralny error mapper dla admin/superadmin/settings.
2. `UnavailableState`, `ReadOnlyBadge`, `DegradedState`.
3. Formatery `safeDate`, `safeNumber`, `safePercent`, `safeMoney`.
4. Feature availability map dla P0 akcji.
5. Ukrycie/degradacja najbardziej ryzykownych atrap:
   - API keys create/revoke/rotate, jesli nie dziala;
   - backup/restore/DR;
   - legal publish;
   - DSAR create;
   - approvals approve/reject;
   - billing create invoice/plan/tax, jesli endpoint nie zapisuje;
   - Prompt Builder/Model Registry, jesli read-only.
6. Test error mappera i smoke trzech krytycznych routes.

Cel pierwszej paczki:

- aplikacja przestaje udawac, ze niedzialajace rzeczy dzialaja;
- user dostaje uczciwe stany;
- kolejne fazy moga naprawiac funkcje bez chaosu.

### 18R. Finalna definicja sukcesu programu

Program mozna uznac za zakonczony, gdy:

- kazdy widoczny przycisk admin/superadmin/settings ma realny efekt albo jasny status unavailable/read-only;
- wszystkie P0 przeplywy dzialaja i przetrwaja refresh;
- users/orgs/access/settings/billing/security maja audit trail;
- admin nie moze naruszyc izolacji tenantowej;
- dashboardy rozrozniaja `no data`, `zero`, `error`, `degraded`;
- UI nie pokazuje `[object Object]`, `Invalid Date`, `NaN`;
- testy e2e pokrywaja login, user/org CRUD, settings persistence, billing create, security policy, audit;
- dokumentacja i nawigacja nie obiecuja funkcji, ktore nie istnieja.

## 19. Launch readiness - start wdrozenia z 4 agentami

> Status: przygotowanie do uruchomienia agentow implementacyjnych.
> Cel: wejsc w naprawy bez chaosu, konfliktow plikow i rozjechania kontraktow.
> Zasada: najpierw stabilizujemy wspolny backbone, potem rownolegle domykamy moduly.

### 19A. Co trzeba ustalic przed pierwszym commitem

Przed startem agentow trzeba przyjac te decyzje jako obowiazujace:

1. **Nie naprawiamy wszystkiego naraz.** Pierwszy sprint ma usunac falszywe akcje, poprawic error handling i domknac core flows.
2. **Wspolne pliki maja wlasciciela.** `src/services/api.ts`, shared UI states i formatery nie moga byc edytowane jednoczesnie przez kilku agentow bez koordynacji.
3. **Kazdy agent pracuje w swojej domenie.** Jesli musi dotknac cudzej domeny, zapisuje to jako dependency albo robi minimalny adapter.
4. **Kazdy visible write musi miec refresh proof.** Bez tego task nie jest skonczony.
5. **Nie dodajemy nowych makiet.** Jesli backend nie jest gotowy, funkcja dostaje read-only/unavailable/hidden state.

### 19B. Wspolny kontrakt implementacyjny

Kazdy agent ma stosowac ten sam kontrakt:

```text
Mutation = validate -> call API -> backend validates -> persist -> audit -> response -> toast -> refetch -> refresh proof
```

Kazdy endpoint admin/superadmin/settings powinien zwracac bledy w ksztalcie:

```json
{
  "error": "Human readable message",
  "code": "VALIDATION_ERROR",
  "details": {}
}
```

Frontend nie moze pokazywac:

- `[object Object]`;
- surowego JSON;
- golego `INTERNAL_ERROR`;
- `Invalid Date`;
- `NaN`;
- sukcesu bez potwierdzonego zapisu.

### 19C. Podzial na 4 agentow - pierwszy wave

#### Agent A - Backbone, API hygiene i honest UI

Cel: przygotowac fundament, z ktorego korzystaja pozostali agenci.

Zakres:

- centralny error mapper;
- shared states: loading, empty, error, degraded, unavailable, read-only;
- safe formatters: date, number, percent, money;
- usuniecie najgorszych `[object Object]`, `NaN`, `Invalid Date`;
- feature availability map dla P0 akcji;
- standard toast/refetch dla nowych mutacji.

Pliki startowe:

- `src/services/api.ts`;
- `src/services/api/baseClient.ts`;
- `src/services/api/settings.api.ts`;
- `src/components/common/*`;
- `src/components/ui/*`;
- shared helpers w `src/utils/*`;
- ewentualnie testy helperow.

Nie dotykac bez potrzeby:

- duzych widokow billing/security/governance;
- backend domenowy innych agentow;
- masowego refaktoru `api.ts`.

DoD:

- istnieje jeden helper mapujacy bledy backendu do czytelnego tekstu;
- istnieja komponenty albo wzorce `UnavailableState`, `ReadOnlyBadge`, `DegradedState`;
- istnieja safe formatters;
- minimum 3 najgorsze klasy bledow sa pokryte testem;
- dokumentacja uzycia helperow jest widoczna w kodzie albo komentarzu.

Pierwszy test pack:

- unit error mapper;
- unit safeDate/safePercent;
- component empty/error/degraded state;
- lint dotknietych plikow.

#### Agent B - Identity, Access, Tenant Admin P32 i Settings

Cel: admin i user moga wykonywac podstawowe operacje oraz settings przestaja udawac zapis.

Zakres:

- login/sesja/role tylko jesli wymagane przez admin/settings;
- `/admin/people`;
- `/admin/security`;
- `/admin/audit`;
- `/admin/operations`;
- `/settings/profile`;
- `/settings/regional-settings`;
- `/settings/security/*`;
- `/settings/model-parameters`;
- `/settings/ai-memory`;
- `/settings/ai-privacy`;
- `/organization/*` vs `/admin/*` kanonicznosc.

Pliki startowe:

- `src/views/admin/AdminSettingsModule.tsx`;
- `src/views/admin/*`;
- `src/views/OrganizationView.tsx`;
- `src/components/settings/*`;
- `src/services/api.ts`;
- `src/services/api/settings.api.ts`;
- `server/src/routes/adminP32.routes.ts`;
- `server/src/routes/settings.routes.ts`;
- user/org routes wedlug potrzeb.

Nie dotykac bez koordynacji:

- billing superadmin;
- Connector Ops;
- Governance;
- AI Operations.

DoD:

- admin P32 ma minimum dzialajace: people list/action albo uczciwy unavailable state;
- settings profile/regional/security/AI ma albo persistence, albo read-only/unavailable;
- falszywe success toasts w settings sa usuniete;
- `/admin/*` vs `/organization/*` ma jasna decyzje: redirect/merge/keep separate;
- minimum 2 settings sekcje przechodza refresh proof poza juz dzialajacymi Email Signatures i Working Hours.

Pierwszy test pack:

- e2e/manual smoke settings persistence;
- integration `/api/admin/security` albo wybrany endpoint P32;
- component test false success/error state;
- tenant isolation smoke.

#### Agent C - Billing, Commercial, Usage i Limits

Cel: pieniadze, plany, faktury i usage przestaja byc pustymi kartami.

Zakres:

- plans;
- invoices;
- tax rates;
- contracts;
- payment methods;
- discounts;
- usage/limits/budgets;
- operational costs endpoint mismatch;
- MRR/ARR/revenue zero states.

Pliki startowe:

- `src/views/superadmin/InvoiceCenterView.tsx`;
- `src/views/superadmin/revenue/*`;
- `src/views/superadmin/RevenueModule.tsx`;
- `src/views/superadmin/AIBudgetsView.tsx`;
- `src/views/superadmin/OrganizationResourceManager.tsx`;
- billing/admin panels;
- `src/services/api.ts`;
- `server/src/routes/billing/billing.routes.ts`;
- `server/src/routes/superadmin.routes.ts`;
- billing services/controllers.

Nie dotykac bez koordynacji:

- settings persistence;
- security/DLP;
- connector API keys;
- AI provider configuration.

DoD:

- naprawiony `operational-costs` mismatch;
- create invoice/plan/tax rate ma decyzje: fix now albo unavailable;
- `NaN%` i falszywe `0` w billing/usage zastapione uczciwymi stanami;
- minimum jedna finansowa mutacja zapisuje rekord i przechodzi refresh proof;
- brak tekstowego `Organization ID` tam, gdzie powinien byc selector, albo funkcja disabled z reason.

Pierwszy test pack:

- integration operational costs endpoint;
- component safe money/percent state;
- e2e/manual create invoice albo tax rate;
- lint dotknietych plikow.

#### Agent D - Security, Connector Ops, Governance i AI Ops degradacja

Cel: zabezpieczyc najwieksze atrapy operacyjne i regulatoryjne przed wprowadzaniem admina w blad.

Zakres pierwszego wave:

- nie pelna implementacja wszystkiego;
- degradacja/ukrycie/read-only dla P0 atrap;
- API keys;
- webhooks;
- backup/restore/DR;
- approvals;
- DSAR;
- audit timeline `Invalid Date`;
- Prompt Builder/Model Registry/Pricing Registry jesli nie dzialaja;
- security incidents/threats/DLP jako unavailable albo fix minimalny.

Pliki startowe:

- `src/views/superadmin/SystemModule.tsx`;
- `src/components/SuperAdmin/system/*`;
- `src/views/superadmin/GovernanceModule.tsx`;
- `src/views/superadmin/SecurityModule.tsx`;
- `src/views/superadmin/AIPlatformModule/*`;
- `src/services/api.ts`;
- `server/src/routes/superadmin.routes.ts`;
- connector/governance/security routes.

Nie dotykac bez koordynacji:

- billing flow;
- admin P32 settings;
- shared error mapper, jesli Agent A go wlasnie przebudowuje.

DoD:

- najbardziej ryzykowne P0 akcje sa fix now albo niedostepne z wyjasnieniem;
- `Invalid Date` w audit timeline nie jest renderowane;
- API keys/backup/webhooks nie udaja dzialajacych;
- Prompt Builder/Model Registry maja read-only/coming soon jesli brak backendu;
- minimum 3 P0 atrapy zdegradowane uczciwie.

Pierwszy test pack:

- component unavailable/read-only state;
- manual smoke Connector Ops tabs;
- manual smoke Governance tabs;
- lint dotknietych plikow.

### 19D. Kolejnosc pracy agentow

Rekomendowany start:

1. **Agent A startuje pierwszy** i przygotowuje error mapper + states + formatters.
2. **Agent B i C startuja po szkielecie A** albo pracuja tylko w swoich backendach, nie dotykajac wspolnych helperow.
3. **Agent D startuje od degradacji UI**, bez przebudowy service layer.
4. Po pierwszym merge robimy smoke i dopiero wtedy rozszerzamy zakres fixow.

Jesli pracujemy rownolegle bez merge:

- Agent A nie robi wielkiego refaktoru `api.ts`;
- Agent B/C/D dodaja minimalne adaptery w swoich domenach;
- konflikty w `api.ts` rozwiazuje jedna osoba po zakonczeniu wave.

### 19E. Pliki wysokiego konfliktu

Te pliki powinny miec jednego wlasciciela na wave:

- `src/services/api.ts` - Agent A jako owner kontraktu.
- `server/src/routes/superadmin.routes.ts` - dzielic tylko przez jasno oznaczone sekcje.
- `server/src/routes/adminP32.routes.ts` - Agent B.
- `server/src/routes/billing/billing.routes.ts` - Agent C.
- `src/views/superadmin/AIPlatformModule/*` - Agent D.
- `src/views/superadmin/SystemModule.tsx` - Agent D.
- `src/views/superadmin/GovernanceModule.tsx` - Agent D.
- `src/views/superadmin/SecurityModule.tsx` - Agent D.
- `docs/AI_dev_fin.md` - nie edytowac w trakcie implementacji, chyba ze user poprosi.

### 19F. Daily merge gate dla 4 agentow

Kazdy agent po swojej paczce musi podac:

```text
Changed files:
Flows fixed:
Flows degraded/hidden:
Endpoints touched:
Audit added:
Refresh proof:
Tests run:
Known risks:
Next dependency:
```

Nie merge'ujemy paczki, jesli:

- dodaje nowy falszywy success;
- zostawia `[object Object]`;
- pokazuje `NaN` albo `Invalid Date`;
- dodaje widoczny przycisk bez backendu i bez unavailable/read-only state;
- nie ma testu albo manual smoke dla P0.

### 19G. Pierwszy wspolny backlog startowy

Pierwszy wave, zanim wejdziemy w pelne wdrazanie:

1. `START-01`: error mapper i safe formatters.
2. `START-02`: unavailable/read-only/degraded states.
3. `START-03`: feature availability map dla P0 akcji.
4. `START-04`: settings false-success cleanup dla AI/Profile/Security.
5. `START-05`: operational-costs endpoint mismatch.
6. `START-06`: admin P32 owner scope error investigation.
7. `START-07`: degrade API keys/backup/webhooks/legal/DSAR/approvals, jesli backend nie gotowy.
8. `START-08`: smoke test matrix dla login/admin/settings/billing/security.

### 19H. Gotowosc do startu

Mozemy startowac, gdy:

- rozdzial 18 i 19 sa zaakceptowane jako program pracy;
- kazdy agent ma przypisany workstream;
- ustalono, kto jest wlascicielem `api.ts`;
- pierwszy wave nie wymaga jednoczesnego przepisywania tych samych plikow;
- mamy zgode, ze funkcje bez backendu beda ukrywane albo degradowane, nie pozostawiane jako martwe przyciski.

## 20. Finalny plan rozwoju i stabilizacji Admin / SuperAdmin

> Status: plan operacyjny przed finalizacja wdrozenia.
> Powod dopisania: testy manualne pokazaly, ze duza czesc admin/superadmin/settings jest jeszcze szkieletem narzedzia, a nie gotowa konsola operacyjna.
> Cel: wejsc w implementacje z pelna widocznoscia sytuacji, kolejka decyzji i mierzalnymi bramkami gotowosci.

### 20A. Prawda startowa

Na ten moment nie traktujemy paneli admin/superadmin/settings jako prawie gotowych. Traktujemy je jako szeroki, ambitny szkielet produktu, ktory ma juz:

- docelowa nawigacje;
- duza czesc ekranow i tabel;
- czesc realnych endpointow;
- czesc realnych przeplywow settings;
- czesc paneli diagnostycznych;
- material audytowy i liste znanych luk.

Ale nie ma jeszcze gwarancji, ze:

- kazdy przycisk ma realny efekt;
- kazdy zapis utrzymuje sie po refreshu;
- kazda mutacja ma audit trail;
- kazdy blad jest czytelny;
- kazdy dashboard rozroznia `zero`, `no data`, `error` i `degraded`;
- role admin/superadmin/user sa konsekwentnie egzekwowane;
- funkcje wysokiego ryzyka nie udaja gotowych.

Wniosek wykonawczy:

```text
Nie finalizujemy admina przez kosmetyke UI.
Finalizujemy go przez kontrakty, persistence, audit, role, honest states i testy refresh proof.
```

### 20B. Czy jestesmy gotowi do pracy

Jestesmy gotowi do **startu kontrolowanego programu naprawczego**, ale nie do losowej implementacji wielu ekranow naraz.

Gotowe do pracy:

- mamy rozdzielony dokument AI vs admin;
- mamy pelny material audytowy w sekcjach `11-17`;
- mamy glowny program naprawczy w sekcji `18`;
- mamy podzial pierwszej fali na 4 agentow w sekcji `19`;
- mamy zasade `visible = working or honest`;
- mamy zidentyfikowane najwieksze klasy ryzyka: fake success, brak persistence, brak audit, zle bledy, endpoint mismatch, `NaN`, `Invalid Date`, martwe przyciski.

Nie w pelni gotowe przed startem:

- nie mamy jeszcze kompletnej tabeli wszystkich widocznych akcji z decyzja `FIX NOW / READ-ONLY / DISABLE / HIDE`;
- nie mamy zamrozonej macierzy rol i uprawnien dla admin/superadmin/settings;
- nie mamy jednej listy endpointow: istnieje, brakuje, dziala czesciowo, tylko UI;
- nie mamy ustalonego minimalnego seed/test data pack dla admina;
- nie mamy finalnej smoke matrix do codziennego merge gate;
- nie mamy wskazanego jednego wlasciciela integracji konfliktowych plikow.

Decyzja:

```text
Start mozliwy, ale pierwsza paczka musi byc przygotowawczo-stabilizacyjna, nie funkcjonalnie agresywna.
```

### 20C. Definition of Ready przed implementacja

Przed uruchomieniem 4 agentow kazdy workstream musi miec wypelnione minimum:

| Element | Wymaganie | Bez tego |
|---|---|---|
| Zakres ekranow | Lista ekranow i tabow w workstreamie | Agent bedzie naprawial losowo |
| Lista akcji | Wszystkie przyciski/formularze/menu actions | Nie wykryjemy fake success |
| Decyzja akcji | `FIX NOW`, `READ-ONLY`, `DISABLE`, `HIDE` | Bedziemy implementowac funkcje bez priorytetu |
| Endpoint map | UI action -> endpoint -> status endpointu | Frontend i backend sie rozjada |
| Scope danych | `user`, `organization`, `global`, `superadmin` | Grozi wyciekiem tenantowym |
| Audit rule | Czy mutacja wymaga audit event | Brak zgodnosci operacyjnej |
| Refresh proof | Co sprawdzamy po reloadzie | Zapis moze byc tylko lokalnym stanem |
| Test pack | Unit/integration/e2e/manual smoke | Nie wiemy, czy naprawa jest stabilna |

Minimalny format karty akcji:

```text
Area:
Screen:
Action:
Role:
Current UI behavior:
Expected behavior:
Endpoint:
Backend status: exists / missing / partial / unknown
Persistence: yes / no / unknown
Audit required: yes / no
Risk: P0 / P1 / P2
Decision: FIX NOW / READ-ONLY / DISABLE / HIDE
Owner:
Verification:
```

### 20D. Kolejnosc finalizacji

Nie zaczynamy od najladniejszych ekranow ani od najwiekszych modali. Zaczynamy od rzeczy, ktore decyduja, czy panel administracyjny jest wiarygodny.

#### Etap 0 - Inventory i zamrozenie kontraktu

Cel: stworzyc pelna widocznosc, zanim zaczniemy poprawiac wiele plikow.

Zadania:

1. Spisac wszystkie widoczne akcje w admin/superadmin/settings.
2. Nadac kazdej akcji ryzyko `P0`, `P1`, `P2`.
3. Przypisac decyzje `FIX NOW`, `READ-ONLY`, `DISABLE`, `HIDE`.
4. Spisac endpointy i braki endpointow.
5. Zamrozic role matrix.
6. Zamrozic ownerow plikow konfliktowych.

Wyjscie etapu:

- `Action Inventory`;
- `Endpoint Gap Map`;
- `Role / Capability Matrix`;
- `First Wave Scope Lock`.

Etap jest zakonczony, gdy nie ma juz pytania "co ten przycisk mial robic?".

#### Etap 1 - Backbone prawdy w UI

Cel: usunac najwieksze klamstwa UI.

Zadania:

1. Centralny error mapper.
2. Safe formatters dla dat, liczb, procentow i pieniedzy.
3. Wspolne stany `Unavailable`, `Read-only`, `Degraded`, `No data`, `Error`.
4. Usuniecie falszywych success toastow.
5. Ujednolicenie mutation contract: validate -> persist -> audit -> refetch.

Etap jest zakonczony, gdy `NaN`, `Invalid Date`, `[object Object]` i fake success nie sa akceptowane w nowych zmianach.

#### Etap 2 - Core admin operations

Cel: admin/superadmin moze zarzadzac organizacjami, userami i dostepem.

Zakres P0:

- organizations list/detail/update;
- users list/create/invite/edit/status/role;
- access requests approve/reject;
- access codes create/list/expire;
- tenant isolation;
- audit events dla zmian.

Etap jest zakonczony, gdy da sie przejsc scenariusz:

```text
superadmin creates/updates org -> invites/admins user -> user appears in org ->
role/status changes persist -> audit shows mutation -> refresh confirms state
```

#### Etap 3 - Tenant Admin P32 i Settings

Cel: ustawienia przestaja byc lokalnym stanem komponentow.

Zakres P0:

- profile/regional/security/AI memory/model settings;
- admin people/security/billing/audit/operations;
- scope settings: user vs org vs global;
- `/admin/*` vs `/organization/*` decision;
- persistence after refresh.

Etap jest zakonczony, gdy minimum 5 krytycznych ustawien zapisuje sie po stronie backendu i przechodzi reload proof.

#### Etap 4 - Billing i commercial ops

Cel: funkcje finansowe przestaja byc szkieletem.

Zakres P0:

- plans;
- invoices;
- tax rates;
- payment methods albo unavailable;
- budgets/alerts;
- usage and limits;
- operational costs endpoint;
- safe financial formatting.

Etap jest zakonczony, gdy przynajmniej jeden pelny przeplyw finansowy dziala end-to-end:

```text
select organization -> create invoice/tax/budget -> persist -> refetch ->
refresh -> audit/event/log -> dashboard reflects correct state or honest degraded state
```

#### Etap 5 - Security, compliance, governance, connectors

Cel: funkcje wysokiego ryzyka nie udaja gotowych.

Zakres P0:

- MFA/SSO/password policy/IP whitelist/session controls;
- SCIM;
- API keys;
- webhooks;
- backup/restore/DR;
- DSAR/legal publish/approvals;
- DLP/security incidents/audit timeline.

Etap jest zakonczony, gdy kazda funkcja wysokiego ryzyka jest albo dzialajaca i audytowana, albo jawnie read-only/unavailable.

#### Etap 6 - AI Operations jako panel administracyjny

Cel: AI Operations w Super Admin nie obiecuje konfiguracji, ktorej nie potrafi zapisac.

Zakres P0:

- LLM providers create/edit/test/clone/delete;
- model tiers;
- routing rules;
- purposes and assignments;
- org AI policy;
- Prompt Builder;
- Model Registry;
- Pricing Registry;
- health monitoring and reports.

Etap jest zakonczony, gdy kazdy panel AI Operations ma status `live`, `read-only`, `degraded` albo `unavailable`, a nie mieszanine atrap i dzialajacych fragmentow.

#### Etap 7 - End-to-end readiness

Cel: potwierdzic, ze panel jest narzedziem, a nie zbiorem ekranow.

Zakres:

- full smoke dla superadmin;
- full smoke dla tenant admin;
- full smoke dla normal user/settings;
- regression test dla logowania i rol;
- test reload proof;
- test audit trail;
- test no fake UI.

Etap jest zakonczony, gdy przechodzi finalna lista scenariuszy z sekcji `20I`.

### 20E. Priorytety P0 / P1 / P2

#### P0 - blokuje uznanie admina za narzedzie

- login/session/role visibility;
- users, organizations, access requests, access codes;
- settings persistence dla krytycznych ustawien;
- billing create/list albo honest unavailable;
- security controls albo honest unavailable;
- audit trail dla mutacji;
- tenant isolation;
- fake success removal;
- endpoint mismatch i error mapper;
- `NaN`, `Invalid Date`, `[object Object]`.

#### P1 - wazne dla wersji produkcyjnej

- SCIM group mappings;
- API keys lifecycle;
- webhooks lifecycle;
- backup schedules and restore jobs;
- DSAR workflow;
- legal publish;
- AI provider clone/routing/policy;
- revenue and usage dashboards;
- advanced org operations.

#### P2 - mozna odlozyc, jesli uczciwie oznaczone

- advanced compliance reports;
- predictive analytics;
- pricing simulations;
- visual workflow builders;
- deep governance analytics;
- non-critical exports;
- cosmetic dashboard polish.

### 20F. Podzial 4 agentow po doprecyzowaniu

#### Agent A - Platform contract owner

Odpowiada za:

- error mapper;
- safe formatters;
- shared admin states;
- mutation contract;
- feature availability helpers;
- standard response shape;
- smoke/lint gate dla shared changes.

Zakaz:

- nie przebudowuje wszystkich domen;
- nie robi masowego refaktoru `api.ts`;
- nie implementuje billing/security/settings poza wspolnymi helperami.

Pierwszy output:

- PR/paczka z helperami i 3-5 migracjami przykladowymi;
- instrukcja dla innych agentow jak uzywac helperow;
- testy helperow.

#### Agent B - Identity, Tenant Admin, Settings

Odpowiada za:

- users/org/access;
- Tenant Admin P32;
- settings persistence;
- role/scope validation;
- tenant isolation tests.

Pierwszy output:

- jedna sciezka user/org/access end-to-end;
- minimum 2 settings z refresh proof;
- lista settings, ktore zostaja read-only/unavailable.

#### Agent C - Billing, Usage, Commercial

Odpowiada za:

- invoices/plans/tax/budgets;
- usage and limits;
- operational costs;
- financial dashboard states;
- money/percent formatting in billing.

Pierwszy output:

- jeden dzialajacy finansowy write flow albo jawna degradacja;
- naprawiony endpoint mismatch;
- test na `0` vs `no data` vs `error`.

#### Agent D - Security, Governance, Connectors, AI Ops honesty

Odpowiada za:

- API keys;
- webhooks;
- backup/restore/DR;
- MFA/SSO/SCIM/DLP;
- compliance/DSAR/legal/approvals;
- AI Operations panels, ktore udaja mutacje.

Pierwszy output:

- 5 najwiekszych atrap P0 zdegradowanych albo naprawionych;
- audit timeline bez `Invalid Date`;
- read-only/unavailable contract dla ryzykownych funkcji.

### 20G. Co jeszcze mozemy zrobic przed startem, zeby byc bardziej gotowym

Najlepsze przygotowania przed implementacja:

1. **Zrobic Action Inventory.** Przejsc wszystkie ekrany i zapisac kazdy przycisk, formularz i menu action.
2. **Zrobic Endpoint Gap Map.** Dla kazdej akcji zapisac endpoint, status backendu i czy persistuje po refreshu.
3. **Zamrozic Role Matrix.** Okreslic co widzi i co moze `superadmin`, `owner/admin`, `agent/user`, anonymous.
4. **Przygotowac seed data.** Minimum: 2 organizacje, 3 role, 2 plany, 2 faktury, access code, access request, kilka settings.
5. **Ustalic audit taxonomy.** Nazwy eventow dla zmian user/org/billing/security/settings.
6. **Spisac destructive actions.** Backup restore, delete user, delete org, revoke key, publish legal, DSAR, reset MFA.
7. **Zamrozic ownerow plikow konfliktowych.** Szczegolnie `api.ts`, `superadmin.routes.ts`, `adminP32.routes.ts`, billing routes.
8. **Przygotowac smoke matrix.** Krotka lista scenariuszy, ktora kazdy agent musi przejsc po zmianach.
9. **Ustalic policy dla funkcji bez backendu.** Domyslnie `DISABLE WITH REASON`, nie budujemy atrap.
10. **Zrobic baseline screenshots/logs.** Dla najgorszych ekranow, zeby po fali napraw porownac efekt.

### 20H. Minimalny pakiet przygotowawczy przed pierwszym commitem

Jesli chcemy wejsc w prace maksymalnie czysto, pierwsza mini-fala przed implementacja powinna stworzyc tylko artefakty sterujace:

| ID | Artefakt | Owner | Wynik |
|---|---|---|---|
| `READY-01` | Action Inventory | koordynator + agenci | kompletna lista akcji i decyzji |
| `READY-02` | Endpoint Gap Map | backend lead / agent A | mapa UI -> API -> persistence |
| `READY-03` | Role Matrix | koordynator | jedna tabela uprawnien |
| `READY-04` | Seed Data Pack | backend/test agent | powtarzalne dane testowe |
| `READY-05` | Smoke Matrix | QA/test agent | scenariusze merge gate |
| `READY-06` | Conflict Map | koordynator | ownerzy plikow i zakazy edycji |
| `READY-07` | Unavailable Policy | frontend lead / agent A | standard disabled/read-only/degraded |

To jest 0.5-1 dzien pracy, ale zmniejsza ryzyko chaosu wlasnie tam, gdzie wczorajsze testy pokazaly najwiekszy problem.

### 20I. Finalna smoke matrix

Przed uznaniem programu za skonczony przechodza minimum te scenariusze:

#### Superadmin

1. Logowanie superadmina.
2. Lista organizacji laduje dane albo uczciwy error.
3. Utworzenie/edycja organizacji zapisuje sie i przetrwa refresh.
4. Zmiana planu/statusu organizacji zapisuje sie albo jest unavailable.
5. Lista userow pokazuje role i organizacje.
6. Invite/create user dziala albo jest unavailable.
7. Role/status usera zmienia sie i audytuje.
8. Access request approve/reject dziala i przetrwa refresh.
9. Access code create/list/expire dziala i przetrwa refresh.

#### Tenant admin

1. Admin organizacji widzi tylko swoja organizacje.
2. `/admin/overview` nie pokazuje falszywych danych.
3. `/admin/people` ma dzialajace akcje albo unavailable states.
4. `/admin/security` zapisuje polityki albo pokazuje read-only/unavailable.
5. `/admin/audit` pokazuje poprawne daty i eksport albo unavailable.
6. `/admin/billing` rozroznia brak danych, blad i zero.

#### Settings

1. Profile setting zapisuje i przetrwa refresh.
2. Regional setting zapisuje i przetrwa refresh.
3. Security/MFA/session setting dziala albo jest read-only.
4. AI memory/model/privacy setting dziala albo jest read-only.
5. Zaden settings screen nie pokazuje success bez backendowego potwierdzenia.

#### Billing

1. Invoice/plan/tax/budget flow ma realny zapis albo unavailable.
2. Dashboardy nie pokazuja `NaN%`.
3. Kwoty maja walute i poprawny format.
4. `0`, `no data`, `error`, `unlimited` sa rozroznione.

#### Security / Governance / Connectors

1. API key create/revoke dziala albo jest disabled.
2. Webhook create/test dziala albo jest disabled.
3. Backup/restore/DR nie udaje gotowosci.
4. DSAR/legal/approvals maja lifecycle albo read-only.
5. Audit timeline nie pokazuje `Invalid Date`.

#### AI Operations as admin panel

1. Provider test dziala i pokazuje czytelny wynik.
2. Provider create/clone/delete dziala albo jest unavailable.
3. Routing rules dzialaja albo sa read-only/unavailable.
4. Prompt Builder/Model Registry/Pricing Registry nie udaja zapisu.
5. Health/reports/dashboard rozrozniaja dane realne od degraded state.

### 20J. Merge gate

Kazda paczka napraw musi przejsc przez bramke:

```text
1. Jakie akcje byly fake i co z nimi zrobiono?
2. Ktore mutacje maja backend persistence?
3. Ktore mutacje maja audit?
4. Co przechodzi refresh proof?
5. Jakie funkcje zostaly read-only/unavailable/hidden?
6. Jakie testy uruchomiono?
7. Jakie ryzyka zostaja?
```

Nie przyjmujemy paczki, jesli:

- dodaje nowy widoczny przycisk bez decyzji;
- zostawia fake success;
- renderuje surowy blad;
- nie ma testu albo manual smoke dla P0;
- zmienia shared API contract bez poinformowania innych agentow;
- poprawia UI bez sprawdzenia persistence.

### 20K. Odpowiedz na pytanie: co jeszcze przed finalizacja

Najbardziej zwiekszymy gotowosc, jesli przed kodowaniem wykonamy trzy rzeczy:

1. **Action Inventory** - bo obecnie najwiekszy problem to brak pelnej listy martwych lub czesciowych akcji.
2. **Endpoint Gap Map** - bo musimy wiedziec, gdzie brakuje backendu, a gdzie tylko frontend nie korzysta z endpointu.
3. **Smoke Matrix + Seed Data** - bo bez powtarzalnych danych i testu po refreshu znowu bedziemy oceniac panel "na oko".

Rekomendacja:

```text
Nastepny krok: nie startowac od implementacji ekranow.
Najpierw zrobic READY-01 do READY-07, potem dopiero puscic 4 agentow wedlug sekcji 19 i 20F.
```

## 21. Pakiet READY przed startem implementacji

> Status: pakiet przygotowawczy do uruchomienia agentow.
> Cel: zamienic audyt i plan w konkretne artefakty sterujace praca.
> Zakres: `READY-01` do `READY-07`.

Ten rozdzial jest praktyczna wersja przygotowania do pracy. Nie zastapi pelnego inventory z kazdego przycisku, ale daje wystarczajaco precyzyjny start, zeby 4 agentow moglo wejsc w prace bez chaosu.

### 21A. READY-01 - Action Inventory startowe

Kazdy agent ma doprecyzowac swoja czesc do poziomu pojedynczego przycisku przed pierwszym commitem. Ponizsza tabela jest startowym inventory P0/P1.

| Obszar | Trasy / ekrany | Akcje do decyzji | Ryzyko | Domyslna decyzja startowa | Pliki startowe |
|---|---|---|---|---|---|
| Superadmin overview | `/superadmin`, `/superadmin/overview` | refresh dashboard, drilldown, export, system health links | P1 | `READ-ONLY` jesli dane sa agregowane bez pelnej prawdy | `src/views/superadmin/SuperAdminView.tsx`, `src/views/superadmin/SuperAdminDashboard.tsx`, `src/views/superadmin/OverviewModule.tsx` |
| Organizations | `/superadmin/customers/organizations` | create org, edit org, change plan/status, suspend/reactivate, delete/purge, billing details | P0 | `FIX NOW` dla edit/status/plan, `DISABLE` dla delete/purge bez confirm/audit | `src/views/superadmin/OrganizationsView.tsx`, `src/views/superadmin/SuperAdminOrgDetailsModal.tsx` |
| Users | `/superadmin/customers/users` | create user, invite, edit, role/status, reset password, force MFA reset, impersonate | P0 | `FIX NOW` dla CRUD/role/status, `DISABLE` dla impersonate/MFA reset bez audit | `src/views/superadmin/SuperAdminUserManagement.tsx`, `src/components/shared/UserManagementCore.tsx` |
| Access requests | `/superadmin/customers`, access tabs | approve, reject, filter, inspect request | P0 | `FIX NOW` | `src/views/superadmin/SuperAdminAccessRequestsView.tsx` |
| Access codes | superadmin/admin access panels | create code, expire/deactivate, set role/org/max uses/expiry | P0 | `FIX NOW` | frontend consumers of access-code APIs, `src/components/shared/UserManagementCore.tsx` |
| Tenant Admin P32 people | `/admin/people` | add member, invite, change role, remove, generate access code | P0 | `FIX NOW` or `DISABLE WITH REASON` per action | `src/views/admin/AdminSettingsModule.tsx`, `src/views/admin/AdminUserManagement.tsx` |
| Tenant Admin P32 security | `/admin/security` | update security policy, collaboration, API access, IAM policy, assignments | P0 | `FIX NOW` for policy persistence, `READ-ONLY` for unavailable advanced controls | `src/views/admin/AdminSecuritySettings.tsx`, `src/views/admin/AdminSettingsModule.tsx` |
| Tenant Admin P32 billing | `/admin/billing` | payment method add/remove/default, alerts, tax settings, usage details | P0 | `FIX NOW` for alerts/tax/payment if backend exists, else `DISABLE` | `src/views/admin/AdminBillingManagement.tsx`, `src/views/admin/AdminSettingsModule.tsx` |
| Tenant Admin audit | `/admin/audit` | view logs, filter, export | P0 | `FIX NOW` for list/filter, `DISABLE` export if backend missing | `src/views/admin/AdminSettingsModule.tsx` |
| Settings profile/regional | `/settings/profile`, `/settings` | save profile, avatar, language, timezone, date/number format | P0 | `FIX NOW` | `src/components/settings/*`, `src/services/api/settings.api.ts` |
| Settings security/privacy | `/settings/security`, `/settings/security/*` | MFA/session/password/recovery/privacy/GDPR export/delete | P0 | `FIX NOW` for persistence, `READ-ONLY/DISABLE` for recovery/destructive actions without backend | `src/components/settings/security/*`, `src/components/settings/*` |
| Settings AI | `/settings/ai` | AI memory, model, parameters, voice, privacy, prompt library | P0/P1 | `FIX NOW` for memory/model/privacy, `READ-ONLY` for voice if not backended | `src/components/settings/AIMemorySettings.tsx`, `src/components/settings/*AI*` |
| Billing superadmin | `/superadmin/customers/commercial/billing`, `/superadmin/customers/commercial/invoices`, `/superadmin/revenue` | create invoice, mark paid, remind, download PDF, plans, tax rates, budgets, discounts, usage | P0 | `FIX NOW` for invoice/tax/budget happy path, `DISABLE` for payment operations without provider | `src/views/superadmin/InvoiceCenterView.tsx`, `src/views/superadmin/BillingCenterView.tsx`, `src/views/superadmin/RevenueModule.tsx` |
| Security superadmin | `/superadmin/security`, `/superadmin/security/sso`, `/superadmin/security/policies` | MFA/SSO policy, password policy, IP whitelist, sessions revoke, device block, incidents resolve | P0/P1 | `FIX NOW` for policy/session visibility, `DISABLE` for destructive actions without audit | `src/views/superadmin/SecurityModule.tsx`, `src/views/superadmin/security/*`, `src/views/superadmin/iam/*` |
| Connector Ops | `/superadmin/system`, `/superadmin/system/api-keys` | integrations connect/disconnect/test/refresh/config, webhooks CRUD/test, API keys create/revoke | P0/P1 | `DISABLE WITH REASON` unless endpoint and persistence verified | `src/views/superadmin/SystemModule.tsx`, `src/components/SuperAdmin/system/*`, `src/views/superadmin/APIManagementView.tsx` |
| Backup / DR | system panels | create backup, restore, schedule, delete, download, DR test | P0 | `DISABLE WITH REASON` unless backend job lifecycle exists | `src/components/SuperAdmin/system/EnterpriseBackupPanel.tsx` |
| Governance / Compliance | `/superadmin/content/compliance`, `/superadmin/security`, governance module | DSAR, audit creation, controls edit, processing records, legal publish, export | P0/P1 | `READ-ONLY` or `DISABLE` unless persistence/audit verified | `src/views/superadmin/GovernanceModule.tsx`, `src/views/superadmin/ComplianceCenterView.tsx`, `src/views/superadmin/SuperAdminLegalView.tsx` |
| AI Operations admin panel | `/superadmin/ai-platform/*` | provider create/edit/test/clone/delete, model tiers, routing rules, purpose assignments, org policy, prompt builder, model registry, pricing registry, reports | P0/P1 | `FIX NOW` for provider test/edit/tier, `READ-ONLY/DISABLE` for unbacked builders/registries | `src/views/superadmin/AIPlatformModule/*`, `src/views/superadmin/AIOperationsModule.tsx` |

### 21B. READY-02 - Endpoint Gap Map startowe

Ta mapa nie oznacza, ze kazdy endpoint jest w pelni poprawny. Oznacza, gdzie zaczynamy weryfikacje UI -> API -> persistence -> audit.

| Domena | Endpointy / grupy | Backend files | UI consumers | Status startowy | Co sprawdzic przed fixem |
|---|---|---|---|---|---|
| Superadmin organizations | `GET /api/superadmin/organizations`, `PUT /api/superadmin/organizations/:id`, `DELETE /api/superadmin/organizations/:id`, billing detail | `server/src/routes/superadmin.routes.ts` | `OrganizationsView`, org modals | istnieje | walidacja, audit, delete confirmation, refresh proof |
| Superadmin users | `GET/POST/PUT/DELETE /api/superadmin/users`, invite, reset password, force MFA reset, impersonate | `server/src/routes/superadmin.routes.ts` | `SuperAdminUserManagement`, `UserManagementCore` | istnieje/czesciowo ryzykowne | role/status enums, org scope, email invite side effects, audit |
| Access requests/codes | `/api/superadmin/access-requests`, approve/reject, `/api/superadmin/access-codes`, deactivate | `server/src/routes/superadmin.routes.ts` | access request/codes views | istnieje | persistence, expiry/max uses, role/org validation |
| Tenant Admin people | `GET/POST /api/admin/people`, `GET/POST /api/admin/access-codes` | `server/src/routes/adminP32.routes.ts` | `/admin/people` | istnieje | tenant scoping, audit, member lifecycle completeness |
| Tenant Admin overview | `GET /api/admin/overview` | `server/src/routes/adminP32.routes.ts` | `/admin/overview` | istnieje | no fake metrics, source/timestamp |
| Tenant Admin IAM/security | `/api/admin/security`, `/api/admin/security/policy`, `/api/admin/iam/policy`, `/api/admin/iam/assignments` | `server/src/routes/adminP32.routes.ts` | `/admin/security` | istnieje | policy persistence, assignments validation, audit |
| Tenant Admin billing | `/api/admin/billing/summary`, payment methods, invoices, usage details, alerts, tax settings | `server/src/routes/adminP32.routes.ts` | `/admin/billing` | istnieje | payment provider boundaries, no fake writes, org scope |
| Tenant Admin audit | `/api/admin/audit-logs`, stats, export | `server/src/routes/adminP32.routes.ts` | `/admin/audit` | istnieje | date safety, export behavior, filters |
| Settings preferences | `/api/settings/preferences/regional`, notifications, quiet hours, privacy, dashboard, work, working hours, signatures | `server/src/routes/settings.routes.ts` | settings components | istnieje | scope per setting, refresh proof, false success cleanup |
| Settings AI | `/api/settings/preferences/ai-*`, `/api/settings/ai-usage`, prompt library | `server/src/routes/settings.routes.ts`, `server/src/routes/ai/ai-settings.routes.ts` | AI settings components | istnieje/czesciowo | memory/model/privacy persistence, voice unavailable if no backend |
| Settings integrations | `/api/settings/integrations/*`, OAuth start/callback/status, basic connect/test/config/logs | `server/src/routes/settings.routes.ts` | integration settings | istnieje/czesciowo | no fake OAuth, safe unavailable states |
| Billing commercial | `/api/billing/*`, `/api/superadmin/invoices`, stats/remind/mark-paid/pdf/create | `server/src/routes/billing/billing.routes.ts`, `server/src/routes/superadmin.routes.ts` | invoice/billing/revenue views | istnieje/czesciowo | operational-costs mismatch, numeric formats, tax/line item validation |
| API keys | `/api/superadmin/api-keys`, usage, delete | `server/src/routes/superadmin.routes.ts` | system/API management views | istnieje | secret display policy, revoke audit, no fake key creation |
| Integrations/webhooks | `/api/superadmin/integrations/*`, `/api/superadmin/webhooks/*` | `server/src/routes/superadmin.routes.ts`, connector routes | SystemModule, EnterpriseIntegrationsHub | istnieje/czesciowo | provider support, delivery logs, test endpoint truth |
| Backup/DR | `/api/superadmin/system/backup`, `/api/superadmin/backup/schedules` | `server/src/routes/superadmin.routes.ts` | backup panel | czesciowo | job lifecycle, restore/download/delete endpoints, disable if missing |
| Security ops | `/api/superadmin/security/events`, policies, sessions, incidents, threats, device/session actions | `server/src/routes/superadmin.routes.ts`, security routes | security/IAM views | istnieje/czesciowo | destructive confirmations, audit, date safety |
| Compliance/governance | `/api/superadmin/compliance/*`, GDPR requests/actions, legal publish/toggle | `server/src/routes/superadmin.routes.ts`, `server/src/routes/governance.routes.ts`, admin compliance routes | governance/compliance/legal views | istnieje/czesciowo | lifecycle status, audit, export/download truth |
| AI Operations | AI platform endpoints in `superadmin.routes.ts`, `ai-operations.routes.ts`, `ai-governance.routes.ts`, `ai-prompts.routes.ts`, AI budget/analytics routes | AI/superadmin route files | `AIPlatformModule/*` | mieszany | provider create/clone/routing/purpose assignments and org policy persistence |

Known mismatch / risk queue:

1. `operational-costs` - sprawdzic frontend path vs backend path przed Agent C.
2. OAuth/connect flows - nie zwracac fake URL ani fake success.
3. Backup restore/download/delete - nie trzymac widocznych akcji bez job lifecycle.
4. Legal publish / DSAR / approvals - wymagaja lifecycle + audit, inaczej `READ-ONLY/DISABLE`.
5. AI Operations builders/registries - jesli backend nie zapisuje, oznaczyc jako `READ-ONLY/DISABLE`.
6. Settings voice/recovery/shortcuts - persistence albo jawny read-only.

### 21C. READY-03 - Role / Capability Matrix

| Rola | Widocznosc | Mutacje dozwolone | Mutacje zakazane / wymagaja blokady | Test wymagany |
|---|---|---|---|---|
| Anonymous | login/public only | brak | wszystko admin/superadmin/settings private | redirect/401 smoke |
| User | wlasne settings, wlasne dane workspace | profile, personal preferences, own integrations if allowed | org users, billing org, security org, superadmin | 403/hidden nav |
| Agent / consultant | workspace modules + ograniczone settings | own availability/preferences, assigned work | org admin, billing, user management, superadmin | 403/hidden nav |
| Org admin / owner | `/admin/*`, org settings, org people, org billing summary | org users/invites/access codes, org security policy, org settings | cudze organizacje, superadmin global, destructive platform ops | tenant isolation |
| Superadmin support | selected superadmin read/write | support/customer operations, access requests if capability exists | platform security/destructive ops without capability | capability gate |
| Superadmin platform ops | full superadmin operational panels | organizations, billing, system, connectors, backup if implemented | security override without confirmation/capability | confirmation + audit |
| Superadmin security ops | security/iam/compliance panels | MFA/SSO/session/security incident workflows | billing mutations unless separate capability | audit + capability |

Capabilities do zamrozenia przed kodem:

- `tenant_admin`;
- `user_admin`;
- `billing_admin`;
- `security_ops`;
- `platform_ops`;
- `compliance_admin`;
- `ai_ops_admin`;
- `support_ops`;
- `superadmin_root`.

Zasada:

```text
Navigation visibility is not authorization.
Kazdy backend endpoint musi egzekwowac role/capability niezaleznie od ukrywania UI.
```

### 21D. READY-04 - Seed Data Pack

Minimalny seed do testow admin/superadmin/settings powinien tworzyc powtarzalny zestaw danych. Istniejace punkty zaczepienia w repo:

- `server/scripts/seed-aplix-organization.ts`;
- `server/scripts/seed-vts-organization.ts`;
- `server/scripts/build-demo-dataset.ts`;
- `server/scripts/seed-demo-dataset-contract.ts`;
- `server/migrations/125_settings_seed_data.sql`;
- `server/migrations/223_billing_mock_seed.sql`;
- `server/migrations/224_security_mock_seed.sql`;
- `server/migrations/225_security_mock_seed_extra.sql`;
- `server/migrations/226_compliance_mock_seed.sql`;
- `server/migrations/229_admin_overview_seed.sql`;
- `server/migrations/230_settings_demo_seed.sql`;
- `server/migrations/235_revenue_module_seed.sql`;
- `server/migrations/237_security_demo_seed.sql`;
- `server/migrations/251_llm_providers_demo_seed.sql`;
- `server/migrations/252_complete_demo_data_seed.sql`.

Docelowy pakiet `admin-readiness-seed`:

| Encja | Minimum | Po co |
|---|---:|---|
| Organizations | 2 aktywne + 1 suspended/trial | tenant isolation, billing, status/plan |
| Users | 1 superadmin, 1 org owner, 1 org admin, 1 consultant/agent, 1 zwykly user, 1 invited/pending | role matrix, invite, status |
| Access requests | 2 pending, 1 approved, 1 rejected | approve/reject smoke |
| Access codes | 1 active, 1 expired, 1 max-used | expiry/max uses validation |
| Plans | 2 paid + 1 trial/free | org plan switch, billing |
| Invoices | 1 draft, 1 issued, 1 paid, 1 overdue | invoice actions and states |
| Tax rates | 2 countries/rates | tax rate create/list |
| Budgets/alerts | 1 under limit, 1 near limit, 1 exceeded | usage/budget states |
| Payment methods | 1 default, 1 expired/mock unavailable | payment method UI truth |
| Settings | profile/regional/security/AI memory/AI model records | refresh proof |
| Audit logs | user/org/billing/security/settings mutations | audit viewer smoke |
| Security events | open/resolved/high severity | incident/session/device screens |
| API keys | active/revoked/expired metadata only | lifecycle without secret leakage |
| Webhooks | active/failing/disabled + deliveries | delivery logs and test states |
| Compliance | DSAR pending/completed, controls, processing records | governance workflows |
| AI providers | active/unhealthy/disabled provider | AI Operations provider tests |

Seed acceptance:

- dane sa deterministyczne;
- moga byc odtworzone lokalnie;
- nie zawieraja realnych sekretow;
- kazdy P0 smoke ma dane wejscia;
- kazda rola ma znany login albo mock auth identity.

### 21E. READY-05 - Smoke Matrix do codziennego merge gate

Reuzywalne testy/skrypty obecne w repo:

- `npm run test:e2e:readiness`;
- `npm run test:e2e:smoke`;
- `npm run test:integration`;
- `tests/e2e/smoke/admin-settings-superadmin-readiness.spec.ts`;
- `tests/e2e/smoke/settings-and-modules-render.spec.ts`;
- `tests/e2e/admin/admin-console.spec.ts`;
- `tests/e2e/settings/settings-management.spec.ts`;
- `tests/e2e/journeys/settings-profile-security.spec.ts`;
- `tests/integration/routes/settings-admin-superadmin.p31-33.test.ts`;
- `tests/integration/routes/superadmin-*.test.js`;
- `tests/integration/settings/*`;
- `tests/components/settings/*.test.tsx`;
- `tests/components/SuperAdmin/*.test.tsx`;
- `tests/reports/admin-panel-test-report.md`;
- `tests/manual/admin-panel-test-checklist.md`;
- `tests/manual/superadmin-routing-test-checklist.md`.

Minimalny daily smoke:

| ID | Scenariusz | Rola | Typ | Warunek PASS |
|---|---|---|---|---|
| `SMOKE-01` | Login superadmin i wejscie w `/superadmin/overview` | superadmin | e2e/manual | brak 500/blank screen, nav dziala |
| `SMOKE-02` | Lista organizacji + edit org name/status/plan | superadmin | e2e/integration | zapis, refetch, refresh proof, audit |
| `SMOKE-03` | Lista userow + create/invite/edit role/status | superadmin | e2e/manual | zapis albo disabled reason, bez fake success |
| `SMOKE-04` | Access request approve/reject | superadmin | integration/e2e | status po refreshu zgodny |
| `SMOKE-05` | Access code create/deactivate | superadmin/admin | integration/e2e | expiry/max uses/role/org walidowane |
| `SMOKE-06` | Tenant admin widzi tylko swoja organizacje | org admin | e2e | brak cudzych danych |
| `SMOKE-07` | `/admin/people` people/access actions | org admin | e2e/manual | dziala albo unavailable z reason |
| `SMOKE-08` | `/admin/security` policy save | org admin | integration/e2e | persist + audit albo read-only |
| `SMOKE-09` | Settings regional/profile save | user | e2e/component | persist po reloadzie |
| `SMOKE-10` | Settings AI memory/model/privacy | user | integration/e2e | persist albo read-only |
| `SMOKE-11` | Invoice/tax/budget happy path | superadmin/billing | integration/e2e | rekord istnieje po refetchu |
| `SMOKE-12` | Billing dashboard no `NaN` / false zero | superadmin | component/manual | rozroznia zero/no data/error |
| `SMOKE-13` | Security sessions/incidents/timeline | security ops | e2e/manual | brak `Invalid Date`, akcje audytowane |
| `SMOKE-14` | API keys/webhooks | platform ops | manual/integration | create/revoke/test dziala albo disabled |
| `SMOKE-15` | Backup/restore/DR actions | platform ops | manual | zadna destrukcyjna atrapa nie jest aktywna |
| `SMOKE-16` | Governance DSAR/legal/controls | compliance admin | manual/integration | lifecycle albo read-only/unavailable |
| `SMOKE-17` | AI provider test/edit/tier | ai ops admin | manual/integration | realny wynik, persist albo unavailable |
| `SMOKE-18` | AI routing/prompt/model/pricing builders | ai ops admin | manual | brak fake save |
| `SMOKE-19` | Error rendering | wszystkie | component/manual | brak `[object Object]`, raw JSON, `INTERNAL_ERROR` |
| `SMOKE-20` | Cross-role nav/403 | user/admin/superadmin | e2e | UI hidden + backend 403 |

### 21F. READY-06 - Conflict Map i ownerzy plikow

| Plik / obszar | Owner wave | Zasada |
|---|---|---|
| `src/services/api.ts` | Agent A | tylko shared contract i minimalne adaptery; bez masowego refaktoru |
| `src/services/api/baseClient.ts` | Agent A | error handling i response normalization |
| `src/services/api/settings.api.ts` | Agent A + Agent B | A definiuje wzorzec, B dodaje domenowe calls |
| `src/utils/*` shared admin helpers | Agent A | source of truth dla formatters/errors/states |
| `server/src/routes/superadmin.routes.ts` | koordynator + domenowy owner | edycje sekcjami; unikać rownoleglego konfliktu |
| `server/src/routes/adminP32.routes.ts` | Agent B | Tenant Admin P32 |
| `server/src/routes/settings.routes.ts` | Agent B | user/settings persistence |
| `server/src/routes/billing/billing.routes.ts` | Agent C | billing/commercial |
| `src/views/superadmin/InvoiceCenterView.tsx` | Agent C | invoices |
| `src/views/superadmin/BillingCenterView.tsx` | Agent C | billing center |
| `src/views/superadmin/RevenueModule.tsx` i revenue views | Agent C | revenue/usage dashboards |
| `src/views/superadmin/SystemModule.tsx` | Agent D | system, connectors, backup |
| `src/components/SuperAdmin/system/*` | Agent D | system panels |
| `src/views/superadmin/GovernanceModule.tsx` | Agent D | governance/compliance |
| `src/views/superadmin/SecurityModule.tsx`, `src/views/superadmin/security/*`, `src/views/superadmin/iam/*` | Agent D | security/IAM |
| `src/views/superadmin/AIPlatformModule/*` | Agent D | AI Operations honesty |
| `docs/admin_dev_fin.md` | koordynator | status aktualizowany po wave |
| `docs/AI_dev_fin.md` | brak | nie edytowac w programie adminowym |

Zasada konfliktu:

```text
Jesli agent musi dotknac pliku poza swoim ownerem, robi minimalna zmiane i zapisuje dependency w raporcie paczki.
```

### 21G. READY-07 - Unavailable / Read-only Policy

Standard copy:

| Stan | Copy | Kiedy uzyc |
|---|---|---|
| `Unavailable` | `This action is not available yet because the backend workflow is not connected.` | widoczna funkcja planowana, brak endpointu/persistence |
| `Read-only` | `Read-only diagnostic view. Configuration is managed elsewhere.` | panel informacyjny bez mutacji |
| `Degraded` | `Some data could not be loaded. Showing the last reliable snapshot where available.` | endpoint czesciowo zwraca dane albo telemetry missing |
| `No data` | `No records yet.` | prawdziwy pusty stan |
| `Error` | `We could not load this data. Try again or contact an administrator.` | realny blad |
| `Destructive disabled` | `This destructive action is disabled until confirmation, audit and recovery workflow are implemented.` | delete/purge/restore/revoke/publish bez pelnego safety |

Zakazane copy i zachowania:

- `Success` po lokalnym setState bez backendu;
- `Saved` bez refetch/refresh proof;
- `Coming soon` bez wskazania, czy akcja jest disabled;
- gole `n/a` dla bledu;
- `0` jako fallback dla bledu dashboardu;
- `Invalid Date`;
- `NaN`;
- `[object Object]`;
- raw JSON w toastach.

## 22. Gotowosc po pakiecie READY

Po dopisaniu pakietu READY jestesmy gotowi do wejscia w prace pod jednym warunkiem: pierwsza fala agentow nie moze zaczac od szerokiego kodowania ekranow. Musi zaczac od wypelnienia szczegolow swojej czesci `Action Inventory` i potwierdzenia `Endpoint Gap Map`.

Start 4 agentow powinien wygladac tak:

1. Agent A tworzy albo stabilizuje wspolne helpery i standardy.
2. Agent B/C/D uzupelniaja inventory dla swoich domen.
3. Koordynator zatwierdza decyzje `FIX NOW / READ-ONLY / DISABLE / HIDE`.
4. Dopiero wtedy agenci robia pierwsze commity naprawcze.

Mozemy startowac, gdy kazdy agent zwroci przed implementacja:

```text
My screens:
My P0 actions:
My endpoint gaps:
My unavailable/read-only decisions:
My test pack:
Files I will touch:
Files I must not touch:
```

## 23. Wave 1 - start kontrolowany

> Status: uruchomione.
> Cel: pierwsza mala paczka napraw bez konfliktu z rownolegla praca AI.

### 23A. Workstreamy uruchomione

Uruchomiono cztery workstreamy read-only zgodnie z sekcja `22`:

- Agent A - Backbone / shared contract;
- Agent B - Identity / Tenant Admin P32 / Settings;
- Agent C - Billing / Usage / Commercial;
- Agent D - Security / Governance / Connector Ops / Backup / AI Ops honesty.

Kazdy workstream zwrocil wymagany pakiet:

```text
My screens:
My P0 actions:
My endpoint gaps:
My unavailable/read-only decisions:
My test pack:
Files I will touch:
Files I must not touch:
Smallest first implementation patch:
```

### 23B. Pierwsze wdrozone poprawki

| ID | Obszar | Zmiana | Status |
|---|---|---|---|
| `W1-01` | Backbone / honest UI | Dodano `src/utils/adminUiCopy.ts` i przepieto `AdminState` na wspolne copy READY-07. | Done |
| `W1-02` | Settings / recovery | `AccountRecoverySettings` nie generuje juz losowych recovery codes w przegladarce i nie pokazuje fake success. Akcje sa read-only/unavailable do czasu backendu. | Done |
| `W1-03` | Billing / invoices | `InvoiceCenterView` przekazuje filtr faktur jako `{ period }`, zgodnie z kontraktem `getSuperAdminInvoices`. | Done |
| `W1-04` | Backup / DR honesty | `EnterpriseBackupPanel` nie traktuje bledu backup service jako pustej listy. Pokazuje degraded state i blokuje create backup przy niedostepnym backendzie. | Done |
| `W1-05` | Tenant Admin / access codes | `AdminMembersRolesPanel` generuje kody przez `/admin/access-codes`, czyli tenantowy kontrakt P32 z org scopingiem i audytem, zamiast przez ogolne `/access-control/codes`. | Done |
| `W1-06` | Tenant Admin scope | Decyzja zakresu: tenantowy `Admin` sluzy do ustawienia zespolu. Nie robimy z niego mini-superadmina ani centrum billing/security/commercial. Copy w `AdminMembersRolesPanel` zostalo ustawione na Team Invite Code. | Done |
| `W1-07` | Tenant Admin IA | `AdminSettingsModule` i `AdminSettingsSidebar` zostaly zwezone do `Team & Access`. Legacy sciezki `/admin/security`, `/admin/billing`, `/admin/ai`, `/admin/integrations`, `/admin/audit`, `/admin/operations` mapuja sie do team management zamiast renderowac panele operacyjne. | Done |
| `W1-08` | Backup / DR destructive actions | `EnterpriseBackupPanel` blokuje restore, download, delete, add schedule i Start DR Test jako disabled do czasu confirmation/audit/recovery workflow. Usunieto falszywe DR metryki typu `Passed`, `4m 32s`, `100%`. | Done |
| `W1-09` | Tenant Admin / people team-only | `AdminMembersRolesPanel` zostal doprecyzowany jako team management: invite nie nadaje `Owner`, zwykla zmiana roli nie nadaje `Owner`, owner jest chroniony i obslugiwany przez ownership transfer. `OwnershipManagementView` nie pokazuje juz delete organization ani billing-admin copy. | Done |
| `W1-10` | Billing / operational costs honesty | `BillingCenterView` i `SuperAdminRevenueView` rozrozniaja blad operational costs od prawdziwie pustych danych. Pusty wynik nie renderuje falszywego `Total Operational Cost = $0.00`, a blad endpointu pokazuje unavailable/degraded copy. | Done |
| `W1-11` | API Management / webhooks honesty | `APIManagementView` zostawia API keys aktywne, bo maja backend create/revoke/usage, ale webhooks sa read-only/unavailable do czasu pogodzenia zdublowanych superadmin routes i jednego audytowanego backend workflow. | Done |

### 23C. Testy uruchomione

```text
npx vitest run \
  tests/unit/components/settings/AccountRecoverySettings.test.tsx \
  tests/unit/views/superadmin/InvoiceCenterView.test.tsx \
  tests/unit/components/Admin/AdminState.test.tsx \
  tests/unit/components/SuperAdmin/EnterpriseBackupPanel.test.tsx \
  tests/unit/components/Admin/AdminMembersRolesPanel.test.tsx \
  --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 5 passed
Tests: 7 passed
```

Dodatkowo po `W1-07`:

```text
npx vitest run \
  tests/components/Admin/AdminSettingsModule.v8-canon.test.tsx \
  tests/integration/routes/settings-admin-superadmin.p31-33.test.ts \
  --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 2 passed
Tests: 78 passed
```

### 23D. Uwagi do kolejnej paczki

Decyzja zakresu po korekcie:

```text
Tenant Admin = ustawienie zespolu.
SuperAdmin = billing, security, commercial, platform operations, governance.
Settings = osobiste ustawienia usera.
```

Kolejna paczka powinna isc w jednym z trzech kierunkow:

1. **Agent B** - uproscic `/admin/people` do team management: members, roles, team invite code, ownership safeguards.
2. **Agent C** - rozszerzyc billing o test integracyjny dla `GET /api/superadmin/invoices?period=...` i poprawic `0 / no data / error` w operational costs po stronie SuperAdmin.
3. **Agent D** - domknac Backup/DR w SuperAdmin: restore/delete/download/DR test jako `destructive disabled` albo realny job lifecycle.

### 23E. Status po W1-08

Paczka `Agent D / Backup-DR honesty` zostala domknieta jako wariant `destructive disabled`, nie jako pelny job lifecycle. To jest swiadoma decyzja na start: restore/delete/DR sa operacyjnie krytyczne, wiec do czasu backendowego workflow nie moga wygladac na gotowe.

Wdrozone:

- restore backup jest disabled z powodem READY-07;
- download backup jest disabled z powodem READY-07, bo nie ma jeszcze zweryfikowanego bezpiecznego flow pobrania;
- delete backup jest disabled z powodem READY-07;
- Add Schedule jest disabled, bo poprzednio otwieral nieistniejacy workflow;
- Start DR Test jest disabled i opisany jako read-only/unavailable;
- statyczne DR pass metrics i historia zostaly usuniete.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseBackupPanel.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 3 passed
```

Lint:

```text
npx eslint src/components/SuperAdmin/system/EnterpriseBackupPanel.tsx
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w panelu (`console`, `any`, nieuzyty catch `error`).

### 23F. Status po W1-09

Paczka `Agent B / Admin people team-only` domknela decyzje: tenantowy Admin sluzy do ustawiania zespolu, nie do operacji billing/security/platform.

Wdrozone:

- opis roli `Admin` ograniczony do team members, roles i invite codes;
- zwykly invite nie pozwala nadac `Owner`;
- zwykly role change nie pozwala nadac `Owner`;
- obecny owner jest chroniony przed zwykla zmiana roli/usunieciem w tabeli members;
- copy `Maximum participant registrations` zastapione przez `Maximum team registrations`;
- `OwnershipManagementView` zostawiony jako team ownership safeguard;
- usunieto z tego widoku `Delete Organization`, danger zone i billing-admin copy.

Test:

```text
npx vitest run \
  tests/unit/components/Admin/AdminMembersRolesPanel.test.tsx \
  tests/unit/views/admin/OwnershipManagementView.test.tsx \
  --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 2 passed
Tests: 3 passed
```

Lint:

```text
npx eslint src/components/Admin/AdminMembersRolesPanel.tsx src/views/admin/OwnershipManagementView.tsx
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia (`any`, `console`, nieuzyte catch `error`).

### 23G. Status po W1-10

Paczka `Agent C / Billing operational costs honesty` domknela jeden z problemow z raportow: panele billing/revenue nie moga sugerowac, ze koszty wynosza `0`, jesli realnie endpoint jest niedostepny albo nie ma rekordow kosztowych.

Wdrozone:

- `BillingCenterView` pokazuje `Operational cost metrics unavailable`, gdy endpoint operational costs nie zaladuje danych;
- `BillingCenterView` pokazuje `No operational cost records yet`, gdy endpoint zwroci prawdziwa pusta liste;
- `BillingCenterView` nie renderuje stopki `Total Operational Cost`, jesli nie ma rekordow kosztowych albo total nie jest liczba;
- `SuperAdminRevenueView` dostal ten sam standard dla operational costs;
- dodano test komponentu pilnujacy roznicy miedzy unavailable i no-records oraz braku falszywego zera.

Test:

```text
npx vitest run tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Lint:

```text
npx eslint src/views/superadmin/BillingCenterView.tsx src/views/superadmin/SuperAdminRevenueView.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx --no-warn-ignored
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w duzych plikach billing/revenue (`@ts-nocheck`, `any`, `console`, martwe importy).

### 23H. Status po W1-11

Paczka `Agent D / API Management webhooks honesty` rozdzielila dwie rzeczy, ktore w audycie byly w jednym koszyku:

- API keys w `APIManagementView` zostaja aktywne, bo `SuperAdminController` ma realne `getApiKeys`, `createApiKey`, `deleteApiKey` i `getApiKeyUsage`;
- webhooks w `APIManagementView` sa zablokowane jako read-only/unavailable, bo `superadmin.routes.ts` ma zdublowane sciezki `/webhooks`, a widok uderzal w nie przez reczne `Api.get/post/delete('/api/superadmin/webhooks')`;
- usunieto aktywny modal `Create Webhook`;
- usunieto aktywne akcje `Send test event` i `Delete webhook`;
- UI nie pokazuje juz `No webhooks configured`, ktore moglo ukrywac blad route/backend jako pusty stan.

Test:

```text
npx vitest run tests/unit/views/superadmin/APIManagementView.webhooks.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint src/views/superadmin/APIManagementView.tsx tests/unit/views/superadmin/APIManagementView.webhooks.test.tsx --no-warn-ignored
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `APIManagementView` (`@ts-nocheck`, `any`, `console`).

### 23I. Status po W1-12

Paczka `Agent D / Governance compliance data honesty` domknela kolejny wariant falszywego pustego stanu w SuperAdmin Governance. Backendowe endpointy dla DSAR, audits i processing records istnieja, wiec nie blokujemy ich mutacji na slepo. Problemem bylo to, ze awaria pobierania danych byla mapowana na puste listy i UI pokazywal komunikaty typu `No data subject requests`, `No audits scheduled` albo `No processing records`.

Wdrozone:

- `ComplianceCenterView` zapamietuje osobne bledy ladowania dla DSAR, compliance audits i processing records;
- zakladka DSAR pokazuje `DSAR requests unavailable`, gdy endpoint nie odpowie, zamiast pustej listy;
- zakladka Audits pokazuje `Compliance audits unavailable`, gdy endpoint nie odpowie, zamiast `No audits scheduled`;
- zakladka Processing Records pokazuje `Processing records unavailable`, gdy endpoint nie odpowie, zamiast `No processing records`;
- prawdziwe puste listy nadal zostaja pokazane jako empty state.

Test:

```text
npx vitest run tests/unit/views/superadmin/ComplianceCenterView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint src/views/superadmin/ComplianceCenterView.tsx tests/unit/views/superadmin/ComplianceCenterView.honesty.test.tsx
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `ComplianceCenterView` (`@ts-nocheck`, `any`, `console`, martwy `STATUS_COLORS`). Test file jest ignorowany przez aktualny pattern ESLint, co zostalo zaraportowane jako warning, nie blad.

### 23J. Status po W1-13

Paczka `Agent D / Governance approvals and legal honesty` domknela kolejny falszywy pusty stan w module Governance. Endpointy approvals i legal istnieja, wiec nie blokujemy dzialajacych mutacji. Naprawa dotyczy sytuacji, w ktorej awaria ladowania byla prezentowana jako `No workflows configured`, `No approval requests` albo `No legal documents found`.

Wdrozone:

- `ApprovalWorkflowsView` ma osobny `loadError` dla inicjalnego pobierania workflows/requests;
- zakladka Workflows pokazuje `Approval workflows unavailable`, gdy nie udalo sie pobrac danych;
- zakladka Requests pokazuje `Approval requests unavailable`, gdy nie udalo sie pobrac danych;
- `SuperAdminLegalView` ma osobny `loadError` dla pobierania legal docs;
- lista dokumentow prawnych pokazuje `Legal documents unavailable`, gdy endpoint nie odpowie;
- prawdziwe puste odpowiedzi nadal zostaja pustymi stanami.

Test:

```text
npx vitest run tests/unit/views/superadmin/ApprovalWorkflowsView.honesty.test.tsx tests/unit/views/superadmin/SuperAdminLegalView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 2 passed
Tests: 2 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/ApprovalWorkflowsView.tsx
ReadLints: ApprovalWorkflowsView, SuperAdminLegalView, nowe testy
```

Wynik: brak bledow lintera po autoformatowaniu. Pozostaja istniejace ostrzezenia w duzych widokach (`any`, nieuzyte importy, `console`).

### 23K. Status po W1-14

Paczka `Agent D / Governance exports honesty` domknela niespojny workflow w zakladce `Exports & Retention`. `DataExportPanel` uzywal frontendowych sciezek `/data-export/requests`, ktorych nie ma jako spojnego SuperAdmin workflow w `superadmin.routes.ts`. Rownolegle backend ma krytyczny `/superadmin/data/bulk-export` zabezpieczony confirmation i audit. Do czasu pogodzenia tych dwoch modeli panel nie moze wygladac jak gotowe narzedzie do tworzenia, anulowania i pobierania exportow.

Wdrozone:

- `DataExportPanel` nie uderza juz w `/data-export/requests`;
- lista export requests nie pokazuje juz falszywego `No export requests found`;
- panel pokazuje `Data export workflow unavailable`;
- `Request Export` jest disabled z powodem;
- filtry organizacji i statusu sa disabled, bo workflow listowania nie jest gotowy;
- ewentualne akcje download/cancel w panelu sa disabled do czasu polaczenia z audytowanym bulk-export lifecycle.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/DataExportPanel.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/components/SuperAdmin/data/DataExportPanel.tsx
npx eslint src/components/SuperAdmin/data/DataExportPanel.tsx tests/unit/components/SuperAdmin/DataExportPanel.honesty.test.tsx --no-warn-ignored
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `DataExportPanel` (`@ts-nocheck`, `console`).

### 23L. Status po W1-15

Paczka `Agent D / Legacy backup config honesty` domknela drugi stary panel oparty o niespojny namespace `/data-export/backup-*`. `BackupConfigPanel` probowal pobierac `/data-export/backup-config`, `/data-export/backup-history`, zapisywac konfiguracje i triggerowac backup. Tych sciezek nie ma jako spojny SuperAdmin workflow; rownolegle istnieje osobny `/superadmin/backup/schedules` oraz juz poprawiony `EnterpriseBackupPanel`.

Wdrozone:

- `BackupConfigPanel` nie uderza juz w `/data-export/backup-config`;
- `BackupConfigPanel` nie uderza juz w `/data-export/backup-history`;
- `Run Backup Now` jest disabled z powodem;
- `Save Changes` jest disabled z powodem;
- zamiast konfiguracji i pustej historii panel pokazuje `Backup configuration workflow unavailable`;
- copy wskazuje, ze stary panel musi zostac pogodzony z audytowanym SuperAdmin backup schedule workflow.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/BackupConfigPanel.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/components/SuperAdmin/data/BackupConfigPanel.tsx
npx eslint src/components/SuperAdmin/data/BackupConfigPanel.tsx tests/unit/components/SuperAdmin/BackupConfigPanel.honesty.test.tsx --no-warn-ignored
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `BackupConfigPanel` (`@ts-nocheck`, `console`, `any`).

### 23M. Status po W1-16

Paczka `Agent B / SCIM provisioning verification` sprawdzila `SCIMProvisioningView` po paczkach Governance/Data. W tym przypadku nie bylo potrzeby degradowac panelu: backend ma realny router `/api/scim/admin` oraz protokolowy `/api/scim/v2`, a widok uzywa tych sciezek przez `api.get/post/delete('/scim/admin/...')`.

Decyzja:

- SCIM zostaje aktywny;
- nie blokujemy `Enable SCIM`, tokenow, group mappings, sync ani conflict resolution;
- dodano test regresyjny pilnujacy, ze awaria ladowania admin SCIM data pokazuje `Failed to load SCIM data`, a nie puste stany typu `No tokens generated yet`, `No group mappings configured`, `No sync activity yet` albo `No conflicts detected`.

Test:

```text
npx vitest run tests/unit/views/superadmin/SCIMProvisioningView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint tests/unit/views/superadmin/SCIMProvisioningView.honesty.test.tsx --no-warn-ignored
ReadLints: SCIMProvisioningView.honesty.test.tsx
```

Wynik: brak bledow.

### 23N. Status po W1-17

Paczka `Agent B / SSO configuration honesty` sprawdzila `SSOConfigurationView`. Backend ma realny router `/api/sso` z publicznymi flow OIDC/SAML oraz SuperAdmin CRUD (`/api/sso/configs`, `/api/sso/google/config`, `/api/sso/saml/config`, `/api/sso/saml/validate`, `/api/sso/domains`). Nie blokujemy wiec dzialajacych akcji.

Wdrozone:

- `SSOConfigurationView` ma osobny blad ladowania dla listy SSO configs;
- overview pokazuje `SSO configurations unavailable`, gdy `/api/sso/configs` nie odpowie, zamiast `No SSO configurations found`;
- `SSOConfigurationView` ma osobny blad ladowania dla domain mappings;
- zakladka Domain Mapping pokazuje `SSO domain mappings unavailable`, gdy `/api/sso/domains` nie odpowie, zamiast `No domain mappings configured yet`;
- copy w Google/OIDC zostalo poprawione z falszywego `callback processing is not implemented` na informację, ze OIDC flow jest aktywny i trzeba zweryfikowac provider przed enforcement;
- copy w SAML zostalo poprawione analogicznie: SAML login/callback sa aktywne, ale metadata trzeba zwalidowac przed enforcement.

Test:

```text
npx vitest run tests/unit/views/superadmin/SSOConfigurationView.honesty.test.tsx --maxWorkers=1 --maxConcurrency=1
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/SSOConfigurationView.tsx
npx eslint src/views/superadmin/SSOConfigurationView.tsx tests/unit/views/superadmin/SSOConfigurationView.honesty.test.tsx --no-warn-ignored
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `SSOConfigurationView` (`@ts-nocheck`, `any`, `console`, nieuzyte stare stany/importy).

### 23O. Status po W1-18

Paczka `Agent B / Admin sessions honesty` sprawdzila `AdminSessionsView`. Backend ma realne endpointy `/api/superadmin/admin/sessions`, `/api/superadmin/admin/sessions/stats`, `DELETE /api/superadmin/admin/sessions/:id` oraz `POST /api/superadmin/admin/sessions/revoke-all`, zabezpieczone `security_ops`, wiec nie blokujemy dzialajacych akcji revoke. Problemem byl falszywy stan przy awarii ladowania: widok potrafil pokazac zerowe statystyki i `No active sessions found`, mimo ze lista sesji byla niedostepna.

Wdrozone:

- `AdminSessionsView` ma osobny `loadError` dla poczatkowego pobierania sesji/statystyk;
- awaria ladowania pokazuje `Admin sessions unavailable` przy statystykach;
- tabela sesji pokazuje `Active admin sessions unavailable`, zamiast `No active sessions found`;
- statystyki nie sa renderowane jako zera, gdy dane nie zostaly pobrane;
- `Revoke All Sessions` jest disabled, gdy lista sesji jest niedostepna.

Test:

```text
npx vitest run tests/unit/views/superadmin/AdminSessionsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/AdminSessionsView.tsx
npx eslint src/views/superadmin/iam/AdminSessionsView.tsx
ReadLints: AdminSessionsView, AdminSessionsView.honesty.test.tsx
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `AdminSessionsView` (`any` w legacy mapowaniu odpowiedzi API). Test file jest ignorowany przez aktualny pattern ESLint, ale `ReadLints` nie pokazuje bledow.

### 23P. Status po W1-19

Paczka `Agent B / Permissions matrix honesty` sprawdzila `PermissionsMatrixView`. Backend ma realne endpointy `/api/superadmin/admin/permissions`, `/api/superadmin/admin/permissions/matrix`, `/api/superadmin/admin/permissions/stats`, role toggle i copy permissions, wiec nie blokujemy calego workflow. Problem byl po stronie prezentacji awarii: gdy inicjalny load permissions/matrix/stats nie dzialal, UI mogl wygladac jak prawdziwie pusty zestaw permission definitions i aktywny panel zarzadzania.

Wdrozone:

- `PermissionsMatrixView` ma osobny `loadError` dla poczatkowego pobierania danych;
- awaria ladowania pokazuje `Permissions unavailable` zamiast zerowych statystyk;
- matrix pokazuje `Permissions matrix unavailable`, gdy dane matrix sa niedostepne;
- lista definitions pokazuje `Permission definitions unavailable`, zamiast `No permissions defined`;
- `Copy Permissions` i `Add Permission` sa disabled, gdy nie znamy aktualnego stanu permissions.

Test:

```text
npx vitest run tests/unit/views/superadmin/PermissionsMatrixView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/PermissionsMatrixView.tsx
npx eslint src/views/superadmin/iam/PermissionsMatrixView.tsx
ReadLints: PermissionsMatrixView, PermissionsMatrixView.honesty.test.tsx
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `PermissionsMatrixView` (`any` w legacy mapowaniu odpowiedzi API). `ReadLints` nie pokazuje bledow.

### 23Q. Status po W1-20

Paczka `Agent B / Security incidents honesty` sprawdzila `SecurityIncidentsView`. Backend ma realne endpointy `/api/superadmin/security/incidents`, `/api/superadmin/security/incidents/stats`, create, resolve i delete, wiec workflow zostaje aktywny po poprawnym ladowaniu danych. Problemem byl falszywy empty state: awaria pobierania incydentow/statystyk mogla wygladac jak zero incydentow i `No security incidents found`.

Wdrozone:

- `SecurityIncidentsView` ma osobny `loadError` dla poczatkowego pobierania listy/statystyk;
- awaria ladowania pokazuje `Security incidents unavailable`, zamiast zerowych statystyk;
- tabela pokazuje `Security incident list unavailable`, zamiast `No security incidents found`;
- `Filters` i `Report Incident` sa disabled, gdy nie znamy aktualnego stanu listy incydentow;
- prawdziwie pusta lista nadal zostaje empty state po poprawnym loadzie.

Test:

```text
npx vitest run tests/unit/views/superadmin/SecurityIncidentsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/SecurityIncidentsView.tsx
npx eslint src/views/superadmin/iam/SecurityIncidentsView.tsx
ReadLints: SecurityIncidentsView, SecurityIncidentsView.honesty.test.tsx
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w `SecurityIncidentsView` (`react-hooks/exhaustive-deps`, `any`). `ReadLints` nie pokazuje bledow.

### 23R. Status po W1-21

Paczka `Agent B / Threat intelligence honesty` sprawdzila `ThreatIntelligenceView`. Backend ma realne endpointy `/api/superadmin/security/threats`, `/api/superadmin/security/threats/stats`, add/block/unblock/delete oraz reputation checks, wiec workflow zostaje aktywny po poprawnym ladowaniu danych. Problemem byl falszywy empty state przy awarii feedu: UI mogl wygladac jak zero zagrozen i `No threats found`.

Wdrozone:

- `ThreatIntelligenceView` ma osobny `loadError` dla poczatkowego pobierania listy/statystyk;
- awaria ladowania pokazuje `Threat intelligence unavailable`, zamiast zerowych statystyk;
- tabela pokazuje `Threat list unavailable`, zamiast `No threats found`;
- `Filters` i `Add Threat` sa disabled, gdy lista threat intelligence jest niedostepna;
- `Check Reputation` zostaje dostepne, bo korzysta z osobnych endpointow lookup i ma wlasna obsluge bledow;
- prawdziwie pusty feed nadal zostaje empty state po poprawnym loadzie.

Test:

```text
npx vitest run tests/unit/views/superadmin/ThreatIntelligenceView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/ThreatIntelligenceView.tsx
npx eslint src/views/superadmin/iam/ThreatIntelligenceView.tsx
ReadLints: ThreatIntelligenceView, ThreatIntelligenceView.honesty.test.tsx
```

Wynik: brak bledow; usunieto martwe importy `Eye` i `Upload`. Pozostaja istniejace ostrzezenia w `ThreatIntelligenceView` (`react-hooks/exhaustive-deps`, `any`). `ReadLints` nie pokazuje bledow.

### 23S. Status po W1-22

Paczka `Agent B / DLP honesty` sprawdzila `DLPView`. Backend ma realne endpointy `/api/superadmin/security/dlp/policies`, `/api/superadmin/security/dlp/violations`, `/api/superadmin/security/dlp/stats`, create/toggle/delete policy oraz resolve violation, wiec workflow zostaje aktywny po poprawnym ladowaniu danych. Problemem byl falszywy empty state przy awarii DLP: UI mogl wygladac jak brak polityk albo brak nierozwiazanych naruszen.

Wdrozone:

- `DLPView` ma osobny `loadError` dla poczatkowego pobierania policies/violations/stats;
- awaria ladowania pokazuje `DLP data unavailable`, zamiast zerowych statystyk;
- zakladka Policies pokazuje `DLP policies unavailable`, zamiast `No DLP policies found`;
- zakladka Violations pokazuje `DLP violations unavailable`, zamiast `No unresolved violations`;
- `Create Policy` jest disabled, gdy nie znamy aktualnego stanu polityk DLP;
- prawdziwie puste listy nadal zostaja empty state po poprawnym loadzie.

Test:

```text
npx vitest run tests/unit/views/superadmin/DLPView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/DLPView.tsx
npx eslint src/views/superadmin/iam/DLPView.tsx
ReadLints: DLPView, DLPView.honesty.test.tsx
```

Wynik: brak bledow; usunieto martwe importy `Eye`, `Filter`, `Shield`. Pozostaja istniejace ostrzezenia w `DLPView` (`any`). `ReadLints` nie pokazuje bledow.

### 23T. Status po W1-23

Paczka `Agent B / Audit events honesty` sprawdzila `AuditEventsViewer`. Widok korzysta z realnego endpointu `/api/audit/events`, wiec nie wymaga degradacji stalej. Problemem byl falszywy empty state przy awarii audytu: UI mogl pokazac `0 events` i `No audit events found`, mimo ze audit trail byl niedostepny.

Wdrozone:

- `AuditEventsViewer` ma osobny `loadError` dla pobierania audit events;
- awaria ladowania pokazuje `Audit events unavailable`, zamiast `No audit events found`;
- licznik pokazuje `Events unavailable`, zamiast falszywego `0 events`;
- filtry `Resource type`, `Actor ID` i daty sa disabled, gdy audit trail jest niedostepny;
- `Refresh` pozostaje aktywny jako jawna proba ponownego pobrania danych.

Test:

```text
npx vitest run tests/unit/views/superadmin/AuditEventsViewer.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/AuditEventsViewer.tsx
npx eslint src/views/superadmin/iam/AuditEventsViewer.tsx
ReadLints: AuditEventsViewer, AuditEventsViewer.honesty.test.tsx
```

Wynik: brak bledow; pozostaje jedno istniejace ostrzezenie `any` w `AuditEventsViewer`. `ReadLints` nie pokazuje bledow.

### 23U. Status po W1-24

Paczka `Agent B / Admin audit logs honesty` sprawdzila `AdminAuditLogsView`. Backend ma realne endpointy `/api/superadmin/admin/audit-logs`, `/api/superadmin/admin/audit-logs/stats`, export i resolve, wiec workflow zostaje aktywny po poprawnym ladowaniu danych. Problemem byl falszywy empty/clean state przy awarii: UI mogl pokazac zerowe statystyki i `No audit logs found`, mimo ze logi administracyjne byly niedostepne.

Wdrozone:

- `AdminAuditLogsView` ma osobny `loadError` dla poczatkowego pobierania listy/statystyk;
- awaria ladowania pokazuje `Admin audit logs unavailable`, zamiast zerowych statystyk;
- tabela pokazuje `Admin audit log list unavailable`, zamiast `No audit logs found`;
- `Filters` i `Export CSV` sa disabled, gdy nie znamy aktualnego stanu logow;
- `Refresh` pozostaje aktywny jako jawna proba ponownego pobrania danych;
- prawdziwie pusta lista nadal zostaje empty state po poprawnym loadzie.

Test:

```text
npx vitest run tests/unit/views/superadmin/AdminAuditLogsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/iam/AdminAuditLogsView.tsx
npx eslint src/views/superadmin/iam/AdminAuditLogsView.tsx
ReadLints: AdminAuditLogsView, AdminAuditLogsView.honesty.test.tsx
```

Wynik: brak bledow; usunieto martwy import `Eye`. Pozostaja istniejace ostrzezenia w `AdminAuditLogsView` (`react-hooks/exhaustive-deps`, `any`). `ReadLints` nie pokazuje bledow.

### 23V. Status po W1-25

Paczka `Agent B / Security policies honesty` sprawdzila `SecurityPoliciesView`. Backend ma realne endpointy `/api/security-policies/defaults`, `/api/security-policies/all`, preset/save oraz `/api/superadmin/org-policies`, wiec glowny workflow polityk zostaje aktywny po poprawnym ladowaniu danych. Znaleziono jednak dwa nieuczciwe stany: awaria initial load mogla zostawic pusty panel bez jasnej informacji, a zakladka `Account Lockouts` byla wypelniana sztucznym `[]`, przez co pokazywala `No locked accounts` mimo braku pobierania audytowanej listy lockoutow.

Wdrozone:

- `SecurityPoliciesView` ma osobny `loadError` dla poczatkowego pobierania default policy, org listy i policy map;
- awaria ladowania pokazuje `Security policies unavailable`, zamiast pustej konfiguracji;
- data governance ma osobny `dataGovLoadError` i pokazuje `Data governance policies unavailable`, gdy `/api/superadmin/org-policies` nie odpowie;
- `Account Lockouts` pokazuje `Account lockout list unavailable`, zamiast `No locked accounts`;
- usunieto lokalny fake state `lockouts = []` i martwy handler `handleUnlockAccount`, bo widok nie ma jeszcze list endpointu;
- `Refresh` pozostaje aktywny jako jawna proba ponownego pobrania danych.

Test:

```text
npx vitest run tests/unit/views/superadmin/SecurityPoliciesView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/SecurityPoliciesView.tsx
npx eslint src/views/superadmin/SecurityPoliciesView.tsx
ReadLints: SecurityPoliciesView, SecurityPoliciesView.honesty.test.tsx
```

Wynik: brak bledow; usunieto martwe importy i martwy lockout state. Pozostaja istniejace ostrzezenia w `SecurityPoliciesView` (`@ts-nocheck`, `any`, `console`). `ReadLints` nie pokazuje bledow.

### 23W. Status po W1-26

Paczka `Agent B / Final Security sweep` domknela pozostale panele Security, ktore nie byly jeszcze pokryte osobna paczka honest UI. Sprawdzone zostaly `GlobalSecurityPostureView`, `CustomRolesBuilder` i `AIBudgetsView`. `CustomRolesBuilder` juz mial osobny load error i nie wymagal zmiany. Dwa pozostale widoki mialy falszywe fallbacki.

Wdrozone:

- `GlobalSecurityPostureView` nie renderuje juz zerowych metryk posture po awarii `system-health` albo `operator/overview`;
- zamiast `Privileged sessions = 0`, `Audit debt = 0`, `Platform health = unknown` pokazuje `Global security posture unavailable`;
- `AIBudgetsView` czysci stan po awarii initial load i pokazuje `AI budget controls unavailable`;
- `AIBudgetsView` nie pokazuje juz `No budgets configured`, `$0.00 Total AI Spending` ani przycisku `Create Budget`, gdy dane budzetow AI sa niedostepne.

Test:

```text
npx vitest run tests/unit/views/superadmin/GlobalSecurityPostureView.honesty.test.tsx tests/unit/views/superadmin/AIBudgetsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 2 passed
Tests: 2 passed
```

Lint:

```text
npx eslint --fix src/views/superadmin/GlobalSecurityPostureView.tsx src/views/superadmin/AIBudgetsView.tsx
npx eslint src/views/superadmin/GlobalSecurityPostureView.tsx src/views/superadmin/AIBudgetsView.tsx
ReadLints: GlobalSecurityPostureView, AIBudgetsView, nowe testy
```

Wynik: brak bledow; pozostaja istniejace ostrzezenia w legacy widokach (`any`, `console`). `ReadLints` nie pokazuje bledow.

### 23X. Weryfikacja po domknieciu fali Security / honest UI

Po `W1-26` uruchomiono szerszy pakiet regresyjny dla wszystkich testow `honesty` dodanych w tej fali oraz w poprzednich paczkach SuperAdmin/Admin Settings.

Test:

```text
npx vitest run \
  tests/unit/views/superadmin/AIBudgetsView.honesty.test.tsx \
  tests/unit/views/superadmin/GlobalSecurityPostureView.honesty.test.tsx \
  tests/unit/views/superadmin/SecurityPoliciesView.honesty.test.tsx \
  tests/unit/views/superadmin/AdminAuditLogsView.honesty.test.tsx \
  tests/unit/views/superadmin/AuditEventsViewer.honesty.test.tsx \
  tests/unit/views/superadmin/DLPView.honesty.test.tsx \
  tests/unit/views/superadmin/ThreatIntelligenceView.honesty.test.tsx \
  tests/unit/views/superadmin/SecurityIncidentsView.honesty.test.tsx \
  tests/unit/views/superadmin/PermissionsMatrixView.honesty.test.tsx \
  tests/unit/views/superadmin/AdminSessionsView.honesty.test.tsx \
  tests/unit/views/superadmin/SSOConfigurationView.honesty.test.tsx \
  tests/unit/views/superadmin/SCIMProvisioningView.honesty.test.tsx \
  tests/unit/components/SuperAdmin/BackupConfigPanel.honesty.test.tsx \
  tests/unit/components/SuperAdmin/DataExportPanel.honesty.test.tsx \
  tests/unit/views/superadmin/SuperAdminLegalView.honesty.test.tsx \
  tests/unit/views/superadmin/ApprovalWorkflowsView.honesty.test.tsx \
  tests/unit/views/superadmin/ComplianceCenterView.honesty.test.tsx
```

Wynik:

```text
Test Files: 17 passed
Tests: 18 passed
```

Dodatkowe gate:

```text
npm run type-check
```

Wynik: TypeScript check przeszedl bez bledow.

Lint kontrolny:

```text
npx eslint src/views/superadmin/GlobalSecurityPostureView.tsx src/views/superadmin/AIBudgetsView.tsx src/views/superadmin/SecurityPoliciesView.tsx src/views/superadmin/iam/AdminAuditLogsView.tsx ...
ReadLints: zmienione pliki finalnego sweepu
```

Wynik: brak bledow. Pozostaja ostrzezenia w legacy plikach (`@ts-nocheck`, `any`, `console`, `react-hooks/exhaustive-deps`) oraz warningi, ze niektore test files sa ignorowane przez aktualny pattern ESLint. `ReadLints` nie pokazuje bledow.

### 23Y. Status po sweepie legacy `EnterpriseSecurityPanel`

Po domknieciu glownej fali Security wykonano dodatkowy sweep starszego panelu systemowego `EnterpriseSecurityPanel`, ktory nadal byl dostepny z `SystemModule`. Panel mial kilka falszywych stanow:

- awaria `getSecurityEvents` zostawiala liste jako pusta i mogla pokazac `No security events found`;
- awaria `getSuperAdminActiveSessions` pokazywala `No active sessions`;
- awaria `getIPAccessRules` pokazywala `No IP rules configured` oraz komunikat sugerujacy, ze wszystkie IP sa dozwolone;
- awarie `getSecurityPolicies` i `getComplianceFrameworks` czyscily stan bez uczciwego komunikatu;
- `Terminate All`, `Add Rule`, `Run Assessment` oraz SIEM konfiguracja byly widoczne jako akcje, mimo ze nie ma tu kompletnego audytowanego workflow.

Wdrozone:

- dodano per-zakladkowe `loadErrors` i `DegradedState` dla events, sessions, IP rules, policies oraz compliance;
- filtry security events sa disabled, gdy lista security events jest niedostepna;
- IP `Add Rule`, sesyjne `Terminate All` i compliance `Run Assessment` sa disabled z tytulem wyjasniajacym brak audytowanego workflow;
- SIEM configuration pokazuje `ReadOnlyState` zamiast aktywnej akcji konfiguracji.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseSecurityPanel.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 4 passed
```

Szersza regresja honest UI:

```text
npx vitest run <18 honesty test files including EnterpriseSecurityPanel.honesty.test.tsx>
```

Wynik:

```text
Test Files: 18 passed
Tests: 22 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseSecurityPanel.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseSecurityPanel.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, unused caught error names).

### 23BA. Status po koncowym sweepie Settings honest UI

Koncowy sweep po admin/superadmin objal pozostale wysokiego ryzyka komponenty `Settings`, gdzie UI mogl nadal udawac dzialajace funkcje mimo braku backendu albo awarii zrodel danych.

Wdrozone:

- `NotificationRulesBuilder`: usunieto symulowany zapis i oznaczono reguly, digest, keywords oraz VIP contacts jako read-only do czasu podlaczenia persistence API;
- `PersonalAnalyticsModule`: usunieto losowo generowane mock metryki i heatmapy; panel pokazuje `Personal analytics unavailable`, a export/filtry sa blokowane;
- `AuthenticationAccessPage`: awarie active sessions, login history i recovery options sa rozrozniane od prawdziwie pustych list;
- `RecoveryOptionsSettings`: usunieto generowanie backup codes w przegladarce; generowanie wymaga backend response z kodami, a awaria recovery API nie jest juz maskowana emailem uzytkownika;
- `KeyboardShortcutsEditor`: usunieto sample shortcuts jako zrodlo prawdy; lista laduje sie z API albo pokazuje `Keyboard shortcuts unavailable`, a reset bez backend defaults nie pokazuje fake success;
- `ExportDataSettings`: export history laduje sie z API; awaria pokazuje `Export history unavailable` zamiast `No export requests yet`;
- `PersonalAutomationSettings`: awarie automations/logs nie sa juz zamieniane na puste listy; template creation jest jawnie read-only, a statystyka `Successful (24h)` filtruje realne 24h;
- `DeveloperSettings`: feature flags nie sa juz statyczna lista; panel laduje je z API, refresh jest podlaczony, a awaria pokazuje `Feature flags unavailable`;
- `LegalSettings`: awaria legal docs/content pokazuje degraded state zamiast pustej listy albo pustego modala;
- `SettingsTemplates`: awaria listy template pokazuje `Settings templates unavailable`; create pokazuje sukces tylko gdy backend zwroci utworzony template.

Dodane testy focused:

```text
tests/unit/components/settings/AuthenticationAccessPage.honesty.test.tsx
tests/unit/components/settings/DeveloperSettings.honesty.test.tsx
tests/unit/components/settings/ExportDataSettings.honesty.test.tsx
tests/unit/components/settings/KeyboardShortcutsEditor.honesty.test.tsx
tests/unit/components/settings/LegalSettings.honesty.test.tsx
tests/unit/components/settings/NotificationRulesBuilder.honesty.test.tsx
tests/unit/components/settings/PersonalAnalyticsModule.honesty.test.tsx
tests/unit/components/settings/PersonalAutomationSettings.honesty.test.tsx
tests/unit/components/settings/RecoveryOptionsSettings.honesty.test.tsx
tests/unit/components/settings/SettingsTemplates.honesty.test.tsx
```

Focused Settings regression:

```text
npx vitest run tests/unit/components/settings/*.honesty.test.tsx
```

Wynik:

```text
Test Files: 10 passed
Tests: 10 passed
```

Pelna regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx
```

Wynik:

```text
Test Files: 60 passed
Tests: 80 passed
```

Dodatkowe gate:

```text
npm run type-check
ReadLints: src/components/settings + tests/unit/components/settings
```

Wynik: TypeScript check przeszedl bez bledow, a ReadLints nie wykazal nowych bledow lintera. ESLint `--fix` na zmienionych Settings plikach zakonczyl sie bez bledow; pozostaja ostrzezenia legacy typu `any`, `console`, martwe importy i ignorowane przez konfiguracje pliki testowe.

### 23BB. Status po partii refresh-proof dla Org AI Settings i API Keys

Po zakonczeniu sweepu honest UI kolejna partia przeszla z samego degradowania UI do produkcyjnego zachowania `save/create/revoke -> refetch -> refresh/remount proof` dla dwoch istniejacych workflowow.

Wdrozone:

- `OrgAISettingsView`: po `PUT /api/ai-settings/org/:orgId` widok nie ufa juz lokalnemu echo z requestu; wykonuje ponowny `GET /api/ai-settings/org/:orgId`, normalizuje persisted response i dopiero wtedy czysci `hasChanges`;
- `OrgAISettingsView`: test potwierdza, ze zmiana ustawienia AI zapisuje sie przez `updateOrganizationAISettings`, jest odczytywana ponownie z backendu i pozostaje widoczna po remount;
- `ApiKeysManagementView`: po utworzeniu klucza `POST /api/api-keys` czeka na `loadApiKeys()`, zanim workflow zostanie uznany za zakonczony;
- `ApiKeysManagementView`: obsluga odpowiedzi create akceptuje zarowno `plainTextKey`, jak i starszy ksztalt `apiKey` / `key.apiKey` / `key.key`;
- `ApiKeysManagementView`: revoke czeka na refetch po `DELETE /api/api-keys/:keyId`, dzieki czemu lista nie zostaje w stanie lokalnego zalozenia;
- `ResearchSessionsDock`: naprawiono niezalezny blad type-check w handlerze `Refresh`, opakowujac `load()` w funkcje `onClick`.

Focused tests:

```text
npx vitest run tests/unit/views/admin/OrgAISettingsView.honesty.test.tsx tests/unit/views/admin/ApiKeysManagementView.honesty.test.tsx
```

Wynik:

```text
Test Files: 2 passed
Tests: 4 passed
```

Szersza regresja Admin honest UI:

```text
npx vitest run tests/unit/views/admin/*.honesty.test.tsx
```

Wynik:

```text
Test Files: 19 passed
Tests: 26 passed
```

Dodatkowe gate:

```text
npm run type-check
ReadLints: OrgAISettingsView, ApiKeysManagementView i ich testy
```

Wynik: TypeScript check przeszedl bez bledow. ReadLints nie wykazal bledow w zmienionych plikach. ESLint `--fix` dla plikow partii zakonczyl sie bez bledow; pozostaja ostrzezenia legacy typu `any`, `console`, stare nieuzyte importy i `react-hooks/exhaustive-deps`.

### 23BC. Status po partii partial Admin Overview dla delegowanych adminow

Kolejna partia objela `GET /api/admin/overview` i panel `/admin/overview`. Przed poprawka overview wymagalo jednoczesnie `people:read`, `security:read` i `billing:read`, wiec delegowany admin z waskim zakresem, np. tylko `billing:read`, dostawal twardy brak dostepu do calego panelu. To bylo niezgodne z zasada honest UI: czesc danych byla dostepna, ale interfejs pokazywal caly cockpit jako niedostepny.

Wdrozone:

- `server/src/routes/adminP32.routes.ts`: endpoint `/overview` najpierw waliduje tylko prawo wejscia do Admin cockpit, a potem ocenia capability per sekcja;
- backend zwraca `sectionErrors` dla niedostepnych obszarow: `people`, `ownership`, `security`, `collaboration`, `billing`, `ai`, `audit`;
- backend pobiera tylko te zrodla danych, do ktorych aktor ma capability, zamiast odpytywac wszystko i konczyc calosc 403;
- `AdminEnterpriseOverviewPanel`: panel renderuje dostepne karty i oznacza niedostepne sekcje jako `Unavailable` z komunikatem z backendu;
- usunieto mylace fallbacki typu `0` dla sekcji bez dostepu, np. brak `people:read` daje `Unavailable`, a nie `0 members`;
- twarde zabezpieczenia pozostaja: brak czlonkostwa, cross-tenant access i brak jakichkolwiek delegowanych capability nadal sa blokowane przed overview.

Focused tests:

```text
npx vitest run tests/integration/routes/adminP32.overview.test.ts
npx vitest run tests/unit/components/Admin/AdminEnterpriseOverviewPanel.test.tsx
```

Wynik:

```text
Backend: 1 file passed, 1 test passed
Frontend: 1 file passed, 1 test passed
```

Szersza regresja komponentow Admin:

```text
npx vitest run tests/unit/components/Admin/AdminEnterpriseOverviewPanel.test.tsx tests/unit/components/Admin/AdminMembersRolesPanel.test.tsx tests/unit/components/Admin/AdminState.test.tsx
```

Wynik:

```text
Test Files: 3 passed
Tests: 6 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/Admin/AdminEnterpriseOverviewPanel.tsx tests/unit/components/Admin/AdminEnterpriseOverviewPanel.test.tsx tests/integration/routes/adminP32.overview.test.ts
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla nowych/zmienionych frontendowych i testowych plikow zakonczyl sie bez bledow; w `adminP32.routes.ts` pozostaja istniejace ostrzezenia legacy typu `any` poza zakresem tej partii.

### 23AX. Status po sweepie Tenant Admin Billing `AdminBillingManagement`

Kolejny sweep objal tenantowy hub billingowy `AdminBillingManagement`. Panel agreguje kilka zrodel danych naraz: current billing, seat configuration, usage, invoices, plans i add-ons. Przed poprawka awarie tych zrodel mogly wygladac jak normalne dane fallbackowe:

- billing summary mogl przejsc w `No Plan`/`Error Loading` z zerowymi wartosciami;
- usage po awarii zostawialo `--` bez jasnego rozroznienia miedzy brakiem danych a niedostepnoscia API;
- awaria invoices mogla wygladac jak `No invoices found`;
- awaria plans/add-ons byla cicha i zostawiala puste listy w modalach.

Wdrozone:

- dodano osobne stany degraded dla billing summary, usage, invoices, plans i add-ons;
- awaria billing/seat configuration czyści billing summary i pokazuje `Billing summary unavailable`, bez fallbackowego planu lub zerowej kwoty;
- `Change Plan` i `Add-ons` sa disabled, kiedy podstawowe dane billingowe sa niedostepne;
- usage pokazuje `Usage unavailable` zamiast niejednoznacznych placeholderow;
- invoices pokazuja `Invoices unavailable` zamiast `No invoices found` po awarii API;
- plans i add-ons traktuja non-OK odpowiedzi jako awarie i pokazuja jawne degraded state w modalach.

Test:

```text
npx vitest run tests/unit/views/admin/AdminBillingManagement.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja admin honest UI:

```text
npx vitest run tests/unit/views/admin/*.honesty.test.tsx
```

Wynik:

```text
Test Files: 12 passed
Tests: 16 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/AdminBillingManagement.tsx tests/unit/views/admin/AdminBillingManagement.honesty.test.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, `react-hooks/exhaustive-deps`, unused caught error names).

### 23AY. Status po sweepie Tenant Admin Operations `RolesPermissionsView`, `AdminLLMView`, `OrganizationProfileView`, `BulkOperationsView`

Kolejny sweep objal tenant-admin widoki operacyjne, ktore nie byly jeszcze pokryte testami honest UI:

- `RolesPermissionsView` mial custom role create/edit/delete jako lokalny stan z sukces toastem, bez backend persistence;
- `AdminLLMView` renderowal health/status jako zera lub `NaN%`, a zakladki providers/prompts nie mialy uczciwej tresci;
- `OrganizationProfileView` po awarii GET zostawial seed defaults (`Technology`, `51-200`, kolory) jako edytowalny profil;
- `BulkOperationsView` renderowal awarie user list jako `No users found`, a blad transportowy importu jako row-level import errors.

Wdrozone:

- custom project roles w `RolesPermissionsView` oznaczono `ReadOnlyState`, a przyciski create/edit/delete sa disabled bez fake success;
- `AdminLLMView` ma degraded states dla providers, prompts, LLM health status i analytics; health tab nie pokazuje juz zer/`NaN`/`No logs found` po awarii;
- `OrganizationProfileView` pokazuje `Organization profile unavailable` po awarii loadu i blokuje formularze, zamiast wystawiac seeded defaults; favicon upload oznaczono read-only;
- `BulkOperationsView` pokazuje `Users unavailable` po awarii listy uzytkownikow oraz `User import unavailable` dla transportowego bledu importu.

Testy focused:

```text
npx vitest run tests/unit/views/admin/RolesPermissionsView.honesty.test.tsx
npx vitest run tests/unit/views/admin/AdminLLMView.honesty.test.tsx
npx vitest run tests/unit/views/admin/OrganizationProfileView.honesty.test.tsx
npx vitest run tests/unit/views/admin/BulkOperationsView.honesty.test.tsx
```

Wynik: wszystkie focused testy przeszly.

### 23AZ. Status po sweepie Tenant Admin AI/Token Billing `OrgAISettingsView`, `AdminTokenPackages`, `TokenBillingManagementView`

Ostatnia fala objela mniejsze, ale nadal istotne false-empty w konfiguracji AI i token billing:

- `OrgAISettingsView` nie rozroznial awarii loadu od realnego braku konfiguracji i mogl pokazac `No AI Settings Found`;
- `AdminTokenPackages` zapisywal `error`, ale nie renderowal go, wiec awaria listy wygladala jak pusty katalog z aktywnym `Create Package`;
- `TokenBillingManagementView` zamienial bledy poszczegolnych zrodel KPI na `[]`/`0`, przez co overview wygladal jak prawdziwe zerowe metryki;
- `AdminMarginConfig` traktowal nieprawidlowy response shape jak pusta liste marginow.

Wdrozone:

- `OrgAISettingsView` pokazuje `Organization AI settings unavailable` zamiast `No AI Settings Found` po bledzie API;
- `AdminTokenPackages` pokazuje `Token packages unavailable`, czysci liste po awarii i blokuje `Create Package`;
- `TokenBillingManagementView` uzywa `Promise.allSettled` i ukrywa KPI za `Token billing overview unavailable`, jezeli ktorekolwiek zrodlo overview nie zaladuje sie;
- `AdminMarginConfig` oznacza invalid response jako blad, nie jako pusta konfiguracje.

Testy:

```text
npx vitest run tests/unit/views/admin/OrgAISettingsView.honesty.test.tsx tests/unit/views/admin/AdminTokenPackages.honesty.test.tsx tests/unit/views/admin/TokenBillingManagementView.honesty.test.tsx
```

Wynik:

```text
Test Files: 3 passed
Tests: 3 passed
```

Szersza regresja Tenant Admin honest UI:

```text
npx vitest run tests/unit/views/admin/*.honesty.test.tsx
```

Wynik:

```text
Test Files: 19 passed
Tests: 24 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/OrgAISettingsView.tsx src/views/admin/AdminTokenPackages.tsx src/views/admin/TokenBillingManagementView.tsx src/views/admin/AdminMarginConfig.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla dotknietych plikow ma 0 bledow; pozostaja ostrzezenia legacy (`any`, `console`, unused imports/caught errors, exhaustive-deps).

### 23AA. Status po sweepie legacy `EnterpriseApiManagement`

Nastepny sweep objal `EnterpriseApiManagement` z systemowego modulu SuperAdmin. Panel mial realne UI do listy kluczy API, ale awaria initial load byla widoczna tylko jako toast i mogla zostawic ekran w stanie `No API keys found`.

Wdrozone:

- dodano `loadError` dla listy API keys i `usageLoadError` dla usage analytics;
- awaria `getApiKeys` czysci dane i pokazuje `API keys unavailable` zamiast pustej listy;
- `Create API Key` i wyszukiwarka sa disabled, gdy lista kluczy nie jest dostepna;
- zakladka `Usage Analytics` pokazuje `API key usage unavailable`, gdy lista kluczy nie zaladowala sie i nie da sie uczciwie wybrac klucza;
- nie pokazujemy juz instrukcji `Select an API key to view usage analytics` w stanie awarii.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseApiManagement.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <20 honesty test files including EnterpriseApiManagement>
```

Wynik:

```text
Test Files: 20 passed
Tests: 26 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseApiManagement.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseApiManagement.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AW. Status po sweepie Tenant Admin Teams `UserGroupsView`

Kolejny sweep objal tenant-admin teams/user groups. Widok ladowal `/api/teams` oraz `Api.getUsers()`, ale awaria dowolnego zrodla czyscila `groups` i `users` do pustych tablic, co renderowalo `No Teams` oraz aktywne `Create Team`. Dodatkowo update czlonkow zespolu wykonywal lokalna aktualizacje state nawet po bledzie requestu do `/api/teams/:id/members`, co tworzylo fake success.

Wdrozone:

- dodano `loadError` dla teams/users;
- non-OK response z `/api/teams` jest traktowany jako awaria;
- przy awarii renderuje sie `Teams unavailable` i `Team list unavailable`;
- `No Teams` jest zarezerwowane dla wiarygodnie zaladowanej pustej listy;
- search i `Create Team` sa disabled przy awarii load;
- add/remove member sprawdza `res.ok`; przy bledzie pokazuje toast error i nie aktualizuje lokalnego state.

Test:

```text
npx vitest run tests/unit/views/admin/UserGroupsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/admin/OwnershipManagementView.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 45 passed
Tests: 65 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/UserGroupsView.tsx
npx eslint src/views/admin/UserGroupsView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AS. Status po sweepie Tenant Admin Security `OwnershipManagementView`

Kolejny sweep objal tenant-admin ownership safeguards. Widok ladowal trzy krytyczne zrodla: ownership, adminow i pending transfer. Awaria ownership/admins czyscila dane do `null`/`[]`, przez co UI mogl pokazac karte wlasciciela z pustymi polami (`O`, pusty email, `Initial Setup`) zamiast informacji o awarii. Awaria pending transfer byla maskowana przez `.catch(() => null)`, co moglo ukryc aktywny proces transferu.

Wdrozone:

- dodano `loadError` dla ownership/admins;
- ownership/admins sa ladowane przez `Promise.allSettled`, ale rejection jednego z tych zrodel zatrzymuje renderowanie owner card;
- przy awarii globalnej renderuje sie `Ownership information unavailable`;
- owner card i transfer ownership action nie renderuja sie bez wiarygodnych danych;
- dodano `pendingTransferLoadError`;
- awaria pending transfer statusu pokazuje `Pending ownership transfer status unavailable`, ale nie ukrywa poprawnie zaladowanego wlasciciela.

Test:

```text
npx vitest run tests/unit/views/admin/OwnershipManagementView.test.tsx tests/unit/views/admin/OwnershipManagementView.honesty.test.tsx
```

Wynik:

```text
Test Files: 2 passed
Tests: 3 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/admin/OwnershipManagementView.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 41 passed
Tests: 60 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/OwnershipManagementView.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, unused caught errors).

### 23AT. Status po sweepie Tenant Admin Security `AuditLogView`

Kolejny sweep objal tenant-admin audit log. Widok przy awarii `Api.getAuditLogs` czyscil liste do `[]`, co renderowalo `No Activity Found` i aktywny export CSV. Dodatkowo `handleExport` mial krytyczny false-success path: w `catch` pokazywal `toast.success('Audit log exported')`.

Wdrozone:

- dodano `loadError` dla audit logow;
- awaria `Api.getAuditLogs` renderuje `Audit logs unavailable` i `Audit activity unavailable`;
- `No Activity Found` jest zarezerwowane dla wiarygodnie zaladowanej pustej listy;
- search/action/resource/date filters sa disabled przy awarii;
- Export CSV jest disabled przy awarii;
- export rzuca blad przy non-OK response;
- export catch pokazuje `toast.error('Audit log export failed')` zamiast falszywego sukcesu.

Test:

```text
npx vitest run tests/unit/views/admin/AuditLogView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/admin/OwnershipManagementView.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 42 passed
Tests: 61 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/AuditLogView.tsx
npx eslint src/views/admin/AuditLogView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, unused caught error).

### 23AV. Status po sweepie Tenant Admin Security `ApiKeysManagementView`

Kolejny sweep objal tenant-admin API keys. Widok przy awarii `Api.get('/api/api-keys')` czyscil liste do `[]`, co renderowalo `No API Keys` i aktywne `Create API Key`. Dla security surface taki stan jest mylacy: brak kluczy nie jest tym samym co brak mozliwosci zaladowania listy kluczy.

Wdrozone:

- dodano `loadError` dla listy API keys;
- awaria load renderuje `API keys unavailable` i `API key list unavailable`;
- `No API Keys` jest zarezerwowane dla wiarygodnie zaladowanej pustej listy;
- globalny `Create API Key` i empty-state create action sa disabled przy awarii;
- revoke action dostal defensywne disabled przy niewiarygodnym stanie listy.

Test:

```text
npx vitest run tests/unit/views/admin/ApiKeysManagementView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/admin/OwnershipManagementView.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 44 passed
Tests: 64 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/ApiKeysManagementView.tsx
npx eslint src/views/admin/ApiKeysManagementView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AU. Status po sweepie Tenant Admin Security `DataManagementView`

Kolejny sweep objal tenant-admin data management / GDPR. Widok mial hardcoded inventory (`users=45`, `tasks=1283`, `audit=15420`) jako initial state, wiec awaria `/api/organization-data/stats` zostawiala fikcyjne liczniki i aktywne export actions. Retention settings byly edytowalne bez GET aktualnego stanu, a delete organization pokazywal sukces bez sprawdzenia `res.ok`.

Wdrozone:

- initial record counts ustawiono na `0`, bez fikcyjnych wartosci;
- dodano `statsLoadError` dla `/api/organization-data/stats`;
- non-OK response lub brak `data.stats` jest traktowany jako awaria inventory;
- przy awarii renderuje sie `Data inventory unavailable` i `Data export unavailable`;
- data summary i category export actions nie renderuja sie bez wiarygodnego inventory;
- `Export All Data` jest disabled przy awarii inventory;
- retention settings dostaly `ReadOnlyState`, a pola i `Save Retention Settings` sa disabled, bo zapisany stan nie jest jeszcze ladowany z backendu;
- delete organization sprawdza `res.ok` i dopiero wtedy pokazuje success.

Test:

```text
npx vitest run tests/unit/views/admin/DataManagementView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/admin/OwnershipManagementView.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 43 passed
Tests: 63 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/DataManagementView.tsx
npx eslint src/views/admin/DataManagementView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, unused caught error).

### 23AP. Status po sweepie Tenant Admin Billing `UsageDashboardView`

Kolejny sweep objal tenant-admin usage dashboard. Widok mial najbardziej ryzykowny wariant false-zero: przy bledzie `/api/billing/usage-summary` nie ustawial jawnego stanu awarii, zostawial `usage = null`, a UI renderowal metryki z fallbackami `0`, `0 B`, `$0.00`, puste wykresy oraz `No usage data available`.

Wdrozone:

- dodano `loadError` dla usage summary;
- non-OK response jest traktowany jako blad, nie jako brak usage;
- po awarii `usage` jest czyszczone i renderuje sie `Usage dashboard unavailable`;
- karty metryk, wykresy, breakdown table i alert projekcji nie renderuja sie po awarii;
- export CSV i selektor zakresu sa disabled bez wiarygodnych danych;
- export CSV rzuca blad przy non-OK response i trafia do toast error path.

Test:

```text
npx vitest run tests/unit/views/admin/UsageDashboardView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 37 passed
Tests: 53 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/UsageDashboardView.tsx
npx eslint src/views/admin/UsageDashboardView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`react-hooks/exhaustive-deps`, `any`, `console`, unused caught error).

### 23AQ. Status po sweepie Tenant Admin Billing `BillingSettingsView`

Kolejny sweep objal tenant-admin billing settings. Widok ladowal `/api/billing/settings`, ale awaria byla maskowana: domyslne `notifications = true` pozostawaly widoczne jako prawdziwe ustawienia, `taxSettings` renderowalo puste edytowalne pola, `Save Changes` pozostawal aktywny, a billing contacts byly lokalna symulacja bez persistence (`setContacts([...contacts, contact])`).

Wdrozone:

- dodano `loadError` dla billing settings;
- non-OK response jest traktowany jako blad, nie jako puste ustawienia;
- awaria pokazuje `Billing settings unavailable`;
- tab tax pokazuje `Tax settings unavailable` zamiast pustych edytowalnych pol;
- tab notifications pokazuje `Notification settings unavailable` przy awarii settings;
- tab export pokazuje `Billing export unavailable` i nie renderuje export actions przy awarii;
- `Save Changes` jest disabled, gdy settings nie sa wiarygodnie zaladowane;
- export rzuca blad przy non-OK response i trafia do toast error path;
- billing contacts dostaly jawny `ReadOnlyState`, a add/remove contacts sa disabled do czasu podlaczenia persistence.

Test:

```text
npx vitest run tests/unit/views/admin/BillingSettingsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 38 passed
Tests: 55 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/BillingSettingsView.tsx
npx eslint src/views/admin/BillingSettingsView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`react-hooks/exhaustive-deps`, `any`, `console`).

### 23AR. Status po sweepie Tenant Admin Security `AdminSecuritySettings`

Kolejny sweep objal tenant-admin security settings. Widok ladowal `/api/security/admin-settings` i `/api/auth/oauth/status`, ale awaria byla maskowana przez domyslne wartosci lokalnego state (`mfaRequired=false`, `ssoEnabled=false`, `sessionTimeout=30`, `loginMaxAttempts=5`). W praktyce admin widzial edytowalna polityke bez gwarancji, ze pochodzi z backendu. Awaria OAuth statusu byla ukrywana calkowicie przez brak sekcji providerow.

Wdrozone:

- dodano `loadError` dla security settings;
- non-OK response z `/api/security/admin-settings` jest traktowany jako blad;
- przy awarii settings renderuje sie `Security settings unavailable` zamiast edytowalnych defaultow;
- Save Changes nie renderuje sie/nie jest dostepny, gdy security settings nie sa wiarygodnie zaladowane;
- dodano `oauthLoadError` dla statusu providerow OAuth;
- awaria OAuth statusu renderuje `OAuth provider status unavailable`, ale nie blokuje edycji glownych security settings, jesli one zaladowaly sie poprawnie.

Test:

```text
npx vitest run tests/unit/views/admin/AdminSecuritySettings.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 39 passed
Tests: 57 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/AdminSecuritySettings.tsx
npx eslint src/views/admin/AdminSecuritySettings.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AO. Status po sweepie Tenant Admin Billing `SpendingAlertsView`

Kolejny sweep objal tenant-admin spending alerts. Widok mial dwa niezalezne zrodla danych: usage (`Api.getUsage`) i alerty (`/api/billing/spending-alerts`). Awarie obu zrodel byly maskowane:

- usage cards pokazywaly `--`, co moglo wygladac jak brak danych zamiast awarii;
- non-OK response dla spending alerts czyscil liste i pokazywal `No Alerts Configured`;
- `Create Alert` pozostawal aktywny mimo braku zaladowanej listy alertow;
- toggle/delete/save ignorowaly non-OK response bez jawnego bledu.

Wdrozone:

- dodano `usageLoadError` i `alertsLoadError`;
- awaria usage pokazuje `Usage data unavailable` zamiast kart z `--`;
- awaria alertow pokazuje `Spending alerts unavailable` zamiast `No Alerts Configured`;
- `Create Alert` jest disabled, gdy lista alertow nie jest zaladowana;
- save/toggle/delete rzucaja blad przy non-OK response i trafiaja do istniejacego toast error path.

Test:

```text
npx vitest run tests/unit/views/admin/SpendingAlertsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 36 passed
Tests: 52 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/SpendingAlertsView.tsx
npx eslint src/views/admin/SpendingAlertsView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AN. Status po sweepie Tenant Admin Billing `InvoicesView`

Kolejny sweep objal tenant-admin billing history (`InvoicesView`). Widok uzywal `fetch('/api/billing/invoices')` i przy `res.ok === false` albo wyjatku czyscil liste faktur, co renderowalo `No Invoices` oraz `Total Paid (All Time) = $0.00`.

Wdrozone:

- dodano `loadError` dla listy faktur;
- non-OK response z `/api/billing/invoices` jest traktowany jako blad, nie jako pusta historia;
- awaria pokazuje `Invoices unavailable` oraz `Billing history unavailable`;
- `No Invoices` i total paid nie renderuja sie po awarii;
- search/status/date filters sa disabled, gdy billing history nie jest zaladowane;
- download faktury pokazuje blad takze przy non-OK response, a nie tylko przy wyjatku sieciowym.

Test:

```text
npx vitest run tests/unit/views/admin/InvoicesView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 35 passed
Tests: 51 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/InvoicesView.tsx
npx eslint src/views/admin/InvoicesView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AL. Status po sweepie Customer Ops `SuperAdminUserManagement` / `UserManagementCore`

Kolejny sweep objal P0 Customer Ops dla uzytkownikow. `SuperAdminUserManagement` jest cienkim wrapperem nad wspolnym `UserManagementCore`, wiec poprawka zostala zrobiona w core, z korzyscia takze dla innych powierzchni uzywajacych tego komponentu.

Problem:

- `loadError` istnial, ale po awarii listy uzytkownikow tabela nadal mogla pokazac `No users found`;
- search, filtry platformowe, `Invite User` i `Add User` pozostawaly aktywne mimo braku zaladowanego zrodla danych;
- operator mogl zaczac akcje na pustym, ale faktycznie zdegradowanym widoku.

Wdrozone:

- przy awarii listy uzytkownikow tabela pokazuje `Users unavailable` jako `DegradedState`;
- `No users found` jest renderowane tylko dla prawdziwie pustej listy;
- search, organization/role/status filters, `Invite User` i `Add User` sa disabled, gdy lista uzytkownikow nie jest zaladowana;
- zachowano istniejace `UnavailableState` dla tenant-admin direct user creation bez pewnego endpointu.

Test:

```text
npx vitest run tests/unit/components/shared/UserManagementCore.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 33 passed
Tests: 49 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/shared/UserManagementCore.tsx
npx eslint src/components/shared/UserManagementCore.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, nieuzyte legacy props).

### 23AM. Status po sweepie Tenant Admin P32 `AdminUserManagement`

Kolejny sweep objal tenant-admin P0 dla `/admin/people` / user management. Ten widok ma osobna implementacje od `UserManagementCore`, wiec wymagal niezaleznej poprawki.

Problem:

- awaria `Api.getUsers()` konczyla sie toastem `Failed to load users`, ale tabela mogla pokazac `No users found`;
- search, role/status filters, `Add User` i owner transfer mogly pozostac aktywne mimo braku wiarygodnie zaladowanej listy czlonkow;
- operator mogl interpretowac awarie tenant members API jako prawdziwie pusty tenant.

Wdrozone:

- dodano `loadError` dla listy tenant users;
- awaria `getUsers` czysci liste i pokazuje `Users unavailable` jako `DegradedState`;
- `No users found` renderuje sie tylko przy prawdziwie pustym wyniku;
- search, role/status filters, `Add User` i `Transfer Ownership` sa disabled, gdy users API nie zaladowalo danych;
- blad API jest normalizowany przez `normalizeApiErrorMessage`.

Test:

```text
npx vitest run tests/unit/views/admin/AdminUserManagement.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 34 passed
Tests: 50 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/admin/AdminUserManagement.tsx
npx eslint src/views/admin/AdminUserManagement.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AK. Status po sweepie Customer Ops `OrganizationsView`

Kolejny sweep objal `OrganizationsView`, czyli P0 Customer Ops z inventory `/superadmin/customers/organizations`, access requests i access codes. Panel mial juz `Promise.allSettled` dla czesciowych awarii, ale bledy byly widoczne tylko jako toast/banner, a tabele nadal mogly wygladac jak prawdziwie puste.

Wdrozone:

- dodano trwale `loadErrors` dla `organizations`, `requests` i `codes`;
- awaria glownej listy organizacji czysci dane i pokazuje `Organizations unavailable` zamiast `No organizations found`;
- search organizacji jest disabled, gdy lista organizacji nie zostala zaladowana;
- przy awarii organizacji zakladki pending/code pokazują `Access requests unavailable` i `Access codes unavailable`;
- przy czesciowej awarii access requests albo access codes organizacje nadal sa widoczne, ale dotkniete zakladki renderuja degraded state zamiast pustej tabeli;
- `Generate New Code` jest disabled, gdy access codes nie sa zaladowane.

Test:

```text
npx vitest run tests/unit/views/superadmin/OrganizationsView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 32 passed
Tests: 48 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/superadmin/OrganizationsView.tsx
npx eslint src/views/superadmin/OrganizationsView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AJ. Status po sweepie commercial `InvoiceCenterView`

Kolejny sweep objal `InvoiceCenterView`, ostatni duzy panel z tabeli billing/commercial wskazanej w planie (`/superadmin/customers/commercial/invoices`). Panel mial kilka nieuczciwych stanow:

- awaria `getSuperAdminInvoices` / `getSuperAdminInvoiceStats` zerowala statystyki i pokazywala `No invoices found`;
- filtry i `Create Invoice` pozostawaly aktywne mimo braku zaladowanego zrodla faktur;
- awaria `getUsagePricingTiers` wygladala jak `No pricing tiers configured`;
- akcje invoice reminder / mark paid mialy tylko `console.error`, bez feedbacku dla operatora.

Wdrozone:

- dodano `loadError` dla listy faktur i statystyk;
- awaria faktur pokazuje `Invoice overview unavailable` oraz `Invoices unavailable`;
- stats cards nie renderuja zerowych revenue/paid/pending/overdue po awarii;
- search, status/date filters i `Create Invoice` sa disabled, gdy faktury nie sa zaladowane;
- dodano `usageTiersLoadError`;
- awaria usage tiers pokazuje `Usage pricing tiers unavailable` zamiast pustego setupu;
- `Add Tier` jest disabled przy awarii usage tiers;
- reminder i mark-paid pokazuja jawny success/error toast.

Test:

```text
npx vitest run tests/unit/views/superadmin/InvoiceCenterView.test.tsx tests/unit/views/superadmin/InvoiceCenterView.honesty.test.tsx
```

Wynik:

```text
Test Files: 2 passed
Tests: 3 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx tests/unit/views/superadmin/InvoiceCenterView.test.tsx
```

Wynik:

```text
Test Files: 31 passed
Tests: 46 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/superadmin/InvoiceCenterView.tsx
npx eslint src/views/superadmin/InvoiceCenterView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AF. Status po sweepie legacy `EnterpriseBackupPanel`

Kolejny sweep objal legacy `EnterpriseBackupPanel` w systemowym module SuperAdmin. Panel byl juz czesciowo honest dla listy backupow, ale nadal mial luki:

- awaria schedules czyscila liste i mogla wygladac jak brak harmonogramow;
- statystyki overview pokazywaly zera / `Never`, gdy backupy lub schedules byly niedostepne;
- `Settings` byly lokalnym formularzem bez persisted backend workflow, z aktywnym przyciskiem `Save Settings`;
- pola settings nie byly poprawnie powiazane z labelami, co wyszlo w teście dostepnosci.

Wdrozone:

- dodano `scheduleLoadError` dla harmonogramow backupow;
- overview pokazuje `Backup overview unavailable`, gdy backupy albo schedules nie sa zaladowane;
- zakladka Schedules pokazuje `Backup schedules unavailable` zamiast pustej listy;
- settings dostaly `ReadOnlyState` i zablokowane pola/przycisk `Save Settings`;
- poprawiono `htmlFor`/`id` dla pol `Retention Days` i `Max Local Backups`;
- zachowano istniejące blokady destrukcyjnych akcji backupowych.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseBackupPanel.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <25 honesty test files including EnterpriseBackupPanel>
```

Wynik:

```text
Test Files: 25 passed
Tests: 36 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseBackupPanel.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseBackupPanel.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, nieuzyte nazwy `error` w catch).

### 23AH. Status po sweepie commercial `BillingCenterView`

Kolejny sweep objal `BillingCenterView` w obszarze SuperAdmin billing/commercial. Wczesniej panel mial juz poprawke dla operational costs, ale inne sekcje nadal mogly maskowac awarie backendu:

- awaria wszystkich metryk overview mogla zostawic puste KPI i tabele bez jasnej informacji, ze billing backend nie odpowiedzial;
- awaria `/billing/admin/plans` albo `/billing/admin/user-plans` mogla wygladac jak brak planow z CTA `Create one`;
- `User Licenses` mialo aktywne tworzenie, mimo ze save path jawnie zwraca `not configured`;
- Token Economy uzywal fallbackow `catch(() => [])` / `catch(() => 0)`, przez co awaria providerow/pakietow/margins/balance wygladala jak zera;
- awaria transakcji pokazywala `No transactions found`;
- awaria managed contracts pokazywala `No manual contracts configured yet`, a formularz pozostawal aktywny.

Wdrozone:

- overview pokazuje `Billing overview unavailable`, gdy wszystkie zrodla billing metrics sa niedostepne;
- plany maja per-source `planLoadErrors` i renderuja `Organization plans unavailable` / `User license plans unavailable`;
- `New Plan` jest disabled, gdy aktywna lista planow nie jest zaladowana, a `New License` jest disabled do czasu backend workflow;
- Token Economy pokazuje `Token economy metrics unavailable` zamiast KPI z zerami;
- Transactions pokazuje `Billing transactions unavailable` zamiast pustej tabeli;
- Managed Contracts pokazuje `Managed contracts unavailable` i blokuje formularz zapisu.

Test:

```text
npx vitest run tests/unit/views/superadmin/BillingCenterView.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx
```

Wynik:

```text
Test Files: 2 passed
Tests: 4 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx
```

Wynik:

```text
Test Files: 28 passed
Tests: 42 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/superadmin/BillingCenterView.tsx
npx eslint src/views/superadmin/BillingCenterView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`@ts-nocheck`, `any`, `console`).

### 23AI. Status po sweepie commercial `SuperAdminRevenueView`

Kolejny sweep objal `SuperAdminRevenueView`, czyli revenue dashboard blisko powiazany z `BillingCenterView`. Panel mial czesciowy degraded state dla pojedynczych awarii, ale przy awarii wszystkich trzech zrodel (`revenue`, `usage`, `operational-costs`) nadal renderowal KPI z pustymi wartosciami oraz puste tabele, co moglo wygladac jak brak przychodow/subskrypcji.

Wdrozone:

- dodano `dashboardUnavailable`, gdy wszystkie zrodla revenue dashboard sa niedostepne;
- przy pelnej awarii ekran pokazuje `Revenue dashboard unavailable`;
- karty MRR/ARR/subscriptions/tokens, plan distribution, usage overview, revenue table i operational costs nie sa renderowane w stanie pelnej niedostepnosci;
- zachowano istniejace zachowanie degraded dla czesciowych awarii, np. operational costs unavailable przy dostepnych revenue/usage.

Test:

```text
npx vitest run tests/unit/views/superadmin/SuperAdminRevenueView.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 1 passed
```

Szersza regresja honest UI:

```text
npx vitest run tests/unit/**/*.honesty.test.tsx tests/unit/views/superadmin/BillingCenterView.operationalCosts.test.tsx
```

Wynik:

```text
Test Files: 29 passed
Tests: 43 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/views/superadmin/SuperAdminRevenueView.tsx
npx eslint src/views/superadmin/SuperAdminRevenueView.tsx --no-warn-ignored
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AG. Status po sweepie legacy `EnterpriseFeatureFlags`

Kolejny sweep objal ostatni legacy panel z grupy `SuperAdmin/system`: `EnterpriseFeatureFlags`. Panel mial false-empty zachowania:

- awaria `getFeatureFlags` konczyla sie toastem, ale ekran mogl pokazac zerowe statystyki flag;
- lista mogla wygladac jak `No feature flags found` mimo niedostepnosci backendu;
- `Create Flag`, wyszukiwarka i filtry pozostawaly aktywne na niezaladowanej liscie;
- awaria `getFeatureFlagHistory` wygladala jak `No history available`;
- przyciski akcji w wierszu flagi nie mialy stabilnych nazw dostepnosci.

Wdrozone:

- dodano `loadError` dla listy i statystyk flag;
- overview pokazuje `Feature flag overview unavailable`;
- lista pokazuje `Feature flags unavailable` zamiast pustej listy;
- `Create Flag`, search i filtry sa blokowane przy awarii listy;
- panel `Test Evaluation Context` jest ukrywany, gdy nie ma zaladowanych flag;
- historia flag ma osobny `loadError` i pokazuje `Feature flag history unavailable`;
- dodano `aria-label` dla copy/toggle/edit/history/delete w wierszu flagi.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseFeatureFlags.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <26 honesty test files including EnterpriseFeatureFlags>
```

Wynik:

```text
Test Files: 26 passed
Tests: 38 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseFeatureFlags.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseFeatureFlags.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, nieuzyte nazwy `error` w catch).

### 23AD. Status po sweepie legacy `EnterpriseConfigurationPanel`

Kolejny sweep objal legacy `EnterpriseConfigurationPanel` w systemowym module SuperAdmin. Panel mial false-empty zachowania:

- awaria `getSystemConfigs` czyscila liste i pokazywala zerowe statystyki konfiguracji;
- akcje `Export` i `Add Config` pozostawaly aktywne mimo braku zaladowanej listy;
- wyszukiwarka i filtry dzialaly na pustym lokalnym stanie po awarii backendu;
- awaria historii wersji wygladala jak `No version history available`.

Wdrozone:

- dodano `loadError` dla listy konfiguracji oraz statystyk;
- awaria initial load pokazuje `Configuration overview unavailable` i `System configuration unavailable`;
- `Export`, `Add Config`, search i filtry sa blokowane, gdy konfiguracja nie jest zaladowana;
- dodano `historyLoadError` dla modala historii;
- awaria wersji pokazuje `Version history unavailable` zamiast pustej historii;
- po zamknieciu historii czyszczone sa `versions` i blad historii.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseConfigurationPanel.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <23 honesty test files including EnterpriseConfigurationPanel>
```

Wynik:

```text
Test Files: 23 passed
Tests: 32 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseConfigurationPanel.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseConfigurationPanel.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, nieuzyte nazwy `error` w catch).

### 23AE. Status po sweepie legacy `EnterpriseHealthMonitor`

Kolejny sweep objal legacy `EnterpriseHealthMonitor` w systemowym module SuperAdmin. Panel mial false-empty / false-healthy ryzyka:

- awaria `getSystemHealth` / `/system-health/services` / `/system-health/metrics` mogla zostawic ekran z `unknown`/zerowymi wartosciami, ale bez jawnego degraded state;
- overview mogl pokazywac response time `0ms`, brak aktywnych providerow i puste metryki jako stan systemu;
- zakladka Services mogla byc pusta bez informacji, ze backend health nie odpowiedzial;
- zakladka Metrics mogla pokazywac `—`/`0ms` zamiast awarii danych;
- awaria `/superadmin/system-health/alerts` wygladala jak `No alerts configured`.

Wdrozone:

- dodano `healthLoadError` dla health/services/metrics;
- dodano `alertsLoadError` dla konfiguracji alertow;
- przy awarii header pokazuje `System health unavailable`;
- Overview pokazuje `System health overview unavailable`;
- Services pokazuje `Service health unavailable`;
- Metrics pokazuje `Health metrics unavailable`;
- Alerts pokazuje `Alert configuration unavailable` zamiast pustej listy;
- `Add Alert` jest blokowany, gdy alerty nie sa zaladowane;
- refresh pokazuje sukces tylko po udanym odswiezeniu health danych.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseHealthMonitor.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <24 honesty test files including EnterpriseHealthMonitor>
```

Wynik:

```text
Test Files: 24 passed
Tests: 34 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseHealthMonitor.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseHealthMonitor.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23AB. Status po sweepie legacy `EnterpriseAuditLog`

Kolejny sweep objal legacy `EnterpriseAuditLog` z systemowego modulu SuperAdmin. Panel mial `@ts-nocheck` i zachowanie, w ktorym awaria `getAuditLogs`/`getAuditLogStats` konczyla sie toastem, ale mogla zostawic UI jako `No audit logs found` albo puste/zerowe analytics.

Wdrozone:

- dodano trwaly `loadError` dla listy audit logs i statystyk;
- awaria initial load pokazuje `Audit log overview unavailable` oraz `Audit logs unavailable`;
- stats cards sa ukrywane przy awarii, zeby nie sugerowac `Total Events = 0`;
- filtry, refresh i export sa disabled przy awarii zrodla audit logow;
- zakladka `Analytics` pokazuje `Audit analytics unavailable` zamiast pustych wykresow `No data`/zerowego risk distribution.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseAuditLog.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <21 honesty test files including EnterpriseAuditLog>
```

Wynik:

```text
Test Files: 21 passed
Tests: 28 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseAuditLog.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseAuditLog.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`@ts-nocheck`, `any`, `console`, `react-hooks/exhaustive-deps`, kilka martwych importow).

### 23AC. Status po sweepie legacy `EnterpriseAnalyticsPanel`

Kolejny sweep objal legacy `EnterpriseAnalyticsPanel` z systemowego modulu SuperAdmin. Panel mial kilka falszywych stanow:

- awaria `getSystemAnalytics` generowala wykresy z zerami zamiast pokazac niedostepnosc danych;
- brak danych chartow z backendu byl uzupelniany zerowymi seriami czasowymi;
- `Performance Breakdown` zawieral statyczne wartosci top endpoints, latency buckets i error type counts;
- `Custom Report Builder` oraz `Schedule Report` wygladaly na aktywne workflow, mimo braku audytowanego backendu;
- awaria `getAnalyticsReports` mogla wygladac jak `No scheduled reports`.

Wdrozone:

- dodano `loadError` dla analytics dashboard/report generation;
- awaria initial load pokazuje `Analytics dashboard unavailable` i `Report generation unavailable`;
- brak chartow pokazuje `API traffic chart unavailable` i `AI usage chart unavailable`, bez generowania zerowych danych;
- statyczny `Performance Breakdown` zastapiono `ReadOnlyState`;
- `Custom report builder` i `Schedule Report` sa read-only/disabled do czasu podlaczenia audytowanego workflow;
- awaria scheduled reports pokazuje `Scheduled reports unavailable` zamiast pustej listy.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseAnalyticsPanel.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <22 honesty test files including EnterpriseAnalyticsPanel>
```

Wynik:

```text
Test Files: 22 passed
Tests: 30 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseAnalyticsPanel.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseAnalyticsPanel.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`).

### 23Z. Status po sweepie legacy `EnterpriseIntegrationsHub`

Kolejny sweep objal `EnterpriseIntegrationsHub` z `SystemModule`. Panel mial poprawnie istniejace endpointy list integracji i webhookow, ale awarie initial load byly renderowane jak czyste puste stany:

- awaria `getSystemIntegrations` mogla pokazac `No integrations connected`;
- awaria `getSystemWebhooks` mogla pokazac `No webhooks configured`;
- awaria `getSystemWebhookDeliveries` w modalu dostaw pokazywala `No deliveries yet`;
- przycisk settings przy integracji otwieral niezaimplementowany workflow edycji konfiguracji.

Wdrozone:

- dodano per-sekcjowe `loadErrors` dla integracji i webhookow;
- metryki overview sa ukrywane za `Integration overview unavailable`, gdy dane operacyjne sa niedostepne;
- zakladka connected pokazuje `Connected integrations unavailable` zamiast pustej listy;
- zakladka webhooks pokazuje `Webhooks unavailable`, a `Create Webhook` jest disabled przy awarii listy;
- delivery modal pokazuje `Webhook deliveries unavailable` zamiast `No deliveries yet`;
- settings integracji jest disabled z powodem, dopoki nie ma audytowanego workflow konfiguracji.

Test:

```text
npx vitest run tests/unit/components/SuperAdmin/EnterpriseIntegrationsHub.honesty.test.tsx
```

Wynik:

```text
Test Files: 1 passed
Tests: 2 passed
```

Szersza regresja honest UI:

```text
npx vitest run <19 honesty test files including EnterpriseSecurityPanel and EnterpriseIntegrationsHub>
```

Wynik:

```text
Test Files: 19 passed
Tests: 24 passed
```

Dodatkowe gate:

```text
npm run type-check
npx eslint --fix src/components/SuperAdmin/system/EnterpriseIntegrationsHub.tsx
npx eslint src/components/SuperAdmin/system/EnterpriseIntegrationsHub.tsx
```

Wynik: TypeScript check przeszedl bez bledow. ESLint dla komponentu ma 0 bledow; pozostaja istniejace ostrzezenia legacy (`any`, `console`, unused caught error names).
