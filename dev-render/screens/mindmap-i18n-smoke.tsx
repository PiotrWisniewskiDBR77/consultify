/**
 * Smoke i18n fala 2 — M06 Mind Map: realne modale (AssignPerson / AttachArtifact /
 * AddEvidence) po sweepie isPl -> t() (ideas.mindmap.*). Harness-only; renderuje
 * komponenty produkcyjne z mock-callbackami, PL/EN przez &lang=.
 */
import React from 'react';

import { AddEvidenceModal } from '../../src/components/MyWork/mindmap/AddEvidenceModal';
import { AssignPersonModal } from '../../src/components/MyWork/mindmap/AssignPersonModal';
import { AttachArtifactModal } from '../../src/components/MyWork/mindmap/AttachArtifactModal';

const noop = () => undefined;

const MindmapI18nSmokeScreen: React.FC = () => (
  <div className="min-h-screen bg-c-surface p-6 text-c-text">
    <h1 className="mb-4 text-lg font-semibold" data-dev-render-chrome="">
      M06 Mind Map — modale po sweepie i18n (ideas.mindmap.*)
    </h1>
    <div className="relative flex flex-wrap gap-6">
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-c-text-secondary">
          AssignPersonModal
        </h2>
        <div className="relative h-[320px] w-[420px] overflow-hidden rounded-lg border border-c-border">
          <AssignPersonModal
            open
            onClose={noop}
            onAssign={noop}
            recentAssignees={['Alice', 'Bob']}
          />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-c-text-secondary">
          AttachArtifactModal
        </h2>
        <div className="relative h-[320px] w-[420px] overflow-hidden rounded-lg border border-c-border">
          <AttachArtifactModal open onClose={noop} onAttach={noop} />
        </div>
      </section>
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase text-c-text-secondary">
          AddEvidenceModal
        </h2>
        <div className="relative h-[320px] w-[420px] overflow-hidden rounded-lg border border-c-border">
          <AddEvidenceModal open onClose={noop} onAdd={noop} />
        </div>
      </section>
    </div>
  </div>
);

export default MindmapI18nSmokeScreen;
