-- INTERVIEW-INSIGHTS-PROFESSIONAL: Professional content for Interview Insights
-- Migration: 426_interview_insights_professional_content.sql
-- Purpose: Add comprehensive, BCG-quality content to all interview insights
-- Date: 2026-01-27

-- ==========================================
-- UPDATE EXISTING INSIGHTS WITH PROFESSIONAL CONTENT
-- ==========================================

-- Insight 004: OEE Improvement Opportunity
UPDATE interview_insights SET 
description = '## Executive Summary

Current Overall Equipment Effectiveness (OEE) of **72%** is significantly below world-class benchmark of **85%**. This represents a **$2.1M annual opportunity** in lost productivity.

### Key Findings

| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Availability | 85% | 92% | -7% |
| Performance | 90% | 95% | -5% |
| Quality | 94% | 98% | -4% |
| **OEE** | **72%** | **85%** | **-13%** |

### Root Cause Analysis

1. **Changeovers (35% of downtime)**
   - Average changeover time: 45 minutes
   - Best-in-class benchmark: 15 minutes
   - No SMED methodology implemented

2. **Unplanned Breakdowns (25%)**
   - Reactive maintenance culture
   - No predictive maintenance capability
   - MTBF below industry standard

3. **Material Shortages (20%)**
   - Poor inventory visibility
   - Manual reorder process

### Recommended Actions

| Priority | Action | Investment | ROI |
|----------|--------|------------|-----|
| 🔴 High | SMED Workshop (Top 5 SKUs) | $25K | 6 months |
| 🔴 High | Real-time OEE Dashboard | $50K | 4 months |
| 🟡 Medium | Predictive Maintenance Pilot | $100K | 12 months |

### Expected Impact

- **+13% OEE** within 12 months
- **$2.1M** annual productivity gain
- **15%** reduction in overtime costs',
source_quote = 'Changeovers account for 35% of our downtime. We''ve never done formal SMED training - operators just do it the way they learned.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_004';

-- Insight 005: Real-time Visibility Gap
UPDATE interview_insights SET 
description = '## Digital Visibility Gap Assessment

### Current State

The organization lacks **real-time visibility** into production operations, creating significant decision-making delays and operational inefficiencies.

### Gap Analysis

| Capability | Current | Required | Gap Level |
|------------|---------|----------|-----------|
| Production Monitoring | Manual (8h delay) | Real-time | 🔴 Critical |
| Quality Data | Paper-based | Digital | 🔴 Critical |
| Inventory Visibility | Daily batch | Real-time | 🟡 High |
| Equipment Status | Visual only | IoT-enabled | 🟡 High |

### Business Impact

1. **Decision Latency**: 8+ hours from event to visibility
2. **Quality Escapes**: 15% of defects detected post-shipment
3. **Inventory Accuracy**: Only 85% (target: 98%)
4. **Overtime Costs**: $180K/year due to reactive scheduling

### Technology Assessment

**Current MES**: Version 2015, no real-time capability
- No machine integration
- Manual data entry by operators
- Batch reporting only

**Recommendation**: Cloud MES with IoT integration

### Investment Analysis

| Solution | CAPEX | OPEX/yr | Payback |
|----------|-------|---------|---------|
| Cloud MES | $200K | $48K | 18 months |
| IoT Sensors | $75K | $12K | 12 months |
| Dashboard | $50K | $6K | 6 months |

### Quick Win

Implement **real-time OEE dashboard** as Phase 1 ($50K, 8 weeks) to demonstrate value before full MES investment.',
source_quote = 'We don''t know what happened on the floor until the next morning when supervisors compile their reports. By then it''s too late to react.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_005';

-- Insight 006: Single Source Risk
UPDATE interview_insights SET 
description = '## Supply Chain Risk Assessment: Single Source Dependencies

### Critical Finding

**3 critical components** have no alternative supplier, creating unacceptable supply chain risk.

### Risk Matrix

| Component | Supplier | Lead Time | Annual Spend | Risk Level |
|-----------|----------|-----------|--------------|------------|
| Motor Assembly | SupplierA | 12 weeks | $1.2M | 🔴 Critical |
| Control Board | SupplierB | 8 weeks | $800K | 🔴 Critical |
| Sensor Module | SupplierC | 10 weeks | $450K | 🔴 Critical |

### Vulnerability Assessment

**If any single source fails:**
- Production stoppage within 2-4 weeks
- Revenue impact: **$3.5M per month**
- Customer penalties: **$500K** (SLA violations)
- Market share risk: Competitors gain during outage

### Historical Incidents

| Date | Supplier | Issue | Impact |
|------|----------|-------|--------|
| Q2 2025 | SupplierA | Quality issue | 3-week delay, $420K cost |
| Q4 2024 | SupplierB | Capacity constraint | 6-week delay |

### Mitigation Strategy

**Phase 1 (0-3 months)**: Risk Assessment
- Complete supplier financial health review
- Identify potential alternative suppliers
- Negotiate buffer stock agreements

