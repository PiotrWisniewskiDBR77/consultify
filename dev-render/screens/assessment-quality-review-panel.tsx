/**
 * Dev-render host for the REAL `<AssessmentQualityReviewPanel />` (ASM-005/
 * 006/007 — Assessment Hub → Outputs tab, wired to the assessment selected on
 * Processes). No re-implementation: the component fetches through
 * `V8AssessmentApi` (services/api/v8/assessment.ts, itself backed by
 * `fetchWithRetry`/`window.fetch`), so we stub `window.fetch` with
 * engine-shaped mock JSON keyed by URL path (pattern from
 * dev-render/screens/assessment-reports-panel.tsx).
 *
 * ?variant=mixed (default) — realistic in-progress state: 5 of 7 axes have
 *   evidence, 2 don't (shows the "brak" badge + axesMissingEvidence gate),
 *   review history has one prior "return", no accepted output yet.
 * ?variant=accepted — post-accept state: full evidence coverage, review
 *   history shows accept, an accepted report block is present.
 * ?variant=empty — brand-new assessment, zero evidence/reviews/report.
 */
import React from 'react';

import { AssessmentQualityReviewPanel } from '../../src/components/assessment/AssessmentQualityReviewPanel';

const ASSESSMENT_ID = 'assess-dbr77-quality-1';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function notFound(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 404,
    headers: { 'Content-Type': 'application/json' },
  });
}

const AXIS_NAMES: Record<string, string> = {
  '1': 'Procesy Cyfrowe',
  '2': 'Produkty Cyfrowe',
  '3': 'Modele Biznesowe',
  '4': 'Zarządzanie Danymi',
  '5': 'Kultura',
  '6': 'Cyberbezpieczeństwo',
  '7': 'Dojrzałość AI',
};

function buildScoring(axesWithEvidence: string[]) {
  const axes = Object.entries(AXIS_NAMES).map(([axisId, axisName], i) => {
    const hasEvidence = axesWithEvidence.includes(axisId);
    return {
      axisId,
      axisName,
      areaCount: 9,
      answeredAreas: 9,
      avgAchievedLevel: 2.5 + (i % 3) * 0.6,
      avgTargetLevel: 4,
      gap: 4 - (2.5 + (i % 3) * 0.6),
      evidenceCount: hasEvidence ? 1 + (i % 2) : 0,
      hasEvidence,
    };
  });
  const axesMissingEvidence = axes.filter((a) => !a.hasEvidence).map((a) => a.axisId);
  return {
    completionPercent: 100,
    overallAvgAchievedLevel: axes.reduce((acc, a) => acc + a.avgAchievedLevel, 0) / axes.length,
    evidenceCoverage: Math.round(
      ((axes.length - axesMissingEvidence.length) / axes.length) * 100
    ),
    axesMissingEvidence,
    axes,
  };
}

const EVIDENCE_MIXED = [
  {
    id: 'ev-1',
    organizationId: 'org-dbr77',
    assessmentId: ASSESSMENT_ID,
    axisId: '1',
    areaId: '1A',
    evidenceType: 'document',
    title: 'Audyt procesów sprzedażowych Q2 2026',
    description: 'Raport z audytu CRM + wywiady z zespołem sprzedaży',
    url: null,
    createdBy: 'Piotr Wiśniewski',
    createdAt: '2026-07-15T09:00:00Z',
  },
  {
    id: 'ev-2',
    organizationId: 'org-dbr77',
    assessmentId: ASSESSMENT_ID,
    axisId: '2',
    areaId: '2A',
    evidenceType: 'link',
    title: 'Roadmapa produktów cyfrowych',
    description: null,
    url: 'https://confluence.dbr77.local/roadmapa-produkty',
    createdBy: 'Anna Kowalska',
    createdAt: '2026-07-16T11:30:00Z',
  },
  {
    id: 'ev-3',
    organizationId: 'org-dbr77',
    assessmentId: ASSESSMENT_ID,
    axisId: '4',
    areaId: '4B',
    evidenceType: 'reference',
    title: 'Polityka zarządzania danymi (ISO 27001)',
    description: 'Dokument wewnętrzny, wersja 3.2',
    url: null,
    createdBy: 'Marek Zieliński',
    createdAt: '2026-07-17T08:15:00Z',
  },
  {
    id: 'ev-4',
    organizationId: 'org-dbr77',
    assessmentId: ASSESSMENT_ID,
    axisId: '6',
    areaId: '6A',
    evidenceType: 'note',
    title: 'Notatka z przeglądu bezpieczeństwa',
    description: 'Pentest zewnętrzny zaplanowany na sierpień',
    url: null,
    createdBy: 'Piotr Wiśniewski',
    createdAt: '2026-07-18T14:00:00Z',
  },
  {
    id: 'ev-5',
    organizationId: 'org-dbr77',
    assessmentId: ASSESSMENT_ID,
    axisId: '7',
    areaId: '7A',
    evidenceType: 'document',
    title: 'Inwentaryzacja modeli AI w użyciu',
    description: null,
    url: null,
    createdBy: 'Anna Kowalska',
    createdAt: '2026-07-19T10:00:00Z',
  },
];

const REVIEWS_MIXED = [
  {
    id: 'rev-1',
    organizationId: 'org-dbr77',
    assessmentId: ASSESSMENT_ID,
    action: 'return',
    actorId: 'Piotr Wiśniewski',
    actorRole: 'admin',
    rationale: 'Brakuje dowodów dla osi Modele Biznesowe i Kultura — proszę uzupełnić przed ponowną akceptacją.',
    previousStatus: 'DRAFT',
    newStatus: 'DRAFT',
    createdAt: '2026-07-14T16:00:00Z',
  },
];

