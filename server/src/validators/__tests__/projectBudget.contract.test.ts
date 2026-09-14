import { describe, expect, it } from 'vitest';

import { CreateProjectSchema } from '../project.validators.js';

describe('PMO project budget contract', () => {
  it('accepts an omitted or positive budget and rejects zero', () => {
    expect(CreateProjectSchema.safeParse({ name: 'No budget' }).success).toBe(true);
    expect(CreateProjectSchema.safeParse({ name: 'Positive', budget_amount: 0.01 }).success).toBe(
      true
    );
    expect(CreateProjectSchema.safeParse({ name: 'Zero', budget_amount: 0 }).success).toBe(false);
  });

  it('uses description as the canonical narrative and strips the legacy goal field', () => {
    const parsed = CreateProjectSchema.parse({
      name: 'PMO',
      description: 'Canonical project objective and context',
      goal: 'Legacy schema-only value',
    });
    expect(parsed.description).toBe('Canonical project objective and context');
    expect(parsed).not.toHaveProperty('goal');
  });
});
