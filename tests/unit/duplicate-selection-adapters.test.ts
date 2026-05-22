import { describe, expect, it } from 'vitest';
import {
  createLabDocumentAdapter,
  createLabSceneDocument,
  reduceLabSceneDocument,
} from '../../examples/editor-lab/src/lab-project';
import {
  createEditorSceneDuplicateSelectionPatch,
  reduceEditorSceneDocument,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session';
import type { EditorSceneDocument } from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';

describe('duplicate selection document adapters', () => {
  it('creates editor-lab duplicate patches that preserve selected transforms and active mapping', () => {
    const adapter = createLabDocumentAdapter();
    const document = createLabSceneDocument();
    const patch = adapter.createDuplicateSelectionPatch?.({
      document,
      targetIds: ['lab_box_01', 'lab_sphere_01'],
      activeId: 'lab_sphere_01',
      transforms: {},
    });

    expect(patch?.createdIds).toHaveLength(2);
    expect(patch?.activeId).toBe(patch?.createdIds[1]);

    const next = reduceLabSceneDocument(document, {
      type: 'document.patch',
      patch: patch!.patch,
    });
    const original = document.scene.gameObjects.find(gameObject => gameObject.id === 'lab_box_01')!;
    const duplicate = next.scene.gameObjects.find(gameObject => gameObject.id === patch!.createdIds[0])!;

    expect(duplicate.id).not.toBe(original.id);
    expect(duplicate.name).toBe(`${original.name} Copy`);
    expect(duplicate.transform.position).toEqual(original.transform.position);
  });

  it('creates mini-game-lab duplicate patches that keep originals unchanged', () => {
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
          {
            id: 'crate',
            name: 'Crate',
            parentId: 'mvp_root',
            components: [{ type: 'Transform', position: { x: 2, y: 0, z: 1 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } }],
          },
        ],
      },
    };
    const patch = createEditorSceneDuplicateSelectionPatch({
      document,
      targetIds: ['crate'],
      activeId: 'crate',
    });

    expect(patch?.createdIds).toEqual(['crate_copy']);
    expect(patch?.activeId).toBe('crate_copy');

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: patch!.patch,
    });

    expect(next.scene.gameObjects.map(gameObject => gameObject.id)).toEqual(['mvp_root', 'crate', 'crate_copy']);
    expect(next.scene.gameObjects.find(gameObject => gameObject.id === 'crate')?.name).toBe('Crate');
    expect(next.scene.gameObjects.find(gameObject => gameObject.id === 'crate_copy')?.name).toBe('Crate Copy');
  });
});
