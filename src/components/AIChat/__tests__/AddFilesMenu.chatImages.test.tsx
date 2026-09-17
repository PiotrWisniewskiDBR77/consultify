/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AddFilesMenu } from '../AddFilesMenu';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback || _key }),
}));

vi.mock('../../../services/api', () => ({
  Api: { deleteKnowledgeDocument: vi.fn() },
}));

describe('AddFilesMenu — chat image picker gate', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps the CHAT-IMG-0 picker contract byte-for-byte while the flag is OFF', () => {
    render(
      <MemoryRouter>
        <AddFilesMenu onFileSelect={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByTestId('add-files-hidden-input')).toHaveAttribute(
      'accept',
      '.pdf,.txt,.md,.json,.csv,.docx'
    );
  });

  it('adds png/jpeg/webp/gif to the picker and forwards the selected image when ON', () => {
    vi.stubEnv('VITE_CHAT_IMAGES', 'true');
    const onFileSelect = vi.fn((files: File[]) => files);
    render(
      <MemoryRouter>
        <AddFilesMenu onFileSelect={onFileSelect} />
      </MemoryRouter>
    );
    const picker = screen.getByTestId('add-files-hidden-input');
    expect(picker).toHaveAttribute(
      'accept',
      '.pdf,.txt,.md,.json,.csv,.docx,.png,.jpg,.jpeg,.webp,.gif'
    );
    const image = new File(['png'], 'picked.png', { type: 'image/png' });
    fireEvent.change(picker, { target: { files: [image] } });
    expect(onFileSelect).toHaveBeenCalledWith([image]);
  });
});
