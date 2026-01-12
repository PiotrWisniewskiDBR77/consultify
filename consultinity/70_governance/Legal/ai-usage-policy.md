# AI Usage Policy

**Effective Date:** January 1, 2025  
**Version:** 1.0

## 1. Introduction

This AI Usage Policy explains how Consultinity uses artificial intelligence technologies, how your data is processed by AI systems, and your options for controlling AI features, including Bring Your Own Key (BYOK) functionality.

This policy is part of our [Terms of Service](/Legal/terms-of-service.md) and [Privacy Policy](/Legal/privacy-policy.md).

## 2. AI-Powered Features

Consultinity uses AI to provide the following features:

| Feature | Description | Credits Used |
|---------|-------------|--------------|
| Strategic Assessments | AI-guided organizational evaluation | 5/question |
| Roadmap Generation | Automated strategic roadmap creation | 50/roadmap |
| Initiative Creation | AI-suggested transformation initiatives | 15/initiative |
| Document Analysis | Intelligent document parsing and insights | 3/page |
| ROI Calculations | AI-powered business case analysis | 20/calculation |
| AI Chat | Contextual strategic assistant | 2-5/message |
| Report Generation | Automated reporting and summaries | 30/report |
| Strategic Analysis | Deep dive strategic recommendations | 25/analysis |

## 3. AI Providers

### 3.1 Default Providers (Managed AI)

We use multiple AI providers to deliver our features:

| Provider | Models | Use Case |
|----------|--------|----------|
| OpenAI | GPT-4, GPT-4o | Primary strategic analysis, document processing |
| Anthropic | Claude 3.5 Sonnet | Complex reasoning, long-context tasks |
| Google | Gemini Pro | Multimodal analysis, research |

### 3.2 Provider Selection

We automatically select the optimal provider based on:
- Task complexity and requirements
- Availability and performance
- Cost efficiency
- Your configured preferences (Enterprise)

### 3.3 Provider Terms

When using Managed AI:
- Your data is processed under our enterprise agreements with providers
- Providers do NOT train on your data (per our enterprise terms)
- Data is processed in accordance with our Privacy Policy

## 4. Data Processing for AI

### 4.1 What Data is Processed

When you use AI features, the following may be processed:

- Your prompts, questions, and inputs
- Relevant context from your workspace (documents, assessments, roadmaps)
- Organization profile and settings (for context)
- Conversation history (for continuity)

### 4.2 Data Handling Principles

| Principle | Implementation |
|-----------|----------------|
| Purpose Limitation | Data used only for requested AI operation |
| Data Minimization | Only necessary context is sent to AI |
| No Training | Your data is NOT used to train AI models |
| Encryption | All data encrypted in transit (TLS 1.3) |
| Temporary Processing | Prompts not stored by providers (Enterprise terms) |

### 4.3 Data Retention

- Prompts and responses: Retained within your workspace
- AI provider logs: Not retained (per our agreements)
- Usage metrics: Anonymized for analytics

## 5. AI Credits System

### 5.1 How Credits Work

AI Credits are consumed when using AI-powered features. Each plan includes a monthly allocation:

| Plan | Monthly Credits | Overage Rate |
|------|-----------------|--------------|
| Growth | 5,000 | €0.05/credit |
| Scale | 20,000 | €0.04/credit |
| Enterprise | 100,000 | €0.03/credit |

### 5.2 Credit Consumption

Credits are consumed based on:
- Complexity of the operation
- Amount of context processed
- Length of generated output
- Model used (varies by provider)

### 5.3 Credit Monitoring

You can monitor your credit usage:
- Dashboard: Real-time usage display
- Alerts: Notifications at 80% and 100% usage
- Reports: Detailed usage breakdown by feature

### 5.4 Credit Policies

- Credits do NOT roll over month-to-month
- Credits have no cash value
- Unused credits at month-end expire
- Credits cannot be transferred between organizations

## 6. BYOK (Bring Your Own Key)

### 6.1 Overview

Scale and Enterprise plans can use their own AI provider API keys instead of our Managed AI service.

**Benefits of BYOK:**
- Direct control over AI provider relationship
- Use existing enterprise AI contracts
- Compliance with specific data residency requirements
- Potential cost savings for high-volume usage

