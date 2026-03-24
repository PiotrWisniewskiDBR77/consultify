# Canvas Mode — Design System Extension

> **Wersja:** 1.0  
> **Data:** 2026-03-12  
> **Status:** OBOWIĄZUJĄCY  
> **Cel:** Rozszerzenie DBR77 o "Canvas Mode" — tryb wizualny dla powierzchni doświadczenia (experience surfaces): landingi, Home tab, onboarding, showcase views.  
> **Lokalizacja:** `docs/ui-standards/00-foundation/canvas-mode.md`
>
> **Relacja do DBR77:** Canvas Mode **rozszerza** standard DBR77, nie zastępuje go. Elementy operational (tabele, formularze, settings) pozostają w pełni zgodne z visual-language.md.

---

## 1. Purpose

Canvas Mode is a design system extension for **inspirational and experience-oriented surfaces** that require a different feel from operational tables and forms. These surfaces aim to evoke emotion, delight, and a sense of possibility rather than efficiency and task completion.

**Key principle:** Canvas Mode extends DBR77 with more expressive visual treatments while maintaining consistency. The same design tokens, typography foundations, and interaction principles apply—but Canvas Mode relaxes certain constraints (e.g., borders, icon style, animation density) to support emotionally resonant experiences.

---

## 2. When to Use

**Use Canvas Mode for:**

- Landing pages
- Home tabs (e.g., My Work Home)
- Onboarding screens
- Showcase and portfolio views
- Welcome / greeting surfaces

**Do NOT use Canvas Mode for:**

- Data tables
- Forms and inputs
- Settings panels
- Operational workflows (task lists, interview flows, execution views)
- Module hubs with table/card content

**Rule:** If the screen is primarily for data entry, configuration, or task execution, use standard DBR77.

---

## 3. Background

Canvas Mode surfaces use an **animated gradient mesh** to create depth and atmosphere. The background establishes the emotional tone before any content is read.

### 3.1 Base and Gradient Blobs

- **Base:** `bg-navy-950` (DBR77 Layer 0 equivalent)
- **Gradient blobs:** 3–4 color blobs positioned as absolute elements
- **Animation:** Slow morph cycles (20–28 seconds per cycle) — subtle enough to avoid distraction
- **Blur:** `filter: blur(120px)` on each blob
- **Opacity:** `opacity-15` (0.15) — enough to add atmosphere without overwhelming content

### 3.2 CSS Example

```css
.canvas-mode-bg {
  position: relative;
  background-color: #0A0F1E; /* navy-950 */
  overflow: hidden;
}

.canvas-mode-bg::before,
.canvas-mode-bg::after {
  content: '';
  position: absolute;
  width: 60%;
  height: 60%;
  border-radius: 50%;
  filter: blur(120px);
  opacity: 0.15;
  animation: canvas-blob-morph 24s ease-in-out infinite;
}

.canvas-mode-bg::before {
  top: -20%;
  left: -10%;
  background: radial-gradient(circle, var(--primary-500) 0%, transparent 70%);
}

.canvas-mode-bg::after {
  bottom: -20%;
  right: -10%;
  background: radial-gradient(circle, #6366f1 0%, transparent 70%);
  animation-delay: -12s;
}

@keyframes canvas-blob-morph {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(2%, 2%) scale(1.05); }
  66% { transform: translate(-1%, -2%) scale(0.98); }
}
```

### 3.3 Tailwind Utility Pattern

```html
<div class="relative bg-navy-950 overflow-hidden">
  <div class="absolute -top-1/4 -left-1/4 w-[60%] h-[60%] rounded-full 
              bg-primary-500/20 blur-[120px] opacity-15 
              animate-[canvas-blob-morph_24s_ease-in-out_infinite]"></div>
  <div class="absolute -bottom-1/4 -right-1/4 w-[60%] h-[60%] rounded-full 
              bg-indigo-500/20 blur-[120px] opacity-15 
              animate-[canvas-blob-morph_24s_ease-in-out_infinite] animate-delay-[-12s]"></div>
  <!-- Content -->
</div>
```

---

## 4. Cards

