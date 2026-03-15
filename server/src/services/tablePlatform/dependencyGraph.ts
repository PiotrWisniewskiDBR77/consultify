/**
 * Dependency Graph for computed/formula fields.
 * Adjacency-list based with topological sort (Kahn's) and cycle detection (DFS coloring).
 */

export class DependencyGraph {
  /** fieldId → set of field IDs it depends on */
  private dependencies = new Map<string, Set<string>>();
  /** fieldId → set of field IDs that depend on it (reverse edges) */
  private dependents = new Map<string, Set<string>>();

  addField(fieldId: string, dependsOn: string[]): void {
    this.dependencies.set(fieldId, new Set(dependsOn));

    if (!this.dependents.has(fieldId)) {
      this.dependents.set(fieldId, new Set());
    }

    for (const dep of dependsOn) {
      if (!this.dependents.has(dep)) {
        this.dependents.set(dep, new Set());
      }
      this.dependents.get(dep)!.add(fieldId);

      if (!this.dependencies.has(dep)) {
        this.dependencies.set(dep, new Set());
      }
    }
  }

  removeField(fieldId: string): void {
    const deps = this.dependencies.get(fieldId);
    if (deps) {
      for (const dep of deps) {
        this.dependents.get(dep)?.delete(fieldId);
      }
    }
    this.dependencies.delete(fieldId);

    const revDeps = this.dependents.get(fieldId);
    if (revDeps) {
      for (const rev of revDeps) {
        this.dependencies.get(rev)?.delete(fieldId);
      }
    }
    this.dependents.delete(fieldId);
  }

  /** All fields that transitively depend on the given field (BFS on reverse edges). */
  getDependents(fieldId: string): string[] {
    const visited = new Set<string>();
    const queue = [fieldId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const revDeps = this.dependents.get(current);
      if (!revDeps) continue;

      for (const dep of revDeps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(visited);
  }

  /** All fields this field transitively depends on (BFS on forward edges). */
  getDependencies(fieldId: string): string[] {
    const visited = new Set<string>();
    const queue = [fieldId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const deps = this.dependencies.get(current);
      if (!deps) continue;

      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          queue.push(dep);
        }
      }
    }

    return Array.from(visited);
  }

  /** Topological sort using Kahn's algorithm. Returns field IDs in safe compute order. */
  getComputeOrder(): string[] {
    const inDegree = new Map<string, number>();
    const allNodes = new Set<string>();

    for (const [node, deps] of this.dependencies) {
      allNodes.add(node);
      for (const d of deps) allNodes.add(d);
    }

    for (const node of allNodes) {
      inDegree.set(node, 0);
    }

    for (const [node, deps] of this.dependencies) {
      inDegree.set(node, (inDegree.get(node) ?? 0) + deps.size);
    }

    // Recount: inDegree should be the number of dependencies each node has
    // that are also in the graph
    for (const node of allNodes) {
      const deps = this.dependencies.get(node);
      inDegree.set(node, deps ? deps.size : 0);
    }

    const queue: string[] = [];
    for (const [node, deg] of inDegree) {
      if (deg === 0) queue.push(node);
    }

    const order: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      order.push(node);

      const revDeps = this.dependents.get(node);
      if (revDeps) {
        for (const dep of revDeps) {
          const newDeg = (inDegree.get(dep) ?? 1) - 1;
          inDegree.set(dep, newDeg);
          if (newDeg === 0) {
            queue.push(dep);
          }
        }
      }
    }

    return order;
  }

  /** Detect cycles using DFS with 3-color marking. Returns cycle path or null. */
  detectCycle(): string[] | null {
    const WHITE = 0;
    const GRAY = 1;
    const BLACK = 2;

    const color = new Map<string, number>();
    const parent = new Map<string, string | null>();

    const allNodes = new Set<string>();
    for (const [node, deps] of this.dependencies) {
      allNodes.add(node);
      for (const d of deps) allNodes.add(d);
    }

    for (const node of allNodes) {
      color.set(node, WHITE);
    }

    for (const node of allNodes) {
      if (color.get(node) === WHITE) {
        const cycle = this.dfsVisit(node, color, parent, WHITE, GRAY, BLACK);
        if (cycle) return cycle;
      }
    }

    return null;
  }

  private dfsVisit(
    node: string,
    color: Map<string, number>,
    parent: Map<string, string | null>,
    WHITE: number,
    GRAY: number,
    BLACK: number
  ): string[] | null {
    color.set(node, GRAY);

    const deps = this.dependencies.get(node);
    if (deps) {
      for (const dep of deps) {
        if (color.get(dep) === GRAY) {
          // Back edge found — reconstruct cycle
          const cycle = [dep, node];
          let cur = node;
          while (cur !== dep) {
            const p = parent.get(cur);
            if (p === undefined || p === null) break;
            cycle.push(p);
            cur = p;
          }
          return cycle.reverse();
        }

        if (color.get(dep) === WHITE) {
          parent.set(dep, node);
          const cycle = this.dfsVisit(dep, color, parent, WHITE, GRAY, BLACK);
          if (cycle) return cycle;
        }
      }
    }

    color.set(node, BLACK);
    return null;
  }
}
