/**
 * Testy kontraktu `PreviewSchema<T>` — §6.
 *
 * PREVIEW jest jedyną powierzchnią, która w `MATRIX_T01_T45.csv` oblała
 * WSZYSTKIE 45 tabel. Te testy zamrażają, co znaczy „preview zgodne":
 * sześć bloków w stałej kolejności, dokładnie jeden Open, unikalne akcje,
 * Relations obecne także pusto, AI nigdy jako pusta atrapa.
 */

import { describe, expect, it } from 'vitest';

import {
  buildPreviewSchema,
  EMPTY_PREVIEW_PROBE,
  type FixtureRecord,
  populatedFixture,
} from '../fixtures';
import {
  countProseWords,
  flattenPreviewActions,
  previewBlockOrder,
  type PreviewSchema,
} from '../previewSchema';
import { TABLE_SURFACE_IDS, TABLE_SURFACE_REGISTER } from '../surfaceRegister';
import { validatePreviewSchema } from '../validators';

const record = populatedFixture('T05').rows[0];

/** Kanoniczny schemat T05 — punkt wyjścia dla mutacji. */
function baseSchema(): PreviewSchema<FixtureRecord> {
  return buildPreviewSchema(TABLE_SURFACE_REGISTER.T05);
}

const codes = (schema: PreviewSchema<FixtureRecord>, on: FixtureRecord = record) =>
  validatePreviewSchema(schema, on).violations.map((violation) => violation.code);

describe('PreviewSchema — kolejność i kompletność bloków', () => {
  it('renderuje sześć bloków w stałej kolejności, gdy AI istnieje', () => {
    // T05 deklaruje contextTransitions, więc builder dokłada blok AI.
    expect(previewBlockOrder(baseSchema())).toEqual([
      'header',
      'meta',
      'details',
      'ai',
      'relations',
      'actions',
    ]);
  });

  it('pomija wyłącznie blok AI, gdy encja nie ma realnych akcji AI', () => {
    // T07 Client Vault nie deklaruje przejść kontekstowych.
    const schema = buildPreviewSchema(TABLE_SURFACE_REGISTER.T07);
    expect(previewBlockOrder(schema)).toEqual([
      'header',
      'meta',
      'details',
      'relations',
      'actions',
    ]);
  });

  it('odrzuca zadeklarowany blok AI bez realnych akcji', () => {
    const schema = baseSchema();
    schema.ai = { actions: () => [] };
    expect(codes(schema)).toContain('PREVIEW_AI_EMPTY_STUB');
  });
});

describe('PreviewSchema — dokładnie jeden Open', () => {
  it('przyjmuje pojedynczy Open w headerze', () => {
    expect(validatePreviewSchema(baseSchema(), record).valid).toBe(true);
  });

  it('odrzuca drugi Open wstawiony do siatki Actions', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [
          { actionId: 'open', label: 'Open', icon: 'open', variant: 'primary' },
          { actionId: 'assign', label: 'Assign', icon: 'assign', variant: 'neutral' },
        ],
      ],
    };
    expect(codes(schema)).toContain('PREVIEW_OPEN_NOT_UNIQUE');
  });
});

describe('PreviewSchema — duplikaty akcji', () => {
  it('wykrywa zduplikowany actionId (wzorzec T43: trzy duplikaty)', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [
          { actionId: 'complete', label: 'Complete', icon: 'complete', variant: 'positive' },
          { actionId: 'complete', label: 'Mark done', icon: 'complete', variant: 'neutral' },
        ],
      ],
    };
    expect(codes(schema)).toContain('PREVIEW_DUPLICATE_ACTION_ID');
  });

  it('wykrywa zduplikowaną etykietę', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [
          { actionId: 'complete', label: 'Complete', icon: 'complete', variant: 'positive' },
          { actionId: 'finish', label: 'Complete', icon: 'complete', variant: 'neutral' },
        ],
      ],
    };
    expect(codes(schema)).toContain('PREVIEW_DUPLICATE_ACTION_LABEL');
  });
});

describe('PreviewSchema — siatka Actions', () => {
  it('odrzuca czwarty rząd siatki', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [{ actionId: 'a1', label: 'A1', icon: 'edit', variant: 'neutral' }],
        [{ actionId: 'a2', label: 'A2', icon: 'edit', variant: 'neutral' }],
        [{ actionId: 'a3', label: 'A3', icon: 'edit', variant: 'neutral' }],
        [{ actionId: 'a4', label: 'A4', icon: 'edit', variant: 'neutral' }],
      ],
    };
    expect(codes(schema)).toContain('PREVIEW_ACTION_GRID_OVERFLOW');
  });

  it('odrzuca trzecią kolumnę w rzędzie', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [
          { actionId: 'a1', label: 'A1', icon: 'edit', variant: 'neutral' },
          { actionId: 'a2', label: 'A2', icon: 'edit', variant: 'neutral' },
          { actionId: 'a3', label: 'A3', icon: 'edit', variant: 'neutral' },
        ],
      ],
    };
    expect(codes(schema)).toContain('PREVIEW_ACTION_ROW_OVERFLOW');
  });

  it('dopuszcza pojedynczą akcję w pierwszej kolumnie bez atrapy w drugiej', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [{ actionId: 'complete', label: 'Complete', icon: 'complete', variant: 'positive' }],
      ],
    };
    expect(validatePreviewSchema(schema, record).valid).toBe(true);
  });

  it('odrzuca więcej niż jeden primary', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [
          { actionId: 'a1', label: 'A1', icon: 'edit', variant: 'primary' },
          { actionId: 'a2', label: 'A2', icon: 'edit', variant: 'primary' },
        ],
      ],
    };
    expect(codes(schema)).toContain('PREVIEW_MULTIPLE_PRIMARY');
  });

  it('wymaga confirmation dla wariantu destructive', () => {
    const schema = baseSchema();
    schema.actions = {
      rows: () => [
        [{ actionId: 'delete', label: 'Delete', icon: 'delete', variant: 'destructive' }],
      ],
    };
    expect(codes(schema)).toContain('PREVIEW_DESTRUCTIVE_WITHOUT_CONFIRMATION');
  });
});

