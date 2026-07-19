#!/usr/bin/env node
// AUTH-SWEEP detector (E-AUTH-A). Repeatable.
// Inventories every router mount in index.ts + Gateway.ts, classifies auth coverage.
// Usage: node server/scripts/auth-sweep-detector.mjs [--json]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '../src');

const FILES = ['index.ts', 'Gateway.ts'];

// Identifiers that, when present as a handler in a mount chain, mean the mount is auth-protected inline.
const AUTH_INLINE = new Set([
  'verifyToken',
  'gatewayVerifyToken',
  'requireAuth',
  'authMiddleware',
  'authenticate',
  'authenticateToken',
  'requireInternalToolsAccess', // always paired with verifyToken in internalToolsGuard
  'orgMembershipGuard',
  'validateOrgMembership',
]);
// Spread arrays / factory calls that include auth.
const AUTH_INLINE_SPREAD = new Set(['internalToolsGuard']); // = [gatewayVerifyToken, requireInternalToolsAccess]
// Guard factory calls that imply auth (they call verifyToken internally). Confirmed by reading middleware.
const AUTH_FACTORY_CALL = [/highRiskSurfaceGuard\s*\(/];

// Path prefixes that are public by design.
const PUBLIC_PREFIXES = [
  '/api/public/',
  '/api/auth',
  '/api/health',
  '/api/system',
  '/api/errors', // client error reporting (no user data exposed)
  '/api/demo',
];

// ---- balanced-paren extraction of app.use(...) calls ----
function extractAppUseCalls(text) {
  const calls = [];
  const re = /app\.use\s*\(/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    // skip if this app.use is inside a // line comment
    const lineStart = text.lastIndexOf('\n', m.index) + 1;
    const linePrefix = text.slice(lineStart, m.index);
    if (linePrefix.includes('//')) continue;
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    let inStr = null;
    while (i < text.length && depth > 0) {
      const c = text[i];
      if (inStr) {
        if (c === inStr && text[i - 1] !== '\\') inStr = null;
      } else if (c === "'" || c === '"' || c === '`') {
        inStr = c;
      } else if (c === '(') depth++;
      else if (c === ')') depth--;
      i++;
    }
    const inner = text.slice(start, i - 1);
    const line = text.slice(0, m.index).split('\n').length;
    calls.push({ inner, line });
  }
  return calls;
}

// Split top-level args by commas (respecting nesting & strings).
function splitArgs(inner) {
  const args = [];
  let depth = 0;
  let inStr = null;
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (inStr) {
      cur += c;
      if (c === inStr && inner[i - 1] !== '\\') inStr = null;
    } else if (c === "'" || c === '"' || c === '`') {
      inStr = c;
      cur += c;
    } else if (c === '(' || c === '[' || c === '{') {
      depth++;
      cur += c;
    } else if (c === ')' || c === ']' || c === '}') {
      depth--;
      cur += c;
    } else if (c === ',' && depth === 0) {
      args.push(cur.trim());
      cur = '';
    } else cur += c;
  }
  if (cur.trim()) args.push(cur.trim());
  return args;
}

// ---- build import map: identifier -> resolved source file ----
function buildImportMap(text, baseDir) {
  const map = {};
  // default:  import Foo from './routes/foo.routes.js'
  const defRe = /import\s+([A-Za-z0-9_]+)\s*(?:,\s*\{[^}]*\})?\s+from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = defRe.exec(text)) !== null) {
    map[m[1]] = resolveImport(m[2], baseDir);
  }
  // named:  import { A, B as C } from '...'
  const namedRe = /import\s+(?:[A-Za-z0-9_]+\s*,\s*)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g;
  while ((m = namedRe.exec(text)) !== null) {
    const spec = m[2];
    for (const part of m[1].split(',')) {
      const t = part.trim();
      if (!t) continue;
      const asMatch = t.match(/(\w+)\s+as\s+(\w+)/);
      const name = asMatch ? asMatch[2] : t;
      map[name] = resolveImport(spec, baseDir);
    }
  }
  return map;
}

function resolveImport(spec, baseDir) {
  if (!spec.startsWith('.')) return null; // external pkg
  let p = path.resolve(baseDir, spec);
  p = p.replace(/\.js$/, '');
  const candidates = [p + '.ts', p + '.js', path.join(p, 'index.ts'), path.join(p, 'index.js')];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  return p + '.ts'; // best guess
}

