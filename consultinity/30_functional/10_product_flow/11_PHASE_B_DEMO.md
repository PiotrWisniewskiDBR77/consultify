# PHASE B — DEMO SESSION

## 1. Strategic Intent
| Dimension | Definition |
|-----------|------------|
| **Business Goal** | Demonstrate method maturity, not features. |
| **User Perception** | "This is serious. Nobody is trying to trap me." |
| **Success Metric** | User understands DRD methodology. |

## 2. User Journey Workflow
1. **Auth**: User logs via Google/LinkedIn/Email (Read-only, no DB write).
2. **Exploration**: User enters the "Legolex" reference environment.
3. **Interaction**: User explores pre-populated DRD axes and initiatives.
4. **AI Narrative**: AI Narrator explains "Why" things are structured this way.

## 3. Technical Implementation
- **AI Mode**: **NARRATOR**. Explains only, never asks questions or suggests actions.
- **Persistence**: **EPHEMERAL**. No user or organization records created. Session expires in 24h.
- **UI Banner**: Persistent "DEMO MODE" banner on all screens.

## 4. Quality Checklist
- [x] No persistent data created.
- [x] All write actions disabled (`permissions: 'READ_ONLY'`).
- [x] AI never initiates conversation.
- [x] Clear "Exit Demo" path.
