// Manual mock for the database module used in unit tests
// This file will be automatically used by Vitest when a test imports
// '../../server/database' (relative to the test file) because it resides
// in the __mocks__ directory.

import { vi } from 'vitest';

const mockDb = {
    run: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue(undefined),
    all: vi.fn().mockResolvedValue([]),
    exec: vi.fn().mockResolvedValue({}),
    prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({}),
        get: vi.fn().mockResolvedValue(undefined),
        all: vi.fn().mockResolvedValue([]),
    }),
};

export default mockDb;
