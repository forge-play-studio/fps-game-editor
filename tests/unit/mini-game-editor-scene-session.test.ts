import { describe, expect, it } from 'vitest';
import {
  compileEditorSceneDocumentToSceneConfig,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-compiler';
import {
  createEditorSceneInspectorPropertyPatch,
  getEditorSceneRuntimeInspectorSections,
  getEditorSceneInspectorObject,
  patchEditorSceneGameObjectField,
  reduceEditorSceneDocument,
  type EditorSceneDocumentPatch,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session';
import type {
  EditorSceneDocument,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';
import type { SceneConfig } from '../../examples/mini-game-lab/src/config/types';

function createMiniEditorSceneDocument(): EditorSceneDocument {
  return {
    schemaVersion: 1,
    meta: {
      name: 'Test Editor Scene',
      authoringSource: { sourceId: 'scene.main', sourceType: 'scene', revision: 1 },
    },
    assets: [
      {
        id: 'asset_tree',
        type: 'glb',
        sourceId: 'tree_lv1',
        displayName: 'Tree',
        category: 'Nature',
        materialMode: 'instance',
        metadata: { source: 'fixture' },
      },
      {
        id: 'asset_fence',
        type: 'glb',
        sourceId: 'fence',
        displayName: 'Fence',
        category: 'Building',
      },
    ],
    scene: {
      gameObjects: [
        {
          id: 'root',
          name: 'Root',
          active: true,
          components: [
            { type: 'Transform', position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
          ],
        },
        {
          id: 'tree',
          name: 'Tree',
          parentId: 'root',
          active: true,
          components: [
            { type: 'Transform', position: { x: 1, y: 0, z: 2 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
            { type: 'ModelRenderer', assetId: 'asset_tree' },
          ],
        },
        {
          id: 'decal',
          name: 'Ground Decal',
          kind: 'transform',
          parentId: 'root',
          active: true,
          transformType: 'groundDecal',
          groundDecal: {
            size: { width: 2, depth: 3 },
            color: { r: 1, g: 1, b: 1 },
          },
          components: [
            { type: 'Transform', position: { x: 0, y: 0.01, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
          ],
        },
      ],
    },
  };
}

describe('mini-game editor scene Inspector v2 adapter', () => {
  it('exposes document-backed Inspector v2 sections for scene nodes', () => {
    const inspector = getEditorSceneInspectorObject(createMiniEditorSceneDocument(), 'tree');

    expect(inspector?.sections.map(section => section.id)).toEqual([
      'common',
      'transform',
      'renderer',
      'materialOverride',
      'outline',
      'metadata',
    ]);
    expect(inspector?.sections.find(section => section.id === 'common')?.properties.map(property => property.path)).toContain('name');
    expect(inspector?.sections.find(section => section.id === 'renderer')?.properties[0]).toMatchObject({
      path: 'instance.assetId',
      control: 'enum',
      persistence: 'document',
    });
    expect(inspector?.sections.find(section => section.id === 'metadata')?.persistence).toBe('readonly');
  });

  it('creates schema-backed patches for common, renderer, material, and outline fields', () => {
    const document = createMiniEditorSceneDocument();
    const patch = (path: string, value: unknown): EditorSceneDocumentPatch => createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'tree',
      path,
      value,
    })!.patch;

    let next = reduceEditorSceneDocument(document, { type: 'document.patch', patch: patch('name', 'Pine') });
    next = reduceEditorSceneDocument(next, { type: 'document.patch', patch: patch('instance.assetId', 'asset_fence') });
    next = reduceEditorSceneDocument(next, {
      type: 'document.patch',
      patch: patch('overrides.material.albedoColor', { r: 0.2, g: 0.4, b: 0.6 }),
    });
    next = reduceEditorSceneDocument(next, {
      type: 'document.patch',
      patch: patch('overrides.outline.renderOutline', true),
    });

    const tree = next.scene.gameObjects.find(gameObject => gameObject.id === 'tree')!;
    expect(tree.name).toBe('Pine');
    expect(tree.components.find(component => component.type === 'ModelRenderer')).toMatchObject({ assetId: 'asset_fence' });
    expect(tree.overrides?.material?.albedoColor).toEqual({ r: 0.2, g: 0.4, b: 0.6 });
    expect(tree.overrides?.outline?.renderOutline).toBe(true);
  });

  it('rejects invalid schema-backed field values before patch creation', () => {
    const document = createMiniEditorSceneDocument();

    expect(createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'tree',
      path: 'instance.assetId',
      value: 'missing_asset',
    })).toBeNull();
    expect(createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'decal',
      path: 'groundDecal.size.width',
      value: -1,
    })).toBeNull();
    expect(createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'decal',
      path: 'groundDecal.size.width',
      value: null,
    })).toBeNull();
  });

  it('persists ground decal fields and compiles them into scene JSON', () => {
    const document = createMiniEditorSceneDocument();
    const next = patchEditorSceneGameObjectField(document, 'decal', 'groundDecal.size.width', 4);
    const compiled = compileEditorSceneDocumentToSceneConfig(next, {
      schemaVersion: 2,
      scene: { rootId: 'root', assets: [], nodes: [], materials: [], textures: [] },
    } as SceneConfig);

    const decal = compiled.sceneConfig.scene?.nodes.find(node => node.id === 'decal');
    expect(decal).toMatchObject({
      kind: 'transform',
      transformType: 'groundDecal',
      groundDecal: {
        size: { width: 4, depth: 3 },
      },
    });
  });

  it('normalizes blank ground decal texture ids to absent fields', () => {
    const document = createMiniEditorSceneDocument();
    const withTexture = patchEditorSceneGameObjectField(document, 'decal', 'groundDecal.textureId', 'tile_a');
    const cleared = reduceEditorSceneDocument(withTexture, {
      type: 'document.patch',
      patch: createEditorSceneInspectorPropertyPatch({
        document: withTexture,
        targetId: 'decal',
        path: 'groundDecal.textureId',
        value: '   ',
      })!.patch,
    });
    const compiled = compileEditorSceneDocumentToSceneConfig(cleared, {
      schemaVersion: 2,
      scene: { rootId: 'root', assets: [], nodes: [], materials: [], textures: [] },
    } as SceneConfig);

    const decal = compiled.sceneConfig.scene?.nodes.find(node => node.id === 'decal');
    expect(decal?.kind).toBe('transform');
    if (decal?.kind === 'transform') expect(decal.groundDecal?.textureId).toBeUndefined();
  });

  it('surfaces runtime binding details as read-only runtime context', () => {
    const document = createMiniEditorSceneDocument();
    const sections = getEditorSceneRuntimeInspectorSections({
      document,
      activeId: 'tree',
      projectedRoot: {
        getChildMeshes: () => [{
          material: {
            getClassName: () => 'PBRMaterial',
          },
        }],
      },
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      id: 'runtimeBinding',
      persistence: 'runtime',
      runtimeOnly: true,
    });
    expect(sections[0]?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.binding.objectId', value: 'tree', persistence: 'runtime', readOnly: true }),
      expect.objectContaining({ path: 'runtime.binding.component', value: 'ModelRenderer', persistence: 'runtime', readOnly: true }),
      expect.objectContaining({ path: 'runtime.material.kind', value: 'pbr', persistence: 'runtime', readOnly: true }),
    ]));
  });
});
