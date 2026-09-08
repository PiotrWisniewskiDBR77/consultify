/**
 * Transactional Email Layout
 *
 * Shared HTML shell for one-off transactional/system emails that are built
 * inline (not through the Handlebars .hbs pipeline in
 * `emailTemplateRenderer.ts` — those already have their own per-template
 * head/style block and are billing-specific).
 *
 * Why this exists (2026-09-08, DEC pending): the password reset email
 * (`server/src/routes/auth.routes.ts` → `buildPasswordResetEmailHtml`) was a
 * bare `<h2>` + one sentence + a naked link — no layout, no branding, no
 * text/plain companion, sender shown as a raw address. Nothing in the repo
 * was a real shared layout for this class of email yet (the billing .hbs
 * templates are self-contained per file and use a crimson (#85182F) CTA
 * button, which is against the Consultify UI rule that crimson is reserved
 * for critical-severity states only — so they are NOT reused as-is here).
 *
 * This module is intentionally small and framework-free (no Handlebars):
 * plain template-literal HTML, inline CSS, table-based layout for Outlook/
 * Gmail/Apple Mail compatibility, no external image (logo rendered as
 * styled text — Outlook blocks remote images by default).
 *
 * Use `renderTransactionalEmailLayout` for the outer shell,
 * `renderCtaButton` for the CTA table-button, and `escapeHtml` to guard any
 * user-supplied string (e.g. a first name) before interpolating into HTML.
 *
 * Candidates for migrating onto this same shell later (not done in this
 * change — out of scope, see report): `emailVerificationService.ts`
 * ("Verify your email"), `welcomeEmailService.ts` (`generateWelcomeEmailHtml`).
 */

export type TransactionalEmailLang = 'pl' | 'en';

/** Escape a string for safe interpolation into HTML text/attribute content. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const CTA_BUTTON_BG = '#111827'; // neutral dark — NOT crimson (#85182F is critical-only)
const CTA_BUTTON_FG = '#ffffff';
const LINK_COLOR = '#2563EB'; // c-focus-style blue, not crimson

/**
 * Bulletproof-ish table CTA button. `label` must already be escaped by the
 * caller if it can contain user input (it never should for a CTA label).
 */
export function renderCtaButton(label: string, url: string): string {
  const safeUrl = escapeHtml(url);
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr>
        <td style="border-radius:8px;background-color:${CTA_BUTTON_BG};">
          <a href="${safeUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;line-height:1;font-weight:600;color:${CTA_BUTTON_FG};text-decoration:none;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${label}</a>
        </td>
      </tr>
    </table>`;
}

/** Plain-text equivalent of renderCtaButton, for the `text` companion body. */
export function renderCtaButtonText(label: string, url: string): string {
  return `${label}: ${url}`;
}

export interface TransactionalEmailLayoutParams {
  lang: TransactionalEmailLang;
  /** Document <title> — usually the email subject. */
  title: string;
  /** Inner content HTML, already built by the caller (escaped where needed). */
  bodyHtml: string;
  /** Override the default footer HTML block. */
  footerHtml?: string;
}

const DEFAULT_FOOTER: Record<TransactionalEmailLang, string> = {
  pl: `
    <p style="margin:0 0 4px 0;">Consultify &middot; AI-native system realizacji doradztwa</p>
    <p style="margin:0;">Ta wiadomość została wysłana automatycznie, nie odpowiadaj na nią.</p>`,
  en: `
    <p style="margin:0 0 4px 0;">Consultify &middot; AI-native consulting delivery system</p>
    <p style="margin:0;">This message was sent automatically, please do not reply.</p>`,
};

/**
 * Wraps `bodyHtml` in the shared table-based transactional email shell:
 * text logotype header, content slot, footer. 600px wide, light background,
 * white rounded card — matches the Consultify neutral (non-crimson) CTA
 * standard. No external assets are referenced (safe under Outlook's
 * default image blocking).
 */
export function renderTransactionalEmailLayout(params: TransactionalEmailLayoutParams): string {
  const { lang, title, bodyHtml, footerHtml } = params;
  const footer = footerHtml ?? DEFAULT_FOOTER[lang];
  const safeTitle = escapeHtml(title);

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#F4F5F7;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F5F7;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;background-color:#ffffff;border-radius:12px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr>
            <td style="padding:32px 40px 16px 40px;border-bottom:1px solid #F3F4F6;">
              <span style="font-size:20px;font-weight:700;color:#111827;letter-spacing:-0.02em;">Consultify</span>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;color:#1F2937;font-size:15px;line-height:1.6;">
${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px;background-color:#F9FAFB;border-top:1px solid #E5E7EB;color:#6B7280;font-size:12px;line-height:1.6;">
${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export default {
  escapeHtml,
  renderCtaButton,
  renderCtaButtonText,
  renderTransactionalEmailLayout,
};
