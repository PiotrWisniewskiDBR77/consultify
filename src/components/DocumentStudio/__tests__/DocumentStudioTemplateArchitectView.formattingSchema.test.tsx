/**
 * @vitest-environment jsdom
 *
 * P0 regression (2026-09-02, zgłoszenie #42, docs/program/grafika/ZGLOSZENIA_DO_TORU_FUNKCJI.md).
 *
 * Repro: a template record whose `formattingSchema` is PARTIAL (e.g. only
 * `{ colorTemplateId: 'ocean' }` — see dev-render mock
 * `dev-render/mocks/documentTemplateArchitectMocks.ts` and the "wzorzec
 * kolorów" N31 comment in `../types.ts`) crashed the whole Template
 * Architect screen to a blank white page on row click:
 *   TypeError: Cannot read properties of undefined (reading 'enabled')
 * at DocumentStudioTemplateArchitectView.tsx — the Word-layout editor
 * dereferenced `editFormatting.headers.enabled` / `.footers.enabled` /
 * `.fonts.body` directly, assuming the full formattingSchema shape.
 *
 * Fix: `normalizeTemplateFormattingSchema` (types.ts) fills in missing
 * top-level/nested fields with `DEFAULT_TEMPLATE_FORMATTING_SCHEMA` at both
 * write sites (initial select effect + Reset button) instead of scattering
 * optional chaining across every render call site.
 */

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentStudioTemplateArchitectView } from '../DocumentStudioTemplateArchitectView';
import type { DocumentTemplate } from '../types';

// Exact repro shape: a DRAFT template whose formattingSchema only carries the
// color-pattern field, same as the dev-render mock's DRAFT_TEMPLATE.
const PARTIAL_FORMATTING_TEMPLATE: DocumentTemplate = {
  templateId: 'tpl-p0-partial-formatting',
  organizationId: 'org-test',
  name: 'Raport zarządczy (partial formatting)',
  // 'management' is not a member of TemplateCategory (see types.ts) — the
  // closest real category for a steering_committee_report is 'report'.
  category: 'report',
  documentType: 'steering_committee_report',
  purpose: 'Repro record for zgłoszenie #42.',
  audience: ['executive'],
  language: 'pl',
  languageStyle: 'formal',
  communicationRegister: 'executive',
  density: 'standard',
  confidentiality: 'internal',
  requiredInputs: [],
  sectionBlueprint: [
    {
      title: 'Streszczenie zarządcze',
      level: 1,
      purpose: 'Podsumowanie statusu.',
      required: true,
      expectedLengthHint: 'medium',
    },
  ],
  // The bug: this object is missing `headers` / `footers` / `fonts` — the
  // render code used to dereference those directly.
  formattingSchema: { colorTemplateId: 'ocean' } as DocumentTemplate['formattingSchema'],
  exportRules: { docx: true, pdf: true, markdown: true, approvalRequiredForExport: false },
  status: 'draft',
  version: '0.1.0',
  createdBy: 'test',
  createdAt: '2026-07-23T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
};

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    listDocumentStudioTemplates: vi.fn(async () => [PARTIAL_FORMATTING_TEMPLATE]),
    listDocumentStudioTemplateAudit: vi.fn(async () => []),
  };
});

describe('DocumentStudioTemplateArchitectView — partial formattingSchema row click', () => {
  it('renders the Word-layout editor instead of crashing when a template has a partial formattingSchema', async () => {
    render(<DocumentStudioTemplateArchitectView />);

    const rowText = await screen.findByText(PARTIAL_FORMATTING_TEMPLATE.name);

    // Before the fix, this click threw
    // "TypeError: Cannot read properties of undefined (reading 'enabled')"
    // synchronously during render, which React Testing Library surfaces by
    // rejecting/throwing out of this act() — i.e. this test is RED
    // pre-fix and GREEN post-fix.
    await userEvent.click(rowText);

    // The Word-layout fieldset (Header/Footer/Body font controls) must
    // render — proof the crash didn't happen and the editor is usable, not
    // just that "no error was thrown".
    const legend = await screen.findByText('Word layout');
    const fieldset = legend.closest('fieldset');
    expect(fieldset).not.toBeNull();

    const scoped = within(fieldset as HTMLElement);
    expect(scoped.getByText('Header')).toBeInTheDocument();
    expect(scoped.getByText('Footer')).toBeInTheDocument();

    // Defaults were backfilled (headers default to enabled per
    // DEFAULT_TEMPLATE_FORMATTING_SCHEMA), so the header checkbox is
    // checked and its content input is enabled — not just present.
    const headerCheckbox = scoped.getByRole('checkbox', { name: 'Header' });
    expect(headerCheckbox).toBeChecked();
    const headerContentInput = screen.getByTestId('template-header-content');
    expect(headerContentInput).not.toBeDisabled();
  });

  it('does not crash and hides the "unsaved changes" reset control on plain selection', async () => {
    render(<DocumentStudioTemplateArchitectView />);

    const rowText = await screen.findByText(PARTIAL_FORMATTING_TEMPLATE.name);
    await userEvent.click(rowText);

    await waitFor(() => {
      expect(screen.getByText('Word layout')).toBeInTheDocument();
    });

    // Selecting alone (no edits) must not show "unsaved changes" — otherwise
    // the normalize-on-load fix would itself introduce a false-dirty
    // regression by filling in defaults the raw record never compares
    // against.
    expect(screen.queryByText('Reset')).not.toBeInTheDocument();
  });
});
