import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TemplatesGalleryView } from '../TemplatesGalleryView';
import type { TemplateItem } from '../types';

/**
 * D-36 (QA16): the hover action row on a gallery tile used `flex-nowrap`, which
 * forced four labelled buttons (~455px) onto one line inside a ~427px tile
 * (`lg:grid-cols-3`, viewport 1440px). The article's `overflow-hidden` then
 * clipped ~14px off each side — the "Build / Edit" icon cut on the left and the
 * "Preview" label cut on the right (measured in `evidence/qoder-a-d36-20260918`).
 *
 * jsdom has no layout engine, so the honest freeze here is structural: the row
 * must ALLOW wrapping (`flex-wrap`, never `flex-nowrap`) so the buttons can
 * reflow onto two lines instead of overflowing the tile, and all four actions
 * must remain present and labelled.
 */
const item: TemplateItem = {
  id: 'tpl-d36',
  artifactIndexId: 'tpl-d36',
  canonicalTemplateId: 'c-d36',
  originRuntime: 'document_template',
  source: 'canonical',
  orphaned: false,
  title: 'tpl-d36-quarterly-review',
  description: 'tpl-d36-narrative-pack',
  type: 'report',
  category: 'R2',
  scope: 'organization',
  status: 'approved',
  sectionCount: 7,
  updatedAt: '2026-09-12T00:00:00.000Z',
  createdBy: 'System',
};

function renderGallery() {
  return render(
    <TemplatesGalleryView
      templates={[item]}
      scopeLabel={() => 'Organization'}
      resolveUsePath={() => '/presentations?tab=templates'}
      onUse={vi.fn()}
      onBuild={vi.fn()}
      onDuplicate={vi.fn()}
      onPreview={vi.fn()}
    />
  );
}

describe('D-36 gallery tile hover action row', () => {
  it('lets the four-action row wrap instead of overflowing the tile', () => {
    renderGallery();

    const buildBtn = screen.getByTestId('template-gallery-build-tpl-d36');
    const row = buildBtn.parentElement as HTMLElement;

    expect(row.className).toContain('flex-wrap');
    expect(row.className).not.toContain('flex-nowrap');
  });

  it('keeps all four hover actions present and labelled', () => {
    renderGallery();

    expect(screen.getByTestId('template-gallery-build-tpl-d36')).toBeInTheDocument();
    expect(screen.getByTestId('template-gallery-use-tpl-d36')).toBeInTheDocument();
    expect(screen.getByTestId('template-gallery-duplicate-tpl-d36')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /preview/i })).toBeInTheDocument();
  });
});
