export default BudgetService;
declare namespace BudgetService {
    export function setDependencies(newDeps?: {}): void;
    export function createBudget(orgId: any, initiativeId: any, budgetData: any, userId: any): Promise<{
        id: any;
        initiativeId: any;
        budgetType: any;
        plannedAmount: any;
        contingencyAmount: number;
        currency: any;
    }>;
    export function getBudget(initiativeId: any, orgId: any): Promise<{
        id: any;
        initiativeId: any;
        initiativeName: any;
        budgetType: any;
        plannedAmount: any;
        approvedAmount: any;
        currency: any;
        fiscalYear: any;
        contingencyPercent: any;
        contingencyAmount: any;
        status: any;
        notes: any;
        lineItems: any;
        transactions: any;
        totals: {
            totalPlanned: any;
            totalApproved: any;
            totalActual: any;
            totalCommitted: any;
            totalForecast: any;
            remaining: number;
            consumedPercent: number;
            varianceAmount: number;
            variancePercent: number;
            contingencyAmount: any;
            isOverBudget: boolean;
            status: string;
        };
        createdAt: any;
        updatedAt: any;
    } | null>;
    export function calculateTotals(budgetId: any): Promise<{
        totalPlanned: any;
        totalApproved: any;
        totalActual: any;
        totalCommitted: any;
        totalForecast: any;
        remaining: number;
        consumedPercent: number;
        varianceAmount: number;
        variancePercent: number;
        contingencyAmount: any;
        isOverBudget: boolean;
        status: string;
    }>;
    export function addLineItem(budgetId: any, itemData: any): Promise<{
        id: any;
        category: any;
        plannedAmount: any;
    }>;
    export function addTransaction(budgetId: any, transactionData: any, userId: any): Promise<{
        id: any;
        amount: any;
        transactionType: any;
    }>;
    export function calculateBurnRate(budgetId: any): Promise<{
        monthlyBurnRate: number;
        trend: string;
        averageMonthly: number;
        monthlyBreakdown?: undefined;
    } | {
        monthlyBurnRate: any;
        averageMonthly: number;
        trend: string;
        monthlyBreakdown: any;
    }>;
    export function forecastCompletion(budgetId: any): Promise<{
        budgetId: any;
        plannedBudget: any;
        actualSpent: any;
        estimateToComplete: number;
        estimateAtCompletion: number;
        varianceAtCompletion: number;
        costPerformanceIndex: number;
        isProjectedOverrun: boolean;
        projectedOverrunPercent: number;
        recommendation: string;
    } | null>;
    export function checkAlerts(budgetId: any): Promise<{
        id: any;
        budgetId: any;
        alertType: string;
        thresholdPercent: number;
        currentPercent: number;
        message: string;
        severity: string;
        createdAt: string;
    }[]>;
    export function getAlerts(budgetId: any, includeAcknowledged?: boolean): Promise<any>;
    export function acknowledgeAlert(alertId: any, userId: any): Promise<void>;
    export function getPortfolioSummary(orgId: any, filters?: {}): Promise<{
        initiatives: any;
        totals: any;
        healthCounts: any;
        initiativeCount: any;
    }>;
    export function createSnapshot(budgetId: any, snapshotType: any, userId: any): Promise<{
        id: any;
        snapshotType: any;
        createdAt: string;
    }>;
    export { BUDGET_CATEGORIES };
    export { BUDGET_TYPES };
    export { ALERT_THRESHOLDS };
}
declare namespace BUDGET_CATEGORIES {
    let PERSONNEL: string;
    let TECHNOLOGY: string;
    let CONSULTING: string;
    let TRAINING: string;
    let INFRASTRUCTURE: string;
    let TRAVEL: string;
    let SOFTWARE: string;
    let HARDWARE: string;
    let OTHER: string;
}
declare namespace BUDGET_TYPES {
    let CAPEX: string;
    let OPEX: string;
    let COMBINED: string;
}
declare namespace ALERT_THRESHOLDS {
    let WARNING: number;
    let CRITICAL: number;
    let OVERRUN: number;
}
//# sourceMappingURL=budgetService.d.ts.map