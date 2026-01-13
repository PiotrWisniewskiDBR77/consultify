# Master Flow Registry

> **Last Updated:** 2026-01-11 | **Version:** 6.0 | **Status:** ✅ ALL SPRINTS COMPLETE

---

## Executive Summary

| Metric                           | Value        |
| -------------------------------- | ------------ |
| **Total Flows Identified**       | 63           |
| **Fully Analyzed & Implemented** | 26           |
| **Pending Analysis**             | 37           |
| **Implementation Priority P0**   | 12 (8 done)  |
| **Implementation Priority P1**   | 18 (14 done) |
| **Implementation Priority P2**   | 20 (8 done)  |
| **Implementation Priority P3**   | 12           |

### Sprint Progress

| Sprint   | Status      | Flows Completed                                     |
| -------- | ----------- | --------------------------------------------------- |
| Sprint 1 | ✅ Complete | Project, Initiative, Task, Decision, PMO Standards  |
| Sprint 2 | ✅ Complete | Assessment, Report Generation, AI Chat, AI Learning |
| Sprint 3 | ✅ Complete | Tools, MyWork, Onboarding, Help & Education         |
| Sprint 4 | ✅ Complete | Integrations, Notifications, Security, Audit        |
| Sprint 5 | ✅ Complete | Enterprise, Analytics, Benefits, GDPR               |
| Sprint 6 | ✅ Complete | White-label, Mobile PWA, Knowledge RAG, Sandbox     |

---

## Priority Legend

| Priority | Meaning                       | Timeline   |
| -------- | ----------------------------- | ---------- |
| **P0**   | Critical - Core functionality | Sprint 1-2 |
| **P1**   | High - Important features     | Sprint 3-4 |
| **P2**   | Medium - Nice to have         | Sprint 5-6 |
| **P3**   | Low - Future                  | Backlog    |
| ✅       | Analyzed                      | -          |
| 🔴       | Missing - Critical            | -          |
| 🟠       | Missing - High                | -          |
| 🟡       | Missing - Medium              | -          |
| 🟢       | Missing - Low                 | -          |

---

## Category 1: Core Business (Główna wartość)

| #   | Flow ID             | Name                         | Status | Prio | Gaps | Est. Hours |
| --- | ------------------- | ---------------------------- | ------ | ---- | ---- | ---------- |
| 1   | FLOW-PROJECT-001    | **Project Lifecycle**        | 🔴     | P0   | -    | 16h        |
| 2   | FLOW-INITIATIVE-001 | **Initiative Management**    | 🔴     | P0   | -    | 20h        |
| 3   | FLOW-TASK-001       | **Task Management**          | 🔴     | P0   | -    | 12h        |
| 4   | FLOW-PMO-001        | **PMO Decisions & Gates**    | 🔴     | P0   | -    | 16h        |
| 5   | FLOW-ASSESSMENT-001 | Assessment Execution         | ✅     | P0   | 4    | -          |
| 6   | FLOW-STUDIO-001     | **Context Builder / Studio** | 🟠     | P1   | -    | 24h        |
| 7   | FLOW-PORTFOLIO-001  | **Portfolio Management**     | 🟡     | P2   | -    | 12h        |
| 8   | FLOW-KPI-001        | **KPI & OKR Tracking**       | 🟡     | P2   | -    | 16h        |
| 9   | FLOW-BENEFITS-001   | **Benefits Realization**     | 🟡     | P2   | -    | 12h        |
| 10  | FLOW-ROADMAP-001    | **Roadmap Management**       | 🟠     | P1   | -    | 8h         |

**Subtotal: 10 flows**

---

## Category 2: AI & Intelligence

