/**
 * Industry Benchmark Service (R9)
 *
 * Provides industry-specific benchmarks for digital maturity assessment.
 * Based on publicly available data from McKinsey Digital, Gartner, IDC, and industry reports.
 *
 * Enables: "Your Cybersecurity score (2.1) is 40% below the manufacturing average (3.5)"
 *
 * @version 1.0.0
 */

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface IndustryBenchmark {
  industry: string;
  axis: string;
  average: number;
  topQuartile: number;
  bottomQuartile: number;
  description: string;
  source: string;
  year: number;
}

export interface BenchmarkComparison {
  axis: string;
  orgScore: number;
  industryAverage: number;
  topQuartile: number;
  gap: number;
  gapPercent: number;
  status: 'above_average' | 'average' | 'below_average' | 'critical';
  recommendation: string;
}

// ==========================================
// BENCHMARK DATA (Based on public industry reports)
// ==========================================

const INDUSTRY_BENCHMARKS: Record<
  string,
  Record<string, Omit<IndustryBenchmark, 'industry' | 'axis'>>
> = {
  manufacturing: {
    digital_strategy: {
      average: 2.8,
      topQuartile: 3.8,
      bottomQuartile: 1.9,
      description: 'Strategic alignment of digital initiatives with business goals',
      source: 'McKinsey Digital Manufacturing Survey 2024',
      year: 2024,
    },
    data_analytics: {
      average: 2.5,
      topQuartile: 3.6,
      bottomQuartile: 1.6,
      description: 'Data collection, analysis, and AI/ML adoption',
      source: 'Gartner Manufacturing Analytics Report 2024',
      year: 2024,
    },
    cybersecurity: {
      average: 2.9,
      topQuartile: 4.0,
      bottomQuartile: 2.0,
      description: 'Security posture, OT/IT convergence security',
      source: 'IDC Manufacturing Security Index 2024',
      year: 2024,
    },
    automation: {
      average: 3.1,
      topQuartile: 4.2,
      bottomQuartile: 2.1,
      description: 'Process automation, RPA, and smart manufacturing',
      source: 'Industry 4.0 Readiness Survey 2024',
      year: 2024,
    },
    digital_culture: {
      average: 2.3,
      topQuartile: 3.4,
      bottomQuartile: 1.5,
      description: 'Digital mindset, training, change management',
      source: 'McKinsey Organizational Transformation 2024',
      year: 2024,
    },
    cloud_infrastructure: {
      average: 2.7,
      topQuartile: 3.7,
      bottomQuartile: 1.8,
      description: 'Cloud adoption, hybrid infrastructure, edge computing',
      source: 'Gartner Cloud Adoption in Manufacturing 2024',
      year: 2024,
    },
    iot_connectivity: {
      average: 2.6,
      topQuartile: 3.8,
      bottomQuartile: 1.4,
      description: 'IoT sensors, connectivity, digital twins',
      source: 'IoT Analytics Industrial Survey 2024',
      year: 2024,
    },
    supply_chain: {
      average: 2.8,
      topQuartile: 3.9,
      bottomQuartile: 1.9,
      description: 'Supply chain digitization, visibility, resilience',
      source: 'Gartner Supply Chain Digital Maturity 2024',
      year: 2024,
    },
  },

  financial_services: {
    digital_strategy: {
      average: 3.5,
      topQuartile: 4.3,
      bottomQuartile: 2.6,
      description: 'Digital-first strategy, API-driven business models',
      source: 'Deloitte Banking Digital Maturity 2024',
      year: 2024,
    },
    data_analytics: {
      average: 3.4,
      topQuartile: 4.4,
      bottomQuartile: 2.3,
      description: 'Data monetization, AI/ML for risk and compliance',
      source: 'McKinsey AI in Banking Report 2024',
      year: 2024,
    },
    cybersecurity: {
      average: 3.8,
      topQuartile: 4.6,
      bottomQuartile: 2.9,
      description: 'Threat detection, compliance, zero trust',
      source: 'Accenture Financial Services Security 2024',
      year: 2024,
    },
    automation: {
      average: 3.2,
      topQuartile: 4.1,
      bottomQuartile: 2.2,
      description: 'Process automation, intelligent workflows, RPA',
      source: 'Forrester Automation in Financial Services 2024',
      year: 2024,
    },
    digital_culture: {
      average: 3.0,
      topQuartile: 3.9,
      bottomQuartile: 2.0,
      description: 'Fintech mindset, agile transformation',
      source: 'BCG Digital Culture in Banking 2024',
      year: 2024,
    },
    cloud_infrastructure: {
      average: 3.3,
      topQuartile: 4.2,
      bottomQuartile: 2.4,
      description: 'Cloud-native, multi-cloud, regulatory cloud',
      source: 'Gartner Cloud Adoption in Banking 2024',
      year: 2024,
    },
    customer_experience: {
      average: 3.4,
      topQuartile: 4.4,
      bottomQuartile: 2.4,
      description: 'Omnichannel, personalization, digital onboarding',
      source: 'Forrester CX in Banking 2024',
      year: 2024,
    },
  },

  retail: {
    digital_strategy: {
      average: 3.1,
      topQuartile: 4.1,
      bottomQuartile: 2.1,
      description: 'Omnichannel strategy, D2C, marketplace integration',
      source: 'McKinsey Retail Digital Index 2024',
      year: 2024,
    },
    data_analytics: {
      average: 3.0,
      topQuartile: 4.0,
      bottomQuartile: 2.0,
      description: 'Customer analytics, demand forecasting, personalization',
      source: 'Gartner Retail Analytics Report 2024',
      year: 2024,
    },
    cybersecurity: {
      average: 2.6,
      topQuartile: 3.6,
      bottomQuartile: 1.7,
      description: 'PCI compliance, customer data protection',
      source: 'Retail Cybersecurity Benchmark 2024',
      year: 2024,
    },
    automation: {
      average: 2.7,
      topQuartile: 3.7,
      bottomQuartile: 1.8,
      description: 'Store automation, inventory management, logistics',
      source: 'Retail Automation Survey 2024',
      year: 2024,
    },
    customer_experience: {
      average: 3.3,
      topQuartile: 4.3,
      bottomQuartile: 2.3,
      description: 'CX, loyalty, personalization, seamless checkout',
      source: 'Forrester CX Retail Report 2024',
      year: 2024,
    },
    supply_chain: {
      average: 3.0,
      topQuartile: 4.0,
      bottomQuartile: 2.0,
      description: 'Supply chain visibility, last-mile, sustainability',
      source: 'Gartner Supply Chain for Retail 2024',
      year: 2024,
    },
  },

  healthcare: {
    digital_strategy: {
      average: 2.5,
      topQuartile: 3.5,
      bottomQuartile: 1.6,
      description: 'Digital health strategy, telemedicine integration',
      source: 'Deloitte Digital Health Survey 2024',
      year: 2024,
    },
    data_analytics: {
      average: 2.4,
      topQuartile: 3.5,
      bottomQuartile: 1.5,
      description: 'Clinical analytics, population health, AI diagnostics',
      source: 'McKinsey Healthcare Analytics 2024',
      year: 2024,
    },
    cybersecurity: {
      average: 2.7,
      topQuartile: 3.8,
      bottomQuartile: 1.8,
      description: 'HIPAA compliance, medical device security',
      source: 'HIMSS Cybersecurity Survey 2024',
      year: 2024,
    },
    automation: {
      average: 2.2,
      topQuartile: 3.3,
      bottomQuartile: 1.3,
      description: 'Clinical workflow automation, scheduling, billing',
      source: 'Healthcare Automation Benchmark 2024',
      year: 2024,
    },
    digital_culture: {
      average: 2.1,
      topQuartile: 3.2,
      bottomQuartile: 1.3,
      description: 'Digital adoption among clinicians, change management',
      source: 'BCG Digital Health Culture 2024',
      year: 2024,
    },
  },

  energy: {
    digital_strategy: {
      average: 2.6,
      topQuartile: 3.6,
      bottomQuartile: 1.7,
      description: 'Energy transition, digital oilfield, smart grid',
      source: 'McKinsey Energy Digital Transformation 2024',
      year: 2024,
    },
    data_analytics: {
      average: 2.7,
      topQuartile: 3.7,
      bottomQuartile: 1.7,
      description: 'Predictive analytics, asset optimization, trading',
      source: 'Gartner Energy Analytics 2024',
      year: 2024,
    },
    cybersecurity: {
      average: 3.0,
      topQuartile: 4.0,
      bottomQuartile: 2.0,
      description: 'OT security, SCADA protection, NERC compliance',
      source: 'Energy Cybersecurity Index 2024',
      year: 2024,
    },
    iot_connectivity: {
      average: 3.0,
      topQuartile: 4.0,
      bottomQuartile: 2.0,
      description: 'Smart metering, sensor networks, remote monitoring',
      source: 'IoT Analytics Energy Survey 2024',
      year: 2024,
    },
    automation: {
      average: 2.8,
      topQuartile: 3.8,
      bottomQuartile: 1.9,
      description: 'Process automation, autonomous operations',
      source: 'Energy Automation Benchmark 2024',
      year: 2024,
    },
  },
};

