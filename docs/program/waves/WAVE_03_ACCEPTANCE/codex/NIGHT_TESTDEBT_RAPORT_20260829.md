# NIGHT TESTDEBT — raport ciągły 2026-08-29

Marker: `fc20525ba8212e7b44f956a99b9345c25e436e7d`
Gałąź: `codex/night-testdebt-20260829`
Środowisko: wyłącznie lokalny PostgreSQL `127.0.0.1:5945/consultify_night`
Retry: `--retry=0`

## Faza 0 — punkt odniesienia

Zmierzono marker przed jakąkolwiek zmianą kodu.

- K1, produkcyjna kompilacja serwera przez `server/tsconfig.build.json`: **PASS, exit 0**.
- K2, produkcyjny build frontendu z limitem 6144 MB: **PASS, exit 0**.
- ESLint `--quiet`: **48 539 błędów**, 0 ostrzeżeń; 48 526 potencjalnie naprawialnych automatycznie.
- Unit: 1726 plików; 17233 PASS, 17 FAIL, 26 SKIP, 11 TODO.
- Integration: 791 plików; 4509 PASS, 682 FAIL, 570 SKIP; 6 błędów procesu.
- Acceptance: 139 plików; 956 PASS, 42 FAIL, 112 SKIP; 1 błąd procesu.
- Components: 720 plików; 3604 PASS, 165 FAIL, 2 SKIP; 2 błędy procesu.

Pierwsze wywołanie katalogu acceptance bez dedykowanego configu zwróciło
`No test files found`; zostało odrzucone jako nieważny pomiar. Wiążący wynik
pochodzi z `vitest.acceptance.config.ts`.

### Pełne nazwy czerwonych pozycji — unit

- tests/unit/backend/routes/settings-personal-endpoints-superadmin.test.ts > does NOT weaken org isolation: POST /notifications (acting on ANOTHER user) still enforces active membership (TRI-MUST-01) > rejects a SUPERADMIN with no organizationId claim at all (identity unverifiable, blocked before the handler)
- tests/unit/backend/routes/settings-personal-endpoints-superadmin.test.ts > settings.routes.ts personal endpoints admit a membership-less SUPERADMIN (TRI-MUST-01) > PUT /preferences/appearance succeeds for a SUPERADMIN with no organization_members row
- tests/unit/backend/routes/settings-personal-endpoints-superadmin.test.ts > settings.routes.ts personal endpoints admit a membership-less SUPERADMIN (TRI-MUST-01) > PUT /preferences/notifications succeeds for a SUPERADMIN with no organization_members row
- tests/unit/migrationRunnerOrdering.test.ts > GATE I1 — kolejność producent → konsument > producent jest JEDYNY — żadna inna migracja nie tworzy tej tabeli
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > SIGINT and SIGTERM serialize owned cleanup, persist proof, and preserve protected ports
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > adopted SIGINT and SIGTERM terminate owned stages but preserve marker, sentinel and catalog
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > adopted start failure preserves the existing DB and fixture rows
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > adopted stop fails closed when the bound DB is missing
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > adopted stop preserves DB and refuses fixture-state mismatch before signal
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > binds the Audits prefix to the exact FINAL Audits fixture family
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > binds the Execution prefix to the exact FINAL Execution fixture family
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > binds the Finance prefix to the exact FINAL Finance fixture family
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > binds the Settings prefix to the exact FINAL Settings fixture family
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > executable PGID tamper refuses signal and DB drop, then exact restored state cleans safely
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > executable migration/server/client/readiness failures leave no DB, PID, PGID or listener and preserve protected ports
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > signals during DB ownership and a failing DB stage still await shared cleanup
- tests/unit/scripts/wave3OwnerRuntimeGuard.test.ts > Wave3 owner runtime guards > staged after-db failure cleans the created database

### Pełne nazwy czerwonych pozycji — integration

