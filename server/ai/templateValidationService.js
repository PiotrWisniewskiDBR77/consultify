/**
 * Template Validation Service
 * Step 13: Visual Playbook Editor
 * 
 * Validates playbook template graphs against business rules.
 * Returns structured errors for UI display.
 * 
 * Validation Rules:
 * 1. Must have exactly 1 START node
 * 2. Graph must be acyclic (DAG)
 * 3. Every node (except END) must have at least one outgoing edge
 * 4. BRANCH nodes must have both 'if' and 'else' paths
 * 5. Step inputs_schema must be consistent
 * 6. trigger_signal must be non-empty
 */

const templateGraphService = require('./templateGraphService');

// Validation error codes
const ERROR_CODES = {
    NO_START_NODE: 'NO_START_NODE',
    MULTIPLE_START_NODES: 'MULTIPLE_START_NODES',
    NO_END_NODE: 'NO_END_NODE',
    CYCLIC_GRAPH: 'CYCLIC_GRAPH',
    DEAD_END_NODE: 'DEAD_END_NODE',
    BRANCH_MISSING_ELSE: 'BRANCH_MISSING_ELSE',
    EMPTY_TRIGGER_SIGNAL: 'EMPTY_TRIGGER_SIGNAL',
    INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
    INVALID_EDGE_REFERENCE: 'INVALID_EDGE_REFERENCE',
    DUPLICATE_NODE_ID: 'DUPLICATE_NODE_ID',
    MISSING_ACTION_TYPE: 'MISSING_ACTION_TYPE',
    INVALID_PAYLOAD_TEMPLATE: 'INVALID_PAYLOAD_TEMPLATE',
    UNREACHABLE_NODE: 'UNREACHABLE_NODE'
};

/**
 * Validate a complete template (graph + metadata)
 * @param {Object} template - Template with templateGraph or template_graph
 * @returns {Object} { ok: boolean, errors: [{code, message, nodeId}] }
 */
function validate(template) {
    const errors = [];

    // Get graph from template
    const graph = template.templateGraph || template.template_graph;

    if (!graph) {
        errors.push({
            code: 'MISSING_GRAPH',
            message: 'Template is missing graph data',
            nodeId: null
        });
        return { ok: false, errors };
    }

    // Parse graph if it's a string
    let parsedGraph = graph;
    if (typeof graph === 'string') {
        try {
            parsedGraph = JSON.parse(graph);
        } catch (e) {
            errors.push({
                code: 'INVALID_GRAPH_JSON',
                message: 'Template graph is not valid JSON',
                nodeId: null
            });
            return { ok: false, errors };
        }
    }

    // Validate graph structure
    const graphErrors = validateGraph(parsedGraph);
    errors.push(...graphErrors);

    // Validate trigger_signal
    const triggerSignal = parsedGraph.meta?.trigger_signal ||
        template.triggerSignal ||
        template.trigger_signal;
    if (!triggerSignal || triggerSignal.trim() === '') {
        errors.push({
            code: ERROR_CODES.EMPTY_TRIGGER_SIGNAL,
            message: 'Trigger signal is required',
            nodeId: null
        });
    }

    return {
        ok: errors.length === 0,
        errors
    };
}

/**
 * Validate graph structure
 * @param {Object} graph - Graph { nodes, edges, meta }
 * @returns {Array} Array of error objects
 */
