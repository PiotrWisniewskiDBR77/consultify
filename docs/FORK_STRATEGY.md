# Fork Strategy & Repository Architecture

This document defines the technical strategy for splitting the **Consultinity** platform into two distinct applications (`apps/consultinity` and `apps/new-app`) while maintaining a shared core via a Monorepo architecture.

## 1. Repository Model: Monorepo (Nx)

We utilize **Nx** to manage a single git repository containing multiple applications and shared libraries.

### Directory Structure
```
/
├── apps/
│   ├── consultinity/       # The original Consulting Platform (Product A)
│   └── new-app/          # The new application (Product B)
├── packages/
│   └── shared/           # Common code (UI, Types, Utils, Auth, AI)
├── tools/                # Build/Dev scripts
├── nx.json               # Workspace configuration
└── package.json          # Root dependencies
```

## 2. Shared Code Policy

To prevent code duplication and ensure consistency, the following rules apply:

-   **UI Components**: Generic components (Buttons, Cards, Inputs, Modals) MUST live in `packages/shared`. App-specific views stay in `apps/*/src/views`.
-   **Types**: Domain-agnostic types (API responses, User roles, Common Interfaces) MUST be in `packages/shared/src/types`.
-   **Utilities**: Helper functions (Formatting, Validation, Math) MUST be in `packages/shared/src/utils`.
-   **Domain Logic**: Logic specific to _Consulting_ stays in `apps/consultinity`. Logic unique to the _New App_ goes to `apps/new-app`. Logic common to both (e.g., Auth flow, Basic User Management) moves to `packages/shared` or a new `packages/core` library.

## 3. Database Strategy

We adopt a **Shared Schema & Database** approach initially, with logical separation via `organization_id`.

-   **Tenancy**: Both apps share `users`, `organizations`, `billing` tables.
-   **schema separation**:
    -   Shared tables: `users`, `organizations`, `activity_logs`.
    -   App-specific tables: Prefixed or clearly owned by one domain (e.g., `projects` for Consultinity).
-   **Migrations**: Managed centrally in `server/src/database` (currently) -> to be split into `packages/db-migrations` if divergence increases.

## 4. Build & Deployment

Each application has its own build pipeline but shares the CI infrastructure.

### Build Commands
-   **Consultinity**: `nx build consultinity` -> outputs to `dist/apps/consultinity`
-   **New App**: `nx build new-app` -> outputs to `dist/apps/new-app`
-   **Shared**: `nx build shared` (dependency for apps)

### CI/CD (GitHub Actions)
-   **Isolation**: The pipeline detects changes via `nx affected`.
-   **Consultinity Deploy**: Triggers on push to `main` if `apps/consultinity` is affected.
-   **New App Deploy**: Triggers on push to `main` if `apps/new-app` is affected.
-   **Shared Changes**: Triggers redeploy of **BOTH** applications to ensure compatibility.

## 5. Fork Execution Steps

1.  **Extract Shared UI**: Move primitives to `packages/shared` (Completed).
2.  **Initialize New App**: Generate `apps/new-app` using Nx generators (Pending).
3.  **Refactor Consultinity**: Update imports to use `@consultinity/shared`.
4.  **Verify Separation**: Ensure `apps/new-app` does not import from `apps/consultinity`.