Canvas Mode cards use **glassmorphism** to create a sense of floating, translucent surfaces that respond to light and depth.

### 4.1 Base Card Style

- **Backdrop blur:** `backdrop-blur-xl`
- **Background:** `bg-white/[0.03]` — subtle light overlay on dark base
- **Border:** `border border-white/[0.06]` — very soft edge definition
- **Radius:** `rounded-2xl` (16–24px, see Shapes section)

### 4.2 Hover State

- **Background:** `bg-white/[0.06]` — slightly brighter
- **Lift:** `translateY(-2px)` to `translateY(-4px)`
- **Shadow:** `shadow-xl` — allowed in Canvas Mode for cards (exception to DBR77 "shadow only on floating")
- **Transition:** `150–200ms ease-out`

### 4.3 CSS Example

```css
.canvas-card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 1rem;
  transition: transform 180ms ease-out, background-color 180ms ease-out, box-shadow 180ms ease-out;
}

.canvas-card:hover {
  background: rgba(255, 255, 255, 0.06);
  transform: translateY(-3px);
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.2);
}
```

### 4.4 Tailwind Classes

```html
<div class="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] rounded-2xl
            transition-all duration-200 ease-out
            hover:bg-white/[0.06] hover:-translate-y-1 hover:shadow-xl">
  <!-- Card content -->
</div>
```

---

## 5. Shapes

Canvas Mode uses **softer, more organic** shapes than standard DBR77.

### 5.1 Rounded Corners

| Element   | Canvas Mode | Standard DBR77 |
| --------- | ----------- | -------------- |
| Cards     | `rounded-2xl` (16px) to `rounded-3xl` (24px) | `rounded-xl` (12px) |
| Containers| `rounded-2xl` | `rounded-xl` |
| Buttons   | `rounded-xl` to `rounded-2xl` | `rounded-lg` |

### 5.2 Organic Blob Shapes

Decorative blob shapes are allowed as **background or accent elements** (not structural containers):

- Use `rounded-[40%_60%_70%_30%/60%_40%_60%_40%]` or similar for organic asymmetry
- Keep blobs low opacity and behind content
- Do not use blobs for interactive elements

```css
.canvas-blob-accent {
  width: 200px;
  height: 200px;
  border-radius: 40% 60% 70% 30% / 60% 40% 60% 40%;
  background: radial-gradient(circle, var(--primary-500) 0%, transparent 70%);
  opacity: 0.08;
  filter: blur(40px);
}
```

---

## 6. Colors per Zone

Canvas Mode uses **semantic color zones** to guide emotional response. These map to functional areas rather than arbitrary decoration.

### 6.1 Zone Palettes

| Zone type       | Palette          | Use case                         | Example colors                          |
| --------------- | ---------------- | -------------------------------- | --------------------------------------- |
| Creative        | Warm (amber/orange/rose) | Spark zones, ideation, inspiration | `amber-500`, `orange-400`, `rose-400` |
| Information     | Cool (indigo/cyan)      | Data, stats, World Pulse          | `indigo-400`, `cyan-400`, `blue-400`   |
| AI / Brief      | Neutral (primary gradient) | AI Companion, Morning Brief    | `primary-500`, `primary-400`           |

### 6.2 Constraints

- **One dominant zone color** per card or section — avoid mixing warm and cool in the same card
- **Opacity for accents:** Use `/[0.1]` to `/[0.2]` for backgrounds; full color only for small accents (icon, dot)
- **Text remains DBR77:** Primary text `text-slate-100`, secondary `text-slate-400`

### 6.3 Example Zone Styling

```html
<!-- Creative zone card -->
<div class="canvas-card border-amber-500/10 bg-amber-500/[0.03]">
  <!-- warm accent -->
</div>

<!-- Information zone card -->
<div class="canvas-card border-indigo-500/10 bg-indigo-500/[0.03]">
  <!-- cool accent -->
</div>

<!-- AI/Brief zone card -->
<div class="canvas-card border-primary-500/10 bg-primary-500/[0.03]">
  <!-- primary gradient accent -->
</div>
```

---

## 7. Typography

