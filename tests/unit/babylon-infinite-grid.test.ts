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

  it('coarsens grid spacing as the editor camera pulls away', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera('editor-camera', 0, 1, 8, new BABYLON.Vector3(0, 0, 0), scene);
    scene.activeCamera = camera;

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
    expect(gridMeshes).toHaveLength(18);

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('uses the explicit editor camera even when the scene active camera changes', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
    const scene = new BABYLON.Scene(engine);
    const editorCamera = new BABYLON.ArcRotateCamera(
      'editor-camera',
      0,
      1,
      8,
      new BABYLON.Vector3(0, 0, 0),
      scene,
    );
    const previewCamera = new BABYLON.ArcRotateCamera(
      'preview-camera',
      0,
      1,
      800,
      new BABYLON.Vector3(0, 0, 0),
      scene,
    );
    scene.activeCamera = previewCamera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: editorCamera,
      name: 'explicit-camera-grid',
      halfLineCount: 4,
      adaptiveSteps: [1, 5, 10, 50, 100],
      targetScreenSpacingPx: 48,
    });

    expect(grid.getStep()).toBe(1);
    expect(() => scene.render()).not.toThrow();
    expect(grid.getStep()).toBe(1);

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('updates grid colors without recreating grid meshes', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera('editor-camera', 0, 1, 8, new BABYLON.Vector3(0, 0, 0), scene);
    scene.activeCamera = camera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera,
      name: 'recolor-grid',
      halfLineCount: 1,
    });
    const initialMeshes = scene.meshes.filter(mesh => mesh.metadata?.editorGrid);

    grid.setColors({
      gridColor: { r: 0.11, g: 0.22, b: 0.33 },
      majorGridColor: { r: 0.4, g: 0.5, b: 0.6 },
      axisXColor: { r: 0.7, g: 0.1, b: 0.2 },
      axisZColor: { r: 0.2, g: 0.3, b: 0.8 },
    });

    expect(scene.meshes.filter(mesh => mesh.metadata?.editorGrid)).toEqual(initialMeshes);
    expect(scene.meshes.find(mesh => mesh.name === 'recolor-grid-x-1')?.color).toMatchObject({ r: 0.11, g: 0.22, b: 0.33 });
    expect(scene.meshes.find(mesh => mesh.name === 'recolor-grid-x-0')?.color).toMatchObject({ r: 0.7, g: 0.1, b: 0.2 });
    expect(scene.meshes.find(mesh => mesh.name === 'recolor-grid-z-0')?.color).toMatchObject({ r: 0.2, g: 0.3, b: 0.8 });

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });
});
