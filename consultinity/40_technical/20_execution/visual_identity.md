# Visual Identity & Premium AI Aesthetic

**Last Updated:** 1 January 2026  
**Standard:** McKinsey-Grade SaaS Design v1.0

This document codifies the "Premium AI Aesthetic" required for the Consultinity platform to ensure a world-class, professional impression that commands intellectual authority.

---

## 1. Design Philosophy
The UI must feel **Quiet, Expert, and Alive**. It avoids "Dashboard Fatigue" by prioritizing deep focus and micro-interactions over dense data grids.

### Core Tokens
| Dimension | Specification | Rationale |
| :--- | :--- | :--- |
| **Primary Color** | `hsl(232, 47%, 18%)` (Deep Indigo) | Evokes trust and stability. |
| **Accent Color** | `hsl(204, 94%, 50%)` (Electric Blue) | Used sparingly for CTAs and AI "Alive" states. |
| **Typography** | Headlines: **Outfit** (Serif-like authority); Body: **Inter** | Readability at scale. |
| **Surface** | Glassmorphism (Background blur: 12px) | Adds depth and modern feel. |

---

## 2. Interaction & Motion

### Micro-Animations
- **AI Thinking**: A subtle, 2px glowing border pulse when the AI is in `THINKING` state. Never use "cliché" brain or robot icons.
- **Surface Transitions**: 300ms `ease-in-out` for all modal and panel openings.
- **Hover States**: Elevation shift + `shadow-lg` on cards to indicate interactivity.

### The "Thinking Visualization" (Protocol)
When the AI streams responses, the UI must distinguish between:
1. **Thought Blocks**: Rendered in a distinct, slightly darker "Glass" container with `opacity-80`.
2. **Final Text**: Rendered in full contrast.
3. **Artifacts**: Rendered as interactive cards within the flow.

---

## 3. Light & Dark Mode Governance
The system must support automatic OS-level switching with zero layout shift.

- **Dark Mode**: High contrast text (`#FFFFFF`) on deep charcoal/navy bases. Avoid pure black (`#000000`) to reduce eye strain.
- **Light Mode**: Ultra-clean "Snow" base (`#F8FAFC`) with subtle gray borders (`#E2E8F0`). No harsh shadows.

---

## 4. UI Component Standards
1. **The Sidebar**: Mini-to-Full toggle. Must include the "Signalizator" (Priority health indicator).
2. **Modals**: Always centered with a backdrop blur. Never scroll independently of the body.
3. **Buttons**: Rounded (full), no gradients unless it's the primary "First Value" CTA.
