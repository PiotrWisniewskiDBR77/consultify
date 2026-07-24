/**
 * Kontrakt Biblioteki wzorców (Materiały) — mapper indeksu + trasa „Użyj wzorca".
 *
 * Testy są DETERMINISTYCZNE: karmimy mapper surowym kształtem wiersza indeksu
 * (`GET /api/artifacts?artifactFamily=template`), zero bazy, zero fetch, zero
 * czasu systemowego w asercjach.
 *
 * Pilnują dokładnie tych rzeczy, które wcześniej cicho kłamały:
 *  1. `artifactIndexId` ≠ `canonicalTemplateId` (dotąd było jedno `id`),
 *  2. brak status/scope → `'unknown'`, a NIE `'active'`/`'organization'`,
 *  3. `report_template` → `legacy: true` / `source: 'legacy'`,
 *  4. szablon dokumentu → Document Studio Mode 3 z KANONICZNYM id,
 *  5. wpis osierocony nie daje żadnej ścieżki użycia.
 */

import { describe, expect, it } from 'vitest';

import { resolveTemplateUsePath } from '../artifactNavigation';
import { mapCanonicalTemplateArtifact, mapTemplateScope, mapTemplateStatus } from '../useRapData';

const ARTIFACT_INDEX_ID = 'aaaaaaaa-1111-4444-8888-aaaaaaaaaaaa';
const CANONICAL_ID = 'bbbbbbbb-2222-4444-8888-bbbbbbbbbbbb';

function indexRow(templateOverrides: Record<string, unknown> = {}, rowOverrides: object = {}) {
  return {
    artifactId: ARTIFACT_INDEX_ID,
    outputType: 'report',
    resolvedTitle: 'R1 — Tygodniowy przegląd realizacji',
    lastTransitionAt: '2026-07-01T10:00:00.000Z',
    createdAt: '2026-06-01T10:00:00.000Z',
    originSummary: {
      template: {
        canonicalTemplateId: CANONICAL_ID,
        originRuntime: 'document_template',
        source: 'canonical',
        legacy: false,
        orphaned: false,
        scope: 'organization',
        status: 'approved',
        description: 'Wzorzec raportu tygodniowego',
        ...templateOverrides,
      },
    },
    ...rowOverrides,
  };
}

describe('mapCanonicalTemplateArtifact — rozdział tożsamości', () => {
  it('rozdziela id wiersza indeksu od kanonicznego id szablonu', () => {
    const item = mapCanonicalTemplateArtifact(indexRow());

    expect(item).not.toBeNull();
    expect(item?.artifactIndexId).toBe(ARTIFACT_INDEX_ID);
    expect(item?.canonicalTemplateId).toBe(CANONICAL_ID);
    // historyczne `id` zostaje id INDEKSU (klucz wiersza tabeli)
    expect(item?.id).toBe(ARTIFACT_INDEX_ID);
    expect(item?.artifactIndexId).not.toBe(item?.canonicalTemplateId);
  });

  it('przenosi originRuntime i source z originSummary.template', () => {
    const item = mapCanonicalTemplateArtifact(indexRow());
    expect(item?.originRuntime).toBe('document_template');
    expect(item?.source).toBe('canonical');
    expect(item?.legacy).toBe(false);
    expect(item?.orphaned).toBe(false);
  });

  it('nieznany originRuntime → null (nie zgadujemy runtime)', () => {
    const item = mapCanonicalTemplateArtifact(indexRow({ originRuntime: 'jakis_nowy_runtime' }));
    expect(item?.originRuntime).toBeNull();
  });

  it('NIE przekazuje structureBlueprint dalej — służy tylko do liczników', () => {
    const item = mapCanonicalTemplateArtifact(
      indexRow({
        structureBlueprint: { sections: [{ id: 's1' }, { id: 's2' }, { id: 's3' }] },
      })
    );
    expect(item?.sectionCount).toBe(3);
    expect(item).not.toHaveProperty('structureBlueprint');
  });
});

describe('mapCanonicalTemplateArtifact — brak danych nie udaje poprawnego stanu', () => {
  it('brak status → "unknown" (a NIE "active")', () => {
    const item = mapCanonicalTemplateArtifact(indexRow({ status: undefined }));
    expect(item?.status).toBe('unknown');
    expect(item?.status).not.toBe('active');
  });

  it('brak scope → "unknown" (a NIE "organization")', () => {
    const item = mapCanonicalTemplateArtifact(indexRow({ scope: undefined }));
    expect(item?.scope).toBe('unknown');
    expect(item?.scope).not.toBe('organization');
  });

  it('mapTemplateScope nigdy nie zwraca zakazanego "application"', () => {
    expect(mapTemplateScope('application')).toBe('system');
    expect(mapTemplateScope('app')).toBe('system');
    expect(mapTemplateScope('system')).toBe('system');
    expect(mapTemplateScope('user')).toBe('personal');
    expect(mapTemplateScope('organization')).toBe('organization');
    expect(mapTemplateScope('')).toBe('unknown');
    expect(mapTemplateScope(null)).toBe('unknown');
  });

  it('mapTemplateStatus mapuje legacy wartości i nie domyśla się stanu', () => {
    expect(mapTemplateStatus('approved')).toBe('approved');
    expect(mapTemplateStatus('published')).toBe('published');
    expect(mapTemplateStatus('active')).toBe('published');
    expect(mapTemplateStatus('archived')).toBe('deprecated');
    expect(mapTemplateStatus('draft')).toBe('draft');
    expect(mapTemplateStatus(undefined)).toBe('unknown');
  });

  it('brak jakiejkolwiek daty → updatedAt === null (bez fabrykowania "teraz")', () => {
    const item = mapCanonicalTemplateArtifact(
      indexRow({}, { lastTransitionAt: undefined, createdAt: undefined })
    );
    expect(item?.updatedAt).toBeNull();
  });

  it('gdy indeks zna datę — przepisuje ją bez zmian', () => {
    const item = mapCanonicalTemplateArtifact(indexRow());
    expect(item?.updatedAt).toBe('2026-07-01T10:00:00.000Z');
  });
});

