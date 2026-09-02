/**
 * Rules Engine — Quality Gates
 *
 * Validates Unified Report JSON against structural rules before rendering.
 * Rule violations → automatic rewrite request or slide rejection.
 *
 * Rules from spec Section 9:
 * - max 1 chart per slide
 * - max 5 bullets
 * - max 14 words in title
 * - max 6 KPI per dashboard
 */

import type {
  AppendixContent,
  ExecutiveSummaryContent,
  InitiativePortfolioContent,
  KeyMessagesContent,
  NextStepsContent,
  PerformanceOverviewContent,
  PrioritizationMatrixContent,
  RecommendationPortfolioContent,
  RiskManagementContent,
  RoadmapContent,
  RootCauseContent,
  RuleViolation,
  UnifiedReportJSON,
  UnifiedSlide,
  ValidationResult,
} from './types.js';

// ============================================================
// STRUCTURAL RULES
// ============================================================

interface Rule {
  id: string;
  description: string;
  check: (slide: UnifiedSlide, index: number) => RuleViolation | null;
}

interface ReportRule {
  id: string;
  description: string;
  check: (report: UnifiedReportJSON) => RuleViolation[];
}

const MAX_TITLE_WORDS = 14;
const MAX_BULLETS = 5;
const MAX_KPI_DASHBOARD = 6;
const MAX_RECOMMENDATIONS_STACK = 8;
const MAX_INITIATIVES_PER_SLIDE = 6;
const MAX_PRIORITIZATION_ITEMS = 5;
const MAX_RISKS = 8;
const MAX_ACTIONS = 10;
const MAX_ROADMAP_PHASES = 5;

