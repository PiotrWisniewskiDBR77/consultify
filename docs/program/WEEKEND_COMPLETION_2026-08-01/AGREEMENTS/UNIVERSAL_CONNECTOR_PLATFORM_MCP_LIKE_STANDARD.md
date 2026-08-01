---
doc_kind: CROSS_APPLICATION_INTEGRATION_STANDARD
status: REVIEW
owner_business: user
last_updated: 2026-07-31
---

# Consultify Universal Connectors — standard połączeń podobny do MCP

Status kompletności i zgodności ze starszymi kontraktami znajduje się w
[`UNIVERSAL_CONNECTORS_DOCUMENTATION_READINESS_AUDIT.md`](UNIVERSAL_CONNECTORS_DOCUMENTATION_READINESS_AUDIT.md).

## 1. Decyzja produktowa

Zewnętrzne narzędzie podłącza się do Consultify jeden raz, w jednym miejscu i według jednego przepływu. Po autoryzacji platforma odkrywa jego zdolności, a Inbox, Calendar, Chat/Teresa, Notes, Materials i pozostałe moduły korzystają z nich zgodnie z zakresem, uprawnieniami oraz polityką organizacji.

Wzorzec użytkownika:

`Wybierz connector → Połącz → Zobacz żądane dostępy → Zatwierdź → Test połączenia → Wybierz zastosowania → Gotowe`

Nie budujemy oddzielnego ekranu OAuth, token store, health modelu i audit logu dla każdego modułu.

## 2. Inspiracja MCP, nie ślepa kopia

