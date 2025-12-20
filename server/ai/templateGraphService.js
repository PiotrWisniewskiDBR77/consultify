/**
 * Template Graph Service
 * Step 13: Visual Playbook Editor
 * 
 * Handles conversion between graph representation and linear step arrays,
 * plus graph validation (DAG check, path analysis).
 * 
 * Graph format:
 * {
 *   nodes: [{ id, type, title, data, position: {x, y} }],
 *   edges: [{ id, from, to, label }],
 *   meta: { trigger_signal }
 * }
 */

const { v4: uuidv4 } = require('uuid');

// Node types
const NODE_TYPES = {
    START: 'START',
    ACTION: 'ACTION',
    BRANCH: 'BRANCH',
    CHECK: 'CHECK',
    END: 'END'
};

// Edge labels
const EDGE_LABELS = {
    DEFAULT: 'default',
    IF: 'if',
    ELSE: 'else'
};

/**
 * Convert linear template steps array to graph representation
 * @param {Array} steps - Array of template step objects
 * @param {string} triggerSignal - The trigger signal for this template
 * @returns {Object} Graph { nodes, edges, meta }
 */
function stepsToGraph(steps, triggerSignal = '') {
    const nodes = [];
    const edges = [];

    // Create START node
    const startNodeId = `node-start-${uuidv4().slice(0, 8)}`;
    nodes.push({
        id: startNodeId,
        type: NODE_TYPES.START,
        title: 'Start',
        data: {},
        position: { x: 50, y: 50 }
    });

    // Create END node
    const endNodeId = `node-end-${uuidv4().slice(0, 8)}`;

    // Sort steps by step_order
    const sortedSteps = [...steps].sort((a, b) =>
        (a.step_order || a.stepOrder || 0) - (b.step_order || b.stepOrder || 0)
    );

    let prevNodeId = startNodeId;
    const ySpacing = 120;

    sortedSteps.forEach((step, index) => {
        const nodeId = step.id || `node-action-${uuidv4().slice(0, 8)}`;

        // Determine node type from action_type or step properties
        let nodeType = NODE_TYPES.ACTION;
        if (step.action_type === 'BRANCH' || step.actionType === 'BRANCH') {
            nodeType = NODE_TYPES.BRANCH;
        } else if (step.action_type === 'CHECK' || step.actionType === 'CHECK') {
            nodeType = NODE_TYPES.CHECK;
        }

        nodes.push({
            id: nodeId,
            type: nodeType,
            title: step.title || `Step ${index + 1}`,
            data: {
                actionType: step.action_type || step.actionType,
                description: step.description,
                payloadTemplate: typeof step.payload_template === 'string'
                    ? JSON.parse(step.payload_template || '{}')
                    : (step.payload_template || step.payloadTemplate || {}),
                isOptional: step.is_optional || step.isOptional || false,
                waitForPrevious: step.wait_for_previous !== undefined
                    ? step.wait_for_previous
                    : (step.waitForPrevious !== undefined ? step.waitForPrevious : true)
            },
            position: { x: 200, y: 50 + (index + 1) * ySpacing }
        });

        // Create edge from previous node
        edges.push({
            id: `edge-${prevNodeId}-${nodeId}`,
            from: prevNodeId,
            to: nodeId,
            label: EDGE_LABELS.DEFAULT
        });

        prevNodeId = nodeId;
    });

    // Add END node
    nodes.push({
        id: endNodeId,
        type: NODE_TYPES.END,
        title: 'End',
        data: {},
        position: { x: 200, y: 50 + (sortedSteps.length + 1) * ySpacing }
    });

    // Connect last step to END
    if (prevNodeId !== startNodeId) {
        edges.push({
            id: `edge-${prevNodeId}-${endNodeId}`,
            from: prevNodeId,
            to: endNodeId,
            label: EDGE_LABELS.DEFAULT
        });
    } else {
        // Empty template: START -> END
        edges.push({
            id: `edge-${startNodeId}-${endNodeId}`,
            from: startNodeId,
            to: endNodeId,
            label: EDGE_LABELS.DEFAULT
        });
    }

    return {
        nodes,
        edges,
        meta: {
            trigger_signal: triggerSignal
        }
    };
}

