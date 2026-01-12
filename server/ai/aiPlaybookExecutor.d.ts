export default AIPlaybookExecutor;
declare namespace AIPlaybookExecutor {
    namespace STEP_TYPES {
        let ACTION: string;
        let CHECK: string;
        let WAIT: string;
        let BRANCH: string;
        let AI_ROUTER: string;
    }
    function advanceRun(runId: string, userId: string): Promise<Object>;
    function _executeBranchStep(step: any, run: any, userId: any): Promise<{
        status: string;
        outputs: {
            routed_to: any;
        };
        selectedNextStepId: any;
        trace: any;
        reason: any;
    } | {
        status: string;
        reason: any;
        trace: {
            error: any;
        };
        outputs?: undefined;
        selectedNextStepId?: undefined;
    }>;
    function _executeCheckStep(step: any, run: any, userId: any): Promise<{
        status: string;
        outputs: {
            passed: boolean;
            reason: string;
        };
        selectedNextStepId: any;
        trace: {
            check_result: {
                passed: boolean;
                reason: string;
            };
            context_snapshot: any;
            error?: undefined;
        };
        reason: string;
    } | {
        status: string;
        reason: any;
        trace: {
            error: any;
            check_result?: undefined;
            context_snapshot?: undefined;
        };
        outputs?: undefined;
        selectedNextStepId?: undefined;
    }>;
    function _executeWaitStep(step: any, run: any, userId: any): Promise<{
        status: string;
        outputs: {
            waiting: boolean;
            proceeded?: undefined;
        };
        reason: string;
        trace: {
            wait_result: string;
            reason: string;
            error?: undefined;
        };
        selectedNextStepId?: undefined;
    } | {
        status: string;
        outputs: {
            waiting: boolean;
            proceeded: boolean;
        };
        selectedNextStepId: any;
        reason: string;
        trace: {
            wait_result: string;
            reason: string;
            error?: undefined;
        };
    } | {
        status: string;
        reason: any;
        trace: {
            error: any;
            wait_result?: undefined;
            reason?: undefined;
        };
        outputs?: undefined;
        selectedNextStepId?: undefined;
    }>;
    function _executeAIRouterStep(step: any, run: any, userId: any): Promise<{
        status: string;
        outputs: {
            routed_to: any;
        };
        selectedNextStepId: any;
        trace: any;
        reason: any;
    } | {
        status: string;
        reason: any;
        trace: {
            error: any;
        };
        outputs?: undefined;
        selectedNextStepId?: undefined;
    }>;
    function _executeActionStep(step: any, run: any, userId: any): Promise<{
        status: string;
        decisionId: string;
        executionId: any;
        outputs: {
            execution_result: string;
            decision?: undefined;
            policy_rule_id?: undefined;
        };
        reason: any;
        trace?: undefined;
    } | {
        status: string;
        decisionId: string;
        reason: string;
        outputs: {
            decision: string;
            policy_rule_id: any;
            execution_result?: undefined;
        };
        executionId?: undefined;
        trace?: undefined;
    } | {
        status: string;
        reason: any;
        trace: {
            error: any;
        };
        decisionId?: undefined;
        executionId?: undefined;
        outputs?: undefined;
    }>;
    function dryRunRoute(runId: string): Promise<Object>;
    function cancelRun(runId: any, userId: any): Promise<{
        success: boolean;
        error: string;
        runStatus?: undefined;
    } | {
        success: boolean;
        runStatus: string;
        error?: undefined;
    }>;
}
//# sourceMappingURL=aiPlaybookExecutor.d.ts.map