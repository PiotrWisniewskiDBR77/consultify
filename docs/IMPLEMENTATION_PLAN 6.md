# CONSULTINITY - Implementation Plan

> **Version:** 1.0 | **Last Updated:** 2026-01-11 | **Status:** Ready for Execution

---

## Executive Summary

Plan wdrożenia systemu Consultinity oparty na Discovery Session.
Całkowity szacowany czas: **~650 godzin** podzielonych na **6 sprintów**.

| Sprint | Focus                | Est. Hours | Flows |
| ------ | -------------------- | ---------- | ----- |
| 1      | Core Foundation      | 100h       | 6     |
| 2      | Core Completion      | 120h       | 6     |
| 3      | AI & Intelligence    | 110h       | 9     |
| 4      | Platform Features    | 110h       | 11    |
| 5      | Enterprise & Polish  | 100h       | 15    |
| 6      | Tools & Integrations | 110h       | 15    |

---

## Sprint 1: Core Foundation (P0)

**Goal:** Podstawowa funkcjonalność projektowa i decyzyjna

### Week 1-2

#### FLOW-PROJECT-001: Project Lifecycle

**Priority:** P0 | **Est:** 16h

**Tasks:**

- [ ] Analiza istniejącego kodu `projects.routes.ts`
- [ ] Dokumentacja flow w `docs/flows/core/PROJECT_LIFECYCLE_FLOW.md`
- [ ] Implementacja statusów projektu (DRAFT, ACTIVE, ON_HOLD, COMPLETED, ARCHIVED)
- [ ] Endpoint: Create project z wyborem PMO standard
- [ ] Endpoint: Archive/Unarchive project
- [ ] Endpoint: Project settings (team, timeline, budget)
- [ ] Frontend: Project creation wizard
- [ ] Frontend: Project settings panel
- [ ] Testy jednostkowe i integracyjne

#### FLOW-INITIATIVE-001: Initiative Management

**Priority:** P0 | **Est:** 20h

**Tasks:**

- [ ] Analiza istniejącego kodu `initiatives.routes.ts`
- [ ] Dokumentacja flow w `docs/flows/core/INITIATIVE_MANAGEMENT_FLOW.md`
- [ ] Implementacja status machine (DRAFT → DONE + BLOCKED, CANCELLED, ARCHIVED)
- [ ] Endpoint: Create initiative from assessment
- [ ] Endpoint: Move initiative between projects
- [ ] Endpoint: Status transitions z walidacją
- [ ] Completion checker przed REVIEW
- [ ] Frontend: Initiative board (Kanban)
- [ ] Frontend: Initiative detail view
- [ ] Testy jednostkowe i integracyjne

#### FLOW-TASK-001: Task Management

**Priority:** P0 | **Est:** 12h

**Tasks:**

- [ ] Analiza istniejącego kodu `tasks.routes.ts`
- [ ] Dokumentacja flow w `docs/flows/core/TASK_MANAGEMENT_FLOW.md`
- [ ] Endpoint: Move task between initiatives
- [ ] Endpoint: Task assignment with notifications
- [ ] Endpoint: Task dependencies
- [ ] Frontend: Task list w initiative
- [ ] Frontend: Task detail modal
- [ ] Integracja z MyWork
- [ ] Testy

### Week 3-4

#### FLOW-DECISION-001: Decision Request & Approval

**Priority:** P0 | **Est:** 20h

**Tasks:**

- [ ] Dokumentacja flow w `docs/flows/core/DECISION_SYSTEM_FLOW.md`
- [ ] Database schema: `decisions`, `decision_options`, `decision_votes`
- [ ] Endpoint: Create decision request
- [ ] Endpoint: Add options to decision
- [ ] Endpoint: Make decision (approve/reject/defer)
- [ ] Endpoint: Get pending decisions
- [ ] Notification service: Decision request notifications
- [ ] Escalation service: Auto-escalate after deadline
- [ ] Frontend: Decision request form
- [ ] Frontend: Decision inbox w MyWork
- [ ] Frontend: Decision detail modal
- [ ] AI: Wykrywanie blokad i sugestia decyzji
- [ ] Testy

