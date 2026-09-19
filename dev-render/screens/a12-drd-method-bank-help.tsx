import React, { useMemo } from 'react';

import { QuestionHelpDisclosure } from '@/components/method-workspace/QuestionHelpDisclosure';
import { compileDrdPack } from '@/method-core/methods/drd/compileDrdPack';
import { DRD_STRUCTURE } from '@/services/drdStructure';

const params = new URLSearchParams(window.location.search);
const requestedAreaId = params.get('area') || '1A';
const requestedLevel = Number(params.get('level') || 2);

export default function A12DrdMethodBankHelpScreen(): React.ReactElement {
  const pack = useMemo(() => compileDrdPack('en').pack, []);
  const axis = DRD_STRUCTURE.find((candidate) => candidate.areas.some((area) => area.id === requestedAreaId)) ?? DRD_STRUCTURE[0];
  const area = axis.areas.find((candidate) => candidate.id === requestedAreaId) ?? axis.areas[0];
  const levels = pack.levels.filter((level) => level.unitId === area.id).sort((a, b) => a.level - b.level);
  const selectedLevel = levels.find((level) => level.level === requestedLevel) ?? levels[0];
  const question = pack.questions.find(
    (candidate) => candidate.unitId === area.id && candidate.level === selectedLevel.level
  );

  if (!question) {
    return <div className="p-6 text-c-danger">No DRD question for {area.id} level {selectedLevel.level}.</div>;
  }

  return (
    <main className="min-h-screen bg-c-bg p-8 text-c-text">
      <section className="mx-auto max-w-4xl space-y-5 rounded-2xl border border-c-border bg-c-surface p-6 shadow-sm">
        <header className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-c-text-muted">A12 K-23 · DRD method bank</p>
          <h1 className="text-2xl font-semibold text-c-text">{area.name} · Level {selectedLevel.level}</h1>
          <p className="text-sm text-c-text-secondary">{selectedLevel.title}</p>
        </header>
        <article className="rounded-xl border border-c-border-subtle bg-c-surface-raised p-4">
          <p className="text-sm font-medium text-c-text">{question.canonicalWording}</p>
        </article>
        <QuestionHelpDisclosure question={question} help={{ questionId: question.questionId, levels }} onAskTeresa={() => {}} />
      </section>
    </main>
  );
}
