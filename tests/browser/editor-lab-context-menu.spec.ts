import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

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

test('hierarchy disclosure only toggles rows with children', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');

  const blueBox = page.locator('[data-editor-hierarchy-id="lab_box_01"]');
  const starterGroup = page.locator('[data-editor-hierarchy-id="lab_group_01"]');
  await expect(blueBox).toHaveAttribute('data-editor-hierarchy-can-have-children', 'true');
  await expect(starterGroup).toHaveAttribute('data-editor-hierarchy-can-have-children', 'true');
  await expect(blueBox.locator('[data-editor-hierarchy-toggle]')).toHaveCount(0);
  await expect(starterGroup.locator('[data-editor-hierarchy-toggle]')).toHaveCount(1);

  await starterGroup.locator('[data-editor-hierarchy-toggle]').click();
  await expect(blueBox).toBeHidden();
  await page.locator('[data-editor-hierarchy-id="lab_sphere_01"]').click();
  await expect(page.locator('text=lab_sphere_01')).toBeVisible();
});

test('hierarchy root is protected and group selection creates a real group', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');

  const root = page.locator('[data-editor-hierarchy-id="lab_root"]');
  await expect(root).toContainText('protected');
  await expect(root).toHaveJSProperty('draggable', false);

  await root.click({ button: 'right' });
  const menu = page.locator('[data-editor-context-menu]');
  await expect(menu).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Rename' })).toBeDisabled();
  await expect(page.getByRole('menuitem', { name: 'Delete Delete' })).toBeDisabled();
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: 'Blue Box' }).click();
  await page.getByRole('button', { name: 'Green Sphere' }).click({ modifiers: ['Shift'] });
  await page.getByRole('button', { name: 'Blue Box' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: 'Group Selection' }).click();

  const grouped = await page.evaluate(() => {
    const documentState = window.__FPS_EDITOR_LAB__?.getDocument();
    const group = documentState?.scene.gameObjects.find(gameObject => (
      gameObject.kind === 'group'
      && gameObject.id !== 'lab_root'
      && gameObject.id !== 'lab_group_01'
      && gameObject.name === 'Group'
    ));
    return group
      ? {
          groupId: group.id,
          parentId: group.parentId,
          boxParentId: documentState?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')?.parentId,
          sphereParentId: documentState?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_sphere_01')?.parentId,
          order: documentState?.scene.gameObjects.map(gameObject => gameObject.id),
        }
      : null;
  });
  expect(grouped).toMatchObject({
    parentId: 'lab_root',
    boxParentId: grouped?.groupId,
    sphereParentId: grouped?.groupId,
  });
  expect(grouped?.order).toEqual([
    'lab_root',
    'lab_group_01',
    grouped?.groupId,
    'lab_box_01',
    'lab_sphere_01',
  ]);
  await expect(page.locator(`[data-editor-hierarchy-id="${grouped?.groupId}"]`)).toBeVisible();
});

test('hierarchy drag drop updates parent and sibling order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-editor-lab-status]')).toContainText('mode=editor');

  await dispatchHierarchyDrag(page, 'lab_sphere_01', 'lab_group_01', 'before');
  await expect.poll(() => readHierarchySnapshot(page)).toMatchObject({
    sphereParentId: 'lab_root',
    order: ['lab_root', 'lab_sphere_01', 'lab_group_01', 'lab_box_01'],
  });

  await dispatchHierarchyDrag(page, 'lab_sphere_01', 'lab_root', 'before');
  await expect.poll(() => readHierarchySnapshot(page)).toMatchObject({
    sphereParentId: 'lab_root',
    order: ['lab_root', 'lab_sphere_01', 'lab_group_01', 'lab_box_01'],
  });

  await page.locator('[data-editor-hierarchy-id="lab_group_01"] [data-editor-hierarchy-toggle]').click();
  await expect(page.locator('[data-editor-hierarchy-id="lab_box_01"]')).toBeHidden();

  await dispatchHierarchyDrag(page, 'lab_sphere_01', 'lab_group_01', 'near-inside', { dropOnRootAfterDragOver: true });
  await expect.poll(() => readHierarchySnapshot(page)).toMatchObject({
    sphereParentId: 'lab_group_01',
    order: ['lab_root', 'lab_group_01', 'lab_box_01', 'lab_sphere_01'],
  });
  await expect(page.locator('[data-editor-hierarchy-id="lab_box_01"]')).toBeVisible();
  await expect(page.locator('[data-editor-hierarchy-id="lab_sphere_01"]')).toBeVisible();

  await dispatchHierarchyDrag(page, 'lab_sphere_01', null, 'root');
  await expect.poll(() => readHierarchySnapshot(page)).toMatchObject({
    sphereParentId: 'lab_root',
    order: ['lab_root', 'lab_group_01', 'lab_box_01', 'lab_sphere_01'],
  });
});

