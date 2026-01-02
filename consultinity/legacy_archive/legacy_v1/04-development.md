# Development Guide

## Workflow

1.  **Version Control**: We use Git.
    *   **Main branch**: `main` (Production ready).
    *   **Feature branches**: `feature/feature-name`.
    *   **Bug fixes**: `fix/bug-name`.
2.  **Pull Requests**: All changes must go through a PR review.

## Coding Standards

### General
*   **Language**: TypeScript is preferred over JavaScript for new components.
*   **Formatting**: We follow standard Prettier/ESLint configurations.
*   **Imports**: Use absolute imports where possible (configured in `tsconfig.json`).

### Frontend (React)
*   **Components**: Functional components with Hooks.
*   **State**: Local state for UI, Zustand for global/shared data.
*   **Naming**: PascalCase for components (`MyComponent.tsx`), camelCase for functions/vars.

### Backend (Node/Express)
*   **Services**: Business logic should reside in `services/`, not controllers/routes.
*   **Async/Await**: Use modern async patterns.
*   **Error Handling**: Use the centralized error middleware.

## Testing

We use **Vitest** for unit/integration tests and **Playwright** for E2E.

### Running Tests

```bash
# Run all tests
npm run test:all

# Run unit tests
npm run test:unit

# Run component tests
npm run test:component

# Run E2E tests
npm run test:e2e
```

### Writing Tests
*   Place unit tests next to the file (e.g., `utils.test.ts` next to `utils.ts`) or in `tests/unit`.
*   Component tests go in `tests/components`.
*   Mock external API calls using Vitest mocks.
*   **Goal**: Maintain high coverage for core business logic (services).
