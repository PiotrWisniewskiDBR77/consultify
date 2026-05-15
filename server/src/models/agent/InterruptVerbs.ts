export type RunState =
  | 'idle'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'aborted';

export type InterruptVerb =
  | 'pause'
  | 'resume'
  | 'cancel'
  | 'skip'
  | 'redo'
  | 'retry'
  | 'reset'
  | 'rewind'
  | 'abort';

export type CompensationRecord = {
  readonly kind: 'compensate';
  readonly txnId: string;
};

export type NextStateDecision =
  | { readonly reason: 'illegal'; readonly nextState: RunState }
  | { readonly reason: 'ok'; readonly nextState: RunState };

export function assertCompensationImpliedByVerb(
  verb: InterruptVerb,
  record?: CompensationRecord | null
): void {
  if (verb === 'abort' && !record) {
    throw new Error('Abort requires a compensation record');
  }
}

export function applyInterrupt(current: RunState, verb: InterruptVerb): NextStateDecision {
  switch (verb) {
    case 'pause':
      if (current !== 'running') return { reason: 'illegal', nextState: current };
      return { reason: 'ok', nextState: 'paused' };
    case 'resume':
      if (current !== 'paused') return { reason: 'illegal', nextState: current };
      return { reason: 'ok', nextState: 'running' };
    case 'cancel':
      if (current === 'completed' || current === 'failed')
        return { reason: 'illegal', nextState: current };
      return { reason: 'ok', nextState: 'cancelled' };
    case 'skip':
      if (current !== 'running' && current !== 'paused') {
        return { reason: 'illegal', nextState: current };
      }
      return { reason: 'ok', nextState: 'running' };
    case 'redo':
      if (current !== 'completed' && current !== 'failed' && current !== 'cancelled') {
        return { reason: 'illegal', nextState: current };
      }
      return { reason: 'ok', nextState: 'running' };
    case 'retry':
      if (current !== 'failed' && current !== 'cancelled') {
        return { reason: 'illegal', nextState: current };
      }
      return { reason: 'ok', nextState: 'running' };
    case 'reset':
      if (current === 'running') return { reason: 'illegal', nextState: current };
      return { reason: 'ok', nextState: 'idle' };
    case 'rewind':
      if (
        current !== 'running' &&
        current !== 'paused' &&
        current !== 'completed' &&
        current !== 'failed' &&
        current !== 'cancelled'
      ) {
        return { reason: 'illegal', nextState: current };
      }
      return { reason: 'ok', nextState: 'paused' };
    case 'abort':
      if (current === 'completed' || current === 'failed')
        return { reason: 'illegal', nextState: current };
      return { reason: 'ok', nextState: 'aborted' };
  }
}
