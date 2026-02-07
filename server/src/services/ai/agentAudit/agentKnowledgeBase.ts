/**
 * Agent Knowledge Base - Static KB entries for audit agents
 *
 * This module provides domain-specific knowledge for each agent type:
 * - Checklists: Verification points for specific domains
 * - Failure patterns: Common failure modes to watch for
 * - Metrics: Key indicators and thresholds
 * - Constraints: Hard limits and boundaries
 * - Cases: Reference cases and lessons learned
 *
 * KB entries are used by agents during audit to:
 * 1. Ground their analysis in domain expertise
 * 2. Identify missing data points
 * 3. Suggest specific deepening instructions
 */

import type { KBEntry, KBEntryType, RiskArea } from './types.js';

// ==========================================
// CFO / FINANCE AGENT KB
// ==========================================

const CFO_KB: KBEntry[] = [
  {
    id: 'cfo-checklist-capex',
    type: 'checklist',
    domain: 'finance.capex',
    purpose: 'CAPEX decision validation checklist',
    triggerQuestions: [
      'Is ROI/payback period clearly defined?',
      'Are cashflow projections month-by-month for first year?',
      'Is sensitivity analysis included (±20% revenue, ±30% cost)?',
      'Are financing options compared (lease vs buy vs rent)?',
      'Is working capital impact quantified?',
    ],
    limits: [
      'Payback > 36 months requires board approval',
      'IRR < WACC + 3% is high risk',
      'Single project > 15% annual CAPEX budget needs staged approval',
    ],
    severityHints: [
      'Missing cashflow projection = HIGH',
      'No sensitivity analysis = MEDIUM',
      'Unclear financing = MEDIUM',
    ],
    content: `## CAPEX Decision Checklist

### Must-Have Data
- [ ] Total investment amount (CAPEX + implementation costs)
- [ ] Monthly cashflow projection (minimum 12 months)
- [ ] ROI calculation with assumptions stated
- [ ] Payback period in months
- [ ] IRR vs WACC comparison
- [ ] Sensitivity analysis (revenue ±20%, costs ±30%)
- [ ] Working capital impact
- [ ] Financing options comparison

### Red Flags
- Payback > 36 months without strategic justification
- IRR < WACC + 3% risk premium
- No contingency budget (should be 10-20%)
- Single vendor dependency > 50% of project value
- Missing currency/inflation assumptions for multi-year projects

### Approval Thresholds
- < 100k PLN: Department head
- 100k-500k PLN: CFO
- 500k-2M PLN: CEO + CFO
- > 2M PLN: Board approval required`,
    version: '2.1',
  },
  {
    id: 'cfo-failure-cashflow',
    type: 'failure',
    domain: 'finance.cashflow',
    purpose: 'Common cashflow planning failures',
    triggerQuestions: [
      'Is seasonal variation accounted for?',
      'Are payment terms realistic?',
      'Is ramp-up period cashflow negative?',
    ],
    limits: [],
    severityHints: [
      'Ignoring seasonality = HIGH for retail/manufacturing',
      'Assuming 30-day payment when industry standard is 60-90 = HIGH',
    ],
    content: `## Cashflow Planning Failure Patterns

### Pattern 1: Optimistic Payment Assumptions
- **Symptom**: Plan assumes 30-day receivables
- **Reality**: Industry average is 45-90 days
- **Impact**: 2-3 month cashflow gap
- **Fix**: Use historical DSO + 15% buffer

### Pattern 2: Ignored Seasonality
- **Symptom**: Linear monthly projections
- **Reality**: Q4 can be 40% of annual revenue (retail)
- **Impact**: Q1-Q2 cash crunch
- **Fix**: Use 3-year historical monthly patterns

### Pattern 3: Underestimated Ramp-Up
- **Symptom**: Revenue starts month 1
- **Reality**: 3-6 month ramp to steady state
- **Impact**: Extended negative cashflow period
- **Fix**: Model 6-month ramp with 50% efficiency

### Pattern 4: Missing Working Capital
- **Symptom**: Only CAPEX in investment
- **Reality**: Inventory + receivables need funding
- **Impact**: 20-40% additional cash need
- **Fix**: Add working capital = 15-25% of first year revenue`,
    version: '1.3',
  },
  {
    id: 'cfo-metric-liquidity',
    type: 'metric',
    domain: 'finance.liquidity',
    purpose: 'Liquidity metrics and thresholds',
    triggerQuestions: [
      'What is current ratio after investment?',
      'Is quick ratio maintained above 1.0?',
      'Are covenant requirements met?',
    ],
    limits: [
      'Current ratio < 1.2 is warning zone',
      'Quick ratio < 0.8 requires immediate action',
      'Cash runway < 3 months is critical',
    ],
    severityHints: [],
    content: `## Liquidity Metrics Reference

### Current Ratio (Current Assets / Current Liabilities)
- Healthy: > 1.5
- Acceptable: 1.2 - 1.5
- Warning: 1.0 - 1.2
- Critical: < 1.0

### Quick Ratio (Cash + Receivables / Current Liabilities)
- Healthy: > 1.0
- Acceptable: 0.8 - 1.0
- Warning: 0.6 - 0.8
- Critical: < 0.6

### Cash Runway (Cash / Monthly Burn)
- Comfortable: > 12 months
- Adequate: 6-12 months
- Tight: 3-6 months
- Critical: < 3 months

### Debt Service Coverage Ratio (EBITDA / Debt Service)
- Strong: > 2.0
- Adequate: 1.5 - 2.0
- Tight: 1.2 - 1.5
- Covenant breach risk: < 1.2`,
    version: '1.0',
  },
];

