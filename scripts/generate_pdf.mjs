import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { html } from './build_template_guide.mjs';

async function main() {
  const pdfOutPath = path.resolve('/Volumes/SSD_DATA/posting-map/docs/manuals/POSTING MAP ご利用ガイド.pdf');
  const artifactDir = '/Users/katsujiiwasa/.gemini/antigravity-ide/brain/3e42837e-56f3-4eb8-b1df-73103a874142';
  const artifactPdf = path.join(artifactDir, 'POSTING_MAP_STARTER_GUIDE.pdf');
  const artifactImg = path.join(artifactDir, 'posting_map_guide_preview.png');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage({
    viewport: { width: 794, height: 1123 },
    deviceScaleFactor: 2
  });

  console.log('Rendering HTML via Playwright...');
  await page.setContent(html, { waitUntil: 'networkidle' });

  // Wait for Google Fonts to load
  await page.evaluate(() => document.fonts.ready);
  await new Promise(r => setTimeout(r, 1000));

  // Emulate print media for PDF generation
  await page.emulateMedia({ media: 'print' });

  console.log(`Generating PDF...`);
  await page.pdf({
    path: pdfOutPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    preferCSSPageSize: true
  });
  console.log(`PDF saved to: ${pdfOutPath}`);

  // Also copy to artifact dir
  fs.copyFileSync(pdfOutPath, artifactPdf);
  console.log(`PDF copied to artifact dir: ${artifactPdf}`);

  // Reset to screen media for visual preview screenshot
  await page.emulateMedia({ media: 'screen' });

  const sheet = await page.$('.sheet');
  if (sheet) {
    await sheet.screenshot({ path: artifactImg });
    console.log(`High-res screenshot saved to: ${artifactImg}`);
  }

  await browser.close();
}

main().catch(console.error);
