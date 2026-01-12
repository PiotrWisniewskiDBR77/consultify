# AI Settings User Guide

This guide explains how to configure AI behavior in Consultify at each level: SuperAdmin, Admin, and User.

---

## Table of Contents

1. [Overview](#overview)
2. [For SuperAdmins](#for-superadmins)
3. [For Admins](#for-admins)
4. [For Users](#for-users)
5. [Proactivity Modes](#proactivity-modes)
6. [Testing AI Settings](#testing-ai-settings)
7. [Troubleshooting](#troubleshooting)

---

## Overview

Consultify's AI system uses a 3-tier configuration hierarchy:

- **SuperAdmin** → Controls platform-wide infrastructure (providers, limits, security)
- **Admin** → Controls organization-wide policies (AI roles, budgets, features)
- **User** → Controls personal preferences (response style, proactivity, model parameters)

Settings cascade downward, with each level able to constrain what's available below.

---

## For SuperAdmins

### Accessing SuperAdmin AI Settings

1. Navigate to **SuperAdmin Panel** → **AI Platform** → **LLM Management**
2. Click the **Global Settings** tab

### Available Settings

#### Infrastructure
- **Default Provider** - Which AI provider to use by default
- **Fallback Chain** - Order of providers if primary fails
- **Circuit Breaker** - Failure threshold and cooldown for provider failover

#### Global Limits
- **Global Token Limit** - Maximum tokens across entire platform
- **Rate Limits** - Requests per minute/hour
- **Max Context Window** - Maximum input context size
- **Max Tokens Per Request** - Maximum output tokens

#### Security & Privacy
- **PII Detection Sensitivity** - Low/Medium/High detection of personal data
- **Require Encryption** - Force TLS for all AI communications
- **Data Residency** - Restrict processing to specific regions (EU, US, etc.)

### Best Practices

1. Set conservative global limits initially, increase based on usage
2. Enable PII detection for regulated industries
3. Configure circuit breaker to prevent cascading failures
4. Review audit logs regularly

---

## For Admins

### Accessing Organization AI Settings

1. Navigate to **Admin Panel** → **AI Settings** (or **Settings** → **AI Configuration**)
2. Access from sidebar under "Organization" section

### Available Settings

#### Policy & Roles Tab

**AI Policy Level** - Controls what AI can do:
- **ADVISORY** - AI can only explain and suggest
- **ASSISTED** - AI can create drafts requiring approval
- **PROACTIVE** - AI can execute low-risk actions
- **AUTOPILOT** - AI operates autonomously within governance

**Active AI Roles**:
- **Advisor** - Provides guidance and recommendations
- **PMO Manager** - Manages project methodology
- **Executor** - Executes approved actions
- **Educator** - Teaches and explains concepts

**Default Proactivity** - Sets the default proactivity level for new users

#### Models Tab

Select which AI models are available to users in your organization:
- Toggle specific models on/off
- All models enabled by default
- Restricting models helps control costs

#### Limits & Budget Tab

**Usage Limits**:
- Max AI calls per day (per user)
- Max tokens per month (organization total)

**Budget Control**:
- Monthly budget in USD
- Hard limit (absolute stop)
- Freeze on limit - Disable AI when budget exceeded

#### Features Tab

Toggle AI features for your organization:
- **Artifacts Panel** - Structured content generation
- **Thinking Steps** - Chain of thought visibility
- **Focus Modes** - Context filtering
- **Web Search** - External information lookup
- **Voice** - Voice input/output

#### Audit Log Tab

View all changes to AI settings in your organization:
- Who changed what and when
- Previous and new values
- Export to CSV for compliance

### Best Practices

1. Start with ADVISORY policy level, upgrade as team gains confidence
2. Enable only needed AI roles to reduce complexity
3. Set budget limits with 20% buffer for flexibility
4. Review audit log monthly for compliance

---

## For Users

### Accessing Personal AI Settings

1. Click your **profile icon** → **Settings**
2. Navigate to **AI** or **LLM Management** tab
3. Or access directly via **Settings** → **AI Settings**

### Available Settings

#### AI Proactivity Tab (NEW)

Control how actively the AI assists you:

| Mode | Description |
|------|-------------|
| **Reactive** | AI waits silently. Perfect for experts who prefer minimal interruption. |
| **Balanced** | AI suggests when helpful but doesn't interrupt. Recommended for most users. |
| **Proactive** | AI actively monitors and offers assistance. Great for learning or complex tasks. |

*Note: Your organization may limit the maximum proactivity level available.*

#### Behavior & Context Tab

**Response Style**:
- Concise - Brief, to-the-point answers
- Balanced - Moderate detail
- Detailed - Comprehensive explanations

**Model Parameters** (Advanced):
- Temperature - Creativity level (0-2)
- Max Tokens - Response length limit
- Top P - Response diversity
- Frequency/Presence Penalties - Repetition control

**System Instructions** - Custom instructions applied to all chats

#### Privacy & Controls Tab

- **PII Redaction** - Auto-remove sensitive data before sending
- **Web Search** - Allow AI to search the internet
- **Data Retention** - How long context is remembered

#### Model Registry Tab

View and select which AI models you want visible in your model picker.

### Best Practices

1. Try **Balanced** proactivity first, adjust based on preference
2. Use **Temperature 0.7** for general tasks, lower for precise work
3. Enable **PII Redaction** if working with sensitive data
4. Set **System Instructions** to customize AI personality

---

## Proactivity Modes

### REACTIVE Mode

**Best for**: Experienced users, sensitive work, minimal distraction

The AI will:
- ✗ NOT show auto-suggestions
- ✗ NOT send proactive nudges
- ✗ NOT show contextual hints
- ✗ NOT initiate conversations

The AI will only respond when you explicitly ask a question.

### BALANCED Mode (Recommended)

**Best for**: Most users, daily work, moderate assistance

The AI will:
- ✓ Show helpful auto-suggestions
- ✓ Send occasional nudges (deadlines, risks)
- ✓ Display contextual hints
- ✗ NOT initiate conversations

The AI assists proactively but respects your workflow.

### PROACTIVE Mode

**Best for**: Learning, complex projects, maximum AI assistance

The AI will:
- ✓ Show active auto-suggestions
- ✓ Send frequent nudges and alerts
- ✓ Display continuous hints
- ✓ Start conversations about potential issues

The AI actively monitors and helps throughout your work.

---

## Testing AI Settings

### Testing SuperAdmin Settings

1. **Provider Fallback**
   - Disable the primary provider
   - Send a chat message
   - Verify fallback provider responds

2. **Rate Limits**
   - Set a low rate limit (e.g., 5/minute)
   - Send messages rapidly
   - Verify rate limit error appears

3. **PII Detection**
   - Set sensitivity to HIGH
   - Send a message with an email or phone number
   - Verify PII is detected/redacted

### Testing Organization Settings

1. **Policy Level**
   - Set policy to ADVISORY
   - Try to have AI create a task
   - Verify AI suggests but doesn't create

2. **Feature Toggles**
   - Disable Artifacts
   - Ask AI to generate code
   - Verify artifacts panel is hidden

3. **Budget Limits**
   - Set a low monthly budget
   - Check AI usage indicator
   - Verify freeze when exceeded (if enabled)

### Testing User Settings

1. **Proactivity Mode**
   - Set to REACTIVE
   - Navigate the app
   - Verify no auto-suggestions appear
   
   - Set to PROACTIVE
   - Work on a project
   - Verify nudges and suggestions appear

2. **Response Style**
   - Set to CONCISE, ask "What is PMO?"
   - Set to DETAILED, ask same question
   - Compare response lengths

3. **Model Parameters**
   - Set temperature to 0.1 (deterministic)
   - Ask same question twice
   - Verify similar responses
   
   - Set temperature to 1.5 (creative)
   - Ask same question twice
   - Verify varied responses

---

## Troubleshooting

### "AI not responding"

1. Check if organization budget is exceeded
2. Verify user hasn't hit daily call limit
3. Check provider health status (SuperAdmin → System Health)
4. Try refreshing the page

### "Proactivity mode not available"

Your organization has limited the maximum proactivity level. Contact your admin to request a higher level.

### "Settings not saving"

1. Check for unsaved changes indicator
2. Click "Save Changes" button explicitly
3. Verify no validation errors
4. Check network connection

### "AI responses too short/long"

1. Adjust **Response Style** (User Settings → Behavior)
2. Increase/decrease **Max Tokens**
3. Modify **System Instructions** to specify desired length

### "AI too creative/random"

1. Lower **Temperature** to 0.3-0.5
2. Lower **Top P** to 0.7
3. Increase **Frequency Penalty** to 0.5

### "AI not showing suggestions"

1. Check **Proactivity Mode** is BALANCED or PROACTIVE
2. Verify organization has auto-suggestions enabled
3. Check if you're in a supported view (chat, project editing)

---

## Quick Reference

| Setting | SuperAdmin | Admin | User |
|---------|:----------:|:-----:|:----:|
| Default Provider | ✓ | - | - |
| Global Limits | ✓ | - | - |
| PII Detection | ✓ | - | - |
| Policy Level | - | ✓ | - |
| AI Roles | - | ✓ | - |
| Budget Limits | - | ✓ | - |
| Feature Toggles | - | ✓ | - |
| Proactivity Mode | - | default | ✓ |
| Response Style | - | - | ✓ |
| Model Parameters | - | - | ✓ |
| Personal API Keys | - | - | ✓ |

---

*Last updated: January 2026*

