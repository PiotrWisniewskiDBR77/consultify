import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sprawdzPare } from '../../../scripts/dev/odbior-zywo/luma-para.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'luma-para-'));
const jasnyPath = path.join(tmp, 'ekran.png');
const ciemnyPath = path.join(tmp, 'ekran__dark.png');

beforeAll(async () => {
  await sharp({ create: { width: 32, height: 32, channels: 3, background: '#f4f4f4' } }).png().toFile(jasnyPath);
  await sharp({ create: { width: 32, height: 32, channels: 3, background: '#242424' } }).png().toFile(ciemnyPath);
});

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

describe('luma-para', () => {
  it('przepuszcza prawdziwą parę jasny/ciemny', async () => {
    const wynik = await sprawdzPare(jasnyPath, ciemnyPath);
    expect(wynik.ok).toBe(true);
    expect(wynik.jasny).toBeGreaterThan(150);
    expect(wynik.ciemny).toBeLessThan(110);
    expect(wynik.roznica).toBeGreaterThanOrEqual(40);
  });

  it('dowód mutacyjny: ta sama ścieżka po obu stronach daje exit 1', () => {
    expect(() => execFileSync(process.execPath, [
      'scripts/dev/odbior-zywo/luma-para.mjs',
      jasnyPath,
      jasnyPath,
    ], { cwd: process.cwd(), stdio: 'pipe' })).toThrow(expect.objectContaining({ status: 1 }));
  });
});
