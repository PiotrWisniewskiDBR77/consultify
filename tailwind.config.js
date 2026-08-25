// VA0.5 - alpha-enabled token colors: solid = var(--c-X) (jak dotad), /NN = rgb(var(--c-X-rgb) / alpha)
// Tailwind's built-in color-opacity plugins (bg/text/border/ring/divide) never call this with
// opacityValue undefined for the no-modifier case — they always pass the CSS var default,
// e.g. 'var(--tw-bg-opacity, 1)'. Without matching that sentinel the bare class falls into the
// rgb()/alpha branch and tokens with a baked-in alpha in --c-X (like --c-accent-soft, 0.08/0.14)
// render fully opaque (full crimson) instead of their intended soft tint. The /NN modifier path
// is unaffected — it still receives a numeric opacityValue and resolves via -rgb.
const cTok =
  (name) =>
  ({ opacityValue }) =>
    opacityValue === undefined ||
    (typeof opacityValue === 'string' && opacityValue.indexOf('var(--tw-') === 0)
      ? 'var(--c-' + name + ')'
      : 'rgb(var(--c-' + name + '-rgb) / ' + opacityValue + ')';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    './dev-render/**/*.{js,ts,jsx,tsx,html}', // dev-only render harness (never ships)
    './views/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './App.tsx',
  ],
  darkMode: 'class',
  theme: {
    screens: {
      xs: '375px', // Small mobile (iPhone SE)
      sm: '640px', // Large mobile
      md: '768px', // Tablet portrait
      lg: '1024px', // Tablet landscape / Desktop
      xl: '1280px', // Desktop
      '2xl': '1536px', // Large desktop
      // Custom aliases for semantic usage
      mobile: { max: '767px' }, // Mobile only
      tablet: { min: '768px', max: '1023px' }, // Tablet only
      touch: { max: '1023px' }, // Mobile + Tablet (touch devices)
      desktop: '1024px', // Desktop and up
    },
    extend: {
      // ========================================
      // CANONICAL Z-INDEX SCALE (overlay layering)
      // Single source of truth for portal/overlay stacking.
      // Rule (editor-shell-canon §3): app-chrome > overlay-menu > canvas-nodes > canvas-bg.
      // Context menu is portaled to <body> and sits ABOVE everything.
      // Usage: z-dropdown, z-modal, z-toast, z-context-menu (never raw z-[9999]).
      //   canvas         (10)  — canvas nodes / in-flow raised content
      //   sticky         (20)  — sticky headers, command rows, chrome bars
      //   dropdown       (40)  — dropdowns, popovers, selects, tooltips (menus over chrome)
      //   overlay        (50)  — modal/drawer backdrop scrim
      //   modal          (60)  — dialog / drawer / sheet panels (above scrim)
      //   toast         (100)  — toast notifications (above modals)
      //   context-menu  (120)  — context menus portaled to body (above all)
      // ========================================
      zIndex: {
        canvas: '10',
        sticky: '20',
        dropdown: '40',
        overlay: '50',
        modal: '60',
        toast: '100',
        'context-menu': '120',
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        // ========================================
        // CANONICAL SEMANTIC PALETTE (`c.*` namespace)
        // Single source of truth → CSS vars in src/index.css (:root / .dark).
        // Spec: docs/audit/2026-06-03/_DESIGN_SYSTEM_STANDARDIZATION_PLAN.md §A
        // Values are hex/rgba (not space-separated rgb), so consume directly:
        //   bg-c-surface, text-c-text, border-c-border, bg-c-accent, etc.
        // Apple/Google-class neutral surfaces + Harvard Crimson sole accent.
        // ========================================
        c: {
          bg: cTok('bg'),
          surface: cTok('surface'),
          'surface-raised': cTok('surface-raised'),
          'surface-hover': cTok('surface-hover'),
          'surface-subtle': cTok('surface-subtle'),
          'border-subtle': cTok('border-subtle'),
          border: cTok('border'),
          'border-strong': cTok('border-strong'),
          text: cTok('text'),
          'text-secondary': cTok('text-secondary'),
          'text-muted': cTok('text-muted'),
          accent: cTok('accent'),
          'accent-soft': cTok('accent-soft'),
          focus: cTok('focus'),
          'focus-solid': cTok('focus-solid'),
          success: cTok('success'),
          warning: cTok('warning'),
          danger: cTok('danger'),
          info: cTok('info'),
          // AI — kolor SYSTEMOWY sztucznej inteligencji (standard n-Type §4.6):
          // przycisk AI w nagłówku, „Analizuj z AI", ikony AI przy polach, panel
          // sugestii, oznaczenia treści wygenerowanej przez AI. Fiolet świadomie
          // ODDZIELNY od sygnałów (success/warning/danger/info) i od crimson —
          // „to zrobiła AI" nie jest stanem obiektu ani marką.
          ai: cTok('ai'),
          // Identity palette (12) — kolory DANYCH/kategorii/serii (NIGDY crimson jako dana).
          // Vars zdefiniowane w src/index.css (:root light + .dark). Reguła §15.1: ≤5 serii widocznych.
          'tag-1': cTok('tag-1'),
          'tag-2': cTok('tag-2'),
          'tag-3': cTok('tag-3'),
          'tag-4': cTok('tag-4'),
          'tag-5': cTok('tag-5'),
          'tag-6': cTok('tag-6'),
          'tag-7': cTok('tag-7'),
          'tag-8': cTok('tag-8'),
          'tag-9': cTok('tag-9'),
          'tag-10': cTok('tag-10'),
          'tag-11': cTok('tag-11'),
          'tag-12': cTok('tag-12'),
          // Foreground for text/icon ON a filled tag or chart swatch (AA white in both themes).
          'tag-foreground': cTok('tag-foreground'),
          // ---- Chart-series ramp (8) — ORDERED series for line/bar/area charts. ----
          // Distinct role from tag-*: tags = equal-weight category dots (any order);
          // chart-* = an ordered sequence (series 1,2,3…), blue-first, NEVER red-first.
          // Vars in src/index.css (:root light + .dark).
          'chart-1': cTok('chart-1'),
          'chart-2': cTok('chart-2'),
          'chart-3': cTok('chart-3'),
          'chart-4': cTok('chart-4'),
          'chart-5': cTok('chart-5'),
          'chart-6': cTok('chart-6'),
          'chart-7': cTok('chart-7'),
          'chart-8': cTok('chart-8'),
        },
        // ========================================================================
        // VF0-6 STATE-LAYER TOKENS (color-mix) — see src/index.css `--state-*`.
        // Plain values (not the `cTok` opacity-aware helper): the alpha is already
        // baked into the color-mix formula, so no `/NN` modifier is expected.
        // Usage: bg-state-hover, hover:bg-state-hover, active:bg-state-press,
        // bg-state-selected. NOT applied to `c.*` because these are UI-state
        // overlays (interaction feedback), not the semantic content palette.
        // ========================================================================
        state: {
          hover: 'var(--state-hover)',
          press: 'var(--state-press)',
          selected: 'var(--state-selected)',
        },
        // ========================================================================
        // DATA-PALETTE DECISION GUIDE — kiedy c-tag vs c-chart vs c-accent (brand)?
        //   • c-accent (crimson/brand): TYLKO brand/CTA/selected — NIGDY jako dana,
        //     seria wykresu, ani kolor kategorii. Crimson w danych = dług (VA-B sweep).
        //   • c-success/warning/danger/info: SYGNAŁ (status/alarm/kierunek), nie kategoria.
        //   • c-tag-1..12: KATEGORIA/TYP/ŹRÓDŁO — równoważne, bezkolejnościowe „kropki"
        //     (chipy statusu-jako-typ, etykiety, tagi). ≤5 widocznych serii (§15.1).
        //   • c-chart-1..8: SERIE WYKRESU — kolejność ma znaczenie (seria 1,2,3…);
        //     blue-first, nigdy red-first. Recharts/SVG: rozwiązuj hex przez
        //     financeChartTokens.ts / assessmentChartTokens.ts (var() nie działa w fill).
        //   • c-tag-foreground: biały tekst/ikona NA wypełnionym swatchu (AA oba tryby).
        // ========================================================================
        // ========================================
        // DBR77 COLOR SYSTEM STANDARD
        // See: docs/00_foundation/COLOR_SYSTEM_STANDARD.md
        // ========================================

        // ========================================
        // BRAND ACCENT — Harvard Crimson
        // Canonical CTA / brand accent (replaces violet primary for CTAs).
        // #85182F = 600/DEFAULT brand value. NO Harvard logo usage.
        // See: docs/plans/cross-cutting/PLAN_X1_design_system.md
        // ========================================
        crimson: {
          DEFAULT: '#85182F', // brand canonical — key CTAs, Teresa, brand moments
          50: '#FDF2F3',
          100: '#FBDDE0',
          200: '#F6B8BE',
          300: '#EF8A94',
          400: '#E45868',
          500: '#A82D49', // accessible on white, WCAG AA
          600: '#85182F', // brand canonical (#85182F)
          700: '#6D1427',
          800: '#651120',
          900: '#450C16',
          950: '#2B070D',
        },

        // NEUTRAL - Navy-based grays (tła, ramki, tekst)
        // Updated for softer dark mode appearance (HIG refinement)
        navy: {
          950: '#0A0F1E', // Deepest background - Main App BG (softer than pure black)
          900: '#0F172A', // Panel background - Secondary BG (warmer, less harsh)
          850: '#111827', // Lighter panels
          800: '#151E32', // Card background
          700: '#2A3655', // Borders/Separators
          600: '#374151', // Hover states
          500: '#475569', // Muted text
          400: '#64748B', // Labels, placeholders
          300: '#94A3B8', // Hints, disabled
          200: '#CBD5E1', // Light borders
          100: '#E2E8F0', // Hover bg
          50: '#F1F5F9', // Subtle bg
        },

        // PRIMARY — Harvard Crimson (CENTRAL RECOLOR LEVER)
        // Was violet (#7C3AED). Re-pointed to crimson so all existing
        // primary-* / bg-primary CTAs render the brand accent app-wide with
        // ZERO call-site edits. Numeric stops mirror the `crimson` scale.
        // Spec: _DESIGN_SYSTEM_STANDARDIZATION_PLAN.md §A "demote violet".
        // Reversible: restore violet hexes here to revert.
        primary: {
          DEFAULT: '#85182F', // was #7C3AED
          hover: '#6D1427', // was #6D28D9
          light: '#A82D49', // was #8B5CF6
          surface: 'rgba(133, 24, 47, 0.1)', // was rgba(124,58,237,.1)
          50: '#FDF2F3',
          100: '#FBDDE0',
          200: '#F6B8BE',
          300: '#EF8A94',
          400: '#E45868',
          500: '#A82D49',
          600: '#85182F',
          700: '#6D1427',
          800: '#651120',
          900: '#450C16',
          950: '#2B070D',
        },

        // SECONDARY - Granatowy (akcje drugorzędne, nawigacja)
        secondary: {
          DEFAULT: '#1E3A5F',
          hover: '#0F2744',
          light: '#2E4A6F',
          surface: 'rgba(30, 58, 95, 0.1)',
          900: '#0F2744',
          800: '#1E3A5F',
          700: '#2E4A6F',
          600: '#3E5A7F',
          500: '#4E6A8F',
          400: '#6E8AAF',
          300: '#8EAACF',
          200: '#AECAEF',
          100: '#DEEAFF',
          50: '#F0F5FF',
        },

        // DANGER - Harvard Red (TYLKO: błędy, usuwanie, alarm)
        // Re-anchored to HBS Red. 700 #910A28 = AA text on white; kept distinct
        // from Crimson #85182F so error never reads as brand. was emerald/rose mix.
        danger: {
          DEFAULT: '#E80538', // was #DC2626 (HBS Red 2)
          hover: '#C1042F', // was #B91C1C
          light: '#ED5541', // was #EF4444 (HBS Red 3)
          surface: 'rgba(232, 5, 56, 0.1)', // was rgba(220,38,38,.1)
          900: '#490514', // was #7F1D1D
          800: '#6D081E', // was #991B1B
          700: '#910A28', // was #B91C1C — AA text on white
          600: '#C1042F', // was #DC2626
          500: '#E80538', // was #EF4444
          400: '#ED5541', // was #F87171
          300: '#E0B2A7', // was #FCA5A5 (HBS Red 4)
          200: '#F4BAAB', // was #FECACA
          100: '#FBDED5', // was #FEE2E2
          50: '#FDF1ED', // was #FEF2F2
        },

        // SUCCESS - Harvard Green (TYLKO: status aktywny, potwierdzenia)
        // Re-anchored to HBS Green. 700 #026833 = AA on white (~7:1).
        success: {
          DEFAULT: '#52A52E', // was #059669 (HBS Green 2)
          hover: '#388A22', // was #047857
          light: '#9EC44D', // was #10B981 (HBS Green 3)
          surface: 'rgba(82, 165, 46, 0.1)', // was rgba(5,150,105,.1)
          900: '#01371B', // was #064E3B
          800: '#024F26', // was #065F46
          700: '#026833', // was #047857 — AA text on white (HBS Green 1)
          600: '#388A22', // was #059669
          500: '#52A52E', // was #10B981
          400: '#9EC44D', // was #34D399
          300: '#B3D56A', // was #6EE7B7 (HBS Green 4)
          200: '#C7E69F', // was #A7F3D0
          100: '#E2F2D2', // was #D1FAE5
          50: '#F3FAEC', // was #ECFDF5
        },

        // LEGACY ALIASES (for backwards compatibility)
        // `brand` was the legacy violet (#7C3AED) scale; re-pointed to crimson
        // so any leftover `bg-brand-*` / `text-brand-*` call sites render the
        // current brand accent. Reversible: restore violet hexes to revert.
        brand: {
          DEFAULT: '#85182F', // was #7C3AED
          hover: '#6D1427', // was #6D28D9
          surface: 'rgba(133, 24, 47, 0.1)', // was rgba(124,58,237,.1)
          50: '#FDF2F3', // was #F5F3FF
          100: '#FBDDE0', // was #EDE9FE
          200: '#F6B8BE', // was #DDD6FE
          300: '#EF8A94', // was #C4B5FD
          400: '#E45868', // was #A78BFA
          500: '#A82D49', // was #8B5CF6
          600: '#85182F', // was #7C3AED
          700: '#6D1427', // was #6D28D9
          800: '#651120', // was #5B21B6
          900: '#450C16', // was #4C1D95
          950: '#2B070D', // was #2E1065
        },
        dbr77: {
          DEFAULT: '#0B1121',
          light: '#151E32',
          lighter: '#1E293B',
        },

        // ========================================
        // HARVARD COMPLEMENTARY (HBS identity)
        // Official HBS palette anchors: ~500 ≈ official "2" hex; ~700/800 dark
        // family member (AA-legible on white); 50–200 tints for backgrounds.
        // Spec: docs/audit/2026-06-03/HARVARD_COLOR_REMAP_AUDIT.md
        // Source: identity.hbs.edu (HBS official complementary palette).
        // ========================================
        'hbs-blue': {
          50: '#F2F5FC',
          100: '#E1E8F5',
          200: '#C9D6EC',
          300: '#AAC8EB', // HBS Blue 4 (official light)
          400: '#7FA4D1', // HBS Blue 3 (official)
          500: '#6578B4', // HBS Blue 2 (official mid)
          600: '#4F62A2',
          700: '#3B2883', // HBS Blue 1 (official dark — AA on white)
          800: '#2E1F66',
          900: '#1F1547',
          950: '#120C2A',
        },
        'hbs-green': {
          50: '#F3FAEC',
          100: '#E2F2D2',
          200: '#C7E69F',
          300: '#B3D56A', // HBS Green 4 (official)
          400: '#9EC44D', // HBS Green 3 (official)
          500: '#52A52E', // HBS Green 2 (official mid)
          600: '#388A22',
          700: '#026833', // HBS Green 1 (official dark — AA on white)
          800: '#024F26',
          900: '#01371B',
          950: '#001F0F',
        },
        'hbs-teal': {
          50: '#EEFAF8',
          100: '#D6F2EE',
          200: '#9BD6C4', // HBS Teal 4 (official)
          300: '#6FCBC2',
          400: '#56BAB3', // HBS Teal 3 (official)
          500: '#00979D', // HBS Teal 2 (official mid)
          600: '#007F8E',
          700: '#006085', // HBS Teal 1 (official dark — AA on white)
          800: '#004A66',
          900: '#003447',
          950: '#001E29',
        },
        'hbs-orange': {
          50: '#FEF6EC',
          100: '#FCE9CC',
          200: '#F9D49A',
          300: '#F7C76B', // HBS Orange 4 (official)
          400: '#EA9B20', // HBS Orange 3 (official)
          500: '#E87D1E', // HBS Orange 2 (official mid)
          600: '#C66A1B',
          700: '#AE6429', // HBS Orange 1 (official dark — AA-ish on white)
          800: '#834A1F',
          900: '#583214',
          950: '#2D190A',
        },
        'hbs-gold': {
          50: '#FEFCE6',
          100: '#FBF6B5',
          200: '#F8F088',
          300: '#F4EF6B', // HBS Yellow 4 (official)
          400: '#F3E44D', // HBS Yellow 3 (official)
          500: '#EBCD00', // HBS Yellow 2 (official mid)
          600: '#D6B900',
          700: '#C29D00', // HBS Yellow 1 (official dark — AA on white)
          800: '#8F7300',
          900: '#5E4B00',
          950: '#2E2400',
        },
        'hbs-purple': {
          50: '#F6F1F8',
          100: '#ECDDF0',
          200: '#D9BBE1',
          300: '#C6B2D1', // HBS Purple 4 (official light)
          400: '#9B7FAF', // HBS Purple 3 (official)
          500: '#80408D', // HBS Purple 2 (official mid)
          600: '#6B3079',
          700: '#57116A', // HBS Purple 1 (official dark — AA on white)
          800: '#430C51',
          900: '#2E0838',
          950: '#1A041F',
        },
        'hbs-magenta': {
          50: '#FCEEF4',
          100: '#F8D2E2',
          200: '#F1A6C5',
          300: '#E599BA', // HBS Magenta 4 (official light)
          400: '#D86199', // HBS Magenta 3 (official)
          500: '#C9006B', // HBS Magenta 2 (official mid)
          600: '#A30057',
          700: '#78244C', // HBS Magenta 1 (official dark — AA on white)
          800: '#5C1B3A',
          900: '#3F1228',
          950: '#220A16',
        },
        'hbs-red': {
          50: '#FDF1ED',
          100: '#FBDED5',
          200: '#F4BAAB',
          300: '#E0B2A7', // HBS Red 4 (official)
          400: '#ED5541', // HBS Red 3 (official)
          500: '#E80538', // HBS Red 2 (official mid)
          600: '#C1042F',
          700: '#910A28', // dark variant (AA on white) — keep distinct from crimson #85182F
          800: '#6D081E',
          900: '#490514',
          950: '#26020A',
        },

        // ========================================
        // CENTRAL REMAP — arbitrary Tailwind accent families → Harvard hues.
        // Re-points Tailwind defaults so existing class-sites recolor with ZERO
        // call-site edits. Structural neutrals (slate/gray/zinc/neutral/stone)
        // + brand (crimson, primary, navy) are NOT remapped.
        // Each scale keeps 600/700/800 dark enough for AA text on white.
        // Reversible: delete this block to restore Tailwind defaults.
        // ========================================

        // indigo / violet / purple → HBS Purple
        indigo: {
          50: '#F6F1F8',
          100: '#ECDDF0',
          200: '#D9BBE1',
          300: '#C6B2D1',
          400: '#9B7FAF',
          500: '#80408D',
          600: '#6B3079',
          700: '#57116A',
          800: '#430C51',
          900: '#2E0838',
          950: '#1A041F',
        },
        violet: {
          50: '#F6F1F8',
          100: '#ECDDF0',
          200: '#D9BBE1',
          300: '#C6B2D1',
          400: '#9B7FAF',
          500: '#80408D',
          600: '#6B3079',
          700: '#57116A',
          800: '#430C51',
          900: '#2E0838',
          950: '#1A041F',
        },
        purple: {
          50: '#F6F1F8',
          100: '#ECDDF0',
          200: '#D9BBE1',
          300: '#C6B2D1',
          400: '#9B7FAF',
          500: '#80408D',
          600: '#6B3079',
          700: '#57116A',
          800: '#430C51',
          900: '#2E0838',
          950: '#1A041F',
        },

        // fuchsia / pink → HBS Magenta
        fuchsia: {
          50: '#FCEEF4',
          100: '#F8D2E2',
          200: '#F1A6C5',
          300: '#E599BA',
          400: '#D86199',
          500: '#C9006B',
          600: '#A30057',
          700: '#78244C',
          800: '#5C1B3A',
          900: '#3F1228',
          950: '#220A16',
        },
        pink: {
          50: '#FCEEF4',
          100: '#F8D2E2',
          200: '#F1A6C5',
          300: '#E599BA',
          400: '#D86199',
          500: '#C9006B',
          600: '#A30057',
          700: '#78244C',
          800: '#5C1B3A',
          900: '#3F1228',
          950: '#220A16',
        },

        // blue / sky → HBS Blue
        blue: {
          50: '#F2F5FC',
          100: '#E1E8F5',
          200: '#C9D6EC',
          300: '#AAC8EB',
          400: '#7FA4D1',
          500: '#6578B4',
          600: '#4F62A2',
          700: '#3B2883',
          800: '#2E1F66',
          900: '#1F1547',
          950: '#120C2A',
        },
        sky: {
          50: '#F2F5FC',
          100: '#E1E8F5',
          200: '#C9D6EC',
          300: '#AAC8EB',
          400: '#7FA4D1',
          500: '#6578B4',
          600: '#4F62A2',
          700: '#3B2883',
          800: '#2E1F66',
          900: '#1F1547',
          950: '#120C2A',
        },

        // emerald / green / lime → HBS Green
        emerald: {
          50: '#F3FAEC',
          100: '#E2F2D2',
          200: '#C7E69F',
          300: '#B3D56A',
          400: '#9EC44D',
          500: '#52A52E',
          600: '#388A22',
          700: '#026833',
          800: '#024F26',
          900: '#01371B',
          950: '#001F0F',
        },
        green: {
          50: '#F3FAEC',
          100: '#E2F2D2',
          200: '#C7E69F',
          300: '#B3D56A',
          400: '#9EC44D',
          500: '#52A52E',
          600: '#388A22',
          700: '#026833',
          800: '#024F26',
          900: '#01371B',
          950: '#001F0F',
        },
        lime: {
          50: '#F3FAEC',
          100: '#E2F2D2',
          200: '#C7E69F',
          300: '#B3D56A',
          400: '#9EC44D',
          500: '#52A52E',
          600: '#388A22',
          700: '#026833',
          800: '#024F26',
          900: '#01371B',
          950: '#001F0F',
        },

        // teal / cyan → HBS Teal
        teal: {
          50: '#EEFAF8',
          100: '#D6F2EE',
          200: '#9BD6C4',
          300: '#6FCBC2',
          400: '#56BAB3',
          500: '#00979D',
          600: '#007F8E',
          700: '#006085',
          800: '#004A66',
          900: '#003447',
          950: '#001E29',
        },
        cyan: {
          50: '#EEFAF8',
          100: '#D6F2EE',
          200: '#9BD6C4',
          300: '#6FCBC2',
          400: '#56BAB3',
          500: '#00979D',
          600: '#007F8E',
          700: '#006085',
          800: '#004A66',
          900: '#003447',
          950: '#001E29',
        },

        // amber / orange → HBS Orange
        amber: {
          50: '#FEF6EC',
          100: '#FCE9CC',
          200: '#F9D49A',
          300: '#F7C76B',
          400: '#EA9B20',
          500: '#E87D1E',
          600: '#C66A1B',
          700: '#AE6429',
          800: '#834A1F',
          900: '#583214',
          950: '#2D190A',
        },
        orange: {
          50: '#FEF6EC',
          100: '#FCE9CC',
          200: '#F9D49A',
          300: '#F7C76B',
          400: '#EA9B20',
          500: '#E87D1E',
          600: '#C66A1B',
          700: '#AE6429',
          800: '#834A1F',
          900: '#583214',
          950: '#2D190A',
        },

        // yellow → HBS Gold
        yellow: {
          50: '#FEFCE6',
          100: '#FBF6B5',
          200: '#F8F088',
          300: '#F4EF6B',
          400: '#F3E44D',
          500: '#EBCD00',
          600: '#D6B900',
          700: '#C29D00',
          800: '#8F7300',
          900: '#5E4B00',
          950: '#2E2400',
        },

        // rose / red → HBS Red
        // NOTE: kept distinct from Harvard Crimson (#85182F) brand accent so
        // "danger" never reads as "brand". 700 = #910A28 for AA text on white.
        rose: {
          50: '#FDF1ED',
          100: '#FBDED5',
          200: '#F4BAAB',
          300: '#E0B2A7',
          400: '#ED5541',
          500: '#E80538',
          600: '#C1042F',
          700: '#910A28',
          800: '#6D081E',
          900: '#490514',
          950: '#26020A',
        },
        red: {
          50: '#FDF1ED',
          100: '#FBDED5',
          200: '#F4BAAB',
          300: '#E0B2A7',
          400: '#ED5541',
          500: '#E80538',
          600: '#C1042F',
          700: '#910A28',
          800: '#6D081E',
          900: '#490514',
          950: '#26020A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Inter', 'sans-serif'], // UI display headings — keep Inter until serif decision finalised
        // Editorial / brand-moment serif — ONLY for deliverable covers & landing hero, never product UI.
        serif: ["'Playfair Display'", 'Georgia', 'serif'],
        japanese: ['Noto Sans JP', 'Inter', 'sans-serif'], // Japanese font with full character support
      },
      boxShadow: {
        // Legacy shadows — brand glow re-pointed violet → crimson
        glow: '0 0 20px -5px rgba(133, 24, 47, 0.3)',
        'glow-lg': '0 0 40px -10px rgba(133, 24, 47, 0.5)',
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        panel: '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.15)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',

        // ========================================
        // APPLE HIG DEPTH SYSTEM
        // Replaces flat borders with subtle shadows
        // ========================================
        'hig-xs': '0 1px 2px rgba(0, 0, 0, 0.03), 0 1px 1px rgba(0, 0, 0, 0.04)',
        'hig-sm': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.06)',
        'hig-md': '0 4px 6px rgba(0, 0, 0, 0.04), 0 2px 4px rgba(0, 0, 0, 0.06)',
        'hig-lg': '0 10px 15px rgba(0, 0, 0, 0.04), 0 4px 6px rgba(0, 0, 0, 0.05)',
        'hig-xl': '0 20px 25px rgba(0, 0, 0, 0.06), 0 10px 10px rgba(0, 0, 0, 0.04)',
        'hig-2xl': '0 25px 50px rgba(0, 0, 0, 0.08), 0 12px 24px rgba(0, 0, 0, 0.06)',
        'hig-inner': 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
        'hig-inner-lg': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
        // Dark mode optimized shadows (more visible)
        'hig-dark-sm': '0 1px 3px rgba(0, 0, 0, 0.2), 0 1px 2px rgba(0, 0, 0, 0.3)',
        'hig-dark-md': '0 4px 6px rgba(0, 0, 0, 0.25), 0 2px 4px rgba(0, 0, 0, 0.3)',
        'hig-dark-lg': '0 10px 15px rgba(0, 0, 0, 0.3), 0 4px 6px rgba(0, 0, 0, 0.25)',
        'hig-dark-xl': '0 20px 25px rgba(0, 0, 0, 0.35), 0 10px 10px rgba(0, 0, 0, 0.25)',
        // Elevated card hover state
        'hig-hover': '0 8px 16px rgba(0, 0, 0, 0.08), 0 4px 8px rgba(0, 0, 0, 0.06)',
        'hig-hover-dark': '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)',
        // Focus ring — NEUTRAL BLUE, never crimson (focus ≠ error; VISUAL_STANDARD §2.2)
        'hig-focus': '0 0 0 3px var(--c-focus)',
        'hig-focus-danger': '0 0 0 3px rgba(220, 38, 38, 0.3)',
        // ----------------------------------------
        // Semantic shadow tokens — canonical names for shared primitives
        // ----------------------------------------
        'token-card': '0 4px 6px rgba(0,0,0,0.04), 0 2px 4px rgba(0,0,0,0.06)',
        'token-card-hover': '0 8px 16px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.06)',
        'token-focus': '0 0 0 3px var(--c-focus)', // blue focus ring — never crimson (focus ≠ error)
        // ----------------------------------------
        // VF0-5 ELEVATION SCALE — see src/index.css `--elevation-*` (mapped to
        // the hig-*/hig-dark-* shadows above). Not consumed anywhere yet — see
        // the VF0 pitfall note in index.css for why (theme-invariant existing
        // consumers vs. theme-aware token would change dark-mode screenshots).
        // ----------------------------------------
        'elevation-0': 'var(--elevation-0)',
        'elevation-1': 'var(--elevation-1)',
        'elevation-2': 'var(--elevation-2)',
        'elevation-3': 'var(--elevation-3)',
      },
      backgroundImage: {
        // Legacy gradients
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-gradient':
          'linear-gradient(180deg, rgba(255, 255, 255, 0.08) 0%, rgba(255, 255, 255, 0.02) 100%)',
        'glass-dark':
          'linear-gradient(180deg, rgba(17, 24, 39, 0.7) 0%, rgba(17, 24, 39, 0.4) 100%)',
        shine:
          'linear-gradient(45deg, transparent 25%, rgba(255,255,255,0.1) 50%, transparent 75%)',

        // ========================================
        // APPLE HIG GLASS / VIBRANCY EFFECTS
        // ========================================
        // Light mode glass
        'hig-glass':
          'linear-gradient(135deg, rgba(255, 255, 255, 0.9) 0%, rgba(255, 255, 255, 0.7) 100%)',
        'hig-glass-subtle':
          'linear-gradient(135deg, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0.4) 100%)',
        // Dark mode glass (vibrant)
        'hig-glass-dark':
          'linear-gradient(135deg, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.6) 100%)',
        'hig-glass-dark-subtle':
          'linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(15, 23, 42, 0.4) 100%)',
        // Elevated surfaces (subtle gradient for depth)
        'hig-elevated':
          'linear-gradient(180deg, rgba(255, 255, 255, 1) 0%, rgba(248, 250, 252, 1) 100%)',
        'hig-elevated-dark':
          'linear-gradient(180deg, rgba(21, 30, 50, 1) 0%, rgba(11, 17, 33, 1) 100%)',
        // Skeleton loading gradient
        'hig-skeleton':
          'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.4) 50%, transparent 100%)',
        'hig-skeleton-dark':
          'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.1) 50%, transparent 100%)',
        // Accent CTAs — solid crimson (was violet→violet gradient).
        // Demote violet → crimson sole accent; no gradient per brand spec.
        'hig-primary': 'linear-gradient(135deg, #85182F 0%, #85182F 100%)',
        'hig-primary-hover': 'linear-gradient(135deg, #6D1427 0%, #6D1427 100%)',
      },
      // ========================================
      // APPLE HIG SPACING SCALE
      // Consistent spacing for premium feel
      // ========================================
      spacing: {
        'hig-xs': '4px',
        'hig-sm': '8px',
        'hig-md': '12px',
        'hig-lg': '16px',
        'hig-xl': '20px',
        'hig-2xl': '24px',
        'hig-3xl': '32px',
        'hig-4xl': '40px',
        'hig-5xl': '48px',
      },
      // ========================================
      // APPLE HIG FONT SIZES
      // Typography scale matching Apple's system
      // ========================================
      fontSize: {
        'hig-caption': ['11px', { lineHeight: '13px', letterSpacing: '0.07px' }],
        'hig-footnote': ['13px', { lineHeight: '18px', letterSpacing: '-0.08px' }],
        'hig-subhead': ['15px', { lineHeight: '20px', letterSpacing: '-0.24px' }],
        'hig-body': ['17px', { lineHeight: '22px', letterSpacing: '-0.43px' }],
        'hig-headline': [
          '17px',
          { lineHeight: '22px', fontWeight: '600', letterSpacing: '-0.43px' },
        ],
        'hig-title3': ['20px', { lineHeight: '24px', fontWeight: '400', letterSpacing: '0.38px' }],
        'hig-title2': ['22px', { lineHeight: '28px', fontWeight: '400', letterSpacing: '0.35px' }],
        'hig-title1': ['28px', { lineHeight: '34px', fontWeight: '400', letterSpacing: '0.36px' }],
        'hig-large-title': [
          '34px',
          { lineHeight: '41px', fontWeight: '400', letterSpacing: '0.37px' },
        ],
      },
      backdropBlur: {
        xs: '2px',
        // ========================================
        // APPLE HIG VIBRANCY / GLASS EFFECTS
        // ========================================
        hig: '20px',
        'hig-light': '12px',
        'hig-heavy': '40px',
        'hig-ultra': '60px',
      },
      // ========================================
      // APPLE HIG BORDER RADIUS
      // Consistent rounded corners system
      // ========================================
      borderRadius: {
        'hig-xs': '6px',
        'hig-sm': '8px',
        'hig-md': '12px',
        'hig-lg': '16px',
        'hig-xl': '20px',
        'hig-2xl': '24px',
        'hig-3xl': '28px',
        'hig-full': '9999px',
        // ----------------------------------------
        // Semantic radius tokens (map to hig-* values)
        // Canonical names used by shared primitives.
        // ----------------------------------------
        'token-xs': '6px', // badges, chips
        'token-sm': '8px', // small cards, inputs
        'token-md': '12px', // cards, modals (--radius default)
        'token-lg': '16px', // panels, drawers
        'token-xl': '20px', // hero cards
        'token-pill': '9999px', // tags, toggles
      },
      // ========================================
      // APPLE HIG ANIMATION CURVES
      // ========================================
      transitionTimingFunction: {
        hig: 'cubic-bezier(0.4, 0, 0.2, 1)',
        'hig-spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'hig-bounce': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'hig-smooth': 'cubic-bezier(0.25, 0.1, 0.25, 1)',
        'hig-decel': 'cubic-bezier(0, 0, 0.2, 1)',
        'hig-accel': 'cubic-bezier(0.4, 0, 1, 1)',
        // VF0-4 MOTION — canonical easing token (`ease-standard`). Equals
        // Tailwind's own default `ease` curve, so using it is a zero-diff swap.
        standard: 'var(--motion-ease)',
      },
      transitionDuration: {
        'hig-fast': '100ms',
        'hig-normal': '200ms',
        'hig-slow': '300ms',
        'hig-slower': '400ms',
        // VF0-4 MOTION — canonical duration scale (see src/index.css
        // `--motion-*`). `duration-fast/base/slow` replace the ad-hoc literal
        // `duration-150`/`duration-200`/`duration-300` classes in standard/.
        fast: 'var(--motion-fast)',
        base: 'var(--motion-base)',
        slow: 'var(--motion-slow)',
      },
      animation: {
        // Legacy animations
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.5s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s linear infinite',

        // ========================================
        // APPLE HIG ANIMATIONS
        // ========================================
        // Entrance animations
        'hig-fade-in': 'higFadeIn 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'hig-fade-out': 'higFadeOut 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'hig-slide-up': 'higSlideUp 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'hig-slide-down': 'higSlideDown 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'hig-slide-left': 'higSlideLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'hig-slide-right': 'higSlideRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        // Scale animations (for modals, cards)
        'hig-scale-in': 'higScaleIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
        'hig-scale-out': 'higScaleOut 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        // Button press feedback
        'hig-press': 'higPress 0.1s ease-out forwards',
        // Skeleton loading
        'hig-skeleton': 'higSkeleton 1.5s ease-in-out infinite',
        // Spinner
        'hig-spin': 'higSpin 0.8s linear infinite',
        // Bounce for notifications
        'hig-bounce-in': 'higBounceIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
      },
      keyframes: {
        // Legacy keyframes
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },

        // ========================================
        // APPLE HIG KEYFRAMES
        // ========================================
        higFadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        higFadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        higSlideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        higSlideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        higSlideLeft: {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        higSlideRight: {
          '0%': { opacity: '0', transform: 'translateX(-16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        higScaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        higScaleOut: {
          '0%': { opacity: '1', transform: 'scale(1)' },
          '100%': { opacity: '0', transform: 'scale(0.95)' },
        },
        higPress: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.97)' },
          '100%': { transform: 'scale(1)' },
        },
        higSkeleton: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        higSpin: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        higBounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
