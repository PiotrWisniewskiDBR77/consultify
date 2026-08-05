/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const rfHandleTypes = vi.hoisted(() => [] as string[]);

vi.mock('reactflow', () => ({
  Handle: (props: { type?: string }) => {
    rfHandleTypes.push(props.type ?? 'unknown');
    return null;
  },
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
}));

import { BPMNStartNode } from '../../../src/components/MyWork/processflow/nodes/BPMNStartNode';
import { BPMNEndNode } from '../../../src/components/MyWork/processflow/nodes/BPMNEndNode';
import { ActivityNode } from '../../../src/components/MyWork/processflow/nodes/ActivityNode';
import { GatewayNode } from '../../../src/components/MyWork/processflow/nodes/GatewayNode';
import { DataObjectNode } from '../../../src/components/MyWork/processflow/nodes/DataObjectNode';
import { SubprocessNode } from '../../../src/components/MyWork/processflow/nodes/SubprocessNode';
import { PoolNode } from '../../../src/components/MyWork/processflow/nodes/PoolNode';

beforeEach(() => {
  rfHandleTypes.length = 0;
});

describe('BPMNStartNode', () => {
  it('renders with label text', () => {
    render(<BPMNStartNode id="s1" data={{ label: 'Begin' }} selected={false} />);
    expect(screen.getByText('Begin')).toBeDefined();
  });

  it('shows SVG circle element', () => {
    const { container } = render(<BPMNStartNode id="s1" data={{ label: 'Begin' }} selected={false} />);
    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();
  });

  it('renders both source and target handles on all 4 sides (Z23/Fala 7: magnetic connector-snapping parity across every node type, including BPMN start events)', () => {
    render(<BPMNStartNode id="s1" data={{ label: 'Begin' }} selected={false} />);
    expect(rfHandleTypes).toContain('source');
    expect(rfHandleTypes).toContain('target');
    expect(rfHandleTypes).toHaveLength(8);
  });
});

describe('BPMNEndNode', () => {
  it('renders with label text', () => {
    render(<BPMNEndNode id="e1" data={{ label: 'Finish' }} selected={false} />);
    expect(screen.getByText('Finish')).toBeDefined();
  });

  it('shows SVG circle element', () => {
    const { container } = render(<BPMNEndNode id="e1" data={{ label: 'Finish' }} selected={false} />);
    const circle = container.querySelector('circle');
    expect(circle).toBeTruthy();
  });

  it('renders both source and target handles on all 4 sides (Z23/Fala 7: magnetic connector-snapping parity across every node type, including BPMN end events)', () => {
    render(<BPMNEndNode id="e1" data={{ label: 'Finish' }} selected={false} />);
    expect(rfHandleTypes).toContain('target');
    expect(rfHandleTypes).toContain('source');
    expect(rfHandleTypes).toHaveLength(8);
  });
});

describe('ActivityNode', () => {
  it('renders with label', () => {
    render(<ActivityNode id="a1" data={{ label: 'Review' }} selected={false} />);
    expect(screen.getByText('Review')).toBeDefined();
  });

  it('applies selection ring when selected', () => {
    const { container } = render(<ActivityNode id="a1" data={{ label: 'Review' }} selected />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain('ring-2');
    expect(root.className).toContain('ring-c-border-strong');
  });

  it('shows metrics badges when data has duration/cost', () => {
    render(
      <ActivityNode
        id="a1"
        data={{ label: 'Task', duration: 4, durationUnit: 'h', cost: 120 }}
        selected={false}
      />
    );
    expect(screen.getByText('4h')).toBeDefined();
    expect(screen.getByText('$120')).toBeDefined();
  });
});

describe('GatewayNode', () => {
  it('renders with label', () => {
    render(<GatewayNode id="g1" data={{ label: 'Branch' }} selected={false} />);
    expect(screen.getByText('Branch')).toBeDefined();
  });

  it('shows XOR marker (X) when data.gatewayKind is xor or undefined', () => {
    const { container, rerender } = render(
      <GatewayNode id="g1" data={{ label: 'X', gatewayKind: 'xor' }} selected={false} />
    );
    expect(container.querySelector('line[x1="16"][y1="16"]')).toBeTruthy();

    rerender(<GatewayNode id="g1" data={{ label: 'X' }} selected={false} />);
    expect(container.querySelector('line[x1="16"][y1="16"]')).toBeTruthy();
  });

  it('shows AND marker (+) when data.gatewayKind is and', () => {
    const { container } = render(
      <GatewayNode id="g1" data={{ label: 'Join', gatewayKind: 'and' }} selected={false} />
    );
    expect(container.querySelector('line[x1="25"][y1="14"]')).toBeTruthy();
    expect(container.querySelector('line[x1="14"][y1="25"]')).toBeTruthy();
  });
});

describe('DataObjectNode', () => {
  it('renders with label', () => {
    render(<DataObjectNode id="d1" data={{ label: 'Spec' }} selected={false} />);
    expect(screen.getByText('Spec')).toBeDefined();
  });

  it('shows SVG path for folded corner', () => {
    const { container } = render(<DataObjectNode id="d1" data={{ label: 'Spec' }} selected={false} />);
    const foldPath = container.querySelector('path[d="M48 0 L48 12 L60 12"]');
    expect(foldPath).toBeTruthy();
  });
});

describe('SubprocessNode', () => {
  it('renders with label', () => {
    render(<SubprocessNode id="sp1" data={{ label: 'Onboarding' }} selected={false} />);
    expect(screen.getByText('Onboarding')).toBeDefined();
  });

  it('shows [+] marker SVG', () => {
    const { container } = render(
      <SubprocessNode id="sp1" data={{ label: 'Onboarding', collapsed: true }} selected={false} />
    );
    const markerSvg = container.querySelector('svg[viewBox="0 0 12 12"]');
    expect(markerSvg).toBeTruthy();
    expect(markerSvg?.querySelectorAll('line').length).toBe(2);
  });
});

describe('PoolNode', () => {
  it('renders with label text', () => {
    render(<PoolNode id="pool1" data={{ label: 'Sales Pool' }} selected={false} />);
    expect(screen.getByText('Sales Pool')).toBeDefined();
  });

  it('renders with default "Pool" label when no label provided', () => {
    render(<PoolNode id="pool2" data={{}} selected={false} />);
    expect(screen.getByText('Pool')).toBeDefined();
  });

  it('has target and source handles', () => {
    rfHandleTypes.length = 0;
    render(<PoolNode id="pool3" data={{ label: 'Test' }} selected={false} />);
    expect(rfHandleTypes).toContain('target');
    expect(rfHandleTypes).toContain('source');
  });

  it('applies selection ring when selected', () => {
    const { container } = render(
      <PoolNode id="pool4" data={{ label: 'Selected Pool' }} selected={true} />
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('ring-2');
  });
});
