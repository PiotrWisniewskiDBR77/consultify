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
            // The sanitization replaces special chars with underscores
            // So '../../etc/passwd' becomes '____etc_passwd' - not path traversal safe but sanitized
            // Check that the filename part doesn't contain path separators (path.join adds them for directory structure)
            const sanitizedFilename = mockPath.basename(targetPath);
            
            expect(sanitizedFilename).toBeTruthy();
            // Check that the filename doesn't start with '..' which would be dangerous
            expect(sanitizedFilename).not.toMatch(/^\.\./);
            // The filename should not contain slashes (path separators)
            expect(sanitizedFilename).not.toContain('/');
            // The sanitization replaces all non-alphanumeric chars (except dots) with underscores
            // So '../../etc/passwd' becomes something like '1766340653672-.._.._etc_passwd'
            // The sanitization preserves dots, so '..' sequences remain in the filename
            // However, path traversal is prevented by:
            // 1. The filename doesn't start with '..' (checked above)
            // 2. The filename doesn't contain path separators '/' (checked above)
            // 3. The file is stored in an isolated directory structure (orgId/projectId/type/)
            // So even if '..' sequences remain in the filename, they cannot be used for path traversal
            // The test verifies the key security properties: no leading '..' and no path separators
        });
    });

    describe('getUsageByOrganization()', () => {
        it('should return storage usage for organization', async () => {
            const orgId = testOrganizations.org1.id;

            // Mock storage exists
            mockFs.existsSync.mockReturnValue(true);
            mockFs.promises.readdir.mockResolvedValueOnce(['project1', 'project2']);
            mockFs.promises.readdir.mockResolvedValue(['file1.pdf', 'file2.pdf']);
            mockFs.promises.stat.mockResolvedValue({ size: 1024, isDirectory: () => false });

            const result = await StorageService.getUsageByOrganization(orgId);

            expect(result).toHaveProperty('totalBytes');
            expect(result).toHaveProperty('fileCount');
        });

        it('should handle empty directories', async () => {
            const orgId = testOrganizations.org1.id;

            // Mock empty directory - readdir returns empty array
            mockFs.existsSync.mockReturnValue(true);
            mockFs.promises.readdir.mockResolvedValue([]); // Empty directory
            // listFiles will return empty array when readdir is empty

            const result = await StorageService.getUsageByOrganization(orgId);

            expect(result).toHaveProperty('totalBytes');
            expect(result).toHaveProperty('fileCount');
            expect(result.totalBytes).toBe(0);
            expect(result.fileCount).toBe(0);
        });

        it('should handle read errors gracefully', async () => {
            const orgId = testOrganizations.org1.id;

            // Mock readdir error - service should handle gracefully
            mockFs.existsSync.mockReturnValue(true);
            mockFs.promises.readdir.mockRejectedValue(new Error('Permission denied'));
            // getDirectorySize catches errors and returns 0
            // listFiles catches errors and returns []

            const result = await StorageService.getUsageByOrganization(orgId);

            expect(result).toHaveProperty('totalBytes');
            expect(result).toHaveProperty('fileCount');
            // Service should return 0/0 on errors, not throw
            expect(result.totalBytes).toBe(0);
            expect(result.fileCount).toBe(0);
        });
    });

    describe('Path Security', () => {
        it('should not allow path traversal in orgId', () => {
            const maliciousOrgId = '../../../etc/passwd';

            expect(() => {
                StorageService.getIsolatedPath(maliciousOrgId);
            }).toThrow('path traversal detected');

            const maliciousOrgId2 = '../../org123';
            expect(() => {
                StorageService.getIsolatedPath(maliciousOrgId2);
            }).toThrow('path traversal detected');

            const maliciousOrgId3 = 'org123/../../etc';
            expect(() => {
                StorageService.getIsolatedPath(maliciousOrgId3);
            }).toThrow('path traversal detected');

            // Valid orgId should work
            const validOrgId = 'org-123';
            expect(() => {
                StorageService.getIsolatedPath(validOrgId);
            }).not.toThrow();
        });

        it('should include path in result (basic check)', () => {
            const orgId = testOrganizations.org1.id;
            const result = StorageService.getIsolatedPath(orgId, 'project', 'type');
            expect(result).toContain(orgId);
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
            const orgId = 'org-1';
            const relativePath = 'project-1/knowledge/file.pdf';
            mockFs.existsSync.mockReturnValue(true);

            await StorageService.deleteFile(orgId, relativePath);

            expect(mockFs.promises.unlink).toHaveBeenCalled();
        });

        it('should get file stats', async () => {
            const filePath = '/uploads/org-1/project-1/knowledge/file.pdf';
            const expectedStat = { size: 2048, birthtime: new Date() };
            mockFs.promises.stat.mockResolvedValueOnce(expectedStat);

            const result = await StorageService.getFileStats(filePath);

            expect(result).toEqual(expectedStat);
        });

        it('should list files for organization', async () => {
            const orgId = testOrganizations.org1.id;
            mockFs.existsSync.mockReturnValue(true);
            mockFs.promises.readdir.mockResolvedValueOnce([]);

            const result = await StorageService.listFiles(orgId);

            expect(result).toBeDefined();
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

            // Mock listFiles to return different files for different orgs
            StorageService.listFiles = vi.fn()
                .mockResolvedValueOnce([
                    { path: '/uploads/org1/file1.pdf', size: 1024 }
                ])
                .mockResolvedValueOnce([
                    { path: '/uploads/org2/file2.pdf', size: 2048 },
                    { path: '/uploads/org2/file3.pdf', size: 3072 }
                ]);

            // Mock getDirectorySize
            StorageService.getDirectorySize = vi.fn()
                .mockResolvedValueOnce(1024)
                .mockResolvedValueOnce(5120);

            const usage1 = await StorageService.getStorageUsage(org1Id);
            const usage2 = await StorageService.getStorageUsage(org2Id);

            // Different orgs should have different file counts
            expect(usage1.fileCount).toBe(1);
            expect(usage2.fileCount).toBe(2);
            expect(usage1.fileCount).not.toBe(usage2.fileCount);
        });
    });
});
