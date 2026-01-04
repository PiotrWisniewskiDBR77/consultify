declare const _default: AssessmentAuditLogger;
export default _default;
declare class AssessmentAuditLogger {
    db: typeof defaultDb;
    uuidv4: typeof defaultUuidv4;
    /**
     * Inject dependencies for testing
     * @param {Object} deps
     */
    setDependencies(deps: Object): void;
    /**
     * Log assessment action
     * @param {Object} params - Audit parameters
     */
    log({ userId, organizationId, action, resourceType, resourceId, details, ipAddress, userAgent }: Object): Promise<string | undefined>;
    /**
     * Log assessment creation
     */
    logCreation(req: any, assessmentId: any, assessmentType: any): Promise<string | undefined>;
    /**
     * Log file upload
     */
    logFileUpload(req: any, fileId: any, fileName: any, fileSize: any): Promise<string | undefined>;
    /**
     * Log assessment deletion
     */
    logDeletion(req: any, assessmentId: any, assessmentType: any): Promise<string | undefined>;
}
import defaultDb = require("../database.js");
import { v4 as defaultUuidv4 } from "uuid";
//# sourceMappingURL=assessmentAuditLogger.d.ts.map