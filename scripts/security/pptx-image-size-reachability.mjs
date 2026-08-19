#!/usr/bin/env node

/**
 * Executable reachability proof for GHSA-w3rx-r6r6-pgpr and
 * GHSA-5p2g-fcmc-qvqq in pptxgenjs' declared `image-size` dependency.
 *
 * PptxGenJS 4.0.1 declares image-size but its published executable bundles do
 * not import it.  This gate proves both the static edge and the real runtime
 * path.  It is deliberately coupled to the exact package version and fails on
 * any package/bundle drift, so it cannot become a permanent vulnerability
 * allowlist.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Module = require('node:module');
const entry = require.resolve('pptxgenjs');
const packageRoot = path.dirname(path.dirname(entry));
const manifest = JSON.parse(fs.readFileSync(path.join(packageRoot, 'package.json'), 'utf8'));

assert.equal(manifest.version, '4.0.1', 'review reachability again after a PptxGenJS upgrade');
assert.equal(manifest.dependencies?.['image-size'], '^1.2.1');

const executableFiles = fs
  .readdirSync(path.join(packageRoot, 'dist'))
  .filter((name) => /\.js$/i.test(name));
assert.ok(executableFiles.length > 0, 'PptxGenJS executable bundles are missing');
for (const file of executableFiles) {
  const source = fs.readFileSync(path.join(packageRoot, 'dist', file), 'utf8');
  assert.doesNotMatch(
    source,
    /(?:require\s*\(\s*['"]image-size['"]\s*\)|from\s*['"]image-size['"]|import\s*\(\s*['"]image-size['"]\s*\))/,
    `${file} gained an executable image-size import`
  );
}

let imageSizeLoadAttempts = 0;
const originalLoad = Module._load;
Module._load = function guardedLoad(request, parent, isMain) {
  if (request === 'image-size' || request.startsWith('image-size/')) {
    imageSizeLoadAttempts += 1;
    throw new Error('SEC-PRIV-001: vulnerable image-size runtime edge reached');
  }
  return originalLoad.call(this, request, parent, isMain);
};

try {
  const PptxGenJS = require('pptxgenjs');
  const JSZip = require('jszip');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  const slide = pptx.addSlide();
  slide.addText('SEC-PRIV-001 real PPTX reopen proof', { x: 0.5, y: 0.4, w: 8, h: 0.5 });
  slide.addImage({
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    x: 0.5,
    y: 1.2,
    w: 1,
    h: 1,
  });
  const output = await pptx.write({ outputType: 'nodebuffer' });
  const bytes = Buffer.isBuffer(output) ? output : Buffer.from(output);
  assert.ok(bytes.length > 1_000, 'generated PPTX is unexpectedly empty');

  const reopened = await JSZip.loadAsync(bytes);
  assert.ok(reopened.file('[Content_Types].xml'), 'PPTX content-types part is missing');
  assert.ok(reopened.file('ppt/slides/slide1.xml'), 'generated slide cannot be reopened');
  assert.ok(
    Object.keys(reopened.files).some((name) => /^ppt\/media\/.*\.png$/i.test(name)),
    'generated PNG media cannot be reopened'
  );
  assert.equal(imageSizeLoadAttempts, 0, 'image-size was reached while generating the real PPTX');
  process.stdout.write(
    `SEC-PRIV-001 PPTX reachability PASS: pptxgenjs=${manifest.version}, bundles=${executableFiles.length}, bytes=${bytes.length}, imageSizeLoads=0, reopen=PASS\n`
  );
} finally {
  Module._load = originalLoad;
}
