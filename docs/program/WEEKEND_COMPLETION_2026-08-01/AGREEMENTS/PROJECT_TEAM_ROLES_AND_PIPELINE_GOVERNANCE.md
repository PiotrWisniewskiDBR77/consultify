---
document_id: PROJECT-TEAM-ROLES-PIPELINE-GOVERNANCE
module: Organization / Admin / Initiatives / Execution
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Zespoły projektowe, role i zarządzanie pipeline

## 1. Decyzja architektoniczna

Zespół projektowy jest kanonicznym obiektem organizacji powiązanym z jednym
projektem. Wszystkie Initiative, Tasks, Decisions, Risks, KPI, capacity,
powiadomienia i eskalacje korzystają z tego samego członkostwa i resolvera
uprawnień.

Miejsce zarządzania:

- **SuperAdmin** — wyłącznie platformowy katalog typów ról, capabilities i
  systemowych polityk; nie zarządza zespołami konkretnego klienta;
- **Admin Panel organizacji** — tworzenie projektów, członkostwa, zaproszenia,
  domyślne polityki, zespoły/pule i audyt dostępu;
- **Organization** — czytelny katalog projektów, zespołów, osób, kompetencji,
  dostępności i przypisań;
- **Project Team** — operacyjne budowanie zespołu konkretnego projektu;
- **Initiatives/Execution** — staffing i assignment tylko spośród osób
  uprawnionych w projekcie, z kontrolowanym wyjątkiem/invite flow.

SuperAdmin nie powinien widzieć ani edytować składu klienta bez jawnej,
audytowanej operacji support/impersonation. To rozdziela administrację platformy
od zarządzania organizacją klienta.

## 2. Dwa zestawy ról

System posiada dokładnie dwa niezależne zestawy:

1. **App Role** — kim użytkownik jest w aplikacji/organizacji;
2. **Project Role** — co użytkownik może robić w konkretnym projekcie.

App Role nie nadaje automatycznie authority projektowego. Project Role nie
pozwala zarządzać kontem organizacji.

### 2.1 App Roles

| App Role | Znaczenie | Może | Nie oznacza automatycznie |
| --- | --- | --- | --- |
| `OWNER` | właściciel konta organizacji | wszystko co Admin oraz billing, ownership, usunięcie organizacji | Sponsor/Approver każdego projektu |
| `ADMIN` | administrator organizacji | użytkownicy, projekty, zespoły, polityki i konfiguracja | decydent biznesowy projektu |
| `MEMBER` | standardowy pracownik/członek organizacji | pracować w projektach, do których został dodany | dostęp do innych projektów ani administracja |
| `CONSULTANT` | konsultant wewnętrzny, zewnętrzny lub partnerski | pracować w przydzielonych projektach; widoczna tożsamość konsultanta | gate authority, dostęp do całej organizacji ani status Admina |

`CONSULTANT` jest pełnoprawną App Role, ale nadal nie nadaje authority
projektowego. W ProjectMembership przechowujemy dodatkowo profil pochodzenia
`INTERNAL`, `EXTERNAL` lub `PARTNER` dla widoczności, umowy i audytu.

Istniejący techniczny `USER` podlega migracji do produktowego `MEMBER`.
Historyczny consultant overlay pozostaje warstwą kompatybilności danych, nie
docelowym modelem widocznym dla użytkownika.

### 2.2 Project Roles

Jedno członkostwo użytkownika w projekcie może posiadać wiele ról z katalogu:

- `SPONSOR` — mandat, inwestycja, strategiczne Go/No-Go;
- `PROJECT_LEADER` — operacyjne prowadzenie projektu;
- `INITIATIVE_OWNER` — odpowiedzialność za jedną lub więcej Initiative;
- `TEAM_MEMBER` — wykonywanie przypisanej pracy;
- `PMO` — standard, jakość, pipeline, cadence i kontrola;
- `PORTFOLIO_OWNER` — priorytety i alokacja między projektami;
- `BUSINESS_OWNER` — korzyści i KPI po delivery;
- `STEERING_COMMITTEE` — authority wyłącznie z aktywnego Steering Board.

