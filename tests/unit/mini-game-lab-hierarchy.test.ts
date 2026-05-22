import { describe, expect, it } from 'vitest';
import { composeEditorTransformMatrix, editorTransformMatricesAlmostEqual } from '@fps-games/editor-core';
import type { EditorSceneDocument, EditorSceneGameObject } from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';
import { findEditorSceneTransform } from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';
import {
  createEditorSceneCreateGroupPatch,
  createEditorSceneGroupSelectionPatch,
  createEditorSceneHierarchyMovePatch,
  createEditorSceneReparentPatch,
  getEditorSceneGameObjectWorldTransform,
  getEditorSceneHierarchyItems,
  normalizeEditorSceneHierarchyDocument,
  reduceEditorSceneDocument,
  validateEditorSceneHierarchyMove,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session';

describe('mini-game-lab hierarchy adapter', () => {
  it('exposes protected root semantics for the editor hierarchy', () => {
    const items = getEditorSceneHierarchyItems(createMiniEditorSceneDocument());
    const root = items.find(item => item.id === 'mvp_root');
    const tree = items.find(item => item.id === 'mvp_tree_01');
    expect(root).toMatchObject({
      role: 'root',
      protected: true,
      selectable: false,
      canHaveChildren: true,
      draggable: false,
    });
    expect(tree).toMatchObject({
      role: 'object',
      protected: false,
      selectable: true,
      canHaveChildren: true,
      draggable: true,
    });
  });

  it('moves nodes across parents while preserving world transform and sibling order', () => {
    let document = createMiniEditorSceneDocument();
    const move = createEditorSceneHierarchyMovePatch(document, {
      ids: ['mvp_tree_02'],
      targetId: 'mvp_group_01',
      placement: 'before',
      parentId: 'mvp_root',
      beforeId: 'mvp_group_01',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: move.label,
      patch: move.patch,
    });
    expect(document.scene.gameObjects.map(gameObject => gameObject.id)).toEqual([
      'mvp_root',
      'mvp_tree_02',
      'mvp_group_01',
      'mvp_tree_01',
    ]);

    const worldBefore = getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')!;
    const moveInside = createEditorSceneHierarchyMovePatch(document, {
      ids: ['mvp_tree_02'],
      targetId: 'mvp_group_01',
      placement: 'inside',
      parentId: 'mvp_group_01',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: moveInside.label,
      patch: moveInside.patch,
    });
    const moved = findMiniGameObject(document, 'mvp_tree_02')!;
    expect(moved.parentId).toBe('mvp_group_01');
    expect(getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')?.position).toEqual(worldBefore.position);
    expect(findEditorSceneTransform(moved)?.position.x).toBe(6);

    const moveInsideObject = createEditorSceneHierarchyMovePatch(document, {
      ids: ['mvp_tree_02'],
      targetId: 'mvp_tree_01',
      placement: 'inside',
      parentId: 'mvp_tree_01',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: moveInsideObject.label,
      patch: moveInsideObject.patch,
    });
    const movedUnderObject = findMiniGameObject(document, 'mvp_tree_02')!;
    expect(movedUnderObject.parentId).toBe('mvp_tree_01');
    expect(getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')?.position).toEqual(worldBefore.position);
  });

  it('groups selected nodes under a real transform group at the selection center', () => {
    let document = createMiniEditorSceneDocument();
    const group = createEditorSceneGroupSelectionPatch(document, {
      ids: ['mvp_tree_01', 'mvp_tree_02'],
      parentId: 'mvp_root',
      name: 'Selection Group',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: group.label,
      patch: group.patch,
    });

    const groupObject = findMiniGameObject(document, group.createdId)!;
    const groupTransform = findEditorSceneTransform(groupObject)!;
    expect(groupObject.name).toBe('Selection Group');
    expect(groupObject.parentId).toBe('mvp_root');
    expect(groupTransform.position).toEqual({ x: 4, y: 0, z: 0 });
    expect(findMiniGameObject(document, 'mvp_tree_01')?.parentId).toBe(group.createdId);
    expect(findMiniGameObject(document, 'mvp_tree_02')?.parentId).toBe(group.createdId);
    expect(findEditorSceneTransform(findMiniGameObject(document, 'mvp_tree_01')!)?.position.x).toBe(-2);
    expect(findEditorSceneTransform(findMiniGameObject(document, 'mvp_tree_02')!)?.position.x).toBe(2);
    expect(document.scene.gameObjects.map(gameObject => gameObject.id)).toEqual([
      'mvp_root',
      'mvp_group_01',
      group.createdId,
      'mvp_tree_01',
      'mvp_tree_02',
    ]);
  });

  it('allows object GameObjects with transforms to receive child groups and group selection', () => {
    let document = createMiniEditorSceneDocument();
    const childGroup = createEditorSceneCreateGroupPatch(document, {
      parentId: 'mvp_tree_01',
      activeId: 'mvp_tree_01',
      name: 'Tree Child Group',
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: childGroup.label,
      patch: childGroup.patch,
    });
    expect(findMiniGameObject(document, childGroup.createdId)?.parentId).toBe('mvp_tree_01');

    const grouped = createEditorSceneGroupSelectionPatch(document, {
      ids: ['mvp_tree_02'],
      parentId: 'mvp_tree_01',
      name: 'Tree Socket Group',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: grouped.label,
      patch: grouped.patch,
    });
    expect(findMiniGameObject(document, grouped.createdId)?.parentId).toBe('mvp_tree_01');
    expect(findMiniGameObject(document, 'mvp_tree_02')?.parentId).toBe(grouped.createdId);
  });

  it('rejects hierarchy parenting to GameObjects without Transform components', () => {
    const document = createMiniEditorSceneDocument({
      noTransformParent: true,
    });

    expect(getEditorSceneHierarchyItems(document).find(item => item.id === 'no_transform_parent')).toMatchObject({
      role: 'group',
      canHaveChildren: false,
    });
    expect(createEditorSceneHierarchyMovePatch(document, {
      ids: ['mvp_tree_01'],
      targetId: 'no_transform_parent',
      placement: 'inside',
      parentId: 'no_transform_parent',
      preserveWorldTransform: true,
    })).toBeNull();
    expect(createEditorSceneCreateGroupPatch(document, {
      parentId: 'no_transform_parent',
      activeId: 'no_transform_parent',
      name: 'Invalid Child Group',
    })).toBeNull();
  });

  it('parents newly created asset GameObjects under the protected root without shifting world placement', () => {
    let document = createMiniEditorSceneDocument();
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: 'Add Tree',
      patch: {
        kind: 'game-object.create-from-asset',
        assetItem: {
          assetId: 'asset_tree',
          type: 'glb',
          sourceId: 'tree',
          displayName: 'Tree',
          placeable: true,
        },
      },
    });

    const created = findMiniGameObject(document, 'tree')!;
    expect(created.parentId).toBe('mvp_root');
    expect(findEditorSceneTransform(created)?.position).toEqual({ x: -10, y: 0, z: 1.8 });
    expect(getEditorSceneGameObjectWorldTransform(document, 'tree')?.position).toEqual({ x: 0, y: 0, z: 1.8 });
  });

  it('normalizes legacy rootless GameObjects under the protected root without shifting world placement', () => {
    const normalized = normalizeEditorSceneHierarchyDocument(createMiniEditorSceneDocument({
      tree02ParentId: null,
    }));
    const tree = findMiniGameObject(normalized, 'mvp_tree_02')!;

    expect(tree.parentId).toBe('mvp_root');
    expect(findEditorSceneTransform(tree)?.position).toEqual({ x: -4, y: 0, z: 0 });
    expect(getEditorSceneGameObjectWorldTransform(normalized, 'mvp_tree_02')?.position).toEqual({ x: 6, y: 0, z: 0 });
  });

  it('preserves world hierarchy moves through nested rotated and scaled parent chains', () => {
    let document = createMiniEditorSceneDocument({
      rootRotation: { x: 0, y: Math.PI / 6, z: 0 },
      rootScale: { x: 2, y: 2, z: 2 },
      groupRotation: { x: 0.1, y: -0.25, z: 0.05 },
      groupScale: { x: 0.5, y: 0.5, z: 0.5 },
    });
    const tree01WorldBefore = getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_01')!;
    const tree02WorldBefore = getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')!;

    expect(validateEditorSceneHierarchyMove(document, {
      ids: ['mvp_tree_01', 'mvp_tree_02'],
      targetId: 'mvp_group_01',
      placement: 'inside',
      parentId: 'mvp_group_01',
      preserveWorldTransform: true,
    })).toEqual({ ok: true });

    const move = createEditorSceneHierarchyMovePatch(document, {
      ids: ['mvp_tree_01', 'mvp_tree_02'],
      targetId: 'mvp_group_01',
      placement: 'inside',
      parentId: 'mvp_group_01',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: move.label,
      patch: move.patch,
    });

    expect(findMiniGameObject(document, 'mvp_tree_01')?.parentId).toBe('mvp_group_01');
    expect(findMiniGameObject(document, 'mvp_tree_02')?.parentId).toBe('mvp_group_01');
    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_01')!),
      composeEditorTransformMatrix(tree01WorldBefore),
    )).toBe(true);
    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')!),
      composeEditorTransformMatrix(tree02WorldBefore),
    )).toBe(true);
  });

  it('preserves world transform for drop reparent and group selection under object parents', () => {
    let document = createMiniEditorSceneDocument({
      tree01Rotation: { x: 0, y: Math.PI / 5, z: 0.1 },
      tree01Scale: { x: 1.25, y: 1.25, z: 1.25 },
    });
    const tree02WorldBeforeDrop = getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')!;
    const drop = createEditorSceneReparentPatch(document, {
      draggedId: 'mvp_tree_02',
      targetId: 'mvp_tree_01',
      placement: 'inside',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: drop.label,
      patch: drop.patch,
    });
    expect(findMiniGameObject(document, 'mvp_tree_02')?.parentId).toBe('mvp_tree_01');
    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')!),
      composeEditorTransformMatrix(tree02WorldBeforeDrop),
    )).toBe(true);

    const tree02WorldBeforeGroup = getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')!;
    const grouped = createEditorSceneGroupSelectionPatch(document, {
      ids: ['mvp_tree_02'],
      parentId: 'mvp_tree_01',
      name: 'Rotated Socket Group',
      pivot: 'selection-center',
      preserveWorldTransform: true,
    })!;
    document = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      label: grouped.label,
      patch: grouped.patch,
    });
    expect(findMiniGameObject(document, grouped.createdId)?.parentId).toBe('mvp_tree_01');
    expect(findMiniGameObject(document, 'mvp_tree_02')?.parentId).toBe(grouped.createdId);
    expect(editorTransformMatricesAlmostEqual(
      composeEditorTransformMatrix(getEditorSceneGameObjectWorldTransform(document, 'mvp_tree_02')!),
      composeEditorTransformMatrix(tree02WorldBeforeGroup),
    )).toBe(true);
  });

  it('rejects preserve-world hierarchy moves through zero-scale parent chains', () => {
    const document = createMiniEditorSceneDocument({
      rootScale: { x: 1, y: 0, z: 1 },
    });

    expect(validateEditorSceneHierarchyMove(document, {
      ids: ['mvp_tree_01'],
      targetId: 'mvp_group_01',
      placement: 'inside',
      parentId: 'mvp_group_01',
      preserveWorldTransform: true,
    }).ok).toBe(false);
  });

  it('rejects preserve-world moves that would require shear under rotated non-uniform parents', () => {
    const document = createMiniEditorSceneDocument({
      tree01Rotation: { x: 0, y: Math.PI / 4, z: 0 },
      tree01Scale: { x: 2, y: 1, z: 1 },
    });

    expect(validateEditorSceneHierarchyMove(document, {
      ids: ['mvp_tree_02'],
      targetId: 'mvp_tree_01',
      placement: 'inside',
      parentId: 'mvp_tree_01',
      preserveWorldTransform: true,
    }).ok).toBe(false);
    expect(createEditorSceneHierarchyMovePatch(document, {
      ids: ['mvp_tree_02'],
      targetId: 'mvp_tree_01',
      placement: 'inside',
      parentId: 'mvp_tree_01',
      preserveWorldTransform: true,
    })).toBeNull();
  });
});