// ==========================================
// IT SECURITY AGENT KB
// ==========================================

const IT_SECURITY_KB: KBEntry[] = [
  {
    id: 'it-checklist-integration',
    type: 'checklist',
    domain: 'it.integration',
    purpose: 'System integration security checklist',
    triggerQuestions: [
      'Is API authentication defined (OAuth2/API keys)?',
      'Is data encryption in transit and at rest specified?',
      'Are access controls documented?',
      'Is audit logging planned?',
    ],
    limits: [
      'No unencrypted PII transfer',
      'API keys must rotate every 90 days',
      'Admin access requires MFA',
    ],
    severityHints: [
      'Missing encryption = HIGH',
      'No access control plan = HIGH',
      'No audit logging = MEDIUM',
    ],
    content: `## Integration Security Checklist

### Authentication & Authorization
- [ ] API authentication method defined (OAuth2 preferred)
- [ ] Service account permissions documented
- [ ] Role-based access control (RBAC) designed
- [ ] MFA required for admin/privileged access
- [ ] API key rotation policy (max 90 days)

### Data Protection
- [ ] Data classification completed
- [ ] Encryption in transit (TLS 1.2+)
- [ ] Encryption at rest for sensitive data
- [ ] PII handling procedures documented
- [ ] Data retention policy defined

### Monitoring & Audit
- [ ] Security event logging enabled
- [ ] Log retention period defined (min 12 months)
- [ ] Alerting for security events
- [ ] Regular access reviews planned

### Compliance
- [ ] GDPR requirements mapped (if EU data)
- [ ] Industry-specific compliance checked
- [ ] Vendor security assessment completed
- [ ] Data processing agreement signed`,
    version: '2.0',
  },
  {
    id: 'it-failure-vendor',
    type: 'failure',
    domain: 'it.vendor_security',
    purpose: 'Vendor security assessment failures',
    triggerQuestions: [
      'Has vendor completed security questionnaire?',
      'Is SOC2/ISO27001 certification verified?',
      'Are SLAs for security incidents defined?',
    ],
    limits: [],
    severityHints: [
      'No vendor security assessment = HIGH',
      'Missing incident response SLA = MEDIUM',
    ],
    content: `## Vendor Security Failure Patterns

### Pattern 1: Trust Without Verify
- **Symptom**: Vendor claims "enterprise security"
- **Reality**: No SOC2, ISO27001, or equivalent
- **Impact**: Unknown security posture, compliance risk
- **Fix**: Require certification or detailed assessment

### Pattern 2: Unclear Data Handling
- **Symptom**: "Data is secure" without specifics
- **Reality**: May store unencrypted, share with subprocessors
- **Impact**: GDPR violation, data breach risk
- **Fix**: Detailed data flow diagram + DPA

### Pattern 3: No Incident Response
- **Symptom**: No SLA for security incidents
- **Reality**: 72h GDPR notification impossible
- **Impact**: Regulatory fines, reputation damage
- **Fix**: Contractual SLA: detect <24h, notify <48h

### Pattern 4: Lock-In Without Exit
- **Symptom**: Easy data import, no export
- **Reality**: Vendor dependency, ransom risk
- **Impact**: Cannot migrate, forced renewals
- **Fix**: Data export API + format in contract`,
    version: '1.2',
  },
];