**Phase 2 (3-6 months)**: Qualification
- Begin qualification of 2nd source for Motor Assembly
- Establish VMI agreement with SupplierB

**Phase 3 (6-12 months)**: Dual Sourcing
- Achieve 70/30 split on all critical components
- Implement supplier risk monitoring dashboard

### Investment Required

| Action | Cost | Timeline |
|--------|------|----------|
| Supplier Qualification | $150K | 6 months |
| Buffer Stock | $300K | Immediate |
| Risk Monitoring System | $50K | 3 months |',
source_quote = 'We''ve been meaning to qualify a second source for years, but it always gets deprioritized. One supplier hiccup and we''re in serious trouble.',
impact_level = 'critical',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_006';

-- Insight 007: Forecast Accuracy Below Benchmark
UPDATE interview_insights SET 
description = '## Demand Forecasting Gap Analysis

### Current Performance

| Metric | Current | Benchmark | Gap |
|--------|---------|-----------|-----|
| Forecast Accuracy (MAPE) | 70% | 85% | -15% |
| Bias | +8% (over-forecast) | ±2% | -6% |
| Forecast Horizon | 4 weeks | 12 weeks | -8 weeks |

### Financial Impact of Poor Forecasting

| Cost Category | Annual Impact |
|---------------|---------------|
| Excess Inventory | $420K |
| Stockouts (Lost Sales) | $380K |
| Expedited Freight | $150K |
| Overtime (Reactive) | $120K |
| **Total** | **$1.07M** |

### Root Cause Analysis

1. **Process Issues**
   - Excel-based forecasting (no statistical models)
   - Monthly S&OP cadence too slow
   - Sales input subjective, not data-driven

2. **Data Issues**
   - No demand sensing capability
   - POS data not integrated
   - Promotional impact not modeled

3. **Organizational Issues**
   - No dedicated demand planner
   - Accountability unclear
   - No forecast accuracy KPI

### Improvement Roadmap

**Quick Wins (0-3 months)**
- Implement weekly forecast review
- Add forecast accuracy KPI to S&OP scorecard
- Clean historical data (remove outliers)

**Medium Term (3-6 months)**
- Deploy statistical forecasting tool
- Integrate POS data from top 5 customers
- Train demand planning team

**Strategic (6-12 months)**
- AI/ML demand sensing
- Collaborative forecasting with key accounts
- Automated exception management

### Expected Results

| Timeline | Accuracy | Inventory Reduction |
|----------|----------|---------------------|
| 3 months | 75% | $100K |
| 6 months | 80% | $250K |
| 12 months | 85% | $400K |',
source_quote = 'Our forecasts are basically educated guesses. Sales gives us a number, we add 10% buffer, and hope for the best.',
impact_level = 'high',
confidence = 'medium',
actionable = 1
WHERE id = 'demo_insight_007';

-- Insight 008: High Production Turnover
UPDATE interview_insights SET 
description = '## Workforce Analytics: Production Turnover Crisis

### Current State

| Metric | Production | Office | Industry Avg |
|--------|------------|--------|--------------|
| Annual Turnover | **25%** | 8% | 12% |
| Time to Fill | 45 days | 30 days | 28 days |
| Training Cost/Hire | $8,500 | $4,200 | - |
| Productivity Ramp | 12 weeks | 6 weeks | - |

### Financial Impact

**Annual Cost of Turnover: $1.2M**

| Cost Component | Calculation | Annual Cost |
|----------------|-------------|-------------|
| Recruiting | 45 hires × $3,000 | $135K |
| Training | 45 hires × $8,500 | $382K |
| Productivity Loss | 45 × 12 weeks × $800/week | $432K |
| Overtime (Coverage) | $250K | $250K |

### Exit Interview Analysis (n=38)

| Reason | % Citing | Actionable? |
|--------|----------|-------------|
| Compensation | 40% | ✅ Yes |
| Career Growth | 30% | ✅ Yes |
| Management | 30% | ✅ Yes |
| Work Environment | 15% | ✅ Yes |
| Commute | 10% | ⚠️ Limited |

### Compensation Benchmarking

| Role | Current | Market 50th | Gap |
|------|---------|-------------|-----|
| Operator L1 | $18.50/hr | $20.00/hr | -8% |
| Operator L2 | $21.00/hr | $23.50/hr | -11% |
| Team Lead | $26.00/hr | $28.00/hr | -7% |

### Retention Strategy

**Immediate Actions (0-30 days)**
- Market adjustment for critical roles (+$1.50/hr avg)
- Stay interviews with top performers
- Exit interview process improvement

**Short Term (1-3 months)**
- Career ladder program launch
- Supervisor training (people management)
- Recognition program enhancement

**Medium Term (3-6 months)**
- Skills-based pay progression
- Internal promotion pipeline
- Engagement survey + action planning

### ROI Analysis

| Investment | Cost | Turnover Reduction | Savings |
|------------|------|-------------------|---------|
| Wage Adjustment | $180K/yr | -8% | $400K |
| Training Programs | $50K | -3% | $150K |
| Recognition | $25K | -2% | $100K |
| **Total** | **$255K** | **-13%** | **$650K** |

