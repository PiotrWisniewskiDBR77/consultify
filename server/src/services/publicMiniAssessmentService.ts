/**
 * Public Mini Assessment Service (T015)
 * Handles public self-assessment flow: template questions, submission, AI result generation.
 */

import { v4 as uuidv4 } from 'uuid';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

export interface MiniAssessmentQuestion {
  id: string;
  order: number;
  text: Record<string, string>;
  type: 'single_choice' | 'scale' | 'free_text';
  options?: Array<{ value: string; label: Record<string, string> }>;
  scaleMin?: number;
  scaleMax?: number;
  required: boolean;
}

export interface MiniAssessmentTemplate {
  id: string;
  name: string;
  description: Record<string, string>;
  questions: MiniAssessmentQuestion[];
  estimatedMinutes: number;
}

const DEFAULT_TEMPLATE: MiniAssessmentTemplate = {
  id: 'default_v1',
  name: 'Digital Transformation Readiness',
  description: {
    en: 'Quick assessment of your organization\'s digital transformation readiness',
    pl: 'Szybka ocena gotowości Twojej organizacji do transformacji cyfrowej',
  },
  estimatedMinutes: 3,
  questions: [
    {
      id: 'q1_strategy',
      order: 1,
      text: {
        en: 'Does your organization have a formal digital transformation strategy?',
        pl: 'Czy Twoja organizacja ma formalną strategię transformacji cyfrowej?',
      },
      type: 'single_choice',
      options: [
        { value: 'none', label: { en: 'No strategy', pl: 'Brak strategii' } },
        { value: 'informal', label: { en: 'Informal / ad-hoc', pl: 'Nieformalna / ad-hoc' } },
        { value: 'documented', label: { en: 'Documented strategy', pl: 'Udokumentowana strategia' } },
        { value: 'aligned', label: { en: 'Aligned with business goals', pl: 'Powiązana z celami biznesowymi' } },
      ],
      required: true,
    },
    {
      id: 'q2_leadership',
      order: 2,
      text: {
        en: 'How engaged is your leadership in driving digital change?',
        pl: 'Jak bardzo zaangażowane jest kierownictwo we wdrażanie zmian cyfrowych?',
      },
      type: 'scale',
      scaleMin: 1,
      scaleMax: 5,
      required: true,
    },
    {
      id: 'q3_data',
      order: 3,
      text: {
        en: 'How would you describe your organization\'s data maturity?',
        pl: 'Jak opisałbyś dojrzałość danych w Twojej organizacji?',
      },
      type: 'single_choice',
      options: [
        { value: 'siloed', label: { en: 'Data siloed in departments', pl: 'Dane w silosach departamentowych' } },
        { value: 'partial', label: { en: 'Partially integrated', pl: 'Częściowo zintegrowane' } },
        { value: 'centralized', label: { en: 'Centralized data platform', pl: 'Scentralizowana platforma danych' } },
        { value: 'ai_ready', label: { en: 'AI-ready data ecosystem', pl: 'Ekosystem danych gotowy na AI' } },
      ],
      required: true,
    },
    {
      id: 'q4_culture',
      order: 4,
      text: {
        en: 'How open is your organization to adopting new technologies?',
        pl: 'Jak otwarta jest Twoja organizacja na wdrażanie nowych technologii?',
      },
      type: 'scale',
      scaleMin: 1,
      scaleMax: 5,
      required: true,
    },
    {
      id: 'q5_processes',
      order: 5,
      text: {
        en: 'What percentage of your key processes are digitized?',
        pl: 'Jaki procent kluczowych procesów jest zdigitalizowanych?',
      },
      type: 'single_choice',
      options: [
        { value: 'lt25', label: { en: 'Less than 25%', pl: 'Mniej niż 25%' } },
        { value: '25_50', label: { en: '25-50%', pl: '25-50%' } },
        { value: '50_75', label: { en: '50-75%', pl: '50-75%' } },
        { value: 'gt75', label: { en: 'More than 75%', pl: 'Ponad 75%' } },
      ],
      required: true,
    },
    {
      id: 'q6_biggest_challenge',
      order: 6,
      text: {
        en: 'What is your biggest challenge in digital transformation?',
        pl: 'Jakie jest Twoje największe wyzwanie w transformacji cyfrowej?',
      },
      type: 'free_text',
      required: false,
    },
  ],
};

