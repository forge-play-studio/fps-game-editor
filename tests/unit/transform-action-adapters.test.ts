import { describe, expect, it } from 'vitest';
import {
  composeEditorTransformMatrix,
  computeEditorTransformActionTargets,
  editorTransformMatricesAlmostEqual,
  type EditorTransformSnapshot,
  type EditorTransformTargetSnapshot,
} from '../../packages/editor-core/src';
import {
  createLabDocumentAdapter,
  createLabSceneDocument,
  reduceLabSceneDocument,
} from '../../examples/editor-lab/src/lab-project';
import {
  getEditorSceneGameObjectWorldTransform,
  reduceEditorSceneDocument,
  toEditorSceneLocalTransformFromWorld,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session';
import type { EditorSceneDocument } from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';

describe('transform action document adapters', () => {
  it('applies editor-lab align targets through the batch transform patch', () => {
    const adapter = createLabDocumentAdapter();
    const document = createLabSceneDocument();
    const sourceTargets = ['lab_box_01', 'lab_sphere_01'].map((id) => {
      const object = document.scene.gameObjects.find(gameObject => gameObject.id === id)!;
      return {
        id,
        transform: cloneSnapshot(object.transform),
      };
    });
    const targets = changedTargets(computeEditorTransformActionTargets({
      action: 'align-x',
      activeId: 'lab_sphere_01',
      targets: sourceTargets,
    }));
    const patch = adapter.createTransformBatchPatch?.({
      document,
      targetIds: targets.map(target => target.id),
      activeId: 'lab_sphere_01',
      tool: 'move',
      space: 'world',
      constraint: 'axis',
      pivot: { mode: 'selection-center', position: { x: 0, y: 0, z: 0 } },
      targets,
    });

    expect(patch?.changedIds).toEqual(['lab_box_01']);

    const next = reduceLabSceneDocument(document, {
      type: 'document.patch',
      patch: patch!.patch,
    });
    const active = document.scene.gameObjects.find(gameObject => gameObject.id === 'lab_sphere_01')!;
    const aligned = next.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')!;

    expect(aligned.transform.position.x).toBe(active.transform.position.x);
    expect(next.scene.gameObjects.find(gameObject => gameObject.id === 'lab_sphere_01')?.transform.position)
      .toEqual(active.transform.position);
  });

  it('applies mini-game-lab distribute targets while keeping sorted endpoints unchanged', () => {
    const document: EditorSceneDocument = {
      schemaVersion: 1,
      assets: [],
      scene: {
        gameObjects: [
          createMiniGameObject('mvp_root', { x: 0, y: 0, z: 0 }),
          createMiniGameObject('first', { x: 0, y: 0, z: 0 }, 'mvp_root'),
          createMiniGameObject('middle', { x: 7, y: 0, z: 0 }, 'mvp_root'),
          createMiniGameObject('last', { x: 10, y: 0, z: 0 }, 'mvp_root'),
        ],
      },
    };
    const targets = computeEditorTransformActionTargets({
      action: 'distribute-x',
      activeId: 'middle',
      targets: ['first', 'middle', 'last'].map((id) => ({
        id,
        transform: cloneSnapshotFromMini(document, id),
      })),
    });

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: {
        kind: 'game-object.transform-batch',
        targets: changedTargets(targets).map(target => ({
          targetId: target.id,
          transform: target.after,
        })),
      },
    });

    expect(readMiniPosition(next, 'first').x).toBe(0);
    expect(readMiniPosition(next, 'middle').x).toBe(5);
    expect(readMiniPosition(next, 'last').x).toBe(10);
  });

  it('applies mini-game-lab world transform commits as parent-local authored transforms', () => {
    const document: EditorSceneDocument = {
      schemaVersion: 1,
      assets: [],
      scene: {
        gameObjects: [
          createMiniGameObjectFromTransform('parent', {
            position: { x: 3, y: 1, z: -2 },
            rotation: { x: 0.2, y: Math.PI / 5, z: -0.1 },
            scale: { x: 2, y: 2, z: 2 },
          }),
          createMiniGameObjectFromTransform('child', {
            position: { x: 1, y: 0.25, z: -0.5 },
            rotation: { x: -0.15, y: 0.3, z: 0.2 },
            scale: { x: 0.75, y: 0.75, z: 0.75 },
          }, 'parent'),
        ],
      },
    };
    const targetWorld: EditorTransformSnapshot = {
      position: { x: 8, y: 3, z: -4 },
      rotation: { x: 0.35, y: 0.8, z: -0.25 },
      scale: { x: 1.5, y: 1.5, z: 1.5 },
    };
    const localTransform = toEditorSceneLocalTransformFromWorld(document, 'child', targetWorld);

    expect(localTransform).not.toBeNull();
    expect(localTransform?.position).not.toEqual(targetWorld.position);

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: {
        kind: 'game-object.transform',
        targetId: 'child',
        transform: localTransform!,
      },
    });
    const recomposedWorld = getEditorSceneGameObjectWorldTransform(next, 'child')!;

    expectTransformsToMatchWorld(recomposedWorld, targetWorld);
  });

  it('applies mini-game-lab batch world transform commits atomically through parent-local authored transforms', () => {
    const document: EditorSceneDocument = {
      schemaVersion: 1,
      assets: [],
      scene: {
        gameObjects: [
          createMiniGameObjectFromTransform('parent', {
            position: { x: -2, y: 0, z: 1 },
            rotation: { x: 0, y: Math.PI / 6, z: 0.15 },
            scale: { x: 1.25, y: 1.25, z: 1.25 },
          }),
          createMiniGameObjectFromTransform('first', {
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0.2, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          }, 'parent'),
          createMiniGameObjectFromTransform('second', {
            position: { x: 3, y: 0, z: 1 },
            rotation: { x: 0.2, y: 0, z: -0.1 },
            scale: { x: 0.8, y: 0.8, z: 0.8 },
          }, 'parent'),
        ],
      },
    };
    const worldTargets: Array<{ id: string; after: EditorTransformSnapshot }> = [
      {
        id: 'first',
        after: {
          position: { x: 1, y: 2, z: 3 },
          rotation: { x: 0.1, y: 0.5, z: -0.2 },
          scale: { x: 1.2, y: 1.2, z: 1.2 },
        },
      },
      {
        id: 'second',
        after: {
          position: { x: 4, y: -1, z: 0.5 },
          rotation: { x: -0.25, y: 0.15, z: 0.45 },
          scale: { x: 0.6, y: 0.6, z: 0.6 },
        },
      },
    ];
    const localTargets = worldTargets.map((target) => ({
      targetId: target.id,
      transform: toEditorSceneLocalTransformFromWorld(document, target.id, target.after)!,
    }));

    expect(localTargets.every(target => !!target.transform)).toBe(true);

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: {
        kind: 'game-object.transform-batch',
        targets: localTargets,
      },
    });

    for (const target of worldTargets) {
      expectTransformsToMatchWorld(getEditorSceneGameObjectWorldTransform(next, target.id)!, target.after);
    }
  });
});

