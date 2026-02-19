import { request, type FullConfig } from '@playwright/test';

import { readTestSupportState } from '../_helpers/testSupportState';

const API_BASE_URL = process.env.E2E_API_URL || 'http://127.0.0.1:3001';

export default async function globalTeardown(_config: FullConfig) {
  const key = String(process.env.TEST_SUPPORT_KEY || 'local-test-support-key-change-me').trim();

  let state: ReturnType<typeof readTestSupportState> | null = null;
  try {
    state = readTestSupportState();
  } catch {
    return;
  }

  const req = await request.newContext({
    baseURL: API_BASE_URL,
    extraHTTPHeaders: { 'x-test-support-key': key },
  });

  await req.post('/api/test-support/cleanup', { data: { runId: state.runId } }).catch(() => {});
  await req.dispose();
}
