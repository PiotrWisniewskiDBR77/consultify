# InitiativeDetailModal Refactoring Guide

## Current State
- **File**: `src/components/InitiativeDetailModal.tsx`
- **Size**: 2,819 lines (exceeds recommended 300-500 lines)
- **Problem**: Monolithic component with 9 tabs embedded inline

## Recommended Structure

```
src/components/InitiativeDetail/
├── index.ts                    # Re-exports
├── InitiativeDetailModal.tsx   # Main orchestrator (~200 lines)
├── tabs/
│   ├── index.ts
│   ├── OverviewTab.tsx         # Lines 511-1034
│   ├── DefinitionTab.tsx       # Lines 1037-1504
│   ├── ExecutionTab.tsx        # Lines 1505-1806
│   ├── EconomicsTab.tsx        # Lines 1807-1972
│   ├── GovernanceTab.tsx       # Lines 1973-2265
│   ├── TeamTab.tsx             # Lines 2266-2605
│   ├── HistoryTab.tsx          # Lines 2606-2776
│   └── IntelligenceTab.tsx     # Already extracted
├── components/
│   ├── InitiativeHeader.tsx
│   ├── TabNavigation.tsx
│   ├── ReadinessIndicator.tsx
│   └── StrategicFitPanel.tsx
├── hooks/
│   ├── useInitiativeForm.ts    # Form state management
│   ├── useReadinessScore.ts    # Readiness calculation
│   └── useStrategicFit.ts      # AI strategic fit check
└── types.ts                    # Local types for this module
```

## Migration Steps

1. **Create shared types**: Extract `InitiativeDetailModalProps` and tab types
2. **Extract tabs one by one**: Start with smallest (IntelligenceTab) and work up
3. **Create custom hooks**: Move state logic to hooks
4. **Update imports**: Ensure all imports use the new structure
5. **Test incrementally**: Test after each tab extraction

## Priority Order
1. IntelligenceTab (already exists as separate component)
2. HistoryTab (~170 lines - simplest)
3. TeamTab (~340 lines)
4. GovernanceTab (~290 lines)
5. EconomicsTab (~165 lines)
6. ExecutionTab (~300 lines)
7. DefinitionTab (~467 lines)
8. OverviewTab (~523 lines - most complex)




