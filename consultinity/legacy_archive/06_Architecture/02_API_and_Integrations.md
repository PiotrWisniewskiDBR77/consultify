# 8. API & Integrations

## 8.1. API Philosophy

Consultify exposes a strictly versioned REST API.

### Standards
-   **Protocol**: HTTPS (TLS 1.2+).
-   **Content-Type**: `application/json`.
-   **Idempotency**: Implemented on `POST` requests via `Idempotency-Key` header (optional but recommended for integrations).
-   **Versioning**: URI Path Versioning (`/api/v1/...`). Breaking changes introduce v2, v3.

### Rate Limiting
-   **Standard**: 100 requests / minute per Tenant.
-   **Burst**: 200 requests / minute.
-   **Response**: HTTP 429 "Too Many Requests".

## 8.2. Core Integrations

### 1. Google Gemini (AI Provider)
-   **Direction**: Outbound (Consultify -> Gemini).
-   **Trigger**: User action (Chat, Generate) or Cron Job (Nightly analysis).
-   **Data**: Anonymized prompt context (JSON).
-   **Error Handling**: Retry x3 with exponential backoff. Fallback to cached default responses.

### 2. Stripe (Billing)
-   **Direction**: Bidirectional.
-   **Trigger**: Subscription events (Payment success/fail).
-   **Webhooks**: Consultify listens for `invoice.payment_succeeded` and `customer.subscription.deleted`.
-   **Security**: Signature verification (`Stripe-Signature`) mandatory.

### 3. SMTP (Transactional Email)
-   **Direction**: Outbound.
-   **Trigger**: Invites, Alerts, Password Reset.
-   **Retry**: BullMQ queue ensures delivery retry for 24h.

## 8.3. Future Integration Hooks
(Available for Enterprise Customization)
-   **HRIS Sync**: Ingesting organizational charts from Workday/BambooHR.
-   **JIRA Sync**: Pushing "Initiatives" to JIRA Epics.
