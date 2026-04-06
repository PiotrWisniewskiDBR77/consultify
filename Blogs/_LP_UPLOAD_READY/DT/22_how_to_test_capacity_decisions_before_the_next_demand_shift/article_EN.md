# How to Test Capacity Decisions Before the Next Demand Shift

Target persona: COO / head of planning / operations director aligned with S&OP  
Funnel stage: Consideration  
Core problem: capacity decisions are often made from spreadsheets and average load, then surprised by mix spikes, ramp curves, or constraint migration when demand moves  
Main promise: a compact method to stress-test capacity choices with scenarios so the next demand shift does not become an unplanned firefight

**Direct answer:** test capacity decisions by defining the decision in one sentence, modeling baseline plus at least three demand shapes (level shift, mix shift, spike), and tracking constraint migration, queue growth, overtime, and service risk. Use manual or historical inputs first if live feeds are not ready. The output should be comparable KPIs per scenario, not a single forecast number.

Capacity is not a headline number on a slide.

It is behavior under a schedule that refuses to stay neat.

## Why averages mislead capacity decisions

Average demand can hide:

- weekly spikes that consume the same machines as baseline volume
- mix changes that move load to slower variants
- seasonal ramps that arrive faster than hiring or training
- coupled constraints in logistics that steal effective line time

If the decision is "we are fine at X units per week," the factory may still fail when X arrives with the wrong shape.

## Frame the capacity decision as a comparison

Before any modeling detail, write the decision sentence.

Examples:

- "We choose overtime-first versus incremental headcount versus a targeted bottleneck investment for the next 18 months."  
- "We choose to defer line B expansion until line A stabilizes under the new product family."  
- "We choose between two shift patterns under a 20 percent uplift scenario."

If you cannot compare alternatives, you do not have a decision yet.

You have a mood.

## Minimum scenario set (demand shift lens)

Run at least these demand shapes against the same operational model:

1. **Level shift:** uniform uplift or decline close to leadership's base case.  
2. **Mix shift:** volume stable, but the product family distribution changes enough to alter cycle times and changeovers.  
3. **Spike week:** a short window hits high load while recovery assumptions stay realistic.  
4. **Ramp curve:** demand grows month by month with hiring and training lag modeled honestly.

You are not predicting which one will happen.

You are learning which plan breaks first.

## KPIs that make capacity comparisons honest

Track a small set that leadership cannot argue away:

- throughput and backlog risk at the bottleneck
- WIP and queue time at the top three constraint candidates
- overtime and temporary labor exposure
- on-time risk proxy tied to release and shipping rules
- stability: does the bottleneck stay put or migrate between scenarios?

If the bottleneck moves, that is a signal, not a modeling error.

## Step sequence: from question to defendable comparison

1. **Lock the decision sentence** and the real alternatives.  
2. **Define baseline** using recent weeks that include pain, not only smooth weeks.  
3. **Encode constraints** that matter: staffing rules, tool sharing, material release, transport loops.  
4. **Run the scenario set** with the same randomness policy (or the same trace replay policy) across alternatives.  
5. **Compare trade-offs** in plain language: cost, risk, flexibility, time to implement.  
6. **Record assumptions** that would invalidate the conclusion if wrong.

## When this approach fails

This fails when teams refuse to name constraints, when leadership changes the question weekly, or when the model is tuned to reproduce the slide instead of stress the plan.

It also fails if the organization mistakes a pretty dashboard for a decision record.

## What Digital Twin changes here

Digital Twin is a scenario-testing environment for operational decisions.

It is not a 3D showcase.

It helps you see how capacity plans behave before demand forces the lesson on the floor.

## What DBR77 Digital Twin adds

DBR77 Digital Twin supports practical scenario comparison with a path from manual inputs toward richer integration.

For capacity decisions, that means:

- disciplined side-by-side evaluation of staffing, shift, and investment options
- variability-aware testing instead of single-point capacity math
- clearer communication with finance and sales about risk, not false precision

## Bottom line

Test capacity decisions by comparing real alternatives under multiple demand shapes and by watching whether constraints migrate.

If you only trust averages, the next demand shift will teach the same lesson with higher urgency and lower dignity.
