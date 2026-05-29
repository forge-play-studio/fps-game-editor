import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createBabylonSceneViewCameraController } from '../../packages/editor-babylon/src/scene-view-camera-controller';

function createInputStub() {
  return {
    getState: () => ({
      activeIntent: null,
      navigationMode: 'none',
      activePointer: null,
      pressedMovementKeys: [],
      flySpeed: 1,
    }),
    cancelActiveIntent: () => {},
    dispose: () => {},
  } as any;
}

function createMutableInputStub(state: {
  activeIntent: string | null;
  navigationMode: string;
  activePointer: unknown | null;
  pressedMovementKeys: string[];
  flySpeed: number;
}) {
  return {
    getState: () => state,
    cancelActiveIntent: () => {},
    dispose: () => {},
  } as any;
}

describe('Babylon scene view camera controller', () => {
  it('switches view presets to orthographic camera directions and restores perspective', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera(
      'editor',
      0.7,
      1.1,
      12,
      new BABYLON.Vector3(1, 2, 3),
      scene,
    );

    const controller = createBabylonSceneViewCameraController({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: camera as any,
      input: createInputStub(),
    });

    expect(controller.getState()).toEqual({
      viewPreset: 'perspective',
      projectionMode: 'perspective',
    });

    expect(controller.setViewPreset('top', {
      target: { x: 2, y: 3, z: 4 },
      radius: 18,
    })).toBe(true);
    expect(camera.mode).toBe(BABYLON.Camera.ORTHOGRAPHIC_CAMERA);
    expect(camera.alpha).toBeCloseTo(Math.PI / 2);
    expect(camera.beta).toBeCloseTo(0.01);
    expect(camera.radius).toBe(18);
    expect(camera.target).toMatchObject({ x: 2, y: 3, z: 4 });
    expect(controller.getState()).toEqual({
      viewPreset: 'top',
      projectionMode: 'orthographic',
    });

    controller.setViewPreset('front', { radius: 10 });
    expect(camera.alpha).toBeCloseTo(-Math.PI / 2);
    expect(camera.beta).toBeCloseTo(Math.PI / 2);

    controller.setViewPreset('right', { radius: 9 });
    expect(camera.alpha).toBeCloseTo(0);
    expect(camera.beta).toBeCloseTo(Math.PI / 2);

    expect(controller.handlePointerIntentMove({
      state: {
        pointerId: 1,
        button: 'middle',
        intent: 'orbit',
        start: { x: 0, y: 0 },
        current: { x: 8, y: 3 },
        delta: { x: 8, y: 3 },
        modifiers: { alt: true, shift: false, ctrl: false, meta: false },
      },
      originalEvent: {} as PointerEvent,
    })).toBe(true);
    expect(controller.getState()).toEqual({
      viewPreset: 'perspective',
      projectionMode: 'orthographic',
    });

    expect(controller.setViewPreset('perspective')).toBe(true);
    expect(camera.mode).toBe(BABYLON.Camera.PERSPECTIVE_CAMERA);
    expect(camera.alpha).toBeCloseTo(0.7);
    expect(camera.beta).toBeCloseTo(1.1);
    expect(camera.radius).toBe(12);
    expect(controller.getState()).toEqual({
      viewPreset: 'perspective',
      projectionMode: 'perspective',
    });

    controller.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('toggles orthographic and perspective projection without changing view preset', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera(
      'editor',
      0.2,
      1,
      8,
      BABYLON.Vector3.Zero(),
      scene,
    );
    const controller = createBabylonSceneViewCameraController({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: camera as any,
      input: createInputStub(),
    });

    expect(controller.setProjectionMode('orthographic')).toBe(true);
    expect(camera.mode).toBe(BABYLON.Camera.ORTHOGRAPHIC_CAMERA);
    expect(camera.orthoTop).toBeGreaterThan(0);
    expect(camera.orthoRight).toBeGreaterThan(0);
    expect(controller.getState()).toEqual({
      viewPreset: 'perspective',
      projectionMode: 'orthographic',
    });

    expect(controller.setProjectionMode('perspective')).toBe(true);
    expect(camera.mode).toBe(BABYLON.Camera.PERSPECTIVE_CAMERA);
    expect(controller.getState()).toEqual({
      viewPreset: 'perspective',
      projectionMode: 'perspective',
    });

    controller.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('rotates flythrough look in place instead of orbiting around the target', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera(
      'editor',
      0.7,
      1.1,
      12,
      new BABYLON.Vector3(1, 2, 3),
      scene,
    );
    scene.activeCamera = camera;
    scene.render();
    const beforePosition = camera.position.clone();
    const beforeTarget = camera.target.clone();
    const beforeForward = camera.getForwardRay().direction.clone();
    const controller = createBabylonSceneViewCameraController({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: camera as any,
      input: createInputStub(),
    });

    expect(controller.handlePointerIntentMove({
      state: {
        pointerId: 1,
        button: 'right',
        intent: 'flythrough',
        start: { x: 0, y: 0 },
        current: { x: 24, y: -10 },
        delta: { x: 24, y: -10 },
        modifiers: { alt: false, shift: false, ctrl: false, meta: false },
      },
      originalEvent: {} as PointerEvent,
    })).toBe(true);
    scene.render();

    expect(BABYLON.Vector3.Distance(camera.position, beforePosition)).toBeLessThan(0.000001);
    expect(BABYLON.Vector3.Distance(camera.target, beforeTarget)).toBeGreaterThan(0.01);
    expect(BABYLON.Vector3.Distance(camera.getForwardRay().direction, beforeForward)).toBeGreaterThan(0.01);

    controller.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps orbit navigation as a target-centered rotation', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera(
      'editor',
      0.7,
      1.1,
      12,
      new BABYLON.Vector3(1, 2, 3),
      scene,
    );
    scene.activeCamera = camera;
    scene.render();
    const beforePosition = camera.position.clone();
    const beforeTarget = camera.target.clone();
    const controller = createBabylonSceneViewCameraController({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: camera as any,
      input: createInputStub(),
    });

    expect(controller.handlePointerIntentMove({
      state: {
        pointerId: 1,
        button: 'middle',
        intent: 'orbit',
        start: { x: 0, y: 0 },
        current: { x: 24, y: -10 },
        delta: { x: 24, y: -10 },
        modifiers: { alt: true, shift: false, ctrl: false, meta: false },
      },
      originalEvent: {} as PointerEvent,
    })).toBe(true);
    scene.render();

    expect(BABYLON.Vector3.Distance(camera.target, beforeTarget)).toBeLessThan(0.000001);
    expect(BABYLON.Vector3.Distance(camera.position, beforePosition)).toBeGreaterThan(0.01);

    controller.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('moves flythrough camera from the editor frame tick instead of engine delta time', () => {
    const engine = new BABYLON.NullEngine();
    engine.getDeltaTime = () => 0;
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera(
      'editor',
      Math.PI / 4,
      Math.PI / 3,
      12,
      new BABYLON.Vector3(0, 0.6, 0),
      scene,
    );
    scene.activeCamera = camera;
    const inputState = {
      activeIntent: 'flythrough',
      navigationMode: 'flythrough',
      activePointer: null,
      pressedMovementKeys: ['w'],
      flySpeed: 1,
    };
    const controller = createBabylonSceneViewCameraController({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: camera as any,
      input: createMutableInputStub(inputState),
    });
    const before = camera.target.clone();

    scene.render();
    expect(camera.target.equals(before)).toBe(true);

    expect(controller.updateFrame({
      deltaSeconds: 1 / 60,
    })).toBe(true);

    expect(camera.target.equals(before)).toBe(false);

    controller.dispose();
    scene.dispose();
    engine.dispose();
  });
});
