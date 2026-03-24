import { describe, expect, it } from 'vitest';
import { DependencyGraph } from '../dependencyGraph.js';

describe('DependencyGraph', () => {
  it('getDependents returns correct transitive dependents', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    g.addField('C', ['B']);

    const dependents = g.getDependents('A');
    expect(dependents).toEqual(expect.arrayContaining(['B', 'C']));
    expect(dependents).toHaveLength(2);
  });

  it('getDependencies returns correct transitive dependencies', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    g.addField('C', ['B']);

    const deps = g.getDependencies('C');
    expect(deps).toEqual(expect.arrayContaining(['B', 'A']));
    expect(deps).toHaveLength(2);
  });

  it('getComputeOrder returns correct topological order', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    g.addField('C', ['B']);

    const order = g.getComputeOrder();
    const idxA = order.indexOf('A');
    const idxB = order.indexOf('B');
    const idxC = order.indexOf('C');

    expect(idxA).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxC);
  });

  it('detectCycle returns cycle path when cycle exists', () => {
    const g = new DependencyGraph();
    g.addField('A', ['C']);
    g.addField('B', ['A']);
    g.addField('C', ['B']);

    const cycle = g.detectCycle();
    expect(cycle).not.toBeNull();
    expect(cycle!.length).toBeGreaterThanOrEqual(2);
  });

  it('detectCycle returns null when no cycle', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    g.addField('C', ['B']);

    const cycle = g.detectCycle();
    expect(cycle).toBeNull();
  });

  it('removeField updates dependents correctly', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    g.addField('C', ['B']);

    g.removeField('B');

    const dependentsOfA = g.getDependents('A');
    expect(dependentsOfA).not.toContain('B');
    expect(dependentsOfA).not.toContain('C');
  });

  it('handles complex diamond graph (A→B→C, A→C) correctly', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    g.addField('C', ['A', 'B']);

    const order = g.getComputeOrder();
    const idxA = order.indexOf('A');
    const idxB = order.indexOf('B');
    const idxC = order.indexOf('C');

    expect(idxA).toBeLessThan(idxB);
    expect(idxA).toBeLessThan(idxC);
    expect(idxB).toBeLessThan(idxC);
    expect(g.detectCycle()).toBeNull();
  });

  it('getDependents returns empty for leaf node', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    expect(g.getDependents('B')).toEqual([]);
  });

  it('getDependencies returns empty for root node', () => {
    const g = new DependencyGraph();
    g.addField('B', ['A']);
    expect(g.getDependencies('A')).toEqual([]);
  });
});
