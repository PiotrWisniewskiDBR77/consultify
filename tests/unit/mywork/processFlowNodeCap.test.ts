import { describe, expect, it } from 'vitest';

import {
  checkProcessFlowNodeCap,
  PROCESS_FLOW_NODE_LIMIT,
  PROCESS_FLOW_NODE_WARN_THRESHOLD,
} from '../../../src/components/MyWork/processflow/nodeCap';

describe('checkProcessFlowNodeCap (G4-PF-GUARDRAIL)', () => {
  it('allows adding while well under the warn threshold', () => {
    const result = checkProcessFlowNodeCap(10, 1);
    expect(result).toEqual({ nextCount: 11, allowed: true, shouldWarn: false });
  });

  it('allows but warns once the resulting count reaches the warn threshold', () => {
    const result = checkProcessFlowNodeCap(199, 1);
    expect(result.nextCount).toBe(200);
    expect(result.allowed).toBe(true);
    expect(result.shouldWarn).toBe(true);
  });

  it('allows the exact ceiling (resulting count === limit)', () => {
    const result = checkProcessFlowNodeCap(499, 1);
    expect(result.nextCount).toBe(PROCESS_FLOW_NODE_LIMIT);
    expect(result.allowed).toBe(true);
    expect(result.shouldWarn).toBe(true);
  });

  it('blocks the add once the resulting count would exceed the ceiling', () => {
    const result = checkProcessFlowNodeCap(500, 1);
    expect(result.nextCount).toBe(501);
    expect(result.allowed).toBe(false);
  });

  it('blocks a BULK add that would jump straight past the ceiling in one step (AI accept / paste / import) — the case a naive "current >= threshold" check misses', () => {
    // current count is well under both the warn threshold and the ceiling,
    // but a single bulk operation (e.g. AI-proposal acceptance) would push
    // the total past the ceiling in one step.
    const result = checkProcessFlowNodeCap(50, 800);
    expect(result.nextCount).toBe(850);
    expect(result.allowed).toBe(false);
  });

  it('warns on a bulk add that crosses the warn threshold without exceeding the ceiling', () => {
    const result = checkProcessFlowNodeCap(50, 160);
    expect(result.nextCount).toBe(210);
    expect(result.allowed).toBe(true);
    expect(result.shouldWarn).toBe(true);
  });

  it('treats a negative addCount as zero (defensive floor, never reduces the count)', () => {
    const result = checkProcessFlowNodeCap(100, -5);
    expect(result.nextCount).toBe(100);
    expect(result.allowed).toBe(true);
  });

  it('respects custom limit/warnThreshold overrides', () => {
    const result = checkProcessFlowNodeCap(8, 2, 10, 5);
    expect(result).toEqual({ nextCount: 10, allowed: true, shouldWarn: true });
    const blocked = checkProcessFlowNodeCap(9, 2, 10, 5);
    expect(blocked.allowed).toBe(false);
  });

  it('exposes the exported constants used to justify the chosen numbers', () => {
    expect(PROCESS_FLOW_NODE_WARN_THRESHOLD).toBe(200);
    expect(PROCESS_FLOW_NODE_LIMIT).toBe(500);
  });
});
