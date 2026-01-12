declare namespace _default {
    export { NODE_TYPES };
    export { EDGE_LABELS };
    export { stepsToGraph };
    export { graphToSteps };
    export { validateDAG };
    export { getAllPaths };
    export { findDeadEnds };
    export { findBranchesWithoutElse };
    export { createEmptyGraph };
}
export default _default;
declare namespace NODE_TYPES {
    let START: string;
    let ACTION: string;
    let BRANCH: string;
    let CHECK: string;
    let END: string;
}
declare namespace EDGE_LABELS {
    let DEFAULT: string;
    let IF: string;
    let ELSE: string;
}
/**
 * Convert linear template steps array to graph representation
 * @param {Array} steps - Array of template step objects
 * @param {string} triggerSignal - The trigger signal for this template
 * @returns {Object} Graph { nodes, edges, meta }
 */
declare function stepsToGraph(steps: any[], triggerSignal?: string): Object;
/**
 * Convert graph representation to linear template steps array
 * @param {Object} graph - Graph { nodes, edges, meta }
 * @returns {Array} Array of template step objects in order
 */
declare function graphToSteps(graph: Object): any[];
/**
 * Validate that graph is a valid DAG (Directed Acyclic Graph)
 * Uses DFS cycle detection
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Object} { isValid: boolean, cycles: Array<string[]> }
 */
declare function validateDAG(graph: Object): Object;
/**
 * Get all paths from START to END nodes
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Array} Array of paths (each path is array of node IDs)
 */
declare function getAllPaths(graph: Object): any[];
/**
 * Find nodes without outgoing edges (except END nodes)
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Array} Array of node IDs that are dead ends
 */
declare function findDeadEnds(graph: Object): any[];
/**
 * Find BRANCH nodes without else paths
 * @param {Object} graph - Graph { nodes, edges }
 * @returns {Array} Array of BRANCH node IDs missing else paths
 */
declare function findBranchesWithoutElse(graph: Object): any[];
/**
 * Create an empty template graph with just START and END
 * @param {string} triggerSignal - Optional trigger signal
 * @returns {Object} Empty graph
 */
declare function createEmptyGraph(triggerSignal?: string): Object;
//# sourceMappingURL=templateGraphService.d.ts.map