MCP standaryzuje trzy klasy zdolności: `Resources` (dane/kontekst), `Tools` (działania) i `Prompts` (kontrolowane przepływy). Consultify przyjmuje ten język również dla konektorów natywnych. Oficjalny MCP wymaga świadomej zgody użytkownika, kontroli danych i narzędzi oraz mocnego modelu autoryzacji; aktualny standard opiera autoryzację HTTP na OAuth 2.1, discovery i resource-bound tokens. Źródła: [MCP server primitives](https://modelcontextprotocol.io/specification/2025-06-18/server/index), [MCP security principles](https://modelcontextprotocol.io/specification/2025-03-26/index), [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization), [Anthropic MCP overview](https://docs.anthropic.com/en/docs/mcp).

Consultify obsługuje dwa rodzaje adapterów za jednym UI:

- `Native connector` — utrzymywany przez Consultify adapter do Google, Microsoft, Slack itd.;
- `Remote MCP connector` — zgodny serwer MCP, dopuszczony przez politykę organizacji.

Użytkownik nie musi rozumieć tej różnicy podczas codziennej pracy. Widzi dostawcę, dane, działania, stan i zakres dostępu.

## 3. Jeden manifest zdolności

Każdy connector publikuje znormalizowany manifest:

```text
identity: id, provider, version, owner, trust tier
auth: method, discovery metadata, scopes, audience
resources: typy danych, schema, pagination, search, subscriptions
tools: input/output schema, mutability, idempotency, approval class
events: event types, delivery, ordering, replay protection
sync: none/read/write/bidirectional, cursor, freshness, conflict model
limits: rate limits, quotas, payload size
security: data classes, retention, residency, tenant support
health: status, last success, degraded reason, next step
```

Moduł nie sprawdza nazwy providera. Pyta control plane o capability, np. `calendar.events.read`, `mail.message.reply`, `chat.thread.search` albo `files.document.read`.

## 4. Prosty onboarding

### Krok 1 — katalog

Użytkownik wyszukuje narzędzie w `Settings → Integrations`. Karta pokazuje logo, zastosowania, publishera, trust tier, dane odczytywane, możliwe działania i status organizacyjnego dopuszczenia.

### Krok 2 — zgoda

Ekran pokazuje scopes w języku użytkownika, rozdzielając:

- `Może odczytywać`;
- `Może tworzyć/zmieniać`;
- `Może działać w tle`;
- `Może udostępniać Teresie jako kontekst`.

Domyślnie prosimy o minimalny read scope. Write i background subscriptions są step-up authorization uruchamianym dopiero przez funkcję, która ich potrzebuje.

### Krok 3 — wybór zakresu

Konto, mailbox/calendar/workspace, wybrane projekty/kanały/foldery, kierunek synchronizacji, retencja i użytkownicy/role. `Wszystko` nie jest bezrefleksyjnym defaultem.

### Krok 4 — test i preview

Platforma wykonuje connection test oraz preview pierwszych zasobów bez ich promocji do kanonu. Pokazuje wykryte capability, brakujące scopes i przewidywane moduły zastosowania.

### Krok 5 — aktywacja

Użytkownik zaznacza zastosowania: Inbox, Calendar, Teresa/Search, Notes Capture, Materials. Aktywacja tworzy subscriptions/checkpoints i zapisuje politykę.

## 5. Control plane i data plane

`Connector Control Plane` jest jednym właścicielem:

- katalogu, instalacji i connection identity;
- OAuth/MCP session lifecycle i bezpiecznego token store;
- scopes, capability registry i policy resolution;
- health, quotas, subscriptions i operator diagnostics;
- audit, disable, reconnect i revoke.

`Connector Data Plane` wykonuje:

- resource reads/search/sync;
- tool calls;
- webhook/event ingestion;
- normalization i schema validation;
- rate limiting, retries, idempotency i conflict handling.

Inbox, Calendar i pozostałe moduły nie otrzymują tokenów. Wywołują capability gateway z user/org/project contextem.

## 6. Zastosowanie w modułach

| Moduł | Resources | Tools | Events |
| --- | --- | --- | --- |
| Calendar | calendars, events, availability | create/update/respond | event changed/invite |
| Inbox | messages, mentions, assignments | reply/snooze/route/approve jeśli dozwolone | actionable event |
| Teresa/Chat | scoped search/read | proposal tool calls | optional refresh |
| Notes | messages/files/pages for capture | create backlink/export | source changed |
| Materials | files/folders/docs | import/export/share | file changed |
| Meeting | events/participants/transcripts | schedule/join/follow-up | meeting started/ended |

Jedno połączenie może obsłużyć wiele modułów. Każde zastosowanie ma jednak osobną policy binding i może być wyłączone bez odłączenia całego providera.

## 7. Trust i approval

Klasy narzędzi:

- `read` — retrieval w zakresie ACL;
- `reversible_write` — draft, label, snooze;
- `business_write` — task/event/message/update;
- `high_impact` — approval, delete, external send, permission change, bulk mutation.

`business_write` i `high_impact` przechodzą proposal/preview/approval, chyba że administrator zdefiniował wąską, audytowalną politykę autonomii. Remote MCP tool descriptions są traktowane jako niezaufane metadata do czasu admission review. Token passthrough jest zabroniony; token ma właściwego audience i connector używa osobnej autoryzacji upstream.

## 8. Lifecycle

`available → connecting → connected → degraded → requires_action/recoverable → connected` albo `blocked/disconnected`.

Użytkownik widzi prosty status i następny krok. Admin/operator widzi scope drift, token/subscription expiry, rate limit, schema/version mismatch, webhook health i trace ID.

## 9. Rozłączanie

`Disconnect` zatrzymuje nowe odczyty, zapisy i subscriptions, unieważnia token/session oraz informuje, które pochodne pozostają zgodnie z retencją. `Delete imported data` jest osobną, świadomą i audytowaną operacją. Reconnect zachowuje connection identity, gdy jest to bezpieczne.

## 10. Dodanie kolejnego narzędzia

Nowy connector jest gotowy bez zmian w modułach, jeśli:

1. spełnia manifest i capability schemas;
2. przechodzi security/admission review;
3. mapuje resources/tools/events do kanonicznych kontraktów;
4. ma auth, health, retry, rate-limit i revoke;
5. ma contract tests oraz sandbox fixtures;
6. nie omija owner-module approval/read-back;
7. pojawia się automatycznie w katalogu i capability resolverze.

## 11. MVP

P0 platformy:

- jeden katalog i ekran `Connect`;
- Google Workspace i Microsoft 365 jako reference connectors;
- OAuth discovery/PKCE, minimal scopes, encrypted token store;
- capability manifest/registry/gateway;
- per-module bindings;
- health/reauth/disconnect/revoke;
- Calendar + Inbox + Teresa read integration;
- proposal gate dla writes;
- pełny audit i tenant isolation.

P1: Slack/Teams, generic remote MCP install, admin admission workflow, richer search/resources, background subscriptions. P2: marketplace, partner connectors, constrained autonomous tools i organization-wide connector templates.

## 12. Golden flows

- GF-X1 Connect Google/Microsoft raz → capability widoczne w Calendar, Inbox i Teresa;
- GF-X2 read scope działa → write action wywołuje step-up consent;
- GF-X3 scope revoked → wszystkie moduły pokazują spójny `requires_action`;
- GF-X4 disconnect → brak dalszych tool calls/webhooks i czytelna retencja;
- GF-X5 remote MCP untrusted tool → blocked przed admission;
- GF-X6 connector update zmienia schema → compatibility gate, brak silent break;
- GF-X7 duplicate webhook/retry → jeden skutek;
- GF-X8 user bez resource ACL → brak wyniku w module i Teresie;
- GF-X9 high-impact tool → preview/approval/audit/read-back;
- GF-X10 nowy zgodny connector → dostępny bez zmian frontendów modułów.

## 13. Istniejące kontrakty wykonawcze

Ten standard jest warstwą produktową nad istniejącymi kontraktami v8, a nie ich zamiennikiem:

- `docs/product/CONNECTOR_CONTROL_PLANE_AND_API_CONTRACT_V8.md`;
- `docs/product/CONNECTOR_OAUTH_AND_REAUTH_LIFECYCLE_V8.md`;
- `docs/product/CONNECTOR_SYNC_MODES_AND_CONFLICT_RESOLUTION_V8.md`;
- `docs/product/CONNECTOR_EVENT_CONTRACTS_AND_SCHEMA_EVOLUTION_V8.md`;
- `docs/product/AI_CONNECTORS_ENTERPRISE_SEARCH_ARCHITECTURE_V8.md`;
- `docs/product/MCP_AND_REMOTE_TOOL_TRUST_MODEL_V8.md`.
