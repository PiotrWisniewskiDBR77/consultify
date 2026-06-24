import { describe, it, expect } from 'vitest';
import {
  evaluateTree,
  propagateChange,
  treeToChartData,
  DriverTreeCycleError,
  type DriverNode,
} from '../../../server/src/services/driverTreeService';

describe('driverTreeService — evaluateTree', () => {
  it('computes Przychód = klienci × ARPU', () => {
    const nodes: DriverNode[] = [
      { id: 'klienci', label: 'Klienci', kind: 'input', value: 100 },
      { id: 'arpu', label: 'ARPU', kind: 'input', value: 50 },
      {
        id: 'przychod',
        label: 'Przychód',
        kind: 'formula',
        op: '*',
        operands: ['klienci', 'arpu'],
        formula: 'Klienci × ARPU',
      },
    ];

    const { values, order } = evaluateTree(nodes);

    expect(values.przychod).toBe(5000);
    expect(values.klienci).toBe(100);
    expect(values.arpu).toBe(50);
    // leaves must precede the formula that consumes them
    expect(order.indexOf('klienci')).toBeLessThan(order.indexOf('przychod'));
    expect(order.indexOf('arpu')).toBeLessThan(order.indexOf('przychod'));
  });

  it('evaluates nested formulas (Przychód = klienci × ARPU × retencja)', () => {
    // Two-level tree: base = klienci × ARPU, then przychod = base × retencja
    const nodes: DriverNode[] = [
      { id: 'klienci', label: 'Klienci', kind: 'input', value: 200 },
      { id: 'arpu', label: 'ARPU', kind: 'input', value: 30 },
      { id: 'retencja', label: 'Retencja', kind: 'input', value: 0.9 },
      {
        id: 'base',
        label: 'Przychód bazowy',
        kind: 'formula',
        op: '*',
        operands: ['klienci', 'arpu'],
      },
      {
        id: 'przychod',
        label: 'Przychód',
        kind: 'formula',
        op: 'product',
        operands: ['base', 'retencja'],
      },
    ];

    const { values, order } = evaluateTree(nodes);

    expect(values.base).toBe(6000);
    expect(values.przychod).toBeCloseTo(5400, 6);
    // nested dependency order: base before przychod
    expect(order.indexOf('base')).toBeLessThan(order.indexOf('przychod'));
  });

  it('supports sum / subtraction / division reducers', () => {
    const nodes: DriverNode[] = [
      { id: 'a', label: 'A', kind: 'input', value: 10 },
      { id: 'b', label: 'B', kind: 'input', value: 4 },
      { id: 'c', label: 'C', kind: 'input', value: 2 },
      { id: 'suma', label: 'Suma', kind: 'formula', op: 'sum', operands: ['a', 'b', 'c'] },
      { id: 'roznica', label: 'Różnica', kind: 'formula', op: '-', operands: ['a', 'b', 'c'] },
      { id: 'iloraz', label: 'Iloraz', kind: 'formula', op: '/', operands: ['a', 'c'] },
    ];

    const { values } = evaluateTree(nodes);
    expect(values.suma).toBe(16);
    expect(values.roznica).toBe(4); // 10 - 4 - 2
    expect(values.iloraz).toBe(5); // 10 / 2
  });

  it('treats missing input value as 0', () => {
    const nodes: DriverNode[] = [
      { id: 'x', label: 'X', kind: 'input' },
      { id: 'y', label: 'Y', kind: 'input', value: 7 },
      { id: 'sum', label: 'Sum', kind: 'formula', op: '+', operands: ['x', 'y'] },
    ];
    expect(evaluateTree(nodes).values.sum).toBe(7);
  });
});

