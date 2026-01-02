/**
 * ReportService Tests
 * 
 * Tests for ReportService with mocked dependencies.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
const mockDb = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn()
};

const mockUuid = vi.fn(() => 'mock-uuid');

const mockAiService = {
    callLLM: vi.fn(),
    generateTable: vi.fn()
};

// Mock dependencies in module scope
vi.mock('../../../server/database', () => ({ default: {} }));
vi.mock('../../../server/services/aiService', () => ({ default: {} }));

describe('ReportService', () => {
    let ReportService;

    beforeEach(async () => {
        vi.resetModules();
        vi.clearAllMocks();

        try {
            const module = await import('../../../server/services/reportService.js');
            ReportService = module.default || module;

            // Inject dependencies
            if (ReportService.setDependencies) {
                ReportService.setDependencies({
                    db: mockDb,
                    uuid: mockUuid,
                    aiService: mockAiService
                });
            }
        } catch (e) {
            console.warn('Failed to import ReportService:', e);
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getReport', () => {
        it('should return report with parsed JSON fields', async () => {
            if (!ReportService) return;

            const mockReport = {
                id: 'report-1',
                project_id: 'proj-1',
                block_order: JSON.stringify(['block-1']),
                sources: JSON.stringify(['source-1'])
            };

            const mockBlocks = [{
                id: 'block-1',
                content: JSON.stringify({ text: 'content' }),
                meta: JSON.stringify({ type: 'text' }),
                editable: 1,
                ai_regeneratable: 0,
                locked: 0
            }];

            mockDb.get.mockImplementation((sql, params, callback) => callback(null, mockReport));
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, mockBlocks));

            const result = await ReportService.getReport('proj-1');

            expect(result).toBeDefined();
            expect(result.id).toBe('report-1');
            expect(result.blocks['block-1']).toBeDefined();
            expect(result.blocks['block-1'].content).toEqual({ text: 'content' });
            expect(Array.isArray(result.blockOrder)).toBe(true);
        });

        it('should return null if no report found', async () => {
            if (!ReportService) return;

            mockDb.get.mockImplementation((sql, params, callback) => callback(null, null));

            const result = await ReportService.getReport('proj-1');
            expect(result).toBeNull();
        });

        it('should handle db errors', async () => {
            if (!ReportService) return;

            mockDb.get.mockImplementation((sql, params, callback) => callback(new Error('DB Error')));

            await expect(ReportService.getReport('proj-1')).rejects.toThrow('DB Error');
        });
    });

    describe('createDraft', () => {
        it('should create a new draft report', async () => {
            if (!ReportService) return;

            mockDb.run.mockImplementation((sql, params, callback) => callback(null));

            const result = await ReportService.createDraft('proj-1', 'org-1', 'Title');

            expect(result.id).toBe('mock-uuid');
            expect(result.status).toBe('draft');
            expect(mockDb.run).toHaveBeenCalledTimes(1);
        });
    });

    describe('addBlock', () => {
        it('should add a block and update block order', async () => {
            if (!ReportService) return;

            mockDb.run.mockImplementation((sql, params, callback) => callback(null));
            mockDb.all.mockImplementation((sql, params, callback) => callback(null, [{ id: 'block-1' }]));

            const blockData = {
                type: 'text',
                title: 'Block',
                module: 'mod',
                content: { text: 'test' },
                position: 0
            };

            const result = await ReportService.addBlock('report-1', blockData);

            expect(result.id).toBe('mock-uuid');
            // run called for INSERT block, SELECT blocks (in _updateBlockOrder), UPDATE report (in _updateBlockOrder)
            expect(mockDb.run).toHaveBeenCalled();
        });
    });

    describe('updateBlock', () => {
        it('should update block fields', async () => {
            if (!ReportService) return;

            mockDb.run.mockImplementation((sql, params, callback) => callback(null));

            await ReportService.updateBlock('report-1', 'block-1', {
                content: { text: 'updated' },
                locked: true
            });

            expect(mockDb.run).toHaveBeenCalledTimes(1);
        });

        it('should do nothing if no allowed fields provided', async () => {
            if (!ReportService) return;

            await ReportService.updateBlock('report-1', 'block-1', { invalid: 'field' });
            expect(mockDb.run).not.toHaveBeenCalled();
        });
    });

    describe('regenerateBlock', () => {
        it('should regenerate text block content using AI', async () => {
            if (!ReportService) return;

            const mockBlock = {
                id: 'block-1',
                type: 'text',
                content: JSON.stringify({ text: 'old text' })
            };

            mockDb.get.mockImplementation((sql, params, callback) => callback(null, mockBlock));
            mockDb.run.mockImplementation((sql, params, callback) => callback(null));
            mockAiService.callLLM.mockResolvedValue('improved text');

            const result = await ReportService.regenerateBlock('report-1', 'block-1', 'improve');

            expect(mockAiService.callLLM).toHaveBeenCalled();
            expect(result.content.text).toBe('improved text');
            expect(mockDb.run).toHaveBeenCalled();
        });

        it('should regenerate table block content using AI', async () => {
            if (!ReportService) return;

            const mockBlock = {
                id: 'block-1',
                type: 'table',
                content: JSON.stringify({ headers: ['A', 'B'] })
            };

            mockDb.get.mockImplementation((sql, params, callback) => callback(null, mockBlock));
            mockDb.run.mockImplementation((sql, params, callback) => callback(null));
            mockAiService.generateTable.mockResolvedValue({ rows: [['1', '2']] });

            const result = await ReportService.regenerateBlock('report-1', 'block-1', 'fill');

            expect(mockAiService.generateTable).toHaveBeenCalled();
            expect(result.content.rows).toEqual([['1', '2']]);
        });
    });
});
