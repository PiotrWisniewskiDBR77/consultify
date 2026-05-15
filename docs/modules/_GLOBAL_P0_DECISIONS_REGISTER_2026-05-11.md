---
doc_kind: GLOBAL_P0_DECISIONS_REGISTER
owner: user
status: approved
last_updated: 2026-05-11
scope: gb-p0-001-to-gb-p0-007
work_type: decision-log
---

# Global P0 Decisions Register (GB-P0-001..007)

## 1. Purpose

This register closes global P0 decision items required before broad runtime implementation.
All decisions are binding until explicitly superseded by owner decision log.

## 2. Decision Table

| ID | Decision | Why | Required execution effect | Decision status |
| --- | --- | --- | --- | --- |
| `GB-P0-001` | Final integration certification is mandatory before broad runtime rollout. | Prevent implementation on unresolved system contradictions. | Maintain and use `_FINAL_SYSTEM_INTEGRATION_CERTIFICATE_2026-05-11.md` as runtime planning entry gate. | `CLOSED` |
| `GB-P0-002` | Delivery lanes `/wordy`, `/excele`, `/prezentacje` stay explicitly blocked until mounted runtimes are proven; Teresa must route execution context to active lanes without fake claims. | Runtime truth and user trust. | Keep blocked lanes truthful, route active work through Outputs/active runtimes, no “working editor” claim on placeholders. | `CLOSED` |
| `GB-P0-003` | `09_outputs` is locked as shared library/governance owner; `10/11/12` own their specialized execution lanes and artifact forms. | Prevent ownership drift and duplicate truth. | Enforce ownership wording in contracts, handoffs and runtime links. | `CLOSED` |
| `GB-P0-004` | Approval-before-export/share/publish is a hard acceptance gate in `09/10/11/12`. | High-impact actions must be explicit and auditable. | Require proposal/review/approve-reject flow evidence before release claims. | `CLOSED` |
| `GB-P0-005` | Admin/SuperAdmin boundary policy: no hidden role inheritance for high-impact tenant mutations; deny-by-default unless explicitly authorized and auditable. | Security and tenancy hard-stop. | Keep explicit policy row + ACL deny-path tests + audit disclosure requirements. | `CLOSED` |
| `GB-P0-006` | Chat/Teresa must never imply execution in blocked lanes. | Entry-point trust and runtime honesty. | Route/copy behavior must disclose context transfer vs real execution capability. | `CLOSED` |
| `GB-P0-007` | Canonical handoff payload shape is locked for runtime use. | Traceability, auditability and cross-module consistency. | Use fixed metadata shape in `MODULE_HANDOFFS.md` and module acceptance rows. | `CLOSED` |

## 3. P0 Runtime Policy Snapshot

1. Teresa executes work, but modules own durable domain truth.
2. Placeholder routes are allowed only with truthful blocked-state UX.
3. Any critical claim must have evidence or explicit `NOT_DONE`.
4. Security/tenant uncertainty resolves to deny-by-default.

## 4. Required Follow-up (P1)

- Convert decision closures into runtime evidence (`route/component/API/test`) in Wave 1 and Wave 2.
- Keep every unresolved evidence row as explicit `NOT_DONE` until proven.
