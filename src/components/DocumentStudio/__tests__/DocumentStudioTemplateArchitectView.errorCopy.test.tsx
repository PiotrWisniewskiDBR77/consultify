/**
 * @vitest-environment jsdom
 */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../api', async () => {
  const actual = await vi.importActual<typeof import('../api')>('../api');
  return {
    ...actual,
    listDocumentStudioTemplates: vi.fn(async () => {
      throw { errorCode: 'VALIDATION', correlationId: 'tpl-corr-1' };
    }),
    listDocumentStudioTemplateAudit: vi.fn(async () => []),
  };
});

import { DocumentStudioTemplateArchitectView } from '../DocumentStudioTemplateArchitectView';

describe('DocumentStudioTemplateArchitectView error copy', () => {
  it('renders governed app-error copy through the template architect TFunction adapter', async () => {
    render(<DocumentStudioTemplateArchitectView />);

    await waitFor(() => expect(screen.getByText(/tpl-corr-1/)).toBeInTheDocument());
    expect(screen.getByText(/Some of the provided information needs attention\./)).toBeInTheDocument();
  });
});
