# 6.6. Reporting & AI Functional Specification

## 6.6.1. Business Goal
To automate the creation of high-value, aesthetic deliverables that would normally cost $5k-$20k from a strategy firm. "The Output" that justifies the software investment to the Board.

## 6.6.2. Functional Scope
*   **Report Generation**: On-demand creation of PDF / PPTX documents.
*   **Executive Summary**: 1-pager automatic synthesis.
*   **AI Chat (Consultant)**: Interactive Q&A with the transformation context.

## 6.6.3. Users & Roles
*   **Manager / Org Admin**: Can generate and download official reports.
*   **Read-Only (Board)**: Can view generated reports.

## 6.6.4. Process Flow
1.  **Trigger**: User clicks "Generate Final Report" (or Weekly Update).
2.  **Compilation**: System aggregates:
    *   Current DRD Scores.
    *   Active Initiatives Status.
    *   Pilot Results/ROI.
    *   AI-generated narrative summary.
3.  **Rendering**: `jspdf` / `pptxgen` renders the document server-side or client-side.
4.  **Download**: File is served to user.

## 6.6.5. UI/UX Behavior
*   **Template Selector**: User chooses "Board Deck (Concise)" or "Full Audit (Detailed)".
*   **Preview**: Modal showing report structure before generation.
*   **Chat Interface**: Slide-out panel accessible globally for ad-hoc queries ("Summarize the biggest risk right now").

## 6.6.6. Business Rules
*   **Rule 1**: Generated reports are immutable snapshots stored in `Documents` table.
*   **Rule 2**: AI Chat *never* trains public models with Tenant Data (Privacy guardrail).

## 6.6.7. Data Input / Output
*   **Input**: "Generate" command, Template choice.
*   **Output**: `.pdf` / `.pptx` files.

## 6.6.8. Edge Cases & Errors
*   **Timeout**: Large report generation is handled via background Query/Worker (BullMQ) to prevent HTTP 504.
*   **Empty Data**: Report includes strict "No Data" disclaimers for empty sections rather than hiding them (Transparency).

## 6.6.9. Acceptance Criteria (DoD)
*   [ ] Verify the PDF download works for a 50+ page document.
*   [ ] Verify AI summary accurately reflects the LATEST assessment numbers.
*   [ ] Verify "Confidential" watermarks are applied to all pages.
