import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../IdeaAINudgeStrip.tsx'), 'utf8');
const whiteboardSource = fs.readFileSync(
  path.resolve(__dirname, '../IdeaWhiteboardTool.tsx'),
  'utf8'
);

describe('Idea AI nudge owner contract', () => {
  it('shows whether a suggestion comes from canvas rules or Teresa', () => {
    expect(source).toContain("source: 'canvas'");
    expect(source).toContain("source: 'teresa'");
    expect(source).toContain("'Canvas analysis'");
    expect(source).toContain("'Teresa analysis'");
  });

  it('persists dismissal per idea without mutating the canvas', () => {
    expect(source).toContain(
      'consultify:idea-nudges:dismissed:${organizationId}:${userId}:${ideaId}'
    );
    expect(source).toContain('window.localStorage.setItem(dismissalKey');
    expect(source).toContain('onClick={() => dismissNudge(nudge.id)}');
  });

  it('dismisses after resolved Apply and preserves failed suggestions for Retry', () => {
    expect(source).toContain("t('myWorkIdeas.aiNudgeStrip.apply', 'Apply')");
    expect(source).toContain("t('myWorkIdeas.aiNudgeStrip.retry', 'Retry')");
    expect(source).toContain('const confirmedApplied =');
    expect(source).toContain("result.status === 'applied'");
    expect(source).toContain('Boolean(result.receiptId && result.targetId)');
    expect(source).toContain("result.status === 'handed_off'");
    expect(source).toContain('dismissNudge(nudge.id)');
    expect(source).toContain('setActionError({');
    expect(source).toContain('role="alert"');
  });

  it('does not manufacture a durable receipt for a local canvas selection', () => {
    expect(whiteboardSource).not.toContain('receiptId: `local-selection:');
    expect(whiteboardSource).toContain("status: 'handed_off' as const");
    expect(whiteboardSource).toContain('myWorkIdeas.aiNudgeStrip.selectionReady');
  });
});
