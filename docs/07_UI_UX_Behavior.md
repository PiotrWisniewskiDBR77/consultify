# 7. UI / UX Behavior Specification

## 7.1. General UX Philosophy
Consultify prioritizes **Cognitive Clarity** over "flashy" design. The interface must guide the user through complex strategic thinking without overwhelming them.

### Key Principles
1.  **Task Focus**: Each screen lists one primary action (e.g., "Rate Strategy" or "Prioritize Initiative").
2.  **Context Preservation**: User always knows "Where am I in the transformation process?" via breadcrumbs and progress indicators.
3.  **Feedback Loops**: Every save/update triggers a Toast notification. Long processes show skeletons/spinners.

## 7.2. Global Patterns

### Validation
-   **Inline**: Fields validate `onBlur`. Error messages appear below the input in red text.
-   **Blocking**: "Submit" buttons are disabled until the form is valid (Visual cue: Opacity 50% + Not Allowed cursor).

### Empty States
Never show a blank white screen.
-   **Pattern**: [Illustration] + [Help Text] + [Primary Action Button].
-   *Example*: "No Initiatives yet. Click 'Generate' to let AI suggest some."

### Error Handling
-   **Network Error**: Global toaster "Connection lost. Retrying...".
-   **404**: Custom "Resource not found" page with a "Back to Dashboard" button.
-   **403**: "Access Denied" page explaining required permissions.

### Responsiveness
-   **Desktop (>1024px)**: Full dashboard, multi-column layouts.
-   **Tablet (768px - 1024px)**: Sidebar collapses to icon menu. Assessment grids stack to vertical lists.
-   **Mobile (<768px)**: Read-optimized. Complex drag-and-drop matrices (Initiatives) are replaced by "List View" with dropdown editing.

## 7.3. Interaction Specifics

### Modals
-   Use for: Quick decisions (Confirmations), Single-field inputs.
-   Close on: Esc key, Click outside, "Cancel" button.

### Tables
-   Must include Pagination (if > 10 rows).
-   Must include Sortable Headers.
-   Must include Search/Filter bar.

### Loading States
-   **Initial Load**: Full page skeleton.
-   **Data Refresh**: Component-level spinner or opacity reduction.
-   **AI Streaming**: "Typewriter" effect for incoming text chunks.
