// Plain functions to allow spying in tests without requiring 'vitest' in source
const mockDb = {
    get: function (query, params, cb) {
        const callback = typeof params === 'function' ? params : cb;
        if (callback) callback(null, null);
    },
    all: function (query, params, cb) {
        const callback = typeof params === 'function' ? params : cb;
        if (callback) callback(null, []);
    },
    run: function () { },
    prepare: function () {
        return {
            run: function () { },
            finalize: function () { }
        };
    },
    serialize: function (cb) { if (cb) cb(); },
    exec: function (sql, cb) { if (cb) cb(null); }
};

module.exports = mockDb;
