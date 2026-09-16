import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const baseUrl = process.env.PMO1_BASE_URL || 'http://127.0.0.1:4214';
const output = path.resolve('evidence/pmo-1a-w109');
const screens = ['pmo1-kolejki', 'pmo1-przejscie-etapu'];
const themes = ['light', 'dark'];

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(foreground, background) {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

await fs.mkdir(path.join(output, 'screenshots'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const receipt = { generatedAt: new Date().toISOString(), minimumRatio: Number.POSITIVE_INFINITY, screens: [] };

for (const screen of screens) {
  for (const theme of themes) {
    const url = `${baseUrl}/?screen=${screen}&lang=en&theme=${theme}&uwagi=0`;
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.locator('#dev-render-root').waitFor();
    const samples = await page.evaluate(() => {
      const parse = (raw) => {
        const values = raw.match(/[\d.]+/g)?.map(Number) ?? [];
        return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 1];
      };
      const composite = (top, bottom) => {
        const alpha = top[3] + bottom[3] * (1 - top[3]);
        if (alpha === 0) return [0, 0, 0, 0];
        return [
          (top[0] * top[3] + bottom[0] * bottom[3] * (1 - top[3])) / alpha,
          (top[1] * top[3] + bottom[1] * bottom[3] * (1 - top[3])) / alpha,
          (top[2] * top[3] + bottom[2] * bottom[3] * (1 - top[3])) / alpha,
          alpha,
        ];
      };
      const background = (element) => {
        const layers = [];
        for (let current = element; current; current = current.parentElement) {
          layers.push(parse(getComputedStyle(current).backgroundColor));
        }
        let result = [255, 255, 255, 1];
        for (const layer of layers.reverse()) result = composite(layer, result);
        return result;
      };
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const rows = [];
      const seen = new Set();
      let node;
      while ((node = walker.nextNode())) {
        const text = node.textContent?.trim();
        const element = node.parentElement;
        if (!text || !element || seen.has(element)) continue;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0 || rect.width === 0 || rect.height === 0) continue;
        seen.add(element);
        const bg = background(element);
        const fg = composite(parse(style.color), bg);
        rows.push({
          text: text.slice(0, 100),
          selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`,
          foreground: fg.slice(0, 3),
          background: bg.slice(0, 3),
        });
      }
      return rows;
    });
    const measured = samples.map((sample) => ({
      ...sample,
      ratio: Number(contrast(sample.foreground, sample.background).toFixed(2)),
    }));
    const failures = measured.filter((sample) => sample.ratio < 4.5);
    const minimumRatio = Math.min(...measured.map((sample) => sample.ratio));
    receipt.minimumRatio = Math.min(receipt.minimumRatio, minimumRatio);
    receipt.screens.push({ screen, theme, url, sampleCount: measured.length, minimumRatio, failures });
    await page.screenshot({
      path: path.join(output, 'screenshots', `${screen}-en-${theme}-1440x900.jpg`),
      type: 'jpeg',
      quality: 82,
      fullPage: false,
    });
  }
}

await browser.close();
await fs.writeFile(path.join(output, 'contrast-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ minimumRatio: receipt.minimumRatio, screens: receipt.screens.map(({ screen, theme, sampleCount, minimumRatio, failures }) => ({ screen, theme, sampleCount, minimumRatio, failures: failures.length })) }, null, 2));
if (receipt.screens.some((screen) => screen.failures.length > 0)) process.exitCode = 1;
