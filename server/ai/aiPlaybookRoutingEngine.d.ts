export default AIPlaybookRoutingEngine;
declare namespace AIPlaybookRoutingEngine {
    namespace CONDITION_TYPES {
        let METRIC_LTE: string;
        let METRIC_GTE: string;
        let FLAG_EQ: string;
        let HAS_OPEN_TASKS: string;
        let SIGNAL_PRESENT: string;
        let TIME_SINCE_STEP_GTE: string;
    }
    function evaluateRouting({ runId, currentStep, context }: {
        runId: string;
        currentStep: Object;
        context: Object;
    }): {
        nextStepId: string | null;
        trace: Object;
        reason: string;
    };
    function evaluateCondition(condition: Object, context: Object): {
        matched: boolean;
        reason: string;
        contextUsed?: Object;
    };
    function buildContext(runId: string, organizationId: string): Promise<Object>;
    function getTemplateStep(stepId: string): Promise<Object | null>;
}
//# sourceMappingURL=aiPlaybookRoutingEngine.d.ts.map