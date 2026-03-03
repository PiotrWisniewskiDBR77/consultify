# Branding — Logo source of truth (Consultinity)

## Source of truth

**Runtime logo assets (source of truth in this repo):**

- `public/assets/logos/logo-light.svg` (light UI backgrounds)
- `public/assets/logos/logo-dark.svg` (dark UI backgrounds)
- Optional brand accents:
  - `public/assets/logos/logo-brand-92004f.svg`
  - `public/assets/logos/logo-brand-1e0058.svg`

> Note: there is also a generator script (`npm run branding:generate`) but the repo must contain the
> expected `Logo consultinity/` source folder for it to work. If that folder is missing, treat the
> `public/assets/logos/*.svg` files as the canonical runtime assets.

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