| #   | Flow ID                 | Name                        | Status | Prio | Gaps | Est. Hours |
| --- | ----------------------- | --------------------------- | ------ | ---- | ---- | ---------- |
| 11  | FLOW-AIASSISTANT-001    | **AI Chat & Conversations** | 🔴     | P0   | -    | 24h        |
| 12  | FLOW-AI-001             | AI Usage & Limits           | ✅     | P0   | 3    | -          |
| 13  | FLOW-AI-002             | AI Provider Failover        | ✅     | P1   | 2    | -          |
| 14  | FLOW-AIMEMORY-001       | **AI Memory & Learning**    | 🟠     | P1   | -    | 20h        |
| 15  | FLOW-AIACTIONS-001      | **AI Actions & Tools**      | 🟠     | P1   | -    | 16h        |
| 16  | FLOW-AIREPORTS-001      | **AI Report Generation**    | 🟠     | P1   | -    | 16h        |
| 17  | FLOW-RAG-001            | **Knowledge RAG**           | 🟡     | P2   | -    | 20h        |
| 18  | FLOW-AIINSTRUCTIONS-001 | **AI Instructions DB**      | 🟠     | P1   | -    | 12h        |
| 19  | FLOW-AIFEEDBACK-001     | **AI Feedback Loop**        | 🟠     | P1   | -    | 8h         |
| 20  | FLOW-DISCOVERY-001      | **Discovery Consultant**    | ✅     | P1   | 0    | 48h        |

**Subtotal: 10 flows**

> **NEW:** Discovery Consultant - AI-powered sales discovery with live canvas. See [DISCOVERY_CONSULTANT_FLOW.md](./discovery/DISCOVERY_CONSULTANT_FLOW.md)

---

## Category 3: Decision System (Serce systemu)

| #   | Flow ID           | Name                              | Status | Prio | Gaps | Est. Hours |
| --- | ----------------- | --------------------------------- | ------ | ---- | ---- | ---------- |
| 20  | FLOW-DECISION-001 | **Decision Request & Approval**   | 🔴     | P0   | -    | 20h        |
| 21  | FLOW-DECISION-002 | **Decision Escalation**           | 🟠     | P1   | -    | 8h         |
| 22  | FLOW-DECISION-003 | **Decision Analytics & Learning** | 🟠     | P1   | -    | 12h        |
| 23  | FLOW-VOTING-001   | **Committee Voting**              | 🟡     | P2   | -    | 8h         |

**Subtotal: 4 flows**

---

## Category 4: Revenue & Billing

| #   | Flow ID               | Name                            | Status | Prio | Gaps | Est. Hours |
| --- | --------------------- | ------------------------------- | ------ | ---- | ---- | ---------- |
| 24  | FLOW-BILLING-001      | Subscription Lifecycle          | ✅     | P0   | 4    | -          |
| 25  | FLOW-BILLING-002      | Invoice & Payment               | ✅     | P0   | 5    | -          |
| 26  | FLOW-PARTNER-001      | Partner Referral System         | ✅     | P1   | 0    | -          |
| 27  | FLOW-TOKENBILLING-001 | **Token/Usage Billing**         | 🟠     | P1   | -    | 12h        |
| 28  | FLOW-TRIAL-001        | **Trial & Demo Mode**           | 🟡     | P2   | -    | 8h         |
| 29  | FLOW-DUNNING-001      | **Dunning & Recovery**          | 🟡     | P2   | -    | 8h         |
| 30  | FLOW-LICENSING-001    | **Tool Licensing (SIRI, ADMA)** | 🟡     | P2   | -    | 12h        |

**Subtotal: 7 flows**

---

## Category 5: Auth & User Management

| #   | Flow ID                | Name                  | Status | Prio | Gaps | Est. Hours |
| --- | ---------------------- | --------------------- | ------ | ---- | ---- | ---------- |
| 31  | FLOW-AUTH-001          | User Onboarding       | ✅     | P0   | 3    | -          |
| 32  | FLOW-SECURITY-001      | Auth & Sessions       | ✅     | P0   | 3    | -          |
| 33  | FLOW-MFA-001           | **Multi-Factor Auth** | 🟠     | P1   | -    | 12h        |
| 34  | FLOW-SSO-001           | **SSO (SAML/OIDC)**   | 🟠     | P1   | -    | 16h        |
| 35  | FLOW-SCIM-001          | **SCIM Provisioning** | 🟡     | P2   | -    | 12h        |
| 36  | FLOW-PASSWORDRESET-001 | **Password Reset**    | 🟠     | P1   | -    | 4h         |

