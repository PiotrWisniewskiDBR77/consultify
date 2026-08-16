export type OperationalAlertKind =
  | 'WRITE_FAILURE_RATE'
  | 'OUTBOX_OLDEST_AGE'
  | 'DB_SATURATION'
  | 'REPEATED_AUTH_DENIALS';

export interface CrossFlowWriteResult {
  correlationId: string;
  tenantId: string;
  actorId: string;
  sourceId: string;
  result: 'SUCCESS' | 'FAILURE';
  occurredAt?: number;
}

export interface OperationalAlert {
  kind: OperationalAlertKind;
  active: boolean;
  value: number;
  threshold: number;
  runbookId: 'OPS-OBS-001';
  detectedAt: string | null;
  recoveredAt: string | null;
  acknowledgedAt: string | null;
  correlationId: string | null;
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const TEN_MINUTES_MS = 10 * 60 * 1000;
const MAX_EVENTS = 10_000;
const AUTH_DENIAL_THRESHOLD = 5;

type TimedValue = { value: number; occurredAt: number; correlationId: string | null };
type AlertState = Omit<OperationalAlert, 'kind' | 'value' | 'threshold' | 'active'> & {
  active: boolean;
};

const initialAlertState = (): AlertState => ({
  active: false,
  detectedAt: null,
  recoveredAt: null,
  acknowledgedAt: null,
  correlationId: null,
  runbookId: 'OPS-OBS-001',
});

function safeIdentity(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > 128) return null;
  return /^[a-zA-Z0-9._:-]+$/.test(normalized) ? normalized : null;
}

export class OperationalAlertService {
  private writes: Array<Required<CrossFlowWriteResult>> = [];
  private outboxSamples: TimedValue[] = [];
  private dbSamples: TimedValue[] = [];
  private authDenials: TimedValue[] = [];
  private states: Record<OperationalAlertKind, AlertState> = {
    WRITE_FAILURE_RATE: initialAlertState(),
    OUTBOX_OLDEST_AGE: initialAlertState(),
    DB_SATURATION: initialAlertState(),
    REPEATED_AUTH_DENIALS: initialAlertState(),
  };

  constructor(private readonly now: () => number = Date.now) {}

  recordWrite(input: CrossFlowWriteResult): boolean {
    const correlationId = safeIdentity(input.correlationId);
    const tenantId = safeIdentity(input.tenantId);
    const actorId = safeIdentity(input.actorId);
    const sourceId = safeIdentity(input.sourceId);
    if (!correlationId || !tenantId || !actorId || !sourceId) return false;
    if (input.result !== 'SUCCESS' && input.result !== 'FAILURE') return false;

    const occurredAt = Number.isFinite(input.occurredAt) ? Number(input.occurredAt) : this.now();
    this.writes.push({ correlationId, tenantId, actorId, sourceId, result: input.result, occurredAt });
    this.writes = this.writes.slice(-MAX_EVENTS);
    return true;
  }

  recordOutboxOldestAge(ageMs: number, correlationId?: string): void {
    this.recordSample(this.outboxSamples, Math.max(0, ageMs), correlationId);
  }

  recordDbSaturation(percent: number, correlationId?: string): void {
    this.recordSample(this.dbSamples, Math.max(0, Math.min(100, percent)), correlationId);
  }

  recordAuthDenial(correlationId?: string): void {
    this.recordSample(this.authDenials, 1, correlationId);
  }

  evaluate(): OperationalAlert[] {
    const now = this.now();
    this.prune(now);
    const writeTotal = this.writes.length;
    const writeFailures = this.writes.filter((event) => event.result === 'FAILURE').length;
    const failureRate = writeTotal === 0 ? 0 : writeFailures / writeTotal;
    const outboxAge = this.outboxSamples.at(-1)?.value ?? 0;
    const sustainedDbSamples = this.dbSamples.filter((sample) => sample.occurredAt >= now - TEN_MINUTES_MS);
    const dbSaturation = sustainedDbSamples.length > 0
      ? Math.min(...sustainedDbSamples.map((sample) => sample.value))
      : 0;
    const authDenials = this.authDenials.length;

    return [
      this.transition('WRITE_FAILURE_RATE', failureRate >= 0.01 && writeTotal > 0, failureRate, 0.01, this.writes.at(-1)?.correlationId ?? null),
      this.transition('OUTBOX_OLDEST_AGE', outboxAge >= FIVE_MINUTES_MS, outboxAge, FIVE_MINUTES_MS, this.outboxSamples.at(-1)?.correlationId ?? null),
      this.transition(
        'DB_SATURATION',
        sustainedDbSamples.length >= 2 && sustainedDbSamples[0].occurredAt <= now - TEN_MINUTES_MS && dbSaturation >= 80,
        dbSaturation,
        80,
        sustainedDbSamples.at(-1)?.correlationId ?? null
      ),
      this.transition('REPEATED_AUTH_DENIALS', authDenials >= AUTH_DENIAL_THRESHOLD, authDenials, AUTH_DENIAL_THRESHOLD, this.authDenials.at(-1)?.correlationId ?? null),
    ];
  }

  acknowledgeRecovery(kind: OperationalAlertKind): boolean {
    const state = this.states[kind];
    if (state.active || !state.recoveredAt) return false;
    state.acknowledgedAt = new Date(this.now()).toISOString();
    return true;
  }

  private recordSample(target: TimedValue[], value: number, correlationId?: string): void {
    if (!Number.isFinite(value)) return;
    target.push({ value, occurredAt: this.now(), correlationId: safeIdentity(correlationId) });
    if (target.length > MAX_EVENTS) target.splice(0, target.length - MAX_EVENTS);
  }

  private prune(now: number): void {
    this.writes = this.writes.filter((event) => event.occurredAt >= now - FIVE_MINUTES_MS);
    this.outboxSamples = this.outboxSamples.filter((event) => event.occurredAt >= now - FIVE_MINUTES_MS);
    this.authDenials = this.authDenials.filter((event) => event.occurredAt >= now - FIVE_MINUTES_MS);
    this.dbSamples = this.dbSamples.filter((event) => event.occurredAt >= now - TEN_MINUTES_MS);
  }

  private transition(
    kind: OperationalAlertKind,
    active: boolean,
    value: number,
    threshold: number,
    correlationId: string | null
  ): OperationalAlert {
    const state = this.states[kind];
    const timestamp = new Date(this.now()).toISOString();
    if (active && !state.active) {
      state.active = true;
      state.detectedAt = timestamp;
      state.recoveredAt = null;
      state.acknowledgedAt = null;
      state.correlationId = correlationId;
    } else if (!active && state.active) {
      state.active = false;
      state.recoveredAt = timestamp;
    }
    return { kind, value, threshold, ...state };
  }
}

export const operationalAlerts = new OperationalAlertService();

export function getOperationalPrometheusMetrics(): string {
  return operationalAlerts
    .evaluate()
    .map((alert) => `consultify_operational_alert_active{kind="${alert.kind}",runbook="${alert.runbookId}"} ${alert.active ? 1 : 0}`)
    .join('\n');
}
