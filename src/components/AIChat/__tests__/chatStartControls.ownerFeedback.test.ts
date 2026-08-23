import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const panelSource = fs.readFileSync(path.resolve(__dirname, '../UnifiedChatPanel.tsx'), 'utf8');
const inputSource = fs.readFileSync(path.resolve(__dirname, '../EnhancedChatInput.tsx'), 'utf8');
const outputSelectorSource = fs.readFileSync(
  path.resolve(__dirname, '../OutputToolSelector.tsx'),
  'utf8'
);

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

  it('gives every capability tile a canonical destination and return-to-chat context', () => {
    expect(panelSource).toContain("id: 'market-analysis'");
    expect(panelSource).toContain("id: 'financial-analysis'");
    expect(panelSource).toContain("id: 'classic-consulting'");
    expect(panelSource).toContain("id: 'digital-transformation'");
    expect(panelSource).toContain("route: '/tools'");
    expect(panelSource).toContain("route: '/finance'");
    expect(panelSource).toContain("route: '/assessment'");
    expect(panelSource).toContain("trackFunnelEvent('chat_capability_deep_linked'");
    expect(panelSource).toContain('consultify.teresa.capabilityReturnContext');
    expect(panelSource).toContain("'Open capability'");
  });

  it('exposes output routing as a labelled single-choice control', () => {
    expect(outputSelectorSource).toContain('role="group"');
    expect(outputSelectorSource).toContain('aria-pressed={isActive}');
    expect(outputSelectorSource).toContain('type="button"');
  });
});