Jedna rola jest oznaczona jako `primaryRole` dla czytelności, ale authority
wynika ze zbioru ról. Separacja obowiązków może zabronić niektórych kombinacji,
np. Initiative Owner nie zatwierdza własnego strategicznego gate.

Nie każdy projekt potrzebuje wszystkich ról. Przy tworzeniu projektu Admin lub
Sponsor wybiera `enabledProjectRoles` z kanonicznego katalogu. System zawsze
włącza minimalną rolę `TEAM_MEMBER` (`Project Member`). Pozostałe role można
włączyć od razu albo później; wyłączenie używanej roli wymaga impact preview i
przeniesienia odpowiedzialności.

### 2.3 Domyślne dołączanie i upgrade

Każda osoba dołączająca do projektu otrzymuje automatycznie:

- aktywne `ProjectMembership` po zaakceptowaniu zaproszenia;
- `primaryRole = TEAM_MEMBER`;
- minimalny zestaw work permissions projektu;
- brak gate, budget, portfolio i people-management authority;
- visibility zgodną z projektem i App Role;
- allocation domyślnie `0% / unplanned`, dopóki nie zostanie jawnie ustalona.

Następnie Sponsor, Project Leader lub Admin — zgodnie z policy — może wykonać
`role upgrade`. Upgrade:

1. wybiera wyłącznie rolę włączoną w projekcie;
2. pokazuje capabilities przed/po;
3. sprawdza konflikty segregation of duties;
4. może wymagać zatwierdzenia dla privileged roles;
5. wysyła użytkownikowi informację i — jeśli policy wymaga — prośbę o akceptację;
6. zapisuje actor, reason, effective date i audit history;
7. może być czasowy i automatycznie wygasnąć.

Downgrade działa analogicznie, ale przed zapisem wymaga transferu Tasks,
Decisions, Risks, KPI, Initiative ownership i delegacji, których nowa rola nie
może obsłużyć.

### 2.4 Initiative i Workstream Staffing

Określa, kto faktycznie pracuje przy danej Initiative/workstreamie, np.:

- Initiative Manager/Owner;
- Workstream Lead;
- Contributor;
- Subject Matter Expert;
- Change Lead;
- Technical Lead;
- Finance Partner;
- Data/KPI Partner;
- Reviewer/Observer.

To są **assignment types**, nie nowe globalne role RBAC. Nadają kontekst pracy i
ograniczone capabilities zdefiniowane polityką projektu.

### 2.5 Odpowiedzialność za obiekt

Task, Decision, Risk, KPI, Milestone, Benefit, Deliverable i Gate posiadają
własne role obiektowe:

- `Accountable Owner` — dokładnie jedna osoba;
- `Responsible` — jedna lub więcej osób wykonujących;
- `Consulted` i `Informed` — opcjonalne;
- `Approver/Decision Maker` — gdy obiekt wymaga authority;
- `Escalation Target` — jawnie określona osoba albo rola.

Obiektowe przypisanie nie rozszerza automatycznie dostępu do całego projektu.

### 2.6 Effective Capabilities

Backend oblicza finalne uprawnienia:

`app role + project membership/roles + steering membership + initiative
staffing + object assignment + delegation + policy + lifecycle state →
capabilities`

Frontend nigdy nie zgaduje uprawnień na podstawie etykiety roli.

## 3. Kanoniczne obiekty danych

### 3.1 Project

`id`, organization, program/portfolio, name, purpose, status, sponsor,
projectLeader, visibility, dates, policies, default escalation, steering config,
capacity calendar, `enabledProjectRoles[]`, `defaultJoinRole = TEAM_MEMBER`,
roleUpgradePolicy, tags i audit metadata.

### 3.2 ProjectMembership

`projectId`, `userId`, `appRoleSnapshot`, `roles[]`, `primaryRole`, membership status, allocation,
availability, start/end, skills, consultant overlay, invitation source,
delegations, visibility, created/approved by i history.

Statusy:

`INVITED → PENDING_ACCEPTANCE → ACTIVE → PAUSED → ENDED`, dodatkowo
`DECLINED` i `REVOKED`.

### 3.3 ProjectTeam / Delivery Team

