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

    const initialStep = grid.getStep();
    expect(initialStep).toBeGreaterThan(0);

    camera.radius = 800;
    expect(() => scene.render()).not.toThrow();
    expect(grid.getStep()).toBeGreaterThan(initialStep);

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
    expect(Math.max(...visibleCoordinates.map(value => Math.abs(value)))).toBeLessThanOrEqual(96 + grid.getStep());

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('updates grouped grid colors without rebuilding grid meshes', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
    const scene = new BABYLON.Scene(engine);
    const camera = new BABYLON.ArcRotateCamera('editor-camera', 0, 1, 8, new BABYLON.Vector3(0, 0, 0), scene);
    scene.activeCamera = camera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera,
      name: 'recolor-grid',
      halfLineCount: 8,
    });
    const initialMeshes = scene.meshes.filter(mesh => mesh.metadata?.editorGrid);

    grid.setColors({
      gridColor: { r: 0.11, g: 0.22, b: 0.33 },
      majorGridColor: { r: 0.4, g: 0.5, b: 0.6 },
      axisXColor: { r: 0.7, g: 0.1, b: 0.2 },
      axisZColor: { r: 0.2, g: 0.3, b: 0.8 },
    });

    expect(scene.meshes.filter(mesh => mesh.metadata?.editorGrid)).toEqual(initialMeshes);
    expect(scene.meshes.find(mesh => mesh.metadata?.editorGridGroup === 'regular')?.color).toMatchObject({ r: 0.11, g: 0.22, b: 0.33 });
    expect(scene.meshes.find(mesh => mesh.metadata?.editorGridGroup === 'major')?.color).toMatchObject({ r: 0.4, g: 0.5, b: 0.6 });
    expect(scene.meshes.find(mesh => mesh.metadata?.editorGridGroup === 'axis-x')?.color).toMatchObject({ r: 0.7, g: 0.1, b: 0.2 });
    expect(scene.meshes.find(mesh => mesh.metadata?.editorGridGroup === 'axis-z')?.color).toMatchObject({ r: 0.2, g: 0.3, b: 0.8 });

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('covers the active preview camera ground footprint when a dynamic render camera is provided', () => {
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
      'editor-main-camera-preview',
      Math.PI / 4,
      0.85,
      42,
      new BABYLON.Vector3(85, 0, 55),
      scene,
    );
    previewCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    previewCamera.orthoLeft = -22;
    previewCamera.orthoRight = 22;
    previewCamera.orthoTop = 14;
    previewCamera.orthoBottom = -14;
    previewCamera.minZ = 0.1;
    previewCamera.maxZ = 400;
    scene.activeCamera = editorCamera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: editorCamera,
      getCamera: () => scene.activeCamera as any,
      name: 'preview-camera-grid',
      halfLineCount: 8,
      adaptiveSteps: [1, 2, 5, 10, 20],
      targetScreenSpacingPx: 48,
    });

    scene.activeCamera = previewCamera;
    expect(() => scene.render()).not.toThrow();

    const footprint = readGroundFootprint(scene, previewCamera);
    const bounds = readEnabledGridBounds(scene);
    expect(bounds.minX).toBeLessThanOrEqual(footprint.minX + 0.001);
    expect(bounds.maxX).toBeGreaterThanOrEqual(footprint.maxX - 0.001);
    expect(bounds.minZ).toBeLessThanOrEqual(footprint.minZ + 0.001);
    expect(bounds.maxZ).toBeGreaterThanOrEqual(footprint.maxZ - 0.001);

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });

  it('keeps the local grid density stable as an orthographic preview camera tilts toward the horizon', () => {
    const engine = new BABYLON.NullEngine({ renderWidth: 1280, renderHeight: 720 });
    const scene = new BABYLON.Scene(engine);
    const previewCamera = new BABYLON.ArcRotateCamera(
      'editor-main-camera-preview',
      Math.PI / 4,
      0.75,
      42,
      new BABYLON.Vector3(85, 0, 55),
      scene,
    );
    previewCamera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
    previewCamera.orthoLeft = -22;
    previewCamera.orthoRight = 22;
    previewCamera.orthoTop = 14;
    previewCamera.orthoBottom = -14;
    previewCamera.minZ = 0.1;
    previewCamera.maxZ = 400;
    scene.activeCamera = previewCamera;

    const grid = createBabylonEditorInfiniteGrid({
      babylon: BABYLON as any,
      scene: scene as any,
      camera: previewCamera,
      getCamera: () => scene.activeCamera as any,
      name: 'stable-density-grid',
      halfLineCount: 8,
      adaptiveSteps: [1, 2, 5, 10, 20, 50],
      targetScreenSpacingPx: 48,
    });

    const downwardStep = grid.getStep();
    previewCamera.beta = 1.42;
    expect(() => scene.render()).not.toThrow();
    expect(grid.getStep()).toBe(downwardStep);

    const footprint = readGroundFootprint(scene, previewCamera);
    const bounds = readEnabledGridBounds(scene);
    expect(bounds.minX).toBeLessThanOrEqual(footprint.minX + 0.001);
    expect(bounds.maxX).toBeGreaterThanOrEqual(footprint.maxX - 0.001);
    expect(bounds.minZ).toBeLessThanOrEqual(footprint.minZ + 0.001);
    expect(bounds.maxZ).toBeGreaterThanOrEqual(footprint.maxZ - 0.001);

    grid.dispose();
    scene.dispose();
    engine.dispose();
  });
});

