/**
 * Z20 (fala4-z20-intercept): regression coverage for the 3 idea-workspace
 * chat interceptors' matching functions (mindmap / process flow /
 * whiteboard). These had zero unit coverage before this fix.
 *
 * Note: the *context gate* added in UnifiedChatPanel.tsx — only intercept
 * when the matching canvas tool (activeIdeaWorkspaceTool) is actually
 * mounted, otherwise let the prompt fall through to the LLM — lives inline
 * in a 6k+ line component and isn't practically unit-testable in isolation;
 * it was instead verified by tracing the message-send flow (see handoff /
 * commit message). These tests cover the pure matching functions the gate
 * wraps, so regressions in the regex matching itself are still caught.
 */
import { describe, expect, it } from 'vitest';

import { detectMindmapIntent } from '@/components/AIChat/mindmapIntentDetector';
import { detectProcessFlowIntent } from '@/components/AIChat/processFlowIntentDetector';
import { detectWhiteboardIntent } from '@/components/AIChat/whiteboardIntentDetector';

describe('detectMindmapIntent', () => {
  it('detects English create/expand intents', () => {
    expect(detectMindmapIntent('create a mind map about our strategy')).toBe('mm_create');
    expect(detectMindmapIntent('expand the idea further')).toBe('mm_expand_branch');
    expect(detectMindmapIntent('add a child node')).toBe('mm_add_child');
    expect(detectMindmapIntent('add a sibling branch')).toBe('mm_add_sibling');
    expect(detectMindmapIntent('run a SWOT')).toBe('mm_apply_framework');
  });

  it('detects Polish create/expand intents', () => {
    expect(detectMindmapIntent('stwórz mapę myśli o strategii')).toBe('mm_create');
    // Note: "rozwiń pomysł" / "dodaj gałąź" — i.e. target nouns ending in a
    // Polish diacritic (ł/ń/ę/ą/ź/ż) right before the pattern's trailing \b —
    // never match: JS regex \w is ASCII-only, so \b can't find a boundary
    // after those characters. Pre-existing gap in mindmapIntentDetector.ts,
    // out of scope here (Z20 is about the interceptor's context-gate, not the
    // detector regexes) — flagged separately. Using diacritic-free target
    // nouns below exercises the same branches without tripping it.
    expect(detectMindmapIntent('rozwiń temat dalej')).toBe('mm_expand_branch');
    expect(detectMindmapIntent('dodaj dziecko')).toBe('mm_add_child');
  });

  it('returns null for unrelated chat', () => {
    expect(detectMindmapIntent('what do you think about this?')).toBeNull();
    expect(detectMindmapIntent('')).toBeNull();
  });
});

describe('detectProcessFlowIntent', () => {
  it('detects English process/workflow intents', () => {
    expect(detectProcessFlowIntent('create a process for onboarding')).toBe('pf_create');
    expect(detectProcessFlowIntent('add a step to approve budget')).toBe('pf_add_step');
    expect(detectProcessFlowIntent('add a decision gateway')).toBe('pf_add_decision');
    expect(detectProcessFlowIntent('add a swimlane for finance')).toBe('pf_add_lane');
    expect(detectProcessFlowIntent('optimize the process')).toBe('pf_analyze');
  });

  it('detects Polish process/workflow intents', () => {
    expect(detectProcessFlowIntent('stwórz proces dla onboardingu')).toBe('pf_create');
    expect(detectProcessFlowIntent('dodaj krok zatwierdzenia')).toBe('pf_add_step');
  });

  it('returns null for unrelated chat', () => {
    expect(detectProcessFlowIntent('how is the weather today?')).toBeNull();
    expect(detectProcessFlowIntent('')).toBeNull();
  });
});

describe('detectWhiteboardIntent', () => {
  it('detects English whiteboard/brainstorm intents', () => {
    expect(detectWhiteboardIntent('create a brainstorm board')).toBe('wb_add_sticky');
    // Note: "add sticky|stickies|notes?" has no optional article in the
    // pattern, so "add A sticky note" doesn't match — pre-existing gap in
    // whiteboardIntentDetector.ts, out of scope here, flagged separately.
    expect(detectWhiteboardIntent('add sticky notes')).toBe('wb_add_sticky');
    expect(detectWhiteboardIntent('organize my notes into clusters')).toBe('wb_add_cluster');
    expect(detectWhiteboardIntent('identify themes from the workshop')).toBe('wb_add_theme');
  });

  it('detects Polish whiteboard/brainstorm intents', () => {
    // See the mindmap Polish test above re: diacritic-ending target nouns
    // ("tablicę", "notatkę") never matching their pattern's trailing \b —
    // same pre-existing gap, avoided here with diacritic-free phrasing.
    expect(detectWhiteboardIntent('stwórz warsztat na burzę mózgów')).toBe('wb_add_sticky');
    expect(detectWhiteboardIntent('dodaj notatki z sesji')).toBe('wb_add_sticky');
  });

  it('returns null for unrelated chat', () => {
    expect(detectWhiteboardIntent('summarize this meeting')).toBeNull();
    expect(detectWhiteboardIntent('')).toBeNull();
  });
});
