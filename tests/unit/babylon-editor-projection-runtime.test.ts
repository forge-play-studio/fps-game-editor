import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createBabylonEditorProjection } from '../../packages/editor-babylon/src/projection';
import { createBabylonSceneCameraPreviewController } from '../../packages/editor-babylon/src/scene-camera-preview';

describe('Babylon editor projection runtime helpers', () => {
  it('creates primitive projection materials from artist material kind', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    const pbrNode = projection.projectNode({
      id: 'pbr_plane',
      primitive: { shape: 'plane' },
      artistMaterialKind: 'pbr',
      artistMaterialProfile: {
        metallic: 0.7,
        roughness: 0.2,
      },
    });
    const pbrMaterial = pbrNode?.outlineMeshes[0]?.material;
    expect(pbrMaterial).toBeInstanceOf(BABYLON.PBRMaterial);
    expect(pbrMaterial?.metallic).toBeCloseTo(0.7);
    expect(pbrMaterial?.roughness).toBeCloseTo(0.2);

    const standardNode = projection.projectNode({
      id: 'standard_box',
      primitive: { shape: 'cube' },
      artistMaterialKind: 'standard',
      artistMaterialProfile: {
        baseColor: {
          color: { r: 1, g: 0.25, b: 0.125 },
        },
        metallic: 0.7,
        roughness: 0.2,
      },
    });
    const standardMaterial = standardNode?.outlineMeshes[0]?.material;
    expect(standardMaterial).toBeInstanceOf(BABYLON.StandardMaterial);
    expect(standardMaterial?.diffuseColor.r).toBeCloseTo(1);
    expect(standardMaterial?.diffuseColor.g).toBeCloseTo(0.25);
    expect(standardMaterial?.diffuseColor.b).toBeCloseTo(0.125);
    expect('metallic' in standardMaterial).toBe(false);
    expect((standardMaterial as any)?.roughness).not.toBeCloseTo(0.2);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('renders the MVP root helper as a sphere with a Root label', () => {
    const { babylon, scene } = createFakeRootProjectionRuntime();
    const projection = createBabylonEditorProjection({
      babylon: babylon as any,
      scene: scene as any,
    });

    projection.projectNode({
      id: 'mvp_root',
      name: 'MVP Root',
      helperKind: 'root',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });

    expect(scene.meshes.find((mesh: any) => mesh.name === 'mvp_root.rootMarker')?.metadata?.editorProjection).toMatchObject({
      nodeId: 'mvp_root',
      helperKind: 'root',
      helper: 'anchor',
    });
    expect(scene.meshes.find((mesh: any) => mesh.name === 'mvp_root.rootLabel')?.metadata?.editorProjection).toMatchObject({
      nodeId: 'mvp_root',
      helperKind: 'root',
      helper: 'label',
      text: 'Root',
    });

    projection.projectNode({
      id: 'mvp_root',
      name: 'MVP Root',
      helperKind: 'root',
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });

    expect(scene.meshes.filter((mesh: any) => mesh.name === 'mvp_root.rootMarker')).toHaveLength(1);
    expect(scene.meshes.filter((mesh: any) => mesh.name === 'mvp_root.rootLabel')).toHaveLength(1);

    projection.dispose();
    expect(scene.meshes.filter((mesh: any) => mesh.name.startsWith('mvp_root.'))).toHaveLength(0);
  });

  it('reprojects Camera helpers from authored camera settings without helper duplicates', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    projection.projectNode({
      id: 'main_camera',
      name: 'Main Camera',
      runtimeKind: 'camera',
      transform: {
        position: { x: 0, y: 5, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      camera: {
        alpha: Math.PI,
        beta: 0.8,
        radius: 14,
        orthoSize: 8,
      },
    });

    expect(scene.meshes.filter(mesh => mesh.name === 'main_camera.cameraHelper')).toHaveLength(1);
    const frustum = scene.meshes.find(mesh => mesh.name === 'main_camera.cameraFrustum');
    expect(frustum?.metadata?.editorProjection).toMatchObject({
      nodeId: 'main_camera',
      runtimeKind: 'camera',
      helper: 'frustum',
      orthoSize: 8,
    });
    const positions = frustum?.getVerticesData(BABYLON.VertexBuffer.PositionKind) ?? [];
    expect(Math.min(...positions.filter((_value, index) => index % 3 === 2))).toBeLessThan(0);
    expect(Math.max(...positions.filter((_value, index) => index % 3 === 2))).toBeCloseTo(0.18);

    projection.projectNode({
      id: 'main_camera',
      name: 'Main Camera',
      runtimeKind: 'camera',
      transform: {
        position: { x: 0, y: 5, z: -8 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      camera: {
        alpha: Math.PI,
        beta: 0.8,
        radius: 14,
        orthoSize: 12,
      },
    });

    expect(scene.meshes.filter(mesh => mesh.name === 'main_camera.cameraHelper')).toHaveLength(1);
    expect(scene.meshes.find(mesh => mesh.name === 'main_camera.cameraFrustum')?.metadata?.editorProjection?.orthoSize).toBe(12);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('creates and disposes one DirectionalLight when Sun Light is reprojected', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    projection.projectNode({
      id: 'sun_light',
      name: 'Sun Light',
      runtimeKind: 'light',
      transform: {
        position: { x: 0, y: 4, z: -3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      light: {
        type: 'directional',
        intensity: 2,
        direction: { x: -0.3, y: -1, z: -0.2 },
        diffuseColor: { r: 1, g: 0.9, b: 0.7 },
      },
    });

    let lights = scene.lights.filter(light => light.name === 'sun_light.directionalLight');
    expect(lights).toHaveLength(1);
    expect(lights[0]?.intensity).toBe(2);
    expect((lights[0] as BABYLON.DirectionalLight | undefined)?.direction).toMatchObject({ x: -0.3, y: -1, z: -0.2 });
    const directionHelper = scene.meshes.find(mesh => mesh.name === 'sun_light.lightDirection');
    const directionPositions = directionHelper?.getVerticesData(BABYLON.VertexBuffer.PositionKind) ?? [];
    const directionYValues = directionPositions.filter((_value, index) => index % 3 === 1);
    expect(Math.min(...directionYValues)).toBeLessThan(-0.9);

    projection.projectNode({
      id: 'sun_light',
      name: 'Sun Light',
      runtimeKind: 'light',
      transform: {
        position: { x: 0, y: 4, z: -3 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      light: {
        type: 'directional',
        intensity: 0.6,
        direction: { x: 0, y: -1, z: 0 },
        diffuseColor: { r: 0.8, g: 0.8, b: 1 },
      },
    });

    lights = scene.lights.filter(light => light.name === 'sun_light.directionalLight');
    expect(lights).toHaveLength(1);
    expect(lights[0]?.intensity).toBe(0.6);
    expect((lights[0] as BABYLON.DirectionalLight | undefined)?.direction).toMatchObject({ x: 0, y: -1, z: 0 });

    projection.removeNode('sun_light');
    expect(scene.lights.filter(light => light.name === 'sun_light.directionalLight')).toHaveLength(0);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('creates and disposes one HemisphericLight when Hemispheric Light is reprojected', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    projection.projectNode({
      id: 'environment_light',
      name: 'Hemispheric Light',
      active: false,
      runtimeKind: 'light',
      transform: {
        position: { x: 0, y: 3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      light: {
        type: 'hemispheric',
        intensity: 0.8,
        diffuseColor: { r: 0.9, g: 0.95, b: 1 },
        groundColor: { r: 0.2, g: 0.25, b: 0.32 },
      },
    });

    let lights = scene.lights.filter(light => light.name === 'environment_light.hemisphericLight');
    expect(lights).toHaveLength(1);
    expect(lights[0]).toBeInstanceOf(BABYLON.HemisphericLight);
    expect(lights[0]?.intensity).toBe(0.8);
    expect(lights[0]?.isEnabled()).toBe(false);
    expect((lights[0] as BABYLON.HemisphericLight | undefined)?.diffuse).toMatchObject({ r: 0.9, g: 0.95, b: 1 });
    expect((lights[0] as BABYLON.HemisphericLight | undefined)?.groundColor).toMatchObject({ r: 0.2, g: 0.25, b: 0.32 });

    projection.projectNode({
      id: 'environment_light',
      name: 'Hemispheric Light',
      runtimeKind: 'light',
      transform: {
        position: { x: 0, y: 3, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      light: {
        type: 'hemispheric',
        intensity: 0.2,
        diffuseColor: { r: 0.4, g: 0.5, b: 0.6 },
        groundColor: { r: 0.1, g: 0.12, b: 0.14 },
      },
    });

    lights = scene.lights.filter(light => light.name === 'environment_light.hemisphericLight');
    expect(lights).toHaveLength(1);
    expect(lights[0]?.intensity).toBe(0.2);
    expect((lights[0] as BABYLON.HemisphericLight | undefined)?.diffuse).toMatchObject({ r: 0.4, g: 0.5, b: 0.6 });
    expect((lights[0] as BABYLON.HemisphericLight | undefined)?.groundColor).toMatchObject({ r: 0.1, g: 0.12, b: 0.14 });

    projection.removeNode('environment_light');
    expect(scene.lights.filter(light => light.name === 'environment_light.hemisphericLight')).toHaveLength(0);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('emits a projection batch settled event after all async model imports are ready', async () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const deferredImports = new Map<string, Deferred<any>>();
    const readyEvents: Array<{ nodeId: string; async: boolean }> = [];
    const batchEvents: Array<{
      batchId: number;
      nodeIds: string[];
      asyncNodeIds: string[];
      settledNodeIds: string[];
    }> = [];
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
      importModel: async ({ node }) => {
        const deferred = createDeferred<any>();
        deferredImports.set(node.id, deferred);
        return deferred.promise;
      },
      onProjectionReady: event => readyEvents.push(event),
      onProjectionBatchSettled: event => batchEvents.push(event),
    });

    projection.projectNodes([
      {
        id: 'asset_a',
        asset: { id: 'asset_a_model' },
      },
      {
        id: 'sync_cube',
        primitive: { shape: 'cube' },
      },
      {
        id: 'asset_b',
        asset: { id: 'asset_b_model' },
      },
    ]);
    await flushMicrotasks();

    expect(batchEvents).toHaveLength(0);

    deferredImports.get('asset_a')?.resolve({
      meshes: [BABYLON.MeshBuilder.CreateBox('asset_a_mesh', { size: 1 }, scene)],
      transformNodes: [],
      animationGroups: [],
    });
    await flushMicrotasks();

    expect(readyEvents.map(event => event.nodeId)).toEqual(['asset_a']);
    expect(batchEvents).toHaveLength(0);

    deferredImports.get('asset_b')?.resolve({
      meshes: [BABYLON.MeshBuilder.CreateBox('asset_b_mesh', { size: 1 }, scene)],
      transformNodes: [],
      animationGroups: [],
    });
    await flushMicrotasks();

    expect(readyEvents.map(event => event.nodeId)).toEqual(['asset_a', 'asset_b']);
    expect(batchEvents).toHaveLength(1);
    expect(batchEvents[0]?.batchId).toBe(1);
    expect(batchEvents[0]?.nodeIds).toEqual(['asset_a', 'sync_cube', 'asset_b']);
    expect(batchEvents[0]?.asyncNodeIds).toEqual(['asset_a', 'asset_b']);
    expect([...batchEvents[0]!.settledNodeIds].sort()).toEqual(['asset_a', 'asset_b', 'sync_cube']);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('ignores stale async projection readiness after a newer projection batch replaces it', async () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const staleImport = createDeferred<any>();
    const readyEvents: Array<{ nodeId: string; async: boolean }> = [];
    const batchEvents: Array<{
      batchId: number;
      nodeIds: string[];
      asyncNodeIds: string[];
      settledNodeIds: string[];
    }> = [];
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
      importModel: async () => staleImport.promise,
      onProjectionReady: event => readyEvents.push(event),
      onProjectionBatchSettled: event => batchEvents.push(event),
    });

    projection.projectNodes([
      {
        id: 'stale_asset',
        asset: { id: 'stale_asset_model' },
      },
    ]);
    await flushMicrotasks();

    projection.projectNodes([
      {
        id: 'replacement_cube',
        primitive: { shape: 'cube' },
      },
    ]);
    await flushMicrotasks();

    expect(batchEvents).toHaveLength(1);
    expect(batchEvents[0]?.nodeIds).toEqual(['replacement_cube']);
    expect(batchEvents[0]?.asyncNodeIds).toEqual([]);

    staleImport.resolve({
      meshes: [BABYLON.MeshBuilder.CreateBox('stale_asset_mesh', { size: 1 }, scene)],
      transformNodes: [],
      animationGroups: [],
    });
    await flushMicrotasks();

    expect(readyEvents).toHaveLength(0);
    expect(batchEvents).toHaveLength(1);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps an earlier async projection batch alive when a later single-node projection is added', async () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const deferredImports = new Map<string, Deferred<any>>();
    const batchEvents: Array<{
      batchId: number;
      nodeIds: string[];
      asyncNodeIds: string[];
      settledNodeIds: string[];
    }> = [];
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
      importModel: async ({ node }) => {
        const deferred = createDeferred<any>();
        deferredImports.set(node.id, deferred);
        return deferred.promise;
      },
      onProjectionBatchSettled: event => batchEvents.push(event),
    });

    projection.projectNodes([
      {
        id: 'batch_asset_a',
        asset: { id: 'batch_asset_a_model' },
      },
      {
        id: 'batch_asset_b',
        asset: { id: 'batch_asset_b_model' },
      },
    ]);
    await flushMicrotasks();

    projection.projectNode({
      id: 'late_sync_cube',
      primitive: { shape: 'cube' },
    });
    await flushMicrotasks();

    expect(batchEvents).toHaveLength(1);
    expect(batchEvents[0]?.nodeIds).toEqual(['late_sync_cube']);

    deferredImports.get('batch_asset_a')?.resolve({
      meshes: [BABYLON.MeshBuilder.CreateBox('batch_asset_a_mesh', { size: 1 }, scene)],
      transformNodes: [],
      animationGroups: [],
    });
    deferredImports.get('batch_asset_b')?.resolve({
      meshes: [BABYLON.MeshBuilder.CreateBox('batch_asset_b_mesh', { size: 1 }, scene)],
      transformNodes: [],
      animationGroups: [],
    });
    await flushMicrotasks();

    expect(batchEvents).toHaveLength(2);
    expect(batchEvents[1]?.nodeIds).toEqual(['batch_asset_a', 'batch_asset_b']);
    expect(batchEvents[1]?.asyncNodeIds).toEqual(['batch_asset_a', 'batch_asset_b']);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('detaches shared imported material before applying a slot material profile', async () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const sharedMaterial = new BABYLON.StandardMaterial('shared_slot_material', scene);
    sharedMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.3, 0.4);
    const slotA = BABYLON.MeshBuilder.CreateBox('slot_a', { size: 1 }, scene);
    const slotB = BABYLON.MeshBuilder.CreateBox('slot_b', { size: 1 }, scene);
    slotA.material = sharedMaterial;
    slotB.material = sharedMaterial;

    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
      importModel: async () => ({
        meshes: [slotA, slotB],
        transformNodes: [],
        animationGroups: [],
      }),
    });

    const projected = projection.projectNode({
      id: 'asset_node',
      name: 'Asset Node',
      asset: { id: 'asset_box', sourceId: 'box' },
      artistMaterialSlotProfiles: {
        slot_a: {
          baseColor: {
            color: { r: 1, g: 0, b: 0 },
          },
        },
      },
    });

    await projected?.loadPromise;

    expect(slotA.material).toBeInstanceOf(BABYLON.StandardMaterial);
    expect(slotA.material).not.toBe(sharedMaterial);
    expect((slotA.material as BABYLON.StandardMaterial).diffuseColor.r).toBeCloseTo(1);
    expect((slotA.material as BABYLON.StandardMaterial).diffuseColor.g).toBeCloseTo(0);
    expect((slotA.material as BABYLON.StandardMaterial).diffuseColor.b).toBeCloseTo(0);
    expect(slotB.material).toBe(sharedMaterial);
    expect(sharedMaterial.diffuseColor.r).toBeCloseTo(0.2);
    expect(sharedMaterial.diffuseColor.g).toBeCloseTo(0.3);
    expect(sharedMaterial.diffuseColor.b).toBeCloseTo(0.4);

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });
});

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flushMicrotasks(): Promise<void> {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

function createFakeRootProjectionRuntime() {
  const scene: { meshes: any[] } = { meshes: [] };
  class Vector3 {
    constructor(public x: number, public y: number, public z: number) {}
  }
  class Color3 {
    constructor(public r: number, public g: number, public b: number) {}
  }
  class TransformNode {
    public id = '';
    public metadata: Record<string, unknown> = {};
    public position = new Vector3(0, 0, 0);
    public rotation = new Vector3(0, 0, 0);
    public scaling = new Vector3(1, 1, 1);
    public children: any[] = [];
    constructor(public name: string) {}
    setEnabled() {}
    dispose() {
      for (const child of [...this.children]) child.dispose?.();
      this.children.length = 0;
    }
  }
  class FakeMesh {
    public id = '';
    public metadata: Record<string, any> = {};
    public position = new Vector3(0, 0, 0);
    public rotation = new Vector3(0, 0, 0);
    public scaling = new Vector3(1, 1, 1);
    public material: any = null;
    public isPickable = true;
    public billboardMode = 0;
    private parentNode: any = null;
    constructor(public name: string) {
      scene.meshes.push(this);
    }
    set parent(parent: any) {
      this.parentNode = parent;
      parent?.children?.push(this);
    }
    get parent() {
      return this.parentNode;
    }
    dispose() {
      scene.meshes = scene.meshes.filter(mesh => mesh !== this);
    }
  }
  class StandardMaterial {
    constructor(public name: string) {}
    dispose() {}
  }
  class DynamicTexture {
    public hasAlpha = false;
    constructor(public name: string) {}
    getContext() {
      return {
        clearRect() {},
        beginPath() {},
        roundRect() {},
        fill() {},
        stroke() {},
        fillText() {},
      };
    }
    update() {}
    dispose() {}
  }
  return {
    scene,
    babylon: {
      TransformNode,
      Vector3,
      Color3,
      DynamicTexture,
      StandardMaterial,
      Mesh: { BILLBOARDMODE_ALL: 7 },
      MeshBuilder: {
        CreateSphere: (name: string) => new FakeMesh(name),
        CreatePlane: (name: string) => new FakeMesh(name),
      },
    },
  };
}

describe('Babylon scene camera preview controller', () => {
  it('temporarily switches to authored orthographic camera and restores the editor camera', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const editorCamera = new BABYLON.ArcRotateCamera('editor', 0, 1, 10, new BABYLON.Vector3(1, 2, 3), scene);
    scene.activeCamera = editorCamera;
    scene.activeCameras = [editorCamera];
    scene.cameraToUseForPointers = editorCamera;

    const preview = createBabylonSceneCameraPreviewController({
      babylon: BABYLON as any,
      scene: scene as any,
      editorCamera,
    });
    preview.setActive(true, {
      target: { x: 2, y: 0, z: -1 },
      settings: {
        alpha: 1.2,
        beta: 0.7,
        radius: 18,
        orthoSize: 8,
      },
    });

    expect(preview.isActive()).toBe(true);
    expect(scene.activeCamera?.name).toBe('editor-main-camera-preview');
    expect(scene.cameraToUseForPointers?.name).toBe('editor-main-camera-preview');
    expect(scene.activeCamera?.mode).toBe(BABYLON.Camera.ORTHOGRAPHIC_CAMERA);
    expect(scene.activeCamera?.alpha).toBe(1.2);
    expect(scene.activeCamera?.beta).toBe(0.7);
    expect(scene.activeCamera?.radius).toBe(18);
    expect(scene.activeCamera?.orthoTop).toBe(8);
    expect(scene.activeCamera?.orthoBottom).toBe(-8);

    preview.sync({
      target: { x: 0, y: 0, z: 0 },
      settings: {
        alpha: 1.4,
        beta: 0.8,
        radius: 16,
        orthoSize: 6,
      },
    });
    expect(scene.activeCamera?.alpha).toBe(1.4);
    expect(scene.activeCamera?.orthoTop).toBe(6);

    preview.setActive(false);
    expect(preview.isActive()).toBe(false);
    expect(scene.activeCamera).toBe(editorCamera);
    expect(scene.cameraToUseForPointers).toBe(editorCamera);
    expect(scene.activeCameras).toHaveLength(1);
    expect(scene.activeCameras?.[0]).toBe(editorCamera);

    preview.dispose();
    scene.dispose();
    engine.dispose();
  });
});
