import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createBabylonEditorInfiniteGrid } from '../../packages/editor-babylon/src';

describe('Babylon editor infinite grid', () => {
  it('creates a camera-following non-pickable grid that can be toggled and disposed', () => {
    const engine = new BABYLON.NullEngine();
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera('editor-camera', 0, 1, 8, new BABYLON.Vector3(0, 0, 0), scene);
    scene.activeCamera = camera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera,
      name: 'test-grid',
      halfLineCount: 4,
    });

    const gridMeshes = scene.meshes.filter(mesh => mesh.metadata?.editorGrid);
    expect(gridMeshes).toHaveLength(18);
    expect(gridMeshes.every(mesh => mesh.isPickable === false)).toBe(true);
    expect(grid.isVisible()).toBe(true);

    grid.setVisible(false);
    expect(grid.isVisible()).toBe(false);
    expect(gridMeshes.every(mesh => mesh.isEnabled() === false)).toBe(true);

    grid.setVisible(true);
    camera.target.x = 12;
    camera.target.z = -8;
    expect(() => scene.render()).not.toThrow();
    expect(gridMeshes.every(mesh => mesh.isEnabled() === true)).toBe(true);

    grid.dispose();
    expect(scene.meshes.filter(mesh => mesh.metadata?.editorGrid)).toHaveLength(0);

    scene.dispose();
    engine.dispose();
  });
});
