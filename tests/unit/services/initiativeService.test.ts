/**
 * InitiativeService Tests
 * 
 * Tests for initiative service API calls.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InitiativeService } from '../../../services/initiativeService';
import { Api } from '../../../services/api';

// Mock Api
vi.mock('../../../services/api', () => ({
    Api: {
        get: vi.fn()
    }
}));

describe('InitiativeService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getAll', () => {
        it('should fetch all initiatives', async () => {
            const mockInitiatives = [
                { id: 'init-1', title: 'Initiative 1' },
                { id: 'init-2', title: 'Initiative 2' }
            ];

            vi.mocked(Api.get).mockResolvedValue(mockInitiatives);

            const result = await InitiativeService.getAll();

            expect(Api.get).toHaveBeenCalledWith('/initiatives');
            expect(result).toEqual(mockInitiatives);
        });

        it('should handle errors', async () => {
            const error = new Error('Network error');
            vi.mocked(Api.get).mockRejectedValue(error);

            await expect(InitiativeService.getAll()).rejects.toThrow('Network error');
        });
    });

    describe('getById', () => {
        it('should fetch initiative by ID', async () => {
            const mockInitiative = { id: 'init-1', title: 'Initiative 1' };

            vi.mocked(Api.get).mockResolvedValue(mockInitiative);

            const result = await InitiativeService.getById('init-1');

            expect(Api.get).toHaveBeenCalledWith('/initiatives/init-1');
            expect(result).toEqual(mockInitiative);
        });

        it('should handle errors', async () => {
            const error = new Error('Not found');
            vi.mocked(Api.get).mockRejectedValue(error);

            await expect(InitiativeService.getById('invalid-id')).rejects.toThrow('Not found');
        });
    });
});