- tests/integration/admin/admin-cross-org-idor.test.ts > M24 L-03 Story 1.2 — role escalation prevention in adminP32 > POST /people without targetUserId or email returns 400 (validation guard)
- tests/integration/admin/adminBackup.restore.realdb.test.ts > ADM-MVP-BACKUP-001 encrypted tenant backup and isolated restore
- tests/integration/admin/adminP32-cross-org-idor.test.ts > M24 follow-up Story A — cross-org IDOR on adminP32 routes (getAdminActor choke point) > GET /iam/policy?orgId=org-alpha (own org) passes the boundary guard for caller in org-alpha
- tests/integration/admin/adminP32-cross-org-idor.test.ts > M24 follow-up Story A — cross-org IDOR on adminP32 routes (getAdminActor choke point) > super_admin bypasses the org boundary (GET /iam/policy for org-beta, by design)
- tests/integration/admin/adminP32-cross-org-idor.test.ts > M24 follow-up Story B — health-panel routes ignore spoofed org selectors > GET /probes ignores a spoofed ?organizationId=org-beta query param — uses caller org-alpha
- tests/integration/admin/adminP32-cross-org-idor.test.ts > M24 follow-up Story B — health-panel routes ignore spoofed org selectors > GET /summary ignores a spoofed body.organizationId=org-beta — uses caller org-alpha
- tests/integration/admin/adminP32-cross-org-idor.test.ts > M24 follow-up Story C — scim_group_mappings must stay org-scoped > C1 regression guard: GET /identity/scim never surfaces another org’s group mappings (readScimSummary() must query scim_group_mappings WITH WHERE organization_id — was a live cross-org leak until 2026-07-14)
- tests/integration/admin/adminP32-cross-org-idor.test.ts > M24 follow-up Story C — scim_group_mappings must stay org-scoped > C2 regression guard: DELETE /identity/scim/group-mappings/:id must bind the actor’s organization_id (deleteScimGroupMapping() — was an unscoped cross-org IDOR delete until 2026-07-14)
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story A — /api/admin/sso-self is org-scoped (cross-org IDOR) > GET /sso-self (own org, no orgId spoof) passes the boundary guard
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story B — writes are pinned to the caller organization_id in SQL > GET /sso-self reads sso_configurations scoped to the caller org, never a spoofed one
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story B — writes are pinned to the caller organization_id in SQL > PUT /sso-self INSERTs a new row bound to the caller org_id, ignoring any body organizationId
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story B — writes are pinned to the caller organization_id in SQL > PUT /sso-self UPDATEs the existing row WHERE organization_id = caller org (not the spoofed one)
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story C — half-configured SSO cannot be enabled > POST /sso-self/validate reports missing fields without requiring isEnabled in the body
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story C — half-configured SSO cannot be enabled > POST /sso-self/validate reports valid:true for a complete OIDC config
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story C — half-configured SSO cannot be enabled > rejects a non-https SAML SSO URL
- tests/integration/admin/adminSsoSelf.routes.test.ts > HP-24 Story C — half-configured SSO cannot be enabled > rejects enabling SAML with no certificate (400 VALIDATION_ERROR)
- tests/integration/admin/dataDrLifecycle.realdb.test.ts > DATA-DR durable lifecycle and compensation
- tests/integration/ai-enterprise-verification.test.ts > Admin session service (enterprise verification path) - REAL_CODE > getActiveSessions queries all active sessions (optionally filtered by adminId)
- tests/integration/ai-enterprise-verification.test.ts > Admin session service (enterprise verification path) - REAL_CODE > getSessionStats returns scalar row
- tests/integration/ai-modules-navigation.test.ts > SuperAdminSidebar AI mappings > legacy AI sections map to unified AI Platform view
- tests/integration/ai/ai-attachments-ingest-typegate.test.ts > AI attachments ingest — fileFilter type gate (M01/L-03 · S3) > accepts whitelisted type application/json and ingests it
- tests/integration/ai/ai-attachments-ingest-typegate.test.ts > AI attachments ingest — fileFilter type gate (M01/L-03 · S3) > accepts whitelisted type text/csv and ingests it
- tests/integration/ai/ai-attachments-ingest-typegate.test.ts > AI attachments ingest — fileFilter type gate (M01/L-03 · S3) > accepts whitelisted type text/markdown and ingests it
- tests/integration/ai/ai-attachments-ingest-typegate.test.ts > AI attachments ingest — fileFilter type gate (M01/L-03 · S3) > rejects disallowed type application/octet-stream before any persistence (fails closed)
- tests/integration/ai/ai-attachments-ingest-typegate.test.ts > AI attachments ingest — fileFilter type gate (M01/L-03 · S3) > rejects disallowed type application/zip before any persistence (fails closed)
- tests/integration/ai/ai-attachments-ingest-typegate.test.ts > AI attachments ingest — fileFilter type gate (M01/L-03 · S3) > rejects disallowed type image/png before any persistence (fails closed)
- tests/integration/ai/ai-attachments-ingest.test.ts > AI attachments ingest (REAL integration) > extracts DOCX attachments through the document parser
- tests/integration/ai/ai-attachments-ingest.test.ts > AI attachments ingest (REAL integration) > ingests a text file and returns docId + chunkCount
- tests/integration/ai/ai-attachments-ingest.test.ts > AI attachments ingest (REAL integration) > returns 400 when file is missing
- tests/integration/ai/ai-attachments-ingest.test.ts > AI attachments ingest (REAL integration) > returns a concrete extraction status for unreadable PDFs
- tests/integration/ai/ai-chat-confirm-stream.validation.test.ts > AI routes: chat validation (REAL integration) > POST /api/ai/chat/stream requires message
- tests/integration/ai/aiPlaybooks.runs.no-demo.test.ts > AI playbooks runs (no demo placeholders) > GET /api/ai/playbooks/runs does not return demo runs (503 when schema missing)
- tests/integration/api.test.ts > API Integration > GET /health should return 200 OK
- tests/integration/apiFullFlow.test.js > API Full Flow Integration > User Registration Flow > should complete user registration flow
- tests/integration/auth.test.js > Auth Integration > Login > should login with valid credentials
- tests/integration/auth.test.ts > Auth Integration > Login Flow > should login successfully with valid credentials
- tests/integration/auth.test.ts > Auth Integration > Multi-Tenant Isolation > should return correct organizationId based on token
- tests/integration/auth.test.ts > Auth Integration > Token Validation via /me > should validate token and return user profile
- tests/integration/auth/auth-endpoints.test.ts > Auth Endpoints Integration > POST /api/auth/refresh > returns deterministic token in E2E_MODE
- tests/integration/auth/auth-me-e2e-mode.test.ts > Auth routes: /me (E2E_MODE) > uses the DB-backed read model for a normally signed user in E2E_MODE
- tests/integration/auth/auth-refresh-e2e-mode.test.ts > Auth routes: /refresh (E2E_MODE) > POST /api/auth/refresh returns deterministic token
- tests/integration/auth/auth-routes-validation.test.ts > Auth routes (REAL integration) > POST /api/auth/login (validation only) > returns 400 when email is missing
- tests/integration/auth/auth-routes-validation.test.ts > Auth routes (REAL integration) > POST /api/auth/refresh (E2E_MODE deterministic) > accepts refresh token from cookie when body is absent
- tests/integration/case-workspace-fresh-install-migration-order.realdb.test.ts > Case Workspace fresh-install migration ordering (real Postgres, real migration files) > FRESH APPLY (real Postgres, real files, isolated fixture dir): all 11 apply with zero failures, case_core before every dependent
- tests/integration/chat/streaming.test.ts > Chat Streaming Integration > POST /api/ai/chat > should handle non-streaming chat request
- tests/integration/chat/streaming.test.ts > Chat Streaming Integration > POST /api/ai/chat/stream > should handle streaming chat request
- tests/integration/chat/streaming.test.ts > Chat Streaming Integration > POST /api/ai/chat/stream > should set correct content type for streaming
- tests/integration/clients/client-endpoints.test.ts > Clients endpoints (partners routes) - REAL integration > GET /clients returns a real partner-scoped list
- tests/integration/clients/client-endpoints.test.ts > Clients endpoints (partners routes) - REAL integration > GET /employees returns a real partner-scoped employee roster
- tests/integration/clients/client-endpoints.test.ts > Clients endpoints (partners routes) - REAL integration > POST /clients remains unavailable until broader client-access writes land
- tests/integration/closure-evidence/authorization-matrix.realdb.test.ts [ tests/integration/closure-evidence/authorization-matrix.realdb.test.ts ]
- tests/integration/closure-evidence/governed-artifact-evidence.realdb.test.ts [ tests/integration/closure-evidence/governed-artifact-evidence.realdb.test.ts ]
- tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts > Meeting/Notebook → Initiative closure evidence (real Postgres, mounted signed auth) > 6d. the test-only cleanup cannot be aimed at a real database > deletes nothing when handed an empty scope — empty means nothing, not everything
- tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts > Meeting/Notebook → Initiative closure evidence (real Postgres, mounted signed auth) > 6d. the test-only cleanup cannot be aimed at a real database > leaves the production guard enabled after it is done
- tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts > Meeting/Notebook → Initiative closure evidence (real Postgres, mounted signed auth) > 6d. the test-only cleanup cannot be aimed at a real database > refuses a database whose name is not disposable, before running any statement
- tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts > Meeting/Notebook → Initiative closure evidence (real Postgres, mounted signed auth) > 6d. the test-only cleanup cannot be aimed at a real database > rolls trigger suspension back after a forced cleanup failure
- tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts [ tests/integration/closure-evidence/meeting-notebook-evidence.realdb.test.ts ]
- tests/integration/closure-evidence/tool-output-producer-flow.realdb.test.ts [ tests/integration/closure-evidence/tool-output-producer-flow.realdb.test.ts ]
- tests/integration/comments/comment-endpoints.test.ts > Report comments routes (stub) - REAL integration > returns 501 Not implemented for any request
- tests/integration/crossflow/cf-00-closure-receipt-roi-binding.realdb.test.ts > FLOW-TRANSFORM closure receipt -> ROI case durable binding
- tests/integration/crossflow/cf-00-full-transformation-lineage.realdb.test.ts [ tests/integration/crossflow/cf-00-full-transformation-lineage.realdb.test.ts ]
- tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts > CF-04 Tools/SWOT governance on real Postgres with a real signed JWT > B. the freeze → approval → promotion sequence > B1: a DRAFT SWOT is always refused before Candidate or receipt creation
- tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts > CF-04 Tools/SWOT governance on real Postgres with a real signed JWT > B. the freeze → approval → promotion sequence > B2: REVIEW and null statuses remain fail-closed
- tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts > CF-04 Tools/SWOT governance on real Postgres with a real signed JWT > B. the freeze → approval → promotion sequence > B3: an APPROVED session passes without any environment switch
- tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts > CF-04 Tools/SWOT governance on real Postgres with a real signed JWT > C. tenancy — denial must not leak existence > C1: tenant B asking for tenant A’s session and for a nonexistent id get the SAME status
- tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts > CF-04 Tools/SWOT governance on real Postgres with a real signed JWT > D. idempotency and concurrency with an exact denominator > D1: the same recommendation handed off twice yields exactly one candidate
- tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts > CF-04 Tools/SWOT governance on real Postgres with a real signed JWT > D. idempotency and concurrency with an exact denominator > D2: 8 concurrent handoffs of one recommendation yield exactly one candidate
- tests/integration/crossflow/cf-04-tools-swot-governance.realdb.test.ts > CF-04 Tools/SWOT governance on real Postgres with a real signed JWT > E. the governed chain cannot start from an unapproved SWOT > E1: DRAFT SWOT creates neither Candidate nor Initiative
- tests/integration/day17-results-kpi.realdb.test.ts > Day 17 K.2/K.3 repositories — real PostgreSQL > K.2 pages five kinds without duplicates
- tests/integration/deliverables/deckGeneratorE2E.test.ts > B1 deck generator E2E — 30 scenariuszy przez planDeckLayout > post-processing B1 nie degraduje żadnego z 30 dobrych planów
- tests/integration/deliverables/docContentGenE2E.test.ts > Doc content-gen E2E — łańcuch B3→content-gen→pełne scoring > 30 doc-scenariuszy: B3→content-gen→pełne kryteria (struktura + treść)
- tests/integration/deliverables/templateApi.test.ts > GET /api/deliverables/templates > passes correct orgId to service (org-scope isolation)
- tests/integration/deliverables/templateApi.test.ts > GET /api/deliverables/templates > returns deck templates for type=deck
- tests/integration/deliverables/templateApi.test.ts > GET /api/deliverables/templates > returns doc templates for type=doc
- tests/integration/deliverables/templateApi.test.ts > GET /api/deliverables/templates > returns table templates for type=table
- tests/integration/deliverables/templateCrud.integration.test.ts > CRUD /api/deliverables/templates (T3) > DELETE /templates/:id returns 204 on success
- tests/integration/deliverables/templateCrud.integration.test.ts > CRUD /api/deliverables/templates (T3) > PUT /templates/:id returns 200 with updated template
- tests/integration/deliverables/templateSeeds.integration.test.ts > GET /api/deliverables/templates — DBR77 seed integration (FT-2) > returns ≥1 system deck template after seed (type=deck)
- tests/integration/deliverables/templateSeeds.integration.test.ts > GET /api/deliverables/templates — DBR77 seed integration (FT-2) > returns ≥1 system doc template after seed (type=doc)
- tests/integration/demoPublicEntry.contract.test.ts > OPS-DEMO-002 public demo entry contract > register-demo — success contract > allows authenticated reads in the server-verified session tenant without a membership row
- tests/integration/document-studio/export-qa-gate.routes.test.ts > M18 · GET /:artifactId/export/:format — QA gate at the route (L-03) > anti-false-green: non-blocking QA exports cleanly → 200 (gate is the cause of 403)
- tests/integration/document-studio/export-qa-gate.routes.test.ts > M18 · GET /:artifactId/export/:format — QA gate at the route (L-03) > blocking QA without override → 403 { error: "qa_blocking" } + report
- tests/integration/document-studio/export-qa-gate.routes.test.ts > M18 · GET /:artifactId/export/:format — QA gate at the route (L-03) > override by AUTHORIZED role (admin) bypasses the blocking gate → 200
- tests/integration/document-studio/export-qa-gate.routes.test.ts > M18 · GET /:artifactId/export/:format — QA gate at the route (L-03) > override by UNAUTHORIZED role → 403 qa_override_unauthorized + audit qa_override_denied
- tests/integration/errorHandling.test.js > Error Handling & Resilience > API Error Responses > should handle malformed JSON gracefully
- tests/integration/errorHandling.test.js > Error Handling & Resilience > API Error Responses > should handle missing required fields
- tests/integration/errorHandling.test.js > Error Handling & Resilience > API Error Responses > should return 400 for invalid request body
- tests/integration/errorHandling.test.js > Error Handling & Resilience > API Error Responses > should return 401 for unauthenticated requests
- tests/integration/errorHandling.test.js > Error Handling & Resilience > API Error Responses > should return 404 for non-existent routes
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Async Error Handling > should handle async route errors without crashing
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Database Error Handling > should return proper error format for database constraint violations
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Error Logging > should log errors without exposing sensitive data
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Error Response Format > should include error code in response
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Error Response Format > should include timestamp in error response
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Error Response Format > should return consistent error format
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Server Resilience > should handle concurrent error requests
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Server Resilience > should not crash on invalid input
- tests/integration/errorHandling.test.js > Error Handling & Resilience > Server Resilience > should recover from errors and continue serving requests
- tests/integration/exe009-closure-delivery-receipt.realdb.test.ts > EXE-09 closure delivery receipt (real Postgres)
- tests/integration/execution-change-progress-spine.golden-flow.realdb.test.ts > EXE-005-006 — change + progress spine golden flow against a real Postgres database (no mocks) > idempotent retry: repeating the same change/decision CREATE POST with the same idempotencyKey does not duplicate
- tests/integration/flow-transform-drd-source-adapter.realdb.test.ts [ tests/integration/flow-transform-drd-source-adapter.realdb.test.ts ]
- tests/integration/flow-transform-four-source-lineage.realdb.test.ts [ tests/integration/flow-transform-four-source-lineage.realdb.test.ts ]
- tests/integration/flows/access-limit-integration.test.ts > L3: Access & Usage Limit Integration > Resource Limit Enforcement > should allow resource creation within plan limits
- tests/integration/flows/access-limit-integration.test.ts > L3: Access & Usage Limit Integration > Trial Lifecycle Flow > should respect upgraded trial limits
- tests/integration/flows/billing-payment-integration.test.ts > L3: Billing & Payment Flow Integration > Error Handling and Edge Cases > should handle concurrent payment attempts
- tests/integration/flows/billing-payment-integration.test.ts > L3: Billing & Payment Flow Integration > Error Handling and Edge Cases > should handle invalid payment method
- tests/integration/flows/billing-payment-integration.test.ts > L3: Billing & Payment Flow Integration > Error Handling and Edge Cases > should prevent duplicate payments
- tests/integration/flows/content-management-integration.test.ts > L3: Content Management Integration > Favorites and Personal Content Flow > should remove from favorites
- tests/integration/flows/external-integrations-integration.test.ts > L3: External Integrations Integration > Unlinking and Cleanup Flow > should remove external integration links
- tests/integration/flows/notification-flow-integration.test.ts > L3: Notification Flow Integration > Error Handling and Edge Cases > should handle invalid email address
- tests/integration/gate3-persistence-coldreopen.realdb.test.ts > GATE 3 — persistence: save / refresh / cold reopen / direct-SQL readback (real Postgres) > [feature: conversion mapping_version] save (convert) → refresh → cold reopen → direct-SQL readback
- tests/integration/gateways/ideaCollabWs.demoContext.test.ts > #101 Grupa 0 — ideaCollabWs demo org-context isolation > active demo session binds to the SESSION org: joining a session-org idea works
- tests/integration/gateways/ideaCollabWs.demoContext.test.ts > #101 Grupa 0 — ideaCollabWs demo org-context isolation > demo preference: writes are rejected with DEMO_READ_ONLY and not relayed
- tests/integration/gateways/ideaCollabWs.demoContext.test.ts > #101 Grupa 0 — ideaCollabWs demo org-context isolation > demo session started while WS open: stale real-org socket is closed on next write (4403)
- tests/integration/gateways/ideaCollabWs.demoContext.test.ts > #101 Grupa 0 — ideaCollabWs demo org-context isolation > no regression: same-org peers relay graph_patch and lock_node normally
- tests/integration/gateways/ideaCollabWs.orgscope.test.ts > M07 L-02 — ideaCollabWs org-scope gate > graph_patch relay (update_lanes / graph_snapshot) > does NOT echo a graph_patch back to its own sender
- tests/integration/gateways/ideaCollabWs.orgscope.test.ts > M07 L-02 — ideaCollabWs org-scope gate > graph_patch relay (update_lanes / graph_snapshot) > relays update_lanes and graph_snapshot 1:1 from A to B
- tests/integration/gateways/ideaCollabWs.orgscope.test.ts > M07 L-02 — ideaCollabWs org-scope gate > proceeds past the gate (not 401/403) when idea belongs to same org
- tests/integration/gateways/ideaCollabWs.orgscope.test.ts > M07 L-02 — ideaCollabWs org-scope gate > returns 403 when idea belongs to a different org (cross-org IDOR attempt)
- tests/integration/gateways/presentationCollabWs.presence.test.ts > P3.3 — presentationCollabWs presence gateway > broadcasts presence: two clients see each other, and left on disconnect
- tests/integration/gateways/presentationCollabWs.presence.test.ts > P3.3 — presentationCollabWs presence gateway > proceeds past the gate (101) when the deck belongs to the org
- tests/integration/gateways/presentationCollabWs.presence.test.ts > P3.3 — presentationCollabWs presence gateway > returns 403 when the deck is not in the org and there is no collaborator row
- tests/integration/help/help-analytics.routes.test.ts > Help analytics routes (stub is honest) > returns 501 for any request
- tests/integration/help/help-chat.routes.test.ts > Help chat routes (REAL integration) > POST /api/help/chat returns AI response and KB sources
- tests/integration/help/help-feedback.routes.test.ts > Help feedback routes (REAL integration) > GET /api/help/feedback returns recent feedback
- tests/integration/help/help-feedback.routes.test.ts > Help feedback routes (REAL integration) > POST /api/help/feedback creates feedback
- tests/integration/help/help-feedback.routes.test.ts > Help feedback routes (REAL integration) > POST /api/help/feedback validates message
- tests/integration/helpApi.test.ts > Help API routes - REAL integration > GET /articles returns empty list and echoes query
- tests/integration/helpApi.test.ts > Help API routes - REAL integration > GET /categories returns static list
- tests/integration/idempotency.test.js > Idempotency > State Verification > should maintain consistent state across retries
- tests/integration/initiatives-execution/day49.capacity-loop-baseline.realdb.test.ts > Day 49 A.1 capacity loop baseline through the real ApiGateway > cannot use foreign organization hints to write advisor output
- tests/integration/initiatives-execution/decideSourceProposal.realdb.test.ts > Source Proposal Decision PostgreSQL vertical > atomically applies and replays DEFER
- tests/integration/initiatives-execution/decideSourceProposal.realdb.test.ts > Source Proposal Decision PostgreSQL vertical > atomically applies and replays DISMISS
- tests/integration/initiatives-execution/decideSourceProposal.realdb.test.ts > Source Proposal Decision PostgreSQL vertical > atomically applies and replays EXTEND
- tests/integration/initiatives-execution/decideSourceProposal.realdb.test.ts > Source Proposal Decision PostgreSQL vertical > atomically applies and replays MERGE
- tests/integration/initiatives-execution/decideSourceProposal.realdb.test.ts > Source Proposal Decision PostgreSQL vertical > atomically applies and replays RETURN
- tests/integration/initiatives-execution/decideSourceProposal.realdb.test.ts > Source Proposal Decision PostgreSQL vertical > rejects changed content under the same idempotency key
- tests/integration/initiatives-execution/definitionDecision.realdb.test.ts > Definition Decision PostgreSQL vertical > rejects a request that names the requester as authority under standard policy
- tests/integration/initiatives-execution/definitionDecision.realdb.test.ts > Definition Decision PostgreSQL vertical > requests then approves Definition with one Decision and exact evidence snapshot
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > amends metadata with exact cold readback, CAS, replay, collision, auth and tenant isolation
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > applies a governed non-register disposition and replays it without duplicate evidence
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > blocks Definition on a newer source version and refreshes the exact snapshot idempotently
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > configures exactly the canonical card catalog and preserves an omitted optional card
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > creates one Definition remediation Task and Decision and projects the same IDs to My Work
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > executes the complete ACO source-to-approved-Definition vertical with reload evidence
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > fails closed for an actor without capability and creates no evidence rows
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > governed cancel rejects locked lifecycle and rolls back atomically when outbox fails
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > projects one pending Definition Decision to the named authority My Work and reads back approval
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > publishes and reads back one immutable canonical Initiative Card version
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > rejects ineligible owners before proposal or registration creates any canonical write
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > returns 201 then the same 200 read-back for an idempotent retry
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > returns a newly created Execution Decision on the immediate authoritative work read-back
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > returns sanitized 409 for changed content under the same request id
- tests/integration/initiatives-execution/initiativesExecutionRuntime.http.realdb.test.ts > Initiatives Execution runtime HTTP realDB > uses authenticated tenant context and does not disclose another tenant on reads
- tests/integration/initiatives-execution/registerInitiative.realdb.test.ts > Register Initiative PostgreSQL vertical > atomically registers one source-backed Initiative and replays timeout retry
- tests/integration/initiatives-execution/registerInitiative.realdb.test.ts > Register Initiative PostgreSQL vertical > keeps foreign-tenant registration independent without disclosing the first tenant
- tests/integration/initiatives-execution/registerInitiative.realdb.test.ts > Register Initiative PostgreSQL vertical > rejects a changed-payload retry without mutating the registered Initiative
- tests/integration/initiatives-execution/registerInitiative.realdb.test.ts > Register Initiative PostgreSQL vertical > reloads the same canonical Initiative by ID and source through a new DB pool
- tests/integration/initiatives-execution/registerInitiative.realdb.test.ts > Register Initiative PostgreSQL vertical > rolls back a competing Initiative for an already registered source
- tests/integration/initiatives-execution/submitSourceProposal.realdb.test.ts > Source Submit PostgreSQL vertical > conflicts on changed request payload and concurrent identity reuse
- tests/integration/initiatives-execution/submitSourceProposal.realdb.test.ts > Source Submit PostgreSQL vertical > keeps tenant identity independent
- tests/integration/initiatives-execution/submitSourceProposal.realdb.test.ts > Source Submit PostgreSQL vertical > persists source-owned Proposal, provenance, policy, audit/outbox/readback and replays once
- tests/integration/initiatives/decisions-crud.test.ts > M03 — GET /decisions getTableColumns guard (real controller) > decision_impacts present → COUNT subquery + org-scoped list (not empty)
- tests/integration/initiatives/gate-ai-soft-block.test.ts > M13/G5 — AI gate soft-block + override (real controller) > above threshold → proceeds with no soft-block + telemetry blocked:false
- tests/integration/initiatives/gate-ai-soft-block.test.ts > M13/G5 — AI gate soft-block + override (real controller) > below threshold WITH overrideReason → proceeds + telemetry overridden
- tests/integration/initiatives/gate-ai-soft-block.test.ts > M13/G5 — AI gate soft-block + override (real controller) > below threshold without overrideReason → 422 soft-block + telemetry blocked
- tests/integration/initiatives/gate-ai-soft-block.test.ts > M13/G5 — AI gate soft-block + override (real controller) > flag OFF → no AI check, no telemetry, transition proceeds
- tests/integration/initiatives/initiatives.ai-generation.unavailable.no-placeholders.test.ts > Initiatives AI generation (honest 503; no placeholder content) > POST /api/initiatives/generate-section returns 503 FEATURE_UNAVAILABLE when LLM is not usable
- tests/integration/initiatives/initiatives.ai-generation.unavailable.no-placeholders.test.ts > Initiatives AI generation (honest 503; no placeholder content) > POST /api/initiatives/suggest-sections returns 503 FEATURE_UNAVAILABLE when LLM is not usable
- tests/integration/initiatives/initiatives.generate-section.test.ts > Initiatives routes: POST /generate-section (REAL integration) > defaults language to en when missing
- tests/integration/initiatives/initiatives.generate-section.test.ts > Initiatives routes: POST /generate-section (REAL integration) > passes through explicit language
- tests/integration/initiatives/initiatives.generate-section.test.ts > Initiatives routes: POST /generate-section (REAL integration) > returns 400 when sectionKey is missing
- tests/integration/initiatives/initiatives.generate-section.test.ts > Initiatives routes: POST /generate-section (REAL integration) > returns 403 when organizationId is missing
- tests/integration/initiatives/initiatives.generate-section.test.ts > Initiatives routes: POST /generate-section (REAL integration) > returns 500 when generation throws
- tests/integration/initiatives/initiatives.readiness-analysis.test.ts > Initiatives routes: POST /readiness-analysis (REAL integration) > computes metrics and calls generation even when related tables queries throw
- tests/integration/initiatives/initiatives.readiness-analysis.test.ts > Initiatives routes: POST /readiness-analysis (REAL integration) > counts DONE tasks, approved decisions, and critical risks
- tests/integration/initiatives/initiatives.readiness-analysis.test.ts > Initiatives routes: POST /readiness-analysis (REAL integration) > returns 400 when initiativeId is missing
- tests/integration/initiatives/initiatives.readiness-analysis.test.ts > Initiatives routes: POST /readiness-analysis (REAL integration) > returns 404 when initiative is not found
- tests/integration/initiatives/initiatives.section-types.test.ts > Initiatives routes: /section-types (REAL integration) > DELETE /section-types/:id returns 500 on other errors
- tests/integration/initiatives/initiatives.section-types.test.ts > Initiatives routes: /section-types (REAL integration) > DELETE /section-types/:id returns success
- tests/integration/initiatives/initiatives.section-types.test.ts > Initiatives routes: /section-types (REAL integration) > POST /section-types/:id/duplicate returns 201 and passes orgId + userId
- tests/integration/initiatives/initiatives.section-types.test.ts > Initiatives routes: /section-types (REAL integration) > POST /section-types/:id/duplicate returns 403 when org is missing
- tests/integration/initiatives/initiatives.suggest-sections.test.ts > Initiatives routes: POST /suggest-sections (REAL integration) > defaults language to en
- tests/integration/initiatives/initiatives.suggest-sections.test.ts > Initiatives routes: POST /suggest-sections (REAL integration) > passes through explicit language
- tests/integration/initiatives/initiatives.suggest-sections.test.ts > Initiatives routes: POST /suggest-sections (REAL integration) > returns 403 when organizationId is missing
- tests/integration/initiatives/initiatives.suggest-sections.test.ts > Initiatives routes: POST /suggest-sections (REAL integration) > returns 500 when suggestSections throws
- tests/integration/initiatives/initiatives.suggest-sections.test.ts > Initiatives routes: POST /suggest-sections (REAL integration) > returns suggestions wrapper even for empty list
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G0a without the migration the receipt cannot persist, but title de-dup still catches the plain retry
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G0b without the migration, a de-dup miss DOES mint a duplicate DRAFT (the real defect)
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G0c WITH the migration the same de-dup miss no longer duplicates
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G1 first success — exactly one initiative and one canonical receipt
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G2 retry / lost response — same initiative, no second DRAFT
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G3 concurrent double-accept — exactly one receipt claim wins
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G4 rollback / failure — fail-closed, then retry reconciles onto the same initiative
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G5 owner/tenant negative control — cross-org accept resolves nothing
- tests/integration/initiatives/m05fix01-candidate-acceptance-receipt.pg.test.ts > M05-FIX-01 — candidate acceptance receipt (real Postgres) > G6 driver omitting `changes` still resolves correctly (no false receiptPersisted)
- tests/integration/initiatives/notifications-gate-role.test.ts > M13/R4 — gate-role action-required notification (real controller) > SCHEDULED → EXECUTING notifies the next-gate role holder (auto-derived owner)
- tests/integration/initiatives/notifications-gate-role.test.ts > M13/R4 — gate-role action-required notification (real controller) > does not emit gate_action_required when no role holder matches the next gate
- tests/integration/initiatives/notifications-gate-role.test.ts > M13/R4 — gate-role action-required notification (real controller) > explicit initiative_gate_roles row for the next gate is also notified
- tests/integration/initiatives/notifications-org-scope.test.ts > M13/R4 — notification org-scope (no cross-org leak) > a recipient outside the resolved set receives nothing
- tests/integration/initiatives/notifications-org-scope.test.ts > M13/R4 — notification org-scope (no cross-org leak) > every notification is scoped to the initiative org and only targets resolved recipients
- tests/integration/initiatives/notifications.test.ts > M13/R4 — status-change notification wiring (real controller) > a → BLOCKED transition delivers exactly one status notification per recipient
- tests/integration/initiatives/notifications.test.ts > M13/R4 — status-change notification wiring (real controller) > never notifies the actor about their own status change
- tests/integration/initiatives/notifications.test.ts > M13/R4 — status-change notification wiring (real controller) > non-blocked transition fires INFO initiative.status_changed
- tests/integration/initiatives/notifications.test.ts > M13/R4 — status-change notification wiring (real controller) > → BLOCKED fires a single CRITICAL initiative.status_changed carrying the reason
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-01: DRAFT → PENDING_REVIEW (owner) → update wykonany
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-02: PENDING_REVIEW → REVIEW (PM) → update
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-03: PENDING_REVIEW → DRAFT (send-back, PMO) → update
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-04: REVIEW → DRAFT (reject, sponsor) → update
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-05: EXECUTING → BLOCKED z powodem (owner) → update
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-06: BLOCKED → EXECUTING (unblock, steering+board) → update
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-07: → CANCELLED z aktywnego (PMO, bypass bramek) → update
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-08: ADMIN omija bramkę na dowolnym forward → update
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-09: skok DRAFT → APPROVED → 400
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-10: cofnięcie DONE → EXECUTING → 400
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-11: mutacja ARCHIVED → 400
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-13: [DEF-1 naprawiony] BLOCKED bez powodu → 400 BLOCKED_REASON_REQUIRED
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-14: zapis statusu trafia do UPDATE initiatives SET
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-15: odpowiedź sukcesu zawiera nowy status
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-16: CONSULTANT próbuje APPROVE → 403
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-17: PMO próbuje APPROVE (tylko steering) → 403
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-18: STEERING APPROVE (board enabled) → przechodzi (update)
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-19: brak steering-board → degradacja do PROJECT_SPONSOR dla APPROVE
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-20: VIEWER (brak roli bramki) → 403
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-21: CONSULTANT submit CUDZEJ inicjatywy → 403 (created_by guard)
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-22: BUSINESS_OWNER próbuje COMPLETE (nie jego bramka) → 403
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-23: DONE z otwartymi decyzjami bramki wykonawczej → 400 EXECUTION_GATE_DECISION_REQUIRED
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-24: DONE → TRACKING bez KPI korzyści → 400 BENEFITS_KPI_REQUIRED
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-25: readiness hard-block (blocking items) → 400 GATE_BLOCKED
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-26: CANCELLED omija readiness hard-block
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-27: side-effect — wpis do initiative_status_history
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-28: side-effect — timestamp cyklu (review_requested_at) w UPDATE
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-29: BLOCKED zapisuje blocked_reason w UPDATE
- tests/integration/initiatives/statusLifecycle.test.ts > L2 — updateInitiativeStatus (realny handler, mock-DB) > L2-A2: inicjatywa nie istnieje → 404
- tests/integration/interview/voice-stt-save.test.ts > M10 Interview voice STT save (L-01)
- tests/integration/legal.test.ts > Legal routes - REAL integration > GET /document/:type returns 503 when not configured
- tests/integration/m01-prun-base-runtime-migration-discovery.realdb.test.ts > M01-PRUN Part A — base-branch runtime runner discovery + determinism (real Postgres, fixture-only) > FRESH: the branch's own runMigrations({ migrationsDir }), against an isolated fixture directory, applies exactly the five M01 files
- tests/integration/m01-prun-base-runtime-migration-discovery.realdb.test.ts > M01-PRUN Part A — base-branch runtime runner discovery + determinism (real Postgres, fixture-only) > RERUN (945 specifically): deleting only its history row and re-running re-applies exactly that one file (idempotent DDL, no error)
- tests/integration/m01-prun-base-runtime-migration-discovery.realdb.test.ts > M01-PRUN Part A — base-branch runtime runner discovery + determinism (real Postgres, fixture-only) > RERUN: a second run against the SAME fixture directory applies nothing new
- tests/integration/m01-prun-base-runtime-migration-discovery.realdb.test.ts > M01-PRUN Part A — base-branch runtime runner discovery + determinism (real Postgres, fixture-only) > each of the five M01 numbered migrations appears in server/migrations exactly once, with no diverging duplicate under a different filename (M01-P08R: this assertion was written for the isolated PRUN branch, where 943/944/945 were owned elsewhere and had to be ABSENT to avoid round-1's diverging-blob mistake; on the integration candidate, all six packets are merged and these files are legitimately present, each from its single canonical owner — the invariant worth protecting post-merge is "exactly one, not zero")
- tests/integration/m02b-preflight-checksum.realdb.test.ts > M02-019 — preflight checksum drift + runner parity > runner and preflight share the discovery pattern and checksum helper
- tests/integration/m02b-startup-readiness.realdb.test.ts > M02-004 — startup readiness gate (real Postgres, real runner) > retry after the migration is fixed → ready, and it actually applies
- tests/integration/m02b-startup-readiness.realdb.test.ts > M02-004 — startup readiness gate (real Postgres, real runner) > seeding failure is reported but does not gate readiness
- tests/integration/m02b-startup-readiness.realdb.test.ts > M02-004 — startup readiness gate (real Postgres, real runner) > success → ready, migrations reported ok, seeding ran
- tests/integration/m02p04-tasks-idempotency.realdb.test.ts > M02-P04 — Tasks idempotency + lifecycle + tenant isolation (real Postgres) > pmo stack: task WITHOUT an initiativeId is now idempotency-protected (was NOT before this fix)
- tests/integration/m02p18-runner-identity-reconciliation.realdb.test.ts > M02-P18 — runner/identity reconciliation (real Postgres) > DETERMINISM: the two 942_* files (M02-C, M01) apply in the same order regardless of on-disk creation order
- tests/integration/m02p18-runner-identity-reconciliation.realdb.test.ts > M02-P18 — runner/identity reconciliation (real Postgres) > FRESH: the real 940_mw010_vault_document_versions.sql applies cleanly against a bare schema
- tests/integration/m02p18-runner-identity-reconciliation.realdb.test.ts > M02-P18 — runner/identity reconciliation (real Postgres) > FRESH: the real 942_ai_agent_plan_run_idempotency.sql applies cleanly against a minimal ai_agent_plans table
- tests/integration/m02p18-runner-identity-reconciliation.realdb.test.ts > M02-P18 — runner/identity reconciliation (real Postgres) > the allowlist stays narrow: exactly the 5 individually-reviewed entries
- tests/integration/m13-organization-profile-persistence.test.ts [ tests/integration/m13-organization-profile-persistence.test.ts ]
- tests/integration/management/managementReports.pptx-dependency-missing.test.ts > Management reports export (dependency missing is explicit) > GET /api/management-reports/:id/pptx returns 503 when schema is missing (no 500 HTML)
- tests/integration/method-core-migrations.realdb.test.ts > Method-core migrations — Gate 7 — no silent exclusion by name or subdirectory (static, no DB required) > method_* tables are declared ONLY by these 4 files (scope check — no stray producer elsewhere)
- tests/integration/middleware/demoWriteProtection.test.ts > Demo write protection > blocks writes when X-Demo-Mode=true
- tests/integration/mywork/my-work.convert.contract.test.ts > M05 L-08 — S5: idea→entity conversion contracts > S5a — convert idea to initiative > INSERT INTO initiatives is called with the org_id
- tests/integration/mywork/my-work.convert.contract.test.ts > M05 L-08 — S5: idea→entity conversion contracts > S5a — convert idea to initiative > POST /convert with target=initiative → 200 with promotedTo + initiativeId
- tests/integration/mywork/my-work.convert.contract.test.ts > M05 L-08 — S5: idea→entity conversion contracts > S5a — convert idea to initiative > my_ideas promoted_to is updated after conversion
- tests/integration/mywork/my-work.convert.contract.test.ts > M05 L-08 — S5: idea→entity conversion contracts > S5b — validation > missing Idempotency-Key header → 428
- tests/integration/mywork/my-work.convert.contract.test.ts > M05 L-08 — S5: idea→entity conversion contracts > S5b — validation > missing target → 400
- tests/integration/mywork/my-work.convert.contract.test.ts > M05 L-08 — S5: idea→entity conversion contracts > S5b — validation > unknown target → 400
- tests/integration/mywork/my-work.convert.contract.test.ts > M05 L-08 — S5: idea→entity conversion contracts > S5c — not found > unknown idea → 404
- tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts > MW-CORE-001 golden flow: Inbox/Task (real Postgres, real routers) > #11/#12 fault after Task commit -> 500 recovery-required; retry repairs without duplication
- tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts > MW-CORE-001 golden flow: Inbox/Task (real Postgres, real routers) > #5 tenant isolation > 5b tenant B cannot mutate tenant A's Task via PUT /api/tasks/:id (404, org-scoped SELECT)
- tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts > MW-CORE-001 golden flow: Inbox/Task (real Postgres, real routers) > #6 missing task.update capability (OBSERVER role) returns 403 under CAPABILITY_ENFORCE=enforce, changes nothing
- tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts > MW-CORE-001 golden flow: Inbox/Task (real Postgres, real routers) > #7a invalid task status transition (backlog -> done) is rejected 400 INVALID_TRANSITION
- tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts > MW-CORE-001 golden flow: Inbox/Task (real Postgres, real routers) > #7b stale expectedStatus on close returns 409 INBOX_CLOSE_STATE_MISMATCH
- tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts > MW-CORE-001 golden flow: Inbox/Task (real Postgres, real routers) > #9/#10/#13 full happy path: transition + close persist and read back on independent fresh requests
- tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts [ tests/integration/mywork/my-work.golden-flow-inbox-task.test.ts ]
- tests/integration/mywork/my-work.v2.routes.test.ts > My Work (V2) routes
- tests/integration/organization-management.workflow.test.js > Organization Management Workflow > should create organization
- tests/integration/organization-management.workflow.test.js > Organization Management Workflow > should manage organization members
- tests/integration/organization-management.workflow.test.js > Organization Management Workflow > should update organization settings
- tests/integration/organization/orgUploadGovernedClaim.mounted.pg.test.ts > ORG-UI upload -> governed claim mounted seam
- tests/integration/organizations/member-role-id-resolution.test.ts > OrganizationController.updateMemberRole — id/user_id resolution (H2.17) > resolves the target by membership id and still updates by canonical user_id
- tests/integration/organizations/member-role-id-resolution.test.ts > OrganizationController.updateMemberRole — id/user_id resolution (H2.17) > resolves the target by user_id and updates by canonical user_id
- tests/integration/organizations/organization-endpoints.test.ts > Organization partner code routes - REAL integration > POST /partner-code returns 400 for invalid partner code
- tests/integration/p07-notebook-runtime-gaps.test.ts > P07 Provenance per-block > capture() creates blocks with provenance.type="source"
- tests/integration/p11-two-entry-points.test.ts [ tests/integration/p11-two-entry-points.test.ts ]
- tests/integration/partners/partner-accrual-payout-atomic.realdb.test.ts > PRT-MVP-ACCRUAL-001 atomic canonical payout writer real PG
- tests/integration/partners/partner-legacy-cutover.realdb.test.ts [ tests/integration/partners/partner-legacy-cutover.realdb.test.ts ]
- tests/integration/partners/partner-owner-organization-binding.realdb.test.ts > Partner historical owner binding
- tests/integration/partners/partner-participant-ledger.realpg.test.ts > PRT-MVP-LEDGER-001 participant/referral ledger
- tests/integration/partners/partners.happy-path-and-fallback.test.ts > M26 Portal Partnerski — happy-path + fallback > L-04: GET /earnings returns real summary on the happy path
- tests/integration/partners/partners.happy-path-and-fallback.test.ts > M26 Portal Partnerski — happy-path + fallback > L-04: GET /earnings surfaces 503 DB_ERROR (never a hardcoded commissionRate:15)
- tests/integration/partners/partners.happy-path-and-fallback.test.ts > M26 Portal Partnerski — happy-path + fallback > S3 (L-03): POST /payouts/request returns 201 with the created payout
- tests/integration/partners/partners.happy-path-and-fallback.test.ts > M26 Portal Partnerski — happy-path + fallback > S3 (L-03): POST /payouts/request returns 400 when nothing is payable
- tests/integration/partners/partners.no-demo-organization-referral-dashboard.test.ts > Partners routes (no demo placeholders) > GET /api/partners/dashboard does not return demo courses (503 when schema missing)
- tests/integration/partners/partners.no-demo-organization-referral-dashboard.test.ts > Partners routes (no demo placeholders) > GET /api/partners/organization does not return demo org (503 instead)
- tests/integration/partners/partners.no-demo-organization-referral-dashboard.test.ts > Partners routes (no demo placeholders) > GET /api/partners/referral-tools does not return demo code (503 when schema missing)
- tests/integration/performance/dbOptimization.test.ts > Database Performance Optimization > should use idx_tasks_org_assignee_status when filtering by org, assignee, and status
- tests/integration/performance/dbOptimization.test.ts > Database Performance Optimization > should use idx_tasks_org_initiative when filtering by org and initiative
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > DELETE /api/projects/:projectId/members/:userId > should remove member from project
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > GET /api/projects/:projectId/available-assignees > should return users who can be assigned tasks
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > GET /api/projects/:projectId/members > should filter by role
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > GET /api/projects/:projectId/members > should list project members
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > GET /api/projects/:projectId/my-role > should return current user role
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > GET /api/projects/:projectId/raci-matrix > should include all object types in RACI matrix
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > GET /api/projects/:projectId/raci-matrix > should return RACI matrix
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > PATCH /api/projects/:projectId/members/:userId > should update member role
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > POST /api/projects/:projectId/members > should add a member to a project
- tests/integration/pmo-project-members.integration.test.ts > PMO Project Members API > POST /api/projects/:projectId/members > should reject invalid role
- tests/integration/pmo-project-members.integration.test.ts > PMO Task Assignment API > GET /api/tasks/:id/escalations > should return escalation history
- tests/integration/pmo-project-members.integration.test.ts > PMO Task Assignment API > GET /api/tasks/my-workload > should return current user workload
- tests/integration/pmo-project-members.integration.test.ts > PMO Task Assignment API > POST /api/tasks/:id/assign > should assign task to user
- tests/integration/pmo-project-members.integration.test.ts > PMO Task Assignment API > POST /api/tasks/:id/escalate > should escalate task
- tests/integration/pmo-project-members.integration.test.ts > PMO Task Assignment API > POST /api/tasks/:id/unassign > should unassign task
- tests/integration/pmo-project-members.integration.test.ts > PMO Workstreams API > GET /api/projects/:projectId/workstreams > should filter by status
- tests/integration/pmo-project-members.integration.test.ts > PMO Workstreams API > GET /api/projects/:projectId/workstreams > should list workstreams
- tests/integration/pmo-project-members.integration.test.ts > PMO Workstreams API > POST /api/projects/:projectId/workstreams > should create a workstream
- tests/integration/pmo-project-members.integration.test.ts > PMO Workstreams API > POST /api/projects/:projectId/workstreams > should require name
- tests/integration/presentations/deck-version-roundtrip.contract.test.ts > M19 · L-07 — deck version snapshot round-trip (S4, real SQL) > autosave is org-scoped: another org cannot touch the deck (404, no snapshot leak)
- tests/integration/presentations/deck-version-roundtrip.contract.test.ts > M19 · L-07 — deck version snapshot round-trip (S4, real SQL) > autosave writes a real snapshot row of the PREVIOUS deck_json and bumps version
- tests/integration/presentations/deck-version-roundtrip.contract.test.ts > M19 · L-07 — deck version snapshot round-trip (S4, real SQL) > multiple autosaves accumulate an ordered version history (DESC by version)
- tests/integration/presentations/deck-version-roundtrip.contract.test.ts > M19 · L-07 — deck version snapshot round-trip (S4, real SQL) > restore is org-scoped: cross-org restore is rejected (404)
- tests/integration/presentations/deck-version-roundtrip.contract.test.ts > M19 · L-07 — deck version snapshot round-trip (S4, real SQL) > restore rejects a stale expectedVersion with 409 and leaves live content unchanged
- tests/integration/presentations/deck-version-roundtrip.contract.test.ts > M19 · L-07 — deck version snapshot round-trip (S4, real SQL) > round-trip: autosave → snapshot → restore rehydrates the OLD deck_json (survives reload)
- tests/integration/presentations/deck-version-roundtrip.contract.test.ts > M19 · L-07 — deck version snapshot round-trip (S4, real SQL) > version conflict: stale x-deck-version is rejected 409 and writes NO snapshot
- tests/integration/rapidlean/rapidlean.routes.test.ts > RapidLean routes (REAL integration) > GET /api/rapidlean/assessments returns list
- tests/integration/rapidlean/rapidlean.routes.test.ts > RapidLean routes (REAL integration) > POST /api/rapidlean/assessments creates draft assessment
- tests/integration/rapidlean/rapidlean.routes.test.ts > RapidLean routes (REAL integration) > PUT /api/rapidlean/assessments/:id updates score/status/dimensions
- tests/integration/rapidlean/rapidlean.routes.test.ts > RapidLean routes (REAL integration) > PUT /api/rapidlean/assessments/:id validates updates
- tests/integration/realtime/tablePlatformRealtime.orgscope.test.ts > #101 Grupa 0 — /table-platform realtime org-context gate > P0 leak: active demo session must NOT join/relay into a REAL-org table
- tests/integration/realtime/tablePlatformRealtime.orgscope.test.ts > #101 Grupa 0 — /table-platform realtime org-context gate > demo preference (shared demo org): join is allowed but cell:update is read-only
- tests/integration/realtime/tablePlatformRealtime.orgscope.test.ts > #101 Grupa 0 — /table-platform realtime org-context gate > join:table is refused when the table belongs to another org
- tests/integration/realtime/tablePlatformRealtime.orgscope.test.ts > #101 Grupa 0 — /table-platform realtime org-context gate > no regression: same-org peers relay cell:update with the VERIFIED user id
- tests/integration/realtime/tablePlatformRealtime.orgscope.test.ts > #101 Grupa 0 — /table-platform realtime org-context gate > org switch mid-connection: stale real-org socket is disconnected on next write
- tests/integration/resource-management-api.test.ts > resourceManagement.routes > DELETE /api/superadmin/subscription-plans/:id deletes when not in use
- tests/integration/resource-management-api.test.ts > resourceManagement.routes > DELETE /api/superadmin/subscription-plans/:id rejects deletion when in use
- tests/integration/resource-management-api.test.ts > resourceManagement.routes > GET /api/superadmin/organizations/:id/resources returns 404 when org missing
- tests/integration/resource-management-api.test.ts > resourceManagement.routes > GET /api/superadmin/subscription-plans returns plans
- tests/integration/resource-management-api.test.ts > resourceManagement.routes > POST /api/superadmin/subscription-plans creates plan
- tests/integration/resource-management.integration.test.ts > Resource Management Integration Tests > Budget Initialization and Tracking Workflow > should complete budget setup → expense recording → alert workflow
- tests/integration/resource-management.integration.test.ts > Resource Management Integration Tests > Budget Period Reset Workflow > should reset budget period → clear spent amount → preserve budget limit
- tests/integration/resource-management.integration.test.ts > Resource Management Integration Tests > Cross-Service Integration: Budget + Quota + Middleware > should integrate budget tracking with quota enforcement
- tests/integration/resource-management.integration.test.ts > Resource Management Integration Tests > Expense History and Category Breakdown > should record expenses → retrieve history → filter by category
- tests/integration/resource-management.integration.test.ts > Resource Management Integration Tests > Expense History and Category Breakdown > should support pagination of expense history
- tests/integration/resource-management.integration.test.ts > Resource Management Integration Tests > Subscription Plan and Resource Allocation Workflow > should assign plan → apply resource limits → enforce quotas
- tests/integration/results-recovery-children.mounted.realpg.test.ts > mounted signed-JWT RESULTS-W27..W31 cutover (real PostgreSQL) > returns exact mounted auth/tenant errors with zero mutation
- tests/integration/results/day46.mutator-tenant-isolation.realpg.test.ts > day46-finish F.2 — mutating Results routes reject cross-tenant writes (real Gateway, real PG, enforce)
- tests/integration/results/day46.search-gateway-scenarios.realpg.test.ts > day46-finish D.2 — GET /api/vnext/results/search real-Gateway scenarios
- tests/integration/results/day46.seed-readback.realpg.test.ts > day46-finish G.1 — real Gateway readback of the RN-G6 seed (KPI/ROI/OKR lists)
- tests/integration/routes/access-control.test.js > Integration Test: Access Control Routes > GET /api/access-control/requests > should require SUPERADMIN role
- tests/integration/routes/access-control.test.js > Integration Test: Access Control Routes > Permission Enforcement > should enforce ADMIN role for admin routes
- tests/integration/routes/access-control.test.js > Integration Test: Access Control Routes > Permission Enforcement > should enforce SUPERADMIN role for superadmin routes
- tests/integration/routes/adminP32.overview.test.ts > P32 admin overview partial capabilities > returns available overview sections with per-section capability errors
- tests/integration/routes/adminP32.overview.test.ts > P32 admin overview partial capabilities > treats same-scope write capability as sufficient for read-only security views
- tests/integration/routes/ai-experiments.test.js > AI Experiments API > GET /api/ai/experiments > should list experiments or handle appropriately
- tests/integration/routes/ai-experiments.test.js > AI Experiments API > POST /api/ai/experiments > should create experiment or handle appropriately
- tests/integration/routes/ai-performance.test.js > AI Performance API > GET /api/ai/performance > should return 401 without auth
- tests/integration/routes/ai-performance.test.js > AI Performance API > GET /api/ai/performance/stats > should return 401 without auth
- tests/integration/routes/ai.test.js > AI Routes Integration Tests > Error Handling > should handle invalid project IDs gracefully
- tests/integration/routes/ai.test.js > AI Routes Integration Tests > GET /api/ai/context > should return AI context for authenticated user
- tests/integration/routes/ai.test.js > AI Routes Integration Tests > GET /api/ai/context/:projectId > should build AI context for specific project
- tests/integration/routes/ai.test.js > AI Routes Integration Tests > GET /api/ai/context/:projectId > should handle non-existent project
- tests/integration/routes/ai.test.js > AI Routes Integration Tests > GET /api/ai/memory/project/:projectId > should retrieve project memory
- tests/integration/routes/ai.test.js > AI Routes Integration Tests > GET /api/ai/policy > should return AI policy configuration
- tests/integration/routes/ai.test.js > AI Routes Integration Tests > POST /api/ai/chat > should handle chat request
- tests/integration/routes/api-keys.l3.test.ts > API keys routes integration (L3)
- tests/integration/routes/artifact-runs.approve-vs-review-boundary.sqlite.integration.test.ts > P17 contract: approve(run) ≠ review(artifact) boundary > materialize creates a canonical artifact but does NOT start artifact review
- tests/integration/routes/artifact-runs.approve-vs-review-boundary.sqlite.integration.test.ts > P17 contract: approve(run) ≠ review(artifact) boundary > records audit trail entries for each lifecycle transition
- tests/integration/routes/artifact-runs.approve-vs-review-boundary.sqlite.integration.test.ts > P17 contract: approve(run) ≠ review(artifact) boundary > startArtifactReview only works on a real artifact after materialization completes
- tests/integration/routes/artifactLineage.mat010-multi-instance.postgres.integration.test.ts > MAT-010 — multi-instance idempotency & restart recovery (Codex final review, Blockers 1 & 2, real Postgres) > BLOCKER 1 (share_minted) — two independent app instances racing the SAME Idempotency-Key produce EXACTLY ONE live share link, and both HTTP responses return the same token
- tests/integration/routes/artifactLineage.mat010-multi-instance.postgres.integration.test.ts > MAT-010 — multi-instance idempotency & restart recovery (Codex final review, Blockers 1 & 2, real Postgres) > BLOCKER 2 (share_minted) — perform in "process A", retry against a fresh "process B": returns the SAME usable token, zero second live credential minted
- tests/integration/routes/artifactLineage.mat010-presentation-durability.postgres.integration.test.ts > MAT-010 — Presentation durability (share_minted, real Postgres) > DOUBLE FAILURE (share_minted) — direct write AND pending write both fail: the route returns 500 LINEAGE_RECOVERY_REQUIRED instead of its normal 200, and the deck row still committed the new share_token
- tests/integration/routes/artifactLineage.mat010-presentation-durability.postgres.integration.test.ts > MAT-010 — Presentation durability (share_minted, real Postgres) > SINGLE FAILURE (share_minted) — direct write fails, durable pending marker survives, reconciliation produces exactly one `share_minted` event with the correct actor and idempotency key, and a second reconcile is a no-op
- tests/integration/routes/artifactLineage.mat010-presentation-durability.postgres.integration.test.ts > MAT-010 — Presentation durability (share_minted, real Postgres) > cross-tenant — org B cannot mint a share for org A's deck, and no lineage is recorded for org B
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Document (wave5_artifacts) — real routes > CONCURRENCY (share_minted) — two genuinely concurrent mint requests with the SAME Idempotency-Key produce EXACTLY ONE `share_minted` event and ONE live token
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Document (wave5_artifacts) — real routes > DOUBLE FAILURE (share_minted) — the durable claim write fails: the route returns 500 CLAIM_ACQUIRE_FAILED BEFORE `createShareLink` runs, zero live links exist, and a retry after the fault clears mints exactly ONE credential
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Document (wave5_artifacts) — real routes > REAL ROUTE — GET /:artifactId/export/:format records `export`, including markdown (previously recorded nowhere)
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Document (wave5_artifacts) — real routes > REAL ROUTE — share-link mint -> UNAUTHENTICATED public read -> revoke, all recorded, no token material stored
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Document (wave5_artifacts) — real routes > REAL ROUTE — the canonical trace API returns the document lineage, and org B gets a 404
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Document (wave5_artifacts) — real routes > REQUEST-BOUND IDEMPOTENCY (share_minted) — retrying the same mint request with the same Idempotency-Key returns the SAME share link/credential, appends no second `share_minted` event, and mints no second live token
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > DOUBLE FAILURE (export/pdf) — the durable pre-flight write fails: the route returns 500 LINEAGE_RECOVERY_REQUIRED BEFORE `doc.pipe(res)`, zero PDF bytes are ever sent, and no lineage trace of any kind exists for this export
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > DOUBLE FAILURE (export/png) — the same streaming-preflight guard: 500 LINEAGE_RECOVERY_REQUIRED before `archive.pipe(res)`, zero zip bytes sent, no lineage trace
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > REAL ROUTE — POST /decks fires the `created` hook and writes a receipt with origin_runtime=presentation
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > REAL ROUTE — a rejected presentation_decks INSERT is a 500, never a false 201 (MAT-010 G8)
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > REAL ROUTE — autosave records `version`, and a stale (409) autosave records NOTHING
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > REAL ROUTE — restore records `restore` and carries the version it restored from
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > REAL ROUTE — share mint -> public open -> revoke -> dead token, with no token material in the lineage
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > Presentation (presentation_decks) — real routes > REAL ROUTE — the canonical trace API returns the deck lineage, and org B gets a 404
- tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts > MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres) > the org-scoped listing surfaces presentation AND document receipts created purely by real-route traffic
- tests/integration/routes/artifactLineage.mat010.postgres.integration.test.ts > MAT-010 — canonical artifact lineage receipts (real Postgres)
- tests/integration/routes/assessment.day32.reportDocx.postgres.integration.test.ts > Day 32 assessment report DOCX — real router, JWT and PostgreSQL > day32.secondTenant writes two route-produced evidence files and structural parity measurements
- tests/integration/routes/assessment.day34.visualParity.postgres.integration.test.ts > Day 34 assessment report DOCX — real router, JWT and PostgreSQL > day34.secondTenant writes two route-produced evidence files and structural parity measurements
- tests/integration/routes/audit.l3.test.ts > Audit routes integration (L3) > GET / returns audits ordered by created_at DESC
- tests/integration/routes/audit.l3.test.ts > Audit routes integration (L3) > POST / creates an audit with defaults (type=internal, auditor="")
- tests/integration/routes/audit.l3.test.ts > Audit routes integration (L3) > POST / persists provided type and auditor
- tests/integration/routes/audit.l3.test.ts > Audit routes integration (L3) > PUT /:id can update multiple fields at once
- tests/integration/routes/audit.l3.test.ts > Audit routes integration (L3) > PUT /:id updates score and findings (JSON)
- tests/integration/routes/audit.l3.test.ts > Audit routes integration (L3) > PUT /:id updates status and sets completed_date when status=completed
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > filters organization context lineage by target type and workflow for queue outcomes
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > reads org-scoped context lineage events for admins
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > reads org-scoped context processing jobs for admins
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > reads org-scoped context processing queue summary for admins
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > reads org-scoped context storage events for admins
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > recovers stale context locks for confirmed admin action and audits it
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > requeues a dead-letter context job for confirmed admin action and audits it
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > requires explicit confirmation before recovering stale context locks
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > requires explicit confirmation before requeueing a dead-letter context job
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > requires explicit confirmation before running context worker
- tests/integration/routes/auditLog.organizationContext.test.ts > Audit log organization context read surfaces > runs context worker once for confirmed admin action and audits it
- tests/integration/routes/auth.test.js > Auth Routes Integration > GET /api/auth/me > should return current user details
- tests/integration/routes/auth.test.js > Auth Routes Integration > POST /api/auth/login > should login successfully with correct credentials
- tests/integration/routes/auth.test.js > Auth Routes Integration > POST /api/auth/logout > should logout successfully
- tests/integration/routes/auth.test.js > Auth Routes Integration > POST /api/auth/refresh > should refresh token using valid refresh token
- tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts > Billing routes (no demo placeholders in analytics/revenue) > GET /api/billing/admin/plans does not return hardcoded plan-enterprise
- tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts > Billing routes (no demo placeholders in analytics/revenue) > GET /api/billing/analytics/cohorts is honest when schema missing
- tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts > Billing routes (no demo placeholders in analytics/revenue) > GET /api/billing/analytics/expansion is honest when schema missing
- tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts > Billing routes (no demo placeholders in analytics/revenue) > GET /api/billing/revenue-forecasts does not return demo forecast-* ids
- tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts > Billing routes (no demo placeholders in analytics/revenue) > GET /api/billing/tax-settings does not auto-seed placeholder tax data
- tests/integration/routes/billing.no-demo.analytics-and-revenue.test.ts > Billing routes (no demo placeholders in analytics/revenue) > GET /api/billing/usage does not seed demo usage records
- tests/integration/routes/billing.routes.full.l3.test.ts > Billing routes integration (L3) - full > covers payment methods endpoints
- tests/integration/routes/billing.routes.full.l3.test.ts > Billing routes integration (L3) - full > covers revenue forecasts + revenue recognition endpoints (both legacy and new paths)
- tests/integration/routes/billing.routes.full.l3.test.ts > Billing routes integration (L3) - full > covers subscription changes endpoints (approve/reject + stats)
- tests/integration/routes/billing.routes.full.l3.test.ts > Billing routes integration (L3) - full > covers subscription self-serve + admin subscription CRUD
- tests/integration/routes/billing.routes.full.l3.test.ts > Billing routes integration (L3) - full > covers usage endpoints (record + list + summary)
- tests/integration/routes/billing.routes.l3.test.ts > Billing routes integration (L3) > GET /admin/plans returns plans array with parsed JSON fields
- tests/integration/routes/billing.routes.l3.test.ts > Billing routes integration (L3) > GET /analytics/mrr/trend returns 503 when billing analytics schema is missing
- tests/integration/routes/billing.test.js [ tests/integration/routes/billing.test.js ]
- tests/integration/routes/budget.l3.test.ts > Budget routes integration (L3) > GET /summary aggregates planned/actual totals and count
- tests/integration/routes/budget.l3.test.ts > Budget routes integration (L3) > GET /summary returns zeros when org has no budgets
- tests/integration/routes/budget.l3.test.ts > Budget routes integration (L3) > PUT /:id returns 400 when body contains no updates
- tests/integration/routes/budget.l3.test.ts > Budget routes integration (L3) > PUT /:id updates fields and DELETE /:id removes the budget
- tests/integration/routes/decisions.remind.routes.test.ts > Decisions remind endpoint > POST /api/decisions/:id/remind returns 200 for empty body
- tests/integration/routes/decisions.remind.routes.test.ts > Decisions remind endpoint > POST /api/decisions/:id/remind returns 400 when message is too long
- tests/integration/routes/decisions.test.js > Decisions Routes > GET /api/decisions > filters by projectId
- tests/integration/routes/decisions.test.js > Decisions Routes > GET /api/decisions > handles database errors gracefully
- tests/integration/routes/decisions.test.js > Decisions Routes > GET /api/decisions > returns list of decisions
- tests/integration/routes/decisions.test.js > Decisions Routes > GET /api/decisions/:id > returns 404 for non-existent decision
- tests/integration/routes/decisions.test.js > Decisions Routes > GET /api/decisions/:id > returns single decision
- tests/integration/routes/decisions.test.js > Decisions Routes > POST /api/decisions > creates new decision
- tests/integration/routes/deliverablesGenerations.bundle.test.ts > W13.1 — POST /bundle/export (zip teczka) > happy path → 200 application/zip + Content-Disposition; themeId przekazany
- tests/integration/routes/deliverablesGenerations.bundle.test.ts > W13.1 — POST /bundle/export (zip teczka) > zero plików → 502
- tests/integration/routes/demoRoutes.no-stubs.test.ts > Demo routes (no hardcoded demo data, honest availability)
- tests/integration/routes/document-studio.export-trace.routes.test.ts > document-studio export trace parity > records completed export trace for docx export success
- tests/integration/routes/document-studio.export-trace.routes.test.ts > document-studio export trace parity > records failed export trace for pdf export failure
- tests/integration/routes/documentsRoutes.no-stubs.test.ts > Documents routes (context document service) > POST /api/documents/upload returns 400 when file missing
- tests/integration/routes/economics.missing-table-honesty.postgres.integration.test.ts > M08 — brak tabeli nie może dawać fałszywego sukcesu (real Postgres) > M08-H01 — zapis scenariuszy NIE melduje sukcesu (fail closed 503)
- tests/integration/routes/economics.missing-table-honesty.postgres.integration.test.ts > M08 — brak tabeli nie może dawać fałszywego sukcesu (real Postgres) > M08-H02 — zapis benefitów NIE melduje sukcesu (fail closed 503)
- tests/integration/routes/economics.missing-table-honesty.postgres.integration.test.ts > M08 — brak tabeli nie może dawać fałszywego sukcesu (real Postgres) > M08-H03 — lista analiz DEGRADUJE się zamiast udawać pustą organizację
- tests/integration/routes/economicsFinancials.test.js > Economics Financials API > GET /api/economics/financials > should get financials or handle appropriately
- tests/integration/routes/economicsFlow.test.js > Integration Test: Economics Financial Analysis Flow > activates a scenario and creates initiative
- tests/integration/routes/genericReports.no-stubs.test.ts [ tests/integration/routes/genericReports.no-stubs.test.ts ]
- tests/integration/routes/health-data-context.test.ts > GET /api/health/data-context > reports demo context, approval, and header state when present
- tests/integration/routes/health-data-context.test.ts > GET /api/health/data-context > returns resolved database, policy, and active org context
- tests/integration/routes/health-faults.l3.test.ts > Health routes fault injection (L3) > db health /connections returns 500 with error payload when database module throws
- tests/integration/routes/health-faults.l3.test.ts > Health routes fault injection (L3) > db health /database returns 503 with error payload when database module throws
- tests/integration/routes/helpRoutes.test.ts > Help routes (no placeholders) > GET /api/help/articles returns db-backed list (empty when no data)
- tests/integration/routes/helpRoutes.test.ts > Help routes (no placeholders) > GET /api/help/categories returns db-backed list (empty when no data)
- tests/integration/routes/initiatives.test.js > Initiatives Routes > GET /api/initiatives > returns 401 for missing auth
- tests/integration/routes/initiatives.test.js > Initiatives Routes > GET /api/initiatives > returns list of initiatives
- tests/integration/routes/initiatives.test.js > Initiatives Routes > GET /api/initiatives/:id > returns 404 for non-existent initiative
- tests/integration/routes/initiatives.test.js > Initiatives Routes > GET /api/initiatives/:id > returns single initiative
- tests/integration/routes/initiatives.test.js > Initiatives Routes > POST /api/initiatives > creates new initiative
- tests/integration/routes/integracja.p01.test.ts > P01-B — Reauth wiring > POST /reauth updates auth state on success
- tests/integration/routes/invitations.test.js > Invitation Routes > Enterprise+ Security > should block invitations from DEMO organizations
- tests/integration/routes/invitations.test.js > Invitation Routes > GET /api/invitations/org > should list organization invitations
- tests/integration/routes/invitations.test.js > Invitation Routes > Management Operations > should resend and revoke invitation
- tests/integration/routes/invitations.test.js > Invitation Routes > POST /api/invitations/org > should create an organization invitation
- tests/integration/routes/invitations.test.js > Invitation Routes > POST /api/invitations/org > should reject duplicate invitation for same email
- tests/integration/routes/invitations.test.js > Invitation Routes > Token Operations > should validate and accept invitation
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /articles still returns articles
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /articles/:slug/related returns 404 for unknown article
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /articles/:slug/versions returns 404 for unknown article
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /categories still returns categories
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /collections returns array with title and article_count
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /collections/:slug returns 404 for unknown slug
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /collections?featured=true filters featured only
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /featured still returns featured articles
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /search still returns results
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /search/faceted with short query returns empty
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /search/faceted?q=... returns articles + facets
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /surface/:surface returns empty for non-existent surface
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /surface/:surface?toolContext= filters by tool context
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /surface/ai_recommendations returns articles for AI
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /surface/help returns articles bound to help
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /surface/public_docs returns articles bound to public_docs
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /tags returns array with label and kind
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /tags/:slug/articles returns 400 without slug
- tests/integration/routes/knowledge-base.p26.test.ts > P26-B: Knowledge Base — Collections, Tags, Surfaces > GET /tags?kind=domain filters by kind
- tests/integration/routes/login-history.l3.test.ts > Login history routes integration (L3) > GET / formats device strings across common user agents
- tests/integration/routes/managementReports.test.js > Integration Test: Management Reports Routes > GET /api/management-reports/history > should return report history
- tests/integration/routes/managementReports.test.js > Integration Test: Management Reports Routes > GET /api/management-reports/types > should return available report types
- tests/integration/routes/managementReports.test.js > Integration Test: Management Reports Routes > POST /api/management-reports/generate > should generate a report or return appropriate status
- tests/integration/routes/mcp.l3.test.ts > MCP routes integration (L3) > GET /context returns up to 3 active projects for the user
- tests/integration/routes/mcp.l3.test.ts > MCP routes integration (L3) > GET /providers filters by organization and sorts by name
- tests/integration/routes/mcp.l3.test.ts > MCP routes integration (L3) > GET /providers respects req.user.organizationId when set (bypass does not override)
- tests/integration/routes/mcp.l3.test.ts > MCP routes integration (L3) > GET /providers returns [] when mcp_providers table is missing (DbPromise fallback)
- tests/integration/routes/mcp.l3.test.ts > MCP routes integration (L3) > GET /providers returns [] when no providers exist for the org
- tests/integration/routes/mcp.l3.test.ts > MCP routes integration (L3) > GET /providers returns [] when organizationId is undefined
- tests/integration/routes/media-ingestion.test.js > Media Ingestion API > POST /api/media/ingest > should handle ingestion or respond appropriately
- tests/integration/routes/mediaIngestion.no-stubs.test.ts > Media ingestion routes (no degraded fake success) > GET /capabilities returns 503 when service is unavailable (no fake {})
- tests/integration/routes/mediaIngestion.no-stubs.test.ts > Media ingestion routes (no degraded fake success) > GET /supported-types returns 503 when service is unavailable (no fake [])
- tests/integration/routes/mediaIngestion.no-stubs.test.ts > Media ingestion routes (no degraded fake success) > POST /ingest/batch returns 503 (UI endpoint)
- tests/integration/routes/mediaIngestion.no-stubs.test.ts > Media ingestion routes (no degraded fake success) > POST /ingest/url returns 503 (UI endpoint)
- tests/integration/routes/mediaIngestion.no-stubs.test.ts > Media ingestion routes (no degraded fake success) > POST /ingest/youtube returns 503 (UI endpoint)
- tests/integration/routes/mediaIngestion.no-stubs.test.ts > Media ingestion routes (no degraded fake success) > POST /validate returns 503 when service is unavailable
- tests/integration/routes/meeting.day19.postgres.integration.test.ts > Meetings day19 routes — real router and PostgreSQL
- tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts > Meetings day24 C — UTC UNTIL across both Warsaw DST boundaries > autumn CEST to CET
- tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts > Meetings day24 C — UTC UNTIL across both Warsaw DST boundaries > autumn CEST to CET documents that an explicit-zone instant outside the series grid is accepted
- tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts > Meetings day24 C — UTC UNTIL across both Warsaw DST boundaries > spring CET to CEST
- tests/integration/routes/meeting.day24.dst-split.postgres.integration.test.ts > Meetings day24 C — UTC UNTIL across both Warsaw DST boundaries > spring CET to CEST documents that an explicit-zone instant outside the series grid is accepted
- tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts > Meetings day24 E — occurrence role gates > allows ADMIN PATCH and destructive cancellation
- tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts > Meetings day24 E — occurrence role gates > allows the USER creator to PATCH but not DELETE
- tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts > Meetings day24 E — occurrence role gates > denies a non-creator attendee PATCH and DELETE with zero changes
- tests/integration/routes/meeting.day24.occurrence-role-gate.postgres.integration.test.ts > Meetings day24 E — occurrence role gates > keeps foreign tenant requests at 404 with zero mutation
- tests/integration/routes/meeting.day24.task-funnel.postgres.integration.test.ts > Meetings day24 F — approved note action item to My Work task
- tests/integration/routes/meeting.day28.invitations-captured.postgres.integration.test.ts > Meetings day28-fixes FIX-4 — invitations, captured mode only (§F.3 pt 7) > captured mode records three delivery rows and never calls the mailer
- tests/integration/routes/meeting.day28.material-title.postgres.integration.test.ts > Meetings day28 C — materialTitle access resolution > does not disclose a meeting or material title across tenants
- tests/integration/routes/meeting.day28.material-title.postgres.integration.test.ts > Meetings day28 C — materialTitle access resolution > resolves N=4 notes sharing K=2 unique artifacts without changing their identities
- tests/integration/routes/meeting.day28.material-title.postgres.integration.test.ts > Meetings day28 C — materialTitle access resolution > returns an honest 404 with no title for a missing meeting
- tests/integration/routes/meeting.day28.material-title.postgres.integration.test.ts > Meetings day28 C — materialTitle access resolution > returns honest nulls for a note without materialization
- tests/integration/routes/meeting.day28.material-title.postgres.integration.test.ts > Meetings day28 C — materialTitle access resolution > returns null without dropping materialArtifactId after access is revoked
- tests/integration/routes/meeting.day28.material-title.postgres.integration.test.ts > Meetings day28 C — materialTitle access resolution > returns the real title when the caller owns the private artifact
- tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts > Meetings day28 A — occurrence IDs require an explicit time zone > accepts Z for scope=this and stores the exact occurrence instant
- tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts > Meetings day28 A — occurrence IDs require an explicit time zone > accepts an offset for scope=this_and_following and stores the UTC UNTIL
- tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts > Meetings day28 A — occurrence IDs require an explicit time zone > rejects a recurrenceRule UNTIL date-time without Z and preserves the series
- tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts > Meetings day28 A — occurrence IDs require an explicit time zone > rejects a zone-less DELETE scope=all without mutation or delivery
- tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts > Meetings day28 A — occurrence IDs require an explicit time zone > rejects a zone-less scope=this without adding an exception row
- tests/integration/routes/meeting.day28.occurrence-timezone.postgres.integration.test.ts > Meetings day28 A — occurrence IDs require an explicit time zone > rejects a zone-less split without changing the master rule
- tests/integration/routes/meeting.dec153.funnel-assignee.postgres.integration.test.ts > DEC-153 — funnel task assignee (meeting-note action item -> task)
- tests/integration/routes/meeting.decision-follow-up-records.postgres.integration.test.ts > D.4/D.5 Meeting decision-records + follow-up-records (real Postgres)
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > A. open > GF-02 fresh org opens to an honest empty list (200 + [])
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > A. open > GF-04 list returns created meetings ordered by start_at ascending
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > A. open > GF-05 projectId query filter narrows the list
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > A. open > GF-06 mirrors the closed MODULE_MEETING boundary after authentication
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > B. create > GF-07 create persists a row that a separate SQL read-back can see
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > B. create > GF-08 create round-trips agenda / attendees / pre-read arrays
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > B. create > GF-09 create without title is rejected 400 and writes nothing
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > B. create > GF-10 create without startAt is rejected 400
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > B. create > GF-11 missing endAt defaults to startAt (no null/undefined leaks into the row)
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > B. create > GF-12 create is org-stamped from the token, not from the request body
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > C. edit & save
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > D. fresh reopen
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > E. decisions & follow-ups
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > F. generate notes (main action)
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > G. status & roles
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > H. tenant isolation
- tests/integration/routes/meeting.m12-golden-flows.postgres.integration.test.ts > M12 Meeting — golden flows (real Postgres) > I. error handling > GF-48 a silently-swallowing write (trigger returns NULL) must not be reported as saved
- tests/integration/routes/meeting.materialization-retry-title.postgres.integration.test.ts > Meetings day28-fixes FIX-3 — retry materialTitle (instruction §C.4a) > retry on a note whose material is already registered still returns a null materialTitle (§C.4 errata, not a defect introduced here)
- tests/integration/routes/meeting.materialization-retry.postgres.integration.test.ts > Meetings day19-fixes FIX-4 — materialization retry precondition > retrying a REJECTED note materialization returns 409 and creates zero artifact rows
- tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts > Meetings day19-fixes FIX-1 — occurrence cancellation is real, not a dry CANCEL send > scope=all: the WHOLE series is marked cancelled in the DB before CANCEL is requested (was: silent no-op)
- tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts > Meetings day19-fixes FIX-1 — occurrence cancellation is real, not a dry CANCEL send > scope=this: real per-occurrence exception, DB changes before CANCEL is requested
- tests/integration/routes/meeting.occurrence-cancel.postgres.integration.test.ts > Meetings day19-fixes FIX-1 — occurrence cancellation is real, not a dry CANCEL send > scope=this_and_following: the split series is created ALREADY cancelled, not as a new active master
- tests/integration/routes/metrics.conversion-intelligence.no-stub.test.js > Metrics conversion intelligence (honest 503) > GET /api/metrics/conversion-intelligence returns 503
- tests/integration/routes/my-work-presence.contract.test.ts > my-work presence route contracts > degrades polling to an empty presence list when realtime is unavailable
- tests/integration/routes/my-work-presence.contract.test.ts > my-work presence route contracts > does not disclose presence for an idea outside the authenticated tenant
- tests/integration/routes/my-work-presence.contract.test.ts > my-work presence route contracts > reports a degraded broadcast without failing the primary collaboration flow
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > GET /api/my-work/decisions/preferences returns defaults when missing
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > GET /api/my-work/decisions/queue returns items with canRemind/lastRemindedAt
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > GET /api/my-work/decisions/queue?mode=snoozed uses snoozed-only filter
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > POST /api/my-work/decisions/:id/snooze returns 400 for invalid until
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > POST /api/my-work/decisions/:id/snooze returns 404 when decision is not relevant
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > POST /api/my-work/decisions/:id/snooze stores snooze when decision is relevant
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > POST /api/my-work/decisions/:id/unsnooze deletes snooze row
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > PUT /api/my-work/decisions/preferences returns 400 for non-object payload
- tests/integration/routes/my-work.decisions.routes.test.ts > My Work Decisions endpoints > PUT /api/my-work/decisions/preferences upserts preferences
- tests/integration/routes/my-work.home.fail-closed.contract.test.ts > my-work home fail-closed contract > returns coded 503 with correlation parity when Home v2 db is unavailable
- tests/integration/routes/notifications.escalations.authz.test.ts > Notifications escalations authz (no placeholder logic)
- tests/integration/routes/notifications.real.test.ts > Notifications routes (real DB) > GET /api/notifications returns only user notifications
- tests/integration/routes/notifications.real.test.ts > Notifications routes (real DB) > GET /api/notifications/counts returns unread counts
- tests/integration/routes/notifications.real.test.ts > Notifications routes (real DB) > PATCH /api/notifications/preferences updates and returns preferences
- tests/integration/routes/notifications.real.test.ts > Notifications routes (real DB) > POST /api/notifications/broadcast sends to org users for admin
- tests/integration/routes/organizationData.no-stubs.test.ts > Organization data routes (honest 503 when unavailable) > GET /api/organization-data/stats returns 503 with FEATURE_UNAVAILABLE
- tests/integration/routes/organizationData.no-stubs.test.ts > Organization data routes (honest 503 when unavailable) > POST /api/organization-data/export/all returns 503 with FEATURE_UNAVAILABLE
- tests/integration/routes/organizationData.no-stubs.test.ts > Organization data routes (honest 503 when unavailable) > POST /api/organization-data/export/users returns 503 with FEATURE_UNAVAILABLE
- tests/integration/routes/p21b-reports-template-artifactrun-e2e.sqlite.integration.test.ts > P21-B (sqlite) — 2 report templates via governed artifact-runs -> outputs library -> export audit > materializes two report templates and records export audit trace (no-web posture explicit)
- tests/integration/routes/pmoContext.test.js > PMO Context API > GET /api/pmo-context/:projectId > should include allowed actions for current phase
- tests/integration/routes/pmoContext.test.js > PMO Context API > GET /api/pmo-context/:projectId > should include system messages based on phase
- tests/integration/routes/pmoContext.test.js > PMO Context API > GET /api/pmo-context/:projectId > should return 404 for non-existent project
- tests/integration/routes/pmoContext.test.js > PMO Context API > GET /api/pmo-context/:projectId > should return PMO context with phase information
- tests/integration/routes/pmoContext.test.js > PMO Context API > GET /api/pmo-context/:projectId/task-labels > should return task labels with PMO relevance
- tests/integration/routes/presentations.autosave-conflict.route.test.ts > P0.4 — PUT /presentations/decks/:deckId/autosave version-conflict contract > no version header sent -> treated as "no conflict check", write proceeds -> 200
- tests/integration/routes/presentations.autosave-conflict.route.test.ts > P0.4 — PUT /presentations/decks/:deckId/autosave version-conflict contract > stale client version (behind server) -> 409 VERSION_CONFLICT with server/client version echoed
- tests/integration/routes/presentations.autosave-conflict.route.test.ts > P0.4 — PUT /presentations/decks/:deckId/autosave version-conflict contract > two interleaved writers that both read version=1 -> exactly ONE gets 200, the OTHER gets 409 (no lost update)
- tests/integration/routes/presentations.autosave-conflict.route.test.ts > P0.4 — PUT /presentations/decks/:deckId/autosave version-conflict contract > unknown deck id -> 404 (not a version conflict)
- tests/integration/routes/presentations.autosave-conflict.route.test.ts > P0.4 — PUT /presentations/decks/:deckId/autosave version-conflict contract > up-to-date client version (matches server) -> 200 and version is bumped by 1
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > 404 when the deck is not in the caller org
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > DELETE revokes a collaborator
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > FAIL-OPEN: degraded collaborator store returns soft 200 degraded:true (not 500)
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > GET lists active collaborators
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > POST 400 when neither email nor userId is provided
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > POST creates a collaborator row with the chosen role
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > POST maps a P3.1 { permission } to a role
- tests/integration/routes/presentations.collaborators.route.test.ts > P3.3 — /presentations/decks/:id/collaborators > invite requires the presentation_share capability (VIEWER → 403)
- tests/integration/routes/presentations.generate-deck-lock.route.test.ts > P0.3-b — POST /presentations/generate/deck concurrent-generation lock > deck already generating -> 409 PRESENTATION_GENERATION_IN_PROGRESS, generateDeck() not called
- tests/integration/routes/presentations.generate-deck-lock.route.test.ts > P0.3-b — POST /presentations/generate/deck concurrent-generation lock > draft deck -> lock acquired, generateDeck() runs, 200
- tests/integration/routes/presentations.generate-deck-lock.route.test.ts > P0.3-b — POST /presentations/generate/deck concurrent-generation lock > no deckId -> fails open, lock skipped, generateDeck() still invoked
- tests/integration/routes/presentations.generate-deck-lock.route.test.ts > P0.3-b — POST /presentations/generate/deck concurrent-generation lock > two concurrent POSTs on the same deckId -> exactly ONE gets 200, the OTHER gets 409; generateDeck() called exactly once
- tests/integration/routes/presentations.public-viewer-whitelist.route.test.ts > P0.4 — GET /presentations/shared/:token public viewer whitelist > response DOES contain the fields a public viewer needs (title + deck content)
- tests/integration/routes/presentations.public-viewer-whitelist.route.test.ts > P0.4 — GET /presentations/shared/:token public viewer whitelist > share mint -> viewer returns the canonical normalized deck payload
- tests/integration/routes/presentations.share-revoke-and-rate-limit.route.test.ts > P3.2 — DELETE /presentations/decks/:id/share requires presentation_share RBAC > OWNER (has presentation_share capability) -> revoke proceeds (200)
- tests/integration/routes/presentations.share-revoke-and-rate-limit.route.test.ts > P3.2 — DELETE /presentations/decks/:id/share requires presentation_share RBAC > same-org VIEWER (no presentation_share capability) -> 403 PERMISSION_DENIED, token untouched
- tests/integration/routes/presentations.share-revoke-and-rate-limit.route.test.ts > P3.2 — DELETE /presentations/decks/:id/share revokes the public link > revoked token 404s on the public viewer afterwards (anti-enumeration surface preserved)
- tests/integration/routes/presentations.share-revoke-and-rate-limit.route.test.ts > P3.2 — DELETE /presentations/decks/:id/share revokes the public link > revoking a foreign/unknown deck id -> 404, share_token left untouched
- tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts > M09-H02 — presentation_templates write honesty (real Postgres) > CLONE — read-back miss fails closed instead of reporting a created id
- tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts > M09-H02 — presentation_templates write honesty (real Postgres) > IDEMPOTENCY — a failed ack over a row that DID commit resolves as success
- tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts > M09-H02 — presentation_templates write honesty (real Postgres) > INSERT FAILURE — no success:true, no envelope rebuilt from memory, no row
- tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts > M09-H02 — presentation_templates write honesty (real Postgres) > READ-BACK FAILURE — statement reports success but persists nothing → fail closed
- tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts > M09-H02 — presentation_templates write honesty (real Postgres) > SUCCESS — plan persists a durable, org-owned row and reports it
- tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts > M09-H02 — presentation_templates write honesty (real Postgres) > TENANT — a foreign org cannot edit and is never told the edit succeeded
- tests/integration/routes/presentations.template-write-honesty.postgres.integration.test.ts > M09-H02 — presentation_templates write honesty (real Postgres) > UPDATE — the owning org still gets a real success, settled against the DB
- tests/integration/routes/projectMembers.compat.no-stubs.test.ts > Project members compat routes (no stub responses) > GET /api/project-members/:projectId returns 503 with FEATURE_UNAVAILABLE
- tests/integration/routes/rapidlean-routes.test.js > RapidLean Routes Integration > GET /api/rapidlean > should get rapidlean data or handle appropriately
- tests/integration/routes/report-builder.export-trace.routes.test.ts > report-builder export trace failure parity > records completed canonical export trace for cloud publish success
- tests/integration/routes/results-kpi-reports.l3.test.ts > Results KPI reports routes (L3)
- tests/integration/routes/roadmap.test.js > Integration Test: Roadmap Routes > GET /api/roadmap/:projectId/summary > should return roadmap summary
- tests/integration/routes/roadmap.test.js > Integration Test: Roadmap Routes > GET /api/roadmap/:projectId/waves > should return project waves
- tests/integration/routes/roadmap.test.js > Integration Test: Roadmap Routes > POST /api/roadmap/:projectId/waves > should create a new wave or return appropriate status
- tests/integration/routes/roadmap.test.js > Integration Test: Roadmap Routes > PUT /api/roadmap/:projectId/baseline > should update roadmap baseline or return appropriate status
- tests/integration/routes/security.l3.test.ts > Security routes integration (L3)
- tests/integration/routes/signals.feed.postgres.integration.test.ts > GET /api/signals canonical Postgres feed > returns an honest empty list
- tests/integration/routes/stabilization.l3.test.ts > Stabilization routes integration (L3) > GET /health-history returns rows ordered by date DESC and limited to 30
- tests/integration/routes/stabilization.l3.test.ts > Stabilization routes integration (L3) > GET /status reports database tables=0 when DB status query returns null
- tests/integration/routes/stabilization.l3.test.ts > Stabilization routes integration (L3) > GET /status returns 403 when no token provided (verifySuperAdmin)
- tests/integration/routes/status-reports.l3.test.ts > Status reports routes integration (L3) > DELETE /:id deletes a report
- tests/integration/routes/status-reports.l3.test.ts > Status reports routes integration (L3) > DELETE /:id returns success even when table is missing (DbPromise run fallback)
- tests/integration/routes/status.l3.test.ts > Status routes integration (L3) > GET / returns project rows with open_tasks count
- tests/integration/routes/status.l3.test.ts > Status routes integration (L3) > GET /overview returns counts and avg_progress for org projects
- tests/integration/routes/stubbed-legacy-routes.no-501.test.ts > Legacy stubbed routes (no 501 placeholders) > GET /api/benchmark returns 503 (not 501)
- tests/integration/routes/stubbed-legacy-routes.no-501.test.ts > Legacy stubbed routes (no 501 placeholders) > GET /api/feature-flags returns 503 (not 501)
- tests/integration/routes/stubbed-legacy-routes.no-501.test.ts > Legacy stubbed routes (no 501 placeholders) > GET /api/help-analytics returns 503 (not 501)
- tests/integration/routes/superadmin-customers.test.js > SuperAdmin Customers API > GET /api/superadmin/customers > should return customers list for superadmin
- tests/integration/routes/superadmin-overview.test.js > SuperAdmin Overview API - Production Ready > GET /api/metrics/attribution > returns attribution channels
- tests/integration/routes/superadmin-overview.test.js > SuperAdmin Overview API - Production Ready > GET /api/metrics/funnels > returns funnel metrics
- tests/integration/routes/superadmin-overview.test.js > SuperAdmin Overview API - Production Ready > GET /api/metrics/help > returns help effectiveness metrics
- tests/integration/routes/superadmin-overview.test.js > SuperAdmin Overview API - Production Ready > GET /api/metrics/partners > returns partner leaderboard
- tests/integration/routes/superadmin-overview.test.js > SuperAdmin Overview API - Production Ready > GET /api/metrics/warnings > returns warnings array
- tests/integration/routes/system-health.l3.test.ts > System health routes integration (L3) > GET / returns 200 with health payload when service responds
- tests/integration/routes/system-health.l3.test.ts > System health routes integration (L3) > GET / returns 500 when service throws
- tests/integration/routes/system-health.l3.test.ts > System health routes integration (L3) > GET / returns 503 when SystemHealthService is missing getDetailedHealth
- tests/integration/routes/system-health.l3.test.ts > System health routes integration (L3) > GET /detailed returns 403 when no token provided
- tests/integration/routes/table-platform.sheet-artifact.sqlite.integration.test.ts [ tests/integration/routes/table-platform.sheet-artifact.sqlite.integration.test.ts ]
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 1: Strategic (dynamic-swot) > allows FINALIZED when all missing items are resolved
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 1: Strategic (dynamic-swot) > blocks FINALIZED when any missing item remains unresolved
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 1: Strategic (dynamic-swot) > blocks FINALIZED when unresolved blockers exist
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 1: Strategic (dynamic-swot) > creates a new tool session in DRAFT status
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 1: Strategic (dynamic-swot) > persists wizard state and missing items
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 1: Strategic (dynamic-swot) > rejects invalid status transitions
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 1: Strategic (dynamic-swot) > transitions DRAFT → IN_PROGRESS with wizard state
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 2: Operational (sop-builder) > creates an operational tool session
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Archetype 2: Operational (sop-builder) > full lifecycle: DRAFT → IN_PROGRESS → REVIEW → back to DRAFT → REVIEW
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Failure state + retry > creates session and transitions to FAILED
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Failure state + retry > persists failure reason
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Failure state + retry > rejects retry when not in FAILED state
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Failure state + retry > retries from FAILED → IN_PROGRESS
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Failure state + retry > retry clears failure reason
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Promotion to downstream outputs > blocks promotion when unresolved missing items reappear
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Promotion to downstream outputs > promotes FINALIZED session to initiative idempotently with traceability
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Promotion to downstream outputs > promotes FINALIZED session to presentation
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Promotion to downstream outputs > promotes FINALIZED session to report with traceability
- tests/integration/routes/tools.p27.test.ts > P27-B: Tools Session → Result → Promotion > Promotion to downstream outputs > rejects promotion for non-approved session
- tests/integration/routes/v8.execution.routes.test.ts > Execution Routes (/api/v8/execution) > lists active runs through the governed execution route
- tests/integration/routes/v8.finance-value.test.ts > V8 Finance — Value Tracking cluster wiring (M16) > capture gates (valueCapturePipelineService) > POST /capture/gates creates a gate record
- tests/integration/routes/v8.finance-value.test.ts > V8 Finance — Value Tracking cluster wiring (M16) > capture gates (valueCapturePipelineService) > POST /capture/gates rejects an invalid gate label
- tests/integration/routes/v8.finance-value.test.ts > V8 Finance — Value Tracking cluster wiring (M16) > capture gates (valueCapturePipelineService) > POST /capture/gates/:id/advance 404s when the gate is not found
- tests/integration/routes/v8.finance-value.test.ts > V8 Finance — Value Tracking cluster wiring (M16) > capture gates (valueCapturePipelineService) > POST /capture/gates/:id/advance advances when criteria met + signed off
- tests/integration/routes/v8.finance-value.test.ts > V8 Finance — Value Tracking cluster wiring (M16) > ledger (valueLedgerService) > POST /ledger/baselines 400s when initiativeId/kpiId missing
- tests/integration/routes/v8.finance-value.test.ts > V8 Finance — Value Tracking cluster wiring (M16) > ledger (valueLedgerService) > POST /ledger/baselines freezes a new active baseline
- tests/integration/routes/v8.finance-value.test.ts > V8 Finance — Value Tracking cluster wiring (M16) > ledger (valueLedgerService) > POST /ledger/entries appends a correction entry
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /deviation-cases/:caseId/rca-suggest -> deviationRcaSuggestService.{suggestRca,suggestActions} > 404s when the deviation case is not owned by the caller org
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /deviation-cases/:caseId/rca-suggest -> deviationRcaSuggestService.{suggestRca,suggestActions} > derives signals from stored data and returns hypotheses + actions
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /deviation-cases/:caseId/rca-suggest -> deviationRcaSuggestService.{suggestRca,suggestActions} > is permission-gated by manage_deviation (viewer role is rejected)
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /deviation-cases/:caseId/rca-suggest -> deviationRcaSuggestService.{suggestRca,suggestActions} > lets the caller override non-derivable judgment signals via query string
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /kpis/:kpiId/anomalies -> kpiAnomalyService.detectAnomalies > 404s when the KPI is not owned by the caller org
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /kpis/:kpiId/anomalies -> kpiAnomalyService.detectAnomalies > detects an outlier in the recorded time-series and reports it org-scoped
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /kpis/:kpiId/forecast -> kpiForecastService.{linearTrend,projectToTarget,leadingAlert} > 404s when the KPI is not owned by the caller org
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /kpis/:kpiId/forecast -> kpiForecastService.{linearTrend,projectToTarget,leadingAlert} > omits projection/alert when the KPI has no target configured
- tests/integration/routes/v8.results.orphan-engines-wiring.test.ts > V8 Results — orphaned engine wiring > GET /kpis/:kpiId/forecast -> kpiForecastService.{linearTrend,projectToTarget,leadingAlert} > projects a rising trend onto the target and reports willHitTarget
- tests/integration/routes/verify.l3.test.ts > Verify routes integration (L3)
- tests/integration/routes/wordy-p22.pipeline.test.ts > P22 Wordy — document artifact pipeline (sqlite integration) > cleans up ghost artifacts on materialization failure and allows retry
- tests/integration/routes/wordy-p22.pipeline.test.ts > P22 Wordy — document artifact pipeline (sqlite integration) > runs full pipeline: create → accept → materialize with report config
- tests/integration/routes/work-canvas.routes.test.ts > work canvas routes > enforces proposal requiredCapability before approving (effective access — SEC-M02-3)
- tests/integration/routes/work-canvas.routes.test.ts > work canvas routes > exports heavy Canvas formats through adapter-backed responses
- tests/integration/routes/workbook.golden-roundtrip.sqlite.integration.test.ts [ tests/integration/routes/workbook.golden-roundtrip.sqlite.integration.test.ts ]
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > getArtifactForUser hides private artifacts from non-owners
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > listArtifactsForUser applies outputType filter against persisted rows
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > listArtifactsForUser applies sourceInitiativeId filter against persisted rows
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > listArtifactsForUser includes sheet artifacts when outputType filter is sheet
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > listMyWorkArtifacts builds mine and review lanes from dedicated filtered queries
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > materializeArtifactRun completes a presentation run and links the canonical artifact
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > materializeArtifactRun completes a report run and links the canonical artifact
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > materializeArtifactRun completes a sheet run into the canonical registry when config.tableId is provided
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > project visibility requires tenant-scoped project membership
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > registerArtifactOrigin persists artifact and origin link for report runtime
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > registerGovernedTableSheetArtifact persists sheet output_type and origin link for tp_tables id
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > registerGovernedTableSheetArtifact refreshes metadata when origin already exists (idempotent)
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > retryArtifactRun persists retry lineage and returns a fresh planned run (spine mocked)
- tests/integration/services/artifactRegistryService.sqlite.integration.test.ts > artifactRegistryService (sqlite-backed integration) > surfaces review/apply lifecycle status and retry history without mutating persisted run rows
- tests/integration/services/assessment.day36.demoSeedContract.postgres.integration.test.ts > Day 36 Metalpol seed contract — real PostgreSQL
- tests/integration/settings/account-deletion-lifecycle.pg.test.ts > SET-MVP-DELETE-001 approved request/cancel/status lifecycle
- tests/integration/settings/day55.owner-operations.realdb.test.ts > Day 55 D.1 — four owner operations survive an independent reload
- tests/integration/settings/day55.password-change.realdb.test.ts > Day 55 A.2 — password change through the real ApiGateway
- tests/integration/settings/day55.personal-settings-no-membership.realdb.test.ts > Day 55 adversarial B2 — personal settings without organization membership
- tests/integration/settings/day55.route-reachability.realdb.test.ts > Day 55 B.1 — real HTTP reachability inventory
- tests/integration/settings/gdpr-settings-no-stubs.test.ts > Settings/GDPR routes (no stub responses)
- tests/integration/settings/integration-oauth-approval.test.ts > POST /api/settings/integrations/:provider/connect — OAuth approval gate (real PostgreSQL)
- tests/integration/settings/settings-cold-session.realdb.test.ts > SET-BVP-001 settings persistence across a cold session (real PostgreSQL)
- tests/integration/stage-gates.tenant-isolation.realdb.test.ts > Stage gates — tenant isolation + honest-failure regression against a real Postgres database (no mocks)
- tests/integration/superadmin-operator-plane.test.ts > Superadmin operator plane > GET /operator/policy-enforcement exposes drift summary
- tests/integration/system/healthRoutes.ping-health-live.test.ts > HealthRoutes (REAL integration) > GET /api/health returns base health payload
- tests/integration/teresa/teresaKernel.realdb.test.ts [ tests/integration/teresa/teresaKernel.realdb.test.ts ]
- tests/integration/test-support/testSupportRoutes.test.ts > Test-support routes > bootstrap creates tenant, returns token, and cleanup purges org-scoped rows
- tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts [ tests/integration/tls-007-swot-candidate-handoff.realdb.test.ts ]
- tests/integration/tool-sessions-cas.realdb.test.ts [ tests/integration/tool-sessions-cas.realdb.test.ts ]
- tests/integration/toolSessionHttpAdapter.realdb.test.ts [ tests/integration/toolSessionHttpAdapter.realdb.test.ts ]
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'architecture-capability' ('capability-mapper') > drives a real session to promotion and persists it on real Postgres (capability-mapper)
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'causal-problem-solving' ('a3-problem-solving') > drives a real session to promotion and persists it on real Postgres (a3-problem-solving)
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'decision-matrix-portfolio' ('portfolio-priority') > drives a real session to promotion and persists it on real Postgres (portfolio-priority)
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'discovery-candidate-funnel' ('ai-discovery') > drives a real session to promotion and persists it on real Postgres (ai-discovery)
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'flow-value-stream' ('value-chain') > drives a real session to promotion and persists it on real Postgres (value-chain)
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'force-radial' ('market-forces') > drives a real session to promotion and persists it on real Postgres (market-forces)
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'operating-model-standard' ('sop-builder') > drives a real session to promotion and persists it on real Postgres (sop-builder)
- tests/integration/tools-archetype-promote-characterization.realdb.test.ts > G4 archetype characterization — 'quadrant-strategic-field' ('growth-paths') > drives a real session to promotion and persists it on real Postgres (growth-paths)
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > DoD gate blocks review while completion/confidence are below threshold
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > a wizard-style PARTIAL save must NOT wipe answers/context/DoD metrics
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > approval froze an immutable answers snapshot for the report trail
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > completes DoD, passes review and approval
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > creates a SWOT tool session (DRAFT)
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > locks content edits after approval
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > refuses promotion when the harness cannot persist a canonical tool output
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > repeated promotion without persistence remains a refusal with zero ledger rows
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > resume is fail-soft on a corrupt answers blob (no 500 / white screen)
- tests/integration/tools/tool-session-roundtrip.contract.test.ts > H3 tool session round-trip (create → save → resume → output) > saves answers + context + DoD metrics (full save)
- tests/integration/transactions.test.js > Transaction Integrity > Atomic Operations > should rollback on foreign key violation
- tests/integration/transactions.test.js > Transaction Integrity > Cascade Deletes > should cascade delete tasks when project is deleted
- tests/integration/transactions/transaction-integrity-integration.test.ts > L3: Transaction Integrity Integration > Concurrent Transaction Handling > should handle concurrent updates with optimistic locking
- tests/integration/transactions/transaction-integrity-integration.test.ts > L3: Transaction Integrity Integration > Multi-Service Transaction Commit Coordination > should maintain referential integrity across tables
- tests/integration/transactions/transaction-integrity-integration.test.ts > L3: Transaction Integrity Integration > Transaction Rollback Scenarios > should rollback transaction on validation error
- tests/integration/trialDemoIntegration.test.ts > Trial routes contract > POST /:trialId/convert returns 403 when token is missing
- tests/integration/user/user-stubbed-routes.no-501.test.ts > User/report stubbed routes (no 501 placeholders) > GET /api/user/profile-completeness returns 503 (not 501)
- tests/integration/videos/videos.routes.test.ts > Videos routes (REAL integration) > DELETE /api/videos/:id deletes a video
- tests/integration/videos/videos.routes.test.ts > Videos routes (REAL integration) > GET /api/videos supports category/status filters
- tests/integration/videos/videos.routes.test.ts > Videos routes (REAL integration) > POST /api/videos creates a video
- tests/integration/videos/videos.routes.test.ts > Videos routes (REAL integration) > POST /api/videos validates title/url
- tests/integration/voice/voice.tts-unavailable.test.ts > Voice routes (unavailable is explicit) > POST /api/voice/tts returns 503 when TTS is not configured (no 500)
- tests/integration/webhooks-events-superadmin.realpg.test.ts > GET /api/webhooks/events — superadmin-only fix (REAL router, REAL PG)
- tests/integration/workflow_scenarios.test.ts > Workflow Scenarios (gatePolicy) - REAL_CODE > denies SUBMIT_INTERVIEW from submitted state (invalid state)
- tests/integration/workflows/assessment-workflow-integration.test.ts > L3: Assessment Workflow Integration > Error Handling and Edge Cases > should prevent unauthorized access to assessment
- tests/integration/workflows/assessment-workflow-integration.test.ts > L3: Assessment Workflow Integration > Error Handling and Edge Cases > should reject assessment creation with invalid data
- tests/integration/workflows/decision-management-integration.test.ts > L3: Decision Management Integration > Error Handling and Edge Cases > should handle concurrent approval attempts
- tests/integration/workflows/decision-management-integration.test.ts > L3: Decision Management Integration > Error Handling and Edge Cases > should prevent unauthorized approval
- tests/integration/workflows/decision-management-integration.test.ts > L3: Decision Management Integration > Error Handling and Edge Cases > should reject decision creation with invalid data

