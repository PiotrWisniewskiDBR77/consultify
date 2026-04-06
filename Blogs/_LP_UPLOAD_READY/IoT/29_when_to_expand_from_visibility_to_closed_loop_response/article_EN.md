# When to Expand from Visibility to Closed-Loop Response

Target persona: Plant Manager / Engineering lead / Safety and quality sponsor  
Funnel stage: Decision  
Core problem: leadership wants automation headlines while the plant still lacks trusted signals, owners, and rollback discipline  
Main promise: a gated expansion model that moves from see to act only when human loops have proven judgment under load

Closed-loop response is not the next slide after dashboards.

It is the next risk class.

Moving from visibility to automated or semi-automated action without preparation is how plants trade a manageable pilot for a memorable incident.

## What closed-loop really means here

Closed-loop, in practical plant language, means:

- a machine or system condition triggers a defined response
- the response has an owner, a time box, and a verification step
- failure modes are documented, including how to revert

If any of those are missing, you still have visibility with extra confidence.

## Gate model: four gates before expanding

| Gate | Question | Minimum evidence |
|---|---|---|
| G1 Signal trust | do operators and maintenance agree the signal is credible | low false alarm rate for 4-8 weeks |
| G2 Ownership | is there a named human for every branch | roster tested on night shifts |
| G3 Playbook | is the response scripted with limits | written steps, not tribal memory |
| G4 Rollback | can you return to safe manual operation quickly | drill completed once |

Do not open the next gate until the previous one holds under real production load.

## Step sequence: a credible path

1. visibility with monitor-only classification  
2. assisted response: recommendations with mandatory human confirm  
3. bounded auto-response on narrow conditions with tight limits  
4. broader automation only after quarterly review approves based on incident history  

## When to wait even if vendors push faster

Wait when:

- baselines still move week to week without explanation
- turnover on the line breaks training continuity
- integration dependencies would make rollback slow or unclear
- safety or quality context is not consistently attached to events

Waiting is not fear.

It is operating maturity.

Classify signals before you automate responses using [what machine data should trigger action and what should not](../23_what_machine_data_should_trigger_action_and_what_should_not/article_EN.md); keep the monthly alarm discipline in [how to reduce false alarms in IIoT systems](../28_how_to_reduce_false_alarms_in_iiot_systems/article_EN.md) aligned with each gate.

## What this means for DBR77 IoT

DBR77 IoT supports gated expansion when visibility stays the default layer until signal trust, ownership, playbooks, and rollback drills hold under real production load. Edge and compressed pilots are tools for faster learning cycles, not for skipping gates. Position closed-loop steps as earned capability with human-in-the-loop proof, not as a vendor toggle.

## Bottom line

Expand from visibility to closed-loop response only after signal trust, ownership, playbooks, and rollback drills pass real production pressure.

Automation is a privilege earned by proof, not a default setting.
