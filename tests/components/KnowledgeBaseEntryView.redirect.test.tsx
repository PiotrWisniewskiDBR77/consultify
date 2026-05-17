/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { KnowledgeBaseEntryView } from '../../src/views/KnowledgeBaseEntryView';

vi.mock('react-router-dom', () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate-target">{to}</div>,
}));

vi.mock('../../src/routes/routeConfig', () => ({
  ROUTES: {
    DOCS: '/docs',
    KNOWLEDGE_BASE_PUBLIC: '/knowledge-base',
  },
}));

describe('KnowledgeBaseEntryView redirect shim', () => {
  it('redirects the legacy knowledge base entry to the canonical docs route', () => {
    render(<KnowledgeBaseEntryView />);

    expect(screen.getByTestId('navigate-target')).toHaveTextContent('/knowledge-base');
  });
});
