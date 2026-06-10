/**
 * Deliverables — lekki runtime: błędy domenowe kontraktu generacji.
 * Wydzielone, żeby gałęzie formatów (deck/doc/sheet) nie importowały się nawzajem.
 */

export type DeliverablesGenerationErrorCode =
  | 'not_implemented'
  | 'not_found'
  | 'invalid_state'
  | 'invalid_setup';

export class DeliverablesGenerationError extends Error {
  constructor(
    public readonly code: DeliverablesGenerationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'DeliverablesGenerationError';
  }
}
