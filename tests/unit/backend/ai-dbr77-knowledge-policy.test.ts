import { describe, expect, it } from 'vitest';

import {
  buildSearchQueries,
  rewriteConversationalSearchQuery,
} from '../../../server/src/services/ai/webSearchIntentDetector.js';
import {
  isDbR77PortfolioQuestion,
  detectProducts,
} from '../../../server/src/services/ai/virtualWorkerKnowledgeService.js';
import { isDbr77ProductTruthQuery } from '../../../server/src/services/ai/virtualWorkerWebAccessService.js';

describe('AI Chat DBR77 knowledge policy', () => {
  it('does not treat a simple DBR77 question as a full portfolio question', () => {
    expect(detectProducts('Opowiedz mi o DBR77')).toContain('dbr77');
    expect(isDbR77PortfolioQuestion('Opowiedz mi o DBR77')).toBe(false);
  });

  it('keeps portfolio mode for explicit ecosystem or product-list questions', () => {
    expect(isDbR77PortfolioQuestion('Jakie produkty obejmuje ekosystem DBR77?')).toBe(true);
    expect(isDbR77PortfolioQuestion('Opowiedz o portfolio DBR77')).toBe(true);
  });

  it('rewrites conversational product prompts before web search', () => {
    expect(rewriteConversationalSearchQuery('Opowiedz mi o DBR77')).toBe('DBR77');
    expect(buildSearchQueries('Powiedz coś więcej o marketplace DBR77')[0]).toBe('marketplace DBR77');
  });

  it('blocks web search for DBR77 product truth but allows current market research', () => {
    expect(isDbr77ProductTruthQuery('Powiedz coś więcej o marketplace DBR77')).toBe(true);
    expect(isDbr77ProductTruthQuery('Znajdź informacje o konkurencji DBR77 na rynku USA')).toBe(false);
  });
});
