import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const panelSource = fs.readFileSync(path.resolve(__dirname, '../UnifiedChatPanel.tsx'), 'utf8');
const inputSource = fs.readFileSync(path.resolve(__dirname, '../EnhancedChatInput.tsx'), 'utf8');

describe('Chat start controls owner feedback', () => {
  it('prefills topic starters for review instead of sending immediately', () => {
    expect(panelSource).toContain(
      "onClick={() => handleModeTile(undefined, item.prompt, 'topic-starter')}"
    );
    expect(panelSource).not.toContain('onClick={() => handleSendMessage(item.prompt)}');
    expect(panelSource).toContain("trackFunnelEvent('chat_start_control_selected'");
  });

  it('preserves user-authored text and focuses an accepted empty-composer prefill', () => {
    expect(inputSource).toContain('if (!valueRef.current.trim())');
    expect(inputSource).toContain('setValue(parsed.prompt)');
    expect(inputSource).toContain('textareaRef.current?.focus()');
    expect(inputSource).not.toContain('if (!value || value.trim().length === 0)');
  });
});
