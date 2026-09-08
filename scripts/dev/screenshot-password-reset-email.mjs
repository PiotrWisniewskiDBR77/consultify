import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const evidenceDir = path.resolve(__dirname, '../../evidence/email-reset');

const targets = [
  { html: 'reset-pl.html', png: 'reset-pl.png' },
  { html: 'reset-en.html', png: 'reset-en.png' },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 700, height: 900 },
    colorScheme: 'light',
  });
  for (const t of targets) {
    const filePath = path.join(evidenceDir, t.html);
    await page.goto(`file://${filePath}`);
    await page.screenshot({ path: path.join(evidenceDir, t.png) });
    console.log('Saved', t.png);
  }
} finally {
  await browser.close();
}
