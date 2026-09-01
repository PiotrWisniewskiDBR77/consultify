import { describe, expect, it } from 'vitest';

import {
  filterOutlineSourcesByEvidence,
  parseKnowledgeOutline,
} from '../presentationKnowledgeOutlineService.js';

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

  it('removes a model-proposed source id that was absent from governed tool evidence', () => {
    const outline = parseKnowledgeOutline('[{"tytul":"Wynik","teza":"63,4%","archetyp":"single_insight","zrodla":[{"typ":"knowledge_doc","id":"doc-real","etykieta":"Real"},{"typ":"knowledge_doc","id":"doc-invented","etykieta":"Invented"}]}]');
    expect(filterOutlineSourcesByEvidence(outline, '{"documentId":"doc-real"}')[0].zrodla)
      .toEqual([{ typ: 'knowledge_doc', id: 'doc-real', etykieta: 'Real' }]);
  });
});
