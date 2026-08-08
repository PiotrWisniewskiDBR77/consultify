/** @vitest-environment jsdom */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  TEMPLATE_RIGHT_TOOLS,
  TemplateRightPanel,
} from '@/components/TemplateBuilder/TemplateRightPanel';
import type { TemplateDraft } from '@/components/TemplateBuilder/templateBuilderModel';

const draft: TemplateDraft = {
  type: 'doc',
  name: 'Executive report',
  description: 'Reusable report structure',
  scope: 'org',
  themeRef: null,
  doc: [],
  deck: [],
  table: [],
};

describe('TemplateRightPanel honest UI', () => {
  it('registers only real tools and exposes no dead Teresa action', () => {
    render(
      <TemplateRightPanel
        activeTool="properties"
        draft={draft}
        themeOptions={[]}
        onDraftChange={vi.fn()}
      />
    );

    expect(TEMPLATE_RIGHT_TOOLS.map((tool) => tool.id)).toEqual(['properties']);
    expect(screen.getByTestId('template-properties-panel')).toBeInTheDocument();
    expect(screen.queryByText(/Teres/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Otwórz rozmowę/i })).not.toBeInTheDocument();
  });
});
