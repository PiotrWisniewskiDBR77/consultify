/**
 * assessmentLegacyReportContractService — kontrakt raportu z magazynu ZASTANEGO.
 *
 * ★ POMIAR, KTÓRY TO WYMUSIŁ (2026-09-06, zapytania do żywej bazy, nie do kodu):
 *   • stanowisko lokalne, org DBR77 — `assessments` 4, `assessment_reports` 4,
 *     `method_sessions` 0, `method_outputs` 0, `method_findings` 0;
 *   • staging, org właściciela — `assessments` 10, `method_outputs` 1.
 * Trasa DOCX (`GET /api/method/sessions/:id/assessment-report.docx`) czytała
 * WYŁĄCZNIE jądro, więc dla 10 z 11 realnych ocen właściciela nie mogła
 * zwrócić niczego poza 404. Ten serwis podaje temu samemu silnikowi
 * (`composeReportContract` → `buildAssessmentDrdReportSchema` →
 * `renderDocumentSchemaToDocxBuffer`) dane z magazynu zastanego.
 *
 * ★ CZEGO TU NIE MA. Ani jednej wymyślonej liczby i ani jednego wymyślonego
 * zdania. Mapowanie jest dokładnie takie samo, jak w projekcji frontowej
 * (`src/components/assessment/assessmentOutputProjection.ts`):
 *   `achievedLevel` → `currentLevel`, `targetLevel` → `targetLevel`,
 *   `gap` = różnica tych dwóch (jedyne działanie arytmetyczne).
 * Poziom 0/brak = BRAK POMIARU, więc obszar nie dostaje findingu i w raporcie
 * jest „nie oceniono", a nie zmierzone zero. Magazyn zastany nie niesie
 * `businessMeaning` ani `recommendation`, więc te pola zostają PUSTE — silnik
 * narracji sam napisze wtedy uczciwe „Brak treści wymaganej do pełnego
 * komentarza", zamiast wypełniać je czymkolwiek.
 */
import DRD_STRUCTURE from '../../data/drdStructure.js';
import type { MethodFindingRecord } from '../../method-core/outputs/MethodOutputService.js';
import * as DbPromise from '../../utils/DbPromise.js';
import {
  composeReportContract,
  type ReportContractInput,
} from './assessmentReportContractComposer.js';
import {
  formatEmployeeCount,
  normalizeIndustry,
} from './assessmentReportContractService.js';
import { AssessmentSkipReasonError } from './assessmentSkipReasonService.js';

