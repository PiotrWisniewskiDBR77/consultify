# Consultinity - Master Documentation (Source of Truth)

**Last Updated:** 1 January 2026  
**Standard:** Consultinity Perfect Standard (CPS) v1.0  
**Class:** Enterprise SaaS (IBM/Capgemini Level)

This repository is the single, authoritative source of truth for the Consultinity platform. The documentation is organized into 8 Pillars, ensuring that the system is fully auditable and can be reconstructed based on these specifications.

---

## 🏛️ Documentation Pillars

### [1. Strategy & Intent](../00_strategy/)
*The "Why" - Mission, commercial logic, and brand.*
- **[Business Model & Strategic Sense](../00_strategy/03_business_model.md)**: Commercial roadmap and value.
- **[Enterprise Spec](../00_strategy/00_foundation/ENTERPRISE_SPEC.md)**: Master product blueprint (1670+ lines).
- **[System Contract](../00_strategy/00_foundation/00_SYSTEM_CONTRACT.md)**: User journey integrity.
- **[Methodology](../00_strategy/03_methodology/)**: DRD and diagnostic principles.

### [2. Architecture](../10_architecture/)
*The "Structure" - Blueprints and data models.*
- **[C4 Architecture Detailed](../10_architecture/core/architecture_detailed.md)**: Level 3 Component and Sequence diagrams.
- **[Security Module](../10_architecture/core/security_module.md)**: Auth and session hardening.
- **[State Machine Spec](../10_architecture/core/state_machine_spec.md)**: Authoritative transition logic.
- **[AI Master Architecture](../10_architecture/ai_research/AI_MASTER_ARCHITECTURE.md)**: AI pipeline and RAG.

### [3. API Specification](../20_api/)
*The "Interface" - REST, Streaming, and Events.*
- **[Webhook Registry](../20_api/api/webhook_registry.md)**: Outbound event specification.
- **[User Notifications](../20_api/api/user_notifications.md)**: Integration specs for Slack/Teams.
- **[Streaming Protocol Spec](../20_api/api/streaming_protocol.md)**: AI SSE/Thought protocol.
- **[DTO Registry](../20_api/api/dto_registry.md)**: Canonical interface objects.
- **[API Reference](../20_api/API_REFERENCE.md)**: Authoritative endpoint guide.

### [4. Functional Flow](../30_functional/)
*The "Behavior" - UX logic and process design.*
- **[Phase A-G Journey](../30_functional/10_product_flow/)**: 7-phase execution model.
- **[User Settings](../30_functional/user_settings.md)**: Profile and organization preferences.
- **[Feature Epics](../30_functional/10_product_flow/epics/00_EPIC_REGISTRY.md)**: Detailed module specs.
- **[World-Class Chat](../30_functional/WORLD_CLASS_CHAT_2025.md)**: AI experience specs.

### [5. Technical Standards](../40_technical/)
*The "Build" - Coding rules and engineering manual.*
- **[Visual Identity & UI/UX](../40_technical/20_execution/visual_identity.md)**: Premium AI Aesthetic tokens.
- **[Resilience & Recovery](../40_technical/20_execution/resilience_rules.md)**: Ghost Hunting and stability patterns.
- **[Error Handling & Resilience](../40_technical/20_execution/error_handling.md)**: Fallback logic and Error Dictionary.
- **[Data Formatting Standards](../40_technical/20_execution/data_transfer_standards.md)**: Naming and temporal rules.
- **[Testing Protocol](../40_technical/testing/)**: Verification standards.

### [6. Operations & Security](../50_operations/)
*The "Run" - Deployment, DevOps, and Hardening.*
- **[Deployment Runbook](../50_operations/DEPLOYMENT_RUNBOOK.md)**: Production guide.
- **[Local Setup](../50_operations/LOCAL_SETUP.md)**: Environment orchestration.
- **[Security Specs](../50_operations/OAUTH_SETUP_GUIDE.md)**: Access control.

### [7. Enablement & Support](../60_enablement/)
*The "Help" - User onboarding and self-teaching.*
- **[User Preferences Guide](../60_enablement/user_guides/user_preferences.md)**: Customizing the platform experience.
- **[Playbooks](../60_enablement/user_guides/)**: Goal-oriented guides.
- **[Video Tutorials](../60_enablement/videos/)**: Visual enablement scripts.

### [8. Governance & Audit](../70_governance/)
*The "Control" - Compliance, RBAC, and Auditability.*
- **[Governance & Ownership](../70_governance/governance_policy.md)**: Decisions, data sovereignty, and rights.
- **[AI Audit Report](../70_governance/AI_ENTERPRISE_AUDIT_REPORT.md)**: Compliance validation.
- **[RBAC Rules](../40_technical/20_execution/22_RBAC_AND_LIMITS.md)**: Permission matrix.
- **[Legal](../70_governance/Legal/)**: Contractual and privacy frameworks.

---

> **Note to Developers:** This documentation is the source of truth. If the code deviates from these specifications without a documented Change Request, the documentation takes precedence.
