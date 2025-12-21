# 6.2. Assessment Functional Specification

## 6.2.1. Business Goal
The Assessment module is the diagnostic engine of Consultify. It establishes the baseline "Digital Readiness Degree" (DRD) by digitizing the consultant's interview process into structured, weighted questionnaires across 5 dimensions.

## 6.2.2. Functional Scope
*   **5 Dimensions**: Strategy, Technology, Operations, Data, Culture.
*   **Question Engine**: Support for Single Choice, Multi-Choice, and Likert Scale questions.
*   **Scoring Algorithm**: Real-time calculation of DRD (0.00 - 5.00).
*   **Visualization**: Radar Charts comparing Baseline vs Target.
*   **PDF Export**: Downloadable assessment summary.

## 6.2.3. Users & Roles
*   **Manager / Org Admin**: Can Submit answers and Finalize the assessment.
*   **User**: Can View questions and Save drafts (if assigned), but cannot Finalize (lock) the assessment without approval.

## 6.2.4. Process Flow
1.  **Select Dimension**: User chooses one of 5 dimensions to start.
2.  **Answer Questions**: User fills out the form. Progress is auto-saved locally.
3.  **Submission**: User clicks "Submit Section".
4.  **Calculation**: Backend recalculates the specific Dimension Score.
5.  **Completion**: When all 5 dimensions are submitted -> Global DRD is calculated.

## 6.2.5. UI/UX Behavior
*   **Question Card**: One question per view (wizard style) OR scrollable list (user preference).
*   **Progress Indicators**: Percentage bars for each dimension.
*   **Visual Feedback**: Radar chart updates in real-time as sections are completed.
*   **Locking**: Once finalized, inputs become Read-Only.

## 6.2.6. Business Rules
*   **Rule 1**: Global DRD cannot be calculated until ALL 5 dimensions are 100% answered.
*   **Rule 2**: Once an assessment is "Finalized", it creates a permanent versioned snapshot. Re-assessing requires starting a new "Cycle".
*   **Rule 3**: "Not Applicable" answers exclude that question from the denominator in scoring math.

## 6.2.7. Data Input / Output
*   **Input**: Form selections (Radio, Checkbox, Text comments).
*   **Output**: `AssessmentScore` object { global: 3.2, strategy: 4.1, ... }.

## 6.2.8. Edge Cases & Errors
*   **Network Loss**: Auto-save must retry on reconnection.
*   **Version Conflict**: If two users edit the same assessment simultaneously, the last write wins (Optimistic Locking advised for future).

## 6.2.9. Acceptance Criteria (DoD)
*   [ ] Verify DRD calculation formula accuracy (Sum of weights / Total possible).
*   [ ] Verify Radar Chart renders correctly with 5 axes.
*   [ ] Verify "Finalize" button is disabled if progress < 100%.
