import type { CardBlock, CardComposition, Deck, DeckCard } from '../wizard/types';

/**
 * STEP 1b — normalize a raw slide `composition` (from B1 / unifiedJson) into the
 * FE CardComposition contract. Guarded + fail-open: malformed input → null, so
 * back-compat holds (absent composition === today's heuristic). Never throws.
 */
export function normalizeSlideComposition(raw: unknown): CardComposition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const out: CardComposition = {};

  if (typeof r.layoutVariantId === 'string' && r.layoutVariantId.trim()) {
    out.layoutVariantId = r.layoutVariantId.trim().slice(0, 60);
  }
  if (typeof r.emphasis === 'string' && r.emphasis.trim()) {
    out.emphasis = r.emphasis.trim().slice(0, 40);
  }
  if (Array.isArray(r.regions)) {
    const regions: { area: string; blockTypes?: string[] }[] = [];
    for (const reg of r.regions) {
      if (!reg || typeof reg !== 'object') continue;
      const area = (reg as Record<string, unknown>).area;
      if (typeof area !== 'string' || !area.trim()) continue;
      const blockTypesRaw = (reg as Record<string, unknown>).blockTypes;
      const blockTypes = Array.isArray(blockTypesRaw)
        ? blockTypesRaw.filter((b): b is string => typeof b === 'string' && !!b.trim())
        : undefined;
      regions.push({
        area: area.trim(),
        ...(blockTypes && blockTypes.length ? { blockTypes } : {}),
      });
    }
    if (regions.length) out.regions = regions;
  }

  if (
    out.layoutVariantId === undefined &&
    out.emphasis === undefined &&
    out.regions === undefined
  ) {
    return null;
  }
  return out;
}

