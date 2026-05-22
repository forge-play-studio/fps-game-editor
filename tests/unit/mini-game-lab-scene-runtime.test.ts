import { afterEach, describe, expect, it } from 'vitest';
import { Scene } from '@babylonjs/core/scene';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine';
import { Camera } from '@babylonjs/core/Cameras/camera';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { configService, validateSceneJsonV2, type SceneConfig, type SceneNodeConfig } from '../../examples/mini-game-lab/src/config';
import renderingConfig from '../../examples/mini-game-lab/src/config/rendering.json';
import {
  addProjectEditorSceneNode,
  getProjectEditorWorkingDocument,
  loadProjectEditorDocument,
  patchProjectEditorSceneNode,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/document';
import {
  compileEditorSceneDocumentToSceneConfig,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-compiler';
import {
  DEFAULT_EDITOR_SCENE_CAMERA,
  DEFAULT_EDITOR_SCENE_SUN_LIGHT,
  ensureEditorSceneEnvironmentDefaults,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-session';
import { SceneBuilder } from '../../examples/mini-game-lab/src/services/SceneBuilder';
import type {
  EditorSceneDocument,
  EditorSceneGameObject,
} from '../../examples/mini-game-lab/src/fps-game-editor-adapter/editor-scene-document';

const originalSceneConfig = structuredClone(configService.getSceneConfig());

afterEach(() => {
  configService.replaceSceneConfig(structuredClone(originalSceneConfig));
  loadProjectEditorDocument(structuredClone(originalSceneConfig));
});

describe('mini-game-lab transform hierarchy runtime/schema integration', () => {
  it('uses authored Main Camera and Sun Light from compiled editor scene', () => {
    const editorDocument = ensureEditorSceneEnvironmentDefaults({
      schemaVersion: 1,
      assets: [],
      scene: {
        gameObjects: [
          createEditorGameObject('mvp_root', 'MVP Root'),
        ],
      },
    });
    const camera = editorDocument.scene.gameObjects.find(gameObject => gameObject.id === 'main_camera')!;
    const light = editorDocument.scene.gameObjects.find(gameObject => gameObject.id === 'sun_light')!;
    camera.camera = {
      ...DEFAULT_EDITOR_SCENE_CAMERA,
      alpha: 1.1,
      beta: 0.72,
      radius: 22,
      orthoSize: 9,
    };
    light.light = {
      ...DEFAULT_EDITOR_SCENE_SUN_LIGHT,
      intensity: 0.35,
      direction: { x: 0.25, y: -0.8, z: 0.5 },
      diffuseColor: { r: 0.8, g: 0.7, b: 0.55 },
    };

    const compiled = compileEditorSceneDocumentToSceneConfig(editorDocument, createSceneConfig());
    expect(validateSceneJsonV2(compiled.sceneConfig)).toEqual([]);
    configService.replaceSceneConfig(compiled.sceneConfig);

    const engine = new NullEngine();
    const scene = createRuntimeTestScene(engine);
    const builder = new SceneBuilder(scene, {} as any);

    const env = builder.buildSceneEnvironment();

    expect(env.camera.alpha).toBeCloseTo(1.1);
    expect(env.camera.beta).toBeCloseTo(0.72);
    expect(env.camera.radius).toBeCloseTo(22);
    expect(env.camera.mode).toBe(Camera.ORTHOGRAPHIC_CAMERA);
    expect(env.camera.orthoTop).toBe(9);
    expect(env.camera.orthoBottom).toBe(-9);
    expect(builder.getSelectedCameraOrthoSize()).toBe(9);

    expect(env.directionalLight.intensity).toBe(0.35);
    expect(env.directionalLight.direction).toMatchObject({ x: 0.25, y: -0.8, z: 0.5 });
    expect(env.directionalLight.diffuse).toMatchObject({ r: 0.8, g: 0.7, b: 0.55 });

    scene.dispose();
    engine.dispose();
  });

  it('falls back to rendering config when no authored camera or Sun Light exists', () => {
    configService.replaceSceneConfig(createSceneConfig());
    const engine = new NullEngine();
    const scene = createRuntimeTestScene(engine);
    const builder = new SceneBuilder(scene, {} as any);
    const env = builder.buildSceneEnvironment();
    const cameraConfig = (renderingConfig as any).globalVolume.camera;
    const lightConfig = (renderingConfig as any).globalVolume.lights.directional;

    expect(env.camera.alpha).toBe(cameraConfig.alpha);
    expect(env.camera.beta).toBe(cameraConfig.beta);
    expect(env.camera.radius).toBe(14);
    expect(env.camera.orthoTop).toBe(cameraConfig.orthoSizeDesktop);
    expect(builder.getSelectedCameraOrthoSize()).toBe(cameraConfig.orthoSizeDesktop);
    expect(env.directionalLight).toBeInstanceOf(DirectionalLight);
    expect(env.directionalLight.intensity).toBe(lightConfig.intensity);
    expect(env.directionalLight.direction).toMatchObject(lightConfig.direction);

    scene.dispose();
    engine.dispose();
  });

  it('allows authored children under instance and transform scene nodes', () => {
    const sceneConfig = createSceneConfig({
      nodes: [
        {
          id: 'machine',
          kind: 'instance',
          instance: { assetId: 'asset_box' },
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
        {
          id: 'machine_socket',
          kind: 'transform',
          parentId: 'machine',
          transform: { position: { x: 0, y: 2, z: 0 } },
        },
        {
          id: 'socket_child_group',
          kind: 'group',
          parentId: 'machine_socket',
          transform: { position: { x: 0, y: 0, z: 3 } },
        },
      ],
    });

    expect(validateSceneJsonV2(sceneConfig)).toEqual([]);
  });

  it('keeps object parentId through editor-scene compile and validation', () => {
    const editorDocument: EditorSceneDocument = {
      schemaVersion: 1,
      assets: [{ id: 'asset_box', type: 'glb', sourceId: 'box' }],
      scene: {
        gameObjects: [
          createEditorGameObject('mvp_root', 'MVP Root'),
          createEditorGameObject('machine', 'Machine', 'mvp_root', true),
          createEditorGameObject('socket_group', 'Socket Group', 'machine'),
        ],
      },
    };
    const compiled = compileEditorSceneDocumentToSceneConfig(editorDocument, createSceneConfig());

    const machine = compiled.sceneConfig.scene.nodes.find(node => node.id === 'machine');
    const socketGroup = compiled.sceneConfig.scene.nodes.find(node => node.id === 'socket_group');
    expect(machine?.kind).toBe('instance');
    expect(socketGroup?.parentId).toBe('machine');
    expect(validateSceneJsonV2(compiled.sceneConfig)).toEqual([]);
  });

  it('allows ProjectEditor add and patch parentId to target transform-capable scene nodes', () => {
    loadProjectEditorDocument(createSceneConfig({
      nodes: [
        {
          id: 'machine',
          kind: 'instance',
          instance: { assetId: 'asset_box' },
          transform: { position: { x: 0, y: 0, z: 0 } },
        },
        {
          id: 'socket',
          kind: 'transform',
          transform: { position: { x: 1, y: 0, z: 0 } },
        },
      ],
    }));

    addProjectEditorSceneNode({
      id: 'machine_child_group',
      name: 'Machine Child Group',
      kind: 'group',
      parentId: 'machine',
      transform: { position: { x: 0, y: 1, z: 0 } },
    });
    patchProjectEditorSceneNode({
      nodeId: 'machine_child_group',
      patches: [{ path: 'parentId', value: 'socket' }],
    });

    const node = getProjectEditorWorkingDocument().scene.nodes.find(item => item.id === 'machine_child_group');
    expect(node?.parentId).toBe('socket');
    expect(validateSceneJsonV2(getProjectEditorWorkingDocument())).toEqual([]);
  });

  it('builds children under transform parents without falling back to root', async () => {
    const sceneConfig = createSceneConfig({
      nodes: [
        {
          id: 'child_group',
          kind: 'group',
          parentId: 'socket_parent',
          transform: { position: { x: 0, y: 1, z: 0 } },
        },
        {
          id: 'socket_parent',
          kind: 'transform',
          transform: { position: { x: 2, y: 0, z: 0 } },
        },
      ],
    });
    configService.replaceSceneConfig(sceneConfig);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const builder = new SceneBuilder(scene, {} as any);

    await builder.loadSceneFromDocument();

    expect(builder.getSceneNodeRuntime('child_group')?.parent).toBe(builder.getSceneNodeRuntime('socket_parent'));
    scene.dispose();
    engine.dispose();
  });

  it('builds children under out-of-order instance parents without falling back to root', async () => {
    const sceneConfig = createSceneConfig({
      nodes: [
        {
          id: 'child_group',
          kind: 'group',
          parentId: 'machine_parent',
          transform: { position: { x: 0, y: 1, z: 0 } },
        },
        {
          id: 'machine_parent',
          kind: 'instance',
          instance: { assetId: 'asset_box' },
          transform: { position: { x: 2, y: 0, z: 0 } },
        },
      ],
    });
    configService.replaceSceneConfig(sceneConfig);
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const builder = new SceneBuilder(scene, {
      async loadAssetContainer() {},
    } as any, createStubModelPool(scene));

    await builder.loadSceneFromDocument();

    expect(builder.getSceneNodeRuntime('child_group')?.parent).toBe(builder.getSceneNodeRuntime('machine_parent'));
    scene.dispose();
    engine.dispose();
  });
});

function createSceneConfig(input: { nodes?: SceneNodeConfig[] } = {}): SceneConfig {
  return {
    schemaVersion: 2,
    scene: {
      rootId: 'root',
      assets: [{ id: 'asset_box', type: 'glb', sourceId: 'box' }],
      nodes: input.nodes ?? [],
      materials: [],
      textures: [],
    },
  };
}

function createRuntimeTestScene(engine: NullEngine): Scene {
  const scene = new Scene(engine);
  (scene as any).createDefaultEnvironment = () => null;
  return scene;
}

function createStubModelPool(scene: Scene) {
  return {
    acquire(sourceId: string) {
      return {
        modelId: sourceId,
        node: new TransformNode(`${sourceId}_runtime`, scene),
        animations: [],
      };
    },
    acquireUnique(sourceId: string) {
      return this.acquire(sourceId);
    },
    release() {},
  } as any;
}

function createEditorGameObject(
  id: string,
  name: string,
  parentId?: string,
  withModelRenderer = false,
): EditorSceneGameObject {
  return {
    id,
    name,
    ...(parentId ? { parentId } : {}),
    active: true,
    components: [
      {
        type: 'Transform',
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      ...(withModelRenderer ? [{ type: 'ModelRenderer' as const, assetId: 'asset_box' }] : []),
    ],
  };
}
