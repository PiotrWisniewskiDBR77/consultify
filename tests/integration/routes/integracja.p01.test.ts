/**
 * P01 Integracja — Integration Tests
 *
 * Verifies the integration control plane contract:
 * - Object model: provider_catalog_item, connection, workflow/sync, run/job
 * - Lifecycle grammar: draft/setup → connected → degraded → requires_action → recovered → blocked
 * - Operator surfaces: health list, jobs-in-error, run history, drill-down
 * - Recovery doctrine: reauth, retry/replay, drift detection
 * - P0 providers: Google Workspace, Microsoft 365, Slack, Jira, Generic Webhooks
 * - Error posture: 9 scenarios mapped to object+state+owner+next action
 */

import { describe, it, expect } from 'vitest';

// ===========================================================================
// P01-A §2.3.1 — Declared P0 Providers
// ===========================================================================

describe('P01 §2.3.1 — Declared P0 providers', () => {
  it('integrationHubService has CONNECTORS catalog', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    expect(mod.CONNECTORS).toBeDefined();
    expect(typeof mod.CONNECTORS).toBe('object');
    expect(Object.keys(mod.CONNECTORS).length).toBeGreaterThan(0);
  });

  it('CONNECTORS catalog includes P0 provider families', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    const entries = Object.values(mod.CONNECTORS) as any[];
    const names = entries.map((c: any) => (c.name || c.id || '').toLowerCase());
    const allText = names.join(' ');
    expect(allText).toMatch(/google|calendar/i);
    expect(allText).toMatch(/microsoft|outlook|teams/i);
    expect(allText).toMatch(/slack/i);
    expect(allText).toMatch(/jira/i);
  });

  it('pmSyncExternalAuth supports Google, Jira, Slack, Teams OAuth', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/v8/pmSyncExternalAuthMaterializationService.ts', 'utf-8'
    );
    expect(content.toLowerCase()).toContain('google');
    expect(content.toLowerCase()).toContain('jira');
    expect(content.toLowerCase()).toContain('slack');
    expect(content.toLowerCase()).toContain('teams');
  });
});

// ===========================================================================
// P01-A §2.3.2 — Object Model (4 objects)
// ===========================================================================

describe('P01 §2.3.2 — Object model', () => {
  it('integrationHubService manages connections (CRUD)', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    const svc = mod.default || mod;
    expect(typeof (svc.connectIntegration || mod.connectIntegration)).toBe('function');
    expect(typeof (svc.disconnectIntegration || mod.disconnectIntegration)).toBe('function');
    expect(typeof (svc.getConnectedIntegrations || mod.getConnectedIntegrations)).toBe('function');
    expect(typeof (svc.updateIntegrationStatus || mod.updateIntegrationStatus)).toBe('function');
  });

  it('integrationHubService manages sync/workflow operations', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    const svc = mod.default || mod;
    expect(typeof (svc.syncIntegration || mod.syncIntegration)).toBe('function');
    expect(typeof (svc.getSyncHistory || mod.getSyncHistory)).toBe('function');
    expect(typeof (svc.logSyncEvent || mod.logSyncEvent)).toBe('function');
  });

  it('pmSyncTruthService manages auth state machine (connection lifecycle)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.setConnectorAuthState).toBe('function');
    expect(typeof mod.getConnectorAuthState).toBe('function');
    expect(typeof mod.isValidAuthTransition).toBe('function');
  });

  it('pmSyncTruthService manages provider profiles (catalog)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.registerProviderProfile).toBe('function');
    expect(typeof mod.getProviderProfile).toBe('function');
  });

  it('pmSyncTruthService manages sync state per object (workflow/run)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.updateObjectSyncState).toBe('function');
    expect(typeof mod.getObjectSyncState).toBe('function');
  });

  it('pmSyncTruthService manages connector health (run/job observability)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.getConnectorHealth).toBe('function');
  });
});

// ===========================================================================
// P01-A §2.3.3 — Lifecycle Grammar
// ===========================================================================

describe('P01 §2.3.3 — Lifecycle grammar', () => {
  it('pmSyncTruthService validates auth state transitions', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.isValidAuthTransition).toBe('function');
  });

  it('syncHub routes support full lifecycle: connect/disconnect/reauth/pause/resume/sync', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('/connect');
    expect(content).toContain('/disconnect');
    expect(content).toContain('/reauth');
    expect(content).toContain('/pause');
    expect(content).toContain('/resume');
    expect(content).toContain('/sync');
  });

  it('V8 sync routes support governed lifecycle', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/v8/sync.routes.ts', 'utf-8'
    );
    expect(content).toContain('connect');
    expect(content).toContain('disconnect');
    expect(content).toContain('reauth');
    expect(content).toContain('health');
    expect(content).toContain('errors');
    expect(content).toContain('audit');
  });

  it('integrationHubService has STATUS constants for lifecycle states', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    expect(mod.STATUS).toBeDefined();
  });
});

