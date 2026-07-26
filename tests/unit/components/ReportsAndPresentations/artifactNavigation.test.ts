import { describe, expect, it } from 'vitest';

import {
  resolveArtifactOpenPath,
  resolveTemplateUsePath,
} from '../../../../src/components/ReportsAndPresentations/artifactNavigation';
import { getArtifactPath } from '../../../../src/utils/artifactLinks';

describe('resolveArtifactOpenPath', () => {
  it('prefers explicit governance.openPath when set', () => {
    expect(
      resolveArtifactOpenPath({
        kind: 'document',
        originRecordId: 'r1',
        governance: { openPath: '/custom/open/r1' },
      })
    ).toBe('/custom/open/r1');
  });

  it('uses getArtifactPath for documents when no explicit openPath', () => {
    const id = 'rep-build-99';
    expect(resolveArtifactOpenPath({ kind: 'document', originRecordId: id, governance: {} })).toBe(
      getArtifactPath('report', id)
    );
  });

  it('uses getArtifactPath for presentations when no explicit openPath', () => {
    const id = 'deck-77';
    expect(
      resolveArtifactOpenPath({ kind: 'presentation', originRecordId: id, governance: null })
    ).toBe(getArtifactPath('presentation', id));
  });

  it('uses getArtifactPath for sheets (sheet artifacts have a dedicated open path)', () => {
    expect(
      resolveArtifactOpenPath({ kind: 'sheet', originRecordId: 'tp-1', governance: null })
    ).toBe(getArtifactPath('sheet', 'tp-1'));
  });

  it('returns null when originRecordId is empty', () => {
    expect(
      resolveArtifactOpenPath({ kind: 'document', originRecordId: '   ', governance: null })
    ).toBeNull();
  });

  // HOTFIX task#63 (UI-M5): a promoted assessment must NEVER fall back to the
  // empty report builder. Without governance.openPath, the assessment-origin
  // must be detected and routed back to the assessment run.
  it('routes a promoted-assessment document to the assessment run via authority (no empty builder)', () => {
    const id = 'asm-run-123';
    expect(
      resolveArtifactOpenPath({
        kind: 'document',
        originRecordId: id,
        governance: { authority: 'assessment_workbench' },
      })
    ).toBe(`/assessment?assessmentId=${encodeURIComponent(id)}`);
  });

  it('routes a promoted-assessment document to the assessment run via originSummary.sourceType', () => {
    const id = 'asm-run-456';
    const path = resolveArtifactOpenPath({
      kind: 'document',
      originRecordId: id,
      governance: { originSummary: { sourceType: 'ASSESSMENT' } },
    });
    expect(path).toBe(`/assessment?assessmentId=${encodeURIComponent(id)}`);
    // and must NOT be the empty report builder
    expect(path).not.toContain('/reports/builder');
  });

  it('still honors an explicit backend openPath for assessment-origin artifacts', () => {
    expect(
      resolveArtifactOpenPath({
        kind: 'document',
        originRecordId: 'asm-run-789',
        governance: {
          openPath: '/assessment?assessmentId=asm-run-789',
          authority: 'assessment_workbench',
        },
      })
    ).toBe('/assessment?assessmentId=asm-run-789');
  });
});

describe('resolveTemplateUsePath', () => {
  // R1 (2026-07-26): a legacy report_template previously routed to
  // `/wordy?templateArtifactId=...` — WordyView only reads title/description,
  // and the from-chat generation endpoint doesn't know templateArtifactId,
  // so the template's sections_json was silently never used. „Użyj wzorca"
  // must route to the Report Builder create flow instead, which resolves the
  // index id SERVER-SIDE and honors the template's real sections.
  it('routes a report_template to /reports/builder (NOT /wordy)', () => {
    const path = resolveTemplateUsePath({
      artifactIndexId: 'art-report-tpl-1',
      templateType: 'report',
      originRuntime: 'report_template',
    });
    expect(path).toBe('/reports/builder?new=true&templateArtifactId=art-report-tpl-1');
    expect(path).not.toContain('/wordy');
  });

  it('URL-encodes the index id for a report_template', () => {
    const path = resolveTemplateUsePath({
      artifactIndexId: 'art with spaces/slash',
      templateType: 'report',
      originRuntime: 'report_template',
    });
    expect(path).toBe(
      `/reports/builder?new=true&templateArtifactId=${encodeURIComponent('art with spaces/slash')}`
    );
  });

  it('still routes a document_template to Document Studio Mode 3 (unchanged)', () => {
    const path = resolveTemplateUsePath({
      artifactIndexId: 'art-doc-tpl-1',
      templateType: 'report',
      originRuntime: 'document_template',
    });
    expect(path).toBe('/document-studio?entry=template&templateArtifactId=art-doc-tpl-1');
  });

  it('falls back to the legacy per-type route when originRuntime is not yet tagged', () => {
    const path = resolveTemplateUsePath({
      artifactIndexId: 'art-untagged-1',
      templateType: 'report',
      originRuntime: null,
    });
    expect(path).toBe('/wordy?templateArtifactId=art-untagged-1');
  });

  it('returns null for an orphaned entry regardless of originRuntime', () => {
    expect(
      resolveTemplateUsePath({
        artifactIndexId: 'art-orphan-1',
        templateType: 'report',
        originRuntime: 'report_template',
        orphaned: true,
      })
    ).toBeNull();
  });

  it('returns null when the index id is empty', () => {
    expect(
      resolveTemplateUsePath({
        artifactIndexId: '   ',
        templateType: 'report',
        originRuntime: 'report_template',
      })
    ).toBeNull();
  });
});