### Pełne nazwy czerwonych pozycji — acceptance

- tests/acceptance/agent-audit.e2e.test.ts > Acceptance HP-2 · Agent Audit (real router + auth + generic agentRuntime + DB) > runs the audit agent end-to-end (1 agent, smallest sensible wave) via generic agentRuntime, persists the run, and reads it back
- tests/acceptance/aiExecutiveReporting.e2e.test.ts > Acceptance: AI-enhanced executive report (real runtime, real LLM) > odbior--t7b3--aiExecutiveReporting.generateReport() genuinely transforms a grounded summary
- tests/acceptance/chat-005-proposal-approval-audit.realdb.test.ts > CHAT-05 — proposal, approval, execution and durable audit > does not write before approval, executes once, and survives a fresh read
- tests/acceptance/chat-007-009-owner-handoff-reopen.realdb.test.ts > CHAT-07/08/09 — owner handoff, durable receipt and reopen > creates one canonical initiative, persists its receipt, and reopens it after retry
- tests/acceptance/h1-chain.e2e.test.ts > H1.3 — Assessment completion auto-creates DRAFT initiatives (real runtime) > is idempotent — re-completing does not double-create
- tests/acceptance/h1-chain.e2e.test.ts > H1.3 — Assessment completion auto-creates DRAFT initiatives (real runtime) > materializes DRAFT initiatives from recommendations, linked + back-referenced
- tests/acceptance/h1-chain.e2e.test.ts > H1.5 — Idea→Initiative convert records origin back-reference (real runtime) > converts an idea and sets created_from=idea on the initiative
- tests/acceptance/harvard-collab-batch1.e2e.test.ts > A-KOL-1 — Table (Ideas / Table Platform): Socket.IO presence, comments, unlocked cell relay > presence READ: two real socket.io clients joining the same table room see each other via presence:update
- tests/acceptance/harvey.e2e.test.ts > Acceptance HARVEY · Agent HP-4 (real router + auth + planner + DB) > PAUSES at the approval gate on a SIDE_EFFECT step and records approval via the real router
- tests/acceptance/harvey.e2e.test.ts > Acceptance HARVEY · Agent HP-4 (real router + auth + planner + DB) > claims a plan atomically so concurrent deliveries execute each step once
- tests/acceptance/harvey.e2e.test.ts > Acceptance HARVEY · Agent HP-4 (real router + auth + planner + DB) > creates a plan FROM A MANIFEST (PlanBuilder) and persists plan + steps in Postgres
- tests/acceptance/harvey.e2e.test.ts > Acceptance HARVEY · Agent HP-4 (real router + auth + planner + DB) > executes a side-effect-FREE plan end-to-end to "completed" in one run (executor + finalize path)
- tests/acceptance/harvey.e2e.test.ts > Acceptance HARVEY · Agent HP-4 (real router + auth + planner + DB) > plan reaches "completed" after approving the side-effect step (HP-4 gate fix)
- tests/acceptance/harvey.e2e.test.ts > Acceptance HARVEY · Agent HP-4 (real router + auth + planner + DB) > reliability: create → execute-to-gate → approval recorded succeeds 3/3 (functioning cycle)
- tests/acceptance/harvey.e2e.test.ts [ tests/acceptance/harvey.e2e.test.ts ]
- tests/acceptance/int-008-candidate-handoff.e2e.test.ts > INT-08 — interview candidate handoff (golden flow, idempotency, concurrency, rollback) > insight-finding path: preview -> approve (created) -> retry (idempotent), curated content only
- tests/acceptance/int-008-candidate-handoff.e2e.test.ts [ tests/acceptance/int-008-candidate-handoff.e2e.test.ts ]
- tests/acceptance/integrate--decision-initiative-block-gate.e2e.test.ts > Decision-driven Initiative BLOCK/UNBLOCK integration (real Postgres, real routers) > 3) approved blocker + current GO + no other blockers -> canonical UNBLOCK fires, EXECUTING, exactly +1/+1 audit rows, visible via GET /api/initiatives/:id and GET /api/execution/:projectId/summary
- tests/acceptance/integrate--decision-initiative-block-gate.e2e.test.ts > Decision-driven Initiative BLOCK/UNBLOCK integration (real Postgres, real routers) > 4) a second still-pending blocking decision prevents UNBLOCK even after the first blocker is approved; resolving BOTH unblocks
- tests/acceptance/interview-insight-generation-readback.e2e.test.ts > INT-07 — durable insight generation and reopen > generates from an approved source, persists completed content, reopens it, and hides it cross-tenant
- tests/acceptance/invoice-line-items.e2e.test.ts > InvoiceService — line_items JSON (db74b4dd66 forward-port)
- tests/acceptance/j21-oxford-o4.e2e.test.ts > J21 — Oxford O4.2-O4.7 real-runtime wiring
- tests/acceptance/mgmt-reports-red4.e2e.test.ts [ tests/acceptance/mgmt-reports-red4.e2e.test.ts ]
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-A concurrency: two executes produce one active owner and one side effect
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-B crash before tool: live lease blocks B, expired lease is reclaimed
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-C crash after tool: stable operation key lets an idempotent owner suppress replay
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-D stale-owner fencing: reclaimed worker wins and A cannot persist result
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-E heartbeat: renew blocks takeover and stale token cannot renew after reclaim
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-F durable read-back: approval actor, payload and result survive a new connection
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-G result-write failure: no terminal success and retry remains recoverable
- tests/acceptance/mw11-execution-lease.realdb.test.ts > MW-11 durable execution lease and fencing — real PostgreSQL > MW11-H ownership: member and cross-tenant fail closed; owner/admin policy remains explicit
- tests/acceptance/mw11-execution-lease.realdb.test.ts [ tests/acceptance/mw11-execution-lease.realdb.test.ts ]
- tests/acceptance/myw-agent-approved-materialization.realdb.test.ts > MYW-AGT mounted signed-JWT acceptance
- tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts > O1.8 — ADMA assessment completion auto-creates DRAFT initiatives (real runtime) > materializes DRAFT initiatives from ADMA recommendations, linked + back-referenced
- tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts > O1.8 — SIRI assessment completion auto-creates DRAFT initiatives (real runtime) > is idempotent — re-completing a SIRI run does not double-create
- tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts > O1.8 — SIRI assessment completion auto-creates DRAFT initiatives (real runtime) > materializes DRAFT initiatives from SIRI recommendations, linked + back-referenced
- tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts > O1.8 — keyFindings fallback source materializes initiatives (real runtime) > uses keyFindings when nextActions is empty
- tests/acceptance/o6-benchmark-financial.e2e.test.ts > O6.2/O6.3 — financial industry benchmark real-runtime wiring
- tests/acceptance/odbior--fin003a--statement-import.e2e.test.ts > FIN-003A financial statement XLSX import — real route and PostgreSQL
- tests/acceptance/odbior--fin005--multi-section-recovery.e2e.test.ts > FIN-005 multi-section recovery ('legacy')
- tests/acceptance/odbior--fin005--multi-section-recovery.e2e.test.ts > FIN-005 multi-section recovery ('v8')
- tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts > FIN-005 Blocker 4 — v8 XLSX/XLS extraction fails closed on a parse failure
- tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts > FIN-005 Fix 2 — upload-and-analyze idempotency + cleanup ('legacy')
- tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts > FIN-005 Fix 2 — upload-and-analyze idempotency + cleanup ('v8')
- tests/acceptance/odbior--fin005--statement-ingestion-golden-flow.e2e.test.ts > FIN-005 statement ingestion golden flow — real route and PostgreSQL
- tests/acceptance/odbior--fin005--statement-upload-tenant-isolation.e2e.test.ts > FIN-005 tenant isolation — upload-and-analyze ('legacy')
- tests/acceptance/odbior--fin005--statement-upload-tenant-isolation.e2e.test.ts > FIN-005 tenant isolation — upload-and-analyze ('v8')
- tests/acceptance/odbior--fin007--post-investment-actuals.e2e.test.ts > FIN-007 post-investment actuals round trip — real routes and PostgreSQL
- tests/acceptance/odbior--o4c--business-case-live.e2e.test.ts > O4-cluster · O4.1/O4.5 Business Case LIVE generation (real router + auth + LLM) > POST /api/v8/advisory/business-case generates a REAL business case (NPV/ROI + narrative + WACC resolution) — no mock LLM
- tests/acceptance/parity-3areas.e2e.test.ts > PARITY: BUSINESS CASE — /api/v8/advisory/business-case (real pipeline, real LLM) > runs the full 5-phase pipeline and returns a real numeric model (NPV/IRR/ROI)
- tests/acceptance/parity-3areas.e2e.test.ts > PARITY: TERESA — note treść-LLM (real service, real LLM, real DB) > generates a note whose persisted body is real LLM prose, not the intent fallback
- tests/acceptance/red-admin-500s.e2e.test.ts [ tests/acceptance/red-admin-500s.e2e.test.ts ]
- tests/acceptance/red-assess-500s.e2e.test.ts > RED-ASSESS: finance-enterprise /api/finance-v4 > GET /api/finance-v4/budgets/00000000-0000-4000-8000-000000000000/variance-alerts
- tests/acceptance/red-sync-500s.e2e.test.ts > RED-SYNC schema-500 regressions (fixed) > write paths that depend on the new table/columns succeed
- tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts > RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 10 — the event log is complete and ordered: every tracked command has its event row + matching dispatched outbox row(s)
- tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts > RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 6 — a diverging actual snapshot opens exactly one reconciliation without mutating either side's authoritative source
- tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts > RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 7 — cold reopen: re-reading through materializeInboxItems/getInboxItems + listRoiFinance* confirms every earlier claim, nothing depended on in-memory state
- tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts > RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 8 — a second organization, run through the same dispatch, sees none of org A's inbox items/projections/reconciliations via the public paths
- tests/acceptance/rvn-cross-domain-gold-flow.e2e.test.ts > RN-G0 · cross-domain gold-flow (KPI + ROI + outbox as one product) > Step 9 — zero outbox rows for this suite's fixtures are left failed/dead_letter/parked, and zero CRITICAL alerts fired
- tests/acceptance/rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts > RN-G4 · Point 1+2 — ROI Benefit optional KPI evidence link + Finance projection creates no second source of truth > Step 3 — a finance_projection dispatch tick that projects a value AND opens a reconciliation never mutates any ROI source table (hash+count identical before/after)
- tests/acceptance/rvn-g4-roi-kpi-evidence-and-finance-truth.e2e.test.ts > RN-G4 · Point 1+2 — ROI Benefit optional KPI evidence link + Finance projection creates no second source of truth > Step 4 — cold reopen: every claim above still holds via fresh public-path reads, nothing depended on in-memory state
- tests/acceptance/t2-sla-flow.e2e.test.ts > T2 · FINDING — SLA sweep has no assignment_kind filter (also escalates artifact reviews)
- tests/acceptance/t2-sla-flow.e2e.test.ts > T2 · slaService.runSlaCheck — overdue approval_assignments escalates exactly once
- tests/acceptance/teresa-live-toolcall-tools.e2e.test.ts [ tests/acceptance/teresa-live-toolcall-tools.e2e.test.ts ]
- tests/acceptance/teresa-live-toolcall.e2e.test.ts [ tests/acceptance/teresa-live-toolcall.e2e.test.ts ]

