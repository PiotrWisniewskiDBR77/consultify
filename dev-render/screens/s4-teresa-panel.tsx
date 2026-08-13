/**
 * S4 ISOLATED TEST HARNESS — dedicated dev-render screen for the two S4
 * components (`TeresaPreviewPanel`, `VoiceAnswerChannel`), mounted directly
 * with mock data — no login, no backend, per CLAUDE.md #7.
 *
 * Separate from the A5 `method-workspace.tsx` harness (used for
 * 01-preview-diff.png / 02-statement-kinds.png, which already show these
 * components inside the real shell) because the remaining required
 * screenshots need STATES that harness's fixed mock data does not have:
 *   - a preview whose quality.verdict is `invalid` (03-quality-invalid.png)
 *   - VoiceAnswerChannel's draft-preview state, reached by feeding a FAKE
 *     final transcript through a stubbed `SpeechRecognition` — a real
 *     `onresult` event through the REAL `useUniversalVoice` hook and REAL
 *     `VoiceAnswerChannel` component, not a hand-drawn mockup
 *     (04-voice-draft.png)
 *   - the honest-degradation state with `navigator.mediaDevices` absent
 *     (05-voice-degraded.png)
 *
 * URL: ?screen=s4-teresa-panel&variant=quality-invalid|voice|theme=light|dark
 */
import React from 'react';

import { TeresaPreviewPanel } from '../../src/components/method-workspace/TeresaPreviewPanel';
import { VoiceAnswerChannel } from '../../src/components/method-workspace/VoiceAnswerChannel';
import type { TeresaPreview } from '../../src/method-core/contracts';

const params = new URLSearchParams(window.location.search);
const variant = params.get('variant') || 'quality-invalid';

function makeInvalidPreview(): TeresaPreview {
  return {
    previewId: 'preview-invalid-demo',
    intent: {
      capabilityId: 'draft_score_proposal',
      sessionId: 'session-demo',
      unitId: 'unit-data-quality',
      level: 3,
      invokedBy: 'local_action',
      actorUserId: 'user-demo',
    },
    statements: [
      { kind: 'respondent_declaration', text: 'Dane klientów są przechowywane w CRM.', sourceRefs: [] },
      { kind: 'decision_required', text: 'Brak wystarczających informacji, aby ocenić poziom 3.', sourceRefs: [] },
    ],
    proposedChanges: [{ target: 'score_proposal', targetId: 'unit-data-quality', before: null, after: 3 }],
    // The point of this screenshot: quality gate failed — Teresa did not
    // name attributes, did not list missing evidence, and invented no
    // number, but STILL cannot name unit/level with confidence, so the
    // preview quality-gates to invalid instead of being silently accepted.
    quality: {
      verdict: 'invalid',
      failedChecks: ['names_attributes', 'lists_missing_evidence', 'states_limitations', 'no_unsupported_claim'],
    },
    createdAt: '2026-08-13T10:00:00.000Z',
    expiresAt: '2026-08-14T10:00:00.000Z',
  };
}

const SIX_QUESTIONS = {
  whereAreWe: 'Wywiad dla „Jakość danych" — poziom 3 z 5.',
  whatMattersNow: 'Ustalenie, czy dane klientów mają jeden potwierdzony właściciel.',
  why: 'Bez tego poziom 3 nie da się uczciwie ocenić.',
  whatIsMissing: 'Zbyt mało informacji, by nazwać atrybuty i dowody.',
  nextSafeAction: 'Zapytaj o właściciela danych, zanim ocenisz poziom.',
};

function QualityInvalidVariant(): React.ReactElement {
  return (
    <div style={{ maxWidth: 420, padding: 24 }}>
      <TeresaPreviewPanel
        sixQuestions={SIX_QUESTIONS}
        proposalQueue={[makeInvalidPreview()]}
        onCommit={() => {}}
        onTakeLead={() => {}}
        onLetMeWorkManually={() => {}}
        mode="guided_manual"
      />
    </div>
  );
}

/**
 * Stubs `window.SpeechRecognition` BEFORE `VoiceAnswerChannel` mounts and
 * auto-fires a scripted FINAL result once the toggle is clicked — this
 * drives `useUniversalVoice`'s REAL `recognition.onresult` handler
 * (src/hooks/useUniversalVoice.ts:360), so the resulting draft-preview UI is
 * the product of the real hook + real component, with only the browser
 * Speech API (unavailable to a headless harness) replaced.
 */
class FakeSpeechRecognition extends EventTarget {
  continuous = true;
  interimResults = true;
  lang = 'pl-PL';
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  onend: (() => void) | null = null;
  start() {
    // Interim first (rendered live, never written), then final (becomes the draft).
    setTimeout(() => {
      this.onresult?.({
        resultIndex: 0,
        results: [[{ transcript: 'Proces jest opisany w dwóch' }]].map((r) =>
          Object.assign(r, { isFinal: false })
        ),
      });
    }, 150);
    setTimeout(() => {
      this.onresult?.({
        resultIndex: 0,
        results: [[{ transcript: 'Proces jest opisany w dwóch dokumentach i używany przez cały zespół.' }]].map(
          (r) => Object.assign(r, { isFinal: true })
        ),
      });
    }, 500);
  }
  stop() {
    this.onend?.();
  }
}

function VoiceDraftVariant(): React.ReactElement {
  React.useEffect(() => {
    (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeSpeechRecognition;
  }, []);
  const [answerText, setAnswerText] = React.useState('');
  return (
    <div style={{ width: 620, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-secondary)' }}>Twoja odpowiedź</label>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <textarea
          value={answerText}
          onChange={(e) => setAnswerText(e.target.value)}
          rows={3}
          style={{ flex: '1 1 auto', minWidth: 280, borderRadius: 8, border: '1px solid var(--c-border)', padding: 10, fontSize: 14 }}
          placeholder="Opisz sytuację własnymi słowami…"
        />
        <VoiceAnswerChannel
          onTranscript={(text, isFinal) => {
            if (isFinal) setAnswerText((prev) => `${prev} ${text}`.trim());
          }}
          voiceSettingsOverride={{ sttProvider: 'web' }}
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
        Harness note: kliknij „Podyktuj” — fałszywy SpeechRecognition wygeneruje interim, potem final transcript,
        dokładnie jak prawdziwa mowa.
      </p>
    </div>
  );
}

function VoiceDegradedVariant(): React.ReactElement {
  React.useEffect(() => {
    // Force the honest-degradation branch: no media devices API at all.
    Object.defineProperty(window.navigator, 'mediaDevices', { value: undefined, configurable: true });
  }, []);
  const [, force] = React.useState(0);
  React.useEffect(() => {
    force((n) => n + 1); // re-render once mediaDevices is gone
  }, []);
  return (
    <div style={{ maxWidth: 420, padding: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-secondary)' }}>Twoja odpowiedź</label>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <textarea
          rows={3}
          style={{ flex: 1, borderRadius: 8, border: '1px solid var(--c-border)', padding: 10, fontSize: 14 }}
          placeholder="Opisz sytuację własnymi słowami…"
        />
        <VoiceAnswerChannel onTranscript={() => {}} />
      </div>
    </div>
  );
}

function Screen(): React.ReactElement {
  if (variant === 'voice-draft') return <VoiceDraftVariant />;
  if (variant === 'voice-degraded') return <VoiceDegradedVariant />;
  return <QualityInvalidVariant />;
}

export default Screen;
