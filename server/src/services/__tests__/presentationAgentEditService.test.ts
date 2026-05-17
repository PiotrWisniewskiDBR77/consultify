import { describe, expect, it } from 'vitest';

import {
  applyPresentationEditPlan,
  parsePresentationEditIntent,
} from '../presentationAgentEditService.js';

describe('presentationAgentEditService', () => {
  it('detects slide-scoped edit intent', () => {
    const plan = parsePresentationEditIntent('Skróć slajd 4 i popraw ton');
    expect(plan.actionable).toBe(true);
    expect(plan.scope).toBe('slide');
    expect(plan.targetSlides).toEqual([3]);
    expect(plan.requiresApproval).toBe(true);
  });

  it('returns no-op for unsupported prompt', () => {
    const plan = parsePresentationEditIntent('hello world');
    expect(plan.actionable).toBe(false);
    expect(plan.scope).toBe('none');
    expect(plan.noOpReason).toBeTruthy();
  });

  it('applies proposal changes only when intent is actionable', () => {
    const deck = {
      deck_id: 'deck-1',
      title: 'Deck',
      cards: [
        {
          title: 'A',
          intent: 'key_messages',
          blocks: [{ content: { text: 'Long text for copy trimming.' } }],
        },
      ],
    };
    const plan = parsePresentationEditIntent('Make this concise and add summary');
    const result = applyPresentationEditPlan({
      deck,
      prompt: 'Make this concise and add summary',
      isPolish: false,
      plan,
    });
    expect(result.appliedActions.length).toBeGreaterThan(0);
    expect(result.deck.cards.length).toBeGreaterThanOrEqual(1);
    expect(['global', 'section']).toContain(result.plan.scope);
  });

  it('detects section reorder intent', () => {
    const plan = parsePresentationEditIntent('Move risks before timeline');
    expect(plan.mutationKinds).toContain('structure');
    expect(plan.actionable).toBe(true);
  });

  it('applies brand mutation when branding prompt is given', () => {
    const deck = {
      deck_id: 'deck-brand-1',
      title: 'Deck',
      cards: [
        { card_id: 'c1', intent: 'title', title: 'Title' },
        { card_id: 'c2', intent: 'overview', title: 'Overview' },
      ],
    };
    const prompt = 'Apply DBR77 brand';
    const plan = parsePresentationEditIntent(prompt);
    const result = applyPresentationEditPlan({ deck, prompt, isPolish: false, plan });
    expect(result.deck.theme).toBeTruthy();
    expect(result.deck.brand_kit_hint?.name).toContain('DBR77');
    expect(result.appliedActions.some((a) => a.toLowerCase().includes('brand'))).toBe(true);
  });

  it('applies KS compliance ensuring required intents', () => {
    const deck = {
      deck_id: 'deck-ks-1',
      title: 'Deck',
      cards: [
        { card_id: 'c1', intent: 'title', title: 'Title' },
        {
          card_id: 'c2',
          intent: 'overview',
          title: 'Overview',
          blocks: [{ content: { text: 'overview' } }],
        },
      ],
    };
    const prompt = 'Sprawdź zgodność z template KS';
    const plan = parsePresentationEditIntent(prompt);
    const result = applyPresentationEditPlan({ deck, prompt, isPolish: true, plan });
    const intents = new Set<string>(result.deck.cards.map((c: any) => c.intent));
    expect(intents.has('executive_summary')).toBe(true);
    expect(intents.has('risk_register')).toBe(true);
    expect(intents.has('roadmap')).toBe(true);
    expect(intents.has('next_steps')).toBe(true);
    expect(result.appliedActions.some((a) => a.toLowerCase().includes('ks'))).toBe(true);
  });
});
