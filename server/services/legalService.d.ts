export namespace LegalService {
    function setDependencies(newDeps: any): void;
    function getActiveDocuments(userContext?: null): Promise<any>;
    function getActiveDocument(docType: any): Promise<any>;
    function getUserAcceptances(userId: any, orgId?: null): Promise<any>;
    function getOrgDPAAcceptance(orgId: any): Promise<any>;
    function isDocumentApplicable(doc: any, userContext: any): any;
    function isAcceptanceValid(acceptance: any, document: any): boolean;
    function checkPendingAcceptances(userId: any, orgId: any, userRole: any, userContext?: null): Promise<{
        required: any;
        dpaPending: boolean;
        dpaDoc: any;
        isOrgAdmin: boolean;
        hasAnyPending: boolean;
    }>;
    function acceptDocuments({ userId, orgId, docTypes, scope, ip, userAgent, userRole }: {
        userId: any;
        orgId: any;
        docTypes: any;
        scope?: string | undefined;
        ip: any;
        userAgent: any;
        userRole: any;
    }): Promise<{
        created: {
            id: any;
            docType: any;
            version: any;
            scope: string;
        }[];
        errors: {
            docType: any;
            error: any;
        }[];
    }>;
    function publishDocument({ docType, version, title, contentMd, effectiveFrom, createdBy, expiresAt, reacceptRequiredFrom, scopeType, scopeValue, changeSummary, previousVersionId }: {
        docType: any;
        version: any;
        title: any;
        contentMd: any;
        effectiveFrom: any;
        createdBy: any;
        expiresAt: any;
        reacceptRequiredFrom: any;
        scopeType: any;
        scopeValue: any;
        changeSummary: any;
        previousVersionId: any;
    }): Promise<any>;
    function getAllDocuments(): Promise<any>;
    function getOrgAcceptanceStatus(orgId: any): Promise<any>;
    function toggleDocumentActive(docId: any, isActive: any): Promise<any>;
    function checkAcceptanceRequired(userId: any, docType: any, orgId?: null): Promise<{
        required: boolean;
        reason: string;
        docType?: undefined;
        version?: undefined;
        currentVersion?: undefined;
    } | {
        required: boolean;
        docType: any;
        version: any;
        currentVersion: any;
        reason?: undefined;
    }>;
}
export default LegalService;
//# sourceMappingURL=legalService.d.ts.map