# AI Utilization Plan: "Alive & Responsive" Application

**Last Updated:** 30 December 2025  
**Implementation Status:** 87% Complete

## Implementation Summary (v2.0)

| Feature | Status | Implementation |
|---------|--------|----------------|
| Unified AI Pipeline | ✅ COMPLETE | `aiPipeline.js` with 48 capabilities |
| Magic Wand | ✅ COMPLETE | Auto-fill fields, suggestions |
| Report Generation | ✅ COMPLETE | Premium + standard reports |
| Initiative Generation | ✅ COMPLETE | AI-driven with constraints |
| Task Advice | ✅ COMPLETE | Context-aware suggestions |
| Chat Assistant | ✅ COMPLETE | Multi-role, streaming |
| Quality Validation | ✅ COMPLETE | Hallucination detection |
| PII Protection | ✅ COMPLETE | Detection + redaction |
| Learning System | ✅ COMPLETE | Pattern extraction |
| Memory Manager | ✅ COMPLETE | 5-layer memory |
| Audit Logging | ✅ COMPLETE | Enterprise security |
| Admin UI | ⚠️ IN_PROGRESS | AuditLogViewer, PromptManagementUI |

See `docs/AI_ENTERPRISE_AUDIT_REPORT.md` for detailed PMO compliance status.

---

## Goal
Transform Consultify into a "living," responsive application where AI acts as an integrated consultant, proactively assisting in every stage of the user journey.

## AI Roles & Implementation Strategy

### 1. Filling Fields (Wypełnianie okienek)
**Concept:** "Magic Wand" or Context-Aware Auto-Complete.
**Implementation:**
*   **UI Pattern:** Add a "✨ Auto-Fill" button or icon next to large text inputs (e.g., descriptions, justifications, problem statements).
*   **Mechanism:**
    *   The frontend sends the field name, current screen context, and previous answers (from `AIContext`) to the `aiService`.
    *   **Prompt Strategy:** "Based on the user's project context [Project Name] and previous answers [A, B, C], suggest a professional draft for the field [Field Name]."
*   **Target Areas:**
    *   Assessment Justifications (in `AssessmentAxisWorkspace`).
    *   Task Descriptions.
    *   Initiative "Why" and "Description" fields.
    *   Project "Context" and "Problem Statement" in Step 1.

### 2. Creating Reports (Tworzenie raportów)
**Concept:** Executive-Grade Synthesis, not just concatenation.
**Implementation:**
*   **Enhance Premium Report Engine:**
    *   Utilize the already-connected GPT-4o.
    *   **Data Ingestion:** Feed the *entire* assessment JSON (scores + justifications) + Context Builder outputs (Goals, Strategies) into the context window.
    *   **Structured Output:** Ask AI to generate specific sections: "Executive Summary," "Key Risks," "Strategic Recommendations" in markdown format.
*   **Verification:** Ensure "Hallucination Check" logic (compare AI claims against numerical scores).

### 3. Creating Initiatives (Tworzenie inicjatyw)
**Concept:** Automated Strategic Planning Agent.
**Implementation:**
*   **Source Data:**
    *   **Assessment Scores:** Focus on axes with scores < 3 (Red/Yellow zones).
    *   **AI Generated Report:** Parse the "Strategic Recommendations" section from the Report (see Item 2).
*   **The "Formula" (Prompt Engineering):**
    *   Use a standardized "Initiative Template" in the system prompt.
    *   *Input:* "Here are the top 3 gaps identified in the [Report Name]. The company context is [Context]."
    *   *Task:* "Propose 3 specific initiatives to close these gaps. For each, provide: Title, Objectives, 3 Key Steps, Estimated Effort (S/M/L)."
*   **User Control:**
    *   User selects *which* report sections to feed into the generator.
    *   User approves/edits each generated initiative before it hits the database.

### 4. Task Advice (Porady w taskach)
**Concept:** The "Virtual PMO Coach."
**Implementation:**
*   **Contextual Sidebar:** In the Task Detail view (`TaskDetailModal.tsx`), add an "AI Coach" tab.
*   **Features:**
    *   **"Break it down":** AI suggests sub-tasks/checklist items for a high-level task.
    *   **"Unblock me":** User types a blocker, AI suggests 3 potential solutions based on best practices.
    *   **"Review my work":** User pastes their output/description, AI critiques it for clarity and completeness.
*   **Mechanism:** Pass the specific `task` object to the `AIContext` as `selectedObject` to focus the chat.

