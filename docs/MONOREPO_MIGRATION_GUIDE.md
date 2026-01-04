# Consultify Monorepo Migration Guide

**Document Version:** 1.0.0  
**Last Updated:** January 4, 2026  
**Purpose:** Technical guide for migrating Consultify to an Nx monorepo structure

---

## Executive Summary

This guide provides a step-by-step approach to restructure Consultify into a monorepo using **Nx** (recommended) or Lerna, enabling:
- Code sharing between Consultify and future application forks
- Independent deployment of shared packages
- Improved build caching and dependency management
- Clear separation of concerns

---

## 1. Tool Selection: Nx vs Lerna

### Recommendation: **Nx**

| Feature | Nx | Lerna |
|---------|-----|-------|
| Build Caching | ✅ Excellent (distributed) | ⚠️ Basic |
| Dependency Graph | ✅ Visual + Automated | ❌ Manual |
| TypeScript Support | ✅ First-class | ⚠️ Limited |
| Plugin Ecosystem | ✅ Rich (React, Node, etc.) | ❌ None |
| CI/CD Integration | ✅ Nx Cloud | ⚠️ Manual |
| Learning Curve | Medium | Low |
| Community | Active | Declining |

**Decision:** Use **Nx** for superior build performance and TypeScript tooling.

---

## 2. Target Structure

```
consultify/
├── package.json                    # Workspace root
├── nx.json                         # Nx configuration
├── tsconfig.base.json              # Shared TypeScript config
├── .github/
│   └── workflows/
│       ├── ci.yml                  # Shared CI
│       └── deploy-*.yml            # Per-app deployments
│
├── packages/                       # Shared libraries
│   ├── shared-types/               # @consultify/types
│   │   ├── src/
│   │   │   ├── api/
│   │   │   ├── domain/
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared-core/                # @consultify/core
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── database/
│   │   │   ├── middleware/
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared-ai/                  # @consultify/ai
│   │   ├── src/
│   │   │   ├── llm/
│   │   │   ├── embeddings/
│   │   │   ├── rag/
│   │   │   └── monitoring/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared-billing/             # @consultify/billing
│   │   ├── src/
│   │   │   ├── stripe/
│   │   │   ├── invoices/
│   │   │   └── subscriptions/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── shared-ui/                  # @consultify/ui
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   └── styles/
│       ├── package.json
│       └── tsconfig.json
│
└── apps/                           # Applications
    ├── consultify/                 # Main PMO application
    │   ├── frontend/
    │   │   ├── src/
    │   │   ├── package.json
    │   │   └── vite.config.ts
    │   └── backend/
    │       ├── src/
    │       ├── package.json
    │       └── tsconfig.json
    │
    └── new-app/                    # Future fork application
        ├── frontend/
        └── backend/
```

---

## 3. Migration Steps

### Phase 1: Nx Initialization (Day 1)

#### 1.1 Install Nx

```bash
# In existing project root
npx create-nx-workspace@latest consultify-workspace --preset=empty

# Or migrate existing project
npx nx@latest init
```

#### 1.2 Create Root Configuration

**nx.json:**
```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "cache": true
    },
    "test": {
      "inputs": ["default", "^production"],
      "cache": true
    },
    "lint": {
      "inputs": ["default"],
      "cache": true
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.test.ts",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/test/**/*"
    ],
    "sharedGlobals": []
  },
  "plugins": [
    "@nx/vite/plugin",
    "@nx/node/plugin"
  ]
}
```

**tsconfig.base.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@consultify/types": ["packages/shared-types/src/index.ts"],
      "@consultify/core": ["packages/shared-core/src/index.ts"],
      "@consultify/ai": ["packages/shared-ai/src/index.ts"],
      "@consultify/billing": ["packages/shared-billing/src/index.ts"],
      "@consultify/ui": ["packages/shared-ui/src/index.ts"]
    }
  },
  "exclude": ["node_modules", "dist"]
}
```

### Phase 2: Package Extraction (Week 1-2)

#### 2.1 Create shared-types Package

```bash
# Create package structure
mkdir -p packages/shared-types/src/{api,domain,ui}
```

**packages/shared-types/package.json:**
```json
{
  "name": "@consultify/types",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "eslint src/",
    "test": "vitest run"
  },
  "devDependencies": {
    "typescript": "^5.8.0"
  }
}
```

**packages/shared-types/tsconfig.json:**
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "references": []
}
```

