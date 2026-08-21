import { render, screen } from '@testing-library/react';
import { Circle } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { DomainNavigation } from '@/components/settings/shared/DomainNavigation';

describe('DomainNavigation visual contract', () => {
  it('uses the neutral selection semantic instead of the crimson brand/error family', () => {
    render(
      <DomainNavigation
        title="Organization"
        description="Business context"
        navigationLabel="Organization navigation"
        modules={[
          {
            id: 'profile',
            label: 'Organization profile',
            children: [{ id: 'identity', label: 'Identity & scale', icon: Circle }],
          },
        ]}
        activeModule="profile"
        activeChild="identity"
        onChildChange={vi.fn()}
      />
    );

    const active = screen.getByRole('button', { name: 'Identity & scale' });
    expect(active).toHaveAttribute('aria-current', 'page');
    expect(active.className).toContain('var(--c-selection)');
    expect(active.className).toContain('var(--c-focus-solid)');
    expect(active.className).not.toContain('accent-soft');
    expect(active.className).not.toContain('primary-');
  });
});
