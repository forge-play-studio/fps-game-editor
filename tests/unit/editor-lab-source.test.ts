import { describe, expect, it } from 'vitest';
import {
  composeEditorTransformChain,
  composeEditorTransformMatrix,
  createEditorSession,
  editorTransformMatricesAlmostEqual,
  type EditorTransformSnapshot,
} from '@fps-games/editor-core';
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

function rotateAndScaleLabFixture(document: LabSceneDocument): LabSceneDocument {
  return {
    ...document,
    scene: {
      gameObjects: document.scene.gameObjects.map(gameObject => {
        if (gameObject.id === 'lab_root') {
          return {
            ...gameObject,
            transform: {
              ...gameObject.transform,
              rotation: { x: 0, y: Math.PI / 6, z: 0 },
              scale: { x: 1.5, y: 1.5, z: 1.5 },
            },
          };
        }
        if (gameObject.id === 'lab_group_01') {
          return {
            ...gameObject,
            transform: {
              ...gameObject.transform,
              rotation: { x: 0.1, y: -0.25, z: 0.05 },
              scale: { x: 0.5, y: 0.5, z: 0.5 },
            },
          };
        }
        return gameObject;
      }),
    },
  };
}

function getLabWorldTransform(document: LabSceneDocument, id: string) {
  const byId = new Map(document.scene.gameObjects.map(gameObject => [gameObject.id, gameObject]));
  const chain: EditorTransformSnapshot[] = [];
  const seen = new Set<string>();
  let cursor = byId.get(id);
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    chain.unshift(cursor.transform);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return chain.length > 0 ? composeEditorTransformChain(chain) : null;
}

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

  it('moves hierarchy nodes with parent changes and persistent sibling order', () => {
    const adapter = createLabDocumentAdapter();
    let document = createLabSceneDocument();

    const reorder = adapter.createSceneGraphMovePatch!(document, {
      ids: ['lab_sphere_01'],
      targetId: 'lab_group_01',
      placement: 'before',
      parentId: 'lab_root',
      beforeId: 'lab_group_01',
      preserveWorldTransform: true,
    })!;
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: reorder.patch });
    expect(document.scene.gameObjects.map(gameObject => gameObject.id)).toEqual([
      'lab_root',
      'lab_sphere_01',
      'lab_group_01',
      'lab_box_01',
    ]);

    const moveInside = adapter.createSceneGraphMovePatch!(document, {
      ids: ['lab_sphere_01'],
      targetId: 'lab_group_01',
      placement: 'inside',
      parentId: 'lab_group_01',
      preserveWorldTransform: true,
    })!;
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: moveInside.patch });
    expect(findLabGameObject(document, 'lab_sphere_01')?.parentId).toBe('lab_group_01');
    expect(document.scene.gameObjects.map(gameObject => gameObject.id)).toEqual([
      'lab_root',
      'lab_group_01',
      'lab_box_01',
      'lab_sphere_01',
    ]);

    const moveInsideObject = adapter.createSceneGraphMovePatch!(document, {
      ids: ['lab_sphere_01'],
      targetId: 'lab_box_01',
      placement: 'inside',
      parentId: 'lab_box_01',
      preserveWorldTransform: true,
    })!;
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: moveInsideObject.patch });
    expect(findLabGameObject(document, 'lab_sphere_01')?.parentId).toBe('lab_box_01');
    expect(document.scene.gameObjects.map(gameObject => gameObject.id)).toEqual([
      'lab_root',
      'lab_group_01',
      'lab_box_01',
      'lab_sphere_01',
    ]);
  });

  it('groups selected hierarchy nodes as a real transform group through undoable document patches', () => {
    const adapter = createLabDocumentAdapter();
    const document = createLabSceneDocument();
    const session = createEditorSession<LabSceneDocument, LabScenePatch>({
      persistedDocument: document,
      reduceDocument: adapter.reduceDocument,
    });
    const group = adapter.createSceneGraphGroupSelectionPatch!(document, {
      ids: ['lab_box_01', 'lab_sphere_01'],
      parentId: null,
      name: 'Selection Group',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })!;

    const patched = session.dispatch({
      type: 'document.patch',
      label: group.label,
      patch: group.patch,
    });
    const workingDocument = patched.workingDocument;
    const groupObject = findLabGameObject(workingDocument, group.createdId)!;
    expect(patched.dirty).toBe(true);
    expect(groupObject).toMatchObject({
      name: 'Selection Group',
      parentId: 'lab_root',
      kind: 'group',
    });
    expect(groupObject.transform.position).toEqual({ x: -0.04999999999999993, y: 0.525, z: 0.15 });
    expect(findLabGameObject(workingDocument, 'lab_box_01')?.parentId).toBe(group.createdId);
    expect(findLabGameObject(workingDocument, 'lab_sphere_01')?.parentId).toBe(group.createdId);
    expect(findLabGameObject(workingDocument, 'lab_box_01')?.transform.position.x).toBeCloseTo(-1.35);
    expect(findLabGameObject(workingDocument, 'lab_sphere_01')?.transform.position.x).toBeCloseTo(1.35);
    expect(workingDocument.scene.gameObjects.map(gameObject => gameObject.id)).toEqual([
      'lab_root',
      'lab_group_01',
      group.createdId,
      'lab_box_01',
      'lab_sphere_01',
    ]);

    const undone = session.undo();
    expect(findLabGameObject(undone!.workingDocument, group.createdId)).toBeNull();
    const redone = session.redo();
    expect(findLabGameObject(redone!.workingDocument, group.createdId)?.parentId).toBe('lab_root');
  });

  it('exposes hierarchy metadata for root and editable objects', () => {
    const items = getLabHierarchyItems(createLabSceneDocument());
    const root = items.find(item => item.id === 'lab_root');
    const box = items.find(item => item.id === 'lab_box_01');

    expect(root).toMatchObject({ role: 'root', selectable: false, locked: true, protected: true, canHaveChildren: true });
    expect(box).toMatchObject({ role: 'object', selectable: true, locked: false, canHaveChildren: true });
  });

  it('allows mesh objects with transforms to receive child groups and group selection', () => {
    const adapter = createLabDocumentAdapter();
    let document = createLabSceneDocument();

    const childGroup = adapter.createSceneGraphCreateGroupPatch!(document, {
      parentId: 'lab_box_01',
      activeId: 'lab_box_01',
      name: 'Box Child Group',
    })!;
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: childGroup.patch });
    expect(findLabGameObject(document, childGroup.createdId)).toMatchObject({
      parentId: 'lab_box_01',
      kind: 'group',
    });

    const grouped = adapter.createSceneGraphGroupSelectionPatch!(document, {
      ids: ['lab_sphere_01'],
      parentId: 'lab_box_01',
      name: 'Socket Group',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })!;
    document = adapter.reduceDocument(document, { type: 'document.patch', patch: grouped.patch });
    expect(findLabGameObject(document, grouped.createdId)?.parentId).toBe('lab_box_01');
    expect(findLabGameObject(document, 'lab_sphere_01')?.parentId).toBe(grouped.createdId);
  });

  it('preserves world transform for move undo and redo under rotated and scaled lab parents', () => {
    const adapter = createLabDocumentAdapter();
    const document = rotateAndScaleLabFixture(createLabSceneDocument());
    const session = createEditorSession<LabSceneDocument, LabScenePatch>({
      persistedDocument: document,
      reduceDocument: adapter.reduceDocument,
    });
    const beforeWorld = getLabWorldTransform(document, 'lab_sphere_01')!;
    const move = adapter.createSceneGraphMovePatch!(document, {
      ids: ['lab_sphere_01'],
      targetId: 'lab_group_01',
      placement: 'inside',
      parentId: 'lab_group_01',
      preserveWorldTransform: true,
    })!;

    const patched = session.dispatch({
      type: 'document.patch',
      label: move.label,
      patch: move.patch,
    });
    expect(findLabGameObject(patched.workingDocument, 'lab_sphere_01')?.parentId).toBe('lab_group_01');
    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(getLabWorldTransform(patched.workingDocument, 'lab_sphere_01')!),
      composeEditorTransformMatrix(beforeWorld),
    )).toBe(true);

    const undone = session.undo()!;
    expect(findLabGameObject(undone.workingDocument, 'lab_sphere_01')?.parentId).toBe('lab_root');
    const redone = session.redo()!;
    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(getLabWorldTransform(redone.workingDocument, 'lab_sphere_01')!),
      composeEditorTransformMatrix(beforeWorld),
    )).toBe(true);
  });

  it('rejects lab moves that would require shear under rotated non-uniform parents', () => {
    const adapter = createLabDocumentAdapter();
    const document = {
      ...createLabSceneDocument(),
      scene: {
        gameObjects: createLabSceneDocument().scene.gameObjects.map(gameObject => (
          gameObject.id === 'lab_box_01'
            ? {
                ...gameObject,
                transform: {
                  ...gameObject.transform,
                  rotation: { x: 0, y: Math.PI / 4, z: 0 },
                  scale: { x: 2, y: 1, z: 1 },
                },
              }
            : gameObject
        )),
      },
    };

    expect(adapter.validateSceneGraphMove!(document, {
      ids: ['lab_sphere_01'],
      targetId: 'lab_box_01',
      placement: 'inside',
      parentId: 'lab_box_01',
      preserveWorldTransform: true,
    }).ok).toBe(false);
    expect(adapter.createSceneGraphMovePatch!(document, {
      ids: ['lab_sphere_01'],
      targetId: 'lab_box_01',
      placement: 'inside',
      parentId: 'lab_box_01',
      preserveWorldTransform: true,
    })).toBeNull();
  });

  it('rejects create group under explicit lab nodes without transform parenting capability', () => {
    const adapter = createLabDocumentAdapter();
    const document: LabSceneDocument = {
      ...createLabSceneDocument(),
      scene: {
        gameObjects: [
          ...createLabSceneDocument().scene.gameObjects,
          {
            id: 'lab_marker_no_transform',
            name: 'Marker',
            parentId: 'lab_root',
            active: true,
            kind: 'group',
            transform: undefined as never,
          },
        ],
      },
    };

    expect(getLabHierarchyItems(document).find(item => item.id === 'lab_marker_no_transform')).toMatchObject({
      role: 'object',
      canHaveChildren: false,
    });
    expect(adapter.createSceneGraphCreateGroupPatch!(document, {
      parentId: 'lab_marker_no_transform',
      activeId: 'lab_marker_no_transform',
      name: 'Invalid Child Group',
    })).toBeNull();
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