describe('driverTreeService — propagateChange', () => {
  const baseNodes: DriverNode[] = [
    { id: 'klienci', label: 'Klienci', kind: 'input', value: 100 },
    { id: 'arpu', label: 'ARPU', kind: 'input', value: 50 },
    {
      id: 'przychod',
      label: 'Przychód',
      kind: 'formula',
      op: '*',
      operands: ['klienci', 'arpu'],
    },
  ];

  it('propagates an ARPU change into the revenue delta', () => {
    const { before, after, delta } = propagateChange(baseNodes, 'arpu', 60);

    expect(before.przychod).toBe(5000);
    expect(after.przychod).toBe(6000);
    // ARPU itself changed by +10, revenue by +1000
    expect(delta.arpu).toBe(10);
    expect(delta.przychod).toBe(1000);
    // unaffected input must NOT appear in delta
    expect(delta.klienci).toBeUndefined();
  });

  it('does not mutate the input node list', () => {
    propagateChange(baseNodes, 'arpu', 999);
    const arpu = baseNodes.find((n) => n.id === 'arpu');
    expect(arpu?.value).toBe(50); // unchanged
  });

  it('rejects changing a formula node', () => {
    expect(() => propagateChange(baseNodes, 'przychod', 1)).toThrow(/formula/i);
  });

  it('rejects an unknown node id', () => {
    expect(() => propagateChange(baseNodes, 'nope', 1)).toThrow(/unknown/i);
  });
});

describe('driverTreeService — cycle detection', () => {
  it('throws DriverTreeCycleError on a direct cycle', () => {
    const nodes: DriverNode[] = [
      { id: 'a', label: 'A', kind: 'formula', op: '+', operands: ['b'] },
      { id: 'b', label: 'B', kind: 'formula', op: '+', operands: ['a'] },
    ];
    expect(() => evaluateTree(nodes)).toThrow(DriverTreeCycleError);
  });

  it('throws on a multi-hop cycle and reports the cycle path', () => {
    const nodes: DriverNode[] = [
      { id: 'a', label: 'A', kind: 'formula', op: '+', operands: ['b'] },
      { id: 'b', label: 'B', kind: 'formula', op: '+', operands: ['c'] },
      { id: 'c', label: 'C', kind: 'formula', op: '+', operands: ['a'] },
    ];
    try {
      evaluateTree(nodes);
      throw new Error('expected cycle error');
    } catch (err) {
      expect(err).toBeInstanceOf(DriverTreeCycleError);
      expect((err as DriverTreeCycleError).cycle.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('throws on an unknown operand reference', () => {
    const nodes: DriverNode[] = [
      { id: 'a', label: 'A', kind: 'formula', op: '+', operands: ['ghost'] },
    ];
    expect(() => evaluateTree(nodes)).toThrow(/unknown operand/i);
  });
});

describe('driverTreeService — treeToChartData', () => {
  const nodes: DriverNode[] = [
    { id: 'klienci', label: 'Klienci', kind: 'input', value: 100 },
    { id: 'arpu', label: 'ARPU', kind: 'input', value: 50 },
    {
      id: 'przychod',
      label: 'Przychód',
      kind: 'formula',
      op: '*',
      operands: ['klienci', 'arpu'],
      formula: 'Klienci × ARPU',
    },
  ];

  it('produces a single recursive root with children', () => {
    const { values } = evaluateTree(nodes);
    const { root } = treeToChartData(nodes, values);

    expect(root.id).toBe('przychod');
    expect(root.label).toBe('Przychód');
    expect(root.value).toBe(5000);
    expect(root.formula).toBe('Klienci × ARPU');
    expect(root.op).toBe('*');
    expect(root.children).toHaveLength(2);

    const childIds = root.children.map((c) => c.id).sort();
    expect(childIds).toEqual(['arpu', 'klienci']);
    const klienci = root.children.find((c) => c.id === 'klienci');
    expect(klienci?.value).toBe(100);
    expect(klienci?.children).toHaveLength(0);
  });

  it('falls back to evaluateTree when values are omitted', () => {
    const { root } = treeToChartData(nodes);
    expect(root.value).toBe(5000);
  });

  it('wraps multiple roots under a synthetic "Drivers" root', () => {
    const multiRoot: DriverNode[] = [
      { id: 'a', label: 'A', kind: 'input', value: 3 },
      { id: 'b', label: 'B', kind: 'input', value: 4 },
    ];
    const { root } = treeToChartData(multiRoot);
    expect(root.id).toBe('__root__');
    expect(root.label).toBe('Drivers');
    expect(root.children.map((c) => c.id).sort()).toEqual(['a', 'b']);
    expect(root.value).toBe(7);
  });
});
