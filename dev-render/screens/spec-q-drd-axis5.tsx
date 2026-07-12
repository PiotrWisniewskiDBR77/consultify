/**
 * Mock host for <StandardQuestion> — SPEC-Q applied to DRD Axis 5
 * "Kultura Transformacji" (5A–5E), all 5 obszary as Q-Level cards (6-rung
 * maturity ladder each, full definition + example + boundaryVsPrev on every
 * rung — the cure for "za mało info żeby wybrać poziom").
 *
 * Reuses the REAL component (no re-implementation), wired to the
 * dev-render/fixtures/drd-axis5-specq.ts content fixture (pure content, no
 * DB/API). Follows the standard-question.tsx harness pattern exactly
 * (CLAUDE.md rule #7 — clean self-rendered harness before Piotr sees it).
 *
 * All copy is Polish (isPolish=true). Handlers are no-ops except onChange,
 * which keeps local state so the interactions stay live under the pointer.
 */
import React, { useState } from 'react';

import StandardQuestion, {
  type StandardQuestionModel,
} from '../../src/components/standard/StandardQuestion';
import { DRD_AXIS5_QUESTIONS } from '../fixtures/drd-axis5-specq';

export function SpecQDrdAxis5Screen(): React.ReactElement {
  const [values, setValues] = useState<Record<string, string | number | undefined>>({
    drd_axis5_5a: 4,
    drd_axis5_5b: 3,
    drd_axis5_5c: undefined,
    drd_axis5_5d: 2,
    drd_axis5_5e: undefined,
  });
  const noop = () => {};

  return (
    <div className="min-h-screen bg-c-bg px-6 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-c-text-muted">
          SPEC-Q · DRD Oś 5 — Kultura Transformacji (5A–5E)
        </h1>
        <p className="mb-6 text-sm text-c-text-secondary">
          5 obszarów × 6-szczeblowa drabinka dojrzałości, jako karty StandardQuestion (Q-Level).
          Każdy szczebel: etykieta · definicja · przykład-dowód · granica względem niższego.
        </p>
        <div className="flex flex-col gap-6">
          {DRD_AXIS5_QUESTIONS.map((question: StandardQuestionModel, i) => (
            <StandardQuestion
              key={question.id}
              question={question}
              isPolish
              value={values[question.id]}
              onChange={(v) => setValues((prev) => ({ ...prev, [question.id]: v }))}
              index={i + 1}
              total={DRD_AXIS5_QUESTIONS.length}
              onAttach={noop}
              onAddLink={noop}
              onAskTeresa={noop}
              onDeepDive={noop}
              onPrev={noop}
              onNext={noop}
              onSkip={noop}
              saved={values[question.id] !== undefined}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default SpecQDrdAxis5Screen;
