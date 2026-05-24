import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import type { EditorTransformSnapshot } from '@fps-games/editor-core';
import { createBabylonEditorProjection } from '../../packages/editor-babylon/src/projection';
import { createBabylonSceneCameraPreviewController } from '../../packages/editor-babylon/src/scene-camera-preview';

describe('Babylon editor projection runtime helpers', () => {
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
    expect(scene.meshes.find(mesh => mesh.name === 'main_camera.cameraFrustum')?.metadata?.editorProjection).toMatchObject({
      nodeId: 'main_camera',
      runtimeKind: 'camera',
      helper: 'frustum',
      orthoSize: 8,
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

  it('previews descendant world transforms while a parent node is dragged', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    const parentBefore = editorTransformAt(1, 0, 0);
    const childBefore = editorTransformAt(3, 0, 0);
    const grandchildBefore = editorTransformAt(5, 0, 0);
    projection.projectNodes([
      { id: 'parent', transform: parentBefore },
      { id: 'child', parentId: 'parent', transform: childBefore },
      { id: 'grandchild', parentId: 'child', transform: grandchildBefore },
    ]);

    projection.setNodeTransformPreview('parent', editorTransformAt(2, 0, 0));

    expectTransformPosition(projection.readNodeTransform('parent'), { x: 2, y: 0, z: 0 });
    expectTransformPosition(projection.readNodeTransform('child'), { x: 4, y: 0, z: 0 });
    expectTransformPosition(projection.readNodeTransform('grandchild'), { x: 6, y: 0, z: 0 });

    projection.setNodeTransformPreview('parent', parentBefore);

    expectTransformPosition(projection.readNodeTransform('parent'), { x: 1, y: 0, z: 0 });
    expectTransformPosition(projection.readNodeTransform('child'), { x: 3, y: 0, z: 0 });
    expectTransformPosition(projection.readNodeTransform('grandchild'), { x: 5, y: 0, z: 0 });

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps explicitly previewed descendants as subtree roots', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    projection.projectNodes([
      { id: 'parent', transform: editorTransformAt(1, 0, 0) },
      { id: 'child', parentId: 'parent', transform: editorTransformAt(3, 0, 0) },
      { id: 'grandchild', parentId: 'child', transform: editorTransformAt(5, 0, 0) },
    ]);

    projection.setNodeTransformsPreview({
      parent: editorTransformAt(2, 0, 0),
      child: editorTransformAt(10, 0, 0),
    });

    expectTransformPosition(projection.readNodeTransform('parent'), { x: 2, y: 0, z: 0 });
    expectTransformPosition(projection.readNodeTransform('child'), { x: 10, y: 0, z: 0 });
    expectTransformPosition(projection.readNodeTransform('grandchild'), { x: 12, y: 0, z: 0 });

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('updates projection parent links when a node is reparented', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const projection = createBabylonEditorProjection({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    const child = {
      id: 'child',
      parentId: 'parent_a',
      transform: editorTransformAt(3, 0, 0),
    };
    projection.projectNodes([
      { id: 'parent_a', transform: editorTransformAt(1, 0, 0) },
      { id: 'parent_b', transform: editorTransformAt(20, 0, 0) },
      child,
    ]);
    projection.syncNodeTransform({
      ...child,
      parentId: 'parent_b',
    });

    projection.setNodeTransformPreview('parent_a', editorTransformAt(2, 0, 0));
    expectTransformPosition(projection.readNodeTransform('child'), { x: 3, y: 0, z: 0 });

    projection.setNodeTransformPreview('parent_b', editorTransformAt(21, 0, 0));
    expectTransformPosition(projection.readNodeTransform('child'), { x: 4, y: 0, z: 0 });

    projection.dispose();
    scene.dispose();
    engine.dispose();
  });
});

function editorTransformAt(x: number, y: number, z: number): EditorTransformSnapshot {
  return {
    position: { x, y, z },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
  };
}

function expectTransformPosition(
  transform: EditorTransformSnapshot | null,
  expected: { x: number; y: number; z: number },
): void {
  expect(transform?.position.x).toBeCloseTo(expected.x, 5);
  expect(transform?.position.y).toBeCloseTo(expected.y, 5);
  expect(transform?.position.z).toBeCloseTo(expected.z, 5);
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
