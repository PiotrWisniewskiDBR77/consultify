/**
 * Unit Tests for PeriodComparisonService
 * 
 * Tests the period comparison and trend analysis for Management Reports.
 */

const PeriodComparisonService = require('../services/periodComparisonService');

// Mock database
jest.mock('../database', () => {
    const mockDb = {
        get: jest.fn(),
        all: jest.fn(),
        run: jest.fn()
    };
    return mockDb;
});

const db = require('../database');

describe('PeriodComparisonService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getPreviousReport', () => {
        it('should find the most recent previous report of same type', async () => {
            const currentReport = {
                id: 'report2',
                organization_id: 'org1',
                project_id: 'proj1',
                report_type: 'TEAM_MEETING',
                scope: 'PROJECT',
                period_end: '2025-12-28'
            };

            db.get.mockImplementation((sql, params, callback) => {
                if (params && params[0] === 'report2') {
                    callback(null, currentReport);
                } else if (sql.includes('ORDER BY period_end DESC')) {
                    callback(null, {
                        id: 'report1',
                        organization_id: 'org1',
                        project_id: 'proj1',
                        report_type: 'TEAM_MEETING',
                        period_end: '2025-12-21',
                        content: JSON.stringify({ tasksCompleted: 5, progressPercent: 40 })
                    });
                }
            });

            const result = await PeriodComparisonService.getPreviousReport('report2');

            expect(result).not.toBeNull();
            expect(result.id).toBe('report1');
            expect(result.report_type).toBe('TEAM_MEETING');
        });

        it('should return null if no previous report exists', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (params && params[0] === 'report1') {
                    callback(null, {
                        id: 'report1',
                        organization_id: 'org1',
                        report_type: 'TEAM_MEETING',
                        period_end: '2025-12-28'
                    });
                } else {
                    callback(null, null);
                }
            });

            const result = await PeriodComparisonService.getPreviousReport('report1');

            expect(result).toBeNull();
        });

        it('should match scope for project-level reports', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('project_id = ?')) {
                    callback(null, {
                        id: 'prevReport',
                        project_id: 'proj1',
                        scope: 'PROJECT'
                    });
                } else {
                    callback(null, {
                        id: 'currentReport',
                        project_id: 'proj1',
                        scope: 'PROJECT'
                    });
                }
            });

            const result = await PeriodComparisonService.getPreviousReport('currentReport');

            expect(result.project_id).toBe('proj1');
        });
    });

    describe('calculateChanges', () => {
        it('should calculate numeric changes with percentages', () => {
            const currentContent = {
                tasksCompleted: 15,
                tasksInProgress: 8,
                tasksBlocked: 2,
                progressPercent: 60
            };

            const previousContent = {
                tasksCompleted: 10,
                tasksInProgress: 12,
                tasksBlocked: 3,
                progressPercent: 45
            };

            const result = PeriodComparisonService.calculateChanges(currentContent, previousContent);

            // Tasks completed: 15 vs 10 = +5 (+50%)
            expect(result.tasksCompleted.current).toBe(15);
            expect(result.tasksCompleted.previous).toBe(10);
            expect(result.tasksCompleted.change).toBe(5);
            expect(result.tasksCompleted.changePercent).toBe(50);
            expect(result.tasksCompleted.trend).toBe('UP');

            // Tasks in progress: 8 vs 12 = -4 (-33.3%)
            expect(result.tasksInProgress.change).toBe(-4);
            expect(result.tasksInProgress.trend).toBe('DOWN');

            // Progress: 60 vs 45 = +15 (UP)
            expect(result.progressPercent.trend).toBe('UP');
        });

        it('should handle zero previous values', () => {
            const currentContent = {
                blockers: 3
            };

            const previousContent = {
                blockers: 0
            };

            const result = PeriodComparisonService.calculateChanges(currentContent, previousContent);

            expect(result.blockers.change).toBe(3);
            expect(result.blockers.changePercent).toBe(null); // Can't calculate % from zero
            expect(result.blockers.trend).toBe('UP');
        });

        it('should mark stable when no change', () => {
            const currentContent = {
                risksOpen: 5
            };

            const previousContent = {
                risksOpen: 5
            };

            const result = PeriodComparisonService.calculateChanges(currentContent, previousContent);

            expect(result.risksOpen.change).toBe(0);
            expect(result.risksOpen.trend).toBe('STABLE');
        });

        it('should handle missing fields gracefully', () => {
            const currentContent = {
                field1: 10,
                field3: 30 // New field not in previous
            };

            const previousContent = {
                field1: 5,
                field2: 20 // Old field not in current
            };

            const result = PeriodComparisonService.calculateChanges(currentContent, previousContent);

            expect(result.field1.change).toBe(5);
            expect(result.field3).toBeUndefined(); // New fields not compared
            expect(result.field2).toBeUndefined(); // Removed fields not compared
        });

        it('should handle nested object changes', () => {
            const currentContent = {
                overallStatus: { status: 'GREEN', score: 85 },
                kpis: [{ name: 'Velocity', value: 45 }]
            };

            const previousContent = {
                overallStatus: { status: 'AMBER', score: 70 },
                kpis: [{ name: 'Velocity', value: 38 }]
            };

            const result = PeriodComparisonService.calculateChanges(currentContent, previousContent);

            expect(result.overallStatus).toBeDefined();
            expect(result.overallStatus.statusChanged).toBe(true);
            expect(result.overallStatus.previousStatus).toBe('AMBER');
            expect(result.overallStatus.currentStatus).toBe('GREEN');
        });
    });

    describe('generateComparisonData', () => {
        it('should generate full comparison data for report', async () => {
            const currentReport = {
                id: 'report2',
                organization_id: 'org1',
                project_id: 'proj1',
                report_type: 'TEAM_MEETING',
                period_start: '2025-12-22',
                period_end: '2025-12-28',
                content: JSON.stringify({
                    tasksCompleted: 15,
                    progressPercent: 60,
                    blockers: 2
                })
            };

            const previousReport = {
                id: 'report1',
                period_start: '2025-12-15',
                period_end: '2025-12-21',
                content: JSON.stringify({
                    tasksCompleted: 10,
                    progressPercent: 45,
                    blockers: 4
                })
            };

            db.get.mockImplementation((sql, params, callback) => {
                if (params && params[0] === 'report2') {
                    callback(null, currentReport);
                } else if (sql.includes('ORDER BY period_end DESC')) {
                    callback(null, previousReport);
                }
            });

            const result = await PeriodComparisonService.generateComparisonData('report2');

            expect(result.previousReportId).toBe('report1');
            expect(result.previousPeriod.start).toBe('2025-12-15');
            expect(result.previousPeriod.end).toBe('2025-12-21');
            expect(result.changes).toBeDefined();
            expect(result.changes.tasksCompleted.trend).toBe('UP');
            expect(result.changes.blockers.trend).toBe('DOWN'); // 4 to 2 is improvement
        });

        it('should return null comparison if no previous report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (params && params[0] === 'report1') {
                    callback(null, {
                        id: 'report1',
                        content: JSON.stringify({ tasksCompleted: 5 })
                    });
                } else {
                    callback(null, null); // No previous
                }
            });

            const result = await PeriodComparisonService.generateComparisonData('report1');

            expect(result.previousReportId).toBeNull();
            expect(result.hasPreviousPeriod).toBe(false);
        });
    });

    describe('calculateTrend', () => {
        it('should identify UP trend correctly', () => {
            const trend = PeriodComparisonService.calculateTrend(100, 80);
            expect(trend).toBe('UP');
        });

        it('should identify DOWN trend correctly', () => {
            const trend = PeriodComparisonService.calculateTrend(80, 100);
            expect(trend).toBe('DOWN');
        });

        it('should identify STABLE trend for no change', () => {
            const trend = PeriodComparisonService.calculateTrend(100, 100);
            expect(trend).toBe('STABLE');
        });

        it('should handle near-zero changes as STABLE', () => {
            // Within 1% threshold
            const trend = PeriodComparisonService.calculateTrend(100.5, 100);
            expect(trend).toBe('STABLE');
        });
    });

    describe('getHistoricalTrend', () => {
        it('should return trend data for sparkline visualization', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { period_end: '2025-12-07', value: 30 },
                    { period_end: '2025-12-14', value: 42 },
                    { period_end: '2025-12-21', value: 45 },
                    { period_end: '2025-12-28', value: 60 }
                ]);
            });

            const result = await PeriodComparisonService.getHistoricalTrend(
                'org1',
                'PROJECT',
                'proj1',
                'progressPercent',
                4
            );

            expect(result.length).toBe(4);
            expect(result[0].value).toBe(30);
            expect(result[3].value).toBe(60);
            expect(result.every(p => p.period_end !== undefined)).toBe(true);
        });
    });

    describe('calculateMovingAverage', () => {
        it('should calculate moving average for trend smoothing', () => {
            const dataPoints = [
                { period: '2025-12-01', value: 10 },
                { period: '2025-12-08', value: 15 },
                { period: '2025-12-15', value: 12 },
                { period: '2025-12-22', value: 18 },
                { period: '2025-12-29', value: 20 }
            ];

            const result = PeriodComparisonService.calculateMovingAverage(dataPoints, 3);

            // MA(3) for last point: (12 + 18 + 20) / 3 = 16.67
            expect(result[result.length - 1].movingAverage).toBeCloseTo(16.67, 1);
        });
    });

    describe('getPerformanceIndicators', () => {
        it('should calculate performance indicators from comparison', () => {
            const comparison = {
                changes: {
                    tasksCompleted: { change: 5, changePercent: 50, trend: 'UP' },
                    progressPercent: { change: 15, changePercent: 33, trend: 'UP' },
                    blockers: { change: -2, changePercent: -50, trend: 'DOWN' }, // Improvement
                    risksOpen: { change: 1, changePercent: 20, trend: 'UP' } // Concern
                }
            };

            const result = PeriodComparisonService.getPerformanceIndicators(comparison);

            expect(result.overallTrend).toBe('IMPROVING');
            expect(result.improvements).toContain('tasksCompleted');
            expect(result.improvements).toContain('blockers'); // Decrease is good
            expect(result.concerns).toContain('risksOpen'); // Increase is bad
        });

        it('should identify declining performance', () => {
            const comparison = {
                changes: {
                    tasksCompleted: { change: -3, trend: 'DOWN' },
                    progressPercent: { change: -5, trend: 'DOWN' },
                    blockers: { change: 4, trend: 'UP' } // Worse
                }
            };

            const result = PeriodComparisonService.getPerformanceIndicators(comparison);

            expect(result.overallTrend).toBe('DECLINING');
            expect(result.concerns.length).toBeGreaterThan(0);
        });
    });
});
















