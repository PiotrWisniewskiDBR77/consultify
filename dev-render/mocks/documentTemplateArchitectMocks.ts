/**
 * window.fetch mock for the dev-render screen `gen-word-content-hints`.
 *
 * Unlike the presentation/workbook mocks (which patch Api.* methods because
 * main.tsx clobbers Api.get at load), the DocumentStudio api layer
 * (src/components/DocumentStudio/api.ts) calls `fetchWithRetry` → global
 * `fetch` directly, so intercepting `window.fetch` for `/api/document-studio/*`
 * is the right seam here. Installed at MOUNT, disposed on unmount. Lets the
 * new per-section `contentHints` field (W2 genword-hints) be screenshotted
 * BEFORE the owner sees it (rule #7). No backend/DB.
 */

const BASE = '/api/document-studio';

function section(
  title: string,
  purpose: string,
  contentHints?: string[],
  opts?: {
    level?: 1 | 2 | 3;
    required?: boolean;
    expectedLengthHint?: 'short' | 'medium' | 'long';
    keyMessage?: string;
    dataNeeded?: string[];
    suggestedEvidence?: string;
  }
) {
  return {
    title,
    level: opts?.level ?? (1 as const),
    purpose,
    required: opts?.required ?? true,
    expectedLengthHint: opts?.expectedLengthHint ?? ('medium' as const),
    requiredData: [],
    optionalData: [],
    contentHints,
    // W5 genword-briefing — richer per-section briefing (read-only display).
    keyMessage: opts?.keyMessage,
    dataNeeded: opts?.dataNeeded,
    suggestedEvidence: opts?.suggestedEvidence,
  };
}

const DRAFT_TEMPLATE = {
  templateId: 'tpl-word-dev-render-1',
  organizationId: 'org-dev',
  name: 'Raport zarządczy (miesięczny)',
  category: 'management',
  documentType: 'steering_committee_report',
  purpose: 'Standardowy miesięczny raport dla komitetu sterującego.',
  audience: ['executive'],
  language: 'pl',
  languageStyle: 'formal',
  communicationRegister: 'executive',
  density: 'balanced',
  confidentiality: 'internal',
  requiredInputs: [],
  sectionBlueprint: [
    section(
      'Streszczenie zarządcze',
      'Zwięzłe podsumowanie statusu i kluczowej decyzji.',
      [
        'Zacznij od jednego zdania o ogólnym statusie programu',
        'Wyróżnij decyzję wymaganą od komitetu',
      ],
      {
        level: 1,
        required: true,
        expectedLengthHint: 'long',
        keyMessage: 'Program dostarcza wartość, ale jedna decyzja budżetowa jest pilna',
        dataNeeded: ['status kluczowych inicjatyw', 'prognoza budżetu do końca kwartału'],
        suggestedEvidence: 'tabela statusu inicjatyw + wykres wydatków vs. plan',
      }
    ),
    section(
      'Status realizacji',
      'Postęp vs. plan, kamienie milowe.',
      [
        'Zestaw obecny status z docelowym kamieniem milowym',
        'Wskaż odchylenia i ich przyczyny',
        'Podaj prognozę na kolejny okres',
      ],
      { level: 1, required: true, expectedLengthHint: 'medium' }
    ),
    section('Postęp wg obszarów', 'Skrócony status per obszar/strumień prac.', undefined, {
      level: 2,
      required: true,
      expectedLengthHint: 'short',
    }),
    section('Ryzyka i problemy', 'Kluczowe ryzyka wymagające uwagi.', undefined, {
      level: 1,
      required: false,
      expectedLengthHint: 'medium',
    }),
    section(
      'Szczegóły ryzyka wysokiego priorytetu',
      'Rozwinięcie pojedynczego ryzyka, jeśli dotyczy.',
      undefined,
      { level: 3, required: false, expectedLengthHint: 'short' }
    ),
    section(
      'Następne kroki',
      'Działania i decyzje na kolejny okres.',
      ['Zakończ jawną prośbą o decyzję, nie tylko aktualizacją'],
      { level: 1, required: true, expectedLengthHint: 'short' }
    ),
  ],
  exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: false },
  // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31): Word never had a color
  // pattern concept before; this seeds one so the picker's "selected" state
  // is visible on load, not just after a click.
  formattingSchema: { colorTemplateId: 'ocean' },
  status: 'draft',
  version: '0.1.0',
  createdBy: 'dev',
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

let templates = [DRAFT_TEMPLATE];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function installDocumentTemplateArchitectFetchMock(): () => void {
  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();

    if (url.includes(`${BASE}/templates`)) {
      // revise structure: PATCH/POST .../templates/:id/structure
      if (url.includes('/structure') && method !== 'GET') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        const sections = body.sections || body.sectionBlueprint || DRAFT_TEMPLATE.sectionBlueprint;
        // Fala 1 (2026-07-28) — "wzorzec kolorów" (N31).
        templates = templates.map((t) =>
          t.templateId === DRAFT_TEMPLATE.templateId
            ? {
                ...t,
                sectionBlueprint: sections,
                formattingSchema:
                  'colorTemplateId' in body
                    ? { ...t.formattingSchema, colorTemplateId: body.colorTemplateId ?? null }
                    : t.formattingSchema,
                updatedAt: '2026-07-23T00:05:00.000Z',
              }
            : t
        );
        return json({ template: templates[0] });
      }
      // plan (draft new)
      if (url.includes('/templates/plan')) {
        return json({ template: DRAFT_TEMPLATE, llmRefined: false });
      }
      // list
      if (method === 'GET') {
        return json({ templates });
      }
    }

    return realFetch(input as RequestInfo, init);
  };

  return () => {
    window.fetch = realFetch;
  };
}