### Pełne nazwy czerwonych pozycji — components

- tests/components/AIChat/AgentPlanPanel.readableLabels.test.tsx > AgentPlanPanel (warsztat) — czytelne nazwy etapów > krok bez toolInput.phase dostaje czytelną etykietę narzędzia zamiast snake_case
- tests/components/AIChat/AgentPlanPanel.readableLabels.test.tsx > AgentPlanPanel (warsztat) — czytelne nazwy etapów > schemat pokazuje toolInput.phase, a nazwa techniczna nie świeci jako snake_case
- tests/components/AIChat/Composer.singleBorder.guard.test.ts > Chat composer single-border guard (L-06) > EnhancedChatInput owns exactly one focus-border container (the composer frame)
- tests/components/AIChat/KimiWorkspace/PrezentacjeView.templateBrief.test.tsx > PrezentacjeView template intake > renders typed catalog controls, blocks missing required values and submits materialization values
- tests/components/AIChat/KimiWorkspace/PrezentacjeView.templateBrief.test.tsx > PrezentacjeView template intake > shows accessible brief before materialization and submits template lineage with facts
- tests/components/AIChat/UnifiedChatPanel.helpers.test.ts > UnifiedChatPanel helpers (L2) > builds localized Case links with encoded query values
- tests/components/AIChat/UnifiedChatPanel.helpers.test.ts > UnifiedChatPanel helpers (L2) > forces Deck Builder context to presentation even when the prompt contains workbook signals
- tests/components/AIChat/UnifiedChatPanel.helpers.test.ts > UnifiedChatPanel helpers (L2) > localizes transformation follow-up keys without hiding unknown fields
- tests/components/AIChat/UnifiedChatPanel.test.tsx > UnifiedChatPanel (L2) > does not render selected Canvas context chrome in the chat side
- tests/components/AIChat/UnifiedChatPanel.test.tsx > UnifiedChatPanel (L2) > opens a clean work panel from the chat header
- tests/components/AIChat/UnifiedChatPanel.test.tsx > UnifiedChatPanel (L2) > passes selected Canvas text to Teresa as the active Canvas context
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > autosaves persisted Markdown edits after debounce without manual save
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > captures Markdown selection without rendering selection chrome
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > keeps local edits visible when autosave hits a Canvas revision conflict
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > marks Markdown edits unsaved and saves through the draft API when possible
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > previews and applies a governed edit for selected Canvas text
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > remembers the last Document or MD view mode
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > restores a version while preserving the active draft context
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > switches between document and Markdown views from the same source
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > turns selected Canvas text into native artifact blocks
- tests/components/AIChat/WorkCanvasDocumentPanel.test.tsx > WorkCanvasDocumentPanel > uses writing shortcuts to draft replacement Markdown without bypassing preview
- tests/components/Admin/AdminHealthPanel.test.tsx > AdminHealthPanel > does not present unknown probe metrics as truth after load failure and supports retry
- tests/components/Admin/AdminHealthPanel.test.tsx > AdminHealthPanel > loads and renders each probe with its module + title
- tests/components/Admin/AdminHealthPanel.test.tsx > AdminHealthPanel > re-runs a single probe from its row action
- tests/components/Admin/AdminHealthPanel.test.tsx > AdminHealthPanel > runs all probes when "Run all" is clicked
- tests/components/Admin/AdminHealthPanel.test.tsx > AdminHealthPanel > shows the production-safe banner and disables run when env is not allowed
- tests/components/Admin/AdminHealthPanel.test.tsx > AdminHealthPanel > surfaces the error message for a failing probe
- tests/components/Admin/AdminMembersRolesPanel.test.tsx > AdminMembersRolesPanel — Add member (H2.11) > POSTs a valid email, refreshes members, and shows a success notice
- tests/components/Admin/AdminMembersRolesPanel.test.tsx > AdminMembersRolesPanel — Add member (H2.11) > blocks empty email with a visible inline error and does not POST
- tests/components/Admin/AdminMembersRolesPanel.test.tsx > AdminMembersRolesPanel — Add member (H2.11) > blocks malformed email with a visible inline error and does not POST
- tests/components/Admin/AdminMembersRolesPanel.test.tsx > AdminMembersRolesPanel — Add member (H2.11) > does not silently no-op for a non-manager: shows an explicit denial
- tests/components/Admin/AdminMembersRolesPanel.test.tsx > AdminMembersRolesPanel — Add member (H2.11) > surfaces a server USER_NOT_FOUND failure as a visible, actionable error
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "approved" pill for artifactType=decision
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "approved" pill for artifactType=deck
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "approved" pill for artifactType=initiative
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "approved" pill for artifactType=insight
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "approved" pill for artifactType=report
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "draft" pill + Submit action for artifactType=decision
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "draft" pill + Submit action for artifactType=deck
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "draft" pill + Submit action for artifactType=initiative
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "draft" pill + Submit action for artifactType=insight
- tests/components/ArtifactApprovalStatusBar.5types.test.tsx > ArtifactApprovalStatusBar — 5/5 wired artifact types render the state pill > renders the "draft" pill + Submit action for artifactType=report
- tests/components/Audit/AuditsHub.list-dashboard.test.tsx > AuditsHub — lista + dashboard (T6) > calls deleteProgram and reloads list on confirm delete
- tests/components/Audit/AuditsHub.list-dashboard.test.tsx > AuditsHub — lista + dashboard (T6) > selects a program by clicking its row — dashboard preview appears
- tests/components/Audit/AuditsHub.list-dashboard.test.tsx > AuditsHub — lista + dashboard (T6) > shows "surveys generated" badge when surveysGenerated=true
- tests/components/Audit/AuditsHub.list-dashboard.test.tsx > AuditsHub — lista + dashboard (T6) > shows empty state when no programs
- tests/components/Audit/AuditsHub.list-dashboard.test.tsx > AuditsHub — lista + dashboard (T6) > shows template and assignee counts per program
- tests/components/DocumentStudio/DocumentStudioContentBlocksPanel.test.tsx > Document Studio content blocks panel (B2) > exposes the library tool in the right rail and lists matching blocks
- tests/components/DocumentStudio/DocumentStudioContentBlocksPanel.test.tsx > Document Studio content blocks panel (B2) > inserts a block into the selected section and propagates the refreshed schema
- tests/components/DocumentStudio/DocumentStudioContentBlocksPanel.test.tsx > Document Studio content blocks panel (B2) > previews an instantiated block without mutating the document
- tests/components/DocumentStudio/DocumentStudioContentBlocksPanel.test.tsx > Document Studio content blocks panel (B2) > renders the empty state when no blocks match the document
- tests/components/DocumentStudio/DocumentStudioContentBlocksPanel.test.tsx > Document Studio content blocks panel (B2) > surfaces a load failure as an inline error
- tests/components/DocumentStudio/DocumentStudioQaPanel.navigation.test.tsx > DocumentStudioQaPanel finding navigation > exposes a keyboard-accessible action that hands the exact finding to the canvas
- tests/components/DocumentStudio/TransformativeConfirmDialog.focusReturn.test.tsx [ tests/components/DocumentStudio/TransformativeConfirmDialog.focusReturn.test.tsx ]
- tests/components/DocumentStudio/TransformativeConfirmDialog.test.tsx [ tests/components/DocumentStudio/TransformativeConfirmDialog.test.tsx ]
- tests/components/DocumentStudio/blocks/DocChartBlock.test.tsx > DocChartBlock > renders a pie chart and aggregates >5 slices into "Inne"
- tests/components/DriverPlannerPanel.test.tsx > DriverPlannerPanel — render > renders an empty state for a tree with no usable drivers
- tests/components/DriverPlannerPanel.test.tsx > DriverPlannerPanel — render > renders header, driver tree and what-if result with the default SaaS example
- tests/components/Economics/useFinanceData.v8-analyses.test.tsx > useFinanceData V8 analyses seam > keeps budget list reads on the same legacy family as budget writes
- tests/components/Economics/useFinanceData.v8-analyses.test.tsx > useFinanceData V8 analyses seam > keeps legacy budget payloads as the single source of truth for prediction budgets
- tests/components/Economics/useFinanceData.v8-analyses.test.tsx > useFinanceData V8 analyses seam > keeps valuation list reads on the same legacy family as valuation writes
- tests/components/Economics/useFinanceData.v8-analyses.test.tsx > useFinanceData V8 analyses seam > returns an empty valuation list when the legacy valuation payload lacks valuations
- tests/components/Execution/MitigationPanel.test.tsx > MitigationPanel (L2) > does not silently fall back to legacy on transient V8 failures
- tests/components/Execution/MitigationPanel.test.tsx > MitigationPanel (L2) > falls back to legacy mitigation update only for bounded unsupported statuses
- tests/components/Execution/MitigationPanel.test.tsx > MitigationPanel (L2) > marks as saved on success, tracks funnel event and calls onSaved
- tests/components/Execution/MitigationPanel.test.tsx > MitigationPanel (L2) > recovers from legacy fallback throwing and re-enables save
- tests/components/Execution/MitigationPanel.test.tsx > MitigationPanel (L2) > sends V8 mitigation payload with only non-empty fields in body
- tests/components/Finance/DriverPlannerPanelM16.test.tsx > DriverPlannerPanel — epic F5 (Driver Planner + What-If) > renders at least one range input (slider) for leaf drivers
- tests/components/Finance/DriverPlannerPanelM16.test.tsx > DriverPlannerPanel — epic F5 (Driver Planner + What-If) > renders default SaaS tree (Przychód / Klienci / ARPU labels) when no prop given
- tests/components/Finance/DriverPlannerPanelM16.test.tsx > DriverPlannerPanel — epic F5 (Driver Planner + What-If) > shows computed root value in the whatif result output area
- tests/components/Finance/FinancialStatementImportWizard.fin005-csv-reachability.test.tsx > FinancialStatementImportWizard — FIN-005 CSV real-screen reachability (drag-and-drop path) > a .csv file dropped onto the real dropzone is ACCEPTED (no "unsupported format" error) — this is what was broken before FIN-005
- tests/components/Finance/FinancialStatementImportWizard.fin005-csv-reachability.test.tsx > FinancialStatementImportWizard — FIN-005 CSV real-screen reachability (drag-and-drop path) > a CSV dropped via the real dropzone completes the full golden flow through to confirm — proves the fix is not cosmetic
- tests/components/Finance/FinancialStatementImportWizard.fin005-csv-reachability.test.tsx > FinancialStatementImportWizard — FIN-005 CSV real-screen reachability (drag-and-drop path) > an actually-unsupported extension is still rejected through the same dropzone — this is not "accept everything now"
- tests/components/Finance/FinancialStatementImportWizard.fin005-csv-reachability.test.tsx > FinancialStatementImportWizard — FIN-005 CSV real-screen reachability (drag-and-drop path) > the hidden file input's accept attribute includes .csv (native file-picker reachability, not just drag-and-drop)
- tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx > FinancialStatementWorkspace V8 read seam > falls back to legacy confirm action in the workspace on bounded compatibility statuses
- tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx > FinancialStatementWorkspace V8 read seam > falls back to legacy extract/map actions in retry recovery on bounded compatibility statuses
- tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx > FinancialStatementWorkspace V8 read seam > falls back to legacy values save in the workspace on bounded compatibility statuses
- tests/components/Finance/FinancialStatementWorkspace.v8-read-seam.test.tsx > FinancialStatementWorkspace V8 read seam > prefers governed confirm action before legacy fallback in the workspace
- tests/components/Finance/ValuationVisualsPanelM16.test.tsx > ValuationVisualsPanel — epic F1/F4 (Football Field + Sensitivity + Tornado) > renders empty state when valuation is null
- tests/components/Finance/ValuationVisualsPanelM16.test.tsx > ValuationVisualsPanel — epic F1/F4 (Football Field + Sensitivity + Tornado) > renders empty state when valuation is undefined
- tests/components/Initiatives/CandidatesPanel.receipt.test.tsx [ tests/components/Initiatives/CandidatesPanel.receipt.test.tsx ]
- tests/components/Initiatives/CandidatesTable.t28.test.tsx [ tests/components/Initiatives/CandidatesTable.t28.test.tsx ]
- tests/components/Initiatives/InitiativeCharterWizard.b3-hints.test.tsx > InitiativeCharterWizard — §B3 hints > coalesces rapid edits into a single validation of the final value
- tests/components/Initiatives/InitiativeCharterWizard.b3-hints.test.tsx > InitiativeCharterWizard — §B3 hints > does not validate when the thesis is shorter than 8 chars
- tests/components/Initiatives/InitiativeCharterWizard.b3-hints.test.tsx > InitiativeCharterWizard — §B3 hints > validates the thesis after debounce and renders amber hints
- tests/components/Initiatives/InitiativeCharterWizard.dedup.test.tsx > InitiativeCharterWizard — C1 dedup > checks for similar initiatives after debounce and renders the amber box
- tests/components/Initiatives/InitiativeCharterWizard.dedup.test.tsx > InitiativeCharterWizard — C1 dedup > coalesces rapid edits into a single check of the final value
- tests/components/Initiatives/InitiativeCharterWizard.dedup.test.tsx > InitiativeCharterWizard — C1 dedup > does not check when the title is shorter than 4 chars
- tests/components/Initiatives/InitiativeCharterWizard.dedup.test.tsx > InitiativeCharterWizard — C1 dedup > renders no box when no similar initiatives are returned
- tests/components/Initiatives/InitiativeGantt.drag-reschedule.test.tsx > InitiativeGantt — drag-reschedule (W5) > persists a task drag via PUT /api/pmo/tasks/:id and calls onReschedule
- tests/components/Initiatives/InitiativeGantt.features.test.tsx > InitiativeGantt — V1 features > highlights critical-path bars with a ring + title marker
- tests/components/Initiatives/InitiativeGantt.render.test.tsx > InitiativeGantt — render (V1) > renders a task bar with the task colour class and the title text
- tests/components/Initiatives/InitiativeGantt.render.test.tsx > InitiativeGantt — render (V1) > shows the "today" marker when now falls inside the rendered range
- tests/components/Initiatives/InitiativeGantt.rollback.test.tsx > InitiativeGantt — drag rollback (W5) > reverts the bar and does NOT call onReschedule when the PUT rejects
- tests/components/Initiatives/InitiativeObservabilityPanel.test.tsx [ tests/components/Initiatives/InitiativeObservabilityPanel.test.tsx ]
- tests/components/Initiatives/InitiativeObservabilityTable.t27.test.tsx [ tests/components/Initiatives/InitiativeObservabilityTable.t27.test.tsx ]
- tests/components/Initiatives/InitiativesGoalsTable.t30.test.tsx [ tests/components/Initiatives/InitiativesGoalsTable.t30.test.tsx ]
- tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts > R11 InitiativesHub wiring — source anchors > CandidatesPanel component import dropped (type-only reuse for AcceptCandidatePayload) — no unused import
- tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts > R11 InitiativesHub wiring — source anchors > T25 preserved: buildInitiativePreviewDetails import and both usage sites intact
- tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts > R11 InitiativesHub wiring — source anchors > imports all three new canonical tables
- tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts > R11 InitiativesHub wiring — source anchors > mounts CandidatesTable (not the retired CandidatesPanel) under activeTab==="candidates"
- tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts > R11 InitiativesHub wiring — source anchors > mounts InitiativeObservabilityTable + preserved InitiativeObservabilityPanel dashboard under activeTab==="observability"
- tests/components/Initiatives/InitiativesHub.r11-wiring.source-anchor.test.ts > R11 InitiativesHub wiring — source anchors > mounts PortfolioHealthTable + preserved PortfolioHealthView dashboard under activeTab==="portfolioHealth"
- tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts > T30 InitiativesHub wiring — source anchors > declares the Goals tab entry in the tabs array
- tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts > T30 InitiativesHub wiring — source anchors > excludes the goals tab from table/kanban/timeline/grid view modes
- tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts > T30 InitiativesHub wiring — source anchors > imports InitiativesGoalsTable and mounts it on activeTab==="goals"
- tests/components/Initiatives/InitiativesHub.t30-wiring.source-anchor.test.ts > T30 — R11/R24 (T25) wiring preserved byte-for-byte > R11 T27/T28/T29 mounts and T25 buildInitiativePreviewDetails wiring are unchanged
- tests/components/Initiatives/PortfolioAnalysisTable.t26.test.tsx [ tests/components/Initiatives/PortfolioAnalysisTable.t26.test.tsx ]
- tests/components/Initiatives/PortfolioAnalysisView.r13-wiring.source-anchor.test.ts [ tests/components/Initiatives/PortfolioAnalysisView.r13-wiring.source-anchor.test.ts ]
- tests/components/Initiatives/PortfolioHealthTable.t29.test.tsx [ tests/components/Initiatives/PortfolioHealthTable.t29.test.tsx ]
- tests/components/MyWork/CalendarCreateEventModal.test.tsx > CalendarCreateEventModal > creates a task-backed calendar event and notifies the host callbacks
- tests/components/MyWork/IdeaMapWorkspace.preferredTool-regression.test.tsx > IdeaMapWorkspace — P0-5 preferredTool corruption regression > ASSERCJA A: Idea preferredTool=table otwarta z listy (brak sluga w URL, czysty localStorage) renderuje się jako Table, NIE jako Mind Map
- tests/components/MyWork/IdeaMapWorkspace.preferredTool-regression.test.tsx > IdeaMapWorkspace — P0-5 preferredTool corruption regression > ASSERCJA B: autosave (kanał useWorkspaceGraphRuntime, realny, nieattrapowany) NIE nadpisuje preferredTool na "mindmap" dla tej Idei
- tests/components/Presentations/DeckRewriteR4.test.tsx > R4 regenerateSlide (server) > without instruction, a non-narrative slide keeps the OLD behaviour (no AI call)
- tests/components/Presentations/DeckRewriteR4.test.tsx > R4 shouldRunNarrativeRewrite (pure gate) > without instruction, only narrative intents are rewritten
- tests/components/ReportsAndPresentations/ArtifactTrustPreview.test.tsx [ tests/components/ReportsAndPresentations/ArtifactTrustPreview.test.tsx ]
- tests/components/ReportsAndPresentations/PresentationsTabContent.deeplink.test.tsx > PresentationsTabContent deep-link selection > also selects by deck id for legacy deck query compatibility
- tests/components/ReportsAndPresentations/PresentationsTabContent.deeplink.test.tsx > PresentationsTabContent deep-link selection > selects matching deck id from initialArtifactId deep link
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > exposes score + top issues in the grade chip tooltip (hover/expand)
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > falls back to the validationState badge when no deckScorecard is present
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > prefers the deckScorecard grade over the validationState fallback
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > renders a "Validated" badge when governance.validationState is validated
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > renders an "Attention" badge when governance.validationState is attention_required
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > renders nothing (no fabricated score) when governance is absent
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > renders nothing when governance has no validationState
- tests/components/ReportsAndPresentations/PresentationsTabContent.qualityBadge.test.tsx > PresentationsTabContent quality badge > renders the letter grade + score when governance.deckScorecard is present
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.canonicalDataPath.test.tsx > ReportsAndPresentationsHub — canonical registry data path > Mine tab renders titles from GET /api/artifacts?view=mine (real hooks + aggregate table)
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.templateStatusChips.test.tsx > ReportsAndPresentationsHub — Template Library status chips > clicking the Published chip toggles it active/inactive (drives the status filter)
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.templateStatusChips.test.tsx > ReportsAndPresentationsHub — Template Library status chips > renders a chip (with correct count) for every status actually produced by mapTemplateStatus, including published/approved
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > keeps Menu 1 at exactly 5 tabs with both architect flags ON, no template_architect/workbook_templates siblings
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > keeps legacy reports query alias mapped to documents tab
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > navigates to Document Studio with entry=ai from the "New AI document" command-row button
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > preserves artifactId query param when switching tabs
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > rehydrates a built workbook id and retains it in the canonical template URL
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > renders Wave 2 Outputs Library taxonomy on the unified hub and opens presentations on /presentations
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > resolves the legacy ?tab=template_architect deep link into the templates tab (embedded architect view)
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > resolves the legacy ?tab=workbook_templates deep link into the templates tab (embedded architect view)
- tests/components/ReportsAndPresentations/ReportsAndPresentationsHub.test.tsx > ReportsAndPresentationsHub > treats documents as the canonical reports tab query
- tests/components/ReportsAndPresentations/ReportsTabContent.deeplink.test.tsx > ReportsTabContent deep-link selection > selects matching report id from initialArtifactId deep link
- tests/components/ReportsAndPresentations/SheetsTabContent.deeplink.test.tsx [ tests/components/ReportsAndPresentations/SheetsTabContent.deeplink.test.tsx ]
- tests/components/ReportsAndPresentations/TemplatesTabContent.deeplink.test.tsx > TemplatesTabContent deep-link selection > selects matching template id from initialArtifactId deep link
- tests/components/Results/KPICreateModal.v8-write.test.tsx [ tests/components/Results/KPICreateModal.v8-write.test.tsx ]
- tests/components/Results/ResultsHub.v8-runtime-strip.test.tsx > ResultsHub current canonical entry > loads the unscoped canonical dashboard and KPI catalog
- tests/components/ResultsVNext/ResultsKpiRegistryPage.uiStatePersistence.test.tsx > ResultsKpiRegistryPage — RN-G6 UI state persistence (tab/chip/selection) > deep link (?kpiId=) still resolves when a restored "My" tab or status chip would otherwise hide the record (caught live during the dowód run)
- tests/components/ResultsVNext/ResultsKpiRegistryPage.uiStatePersistence.test.tsx > ResultsKpiRegistryPage — RN-G6 UI state persistence (tab/chip/selection) > restores tab, status chip, and selected row after unmount/remount (simulating "open full tool" and back)
- tests/components/ValuationVisualsPanel.test.tsx > ValuationVisualsPanel > builds a football range per available method (DCF, comps, asset-based)
- tests/components/ValuationVisualsPanel.test.tsx > ValuationVisualsPanel > fails soft: renders only the sections that have data
- tests/components/ValuationVisualsPanel.test.tsx > ValuationVisualsPanel > shows the empty state when no valuation data is present
- tests/components/assessment/AssessmentHub.five-surfaces.real-provider.test.tsx > AssessmentHub — assessmentFiveSurfacesV1, REAL FeatureFlagsProvider (no isEnabled mock) > ON: with zero token / zero remote data / zero local override, the real provider resolves to defaultValue=true — Library tab renders by default
- tests/components/assessment/AssessmentHub.fiveSurfaces.t22-integration.test.tsx > T22-INTEGRATION-SHELL AssessmentHub five-surfaces — QA screen shell > flag ON: exactly the 5 five-surfaces tabs (Library/Processes/Outputs/Reports/Initiatives)
- tests/components/assessment/AssessmentHub.fiveSurfaces.t22-integration.test.tsx > T22-INTEGRATION-SHELL AssessmentHub five-surfaces — QA screen shell > flag ON: outputs tab with an assessment selected (via Processes) renders the real AssessmentQualityReviewPanel
- tests/components/assessment/AssessmentHub.fiveSurfaces.t22-integration.test.tsx > T22-INTEGRATION-SHELL source anchors — protects the real Library/Outputs surfaces and this package's scope boundary > AssessmentHub wires AssessmentOutputsTab as the outputs tab's no-selection default, not as a replacement for AssessmentQualityReviewPanel (doctryna gęstości §3 — new component needs a real caller)
- tests/components/assessment/AssessmentOutputsTab.t22.test.tsx > T22 AssessmentOutputsTab — Method Core contract > retains the shared Outputs, Reports and Initiatives surfaces
- tests/components/assessment/AssessmentOutputsTab.t22.test.tsx > T22 AssessmentOutputsTab — Method Core contract > separates generic failure from empty and never leaks raw error data
- tests/components/assessment/AssessmentOutputsTab.t22.test.tsx > T22 AssessmentOutputsTab — Method Core contract > shows dedicated forbidden state for an auth error
- tests/components/assessment/AssessmentOutputsTab.t22.test.tsx > T22 AssessmentOutputsTab — Method Core contract > shows truthful empty and reports zero
- tests/components/auth/MFASetup.test.tsx > MFASetup Component > QR Code Step > copies manual entry secret to clipboard
- tests/components/controllers/InitiativeController.test.ts > InitiativeController > createInitiative > should create a new initiative
- tests/components/controllers/InitiativeController.test.ts > InitiativeController > createInitiative > should return 400 if title is missing
- tests/components/organization-route-role-gate.test.tsx [ tests/components/organization-route-role-gate.test.tsx ]
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > back button navigates to chat and sets current view
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > falls back to profile for unknown section
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > hands admin sections off to the canonical Admin route without mounting the legacy panel
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > mobile menu open/close toggles overlay and close button
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > navigates to another section when sidebar triggers onSectionChange and tracks funnel
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > redirects megatrends route to Discovery Tools canonical route
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > renders correct modules for goals/challenges/strategy
- tests/components/organization/OrganizationView.test.tsx > OrganizationView (L2) > renders profile module by default and resolves active section from pathname
- tests/components/services/initiativeService.test.ts > InitiativeService > Definition Service > should create initiative
- tests/components/shared/NModeBlocks/ArtifactAttachPopover.paste-contract.test.tsx > ArtifactAttachPopover paste contract > attaches and closes on valid artifact paste
- tests/components/shared/NModeBlocks/ArtifactAttachPopover.paste-contract.test.tsx > ArtifactAttachPopover paste contract > attaches any colon ref using the parsed type (no type whitelist)
- tests/components/shared/NModeBlocks/ArtifactAttachPopover.paste-contract.test.tsx > ArtifactAttachPopover paste contract > does not set parse-failure status for plain text without colon
- tests/components/shared/artifact-actions/ArtifactActionPanel.governance.test.tsx > ArtifactActionPanel governance confirmation > requires explicit confirmation before document generators create artifacts
- tests/components/shared/artifact-actions/ArtifactActionPanel.governance.test.tsx > ArtifactActionPanel governance confirmation > requires proposal confirmation before creating app action artifacts with lineage
- tests/components/smoke/hubs.smoke.test.tsx > VEGAS V7.8 — hub smoke suite > Admin/Settings (AdminSettingsModule) renders a section header
- tests/components/smoke/hubs.smoke.test.tsx > VEGAS V7.8 — hub smoke suite > Assessment (AssessmentHub) renders with the Assessment tab
- tests/components/smoke/hubs.smoke.test.tsx > VEGAS V7.8 — hub smoke suite > Initiatives (InitiativesHub) renders with the Portfolio tab
- tests/components/smoke/hubs.smoke.test.tsx > VEGAS V7.8 — hub smoke suite > Outputs (ReportsAndPresentationsHub) renders its hub shell
- tests/components/smoke/hubs.smoke.test.tsx > VEGAS V7.8 — hub smoke suite > Results (ResultsHub) renders with the Initiatives tab

