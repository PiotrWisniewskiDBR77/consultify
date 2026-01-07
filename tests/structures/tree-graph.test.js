/**
 * Tree and Graph Data Structure Tests
 * Tests for hierarchical and graph data
 * 
 * @module tests/structures/tree-graph.test.js
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Tree node
const createTreeNode = (data, children = []) => ({
    data,
    children: [...children],
});

// Tree operations
const createTreeOperations = () => {
    return {
        traverse: (node, callback, order = 'pre') => {
            if (!node) return;

            if (order === 'pre') callback(node);

            for (const child of node.children) {
                this.traverse(child, callback, order);
            }

            if (order === 'post') callback(node);
        },

        find: (node, predicate) => {
            if (!node) return null;
            if (predicate(node)) return node;

            for (const child of node.children) {
                const found = this.find(child, predicate);
                if (found) return found;
            }

            return null;
        },

        findAll: (node, predicate) => {
            const results = [];

            this.traverse(node, (n) => {
                if (predicate(n)) results.push(n);
            });

            return results;
        },

        map: (node, transform) => {
            if (!node) return null;

            return {
                ...transform(node),
                children: node.children.map(child => this.map(child, transform)),
            };
        },

        filter: (node, predicate) => {
            if (!node || !predicate(node)) return null;

            return {
                ...node,
                children: node.children
                    .map(child => this.filter(child, predicate))
                    .filter(Boolean),
            };
        },

        flatten: (node) => {
            const result = [];
            this.traverse(node, (n) => result.push(n.data));
            return result;
        },

        depth: (node) => {
            if (!node || node.children.length === 0) return 0;
            return 1 + Math.max(...node.children.map(c => this.depth(c)));
        },

        count: (node) => {
            if (!node) return 0;
            return 1 + node.children.reduce((sum, c) => sum + this.count(c), 0);
        },

        pathTo: (root, predicate, path = []) => {
            if (!root) return null;

            const currentPath = [...path, root];

            if (predicate(root)) return currentPath;

            for (const child of root.children) {
                const found = this.pathTo(child, predicate, currentPath);
                if (found) return found;
            }

            return null;
        },
    };
};

// Graph implementation
const createGraph = (directed = false) => {
    const nodes = new Map(); // nodeId -> data
    const edges = new Map(); // nodeId -> Map<targetId, weight>

    return {
        addNode: (id, data = {}) => {
            nodes.set(id, data);
            if (!edges.has(id)) {
                edges.set(id, new Map());
            }
        },

        removeNode: (id) => {
            nodes.delete(id);
            edges.delete(id);

            // Remove edges pointing to this node
            for (const edgeMap of edges.values()) {
                edgeMap.delete(id);
            }
        },

        addEdge: (from, to, weight = 1) => {
            if (!edges.has(from)) edges.set(from, new Map());
            edges.get(from).set(to, weight);

            if (!directed) {
                if (!edges.has(to)) edges.set(to, new Map());
                edges.get(to).set(from, weight);
            }
        },

        removeEdge: (from, to) => {
            edges.get(from)?.delete(to);
            if (!directed) {
                edges.get(to)?.delete(from);
            }
        },

        getNode: (id) => nodes.get(id),

        getNeighbors: (id) => {
            const nodeEdges = edges.get(id);
            return nodeEdges ? [...nodeEdges.keys()] : [];
        },

        getEdgeWeight: (from, to) => {
            return edges.get(from)?.get(to);
        },

        hasNode: (id) => nodes.has(id),

        hasEdge: (from, to) => edges.get(from)?.has(to) || false,

        getNodes: () => [...nodes.keys()],

        getEdges: () => {
            const result = [];
            for (const [from, edgeMap] of edges) {
                for (const [to, weight] of edgeMap) {
                    if (directed || from < to) {
                        result.push({ from, to, weight });
                    }
                }
            }
            return result;
        },

        bfs: (startId, callback) => {
            const visited = new Set();
            const queue = [startId];

            while (queue.length > 0) {
                const nodeId = queue.shift();
                if (visited.has(nodeId)) continue;

                visited.add(nodeId);
                callback(nodeId, nodes.get(nodeId));

                for (const neighbor of this.getNeighbors(nodeId)) {
                    if (!visited.has(neighbor)) {
                        queue.push(neighbor);
                    }
                }
            }
        },

        dfs: (startId, callback) => {
            const visited = new Set();

            const visit = (nodeId) => {
                if (visited.has(nodeId)) return;

                visited.add(nodeId);
                callback(nodeId, nodes.get(nodeId));

                for (const neighbor of this.getNeighbors(nodeId)) {
                    visit(neighbor);
                }
            };

            visit(startId);
        },

        shortestPath: (from, to) => {
            const distances = new Map();
            const previous = new Map();
            const unvisited = new Set(nodes.keys());

            distances.set(from, 0);

            while (unvisited.size > 0) {
                let current = null;
                let minDist = Infinity;

                for (const nodeId of unvisited) {
                    const dist = distances.get(nodeId) ?? Infinity;
                    if (dist < minDist) {
                        minDist = dist;
                        current = nodeId;
                    }
                }

                if (current === null || current === to) break;

                unvisited.delete(current);

                for (const neighbor of this.getNeighbors(current)) {
                    const alt = minDist + (edges.get(current).get(neighbor) || 1);
                    if (alt < (distances.get(neighbor) ?? Infinity)) {
                        distances.set(neighbor, alt);
                        previous.set(neighbor, current);
                    }
                }
            }

            // Reconstruct path
            const path = [];
            let current = to;
            while (current !== undefined) {
                path.unshift(current);
                current = previous.get(current);
            }

            return path[0] === from ? { path, distance: distances.get(to) } : null;
        },
    };
};

describe('Tree Operations Tests', () => {
    let ops;
    let tree;

    beforeEach(() => {
        ops = createTreeOperations();
        tree = createTreeNode({ id: 1, value: 'root' }, [
            createTreeNode({ id: 2, value: 'a' }, [
                createTreeNode({ id: 4, value: 'a1' }),
                createTreeNode({ id: 5, value: 'a2' }),
            ]),
            createTreeNode({ id: 3, value: 'b' }, [
                createTreeNode({ id: 6, value: 'b1' }),
            ]),
        ]);
    });

    it('should traverse pre-order', () => {
        const values = [];
        ops.traverse(tree, (n) => values.push(n.data.id));

        expect(values).toEqual([1, 2, 4, 5, 3, 6]);
    });

    it('should find node', () => {
        const found = ops.find(tree, n => n.data.value === 'a1');

        expect(found.data.id).toBe(4);
    });

    it('should find all matching', () => {
        const found = ops.findAll(tree, n => n.data.value.startsWith('a'));

        expect(found).toHaveLength(3); // a, a1, a2
    });

    it('should flatten tree', () => {
        const flat = ops.flatten(tree);

        expect(flat).toHaveLength(6);
    });

    it('should calculate depth', () => {
        expect(ops.depth(tree)).toBe(2);
    });

    it('should count nodes', () => {
        expect(ops.count(tree)).toBe(6);
    });

    it('should find path to node', () => {
        const path = ops.pathTo(tree, n => n.data.id === 5);

        expect(path.map(n => n.data.id)).toEqual([1, 2, 5]);
    });
});

describe('Graph Tests', () => {
    let graph;

    beforeEach(() => {
        graph = createGraph(false);
        graph.addNode('A', { name: 'Node A' });
        graph.addNode('B', { name: 'Node B' });
        graph.addNode('C', { name: 'Node C' });
        graph.addNode('D', { name: 'Node D' });

        graph.addEdge('A', 'B', 1);
        graph.addEdge('A', 'C', 4);
        graph.addEdge('B', 'C', 2);
        graph.addEdge('B', 'D', 5);
        graph.addEdge('C', 'D', 1);
    });

    it('should add and get nodes', () => {
        expect(graph.hasNode('A')).toBe(true);
        expect(graph.getNode('A').name).toBe('Node A');
    });

    it('should add and check edges', () => {
        expect(graph.hasEdge('A', 'B')).toBe(true);
        expect(graph.hasEdge('A', 'D')).toBe(false);
    });

    it('should get neighbors', () => {
        expect(graph.getNeighbors('A')).toContain('B');
        expect(graph.getNeighbors('A')).toContain('C');
    });

    it('should perform BFS', () => {
        const visited = [];
        graph.bfs('A', (id) => visited.push(id));

        expect(visited[0]).toBe('A');
        expect(visited).toContain('B');
        expect(visited).toContain('C');
        expect(visited).toContain('D');
    });

    it('should perform DFS', () => {
        const visited = [];
        graph.dfs('A', (id) => visited.push(id));

        expect(visited[0]).toBe('A');
        expect(visited).toHaveLength(4);
    });

    it('should find shortest path', () => {
        const result = graph.shortestPath('A', 'D');

        expect(result.path).toEqual(['A', 'B', 'C', 'D']);
        expect(result.distance).toBe(4); // A->B(1) + B->C(2) + C->D(1)
    });

    it('should remove node', () => {
        graph.removeNode('B');

        expect(graph.hasNode('B')).toBe(false);
        expect(graph.hasEdge('A', 'B')).toBe(false);
    });
});
