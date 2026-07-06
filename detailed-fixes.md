# Vegas Hairline Regression Audit — Detailed Findings

## CRITICAL FIXES (Priority 1)

### 1. FilterableTable.tsx — CRITICAL REGRESSION
**File:** `src/components/shared/ModuleHub/FilterableTable.tsx`

#### Line 420: Wrapper border
```
CURRENT:  border border-slate-200/70 dark:border-white/[0.06]
FIX TO:   border border-c-border-subtle
```
Impact: Affects all tables using FilterableTable (Results, Execution modules)

#### Line 523: Row dividers  
```
CURRENT:  divide-y divide-slate-200/60 dark:divide-c-border-subtle
FIX TO:   divide-y divide-c-border-subtle
```
Impact: CRITICAL — this is the main hairline regression affecting row separators

#### Line 161,179: Filter popup borders
```
CURRENT:  border border-slate-200/70 dark:border-white/[0.08]
          border-t border-slate-200/70
FIX TO:   border border-c-border-subtle
          border-t border-c-border-subtle
```

#### Line 530: Empty state border
```
CURRENT:  border border-slate-200/70 dark:border-white/[0.08]
FIX TO:   border border-c-border-subtle
```

---

## HIGH PRIORITY FIXES (Priority 2)

### 2. CandidatesPanel.tsx — HEAVY BORDERS
**File:** `src/components/Initiatives/CandidatesPanel.tsx`

#### Line 226: Button border
```
CURRENT:  border border-slate-200 dark:border-slate-700
FIX TO:   border border-c-border-subtle
```

#### Line 262: Card border
```
CURRENT:  border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900
FIX TO:   border border-c-border-subtle
```

#### Line 295: Button border (secondary)
```
CURRENT:  border border-slate-200 dark:border-slate-700
FIX TO:   border border-c-border-subtle
```

---

### 3. InitiativeObservabilityPanel.tsx — HEAVY BORDERS
**File:** `src/components/Initiatives/InitiativeObservabilityPanel.tsx`

#### Line 118: Section card border
```
CURRENT:  border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900
FIX TO:   border border-c-border-subtle
```

#### Line 148: Divider border (left)
```
CURRENT:  border-l border-slate-200 pl-4 dark:border-slate-700
FIX TO:   border-l border-c-border-subtle
```

#### Line 194: Section card border (secondary)
```
CURRENT:  border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900
FIX TO:   border border-c-border-subtle
```

#### Line 204,224,245,255: Button/input borders
```
CURRENT:  border border-slate-200 dark:border-slate-700
FIX TO:   border border-c-border-subtle
```

---

## VERIFICATION CHECKLIST

### After fixes, verify:

#### FilterableTable fixes (line 420, 523, 161, 179, 530):
- [ ] Results > KPI table rows have hairline separators
- [ ] Execution > Initiatives table rows have hairline separators
- [ ] Filter popup has hairline border
- [ ] Empty state has hairline border

#### CandidatesPanel fixes (line 226, 262, 295):
- [ ] Card borders are subtle (hairline)
- [ ] Buttons use hairline borders
- [ ] Hover states work correctly

#### InitiativeObservabilityPanel fixes (line 118, 148, 194, 204, 224, 245, 255):
- [ ] Section cards have hairline borders
- [ ] Dividers are subtle
- [ ] All buttons/inputs align to theme

---

## PATTERN ANALYSIS

### Root cause
Light mode using Tailwind slate-200 (opacity 0.22) instead of CSS variable --c-border-subtle (opacity 0.12).
Dark mode correctly uses c-border-subtle or white/[0.08].

### Regression scope
- **FilterableTable:** Base component for 3+ modules (Results, Execution, shared)
- **Initiatives panels:** Detail panels in Portfolio > Initiative
- **No impact:** MyWork, Assessment, Interview modules (use other patterns)

### Vegas standard (post-fix)
All table borders, dividers, card borders should use:
- Light mode: `border-c-border-subtle` (CSS var, opacity 0.12)
- Dark mode: automatic from CSS var
- NO slate-200, NO slate-700, NO custom /60 /70 opacities

---

## COMMIT MESSAGE TEMPLATE

```
fix(vegas): hairline borders on table rows & cards (Initiatives/Execution/Results)

Regression: FilterableTable + detail panels using heavy borders (slate-200/70)
instead of canonical hairline (border-c-border-subtle).

Fixes:
- FilterableTable: row dividers + wrapper border + filter popup
- CandidatesPanel: card + button borders
- InitiativeObservabilityPanel: section cards + dividers

All borders now use --c-border-subtle (0.12 opacity) per Vegas spec §27.

Fixes OBS-5, OBS-1
```