### 6.2 Supported Providers

| Provider | Requirements |
|----------|-------------|
| OpenAI | API key with GPT-4 access |
| Anthropic | API key with Claude 3 access |
| Azure OpenAI | Endpoint URL + API key |
| Local LLMs | Ollama, vLLM, or compatible endpoint |

### 6.3 BYOK Pricing

When using BYOK, you pay:
1. **AI Provider:** Direct payment to your provider for tokens used
2. **Orchestration Fee:** We charge for prompt engineering and context management

| Plan | Orchestration Fee |
|------|-------------------|
| Scale | €0.015/credit |
| Enterprise | €0.01/credit |

### 6.4 Setting Up BYOK

1. Navigate to Settings → AI Configuration
2. Select "Bring Your Own Key"
3. Enter your provider credentials (encrypted at rest)
4. Test connection
5. Configure model preferences

### 6.5 BYOK Data Flow

When using BYOK:
- Prompts are sent directly to YOUR provider account
- Data never passes through our servers (except for orchestration)
- You maintain the provider relationship
- Usage billed by your provider

### 6.6 Local LLM Support (Enterprise)

Enterprise customers can connect to self-hosted LLMs:
- Ollama
- vLLM
- Text Generation Inference
- Custom OpenAI-compatible endpoints

**Requirements:**
- HTTPS endpoint
- Compatible API format
- Sufficient model capabilities

## 7. AI Output Guidelines

### 7.1 Nature of AI Outputs

AI-generated content is:
- **Advisory only** - Not a substitute for professional judgment
- **Based on inputs** - Quality depends on data provided
- **Potentially inaccurate** - May contain errors or hallucinations
- **Not guaranteed** - Results may vary

### 7.2 Your Responsibilities

When using AI features, you should:

- Review all AI outputs before taking action
- Verify critical information independently
- Not rely solely on AI for strategic decisions
- Apply professional judgment to recommendations
- Report clearly incorrect or harmful outputs

### 7.3 AI Limitations

AI features may:
- Produce inconsistent results for similar inputs
- Lack real-time information
- Miss context or nuance
- Generate plausible but incorrect content

## 8. Prohibited AI Uses

You may NOT use AI features to:

- Generate harmful, illegal, or unethical content
- Create deceptive or misleading materials
- Impersonate real individuals or organizations
- Bypass safety filters or content policies
- Extract training data or model information
- Generate content that violates third-party rights
- Automate spam or malicious activities

Violations may result in account termination.

## 9. AI Safety and Ethics

### 9.1 Our Commitments

We are committed to responsible AI use:
- Safety filters on all outputs
- Regular monitoring for misuse
- Continuous improvement of guardrails
- Transparency about AI capabilities and limitations

### 9.2 Content Moderation

AI outputs are filtered to prevent:
- Harmful or dangerous content
- Personally identifiable information leakage
- Copyright-infringing content
- Discriminatory or biased outputs

## 10. Your Controls

### 10.1 Feature Controls

You can control AI features in Settings:

| Setting | Options |
|---------|---------|
| AI Features | Enable/Disable globally |
| Auto-suggestions | Enable/Disable |
| Context scope | Limit data sent to AI |
| Model preference | Choose default model (Enterprise) |

### 10.2 Data Controls

- Exclude specific documents from AI context
- Clear AI conversation history
- Request deletion of AI-processed data
- Opt out of improvement analytics

### 10.3 Audit Logs

Enterprise plans include:
- AI usage audit logs
- Prompt/response logging (optional)
- Compliance reporting

## 11. Updates to AI Features

We may update AI features to:
- Improve accuracy and performance
- Add new capabilities
- Change underlying models
- Adjust credit consumption

Material changes will be communicated through release notes and platform notifications.

## 12. Contact

For questions about AI features or this policy:

**DBR77 Robotics Sp. z o.o.**
- **AI Support:** ai-support@dbr77.com
- **Privacy:** privacy@dbr77.com
- **General:** contact@dbr77.com

---

*By using AI-powered features in Consultinity, you acknowledge and agree to this AI Usage Policy.*
