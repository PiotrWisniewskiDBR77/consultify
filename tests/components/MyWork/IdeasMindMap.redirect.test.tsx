/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IdeasMindMap } from '../../../src/components/MyWork/IdeasMindMap';

const navigateMock = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigateMock,
}));

vi.mock('../../../src/routes/routeConfig', () => ({
  ROUTES: {
    MY_WORK: '/my-work',
  },
}));

describe('IdeasMindMap redirect shim', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('redirects the deprecated standalone ideas surface to the canonical My Work ideas lane', async () => {
    render(<IdeasMindMap ideas={[]} />);

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith('/my-work/ideas', { replace: true });
    });
  });
});
