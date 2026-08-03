import {
  BookOpen,
  ExternalLink,
  FileText,
  Gavel,
  Lightbulb,
  Loader2,
  Presentation,
  Rocket,
  StickyNote,
  Table,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { Api } from '@/services/api';

/**
 * Kicker (skala typograficzna L1) dla NARZUCONYCH-CIEMNYCH modali tego panelu.
 *
 * Dlaczego nie `TEXT_L1` z `@/styles/typography`: oba modale (generator dokumentu
 * i potwierdzenie działania) mają na sztywno ciemną powłokę (`bg-navy-900`), więc
 * nie przełączają się z motywem — a `TEXT_L1` kończy się na `dark:text-slate-500`,
 * które przy jasnym motywie aplikacji w ogóle nie wchodzi i zostaje `text-slate-600`
 * na granatowym tle. Zmierzone w runtime: 3,40:1 (poniżej AA 4,5). Ta stała powtarza
 * skalę L1 co do wartości, zmienia WYŁĄCZNIE kolor na jasny — bo tło jest ciemne
 * niezależnie od motywu. SSOT typografii zostaje nietknięte.
 */
const MODAL_KICKER = 'text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-300';

export type ArtifactActionTarget =
  | 'report'
  | 'presentation'
  | 'table'
  | 'idea'
  | 'note'
  | 'initiative'
  | 'decision';

interface ArtifactActionSource {
  type: 'interview_insight';
  id: string;
  title: string;
  status?: string;
  content?: string;
  confidence?: string | null;
  limits?: string | null;
  evidenceCount?: number;
  sourceSessionCount?: number;
  sourcePack?: Record<string, unknown> | null;
  reportPack?: {
    id?: string;
    status?: string;
    readinessStatus?: string;
    completenessScore?: number;
    degraded?: boolean;
    degradedReasons?: string[];
    manifestHash?: string | null;
  } | null;
}

interface CreatedTarget {
  id: string;
  type: ArtifactActionTarget;
  label: string;
  path: string;
}

interface ArtifactActionPanelProps {
  source: ArtifactActionSource;
  isPolish: boolean;
  variant?: 'compact' | 'full';
  /**
   * Kontekst projektu — WYMAGANY przez `POST /api/decisions`
   * (server/src/controllers/DecisionController.ts: „Missing decision context",
   * gdy nie ma ani projektu, ani inicjatywy, ani zadania). Bez niego kafelek
   * „Rozpocznij decyzję" renderuje się WYŁĄCZONY z jawnym powodem, zamiast
   * zapraszać do kliknięcia, które skończy się błędem 400.
   */
  projectId?: string | null;
}

/**
 * Cel akcji niesie WYŁĄCZNIE ikonę — kolor NIE jest już nośnikiem typu.
 *
 * Dlaczego (2026-07-23, naprawa wskazana przez dwóch sędziów): wcześniej każdy
 * z siedmiu celów miał własny pastelowy `tone` (slate/fuchsia/emerald/amber/
 * sky/indigo/teal). W jednym widoku dawało to siedem różnych barw tła, czyli
 * kolor jako DEKORACJĘ, a nie sygnał. Najgorszy przypadek: „Utwórz prezentację"
 * miała `fuchsia` — zmierzone w runtime `rgba(201, 0, 107, 0.1)` (dark) i
 * `rgb(252, 238, 244)` / obwódka `rgb(241, 166, 197)` (light), czyli róż z
 * rodziny czerwieni. Kanon (CLAUDE.md, pułapka nr 1): czerwień/róż = WYŁĄCZNIE
 * semantyka krytyczna (błąd, usunięcie, blokada). „Utwórz prezentację" nią nie
 * jest — to zwykła akcja tworzenia, jedna z siedmiu równorzędnych.
 *
 * Rozróżnienie typu robi teraz KSZTAŁT ikony (FileText · Presentation · Table ·
 * Lightbulb · StickyNote · Rocket · Gavel), a powierzchnia jest jedna, neutralna,
 * zbudowana z tokenów `c-*` (działa w light i dark bez klas `dark:`).
 *
 * Gdyby kiedyś wróciło kodowanie typu kolorem, kanonicznym narzędziem są
 * `c-tag-1..12` (paleta KATEGORII), nie surowe palety Tailwinda — z zastrzeżeniem
 * reguły §15.1 (≤5 widocznych serii), której siedem celów i tak nie spełnia.
 */
const TARGET_META: Record<
  ArtifactActionTarget,
  { icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  report: { icon: FileText },
  presentation: { icon: Presentation },
  table: { icon: Table },
  idea: { icon: Lightbulb },
  note: { icon: StickyNote },
  initiative: { icon: Rocket },
  decision: { icon: Gavel },
};

/**
 * Jedna neutralna powierzchnia dla WSZYSTKICH kafli/chipów akcji.
 * Drabina głębi: panel = `c-surface`, kafel = `c-surface-raised`,
 * przycisk w kaflu = `c-surface` + `c-border` (żeby odczytał się z powrotem).
 * Tokeny `c-*` przełączają się same z motywem — zero klas `dark:`.
 */
const TILE_SURFACE = 'border-c-border-subtle bg-c-surface-raised text-c-text';
const TILE_BUTTON_SURFACE =
  'border border-c-border bg-c-surface text-c-text hover:border-c-border-strong hover:bg-c-surface-raised';
const CHIP_SURFACE =
  'border-c-border bg-c-surface text-c-text hover:border-c-border-strong hover:bg-c-surface-raised';

const DOC_TARGETS: ArtifactActionTarget[] = ['report', 'presentation', 'table'];
const APP_TARGETS: ArtifactActionTarget[] = ['idea', 'note', 'initiative', 'decision'];

function unwrapPayload(response: any): any {
  return response?.data || response;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

function buildInsightMarkdown(source: ArtifactActionSource): string {
  const lines = [
    `# ${source.title}`,
    '',
    source.content || '',
    '',
    '## Source',
    `- Type: Interview Insight`,
    `- ID: ${source.id}`,
    source.confidence ? `- Confidence: ${source.confidence}` : null,
    source.evidenceCount != null ? `- Evidence count: ${source.evidenceCount}` : null,
    source.sourceSessionCount != null ? `- Source sessions: ${source.sourceSessionCount}` : null,
    source.reportPack?.id ? `- Report pack: ${source.reportPack.id}` : null,
    source.reportPack?.status ? `- Report pack status: ${source.reportPack.status}` : null,
    source.reportPack?.readinessStatus
      ? `- Report pack readiness: ${source.reportPack.readinessStatus}`
      : null,
    source.reportPack?.manifestHash ? `- Manifest hash: ${source.reportPack.manifestHash}` : null,
    source.limits ? `- Limits: ${source.limits}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function downstreamReadinessWarnings(
  source: ArtifactActionSource,
  t: (key: string, opts?: Record<string, unknown>) => string
): string[] {
  const reportPack = source.reportPack;
  const warnings: string[] = [];
  if (!reportPack?.id) {
    warnings.push(t('sharedComponents.artifactActionPanel.warnings.noLinkedReportPack'));
  }
  if (reportPack?.status && reportPack.status !== 'published') {
    warnings.push(
      t('sharedComponents.artifactActionPanel.warnings.reportPackStatus', {
        status: reportPack.status,
      })
    );
  }
  if (reportPack?.readinessStatus && reportPack.readinessStatus !== 'ready_for_review') {
    warnings.push(
      t('sharedComponents.artifactActionPanel.warnings.readinessGate', {
        status: reportPack.readinessStatus,
      })
    );
  }
  if (reportPack?.degraded) {
    warnings.push(t('sharedComponents.artifactActionPanel.warnings.reportPackDegraded'));
  }
  return warnings;
}

function buildInitiativeDraftDescription(source: ArtifactActionSource): string {
  return [
    buildInsightMarkdown(source),
    '',
    '## Initiative Draft Rules',
    '- Origin: Interview Insight',
    '- Local workspace: Interview > Initiatives',
    '- Status: Draft until reviewed in the Interview module',
    '- AI enrichment: may use approved organizational knowledge when drafting the initiative',
    '- Lineage: keep this insight as the explicit source artifact',
  ].join('\n');
}

function extractEvidenceRefs(source: ArtifactActionSource): string[] {
  const entries = Array.isArray((source.sourcePack as any)?.entries)
    ? ((source.sourcePack as any).entries as Array<Record<string, any>>)
    : [];
  const refs = entries.flatMap((entry) => [
    entry.answerId,
    ...(Array.isArray(entry.capturedPointers)
      ? entry.capturedPointers.map((pointer: Record<string, any>) => pointer.pointerId)
      : []),
  ]);
  return Array.from(new Set(refs.map((ref) => String(ref || '').trim()).filter(Boolean)));
}

function buildActionContract(
  source: ArtifactActionSource,
  target: ArtifactActionTarget,
  composer?: { templateMode: string; contextMode: string },
  governanceProposal?: Record<string, unknown>
): Record<string, unknown> {
  return {
    contract: 'interview_insight_downstream_action_v1',
    target,
    source: {
      type: source.type,
      id: source.id,
      title: source.title,
      confidence: source.confidence || null,
      evidenceCount: source.evidenceCount ?? 0,
      sourceSessionCount: source.sourceSessionCount ?? 0,
      reportPack: source.reportPack || null,
    },
    composer: composer || null,
    lineage: {
      sourcePack: source.sourcePack || {},
      reportPack: source.reportPack || null,
      evidenceRefs: extractEvidenceRefs(source),
    },
    governance: {
      proposalRequired: true,
      confirmationRequired: true,
      proposal: governanceProposal || null,
      auditIntent: `Create ${target} from interview insight`,
    },
  };
}

function buildGovernanceProposal(
  source: ArtifactActionSource,
  target: ArtifactActionTarget,
  t: (key: string, opts?: Record<string, unknown>) => string
): Record<string, unknown> {
  const targetLabel = t(`sharedComponents.artifactActionPanel.targetMeta.${target}.label`);
  return {
    sourceInsight: {
      id: source.id,
      title: source.title,
      confidence: source.confidence || null,
      evidenceCount: source.evidenceCount ?? 0,
      sourceSessionCount: source.sourceSessionCount ?? 0,
      reportPack: source.reportPack || null,
    },
    target,
    targetLabel,
    readBackText: t('sharedComponents.artifactActionPanel.readBackText', {
      targetLabel,
      title: source.title,
      evidenceCount: source.evidenceCount ?? 0,
      confidence: source.confidence || t('sharedComponents.artifactActionPanel.confidenceNone'),
    }),
    limits: source.limits || null,
    evidenceRefs: extractEvidenceRefs(source),
    readinessWarnings: downstreamReadinessWarnings(source, t),
  };
}

export const ArtifactActionPanel: React.FC<ArtifactActionPanelProps> = ({
  source,
  isPolish,
  variant = 'full',
  projectId = null,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loadingTarget, setLoadingTarget] = useState<ArtifactActionTarget | null>(null);
  const [createdTargets, setCreatedTargets] = useState<
    Partial<Record<ArtifactActionTarget, CreatedTarget>>
  >({});
  const [composerTarget, setComposerTarget] = useState<ArtifactActionTarget | null>(null);
  const [composerTemplate, setComposerTemplate] = useState('ai_freeform');
  const [composerConfirmed, setComposerConfirmed] = useState(false);
  const [proposalTarget, setProposalTarget] = useState<ArtifactActionTarget | null>(null);
  const [proposalConfirmed, setProposalConfirmed] = useState(false);

  const isCompact = variant === 'compact';
  const sourceMarkdown = useMemo(() => buildInsightMarkdown(source), [source]);
  const isActionDisabled = source.status === 'generating' || source.status === 'failed';
  const readinessWarnings = useMemo(() => downstreamReadinessWarnings(source, t), [source, t]);

  const recordConversion = async (target: CreatedTarget, payload: Record<string, unknown>) => {
    const actionContract = payload.actionContract as Record<string, unknown> | undefined;
    await Api.post('/artifact-conversions/record', {
      sourceArtifactType: source.type,
      sourceArtifactId: source.id,
      sourceArtifactTitle: source.title,
      sourceModule: 'interview',
      targetArtifactType: target.type,
      targetArtifactId: target.id,
      conversionIntent: `Create ${target.type} from interview insight`,
      confidenceLevel: source.confidence || null,
      limits: source.limits || null,
      evidenceRefs: extractEvidenceRefs(source),
      sourcePack: source.sourcePack || {},
      reportPack: source.reportPack || null,
      payload: {
        ...payload,
        actionContract,
      },
    });
  };

  const createTarget = async (
    target: ArtifactActionTarget,
    composer?: { templateMode: string; contextMode: string },
    governanceProposal?: Record<string, unknown>
  ) => {
    setLoadingTarget(target);
    try {
      const titlePrefix: Record<ArtifactActionTarget, string> = {
        report: t('sharedComponents.artifactActionPanel.titlePrefix.report'),
        presentation: t('sharedComponents.artifactActionPanel.titlePrefix.presentation'),
        table: t('sharedComponents.artifactActionPanel.titlePrefix.table'),
        idea: t('sharedComponents.artifactActionPanel.titlePrefix.idea'),
        note: t('sharedComponents.artifactActionPanel.titlePrefix.note'),
        initiative: t('sharedComponents.artifactActionPanel.titlePrefix.initiative'),
        decision: t('sharedComponents.artifactActionPanel.titlePrefix.decision', 'Decision'),
      };
      const title = `${titlePrefix[target]}: ${source.title}`;
      let created: CreatedTarget | null = null;
      let rawPayload: Record<string, unknown> = {};
      const evidenceRefs = extractEvidenceRefs(source);
      const actionContract = buildActionContract(source, target, composer, governanceProposal);

      if (target === 'report') {
        const res = unwrapPayload(
          await Api.post('/report-builder', {
            sourceType: 'INTERVIEW',
            sourceId: source.id,
            sourceName: source.title,
            title,
            description: sourceMarkdown,
            config: {
              sourceSubType: 'interview_insight',
              artifactActionSource: { type: source.type, id: source.id },
              actionComposer: composer || null,
              actionContract,
              sourcePack: source.sourcePack || {},
              reportPack: source.reportPack || null,
              evidenceRefs,
              sourcesLedger: [
                {
                  sourceType: source.type,
                  sourceId: source.id,
                  sourceName: source.title,
                  evidenceCount: source.evidenceCount ?? null,
                  confidence: source.confidence ?? null,
                  reportPack: source.reportPack || null,
                },
              ],
            },
          })
        );
        const id = firstString(res?.report?.id, res?.id, res?.reportId);
        if (!id) throw new Error('Report id missing');
        created = {
          id,
          type: target,
          label: t('sharedComponents.artifactActionPanel.openReport'),
          path: `/reports/builder/${id}`,
        };
        rawPayload = res;
      }

      if (target === 'presentation') {
        const res = unwrapPayload(
          await Api.post('/presentations/decks', {
            title,
            theme: 'modern',
            source: { type: source.type, id: source.id, title: source.title },
            actionComposer: composer || null,
            actionContract,
            sourcePack: source.sourcePack || {},
            reportPack: source.reportPack || null,
            evidenceRefs,
            slides: [
              {
                type: 'title',
                content: {
                  title,
                  subtitle: t('sharedComponents.artifactActionPanel.generatedFromInterviewInsight'),
                },
              },
              {
                type: 'executive_summary',
                content: {
                  title: t('sharedComponents.artifactActionPanel.keyInsight'),
                  body: source.content || source.title,
                },
              },
              {
                type: 'next_steps',
                content: {
                  title: t('sharedComponents.artifactActionPanel.nextActions'),
                  bullets: [
                    t('sharedComponents.artifactActionPanel.discussWithTheTeam'),
                    t('sharedComponents.artifactActionPanel.decideOnInitiativeIntake'),
                  ],
                },
              },
            ],
          })
        );
        const id = firstString(res?.data?.id, res?.id, res?.deckId);
        if (!id) throw new Error('Presentation id missing');
        created = {
          id,
          type: target,
          label: t('sharedComponents.artifactActionPanel.openDeck'),
          path: `/presentations/builder/${id}`,
        };
        rawPayload = res;
      }

      if (target === 'table') {
        const res = unwrapPayload(
          await Api.post('/workbook/generate', {
            prompt: `${t('sharedComponents.artifactActionPanel.createAWorkingTableFromThisInsight')}:\n\n${sourceMarkdown}`,
            researchContext: {
              sourceType: source.type,
              sourceId: source.id,
              title: source.title,
              sourcePack: source.sourcePack || {},
              reportPack: source.reportPack || null,
              actionComposer: composer || null,
              actionContract,
              evidenceRefs,
            },
            sourcePack: source.sourcePack || {},
            reportPack: source.reportPack || null,
            actionContract,
            evidenceRefs,
            language: isPolish ? 'pl' : 'en',
          })
        );
        const id = firstString(res?.id, res?.workbook?.id, res?.data?.id);
        if (!id) throw new Error('Workbook id missing');
        created = {
          id,
          type: target,
          label: t('sharedComponents.artifactActionPanel.openTable'),
          path: `/tabele?artifactId=${id}`,
        };
        rawPayload = res;
      }

      if (target === 'idea') {
        const res = unwrapPayload(
          await Api.post('/my-work/my-ideas', {
            title,
            body: sourceMarkdown,
            tags: ['interview-insight'],
            sourceType: source.type,
            sourceConversationId: source.id,
            sourcePack: source.sourcePack || {},
            reportPack: source.reportPack || null,
            actionContract,
            evidenceRefs,
          })
        );
        const id = firstString(res?.id, res?.idea?.id);
        if (!id) throw new Error('Idea id missing');
        created = {
          id,
          type: target,
          label: t('sharedComponents.artifactActionPanel.openIdea'),
          path: `/my-work/ideas/${id}`,
        };
        rawPayload = res;
      }

      if (target === 'note') {
        const res = unwrapPayload(
          await Api.post('/my-work/notebook/pages', {
            title,
            contentText: sourceMarkdown,
            contentJson: {
              type: 'doc',
              content: [
                { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: title }] },
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: source.content || source.title }],
                },
              ],
            },
            tags: ['interview-insight'],
            sourceType: source.type,
            sourceId: source.id,
            sourcePack: source.sourcePack || {},
            reportPack: source.reportPack || null,
            actionContract,
            evidenceRefs,
            icon: 'Lightbulb',
            maturity: 'seed',
            status: 'active',
          })
        );
        const id = firstString(res?.id, res?.page?.id);
        if (!id) throw new Error('Note id missing');
        created = {
          id,
          type: target,
          label: t('sharedComponents.artifactActionPanel.openNote'),
          path: `/my-work/notebook`,
        };
        rawPayload = res;
      }

      if (target === 'initiative') {
        const initiativeDraftDescription = buildInitiativeDraftDescription(source);
        const res = unwrapPayload(
          await Api.post('/initiatives', {
            name: title,
            title,
            description: initiativeDraftDescription,
            summary: source.content || source.title,
            problemStatement: source.limits || source.content || source.title,
            status: 'DRAFT',
            priority: 'medium',
            impact: 'medium',
            effort: 'medium',
            category: 'interview-initiative-draft',
            sourceType: source.type,
            sourceId: source.id,
            sourcePack: source.sourcePack || {},
            reportPack: source.reportPack || null,
            actionContract,
            evidenceRefs,
            reportName: t('sharedComponents.artifactActionPanel.draftReportName'),
          })
        );
        const id = firstString(res?.id, res?.initiative?.id, res?.data?.id);
        if (!id) throw new Error('Initiative id missing');
        created = {
          id,
          type: target,
          label: t('sharedComponents.artifactActionPanel.openInInterviewInitiatives'),
          path: `/interview?tab=initiatives&initiativeId=${id}`,
        };
        rawPayload = res;
      }

      if (target === 'decision') {
        // „Rozpocznij decyzję" (zgłoszenie właściciela 2026-07-23): wniosek jest
        // materiałem decyzyjnym, więc decyzja jest jego REZULTATEM, nie akcją
        // poboczną. Endpoint: POST /api/decisions (routes/pmo/decisions.routes.ts),
        // wymaga tytułu ORAZ kontekstu (projekt/inicjatywa/zadanie) —
        // dlatego bez `projectId` kafelek jest wyłączony (patrz `renderAction`).
        if (!projectId) throw new Error('Missing decision context (projectId)');
        const res = unwrapPayload(
          await Api.createDecision({
            title,
            description: sourceMarkdown,
            projectId,
            relatedObjectType: 'project',
            relatedObjectId: projectId,
            priority: 'medium',
            impact: 'medium',
            decisionType: 'GENERAL',
          })
        );
        const id = firstString(res?.id, res?.decision?.id, res?.data?.id);
        if (!id) throw new Error('Decision id missing');
        created = {
          id,
          type: target,
          label: t('sharedComponents.artifactActionPanel.openDecision', 'Open decision'),
          path: `/my-work/decisions/${id}`,
        };
        rawPayload = res;
      }

      if (!created) throw new Error('Unsupported target');
      await recordConversion(created, {
        ...rawPayload,
        actionComposer: composer || null,
        actionContract,
        governanceProposal: governanceProposal || null,
      });
      setCreatedTargets((prev) => ({ ...prev, [target]: created }));
      toast.success(t('sharedComponents.artifactActionPanel.artifactCreated'));
    } catch (error) {
      console.error('[ArtifactActionPanel] Failed to create target:', error);
      toast.error(t('sharedComponents.artifactActionPanel.failedToCreateArtifact'));
    } finally {
      setLoadingTarget(null);
    }
  };

  // Kafelek jest WYŁĄCZONY, gdy brakuje warunku, którego backend wymaga —
  // z powodem w tooltipie, zamiast pozwalać kliknąć w błąd 400.
  const blockedReason = (target: ArtifactActionTarget): string | null => {
    if (target === 'decision' && !projectId) {
      return t(
        'sharedComponents.artifactActionPanel.decisionNeedsProject',
        'Pick a project first — a decision must be anchored in a project.'
      );
    }
    return null;
  };

  const renderAction = (target: ArtifactActionTarget) => {
    const meta = TARGET_META[target];
    const Icon = meta.icon;
    const created = createdTargets[target];
    const loading = loadingTarget === target;
    const isDocumentTarget = DOC_TARGETS.includes(target);
    const blocked = blockedReason(target);

    return (
      <div key={target} className={`min-w-0 rounded-2xl border p-3 ${TILE_SURFACE}`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0 rounded-xl border border-c-border-subtle bg-c-surface p-2">
            <Icon size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-c-text">
              {t(`sharedComponents.artifactActionPanel.targetMeta.${target}.label`)}
            </div>
            {!isCompact && (
              <div className="mt-1 text-xs text-c-text-secondary">
                {t(`sharedComponents.artifactActionPanel.targetMeta.${target}.description`)}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() =>
              created
                ? navigate(created.path)
                : isDocumentTarget
                  ? setComposerTarget(target)
                  : setProposalTarget(target)
            }
            disabled={loading || isActionDisabled || !!blocked}
            title={blocked || undefined}
            className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${TILE_BUTTON_SURFACE}`}
          >
            {loading ? (
              <Loader2 size={14} className="shrink-0 animate-spin" />
            ) : created ? (
              <ExternalLink size={14} className="shrink-0" />
            ) : (
              <Icon size={14} className="shrink-0" />
            )}
            <span className="truncate">
              {created
                ? created.label
                : isDocumentTarget
                  ? t('sharedComponents.artifactActionPanel.openGenerator')
                  : t('sharedComponents.artifactActionPanel.create')}
            </span>
          </button>
        </div>
      </div>
    );
  };

  // Compact = a thin two-group strip (Documents / In app) of small buttons.
  // Used only in the Insight preview pane footer — keeps the description in the
  // center and the create-actions compact at the bottom (canon §7.3).
  const renderCompactButton = (target: ArtifactActionTarget) => {
    const meta = TARGET_META[target];
    const Icon = meta.icon;
    const created = createdTargets[target];
    const loading = loadingTarget === target;
    const isDocumentTarget = DOC_TARGETS.includes(target);
    const blocked = blockedReason(target);
    const stripped = t(`sharedComponents.artifactActionPanel.targetMeta.${target}.label`)
      .replace(/^Utwórz\s+/i, '')
      .replace(/^Rozpocznij\s+/i, '')
      .replace(/^Create\s+/i, '')
      .replace(/^Start\s+/i, '');
    const label = stripped.charAt(0).toUpperCase() + stripped.slice(1);
    return (
      // ROZPYCHANIE W POZIOMIE (naprawa u ŹRÓDŁA, 2026-07-23): chip nie mógł się
      // skurczyć — brak `min-w-0`/`max-w-full` i nieskracalny tekst sprawiały, że
      // długa etykieta (`created.label`, np. „Otwórz w Wywiad > Inicjatywy", albo
      // goły klucz i18n przy braku tłumaczenia) rozpychała pasek na 393 px wewnątrz
      // panelu preview o świetle 356 px → 47 px przepełnienia (przy panelu 300 px:
      // 131 px). Konsumenci łatali to u siebie; przyczyna siedziała TUTAJ.
      // `max-w-full min-w-0` + `truncate` na etykiecie + `shrink-0` na ikonie
      // zamykają to w komponencie współdzielonym, więc żaden adopter nie musi.
      <button
        key={target}
        type="button"
        onClick={() =>
          created
            ? navigate(created.path)
            : isDocumentTarget
              ? setComposerTarget(target)
              : setProposalTarget(target)
        }
        disabled={loading || isActionDisabled || !!blocked}
        title={
          blocked || t(`sharedComponents.artifactActionPanel.targetMeta.${target}.description`)
        }
        className={`inline-flex h-8 min-w-0 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${CHIP_SURFACE}`}
      >
        {loading ? (
          <Loader2 size={13} className="shrink-0 animate-spin" />
        ) : created ? (
          <ExternalLink size={13} className="shrink-0" />
        ) : (
          <Icon size={13} className="shrink-0" />
        )}
        <span className="truncate">{created ? created.label : label}</span>
      </button>
    );
  };

  return (
    <>
      {isCompact ? (
        <div className="min-w-0 rounded-2xl border border-c-border-subtle bg-c-surface-raised p-2.5">
          <div className="mb-2 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-text-secondary">
            <BookOpen size={11} className="shrink-0" />
            {t('sharedComponents.artifactActionPanel.whatNextWithThisInsight')}
          </div>
          <div className="min-w-0 space-y-1.5">
            {/*
              ETYKIETY GRUP — były `text-slate-400 dark:text-slate-500` / 10 px:
              zmierzone 2,56:1 (light) i 3,49:1 (dark), czyli poniżej progu AA 4,5.
              Token `c-text-secondary` (#475569 light / #b8c4d6 dark) trzyma próg w
              OBU motywach bez klas `dark:`. Kolumna poszerzona z 68 → 84 px, bo przy
              11 px „W APLIKACJI" łamało się na dwie linie.
            */}
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="mr-0.5 w-[84px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-c-text-secondary">
                {t('sharedComponents.artifactActionPanel.documents')}
              </span>
              {DOC_TARGETS.map(renderCompactButton)}
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="mr-0.5 w-[84px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] text-c-text-secondary">
                {t('sharedComponents.artifactActionPanel.inApp')}
              </span>
              {APP_TARGETS.map(renderCompactButton)}
            </div>
          </div>
        </div>
      ) : (
        <div
          className={`rounded-3xl border border-c-border-subtle bg-c-surface shadow-sm ${isCompact ? 'p-3' : 'p-5'}`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-c-info/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-c-info dark:text-c-info">
                <BookOpen size={12} />
                {t('sharedComponents.artifactActionPanel.whatNextWithThisInsightQuestion')}
              </div>
              {!isCompact && (
                <p className="mt-2 max-w-3xl text-sm text-c-text-secondary">
                  {t('sharedComponents.artifactActionPanel.insightSourceHint')}
                </p>
              )}
              {!isCompact && readinessWarnings.length > 0 && (
                <div className="mt-3 rounded-2xl border-l-4 border-l-amber-500 border border-amber-300/50 bg-amber-100 p-3 text-xs text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
                  <div className="font-semibold">
                    {t('sharedComponents.artifactActionPanel.downstreamConditions')}
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {readinessWarnings.slice(0, 3).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {!isCompact && (
              <div className="grid shrink-0 grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised px-3 py-2">
                  <div className="text-c-text-secondary">
                    {t('sharedComponents.artifactActionPanel.confidence')}
                  </div>
                  <div className="font-semibold text-c-text">{source.confidence || '-'}</div>
                </div>
                <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised px-3 py-2">
                  <div className="text-c-text-secondary">
                    {t('sharedComponents.artifactActionPanel.evidence')}
                  </div>
                  <div className="font-semibold text-c-text">{source.evidenceCount ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-c-border-subtle bg-c-surface-raised px-3 py-2">
                  <div className="text-c-text-secondary">
                    {t('sharedComponents.artifactActionPanel.sessions')}
                  </div>
                  <div className="font-semibold text-c-text">{source.sourceSessionCount ?? 0}</div>
                </div>
              </div>
            )}
          </div>

          <div className={`mt-4 grid gap-3 ${isCompact ? 'grid-cols-1' : 'lg:grid-cols-2'}`}>
            <div className="space-y-2">
              {!isCompact && (
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                  {t('sharedComponents.artifactActionPanel.documents')}
                </div>
              )}
              <div
                className={`grid gap-3 ${isCompact ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))]'}`}
              >
                {DOC_TARGETS.map(renderAction)}
              </div>
            </div>
            <div className="space-y-2">
              {!isCompact && (
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-c-text-secondary">
                  {t('sharedComponents.artifactActionPanel.appActions')}
                </div>
              )}
              <div
                className={`grid gap-3 ${isCompact ? 'grid-cols-1' : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))]'}`}
              >
                {APP_TARGETS.map(renderAction)}
              </div>
            </div>
          </div>
        </div>
      )}
      {composerTarget && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/[0.08] bg-navy-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">
                  {t('sharedComponents.artifactActionPanel.documentGenerator')}
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {t('sharedComponents.artifactActionPanel.composerHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setComposerTarget(null);
                  setComposerConfirmed(false);
                }}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08]"
              >
                {t('sharedComponents.artifactActionPanel.close')}
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-white/[0.04] p-4">
              <div className={MODAL_KICKER}>
                {t('sharedComponents.artifactActionPanel.context')}
              </div>
              <div className="mt-2 text-sm font-medium text-white">{source.title}</div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-300">
                <div>
                  {t('sharedComponents.artifactActionPanel.evidence')}: {source.evidenceCount ?? 0}
                </div>
                <div>
                  {t('sharedComponents.artifactActionPanel.sessions')}:{' '}
                  {source.sourceSessionCount ?? 0}
                </div>
                <div>
                  {t('sharedComponents.artifactActionPanel.confidence')}: {source.confidence || '-'}
                </div>
              </div>
              {readinessWarnings.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                  <div className="font-semibold">
                    {t('sharedComponents.artifactActionPanel.downstreamLimits')}
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {readinessWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300">
                {t('sharedComponents.artifactActionPanel.template')}
              </label>
              <select
                value={composerTemplate}
                onChange={(event) => setComposerTemplate(event.target.value)}
                className="mt-1 w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white"
              >
                <option value="ai_freeform">
                  {t('sharedComponents.artifactActionPanel.noTemplateAiComposesStructure')}
                </option>
                <option value="executive_readout">
                  {t('sharedComponents.artifactActionPanel.executiveReadout')}
                </option>
                <option value="consulting_workpaper">
                  {t('sharedComponents.artifactActionPanel.consultingWorkpaper')}
                </option>
                <option value="decision_pack">
                  {t('sharedComponents.artifactActionPanel.decisionPack')}
                </option>
              </select>
            </div>

            <label className="mt-4 flex items-start gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={composerConfirmed}
                onChange={(event) => setComposerConfirmed(event.target.checked)}
                className="mt-0.5"
              />
              <span>{t('sharedComponents.artifactActionPanel.composerConfirmText')}</span>
            </label>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setComposerTarget(null);
                  setComposerConfirmed(false);
                }}
                className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06]"
              >
                {t('sharedComponents.artifactActionPanel.cancel')}
              </button>
              <button
                type="button"
                disabled={!composerConfirmed || Boolean(loadingTarget)}
                onClick={() => {
                  const target = composerTarget;
                  if (!target) return;
                  setComposerTarget(null);
                  setComposerConfirmed(false);
                  createTarget(target, {
                    templateMode: composerTemplate,
                    contextMode: 'insight_with_source_pack',
                  });
                }}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50"
              >
                {t('sharedComponents.artifactActionPanel.runGenerator')}
              </button>
            </div>
          </div>
        </div>
      )}
      {proposalTarget && (
        <div className="fixed inset-0 z-overlay flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-3xl border border-white/[0.08] bg-navy-900 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-white">
                  {t('sharedComponents.artifactActionPanel.actionConfirmation')}
                </div>
                <p className="mt-1 text-xs text-slate-300">
                  {t('sharedComponents.artifactActionPanel.proposalHint')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProposalTarget(null);
                  setProposalConfirmed(false);
                }}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/[0.08]"
              >
                {t('sharedComponents.artifactActionPanel.close')}
              </button>
            </div>

            <div className="mt-4 space-y-3 rounded-2xl bg-white/[0.04] p-4 text-sm text-slate-200">
              <div>
                <div className={MODAL_KICKER}>
                  {t('sharedComponents.artifactActionPanel.source')}
                </div>
                <div className="mt-1 font-medium text-white">{source.title}</div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
                <div>
                  {t('sharedComponents.artifactActionPanel.targetColumnLabel')}:{' '}
                  {t(`sharedComponents.artifactActionPanel.targetMeta.${proposalTarget}.label`)}
                </div>
                <div>
                  {t('sharedComponents.artifactActionPanel.evidence')}: {source.evidenceCount ?? 0}
                </div>
                <div>
                  {t('sharedComponents.artifactActionPanel.confidence')}: {source.confidence || '-'}
                </div>
              </div>
              {source.limits && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                  <span className="font-semibold">
                    {t('sharedComponents.artifactActionPanel.limits')}
                  </span>{' '}
                  {source.limits}
                </div>
              )}
              {readinessWarnings.length > 0 && (
                <div className="rounded-xl border border-amber-400/20 bg-amber-400/10 p-3 text-xs text-amber-100">
                  <div className="font-semibold">
                    {t('sharedComponents.artifactActionPanel.reportPackConditions')}
                  </div>
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {readinessWarnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-3 text-xs text-slate-300">
                {buildGovernanceProposal(source, proposalTarget, t).readBackText as string}
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={proposalConfirmed}
                  onChange={(event) => setProposalConfirmed(event.target.checked)}
                  className="mt-0.5"
                />
                <span>{t('sharedComponents.artifactActionPanel.proposalConfirmText')}</span>
              </label>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setProposalTarget(null);
                  setProposalConfirmed(false);
                }}
                className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-white/[0.06]"
              >
                {t('sharedComponents.artifactActionPanel.cancel')}
              </button>
              <button
                type="button"
                disabled={!proposalConfirmed || Boolean(loadingTarget)}
                onClick={() => {
                  const target = proposalTarget;
                  if (!target) return;
                  const proposal = buildGovernanceProposal(source, target, t);
                  setProposalTarget(null);
                  setProposalConfirmed(false);
                  createTarget(target, undefined, proposal);
                }}
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-800 dark:bg-[#F4F7FB] dark:text-navy-950 dark:hover:bg-[#DDE5EF] disabled:opacity-50"
              >
                {t('sharedComponents.artifactActionPanel.confirmAndCreate')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ArtifactActionPanel;