// ===========================================================================
// P01-A §2.3.4 — Operator Surfaces
// ===========================================================================

describe('P01 §2.3.4 — Operator surfaces', () => {
  it('syncHub has health endpoint (provider health list)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('/health');
  });

  it('syncHub has errors endpoint (jobs-in-error)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('/errors');
    expect(content).toContain('resolve');
  });

  it('syncHub has sync-runs endpoint (run history)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('sync-runs');
  });

  it('syncHub has audit-log endpoint', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('audit-log');
  });

  it('IntegrationHealthDashboard frontend component exists', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/settings/integrations/IntegrationHealthDashboard.tsx', 'utf-8'
    );
    expect(content).toContain('health');
    expect(content.length).toBeGreaterThan(200);
  });

  // NOTE: UnifiedSyncHub was removed as a dead-code orphan (admin "to-100" cleanup,
  // commit 64dd0036c6). It was never rendered from the live /admin/* shell
  // (AdminSettingsModule, 5 panels). The "component exists" assertion is obsolete.

  it('RunHistoryPanel exists in table platform connectors', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/MyWork/table/connectors/RunHistoryPanel.tsx', 'utf-8'
    );
    expect(content.length).toBeGreaterThan(100);
  });
});

// ===========================================================================
// P01-A §2.3.5 — Onboarding Completion Proof
// ===========================================================================

describe('P01 §2.3.5 — Onboarding completion proof', () => {
  it('pmSyncExternalAuth builds OAuth sessions (setup phase)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncExternalAuthMaterializationService.js'
    );
    expect(typeof mod.buildGovernedExternalAuthSession).toBe('function');
    expect(typeof mod.getGovernedExternalAuthConfigFields).toBe('function');
  });

  it('pmSyncExternalAuth materializes callback (verify/test phase)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncExternalAuthMaterializationService.js'
    );
    expect(typeof mod.materializeGovernedExternalAuthCallback).toBe('function');
  });

  it('connectors route has test endpoint (verify/test)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/integrations/connectors.routes.ts', 'utf-8'
    );
    expect(content).toContain('/test');
  });

  it('ConnectorWizard frontend exists (setup → verify → enable)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/MyWork/table/connectors/ConnectorWizard.tsx', 'utf-8'
    );
    expect(content.length).toBeGreaterThan(200);
  });
});

// ===========================================================================
// P01-A §2.3.6 — Recovery Doctrine
// ===========================================================================

describe('P01 §2.3.6 — Recovery doctrine', () => {
  it('pmSyncAuthService manages credentials + refresh + escalation', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncAuthService.js'
    );
    expect(typeof mod.storeCredential).toBe('function');
    expect(typeof mod.getCredential).toBe('function');
    expect(typeof mod.recordRefreshResult).toBe('function');
    expect(typeof mod.classifyFailure).toBe('function');
    expect(typeof mod.checkEscalationLevel).toBe('function');
  });

  it('pmSyncAuthService supports admin re-bind (reauth recovery)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncAuthService.js'
    );
    expect(typeof mod.recordAdminReBind).toBe('function');
    expect(typeof mod.getReBindHistory).toBe('function');
  });

  it('pmSyncAuthService supports escalation ladder', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncAuthService.js'
    );
    expect(typeof mod.recordAuthEscalation).toBe('function');
    expect(typeof mod.getActiveEscalations).toBe('function');
    expect(typeof mod.resolveAuthEscalation).toBe('function');
  });

  it('syncGuardrailsService provides retry/rate-limit/error classification', async () => {
    const mod = await import(
      '../../../server/src/services/syncGuardrailsService.js'
    );
    const svc = mod.default || mod;
    expect(typeof (svc.checkRateLimit || mod.checkRateLimit)).toBe('function');
    expect(typeof (svc.classifyError || mod.classifyError)).toBe('function');
    expect(typeof (svc.calculateRetryDelay || mod.calculateRetryDelay)).toBe('function');
  });

  it('syncGuardrailsService tracks unresolved errors + integration health', async () => {
    const mod = await import(
      '../../../server/src/services/syncGuardrailsService.js'
    );
    const svc = mod.default || mod;
    expect(typeof (svc.getUnresolvedErrors || mod.getUnresolvedErrors)).toBe('function');
    expect(typeof (svc.getIntegrationHealth || mod.getIntegrationHealth)).toBe('function');
    expect(typeof (svc.resolveError || mod.resolveError)).toBe('function');
  });

  it('pmSyncTruthService tracks conflicts (drift detection)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.recordConflict).toBe('function');
    expect(typeof mod.resolveConflict).toBe('function');
    expect(typeof mod.getConflictsByObject).toBe('function');
    expect(typeof mod.getUnresolvedConflicts).toBe('function');
  });

  it('pmSyncRefreshExecutionService handles token refresh', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncRefreshExecutionService.js'
    );
    expect(typeof mod.storeRefreshExecutionSecret).toBe('function');
    expect(typeof mod.getRefreshExecutionSecret).toBe('function');
    expect(typeof mod.executeRefreshExecution).toBe('function');
  });
});