**Net Benefit: $395K/year**',
source_quote = 'People leave because they don''t see a future here. We promote based on tenure, not skill. Our best operators go to competitors who pay $2 more per hour.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_008';

-- Insight 009: Line 3 Quality Issue Root Cause
UPDATE interview_insights SET 
description = '## Root Cause Analysis: Line 3 Quality Defects

### Problem Statement

Line 3 DPPM is **2x plant average**, causing:
- Customer complaints: 8/month (vs 2/month other lines)
- Scrap cost: $45K/month
- Rework labor: 120 hours/month

### Defect Pareto Analysis

| Defect Type | % of Total | Trend |
|-------------|------------|-------|
| Dimensional Out-of-Spec | 45% | ↑ Increasing |
| Surface Finish | 25% | → Stable |
| Assembly Errors | 20% | → Stable |
| Other | 10% | → Stable |

### Root Cause Investigation

**5-Why Analysis: Dimensional Defects**

1. Why are parts out of spec? → Tool wear not detected in time
2. Why not detected? → No in-process measurement
3. Why no measurement? → Manual inspection only at end
4. Why manual only? → No investment in gauging
5. Why no investment? → Cost reduction pressure

**Ishikawa Diagram Summary**

| Category | Contributing Factors |
|----------|---------------------|
| **Machine** | Worn spindle bearings, outdated CNC controller |
| **Material** | New supplier (SupplierX) has higher variation |
| **Method** | No SPC, inspection at end only |
| **Man** | 3 new operators (< 6 months experience) |
| **Measurement** | Manual gauges, no real-time feedback |

### Supplier Quality Issue

**SupplierX Material Analysis**

| Metric | Spec | SupplierX | Previous Supplier |
|--------|------|-----------|-------------------|
| Hardness (HRC) | 58-62 | 56-64 | 58-61 |
| Variation (σ) | <1.0 | 2.1 | 0.8 |

### Corrective Actions

**Immediate (This Week)**
- Replace worn tooling on Line 3
- 100% inspection until stable
- Supplier quality alert to SupplierX

**Short Term (30 days)**
- Install in-process gauging ($35K)
- Implement SPC on critical dimensions
- Operator retraining (3 affected)

**Medium Term (90 days)**
- Spindle bearing replacement (planned maintenance)
- Supplier quality audit
- Consider supplier change if no improvement

### Expected Results

| Metric | Current | Target (90 days) |
|--------|---------|------------------|
| DPPM | 5,000 | 2,000 |
| Scrap Cost | $45K/mo | $18K/mo |
| Customer Complaints | 8/mo | 2/mo |',
source_quote = 'We switched to a cheaper supplier 6 months ago. Ever since, Line 3 has been a nightmare. The material just doesn''t machine the same.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_009';

-- Insight 010: Infrastructure Modernization Needed
UPDATE interview_insights SET 
description = '## IT Infrastructure Modernization Assessment

### Current State Analysis

| Component | Age | Status | Risk |
|-----------|-----|--------|------|
| Servers | 7 years | End of support | 🔴 Critical |
| Network | 5 years | Adequate | 🟡 Medium |
| Storage | 7 years | Near capacity | 🔴 Critical |
| Backup | 7 years | Tape-based | 🔴 Critical |

### Technical Debt Summary

**Infrastructure**: 100% on-premises
- Windows Server 2016 (end of extended support: Jan 2027)
- VMware 6.5 (2 versions behind)
- No disaster recovery site
- RTO: 72 hours (target: 4 hours)

### Business Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Hardware failure | High | Critical | Cloud migration |
| Security breach | Medium | Critical | Modern security stack |
| Compliance gap | High | High | Audit remediation |
| Talent retention | Medium | Medium | Modern tools |

### Cloud Migration Strategy

**Recommended Approach**: Hybrid Cloud (Azure)

**Phase 1: Foundation (Q1)**
- Azure landing zone setup
- Identity (Azure AD) integration
- Network connectivity (ExpressRoute)
- Cost: $75K

**Phase 2: Migrate Non-Critical (Q2)**
- Dev/Test environments
- File shares (Azure Files)
- Backup (Azure Backup)
- Cost: $50K

**Phase 3: Production Migration (Q3-Q4)**
- ERP (lift and shift)
- MES integration
- Database migration
- Cost: $200K

### Financial Analysis

| Scenario | Year 1 | Year 2 | Year 3 | 5-Year TCO |
|----------|--------|--------|--------|------------|
| Stay On-Prem | $180K | $200K | $220K | $1.1M |
| Cloud Migration | $325K | $120K | $130K | $825K |
| **Savings** | - | - | - | **$275K** |

### Additional Benefits

- **Scalability**: Burst capacity for peak periods
- **Security**: Enterprise-grade, always current
- **Resilience**: 99.95% SLA, geo-redundancy
- **Innovation**: Enable AI/ML, IoT integration',
source_quote = 'Our servers are 7 years old. We''re one hardware failure away from a major outage. IT keeps asking for budget but it always gets cut.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_010';

