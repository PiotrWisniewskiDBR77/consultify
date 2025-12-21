/**
 * Storage Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests multi-tenant file isolation, path security, and storage operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { testOrganizations, testProjects } from '../../fixtures/testData.js';

describe('StorageService', () => {
    let StorageService;
    let mockFs;
    let mockPath;

    beforeEach(async () => {
        vi.resetModules();
        
        // Create mock implementations
        mockFs = {
            existsSync: vi.fn().mockReturnValue(true),
            mkdirSync: vi.fn(),
            promises: {
                mkdir: vi.fn().mockResolvedValue(undefined),
                rename: vi.fn().mockResolvedValue(undefined),
                stat: vi.fn().mockResolvedValue({ size: 1024, birthtime: new Date() }),
                readdir: vi.fn().mockResolvedValue([]),
                unlink: vi.fn().mockResolvedValue(undefined)
            }
        };

        mockPath = {
            resolve: (...args) => args.join('/'),
            join: (...args) => args.filter(Boolean).join('/'),
            basename: (p) => p.split('/').pop(),
            sep: '/'
        };

        // Import fresh copy of the service
        const module = await import('../../../server/services/storageService.js');
        StorageService = module.default || module;
        
        // Inject dependencies
        StorageService.setDependencies({
            fs: mockFs,
            path: mockPath,
            uuidv4: () => 'mock-uuid-1234',
            basePath: '/test/uploads'
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('getIsolatedPath()', () => {
        it('should generate isolated path for organization and project', () => {
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const type = 'knowledge';

            const result = StorageService.getIsolatedPath(orgId, projectId, type);

            expect(result).toContain(orgId);
            expect(result).toContain(projectId);
            expect(result).toContain(type);
        });

        it('should use "global" as project scope when projectId is null', () => {
            const orgId = testOrganizations.org1.id;
            const type = 'avatars';

            const result = StorageService.getIsolatedPath(orgId, null, type);

            expect(result).toContain('global');
        });

        it('should throw error when orgId is missing', () => {
            expect(() => {
                StorageService.getIsolatedPath(null, 'project-123', 'type');
            }).toThrow('Organization ID is required');
        });

        it('should default type to "global" when not provided', () => {
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;

            const result = StorageService.getIsolatedPath(orgId, projectId);

            expect(result).toContain('global');
        });
    });

    describe('storeFile()', () => {
        it('should move file to isolated storage', async () => {
            const tempPath = '/tmp/upload-123.txt';
            const orgId = testOrganizations.org1.id;
            const projectId = testProjects.project1.id;
            const type = 'knowledge';
            const filename = 'document.pdf';

            const result = await StorageService.storeFile(tempPath, orgId, projectId, type, filename);

            expect(mockFs.promises.mkdir).toHaveBeenCalled();
            expect(mockFs.promises.rename).toHaveBeenCalledWith(tempPath, expect.any(String));
            expect(result).toBeDefined();
        });

        it('should sanitize filename', async () => {
            const tempPath = '/tmp/file.txt';
            const orgId = testOrganizations.org1.id;
            const filename = 'My File (2024).pdf';

            await StorageService.storeFile(tempPath, orgId, null, 'type', filename);

            expect(mockFs.promises.rename).toHaveBeenCalled();
            const targetPath = mockFs.promises.rename.mock.calls[0][1];
            expect(targetPath).not.toContain(' ');
            expect(targetPath).not.toContain('(');
        });

        it('should handle special characters in filename', async () => {
            const tempPath = '/tmp/file.txt';
            const orgId = testOrganizations.org1.id;
            const filename = '../../etc/passwd';

            await StorageService.storeFile(tempPath, orgId, null, 'type', filename);

            const targetPath = mockFs.promises.rename.mock.calls[0][1];
            expect(targetPath).not.toContain('..');
        });
    });

    describe('getStorageUsage()', () => {
        it('should return storage usage for organization', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockFs.promises.readdir.mockResolvedValueOnce(['project1', 'project2']);
            mockFs.promises.readdir.mockResolvedValue(['file1.pdf', 'file2.pdf']);
            mockFs.promises.stat.mockResolvedValue({ size: 1024 });

            const result = await StorageService.getStorageUsage(orgId);

            expect(result).toHaveProperty('totalBytes');
            expect(result).toHaveProperty('fileCount');
        });

        it('should handle empty directories', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockFs.promises.readdir.mockResolvedValue([]);

            const result = await StorageService.getStorageUsage(orgId);

            expect(result.totalBytes).toBe(0);
            expect(result.fileCount).toBe(0);
        });

        it('should handle read errors gracefully', async () => {
            const orgId = testOrganizations.org1.id;
            
            mockFs.promises.readdir.mockRejectedValueOnce(new Error('Permission denied'));

            const result = await StorageService.getStorageUsage(orgId);

            expect(result.totalBytes).toBe(0);
        });
    });

    describe('Path Security', () => {
        it('should not allow path traversal in orgId', () => {
            expect(() => {
                StorageService.getIsolatedPath('../etc', 'project', 'type');
            }).toThrow();
        });

        it('should not allow path traversal in projectId', () => {
            const orgId = testOrganizations.org1.id;
            
            // This should not contain path traversal in the final result
            const result = StorageService.getIsolatedPath(orgId, '../secret', 'type');
            
            // The path should be sanitized
            expect(result).not.toMatch(/\.\.\//);
        });

        it('should enforce organization boundary', () => {
            const org1Path = StorageService.getIsolatedPath(testOrganizations.org1.id, null, 'type');
            const org2Path = StorageService.getIsolatedPath(testOrganizations.org2.id, null, 'type');

            expect(org1Path).not.toBe(org2Path);
            expect(org1Path).toContain(testOrganizations.org1.id);
            expect(org2Path).toContain(testOrganizations.org2.id);
        });
    });

    describe('File Operations', () => {
        it('should delete file from storage', async () => {
            const filePath = '/uploads/org-1/project-1/knowledge/file.pdf';
            
            await StorageService.deleteFile(filePath);

            expect(mockFs.promises.unlink).toHaveBeenCalledWith(filePath);
        });

        it('should get file info', async () => {
            const filePath = '/uploads/org-1/project-1/knowledge/file.pdf';
            const expectedStat = { size: 2048, birthtime: new Date() };
            mockFs.promises.stat.mockResolvedValueOnce(expectedStat);

            const result = await StorageService.getFileInfo(filePath);

            expect(result).toEqual(expectedStat);
        });

        it('should list files in directory', async () => {
            const dirPath = '/uploads/org-1/project-1/knowledge';
            const files = ['file1.pdf', 'file2.pdf'];
            mockFs.promises.readdir.mockResolvedValueOnce(files);

            const result = await StorageService.listFiles(dirPath);

            expect(result).toEqual(files);
        });
    });

    describe('Multi-tenant Isolation', () => {
        it('should not allow access across organization boundaries', () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            const path1 = StorageService.getIsolatedPath(org1Id, 'proj1', 'knowledge');
            const path2 = StorageService.getIsolatedPath(org2Id, 'proj1', 'knowledge');

            // Same project ID should result in different paths for different orgs
            expect(path1).not.toBe(path2);
            expect(path1).toContain(org1Id);
            expect(path2).toContain(org2Id);
        });

        it('should not leak files between organizations in usage calculation', async () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            // Mock different file lists for different orgs
            mockFs.promises.readdir
                .mockResolvedValueOnce(['file1.pdf']) // org1
                .mockResolvedValueOnce(['file2.pdf', 'file3.pdf']) // org2
                .mockResolvedValue([]);
            
            mockFs.promises.stat.mockResolvedValue({ size: 1024 });

            const usage1 = await StorageService.getStorageUsage(org1Id);
            
            // Clear mocks and set up for org2
            mockFs.promises.readdir.mockReset();
            mockFs.promises.readdir
                .mockResolvedValueOnce(['file2.pdf', 'file3.pdf'])
                .mockResolvedValue([]);
            
            const usage2 = await StorageService.getStorageUsage(org2Id);

            // Different orgs should have different file counts
            expect(usage1.fileCount).not.toBe(usage2.fileCount);
        });
    });
});