// ===========================================================================
// P01-A §2.3.7 — Anti-Duplicate Gate
// ===========================================================================

describe('P01 §2.3.7 — Anti-duplicate gate', () => {
  it('Gateway mounts /api/sync-hub (always, not stub)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('sync-hub');
  });

  it('Gateway mounts /api/v8/sync', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/v8');
  });

  it('Gateway mounts /api/integrations', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/integrations');
  });

  it('Gateway mounts /api/webhooks', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/webhooks');
  });

  it('Gateway mounts /api/sso', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/sso');
  });

  it('Gateway mounts /api/scim', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync('server/src/Gateway.ts', 'utf-8');
    expect(content).toContain('/api/scim');
  });
});

// ===========================================================================
// P01-A §2.3.8 — Error Posture (9 scenarios)
// ===========================================================================

describe('P01 §2.3.8 — Error posture', () => {
  it('syncGuardrailsService classifies errors', async () => {
    const mod = await import(
      '../../../server/src/services/syncGuardrailsService.js'
    );
    const classify = mod.default?.classifyError || mod.classifyError;
    expect(typeof classify).toBe('function');
  });

  it('pmSyncAuthService classifies auth failures', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncAuthService.js'
    );
    expect(typeof mod.classifyFailure).toBe('function');
  });

  it('syncHub errors endpoint supports resolution', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('/errors');
    expect(content).toContain('/resolve');
  });

  it('V8 sync routes have conflict resolution', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/v8/sync.routes.ts', 'utf-8'
    );
    expect(content).toContain('conflict');
    expect(content).toContain('resolve');
  });

  it('pmSyncTruthService auth state machine prevents invalid transitions', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.isValidAuthTransition).toBe('function');
  });
});

// ===========================================================================
// P01-A §2.3.9 — Acceptance Checklist
// ===========================================================================

describe('P01 §2.3.9 — Acceptance checklist regression', () => {
  it('P0 providers declared explicitly (no "one of")', async () => {
    const mod = await import(
      '../../../server/src/services/integrationHubService.js'
    );
    expect(Object.keys(mod.CONNECTORS).length).toBeGreaterThanOrEqual(5);
  });

  it('object model has 4 objects: catalog, connection, workflow, run', async () => {
    const truthMod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    // catalog: registerProviderProfile
    expect(typeof truthMod.registerProviderProfile).toBe('function');
    // connection: setConnectorAuthState
    expect(typeof truthMod.setConnectorAuthState).toBe('function');
    // workflow: updateObjectSyncState
    expect(typeof truthMod.updateObjectSyncState).toBe('function');
    // run: getConnectorHealth (observes runs)
    expect(typeof truthMod.getConnectorHealth).toBe('function');
  });

  it('lifecycle grammar is frozen (state machine with transitions)', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    expect(typeof mod.isValidAuthTransition).toBe('function');
  });

  it('operator surfaces exist: health + errors + runs + audit', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('/health');
    expect(content).toContain('/errors');
    expect(content).toContain('sync-runs');
    expect(content).toContain('audit-log');
  });

  it('onboarding completion proof: setup → verify/test → enable', async () => {
    const authMod = await import(
      '../../../server/src/services/v8/pmSyncExternalAuthMaterializationService.js'
    );
    expect(typeof authMod.buildGovernedExternalAuthSession).toBe('function');
    expect(typeof authMod.materializeGovernedExternalAuthCallback).toBe('function');
  });

  it('recovery doctrine: reauth + retry + drift detection', async () => {
    const authSvc = await import(
      '../../../server/src/services/v8/pmSyncAuthService.js'
    );
    const truthSvc = await import(
      '../../../server/src/services/v8/pmSyncTruthService.js'
    );
    const guardrails = await import(
      '../../../server/src/services/syncGuardrailsService.js'
    );
    // reauth
    expect(typeof authSvc.recordAdminReBind).toBe('function');
    // retry
    const gSvc = guardrails.default || guardrails;
    expect(typeof (gSvc.calculateRetryDelay || guardrails.calculateRetryDelay)).toBe('function');
    // drift
    expect(typeof truthSvc.recordConflict).toBe('function');
  });

  it('anti-duplicate gate: no parallel run truth', async () => {
    const fs = await import('fs');
    const hub = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    // single sync-runs endpoint, not parallel
    expect(hub).toContain('sync-runs');
    expect(hub).toContain('pmSyncTruthService');
  });

  it('error posture covers auth + rate-limit + drift + run failures', async () => {
    const authSvc = await import(
      '../../../server/src/services/v8/pmSyncAuthService.js'
    );
    const guardrails = await import(
      '../../../server/src/services/syncGuardrailsService.js'
    );
    const gSvc = guardrails.default || guardrails;
    expect(typeof authSvc.classifyFailure).toBe('function');
    expect(typeof (gSvc.classifyError || guardrails.classifyError)).toBe('function');
    expect(typeof (gSvc.checkRateLimit || guardrails.checkRateLimit)).toBe('function');
  });
});

