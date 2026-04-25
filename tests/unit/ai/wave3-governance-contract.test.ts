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
    expect(api).toContain('getAIActionCenter');
    expect(api).toContain('getAIRunLedger');
    expect(api).toContain('getAIActionAuditTrail');
    expect(appRoutes).toContain('path="/ai/action-center"');
    expect(actionCenter).toContain('Action Center');
    expect(actionCenter).toContain('Audit Viewer');
    expect(actionCenter).toContain('Run Ledger');
  });

  it('forces mutating actions through approval before execution', () => {
    const executor = read('server/src/services/aiActionExecutor.ts');

    expect(executor).toContain('isGovernedMutationAction(actionType)');
    expect(executor).toContain("action.status !== ACTION_STATUS.APPROVED");
    expect(executor).toContain("eventType: 'proposal_approved'");
    expect(executor).toContain("eventType: 'execution_started'");
    expect(executor).toContain("eventType: 'execution_failed'");
  });
});