#### FLOW-PMO-001: PMO Decisions & Gates

**Priority:** P0 | **Est:** 16h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Database: `stage_gates`, `gate_reviews`
- [ ] PMO Standards mapping service
- [ ] Endpoint: Configure PMO standard per project
- [ ] Endpoint: Stage gate creation
- [ ] Endpoint: Gate review workflow
- [ ] Frontend: Gate configuration
- [ ] Frontend: Gate review panel
- [ ] Testy

#### Existing FLOW-ASSESSMENT-001: Gap fixes

**Priority:** P0 | **Est:** 16h

**Tasks:**

- [ ] GAP-ASSESSMENT-001: AI analysis timeout handling (streaming/job queue)
- [ ] GAP-ASSESSMENT-002: Auto-save polish (toast, resume modal)
- [ ] GAP-ASSESSMENT-003: PDF generation improvements
- [ ] GAP-ASSESSMENT-004: Progress notifications

---

## Sprint 2: Core Completion (P0/P1)

**Goal:** Dokończenie core + AI Chat

### Week 5-6

#### FLOW-AIASSISTANT-001: AI Chat & Conversations

**Priority:** P0 | **Est:** 24h

**Tasks:**

- [ ] Dokumentacja flow w `docs/flows/ai/AI_CHAT_FLOW.md`
- [ ] Analiza istniejącego `conversations.routes.ts`
- [ ] Context building service (org context, project context)
- [ ] Conversation state machine
- [ ] Endpoint: Start conversation with context
- [ ] Endpoint: Send message with streaming response
- [ ] Endpoint: Conversation history
- [ ] AI: Proaktywne sugestie w rozmowie
- [ ] AI: Tool calling (create task, search KB)
- [ ] Frontend: Chat panel improvements
- [ ] Frontend: Context selector (project/initiative)
- [ ] Testy

#### FLOW-ROADMAP-001: Roadmap Management

**Priority:** P1 | **Est:** 8h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Endpoint: Get roadmap view (Q1-Q8 timeline)
- [ ] Endpoint: Move initiative on timeline
- [ ] Frontend: Roadmap view (Gantt-like)
- [ ] Drag & drop initiatives
- [ ] Testy

#### FLOW-MYWORK-001: MyWork Dashboard

**Priority:** P1 | **Est:** 12h

**Tasks:**

- [ ] Dokumentacja flow w `docs/flows/core/MYWORK_FLOW.md`
- [ ] Endpoint: Get my tasks (aggregated)
- [ ] Endpoint: Get my decisions (to make + waiting)
- [ ] Endpoint: Get my initiatives
- [ ] Endpoint: Get AI suggestions
- [ ] Frontend: MyWork dashboard layout
- [ ] Mobile responsive optimization
- [ ] Testy

### Week 7-8

#### FLOW-MEDIAINGEST-001: PDF → Roadmap

**Priority:** P1 | **Est:** 16h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] PDF parsing service (extract text, tables, structure)
- [ ] AI: Analyze PDF and extract initiatives
- [ ] Endpoint: Upload external audit PDF
- [ ] Endpoint: Get extracted initiatives (draft)
- [ ] Endpoint: Confirm and create initiatives
- [ ] Frontend: PDF upload wizard
- [ ] Frontend: Review extracted initiatives
- [ ] Testy

#### FLOW-CONSULTANT-001: Consultant Access

**Priority:** P1 | **Est:** 8h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Endpoint: Invite consultant to project
- [ ] Endpoint: Accept consultant invitation
- [ ] Permission service: Consultant scoping
- [ ] Usage tracking: Attribute tokens to client
- [ ] Frontend: Consultant invitation flow
- [ ] Testy

#### FLOW-PASSWORDRESET-001: Password Reset