-- Insight 011: NPS Improvement Priority
UPDATE interview_insights SET 
description = '## Customer Experience: NPS Improvement Program

### Current Performance

| Metric | Current | Target | Industry Avg |
|--------|---------|--------|--------------|
| **NPS** | **42** | **55** | 35 |
| CSAT | 78% | 85% | 75% |
| CES | 3.2 | 2.5 | 3.0 |
| First Contact Resolution | 65% | 80% | 70% |

### NPS Breakdown

| Segment | Score | Volume | Priority |
|---------|-------|--------|----------|
| Promoters (9-10) | 52% | - | Leverage |
| Passives (7-8) | 38% | - | Convert |
| Detractors (0-6) | 10% | - | 🔴 Fix |

### Detractor Analysis (n=127)

| Issue | % Mentioning | Actionable |
|-------|--------------|------------|
| Response Time | 45% | ✅ |
| Issue Resolution | 35% | ✅ |
| Product Quality | 25% | ✅ |
| Communication | 20% | ✅ |
| Pricing | 15% | ⚠️ |

### Customer Journey Pain Points

```
Awareness → Consideration → Purchase → Onboarding → Usage → Support → Renewal
                                          ↓           ↓        ↓
                                        Pain 1     Pain 2   Pain 3
                                     (Complexity) (Wait)  (Resolution)
```

### Improvement Initiatives

**Quick Wins (0-30 days)**
| Initiative | Owner | Impact | Effort |
|------------|-------|--------|--------|
| Auto-response with ETA | Support | +3 NPS | Low |
| FAQ expansion | Content | +2 NPS | Low |
| Callback option | Support | +2 NPS | Medium |

**Medium Term (1-3 months)**
| Initiative | Owner | Impact | Effort |
|------------|-------|--------|--------|
| Chatbot for common queries | IT | +4 NPS | High |
| Proactive status updates | Support | +3 NPS | Medium |
| Self-service portal | Digital | +5 NPS | High |

### Investment & ROI

| Investment | Cost | NPS Impact | Revenue Impact |
|------------|------|------------|----------------|
| Support Staffing | $150K | +5 | $300K |
| Technology | $200K | +6 | $400K |
| Training | $50K | +2 | $150K |
| **Total** | **$400K** | **+13** | **$850K** |

### Roadmap to NPS 55

| Quarter | Target NPS | Key Initiatives |
|---------|------------|-----------------|
| Q1 | 45 | Quick wins, staffing |
| Q2 | 48 | Chatbot, self-service |
| Q3 | 52 | Proactive support |
| Q4 | 55 | Full program maturity |',
source_quote = 'The CEO has made NPS 55 a company-wide goal. We need to move fast - our competitors are catching up.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_011';

-- Insight 012: ESG Reporting Urgency
UPDATE interview_insights SET 
description = '## ESG Compliance: Urgent Action Required

### Situation

**Key customers requiring carbon footprint reporting by Q3 2026.**

Non-compliance risk:
- Loss of $8.5M in contracts (3 major customers)
- Exclusion from RFPs (growing requirement)
- Reputational damage

### Current ESG Maturity

| Pillar | Maturity | Gap |
|--------|----------|-----|
| **Environmental** | 1.5/5 | 🔴 Critical |
| Social | 2.5/5 | 🟡 Medium |
| Governance | 3.0/5 | 🟢 Low |

### Environmental Gap Analysis

| Requirement | Current State | Gap |
|-------------|---------------|-----|
| Scope 1 Emissions | Not tracked | 🔴 |
| Scope 2 Emissions | Partial (utility bills) | 🟡 |
| Scope 3 Emissions | Not tracked | 🔴 |
| Energy by Source | Not tracked | 🔴 |
| Waste & Recycling | Manual estimates | 🟡 |
| Water Usage | Utility bills only | 🟡 |

### Customer Requirements

| Customer | Requirement | Deadline | Revenue at Risk |
|----------|-------------|----------|-----------------|
| CustomerA | CDP Disclosure | Q3 2026 | $4.2M |
| CustomerB | GHG Protocol Report | Q2 2026 | $2.8M |
| CustomerC | EcoVadis Score >50 | Q4 2026 | $1.5M |

### Compliance Roadmap

**Phase 1: Foundation (Q1)**
- Hire/assign ESG coordinator
- Select reporting framework (GRI recommended)
- Install energy sub-meters (production)
- Cost: $75K

**Phase 2: Data Collection (Q2)**
- Scope 1 & 2 baseline calculation
- Supplier carbon data collection
- Waste audit and tracking
- Cost: $50K

**Phase 3: Reporting (Q3)**
- First carbon footprint report
- CDP submission
- Customer portal integration
- Cost: $25K

### Investment Summary

| Category | Cost | Timeline |
|----------|------|----------|
| Personnel | $80K/yr | Ongoing |
| Technology (ESG Platform) | $45K | Q1 |
| Consulting (Baseline) | $35K | Q1-Q2 |
| Sub-metering | $60K | Q1 |
| **Total Year 1** | **$220K** | - |

### Risk Mitigation

