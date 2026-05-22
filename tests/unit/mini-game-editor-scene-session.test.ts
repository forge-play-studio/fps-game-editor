import { describe, expect, it } from 'vitest';
import {
  compileEditorSceneDocumentToSceneConfig,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-compiler';
import {
  createProjectionNode,
  createSceneCameraPreviewRig,
} from '../../examples/mini-game-lab/src/debug/local-editor-mode-switcher';
import {
  applyProjectMaterialDocumentChange,
  getProjectEditorWorkingDocument,
  loadProjectEditorDocument,
  patchProjectEditorSceneNode,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/document';
import {
  createEditorSceneReadonlyInspectorProperty,
  createEditorSceneReadonlyInspectorSection,
  createEditorSceneReadonlyVector3Properties,
  createEditorSceneDeleteSubtreePatch,
  createEditorSceneDuplicateSelectionPatch,
  createEditorSceneInspectorPropertyPatch,
  DEFAULT_EDITOR_SCENE_CAMERA,
  DEFAULT_EDITOR_SCENE_SUN_LIGHT,
  ensureEditorSceneEnvironmentDefaults,
  getEditorSceneHierarchyItems,
  getEditorSceneRuntimeInspectorSections,
  getEditorSceneInspectorMultiObject,
  getEditorSceneInspectorObject,
  patchEditorSceneGameObjectField,
  readEditorSceneRuntimeBoolean,
  readEditorSceneRuntimeClassName,
  readEditorSceneRuntimeNumber,
  readEditorSceneRuntimeString,
  reduceEditorSceneDocument,
  toEditorSceneInspectorSafeValue,
  type EditorSceneDocumentPatch,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session';
import type {
  EditorSceneDocument,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';
import type { SceneConfig } from '../../examples/mini-game-lab/src/config/types';
import { ConfigService } from '../../examples/mini-game-lab/src/config/ConfigService';
import { validateSceneJsonV2 } from '../../examples/mini-game-lab/src/config/SceneJsonV2Validator';

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

function createRuntimeProjectionFixture() {
  const texture = {
    getClassName: () => 'Texture',
    name: 'tree_albedo',
    url: '/assets/tree_albedo.png',
    level: 0.8,
    coordinatesIndex: 1,
    hasAlpha: true,
  };
  const material = {
    getClassName: () => 'PBRMaterial',
    id: 'mat_tree',
    name: 'Tree Material',
    uniqueId: 42,
    alpha: 0.9,
    backFaceCulling: false,
    twoSidedLighting: true,
    metallic: 0.2,
    roughness: 0.7,
    baseWeight: 1,
    directIntensity: 0.8,
    environmentIntensity: 1.2,
    albedoColor: { r: 0.1, g: 0.4, b: 0.2 },
    emissiveColor: { r: 0, g: 0.05, b: 0.02 },
    albedoTexture: texture,
    normalTexture: {
      getClassName: () => 'Texture',
      name: 'tree_normal',
      url: '/assets/tree_normal.png',
    },
    metadata: { materialTag: 'runtime' },
    getActiveTextures: () => [texture],
  };
  const physicsBody = {
    getClassName: () => 'PhysicsBody',
    name: 'Tree Physics',
    getParam: (key: string) => ({ mass: 2, friction: 0.4, restitution: 0.1 })[key],
  };
  const mesh = {
    getClassName: () => 'Mesh',
    id: 'tree_mesh',
    name: 'Tree Mesh',
    material,
    isVisible: true,
    visibility: 0.85,
    layerMask: 268435455,
    renderingGroupId: 1,
    alphaIndex: 3,
    alwaysSelectAsActiveMesh: true,
    billboardMode: 0,
    checkCollisions: true,
    collisionMask: 7,
    collisionGroup: 2,
    collisionResponse: true,
    ellipsoid: { x: 0.5, y: 1, z: 0.5 },
    ellipsoidOffset: { x: 0, y: 0.2, z: 0 },
    receiveShadows: true,
    physicsBody,
    animations: [{ name: 'meshSpin' }],
    skeleton: {
      getClassName: () => 'Skeleton',
      id: 'sk_tree',
      name: 'Tree Skeleton',
      bones: [{ name: 'root' }, { name: 'leaf' }],
    },
    subMeshes: [{}, {}],
    metadata: { meshTag: 'runtime' },
    isEnabled: () => true,
    isShadowEnabled: () => true,
    moveWithCollisions: () => undefined,
    getTotalVertices: () => 24,
    getTotalIndices: () => 36,
    getBoundingInfo: () => ({
      boundingBox: {
        minimumWorld: { x: -1, y: 0, z: -2 },
        maximumWorld: { x: 1, y: 4, z: 2 },
      },
    }),
  };
  const root = {
    getClassName: () => 'TransformNode',
    id: 'tree',
    name: 'Tree Runtime Root',
    metadata: { rootTag: 'runtime' },
    animations: [{ name: 'rootIdle' }],
    isEnabled: () => true,
    getChildren: () => [mesh],
    getChildMeshes: () => [mesh],
    getHierarchyBoundingVectors: () => ({
      min: { x: -1, y: 0, z: -2 },
      max: { x: 1, y: 4, z: 2 },
    }),
    isDisposed: () => false,
  };
  const projectionNode = {
    id: 'tree',
    name: 'Tree',
    parentId: 'root',
    asset: {
      id: 'asset_tree',
      sourceId: 'tree_lv1',
      metadata: { projectionAsset: true },
    },
  };
  return { root, projectionNode };
}

describe('mini-game editor scene Inspector v2 adapter', () => {
  it('ensures default Main Camera and Sun Light and protects the camera singleton', () => {
    const document = ensureEditorSceneEnvironmentDefaults(createMiniEditorSceneDocument());
    const camera = document.scene.gameObjects.find(gameObject => gameObject.id === 'main_camera');
    const light = document.scene.gameObjects.find(gameObject => gameObject.id === 'sun_light');

    expect(camera).toMatchObject({
      id: 'main_camera',
      name: 'Main Camera',
      kind: 'transform',
      parentId: 'root',
      transformType: 'camera',
      camera: DEFAULT_EDITOR_SCENE_CAMERA,
    });
    expect(light).toMatchObject({
      id: 'sun_light',
      name: 'Sun Light',
      kind: 'transform',
      parentId: 'root',
      transformType: 'light',
      light: DEFAULT_EDITOR_SCENE_SUN_LIGHT,
    });

    const hierarchyCamera = getEditorSceneHierarchyItems(document).find(item => item.id === 'main_camera');
    expect(hierarchyCamera).toMatchObject({
      selectable: true,
      deletable: false,
      draggable: true,
    });
    expect(createEditorSceneDeleteSubtreePatch(document, {
      ids: ['main_camera'],
      activeId: 'main_camera',
    })).toBeNull();
    expect(createEditorSceneDuplicateSelectionPatch({
      document,
      targetIds: ['main_camera'],
      activeId: 'main_camera',
    })).toBeNull();
    expect(createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'decal',
      path: 'transformType',
      value: 'camera',
    })).toBeNull();
    expect(createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'main_camera',
      path: 'transformType',
      value: 'plain',
    })).toBeNull();

    const compiled = compileEditorSceneDocumentToSceneConfig(document, {
      schemaVersion: 2,
      scene: { rootId: 'root', assets: [], nodes: [], materials: [], textures: [] },
    } as SceneConfig);
    const compiledCamera = compiled.sceneConfig.scene?.nodes.find(node => node.id === 'main_camera');
    const compiledLight = compiled.sceneConfig.scene?.nodes.find(node => node.id === 'sun_light');
    expect(compiledCamera).toMatchObject({
      kind: 'transform',
      transformType: 'camera',
      camera: DEFAULT_EDITOR_SCENE_CAMERA,
    });
    expect(compiledLight).toMatchObject({
      kind: 'transform',
      transformType: 'light',
      light: DEFAULT_EDITOR_SCENE_SUN_LIGHT,
    });
  });

  it('normalizes loaded editor scenes to one camera without deleting authored objects', () => {
    const document = createMiniEditorSceneDocument();
    document.scene.gameObjects.push({
      id: 'camera_a',
      name: 'Authored Camera A',
      kind: 'transform',
      parentId: 'root',
      active: true,
      transformType: 'camera',
      components: [
        { type: 'Transform', position: { x: 1, y: 2, z: 3 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      ],
    }, {
      id: 'camera_b',
      name: 'Authored Camera B',
      kind: 'transform',
      parentId: 'root',
      active: true,
      transformType: 'camera',
      camera: { ...DEFAULT_EDITOR_SCENE_CAMERA, radius: 20 },
      components: [
        { type: 'Transform', position: { x: 4, y: 5, z: 6 }, rotation: { x: 0, y: 0, z: 0 }, scale: { x: 1, y: 1, z: 1 } },
      ],
    });

    const normalized = ensureEditorSceneEnvironmentDefaults(document);
    const cameras = normalized.scene.gameObjects.filter(gameObject => gameObject.transformType === 'camera');
    const demoted = normalized.scene.gameObjects.find(gameObject => gameObject.id === 'camera_b');

    expect(cameras.map(gameObject => gameObject.id)).toEqual(['camera_a']);
    expect(cameras[0]?.camera).toEqual(DEFAULT_EDITOR_SCENE_CAMERA);
    expect(demoted).toMatchObject({
      id: 'camera_b',
      kind: 'transform',
      transformType: 'plain',
    });
    expect(demoted?.camera).toBeUndefined();
  });

  it('edits Camera and Sun Light Inspector settings as projected document data', () => {
    const document = ensureEditorSceneEnvironmentDefaults(createMiniEditorSceneDocument());
    const cameraInspector = getEditorSceneInspectorObject(document, 'main_camera');
    const lightInspector = getEditorSceneInspectorObject(document, 'sun_light');

    expect(cameraInspector?.sections.map(section => section.id)).toEqual([
      'common',
      'hierarchySource',
      'transform',
      'camera',
      'components',
      'metadata',
    ]);
    expect(cameraInspector?.sections.find(section => section.id === 'camera')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'camera.alpha', control: 'number', value: DEFAULT_EDITOR_SCENE_CAMERA.alpha }),
      expect.objectContaining({ path: 'camera.beta', control: 'number', value: DEFAULT_EDITOR_SCENE_CAMERA.beta }),
      expect.objectContaining({ path: 'camera.radius', control: 'number', value: DEFAULT_EDITOR_SCENE_CAMERA.radius }),
      expect.objectContaining({ path: 'camera.orthoSize', control: 'number', value: DEFAULT_EDITOR_SCENE_CAMERA.orthoSize }),
    ]));
    expect(lightInspector?.sections.map(section => section.id)).toEqual([
      'common',
      'hierarchySource',
      'transform',
      'light',
      'components',
      'metadata',
    ]);
    expect(lightInspector?.sections.find(section => section.id === 'light')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'light.intensity', control: 'number', value: DEFAULT_EDITOR_SCENE_SUN_LIGHT.intensity }),
      expect.objectContaining({ path: 'light.direction.x', control: 'number', value: DEFAULT_EDITOR_SCENE_SUN_LIGHT.direction.x }),
      expect.objectContaining({ path: 'light.diffuseColor', control: 'color', value: DEFAULT_EDITOR_SCENE_SUN_LIGHT.diffuseColor }),
    ]));

    const cameraPatch = createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'main_camera',
      path: 'camera.radius',
      value: 20,
    });
    expect(cameraPatch?.reprojectIds).toEqual(['main_camera']);
    let next = reduceEditorSceneDocument(document, {
      type: 'document.patch',
      patch: cameraPatch!.patch,
    });
    expect(next.scene.gameObjects.find(gameObject => gameObject.id === 'main_camera')?.camera?.radius).toBe(20);

    const lightPatch = createEditorSceneInspectorPropertyPatch({
      document: next,
      targetId: 'sun_light',
      path: 'light.diffuseColor',
      value: { r: 0.8, g: 0.72, b: 0.5 },
    });
    expect(lightPatch?.reprojectIds).toEqual(['sun_light']);
    next = reduceEditorSceneDocument(next, {
      type: 'document.patch',
      patch: lightPatch!.patch,
    });
    expect(next.scene.gameObjects.find(gameObject => gameObject.id === 'sun_light')?.light?.diffuseColor).toEqual({ r: 0.8, g: 0.72, b: 0.5 });

    expect(createEditorSceneInspectorPropertyPatch({
      document: next,
      targetId: 'main_camera',
      path: 'camera.orthoSize',
      value: 0,
    })).toBeNull();
    expect(createEditorSceneInspectorPropertyPatch({
      document: next,
      targetId: 'sun_light',
      path: 'light.intensity',
      value: -1,
    })).toBeNull();
    expect(createEditorSceneInspectorPropertyPatch({
      document: next,
      targetId: 'decal',
      path: 'camera.alpha',
      value: 1,
    })).toBeNull();
  });

  it('creates projection payloads for Camera and Sun Light runtime helpers', () => {
    const document = ensureEditorSceneEnvironmentDefaults(createMiniEditorSceneDocument());
    const camera = document.scene.gameObjects.find(gameObject => gameObject.id === 'main_camera')!;
    const light = document.scene.gameObjects.find(gameObject => gameObject.id === 'sun_light')!;
    const cameraProjection = createProjectionNode(document, camera);
    const lightProjection = createProjectionNode(document, light);

    expect(cameraProjection).toMatchObject({
      id: 'main_camera',
      runtimeKind: 'camera',
      camera: DEFAULT_EDITOR_SCENE_CAMERA,
      asset: null,
    });
    expect(lightProjection).toMatchObject({
      id: 'sun_light',
      runtimeKind: 'light',
      light: DEFAULT_EDITOR_SCENE_SUN_LIGHT,
      asset: null,
    });
  });

  it('provides the unique Main Camera rig for Scene Camera preview without document writes', () => {
    const document = ensureEditorSceneEnvironmentDefaults(createMiniEditorSceneDocument());
    const rig = createSceneCameraPreviewRig(document);

    expect(rig).toEqual({
      target: { x: 0, y: 0, z: 0 },
      settings: DEFAULT_EDITOR_SCENE_CAMERA,
    });

    const disabled = {
      ...document,
      scene: {
        ...document.scene,
        gameObjects: document.scene.gameObjects.map(gameObject => (
          gameObject.id === 'main_camera'
            ? { ...gameObject, active: false }
            : gameObject
        )),
      },
    };
    expect(createSceneCameraPreviewRig(disabled)).toBeNull();
  });

  it('builds readonly Inspector sections with source tags and skips unsafe empty values', () => {
    const circular: Record<string, unknown> = {
      z: 3,
      a: 1,
      nested: { b: 2, a: 1 },
    };
    circular.self = circular;
    const section = createEditorSceneReadonlyInspectorSection({
      id: 'runtimeDiagnostics',
      title: 'Runtime Diagnostics',
      order: 10,
      runtimeOnly: true,
      summary: 'TransformNode',
      properties: [
        createEditorSceneReadonlyInspectorProperty({
          path: 'runtime.root.name',
          label: 'Name',
          value: 'Root',
          source: 'Runtime',
        }),
        createEditorSceneReadonlyInspectorProperty({
          path: 'runtime.empty',
          label: 'Empty',
          value: undefined,
          source: 'Runtime',
        }),
        createEditorSceneReadonlyInspectorProperty({
          path: 'runtime.nullish',
          label: 'Nullish',
          value: null,
          source: 'Runtime',
        }),
        createEditorSceneReadonlyInspectorProperty({
          path: 'runtime.raw',
          label: 'Raw',
          value: circular,
          source: 'Runtime',
          tags: ['Raw'],
        }),
      ],
    });

    expect(section).toMatchObject({
      id: 'runtimeDiagnostics',
      summary: 'TransformNode',
      persistence: 'runtime',
      runtimeOnly: true,
    });
    expect(section?.properties.map(property => property.path)).toEqual([
      'runtime.root.name',
      'runtime.raw',
    ]);
    expect(section?.properties[0]).toMatchObject({
      tags: ['Runtime'],
      persistence: 'readonly',
      readOnly: true,
    });
    expect(section?.properties[1]?.value).toEqual({
      a: 1,
      nested: { a: 1, b: 2 },
      self: '[Circular]',
      z: 3,
    });
    expect(section?.properties[1]?.tags).toEqual(['Runtime', 'Raw']);
  });

  it('reads runtime primitives and vector values through safe Inspector helpers', () => {
    const runtime = {
      name: 'Mesh A',
      enabled: true,
      alpha: 0.6253,
      getClassName: () => 'PBRMaterial',
    };
    const throwingRuntime = Object.defineProperty({}, 'name', {
      get() {
        throw new Error('boom');
      },
    });
    const throwingClassRuntime = {
      getClassName() {
        throw new Error('boom');
      },
    };

    expect(readEditorSceneRuntimeString(runtime, 'name')).toBe('Mesh A');
    expect(readEditorSceneRuntimeNumber(runtime, 'alpha')).toBe(0.6253);
    expect(readEditorSceneRuntimeBoolean(runtime, 'enabled')).toBe(true);
    expect(readEditorSceneRuntimeClassName(runtime)).toBe('PBRMaterial');
    expect(readEditorSceneRuntimeString(throwingRuntime, 'name')).toBeNull();
    expect(readEditorSceneRuntimeClassName(throwingClassRuntime)).toBeNull();
    expect(createEditorSceneReadonlyVector3Properties({
      basePath: 'runtime.world.position',
      label: 'World Position',
      value: { x: 1.2345678, y: 0, z: -2 },
      source: 'Derived',
      persistence: 'runtime',
    }).map(property => [property.path, property.value, property.tags])).toEqual([
      ['runtime.world.position.x', 1.234568, ['Derived']],
      ['runtime.world.position.y', 0, ['Derived']],
      ['runtime.world.position.z', -2, ['Derived']],
    ]);
    expect(toEditorSceneInspectorSafeValue(Number.NaN)).toBe('[NonFiniteNumber]');
  });

  it('keeps runtime Inspector construction safe when Babylon methods throw', () => {
    const throwingVector = Object.defineProperty({ y: 0, z: 0 }, 'x', {
      get() {
        throw new Error('vector unavailable');
      },
    });
    const sections = getEditorSceneRuntimeInspectorSections({
      document: createMiniEditorSceneDocument(),
      activeId: 'tree',
      projectedRoot: {
        getChildMeshes() {
          throw new Error('runtime unavailable');
        },
        getHierarchyBoundingVectors: () => ({
          min: throwingVector,
          max: { x: 1, y: 1, z: 1 },
        }),
      },
    });

    expect(sections.map(section => section.id)).toEqual([
      'runtimeBinding',
      'geometryBox',
      'rendering',
      'collisions',
      'physics',
      'shadows',
      'material',
      'materialTextures',
      'materialColors',
      'metallicRoughness',
      'intensityProperties',
      'animationSkeleton',
      'rawMisc',
    ]);
    expect(sections.find(section => section.id === 'runtimeBinding')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.binding.sourceId', value: 'scene.main', tags: ['Document'] }),
      expect.objectContaining({ path: 'runtime.binding.objectId', value: 'tree', persistence: 'runtime', readOnly: true, tags: ['Document'] }),
      expect.objectContaining({ path: 'runtime.material.kind', value: 'none', persistence: 'runtime', readOnly: true }),
    ]));
    expect(sections.find(section => section.id === 'geometryBox')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.bounds.status', value: 'not available' }),
    ]));
  });

  it('exposes document-backed Inspector v2 sections for scene nodes', () => {
    const inspector = getEditorSceneInspectorObject(createMiniEditorSceneDocument(), 'tree');

    expect(inspector?.sections.map(section => section.id)).toEqual([
      'common',
      'hierarchySource',
      'transform',
      'renderer',
      'material',
      'materialTextures',
      'materialColors',
      'metallicRoughness',
      'intensityProperties',
      'outline',
      'components',
      'metadata',
    ]);
    const common = inspector?.sections.find(section => section.id === 'common');
    expect(common).toMatchObject({ summary: 'instance', collapsedByDefault: false });
    expect(common?.properties.map(property => property.path)).toEqual(expect.arrayContaining([
      'name',
      'enabled',
      'kind.resolved',
      'common.activeField',
      'common.transformType',
    ]));
    const hierarchy = inspector?.sections.find(section => section.id === 'hierarchySource');
    expect(hierarchy).toMatchObject({ summary: 'Parent: Root', persistence: 'readonly', collapsedByDefault: true });
    expect(hierarchy?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'hierarchy.parentId', value: 'root', tags: ['Document'] }),
      expect.objectContaining({ path: 'hierarchy.childCount', value: 0, tags: ['Derived'] }),
      expect.objectContaining({ path: 'source.sourceId', value: 'scene.main', tags: ['Document'] }),
    ]));
    const transform = inspector?.sections.find(section => section.id === 'transform');
    expect(transform?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'transform.position.x', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'transform.world.position.x', value: 1, readOnly: true, tags: ['Derived'] }),
    ]));
    const renderer = inspector?.sections.find(section => section.id === 'renderer');
    expect(renderer).toMatchObject({ summary: 'Tree', collapsedByDefault: true });
    expect(renderer?.properties[0]).toMatchObject({
      path: 'instance.assetId',
      control: 'enum',
      persistence: 'document',
    });
    expect(renderer?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'asset.sourceId', value: 'tree_lv1', tags: ['Asset'] }),
      expect.objectContaining({ path: 'asset.materialMode', value: 'instance', tags: ['Asset'] }),
    ]));
    expect(inspector?.sections.find(section => section.id === 'material')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'overrides.material.alpha', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.backFaceCulling', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.raw', readOnly: true, tags: ['Document', 'Raw'] }),
    ]));
    expect(inspector?.sections.find(section => section.id === 'materialTextures')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'overrides.material.albedoTexture.url', control: 'string', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.normalTexture.url', control: 'string', readOnly: false, persistence: 'document' }),
    ]));
    expect(inspector?.sections.find(section => section.id === 'materialColors')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'overrides.material.pbr.reflectivityColor', control: 'color', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.standard.specularColor', control: 'color', readOnly: false, persistence: 'document' }),
    ]));
    expect(inspector?.sections.find(section => section.id === 'metallicRoughness')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'overrides.material.metallic', control: 'number', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.pbr.indexOfRefraction', control: 'number', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.standard.specularPower', control: 'number', readOnly: false, persistence: 'document' }),
    ]));
    expect(inspector?.sections.find(section => section.id === 'intensityProperties')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'overrides.material.contrast', control: 'number', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.pbr.directIntensity', control: 'number', readOnly: false, persistence: 'document' }),
      expect.objectContaining({ path: 'overrides.material.pbr.environmentIntensity', control: 'number', readOnly: false, persistence: 'document' }),
    ]));
    const components = inspector?.sections.find(section => section.id === 'components');
    expect(components).toMatchObject({ summary: 'Transform, ModelRenderer', persistence: 'readonly' });
    expect(components?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'components.count', value: 2, tags: ['Document'] }),
      expect.objectContaining({ path: 'components.1', value: { assetId: 'asset_tree', type: 'ModelRenderer' } }),
    ]));
    expect(inspector?.sections.find(section => section.id === 'metadata')?.persistence).toBe('readonly');
    expect(inspector?.sections.find(section => section.id === 'metadata')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'metadata.document', tags: ['Document', 'Raw'] }),
      expect.objectContaining({ path: 'metadata.asset', value: { source: 'fixture' }, tags: ['Asset', 'Raw'] }),
    ]));
  });

  it('keeps group and multi-selection Inspectors focused on document-safe fields', () => {
    const document = createMiniEditorSceneDocument();
    const groupInspector = getEditorSceneInspectorObject(document, 'root');

    expect(groupInspector?.sections.map(section => section.id)).toEqual([
      'common',
      'hierarchySource',
      'transform',
      'components',
      'metadata',
    ]);
    expect(groupInspector?.sections.find(section => section.id === 'hierarchySource')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'hierarchy.parentId', value: 'none' }),
      expect.objectContaining({ path: 'hierarchy.childCount', value: 2 }),
      expect.objectContaining({ path: 'hierarchy.descendantCount', value: 2 }),
    ]));

    const decalInspector = getEditorSceneInspectorObject(document, 'decal');
    expect(decalInspector?.sections.find(section => section.id === 'common')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: 'transformType',
        control: 'enum',
        value: 'groundDecal',
        readOnly: false,
        persistence: 'document',
      }),
    ]));

    const multiInspector = getEditorSceneInspectorMultiObject(document, ['tree', 'decal'], 'tree');
    expect(multiInspector?.sections.map(section => section.id)).toEqual(['transform']);
    expect(multiInspector?.sections[0]?.properties.every(property => property.readOnly === false)).toBe(true);
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
    next = reduceEditorSceneDocument(next, {
      type: 'document.patch',
      patch: createEditorSceneInspectorPropertyPatch({
        document: next,
        targetId: 'decal',
        path: 'transformType',
        value: 'plain',
      })!.patch,
    });

    const tree = next.scene.gameObjects.find(gameObject => gameObject.id === 'tree')!;
    const decal = next.scene.gameObjects.find(gameObject => gameObject.id === 'decal')!;
    expect(tree.name).toBe('Pine');
    expect(tree.components.find(component => component.type === 'ModelRenderer')).toMatchObject({ assetId: 'asset_fence' });
    expect(tree.overrides?.material?.albedoColor).toEqual({ r: 0.2, g: 0.4, b: 0.6 });
    expect(tree.overrides?.outline?.renderOutline).toBe(true);
    expect(decal.kind).toBe('transform');
    expect(decal.transformType).toBe('plain');
    expect(decal.groundDecal).toBeUndefined();
    expect(getEditorSceneInspectorObject(next, 'decal')?.sections.map(section => section.id)).not.toContain('groundDecal');

    const compiled = compileEditorSceneDocumentToSceneConfig(next, {
      schemaVersion: 2,
      scene: { rootId: 'root', assets: [], nodes: [], materials: [], textures: [] },
    } as SceneConfig);
    const compiledDecal = compiled.sceneConfig.scene?.nodes.find(node => node.id === 'decal');
    expect(compiledDecal).toMatchObject({ kind: 'transform', transformType: 'plain' });
    if (compiledDecal?.kind === 'transform') expect(compiledDecal.groundDecal).toBeUndefined();
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
    expect(createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'tree',
      path: 'overrides.material.pbr.directIntensity',
      value: 'bright',
    })).toBeNull();
    expect(createEditorSceneInspectorPropertyPatch({
      document,
      targetId: 'tree',
      path: 'overrides.material.albedoTexture.url',
      value: {},
    })).toBeNull();
  });

  it('persists expanded material override fields and prunes cleared texture overrides', () => {
    const document = createMiniEditorSceneDocument();
    const patch = (doc: EditorSceneDocument, path: string, value: unknown): EditorSceneDocumentPatch => createEditorSceneInspectorPropertyPatch({
      document: doc,
      targetId: 'tree',
      path,
      value,
    })!.patch;
    const apply = (doc: EditorSceneDocument, path: string, value: unknown): EditorSceneDocument => reduceEditorSceneDocument(doc, {
      type: 'document.patch',
      patch: patch(doc, path, value),
    });

    let next = apply(document, 'overrides.material.albedoTexture.url', '  /textures/tree_albedo.png  ');
    next = apply(next, 'overrides.material.normalTexture.url', '/textures/tree_normal.png');
    next = apply(next, 'overrides.material.contrast', 1.2);
    next = apply(next, 'overrides.material.alphaCutOff', 0.35);
    next = apply(next, 'overrides.material.pbr.reflectivityColor', { r: 0.7, g: 0.8, b: 0.9 });
    next = apply(next, 'overrides.material.pbr.directIntensity', 0.6);
    next = apply(next, 'overrides.material.pbr.environmentIntensity', 1.4);
    next = apply(next, 'overrides.material.standard.specularPower', 48);
    next = apply(next, 'overrides.material.standard.useSpecularOverAlpha', true);

    const tree = next.scene.gameObjects.find(gameObject => gameObject.id === 'tree')!;
    expect(tree.overrides?.material).toMatchObject({
      albedoTexture: { url: '/textures/tree_albedo.png' },
      normalTexture: { url: '/textures/tree_normal.png' },
      contrast: 1.2,
      alphaCutOff: 0.35,
      pbr: {
        reflectivityColor: { r: 0.7, g: 0.8, b: 0.9 },
        directIntensity: 0.6,
        environmentIntensity: 1.4,
      },
      standard: {
        specularPower: 48,
        useSpecularOverAlpha: true,
      },
    });

    const compiled = compileEditorSceneDocumentToSceneConfig(next, {
      schemaVersion: 2,
      scene: { rootId: 'root', assets: [], nodes: [], materials: [], textures: [] },
    } as SceneConfig);
    const compiledTree = compiled.sceneConfig.scene?.nodes.find(node => node.id === 'tree');
    expect(compiledTree?.kind).toBe('instance');
    if (compiledTree?.kind === 'instance') {
      expect(compiledTree.overrides?.material?.pbr?.environmentIntensity).toBe(1.4);
      expect(compiledTree.overrides?.material?.standard?.useSpecularOverAlpha).toBe(true);
    }
    expect(validateSceneJsonV2(compiled.sceneConfig)).toEqual([]);

    const cleared = apply(next, 'overrides.material.albedoTexture.url', '   ');
    const clearedTree = cleared.scene.gameObjects.find(gameObject => gameObject.id === 'tree')!;
    expect(clearedTree.overrides?.material?.albedoTexture).toBeUndefined();
    expect(clearedTree.overrides?.material?.normalTexture).toEqual({ url: '/textures/tree_normal.png' });

    const onlyTexture = apply(document, 'overrides.material.albedoTexture.url', '/textures/temporary.png');
    const onlyTextureCleared = apply(onlyTexture, 'overrides.material.albedoTexture.url', '');
    expect(onlyTextureCleared.scene.gameObjects.find(gameObject => gameObject.id === 'tree')?.overrides).toBeUndefined();
  });

  it('validates node and asset material override fields in scene JSON', () => {
    const validConfig: SceneConfig = {
      schemaVersion: 2,
      scene: {
        rootId: 'root',
        assets: [{
          id: 'asset_tree',
          type: 'glb',
          sourceId: 'tree_lv1',
        }],
        nodes: [{
          id: 'tree',
          kind: 'instance',
          instance: { assetId: 'asset_tree' },
          overrides: {
            material: {
              standard: {
                useSpecularOverAlpha: true,
              },
            },
            childMaterials: {
              trunk: {
                albedoTexture: { url: '/textures/trunk.png' },
              },
            },
          },
        }, {
          id: 'marker',
          kind: 'transform',
          transformType: 'plain',
          overrides: {
            material: {
              pbr: {
                directIntensity: 0.9,
              },
            },
          },
        }],
        materials: [{
          id: 'sharedmat_tree_leaf',
          scope: 'sharedAsset',
          assetId: 'asset_tree',
          materialName: 'leaf',
          properties: {
            pbr: {
              directIntensity: 0.8,
              reflectivityColor: { r: 0.2, g: 0.3, b: 0.4 },
            },
          },
        }, {
          id: 'nodemat_marker',
          scope: 'nodeMaterial',
          nodeId: 'marker',
          materialName: 'marker_mat',
          properties: {
            pbr: {
              environmentIntensity: 0.5,
            },
          },
        }],
        textures: [],
      },
    };
    expect(validateSceneJsonV2(validConfig)).toEqual([]);

    const invalidConfig = structuredClone(validConfig) as any;
    invalidConfig.scene.nodes[0].overrides.material.standard.useSpecularOverAlpha = 'true';
    invalidConfig.scene.nodes[0].overrides.material.pbr = { useSpecularOverAlpha: true };
    invalidConfig.scene.nodes[0].overrides.material.reflectivityColor = { r: 1, g: 1, b: 1 };
    invalidConfig.scene.nodes[0].overrides.material.specularPower = 64;
    invalidConfig.scene.nodes[0].overrides.childMaterials.trunk.pbr = { environmentIntensity: 'bright' };
    invalidConfig.scene.assets[0].defaults = {
      childMaterials: {
        leaf: {
          albedoColor: { r: 1, g: 1, b: 1 },
        },
      },
      material: {
        albedoColor: { r: 1, g: 1, b: 1 },
      },
    };
    invalidConfig.scene.nodes.push({
      id: 'group_with_material',
      kind: 'group',
      overrides: {
        material: {
          albedoColor: { r: 1, g: 1, b: 1 },
        },
      },
    });
    invalidConfig.scene.materials[0].properties.pbr.reflectivityColor = { r: 1, g: 'bad', b: 0 };
    invalidConfig.scene.materials[0].properties.standard = { directIntensity: 1 };
    invalidConfig.scene.materials.push({
      id: 'nodemat_group',
      scope: 'nodeMaterial',
      nodeId: 'group_with_material',
      materialName: 'group_mat',
      properties: {
        albedoColor: { r: 1, g: 1, b: 1 },
      },
    });
    invalidConfig.scene.materials.push({
      id: 'nodemat_group_inferred',
      nodeId: 'group_with_material',
      materialName: 'group_mat',
      properties: {
        albedoColor: { r: 1, g: 1, b: 1 },
      },
    });
    invalidConfig.scene.materials.push({
      id: 'sharedmat_cross_scope',
      scope: 'sharedAsset',
      assetId: 'asset_tree',
      nodeId: 'tree',
      materialName: 'leaf',
      properties: {
        albedoColor: { r: 1, g: 1, b: 1 },
      },
    });
    invalidConfig.scene.materials.push({
      id: 'nodemat_cross_scope',
      scope: 'nodeMaterial',
      assetId: 'asset_tree',
      nodeId: 'tree',
      materialName: 'tree_mat',
      properties: {
        albedoColor: { r: 1, g: 1, b: 1 },
      },
    });
    invalidConfig.scene.materials.push({
      id: 'sharedmat_missing_asset',
      scope: 'sharedAsset',
      assetId: 'missing_asset',
      materialName: 'missing_mat',
      properties: {
        albedoColor: { r: 1, g: 1, b: 1 },
      },
    });
    invalidConfig.scene.materials.push({
      id: 'nodemat_missing_node',
      nodeId: 'missing_node',
      materialName: 'missing_node_mat',
      properties: {
        albedoColor: { r: 1, g: 1, b: 1 },
      },
    });
    invalidConfig.scene.materials.push({
      id: 'sharedmat_empty_properties',
      scope: 'sharedAsset',
      assetId: 'asset_tree',
      materialName: 'empty_props',
      properties: {},
    });
    invalidConfig.scene.materials.push({
      id: 'sharedmat_empty_pbr',
      scope: 'sharedAsset',
      assetId: 'asset_tree',
      materialName: 'empty_pbr',
      properties: {
        pbr: {},
      },
    });
    invalidConfig.scene.materials.push({
      id: 'sharedmat_empty_standard',
      scope: 'sharedAsset',
      assetId: 'asset_tree',
      materialName: 'empty_standard',
      properties: {
        standard: {},
      },
    });

    expect(validateSceneJsonV2(invalidConfig)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        path: '$.scene.nodes[0].overrides.material.standard.useSpecularOverAlpha',
        message: 'useSpecularOverAlpha must be boolean',
      }),
      expect.objectContaining({
        path: '$.scene.nodes[0].overrides.material.pbr.useSpecularOverAlpha',
        message: 'unsupported pbr material override field: useSpecularOverAlpha',
      }),
      expect.objectContaining({
        path: '$.scene.nodes[0].overrides.material.reflectivityColor',
        message: 'unsupported material override field: reflectivityColor',
      }),
      expect.objectContaining({
        path: '$.scene.nodes[0].overrides.material.specularPower',
        message: 'unsupported material override field: specularPower',
      }),
      expect.objectContaining({
        path: '$.scene.nodes[0].overrides.childMaterials.trunk.pbr.environmentIntensity',
        message: 'environmentIntensity must be a finite number',
      }),
      expect.objectContaining({
        path: '$.scene.assets[0].defaults.childMaterials',
        message: 'unsupported asset defaults field: childMaterials',
      }),
      expect.objectContaining({
        path: '$.scene.assets[0].defaults.material',
        message: 'unsupported asset defaults field: material',
      }),
      expect.objectContaining({
        path: '$.scene.nodes[2].overrides',
        message: 'group nodes do not support visual overrides',
      }),
      expect.objectContaining({
        path: '$.scene.materials[0].properties.pbr.reflectivityColor.g',
        message: 'color component must be a finite number',
      }),
      expect.objectContaining({
        path: '$.scene.materials[0].properties.standard.directIntensity',
        message: 'unsupported standard material override field: directIntensity',
      }),
      expect.objectContaining({
        path: '$.scene.materials[2].nodeId',
        message: 'node material nodeId must reference an instance or transform node: group_with_material',
      }),
      expect.objectContaining({
        path: '$.scene.materials[3].nodeId',
        message: 'node material nodeId must reference an instance or transform node: group_with_material',
      }),
      expect.objectContaining({
        path: '$.scene.materials[4].nodeId',
        message: 'shared material must not set nodeId',
      }),
      expect.objectContaining({
        path: '$.scene.materials[5].assetId',
        message: 'node material must not set assetId',
      }),
      expect.objectContaining({
        path: '$.scene.materials[6].assetId',
        message: 'shared material assetId must reference scene.assets: missing_asset',
      }),
      expect.objectContaining({
        path: '$.scene.materials[7].nodeId',
        message: 'node material nodeId must reference scene.nodes: missing_node',
      }),
      expect.objectContaining({
        path: '$.scene.materials[8].properties',
        message: 'material properties must contain at least one override field',
      }),
      expect.objectContaining({
        path: '$.scene.materials[9].properties.pbr',
        message: 'pbr material properties must contain at least one override field',
      }),
      expect.objectContaining({
        path: '$.scene.materials[10].properties.standard',
        message: 'standard material properties must contain at least one override field',
      }),
    ]));
  });

  it('normalizes transform visual overrides and drops empty shared material entries on reload', () => {
    const service = new ConfigService();
    const config: SceneConfig = {
      schemaVersion: 2,
      scene: {
        rootId: 'root',
        assets: [{
          id: 'asset_tree',
          type: 'glb',
          sourceId: 'tree_lv1',
        }],
        nodes: [{
          id: 'marker',
          kind: 'transform',
          transformType: 'plain',
          overrides: {
            material: {
              albedoTexture: { url: '  /textures/marker_albedo.png  ' },
              pbr: {},
              standard: {},
            },
            childMaterials: {
              empty: { pbr: {} },
              sign: { normalTexture: { url: '  /textures/sign_normal.png  ' } },
            },
          },
        }],
        materials: [{
          id: 'sharedmat_empty_properties',
          scope: 'sharedAsset',
          assetId: 'asset_tree',
          materialName: 'empty_props',
          properties: {},
        }, {
          id: 'sharedmat_empty_pbr',
          scope: 'sharedAsset',
          assetId: 'asset_tree',
          materialName: 'empty_pbr',
          properties: { pbr: {} },
        }, {
          id: 'nodemat_marker',
          scope: 'nodeMaterial',
          nodeId: 'marker',
          materialName: 'marker_mat',
          properties: {
            pbr: { directIntensity: 0.5 },
          },
        }],
        textures: [],
      },
    };

    service.replaceSceneConfig(config);

    const marker = service.getSceneNodeById('marker');
    expect(marker?.kind).toBe('transform');
    if (marker?.kind === 'transform') {
      expect(marker.overrides?.material).toEqual({
        albedoTexture: { url: '/textures/marker_albedo.png' },
      });
      expect(marker.overrides?.childMaterials).toEqual({
        sign: { normalTexture: { url: '/textures/sign_normal.png' } },
      });
    }
    expect(service.getSceneConfig().scene?.materials.map(material => material.id)).toEqual(['nodemat_marker']);
  });

  it('keeps legacy document patch paths aligned with expanded material overrides', () => {
    loadProjectEditorDocument({
      schemaVersion: 2,
      scene: {
        rootId: 'root',
        assets: [{
          id: 'asset_tree',
          type: 'glb',
          sourceId: 'tree_lv1',
        }],
        nodes: [{
          id: 'tree',
          kind: 'instance',
          instance: { assetId: 'asset_tree' },
          overrides: {
            material: {
              albedoTexture: { url: '/textures/tree_albedo.png' },
            },
          },
        }],
        materials: [],
        textures: [],
      },
    } as SceneConfig);

    expect(applyProjectMaterialDocumentChange({
      binding: { kind: 'sceneNode', nodeId: 'tree' },
      target: 'root',
      ownerNodePath: '',
      materialName: 'tree_mat',
      materialType: 'PBRMaterial',
      materialRuntimeKind: 'pbr',
      path: 'material.pbr.directIntensity',
      before: null,
      after: 0.55,
    })).toBe(true);
    expect(applyProjectMaterialDocumentChange({
      binding: { kind: 'sceneNode', nodeId: 'tree' },
      target: 'root',
      ownerNodePath: '',
      materialName: 'tree_mat',
      materialType: 'PBRMaterial',
      materialRuntimeKind: 'pbr',
      path: 'material.pbr.metallicF0Factor',
      before: null,
      after: 0.2,
    })).toBe(true);

    let tree = getProjectEditorWorkingDocument().scene?.nodes.find(node => node.id === 'tree');
    expect(tree?.kind).toBe('instance');
    if (tree?.kind === 'instance') {
      expect(tree.overrides?.material?.pbr).toMatchObject({
        directIntensity: 0.55,
        metallicF0Factor: 0.2,
      });
    }

    patchProjectEditorSceneNode({
      nodeId: 'tree',
      patches: [{
        path: 'overrides.material.albedoTexture.url',
        value: '   ',
      }],
    });
    tree = getProjectEditorWorkingDocument().scene?.nodes.find(node => node.id === 'tree');
    expect(tree?.kind).toBe('instance');
    if (tree?.kind === 'instance') {
      expect(tree.overrides?.material?.albedoTexture).toBeUndefined();
      expect(tree.overrides?.material?.pbr?.directIntensity).toBe(0.55);
    }
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
    const { root, projectionNode } = createRuntimeProjectionFixture();
    const sections = getEditorSceneRuntimeInspectorSections({
      document,
      activeId: 'tree',
      projectionNode,
      projectedRoot: root,
    });

    expect(sections.map(section => section.id)).toEqual([
      'runtimeBinding',
      'geometryBox',
      'rendering',
      'collisions',
      'physics',
      'shadows',
      'material',
      'materialTextures',
      'materialColors',
      'metallicRoughness',
      'intensityProperties',
      'animationSkeleton',
      'rawMisc',
    ]);
    expect(sections.find(section => section.id === 'runtimeBinding')).toMatchObject({
      persistence: 'runtime',
      runtimeOnly: true,
      collapsedByDefault: true,
    });
    expect(sections.find(section => section.id === 'runtimeBinding')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.binding.objectId', value: 'tree', persistence: 'runtime', readOnly: true, tags: ['Document'] }),
      expect.objectContaining({ path: 'runtime.binding.component', value: 'ModelRenderer', persistence: 'runtime', readOnly: true, tags: ['Derived'] }),
      expect.objectContaining({ path: 'runtime.projection.assetSource', value: 'tree_lv1', tags: ['Asset'] }),
      expect.objectContaining({ path: 'runtime.material.kind', value: 'pbr', persistence: 'runtime', readOnly: true }),
    ]));
    expect(sections.find(section => section.id === 'geometryBox')).toMatchObject({ collapsedByDefault: false });
    expect(sections.find(section => section.id === 'geometryBox')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.bounds.size.y', value: 4, tags: ['Derived'] }),
      expect.objectContaining({ path: 'runtime.geometry.totalVertices', value: 24, tags: ['Derived'] }),
      expect.objectContaining({ path: 'runtime.geometry.totalIndices', value: 36, tags: ['Derived'] }),
    ]));
    expect(sections.find(section => section.id === 'collisions')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.collisions.checkCollisions', value: true }),
      expect.objectContaining({ path: 'runtime.collisions.ellipsoid.y', value: 1 }),
    ]));
    expect(sections.find(section => section.id === 'physics')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.physics.mass', value: 2 }),
      expect.objectContaining({ path: 'runtime.physics.friction', value: 0.4 }),
    ]));
    expect(sections.find(section => section.id === 'shadows')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.shadows.receiveShadows', value: true }),
      expect.objectContaining({ path: 'runtime.shadows.receivingMeshCount', value: 1, tags: ['Derived'] }),
    ]));
    expect(sections.find(section => section.id === 'material')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.material.className', value: 'PBRMaterial' }),
      expect.objectContaining({ path: 'runtime.material.activeTextureCount', value: 1, tags: ['Derived'] }),
    ]));
    expect(sections.find(section => section.id === 'materialTextures')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.material.textures.albedoTexture.url', value: '/assets/tree_albedo.png' }),
      expect.objectContaining({ path: 'runtime.material.textures.normalTexture.name', value: 'tree_normal' }),
    ]));
    expect(sections.find(section => section.id === 'materialColors')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.material.colors.albedoColor.r', value: 0.1 }),
      expect.objectContaining({ path: 'runtime.material.colors.emissiveColor.g', value: 0.05 }),
    ]));
    expect(sections.find(section => section.id === 'metallicRoughness')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.material.metallicRoughness.metallic', value: 0.2 }),
      expect.objectContaining({ path: 'runtime.material.metallicRoughness.roughness', value: 0.7 }),
    ]));
    expect(sections.find(section => section.id === 'intensityProperties')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.material.intensity.directIntensity', value: 0.8 }),
      expect.objectContaining({ path: 'runtime.material.intensity.environmentIntensity', value: 1.2 }),
    ]));
    expect(sections.find(section => section.id === 'animationSkeleton')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.animation.rootAnimationCount', value: 1, tags: ['Derived'] }),
      expect.objectContaining({ path: 'runtime.skeleton.boneCount', value: 2, tags: ['Derived'] }),
    ]));
    expect(sections.find(section => section.id === 'rawMisc')?.properties).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'runtime.raw.rootMetadata', value: { rootTag: 'runtime' }, tags: ['Runtime', 'Raw'] }),
      expect.objectContaining({ path: 'runtime.raw.projectionAssetMetadata', value: { projectionAsset: true }, tags: ['Asset', 'Raw'] }),
    ]));
  });
});
