# New Application Fork

This is a skeleton application forked from Consultinity, ready for customization.

## Getting Started

```bash
# From monorepo root
npm run serve -w apps/new-app

# Or using Nx
npx nx serve new-app
```

## Structure

```
apps/new-app/
├── frontend/           # React frontend
│   ├── src/
│   │   └── index.tsx   # Entry point
│   └── package.json
├── backend/            # Express backend
│   ├── src/
│   │   └── index.ts    # Entry point
│   └── package.json
├── project.json        # Nx project configuration
└── README.md
```

## Shared Dependencies

This app uses the shared packages from `@consultinity/*`:

- `@consultinity/shared` - Types, utils, constants
- All shared functionality is available from the monorepo

## Configuration

- Backend runs on port `3002` by default
- Frontend runs on port `3001` by default
- Configure via environment variables

## Development

1. Install dependencies: `npm install` (from root)
2. Build shared packages: `npm run build:shared`
3. Start development: `npx nx serve new-app`

## Customization Guide

1. Update branding in `frontend/src/`
2. Add custom API routes in `backend/src/`
3. Import shared utilities: `import { ... } from '@consultinity/shared'`