function changedTargets(targets: EditorTransformTargetSnapshot[]): EditorTransformTargetSnapshot[] {
  return targets.filter(target => JSON.stringify(target.before) !== JSON.stringify(target.after));
}

function cloneSnapshot(transform: EditorTransformSnapshot): EditorTransformSnapshot {
  return {
    position: { ...transform.position },
    rotation: { ...transform.rotation },
    scale: { ...transform.scale },
  };
}

function createMiniGameObject(id: string, position: { x: number; y: number; z: number }, parentId?: string) {
  return createMiniGameObjectFromTransform(id, {
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  }, parentId);
}

function createMiniGameObjectFromTransform(
  id: string,
  transform: EditorTransformSnapshot,
  parentId?: string,
) {
  return {
    id,
    name: id,
    ...(parentId ? { parentId } : {}),
    components: [
      {
        type: 'Transform' as const,
        position: transform.position,
        rotation: transform.rotation,
        scale: transform.scale,
      },
    ],
  };
}

function cloneSnapshotFromMini(document: EditorSceneDocument, id: string): EditorTransformSnapshot {
  const position = readMiniPosition(document, id);
  return {
    position,
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

function readMiniPosition(document: EditorSceneDocument, id: string): { x: number; y: number; z: number } {
  const transform = document.scene.gameObjects
    .find(gameObject => gameObject.id === id)
    ?.components
    .find(component => component.type === 'Transform');
  if (!transform || transform.type !== 'Transform') throw new Error(`missing transform ${id}`);
  return transform.position;
}

function expectTransformsToMatchWorld(actual: EditorTransformSnapshot, expected: EditorTransformSnapshot): void {
  expect(editorTransformMatricesAlmostEqual(
    composeEditorTransformMatrix(actual),
    composeEditorTransformMatrix(expected),
  )).toBe(true);
}
