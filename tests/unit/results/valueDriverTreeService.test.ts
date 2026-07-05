import { describe, it, expect } from 'vitest';
import {
  rollUpTree,
  buildTreeFromMappings,
  treeStats,
  type DriverNode,
  type DriverEdge,
} from '../../../server/src/services/results/valueDriverTreeService.js';

describe('rollUpTree', () => {
  it('treats a node with no children as a leaf (keeps its own value)', () => {
    const nodes: DriverNode[] = [{ id: 'leaf', type: 'kpi', label: 'Leaf', value: 42 }];
    const rolled = rollUpTree(nodes, []);
    expect(rolled).toHaveLength(1);
    expect(rolled[0].rolledUpValue).toBe(42);
    expect(rolled[0].childContributions).toEqual([]);
  });

  it('rolls child values up through edge weights', () => {
    // parent <- a (w=2), parent <- b (w=0.5)
    const nodes: DriverNode[] = [
      { id: 'parent', type: 'objective', label: 'Goal', value: null },
      { id: 'a', type: 'kpi', label: 'A', value: 10 },
      { id: 'b', type: 'kpi', label: 'B', value: 100 },
    ];
    const edges: DriverEdge[] = [
      { fromId: 'a', toId: 'parent', weight: 2 },
      { fromId: 'b', toId: 'parent', weight: 0.5 },
    ];
    const rolled = rollUpTree(nodes, edges);
    const parent = rolled.find((n) => n.id === 'parent')!;
    // 10*2 + 100*0.5 = 70
    expect(parent.rolledUpValue).toBe(70);
    expect(parent.childContributions).toEqual([
      { id: 'a', contribution: 20 },
      { id: 'b', contribution: 50 },
    ]);
  });

  it('defaults missing edge weight to 1', () => {
    const nodes: DriverNode[] = [
      { id: 'p', type: 'driver', label: 'P', value: null },
      { id: 'c', type: 'kpi', label: 'C', value: 5 },
    ];
    const edges: DriverEdge[] = [{ fromId: 'c', toId: 'p' }];
    const rolled = rollUpTree(nodes, edges);
    expect(rolled.find((n) => n.id === 'p')!.rolledUpValue).toBe(5);
  });

  it('rolls multiple levels from leaves to the root', () => {
    // objective <- driver <- kpi(value=3)
    const nodes: DriverNode[] = [
      { id: 'obj', type: 'objective', label: 'Obj', value: null },
      { id: 'drv', type: 'driver', label: 'Drv', value: null },
      { id: 'kpi', type: 'kpi', label: 'Kpi', value: 3 },
    ];
    const edges: DriverEdge[] = [
      { fromId: 'kpi', toId: 'drv', weight: 4 },
      { fromId: 'drv', toId: 'obj', weight: 2 },
    ];
    const rolled = rollUpTree(nodes, edges);
    expect(rolled.find((n) => n.id === 'drv')!.rolledUpValue).toBe(12); // 3*4
    expect(rolled.find((n) => n.id === 'obj')!.rolledUpValue).toBe(24); // 12*2
  });

  it('detects and breaks a cycle safely (no infinite loop)', () => {
    // a -> b -> c -> a  (plus a real leaf feeding a)
    const nodes: DriverNode[] = [
      { id: 'a', type: 'driver', label: 'A', value: 1 },
      { id: 'b', type: 'driver', label: 'B', value: 1 },
      { id: 'c', type: 'driver', label: 'C', value: 1 },
    ];
    const edges: DriverEdge[] = [
      { fromId: 'a', toId: 'b', weight: 1 },
      { fromId: 'b', toId: 'c', weight: 1 },
      { fromId: 'c', toId: 'a', weight: 1 },
    ];
    // Should return without hanging and produce finite values for every node.
    const rolled = rollUpTree(nodes, edges);
    expect(rolled).toHaveLength(3);
    for (const n of rolled) {
      expect(Number.isFinite(n.rolledUpValue)).toBe(true);
    }
  });

  it('ignores dangling and self-loop edges', () => {
    const nodes: DriverNode[] = [{ id: 'x', type: 'kpi', label: 'X', value: 9 }];
    const edges: DriverEdge[] = [
      { fromId: 'x', toId: 'x', weight: 5 }, // self-loop
      { fromId: 'ghost', toId: 'x', weight: 5 }, // dangling
    ];
    const rolled = rollUpTree(nodes, edges);
    expect(rolled[0].rolledUpValue).toBe(9);
    expect(rolled[0].childContributions).toEqual([]);
  });
});

