export default DocumentService;
declare class DocumentService {
    /**
     * Upload a document
     */
    static uploadDocument(file: any, { organizationId, projectId, ownerId, scope, description, tags }: {
        organizationId: any;
        projectId?: null | undefined;
        ownerId: any;
        scope?: string | undefined;
        description?: null | undefined;
        tags?: never[] | undefined;
    }): Promise<any>;
    /**
     * Get project documents (visible to all project members)
     */
    static getProjectDocuments(projectId: any): Promise<any>;
    /**
     * Get user's private documents
     */
    static getUserDocuments(ownerId: any, organizationId: any): Promise<any>;
    /**
     * Get all documents accessible to a user (their private + project documents)
     */
    static getAccessibleDocuments(userId: any, organizationId: any, projectId?: null): Promise<any>;
    /**
     * Move a private document to project scope
     */
    static moveToProject(documentId: any, projectId: any, userId: any): Promise<any>;
    /**
     * Get document by ID
     */
    static getDocumentById(documentId: any): Promise<any>;
    /**
     * Delete (soft) a document
     */
    static deleteDocument(documentId: any, userId: any): Promise<any>;
    /**
     * Map database row to API response format
     */
    static mapRow(row: any): {
        id: any;
        organizationId: any;
        projectId: any;
        ownerId: any;
        scope: any;
        filename: any;
        originalName: any;
        fileType: any;
        fileSize: any;
        mimeType: any;
        filepath: any;
        description: any;
        tags: any;
        status: any;
        createdAt: any;
        updatedAt: any;
    } | null;
}
//# sourceMappingURL=documentService.d.ts.map