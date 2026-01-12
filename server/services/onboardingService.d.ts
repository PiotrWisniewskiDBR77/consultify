export default OnboardingService;
declare namespace OnboardingService {
    function saveContext(organizationId: any, rawContext: any): Promise<{
        success: boolean;
        status: string;
    }>;
    function generatePlan(organizationId: any, userId: any): Promise<{
        plan: any;
        planVersion: any;
        planId: string;
    }>;
    function getPlanSnapshot(organizationId: any): Promise<{
        plan: null;
        status: any;
        planVersion?: undefined;
    } | {
        plan: any;
        planVersion: any;
        status: any;
    }>;
    function acceptPlan(organizationId: any, userId: any, { acceptedInitiativeIds, idempotencyKey }?: {
        acceptedInitiativeIds?: null | undefined;
        idempotencyKey?: null | undefined;
    }): Promise<any>;
    function detectAHAMoment(organizationId: string): Promise<Object>;
    function getStatus(organizationId: any): Promise<{
        status: any;
        planVersion: any;
        acceptedAt: any;
    }>;
}
//# sourceMappingURL=onboardingService.d.ts.map