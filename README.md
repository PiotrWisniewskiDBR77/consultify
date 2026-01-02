<div align="center">
<img width="1200" height="475" alt="Consultify Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Consultify
### AI-Powered Digital Transformation Platform
</div>

**Consultify** serves as a digital executive consultant, guiding organizations through the complex journey of digital maturity—from initial assessment to full-scale rollout.

## 📚 Enterprise Documentation (Source of Truth)

The documentation is organized into 8 Pillars following the **Consultinity Perfect Standard (CPS)**.

### 1. [Strategy & Intent](consultinity/00_strategy/)
- **[Business Model & Strategic Sense](consultinity/00_strategy/03_business_model.md)**: Commercial roadmap and value.
- **[Enterprise Spec](consultinity/00_strategy/00_foundation/ENTERPRISE_SPEC.md)**: Master product blueprint (1670+ lines).
- **[System Contract](consultinity/00_strategy/00_foundation/00_SYSTEM_CONTRACT.md)**: User journey and system integrity.

### 2. [Architecture](consultinity/10_architecture/)
- **[C4 Architecture Detailed](consultinity/10_architecture/core/architecture_detailed.md)**: Level 3 Component and Sequence diagrams.
- **[AI Research](consultinity/10_architecture/ai_research/)**: AI system architecture and RAG patterns.
- **[Core Architecture](consultinity/10_architecture/core/)**: Backend and frontend service layers.

### 3. [API Specification](consultinity/20_api/)
- **[Webhook Registry](consultinity/20_api/api/webhook_registry.md)**: Outbound event specification.
- **[Streaming Protocol Spec](consultinity/20_api/api/streaming_protocol.md)**: AI SSE/Thought protocol.
- **[DTO Registry](consultinity/20_api/api/dto_registry.md)**: Canonical interface objects.
- **[API Reference](consultinity/20_api/API_REFERENCE.md)**: Authoritative endpoint guide.

### 4. [Product & Functional Flow](consultinity/30_functional/)
- **[Product Flow](consultinity/30_functional/10_product_flow/)**: 7-phase user journey (Phase A-G).
- **[Features](consultinity/30_functional/03-features.md)**: Module breakdowns and capabilities.
- **[World-Class Chat](consultinity/30_functional/WORLD_CLASS_CHAT_2025.md)**: AI interaction specifications.

### 5. [Technical Standards](consultinity/40_technical/)
- **[Visual Identity & UI/UX](consultinity/40_technical/20_execution/visual_identity.md)**: Premium AI Aesthetic tokens.
- **[Resilience & Recovery Rules](consultinity/40_technical/20_execution/resilience_rules.md)**: Stability and growth patterns.
- **[Error Handling & Resilience](consultinity/40_technical/20_execution/error_handling.md)**: Fallback logic and Error Dictionary.

### 6. [Operations & Security](consultinity/50_operations/)
- **[Deployment Guide](consultinity/50_operations/06-deployment.md)**: Building and running in production.
- **[Local Setup](consultinity/50_operations/LOCAL_SETUP.md)**: Development environment instructions.
- **[OAuth Guide](consultinity/50_operations/OAUTH_SETUP_GUIDE.md)**: Authentication configuration.

### 7. [Enablement & Support](consultinity/60_enablement/)
- **[User Guides](consultinity/60_enablement/user_guides/)**: Manuals for AI, Studio, and MyWork.
- **[Tutorial Videos](consultinity/60_enablement/videos/)**: Walkthroughs and onboarding scripts.

### 8. [Governance & Audit](consultinity/70_governance/)
- **[Governance & Ownership Policy](consultinity/70_governance/governance_policy.md)**: Decision rights and data sovereignty.
- **[Legal](consultinity/70_governance/Legal/)**: Privacy, ToS, and compliance documents.
- **[AI Audit Report](consultinity/70_governance/AI_ENTERPRISE_AUDIT_REPORT.md)**: ISO/PMBOK compliant AI audit.

## 🚀 Quick Start (Development)

### Option 1: Using Startup Script (Recommended)

```bash
chmod +x start.sh
./start.sh
```

### Option 2: Manual Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```
2.  **Configure Environment**:
    Create `.env.local` file (see [consultinity/50_operations/LOCAL_SETUP.md](consultinity/50_operations/LOCAL_SETUP.md) for detailed instructions).
    Minimum required: `GEMINI_API_KEY` (or other LLM provider key).
3.  **Run Application**:
    ```bash
    npm run dev
    ```

**📖 For detailed local setup instructions, see [consultinity/50_operations/LOCAL_SETUP.md](consultinity/50_operations/LOCAL_SETUP.md)**

## 🧪 Running Tests
```bash
npm run test:all
```

---
*For legacy documentation, see [consultinity/legacy_archive](consultinity/legacy_archive/).*
