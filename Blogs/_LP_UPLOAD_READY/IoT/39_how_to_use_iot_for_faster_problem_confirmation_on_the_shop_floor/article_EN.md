# How to Use IoT for Faster Problem Confirmation on the Shop Floor

Target persona: Line supervisor / Process engineer / Quality technician  
Funnel stage: Consideration  
Core problem: teams debate whether the machine is actually wrong or the story is wrong, so minutes burn while production waits on opinions  
Main promise: a confirmation workflow: live signals plus a short physical check list, agreed corroboration rules, and a single "confirmed / not confirmed" outcome for the next action

IoT does not replace walking the line.

It shortens the argument about what is true right now.

Fast confirmation is a team habit backed by signal quality, not a feature toggle.

## Direct answer

Use IoT to confirm problems faster by pairing **one live signal bundle** with a **three-step physical check** and a **time box** for the decision.

Typical sequence:

1. Pull the last stable window and the current window for the same signal family  
2. Run the agreed physical checks that operators trust for that asset class  
3. Record confirmed versus not confirmed with a reason code, even if the reason is "sensor suspect"

If you skip step three, you train people to fight the screen.

## Corroboration rules that work in brownfield

Brownfield means distrust is rational until proven otherwise.

| Rule | Purpose |
|---|---|
| two-signal agreement for interrupt-class claims | reduces single-point lies |
| physical check for stop-class claims | anchors reality |
| photo or gauge reading optional where policy allows | creates audit-friendly evidence |

Keep rules simple enough for night shift.

## Comparison: opinion loop versus confirmation loop

| Opinion loop | Confirmation loop |
|---|---|
| long discussion | short checklist |
| blame between functions | shared evidence object |
| delayed run decision | bounded time box |
| IoT feels political | IoT feels operational |

## Checklist: make confirmation respectable

- [ ] operators helped write the physical check list
- [ ] supervisors protect the time box; escalation follows if it expires
- [ ] maintenance joins only after confirmation or when safety demands
- [ ] standards cited when quality or safety gates apply
- [ ] bad confirmations get reviewed like near misses, without personal attacks

## Planning note

Confirmation is about **now**.

Planning uses confirmed events later in the week.

Do not mix the two conversations in the same ten minutes.

Confirmation is easier when distrust is handled openly in [what to do when operators do not trust IoT signals yet](../27_what_to_do_when_operators_do_not_trust_iot_signals_yet/article_EN.md), action gates stay clear in [what machine data should trigger action and what should not](../23_what_machine_data_should_trigger_action_and_what_should_not/article_EN.md), and planners only consume confirmed events per [when real-time visibility should change the production plan](../40_when_real_time_visibility_should_change_the_production_plan/article_EN.md).

## What this means for DBR77 IoT

DBR77 IoT should surface the live signal bundle and a short audit trail at the asset so the shift can close confirmed versus not confirmed inside the time box, with escalation when the clock runs out.

Older machines join the same habit when connectivity is honest about gaps instead of pretending remote-only truth.

## Bottom line

Faster confirmation is **signals plus trusted physical checks plus a time box**.

IoT earns floor credibility when it ends arguments, not when it starts them.
