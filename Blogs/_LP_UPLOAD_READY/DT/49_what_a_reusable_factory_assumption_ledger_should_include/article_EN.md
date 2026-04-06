# What a Reusable Factory Assumption Ledger Should Include

Target persona: digital twin steward / industrial engineer maintaining cross-project model truth  
Funnel stage: Adoption  
Core problem: assumptions live in slide footnotes and private chats, so every new scenario restarts arguments about what was "agreed last time"  
Main promise: a compact ledger pattern that makes Digital Twin a traceable decision system across gates and refreshes

**Direct answer:** a reusable factory assumption ledger should include parameter name, value or band, evidence grade (verified, illustrative, hypothesis), source or owner, last verified date, scenarios and gate memos that depend on it, and a change log entry whenever it moves. Structure it so finance can read ranges, operations can challenge floor truth fast, and engineering can map structure impacts. Digital Twin is a scenario-testing environment; the ledger is how you keep scenarios honest over time.

Assumptions are liabilities.

Treat them like controlled documents, not casual opinions.

## Ledger fields: minimum viable row

| Field | Purpose |
|---|---|
| parameter | what the model consumes |
| band or point | numeric range or single value with uncertainty note |
| evidence grade | verified / illustrative / hypothesis |
| owner | who answers questions this week |
| source | system, study, or study name |
| dependents | scenario IDs, gate memo links |
| change history | dated note when value or grade shifted |

## What to include beyond cycle times

- staffing and skill mix availability by shift pattern  
- inbound lead-time behavior and lot sizing rules  
- quality, yield, and rework drivers that change effective capacity  
- maintenance and changeover policies that alter resource calendars  
- storage and handling limits that change flow paths  

## Checklist: ledger health before a major gate

- [ ] no silent point estimates where bands are known  
- [ ] every hypothesis row has a kill date or verification owner  
- [ ] dependent scenarios are flagged when a row changes  
- [ ] finance sign-off rows match the language in the CAPEX memo  

## What Digital Twin changes here

Digital Twin scales when assumptions scale.

The ledger is the shared memory of the decision system.

## What DBR77 Digital Twin adds

DBR77 Digital Twin marries scenario refresh to row-level assumption governance so finance, operations, and engineering cite the same bands at every gate.

## Bottom line

If you cannot point to a row, you cannot defend a ranking.

Build the ledger once, reuse it across projects.
