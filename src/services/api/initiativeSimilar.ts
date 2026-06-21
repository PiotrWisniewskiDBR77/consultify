/**
 * Initiative duplicate-detection client (M13 Depth · Seria C · C1 FE).
 * Calls POST /initiatives/similar-check (advisory). Fail-open: any error → [].
 */
import { Api } from '@/services/api';

export interface SimilarInitiative {
  id: string;
  name: string;
  status: string | null;
  score: number;
}

export async function checkSimilarInitiatives(
  name: string,
  summary?: string
): Promise<SimilarInitiative[]> {
  try {
    const res: any = await Api.post('/initiatives/similar-check', { name, summary });
    const data = res?.data ?? res;
    return Array.isArray(data?.similar) ? data.similar : [];
  } catch {
    return [];
  }
}
