/**
 * documentFabricationCheck (A3) — testy detektora fabrykacji liczb.
 *
 * Kontrakt: flaguje TYLKO liczby „precyzyjnie wyglądające" bez znacznika
 * założenia; nie rusza liczb okrągłych/ilustracyjnych ani liczb opatrzonych
 * „(założenie)"/„(assumption)"; na poziomie schematu nie flaguje sekcji ze
 * źródłami.
 */

import { describe, expect, it } from 'vitest';

import {
  detectDocumentFabrication,
  detectFabricatedNumbersInText,
} from '../documentFabricationCheck.js';

describe('detectFabricatedNumbersInText', () => {
  it('flaguje precyzyjny procent bez znacznika założenia', () => {
    const r = detectFabricatedNumbersInText('Adopcja wzrośnie o 27,4% w pierwszym roku.');
    expect(r.count).toBe(1);
    expect(r.hits[0]?.value).toBe('27,4%');
  });

  it('flaguje precyzyjną kwotę z separatorem tysięcy', () => {
    const r = detectFabricatedNumbersInText('Oszczędności sięgną 183 450 PLN rocznie.');
    expect(r.count).toBeGreaterThanOrEqual(1);
    expect(r.hits.some((h) => h.value.includes('183'))).toBe(true);
  });

  it('flaguje precyzyjny mnożnik ROI (3.7x)', () => {
    const r = detectFabricatedNumbersInText('Zwrot z inwestycji to 3.7x w horyzoncie trzech lat.');
    expect(r.count).toBe(1);
    expect(r.hits[0]?.value.toLowerCase()).toBe('3.7x');
  });

  it('NIE flaguje liczb okrągłych/ilustracyjnych (25%, 2.5M, 30)', () => {
    const r = detectFabricatedNumbersInText(
      'Wzrost o 25% przy inwestycji 2.5M USD i 30 pilotażach.'
    );
    expect(r.count).toBe(0);
  });

  it('NIE flaguje precyzyjnej liczby gdy w pobliżu jest znacznik „(założenie)"', () => {
    const r = detectFabricatedNumbersInText(
      'Marża rośnie o 27,4% (założenie: przy stałym miksie).'
    );
    expect(r.count).toBe(0);
  });

  it('NIE flaguje gdy w pobliżu jest znacznik „(assumption)"', () => {
    const r = detectFabricatedNumbersInText('Margin uplift of 27.4% (assumption: stable mix).');
    expect(r.count).toBe(0);
  });

  it('NIE flaguje okrągłej liczby ≥5 cyfr zakończonej zerami (100000)', () => {
    const r = detectFabricatedNumbersInText('Budżet programu to 100000 EUR na cały rok.');
    expect(r.count).toBe(0);
  });
});

describe('detectDocumentFabrication (schema)', () => {
  const fabricatedBlock = {
    blockId: 'b1',
    type: 'paragraph',
    content: { text: 'Redukcja kosztów wyniesie 27,4%, a przychód 183 450 PLN.' },
  };

  it('flaguje fabrykację w sekcji BEZ źródeł (dokument bez źródeł)', () => {
    const schema = {
      sourceRefs: [],
      sections: [{ title: 'Korzyści', sourceRefs: [], blocks: [fabricatedBlock] }],
    };
    const r = detectDocumentFabrication(schema);
    expect(r.count).toBeGreaterThanOrEqual(2);
    expect(r.hits[0]?.sectionTitle).toBe('Korzyści');
  });

  it('NIE flaguje gdy sekcja ma źródła (liczby mogą pochodzić z materiału)', () => {
    const schema = {
      sourceRefs: [],
      sections: [
        {
          title: 'Korzyści',
          sourceRefs: [{ sourceType: 'insight', sourceId: 'i1' }],
          blocks: [fabricatedBlock],
        },
      ],
    };
    const r = detectDocumentFabrication(schema);
    expect(r.count).toBe(0);
  });

  it('NIE flaguje gdy dokument ma źródła na poziomie root', () => {
    const schema = {
      sourceRefs: [{ sourceType: 'note', sourceId: 'n1' }],
      sections: [{ title: 'Korzyści', sourceRefs: [], blocks: [fabricatedBlock] }],
    };
    const r = detectDocumentFabrication(schema);
    expect(r.count).toBe(0);
  });

  it('NIE flaguje bloku jawnie oznaczonego jako założenie (isAssumption)', () => {
    const schema = {
      sourceRefs: [],
      sections: [
        {
          title: 'Scenariusze',
          sourceRefs: [],
          blocks: [{ ...fabricatedBlock, isAssumption: true }],
        },
      ],
    };
    const r = detectDocumentFabrication(schema);
    expect(r.count).toBe(0);
  });
});