## Faza 1 — P2

**ZROBIONE.** Mapa zawiera 48 ścieżek; istnieje 47. Nie odtworzono historycznie
usuniętego `tests/unit/backend/subscriptionAnalyticsService.test.ts`, ponieważ
aktywny produkt ma modularny kontrakt zastępczy.

Pierwszy przebieg na bazie użytej wcześniej przez pełną Fazę 0 dał 12 FAIL w
`organizationService.test.js` i błąd asynchroniczny `orgContext.middleware`.
Wynik odrzucono: wcześniejsze suity zmieniły współdzielony schemat. Po odtworzeniu
kontenera, pełnym migratorze i identycznym poleceniu wynik wynosi:

- **47/47 plików PASS**;
- **521 PASS, 26 SKIP, 0 FAIL**;
- `--retry=0`;
- K1: PASS;
- K2: PASS;
- nowe czerwone wobec Fazy 0: **zero**.

Nie zmieniono kodu ani testów w Fazie 1. Pomiar dowodzi również, że 12 czerwonych
z pierwszego przebiegu było skutkiem zanieczyszczonej bazy, nie długiem P2.

## Faza 2 — P3

**ZROBIONE.** Mapa zawiera 77 ścieżek; istnieją 74. Zgodnie z instrukcją nie
odtworzono trzech usuniętych testów: `portfolioScenarioSurface.test.tsx`,
`sourceProposalRegistrationWorkbench.test.tsx` i `resourceLoadMath.test.ts`.

