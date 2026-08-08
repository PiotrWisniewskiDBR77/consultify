type EditScope = 'slide' | 'section' | 'global' | 'methodological' | 'none';

export interface PresentationEditPlan {
  scope: EditScope;
  targetSlides: number[];
  sectionHint?: string;
  mutationKinds: Array<'content' | 'structure' | 'layout' | 'branding' | 'methodology'>;
  requiresApproval: boolean;
  actionable: boolean;
  noOpReason?: string;
}

export interface PresentationEditResult {
  deck: any;
  reply: string;
  appliedActions: string[];
  plan: PresentationEditPlan;
  /**
   * ★ Fala 2 (SPEC §3.3.3/§3.3.4) — 1-based slide numbers whose content was
   * protected from this edit because `card.is_locked` is true and the slide
   * was NOT explicitly named by number in the prompt. Empty when nothing was
   * skipped (no locked cards in scope, or the prompt named them explicitly).
   */
  skippedLockedSlides: number[];
}

function extractTargetSlides(prompt: string): number[] {
  const matches = [...prompt.matchAll(/slajd(?:\s+nr)?\s*(\d+)|slide\s*(\d+)/gi)];
  const values = matches
    .map((m) => Number(m[1] || m[2] || 0))
    .filter((n) => Number.isFinite(n) && n > 0)
    .map((n) => n - 1);
  return [...new Set(values)];
}

function detectSectionHint(prompt: string): string | undefined {
  const normalized = prompt.toLowerCase();
  const candidates = [
    'risk',
    'ryzyk',
    'roadmap',
    'harmonogram',
    'appendix',
    'podsum',
    'summary',
    'finance',
    'finans',
    'kpi',
  ];
  return candidates.find((token) => normalized.includes(token));
}

export function parsePresentationEditIntent(prompt: string): PresentationEditPlan {
  const normalized = String(prompt || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return {
      scope: 'none',
      targetSlides: [],
      mutationKinds: [],
      requiresApproval: false,
      actionable: false,
      noOpReason: 'Prompt is empty.',
    };
  }

  const targetSlides = extractTargetSlides(normalized);
  const sectionHint = detectSectionHint(normalized);
  const mutationKinds: PresentationEditPlan['mutationKinds'] = [];

  if (
    normalized.includes('executive') ||
    normalized.includes('tone') ||
    normalized.includes('formal') ||
    normalized.includes('summary') ||
    normalized.includes('podsum') ||
    normalized.includes('concise') ||
    normalized.includes('short') ||
    normalized.includes('skró') ||
    normalized.includes('data required') ||
    normalized.includes('fill') ||
    normalized.includes('uzupeł') ||
    normalized.includes('uzupeln') ||
    /[^\n;:=]+\s*[:=]\s*[^\n;]+/.test(normalized)
  ) {
    mutationKinds.push('content');
  }
  if (
    normalized.includes('move') ||
    normalized.includes('przenie') ||
    normalized.includes('add slide') ||
    normalized.includes('dodaj slajd') ||
    normalized.includes('split') ||
    normalized.includes('rozbij') ||
    normalized.includes('before') ||
    /\bprzed\b/.test(normalized) ||
    normalized.includes('after') ||
    /\bpo\b/.test(normalized)
  ) {
    mutationKinds.push('structure');
  }
  if (
    normalized.includes('readability') ||
    normalized.includes('table') ||
    normalized.includes('layout')
  ) {
    mutationKinds.push('layout');
  }
  if (
    normalized.includes('brand') ||
    normalized.includes('theme') ||
    normalized.includes('dark') ||
    normalized.includes('styl') ||
    normalized.includes('design') ||
    normalized.includes('apply brand') ||
    normalized.includes('zastosuj brand') ||
    normalized.includes('use brand') ||
    normalized.includes('executive theme') ||
    normalized.includes('dbr77')
  ) {
    mutationKinds.push('branding');
  }
  if (
    normalized.includes('template') ||
    normalized.includes('cfo') ||
    normalized.includes('ceo') ||
    normalized.includes('ks') ||
    normalized.includes('governance') ||
    normalized.includes('template ks') ||
    normalized.includes('template kick') ||
    normalized.includes('ks compliance') ||
    normalized.includes('ks template') ||
    normalized.includes('zgodność z template ks') ||
    normalized.includes('zgodnosc z template ks')
  ) {
    mutationKinds.push('methodology');
  }

  const uniqueKinds = [...new Set(mutationKinds)];
  const scope: EditScope =
    targetSlides.length > 0
      ? 'slide'
      : uniqueKinds.includes('methodology')
        ? 'methodological'
        : sectionHint
          ? 'section'
          : uniqueKinds.length > 0
            ? 'global'
            : 'none';

  if (scope === 'none') {
    return {
      scope,
      targetSlides: [],
      mutationKinds: [],
      requiresApproval: false,
      actionable: false,
      noOpReason: 'No supported edit intent detected.',
    };
  }

  return {
    scope,
    targetSlides,
    sectionHint,
    mutationKinds: uniqueKinds,
    requiresApproval: true,
    actionable: true,
  };
}

