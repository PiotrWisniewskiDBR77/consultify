# Initiative Element Coverage And Gap Matrix v8

> Status: Draft v8
> Owner: Product + Engineering
> Scope: complete audit of initiative element coverage across docs, runtime sections and PM expectations

---

## 1. Why this document exists

An initiative is only as strong as the set of elements it contains.

If core initiative domains are missing, weak or under-specified, the initiative may look complete in UI while remaining incomplete as a real delivery object.

This document checks whether the initiative package covers all necessary domains.

---

## 2. Current strong element coverage

The current package already strongly covers:

- initiative definition
- problem and target state
- scope
- KPI and financial framing
- team and RACI
- resources
- dependencies
- RAID and risks
- milestones and timeline
- tasks and decisions
- gates and governance
- comments, attachments and activity history

It also now covers:

- analysis cockpit
- technology advisory
- skill-gap and capability planning
- role resolution and team permissions

---

## 3. Current element gaps or weakly described areas

### 3.1 Technical specification as first-class runtime section

The initiative canon names `Technical Specification`, but runtime section coverage is still weaker than other initiative domains.

This should become a clearly governed initiative surface, not only an implied technology note.

### 3.2 Quality and acceptance management

The package still lacks one explicit initiative-level doctrine for:

- quality plan
- validation approach
- acceptance logic
- handover readiness

### 3.3 Communications and engagement plan

Stakeholders and RACI exist, but initiative-level communication planning is still under-specified.

### 3.4 Procurement, vendor and external delivery readiness

Where initiatives depend on external vendors, tools or contracts, the package does not yet have one explicit initiative domain for that operating reality.

### 3.5 Benefits lifecycle beyond KPI rows

KPIs exist, but benefits realization still risks being narrower than a full business-adoption and benefits-management layer.

### 3.6 Assumptions and constraints as governed object

Assumptions appear in fields and related docs, but are still not a clearly hardened initiative-level register.

### 3.7 Closure and handover pack

The package needs clearer initiative-level doctrine for:

- handover
- hypercare
- transition to operational ownership
- closure evidence beyond task completion

---

## 4. Structural drift risks

Main current risks:

- initiative docs and runtime sections are not always one-to-one
- section registry, DB seed and completeness logic may drift
- some strong fields exist in types, but do not exist as explicit first-class sections
- some initiative expectations are spread across flow docs, UI docs and type models instead of one section-level doctrine

---

## 5. Target doctrine

`Initiative v8` should treat an initiative as a complete managed object with explicit coverage of:

- strategy and scope
- economics and benefits
- people, roles and capabilities
- technology and architecture
- quality, acceptance and handover
- work decomposition and dependencies
- timeline, capacity and risks
- communication and governance

---

## 6. Related canonical docs

- `INITIATIVE_CHANGE_MANAGEMENT_SYSTEM_V8.md`
- `INITIATIVE_TECHNOLOGY_ADVISORY_AND_ARCHITECTURE_RUNTIME_V8.md`
- `INITIATIVE_SKILL_GAP_AND_CAPABILITY_DEVELOPMENT_V8.md`
- `INITIATIVE_ANALYSIS_QUALITY_LOGIC_AND_CAPACITY_RUNTIME_V8.md`
- `TASK_AND_DECISION_RUNTIME_CONTRACT_V8.md`
