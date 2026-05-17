/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { usePageMeta } from '../../../src/hooks/usePageMeta';

function MetaHarness() {
  usePageMeta();
  return <div>meta</div>;
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="*" element={<MetaHarness />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('usePageMeta shell route titles', () => {
  it('sets specific title for /my-work', () => {
    renderAt('/my-work');
    expect(document.title).toBe('My Work — Consultify');
  });

  it('sets specific title for /interview', () => {
    renderAt('/interview');
    expect(document.title).toBe('Interview — Consultify');
  });

  it('keeps public docs title mapping', () => {
    renderAt('/docs');
    expect(document.title).toBe('Documentation — Consultify');
  });
});