export function safeJsonParse<T>(raw: unknown, fallback: T): T {
  if (!raw) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export function deckFromUnifiedJson(params: {
  deckId: string;
  title?: string;
  unifiedJson: unknown;
  orgId?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  status?: Deck['status'];
}): Deck | null {
  const parsed = safeJsonParse<any>(params.unifiedJson, null);
  if (!parsed?.slides || !Array.isArray(parsed.slides)) return null;

  const nowIso = new Date().toISOString();

  const intentMap: Record<string, DeckCard['intent']> = {
    cover: 'cover',
    executive_summary: 'executive_summary',
    section_intro: 'section_intro',
    key_messages: 'key_messages',
    performance_overview: 'performance_overview',
    single_insight: 'single_insight',
    comparison: 'comparison',
    assessment: 'assessment',
    roadmap: 'roadmap',
    risk_management: 'risk_management',
    recommendation_portfolio: 'recommendation_portfolio',
    recommendation_single: 'recommendation_portfolio',
    initiative_portfolio: 'initiative_portfolio',
    next_steps: 'next_steps',
    appendix: 'appendix',
    root_cause: 'assessment',
    prioritization_matrix: 'prioritization_matrix',
  };

  const cards: DeckCard[] = parsed.slides.map((slide: any, idx: number) => {
    const cardId = `card-${params.deckId}-${idx}`;
    const intent = intentMap[String(slide.intent || '')] || 'key_messages';
    const contentType = String(slide?.content?.type || slide?.intent || '');

    const blocks: CardBlock[] = [];
    const pushBlock = (
      type: CardBlock['type'],
      content: Record<string, unknown>,
      isRefreshable = false
    ) => {
      blocks.push({
        block_id: `block-${params.deckId}-${idx}-${blocks.length}`,
        card_id: cardId,
        type,
        content,
        is_refreshable: isRefreshable,
        position: { area: 'full', order: blocks.length },
        ai_editable: true,
      });
    };

    const headingText =
      slide?.content?.title ||
      slide?.content?.headline ||
      slide?.content?.section_title ||
      slide?.key_message ||
      slide?.intent ||
      'Slide';
    pushBlock('heading', { text: String(headingText), level: 2 });

    if (contentType === 'cover') {
      const subtitle = slide?.content?.subtitle ? String(slide.content.subtitle) : '';
      const org = slide?.content?.organization ? String(slide.content.organization) : '';
      const date = slide?.content?.date ? String(slide.content.date) : '';
      const conf = slide?.content?.confidentiality ? String(slide.content.confidentiality) : '';
      const parts = [subtitle, org, date, conf].filter(Boolean);
      if (parts.length) pushBlock('paragraph', { text: parts.join(' · ') });
    } else if (contentType === 'executive_summary') {
      const findings = Array.isArray(slide?.content?.key_findings)
        ? slide.content.key_findings
        : [];
      if (findings.length) pushBlock('bullet_list', { items: findings.map(String) });
    } else if (contentType === 'performance_overview') {
      const metrics = Array.isArray(slide?.content?.metrics) ? slide.content.metrics : [];
      if (metrics.length) {
        pushBlock('metric_strip', {
          metrics: metrics.map((metric: any) => ({
            label: String(metric?.label || metric?.name || 'Metric'),
            value: String(metric?.value ?? ''),
            trend: metric?.trend,
          })),
        });
      }
    } else if (contentType === 'comparison') {
      const left = slide?.content?.left || slide?.content?.before;
      const right = slide?.content?.right || slide?.content?.after;
      if (left || right) pushBlock('table', { rows: [left || {}, right || {}] }, true);
    } else if (Array.isArray(slide?.content?.bullets) && slide.content.bullets.length) {
      pushBlock('bullet_list', { items: slide.content.bullets.map(String) });
    } else if (slide?.content?.text || slide?.key_message) {
      pushBlock('paragraph', { text: String(slide.content?.text || slide.key_message) });
    }

    // STEP 1b — carry B1's per-slide composition (if any) onto the card so the
    // renderer can honour the AI's layout choice. Additive + back-compatible:
    // a slide without `composition` keeps layout_id 'auto' (pure heuristic).
    const composition = normalizeSlideComposition(slide?.composition);
    const layoutId =
      composition?.layoutVariantId && composition.layoutVariantId.trim()
        ? composition.layoutVariantId.trim()
        : 'auto';

    return {
      card_id: cardId,
      deck_id: params.deckId,
      order_index: idx,
      intent,
      layout_id: layoutId,
      composition: composition ?? null,
      title: String(headingText),
      key_message: slide?.key_message ? String(slide.key_message) : undefined,
      blocks,
      source_refs: Array.isArray(slide?.source_refs)
        ? slide.source_refs.map((ref: any) => ({
            artifact_id: String(ref?.artifact_id || ref?.id || ''),
            artifact_type: String(ref?.artifact_type || ref?.type || 'artifact'),
            artifact_name: String(ref?.artifact_name || ref?.name || 'Source'),
          }))
        : [],
      speaker_notes: slide?.speaker_notes ? String(slide.speaker_notes) : undefined,
      has_refreshable_data: false,
      background: { type: 'theme' },
      animations: { entrance: 'fade', block_stagger: true },
      is_locked: false,
    };
  });

  return {
    deck_id: params.deckId,
    organization_id: String(params.orgId || ''),
    title: params.title || parsed.title || 'Untitled',
    theme_id: 'default',
    presentation_mode: 'show',
    communication_register: 'professional',
    image_style_preset: 'minimal_no_images',
    color_set_id: 'midnight_navy',
    status: params.status || 'generated',
    card_size: '16:9',
    cards,
    source_refs: [],
    generation_settings: {
      text_mode: 'preserve',
      content_depth: 'concise',
      audience: 'internal',
      tone: 'professional',
      language: 'en',
      image_source: 'none',
    },
    animations_enabled: true,
    share_settings: { is_shared: false, permissions: 'view' },
    speaker_notes_generated: cards.some((card) => Boolean(card.speaker_notes)),
    created_by: String(params.createdBy || ''),
    created_at: String(params.createdAt || nowIso),
    updated_at: String(params.updatedAt || nowIso),
  };
}
