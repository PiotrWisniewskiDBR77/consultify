# Manual Test Script: Decisions Tab in Initiative

## Test Setup

**URL:** http://localhost:3000/
**Test Initiative:** "Automated Changeover Optimization"
**Module:** Assessment → Initiatives

## Test Steps

### Step 1: Navigate to Initiative

1. Open http://localhost:3000/
2. If login required, use dev/demo credentials (check for obvious credentials on screen)
3. Navigate to **Assessment** module
4. Find and open initiative: **"Automated Changeover Optimization"**
5. Go to **Decisions** tab in the left navigation

**Expected:** Initiative document view loads with Decisions section visible

---

### Step 2: Verify "Add Decision" Modal ✅

**Action:** Click the "Add decision" button (or "Dodaj decyzję" in Polish)

**Expected Modal Title:**

- EN: "New decision"
- PL: "Nowa decyzja"

**Expected Fields:**

- ✅ **Title** (Tytuł) - text input
- ✅ **Context / notes** (Kontekst / notatki) - textarea (3 rows)
- ✅ **Type** (Typ) - dropdown with options:
  - Go/No-Go
  - Resources Commit
  - Schedule Lock
  - Budget Approval
  - Scope Change
  - Risk Acceptance
  - Resource Allocation
  - Strategic
  - Execution
  - General
  - Other
- ✅ **Priority** (Priorytet) - dropdown:
  - Low (Niski)
  - Medium (Średni) - default
  - High (Wysoki)
  - Critical (Krytyczny)
- ✅ **Owner** - dropdown (users list + "— None —")

**Expected Buttons:**

- ✅ **Cancel** (Anuluj) button
- ✅ **Create decision** (Utwórz decyzję) button

**Validation:**

- Create button should be disabled if Title is empty
- Title input should be auto-focused when modal opens

---

### Step 3: Create a Decision ✅

**Action:** Fill out and create a test decision

**Test Data:**

- **Title:** `Test Decision ${Date.now()}` (use timestamp for uniqueness)
- **Context:** "This is a test decision for verification"
- **Type:** General
- **Priority:** High
- **Owner:** (select any user or leave as None)

**Actions:**

1. Fill in the title with unique name
2. Add some context text
3. Select Type = General
4. Select Priority = High
5. Click **Create decision**

**Expected Results:**

- ✅ Modal closes
- ✅ Toast notification: "Decision created" / "Decyzja utworzona"
- ✅ New decision appears in the Decisions table
- ✅ Decision row shows:
  - Title (clickable)
  - Type: General (Ogólna)
  - Status: Pending (Oczekująca) with amber badge
  - Owner name or "—"
  - Due date: "—"
  - Priority: High (Wysoki) in orange text
  - Row actions menu (⋮ icon)

---

### Step 4: Verify Row Actions Menu ✅

**Action:** Click the three-dot menu (⋮) on the newly created decision row

**Expected Menu Items:**

- ✅ **"Open decision"** (Otwórz decyzję) - with ExternalLink icon
- ✅ **"Duplicate"** (Duplikuj) - with Edit3 icon
- ✅ _(separator line)_
- ✅ **"Delete"** (Usuń) - with Trash2 icon, in red color

**Code Reference:** Lines 663-699 in `DecisionsSection.tsx`

---

### Step 5: Open Decision as Dynamic Tab ⚠️ CRITICAL TEST

**Action:** From the row menu, click **"Open decision"**

**Expected Behavior:**

- ✅ Decision should open as a **NEW DYNAMIC TAB** within the Assessment module
- ✅ Tab should appear in the top tab bar next to the initiative tab
- ✅ Should display `DecisionDetailView` component
- ❌ Should **NOT** redirect to MyWork module

**How to Verify:**

1. Check URL - it should stay in `/initiatives` or similar Assessment route
2. Check top navigation - Assessment module should remain active
3. Check tab bar - should see new tab with decision title
4. Should see DecisionDetailView with:
   - Decision header with title
   - Status badge
   - Priority indicator
   - Context/description field
   - Type and owner information
   - Comments section (if implemented)
   - Activity log
   - Attachments section

**❗ IMPORTANT:** This is the key test. The code in `InitiativeDocumentView.tsx` (line 2834-2850) shows there's an `onOpenDecision` callback prop that should handle opening decisions within the current module context.

**Code Flow:**

```typescript
// In InitiativeDocumentView.tsx
const handleOpenDecisionArtifact = useCallback(
  (decisionId: string) => {
    if (onOpenDecision) {
      onOpenDecision(decisionId); // This should open in current module
      return;
    }
    // Fallback: opens in MyWork (we want to avoid this)
    setMyWorkIntent({
      tab: 'decisions',
      open: { type: 'decision', id: decisionId, name: isPolish ? 'Decyzja' : 'Decision' },
    });
    setCurrentView(AppView.MY_WORK);
  },
  [onOpenDecision, setMyWorkIntent, setCurrentView, isPolish]
);
```

