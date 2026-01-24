# Security Mock Endpoints (UI Unblocking)

Tymczasowe endpointy, które zwracają dane przykładowe zamiast 501, żeby panel Security był używalny. Do zastąpienia produkcyjną implementacją (SSO, SCIM, audyt, role, polityki).

## SSO (`/api/integrations/sso/*`)

- `GET /configs` — lista konfiguracji (przykład: Google SSO dla org-demo).
- `POST /configs` — tworzy config (`organizationId`, `provider`=`google`/`saml`, `clientId`, `domains`, `acsUrl`, `entityId`).
- `PUT /configs/:id`, `DELETE /configs/:id`.
- `GET /providers/google/metadata` — zwraca `redirectUri`.
- `GET /providers/saml/metadata/:orgId` — zwraca `entityId` i `acsUrl`.
- `GET /domain-mapping` — pusta lista.

## SCIM (`/api/integrations/scim/*`)

- `GET /info` — base URL, endpoints, auth info.
- `GET /tokens`, `POST /tokens`, `DELETE /tokens/:id` — tokeny SCIM (mock 1 szt.).
- `GET /v2/Users`, `GET /v2/Groups` — puste listy (unikamy 501).

## Security core (`/api/security/*`)

- `GET /admin-sessions` — przykładowa 1 sesja admin.
- `GET /audit-logs` — 1 log + statystyki.
- `GET /api-keys/usage` — pusta lista.
- `GET /workflows` — 1 workflow, `GET /workflows/requests` — 1 pending request.
- `GET /incidents`, `GET /threats`, `GET /dlp` — po 1 przykładzie.
- `GET /ai-budgets` — 1 budżet i przykładowe ceny modeli.
- `GET /permissions/definitions` — przykładowe 4 permisy.
- `GET /roles`, `POST /roles`, `PUT /roles/:id`, `DELETE /roles/:id` — role in-memory (brak persistence).

## Security Policies (`/api/security-policies/*`)

- `GET /` — 4 polityki (password, session timeout, MFA required, IP allowlist).
- `PUT /:id` — aktualizacja in-memory (brak persistence).

## Uwagi

- Dane trzymane w pamięci — restart serwera kasuje stan.
- Brak realnej walidacji ani integracji z IdP/SCIM — tylko do odblokowania UI.
- Przy wdrożeniu produkcyjnym: podmienić mocki na właściwe serwisy, dodać RLS/tenant isolation, audyt i logowanie do SIEM.\*\*\*
