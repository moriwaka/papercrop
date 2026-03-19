const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const ROOT_DIR = path.resolve(__dirname, '../..');
const APP_HTML = fs.readFileSync(path.join(ROOT_DIR, 'index.html'), 'utf8')
  .replace(/<link rel="stylesheet" href="styles\.css" \/>/, '')
  .replace(/<script src="edge-mask\.js"><\/script>\s*/, '')
  .replace(/<script src="ui-state\.js"><\/script>\s*/, '')
  .replace(/<script src="app\.js"><\/script>\s*/, '');
const APP_CSS = fs.readFileSync(path.join(ROOT_DIR, 'styles.css'), 'utf8');
const EDGE_MASK_JS = fs.readFileSync(path.join(ROOT_DIR, 'edge-mask.js'), 'utf8');
const UI_STATE_JS = fs.readFileSync(path.join(ROOT_DIR, 'ui-state.js'), 'utf8');
const APP_JS = fs.readFileSync(path.join(ROOT_DIR, 'app.js'), 'utf8');

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">
  <rect width="160" height="120" fill="#f4f1ea"/>
  <rect x="12" y="12" width="136" height="96" fill="#d5c4a1"/>
  <circle cx="50" cy="48" r="18" fill="#6b8f71"/>
  <circle cx="112" cy="74" r="22" fill="#bc6c25"/>
</svg>
`.trim();

async function loadApp(page){
  await page.setContent(APP_HTML, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: APP_CSS });
  await page.addScriptTag({ content: EDGE_MASK_JS });
  await page.addScriptTag({ content: UI_STATE_JS });
  await page.addScriptTag({ content: APP_JS });
}

test('uploads, selects, and crops an image in the browser', async ({ page }) => {
  await loadApp(page);

  await page.setInputFiles('#fileInput', {
    name: 'sample.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(SAMPLE_SVG)
  });

  await expect(page.locator('#srcDropZone')).toHaveClass(/has-image/);
  await expect(page.locator('#selectionHint')).toContainText('select a crop area');

  const srcCanvas = page.locator('#srcCanvas');
  const box = await srcCanvas.boundingBox();
  if (!box) throw new Error('Source canvas was not rendered');

  await page.mouse.move(box.x + 50, box.y + 45);
  await page.mouse.down();
  await page.mouse.move(box.x + 145, box.y + 110, { steps: 8 });
  await page.mouse.up();

  await expect(page.locator('#selectionHint')).toContainText('Ready to crop.');
  await expect(page.locator('#cropBtn')).toBeEnabled();

  await page.click('#cropBtn');

  await expect(page.locator('#downloadBtn')).toBeEnabled();
  await expect(page.locator('#copyBtn')).toBeEnabled();

  const output = await page.locator('#outCanvas').evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height
  }));

  expect(output.width).toBeGreaterThan(0);
  expect(output.height).toBeGreaterThan(0);
});