**Priority:** P1 | **Est:** 4h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Endpoint: Request password reset
- [ ] Endpoint: Verify reset token
- [ ] Endpoint: Set new password
- [ ] Email template: Password reset
- [ ] Frontend: Password reset pages
- [ ] Testy

---

## Sprint 3: AI & Intelligence (P1)

**Goal:** AI Memory, Actions, Instructions

### Week 9-10

#### FLOW-AIMEMORY-001: AI Memory & Learning

**Priority:** P1 | **Est:** 20h

**Tasks:**

- [ ] Dokumentacja flow w `docs/flows/ai/AI_MEMORY_FLOW.md`
- [ ] Database: `ai_user_memory`, `ai_org_memory`, `ai_system_memory`
- [ ] Memory service: Store/retrieve context
- [ ] Memory service: Summarize old memories
- [ ] Memory service: Relevance scoring
- [ ] Endpoint: Get memories for context
- [ ] AI: Memory-aware responses
- [ ] Frontend: Memory management (admin)
- [ ] Testy

#### FLOW-AIINSTRUCTIONS-001: AI Instructions Database

**Priority:** P1 | **Est:** 12h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Database: `ai_instructions_system`, `ai_instructions_org`
- [ ] Instruction service: Hierarchy (system → org → user)
- [ ] Endpoint: CRUD instructions (SuperAdmin)
- [ ] Endpoint: CRUD org instructions (Admin)
- [ ] Frontend: Instruction editor (SuperAdmin)
- [ ] Frontend: Org instruction settings
- [ ] Testy

#### FLOW-AIACTIONS-001: AI Actions & Tools

**Priority:** P1 | **Est:** 16h

**Tasks:**

- [ ] Dokumentacja flow w `docs/flows/ai/AI_ACTIONS_FLOW.md`
- [ ] Tool registry service
- [ ] Available tools: create_task, assign_person, change_status, send_reminder, create_decision
- [ ] Permission checking per action
- [ ] Undo service for AI actions
- [ ] Audit log for AI actions
- [ ] Frontend: AI action confirmation modal
- [ ] Frontend: AI action history
- [ ] Testy

### Week 11-12

#### FLOW-AIREPORTS-001: AI Report Generation

**Priority:** P1 | **Est:** 16h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Report template service
- [ ] AI: Generate report content from data
- [ ] AI: Executive summary generation
- [ ] Endpoint: Generate report
- [ ] Endpoint: Export report (PDF)
- [ ] Frontend: Report preview
- [ ] Frontend: Report template editor
- [ ] Testy

#### FLOW-AIFEEDBACK-001: AI Feedback Loop

**Priority:** P1 | **Est:** 8h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Database: `ai_feedback`
- [ ] Endpoint: Submit feedback (like/dislike/correction)
- [ ] Feedback aggregation service
- [ ] SuperAdmin: Feedback review dashboard
- [ ] Learning integration
- [ ] Testy

#### FLOW-DECISION-002 & 003: Decision Escalation & Analytics

**Priority:** P1 | **Est:** 20h

**Tasks:**

- [ ] Auto-escalation cron job
- [ ] Escalation notification service
- [ ] Decision analytics service
- [ ] AI: Learn from decision patterns
- [ ] AI: Predict decision duration
- [ ] Dashboard: Decision analytics
- [ ] Testy

---

## Sprint 4: Platform Features (P1/P2)

**Goal:** Raporty, Onboarding, Help

### Week 13-14

#### FLOW-REPORTGEN-001: Report Generator

**Priority:** P1 | **Est:** 16h

**Tasks:**

- [ ] Template CRUD service
- [ ] Data source connectors
- [ ] Report builder UI
- [ ] Scheduling service
- [ ] Export service (PDF, Excel - basic)
- [ ] Public link sharing
- [ ] Testy

#### FLOW-ONBOARDING-001: User Onboarding UX

**Priority:** P1 | **Est:** 16h

**Tasks:**

