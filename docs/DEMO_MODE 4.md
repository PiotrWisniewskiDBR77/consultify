# Demo Mode - Documentation

## Overview

Demo Mode allows new users to explore Consultinity with a fully populated demonstration environment. When enabled, users can see realistic sample data showing what the platform looks like when actively used for digital transformation projects.

## Features

### Demo Company: DigiTrans Consulting

A mid-size consulting firm specializing in digital transformation:
- **Industry**: Consulting & Professional Services
- **Size**: ~150 employees
- **Plan**: Enterprise

### Included Demo Data

| Module | Content |
|--------|---------|
| **Assessment** | 5 complete DRD maturity assessments across different scenarios |
| **Projects** | 5 digital transformation projects at various stages |
| **Initiatives** | 15 strategic initiatives with ROI calculations |
| **Tasks** | 25 tasks across different statuses (To Do, In Progress, Done) |
| **Team Members** | 5 team members with avatars and roles |
| **Roadmap** | 12-month transformation roadmap |
| **Notifications** | 8 sample notifications showing system activity |
| **AI Chat History** | Sample AI conversations demonstrating capabilities |

## How to Enable Demo Mode

### Option 1: Toggle in User Profile Menu
1. Click on your profile avatar in the top-right corner
2. In the dropdown, find "Demo Mode" toggle
3. Switch ON to enter demo mode
4. The purple Demo Banner will appear at the top of the screen

### Option 2: Direct URL
Navigate to `/demo` to enter demo mode directly.

### Option 3: Keyboard Shortcut
Press `Ctrl+Shift+D` (Windows/Linux) or `Cmd+Shift+D` (Mac) to toggle demo mode.

## Demo Mode Behavior

### What Users Can Do:
- ✅ Browse all modules and data
- ✅ View assessments, projects, tasks, and reports
- ✅ Interact with the AI assistant (limited)
- ✅ Explore dashboards and analytics
- ✅ Test UI interactions and workflows

### Limitations:
- ⚠️ Changes are **session-based** and reset on logout
- ⚠️ Some write operations are blocked (creating new projects, etc.)
- ⚠️ AI responses are limited to demo context
- ⚠️ Email notifications are disabled

## Demo Data Scenarios

### Assessment Scenarios

1. **Cyfrowa Transformacja Produkcji** (Digital Factory 4.0)
   - Status: APPROVED
   - Focus: Industry 4.0, IoT, Smart Manufacturing
   - Maturity: 3.5 → 5.8 target

2. **Digitalizacja Łańcucha Dostaw** (Supply Chain Digitalization)
   - Status: IN_REVIEW
   - Focus: Visibility, Tracking, Forecasting
   - Maturity: 2.7 → 4.7 target

3. **Platforma Customer Experience** (CX Platform)
   - Status: IN_REVIEW
   - Focus: Omnichannel, CRM, Personalization
   - Maturity: 3.7 → 6.0 target

4. **Centrum Operacji AI/ML** (AI Operations Center)
   - Status: DRAFT
   - Focus: MLOps, Data Science, AI Governance
   - Maturity: 2.0 → 5.4 target

5. **Cyfrowy Bliźniak Zrównoważonego Rozwoju** (Sustainability Digital Twin)
   - Status: DRAFT
   - Focus: ESG, Carbon Tracking, Circular Economy
   - Maturity: 3.4 → 5.3 target

## Technical Implementation

### Frontend Components

```
src/
├── components/
│   ├── layout/
│   │   ├── DemoBanner.tsx          # Demo mode indicator banner
│   │   ├── GlobalAccessBanners.tsx # Banner orchestration
│   │   └── UserProfileMenu.tsx     # Demo toggle location
│   └── demo/
│       ├── DemoWelcomeTour.tsx     # Onboarding tour
│       ├── DemoUpgradePrompt.tsx   # Upgrade CTA
│       ├── DemoLoadingOverlay.tsx  # Loading state
│       └── SmartDemoBanner.tsx     # Intelligent banner
├── store/
│   └── slices/
│       └── authSlice.ts            # SessionMode.DEMO state
└── types/
    └── core.ts                     # SessionMode enum
```

### State Management

```typescript
// Session mode stored in Zustand
enum SessionMode {
    FREE = 'FREE',
    FULL = 'FULL',
    DEMO = 'DEMO'
}

// Toggle demo mode
const { sessionMode, setSessionMode } = useAppStore();
setSessionMode(SessionMode.DEMO);
```

### Backend

```
server/
├── seed/
│   └── seed_digitrans_demo.js     # Demo data seeder
├── services/
│   └── accessPolicyService.ts     # Demo mode access control
└── middleware/
    └── demoGuard.middleware.ts    # Route protection
```

### Database

Demo data is stored in the main database but isolated by organization:
- `organization_type = 'DEMO'`
- Demo org ID: `org-digitrans-demo`

## Seeding Demo Data

### Initial Setup
```bash
# Seed the DigiTrans Consulting demo data
node server/seed/seed_digitrans_demo.js
```

### Reset Demo Data
```bash
# Reset demo data to original state
node server/seed/seed_digitrans_demo.js --reset
```

## Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | demo@digitrans.consulting | Demo123! |
| User | anna.kowalska@digitrans.consulting | team123 |
| User | piotr.nowak@digitrans.consulting | team123 |

## Configuration

### Environment Variables

```env
# Enable demo mode features
DEMO_MODE_ENABLED=true

# Demo session duration (hours)
DEMO_SESSION_DURATION=24

# Allow demo data modifications
DEMO_ALLOW_WRITES=false
```

## Maintenance

### Monitoring Demo Usage
- Demo sessions are tracked in `activity_logs`
- Metrics available in SuperAdmin → Analytics

### Data Cleanup
Demo sessions are automatically cleaned up after 24 hours via cron job:
- `server/src/cron/TrialCron.ts` handles cleanup

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-01-08 | 1.0.0 | Initial demo mode implementation |
| | | - Added DigiTrans Consulting demo company |
| | | - Demo toggle in UserProfileMenu |
| | | - Session-based data persistence |
