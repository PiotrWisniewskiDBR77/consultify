/**
 * accessibilityRuntime
 *
 * Pure (no-React) helpers that apply accessibility preferences to the DOM.
 * Extracted from AccessibilitySettings so the same logic can run both inside
 * the settings panel AND once at app bootstrap (so a user's saved preferences
 * take effect everywhere, not only while the panel is mounted).
 *
 * IMPORTANT: applying DEFAULT_PREFERENCES must be visually a no-op — the
 * defaults map to the app's intended look (e.g. font "system" resolves to the
 * brand Inter stack) so bootstrapping never changes the UI for users who never
 * set a preference.
 */

export interface AccessibilityPreferences {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  highContrastMode: boolean;
  reduceMotion: boolean;
  showKeyboardShortcuts: boolean;
  focusHighlight: boolean;
  cursorSize: 'default' | 'large' | 'extra-large';
  textSpacing: 'default' | 'relaxed' | 'spacious';
  underlineLinks: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  fontFamily: string;
  lineHeight: 'default' | 'relaxed' | 'loose';
  letterSpacing: 'default' | 'wide' | 'wider';
  caretWidth: 'default' | 'thick';
  focusIndicatorStyle: 'default' | 'high-contrast' | 'animated';
}

export const DEFAULT_ACCESSIBILITY_PREFERENCES: AccessibilityPreferences = {
  fontSize: 'medium',
  highContrastMode: false,
  reduceMotion: false,
  showKeyboardShortcuts: true,
  focusHighlight: true,
  cursorSize: 'default',
  textSpacing: 'default',
  underlineLinks: false,
  colorBlindMode: 'none',
  fontFamily: 'inter',
  lineHeight: 'default',
  letterSpacing: 'default',
  caretWidth: 'default',
  focusIndicatorStyle: 'default',
};

const COLORBLIND_SVG_ID = 'a11y-colorblind-filters';

const ensureColorblindFilters = () => {
  if (typeof document === 'undefined' || document.getElementById(COLORBLIND_SVG_ID)) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <svg id="${COLORBLIND_SVG_ID}" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
      <defs>
        <filter id="cb-protanopia"><feColorMatrix type="matrix" values="0.567 0.433 0 0 0  0.558 0.442 0 0 0  0 0.242 0.758 0 0  0 0 0 1 0"/></filter>
        <filter id="cb-deuteranopia"><feColorMatrix type="matrix" values="0.625 0.375 0 0 0  0.7 0.3 0 0 0  0 0.3 0.7 0 0  0 0 0 1 0"/></filter>
        <filter id="cb-tritanopia"><feColorMatrix type="matrix" values="0.95 0.05 0 0 0  0 0.433 0.567 0 0  0 0.475 0.525 0 0  0 0 0 1 0"/></filter>
      </defs>
    </svg>`;
  const svg = wrapper.firstElementChild;
  if (svg) document.body.appendChild(svg);
};

export const applyAccessibilityPreferences = (prefs: AccessibilityPreferences) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;

  const fontSizeMap = { small: '14px', medium: '16px', large: '18px', 'extra-large': '20px' };
  root.style.setProperty('--base-font-size', fontSizeMap[prefs.fontSize]);

  root.classList.toggle('high-contrast', prefs.highContrastMode);
  root.classList.toggle('reduce-motion', prefs.reduceMotion);
  root.classList.toggle('underline-links', prefs.underlineLinks);

  ensureColorblindFilters();
  root.classList.remove(
    'colorblind-protanopia',
    'colorblind-deuteranopia',
    'colorblind-tritanopia'
  );
  if (prefs.colorBlindMode !== 'none') {
    root.classList.add(`colorblind-${prefs.colorBlindMode}`);
  }

  const lineHeightMap = { default: '1.5', relaxed: '1.75', loose: '2' };
  root.style.setProperty('--line-height-base', lineHeightMap[prefs.lineHeight]);

  const letterSpacingMap = { default: '0', wide: '0.025em', wider: '0.05em' };
  root.style.setProperty('--letter-spacing-base', letterSpacingMap[prefs.letterSpacing]);

  root.style.setProperty('--font-family-base', "'Inter', system-ui, -apple-system, sans-serif");

  // Cursor size (CSS sets a larger SVG cursor on html.cursor-large)
  root.classList.toggle('cursor-large', prefs.cursorSize !== 'default');

  // Text spacing (WCAG-style spacing bump)
  root.classList.remove('text-spacing-relaxed', 'text-spacing-spacious');
  if (prefs.textSpacing === 'relaxed') root.classList.add('text-spacing-relaxed');
  else if (prefs.textSpacing === 'spacious') root.classList.add('text-spacing-spacious');

  // Caret width
  root.classList.toggle('caret-thick', prefs.caretWidth === 'thick');

  // Focus highlight + focus indicator style
  root.classList.toggle('focus-highlight', prefs.focusHighlight);
  root.classList.remove('focus-style-high-contrast', 'focus-style-animated');
  if (prefs.focusIndicatorStyle === 'high-contrast') {
    root.classList.add('focus-style-high-contrast');
  } else if (prefs.focusIndicatorStyle === 'animated') {
    root.classList.add('focus-style-animated');
  }
};

/**
 * Fetch the user's saved accessibility preferences and apply them once.
 * Safe to call at app bootstrap: guarded, never throws, and applying defaults
 * is a visual no-op. `getPrefs` is injected to avoid coupling this util to the
 * API client (keeps it React/dependency-free and tree-shakeable).
 */
export const bootstrapAccessibilityPreferences = async (
  getPrefs: () => Promise<{ preferences?: Partial<AccessibilityPreferences> } | null | undefined>
): Promise<void> => {
  try {
    const data = await getPrefs();
    const merged = { ...DEFAULT_ACCESSIBILITY_PREFERENCES, ...(data?.preferences ?? {}) };
    applyAccessibilityPreferences(merged);
  } catch {
    // Never block app boot on a preferences fetch; defaults already apply via CSS fallbacks.
  }
};
