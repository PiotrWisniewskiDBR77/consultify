import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(currentDir, '../../../../');
const configPath = path.resolve(repoRoot, 'scripts/testing/high-risk-areas.json');

describe('high-risk-areas schema contract', () => {
  it('defines a non-empty unique prefixes list with normalized paths', () => {
    const raw = fs.readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as { prefixes?: unknown };

    expect(Array.isArray(parsed.prefixes)).toBe(true);
    expect((parsed.prefixes || []).length).toBeGreaterThan(0);

    const prefixes = (parsed.prefixes || []) as unknown[];
    prefixes.forEach((entry) => {
      expect(typeof entry).toBe('string');
      const value = String(entry);
      expect(value.trim().length).toBeGreaterThan(0);
      expect(value.startsWith('./')).toBe(false);
      expect(value.startsWith('../')).toBe(false);
    });

    const normalized = prefixes.map((entry) => String(entry).trim());
    expect(new Set(normalized).size).toBe(normalized.length);
  });
});