**If we don''t act:**
- Q2: CustomerB audit failure
- Q3: CustomerA contract at risk
- Q4: Excluded from 3 major RFPs

**With this program:**
- Q2: Baseline complete, CustomerB satisfied
- Q3: CDP submitted, CustomerA retained
- Q4: EcoVadis score >50, new RFP eligible',
source_quote = 'Three of our biggest customers have told us point-blank: no carbon reporting, no contract renewal. This isn''t optional anymore.',
impact_level = 'critical',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_012';

-- Insight 013: Energy Sub-metering Gap
UPDATE interview_insights SET 
description = '## Energy Management: Sub-metering Gap Analysis

### Current State

**Production accounts for 80% of energy consumption** but we have **zero visibility** into consumption by:
- Production line
- Equipment
- Shift
- Product

### Energy Consumption Breakdown (Estimated)

| Area | % of Total | kWh/month | Cost/month |
|------|------------|-----------|------------|
| Production | 80% | 320,000 | $38,400 |
| HVAC | 12% | 48,000 | $5,760 |
| Lighting | 5% | 20,000 | $2,400 |
| Office | 3% | 12,000 | $1,440 |
| **Total** | **100%** | **400,000** | **$48,000** |

### The Problem

Without sub-metering:
- Cannot identify energy waste
- Cannot benchmark lines/equipment
- Cannot optimize production scheduling
- Cannot report for ESG compliance
- Cannot pursue energy rebates

### Estimated Waste (Industry Benchmarks)

| Waste Category | Estimated % | Annual Cost |
|----------------|-------------|-------------|
| Idle Equipment | 8-12% | $46K-$69K |
| Compressed Air Leaks | 3-5% | $17K-$29K |
| HVAC Inefficiency | 5-8% | $29K-$46K |
| Lighting (off-hours) | 2-3% | $12K-$17K |
| **Total Opportunity** | **18-28%** | **$104K-$161K** |

### Sub-metering Solution

**Recommended Approach**: IoT-based energy monitoring

| Component | Quantity | Unit Cost | Total |
|-----------|----------|-----------|-------|
| Main Panel Meters | 4 | $2,500 | $10,000 |
| Line Sub-meters | 8 | $1,500 | $12,000 |
| Equipment Monitors | 20 | $800 | $16,000 |
| Gateway & Software | 1 | $15,000 | $15,000 |
| Installation | - | - | $12,000 |
| **Total** | - | - | **$65,000** |

### ROI Analysis

| Year | Investment | Savings | Net |
|------|------------|---------|-----|
| 1 | $65,000 | $80,000 | $15,000 |
| 2 | $5,000 (maintenance) | $100,000 | $95,000 |
| 3 | $5,000 | $120,000 | $115,000 |

**Payback Period: 10 months**

### Implementation Plan

**Week 1-2**: Site survey, meter selection
**Week 3-4**: Procurement, main panel installation
**Week 5-6**: Line sub-meter installation
**Week 7-8**: Equipment monitors, commissioning
**Week 9-10**: Dashboard setup, training
**Week 11-12**: Baseline establishment, optimization start',
source_quote = 'We pay $48,000 a month for electricity but have no idea where it goes. When energy costs spiked 15%, we had no way to respond intelligently.',
impact_level = 'medium',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_013';

-- Insight 014: Lean Quick Wins Available
UPDATE interview_insights SET 
description = '## Lean Manufacturing: Quick Win Opportunities

### Assessment Summary

**Current Lean Maturity: 2.0/5 (Developing)**

| Dimension | Score | Status |
|-----------|-------|--------|
| 5S | 2.5 | Some implementation |
| Visual Management | 1.5 | Minimal |
| Standardized Work | 2.0 | Inconsistent |
| TPM | 1.5 | Reactive only |
| Continuous Improvement | 2.0 | Ad-hoc |
| Flow & Pull | 2.5 | Partial |

### Quick Win Opportunities

#### 1. 5S Blitz (Week 1-2)
**Current State**: Partial 5S, no audits
**Opportunity**: 
- 15% reduction in search time
- 10% improvement in changeover
- Safety hazard reduction

**Action Plan**:
| Day | Activity | Owner |
|-----|----------|-------|
| 1-2 | Sort (Red Tag) | Team |
| 3-4 | Set in Order | Team |
| 5 | Shine | Team |
| 6-7 | Standardize | Supervisor |
| 8+ | Sustain (weekly audits) | All |

**Investment**: $5K (supplies, overtime)
**Savings**: $25K/year

#### 2. Visual Management Boards (Week 2-3)
**Current State**: No production boards
**Opportunity**:
- Real-time status visibility
- Faster problem escalation
- Improved shift handover

**Components**:
- Production status (hourly)
- Quality metrics (defects)
- Safety (days without incident)
- Improvement ideas

**Investment**: $3K
**Savings**: $15K/year (reduced meetings)

#### 3. Changeover Reduction (Week 3-6)
**Current State**: 45 min average
**Target**: 25 min (-44%)