function buildAgentReply(appliedActions: string[], isPolish: boolean): string {
  if (appliedActions.length === 0) {
    return isPolish
      ? 'Nie rozpoznałem instrukcji. Spróbuj np. skrócić deck, dodać summary, dodać notes lub odświeżyć dane.'
      : 'I could not match that instruction. Try asking me to make the deck concise, add a summary, add notes, or refresh the data.';
  }
  return isPolish
    ? `Zastosowałem: ${appliedActions.join(', ')}.`
    : `Applied: ${appliedActions.join(', ')}.`;
}

function getKeywordStems(token: string): string[] {
  const stems = new Set<string>();
  const t = token.toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/g, '');
  if (!t) return [];
  stems.add(t);
  if (t.endsWith('s') && t.length > 3) stems.add(t.slice(0, -1));
  if (/^(risk|ryzyk)/.test(t)) {
    stems.add('risk');
    stems.add('ryzyk');
  }
  if (/^(timeline|harmonogram|roadmap)/.test(t)) {
    stems.add('roadmap');
    stems.add('timeline');
    stems.add('harmonogram');
  }
  if (/^(decision|decyzj)/.test(t)) {
    stems.add('decision');
    stems.add('decyzj');
  }
  return [...stems];
}

function findCardIndexByToken(cards: any[], token: string): number {
  if (!token) return -1;
  const stems = getKeywordStems(token);
  if (stems.length === 0) return -1;
  return cards.findIndex((card) => {
    const intent = String(card?.intent || '').toLowerCase();
    const title = String(card?.title || '').toLowerCase();
    return stems.some((s) => intent.includes(s) || title.includes(s));
  });
}

function detectReorderTargets(prompt: string): {
  source?: string;
  target?: string;
  relation?: 'before' | 'after';
} {
  const normalized = String(prompt || '').toLowerCase();
  let relation: 'before' | 'after' | undefined;
  let parts: string[] = [];
  if (/\bbefore\b/.test(normalized)) {
    relation = 'before';
    parts = normalized.split(/\bbefore\b/);
  } else if (/\bprzed\b/.test(normalized)) {
    relation = 'before';
    parts = normalized.split(/\bprzed\b/);
  } else if (/\bafter\b/.test(normalized)) {
    relation = 'after';
    parts = normalized.split(/\bafter\b/);
  } else if (/\bpo\b/.test(normalized)) {
    relation = 'after';
    parts = normalized.split(/\bpo\b/);
  }
  if (!relation || parts.length < 2) return {};

  const stripVerbs = /\b(move|please|proszę|prosze|przenie[sśćż]+|przesu[ńn]+)\b/g;
  const leftTokens = parts[0]
    .replace(stripVerbs, '')
    .trim()
    .split(/[\s,.;:]+/)
    .filter(Boolean);
  const rightTokens = parts[1]
    .trim()
    .split(/[\s,.;:]+/)
    .filter(Boolean);
  return {
    source: leftTokens[leftTokens.length - 1],
    target: rightTokens[0],
    relation,
  };
}

