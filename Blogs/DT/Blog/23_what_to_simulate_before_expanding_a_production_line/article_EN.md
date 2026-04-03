# What to Simulate Before Expanding a Production Line

Target persona: plant director / industrial engineering lead / program sponsor  
Funnel stage: Decision  
Core problem: line expansion is often sized from static capacity math and vendor proposals, while the real risk sits in coupling, ramp behavior, and how the new segment behaves under mix and variability  
Main promise: a compact simulation scope that tests expansion decisions before concrete, staffing, and supplier commitments lock in

before expanding a line, simulate baseline performance under realistic variability, the smallest set of credible expansion variants, ramp and learning curves, shared-resource contention, and intralogistics feeding the new segment. Skip simulation only when the expansion is a trivial duplicate of an existing cell with identical mix and no shared constraints. Line expansion is rarely "more machines in the same hall." It is a change in how work arrives, queues, and recovers.

## Why expansion approvals need operational proof, not only CAPEX packets

A strong expansion memo can still miss: how WIP and queues redistribute when the new segment starts; whether the bottleneck migrates upstream or downstream; how changeovers and mix interact once throughput rises; whether material delivery, staging, or kitting becomes the hidden limiter.

Those failures are expensive after steel is poured and contracts are signed.

## Minimum scenario set for a line expansion decision

Run these scenarios against the same model assumptions: **Baseline today:** include bad weeks, not only average weeks; **Target throughput band:** the volume leadership wants to support, expressed as a range; **Mix stress:** the family mix that hurts cycle time and changeover time most; **Ramp case:** honest training, scrap, and stability assumptions for the first operating months; **Coupled resources:** shared tools, testers, cranes, AGV loops, or relief staffing that both lines touch.

You are comparing how the system fails, not decorating a success story.

## Expansion variant comparison framework

Use a simple scoreboard so finance and operations debate the same facts:

| Criterion | Why it matters |
|---|---|
| Throughput at the bottleneck under stress | shows whether expansion truly relieves the limiter |
| WIP and queue time at top constraints | catches false capacity that only moves waiting |
| Overtime and temp labor exposure | translates operational risk into cost language |
| Time to stable output after go-live | tests whether the business case assumes instant maturity |
| Sensitivity to supplier or inbound delay | surfaces logistics coupling |

If two variants look close on average but diverge under stress, stress is the truth you need before spend.

## Checklist: inputs leadership should agree on before the model runs

- **Decision sentence:** what exactly is being chosen (capacity, layout, supplier scope, staffing model).  
- **Demand shape:** level, mix, and seasonality assumptions owned by sales and planning.  
- **Constraint list:** what cannot flex in the first 90 days after start-up.  
- **Failure definition:** what KPI breach counts as "this option is disqualified."

Without those four, the model becomes a Rorschach test.

## Common mistake: modeling the new line in isolation

Isolated line models feel clean. They often lie.

If the expansion steals indirect time, maintenance windows, or material handling capacity from the rest of the site, the plant learns that lesson during ramp, not during the approval meeting.

## What Digital Twin changes here

Digital Twin is a scenario-testing environment for capital-adjacent operational decisions. The value is comparable scenarios, not a layout flythrough.

It lets leadership see how an expanded line interacts with flow, buffers, and shared resources before layout and sourcing choices become hard to unwind.

## What DBR77 Digital Twin adds

DBR77 Digital Twin centers expansion decisions: it keeps throughput, flexibility, inventory, and ramp risk in one comparable frame before spend locks.

For expansion decisions, it supports: side-by-side testing of credible expansion variants under variability; clearer trade-offs between throughput, flexibility, inventory, and ramp risk; decision records that finance and operations can align on without slide optimism.

## Bottom line

Simulate before expanding a production line when shared resources, mix, or ramp risk can overturn a CAPEX story that looks fine as a static case.

If the expansion is a true duplicate cell with isolated logistics and stable mix, you may move faster with measurement-led pilots. The goal is fewer surprises when spend turns into concrete.

---

*DBR77 Digital Twin helps teams compare expansion variants under variability and shared-resource coupling before physical and supplier commitments harden. [Book a demo](https://dbr77.com/digital-twin) or [Explore Digital Twin](https://dbr77.com/demo).*
