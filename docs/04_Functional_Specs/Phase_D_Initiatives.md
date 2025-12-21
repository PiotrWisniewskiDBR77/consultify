# 6.3. Initiatives & Roadmap Functional Specification

## 6.3.1. Business Goal
To bridge the gap between "Assessment Insights" and "Action". This module uses AI to generate specific projects (Initiatives) that address low-scoring areas, prioritizes them, and schedules them into a coherent roadmap.

## 6.3.2. Functional Scope
*   **Recommendation Engine**: AI suggests initiatives based on Assessment gaps.
*   **Prioritization Matrix**: Interactive Impact vs. Effort chart.
*   **Roadmap Gantt**: Timeline view for sequencing.
*   **Kanban Board**: Status tracking (To Do, In Progress, Done).

## 6.3.3. Users & Roles
*   **Manager**: Can Approve/Reject AI suggestions, drag-and-drop on matrix, and edit the roadmap.
*   **User**: Can view assigned initiatives and update status.

## 6.3.4. Process Flow
1.  **Generation**: User clicks "Generate Recommendations". AI analyzes DRD gaps and proposes 5-10 initiatives.
2.  **Review**: User reviews cards. Discards irrelevant ones. Edits titles/descriptions.
3.  **Prioritization**: User drags accepted initiatives onto the Impact/Effort matrix.
    *   **Quick Wins** (High Impact / Low Effort) -> Recommended for Pilot.
    *   **Big Bets** (High Impact / High Effort) -> Long term.
4.  **Scheduling**: User assigns start/end dates.
5.  **Execution**: Initiative moves to "Active" status.

## 6.3.5. UI/UX Behavior
*   **Generation Panel**: "Magic" animation while AI processes.
*   **Matrix**: 2D Grid. Dragging an item updates its `effort_score` and `impact_score` coordinates in real-time.
*   **Roadmap**: Horizontal scrollable timeline. Dependencies visualized with connecting lines.

## 6.3.6. Business Rules
*   **Rule 1**: An initiative MUST be linked to at least one Assessment Dimension (Strategy, Tech, etc.).
*   **Rule 2**: "Pilot" candidates are automatically flagged if they land in the "Quick Wins" quadrant.
*   **Rule 3**: Deleting an initiative that is already "In Progress" requires a confirmation modal and reason logging.

## 6.3.7. Data Input / Output
*   **Input**: AI Prompts, Drag-and-drop coordinates, Date pickers.
*   **Output**: `Initiative` records, Roadmap JSON.

## 6.3.8. Edge Cases & Errors
*   **AI Hallucination**: User has full ability to edit/delete nonsensical suggestions.
*   **Overcrowds Matrix**: Clustering algorithm prevents bubbles from overlapping perfectly if scores are identical.

## 6.3.9. Acceptance Criteria (DoD)
*   [ ] Verify AI only suggests initiatives for Dimensions with Score < 4.0.
*   [ ] Verify Matrix coordinates persist to database immediately on drop.
*   [ ] Verify Roadmap renders start/end dates correctly.
