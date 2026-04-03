# How to Use IoT Data in Shift Handover Without Creating More Reporting

Target persona: Shift lead / Production supervisor / Plant operations manager  
Funnel stage: Consideration  
Core problem: handover still runs on verbal memory and static sheets while IoT adds streams nobody wants to re-type into another report  
Main promise: a tight handover pattern: three live facts, one open risk, one confirmed next action, all grounded in machine state without a new reporting stack

Handover fails when it becomes a storytelling contest.

IoT can fix that if you treat it as shared machine truth at the moment of transfer, not as a second paperwork lane.

The goal is fewer surprises on the incoming shift, not more dashboards to maintain.

Use IoT in handover as a **short, repeatable state snapshot** tied to assets and lines the shift already owns.

Capture: what the machine is doing now versus what the plan expected; what changed since the last stable period; what is waiting on maintenance, quality, or materials with a named owner.

Everything else stays in visibility-only mode until it earns a handover slot.

## Why reporting creep happens

Reporting creep appears when teams try to make IoT "fair" by exporting everything. Fairness in operations is not equal columns. It is equal clarity on what the next shift must not miss.

If handover becomes a dump, people revert to voice and the IoT investment looks optional.

## Handover signal quality bar

Before a signal enters the handover script, it should pass: **Stable enough**: same reading is consistent across two sampling windows or corroborated by a second sensor or a physical check; **Action-linked**: tied to a known playbook, override rule, or escalation path; **Shift-owned**: someone on the floor can confirm or dismiss it in under a few minutes.

If it fails any of these, keep it for engineering review, not for shift turnover.

## Framework: the five-minute handover card

Use one card per critical line or asset group.

1. **Plan versus reality** One line: running to plan, running behind with known cause, or stopped with reason code

2. **Machine state model in plain language** Stable, degrading, stopped for known fault, stopped for unknown fault

3. **Open overrides** What was bypassed, for how long, under whose authority, and when it expires

4. **Maintenance priority** Top one item that changes risk if ignored next shift

5. **Escalation status** Nothing pending / waiting on maintenance / waiting on engineering / waiting on materials

This is enough structure to scale without inventing a new report taxonomy every week.

## Comparison: reporting-first handover versus state-first handover

| Reporting-first | State-first |
|---|---|
| long slide decks or spreadsheets | one card per critical unit |
| argues about numbers | agrees on machine state |
| buries overrides | surfaces overrides and expiry |
| surprises the incoming shift | hands off a decision-ready picture |

## Checklist: keep IoT out of the reporting trap

- [ ] cap handover facts to a fixed number per line
- [ ] ban "export everything" as the default; export only exceptions
- [ ] log overrides with owner, reason, and expiry in the workflow tool, not in email
- [ ] review signal quality monthly with operators, not only with IT
- [ ] tie handover items to standards: safety, quality, delivery, cost

The handover card lands better when the floor already runs a short confirmation habit from [how to use IoT for faster problem confirmation on the shop floor](../39_how_to_use_iot_for_faster_problem_confirmation_on_the_shop_floor/article_EN.md) and supervisor interrupts stay governed per [when IoT should trigger supervisor escalation and when it should not](../34_when_iot_should_trigger_supervisor_escalation_and_when_it_should_not/article_EN.md).

## When this works and when it fails

**Works** when leadership protects the short format and rewards honest unknowns.

**Fails** when every function adds its favorite KPI to the handover screen until operators tune out.

## What this means for DBR77 IoT

DBR77 IoT should make the five-minute handover card the default operating artifact: plan versus reality, plain-language machine state, overrides with owner and expiry, one maintenance line that changes risk, and a clear escalation line.

Pilot scope is about proving calmer turnovers on a single line or asset group before anyone asks for a parallel reporting stack.

## Bottom line

Use IoT to make handover **shorter and truer**, not busier.

Three live facts, one risk, one next action beats another nightly report nobody reads.
