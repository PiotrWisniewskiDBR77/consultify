# Reports Module - Precise Implementation Plan

**Created:** 2026-02-06  
**Status:** IN PROGRESS

---

## Phase 1: LLM Integration (DONE - 2026-02-06)

### What was done:

1. **`reportGenerationService.ts` - `callAI()` connected to real LLM**
   - Replaced placeholder `callAI()` with actual `llmService.call()` from `ai/llmService.ts`
   - Uses `modelConfig: { id: 'standard' }` which resolves via LLMConfigService tier system
   - Graceful fallback: if LLM unavailable/fails → uses placeholder content
   - Caching enabled (TTL 7200s) for cost optimization

2. **`assessment-reports.routes.ts` - Generate endpoint upgraded**
   - `POST /:reportId/generate` now calls LLM for each section
   - Passes assessment data (answers, axis data) as context to LLM
   - Language support (pl/en) via prompt
   - Per-section token limits based on `defaultLength` (short/medium/long)

3. **`assessment-reports.routes.ts` - AI actions connected to LLM**
   - `POST /:reportId/sections/:sectionId/ai` upgraded
   - Actions: summarize, expand, regenerate, improve, translate
   - Each action has dedicated system/user prompts
   - Custom prompt support via `customPrompt` body param
   - Falls back to stub if LLM unavailable

4. **Reject/Utilize endpoints added**
   - `POST /assessment-reports/:reportId/reject` (FINAL→DRAFT with reason)
   - `POST /assessment-reports/:reportId/send-back` (FINAL→DRAFT)
   - `POST /assessment-reports/:reportId/utilize` (APPROVED→UTILIZED with notes)
   - Same endpoints added to `/api/report-builder/` routes
   - Frontend API methods added to `api.ts`

5. **UI improvements**
   - "Report" button on assessment screen: gradient purple/indigo, prominent styling
   - "Generate Report" button in template picker: gradient when active, clear disabled state
   - Added Sparkles icon to generate button

---

## Phase 2: Interview Source Adapter

### Goal

Enable report generation from Interview data (completed interviews → professional summary reports).

### Files to create/modify:

#### Backend:

1. **`server/src/services/sourceAdapters/interviewSourceAdapter.ts`** (NEW)
   - Implement `InterviewSourceAdapter` class
   - Methods: `getAvailableSources()`, `getSourceData(interviewId)`, `transformToReportContext()`
   - Extract: interview questions, answers, notes, participant info, timestamps
   - Map interview data to unified report context format

2. **`server/src/routes/report-builder.routes.ts`** (MODIFY)
   - Implement `GET /sources/interview` → list completed interviews
   - Implement `GET /sources/interview/:id` → get interview source data
   - Connect to `InterviewSourceAdapter`

3. **`server/src/config/reportInvocationProfiles.ts`** (MODIFY)
   - Add `interview_summary` profile
   - Add `interview_detailed` profile
   - Define default block types and template for interview reports

#### Frontend:

4. **`src/components/ReportBuilder/steps/IntentStep.tsx`** (MODIFY)
   - Add Interview as source option in source selector
   - Show interview list when Interview source selected
   - Filter by status: COMPLETED interviews only

#### Database:

5. **Migration `514_interview_report_templates.sql`** (NEW)
   - Insert system templates for interview reports
   - 2 templates: Interview Summary, Interview Detailed Analysis

### Estimated effort: 1-2 days

---

## Phase 3: Tool Source Adapter

### Goal

Enable report generation from Tool sessions (digital tool evaluations).

### Files to create/modify:

#### Backend:

1. **`server/src/services/sourceAdapters/toolSourceAdapter.ts`** (NEW)
   - Implement `ToolSourceAdapter` class
   - Extract: tool evaluation scores, capabilities, gaps, recommendations
   - Map tool data to unified report context format

2. **`server/src/routes/report-builder.routes.ts`** (MODIFY)
   - Implement `GET /sources/tool` → list approved tool sessions
   - Implement `GET /sources/tool/:id` → get tool source data

3. **`server/src/config/reportInvocationProfiles.ts`** (MODIFY)
   - Add `tool_evaluation` profile
   - Add `tool_comparison` profile (compare multiple tools)

#### Frontend:

4. **`src/components/ReportBuilder/steps/IntentStep.tsx`** (MODIFY)
   - Add Tool as source option
   - Show tool sessions list when Tool source selected

#### Database:

5. **Migration `515_tool_report_templates.sql`** (NEW)
   - Insert system templates for tool reports

### Estimated effort: 1-2 days

---

## Phase 4: Comments & Review Workflow

### Goal

Full collaborative review workflow with threaded comments, section-level annotations, and approval gates.

### Current state:

- `report_builder_comments` table exists (migration 509)
- `reportBuilderCommentsService.ts` has basic CRUD
- `ReportCommentPanel.tsx` exists but may not be fully connected

### Files to create/modify:

#### Backend:

1. **`server/src/services/reportBuilderCommentsService.ts`** (VERIFY/ENHANCE)
   - Ensure thread support works (parent_comment_id)
   - Add `canApproveReport()` gate: all comments must be resolved before approval
   - Add `getUnresolvedCount(reportId)` for UI badges
   - Add inline annotation support (anchor_type: 'section' | 'inline' | 'general')

