# Branding — Logo source of truth (Consultinity)

## Source of truth

**Runtime logo assets generated from `Logo consultinity/`:**

- `public/assets/logos/logo-light.svg` (light UI backgrounds)
- `public/assets/logos/logo-dark.svg` (dark UI backgrounds)
- Optional brand accents:
  - `public/assets/logos/logo-brand-92004f.svg`
  - `public/assets/logos/logo-brand-1e0058.svg`

Current mapping of the refreshed Consultify wordmarks:

- `logo-light.svg` → `Logo consultinity/consultify-black.svg`
- `logo-dark.svg` → `Logo consultinity/consultify-white.svg.svg`
- `logo-brand-1e0058.svg` → `Logo consultinity/consultify-purple.svg`
- `logo-brand-92004f.svg` → `Logo consultinity/consultify-harvard.svg`

> `npm run branding:generate` now copies these source SVGs directly into `public/assets/logos/`
> and also regenerates the PNG fallbacks used by cache/PWA paths.

## Derived (generated) assets

If you use the generator workflow, these files are generated and used by the runtime application:

- **App/UI logos** (referenced by the frontend as static URLs):
  - `public/assets/logos/logo-light.svg`
  - `public/assets/logos/logo-dark.svg`
  - `public/assets/logos/logo-icon.png` *(optional/future; used for square mark)*
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

