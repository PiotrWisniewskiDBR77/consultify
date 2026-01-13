# FLOW-INTEGRATION-001: External Integrations

> **ID:** FLOW-INTEGRATION-001 | **Status:** ✅ Complete | **Priority:** LOW

## Overview

| Metryka                  | Wartość |
| ------------------------ | ------- |
| **Kompletność**          | 70%     |
| **Zidentyfikowane luki** | 3       |
| **Priorytet naprawy**    | LOW     |

## Purpose

Zarządzanie integracjami zewnętrznymi: SSO, CRM, project management tools, i API connections.

## Triggers

| Trigger            | Opis                       |
| ------------------ | -------------------------- |
| Integration Enable | Admin włącza integrację    |
| OAuth Flow         | User autoryzuje połączenie |
| Sync Trigger       | Data sync initiated        |
| Webhook Receive    | External webhook arrives   |

## Outcomes

- Integracje skonfigurowane i działające
- Data synchronizowana między systemami
- SSO działa
- API dostępne dla partnerów

## Actors

| Aktor            | Rola                   |
| ---------------- | ---------------------- |
| Admin            | Konfiguruje integracje |
| System           | Sync, process webhooks |
| External Service | Sends/receives data    |

## Involved Modules

### Backend

| Serwis/Route          | Lokalizacja            |
| --------------------- | ---------------------- |
| integrationService    | `server/src/services/` |
| integrationHubService | `server/src/services/` |
| webhooks.routes.ts    | `server/src/routes/`   |
| apiKeys.routes.ts     | `server/src/routes/`   |

### Database

| Tabela               | Opis                    |
| -------------------- | ----------------------- |
| `integrations`       | Configured integrations |
| `integration_tokens` | OAuth tokens            |
| `api_keys`           | API keys for partners   |
| `webhook_events`     | Received webhooks       |

## Current Integrations Status

| Integration     | Status             |
| --------------- | ------------------ |
| Stripe Billing  | ✅ Full            |
| SSO (SAML/OIDC) | ⚠️ Partial         |
| Slack           | ✅ Basic           |
| Microsoft 365   | ⚠️ Planned         |
| Jira            | ❌ Not implemented |
| Salesforce      | ❌ Not implemented |

## Gap Analysis

### GAP-INTEGRATION-001: SSO incomplete

| Priorytet  | MEDIUM |
| ---------- | ------ |
| **Effort** | 8h     |

**Problem:** SSO (SAML/OIDC) jest częściowo zaimplementowane:

- SAML działa dla niektórych providerów
- OIDC wymaga testów
- Brak SCIM provisioning

---

### GAP-INTEGRATION-002: Brak integration marketplace

| Priorytet  | LOW |
| ---------- | --- |
| **Effort** | 12h |

**Problem:** Nie ma unified UI do przeglądania i włączania integracji.

---

### GAP-INTEGRATION-003: Rate limiting dla partner API

| Priorytet  | MEDIUM |
| ---------- | ------ |
| **Effort** | 4h     |

**Problem:** Partner API endpoints nie mają proper rate limiting i quota management.

---

## Summary

| Total Gaps       | 3    |
| ---------------- | ---- |
| **Total Effort** | ~24h |

## Related Flows

- FLOW-SECURITY-001: Auth & Sessions (SSO)
- FLOW-BILLING-001: Stripe integration
- FLOW-PARTNER-001: Partner API
