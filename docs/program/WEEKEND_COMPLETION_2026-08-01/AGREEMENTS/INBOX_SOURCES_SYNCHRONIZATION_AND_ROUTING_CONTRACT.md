---
doc_kind: INTEGRATION_AND_ROUTING_CONTRACT
function_id: MW_INBOX
status: REVIEW
last_updated: 2026-07-31
---

# Inbox — źródła, synchronizacja, routing i deduplikacja

Nadrzędnym kontraktem podłączania wszystkich zewnętrznych źródeł jest
[`UNIVERSAL_CONNECTOR_PLATFORM_MCP_LIKE_STANDARD.md`](UNIVERSAL_CONNECTOR_PLATFORM_MCP_LIKE_STANDARD.md).
Inbox konsumuje znormalizowane resources/events/tools przez capability gateway; nie implementuje osobnego OAuth ani token lifecycle dla każdego źródła.

## 1. Źródła Wave 1

| Źródło | Przykłady | Canonical owner |
| --- | --- | --- |
| Tasks | assignment, deadline, blocker, comment | Tasks/Execution |
| Decisions | request, reminder, escalation, result | Decisions |
| Initiatives/Execution | approval gate, milestone risk, role change | Initiatives/Execution |
| Interview/Assessment/Tools | request to answer/review/approve | moduł procesu |
| Meeting/Calendar | invite, update, cancellation, RSVP, sync issue | Meeting/provider/Calendar |
| KPI/Results/Finance | threshold breach, review required | owner module |
| Chat/mentions | mention, reply, handoff | Chat/source object |
| System/Integrations | reauth, import failure, security/usage alert | platform/integration |
| Teresa | governed insight/proposal | proposal owner; nigdy AI jako prawda |

E-mail, Teams, Slack i inne connectory mogą być kanałem wejścia dopiero po zdefiniowaniu connector identity, ACL, retention, threading i owner handoff. Nie importujemy całej skrzynki pocztowej do Inboxa.

## 2. Canonical item

Minimalne pola:

- `inboxItemId`, userId, organizationId;
- `sourceEntityType`, `sourceEntityId`, sourceEventId;
- event type/version i material change fingerprint;
- title, brief, actor, project/context;
- section, priority, SLA/deadline;
- attention/triage/sync state;
- createdAt, updatedAt, snoozedUntil;
- reason/why-visible;
- owner deep link i allowed actions;
- AI proposal/confidence, jeśli użyto.

## 3. Ingestion

`source event/webhook → authenticate → authorize recipient → normalize → fingerprint → deduplicate/aggregate → route → persist → notify channel`

Materializacja okresowa służy recovery i backfill, nie może dublować event-driven itemów. Checkpoint per source zapobiega utracie i powtórzeniu. Item jest idempotentny względem source event/fingerprint.

## 4. Deduplikacja i agregacja

- identyczny source event: jeden item;
- wiele zmian tego samego pola w krótkim oknie: agregacja z licznikiem;
- nowy komentarz/mention po snooze: może obudzić item według polityki;
- eskalacja lub wzrost priority: aktualizuje istniejący open item i podbija uwagę;
- różne wymagane akcje na tym samym obiekcie pozostają osobne;
- agregacja nigdy nie ukrywa różnych ownerów, deadline'ów lub approvals.

## 5. Routing

Reguły deterministyczne mają pierwszeństwo przed AI:

1. typ źródła i zdarzenia;
2. recipient/role/project membership;
3. wymagane działanie;
4. SLA/severity/deadline;
5. user focus rules i subscriptions;
6. AI klasyfikacja jako proposal dla przypadków niejednoznacznych.

Routing rule ma priority, warunki, wynik, wersję, autora i audit. Konflikt reguł jest widoczny w administracji. Użytkownik może wpływać na widoki i kanały, ale nie wyłączyć obowiązkowych alertów bezpieczeństwa/governance.

## 6. Synchronizacja akcji

- lokalne `read/saved/snoozed/dismissed` należy do Inboxa;
- akcja źródłowa (`complete task`, `approve`, `delegate`, `RSVP`) jest commandem do ownera;
- przed wysłaniem: preview i permission check;
- po wysłaniu: `pending`;
- owner read-back: `in_sync` i aktualizacja itemu;
- timeout: pozostaje pending z retry;
- conflict/rejection: pokazuje powód, nie znika;
- retry ma idempotency key.

## 7. Kanały dostarczenia

In-app Inbox jest kanoniczną kolejką uwagi. Push, e-mail, Teams/Slack i mobile są kanałami powiadamiania, nie osobnymi inboxami prawdy. Delivery policy uwzględnia urgency, obecność użytkownika, digest, quiet hours i deduplikację między kanałami.

## 8. Retencja i bezpieczeństwo

- item dziedziczy ACL źródła;
- preview nie ujawnia pól niedostępnych;
- usunięcie dostępu unieważnia cache/search itemu;
- dismissed/done zachowują audit zgodnie z retention policy;
- webhook ma podpis/replay protection;
- brak raw tokenów i poufnych payloadów w logach;
- source deleted/revoked → bezpieczny tombstone zamiast martwego linku.
