import { describe, expect, it } from 'vitest';
import {
  createLabDocumentAdapter,
  createLabSceneDocument,
  reduceLabSceneDocument,
} from '../../examples/editor-lab/src/lab-project';
import {
  createEditorScenePlacedAssetPatch,
  reduceEditorSceneDocument,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session';
import type {
  EditorSceneAssetLibraryItem,
  EditorSceneDocument,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';

describe('placed asset document adapters', () => {
  it('creates editor-lab asset patches at placement hit positions', () => {
    const adapter = createLabDocumentAdapter();
    const document = createLabSceneDocument();
    const asset = document.assets[0]!;
    const patch = adapter.createPlacedAssetPatch?.({
      document,
      asset,
      hit: {
        mode: 'ground',
        position: { x: 5, y: 0, z: -2 },
        normal: { x: 0, y: 1, z: 0 },
        nodeId: null,
      },
    });

    expect(patch?.createdId).toBeTruthy();

    const next = reduceLabSceneDocument(document, {
      type: 'document.patch',
      patch: patch!.patch,
    });
    const placed = next.scene.gameObjects.find(gameObject => gameObject.id === patch!.createdId);

    expect(placed?.transform.position).toEqual({ x: 5, y: 0, z: -2 });
  });

  it('creates mini-game-lab asset patches at placement hit positions', () => {
    const assetItem: EditorSceneAssetLibraryItem = {
      assetId: 'asset_crate',
      type: 'glb',
      sourceId: 'crate_model',
      displayName: 'Crate',
      placeable: true,
    };
    const document: EditorSceneDocument = {
      schemaVersion: 1,
      assets: [],
      scene: {
        gameObjects: [
          {
            id: 'mvp_root',
            name: 'Root',
            kind: 'group',
            components: [{ type: 'Transform', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }],
          },
        ],
      },
    };
    const patch = createEditorScenePlacedAssetPatch({
      document,
      asset: assetItem,
      hit: {
        mode: 'surface',
        position: { x: -1.5, y: 2, z: 3.25 },
        normal: { x: 0, y: 1, z: 0 },
        nodeId: 'ground',
      },
    });

    expect(patch.createdId).toBe('crate_model');

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: patch.patch,
    });
    const placed = next.scene.gameObjects.find(gameObject => gameObject.id === patch.createdId);
    const transform = placed?.components.find(component => component.type === 'Transform');

    expect(transform).toMatchObject({
      position: { x: -1.5, y: 2, z: 3.25 },
      scale: { x: 1, y: 1, z: 1 },
    });
    expect(transform?.rotation.x).toBeCloseTo(0);
    expect(transform?.rotation.y).toBeCloseTo(0);
    expect(transform?.rotation.z).toBeCloseTo(0);
  });
});
