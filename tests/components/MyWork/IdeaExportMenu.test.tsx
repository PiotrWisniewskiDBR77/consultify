import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import enTranslation from '../../../public/locales/en/translation.json';

import { IdeaExportMenu } from '../../../src/components/MyWork/IdeaExportMenu';

// IdeaExportMenu.tsx calls t('myWorkIdeas.exportMenu.pasteImportPayload') etc.
// with NO inline fallback (relies on public/locales/en/translation.json).
// The global tests/setup.ts mock returns the raw key for calls without a
// fallback, so this test's placeholder/text assertions never matched real
// product copy. Resolve real English copy instead.
function resolveTranslation(key: string, options?: Record<string, unknown>): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, segment) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[segment] : undefined),
      enTranslation
    );
  const template = typeof value === 'string' ? value : key;
  if (!options) return template;
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name) =>
    Object.prototype.hasOwnProperty.call(options, name) ? String(options[name]) : `{{${name}}}`
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => resolveTranslation(key, options),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

describe('IdeaExportMenu', () => {
  it('previews and imports a diagram package payload', () => {
    const onImportGraph = vi.fn();

    render(
      <IdeaExportMenu
        open
        onClose={vi.fn()}
        ideaId="idea-1"
        title="Process hardening"
        graphNodes={[]}
        graphEdges={[]}
        onImportGraph={onImportGraph}
      />
    );

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'diagram_package' },
    });

    const payload = JSON.stringify({
      version: 'consultify.diagram-package.v1',
      title: 'Imported flow',
      nodes: [{ id: 'n-1', type: 'flowNode', data: { label: 'Start' }, position: { x: 0, y: 0 } }],
      edges: [],
      extensions: { processFlow: { lanes: [{ id: 'lane-1', label: 'Lane 1', color: '#abc' }] } },
    });

    fireEvent.change(screen.getByPlaceholderText(/Paste import payload/i), {
      target: { value: payload },
    });

    expect(screen.getByText(/Ready to import: 1 nodes, 0 edges/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Import into workspace/i }));

    expect(onImportGraph).toHaveBeenCalledTimes(1);
    expect(onImportGraph.mock.calls[0][0]).toMatchObject({
      title: 'Imported flow',
      nodes: [{ id: 'n-1' }],
      edges: [],
    });
  });
});
