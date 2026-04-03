# How to Classify Factory Use Cases by AI Risk Before Adoption

Target persona: COO / plant director  
Funnel stage: Awareness  
Core problem: teams label every AI idea as urgent, which hides differences in data sensitivity, automation depth, and blast radius if the model is wrong  
Main promise: a simple risk tier framework aligns adoption pace with deployment boundaries, approval depth, and integration discipline

Not every AI use case deserves the same runway. Classification is how you keep speed without losing control.

Classify factory AI use cases by combining data sensitivity, decision authority, integration touchpoints, and reversibility. Low-risk tiers can move with lighter gates. High-risk tiers require private or isolated deployment, explicit human approval, full logging, and integration change control before any production traffic. Risk tiers turn opinions into a repeatable sorting rule.

## Framework: four dimensions

Score each proposed use case on these dimensions:

1. **Data sensitivity**: does it touch recipes, yields, costs, customer orders, safety parameters, or only anonymized aggregates?
2. **Decision authority**: does output inform a human choice, recommend an automated actuation, or sit purely in analytics?
3. **Integration depth**: does it read or write MES, QMS, CMMS, SCADA-adjacent systems, or stay in documents?
4. **Reversibility**: can you roll back in minutes, or does a wrong output create scrap, downtime, or safety exposure?

## Tier model: green, amber, red, black

| Tier | Typical profile | Minimum control bar |
|---|---|---|
| Green | internal docs, no production writes, synthetic or public data | standard IT policy, basic logging |
| Amber | operational analytics, human-only decisions, limited PII | private API or approved cloud boundary, retention policy |
| Red | production-adjacent reads, quality or planning decisions affecting schedule | on-premise or isolated tenant, subprocessors disclosed, approval workflow |
| Black | actuation hooks, safety-critical parameters, regulated records | hard isolation by site or workflow, no generic public tooling, full audit trail |

Black is rare.

When it appears, pause the project until architecture matches the tier.

## Step sequence: classify before you charter

### Step 1: Write one sentence on the operational outcome

If you cannot state the decision class, you cannot score risk.

### Step 2: Inventory data classes touched

List sources and sinks. Include exports, screenshots, and support tickets.

### Step 3: Map integrations as read versus write

Writes escalate tier almost automatically.

### Step 4: Assign tier and publish the bar

Post the tier next to the business case. Procurement and security should see the same label.

## When this framework fails

It fails when teams hide shadow paths, such as operators pasting line data into personal chat tools. Run a quarterly shadow-use scan alongside formal projects.

## Product bridge

Green-through-black tiering is useless if the platform class cannot tighten with the tier: identity scope, data paths, logging depth, and promotion rules have to move in step.

Vector is built for that ladder: proprietary industrial AI with deployment options that scale from controlled cloud patterns to stronger isolation, client data excluded from training the shared model, and industrial reasoning trained on factory transformation knowledge instead of consumer-style chat defaults.

## Final takeaway

Risk classification is not bureaucracy.

It is how manufacturers adopt AI at the right speed for each decision type. Sort use cases before you sort vendors.

---

*DBR77 Vector maps to higher-risk tiers through private API, on-premise, and isolated deployment patterns with industrial reasoning and no client-data training. [Explore products using Vector](https://dbr77.com/vector) or [Review security](https://dbr77.com/demo).*