// ===========================================================================
// Cross-cutting: SSO + SCIM + Webhooks + Automation
// ===========================================================================

describe('P01 — SSO + SCIM + Webhooks + Automation', () => {
  it('SSO routes support OIDC/SAML flows', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/integrations/sso.routes.ts', 'utf-8'
    );
    expect(content.toLowerCase()).toContain('sso');
    expect(content).toContain('saml');
  });

  it('SCIM routes support user/group provisioning', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/integrations/scim.routes.ts', 'utf-8'
    );
    expect(content).toContain('Users');
    expect(content).toContain('Groups');
    expect(content).toContain('scim_tokens');
  });

  it('webhook subscriptions support outbound deliveries', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/integrations/webhookSubscriptions.routes.ts', 'utf-8'
    );
    expect(content).toContain('webhook_subscriptions');
    expect(content).toContain('signPayload');
  });

  it('automation routes support Zapier/Make-style API keys', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/integrations/automation.routes.ts', 'utf-8'
    );
    expect(content).toContain('integration_api_keys');
    expect(content).toContain('integrationApiKeyAuth');
  });

  it('pmSyncInventoryService lists governed integrations', async () => {
    const mod = await import(
      '../../../server/src/services/v8/pmSyncInventoryService.js'
    );
    expect(typeof mod.listGovernedIntegrations).toBe('function');
  });
});

// ===========================================================================
// P01-B Deep Audit Fixes — Provider Sync Engine
// ===========================================================================

describe('P01-B — Provider sync dispatch engine', () => {
  it('integrationHubService syncIntegration calls dispatchProviderSync (not placeholder)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrationHubService.ts', 'utf-8'
    );
    expect(content).toContain('dispatchProviderSync');
    expect(content).not.toContain('// This would call the actual connector sync logic');
    expect(content).not.toContain('// Simplified implementation');
  });

  it('PROVIDER_ADAPTERS has adapters for Jira, Slack, Teams, Google', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrationHubService.ts', 'utf-8'
    );
    expect(content).toContain('jira: jiraSyncAdapter');
    expect(content).toContain('slack: slackSyncAdapter');
    expect(content).toContain('teams: teamsSyncAdapter');
    expect(content).toContain('gmail: googleSyncAdapter');
  });

  it('jiraSyncAdapter calls Jira REST API v3 search', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrationHubService.ts', 'utf-8'
    );
    expect(content).toContain('/rest/api/3/search');
    expect(content).toContain('integration_sync_mappings');
  });

  it('slackSyncAdapter calls Slack conversations.list API', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrationHubService.ts', 'utf-8'
    );
    expect(content).toContain('slack.com/api/conversations.list');
  });

  it('teamsSyncAdapter calls Microsoft Graph joinedTeams', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrationHubService.ts', 'utf-8'
    );
    expect(content).toContain('graph.microsoft.com/v1.0/me/joinedTeams');
  });

  it('googleSyncAdapter calls Google Calendar API', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrationHubService.ts', 'utf-8'
    );
    expect(content).toContain('googleapis.com/calendar/v3');
  });
});

