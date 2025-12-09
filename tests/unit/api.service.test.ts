import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Api } from '../../services/api';

// Mock fetch
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('Api Service Unit Tests', () => {
    beforeEach(() => {
        fetchMock.mockClear();
        localStorage.clear();
    });

    it('login: should store token and return user on success', async () => {
        const mockUser = { id: '1', email: 'test@test.com' };
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ token: 'abc-123', user: mockUser }),
        });

        const user = await Api.login('test@test.com', 'password');

        expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/auth/login'), expect.any(Object));
        expect(localStorage.getItem('token')).toBe('abc-123');
        expect(user).toEqual(mockUser);
    });

    it('login: should throw error on failure', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            json: async () => ({ error: 'Invalid credentials' }),
        });

        await expect(Api.login('test@test.com', 'wrong')).rejects.toThrow('Invalid credentials');
    });

    it('getUsers: should send Authorization header', async () => {
        localStorage.setItem('token', 'valid-token');
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ([]),
        });

        await Api.getUsers();

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/users'),
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: 'Bearer valid-token'
                })
            })
        );
    });

    it('getLLMProviders: should return list', async () => {
        const mockProviders = [{ id: '1', name: 'GPT-4' }];
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => mockProviders,
        });

        const result = await Api.getLLMProviders();
        expect(result).toEqual(mockProviders);
    });

    it('indexKnowledgeFiles: should trigger indexing', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ message: 'Indexed', indexedCount: 5 }),
        });

        const res = await Api.indexKnowledgeFiles();
        expect(res.indexedCount).toBe(5);
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/knowledge/index'),
            expect.objectContaining({ method: 'POST' })
        );
    });

    // Test a void method
    it('saveSession: should post data', async () => {
        fetchMock.mockResolvedValueOnce({ ok: true });
        await Api.saveSession('u1', 'session' as any, { foo: 'bar' });
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/sessions'),
            expect.objectContaining({
                method: 'POST',
                body: expect.stringContaining('bar')
            })
        );
    });
});