**SMED Approach**:
1. Video current changeover
2. Separate internal/external
3. Convert internal to external
4. Streamline remaining

**Investment**: $25K (tooling, training)
**Savings**: $80K/year (capacity gain)

### 90-Day Roadmap

| Week | Initiative | Expected Gain |
|------|------------|---------------|
| 1-2 | 5S Blitz (Line 1) | $25K/yr |
| 2-3 | Visual Boards | $15K/yr |
| 3-6 | SMED (Top 3 SKUs) | $80K/yr |
| 6-8 | 5S Blitz (Line 2-3) | $50K/yr |
| 8-10 | Standard Work | $30K/yr |
| 10-12 | Kaizen Event | $40K/yr |

### Total Opportunity

| Category | Investment | Annual Savings |
|----------|------------|----------------|
| 5S Program | $15K | $75K |
| Visual Management | $5K | $15K |
| SMED | $25K | $80K |
| Standard Work | $10K | $30K |
| **Total** | **$55K** | **$200K** |

**ROI: 3.6x in Year 1**',
source_quote = 'We did 5S training two years ago but never sustained it. Tools are everywhere, changeovers take forever, and nobody knows what "good" looks like.',
impact_level = 'medium',
confidence = 'medium',
actionable = 1
WHERE id = 'demo_insight_014';

-- Insight 015: Data Governance Foundation Needed
UPDATE interview_insights SET 
description = '## Data Governance: Foundation Assessment

### Executive Summary

The organization lacks a **single source of truth** for key business entities, causing:
- 30% of analyst time spent on data reconciliation
- Conflicting reports to leadership
- Delayed decision-making
- Compliance risk

### Data Quality Assessment

| Entity | Systems | Consistency | Accuracy | Completeness |
|--------|---------|-------------|----------|--------------|
| Customer | 4 | 🔴 Poor | 🟡 Medium | 🟡 Medium |
| Product | 3 | 🟡 Medium | 🟡 Medium | 🔴 Poor |
| Order | 2 | 🟡 Medium | 🟢 Good | 🟢 Good |
| Inventory | 3 | 🔴 Poor | 🔴 Poor | 🟡 Medium |
| Employee | 2 | 🟢 Good | 🟢 Good | 🟢 Good |

### System Landscape

```
┌─────────┐    ┌─────────┐    ┌─────────┐
│   ERP   │    │   CRM   │    │  Excel  │
│ (SAP)   │    │(Custom) │    │(Various)│
└────┬────┘    └────┬────┘    └────┬────┘
     │              │              │
     └──────────────┼──────────────┘
                    │
              No Integration
              Manual Reconciliation
```

### Business Impact

| Issue | Frequency | Time Wasted | Annual Cost |
|-------|-----------|-------------|-------------|
| Customer data mismatch | Daily | 2 hrs/day | $52K |
| Inventory discrepancy | Weekly | 8 hrs/week | $42K |
| Report reconciliation | Monthly | 40 hrs/month | $48K |
| Wrong decisions | Quarterly | Varies | $100K+ |
| **Total** | - | - | **$242K+** |

### Recommended Data Governance Framework

**1. Organization**
- Data Governance Council (quarterly)
- Data Stewards (per domain)
- Data Owner accountability

**2. Policies & Standards**
- Data definitions (business glossary)
- Quality rules and thresholds
- Access and security policies

**3. Processes**
- Data quality monitoring
- Issue resolution workflow
- Change management

**4. Technology**
- Master Data Management (MDM)
- Data quality tools
- Integration platform

### Implementation Roadmap

**Phase 1: Foundation (Q1)**
- Establish governance council
- Define critical data elements
- Assign data stewards
- Cost: $25K (consulting)

**Phase 2: Quick Wins (Q2)**
- Customer master cleanup
- Implement data quality rules
- Basic MDM for customer
- Cost: $75K

**Phase 3: Scale (Q3-Q4)**
- Product master
- Inventory reconciliation
- Integration platform
- Cost: $150K

### ROI Projection

| Year | Investment | Savings | Cumulative |
|------|------------|---------|------------|
| 1 | $250K | $150K | -$100K |
| 2 | $50K | $250K | +$100K |
| 3 | $50K | $300K | +$350K |',
source_quote = 'Every month we spend a week reconciling numbers between systems. Finance says one thing, operations says another, and leadership doesn''t know who to believe.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_insight_015';

-- Update older demo insights with professional content
UPDATE interview_insights SET 
description = '## Digital Maturity Assessment: Executive Summary

### Overall Score: 2.5/5 (Developing)

The IT department demonstrates **moderate digital maturity** with notable strengths in infrastructure stability but significant gaps in advanced capabilities.

### Maturity by Dimension

| Dimension | Score | Assessment |
|-----------|-------|------------|
| Infrastructure | 3.5 | Solid foundation, aging hardware |
| Applications | 2.5 | Core systems adequate, integration gaps |
| Data & Analytics | 1.5 | 🔴 Critical gap |
| Cloud Adoption | 2.0 | Early stage, 20% workloads |
| Security | 3.0 | Compliant, needs modernization |
| Digital Skills | 2.0 | Training needed |