describe('mapCanonicalTemplateArtifact — legacy report_builder_templates', () => {
  it('report_template z flagą legacy → legacy:true, source:"legacy"', () => {
    const item = mapCanonicalTemplateArtifact(
      indexRow({ originRuntime: 'report_template', source: 'legacy', legacy: true })
    );
    expect(item?.originRuntime).toBe('report_template');
    expect(item?.legacy).toBe(true);
    expect(item?.source).toBe('legacy');
  });

  it('samo source:"legacy" wystarczy, żeby wiersz był oznaczony jako legacy', () => {
    const item = mapCanonicalTemplateArtifact(
      indexRow({ originRuntime: 'report_template', source: 'legacy', legacy: undefined })
    );
    expect(item?.legacy).toBe(true);
    expect(item?.source).toBe('legacy');
  });

  it('wiersz kanoniczny nie jest oznaczany jako legacy', () => {
    const item = mapCanonicalTemplateArtifact(indexRow());
    expect(item?.legacy).toBe(false);
    expect(item?.source).toBe('canonical');
  });
});

describe('resolveTemplateUsePath', () => {
  it('szablon DOKUMENTU → Document Studio Mode 3 z kanonicznym id', () => {
    const path = resolveTemplateUsePath({
      artifactIndexId: ARTIFACT_INDEX_ID,
      templateType: 'report',
      canonicalTemplateId: CANONICAL_ID,
      originRuntime: 'document_template',
    });
    expect(path).toBe(`/document-studio?entry=template&templateId=${CANONICAL_ID}`);
    // ★ id indeksu NIE może wyciec do trasy generacji
    expect(path).not.toContain(ARTIFACT_INDEX_ID);
  });

  it('legacy report_template zachowuje dotychczasową trasę generacji', () => {
    const path = resolveTemplateUsePath({
      artifactIndexId: ARTIFACT_INDEX_ID,
      templateType: 'report',
      canonicalTemplateId: CANONICAL_ID,
      originRuntime: 'report_template',
    });
    expect(path).toBe(`/wordy?templateArtifactId=${ARTIFACT_INDEX_ID}`);
  });

  it('deck i sheet bez zmian', () => {
    expect(
      resolveTemplateUsePath({
        artifactIndexId: ARTIFACT_INDEX_ID,
        templateType: 'presentation',
        originRuntime: 'presentation_template',
      })
    ).toBe(`/prezentacje?templateArtifactId=${ARTIFACT_INDEX_ID}`);
    expect(
      resolveTemplateUsePath({
        artifactIndexId: ARTIFACT_INDEX_ID,
        templateType: 'sheet',
        originRuntime: 'sheet_template',
      })
    ).toBe(`/tabele?templateArtifactId=${ARTIFACT_INDEX_ID}`);
  });

  it('wpis osierocony NIE daje ścieżki użycia', () => {
    expect(
      resolveTemplateUsePath({
        artifactIndexId: ARTIFACT_INDEX_ID,
        templateType: 'report',
        canonicalTemplateId: CANONICAL_ID,
        originRuntime: 'document_template',
        orphaned: true,
      })
    ).toBeNull();
    // sierota także na trasie legacy — żadnego cichego fallbacku
    expect(
      resolveTemplateUsePath({
        artifactIndexId: ARTIFACT_INDEX_ID,
        templateType: 'report',
        originRuntime: 'report_template',
        orphaned: true,
      })
    ).toBeNull();
  });

  it('szablon dokumentu bez kanonicznego id → null zamiast pustego templateId', () => {
    expect(
      resolveTemplateUsePath({
        artifactIndexId: ARTIFACT_INDEX_ID,
        templateType: 'report',
        canonicalTemplateId: null,
        originRuntime: 'document_template',
      })
    ).toBeNull();
  });

  it('mapper + trasa razem: wiersz indeksu dokumentu ląduje w Mode 3', () => {
    const item = mapCanonicalTemplateArtifact(indexRow());
    const path = resolveTemplateUsePath({
      artifactIndexId: item!.artifactIndexId ?? item!.id,
      templateType: item!.type,
      canonicalTemplateId: item!.canonicalTemplateId,
      originRuntime: item!.originRuntime,
      orphaned: item!.orphaned,
    });
    expect(path).toBe(`/document-studio?entry=template&templateId=${CANONICAL_ID}`);
  });
});
