/**
 * Storage Service Tests
 * 
 * HIGH PRIORITY BUSINESS SERVICE - Must have 85%+ coverage
 * Tests multi-tenant file isolation, path security, and storage operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { testUsers, testOrganizations, testProjects } from '../../fixtures/testData.js';

const require = createRequire(import.meta.url);

// Mock fs module at module level
const mockFsPromises = {
    mkdir: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    stat: vi.fn().mockResolvedValue({
        size: 1024,
        birthtime: new Date()
    }),
    readdir: vi.fn().mockResolvedValue([]),
    unlink: vi.fn().mockResolvedValue(undefined)
};

vi.mock('fs', () => ({
    default: {
        existsSync: vi.fn(),
        mkdirSync: vi.fn(),
        promises: mockFsPromises
    },
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    promises: mockFsPromises
}));

vi.mock('path', () => ({
    default: {
        resolve: (...args) => args.join('/'),
        join: (...args) => args.join('/'),
        basename: (p) => p.split('/').pop(),
        sep: '/'
    },
    resolve: (...args) => args.join('/'),
    join: (...args) => args.join('/'),
    basename: (p) => p.split('/').pop(),
    sep: '/'
}));

describe('StorageService', () => {
    let StorageService;

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        
        StorageService = require('../../../server/services/storageService.js');
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

            mockFs.promises.mkdir.mockResolvedValue(undefined);
            mockFs.promises.rename.mockResolvedValue(undefined);

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

        it('should create directory recursively', async () => {
            const tempPath = '/tmp/file.txt';
            const orgId = testOrganizations.org1.id;

            await StorageService.storeFile(tempPath, orgId, null, 'type', 'file.txt');

            expect(mockFs.promises.mkdir).toHaveBeenCalledWith(
                expect.any(String),
                { recursive: true }
            );
        });
    });

    describe('softDeleteFile()', () => {
        it('should move file to trash folder', async () => {
            const currentPath = '/uploads/org-123/project-456/file.txt';
            const orgId = testOrganizations.org1.id;

            mockFs.existsSync.mockReturnValue(true);
            mockFs.promises.mkdir.mockResolvedValue(undefined);
            mockFs.promises.rename.mockResolvedValue(undefined);

            const result = await StorageService.softDeleteFile(currentPath, orgId);

            expect(result).toBe(true);
            expect(mockFs.promises.rename).toHaveBeenCalled();
            const trashPath = mockFs.promises.rename.mock.calls[0][1];
            expect(trashPath).toContain('.trash');
        });

        it('should return false when file does not exist', async () => {
            const currentPath = '/uploads/nonexistent.txt';
            const orgId = testOrganizations.org1.id;

            mockFs.existsSync.mockReturnValue(false);

            const result = await StorageService.softDeleteFile(currentPath, orgId);

            expect(result).toBe(false);
            expect(mockFs.promises.rename).not.toHaveBeenCalled();
        });

        it('should return false when path is null', async () => {
            const result = await StorageService.softDeleteFile(null, testOrganizations.org1.id);

            expect(result).toBe(false);
        });
    });

    describe('getFileStats()', () => {
        it('should return file stats when file exists', async () => {
            const filePath = '/uploads/org-123/file.txt';
            const mockStats = {
                size: 2048,
                birthtime: new Date('2024-01-01')
            };

            mockFs.promises.stat.mockResolvedValue(mockStats);

            const result = await StorageService.getFileStats(filePath);

            expect(result).toEqual(mockStats);
            expect(mockFs.promises.stat).toHaveBeenCalledWith(filePath);
        });

        it('should return null when file does not exist', async () => {
            const filePath = '/uploads/nonexistent.txt';

            mockFs.promises.stat.mockRejectedValue(new Error('ENOENT'));

            const result = await StorageService.getFileStats(filePath);

            expect(result).toBeNull();
        });
    });

    describe('getDirectorySize()', () => {
        it('should calculate directory size recursively', async () => {
            const dirPath = '/uploads/org-123';
            const mockEntries = [
                { name: 'file1.txt', isDirectory: () => false },
                { name: 'subdir', isDirectory: () => true }
            ];

            mockFs.promises.readdir.mockResolvedValueOnce(mockEntries);
            mockFs.promises.readdir.mockResolvedValueOnce([]); // subdir is empty
            mockFs.promises.stat.mockResolvedValue({ size: 1024 });

            const result = await StorageService.getDirectorySize(dirPath);

            expect(result).toBeGreaterThan(0);
            expect(mockFs.promises.readdir).toHaveBeenCalled();
        });

        it('should return 0 when directory does not exist', async () => {
            const dirPath = '/uploads/nonexistent';

            mockFs.promises.readdir.mockRejectedValue(new Error('ENOENT'));

            const result = await StorageService.getDirectorySize(dirPath);

            expect(result).toBe(0);
        });

        it('should handle nested directories', async () => {
            const dirPath = '/uploads/org-123';
            const mockEntries = [
                { name: 'subdir', isDirectory: () => true }
            ];
            const mockSubEntries = [
                { name: 'file.txt', isDirectory: () => false }
            ];

            mockFs.promises.readdir
                .mockResolvedValueOnce(mockEntries)
                .mockResolvedValueOnce(mockSubEntries);
            mockFs.promises.stat.mockResolvedValue({ size: 512 });

            const result = await StorageService.getDirectorySize(dirPath);

            expect(result).toBeGreaterThan(0);
        });
    });

    describe('getUsageByOrganization()', () => {
        it('should return storage usage for organization', async () => {
            const orgId = testOrganizations.org1.id;

            mockFs.promises.readdir.mockResolvedValue([]);

            const result = await StorageService.getUsageByOrganization(orgId);

            expect(typeof result).toBe('number');
            expect(mockFs.promises.readdir).toHaveBeenCalled();
        });
    });

    describe('getGlobalUsage()', () => {
        it('should return global usage stats with breakdown', async () => {
            const mockEntries = [
                { name: 'org-1', isDirectory: () => true },
                { name: 'org-2', isDirectory: () => true }
            ];

            mockFs.promises.readdir.mockResolvedValue(mockEntries);
            mockFs.promises.readdir.mockResolvedValue([]); // Empty subdirs
            mockFs.promises.stat.mockResolvedValue({ size: 1024 });

            const result = await StorageService.getGlobalUsage();

            expect(result).toHaveProperty('totalSize');
            expect(result).toHaveProperty('breakdown');
            expect(Array.isArray(result.breakdown)).toBe(true);
        });

        it('should handle missing base directory gracefully', async () => {
            mockFs.promises.readdir.mockRejectedValue(new Error('ENOENT'));

            const result = await StorageService.getGlobalUsage();

            expect(result).toHaveProperty('totalSize');
            expect(result).toHaveProperty('breakdown');
        });
    });

    describe('listFiles()', () => {
        it('should list all files in organization directory', async () => {
            const orgId = testOrganizations.org1.id;
            const mockEntries = [
                { name: 'file1.txt', isDirectory: () => false }
            ];

            mockFs.promises.readdir.mockResolvedValue(mockEntries);
            mockFs.promises.stat.mockResolvedValue({
                size: 1024,
                birthtime: new Date()
            });

            const result = await StorageService.listFiles(orgId);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should handle missing directory gracefully', async () => {
            const orgId = testOrganizations.org1.id;

            mockFs.promises.readdir.mockRejectedValue(new Error('ENOENT'));

            const result = await StorageService.listFiles(orgId);

            expect(Array.isArray(result)).toBe(true);
        });

        it('should include relative paths in file list', async () => {
            const orgId = testOrganizations.org1.id;
            const mockEntries = [
                { name: 'file.txt', isDirectory: () => false }
            ];

            mockFs.promises.readdir.mockResolvedValue(mockEntries);
            mockFs.promises.stat.mockResolvedValue({
                size: 1024,
                birthtime: new Date()
            });

            const result = await StorageService.listFiles(orgId);

            if (result.length > 0) {
                expect(result[0]).toHaveProperty('path');
                expect(result[0]).toHaveProperty('name');
                expect(result[0]).toHaveProperty('size');
            }
        });
    });

    describe('deleteFile()', () => {
        it('should delete file by relative path', async () => {
            const orgId = testOrganizations.org1.id;
            const relativePath = 'global/file.txt';

            mockFs.existsSync.mockReturnValue(true);
            mockFs.promises.unlink.mockResolvedValue(undefined);

            const result = await StorageService.deleteFile(orgId, relativePath);

            expect(result).toBe(true);
            expect(mockFs.promises.unlink).toHaveBeenCalled();
        });

        it('should throw error for invalid path (path traversal attempt)', async () => {
            const orgId = testOrganizations.org1.id;
            const relativePath = '../../../etc/passwd';

            await expect(
                StorageService.deleteFile(orgId, relativePath)
            ).rejects.toThrow('Security: Invalid file path');
        });

        it('should return false when file does not exist', async () => {
            const orgId = testOrganizations.org1.id;
            const relativePath = 'nonexistent.txt';

            mockFs.existsSync.mockReturnValue(false);

            const result = await StorageService.deleteFile(orgId, relativePath);

            expect(result).toBe(false);
            expect(mockFs.promises.unlink).not.toHaveBeenCalled();
        });
    });

    describe('Security & Multi-Tenant Isolation', () => {
        it('should prevent path traversal attacks', async () => {
            const orgId = testOrganizations.org1.id;
            const maliciousPath = '../../other-org/file.txt';

            await expect(
                StorageService.deleteFile(orgId, maliciousPath)
            ).rejects.toThrow('Security');
        });

        it('should isolate files by organization ID', () => {
            const org1Id = testOrganizations.org1.id;
            const org2Id = testOrganizations.org2.id;

            const path1 = StorageService.getIsolatedPath(org1Id, null, 'type');
            const path2 = StorageService.getIsolatedPath(org2Id, null, 'type');

            expect(path1).not.toBe(path2);
            expect(path1).toContain(org1Id);
            expect(path2).toContain(org2Id);
        });

        it('should isolate files by project within organization', () => {
            const orgId = testOrganizations.org1.id;
            const project1Id = testProjects.project1.id;
            const project2Id = testProjects.project2.id;

            const path1 = StorageService.getIsolatedPath(orgId, project1Id, 'type');
            const path2 = StorageService.getIsolatedPath(orgId, project2Id, 'type');

            expect(path1).not.toBe(path2);
            expect(path1).toContain(project1Id);
            expect(path2).toContain(project2Id);
        });
    });
});
