/**
 * Sample Reports Index
 *
 * This folder contains 9 professional sample reports demonstrating the
 * Report Builder capabilities across three assessment frameworks:
 *
 * ## Frameworks
 *
 * 1. **DRD** (Digital Readiness Diagnosis)
 *    - 7 Axes of Digital Transformation
 *    - 34 assessment areas
 *    - Based on "Digital Pathfinder" by Dr. Piotr Wisniewski
 *
 * 2. **SIRI** (Smart Industry Readiness Index)
 *    - 3 Building Blocks (Process, Technology, Organization)
 *    - 8 Dimensions, 16 Prioritisation Areas
 *    - Singapore EDB / TÜV SÜD methodology
 *
 * 3. **ADMA** (Advanced Digital Maturity Assessment)
 *    - 5 Pillars, 12 Dimensions
 *    - European Commission / Digital Innovation Hubs standard
 *
 * ## Report Templates
 *
 * Each framework has 3 report types optimized for different audiences:
 *
 * 1. **Full Diagnostic Report** (Pełny Raport Diagnostyczny)
 *    - Comprehensive analysis for transformation teams
 *    - All assessment areas covered in detail
 *    - Detailed matrices, charts, and visualizations
 *    - Complete roadmap and recommendations
 *
 * 2. **Board Pack** (Raport dla Zarządu)
 *    - Executive summary format
 *    - Strategic insights and decisions required
 *    - High-level visualizations
 *    - Investment priorities and ROI
 *
 * 3. **Bank Pack** (Raport do Banku)
 *    - Formal format for financial institutions
 *    - Risk-focused analysis
 *    - Transformation capability assessment
 *    - Investment requirements and expected ROI
 *
 * ## Files
 *
 * ### Sample Assessment Data
 * - sample-assessments.ts - Sample assessment data for all 3 frameworks
 *
 * ### DRD Reports
 * - drd-full-diagnostic-report.md - Full diagnostic (~8000 words)
 * - drd-board-pack-report.md - Executive summary (~2500 words)
 * - drd-bank-pack-report.md - Financial institution format (~3500 words)
 *
 * ### SIRI Reports
 * - siri-full-diagnostic-report.md - Full Industry 4.0 assessment (~6500 words)
 * - siri-board-pack-report.md - Executive summary (~1800 words)
 * - siri-bank-pack-report.md - Financial institution format (~3000 words)
 *
 * ### ADMA Reports
 * - adma-full-diagnostic-report.md - Full EU standard assessment (~6000 words)
 * - adma-board-pack-report.md - Executive summary (~1800 words)
 * - adma-bank-pack-report.md - Financial institution format (~2800 words)
 *
 * ## Usage
 *
 * These sample reports can be used for:
 * 1. Template validation and testing
 * 2. AI content generation fine-tuning
 * 3. User training and onboarding
 * 4. Demonstration to potential clients
 * 5. Quality benchmark for generated reports
 *
 * ## Language
 *
 * All reports are in Polish (primary) with English terminology where appropriate.
 * The Report Builder supports multi-language generation.
 */

// Export sample assessment data
export * from './sample-assessments';

// Report file paths (for reference)
export const SAMPLE_REPORTS = {
  DRD: {
    fullDiagnostic: './drd-full-diagnostic-report.md',
    boardPack: './drd-board-pack-report.md',
    bankPack: './drd-bank-pack-report.md',
  },
  SIRI: {
    fullDiagnostic: './siri-full-diagnostic-report.md',
    boardPack: './siri-board-pack-report.md',
    bankPack: './siri-bank-pack-report.md',
  },
  ADMA: {
    fullDiagnostic: './adma-full-diagnostic-report.md',
    boardPack: './adma-board-pack-report.md',
    bankPack: './adma-bank-pack-report.md',
  },
};

// Template IDs matching the migration
export const TEMPLATE_IDS = {
  DRD: {
    fullDiagnostic: 'tpl-drd-full-diagnostic',
    boardPack: 'tpl-drd-board-pack',
    bankPack: 'tpl-drd-bank-pack',
  },
  SIRI: {
    fullDiagnostic: 'tpl-siri-full-diagnostic',
    boardPack: 'tpl-siri-board-pack',
    bankPack: 'tpl-siri-bank-pack',
  },
  ADMA: {
    fullDiagnostic: 'tpl-adma-full-diagnostic',
    boardPack: 'tpl-adma-board-pack',
    bankPack: 'tpl-adma-bank-pack',
  },
};

export default {
  SAMPLE_REPORTS,
  TEMPLATE_IDS,
};
