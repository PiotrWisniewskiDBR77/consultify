/**
 * Most raport audytu → wniosek (DEC-417e, 1.1-A4).
 *
 * Testy pilnują TRZECH rzeczy, na których stoi zakładka „Wnioski" Audytów:
 *  1. RODOWÓD — wniosek zawsze niesie `sourceRefs` typu `audit_report` z id
 *     raportu; bez tego odczyt po rodowodzie nie trafia i trasa zwraca 500
 *     zamiast udawać sukces.
 *  2. ŹRÓDŁO — `sourceModule` to `audit`, czyli to, po czym lista Audytów
 *     odróżnia swoje wnioski od org-wide wniosków wywiadu/ocen/narzędzi.
 *  3. UCZCIWOŚĆ — raport bez wniosku ogólnego i bez streszczenia daje `null`
 *     (nie pusty wniosek).
 */
import { describe, expect, it, vi } from 'vitest';

import {
  AUDIT_CONCLUSION_SOURCE_MODULE,
  AUDIT_REPORT_REF_TYPE,
  buildAuditReportConclusion,
  safePersistAuditReportConclusion,
} from '../auditReportConclusionBridge.js';

const DOKUMENT = {
  reportKind: 'audit_report',
  sections: [
    {
      id: 'executive_summary',
      title: 'Streszczenie zarządcze',
      kind: 'text',
      content: 'Streszczenie: 3 niezgodności, 1 krytyczna.',
    },
    {
      id: 'overall_conclusion',
      title: 'Wniosek ogólny',
      kind: 'text',
      content: 'System zarządzania jakością spełnia wymagania z zastrzeżeniami.',
    },
    {
      id: 'limitations',
      title: 'Ograniczenia',
      kind: 'list',
      content: ['Brak dostępu do dwóch procesów.', 'Próbka dowodów ograniczona do Q3.'],
    },
    {
      id: 'systemic_conclusions',
      title: 'Wnioski systemowe',
      kind: 'list',
      content: [{ theme: 'Nadzór nad dostawcami', description: 'Brak spójnej oceny dostawców.' }],
    },
    {
      id: 'objective_evidence_references',
      title: 'Odniesienia do obiektywnych dowodów',
      kind: 'table',
      content: [{ id: 'ev-1', description: 'Protokół z 12.08' }],
    },
    {
      id: 'corrective_action_plan',
      title: 'Plan działań korygujących',
      kind: 'table',
      content: [{ title: 'Wprowadzić ocenę dostawców do 31.10' }],
    },
  ],
};

const ZRODLO = {
  reportId: 'arep-1',
  reportTitle: 'Raport poaudytowy — Q3',
  reportStatus: 'published',
  reportVersion: 2,
  programId: 'prog-1',
  programName: 'Audyt zgodności Q3',
  projectId: null,
};

describe('buildAuditReportConclusion', () => {
  it('niesie rodowód audit_report wskazujący DOKŁADNIE raport źródłowy', () => {
    const kandydat = buildAuditReportConclusion(DOKUMENT, ZRODLO);
    expect(kandydat).not.toBeNull();
    expect(kandydat!.sourceRefs).toHaveLength(1);
    expect(kandydat!.sourceRefs[0].type).toBe(AUDIT_REPORT_REF_TYPE);
    expect(kandydat!.sourceRefs[0].id).toBe('arep-1');
    expect(kandydat!.sourceRefs[0].url).toContain('/audit-programs/reports/arep-1');
  });

  it('oznacza źródło jako audyt — to po tym lista modułu filtruje wnioski', () => {
    const kandydat = buildAuditReportConclusion(DOKUMENT, ZRODLO)!;
    expect(kandydat.sourceModule).toBe(AUDIT_CONCLUSION_SOURCE_MODULE);
    expect(kandydat.sourceModule).toBe('audit');
  });

  it('bierze werdykt z wniosku ogólnego i dokleja wnioski systemowe', () => {
    const kandydat = buildAuditReportConclusion(DOKUMENT, ZRODLO)!;
    expect(kandydat.statement).toContain('spełnia wymagania z zastrzeżeniami');
    expect(kandydat.statement).toContain('Brak spójnej oceny dostawców.');
  });

  it('przenosi ograniczenia i pierwszy krok naprawczy zamiast je gubić', () => {
    const kandydat = buildAuditReportConclusion(DOKUMENT, ZRODLO)!;
    expect(kandydat.limits).toContain('Próbka dowodów ograniczona do Q3.');
    expect(kandydat.recommendedNextAction).toContain('ocenę dostawców');
    expect(kandydat.evidenceRefs.some((ref) => ref.ref === 'ev-1')).toBe(true);
    // Sam raport zawsze jest dowodem — nawet gdy tabela dowodów jest pusta.
    expect(kandydat.evidenceRefs.some((ref) => ref.type === AUDIT_REPORT_REF_TYPE)).toBe(true);
  });

  it('spada na streszczenie zarządcze, gdy raport nie ma wniosku ogólnego', () => {
    const bezWniosku = {
      ...DOKUMENT,
      sections: DOKUMENT.sections.filter((s) => s.id !== 'overall_conclusion'),
    };
    const kandydat = buildAuditReportConclusion(bezWniosku, ZRODLO)!;
    expect(kandydat.statement).toContain('3 niezgodności');
  });

  it('zwraca null, gdy nie ma ani wniosku ogólnego, ani streszczenia (zero atrap)', () => {
    expect(buildAuditReportConclusion({ sections: [] }, ZRODLO)).toBeNull();
    expect(
      buildAuditReportConclusion(
        { sections: [{ id: 'overall_conclusion', kind: 'text', content: '   ' }] },
        ZRODLO
      )
    ).toBeNull();
  });
});

describe('safePersistAuditReportConclusion', () => {
  it('zapisuje wniosek z rodowodem i nie rzuca, gdy warstwa Wniosków padnie', async () => {
    const writer = { createConclusion: vi.fn().mockResolvedValue(undefined) };
    const ok = await safePersistAuditReportConclusion(
      { organizationId: 'org-1', actorUserId: 'user-1', document: DOKUMENT, source: ZRODLO },
      { writer }
    );
    expect(ok).toBe(true);
    const zapis = writer.createConclusion.mock.calls[0][0];
    expect(zapis.sourceModule).toBe('audit');
    expect(zapis.sourceRefs[0]).toMatchObject({ type: AUDIT_REPORT_REF_TYPE, id: 'arep-1' });
    expect(zapis.organizationId).toBe('org-1');

    const padajacy = {
      createConclusion: vi.fn().mockRejectedValue(new Error('conclusions down')),
    };
    await expect(
      safePersistAuditReportConclusion(
        { organizationId: 'org-1', actorUserId: 'user-1', document: DOKUMENT, source: ZRODLO },
        { writer: padajacy }
      )
    ).resolves.toBe(false);
  });

  it('nie zapisuje niczego dla raportu bez treści wniosku', async () => {
    const writer = { createConclusion: vi.fn() };
    const ok = await safePersistAuditReportConclusion(
      {
        organizationId: 'org-1',
        actorUserId: 'user-1',
        document: { sections: [] },
        source: ZRODLO,
      },
      { writer }
    );
    expect(ok).toBe(false);
    expect(writer.createConclusion).not.toHaveBeenCalled();
  });
});