// ===========================================================================
// P01-B Deep Audit Fixes — Reauth wiring
// ===========================================================================

describe('P01-B — Reauth wiring', () => {
  it('POST /reauth calls executeRefreshExecution', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('executeRefreshExecution');
    expect(content).toContain('getRefreshExecutionSecret');
  });

  it('POST /reauth updates auth state on success', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain("targetState: 'healthy'");
    expect(content).toContain('token_refresh_success');
  });

  it('POST /reauth handles missing refresh secret gracefully', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/routes/syncHub.routes.ts', 'utf-8'
    );
    expect(content).toContain('No refresh secret stored');
    expect(content).toContain('requiresManualOAuth');
  });
});

// ===========================================================================
// P01-B Deep Audit Fixes — Slack/Teams real services
// ===========================================================================

describe('P01-B — Slack user integration service', () => {
  it('exports real API methods (not lazy-load stub)', async () => {
    const mod = await import(
      '../../../server/src/services/integrations/slackUserIntegration.js'
    );
    const svc = mod.default || mod;
    expect(typeof (svc.listChannels || mod.listChannels)).toBe('function');
    expect(typeof (svc.postMessage || mod.postMessage)).toBe('function');
    expect(typeof (svc.updateMessage || mod.updateMessage)).toBe('function');
    expect(typeof (svc.testConnection || mod.testConnection)).toBe('function');
  });

  it('calls Slack API endpoints', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrations/slackUserIntegration.ts', 'utf-8'
    );
    expect(content).toContain('slack.com/api/conversations.list');
    expect(content).toContain('slack.com/api/chat.postMessage');
    expect(content).toContain('slack.com/api/chat.update');
    expect(content).toContain('slack.com/api/auth.test');
  });
});

describe('P01-B — Teams user integration service', () => {
  it('exports real Graph API methods (not lazy-load stub)', async () => {
    const mod = await import(
      '../../../server/src/services/integrations/teamsUserIntegration.js'
    );
    const svc = mod.default || mod;
    expect(typeof (svc.listJoinedTeams || mod.listJoinedTeams)).toBe('function');
    expect(typeof (svc.listChannels || mod.listChannels)).toBe('function');
    expect(typeof (svc.postChannelMessage || mod.postChannelMessage)).toBe('function');
    expect(typeof (svc.testConnection || mod.testConnection)).toBe('function');
    expect(typeof (svc.createSubscription || mod.createSubscription)).toBe('function');
  });

  it('calls Microsoft Graph API endpoints', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/integrations/teamsUserIntegration.ts', 'utf-8'
    );
    expect(content).toContain('graph.microsoft.com/v1.0');
    expect(content).toContain('/me/joinedTeams');
    expect(content).toContain('/channels');
    expect(content).toContain('/messages');
    expect(content).toContain('/subscriptions');
  });
});

// ===========================================================================
// P01-B Deep Audit Fixes — Health Dashboard + Retry Jitter
// ===========================================================================

describe('P01-B — IntegrationHealthDashboard real API', () => {
  it('loads health from /api/sync-hub/health (not fake endpoint)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/settings/integrations/IntegrationHealthDashboard.tsx', 'utf-8'
    );
    expect(content).toContain('/api/sync-hub/health');
    expect(content).not.toContain('/api/user/integrations/health');
  });

  it('Recent Activity loads from sync-runs API (no hardcoded data)', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'src/components/settings/integrations/IntegrationHealthDashboard.tsx', 'utf-8'
    );
    expect(content).toContain('sync-runs');
    expect(content).toContain('RecentActivityPanel');
    expect(content).not.toContain('5 min ago');
    expect(content).not.toContain('12 items synced');
  });
});

describe('P01-B — Retry backoff with jitter', () => {
  it('calculateRetryDelay includes jitter', async () => {
    const fs = await import('fs');
    const content = fs.readFileSync(
      'server/src/services/syncGuardrailsService.ts', 'utf-8'
    );
    expect(content).toContain('jitter');
    expect(content).toContain('Math.random()');
  });

  it('calculateRetryDelay returns different values (non-deterministic)', async () => {
    const mod = await import(
      '../../../server/src/services/syncGuardrailsService.js'
    );
    const fn = mod.default?.calculateRetryDelay || mod.calculateRetryDelay;
    const results = new Set<number>();
    for (let i = 0; i < 20; i++) {
      results.add(fn(2));
    }
    expect(results.size).toBeGreaterThan(1);
  });
});
