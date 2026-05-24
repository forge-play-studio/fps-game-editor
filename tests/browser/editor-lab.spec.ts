import { expect, test } from '@playwright/test';

test('editor-lab opens EditorWorld and supports selection, edit, undo, redo, and save', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');
  const dirtyBadge = page.locator('[data-editor-dirty-badge]');
  const canvas = page.locator('canvas#editor-lab-canvas');
  await expect(canvas).toBeVisible();

  const canvasScreenshot = await canvas.screenshot();
  expect(canvasScreenshot.length).toBeGreaterThan(1_000);

  await page.getByRole('button', { name: 'Blue Box' }).click();
  await expect(page.getByRole('heading', { name: 'GameObject' })).toBeVisible();

  const xInput = page.locator('input[data-serialized-path="transform.position.x"]').first();
  await xInput.fill('2.5');
  await expect(dirtyBadge).toBeVisible();

  const movedX = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.transform.position.x);
  expect(movedX).toBe(2.5);

  await page.getByRole('button', { name: '撤销' }).click();
  const undoneX = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.transform.position.x);
  expect(undoneX).toBe(-1.4);

  await page.getByRole('button', { name: '重做' }).click();
  const redoneX = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.transform.position.x);
  expect(redoneX).toBe(2.5);

  await page.getByRole('button', { name: '本地测试' }).click();
  await page.getByRole('button', { name: '保存场景' }).click();
  await expect(page.locator('[data-editor-lab-status]')).toContainText('revision=2');
  await expect(dirtyBadge).toBeHidden();
});

test('editor-lab inspector edits boolean, enum asset, and color fields', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');
  const dirtyBadge = page.locator('[data-editor-dirty-badge]');
  await page.getByRole('button', { name: 'Blue Box' }).click();

  const activeInput = page.locator('input[data-serialized-path="gameObject.active"]');
  await expect(activeInput).toBeChecked();
  await activeInput.uncheck();
  await expect(dirtyBadge).toBeVisible();
  const activeValue = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.active);
  expect(activeValue).toBe(false);

  const assetSelect = page.locator('select[data-serialized-path="renderer.assetId"]');
  await expect(assetSelect).toHaveValue('asset_box');
  await assetSelect.selectOption('asset_marker');
  const assetValue = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.assetId);
  expect(assetValue).toBe('asset_marker');

  const tintInput = page.locator('input[data-serialized-path="appearance.tint"]');
  await expect(tintInput).toHaveAttribute('type', 'color');
  await tintInput.evaluate((element) => {
    const input = element as HTMLInputElement;
    input.value = '#ff3366';
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const tintValue = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.tint);
  expect(tintValue?.r).toBeCloseTo(1, 3);
  expect(tintValue?.g).toBeCloseTo(0.2, 3);
  expect(tintValue?.b).toBeCloseTo(0.4, 3);
});

test('editor-lab inspector shows mixed values for multi-selection', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');

  await page.getByRole('button', { name: 'Blue Box' }).click();
  await page.keyboard.down('Shift');
  await page.getByRole('button', { name: 'Green Sphere' }).click();
  await page.keyboard.up('Shift');

  await expect(page.getByRole('heading', { name: 'Selection' })).toBeVisible();
  await expect(page.getByText('Count')).toBeVisible();
  await expect(page.getByText('2', { exact: true })).toBeVisible();

  const mixedX = page.locator('input[data-serialized-path="transform.position.x"]').first();
  await expect(mixedX).toHaveValue('');
  await expect(mixedX).toHaveAttribute('placeholder', '--');
});
