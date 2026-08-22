# ADM-OWN-001 — seven-task Admin reconstruction blueprint

Date: `2026-08-21`

Status: `PROPOSED_UNRECONCILED`

Functional readiness: `NOT VERIFIED`

This document coordinates three simulated expert reviews: enterprise IA/UX,
functional completeness, and security/governance. It does not represent actual
employees of named consulting firms and does not confirm backend operation.

## Piotr's original wording

> Dobrze, teraz zobacz, tutaj mamy zupełnie inny układ w ogóle tych ekranów. Ten jest jeszcze bardziej prehistoryczny i wymyślany w ogóle przez system automatycznie. W ramach tych siedmiu obszarów musimy najpierw zaprojektować, czy wszystkie funkcjonalności do zarządzania panelem administratora, które mamy w kontekście współpracy całej aplikacji jako organizacji, są gotowe. To jest pierwsza praca. Do tego potrzebujemy trzech ekspertów.
>
> Po drugie, musimy wspólnie, razem z zakładką „Organizacja i ustawienia”, ustalić sposób prezentowania. Obecnie każdy ekran jest inny, więc musimy jasno określić, jak wygląda panel boczny menu administratora, jak wyglądają menu wertykalne oraz jaki typ UX jest potrzebny dla poszczególnych elementów. To trzeba od nowa skonstruować. Jeśli zakładamy, że wszystkie elementy są podłączone po prawej stronie, wystarczy jedynie przeorganizować ich wygląd.
>
> Wniosek: chciałbym, abyś teraz przeanalizował te siedem elementów. Zrób to w trzech zespołach ekspertów, a każdy ekspert niech przedstawi swoją koncepcję dotyczącą organizacji menu – czy jest ono już dobrze zbudowane, czy wymaga zmian, połączeń lub głębszego uszczegółowienia.
>
> Następnie, jako koordynator, podsumuj, jak ma wyglądać menu: wszystkie ekrany, przyciski i funkcje na nich. Opisz także, jak ma wyglądać graficznie, aby było spójne z całą organizacją.

## Task 1 — Analysis of the existing menu

Verdict: `RECONSTRUCTION_REQUIRED`.

The seven entries are directionally relevant but not a coherent hierarchy.
They mix daily tasks (`Zespół i dostęp`), commercial configuration
(`Rozliczenia`), policy domains (`Sterowanie AI`, `Bezpieczeństwo`), evidence
(`Audyt`), an ambiguous dashboard metaphor (`Centrum dowodzenia`) and a
technical surface (`Health`). Screen structure, labels, card density, tabs,
tables, form widths and CTA locations differ substantially.

Visible UI confirms the existence of surfaces only. It does not establish:

- backend RBAC enforcement;
- persistent writes and readback;
- billing-provider synchronization;
- AI policy enforcement at runtime;
- SSO/MFA/session enforcement;
- append-only audit ingestion;
- real telemetry behind Health;
- safe retries or destructive-operation controls.

## Task 2 — Proposed changes

Retain seven task domains but rename and clarify responsibility:

1. `Zespół i dostęp` — users, invitations, roles, teams and ownership.
2. `Rozliczenia i plany` — plan, usage, payments, invoices, limits.
3. `Sterowanie AI` — models, policies, data/privacy, budgets, features,
   evaluation/incidents.
4. `Bezpieczeństwo i tożsamość` — login, SSO/SCIM, sessions, security policy,
   API/service identities and incidents.
5. `Dziennik audytu` — events, exports, retention and integrity.
6. `Centrum administracyjne` — alerts and required actions; aggregation only.
7. `Stan systemu` — services, integrations, background jobs, incidents and SLA.

Ownership boundaries:

- user/role belongs to Team;
- plan/invoice belongs to Billing;
- model/policy belongs to AI Control;
- identity/session/key belongs to Security;
- immutable event belongs to Audit;
- alert belongs to Command Center;
- service check/incident belongs to System Health.

Command Center never duplicates configuration. Health never substitutes audit.
Security policy never becomes a second role editor.

## Task 3 — Graphic design

Apply [`../CROSS_MODULE/SETTINGS_UI_STANDARD.md`](../CROSS_MODULE/SETTINGS_UI_STANDARD.md):

- Settings-style expandable left modules and indented child screens;
- same breadcrumb row, content start, page width and spacing;
- same section cards, border, radius, icon/title row and dividers;
- same typography and semantic color tokens;
- controls aligned right of label/help text on desktop;
- one dominant CTA per screen;
- common `LOADING`, `EMPTY`, `PARTIAL`, `ERROR`, `UNAUTHORIZED`, `STALE`,
  `DEGRADED` and success/readback states;
- no raw technical detail in the main business view;
- no giant empty surface or ultra-wide one-row table.

## Task 4 — Screen definition

### 1. Zespół i dostęp

Child screens:

- `Użytkownicy`: name, email, role, team, status, MFA, login/activity and
  security alert; filters and detail drawer.
- `Zaproszenia`: pending/accepted/expired/revoked/failed; resend, revoke and
  expiry.
- `Role i uprawnienia`: permission matrix, system/custom roles, effective
  permissions, comparison and impacted users.
