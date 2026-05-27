import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import {
  createBabylonSceneCameraPreviewController,
  createBabylonSceneCameraPreviewRigFromProjectionNode,
} from '../../packages/editor-babylon/src/scene-camera-preview';

describe('Babylon scene camera preview controller', () => {
  it('applies and syncs a live camera transform rig', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const editorCamera = new BABYLON.UniversalCamera('editor', new BABYLON.Vector3(0, 1, -5), scene);
    scene.activeCamera = editorCamera;

    const controller = createBabylonSceneCameraPreviewController({
      babylon: BABYLON as any,
      scene: scene as any,
      editorCamera: editorCamera as any,
    });

    controller.setActive(true, {
      transform: {
        position: { x: 1, y: 2, z: 3 },
        rotation: { x: 0.3, y: 0.4, z: 0.5 },
        scale: { x: 1, y: 1, z: 1 },
      },
      settings: {
        alpha: 0,
        beta: Math.PI / 2,
        radius: 10,
        orthoSize: 4,
      },
    });

    expect(controller.isActive()).toBe(true);
    expect(scene.activeCamera?.name).toBe('editor-main-camera-preview');
    expect(scene.activeCamera?.position).toMatchObject({ x: 1, y: 2, z: 3 });
    expect(scene.activeCamera?.rotation).toMatchObject({ x: 0.3, y: 0.4, z: 0.5 });
    expect(scene.activeCamera?.mode).toBe(BABYLON.Camera.ORTHOGRAPHIC_CAMERA);
    expect(scene.activeCamera?.orthoTop).toBe(4);

    controller.sync({
      transform: {
        position: { x: -2, y: 6, z: -8 },
        rotation: { x: Math.PI / 6, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      settings: {
        alpha: 0,
        beta: Math.PI / 2,
        radius: 10,
        orthoSize: 6,
      },
    });

    expect(scene.activeCamera?.position).toMatchObject({ x: -2, y: 6, z: -8 });
    expect(scene.activeCamera?.rotation.x).toBeCloseTo(Math.PI / 6);
    expect(scene.activeCamera?.orthoTop).toBe(6);

    controller.setActive(false);
    expect(scene.activeCamera).toBe(editorCamera);
  });

  it('uses glTF camera convention for transform preview forward in right-handed scenes', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    scene.useRightHandedSystem = true;
    const editorCamera = new BABYLON.UniversalCamera('editor', new BABYLON.Vector3(0, 1, -5), scene);
    const helper = new BABYLON.TransformNode('helper', scene);
    helper.rotation = new BABYLON.Vector3(Math.PI / 2, 0, 0);
    const helperForward = BABYLON.Vector3.TransformNormal(
      new BABYLON.Vector3(0, 0, -1),
      helper.getWorldMatrix(),
    );

    const controller = createBabylonSceneCameraPreviewController({
      babylon: BABYLON as any,
      scene: scene as any,
      editorCamera: editorCamera as any,
    });

    controller.setActive(true, {
      transform: {
        position: { x: 0, y: 5, z: -8 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      settings: {
        alpha: 0,
        beta: Math.PI / 2,
        radius: 10,
        orthoSize: 6,
      },
    });

    const previewForward = scene.activeCamera!.getForwardRay().direction;
    expect(previewForward.x).toBeCloseTo(helperForward.x);
    expect(previewForward.y).toBeCloseTo(helperForward.y);
    expect(previewForward.z).toBeCloseTo(helperForward.z);
  });

  it('creates preview rigs from camera projection nodes', () => {
    const rig = createBabylonSceneCameraPreviewRigFromProjectionNode({
      id: 'main_camera',
      runtimeKind: 'camera',
      transform: {
        position: { x: 0, y: 5, z: -8 },
        rotation: { x: 0.2, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      camera: {
        alpha: 1,
        beta: 2,
        radius: 3,
        orthoSize: 4,
      },
    });

    expect(rig).toEqual({
      transform: {
        position: { x: 0, y: 5, z: -8 },
        rotation: { x: 0.2, y: 0, z: 0 },
        scale: { x: 1, y: 1, z: 1 },
      },
      settings: {
        alpha: 1,
        beta: 2,
        radius: 3,
        orthoSize: 4,
      },
    });

    expect(createBabylonSceneCameraPreviewRigFromProjectionNode({
      id: 'cube',
      runtimeKind: undefined,
    })).toBeNull();
  });
});
