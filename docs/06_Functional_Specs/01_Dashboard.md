# 6.1. Dashboard Functional Specification

## 6.1.1. Business Goal
The Dashboard serves as the central command center for the digital transformation. Its goal is to provide immediate, actionable visibility into the project's status, guiding the user through the 5-step Consultify process and highlighting critical risks via AI.

## 6.1.2. Functional Scope
*   **Onboarding Mode**: Step-by-step guidance for new tenants (Before "Expectations" are set).
*   **Live Mode**: Real-time project tracking (After "Expectations").
*   **Progress Visualization**: Global progress bar weighted by module completion.
*   **AI Insights Panel**: Dynamic cards showing risks, summaries, and recommendations.
*   **KPI Snapshot**: High-level view of 4 key operational metrics.

## 6.1.3. Users & Roles
*   **Super Admin**: Viewing platform-wide usage stats (System Dashboard).
*   **Org Admin / Manager**: Viewing transformation progress and financial impact.
*   **User**: Viewing assigned tasks and relevant module status.

## 6.1.4. Process Flow
1.  **User Log In**: System checks `AccountStatus` and `TransformationStage`.
2.  **State Evaluation**:
    *   If `Stage == 0`: Render "Onboarding Dashboard".
    *   If `Stage > 0`: Render "Live Dashboard".
3.  **Data Fetching**: Parallel fetch of `AssessmentScore`, `InitiativeStatus`, and `LatestAIAlerts`.
4.  **Interaction**: User clicks a module card (e.g., "Assessment") to navigate to that specific workflow.

## 6.1.5. UI/UX Behavior
*   **Onboarding State**: Clean UI with a "Start Transformation" call-to-action. Progress bar is gray/inactive.
*   **Live State**: Grid layout.
    *   **Top Row**: Overall Progress (Circular/Linear chart), Current Phase Label.
    *   **Middle Row**: Module Status Cards (Green check / Yellow warning / Red error).
    *   **Bottom Row**: AI Insights (Text stream or Cards).
*   **Loading**: Skeleton screens for charts.
*   **Empty State**: "No data yet" placeholders for KPI section if assessment not started.

## 6.1.6. Business Rules
*   **Rule 1**: The "Live Dashboard" unlocks ONLY after Module 1 (Expectations) is marked complete.
*   **Rule 2**: AI Alerts must be regenerated daily (cached for 24h) to avoid API token waste.
*   **Rule 3**: KPI Snapshot shows "N/A" until the Baseline Assessment is 100% complete.

## 6.1.7. Data Input / Output
*   **Input**: User clicks (Navigation).
*   **Output**: Aggregated read-only data (Scores, Counts, Statuses).

## 6.1.8. Edge Cases & Errors
*   **API Failure**: If AI service is down, the "AI Insights" panel collapses with a "Insights currently unavailable" toast, preserving the rest of the dashboard.
*   **New Module Added**: Dashboard must dynamically render new modules if enabled via Feature Flags.

## 6.1.9. Acceptance Criteria (DoD)
*   [ ] Verify Onboarding View allows navigation ONLY to Module 1.
*   [ ] Verify Live View shows correct % progress based on weighted formula.
*   [ ] Verify clicking an AI Alert deep-links to the relevant Initiative/Risk.
