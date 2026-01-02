# 11. Delivery & Governance

## 11.1. Collaboration Model

### Roles
*   **Product Owner (Vendor)**: Responsible for roadmap definition and feature prioritization.
*   **Vendor PM**: Operational contact for delivery timeline and blocker resolution.
*   **Lead Architect**: Owns technical decisions and compliance alignment.
*   **Client Stakeholder**: Provides acceptance and access to internal data/SME.

### Sprint Cadence
*   **Cycle**: 2-week Sprints.
*   **Ceremonies**:
    *   **Day 1**: Sprint Planning (Internal).
    *   **Day 10**: Sprint Review & Demo (with Client).

## 11.2. Definition of Done (DoD)

A feature is "Done" ONLY when:
1.  **Code**: Merged to `main`, passed linter (ESLint) and formatter (Prettier).
2.  **Tests**: Unit tests pass (80% coverage on new logic). E2E happy path verifiable.
3.  **Documentation**: Functional Spec updated. API Swagger/OpenAPI updated.
4.  **Security**: No high-severity vulnerabilities in dependencies (`npm audit`).
5.  **Deployment**: Successfully running on Staging environment.

## 11.3. Governance Gates
*   **Architecture Review**: Any schema change or new integration requires Architect sign-off.
*   **Security Review**: Every major release (Minor version bump) undergoes automated SAST scanning.
