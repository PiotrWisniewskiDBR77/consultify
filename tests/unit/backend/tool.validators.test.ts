/**
 * Tool Validators Unit Tests
 */

import { describe, expect, it } from 'vitest';

import {
  CreateToolSessionSchema,
  GenerateInitiativesSchema,
  SendBackSchema,
  UpdateToolSessionSchema,
} from '../../../server/src/validators/tool.validators.js';

describe('Tool validators', () => {
  it('accepts valid tool session payload', () => {
    const result = CreateToolSessionSchema.safeParse({
      toolType: 'dynamic-swot',
      name: 'Dynamic SWOT - test',
    });
    expect(result.success).toBe(true);
  });

  it('rejects generate initiatives count > 7', () => {
    const result = GenerateInitiativesSchema.safeParse({
      methodologyId: 'impact-feasibility',
      count: 8,
    });
    expect(result.success).toBe(false);
  });

  it('requires send back comment', () => {
    const result = SendBackSchema.safeParse({ comment: '' });
    expect(result.success).toBe(false);
  });

  it('accepts partial update session', () => {
    const result = UpdateToolSessionSchema.safeParse({
      completionPercent: 80,
    });
    expect(result.success).toBe(true);
  });
});
