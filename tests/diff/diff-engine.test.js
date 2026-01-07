/**
 * Diff Engine Tests
 * Tests for object and text diffing
 * 
 * @module tests/diff/diff-engine.test.js
 */

import { describe, it, expect } from 'vitest';

// Object diff implementation
const createDiffEngine = () => {
    const diff = (a, b, path = '') => {
        const changes = [];

        // Handle null/undefined
        if (a === b) return changes;
        if (a === null || a === undefined || b === null || b === undefined) {
            changes.push({
                path: path || 'root',
                type: a === undefined || a === null ? 'added' : b === undefined || b === null ? 'removed' : 'changed',
                before: a,
                after: b,
            });
            return changes;
        }

        // Handle different types
        if (typeof a !== typeof b) {
            changes.push({ path: path || 'root', type: 'changed', before: a, after: b });
            return changes;
        }

        // Handle arrays
        if (Array.isArray(a) && Array.isArray(b)) {
            const maxLen = Math.max(a.length, b.length);
            for (let i = 0; i < maxLen; i++) {
                const itemPath = path ? `${path}[${i}]` : `[${i}]`;
                if (i >= a.length) {
                    changes.push({ path: itemPath, type: 'added', before: undefined, after: b[i] });
                } else if (i >= b.length) {
                    changes.push({ path: itemPath, type: 'removed', before: a[i], after: undefined });
                } else {
                    changes.push(...diff(a[i], b[i], itemPath));
                }
            }
            return changes;
        }

        // Handle objects
        if (typeof a === 'object' && typeof b === 'object') {
            const allKeys = new Set([...Object.keys(a), ...Object.keys(b)]);

            for (const key of allKeys) {
                const keyPath = path ? `${path}.${key}` : key;

                if (!(key in a)) {
                    changes.push({ path: keyPath, type: 'added', before: undefined, after: b[key] });
                } else if (!(key in b)) {
                    changes.push({ path: keyPath, type: 'removed', before: a[key], after: undefined });
                } else {
                    changes.push(...diff(a[key], b[key], keyPath));
                }
            }
            return changes;
        }

        // Primitives
        if (a !== b) {
            changes.push({ path: path || 'root', type: 'changed', before: a, after: b });
        }

        return changes;
    };

    return {
        diff,

        patch: (obj, changes) => {
            const result = JSON.parse(JSON.stringify(obj));

            for (const change of changes) {
                const parts = change.path.match(/[^.\[\]]+/g) || [];
                let current = result;

                for (let i = 0; i < parts.length - 1; i++) {
                    const key = isNaN(parts[i]) ? parts[i] : parseInt(parts[i]);
                    if (current[key] === undefined) {
                        current[key] = isNaN(parts[i + 1]) ? {} : [];
                    }
                    current = current[key];
                }

                const lastKey = isNaN(parts[parts.length - 1])
                    ? parts[parts.length - 1]
                    : parseInt(parts[parts.length - 1]);

                if (change.type === 'removed') {
                    if (Array.isArray(current)) {
                        current.splice(lastKey, 1);
                    } else {
                        delete current[lastKey];
                    }
                } else {
                    current[lastKey] = change.after;
                }
            }

            return result;
        },

        hasChanges: (a, b) => {
            return diff(a, b).length > 0;
        },

        summarize: (changes) => {
            const summary = { added: 0, removed: 0, changed: 0 };
            for (const change of changes) {
                summary[change.type]++;
            }
            return summary;
        },
    };
};

// Text diff implementation
const createTextDiff = () => {
    return {
        diff: (textA, textB) => {
            const linesA = textA.split('\n');
            const linesB = textB.split('\n');
            const changes = [];

            // Simple line-by-line diff
            const maxLen = Math.max(linesA.length, linesB.length);

            for (let i = 0; i < maxLen; i++) {
                if (linesA[i] === linesB[i]) {
                    changes.push({ type: 'unchanged', lineNumber: i + 1, value: linesA[i] });
                } else if (i >= linesA.length) {
                    changes.push({ type: 'added', lineNumber: i + 1, value: linesB[i] });
                } else if (i >= linesB.length) {
                    changes.push({ type: 'removed', lineNumber: i + 1, value: linesA[i] });
                } else {
                    changes.push({ type: 'removed', lineNumber: i + 1, value: linesA[i] });
                    changes.push({ type: 'added', lineNumber: i + 1, value: linesB[i] });
                }
            }

            return changes;
        },

        apply: (text, changes) => {
            const lines = text.split('\n');
            const result = [];

            let lineIndex = 0;
            for (const change of changes) {
                if (change.type === 'unchanged' || change.type === 'added') {
                    result.push(change.value);
                }
                if (change.type !== 'added') {
                    lineIndex++;
                }
            }

            return result.join('\n');
        },

        toUnifiedDiff: (filename, changes) => {
            const lines = [`--- a/${filename}`, `+++ b/${filename}`];

            for (const change of changes) {
                if (change.type === 'removed') {
                    lines.push(`-${change.value}`);
                } else if (change.type === 'added') {
                    lines.push(`+${change.value}`);
                } else {
                    lines.push(` ${change.value}`);
                }
            }

            return lines.join('\n');
        },
    };
};

