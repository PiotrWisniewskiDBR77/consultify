import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const base='http://127.0.0.1:4218/?screen=audyty-drd-report&variant=u30&lang=en';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
for (const theme of ['light','dark']) {
  await page.goto(`${base}&theme=${theme}`,{waitUntil:'networkidle'});
  await page.locator('[data-testid="audit-report-document-view"]').waitFor({state:'visible'});
  await page.addStyleTag({content:'[data-dev-render-chrome], .dev-render-chrome { display:none !important; }'});
  const body=(await page.locator('[data-testid="audit-report-document-view"]').innerText()).replace(/\s+/g,' ').trim();
  const required=['Audits','Reports','Published','Download DOCX','Download PDF','Executive summary','Systemic conclusions','Verification plan'];
  const forbidden=['Audyty','Raporty','Opublikowany','Pobierz DOCX','Wnioski systemowe','Plan weryfikacji','Wymagany status'];
  const missing=required.filter((x)=>!body.includes(x));
  const leaked=forbidden.filter((x)=>body.includes(x));
  if (missing.length || leaked.length) throw new Error(`${theme}: missing=${missing.join('|')} leaked=${leaked.join('|')} body=${body}`);
  await page.screenshot({path:`evidence/i18n-u30-audits-reports-20260916/u30-en-${theme}.png`,fullPage:false});
  await fs.writeFile(`evidence/i18n-u30-audits-reports-20260916/u30-en-${theme}.txt`,body+'\n');
}
await browser.close();
