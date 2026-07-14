import type { ContextPack } from './contextPackBuilder.js';
import { isTemplateInventoryLeak } from './deliverableContentGuard.js';
import type { SourceArtifact } from './presentationGeneratorService.js';

export interface TransformationReadDeckPack {
  participants: string[];
  surveyStatus: string;
  responseMetrics: Array<{ label: string; value: string | number; unit?: string }>;
  insightPack: Array<{ title: string; description: string; source?: string }>;
  initiativePack: Array<{
    name: string;
    summary?: string;
    priority?: string;
    timeline?: string;
    owner?: string;
    impact?: number;
    effort?: number;
  }>;
  decisionPack: Array<{ action: string; owner?: string; deadline?: string; status?: string }>;
  appendixPack: Array<{ title: string; body: string }>;
  confidenceIndex: number;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item)).filter(Boolean);
}

export function buildTransformationReadDeckPack(params: {
  contextPack: ContextPack;
  artifactData: Record<string, any>;
  sources: SourceArtifact[];
  language: 'en' | 'pl';
}): TransformationReadDeckPack {
  const { contextPack, artifactData, sources, language } = params;
  const isPl = language === 'pl';
  const sourceNames = sources.map((source) => source.label || source.type).filter(Boolean);
  const insights = [...stringList(artifactData._keyFindings), ...stringList(contextPack.key_points)]
    // BUG C guardrail: never surface template-inventory system context as insight content.
    .filter((point) => !isTemplateInventoryLeak(point))
    .slice(0, 12)
    .map((point, index) => ({
      title: isPl ? `Wniosek ${index + 1}` : `Insight ${index + 1}`,
      description: point,
      source: sourceNames[index % Math.max(1, sourceNames.length)],
    }));
  const initiatives = Array.isArray(artifactData._initiatives)
    ? artifactData._initiatives.slice(0, 15).map((initiative: any) => ({
        name: String(initiative.name || 'Initiative'),
        summary: initiative.summary || initiative.status || '',
        priority: String(initiative.priority || 'medium').toLowerCase(),
        timeline: initiative.timeline || initiative.deadline || '30-90 days',
        owner: initiative.owner || initiative.owner_name || 'TBD',
        impact: Number(initiative.impact || 3),
        effort: Number(initiative.effort || 3),
      }))
    : [];
  const metrics = contextPack.data_points.slice(0, 6).map((point) => ({
    label: point.label,
    value: point.value,
    unit: point.unit,
  }));

  return {
    participants: stringList(artifactData._participants),
    surveyStatus:
      artifactData._surveyStatus ||
      (isPl
        ? 'Status badania częściowo zasilony z kontekstu'
        : 'Survey status partially sourced from context'),
    responseMetrics: metrics.length
      ? metrics
      : [
          { label: isPl ? 'Źródła' : 'Sources', value: sources.length },
          {
            label: isPl ? 'Confidence' : 'Confidence',
            value: Math.round(contextPack.metadata.confidence_score * 100),
            unit: '%',
          },
        ],
    insightPack: insights.length
      ? insights
      : [
          {
            title: isPl ? 'Wniosek wymaga danych' : 'Evidence required',
            description: isPl
              ? 'Brakuje wystarczających danych źródłowych do silnego wniosku.'
              : 'Insufficient source evidence for a strong insight.',
          },
        ],
    initiativePack: initiatives,
    decisionPack: artifactData._actions || [
      {
        action: isPl ? 'Zatwierdzić priorytety transformacji' : 'Approve transformation priorities',
        owner: 'Sponsor',
        deadline: '30 days',
        status: 'pending',
      },
    ],
    appendixPack: [
      {
        title: isPl ? 'Źródła i metodologia' : 'Sources and methodology',
        body: `${sourceNames.join(', ') || 'Consultify context'} · confidence ${Math.round(
          contextPack.metadata.confidence_score * 100
        )}%`,
      },
    ],
    confidenceIndex: contextPack.metadata.confidence_score,
  };
}

export function applyTransformationPackToArtifactData(
  artifactData: Record<string, any>,
  pack: TransformationReadDeckPack
): Record<string, any> {
  return {
    ...artifactData,
    _participants: pack.participants,
    _surveyStatus: pack.surveyStatus,
    _performanceKpis: artifactData._performanceKpis || pack.responseMetrics,
    _kpis: artifactData._kpis || pack.responseMetrics.slice(0, 4),
    _keyFindings: pack.insightPack.map((insight) => insight.description).slice(0, 5),
    _keyMessages: pack.insightPack.slice(0, 4).map((insight) => ({
      title: insight.title,
      description: insight.description,
    })),
    _recommendations:
      artifactData._recommendations ||
      pack.initiativePack.slice(0, 8).map((initiative) => ({
        title: initiative.name,
        description: initiative.summary || '',
        impact: String(initiative.impact || 'TBD'),
        priority: initiative.priority || 'medium',
        category: 'Transformation',
      })),
    _initiatives: artifactData._initiatives || pack.initiativePack,
    _actions: artifactData._actions || pack.decisionPack,
    _appendices: pack.appendixPack,
    _confidenceIndex: pack.confidenceIndex,
  };
}