Projekt ma jeden kanoniczny Project Team jako zbiór memberships. Organization
może posiadać także **reusable team/pool templates** (np. Digital Team, Finance
Partners), ale dodanie puli do projektu tworzy jawne ProjectMembership dla
każdej osoby; dynamiczna grupa nie może po cichu rozszerzać dostępu.

### 3.4 StaffingAssignment

Łączy membership z Initiative/workstreamem i assignment type, allocation,
czasem obowiązywania, skills demand, accepted state oraz źródłem decyzji.

### 3.5 Delegation

Delegacja jest ograniczona rolą/akcją, projektem/obiektem, datą, powodem i
delegującym. Nie wolno delegować wyższego authority niż sam delegujący posiada.
Każda delegacja wygasa i jest audytowana.

## 4. Tworzenie projektu i zespołu

1. Org Owner/Admin tworzy projekt ręcznie albo z zatwierdzonego template.
2. Wskazuje Sponsor i Project Leader; obie osoby akceptują assignment.
3. Wybiera governance: lightweight, standard albo steering-controlled.
4. Wybiera role projektowe aktywne dla projektu; `TEAM_MEMBER` jest obowiązkowa.
5. Włącza lub wyłącza Steering Board i dodaje Chair/Members/Observers.
6. Dodaje osoby indywidualnie albo z reusable team/pool.
7. Każda zaakceptowana osoba otrzymuje domyślnie `TEAM_MEMBER` i 0% allocation.
8. Uprawniona osoba wykonuje potrzebne role upgrades i ustala allocation.
9. System wykrywa konflikty capacity, brak wymaganych ról i segregation issues.
10. Project Leader buduje staffing Initiative/workstreamów.
11. PMO/Admin widzi completeness, vacancies, overload i wygasające członkostwa.

Projekt bez Sponsora i Project Leadera może istnieć jako `DRAFT`, ale nie może
otrzymać Scheduled Initiative ani rozpocząć Execution.

## 5. Kto może zarządzać zespołem

| Operacja | Rekomendowane authority |
| --- | --- |
| Utworzyć/archiwizować projekt | Organization Owner/Admin |
| Zmienić Sponsora | Owner/Admin z acknowledgement poprzedniego/nowego Sponsora |
| Wyznaczyć Project Leadera | Sponsor lub Owner/Admin |
| Dodać/usunąć członka | Project Leader; dla privileged roles Sponsor/Admin approval |
| Przypisać zwykłą rolę delivery | Project Leader |
| Przypisać Sponsor/PMO/Portfolio/Steering | Sponsor/Admin według policy |
| Włączyć/wyłączyć typ roli dla projektu | Sponsor/Admin; wyłączenie używanej roli wymaga migracji |
| Upgrade z Project Member | Project Leader dla delivery; Sponsor/Admin dla privileged role |
| Downgrade roli | Jak upgrade, zawsze z impact preview i transferem odpowiedzialności |
| Staffing Initiative/workstream | Project Leader lub Initiative Owner w ramach membership |
| Przypisać Task | osoba z work-management capability; assignee akceptuje lub zgłasza problem |
| Wyznaczyć Decision Maker | governance policy, nigdy dowolny autor decyzji |
| Delegować authority | aktualny holder w granicach policy i czasu |
| Podejrzeć pełny audit/access graph | Owner/Admin/PMO według policy |

Usunięcie członka wymaga impact preview: otwarte Tasks, Decisions, Risks, KPI,
Initiatives, approvals, delegations i przyszłe capacity. System wymaga transferu
albo jawnego wyjątku; nie pozostawia osieroconych odpowiedzialności.

## 6. Role w pipeline Initiatives

Domyślny i konfigurowalny sposób zatwierdzania opisuje
[`INITIATIVE_APPROVAL_GOVERNANCE_PROFILES.md`](INITIATIVE_APPROVAL_GOVERNANCE_PROFILES.md).

