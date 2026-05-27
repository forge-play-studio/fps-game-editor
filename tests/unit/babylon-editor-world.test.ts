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

  it('keeps the lightweight sky backdrop out of the scene depth buffer', () => {
    const engine = new BABYLON.NullEngine();
    const world = createBabylonEditorWorld({
      engine,
      babylon: BABYLON as any,
      enableDefaultCameraControls: false,
      sky: { preset: 'simple' },
    });

    expect(world.skyBackdrop?.material?.disableDepthWrite).toBe(true);

    world.dispose();
    engine.dispose();
  });
});
