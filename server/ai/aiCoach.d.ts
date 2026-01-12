export default AICoach;
declare namespace AICoach {
    namespace deps {
        export { AIContextBuilder };
        export { SignalEngine };
        export { RecommendationEngine };
        export { SimulationEngine };
    }
    /**
     * Override dependencies for testing
     * @param {Object} newDeps - Partial dependency object to merge
     */
    function setDependencies(newDeps: Object): void;
    function getAdvisoryReport(orgId: string): Promise<Object>;
    function _calculateHealthScore(context: any, signals: any): number;
}
import AIContextBuilder = require("./aiContextBuilder.js");
import SignalEngine = require("./signalEngine.js");
import RecommendationEngine = require("./recommendationEngine.js");
declare const SimulationEngine: any;
//# sourceMappingURL=aiCoach.d.ts.map