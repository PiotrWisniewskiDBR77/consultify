export type OnboardingPersona =
  | 'Partner'
  | 'CFO'
  | 'CEO'
  | 'COO'
  | 'CISO'
  | 'Transformation Officer';

export type PersonaConfidence = 'low' | 'medium' | 'high';

export type PersonaInferenceInput = {
  title?: string | null;
  groups?: string[] | null;
};

export type PersonaInferenceResult = {
  persona: OnboardingPersona;
  confidence: PersonaConfidence;
};

const PERSONA_KEYWORDS: Array<{
  persona: OnboardingPersona;
  titleKeywords: string[];
  groupKeywords: string[];
}> = [
  {
    persona: 'Partner',
    titleKeywords: ['partner', 'alliances', 'channel'],
    groupKeywords: ['partner', 'alliances', 'channel'],
  },
  {
    persona: 'CFO',
    titleKeywords: ['cfo', 'finance', 'financial', 'controller', 'fp&a'],
    groupKeywords: ['finance', 'fp&a', 'controlling'],
  },
  {
    persona: 'CEO',
    titleKeywords: ['ceo', 'chief executive', 'managing director', 'president'],
    groupKeywords: ['executive', 'leadership', 'board'],
  },
  {
    persona: 'COO',
    titleKeywords: ['coo', 'operations', 'operational', 'delivery'],
    groupKeywords: ['operations', 'delivery'],
  },
  {
    persona: 'CISO',
    titleKeywords: ['ciso', 'security', 'risk', 'compliance'],
    groupKeywords: ['security', 'risk', 'compliance'],
  },
  {
    persona: 'Transformation Officer',
    titleKeywords: ['transformation', 'program', 'change', 'pm', 'product'],
    groupKeywords: ['transformation', 'program', 'change'],
  },
];

function includesKeyword(source: string, keywords: string[]): boolean {
  return keywords.some((keyword) => source.includes(keyword));
}

export function resolvePersonaFromProfile(input: PersonaInferenceInput): PersonaInferenceResult {
  const title = String(input.title || '')
    .trim()
    .toLowerCase();
  const groups = Array.isArray(input.groups)
    ? input.groups.map((group) => String(group || '').trim().toLowerCase())
    : [];

  let best:
    | {
        persona: OnboardingPersona;
        score: number;
        confidence: PersonaConfidence;
      }
    | null = null;

  for (const candidate of PERSONA_KEYWORDS) {
    const titleScore = candidate.titleKeywords.filter((keyword) => title.includes(keyword)).length;
    const groupScore = groups.reduce((count, group) => {
      return count + candidate.groupKeywords.filter((keyword) => group.includes(keyword)).length;
    }, 0);
    const score = titleScore * 3 + groupScore * 2;
    if (score <= 0) continue;
    const confidence: PersonaConfidence =
      titleScore > 0 && groupScore > 0 ? 'high' : 'medium';
    if (!best || score > best.score) {
      best = {
        persona: candidate.persona,
        score,
        confidence,
      };
    }
  }

  if (best) {
    return { persona: best.persona, confidence: best.confidence };
  }

  return { persona: 'Transformation Officer', confidence: 'low' };
}