Pierwszy przebieg: 72 pliki PASS, 2 FAIL; 621 PASS, 14 FAIL. Przyczyny:

1. `wave3OwnerRuntimeGuard.test.ts` ignorował przydzielony `DATABASE_URL` i w
   29 miejscach zakładał cudzy port 5940 oraz hasło `cx`. Test korzysta teraz z
   jawnego lokalnego URL zadania, zachowując wszystkie kontrole hosta, portu,
   użytkownika, nazw baz i sprzątania.
2. Po obowiązkowym przywróceniu zastosowanej wcześniej migracji
   `948_tool_promotion_idempotency.sql` test kolejności wykrył, że na świeżej
   bazie stawała się ona przypadkowym producentem przed kanonicznym
   `20260719_baseline_gap.sql`. Pliku migracji ani checksumy nie zmieniono.
   Logika runnera przesuwa nieedytowalną migrację historyczną do fazy późnej;
   test dopuszcza wyłącznie dwa jawne historyczne pliki i nadal odrzuca każdego
   nowego producenta.

Dowód mutacyjny zmiany produkcyjnej `migrationOrdering.ts`:

- po usunięciu nowego wpisu manifestu: exit 1, nazwany czerwony test
  `GATE I1 — kolejność producent → konsument > producent jest JEDYNY — żadna
  inna migracja nie tworzy tej tabeli`;