### 5. Chat - Ubiquitous Support (Wszechobecne wsparcie)
**Concept:** Context-Aware Persistent Consultant.
**Implementation:**
*   **Leverage Existing `SplitLayout` & `AIContext`:**
    *   Ensure *every* major view is wrapped in `SplitLayout` (currently some might be missing).
    *   **Dynamic Context Injection:**
        *   When user is on "Cost Analysis," the underlying prompt silently updates: "User is viewing Cost Analysis. Focus on ROI, TCO, and budget optimization."
        *   When user is on "Team," prompt updates: "Focus on resource allocation, skills, and change management."
*   **Proactive Nudges:**
    *   If user lingers on a screen for > 2 mins without action, Chat triggers a toast: "Need help analysing this data?" (Phase 2 feature, strictly opted-in).

## Model Management & Consumption Modes

To balance power, cost, and control, we categorize the AI experience into three layers: **Supply (Super Admin)**, **Access (Admin)**, and **Consumption (User)**.

### 1. Supply Layer (Super Admin)
*   **Role:** The "Wholesaler."
*   **Capabilities:**
    *   Add/Configure Providers (OpenAI, Gemini, Anthropic, Local Ollama).
    *   Set **Base Cost** (e.g., $10/1M tokens) and **Markup Multiplier** (e.g., 1.5x).
    *   Define "System Default" models for backend tasks (e.g., Reports always use GPT-4o-128k).

### 2. Access Layer (Organization Admin)
*   **Role:** The "Gatekeeper."
*   **Capabilities:**
    *   Enable/Disable specific models for their users (e.g., "My team can only use GPT-3.5 to save money").
    *   Set "MAX Mode" availability (Allow/Block high-cost features).

### 3. Consumption Layer (End User)
*   **UI Component:** `LLMSelector` (Top Bar).
*   **Features:**
    *   **⚡ MAX Mode:**
        *   *Concept:* "All-in Performance."
        *   *Logic:* Forces the "Smartest" Model (e.g., GPT-o1 or Claude 3.5 Sonnet) regardless of default.
        *   *Cost:* charges **3x tokens** (Premium accounting) but guarantees "Deep Reasoning" (Chain-of-thought enabled).
        *   *Use Case:* Complex Strategy Generation, Legal Contract Review.
    *   **📚 Use Multiple Models (Ensemble):**
        *   *Concept:* "Second Opinion."
        *   *Logic:* Sends the prompt to 2-3 models simultaneously (e.g., GPT-4 + Claude 3.5).
        *   *Output:* Displays all 3 answers side-by-side or synthesizes a "Best of" response.
    *   **✨ Auto Mode:**
        *   *Logic:* System router decides (Fast model for chats, Slow model for reports).


## AI Governance & Control Framework (The "Formula")

To ensure you have full control over the AI's behavior, topics, and data usage, we will implement a **Central AI Governance Hub** in the Super Admin panel.

### 1. System Prompt Management ("The Brain")
*   **Concept:** A library of "Personas" and "Instructions" that you can edit without code.
*   **Implementation:**
    *   **Database Table:** `ai_system_prompts` (id, key, prompt_text, version, is_active).
    *   **UI:** An editor where you define the core behavior.
    *   *Example Prompt Key:* `INITIATIVE_GENERATOR_V1`
    *   *Example Content:* "You are a Senior Lean Consultant. When generating initiatives, strictly follow the PDCA cycle. Never suggest 'buying software' as a first step; always suggest 'process mapping' first."

### 2. Context Injection Control ("The Input")
*   **Concept:** Granular checkboxes to control what data is sent to OpenAI.
*   **Implementation:**
    *   **Config Panel:** "Data Sources for Report Generation"
        *   [x] Assessment Scores (0-5)
        *   [x] User Justifications
        *   [ ] User Profile/Role (Anonymized?)
        *   [x] Previous Audit Reports
    *   **Benefit:** Allows you to experiment with "Less is More" or "Full Context" to see what yields better results.

### 3. Output Templating ("The Output")
*   **Concept:** Enforced JSON Schemas or Markdown structures.
*   **Implementation:**
    *   Define strict expected formats.
    *   *Example:* "Initiative Description must ALWAYS start with a verb (e.g., 'Optimize', 'Reduce', 'Implement')."
    *   **Validator:** A post-processing step that checks if the AI followed the format. If not, it self-corrects (auto-retry).

### 4. Evaluation & Feedback Loop
*   **Concept:** User-driven reinforcement.
*   **Implementation:**
    *   Add 👍 / 👎 buttons to every AI suggestion.
    *   **Log Table:** `ai_feedback_logs` stores the Input, Output, and Rating.
    *   **Review Dashboard:** You can see which prompts are failing and adjust the `ai_system_prompts` accordingly.

