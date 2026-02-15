import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { SidebarHeader } from '../../../../src/components/navigation/Sidebar/SidebarHeader';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
}));

describe('SidebarHeader (L2)', () => {
  const t = (_key: string, fallback?: string) => fallback ?? _key;

  it('renders full logo and calls onToggleCollapse', () => {
    const onToggleCollapse = vi.fn();
    render(<SidebarHeader showFull theme="light" onToggleCollapse={onToggleCollapse} t={t} />);

    const img = screen.getByAltText('Consultinity') as HTMLImageElement;
    expect(img.src).toContain('/assets/logos/logo-light.png');

    fireEvent.click(screen.getByRole('button', { name: /Collapse/i }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  it('renders compact header (77) and uses dark logo when theme=dark', () => {
    const onToggleCollapse = vi.fn();
    render(
      <SidebarHeader showFull={false} theme="dark" onToggleCollapse={onToggleCollapse} t={t} />
    );

    expect(screen.getByText('77')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Expand/i }));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });
});