const PL_DATE = new Intl.DateTimeFormat('pl-PL', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

interface LegacyAssessmentRow {
  id: string;
  name: string | null;
  project_id: string | null;
  created_at: string | null;
  updated_at: string | null;
  answers_json: string | null;
  created_by: string | null;
}

/** Jeden obszar w `answers.drd.areas` — kształt zapisywany przez warsztat DRD. */
interface LegacyArea {
  achievedLevel?: number | null;
  targetLevel?: number | null;
  levelNotes?: Record<string, string> | null;
}

function poziom(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function tekst(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

/**
 * Odczyt poziomów z `answers_json`. Obsługuje DWA kształty spotkane w realnych
 * danych (zmierzone, nie zgadnięte) — dokładnie te same, które obsługuje
 * projekcja frontowa:
 *   • `answers.drd.areas['1A'] = { achievedLevel, targetLevel, levelNotes }`
 *   • `answers.drd.<filar>.areaScores['1A'] = [obecny, docelowy]`
 */
export function odczytajObszaryZastane(answersJson: string | null): {
  poziomy: Map<string, { current: number | null; target: number | null }>;
  notatki: Record<string, string>;
} {
  const poziomy = new Map<string, { current: number | null; target: number | null }>();
  const notatki: Record<string, string> = {};
  if (!answersJson) return { poziomy, notatki };
  let parsed: unknown;
  try {
    parsed = JSON.parse(answersJson);
  } catch {
    return { poziomy, notatki };
  }
  const drd = (parsed as { drd?: unknown })?.drd;
  if (!drd || typeof drd !== 'object') return { poziomy, notatki };

  const areas = (drd as { areas?: Record<string, LegacyArea> }).areas;
  if (areas && typeof areas === 'object') {
    for (const [unitId, area] of Object.entries(areas)) {
      const current = poziom(area?.achievedLevel);
      const target = poziom(area?.targetLevel);
      if (current !== null || target !== null) poziomy.set(unitId, { current, target });
      const notes = area?.levelNotes;
      if (notes && typeof notes === 'object' && current !== null) {
        const note = tekst(notes[String(current)]);
        if (note) notatki[unitId] = note;
      }
    }
  }

  // Starszy zapis kreatora: `drd.<filar>.areaScores['1A'] = [obecny, docelowy]`.
  for (const value of Object.values(drd as Record<string, unknown>)) {
    const areaScores = (value as { areaScores?: Record<string, unknown> })?.areaScores;
    if (!areaScores || typeof areaScores !== 'object') continue;
    for (const [unitId, pair] of Object.entries(areaScores)) {
      if (poziomy.has(unitId) || !Array.isArray(pair)) continue;
      const current = poziom(pair[0]);
      const target = poziom(pair[1]);
      if (current !== null || target !== null) poziomy.set(unitId, { current, target });
    }
  }
  return { poziomy, notatki };
}

/**
 * Findingi „syntetyczne" — nośnik tych samych pól, których używa silnik
 * narracji. `confidence: 'medium'` NIE jest zmierzoną pewnością: magazyn
 * zastany jej nie ma. Ta wartość znaczy w tym kontekście dokładnie tyle, że
 * poziom został ZADEKLAROWANY bez załączonego dowodu — i tak też renderuje ją
 * silnik (`evidenceState: 'declared'` → „zadeklarowany"). `'low'` byłoby
 * fałszem w drugą stronę (sugerowałoby zmierzoną niską pewność).
 */
export function zbudujFindingiZastane(
  assessmentId: string,
  poziomy: Map<string, { current: number | null; target: number | null }>,
  createdAt: string
): MethodFindingRecord[] {
  const obszary = DRD_STRUCTURE.flatMap((axis) => axis.areas);
  const findings: MethodFindingRecord[] = [];
  for (const area of obszary) {
    const measured = poziomy.get(area.id);
    if (!measured || (measured.current === null && measured.target === null)) continue;
    findings.push({
      id: `legacy:${assessmentId}:${area.id}`,
      outputId: `legacy:${assessmentId}`,
      unitId: area.id,
      unitName: area.name,
      currentLevel: measured.current,
      targetLevel: measured.target,
      gap:
        measured.current === null || measured.target === null
          ? null
          : measured.target - measured.current,
      supportingEvidence: [],
      contradictingEvidence: [],
      businessMeaning: '',
      rootCauseHypothesis: null,
      riskOrOpportunity: null,
      recommendation: '',
      prerequisite: null,
      expectedOutcome: null,
      kpiProposal: null,
      confidence: 'medium',
      priorityRationale: null,
      sourceLocators: [`assessments.answers_json#drd.areas.${area.id}`],
      createdAt,
    });
  }
  return findings;
}

export class AssessmentLegacyReportContractService {
  /** Buduje `assessment-report-contract-v1` z oceny w magazynie zastanym. */
  async build(organizationId: string, assessmentId: string) {
    const assessment = await DbPromise.get<LegacyAssessmentRow>(
      `SELECT id, name, project_id, created_at, updated_at, answers_json, created_by
       FROM assessments WHERE id = ? AND organization_id = ?`,
      [assessmentId, organizationId],
      { fallback: false }
    );
    if (!assessment) throw new AssessmentSkipReasonError('SESSION_NOT_FOUND', 404);

    const project = assessment.project_id
      ? await DbPromise.get<{ name: string; description: string | null }>(
          `SELECT name, description FROM projects WHERE id = ? AND organization_id = ?`,
          [assessment.project_id, organizationId],
          { fallback: false }
        )
      : null;

    const organization = await DbPromise.get<{ name: string | null; industry: string | null }>(
      `SELECT name, industry FROM organizations WHERE id = ?`,
      [organizationId],
      { fallback: false }
    );
    const organizationProfile = await DbPromise.get<{
      industry: string | null;
      employee_count: number | null;
    }>(`SELECT industry, employee_count FROM organization_profiles WHERE organization_id = ?`, [
      organizationId,
    ]);

    const ownerUser = assessment.created_by
      ? await DbPromise.get<{ first_name: string | null; last_name: string | null }>(
          `SELECT first_name, last_name FROM users WHERE id = ? AND organization_id = ?`,
          [assessment.created_by, organizationId],
          { fallback: false }
        )
      : null;
    const assessorName = [ownerUser?.first_name, ownerUser?.last_name]
      .filter((part): part is string => Boolean(part && part.trim()))
      .join(' ')
      .trim();

    const { poziomy, notatki } = odczytajObszaryZastane(assessment.answers_json);
    const generatedAt = assessment.updated_at ?? assessment.created_at ?? new Date().toISOString();
    const findings = zbudujFindingiZastane(
      assessment.id,
      poziomy,
      assessment.created_at ?? generatedAt
    );

    // Ograniczenie NIE jest ozdobnikiem — to jedyne miejsce, w którym dokument
    // mówi czytelnikowi, że ma przed sobą projekcję oceny warsztatowej, a nie
    // zamrożony wynik jądra z dowodami.
    const limitations = [
      'Wynik pochodzi z oceny prowadzonej w warsztacie DRD (magazyn zastany), nie z zamrożonego Outputu jądra metodycznego — poziomy są zadeklarowane, bez załączonych dowodów.',
    ];

    const input: ReportContractInput = {
      sessionId: assessment.id,
      outputId: null,
      revision: 0,
      generatedAt,
      methodVersion: 'DRD 7 osi / 39 obszarów (ocena zastana — bez przypiętej wersji paczki)',
      sourceKind: 'legacy',
      sessionLabel: {
        displayName: project?.name ?? tekst(assessment.name) ?? null,
        source: project ? 'project' : tekst(assessment.name) ? 'assessment' : null,
        projectId: assessment.project_id,
      },
      businessProfile:
        normalizeIndustry(organizationProfile?.industry) ??
        normalizeIndustry(organization?.industry) ??
        null,
      employment: formatEmployeeCount(organizationProfile?.employee_count),
      assessmentPeriod: assessment.created_at
        ? PL_DATE.format(new Date(assessment.created_at))
        : null,
      assessor: assessorName || null,
      clientSponsor: null,
      findings,
      limitations,
      skipReasons: [],
      assessorNotes: notatki,
    };

    return { contract: composeReportContract(input), organizationName: organization?.name ?? null };
  }
}

export const assessmentLegacyReportContractService = new AssessmentLegacyReportContractService();
