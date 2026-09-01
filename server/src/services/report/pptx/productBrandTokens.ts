/**
 * Server-side bridge for the product brand token.
 *
 * This literal intentionally duplicates the browser-side canonical value from
 * `tailwind.config.js` (`colors.brand.DEFAULT`) and `src/index.css` (`--primary`).
 * The server build cannot import browser CSS/config across that boundary, so a
 * change in either frontend source must be synchronized here.
 */
export const PRODUCT_BRAND_PRIMARY = '#85182F' as const;
