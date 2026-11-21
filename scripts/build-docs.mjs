/**
 * Prints docs/*.html to PDF with headless Chromium (Playwright).
 *   PLAYWRIGHT_MODULE=… PLAYWRIGHT_CHROMIUM=… node scripts/build-docs.mjs
 * Sources: docs/Technical-Documentation.html, User-Manual.html, Wireframes.html
 * (shared stylesheet docs/docs.css, screenshots in docs/screenshots/ui).
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const names = ['Technical-Documentation', 'User-Manual', 'Wireframes'];
const browser = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
for (const name of names) {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(resolve('docs', `${name}.html`)).href, { waitUntil: 'networkidle' });
  await page.pdf({
    path: resolve('docs', `${name}.pdf`),
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="font:8px Segoe UI,sans-serif;color:#777;width:100%;padding:0 16mm;display:flex;justify-content:space-between"><span>Virtual Tour &amp; Cultural Mapping — ${name.replace('-', ' ')}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '18mm', bottom: '20mm', left: '16mm', right: '16mm' },
  });
  await page.close();
  console.log('wrote', `docs/${name}.pdf`);
}
await browser.close();
