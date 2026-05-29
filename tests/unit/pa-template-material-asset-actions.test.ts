import { existsSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

const sessionModuleUrl = new URL('../../.local/pa_template/src/fps-game-editor-adapter/editor-scene-session.ts', import.meta.url);
const hasPaTemplateCompanion = existsSync(sessionModuleUrl);
const describePaTemplate = hasPaTemplateCompanion ? describe : describe.skip;

let createEditorSceneAssetActionPatch: any;
let createEditorSceneInspectorPropertyPatch: any;
let ensureEditorSceneEnvironmentDefaults: any;
let reduceEditorSceneDocument: any;

function createMaterialAssetActionDocument(): any {
  return ensureEditorSceneEnvironmentDefaults({
    schemaVersion: 1,
    assets: [],
    scene: {
      gameObjects: [{
        id: 'plane',
        name: 'Plane',
        kind: 'primitive',
        primitive: { shape: 'plane' },
        components: [{
          type: 'Transform',
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        }],
        overrides: {
          materialBinding: { materialAssetId: 'mat_editable' },
        },
      }],
      materialAssets: [{
        id: 'mat_editable',
        name: 'Editable Material',
        materialKind: 'pbr',
        profile: {
          baseColor: { color: { r: 1, g: 1, b: 1 }, brightness: 1 },
          metallic: 0,
          roughness: 1,
          emission: { color: { r: 0, g: 0, b: 0 }, intensity: 0 },
        },
      }],
    },
  });
}

describePaTemplate('pa_template material asset actions', () => {
  beforeAll(async () => {
    const sessionModule = await import(sessionModuleUrl.href);
    createEditorSceneAssetActionPatch = sessionModule.createEditorSceneAssetActionPatch;
    createEditorSceneInspectorPropertyPatch = sessionModule.createEditorSceneInspectorPropertyPatch;
    ensureEditorSceneEnvironmentDefaults = sessionModule.ensureEditorSceneEnvironmentDefaults;
    reduceEditorSceneDocument = sessionModule.reduceEditorSceneDocument;
  });

  it('creates shared material asset field patches from material editor actions', () => {
    const document = createMaterialAssetActionDocument();
    const result = createEditorSceneAssetActionPatch({
      actionId: 'asset.edit-material-field',
      assetId: 'mat_editable',
      browserAssetId: 'material:mat_editable',
      activeId: 'plane',
      document,
      fieldPath: 'profile.baseColor.color',
      value: { r: 0.25, g: 0.5, b: 0.75 },
    });

    expect(result).toMatchObject({
      label: 'Edit material Editable Material profile.baseColor.color',
      patch: {
        kind: 'scene.material-asset.field',
        materialAssetId: 'mat_editable',
        path: 'profile.baseColor.color',
        value: { r: 0.25, g: 0.5, b: 0.75 },
      },
      changedId: 'plane',
      changedIds: ['plane'],
      reprojectIds: ['plane'],
    });

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: result!.patch,
    });

    expect(next.scene.materialAssets?.find(material => material.id === 'mat_editable')?.profile.baseColor?.color).toEqual({
      r: 0.25,
      g: 0.5,
      b: 0.75,
    });
  });

  it('does not create edit patches for readonly system material assets', () => {
    const document = createMaterialAssetActionDocument();

    expect(createEditorSceneAssetActionPatch({
      actionId: 'asset.edit-material-field',
      assetId: 'mat_default_pbr',
      browserAssetId: 'material:mat_default_pbr',
      activeId: 'plane',
      document,
      fieldPath: 'profile.baseColor.brightness',
      value: 0.5,
    })).toBeNull();
  });

  it('keeps apply material as a GameObject material binding action', () => {
    const document = createMaterialAssetActionDocument();

    expect(createEditorSceneAssetActionPatch({
      actionId: 'asset.apply-material',
      assetId: 'mat_default_standard',
      browserAssetId: 'material:mat_default_standard',
      activeId: 'plane',
      document,
    })).toMatchObject({
      patch: {
        kind: 'game-object.field',
        targetId: 'plane',
        path: 'overrides.materialBinding.materialAssetId',
        value: 'mat_default_standard',
      },
      changedIds: ['plane'],
      reprojectIds: ['plane'],
    });
  });

  it('duplicates the current material asset and binds it to the active object', () => {
    const document = createMaterialAssetActionDocument();
    const result = createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'plane',
      path: 'overrides.materialBinding.materialAssetId',
      value: '__fps_duplicate_material_asset__:mat_editable',
    });

    expect(result).toMatchObject({
      patch: {
        kind: 'scene.material-asset.duplicate-and-bind',
        targetId: 'plane',
        bindingPath: 'overrides.materialBinding.materialAssetId',
        materialAsset: {
          id: 'mat_plane_editable_material',
          name: 'Plane - Editable Material',
          materialKind: 'pbr',
          profile: {
            baseColor: { color: { r: 1, g: 1, b: 1 }, brightness: 1 },
          },
        },
      },
      changedIds: ['plane'],
      reprojectIds: ['plane'],
    });

    const next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: result!.patch,
    });

    expect(next.scene.materialAssets?.some(material => material.id === 'mat_plane_editable_material')).toBe(true);
    expect(next.scene.gameObjects.find(gameObject => gameObject.id === 'plane')?.overrides?.materialBinding?.materialAssetId)
      .toBe('mat_plane_editable_material');
    expect(next.scene.materialAssets?.find(material => material.id === 'mat_editable')?.profile.baseColor?.color)
      .toEqual({ r: 1, g: 1, b: 1 });
  });
});
