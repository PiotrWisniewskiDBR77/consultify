-- INSIGHT-PROFESSIONAL-V2: Professional content for org-dbr77-test insights
-- Migration: 427_insight_professional_content_v2.sql
-- Purpose: Add comprehensive, BCG-quality content to interview insights
-- Date: 2026-01-27

-- ==========================================
-- UPDATE INSIGHTS FOR org-dbr77-test
-- ==========================================

-- insight-001: Legacy System Dependency
UPDATE interview_insights SET 
description = '## Legacy System Dependency Analysis

### Executive Summary

Heavy reliance on **SAP R/3** creates significant integration challenges and limits organizational agility in digital transformation initiatives.

### Current State Assessment

| System | Version | Age | Integration Status |
|--------|---------|-----|-------------------|
| SAP R/3 | 4.7 | 15 years | Core ERP |
| Salesforce | Enterprise | 5 years | Manual sync |
| Excel | Various | N/A | Data silos |
| Custom Apps | Legacy | 10+ years | No API |

### Key Findings

1. **Data Synchronization Issues**
   - Manual data transfer between SAP and Salesforce
   - 8-hour lag in customer data updates
   - 15% data inconsistency rate

2. **Integration Gaps**
   - No real-time API connections
   - Batch processing only (nightly)
   - Custom middleware aging out

3. **Technical Debt**
   - ABAP customizations: 2,500+ programs
   - Undocumented modifications
   - Single point of failure risks

### Business Impact

| Impact Area | Annual Cost | Risk Level |
|-------------|-------------|------------|
| Manual Data Entry | $180K | Medium |
| Error Correction | $95K | High |
| Delayed Decisions | $250K | High |
| Integration Maintenance | $120K | Medium |
| **Total** | **$645K** | - |

### Recommended Actions

**Phase 1: Stabilize (0-3 months)**
- Document all integrations
- Implement monitoring
- Create data dictionary

**Phase 2: Modernize (3-12 months)**
- Deploy integration platform
- Build real-time APIs
- Migrate to S/4HANA

### Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| System failure | Medium | Critical | Redundancy plan |
| Data loss | Low | Critical | Backup strategy |
| Skill shortage | High | High | Training program |'
WHERE id = 'insight-001';

-- insight-002: Manual Process Waste
UPDATE interview_insights SET 
description = '## Manual Process Waste Analysis

### Executive Summary

**60% of data entry is manual**, creating significant waste and error potential across operations. Order processing takes **3 days** vs. industry benchmark of **4 hours**.

### Waste Identification (Lean 8 Wastes)

| Waste Type | Current State | Impact |
|------------|---------------|--------|
| **Waiting** | 48h queue time | $120K/yr |
| **Defects** | 8% error rate | $85K/yr |
| **Over-processing** | Triple data entry | $95K/yr |
| **Motion** | Manual file handling | $45K/yr |
| **Transportation** | Paper routing | $25K/yr |
| **Total** | - | **$370K/yr** |

### Process Analysis: Order-to-Cash

```
Current State (72 hours):
[Order] → [Manual Entry] → [Validation] → [Approval] → [Processing] → [Fulfillment]
   ↓           ↓              ↓            ↓             ↓
  2h         4h            8h          24h          34h

Target State (4 hours):
[Order] → [Auto-Capture] → [Rules Engine] → [Auto-Approval] → [Fulfillment]
   ↓           ↓              ↓                ↓                ↓
  0h         0.5h          0.5h             1h               2h
```

### Root Cause Analysis

1. **No System Integration**
   - Orders arrive via email, fax, phone
   - Manual re-keying into ERP
   - No validation at source

2. **Paper-Based Workflows**
   - Physical signatures required
   - Document routing delays
   - Filing and retrieval waste

3. **Lack of Automation**
   - No RPA deployed
   - Manual approval routing
   - No exception handling

### Quick Wins (0-30 days)

| Initiative | Investment | Savings | Payback |
|------------|------------|---------|---------|
| Email parser | $15K | $45K/yr | 4 months |
| E-signature | $8K | $25K/yr | 4 months |
| Auto-validation | $20K | $60K/yr | 4 months |

### Automation Roadmap

**Phase 1: Capture (Month 1-2)**
- Deploy email/fax capture
- OCR for paper documents
- Web portal for customers

**Phase 2: Process (Month 3-4)**
- RPA for data entry
- Rules-based validation
- Workflow automation

**Phase 3: Optimize (Month 5-6)**
- Machine learning for exceptions
- Predictive processing
- Self-service portal'
WHERE id = 'insight-002';

-- insight-003: Change Resistance Risk
UPDATE interview_insights SET 
description = '## Change Resistance Risk Assessment

### Executive Summary

Previous failed implementations have created **organizational skepticism** that poses significant risk to transformation success. No formal change management process exists.

