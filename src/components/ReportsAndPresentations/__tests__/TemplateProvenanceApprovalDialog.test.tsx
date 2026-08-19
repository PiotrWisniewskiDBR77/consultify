import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TemplateProvenanceApprovalDialog } from '../TemplateProvenanceApprovalDialog';

describe('TemplateProvenanceApprovalDialog', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('crypto', { randomUUID: () => 'stable-approval-key' });
  });

  it('keeps an unknown template quarantined until all evidence is explicitly approved', async () => {
    const onApproved = vi.fn();
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            templates: [
              {
                registry: 'presentation_templates',
                templateId: 'tpl-1',
                name: 'Board pack',
                provenanceStatus: 'unknown',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ replayed: false, receipt: { templateId: 'tpl-1' } }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ templates: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    const user = userEvent.setup();
    render(<TemplateProvenanceApprovalDialog open onClose={vi.fn()} onApproved={onApproved} />);

    await user.click(await screen.findByRole('button', { name: /Board pack/ }));
    const approve = screen.getByRole('button', { name: 'Zatwierdź kompletne pochodzenie' });
    expect(approve).toBeDisabled();
    for (const [label, value] of [
      ['Źródło / autor / właściciel', 'Internal design team'],
      ['Podstawa licencji lub praw', 'Owned work product'],
      ['Organ zatwierdzający / zakres decyzji', 'Product owner'],
      ['Wersja zatwierdzanego wzorca', 'v3'],
      ['Trwałe evidence (ID, ścieżka lub URL)', 'evidence://rights/tpl-1'],
    ]) {
      await user.type(screen.getByLabelText(label), value);
    }
    await user.click(approve);

    await waitFor(() => expect(onApproved).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[1];
    expect(fetchMock.mock.calls[1][0]).toBe('/api/deliverables/templates/tpl-1/provenance/approve');
    expect((init?.headers as Record<string, string>)['Idempotency-Key']).toBe(
      'stable-approval-key'
    );
    expect(JSON.parse(String(init?.body))).toEqual({
      registry: 'presentation_templates',
      source: 'Internal design team',
      licenseBasis: 'Owned work product',
      authority: 'Product owner',
      version: 'v3',
      evidence: 'evidence://rights/tpl-1',
    });
    expect(
      await screen.findByText('Brak wzorców oczekujących na pochodzenie.')
    ).toBeInTheDocument();
  });
});