describe('PreviewSchema — blok Details', () => {
  it('liczy słowa prozy tak jak licznik ~N words', () => {
    expect(countProseWords('  jeden dwa   trzy ')).toBe(3);
    expect(countProseWords('   ')).toBe(0);
  });

  // Nazwa zakładki jest wstawiana do prozy, więc długość różni się między
  // powierzchniami („Tasks" vs „Sessions or Processes"). Sprawdzamy wszystkie 45,
  // a nie tylko T05 — inaczej najdłuższa nazwa mogłaby przekroczyć limit niezauważona.
  it.each(TABLE_SURFACE_IDS)(
    '%s: proza fixture mieści się w kanonicznym zakresie 80–140 słów',
    (id) => {
      const words = countProseWords(populatedFixture(id).rows[0].summary);
      expect(words).toBeGreaterThanOrEqual(80);
      expect(words).toBeLessThanOrEqual(140);
    }
  );

  it('odrzuca prozę krótszą niż 80 słów', () => {
    const schema = baseSchema();
    schema.details.prose = () => 'Za krótko.';
    expect(codes(schema)).toContain('PREVIEW_DETAILS_PROSE_TOO_SHORT');
  });

  it('odrzuca prozę powyżej miękkiego maksimum 160 słów', () => {
    const schema = baseSchema();
    schema.details.prose = () => Array.from({ length: 200 }, () => 'słowo').join(' ');
    expect(codes(schema)).toContain('PREVIEW_DETAILS_PROSE_TOO_LONG');
  });

  it('nie traktuje pustej prozy jako naruszenia limitu (empty state)', () => {
    const schema = baseSchema();
    expect(codes(schema, EMPTY_PREVIEW_PROBE)).not.toContain('PREVIEW_DETAILS_PROSE_TOO_SHORT');
  });

  it('zabrania licznika słów poza trybem prose', () => {
    const schema = baseSchema();
    schema.details = {
      mode: 'properties',
      properties: (r) => r.properties,
      showWordCount: true,
      contentActions: schema.details.contentActions,
    };
    expect(codes(schema)).toContain('PREVIEW_DETAILS_WORDCOUNT_MISPLACED');
  });

  it('wymaga selektora pasującego do trybu', () => {
    const schema = baseSchema();
    schema.details = {
      mode: 'file-list',
      showWordCount: false,
      contentActions: schema.details.contentActions,
    };
    expect(codes(schema)).toContain('PREVIEW_DETAILS_MODE_MISMATCH');
  });

  it('wymusza kolejność lokalnego kebaba Copy → Export → Download', () => {
    const schema = baseSchema();
    schema.details.contentActions = [
      { actionId: 'download', label: 'Download', icon: 'download' },
      { actionId: 'copy', label: 'Copy', icon: 'copy' },
    ];
    expect(codes(schema)).toContain('PREVIEW_DETAILS_ACTION_ORDER');
  });
});

describe('PreviewSchema — Relations i Meta', () => {
  it('wymaga kanonicznego pustego stanu Relations', () => {
    const schema = baseSchema();
    schema.relations.emptyLabel = '   ';
    expect(codes(schema)).toContain('PREVIEW_RELATIONS_NO_EMPTY_LABEL');
  });

  it('renderuje blok Relations także dla rekordu bez relacji', () => {
    const schema = baseSchema();
    expect(previewBlockOrder(schema)).toContain('relations');
    expect(schema.relations.items(EMPTY_PREVIEW_PROBE)).toEqual([]);
    expect(schema.relations.emptyLabel).toBe('No relations');
  });

  it('odrzuca rekomendację dłuższą niż twarde maksimum 24 słów', () => {
    const schema = baseSchema();
    schema.meta.recommendation = () => Array.from({ length: 30 }, () => 'słowo').join(' ');
    expect(codes(schema)).toContain('PREVIEW_META_RECOMMENDATION_TOO_LONG');
  });
});

describe('PreviewSchema — referencyjny builder dla wszystkich 45 powierzchni', () => {
  it.each(TABLE_SURFACE_IDS)('%s: wariant populated przechodzi walidator', (id) => {
    const fixture = populatedFixture(id);
    const result = validatePreviewSchema(fixture.previewSchema, fixture.rows[0]);
    expect(result.violations).toEqual([]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: wariant empty przechodzi walidator', (id) => {
    const fixture = populatedFixture(id);
    const result = validatePreviewSchema(fixture.previewSchema, EMPTY_PREVIEW_PROBE);
    expect(result.violations).toEqual([]);
  });

  it.each(TABLE_SURFACE_IDS)('%s: nie przekracza sześciu akcji bezpośrednich', (id) => {
    const fixture = populatedFixture(id);
    expect(
      flattenPreviewActions(fixture.previewSchema, fixture.rows[0]).length
    ).toBeLessThanOrEqual(6);
  });
});