## Critical Missing Pieces (The "Expert" Additions)

You asked what might be missing. For a consultancy platform, these three elements are critical for long-term value and safety:

### A. Organizational Memory (RAG - Retrieval Augmented Generation)
*   **The Gap:** Currently, the AI only knows what is on the *current* screen. It has amnesia about past success.
*   **The Fix:**
    *   **Vector Database:** Store every successful Initiative, Risk, and Strategy from *past* closed projects (anonymized).
    *   **Benefit:** When a user asks "How do we improve Culture?", the AI says: *"Based on 5 past successful projects in Consultify, the best approach is..."*
    *   **Value:** This turns the app into a "Senior Partner" that remembers everything.

### B. Cost Control Tower ("The CFO View")
*   **The Gap:** If 50 users use "MAX Mode" constantly, your OpenAI bill will explode.
*   **The Fix:**
    *   **Quota System:** "Project X has a $50/month AI budget."
    *   **Rate Limiting:** "Max 10 GPT-o1 queries per hour per user."
    *   **Analytics:** A chart showing "Cost per Feature" (e.g., "We spent $500 generating Reports but only $10 on Initiatives").

### C. The "Data Shield" (PII Protection)
*   **The Gap:** Consultants often copy-paste emails, phone numbers, or names into text fields. Sending this to OpenAI is a GDPR/Compliance risk.
*   **The Fix:**
    *   **Middleware:** A regex-based scrubber that runs *before* the request hits OpenAI.
    *   **Action:** Replaces `john.doe@client.com` with `[EMAIL_REDACTED]` automatically.
    *   **Security:** Ensures you remain "Enterprise Ready" for banking/insurance clients.

## Execution Core: What We Need NOW to make it work
Since "Enterprise" features are already in your roadmap, here is what is missing strictly for the **Functional Execution** of your 5 tasks:

### 1. Structured Data Protocol (Zod Schemas)
*   **The Problem:** Asking AI for "Initiatives" and getting a wall of text back is useless for your database.
*   **The Solution:**
    *   We must define strict `Zod` schemas for every AI task.
    *   *Example:* `InitiativeSchema = z.object({ title: z.string(), difficulty: z.enum(['S','M','L']) })`
    *   **Implementation:** Use OpenAI's "Structured Outputs" mode to guarantee JSON that matches our schema 100%.

### 2. "Human-in-the-Loop" UI Patterns
*   **The Problem:** AI is never 100% perfect. Auto-saving to the DB is dangerous.
*   **The Solution:**
    *   **Staging Area:** A "Drafts" view where users review AI suggestions before they become real Initiatives.
    *   **Diff View:** For "Magic Wand" text edits, show a "Before vs After" comparison (Green/Red highlighting) so the user sees exactly what changed.
    *   **Accept/Reject Actions:** Simple UI controls (`✓` / `✗`) on every AI-generated card.

### 3. Context Serializer (Token Optimizer)
*   **The Problem:** Your "Project State" is huge (JSON with 50 fields, arrays, logs).
*   **The Solution:**
    *   A backend service (`ContextSerializer`) that converts your complex DB objects into a "Token-Optimized String".
    *   *Logic:* Removes IDs, timestamps, and nulls. Summarizes arrays ("5 tasks" instead of listing all 5).
    *   *Benefit:* Saves money and keeps the AI focused on the *content*, not the *metadata*.

## Technical Architecture

### Frontend (`AIContext.tsx`)
*   **State:** Expanded `screenContext` to include form data in real-time (not just route name).
*   **Triggers:** New `requestAutoFill(fieldId)`, `requestInitiatives()`, `requestTaskAdvice(taskId)` methods.

### Backend (`aiService.js`)
*   **Endpoints:**
    *   `/ai/autofill`: Specialized low-latency endpoint (using smaller model like GPT-3.5-turbo or GPT-4o-mini for speed).
    *   `/ai/initiatives`: High-reasoning endpoint (GPT-4o).
    *   `/ai/report`: Long-context endpoint (GPT-4o-128k).

## Proposed Roadmap (Prioritized)

1.  **Context-Aware Chat:** Ensure `AIContext` is perfectly engaging on all key screens. (Quick Win)
2.  **Field "Magic Wand":** High user value for "Filling Windows."
3.  **Task Advisor:** "Break down task" feature.
4.  **Initiative Generator:** Complex but high value.
5.  **Full Report Generation:** Requires most testing.

## Immediate Next Step
Select one initial focus area to implement as a "Vertical Slice" proof of concept. **Recommendation: "Field Magic Wand" or "Context-Aware Chat refinement".**