const VARIANTS: Record<
  string,
  { evidence: typeof EVIDENCE_MIXED; scoring: ReturnType<typeof buildScoring>; reviews: typeof REVIEWS_MIXED; report: 'ok' | '404' }
> = {
  mixed: {
    evidence: EVIDENCE_MIXED,
    scoring: buildScoring(['1', '2', '4', '6', '7']),
    reviews: REVIEWS_MIXED,
    report: '404',
  },
  accepted: {
    evidence: EVIDENCE_MIXED.concat([
      {
        id: 'ev-6',
        organizationId: 'org-dbr77',
        assessmentId: ASSESSMENT_ID,
        axisId: '3',
        areaId: '3A',
        evidenceType: 'note',
        title: 'Model biznesowy — warsztat z zarządem',
        description: null,
        url: null,
        createdBy: 'Piotr Wiśniewski',
        createdAt: '2026-07-20T09:00:00Z',
      },
      {
        id: 'ev-7',
        organizationId: 'org-dbr77',
        assessmentId: ASSESSMENT_ID,
        axisId: '5',
        areaId: '5A',
        evidenceType: 'link',
        title: 'Ankieta kultury cyfrowej — wyniki',
        description: null,
        url: 'https://forms.dbr77.local/kultura-2026',
        createdBy: 'Anna Kowalska',
        createdAt: '2026-07-21T09:00:00Z',
      },
    ]),
    scoring: buildScoring(['1', '2', '3', '4', '5', '6', '7']),
    reviews: [
      ...REVIEWS_MIXED,
      {
        id: 'rev-2',
        organizationId: 'org-dbr77',
        assessmentId: ASSESSMENT_ID,
        action: 'accept',
        actorId: 'Piotr Wiśniewski',
        actorRole: 'admin',
        rationale: 'Wszystkie osie kompletne i udokumentowane — akceptuję.',
        previousStatus: 'DRAFT',
        newStatus: 'APPROVED',
        createdAt: '2026-07-22T10:00:00Z',
      },
    ],
    report: 'ok',
  },
  empty: {
    evidence: [],
    scoring: buildScoring([]),
    reviews: [],
    report: '404',
  },
};

const params = new URLSearchParams(window.location.search);
const variant = VARIANTS[params.get('variant') || 'mixed'] ? params.get('variant') || 'mixed' : 'mixed';
const data = VARIANTS[variant];

// Install the offline fetch stub once (idempotent across HMR).
const g = window as unknown as { __ASM_QUALITY_REVIEW_FETCH__?: boolean };
if (!g.__ASM_QUALITY_REVIEW_FETCH__) {
  g.__ASM_QUALITY_REVIEW_FETCH__ = true;
  const realFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method || 'GET').toUpperCase();
    try {
      if (url.includes(`/assessment/${ASSESSMENT_ID}/evidence`) && method === 'GET') {
        return jsonResponse({ data: { evidence: data.evidence, scoring: data.scoring }, meta: {} });
      }
      if (url.includes(`/assessment/${ASSESSMENT_ID}/evidence`) && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse({
          data: {
            evidence: {
              id: `ev-new-${Date.now()}`,
              organizationId: 'org-dbr77',
              assessmentId: ASSESSMENT_ID,
              axisId: body.axisId,
              areaId: body.areaId,
              evidenceType: body.evidenceType,
              title: body.title,
              description: body.description ?? null,
              url: body.url ?? null,
              createdBy: 'Piotr Wiśniewski',
              createdAt: new Date().toISOString(),
            },
          },
          meta: {},
        });
      }
      if (url.includes(`/assessment/${ASSESSMENT_ID}/review-history`)) {
        return jsonResponse({ data: { reviews: data.reviews }, meta: {} });
      }
      if (url.includes(`/assessment/${ASSESSMENT_ID}/review`) && method === 'POST') {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return jsonResponse({
          data: {
            review: {
              id: `rev-new-${Date.now()}`,
              organizationId: 'org-dbr77',
              assessmentId: ASSESSMENT_ID,
              action: body.action,
              actorId: 'Piotr Wiśniewski',
              actorRole: 'admin',
              rationale: body.rationale,
              previousStatus: 'DRAFT',
              newStatus: body.action === 'accept' ? 'APPROVED' : 'DRAFT',
              createdAt: new Date().toISOString(),
            },
          },
          meta: {},
        });
      }
      if (url.includes(`/assessment/${ASSESSMENT_ID}/report`)) {
        if (data.report === 'ok') {
          return jsonResponse({
            data: {
              assessmentId: ASSESSMENT_ID,
              snapshot: { assessmentId: ASSESSMENT_ID, assessmentType: 'DRD', scoring: data.scoring },
              provenance: { acceptedBy: 'Piotr Wiśniewski', acceptedAt: '2026-07-22T10:00:00Z', reviewId: 'rev-2' },
              acceptedBy: 'Piotr Wiśniewski',
              acceptedAt: '2026-07-22T10:00:00Z',
              isCurrent: true,
            },
            meta: {},
          });
        }
        return notFound({ error: 'No accepted output exists yet for this assessment', code: 'NO_ACCEPTED_OUTPUT' });
      }
    } catch {
      /* fall through to real fetch (e.g. i18n /locales/**) */
    }
    return realFetch(input as RequestInfo, init);
  };
}

export default function AssessmentQualityReviewPanelScreen(): React.ReactElement {
  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px', height: '900px' }}>
      <AssessmentQualityReviewPanel assessmentId={ASSESSMENT_ID} />
    </div>
  );
}