/**
 * Convert graph representation to linear template steps array
 * @param {Object} graph - Graph { nodes, edges, meta }
 * @returns {Array} Array of template step objects in order
 */
function graphToSteps(graph) {
    if (!graph || !graph.nodes || !graph.edges) {
        return [];
    }

    const { nodes, edges } = graph;

    // Build adjacency list
    const adjacency = new Map();
    edges.forEach(edge => {
        if (!adjacency.has(edge.from)) {
            adjacency.set(edge.from, []);
        }
        adjacency.get(edge.from).push({ to: edge.to, label: edge.label });
    });

    // Find START node
    const startNode = nodes.find(n => n.type === NODE_TYPES.START);
    if (!startNode) {
        return [];
    }

    // Traverse graph in order (BFS for linear paths, DFS for branches)
    const visited = new Set();
    const orderedSteps = [];
    const queue = [startNode.id];
    let stepOrder = 1;

    while (queue.length > 0) {
        const currentId = queue.shift();

        if (visited.has(currentId)) {
            continue;
        }
        visited.add(currentId);

        const currentNode = nodes.find(n => n.id === currentId);
        if (!currentNode) continue;

        // Skip START and END nodes from step output
        if (currentNode.type !== NODE_TYPES.START && currentNode.type !== NODE_TYPES.END) {
            orderedSteps.push({
                id: currentNode.id,
                stepOrder: stepOrder++,
                actionType: currentNode.data?.actionType || currentNode.type,
                title: currentNode.title,
                description: currentNode.data?.description || '',
                payloadTemplate: currentNode.data?.payloadTemplate || {},
                isOptional: currentNode.data?.isOptional || false,
                waitForPrevious: currentNode.data?.waitForPrevious !== false
            });
        }

        // Add all outgoing edges to queue
        const outgoing = adjacency.get(currentId) || [];
        outgoing.forEach(({ to }) => {
            if (!visited.has(to)) {
                queue.push(to);
            }
        });
    }

    return orderedSteps;
}

/**
 * Validate that graph is a valid DAG (Directed Acyclic Graph)
 * Uses DFS cycle detection
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Object} { isValid: boolean, cycles: Array<string[]> }
 */
function validateDAG(graph) {
    if (!graph || !graph.nodes || !graph.edges) {
        return { isValid: false, cycles: [], error: 'Invalid graph structure' };
    }

    const { nodes, edges } = graph;

    // Build adjacency list
    const adjacency = new Map();
    nodes.forEach(node => adjacency.set(node.id, []));
    edges.forEach(edge => {
        if (adjacency.has(edge.from)) {
            adjacency.get(edge.from).push(edge.to);
        }
    });

    const WHITE = 0; // Not visited
    const GRAY = 1;  // Currently visiting (in stack)
    const BLACK = 2; // Completely visited

    const color = new Map();
    nodes.forEach(node => color.set(node.id, WHITE));

    const cycles = [];
    const path = [];

    function dfs(nodeId) {
        color.set(nodeId, GRAY);
        path.push(nodeId);

        const neighbors = adjacency.get(nodeId) || [];
        for (const neighbor of neighbors) {
            if (color.get(neighbor) === GRAY) {
                // Found a cycle
                const cycleStart = path.indexOf(neighbor);
                const cycle = path.slice(cycleStart);
                cycle.push(neighbor); // Complete the cycle
                cycles.push(cycle);
                return false;
            }
            if (color.get(neighbor) === WHITE) {
                if (!dfs(neighbor)) {
                    return false;
                }
            }
        }

        path.pop();
        color.set(nodeId, BLACK);
        return true;
    }

    // Run DFS from each unvisited node
    for (const node of nodes) {
        if (color.get(node.id) === WHITE) {
            dfs(node.id);
        }
    }

    return {
        isValid: cycles.length === 0,
        cycles
    };
}

