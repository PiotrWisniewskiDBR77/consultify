declare namespace _default {
    export { ERROR_CODES };
    export { validate };
    export { validateGraph };
    export { quickValidate };
}
export default _default;
declare namespace ERROR_CODES {
    let NO_START_NODE: string;
    let MULTIPLE_START_NODES: string;
    let NO_END_NODE: string;
    let CYCLIC_GRAPH: string;
    let DEAD_END_NODE: string;
    let BRANCH_MISSING_ELSE: string;
    let EMPTY_TRIGGER_SIGNAL: string;
    let INVALID_NODE_TYPE: string;
    let INVALID_EDGE_REFERENCE: string;
    let DUPLICATE_NODE_ID: string;
    let MISSING_ACTION_TYPE: string;
    let INVALID_PAYLOAD_TEMPLATE: string;
    let UNREACHABLE_NODE: string;
}
/**
 * Validate a complete template (graph + metadata)
 * @param {Object} template - Template with templateGraph or template_graph
 * @returns {Object} { ok: boolean, errors: [{code, message, nodeId}] }
 */
declare function validate(template: Object): Object;
/**
 * Validate graph structure
 * @param {Object} graph - Graph { nodes, edges, meta }
 * @returns {Array} Array of error objects
 */
declare function validateGraph(graph: Object): any[];
/**
 * Quick validation check (for save operations)
 * Returns true if template can be saved as draft
 * @param {Object} template - Template to validate
 * @returns {Object} { canSave: boolean, warnings: Array }
 */
declare function quickValidate(template: Object): Object;
//# sourceMappingURL=templateValidationService.d.ts.map