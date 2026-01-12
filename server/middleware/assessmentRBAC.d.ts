declare namespace _default {
    export { assessmentRBAC };
    export { hasPermission };
    export { multiFrameworkRBAC };
    export { requireFrameworkApprover };
    export { requireFrameworkCertifier };
    export { validateWorkflowTransition };
}
export default _default;
declare function assessmentRBAC(action: any): (req: any, res: any, next: any) => any;
declare function hasPermission(user: any, action: any, resource: any): any;
/**
 * Multi-framework RBAC middleware
 * Checks both general permissions and framework-specific permissions
 */
declare function multiFrameworkRBAC(action: any): (req: any, res: any, next: any) => Promise<any>;
/**
 * Check if user can approve specific framework
 */
declare function requireFrameworkApprover(framework: any): (req: any, res: any, next: any) => Promise<any>;
/**
 * Check if user can certify (for official certifications like CMMI)
 */
declare function requireFrameworkCertifier(framework: any): (req: any, res: any, next: any) => Promise<any>;
/**
 * Validate workflow transition
 */
declare function validateWorkflowTransition(req: any, res: any, next: any): Promise<any>;
//# sourceMappingURL=assessmentRBAC.d.ts.map