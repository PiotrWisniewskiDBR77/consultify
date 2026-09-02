/** Day 235: real Word template architect with draft/approved/deprecated fixtures. */
import React, { useEffect, useState } from 'react';

const baseTemplate = {
  organizationId: 'org-day235',
  category: 'management',
  documentType: 'steering_committee_report',
  purpose: 'Miesięczny raport zarządczy z decyzjami i dowodami.',
  audience: ['executive'],
  language: 'pl',
  languageStyle: 'formal',
  communicationRegister: 'executive',
  density: 'balanced',
  confidentiality: 'internal',
  requiredInputs: [],
  sectionBlueprint: [
    {
      title: 'Streszczenie zarządcze',
      level: 1,
      purpose: 'Wniosek i decyzja',
      required: true,
      expectedLengthHint: 'long',
      requiredData: [],
      optionalData: [],
      contentHints: ['Nazwij zmianę względem planu', 'Zakończ prośbą o decyzję'],
    },
    {
      title: 'Postęp i odchylenia',
      level: 1,
      purpose: 'Plan kontra wykonanie',
      required: true,
      expectedLengthHint: 'medium',
      requiredData: [],
      optionalData: [],
    },
    {
      title: 'Ryzyka i następne kroki',
      level: 1,
      purpose: 'Ryzyka, właściciele i terminy',
      required: true,
      expectedLengthHint: 'medium',
      requiredData: [],
      optionalData: [],
    },
  ],
  exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: false },
  formattingSchema: { colorTemplateId: 'ocean' },
  version: '1.0.0',
  createdBy: 'day235',
  createdAt: '2026-09-01T08:00:00.000Z',
  updatedAt: '2026-09-01T08:30:00.000Z',
};

const templates = [
  {
    ...baseTemplate,
    templateId: 'day235-draft',
    name: 'Raport zarządczy — szkic',
    status: 'draft',
  },
  {
    ...baseTemplate,
    templateId: 'day235-approved',
    name: 'Raport komitetu — zatwierdzony',
    status: 'approved',
  },
  {
    ...baseTemplate,
    templateId: 'day235-deprecated',
    name: 'Raport miesięczny — wycofany',
    status: 'deprecated',
  },
];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default function Day235MaterialyArchitektSzablonowScreen(): React.ReactElement {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const realFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (
        url.includes('/api/document-studio/templates') &&
        (!init?.method || init.method === 'GET')
      )
        return json({ templates });
      return realFetch(input, init);
    };
    setReady(true);
    return () => {
      window.fetch = realFetch;
    };
  }, []);

  if (!ready) return <div className="h-screen bg-c-bg" />;
  const Architect = React.lazy(() =>
    import('@/components/DocumentStudio/DocumentStudioTemplateArchitectView').then((m) => ({
      default: m.DocumentStudioTemplateArchitectView,
    }))
  );
  return (
    <div className="min-h-screen bg-c-bg p-8">
      <React.Suspense fallback={<div className="text-c-text-muted">Ładowanie…</div>}>
        <Architect />
      </React.Suspense>
    </div>
  );
}