const STRUCTURAL_RULES: Rule[] = [
  {
    id: 'TITLE_LENGTH',
    description: `Key message must be ≤ ${MAX_TITLE_WORDS} words`,
    check(slide, index) {
      const wordCount = slide.key_message.trim().split(/\s+/).length;
      if (wordCount > MAX_TITLE_WORDS) {
        return {
          rule: 'TITLE_LENGTH',
          message: `Slide ${index + 1}: key_message has ${wordCount} words (max ${MAX_TITLE_WORDS}). "${slide.key_message.slice(0, 60)}..."`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'REQUIRED_FIELDS',
    description: 'Every slide must have intent, key_message, content',
    check(slide, index) {
      if (!slide.intent || !slide.key_message || !slide.content) {
        const missing = [];
        if (!slide.intent) missing.push('intent');
        if (!slide.key_message) missing.push('key_message');
        if (!slide.content) missing.push('content');
        return {
          rule: 'REQUIRED_FIELDS',
          message: `Slide ${index + 1}: missing required fields: ${missing.join(', ')}`,
          severity: 'error',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_KPI_DASHBOARD',
    description: `Performance overview: max ${MAX_KPI_DASHBOARD} KPIs`,
    check(slide, index) {
      if (slide.intent !== 'performance_overview') return null;
      const c = slide.content as PerformanceOverviewContent;
      if (c.kpis && c.kpis.length > MAX_KPI_DASHBOARD) {
        return {
          rule: 'MAX_KPI_DASHBOARD',
          message: `Slide ${index + 1}: ${c.kpis.length} KPIs (max ${MAX_KPI_DASHBOARD}). Truncating to ${MAX_KPI_DASHBOARD}.`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_BULLETS_EXEC',
    description: `Executive summary: max ${MAX_BULLETS} key findings`,
    check(slide, index) {
      if (slide.intent !== 'executive_summary') return null;
      const c = slide.content as ExecutiveSummaryContent;
      if (c.key_findings && c.key_findings.length > MAX_BULLETS) {
        return {
          rule: 'MAX_BULLETS_EXEC',
          message: `Slide ${index + 1}: ${c.key_findings.length} key findings (max ${MAX_BULLETS}).`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_KEY_MESSAGES',
    description: 'Key messages: max 4 messages',
    check(slide, index) {
      if (slide.intent !== 'key_messages') return null;
      const c = slide.content as KeyMessagesContent;
      if (c.messages && c.messages.length > 4) {
        return {
          rule: 'MAX_KEY_MESSAGES',
          message: `Slide ${index + 1}: ${c.messages.length} messages (max 4).`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_RECOMMENDATIONS',
    description: `Recommendation portfolio: max ${MAX_RECOMMENDATIONS_STACK} items`,
    check(slide, index) {
      if (slide.intent !== 'recommendation_portfolio') return null;
      const c = slide.content as RecommendationPortfolioContent;
      if (c.recommendations && c.recommendations.length > MAX_RECOMMENDATIONS_STACK) {
        return {
          rule: 'MAX_RECOMMENDATIONS',
          message: `Slide ${index + 1}: ${c.recommendations.length} recommendations (max ${MAX_RECOMMENDATIONS_STACK}).`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_RISKS',
    description: `Risk table: max ${MAX_RISKS} risks per slide`,
    check(slide, index) {
      if (slide.intent !== 'risk_management') return null;
      const c = slide.content as RiskManagementContent;
      if (c.risks && c.risks.length > MAX_RISKS) {
        return {
          rule: 'MAX_RISKS',
          message: `Slide ${index + 1}: ${c.risks.length} risks (max ${MAX_RISKS}).`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_ACTIONS',
    description: `Next steps: max ${MAX_ACTIONS} actions per slide`,
    check(slide, index) {
      if (slide.intent !== 'next_steps') return null;
      const c = slide.content as NextStepsContent;
      if (c.actions && c.actions.length > MAX_ACTIONS) {
        return {
          rule: 'MAX_ACTIONS',
          message: `Slide ${index + 1}: ${c.actions.length} actions (max ${MAX_ACTIONS}).`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_ROADMAP_PHASES',
    description: `Roadmap: max ${MAX_ROADMAP_PHASES} phases`,
    check(slide, index) {
      if (slide.intent !== 'roadmap') return null;
      const c = slide.content as RoadmapContent;
      if (c.phases && c.phases.length > MAX_ROADMAP_PHASES) {
        return {
          rule: 'MAX_ROADMAP_PHASES',
          message: `Slide ${index + 1}: ${c.phases.length} phases (max ${MAX_ROADMAP_PHASES}).`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'ROOT_CAUSE_LIMIT',
    description: 'Root cause: max 5 causes',
    check(slide, index) {
      if (slide.intent !== 'root_cause') return null;
      const c = slide.content as RootCauseContent;
      if (c.causes && c.causes.length > 5) {
        return {
          rule: 'ROOT_CAUSE_LIMIT',
          message: `Slide ${index + 1}: ${c.causes.length} causes (max 5).`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'MAX_INITIATIVES',
    description: `Initiative portfolio: max ${MAX_INITIATIVES_PER_SLIDE} initiatives per slide`,
    check(slide, index) {
      if (slide.intent !== 'initiative_portfolio') return null;
      const c = slide.content as InitiativePortfolioContent;
      if (c.initiatives && c.initiatives.length > MAX_INITIATIVES_PER_SLIDE) {
        return {
          rule: 'MAX_INITIATIVES',
          message: `Slide ${index + 1}: ${c.initiatives.length} initiatives (max ${MAX_INITIATIVES_PER_SLIDE} per slide). Extra items will be truncated.`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'INITIATIVE_REQUIRED_FIELDS',
    description: 'Each initiative must have at least a name',
    check(slide, index) {
      if (slide.intent !== 'initiative_portfolio') return null;
      const c = slide.content as InitiativePortfolioContent;
      const nameless = (c.initiatives || []).filter((i) => !i.name || i.name.trim() === '');
      if (nameless.length > 0) {
        return {
          rule: 'INITIATIVE_REQUIRED_FIELDS',
          message: `Slide ${index + 1}: ${nameless.length} initiatives missing name.`,
          severity: 'error',
          slideIndex: index,
        };
      }
      return null;
    },
  },
  {
    id: 'PRIORITIZATION_QUADRANT_LIMIT',
    description: `Prioritization matrix: max ${MAX_PRIORITIZATION_ITEMS} items per quadrant`,
    check(slide, index) {
      if (slide.intent !== 'prioritization_matrix') return null;
      const c = slide.content as PrioritizationMatrixContent;
      for (const quad of c.quadrants || []) {
        if (quad.items && quad.items.length > MAX_PRIORITIZATION_ITEMS) {
          return {
            rule: 'PRIORITIZATION_QUADRANT_LIMIT',
            message: `Slide ${index + 1}: quadrant "${quad.label}" has ${quad.items.length} items (max ${MAX_PRIORITIZATION_ITEMS}). Overflow will be summarized.`,
            severity: 'warning',
            slideIndex: index,
          };
        }
      }
      return null;
    },
  },
  {
    id: 'APPENDIX_BODY_LENGTH',
    description: 'Appendix body should be reasonable for a slide',
    check(slide, index) {
      if (slide.intent !== 'appendix') return null;
      const c = slide.content as AppendixContent;
      if (c.body && c.body.length > 2000) {
        return {
          rule: 'APPENDIX_BODY_LENGTH',
          message: `Slide ${index + 1}: appendix body is ${c.body.length} chars. Consider splitting.`,
          severity: 'warning',
          slideIndex: index,
        };
      }
      return null;
    },
  },
];

const REPORT_RULES: ReportRule[] = [
  {
    id: 'ZERO_CLAIM_CONTRADICTS_SOURCE',
    description: 'A zero initiatives/risks claim must agree with source-bearing report slides',
    check(report) {
      const zeroPattern =
        /\b0\s+(inicjatyw(?:a|y|ach|ami|om)?|ryzyk(?:o|a|ach|ami|om)?|initiatives?|risks?)\b/i;
      const hasInitiatives = report.slides.some((slide) => {
        if (slide.intent !== 'initiative_portfolio') return false;
        return ((slide.content as InitiativePortfolioContent).initiatives?.length ?? 0) > 0;
      });
      const hasRisks = report.slides.some((slide) => {
        if (slide.intent !== 'risk_management') return false;
        return ((slide.content as RiskManagementContent).risks?.length ?? 0) > 0;
      });

      return report.slides.flatMap((slide, slideIndex) => {
        if (slide.intent !== 'key_messages') return [];
        const content = slide.content as KeyMessagesContent;
        const text = [
          slide.key_message,
          ...(content.messages ?? []).flatMap((message) => [message.title, message.description]),
        ]
          .filter(Boolean)
          .join(' ');
        const match = text.match(zeroPattern);
        if (!match) return [];
        const claimsInitiatives = /inicjatyw|initiative/i.test(match[1]);
        if ((claimsInitiatives && !hasInitiatives) || (!claimsInitiatives && !hasRisks)) return [];
        return [
          {
            rule: 'ZERO_CLAIM_CONTRADICTS_SOURCE',
            message: `Slide ${slideIndex + 1}: claims "${match[0]}" but the report contains non-zero ${claimsInitiatives ? 'initiatives' : 'risks'} source data.`,
            severity: 'error' as const,
            slideIndex,
          },
        ];
      });
    },
  },
];

// ============================================================
// VALIDATE
// ============================================================

export function validateReport(report: UnifiedReportJSON): ValidationResult {
  const violations: RuleViolation[] = [];

  // Global check: must have at least 1 slide
  if (!report.slides || report.slides.length === 0) {
    violations.push({
      rule: 'EMPTY_REPORT',
      message: 'Report has no slides.',
      severity: 'error',
    });
    return { valid: false, violations };
  }

  // Per-slide checks
  for (let i = 0; i < report.slides.length; i++) {
    for (const rule of STRUCTURAL_RULES) {
      const violation = rule.check(report.slides[i], i);
      if (violation) {
        violations.push(violation);
      }
    }
  }

  for (const rule of REPORT_RULES) {
    violations.push(...rule.check(report));
  }

  const hasErrors = violations.some((v) => v.severity === 'error');
  return { valid: !hasErrors, violations };
}

// ============================================================
// DECISION RULES (spec section 9.2)
// ============================================================

/**
 * Auto-decide between single recommendation vs portfolio.
 * IF recommendations.count == 1 → recommendation_single
 * IF recommendations.count >= 3 → recommendation_portfolio
 */
export function decideRecommendationIntent(
  count: number
): 'recommendation_single' | 'recommendation_portfolio' {
  return count >= 3 ? 'recommendation_portfolio' : 'recommendation_single';
}

/**
 * Auto-decide between executive summary vs KPI dashboard.
 * IF kpis.count <= 2 → executive_summary
 * IF kpis.count > 2 → performance_overview
 */
export function decideKpiIntent(kpiCount: number): 'executive_summary' | 'performance_overview' {
  return kpiCount > 2 ? 'performance_overview' : 'executive_summary';
}

/**
 * Determine how many slides are needed for an initiative portfolio.
 * Max MAX_INITIATIVES_PER_SLIDE per slide → auto-paginate.
 */
export function decideInitiativeSlideCount(initiativeCount: number): number {
  return Math.max(1, Math.ceil(initiativeCount / MAX_INITIATIVES_PER_SLIDE));
}
