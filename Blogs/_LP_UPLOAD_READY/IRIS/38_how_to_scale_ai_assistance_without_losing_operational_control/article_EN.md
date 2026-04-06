# How to Scale AI Assistance Without Losing Operational Control

Target persona: VP Operations / Plant Manager / IT-OT Program Lead  
Funnel stage: Decision  
Core problem: successful pilots get pressure to "turn it on everywhere," which spreads thin ownership, inconsistent thresholds, and silent workarounds  
Main promise: a scale playbook with expansion caps, control tests, and kill criteria so growth preserves response discipline and auditability

**Direct answer:** Scale AI assistance without losing operational control by expanding in bounded waves: one new workflow or line at a time, each with published caps on act-mode actions, mandatory advise-mode periods for new cohorts, and weekly control reviews. Require a green scorecard on closure quality, override reasons, and incident linkage before widening scope. If you cannot pause or roll back a workflow in minutes, you are not scaling, you are gambling.

Control is not the enemy of speed.

Control is how speed survives contact with production.

## Expansion rules that protect the plant

Adopt explicit caps:

- maximum number of concurrent act-mode workflows during a quarter  
- maximum auto-routed tasks per hour per line without human batch review  
- maximum model or rule versions live at once  

Caps feel bureaucratic until an incident arrives.

Then they feel like adulthood.

## Control tests before each wave

Run these checks before expanding scope:

1. rollback drill: can you revert to advise in under fifteen minutes?  
2. ownership drill: can every auto path name its accountable role?  
3. evidence drill: can auditors reconstruct why a task fired?  
4. shift parity drill: does night behave within two percentage points of day on override rate?  

Fail any drill, pause expansion.

## Scorecard: weekly operational control review (example fields)

| Metric | Target band | Red flag |
|---|---|---|
| SLA breaches on AI-tagged tasks | below baseline plus agreed delta | rising three weeks straight |
| override rate | stable band by workflow | spike without categorized reasons |
| incidents linked to AI-assisted routing | zero critical | any critical without postmortem |
| unknown-rule reports at handoff | zero | any repeat occurrence |

Red flags need named remediation owners.

## Comparison: viral rollout versus bounded waves

**Viral rollout**  
"Everyone gets the assistant."

**Bounded waves**  
"Line B inherits Line A's playbook after Line A passes the scorecard."

Viral rollout optimizes demos.

Bounded waves optimize Monday morning.

## Training and comms at scale

Scaling assistance requires scaling literacy:

- short job aids per workflow: what AI can do, cannot do, and how to reject  
- floor captains who can explain thresholds without IT in the room  
- a single changelog channel humans actually read  

If training does not scale, workarounds will.

## Why IRIS supports bounded scaling

DBR77 IRIS matters here because caps, rollback drills, and weekly scorecards only work when the same execution fabric spans functions instead of forcing each team to improvise control in its own tool.

That makes scaling a governed wave, not a viral spread.

If you want the rollout pattern before scale, see [How to Roll Out AI-Assisted Operations Without Disrupting the Plant](../30_how_to_roll_out_ai_assisted_operations_without_disrupting_the_plant/article_EN.md); if you want the ninety-day review after each wave, see [How to Review AI-Assisted Operations After the First 90 Days](../40_how_to_review_ai_assisted_operations_after_the_first_90_days/article_EN.md).

## Final takeaway

Scale in waves with caps, drills, and scorecards.

If rollback is not rehearsed, control is imaginary.