// ==========================================
// MANUFACTURING AGENT KB
// ==========================================

const MANUFACTURING_KB: KBEntry[] = [
  {
    id: 'mfg-checklist-oee',
    type: 'checklist',
    domain: 'manufacturing.oee',
    purpose: 'OEE impact assessment checklist',
    triggerQuestions: [
      'Is baseline OEE documented?',
      'Are changeover time impacts quantified?',
      'Is training time for operators included?',
      'Are spare parts availability planned?',
    ],
    limits: [
      'OEE drop > 10% during implementation is high risk',
      'Changeover increase > 30% needs mitigation plan',
      'Training > 40h/operator needs phased rollout',
    ],
    severityHints: [
      'No baseline OEE = HIGH',
      'Missing changeover impact = MEDIUM',
      'No training plan = MEDIUM',
    ],
    content: `## OEE Impact Assessment Checklist

### Baseline Documentation
- [ ] Current OEE by line/cell (Availability × Performance × Quality)
- [ ] Historical OEE trend (12 months)
- [ ] Major loss categories identified
- [ ] Changeover time baseline

### Implementation Impact
- [ ] Expected OEE during transition (typically -15-25%)
- [ ] Ramp-up timeline to baseline (typically 2-4 weeks)
- [ ] Ramp-up timeline to target (typically 8-12 weeks)
- [ ] Changeover time impact quantified

### Resource Requirements
- [ ] Operator training hours estimated
- [ ] Maintenance training hours estimated
- [ ] Spare parts list and lead times
- [ ] Support coverage during ramp-up

### Risk Mitigation
- [ ] Parallel run possible?
- [ ] Rollback procedure defined?
- [ ] Buffer stock for transition period?
- [ ] Weekend/shutdown implementation option?`,
    version: '1.5',
  },
  {
    id: 'mfg-failure-changeover',
    type: 'failure',
    domain: 'manufacturing.changeover',
    purpose: 'Changeover optimization failure patterns',
    triggerQuestions: [
      'Is SMED analysis completed?',
      'Are internal vs external activities separated?',
      'Is standardized work documented?',
    ],
    limits: [],
    severityHints: [
      'No SMED analysis = MEDIUM',
      'Missing standardized work = MEDIUM',
    ],
    content: `## Changeover Failure Patterns

### Pattern 1: Tool Search Time
- **Symptom**: Operators searching for tools during changeover
- **Reality**: 15-30% of changeover is searching
- **Impact**: Extended downtime, frustration
- **Fix**: Shadow boards, 5S, tool kits per product

### Pattern 2: Adjustment Loops
- **Symptom**: Multiple trial runs after changeover
- **Reality**: Settings not documented or drifted
- **Impact**: 2-3x expected changeover time
- **Fix**: Documented settings, visual standards, gauges

### Pattern 3: Missing Parts
- **Symptom**: Changeover starts, parts not ready
- **Reality**: No pre-staging process
- **Impact**: Changeover becomes 2 separate events
- **Fix**: Kanban for changeover parts, staging area

### Pattern 4: Single-Person Dependency
- **Symptom**: Only one operator can do changeover
- **Reality**: Vacation/sick = extended downtime
- **Impact**: Schedule inflexibility, overtime
- **Fix**: Cross-training matrix, standardized work`,
    version: '1.1',
  },
  {
    id: 'mfg-constraint-safety',
    type: 'constraint',
    domain: 'manufacturing.safety',
    purpose: 'Safety constraints for implementation',
    triggerQuestions: [
      'Is LOTO procedure updated?',
      'Are risk assessments completed?',
      'Is PPE requirements defined?',
    ],
    limits: [
      'No implementation without updated LOTO',
      'Risk assessment must be signed off before start',
      'New equipment requires safety validation',
    ],
    severityHints: [
      'Missing LOTO update = HIGH (blocker)',
      'No risk assessment = HIGH (blocker)',
    ],
    content: `## Safety Implementation Constraints

### Non-Negotiable Requirements
1. **LOTO Procedure** - Must be updated before any equipment modification
2. **Risk Assessment** - Signed off by Safety + Operations
3. **PPE Matrix** - Updated for new hazards
4. **Emergency Procedures** - Reviewed and communicated

### Validation Gates
- Pre-implementation: Risk assessment approved
- During implementation: Daily safety briefings
- Post-implementation: Safety validation sign-off
- Ongoing: Updated training records

### Common Gaps
- Ergonomic assessment for new workstations
- Noise level measurement for new equipment
- Chemical handling for new processes
- Machine guarding for modified equipment

### Documentation Required
- Updated P&IDs with safety devices
- LOTO procedures per equipment
- Training records for all affected personnel
- Incident response procedures`,
    version: '1.0',
  },
];

