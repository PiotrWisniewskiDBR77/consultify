# File 14: AI Input Data for Recommendations — DBR77 Vector

**Producer:** DBR77 Robotics Sp. z o.o.  
**Product:** DBR77 Vector  
**Document version:** 1.0 | March 2026  

---

## 1. Purpose

This document defines the structured input questions required by DBR77 Vector to generate accurate and valuable recommendations.

It is used by:
- Anna (AI assistant)
- Sales and consulting teams
- Commercial Intelligence system

---

## 2. Core Principle

**Better input = better decisions.**

Vector does not require perfect data,  
but it requires **structured context**.

---

## 3. How to Use

- Questions are grouped by topic
- Each question has a clear purpose
- Not all questions are mandatory
- Minimum viable set: 10–15 answers

---

## SECTION A: Business Context

### A1 — What is your main operational challenge? [CORE]
- Describe the biggest problem in production
- *Purpose:* identify primary decision area

### A2 — What is the financial impact of this problem? [ROI]
- Estimate cost, loss, or missed opportunity
- *Purpose:* prioritize importance

### A3 — What happens if you do nothing? [RISK]
- Define consequences of inaction
- *Purpose:* assess urgency

---

## SECTION B: Production System

### B1 — What type of production do you run? [STRUCTURE]
- Discrete / process / hybrid
- *Purpose:* adapt model logic

### B2 — How many lines / machines? [SCALE]
- Number and type
- *Purpose:* understand complexity

### B3 — Where do you see bottlenecks? [ASSUMPTION]
- Current belief
- *Purpose:* compare with model output

---

## SECTION C: Data Availability

### C1 — What data do you have? [DATA]
- OEE, downtime, cycle time
- *Purpose:* determine readiness

### C2 — How reliable is the data? [QUALITY]
- High / medium / low
- *Purpose:* adjust confidence level

### C3 — Data sources? [SYSTEMS]
- IoT, MES, ERP
- *Purpose:* integration potential

---

## SECTION D: Decision Context

### D1 — What decision needs to be made? [CORE]
- Layout, capacity, investment
- *Purpose:* define output

### D2 — Time horizon? [TIME]
- Immediate / short-term / long-term
- *Purpose:* adjust analysis depth

### D3 — Alternatives considered? [OPTIONS]
- Existing options
- *Purpose:* scenario comparison

---

## SECTION E: Constraints

### E1 — Budget constraints? [CAPEX]
- Range or limits
- *Purpose:* filter recommendations

### E2 — Operational constraints? [OPS]
- Workforce, space, regulation
- *Purpose:* realism

### E3 — Technology constraints? [TECH]
- Legacy systems, limitations
- *Purpose:* feasibility

---

## SECTION F: Organization

### F1 — Who owns the decision? [OWNER]
- Role/person
- *Purpose:* accountability

### F2 — Who executes changes? [EXECUTION]
- Team responsible
- *Purpose:* implementation planning

### F3 — Decision process? [GOVERNANCE]
- Centralized / distributed
- *Purpose:* alignment

---

## SECTION G: AI & Deployment

### G1 — Preferred deployment model? [DEPLOYMENT]
- On-prem / cloud / serverless
- *Purpose:* architecture alignment

### G2 — Security requirements? [SECURITY]
- Compliance needs
- *Purpose:* deployment constraints

---

## SECTION H: Success Criteria

### H1 — What does success look like? [KPI]
- Throughput, cost, downtime
- *Purpose:* define outcome

### H2 — How will you measure success? [METRICS]
- KPIs or financial metrics
- *Purpose:* ROI validation

---

## 4. Minimum Data Set

Vector can operate with:

- 10–15 structured answers  
- basic production data  
- defined decision problem  

---

## 5. Advanced Input (Optional)

- full datasets (CSV, Parquet)
- simulation scenarios
- historical performance trends

---

## 6. Summary

Vector requires:

- clear problem  
- basic data  
- defined constraints  

---

## 7. Key Takeaway

The system does not need perfect input.

But it needs:
**structured thinking about the problem.**

---