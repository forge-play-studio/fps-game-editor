import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createBabylonEditorProjection } from '../../packages/editor-babylon/src/projection';
import { createBabylonSceneCameraPreviewController } from '../../packages/editor-babylon/src/scene-camera-preview';

describe('Babylon editor projection runtime helpers', () => {
  it('renders the MVP root helper as a sphere with a World Origin label', () => {
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
      text: 'World Origin',
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

  it('notifies when an async model projection becomes renderable', async () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const readyNodeIds: string[] = [];
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
      importModel: async () => ({
        meshes: [BABYLON.MeshBuilder.CreateBox('asset_node.mesh', { size: 1 }, scene)],
        transformNodes: [],
        animationGroups: [],
      }),
      onProjectionReady(event) {
        readyNodeIds.push(event.nodeId);
      },
    });

    const projected = projection.projectNode({
      id: 'asset_node',
      name: 'Asset Node',
      asset: { id: 'asset_box', sourceId: 'box' },
      transform: {
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
    });

    await projected?.loadPromise;

    expect(readyNodeIds).toEqual(['asset_node']);
    expect(scene.meshes.find(mesh => mesh.name === 'asset_node.mesh')?.parent?.name).toBe('asset_node.modelRoot');

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });
});

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
    expect(scene.activeCamera?.name).toBe('editor-scene-camera-preview');
    expect(scene.cameraToUseForPointers?.name).toBe('editor-scene-camera-preview');
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