- [ ] Dokumentacja flow w `docs/flows/platform/ONBOARDING_FLOW.md`
- [ ] Signup wizard (steps 1-4)
- [ ] AI greeting implementation
- [ ] Path selection (Assessment/Demo/Sandbox)
- [ ] Persistent checklist sidebar
- [ ] Progress tracking
- [ ] Gamification (progress bar, celebrations)
- [ ] Testy

#### FLOW-AUDIT-001: Audit Log

**Priority:** P1 | **Est:** 8h

**Tasks:**

- [ ] Audit log middleware (all mutations)
- [ ] Endpoint: Query audit log (filters, pagination)
- [ ] Frontend: Audit log viewer (SuperAdmin/Admin)
- [ ] Export to CSV
- [ ] Retention policy (7 years)
- [ ] Testy

### Week 15-16

#### FLOW-GDPR-001: GDPR / Data Requests

**Priority:** P1 | **Est:** 12h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Endpoint: Request data export
- [ ] Endpoint: Request data deletion
- [ ] Data export service (generate ZIP)
- [ ] Data deletion service (cascade)
- [ ] Email notifications
- [ ] Frontend: Privacy settings
- [ ] Testy

#### FLOW-DOCUMENTS-001: Document Management

**Priority:** P1 | **Est:** 12h

**Tasks:**

- [ ] File upload service improvements
- [ ] Version control for documents
- [ ] Endpoint: Upload/download/delete files
- [ ] Endpoint: File versions
- [ ] Storage quota tracking
- [ ] Frontend: Document browser
- [ ] Testy

#### FLOW-DATAIMPORT-001: Self-service Data Import

**Priority:** P1 | **Est:** 8h

**Tasks:**

- [ ] CSV import service
- [ ] Excel import service
- [ ] Field mapping UI
- [ ] Validation and preview
- [ ] Import progress tracking
- [ ] Testy

---

## Sprint 5: Enterprise & Polish (P1/P2)

**Goal:** SSO, MFA, Tools Assessment

### Week 17-18

#### FLOW-SSO-001: SSO (SAML/OIDC)

**Priority:** P1 | **Est:** 16h

**Tasks:**

- [ ] SAML service completion
- [ ] OIDC service completion
- [ ] Endpoint: SSO configuration
- [ ] Endpoint: SSO login
- [ ] Frontend: SSO setup wizard
- [ ] Testing with various IdPs
- [ ] Testy

#### FLOW-MFA-001: Multi-Factor Auth

**Priority:** P1 | **Est:** 12h

**Tasks:**

- [ ] TOTP service
- [ ] SMS service (existing)
- [ ] WebAuthn service (existing)
- [ ] Endpoint: Enable/disable MFA
- [ ] Endpoint: Verify MFA
- [ ] Frontend: MFA setup
- [ ] Recovery codes
- [ ] Testy

#### FLOW-TOOL-SIRI, ADMA, DRD, LEAN: Assessment Tools

**Priority:** P1 | **Est:** 32h (8h each)

**Tasks:**

- [ ] SIRI: Review and polish implementation
- [ ] ADMA: Review and polish implementation
- [ ] DRD: Review and polish implementation
- [ ] Lean 4.0: Review and polish implementation
- [ ] License tracking integration
- [ ] AI assistance improvements
- [ ] Report generation improvements
- [ ] Testy

### Week 19-20

#### FLOW-STUDIO-001: Context Builder / Studio

**Priority:** P1 | **Est:** 24h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Analyze existing Studio code
- [ ] Context modules implementation
- [ ] AI synthesis service
- [ ] Frontend: Studio workspace
- [ ] Export to initiatives
- [ ] Testy

#### Gap fixes from analyzed flows

**Priority:** P1 | **Est:** 20h

**Tasks:**

- [ ] FLOW-TEAM-001 gaps (4)
- [ ] FLOW-NOTIFICATION-001 gaps (4)
- [ ] FLOW-CUSTOMER-001 gaps (4)
- [ ] FLOW-INTEGRATION-001 gaps (3)

---

## Sprint 6: Tools & Integrations (P2/P3)

