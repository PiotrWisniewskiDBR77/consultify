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

  it('detects Polish create/expand intents, including nouns ending in a diacritic', () => {
    expect(detectMindmapIntent('stwórz mapę myśli o strategii')).toBe('mm_create');
    expect(detectMindmapIntent('rozwiń temat dalej')).toBe('mm_expand_branch');
    expect(detectMindmapIntent('rozwiń pomysł dalej')).toBe('mm_expand_branch');
    expect(detectMindmapIntent('dodaj dziecko')).toBe('mm_add_child');
    expect(detectMindmapIntent('dodaj gałąź do tego węzła')).toBe('mm_add_child');
    // Must not match on a longer word that merely starts with the same noun.
    expect(detectMindmapIntent('rozwiń pomysłowy plan')).toBeNull();
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

  it('detects Polish process/workflow intents, including nouns ending in a diacritic', () => {
    expect(detectProcessFlowIntent('stwórz proces dla onboardingu')).toBe('pf_create');
    expect(detectProcessFlowIntent('dodaj krok zatwierdzenia')).toBe('pf_add_step');
    expect(detectProcessFlowIntent('dodaj decyzję warunkową')).toBe('pf_add_decision');
    expect(detectProcessFlowIntent('dodaj dział finansowy')).toBe('pf_add_lane');
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

  it('detects Polish whiteboard/brainstorm intents, including nouns ending in a diacritic', () => {
    expect(detectWhiteboardIntent('stwórz warsztat na burzę mózgów')).toBe('wb_add_sticky');
    expect(detectWhiteboardIntent('stwórz tablicę na pomysły')).toBe('wb_add_sticky');
    expect(detectWhiteboardIntent('dodaj notatki z sesji')).toBe('wb_add_sticky');
    expect(detectWhiteboardIntent('dodaj notatkę')).toBe('wb_add_sticky');
    // Must not match on a longer word that merely starts with the same noun.
    expect(detectWhiteboardIntent('dodaj notatkowanie do procesu')).toBeNull();
  });

  it('returns null for unrelated chat', () => {
    expect(detectWhiteboardIntent('summarize this meeting')).toBeNull();
    expect(detectWhiteboardIntent('')).toBeNull();
  });
});
