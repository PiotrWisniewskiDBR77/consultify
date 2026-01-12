export namespace WORKSTREAM_STATUS {
    let ACTIVE: string;
    let ON_HOLD: string;
    let COMPLETED: string;
    let CANCELLED: string;
}
/**
 * Default colors for workstreams
 */
export const DEFAULT_COLORS: string[];
export default workstreamServiceInstance;
declare const workstreamServiceInstance: WorkstreamService;
declare class WorkstreamService {
    _db: any;
    WORKSTREAM_STATUS: {
        ACTIVE: string;
        ON_HOLD: string;
        COMPLETED: string;
        CANCELLED: string;
    };
    DEFAULT_COLORS: string[];
    get db(): any;
    /**
     * Initialize service dependencies
     */
    init(): Promise<this>;
    /**
     * Set dependencies manually (for testing)
     */
    setDependencies(customDeps: any): void;
    /**
     * Create a new workstream
     */
    createWorkstream(projectId: any, data: any): Promise<{
        id: any;
        projectId: any;
        name: any;
        description: any;
        ownerId: any;
        ownerName: string | null;
        status: any;
        color: any;
        sortOrder: any;
        initiativeCount: any;
        completedCount: any;
        progress: number;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Get a workstream by ID
     */
    getWorkstream(id: any): Promise<{
        id: any;
        projectId: any;
        name: any;
        description: any;
        ownerId: any;
        ownerName: string | null;
        status: any;
        color: any;
        sortOrder: any;
        initiativeCount: any;
        completedCount: any;
        progress: number;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Get all workstreams for a project
     */
    getProjectWorkstreams(projectId: any, options?: {}): Promise<any>;
    /**
     * Update a workstream
     */
    updateWorkstream(id: any, updates: any): Promise<{
        id: any;
        projectId: any;
        name: any;
        description: any;
        ownerId: any;
        ownerName: string | null;
        status: any;
        color: any;
        sortOrder: any;
        initiativeCount: any;
        completedCount: any;
        progress: number;
        createdAt: any;
        updatedAt: any;
    } | null>;
    /**
     * Delete a workstream
     */
    deleteWorkstream(id: any): Promise<boolean>;
    /**
     * Assign an initiative to a workstream
     */
    assignInitiative(workstreamId: any, initiativeId: any): Promise<any>;
    /**
     * Remove an initiative from a workstream
     */
    unassignInitiative(initiativeId: any): Promise<any>;
    /**
     * Get workstream progress details
     */
    getWorkstreamProgress(workstreamId: any): Promise<{
        workstreamId: any;
        name: any;
        status: any;
        progress: number;
        initiatives: {
            total: any;
            completed: any;
            inProgress: any;
            items: any;
        };
        tasks: {
            total: any;
            completed: any;
            inProgress: any;
            blocked: any;
        };
        team: any;
        generatedAt: string;
    }>;
    /**
     * Reorder workstreams
     */
    reorderWorkstreams(projectId: any, workstreamIds: any): Promise<boolean>;
    /**
     * Get unassigned initiatives
     */
    getUnassignedInitiatives(projectId: any): Promise<any>;
    _formatWorkstream(row: any, stats?: {}): {
        id: any;
        projectId: any;
        name: any;
        description: any;
        ownerId: any;
        ownerName: string | null;
        status: any;
        color: any;
        sortOrder: any;
        initiativeCount: any;
        completedCount: any;
        progress: number;
        createdAt: any;
        updatedAt: any;
    };
    _logAudit(projectId: any, action: any, metadata?: {}): Promise<void>;
}
//# sourceMappingURL=workstreamService.d.ts.map