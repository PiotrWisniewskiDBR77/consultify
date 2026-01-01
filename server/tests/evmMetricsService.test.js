/**
 * Unit Tests for EVMMetricsService
 * 
 * Tests the Earned Value Management (EVM) calculations for projects.
 */

const EVMMetricsService = require('../services/evmMetricsService');

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

describe('EVMMetricsService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('calculateEVM', () => {
        it('should calculate all EVM metrics correctly', async () => {
            // Mock project data
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, {
                        id: 'project1',
                        budget: 100000,
                        start_date: '2025-01-01',
                        end_date: '2025-12-31'
                    });
                } else if (sql.includes('SUM') && sql.includes('budget')) {
                    // Planned Value calculation
                    callback(null, { planned_value: 50000 });
                } else if (sql.includes('SUM') && sql.includes('completed')) {
                    // Earned Value calculation
                    callback(null, { earned_value: 45000 });
                } else if (sql.includes('SUM') && sql.includes('actual_cost')) {
                    // Actual Cost calculation
                    callback(null, { actual_cost: 48000 });
                }
            });

            const result = await EVMMetricsService.calculateEVM('project1', new Date('2025-06-30'));

            // PV = 50000, EV = 45000, AC = 48000
            expect(result.pv).toBe(50000);
            expect(result.ev).toBe(45000);
            expect(result.ac).toBe(48000);

            // SV = EV - PV = 45000 - 50000 = -5000 (behind schedule)
            expect(result.sv).toBe(-5000);

            // CV = EV - AC = 45000 - 48000 = -3000 (over budget)
            expect(result.cv).toBe(-3000);

            // SPI = EV / PV = 45000 / 50000 = 0.9
            expect(result.spi).toBeCloseTo(0.9, 2);

            // CPI = EV / AC = 45000 / 48000 = 0.9375
            expect(result.cpi).toBeCloseTo(0.9375, 2);

            // BAC = Total Budget = 100000
            expect(result.bac).toBe(100000);

            // EAC = BAC / CPI = 100000 / 0.9375 = 106666.67
            expect(result.eac).toBeCloseTo(106666.67, 0);

            // ETC = EAC - AC = 106666.67 - 48000 = 58666.67
            expect(result.etc).toBeCloseTo(58666.67, 0);

            // VAC = BAC - EAC = 100000 - 106666.67 = -6666.67
            expect(result.vac).toBeCloseTo(-6666.67, 0);
        });

        it('should handle project not found', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                callback(null, null);
            });

            await expect(
                EVMMetricsService.calculateEVM('nonexistent')
            ).rejects.toThrow('Project not found');
        });

        it('should handle zero values gracefully', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, {
                        id: 'project1',
                        budget: 100000,
                        start_date: '2025-01-01',
                        end_date: '2025-12-31'
                    });
                } else {
                    callback(null, { planned_value: 0, earned_value: 0, actual_cost: 0 });
                }
            });

            const result = await EVMMetricsService.calculateEVM('project1');

            expect(result.pv).toBe(0);
            expect(result.ev).toBe(0);
            expect(result.ac).toBe(0);
            expect(result.spi).toBe(0); // Avoid division by zero
            expect(result.cpi).toBe(0);
        });

        it('should calculate positive variances for favorable performance', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, {
                        id: 'project1',
                        budget: 100000,
                        start_date: '2025-01-01',
                        end_date: '2025-12-31'
                    });
                } else if (sql.includes('planned_value')) {
                    callback(null, { planned_value: 50000 });
                } else if (sql.includes('earned_value')) {
                    callback(null, { earned_value: 55000 }); // Ahead of schedule
                } else if (sql.includes('actual_cost')) {
                    callback(null, { actual_cost: 45000 }); // Under budget
                }
            });

            const result = await EVMMetricsService.calculateEVM('project1');

            // SV = EV - PV = 55000 - 50000 = 5000 (ahead of schedule)
            expect(result.sv).toBe(5000);

            // CV = EV - AC = 55000 - 45000 = 10000 (under budget)
            expect(result.cv).toBe(10000);

            // SPI = 55000 / 50000 = 1.1 (ahead)
            expect(result.spi).toBeCloseTo(1.1, 2);

            // CPI = 55000 / 45000 = 1.22 (efficient)
            expect(result.cpi).toBeCloseTo(1.222, 2);

            // VAC should be positive (will finish under budget)
            expect(result.vac).toBeGreaterThan(0);
        });
    });

    describe('getEVMForReport', () => {
        it('should return formatted EVM data for report', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, {
                        id: 'project1',
                        name: 'Test Project',
                        budget: 100000,
                        start_date: '2025-01-01',
                        end_date: '2025-12-31'
                    });
                } else if (sql.includes('planned_value')) {
                    callback(null, { planned_value: 50000 });
                } else if (sql.includes('earned_value')) {
                    callback(null, { earned_value: 48000 });
                } else if (sql.includes('actual_cost')) {
                    callback(null, { actual_cost: 47000 });
                }
            });

            const result = await EVMMetricsService.getEVMForReport('project1', '2025-06-30');

            expect(result.projectId).toBe('project1');
            expect(result.asOfDate).toBe('2025-06-30');
            expect(result.metrics).toBeDefined();
            expect(result.metrics.pv).toBe(50000);
            expect(result.metrics.ev).toBe(48000);
            expect(result.metrics.ac).toBe(47000);

            // Check calculated fields
            expect(result.metrics.sv).toBeDefined();
            expect(result.metrics.cv).toBeDefined();
            expect(result.metrics.spi).toBeDefined();
            expect(result.metrics.cpi).toBeDefined();
            expect(result.metrics.eac).toBeDefined();
            expect(result.metrics.etc).toBeDefined();
            expect(result.metrics.vac).toBeDefined();

            // Check performance indicators
            expect(result.performance).toBeDefined();
            expect(result.performance.scheduleStatus).toBeDefined();
            expect(result.performance.costStatus).toBeDefined();
        });

        it('should categorize schedule status correctly', async () => {
            const testCases = [
                { spi: 1.1, expected: 'AHEAD' },
                { spi: 1.0, expected: 'ON_TRACK' },
                { spi: 0.95, expected: 'ON_TRACK' },
                { spi: 0.9, expected: 'BEHIND' },
                { spi: 0.7, expected: 'CRITICAL' }
            ];

            for (const testCase of testCases) {
                db.get.mockImplementation((sql, params, callback) => {
                    if (sql.includes('FROM projects WHERE id')) {
                        callback(null, { id: 'p1', budget: 100000 });
                    } else if (sql.includes('planned_value')) {
                        callback(null, { planned_value: 100 });
                    } else if (sql.includes('earned_value')) {
                        callback(null, { earned_value: 100 * testCase.spi });
                    } else if (sql.includes('actual_cost')) {
                        callback(null, { actual_cost: 100 });
                    }
                });

                const result = await EVMMetricsService.getEVMForReport('p1', '2025-06-30');
                expect(result.performance.scheduleStatus).toBe(testCase.expected);
            }
        });

        it('should categorize cost status correctly', async () => {
            const testCases = [
                { cpi: 1.1, expected: 'UNDER_BUDGET' },
                { cpi: 1.0, expected: 'ON_BUDGET' },
                { cpi: 0.95, expected: 'ON_BUDGET' },
                { cpi: 0.9, expected: 'OVER_BUDGET' },
                { cpi: 0.7, expected: 'CRITICAL' }
            ];

            for (const testCase of testCases) {
                db.get.mockImplementation((sql, params, callback) => {
                    if (sql.includes('FROM projects WHERE id')) {
                        callback(null, { id: 'p1', budget: 100000 });
                    } else if (sql.includes('planned_value')) {
                        callback(null, { planned_value: 100 });
                    } else if (sql.includes('earned_value')) {
                        callback(null, { earned_value: 100 });
                    } else if (sql.includes('actual_cost')) {
                        callback(null, { actual_cost: 100 / testCase.cpi });
                    }
                });

                const result = await EVMMetricsService.getEVMForReport('p1', '2025-06-30');
                expect(result.performance.costStatus).toBe(testCase.expected);
            }
        });
    });

    describe('calculatePercentComplete', () => {
        it('should calculate percent complete based on EV/BAC', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, { id: 'p1', budget: 100000 });
                } else if (sql.includes('earned_value')) {
                    callback(null, { earned_value: 35000 });
                }
            });

            const result = await EVMMetricsService.calculatePercentComplete('project1');

            expect(result).toBe(35); // 35000 / 100000 * 100
        });
    });

    describe('calculateTCPI', () => {
        it('should calculate To-Complete Performance Index based on BAC', async () => {
            // TCPI = (BAC - EV) / (BAC - AC)
            // With BAC=100000, EV=45000, AC=48000
            // TCPI = (100000 - 45000) / (100000 - 48000) = 55000 / 52000 = 1.0577

            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, { id: 'p1', budget: 100000 });
                } else if (sql.includes('earned_value')) {
                    callback(null, { earned_value: 45000 });
                } else if (sql.includes('actual_cost')) {
                    callback(null, { actual_cost: 48000 });
                }
            });

            const result = await EVMMetricsService.calculateTCPI('project1', 'BAC');

            expect(result).toBeCloseTo(1.0577, 2);
        });

        it('should calculate TCPI based on EAC', async () => {
            // TCPI = (BAC - EV) / (EAC - AC)
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, { id: 'p1', budget: 100000 });
                } else if (sql.includes('earned_value')) {
                    callback(null, { earned_value: 45000 });
                } else if (sql.includes('actual_cost')) {
                    callback(null, { actual_cost: 48000 });
                }
            });

            // EAC = BAC / CPI = 100000 / (45000/48000) = 106666.67
            // TCPI = (100000 - 45000) / (106666.67 - 48000) = 55000 / 58666.67 = 0.9375

            const result = await EVMMetricsService.calculateTCPI('project1', 'EAC');

            expect(result).toBeCloseTo(0.9375, 2);
        });
    });

    describe('getEVMHistory', () => {
        it('should return historical EVM data points', async () => {
            db.all.mockImplementation((sql, params, callback) => {
                callback(null, [
                    { date: '2025-03-31', pv: 25000, ev: 24000, ac: 23000 },
                    { date: '2025-06-30', pv: 50000, ev: 48000, ac: 47000 },
                    { date: '2025-09-30', pv: 75000, ev: 72000, ac: 74000 }
                ]);
            });

            const result = await EVMMetricsService.getEVMHistory('project1', '2025-01-01', '2025-12-31');

            expect(result.length).toBe(3);
            expect(result[0].pv).toBe(25000);
            expect(result[1].ev).toBe(48000);
            expect(result[2].ac).toBe(74000);
        });
    });

    describe('getEVMForecast', () => {
        it('should calculate forecast completion date based on SPI', async () => {
            db.get.mockImplementation((sql, params, callback) => {
                if (sql.includes('FROM projects WHERE id')) {
                    callback(null, {
                        id: 'p1',
                        budget: 100000,
                        start_date: '2025-01-01',
                        end_date: '2025-12-31' // 365 days
                    });
                } else if (sql.includes('planned_value')) {
                    callback(null, { planned_value: 50000 });
                } else if (sql.includes('earned_value')) {
                    callback(null, { earned_value: 45000 }); // SPI = 0.9
                } else if (sql.includes('actual_cost')) {
                    callback(null, { actual_cost: 50000 });
                }
            });

            const result = await EVMMetricsService.getEVMForecast('project1');

            // SPI = 0.9, meaning project is 10% behind
            // Forecast duration = 365 / 0.9 = 405.56 days
            expect(result.forecastDuration).toBeCloseTo(405.56, 0);
            expect(result.forecastEndDate).toBeDefined();
            expect(result.daysVariance).toBeGreaterThan(0); // Will be late
        });
    });
});


