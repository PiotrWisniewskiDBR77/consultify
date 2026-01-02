# PHASE C — TRIAL ENTRY (SELECTIVE)

## 1. Strategic Intent
| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Filter serious organizations. |
| **User Perception** | "This is selective. My time investment matters." |
| **Success Metric** | High intent → high conversion. |

## 2. User Journey Workflow
1. **Verification**: User enters 12-char alphanumeric invitation code.
2. **Onboarding**: User is presented with trial scopes and limits.
3. **Engagement**: User begins limited work with 50 daily AI query cap.
4. **Decision Gating**: Transition to "Org Setup" requires explicit 3-point consent.

## 3. Technical Implementation
- **Validation**: Codes stored as SHA-256 hashes.
- **AI Mode**: **GUIDE**. Explains limits, sets expectations, validates readiness.
- **Watermarking**: All exports from trial are watermarked.

## 4. Quality Checklist
- [x] No open signup path.
- [x] Limits clearly communicated in a dedicated status UI.
- [x] No urgency or "upgrade now" language.
- [x] Transition requires 3 explicit user confirmations.