// ---- does a router file apply auth internally? ----
const internalCache = {};
function routerHasInternalAuth(file) {
  if (!file) return { auth: false, reason: 'unresolved' };
  if (internalCache[file]) return internalCache[file];
  if (!fs.existsSync(file)) return (internalCache[file] = { auth: false, reason: 'file-missing' });
  const t = fs.readFileSync(file, 'utf8');
  // 503/404 "degraded/not-configured" stub: single catch-all router.use returning error status, no data.
  const routeDefsEarly = (t.match(/router\.(get|post|put|patch|delete|all)\s*\(/g) || []).length;
  if (routeDefsEarly === 0 && /router\.use\s*\(\s*\(_?req[^)]*\)\s*=>/.test(t) && /res\.status\(\s*(503|404|501)\s*\)/.test(t)) {
    return (internalCache[file] = { auth: 'stub', reason: 'degraded stub (503/404/501, exposes no data)' });
  }
  // one-level re-export delegation: `router.use(otherRouter)` where otherRouter is a default import of another routes file
  const delegate = t.match(/import\s+(\w+)\s+from\s+['"](\.\.?[^'"]*routes[^'"]*)['"]/);
  if (routeDefsEarly === 0 && delegate && new RegExp(`router\\.use\\(\\s*${delegate[1]}\\s*\\)`).test(t)) {
    const target = resolveImport(delegate[2], path.dirname(file));
    if (target && target !== file) {
      const inner = routerHasInternalAuth(target);
      if (inner.auth === true) return (internalCache[file] = { auth: true, reason: `re-export → ${path.basename(target)} (${inner.reason})` });
    }
  }
  // router-level blanket auth (any router-ish var name: router, v8Router, apiRouter, etc.)
  const blanket =
    /\b[A-Za-z0-9_]*[Rr]outer\.use\s*\(\s*(?:[A-Za-z0-9_.]*\.)?(verifyToken|gatewayVerifyToken|requireAuth|authMiddleware|authenticateToken|authenticate)\b/;
  if (blanket.test(t)) return (internalCache[file] = { auth: true, reason: 'router.use(auth) blanket' });
  // count routes vs routes carrying verifyToken inline
  const routeDefs = (t.match(/router\.(get|post|put|patch|delete|all)\s*\(/g) || []).length;
  const authRefs = (t.match(/\b(verifyToken|gatewayVerifyToken|requireAuth|authMiddleware|authenticateToken)\b/g) || []).length;
  if (routeDefs > 0 && authRefs >= routeDefs) return (internalCache[file] = { auth: true, reason: 'per-route auth (all)' });
  if (authRefs > 0 && routeDefs > 0) return (internalCache[file] = { auth: 'partial', reason: `partial ${authRefs}/${routeDefs} routes reference auth` });
  if (routeDefs === 0) return (internalCache[file] = { auth: false, reason: 'no route defs found (re-exports/aggregator?)' });
  return (internalCache[file] = { auth: false, reason: `0 auth refs across ${routeDefs} routes` });
}

function isPublicByDesign(p) {
  return PUBLIC_PREFIXES.some((pre) => p === pre || p.startsWith(pre));
}

// ---- main ----
const results = [];
// track guard-only middleware mounted at prefixes (protect everything under, mounted later)
const prefixGuards = [];

for (const f of FILES) {
  const file = path.join(SRC, f);
  const text = fs.readFileSync(file, 'utf8');
  const importMap = buildImportMap(text, SRC);
  const calls = extractAppUseCalls(text);
  for (const call of calls) {
    const args = splitArgs(call.inner);
    if (args.length === 0) continue;
    const first = args[0];
    // Only consider mounts whose first arg is a path string literal starting with /api (or /kb etc route paths)
    const strMatch = first.match(/^['"`]([^'"`]+)['"`]$/);
    if (!strMatch) continue; // e.g. app.use(cors()), app.use(fn) — global middleware, skip
    const mountPath = strMatch[1];
    if (!mountPath.startsWith('/')) continue;
    const handlers = args.slice(1);
    if (handlers.length === 0) continue;

    // detect inline auth
    let inlineAuth = false;
    let inlineReason = '';
    for (const h of handlers) {
      // spread of internalToolsGuard
      const spreadM = h.match(/^\.\.\.(\w+)$/);
      if (spreadM && AUTH_INLINE_SPREAD.has(spreadM[1])) { inlineAuth = true; inlineReason = `...${spreadM[1]}`; break; }
      // factory call
      if (AUTH_FACTORY_CALL.some((r) => r.test(h))) { inlineAuth = true; inlineReason = h.slice(0, 30); break; }
      // bare identifier
      const idM = h.match(/^([A-Za-z0-9_]+)$/);
      if (idM && AUTH_INLINE.has(idM[1])) { inlineAuth = true; inlineReason = idM[1]; break; }
    }

    // identify the router (last handler that is a bare identifier resolving to a routes file)
    let routerId = null;
    for (let k = handlers.length - 1; k >= 0; k--) {
      const idM = handlers[k].match(/^([A-Za-z0-9_]+)$/);
      if (idM && !AUTH_INLINE.has(idM[1]) && !AUTH_INLINE_SPREAD.has(idM[1])) { routerId = idM[1]; break; }
    }
    // Is this a guard-only mount (no router, just middleware)? Track as prefix guard.
    const routerFile = routerId ? importMap[routerId] : null;
    const looksLikeRouter = routerId && /route|Routes|Router|router/i.test(routerId);

    if (!looksLikeRouter) {
      // middleware-only mount (e.g. v8ShadowModeCheck). If it's an auth guard, register prefix.
      if (inlineAuth) prefixGuards.push(mountPath);
      // skip from router inventory unless it also has a path we care about; record lightly
      results.push({ file: f, line: call.line, mountPath, kind: 'middleware-only', handlers, inlineAuth, inlineReason, routerId, note: 'not a router mount' });
      continue;
    }

    const internal = inlineAuth ? { auth: true, reason: 'inline' } : routerHasInternalAuth(routerFile);
    // prefix guard coverage
    const coveredByPrefix = prefixGuards.find((pg) => mountPath === pg || mountPath.startsWith(pg + '/') || mountPath.startsWith(pg));

    // webhook mounts use HMAC signature verification (not JWT) — public by design
    const isWebhook = /\/webhooks?(\/|$)|\/slack(\/|$)/.test(mountPath);
    // test-support is hard-guarded by NODE_ENV==='test' && ENABLE_TEST_SUPPORT at mount
    const isTestSupport = mountPath.startsWith('/api/test-support');

    let classification;
    if (isPublicByDesign(mountPath)) classification = 'PUBLIC-BY-DESIGN';
    else if (inlineAuth) classification = 'PROTECTED (inline)';
    else if (internal.auth === true) classification = 'PROTECTED (internal)';
    else if (internal.auth === 'stub') classification = 'STUB (503/404, no data)';
    else if (coveredByPrefix) classification = 'PROTECTED (prefix-guard)';
    else if (isWebhook) classification = 'PUBLIC-BY-DESIGN (webhook/HMAC)';
    else if (isTestSupport) classification = 'PUBLIC-BY-DESIGN (test-only, env-guarded)';
    else if (internal.auth === 'partial') classification = 'REVIEW (partial internal auth)';
    else classification = 'HOLE?';

    results.push({
      file: f, line: call.line, mountPath, kind: 'router', routerId,
      routerFile: routerFile ? path.relative(SRC, routerFile) : null,
      inlineAuth, inlineReason,
      internalAuth: internal.auth, internalReason: internal.reason,
      coveredByPrefix: coveredByPrefix || null,
      classification,
    });
  }
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(results.filter((r) => r.kind === 'router'), null, 2));
  process.exit(0);
}

const routers = results.filter((r) => r.kind === 'router');
const byClass = {};
for (const r of routers) (byClass[r.classification] ||= []).push(r);

console.log(`\n=== AUTH-SWEEP DETECTOR ===`);
console.log(`Total router mounts inventoried: ${routers.length}\n`);
for (const cls of Object.keys(byClass).sort()) {
  console.log(`\n#### ${cls}  (${byClass[cls].length})`);
  for (const r of byClass[cls].sort((a, b) => a.mountPath.localeCompare(b.mountPath))) {
    console.log(`  ${r.mountPath}  <- ${r.routerId} [${r.file}:${r.line}]  ${r.classification.startsWith('PROTECTED') ? '('+(r.inlineReason||r.internalReason)+')' : '('+r.internalReason+')'}`);
  }
}
console.log(`\n=== SUMMARY ===`);
for (const cls of Object.keys(byClass).sort()) console.log(`  ${cls}: ${byClass[cls].length}`);
