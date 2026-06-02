import { describe, expect, it } from 'vitest';

import {
  buildNoWebSourcesText,
  buildProductAssistantFallback,
  isExplicitResearchAsk,
} from '../../../server/src/services/ai/chatStabilizationPolicy.js';

describe('AI chat stabilization policy', () => {
  it('grounds product assistant answers for feedback and marketplace without external links', () => {
    const feedback = buildProductAssistantFallback('Jak działa moduł feedbacku?', true);
    expect(feedback?.citations.map((c) => c.id)).toContain('product_help_feedback');
    expect(feedback?.instruction).toContain('Shift+Ctrl+B');
    expect(feedback?.instruction).toContain('Cite these facts inline as [1], [2]');
    expect(feedback?.instruction).not.toContain('[PA1]');
    expect(feedback?.instruction).not.toMatch(/ArcGIS|Facebook|YouTube/i);

    const marketplace = buildProductAssistantFallback('Gdzie w systemie znajdę marketplace?', true);
    expect(marketplace?.citations.map((c) => c.id)).toContain('product_help_marketplace');
    expect(marketplace?.instruction).toContain('MCP Marketplace');
    expect(marketplace?.instruction).toContain('lewe');
  });

  it('asks for clarification for ambiguous add-item requests', () => {
    const fallback = buildProductAssistantFallback('Jak dodać nowy element w tym obszarze?', true);
    expect(fallback?.citations.map((c) => c.id)).toContain('product_help_add_item');
    expect(fallback?.instruction).toContain('jedno pytanie doprecyzowujące');
    expect(fallback?.instruction).toContain('Nie wolno');
  });

  it('treats market trends and competitor questions as explicit research asks', () => {
    expect(isExplicitResearchAsk('Znajdź informacje o konkurencji DBR77 na rynku USA')).toBe(true);
    expect(isExplicitResearchAsk('Sprawdź bieżące trendy w konsultingu 2026')).toBe(true);
    expect(isExplicitResearchAsk('Opowiedz mi krótko o DBR77')).toBe(false);
  });

  it('returns an honest no-source research message instead of a fabricated answer', () => {
    const text = buildNoWebSourcesText(['konkurencja DBR77 Polska', 'DBR77 competitors USA'], true);
    expect(text).toContain('nie będę udawał');
    expect(text).toContain('Sprawdzone zapytania');
    expect(text).toContain('konkurencja DBR77 Polska');
  });
});
