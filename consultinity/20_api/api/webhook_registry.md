# Webhook Registry & Event Specification

**Last Updated:** 1 January 2026  
**Standard:** Consultinity Perfect Standard (CPS) v1.0

This document serves as the authoritative registry for all outbound webhooks emitted by the Consultinity platform. It defines event triggers, payload structures, and security validation protocols.

---

## 1. Security Protocol

### Signature Validation
Every webhook request includes an `X-Consultify-Signature` header.
- **Algorithm**: `HMAC-SHA256`
- **Secret**: Provided during webhook subscription.
- **Payload**: The raw UTF-8 string of the JSON body.

### Delivery Guarantees
- **Timeout**: 5 seconds.
- **Retries**: 3 attempts with exponential backoff (1m, 5m, 15m).
- **Concurrency**: Webhooks are dispatched asynchronously via the `WebhookDeliveryService`.

---

## 2. Event Registry

### 2.1 Initiative Events

#### `initiative.created`
Triggered when a new transformation initiative is saved to the organization's portfolio.
```json
{
  "event": "initiative.created",
  "timestamp": "2026-01-01T22:00:00Z",
  "data": {
    "id": "uuid",
    "name": "Cloud Migration",
    "axis": "Infrastructure Maturity",
    "priority": "HIGH",
    "roi": 150.5
  }
}
```

#### `initiative.updated`
Triggered when an initiative's status or core properties change.
```json
{
  "event": "initiative.updated",
  "timestamp": "2026-01-01T22:05:00Z",
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "previous_status": "DRAFT"
  }
}
```

### 2.2 Task Events

#### `task.completed`
Triggered when a task within an initiative is marked as `completed`.
```json
{
  "event": "task.completed",
  "timestamp": "2026-01-01T22:10:00Z",
  "data": {
    "id": "uuid",
    "initiative_id": "uuid",
    "title": "Setup VPC",
    "completed_by": "user_uuid"
  }
}
```

---

## 3. Implementation Details

### Headers
| Header | Description |
| :--- | :--- |
| `X-Consultify-Signature` | HMAC signature for validation. |
| `X-Consultify-Event` | The event type (e.g., `initiative.created`). |
| `User-Agent` | `Consultify-Webhook/1.0` |

### Error Codes
- `WEBHOOK_TIMEOUT`: Destination did not respond in 5s.
- `WEBHOOK_BAD_RESPONSE`: Destination returned 4xx or 5xx.