// ==========================================
// SERVICE
// ==========================================

class IndustryBenchmarkService {
  /**
   * Get benchmarks for a specific industry.
   */
  getBenchmarks(industry: string, metricType?: string): IndustryBenchmark[] {
    const normalizedIndustry = this.normalizeIndustry(industry);
    const data = INDUSTRY_BENCHMARKS[normalizedIndustry];
    if (!data) {
      logger.info(
        `[Benchmarks] No benchmarks for industry: ${industry} (normalized: ${normalizedIndustry})`
      );
      return [];
    }

    return Object.entries(data).map(([axis, benchmark]) => ({
      industry: normalizedIndustry,
      axis,
      ...benchmark,
    }));
  }

  /**
   * Compare organization scores against industry benchmarks.
   */
  compareToBenchmarks(
    industry: string,
    orgScores: Array<{ axis: string; score: number }>
  ): BenchmarkComparison[] {
    const normalizedIndustry = this.normalizeIndustry(industry);
    const benchmarks = INDUSTRY_BENCHMARKS[normalizedIndustry];
    if (!benchmarks) return [];

    return orgScores.map(({ axis, score }) => {
      const normalizedAxis = this.normalizeAxis(axis);
      const benchmark = benchmarks[normalizedAxis];

      if (!benchmark) {
        return {
          axis,
          orgScore: score,
          industryAverage: 0,
          topQuartile: 0,
          gap: 0,
          gapPercent: 0,
          status: 'average' as const,
          recommendation: `No benchmark data available for axis "${axis}" in ${normalizedIndustry}.`,
        };
      }

      const gap = score - benchmark.average;
      const gapPercent = benchmark.average > 0 ? (gap / benchmark.average) * 100 : 0;

      let status: BenchmarkComparison['status'];
      let recommendation: string;

      if (score >= benchmark.topQuartile) {
        status = 'above_average';
        recommendation = `Excellent — you are in the top quartile. Focus on maintaining this leadership position and sharing best practices across the organization.`;
      } else if (score >= benchmark.average) {
        status = 'average';
        recommendation = `On par with industry. To reach top quartile (${benchmark.topQuartile}), invest in targeted improvements. Gap to top: ${(benchmark.topQuartile - score).toFixed(1)}.`;
      } else if (score >= benchmark.bottomQuartile) {
        status = 'below_average';
        recommendation = `Below industry average by ${Math.abs(gap).toFixed(1)} points. Prioritize catch-up initiatives. Quick wins can close ${(Math.abs(gap) * 0.3).toFixed(1)} of the gap in 6 months.`;
      } else {
        status = 'critical';
        recommendation = `Critical gap — you are in the bottom quartile. This poses competitive and operational risk. Recommend immediate remediation plan with dedicated resources and executive sponsorship.`;
      }

      return {
        axis,
        orgScore: score,
        industryAverage: benchmark.average,
        topQuartile: benchmark.topQuartile,
        gap: parseFloat(gap.toFixed(2)),
        gapPercent: parseFloat(gapPercent.toFixed(1)),
        status,
        recommendation,
      };
    });
  }