- dosłowny błąd: `expected 694 to be less than 460` dla
  `20260719_baseline_gap.sql przed 948_tool_promotion_idempotency.sql`;
- po przywróceniu: **14/14 PASS**.

Incydent wykonawczy: pierwsza mechaniczna próba parametryzacji portu została
źle zinterpretowana przez powłokę i uszkodziła wyłącznie niezatwierdzony plik
testowy. Plik odtworzono bajt w bajt z HEAD przez archiwum i `cp`, bez stash,
reset ani checkout; dopiero potem zastosowano kontrolowaną poprawkę. Uszkodzona
wersja nie była uruchamiana ani zatwierdzana.

Końcowo:

- **74/74 pliki PASS**;
- **635/635 testów PASS**;
- `--retry=0`;
- K1: PASS;
- K2: PASS;
- nowe czerwone wobec Fazy 0: **zero**.

## Faza 3 — 13 testów pinujących bugi

**ZROBIONE.** Mapa nazywa tę grupę „13 rekordów”, ale jej własne składniki
sumują się do **14** (8 + 1 + 1 + 1 + 1 + 2). Nie ukryto czternastego rekordu;
sprawdzono wszystkie rzeczywiste pozycje:

1. `GET assessment-workflow/:id/status` — **KANONIZOWAŁ BUG**: historyczny 500
   z błędem typu identyfikatora; obecny kontrakt zabrania 5xx i przechodzi.
