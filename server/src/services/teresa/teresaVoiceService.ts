/**
 * Voice entry point for Teresa notes.
 *
 * transcript -> draft -> preview -> (human confirms) -> commit, through the
 * SAME `teresaKernel.propose`/`commit` path as the text/button routes — no
 * second state model, no parallel "voice note" table. The only thing this
 * module adds is turning a transcript string into a `TeresaIntent` for the
 * `summarize_response_without_invention` capability.
 *
 * REAL AUDIO IS NOT VERIFIED IN THIS SLICE. There is no microphone/STT
 * pipeline reachable from this environment. `REAL_AUDIO_NOT_VERIFIED` is
 * exported so callers/tests can assert this honestly instead of a faked
 * pass. What IS verified end-to-end here is the transcript -> draft ->
 * preview -> confirm -> commit path, using a supplied transcript string in
 * place of live STT output.
 */
import type { TeresaCommitRequest, TeresaCommitResult, TeresaPreview } from '../../../../src/method-core/contracts/teresa';
import type { TeresaSwotSessionSnapshot } from './teresaCapabilities';
import { commit, propose, type TeresaCommitContext } from './teresaKernel';

export const REAL_AUDIO_NOT_VERIFIED = true as const;

export interface VoiceDraftRequest {
  transcript: string;
  sessionId: string;
  actorUserId: string;
  unitId?: string;
}

/** transcript -> draft -> preview. Routes straight into the kernel; produces no state of its own. */
export async function draftNoteFromTranscript(
  req: VoiceDraftRequest,
  session: TeresaSwotSessionSnapshot
): Promise<TeresaPreview> {
  return propose(
    {
      capabilityId: 'summarize_response_without_invention',
      sessionId: req.sessionId,
      unitId: req.unitId,
      utterance: req.transcript,
      invokedBy: 'conversation',
      actorUserId: req.actorUserId,
    },
    session
  );
}

/** Confirmation -> commit, through the identical kernel entry point the button/chat routes use. */
export async function confirmVoiceNote(
  request: TeresaCommitRequest,
  ctx: TeresaCommitContext
): Promise<TeresaCommitResult> {
  return commit(request, ctx);
}
