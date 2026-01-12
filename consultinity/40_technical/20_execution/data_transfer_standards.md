# Data Transfer & Formatting Standards

**Last Updated:** 1 January 2026  
**Reference Domain:** Cross-System Data Integrity

To ensure IBM-grade system reconstruction, this document codifies the mandatory data formatting standards for the Consultinity ecosystem.

---

## 1. Primary Operational Enums

### `InitiativeStatus`
Canonical states for transition validation.
- `DRAFT`
- `PLANNING`
- `REVIEW`
- `APPROVED`
- `EXECUTING`
- `BLOCKED`
- `DONE`
- `CANCELLED`
- `ARCHIVED`

### `Capability` (RBAC)
Authoritative list of certifiable system permissions.
- `manage_users`, `manage_billing`, `export_data`
- `create_project`, `manage_stage_gates`, `approve_changes`
- `ai_execute_actions`, `ai_view_insights`

---

## 2. Naming & Case Conventions

### API Payloads (JSON)
All keys must use `camelCase`.
- ✅ `organizationId`
- ❌ `organization_id`

### Database (PostgreSQL)
All column names must use `snake_case`.
- ✅ `created_at`
- ❌ `createdAt`

### CSS (Vanilla)
All class names must use `kebab-case`.
- ✅ `status-indicator--active`
- ❌ `statusIndicatorActive`

---

## 3. Formatting Rules

### Temporal Data
All timestamps transmitted over the API must follow **ISO-8601** (UTC):
`2026-01-01T22:00:00.000Z`

### Financial Data
Budgets and ROI calculations must be handled as `Number` types (double precision) to avoid floating point errors in multi-currency reporting.
- **Base Currency**: Default to `PLN` unless `organizationProfile.currency` overrides.

### Unique Identifiers
All entity IDs must be **UUID v4**. Autoincrementing integers are forbidden for public-facing or linked objects to prevent enumeration attacks and ensure multi-tenant security.

---

## 4. Compliance & Audit
Every data transfer involving PII (Personally Identifiable Information) must be scrubbed by the `AIGateway` before reaching external LLM providers.
- **Scrubbing Rules**: Mask emails, phone numbers, and full names (replace with `[USER_ID]`).
