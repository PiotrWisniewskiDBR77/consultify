/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildInitiativePreviewDetails } from '../initiativePreviewDetails';

const richRow = {
  id: 'initiative-25',
  name: 'Regional service operating model',
  summary: 'Consolidate persisted service processes across three European business units.',
  description:
    'The initiative record covers service ownership, shared process definitions, platform integration, workforce capacity, supplier coordination, and benefits tracking. Its persisted scope includes Germany, France, and Poland. Recorded delivery work includes process mapping, local validation, integration design, role assignment, and transition planning for the next operating cycle.',
  axis: 'OPERATING_MODEL',
  status: 'PLANNING',
  priority: 'HIGH',
  progress: 46,
  budget: 250000,
  expectedRoi: 1.8,
  plannedStartDate: '2026-09-01',
  plannedEndDate: '2027-03-31',
  ownerBusiness: { id: 'u1', firstName: 'Anna', lastName: 'Nowak' },
  ownerExecution: { id: 'u2', firstName: 'Jan', lastName: 'Kowalski' },
  dependencies: ['CRM migration', 'Service taxonomy'],
  createdAt: '2026-07-02T08:00:00.000Z',
  updatedAt: '2026-07-22T15:00:00.000Z',
};

const STRING_FIELDS = [
  'name',
  'title',
  'summary',
  'description',
  'axis',
  'status',
  'priority',
  'progress',
  'budget',
  'expectedRoi',
  'plannedStartDate',
  'plannedEndDate',
  'createdAt',
  'updatedAt',
] as const;

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

describe('T25 Initiatives Portfolio table preview Details', () => {
  it.each(['pl', 'en'] as const)(
    'builds rich factual %s Details within 80–140 words',
    (language) => {
      const result = buildInitiativePreviewDetails(richRow, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toMatch(language === 'pl' ? /^Inicjatywa:/ : /^Initiative:/);
      expect(result).toContain('Anna Nowak');
      expect(result).toContain('CRM migration');
    }
  );

  it.each(['pl', 'en'] as const)(
    'builds sparse non-empty %s Details within 80–140 words',
    (language) => {
      const result = buildInitiativePreviewDetails({ name: 'Sparse initiative' }, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Sparse initiative');
      expect(result).toMatch(language === 'pl' ? /nie został/i : /not persisted/i);
    }
  );

  it('uses only whitelisted persisted facts without recommendations or date fabrication', () => {
    const result = buildInitiativePreviewDetails(
      { ...richRow, ignoredField: 'MUST_NOT_APPEAR', secretPlan: 'MUST_NOT_LEAK' },
      'en'
    );
    expect(result).toContain('Regional service operating model');
    expect(result).toContain('46%');
    expect(result).toContain('2026-09-01');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('MUST_NOT_LEAK');
    expect(result).not.toContain('2026-08-07');
    expect(result).not.toMatch(/recommend|next step|should/i);
  });

  it('returns empty Details for empty or entirely rejected rows', () => {
    expect(buildInitiativePreviewDetails(null, 'en')).toBe('');
    expect(buildInitiativePreviewDetails({}, 'pl')).toBe('');
    expect(
      buildInitiativePreviewDetails(
        {
          name: '<b>MARKER_HTML</b>',
          summary: '{"raw":"MARKER_JSON"}',
          description: 'Authorization: Bearer MARKER_BEARER',
        },
        'en'
      )
    ).toBe('');
  });

  it.each(
    STRING_FIELDS.flatMap((field) => [
      [field, `auth_header=MARKER_AUTH_${field}`, `MARKER_AUTH_${field}`],
      [field, `authentication:MARKER_LOGIN_${field}`, `MARKER_LOGIN_${field}`],
      [field, `Bearer MARKER_BEARER_${field}`, `MARKER_BEARER_${field}`],
      [field, `eyJMARKER_JWT_${field}.payload.signature`, `MARKER_JWT_${field}`],
    ])
  )('blocks credentials in whitelisted field %s', (field, value, marker) => {
    const result = buildInitiativePreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
  });

  it.each(
    STRING_FIELDS.flatMap((field) => [
      [field, `{"x":"MARKER_OBJECT_${field}"}`, `MARKER_OBJECT_${field}`],
      [field, `["MARKER_ARRAY_${field}"]`, `MARKER_ARRAY_${field}`],
      [field, `{"x":"MARKER_TRUNCATED_${field}"`, `MARKER_TRUNCATED_${field}`],
      [field, `{"x":"MARKER_TRAILING_${field}"} tail`, `MARKER_TRAILING_${field}`],
    ])
  )('rejects raw JSON-like whitelisted field %s', (field, value, marker) => {
    const result = buildInitiativePreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('handles owners and dependencies explicitly without object coercion or leaks', () => {
    const result = buildInitiativePreviewDetails(
      {
        name: 'Safe initiative',
        ownerBusiness: { firstName: 'Maria', lastName: 'Zielińska', apiKey: 'MARKER_OWNER_KEY' },
        ownerExecution: { firstName: '{"raw":"MARKER_OWNER_JSON"}', lastName: '<b>bad</b>' },
        dependencies: [
          'Safe dependency',
          { name: 'MARKER_DEP_OBJECT' },
          'Bearer MARKER_DEP_BEARER',
          '["MARKER_DEP_JSON"]',
        ],
      },
      'en'
    );
    expect(result).toContain('Maria Zielińska');
    expect(result).toContain('Safe dependency');
    expect(result).not.toContain('[object Object]');
    expect(result).not.toMatch(/MARKER_/);
  });

  it('changes only table Details and preserves block order, relations, actions, and adjacent modes', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/Initiatives/InitiativesHub.tsx'),
      'utf8'
    );
    const tableStart = source.indexOf("case 'table':");
    const gridStart = source.indexOf("case 'grid':", tableStart);
    const tableSlice = source.slice(tableStart, gridStart);
    const adjacentSlice = source.slice(gridStart);

    expect(tableSlice).toContain('text: tablePreviewDetailsText');
    expect(tableSlice).not.toContain("t('initiatives.noDescription', 'No description.')");
    expect(tableSlice).toContain('selectedTableRow.sourceType && selectedTableRow.sourceId');
    expect(tableSlice).toContain('actions={tablePreviewActions}');
    const order = [
      'meta={{',
      'details={{',
      'ai={{',
      'relations={',
      'actions={tablePreviewActions}',
    ];
    const positions = order.map((token) => tableSlice.indexOf(token));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    expect(adjacentSlice).toContain('renderPreview={renderInitiativePreview}');
    expect(adjacentSlice).toContain('<PortfolioKanbanView');
    expect(adjacentSlice).toContain('<InitiativesTimelineView');
    expect(adjacentSlice).not.toContain('tablePreviewDetailsText');
  });
});