2. **`server/src/routes/report-builder.routes.ts`** (VERIFY)
   - Ensure all comment CRUD endpoints work:
     - `GET /:id/comments` (with filters: status, section, author)
     - `POST /:id/comments` (create with thread + anchor)
     - `PUT /:id/comments/:commentId` (edit)
     - `DELETE /:id/comments/:commentId`
     - `POST /:id/comments/:commentId/resolve`
   - Add approval gate check to approve endpoint

#### Frontend:

3. **`src/components/Reports/ReportCommentPanel.tsx`** (ENHANCE)
   - Thread view with reply support
   - Section-level comment anchoring (click section → add comment)
   - Comment status badges (open, resolved, AI-suggested)
   - Filter: by section, status, author

4. **`src/components/ReportBuilder/ReportBuilderWizard.tsx`** (MODIFY)
   - Add Review step between Generate and Export
   - Show comment panel in Review step
   - Block finalize if unresolved comments exist

5. **`src/components/assessment/ReportBuilderWorkspace.tsx`** (MODIFY)
   - Integrate comment panel in sidebar
   - Show unresolved comment count badge
   - Section-level comment indicators

6. **`src/components/Reports/ReportHeader.tsx`** (MODIFY)
   - Add comment count badge
   - Add "Request Review" button
   - Add review status indicator

### Estimated effort: 2-3 days

---

## Phase 5: Wizard UX Improvements

### Goal

Improve the report builder wizard for better user experience.

### Changes:

#### Step 1 - Intent/Source Selection:

1. **`src/components/ReportBuilder/steps/IntentStep.tsx`** (MODIFY)
   - Visual source type cards (Assessment icon, Interview icon, Tool icon)
   - Source preview: show key data when source selected
   - Quick preview of assessment scores/data before generating
   - Better intent configuration with presets (Board Report, Technical Report, Quick Summary)

#### Step 2 - Configure Structure:

2. **`src/components/ReportBuilder/steps/ConfigureStructureStep.tsx`** (MODIFY)
   - Drag-and-drop section reordering (visual)
   - Section preview (tooltip showing expected content type)
   - Bulk enable/disable sections
   - Section length/language presets

#### Step 3 - Generate & Edit:

3. **`src/components/ReportBuilder/steps/GenerateStep.tsx`** (MODIFY)
   - Real-time progress indicator per section
   - Animated progress bar during generation
   - Section-by-section streaming (show content as it generates)
   - Retry individual sections on failure
   - Estimated time remaining

4. **`src/components/ReportBuilder/steps/ReviewEditStep.tsx`** (MODIFY)
   - Split view: rendered preview + editor
   - Quick action buttons per section (regenerate, expand, summarize)
   - Inline AI chat for section-specific edits
   - Diff view showing AI changes

#### General:

5. **`src/components/ReportBuilder/ReportBuilderWizard.tsx`** (MODIFY)
   - Step progress indicator with labels
   - Keyboard navigation (Ctrl+Enter to proceed)
   - Auto-save draft every 30 seconds
   - "Back" button to return to previous steps
   - Responsive design for smaller screens

6. **`src/components/assessment/modals/ReportTemplatePickerModal.tsx`** (MODIFY)
   - Template preview on hover (show sections list)
   - Template comparison view (select 2+ templates)
   - Template recommendation based on assessment type/status
   - "Last used" template highlight

### Estimated effort: 3-5 days

---

## Phase 6: Additional Improvements (Future)

1. **Native DOCX export** (replace .doc with real .docx using `docx` library)
2. **Streaming generation** (show content appearing in real-time)
3. **Template marketplace** (share templates between organizations)
4. **Multi-language reports** (generate same report in multiple languages)
5. **Report scheduling** (auto-generate reports on schedule)
6. **Report analytics** (track views, downloads, shares)
7. **A/B testing** (generate 2 versions, compare)

---

## Priority Order

| Priority | Phase                      | Effort   | Impact                        |
| -------- | -------------------------- | -------- | ----------------------------- |
| 1 (DONE) | Phase 1: LLM Integration   | 1 day    | Critical - core functionality |
| 2        | Phase 5: Wizard UX         | 3-5 days | High - user experience        |
| 3        | Phase 4: Comments & Review | 2-3 days | High - collaboration          |
| 4        | Phase 2: Interview Adapter | 1-2 days | Medium - new source           |
| 5        | Phase 3: Tool Adapter      | 1-2 days | Medium - new source           |
| 6        | Phase 6: Future            | Ongoing  | Low - nice to have            |

---

## Testing Checklist

### Phase 1 (LLM Integration):

- [ ] Generate report from template → sections have real AI content (not TBD)
- [ ] AI actions (summarize, expand, regenerate, improve, translate) produce real content
- [ ] Fallback works when LLM is unavailable
- [ ] Reject endpoint returns report to DRAFT
- [ ] Utilize endpoint marks report as UTILIZED
- [ ] Button styling is prominent on assessment screen

### Phase 2 (Interview Adapter):

- [ ] Interview source appears in source selector
- [ ] Completed interviews are listed
- [ ] Report generates with interview data context
- [ ] Interview-specific templates available

### Phase 3 (Tool Adapter):

- [ ] Tool source appears in source selector
- [ ] Tool sessions are listed
- [ ] Report generates with tool data context

### Phase 4 (Comments & Review):

- [ ] Comments can be created on sections
- [ ] Thread replies work
- [ ] Comments can be resolved
- [ ] Approval blocked if unresolved comments
- [ ] Comment count badges visible

### Phase 5 (Wizard UX):

- [ ] Step progress indicator works
- [ ] Section reordering works
- [ ] Generation progress shows per-section status
- [ ] Template preview on hover works