const TEMPLATES: Record<string, MiniAssessmentTemplate> = {
  default_v1: DEFAULT_TEMPLATE,
};

export function getTemplate(templateId: string = 'default_v1'): MiniAssessmentTemplate | null {
  return TEMPLATES[templateId] || null;
}

export async function createAssessment(params: {
  language?: string;
  templateId?: string;
  partnerCode?: string;
  sourceCampaign?: string;
  utmParams?: Record<string, string>;
}): Promise<{ id: string; token: string }> {
  const id = uuidv4();
  const token = uuidv4().replace(/-/g, '').substring(0, 16);
  const { language = 'en', templateId = 'default_v1', partnerCode, sourceCampaign, utmParams } = params;

  await dbRun(
    `INSERT INTO public_mini_assessments (id, token, language, template_id, partner_code, source_campaign, utm_params)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, token, language, templateId, partnerCode || null, sourceCampaign || null, JSON.stringify(utmParams || {})]
  );

  return { id, token };
}

export async function getAssessmentByToken(token: string): Promise<any> {
  return dbGet(`SELECT * FROM public_mini_assessments WHERE token = ?`, [token]);
}

export async function submitAnswers(params: {
  token: string;
  answers: Array<{ questionId: string; value: string | number }>;
  respondentEmail?: string;
  respondentName?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<{ id: string; aiResult: any }> {
  const { token, answers, respondentEmail, respondentName, ipAddress, userAgent } = params;

  const assessment = await getAssessmentByToken(token);
  if (!assessment) throw new Error('Assessment not found');
  if (assessment.status === 'completed') throw new Error('Assessment already completed');

  const template = getTemplate(assessment.template_id);
  if (!template) throw new Error('Template not found');

  const aiResult = generateAIResult(answers, template, assessment.language);

  await dbRun(
    `UPDATE public_mini_assessments
     SET answers_json = ?, ai_result_json = ?, respondent_email = ?, respondent_name = ?,
         ip_address = ?, user_agent = ?, status = 'completed', completed_at = NOW()
     WHERE token = ?`,
    [
      JSON.stringify(answers),
      JSON.stringify(aiResult),
      respondentEmail || null,
      respondentName || null,
      ipAddress || null,
      userAgent || null,
      token,
    ]
  );

  logger.info(`[PublicMiniAssessment] Completed: ${assessment.id}`);
  return { id: assessment.id, aiResult };
}

function generateAIResult(
  answers: Array<{ questionId: string; value: string | number }>,
  template: MiniAssessmentTemplate,
  language: string
): any {
  const answerMap = new Map(answers.map((a) => [a.questionId, a.value]));

  let totalScore = 0;
  let maxScore = 0;
  const dimensions: Array<{ name: string; score: number; maxScore: number; level: string }> = [];

  const scoringRules: Record<string, Record<string, number>> = {
    q1_strategy: { none: 1, informal: 2, documented: 3, aligned: 4 },
    q3_data: { siloed: 1, partial: 2, centralized: 3, ai_ready: 4 },
    q5_processes: { lt25: 1, '25_50': 2, '50_75': 3, gt75: 4 },
  };

  const dimensionNames: Record<string, Record<string, string>> = {
    q1_strategy: { en: 'Digital Strategy', pl: 'Strategia cyfrowa' },
    q2_leadership: { en: 'Leadership Engagement', pl: 'Zaangażowanie kierownictwa' },
    q3_data: { en: 'Data Maturity', pl: 'Dojrzałość danych' },
    q4_culture: { en: 'Innovation Culture', pl: 'Kultura innowacji' },
    q5_processes: { en: 'Process Digitization', pl: 'Digitalizacja procesów' },
  };

  for (const q of template.questions) {
    if (q.type === 'free_text') continue;
    const answer = answerMap.get(q.id);
    if (answer == null) continue;

    let score: number;
    if (q.type === 'scale') {
      score = Number(answer);
      maxScore += q.scaleMax || 5;
    } else {
      score = scoringRules[q.id]?.[String(answer)] ?? 2;
      maxScore += 4;
    }
    totalScore += score;

    const maxDim = q.type === 'scale' ? (q.scaleMax || 5) : 4;
    const pct = score / maxDim;
    const level = pct >= 0.75 ? 'advanced' : pct >= 0.5 ? 'developing' : pct >= 0.25 ? 'basic' : 'initial';
    dimensions.push({
      name: dimensionNames[q.id]?.[language] || dimensionNames[q.id]?.en || q.id,
      score,
      maxScore: maxDim,
      level,
    });
  }

  const overallPct = maxScore > 0 ? totalScore / maxScore : 0;
  const overallLevel = overallPct >= 0.75 ? 'advanced' : overallPct >= 0.5 ? 'developing' : overallPct >= 0.25 ? 'basic' : 'initial';

  const insightTemplates: Record<string, Record<string, string[]>> = {
    advanced: {
      en: [
        'Your organization shows strong digital maturity foundations.',
        'Consider leveraging AI and automation to accelerate transformation.',
        'Focus on scaling successful pilots across the enterprise.',
      ],
      pl: [
        'Twoja organizacja wykazuje silne fundamenty dojrzałości cyfrowej.',
        'Rozważ wykorzystanie AI i automatyzacji do przyspieszenia transformacji.',
        'Skup się na skalowaniu udanych pilotaży w całym przedsiębiorstwie.',
      ],
    },
    developing: {
      en: [
        'Your organization is making progress but has room for improvement.',
        'Strengthening data integration could unlock significant value.',
        'Aligning digital strategy with business goals is a key next step.',
      ],
      pl: [
        'Twoja organizacja robi postępy, ale jest przestrzeń na poprawę.',
        'Wzmocnienie integracji danych może odblokować znaczną wartość.',
        'Powiązanie strategii cyfrowej z celami biznesowymi to kluczowy następny krok.',
      ],
    },
    basic: {
      en: [
        'Your digital transformation journey is at an early stage.',
        'Building leadership buy-in is critical for success.',
        'Start with quick-win process digitization to build momentum.',
      ],
      pl: [
        'Twoja podróż transformacji cyfrowej jest na wczesnym etapie.',
        'Uzyskanie wsparcia kierownictwa jest kluczowe dla sukcesu.',
        'Zacznij od szybkich digitalizacji procesów, aby zbudować momentum.',
      ],
    },
    initial: {
      en: [
        'Your organization is at the beginning of its digital journey.',
        'A clear strategy document is the essential first step.',
        'Consider engaging external advisors to accelerate progress.',
      ],
      pl: [
        'Twoja organizacja jest na początku cyfrowej podróży.',
        'Jasny dokument strategii to niezbędny pierwszy krok.',
        'Rozważ zaangażowanie zewnętrznych doradców, aby przyspieszyć postęp.',
      ],
    },
  };

  const freeTextAnswer = answerMap.get('q6_biggest_challenge');

  return {
    overallScore: Math.round(overallPct * 100),
    overallLevel,
    dimensions,
    insights: insightTemplates[overallLevel]?.[language] || insightTemplates[overallLevel]?.en || [],
    assumptions: language === 'pl'
      ? ['Wynik oparty wyłącznie na podanych odpowiedziach', 'Pełna diagnoza wymaga pogłębionego wywiadu']
      : ['Result based solely on provided answers', 'Full diagnosis requires an in-depth interview'],
    biggestChallenge: freeTextAnswer ? String(freeTextAnswer) : null,
    generatedAt: new Date().toISOString(),
  };
}

export async function listAssessments(organizationId?: string): Promise<any[]> {
  if (organizationId) {
    return (await dbAll(
      `SELECT id, token, language, status, respondent_email, respondent_name, partner_code, created_at, completed_at
       FROM public_mini_assessments WHERE organization_id = ? ORDER BY created_at DESC`,
      [organizationId]
    )) || [];
  }
  return (await dbAll(
    `SELECT id, token, language, status, respondent_email, respondent_name, partner_code, created_at, completed_at
     FROM public_mini_assessments ORDER BY created_at DESC LIMIT 100`
  )) || [];
}

export async function getAssessmentById(id: string): Promise<any> {
  return dbGet(`SELECT * FROM public_mini_assessments WHERE id = ?`, [id]);
}