function createMiniEditorSceneDocument(options: {
  rootRotation?: { x: number; y: number; z: number };
  rootScale?: { x: number; y: number; z: number };
  groupRotation?: { x: number; y: number; z: number };
  groupScale?: { x: number; y: number; z: number };
  tree01Rotation?: { x: number; y: number; z: number };
  tree01Scale?: { x: number; y: number; z: number };
  tree02ParentId?: string | null;
  noTransformParent?: boolean;
} = {}): EditorSceneDocument {
  return {
    schemaVersion: 1,
    assets: [{ id: 'asset_tree', type: 'glb', sourceId: 'tree' }],
    scene: {
      gameObjects: [
        createMiniGameObject({
          id: 'mvp_root',
          name: 'MVP Root',
          position: { x: 10, y: 0, z: 0 },
          rotation: options.rootRotation,
          scale: options.rootScale,
          group: true,
        }),
        createMiniGameObject({
          id: 'mvp_group_01',
          name: 'Group',
          parentId: 'mvp_root',
          position: { x: 0, y: 0, z: 0 },
          rotation: options.groupRotation,
          scale: options.groupScale,
          group: true,
        }),
        createMiniGameObject({
          id: 'mvp_tree_01',
          name: 'Tree 01',
          parentId: 'mvp_root',
          position: { x: 2, y: 0, z: 0 },
          rotation: options.tree01Rotation,
          scale: options.tree01Scale,
        }),
        createMiniGameObject({
          id: 'mvp_tree_02',
          name: 'Tree 02',
          parentId: options.tree02ParentId === undefined ? 'mvp_root' : options.tree02ParentId,
          position: { x: 6, y: 0, z: 0 },
        }),
        ...(options.noTransformParent
          ? [createMiniGameObject({
              id: 'no_transform_parent',
              name: 'No Transform Parent',
              parentId: 'mvp_root',
              position: { x: 0, y: 0, z: 0 },
              group: true,
              noTransform: true,
            })]
          : []),
      ],
    },
  };
}

function createMiniGameObject(input: {
  id: string;
  name: string;
  parentId?: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  scale?: { x: number; y: number; z: number };
  group?: boolean;
  noTransform?: boolean;
}): EditorSceneGameObject {
  return {
    id: input.id,
    name: input.name,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    active: true,
    components: [
      ...(input.noTransform
        ? []
        : [{
            type: 'Transform' as const,
            position: input.position,
            rotation: input.rotation ?? { x: 0, y: 0, z: 0 },
            scale: input.scale ?? { x: 1, y: 1, z: 1 },
          }]),
      ...(input.group ? [] : [{ type: 'ModelRenderer' as const, assetId: 'asset_tree' }]),
    ],
  };
}

function findMiniGameObject(document: EditorSceneDocument, id: string): EditorSceneGameObject | undefined {
  return document.scene.gameObjects.find(gameObject => gameObject.id === id);
}