function validateGraph(graph) {
    const errors = [];

    if (!graph.nodes || !Array.isArray(graph.nodes)) {
        errors.push({
            code: 'INVALID_NODES',
            message: 'Graph must have a nodes array',
            nodeId: null
        });
        return errors;
    }

    if (!graph.edges || !Array.isArray(graph.edges)) {
        errors.push({
            code: 'INVALID_EDGES',
            message: 'Graph must have an edges array',
            nodeId: null
        });
        return errors;
    }

    const { nodes, edges } = graph;

    // Check for duplicate node IDs
    const nodeIds = new Set();
    nodes.forEach(node => {
        if (nodeIds.has(node.id)) {
            errors.push({
                code: ERROR_CODES.DUPLICATE_NODE_ID,
                message: `Duplicate node ID: ${node.id}`,
                nodeId: node.id
            });
        }
        nodeIds.add(node.id);
    });

    // Rule 1: Must have exactly 1 START node
    const startNodes = nodes.filter(n => n.type === templateGraphService.NODE_TYPES.START);
    if (startNodes.length === 0) {
        errors.push({
            code: ERROR_CODES.NO_START_NODE,
            message: 'Graph must have exactly one START node',
            nodeId: null
        });
    } else if (startNodes.length > 1) {
        startNodes.slice(1).forEach(node => {
            errors.push({
                code: ERROR_CODES.MULTIPLE_START_NODES,
                message: 'Graph must have only one START node',
                nodeId: node.id
            });
        });
    }

    // Must have at least 1 END node
    const endNodes = nodes.filter(n => n.type === templateGraphService.NODE_TYPES.END);
    if (endNodes.length === 0) {
        errors.push({
            code: ERROR_CODES.NO_END_NODE,
            message: 'Graph must have at least one END node',
            nodeId: null
        });
    }

    // Rule 2: Graph must be acyclic
    const dagResult = templateGraphService.validateDAG(graph);
    if (!dagResult.isValid) {
        dagResult.cycles.forEach(cycle => {
            errors.push({
                code: ERROR_CODES.CYCLIC_GRAPH,
                message: `Cycle detected: ${cycle.join(' → ')}`,
                nodeId: cycle[0]
            });
        });
    }

    // Rule 3: Every node (except END) must have outgoing edge
    const deadEnds = templateGraphService.findDeadEnds(graph);
    deadEnds.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        errors.push({
            code: ERROR_CODES.DEAD_END_NODE,
            message: `Node "${node?.title || nodeId}" has no outgoing connection`,
            nodeId: nodeId
        });
    });

    // Rule 4: BRANCH nodes must have else path
    const branchesWithoutElse = templateGraphService.findBranchesWithoutElse(graph);
    branchesWithoutElse.forEach(nodeId => {
        const node = nodes.find(n => n.id === nodeId);
        errors.push({
            code: ERROR_CODES.BRANCH_MISSING_ELSE,
            message: `Branch node "${node?.title || nodeId}" must have an 'else' path`,
            nodeId: nodeId
        });
    });

    // Validate edge references
    edges.forEach(edge => {
        if (!nodeIds.has(edge.from)) {
            errors.push({
                code: ERROR_CODES.INVALID_EDGE_REFERENCE,
                message: `Edge references non-existent source node: ${edge.from}`,
                nodeId: edge.from
            });
        }
        if (!nodeIds.has(edge.to)) {
            errors.push({
                code: ERROR_CODES.INVALID_EDGE_REFERENCE,
                message: `Edge references non-existent target node: ${edge.to}`,
                nodeId: edge.to
            });
        }
    });

    // Validate ACTION nodes have actionType
    nodes.forEach(node => {
        if (node.type === templateGraphService.NODE_TYPES.ACTION) {
            if (!node.data?.actionType) {
                errors.push({
                    code: ERROR_CODES.MISSING_ACTION_TYPE,
                    message: `Action node "${node.title || node.id}" must have an action type`,
                    nodeId: node.id
                });
            }
        }
    });

    // Check for unreachable nodes
    const reachableNodes = findReachableNodes(graph);
    nodes.forEach(node => {
        if (!reachableNodes.has(node.id)) {
            errors.push({
                code: ERROR_CODES.UNREACHABLE_NODE,
                message: `Node "${node.title || node.id}" is unreachable from START`,
                nodeId: node.id
            });
        }
    });

    return errors;
}

/**
 * Find all nodes reachable from START
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Set} Set of reachable node IDs
 */
function findReachableNodes(graph) {
    const { nodes, edges } = graph;
    const reachable = new Set();

    // Build adjacency list
    const adjacency = new Map();
    nodes.forEach(node => adjacency.set(node.id, []));
    edges.forEach(edge => {
        if (adjacency.has(edge.from)) {
            adjacency.get(edge.from).push(edge.to);
        }
    });

    // Find START node
    const startNode = nodes.find(n => n.type === templateGraphService.NODE_TYPES.START);
    if (!startNode) {
        return reachable;
    }

    // BFS from START
    const queue = [startNode.id];
    while (queue.length > 0) {
        const currentId = queue.shift();
        if (reachable.has(currentId)) continue;

        reachable.add(currentId);

        const neighbors = adjacency.get(currentId) || [];
        neighbors.forEach(neighbor => {
            if (!reachable.has(neighbor)) {
                queue.push(neighbor);
            }
        });
    }

    return reachable;
}

/**
 * Quick validation check (for save operations)
 * Returns true if template can be saved as draft
 * @param {Object} template - Template to validate
 * @returns {Object} { canSave: boolean, warnings: Array }
 */
function quickValidate(template) {
    const warnings = [];

    const graph = template.templateGraph || template.template_graph;
    if (!graph) {
        return { canSave: true, warnings: [{ message: 'No graph data yet' }] };
    }

    let parsedGraph = graph;
    if (typeof graph === 'string') {
        try {
            parsedGraph = JSON.parse(graph);
        } catch (e) {
            return { canSave: false, warnings: [{ message: 'Invalid JSON in graph' }] };
        }
    }

    // Check basic structure
    if (!parsedGraph.nodes || parsedGraph.nodes.length === 0) {
        warnings.push({ message: 'Graph has no nodes' });
    }

    if (!parsedGraph.edges) {
        warnings.push({ message: 'Graph has no edges' });
    }

    return { canSave: true, warnings };
}

module.exports = {
    ERROR_CODES,
    validate,
    validateGraph,
    quickValidate
};