// ==========================================
// HR AGENT KB
// ==========================================

const HR_KB: KBEntry[] = [
  {
    id: 'hr-checklist-change',
    type: 'checklist',
    domain: 'hr.change_management',
    purpose: 'Change readiness assessment checklist',
    triggerQuestions: [
      'Is change impact assessment completed?',
      'Are key stakeholders identified?',
      'Is communication plan defined?',
      'Is training plan resourced?',
    ],
    limits: [
      'Changes affecting >50 people need formal change management',
      'Role changes require 30-day notice minimum',
      'Training budget must be approved before commitment',
    ],
    severityHints: [
      'No stakeholder analysis = HIGH',
      'Missing communication plan = MEDIUM',
      'Unclear training needs = MEDIUM',
    ],
    content: `## Change Readiness Checklist

### Stakeholder Analysis
- [ ] Impacted roles identified
- [ ] Number of affected employees quantified
- [ ] Key influencers mapped
- [ ] Resistance sources anticipated
- [ ] Champions identified

### Communication Plan
- [ ] Key messages defined
- [ ] Communication timeline
- [ ] Channels selected (town hall, email, 1:1)
- [ ] Feedback mechanisms planned
- [ ] FAQ prepared

### Training Plan
- [ ] Skills gap analysis completed
- [ ] Training content identified/created
- [ ] Training schedule drafted
- [ ] Trainers identified (internal/external)
- [ ] Budget approved

### Support Structure
- [ ] Go-live support plan
- [ ] Escalation path defined
- [ ] Success metrics defined
- [ ] Post-implementation review scheduled`,
    version: '1.3',
  },
  {
    id: 'hr-failure-resistance',
    type: 'failure',
    domain: 'hr.resistance',
    purpose: 'Change resistance failure patterns',
    triggerQuestions: [
      'Are middle managers engaged?',
      'Is "what\'s in it for me" addressed?',
      'Are quick wins planned?',
    ],
    limits: [],
    severityHints: [
      'Middle management not engaged = HIGH',
      'No WIIFM messaging = MEDIUM',
    ],
    content: `## Change Resistance Failure Patterns

### Pattern 1: Frozen Middle
- **Symptom**: Leadership committed, floor confused
- **Reality**: Middle managers not bought in
- **Impact**: Passive resistance, slow adoption
- **Fix**: Dedicated middle manager engagement program

### Pattern 2: WIIFM Gap
- **Symptom**: "This is good for the company"
- **Reality**: Employees ask "what about me?"
- **Impact**: Cynicism, minimal effort
- **Fix**: Role-specific benefit messaging

### Pattern 3: Big Bang Burnout
- **Symptom**: Everything changes at once
- **Reality**: Cognitive overload
- **Impact**: Errors, frustration, turnover
- **Fix**: Phased rollout, quick wins first

### Pattern 4: Training ≠ Adoption
- **Symptom**: Everyone trained, nobody using
- **Reality**: Training without reinforcement
- **Impact**: Reversion to old ways
- **Fix**: Coaching, metrics, recognition program`,
    version: '1.0',
  },
];

// ==========================================
// PROJECT MANAGEMENT AGENT KB
// ==========================================

