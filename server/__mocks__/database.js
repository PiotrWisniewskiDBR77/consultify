
import { vi } from 'vitest';

const db = {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    prepare: vi.fn(),
    serialize: vi.fn((cb) => cb && cb()),
    exec: vi.fn(),
};

// Handle both CJS and ESM consumers
export default db;
export const get = db.get;
export const all = db.all;
export const run = db.run;
export const prepare = db.prepare;
export const serialize = db.serialize;
export const exec = db.exec;
