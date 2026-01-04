/**
 * BaseService Tests
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IDatabase } from '../../../src/database/IDatabase.js';
import { BaseService } from '../../../src/services/BaseService.js';

// Mock implementation for testing
class TestService extends BaseService<{ id: string; name: string }> {
    async findById(id: string) {
        return this.queryOne<{ id: string; name: string }>('SELECT * FROM test WHERE id = ?', [id]);
    }

    async findMany() {
        return this.queryAll<{ id: string; name: string }>('SELECT * FROM test');
    }

    async create(data: Partial<{ id: string; name: string }>) {
        const id = data.id || 'test-id';
        await this.queryRun('INSERT INTO test (id, name) VALUES (?, ?)', [id, data.name || '']);
        return { id, name: data.name || '' } as { id: string; name: string };
    }

    async update(id: string, data: Partial<{ id: string; name: string }>) {
        await this.queryRun('UPDATE test SET name = ? WHERE id = ?', [data.name, id]);
        return { id, name: data.name || '' } as { id: string; name: string };
    }

    async delete(id: string) {
        await this.queryRun('DELETE FROM test WHERE id = ?', [id]);
        return true;
    }
}

describe('BaseService', () => {
    let mockDb: IDatabase;
    let service: TestService;

    beforeEach(() => {
        mockDb = {
            get: vi.fn(),
            all: vi.fn(),
            run: vi.fn(),
            exec: vi.fn(),
            serialize: vi.fn(),
            close: vi.fn(),
            query: vi.fn(),
        } as unknown as IDatabase;

        service = new TestService(mockDb);
    });

    it('should be instantiable', () => {
        expect(service).toBeInstanceOf(BaseService);
    });

    it('should have database instance', () => {
        expect((service as unknown as { db: IDatabase }).db).toBeDefined();
    });
});
