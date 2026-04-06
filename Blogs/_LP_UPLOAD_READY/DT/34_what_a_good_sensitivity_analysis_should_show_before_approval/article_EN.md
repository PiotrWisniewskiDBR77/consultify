# What a Good Sensitivity Analysis Should Show Before Approval

Target persona: industrial engineer / project engineer presenting to finance and operations sponsors  
Funnel stage: Consideration  
Core problem: sensitivity slides often show colorful tornado charts without explaining which levers actually move the decision or who owns them  
Main promise: a clear standard for what sensitivity must expose before sign-off so approvers see consequence, ownership, and failure order, not decoration

**Direct answer:** good sensitivity analysis before approval shows ranked levers with direction of impact, the band you tested versus what history supports, how rankings change when levers move together, which outcomes breach guardrails first, and who owns each lever. If sensitivity cannot answer "what breaks first and who fixes it," it is not ready for approval.

Tornado charts are not decisions.

They are invitations to ask better questions.

## What weak sensitivity looks like

Weak packs usually share these traits:

- many parameters listed, few tied to real operating controls  
- one-at-a-time tweaks that ignore coupled effects in the plant  
- no guardrail lines for service, cash, or safety-related outcomes  
- no assumption owners, so debate becomes abstract  

Digital Twin should support a decision system.

Sensitivity is how you show where that system is fragile.

## Framework: six elements approvers should see

1. **Lever list with ownership:** each moving input names a business owner, not only a cell.  
2. **Tested band versus evidence band:** what you simulated versus what the last twelve to twenty-four months justify.  
3. **Direction and monotonicity notes:** does worse supplier performance always hurt the same way, or does the bottleneck migrate?  
4. **Joint movement cases:** at least one combined stress that matches how bad quarters actually arrive.  
5. **Guardrail breaches:** the first KPI or operational limit that fails as levers move.  
6. **Decision flip map:** which paired changes in levers would change the recommended option.

## Checklist: sensitivity pack readiness

- [ ] top five levers are agreed across engineering, operations, and finance  
- [ ] at least one combined case reflects correlated downside you have lived through  
- [ ] bottleneck migration appears in narrative when it happens in the model  
- [ ] procurement and planning see their levers explicitly  
- [ ] invalidation triggers reference measurable signals, not vibes  

For where sensitivity belongs inside a CAPEX gate sequence, use the stage-gates article in this series as the contract map.

## When this works and when it fails

**Works** when the model boundary matches the decision and levers map to controls people actually use.

**Fails** when the team optimizes a metric that leadership will not defend when service breaks.

## What Digital Twin changes here

Digital Twin turns sensitivity work into ranked operational consequence for layout, flow, and CAPEX before approvers sign.

Rendering polish is irrelevant when failure order, guardrail breaches, and lever ownership stay opaque.

Strong sensitivity turns abstract uncertainty into ordered operational risk.

## What DBR77 Digital Twin adds

DBR77 Digital Twin keeps sensitivity tied to traceable assumptions and comparable shock sets, with manual inputs scaling toward richer integration when teams need cleaner lineage.

For approval conversations, it helps teams:

- keep sensitivity narratives consistent across projects  
- tie lever movement to traceable assumptions  
- shorten the path from chart to accountable next step  

## Bottom line

Sensitivity exists to reveal fragility in business language.

If approvers cannot see failure order and ownership, keep working.