| Etap | Accountable | Responsible / reviewer | Authority |
| --- | --- | --- | --- |
| Proposal Draft | Proposal Owner | Source contributors | Brak authority portfelowego. |
| Source Validation | Source Validator | PMO/SME opcjonalnie | Register/Merge/Extend/Return/Defer/Dismiss. |
| Registered/Definition | Initiative Owner | Staffing team | Definition submission. |
| Analysis | Initiative Owner | SME, Finance, KPI, Change, Technical, PMO | Approval poszczególnych prawd pozostaje u ich ownerów. |
| Portfolio | Portfolio Owner | Sponsorzy, PMO, Finance/Resource partners | Portfolio Go/No-Go i allocation envelope. |
| Approved Backlog | Sponsor | Initiative Owner/PMO | Mandat, nie zgoda na start. |
| Schedule Gate | Sponsor/Steering wg progów | Project Leader, PMO, Resource owners | Termin, capacity, baseline, tolerancje. |
| Execution | Project Leader/Execution Manager | Initiative/Workstream/Task Owners | Plan, delivery, ryzyka, eskalacje. |
| Benefits Tracking | Business Owner | KPI Owners, Finance, Change Owner | Effectiveness acceptance. |

## 7. Przypisywanie Tasks, Decisions, Risks i KPI

### Task

Assignee musi być aktywnym Project Member albo przejść controlled invite.
System pokazuje allocation, workload, skills match i konflikty przed przypisaniem.
AI może rekomendować osobę, ale człowiek zatwierdza; assignee dostaje możliwość
accept, decline with reason lub propose change.

### Decision

Decision Maker wynika z typu, progu i governance, nie z dowolnego wyboru autora.
Może być osobą, rolą projektową lub boardem. Decyzja ma substitute/delegation,
quorum, SLA i escalation target.

### Risk/RAID

Risk Owner odpowiada za monitoring i response; nie musi być osobą akceptującą
residual risk. Risk Acceptance należy do właściwego Sponsora/Steering/authority.

### KPI/Benefit

KPI Owner odpowiada za jakość i rytm danych; Business Owner za osiągnięcie
rezultatu. Te role mogą należeć do innych osób. Results respektuje project
visibility, lecz może mieć zatwierdzony szerszy krąg odbiorców.

## 8. Capacity i dostępność

Każde membership przechowuje planowaną allocation oraz kalendarz dostępności.
System rozróżnia:

- nominal capacity;
- committed capacity z aktywnych projektów i pracy operacyjnej;
- tentative demand z Registered/Analyzing Initiative;
- conditional reservation z Approved Backlog;
- committed reservation z Scheduled;
- actual utilization z Execution.

Portfolio ocenia, czy odpowiednie zasoby/kompetencje istnieją i jak je
alokować. Roadmap rozkłada obciążenie w czasie. Execution raportuje actual i
forecast. AI nigdy nie potwierdza dostępności tylko na podstawie pustego
kalendarza.

## 9. Powiadomienia i eskalacje

Zdarzenia wymagające powiadomienia:

- invitation/assignment/role change/delegation;
- Task lub Decision przypisane, odrzucone, zagrożone albo overdue;
- capacity conflict lub brak wymaganej roli;
- member ending/leaving oraz orphaned responsibility risk;
- gate ready/blocked i SLA breach;
- risk threshold, KPI deviation i baseline change.

Każde powiadomienie zawiera projekt, rolę, powód, oczekiwaną akcję, termin,
impact i deep link. Eskalacja wykorzystuje projektowy chain, np. Task Owner →
Workstream Lead → Project Leader → Sponsor → Steering/Portfolio Owner.

## 10. Teresa

Teresa może:

- zaproponować strukturę zespołu z uzasadnieniem;
- wykrywać braki ról, skill gaps, overload, konflikty i bus factor;
- rekomendować staffing oraz alternatywy build/buy/borrow;
- przygotować RACI na podstawie deliverables i gates;
- wykrywać role bez mandatu i nieprawidłową separację obowiązków;
- proponować transfer przy odejściu członka;
- coachować ownerów i przygotowywać eskalacje;
- prognozować capacity, jawnie pokazując jakość danych i confidence.

Teresa nie może:

- zapraszać użytkowników, rozszerzać dostępu ani nadawać authority bez approval;
- samodzielnie wyznaczyć Sponsora, Approvera lub Steering Board;
- przyjąć assignment w imieniu człowieka;
- potwierdzić capacity, zamknąć Task albo podjąć Decision;
- ujawniać danych projektu osobom spoza effective visibility.

## 11. Widoki produktu

