/** @vitest-environment node */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { buildToolInitiativePreviewDetails } from '../toolInitiativePreviewDetails';

const richInitiative = {
  id: 'initiative-19',
  name: 'Digital operations initiative',
  title: 'Digital operations initiative (title fallback unused)',
  status: 'IN_PROGRESS',
  priority: 'p1',
  axis: 'digital',
  ownerBusiness: { firstName: 'Anna', lastName: 'Kowalska' },
  ownerExecution: { firstName: 'Marek', lastName: 'Nowak' },
  plannedStartDate: '2026-01-15',
  plannedEndDate: '2026-06-30',
  sourceType: 'assessment',
  sourceId: 'assessment-33',
};

const STRING_FIELDS = [
  'name',
  'status',
  'priority',
  'axis',
  'plannedStartDate',
  'plannedEndDate',
  'sourceType',
  'sourceId',
] as const;

const wordCount = (value: string) => value.trim().split(/\s+/).filter(Boolean).length;

describe('T19 Discovery initiatives preview Details', () => {
  it.each(['pl', 'en'] as const)(
    'builds rich factual %s Details within 80–140 words',
    (language) => {
      const result = buildToolInitiativePreviewDetails(richInitiative, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Digital operations initiative');
      expect(result).toContain('Anna Kowalska');
      expect(result).toContain('Marek Nowak');
      expect(result).toContain('assessment-33');
    }
  );

  it('falls back to title only when name is absent', () => {
    const result = buildToolInitiativePreviewDetails(
      { title: 'Title-only initiative', status: 'DRAFT' },
      'en'
    );
    expect(result).toContain('Title-only initiative');
  });

  it('keeps the shortest complete Polish record within the 80–140 word contract', () => {
    const result = buildToolInitiativePreviewDetails(
      {
        name: 'a',
        status: 'a',
        priority: 'a',
        axis: 'a',
        ownerBusiness: { firstName: 'a', lastName: 'a' },
        ownerExecution: { firstName: 'a', lastName: 'a' },
        plannedStartDate: 'a',
        plannedEndDate: 'a',
        sourceType: 'a',
        sourceId: 'a',
      },
      'pl'
    );
    expect(wordCount(result)).toBeGreaterThanOrEqual(80);
    expect(wordCount(result)).toBeLessThanOrEqual(140);
  });

  it.each(['pl', 'en'] as const)(
    'builds minimal non-empty %s Details within 80–140 words',
    (language) => {
      const result = buildToolInitiativePreviewDetails({ name: 'Sparse initiative' }, language);
      expect(wordCount(result)).toBeGreaterThanOrEqual(80);
      expect(wordCount(result)).toBeLessThanOrEqual(140);
      expect(result).toContain('Sparse initiative');
      expect(result).toMatch(language === 'pl' ? /nie został/i : /not persisted/i);
    }
  );

  it('uses only persisted whitelist facts without recommendations or date defaults', () => {
    const result = buildToolInitiativePreviewDetails(
      { ...richInitiative, ignored: 'MUST_NOT_APPEAR', apiKey: 'MUST_NOT_LEAK' },
      'en'
    );
    expect(result).toContain('assessment-33');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('MUST_NOT_LEAK');
    expect(result).not.toContain('2026-08-07');
    expect(result).not.toMatch(/recommend|next step|should/i);
  });

  it('returns empty text for empty and entirely rejected rows', () => {
    expect(buildToolInitiativePreviewDetails(null, 'en')).toBe('');
    expect(buildToolInitiativePreviewDetails({}, 'pl')).toBe('');
    expect(
      buildToolInitiativePreviewDetails(
        {
          name: '<b>MARKER_HTML</b>',
          status: '{"raw":"MARKER_JSON"}',
          sourceId: 'Authorization: Bearer MARKER_BEARER',
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
  )('blocks credentials in initiative field %s', (field, value, marker) => {
    const result = buildToolInitiativePreviewDetails({ [field]: value }, 'en');
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
  )('rejects raw JSON-like initiative field %s', (field, value, marker) => {
    const result = buildToolInitiativePreviewDetails({ [field]: value }, 'en');
    expect(result).toBe('');
    expect(result).not.toContain(marker);
    expect(result).not.toMatch(/[{}"]/);
    expect(result).not.toContain('[');
    expect(result).not.toContain(']');
  });

  it('never stringifies the owner object wholesale, only its firstName/lastName', () => {
    const result = buildToolInitiativePreviewDetails(
      {
        name: 'Owner payload initiative',
        ownerBusiness: { firstName: 'Ann', lastName: 'A', role: 'MUST_NOT_APPEAR', id: 'user-9' },
      },
      'en'
    );
    expect(result).toContain('Ann A');
    expect(result).not.toContain('MUST_NOT_APPEAR');
    expect(result).not.toContain('user-9');
    expect(result).not.toContain('[object Object]');
  });

  it('blocks credentials smuggled inside an owner name field', () => {
    const result = buildToolInitiativePreviewDetails(
      {
        name: 'Owner credential initiative',
        ownerBusiness: { firstName: 'Bearer MARKER_OWNER_TOKEN', lastName: 'X' },
      },
      'en'
    );
    expect(result).not.toContain('MARKER_OWNER_TOKEN');
  });

  it('a missing owner is reported as a persisted gap, not silently dropped', () => {
    const result = buildToolInitiativePreviewDetails({ name: 'No owners yet' }, 'en');
    expect(result).toMatch(/business owner was not persisted/i);
    expect(result).toMatch(/execution owner was not persisted/i);
  });

  /**
   * ── T19 source-slice: live 'initiatives' surface, additive Details block,
   *    T17/T18/Relations/footer/open/KEBAB/PPM unregressed ──────────────────
   *
   * `activeTab === 'initiatives'` (unlike T18's rejected `'reports'` guard) IS
   * reachable — it is a real StandardModuleBar tab. This test proves the new
   * Details block is wired on that live branch, wraps rather than replaces the
   * frozen `InitiativePreviewV3Body`, and that T17/T18's own wiring plus
   * everything explicitly out of scope for this packet is untouched.
   */
  it('renders the canonical InitiativePreviewV3Body on the live tab without touching T17/T18, footer, or table wiring', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/components/Discovery/DiscoveryToolsHub.tsx'),
      'utf8'
    );

    const previewStart = source.lastIndexOf('renderPreview={(item) => {');
    const footerStart = source.indexOf('renderPreviewFooter={(item) => {', previewStart);
    const previewSlice = source.slice(previewStart, footerStart);
    const footerSlice = source.slice(footerStart);

    const tableStart = source.indexOf('<StandardTable', footerStart);
    const tableSlice = source.slice(tableStart);

    // The current canonical preview owns its structured details; the legacy
    // text builder is intentionally no longer mounted in the live branch.
    expect(previewSlice).not.toContain('buildToolInitiativePreviewDetails(');
    expect(previewSlice.match(/<PreviewDetailsSection/g)).toHaveLength(1);

    // `InitiativePreviewV3Body` is rendered — the shared component is a
    // sibling, not replaced or reimplemented inline.
    expect(previewSlice).toContain('<InitiativePreviewV3Body');
    expect(previewSlice).toContain('initiative={mapToPreviewModel(init)}');
    // Its own onSummarize wiring is unchanged.
    expect(previewSlice).toContain(
      "'Podsumuj tę inicjatywę w 5 punktach i zaproponuj 3 kolejne kroki.'"
    );

    // T17/T18 selection logic is untouched (frozen and QA-accepted).
    // Whitespace-tolerant: prettier may wrap this line depending on file
    // width, unrelated to whether the logic itself changed.
    expect(previewSlice).toMatch(
      /const isReportLikeOutputKind =\s*\n?\s*kind === 'assessment_report' \|\| kind === 'report_builder';/
    );
    expect(previewSlice).toContain('buildOutputPreviewDetails(');
    expect(previewSlice).toContain('buildReportPreviewDetails(');
    expect(previewSlice).toContain('text={outputDetailsText}');

    // No changes leaked into the footer (a separate renderPreviewFooter
    // callback with its own independent mapToPreviewModel).
    expect(footerSlice).not.toContain('buildToolInitiativePreviewDetails');
    expect(footerSlice).toContain(
      'const mapToPreviewModel = (i: any): InitiativePreviewV3Model => ({'
    );

    // Table / row-level KEBAB / PPM / double-click open are unregressed.
    expect(tableSlice).toContain('onRowDoubleClick={(row) => {');
    expect(tableSlice).toContain('rowActions={');
    expect(tableSlice).toContain("id: 'preview'");
    expect(tableSlice).toContain('setPreviewItemId(id)');
    expect(tableSlice).toContain('openOutput(row as any)');
    expect(source).toContain('<TableWithPreviewLayout<ToolsPreviewItem>');
  });

  it('does not touch the frozen InitiativePreviewV3 component file', () => {
    // This packet's ownership excludes the shared preview body entirely — the
    // file must exist, unmodified, still exporting the same symbol T17-T19
    // all render as a sibling to.
    const source = readFileSync(
      join(process.cwd(), 'src/components/Initiatives/InitiativePreviewV3.tsx'),
      'utf8'
    );
    expect(source).toContain('export const InitiativePreviewV3Body');
    expect(source).not.toContain('buildToolInitiativePreviewDetails');
  });
});