### Historical Analysis

| Initiative | Year | Outcome | Root Cause |
|------------|------|---------|------------|
| ERP Phase 1 | 2019 | Failed | Poor training |
| CRM Rollout | 2020 | Partial | Resistance |
| WMS Project | 2021 | Delayed | Scope creep |
| BI Platform | 2022 | Abandoned | No adoption |

### Resistance Assessment

**By Department:**

| Department | Resistance Level | Key Concerns |
|------------|------------------|--------------|
| Operations | 🔴 High | Job security, complexity |
| Finance | 🟡 Medium | Process changes |
| Sales | 🟢 Low | Sees benefits |
| IT | 🟡 Medium | Workload concerns |

**By Level:**

| Level | Support | Neutral | Resistant |
|-------|---------|---------|-----------|
| Executive | 80% | 15% | 5% |
| Management | 45% | 30% | 25% |
| Front-line | 20% | 35% | 45% |

### Key Risk Factors

1. **Trust Deficit**
   - 3 failed projects in 4 years
   - Promises not kept
   - "Initiative fatigue"

2. **Communication Gaps**
   - No clear vision shared
   - Rumors fill vacuum
   - Inconsistent messaging

3. **Capability Concerns**
   - Fear of inadequacy
   - Limited training history
   - Technology anxiety

### Mitigation Strategy

**Immediate Actions (Week 1-4)**
- Executive town hall
- Department listening sessions
- Quick win identification

**Short Term (Month 1-3)**
- Change champion network
- Communication cadence
- Training needs assessment

**Medium Term (Month 3-6)**
- Comprehensive training program
- Recognition program
- Feedback mechanisms

### Success Metrics

| Metric | Baseline | Target | Timeline |
|--------|----------|--------|----------|
| Employee sentiment | 35% positive | 70% | 6 months |
| Training completion | 0% | 95% | 3 months |
| Adoption rate | N/A | 80% | 6 months |
| Support tickets | N/A | <50/week | 3 months |'
WHERE id = 'insight-003';

-- insight-004: ROI Measurement Gap
UPDATE interview_insights SET 
description = '## ROI Measurement Gap Analysis

### Executive Summary

Lack of formal ROI framework limits ability to **justify investments** and **measure success**. Current metrics are basic and inconsistent.

### Current State

**Metrics Tracked:**
- Cost savings (inconsistent methodology)
- Project completion (time/budget)
- Basic KPIs (varies by department)

**Metrics NOT Tracked:**
- Business value realization
- Productivity improvements
- Customer impact
- Strategic alignment

### Gap Analysis

| Capability | Current | Required | Gap |
|------------|---------|----------|-----|
| Benefits identification | Ad-hoc | Structured | 🔴 Critical |
| Baseline measurement | Partial | Complete | 🔴 Critical |
| Tracking mechanism | None | Automated | 🔴 Critical |
| Reporting | Manual | Dashboard | 🟡 High |
| Accountability | Unclear | Defined | 🟡 High |

### Business Impact

**Without ROI Framework:**
- Cannot prioritize investments
- No accountability for benefits
- Difficult to secure funding
- Cannot learn from failures

**Estimated Value at Risk:**
- Suboptimal investments: $500K/yr
- Unrealized benefits: $800K/yr
- Delayed decisions: $300K/yr
- **Total: $1.6M/yr**

### Recommended Framework

**1. Benefits Identification**
```
Strategic Alignment → Business Case → Benefits Register
        ↓                  ↓                ↓
    Objectives         Metrics          Owners
```

**2. Measurement Approach**

| Benefit Type | Measurement | Frequency |
|--------------|-------------|-----------|
| Cost reduction | Actuals vs. baseline | Monthly |
| Revenue increase | Sales data | Monthly |
| Productivity | Time studies | Quarterly |
| Quality | Defect rates | Weekly |
| Customer | NPS/CSAT | Monthly |

**3. Governance**

| Role | Responsibility |
|------|----------------|
| Sponsor | Benefits ownership |
| PMO | Tracking & reporting |
| Finance | Validation |
| Business | Realization |

### Implementation Roadmap

**Phase 1: Foundation (Month 1)**
- Define benefit categories
- Create templates
- Assign owners

**Phase 2: Baseline (Month 2)**
- Measure current state
- Set targets
- Build dashboard

**Phase 3: Operationalize (Month 3+)**
- Monthly reviews
- Quarterly reports
- Annual assessment'
WHERE id = 'insight-004';

-- insight-005: OEE Improvement Potential
UPDATE interview_insights SET 
description = '## OEE Improvement Analysis

### Executive Summary

Current OEE of **65%** indicates significant improvement opportunity. World-class benchmark is **85%**, representing potential **$2.4M annual value**.

