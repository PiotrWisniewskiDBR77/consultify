/**
 * Manual mock for server/database.js
 * preventing real DB connection
 */

// Since globals: true in vitest config, vi is available globally
const mockPrepareRun = vi.fn();
const mockFinalize = vi.fn();

const mockPrepare = vi.fn(() => ({
    run: mockPrepareRun,
    finalize: mockFinalize
}));

const mockRun = vi.fn((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    if (callback) callback.call({ changes: 1 }, null);
});

const mockAll = vi.fn((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    if (callback) callback(null, []);
});

const mockGet = vi.fn((sql, params, cb) => {
    const callback = typeof params === 'function' ? params : cb;
    if (callback) callback(null, {});
});

const db = {
    prepare: mockPrepare,
    run: mockRun,
    all: mockAll,
    get: mockGet,
    serialize: vi.fn((cb) => cb && cb()),
    // Expose spies for assertions
    _mocks: {
        prepare: mockPrepare,
        run: mockRun,
        all: mockAll,
        get: mockGet,
        prepareRun: mockPrepareRun,
        finalize: mockFinalize
    }
};

module.exports = db;
