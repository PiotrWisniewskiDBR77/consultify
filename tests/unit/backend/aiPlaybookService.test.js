// AI Playbook Service Unit Tests
// Tests the AI playbook service for automated workflow execution

const AIPlaybookService = require('../../../server/ai/aiPlaybookService');

describe('AIPlaybookService', () => {
    let mockDb;
    let service;

    beforeEach(() => {
        mockDb = {
            all: jest.fn(),
            get: jest.fn(),
            run: jest.fn(),
            close: jest.fn()
        };

        // Mock the database
        jest.mock('../../../server/database', () => mockDb);

        service = new AIPlaybookService();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('createPlaybook', () => {
        it('should create a new playbook', async () => {
            const playbookData = {
                key: 'test_playbook',
                title: 'Test Playbook',
                description: 'A test playbook',
                triggerSignal: 'project_risk_high',
                estimatedDurationMins: 30,
                templateGraph: { nodes: [], edges: [] },
                organizationId: 'org-123'
            };

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null, { lastID: 1 });
            });

            const result = await service.createPlaybook(playbookData);

            expect(result).toBeDefined();
            expect(result.id).toBe(1);
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should validate required fields', async () => {
            const invalidData = {
                title: 'Test Playbook'
                // Missing required fields
            };

            await expect(service.createPlaybook(invalidData)).rejects.toThrow('Missing required fields');
        });
    });

    describe('getPlaybookById', () => {
        it('should retrieve playbook by ID', async () => {
            const mockPlaybook = {
                id: 1,
                key: 'test_playbook',
                title: 'Test Playbook',
                status: 'active'
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback.call(null, mockPlaybook);
            });

            const result = await service.getPlaybookById(1);

            expect(result).toEqual(mockPlaybook);
            expect(mockDb.get).toHaveBeenCalledWith(
                expect.stringContaining('SELECT'),
                [1],
                expect.any(Function)
            );
        });

        it('should return null for non-existent playbook', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await service.getPlaybookById(999);

            expect(result).toBeNull();
        });
    });

    describe('updatePlaybook', () => {
        it('should update playbook details', async () => {
            const updateData = {
                title: 'Updated Title',
                description: 'Updated description'
            };

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await service.updatePlaybook(1, updateData);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('deletePlaybook', () => {
        it('should delete playbook', async () => {
            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null);
            });

            const result = await service.deletePlaybook(1);

            expect(result).toBe(true);
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('listPlaybooks', () => {
        it('should list playbooks for organization', async () => {
            const mockPlaybooks = [
                { id: 1, title: 'Playbook 1', status: 'active' },
                { id: 2, title: 'Playbook 2', status: 'draft' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, mockPlaybooks);
            });

            const result = await service.listPlaybooks('org-123');

            expect(result).toEqual(mockPlaybooks);
            expect(mockDb.all).toHaveBeenCalled();
        });

        it('should filter by status', async () => {
            const mockPlaybooks = [
                { id: 1, title: 'Active Playbook', status: 'active' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, mockPlaybooks);
            });

            const result = await service.listPlaybooks('org-123', 'active');

            expect(result).toEqual(mockPlaybooks);
            expect(mockDb.all).toHaveBeenCalledWith(
                expect.stringContaining('status = ?'),
                expect.any(Array),
                expect.any(Function)
            );
        });
    });

    describe('validatePlaybookGraph', () => {
        it('should validate correct graph structure', () => {
            const validGraph = {
                nodes: [
                    { id: 'start', type: 'start' },
                    { id: 'task1', type: 'action' },
                    { id: 'end', type: 'end' }
                ],
                edges: [
                    { source: 'start', target: 'task1' },
                    { source: 'task1', target: 'end' }
                ]
            };

            const result = service.validatePlaybookGraph(validGraph);

            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should reject invalid graph structure', () => {
            const invalidGraph = {
                nodes: [
                    { id: 'task1', type: 'action' }
                    // Missing start and end nodes
                ],
                edges: []
            };

            const result = service.validatePlaybookGraph(invalidGraph);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Graph must have start and end nodes');
        });

        it('should detect cycles', () => {
            const cyclicGraph = {
                nodes: [
                    { id: 'start', type: 'start' },
                    { id: 'task1', type: 'action' },
                    { id: 'task2', type: 'action' },
                    { id: 'end', type: 'end' }
                ],
                edges: [
                    { source: 'start', target: 'task1' },
                    { source: 'task1', target: 'task2' },
                    { source: 'task2', target: 'task1' }, // Cycle
                    { source: 'task2', target: 'end' }
                ]
            };

            const result = service.validatePlaybookGraph(cyclicGraph);

            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Graph contains cycles');
        });
    });

    describe('getPlaybooksByTrigger', () => {
        it('should find playbooks by trigger signal', async () => {
            const mockPlaybooks = [
                { id: 1, triggerSignal: 'project_risk_high', status: 'active' }
            ];

            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, mockPlaybooks);
            });

            const result = await service.getPlaybooksByTrigger('project_risk_high', 'org-123');

            expect(result).toEqual(mockPlaybooks);
            expect(mockDb.all).toHaveBeenCalled();
        });
    });

    describe('executePlaybook', () => {
        it('should start playbook execution', async () => {
            const playbookId = 1;
            const context = {
                projectId: 'proj-123',
                triggerData: { riskLevel: 'high' }
            };

            mockDb.run.mockImplementation((sql, params, callback) => {
                callback.call(null, null, { lastID: 100 });
            });

            const result = await service.executePlaybook(playbookId, context, 'user-123');

            expect(result).toBeDefined();
            expect(result.executionId).toBe(100);
            expect(result.status).toBe('running');
        });

        it('should validate playbook exists before execution', async () => {
            mockDb.get.mockImplementation((sql, params, callback) => {
                callback.call(null, null); // Playbook not found
            });

            await expect(service.executePlaybook(999, {}, 'user-123')).rejects.toThrow('Playbook not found');
        });
    });

    describe('getExecutionStatus', () => {
        it('should retrieve execution status', async () => {
            const mockExecution = {
                id: 100,
                playbookId: 1,
                status: 'running',
                currentStep: 'task1',
                progress: 50
            };

            mockDb.get.mockImplementation((sql, params, callback) => {
                callback.call(null, mockExecution);
            });

            const result = await service.getExecutionStatus(100);

            expect(result).toEqual(mockExecution);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            mockDb.all.mockImplementation((sql, params, callback) => {
                callback.call(null, new Error('Database connection failed'));
            });

            await expect(service.listPlaybooks('org-123')).rejects.toThrow('Database connection failed');
        });

        it('should validate input parameters', async () => {
            await expect(service.createPlaybook(null)).rejects.toThrow('Invalid playbook data');
            await expect(service.updatePlaybook(null, {})).rejects.toThrow('Invalid playbook ID');
            await expect(service.getPlaybookById('invalid')).rejects.toThrow('Invalid playbook ID');
        });
    });

    describe('Performance', () => {
        it('should cache frequently accessed playbooks', async () => {
            const mockPlaybook = { id: 1, title: 'Cached Playbook' };

            mockDb.get
                .mockImplementationOnce((sql, params, callback) => {
                    callback.call(null, mockPlaybook);
                })
                .mockImplementationOnce((sql, params, callback) => {
                    // Should not be called on second access (cached)
                    callback.call(null, mockPlaybook);
                });

            // First call
            await service.getPlaybookById(1);

            // Second call - should use cache
            await service.getPlaybookById(1);

            // get should only be called once due to caching
            expect(mockDb.get).toHaveBeenCalledTimes(1);
        });
    });
});
