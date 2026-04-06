# What a Secure AI Change Control Process Should Include

Target persona: CTO / enterprise architect / IT operations leader  
Funnel stage: Decision  
Core problem: AI systems change weekly through prompts, connectors, and model routes while factories expect the same rigor as MES or PLC changes  
Main promise: a tight change model keeps innovation speed inside visible gates without treating every tweak like a waterfall release

Change control is not hostility to iteration.

It is how iteration stays insured, auditable, and reversible.

## Direct answer

A secure AI change control process for manufacturing should include a classified change taxonomy, mandatory impact assessment per class, peer or CAB review for production-impacting changes, versioned promotion paths from sandbox to production, automated regression checks where possible, dual approval for privileged configuration, immutable logs tied to tickets, rollback artifacts for each release, and post-change verification signed by workflow owners. Client data must never enter training paths as part of a change unless explicitly governed by a separate legal and technical program.

Treat model routes like network routes.

## Framework: five change classes

### Class 1: documentation and help text

Low risk if no behavior change; still log for traceability.

### Class 2: prompt and template edits inside approved bounds

Requires automated diff, reviewer from product or engineering, and time-bound observation window.

### Class 3: connector or scope expansion

Requires architecture alignment, data path update, and security sign-off.

### Class 4: model version or routing change

Requires performance and safety checks, plus stakeholder communication to affected plants.

### Class 5: emergency break-glass

Time-boxed, post-incident review mandatory within seventy-two hours.

## Checklist: minimum ticket content

- change summary in plain language
- affected workflows and sites
- risk class and rollback plan
- test evidence or rationale if tests are not automatable
- approvers and timestamps

## Comparison: ad hoc tweaks versus gated promotion

| Pattern | Velocity feel | Year-two audit |
| --- | --- | --- |
| Ad hoc | fast week one | painful, incomplete history |
| Gated promotion | measured | reconstructable decisions |

## Product bridge

Prompt, connector, and model-route edits are factory changes; tickets need the same who-when-rollback discipline you described for the five classes.

Vector fits environments where promotion is serious: deployment boundaries that separate sandboxes from production paths, client data not used to train the model, proprietary industrial reasoning trained on factory transformation knowledge instead of generic chat, so change control has stable objects to attach approvals and evidence to.

## Final takeaway

If you cannot answer what changed, when, and why, you do not have enterprise AI.

You have a live experiment wearing a production badge.