describe('Diff Engine Tests', () => {
    let diffEngine;

    beforeEach(() => {
        diffEngine = createDiffEngine();
    });

    // ═══════════════════════════════════════════════════════════════════
    // OBJECT DIFF
    // ═══════════════════════════════════════════════════════════════════

    describe('Object Diff', () => {
        it('should detect no changes', () => {
            const changes = diffEngine.diff({ a: 1 }, { a: 1 });
            expect(changes).toEqual([]);
        });

        it('should detect added properties', () => {
            const changes = diffEngine.diff({ a: 1 }, { a: 1, b: 2 });

            expect(changes.length).toBe(1);
            expect(changes[0].type).toBe('added');
            expect(changes[0].path).toBe('b');
        });

        it('should detect removed properties', () => {
            const changes = diffEngine.diff({ a: 1, b: 2 }, { a: 1 });

            expect(changes.length).toBe(1);
            expect(changes[0].type).toBe('removed');
            expect(changes[0].path).toBe('b');
        });

        it('should detect changed properties', () => {
            const changes = diffEngine.diff({ a: 1 }, { a: 2 });

            expect(changes.length).toBe(1);
            expect(changes[0].type).toBe('changed');
            expect(changes[0].before).toBe(1);
            expect(changes[0].after).toBe(2);
        });

        it('should diff nested objects', () => {
            const changes = diffEngine.diff(
                { user: { name: 'John', age: 30 } },
                { user: { name: 'Jane', age: 30 } }
            );

            expect(changes.length).toBe(1);
            expect(changes[0].path).toBe('user.name');
        });

        it('should diff arrays', () => {
            const changes = diffEngine.diff([1, 2, 3], [1, 2, 4]);

            expect(changes.length).toBe(1);
            expect(changes[0].path).toBe('[2]');
        });

        it('should detect array additions', () => {
            const changes = diffEngine.diff([1, 2], [1, 2, 3]);

            expect(changes.some(c => c.type === 'added')).toBe(true);
        });

        it('should detect array removals', () => {
            const changes = diffEngine.diff([1, 2, 3], [1, 2]);

            expect(changes.some(c => c.type === 'removed')).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // PATCH
    // ═══════════════════════════════════════════════════════════════════

    describe('patch', () => {
        it('should apply changes', () => {
            const original = { a: 1, b: 2 };
            const changes = [
                { path: 'a', type: 'changed', before: 1, after: 10 },
                { path: 'c', type: 'added', after: 3 },
            ];

            const result = diffEngine.patch(original, changes);

            expect(result.a).toBe(10);
            expect(result.c).toBe(3);
        });

        it('should apply removals', () => {
            const original = { a: 1, b: 2 };
            const changes = [{ path: 'b', type: 'removed', before: 2 }];

            const result = diffEngine.patch(original, changes);

            expect(result.b).toBeUndefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // HAS CHANGES
    // ═══════════════════════════════════════════════════════════════════

    describe('hasChanges', () => {
        it('should return false for identical objects', () => {
            expect(diffEngine.hasChanges({ a: 1 }, { a: 1 })).toBe(false);
        });

        it('should return true for different objects', () => {
            expect(diffEngine.hasChanges({ a: 1 }, { a: 2 })).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // SUMMARIZE
    // ═══════════════════════════════════════════════════════════════════

    describe('summarize', () => {
        it('should summarize changes', () => {
            const changes = diffEngine.diff(
                { a: 1, b: 2 },
                { a: 10, c: 3 }
            );

            const summary = diffEngine.summarize(changes);

            expect(summary.added).toBe(1);
            expect(summary.removed).toBe(1);
            expect(summary.changed).toBe(1);
        });
    });
});

describe('Text Diff Tests', () => {
    let textDiff;

    beforeEach(() => {
        textDiff = createTextDiff();
    });

    // ═══════════════════════════════════════════════════════════════════
    // DIFF
    // ═══════════════════════════════════════════════════════════════════

    describe('diff', () => {
        it('should detect unchanged lines', () => {
            const changes = textDiff.diff('hello\nworld', 'hello\nworld');

            expect(changes.every(c => c.type === 'unchanged')).toBe(true);
        });

        it('should detect changed lines', () => {
            const changes = textDiff.diff('hello', 'goodbye');

            expect(changes.some(c => c.type === 'removed')).toBe(true);
            expect(changes.some(c => c.type === 'added')).toBe(true);
        });

        it('should detect added lines', () => {
            const changes = textDiff.diff('line1', 'line1\nline2');

            expect(changes.some(c => c.type === 'added' && c.value === 'line2')).toBe(true);
        });

        it('should detect removed lines', () => {
            const changes = textDiff.diff('line1\nline2', 'line1');

            expect(changes.some(c => c.type === 'removed' && c.value === 'line2')).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════
    // TO UNIFIED DIFF
    // ═══════════════════════════════════════════════════════════════════

    describe('toUnifiedDiff', () => {
        it('should generate unified diff format', () => {
            const changes = textDiff.diff('hello', 'goodbye');
            const unified = textDiff.toUnifiedDiff('file.txt', changes);

            expect(unified).toContain('--- a/file.txt');
            expect(unified).toContain('+++ b/file.txt');
            expect(unified).toContain('-hello');
            expect(unified).toContain('+goodbye');
        });
    });
});
