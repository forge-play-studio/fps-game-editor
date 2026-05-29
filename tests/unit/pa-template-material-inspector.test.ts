import { describe, expect, it } from 'vitest';

import {
  ensureEditorSceneEnvironmentDefaults,
  getEditorSceneInspectorObject,
} from '../../.local/pa_template/src/fps-game-editor-adapter/editor-scene-session';
import type { EditorSceneDocument } from '../../.local/pa_template/src/fps-game-editor-adapter/editor-scene-document';
import type { SceneMaterialAssetConfig } from '../../.local/pa_template/src/config';

function createMaterialInspectorDocument(materialAsset?: SceneMaterialAssetConfig | null): EditorSceneDocument {
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
          materialBinding: {
            ...(materialAsset ? { materialAssetId: materialAsset.id } : {}),
            override: {
              baseColor: { color: { r: 0.2, g: 0.3, b: 0.4 } },
              metallic: 0.9,
              roughness: 0.1,
            },
          },
        },
      }],
      materialAssets: materialAsset ? [materialAsset] : [],
    },
  });
}

function getArtistMaterialPropertyPaths(document: EditorSceneDocument): string[] {
  return getEditorSceneInspectorObject(document, 'plane')
    ?.sections.find(section => section.id === 'artistMaterial')
    ?.properties.map(property => property.path) ?? [];
}

function getInspectorSectionIds(document: EditorSceneDocument, gameObjectId = 'plane'): string[] {
  return getEditorSceneInspectorObject(document, gameObjectId)?.sections.map(section => section.id) ?? [];
}

