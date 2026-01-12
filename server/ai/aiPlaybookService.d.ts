export default AIPlaybookService;
declare namespace AIPlaybookService {
    function setDependencies(newDeps?: {}): void;
    namespace RUN_STATUSES {
        let PENDING: string;
        let IN_PROGRESS: string;
        let COMPLETED: string;
        let FAILED: string;
        let CANCELLED: string;
    }
    namespace STEP_STATUSES {
        let PENDING_1: string;
        export { PENDING_1 as PENDING };
        export let APPROVED: string;
        export let REJECTED: string;
        export let EXECUTED: string;
        let FAILED_1: string;
        export { FAILED_1 as FAILED };
        export let SKIPPED: string;
    }
    namespace TEMPLATE_STATUSES {
        let DRAFT: string;
        let PUBLISHED: string;
        let DEPRECATED: string;
    }
    function createTemplate({ key, title, description, triggerSignal, estimatedDurationMins }: {
        key: any;
        title: any;
        description: any;
        triggerSignal: any;
        estimatedDurationMins?: number | undefined;
    }): Promise<any>;
    function getTemplateByKey(key: any): Promise<any>;
    function listTemplates(includeInactive?: boolean): Promise<any>;
    function addTemplateStep({ templateId, stepOrder, actionType, title, description, payloadTemplate, isOptional, waitForPrevious }: {
        templateId: any;
        stepOrder: any;
        actionType: any;
        title: any;
        description: any;
        payloadTemplate: any;
        isOptional?: boolean | undefined;
        waitForPrevious?: boolean | undefined;
    }): Promise<any>;
    function createDraftTemplate({ key, title, description, triggerSignal, templateGraph, estimatedDurationMins }: {
        key: any;
        title: any;
        description: any;
        triggerSignal: any;
        templateGraph: any;
        estimatedDurationMins?: number | undefined;
    }): Promise<any>;
    function updateDraftTemplate(id: any, updates: any): Promise<any>;
    function publishTemplate(id: any, userId: any): Promise<any>;
    function deprecateTemplate(id: any): Promise<any>;
    function getTemplatesByStatus(status: any): Promise<any>;
    function getTemplateById(id: any): Promise<any>;
    function exportTemplate(id: any): Promise<{
        exportVersion: string;
        exportedAt: string;
        template: {
            key: any;
            title: any;
            description: any;
            triggerSignal: any;
            estimatedDurationMins: any;
            templateGraph: any;
            steps: any;
        };
    }>;
    function importTemplate(exportData: any, userId: any): Promise<any>;
    function initiateRun({ templateId, organizationId, initiatedBy, contextSnapshot }: {
        templateId: any;
        organizationId: any;
        initiatedBy: any;
        contextSnapshot?: {} | undefined;
    }): Promise<{
        runId: string;
        correlationId: string;
        templateId: any;
        templateKey: any;
        organizationId: any;
        status: string;
        stepCount: any;
    }>;
    function getRun(runId: any): Promise<any>;
    function updateRunStatus(runId: any, status: any, extraFields?: {}): Promise<any>;
    function updateStepStatus(stepId: any, status: any, { decisionId, executionId }?: {
        decisionId?: null | undefined;
        executionId?: null | undefined;
    }): Promise<any>;
    function resolvePayloadTemplate(template: any, context: any): {};
    function _getNestedValue(obj: any, path: any): any;
    function updateRunStepWithRouting(stepId: string, { outputs, evaluationTrace, selectedNextStepId, statusReason }: Object): Promise<boolean>;
    function getRunStepByTemplateStepId(runId: string, templateStepId: string): Promise<Object | null>;
    function getNextStepInRun(runId: string, currentTemplateStepId: string): Promise<Object | null>;
    function createTemplateVersion({ templateId, version, title, description, triggerSignal, templateGraph, estimatedDurationMins, changedBy, changeNotes, changeType, statusAtVersion }: {
        templateId: any;
        version: any;
        title: any;
        description: any;
        triggerSignal: any;
        templateGraph: any;
        estimatedDurationMins: any;
        changedBy?: null | undefined;
        changeNotes?: string | undefined;
        changeType?: string | undefined;
        statusAtVersion?: string | undefined;
    }): Promise<any>;
    function getTemplateVersionHistory(templateId: any): Promise<any>;
    function getTemplateVersion(templateId: any, version: any): Promise<any>;
    function restoreTemplateVersion(templateId: any, version: any, userId?: null): Promise<any>;
    function cloneTemplate(templateId: any, overrides?: {}, userId?: null): Promise<any>;
    function logAnalyticsEvent({ contentId, eventType, userId, organizationId, metadata, sessionId, durationMs }: {
        contentId: any;
        eventType: any;
        userId?: null | undefined;
        organizationId?: null | undefined;
        metadata?: {} | undefined;
        sessionId?: null | undefined;
        durationMs?: null | undefined;
    }): Promise<any>;
    function getTemplateStats(templateId: any): Promise<any>;
    function getTemplateAnalytics(templateId: any, { limit, eventType, dateFrom, dateTo }?: {
        limit?: number | undefined;
        eventType?: null | undefined;
        dateFrom?: null | undefined;
        dateTo?: null | undefined;
    }): Promise<any>;
    function searchTemplates({ query, status, categoryId, triggerSignal, organizationId, sortBy, sortOrder, limit, offset }?: {
        query?: null | undefined;
        status?: null | undefined;
        categoryId?: null | undefined;
        triggerSignal?: null | undefined;
        organizationId?: null | undefined;
        sortBy?: string | undefined;
        sortOrder?: string | undefined;
        limit?: number | undefined;
        offset?: number | undefined;
    }): Promise<any>;
    function bulkUpdateTemplates(templateIds: any, updates: any, userId?: null): Promise<{
        success: never[];
        failed: never[];
    }>;
    function getTemplateTags(templateId: any): Promise<any>;
    function addTemplateTag(templateId: any, tagId: any, userId?: null): Promise<any>;
    function removeTemplateTag(templateId: any, tagId: any): Promise<any>;
    function incrementUsageCount(templateId: any): Promise<any>;
}
//# sourceMappingURL=aiPlaybookService.d.ts.map