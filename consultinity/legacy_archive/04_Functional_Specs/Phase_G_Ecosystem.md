# Phase G – Ecosystem Participation Functional Specification

---

## 1. Purpose of Phase G

Phase G is the **long-term effect**, not a feature. The system grows through recommendations, not campaigns. Users participate in the ecosystem because the system genuinely helps them think, communicate, and decide.

**What Phase G is:**
- Organic growth through value delivery
- Consultant network effects
- Benchmark and collective intelligence

**What Phase G is not:**
- Viral marketing mechanics
- Forced referral incentives
- Growth-at-all-costs tactics

---

## 2. Entry Conditions

Phase G is not a discrete entry — it emerges when:
- Organization has been active for 30+ days
- At least 1 initiative completed
- User has experienced value (NPS proxy signals)

---

## 3. Organic Growth Mechanisms

### 3.1 Referral Codes

Users can generate referral codes for colleagues at other companies.

| Aspect | Specification |
|--------|---------------|
| Code format | `REF-[USER_ID_SHORT]-[RANDOM]` (e.g., `REF-PWI-X7K9`) |
| Validity | 90 days |
| Max uses | Unlimited (tracked for attribution) |
| Reward | None (value-driven, not incentive-driven) |

**AI prompt for code generation:**
> *"It sounds like [External Person] is facing similar challenges. Would you like to share a referral code so they can explore Consultify?"*

### 3.2 Consultant Mode

Registered consultants can:
- Manage multiple organizations
- Generate client invitation codes
- Access cross-org benchmarks (anonymized)

| Feature | Behavior |
|---------|----------|
| Code type | `CONS-[CONSULTANT_ID]-[RANDOM]` |
| Client tracking | Attribution chain preserved |
| Billing | Consultant may be responsible or pass-through |

### 3.3 Benchmarks (Anonymized)

Organizations can opt-in to benchmark comparisons:
- Industry-specific DRD averages
- Transformation progress comparisons
- Time-to-value metrics

**Privacy rules:**
- All data anonymized before aggregation
- Minimum 10 organizations per benchmark cohort
- Opt-in only, revocable anytime

---

## 4. AI Reviews

AI can generate periodic reviews for organizations:

### Review Types

| Review | Frequency | Content |
|--------|-----------|---------|
| Weekly Progress | Every 7 days | Initiative status, blockers, wins |
| Monthly Insights | Every 30 days | Trend analysis, recommendations |
| Quarterly Strategic | Every 90 days | Big-picture assessment, pivot suggestions |

### Review Delivery

- In-app notification
- Optional email digest
- PDF export for stakeholders

---

## 5. Ecosystem Signals

The system tracks organic growth health:

| Signal | Measurement | Target |
|--------|-------------|--------|
| Referral conversion rate | Codes used / codes generated | > 20% |
| Consultant client retention | Clients active after 90 days | > 80% |
| Benchmark participation | Opt-in rate | > 40% |
| NPS proxy | Return visits, time in app | Positive trend |

---

## 6. Data Architecture

### New Tables Required

```sql
-- Referral tracking
CREATE TABLE referrals (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    created_by_user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    use_count INTEGER DEFAULT 0,
    FOREIGN KEY (created_by_user_id) REFERENCES users(id)
);

-- Referral usage
CREATE TABLE referral_uses (
    id TEXT PRIMARY KEY,
    referral_id TEXT NOT NULL,
    used_by_user_id TEXT NOT NULL,
    used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    resulted_in_org_id TEXT,
    FOREIGN KEY (referral_id) REFERENCES referrals(id),
    FOREIGN KEY (used_by_user_id) REFERENCES users(id)
);

-- Benchmark opt-ins
CREATE TABLE benchmark_participation (
    organization_id TEXT PRIMARY KEY,
    opted_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    industry_category TEXT,
    opted_out_at DATETIME,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);
```

---

## 7. AI Behavior in Phase G

| Role | Behavior |
|------|----------|
| **Referral Suggester** | Detects when user mentions external contacts who might benefit |
| **Review Generator** | Creates periodic organizational assessments |
| **Benchmark Interpreter** | Explains anonymized comparisons |
| **Value Articulator** | Helps users explain value to others |

### What AI Does NOT Do
- Pressure users to refer
- Make up benchmark data
- Share organization data externally
- Incentivize through discounts or credits

---

## 8. Privacy & Trust

### Core Principles

1. **Opt-in everything**: No automatic data sharing
2. **Anonymization first**: Aggregation only after privacy transform
3. **Transparent attribution**: Users know when they're being credited
4. **No dark patterns**: Growth through value, never manipulation

---

## 9. Success Criteria

Phase G is successful when:
- [x] System grows primarily through referrals (> 50% of new orgs)
- [x] Consultants actively use the platform for clients
- [x] Benchmark data provides genuine value
- [x] No marketing campaigns needed for growth

---

## 10. Phase Boundaries

- **Emergence from Phase F**: Active organizations naturally enter Phase G
- **Flywheel effect**: Phase G feeds Phase C (new trials from referrals)
- **No forced exit**: Organizations remain in ecosystem indefinitely

---

## 11. Acceptance Criteria

- [ ] Referral code generation works
- [ ] Attribution chain is preserved through conversion
- [ ] Benchmark participation is opt-in
- [ ] AI reviews generate on schedule
- [ ] Privacy anonymization verified

---

*Prepared by Antigravity – 2025-12-21*
