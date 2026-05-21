import { expect, test } from '@playwright/test';

test('editor-lab opens EditorWorld and supports selection, edit, undo, redo, and save', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');
  const canvas = page.locator('canvas#editor-lab-canvas');
  await expect(canvas).toBeVisible();

  const canvasScreenshot = await canvas.screenshot();
  expect(canvasScreenshot.length).toBeGreaterThan(1_000);

  await page.getByRole('button', { name: 'Blue Box' }).click();
  await expect(page.getByRole('heading', { name: 'GameObject' })).toBeVisible();

  const xInput = page.locator('input[data-serialized-path="transform.position.x"]').first();
  await xInput.fill('2.5');
  await expect(page.locator('text=未保存')).toBeVisible();

  const movedX = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.transform.position.x);
  expect(movedX).toBe(2.5);

  await page.getByRole('button', { name: '撤销' }).click();
  const undoneX = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.transform.position.x);
  expect(undoneX).toBe(-1.4);

  await page.getByRole('button', { name: '重做' }).click();
  const redoneX = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.transform.position.x);
  expect(redoneX).toBe(2.5);

  await page.getByRole('button', { name: '保存场景' }).click();
  await expect(page.locator('[data-editor-lab-status]')).toContainText('revision=2');
  await expect(page.getByText('未保存', { exact: true })).toBeHidden();
});
