import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TemplatesGalleryView } from '../TemplatesGalleryView';
import type { TemplateItem } from '../types';

const base: TemplateItem = {
  id: 'artifact-sheet-base',
  artifactIndexId: 'artifact-sheet-base',
  canonicalTemplateId: '2ccf6ff1-258e-4509-a163-6cd1a1fdfcd1',
  originRuntime: 'sheet_template',
  source: 'canonical',
  orphaned: false,
  title: 'Supplier scorecard workbook',
  description: 'Accepted TEMPLATE-1 system base',
  type: 'sheet',
  category: 'custom',
  scope: 'system',
  status: 'approved',
  updatedAt: '2026-09-16T00:00:00.000Z',
  createdBy: 'System',
};

describe('TPL-1a template card actions', () => {
  it('system base is read-only but remains usable and duplicable', () => {
    const onBuild = vi.fn();
    const onUse = vi.fn();
    const onDuplicate = vi.fn();
    render(
      <TemplatesGalleryView
        templates={[base]}
        scopeLabel={() => 'Application'}
        resolveUsePath={() => '/presentations?tab=workbook_templates'}
        onBuild={onBuild}
        onUse={onUse}
        onDuplicate={onDuplicate}
        onPreview={vi.fn()}
      />
    );

    expect(screen.getByTestId('template-gallery-build-artifact-sheet-base')).toBeDisabled();
    fireEvent.click(screen.getByTestId('template-gallery-use-artifact-sheet-base'));
    fireEvent.click(screen.getByTestId('template-gallery-duplicate-artifact-sheet-base'));

    expect(onBuild).not.toHaveBeenCalled();
    expect(onUse).toHaveBeenCalledWith(base);
    expect(onDuplicate).toHaveBeenCalledWith(base);
  });

  it('organization copy exposes Build / Edit as a working action', () => {
    const editable = { ...base, id: 'org-copy', scope: 'organization' as const };
    const onBuild = vi.fn();
    render(
      <TemplatesGalleryView
        templates={[editable]}
        scopeLabel={() => 'Organization'}
        resolveUsePath={() => '/presentations?tab=workbook_templates'}
        onBuild={onBuild}
        onUse={vi.fn()}
        onDuplicate={vi.fn()}
        onPreview={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('template-gallery-build-org-copy'));
    expect(onBuild).toHaveBeenCalledWith(editable);
  });
});
