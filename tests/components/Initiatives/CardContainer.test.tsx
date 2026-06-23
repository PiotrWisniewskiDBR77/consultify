/**
 * @vitest-environment jsdom
 *
 * M13/K2 — CardContainer + CardHeader (registry-driven section shell).
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { CardContainer, CardHeader } from '@/components/Initiatives/sections/shared/CardContainer';
import type { SectionTypeInfo } from '@/components/Initiatives/sections/types';

const sectionType: SectionTypeInfo = {
  id: 's1',
  key: 'tasks',
  name: 'Tasks',
  namePl: 'Zadania',
  description: null,
  descriptionPl: null,
  category: 'content',
  columnPosition: 'left',
  defaultOrder: 1,
  icon: 'tasks',
  iconColor: 'text-blue-500',
  iconBg: 'bg-blue-500/10',
  componentKey: 'tasks',
  isSystem: true,
  isActive: true,
};

describe('CardContainer (K2 registry-driven)', () => {
  it('derives title/icon/iconBg from sectionType when not given', () => {
    const { container } = render(
      <CardContainer id="x" sectionType={sectionType} expanded onToggle={() => {}}>
        <div>body-content</div>
      </CardContainer>
    );
    expect(screen.getByText('Zadania')).toBeInTheDocument(); // namePl from registry
    expect(screen.getByText('body-content')).toBeInTheDocument();
    expect(container.querySelector('[class*="bg-blue-500"]')).toBeTruthy(); // registry iconBg
    expect(container.querySelector('svg')).toBeTruthy(); // resolved icon
  });

  it('explicit title/icon win over sectionType (backward-compatible)', () => {
    render(
      <CardContainer
        id="x"
        title="Custom Title"
        icon={<span>IC</span>}
        iconBg="bg-rose-500/10"
        expanded
        onToggle={() => {}}
        sectionType={sectionType}
      >
        <div>b</div>
      </CardContainer>
    );
    expect(screen.getByText('Custom Title')).toBeInTheDocument();
    expect(screen.queryByText('Zadania')).not.toBeInTheDocument();
  });

  it('CardHeader renders the registry title + actions slot', () => {
    render(<CardHeader sectionType={sectionType} actions={<button>Act</button>} />);
    expect(screen.getByText('Zadania')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Act' })).toBeInTheDocument();
  });

  it('falls back to a neutral icon for an unknown registry icon name', () => {
    const { container } = render(
      <CardHeader sectionType={{ ...sectionType, icon: 'totally-unknown', namePl: 'X' }} />
    );
    expect(container.querySelector('svg')).toBeTruthy(); // LayoutGrid fallback
  });
});