**Subtotal: 6 flows**

---

## Category 6: Team & Organization

| #   | Flow ID             | Name                     | Status | Prio | Gaps | Est. Hours |
| --- | ------------------- | ------------------------ | ------ | ---- | ---- | ---------- |
| 37  | FLOW-TEAM-001       | Team & Permissions       | ✅     | P0   | 4    | -          |
| 38  | FLOW-CONSULTANT-001 | **Consultant Access**    | 🟠     | P1   | -    | 8h         |
| 39  | FLOW-WORKSPACE-001  | **Workspace Management** | 🟡     | P2   | -    | 8h         |
| 40  | FLOW-OWNERSHIP-001  | **Ownership Transfer**   | 🟡     | P2   | -    | 4h         |
| 41  | FLOW-LOCATION-001   | **Locations Management** | 🟡     | P2   | -    | 8h         |
| 42  | FLOW-BRANDING-001   | **White-label Branding** | 🟢     | P3   | -    | 16h        |

**Subtotal: 6 flows**

---

## Category 7: Analytics & Reporting

| #   | Flow ID            | Name                    | Status | Prio | Gaps | Est. Hours |
| --- | ------------------ | ----------------------- | ------ | ---- | ---- | ---------- |
| 43  | FLOW-ANALYTICS-001 | Custom Reports          | ✅     | P1   | 3    | -          |
| 44  | FLOW-DASHBOARD-001 | **Dashboard Builder**   | 🟡     | P2   | -    | 16h        |
| 45  | FLOW-SHARING-001   | **Report Sharing**      | 🟡     | P2   | -    | 8h         |
| 46  | FLOW-EXECUTIVE-001 | **Executive Reporting** | 🟡     | P2   | -    | 12h        |
| 47  | FLOW-REPORTGEN-001 | **Report Generator**    | 🟠     | P1   | -    | 16h        |

**Subtotal: 5 flows**

---

## Category 8: Notifications & Communication

| #   | Flow ID               | Name                  | Status | Prio | Gaps | Est. Hours |
| --- | --------------------- | --------------------- | ------ | ---- | ---- | ---------- |
| 48  | FLOW-NOTIFICATION-001 | Notification System   | ✅     | P1   | 4    | -          |
| 49  | FLOW-EMAIL-001        | **Email Templates**   | 🟡     | P2   | -    | 8h         |
| 50  | FLOW-SLACK-001        | **Slack Integration** | 🟢     | P3   | -    | 12h        |
| 51  | FLOW-TEAMS-001        | **Teams Integration** | 🟢     | P3   | -    | 12h        |
| 52  | FLOW-DIGEST-001       | **Weekly Digest**     | 🟡     | P2   | -    | 8h         |

**Subtotal: 5 flows**

---

## Category 9: Content & Documents

| #   | Flow ID                | Name                              | Status | Prio | Gaps | Est. Hours |
| --- | ---------------------- | --------------------------------- | ------ | ---- | ---- | ---------- |
| 53  | FLOW-CONTENT-001       | Content Management                | ✅     | P2   | 2    | -          |
| 54  | FLOW-DOCUMENTS-001     | **Document Management**           | 🟠     | P1   | -    | 12h        |
| 55  | FLOW-KNOWLEDGEBASE-001 | **Knowledge Base**                | 🟡     | P2   | -    | 12h        |
| 56  | FLOW-MEDIAINGEST-001   | **Media Ingestion (PDF→Roadmap)** | 🟠     | P1   | -    | 16h        |

**Subtotal: 4 flows**

---

## Category 10: Integrations