- `Zespoły i dostęp zewnętrzny`: membership, guest scope and expiry.
- `Własność`: current owner, transfer safeguards and successor selection.

### 2. Rozliczenia i plany

Child screens:

- `Plan`: state, period, price/currency, next billing date and seats.
- `Wykorzystanie`: seats, AI, storage and billable operations with trends.
- `Płatności`: masked method, billing entity and payment attempts.
- `Faktury`: period, amount, state and secure download.
- `Limity i alerty`: thresholds, recipients and behavior at limit.

### 3. Sterowanie AI

Child screens:

- `Modele i routing`: providers, allowed/default models, function mapping,
  fallback and active versus draft configuration.
- `Polityki użycia`: allowed roles/modules/actions, human approval and autonomy.
- `Dane i prywatność`: data classes, masking, retention, training use and
  regions.
- `Budżety i limity`: organization/team/user limits and alerts.
- `Funkcje i persony`: enabled assistants/functions and defaults.
- `Ewaluacja i incydenty`: quality, rejected outputs, interventions and safety
  events.

### 4. Bezpieczeństwo i tożsamość

Child screens:

- `Logowanie i MFA`;
- `SSO i provisioning` with SAML/OIDC, domains, SCIM and group mapping;
- `Sesje` with revoke actions;
- `Polityki bezpieczeństwa`;
- `Klucze API i service accounts` with masked secrets and rotation;
- `Alerty i incydenty`.

### 5. Dziennik audytu

Child screens:

- `Zdarzenia`: time, actor, action, object, result, risk and safe diff;
- `Eksporty`: request history, scope, status, expiry and audited download;
- `Retencja i integralność`: retention policy and immutability evidence.

### 6. Centrum administracyjne

Child screens:

- `Przegląd`: critical alerts, required decisions, domain status and latest
  critical changes;
- `Alerty`: impact, priority, owner, timestamp and one deep-link action;
- `Wymagane decyzje`: exact decision, evidence, consequence and due owner;
- `Wykorzystanie`: aggregated seats, AI and storage only.

Every widget shows source and freshness. `UNKNOWN` replaces false green when
data is absent.

### 7. Stan systemu

Child screens:

- `Przegląd usług`;
- `Integracje`;
- `Kolejki i zadania`;
- `Incydenty`;
- `Historia i SLA`.

Every status shows environment, timestamp, source, business impact, dependency
and owner. Customer admins see only safe, authorized operational detail.

## Task 5 — Button and function design

Common button contract:

- primary action uses an imperative business label;
- secondary actions use neutral treatment;
- destructive action is visually separated and never the default;
- disabled buttons explain the missing permission or prerequisite;
- success appears only after readback, not after a click;
- every mutating action writes actor, time, object, result, reason and safe diff
  to audit.

Critical button matrix:

| Domain | Primary actions | Required safeguard |
|---|---|---|
| Team | Invite, change role, suspend, transfer ownership | impacted access, successor, re-auth for ownership |
| Billing | Change plan, seats, payment method, alerts | price/date preview, Billing permission, provider readback |
| AI | Validate, publish, rollback policy/config | version diff, data/cost impact, runtime verification |
| Security | Test SSO, enforce MFA/SSO, revoke sessions/keys | successful test, break-glass, re-auth, audit |
| Audit | Filter, export, open event | scoped export, no secrets, audited download |
| Command Center | Resolve, assign, acknowledge, deep-link | canonical destination, source/freshness |
| Health | Refresh, safe probe, retry job, open incident | permission, idempotency, impact preview, readback |

All screens distinguish deactivate, disconnect and delete. Bulk actions show
exact targets before execution and success/failure per target afterward.

## Task 6 — Team coordination and integrated verdict

Consensus of the three expert teams:

- preserve seven responsibility domains, but reconstruct their hierarchy;
- use Settings as the common UI/navigation standard for Admin and Organization;
- split Command Center aggregation from technical Health;
- keep roles in Team and authentication policy in Security;
- separate AI configuration, data policy and budgets while exposing cost in
  Billing;
- make audit/provenance mandatory for every administrative mutation;
- never treat a screenshot, visible toggle or green badge as functional proof.

Disagreement to resolve: whether Command Center and Health should be one module
with two screens or remain separate domains. Current recommendation keeps them
separate because they answer different questions: business attention versus
technical availability.

## Task 7 — Final documentation and implementation plan

Recommended sequence:

1. approve ownership boundaries and final labels;
2. inventory current routes, controls, data sources and backend endpoints;
3. classify every function `CONNECTED`, `PARTIAL`, `UI_ONLY`, `NOT_VERIFIED`
   or `NOT_APPLICABLE`;
4. freeze the Settings-derived design tokens and component contract;
5. implement shared Admin shell and navigation without changing business logic;
6. migrate one domain at a time, starting with Team & Access;
7. add permission, error, stale, unauthorized and destructive states;
8. verify each mutation through UI plus API/database/provider readback and
   audit record;
9. run cross-domain flows: invite/role/revoke, billing/seat, AI policy/runtime,
   SSO/session revoke, audit/export, alert/deep-link and health/retry;
10. obtain owner visual and functional retest on one frozen candidate;
11. only then assign `FIXED` or `ACCEPTED`.

No implementation is authorized or performed by this intake document.