function extractBrandName(prompt: string): string {
  const normalized = String(prompt || '');
  if (/dbr77/i.test(normalized)) return 'DBR77 Executive';
  const m =
    normalized.match(/(?:apply|use|zastosuj)\s+([A-Za-z0-9_-]+)\s+brand/i) ||
    normalized.match(/brand\s+([A-Za-z0-9_-]+)/i) ||
    normalized.match(/([A-Za-z0-9_-]+)\s+(?:executive\s+)?theme/i);
  if (m && m[1] && !/^(the|a|an|use|apply|zastosuj)$/i.test(m[1])) {
    return `${m[1]} Brand`;
  }
  return 'DBR77 Executive';
}

function buildKsPlaceholderCard(args: {
  deckId: string;
  intent: string;
  title: string;
  bullets: string[];
  orderIndex: number;
}): any {
  const cardId = `card-${args.intent}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  return {
    card_id: cardId,
    deck_id: args.deckId,
    order_index: args.orderIndex,
    intent: args.intent,
    layout_id: 'content_full',
    title: args.title,
    blocks: [
      {
        block_id: `block-${args.intent}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        card_id: cardId,
        type: 'bullet_list',
        content: { items: args.bullets },
        is_refreshable: false,
        position: { area: 'full', order: 0 },
        ai_editable: true,
      },
    ],
    source_refs: [],
    has_refreshable_data: false,
    background: { type: 'theme' },
    animations: { entrance: 'fade', block_stagger: false },
    is_locked: false,
  };
}

function extractBlockText(block: any): string {
  if (!block?.content) return '';
  const c = block.content;
  if (typeof c === 'string') return c;
  if (c.text) return String(c.text);
  if (c.headline) return String(c.headline);
  if (c.label) return `${c.label}: ${c.value ?? ''}`;
  if (Array.isArray(c.items)) {
    return c.items
      .slice(0, 4)
      .map((item: any) => (typeof item === 'string' ? item : item.title || item.label || ''))
      .join(' | ');
  }
  return '';
}

function extractExplicitValues(prompt: string): Map<string, string> {
  const values = new Map<string, string>();
  const normalizedPrompt = String(prompt || '').replace(
    /^(?:fill|set|update|replace|uzupełnij|uzupelnij)\s+(?:the\s+)?(?:data\s+)?values?\s*:\s*/i,
    ''
  );
  for (const segment of normalizedPrompt.split(/[\n;]/)) {
    const match = segment.match(
      /(?:replace|set|update|fill|uzupełnij|uzupelnij)?\s*([^:=]+?)\s*[:=]\s*(.+)$/i
    );
    if (!match) continue;
    const label = match[1].trim().replace(/^(?:and|oraz|with|values?)\s+/i, '');
    const value = match[2].trim().replace(/[.,]$/, '');
    if (label && value) values.set(label.toLowerCase(), value);
  }
  return values;
}

function lookupExplicitValue(values: Map<string, string>, label: unknown): string | undefined {
  const normalizedLabel = String(label || '')
    .trim()
    .toLowerCase();
  if (!normalizedLabel) return undefined;
  for (const [candidate, value] of values) {
    if (
      candidate === normalizedLabel ||
      candidate.endsWith(normalizedLabel) ||
      normalizedLabel.endsWith(candidate)
    )
      return value;
  }
  return undefined;
}

function fillExplicitDataRequired(card: any, values: Map<string, string>): number {
  let changes = 0;
  for (const block of Array.isArray(card?.blocks) ? card.blocks : []) {
    const content = block?.content;
    if (Array.isArray(content?.metrics)) {
      content.metrics = content.metrics.map((metric: any) => {
        const replacement = lookupExplicitValue(values, metric?.label);
        if (String(metric?.value || '').toLowerCase() === 'data required' && replacement) {
          changes += 1;
          return { ...metric, value: replacement };
        }
        return metric;
      });
    }
    if (Array.isArray(content?.items)) {
      content.items = content.items.map((item: any) => {
        if (!item || typeof item !== 'object') return item;
        const replacement = lookupExplicitValue(values, item.title || item.label);
        if (
          String(item.description || item.value || '').toLowerCase() === 'data required' &&
          replacement
        ) {
          changes += 1;
          return 'description' in item
            ? { ...item, description: replacement }
            : { ...item, value: replacement };
        }
        return item;
      });
    }
  }
  return changes;
}

