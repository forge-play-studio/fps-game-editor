import { describe, expect, it } from 'vitest';
import {
  computeEditorTransformActionTargets,
  type EditorTransformSnapshot,
  type EditorTransformTargetSnapshot,
} from '../../packages/editor-core/src';
import {
  createLabDocumentAdapter,
  createLabSceneDocument,
  reduceLabSceneDocument,
} from '../../examples/editor-lab/src/lab-project';
import {
  reduceEditorSceneDocument,
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
  return {
    id,
    name: id,
    ...(parentId ? { parentId } : {}),
    components: [
      {
        type: 'Transform' as const,
        position,
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
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
