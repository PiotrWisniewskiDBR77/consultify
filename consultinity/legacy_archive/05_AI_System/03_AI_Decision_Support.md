# 9. AI & Automation Strategy

## 9.1. Deterministic vs. Probabilistic Logic
Enterprise clients require clarity on "What is hard logic" vs "What is AI guessing."

### Deterministic (100% Predictable)
*   **Scoring Logic**: DRD calculations are pure math.
*   **Prioritization Matrix**: Coordinates are user-defined.
*   **Access Control**: RBAC is hard-coded.

### Probabilistic (AI Assisted)
*   **Open-Ended Q&A**: "How do I improve Strategy?"
*   **Trend Analysis**: "Predicting delays based on limited data."
*   **Initiative Generation**: Suggestions are creative, not rule-based.

## 9.2. Explainability & Trust
To ensure trust in "Black Box" recommendations:
*   **References**: AI answers must cite specific data points (e.g., "Because your 'Data Governance' score is 1.2, I recommend...").
*   **Confidence Scores**: Internal logic flags low-confidence responses for review.

## 9.3. Human-in-the-Loop (HITL)
**Principle**: AI never executes a strategic decision automatically.
1.  AI *suggests* an Initiative -> Manager MUST *Approve* it.
2.  AI *drafts* a Report -> Manager MUST *Review/Edit* it.
3.  AI *flags* a Risk -> Manager MUST *Acknowledge* it.

## 9.4. Audit Trail
Every AI interaction is logged for compliance:
*   **Prompt**: What was sent?
*   **Response**: What was received?
*   **Model**: Which model version (e.g., `gemini-1.5-pro`) was used?
*   **Timestamp**: When did it happen?
