/**
 * feedbackTriage
 *
 * Pure helper functions used by the feedback route to:
 *  1. derive a cluster (bucket) from the route path,
 *  2. upgrade priority based on environment/signals,
 *  3. look up potential duplicate tickets by `signatureHash`.
 *
 * Keeping this as plain functions (no classes, no singletons) means it can be
 * unit-tested without a DB mock for (1) and (2), and (3) is a straight query.
 */

import { all as dbAll } from '../utils/DbPromise.js';
import { getTableColumns } from '../utils/dbSchema.js';

type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

interface ClusterRule {
  test: (path: string) => boolean;
  cluster: string;
}

const CLUSTER_RULES: ClusterRule[] = [
  { test: (p) => p.startsWith('/superadmin/users'), cluster: 'Superadmin Users' },
  { test: (p) => p.startsWith('/superadmin/feedback'), cluster: 'Superadmin Feedback' },
  { test: (p) => p.startsWith('/superadmin'), cluster: 'Superadmin' },
  { test: (p) => p.startsWith('/admin/billing'), cluster: 'Admin Billing' },
  { test: (p) => p.startsWith('/admin'), cluster: 'Admin' },
  { test: (p) => p.startsWith('/auth') || p === '/login' || p === '/register', cluster: 'Auth' },
  { test: (p) => p.startsWith('/chat') || p.startsWith('/ai'), cluster: 'AI Chat' },
  { test: (p) => p.startsWith('/interview'), cluster: 'Interview' },
  { test: (p) => p.startsWith('/my-work'), cluster: 'My Work' },
  { test: (p) => p.startsWith('/initiatives'), cluster: 'Initiatives' },
  { test: (p) => p.startsWith('/execution'), cluster: 'Execution' },
  { test: (p) => p.startsWith('/finance'), cluster: 'Finance' },
  { test: (p) => p.startsWith('/results'), cluster: 'Results' },
  { test: (p) => p.startsWith('/reports'), cluster: 'Reports' },
  { test: (p) => p.startsWith('/presentations'), cluster: 'Presentations' },
  { test: (p) => p.startsWith('/settings'), cluster: 'Settings' },
  { test: (p) => p.startsWith('/tools'), cluster: 'Tools' },
  { test: (p) => p.startsWith('/dashboard'), cluster: 'Dashboard' },
  { test: (p) => p.startsWith('/docs'), cluster: 'Docs' },
];

export function inferCluster(routePath: string | null | undefined): string | null {
  if (!routePath) return null;
  const path = String(routePath).split('?')[0].split('#')[0];
  for (const rule of CLUSTER_RULES) {
    try {
      if (rule.test(path)) return rule.cluster;
    } catch {
      // ignore bad rules
    }
  }
  return null;
}

export interface PriorityInputs {
  basePriority: TicketPriority;
  appEnv: string;
  type: string;
  severity: string | null;
  hasUncaughtError: boolean;
  duplicateCount: number;
}

const PRIORITY_ORDER: TicketPriority[] = ['low', 'medium', 'high', 'critical'];

function bump(current: TicketPriority, steps = 1): TicketPriority {
  const idx = Math.min(
    PRIORITY_ORDER.length - 1,
    Math.max(0, PRIORITY_ORDER.indexOf(current) + steps)
  );
  return PRIORITY_ORDER[idx];
}

export function inferPriorityForPipeline(input: PriorityInputs): TicketPriority {
  let priority = input.basePriority;

  const env = String(input.appEnv || '').toLowerCase();
  const severity = String(input.severity || '').toUpperCase();
  const isProd = env === 'production' || env === 'prod';

  if (isProd && String(input.type).toUpperCase() === 'BUG') {
    priority = bump(priority, 1);
  }

  if (input.hasUncaughtError) {
    priority = bump(priority, 1);
  }

  if (severity === 'CRITICAL') {
    priority = 'critical';
  }

  if (input.duplicateCount >= 3) {
    priority = bump(priority, 1);
  }

  return priority;
}

export interface DuplicateCandidate {
  id: string;
  title: string | null;
  status: string | null;
  createdAt: string | null;
}

export async function findDuplicateCandidates(
  signatureHash: string,
  limit = 5
): Promise<DuplicateCandidate[]> {
  if (!signatureHash || typeof signatureHash !== 'string') return [];
  const cols = await getTableColumns('feedback_items');
  if (!cols.has('metadata_json')) return [];
  try {
    const rows = await dbAll<{
      id: string;
      title: string | null;
      status: string | null;
      created_at: string | null;
      metadata_json: string | null;
    }>(
      `
        SELECT id, title, status, created_at, metadata_json
        FROM feedback_items
        WHERE metadata_json IS NOT NULL
          AND metadata_json LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `,
      [`%"signatureHash":"${signatureHash}"%`, Math.max(1, Math.min(20, limit))]
    );

    return (rows || []).map((row) => ({
      id: String(row.id),
      title: row.title ? String(row.title) : null,
      status: row.status ? String(row.status) : null,
      createdAt: row.created_at ? String(row.created_at) : null,
    }));
  } catch {
    return [];
  }
}
