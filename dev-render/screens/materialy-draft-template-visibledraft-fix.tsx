/**
 * Dev-render: MATERIAŁY ▸ Biblioteka wzorców — naprawa widoczności DRAFT
 * szablonu dokumentu (2026-07-28, zgłoszenie właściciela "wciśnę nowy
 * template i on wywoła mi to, co wcześniej przygotowałem, a nie bohomazy").
 *
 * DIAGNOZA (potwierdzona kodem + żywą bazą demo, tylko SELECT):
 *  - `backfillDocStudioTemplatesForOrg` (server/src/services/v8/artifactRegistryService.ts)
 *    indeksował do rejestru artefaktów WYŁĄCZNIE `document_studio_templates`
 *    o statusie 'approved'. Każdy świeżo utworzony szablon (z Architekta LUB
 *    z nowo podłączonego "Zrób z tego wzorzec" — DocumentStudioDocumentPanel,
 *    Fala 2 2026-07-28) startuje jako 'draft' — więc NIGDY nie trafiał do tej
 *    listy (Materiały ▸ Szablony). Akcja "Submit for review" (promocja
 *    draft→approved) jest wierszową akcją TEJ SAMEJ tabeli — ślepy zaułek:
 *    nie da się kliknąć czegoś, czego nie widać.
 *  - Żywa baza (trolley): jedyny osobisty szablon dokumentu Piotra
 *    ("Raport zarządczy test", status='draft', created_by=jego user id)
 *    faktycznie nie pojawiał się w tym zapytaniu — dowód na łańcuchu SQL.
 *  - Prezentacje NIE MIAŁY tego ograniczenia (`backfillPresentationTemplatesForOrg`
 *    nie filtruje statusu) — draft decki już dziś pokazują się z działającym
 *    "Submit for review". Naprawa ujednolica Word z Prezentacjami.
 *
 * NAPRAWA: usunięto `AND t.status = 'approved'` z zapytania backfillu — teraz
 * mirroruje dokładnie to, co i tak już zwraca `documentTemplateRegistryDao
 * .loadTemplatesForOrg` (używane wewnątrz samego Architekta), więc oba widoki
 * (Architekt i zewnętrzna Biblioteka Materiały ▸ Szablony) są spójne.
 *
 * Ten harness renderuje REALNY `<TemplatesTabContent />` z mock-wierszem w
 * kształcie, jaki produkuje `mapCanonicalTemplateArtifact` PO naprawie: wiersz
 * DRAFT/organization obok istniejącego APPROVED, z widocznym statusem
 * "Draft" i klikalną akcją "Submit for review" + aktywnym "Użyj wzorca"
 * (backend `resolveDocumentTemplateForCreation` blokuje tylko 'deprecated',
 * więc draft jest w pełni użyteczny do generacji już dziś).
 *
 * URL: ?screen=materialy-draft-template-visibledraft-fix[&lang=pl|en][&theme=light|dark]
 */
import React, { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';

import { TemplatesTabContent } from '../../src/components/ReportsAndPresentations/TemplatesTabContent';
import type { TemplateItem } from '../../src/components/ReportsAndPresentations/types';
import type { FilterChip } from '../../src/components/shared/ModuleHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';

const TEMPLATES: TemplateItem[] = [
  {
    id: 'idx-draft-0001-0001-0001-000000000001',
    artifactIndexId: 'idx-draft-0001-0001-0001-000000000001',
    canonicalTemplateId: 'doc-template-1753700000000-abcd1234',
    originRuntime: 'document_template',
    source: 'canonical',
    legacy: false,
    orphaned: false,
    title: 'Raport zarządczy — mój wzorzec (draft)',
    description:
      'PO NAPRAWIE: świeżo utworzony przez właściciela szablon (status draft) jest teraz ' +
      'widoczny tu, w Materiały ▸ Szablony — wcześniej ten wiersz nie pojawiał się WCALE, ' +
      'niezależnie od tego czy powstał z Architekta czy z "Zrób z tego wzorzec".',
    type: 'report',
    category: 'executive_update',
    scope: 'organization',
    status: 'draft',
    updatedAt: '2026-07-28T10:15:00.000Z',
    createdBy: 'Piotr Wiśniewski',
    sectionCount: 6,
  },
  {
    id: 'idx-approved-0002-0002-0002-000000000002',
    artifactIndexId: 'idx-approved-0002-0002-0002-000000000002',
    canonicalTemplateId: 'doc-template-1750000000000-efgh5678',
    originRuntime: 'document_template',
    source: 'canonical',
    legacy: false,
    orphaned: false,
    title: 'Raport diagnostyczny — wzorzec zatwierdzony',
    description:
      'Dla porównania: wzorzec już zatwierdzony (approved) — to jedyny stan, który dawniej się pokazywał.',
    type: 'report',
    category: 'R3',
    scope: 'organization',
    status: 'approved',
    updatedAt: '2026-07-18T09:30:00.000Z',
    createdBy: 'Piotr Wiśniewski',
    sectionCount: 7,
  },
  {
    id: 'idx-system-0003-0003-0003-000000000003',
    artifactIndexId: 'idx-system-0003-0003-0003-000000000003',
    canonicalTemplateId: 'mck-doc-business-case',
    originRuntime: 'document_template',
    source: 'canonical',
    legacy: false,
    orphaned: false,
    title: '[System] business case (PL)',
    description: 'Szablon systemowy — zawsze approved, zawsze widoczny (bez zmian).',
    type: 'report',
    category: 'custom',
    scope: 'system',
    status: 'approved',
    updatedAt: '2026-06-11T20:36:14.000Z',
    createdBy: 'System',
    sectionCount: 5,
  },
];

export default function MaterialyDraftTemplateVisibilityFixScreen(): React.ReactElement {
  const [activeFilters, setActiveFilters] = useState<FilterChip[]>([]);

  return (
    <MemoryRouter initialEntries={['/materialy?tab=templates']}>
      <FeatureFlagsProvider showDevTools={false}>
        <div className="h-screen w-screen bg-c-bg">
          <div className="border-b border-c-border px-6 py-3">
            <div className="text-sm font-semibold text-c-text">
              Materiały ▸ Biblioteka wzorców — naprawa: draft szablonu dokumentu teraz widoczny
            </div>
            <div className="mt-0.5 text-xs text-c-text-muted">
              Wiersz 1 (Draft, klikalny wiersz) to stan NOWY po naprawie backfillu — wcześniej ten
              wiersz był całkowicie nieobecny w tej tabeli. Kliknij go, żeby zobaczyć status „Draft"
              w preview i akcję „Submit for review" w menu wiersza (widoczna tylko dla
              draft+organization).
            </div>
          </div>
          <div className="h-[calc(100%-72px)]">
            <TemplatesTabContent
              viewMode="table"
              searchQuery=""
              activeFilters={activeFilters}
              onFilterChange={setActiveFilters}
              templates={TEMPLATES}
              loading={false}
              error={null}
            />
          </div>
        </div>
      </FeatureFlagsProvider>
    </MemoryRouter>
  );
}
