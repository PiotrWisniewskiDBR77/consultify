# When a Manufacturer Should Isolate AI by Site, Business Unit, or Workflow

Target persona: COO / IT director  
Funnel stage: Consideration  
Core problem: a single shared AI tenant feels efficient until cross-site data mixing, conflicting policies, or one incident forces a painful split  
Main promise: clear isolation rules align blast radius, compliance boundaries, and operational ownership with how the factory network actually runs

Isolation is not paranoia.

It is blast-radius engineering.

## Direct answer

Isolate AI by site when plants operate under different regulatory regimes, data classifications, or union and works-council constraints. Isolate by business unit when P and L, IP, or customer confidentiality must not commingle in logs and admin access. Isolate by workflow when a high-automation path touches actuation or safety-adjacent systems while other workflows stay analytical.

The right unit of isolation matches the unit of trust.

## Framework: three isolation lenses

### Lens 1: Regulatory and data class

If two sites cannot share the same backup jurisdiction or retention rule, they should not share the same AI runtime namespace.

### Lens 2: Commercial and IP boundaries

When business units compete for the same customers or protect distinct process IP, shared inference tenants create unnecessary forensic doubt after any leak suspicion.

### Lens 3: Operational and safety coupling

Workflows that can influence physical state deserve harder boundaries than summarization of internal PDFs.

## Comparison: shared tenant versus isolated stacks

| Factor | Shared AI tenant | Isolated per site, BU, or workflow |
|---|---|---|
| Operating cost | lower baseline | higher baseline |
| Blast radius | wider | narrower |
| Audit narrative | harder to explain under stress | simpler ownership lines |
| Vendor admin access | one door to protect | multiple doors, each smaller |

## Step sequence: choose isolation unit

### Step 1: List the worst credible loss event

Data leak, wrong actuation, schedule corruption, or reputational harm with a named customer.

### Step 2: Map which sites or units would be implicated

If the answer is everyone, tighten isolation.

### Step 3: Check contractual and policy prohibitions on mixing

Customer contracts and internal classification standards are decisive.

### Step 4: Document the isolation decision in the integration register

Future expansions should not silently collapse boundaries.

## When shared tenancy is still reasonable

Shared tenancy can work when data classes are uniform, policies are centralized, logging is segregated by tenant tags with cryptographic separation, and no workflow writes to production systems without a dedicated approval plane.

Verify those conditions in writing.

## Product bridge

Site, business unit, and workflow isolation are trust-domain decisions; the platform has to offer deployment shapes that respect those domains without forcing one brittle global tenant.

Vector supports that exercise: proprietary industrial AI with on-premise, private API, and isolated patterns, client data excluded from training the shared model, and industrial reasoning aimed at transformation work so your three-lens choice lands on architecture, not on consumer SaaS defaults.

## Final takeaway

Manufacturers should choose isolation granularity the same way they choose network zones.

Match the boundary to the trust domain.

Then scale inside the boundary with discipline.