export function applyPresentationEditPlan(params: {
  deck: any;
  prompt: string;
  isPolish: boolean;
  plan: PresentationEditPlan;
}): PresentationEditResult {
  const { deck, prompt, isPolish, plan } = params;
  if (!plan.actionable) {
    return {
      deck,
      reply: isPolish
        ? `Brak zmian: ${plan.noOpReason || 'nierozpoznana intencja.'}`
        : `No changes: ${plan.noOpReason || 'unsupported intent.'}`,
      appliedActions: [],
      plan,
      skippedLockedSlides: [],
    };
  }

  const normalized = String(prompt || '')
    .trim()
    .toLowerCase();
  const cards = Array.isArray(deck?.cards) ? [...deck.cards] : [];
  const appliedActions: string[] = [];
  const nowIso = new Date().toISOString();
  const explicitValues = extractExplicitValues(prompt);

  // ★ Fala 2 (SPEC §3.3.3) — protect manually-locked cards from THIS
  // global/section-scoped edit, UNLESS the prompt explicitly names that slide
  // by number (`plan.targetSlides`, 0-indexed — the existing
  // `extractTargetSlides` mechanism already distinguishes "no number given"
  // from "slide N named explicitly"). Only content-mutating loops below
  // consult this; card insertion (summary/KS-template), whole-deck reorder,
  // and deck-level branding are structural/deck-wide and are left untouched
  // (locking protects a SLIDE's content, not its position in the deck).
  const explicitTargets = new Set(plan.targetSlides);
  const skippedIndices = new Set<number>();
  const isProtected = (index: number): boolean => {
    const card = cards[index];
    return Boolean(card?.is_locked) && !explicitTargets.has(index);
  };

  if (explicitValues.size > 0) {
    let filled = 0;
    cards.forEach((card: any, idx: number) => {
      if (plan.targetSlides.length > 0 && !explicitTargets.has(idx)) return;
      if (isProtected(idx)) {
        skippedIndices.add(idx);
        return;
      }
      filled += fillExplicitDataRequired(card, explicitValues);
    });
    if (filled > 0)
      appliedActions.push(
        isPolish ? `uzupełniono ${filled} pól danych` : `filled ${filled} data fields`
      );
  }

  if (
    normalized.includes('summary') ||
    normalized.includes('podsum') ||
    normalized.includes('executive')
  ) {
    const hasSummary = cards.some((card: any) => card.intent === 'executive_summary');
    if (!hasSummary) {
      const sourceTitles = cards
        .slice(0, 4)
        .map((card: any) => String(card.title || card.intent || 'Slide'))
        .filter(Boolean);
      const cardId = `card-summary-${Date.now()}`;
      cards.splice(1, 0, {
        card_id: cardId,
        deck_id: deck.deck_id,
        order_index: 1,
        intent: 'executive_summary',
        layout_id: 'content_full',
        title: isPolish ? 'Podsumowanie zarządcze' : 'Executive Summary',
        blocks: [
          {
            block_id: `block-summary-${Date.now()}`,
            card_id: cardId,
            type: 'bullet_list',
            content: {
              items: sourceTitles.length
                ? sourceTitles.map((title: string) =>
                    isPolish ? `Kluczowy punkt: ${title}` : `Key point: ${title}`
                  )
                : [isPolish ? 'Dodano sekcję podsumowania.' : 'Summary slide added.'],
            },
            is_refreshable: false,
            position: { area: 'full', order: 0 },
            ai_editable: true,
          },
        ],
        source_refs: [],
        has_refreshable_data: false,
        background: { type: 'theme' },
        animations: { entrance: 'fade', block_stagger: false },
        is_locked: false,
      });
      appliedActions.push(isPolish ? 'dodano slide summary' : 'added summary slide');
    }
  }

  if (
    normalized.includes('concise') ||
    normalized.includes('short') ||
    normalized.includes('skr') ||
    normalized.includes('zwi')
  ) {
    cards.forEach((card: any, idx: number) => {
      if (isProtected(idx)) {
        skippedIndices.add(idx);
        return;
      }
      for (const block of card.blocks || []) {
        if (typeof block?.content?.text === 'string')
          block.content.text = block.content.text.slice(0, 180);
        if (Array.isArray(block?.content?.items)) {
          block.content.items = block.content.items
            .slice(0, 4)
            .map((item: any) =>
              typeof item === 'string'
                ? item.slice(0, 120)
                : String(item?.title || item).slice(0, 120)
            );
        }
      }
    });
    appliedActions.push(isPolish ? 'skrócono copy' : 'made copy concise');
  }

  if (
    normalized.includes('note') ||
    normalized.includes('speaker') ||
    normalized.includes('notat')
  ) {
    cards.forEach((card: any, idx: number) => {
      if (isProtected(idx)) {
        skippedIndices.add(idx);
        return;
      }
      const firstBlock = (card.blocks || []).find((block: any) => block?.content);
      const baseText = extractBlockText(firstBlock || {});
      card.speaker_notes = `${card.title || card.intent}: ${baseText || (isPolish ? 'omów kluczowy komunikat' : 'cover the key message')}`;
    });
    deck.speaker_notes_generated = true;
    appliedActions.push(isPolish ? 'dodano speaker notes' : 'added speaker notes');
  }

  if (
    normalized.includes('update data') ||
    normalized.includes('refresh') ||
    normalized.includes('odświe')
  ) {
    cards.forEach((card: any, idx: number) => {
      if (isProtected(idx)) {
        skippedIndices.add(idx);
        return;
      }
      for (const block of card.blocks || []) {
        if (block?.is_refreshable)
          block.content = { ...(block.content || {}), _agent_refreshed_at: nowIso };
      }
    });
    appliedActions.push(isPolish ? 'odświeżono bloki danych' : 'refreshed data blocks');
  }

  if (
    normalized.includes('visual') ||
    normalized.includes('styl') ||
    normalized.includes('design') ||
    normalized.includes('dark') ||
    normalized.includes('brand')
  ) {
    cards.forEach((card: any, idx: number) => {
      if (idx >= 3) return;
      if (isProtected(idx)) {
        skippedIndices.add(idx);
        return;
      }
      card.background = { type: 'gradient', value: 'linear-gradient(135deg, #0B3D91, #1A8A8A)' };
    });
    appliedActions.push(isPolish ? 'wzmocniono styl slajdów' : 'improved slide styling');
  }

  const reorderTriggered =
    normalized.includes('move') ||
    normalized.includes('przenie') ||
    /\bbefore\b/.test(normalized) ||
    /\bprzed\b/.test(normalized) ||
    /\bafter\b/.test(normalized) ||
    /\bpo\b/.test(normalized);
  if (reorderTriggered) {
    let reordered = false;
    const { source, target, relation } = detectReorderTargets(prompt);
    if (source && target && relation && cards.length > 1) {
      const sourceIdx = findCardIndexByToken(cards, source);
      if (sourceIdx >= 0) {
        const [sourceCard] = cards.splice(sourceIdx, 1);
        const newTargetIdx = findCardIndexByToken(cards, target);
        if (newTargetIdx >= 0) {
          const insertAt = relation === 'before' ? newTargetIdx : newTargetIdx + 1;
          cards.splice(insertAt, 0, sourceCard);
          reordered = true;
          appliedActions.push(
            isPolish
              ? `przeniesiono ${source} ${relation === 'before' ? 'przed' : 'po'} ${target}`
              : `reordered ${source} ${relation} ${target}`
          );
        } else {
          cards.splice(sourceIdx, 0, sourceCard);
        }
      }
    }
    if (!reordered) {
      const bumpStems = ['risk', 'ryzyk', 'decision', 'decyzj'];
      const matched: number[] = [];
      cards.forEach((card: any, idx: number) => {
        const intent = String(card?.intent || '').toLowerCase();
        const title = String(card?.title || '').toLowerCase();
        if (bumpStems.some((s) => intent.includes(s) || title.includes(s))) {
          matched.push(idx);
        }
      });
      if (matched.length > 0 && cards.length > 1) {
        const sortedDesc = [...matched].sort((a, b) => b - a);
        const removed = sortedDesc.map((i) => cards.splice(i, 1)[0]).reverse();
        const insertAt = Math.min(1, cards.length);
        cards.splice(insertAt, 0, ...removed);
        appliedActions.push(
          isPolish
            ? 'przeniesiono ryzyka i decyzje na górę decka'
            : 'bumped risks and decision slides up'
        );
      }
    }
  }

  const brandingTriggered =
    normalized.includes('apply brand') ||
    normalized.includes('zastosuj brand') ||
    normalized.includes('use brand') ||
    normalized.includes('executive theme') ||
    normalized.includes('dbr77');
  if (brandingTriggered) {
    const brandName = extractBrandName(prompt);
    deck.theme = deck.theme || 'executive';
    deck.brand_kit_hint = {
      name: brandName,
      applied_at: nowIso,
    };
    appliedActions.push(isPolish ? `zastosowano brand ${brandName}` : `applied brand ${brandName}`);
  }

  const ksTriggered =
    normalized.includes('template ks') ||
    normalized.includes('template kick') ||
    normalized.includes('ks compliance') ||
    normalized.includes('ks template') ||
    normalized.includes('zgodność z template ks') ||
    normalized.includes('zgodnosc z template ks');
  if (ksTriggered) {
    const requiredIntents: Array<{
      intent: string;
      titlePl: string;
      titleEn: string;
      bulletsPl: string[];
      bulletsEn: string[];
    }> = [
      {
        intent: 'executive_summary',
        titlePl: 'Podsumowanie zarządcze',
        titleEn: 'Executive Summary',
        bulletsPl: ['Cel projektu', 'Kluczowe wnioski', 'Rekomendacja'],
        bulletsEn: ['Project goal', 'Key takeaways', 'Recommendation'],
      },
      {
        intent: 'risk_register',
        titlePl: 'Rejestr ryzyk',
        titleEn: 'Risk Register',
        bulletsPl: [
          'Ryzyko: do uzupełnienia',
          'Wpływ: do uzupełnienia',
          'Mitigacja: do uzupełnienia',
        ],
        bulletsEn: ['Risk: to be defined', 'Impact: to be defined', 'Mitigation: to be defined'],
      },
      {
        intent: 'roadmap',
        titlePl: 'Harmonogram / Roadmap',
        titleEn: 'Roadmap / Timeline',
        bulletsPl: ['Faza 1: discovery', 'Faza 2: realizacja', 'Faza 3: hand-over'],
        bulletsEn: ['Phase 1: discovery', 'Phase 2: delivery', 'Phase 3: hand-over'],
      },
      {
        intent: 'next_steps',
        titlePl: 'Kolejne kroki',
        titleEn: 'Next Steps',
        bulletsPl: ['Decyzje do podjęcia', 'Właściciele zadań', 'Termin następnego review'],
        bulletsEn: ['Decisions to confirm', 'Action owners', 'Date of next review'],
      },
    ];
    let ksInsertedAny = false;
    for (const spec of requiredIntents) {
      const exists = cards.some((card: any) => card?.intent === spec.intent);
      if (exists) continue;
      const placeholder = buildKsPlaceholderCard({
        deckId: deck.deck_id,
        intent: spec.intent,
        title: isPolish ? spec.titlePl : spec.titleEn,
        bullets: isPolish ? spec.bulletsPl : spec.bulletsEn,
        orderIndex: cards.length,
      });
      cards.push(placeholder);
      ksInsertedAny = true;
      appliedActions.push(
        isPolish
          ? `dodano kartę z template KS: ${spec.intent}`
          : `inserted KS template card: ${spec.intent}`
      );
    }
    appliedActions.push(
      isPolish
        ? ksInsertedAny
          ? 'zapewniono zgodność z template KS'
          : 'potwierdzono zgodność z template KS'
        : ksInsertedAny
          ? 'ensured KS template compliance'
          : 'verified KS template compliance'
    );
  }

  const reindexedCards = cards.map((card: any, index: number) => ({ ...card, order_index: index }));
  // 1-based, sorted, unique — matches what SlideSorter shows the user.
  const skippedLockedSlides = [...skippedIndices].sort((a, b) => a - b).map((idx) => idx + 1);
  return {
    deck: { ...deck, cards: reindexedCards, updated_at: nowIso },
    reply: buildAgentReply(appliedActions, isPolish),
    appliedActions,
    plan,
    skippedLockedSlides,
  };
}
