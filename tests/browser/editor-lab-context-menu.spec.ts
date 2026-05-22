import { expect, test } from '@playwright/test';

test('hierarchy context menu routes actions through EditorWorld input ownership', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');

  const blueBox = page.getByRole('button', { name: 'Blue Box' });
  const greenSphere = page.getByRole('button', { name: 'Green Sphere' });
  await expect(blueBox).toBeVisible();

  await greenSphere.click();
  await blueBox.click({ button: 'right' });
  await expect(page.locator('[data-editor-context-menu]')).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Focus in Preview F' })).toBeVisible();

  await expect(page.locator('[data-editor-panel-id="inspector"]').getByText('lab_box_01').first()).toBeVisible();

  await page.getByRole('menuitem', { name: 'Rename' }).click();
  const renameInput = page.locator('input[data-editor-hierarchy-rename-input="lab_box_01"]');
  await expect(renameInput).toBeVisible();
  await renameInput.fill('Box Context Prime');
  await renameInput.press('Enter');
  await expect(page.getByRole('button', { name: 'Box Context Prime' })).toBeVisible();
  const renamed = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.name);
  expect(renamed).toBe('Box Context Prime');

  const objectCountBeforeGroup = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.length);
  await page.getByRole('button', { name: 'Starter Group' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Add Empty Group' }).click();
  const objectCountAfterGroup = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.length);
  expect(objectCountAfterGroup).toBe((objectCountBeforeGroup ?? 0) + 1);
  await expect(page.locator('text=未保存')).toBeVisible();

  await page.getByRole('button', { name: 'Box Context Prime' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Delete Delete' }).click();
  const deleted = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.some(gameObject => gameObject.id === 'lab_box_01'));
  expect(deleted).toBe(false);

  await page.getByRole('button', { name: '撤销' }).click();
  const restored = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.some(gameObject => gameObject.id === 'lab_box_01'));
  expect(restored).toBe(true);
});

test('context menu closes cleanly and editable targets keep global shortcuts isolated', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');

  await page.getByRole('button', { name: 'Blue Box' }).click({ button: 'right' });
  await expect(page.locator('[data-editor-context-menu]')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-editor-context-menu]')).toBeHidden();

  await page.getByRole('button', { name: 'Blue Box' }).dblclick();
  const renameInput = page.locator('input[data-editor-hierarchy-rename-input="lab_box_01"]');
  await expect(renameInput).toBeVisible();
  await renameInput.fill('Transient Rename');
  await page.keyboard.press('Delete');
  const existsAfterInputDelete = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.some(gameObject => gameObject.id === 'lab_box_01'));
  expect(existsAfterInputDelete).toBe(true);
  await renameInput.press('Escape');

  await page.getByRole('button', { name: 'Blue Box' }).click();
  const xInput = page.locator('input[data-serialized-path="transform.position.x"]').first();
  await xInput.fill('3.25');
  await page.keyboard.press('Delete');
  const existsAfterInspectorDelete = await page.evaluate(() => window.__FPS_EDITOR_LAB__?.getDocument()?.scene.gameObjects.some(gameObject => gameObject.id === 'lab_box_01'));
  expect(existsAfterInspectorDelete).toBe(true);
});