describe('pa_template material inspector', () => {
  it('edits the shared material asset instead of exposing root node override parameters', () => {
    const document = createMaterialInspectorDocument({
      id: 'mat_shared_pbr',
      name: 'Shared PBR',
      materialKind: 'pbr',
      profile: {
        baseColor: { color: { r: 1, g: 1, b: 1 } },
        metallic: 0.2,
        roughness: 0.8,
        emission: { color: { r: 0, g: 0, b: 0 }, intensity: 0 },
      },
    });

    const inspector = getEditorSceneInspectorObject(document, 'plane');
    const artistMaterial = inspector?.sections.find(section => section.id === 'artistMaterial');
    const paths = artistMaterial?.properties.map(property => property.path) ?? [];
    const materialCard = artistMaterial?.properties.find(property => property.path === 'overrides.materialBinding.materialAssetId');
    const nameProperty = artistMaterial?.properties.find(property => property.path === 'scene.materialAssets.mat_shared_pbr.name');
    const kindProperty = artistMaterial?.properties.find(property => property.path === 'scene.materialAssets.mat_shared_pbr.materialKind');

    expect(paths).toContain('overrides.materialBinding.materialAssetId');
    expect(materialCard?.controlOptions).toMatchObject({
      copyActionLabel: '复制',
      copyActionValue: '__fps_duplicate_material_asset__:mat_shared_pbr',
    });
    expect(nameProperty).toMatchObject({ control: 'readonly', readOnly: true, value: 'Shared PBR' });
    expect(kindProperty).toMatchObject({ control: 'readonly', readOnly: true, value: 'PBR 标准材质球' });
    expect(paths).toEqual(expect.arrayContaining([
      'scene.materialAssets.mat_shared_pbr.profile.baseColor.color',
      'scene.materialAssets.mat_shared_pbr.profile.baseColor.texture.url',
      'scene.materialAssets.mat_shared_pbr.profile.metallic',
      'scene.materialAssets.mat_shared_pbr.profile.roughness',
      'scene.materialAssets.mat_shared_pbr.profile.emission.color',
      'scene.materialAssets.mat_shared_pbr.profile.emission.intensity',
      'scene.materialAssets.mat_shared_pbr.profile.emission.maskTexture.url',
    ]));
    expect(paths.some(path => path.startsWith('overrides.materialBinding.override.'))).toBe(false);
    expect(getInspectorSectionIds(document).some(sectionId => [
      'material',
      'materialTextures',
      'materialColors',
      'metallicRoughness',
      'intensityProperties',
    ].includes(sectionId))).toBe(false);
  });

  it('hides metallic and roughness fields for Standard material assets', () => {
    const document = createMaterialInspectorDocument({
      id: 'mat_shared_standard',
      name: 'Shared Standard',
      materialKind: 'standard',
      profile: {
        baseColor: { color: { r: 0.8, g: 0.7, b: 0.6 } },
        metallic: 0.5,
        roughness: 0.5,
        emission: { color: { r: 0.1, g: 0.2, b: 0.3 }, intensity: 0.4 },
      },
    });

    const paths = getArtistMaterialPropertyPaths(document);

    expect(paths).toContain('scene.materialAssets.mat_shared_standard.profile.baseColor.color');
    expect(paths).toContain('scene.materialAssets.mat_shared_standard.profile.emission.intensity');
    expect(paths).not.toContain('scene.materialAssets.mat_shared_standard.profile.metallic');
    expect(paths).not.toContain('scene.materialAssets.mat_shared_standard.profile.roughness');
  });

  it('shows only language and material selection state when no material asset is bound', () => {
    const paths = getArtistMaterialPropertyPaths(createMaterialInspectorDocument(null));

    expect(paths).toEqual([
      'metadata.artistMaterialInspectorLanguage',
      'overrides.materialBinding.materialAssetId',
    ]);
    expect(getInspectorSectionIds(createMaterialInspectorDocument(null))).toContain('artistMaterial');
    expect(getInspectorSectionIds(createMaterialInspectorDocument(null)).some(sectionId => [
      'material',
      'materialTextures',
      'materialColors',
      'metallicRoughness',
      'intensityProperties',
    ].includes(sectionId))).toBe(false);
  });

  it('keeps child material slots on shared asset fields without exposing slot override parameters', () => {
    const document = ensureEditorSceneEnvironmentDefaults({
      schemaVersion: 1,
      assets: [{
        id: 'asset_model',
        displayName: 'Model',
        type: 'glb',
      }],
      scene: {
        gameObjects: [{
          id: 'model',
          name: 'Model',
          kind: 'instance',
          components: [
            {
              type: 'Transform',
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
            },
            { type: 'ModelRenderer', assetId: 'asset_model' },
          ],
          overrides: {
            childMaterialBindings: {
              Body: {
                materialAssetId: 'mat_slot',
                override: {
                  emission: { color: { r: 1, g: 0, b: 0 }, intensity: 2 },
                },
              },
            },
          },
        }],
        materialAssets: [{
          id: 'mat_slot',
          name: 'Slot Material',
          materialKind: 'pbr',
          profile: {
            baseColor: { color: { r: 1, g: 1, b: 1 } },
            metallic: 0,
            roughness: 1,
          },
        }],
      },
    });

    const paths = getEditorSceneInspectorObject(document, 'model')
      ?.sections.find(section => section.id === 'artistMaterialSlots')
      ?.properties.map(property => property.path) ?? [];

    expect(paths).toContain('overrides.childMaterialBindings.Body.materialAssetId');
    expect(paths).toContain('scene.materialAssets.mat_slot.profile.baseColor.color');
    expect(paths.some(path => path.startsWith('overrides.childMaterialBindings.Body.override.'))).toBe(false);
  });

  it('shows detected model material slots as visual replacement cards', () => {
    const document = ensureEditorSceneEnvironmentDefaults({
      schemaVersion: 1,
      assets: [{
        id: 'asset_model',
        displayName: 'Model',
        type: 'glb',
        metadata: {
          materialSlots: [
            { ownerNodePath: 'Body', label: 'Body Surface' },
            'Helmet/Visor',
          ],
        },
      }],
      scene: {
        gameObjects: [{
          id: 'model',
          name: 'Model',
          kind: 'instance',
          components: [
            {
              type: 'Transform',
              position: { x: 0, y: 0, z: 0 },
              rotation: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
            },
            { type: 'ModelRenderer', assetId: 'asset_model' },
          ],
        }],
        materialAssets: [],
      },
    });

    const slotSection = getEditorSceneInspectorObject(document, 'model')
      ?.sections.find(section => section.id === 'artistMaterialSlots');
    const slotCards = slotSection?.properties.filter(property => property.customControl === 'asset-picker-card') ?? [];

    expect(slotCards.map(property => property.path)).toEqual([
      'overrides.childMaterialBindings.Body.materialAssetId',
      'overrides.childMaterialBindings.Helmet/Visor.materialAssetId',
    ]);
    expect(slotCards[0]).toMatchObject({
      label: 'Body Surface',
      control: 'custom',
      value: '',
    });
  });
});
