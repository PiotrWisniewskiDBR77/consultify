import { test, expect } from '@playwright/test';

test('debug page content', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    await page.goto('/', { waitUntil: 'networkidle' });
    const content = await page.content();
    console.log('PAGE CONTENT LENGTH:', content.length);
    
    await page.screenshot({ path: 'debug-screenshot.png' });
    
    const rootHtml = await page.locator('#root').innerHTML();
    console.log('ROOT HTML LENGTH:', rootHtml.length);
});