#### 2.2 Extract Types from Current Codebase

```bash
# Copy existing types
cp -r types/* packages/shared-types/src/domain/
cp -r schemas/* packages/shared-types/src/schemas/

# Copy server types
cp server/src/types/* packages/shared-types/src/backend/
```

#### 2.3 Create shared-core Package

**packages/shared-core/package.json:**
```json
{
  "name": "@consultify/core",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./database": {
      "import": "./dist/database/index.js",
      "types": "./dist/database/index.d.ts"
    },
    "./auth": {
      "import": "./dist/auth/index.js",
      "types": "./dist/auth/index.d.ts"
    },
    "./utils": {
      "import": "./dist/utils/index.js",
      "types": "./dist/utils/index.d.ts"
    }
  },
  "dependencies": {
    "@consultify/types": "workspace:*",
    "pg": "^8.16.0",
    "better-sqlite3": "^11.9.0",
    "jsonwebtoken": "^9.0.0",
    "bcryptjs": "^2.4.3"
  },
  "devDependencies": {
    "typescript": "^5.8.0",
    "@types/node": "^22.0.0"
  }
}
```

### Phase 3: Application Structure (Week 3)

#### 3.1 Create Consultify App

```bash
mkdir -p apps/consultify/{frontend,backend}/src
```

**apps/consultify/backend/package.json:**
```json
{
  "name": "@consultify/app-backend",
  "version": "0.0.1",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@consultify/core": "workspace:*",
    "@consultify/types": "workspace:*",
    "@consultify/ai": "workspace:*",
    "@consultify/billing": "workspace:*",
    "express": "^5.0.0"
  }
}
```

### Phase 4: Import Updates (Week 4)

#### 4.1 Update Imports in Existing Code

**Before:**
```typescript
import { User } from '../../../types/domain/user';
import { getDatabase } from '../database/Database';
```

**After:**
```typescript
import { User } from '@consultify/types';
import { getDatabase } from '@consultify/core/database';
```

#### 4.2 Create Import Migration Script

```typescript
// scripts/migrate-imports.ts
import { Project, SourceFile } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json'
});

const importMappings = {
  '../../../types/domain/': '@consultify/types/',
  '../../types/': '@consultify/types/',
  '../database/': '@consultify/core/database/',
  '../../database/': '@consultify/core/database/',
  '../utils/Logger': '@consultify/core/utils',
};

function migrateFile(file: SourceFile) {
  file.getImportDeclarations().forEach(decl => {
    const moduleSpecifier = decl.getModuleSpecifierValue();
    
    for (const [oldPath, newPath] of Object.entries(importMappings)) {
      if (moduleSpecifier.startsWith(oldPath)) {
        decl.setModuleSpecifier(
          moduleSpecifier.replace(oldPath, newPath)
        );
      }
    }
  });
}

project.getSourceFiles().forEach(migrateFile);
project.save();
```

---

## 4. Nx Commands Reference

### Development

```bash
# Run all apps
nx run-many -t serve

# Run specific app
nx serve consultify-backend

# Run affected apps only
nx affected -t serve
```

### Building

```bash
# Build all
nx run-many -t build

# Build specific package
nx build @consultify/types

# Build affected only
nx affected -t build
```

### Testing

```bash
# Test all
nx run-many -t test

# Test specific package
nx test @consultify/core

# Test affected
nx affected -t test
```

### Dependency Graph

```bash
# View dependency graph (opens browser)
nx graph

# Generate graph JSON
nx graph --file=graph.json
```

---

## 5. CI/CD Configuration

### GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

