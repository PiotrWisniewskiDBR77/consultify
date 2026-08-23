import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const inputSource = fs.readFileSync(path.resolve(__dirname, '../EnhancedChatInput.tsx'), 'utf8');
const cssSource = fs.readFileSync(path.resolve(__dirname, '../../../index.css'), 'utf8');

describe('EnhancedChatInput idle pulse owner feedback', () => {
  it('only enables the pulse for an empty enabled idle composer', () => {
    const idleContract = '!isInputDisabled && !isRecordingAny && !isFocused && !value.trim()';
    expect(
      inputSource.match(new RegExp(idleContract.replace(/[!&|().]/g, '\\$&'), 'g'))
    ).toHaveLength(2);
    expect(inputSource).toContain("? 'chat-composer-idle-pulse' : ''");
  });

  it('uses a slow border-only orbit and disables animation for reduced motion', () => {
    expect(cssSource).toContain('.chat-composer-idle-pulse::before');
    expect(cssSource).toContain('animation: chat-composer-idle-orbit 12s linear infinite');
    expect(cssSource).toContain('@media (prefers-reduced-motion: reduce)');
    expect(cssSource).toContain('html.reduce-motion .chat-composer-idle-pulse::before');
    expect(cssSource).toContain('animation: none');
    expect(cssSource).toContain('pointer-events: none');
  });
});
