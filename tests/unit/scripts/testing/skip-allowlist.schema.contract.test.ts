import { describe, expect, it } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const allowlistPath = path.resolve(repoRoot, 'scripts/testing/skip-allowlist.json');

describe('skip allowlist schema contract', () => {
  it('has valid structure, entry types, and deterministic hygiene fields', () => {
    const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf-8')) as {
      version: number;
      entries: Array<{
        kind: string;
        filePattern: string;
        matchPattern?: string;
        reason: string;
        expiresOn: string;
      }>;
    };

    expect(typeof allowlist.version).toBe('number');
    expect(allowlist.version).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(allowlist.entries)).toBe(true);

    const pairSet = new Set<string>();
    for (const entry of allowlist.entries) {
      expect(entry.kind === 'skip' || entry.kind === 'only').toBe(true);
      expect(typeof entry.filePattern).toBe('string');
      expect(entry.filePattern.length).toBeGreaterThan(0);
      expect(typeof entry.reason).toBe('string');
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(entry.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(`${entry.expiresOn}T00:00:00.000Z`))).toBe(false);
      if (entry.matchPattern !== undefined) {
        expect(typeof entry.matchPattern).toBe('string');
        expect(entry.matchPattern.trim().length).toBeGreaterThan(0);
      }

      const key = `${entry.kind}|${entry.filePattern}`;
      expect(pairSet.has(key)).toBe(false);
      pairSet.add(key);
    }
  });
});

