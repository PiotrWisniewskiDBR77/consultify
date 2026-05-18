import fs from 'node:fs';

export type TestSupportState = {
  runId: string;
  organizationId: string;
  userId: string;
  token: string;
};

export const TEST_SUPPORT_STATE_PATH =
  process.env.E2E_TEST_SUPPORT_STATE_PATH || '.tmp/e2e/e2e-test-support.json';

export const STORAGE_STATE_PATH =
  process.env.E2E_STORAGE_STATE_PATH || '.tmp/e2e/e2e-storage-state.json';

export function readTestSupportState(): TestSupportState {
  const raw = fs.readFileSync(TEST_SUPPORT_STATE_PATH, 'utf8');
  const parsed = JSON.parse(raw) as TestSupportState;
  if (!parsed?.token || !parsed?.runId) {
    throw new Error(`Invalid test support state at ${TEST_SUPPORT_STATE_PATH}`);
  }
  return parsed;
}

export function getAuthHeader(): Record<string, string> {
  const s = readTestSupportState();
  return { Authorization: `Bearer ${s.token}` };
}