const PM_KB: KBEntry[] = [
  {
    id: 'pm-checklist-governance',
    type: 'checklist',
    domain: 'pm.governance',
    purpose: 'Project governance checklist',
    triggerQuestions: [
      'Is RACI matrix defined?',
      'Are decision rights clear?',
      'Is escalation path documented?',
      'Are steering committee meetings scheduled?',
    ],
    limits: [
      'Projects >500k need steering committee',
      'Cross-functional projects need RACI',
      'External vendors need contract governance',
    ],
    severityHints: [
      'No RACI = HIGH for cross-functional',
      'Missing escalation path = MEDIUM',
      'No steering committee for large project = HIGH',
    ],
    content: `## Project Governance Checklist

### RACI Matrix
- [ ] All key activities listed
- [ ] R (Responsible) assigned - one per activity
- [ ] A (Accountable) assigned - one per activity
- [ ] C (Consulted) identified
- [ ] I (Informed) identified
- [ ] No gaps or overlaps

### Decision Rights
- [ ] Budget authority levels defined
- [ ] Scope change approval process
- [ ] Technical decision authority
- [ ] Vendor selection authority
- [ ] Go/no-go decision makers

### Escalation Path
- [ ] Issue categories defined
- [ ] Escalation triggers documented
- [ ] Response time expectations
- [ ] Escalation contacts with backup

### Steering Committee
- [ ] Members identified
- [ ] Meeting cadence set
- [ ] Agenda template
- [ ] Decision log process
- [ ] Quorum requirements`,
    version: '1.2',
  },
  {
    id: 'pm-failure-scope',
    type: 'failure',
    domain: 'pm.scope',
    purpose: 'Scope management failure patterns',
    triggerQuestions: [
      'Is scope baseline documented?',
      'Is change control process defined?',
      'Are scope boundaries explicit?',
    ],
    limits: [],
    severityHints: [
      'No scope baseline = HIGH',
      'Missing change control = HIGH',
    ],
    content: `## Scope Management Failure Patterns

### Pattern 1: Scope Creep by Consensus
- **Symptom**: "Small" additions accumulate
- **Reality**: 30-50% scope growth untracked
- **Impact**: Budget/timeline overrun
- **Fix**: Formal change control for ANY addition

### Pattern 2: Undefined Boundaries
- **Symptom**: "We'll figure it out as we go"
- **Reality**: Different stakeholder expectations
- **Impact**: Conflict, rework, disappointment
- **Fix**: Explicit in-scope/out-of-scope list

### Pattern 3: Gold Plating
- **Symptom**: Team adds "nice to have" features
- **Reality**: Unrequested work consuming budget
- **Impact**: Core scope at risk
- **Fix**: Strict scope baseline, no unauthorized additions

### Pattern 4: Requirements Volatility
- **Symptom**: Requirements change weekly
- **Reality**: Stakeholders not aligned
- **Impact**: Rework, frustration, delays
- **Fix**: Requirements freeze with formal change process`,
    version: '1.1',
  },
];

// ==========================================
// ADVERSARIAL AGENT KB
// ==========================================

