/**
 * OPS-DEMO-002 — a public demo principal is READ-ONLY, enforced by an exact
 * method+path table rather than a prefix.
 *
 * The implementation this replaces allowed any write under `/api/auth/` or
 * `/api/demo/`, on the reasoning that those are the endpoints a session needs to
 * wind itself down. They are not: `/api/auth/` also carries `switch-organization`,
 * `change-password`, `register`, `register-demo`, `reset-password`,
 * `revert-impersonation` and the whole `mfa/*` group, and `/api/demo/` carries
 * `toggle {enabled:true}` — a provisioning operation. A prefix rule hands all of
 * that to an anonymous "Try demo" credential.
 *
 * So this suite is deliberately built the opposite way round from a normal unit
 * test: instead of probing a handful of paths the author happened to think of, it
 * enumerates the application's REAL write surface and asserts the guard refuses
 * all of it except the five rows the allowlist documents. The table below is a
 * literal, not a filesystem walk at runtime, so a reviewer can see exactly what is
 * covered and the coverage cannot silently shrink.
 *
 * HOW THE TABLE WAS BUILT (reproducible): every `app.use('/api/...', xRoutes)`
 * mount in `server/src/Gateway.ts` was resolved to its route module through the
 * file's own import list, each module was scanned for
 * `router.post|put|patch|delete`, one level of in-module `router.use('/sub', ...)`
 * nesting was followed, and mount+sub were joined. That pass found 2305 write
 * routes across 282 mounts. This literal carries 566 of them, chosen so the
 * dangerous namespaces are COMPLETE rather than sampled:
 *
 *   - `/api/auth/*` and `/api/demo/*` — complete (21). These are the two the old
 *     prefix rule wildcarded, so nothing here may be sampled.
 *   - identity / invitations / access codes / self-service — complete (112).
 *   - admin + superadmin — sampled, up to 3 per `/api/<ns>/<area>` (133).
 *   - breadth — up to 2 routes from every remaining `/api/<segment>` namespace
 *     (300), so a prefix rule reintroduced in ANY namespace, not just auth, is
 *     caught.
 *
 * Express path params (`:id`) are not part of the guard's vocabulary — it sees a
 * concrete request path — so each row is asserted twice: once as written, once
 * with params substituted for a literal segment.
 */
import { describe, expect, it } from 'vitest';

import {
  PUBLIC_DEMO_WRITE_ALLOWLIST,
  isPathAllowedForExpiredDemo,
  isWriteAllowedForPublicDemo,
  normalizeGuardPath,
} from '../../../../server/src/services/demo/demoPrincipalGuard.ts';

interface Route {
  method: string;
  path: string;
}

