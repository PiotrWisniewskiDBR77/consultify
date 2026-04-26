import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DegradedState, ReadOnlyState, UnavailableState } from '@/components/Admin/AdminState';
import { ADMIN_UI_COPY } from '@/utils/adminUiCopy';

describe('AdminState', () => {
  it('uses shared READY unavailable copy by default', () => {
    render(<UnavailableState />);

    expect(screen.getByText(ADMIN_UI_COPY.unavailable.title)).toBeInTheDocument();
    expect(screen.getByText(ADMIN_UI_COPY.unavailable.description)).toBeInTheDocument();
  });

  it('uses shared READY read-only copy by default', () => {
    render(<ReadOnlyState />);

    expect(screen.getByText(ADMIN_UI_COPY.readOnly.title)).toBeInTheDocument();
    expect(screen.getByText(ADMIN_UI_COPY.readOnly.description)).toBeInTheDocument();
  });

  it('uses shared READY degraded copy by default', () => {
    render(<DegradedState />);

    expect(screen.getByText(ADMIN_UI_COPY.degraded.title)).toBeInTheDocument();
    expect(screen.getByText(ADMIN_UI_COPY.degraded.description)).toBeInTheDocument();
  });
});