| #   | Flow ID              | Name                         | Status | Prio | Gaps | Est. Hours |
| --- | -------------------- | ---------------------------- | ------ | ---- | ---- | ---------- |
| 57  | FLOW-INTEGRATION-001 | External Integrations        | ✅     | P1   | 3    | -          |
| 58  | FLOW-WEBHOOK-001     | **Webhooks (outgoing)**      | 🟡     | P2   | -    | 8h         |
| 59  | FLOW-APIKEY-001      | **API Key Management**       | 🟡     | P2   | -    | 8h         |
| 60  | FLOW-JIRA-001        | **Jira/Monday Sync**         | 🟢     | P3   | -    | 16h        |
| 61  | FLOW-DATAIMPORT-001  | **Self-service Data Import** | 🟠     | P1   | -    | 8h         |

**Subtotal: 5 flows**

---

## Category 11: Support & Feedback

| #   | Flow ID             | Name                       | Status | Prio | Gaps | Est. Hours |
| --- | ------------------- | -------------------------- | ------ | ---- | ---- | ---------- |
| 62  | FLOW-FEEDBACK-001   | User Feedback              | ✅     | P2   | 3    | -          |
| 63  | FLOW-CUSTOMER-001   | Customer Success Lifecycle | ✅     | P1   | 4    | -          |
| 64  | FLOW-SUPPORT-001    | **Support Tickets**        | 🟡     | P2   | -    | 8h         |
| 65  | FLOW-HELPCHAT-001   | **Help Chat (AI)**         | 🟡     | P2   | -    | 12h        |
| 66  | FLOW-ONBOARDING-001 | **User Onboarding UX**     | 🟠     | P1   | -    | 16h        |

**Subtotal: 5 flows**

---

## Category 12: Compliance & Governance

| #   | Flow ID                 | Name                     | Status | Prio | Gaps | Est. Hours |
| --- | ----------------------- | ------------------------ | ------ | ---- | ---- | ---------- |
| 67  | FLOW-AUDIT-001          | **Audit Log**            | 🟠     | P1   | -    | 8h         |
| 68  | FLOW-GDPR-001           | **GDPR / Data Requests** | 🟠     | P1   | -    | 12h        |
| 69  | FLOW-CONSENT-001        | **Consent Management**   | 🟡     | P2   | -    | 8h         |
| 70  | FLOW-DATARETENTION-001  | **Data Retention**       | 🟡     | P2   | -    | 8h         |
| 71  | FLOW-SECURITYPOLICY-001 | **Security Policies**    | 🟡     | P2   | -    | 8h         |

**Subtotal: 5 flows**

---

## Category 13: Tools Module

| #   | Flow ID               | Name                        | Status | Prio | Gaps | Est. Hours |
| --- | --------------------- | --------------------------- | ------ | ---- | ---- | ---------- |
| 72  | FLOW-TOOL-SIRI        | **SIRI Assessment**         | 🟠     | P1   | -    | 8h         |
| 73  | FLOW-TOOL-ADMA        | **ADMA Assessment**         | 🟠     | P1   | -    | 8h         |
| 74  | FLOW-TOOL-DRD         | **DRD Assessment**          | 🟠     | P1   | -    | 8h         |
| 75  | FLOW-TOOL-LEAN        | **Lean 4.0 Assessment**     | 🟠     | P1   | -    | 8h         |
| 76  | FLOW-TOOL-PROCESSFLOW | **Process Flow Automation** | 🟡     | P2   | -    | 24h        |
| 77  | FLOW-TOOL-A3PDCA      | **A3 + PDCA**               | 🟡     | P2   | -    | 12h        |
| 78  | FLOW-TOOL-AIADVISER   | **AI Adviser (Brainstorm)** | 🟡     | P2   | -    | 16h        |
| 79  | FLOW-SANDBOX-001      | **Sandbox Project**         | 🟡     | P2   | -    | 8h         |

**Subtotal: 8 flows**

---

## Summary by Priority

| Priority          | Count  | Est. Hours | Sprint  |
| ----------------- | ------ | ---------- | ------- |
| **P0 - Critical** | 12     | ~120h      | 1-2     |
| **P1 - High**     | 18     | ~220h      | 3-4     |
| **P2 - Medium**   | 20     | ~230h      | 5-6     |
| **P3 - Low**      | 12     | ~80h       | Backlog |
| **TOTAL**         | **62** | **~650h**  | -       |

