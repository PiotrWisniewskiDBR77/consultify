import { describe, expect, it, vi } from 'vitest';

import { duplicateTemplateFromLibrary } from '../templateDuplicateService';

const base = {
  artifactIndexId: 'artifact-index-id',
  canonicalTemplateId: 'canonical-template-id',
  orphaned: false,
} as const;

function dependencies() {
  return {
    post: vi.fn().mockResolvedValue({ data: { template: { templateId: 'doc-copy' } } }),
    clonePresentation: vi.fn().mockResolvedValue({ id: 'deck-copy' }),
    buildWorkbook: vi.fn().mockResolvedValue({ id: 'sheet-copy' }),
  };
}

describe('duplicateTemplateFromLibrary', () => {
  it('creates DOC, DECK and SHEET copies through three real runtime endpoints', async () => {
    const deps = dependencies();

    await expect(
      duplicateTemplateFromLibrary(
        { ...base, templateType: 'report', originRuntime: 'document_template' },
        deps
      )
    ).resolves.toEqual({ openPath: '/presentations/templates/document/doc-copy' });
    await expect(
      duplicateTemplateFromLibrary(
        { ...base, templateType: 'presentation', originRuntime: 'presentation_template' },
        deps
      )
    ).resolves.toEqual({ openPath: '/presentations/templates/deck/deck-copy' });
    await expect(
      duplicateTemplateFromLibrary(
        { ...base, templateType: 'sheet', originRuntime: 'sheet_template' },
        deps
      )
    ).resolves.toEqual({
      openPath: '/tabele?artifactId=sheet-copy&artifact=sheet%3Asheet-copy&code=SHT-SHEET-COPY',
    });

    expect(deps.post).toHaveBeenCalledWith(
      '/document-studio/templates/canonical-template-id/new-version',
      {}
    );
    expect(deps.clonePresentation).toHaveBeenCalledWith('canonical-template-id');
    expect(deps.buildWorkbook).toHaveBeenCalledWith('canonical-template-id', { params: {} });
  });

  it('fails closed before a write for an orphaned template', async () => {
    const deps = dependencies();
    await expect(
      duplicateTemplateFromLibrary(
        {
          ...base,
          templateType: 'sheet',
          originRuntime: 'sheet_template',
          orphaned: true,
        },
        deps
      )
    ).rejects.toThrow('template_duplicate_unavailable');
    expect(deps.post).not.toHaveBeenCalled();
    expect(deps.clonePresentation).not.toHaveBeenCalled();
    expect(deps.buildWorkbook).not.toHaveBeenCalled();
  });
});