jobs:
  main:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: 'npm'
      
      - run: npm ci
      
      # Set up Nx Cloud connection
      - run: npx nx-cloud start-ci-run --distribute-on="3 linux-medium-js"
      
      # Run affected targets
      - run: npx nx affected -t lint test build --configuration=ci
      
      # E2E tests
      - run: npx nx affected -t e2e --configuration=ci
```

### Nx Cloud Setup

```bash
# Connect to Nx Cloud for distributed caching
npx nx connect
```

---

## 6. Package Publishing Strategy

### npm Organization Setup

```bash
# Create @consultify organization on npm
npm login
npm org create consultify
```

### Versioning Strategy

Use Nx release for coordinated versioning:

```bash
# Version all packages
npx nx release version patch

# Generate changelog
npx nx release changelog

# Publish to npm
npx nx release publish
```

**nx.json (release config):**
```json
{
  "release": {
    "projects": ["packages/*"],
    "version": {
      "preVersionCommand": "npm run build",
      "conventionalCommits": true
    },
    "changelog": {
      "projectChangelogs": true
    }
  }
}
```

---

## 7. Database Considerations

### Shared Schema Strategy

1. **Option A: Shared migrations package**
   - All migrations in `packages/shared-core/migrations/`
   - Apps run migrations on startup

2. **Option B: App-specific migrations**
   - Shared tables in `shared-core`
   - App-specific tables in app packages
   - **Recommended for fork scenario**

### Multi-Tenant Setup

```typescript
// packages/shared-core/src/database/tenant.ts
export interface TenantConfig {
  schemaName: string;
  connectionString?: string;
}

export function getTenantDb(config: TenantConfig): IDatabase {
  // Return tenant-specific database connection
}
```

---

## 8. Migration Checklist

### Pre-Migration
- [ ] Document all circular dependencies
- [ ] Identify external package usage
- [ ] Backup current codebase
- [ ] Set up staging environment

### Phase 1: Setup
- [ ] Install Nx
- [ ] Create workspace configuration
- [ ] Set up TypeScript path aliases
- [ ] Configure ESLint

### Phase 2: Packages
- [ ] Extract shared-types
- [ ] Extract shared-core
- [ ] Extract shared-ai
- [ ] Extract shared-billing
- [ ] Extract shared-ui

### Phase 3: Apps
- [ ] Create consultify app structure
- [ ] Move PMO-specific code
- [ ] Update all imports
- [ ] Run tests

### Phase 4: CI/CD
- [ ] Update GitHub Actions
- [ ] Set up Nx Cloud
- [ ] Configure deployment pipelines
- [ ] Set up npm publishing

### Post-Migration
- [ ] Update documentation
- [ ] Train team on Nx commands
- [ ] Set up monitoring
- [ ] Create developer onboarding guide

---

## 9. Risk Mitigation

### Circular Dependencies
```bash
# Detect circular dependencies
nx graph --groupByFolder

# Generate cycle report
npx madge --circular --extensions ts src/
```

### Build Performance
- Enable Nx Cloud for distributed caching
- Use `affected` commands for incremental builds
- Configure proper `inputs` for caching

### Team Onboarding
- Create Nx cheatsheet
- Document package responsibilities
- Set up PR templates with Nx commands

---

## 10. Timeline Estimate

| Phase | Duration | Tasks |
|-------|----------|-------|
| Phase 1: Setup | 2-3 days | Nx init, configs |
| Phase 2: Types | 2-3 days | Extract shared-types |
| Phase 3: Core | 3-5 days | Extract shared-core |
| Phase 4: AI | 3-5 days | Extract shared-ai |
| Phase 5: Billing | 2-3 days | Extract shared-billing |
| Phase 6: Apps | 5-7 days | App restructure |
| Phase 7: CI/CD | 2-3 days | Pipeline updates |
| Phase 8: Testing | 3-5 days | Verification |

**Total: 3-4 weeks**

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-01-04 | AI Assistant | Initial monorepo guide |

---

*This document is part of the Phase 1 Architectural Modernization deliverables.*

