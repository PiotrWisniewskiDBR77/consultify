/**
 * Dev-render host — Artefakt Dokument/Word (SPEC-A archetyp B).
 *
 * Montuje REALNY `DocumentStudioDocumentPanel` (Menu1 + `ExecutiveModuleShell`:
 * lewy rail Outline · centrum dokumentu · prawy rail Sources/Properties/
 * QA/Approvals/Activity/AI) z bogatszym mock `DocumentSchema` niż istniejący
 * `document-studio-m1-share-primary.tsx` — 6 sekcji, komplet typów bloków
 * doradczych (heading/paragraph/bullet_list/numbered_list/callout+assumption/
 * table/kpi_strip/chart), żeby ocenić centrum W PEŁNI (nie tylko jeden akapit).
 * Bez backendu — `getDocumentStudioPolicy()` i pozostałe list/get fail gracefully
 * do pustych stanów (Sources/Approvals/Activity itp. renderują się jako "empty",
 * co jest uczciwym stanem do odbioru §18.1, nie błędem).
 *
 * URL params: ?screen=document-artifact&theme=light|dark&lang=pl|en
 */
import React from 'react';

import { DocumentStudioDocumentPanel } from '@/components/DocumentStudio/DocumentStudioDocumentPanel';
import type { DocumentSchema } from '@/components/DocumentStudio/types';

