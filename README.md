<div align="center">
<img width="1200" height="475" alt="Consultify Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

# Consultify
### AI-Powered Digital Transformation Platform
</div>

**Consultify** serves as a digital executive consultant, guiding organizations through the complex journey of digital maturity—from initial assessment to full-scale rollout.

## 📚 Documentation

### Getting Started
- **[Introduction](docs/00-introduction.md)**: Overview, value proposition, and key terms.
- **[Getting Started](docs/01-getting-started.md)**: Installation, environment setup, and running locally.
- **[Local Setup Guide](docs/LOCAL_SETUP.md)**: Detailed local development setup instructions.
- **[API Key Setup](docs/GDZIE_USTAWIC_API_KEY.md)**: Guide for configuring API keys.
- **[OAuth Setup Guide](docs/OAUTH_SETUP_GUIDE.md)**: OAuth authentication configuration.

### Technical Documentation
- **[Architecture](docs/02-architecture.md)**: Tech stack, project structure, and data flow.
- **[Features](docs/03-features.md)**: Detailed breakdown of the dashboard, assessment modules, and AI capabilities.
- **[Development Guide](docs/04-development.md)**: Git workflow, coding standards, and testing strategies.
- **[API Reference](docs/API_REFERENCE.md)**: Complete API endpoint documentation.
- **[Deployment](docs/06-deployment.md)**: Building for production and Docker usage.

### Enterprise Documentation
- **[System Contract](docs/00_foundation/00_SYSTEM_CONTRACT.md)**: User journey, mental states, and system integrity.
- **[Enterprise Specification](docs/00_foundation/ENTERPRISE_SPEC.md)**: Enterprise-grade specifications and design principles.
- **[Product Flow](docs/10_product_flow/)**: Product flow documentation by phase.
- **[Execution Rules](docs/20_execution/)**: UI, backend, and RBAC rules.

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
    Create `.env.local` file (see [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md) for detailed instructions).
    Minimum required: `GEMINI_API_KEY` (or other LLM provider key).
3.  **Run Application**:
    ```bash
    npm run dev
    ```

**📖 For detailed local setup instructions, see [docs/LOCAL_SETUP.md](docs/LOCAL_SETUP.md)**

## 🧪 Running Tests
```bash
npm run test:all
```

---
*For legacy documentation, see [docs/archive](docs/archive/).*
