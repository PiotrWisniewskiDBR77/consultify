# When AI Should Recommend and When Humans Should Decide in Operations

Target persona: Quality Director / Operations Director / Engineering Manager  
Funnel stage: Decision  
Core problem: plants either over-trust models or ban AI entirely, because they lack a simple decision-rights map tied to risk, traceability, and accountability  
Main promise: a clear decision-rights framework using risk class, reversibility, and regulatory exposure, plus how to implement it as approval thresholds in workflows

**Direct answer:** AI should recommend by default for operational decisions with ambiguous context, cross-functional tradeoffs, or safety and quality exposure. Humans should decide when the action is hard to reverse, triggers regulatory record-keeping, or crosses a pre-agreed risk threshold, even if the model looks confident.

This is not about mistrusting AI.

It is about matching decision rights to accountability in real plants.

## The factory rule: recommendation is the default, not the exception

In healthy industrial programs, AI behaves like a senior staff function:

- it prepares options
- it highlights constraints
- it surfaces history

Humans retain authority where the organization carries liability.

## A practical risk-class model

Assign each decision type a class. Keep it blunt.

| Risk class | Examples | Typical AI role |
|---|---|---|
| Low | categorize noise, draft internal notes | assist freely |
| Medium | suggest priority band, propose routing | recommend, human confirm |
| High | release quality hold, bypass interlock intent | human decide, AI supports evidence |
| Critical | safety override, ship-to-customer sign-off | human decide with formal record |

This is a framework, not a legal document.

Your compliance team should still validate.

## Use reversibility as a second axis

Even with the same risk class, reversibility matters.

**Easily reversible**  
Change a task order, reassign a non-critical work item, adjust a non-binding draft schedule suggestion.

**Slow or costly to reverse**  
Scrap disposition, customer shipment, major line speed changes, capital-triggering actions.

When reversal is costly, tighten human gates.

## Thresholds turn philosophy into workflow

Make rules operational:

- any suggestion above a severity score requires supervisor confirmation
- any recommendation that changes a protected field requires role-based approval
- any action that touches a regulated object requires an auditable human step

Thresholds should be visible to operators, not hidden in model code.

## Handoffs: where mixed models break

Mixed models break when:

- AI recommends in one tool
- humans decide in another
- the audit trail is split

The decision record should live with the work item.

## Training note: teach refusal, not only acceptance

Teams should practice:

- accepting a good recommendation quickly
- rejecting a recommendation with a reason code
- escalating when context is missing

Reason codes are how the plant learns.

## Why IRIS supports decision-rights discipline

DBR77 IRIS matters here because recommendation, approval, rejection, and audit trail should live in one governed workflow story, not in three disconnected tools.

That makes decision rights inspectable at operator depth instead of turning them into policy text nobody follows under pressure.

If you are deciding agent scope first, see [What an AI Agent Can Do in a Factory Today](../22_what_an_ai_agent_can_do_in_a_factory_today/article_EN.md); if you are testing whether leadership can trust the system, see [What Makes Factory AI Trustworthy for Operations Leaders](../29_what_makes_factory_ai_trustworthy_for_operations_leaders/article_EN.md).

## Final takeaway

The right split is not "AI versus humans."

It is "recommendation versus decision" mapped to risk, reversibility, and governance.

Do that mapping explicitly, or the plant will do it informally in the hallway.
