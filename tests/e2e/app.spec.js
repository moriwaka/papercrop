const { test, expect } = require('@playwright/test');

const SAMPLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="120" viewBox="0 0 160 120">
  <rect width="160" height="120" fill="#f4f1ea"/>
  <rect x="12" y="12" width="136" height="96" fill="#d5c4a1"/>
  <circle cx="50" cy="48" r="18" fill="#6b8f71"/>
  <circle cx="112" cy="74" r="22" fill="#bc6c25"/>
</svg>
`.trim();

test('uploads, selects, and crops an image in the browser', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

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
