---
document_id: RUN-AGENT-CROSS-MODULE-CONNECTOR-CONTRACT
module: My Work / Run Agent
status: DRAFT_FOR_OWNER_REVIEW
owner: piotr
prepared_by: codex
last_reviewed: 2026-07-31
---

# Run Agent — kontrakt spięcia całej platformy i świata zewnętrznego

## 1. Zasada integracji

Run Agent nie czyta tabel innych modułów bezpośrednio i nie steruje ich UI.
Korzysta z wersjonowanych capabilities: queries, commands i events. Każda
capability ma ownera, schema, permissions, idempotency, side-effect class,
approval recommendation, read-back i deprecation policy.

## 2. Standard capability

```text
identity: module.capability@version
purpose + owner
input/output JSON schema
read | compute | propose | mutate | publish | notify
required organization/project roles
data/sensitivity and residency
idempotency + expected version
approval and reversibility
events emitted
rate/cost limits
test fixture + health
```

Palette jest generowana z registry, a nie utrzymywana ręcznie jako rozjeżdżająca
się kopia. Brak executora/health oznacza unavailable/soon.

## 3. Kontrakty modułowe

### Interview i Meeting

Read assignment/questions/answers/transcript/open gaps; request interview/input;
propose questions; wait for completion; receive submitted/verified event.
Output zachowuje respondent, status verification, privacy i citations.

### Tools, Assessment i Audit

Create session/process from library; request inputs/evidence; read progress;
run allowed analysis; wait for approval; read immutable output/report/findings;
propose initiatives. Agent nie omija metodologii ani quality gates narzędzia.

### Initiatives

Search candidates/portfolio; analyze duplicates/completeness/feasibility;
create proposal; request review/decision; read status/risks/relations. Agent nie
przenosi kandydata na listę ani do Execution bez właściwego approval.

### Execution, Tasks, Decisions i Calendar

Read plan/capacity/blockers; create task/decision proposal; schedule work;
wait for decision/task completion; react to blocker/overdue. Calendar event nie
jest taskiem, a completion taska nie jest automatycznie business result.

### Finance, KPI i Results

Read assumptions/model/actuals/targets; run calculations; propose investment
analysis; create KPI target proposal; react to threshold; compare expected vs
actual benefits. Writes finansowe i KPI są silnie typowane i zatwierdzane.

### Vault, Notes, Materials i Canvas

Select/retrieve cited sources; create note draft; generate/edit artifact from
template; request review; publish/share after approval. Source manifest przechodzi
do output. Vault context jest wybierany per step, nie globalnie bez kontroli.

### Organization/Admin

Resolve users/project roles/teams; read policies and capability availability;
request connection/permission. Agent nie nadaje sobie roli ani nie omija Admina.

## 4. External connectors i MCP

Proces binduje capability do konkretnej connection w swoim scope. Przykład:
`calendar.create_event` może zostać związane z Outlook albo Google Calendar,
ale graf pozostaje provider-neutral. Binding przechowuje connector ID,
connection reference, account/tenant label, granted scopes, environment i owner.

Przed publish/run sprawdzamy:

- capability/version availability;
- connection health i reauth;
- required vs granted scopes;
- data residency/subprocessor policy;
- execute-as identity;
- rate limits i expected volume;
- sandbox/test availability;
- recipient/domain restrictions.

Remote MCP jest traktowany jak zewnętrzny provider capabilities: trust profile,
allowlist tools, schema validation, egress policy, timeout, audit i kill switch.

## 5. Events i waits

Agent może czekać na event ownera zamiast polling:

- interview.submitted/verified;
- decision.published;
- task.completed/blocked;
- initiative.approved;
- execution.milestone_reached;
- kpi.threshold_breached;
- material.approved/published;
- vault.document.ready;
- connector.record_changed;
- approval.resolved.

Wait subscription ma correlation key, tenant/project scope, expiry i duplicate
handling. Event payload jest walidowany, a ponowienie nie uruchamia drugiej gałęzi.

## 6. End-to-end proces transformacji — wzorzec flagowy

1. Trigger: sponsor uruchamia proces i określa ambicję.
2. Teresa kontraktuje scope, zespół, oczekiwane efekty i governance.
3. Vault/connector ingestuje źródła; agent sprawdza coverage.
4. Interview/Assessment/Tools realizują diagnozę równolegle.
5. Agent syntetyzuje findings z cytatami i konfliktami.
6. Generator tworzy initiative candidates; Teresa deduplikuje z portfolio.
7. Finance/risk/capacity analizują wykonalność i scenariusze.
8. Decision gates zatwierdzają portfolio i harmonogram.
9. Execution/Tasks/Calendar realizują plan; agent monitoruje blockers.
10. KPI/Results porównują target i actual, uruchamiając corrective loops.
11. Materials tworzy raport/deck; sponsor zatwierdza i publikuje.
12. Closure zapisuje accepted results, lessons i propozycję ulepszenia procesu.

Każdy etap może być reusable sub-process. Proces nadrzędny trzyma outcome,
dependencies i governance, nie wkleja całej wewnętrznej implementacji.

## 7. Pytania do odbioru

1. Które modułowe capabilities są obowiązkowe dla MVP flagowego procesu?
2. Czy provider-neutral binding jest wymagany od początku, czy pierwsze bloki są provider-specific?
3. Czy event bus jest źródłem wake-up, czy MVP użyje trwałego pollingu?
4. Które external connectors muszą przejść golden flow w dwa dni MVP?
5. Czy agent może automatycznie utworzyć corrective task po KPI alert w pre-approved policy?
