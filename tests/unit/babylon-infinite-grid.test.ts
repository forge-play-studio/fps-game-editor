import { describe, expect, it } from 'vitest';
import * as BABYLON from '@babylonjs/core';
import { createBabylonEditorInfiniteGrid } from '../../packages/editor-babylon/src';

describe('Babylon editor infinite grid', () => {
  it('creates a camera-following non-pickable grid that can be toggled and disposed', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
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
    expect(gridMeshes).toHaveLength(4);
    expect(gridMeshes.every(mesh => mesh.isPickable === false)).toBe(true);
    expect(grid.isVisible()).toBe(true);

    grid.setVisible(false);
    expect(grid.isVisible()).toBe(false);
    expect(gridMeshes.every(mesh => mesh.isEnabled() === false)).toBe(true);

    grid.setVisible(true);
    camera.target.x = 12;
    camera.target.z = -8;
    expect(() => scene.render()).not.toThrow();
    expect(gridMeshes.some(mesh => mesh.isEnabled() === true)).toBe(true);

    grid.dispose();
    expect(scene.meshes.filter(mesh => mesh.metadata?.editorGrid)).toHaveLength(0);

    scene.dispose();
    engine.dispose();
  });

  it('coarsens grid spacing as the editor camera pulls away', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
    const scene = new BABYLON.Scene(engine);
    const runtimeCamera = new BABYLON.ArcRotateCamera('runtime-camera', 0, 1, 800, new BABYLON.Vector3(0, 0, 0), scene);
    const camera = new BABYLON.ArcRotateCamera('editor-camera', 0, 1, 8, new BABYLON.Vector3(0, 0, 0), scene);
    scene.activeCamera = runtimeCamera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera,
      name: 'adaptive-grid',
      halfLineCount: 4,
      adaptiveSteps: [1, 5, 10, 50, 100],
      targetScreenSpacingPx: 48,
    });

    expect(grid.getStep()).toBe(1);

    camera.radius = 800;
    expect(() => scene.render()).not.toThrow();
    expect(grid.getStep()).toBeGreaterThan(1);

    const gridMeshes = scene.meshes.filter(mesh => mesh.metadata?.editorGrid);
    expect(gridMeshes).toHaveLength(4);

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('chunks dense grid lines into bounded line systems', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera('editor-camera', 0, 1, 8, new BABYLON.Vector3(0, 0, 0), scene);
    scene.activeCamera = camera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera,
      name: 'chunked-grid',
      halfLineCount: 96,
    });

    const gridMeshes = scene.meshes.filter(mesh => mesh.metadata?.editorGrid);
    expect(gridMeshes.length).toBeGreaterThan(4);
    expect(gridMeshes.length).toBeLessThan(96 * 4 + 2);
    expect(Math.max(...gridMeshes.map(mesh => mesh.getTotalVertices()))).toBeLessThanOrEqual(128);
    const visibleGridMeshes = gridMeshes.filter(mesh => mesh.isEnabled());
    const visibleCoordinates = visibleGridMeshes.flatMap(mesh => (
      Array.from(mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) ?? []) as number[]
    )).filter((_value, index) => index % 3 !== 1);
    expect(Math.max(...visibleCoordinates.map(value => Math.abs(value)))).toBeLessThan(96);

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });
});
