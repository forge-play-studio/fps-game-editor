import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createBabylonEditorSkyBackdrop } from '../../packages/editor-babylon/src';

describe('Babylon editor sky backdrop', () => {
  it('uses the low-cost vertex-color sky by default', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 320, renderHeight: 180 });
    const scene = new BABYLON.Scene(engine);

    const sky = createBabylonEditorSkyBackdrop({
      babylon: BABYLON as any,
      scene: scene as any,
    });

    expect(sky).not.toBeNull();
    expect(sky?.material).toBeInstanceOf(BABYLON.StandardMaterial);
    expect(sky?.mesh.getTotalVertices()).toBeLessThan(1000);
    expect(sky?.mesh.isPickable).toBe(false);

    sky?.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps the shader sky behind an atmospheric preset opt-in', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 320, renderHeight: 180 });
    const scene = new BABYLON.Scene(engine);

    const sky = createBabylonEditorSkyBackdrop({
      babylon: BABYLON as any,
      scene: scene as any,
      sky: { preset: 'atmospheric' },
    });

    expect(sky).not.toBeNull();
    expect(sky?.material).toBeInstanceOf(BABYLON.ShaderMaterial);

    sky?.dispose();
    scene.dispose();
    engine.dispose();
  });
});