const ADVERSARIAL_KB: KBEntry[] = [
  {
    id: 'adv-checklist-falsifiability',
    type: 'checklist',
    domain: 'adversarial.falsifiability',
    purpose: 'Falsifiability and rigor checklist',
    triggerQuestions: [
      'Can claims be proven wrong?',
      'Are success criteria measurable?',
      'Are assumptions explicitly stated?',
      'Is confidence level appropriate?',
    ],
    limits: [
      'Unfalsifiable claims must be flagged',
      'Missing success criteria = incomplete analysis',
      'Overconfidence without data = red flag',
    ],
    severityHints: [
      'Unfalsifiable recommendation = HIGH',
      'No success criteria = HIGH',
      'Hidden assumptions = MEDIUM',
    ],
    content: `## Falsifiability Checklist

### Claim Validation
- [ ] Each major claim has evidence or is marked as assumption
- [ ] Claims can be proven wrong (falsifiable)
- [ ] Confidence levels stated (high/medium/low)
- [ ] Counter-evidence acknowledged

### Success Criteria
- [ ] Measurable outcomes defined
- [ ] Baseline measurements available
- [ ] Target values specified
- [ ] Measurement method defined
- [ ] Timeline for measurement

### Assumption Transparency
- [ ] Key assumptions explicitly listed
- [ ] Assumptions marked as validated/unvalidated
- [ ] Impact if assumption is wrong
- [ ] Plan to validate assumptions

### Bias Detection
- [ ] Confirmation bias checked
- [ ] Survivorship bias considered
- [ ] Availability heuristic noted
- [ ] Anchoring effects identified`,
    version: '1.0',
  },
  {
    id: 'adv-failure-overconfidence',
    type: 'failure',
    domain: 'adversarial.overconfidence',
    purpose: 'Overconfidence detection patterns',
    triggerQuestions: [
      'Is language appropriately hedged?',
      'Are uncertainties quantified?',
      'Is "what could go wrong" addressed?',
    ],
    limits: [],
    severityHints: [
      'Certainty without data = HIGH',
      'No risk acknowledgment = MEDIUM',
    ],
    content: `## Overconfidence Patterns

### Pattern 1: Certainty Language
- **Symptom**: "This will definitely...", "Guaranteed to..."
- **Reality**: Future is uncertain
- **Red Flag**: Definitive statements without evidence
- **Fix**: Conditional language, probability ranges

### Pattern 2: Single Scenario Planning
- **Symptom**: Only best-case scenario modeled
- **Reality**: Multiple outcomes possible
- **Red Flag**: No sensitivity analysis
- **Fix**: Best/base/worst case scenarios

### Pattern 3: Expert Overreliance
- **Symptom**: "Expert says X, therefore X"
- **Reality**: Experts can be wrong
- **Red Flag**: No independent verification
- **Fix**: Multiple sources, track record check

### Pattern 4: Hindsight Projection
- **Symptom**: "We've always done it this way"
- **Reality**: Past success ≠ future success
- **Red Flag**: No environmental change analysis
- **Fix**: Explicit assumption that conditions remain similar`,
    version: '1.0',
  },
];

// ==========================================
// KB REGISTRY AND ACCESS
// ==========================================

const KB_BY_AGENT: Record<string, KBEntry[]> = {
  'function.cfo_finance': CFO_KB,
  'function.it_security': IT_SECURITY_KB,
  'industry.manufacturing': MANUFACTURING_KB,
  'function.hr': HR_KB,
  'function.pm_project_management': PM_KB,
  'function.adversarial': ADVERSARIAL_KB,
};

/**
 * Get KB entries for a specific agent
 */
export function getAgentKB(agentId: string): KBEntry[] {
  return KB_BY_AGENT[agentId] || [];
}

/**
 * Get all KB entries
 */
export function getAllKBEntries(): KBEntry[] {
  return Object.values(KB_BY_AGENT).flat();
}

/**
 * Search KB entries by query
 */
export function searchKB(query: string, options?: {
  agentId?: string;
  types?: KBEntryType[];
  limit?: number;
}): KBEntry[] {
  const q = query.toLowerCase();
  let entries = options?.agentId
    ? getAgentKB(options.agentId)
    : getAllKBEntries();

  if (options?.types?.length) {
    entries = entries.filter((e) => options.types!.includes(e.type));
  }

  // Simple keyword matching (in production, use embeddings)
  const scored = entries.map((entry) => {
    const text = [
      entry.domain,
      entry.purpose,
      entry.content,
      ...entry.triggerQuestions,
      ...entry.limits,
    ].join(' ').toLowerCase();

    const words = q.split(/\s+/).filter((w) => w.length > 2);
    const matches = words.filter((w) => text.includes(w)).length;
    const score = words.length > 0 ? matches / words.length : 0;

    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, options?.limit || 5)
    .map((s) => s.entry);
}

/**
 * Get KB entries by type
 */
export function getKBByType(type: KBEntryType, agentId?: string): KBEntry[] {
  const entries = agentId ? getAgentKB(agentId) : getAllKBEntries();
  return entries.filter((e) => e.type === type);
}

/**
 * Get trigger questions for an agent
 */
export function getAgentTriggerQuestions(agentId: string): string[] {
  const kb = getAgentKB(agentId);
  return kb.flatMap((e) => e.triggerQuestions);
}

/**
 * Get severity hints for an agent
 */
export function getAgentSeverityHints(agentId: string): string[] {
  const kb = getAgentKB(agentId);
  return kb.flatMap((e) => e.severityHints);
}

/**
 * Get limits/constraints for an agent
 */
export function getAgentLimits(agentId: string): string[] {
  const kb = getAgentKB(agentId);
  return kb.flatMap((e) => e.limits);
}
