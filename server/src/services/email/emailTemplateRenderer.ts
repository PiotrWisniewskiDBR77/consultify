/**
 * Email Template Renderer
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Compiles and caches Handlebars (.hbs) email templates and renders them with
 * a per-call data context merged over shared branding defaults.
 *
 * Task #84 (Harvard): the branded .hbs templates under
 * `server/src/templates/emails/**` were dead assets — nothing rendered them and
 * system e-mails went out inline/plain. This module is the single place that
 * turns a template name into HTML so `emailService.send()` can wire them in.
 *
 * Runtime path note: `.hbs` files live under `src/` and are NOT emitted into
 * `dist/` by `tsc`. Production runs `node dist/src/index.js` from the `server/`
 * directory, so we resolve templates from `process.cwd()`-relative candidates
 * that point back at the `src/` tree (same pattern used by
 * DatabaseInitializer / index.ts for migrations, kb, logos, etc.).
 */

import fs from 'fs';
import Handlebars from 'handlebars';
import path from 'path';

import logger from '../../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export interface RenderContext {
  [key: string]: unknown;
}

type CompiledTemplate = HandlebarsTemplateDelegate<RenderContext>;

// ==========================================
// TEMPLATE ROOT RESOLUTION
// ==========================================

/**
 * Candidate roots for the `templates/emails` directory. The first one that
 * actually exists on disk wins and is cached. Covers:
 *  - dev (tsx) launched from repo root  -> server/src/templates/emails
 *  - dev (tsx) launched from server/    -> src/templates/emails
 *  - prod (node dist/src/index.js from server/) -> src/templates/emails
 *    (.hbs sources are not copied into dist)
 */
function candidateRoots(): string[] {
  const cwd = process.cwd();
  return [
    path.resolve(cwd, 'src/templates/emails'),
    path.resolve(cwd, 'server/src/templates/emails'),
    path.resolve(cwd, 'dist/src/templates/emails'),
    path.resolve(cwd, '..', 'server/src/templates/emails'),
  ];
}

let cachedRoot: string | null | undefined;

function resolveTemplateRoot(): string | null {
  if (cachedRoot !== undefined) return cachedRoot;

  for (const root of candidateRoots()) {
    try {
      if (fs.existsSync(root) && fs.statSync(root).isDirectory()) {
        cachedRoot = root;
        return cachedRoot;
      }
    } catch {
      // ignore and try the next candidate
    }
  }

  cachedRoot = null;
  logger.warn(
    `[EmailTemplateRenderer] No templates/emails directory found. Tried: ${candidateRoots().join(', ')}`
  );
  return cachedRoot;
}

// ==========================================
// TEMPLATE NAME NORMALIZATION
// ==========================================

/**
 * Normalize a caller-supplied template name to a path (without extension)
 * relative to the templates root. Guards against path traversal.
 *
 * Accepts: "billing/invoice_created", "invoice_created",
 *          "billing/invoice_created.hbs", "emails/billing/invoice_created".
 */
export function normalizeTemplateName(name: string): string | null {
  if (!name || typeof name !== 'string') return null;

  const rawRel = name.trim().replace(/\\/g, '/');
  // Reject absolute / traversal paths up-front, before any stripping so that a
  // leading slash can't be silently normalized into a valid relative path.
  if (rawRel.startsWith('/') || rawRel.includes('..') || path.isAbsolute(rawRel)) {
    return null;
  }

  let rel = rawRel.replace(/\.hbs$/i, '');
  // Strip a leading templates/emails prefix if the caller included it.
  rel = rel.replace(/^(templates\/)?emails\//i, '');

  // Only allow safe path characters.
  if (!/^[a-zA-Z0-9_\-/]+$/.test(rel)) {
    return null;
  }
  return rel;
}

// ==========================================
// COMPILATION + CACHE
// ==========================================

const compiledCache = new Map<string, CompiledTemplate>();

/** Disable caching in tests / when explicitly requested. */
function cachingEnabled(): boolean {
  return process.env.EMAIL_TEMPLATE_CACHE_DISABLED !== '1';
}

/** Clear the compiled-template + root cache (used by tests). */
export function clearTemplateCache(): void {
  compiledCache.clear();
  cachedRoot = undefined;
}

/**
 * Returns true if a template file exists for the given name.
 */
export function templateExists(name: string): boolean {
  const rel = normalizeTemplateName(name);
  if (!rel) return false;
  const root = resolveTemplateRoot();
  if (!root) return false;
  try {
    return fs.existsSync(path.join(root, `${rel}.hbs`));
  } catch {
    return false;
  }
}

function getCompiledTemplate(rel: string): CompiledTemplate | null {
  if (cachingEnabled() && compiledCache.has(rel)) {
    return compiledCache.get(rel)!;
  }

  const root = resolveTemplateRoot();
  if (!root) return null;

  const filePath = path.join(root, `${rel}.hbs`);
  let source: string;
  try {
    source = fs.readFileSync(filePath, 'utf8');
  } catch {
    logger.warn(`[EmailTemplateRenderer] Template not found on disk: ${filePath}`);
    return null;
  }

  const compiled = Handlebars.compile<RenderContext>(source, { noEscape: false });
  if (cachingEnabled()) {
    compiledCache.set(rel, compiled);
  }
  return compiled;
}

// ==========================================
// BRANDING DEFAULTS
// ==========================================

/**
 * Shared footer / branding variables referenced by every billing template
 * (companyName, supportUrl, unsubscribeUrl, etc.). Caller `data` always wins.
 */
export function brandingDefaults(): RenderContext {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  const companyName = process.env.COMPANY_NAME || 'Consultify';
  return {
    companyName,
    companyAddress: process.env.COMPANY_ADDRESS || '',
    logoUrl: process.env.EMAIL_LOGO_URL || `${frontendUrl}/assets/logos/logo.png`,
    supportUrl: process.env.SUPPORT_URL || `${frontendUrl}/support`,
    billingPortalUrl: process.env.BILLING_PORTAL_URL || `${frontendUrl}/settings/billing`,
    unsubscribeUrl: process.env.UNSUBSCRIBE_URL || `${frontendUrl}/settings/notifications`,
    dashboardUrl: `${frontendUrl}/dashboard`,
    feedbackUrl: process.env.FEEDBACK_URL || `${frontendUrl}/feedback`,
  };
}

// ==========================================
// RENDER
// ==========================================

/**
 * Render a template to HTML. Returns `null` (never throws) when the template is
 * missing or fails to compile/render, so the caller can fall back to its
 * previous inline content without blocking the send.
 */
export function renderTemplate(name: string, data: RenderContext = {}): string | null {
  try {
    const rel = normalizeTemplateName(name);
    if (!rel) {
      logger.warn(`[EmailTemplateRenderer] Invalid template name: ${String(name)}`);
      return null;
    }

    const compiled = getCompiledTemplate(rel);
    if (!compiled) return null;

    const context: RenderContext = { ...brandingDefaults(), ...data };
    const html = compiled(context);
    if (!html || typeof html !== 'string' || html.trim().length === 0) {
      logger.warn(`[EmailTemplateRenderer] Rendered empty output for template: ${rel}`);
      return null;
    }
    return html;
  } catch (err) {
    logger.error(
      `[EmailTemplateRenderer] Failed to render template "${String(name)}": ${(err as Error).message}`
    );
    return null;
  }
}

export default {
  renderTemplate,
  templateExists,
  normalizeTemplateName,
  brandingDefaults,
  clearTemplateCache,
};