Same font family as DBR77 (Plus Jakarta Sans or Inter from `font-sans`), but with a **larger scale** for hero content.

### 7.1 Scale

| Role           | Standard DBR77 | Canvas Mode      |
| -------------- | -------------- | ---------------- |
| Hero heading  | `text-lg` / `text-xl` | `text-2xl` / `text-3xl` |
| Section title | `text-base` / `text-sm` | `text-lg` / `text-xl` |
| Body          | `text-sm`      | `text-sm` or `text-base` |
| Greeting      | —              | Serif accent font |

### 7.2 Serif Accent Font

**Instrument Serif** (or similar) is allowed for greeting text (e.g., "Good morning, Piotr") to add warmth and personality.

- Use sparingly: max 1–2 lines per screen
- Load as secondary font; do not replace `font-sans` globally

```css
.font-canvas-greeting {
  font-family: 'Instrument Serif', Georgia, serif;
}

/* In Tailwind config: extend fontFamily */
fontFamily: {
  serif: ['Instrument Serif', 'Georgia', 'serif'],
}
```

```html
<h1 class="font-serif text-2xl text-slate-100">Good morning, Piotr</h1>
```

### 7.3 Weight

- Hero headings: `font-semibold` (never `font-bold`)
- Section titles: `font-semibold`
- Body: `font-normal` or `font-medium`

---

## 8. Icons

In Canvas Mode, **duotone gradient fills** are allowed for icons that serve as primary visual anchors (e.g., zone headers, feature icons).

### 8.1 Standard DBR77 vs Canvas Mode

| Aspect       | Standard DBR77   | Canvas Mode                     |
| ------------ | ---------------- | ------------------------------- |
| Style        | Outline only     | Outline or duotone gradient     |
| Color        | `text-muted`     | Gradient fill allowed           |
| Context      | Nav, toolbar, actions | Hero icons, zone headers  |

### 8.2 Duotone Gradient Pattern

```css
.canvas-icon-duotone {
  background: linear-gradient(135deg, var(--primary-400) 0%, var(--primary-600) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

/* Or for SVG icon with two-tone fill */
.canvas-icon-svg-duotone {
  /* Primary path: fill with gradient stop 1 */
  /* Secondary path: fill with gradient stop 2, opacity 0.6 */
}
```

### 8.3 When to Use Duotone

- Zone/section header icons
- Feature callouts on Home
- Onboarding step icons

**Do NOT use duotone** for action buttons, navigation, or operational controls — those remain outline, `text-muted`.

---

## 9. Animations

Canvas Mode allows **slightly more animation** than standard DBR77, but animations must remain subtle and purposeful.

### 9.1 Staggered Fade-in

- Delay between elements: `0.1s` to `0.15s`
- Use for initial load of card grid or list

```css
.canvas-stagger > * {
  animation: canvas-fade-in 0.5s ease-out forwards;
}

.canvas-stagger > *:nth-child(1) { animation-delay: 0ms; }
.canvas-stagger > *:nth-child(2) { animation-delay: 100ms; }
.canvas-stagger > *:nth-child(3) { animation-delay: 200ms; }
/* ... */
```

### 9.2 Slide-in-from-bottom

- Small offset: `translateY(1rem)` (16px) from bottom
- Duration: `300–400ms`
- Easing: `ease-out`

```css
@keyframes canvas-slide-up {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### 9.3 Hover: Lift + Glow

- Lift: `translateY(-2px)` to `translateY(-4px)`
- Glow: Optional subtle `box-shadow` with primary or zone color at low opacity

```css
.canvas-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 0 30px rgba(124, 58, 237, 0.15);
}
```

### 9.4 Constraints

- **Reduce motion:** Respect `prefers-reduced-motion: reduce` — disable or simplify animations
- **No parade:** Avoid animating more than 4–6 elements in quick succession
- **Duration:** Keep under 400ms for entrance/exit; background blob animation is the only long-duration exception

---

## 10. Dark Mode

Canvas Mode is **dark-mode-first**. The gradient mesh, glassmorphism, and zone accents are designed for `bg-navy-950` and light-over-dark surfaces.

### 10.1 Light Mode Adaptations

When Canvas Mode is used in light mode:

- **Gradient blobs:** Reduce opacity to `0.08`–`0.1` (from 0.15)
- **Card glass:** Use `bg-slate-900/[0.03]` or `bg-black/[0.02]` instead of `bg-white/[0.03]` to maintain depth
- **Border:** `border-slate-200/50` instead of `border-white/[0.06]`
- **Base:** `bg-slate-50` or `bg-slate-100` for Layer 0

```html
<div class="dark:bg-navy-950 bg-slate-50">
  <div class="dark:bg-white/[0.03] bg-slate-900/[0.03] 
              dark:border-white/[0.06] border-slate-200/50
              backdrop-blur-xl rounded-2xl">
    <!-- Content -->
  </div>
