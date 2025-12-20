# System Architecture

## Technology Stack

### Frontend
- **Framework**: React 18+ (Vite)
- **Language**: TypeScript
- **State Management**: Zustand (with persistence middleware)
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **HTTP Client**: Native `fetch` / Custom hooks
- **PDF Generation**: `jspdf`, `html2canvas`

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**:
  - **SQLite** (Default for development/local)
  - **PostgreSQL** (Production ready)
- **ORM/Query Builder**: Raw SQL / Helper wrappers (Migration system included)
- **Authentication**: JWT (JSON Web Tokens)
- **AI Integration**: Google Gemini API / OpenAI API

## Project Structure

```
consultify/
├── docs/                 # Documentation
├── src/                  # Frontend source code
│   ├── components/       # Reusable UI components
│   ├── views/            # Page components (routes)
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand state stores
│   ├── services/         # API service layers
│   └── types/            # TypeScript definitions
├── server/               # Backend source code
│   ├── routes/           # API Endpoints
│   ├── services/         # Business logic & AI services
│   ├── models/           # Data models (SQL schemas)
│   └── migrations/       # Database migration scripts
├── tests/                # Test suites (Vitest/Playwright)
└── public/               # Static assets
```

## Data Flow
1. **User Interaction**: User interacts with React components.
2. **State Update**: Zustand store updates synchronous UI state.
3. **API Call**: Services make async calls to the Node.js backend.
4. **Processing**: Backend routes validate requests and call services.
5. **Persistence**: Data is stored in SQLite/Postgres.
6. **AI Layer**: Backend services communicate with Gemini/OpenAI for intelligent features and return results to the frontend.