const schema: DocumentSchema = {
  documentId: 'mock-doc-report-2',
  artifactId: 'mock-doc-report-2',
  title: 'Raport statusu — Ekspansja DE Q3 2026',
  documentType: 'steering_committee_report',
  language: 'pl',
  audience: ['steering_committee', 'sponsor'],
  goal: 'inform',
  communicationRegister: 'executive',
  density: 'standard',
  languageStyle: 'consulting',
  confidentiality: 'client_confidential',
  owner: 'piotr.wisniewski@dbr77.com',
  clientId: 'client-elkomtech',
  sourcePackId: 'sp-2026-07-de-expansion',
  templateRef: { templateId: 'tpl-steering-committee', templateVersion: '2.1' },
  createdAt: new Date('2026-07-14T09:00:00Z').toISOString(),
  sourceRefs: [
    {
      sourceType: 'initiative',
      sourceId: 'init-1',
      sourceTitle: 'Ekspansja DE',
      sourceVersion: '4',
    },
    { sourceType: 'table', sourceId: 'tbl-budget-de', sourceTitle: 'Budżet — arkusz kontroli' },
    { sourceType: 'interview', sourceId: 'int-9', sourceTitle: 'Wywiad: zespół sprzedaży DE' },
  ],
  sections: [
    {
      sectionId: 'sec-summary',
      orderIndex: 0,
      level: 1,
      title: 'Streszczenie wykonawcze',
      purpose: '3 kluczowe wnioski dla komitetu sterującego',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'b-summary-p1',
          type: 'paragraph',
          content: {
            text: 'Projekt postępuje zgodnie z planem; budżet wykorzystany w 62%. Rekrutacja zespołu sprzedaży w Berlinie opóźniona o 3 tygodnie, bez wpływu na datę startu pilota.',
          },
        },
        {
          blockId: 'b-summary-kpi',
          type: 'kpi_strip',
          content: {
            items: [
              { label: 'Budżet wykorzystany', value: '62%', delta: '+8pp vs plan', trend: 'flat' },
              { label: 'Kamienie milowe on-time', value: '5/6', trend: 'up' },
              { label: 'Ryzyka otwarte', value: '2', delta: '-1 vs poprz. okres', trend: 'up' },
              { label: 'Confidence', value: '78%', trend: 'up' },
            ],
          },
        },
      ],
    },
    {
      sectionId: 'sec-context',
      orderIndex: 1,
      level: 1,
      title: 'Kontekst i metodyka',
      purpose: 'Zakres raportu i źródła danych',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'b-ctx-p1',
          type: 'paragraph',
          content: {
            text: 'Raport obejmuje okres 1–30 czerwca 2026. Dane pochodzą z modułu Initiatives, arkusza kontroli budżetu oraz wywiadów przeprowadzonych z zespołem lokalnym.',
          },
        },
        {
          blockId: 'b-ctx-list',
          type: 'bullet_list',
          content: {
            items: [
              'Zakres: rynek DE, segment mid-market',
              'Właściciel inicjatywy: Piotr Wiśniewski',
              'Interesariusze: Zarząd, Sprzedaż DE, Finanse',
            ],
          },
        },
      ],
    },
    {
      sectionId: 'sec-findings',
      orderIndex: 2,
      level: 1,
      title: 'Kluczowe wnioski',
      purpose: 'Co się zmieniło od ostatniego raportu',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'b-find-list',
          type: 'numbered_list',
          content: {
            items: [
              'Pilot w Berlinie startuje zgodnie z planem 15 sierpnia.',
              'Koszt pozyskania klienta (CAC) o 12% niższy niż zakładano.',
              'Lokalny partner logistyczny wymaga renegocjacji SLA.',
            ],
          },
        },
        {
          blockId: 'b-find-assumption',
          type: 'callout',
          isAssumption: true,
          content: {
            variant: 'warning',
            text: 'Założenie: utrzymanie obecnego kursu EUR/PLN — brak twardego źródła, do zatwierdzenia przez Finanse.',
          },
        },
      ],
    },
    {
      sectionId: 'sec-metrics',
      orderIndex: 3,
      level: 1,
      title: 'Wskaźniki realizacji',
      purpose: 'Budżet i harmonogram per strumień prac',
      sourceRefs: [
        { sourceType: 'table', sourceId: 'tbl-budget-de', sourceTitle: 'Budżet — arkusz kontroli' },
      ],
      blocks: [
        {
          blockId: 'b-metrics-table',
          type: 'table',
          sourceRef: { sourceType: 'table', sourceId: 'tbl-budget-de' },
          content: {
            columns: ['Strumień prac', 'Budżet', 'Wykorzystano', 'Status'],
            rows: [
              ['Rekrutacja', '180k EUR', '96k EUR', 'W toku'],
              ['Marketing lokalny', '120k EUR', '88k EUR', 'W toku'],
              ['Systemy i integracje', '90k EUR', '81k EUR', 'Zagrożone'],
              ['Compliance / prawo', '40k EUR', '12k EUR', 'Na czas'],
            ],
          },
        },
      ],
    },
    {
      sectionId: 'sec-trend',
      orderIndex: 4,
      level: 1,
      title: 'Trend przychodu pilotażowego',
      purpose: 'Prognoza vs plan',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'b-trend-chart',
          type: 'chart',
          content: {
            kind: 'line',
            title: 'Przychód pilota DE (k EUR)',
            categories: ['Sie', 'Wrz', 'Paź', 'Lis', 'Gru'],
            series: [
              { label: 'Plan', values: [10, 32, 58, 90, 130] },
              { label: 'Prognoza', values: [8, 29, 61, 95, 142] },
            ],
            caption: 'Prognoza aktualizowana co miesiąc na bazie danych CRM.',
          },
        },
      ],
    },
    {
      sectionId: 'sec-recommendation',
      orderIndex: 5,
      level: 1,
      title: 'Rekomendacja',
      purpose: 'Decyzja wymagana od komitetu',
      sourceRefs: [],
      blocks: [
        {
          blockId: 'b-rec-p1',
          type: 'paragraph',
          content: {
            text: 'Rekomendujemy kontynuację projektu bez zmian budżetowych oraz przyspieszenie renegocjacji SLA z partnerem logistycznym przed startem pilota.',
          },
        },
        {
          blockId: 'b-rec-callout',
          type: 'callout',
          content: {
            variant: 'info',
            text: 'Decyzja komitetu wymagana do 25 lipca — inaczej start pilota przesuwa się o kolejny miesiąc.',
          },
        },
      ],
    },
  ],
};

export default function DocumentArtifactScreen(): React.ReactElement {
  return (
    <DocumentStudioDocumentPanel
      artifactId={schema.artifactId}
      schema={schema}
      onStartOver={() => {
        // eslint-disable-next-line no-console
        console.log('[dev-render] onStartOver');
      }}
      onSchemaUpdated={(next) => {
        // eslint-disable-next-line no-console
        console.log('[dev-render] onSchemaUpdated', next);
      }}
    />
  );
}
