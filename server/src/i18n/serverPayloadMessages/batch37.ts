import type { ServerPayloadMessage } from './index.js';

/** Stable nested outcomes captured by the DCF/FCFF outer message template. */
export const SERVER_PAYLOAD_MESSAGES_BATCH_37: readonly ServerPayloadMessage[] = [
  {
    en: "Job ${params.job.id} is 'succeeded' but has no committed compute_job_outputs row (data inconsistency) — refusing to report a false success for a duplicate request",
    pl: "Zadanie ${params.job.id} ma status 'succeeded', ale nie ma zatwierdzonego wiersza compute_job_outputs (niespójność danych) — odmowa zgłoszenia fałszywego sukcesu dla powtórzonego żądania",
  },
  {
    en: "Job ${params.job.id} (idempotency key already in use) is '${params.job.status}', not 'queued' or 'succeeded' — a duplicate compute request cannot resume it (original may still be running, or it is terminally failed/cancelled)",
    pl: "Zadanie ${params.job.id} (klucz idempotencji jest już używany) ma status '${params.job.status}', a nie 'queued' ani 'succeeded' — powtórzone żądanie obliczeń nie może go wznowić (pierwotne może nadal działać albo zakończyło się statusem 'failed'/'cancelled')",
  },
  {
    en: "Failed to self-claim job ${params.job.id} — row is no longer 'queued' (concurrent claim raced this call, or it went terminal between enqueue and claim)",
    pl: "Nie udało się przejąć zadania ${params.job.id} — wiersz nie ma już statusu 'queued' (równoległe przejęcie wyprzedziło to wywołanie albo zadanie osiągnęło stan końcowy między enqueue a claim)",
  },
];