const ROUTE_SURFACE: ReadonlyArray<Route> = [
  // --- AUTH + DEMO — the two namespaces the old prefix rule wildcarded (complete) — 21 routes
  { method: 'POST', path: '/api/auth/change-password' },
  { method: 'POST', path: '/api/auth/demo-login' },
  { method: 'POST', path: '/api/auth/forgot-password' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/login-history' },
  { method: 'POST', path: '/api/auth/logout' },
  { method: 'POST', path: '/api/auth/mfa/disable' },
  { method: 'POST', path: '/api/auth/mfa/enable' },
  { method: 'POST', path: '/api/auth/mfa/setup' },
  { method: 'POST', path: '/api/auth/refresh' },
  { method: 'POST', path: '/api/auth/register' },
  { method: 'POST', path: '/api/auth/register-demo' },
  { method: 'POST', path: '/api/auth/resend-verification' },
  { method: 'POST', path: '/api/auth/reset-password' },
  { method: 'POST', path: '/api/auth/revert-impersonation' },
  { method: 'POST', path: '/api/auth/revoke-all' },
  { method: 'DELETE', path: '/api/auth/sessions/:id' },
  { method: 'POST', path: '/api/auth/switch-organization' },
  { method: 'POST', path: '/api/auth/verify-email' },
  { method: 'POST', path: '/api/demo/record-event' },
  { method: 'POST', path: '/api/demo/toggle' },

  // --- IDENTITY, INVITATIONS, ACCESS CODES, SELF-SERVICE (complete) — 112 routes
  { method: 'POST', path: '/api/access-codes/:id/revoke' },
  { method: 'POST', path: '/api/access-codes/accept' },
  { method: 'POST', path: '/api/access-codes/generate' },
  { method: 'POST', path: '/api/access-control/codes' },
  { method: 'DELETE', path: '/api/access-control/codes/:id' },
  { method: 'POST', path: '/api/access-control/codes/register' },
  { method: 'POST', path: '/api/access-control/requests' },
  { method: 'PUT', path: '/api/access-control/requests/:id/approve' },
  { method: 'PUT', path: '/api/access-control/requests/:id/reject' },
  { method: 'POST', path: '/api/access/project-role-templates' },
  { method: 'PUT', path: '/api/access/project-role-templates/:id' },
  { method: 'POST', path: '/api/access/project-role-templates/:id/preview' },
  { method: 'POST', path: '/api/admin/access-codes' },
  { method: 'POST', path: '/api/api-keys' },
  { method: 'DELETE', path: '/api/api-keys/:keyId' },
  { method: 'POST', path: '/api/api-keys/:keyId/rotate' },
  { method: 'POST', path: '/api/consultant-project-access' },
  { method: 'DELETE', path: '/api/consultant-project-access/:accessId' },
  { method: 'PUT', path: '/api/consultant-project-access/:accessId' },
  { method: 'POST', path: '/api/consultant-project-access/:accessId/regenerate-code' },
  { method: 'POST', path: '/api/invitations' },
  { method: 'DELETE', path: '/api/invitations/:id' },
  { method: 'POST', path: '/api/invitations/:id/resend' },
  { method: 'POST', path: '/api/invitations/:id/revoke' },
  { method: 'POST', path: '/api/invitations/accept' },
  { method: 'POST', path: '/api/invitations/org' },
  { method: 'POST', path: '/api/invitations/project' },
  { method: 'POST', path: '/api/invitations/resend' },
  { method: 'POST', path: '/api/onboarding/accept-terms' },
  { method: 'POST', path: '/api/onboarding/complete' },
  { method: 'POST', path: '/api/onboarding/select-tier' },
  { method: 'POST', path: '/api/onboarding/setup-payment' },
  { method: 'POST', path: '/api/onboarding/skip' },
  { method: 'POST', path: '/api/organizations' },
  { method: 'POST', path: '/api/organizations/:id/transaction-readiness/recompute' },
  { method: 'PUT', path: '/api/organizations/:orgId' },
  { method: 'POST', path: '/api/organizations/:orgId/approved-domains' },
  { method: 'DELETE', path: '/api/organizations/:orgId/approved-domains/:domainId' },
  { method: 'PUT', path: '/api/organizations/:orgId/approved-domains/:domainId' },
  { method: 'POST', path: '/api/organizations/:orgId/approved-domains/:domainId/verify' },
  { method: 'POST', path: '/api/organizations/:orgId/cancel-deletion' },
  { method: 'POST', path: '/api/organizations/:orgId/members' },
  { method: 'DELETE', path: '/api/organizations/:orgId/members/:memberId' },
  { method: 'PATCH', path: '/api/organizations/:orgId/members/:memberId/role' },
  { method: 'POST', path: '/api/organizations/:orgId/ownership/accept-transfer' },
  { method: 'POST', path: '/api/organizations/:orgId/ownership/cancel-transfer' },
  { method: 'POST', path: '/api/organizations/:orgId/ownership/transfer' },
  { method: 'POST', path: '/api/organizations/:orgId/schedule-deletion' },
  { method: 'POST', path: '/api/project-members/:projectId' },
  { method: 'DELETE', path: '/api/project-members/:projectId/:memberId' },
  { method: 'PUT', path: '/api/project-members/:projectId/:memberId' },
  { method: 'POST', path: '/api/project-members/:projectId/invite' },
  { method: 'POST', path: '/api/scim/admin/admin/conflicts/:id/resolve' },
  { method: 'POST', path: '/api/scim/admin/admin/group-mappings' },
  { method: 'DELETE', path: '/api/scim/admin/admin/group-mappings/:id' },
  { method: 'POST', path: '/api/scim/admin/admin/service-provider' },
  { method: 'POST', path: '/api/scim/admin/admin/sync' },
  { method: 'POST', path: '/api/scim/admin/admin/tokens' },
  { method: 'DELETE', path: '/api/scim/admin/admin/tokens/:id' },
  { method: 'POST', path: '/api/scim/admin/Groups' },
  { method: 'DELETE', path: '/api/scim/admin/Groups/:id' },
  { method: 'PATCH', path: '/api/scim/admin/Groups/:id' },
  { method: 'POST', path: '/api/scim/admin/Users' },
  { method: 'DELETE', path: '/api/scim/admin/Users/:id' },
  { method: 'PATCH', path: '/api/scim/admin/Users/:id' },
  { method: 'PUT', path: '/api/scim/admin/Users/:id' },
  { method: 'POST', path: '/api/scim/v2/admin/conflicts/:id/resolve' },
  { method: 'POST', path: '/api/scim/v2/admin/group-mappings' },
  { method: 'DELETE', path: '/api/scim/v2/admin/group-mappings/:id' },
  { method: 'POST', path: '/api/scim/v2/admin/service-provider' },
  { method: 'POST', path: '/api/scim/v2/admin/sync' },
  { method: 'POST', path: '/api/scim/v2/admin/tokens' },
  { method: 'DELETE', path: '/api/scim/v2/admin/tokens/:id' },
  { method: 'POST', path: '/api/scim/v2/Groups' },
  { method: 'DELETE', path: '/api/scim/v2/Groups/:id' },
  { method: 'PATCH', path: '/api/scim/v2/Groups/:id' },
  { method: 'POST', path: '/api/scim/v2/Users' },
  { method: 'DELETE', path: '/api/scim/v2/Users/:id' },
  { method: 'PATCH', path: '/api/scim/v2/Users/:id' },
  { method: 'PUT', path: '/api/scim/v2/Users/:id' },
  { method: 'DELETE', path: '/api/sessions' },
  { method: 'POST', path: '/api/sessions' },
  { method: 'DELETE', path: '/api/sessions/:id' },
  { method: 'PUT', path: '/api/sessions/:id/activity' },
  { method: 'POST', path: '/api/superadmin/access-codes' },
  { method: 'POST', path: '/api/superadmin/access-codes/:id/deactivate' },
  { method: 'POST', path: '/api/superadmin/users/invite' },
  { method: 'POST', path: '/api/teams' },
  { method: 'DELETE', path: '/api/teams/:id' },
  { method: 'PUT', path: '/api/teams/:id' },
  { method: 'POST', path: '/api/teams/:id/members' },
  { method: 'DELETE', path: '/api/teams/:id/members/:userId' },
  { method: 'PUT', path: '/api/user/availability' },
  { method: 'PUT', path: '/api/user/contact-information' },
  { method: 'POST', path: '/api/user/delete-request' },
  { method: 'DELETE', path: '/api/user/delete-request/:requestId' },
  { method: 'POST', path: '/api/user/notification-channels' },
  { method: 'DELETE', path: '/api/user/notification-channels/:id' },
  { method: 'PUT', path: '/api/user/notification-channels/:id' },
  { method: 'POST', path: '/api/user/notification-channels/:id/toggle' },
  { method: 'POST', path: '/api/user/notification-rules' },
  { method: 'DELETE', path: '/api/user/notification-rules/:id' },
  { method: 'PUT', path: '/api/user/notification-rules/:id' },
  { method: 'POST', path: '/api/user/notification-rules/:id/toggle' },
  { method: 'POST', path: '/api/user/request' },
  { method: 'DELETE', path: '/api/user/security/sessions/:sessionId' },
  { method: 'DELETE', path: '/api/user/security/trusted-devices/:deviceId' },
  { method: 'DELETE', path: '/api/users/:id' },
  { method: 'PUT', path: '/api/users/:id' },
  { method: 'DELETE', path: '/api/users/:id/avatar' },
  { method: 'POST', path: '/api/users/:id/avatar' },
  { method: 'PATCH', path: '/api/users/:id/role' },

  // --- ADMIN + SUPERADMIN mutation surface (sampled, 3 per /api/<ns>/<area>) — 133 routes
  { method: 'POST', path: '/api/admin-alerts' },
  { method: 'DELETE', path: '/api/admin-data/scheduled-events/:eventId' },
  { method: 'PUT', path: '/api/admin-data/scheduled-events/:eventId' },
  { method: 'POST', path: '/api/admin-data/scheduled-events/:orgId' },
  { method: 'PUT', path: '/api/admin-data/security-events/:eventId/resolve' },
  { method: 'DELETE', path: '/api/admin-data/sessions/:sessionId' },
  { method: 'PUT', path: '/api/admin-data/user-tiers/:orgId/:userId' },
  { method: 'POST', path: '/api/admin/ai-quality/feedback/:id/review' },
  { method: 'POST', path: '/api/admin/ai-quality/patterns/:id/status' },
  { method: 'PUT', path: '/api/admin/ai/governance/context-policy' },
  { method: 'PUT', path: '/api/admin/ai/governance/documents/:id/ai-visibility' },
  { method: 'PUT', path: '/api/admin/ai/governance/documents/:id/sensitivity' },
  { method: 'DELETE', path: '/api/admin/backups/:id' },
  { method: 'POST', path: '/api/admin/backups/manual' },
  { method: 'POST', path: '/api/admin/backups/restore' },
  { method: 'PUT', path: '/api/admin/billing/alerts' },
  { method: 'POST', path: '/api/admin/billing/payment-methods' },
  { method: 'DELETE', path: '/api/admin/billing/payment-methods/:id' },
  { method: 'PUT', path: '/api/admin/collaboration' },
  { method: 'PUT', path: '/api/admin/compliance/data-retention' },
  { method: 'PUT', path: '/api/admin/enterprise-compliance/ai-policy' },
  { method: 'PUT', path: '/api/admin/enterprise-compliance/data-residency' },
  { method: 'POST', path: '/api/admin/enterprise-compliance/dlp/rules' },
  { method: 'POST', path: '/api/admin/health-panel/run' },
  { method: 'POST', path: '/api/admin/health-panel/run/:probeId' },
  { method: 'POST', path: '/api/admin/iam/assignments' },
  { method: 'DELETE', path: '/api/admin/iam/assignments/:id' },
  { method: 'PUT', path: '/api/admin/iam/policy' },
  { method: 'POST', path: '/api/admin/identity/scim/group-mappings' },
  { method: 'DELETE', path: '/api/admin/identity/scim/group-mappings/:id' },
  { method: 'POST', path: '/api/admin/identity/scim/tokens' },
  { method: 'POST', path: '/api/admin/model-registry/assignments' },
  { method: 'DELETE', path: '/api/admin/model-registry/assignments/:id' },
  { method: 'PUT', path: '/api/admin/model-registry/assignments/reorder' },
  { method: 'POST', path: '/api/admin/people' },
  { method: 'PUT', path: '/api/admin/sso-self' },
  { method: 'POST', path: '/api/admin/sso-self/validate' },
  { method: 'POST', path: '/api/admin/users/bulk-email' },
  { method: 'POST', path: '/api/admin/users/bulk-import' },
  { method: 'POST', path: '/api/admin/users/bulk-role' },
  { method: 'POST', path: '/api/superadmin/access-requests/:id/approve' },
  { method: 'POST', path: '/api/superadmin/access-requests/:id/reject' },
  { method: 'POST', path: '/api/superadmin/admin/approval-requests/:id/approve' },
  { method: 'POST', path: '/api/superadmin/admin/approval-requests/:id/reject' },
  { method: 'POST', path: '/api/superadmin/admin/approval-workflows' },
  { method: 'POST', path: '/api/superadmin/ai/core-docs/reindex' },
  { method: 'POST', path: '/api/superadmin/ai/models/:modelId/suspend' },
  { method: 'POST', path: '/api/superadmin/analytics/dashboards' },
  { method: 'DELETE', path: '/api/superadmin/analytics/dashboards/:id' },
  { method: 'PUT', path: '/api/superadmin/analytics/dashboards/:id' },
  { method: 'POST', path: '/api/superadmin/api-keys' },
  { method: 'DELETE', path: '/api/superadmin/api-keys/:id' },
  { method: 'POST', path: '/api/superadmin/automation/rules' },
  { method: 'DELETE', path: '/api/superadmin/automation/rules/:id' },
  { method: 'PUT', path: '/api/superadmin/automation/rules/:id' },
  { method: 'PUT', path: '/api/superadmin/backup/schedules/:id' },
  { method: 'POST', path: '/api/superadmin/billing/change-plan' },
  { method: 'POST', path: '/api/superadmin/billing/grace-period' },
  { method: 'POST', path: '/api/superadmin/billing/manual-contract' },
  { method: 'POST', path: '/api/superadmin/branding/:orgId/logo' },
  { method: 'POST', path: '/api/superadmin/communications' },
  { method: 'DELETE', path: '/api/superadmin/communications/:id' },
  { method: 'POST', path: '/api/superadmin/communications/:id/send' },
  { method: 'POST', path: '/api/superadmin/compliance/audits' },
  { method: 'PUT', path: '/api/superadmin/compliance/controls/:controlId' },
  { method: 'POST', path: '/api/superadmin/compliance/dsar' },
  { method: 'POST', path: '/api/superadmin/connectors/:connectorId/emergency-kill' },
  { method: 'POST', path: '/api/superadmin/contracts' },
  { method: 'DELETE', path: '/api/superadmin/contracts/:id' },
  { method: 'PUT', path: '/api/superadmin/contracts/:id' },
  { method: 'POST', path: '/api/superadmin/data/bulk-export' },
  { method: 'POST', path: '/api/superadmin/devices/:id/block' },
  { method: 'POST', path: '/api/superadmin/email/campaigns' },
  { method: 'POST', path: '/api/superadmin/email/templates' },
  { method: 'PUT', path: '/api/superadmin/feature-roadmap/:id' },
  { method: 'POST', path: '/api/superadmin/feedback' },
  { method: 'POST', path: '/api/superadmin/feedback/:id/comments' },
  { method: 'POST', path: '/api/superadmin/feedback/:id/vote' },
  { method: 'POST', path: '/api/superadmin/gdpr/requests/:id/:action' },
  { method: 'POST', path: '/api/superadmin/impersonate' },
  { method: 'DELETE', path: '/api/superadmin/integrations/:provider' },
  { method: 'PUT', path: '/api/superadmin/integrations/:provider/config' },
  { method: 'POST', path: '/api/superadmin/integrations/:provider/connect' },
  { method: 'POST', path: '/api/superadmin/invoices' },
  { method: 'POST', path: '/api/superadmin/invoices/:id/mark-paid' },
  { method: 'POST', path: '/api/superadmin/invoices/:id/remind' },
  { method: 'DELETE', path: '/api/superadmin/ip-whitelist/:id' },
  { method: 'PUT', path: '/api/superadmin/legal/:id/toggle-active' },
  { method: 'POST', path: '/api/superadmin/legal/publish' },
  { method: 'POST', path: '/api/superadmin/lifecycle/stages' },
  { method: 'DELETE', path: '/api/superadmin/lifecycle/stages/:id' },
  { method: 'PUT', path: '/api/superadmin/lifecycle/stages/:id' },
  { method: 'PUT', path: '/api/superadmin/org-policies/:orgId' },
  { method: 'DELETE', path: '/api/superadmin/organizations/:id' },
  { method: 'PUT', path: '/api/superadmin/organizations/:id' },
  { method: 'PUT', path: '/api/superadmin/organizations/:id/budget' },
  { method: 'POST', path: '/api/superadmin/partner-outreach/campaigns' },
  { method: 'POST', path: '/api/superadmin/partner-outreach/campaigns/:campaignId/pause' },
  { method: 'POST', path: '/api/superadmin/partner-outreach/campaigns/:campaignId/resume' },
  { method: 'POST', path: '/api/superadmin/platform/mfa-override' },
  { method: 'POST', path: '/api/superadmin/platform/sso-override' },
  { method: 'POST', path: '/api/superadmin/playbooks' },
  { method: 'DELETE', path: '/api/superadmin/playbooks/:id' },
  { method: 'PUT', path: '/api/superadmin/playbooks/:id' },
  { method: 'POST', path: '/api/superadmin/refresh-token' },
  { method: 'POST', path: '/api/superadmin/security-events/:id/resolve' },
  { method: 'POST', path: '/api/superadmin/security/dlp/policies' },
  { method: 'DELETE', path: '/api/superadmin/security/dlp/policies/:id' },
  { method: 'PUT', path: '/api/superadmin/security/dlp/policies/:id/toggle' },
  { method: 'DELETE', path: '/api/superadmin/storage/files' },
  { method: 'POST', path: '/api/superadmin/subscription-plans' },
  { method: 'DELETE', path: '/api/superadmin/subscription-plans/:id' },
  { method: 'PUT', path: '/api/superadmin/subscription-plans/:id' },
  { method: 'POST', path: '/api/superadmin/support/tickets' },
  { method: 'PUT', path: '/api/superadmin/support/tickets/:id' },
  { method: 'POST', path: '/api/superadmin/support/tickets/:id/comments' },
  { method: 'POST', path: '/api/superadmin/system-configs' },
  { method: 'DELETE', path: '/api/superadmin/system-configs/:id' },
  { method: 'PUT', path: '/api/superadmin/system-configs/:id' },
  { method: 'POST', path: '/api/superadmin/system-health/alerts' },
  { method: 'DELETE', path: '/api/superadmin/system-health/alerts/:id' },
  { method: 'PUT', path: '/api/superadmin/system-health/alerts/:id' },
  { method: 'POST', path: '/api/superadmin/system/backup' },
  { method: 'POST', path: '/api/superadmin/tenants/:id/lockdown' },
  { method: 'POST', path: '/api/superadmin/tenants/:id/purge' },
  { method: 'POST', path: '/api/superadmin/tenants/:id/reactivate' },
  { method: 'POST', path: '/api/superadmin/users' },
  { method: 'DELETE', path: '/api/superadmin/users/:id' },
  { method: 'PUT', path: '/api/superadmin/users/:id' },
  { method: 'POST', path: '/api/superadmin/virtual-workers/:workerId/suspend' },
  { method: 'POST', path: '/api/superadmin/webhooks' },
  { method: 'DELETE', path: '/api/superadmin/webhooks/:id' },
  { method: 'PUT', path: '/api/superadmin/webhooks/:id' },

  // --- BREADTH — every remaining /api/<seg> namespace, up to 2 routes each — 300 routes
  { method: 'DELETE', path: '/api/admin/ai/governance/memory' },
  { method: 'PUT', path: '/api/admin/ai/governance/policy' },
  { method: 'POST', path: '/api/agents/analyze-initiative' },
  { method: 'POST', path: '/api/agents/query' },
  { method: 'POST', path: '/api/ai-agents/definitions' },
  { method: 'POST', path: '/api/ai-agents/launch' },
  { method: 'POST', path: '/api/ai-analytics/alerts/configure' },
  { method: 'POST', path: '/api/ai-async/jobs' },
  { method: 'POST', path: '/api/ai-budgets/alerts/:id/acknowledge' },
  { method: 'POST', path: '/api/ai-budgets/alerts/:id/dismiss' },
  { method: 'POST', path: '/api/ai-connectors' },
  { method: 'PATCH', path: '/api/ai-connectors/:connectorId' },
  { method: 'POST', path: '/api/ai-context/ledger' },
  { method: 'POST', path: '/api/ai-context/ledger/:ledgerId/forget' },
  { method: 'POST', path: '/api/ai-development/experiments' },
  { method: 'POST', path: '/api/ai-development/experiments/:id/start' },
  { method: 'POST', path: '/api/ai-drafts' },
  { method: 'PATCH', path: '/api/ai-drafts/:id/approve' },
  { method: 'POST', path: '/api/ai-feedback' },
  { method: 'POST', path: '/api/ai-feedback/response' },
  { method: 'PUT', path: '/api/ai-governance/context-policy' },
  { method: 'PUT', path: '/api/ai-governance/documents/:id/ai-visibility' },
  { method: 'PUT', path: '/api/ai-memory/:key' },
  { method: 'POST', path: '/api/ai-operations/knowledge/product-pills/index' },
  { method: 'POST', path: '/api/ai-operations/knowledge/tool-packs/index' },
  { method: 'POST', path: '/api/ai-operator/interventions/:actionId/accept' },
  { method: 'POST', path: '/api/ai-operator/interventions/:actionId/execute' },
  { method: 'POST', path: '/api/ai-outcomes/acceptance' },
  { method: 'POST', path: '/api/ai-outcomes/acceptance-runs' },
  { method: 'POST', path: '/api/ai-prompts' },
  { method: 'DELETE', path: '/api/ai-prompts/:id' },
  { method: 'POST', path: '/api/ai-settings/compliance/generate' },
  { method: 'PUT', path: '/api/ai-settings/org/:orgId' },
  { method: 'POST', path: '/api/ai-suggestions/enhanced' },
  { method: 'POST', path: '/api/ai-suggestions/gap-analysis' },
  { method: 'POST', path: '/api/ai-training' },
  { method: 'DELETE', path: '/api/ai-training/:id' },
  { method: 'POST', path: '/api/ai/ab-testing/experiments' },
  { method: 'POST', path: '/api/ai/ab-testing/experiments/:id/archive' },
  { method: 'POST', path: '/api/analytics/journey/track' },
  { method: 'POST', path: '/api/analytics/journey/track/batch' },
  { method: 'POST', path: '/api/artifact-approvals/:type/:id/approval/acknowledge' },
  { method: 'POST', path: '/api/artifact-approvals/:type/:id/approval/approve' },
  { method: 'POST', path: '/api/artifact-conversions/:id/convert' },
  { method: 'POST', path: '/api/artifact-conversions/propose' },
  { method: 'POST', path: '/api/artifact-runs/:runId/accept-plan' },
  { method: 'POST', path: '/api/artifact-runs/:runId/materialize' },
  { method: 'POST', path: '/api/artifacts/:id/access' },
  { method: 'POST', path: '/api/artifacts/:id/deprecate' },
  { method: 'POST', path: '/api/assessment-evidence/:assessmentId' },
  { method: 'POST', path: '/api/assessment-level-attachments' },
  { method: 'DELETE', path: '/api/assessment-level-attachments/:attachmentId' },
  { method: 'POST', path: '/api/assessment-workflow-v2' },
  { method: 'DELETE', path: '/api/assessment-workflow-v2/:assessmentId' },
  { method: 'POST', path: '/api/assessment-workflow/:assessmentId/access-requests' },
  { method: 'DELETE', path: '/api/assessment-workflow/:assessmentId/access-requests/:requestId' },
  { method: 'POST', path: '/api/assessment/:projectId/ai/autocomplete' },
  { method: 'POST', path: '/api/assessment/:projectId/ai/benchmark-commentary' },
  { method: 'POST', path: '/api/assessments' },
  { method: 'POST', path: '/api/assessments-v4/assessments/:assessmentId/findings' },
  { method: 'POST', path: '/api/assessments-v4/assessments/:assessmentId/reviews' },
  { method: 'DELETE', path: '/api/assessments/:id' },
  { method: 'POST', path: '/api/audit/programs' },
  { method: 'DELETE', path: '/api/audit/programs/:id' },
  { method: 'POST', path: '/api/baselines/:roadmapId/capture' },
  { method: 'POST', path: '/api/benefits-register/benefits' },
  { method: 'POST', path: '/api/benefits-register/benefits/:id/promote' },
  { method: 'POST', path: '/api/benefits/attribution/:kpiId/snapshot' },
  { method: 'POST', path: '/api/benefits/deviation-cases/:caseId/acknowledge' },
  { method: 'POST', path: '/api/billing/admin/plans' },
  { method: 'DELETE', path: '/api/billing/admin/plans/:id' },
  { method: 'DELETE', path: '/api/branding/:orgId' },
  { method: 'PATCH', path: '/api/branding/:orgId' },
  { method: 'POST', path: '/api/budget' },
  { method: 'POST', path: '/api/budget/:budgetId/transactions' },
  { method: 'PUT', path: '/api/budgets/organization' },
  { method: 'PUT', path: '/api/budgets/project/:projectId' },
  { method: 'POST', path: '/api/capabilities' },
  { method: 'DELETE', path: '/api/capabilities/:id' },
  { method: 'POST', path: '/api/change-sentiment/alerts/:id/acknowledge' },
  { method: 'POST', path: '/api/change-sentiment/alerts/check' },
  { method: 'POST', path: '/api/chat-projects' },
  { method: 'DELETE', path: '/api/chat-projects/:id' },
  { method: 'POST', path: '/api/cloud/import' },
  { method: 'POST', path: '/api/cloud/import/:id/process' },
  { method: 'POST', path: '/api/competency/categories' },
  { method: 'DELETE', path: '/api/competency/categories/:id' },
  { method: 'PUT', path: '/api/compliance/cookies' },
  { method: 'PUT', path: '/api/compliance/data-retention' },
  { method: 'POST', path: '/api/conclusions' },
  { method: 'POST', path: '/api/conclusions/readouts' },
  { method: 'POST', path: '/api/content/emails/templates' },
  { method: 'DELETE', path: '/api/content/emails/templates/:id' },
  { method: 'POST', path: '/api/conversations' },
  { method: 'DELETE', path: '/api/conversations/:id' },
  { method: 'POST', path: '/api/cv-matching/candidates' },
  { method: 'POST', path: '/api/cv-matching/candidates/:candidateId/apply-to-profile' },
  { method: 'POST', path: '/api/decisions' },
  { method: 'DELETE', path: '/api/decisions/:id' },
  { method: 'POST', path: '/api/deliverables/generations' },
  { method: 'POST', path: '/api/deliverables/generations/:id/generate' },
  { method: 'POST', path: '/api/discovery/extract' },
  { method: 'DELETE', path: '/api/discovery/sessions/:id' },
  { method: 'DELETE', path: '/api/documents/:id' },
  { method: 'PUT', path: '/api/documents/:id/move-to-project' },
  { method: 'POST', path: '/api/economics/analyses' },
  { method: 'DELETE', path: '/api/economics/analyses/:id' },
  { method: 'POST', path: '/api/enterprise-v4/connectors' },
  { method: 'DELETE', path: '/api/enterprise-v4/connectors/:connectorId' },
  { method: 'POST', path: '/api/errors' },
  { method: 'PUT', path: '/api/evidence/:artifactType/:artifactId' },
  { method: 'POST', path: '/api/evidence/:artifactType/:artifactId/sources' },
  { method: 'POST', path: '/api/execution-analytics/capacity/analyze' },
  { method: 'POST', path: '/api/execution-analytics/capacity/signals' },
  { method: 'POST', path: '/api/execution-control/budget/entries' },
  { method: 'DELETE', path: '/api/execution-control/budget/entries/:entryId' },
  { method: 'POST', path: '/api/execution-modules/manifests/:moduleId/validate' },
  { method: 'POST', path: '/api/execution/:projectId/gate-check' },
  { method: 'POST', path: '/api/feature-flags' },
  { method: 'DELETE', path: '/api/feature-flags/:id' },
  { method: 'POST', path: '/api/feedback' },
  { method: 'POST', path: '/api/feedback/:id/analyze' },
  { method: 'DELETE', path: '/api/finance-statements/:id' },
  { method: 'POST', path: '/api/finance-statements/:id/confirm' },
  { method: 'POST', path: '/api/finance-v4/ai-assumptions/:assumptionId/accept' },
  { method: 'POST', path: '/api/finance-v4/budgets/:budgetId/actuals' },
  { method: 'DELETE', path: '/api/financial-modeling/events/:eventId' },
  { method: 'PUT', path: '/api/financial-modeling/events/:eventId' },
  { method: 'POST', path: '/api/gdpr/cancel-deletion' },
  { method: 'PUT', path: '/api/gdpr/consents' },
  { method: 'POST', path: '/api/governance/change-requests' },
  { method: 'POST', path: '/api/help' },
  { method: 'POST', path: '/api/help/chat' },
  { method: 'POST', path: '/api/inbox-v4/connectors/:itemId/route' },
  { method: 'POST', path: '/api/inbox-v4/connectors/ingest' },
  { method: 'PUT', path: '/api/initiative-generator/:id' },
  { method: 'POST', path: '/api/initiative-generator/generate' },
  { method: 'POST', path: '/api/initiatives' },
  { method: 'POST', path: '/api/initiatives-v4/blueprints' },
  { method: 'POST', path: '/api/initiatives-v4/blueprints/:blueprintId/apply' },
  { method: 'DELETE', path: '/api/initiatives/:id' },
  { method: 'POST', path: '/api/intelligence/insights' },
  { method: 'DELETE', path: '/api/intelligence/insights/:id' },
  { method: 'POST', path: '/api/interview-v4/context/versions' },
  { method: 'POST', path: '/api/interview-v4/context/versions/:versionId/sign-off' },
  { method: 'POST', path: '/api/interview/assignments' },
  { method: 'DELETE', path: '/api/interview/assignments/:id' },
  { method: 'POST', path: '/api/kb/articles/:id/view' },
  { method: 'POST', path: '/api/knowledge-graph/entities' },
  { method: 'POST', path: '/api/knowledge-graph/entities/:entityId/redact' },
  { method: 'POST', path: '/api/knowledge/candidates' },
  { method: 'PUT', path: '/api/knowledge/candidates/:id' },
  { method: 'POST', path: '/api/legal/accept' },
  { method: 'POST', path: '/api/llm/governance/enforce' },
  { method: 'POST', path: '/api/llm/governance/eval-datasets' },
  { method: 'PATCH', path: '/api/management-reports/:id' },
  { method: 'POST', path: '/api/management-reports/:id/approve' },
  { method: 'POST', path: '/api/media-ingestion/ingest/batch' },
  { method: 'POST', path: '/api/media-ingestion/ingest/url' },
  { method: 'POST', path: '/api/meeting' },
  { method: 'DELETE', path: '/api/meeting/:id' },
  { method: 'POST', path: '/api/megatrends/custom' },
  { method: 'PUT', path: '/api/megatrends/custom/:id' },
  { method: 'POST', path: '/api/mfa/disable' },
  { method: 'POST', path: '/api/mfa/regenerate-backup-codes' },
  { method: 'POST', path: '/api/module-access/admin/bootstrap/dbr77' },
  { method: 'POST', path: '/api/module-access/admin/grants' },
  { method: 'POST', path: '/api/module-interest' },
  { method: 'DELETE', path: '/api/module-interest/:moduleKey' },
  { method: 'POST', path: '/api/my-work/automation-rules' },
  { method: 'DELETE', path: '/api/my-work/automation-rules/:ruleId' },
  { method: 'POST', path: '/api/notebook/ai-proposals/:proposalId/resolve' },
  { method: 'POST', path: '/api/notebook/capture/email' },
  { method: 'DELETE', path: '/api/notifications/:id' },
  { method: 'PATCH', path: '/api/notifications/:id/checklist' },
  { method: 'PUT', path: '/api/organization-context-store' },
  { method: 'POST', path: '/api/organization-context/rebuild' },
  { method: 'POST', path: '/api/organization-data/export/:category' },
  { method: 'POST', path: '/api/organization-data/export/all' },
  { method: 'PUT', path: '/api/organization-profiles/:orgId' },
  { method: 'POST', path: '/api/organization-profiles/:orgId/logo' },
  { method: 'POST', path: '/api/pmo-roles' },
  { method: 'DELETE', path: '/api/pmo-roles/:id' },
  { method: 'POST', path: '/api/pmo/initiatives' },
  { method: 'DELETE', path: '/api/pmo/initiatives/:id' },
  { method: 'POST', path: '/api/portfolio-optimization/audit' },
  { method: 'POST', path: '/api/portfolio-optimization/nonhuman/analyze' },
  { method: 'PUT', path: '/api/preferences' },
  { method: 'PUT', path: '/api/preferences/ui' },
  { method: 'POST', path: '/api/presentation-studio/admin/layout-capacity/execute' },
  { method: 'POST', path: '/api/presentation-studio/admin/layout-capacity/propose' },
  { method: 'POST', path: '/api/presentations-v4/bindings/:bindingId/approve' },
  { method: 'POST', path: '/api/presentations-v4/bindings/:bindingId/refresh' },
  { method: 'PUT', path: '/api/presentations/brand-kit' },
  { method: 'POST', path: '/api/presentations/decks' },
  { method: 'POST', path: '/api/preview-ai/hints' },
  { method: 'POST', path: '/api/projects' },
  { method: 'DELETE', path: '/api/projects/:id' },
  { method: 'POST', path: '/api/prompt-assistant/assemble' },
  { method: 'POST', path: '/api/prompt-assistant/blocks/preview' },
  { method: 'POST', path: '/api/public/anna/chat' },
  { method: 'POST', path: '/api/public/anna/funnel-event' },
  { method: 'POST', path: '/api/raid' },
  { method: 'POST', path: '/api/raid-governance/champions' },
  { method: 'DELETE', path: '/api/raid-governance/champions/:id' },
  { method: 'DELETE', path: '/api/raid/:id' },
  { method: 'POST', path: '/api/rbac/roles' },
  { method: 'DELETE', path: '/api/rbac/roles/:id' },
  { method: 'POST', path: '/api/realtime-v4/channels' },
  { method: 'DELETE', path: '/api/realtime-v4/channels/:channelId' },
  { method: 'POST', path: '/api/report-builder' },
  { method: 'DELETE', path: '/api/report-builder/:id' },
  { method: 'DELETE', path: '/api/report-import/:id' },
  { method: 'POST', path: '/api/report-import/:id/create-assessment' },
  { method: 'POST', path: '/api/report-initiatives/generate' },
  { method: 'POST', path: '/api/report-initiatives/link' },
  { method: 'POST', path: '/api/reports-v4/ai-proposals/:proposalId/resolve' },
  { method: 'POST', path: '/api/reports-v4/brand-voice' },
  { method: 'POST', path: '/api/research/competitive/wappalyzer/snapshot' },
  { method: 'POST', path: '/api/research/crossref/search' },
  { method: 'POST', path: '/api/results-strategic/:projectId/okr/cycles' },
  { method: 'POST', path: '/api/results-strategic/:projectId/okr/cycles/:cycleId/close' },
  { method: 'POST', path: '/api/results-v4/kpi-connectors' },
  { method: 'POST', path: '/api/results-v4/kpi-connectors/:connectorId/ingest' },
  { method: 'POST', path: '/api/results/kpi-reports' },
  { method: 'POST', path: '/api/results/kpi-reports/:snapshotId/refresh' },
  { method: 'POST', path: '/api/revenue/forecasts' },
  { method: 'DELETE', path: '/api/revenue/forecasts/:id' },
  { method: 'POST', path: '/api/roadmap/:projectId/waves' },
  { method: 'POST', path: '/api/roles' },
  { method: 'DELETE', path: '/api/roles/:id' },
  { method: 'POST', path: '/api/rollout-ext/baselines' },
  { method: 'POST', path: '/api/rollout-ext/cutover' },
  { method: 'POST', path: '/api/rollout/changes' },
  { method: 'DELETE', path: '/api/rollout/changes/:id' },
  { method: 'POST', path: '/api/scenarios/:projectId/analyze' },
  { method: 'POST', path: '/api/scheduled-reports' },
  { method: 'DELETE', path: '/api/scheduled-reports/:id' },
  { method: 'PUT', path: '/api/security-policies/:id' },
  { method: 'POST', path: '/api/security-policies/:orgId/preset' },
  { method: 'POST', path: '/api/security/roles' },
  { method: 'DELETE', path: '/api/security/roles/:id' },
  { method: 'POST', path: '/api/settings' },
  { method: 'PUT', path: '/api/settings/ai/context-policy' },
  { method: 'POST', path: '/api/share/:token/unlock' },
  { method: 'POST', path: '/api/skills-gap/initiatives/:initiativeId/snapshot' },
  { method: 'POST', path: '/api/slack/events' },
  { method: 'POST', path: '/api/slack/interactions' },
  { method: 'PUT', path: '/api/sponsor-reports/:reportId/sections/:sectionId' },
  { method: 'PUT', path: '/api/sponsor-reports/:reportId/status' },
  { method: 'POST', path: '/api/sso/domains' },
  { method: 'POST', path: '/api/sso/google/config' },
  { method: 'POST', path: '/api/stage-gates/:projectId/pass/:gateType' },
  { method: 'POST', path: '/api/stakeholder-comm/plans' },
  { method: 'PUT', path: '/api/stakeholder-comm/plans/:id' },
  { method: 'POST', path: '/api/stakeholders' },
  { method: 'DELETE', path: '/api/stakeholders/:id' },
  { method: 'POST', path: '/api/status-reports' },
  { method: 'DELETE', path: '/api/status-reports/:id' },
  { method: 'POST', path: '/api/studio/documents' },
  { method: 'DELETE', path: '/api/studio/documents/:id' },
  { method: 'DELETE', path: '/api/superadmin/admin/approval-workflows/:id' },
  { method: 'PUT', path: '/api/superadmin/admin/approval-workflows/:id' },
  { method: 'POST', path: '/api/sync-hub/connect' },
  { method: 'POST', path: '/api/sync-hub/disconnect/:integrationId' },
  { method: 'POST', path: '/api/system-health/alerts' },
  { method: 'DELETE', path: '/api/system-health/alerts/:id' },
  { method: 'POST', path: '/api/table-platform/ai-editor/proposals/:proposalId/apply' },
  { method: 'POST', path: '/api/table-platform/ai-editor/proposals/:proposalId/reject' },
  { method: 'POST', path: '/api/tasks' },
  { method: 'DELETE', path: '/api/tasks/:id' },
  { method: 'POST', path: '/api/test-support/bootstrap' },
  { method: 'POST', path: '/api/test-support/cleanup' },
  { method: 'POST', path: '/api/token-billing/api-keys' },
  { method: 'DELETE', path: '/api/token-billing/api-keys/:keyId' },
  { method: 'PUT', path: '/api/tool-assets/:toolSlug/:assetType' },
  { method: 'POST', path: '/api/tools' },
  { method: 'POST', path: '/api/tools-v4/entitlements' },
  { method: 'POST', path: '/api/tools-v4/entitlements/:entitlementId/deactivate' },
  { method: 'PUT', path: '/api/tools/:toolId' },
  { method: 'POST', path: '/api/trial/:trialId/convert' },
  { method: 'POST', path: '/api/trial/confirm-transition' },
  { method: 'POST', path: '/api/updates/:id/clicked' },
  { method: 'POST', path: '/api/updates/:id/opened' },
  { method: 'POST', path: '/api/v10/teresa/tts' },
  { method: 'POST', path: '/api/v10/teresa/voice-event' },
  { method: 'POST', path: '/api/v4-final/actions/:actionId/accept' },
  { method: 'POST', path: '/api/v4-final/actions/:actionId/execute' },
  { method: 'POST', path: '/api/virtual-workers' },
  { method: 'DELETE', path: '/api/virtual-workers/:id' },
  { method: 'POST', path: '/api/voice/stt' },
  { method: 'POST', path: '/api/voice/tts' },
  { method: 'POST', path: '/api/webhooks/:provider' },
  { method: 'POST', path: '/api/webhooks/github' },
  { method: 'POST', path: '/api/work-canvas/drafts' },
  { method: 'PUT', path: '/api/work-canvas/drafts/:draftId' },
  { method: 'PATCH', path: '/api/workbook/:id/cell' },
  { method: 'POST', path: '/api/workbook/:id/clone' },
  { method: 'DELETE', path: '/api/workstreams/:workstreamId' },
  { method: 'PATCH', path: '/api/workstreams/:workstreamId' },
];

/** `/api/x/:id` is a router pattern; the guard only ever sees a concrete path. */
const concrete = (path: string): string => path.replace(/:[A-Za-z0-9_]+/g, 'demo-1');

const isAllowlisted = (route: Route): boolean =>
  PUBLIC_DEMO_WRITE_ALLOWLIST.some(
    (entry) => entry.method === route.method && entry.path === route.path
  );

const label = (route: Route): string => `${route.method} ${route.path}`;

describe('public demo write allowlist — shape', () => {
  it('is exactly the five documented rows, and nothing else', () => {
    // A sixth row is a policy change and must not land silently. If this fails,
    // the added row needs its own justification and its own test above.
    expect(
      PUBLIC_DEMO_WRITE_ALLOWLIST.map((entry) => ({
        method: entry.method,
        path: entry.path,
        guarded: Boolean(entry.guard),
      }))
    ).toEqual([
      { method: 'POST', path: '/api/auth/logout', guarded: false },
      { method: 'POST', path: '/api/auth/revoke-all', guarded: false },
      { method: 'POST', path: '/api/auth/refresh', guarded: false },
      { method: 'POST', path: '/api/demo/toggle', guarded: true },
      { method: 'POST', path: '/api/demo/record-event', guarded: false },
    ]);
    expect(PUBLIC_DEMO_WRITE_ALLOWLIST).toHaveLength(5);
  });

  it('documents a reason for every row', () => {
    for (const entry of PUBLIC_DEMO_WRITE_ALLOWLIST) {
      expect(entry.why.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains no prefix-shaped entries', () => {
    // An entry ending in `/` or carrying a wildcard would turn the exact match
    // back into the prefix rule this ticket removed.
    for (const entry of PUBLIC_DEMO_WRITE_ALLOWLIST) {
      expect(entry.path).toMatch(/^\/api\/[a-z0-9/-]+[a-z0-9]$/);
      expect(entry.path).not.toContain('*');
    }
  });

  it('every row allows its own method+path', () => {
    for (const entry of PUBLIC_DEMO_WRITE_ALLOWLIST) {
      // `{enabled:false}` satisfies the only body guard and is ignored by the rest.
      expect(isWriteAllowedForPublicDemo(entry.method, entry.path, { enabled: false })).toBe(true);
    }
  });
});

describe('public demo write allowlist — the real route surface is denied', () => {
  it('covers a broad, non-trivial slice of the application', () => {
    expect(ROUTE_SURFACE.length).toBeGreaterThan(500);
    // No duplicate rows — a duplicate would inflate the count without adding cover.
    expect(new Set(ROUTE_SURFACE.map(label)).size).toBe(ROUTE_SURFACE.length);
  });

  it('intersects the allowlist in exactly the five documented rows', () => {
    // Pins the relationship in both directions: every allowlist row appears in
    // the enumerated surface (so it is a real route, not a typo), and no other
    // enumerated route is allowlisted.
    expect(ROUTE_SURFACE.filter(isAllowlisted).map(label).sort()).toEqual([
      'POST /api/auth/logout',
      'POST /api/auth/refresh',
      'POST /api/auth/revoke-all',
      'POST /api/demo/record-event',
      'POST /api/demo/toggle',
    ]);
  });

  it('denies every enumerated write route that is not on the allowlist', () => {
    const leaked: string[] = [];
    for (const route of ROUTE_SURFACE) {
      if (isAllowlisted(route)) continue;
      if (isWriteAllowedForPublicDemo(route.method, route.path)) leaked.push(label(route));
      const asRequested = concrete(route.path);
      if (isWriteAllowedForPublicDemo(route.method, asRequested)) {
        leaked.push(`${route.method} ${asRequested}`);
      }
    }
    expect(leaked).toEqual([]);
  });

  it('denies them with a body attached too — no body shape buys a pass', () => {
    // The only body guard in the table is scoped to `/api/demo/toggle`; a body
    // that satisfies it must not unlock any other path.
    const leaked: string[] = [];
    for (const route of ROUTE_SURFACE) {
      if (isAllowlisted(route)) continue;
      for (const body of [{ enabled: false }, { enabled: true }, {}, null, 'false']) {
        if (isWriteAllowedForPublicDemo(route.method, concrete(route.path), body)) {
          leaked.push(`${label(route)} ← ${JSON.stringify(body)}`);
        }
      }
    }
    expect(leaked).toEqual([]);
  });
});

/**
 * The routes the ticket calls out by name. These are all inside `/api/auth/` or
 * `/api/demo/`, i.e. every one of them was reachable under the old prefix rule.
 * They get individual assertions rather than being buried in the bulk loop so a
 * regression names the endpoint it reopened.
 */
const CALLOUTS: ReadonlyArray<[string, string, string]> = [
  ['POST', '/api/auth/switch-organization', 'would re-seat the demo user in another tenant'],
  ['POST', '/api/auth/change-password', 'would take over the shared demo credential'],
  ['POST', '/api/auth/mfa/setup', 'would bind an attacker factor to the demo account'],
  ['POST', '/api/auth/mfa/enable', 'would lock the demo account to an attacker factor'],
  ['POST', '/api/auth/mfa/disable', 'would strip a factor'],
  ['POST', '/api/auth/register', 'account creation is not a read-only demo action'],
  ['POST', '/api/auth/register-demo', 'provisioning: unbounded demo orgs from inside a demo'],
  ['POST', '/api/auth/reset-password', 'credential reset for an arbitrary address'],
  ['POST', '/api/auth/forgot-password', 'mail-sending oracle for arbitrary addresses'],
  ['POST', '/api/auth/verify-email', 'identity assertion'],
  ['POST', '/api/auth/resend-verification', 'mail-sending oracle'],
  ['POST', '/api/auth/revert-impersonation', 'privilege transition'],
  ['POST', '/api/auth/login', 'credential minting'],
  ['POST', '/api/auth/demo-login', 'credential minting'],
  ['POST', '/api/auth/login-history', 'writes to the audit trail'],
  ['DELETE', '/api/auth/sessions/demo-1', 'kills another session'],
];

describe('public demo write allowlist — named high-risk auth routes', () => {
  it.each(CALLOUTS)('denies %s %s (%s)', (method, path) => {
    expect(isWriteAllowedForPublicDemo(method, path)).toBe(false);
  });

  it.each(CALLOUTS)('denies %s %s regardless of body (%s)', (method, path) => {
    expect(isWriteAllowedForPublicDemo(method, path, { enabled: false })).toBe(false);
  });
});

/**
 * Invitations, access codes, admin and self-service. Paths verified against the
 * routers, not invented: `/api/invitations*` (invitations.routes.ts),
 * `/api/access-codes*` and `/api/admin/access-codes` (accessCodes.routes.ts,
 * access-control.routes.ts), `/api/superadmin/*`, `/api/users*`, `/api/user/*`.
 */
const TENANT_MUTATIONS: ReadonlyArray<[string, string]> = [
  ['POST', '/api/invitations'],
  ['POST', '/api/invitations/accept'],
  ['POST', '/api/invitations/org'],
  ['POST', '/api/invitations/project'],
  ['POST', '/api/invitations/resend'],
  ['POST', '/api/invitations/demo-1/resend'],
  ['POST', '/api/invitations/demo-1/revoke'],
  ['DELETE', '/api/invitations/demo-1'],
  ['POST', '/api/project-members/demo-1/invite'],
  ['POST', '/api/superadmin/users/invite'],
  ['POST', '/api/access-codes/generate'],
  ['POST', '/api/access-codes/accept'],
  ['POST', '/api/access-codes/demo-1/revoke'],
  ['POST', '/api/admin/access-codes'],
  ['POST', '/api/superadmin/access-codes'],
  ['POST', '/api/superadmin/access-codes/demo-1/deactivate'],
];

describe('public demo write allowlist — invitations, access codes, tenant admin', () => {
  it.each(TENANT_MUTATIONS)('denies %s %s', (method, path) => {
    expect(isWriteAllowedForPublicDemo(method, path)).toBe(false);
  });
});

describe('public demo write allowlist — /api/demo/toggle body guard', () => {
  // Leaving demo mode is a teardown the client needs. ENTERING it is a
  // provisioning operation, and must never ride the leave-demo exception. The
  // guard therefore allowlists the path only for an explicit falsey `enabled`.
  const LEAVING: ReadonlyArray<[string, unknown]> = [
    ['boolean false', { enabled: false }],
    ["string 'false'", { enabled: 'false' }],
    ['number 0', { enabled: 0 }],
    ["string '0'", { enabled: '0' }],
  ];

  const NOT_LEAVING: ReadonlyArray<[string, unknown]> = [
    ['boolean true', { enabled: true }],
    ["string 'true'", { enabled: 'true' }],
    ['number 1', { enabled: 1 }],
    ['empty object', {}],
    ['null body', null],
    ['undefined body', undefined],
    ['array body', []],
    ['array wrapping a leave payload', [{ enabled: false }]],
    ['string body', 'enabled=false'],
    ['JSON string body', '{"enabled":false}'],
    ['number body', 0],
    ["ambiguous 'yes'", { enabled: 'yes' }],
    ["ambiguous 'no'", { enabled: 'no' }],
    ['null enabled', { enabled: null }],
    ['undefined enabled', { enabled: undefined }],
    ["cased 'False'", { enabled: 'False' }],
    ['empty-string enabled', { enabled: '' }],
    ['NaN enabled', { enabled: NaN }],
    ['wrong key', { disabled: true }],
  ];

  it.each(LEAVING)('allows leaving demo mode — %s', (_name, body) => {
    expect(isWriteAllowedForPublicDemo('POST', '/api/demo/toggle', body)).toBe(true);
  });

  it.each(NOT_LEAVING)('denies %s', (_name, body) => {
    expect(isWriteAllowedForPublicDemo('POST', '/api/demo/toggle', body)).toBe(false);
  });

  it('omits the body argument entirely — denied', () => {
    expect(isWriteAllowedForPublicDemo('POST', '/api/demo/toggle')).toBe(false);
  });

  it('never lets through a body the toggle route itself would read as ENABLE', () => {
    // The property that actually matters, stated against the handler rather than
    // against the guard's own wording. `demo.routes.ts` decides with
    //   const isDemoEnabled = enabled === true || enabled === 'true' || enabled === 1;
    // so a body is only safe to allow if that expression is false for it. The
    // guard is deliberately STRICTER than the inverse of this (it demands an
    // explicit false/'false'/0/'0' rather than accepting anything non-truthy),
    // which fails closed — some legitimate leaves are refused, no entry is
    // allowed. This asserts the direction that must never invert.
    const routeWouldEnable = (body: unknown): boolean => {
      const enabled = (body as { enabled?: unknown } | null | undefined)?.enabled;
      return enabled === true || enabled === 'true' || enabled === 1;
    };
    const candidates: unknown[] = [
      { enabled: true },
      { enabled: 'true' },
      { enabled: 1 },
      { enabled: false },
      { enabled: 'false' },
      { enabled: 0 },
      { enabled: '0' },
      { enabled: 'yes' },
      { enabled: null },
      {},
      null,
      undefined,
    ];
    for (const body of candidates) {
      if (isWriteAllowedForPublicDemo('POST', '/api/demo/toggle', body)) {
        expect(routeWouldEnable(body)).toBe(false);
      }
    }
  });

  it('still applies the guard through a normalized path', () => {
    // The body guard must not be skippable by dressing the path up.
    expect(isWriteAllowedForPublicDemo('POST', '/api/demo/toggle/?x=1', { enabled: true })).toBe(
      false
    );
    expect(isWriteAllowedForPublicDemo('POST', '//API//Demo//Toggle', { enabled: true })).toBe(
      false
    );
    expect(isWriteAllowedForPublicDemo('POST', '//API//Demo//Toggle', { enabled: false })).toBe(
      true
    );
  });
});

describe('public demo write allowlist — path normalization cannot be talked into a match', () => {
  const BYPASS_ATTEMPTS: ReadonlyArray<[string, string]> = [
    ['traversal out of an allowed path', '/api/auth/logout/../change-password'],
    ['traversal through the mount', '/api/auth/../auth/change-password'],
    ['bare traversal segment', '/api/auth/../../api/auth/change-password'],
    ['percent-encoded dot-dot', '/api/auth/%2e%2e/change-password'],
    ['percent-encoded slash + dot-dot', '/api/auth/logout%2f..%2fchange-password'],
    ['fully encoded traversal', '/api/auth/logout%2F%2E%2E%2Fchange-password'],
    ['double-encoded traversal', '/api/auth/%252e%252e/change-password'],
    ['undecodable escape', '/api/auth/%zz'],
    ['undecodable escape on an allowed path', '/api/auth/logout%'],
    ['truncated escape', '/api/auth/logout%2'],
    ['backslash separator', '/api/auth\\change-password'],
    ['backslash traversal', '/api/auth/logout\\..\\change-password'],
    ['encoded backslash', '/api/auth/logout%5c..%5cchange-password'],
    ['raw null byte', '/api/auth/logout\0/change-password'],
    ['encoded null byte', '/api/auth/logout%00'],
    ['encoded null byte suffix on a denied path', '/api/auth/change-password%00'],
    ['double slashes on a denied path', '//api//auth//change-password'],
    ['trailing slash on a denied path', '/api/auth/change-password/'],
    ['many trailing slashes on a denied path', '/api/auth/change-password///'],
    ['upper-cased denied path', '/API/AUTH/CHANGE-PASSWORD'],
    ['mixed-case denied path', '/Api/Auth/Change-Password'],
    ['query string on a denied path', '/api/auth/change-password?x=1'],
    ['fragment on a denied path', '/api/auth/change-password#frag'],
    ['allowed path as a prefix of a denied one', '/api/auth/logout-all'],
    ['allowed path with an extra segment', '/api/auth/logout/all'],
    ['allowed path with an extra segment (refresh)', '/api/auth/refresh/token'],
    ['demo prefix with an extra segment', '/api/demo/toggle/enable'],
    ['relative path', 'api/auth/logout'],
    ['protocol-absolute path', 'http://evil.test/api/auth/logout'],
    ['empty path', ''],
    ['bare slash', '/'],
  ];

  it.each(BYPASS_ATTEMPTS)('denies %s — %s', (_name, path) => {
    expect(isWriteAllowedForPublicDemo('POST', path)).toBe(false);
  });

  it.each(BYPASS_ATTEMPTS)('denies %s with a leave-demo body — %s', (_name, path) => {
    // Attaching the one body the guard likes must not rescue a hostile path.
    expect(isWriteAllowedForPublicDemo('POST', path, { enabled: false })).toBe(false);
  });

  const NORMALIZER_REJECTS: ReadonlyArray<[string, string]> = [
    ['traversal', '/api/auth/logout/../change-password'],
    ['percent-encoded traversal', '/api/auth/%2e%2e/change-password'],
    ['undecodable escape', '/api/auth/%zz'],
    ['backslash', '/api/auth\\change-password'],
    ['null byte', '/api/auth/logout\0'],
    ['relative path', 'api/auth/logout'],
    ['empty path', ''],
  ];

  it.each(NORMALIZER_REJECTS)('normalizeGuardPath returns null for %s', (_name, path) => {
    // null is the deny signal; anything that reduces it to a string would be a
    // path the exact match could then be argued about.
    expect(normalizeGuardPath(path)).toBeNull();
  });

  const BENIGN: ReadonlyArray<[string, string]> = [
    ['trailing slash', '/api/auth/logout/'],
    ['repeated trailing slashes', '/api/auth/logout///'],
    ['leading double slash', '//api/auth/logout'],
    ['internal double slashes', '/api//auth//logout'],
    ['upper case', '/API/AUTH/LOGOUT'],
    ['mixed case', '/API/Auth/Logout'],
    ['query string', '/api/auth/logout?x=1'],
    ['fragment', '/api/auth/logout#done'],
    ['query string with a traversal-looking value', '/api/auth/logout?next=../admin'],
    ['everything at once', '//API//Auth//Logout/?x=1'],
  ];

  it.each(BENIGN)('still allows the real logout route with %s — %s', (_name, path) => {
    // The normalizer has to keep working for the shapes a real client sends,
    // otherwise a demo user cannot log out.
    expect(isWriteAllowedForPublicDemo('POST', path)).toBe(true);
    expect(normalizeGuardPath(path)).toBe('/api/auth/logout');
  });
});

describe('expired demo principal — a strictly smaller door', () => {
  const STILL_OPEN = ['/api/auth/logout', '/api/auth/revoke-all'];

  it.each(STILL_OPEN)('lets a lapsed principal reach %s to drop its credentials', (path) => {
    expect(isPathAllowedForExpiredDemo(path)).toBe(true);
  });

  const CLOSED = [
    // No refresh: there is nothing left to refresh into.
    '/api/auth/refresh',
    // No demo routes: the session is over.
    '/api/demo/toggle',
    '/api/demo/record-event',
    '/api/demo/status',
    // Everything else, same as a live demo principal.
    '/api/auth/change-password',
    '/api/auth/switch-organization',
    '/api/auth/login',
    '/api/auth/register-demo',
    // The route name the old implementation used; it does not exist.
    '/api/auth/logout-all',
    // The old implementation matched `${allowed}/` as a prefix.
    '/api/auth/logout/everywhere',
    '/api/auth/revoke-all/now',
    // Bypass shapes.
    '/api/auth/logout/../change-password',
    '/api/auth/%2e%2e/logout',
    '/api/auth/%zz',
    '/api/auth/logout\\..\\change-password',
    '/api/auth/logout\0',
    '',
  ];

  it.each(CLOSED)('refuses a lapsed principal at %s', (path) => {
    expect(isPathAllowedForExpiredDemo(path)).toBe(false);
  });

  it('normalizes the two open paths the same way the live guard does', () => {
    for (const path of ['/api/auth/logout/', '//api/auth/logout', '/API/Auth/Logout?x=1']) {
      expect(isPathAllowedForExpiredDemo(path)).toBe(true);
    }
  });

  it('is a strict subset of the live write allowlist', () => {
    const live = PUBLIC_DEMO_WRITE_ALLOWLIST.map((entry) => entry.path);
    const expiredOpen = live.filter((path) => isPathAllowedForExpiredDemo(path));
    expect(expiredOpen.sort()).toEqual(['/api/auth/logout', '/api/auth/revoke-all']);
    expect(expiredOpen.length).toBeLessThan(live.length);
  });
});

describe('public demo write allowlist — method handling', () => {
  const DENIED_PATH = '/api/auth/change-password';

  it.each(['GET', 'HEAD', 'OPTIONS', 'get', 'head', 'options'])(
    '%s passes even on a denied path — read-only means read',
    (method) => {
      expect(isWriteAllowedForPublicDemo(method, DENIED_PATH)).toBe(true);
    }
  );

  it('GET passes on a path the normalizer would reject', () => {
    // Reads never reach the allowlist, so path shape is irrelevant for them.
    expect(isWriteAllowedForPublicDemo('GET', '/api/auth/%zz')).toBe(true);
  });

  it.each(['PUT', 'PATCH', 'DELETE', 'TRACE', 'CONNECT', ''])(
    '%s is denied on an ALLOWED path — the match is method-exact',
    (method) => {
      expect(isWriteAllowedForPublicDemo(method, '/api/auth/logout')).toBe(false);
    }
  );

  it.each(['PUT', 'PATCH', 'DELETE'])('%s is denied on /api/demo/toggle even when leaving', (method) => {
    expect(isWriteAllowedForPublicDemo(method, '/api/demo/toggle', { enabled: false })).toBe(false);
  });

  it.each(['post', 'PoSt'])('%s is normalized to POST for an allowed row', (method) => {
    expect(isWriteAllowedForPublicDemo(method, '/api/auth/logout')).toBe(true);
  });

  it('a missing method is denied', () => {
    expect(isWriteAllowedForPublicDemo(undefined as unknown as string, '/api/auth/logout')).toBe(
      false
    );
  });
});
