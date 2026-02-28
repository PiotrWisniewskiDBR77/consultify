## Scope

Digest rozmów o **Synchronizacji / Integracjach**: providerzy na poziomie organizacji, UI w Settings, logi synchronizacji, oraz konkretne integracje (Slack/Teams, Jira, Drive/SharePoint, Calendar, automations).

## Decisions (hard)

- **Jedna warstwa integracji jako SSOT**: integracje są org-level (system-of-record) + mają realne statusy i logi (bez mocków).
- **Sync ma audyt i health**: minimalnie `last_sync`, `last_error`, `error_count` + link do logów.
- **MVP nie udaje “pełnego bidirectional”**: write-back / konflikty / kolejki = osobne rozszerzenia, jeśli nie wchodzą do R1.
- **Runbooki per vendor jako SSOT**: integracje enterprise mają osobny, kanoniczny dokument runbooków (auth/scopes/endpoints/webhooks/limity/test plan + checklisty tasków).
- **MCP-IRIS contract**: MCP jest traktowany jako connector klasy enterprise (transport `/mcp`, allowlist tooli, kontekst per-org/per-request, mapowanie błędów retriable vs non-retriable).

## Requirements (MUST / SHOULD)

- **MUST**: Settings → Integrations pokazuje providerów i połączenia z backendu (real data, real status).
- **MUST**: Każdy sync zapisuje wpis do `integration_sync_log`, a UI umie go wyświetlić (tabela minimalna).
- **MUST**: “Sync now” (manual trigger) dla przynajmniej jednego providera i widoczny log.
- **SHOULD**: kanały Slack/Teams mapowane per projekt (notifications/gates → kanał).
- **SHOULD**: Jira: bi-directional sync tasków + status mapping (min. 1 projekt).
- **SHOULD**: Calendar: Google Calendar + Outlook (due dates + gate reviews).

## Open questions

- Jakie są priorytetowe providery na R1 (Slack/Teams vs Jira vs Calendar vs Drive).
- Jak komunikujemy ograniczenia sync (np. “read-only sync” vs “bidirectional”) w UI, żeby nie było oczekiwań.

## SSOT impact (files to update / keep aligned)

- `docs/product/INTEGRATIONS_SYNC_MCP_PLAN_V3.md`
- `docs/product/INTEGRATIONS_CONNECTOR_RUNBOOKS_ENTERPRISE_V3.md`
- `docs/flows/integration/EXTERNAL_INTEGRATIONS_FLOW.md`

## Backlog extraction (mapowanie na V3)

- **V3-M01** — Integrations foundation: org-level providers + Settings UI (no mocks) + sync logs
- **V3-M02** — Communication sync: Slack + Teams notifications + channel mappings (projects/gates)
- **V3-M03** — PM sync: Jira bi-directional tasks + status mapping + webhook inbound
- **V3-M04** — Storage exports: Google Drive + OneDrive/SharePoint publish for reports/decks
- **V3-M05** — Calendar sync: Google Calendar + Outlook (due dates + gate reviews)
- **V3-M06** — Automation backbone: Zapier/Make API keys + event catalog + rate limits
- **V3-M10** — Research sources connectors (np. EDGAR/GDELT/registries/patents)
- **V3-M11** — Knowledge sources connectors (np. OpenAlex/Crossref/Semantic Scholar/PubMed/arXiv/DOAJ)
- **V3-M12** — Competitive intel APIs connectors (np. Similarweb/Semrush/BuiltWith/Wappalyzer, BYOS)
- **V3-M13** — Integrations consolidation: one SSOT layer + deprecations

## Notes (źródła rozmów)

- Cursor transcript: `518c688e-48f6-41f0-909a-629f129253f2` (sekcja “Synchronizacja”, external sync jako osobny task, ClickUp/Jira/Calendar/Drive).
- Cursor transcript: `434ec11c-f065-4881-8c80-acf74a9c3aba` (MCP↔MES schemat, runbooki enterprise + audyt “SSOT vs realny produkt”).