**Goal:** Pozostałe narzędzia i integracje

### Week 21-22

#### FLOW-TOOL-PROCESSFLOW: Process Flow Automation

**Priority:** P2 | **Est:** 24h

**Tasks:**

- [ ] Dokumentacja flow
- [ ] Process flow editor (drag & drop)
- [ ] Decision vs Action marking
- [ ] Measurement input
- [ ] Optimization suggestions
- [ ] Tool recommendations
- [ ] ROI calculation
- [ ] Transfer to initiative
- [ ] Testy

#### FLOW-TOOL-A3PDCA: A3 + PDCA

**Priority:** P2 | **Est:** 12h

**Tasks:**

- [ ] A3 template implementation
- [ ] PDCA cycle tracking
- [ ] AI assistance
- [ ] Export options
- [ ] Testy

#### FLOW-SLACK-001 & FLOW-TEAMS-001: Chat Integrations

**Priority:** P3 | **Est:** 24h

**Tasks:**

- [ ] Slack app setup
- [ ] Teams app setup
- [ ] Notification service integration
- [ ] AI chat in Slack/Teams
- [ ] Testy

### Week 23-24

#### Remaining P2/P3 flows

**Priority:** P2/P3 | **Est:** ~80h

- [ ] FLOW-PORTFOLIO-001: Portfolio Management
- [ ] FLOW-KPI-001: KPI & OKR Tracking
- [ ] FLOW-BENEFITS-001: Benefits Realization
- [ ] FLOW-RAG-001: Knowledge RAG
- [ ] FLOW-VOTING-001: Committee Voting
- [ ] FLOW-TRIAL-001: Trial & Demo Mode
- [ ] FLOW-DUNNING-001: Dunning & Recovery
- [ ] FLOW-SCIM-001: SCIM Provisioning
- [ ] FLOW-DASHBOARD-001: Dashboard Builder
- [ ] FLOW-SHARING-001: Report Sharing
- [ ] FLOW-EXECUTIVE-001: Executive Reporting
- [ ] FLOW-BRANDING-001: White-label Branding

---

## Quality Gates

### Per Sprint

- [ ] All unit tests passing
- [ ] Integration tests for new endpoints
- [ ] Documentation updated
- [ ] No new linter errors
- [ ] Code review completed
- [ ] Demo to stakeholder

### Per Flow

- [ ] Flow documentation in `docs/flows/`
- [ ] API endpoints documented in Swagger/OpenAPI
- [ ] Frontend components documented
- [ ] Test coverage > 70%

---

## Risk Mitigation

| Risk                  | Mitigation                                   |
| --------------------- | -------------------------------------------- |
| AI complexity         | Start with simple AI actions, iterate        |
| PMO standards mapping | Abstract design, add standards incrementally |
| Tool licensing        | Parallel negotiation track                   |
| Mobile responsiveness | Test continuously, not at end                |
| Performance           | Monitor from Sprint 1, optimize early        |

---

## Success Metrics

| Metric                   | Target |
| ------------------------ | ------ |
| All P0 flows implemented | 100%   |
| All P1 flows implemented | 100%   |
| Test coverage            | > 70%  |
| Zero critical bugs       | 0      |
| Documentation complete   | 100%   |
| User onboarding < 5 min  | Yes    |

---

## Next Steps

1. **Immediate:** Run database migrations from previous session
2. **Sprint 1 Kickoff:** Start with FLOW-PROJECT-001 analysis
3. **Daily:** Update task status in this document
4. **Weekly:** Sprint review and planning

---

## Related Documentation

- **System Specification:** `docs/SYSTEM_SPECIFICATION.md`
- **Flow Registry:** `docs/flows/MASTER_FLOW_REGISTRY.md`
- **Individual Flows:** `docs/flows/{category}/`

---

## Changelog

| Version | Date       | Changes                                             |
| ------- | ---------- | --------------------------------------------------- |
| 1.0     | 2026-01-11 | Initial implementation plan after Discovery Session |
