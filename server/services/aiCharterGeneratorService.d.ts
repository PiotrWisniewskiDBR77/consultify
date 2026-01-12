export default AICharterGeneratorService;
declare class AICharterGeneratorService {
    /**
     * Generate a full initiative charter from gaps and context
     * @param {Object} request - AICharterRequest
     * @param {string} userId - User generating the charter
     * @returns {Promise<Object>} AIGeneratedCharter
     */
    static generateFullCharter(request: Object, userId: string): Promise<Object>;
    /**
     * Generate enterprise-grade charter with full strategic context
     * Includes industry intelligence, framework analyses, and governance structure
     * @param {Object} request - AICharterRequest
     * @param {string} userId - User generating the charter
     * @param {Object} orgProfile - Organization profile with strategic context
     * @returns {Promise<Object>} EnterpriseAIGeneratedCharter
     */
    static generateEnterpriseCharter(request: Object, userId: string, orgProfile?: Object): Promise<Object>;
    /**
     * Generate strategic alignment section
     */
    static generateStrategicAlignment(charter: any, orgProfile: any, industryContext: any): Promise<{
        alignmentScore: number;
        prioritiesMatch: any;
        competitivePositioning: any;
        transformationFit: any;
        industryTrends: any;
    }>;
    /**
     * Generate enhanced financial model
     */
    static generateFinancialModel(charter: any, orgProfile: any, constraints: any): Promise<{
        investmentSummary: {
            totalInvestment: any;
            capex: any;
            opex: any;
            contingency: number;
        };
        npv: {
            value: number;
            discountRate: string;
            horizon: string;
        };
        irr: {
            estimate: string;
            confidence: string;
        };
        paybackPeriod: {
            months: number;
            confidence: string;
        };
        sensitivity: {
            bestCase: {
                roi: number;
                npv: number;
            };
            baseCase: {
                roi: any;
                npv: number;
            };
            worstCase: {
                roi: number;
                npv: number;
            };
        };
        riskAdjustedROI: number;
    }>;
    /**
     * Generate governance structure with RACI matrix
     */
    static generateGovernanceStructure(charter: any, constraints: any): Promise<{
        raciMatrix: {
            activity: string;
        }[];
        decisionRights: {
            strategic: string;
            tactical: string;
            operational: string;
        };
        escalationPath: {
            level: number;
            owner: string;
            scope: string;
        }[];
        reviewCadence: {
            daily: string;
            weekly: string;
            monthly: string;
            quarterly: string;
        };
    }>;
    /**
     * Calculate AI metadata and confidence scores
     */
    static calculateAIMetadata(charter: any, industryContext: any, orgProfile: any): {
        overallConfidence: string;
        confidenceScore: number;
        dataQuality: string;
        sectionConfidence: {
            basicInfo: number;
            problem: number;
            targetState: number;
            financials: number;
            team: number;
            tasks: number;
        };
        frameworksApplied: string[];
    };
    /**
     * Get benchmarks for charter context
     */
    static getBenchmarksForCharter(industry: any, companySize: any): Promise<{
        industry: any;
        medianMaturity: any;
        topQuartile: any;
        source: string;
    }>;
    /**
     * Log enterprise generation for audit
     */
    static logEnterpriseGeneration(charter: any, request: any, userId: any, orgProfile: any): Promise<any>;
    /**
     * Prepare context for AI generation
     */
    static prepareGenerationContext(request: any, template: any): {
        gaps: any;
        primaryAxis: string;
        avgGap: number;
        template: any;
        organizationContext: any;
        constraints: any;
        sourceType: any;
    };
    /**
     * Generate basic initiative info (name, description, objectives)
     */
    static generateBasicInfo(context: any): Promise<any>;
    /**
     * Generate structured problem statement
     */
    static generateProblemStructured(context: any, template: any): Promise<any>;
    /**
     * Generate target state
     */
    static generateTargetState(context: any, template: any): Promise<any>;
    /**
     * Generate kill criteria
     */
    static generateKillCriteria(context: any, template: any): Promise<any>;
    /**
     * Generate risk assessment
     */
    static generateRisks(context: any): Promise<any[]>;
    /**
     * Generate suggested tasks
     */
    static generateTasks(context: any, constraints: any, template: any): Promise<any>;
    /**
     * Generate team suggestion
     */
    static generateTeamSuggestion(context: any, constraints: any): Promise<{
        id: string;
        role: any;
        title: any;
        allocation: any;
        reason: any;
    }[]>;
    /**
     * Estimate financial metrics
     */
    static estimateFinancials(context: any, constraints: any): Promise<{
        capex: number;
        opex: number;
        totalBudget: number;
        roi: number;
        annualBenefit: number;
    }>;
    /**
     * Generate milestones from timeline and tasks
     */
    static generateMilestones(constraints: any, tasks: any): {
        targetDate: string;
        name: string;
    }[];
    /**
     * Calculate overall risk level
     */
    static calculateOverallRisk(risks: any): "LOW" | "MEDIUM" | "HIGH";
    /**
     * Calculate priority from gaps
     */
    static calculatePriority(gaps: any): 2 | 1 | 3;
    /**
     * Calculate confidence in the generation
     */
    static calculateConfidence(context: any, template: any): string;
    /**
     * Log generation for audit
     */
    static logGeneration(charter: any, request: any, userId: any, durationMs: any): Promise<any>;
    /**
     * Regenerate a specific section of the charter
     */
    static regenerateSection(charter: any, section: any, context: any): Promise<any>;
    static addMonths(date: any, months: any): Date;
    static getDefaultBasicInfo(context: any): {
        name: string;
        description: string;
        summary: string;
        oneLiner: string;
        strategicIntent: string;
        objectives: string[];
        hypothesis: string;
        deliverables: string[];
    };
    static getDefaultProblem(context: any): {
        symptom: string;
        rootCause: string;
        costOfInaction: string;
    };
    static getDefaultTargetState(primaryAxis: any): {
        process: string[];
        behavior: string[];
        capability: string[];
    };
    static getDefaultKillCriteria(): string[];
    static getDefaultRisks(): {
        risk: string;
        mitigation: string;
        metric: string;
    }[];
    static getDefaultTasks(primaryAxis: any): {
        id: string;
        title: string;
        taskType: string;
        status: string;
        priority: string;
        estimatedHours: number;
        stepPhase: string;
    }[];
    static getDefaultTeam(): {
        id: string;
        role: string;
        title: string;
        allocation: number;
        reason: string;
    }[];
}
//# sourceMappingURL=aiCharterGeneratorService.d.ts.map