</div>
```

---

## 11. Constraints and Compatibility

### 11.1 Do Not Break DBR77 Adjacency

Canvas Mode elements must **not break** when placed alongside standard DBR77 components. Examples:

- Home tab with Canvas cards **above** a standard table: the table must render with full DBR77 compliance
- Sidebar remains standard DBR77; only the main content area may use Canvas Mode

### 11.2 Transition Zones

Where Canvas Mode meets operational UI (e.g., "View all ideas" linking to Ideas table):

- Use **standard DBR77 styling** for the transition element (button, link)
- Avoid mixing glassmorphism cards with a glassmorphism transition button — use a standard ghost or outline button

### 11.3 Checklist Before Merge

- [ ] Screen type is experience surface (Home, landing, onboarding, showcase) — not operational
- [ ] Background uses navy-950 base + gradient blobs with blur 120px, opacity 0.15
- [ ] Cards use glassmorphism (backdrop-blur-xl, bg-white/[0.03], border white/[0.06])
- [ ] Rounded corners 16–24px for cards
- [ ] Zone colors applied consistently (warm/cool/neutral per section)
- [ ] Typography: hero text-2xl/text-3xl, serif only for greeting
- [ ] Icons: duotone only for zone/hero; outline for actions
- [ ] Animations subtle, staggered, respect prefers-reduced-motion
- [ ] Dark mode default; light mode uses reduced-opacity gradients
- [ ] Transition to operational UI uses standard DBR77 styling

---

## 12. Living Transformation Screens

Canvas Mode V2 adds a stricter pattern for screens like `My Work > Home`, where the surface is not just inspirational but also dynamically informative.

### 12.1 Use Case

Use this variant for:

- AI-first home screens
- transformation desktops
- signal orchestration surfaces

Do not use it for:

- normal dashboards with static KPI tiles
- operational monitoring
- general-purpose module hubs

### 12.2 Required Behaviours

Living transformation screens should support:

- `timeMode` state shifts (`morning`, `liveDay`, `eveningWrap`)
- dynamic block emphasis using size / glow / freshness accents
- ambient motion that reflects signal intensity
- a clear hero block plus secondary blocks
- a persistent bridge to chat and major modules

### 12.3 Layout Rules

- The screen must have one dominant hero block.
- Supporting blocks may grow or shrink, but only within predefined `sm / md / lg / hero` sizes.
- Dynamic resizing must preserve readability first.
- `commandDock`-style action surfaces should remain visually stable even when other blocks change emphasis.
- Never let more than 2 blocks compete for hero-level visual dominance.

### 12.4 Industry-Lens Rule

If a living transformation screen shows external context, it must frame it as:

- market signal
- technology signal
- benchmark
- peer case
- implication for the user

It must not imply live operational visibility unless an actual integration exists.

---

## Quick Reference

| Token        | Value                           |
| ------------ | ------------------------------- |
| Base bg      | `bg-navy-950`                   |
| Blob blur    | `blur-[120px]`                  |
| Blob opacity | `opacity-15`                    |
| Card bg      | `bg-white/[0.03]`               |
| Card border  | `border-white/[0.06]`           |
| Card radius  | `rounded-2xl` / `rounded-3xl`   |
| Hover bg     | `bg-white/[0.06]`               |
| Hover lift   | `-translate-y-1` to `-translate-y-2` |
| Stagger delay| `100ms`–`150ms`                 |