/**
 * Get all paths from START to END nodes
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Array} Array of paths (each path is array of node IDs)
 */
function getAllPaths(graph) {
    if (!graph || !graph.nodes || !graph.edges) {
        return [];
    }

    const { nodes, edges } = graph;

    // Build adjacency list
    const adjacency = new Map();
    nodes.forEach(node => adjacency.set(node.id, []));
    edges.forEach(edge => {
        if (adjacency.has(edge.from)) {
            adjacency.get(edge.from).push(edge.to);
        }
    });

    // Find START and END nodes
    const startNode = nodes.find(n => n.type === NODE_TYPES.START);
    const endNodes = nodes.filter(n => n.type === NODE_TYPES.END).map(n => n.id);

    if (!startNode || endNodes.length === 0) {
        return [];
    }

    const allPaths = [];
    const maxDepth = nodes.length * 2; // Prevent infinite loops

    function dfs(currentId, path, depth) {
        if (depth > maxDepth) return;

        path.push(currentId);

        if (endNodes.includes(currentId)) {
            allPaths.push([...path]);
        } else {
            const neighbors = adjacency.get(currentId) || [];
            for (const neighbor of neighbors) {
                if (!path.includes(neighbor)) { // Avoid revisiting in same path
                    dfs(neighbor, path, depth + 1);
                }
            }
        }

        path.pop();
    }

    dfs(startNode.id, [], 0);

    return allPaths;
}

/**
 * Find nodes without outgoing edges (except END nodes)
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Array} Array of node IDs that are dead ends
 */
function findDeadEnds(graph) {
    if (!graph || !graph.nodes || !graph.edges) {
        return [];
    }

    const { nodes, edges } = graph;

    // Get all source nodes from edges
    const nodesWithOutgoing = new Set(edges.map(e => e.from));

    // Find nodes without outgoing edges
    const deadEnds = nodes.filter(node =>
        node.type !== NODE_TYPES.END &&
        !nodesWithOutgoing.has(node.id)
    );

    return deadEnds.map(n => n.id);
}

/**
 * Find BRANCH nodes without else paths
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Array} Array of BRANCH node IDs missing else paths
 */
function findBranchesWithoutElse(graph) {
    if (!graph || !graph.nodes || !graph.edges) {
        return [];
    }

    const { nodes, edges } = graph;

    // Get all BRANCH nodes
    const branchNodes = nodes.filter(n => n.type === NODE_TYPES.BRANCH);

    const missingElse = [];

    branchNodes.forEach(branch => {
        const outgoingEdges = edges.filter(e => e.from === branch.id);
        const hasElse = outgoingEdges.some(e =>
            e.label === EDGE_LABELS.ELSE ||
            e.label?.toLowerCase().includes('else')
        );

        if (!hasElse) {
            missingElse.push(branch.id);
        }
    });

    return missingElse;
}

/**
 * Create an empty template graph with just START and END
 * @param {string} triggerSignal - Optional trigger signal
 * @returns {Object} Empty graph
 */
function createEmptyGraph(triggerSignal = '') {
    const startId = `node-start-${uuidv4().slice(0, 8)}`;
    const endId = `node-end-${uuidv4().slice(0, 8)}`;

    return {
        nodes: [
            {
                id: startId,
                type: NODE_TYPES.START,
                title: 'Start',
                data: {},
                position: { x: 200, y: 50 }
            },
            {
                id: endId,
                type: NODE_TYPES.END,
                title: 'End',
                data: {},
                position: { x: 200, y: 200 }
            }
        ],
        edges: [
            {
                id: `edge-${startId}-${endId}`,
                from: startId,
                to: endId,
                label: EDGE_LABELS.DEFAULT
            }
        ],
        meta: {
            trigger_signal: triggerSignal
        }
    };
}

module.exports = {
    NODE_TYPES,
    EDGE_LABELS,
    stepsToGraph,
    graphToSteps,
    validateDAG,
    getAllPaths,
    findDeadEnds,
    findBranchesWithoutElse,
    createEmptyGraph
};