### Key Findings

**Strengths**
- Stable core infrastructure (99.5% uptime)
- Strong ERP foundation (SAP)
- Committed IT leadership

**Critical Gaps**
- No data analytics capability
- Limited API/integration layer
- Cloud strategy undefined
- Digital skills shortage

### Recommended Priorities

1. **Data Platform** - Enable analytics and reporting
2. **Integration Layer** - Connect siloed systems
3. **Cloud Strategy** - Define hybrid approach
4. **Skills Development** - Upskill IT team

### Investment Required: $500K over 18 months',
source_quote = 'We have good systems but they don''t talk to each other. Getting a simple report requires pulling data from 5 places.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_ins_001';

UPDATE interview_insights SET 
description = '## Production Bottleneck Analysis

### Critical Bottlenecks Identified

Three major bottlenecks are constraining throughput by an estimated **25%**:

### 1. Manual Quality Checks (2-hour delay)

**Current State**:
- 100% manual inspection at end of line
- Average inspection time: 15 min/unit
- Queue buildup: 8 units average

**Impact**: 
- 2-hour delay in order completion
- $180K/year in labor cost
- Quality escapes due to fatigue

**Solution**: Inline automated inspection
- Investment: $120K
- Payback: 8 months

### 2. Paper-based Inventory Management

**Current State**:
- Physical count required for picks
- No real-time visibility
- Cycle count accuracy: 85%

**Impact**:
- 30 min average pick time (vs 10 min benchmark)
- Stockouts: 12/month
- Expedited freight: $150K/year

**Solution**: WMS with barcode scanning
- Investment: $80K
- Payback: 6 months

### 3. No Real-time Production Visibility

**Current State**:
- Status known only at shift end
- No alerts for issues
- Reactive problem-solving

**Impact**:
- 8-hour delay in issue response
- Overtime for catch-up: $120K/year
- Customer delivery misses: 5/month

**Solution**: MES with real-time dashboard
- Investment: $200K
- Payback: 14 months

### Total Opportunity

| Bottleneck | Investment | Annual Savings |
|------------|------------|----------------|
| Quality Automation | $120K | $180K |
| WMS Implementation | $80K | $200K |
| MES Dashboard | $200K | $170K |
| **Total** | **$400K** | **$550K** |',
source_quote = 'We''re still using paper travelers and clipboards. By the time we know there''s a problem, we''ve already made 100 bad parts.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_ins_002';

UPDATE interview_insights SET 
description = '## Cost Reduction: Quick Win Analysis

### Identified Opportunities: $450K Annual Savings

Analysis of interview responses revealed three high-confidence, low-risk cost reduction opportunities.

### 1. Software License Consolidation ($120K)

**Current State**:
- 47 different software subscriptions
- 23% of licenses unused
- No central procurement

**Findings**:
| Category | Current Spend | Waste | Opportunity |
|----------|---------------|-------|-------------|
| Productivity | $180K | 25% | $45K |
| Design Tools | $120K | 30% | $36K |
| Analytics | $80K | 20% | $16K |
| Other | $100K | 23% | $23K |

**Action**: License audit + consolidation
- Effort: 4 weeks
- Investment: $15K (consulting)
- Net Savings: $105K/year

### 2. Invoice Processing Automation ($180K)

**Current State**:
- 2,400 invoices/month
- Manual 3-way match
- 4 FTE dedicated
- Error rate: 8%

**Automation Opportunity**:
| Metric | Current | Automated |
|--------|---------|-----------|
| Cost/Invoice | $12 | $3 |
| Processing Time | 15 min | 2 min |
| Error Rate | 8% | 1% |
| FTE Required | 4 | 1 |

**Action**: Implement AP automation
- Investment: $60K
- Annual Savings: $180K
- Payback: 4 months

### 3. Vendor Contract Renegotiation ($150K)

**Current State**:
- 85 active vendors
- 60% of contracts >2 years old
- No systematic review process

**Opportunity by Category**:
| Category | Spend | Savings Potential |
|----------|-------|-------------------|
| Raw Materials | $4.2M | 2% = $84K |
| MRO | $800K | 5% = $40K |
| Services | $500K | 5% = $25K |

**Action**: Strategic sourcing initiative
- Effort: 12 weeks
- Investment: $25K
- Net Savings: $125K/year

### Implementation Roadmap

| Month | Initiative | Savings Start |
|-------|------------|---------------|
| 1-2 | License Audit | Month 3 |
| 2-4 | AP Automation | Month 5 |
| 3-6 | Vendor Renegotiation | Month 7 |

### Risk Assessment

All three initiatives are **low risk**:
- No operational disruption
- Proven solutions available
- Quick payback periods',
source_quote = 'We''ve never done a proper license audit. I bet we''re paying for software nobody uses. Same with our vendor contracts - we just auto-renew.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_ins_003';

UPDATE interview_insights SET 
description = '## Customer Experience Improvement Roadmap

### Strategic Recommendation

A phased approach to CX transformation, aligned with organizational capacity and budget constraints.

