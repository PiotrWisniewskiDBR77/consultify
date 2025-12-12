import { describe, it, expect } from 'vitest';
import { calculateAnalytics, generateBurnDownData, generateVelocityData } from '../../services/analytics';
import { FullInitiative, Task } from '../../types';

describe('Service Test: Analytics', () => {
    describe('calculateAnalytics', () => {
        it('calculates analytics for empty arrays', () => {
            const result = calculateAnalytics([], []);
            
            expect(result.totalInitiatives).toBe(0);
            expect(result.completedInitiatives).toBe(0);
            expect(result.totalTasks).toBe(0);
            expect(result.completionRate).toBe(0);
            expect(result.averageInitiativeROI).toBe(0);
        });

        it('calculates completion rate correctly', () => {
            const tasks: Task[] = [
                { id: '1', title: 'Task 1', status: 'completed' } as Task,
                { id: '2', title: 'Task 2', status: 'pending' } as Task,
                { id: '3', title: 'Task 3', status: 'completed' } as Task,
            ];
            
            const result = calculateAnalytics([], tasks);
            
            expect(result.totalTasks).toBe(3);
            expect(result.completedTasks).toBe(2);
            expect(result.completionRate).toBeCloseTo(66.67, 1);
        });

        it('calculates initiative statistics', () => {
            const initiatives: FullInitiative[] = [
                { id: '1', title: 'Initiative 1', status: 'completed', roi: 50 } as FullInitiative,
                { id: '2', title: 'Initiative 2', status: 'In Progress', roi: 30 } as FullInitiative,
                { id: '3', title: 'Initiative 3', status: 'pending', roi: 20 } as FullInitiative,
            ];
            
            const result = calculateAnalytics(initiatives, []);
            
            expect(result.totalInitiatives).toBe(3);
            expect(result.completedInitiatives).toBe(1);
            expect(result.inProgressInitiatives).toBe(1);
            expect(result.averageInitiativeROI).toBeCloseTo(33.33, 1);
        });

        it('calculates total cost and benefit', () => {
            const initiatives: FullInitiative[] = [
                { id: '1', title: 'I1', capex: 10000, firstYearOpex: 5000, annualBenefit: 20000 } as FullInitiative,
                { id: '2', title: 'I2', capex: 15000, firstYearOpex: 3000, annualBenefit: 25000 } as FullInitiative,
            ];
            
            const result = calculateAnalytics(initiatives, []);
            
            expect(result.totalCost).toBe(33000);
            expect(result.totalBenefit).toBe(45000);
        });
    });

    describe('generateBurnDownData', () => {
        it('generates burn down data for date range', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-29'); // 4 weeks
            const tasks: Task[] = [
                { id: '1', title: 'Task 1', status: 'completed', createdAt: '2024-01-05' } as Task,
                { id: '2', title: 'Task 2', status: 'pending' } as Task,
            ];
            
            const result = generateBurnDownData(tasks, startDate, endDate);
            
            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty('week');
            expect(result[0]).toHaveProperty('planned');
            expect(result[0]).toHaveProperty('actual');
            expect(result[0]).toHaveProperty('ideal');
        });

        it('handles empty task list', () => {
            const startDate = new Date('2024-01-01');
            const endDate = new Date('2024-01-15');
            
            const result = generateBurnDownData([], startDate, endDate);
            
            expect(result.length).toBeGreaterThan(0);
        });
    });

    describe('generateVelocityData', () => {
        it('generates velocity data for specified weeks', () => {
            const tasks: Task[] = [
                { id: '1', title: 'Task 1' } as Task,
                { id: '2', title: 'Task 2' } as Task,
            ];
            
            const result = generateVelocityData(tasks, 4);
            
            expect(result.length).toBe(4);
            expect(result[0]).toHaveProperty('week');
            expect(result[0]).toHaveProperty('completed');
            expect(result[0]).toHaveProperty('target');
        });

        it('uses default 8 weeks when not specified', () => {
            const tasks: Task[] = [{ id: '1', title: 'Task 1' } as Task];
            
            const result = generateVelocityData(tasks);
            
            expect(result.length).toBe(8);
        });
    });
});

