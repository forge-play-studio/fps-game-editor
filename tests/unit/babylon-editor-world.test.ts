import * as BABYLON from '@babylonjs/core';
import { describe, expect, it } from 'vitest';

import { createBabylonEditorWorld } from '../../packages/editor-babylon/src/editor-world';

describe('Babylon editor world', () => {
  it('owns the editor camera as the active and pointer camera without enabling multi-camera rendering', () => {
    const engine = new BABYLON.NullEngine();
    const world = createBabylonEditorWorld({
      engine,
      babylon: BABYLON as any,
      enableDefaultCameraControls: false,
    });

    expect(world.scene.activeCamera).toBe(world.camera);
    expect(world.scene.cameraToUseForPointers).toBe(world.camera);
    expect(world.scene.activeCameras?.length ?? 0).toBe(0);
    expect(world.scene.activeCameras?.includes(world.camera) ?? false).toBe(false);

    world.dispose();
    engine.dispose();
  });

  it('updates world appearance without creating a hidden fallback light', () => {
    const engine = new BABYLON.NullEngine();
    const world = createBabylonEditorWorld({
      engine,
      babylon: BABYLON as any,
      clearColor: { r: 0.1, g: 0.2, b: 0.3, a: 1 },
      sky: false,
      enableDefaultCameraControls: false,
    });

    expect(world.scene.lights).toHaveLength(0);
    expect(world.scene.clearColor).toMatchObject({ r: 0.1, g: 0.2, b: 0.3, a: 1 });

    world.setAppearance({
      clearColor: { r: 0.4, g: 0.5, b: 0.6, a: 1 },
      sky: false,
    });

    expect(world.scene.lights).toHaveLength(0);
    expect(world.scene.clearColor).toMatchObject({ r: 0.4, g: 0.5, b: 0.6, a: 1 });

    world.dispose();
    engine.dispose();
  });
});
