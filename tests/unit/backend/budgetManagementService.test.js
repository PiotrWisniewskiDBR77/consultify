/**
 * Budget Management Service Unit Tests
 * Tests budget tracking, alerts, and reporting
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Budget Management Service implementation
const createBudgetManagementService = () => {
    const budgets = new Map();
    const expenses = [];
    const alerts = [];
    let counter = 0;

    return {
        createBudget: (name, config) => {
            const id = `budget-${Date.now()}-${++counter}`;
            const budget = {
                id,
                name,
                total: config.total,
                spent: 0,
                currency: config.currency || 'USD',
                period: config.period || 'monthly',
                alertThresholds: config.alertThresholds || [0.7, 0.9],
                status: 'active',
                createdAt: new Date()
            };
            budgets.set(id, budget);
            return budget;
        },

        getBudget: (id) => budgets.get(id) || null,

        listBudgets: () => Array.from(budgets.values()),

        recordExpense: (budgetId, amount, description = '') => {
            const budget = budgets.get(budgetId);
            if (!budget) throw new Error('Budget not found');

            const expense = {
                id: `exp-${Date.now()}-${++counter}`,
                budgetId,
                amount,
                description,
                timestamp: new Date()
            };
            expenses.push(expense);

            budget.spent += amount;

            // Check thresholds
            const percentUsed = budget.spent / budget.total;
            for (const threshold of budget.alertThresholds) {
                const prevPercent = (budget.spent - amount) / budget.total;
                if (prevPercent < threshold && percentUsed >= threshold) {
                    alerts.push({
                        id: `alert-${Date.now()}-${++counter}`,
                        budgetId,
                        type: 'threshold',
                        threshold,
                        percentUsed,
                        timestamp: new Date()
                    });
                }
            }

            return expense;
        },

        getRemaining: (budgetId) => {
            const budget = budgets.get(budgetId);
            if (!budget) return null;
            return budget.total - budget.spent;
        },

        getPercentUsed: (budgetId) => {
            const budget = budgets.get(budgetId);
            if (!budget) return null;
            return (budget.spent / budget.total) * 100;
        },

        isOverBudget: (budgetId) => {
            const budget = budgets.get(budgetId);
            if (!budget) return null;
            return budget.spent > budget.total;
        },

        getAlerts: (budgetId = null) => {
            if (budgetId) {
                return alerts.filter(a => a.budgetId === budgetId);
            }
            return [...alerts];
        },

        getExpenses: (budgetId) => {
            return expenses.filter(e => e.budgetId === budgetId);
        },

        getBudgetReport: (budgetId) => {
            const budget = budgets.get(budgetId);
            if (!budget) return null;

            const budgetExpenses = expenses.filter(e => e.budgetId === budgetId);

            return {
                budgetId,
                name: budget.name,
                total: budget.total,
                spent: budget.spent,
                remaining: budget.total - budget.spent,
                percentUsed: (budget.spent / budget.total) * 100,
                transactionCount: budgetExpenses.length,
                alertCount: alerts.filter(a => a.budgetId === budgetId).length
            };
        }
    };
};

describe('BudgetManagementService', () => {
    let budgetService;

    beforeEach(() => {
        budgetService = createBudgetManagementService();
    });

    describe('Budget Creation', () => {
        it('should create budget', () => {
            const budget = budgetService.createBudget('Marketing', { total: 100000 });

            expect(budget.id).toBeDefined();
            expect(budget.total).toBe(100000);
            expect(budget.spent).toBe(0);
        });

        it('should use default values', () => {
            const budget = budgetService.createBudget('Default', { total: 10000 });

            expect(budget.currency).toBe('USD');
            expect(budget.period).toBe('monthly');
        });
    });

    describe('Expense Tracking', () => {
        it('should track budget spending', () => {
            const budget = budgetService.createBudget('IT', { total: 50000 });
            budgetService.recordExpense(budget.id, 15000, 'Server costs');
            budgetService.recordExpense(budget.id, 5000, 'Software licenses');

            expect(budgetService.getBudget(budget.id).spent).toBe(20000);
        });

        it('should calculate remaining', () => {
            const budget = budgetService.createBudget('Test', { total: 100000 });
            budgetService.recordExpense(budget.id, 45000);

            expect(budgetService.getRemaining(budget.id)).toBe(55000);
        });

        it('should detect over budget', () => {
            const budget = budgetService.createBudget('Small', { total: 1000 });
            budgetService.recordExpense(budget.id, 1500);

            expect(budgetService.isOverBudget(budget.id)).toBe(true);
        });
    });

    describe('Alert Thresholds', () => {
        it('should alert on threshold breach', () => {
            const budget = budgetService.createBudget('Test', {
                total: 10000,
                alertThresholds: [0.8]
            });

            budgetService.recordExpense(budget.id, 8000);
            const alerts = budgetService.getAlerts(budget.id);

            expect(alerts).toHaveLength(1);
            expect(alerts[0].threshold).toBe(0.8);
        });
    });

    describe('Budget Reporting', () => {
        it('should generate budget report', () => {
            const budget = budgetService.createBudget('Report Test', { total: 50000 });
            budgetService.recordExpense(budget.id, 25000);

            const report = budgetService.getBudgetReport(budget.id);

            expect(report.percentUsed).toBe(50);
            expect(report.remaining).toBe(25000);
        });
    });
});
