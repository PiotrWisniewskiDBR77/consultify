import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * L-06 regression guard — "composer ramka-w-ramce" (double border).
 *
 * Invariant: the chat composer must render exactly ONE visible frame — its own
 * focus container inside EnhancedChatInput ("Main Input Container"). The parent
 * wrappers in UnifiedChatPanel that wrap each <EnhancedChatInput> mount site
 * must stay borderless (padding / background only), otherwise a second frame
 * stacks with the composer's own border and the user sees a frame-in-frame.
 *
 * This is a deterministic source-guard (no DOM / browser): it asserts the
 * structural facts established for L-06 so a future parent-border regression is
 * caught at the source level.
 */

const root = resolve(__dirname, '../../..');
const enhancedInputSrc = readFileSync(
  resolve(root, 'src/components/AIChat/EnhancedChatInput.tsx'),
  'utf8'
);
const panelSrc = readFileSync(
  resolve(root, 'src/components/AIChat/UnifiedChatPanel.tsx'),
  'utf8'
);

/** Extract a window of source starting at `startLineMarker`. */
function classNameBlockAt(src: string, startLineMarker: string): string {
  const idx = src.indexOf(startLineMarker);
  expect(idx, `marker not found: ${startLineMarker}`).toBeGreaterThanOrEqual(0);
  return src.slice(idx, idx + 600);
}

describe('Chat composer single-border guard (L-06)', () => {
  it('EnhancedChatInput owns exactly one focus-border container (the composer frame)', () => {
    expect(enhancedInputSrc).toContain('{/* Main Input Container */}');
    const container = classNameBlockAt(enhancedInputSrc, '{/* Main Input Container */}');
    expect(container).toContain('rounded-xl border');
    expect(container).toContain('border-c-focus-solid');
    expect(container).toContain('border-slate-200');
  });

  it('the composer textarea is borderless (transparent, no outline)', () => {
    expect(enhancedInputSrc).toContain('data-testid="chat-input"');
    expect(enhancedInputSrc).toContain('bg-transparent');
    expect(enhancedInputSrc).toContain('focus:outline-none');
  });

  it('both <EnhancedChatInput> mount sites are present in UnifiedChatPanel', () => {
    const mounts = panelSrc.match(/<EnhancedChatInput\b/g) ?? [];
    expect(mounts.length).toBeGreaterThanOrEqual(2);
  });

  it('the welcome-state composer slot wrapper has no border/ring', () => {
    const welcomeWrapper = 'mt-8 w-full max-w-5xl text-left';
    expect(panelSrc).toContain(welcomeWrapper);
    const block = classNameBlockAt(panelSrc, welcomeWrapper).slice(0, welcomeWrapper.length + 4);
    expect(block).not.toMatch(/\bborder\b/);
    expect(block).not.toMatch(/\bring(-|\b)/);
  });

  it('the normal-chat composer slot wrappers (inner + input area) have no border/ring', () => {
    const innerWrapper = 'mx-auto w-full max-w-5xl';
    expect(panelSrc).toContain(innerWrapper);
    const innerBlock = panelSrc.slice(
      panelSrc.indexOf(innerWrapper),
      panelSrc.indexOf(innerWrapper) + innerWrapper.length + 4
    );
    expect(innerBlock).not.toMatch(/\bborder\b/);
    expect(innerBlock).not.toMatch(/\bring(-|\b)/);

    const inputArea = panelSrc.match(/id="chat-input"\s+className=\{`[^`]*`\}/);
    expect(inputArea, 'normal-chat input-area wrapper not found').not.toBeNull();
    const inputAreaClass = inputArea![0];
    expect(inputAreaClass).toContain('bg-slate-50');
    expect(inputAreaClass).not.toMatch(/\bborder\b/);
    expect(inputAreaClass).not.toMatch(/\bring(-|\b)/);
  });
});