**Potential Issue:** If `onOpenDecision` prop is not passed from `InitiativesHub`, it will fallback to opening in MyWork!

---

### Step 6: Duplicate Decision ✅

**Action:**

1. If you opened a decision tab, go back to the initiative Decisions list
2. Find your test decision in the table
3. Click its row menu (⋮)
4. Click **"Duplicate"**

**Expected Results:**

- ✅ Toast notification: "Decision duplicated" / "Decyzja zduplikowana"
- ✅ A new decision appears in the list with:
  - Same title + **" (copy)"** suffix (or **" (kopia)"** in Polish)
  - Same description
  - Same type
  - Same priority
  - Status: PENDING (reset)
  - No owner (reset)
  - No due date

**Code Reference:** Lines 459-515 in `DecisionsSection.tsx`

---

### Step 7: Delete Duplicated Decision ✅

**Action:**

1. Find the duplicated decision (the one with "(copy)" suffix)
2. Click its row menu (⋮)
3. Click **"Delete"** (red option at bottom)

**Expected Results:**

- ✅ Decision row disappears from the table immediately
- ✅ Toast notification (if implemented): "Decision deleted" / "Decyzja usunięta"
- ✅ Original test decision should still be visible

**Code Reference:** Lines 517-524 in `DecisionsSection.tsx`

---

## Console Error Monitoring

**Open Browser DevTools (F12) → Console tab**

### Expected Console Behavior:

- ✅ No errors during modal open/close
- ✅ No errors during decision creation
- ✅ No errors during duplication
- ✅ No errors during deletion

### Known Warning/Info Messages (OK):

- React hot-reload messages
- Translation warnings
- Development mode warnings

### Red Flags (Report These):

- ❌ API errors (401, 403, 404, 500)
- ❌ React component errors
- ❌ "Cannot read property of undefined"
- ❌ CORS errors
- ❌ Network request failures

---

## Test Results Template

```
## Decision Tab Test Results

**Date:** [YYYY-MM-DD]
**Tester:** [Your Name]
**Browser:** [Chrome/Firefox/Safari + version]
**Language:** [EN/PL]

### Step 1: Modal Fields & UI
- [ ] PASS / FAIL / PARTIAL
- Notes:

### Step 2: Create Decision
- [ ] PASS / FAIL / PARTIAL
- Notes:

### Step 3: Row Actions Menu
- [ ] PASS / FAIL / PARTIAL
- Notes:

### Step 4: Open Decision (Dynamic Tab) ⚠️
- [ ] PASS / FAIL / PARTIAL
- Navigation: (stayed in Assessment / redirected to MyWork)
- Notes:

### Step 5: Duplicate Decision
- [ ] PASS / FAIL / PARTIAL
- Notes:

### Step 6: Delete Decision
- [ ] PASS / FAIL / PARTIAL
- Notes:

### Console Errors
- [ ] No errors
- [ ] Errors found (list below)

Errors:
```

[paste console errors here]

```

### Screenshots
[Attach screenshots of any failures or unexpected behavior]
```

---

## Quick Checklist

- [ ] Modal opens with all required fields
- [ ] Decision created successfully
- [ ] Decision appears in table with correct data
- [ ] Row menu shows 3 options (Open/Duplicate/Delete)
- [ ] **Open decision stays in Assessment module (NOT MyWork)**
- [ ] Duplicate creates copy with "(copy)" suffix
- [ ] Delete removes decision from list
- [ ] No console errors during any operation

---

## Known Issues to Watch For

### Issue #1: Decision Opens in MyWork Instead of Assessment

**Symptom:** Clicking "Open decision" switches to MyWork module
**Root Cause:** `onOpenDecision` callback not wired in InitiativesHub
**Fix Needed:** Implement dynamic tab opening in InitiativesHub
**Workaround:** None - this is the main test objective

### Issue #2: Duplicate Suffix Not Localized

**Symptom:** Always shows "(copy)" even in Polish mode
**Check:** Should show "(kopia)" when language is Polish
**Code Location:** Line 468 in DecisionsSection.tsx

### Issue #3: Delete Confirmation

**Symptom:** Decision deleted without confirmation
**Expected:** May want confirmation dialog for safety
**Current:** Direct delete (by design, see code)

---

## API Endpoints Used

```
POST   /decisions        - Create new decision
POST   /decisions        - Duplicate decision (same endpoint)
DELETE /decisions/:id    - Delete decision
GET    /decisions?relatedObjectId={initiativeId}&relatedObjectType=initiative
```

Check Network tab in DevTools to verify API calls succeed.