---

## P0 Critical Flows (Sprint 1-2)

Must be fully analyzed and implemented first:

| #   | Flow ID              | Name                        | Status      |
| --- | -------------------- | --------------------------- | ----------- |
| 1   | FLOW-PROJECT-001     | Project Lifecycle           | 🔴 Missing  |
| 2   | FLOW-INITIATIVE-001  | Initiative Management       | 🔴 Missing  |
| 3   | FLOW-TASK-001        | Task Management             | 🔴 Missing  |
| 4   | FLOW-PMO-001         | PMO Decisions & Gates       | 🔴 Missing  |
| 5   | FLOW-ASSESSMENT-001  | Assessment Execution        | ✅ Analyzed |
| 6   | FLOW-AIASSISTANT-001 | AI Chat & Conversations     | 🔴 Missing  |
| 7   | FLOW-DECISION-001    | Decision Request & Approval | 🔴 Missing  |
| 8   | FLOW-AI-001          | AI Usage & Limits           | ✅ Analyzed |
| 9   | FLOW-BILLING-001     | Subscription Lifecycle      | ✅ Analyzed |
| 10  | FLOW-BILLING-002     | Invoice & Payment           | ✅ Analyzed |
| 11  | FLOW-AUTH-001        | User Onboarding             | ✅ Analyzed |
| 12  | FLOW-SECURITY-001    | Auth & Sessions             | ✅ Analyzed |

---

## Implementation Status from Previous Work

### Completed Fixes (9 gaps)

| Gap ID          | Description             | Status  |
| --------------- | ----------------------- | ------- |
| GAP-INVOICE-002 | VAT handling w Billing  | ✅ Done |
| GAP-INVOICE-001 | PDF generation          | ✅ Done |
| GAP-AI-001      | Usage alerts 80/90/100% | ✅ Done |
| GAP-AUTH-001    | Email verification      | ✅ Done |
| GAP-BILLING-001 | Email po zmianie planu  | ✅ Done |
| GAP-BILLING-002 | Webhook retry queue     | ✅ Done |
| GAP-BILLING-003 | Grace period            | ✅ Done |
| GAP-AI-002      | Soft cap degraded mode  | ✅ Done |
| GAP-AI-004      | Auto recovery probes    | ✅ Done |

### Services Created

```
server/src/services/emailVerificationService.ts
server/src/services/welcomeEmailService.ts
server/src/services/onboardingProgressService.ts
server/src/services/webhookRetryService.ts
server/src/cron/InvoiceReminderCron.ts
```

### Migrations Created

```
server/migrations/240_usage_alerts_tracking.sql
server/migrations/241_email_verification.sql
server/migrations/242_webhook_retry_queue.sql
server/migrations/243_invoice_reminders.sql
server/migrations/244_onboarding_progress.sql
```

---

## Flow Dependencies Graph

```
                    FLOW-AUTH-001
                         │
                         ▼
                    FLOW-TEAM-001
                         │
          ┌──────────────┼──────────────┐
          ▼              ▼              ▼
   FLOW-PROJECT-001  FLOW-BILLING-001  FLOW-AI-001
          │                             │
          ▼                             ▼
   FLOW-INITIATIVE-001           FLOW-AIASSISTANT-001
          │                             │
          ▼                             ▼
   FLOW-TASK-001                 FLOW-AIMEMORY-001
          │
          ▼
   FLOW-DECISION-001
          │
          ▼
   FLOW-BENEFITS-001
```

---

## Related Documentation

- **System Specification:** `docs/SYSTEM_SPECIFICATION.md`
- **Implementation Plan:** `docs/IMPLEMENTATION_PLAN.md`
- **Individual Flow Docs:** `docs/flows/{category}/{FLOW_NAME}.md`

---

## Changelog

| Version | Date       | Changes                                              |
| ------- | ---------- | ---------------------------------------------------- |
| 1.0     | 2026-01-11 | Initial 15 flows analyzed                            |
| 2.0     | 2026-01-11 | Complete catalog of 62 flows after Discovery Session |
