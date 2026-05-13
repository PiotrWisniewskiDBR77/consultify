import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../..');

function read(relativePath: string) {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

describe('Wave 3 AI actions governance contract', () => {
  it('persists AIRun ledger and audit events for governed actions', () => {
    const service = read('server/src/services/aiRunLedgerService.ts');
    const migration = read('server/migrations/20260425_wave3_ai_run_ledger.sql');

    expect(service).toContain('CREATE TABLE IF NOT EXISTS ai_run_ledger');
    expect(service).toContain('CREATE TABLE IF NOT EXISTS ai_run_events');
    expect(service).toContain('recordAIRunEvent');
    expect(service).toContain('listActionCenter');
    expect(migration).toContain('ai_run_ledger');
    expect(migration).toContain('ai_run_events');
  });

  it('keeps Action Center sorting portable across Postgres timestamp and ledger text dates', () => {
    const service = read('server/src/services/aiRunLedgerService.ts');

    expect(service).toContain(
      'COALESCE(CAST(l.updated_at AS TEXT), CAST(a.created_at AS TEXT))'
    );
    expect(service).not.toContain('ORDER BY COALESCE(l.updated_at, a.created_at) DESC');
  });

  it('keeps approve and execute as separate user-visible operations', () => {
    const store = read('src/store/useAIActionsStore.ts');
    const proposalMessage = read('src/components/AIChat/ExecutionProposalMessage.tsx');

    const approveBlock = store.slice(
      store.indexOf('approveAction: async'),
      store.indexOf('editAction: async')
    );
    expect(approveBlock).toContain('Api.approveAIAction');
    expect(approveBlock).not.toContain('executeAction(actionId)');
    expect(store).not.toContain('auto-execute');
    expect(store).not.toContain('Execute with edited payload');
    expect(proposalMessage).toContain('chatProposal.action.execute');
    expect(proposalMessage).toContain("effectiveLifecycleState === 'approved'");
  });

  it('exposes Action Center, Run Ledger and Audit Viewer endpoints and route', () => {
    const routes = read('server/src/routes/ai.routes.ts');
    const api = read('src/services/api.ts');
    const appRoutes = read('src/routes/AppRoutes.tsx');
    const actionCenter = read('src/components/AIChat/ActionCenter.tsx');

    expect(routes).toContain("'/actions/center'");
    expect(routes).toContain("'/actions/runs'");
    expect(routes).toContain("'/actions/:id/audit'");
    expect(routes).toContain("scope: z.enum(['mine', 'org']).optional()");
    expect(routes).toContain("scope === 'org'");
    expect(api).toContain('getAIActionCenter');
    expect(api).toContain('getAIRunLedger');
    expect(api).toContain("scope?: 'mine' | 'org'");
    expect(api).toContain('getAIActionAuditTrail');
    expect(appRoutes).toContain('path={ROUTES.AI_OS.ACTION_CENTER}');
    expect(actionCenter).toContain('Action Center');
    expect(actionCenter).toContain('Audit Viewer');
    expect(actionCenter).toContain('Run Ledger');
    expect(actionCenter).toContain('ledgerWarning');
    expect(actionCenter).toContain("Api.getAIRunLedger({ scope: 'mine', limit: 100 })");
    expect(actionCenter).toContain("Api.getAIActionCenter({ scope: 'org', limit: 100 })");
    expect(actionCenter).toContain("Api.getAIRunLedger({ scope: 'org', limit: 100 })");
  });

  it('forces mutating actions through approval before execution', () => {
    const executor = read('server/src/services/aiActionExecutor.ts');

    expect(executor).toContain('isGovernedMutationAction(actionType)');
    expect(executor).toContain('allowsPatternAutoApprovalForGovernedMutation(permission, actionType)');
    expect(executor).toContain('allowDestructiveAutoApproval');
    expect(executor).toContain("action.status !== ACTION_STATUS.APPROVED");
    expect(executor).toContain("eventType: 'proposal_approved'");
    expect(executor).toContain("eventType: 'execution_started'");
    expect(executor).toContain("eventType: 'execution_failed'");
  });

  it('blocks explicit approval-bypass mutation prompts before model generation', () => {
    const routes = read('server/src/routes/ai.routes.ts');

    expect(routes).toContain('isGovernedMutationApprovalBypassRequest');
    expect(routes).toContain('Every workspace mutation must go through a proposal');
    expect(routes).toContain('await maybeEmitTeresaProposal(governedReply)');
    expect(routes).toContain("actionSurface: 'governed_execution'");
  });

  it('mirrors Teresa proposal lifecycle into AIRun Action Center', () => {
    const teresa = read('server/src/services/v8/teresaCopilotService.ts');
    const routes = read('server/src/routes/ai.routes.ts');

    expect(teresa).toContain('mirrorTeresaProposalToAIRun');
    expect(teresa).toContain('ensureAIActionMirrorSchema');
    expect(teresa).toContain('repairTeresaAIRunMirrorsForActionCenter');
    expect(teresa).toContain('TERESA_HANDOFF_');
    expect(teresa).toContain('INSERT INTO ai_actions');
    expect(teresa).toContain('{ fallback: false }');
    expect(teresa).toContain("eventType: 'proposal_pending_review'");
    expect(teresa).toContain("eventType: 'execution_succeeded'");
    expect(teresa).toContain('noSilentExecution: true');
    expect(routes).toContain('repairTeresaAIRunMirrorsForActionCenter');
  });

  it('records explicit rollback status in AIRun audit output', () => {
    const executor = read('server/src/services/aiActionExecutor.ts');

    expect(executor).toContain('rollbackStatus');
    expect(executor).toContain('rollback_available');
    expect(executor).toContain('rollback_unavailable');
  });
});