### Current Performance

| Metric | Current | Benchmark | Gap |
|--------|---------|-----------|-----|
| **Availability** | 80% | 92% | -12% |
| **Performance** | 85% | 95% | -10% |
| **Quality** | 96% | 99% | -3% |
| **OEE** | **65%** | **85%** | **-20%** |

### Loss Analysis

**Availability Losses (20%)**
| Loss Category | % of Total | Root Cause |
|---------------|------------|------------|
| Changeovers | 8% | No SMED |
| Breakdowns | 6% | Reactive maintenance |
| Material wait | 4% | Supply issues |
| Startup | 2% | No standard |

**Performance Losses (15%)**
| Loss Category | % of Total | Root Cause |
|---------------|------------|------------|
| Minor stops | 8% | No TPM |
| Reduced speed | 5% | Operator skill |
| Idling | 2% | Planning gaps |

**Quality Losses (4%)**
| Loss Category | % of Total | Root Cause |
|---------------|------------|------------|
| Defects | 2.5% | Process variation |
| Rework | 1.5% | No SPC |

### Financial Impact

| Improvement Area | OEE Gain | Annual Value |
|------------------|----------|--------------|
| SMED implementation | +5% | $600K |
| TPM program | +6% | $720K |
| Predictive maintenance | +4% | $480K |
| SPC deployment | +2% | $240K |
| Training | +3% | $360K |
| **Total** | **+20%** | **$2.4M** |

### Improvement Roadmap

**Quick Wins (0-3 months)**
- 5S blitz on Line 3
- Changeover video analysis
- Operator skill matrix

**Medium Term (3-6 months)**
- SMED workshop (top 5 SKUs)
- TPM pilot (Line 1)
- Real-time OEE dashboard

**Long Term (6-12 months)**
- Full TPM rollout
- Predictive maintenance
- Advanced analytics

### Success Metrics

| Milestone | Target | Timeline |
|-----------|--------|----------|
| OEE 70% | +5% | Month 3 |
| OEE 75% | +10% | Month 6 |
| OEE 80% | +15% | Month 9 |
| OEE 85% | +20% | Month 12 |'
WHERE id = 'insight-005';

-- insight-006: SMED Priority
UPDATE interview_insights SET 
description = '## SMED Priority Analysis

### Executive Summary

Line 3 changeover time of **90 minutes** is a major bottleneck. Average across plant is 45 minutes. SMED implementation could reduce this by **50-70%**.

### Current State

| Line | Avg Changeover | Best | Worst | Frequency |
|------|----------------|------|-------|-----------|
| Line 1 | 35 min | 25 min | 50 min | 8/week |
| Line 2 | 40 min | 30 min | 55 min | 6/week |
| **Line 3** | **90 min** | 70 min | 120 min | 12/week |
| Line 4 | 45 min | 35 min | 60 min | 10/week |

### Line 3 Deep Dive

**Changeover Breakdown:**
| Activity | Time | Internal/External |
|----------|------|-------------------|
| Tool search | 15 min | External |
| Die removal | 20 min | Internal |
| Die installation | 25 min | Internal |
| Adjustments | 20 min | Internal |
| First article | 10 min | Internal |
| **Total** | **90 min** | - |

### SMED Opportunity

**Current vs. Target:**
```
Current (90 min):
[Stop] → [Search] → [Remove] → [Install] → [Adjust] → [Run]
         15 min    20 min     25 min     20 min    10 min

Target (30 min):
[Prep External] → [Stop] → [Quick Change] → [Run]
    15 min          0        30 min          0
```

### Financial Impact

| Metric | Current | After SMED | Improvement |
|--------|---------|------------|-------------|
| Changeover time | 90 min | 30 min | -67% |
| Weekly downtime | 18 hrs | 6 hrs | -12 hrs |
| Annual capacity | - | +624 hrs | +$780K |
| Overtime | $120K | $40K | -$80K |
| **Total Value** | - | - | **$860K/yr** |

### Implementation Plan

**Week 1: Observe**
- Video all changeovers
- Document current state
- Identify waste

**Week 2: Analyze**
- Separate internal/external
- Identify conversion opportunities
- Design improvements

**Week 3: Implement**
- Pre-staging procedures
- Quick-release fixtures
- Shadow boards

**Week 4: Standardize**
- Create standard work
- Train operators
- Visual management

### Investment Required

| Item | Cost |
|------|------|
| Quick-release fixtures | $15K |
| Shadow boards | $3K |
| Training | $5K |
| Consulting | $12K |
| **Total** | **$35K** |

**ROI: 24x in Year 1**'
WHERE id = 'insight-006';

-- insight-007: MES Prerequisite
UPDATE interview_insights SET 
description = '## MES Prerequisite Analysis

### Executive Summary

