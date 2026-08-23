import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const controllerSource = fs.readFileSync(
  path.resolve(process.cwd(), 'server/src/controllers/InterviewController.ts'),
  'utf8'
);
const workspaceSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/components/Interview/InterviewWorkspace.tsx'),
  'utf8'
);

function handlerSource(name: string, nextName: string): string {
  const start = controllerSource.indexOf(`  ${name}: asyncHandler`);
  const end = controllerSource.indexOf(`  ${nextName}: asyncHandler`, start + 1);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return controllerSource.slice(start, end);
}

describe('Interview approval lifecycle owner contract', () => {
  it('persists submit lifecycle state and answer history in one fail-closed transaction', () => {
    const source = handlerSource('submitAssignment', 'sendBackAssignment');

    expect(source).toContain('queryHelpers.withPgTransaction');
    expect(source).toContain("reason: 'submission'");
    expect(source).toContain('ensureTable: false');
    expect(source).toContain("UPDATE interview_sessions SET status = 'submitted'");
    expect(source).toContain('SUBMISSION_ATOMIC_PERSISTENCE_FAILED');
    expect(source).toContain('idempotentReplay: true');
    expect(source).toContain("status IN ('in_progress', 'sent_back')");
    expect(source).not.toContain("status IN ('in_progress', 'sent_back', 'submitted')");
  });

  it('makes send-back history mandatory and rolls all lifecycle writes into one transaction', () => {
    const source = handlerSource('sendBackAssignment', 'getAnswerHistory');

    expect(source).toContain('queryHelpers.withPgTransaction');
    expect(source).toContain("reason: 'send_back'");
    expect(source).toContain("WHERE id = ? AND status = 'submitted'");
    expect(source).toContain("UPDATE interview_sessions SET status = 'active'");
    expect(source).not.toContain('fail-open');
    expect(source).not.toContain('answer-history snapshot skipped');
  });

  it('approves assignment, session and optional task through one conditional transaction', () => {
    const source = handlerSource('approveAssignment', 'getManagedAssignments');

    expect(source).toContain('queryHelpers.withPgTransaction');
    expect(source).toContain("WHERE id = ? AND status = 'submitted'");
    expect(source).toContain("UPDATE interview_sessions SET status = 'completed'");
    expect(source).toContain('UPDATE tasks SET status = ?, progress = ?, updated_at = ?');
    expect(source).toContain('INTERVIEW_APPROVE_STATE_CONFLICT');
  });

  it('does not replay a failed canonical mutation through a legacy endpoint', () => {
    const sendBackStart = workspaceSource.indexOf('const handleSendBack = useCallback');
    const approvalEnd = workspaceSource.indexOf('// Open chat', sendBackStart);
    const lifecycleHandlers = workspaceSource.slice(sendBackStart, approvalEnd);

    expect(lifecycleHandlers).toContain('V8InterviewApi.sendBackAssignment');
    expect(lifecycleHandlers).toContain('V8InterviewApi.approveAssignment');
    expect(lifecycleHandlers).not.toContain('/send-back');
    expect(lifecycleHandlers).not.toContain('/approve');
    expect(lifecycleHandlers).not.toContain('.catch(() =>');
    expect(lifecycleHandlers).toContain('Reload before deciding again.');
    expect(lifecycleHandlers).toContain('Reload the status before retrying.');
  });

  it('renders the persisted lifecycle decision as an auditable receipt', () => {
    expect(workspaceSource).toContain('interview-review-decision-receipt');
    expect(workspaceSource).toContain('latestReviewDecision.id');
    expect(workspaceSource).toContain('latestReviewDecision.createdAt');
    expect(workspaceSource).toContain('latestReviewDecision.actorRole');
    expect(workspaceSource).toContain('latestReviewDecision.actorId');
    expect(workspaceSource).toContain('latestReviewDecision.alignment');
    expect(workspaceSource).toContain('latestReviewDecision.reason');
    expect(workspaceSource).toContain(
      "t('interview.workspace.decisionRecordId', 'Decision record ID')"
    );
    expect(workspaceSource).toContain('Date.parse(String(left.createdAt');
    expect(workspaceSource).not.toContain("t('interview.workspace.receiptId', 'Receipt ID')");
  });
});
