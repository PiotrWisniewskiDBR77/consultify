/**
 * AIRoleBadge Component Tests
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { AIRoleBadge } from '../../../src/components/AIChat/AIRoleBadge';

describe('AIRoleBadge (L2)', () => {
  it('renders role label and title description', () => {
    render(<AIRoleBadge role="OPERATOR" />);
    const badge = screen.getByText('Operator').closest('span') as HTMLElement;
    expect(badge).toBeInTheDocument();
    expect(badge.getAttribute('title')).toBe('Can execute actions');
  });

  it('renders description inline when showDescription=true and uses md size classes', () => {
    render(<AIRoleBadge role="ADVISOR" showDescription size="md" />);
    expect(screen.getByText('Advisor')).toBeInTheDocument();
    expect(screen.getByText(/Read-only assistance/i)).toBeInTheDocument();
    const badge = screen.getByText('Advisor').closest('span') as HTMLElement;
    expect(badge.className).toContain('text-xs');
  });
});