2. `GET assessment-workflow/:id/versions` — **KANONIZOWAŁ BUG**: historyczny
   brak relacji; świeża pełna baza i obecny kontrakt przechodzą.
3. `GET assessment-workflow/:id/history` — **KANONIZOWAŁ BUG**: historyczny
   błąd typu identyfikatora; obecnie bez 5xx.
4. `GET assessment-workflow/pending-reviews` — **KANONIZOWAŁ BUG**:
   historyczny brak relacji; obecnie bez 5xx.
5. `POST assessment-workflow/:id/initialize` — **KANONIZOWAŁ BUG**:
   historyczny błąd typu identyfikatora; obecnie bez 5xx.
6. `GET assessment-workflow-v2/:id/initiative-batches` — **KANONIZOWAŁ BUG**:
   historyczny brak kolumny `generated_by`; obecnie bez 5xx.
7. `GET assessments-v4/.../diff/...` — **KANONIZOWAŁ BUG**: historyczny
   surowy HTML 500; obecnie bez 5xx.
8. `GET assessment-evidence/:id/report` — **KANONIZOWAŁ BUG**: historyczny
   brak `assessment_questions`; obecnie bez 5xx.
9. AI preferences w `red-final` — historyczny pin 500 **KANONIZOWAŁ BUG**.
   Obecny zamierzony kontrakt to jawny 503 `not_configured`, nie awaria 500.
10. T2 artifact SLA — **KANONIZOWAŁ BUG** i był nadal aktywny: globalny sweep
    eskalował także artefakty należące do osobnej ścieżki SLA. Produkt filtruje
    teraz `assignment_kind=project_gate`; test T2 przechodzi 3/3.
11. B9 Harvard — **ZAMIERZONY KONTRAKT STUB** na obecnej granicy produktu.
    Rejestr jawnie oznacza brak pełnego handoffu governed tables; nie wolno
    przemianować kotwic na działającą integrację bez dowodu read-back.
12. `SECTION_AI_NOOP` — **ZAMIERZONY KONTRAKT**: trzy dostarczone sekcje mają
    realne handlery, a cztery autentycznie niewdrożone pozostają fail-closed.
13. DECCASE, gałąź `DONE` — historyczna lowercase asercja **KANONIZOWAŁA BUG**;
    obecny wykonywalny kontrakt zachowuje kanoniczne uppercase `DONE`.
14. DECCASE, gałąź `BLOCKED` — historyczna lowercase asercja
    **KANONIZOWAŁA BUG**; obecny kontrakt zapisuje uppercase `BLOCKED`.

Dowód mutacyjny zmiany produkcyjnej `slaService.ts`:

- po usunięciu filtra rodzaju przypisania: nazwany czerwony test
  `T2 · FINDING ... > leaves assignment_kind=artifact for its dedicated review SLA path`,
  z błędem `expected '<uuid>' to be null`;
- po odtworzeniu kopii pliku: **3/3 PASS** i identyczna treść naprawy.

Końcowy regres pinów: **100/100 acceptance PASS** oraz **25/25 unit PASS**,
`--retry=0`. Jedyna zmiana produktu w tej fazie to filtr T2; testów pinujących
nie osłabiono i nie wyciszono.

## Faza 4 — błędy typów

**ZROBIONE.** Wszystkie trzy wskazane błędy nadal istniały i zostały usunięte:

1. `src/services/api.ts:12613` — adapter kalendarza przekazywał opcjonalny
   `start` do kontraktu V8 wymagającego wartości. Teraz normalizuje
   `start ?? startAt`, odrzuca brak obu i nie przekazuje źródła `event` do
   ścieżki V8 przeznaczonej dla task/initiative/decision.
2. `src/views/admin/AdminSettingsModule.tsx:500` — po wcześniejszej bramce
   rozpoznającej podwidok Command Center zawężono typ propsa do kontraktu
   `AdminCommandCenterPanel`; zachowanie routingu pozostaje bez zmian.
3. `src/views/superadmin/__tests__/PlatformOperationsView.test.tsx:33` — fixture
   uzupełniono o wymagane katalogi `connectors` i `virtualWorkers`.

Pełny `npm run type-check`: **exit 0**. Regres dwóch bezpośrednio związanych
plików UI: **68/68 PASS**.

Dowód mutacyjny zmian produkcyjnych: po podmianie obu plików produkcyjnych
wersjami sprzed fazy kompilator wrócił do nazwanych błędów `TS2345` dokładnie
w `api.ts(12613,52)` i `TS2322` dokładnie w `AdminSettingsModule.tsx(500,13)`
(exit 2). Po odtworzeniu kopii pełny type-check ponownie przeszedł (exit 0).

## Faza 5 — inwentarz lintu

**ZROBIONE — inwentarz, bez masowego autofixu.** Pomiar JSON obejmuje całe repo:

- 48 539 błędów w 1 934 plikach;
- 48 526 błędów ma mechaniczną poprawkę ESLint, ale nie została zastosowana;
- `prettier/prettier`: 47 409;
- `simple-import-sort/imports`: 1 070;
- `simple-import-sort/exports`: 27;
- `prefer-const`: 18;
- semantyczne pojedyncze: `react-hooks/rules-of-hooks` 3,
  `no-irregular-whitespace` 2, `no-extra-boolean-cast` 2,
  `no-useless-escape` 2, `no-unused-expressions` 2,
  `no-namespace` 1, `no-fallthrough` 1, `no-unsafe-finally` 1,
  `no-this-alias` 1.

Rozkład katalogów: `server/src` 38 849, `src/components` 6 367,
`dev-render` 978, `docs` 798, `src/views` 616, `src/toolPacks` 262,
`src/method-core` 218, `src/services` 200, pozostałe katalogi 251 łącznie.

Największe pojedyncze pliki: `openapiSchemaValidity.contract.test.ts` 1 090,
`eventInboxService.pg.test.ts` 851, `artifactLinkService.pg.test.ts` 833,
`freezeOutputFlow.integration.test.ts` 826, `resilience.pg.test.ts` 816,
`financeValue.membershipGate.pg.test.ts` 807, `drdVerticalSlice.e2e.test.ts` 785
i `my-work.routes.ts` 785.

Bezpieczna kolejność spłaty: (1) 13 semantycznych naruszeń innych niż
`prefer-const`, każde osobno z testem; (2) 18 `prefer-const`; (3) importy małymi,
rozłącznymi pakietami katalogów; (4) formatowanie wyłącznie modułami z pełnym
regresem nazw. Nie wolno puścić 48 526 autofixów jako jednego commita — zniszczyłoby
to możliwość sensownego review i przypisania regresji.

## Kryteria K1–K5

- **K1 PASS** — czysty produkcyjny build serwera przez
  `server/tsconfig.build.json`, limit 3072 MB, exit 0.
- **K2 PASS** — produkcyjny build frontendu, limit 6144 MB, exit 0.
- **K3 PASS** — zero potwierdzonych zielone→czerwone po pełnych nazwach.
  Pełny unit ma 8 FAIL wobec 17 na baseline; cztery pozornie nowe kontrakty
  Gateway przeszły w izolacji 18/18. Components ma identyczne 165 FAIL i
  identyczny zbiór nazw. Pełne uruchomienie integration niszczy współdzielony
  schemat w trakcie suity, więc jego surowy wynik nie jest porównywalny.
  Wszystkie podejrzane nazwy zawężono do 16 plików i uruchomiono symetrycznie
  na świeżej bazie na osobnym checkoutcie markera oraz na kandydacie:
  kandydat miał 34 FAIL wobec 38 na markerze; różnice bez nazwy testu były
  błędami całego pliku. Jedyny podejrzany My Work sprawdzony osobno ma już na
  markerze 17/17 FAIL. Acceptance uruchomiona symetrycznie na świeżych bazach:
  kandydat 31 FAIL, marker 32 FAIL; jedyna pozorna regresja — Socket.IO
  `presence READ` — przeszła natychmiastowy nazwany rerun 4/4.
- **K4 PASS** — każda zmiana produkcyjna ma czerwony→zielony: kolejność
  migracji (nazwany Gate I1), filtr T2 SLA (nazwany test artefaktu), adapter
  kalendarza i zawężenie Command Center (dokładne błędy kompilatora TS2345 i
  TS2322 po mutacji, pełny type-check po odtworzeniu).
- **K5 PASS** — sekcja poniżej jest niepusta.

Kontrole końcowe: pełny migrator na świeżym PG zastosował 863 migracje, drugi
przebieg 0; `git diff --check marker..HEAD` jest czysty; zero zmian migracji,
zero zmian w plikach chronionych, zero połączeń do środowisk zdalnych.

## Twierdzenia niezweryfikowane

- Nie zweryfikowano jeszcze, które czerwone wyniki integracyjne są niezależnymi
  defektami, a które są wtórnym skutkiem współdzielonego stanu bazy i sześciu
  błędów procesu.
- Nie zweryfikowano przyczyny wszystkich istniejących 31 czerwonych testów
  acceptance ani wszystkich istniejących czerwieni pozostałych suit; zakres
  zadania wymagał braku regresji, nie spłaty całego historycznego długu spoza
  P2/P3 i pinów.
- Nie udowodniono, że surowe liczniki pełnej integration są powtarzalne;
  przeciwnie, pomiar wykazał zależność od destrukcyjnej kolejności i stanu
  schematu. K3 oparto dlatego na nazwach oraz symetrycznej świeżej izolacji.
- Nie wykonano żadnego testu na Railway, stagingu, demo ani produkcji — i zgodnie
  z zakazem tego zadania nie zostanie wykonany.