async function dispatchHierarchyDrag(
  page: Page,
  sourceId: string,
  targetId: string | null,
  placement: 'inside' | 'near-inside' | 'before' | 'after' | 'root',
  options: { dropOnRootAfterDragOver?: boolean } = {},
): Promise<void> {
  await page.evaluate(({ sourceId, targetId, placement, dropOnRootAfterDragOver }) => {
    const source = document.querySelector<HTMLElement>(`[data-editor-hierarchy-id="${sourceId}"]`);
    const target = targetId
      ? document.querySelector<HTMLElement>(`[data-editor-hierarchy-id="${targetId}"]`)
      : document.querySelector<HTMLElement>('[data-editor-hierarchy-root-drop]');
    if (!source || !target) throw new Error(`missing hierarchy drag target ${sourceId} -> ${targetId ?? 'root'}`);
    const dataTransfer = new DataTransfer();
    const sourceRect = source.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const clientY = placement === 'before'
      ? targetRect.top + 1
      : placement === 'after'
        ? targetRect.bottom - 1
        : placement === 'near-inside'
          ? targetRect.top + targetRect.height * 0.18
          : targetRect.top + targetRect.height / 2;
    source.dispatchEvent(new DragEvent('dragstart', {
      bubbles: true,
      cancelable: true,
      clientX: sourceRect.left + sourceRect.width / 2,
      clientY: sourceRect.top + sourceRect.height / 2,
      dataTransfer,
    }));
    target.dispatchEvent(new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      clientX: targetRect.left + targetRect.width / 2,
      clientY,
      dataTransfer,
    }));
    const currentTarget = dropOnRootAfterDragOver
      ? document.querySelector<HTMLElement>('[data-editor-hierarchy-root-drop]')
      : (targetId
          ? document.querySelector<HTMLElement>(`[data-editor-hierarchy-id="${targetId}"]`)
          : document.querySelector<HTMLElement>('[data-editor-hierarchy-root-drop]'));
    if (!currentTarget) throw new Error(`missing hierarchy drop target ${targetId ?? 'root'}`);
    const currentTargetRect = currentTarget.getBoundingClientRect();
    const dropClientY = placement === 'before'
      ? currentTargetRect.top + 1
      : placement === 'after'
        ? currentTargetRect.bottom - 1
        : placement === 'near-inside'
          ? currentTargetRect.top + currentTargetRect.height * 0.18
          : currentTargetRect.top + currentTargetRect.height / 2;
    currentTarget.dispatchEvent(new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      clientX: currentTargetRect.left + currentTargetRect.width / 2,
      clientY: dropClientY,
      dataTransfer,
    }));
    source.dispatchEvent(new DragEvent('dragend', {
      bubbles: true,
      cancelable: true,
      dataTransfer,
    }));
  }, { sourceId, targetId, placement, dropOnRootAfterDragOver: options.dropOnRootAfterDragOver === true });
}

async function readHierarchySnapshot(page: Page): Promise<{ sphereParentId?: string | null; order?: string[] }> {
  return page.evaluate(() => {
    const documentState = window.__FPS_EDITOR_LAB__?.getDocument();
    return {
      sphereParentId: documentState?.scene.gameObjects.find(gameObject => gameObject.id === 'lab_sphere_01')?.parentId,
      order: documentState?.scene.gameObjects.map(gameObject => gameObject.id),
    };
  });
}
