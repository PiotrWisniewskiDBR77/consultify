/**
 * [ODMROZENIE 04_ASSESSMENT DEC-496] P-P13 (`56c2cc19`) — pod runtime
 * `assessment_report` żyją DWA różne magazyny źródłowe i muszą dostać różne
 * adresy „Otwórz". Test pilnuje, żeby raport wydany z sesji jądra
 * metodycznego nie odziedziczył adresu promocji warsztatu P28.
 */
import { describe, expect, it } from 'vitest';

import { buildActionTargetPayload } from '../artifacts.routes.js';

describe('buildActionTargetPayload — assessment_report', () => {
  it('raport z sesji jądra metodycznego prowadzi do warsztatu DRD i ma eksport DOCX', () => {
    const target = buildActionTargetPayload({
      artifactId: 'art-1',
      originRuntime: 'assessment_report',
      originRecordId: '7051ebd9-0b5a-4ea9-a99b-02dbd46275cc',
      originSummary: { sourceType: 'METHOD_SESSION', sourceTable: 'method_sessions' },
    });

    expect(target.openPath).toBe('/assessment/drd/7051ebd9-0b5a-4ea9-a99b-02dbd46275cc');
    expect(target.exportPath).toBe(
      '/api/method/sessions/7051ebd9-0b5a-4ea9-a99b-02dbd46275cc/assessment-report.docx'
    );
    expect(target.authority).toBe('method_core');
  });

  it('promocja warsztatu P28 zostaje bez zmian (regresja HOTFIX task#63)', () => {
    const target = buildActionTargetPayload({
      artifactId: 'art-2',
      originRuntime: 'assessment_report',
      originRecordId: 'dbr77-assess-002',
      originSummary: { sourceType: 'ASSESSMENT' },
    });

    expect(target.openPath).toBe('/assessment?assessmentId=dbr77-assess-002');
    expect(target.authority).toBe('assessment_workbench');
  });

  it('brak originSummary też zostaje na starej ścieżce (nie zgadujemy)', () => {
    const target = buildActionTargetPayload({
      artifactId: 'art-3',
      originRuntime: 'assessment_report',
      originRecordId: 'legacy-id',
      originSummary: null,
    });

    expect(target.openPath).toBe('/assessment?assessmentId=legacy-id');
  });
});
