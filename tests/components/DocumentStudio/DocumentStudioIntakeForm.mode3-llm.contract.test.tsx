/**
 * M18/L-04 — contract: Mode3 (template) must pass useLlm:true to onSubmit.
 *
 * WHY: Template provides structure, LLM fills the content (same as Mode1).
 * Before this fix, inTemplateMode ? false : useLlm hardcoded useLlm=false
 * for Mode3, silently bypassing LLM generation even when a template was
 * selected. The fix changes false → true (line 126 of IntakeForm).
 *
 * This test renders the form with an approved template, selects it, fills
 * the required description, submits, and asserts that onSubmit received
 * useLlm:true — i.e. the Mode3 LLM gate is open.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DocumentStudioIntakeForm } from '../../../src/components/DocumentStudio/DocumentStudioIntakeForm';
import type { DocumentTemplate } from '../../../src/components/DocumentStudio/types';

const STUB_TEMPLATE: DocumentTemplate = {
  templateId: 'tpl-001',
  organizationId: 'org-test',
  name: 'Executive Memo',
  category: 'memo',
  documentType: 'executive_memo',
  purpose: 'A short memo for C-level stakeholders.',
  audience: ['C-suite'],
  language: 'en',
  languageStyle: 'formal',
  communicationRegister: 'executive',
  density: 'standard',
  confidentiality: 'internal',
  requiredInputs: [],
  sectionBlueprint: [],
  exportRules: { docx: true, pdf: true, markdown: false, approvalRequiredForExport: false },
  status: 'approved',
  version: '1.0',
  createdBy: 'test',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

describe('DocumentStudioIntakeForm — Mode3 LLM gate (M18/L-04)', () => {
  it('passes useLlm:true when a template is selected (Mode3)', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentStudioIntakeForm
        onSubmit={onSubmit}
        approvedTemplates={[STUB_TEMPLATE]}
        loading={false}
      />
    );

    // Select the template (triggers inTemplateMode = true)
    const templateSelect = screen.getByRole('combobox', { name: /template/i });
    fireEvent.change(templateSelect, { target: { value: 'tpl-001' } });

    // Fill the required description (min 10 chars)
    const descriptionField = screen.getByRole('textbox', { name: /description|brief/i });
    fireEvent.change(descriptionField, { target: { value: 'Test description for the executive memo document.' } });

    // Submit the form
    const submitBtn = screen.getByRole('button', { name: /generat/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    const [_intake, options] = onSubmit.mock.calls[0] as [unknown, { useLlm: boolean; templateId: string }];

    // Core assertion: Mode3 must use LLM (M18/L-04 fix)
    expect(options.useLlm).toBe(true);
    // Template id must be forwarded
    expect(options.templateId).toBe('tpl-001');
  });

  it('uses the current LLM default when no template is selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DocumentStudioIntakeForm
        onSubmit={onSubmit}
        approvedTemplates={[STUB_TEMPLATE]}
        loading={false}
      />
    );

    // No template selected → inTemplateMode = false → falls back to useLlm state (default false)
    const descriptionField = screen.getByRole('textbox', { name: /description|brief/i });
    fireEvent.change(descriptionField, { target: { value: 'A plain document without template.' } });

    const submitBtn = screen.getByRole('button', { name: /generat|plan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    const [_intake, options] = onSubmit.mock.calls[0] as [unknown, { useLlm: boolean; templateId: string | null }];

    expect(options.useLlm).toBe(true);
    expect(options.templateId).toBeNull();
  });

  it('blocks Mode3 until every required source is bound and submits exact template version', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const requiredTemplate = {
      ...STUB_TEMPLATE,
      version: '1.7',
      requiredInputs: ['Current plan status', 'Risk register'],
    };
    render(
      <DocumentStudioIntakeForm
        onSubmit={onSubmit}
        approvedTemplates={[requiredTemplate]}
        loading={false}
      />
    );

    fireEvent.change(screen.getByRole('combobox', { name: /template/i }), {
      target: { value: 'tpl-001' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /description/i }), {
      target: { value: 'Board control report for the current programme.' },
    });
    const submit = screen.getByRole('button', { name: /generate from template/i });
    expect(submit).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Current plan status'), {
      target: { value: 'Execution is on plan.' },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Risk register'), {
      target: { value: 'https://example.test/risk-register' },
    });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    expect(onSubmit.mock.calls[0][1]).toMatchObject({
      templateId: 'tpl-001',
      templateVersion: '1.7',
      sourceRefs: [
        expect.objectContaining({ sourceType: 'text', sourceTitle: 'Current plan status' }),
        expect.objectContaining({ sourceType: 'text', sourceTitle: 'Risk register' }),
      ],
    });
  });
});
