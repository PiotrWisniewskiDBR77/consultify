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

  it('fills explicit template gaps for a whole deck from Teresa values', () => {
    const deck = {
      deck_id: 'nova',
      cards: [
        {
          title: 'Economics',
          blocks: [
            {
              type: 'metric_strip',
              content: {
                metrics: [
                  { label: 'NPV', value: 'Data required' },
                  { label: 'Payback', value: 'Data required' },
                ],
              },
            },
          ],
        },
      ],
    };
    const prompt = 'Fill values: NPV: EUR 3.2m; Payback: 11 months';
    const plan = parsePresentationEditIntent(prompt);
    const result = applyPresentationEditPlan({ deck, prompt, isPolish: false, plan });
    expect(plan.actionable).toBe(true);
    expect(JSON.stringify(result.deck)).not.toContain('Data required');
    expect(result.deck.cards[0].blocks[0].content.metrics).toEqual([
      expect.objectContaining({ value: 'EUR 3.2m' }),
      expect.objectContaining({ value: '11 months' }),
    ]);
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

  it('skips locked cards on a global edit and reports them by 1-based slide number', () => {
    const deck = {
      deck_id: 'deck-locked-1',
      title: 'Deck',
      cards: [
        {
          card_id: 'c1',
          intent: 'key_messages',
          title: 'Unlocked slide',
          is_locked: false,
          blocks: [{ content: { text: 'A very long paragraph that should get trimmed down.' } }],
        },
        {
          card_id: 'c2',
          intent: 'key_messages',
          title: 'Locked slide',
          is_locked: true,
          blocks: [{ content: { text: 'A manually protected paragraph that must survive.' } }],
        },
      ],
    };
    const prompt = 'Make this concise';
    const plan = parsePresentationEditIntent(prompt);
    const result = applyPresentationEditPlan({ deck, prompt, isPolish: false, plan });

    expect(result.skippedLockedSlides).toEqual([2]);
    expect(result.deck.cards[0].blocks[0].content.text.length).toBeLessThanOrEqual(180);
    expect(result.deck.cards[1].blocks[0].content.text).toBe(
      'A manually protected paragraph that must survive.'
    );
  });

  it('does NOT skip a locked card when the prompt explicitly names its slide number', () => {
    const deck = {
      deck_id: 'deck-locked-2',
      title: 'Deck',
      cards: [
        { card_id: 'c1', intent: 'key_messages', title: 'A', is_locked: false, blocks: [] },
        {
          card_id: 'c2',
          intent: 'key_messages',
          title: 'B',
          is_locked: true,
          blocks: [{ content: { text: 'Long enough text that concise mode would slice down.' } }],
        },
      ],
    };
    const prompt = 'Skróć slajd 2';
    const plan = parsePresentationEditIntent(prompt);
    expect(plan.scope).toBe('slide');
    const result = applyPresentationEditPlan({ deck, prompt, isPolish: true, plan });

    expect(result.skippedLockedSlides).toEqual([]);
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