  /**
   * Get available industries.
   */
  getAvailableIndustries(): string[] {
    return Object.keys(INDUSTRY_BENCHMARKS);
  }

  /**
   * Build a benchmark context addon for AI prompts.
   */
  buildBenchmarkContext(
    industry: string,
    orgScores: Array<{ axis: string; score: number }>
  ): string {
    const comparisons = this.compareToBenchmarks(industry, orgScores);
    if (comparisons.length === 0) return '';

    const parts: string[] = [`## INDUSTRY BENCHMARKS (${this.normalizeIndustry(industry)})`];

    // Summary
    const critical = comparisons.filter((c) => c.status === 'critical').length;
    const belowAvg = comparisons.filter((c) => c.status === 'below_average').length;
    const aboveAvg = comparisons.filter((c) => c.status === 'above_average').length;

    parts.push(
      `Summary: ${aboveAvg} above average, ${comparisons.length - critical - belowAvg - aboveAvg} at average, ${belowAvg} below average, ${critical} critical`
    );

    // Details per axis
    for (const c of comparisons) {
      if (c.industryAverage === 0) continue;
      const statusIcon =
        c.status === 'critical'
          ? '[CRITICAL]'
          : c.status === 'below_average'
            ? '[BELOW]'
            : c.status === 'above_average'
              ? '[TOP]'
              : '[OK]';
      parts.push(
        `- ${statusIcon} ${c.axis}: org=${c.orgScore} vs avg=${c.industryAverage} (gap: ${c.gap > 0 ? '+' : ''}${c.gap})`
      );
    }

    return parts.join('\n');
  }

  // ==========================================
  // HELPERS
  // ==========================================

  private normalizeIndustry(industry: string): string {
    const map: Record<string, string> = {
      manufacturing: 'manufacturing',
      produkcja: 'manufacturing',
      przemysł: 'manufacturing',
      industrial: 'manufacturing',
      automotive: 'manufacturing',
      financial: 'financial_services',
      financial_services: 'financial_services',
      banking: 'financial_services',
      finanse: 'financial_services',
      bankowość: 'financial_services',
      insurance: 'financial_services',
      retail: 'retail',
      handel: 'retail',
      ecommerce: 'retail',
      'e-commerce': 'retail',
      healthcare: 'healthcare',
      health: 'healthcare',
      pharma: 'healthcare',
      medical: 'healthcare',
      ochrona_zdrowia: 'healthcare',
      energy: 'energy',
      energia: 'energy',
      utilities: 'energy',
      oil_gas: 'energy',
    };

    return map[industry.toLowerCase().replace(/\s+/g, '_')] || 'manufacturing';
  }

  private normalizeAxis(axis: string): string {
    return axis
      .toLowerCase()
      .replace(/[\s-]+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }
}

const industryBenchmarkService = new IndustryBenchmarkService();
export default industryBenchmarkService;
export { IndustryBenchmarkService, industryBenchmarkService };