### Admin Panel organizacji

- Projects registry;
- Project creation/policies/templates;
- wybór `enabledProjectRoles`, zawsze z obowiązkowym Project Member;
- Membership and invitations;
- kolejka role upgrade/downgrade oraz privileged-role approvals;
- reusable teams/pools;
- role catalog labels i custom assignment labels bez zmiany capability keys;
- access audit, conflicts, expired access i orphaned responsibilities.

### Organization

- Projects and Teams;
- People × Project matrix;
- role, allocation, availability, skills i assignment visibility;
- capacity heatmap i cross-project conflicts;
- user/project detail z aktywnymi Initiative, Tasks, Decisions, Risks i KPI.

### Project Team workspace

- roster, vacancies i invited/pending;
- roles, staffing, RACI, capacity i workload;
- Steering Board;
- permissions preview „who can do what”;
- onboarding/offboarding i audit history.

## 12. Rekomendowane rozstrzygnięcie sześciu otwartych decyzji

1. **Rejestracja kandydata:** Source Validator; w lekkich projektach tę rolę
   może pełnić Project Leader/PMO według policy. Proposal Owner nie zatwierdza
   sam własnego draftu, chyba że jawna lightweight policy dopuszcza self-review.
2. **Projekt przy rejestracji:** wymagany. Gdy docelowy projekt nie jest znany,
   używamy kontrolowanego projektu `General / Transformation Backlog`, nigdy
   pustego `projectId`. Przeniesienie jest wersjonowane.
3. **Obciążenie capacity:** Analyzing = tentative demand; Approved Backlog =
   conditional reservation; Scheduled = committed reservation; Execution =
   actual/forecast.
4. **Portfolio:** domyślnie pokazuje Ready for Portfolio; osobne widoki pokazują
   Not Ready i Approved/Scheduled. Candidate nigdy nie trafia do Portfolio.
5. **Go/No-Go:** wersjonowana policy matrix według budżetu, ryzyka, regulacji,
   cross-functional impact i strategic tier. Authority rośnie Sponsor →
   Portfolio Owner/Steering Board. AI nie decyduje.
6. **Decyzje projektowe bez Initiative:** ten sam Decisions registry, z
   obowiązkowym scope `Initiative`, `Project`, `Program` lub `Portfolio`; My Work
   jest osobistą projekcją.

## 13. Kryteria odbioru

- projekt ma dokładnie jeden kanoniczny roster;
- aplikacja używa dokładnie czterech App Roles: Owner, Admin, Member, Consultant;
- nowy Project Member zawsze zaczyna od najniższej roli i 0% allocation;
- projekt włącza tylko potrzebne role z jednego kanonicznego katalogu;
- każdy upgrade/downgrade ma preview, authority, reason i audit trail;
- żadna osoba spoza organizacji/projektu nie otrzymuje assignment bez invite;
- system rozdziela membership, staffing, object responsibility i authority;
- backend zwraca effective capabilities i egzekwuje je przy write;
- każda krytyczna odpowiedzialność ma dokładnie jednego Accountable Ownera;
- role wymagane przez gate są obsadzone i zaakceptowane;
- offboarding nie pozostawia osieroconych obiektów;
- Portfolio/Roadmap/Execution używają tego samego capacity modelu;
- AI staffing ma evidence, confidence, preview i approval;
- role, delegacje i zmiany składu mają immutable audit trail;
- test E2E obejmuje create project → team → Initiative → Task/Decision →
  Schedule Gate → Execution → member replacement.

## 14. Dług do scalenia

Repo zawiera już `ROLES_MODEL.md`, `PROJECT_ROLES_AND_GOVERNANCE.md`,
`PROJECT_AND_INITIATIVE_ROLE_RESOLUTION_V8.md` oraz
`INITIATIVE_TEAM_MEMBERSHIP_AND_PERMISSION_RUNTIME_V8.md`. Kierunek jest zgodny,
ale implementacja wymaga scalenia: jednego role catalog, jednego membership
modelu, jednego backend resolvera i jednej capabilities odpowiedzi. Historyczne
aliasy `PROJECT_MANAGER/PROJECT_LEAD` pozostają wyłącznie warstwą migracyjną.
