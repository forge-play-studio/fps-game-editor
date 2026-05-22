import { describe, expect, it } from 'vitest';
import { createEditorSession } from '@fps-games/editor-core';
import {
  collectLabSubtreeIds,
  createLabAuthoringHost,
  createLabDocumentAdapter,
  createLabProjectStore,
  createLabSceneDocument,
  findLabGameObject,
  getLabHierarchyItems,
  reduceLabSceneDocument,
  type LabSceneDocument,
  type LabScenePatch,
} from '../../examples/editor-lab/src/lab-project';

describe('editor-lab authoring source', () => {
  it('loads, saves with revision increment, and compiles a runtime artifact', async () => {
    const store = createLabProjectStore();
    const host = createLabAuthoringHost(store);
    const loaded = await host.loadSource<LabSceneDocument>({ sourceId: 'lab.scene', sourceType: 'scene' });

    expect(loaded.ok).toBe(true);
    expect(loaded.source?.ref.revision).toBe(1);
    expect(loaded.document?.scene.gameObjects.length).toBeGreaterThan(0);

    host.registerSource(loaded.source!);
    const nextDocument = reduceLabSceneDocument(loaded.document!, {
      type: 'document.patch',
      patch: { kind: 'game-object.rename', id: 'lab_box_01', name: 'Renamed Box' },
    });
    const saved = await host.commitSource<LabSceneDocument>({
      source: loaded.source!,
      document: nextDocument,
      expectedRevision: loaded.source!.ref.revision,
    });

    expect(saved.ok).toBe(true);
    expect(saved.source?.ref.revision).toBe(2);
    expect(saved.artifacts?.[0]?.artifactType).toBe('lab-runtime-scene');
    expect(findLabGameObject(saved.document!, 'lab_box_01')?.name).toBe('Renamed Box');
  });

  it('rejects stale expected revisions', async () => {
    const store = createLabProjectStore();
    const host = createLabAuthoringHost(store);
    const loaded = await host.loadSource<LabSceneDocument>({ sourceId: 'lab.scene', sourceType: 'scene' });
    host.registerSource(loaded.source!);

    const result = await host.commitSource<LabSceneDocument>({
      source: loaded.source!,
      document: loaded.document!,
      expectedRevision: 0,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('source_revision_mismatch');
  });

  it('rejects invalid documents before saving', async () => {
    const store = createLabProjectStore();
    const host = createLabAuthoringHost(store);
    const loaded = await host.loadSource<LabSceneDocument>({ sourceId: 'lab.scene', sourceType: 'scene' });
    host.registerSource(loaded.source!);
    const invalid = {
      ...loaded.document!,
      scene: { gameObjects: loaded.document!.scene.gameObjects.filter(gameObject => gameObject.id !== 'lab_root') },
    };

    const result = await host.commitSource<LabSceneDocument>({
      source: loaded.source!,
      document: invalid,
      expectedRevision: loaded.source!.ref.revision,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('source_validation_failed');
    expect(store.getRevision()).toBe(1);
  });

  it('preserves revision and reports source_save_failed when save throws', async () => {
    const store = createLabProjectStore();
    const host = createLabAuthoringHost(store);
    const loaded = await host.loadSource<LabSceneDocument>({ sourceId: 'lab.scene', sourceType: 'scene' });
    host.registerSource(loaded.source!);
    store.failNextSave('forced save failure');

    const result = await host.commitSource<LabSceneDocument>({
      source: loaded.source!,
      document: reduceLabSceneDocument(loaded.document!, {
        type: 'document.patch',
        patch: { kind: 'game-object.rename', id: 'lab_box_01', name: 'Will Not Save' },
      }),
      expectedRevision: loaded.source!.ref.revision,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('source_save_failed');
    expect(store.getRevision()).toBe(1);
    expect(findLabGameObject(store.getSavedDocument(), 'lab_box_01')?.name).toBe('Blue Box');
  });
});

describe('editor-lab session and hierarchy fixtures', () => {
  it('tracks dirty state through patch, undo, redo, and markSaved', () => {
    const document = createLabSceneDocument();
    const session = createEditorSession<LabSceneDocument, LabScenePatch>({
      persistedDocument: document,
      reduceDocument: reduceLabSceneDocument,
    });

    const patched = session.dispatch({
      type: 'document.patch',
      label: 'Move Box',
      patch: {
        kind: 'game-object.transform',
        id: 'lab_box_01',
        transform: { position: { x: 3, y: 0.5, z: 0 } },
      },
    });

    expect(patched.dirty).toBe(true);
    expect(session.canUndo()).toBe(true);
    expect(findLabGameObject(patched.workingDocument, 'lab_box_01')?.transform.position.x).toBe(3);

    const undone = session.undo();
    expect(undone?.dirty).toBe(false);
    expect(findLabGameObject(undone!.workingDocument, 'lab_box_01')?.transform.position.x).toBe(-1.4);

    const redone = session.redo();
    expect(redone?.dirty).toBe(true);
    session.markSaved(redone!.workingDocument);
    expect(session.getState().dirty).toBe(false);
  });

  it('supports rename, create group, subtree delete, and inside reparent fixtures', () => {
    const adapter = createLabDocumentAdapter();
    let document = createLabSceneDocument();

    document = adapter.reduceDocument(document, {
      type: 'document.patch',
      patch: adapter.createSceneGraphRenamePatch!(document, { id: 'lab_box_01', name: 'Box Prime' })!.patch,
    });
    expect(findLabGameObject(document, 'lab_box_01')?.name).toBe('Box Prime');

    const createGroup = adapter.createSceneGraphCreateGroupPatch!(document, {
      parentId: 'lab_root',
      activeId: 'lab_root',
      name: 'Nested Group',
    })!;
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: createGroup.patch });
    expect(findLabGameObject(document, createGroup.createdId)?.parentId).toBe('lab_root');

    const drop = adapter.createSceneGraphDropPatch!(document, {
      draggedId: 'lab_sphere_01',
      targetId: createGroup.createdId,
      placement: 'inside',
      preserveWorldTransform: true,
    })!;
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: drop.patch });
    expect(findLabGameObject(document, 'lab_sphere_01')?.parentId).toBe(createGroup.createdId);

    const deletePatch = adapter.createSceneGraphDeletePatch!(document, {
      ids: [createGroup.createdId],
      activeId: createGroup.createdId,
    })!;
    expect([...collectLabSubtreeIds(document, [createGroup.createdId])]).toContain('lab_sphere_01');
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: deletePatch.patch });
    expect(findLabGameObject(document, createGroup.createdId)).toBeNull();
    expect(findLabGameObject(document, 'lab_sphere_01')).toBeNull();
  });

  it('exposes hierarchy metadata for root and editable objects', () => {
    const items = getLabHierarchyItems(createLabSceneDocument());
    const root = items.find(item => item.id === 'lab_root');
    const box = items.find(item => item.id === 'lab_box_01');

    expect(root).toMatchObject({ selectable: false, locked: true, canHaveChildren: true });
    expect(box).toMatchObject({ selectable: true, locked: false, canHaveChildren: false });
  });

  it('creates multi-select transform patches only for shared transform fields', () => {
    const adapter = createLabDocumentAdapter();
    const document = createLabSceneDocument();
    const transformPatch = adapter.createSerializedMultiPropertyPatch!({
      document,
      targetIds: ['lab_box_01', 'lab_sphere_01'],
      activeId: 'lab_box_01',
      path: 'transform.position.x',
      value: 4,
    });

    expect(transformPatch?.patch).toMatchObject({
      kind: 'game-object.transform-batch',
      transforms: {
        lab_box_01: { position: { x: 4, y: 0.5, z: 0 } },
        lab_sphere_01: { position: { x: 4, y: 0.55, z: 0.3 } },
      },
    });

    const renamePatch = adapter.createSerializedMultiPropertyPatch!({
      document,
      targetIds: ['lab_box_01', 'lab_sphere_01'],
      activeId: 'lab_box_01',
      path: 'gameObject.name',
      value: 'Shared Name',
    });

    expect(renamePatch).toBeNull();
  });
});
