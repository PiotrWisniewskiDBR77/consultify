/**
 * Card §B3 validators client (M13 Depth · Seria K · K1 FE).
 * Calls POST /initiatives/validate-card (advisory). Fail-open: any error → [].
 */
import { Api } from '@/services/api';

export interface CardValidationIssue {
  rule: string;
  message: string;
}

export async function validateCard(text: string, rules?: string[]): Promise<CardValidationIssue[]> {
  try {
    const res: any = await Api.post('/initiatives/validate-card', { text, rules });
    const data = res?.data ?? res;
    return Array.isArray(data?.issues) ? data.issues : [];
  } catch {
    return [];
  }
}
