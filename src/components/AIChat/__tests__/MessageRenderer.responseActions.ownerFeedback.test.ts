import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.resolve(__dirname, '../MessageRenderer.tsx'), 'utf8');

describe('MessageRenderer response actions owner feedback', () => {
  it('uses one stable glass capsule for base and expanded response actions', () => {
    expect(source).toContain('data-testid="message-response-actions"');
    expect(source).toContain('data-testid="message-response-actions-expanded"');
    expect(source).toContain("showCompactActions ? 'inline-flex' : 'hidden'");
    expect(source).toContain('backdrop-blur-xl');
  });

  it('keeps core controls mounted and disables unavailable operations', () => {
    expect(source).toContain("data-response-state={msg.isStreaming ? 'streaming'");
    expect(source).toContain('disabled={msg.isStreaming}');
    expect(source).toContain('disabled={msg.isStreaming || isDisabled}');
    expect(source).toContain('disabled={isDisabled || msg.isStreaming || !canRegenerate}');
    expect(source).toContain(
      "disabled={msg.isStreaming || String(msg.id || '').startsWith('local-')}"
    );
    expect(source).not.toContain('{canRegenerate && (');
  });
});
