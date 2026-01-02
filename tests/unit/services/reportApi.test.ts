/**
 * ReportApi Tests
 * 
 * Tests for report API service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportApi } from '../../../services/reportApi';

// Mock fetch
global.fetch = vi.fn();
const mockFetch = vi.mocked(fetch);

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(() => 'mock-token'),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ReportApi', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getReport', () => {
        it('should fetch report by project ID', async () => {
            const mockReport = { id: 'report-1', projectId: 'project-1' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockReport
            } as Response);

            const result = await reportApi.getReport('project-1');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/reports/project/project-1',
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer mock-token'
                    })
                })
            );
            expect(result).toEqual(mockReport);
        });

        it('should return null when report not found', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 404
            } as Response);

            const result = await reportApi.getReport('non-existent');

            expect(result).toBeNull();
        });

        it('should return null on error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await reportApi.getReport('project-1');

            expect(result).toBeNull();
        });
    });

    describe('createDraft', () => {
        it('should create draft report', async () => {
            const mockReport = { id: 'report-1', title: 'Draft Report' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockReport
            } as Response);

            const result = await reportApi.createDraft('project-1', 'Draft Report');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/reports/draft',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        projectId: 'project-1',
                        title: 'Draft Report',
                        sources: []
                    })
                })
            );
            expect(result).toEqual(mockReport);
        });

        it('should throw error on failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                status: 500
            } as Response);

            await expect(
                reportApi.createDraft('project-1', 'Draft')
            ).rejects.toThrow('Failed to create draft');
        });
    });

    describe('addBlock', () => {
        it('should add block to report', async () => {
            const mockBlock = { id: 'block-1' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockBlock
            } as Response);

            const result = await reportApi.addBlock('report-1', {
                type: 'text',
                title: 'Block Title',
                position: 0
            });

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/reports/report-1/blocks',
                expect.objectContaining({
                    method: 'POST'
                })
            );
            expect(result).toEqual(mockBlock);
        });
    });

    describe('updateBlock', () => {
        it('should update block', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true
            } as Response);

            await reportApi.updateBlock('report-1', 'block-1', {
                content: 'Updated content'
            });

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/reports/report-1/blocks/block-1',
                expect.objectContaining({
                    method: 'PUT'
                })
            );
        });
    });

    describe('reorderBlocks', () => {
        it('should reorder blocks', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true
            } as Response);

            await reportApi.reorderBlocks('report-1', ['block-1', 'block-2', 'block-3']);

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/reports/report-1/reorder',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        blockOrder: ['block-1', 'block-2', 'block-3']
                    })
                })
            );
        });
    });

    describe('regenerateBlock', () => {
        it('should regenerate block with AI', async () => {
            const mockBlock = { id: 'block-1', content: 'Regenerated content' };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockBlock
            } as Response);

            const result = await reportApi.regenerateBlock('report-1', 'block-1', 'Make it better');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/reports/report-1/blocks/block-1/regenerate',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        instructions: 'Make it better'
                    })
                })
            );
            expect(result).toEqual(mockBlock);
        });
    });

    describe('generateReport', () => {
        it('should generate report with AI', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true
            } as Response);

            await reportApi.generateReport('report-1', 'Generate comprehensive report');

            expect(mockFetch).toHaveBeenCalledWith(
                '/api/reports/report-1/generate',
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({
                        instructions: 'Generate comprehensive report'
                    })
                })
            );
        });
    });
});



