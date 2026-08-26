export type SignalSeverity = 'info' | 'warning' | 'critical' | 'blocker';
export type SignalDomain =
  | 'EXECUTION'
  | 'DECISION'
  | 'RESULTS'
  | 'FINANCE'
  | 'ASSESSMENT'
  | 'MEETINGS'
  | 'MATERIALS'
  | 'GOVERNANCE';
export type SignalOrigin = 'DETERMINISTIC' | 'AGGREGATED' | 'INTERPRETED';

export interface SignalDTO {
  key: string;
  type: string;
  title: string;
  body: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  severityRaw?: SignalSeverity | Uppercase<SignalSeverity>;
  createdAt: string;
  projectId: string | null;
  projectName: string | null;
  entityType: string;
  entityId: string;
  domain: SignalDomain;
  origin: SignalOrigin;
  source: {
    evidence: Array<{
      ref: string;
      refType: string;
      version: number | null;
      observedValue: string | number | null;
      observedAt: string;
    }>;
    ruleId: string;
    ruleVersion: number;
  };
  freshness: { lastObservedAt: string; runAt: string; nextRunAt: string | null };
  destination: {
    kind: string;
    route: string;
    params: Record<string, string>;
    permission: string;
    allowed: boolean | null;
  };
  provenance?: {
    provider?: string;
    model?: string;
    promptVersion?: number;
    templateVersion?: number;
    inputHash?: string;
    confidence?: string;
    basedOnSignalIds?: string[];
  };
  isMine: boolean;
  titleKey?: string;
  titleParams?: Record<string, unknown>;
  bodyKey?: string;
  bodyParams?: Record<string, unknown>;
  firstObservedAt: string;
  status: 'OPEN';
}

export interface SignalsFeedResponse {
  signals: SignalDTO[];
  nextCursor: string | null;
  producerEnabled?: boolean;
}
