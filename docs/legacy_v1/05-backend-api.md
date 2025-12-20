# Backend API

The backend is built with Express.js and serves as a RESTful API.

## Base URL
Defaults to `http://localhost:3005/api/v1` (check config).

## Core Modules

### Authentication (`/auth`)
*   `POST /login`: Authenticate user.
*   `POST /register`: Create new account.
*   `POST /verify-token`: Validate session.

### Users & Teams (`/users`, `/teams`)
*   Manage user profiles, roles, and team assignments.

### Assessment (`/analytics`)
*   Submit assessment answers.
*   Calculate scores.
*   Retrieve DRD (Digital Readiness Degree).

### Initiatives (`/initiatives`)
*   CRUD operations for transformation initiatives.
*   Prioritization matrix data.

### Documents (`/documents`)
*   Upload/Download strategy documents.
*   Parse PDF content for AI analysis.

### AI Services (`/ai`)
*   `POST /chat`: Send message to AI Consultant.
*   `POST /generate-report`: Trigger report generation.
*   `POST /analyze`: Request specific document analysis.

## Database

The application supports both **SQLite** and **PostgreSQL**.

*   **Models**: Defined in `server/models`.
*   **Migrations**: Managed via scripts in `server/migrations`.

### Schema Overview
*   **Users**: Accounts and auth data.
*   **Organizations**: Tenant wrapper.
*   **Answers**: Assessment responses.
*   **Initiatives**: Proposed projects.
*   **Chats**: History of AI conversations.
