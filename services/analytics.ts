import { FullInitiative, Task } from '../types';

export interface AnalyticsData {
    totalInitiatives: number;
    completedInitiatives: number;
    inProgressInitiatives: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    averageInitiativeROI: number;
    totalCost: number;
    totalBenefit: number;
}

export interface BurnDownData {
    week: string;
    planned: number;
    actual: number;
    ideal: number;
}

export interface VelocityData {
    week: string;
    completed: number;
    target: number;
}

export const calculateAnalytics = (
    initiatives: FullInitiative[],
    tasks: Task[]
): AnalyticsData => {
    const completedInitiatives = initiatives.filter(i => i.status === 'completed');
    const inProgressInitiatives = initiatives.filter(i => i.status === 'In Progress');
    const completedTasks = tasks.filter(t => t.status === 'completed');

    const totalCost = initiatives.reduce((sum, i) => sum + (i.capex || 0) + (i.firstYearOpex || 0), 0);
    const totalBenefit = initiatives.reduce((sum, i) => sum + (i.annualBenefit || 0), 0);
    const averageROI = initiatives.length > 0
        ? initiatives.reduce((sum, i) => sum + (i.roi || 0), 0) / initiatives.length
        : 0;

    return {
        totalInitiatives: initiatives.length,
        completedInitiatives: completedInitiatives.length,
        inProgressInitiatives: inProgressInitiatives.length,
        totalTasks: tasks.length,
        completedTasks: completedTasks.length,
        completionRate: tasks.length > 0 ? (completedTasks.length / tasks.length) * 100 : 0,
        averageInitiativeROI: averageROI,
        totalCost,
        totalBenefit
    };
};

export const generateBurnDownData = (tasks: Task[], startDate: Date, endDate: Date): BurnDownData[] => {
    // Calculate weeks between start and end
    const weeks = Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000));
    const totalTasks = tasks.length;

    const data: BurnDownData[] = [];

    for (let week = 0; week <= weeks; week++) {
        const weekDate = new Date(startDate.getTime() + week * 7 * 24 * 60 * 60 * 1000);
        const weekLabel = `W${week + 1}`;

        // Ideal burn-down (linear)
        const ideal = totalTasks - (totalTasks / weeks) * week;

        // Planned burn-down (can be adjusted based on priority)
        const planned = totalTasks - (totalTasks / weeks) * week;

        // Actual completed by this week (would need real dates on tasks)
        const completedByWeek = tasks.filter(t =>
            t.status === 'completed' &&
            new Date(t.updatedAt || t.createdAt) <= weekDate
        ).length;

        const actual = totalTasks - completedByWeek;

        data.push({
            week: weekLabel,
            planned,
            actual,
            ideal
        });
    }

    return data;
};

export const generateVelocityData = (tasks: Task[], weeks: number = 8): VelocityData[] => {
    const data: VelocityData[] = [];
    const tasksPerWeek = tasks.length / weeks;

    for (let i = 0; i < weeks; i++) {
        // In real implementation, this would count actual completions per week
        const completed = Math.floor(Math.random() * tasksPerWeek * 1.5); // Simulated

        data.push({
            week: `W${i + 1}`,
            completed,
            target: Math.floor(tasksPerWeek)
        });
    }

    return data;
};

export const calculateTimeToCompletion = (
    remainingTasks: number,
    averageVelocity: number
): number => {
    if (averageVelocity === 0) return Infinity;
    return Math.ceil(remainingTasks / averageVelocity);
};

export const generateRiskScore = (initiative: FullInitiative): {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    factors: string[];
} => {
    let score = 0;
    const factors: string[] = [];

    // Complexity factor
    if (initiative.complexity === 'High') {
        score += 3;
        factors.push('High complexity');
    } else if (initiative.complexity === 'Medium') {
        score += 1.5;
    }

    // Priority without assignee
    if (initiative.priority === 'Critical' && !initiative.assigneeId) {
        score += 5;
        factors.push('Critical priority without assignee');
    }

    // Budget overrun risk
    const totalCost = (initiative.capex || 0) + (initiative.firstYearOpex || 0);
    if (totalCost > 100000) {
        score += 2;
        factors.push('High budget');
    }

    // Low ROI
    if ((initiative.roi || 0) < 50) {
        score += 2;
        factors.push('Low ROI');
    }

    // No description
    if (!initiative.description || initiative.description.length < 50) {
        score += 1;
        factors.push('Insufficient planning');
    }

    let level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    if (score >= 8) level = 'CRITICAL';
    else if (score >= 5) level = 'HIGH';
    else if (score >= 3) level = 'MEDIUM';
    else level = 'LOW';

    return { score, level, factors };
};