function readEnabledGridBounds(scene: BABYLON.Scene): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const points: Array<{ x: number; z: number }> = [];
  for (const mesh of scene.meshes.filter(mesh => mesh.metadata?.editorGrid && mesh.isEnabled())) {
    const positions = Array.from(mesh.getVerticesData(BABYLON.VertexBuffer.PositionKind) ?? []) as number[];
    for (let index = 0; index + 5 < positions.length; index += 6) {
      const segment = positions.slice(index, index + 6);
      if (segment.every(value => Math.abs(value) < 0.000001)) continue;
      points.push({ x: segment[0], z: segment[2] });
      points.push({ x: segment[3], z: segment[5] });
    }
  }
  expect(points.length).toBeGreaterThan(0);
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)),
    maxZ: Math.max(...points.map(point => point.z)),
  };
}

function readGroundFootprint(
  scene: BABYLON.Scene,
  camera: BABYLON.Camera,
): { minX: number; maxX: number; minZ: number; maxZ: number } {
  const engine = scene.getEngine();
  const viewport = camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight());
  const samples = [
    [0, 0],
    [0.5, 0],
    [1, 0],
    [1, 0.5],
    [1, 1],
    [0.5, 1],
    [0, 1],
    [0, 0.5],
    [0.5, 0.5],
  ];
  const points = samples
    .map(([x, y]) => scene.createPickingRay(
      viewport.x + viewport.width * x,
      viewport.y + viewport.height * y,
      BABYLON.Matrix.Identity(),
      camera,
    ))
    .map(intersectGround)
    .filter((point): point is { x: number; z: number } => !!point);
  expect(points.length).toBeGreaterThan(1);
  return {
    minX: Math.min(...points.map(point => point.x)),
    maxX: Math.max(...points.map(point => point.x)),
    minZ: Math.min(...points.map(point => point.z)),
    maxZ: Math.max(...points.map(point => point.z)),
  };
}

function intersectGround(ray: BABYLON.Ray): { x: number; z: number } | null {
  if (Math.abs(ray.direction.y) < 0.000001) return null;
  const distance = -ray.origin.y / ray.direction.y;
  if (!Number.isFinite(distance) || distance < 0) return null;
  return {
    x: ray.origin.x + ray.direction.x * distance,
    z: ray.origin.z + ray.direction.z * distance,
  };
}
