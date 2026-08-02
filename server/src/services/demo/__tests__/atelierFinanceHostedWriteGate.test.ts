/**
 * FIN-005 P1-A #4 / P1-B #1 — the two gates the dedicated command applies to a
 * HOSTED `--write`, and the wiring that decides when they apply.
 *
 * ===========================================================================
 * WHY THE HOST DECIDES
 * ===========================================================================
 * Both hazards are hosted-only, and saying so precisely is what keeps the local
 * DB-backed suites runnable without a mounted volume:
 *
 *   - a lagging READ REPLICA exists on a deployment, not on a laptop. The
 *     decisive-read proof is still COMPUTED locally (it is cheap and it catches
 *     a pool pointed somewhere silly), but it is only a hard refusal where a
 *     replica can actually exist;
 *   - an EPHEMERAL filesystem is what a container has. A local run writes its
 *     hold next to the repository and the operator can read it tomorrow.
 *
 * `isHostedTarget` is therefore load-bearing, and it is asserted here rather
 * than reasoned about: an over-broad answer would refuse every local run, and an
 * under-broad one would let a Railway write through without a volume — which is
 * the whole defect.
 *
 * ===========================================================================
 * HOW THIS WAS PROVED RED
 * ===========================================================================
 * `isHostedTarget` and `requireDurableOperatorHoldStorage` did not exist before
 * this packet, so every case fails against the previous build with a module
 * resolution error. The behavioural claim that survives a rename — "a hosted
 * write refuses when the volume is only DECLARED" — was checked by relaxing the
 * gate to `if (!storageDir && !railwayDir)` (i.e. dropping the mount check and
 * the fsync probe): `refuses a hosted write when the volume is only declared`
 * then reports `ok: true` and the refusal disappears.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isHostedTarget } from '../../../../scripts/fin005-seed-atelier-finance.js';
import { requireDurableOperatorHoldStorage } from '../atelierFinanceOperatorHold.js';

describe('FIN-005 — which targets are HOSTED', () => {
  it('treats loopback and unset as local', () => {
    for (const host of ['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0', '', '  ']) {
      expect(isHostedTarget(host), `${host || '<empty>'} must be local`).toBe(false);
    }
  });

  it('treats every real host as hosted — including the demo and production proxies', () => {
    for (const host of [
      'trolley.proxy.rlwy.net',
      'centerbeam.proxy.rlwy.net',
      'containers-us-west-1.railway.app',
      '10.0.0.4',
      'db.internal',
    ]) {
      expect(isHostedTarget(host), `${host} must be hosted`).toBe(true);
    }
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(isHostedTarget('  LOCALHOST ')).toBe(false);
    expect(isHostedTarget(' TROLLEY.proxy.rlwy.net ')).toBe(true);
  });
});

describe('FIN-005 P1-B #1 — the hosted durability gate the command applies', () => {
  let scratch: string;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'fin005-hosted-'));
    for (const key of ['ATELIER_FINANCE_HOLD_DIR', 'STORAGE_DIR', 'RAILWAY_VOLUME_MOUNT_PATH']) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    fs.rmSync(scratch, { recursive: true, force: true, maxRetries: 3 });
  });

  it('refuses a hosted write when the volume is only declared, and accepts it when it is real', () => {
    const volume = path.join(scratch, 'data');
    fs.mkdirSync(volume, { recursive: true });
    process.env.STORAGE_DIR = volume;

    const declaredOnly = requireDurableOperatorHoldStorage();
    expect(declaredOnly.ok, declaredOnly.reason).toBe(false);
    expect(declaredOnly.reason).toMatch(/does not look like a mounted volume/);

    const reallyMounted = requireDurableOperatorHoldStorage({
      stat: (target: string) => ({ dev: path.resolve(target) === volume ? 123 : 1 }),
    });
    expect(reallyMounted.ok, reallyMounted.reason).toBe(true);
    // The verdict names WHERE the hold will live, so the refusal message and the
    // preflight report point at the same directory an operator will look in.
    expect(reallyMounted.dir).toBe(path.join(volume, 'fin005-operator-holds'));
  });
});