Manual data collection prevents **real-time visibility** and **advanced analytics**. MES is a prerequisite for digital transformation.

### Current State

**Data Collection Methods:**
| Data Type | Method | Delay | Accuracy |
|-----------|--------|-------|----------|
| Production counts | Paper forms | 8 hrs | 85% |
| Quality data | Excel | 4 hrs | 90% |
| Downtime | Supervisor log | 24 hrs | 70% |
| OEE | Manual calc | Weekly | 75% |

### Gap Analysis

| Capability | Current | With MES | Gap |
|------------|---------|----------|-----|
| Real-time visibility | ❌ | ✅ | Critical |
| Automatic data capture | ❌ | ✅ | Critical |
| OEE calculation | Weekly | Real-time | High |
| Quality tracking | Manual | Automated | High |
| Traceability | Partial | Complete | Medium |
| Analytics | Basic | Advanced | High |

### Business Impact of Gap

**Without MES:**
| Impact Area | Annual Cost |
|-------------|-------------|
| Data entry labor | $85K |
| Error correction | $45K |
| Delayed decisions | $120K |
| Quality escapes | $95K |
| Compliance risk | $150K |
| **Total** | **$495K** |

### MES Benefits

**Operational:**
- Real-time production visibility
- Automatic OEE calculation
- Quality at source
- Paperless operations

**Strategic:**
- Foundation for Industry 4.0
- Enables predictive analytics
- Supports continuous improvement
- Regulatory compliance

### Implementation Approach

**Phase 1: Foundation (Month 1-3)**
- Select MES platform
- Define data model
- Pilot on Line 1

**Phase 2: Rollout (Month 4-6)**
- Deploy to all lines
- Integrate with ERP
- Train operators

**Phase 3: Optimize (Month 7-12)**
- Advanced analytics
- Predictive capabilities
- Continuous improvement

### Investment Analysis

| Component | Cost |
|-----------|------|
| MES Software | $150K |
| Hardware (sensors, terminals) | $75K |
| Integration | $50K |
| Training | $25K |
| **Total** | **$300K** |

**ROI: 165% in Year 1**
**Payback: 7 months**'
WHERE id = 'insight-007';

-- insight-008: Documentation Gap
UPDATE interview_insights SET 
description = '## Documentation Gap Analysis

### Executive Summary

Outdated SOPs will complicate **training** and **change management**. Limited documentation creates knowledge silos and operational risk.

### Current State Assessment

| Document Type | Exists | Current | Complete | Accessible |
|---------------|--------|---------|----------|------------|
| SOPs | Partial | 30% | 20% | Paper only |
| Work Instructions | Limited | 40% | 25% | Scattered |
| Training Materials | Minimal | 20% | 10% | None |
| Process Maps | Few | 15% | 10% | Outdated |

### Gap Analysis by Area

| Area | Documents Needed | Available | Gap |
|------|------------------|-----------|-----|
| Production | 45 | 12 | 33 (73%) |
| Quality | 30 | 8 | 22 (73%) |
| Maintenance | 25 | 5 | 20 (80%) |
| Safety | 20 | 15 | 5 (25%) |
| **Total** | **120** | **40** | **80 (67%)** |

### Risk Assessment

**Operational Risks:**
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Knowledge loss | High | Critical | Documentation program |
| Training gaps | High | High | Standard materials |
| Inconsistent quality | Medium | High | Work instructions |
| Compliance issues | Medium | Critical | SOP updates |

### Business Impact

**Current Costs:**
| Issue | Annual Impact |
|-------|---------------|
| Training time (extended) | $45K |
| Quality variation | $65K |
| Troubleshooting delays | $35K |
| Onboarding inefficiency | $25K |
| **Total** | **$170K** |

### Remediation Plan

**Phase 1: Critical SOPs (Month 1-2)**
- Identify critical processes
- Document top 20 procedures
- Validate with operators

**Phase 2: Work Instructions (Month 3-4)**
- Create visual work instructions
- Include photos/videos
- Deploy at workstations

**Phase 3: Training Materials (Month 5-6)**
- Develop training modules
- Create assessment tools
- Build knowledge base

### Resource Requirements

| Resource | Effort | Cost |
|----------|--------|------|
| Technical Writer | 6 months | $60K |
| SME Time | 200 hours | $20K |
| Tools/Software | - | $10K |
| **Total** | - | **$90K** |

### Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| SOP coverage | 30% | 90% | 6 months |
| Document currency | 20% | 100% | 6 months |
| Training time | 4 weeks | 2 weeks | 6 months |
| Quality variation | 8% | 3% | 6 months |'
WHERE id = 'insight-008';

-- Also update the demo_ins_* insights for org-dbr77-test
-- (These already have content from migration 426, but let's ensure they're complete)
