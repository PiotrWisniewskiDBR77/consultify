# Co powinien zawierac reusable factory assumption ledger

Target persona: digital twin steward / industrial engineer maintaining cross-project model truth  
Funnel stage: Adoption  
Core problem: assumptions zyja w slide footnotes i private chats, wiec kazdy new scenario restarts arguments o co bylo "agreed last time"  
Main promise: compact ledger pattern ktory robi Digital Twin traceable decision system across gates i refreshes

**Bezposrednia odpowiedz:** reusable factory assumption ledger powinien include parameter name, value albo band, evidence grade (verified, illustrative, hypothesis), source albo owner, last verified date, scenarios i gate memos ktore depend on it, i change log entry whenever it moves. Structure tak zeby finance mogla read ranges, operations mogla challenge floor truth fast, i engineering mogla map structure impacts. Digital Twin to scenario-testing environment; ledger to jak keep scenarios honest over time.

Assumptions to liabilities.

Traktuj je jak controlled documents, nie casual opinions.

## Ledger fields: minimum viable row

| Field | Purpose |
|---|---|
| parameter | co model consumes |
| band albo point | numeric range albo single value z uncertainty note |
| evidence grade | verified / illustrative / hypothesis |
| owner | kto answers questions this week |
| source | system, study, albo study name |
| dependents | scenario IDs, gate memo links |
| change history | dated note gdy value albo grade shifted |

## Co include poza cycle times

- staffing i skill mix availability by shift pattern  
- inbound lead-time behavior i lot sizing rules  
- quality, yield i rework drivers ktore change effective capacity  
- maintenance i changeover policies ktore alter resource calendars  
- storage i handling limits ktore change flow paths  

## Checklist: ledger health przed major gate

- [ ] no silent point estimates gdzie bands sa known  
- [ ] kazdy hypothesis row ma kill date albo verification owner  
- [ ] dependent scenarios sa flagged gdy row changes  
- [ ] finance sign-off rows match language w CAPEX memo  

## Co Digital Twin zmienia tutaj

Digital Twin scales gdy assumptions scale.

Ledger to shared memory decision system.

## Co dodaje DBR77 Digital Twin

DBR77 Digital Twin wspiera practical scenario comparison i refresh discipline ktore pairs naturalnie z assumption governance.

## Bottom line

Jesli nie mozesz point do row, nie mozesz defend ranking.

Build ledger once, reuse across projects.