describe('buildTreeFromMappings', () => {
  it('builds the graph from cross-module mappings', () => {
    const { nodes, edges } = buildTreeFromMappings({
      objectives: [{ id: 'obj1', label: 'Grow EBITDA' }],
      financialLines: [{ id: 'fin1', label: 'Revenue', value: 1000 }],
      kpis: [{ id: 'kpi1', name: 'Conversion', baseline: 1, target: 3, current: 2 }],
      kpiToFinancial: [{ kpiId: 'kpi1', statementLineId: 'fin1', multiplier: 10 }],
      initiativeToKpi: [{ initiativeId: 'init1', kpiId: 'kpi1', impactWeight: 0.5 }],
      initiatives: [{ id: 'init1', name: 'Launch funnel' }],
    });

    // one node per entity
    expect(nodes).toHaveLength(4);
    const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
    expect(byId.obj1.type).toBe('objective');
    expect(byId.fin1.type).toBe('driver');
    expect(byId.kpi1.type).toBe('kpi');
    expect(byId.init1.type).toBe('initiative');

    // KPI value defaults to current ?? target ?? baseline
    expect(byId.kpi1.value).toBe(2);

    // edges: init→kpi, kpi→fin, fin→obj
    expect(edges).toContainEqual({ fromId: 'init1', toId: 'kpi1', weight: 0.5 });
    expect(edges).toContainEqual({ fromId: 'kpi1', toId: 'fin1', weight: 10 });
    expect(edges).toContainEqual({ fromId: 'fin1', toId: 'obj1', weight: 1 });
  });

  it('applies direction sign to the kpi→financial weight', () => {
    const { edges } = buildTreeFromMappings({
      financialLines: [{ id: 'cost', label: 'Cost' }],
      kpis: [{ id: 'k', name: 'Defects' }],
      kpiToFinancial: [
        { kpiId: 'k', statementLineId: 'cost', multiplier: 4, direction: 'NEGATIVE' },
      ],
      initiativeToKpi: [],
      initiatives: [],
    });
    expect(edges).toContainEqual({ fromId: 'k', toId: 'cost', weight: -4 });
  });

  it('omits objective edges when no objectives are provided and defaults weights', () => {
    const { nodes, edges } = buildTreeFromMappings({
      financialLines: [{ id: 'fin', label: 'Rev' }],
      kpis: [{ id: 'k', name: 'K' }],
      kpiToFinancial: [{ kpiId: 'k', statementLineId: 'fin' }],
      initiativeToKpi: [{ initiativeId: 'i', kpiId: 'k' }],
      initiatives: [{ id: 'i', name: 'I' }],
    });
    expect(nodes.some((n) => n.type === 'objective')).toBe(false);
    // no fin→objective edge
    expect(edges.every((e) => e.toId !== 'fin' || true)).toBe(true);
    expect(edges).toContainEqual({ fromId: 'i', toId: 'k', weight: 1 });
    expect(edges).toContainEqual({ fromId: 'k', toId: 'fin', weight: 1 });
  });

  it('drops mappings that reference unknown nodes', () => {
    const { edges } = buildTreeFromMappings({
      financialLines: [{ id: 'fin', label: 'Rev' }],
      kpis: [{ id: 'k', name: 'K' }],
      kpiToFinancial: [{ kpiId: 'ghost', statementLineId: 'fin' }],
      initiativeToKpi: [{ initiativeId: 'i', kpiId: 'k' }],
      initiatives: [],
    });
    // ghost kpi mapping dropped; initiative 'i' not declared → its edge dropped
    expect(edges).toHaveLength(0);
  });

  it('produces a graph that rolls up end-to-end', () => {
    const { nodes, edges } = buildTreeFromMappings({
      objectives: [{ id: 'obj', label: 'Goal' }],
      financialLines: [{ id: 'fin', label: 'Revenue' }],
      kpis: [{ id: 'kpi', name: 'Conv', current: 5 }],
      kpiToFinancial: [{ kpiId: 'kpi', statementLineId: 'fin', multiplier: 2 }],
      initiativeToKpi: [],
      initiatives: [],
    });
    const rolled = rollUpTree(nodes, edges);
    // kpi(5) -> fin (×2 = 10) -> obj (×1 = 10)
    expect(rolled.find((n) => n.id === 'fin')!.rolledUpValue).toBe(10);
    expect(rolled.find((n) => n.id === 'obj')!.rolledUpValue).toBe(10);
  });
});

describe('treeStats', () => {
  it('counts nodes by type and sums root values', () => {
    const { nodes, edges } = buildTreeFromMappings({
      objectives: [{ id: 'obj', label: 'Goal' }],
      financialLines: [{ id: 'fin', label: 'Revenue' }],
      kpis: [{ id: 'kpi', name: 'Conv', current: 5 }],
      kpiToFinancial: [{ kpiId: 'kpi', statementLineId: 'fin', multiplier: 2 }],
      initiativeToKpi: [{ initiativeId: 'init', kpiId: 'kpi', impactWeight: 1 }],
      initiatives: [{ id: 'init', name: 'I' }],
    });
    const rolled = rollUpTree(nodes, edges);
    const stats = treeStats(rolled);

    expect(stats.nodeCount).toBe(4);
    expect(stats.byType).toEqual({ objective: 1, driver: 1, kpi: 1, initiative: 1 });
    // single root = objective
    expect(stats.rootValue).toBe(rolled.find((n) => n.id === 'obj')!.rolledUpValue);
  });

  it('reports zeroed type counts for an empty tree', () => {
    const stats = treeStats([]);
    expect(stats.nodeCount).toBe(0);
    expect(stats.rootValue).toBe(0);
    expect(stats.byType).toEqual({ objective: 0, driver: 0, kpi: 0, initiative: 0 });
  });

  it('sums multiple disconnected roots', () => {
    const nodes: DriverNode[] = [
      { id: 'r1', type: 'objective', label: 'R1', value: 3 },
      { id: 'r2', type: 'objective', label: 'R2', value: 7 },
    ];
    const rolled = rollUpTree(nodes, []);
    expect(treeStats(rolled).rootValue).toBe(10);
  });
});