### Phase 1: Fix Critical Touchpoints (Q1)

**Focus**: Eliminate top customer pain points

| Initiative | Owner | Investment | Impact |
|------------|-------|------------|--------|
| Response time SLA | Support | $25K | High |
| Escalation process | Support | $10K | High |
| Knowledge base | Content | $15K | Medium |
| Callback option | IT | $20K | Medium |

**Expected Results**:
- Response time: 24h → 8h
- First contact resolution: 65% → 72%
- NPS: +3 points

### Phase 2: CRM Integration (Q2)

**Focus**: Unified customer view

**Current State**:
- Customer data in 4 systems
- No interaction history
- Manual case routing

**Target State**:
- Single customer profile
- Complete interaction history
- Intelligent routing

**Investment**: $150K
**Expected Results**:
- Agent efficiency: +25%
- Customer effort: -30%
- NPS: +5 points

### Phase 3: Self-Service Portal (Q3)

**Focus**: Customer empowerment

**Capabilities**:
- Order tracking
- Invoice access
- Support ticket submission
- Knowledge base search
- Account management

**Investment**: $200K
**Expected Results**:
- Call volume: -30%
- Support cost: -$180K/year
- NPS: +4 points

### Success Metrics

| Metric | Baseline | Q1 | Q2 | Q3 |
|--------|----------|----|----|-----|
| NPS | 42 | 45 | 50 | 54 |
| CSAT | 78% | 80% | 83% | 86% |
| FCR | 65% | 72% | 78% | 82% |
| Response Time | 24h | 8h | 4h | 2h |

### Total Investment & ROI

| Phase | Investment | Annual Benefit |
|-------|------------|----------------|
| Phase 1 | $70K | $150K |
| Phase 2 | $150K | $200K |
| Phase 3 | $200K | $300K |
| **Total** | **$420K** | **$650K** |

**ROI: 155% in Year 1**',
source_quote = 'Customers tell us they love our product but hate dealing with us. We need to make it as easy to do business with us as it is to use our products.',
impact_level = 'high',
confidence = 'high',
actionable = 1
WHERE id = 'demo_ins_004';

UPDATE interview_insights SET 
description = '## Transformation Risk Analysis

### Executive Summary

Analysis of interview responses reveals **significant execution risks** that could derail transformation initiatives if not proactively managed.

### Risk Heat Map

| Risk | Likelihood | Impact | Score | Priority |
|------|------------|--------|-------|----------|
| IT Capacity | High | High | 🔴 9 | Critical |
| Change Fatigue | High | Medium | 🟠 6 | High |
| Budget Constraints | Medium | High | 🟠 6 | High |
| Skill Gaps | Medium | Medium | 🟡 4 | Medium |
| Vendor Dependency | Low | High | 🟡 3 | Medium |

### Critical Risk: IT Capacity

**Current State**:
- IT team: 5 FTE
- Current utilization: 120%
- Backlog: 6 months
- Key person dependency: 2 critical roles

**Risk Scenario**:
If transformation initiatives proceed without capacity increase:
- Project delays: 6-12 months
- Quality issues from rushed work
- Burnout and turnover risk

**Mitigation**:
| Action | Cost | Timeline |
|--------|------|----------|
| Contract resources | $200K | Immediate |
| Hire 2 FTE | $180K/yr | 3 months |
| Managed services | $150K/yr | 1 month |

### High Risk: Change Fatigue

**Current State**:
- 3 major initiatives in past 18 months
- Employee sentiment: "Another change?"
- Middle management stretched thin

**Warning Signs**:
- Declining participation in town halls
- Increased "passive resistance"
- Higher voluntary turnover

**Mitigation**:
| Action | Owner | Timeline |
|--------|-------|----------|
| Change impact assessment | HR | Week 1-2 |
| Manager enablement program | HR | Month 1 |
| Quick wins communication | Comms | Ongoing |
| Pace adjustment | PMO | As needed |

### High Risk: Budget Constraints

**Current State**:
- Q3-Q4 budget already committed
- Cash flow tight in Q2
- No contingency reserve

**Risk Scenario**:
- Mid-project funding freeze
- Scope reduction required
- Delayed benefits realization

**Mitigation**:
| Action | Owner | Timeline |
|--------|-------|----------|
| Phased funding approval | Finance | Month 1 |
| Quick win prioritization | PMO | Ongoing |
| Contingency reserve (10%) | Finance | Budget cycle |

### Risk Monitoring Dashboard

Recommend monthly risk review with:
- Risk score trending
- Mitigation action status
- Early warning indicators
- Escalation triggers

### Governance Recommendation

| Frequency | Forum | Focus |
|-----------|-------|-------|
| Weekly | Project Team | Execution risks |
| Bi-weekly | Steering Committee | Strategic risks |
| Monthly | Executive Sponsor | Critical risks |',
source_quote = 'We''ve launched three big initiatives in the past year and a half. People are exhausted. If we pile on more without addressing capacity, something will break.',
impact_level = 'critical',
confidence = 'high',
actionable = 1
WHERE id = 'demo_ins_005';
