import { describe, expect, it, vi } from 'vitest';

import { zbudujZrodlaPracujZAI } from '../pracujZAIzKartAnalizy';

describe('zbudujZrodlaPracujZAI — routing sekcji całego dokumentu', () => {
  it('przekazuje ten sam fieldId do właściwej sekcji źródłowej', () => {
    const applyChange = vi.fn(() => true);
    const zrodla = zbudujZrodlaPracujZAI({
      sekcje: [
        { id: 'executive-summary', label: { en: 'A', pl: 'A' } },
        { id: 'signals', label: { en: 'B', pl: 'B' } },
      ],
      polaSekcji: () => [
        {
          id: 'manual-section-text',
          label: 'Pole',
          value: '',
          kind: 'text',
          writable: true,
        },
      ],
      applyChange,
      isPolish: false,
    });

    expect(zrodla.dokument.rodzaj).toBe('pola');
    if (zrodla.dokument.rodzaj !== 'pola') throw new Error('oczekiwano źródła pól');

    const pola = zrodla.dokument.pola({ sekcjaId: null, caly: true });

    expect(pola.map((p) => p.id)).toEqual([
      'executive-summary::manual-section-text',
      'signals::manual-section-text',
    ]);

    expect(zrodla.dokument.zastosuj(pola[0].id, 'Treść A')).toBe(true);
    expect(zrodla.dokument.zastosuj(pola[1].id, 'Treść B')).toBe(true);

    expect(applyChange).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        fieldId: 'manual-section-text',
        proposedValue: 'Treść A',
        sectionId: 'executive-summary',
      })
    );
    expect(applyChange).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        fieldId: 'manual-section-text',
        proposedValue: 'Treść B',
        sectionId: 'signals',
      })
    );
  });
});
