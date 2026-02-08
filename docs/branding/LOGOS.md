# Branding — Logo source of truth (Consultinity)

## Source of truth

**The only source of truth for Consultinity logos is:**

- `Logo consultinity/`

Do **not** edit derived assets directly. If you need to change the logo, update the SVGs in `Logo consultinity/` and regenerate assets.

## Derived (generated) assets

These files are generated from `Logo consultinity/` and are used by the runtime application:

- **App/UI logos** (referenced by the frontend as static URLs):
  - `public/assets/logos/logo-light.png`
  - `public/assets/logos/logo-dark.png`
  - `public/assets/logos/logo-icon.png`
- **Favicons**:
  - `public/favicon.png` (32×32)
  - `public/favicon-16.png` (16×16)
- **PWA**:
  - `public/manifest.json`
  - `public/icons/icon-*.png`
  - `public/icons/shortcut-*.png`

## Regeneration

Run:

```bash
npm run branding:generate
```

This will:

- overwrite the derived assets listed above
- keep `Logo consultinity/` untouched

## Naming conventions

- `logo-light.*`: for light UI backgrounds
- `logo-dark.*`: for dark UI backgrounds
- `logo-icon.*`: square mark for compact UI, favicons, and PWA icons

