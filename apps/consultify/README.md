# Consultify PMO Application

The main Consultify PMO (Project Management Office) application.

## Overview

Consultify is an enterprise-grade PMO platform featuring:
- AI-powered assessments and recommendations
- Multi-framework support (ISO 21500, PMBOK 7, PRINCE2)
- Digital readiness diagnostics
- Strategic planning and transformation roadmaps
- Consulting playbook execution

## Structure

```
apps/consultify/
├── frontend/           # React frontend (migration in progress)
│   ├── src/
│   └── package.json
├── backend/            # Express backend (migration in progress)
│   ├── src/
│   └── package.json
├── project.json        # Nx project configuration
└── README.md
```

## Current Status

During the monorepo migration:
- **Backend**: Main code in `/server` (root)
- **Frontend**: Main code in `/` (root: components, views, etc.)

After migration completion, code will be moved here.

## Development

```bash
# Current (during migration)
npm run dev

# After migration (using Nx)
npx nx serve consultify
```

## Features

### Assessment Framework
- DRD (Digital Readiness Diagnostic)
- Maturity assessments
- Gap analysis with BCG-style reports

### AI Services
- 12 LLM providers orchestration
- Context-aware recommendations
- Intelligent playbook generation

### PMO Standards Compliance
- ISO 21500:2021
- PMI PMBOK 7th Edition
- PRINCE2

## Shared Dependencies

Uses `@consultify/shared` for:
- Types and interfaces
- Common utilities
- Constants and configurations






