/**
 * Dev-render host for the Assessment SESSION matrix surface.
 *
 * Renders the REAL `<DRDMatrixSession>` (Piotr's "Digital Pathfinder" —
 * axis-by-axis maturity matrix, cells change color on click) in the SAME
 * bare shape production uses. No re-implementation: the matrix is the REAL
 * production component; only the session `answers` are mocked (no
 * store/API/login).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ★ 2026-09-01 — USUNIĘTE `<TopBar>` (ExecutiveModuleShell) +
 * `<ArtifactRightPanel>` (audyt przyrządu, Kategoria 1).
 *
 * Ten ekran wcześniej dokładał obie te REAL komponenty wokół
 * `DRDMatrixSession`. Produkcja (`AssessmentSessionEditorView.tsx:1846-1868`,
 * gałąź `drdViewMode === 'matrix'`) montuje `DRDMatrixSession` jako JEDYNE
 * dziecko `<div className="flex-1 overflow-auto">{renderEditor()}</div>`
 * (linia 2600) — zero trafień na `TopBar` z `ExecutiveModuleShell` lub
 * `ArtifactRightPanel` w całym pliku. Ta konkretna gałąź nie ma nawet
 * lokalnego, bespoke nagłówka, który plik renderuje wyżej dla innych
 * widoków — `DRDMatrixSession` stoi sam. Właściciel oceniał więc dwa REAL
 * komponenty złożone razem w kompozycji, której produkt nigdy nie renderuje
 * (R2 audytu przyrządu). ZŁOTA REGUŁA nr 1 (CLAUDE.md): weryfikuj REALNY
 * runtime.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Exercises: axis navigation (left "Matrix overview" aside baked into the
 * matrix centrum itself), click-to-set achieved level (cell recolors),
 * light+dark tokens (zero crimson).
 */
import React, { useState } from 'react';

import type { DRDEditorAnswers } from '@/components/assessment/drd/DRDAssessmentEditor';
import { DRDMatrixSession } from '@/components/assessment/drd/DRDMatrixSession';
import { getQuestionsForAxis } from '@/services/drdStructure';

// ── Mock session answers (realistic partial progress across 3 axes) ───────
function buildMockAnswers(): DRDEditorAnswers {
  const areas: Record<string, { achievedLevel: number }> = {};
  const levelPattern = [3, 4, 2, 5, 3];
  getQuestionsForAxis(1).forEach((area, i) => {
    areas[area.id] = { achievedLevel: levelPattern[i % levelPattern.length] };
  });
  getQuestionsForAxis(2).forEach((area, i) => {
    if (i < 2) areas[area.id] = { achievedLevel: [2, 3][i] };
  });
  const axis3 = getQuestionsForAxis(3);
  if (axis3[0]) areas[axis3[0].id] = { achievedLevel: 4 };
  return { areas };
}

export function AssessmentMatrycaScreen(): React.ReactElement {
  const [answers, setAnswers] = useState<DRDEditorAnswers>(() => buildMockAnswers());
  const [axisId, setAxisId] = useState<number>(1);
  const [areaId, setAreaId] = useState<string | undefined>(undefined);

  return (
    // Montaż 1:1 jak produkcja (`AssessmentSessionEditorView.tsx:2600`):
    // `DRDMatrixSession` jest JEDYNYM dzieckiem `flex-1 overflow-auto` —
    // zero `<TopBar>`, zero `<ArtifactRightPanel>`.
    <div className="h-screen w-full bg-c-bg">
      <div className="flex-1 overflow-auto h-full">
        <DRDMatrixSession
          value={answers}
          onChange={setAnswers}
          currentAxisId={axisId}
          onAxisChange={setAxisId}
          currentAreaId={areaId}
          onAreaChange={setAreaId}
        />
      </div>
    </div>
  );
}

export default AssessmentMatrycaScreen;
