import { describe, expect, it } from 'vitest';

import {
  ensureEditorSceneEnvironmentDefaults,
  reduceEditorSceneDocument,
} from '../../.local/pa_template/src/fps-game-editor-adapter/editor-scene-session';
import type { EditorSceneDocument } from '../../.local/pa_template/src/fps-game-editor-adapter/editor-scene-document';
import { validateSceneJsonV2 } from '../../.local/pa_template/src/config/SceneJsonV2Validator';

describe('pa_template material defaults', () => {
  it('injects readonly default PBR and Standard material assets', () => {
    const document: EditorSceneDocument = {
      schemaVersion: 1,
      assets: [],
      scene: {
        gameObjects: [{
          id: 'root',
          name: 'Root',
          components: [{
            type: 'Transform',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          }],
        }],
        materialAssets: [{
          id: 'legacy_mat',
          name: 'Legacy Mat',
          profile: {
            baseColor: { color: { r: 0.5, g: 0.5, b: 0.5 } },
          },
        }],
      },
    };

    const normalized = ensureEditorSceneEnvironmentDefaults(document);
    expect(normalized.scene.materialAssets?.map((materialAsset) => materialAsset.id).slice(0, 2)).toEqual([
      'mat_default_pbr',
      'mat_default_standard',
    ]);
    expect(normalized.scene.materialAssets?.[0]).toMatchObject({
      materialKind: 'pbr',
      system: { readonly: true, preset: 'default-pbr' },
    });
    expect(normalized.scene.materialAssets?.[1]).toMatchObject({
      materialKind: 'standard',
      system: { readonly: true, preset: 'default-standard' },
    });
    expect(normalized.scene.materialAssets?.some((materialAsset) => materialAsset.id === 'legacy_mat')).toBe(true);
  });

  it('rejects contradictory materialKind and system preset metadata', () => {
    const errors = validateSceneJsonV2({
      schemaVersion: 2,
      scene: {
        rootId: 'root',
        assets: [],
        nodes: [],
        materialAssets: [{
          id: 'bad_default',
          name: 'Bad Default',
          materialKind: 'pbr',
          system: { readonly: true, preset: 'default-standard' },
          profile: {
            baseColor: { color: { r: 1, g: 1, b: 1 } },
          },
        }],
        materials: [],
        textures: [],
      },
    } as any);

    expect(errors).toContainEqual({
      path: '$.scene.materialAssets[0].materialKind',
      message: 'default-standard material assets must use materialKind standard',
    });
  });

  it('prevents field patches against readonly system material assets', () => {
    const document = ensureEditorSceneEnvironmentDefaults({
      schemaVersion: 1,
      assets: [],
      scene: {
        gameObjects: [{
          id: 'root',
          name: 'Root',
          components: [{
            type: 'Transform',
            position: { x: 0, y: 0, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            scale: { x: 1, y: 1, z: 1 },
          }],
        }],
        materialAssets: [],
      },
    });

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: {
        kind: 'scene.material-asset.field',
        materialAssetId: 'mat_default_standard',
        path: 'profile.baseColor.color',
        value: { r: 0.1, g: 0.2, b: 0.3 },
      },
    });

    expect(next.scene.materialAssets?.find((materialAsset) => materialAsset.id === 'mat_default_standard')?.profile.baseColor?.color).toEqual({
      r: 1,
      g: 1,
      b: 1,
    });
  });
});
