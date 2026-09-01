import { describe, expect, it } from 'vitest';

import { parseKnowledgeOutline } from '../presentationKnowledgeOutlineService.js';

describe('Day231 presentation knowledge outline contract', { retry: 0 }, () => {
  it('parses a grounded thesis and preserves exact provenance', () => {
    const outline = parseKnowledgeOutline(JSON.stringify({
      outline: [{
        tytul: 'Retencja po pilotażu',
        teza: 'Retencja osiągnęła 63,4% wobec 51,2% w grupie kontrolnej.',
        archetyp: 'performance_overview',
        zrodla: [{ typ: 'knowledge_doc', id: 'doc-231', etykieta: 'Raport pilotażu' }],
      }],
    }));
    expect(outline).toEqual([{
      tytul: 'Retencja po pilotażu',
      teza: 'Retencja osiągnęła 63,4% wobec 51,2% w grupie kontrolnej.',
      archetyp: 'performance_overview',
      zrodla: [{ typ: 'knowledge_doc', id: 'doc-231', etykieta: 'Raport pilotażu' }],
    }]);
  });

  it('keeps zrodla empty instead of inventing incomplete references', () => {
    const [item] = parseKnowledgeOutline('```json\n[{"tytul":"Kierunek","teza":"Potrzebna jest decyzja.","archetyp":"next_steps","zrodla":[{"typ":"","id":"x","etykieta":"?"}]}]\n```');
    expect(item.zrodla).toEqual([]);
  });
});
