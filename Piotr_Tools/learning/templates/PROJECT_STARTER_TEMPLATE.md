# Enterprise SaaS Project Starter Template

**Use This**: Every time you start a new SaaS project  
**Based On**: Consultify's production-ready structure

---

## 🚀 Quick Start

```bash
# 1. Clone this template structure
mkdir my-new-saas
cd my-new-saas

# 2. Initialize
npm init -y
git init

# 3. Install dependencies (see below)
npm install <packages>

# 4. Copy config files from this template
cp Piotr_Tools/learning/templates/configs/* .

# 5. Start coding!
```

---

## 📁 Directory Structure

```
my-saas/
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── src/ (Frontend)
│   ├── components/
│   │   ├── ui/              # Reusable UI (buttons, inputs)
│   │   ├── layout/          # Layout components
│   │   └── features/        # Feature components
│   ├── views/               # Page-level components
│   ├── services/            # API clients
│   ├── hooks/               # Custom hooks
│   ├── types/               # TypeScript types
│   ├── utils/               # Utility functions
│   ├── main.tsx             # Entry point
│   └── App.tsx              # Root component
│
├── server/ (Backend)
│   ├── src/
│   │   ├── routes/          # Express routes
│   │   │   ├── auth.ts
│   │   │   ├── users.ts
│   │   │   └── api.ts
│   │   ├── controllers/     # Business logic
│   │   ├── services/        # Domain services
│   │   ├── middleware/      # Express middleware
│   │   │   ├── auth.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── validation.ts
│   │   ├── database/        # DB layer
│   │   │   ├── index.ts
│   │   │   ├── schema  .sql
│   │   │   └── migrations/
│   │   ├── types/           # TypeScript types
│   │   ├── utils/           # Utilities
│   │   └── index.ts         # Entry point
│   └── package.json
│
├── tests/
│   ├── unit/                # Fast unit tests
│   ├── integration/         # API + DB tests
│   └── e2e/                 # Playwright tests
│
├── docs/                    # Documentation
│   ├── README.md            # Overview
│   ├── API.md               # API documentation
│   └── DEPLOYMENT.md        # Deployment guide
│
├── scripts/                 # Utility scripts
│   ├── seed.ts              # Seed database
│   └── migrate.ts           # Run migrations
│
├── .env.example             # Environment variables template
├── .gitignore
├── docker-compose.yml       # Local development
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
└── README.md
```

---

## 📦 Essential Dependencies

### Frontend

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom
npm install react-router-dom
npm install @tanstack/react-query
npm install zod                    # Validation
npm install axios                  # HTTP client

# UI (choose one)
npm install tailwindcss            # Utility-first CSS
# OR
npm install @mui/material          # Material UI
```

### Backend

```bash
npm install express
npm install -D @types/express
npm install cors dotenv
npm install better-sqlite3         # Dev database
npm install pg                     # PostgreSQL (production)
npm install bcrypt jsonwebtoken
npm install zod                    # Validation
npm install -D @types/bcrypt @types/jsonwebtoken
```

### Testing

```bash
npm install -D vitest @vitest/ui
npm install -D @playwright/test
npm install -D @testing-library/react @testing-library/jest-dom
```

### Build Tools

```bash
npm install -D vite
npm install -D typescript
npm install -D eslint prettier
npm install -D tsx                 # Run TypeScript directly
```

---

## 🔧 Configuration Files

### package.json

```json
{
  "name": "my-saas",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "dev:server": "tsx watch server/src/index.ts",
    "build": "tsc && vite build",
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:e2e": "playwright test",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "migrate": "tsx scripts/migrate.ts",
    "seed": "tsx scripts/seed.ts"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@server/*": ["server/src/*"]
    }
  },
  "include": ["src", "server"],
  "exclude": ["node_modules", "dist"]
}
```

### .env.example

```env
# App
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=file:./dev.db

# Auth
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# External APIs (add as needed)
# OPENAI_API_KEY=
# STRIPE_SECRET_KEY=
```

### .gitignore

```
# Dependencies
node_modules/

# Build
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local

# Database
*.db
*.db-journal

# Logs
logs/
*.log

# Testing
coverage/
test-results/

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
```

---

## 🏗️ Minimal Working Example

### server/src/index.ts

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Your routes here
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

### src/main.tsx

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### src/App.tsx

```typescript
import { useState, useEffect } from 'react';

function App() {
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    fetch('http://localhost:3000/api/health')
      .then(res => res.json())
      .then(setHealth);
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">My SaaS</h1>
      <p>Server status: {health?.status || 'loading...'}</p>
    </div>
  );
}

export default App;
```

---

## ✅ Checklist for New Project

### Day 1: Setup

- [ ] Create directory structure
- [ ] Initialize git
- [ ] Install dependencies
- [ ] Copy config files
- [ ] Create .env from .env.example
- [ ] Run `npm run dev` and `npm run dev:server`
- [ ] Verify health check works

### Week 1: Foundation

- [ ] Set up database schema
- [ ] Implement authentication
- [ ] Create first API endpoint
- [ ] Add first test
- [ ] Set up CI/CD

### Week 2-4: Core Features

- [ ] Implement multi-tenancy (organizations)
- [ ] Add RBAC
- [ ] Build main features
- [ ] Reach 80% test coverage
- [ ] Add error handling

### Month 2: Polish

- [ ] Security audit
- [ ] Performance optimization
- [ ] Documentation
- [ ] Deploy to staging

---

## 🎯 Success Criteria

Your project is ready when:

- ✅ `npm test` passes with >80% coverage
- ✅ `npm run lint` has no errors
- ✅ TypeScript compiles with no errors
- ✅ Can deploy to production
- ✅ Documentation is complete
- ✅ Security basics implemented (auth, validation, encryption)

---

## 📚 Next Steps

1. **Start small**: Get authentication working first
2. **Add features gradually**: One at a time, with tests
3. **Deploy early**: Get to production ASAP (even incomplete)
4. **Iterate**: Improve based on real usage

---

**Remember**: This template is a starting point. Adapt it to your needs!

Good luck! 🚀
