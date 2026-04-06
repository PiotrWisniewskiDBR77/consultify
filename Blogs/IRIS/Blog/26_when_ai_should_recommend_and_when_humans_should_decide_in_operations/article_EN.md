# When AI Should Recommend and When Humans Should Decide in Operations

Target persona: Quality Director / Operations Director / Engineering Manager  
Funnel stage: Decision  
Core problem: plants either over-trust models or ban AI entirely, because they lack a simple decision-rights map tied to risk, traceability, and accountability  
Main promise: a clear decision-rights framework using risk class, reversibility, and regulatory exposure, plus how to implement it as approval thresholds in workflows

AI should recommend by default when context is ambiguous, tradeoffs cross functions, or safety and quality exposure is material. Humans should decide when the action is hard to reverse, triggers regulatory record-keeping, or crosses a pre-agreed risk threshold—even if the model looks confident. This is not mistrust of AI. It is matching decision rights to accountability in environments where “move fast and apologize” is not an acceptable operating principle.

In healthy industrial programs, AI behaves like a strong staff function: it prepares options, highlights constraints, and surfaces history. Humans retain authority where the organization carries liability. That division is how adoption survives first contact with audits, customers, and night shift pressure.

Risk class is a blunt but useful lens. Low-risk work—noise categorization, draft internal notes—can often be assisted freely. Medium-risk work—suggested priority bands, proposed routing—typically belongs in recommend-and-confirm patterns. High-risk work—releases that change customer-facing quality state, actions that flirt with interlock intent—usually requires explicit human decision-making with evidence. Critical actions—safety overrides, ship-to-customer sign-offs—should remain human-led with formal records, with AI supporting evidence, not owning the stamp.

Reversibility sharpens the same picture. Easily reversible moves—reordering non-critical tasks, reassigning work items that do not change protected states—can tolerate faster loops. Slow or costly reversals—scrap disposition, major line speed changes, actions that trigger capital or customer commitments—should tighten human gates even when the model sounds sure.

Philosophy becomes operational only when it becomes thresholds. Publish rules operators can recognize: severity scores that force supervisor confirmation, protected fields that require role-based approval, regulated objects that demand auditable human steps. Thresholds should be visible to the floor—not hidden inside model code where nobody can explain a miss under pressure.

Mixed models break when AI recommends in one tool, humans decide in another, and the audit trail splits. The decision record should live with the work item, because the work item is what the plant will defend tomorrow.

Training should include refusal, not only acceptance. Teams should practice accepting a good recommendation quickly, rejecting with a reason code, and escalating when context is missing. Reason codes are how the plant learns without turning overrides into shame—or into invisible rebellion.

IRIS matters because recommendation, approval, rejection, and audit trail should live in one governed workflow story. That makes decision rights inspectable at operator depth instead of dissolving into policy text nobody follows when the line is hot.

For agent scope, see [What an AI Agent Can Do in a Factory Today](../22_what_an_ai_agent_can_do_in_a_factory_today/article_EN.md). For leadership trust criteria, see [What Makes Factory AI Trustworthy for Operations Leaders](../29_what_makes_factory_ai_trustworthy_for_operations_leaders/article_EN.md).

The right split is not “AI versus humans.” It is “recommendation versus decision,” mapped to risk, reversibility, and governance. Do that mapping explicitly—or the plant will do it informally in the hallway, where nobody can audit the outcome.

## The operational bottom line

The promise of this article—a clear decision-rights framework using risk class, reversibility, and regulatory exposure, plus how to implement it as approval thresholds in workflows—becomes operational only when it changes how work moves: clearer ownership, faster first assignment, and closure you can trace without inbox archaeology. For “When AI Should Recommend and When Humans Should Decide in Operations,” treat that as the acceptance test: the next shift should be able to read what happened, what was approved, and what remains open—without relying on verbal reconstruction.

Hold teams to a simple rule: if an improvement cannot be shown in exports from the execution record, it is not yet an operating improvement—only a narrative improvement. That rule keeps programs honest when demos look good but handovers still feel fragile.
If the record is thin, fix the record before you expand the ambition.

---

*DBR77 IRIS keeps recommendations, human decisions, and audit trails attached to the same work items across production, warehouse, quality, maintenance, and tasking. [Start interactive demo](https://dbr77.com/iris) or [Watch walkthrough](https://dbr77.com/demo).*
